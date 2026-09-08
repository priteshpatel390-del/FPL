// DATA-OPS A1.3 — configuration contract used by the dormant read-only observer runtime.
//
// A1.2 DEFINES this contract; it does not create, rotate, upload, read from a live store or
// otherwise provision any credential, and merging it provisions nothing. No secret value appears
// in this repository's source, tests, fixtures, documentation, logs, audit records or pull request
// description, and none may ever be added.
//
// The contract is least-privilege by construction, and the permissions below are the whole of
// what the three sentinels actually issue:
//
//   GitHub          — the ephemeral GitHub Actions GITHUB_TOKEN, mapped to the established steward
//                     name, with Contents: Read, Actions: Read and Checks: Read.
//                     NO write permission of any kind: no contents write, no actions write, no
//                     workflow dispatch or re-run, no issues, no pull requests, no administration,
//                     no secrets, no token management.
//   Cloudflare      — an account-scoped API token with `Workers Scripts: Read` and `D1: Read`.
//                     NO Workers Scripts Write, no deployment, no version promotion, no Cron
//                     Trigger create/update/delete, no secrets, no routes, no D1 write.
//
// There is deliberately NO Anthropic key, NO OpenAI key and no AI credential of any kind in this
// contract: A1.2 is deterministic observation, not model reasoning, and the observation runtime
// has no code path that could use one.
//
// Two identifiers are DELIBERATELY NOT environment variables. The production D1 database id stays
// a reviewed repository constant, as the PR #215 identifier-logging remediation established, and
// the dispatcher Worker name stays a repository constant too. Neither is ever carried in a
// workflow value.
import {deepFreeze} from '../../../src/decision-intelligence/canonical.mjs';

export const ENVIRONMENT_CONTRACT_VERSION='data-ops-a1.3-environment-v1';

export const STEWARD_GITHUB_TOKEN='DATA_STEWARD_GITHUB_TOKEN';
export const STEWARD_CLOUDFLARE_ACCOUNT_ID='DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID';
export const STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT='DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT';
export const STEWARD_CLOUDFLARE_READ_TOKEN='DATA_STEWARD_CLOUDFLARE_READ_TOKEN';

// Every variable is REQUIRED. There is no optional credential and no degraded mode in which a
// sentinel is quietly skipped: a missing credential makes that sentinel's facts unprovable, and
// unprovable facts fail closed rather than being omitted from the verdict.
export const STEWARD_ENVIRONMENT=deepFreeze([
  Object.freeze({name:STEWARD_GITHUB_TOKEN,sentinel:'github',required:true,secret:true,
    purpose:'read this repository\'s main ref, Verify check runs, governed workflow runs and jobs',
    minimumPermission:'ephemeral GitHub Actions GITHUB_TOKEN: Contents Read, Actions Read, Checks Read',
    rotation:'issued automatically for one GitHub Actions job; no owner-created PAT'}),
  Object.freeze({name:STEWARD_CLOUDFLARE_ACCOUNT_ID,sentinel:'cloudflare',required:true,secret:true,
    purpose:'address the reviewed production Cloudflare account',
    minimumPermission:'identifier only, carries no authority on its own',
    rotation:'stable; changes only if the production account changes'}),
  Object.freeze({name:STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT,sentinel:'cloudflare',required:true,secret:false,
    purpose:'prove independently that the supplied account is the reviewed production account',
    minimumPermission:'SHA-256 of the account id, supplied separately so the check is not tautological',
    rotation:'derived; changes only with the account id'}),
  Object.freeze({name:STEWARD_CLOUDFLARE_READ_TOKEN,sentinel:'cloudflare,d1',required:true,secret:true,
    purpose:'read the dispatcher Worker configuration and run the fixed SELECT-only D1 observation batch',
    minimumPermission:'Cloudflare API token, account scoped: Workers Scripts Read, D1 Read',
    rotation:'owner-managed; read-only, so a lapsed token fails the observation closed and mutates nothing'})
]);

export const STEWARD_ENVIRONMENT_NAMES=deepFreeze(STEWARD_ENVIRONMENT.map(entry=>entry.name));

// Permissions this contract must never acquire. A permanent test pins the list so a later
// checkpoint cannot quietly widen A1.2 into a write credential.
export const FORBIDDEN_PERMISSIONS=deepFreeze(['contents:write','actions:write','workflows:write',
  'administration','secrets','pull_requests:write','issues:write','workers_scripts:write',
  'workers_scripts:edit','d1:write','d1:edit','account_settings:write','api_tokens:write']);

export const ENVIRONMENT_RESOLVED='ENVIRONMENT_RESOLVED';
export const ENVIRONMENT_INCOMPLETE='ENVIRONMENT_INCOMPLETE';

// Resolves the contract from a supplied environment record. It reads only the four names above,
// returns the values to the caller that needs them and NEVER logs, hashes, reports or embeds one.
// A missing or blank value is reported as the NAME that was missing — never as a partial value.
export function resolveStewardEnvironment(env={}){
  const missing=STEWARD_ENVIRONMENT_NAMES.filter(name=>{
    const value=env?.[name];
    return typeof value!=='string'||value==='';
  });
  if(missing.length)return deepFreeze({ok:false,reasonCode:ENVIRONMENT_INCOMPLETE,missing:deepFreeze(missing)});
  return Object.freeze({ok:true,reasonCode:ENVIRONMENT_RESOLVED,
    githubToken:env[STEWARD_GITHUB_TOKEN],
    cloudflareAccountId:env[STEWARD_CLOUDFLARE_ACCOUNT_ID],
    cloudflareAccountFingerprint:env[STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT],
    cloudflareReadToken:env[STEWARD_CLOUDFLARE_READ_TOKEN]});
}

// The activation requirements this checkpoint deliberately leaves outstanding. They are recorded
// as data so the documentation and the repository cannot drift apart about what is still unproven.
export const OUTSTANDING_ACTIVATION_REQUIREMENTS=deepFreeze([
  'owner creates the read-only Cloudflare API token at the stated minimum permissions',
  'owner provisions the account id, account fingerprint and Cloudflare token in data-steward-readonly',
  'first manual live read-only observation run is accepted against production GitHub, Cloudflare and D1',
  'owner separately enables DATA_STEWARD_SCHEDULED_ENABLED with exact value true'
]);
