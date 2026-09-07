// DATA-S2C — credential-free repository-gate entry point for the daily opportunity guard.
//
// Invoked by the routine collection workflows' repository gate, which holds no protected
// environment and no Cloudflare credential. It needs `actions: read` on the job's own GitHub
// token and nothing else, and it exits non-zero on every outcome except a proven unconsumed
// opportunity, so the protected production job never starts once the day is spent.
//
// Failure is sanitized deliberately: the original error object is discarded, so no request URL,
// header, token or run identifier can reach the workflow log through a runtime message. Only a
// closed classification and a closed reason are ever written.
import {AMBIGUOUS_REQUIRES_OWNER_ATTENTION,OPPORTUNITY_AVAILABLE,resolveOpportunity}
  from './opportunity-guard.mjs';

const required=name=>{const value=process.env[name];if(!value)throw new Error(`missing_${name.toLowerCase()}`);return value;};

// The asking run is identified so it can never consume its own opportunity. GitHub always
// supplies this to a workflow step; a value that is not a positive integer is treated as absent
// rather than guessed at.
const selfRunId=(()=>{
  const raw=process.env.GITHUB_RUN_ID;
  if(typeof raw!=='string'||!/^[0-9]{1,15}$/.test(raw))return null;
  const value=Number(raw);
  return Number.isSafeInteger(value)&&value>0?value:null;
})();

let outcome;
try{outcome=await resolveOpportunity({token:required('GH_TOKEN'),fetchImpl:fetch,
  now:Date.now(),selfRunId});}
catch{outcome={classification:AMBIGUOUS_REQUIRES_OWNER_ATTENTION,reason:'guard_read_failed'};}

process.stdout.write(`DATA-S2 daily collection opportunity: ${outcome.classification} (${outcome.reason})\n`);
if(outcome.classification!==OPPORTUNITY_AVAILABLE)throw new Error(outcome.classification);
