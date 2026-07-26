import { S } from './state.mjs';
import { $, num } from './util.mjs';
import { api } from './providers/transport.mjs';
import { sget, sset, saveCfg, K_CFG, K_CACHE, K_CAL } from './storage.mjs';
import { slim, hydrate } from './state.mjs';
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
    hydrate(cached);
    st.textContent = 'Showing saved data from ' + new Date(cached.at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) + ' — refreshing…';
    renderAll();
  } else {
    st.textContent = 'Fetching season data…';
  }
  try{
    const [boot, fixtures] = await Promise.all([api('/bootstrap-static/'), api('/fixtures/')]);
    const d = slim(boot, fixtures);
    await sset(K_CACHE, d);
    hydrate(d);
    clearXP();

    S.teamId = $('teamId').value.replace(/\D/g,'');
    S.entry = null; S.picks = null; S.chipsUsed = [];
    if(S.teamId){
      st.textContent = 'Fetching your team…';
      S.entry = await api('/entry/' + S.teamId + '/', {optional:true});
      if(!S.entry){
        st.textContent = 'Season data loaded, but team ' + S.teamId + ' was not found — check the ID.';
      } else {
        if(S.currentGW){
          S.picks = await api('/entry/'+S.teamId+'/event/'+S.currentGW+'/picks/', {optional:true});
        }
        const hist = await api('/entry/'+S.teamId+'/history/', {optional:true});
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
    if(S.boot){
      st.textContent = 'Live feed unreachable — still showing saved data from ' +
        new Date(S.cachedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) + '.';
    } else {
      st.textContent = 'Data feed unreachable.';
      $('ticker').innerHTML = `<div class="empty"><strong>No connection to the FPL feed</strong>
        Every public relay refused or timed out. Try again shortly, or open the file in a normal browser tab rather than an in-app preview. The Ask tab still works — it searches the web instead.</div>`;
    }
  }
}

export { loadAll };
