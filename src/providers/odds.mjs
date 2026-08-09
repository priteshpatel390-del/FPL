import { S } from '../state.mjs';
import { $ } from '../util.mjs';
import { fetchT } from './transport.mjs';
import { mapTeamName } from './common.mjs';
import { ODDS_RULES, MODEL_VERSION, SCHEMA_VERSION, SUPPORTING_REFRESH_RULES } from '../config.mjs';
import { HEALTH_STATES, markDisabled } from './registry.mjs';
import { validateOdds } from './validate.mjs';
import { recordIssues, recordRetry } from '../state.mjs';
import { validOddsMap, oddsSignature, nextProviderToken, applyProviderResult, providerPersistCandidate } from './applied.mjs';
import { policyFor, withRetry, isRetryableStatus, safeEndpoint } from './retry.mjs';
import { K_CFG, K_ODDS, sget, sset } from '../storage.mjs';
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

// Defence in depth for any future diagnostic path. Current user-facing odds
// messages remain fixed strings; raw provider errors and keyed URLs are never
// displayed. This helper ensures that an accidental diagnostic addition still
// cannot expose the current key or an apiKey query value.
function scrubOddsSecret(value, key = ''){
  let text = String(value ?? '');
  const secret = String(key ?? '').trim();
  if(secret){
    const variants = new Set([secret]);
    try{ variants.add(encodeURIComponent(secret)); }catch{}
    variants.forEach(v => { if(v) text = text.split(v).join('[REDACTED]'); });
  }
  return text.replace(/([?&]apiKey=)[^&#\s]*/gi, '$1[REDACTED]');
}

async function forgetOddsKey(deps = {}){
  const field = deps.field || $('oddsKey');
  const getConfig = deps.getConfig || (() => sget(K_CFG));
  const setConfig = deps.setConfig || (value => sset(K_CFG, value));
  const current = await getConfig();
  const config = current && typeof current === 'object' && !Array.isArray(current)
    ? { ...current } : {};
  delete config.oddsKey;
  if(field) field.value = '';
  await setConfig(config);
  S.odds = null;
  S.oddsNote = '';
  markDisabled('odds', 'no API key supplied', 'internal team model active');
  return config;
}

function oddsSeasonKey(events=S.boot?.events){
  const year=+(events?.[0]?.deadline_time||'').slice(0,4);
  return Number.isFinite(year)&&year>2000 ? year+'-'+String((year+1)%100).padStart(2,'0') : 'unknown';
}
function oddsRefreshInterval(now=Date.now(),events=S.boot?.events,fixtures=S.fixtures){
  const future=[];
  for(const event of events||[]){
    if(event?.finished===true) continue;
    const at=Date.parse(event?.deadline_time||'');
    if(Number.isFinite(at)&&at>=now) future.push(at);
  }
  for(const fixture of fixtures||[]){
    if(fixture?.finished===true) continue;
    const at=Date.parse(fixture?.kickoff_time||'');
    if(Number.isFinite(at)&&at>=now) future.push(at);
  }
  const next=future.length?Math.min(...future):null;
  return next!==null&&next-now<=SUPPORTING_REFRESH_RULES.odds.nearWindowMs
    ? SUPPORTING_REFRESH_RULES.odds.nearRefreshMs : SUPPORTING_REFRESH_RULES.odds.normalRefreshMs;
}
function validOddsEnvelope(env,season=oddsSeasonKey()){
  return Boolean(env&&typeof env==='object'&&!Array.isArray(env)&&env.schemaVersion===SCHEMA_VERSION&&env.modelVersion===MODEL_VERSION&&env.season===season);
}
function oddsCacheDecision(env,{now=Date.now(),force=false,refreshMs=oddsRefreshInterval(now),teams=S.boot?.teams}={}){
  const map=validOddsEnvelope(env)?validOddsMap(env.derived,teams):null;
  const checkedAge=env?.checkedAt!=null&&Number.isFinite(+env.checkedAt)?Math.max(0,now-(+env.checkedAt)):null;
  const hasData=Boolean(map&&Object.keys(map).length);
  const dataAge=hasData&&env?.fetchedAt!=null&&Number.isFinite(+env.fetchedAt)?Math.max(0,now-(+env.fetchedAt)):null;
  const usable=Boolean(dataAge!==null&&dataAge<=SUPPORTING_REFRESH_RULES.odds.maxUsableAgeMs);
  const due=Boolean(force||map===null||checkedAge===null||checkedAge>=refreshMs);
  const cooling=Boolean(!force&&env?.retryAfterAt!=null&&Number.isFinite(+env.retryAfterAt)&&now<+env.retryAfterAt);
  return {map,checkedAge,dataAge,usable,due,cooling,refreshMs};
}
function cachedOddsResult(env,decision,note='Saved validated market inputs active'){
  const priced=Object.keys(decision.map).length;
  return {outcome:'value',value:decision.map,fetchedAt:+env.fetchedAt,
    note:`Odds: ${priced} cached fixture${priced===1?'':'s'} priced by the market.`,
    healthMark:{kind:'cached',lastSuccess:+env.fetchedAt,note,consequence:'cached market layer active'},
    summary:{source:'cache',cached:priced,requested:0}};
}
function oddsCooldownMs(status){
  if(status===401) return SUPPORTING_REFRESH_RULES.odds.rejectedCooldownMs;
  if(status===429) return SUPPORTING_REFRESH_RULES.odds.quotaCooldownMs;
  return SUPPORTING_REFRESH_RULES.odds.transientCooldownMs;
}

/* R3 A2/A3 — PURE. The key is read from the captured configuration, used only
   to build the request URL, and never enters the result, the persisted
   envelope, diagnostics or any signature. */
async function computeOdds(options={}){
  const nowFn=options.nowFn||Date.now,getStorage=options.getStorage||sget;
  const core=options.core||{events:S.boot?.events,teams:S.boot?.teams,fixtures:S.fixtures};
  const teams=core.teams;
  const issues=[],retryRecords=[];
  const key=(options.config ? String(options.config.oddsKey||'') : $('oddsKey').value).trim();
  if(!key) return {outcome:'clear',value:null,note:'',issues,retryRecords,persist:null,
    healthMark:{kind:'disabled',note:'no API key supplied',consequence:'internal team model active'},summary:undefined};
  if(!teams) return {outcome:'skip',issues,retryRecords,persist:null};
  const now=nowFn(),season=core.season||oddsSeasonKey(core.events),stored=await getStorage(K_ODDS);
  const storedValid=validOddsEnvelope(stored,season)?stored:null;
  const envelope={schemaVersion:SCHEMA_VERSION,modelVersion:MODEL_VERSION,season,
    checkedAt:storedValid?.checkedAt!=null&&Number.isFinite(+storedValid.checkedAt)?+storedValid.checkedAt:null,
    fetchedAt:storedValid?.fetchedAt!=null&&Number.isFinite(+storedValid.fetchedAt)?+storedValid.fetchedAt:null,
    derived:validOddsMap(storedValid?.derived,teams),
    lastFailureAt:storedValid?.lastFailureAt!=null&&Number.isFinite(+storedValid.lastFailureAt)?+storedValid.lastFailureAt:null,
    retryAfterAt:storedValid?.retryAfterAt!=null&&Number.isFinite(+storedValid.retryAfterAt)?+storedValid.retryAfterAt:null,
    failureReason:typeof storedValid?.failureReason==='string'?storedValid.failureReason.slice(0,80):null};
  const refreshMs=oddsRefreshInterval(now,core.events,core.fixtures);
  const cache=oddsCacheDecision(envelope,{now,force:Boolean(options.force),refreshMs,teams});
  if(!cache.due){
    if(cache.usable) return {...cachedOddsResult(envelope,cache),issues,retryRecords,persist:null};
    return {outcome:'fallback',value:null,note:'No recent validated market inputs are active.',
      healthMark:{kind:'fallback',note:'recent check returned no usable fixtures',consequence:'internal team model active'},
      issues,retryRecords,persist:null,reason:'not_due',summary:{source:'fallback',cached:0,requested:0}};
  }
  if(cache.cooling){
    if(cache.usable) return {...cachedOddsResult(envelope,cache,'Saved market inputs active · automatic retry cooling down'),issues,retryRecords,persist:null};
    return {outcome:'fallback',value:null,note:'Odds automatic retry cooling down — internal team model active.',
      healthMark:{kind:'fallback',note:'automatic retry cooling down',consequence:'internal team model active'},
      issues,retryRecords,persist:null,reason:'cooling',summary:{source:'fallback',cached:0,requested:0,cooling:true}};
  }
  const fail=(status,note,healthState=HEALTH_STATES.FALLBACK)=>{
    const failed={...envelope,lastFailureAt:now,retryAfterAt:now+oddsCooldownMs(status),
      failureReason:status===401?'key_rejected':status===429?'quota_exhausted':'transient_failure'};
    const persist={key:K_ODDS,value:failed};
    if(cache.usable) return {...cachedOddsResult(envelope,cache,status===401
      ? 'Saved market inputs active · API key rejected'
      : status===429 ? 'Saved market inputs active · quota exhausted'
      : 'Saved market inputs active · refresh unavailable'),issues,retryRecords,persist};
    return {outcome:'fallback',value:null,note,
      healthMark:healthState===HEALTH_STATES.UNAVAILABLE
        ? {kind:'unavailable',note:status===401?'API key rejected':'provider unavailable',consequence:'internal team model active'}
        : {kind:'fallback',note:status===429?'quota exhausted':'direct fetch failed',consequence:'internal team model active'},
      issues,retryRecords,persist,reason:'transport',summary:{source:'fallback',cached:0,requested:1,status}};
  };
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
  retryRecords.push(record);
  if(result && result.ok) data = result.value;
  else if(record.finalStatus === 401) return fail(401,'Odds API key rejected — check it at the-odds-api.com.',HEALTH_STATES.UNAVAILABLE);
  else if(record.finalStatus === 429) return fail(429,'Odds API quota used up for this period.');
  else if(record.finalStatus === 'network' || record.finalStatus === 'parse')
    return fail(record.finalStatus,'Odds provider unreachable — internal team model active (reduced confidence).');
  else if(!result || !result.ok) return fail(record.finalStatus,'Odds provider unavailable — internal team model active.');
  const oddsV = validateOdds(data);
  issues.push({provider:'odds',endpoint:'v4/sports/soccer_epl/odds',issues:oddsV.issues});
  data = oddsV.value;
  if(!Array.isArray(data) || !data.length){
    return {outcome:'fallback',value:null,note:'No EPL odds returned (out of season window, or feed empty).',
      healthMark:{kind:'fallback',note:'feed empty',consequence:'internal team model active'},
      issues,retryRecords,reason:'empty',
      persist:{key:K_ODDS,value:{...envelope,checkedAt:now,derived:{},fetchedAt:null,lastFailureAt:null,retryAfterAt:null,failureReason:null}},
      summary:{source:'fallback',cached:0,requested:1}};
  }

  const fetchedAt = now;
  const parsed = [];
  data.forEach(ev => {
    const hId = mapTeamName(ev.home_team, teams), aId = mapTeamName(ev.away_team, teams);
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
  const upcoming = (core.fixtures||[]).filter(f => !f.finished);
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
  const persist={key:K_ODDS,value:{schemaVersion:SCHEMA_VERSION,modelVersion:MODEL_VERSION,season,checkedAt:now,
    fetchedAt:priced?now:null,derived:priced?map:{},lastFailureAt:null,retryAfterAt:null,failureReason:null}};
  if(!priced) return {outcome:'fallback',value:null,note:'Odds feed answered but no fixtures could be matched.',
    healthMark:{kind:'fallback',note:'no fixtures matched',consequence:'internal team model active'},
    issues,retryRecords,persist,reason:'unmatched',summary:{source:'fallback',loaded:0,requested:1}};
  return {outcome:'value',value:map,fetchedAt,
    note:`Odds: ${priced} fixture${priced===1?'':'s'} priced by the market.`,
    healthMark:{kind:partial?'partial':'live',note:priced+' fixtures priced',
      consequence:partial?'market layer active with reduced coverage':'market layer active',lastSuccess:fetchedAt},
    issues,retryRecords,persist,summary:{source:'live',loaded:priced,requested:1}};
}

/* Thin wrapper — same applyProviderResult gate as the refresh commit. */
async function loadOdds(options={}){
  const setStorage=options.setStorage||sset;
  const core=options.core||{events:S.boot?.events,teams:S.boot?.teams,fixtures:S.fixtures,
    season:oddsSeasonKey(S.boot?.events),elements:S.boot?.elements};
  const config=options.config||{oddsKey:$('oddsKey')?.value||''};
  const token=nextProviderToken('odds');
  const result=await computeOdds({...options,core,config});
  if(result.outcome==='skip') return;
  result.signature=oddsSignature(core,config);
  const currentCore=options.currentCore||{events:S.boot?.events,teams:S.boot?.teams,fixtures:S.fixtures,
    season:oddsSeasonKey(S.boot?.events),elements:S.boot?.elements};
  const currentConfig=options.currentConfig||{oddsKey:$('oddsKey')?.value||''};
  const verdict=applyProviderResult('odds',result,{core:currentCore,now:(options.nowFn||Date.now)(),token,
    signature:oddsSignature(currentCore,currentConfig)});
  if(!verdict.discarded){
    (result.issues||[]).forEach(entry=>recordIssues(entry.provider,entry.endpoint,entry.issues));
    (result.retryRecords||[]).forEach(record=>recordRetry(record));
  }
  const persist=providerPersistCandidate('odds',result,verdict);
  if(persist) await setStorage(persist.key,persist.value);
  return result.summary;
}

export {
  poissonOver, solveLambda, scrubOddsSecret, forgetOddsKey, oddsSeasonKey,
  oddsRefreshInterval, validOddsEnvelope, oddsCacheDecision,
  oddsCooldownMs, computeOdds, loadOdds
};
