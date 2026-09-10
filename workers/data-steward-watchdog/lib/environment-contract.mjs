// DATA-OPS A1.4 — the watchdog's own environment contract.
// The watchdog has two isolated D1 bindings: its own lifecycle store and a read-only use of the
// A1.3 observer-clock receipt database. Neither binding is the production Official FPL database.
import {deepFreeze} from './canonical.mjs';

export const WATCHDOG_GITHUB_TOKEN='DATA_STEWARD_WATCHDOG_GITHUB_TOKEN';
export const WATCHDOG_D1_BINDING='STEWARD_WATCHDOG_DB';
export const WATCHDOG_OBSERVER_CLOCK_D1_BINDING='STEWARD_OBSERVER_CLOCK_DB';
export const WATCHDOG_EMAIL_BINDING='OWNER_NOTIFICATION_EMAIL';

export const ENVIRONMENT_RESOLVED='WATCHDOG_ENVIRONMENT_RESOLVED';
export const ENVIRONMENT_INCOMPLETE='WATCHDOG_ENVIRONMENT_INCOMPLETE';

export function resolveWatchdogEnvironment(env={}){
  const missing=[];
  const token=env?.[WATCHDOG_GITHUB_TOKEN];
  if(typeof token!=='string'||token==='')missing.push(WATCHDOG_GITHUB_TOKEN);
  const db=env?.[WATCHDOG_D1_BINDING];
  if(!db||typeof db.prepare!=='function')missing.push(WATCHDOG_D1_BINDING);
  const clockDb=env?.[WATCHDOG_OBSERVER_CLOCK_D1_BINDING];
  if(!clockDb||typeof clockDb.prepare!=='function')missing.push(WATCHDOG_OBSERVER_CLOCK_D1_BINDING);
  const email=env?.[WATCHDOG_EMAIL_BINDING];
  if(!email||typeof email.send!=='function')missing.push(WATCHDOG_EMAIL_BINDING);
  if(missing.length)return deepFreeze({ok:false,reasonCode:ENVIRONMENT_INCOMPLETE,missing:deepFreeze(missing)});
  return Object.freeze({ok:true,reasonCode:ENVIRONMENT_RESOLVED,githubToken:token,db,clockDb,email});
}
