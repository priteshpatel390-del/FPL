// Synthetic-only permanent tests. NO live Cloudflare/D1/provider calls.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import {createPromotionGuardedFetch} from '../workers/api-football-collector/run-transport-remediated-deployment-promotion.mjs';
import {PROMOTION_CANDIDATE_VERSION_ID} from '../workers/api-football-collector/transport-remediated-deployment-promotion.mjs';
import {DEPLOYED_ONE_SHOT_VERSION_ID,DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID} from '../workers/api-football-collector/deployed-one-shot.mjs';
import {GATE_C_ACTIVE_DEPLOYMENT_ID} from '../workers/api-football-collector/gate-c.mjs';
import {CORRECTED_HISTORICAL_VERSION_IDS} from '../workers/api-football-collector/corrected-version-preparation.mjs';
import {
  CREATION_SHA,CANDIDATE_ID,GRAPH_SHA256,METADATA_SHA256,QUALIFICATION_RUN,QUALIFICATION_ARTIFACT_SHA256,
  EXPECTED_IDS,ADMISSION_CONTRACT,EXECUTION_CONTRACT,PREPARED,PROMOTED,
  assertImmutableQualification,assertIdentity,deploymentBody,correctedPreDeployment,
  correctedPostDeployment,validateAdmission,assertFreshCloudflare,classifyPost,makeExecution,executePromotion
} from '../workers/api-football-collector/corrected-version-deployment-promotion.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const ACCOUNT='synthetic-account',FINGERPRINT=sha(ACCOUNT),EXECUTION_SHA='a'.repeat(40);
const ZONE={proof:'ZONE_ROUTE_SCAN',zoneCount:1,routeRowCount:0,routeCount:0};
const DEPLOYED='9b48b57a-e505-4213-9547-fe44835a9bdb';
const OLD='2417a3e0-15db-4e45-a3c8-00b148a300f4';
const NEW='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const select=(id,version,created)=>({id,strategy:'percentage',versions:[{versionId:version,percentage:100}],createdOn:created});
const before=[select(DEPLOYED,PROMOTION_CANDIDATE_VERSION_ID,'2026-10-07T14:00:00Z'),
  select(OLD,DEPLOYED_ONE_SHOT_VERSION_ID,'2026-10-06T14:00:00Z')];
const after=[select(NEW,CANDIDATE_ID,'2026-10-09T22:00:00Z'),...before];
const qualification={ok:true,classification:PREPARED,createdVersionId:CANDIDATE_ID,graphSha256:GRAPH_SHA256,
  metadataSha256:METADATA_SHA256,retryAuthorized:false,
  evidence:{deploymentMutations:0,d1Mutations:0,apiFootballRequests:0,workerInvocations:0},
  observed:{versionCount:5,deploymentCount:2,history:{requestAttempts:5},detail:{totalMemberships:824,quotaState:'QUOTA_UNCERTAIN'}}};
const admission={contract:ADMISSION_CONTRACT,ok:true,executionSha:EXECUTION_SHA,creationSha:CREATION_SHA,
  candidateId:CANDIDATE_ID,graphSha256:GRAPH_SHA256,metadataSha256:METADATA_SHA256,
  accountFingerprint:FINGERPRINT,versionIds:[...EXPECTED_IDS].sort(),deployments:before,
  topology:ZONE,historyDigest:sha(JSON.stringify([{requestAttempts:5},{totalMemberships:824}])),
  retryAuthorized:false,evidence:{deploymentPosts:0,d1Writes:0,apiFootballRequests:0,workerInvocations:0}};

test('new candidate is the independently qualified five-Version identity, NEVER the old consumed Gate B candidate',()=>{
  assert.notEqual(CANDIDATE_ID,PROMOTION_CANDIDATE_VERSION_ID);
  assert.equal(QUALIFICATION_RUN,'37987230679');
  assert.equal(QUALIFICATION_ARTIFACT_SHA256,'c2620b87c243a0a0f22833a74ab76721694913c4835ddcc9a038bbefd6824a18');
  assert.deepEqual(EXPECTED_IDS,[...CORRECTED_HISTORICAL_VERSION_IDS,CANDIDATE_ID]);
  assert.equal(assertImmutableQualification(qualification),true);
  assert.equal(assertIdentity().graphSha256,GRAPH_SHA256);
  assert.equal(assertIdentity().metadataSha256,METADATA_SHA256);
  assert.throws(()=>assertImmutableQualification({...qualification,observed:{...qualification.observed,versionCount:4}}),/EVIDENCE_INVALID/);
  assert.throws(()=>assertImmutableQualification({...qualification,classification:'FAILED'}),/EVIDENCE_INVALID/);
  assert.throws(()=>assertImmutableQualification({...qualification,evidence:{...qualification.evidence,apiFootballRequests:1}}),/EVIDENCE_INVALID/);
});
test('exact Promotion body is only a single new qualified Version at 100 percent, no split, with immutable creation provenance',()=>{
  const body=JSON.parse(deploymentBody(EXECUTION_SHA));
  assert.equal(body.strategy,'percentage');
  assert.deepEqual(body.versions,[{version_id:CANDIDATE_ID,percentage:100}]);
  assert.match(body.annotations['workers/message'],new RegExp(CREATION_SHA));
  assert.match(body.annotations['workers/message'],new RegExp(EXECUTION_SHA));
  assert.doesNotMatch(JSON.stringify(body),new RegExp(PROMOTION_CANDIDATE_VERSION_ID));
  assert.throws(()=>deploymentBody('short'),/EXECUTION_SHA_INVALID/);
});
test('prestate and afterstate retain the exact two historical Deployments and reject drift',()=>{
  assert.equal(GATE_C_ACTIVE_DEPLOYMENT_ID,DEPLOYED);
  assert.equal(DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID,OLD);
  assert.equal(correctedPreDeployment(before),true);
  assert.equal(correctedPostDeployment(after,before),true);
  assert.equal(correctedPreDeployment(after),false);
  assert.equal(correctedPostDeployment(before,before),false);
  assert.equal(correctedPostDeployment([after[0],before[1],before[0]],before),false);
  assert.equal(correctedPostDeployment([select(NEW,CANDIDATE_ID,'today'),before[0]],before),false);
  assert.equal(correctedPostDeployment([select(NEW,PROMOTION_CANDIDATE_VERSION_ID,'today'),...before],before),false);
  assert.equal(correctedPostDeployment([select(NEW,CANDIDATE_ID,'today'),{...before[0],createdOn:'changed'},before[1]],before),false);
  assert.equal(correctedPostDeployment([select(NEW,CANDIDATE_ID,'today'),before[0],before[1],before[1]],before),false);
});
test('promotion admission handoff is fail closed against altered SHA, quota, version set, and historical deployments',()=>{
  assert.equal(validateAdmission(admission,{executionSha:EXECUTION_SHA,accountFingerprint:FINGERPRINT}),true);
  for(const changed of [
    {...admission,executionSha:'b'.repeat(40)},
    {...admission,candidateId:PROMOTION_CANDIDATE_VERSION_ID},
    {...admission,accountFingerprint:'b'.repeat(64)},
    {...admission,historyDigest:'invalid'},
    {...admission,versionIds:admission.versionIds.slice(1)},
    {...admission,retryAuthorized:true},
    {...admission,deployments:[after[0],before[1]]},
    {...admission,evidence:{...admission.evidence,d1Writes:1}},
    {...admission,topology:{...ZONE,routeCount:1}}
  ])assert.throws(()=>validateAdmission(changed,{executionSha:EXECUTION_SHA,accountFingerprint:FINGERPRINT}),/ADMISSION_HANDOFF_INVALID/);
});
test('one original safeguarded Cloudflare guard blocks wrong bodies, provider host, D1 and all but one POST',async()=>{
  const body=deploymentBody(EXECUTION_SHA),calls=[];
  const g=createPromotionGuardedFetch({accountId:ACCOUNT,readToken:'read',topologyToken:'zone',
    promotionToken:'write',expectedBody:body,fetchImpl:async(url,init)=>{calls.push({url,method:init.method});return {ok:true,status:200,json:async()=>({success:true,result:{id:NEW}})};}});
  const url='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/workers/scripts/teamsheet-api-football-shadow-collector/deployments';
  await assert.rejects(()=>g.fetch('https://v3.football.api-sports.io/fixtures',{method:'GET'}),/EGRESS_FORBIDDEN/);
  await assert.rejects(()=>g.fetch(url,{method:'POST',body:'wrong',headers:{Authorization:'Bearer write'}}),/BODY_FORBIDDEN/);
  await assert.rejects(()=>g.fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/d1/database/id/query',{method:'POST'}),/D1_FORBIDDEN/);
  await assert.rejects(()=>g.fetch(url,{method:'DELETE'}),/ENDPOINT_FORBIDDEN/);
  await g.fetch(url,{method:'POST',body,headers:{Authorization:'Bearer write'}});
  await assert.rejects(()=>g.fetch(url,{method:'POST',body,headers:{Authorization:'Bearer write'}}),/POST_CEILING_EXCEEDED/);
  assert.deepEqual(calls.map(x=>x.method),['POST']);
  assert.equal(g.counters.deploymentPostAttempts,1);
});
test('mutating executor never sends any network call without owner-gated identity and credentials',async()=>{
  let requests=0;
  const res=await executePromotion({env:{GITHUB_RUN_ATTEMPT:'2',GITHUB_REF:'refs/heads/main',
    GITHUB_SHA:EXECUTION_SHA,EXECUTION_SHA},fetchImpl:async()=>{requests++;throw Error('never');}});
  assert.equal(res.outcome,'NOT_SUBMITTED');assert.equal(res.deploymentPosts,0);assert.equal(res.retryAuthorized,false);assert.equal(requests,0);
  const forbidden=await executePromotion({env:{GITHUB_RUN_ATTEMPT:'1',GITHUB_REF:'refs/heads/main',
    GITHUB_SHA:EXECUTION_SHA,EXECUTION_SHA,API_FOOTBALL_API_KEY:'synthetic-secret'},fetchImpl:async()=>{requests++;}});
  assert.equal(forbidden.outcome,'NOT_SUBMITTED');assert.equal(requests,0);
});
test('final result demands a new inert Deployment and exact consumed D1 history',()=>{
  const state={deployments:after,versions:{versionIds:EXPECTED_IDS,identityExact:true,candidate:{}},
    report:{inventory:{deploymentCount:3,workersDev:false,previewUrls:false,cronCount:0,routeCount:0,customDomainCount:0},
      runtime:{collectionEnabled:0,credentialState:'AVAILABLE',activeLease:false},priorState:{requestAttempts:5}},
    detail:{totalMemberships:824},topology:ZONE};
  const execution=makeExecution({executionSha:EXECUTION_SHA,outcome:'CREATED',deploymentId:NEW,deploymentPosts:1});
  // Missing actual module evidence must NOT yield a false PASS.
  assert.equal(classifyPost({admission,state,execution}).ok,false);
  assert.equal(classifyPost({admission,state:{...state,deployments:before},execution}).ok,false);
  assert.equal(classifyPost({admission,state,execution:makeExecution({executionSha:EXECUTION_SHA,outcome:'NOT_SUBMITTED'})}).ok,false);
  assert.equal(classifyPost({admission,state:{...state,detail:{totalMemberships:823}},execution}).ok,false);
});
test('workflow is manual-only, exact current main and CI gated, four distinct jobs, two immutable artifacts, no prior dispatch',()=>{
  const yml=fs.readFileSync('.github/workflows/api-football-corrected-version-inert-deployment-promotion.yml','utf8');
  assert.match(yml,/^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(yml,/^\s+(schedule|push|pull_request):/m);
  for(const item of ['repository-gate:','fresh-readonly-admission:','protected-promotion:','independent-final-readonly:',
    'github.run_attempt == 1','data-steward-readonly','api-football-corrected-deployment-promotion',
    'dfac83bfc4bd67baa5dad7b59a8c51bc6f9d29ba474a0afe1c6513fa66629e43',
    QUALIFICATION_ARTIFACT_SHA256,QUALIFICATION_RUN,'run-id: 37841681952',
    'tests and deterministic build'.replace('tests','Tests'),
    'CORRECTED_PROMOTION_MODE: ADMISSION','CORRECTED_PROMOTION_MODE: FINAL',
    'if: always()','github.token','git ls-remote','deployment: false'])
    assert.ok(yml.includes(item),item);
  const noComments=yml.replace(/^\s*#.*$/gm,'');
  assert.doesNotMatch(noComments,/run-gate-c\.mjs|api-football-remediated-deployment-promotion\.yml|wrangler deploy|secrets\.API_FOOTBALL_API_KEY|method: 'POST'/);
  assert.match(yml,/name: corrected-promotion-final-proof/);
  assert.match(yml,/if: steps\.final\.outcome != 'success'/);
  assert.match(yml,/CORRECTED_PROMOTION_EXECUTION_REPORT_PATH: \$\{\{ runner.temp \}\}\/corrected-promotion-execution.json/);
  assert.match(yml,/path: \$\{\{ runner.temp \}\}\/corrected-promotion-execution.json/);
});
