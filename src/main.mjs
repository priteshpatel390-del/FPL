import { S } from './state.mjs';
import { $, num, el, setChildren } from './util.mjs';
import { api } from './providers/transport.mjs';
import { sget, sset, saveCfg, K_CFG, K_CACHE, K_CAL } from './storage.mjs';
import { slim, hydrate, recordIssues } from './state.mjs';
import { bootstrapStructure, validateEntry, validatePicks, validateHistory } from './providers/validate.mjs';
import { loadUnderstat } from './providers/understat.mjs';
import { loadOdds } from './providers/odds.mjs';
import { loadMinuteHistories } from './providers/minutes-history.mjs';
import { clearXP } from './model/xp.mjs';
import { HEALTH_STATES, healthRows, markLive, markCached, markFallback, markPartial, markUnavailable } from './providers/registry.mjs';

const HEALTH_LABELS = {fpl:'FPL', understat:'Understat', odds:'Odds', archive:'Archive'};
const HEALTH_PRIORITY = [
  HEALTH_STATES.UNAVAILABLE,
  HEALTH_STATES.FALLBACK,
  HEALTH_STATES.PARTIAL,
  HEALTH_STATES.STALE,
  HEALTH_STATES.CACHED,
  HEALTH_STATES.DISABLED,
  HEALTH_STATES.LIVE
];
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
function providerHealthCompactModel(rows = []){
  if(!rows.length) return {
    label:'Waiting',
    state:'Waiting',
    ariaLabel:'Provider Health: waiting for first data load'
  };
  const allLive = rows.every(row => row.state === HEALTH_STATES.LIVE);
  const worst = HEALTH_PRIORITY.map(state => rows.find(row => row.state === state)).find(Boolean) || rows[0];
  const detail = rows.map(row => `${HEALTH_LABELS[row.provider] || row.provider} ${row.state}`).join(', ');
  return {
    label:allLive ? 'All live' : worst.state,
    state:allLive ? HEALTH_STATES.LIVE : worst.state,
    ariaLabel:`Provider Health: ${detail}. Open full detail.`
  };
}
function renderProviderHealth(){
  const compact = $('providerHealthCompact');
  const detail = $('providerHealthRows');
  const rows = healthRows({seasonLive:S.seasonLive});
  const compactModel = providerHealthCompactModel(rows);

  if(compact){
    setChildren(compact,
      document.createTextNode('Data '),
      el('span',{class:`flag ${providerHealthFlagClass(compactModel.state)}`},compactModel.label));
    compact.setAttribute('aria-label',compactModel.ariaLabel);
    compact.dataset.healthState = String(compactModel.state).toLowerCase();
  }

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

async function loadAll(options = {}){
  const st = $('status');
  const cached = await sget(K_CACHE);
  if(cached && !S.boot){
    if(hydrate(cached).ok){
      markCached('fpl', cached.at, 'saved season snapshot', 'refreshing live feed');
      st.textContent = 'Showing saved data from ' + new Date(cached.at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) + ' — refreshing…';
      renderProviderHealth(); renderAll();
    } else {
      st.textContent = 'Your saved copy of the season data could not be read — fetching a fresh one…';
    }
  } else {
    st.textContent = 'Fetching season data…';
  }
  try{
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

    S.teamId = $('teamId').value.replace(/\D/g,'');
    S.entry = null; S.picks = null; S.chipsUsed = [];
    if(S.teamId){
      st.textContent = 'Fetching your team…';
      const entryV = validateEntry(await api('/entry/' + S.teamId + '/', {optional:true}));
      recordIssues('fpl', '/entry/', entryV.issues);
      S.entry = entryV.value;
      if(!S.entry){
        st.textContent = 'Season data loaded, but team ' + S.teamId + ' was not found — check the ID.';
      } else {
        if(S.currentGW){
          const picksV = validatePicks(await api('/entry/'+S.teamId+'/event/'+S.currentGW+'/picks/', {optional:true}));
          recordIssues('fpl', '/entry/event/picks/', picksV.issues);
          S.picks = picksV.value;
        }
        const histV = validateHistory(await api('/entry/'+S.teamId+'/history/', {optional:true}));
        recordIssues('fpl', '/entry/history/', histV.issues);
        const hist = histV.value;
        if(hist && hist.chips) S.chipsUsed = hist.chips.map(c => `${c.name} (GW${c.event})`);
        if(S.entry.last_deadline_bank != null && !num($('bankIn').value))
          $('bankIn').value = (S.entry.last_deadline_bank/10).toFixed(1);
      }
    }
    if(S.entry || !S.teamId)
      st.textContent = `${S.boot.elements.length} players · ${S.source} · updated ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`;
    await saveCfg();
    renderProviderHealth(); renderAll();
    const optionalLoads = Promise.allSettled([loadUnderstat(), loadOdds(), loadMinuteHistories()]).then(() => { clearXP(); renderProviderHealth(); renderAll(); });
    if(options.awaitOptional) await optionalLoads;
  }catch(err){
    await saveCfg();
    const shape = !!(err && err.feedShape);
    if(S.boot){
      markFallback('fpl', shape ? 'live feed shape unusable' : 'live feed unreachable', 'saved season snapshot remains active');
      st.textContent = (shape
        ? 'The season feed came back in an unexpected format — still showing saved data from '
        : 'Live feed unreachable — still showing saved data from ') +
        new Date(S.cachedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) + '.';
    } else if(shape){
      markUnavailable('fpl', 'feed shape unusable', 'season data cannot be shown');
      st.textContent = 'Season data could not be read.';
      setChildren($('ticker'),el('div',{class:'empty'},el('strong',{},"Season data isn't usable right now"),
        "The feed answered, but the data wasn't in the shape this app expects. That's a problem at the source rather than anything to do with your settings — please try again shortly."));
    } else {
      markUnavailable('fpl', 'all transports failed', 'season data cannot be shown');
      st.textContent = 'Data feed unreachable.';
      setChildren($('ticker'),el('div',{class:'empty'},el('strong',{},'No connection to the FPL feed'),
        'Every public relay refused or timed out. Try again shortly, or open the file in a normal browser tab rather than an in-app preview. The Ask tab still works — it searches the web instead.'));
    }
    renderProviderHealth();
  }
}

export { loadAll, renderProviderHealth, ageLabel, providerHealthFlagClass, providerHealthCompactModel };
