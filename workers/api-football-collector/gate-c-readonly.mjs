// Gate C read-only admission and independent terminal reconciliation. NEVER invokes a Worker or provider.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {runApiFootballActivationLivePreflight} from './activation-live-preflight.mjs';
import {DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE} from './deployed-one-shot.mjs';
import {EXPECTED_D1_DATABASE_ID} from '../data-platform/phase4b/live-contract.mjs';
import {deployedOneShotPreflightEnv,readIdentity,readTopology} from './deployed-one-shot-readonly.mjs';
import {readPromotionVersions,readPromotionDeploymentRows} from './transport-remediated-deployment-promotion-readonly.mjs';
import {buildGateCAdmission,classifyGateCReconciliation,GATE_C_RECONCILIATION_VERSION,GATE_C_OWNER_ATTENTION} from './gate-c.mjs';

const safe=x=>Object.freeze(x);
const zero=safe({productionMutations:0,apiFootballRequests:0,secretValuesRead:0});
// Fixed SELECT, parameterised for the UTC day. Reads exact attempt/generation identity, not just aggregate deltas.
// This is an independent D1 REST read; never hand arbitrary SQL to a caller.
export const GATE_C_DAY_LEDGER_SQL=`SELECT
  (SELECT COUNT(*) FROM api_football_request_attempts WHERE generation_id=?) AS attempts,
  (SELECT COUNT(*) FROM api_football_request_attempts WHERE generation_id=? AND quota_utc_day=? AND attempt_number=1 AND operation_class='DISCOVERY' AND outcome='SUCCEEDED') AS succeeded,
  (SELECT COUNT(*) FROM api_football_request_attempts WHERE generation_id=? AND attempt_number=2) AS attempt2,
  (SELECT COUNT(*) FROM api_football_discovery_generations WHERE generation_id=?) AS generations,
  (SELECT COUNT(*) FROM api_football_discovery_generations WHERE generation_id=? AND state='COMMITTED') AS committed,
  (SELECT COUNT(*) FROM api_football_discovery_heads WHERE generation_id=?) AS headMatches`;
export function gateCDayGenerationId(utcDay){
  if(typeof utcDay!=='string'||!/^\\d{4}-\\d{2}-\\d{2}$/.test(utcDay))throw Error('gate_c_day_invalid');
  return 'api-football:generation:DISCOVERY:2026-27:2026:'+utcDay+'T00:00:00.000Z';
}
export async function readGateCDayLedger({accountId,readToken,utcDay,fetchImpl=globalThis.fetch}={}){
  let generationId;try{generationId=gateCDayGenerationId(utcDay);}catch{return null;}
  const params=[generationId,generationId,utcDay,generationId,generationId,generationId,generationId];
  const requestPath='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(accountId)+
    '/d1/database/'+encodeURIComponent(EXPECTED_D1_DATABASE_ID)+'/query';
  let response,payload;
  try{
    response=await fetchImpl(requestPath,{method:'POST',headers:{Authorization:'Bearer '+readToken,Accept:'application/json','Content-Type':'application/json'},
      body:JSON.stringify({batch:[{sql:GATE_C_DAY_LEDGER_SQL,params}]}),redirect:'error',signal:AbortSignal.timeout(15_000)});
    payload=await response.json();
  }catch{return null;}
  if(!response.ok||payload?.success!==true||!Array.isArray(payload.result)||payload.result.length!==1)return null;
  const result=payload.result[0];
  if(result?.success!==true||!Array.isArray(result.results)||result.results.length!==1||result.meta?.rows_written!==0)return null;
  const row=result.results[0],out={utcDay};
  for(const key of ['attempts','succeeded','attempt2','generations','committed','headMatches']){
    if(!Number.isSafeInteger(row?.[key])||row[key]<0)return null;out[key]=row[key];
  }
  return safe(out);
}
export async function collectGateCReadState({env=process.env,fetchImpl=globalThis.fetch,
  preflight=runApiFootballActivationLivePreflight,versionsReader=readPromotionVersions,
  deploymentsReader=readPromotionDeploymentRows,topologyReader=readTopology,dayReader=readGateCDayLedger,now=()=>new Date()}={}){
  const identity=readIdentity(env);
  if(!identity)return safe({identity:null,report:null,versions:null,deploymentRows:null,topology:null,dayLedger:null,utcDay:null});
  const report=await preflight({env:deployedOneShotPreflightEnv(identity),fetchImpl,stage:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE});
  const deploymentRows=await deploymentsReader({accountId:identity.accountId,readToken:identity.readToken,fetchImpl});
  const versions=await versionsReader({accountId:identity.accountId,readToken:identity.readToken,fetchImpl});
  const {topology}=await topologyReader(identity,fetchImpl);
  const utcDay=now().toISOString().slice(0,10);
  const dayLedger=await dayReader({accountId:identity.accountId,readToken:identity.readToken,utcDay,fetchImpl});
  return safe({identity,report,deploymentRows,versions,topology,dayLedger,utcDay});
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
      runtime:state.report?.runtime??null,history:state.report?.priorState??null,dayLedger:state.dayLedger??null,
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
