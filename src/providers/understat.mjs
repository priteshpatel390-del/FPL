import { S } from '../state.mjs';
import { $, num } from '../util.mjs';
import { fetchVia } from './transport.mjs';
import { mapTeamName } from './common.mjs';
import { validateUnderstat, collapseIssues } from './validate.mjs';
import { recordIssues, recordRetry } from '../state.mjs';
import { MODEL_VERSION, SCHEMA_VERSION, SUPPORTING_REFRESH_RULES } from '../config.mjs';
import { K_UNDERSTAT, sget, sset } from '../storage.mjs';
import { validUnderstatMap, understatSignature, nextProviderToken, applyProviderResult, providerPersistCandidate } from './applied.mjs';
/* ---------------------------------------------------------------------
   UNDERSTAT LAYER — rolling actual xG replaces trusting FPL's slow-moving
   strength ratings. Parses the teamsData JSON embedded in the league page.
   --------------------------------------------------------------------- */
S.ustat = null; S.ustatNote = '';
function parseUnderstat(html){
  const m = html.match(/teamsData\s*=\s*JSON\.parse\('([^']+)'\)/);
  if(!m) return null;
  const json = m[1].replace(/\\x([0-9A-Fa-f]{2})/g, (_,h) => String.fromCharCode(parseInt(h,16)))
                   .replace(/\\'/g,"'").replace(/\\\\/g,'\\');
  try{ return JSON.parse(json); }catch(e){ return null; }
}

// R3 A3 — season and revision derive from an explicit events/fixtures list so
// provider computation runs against the STAGED core, not whatever S holds
// mid-refresh. Defaulting to S keeps every existing caller working unchanged.
function understatSeasonKey(events=S.boot?.events){
  const year=+(events?.[0]?.deadline_time||'').slice(0,4);
  return Number.isFinite(year)&&year>2000 ? year+'-'+String((year+1)%100).padStart(2,'0') : 'unknown';
}
function understatFixtureRevision(fixtures=S.fixtures){
  return (fixtures||[]).filter(fixture=>fixture?.finished===true).map(fixture=>+fixture.id)
    .filter(id=>Number.isInteger(id)&&id>0).sort((a,b)=>a-b).join(',');
}
function validUnderstatEnvelope(env,season=understatSeasonKey()){
  return Boolean(env&&typeof env==='object'&&!Array.isArray(env)&&env.schemaVersion===SCHEMA_VERSION&&env.modelVersion===MODEL_VERSION&&env.season===season);
}
function understatCacheDecision(env,{revision=understatFixtureRevision(),now=Date.now(),force=false,teams=S.boot?.teams}={}){
  const map=validUnderstatEnvelope(env)?validUnderstatMap(env.teams,teams):null;
  const age=map&&env?.fetchedAt!=null&&Number.isFinite(+env.fetchedAt)?Math.max(0,now-(+env.fetchedAt)):null;
  const usable=Boolean(map&&age!==null&&age<=SUPPORTING_REFRESH_RULES.understat.maxAgeMs);
  const due=Boolean(force||!usable||env?.fixtureRevision!==revision||age>=SUPPORTING_REFRESH_RULES.understat.maxAgeMs);
  const cooling=Boolean(!force&&env?.retryAfterAt!=null&&Number.isFinite(+env.retryAfterAt)&&now<+env.retryAfterAt);
  return {map,age,usable,due,cooling};
}
function normaliseUnderstatTeams(data,teams=S.boot?.teams){
  const map={}; let sumA=0,sumD=0,n=0;
  Object.values(data||{}).forEach(team=>{
    const hist=(team.history||[]).slice(-6);
    if(!hist.length) return;
    const xg=hist.reduce((sum,row)=>sum+num(row.xG),0)/hist.length;
    const xga=hist.reduce((sum,row)=>sum+num(row.xGA),0)/hist.length;
    const id=mapTeamName(team.title,teams);
    if(id&&xg>0&&xga>0){map[id]={xg,xga};sumA+=xg;sumD+=xga;n++;}
  });
  if(!n) return null;
  const avgXg=sumA/n,avgXga=sumD/n;
  Object.values(map).forEach(value=>{value.atk=value.xg/avgXg;value.def=avgXga/value.xga;});
  return map;
}
function cachedUnderstatResult(env,decision,teams,note='Saved validated team form active'){
  const missing=(teams||[]).filter(team=>!decision.map[team.id]).map(team=>team.short_name);
  return {outcome:'value',value:decision.map,fetchedAt:+env.fetchedAt,
    note:`Understat: cached last-6 team xG active${missing.length?`; no data for ${missing.join(', ')}`:''}.`,
    healthMark:{kind:'cached',lastSuccess:+env.fetchedAt,note,consequence:missing.length?'FPL ratings fill missing teams':'rolling team xG active'},
    summary:{source:'cache',cached:Object.keys(decision.map).length,requested:0}};
}

/* R3 A2/A3 — PURE. Reads only the staged core and captured configuration,
   writes nothing to S, the health registry or diagnostics. Everything it
   would have mutated comes back as data for the commit to apply. */
async function computeUnderstat(options={}){
  const nowFn=options.nowFn||Date.now,getStorage=options.getStorage||sget;
  const fetchPage=options.fetchPage||(url=>fetchVia(url,{asText:true,typed:true}));
  const core=options.core||{events:S.boot?.events,teams:S.boot?.teams,fixtures:S.fixtures};
  const teams=core.teams;
  const useUstat=options.config ? Boolean(options.config.useUstat) : Boolean($('useUstat').checked);
  const issues=[],retryRecords=[];
  if(!useUstat) return {outcome:'clear',value:null,note:'',issues,retryRecords,persist:null,
    healthMark:{kind:'disabled',note:'turned off in settings',consequence:'FPL strength ratings used'},summary:undefined};
  if(!teams) return {outcome:'skip',issues,retryRecords,persist:null};
  const season=core.season||understatSeasonKey(core.events),revision=understatFixtureRevision(core.fixtures),now=nowFn();
  const stored=await getStorage(K_UNDERSTAT);
  const storedValid=validUnderstatEnvelope(stored,season)?stored:null;
  const envelope={schemaVersion:SCHEMA_VERSION,modelVersion:MODEL_VERSION,season,
    fixtureRevision:typeof storedValid?.fixtureRevision==='string'?storedValid.fixtureRevision:'',
    fetchedAt:storedValid?.fetchedAt!=null&&Number.isFinite(+storedValid.fetchedAt)?+storedValid.fetchedAt:null,
    teams:validUnderstatMap(storedValid?.teams,teams),
    label:typeof storedValid?.label==='string'?storedValid.label.slice(0,80):'',
    lastFailureAt:storedValid?.lastFailureAt!=null&&Number.isFinite(+storedValid.lastFailureAt)?+storedValid.lastFailureAt:null,
    retryAfterAt:storedValid?.retryAfterAt!=null&&Number.isFinite(+storedValid.retryAfterAt)?+storedValid.retryAfterAt:null,
    failureReason:typeof storedValid?.failureReason==='string'?storedValid.failureReason.slice(0,80):null};
  const cache=understatCacheDecision(envelope,{revision,now,force:Boolean(options.force),teams});
  const cooldown=()=>({...envelope,lastFailureAt:now,retryAfterAt:now+SUPPORTING_REFRESH_RULES.understat.failureCooldownMs});
  if(!cache.due) return {...cachedUnderstatResult(envelope,cache,teams),issues,retryRecords,persist:null};
  if(cache.cooling){
    if(cache.usable) return {...cachedUnderstatResult(envelope,cache,teams,'Saved team form active · automatic retry cooling down'),issues,retryRecords,persist:null};
    return {outcome:'fallback',value:null,note:'Understat retry cooling down — using FPL strength ratings only.',
      healthMark:{kind:'fallback',note:'automatic retry cooling down',consequence:'FPL strength ratings used'},
      issues,retryRecords,persist:null,reason:'cooling',summary:{source:'fallback',cached:0,requested:0,cooling:true}};
  }
  let requested=1;
  const first=await fetchPage('https://understat.com/league/EPL');
  const html=first&&typeof first==='object'&&'value' in first?(first.retryRecords||retryRecords.push(first.retryRecord),first.value):first;
  let data = html ? parseUnderstat(html) : null;
  const uIssues = [];
  if(data){ const v = validateUnderstat(data); uIssues.push(...v.issues); data = v.value; }
  let label = 'current season';
  const matchCount = data ? Object.values(data).reduce((a,t) => a + (t.history||[]).length, 0) : 0;
  if(!data || matchCount < 40){
    const prevYear = new Date().getMonth() >= 6 ? new Date().getFullYear() - 1 : new Date().getFullYear() - 2;
    requested++;
    const second=await fetchPage('https://understat.com/league/EPL/'+prevYear);
    const prev=second&&typeof second==='object'&&'value' in second?(retryRecords.push(second.retryRecord),second.value):second;
    const pd = prev ? parseUnderstat(prev) : null;
    if(pd){
      const v = validateUnderstat(pd); uIssues.push(...v.issues);
      if(v.value){ data = v.value; label = `last season's closing form`; }
    }
  }
  const collapsed = collapseIssues(uIssues);
  issues.push({provider:'understat',endpoint:'league/EPL',issues:collapsed});
  if(!data){
    if(cache.usable) return {...cachedUnderstatResult(envelope,cache,teams,'Saved team form active · refresh unavailable'),
      issues,retryRecords,persist:{key:K_UNDERSTAT,value:{...cooldown(),failureReason:'shape_or_transport_unavailable'}}};
    return {outcome:'fallback',value:null,note:'Understat unavailable — using FPL strength ratings only.',
      healthMark:{kind:'fallback',note:'page structure or transport unavailable',consequence:'FPL strength ratings used'},
      issues,retryRecords,persist:{key:K_UNDERSTAT,value:{...cooldown(),failureReason:'shape_or_transport_unavailable'}},
      reason:'transport',summary:{source:'fallback',cached:0,requested}};
  }
  const map=normaliseUnderstatTeams(data,teams);
  if(!map){
    if(cache.usable) return {...cachedUnderstatResult(envelope,cache,teams,'Saved team form active · refresh could not map teams'),
      issues,retryRecords,persist:{key:K_UNDERSTAT,value:{...cooldown(),failureReason:'team_mapping_unavailable'}}};
    return {outcome:'fallback',value:null,note:'Understat team names could not be matched.',
      healthMark:{kind:'fallback',note:'team mapping failed',consequence:'FPL strength ratings used'},
      issues,retryRecords,persist:{key:K_UNDERSTAT,value:{...cooldown(),failureReason:'team_mapping_unavailable'}},
      reason:'mapping',summary:{source:'fallback',cached:0,requested}};
  }
  const missing = (teams||[]).filter(t => !map[t.id]).map(t => t.short_name);
  const degraded = missing.length > 0 || collapsed.some(i => i.severity === 'partial');
  return {outcome:'value',value:map,fetchedAt:now,
    note:`Understat: last-6 xG loaded (${label})` + (missing.length ? `; no data for ${missing.join(', ')} — FPL ratings used for them` : '') + '.',
    healthMark:{kind:degraded?'partial':'live',note:label,consequence:degraded?'FPL ratings fill missing teams':'rolling team xG active',lastSuccess:now},
    issues,retryRecords,
    persist:{key:K_UNDERSTAT,value:{schemaVersion:SCHEMA_VERSION,modelVersion:MODEL_VERSION,season,
      fixtureRevision:revision,fetchedAt:now,teams:map,label,missing,lastFailureAt:null,retryAfterAt:null,failureReason:null}},
    summary:{source:'live',loaded:Object.keys(map).length,requested}};
}

/* Thin wrapper. Retained so the settings handler and the existing R1 tests
   keep their exact contract, and routed through the SAME applyProviderResult
   gate the commit uses so the two paths cannot diverge (R3.4 E6). */
async function loadUnderstat(options={}){
  const setStorage=options.setStorage||sset;
  const core=options.core||{events:S.boot?.events,teams:S.boot?.teams,fixtures:S.fixtures,
    season:understatSeasonKey(S.boot?.events),elements:S.boot?.elements};
  const config=options.config||{useUstat:Boolean($('useUstat')?.checked)};
  const token=nextProviderToken('understat');
  const result=await computeUnderstat({...options,core,config});
  if(result.outcome==='skip') return;
  result.signature=understatSignature(core,config);
  const currentCore=options.currentCore||{events:S.boot?.events,teams:S.boot?.teams,fixtures:S.fixtures,
    season:understatSeasonKey(S.boot?.events),elements:S.boot?.elements};
  const currentConfig=options.currentConfig||{useUstat:Boolean($('useUstat')?.checked)};
  const verdict=applyProviderResult('understat',result,{core:currentCore,now:(options.nowFn||Date.now)(),token,
    signature:understatSignature(currentCore,currentConfig)});
  if(!verdict.discarded){
    (result.issues||[]).forEach(entry=>recordIssues(entry.provider,entry.endpoint,entry.issues));
    (result.retryRecords||[]).forEach(record=>recordRetry(record));
  }
  const persist=providerPersistCandidate('understat',result,verdict);
  if(persist) await setStorage(persist.key,persist.value);
  return result.summary;
}

export {
  parseUnderstat, understatSeasonKey, understatFixtureRevision, validUnderstatMap,
  validUnderstatEnvelope, understatCacheDecision, normaliseUnderstatTeams,
  computeUnderstat, loadUnderstat
};
