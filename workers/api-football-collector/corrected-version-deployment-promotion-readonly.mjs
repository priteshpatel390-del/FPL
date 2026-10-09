// Separate read-only admission and independent post-promotion reconciliation.
// Reuses the same pinned GET and fixed SELECT-only D1 readers; NEVER invokes the protected POST executor.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {readCorrectedState} from './corrected-version-readonly.mjs';
import {CREATION_SHA,CANDIDATE_ID,buildAdmission,classifyPost} from './corrected-version-deployment-promotion.mjs';

const requireFile=(env,name)=>{if(!env[name])throw new Error('CORRECTED_PROMOTION_READONLY_MISSING_'+name);
  return JSON.parse(fs.readFileSync(env[name],'utf8'));};
export async function runAdmission({env=process.env,readState=readCorrectedState}={}){
  if(env.APPROVED_SHA!==CREATION_SHA||env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_REF!=='refs/heads/main'||
    env.EXECUTION_SHA!==env.GITHUB_SHA)throw new Error('CORRECTED_PROMOTION_READONLY_IDENTITY_INVALID');
  const original=requireFile(env,'CORRECTED_PROMOTION_ORIGINAL_PATH');
  const qualification=requireFile(env,'CORRECTED_PROMOTION_QUALIFICATION_PATH');
  const state=await readState({env,candidateId:CANDIDATE_ID});
  return buildAdmission({state,original,qualification,executionSha:env.EXECUTION_SHA});
}
export async function runFinal({env=process.env,readState=readCorrectedState}={}){
  if(env.APPROVED_SHA!==CREATION_SHA||env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_REF!=='refs/heads/main'||
    env.EXECUTION_SHA!==env.GITHUB_SHA)throw new Error('CORRECTED_PROMOTION_READONLY_IDENTITY_INVALID');
  const admission=requireFile(env,'CORRECTED_PROMOTION_ADMISSION_PATH');
  const execution=requireFile(env,'CORRECTED_PROMOTION_EXECUTION_PATH');
  const state=await readState({env,candidateId:CANDIDATE_ID});
  return classifyPost({admission,state,execution});
}
export async function main(){
  const mode=process.env.CORRECTED_PROMOTION_MODE;
  let report;
  if(mode==='ADMISSION')report=await runAdmission();
  else if(mode==='FINAL')report=await runFinal();
  else throw new Error('CORRECTED_PROMOTION_READONLY_MODE_INVALID');
  if(process.env.CORRECTED_PROMOTION_REPORT_PATH)
    fs.writeFileSync(process.env.CORRECTED_PROMOTION_REPORT_PATH,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:report.ok,classification:report.classification??null,retryAuthorized:false}));
  return report.ok===true?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)
  main().then(code=>process.exitCode=code).catch(()=>{console.error('CORRECTED_PROMOTION_READONLY_STOP');process.exitCode=1;});
