import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {maskProductionIdentity,resolveProductionIdentity} from './production-identity.mjs';
import {applyMigration0006Schema,persistPrivateMapping0006} from './migration6/production.mjs';

const safeFailure=(phase,mutationIssued=false)=>Object.freeze({ok:false,classification:mutationIssued?'AMBIGUOUS_REQUIRES_OWNER_ATTENTION':'DEFINITELY_NOT_APPLIED',mutationIssued,recoveryIssued:false,automaticRestorePermitted:false,note:`${phase}_failed`,apiFootballRequests:0,workerCronSecretChanges:0});
function writeReport(report,pathVariable){
  const path=process.env[pathVariable];if(path)fs.writeFileSync(path,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:report.ok,classification:report.classification,mutationIssued:report.mutationIssued,recoveryIssued:false,automaticRestorePermitted:false,apiFootballRequests:0,workerCronSecretChanges:0}));
}
export async function executeMigration0006({
  env=process.env,transport=(url,init)=>fetch(url,init),schemaImpl=applyMigration0006Schema,
  mappingImpl=persistPrivateMapping0006,identityImpl=value=>maskProductionIdentity(resolveProductionIdentity(value)),
  readProviderUniverse=path=>JSON.parse(fs.readFileSync(path,'utf8')).providerUniverse
}={}){
  if(env.GITHUB_RUN_ATTEMPT!=='1')throw new Error('workflow_retry_forbidden');
  const phase=env.MIGRATION_0006_PHASE;
  let mutationIssued=false;
  const onMutationSubmitted=()=>{mutationIssued=true;};
  try{
    const identity=identityImpl(env);
    if(phase==='schema'){
      return await schemaImpl({...identity,transport,onMutationSubmitted});
    }
    if(phase==='mapping'){
      const providerUniverse=readProviderUniverse(env.API_FOOTBALL_PROVIDER_UNIVERSE_PATH);
      return await mappingImpl({...identity,transport,onMutationSubmitted,crosswalkJson:env.API_FOOTBALL_OWNER_CROSSWALK_JSON,providerUniverse});
    }
    throw new Error('migration_0006_phase_invalid');
  }catch{
    return safeFailure(phase==='mapping'?'private_mapping':'migration_0006_schema',mutationIssued);
  }
}
export async function main(){
  const phase=process.env.MIGRATION_0006_PHASE;
  const report=await executeMigration0006();
  writeReport(report,phase==='mapping'?'MAPPING_0006_REPORT_PATH':'MIGRATION_0006_REPORT_PATH');return report.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
