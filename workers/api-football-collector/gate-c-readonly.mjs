// Gate C read-only admission and independent terminal reconciliation. NEVER invokes a Worker or provider.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {runApiFootballActivationLivePreflight} from './activation-live-preflight.mjs';
import {DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE} from './deployed-one-shot.mjs';
import {deployedOneShotPreflightEnv,readIdentity,readTopology} from './deployed-one-shot-readonly.mjs';
import {readPromotionVersions,readPromotionDeploymentRows} from './transport-remediated-deployment-promotion-readonly.mjs';
import {buildGateCAdmission,classifyGateCReconciliation,GATE_C_RECONCILIATION_VERSION,GATE_C_OWNER_ATTENTION} from './gate-c.mjs';

const safe=x=>Object.freeze(x);
const zero=safe({productionMutations:0,apiFootballRequests:0,secretValuesRead:0});
export async function collectGateCReadState({env=process.env,fetchImpl=globalThis.fetch,
  preflight=runApiFootballActivationLivePreflight,versionsReader=readPromotionVersions,
  deploymentsReader=readPromotionDeploymentRows,topologyReader=readTopology}={}){
  const identity=readIdentity(env);
  if(!identity)return safe({identity:null,report:null,versions:null,deploymentRows:null,topology:null,utcDay:null});
  const report=await preflight({env:deployedOneShotPreflightEnv(identity),fetchImpl,stage:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE});
  const deploymentRows=await deploymentsReader({accountId:identity.accountId,readToken:identity.readToken,fetchImpl});
  const versions=await versionsReader({accountId:identity.accountId,readToken:identity.readToken,fetchImpl});
  const {topology}=await topologyReader(identity,fetchImpl);
  return safe({identity,report,deploymentRows,versions,topology,utcDay:new Date().toISOString().slice(0,10)});
}
export async function runGateCAdmission(options={}){
  const state=await collectGateCReadState(options);
  return buildGateCAdmission({...state,approvedSha:state.identity?.approvedSha??null,
    accountFingerprint:state.identity?.accountFingerprint??null});
}
export async function runGateCReconciliation({execution=null,admission=null,...options}={}){
  const state=await collectGateCReadState(options),identity=state.identity;
  if(!identity)return safe({version:GATE_C_RECONCILIATION_VERSION,ok:false,classification:GATE_C_OWNER_ATTENTION,
    reason:'read_identity_invalid',retryAuthorized:false,evidence:zero});
  const verdict=classifyGateCReconciliation({...state,execution,admission,
    approvedSha:identity.approvedSha,accountFingerprint:identity.accountFingerprint});
  return safe({...verdict,approvedSha:identity.approvedSha,
    observed:safe({
      preflightClassification:state.report?.classification??null,preflightReason:state.report?.reason??null,
      runtime:state.report?.runtime??null,history:state.report?.priorState??null,
      workerVersions:Array.isArray(state.versions?.versionIds)?state.versions.versionIds.length:null,
      deployments:state.deploymentRows?.map(row=>safe({id:row.id,strategy:row.strategy,versions:row.versions}))??null,
      topology:safe({workersDev:state.report?.inventory?.workersDev??null,preview:state.report?.inventory?.previewUrls??null,
        cron:state.report?.inventory?.cronCount??null,legacyRoutes:state.report?.inventory?.routeCount??null,
        customDomains:state.report?.inventory?.customDomainCount??null,zoneRoutes:state.topology?.routeCount??null}),
      mapping:state.report?.mapping??null,officialAuthority:state.report?.officialFplAuthority??null,
      modelUiImports:state.report?.modelUiImportCount??null,rawPayloadStorage:state.report?.rawPayloadStoragePresent??null
    }),evidence:zero});
}
export async function main(){
  const mode=process.env.API_FOOTBALL_GATE_C_MODE,outputPath=process.env.API_FOOTBALL_GATE_C_REPORT_PATH;
  let result;
  if(mode==='ADMISSION')result=await runGateCAdmission();
  else if(mode==='RECONCILIATION'){
    const executionPath=process.env.API_FOOTBALL_GATE_C_EXECUTION_PATH;
    const admissionPath=process.env.API_FOOTBALL_GATE_C_ADMISSION_PATH;
    const execution=executionPath&&fs.existsSync(executionPath)?JSON.parse(fs.readFileSync(executionPath,'utf8')):null;
    const admission=admissionPath&&fs.existsSync(admissionPath)?JSON.parse(fs.readFileSync(admissionPath,'utf8')):null;
    result=await runGateCReconciliation({execution,admission});
  }else throw new Error('gate_c_mode_invalid');
  if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:result.ok,classification:result.classification,reason:result.reason??null,
    retryAuthorized:false,...zero}));
  return result.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
