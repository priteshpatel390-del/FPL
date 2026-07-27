import { S } from '../state.mjs';
import { $, num, clamp } from '../util.mjs';
import { fetchT } from './transport.mjs';
import { mapTeamName } from './common.mjs';
import { ODDS_RULES } from '../config.mjs';
import { markLive, markFallback, markPartial, markDisabled, markUnavailable } from './registry.mjs';
import { validateOdds } from './validate.mjs';
import { recordIssues, recordRetry } from '../state.mjs';
import { policyFor, withRetry, isRetryableStatus, safeEndpoint } from './retry.mjs';
/* ---------------------------------------------------------------------
   ODDS LAYER — bookmaker match odds converted to market-implied goals.
   --------------------------------------------------------------------- */
S.odds = null; S.oddsNote = '';
function poissonOver(lambda, line){
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
  if(!key){
    markDisabled('odds', 'no API key supplied', 'internal team model active');
    return;
  }
  if(!S.boot) return;
  let data = null;
  const oddsUrl = 'https://api.the-odds-api.com/v4/sports/soccer_epl/odds/?regions=uk&markets=h2h,totals&oddsFormat=decimal&apiKey=' + encodeURIComponent(key);
  const { result, record } = await withRetry(
    async () => {
      let res;
      try{ res = await fetchT(oddsUrl, 10000); }
      catch(e){ return {ok:false, retryable:true, status:'network'}; }
      if(res.status === 401 || res.status === 429) return {ok:false, retryable:false, status:res.status};
      if(!res.ok) return {ok:false, retryable:isRetryableStatus(res.status), status:res.status};
      try{ return {ok:true, value: await res.json(), status:res.status}; }
      catch(e){ return {ok:false, retryable:false, status:'parse'}; }
    },
    { ...policyFor('odds'), endpoint: safeEndpoint(oddsUrl) }
  );
  recordRetry(record);
  if(result && result.ok) data = result.value;
  else if(record.finalStatus === 401){
    S.oddsNote = 'Odds API key rejected — check it at the-odds-api.com.';
    markUnavailable('odds', 'API key rejected', 'internal team model active');
    return;
  }
  else if(record.finalStatus === 429){
    S.oddsNote = 'Odds API quota used up for this period.';
    markFallback('odds', 'quota exhausted', 'internal team model active');
    return;
  }
  else if(record.finalStatus === 'network' || record.finalStatus === 'parse'){
    S.oddsNote = 'Odds provider unreachable — internal team model active (reduced confidence).';
    markFallback('odds', 'direct fetch failed', 'internal team model active');
    return;
  }
  else if(!result || !result.ok){
    S.oddsNote = 'Odds provider unavailable — internal team model active.';
    markFallback('odds', 'request failed', 'internal team model active');
    return;
  }
  const oddsV = validateOdds(data);
  recordIssues('odds', 'v4/sports/soccer_epl/odds', oddsV.issues);
  data = oddsV.value;
  if(!Array.isArray(data) || !data.length){
    S.oddsNote = 'No EPL odds returned (out of season window, or feed empty).';
    markFallback('odds', 'feed empty', 'internal team model active');
    return;
  }

  const fetchedAt = Date.now();
  const parsed = [];
  data.forEach(ev => {
    const hId = mapTeamName(ev.home_team), aId = mapTeamName(ev.away_team);
    if(!hId || !aId) return;
    const kickoff = ev.commence_time ? Date.parse(ev.commence_time) : null;
    let h2h = [], overs = [], booksUsed = 0, marketCount = 0, staleDropped = 0;
    (ev.bookmakers||[]).forEach(bk => {
      const quoteAgeH = bk.last_update ? (fetchedAt - Date.parse(bk.last_update))/3.6e6 : 0;
      if(quoteAgeH > ODDS_RULES.maxQuoteAgeHours){ staleDropped++; return; }
      let counted = false;
      (bk.markets||[]).forEach(mk => {
        marketCount++;
        if(mk.key === 'h2h' && mk.outcomes?.length >= 2){
          const o = {}; mk.outcomes.forEach(x => o[x.name] = 1/x.price);
          const s = Object.values(o).reduce((a,b)=>a+b,0);
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
    if(h2h.length >= 3){
      const med = h2h.map(x=>x.pH).sort((a,b)=>a-b)[Math.floor(h2h.length/2)];
      h2h = h2h.filter(x => Math.abs(x.pH - med) <= ODDS_RULES.outlierProbDeviation);
    }
    if(h2h.length < ODDS_RULES.minH2hBooks || overs.length < ODDS_RULES.minTotalsBooks) return;
    const avg = a => a.reduce((x,y)=>x+y,0)/a.length;
    const lambda = solveLambda(avg(overs.map(o=>o.p)), overs[0].line);
    const r = Math.pow(avg(h2h.map(x=>x.pH))/avg(h2h.map(x=>x.pA)), 0.45);
    parsed.push({ hId, aId, kickoff,
      xGH: lambda * r/(1+r), xGA: lambda/(1+r),
      providerEventId: ev.id ?? null, fetchedAt,
      booksUsed, marketCount, staleDropped,
      confidence: booksUsed >= ODDS_RULES.lowConfidenceBooks ? 'normal' : 'low' });
  });

  const map = {}; let priced = 0;
  const windowMs = ODDS_RULES.kickoffMatchWindowHours * 3.6e6;
  const upcoming = (S.fixtures||[]).filter(f => !f.finished);
  parsed.forEach(entry => {
    const fx = upcoming.find(f => f.team_h === entry.hId && f.team_a === entry.aId &&
      (!f.kickoff_time || !entry.kickoff || Math.abs(Date.parse(f.kickoff_time) - entry.kickoff) <= windowMs));
    if(!fx) return;
    const pair = entry.hId + '|' + entry.aId;
    if(map[pair] && map[pair].kickoff && entry.kickoff &&
       fx.kickoff_time && Math.abs(Date.parse(fx.kickoff_time) - map[pair].kickoff)
         <= Math.abs(Date.parse(fx.kickoff_time) - entry.kickoff)) return;
    map[pair] = entry;
    priced++;
  });
  const partial = oddsV.issues.some(i => i.severity === 'partial') || parsed.some(p => p.confidence === 'low' || p.staleDropped > 0);
  if(priced && partial) markPartial('odds', priced + ' fixtures priced', 'market layer active with reduced coverage', fetchedAt);
  else if(priced) markLive('odds', priced + ' fixtures priced', 'market layer active', fetchedAt);
  else markFallback('odds', 'no fixtures matched', 'internal team model active');
  if(priced){ S.odds = map; S.oddsNote = `Odds: ${priced} fixture${priced===1?'':'s'} priced by the market.`; }
  else S.oddsNote = 'Odds feed answered but no fixtures could be matched.';
}

export { poissonOver, solveLambda, loadOdds };
