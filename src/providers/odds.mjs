import { S } from '../state.mjs';
import { $, num, clamp } from '../util.mjs';
import { fetchT } from './transport.mjs';
import { mapTeamName } from './common.mjs';
import { ODDS_RULES } from '../config.mjs';
import { markHealth } from './registry.mjs';
import { validateOdds } from './validate.mjs';
import { recordIssues, recordRetry } from '../state.mjs';
import { policyFor, withRetry, isRetryableStatus, safeEndpoint } from './retry.mjs';
/* ---------------------------------------------------------------------
   ODDS LAYER — bookmaker match odds converted to market-implied goals.
   The market prices team news and everything else in minutes; the model
   defers to it heavily where it has a quote.
   --------------------------------------------------------------------- */
S.odds = null; S.oddsNote = '';
function poissonOver(lambda, line){
  // P(N > line) for half-goal lines
  const k = Math.floor(line);
  let cum = 0, term = Math.exp(-lambda);
  for(let i=0; i<=k; i++){ cum += term; term *= lambda/(i+1); }
  return 1 - cum;
}
function solveLambda(pOver, line){
  let lo = 0.2, hi = 6.5;
  for(let i=0; i<40; i++){
    const mid = (lo+hi)/2;
    if(poissonOver(mid, line) < pOver) lo = mid; else hi = mid;
  }
  return (lo+hi)/2;
}
async function loadOdds(){
  S.odds = null; S.oddsNote = '';
  const key = $('oddsKey').value.trim();
  if(!key || !S.boot) return;
  let data = null;
  // SEC-1: this request carries the API key, so it must NEVER transit a public
  // relay. Direct-only; on failure fall back to the internal team model and
  // reduce confidence — do not retry via proxies. D-15 retries the DIRECT
  // request only, which leaves that guarantee structurally intact.
  const oddsUrl = 'https://api.the-odds-api.com/v4/sports/soccer_epl/odds/?regions=uk&markets=h2h,totals&oddsFormat=decimal&apiKey=' + encodeURIComponent(key);
  const { result, record } = await withRetry(
    async () => {
      let res;
      try{ res = await fetchT(oddsUrl, 10000); }
      catch(e){ return {ok:false, retryable:true, status:'network'}; }
      // 401 is a bad key and 429 is an exhausted quota WINDOW, not a transient
      // burst — retrying either just delays the same answer, so both are permanent.
      if(res.status === 401 || res.status === 429) return {ok:false, retryable:false, status:res.status};
      if(!res.ok) return {ok:false, retryable:isRetryableStatus(res.status), status:res.status};
      try{ return {ok:true, value: await res.json(), status:res.status}; }
      catch(e){ return {ok:false, retryable:false, status:'parse'}; }
    },
    { ...policyFor('odds'), endpoint: safeEndpoint(oddsUrl) }
  );
  recordRetry(record);
  if(result && result.ok) data = result.value;
  else if(record.finalStatus === 401){ S.oddsNote = 'Odds API key rejected — check it at the-odds-api.com.'; return; }
  else if(record.finalStatus === 429){ S.oddsNote = 'Odds API quota used up for this period.'; return; }
  else if(record.finalStatus === 'network' || record.finalStatus === 'parse'){
    // the pre-D-15 catch block covered both of these; message kept identical
    S.oddsNote = 'Odds provider unreachable — internal team model active (reduced confidence).';
    markHealth('odds', false, 'direct fetch failed', true);
    return;
  }
  // D-14: validate the event array before the parsing loop touches it.
  const oddsV = validateOdds(data);
  recordIssues('odds', 'v4/sports/soccer_epl/odds', oddsV.issues);
  data = oddsV.value;
  if(!Array.isArray(data) || !data.length){ if(!S.oddsNote) S.oddsNote = 'No EPL odds returned (out of season window, or feed empty).'; return; }

  const fetchedAt = Date.now();
  const parsed = []; // one entry per provider event, with full provenance
  data.forEach(ev => {
    const hId = mapTeamName(ev.home_team), aId = mapTeamName(ev.away_team);
    if(!hId || !aId) return;
    const kickoff = ev.commence_time ? Date.parse(ev.commence_time) : null;
    let h2h = [], overs = [], booksUsed = 0, marketCount = 0, staleDropped = 0;
    (ev.bookmakers||[]).forEach(bk => {
      const quoteAgeH = bk.last_update ? (fetchedAt - Date.parse(bk.last_update))/3.6e6 : 0;
      if(quoteAgeH > ODDS_RULES.maxQuoteAgeHours){ staleDropped++; return; }   // staleness rule
      let counted = false;
      (bk.markets||[]).forEach(mk => {
        marketCount++;
        if(mk.key === 'h2h' && mk.outcomes?.length >= 2){
          const o = {}; mk.outcomes.forEach(x => o[x.name] = 1/x.price);
          const s = Object.values(o).reduce((a,b)=>a+b,0);          // devig: normalise overround
          if(o[ev.home_team] && o[ev.away_team]){
            h2h.push({pH:o[ev.home_team]/s, pA:o[ev.away_team]/s}); counted = true;
          }
        }
        if(mk.key === 'totals'){
          const over = mk.outcomes?.find(x => x.name === 'Over');
          const under = mk.outcomes?.find(x => x.name === 'Under');
          if(over && under && Math.abs(over.point - 2.5) <= 1.01){
            const po = (1/over.price)/((1/over.price)+(1/under.price));
            overs.push({p:po, line:over.point}); counted = true;
          }
        }
      });
      if(counted) booksUsed++;
    });
    // outlier rejection: drop books whose devigged home prob deviates from median
    if(h2h.length >= 3){
      const med = h2h.map(x=>x.pH).sort((a,b)=>a-b)[Math.floor(h2h.length/2)];
      h2h = h2h.filter(x => Math.abs(x.pH - med) <= ODDS_RULES.outlierProbDeviation);
    }
    // inclusion rules (thin markets skipped, not guessed at)
    if(h2h.length < ODDS_RULES.minH2hBooks || overs.length < ODDS_RULES.minTotalsBooks) return;
    const avg = a => a.reduce((x,y)=>x+y,0)/a.length;
    const lambda = solveLambda(avg(overs.map(o=>o.p)), overs[0].line);
    const r = Math.pow(avg(h2h.map(x=>x.pH))/avg(h2h.map(x=>x.pA)), 0.45); // split approximation, unchanged
    parsed.push({ hId, aId, kickoff,
      xGH: lambda * r/(1+r), xGA: lambda/(1+r),
      providerEventId: ev.id ?? null, fetchedAt,
      booksUsed, marketCount, staleDropped,
      confidence: booksUsed >= ODDS_RULES.lowConfidenceBooks ? 'normal' : 'low' });
  });

  // fixture matching: teams + kickoff proximity (adjustment 5), not pair alone.
  // Falls back to pair-only when the cached fixture lacks kickoff_time.
  const map = {}; let priced = 0;
  const windowMs = ODDS_RULES.kickoffMatchWindowHours * 3.6e6;
  const upcoming = (S.fixtures||[]).filter(f => !f.finished);
  parsed.forEach(entry => {
    const fx = upcoming.find(f => f.team_h === entry.hId && f.team_a === entry.aId &&
      (!f.kickoff_time || !entry.kickoff || Math.abs(Date.parse(f.kickoff_time) - entry.kickoff) <= windowMs));
    if(!fx) return;                       // event doesn't correspond to a known upcoming fixture
    const pair = entry.hId + '|' + entry.aId;
    if(map[pair] && map[pair].kickoff && entry.kickoff &&
       fx.kickoff_time && Math.abs(Date.parse(fx.kickoff_time) - map[pair].kickoff)
         <= Math.abs(Date.parse(fx.kickoff_time) - entry.kickoff)) return; // keep closer match
    map[pair] = entry;
    priced++;
  });
  markHealth('odds', priced > 0, priced + ' fixtures priced');
  if(priced){ S.odds = map; S.oddsNote = `Odds: ${priced} fixture${priced===1?'':'s'} priced by the market.`; }
  else S.oddsNote = 'Odds feed answered but no fixtures could be matched.';
}

export { poissonOver, solveLambda, loadOdds };
