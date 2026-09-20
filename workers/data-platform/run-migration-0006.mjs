import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {maskProductionIdentity,resolveProductionIdentity} from './production-identity.mjs';
import {applyMigration0006Schema,persistPrivateMapping0006} from './migration6/production.mjs';

const safeFailure=(phase,mutationIssued=false)=>Object.freeze({ok:false,classification:mutationIssued?'AMBIGUOUS_REQUIRES_OWNER_ATTENTION':'DEFINITELY_NOT_APPLIED',mutationIssued,recoveryIssued:false,automaticRestorePermitted:false,note:`${phase}_failed`,apiFootballRequests:0,workerCronSecretChanges:0});
function writeReport(report,pathVariable){
  const path=process.env[pathVariable];if(path)fs.writeFileSync(path,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:report.ok,classification:report.classification,mutationIssued:report.mutationIssued,recoveryIssued:false,automaticRestorePermitted:false,apiFootballRequests:0,workerCronSecretChanges:0}));
}
export async function main(){
  if(process.env.GITHUB_RUN_ATTEMPT!=='1')throw new Error('workflow_retry_forbidden');
  const phase=process.env.MIGRATION_0006_PHASE;
  const identity=maskProductionIdentity(resolveProductionIdentity(process.env));
  try{
    if(phase==='schema'){
      const report=await applyMigration0006Schema({...identity,transport:(url,init)=>fetch(url,init)});writeReport(report,'MIGRATION_0006_REPORT_PATH');return report.ok?0:1;
    }
    if(phase==='mapping'){
      const providerUniverse=JSON.parse(fs.readFileSync(process.env.API_FOOTBALL_PROVIDER_UNIVERSE_PATH,'utf8')).providerUniverse;
      const report=await persistPrivateMapping0006({...identity,crosswalkJson:process.env.API_FOOTBALL_OWNER_CROSSWALK_JSON,providerUniverse});
      writeReport(report,'MAPPING_0006_REPORT_PATH');return report.ok?0:1;
    }
    throw new Error('migration_0006_phase_invalid');
  }catch{
    const report=safeFailure(phase==='mapping'?'private_mapping':'migration_0006_schema');
    writeReport(report,phase==='mapping'?'MAPPING_0006_REPORT_PATH':'MIGRATION_0006_REPORT_PATH');return 1;
  }
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
