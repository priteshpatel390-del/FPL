import { S } from './state.mjs';
import { $, num } from './util.mjs';
import { api } from './providers/transport.mjs';
import { sget, sset, saveCfg, K_CFG, K_CACHE, K_CAL } from './storage.mjs';
import { slim, hydrate, recordIssues } from './state.mjs';
import { bootstrapStructure, validateEntry, validatePicks, validateHistory } from './providers/validate.mjs';
import { loadUnderstat } from './providers/understat.mjs';
import { loadOdds } from './providers/odds.mjs';
import { clearXP } from './model/xp.mjs';
/* ---------------------------------------------------------------------
   LOAD
   --------------------------------------------------------------------- */
async function loadAll(){
  const st = $('status');
  const cached = await sget(K_CACHE);
  if(cached && !S.boot){
    // D-14: the cached snapshot goes through exactly the same validation as a
    // fresh one. An unreadable cache is discarded, not rendered.
    if(hydrate(cached).ok){
      st.textContent = 'Showing saved data from ' + new Date(cached.at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) + ' — refreshing…';
      renderAll();
    } else {
      st.textContent = 'Your saved copy of the season data could not be read — fetching a fresh one…';
    }
  } else {
    st.textContent = 'Fetching season data…';
  }
  try{
    const [boot, fixtures] = await Promise.all([api('/bootstrap-static/'), api('/fixtures/')]);
    // D-14: structural guard BEFORE slim(). slim() maps the four collections
    // and would throw on a malformed payload, and a payload this broken must
    // never reach the cache. Row-level filtering deliberately happens later in
    // hydrate(), so the cached snapshot stays raw-shaped for provenance (D-13).
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
    if(!hydrate(d).ok){ const e = new Error('feed shape unusable'); e.feedShape = true; throw e; }
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
    renderAll();
    // external layers arrive after first paint, then re-render
    Promise.all([loadUnderstat(), loadOdds()]).then(() => { clearXP(); renderAll(); });
  }catch(err){
    await saveCfg();   // never lose typed settings just because the feed failed
    const shape = !!(err && err.feedShape);
    if(S.boot){
      st.textContent = (shape
        ? 'The season feed came back in an unexpected format — still showing saved data from '
        : 'Live feed unreachable — still showing saved data from ') +
        new Date(S.cachedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) + '.';
    } else if(shape){
      st.textContent = 'Season data could not be read.';
      $('ticker').innerHTML = `<div class="empty"><strong>Season data isn't usable right now</strong>
        The feed answered, but the data wasn't in the shape this app expects. That's a problem at the source rather than anything to do with your settings — please try again shortly.</div>`;
    } else {
      st.textContent = 'Data feed unreachable.';
      $('ticker').innerHTML = `<div class="empty"><strong>No connection to the FPL feed</strong>
        Every public relay refused or timed out. Try again shortly, or open the file in a normal browser tab rather than an in-app preview. The Ask tab still works — it searches the web instead.</div>`;
    }
  }
}

export { loadAll };
