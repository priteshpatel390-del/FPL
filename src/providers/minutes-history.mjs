import { S, recordIssues, recordRetry } from '../state.mjs';
import { minutesSignature, nextProviderToken, applyProviderResult, providerPersistCandidate } from './applied.mjs';
import { num } from '../util.mjs';
import { MODEL_VERSION, SCHEMA_VERSION, MINUTES_RULES } from '../config.mjs';
import { api, pool } from './transport.mjs';
import { sget, sset, K_MINUTES } from '../storage.mjs';
import { collapseIssues } from './validate.mjs';
import { HEALTH_STATES, setHealthDetail } from './registry.mjs';

function validateElementSummary(payload){
  const endpoint = '/element-summary/{id}/';
  if(!payload || typeof payload !== 'object' || Array.isArray(payload) || !Array.isArray(payload.history))
    return {value:null,issues:[{provider:'fpl',endpoint,code:'element_history_unusable',severity:'fatal',count:1}]};
  const history = []; let invalid = 0;
  for(const row of payload.history){
    if(!row || typeof row !== 'object' || !Number.isFinite(+row.minutes) || !Number.isFinite(+row.fixture)) { invalid++; continue; }
    history.push({fixture:+row.fixture,round:Number.isFinite(+row.round)?+row.round:null,minutes:+row.minutes,
      starts:Number.isFinite(+row.starts)?+row.starts:null,kickoff_time:typeof row.kickoff_time==='string'?row.kickoff_time:null});
  }
  const issues = invalid ? [{provider:'fpl',endpoint,code:'element_history_invalid_rows',severity:'partial',count:invalid}] : [];
  return {value:history,issues};
}

// R3 A3 — the squad source is explicit so the cohort is selected from the
// STAGED account, not whatever S.picks holds mid-refresh. Note that `bought`
// is never read: a manual purchase-price edit cannot change the cohort.
function activeSquadIds(useManual=Boolean(globalThis.document?.getElementById?.('useManual')?.checked), account=null){
  const source = account || {manual:S.manual, picks:S.picks};
  const values = useManual ? source.manual : source.picks?.picks;
  return [...new Set((values||[]).map(item=>+(item?.id??item?.element)).filter(id=>Number.isInteger(id)&&id>0))];
}

function cohort(options={}){
  const players = options.elements || S.boot?.elements || [];
  const byId = new Map(players.map(player=>[+player.id,player]));
  const priority = activeSquadIds(options.useManual, options.account).map(id=>byId.get(id)).filter(Boolean);
  const priorityIds = new Set(priority.map(player=>+player.id));
  const research = players.filter(player=>!priorityIds.has(+player.id)).slice().sort((a,b) =>
    num(b.selected_by_percent)-num(a.selected_by_percent) || num(b.now_cost)-num(a.now_cost) || num(a.id)-num(b.id));
  return priority.concat(research.slice(0,MINUTES_RULES.detailedCohort));
}

function seasonKey(events=S.boot?.events){
  const year = +(events?.[0]?.deadline_time || '').slice(0,4);
  return Number.isFinite(year) && year > 2000 ? year + '-' + String((year+1)%100).padStart(2,'0') : 'unknown';
}

function validEnvelope(env, season=seasonKey()){
  return env && env.schemaVersion===SCHEMA_VERSION && env.modelVersion===MODEL_VERSION && env.season===season &&
    env.players && typeof env.players==='object' && !Array.isArray(env.players);
}

function completedDataRevision(events=S.boot?.events,fixtures=S.fixtures){
  const checked = (events||[]).filter(event=>event?.finished===true&&event?.data_checked===true)
    .map(event=>+event.id).filter(id=>Number.isInteger(id)&&id>0).sort((a,b)=>a-b);
  const checkedSet = new Set(checked);
  const completed = (fixtures||[]).filter(fixture=>fixture?.finished===true&&checkedSet.has(+fixture.event))
    .map(fixture=>+fixture.id).filter(id=>Number.isInteger(id)&&id>0).sort((a,b)=>a-b);
  return `checked:${checked.join(',')}|fixtures:${completed.join(',')}`;
}

function validCachedEntry(entry){
  if(!entry||entry.fetchedAt==null||!Number.isFinite(+entry.fetchedAt)||!Array.isArray(entry.history)) return null;
  const checked=validateElementSummary({history:entry.history});
  return checked.value&&checked.issues.length===0 ? {
    fetchedAt:+entry.fetchedAt,
    revision:typeof entry.revision==='string'?entry.revision:'',
    history:checked.value
  } : null;
}

function entryRevision(entry,envelope){
  return typeof entry?.revision==='string' ? entry.revision : typeof envelope?.revision==='string' ? envelope.revision : '';
}

function minuteCacheDecision(entry,envelope,{revision,now=Date.now()}={}){
  const valid=validCachedEntry(entry);
  if(!valid) return {usable:false,due:true,reason:'missing_or_invalid'};
  if(entryRevision(valid,envelope)!==revision) return {usable:true,due:true,reason:'fixture_revision'};
  if(now-valid.fetchedAt>MINUTES_RULES.cacheMaxAgeMs) return {usable:true,due:true,reason:'age_backstop'};
  return {usable:true,due:false,reason:'fresh'};
}

function minutesHealthDetail({state,oldestActiveAt=null,active=0,cached=0,requested=0,loaded=0,failed=0,deferred=0,note=''}){
  return {label:'Detailed minutes',state,oldestActiveAt,active,cached,requested,loaded,failed,deferred,note};
}

/* R3 A2/A3 — PURE. Builds history and per-player metadata as locals and
   returns them; S.minuteHistory is only ever written by the admission gate in
   applyProviderResult(). completedDataRevision and the seven-day backstop
   remain CORRECTION triggers: a validated entry stays usable when its
   correction fails (R3.2 C2). */
async function computeMinuteHistories(deps={}){
  const nowFn=deps.nowFn||Date.now, getStorage=deps.getStorage||sget;
  const fetchSummary=deps.fetchSummary||(id=>api('/element-summary/'+id+'/',{optional:true,typed:true}));
  const core=deps.core||{events:S.boot?.events,fixtures:S.fixtures,elements:S.boot?.elements,seasonLive:S.seasonLive};
  const issues=[],retryRecords=[];
  if(!core.seasonLive || !core.elements?.length){
    return {outcome:'clear',value:{},meta:{},cohortIds:[],issues,persist:null,
      healthDetail:minutesHealthDetail({state:HEALTH_STATES.DISABLED,note:'No completed Gameweek yet'}),
      summary:{loaded:0,failed:0,cached:0,requested:0,deferred:0}};
  }
  const season = core.season || seasonKey(core.events);
  const cached = await getStorage(K_MINUTES);
  const cacheOk = validEnvelope(cached, season);
  const cachedPlayers={};
  if(cacheOk) Object.entries(cached.players).forEach(([id,entry])=>{
    const valid=validCachedEntry(entry);
    if(/^\d+$/.test(id)&&valid) cachedPlayers[id]=valid;
  });
  const envelope={schemaVersion:SCHEMA_VERSION,modelVersion:MODEL_VERSION,season,
    fetchedAt:cacheOk&&cached.fetchedAt!=null&&Number.isFinite(+cached.fetchedAt)?+cached.fetchedAt:null,
    revision:cacheOk&&typeof cached.revision==='string'?cached.revision:'',players:cachedPlayers};
  const revision=completedDataRevision(core.events,core.fixtures);
  const chosen=cohort({...deps,elements:core.elements,account:deps.account});
  const cohortIds=chosen.map(player=>+player.id);
  const history={}, meta={};
  const stamp=(fetchedAt,entryRevision)=>({season,schemaVersion:SCHEMA_VERSION,modelVersion:MODEL_VERSION,
    fetchedAt,revision:entryRevision});
  const decisions=new Map();
  chosen.forEach(player=>{
    const entry=envelope.players[player.id], decision=minuteCacheDecision(entry,envelope,{revision,now:nowFn()});
    decisions.set(+player.id,decision);
    if(decision.usable){
      const valid=validCachedEntry(entry);
      history[player.id]=valid.history;
      meta[player.id]=stamp(valid.fetchedAt,entryRevision(valid,envelope));
    }
  });
  const due=chosen.filter(player=>decisions.get(+player.id).due);
  const results=[];
  let consecutiveFailedBatches=0, deferred=0;
  for(let offset=0;offset<due.length;offset+=4){
    if(consecutiveFailedBatches>=2){ deferred=due.length-offset; break; }
    const batch=due.slice(offset,offset+4);
    const batchResults=await pool(batch,async player=>{
      const response=await fetchSummary(player.id);
      const typed=response&&typeof response==='object'&&typeof response.outcome==='string';
      if(typed&&response.retryRecord) retryRecords.push(response.retryRecord);
      const payload=typed&&response.outcome==='value'?response.value:typed?null:response;
      const checked=validateElementSummary(payload);
      if(!checked.value) return {id:player.id,ok:false,issues:checked.issues,hasCache:decisions.get(+player.id).usable};
      return {id:player.id,ok:true,history:checked.value,issues:checked.issues};
    },4);
    batchResults.forEach(result=>{
      if(result?.ok){ history[result.id]=result.history; meta[result.id]=stamp(nowFn(),revision); }
    });
    results.push(...batchResults);
    if(batchResults.length===4&&batchResults.every(result=>!result?.ok)) consecutiveFailedBatches++;
    else consecutiveFailedBatches=0;
  }
  issues.push({provider:'fpl',endpoint:'/element-summary/{id}/',issues:collapseIssues(results.flatMap(r => r?.issues || []))});
  let loaded=0, failed=0;
  const players = {...envelope.players};
  results.forEach(r => {
    if(r?.ok){ loaded++; players[r.id]={fetchedAt:nowFn(),revision,history:r.history}; }
    else failed++;
  });
  const active=chosen.filter(player=>Array.isArray(history[player.id])).length;
  const allCurrent=chosen.every(player=>{
    const entry=players[player.id], decision=minuteCacheDecision(entry,{...envelope,players},{revision,now:nowFn()});
    return decision.usable&&!decision.due;
  });
  const successfulTimes=chosen.map(player=>+players[player.id]?.fetchedAt).filter(Number.isFinite);
  const oldestActiveAt=successfulTimes.length?Math.min(...successfulTimes):null;
  const nextEnvelope={...envelope,players};
  if(loaded) nextEnvelope.fetchedAt=nowFn();
  if(allCurrent) nextEnvelope.revision=revision;
  const cachedActive=Math.max(0,active-loaded);
  const state=failed||deferred||active<chosen.length||Boolean(loaded&&cachedActive) ? HEALTH_STATES.PARTIAL : loaded ? HEALTH_STATES.LIVE : HEALTH_STATES.CACHED;
  const note=deferred?'Systemic outage guard stopped further requests':failed?'Saved histories retained where valid':loaded&&cachedActive?'Fresh and cached validated histories active':'Validated histories active';
  return {outcome:'value',value:history,meta,cohortIds,issues,retryRecords,
    persist:{key:K_MINUTES,value:nextEnvelope},
    healthDetail:minutesHealthDetail({state,oldestActiveAt,active,cached:cachedActive,requested:results.length,loaded,failed,deferred,note}),
    summary:{loaded,failed,cached:cachedActive,requested:results.length,deferred}};
}

/* Thin wrapper — same applyProviderResult gate as the refresh commit. */
async function loadMinuteHistories(deps={}){
  const setStorage=deps.setStorage||sset;
  const core=deps.core||{events:S.boot?.events,fixtures:S.fixtures,elements:S.boot?.elements,
    teams:S.boot?.teams,seasonLive:S.seasonLive,season:seasonKey(S.boot?.events)};
  const token=nextProviderToken('minutes');
  const result=await computeMinuteHistories({...deps,core});
  result.signature=minutesSignature(core,completedDataRevision(core.events,core.fixtures),result.cohortIds);
  const currentCore=deps.currentCore||{events:S.boot?.events,fixtures:S.fixtures,elements:S.boot?.elements,
    teams:S.boot?.teams,seasonLive:S.seasonLive,season:seasonKey(S.boot?.events)};
  const currentUseManual=deps.currentUseManual??Boolean(globalThis.document?.getElementById?.('useManual')?.checked);
  const currentCohortIds=cohort({elements:currentCore.elements,useManual:currentUseManual,
    account:{picks:S.picks,manual:S.manual}}).map(player=>+player.id);
  const currentSignature=minutesSignature(currentCore,completedDataRevision(currentCore.events,currentCore.fixtures),currentCohortIds);
  const verdict=applyProviderResult('minutes',result,{core:currentCore,now:(deps.nowFn||Date.now)(),token,
    signature:currentSignature,cohortIds:currentCohortIds});
  if(!verdict.discarded){
    (result.issues||[]).forEach(entry=>recordIssues(entry.provider,entry.endpoint,entry.issues));
    (result.retryRecords||[]).forEach(record=>recordRetry(record));
  }
  const persist=providerPersistCandidate('minutes',result,verdict);
  if(persist) await setStorage(persist.key,persist.value);
  return result.summary;
}

export {
  validateElementSummary, activeSquadIds, cohort, seasonKey, validEnvelope,
  completedDataRevision, validCachedEntry, minuteCacheDecision, entryRevision,
  computeMinuteHistories, loadMinuteHistories
};
