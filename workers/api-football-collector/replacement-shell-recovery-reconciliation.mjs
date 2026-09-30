import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {REPLACEMENT_COLLECTOR,REPLACEMENT_RECOVERY_WORKER_ID,validateOriginalReport} from './replacement-foundation.mjs';
import {readReplacementState} from './replacement-reconciliation.mjs';
import {REPLACEMENT_RECOVERY_CLASSIFICATIONS,REPLACEMENT_RECOVERY_MUTATION_CEILINGS} from './replacement-shell-recovery.mjs';

const fail=code=>{throw new Error(code);};
const ZERO_KEYS=['createShellMutations','deploymentsCreated','workersDevEnabled','cronRouteDomainMutations','accessMutations','d1Mutations','providerRequests','triggerHeaderRequests'];
const inactive=state=>state?.present===true&&state.workerName===REPLACEMENT_COLLECTOR&&state.workerId===REPLACEMENT_RECOVERY_WORKER_ID&&state.workersDev===false&&state.previewUrls===false&&state.deploymentCount===0&&state.cronCount===0&&state.routeCount===0&&state.customDomainCount===0;
const shellOnly=state=>inactive(state)&&state.versionCount===0&&state.versionInventoryExact===true;
const oneVersion=(state,execution)=>inactive(state)&&typeof execution.versionId==='string'&&state.versionId===execution.versionId&&state.versionCount===1&&state.versionInventoryExact===true&&state.versionIdentityExact===true;

export function validateReplacementRecoveryReconciliation({execution,originalReport,replacement}={}){
  const counts=execution?.mutationCounts;
  if(!execution||execution.workerId!==REPLACEMENT_RECOVERY_WORKER_ID||execution.retryAuthorized!==false||ZERO_KEYS.some(key=>execution[key]!==0)||!counts||
    counts.enablePreview>REPLACEMENT_RECOVERY_MUTATION_CEILINGS.enablePreview||counts.uploadVersion>REPLACEMENT_RECOVERY_MUTATION_CEILINGS.uploadVersion||counts.disablePreview>REPLACEMENT_RECOVERY_MUTATION_CEILINGS.disablePreview)fail('replacement_recovery_reconciliation_execution_invalid');
  const success=execution.classification===REPLACEMENT_RECOVERY_CLASSIFICATIONS.success&&execution.complete===true&&execution.safeStop===false&&execution.routingProved===true&&execution.previewDisabled===true&&execution.replacementState==='ONE_VERSION';
  const safeStop=execution.classification===REPLACEMENT_RECOVERY_CLASSIFICATIONS.safeStop&&execution.complete===false&&execution.safeStop===true&&execution.previewDisabled===true&&['SHELL_ONLY','ONE_VERSION'].includes(execution.replacementState);
  if(!success&&!safeStop)fail('replacement_recovery_reconciliation_execution_invalid');
  validateOriginalReport(originalReport);
  const candidateExact=execution.replacementState==='SHELL_ONLY'?shellOnly(replacement)&&execution.versionId===null:oneVersion(replacement,execution);
  if(!candidateExact)fail('replacement_recovery_reconciliation_candidate_invalid');
  return Object.freeze({classification:success?'REPLACEMENT_SHELL_RECOVERY_RECONCILED':'REPLACEMENT_SHELL_RECOVERY_SAFE_STOP_RECONCILED',
    replacementWorker:REPLACEMENT_COLLECTOR,replacementState:execution.replacementState,workerId:REPLACEMENT_RECOVERY_WORKER_ID,versionId:execution.versionId,foundationSucceeded:success,retryAuthorized:false});
}

const knownFailure=error=>/^replacement_recovery_[A-Za-z0-9_]{1,96}$/.test(String(error?.message))?error.message:'replacement_recovery_reconciliation_failed_unknown';

export async function runReplacementRecoveryReconciliation({env=process.env,fetchImpl=globalThis.fetch}={}){
  const execution=JSON.parse(fs.readFileSync(env.API_FOOTBALL_REPLACEMENT_RECOVERY_EXECUTION_PATH,'utf8'));
  const originalReport=JSON.parse(fs.readFileSync(env.API_FOOTBALL_REPLACEMENT_RECOVERY_ORIGINAL_REPORT_PATH,'utf8'));
  if(execution.approvedSha!==env.APPROVED_SHA||originalReport.approvedSha!==env.APPROVED_SHA)fail('replacement_recovery_reconciliation_sha_mismatch');
  let replacement=null;
  try{
    replacement=await readReplacementState({account:env.CLOUDFLARE_ACCOUNT_ID,token:env.CLOUDFLARE_REPLACEMENT_READ_TOKEN,versionId:typeof execution.versionId==='string'?execution.versionId:null,approvedSha:execution.approvedSha,fetchImpl});
    const result=validateReplacementRecoveryReconciliation({execution,originalReport,replacement});
    return Object.freeze({...result,ok:true,executionClassification:execution.classification,approvedSha:execution.approvedSha,replacement,retryAuthorized:false});
  }catch(error){
    return Object.freeze({classification:'REPLACEMENT_SHELL_RECOVERY_OWNER_ATTENTION_REQUIRED',reason:knownFailure(error),ok:false,foundationSucceeded:false,
      executionClassification:typeof execution.classification==='string'?execution.classification:null,replacementWorker:REPLACEMENT_COLLECTOR,approvedSha:execution.approvedSha,replacement,retryAuthorized:false});
  }
}

export async function main(){
  const result=await runReplacementRecoveryReconciliation();
  if(process.env.API_FOOTBALL_REPLACEMENT_RECOVERY_RECONCILIATION_PATH)fs.writeFileSync(process.env.API_FOOTBALL_REPLACEMENT_RECOVERY_RECONCILIATION_PATH,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({classification:result.classification,foundationSucceeded:result.foundationSucceeded,replacementWorker:result.replacementWorker,retryAuthorized:false}));
  return result.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
