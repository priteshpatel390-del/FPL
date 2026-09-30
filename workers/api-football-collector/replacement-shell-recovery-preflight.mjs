import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {runReplacementRecoveryAdmission} from './replacement-shell-recovery.mjs';

export async function main(){
  let report;
  try{report=await runReplacementRecoveryAdmission();}
  catch(error){report={ok:false,approvedSha:process.env.APPROVED_SHA??null,reason:/^replacement_recovery_[A-Za-z0-9_]{1,96}$/.test(String(error?.message))?error.message:'replacement_recovery_admission_failed_unknown',productionMutations:0,apiFootballRequests:0,secretValuesRead:0,retryAuthorized:false};}
  if(process.env.API_FOOTBALL_REPLACEMENT_RECOVERY_ADMISSION_PATH)fs.writeFileSync(process.env.API_FOOTBALL_REPLACEMENT_RECOVERY_ADMISSION_PATH,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:report.ok===true,replacementState:report.replacementState??null,reason:report.reason??null,productionMutations:0,apiFootballRequests:0,secretValuesRead:0,retryAuthorized:false}));
  return report.ok===true?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
