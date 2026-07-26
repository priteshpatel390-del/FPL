import { S } from './state.mjs';
import { $, num } from './util.mjs';
import { SCHEMA_VERSION } from './config.mjs';
/* ---------------------------------------------------------------------
   STORAGE
   --------------------------------------------------------------------- */
const K_CFG = 'fpl:config', K_SQUAD = 'fpl:squad', K_CACHE = 'fpl:cache', K_CAL = 'fpl:calib';

// Inside Claude artifacts window.storage exists; hosted elsewhere (e.g. a
// home-screen web app) it doesn't, so fall back to localStorage there.
async function sget(key){
  if(window.storage){
    try{ const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; }
    catch(e){ return null; }
  }
  try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }catch(e){ return null; }
}
async function sset(key, val){
  const s = JSON.stringify(val);
  if(window.storage){ try{ await window.storage.set(key, s); return; }catch(e){} }
  try{ localStorage.setItem(key, s); }catch(e){}
}
async function saveCfg(){
  await sset(K_CFG, {
    teamId: $('teamId').value.replace(/\D/g,''),
    ft: num($('ftCount').value),
    bank: num($('bankIn').value),
    leagueId: $('leagueId').value.replace(/\D/g,''),
    useManual: $('useManual').checked,
    oddsKey: $('oddsKey').value.trim(),
    claudeKey: $('claudeKey').value.trim(),
    useUstat: $('useUstat').checked
  });
}

export { K_CFG, K_SQUAD, K_CACHE, K_CAL, sget, sset, saveCfg };

// Versioned cache envelope (season snapshots only; generic sget/sset stay raw).
export async function cachePut(key, payload, season){
  await sset(key, { schemaVersion: SCHEMA_VERSION, season, fetchedAt: Date.now(), payload });
}
export async function cacheGet(key, season){
  const env = await sget(key);
  if(!env || typeof env !== 'object') return null;
  if(env.schemaVersion !== SCHEMA_VERSION) return null;
  if(season && env.season && env.season !== season) return null;
  return env.payload ?? null;
}
