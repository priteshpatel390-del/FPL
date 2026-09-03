// DATA-S2B first production run reconciliation — protected entry point.
//
// Manual, single-attempt, read-only and fail-closed. It masks every live identifier before any
// request, runs the reconciliation helper exactly once, and writes only a bounded sanitized
// summary. Raw Cloudflare payloads are never written to disk and never uploaded as an artifact.
// Any classification other than RESUME_RECONCILIATION_SAFE rethrows, so the workflow fails.
//
// It resumes nothing, writes nothing and repairs nothing. A SAFE outcome is a precondition for a
// separately approved single resume attempt, never an authorisation to perform one.
import fs from 'node:fs';
import {maskProductionIdentity,resolveProductionIdentity} from './production-identity.mjs';
import {firstRunReconciliationClassification,reconcileFirstProductionRun} from './resume/reconcile-first-production-run.mjs';
import {RESUME_RECONCILIATION_SAFE} from './resume/first-run-reconciliation-contract.mjs';

const summary=(heading,payload)=>{
  const line=`## ${heading}\n\n- Repository SHA: \`${process.env.APPROVED_SHA??'unknown'}\`\n\n\`${JSON.stringify(payload)}\`\n`;
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,line);else process.stdout.write(line);
};

// A re-run must never re-issue the reconciliation read against an outcome this execution could
// not classify. Another attempt is only ever a separate owner-approved dispatch.
if(process.env.GITHUB_RUN_ATTEMPT!=='1')throw new Error('workflow_retry_forbidden');

const identity=maskProductionIdentity(resolveProductionIdentity(process.env));

let result;
try{result=await reconcileFirstProductionRun({accountId:identity.accountId,accountFingerprint:identity.accountFingerprint,
  databaseId:identity.databaseId,token:identity.token,transport:request=>fetch(request.url,request)});}
catch(error){summary('DATA-S2B first-run reconciliation STOPPED',firstRunReconciliationClassification(error));throw error;}
if(result.classification!==RESUME_RECONCILIATION_SAFE){
  summary('DATA-S2B first-run reconciliation STOPPED',{classification:result.classification});
  throw new Error('first_run_reconciliation_not_safe');
}
summary('DATA-S2B first-run reconciliation',{
  classification:result.classification,mutationIssued:result.mutationIssued,resumed:result.resumed,
  run:result.run,integrity:result.integrity,d1:result.d1
});
