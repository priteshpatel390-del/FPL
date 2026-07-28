import { S } from './state.mjs';
import { $, num, el, setChildren } from './util.mjs';
import { api } from './providers/transport.mjs';
import { sget, sset, saveCfg, K_CFG, K_CACHE, K_CAL } from './storage.mjs';
import { slim, hydrate, recordIssues } from './state.mjs';
import { bootstrapStructure, validateEntry, validatePicks, validateHistory } from './providers/validate.mjs';
import { loadUnderstat } from './providers/understat.mjs';
import { loadOdds } from './providers/odds.mjs';
import { clearXP } from './model/xp.mjs';
import { HEALTH_STATES, healthRows, markLive, markCached, markFallback, markPartial, markUnavailable } from './providers/registry.mjs';

const HEALTH_LABELS = {fpl:'FPL', understat:'Understat', odds:'Odds', archive:'Archive'};
function ageLabel(ms){
  if(ms == null) return '';
  const mins = Math.floor(ms / 60000);
  if(mins < 1) return 'now';
  if(mins < 60) return mins + 'm ago';
  const hours = Math.floor(mins / 60);
  if(hours < 48) return hours + 'h ago';
  return Math.floor(hours / 24) + 'd ago';
}
function renderProviderHealth(){
  const setup = $('setupPanel');
  if(!setup) return;
  let box = $('providerHealth');
  if(!box){
    box = document.createElement('div'); box.id = 'providerHealth'; box.className = 'note plain';
    box.style.marginTop = '10px';
    const status = $('srcStatus');
    if(status && status.parentNode) status.parentNode.insertBefore(box, status.nextSibling);
    else setup.appendChild(box);
  }
  box.textContent = '';
  const title = document.createElement('b'); title.textContent = 'Provider health'; box.appendChild(title);
  const rows = healthRows({seasonLive:S.seasonLive});
  if(!rows.length){ box.appendChild(document.createTextNode(' — waiting for first data load.')); return; }
  rows.forEach(h => {
    const line = document.createElement('div'); line.className = 'status'; line.style.marginTop = '5px';
    const age = h.lastSuccess ? ' · ' + ageLabel(h.ageMs) : '';
    line.textContent = `${HEALTH_LABELS[h.provider] || h.provider}: ${h.state}${age}${h.consequence ? ' — ' + h.consequence : h.note ? ' — ' + h.note : ''}`;
    box.appendChild(line);
  });
}

/* ---------------------------------------------------------------------
   LOAD
   --------------------------------------------------------------------- */
async function loadAll(){
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
    Promise.all([loadUnderstat(), loadOdds()]).then(() => { clearXP(); renderProviderHealth(); renderAll(); });
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

export { loadAll, renderProviderHealth, ageLabel };
