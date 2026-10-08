// Read-only corrected-Version admission and independent post-upload reconciliation. Never dispatch without a new owner gate.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {runApiFootballActivationLivePreflight} from './activation-live-preflight.mjs';
import {deployedOneShotPreflightEnv,readIdentity,readTopology} from './deployed-one-shot-readonly.mjs';
import {DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE} from './deployed-one-shot.mjs';
import {readPromotionDeploymentRows,readPromotionVersions} from './transport-remediated-deployment-promotion-readonly.mjs';
import {promotionVersionInventoryDiagnostic} from './transport-remediated-deployment-promotion.mjs';
import {extractVersionIds} from './stage-inactive-version.mjs';
import {
  buildCorrectedVersionIdentity,buildCorrectedAdmission,classifyCorrectedReconciliation,
  CORRECTED_HISTORICAL_VERSION_IDS,CORRECTED_RECONCILIATION_CONTRACT,CORRECTED_ATTENTION
} from './corrected-version-preparation.mjs';

const API='https://api.cloudflare.com/client/v4',safe=x=>Object.freeze(x);
const enc=s=>encodeURIComponent(String(s));
// Only fixed SELECT statements, never interpolate external SQL or identifiers.
export const CORRECTED_HISTORY_QUERY=`SELECT
 (SELECT COUNT(*) FROM api_football_generation_fixtures) AS totalMemberships,
 (SELECT COUNT(*) FROM api_football_generation_fixtures gf JOIN api_football_discovery_generations g ON g.generation_id=gf.generation_id WHERE g.state='FAILED') AS failedMemberships,
 (SELECT COUNT(*) FROM api_football_generation_fixtures gf JOIN api_football_discovery_generations g ON g.generation_id=gf.generation_id WHERE g.state='COMMITTED') AS committedMemberships,
 (SELECT COUNT(*) FROM api_football_generation_fixtures gf LEFT JOIN api_football_fixture_revisions r ON gf.fixture_revision_id=r.fixture_revision_id LEFT JOIN api_football_discovery_generations g ON gf.generation_id=g.generation_id WHERE r.fixture_revision_id IS NULL OR g.generation_id IS NULL) AS orphanMemberships,
 (SELECT COUNT(*) FROM api_football_generation_fixtures gf JOIN api_football_fixture_revisions r ON r.fixture_revision_id=gf.fixture_revision_id WHERE gf.provider_fixture_identity!=r.provider_fixture_identity) AS mismatchedMembershipRevisions,
 (SELECT COUNT(*) FROM api_football_discovery_heads) AS discoveryHeads,
 (SELECT COUNT(*) FROM api_football_request_attempts WHERE quota_utc_day='2026-10-08' AND operation_class='DISCOVERY') AS october8Attempts,
 (SELECT COUNT(*) FROM api_football_request_attempts WHERE quota_utc_day='2026-10-08' AND operation_class='DISCOVERY' AND outcome='SUCCEEDED') AS october8Succeeded,
 (SELECT COUNT(*) FROM api_football_request_attempts WHERE quota_utc_day='2026-10-08' AND operation_class='DISCOVERY' AND outcome='SCHEMA_FAILURE') AS october8SchemaFailures,
 (SELECT COUNT(DISTINCT gf.generation_id) FROM api_football_generation_fixtures gf JOIN api_football_discovery_generations g ON g.generation_id=gf.generation_id WHERE g.state='FAILED') AS failedGenerationMemberships`;
const DETAIL_FIELDS=Object.freeze(['totalMemberships','failedMemberships','committedMemberships','orphanMemberships',
  'mismatchedMembershipRevisions','discoveryHeads','october8Attempts','october8Succeeded','october8SchemaFailures','failedGenerationMemberships']);
export async function readCorrectedHistoryDetail({accountId,readToken,fetchImpl=globalThis.fetch}={}){
  if(typeof accountId!=='string'||!accountId||typeof readToken!=='string'||!readToken)return null;
  const path='/accounts/'+enc(accountId)+'/d1/database/';
  // The production ID comes from the existing pinned repository contract; no user-supplied database target.
  const {EXPECTED_D1_DATABASE_ID}=await import('../data-platform/phase4b/live-contract.mjs');
  const url=API+path+enc(EXPECTED_D1_DATABASE_ID)+'/query';
  let response,payload;
  try{
    response=await fetchImpl(url,{method:'POST',redirect:'manual',headers:{Authorization:'Bearer '+readToken,
      Accept:'application/json','Content-Type':'application/json'},
      body:JSON.stringify({sql:CORRECTED_HISTORY_QUERY,params:[]}),signal:AbortSignal.timeout(15_000)});
    if(!response.ok||response.status>=300)return null;
    payload=await response.json();
  }catch{return null;}
  const results=payload?.success===true?payload.result:null;
  const rows=Array.isArray(results)&&results.length===1?results[0]?.results:null;
  if(!Array.isArray(rows)||rows.length!==1)return null;
  const row=rows[0],detail={};
  for(const key of DETAIL_FIELDS){
    const value=Number(row?.[key]);
    if(!Number.isSafeInteger(value)||value<0)return null;
    detail[key]=value;
  }
  return safe(detail);
}
async function getExactVersion({accountId,readToken,versionId,fetchImpl=globalThis.fetch}={}){
  if(!/^[a-z0-9-]{36}$/i.test(String(versionId)))return null;
  const root='/accounts/'+enc(accountId),script=root+'/workers/scripts/teamsheet-api-football-shadow-collector';
  // The original Worker ID is a pinned repository constant rather than an inferred script identifier.
  const {DEPLOYED_ONE_SHOT_WORKER_ID}=await import('./deployed-one-shot.mjs');
  const requests=[script+'/versions/'+enc(versionId),root+'/workers/workers/'+enc(DEPLOYED_ONE_SHOT_WORKER_ID)+'/versions/'+enc(versionId)+'?include=modules'];
  const results=[];
  for(const requestPath of requests){
    try{
      const response=await fetchImpl(API+requestPath,{method:'GET',redirect:'manual',
        headers:{Authorization:'Bearer '+readToken,Accept:'application/json'},signal:AbortSignal.timeout(15_000)});
      if(!response.ok||response.status>=300)return null;
      const payload=await response.json();if(payload?.success!==true)return null;
      results.push(payload.result);
    }catch{return null;}
  }
  return safe({stable:results[0],beta:results[1]});
}
export async function readCorrectedVersions({accountId,readToken,fetchImpl=globalThis.fetch,candidateId=null}={}){
  const historical=await readPromotionVersions({accountId,readToken,fetchImpl});
  if(!historical||!Array.isArray(historical.versionIds))return null;
  const historicalIds=historical.versionIds.filter(x=>CORRECTED_HISTORICAL_VERSION_IDS.includes(x));
  const identityExact=promotionVersionInventoryDiagnostic({...historical,versionIds:historicalIds})===null;
  const candidate=candidateId?await getExactVersion({accountId,readToken,versionId:candidateId,fetchImpl}):null;
  return safe({versionIds:historical.versionIds,identityExact,candidate});
}
export async function readCorrectedState({env=process.env,fetchImpl=globalThis.fetch,preflight=runApiFootballActivationLivePreflight,
  detailReader=readCorrectedHistoryDetail,versionsReader=readCorrectedVersions,deploymentsReader=readPromotionDeploymentRows,
  topologyReader=readTopology,candidateId=null}={}){
  const identity=readIdentity(env);
  if(!identity)return safe({identity:null,report:null,detail:null,versions:null,deployments:null,topology:null});
  const report=await preflight({env:deployedOneShotPreflightEnv(identity),fetchImpl,stage:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE});
  const [detail,versions,deployments,route]=await Promise.all([
    detailReader({accountId:identity.accountId,readToken:identity.readToken,fetchImpl}),
    versionsReader({accountId:identity.accountId,readToken:identity.readToken,fetchImpl,candidateId}),
    deploymentsReader({accountId:identity.accountId,readToken:identity.readToken,fetchImpl}),
    topologyReader(identity,fetchImpl)
  ]);
  return safe({identity,report,detail,versions,deployments,topology:route?.topology??null});
}
export async function runCorrectedAdmission(options={}){
  const state=await readCorrectedState(options);
  return buildCorrectedAdmission({...state,approvedSha:state.identity?.approvedSha??null,accountFingerprint:state.identity?.accountFingerprint??null});
}
export async function runCorrectedReconciliation({execution=null,...options}={}){
  const approvedSha=options.env?.APPROVED_SHA??process.env.APPROVED_SHA;
  const identity=buildCorrectedVersionIdentity(approvedSha);
  const versionId=execution?.versionId??null;
  const state=await readCorrectedState({...options,candidateId:versionId});
  const admission=execution?.admission??null;
  const verdict=classifyCorrectedReconciliation({...state,admission,created:execution,identity,
    approvedSha,accountFingerprint:state.identity?.accountFingerprint??null});
  return safe({...verdict,observed:safe({versionCount:state.versions?.versionIds?.length??null,
    deploymentCount:state.deployments?.length??null,history:state.report?.priorState??null,detail:state.detail??null})});
}
export async function main(){
  const mode=process.env.API_FOOTBALL_CORRECTED_MODE;
  let report;if(mode==='ADMISSION')report=await runCorrectedAdmission();
  else if(mode==='RECONCILIATION'){
    const path=process.env.API_FOOTBALL_CORRECTED_EXECUTION_PATH;
    const execution=path?JSON.parse(fs.readFileSync(path,'utf8')):null;
    report=await runCorrectedReconciliation({execution});
  }else throw new Error('corrected_readonly_mode_invalid');
  if(process.env.API_FOOTBALL_CORRECTED_REPORT_PATH)
    fs.writeFileSync(process.env.API_FOOTBALL_CORRECTED_REPORT_PATH,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:report.ok,classification:report.classification,reason:report.reason,retryAuthorized:false}));
  return report.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)main().then(x=>{process.exitCode=x;}).catch(error=>{
  console.error('CORRECTED_READONLY_STOP');process.exitCode=1;});
