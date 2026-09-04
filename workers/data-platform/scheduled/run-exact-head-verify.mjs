// DATA-S2B Stage D — credential-free repository-gate entry point.
//
// Invoked by the scheduled collection workflow's repository gate, which holds no protected
// environment and no Cloudflare credential. It proves the exact scheduled head passed
// `Tests and deterministic build`, waiting only inside the module's fixed bound, and exits
// non-zero on every other outcome so the protected production job never starts.
import {awaitExactHeadVerify} from './exact-head-verify.mjs';

const required=name=>{const value=process.env[name];if(!value)throw new Error(`missing_${name.toLowerCase()}`);return value;};

const {classification,attempts}=await awaitExactHeadVerify({
  sha:required('SCHEDULED_SHA'),token:required('GH_TOKEN'),fetchImpl:fetch,
  sleep:ms=>new Promise(resolve=>setTimeout(resolve,ms))});

process.stdout.write(`exact-head Verify Teamsheet: ${classification} after ${attempts} read(s)\n`);
