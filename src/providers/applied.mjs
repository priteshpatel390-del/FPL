import { S } from '../state.mjs';
import { MODEL_VERSION, SCHEMA_VERSION, SUPPORTING_REFRESH_RULES } from '../config.mjs';
import { HEALTH_STATES, markLive, markCached, markFallback, markPartial, markDisabled, markUnavailable, setHealthDetail } from './registry.mjs';
/* ---------------------------------------------------------------------
   APPLIED PROVIDER STATE — the single gate through which every supporting
   provider result reaches S.

   Two rules, deliberately independent (R3.3 D1):

     Rule A — the computation signature. Identifies the inputs an in-flight
     computation ran against. It decides whether a RETURNED RESULT may be
     applied, and nothing else.

     Rule B — existing-value compatibility. Decides whether the value already
     live in S stays active. Expressed in R1's own predicates: a fixture,
     event or cohort revision makes a value DUE for correction, never
     unusable. Only provenance and R1's age bounds remove a value.

   Both the refresh commit and the direct provider wrappers call
   applyProviderResult(), so the two paths cannot diverge (R3.4 E6).
   --------------------------------------------------------------------- */

const VERSIONS = `${SCHEMA_VERSION}|${MODEL_VERSION}`;

/* ---- Odds key epoch -------------------------------------------------
   An opaque in-memory counter, never a hash. A hash of a low-entropy key is
   recoverable, so it would still be key-derived material sitting in a
   signature. This carries none, is never persisted, and never reaches
   diagnostics, Provider Health, evidence or exports. */
let oddsKeyEpoch = 0;
let lastSeenOddsKey = '';
function currentOddsKeyEpoch(key = ''){
  const value = String(key ?? '');
  if(value !== lastSeenOddsKey){ lastSeenOddsKey = value; oddsKeyEpoch++; }
  return oddsKeyEpoch;
}
function resetOddsKeyEpoch(){ oddsKeyEpoch = 0; lastSeenOddsKey = ''; }

/* ---- Rule A · signature components --------------------------------- */
function teamIdentity(teams = []){
  // Names as well as ids: mapTeamName() matches Understat and Odds club names
  // against team.name, so a rename must invalidate a computation.
  return (teams || []).map(t => `${t.id}:${t.name}`).sort().join(',');
}
function finishedFixtureRevision(fixtures = []){
  return (fixtures || []).filter(f => f?.finished === true).map(f => +f.id)
    .filter(id => Number.isInteger(id) && id > 0).sort((a, b) => a - b).join(',');
}
function oddsFixtureRevision(fixtures = []){
  // Associations, not bare timestamps: two fixtures swapping kickoffs must not
  // produce an identical signature while every hId|aId mapping is wrong.
  return (fixtures || []).filter(f => f?.finished !== true)
    .map(f => `${f.id}:${f.team_h}:${f.team_a}:${Date.parse(f.kickoff_time || '') || 0}`)
    .sort().join(',');
}
function oddsEventRevision(events = []){
  return (events || []).filter(e => e?.finished !== true)
    .map(e => `${e.id}:${Date.parse(e.deadline_time || '') || 0}`)
    .sort().join(',');
}
function understatSignature(core, config){
  return `u|${core?.season}|${VERSIONS}|${teamIdentity(core?.teams)}|${finishedFixtureRevision(core?.fixtures)}|${config?.useUstat ? 1 : 0}`;
}
function oddsSignature(core, config){
  return `o|${core?.season}|${VERSIONS}|${teamIdentity(core?.teams)}|${oddsFixtureRevision(core?.fixtures)}|${oddsEventRevision(core?.events)}|${currentOddsKeyEpoch(config?.oddsKey || '')}`;
}
function minutesSignature(core, completedRevision, cohortIds = []){
  // Cohort ids and order only. teamId, useManual and the manual squad reach
  // this signature solely through the cohort they produce, and a manual
  // purchase-price edit changes no id and no position (R3.3 D5).
  return `m|${core?.season}|${VERSIONS}|${completedRevision}|${(cohortIds || []).join(',')}`;
}

/* ---- Shared validated-map shapes ------------------------------------
   Moved here so Rule B can reach them without importing a provider module.
   Both are pure over (value, teams) and validate against the COMMITTED core. */
function validUnderstatMap(value, teams){
  if(!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const map = {};
  for(const [id, row] of Object.entries(value)){
    const teamId = +id;
    if(!Number.isInteger(teamId) || !teams?.some(team => +team.id === teamId) || !row || typeof row !== 'object' ||
       !['xg','xga','atk','def'].every(key => Number.isFinite(+row[key]) && +row[key] > 0)) return null;
    map[teamId] = {xg:+row.xg, xga:+row.xga, atk:+row.atk, def:+row.def};
  }
  return Object.keys(map).length ? map : null;
}
function validOddsMap(value, teams){
  if(!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const map = {};
  for(const [pair, row] of Object.entries(value)){
    if(!/^\d+\|\d+$/.test(pair) || !row || typeof row !== 'object' ||
       !Number.isInteger(+row.hId) || +row.hId <= 0 || !Number.isInteger(+row.aId) || +row.aId <= 0 ||
       pair !== `${+row.hId}|${+row.aId}` ||
       !teams?.some(team => +team.id === +row.hId) || !teams?.some(team => +team.id === +row.aId) ||
       !Number.isFinite(+row.xGH) || +row.xGH <= 0 || !Number.isFinite(+row.xGA) || +row.xGA <= 0) return null;
    map[pair] = {hId:+row.hId, aId:+row.aId, xGH:+row.xGH, xGA:+row.xGA,
      kickoff:Number.isFinite(+row.kickoff) ? +row.kickoff : null,
      providerEventId:typeof row.providerEventId === 'string' ? row.providerEventId.slice(0,120) : Number.isFinite(+row.providerEventId) ? +row.providerEventId : null,
      fetchedAt:row.fetchedAt != null && Number.isFinite(+row.fetchedAt) ? +row.fetchedAt : null,
      booksUsed:Math.max(0, Math.trunc(+row.booksUsed || 0)), marketCount:Math.max(0, Math.trunc(+row.marketCount || 0)),
      staleDropped:Math.max(0, Math.trunc(+row.staleDropped || 0)), confidence:row.confidence === 'low' ? 'low' : 'normal'};
  }
  return map;
}

/* ---- Rule B · existing-value compatibility --------------------------
   Provenance is read from the IN-MEMORY applied record, never from persisted
   storage: the commit is synchronous so it cannot await, and after a
   persist_failed memory holds the newer and authoritative generation. */
function provenanceMatches(applied, core){
  return Boolean(applied) && applied.season === core?.season &&
    applied.schemaVersion === SCHEMA_VERSION && applied.modelVersion === MODEL_VERSION;
}
function understatCompatible(applied, value, core, now = Date.now()){
  if(!provenanceMatches(applied, core)) return false;
  if(!validUnderstatMap(value, core?.teams)) return false;
  const fetchedAt = +applied.fetchedAt;
  return Number.isFinite(fetchedAt) && now - fetchedAt <= SUPPORTING_REFRESH_RULES.understat.maxAgeMs;
}
function oddsCompatible(applied, value, core, now = Date.now()){
  if(!provenanceMatches(applied, core)) return false;
  if(!validOddsMap(value, core?.teams)) return false;
  const fetchedAt = +applied.fetchedAt;
  return Number.isFinite(fetchedAt) && now - fetchedAt <= SUPPORTING_REFRESH_RULES.odds.maxUsableAgeMs;
}
/* Per-player, and deliberately without an age bound: R1 treats the seven-day
   backstop as a correction trigger, so an old entry stays active when its
   correction fails. Provenance is the only thing that removes an entry. */
function minuteEntryCompatible(meta, core, cohortIds, playerId){
  if(!provenanceMatches(meta, core)) return false;
  const id = +playerId;
  if(!Number.isInteger(id) || id <= 0) return false;
  if(!core?.elements?.some(element => +element.id === id)) return false;
  return (cohortIds || []).some(cohortId => +cohortId === id);
}

/* ---- Tokens and bounded recomputation ------------------------------- */
const providerToken = {understat:0, odds:0, minutes:0};
function nextProviderToken(name){ return ++providerToken[name]; }
function currentProviderToken(name){ return providerToken[name]; }

const pendingRecomputation = new Set();
function queueRecomputation(name){ pendingRecomputation.add(name); }
function drainRecomputation(){
  const names = [...pendingRecomputation];
  pendingRecomputation.clear();
  return names;
}
function resetProviderTokens(){
  providerToken.understat = 0; providerToken.odds = 0; providerToken.minutes = 0;
  pendingRecomputation.clear();
}

function applyHealthMark(name, mark){
  if(!mark) return;
  const {kind, note = '', consequence = '', lastSuccess = null} = mark;
  if(kind === 'live') markLive(name, note, consequence, lastSuccess ?? Date.now());
  else if(kind === 'cached') markCached(name, lastSuccess, note, consequence);
  else if(kind === 'partial') markPartial(name, note, consequence, lastSuccess ?? Date.now());
  else if(kind === 'fallback') markFallback(name, note, consequence);
  else if(kind === 'disabled') markDisabled(name, note, consequence);
  else if(kind === 'unavailable') markUnavailable(name, note, consequence);
}

const RETAIN_NOTES = Object.freeze({
  understat:{note:'Saved team form active · refresh unavailable', consequence:'rolling team xG active'},
  odds:{note:'Saved market inputs active · refresh unavailable', consequence:'cached market layer active'}
});
const CLEAR_NOTES = Object.freeze({
  understat:{note:'saved team form is no longer compatible', consequence:'FPL strength ratings used'},
  odds:{note:'saved market inputs are no longer compatible', consequence:'internal team model active'}
});

/* ---------------------------------------------------------------------
   THE SHARED GATE.

   Synchronous. Called from inside the refresh commit and from the direct
   provider wrappers, so both paths resolve identically. Every slice lands in
   exactly one of REPLACE, RETAIN or CLEAR — there is no fourth state and no
   partially written slice.

   An immediate recomputation is queued ONLY when the result was discarded
   because it ran against inputs the commit superseded, i.e. current inputs
   were never attempted. A current-input failure or a cooldown must not
   requeue, or a failing provider would spin against its own cooldown. The
   requeued computation runs against current inputs by construction, so it
   cannot mismatch again within the same cycle: at most one requeue per
   provider per apply cycle (R3.3 D3, R3.4 E6).
   --------------------------------------------------------------------- */
function applyProviderResult(name, result, ctx = {}){
  const {core, now = Date.now(), token = null, signature = null, cohortIds = []} = ctx;
  if(!result || result.outcome === 'skip') return {state:'unchanged', queued:false};

  const tokenStale = token != null && token !== currentProviderToken(name);
  if(tokenStale){
    if(!ctx.resolveOnDiscard)
      return {state:'unchanged', queued:false, reason:'token_stale', discarded:true};
    const retained = applySliceRetain(name, {core, now, cohortIds});
    if(!retained) applySliceClear(name, result, {disabled:false});
    return {state:retained?'retain':'clear', queued:false, reason:'token_stale', discarded:true};
  }

  if(result.outcome === 'clear'){
    applySliceClear(name, result, {disabled:true});
    return {state:'clear', queued:false, reason:'disabled'};
  }

  const signatureMismatch = signature != null && result.signature != null && result.signature !== signature;
  if(result.outcome === 'value' && !signatureMismatch){
    if((name === 'understat' || name === 'odds') && olderThanActive(name, result, {core, now})){
      applySliceRetain(name, {core, now, cohortIds});
      return {state:'retain', queued:false, reason:'older_candidate', discarded:true};
    }
    const applied = applySliceReplace(name, result, {core, cohortIds});
    return {state:applied?.state || 'replace', queued:false,
      reason:applied?.reason || null, discarded:Boolean(applied?.discarded)};
  }

  // Discarded or failed: does the value already live in S survive Rule B?
  const retained = applySliceRetain(name, {core, now, cohortIds});
  const queued = signatureMismatch;
  if(queued) queueRecomputation(name);
  if(retained) return {state:'retain', queued, reason:signatureMismatch ? 'signature_mismatch' : result.reason || 'computation_failed', discarded:signatureMismatch};
  applySliceClear(name, result, {disabled:false});
  return {state:'clear', queued, reason:signatureMismatch?'signature_mismatch':'incompatible_or_expired', discarded:signatureMismatch};
}

function olderThanActive(name, result, {core, now}){
  const applied=S.providerApplied?.[name];
  const compatible=name==='understat'
    ? understatCompatible(applied,S.ustat,core,now)
    : oddsCompatible(applied,S.odds,core,now);
  if(!compatible) return false;
  const candidate=+result.fetchedAt, active=+applied?.fetchedAt;
  return Number.isFinite(active)&&(!Number.isFinite(candidate)||candidate<active);
}

function applySliceReplace(name, result, {core, cohortIds}){
  if(name === 'understat'){
    S.ustat = result.value;
    S.ustatNote = result.note || '';
    S.providerApplied = {...S.providerApplied, understat:result.value ? {
      signature:result.signature, season:core?.season, schemaVersion:SCHEMA_VERSION,
      modelVersion:MODEL_VERSION, fetchedAt:result.fetchedAt
    } : null};
    applyHealthMark('understat', result.healthMark);
    return {state:'replace'};
  }
  if(name === 'odds'){
    S.odds = result.value;
    S.oddsNote = result.note || '';
    S.providerApplied = {...S.providerApplied, odds:result.value ? {
      signature:result.signature, season:core?.season, schemaVersion:SCHEMA_VERSION,
      modelVersion:MODEL_VERSION, fetchedAt:result.fetchedAt
    } : null};
    applyHealthMark('odds', result.healthMark);
    return {state:'replace'};
  }
  // Minutes: the admission gate. A history enters S.minuteHistory only when its
  // metadata matches the committed season/schema/model, the player exists and
  // the player is in the captured cohort. There is no second way in.
  const history = {}, meta = {}, cohortSet = cohortIds || [];
  let acceptedCandidate=false, retainedNewer=false;
  const ids=new Set([...Object.keys(result.value||{}),...Object.keys(S.minuteHistory||{})]);
  ids.forEach(id=>{
    const candidateMeta=result.meta?.[id], activeMeta=S.minuteHistoryMeta?.[id];
    const candidateOk=minuteEntryCompatible(candidateMeta,core,cohortSet,id)&&Array.isArray(result.value?.[id]);
    const activeOk=minuteEntryCompatible(activeMeta,core,cohortSet,id)&&Array.isArray(S.minuteHistory?.[id]);
    if(activeOk&&(!candidateOk||+activeMeta.fetchedAt>+candidateMeta.fetchedAt)){
      history[id]=S.minuteHistory[id]; meta[id]=activeMeta; retainedNewer=true; return;
    }
    if(candidateOk){ history[id]=result.value[id]; meta[id]=candidateMeta; acceptedCandidate=true; }
  });
  S.minuteHistory = history;
  S.minuteHistoryMeta = meta;
  if(result.healthDetail){
    const times=Object.values(meta).map(item=>+item.fetchedAt).filter(Number.isFinite);
    const detail=retainedNewer?{...result.healthDetail,
      state:acceptedCandidate?HEALTH_STATES.PARTIAL:HEALTH_STATES.CACHED,
      oldestActiveAt:times.length?Math.min(...times):null,active:Object.keys(history).length,
      note:acceptedCandidate?'Fresh and newer in-memory histories active':'Newer in-memory histories retained'}:result.healthDetail;
    setHealthDetail('fpl',detail);
  }
  return acceptedCandidate ? {state:'replace'}
    : retainedNewer ? {state:'retain',reason:'older_candidate',discarded:true}
    : {state:'replace'};
}

function applySliceRetain(name, {core, now, cohortIds}){
  if(name === 'understat'){
    if(!understatCompatible(S.providerApplied?.understat, S.ustat, core, now)) return false;
    applyHealthMark('understat', {kind:'cached', lastSuccess:+S.providerApplied.understat.fetchedAt, ...RETAIN_NOTES.understat});
    return true;
  }
  if(name === 'odds'){
    if(!oddsCompatible(S.providerApplied?.odds, S.odds, core, now)) return false;
    applyHealthMark('odds', {kind:'cached', lastSuccess:+S.providerApplied.odds.fetchedAt, ...RETAIN_NOTES.odds});
    return true;
  }
  const history = {}, meta = {};
  Object.keys(S.minuteHistory || {}).forEach(id => {
    if(!minuteEntryCompatible(S.minuteHistoryMeta?.[id], core, cohortIds, id)) return;
    history[id] = S.minuteHistory[id];
    meta[id] = S.minuteHistoryMeta[id];
  });
  S.minuteHistory = history;
  S.minuteHistoryMeta = meta;
  return Object.keys(history).length > 0;
}

function applySliceClear(name, result, {disabled}){
  if(name === 'understat'){
    S.ustat = null;
    S.ustatNote = disabled ? '' : (result?.note || 'Understat unavailable — using FPL strength ratings only.');
    S.providerApplied = {...S.providerApplied, understat:null};
    applyHealthMark('understat', disabled ? (result?.healthMark || {kind:'disabled', note:'turned off in settings', consequence:'FPL strength ratings used'})
      : {kind:'fallback', ...CLEAR_NOTES.understat});
    return;
  }
  if(name === 'odds'){
    S.odds = null;
    S.oddsNote = disabled ? '' : (result?.note || 'No compatible validated market inputs are active.');
    S.providerApplied = {...S.providerApplied, odds:null};
    applyHealthMark('odds', disabled ? (result?.healthMark || {kind:'disabled', note:'no API key supplied', consequence:'internal team model active'})
      : {kind:'fallback', ...CLEAR_NOTES.odds});
    return;
  }
  S.minuteHistory = {};
  S.minuteHistoryMeta = {};
  if(result?.healthDetail) setHealthDetail('fpl', result.healthDetail);
}

/* A persistence candidate is derived only after the application gate has
   resolved the result. Discarded work never writes. A current-input failure
   may still persist its R1 cooldown, but it is merged with newer compatible
   in-memory data so storage cannot be downgraded after an earlier write
   failure. */
function providerPersistCandidate(name,result,verdict){
  if(!result?.persist||verdict?.discarded) return null;
  const entry=result.persist, value=entry.value;
  if(!value||typeof value!=='object') return entry;
  if(name==='understat'){
    const applied=S.providerApplied?.understat;
    if(applied&&S.ustat&&+applied.fetchedAt>+(value.fetchedAt??-Infinity))
      return {key:entry.key,value:{...value,season:applied.season,schemaVersion:applied.schemaVersion,
        modelVersion:applied.modelVersion,fetchedAt:+applied.fetchedAt,teams:S.ustat}};
    return entry;
  }
  if(name==='odds'){
    const applied=S.providerApplied?.odds;
    if(applied&&S.odds&&+applied.fetchedAt>+(value.fetchedAt??-Infinity))
      return {key:entry.key,value:{...value,season:applied.season,schemaVersion:applied.schemaVersion,
        modelVersion:applied.modelVersion,fetchedAt:+applied.fetchedAt,derived:S.odds}};
    return entry;
  }
  const players={...(value.players||{})};
  Object.keys(S.minuteHistory||{}).forEach(id=>{
    const meta=S.minuteHistoryMeta?.[id], stored=players[id];
    if(meta&&Array.isArray(S.minuteHistory[id])&&+meta.fetchedAt>+(stored?.fetchedAt??-Infinity))
      players[id]={fetchedAt:+meta.fetchedAt,revision:meta.revision||'',history:S.minuteHistory[id]};
  });
  const times=Object.values(players).map(item=>+item?.fetchedAt).filter(Number.isFinite);
  return {key:entry.key,value:{...value,fetchedAt:times.length?Math.max(...times):value.fetchedAt,players}};
}

export {
  VERSIONS, currentOddsKeyEpoch, resetOddsKeyEpoch, teamIdentity, finishedFixtureRevision,
  oddsFixtureRevision, oddsEventRevision, understatSignature, oddsSignature, minutesSignature,
  validUnderstatMap, validOddsMap, provenanceMatches, understatCompatible, oddsCompatible,
  minuteEntryCompatible, nextProviderToken, currentProviderToken, queueRecomputation,
  drainRecomputation, resetProviderTokens, applyHealthMark, applyProviderResult,
  providerPersistCandidate, HEALTH_STATES
};
