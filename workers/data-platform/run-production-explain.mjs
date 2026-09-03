// DATA-S2B live production EXPLAIN QUERY PLAN acceptance — protected entry point.
//
// Manual, single-attempt, read-only and fail-closed. It masks every live identifier before any
// request, runs the acceptance helper exactly once, and writes only a bounded sanitized summary.
// Raw Cloudflare payloads are never written to disk and never uploaded as an artifact. Any
// classification other than PLAN_ACCEPTED rethrows, so the workflow fails.
import fs from 'node:fs';
import {maskProductionIdentity,resolveProductionIdentity} from './production-identity.mjs';
import {acceptProductionExplainPlans,productionExplainFailureClassification} from './explain/accept-production-plans.mjs';
import {PRODUCTION_EXPLAIN_ACCEPTED} from './explain/production-explain-contract.mjs';

const summary=(heading,payload)=>{
  const line=`## ${heading}\n\n- Repository SHA: \`${process.env.APPROVED_SHA??'unknown'}\`\n\n\`${JSON.stringify(payload)}\`\n`;
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,line);else process.stdout.write(line);
};

// A re-run must never re-issue the acceptance request against an outcome this execution could
// not classify. Another attempt is only ever a separate owner-approved dispatch.
if(process.env.GITHUB_RUN_ATTEMPT!=='1')throw new Error('workflow_retry_forbidden');

const {accountId,accountFingerprint,databaseId,token}=maskProductionIdentity(resolveProductionIdentity(process.env));

let result;
try{result=await acceptProductionExplainPlans({accountId,accountFingerprint,databaseId,token,transport:request=>fetch(request.url,request)});}
catch(error){summary('DATA-S2B live EXPLAIN acceptance STOPPED',productionExplainFailureClassification(error));throw error;}
if(result.classification!==PRODUCTION_EXPLAIN_ACCEPTED){
  summary('DATA-S2B live EXPLAIN acceptance STOPPED',{classification:result.classification});
  throw new Error('production_explain_not_accepted');
}
summary('DATA-S2B live EXPLAIN acceptance',{
  classification:result.classification,mutationIssued:result.mutationIssued,queries:result.queries,d1:result.d1
});
