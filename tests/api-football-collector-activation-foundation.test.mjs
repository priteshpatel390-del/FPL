import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {classifyCollectorActivationPreflight,COLLECTOR_ACTIVATION_PREFLIGHT_READY,COLLECTOR_ACTIVATION_PREFLIGHT_VERSION} from '../workers/api-football-collector/activation-preflight.mjs';
import {classifyPriorAttempt,DISCOVERY_MAX_D1_ROWS_WRITTEN,DISCOVERY_MAX_D1_STATEMENTS,DISCOVERY_MAX_FIXTURE_ROWS_WRITTEN,DISCOVERY_MAX_FIXTURE_STATEMENTS,enforceGenerationCeiling,runOneShotDiscoveryGeneration} from '../workers/api-football-collector/activation-orchestrator.mjs';
import {validateDiscoveryPayload,validateKnownFixturePayload} from '../workers/api-football-collector/semantic-validation.mjs';
import {API_FOOTBALL_ATTENDED_DISCOVERY_ACTIVATION,API_FOOTBALL_MAX_DISCOVERY_GENERATION_ROWS,requestAttemptIdentity,validateRuntimeActivation} from '../workers/api-football-collector/runtime-contracts.mjs';
import {requestPlanForOpportunity} from '../workers/api-football-collector/planner-orchestrator.mjs';
import {discoveryOpportunity} from '../workers/api-football-collector/scheduler.mjs';
import {executeReservedRequest} from '../workers/api-football-collector/collector.mjs';

const root=path.resolve(import.meta.dirname,'..');
const NOW='2026-09-21T12:00:00.000Z';
const providerIds=Array.from({length:20},(_,index)=>String(500+index));
const mappings=providerIds.map((providerEntityId,index)=>({provider:'api-football',entityType:'team',providerEntityId,canonicalFplId:`2026-27:fpl:team:${index+1}`,mappingRevision:'qualified',revision:1,status:'VERIFIED',season:'2026-27',method:'manually_verified',provenance:'synthetic-owner-qualified'}));

function requests(){return requestPlanForOpportunity(discoveryOpportunity(NOW)).requests;}
function payload(request,{league=request.search.league,season=request.search.season,paging={current:1,total:1},fixtureId=9000+Number(request.search.league),home=providerIds[0],away=providerIds[1]}={}){
  return {get:'fixtures',parameters:{league:String(league),season:String(season)},errors:[],results:1,paging,response:[{fixture:{id:fixtureId,date:'2026-10-01T19:00:00Z',status:{short:'NS'}},league:{id:Number(request.search.league),season:2026},teams:{home:{id:Number(home)},away:{id:Number(away)}}}]};
}
function knownRequest(){const logicalRequestId='FINALITY:9001:2026-09-21T12:00:00.000Z';return {logicalRequestId,attemptId:requestAttemptIdentity(logicalRequestId,1),attemptNumber:1,operationClass:'FINALITY',endpoint:'fixtures',endpointClass:'fixture',search:{id:'9001'},requiresAuthority:true};}
function knownPayload(overrides={}){return {get:'fixtures',parameters:{id:'9001'},errors:[],results:1,paging:{current:1,total:1},response:[{fixture:{id:9001,date:'2026-10-01T19:00:00Z',status:{short:'NS'}},league:{id:39,season:2026},teams:{home:{id:500},away:{id:501}},...overrides}]};}
function responseFor(body){const text=JSON.stringify(body);return new Response(text,{status:200,headers:{'content-length':String(Buffer.byteLength(text)),'x-ratelimit-requests-limit':'7500','x-ratelimit-requests-remaining':'7499','x-ratelimit-limit':'300','x-ratelimit-remaining':'299'}});}

class ExecutionDb{
  constructor(){this.completions=[];}
  prepare(sql){const statement={sql,args:[],bind(...args){this.args=args;return this;},first:async()=>{
    if(sql.includes('FROM ingestion_runs'))return {run_id:'official-run',completed_at:NOW,status:'completed'};
    if(sql.includes('api_football_runtime_state'))return {provider:'api-football',collection_enabled:1,credential_state:'AVAILABLE',quota_state:'KNOWN',quota_utc_day:'2026-09-21',daily_attempt_count:0,in_flight_attempt_id:null,in_flight_lease_expires_at:null,earliest_next_request_at:null};
    return null;
  },all:async()=>({results:Array.from({length:20},(_,index)=>({subject_entity_id:`2026-27:fpl:team:${index+1}`,observation_id:`observation-${index}`,input_revision:`revision-${index}`,logical_key:`official-fpl|2026-27|team|${index+1}|present`}))})};return statement;}
  async batch(statements){
    const completion=statements.find(statement=>statement.sql.startsWith('UPDATE api_football_request_attempts SET completed_at='));
    if(completion)this.completions.push(completion.args[1]);
    return statements.map(()=>({meta:{changes:1}}));
  }
}

test('future execution activation is named but shipped Wrangler cannot reach it',()=>{
  assert.equal(validateRuntimeActivation({EIA_2I5D_ACTIVATION:API_FOOTBALL_ATTENDED_DISCOVERY_ACTIVATION}).mode,'attended_one_shot_discovery');
  const config=JSON.parse(fs.readFileSync(path.join(root,'workers/api-football-collector/wrangler.jsonc'),'utf8'));
  assert.equal(config.vars.EIA_2I5D_ACTIVATION,'REPOSITORY_ONLY_BLOCKED');assert.deepEqual(config.triggers.crons,[]);
  assert.equal(config.d1_databases[0].database_id,'00000000-0000-0000-0000-000000000000');assert.notEqual(config.vars.EIA_2I5D_ACTIVATION,API_FOOTBALL_ATTENDED_DISCOVERY_ACTIVATION);
});

for(const [name,change,reason] of [
  ['wrong echoed league',request=>({league:'999'}),'response_parameters_mismatch'],
  ['wrong season',request=>({season:2025}),'response_parameters_mismatch'],
  ['paging greater than one',request=>({paging:{current:1,total:2}}),'pagination_unsupported'],
  ['malformed fixture identity',request=>({home:'0'}),'fixture_identity_invalid']
])test(`HTTP 200 semantic validation rejects ${name} before success`,()=>{
  const request=requests()[0],result=validateDiscoveryPayload(payload(request,change(request)),request,{fetchedAt:NOW,teamMappings:mappings});
  assert.equal(result.ok,false);assert.equal(result.reason,reason);
});

test('discovery semantic validation requires current qualified mapping',()=>{
  const request=requests()[0];assert.equal(validateDiscoveryPayload(payload(request),request,{fetchedAt:NOW,teamMappings:[]}).reason,'qualified_mapping_unavailable');
  assert.equal(validateDiscoveryPayload(payload(request),request,{fetchedAt:NOW,teamMappings:mappings}).ok,true);
});

test('known fixture validation pins exact requested fixture identity',()=>{
  const request=knownRequest();assert.equal(validateKnownFixturePayload(knownPayload(),request).ok,true);
  const wrong=knownPayload();wrong.response[0].fixture.id=9002;assert.equal(validateKnownFixturePayload(wrong,request).reason,'fixture_identity_invalid');
});

test('attempt success becomes durable only after semantic validation and persistence',async()=>{
  const request=knownRequest();
  for(const [persistValidated,expectedReason,expectedCompletion] of [
    [async()=>({ok:false}),'persistence_uncertain',undefined],
    [async()=>({ok:true,result:'normalized'}),undefined,'SUCCEEDED']
  ]){
    const db=new ExecutionDb(),order=[];
    const result=await executeReservedRequest({env:{TEAMSHEET_DATA_DB:db,API_FOOTBALL_API_KEY:'synthetic-only'},request,fetchImpl:async()=>responseFor(knownPayload()),now:()=>NOW,maxResponseBytes:720896,timeoutSignal:()=>new AbortController().signal,persistValidated:async input=>{order.push('persist');const persisted=await persistValidated(input);return persisted;}});
    if(expectedReason)assert.equal(result.reason,expectedReason);else assert.equal(result.ok,true);
    if(db.completions.length)order.push('complete');assert.equal(db.completions[0],expectedCompletion);assert.deepEqual(order,expectedCompletion?['persist','complete']:['persist']);
  }
  const db=new ExecutionDb(),wrong=knownPayload();wrong.response[0].fixture.id=9002;
  let persistenceCalls=0;const result=await executeReservedRequest({env:{TEAMSHEET_DATA_DB:db,API_FOOTBALL_API_KEY:'synthetic-only'},request,fetchImpl:async()=>responseFor(wrong),now:()=>NOW,maxResponseBytes:720896,timeoutSignal:()=>new AbortController().signal,persistValidated:async()=>{persistenceCalls++;return {ok:true};}});
  assert.equal(result.reason,'fixture_identity_invalid');assert.equal(persistenceCalls,0);assert.deepEqual(db.completions,['SCHEMA_FAILURE']);
});

test('generation ceiling and worst-case write exposure are deterministic',()=>{
  assert.equal(API_FOOTBALL_MAX_DISCOVERY_GENERATION_ROWS,2500);assert.equal(enforceGenerationCeiling(2499,1).ok,true);
  assert.equal(enforceGenerationCeiling(2500,1).reason,'generation_row_ceiling_exceeded');
  assert.equal(DISCOVERY_MAX_FIXTURE_STATEMENTS,10000);assert.equal(DISCOVERY_MAX_D1_STATEMENTS,10024);
  assert.equal(DISCOVERY_MAX_FIXTURE_ROWS_WRITTEN,7500);assert.equal(DISCOVERY_MAX_D1_ROWS_WRITTEN,7524);
});

test('prior-attempt state is zero-retry and expired reservation remains consumed',()=>{
  assert.equal(classifyPriorAttempt(null,{now:NOW}).action,'RESERVE_FIRST_ATTEMPT');
  assert.equal(classifyPriorAttempt({attempt_number:1,outcome:'SUCCEEDED'},{now:NOW}).reason,'succeeded_attempt_requires_reconciliation');
  assert.equal(classifyPriorAttempt({attempt_number:1,outcome:'RESERVED',lease_expires_at:'2026-09-21T12:00:30Z'},{now:NOW}).reason,'request_lease_busy');
  assert.equal(classifyPriorAttempt({attempt_number:1,outcome:'RESERVED',lease_expires_at:'2026-09-21T11:59:59Z'},{now:NOW}).reason,'expired_reservation_consumed');
  for(const outcome of ['TIMEOUT','TRANSPORT_UNKNOWN','AUTH_FAILURE','QUOTA_BLOCKED','SCHEMA_FAILURE','HTTP_FAILURE'])assert.equal(classifyPriorAttempt({attempt_number:1,outcome},{now:NOW}).reason,'prior_attempt_consumed');
});

class MemoryRepository{
  constructor({prior=new Map(),failPersistenceAt=null}={}){this.prior=prior;this.failPersistenceAt=failPersistenceAt;this.generations=[];this.head='previous';this.revisions=new Map();this.attempts=[];}
  async createStaging(){this.generations.push({id:'generation:new',state:'STAGING',links:[]});return {ok:true,generationId:'generation:new'};}
  async readAttempt(id){return this.prior.get(id)||null;}
  async reserve(request){this.attempts.push({id:request.attemptId,outcome:'RESERVED'});return {ok:true};}
  async completeFailure(request,completion){const row=this.attempts.find(item=>item.id===request.attemptId);if(row)row.outcome=completion.outcome;}
  async persistValidated(request,generationId,fixtures){
    if(String(request.search.league)===String(this.failPersistenceAt))return {ok:false};
    const generation=this.generations.at(-1);
    for(const fixture of fixtures){const hash=JSON.stringify([fixture.providerFixtureId,fixture.canonicalKickoff,fixture.statusObservation.value]);const prior=this.revisions.get(fixture.identity);if(prior?.hash!==hash)this.revisions.set(fixture.identity,{hash,revision:(prior?.revision||0)+1,supersedes:prior?.revision||null});generation.links.push(fixture.identity);}
    this.attempts.find(item=>item.id===request.attemptId).outcome='SUCCEEDED';return {ok:true};
  }
  async failGeneration(id,reason){const row=this.generations.find(item=>item.id===id);row.state='FAILED';row.reason=reason;return {ok:true};}
  async commitGeneration(id){const row=this.generations.find(item=>item.id===id);row.state='COMMITTED';this.head=id;return {ok:true};}
}
function successfulExecute(request){const valid=validateDiscoveryPayload(payload(request),request,{fetchedAt:NOW,teamMappings:mappings});return Promise.resolve(valid.ok?{...valid,completion:{outcome:'SUCCEEDED'}}:valid);}

test('five exact successes commit one generation and advance head',async()=>{
  const repository=new MemoryRepository(),result=await runOneShotDiscoveryGeneration({requests:requests(),repository,execute:successfulExecute,now:NOW});
  assert.equal(result.ok,true);assert.equal(result.attempts,5);assert.equal(repository.generations.length,1);assert.equal(repository.generations[0].state,'COMMITTED');assert.equal(repository.head,'generation:new');assert.equal(repository.attempts.every(row=>row.outcome==='SUCCEEDED'),true);
});

test('one semantic failure leaves partial generation non-current and preserves previous head',async()=>{
  const repository=new MemoryRepository();let calls=0;
  const result=await runOneShotDiscoveryGeneration({requests:requests(),repository,now:NOW,execute:async request=>{calls++;return calls===3?{ok:false,reason:'provider_schema_invalid',completion:{outcome:'SCHEMA_FAILURE'}}:successfulExecute(request);}});
  assert.equal(result.ok,false);assert.equal(repository.generations[0].state,'FAILED');assert.equal(repository.head,'previous');assert.equal(calls,3);assert.equal(repository.attempts.at(-1).outcome,'SCHEMA_FAILURE');
});

test('persistence failure is never mislabeled successful and leaves head unchanged',async()=>{
  const repository=new MemoryRepository({failPersistenceAt:'848'}),result=await runOneShotDiscoveryGeneration({requests:requests(),repository,execute:successfulExecute,now:NOW});
  assert.equal(result.reason,'persistence_uncertain');assert.equal(repository.generations[0].state,'FAILED');assert.equal(repository.head,'previous');assert.equal(repository.attempts.at(-1).outcome,'RESERVED');
});

test('duplicate logical request is not reissued and active or stale reservation prevents egress',async()=>{
  for(const [attempt,reason] of [[{attempt_number:1,outcome:'RESERVED',lease_expires_at:'2026-09-21T12:00:30Z'},'request_lease_busy'],[{attempt_number:1,outcome:'RESERVED',lease_expires_at:'2026-09-21T11:00:00Z'},'expired_reservation_consumed']]){
    const first=requests()[0],repository=new MemoryRepository({prior:new Map([[first.attemptId,attempt]])});let calls=0;
    const result=await runOneShotDiscoveryGeneration({requests:requests(),repository,execute:async()=>{calls++;return {ok:true,fixtures:[]};},now:NOW});
    assert.equal(result.reason,reason);assert.equal(calls,0);assert.equal(repository.head,'previous');
  }
});

test('unchanged fixture does not add history; changed fixture immutably supersedes',async()=>{
  const repository=new MemoryRepository(),request=requests()[0],first=await successfulExecute(request);
  await repository.createStaging();await repository.reserve(request);await repository.persistValidated(request,'generation:new',first.fixtures);
  const identity=first.fixtures[0].identity;assert.equal(repository.revisions.get(identity).revision,1);
  await repository.persistValidated(request,'generation:new',first.fixtures);assert.equal(repository.revisions.get(identity).revision,1);
  const changed=structuredClone(first.fixtures);changed[0].statusObservation.value='FT';await repository.persistValidated(request,'generation:new',changed);
  assert.deepEqual(repository.revisions.get(identity),{hash:JSON.stringify([changed[0].providerFixtureId,changed[0].canonicalKickoff,'FT']),revision:2,supersedes:1});
});

function preflightEvidence(){return {version:COLLECTOR_ACTIVATION_PREFLIGHT_VERSION,migrations:[[1,'shadow_data_foundation'],[2,'official_fpl_structured_history'],[3,'production_query_plan_indexes'],[4,'api_football_shadow_identity'],[5,'api_football_shadow_runtime'],[6,'api_football_mapping_qualification']],foreignKeyViolations:0,authority:{season:'2026-27',sourceKey:'official-fpl',sourceRevisionId:'official-fpl-r1',runStatus:'completed',fetchedAt:NOW,digest:'a'.repeat(64),teamIds:Array.from({length:20},(_,index)=>`2026-27:fpl:team:${index+1}`)},mapping:{state:'COMMITTED',isCurrentHead:true,mappingCount:20,memberCount:20,distinctProviderIds:20,distinctFplIds:20,authorityDigest:'a'.repeat(64)},runtime:{provider:'api-football',collectionEnabled:0,credentialState:'UNPROVISIONED',inFlightAttemptId:null,inFlightLeaseExpiresAt:null},inventory:{activation:'REPOSITORY_ONLY_BLOCKED',cronCount:0,workersDev:false,previewUrls:false,databaseIdPlaceholder:true,secretBindingPresent:false},counts:{requestAttempts:0,generations:0,fixtureRevisions:0},modelUiImportCount:0};}
test('collector activation preflight admits only exact post-0006 disabled state',()=>{
  assert.equal(classifyCollectorActivationPreflight(preflightEvidence(),{now:NOW}).classification,COLLECTOR_ACTIVATION_PREFLIGHT_READY);
  for(const mutate of [e=>e.migrations.pop(),e=>e.foreignKeyViolations=1,e=>e.mapping.memberCount=19,e=>e.runtime.collectionEnabled=1,e=>e.runtime.inFlightAttemptId='active',e=>e.inventory.cronCount=1,e=>e.modelUiImportCount=1]){const evidence=preflightEvidence();mutate(evidence);assert.equal(classifyCollectorActivationPreflight(evidence,{now:NOW}).classification,'STOP_REVIEW_REQUIRED');}
});
