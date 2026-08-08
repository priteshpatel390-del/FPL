import { S } from '../state.mjs';
import { $, num } from '../util.mjs';
import { fetchVia } from './transport.mjs';
import { mapTeamName } from './common.mjs';
import { markLive, markCached, markFallback, markPartial, markDisabled } from './registry.mjs';
import { validateUnderstat, collapseIssues } from './validate.mjs';
import { recordIssues } from '../state.mjs';
import { MODEL_VERSION, SCHEMA_VERSION, SUPPORTING_REFRESH_RULES } from '../config.mjs';
import { K_UNDERSTAT, sget, sset } from '../storage.mjs';
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

function understatSeasonKey(){
  const year=+(S.boot?.events?.[0]?.deadline_time||'').slice(0,4);
  return Number.isFinite(year)&&year>2000 ? year+'-'+String((year+1)%100).padStart(2,'0') : 'unknown';
}
function understatFixtureRevision(fixtures=S.fixtures){
  return (fixtures||[]).filter(fixture=>fixture?.finished===true).map(fixture=>+fixture.id)
    .filter(id=>Number.isInteger(id)&&id>0).sort((a,b)=>a-b).join(',');
}
function validUnderstatMap(value){
  if(!value||typeof value!=='object'||Array.isArray(value)) return null;
  const map={};
  for(const [id,row] of Object.entries(value)){
    const teamId=+id;
    if(!Number.isInteger(teamId)||!S.boot?.teams?.some(team=>+team.id===teamId)||!row||typeof row!=='object'||
       !['xg','xga','atk','def'].every(key=>Number.isFinite(+row[key])&&+row[key]>0)) return null;
    map[teamId]={xg:+row.xg,xga:+row.xga,atk:+row.atk,def:+row.def};
  }
  return Object.keys(map).length?map:null;
}
function validUnderstatEnvelope(env,season=understatSeasonKey()){
  return Boolean(env&&typeof env==='object'&&!Array.isArray(env)&&env.schemaVersion===SCHEMA_VERSION&&env.modelVersion===MODEL_VERSION&&env.season===season);
}
function understatCacheDecision(env,{revision=understatFixtureRevision(),now=Date.now(),force=false}={}){
  const map=validUnderstatEnvelope(env)?validUnderstatMap(env.teams):null;
  const age=map&&env?.fetchedAt!=null&&Number.isFinite(+env.fetchedAt)?Math.max(0,now-(+env.fetchedAt)):null;
  const usable=Boolean(map&&age!==null&&age<=SUPPORTING_REFRESH_RULES.understat.maxAgeMs);
  const due=Boolean(force||!usable||env?.fixtureRevision!==revision||age>=SUPPORTING_REFRESH_RULES.understat.maxAgeMs);
  const cooling=Boolean(!force&&env?.retryAfterAt!=null&&Number.isFinite(+env.retryAfterAt)&&now<+env.retryAfterAt);
  return {map,age,usable,due,cooling};
}
function normaliseUnderstatTeams(data){
  const map={}; let sumA=0,sumD=0,n=0;
  Object.values(data||{}).forEach(team=>{
    const hist=(team.history||[]).slice(-6);
    if(!hist.length) return;
    const xg=hist.reduce((sum,row)=>sum+num(row.xG),0)/hist.length;
    const xga=hist.reduce((sum,row)=>sum+num(row.xGA),0)/hist.length;
    const id=mapTeamName(team.title);
    if(id&&xg>0&&xga>0){map[id]={xg,xga};sumA+=xg;sumD+=xga;n++;}
  });
  if(!n) return null;
  const avgXg=sumA/n,avgXga=sumD/n;
  Object.values(map).forEach(value=>{value.atk=value.xg/avgXg;value.def=avgXga/value.xga;});
  return map;
}
function applyCachedUnderstat(env,decision,note='Saved validated team form active'){
  S.ustat=decision.map;
  const missing=S.boot.teams.filter(team=>!decision.map[team.id]).map(team=>team.short_name);
  S.ustatNote=`Understat: cached last-6 team xG active${missing.length?`; no data for ${missing.join(', ')}`:''}.`;
  markCached('understat',+env.fetchedAt,note,missing.length?'FPL ratings fill missing teams':'rolling team xG active');
  return {source:'cache',cached:Object.keys(decision.map).length,requested:0};
}

async function loadUnderstat(options={}){
  const nowFn=options.nowFn||Date.now,getStorage=options.getStorage||sget,setStorage=options.setStorage||sset;
  const fetchPage=options.fetchPage||(url=>fetchVia(url,{asText:true}));
  S.ustat = null; S.ustatNote = '';
  if(!$('useUstat').checked){
    markDisabled('understat', 'turned off in settings', 'FPL strength ratings used');
    return;
  }
  if(!S.boot) return;
  const season=understatSeasonKey(),revision=understatFixtureRevision(),now=nowFn();
  const stored=await getStorage(K_UNDERSTAT);
  const storedValid=validUnderstatEnvelope(stored,season)?stored:null;
  const envelope={schemaVersion:SCHEMA_VERSION,modelVersion:MODEL_VERSION,season,
    fixtureRevision:typeof storedValid?.fixtureRevision==='string'?storedValid.fixtureRevision:'',
    fetchedAt:storedValid?.fetchedAt!=null&&Number.isFinite(+storedValid.fetchedAt)?+storedValid.fetchedAt:null,
    teams:validUnderstatMap(storedValid?.teams),
    label:typeof storedValid?.label==='string'?storedValid.label.slice(0,80):'',
    lastFailureAt:storedValid?.lastFailureAt!=null&&Number.isFinite(+storedValid.lastFailureAt)?+storedValid.lastFailureAt:null,
    retryAfterAt:storedValid?.retryAfterAt!=null&&Number.isFinite(+storedValid.retryAfterAt)?+storedValid.retryAfterAt:null,
    failureReason:typeof storedValid?.failureReason==='string'?storedValid.failureReason.slice(0,80):null};
  const cache=understatCacheDecision(envelope,{revision,now,force:Boolean(options.force)});
  if(!cache.due) return applyCachedUnderstat(envelope,cache);
  if(cache.cooling){
    if(cache.usable) return applyCachedUnderstat(envelope,cache,'Saved team form active · automatic retry cooling down');
    S.ustatNote='Understat retry cooling down — using FPL strength ratings only.';
    markFallback('understat','automatic retry cooling down','FPL strength ratings used');
    return {source:'fallback',cached:0,requested:0,cooling:true};
  }
  let requested=1;
  const html=await fetchPage('https://understat.com/league/EPL');
  let data = html ? parseUnderstat(html) : null;
  const uIssues = [];
  if(data){ const v = validateUnderstat(data); uIssues.push(...v.issues); data = v.value; }
  let label = 'current season';
  const matchCount = data ? Object.values(data).reduce((a,t) => a + (t.history||[]).length, 0) : 0;
  if(!data || matchCount < 40){
    const prevYear = new Date().getMonth() >= 6 ? new Date().getFullYear() - 1 : new Date().getFullYear() - 2;
    requested++;
    const prev=await fetchPage('https://understat.com/league/EPL/'+prevYear);
    const pd = prev ? parseUnderstat(prev) : null;
    if(pd){
      const v = validateUnderstat(pd); uIssues.push(...v.issues);
      if(v.value){ data = v.value; label = `last season's closing form`; }
    }
  }
  const collapsed = collapseIssues(uIssues);
  recordIssues('understat', 'league/EPL', collapsed);
  if(!data){
    const failed={...envelope,lastFailureAt:now,retryAfterAt:now+SUPPORTING_REFRESH_RULES.understat.failureCooldownMs,failureReason:'shape_or_transport_unavailable'};
    await setStorage(K_UNDERSTAT,failed);
    if(cache.usable) return applyCachedUnderstat(envelope,cache,'Saved team form active · refresh unavailable');
    S.ustatNote='Understat unavailable — using FPL strength ratings only.';
    markFallback('understat','page structure or transport unavailable','FPL strength ratings used');
    return {source:'fallback',cached:0,requested};
  }

  const map=normaliseUnderstatTeams(data);
  if(!map){
    const failed={...envelope,lastFailureAt:now,retryAfterAt:now+SUPPORTING_REFRESH_RULES.understat.failureCooldownMs,failureReason:'team_mapping_unavailable'};
    await setStorage(K_UNDERSTAT,failed);
    if(cache.usable) return applyCachedUnderstat(envelope,cache,'Saved team form active · refresh could not map teams');
    S.ustatNote = 'Understat team names could not be matched.';
    markFallback('understat', 'team mapping failed', 'FPL strength ratings used');
    return {source:'fallback',cached:0,requested};
  }
  S.ustat = map;
  const missing = S.boot.teams.filter(t => !map[t.id]).map(t => t.short_name);
  const degraded = missing.length > 0 || collapsed.some(i => i.severity === 'partial');
  if(degraded) markPartial('understat',label,'FPL ratings fill missing teams',now);
  else markLive('understat',label,'rolling team xG active',now);
  S.ustatNote = `Understat: last-6 xG loaded (${label})` + (missing.length ? `; no data for ${missing.join(', ')} — FPL ratings used for them` : '') + '.';
  await setStorage(K_UNDERSTAT,{schemaVersion:SCHEMA_VERSION,modelVersion:MODEL_VERSION,season,
    fixtureRevision:revision,fetchedAt:now,teams:map,label,missing,lastFailureAt:null,retryAfterAt:null,failureReason:null});
  return {source:'live',loaded:Object.keys(map).length,requested};
}

export {
  parseUnderstat, understatSeasonKey, understatFixtureRevision, validUnderstatMap,
  validUnderstatEnvelope, understatCacheDecision, normaliseUnderstatTeams, loadUnderstat
};
