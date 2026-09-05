// DATA-S2B committed production run integrity — protected entry point.
//
// Manual, single-attempt, read-only and fail-closed. It masks every live identifier before any
// request, runs the verification helper exactly once, and writes only a bounded sanitized
// summary. Raw Cloudflare payloads are never written to disk and never uploaded as an artifact.
// Any classification other than COMMITTED_STATE_VALID rethrows, so the workflow fails.
//
// It collects nothing, resumes nothing, writes nothing and repairs nothing. A valid outcome is a
// statement about the state run 33948145320 already committed; it is never an authorisation to
// collect, to resume, or to re-enable the scheduler.
import fs from 'node:fs';
import {maskProductionIdentity,resolveProductionIdentity} from './production-identity.mjs';
import {committedRunIntegrityClassification,verifyCommittedProductionRun} from './integrity/verify-committed-run.mjs';
import {COMMITTED_STATE_VALID} from './integrity/committed-run-integrity-contract.mjs';

const summary=(heading,payload)=>{
  const line=`## ${heading}\n\n- Repository SHA: \`${process.env.APPROVED_SHA??'unknown'}\`\n\n\`${JSON.stringify(payload)}\`\n`;
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,line);else process.stdout.write(line);
};

// A re-run must never re-issue the read against an outcome this execution could not classify.
// Another attempt is only ever a separate owner-approved dispatch.
if(process.env.GITHUB_RUN_ATTEMPT!=='1')throw new Error('workflow_retry_forbidden');

const identity=maskProductionIdentity(resolveProductionIdentity(process.env));

let result;
try{result=await verifyCommittedProductionRun({accountId:identity.accountId,accountFingerprint:identity.accountFingerprint,
  databaseId:identity.databaseId,token:identity.token,transport:request=>fetch(request.url,request)});}
catch(error){
  summary('DATA-S2B committed run integrity STOPPED',committedRunIntegrityClassification(error));
  // The original error object is discarded so no runtime message can carry a request URL into the
  // job log. The sanitized classification above is the whole record.
  throw new Error('committed_run_integrity_stopped');
}
if(result.classification!==COMMITTED_STATE_VALID){
  summary('DATA-S2B committed run integrity STOPPED',{classification:result.classification});
  throw new Error('committed_run_integrity_not_valid');
}
summary('DATA-S2B committed run integrity',{
  classification:result.classification,mutationIssued:result.mutationIssued,
  run:result.run,integrity:result.integrity,d1:result.d1
});
