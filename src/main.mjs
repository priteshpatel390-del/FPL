import { S } from './state.mjs';
import { $, num, el, setChildren } from './util.mjs';
import { api } from './providers/transport.mjs';
import { sget, sset, ssetChecked, saveCfg, currentConfig, K_CACHE } from './storage.mjs';
import { slim, hydrate, prepareCore, assignCore, populatePositionFilter, recordIssues, recordRetry,
  captureStateJournal, restoreStateJournal } from './state.mjs';
import { bootstrapStructure, validateEntry, validatePicks, validateHistory } from './providers/validate.mjs';
import { computeUnderstat, loadUnderstat, understatSeasonKey } from './providers/understat.mjs';
import { computeOdds, loadOdds } from './providers/odds.mjs';
import { computeMinuteHistories, loadMinuteHistories, completedDataRevision } from './providers/minutes-history.mjs';
import { understatSignature, oddsSignature, minutesSignature, nextProviderToken, applyProviderResult,
  drainRecomputation, providerPersistCandidate, snapshotPendingRecomputation, restorePendingRecomputation } from './providers/applied.mjs';
import { snapshotHealth, restoreHealth } from './providers/registry.mjs';
import { clearXP } from './model/xp.mjs';
import { HEALTH_STATES, healthRows, getHealth, markLive, markCached, markFallback, markPartial, markDisabled, markUnavailable } from './providers/registry.mjs';
import { renderGlobalDataWarning } from './ui/data-warning.mjs';

const HEALTH_LABELS = {fpl:'FPL', understat:'Understat', odds:'Odds', archive:'Archive'};
const VERIFIED_REFRESH_MIN_AGE_MS = 10 * 60 * 1000;
const STARTUP_PHASE_COPY = Object.freeze({
  cache:['Loading verified data','Preparing the last accepted dataset as a safe fallback.'],
  fpl:['Checking official FPL','Validating players, teams, fixtures and the current deadline.'],
  team:['Checking your team','Validating the latest available squad and chip context.'],
  providers:['Checking supporting sources','Resolving every approved provider to a verified state.'],
  model:['Updating decisions','Recalculating projections and recommendations as one consistent dataset.'],
  evidence:['Securing deadline evidence','Saving an eligible pre-deadline record automatically when required.'],
  ready:['Ready','Latest verified data available.'],
  restricted:['Limited mode','Official FPL data could not be verified, so recommendations remain unavailable.']
});
function validGameweekId(value){
  const id = Number(value);
  return Number.isInteger(id) && id >= 1 && id <= 38 ? id : 0;
}
function publicPicksGameweek(events = S.boot?.events, currentGW = S.currentGW){
  const current = validGameweekId(currentGW);
  if(current) return current;
  const next = Array.isArray(events) ? events.find(event => event?.is_next === true) : null;
  return validGameweekId(next?.id);
}

let verifiedRefreshPromise = null;
let lastVerifiedRefreshAt = 0;
let lastRefreshAttemptAt = 0;
let verifiedRefreshTriggersInstalled = false;

function browserReportsOffline(navigatorRef=globalThis.navigator){
  return navigatorRef?.onLine === false;
}
function ageLabel(ms){
  if(ms == null) return '';
  const mins = Math.floor(ms / 60000);
  if(mins < 1) return 'now';
  if(mins < 60) return mins + 'm ago';
  const hours = Math.floor(mins / 60);
  if(hours < 48) return hours + 'h ago';
  return Math.floor(hours / 24) + 'd ago';
}
function providerHealthFlagClass(state){
  if(state === HEALTH_STATES.LIVE) return 'rise';
  if(state === HEALTH_STATES.CACHED || state === HEALTH_STATES.STALE || state === HEALTH_STATES.PARTIAL) return 'doubt';
  if(state === HEALTH_STATES.FALLBACK || state === HEALTH_STATES.UNAVAILABLE) return 'out';
  return 'dark';
}
function renderProviderHealth(){
  const detail = $('providerHealthRows');
  const rows = healthRows({seasonLive:S.seasonLive});

  if(!detail) return;
  if(!rows.length){
    setChildren(detail,el('div',{class:'note plain'},el('b',{},'Waiting for first data load.'),' Provider states will appear here as each source answers or falls back.'));
    return;
  }

  setChildren(detail,rows.map(h => {
    const age = h.lastSuccess ? `Last successful ${ageLabel(h.ageMs)}` : 'No successful response this session';
    const minuteDetail=h.provider==='fpl'?h.detail:null;
    const minuteAge=minuteDetail?.oldestActiveAt ? ageLabel(Math.max(0,Date.now()-minuteDetail.oldestActiveAt)) : '';
    return el('article',{class:'note plain'},
      el('div',{},el('b',{},HEALTH_LABELS[h.provider] || h.provider),el('span',{class:`flag ${providerHealthFlagClass(h.state)}`},h.state)),
      el('div',{class:'status'},age),
      h.note ? el('div',{},h.note) : null,
      minuteDetail ? el('div',{class:'status'},`${minuteDetail.label || 'Detailed minutes'}: ${minuteDetail.state}${minuteAge?' · oldest active '+minuteAge:''} · ${minuteDetail.active} validated player histories active${minuteDetail.cached?' · '+minuteDetail.cached+' from cache':''}${minuteDetail.deferred?' · '+minuteDetail.deferred+' requests deferred':''}. ${minuteDetail.note}`) : null,
      h.consequence ? el('div',{class:'status'},`Impact: ${h.consequence}`) : null);
  }));
}

function reportLoadPhase(options,key){
  const copy=STARTUP_PHASE_COPY[key]||[key,''];
  if(typeof options.onPhase==='function') options.onPhase({key,title:copy[0],detail:copy[1]});
}
function renderVerifiedState(){
  clearXP();
  renderProviderHealth();
  renderGlobalDataWarning();
  renderAll();
}

/* ---------------------------------------------------------------------
   ATOMIC FOREGROUND REFRESH

   collect  → PURE. Fetches, validates and derives into a staged object.
              Writes nothing to S, the health registry or diagnostics.
   commit   → SYNCHRONOUS, no-throw, no-reentrant. Plain assignments only.
              Because it contains no suspension point and S carries no
              accessor property, no observer can see it part-way, so the app
              stays interactive during a foreground refresh.
   render   → once, after the commit.
   persist  → after the render, never before the commit.
   --------------------------------------------------------------------- */

let lifecycleEpoch = 0;
let commitInProgress = false;
let pendingRefreshRequest = null;

function captureRefreshInputs(){
  const config = typeof document === 'undefined' ? {} : currentConfig();
  return {
    teamId:String(config.teamId || ''),
    useUstat:Boolean(config.useUstat),
    useManual:Boolean(config.useManual),
    oddsKey:String(config.oddsKey || ''),
    manualIds:(S.manual||[]).map(item=>+item.id).filter(id=>Number.isInteger(id)&&id>0),
    lifecycleEpoch
  };
}

function refreshInputsAreCurrent(inputs){
  const current=captureRefreshInputs();
  return inputs.teamId===current.teamId&&inputs.useUstat===current.useUstat&&
    inputs.useManual===current.useManual&&inputs.oddsKey===current.oddsKey&&
    inputs.manualIds.join(',')===current.manualIds.join(',');
}

/* R3.4 E5/E7 — account compatibility keys. Every key carries teamId and
   season, so no combination can mix teams or seasons; picks additionally pins
   the Gameweek so last week's squad can never present as current. */
function accountKey(kind, {teamId, season, picksGameweek}){
  return kind === 'picks'
    ? `picks|${teamId}|${picksGameweek}|${season}|${SCHEMA_VERSION_TAG}`
    : `${kind}|${teamId}|${season}|${SCHEMA_VERSION_TAG}`;
}
const SCHEMA_VERSION_TAG = 'v1';

function resolveAccountSlice(kind, staged, previous, keys){
  // value → replace · notfound → clear (authoritative) · failed → carry when
  // the compatibility key matches, otherwise clear.
  if(staged.outcome === 'value') return {state:'replace', value:staged.value};
  if(staged.outcome === 'notfound') return {state:'clear', value:null};
  const compatible = previous.key && keys[kind] && previous.key === keys[kind];
  return compatible ? {state:'carry', value:previous.value} : {state:'clear', value:null};
}

async function collectAccount(teamId, core, options={}){
  const blank = {entry:{outcome:'skip'}, picks:{outcome:'skip'}, history:{outcome:'skip'}, picksGameweek:0, issues:[], retryRecords:[]};
  if(!teamId) return blank;
  const issues = [], retryRecords = [];
  const take = response => { if(response?.retryRecord) retryRecords.push(response.retryRecord); return response; };
  const apiFn=options.apiFn||api;
  const entryRaw = take(await apiFn('/entry/' + teamId + '/', {optional:true, typed:true}));
  let entry = {outcome:entryRaw.outcome, value:null};
  if(entryRaw.outcome === 'value'){
    const checked = validateEntry(entryRaw.value);
    issues.push({provider:'fpl', endpoint:'/entry/', issues:checked.issues});
    entry = {outcome:checked.value ? 'value' : 'failed', value:checked.value, partial:checked.issues.some(i => i.severity === 'partial')};
  }
  if(entry.outcome === 'notfound') return {...blank, entry, issues, retryRecords};
  const picksGameweek = publicPicksGameweek(core.events, core.currentGW);
  let picks = {outcome:'notfound', value:null};
  if(picksGameweek){
    const picksRaw = take(await apiFn('/entry/' + teamId + '/event/' + picksGameweek + '/picks/', {optional:true, typed:true}));
    if(picksRaw.outcome === 'value'){
      const checked = validatePicks(picksRaw.value);
      issues.push({provider:'fpl', endpoint:'/entry/event/picks/', issues:checked.issues});
      picks = {outcome:checked.value ? 'value' : 'failed', value:checked.value, partial:checked.issues.some(i => i.severity === 'partial')};
    } else picks = {outcome:picksRaw.outcome, value:null};
  }
  const historyRaw = take(await apiFn('/entry/' + teamId + '/history/', {optional:true, typed:true}));
  let history = {outcome:historyRaw.outcome, value:null};
  if(historyRaw.outcome === 'value'){
    const checked = validateHistory(historyRaw.value);
    issues.push({provider:'fpl', endpoint:'/entry/history/', issues:checked.issues});
    history = {outcome:checked.value ? 'value' : 'failed', value:checked.value, partial:checked.issues.some(i => i.severity === 'partial')};
  }
  return {entry, picks, history, picksGameweek, issues, retryRecords};
}

function stagedAccountContext(inputs,core,account){
  if(!inputs.teamId) return {picks:null,manual:inputs.manualIds.map(id=>({id}))};
  const previousKeys=S.__accountKeys||{},keys={
    entry:accountKey('entry',{teamId:inputs.teamId,season:core.season}),
    picks:accountKey('picks',{teamId:inputs.teamId,season:core.season,picksGameweek:account.picksGameweek}),
    history:accountKey('history',{teamId:inputs.teamId,season:core.season})
  };
  const entry=resolveAccountSlice('entry',account.entry,{key:previousKeys.entry,value:S.entry},keys);
  const picks=entry.state==='clear'?{state:'clear',value:null}:
    resolveAccountSlice('picks',account.picks,{key:previousKeys.picks,value:S.picks},keys);
  return {picks:picks.value,manual:inputs.manualIds.map(id=>({id}))};
}

function picksStatusFor(state, picks, picksGameweek){
  if(state === 'clear') return picksGameweek ? 'unavailable' : 'gameweek-unavailable';
  const count = Array.isArray(picks?.picks) ? picks.picks.length : 0;
  return count === 15 ? 'loaded' : count ? 'incomplete' : 'unavailable';
}

/* R3.3 D7 / R3.4 E7 — aggregate FPL health. Live requires a clean core AND,
   when account data was requested, a clean replacement of every slice.
   Partiality is monotonic: nothing upgrades a partial finding. */
function aggregateFplHealth({corePartial, requested, slices, source, at}){
  const anyNotReplaced = requested && slices.some(slice => slice.state !== 'replace');
  const anyPartial = requested && slices.some(slice => slice.partial);
  if(corePartial || anyNotReplaced || anyPartial){
    markPartial('fpl', corePartial ? 'some optional fields were missing' : 'account data is incomplete',
      corePartial ? 'defaults applied; core season data remains usable' : 'core season data current; squad detail may be older', at);
    return 'Partial';
  }
  markLive('fpl', source || 'live feed', 'core season data current', at);
  return 'Live';
}

async function collectRefresh(options = {}){
  const inputs = options.inputs || captureRefreshInputs();
  const apiFn=options.apiFn||api;
  reportLoadPhase(options, 'fpl');
  if(browserReportsOffline()){
    const error=new Error('device offline');
    error.offline=true;
    throw error;
  }
  const [bootRaw, fixturesRaw] = await Promise.all([
    apiFn('/bootstrap-static/', {typed:true}), apiFn('/fixtures/', {typed:true})
  ]);
  const retryRecords = [bootRaw.retryRecord, fixturesRaw.retryRecord].filter(Boolean);
  if(bootRaw.outcome !== 'value' || fixturesRaw.outcome !== 'value')
    throw new Error('feed unreachable: /bootstrap-static/');
  const boot = bootRaw.value, fixtures = fixturesRaw.value;
  const bs = bootstrapStructure(boot);
  const fixturesOk = Array.isArray(fixtures);
  if(!bs.ok || !fixturesOk){
    const e = new Error('feed shape unusable');
    e.feedShape = true;
    e.issues = bs.issues.concat(fixturesOk ? [] :
      [{ provider:'fpl', endpoint:'/fixtures/', code:'fixtures_not_array',
         severity:'fatal', count:1, received: fixtures === null ? 'null' : typeof fixtures }]);
    throw e;
  }
  const slimmed = slim(boot, fixtures);
  const prepared = prepareCore(slimmed);
  if(!prepared.ok){ const e = new Error('feed shape unusable'); e.feedShape = true; e.issues = prepared.issues; throw e; }
  const core = prepared.core;

  reportLoadPhase(options, 'team');
  const account = await collectAccount(inputs.teamId, core, options);

  reportLoadPhase(options, 'providers');
  const stagedAccount=stagedAccountContext(inputs,core,account);
  const providerConfig = {useUstat:inputs.useUstat, oddsKey:inputs.oddsKey, useManual:inputs.useManual};
  const providerCore = {...core, seasonLive:core.seasonLive};
  const providerTokens={understat:nextProviderToken('understat'),odds:nextProviderToken('odds'),minutes:nextProviderToken('minutes')};
  const [understat, odds, minutes] = await Promise.all([
    computeUnderstat({...options.understatDeps,core:providerCore, config:providerConfig, force:Boolean(options.forceSupporting)}).catch(() => ({outcome:'fallback', reason:'threw', issues:[], retryRecords:[], persist:null})),
    computeOdds({...options.oddsDeps,core:providerCore, config:providerConfig, force:Boolean(options.forceSupporting)}).catch(() => ({outcome:'fallback', reason:'threw', issues:[], retryRecords:[], persist:null})),
    computeMinuteHistories({...options.minutesDeps,core:providerCore, account:stagedAccount, useManual:inputs.useManual}).catch(() => ({outcome:'fallback', reason:'threw', issues:[], retryRecords:[], cohortIds:[], persist:null}))
  ]);
  understat.signature = understatSignature(providerCore, providerConfig);
  odds.signature = oddsSignature(providerCore, providerConfig);
  minutes.signature = minutesSignature(providerCore, completedDataRevision(core.events, core.fixtures), minutes.cohortIds || []);

  return {
    inputs, core, slimmed, account, understat, odds, minutes, providerTokens,
    corePartial:prepared.issues.some(i => i.severity === 'partial'),
    coreIssues:prepared.issues, retryRecords, source:bootRaw.source || S.source || 'live feed'
  };
}

/* SYNCHRONOUS. No await, no dynamic import, no dispatchEvent, no DOM call,
   no storage call. Assignments only, from already-validated plain data. */
function applyRefreshCommit(staged, {now = Date.now()} = {}){
  if(commitInProgress) return {ok:false, reason:'reentrant'};
  commitInProgress = true;
  const journal = {state:captureStateJournal(), health:snapshotHealth(),
    recomputation:snapshotPendingRecomputation()};
  try{
    const {core, account, inputs} = staged;
    const season = core.season;
    const previousKeys = S.__accountKeys || {};
    const keys = {
      entry:accountKey('entry', {teamId:inputs.teamId, season}),
      picks:accountKey('picks', {teamId:inputs.teamId, season, picksGameweek:account.picksGameweek}),
      history:accountKey('history', {teamId:inputs.teamId, season})
    };
    // 1 · core
    assignCore(core, staged.coreIssues.slice());
    S.source = staged.source;
    S.teamId = inputs.teamId;
    // 2 · account — entry is the root: when it clears, every dependant clears.
    const entryRes = inputs.teamId
      ? resolveAccountSlice('entry', account.entry, {key:previousKeys.entry, value:S.entry}, keys)
      : {state:'clear', value:null};
    let picksRes, historyRes;
    if(entryRes.state === 'clear'){
      picksRes = {state:'clear', value:null};
      historyRes = {state:'clear', value:null};
    }else{
      picksRes = resolveAccountSlice('picks', account.picks, {key:previousKeys.picks, value:S.picks}, keys);
      historyRes = resolveAccountSlice('history', account.history, {key:previousKeys.history, value:S.history}, keys);
    }
    S.entry = entryRes.value;
    S.picks = picksRes.value;
    S.history = historyRes.value;
    S.picksGameweek = account.picksGameweek;
    S.picksStatus = inputs.teamId ? picksStatusFor(picksRes.state, picksRes.value, account.picksGameweek) : 'idle';
    S.chipsUsed = historyRes.value?.chips ? historyRes.value.chips.map(c => `${c.name} (GW${c.event})`) : [];
    S.__accountKeys = {
      entry:entryRes.state === 'clear' ? null : keys.entry,
      picks:picksRes.state === 'clear' ? null : keys.picks,
      history:historyRes.state === 'clear' ? null : keys.history
    };
    // 3 · provider health and supporting slices, through the shared gate
    const requested = Boolean(inputs.teamId);
    const fplState = aggregateFplHealth({
      corePartial:staged.corePartial, requested,
      slices:[{state:entryRes.state, partial:account.entry.partial},
              {state:picksRes.state, partial:account.picks.partial},
              {state:historyRes.state, partial:account.history.partial}],
      source:staged.source, at:core.cachedAt
    });
    const applyCtx = {core, now, resolveOnDiscard:true};
    const providerVerdicts={
      understat:applyProviderResult('understat', staged.understat, {...applyCtx, token:staged.providerTokens?.understat,
        signature:understatSignature(core, {useUstat:inputs.useUstat, oddsKey:inputs.oddsKey})}),
      odds:applyProviderResult('odds', staged.odds, {...applyCtx, token:staged.providerTokens?.odds,
        signature:oddsSignature(core, {useUstat:inputs.useUstat, oddsKey:inputs.oddsKey})}),
      minutes:applyProviderResult('minutes', staged.minutes, {...applyCtx, token:staged.providerTokens?.minutes,
        cohortIds:staged.minutes.cohortIds || [],
        signature:minutesSignature(core, completedDataRevision(core.events, core.fixtures), staged.minutes.cohortIds || [])})
    };
    // 4 · diagnostics from current work only
    const applicable=name=>!providerVerdicts[name]?.discarded;
    const retryStats = {...S.retryStats};
    [...staged.retryRecords, ...(account.retryRecords || []),
     ...(applicable('understat')?staged.understat.retryRecords || []:[]),
     ...(applicable('odds')?staged.odds.retryRecords || []:[]),
     ...(applicable('minutes')?staged.minutes.retryRecords || []:[])]
      .filter(record => record && record.provider)
      .forEach(record => { retryStats[record.provider + '|' + record.endpoint] = record; });
    S.retryStats = retryStats;
    [...account.issues, ...(applicable('understat')?staged.understat.issues || []:[]),
     ...(applicable('odds')?staged.odds.issues || []:[]),
     ...(applicable('minutes')?staged.minutes.issues || []:[])]
      .forEach(entry => recordIssues(entry.provider, entry.endpoint, entry.issues));
    const providerWrites=Object.entries(providerVerdicts).map(([name,verdict])=>
      providerPersistCandidate(name,staged[name],verdict)).filter(Boolean);
    // 5 · derived invalidation
    clearXP();
    return {ok:true, fplState, providerVerdicts, providerWrites};
  }catch(error){
    restoreStateJournal(journal.state);
    restoreHealth(journal.health);
    restorePendingRecomputation(journal.recomputation);
    return {ok:false, reason:'commit_failed', error};
  }finally{
    commitInProgress = false;
  }
}

async function persistRefresh(staged, committed={}){
  const writes = [{key:K_CACHE, value:staged.slimmed}];
  (committed.providerWrites||[]).forEach(entry => writes.push(entry));
  const failures = [];
  for(const write of writes){
    const result = await ssetChecked(write.key, write.value);
    if(!result.ok) failures.push({key:write.key, reason:result.reason});
  }
  return failures;
}

async function loadAll(options = {}){
  const st = $('status');
  const deferRender = Boolean(options.deferRender);
  const renderIntermediate = () => { if(!deferRender){ renderProviderHealth(); renderGlobalDataWarning(); renderAll(); } };
  reportLoadPhase(options,'cache');
  const cached = await sget(K_CACHE);
  let cacheAccepted = false;
  if(cached && !S.boot){
    if(hydrate(cached).ok){
      cacheAccepted = true;
      markCached('fpl', cached.at, 'saved season snapshot', 'refreshing live feed');
      if(st) st.textContent = 'Showing saved data from ' + new Date(cached.at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) + ' — refreshing…';
      renderIntermediate();
    } else if(st) {
      st.textContent = 'Your saved copy of the season data could not be read — fetching a fresh one…';
    }
  } else if(st) {
    st.textContent = 'Fetching season data…';
  }
  const inputs = options.inputs || captureRefreshInputs();
  let staged;
  try{
    staged = await collectRefresh({...options, inputs});
  }catch(err){
    return reportCollectionFailure(err, st, cacheAccepted);
  }
  /* R3 A1 — work that crossed a persisted Safari/BFCache restoration is
     discarded in full, core included, and recollected immediately. A
     restoration invalidates time itself for staged data, not one input. */
  if(staged.inputs.lifecycleEpoch !== lifecycleEpoch){
    pendingRefreshRequest = {reason:options.reason || 'foreground', force:true};
    return {ok:Boolean(S.boot), criticalReady:Boolean(S.boot), source:'discarded_lifecycle',
      cacheAccepted, optionalResults:[], verifiedAt:null, discarded:'lifecycle'};
  }
  if(!refreshInputsAreCurrent(staged.inputs)){
    pendingRefreshRequest = {reason:options.reason || 'foreground', force:true};
    return {ok:Boolean(S.boot), criticalReady:Boolean(S.boot), source:'discarded_inputs',
      cacheAccepted, optionalResults:[], verifiedAt:null, discarded:'inputs'};
  }
  reportLoadPhase(options,'model');
  const committed = applyRefreshCommit(staged);
  if(!committed.ok){
    if(st) st.textContent = 'Could not apply the update — showing the previous verified data.';
    return {ok:Boolean(S.boot), criticalReady:Boolean(S.boot), source:'commit_failed',
      cacheAccepted, optionalResults:[], verifiedAt:null, errorClass:'commit_failed', error:committed.error};
  }
  let renderError = null;
  try{
    populatePositionFilter(staged.core.element_types);
    if(st) st.textContent = statusLine(staged, committed);
    renderVerifiedState();
  }catch(error){ renderError = error; if(st) st.textContent = 'Data updated but the display failed to refresh.'; }
  const persistFailures = await persistRefresh(staged, committed);
  await saveCfg();
  for(const name of drainRecomputation()) void recomputeProvider(name);
  return {
    ok:true, criticalReady:true, source:'live', cacheAccepted,
    optionalResults:[staged.understat, staged.odds, staged.minutes],
    verifiedAt:Date.now(), fplState:committed.fplState,
    errorClass:renderError ? 'render_failed' : persistFailures.length ? 'persist_failed' : null,
    persistFailures
  };
}

function statusLine(staged, committed){
  const teamStatus = !staged.inputs.teamId ? ''
    : S.picksStatus === 'loaded' ? ` · public GW${S.picksGameweek} squad loaded`
    : S.picksStatus === 'incomplete' ? ` · ${S.picks?.picks?.length || 0}/15 public GW${S.picksGameweek} picks usable`
    : S.picksStatus === 'gameweek-unavailable' ? ' · public squad Gameweek unavailable'
    : ` · public GW${S.picksGameweek} squad unavailable`;
  return `${S.boot.elements.length} players · ${S.source} · updated ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}${teamStatus}`;
}

/* A signature-mismatch discard means current inputs were never attempted, so
   exactly one immediate recomputation is warranted. It runs against current
   inputs by construction and therefore cannot mismatch again this cycle. */
async function recomputeProvider(name){
  if(name === 'understat') return loadUnderstat({force:false});
  if(name === 'odds') return loadOdds({force:false});
  if(name === 'minutes') return loadMinuteHistories();
}

function reportCollectionFailure(err, st, cacheAccepted){
  const shape = !!(err && err.feedShape);
  const offline = !!(err && err.offline);
  if(err && err.issues) S.dataIssues = err.issues;
  if(S.boot){
    markFallback('fpl', shape ? 'live feed shape unusable' : offline ? 'device is offline' : 'live feed unreachable', 'saved season snapshot remains active');
    if(st) st.textContent = (shape
      ? 'The season feed came back in an unexpected format — still showing saved data from '
      : offline ? 'Offline — still showing saved data from '
      : 'Live feed unreachable — still showing saved data from ') +
      new Date(S.cachedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) + '.';
  } else if(shape){
    markUnavailable('fpl', 'feed shape unusable', 'season data cannot be shown');
    if(st) st.textContent = 'Season data could not be read.';
    setChildren($('ticker'),el('div',{class:'empty'},el('strong',{},"Season data isn't usable right now"),
      "The feed answered, but the data wasn't in the shape this app expects. That's a problem at the source rather than anything to do with your settings — please try again shortly."));
  } else {
    markUnavailable('fpl', offline ? 'device is offline' : 'official gateway unavailable', 'season data cannot be shown');
    if(st) st.textContent = offline ? 'Teamsheet is offline and no verified season data is available.' : 'Data feed unreachable.';
    setChildren($('ticker'),el('div',{class:'empty'},el('strong',{},'No connection to the FPL feed'),
      offline
        ? 'Reconnect to the internet, then try Load data again. Without a verified saved snapshot, recommendations remain safely unavailable.'
        : 'Teamsheet could not reach its approved Official FPL gateway. Try Load data again shortly. Previously verified data will be used when available; without it, recommendations remain safely unavailable.'));
  }
  if(S.boot){ try{ renderVerifiedState(); }catch(error){} }
  else {
    renderProviderHealth(); renderGlobalDataWarning();
    if(typeof document!=='undefined'&&typeof document.dispatchEvent==='function'&&typeof CustomEvent==='function')
      document.dispatchEvent(new CustomEvent('teamsheet:restricted',{detail:{reason:shape?'feed_shape':'transport_unavailable'}}));
  }
  return {
    ok:Boolean(S.boot), criticalReady:Boolean(S.boot),
    source:S.boot?'verified_cache':'unavailable', cacheAccepted:Boolean(S.boot),
    optionalResults:[], verifiedAt:S.boot?Date.now():null, errorClass:'collection_failed', error:err
  };
}

function shouldRefreshVerifiedData(lastVerifiedAt,now=Date.now(),minAgeMs=VERIFIED_REFRESH_MIN_AGE_MS){
  return !Number.isFinite(Number(lastVerifiedAt)) || now-Number(lastVerifiedAt)>=minAgeMs;
}
function shouldBlockRefreshInteractions({reason='manual',startup=false}={}){
  return Boolean(startup||reason==='manual');
}
function shouldRunForegroundRefresh(lastAttemptAt,{visibilityState='visible',now=Date.now()}={}){
  if(visibilityState&&visibilityState!=='visible') return false;
  return shouldRefreshVerifiedData(lastAttemptAt,now);
}
function setStartupPhase(key){
  return STARTUP_PHASE_COPY[key]||STARTUP_PHASE_COPY.cache;
}
function setStartupGateVisible(visible){
  if(typeof document==='undefined') return;
  const gate=$('startupGate');
  if(gate) gate.hidden=!visible;
  document.body?.classList?.toggle('startup-pending',visible);
  document.body?.setAttribute?.('aria-busy',visible?'true':'false');
}
function setRefreshInteractionLock(locked,{startup=false}={}){
  if(typeof document==='undefined') return;
  document.body?.classList?.toggle('data-refreshing',locked);
  const main=document.querySelector?.('main');
  const nav=document.querySelector?.('nav.tabs');
  if(!startup){
    if(main) main.inert=locked;
    if(nav) nav.inert=locked;
  }
}
async function dispatchVerifiedData(detail){
  if(typeof document==='undefined'||typeof document.dispatchEvent!=='function'||typeof CustomEvent!=='function') return [];
  const pending=[];
  const eventDetail={...detail,waitUntil(promise){ pending.push(Promise.resolve(promise)); }};
  document.dispatchEvent(new CustomEvent('teamsheet:data-verified',{detail:eventDetail}));
  return Promise.allSettled(pending);
}
async function runVerifiedRefresh({reason='manual',startup=false,force=false,nowFn=Date.now}={}){
  /* R3 A5 — an explicit manual refresh during an in-flight foreground refresh
     is QUEUED, not silently downgraded to the weaker run already in progress.
     Paired Safari resume events still coalesce on the line below. */
  if(reason==='manual'&&verifiedRefreshPromise) pendingRefreshRequest={reason:'manual',startup:false,force:true};
  if(verifiedRefreshPromise) return verifiedRefreshPromise;
  if(!force&&!shouldRefreshVerifiedData(lastRefreshAttemptAt,nowFn())) return {ok:true,criticalReady:Boolean(S.boot),skipped:true,reason:'recently_attempted'};
  const refreshInputs=captureRefreshInputs();
  const blockInteractions=shouldBlockRefreshInteractions({reason,startup});
  verifiedRefreshPromise=(async()=>{
    if(startup) setStartupGateVisible(true);
    if(blockInteractions) setRefreshInteractionLock(true,{startup});
    setStartupPhase('cache');
    try{
      const report=await loadAll({
        awaitOptional:true,
        deferRender:true,
        inputs:refreshInputs,
        reason,
        forceSupporting:reason==='manual',
        onPhase:phase=>setStartupPhase(phase.key)
      });
      if(report.criticalReady){
        lastVerifiedRefreshAt=nowFn();
        document.body?.classList?.remove('data-restricted');
        void dispatchVerifiedData({reason,verifiedAt:lastVerifiedRefreshAt,source:report.source});
      }else{
        setStartupPhase('restricted');
        document.body?.classList?.add('data-restricted');
      }
      return report;
    }finally{
      lastRefreshAttemptAt=nowFn();
      if(blockInteractions) setRefreshInteractionLock(false,{startup});
      if(startup){
        setStartupGateVisible(false);
        if(typeof document!=='undefined'&&typeof document.dispatchEvent==='function'&&typeof CustomEvent==='function')
          document.dispatchEvent(new CustomEvent('teamsheet:startup-ready'));
      }
    }
  })();
  try{ return await verifiedRefreshPromise; }
  finally{
    verifiedRefreshPromise=null;
    /* R3 A5 / A1 — a queued manual request, or work discarded by a persisted
       restoration, runs immediately and bypasses the ten-minute cooldown. */
    const queued=pendingRefreshRequest; pendingRefreshRequest=null;
    if(queued) void runVerifiedRefresh({...queued,nowFn});
  }
}
function installVerifiedRefreshTriggers(){
  if(verifiedRefreshTriggersInstalled||typeof document==='undefined') return;
  verifiedRefreshTriggersInstalled=true;
  const refreshIfDue=()=>{
    if(!shouldRunForegroundRefresh(lastRefreshAttemptAt,{visibilityState:document.visibilityState})) return;
    void runVerifiedRefresh({reason:'foreground'});
  };
  document.addEventListener('visibilitychange',refreshIfDue);
  /* R3 A1 — a persisted restoration advances the page-lifecycle epoch, so any
     collection that crossed the suspension is discarded before commit. */
  globalThis.window?.addEventListener?.('pageshow',event=>{
    if(event&&event.persisted) lifecycleEpoch++;
    refreshIfDue();
  });
}

export {
  loadAll,
  renderProviderHealth,
  ageLabel,
  providerHealthFlagClass,
  VERIFIED_REFRESH_MIN_AGE_MS,
  STARTUP_PHASE_COPY,
  shouldRefreshVerifiedData,
  shouldBlockRefreshInteractions,
  shouldRunForegroundRefresh,
  browserReportsOffline,
  setStartupPhase,
  setStartupGateVisible,
  dispatchVerifiedData,
  runVerifiedRefresh,
  installVerifiedRefreshTriggers,
  captureRefreshInputs,
  refreshInputsAreCurrent,
  collectRefresh,
  collectAccount,
  stagedAccountContext,
  applyRefreshCommit,
  persistRefresh,
  resolveAccountSlice,
  accountKey,
  aggregateFplHealth,
  picksStatusFor,
  recomputeProvider,
  reportCollectionFailure,
  statusLine,
  validGameweekId,
  publicPicksGameweek
};
