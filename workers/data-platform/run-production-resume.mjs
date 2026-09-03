// DATA-S2 first production run resume — protected entry point.
//
// Manual, single-attempt and fail-closed. It masks every live identity before any request and
// continues only the deterministic first run: its immutable identity and `started_at` come from
// repository constants, never from a workflow input. The runtime proves the unresolved run is
// exactly the untouched start-ledger row by a fixed read-only reconciliation, in this same
// execution and before any mutation, and stops otherwise. Nothing here repairs, retries or
// completes a run the reconciliation could not classify.
import fs from 'node:fs';
import {maskProductionIdentity,resolveProductionIdentity} from './production-identity.mjs';
import {FIRST_PRODUCTION_RUN_SCHEDULED_AT,PRODUCTION_SEASON,productionFailureClassification,runProductionCollection} from './production-collection.mjs';

const summary=(heading,payload)=>{
  const line=`## ${heading}\n\n- Repository SHA: \`${process.env.APPROVED_SHA??'unknown'}\`\n\n\`${JSON.stringify(payload)}\`\n`;
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,line);else process.stdout.write(line);
};

// A workflow re-run must never re-enter a resume whose outcome this execution could not
// classify. Another attempt is only ever a separate owner-approved dispatch.
if(process.env.GITHUB_RUN_ATTEMPT!=='1')throw new Error('workflow_retry_forbidden');

const {accountId,accountFingerprint,databaseId,token}=maskProductionIdentity(resolveProductionIdentity(process.env));

let result;
try{result=await runProductionCollection({accountId,accountFingerprint,databaseId,season:PRODUCTION_SEASON,token,
  scheduledAt:FIRST_PRODUCTION_RUN_SCHEDULED_AT,resumeStarted:true,
  transport:request=>fetch(request.url,request),fetchImpl:fetch});}
catch(error){summary('DATA-S2 first-run resume STOPPED',productionFailureClassification(error));throw error;}
summary('DATA-S2 first-run resume',{result:result.result,mutation:result.mutation,changed:result.changed,
  recordsSeen:result.recordsSeen,reconciliation:result.reconciliation,state:result.state,
  population:result.population,d1:result.d1});
