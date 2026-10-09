// NEW corrected R1/R2 Deployment promotion. Repository-only until a separate merge AND live dispatch approval.
// The consumed Gate B promotion workflow and implementation remain immutable historical evidence.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {
  CORRECTED_HISTORICAL_VERSION_IDS,buildCorrectedVersionIdentity,validateCorrectedVersion,
  classifyCorrectedReconciliation
} from './corrected-version-preparation.mjs';
import {readCorrectedState,readCorrectedVersions} from './corrected-version-readonly.mjs';
import {readPromotionDeploymentRows} from './transport-remediated-deployment-promotion-readonly.mjs';
import {
  createPromotionGuardedFetch,promotionPaths,readFreshPromotionInertState
} from './run-transport-remediated-deployment-promotion.mjs';
import {promotionPostStateExact,promotionDeploymentRows} from './transport-remediated-deployment-promotion.mjs';
import {readReplacementRouteTopology} from './replacement-reconciliation.mjs';
import {validateZoneTopology} from './deployed-one-shot.mjs';

export const CREATION_SHA='073ac6a53d09f004e5ada5b94fb1cea6df3ef228';
export const CANDIDATE_ID='509f5a98-38fc-4e58-8a26-1b8fc4c9c787';
export const QUALIFICATION_RUN='37987230679';
export const QUALIFICATION_ARTIFACT_SHA256='c2620b87c243a0a0f22833a74ab76721694913c4835ddcc9a038bbefd6824a18';
export const GRAPH_SHA256='dc2add08477b19dba42c92db6cf8c946e3ddfd77d719a31dc4f6c77ffb000dfa';
export const METADATA_SHA256='e0d55dd587fc69b496091d5e0106afb3824899d345d35f7bb8e6ff4c94438c70';
export const EXPECTED_IDS=Object.freeze([...CORRECTED_HISTORICAL_VERSION_IDS,CANDIDATE_ID]);
export const ADMISSION_CONTRACT='corrected-version-inert-promotion-admission-v1';
export const EXECUTION_CONTRACT='corrected-version-inert-promotion-execution-v1';
export const FINAL_CONTRACT='corrected-version-inert-promotion-final-v1';
export const PREPARED='CORRECTED_VERSION_PREPARED_NOT_DEPLOYED';
export const PROMOTED='CORRECTED_VERSION_PROMOTED_INERT';
export const ATTENTION='CORRECTED_VERSION_PROMOTION_OWNER_ATTENTION';
const fail=reason=>{throw new Error('CORRECTED_PROMOTION_'+reason);};
const sha=s=>createHash('sha256').update(s).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Bind all pre-existing private mapping, Official FPL authority, isolation and runtime data;
// only the Deployment inventory count is permitted to change from two to three.
const shaState=state=>sha(JSON.stringify([
  state?.report?.priorState??null,state?.detail??null,
  state?.report?.mapping??null,state?.report?.officialFplAuthority??null,
  state?.report?.modelUiImportCount??null,state?.report?.rawPayloadStoragePresent??null,
  state?.report?.runtime??null
]));
const sorted=arr=>Array.isArray(arr)&&arr.length===EXPECTED_IDS.length&&new Set(arr).size===arr.length&&
  EXPECTED_IDS.every(id=>arr.includes(id));
const safe=x=>Object.freeze(x);
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const select=(row,id)=>row&&row.strategy==='percentage'&&row.versions?.length===1&&row.versions[0].versionId===id&&row.versions[0].percentage===100;
const inert=state=>Boolean(state?.report?.runtime?.collectionEnabled===0&&
  state.report.runtime.credentialState==='AVAILABLE'&&!state.report.runtime.activeLease&&
  state.report.inventory?.workersDev===false&&state.report.inventory?.previewUrls===false&&
  state.report.inventory.cronCount===0&&state.report.inventory.routeCount===0&&
  state.report.inventory.customDomainCount===0&&
  validateZoneTopology(state.topology));
export function correctedPreDeployment(rows){
  return Array.isArray(rows)&&rows.length===2&&promotionPostStateExact(rows)&&
    rows.every(row=>typeof row.createdOn==='string'&&row.createdOn.length>0);
}
export function correctedPostDeployment(rows,oldRows){
  return Array.isArray(rows)&&rows.length===3&&uuid(rows[0]?.id)&&
    !oldRows.some(x=>x.id===rows[0].id)&&select(rows[0],CANDIDATE_ID)&&
    same(rows.slice(1),oldRows)&&correctedPreDeployment(oldRows);
}
export function assertImmutableQualification(qual){
  if(qual?.ok!==true||qual.classification!==PREPARED||qual.createdVersionId!==CANDIDATE_ID||
    qual.graphSha256!==GRAPH_SHA256||qual.metadataSha256!==METADATA_SHA256||
    qual.retryAuthorized!==false||qual.observed?.versionCount!==5||qual.observed?.deploymentCount!==2||
    qual.observed?.history?.requestAttempts!==5||qual.observed?.detail?.totalMemberships!==824||
    qual.observed?.detail?.quotaState!=='QUOTA_UNCERTAIN'||
    qual.evidence?.deploymentMutations!==0||qual.evidence?.d1Mutations!==0||
    qual.evidence?.apiFootballRequests!==0||qual.evidence?.workerInvocations!==0)
    fail('QUALIFICATION_EVIDENCE_INVALID');
  return true;
}
export function assertIdentity(){
  const identity=buildCorrectedVersionIdentity(CREATION_SHA);
  if(identity.graphSha256!==GRAPH_SHA256||identity.metadataSha256!==METADATA_SHA256||
    Object.keys(identity.moduleSha256).length!==17)fail('IMMUTABLE_IDENTITY_INVALID');
  return identity;
}
export function deploymentBody(executionSha){
  if(!/^[0-9a-f]{40}$/.test(String(executionSha)))fail('EXECUTION_SHA_INVALID');
  return JSON.stringify({strategy:'percentage',versions:[{version_id:CANDIDATE_ID,percentage:100}],
    annotations:{'workers/message':`Corrected v=${CANDIDATE_ID} c=${CREATION_SHA} x=${executionSha}`}});
}
export function buildAdmission({state,original,qualification,executionSha}={}){
  assertImmutableQualification(qualification);
  const identity=assertIdentity();
  if(!/^[0-9a-f]{40}$/.test(String(executionSha)))fail('EXECUTION_SHA_INVALID');
  const verdict=classifyCorrectedReconciliation({...state,created:original,admission:original?.admission,identity,
    approvedSha:CREATION_SHA,accountFingerprint:state?.identity?.accountFingerprint});
  if(verdict?.ok!==true||verdict.classification!==PREPARED)
    fail('INDEPENDENT_QUALIFICATION_NOT_REPEATABLE');
  if(!correctedPreDeployment(state?.deployments)||!sorted(state?.versions?.versionIds)||
    state.versions.identityExact!==true||!inert(state)||state.report.inventory.deploymentCount!==2)
    fail('PRESTATE_NOT_EXACT_OR_INERT');
  return safe({contract:ADMISSION_CONTRACT,ok:true,executionSha,creationSha:CREATION_SHA,candidateId:CANDIDATE_ID,
    graphSha256:identity.graphSha256,metadataSha256:identity.metadataSha256,
    accountFingerprint:state.identity.accountFingerprint,versionIds:[...EXPECTED_IDS].sort(),
    deployments:state.deployments,topology:state.topology,historyDigest:shaState(state),
    retryAuthorized:false,evidence:safe({deploymentPosts:0,d1Writes:0,apiFootballRequests:0,workerInvocations:0})});
}
export function validateAdmission(a,{executionSha,accountFingerprint}={}){
  assertIdentity();
  if(a?.contract!==ADMISSION_CONTRACT||a.ok!==true||a.executionSha!==executionSha||
    a.creationSha!==CREATION_SHA||a.candidateId!==CANDIDATE_ID||a.graphSha256!==GRAPH_SHA256||
    a.metadataSha256!==METADATA_SHA256||a.accountFingerprint!==accountFingerprint||
    !/^[0-9a-f]{64}$/.test(String(a.accountFingerprint))||!sorted(a.versionIds)||
    !correctedPreDeployment(a.deployments)||!validateZoneTopology(a.topology)||
    !/^[0-9a-f]{64}$/.test(String(a.historyDigest))||a.retryAuthorized!==false||
    a.evidence?.deploymentPosts!==0||a.evidence?.d1Writes!==0||
    a.evidence?.apiFootballRequests!==0||a.evidence?.workerInvocations!==0)fail('ADMISSION_HANDOFF_INVALID');
  return true;
}
export function assertFreshCloudflare({admission,versions,deployments,topology,settings}={}){
  validateAdmission(admission,{executionSha:admission?.executionSha,accountFingerprint:admission?.accountFingerprint});
  if(!correctedPreDeployment(deployments)||!same(deployments,admission.deployments)||
    !sorted(versions?.versionIds)||versions.identityExact!==true||
    !validateZoneTopology(topology)||!same(topology,admission.topology)||
    settings?.workersDev!==false||settings.previewUrls!==false||
    settings.cronCount!==0||settings.customDomainCount!==0)fail('FRESH_CLOUDFLARE_DRIFT');
  validateCorrectedVersion({stable:versions.candidate?.stable,beta:versions.candidate?.beta,
    versionId:CANDIDATE_ID,identity:assertIdentity()});
  return true;
}
export function classifyPost({admission,state,execution}={}){
  const stop=reason=>safe({contract:FINAL_CONTRACT,ok:false,classification:ATTENTION,reason,retryAuthorized:false});
  try{
    validateAdmission(admission,{executionSha:admission?.executionSha,accountFingerprint:admission?.accountFingerprint});
    if(execution?.contract!==EXECUTION_CONTRACT||execution.executionSha!==admission.executionSha||
      execution.candidateId!==CANDIDATE_ID||execution.retryAuthorized!==false||
      execution.deploymentPosts!==1||execution.d1Writes!==0||execution.apiFootballRequests!==0||
      execution.workerInvocations!==0||!['CREATED','APPLIED_CONFIRMED_BY_READBACK'].includes(execution.outcome))
      return stop('execution_unproven');
    if(!correctedPostDeployment(state?.deployments,admission.deployments)||
      (execution.deploymentId!==null&&execution.deploymentId!==state.deployments[0].id)||
      state.report?.inventory?.deploymentCount!==3||
      !sorted(state?.versions?.versionIds)||state.versions.identityExact!==true||
      !inert(state)||!same(state.topology,admission.topology)||
      shaState(state)!==admission.historyDigest)return stop('live_state_drift');
    validateCorrectedVersion({stable:state.versions.candidate?.stable,beta:state.versions.candidate?.beta,
      versionId:CANDIDATE_ID,identity:assertIdentity()});
    return safe({contract:FINAL_CONTRACT,ok:true,classification:PROMOTED,activeDeploymentId:state.deployments[0].id,
      candidateId:CANDIDATE_ID,retryAuthorized:false,evidence:safe({deploymentPosts:1,d1Writes:0,apiFootballRequests:0,workerInvocations:0})});
  }catch{return stop('independent_proof_unavailable');}
}
export function makeExecution({executionSha,outcome='NOT_SUBMITTED',deploymentId=null,deploymentPosts=0,readbackAttempts=0}={}){
  return safe({contract:EXECUTION_CONTRACT,executionSha,candidateId:CANDIDATE_ID,outcome,
    deploymentId,readbackAttempts,deploymentPosts,d1Writes:0,apiFootballRequests:0,workerInvocations:0,retryAuthorized:false});
}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function executePromotion({env=process.env,fetchImpl=globalThis.fetch,routeScan=readReplacementRouteTopology,delay=wait}={}){
  let guard=null,executionSha=env.EXECUTION_SHA??null;
  const evidence=(outcome,id=null,reads=0)=>makeExecution({executionSha,outcome,deploymentId:id,deploymentPosts:guard?.counters.deploymentPostAttempts??0,readbackAttempts:reads});
  try{
    if(env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_SHA!==executionSha)
      fail('RUN_IDENTITY_INVALID');
    for(const name of ['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET','CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN','CLOUDFLARE_ATTENDED_MUTATION_TOKEN'])
      if(env[name])fail('PROVIDER_OR_MUTATION_SECRET_PRESENT');
    const names=['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_ACCOUNT_FINGERPRINT','CLOUDFLARE_ATTENDED_READ_TOKEN',
      'CLOUDFLARE_CORRECTED_DEPLOYMENT_PROMOTION_TOKEN','CLOUDFLARE_TOPOLOGY_READ_TOKEN'];
    if(names.some(n=>!env[n]))fail('ENVIRONMENT_INCOMPLETE');
    const [accountId,fingerprint,readToken,promotionToken,topologyToken]=names.map(n=>env[n]);
    if(sha(accountId)!==fingerprint||new Set([readToken,promotionToken,topologyToken]).size!==3)
      fail('ACCOUNT_OR_TOKEN_SEPARATION_INVALID');
    const admission=JSON.parse(fs.readFileSync(env.CORRECTED_PROMOTION_ADMISSION_PATH,'utf8'));
    validateAdmission(admission,{executionSha,accountFingerprint:fingerprint});
    const body=deploymentBody(executionSha);
    guard=createPromotionGuardedFetch({accountId,readToken,promotionToken,topologyToken,expectedBody:body,fetchImpl});
    const paths=promotionPaths(accountId);
    const settings=await readFreshPromotionInertState({guardedFetch:guard.fetch,paths,readToken});
    const deployments=await readPromotionDeploymentRows({accountId,readToken,fetchImpl:guard.fetch});
    const versions=await readCorrectedVersions({accountId,readToken,fetchImpl:guard.fetch,candidateId:CANDIDATE_ID});
    const topology=await routeScan({account:accountId,topologyToken,fetchImpl:guard.fetch,workerName:'teamsheet-api-football-shadow-collector'});
    assertFreshCloudflare({admission,deployments,versions,topology,settings});
    const url='https://api.cloudflare.com/client/v4'+paths.deployments;
    let response=null,payload=null;
    try{
      response=await guard.fetch(url,{method:'POST',redirect:'manual',
        headers:{Authorization:'Bearer '+promotionToken,Accept:'application/json','Content-Type':'application/json'},
        body,signal:AbortSignal.timeout(30000)});
      payload=await response.json();
    }catch{/* Uncertain POST: do not retry. Bounded GET-only reconciliation below. */}
    if(response?.status>=400&&response.status<500&&payload?.success===false&&Array.isArray(payload.errors))
      return evidence('REJECTED');
    const returned=response?.ok&&payload?.success===true&&uuid(payload?.result?.id)?payload.result.id:null;
    for(let i=0;i<3;i++){
      await delay([0,2000,5000][i]);
      const result=await readPromotionDeploymentRows({accountId,readToken,fetchImpl:guard.fetch});
      if(!Array.isArray(result))return evidence('AMBIGUOUS_OWNER_ATTENTION',null,i+1);
      if(correctedPostDeployment(result,admission.deployments)){
        if(returned&&result[0].id!==returned)return evidence('AMBIGUOUS_OWNER_ATTENTION',null,i+1);
        return evidence(returned?'CREATED':'APPLIED_CONFIRMED_BY_READBACK',result[0].id,i+1);
      }
      if(!same(result,admission.deployments))return evidence('AMBIGUOUS_OWNER_ATTENTION',null,i+1);
    }
    return evidence('AMBIGUOUS_OWNER_ATTENTION',null,3);
  }catch{return evidence((guard?.counters.deploymentPostAttempts??0)>0?'AMBIGUOUS_OWNER_ATTENTION':'NOT_SUBMITTED');}
}
export async function main(){
  const result=await executePromotion();
  if(process.env.CORRECTED_PROMOTION_EXECUTION_REPORT_PATH)
    fs.writeFileSync(process.env.CORRECTED_PROMOTION_EXECUTION_REPORT_PATH,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({outcome:result.outcome,deploymentPosts:result.deploymentPosts,retryAuthorized:false}));
  return result.outcome==='CREATED'||result.outcome==='APPLIED_CONFIRMED_BY_READBACK'?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
