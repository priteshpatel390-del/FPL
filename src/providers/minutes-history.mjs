import { S, recordIssues } from '../state.mjs';
import { num } from '../util.mjs';
import { MODEL_VERSION, SCHEMA_VERSION, MINUTES_RULES } from '../config.mjs';
import { api, pool } from './transport.mjs';
import { sget, sset, K_MINUTES } from '../storage.mjs';
import { getHealth, HEALTH_STATES, markLive, markPartial } from './registry.mjs';

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

function cohort(){
  const priority = new Set();
  for(const pick of S.picks?.picks || []) priority.add(+pick.element);
  for(const item of S.manual || []) priority.add(+(item.id ?? item.element));
  const players = (S.boot?.elements || []).slice().sort((a,b) => {
    const ap=priority.has(+a.id)?1:0, bp=priority.has(+b.id)?1:0;
    return bp-ap || num(b.selected_by_percent)-num(a.selected_by_percent) || num(b.now_cost)-num(a.now_cost) || num(a.id)-num(b.id);
  });
  const selected = [], seen = new Set();
  for(const p of players){
    if(priority.has(+p.id) || selected.length < priority.size + MINUTES_RULES.detailedCohort){
      if(!seen.has(+p.id)){ selected.push(p); seen.add(+p.id); }
    }
  }
  return selected;
}

function validEnvelope(env){
  return env && env.schemaVersion===SCHEMA_VERSION && env.modelVersion===MODEL_VERSION && env.players && typeof env.players==='object';
}

async function loadMinuteHistories(){
  if(!S.seasonLive || !S.boot?.elements?.length) return {loaded:0,failed:0};
  const cached = await sget(K_MINUTES);
  if(validEnvelope(cached)){
    for(const [id,entry] of Object.entries(cached.players)) if(Array.isArray(entry.history)) S.minuteHistory[id]=entry.history;
  }
  const chosen = cohort();
  const results = await pool(chosen, async p => {
    const payload = await api('/element-summary/'+p.id+'/', {optional:true});
    const v = validateElementSummary(payload);
    recordIssues('fpl', '/element-summary/', v.issues);
    if(!v.value) return {id:p.id,ok:false};
    S.minuteHistory[p.id]=v.value;
    return {id:p.id,ok:true,history:v.value};
  }, 4);
  let loaded=0, failed=0;
  const players = validEnvelope(cached) ? {...cached.players} : {};
  results.forEach(r => {
    if(r?.ok){ loaded++; players[r.id]={fetchedAt:Date.now(),history:r.history}; }
    else failed++;
  });
  await sset(K_MINUTES,{schemaVersion:SCHEMA_VERSION,modelVersion:MODEL_VERSION,fetchedAt:Date.now(),players});
  const h = getHealth('fpl',{seasonLive:S.seasonLive});
  if(h && ![HEALTH_STATES.FALLBACK,HEALTH_STATES.UNAVAILABLE].includes(h.state)){
    if(failed) markPartial('fpl', failed+' detailed player histories unavailable', 'aggregate minutes fallback used for affected players', h.lastSuccess || Date.now());
    else markLive('fpl', 'live feed + detailed player histories', 'core season and minutes data current', h.lastSuccess || Date.now());
  }
  return {loaded,failed};
}

export { validateElementSummary, cohort, loadMinuteHistories };
