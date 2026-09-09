// DATA-OPS-A1.4 — the watchdog's own environment contract.
//
// This is a fresh, narrower contract, deliberately not the A1.3 `environment-contract.mjs` one:
// the watchdog runs as a Cloudflare Worker with native bindings, not a GitHub Actions job reading
// its ambient process environment, and it needs its own dedicated GitHub credential rather than
// sharing A1.3's ephemeral Actions token (which does not exist outside a GitHub Actions run at
// all). The required GitHub permission is the same minimum A1.2/A1.3 already established:
// read-only Metadata plus Actions. No write scope of any kind is requested.
import {deepFreeze} from './canonical.mjs';

export const WATCHDOG_GITHUB_TOKEN='DATA_STEWARD_WATCHDOG_GITHUB_TOKEN';
export const WATCHDOG_D1_BINDING='STEWARD_WATCHDOG_DB';
export const WATCHDOG_EMAIL_BINDING='OWNER_NOTIFICATION_EMAIL';

export const ENVIRONMENT_RESOLVED='WATCHDOG_ENVIRONMENT_RESOLVED';
export const ENVIRONMENT_INCOMPLETE='WATCHDOG_ENVIRONMENT_INCOMPLETE';

// Resolves the three bindings a watchdog execution needs and never logs, hashes or reports any of
// their values — only which ones, by name, were missing.
export function resolveWatchdogEnvironment(env={}){
  const missing=[];
  const token=env?.[WATCHDOG_GITHUB_TOKEN];
  if(typeof token!=='string'||token==='')missing.push(WATCHDOG_GITHUB_TOKEN);
  const db=env?.[WATCHDOG_D1_BINDING];
  if(!db||typeof db.prepare!=='function')missing.push(WATCHDOG_D1_BINDING);
  const email=env?.[WATCHDOG_EMAIL_BINDING];
  if(!email||typeof email.send!=='function')missing.push(WATCHDOG_EMAIL_BINDING);
  if(missing.length)return deepFreeze({ok:false,reasonCode:ENVIRONMENT_INCOMPLETE,missing:deepFreeze(missing)});
  return Object.freeze({ok:true,reasonCode:ENVIRONMENT_RESOLVED,githubToken:token,db,email});
}
