// DATA-S2 normal production collection — protected entry point.
//
// Shared, single-attempt and fail-closed. Exactly two hardened workflows invoke it: the
// owner-dispatched manual/recovery collection and the once-daily scheduled collection. Both reach
// it through the same trust boundary and it behaves identically for both — there is no scheduled
// fast path. It masks every live identity before any request and
// performs exactly one normal collection cycle for the collection identity the dispatching
// workflow fixed once, immediately before invoking this entry point. It accepts no SQL, table,
// column, endpoint or database input: the endpoints, season, database id, schema and every
// resource ceiling are repository constants. Nothing here repairs, retries or completes a run
// whose outcome this execution could not classify.
import fs from 'node:fs';
import {maskProductionIdentity,resolveProductionIdentity} from './production-identity.mjs';
import {productionFailureClassification,runProductionCollection} from './production-collection.mjs';

const required=name=>{const value=process.env[name];if(!value)throw new Error(`missing_${name.toLowerCase()}`);return value;};

const summary=(heading,payload)=>{
  // The manual workflow gates on an owner-approved SHA; the scheduled workflow gates on the SHA
  // the scheduled event itself carried. Either way this is a sanitized report label only — the
  // collection identity is the timestamp the calling step fixed, never this value.
  const sha=process.env.APPROVED_SHA??process.env.SCHEDULED_SHA??'unknown';
  const line=`## ${heading}\n\n- Repository SHA: \`${sha}\`\n\n\`${JSON.stringify(payload)}\`\n`;
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,line);else process.stdout.write(line);
};

// A workflow re-run must never re-enter a collection whose outcome this execution could not
// classify. Another attempt is only ever a separate owner-approved dispatch, with its own
// collection identity.
if(process.env.GITHUB_RUN_ATTEMPT!=='1')throw new Error('workflow_retry_forbidden');

const {accountId,accountFingerprint,databaseId,token}=maskProductionIdentity(resolveProductionIdentity(process.env));

let result;
try{result=await runProductionCollection({accountId,accountFingerprint,databaseId,season:required('DATA_S2_SEASON'),
  token,scheduledAt:required('COLLECTION_SCHEDULED_AT'),
  transport:request=>fetch(request.url,request),fetchImpl:fetch});}
// A failed collection must still report whether it mutated production. Reporting only the throw
// would leave an unknown-mutation run looking like a no-write, which is exactly the state the
// first production run had to be reconciled out of.
catch(error){summary('DATA-S2 production collection STOPPED',productionFailureClassification(error));throw error;}
summary('DATA-S2 production collection',{result:result.result,mutation:result.mutation,changed:result.changed,
  recordsSeen:result.recordsSeen,state:result.state,population:result.population,d1:result.d1});
