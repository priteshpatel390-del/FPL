import { $, num } from './util.mjs';
import { SCHEMA_VERSION } from './config.mjs';
/* ---------------------------------------------------------------------
   STORAGE
   --------------------------------------------------------------------- */
const K_CFG = 'fpl:config', K_SQUAD = 'fpl:squad', K_CACHE = 'fpl:cache', K_CAL = 'fpl:calib',
  K_MINUTES = 'fpl:minutes-history', K_UNDERSTAT = 'fpl:understat-team-inputs', K_ODDS = 'fpl:odds-derived-inputs';

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

/* R3.1 B4 / R3.2 C7 — a separate refresh-only write surface. sset() above is
   deliberately untouched, including JSON.stringify outside every guard, so no
   existing caller's behaviour changes. The refresh persistence phase needs a
   reportable outcome instead: an unobservable failure cannot be classified as
   persist_failed. The small duplication is the price of that guarantee. */
async function ssetChecked(key, val){
  let s;
  try{ s = JSON.stringify(val); }catch(e){ return { ok:false, reason:'serialise' }; }
  if(window.storage){
    try{ await window.storage.set(key, s); return { ok:true, via:'manager' }; }catch(e){}
  }
  try{ localStorage.setItem(key, s); return { ok:true, via:'local' }; }
  catch(e){ return { ok:false, reason:'quota_or_unavailable' }; }
}

function stripDeprecatedSecrets(value){
  if(!value || typeof value !== 'object' || Array.isArray(value) ||
     !Object.prototype.hasOwnProperty.call(value, 'claudeKey'))
    return { config:value, changed:false };
  const config = { ...value };
  delete config.claudeKey;
  return { config, changed:true };
}
async function loadCfg(){
  const raw = await sget(K_CFG);
  const migrated = stripDeprecatedSecrets(raw);
  if(migrated.changed) await sset(K_CFG, migrated.config);
  return migrated.config;
}
function currentConfig(){
  const config = {
    teamId: $('teamId').value.replace(/\D/g,''),
    ft: num($('ftCount').value),
    bank: num($('bankIn').value),
    useManual: $('useManual').checked,
    useUstat: $('useUstat').checked,
    transferHorizon: Number($('trHorizon')?.value || 6),
    transferResults: Number($('trTop')?.value || 8)
  };
  const oddsKey = $('oddsKey').value.trim();
  if(oddsKey) config.oddsKey = oddsKey;
  return config;
}
async function saveCfg(){ await sset(K_CFG, currentConfig()); }

export { K_CFG, K_SQUAD, K_CACHE, K_CAL, K_MINUTES, K_UNDERSTAT, K_ODDS, sget, sset, ssetChecked, saveCfg, currentConfig, stripDeprecatedSecrets, loadCfg };

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
