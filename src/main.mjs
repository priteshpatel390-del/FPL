import { S } from './state.mjs';
import { $, num, el, setChildren } from './util.mjs';
import { api } from './providers/transport.mjs';
import { sget, sset, saveCfg, K_CACHE } from './storage.mjs';
import { slim, hydrate, recordIssues } from './state.mjs';
import { bootstrapStructure, validateEntry, validatePicks, validateHistory } from './providers/validate.mjs';
import { loadUnderstat } from './providers/understat.mjs';
import { loadOdds } from './providers/odds.mjs';
import { loadMinuteHistories } from './providers/minutes-history.mjs';
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
    return el('article',{class:'note plain'},
      el('div',{},el('b',{},HEALTH_LABELS[h.provider] || h.provider),el('span',{class:`flag ${providerHealthFlagClass(h.state)}`},h.state)),
      el('div',{class:'status'},age),
      h.note ? el('div',{},h.note) : null,
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
  try{
    reportLoadPhase(options,'fpl');
    const [boot, fixtures] = await Promise.all([api('/bootstrap-static/'), api('/fixtures/')]);
    const bs = bootstrapStructure(boot);
    const fixturesOk = Array.isArray(fixtures);
    if(!bs.ok || !fixturesOk){
      S.dataIssues = bs.issues.concat(fixturesOk ? [] :
        [{ provider:'fpl', endpoint:'/fixtures/', code:'fixtures_not_array',
           severity:'fatal', count:1, received: fixtures === null ? 'null' : typeof fixtures }]);
      const e = new Error('feed shape unusable'); e.feedShape = true; throw e;
    }
    const d = slim(boot, fixtures);
    await sset(K_CACHE, d);
    const hydrated = hydrate(d);
    if(!hydrated.ok){ const e = new Error('feed shape unusable'); e.feedShape = true; throw e; }
    const partial = hydrated.issues.some(i => i.severity === 'partial');
    if(partial) markPartial('fpl', 'some optional fields were missing', 'defaults applied; core season data remains usable', d.at);
    else markLive('fpl', S.source || 'live feed', 'core season data current', d.at);
    clearXP();

    reportLoadPhase(options,'team');
    S.teamId = $('teamId').value.replace(/\D/g,'');
    S.entry = null; S.picks = null; S.picksGameweek = 0; S.picksStatus = 'idle'; S.chipsUsed = [];
    let teamStatus = '';
    if(S.teamId){
      if(st) st.textContent = 'Fetching your team…';
      const entryV = validateEntry(await api('/entry/' + S.teamId + '/', {optional:true}));
      recordIssues('fpl', '/entry/', entryV.issues);
      S.entry = entryV.value;
      if(!S.entry){
        if(st) st.textContent = 'Season data loaded, but team ' + S.teamId + ' was not found — check the ID.';
      } else {
        const picksGW = publicPicksGameweek();
        S.picksGameweek = picksGW;
        if(picksGW){
          const picksV = validatePicks(await api('/entry/'+S.teamId+'/event/'+picksGW+'/picks/', {optional:true}));
          recordIssues('fpl', '/entry/event/picks/', picksV.issues);
          S.picks = picksV.value;
          const picksCount = Array.isArray(S.picks?.picks) ? S.picks.picks.length : 0;
          S.picksStatus = picksCount === 15 ? 'loaded' : picksCount ? 'incomplete' : 'unavailable';
          if(S.picksStatus === 'loaded') teamStatus = ` · public GW${picksGW} squad loaded`;
          else if(S.picksStatus === 'incomplete') teamStatus = ` · ${picksCount}/15 public GW${picksGW} picks usable`;
          else teamStatus = ` · public GW${picksGW} squad unavailable`;
        } else {
          S.picksStatus = 'gameweek-unavailable';
          teamStatus = ' · public squad Gameweek unavailable';
        }
        const histV = validateHistory(await api('/entry/'+S.teamId+'/history/', {optional:true}));
        recordIssues('fpl', '/entry/history/', histV.issues);
        const hist = histV.value;
        S.history = hist;
        if(hist && hist.chips) S.chipsUsed = hist.chips.map(c => `${c.name} (GW${c.event})`);
        if(S.entry.last_deadline_bank != null && !num($('bankIn').value))
          $('bankIn').value = (S.entry.last_deadline_bank/10).toFixed(1);
      }
    }
    if(S.entry || !S.teamId){
      if(st) st.textContent = `${S.boot.elements.length} players · ${S.source} · updated ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}${teamStatus}`;
    }
    await saveCfg();

    reportLoadPhase(options,'providers');
    const optionalResults = await Promise.allSettled([loadUnderstat(), loadOdds(), loadMinuteHistories()]);
    if(!getHealth('understat',{seasonLive:S.seasonLive})) markUnavailable('understat','verification did not resolve','FPL strength ratings used');
    if(!getHealth('odds',{seasonLive:S.seasonLive})) markDisabled('odds','no approved market input active','internal team model active');
    if(!getHealth('archive',{seasonLive:S.seasonLive})){
      if(S.calib) markCached('archive',null,'saved versioned calibration active','position correction active');
      else markDisabled('archive','no archive calibration active','uncalibrated model outputs shown');
    }
    reportLoadPhase(options,'model');
    renderVerifiedState();
    return {
      ok:true,
      criticalReady:true,
      source:'live',
      cacheAccepted,
      optionalResults,
      verifiedAt:Date.now()
    };
  }catch(err){
    await saveCfg();
    const shape = !!(err && err.feedShape);
    if(S.boot){
      markFallback('fpl', shape ? 'live feed shape unusable' : 'live feed unreachable', 'saved season snapshot remains active');
      if(st) st.textContent = (shape
        ? 'The season feed came back in an unexpected format — still showing saved data from '
        : 'Live feed unreachable — still showing saved data from ') +
        new Date(S.cachedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) + '.';
    } else if(shape){
      markUnavailable('fpl', 'feed shape unusable', 'season data cannot be shown');
      if(st) st.textContent = 'Season data could not be read.';
      setChildren($('ticker'),el('div',{class:'empty'},el('strong',{},"Season data isn't usable right now"),
        "The feed answered, but the data wasn't in the shape this app expects. That's a problem at the source rather than anything to do with your settings — please try again shortly."));
    } else {
      markUnavailable('fpl', 'official gateway unavailable', 'season data cannot be shown');
      if(st) st.textContent = 'Data feed unreachable.';
      setChildren($('ticker'),el('div',{class:'empty'},el('strong',{},'No connection to the FPL feed'),
        'Teamsheet could not reach its approved Official FPL gateway. Try Load data again shortly. Previously verified data will be used when available; without it, recommendations remain safely unavailable.'));
    }
    reportLoadPhase(options,'model');
    if(S.boot) renderVerifiedState();
    else {
      renderProviderHealth(); renderGlobalDataWarning();
      if(typeof document!=='undefined'&&typeof document.dispatchEvent==='function'&&typeof CustomEvent==='function')
        document.dispatchEvent(new CustomEvent('teamsheet:restricted',{detail:{reason:shape?'feed_shape':'transport_unavailable'}}));
    }
    return {
      ok:Boolean(S.boot),
      criticalReady:Boolean(S.boot),
      source:S.boot?'verified_cache':'unavailable',
      cacheAccepted:Boolean(S.boot),
      optionalResults:[],
      verifiedAt:S.boot?Date.now():null,
      error:err
    };
  }
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
  if(verifiedRefreshPromise) return verifiedRefreshPromise;
  if(!force&&!shouldRefreshVerifiedData(lastRefreshAttemptAt,nowFn())) return {ok:true,criticalReady:Boolean(S.boot),skipped:true,reason:'recently_attempted'};
  const blockInteractions=shouldBlockRefreshInteractions({reason,startup});
  verifiedRefreshPromise=(async()=>{
    if(startup) setStartupGateVisible(true);
    if(blockInteractions) setRefreshInteractionLock(true,{startup});
    setStartupPhase('cache');
    try{
      const report=await loadAll({
        awaitOptional:true,
        deferRender:true,
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
  finally{ verifiedRefreshPromise=null; }
}
function installVerifiedRefreshTriggers(){
  if(verifiedRefreshTriggersInstalled||typeof document==='undefined') return;
  verifiedRefreshTriggersInstalled=true;
  const refreshIfDue=()=>{
    if(!shouldRunForegroundRefresh(lastRefreshAttemptAt,{visibilityState:document.visibilityState})) return;
    void runVerifiedRefresh({reason:'foreground'});
  };
  document.addEventListener('visibilitychange',refreshIfDue);
  globalThis.window?.addEventListener?.('pageshow',refreshIfDue);
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
  setStartupPhase,
  setStartupGateVisible,
  dispatchVerifiedData,
  runVerifiedRefresh,
  installVerifiedRefreshTriggers,
  validGameweekId,
  publicPicksGameweek
};
