import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {
  classifyCollectorActivationPreflight,COLLECTOR_ACTIVATION_PREFLIGHT_VERSION,COLLECTOR_ATTENDED_STAGE_READY,
  COLLECTOR_PREFLIGHT_ATTENDED_STAGE,COLLECTOR_PREFLIGHT_REPOSITORY_STAGE,COLLECTOR_REPOSITORY_STAGE_READY
} from '../workers/api-football-collector/activation-preflight.mjs';
import {
  classifyPriorAttempt,DISCOVERY_MAX_CHUNK_JSON_BYTES,DISCOVERY_MAX_CONTROL_ROWS_WRITTEN,
  DISCOVERY_MAX_D1_ROWS_WRITTEN,DISCOVERY_MAX_D1_STATEMENTS,DISCOVERY_MAX_FIXTURE_ROWS_WRITTEN,
  DISCOVERY_MAX_FIXTURE_STATEMENTS,DISCOVERY_MAX_MUTATION_STATEMENTS,DISCOVERY_PERSISTENCE_CHUNK_ROWS,
  enforceGenerationCeiling,runOneShotDiscoveryGeneration
} from '../workers/api-football-collector/activation-orchestrator.mjs';
import {createD1CollectorRepository} from '../workers/api-football-collector/d1-persistence.mjs';
import {executeProviderTransport,runScheduledCollector} from '../workers/api-football-collector/collector.mjs';
import {validateDiscoveryPayload,validateKnownFixturePayload,validateProviderPayload} from '../workers/api-football-collector/semantic-validation.mjs';
import {API_FOOTBALL_ATTENDED_DISCOVERY_ACTIVATION,API_FOOTBALL_MAX_DISCOVERY_GENERATION_ROWS,requestAttemptIdentity,validateRuntimeActivation} from '../workers/api-football-collector/runtime-contracts.mjs';
import {requestPlanForOpportunity} from '../workers/api-football-collector/planner-orchestrator.mjs';
import {discoveryOpportunity} from '../workers/api-football-collector/scheduler.mjs';

const root=path.resolve(import.meta.dirname,'..');
const NOW='2026-09-21T12:00:00.000Z';
const providerIds=Array.from({length:20},(_,index)=>String(500+index));
const mappings=providerIds.map((providerEntityId,index)=>({provider:'api-football',entityType:'team',providerEntityId,canonicalFplId:`2026-27:fpl:team:${index+1}`,mappingRevision:'qualified',revision:1,status:'VERIFIED',season:'2026-27',method:'manually_verified',provenance:'synthetic-owner-qualified'}));
const authority={season:'2026-27',sourceKey:'official-fpl',sourceRevisionId:'official-fpl-r1',runId:'official-run',runStatus:'completed',fetchedAt:NOW,digest:'a'.repeat(64),teamIds:Array.from({length:20},(_,index)=>`2026-27:fpl:team:${index+1}`)};

function requests(at=NOW){return requestPlanForOpportunity(discoveryOpportunity(at)).requests;}
function payload(request,{league=request.search.league,season=request.search.season,paging={current:1,total:1},count=1,status='NS',invalid={}}={}){
  const leagueNumber=Number(request.search.league);
  const response=Array.from({length:count},(_,index)=>({
    fixture:{id:leagueNumber*100_000+index+1,date:'2026-10-01T19:00:00Z',status:{short:status}},
    league:{id:leagueNumber,season:2026},teams:{home:{id:500},away:{id:501}},...structuredClone(invalid)
  }));
  return {get:'fixtures',parameters:{league:String(league),season:String(season)},errors:[],results:response.length,paging,response};
}
function knownRequest(){const logicalRequestId='FINALITY:9001:2026-09-21T12:00:00.000Z';return {logicalRequestId,attemptId:requestAttemptIdentity(logicalRequestId,1),attemptNumber:1,operationClass:'FINALITY',endpoint:'fixtures',endpointClass:'fixture',search:{id:'9001'},requiresAuthority:true};}
function knownPayload({league=2,season=2026,fixtureId=9001,status='NS',date='2026-10-01T19:00:00Z',teams={home:{id:500},away:{id:501}}}={}){return {get:'fixtures',parameters:{id:'9001'},errors:[],results:1,paging:{current:1,total:1},response:[{fixture:{id:fixtureId,date,status:{short:status}},league:{id:league,season},teams}]};}
function responseFor(body,status=200){const text=JSON.stringify(body);return new Response(text,{status,headers:{'content-length':String(Buffer.byteLength(text)),'x-ratelimit-requests-limit':'7500','x-ratelimit-requests-remaining':'7499','x-ratelimit-limit':'300','x-ratelimit-remaining':'299'}});}
function statement(sql){return {sql,args:[],bind(...args){this.args=args;return this;},first(){return null;},all(){return {results:[]};}};}

class DeterministicD1{
  constructor({failCompletionAt=0,failCommit=false}={}){
    this.failCompletionAt=failCompletionAt;this.failCommit=failCommit;this.completionCalls=0;
    this.runtime={provider:'api-football',collection_enabled:1,credential_state:'AVAILABLE',quota_state:'KNOWN',quota_utc_day:'2026-09-21',daily_attempt_count:0,in_flight_attempt_id:null,in_flight_lease_expires_at:null,earliest_next_request_at:null};
    this.runs=new Map();this.generations=new Map();this.attempts=new Map();this.identities=new Map();this.revisions=new Map();this.memberships=new Map();this.head=null;this.batches=[];
  }
  prepare(sql){const row=statement(sql);row.first=async()=>{
    if(sql==='SELECT * FROM api_football_runtime_state WHERE provider=?')return {...this.runtime};
    if(sql.startsWith('SELECT g.generation_id,g.state')){const generation=this.generations.get(row.args[0]),run=this.runs.get(generation?.ingestion_run_id);return generation?{...generation,fpl_season:'2026-27',provider_season:2026,source_revision_id:'api-football:eia-2i5a:1',official_fpl_authority_digest:authority.digest,official_fpl_authority_run_id:authority.runId,run_status:run?.status,run_source_revision_id:'api-football:eia-2i5a:1'}:null;}
    if(sql.startsWith('SELECT a.attempt_id')){
      const attempt=this.attempts.get(row.args[0])||{};
      return {
        attempt_id:attempt.attempt_id??null,attempt_number:attempt.attempt_number??null,outcome:attempt.outcome??null,
        lease_expires_at:attempt.lease_expires_at??null,completed_at:attempt.completed_at??null,
        runtime_provider:this.runtime.provider,runtime_collection_enabled:this.runtime.collection_enabled,
        runtime_credential_state:this.runtime.credential_state,runtime_quota_state:this.runtime.quota_state,
        runtime_quota_utc_day:this.runtime.quota_utc_day,runtime_daily_attempt_count:this.runtime.daily_attempt_count,
        runtime_in_flight_attempt_id:this.runtime.in_flight_attempt_id,runtime_in_flight_lease_expires_at:this.runtime.in_flight_lease_expires_at,
        runtime_earliest_next_request_at:this.runtime.earliest_next_request_at,runtime_observed_daily_limit:this.runtime.observed_daily_limit??null,
        runtime_observed_daily_remaining:this.runtime.observed_daily_remaining??null,runtime_observed_minute_limit:this.runtime.observed_minute_limit??null,
        runtime_observed_minute_remaining:this.runtime.observed_minute_remaining??null,runtime_quota_observed_at:this.runtime.quota_observed_at??null
      };
    }
    return null;
  };return row;}
  async batch(statements){
    if(this.failCommit&&statements.some(item=>item.sql.startsWith("UPDATE api_football_discovery_generations SET state='COMMITTED'")))throw new Error('synthetic commit failure');
    if(statements.some(item=>item.sql.startsWith('UPDATE api_football_request_attempts SET completed_at='))){this.completionCalls+=1;if(this.completionCalls===this.failCompletionAt)throw new Error('synthetic completion failure');}
    this.batches.push(statements.map(item=>item.sql));const results=[];
    for(const item of statements){let changes=0;const {sql,args}=item;
      if(sql.startsWith('INSERT INTO ingestion_runs')){if(!this.runs.has(args[0])){this.runs.set(args[0],{run_id:args[0],status:'started'});changes=1;}}
      else if(sql.startsWith('INSERT INTO api_football_discovery_generations')){if(!this.generations.has(args[0])){this.generations.set(args[0],{generation_id:args[0],logical_opportunity:args[1],state:'STAGING',ingestion_run_id:args[3]});changes=1;}}
      else if(sql.startsWith('UPDATE api_football_runtime_state SET quota_utc_day=')){if(!this.runtime.in_flight_attempt_id){this.runtime.quota_utc_day=args[0];this.runtime.daily_attempt_count=args[1];this.runtime.in_flight_attempt_id=args[8];this.runtime.in_flight_lease_expires_at=args[9];changes=1;}}
      else if(sql.startsWith('INSERT INTO api_football_request_attempts')){if(this.runtime.in_flight_attempt_id===args[0]&&!this.attempts.has(args[0])){this.attempts.set(args[0],{attempt_id:args[0],logical_request_id:args[1],attempt_number:args[2],operation_class:args[3],endpoint_class:args[4],generation_id:args[5],lease_expires_at:args[10],outcome:'RESERVED'});changes=1;}}
      else if(sql.startsWith('INSERT INTO provider_fixture_identities')){for(const value of JSON.parse(args[0])){const prior=this.identities.get(value.providerFixtureIdentity);if(!prior||['providerFixtureId','fplSeason','canonicalCompetitionId','providerLeagueId','providerHomeTeamId','providerAwayTeamId'].every(key=>prior[key]===value[key])){this.identities.set(value.providerFixtureIdentity,value);changes+=1;}}}
      else if(sql.startsWith('INSERT INTO api_football_fixture_revisions')){for(const value of JSON.parse(args[2])){const key=`${value.providerFixtureIdentity}|${value.inputHash}`;if(!this.revisions.has(key)){const previous=[...this.revisions.values()].filter(row=>row.providerFixtureIdentity===value.providerFixtureIdentity).at(-1);this.revisions.set(key,{...value,supersedesRevisionId:previous?.fixtureRevisionId||null});changes+=1;}}}
      else if(sql.startsWith('INSERT INTO api_football_generation_fixtures')){for(const value of JSON.parse(args[1])){const revision=this.revisions.get(`${value.providerFixtureIdentity}|${value.inputHash}`);if(!revision)throw new Error('missing revision');this.memberships.set(`${args[0]}|${value.providerFixtureIdentity}`,revision.fixtureRevisionId);changes+=1;}}
      else if(sql.startsWith('UPDATE api_football_request_attempts SET completed_at=')){const attempt=this.attempts.get(args[9]);if(attempt&&attempt.outcome==='RESERVED'){attempt.outcome=args[1];attempt.completed_at=args[0];changes=1;}}
      else if(sql.startsWith("UPDATE api_football_runtime_state SET collection_enabled=")){const attemptId=args.at(-1);if(this.runtime.in_flight_attempt_id===attemptId){this.runtime.in_flight_attempt_id=null;this.runtime.in_flight_lease_expires_at=null;this.runtime.quota_state=args[3];this.runtime.earliest_next_request_at=args[9];if(args[0]==='AUTH_FAILURE'){this.runtime.collection_enabled=0;this.runtime.credential_state='INVALID';}changes=1;}}
      else if(sql.startsWith("UPDATE api_football_discovery_generations SET state='FAILED'")){const generation=this.generations.get(args[2]);if(generation?.state==='STAGING'){generation.state='FAILED';generation.failure_class=args[0];changes=1;}}
      else if(sql.startsWith("UPDATE ingestion_runs SET status='failed'")){const run=this.runs.get(args[2]);if(run?.status==='started'){run.status='failed';changes=1;}}
      else if(sql.startsWith("UPDATE api_football_discovery_generations SET state='COMMITTED'")){const generation=this.generations.get(args[4]);const succeeded=[...this.attempts.values()].filter(row=>row.generation_id===args[4]&&row.outcome==='SUCCEEDED').length;const memberCount=[...this.memberships.keys()].filter(key=>key.startsWith(`${args[4]}|`)).length;if(generation?.state==='STAGING'&&succeeded===5&&memberCount===args.at(-1)){generation.state='COMMITTED';generation.fixture_count=memberCount;changes=1;}}
      else if(sql.startsWith("UPDATE ingestion_runs SET status='completed'")){const run=this.runs.get(args[3]),generation=this.generations.get(args[4]);if(run?.status==='started'&&generation?.state==='COMMITTED'){run.status='completed';changes=1;}}
      else if(sql.startsWith('INSERT INTO api_football_discovery_heads')){if(this.generations.get(args[1])?.state==='COMMITTED'){this.head=args[1];changes=1;}}
      results.push({success:true,meta:{changes}});
    }
    return results;
  }
}

function clock(start=NOW){let tick=0;return()=>new Date(Date.parse(start)+tick++*1_000).toISOString();}
function concreteComposition({db=new DeterministicD1(),rows=1,failureAt=0,at=NOW,status='NS'}={}){
  const planRequests=requests(at);let fetches=0;
  const repository=createD1CollectorRepository(db,{authority});
  const transport=request=>executeProviderTransport({env:{API_FOOTBALL_API_KEY:'synthetic-only'},request,fetchImpl:async()=>{fetches+=1;const index=planRequests.indexOf(request)+1,count=Array.isArray(rows)?rows[index-1]:rows;return responseFor(index===failureAt?{bad:true}:payload(request,{count,status}));},now:clock(at),timeoutSignal:()=>new AbortController().signal});
  const validate=(body,request,fetchedAt)=>validateProviderPayload(body,request,{fetchedAt,teamMappings:mappings});
  return {db,repository,transport,validate,requests:planRequests,fetches:()=>fetches};
}

async function runConcrete(options={}){const composition=concreteComposition(options),at=options.at||NOW;const result=await runOneShotDiscoveryGeneration({...composition,now:at,clock:clock(at),sleep:async()=>{}});return {...composition,result};}

test('future execution activation remains named but shipped Wrangler cannot reach it',()=>{
  assert.equal(validateRuntimeActivation({EIA_2I5D_ACTIVATION:API_FOOTBALL_ATTENDED_DISCOVERY_ACTIVATION}).mode,'attended_one_shot_discovery');
  const config=JSON.parse(fs.readFileSync(path.join(root,'workers/api-football-collector/wrangler.jsonc'),'utf8'));
  assert.equal(config.vars.EIA_2I5D_ACTIVATION,'REPOSITORY_ONLY_BLOCKED');assert.deepEqual(config.triggers.crons,[]);assert.equal(config.d1_databases[0].database_id,'00000000-0000-0000-0000-000000000000');
});

test('blocked scheduled mode touches neither D1, dependency factory nor credential',async()=>{
  let reads=0,factoryCalls=0,keyReads=0;const env={EIA_2I5D_ACTIVATION:'REPOSITORY_ONLY_BLOCKED',TEAMSHEET_DATA_DB:{prepare(){reads+=1;}},get API_FOOTBALL_API_KEY(){keyReads+=1;return 'never';}};
  const result=await runScheduledCollector({controller:{scheduledTime:Date.parse(NOW)},env,dependencyFactory:()=>{factoryCalls+=1;}});
  assert.equal(result.reason,'runtime_activation_not_approved');assert.deepEqual({reads,factoryCalls,keyReads},{reads:0,factoryCalls:0,keyReads:0});
});

test('planner-only scheduled mode reads planner storage but never dependency factory or credential',async()=>{
  let plannerReads=0,factoryCalls=0,keyReads=0;const env={EIA_2I5D_ACTIVATION:'PRELIVE_PLANNER_ONLY',TEAMSHEET_DATA_DB:{},get API_FOOTBALL_API_KEY(){keyReads+=1;return 'never';}};
  const planner=async db=>{assert.equal(db,env.TEAMSHEET_DATA_DB);plannerReads+=1;return {ok:true,requestCount:5,mappingCoverageCount:20,requests:requests(),blockedOperations:[],deferredOperations:[]};};
  const result=await runScheduledCollector({controller:{scheduledTime:Date.parse(NOW)},env,planner,dependencyFactory:()=>{factoryCalls+=1;}});
  assert.equal(result.reason,'provider_execution_not_approved');assert.deepEqual({plannerReads,factoryCalls,keyReads},{plannerReads:1,factoryCalls:0,keyReads:0});
});

test('attended runtime kill switch blocks before any staging mutation',async()=>{
  const db=new DeterministicD1();db.runtime.collection_enabled=0;
  const run=await runConcrete({db});
  assert.equal(run.result.reason,'collection_disabled');assert.equal(run.fetches(),0);
  assert.equal(db.runs.size,0);assert.equal(db.generations.size,0);assert.equal(db.attempts.size,0);assert.equal(db.batches.length,0);
});

for(const [name,change,reason] of [
  ['wrong echoed league',request=>({league:'999'}),'response_parameters_mismatch'],['wrong season',request=>({season:2025}),'response_parameters_mismatch'],
  ['paging greater than one',request=>({paging:{current:1,total:2}}),'pagination_unsupported'],['malformed fixture identity',request=>({invalid:{teams:{home:{id:0},away:{id:501}}}}),'fixture_identity_invalid']
])test(`HTTP 200 discovery validation rejects ${name}`,()=>{const request=requests()[0],result=validateDiscoveryPayload(payload(request,change(request)),request,{fetchedAt:NOW,teamMappings:mappings});assert.equal(result.reason,reason);});

test('known fixture validation requires approved competition and returns durable normalized shape only',()=>{
  const request=knownRequest(),context={fetchedAt:NOW,teamMappings:mappings};
  assert.equal(validateKnownFixturePayload(knownPayload({league:39}),request,context).reason,'competition_identity_invalid');
  assert.equal(validateKnownFixturePayload(knownPayload({season:2025}),request,context).reason,'competition_identity_invalid');
  assert.equal(validateKnownFixturePayload(knownPayload({teams:{home:{id:500},away:{id:501},third:{id:502}}}),request,context).reason,'fixture_identity_invalid');
  assert.equal(validateKnownFixturePayload(knownPayload({status:'BAD'}),request,context).reason,'fixture_schema_invalid');
  assert.equal(validateKnownFixturePayload(knownPayload({date:'bad'}),request,context).reason,'fixture_schema_invalid');
  const result=validateKnownFixturePayload(knownPayload(),request,context);assert.equal(result.ok,true);assert.equal(result.fixtures.length,1);
  assert.deepEqual(Object.keys(result.fixtures[0]).sort(),['canonicalCompetitionId','extraTimeState','fetchedAt','fplSeason','mappingProvenance','providerFixtureId','providerFixtureIdentity','providerHomeTeamId','providerKickoff','providerLeagueId','providerAwayTeamId','providerStatus','qualificationState','sourceRevisionId'].sort());
  assert.equal(JSON.stringify(result).includes('"teams"'),false);assert.equal(JSON.stringify(result).includes('"league"'),false);assert.equal(JSON.stringify(result).includes('winner'),false);
});

test('provider errors must be empty for discovery and known-fixture payloads',()=>{
  const discoveryRequest=requests()[0],discovery=payload(discoveryRequest);discovery.errors=['provider warning'];
  assert.equal(validateDiscoveryPayload(discovery,discoveryRequest,{fetchedAt:NOW,teamMappings:mappings}).reason,'provider_schema_invalid');
  const known=knownPayload();known.errors={rate:'provider warning'};
  assert.equal(validateKnownFixturePayload(known,knownRequest(),{fetchedAt:NOW,teamMappings:mappings}).reason,'provider_schema_invalid');
});

test('generation ceiling and concrete D1 exposure are pinned to bulk implementation',()=>{
  assert.equal(API_FOOTBALL_MAX_DISCOVERY_GENERATION_ROWS,2500);assert.equal(enforceGenerationCeiling(2499,1).ok,true);assert.equal(enforceGenerationCeiling(2500,1).reason,'generation_row_ceiling_exceeded');
  assert.equal(DISCOVERY_PERSISTENCE_CHUNK_ROWS,1250);assert.equal(DISCOVERY_MAX_CHUNK_JSON_BYTES,1_500_000);assert.equal(DISCOVERY_MAX_FIXTURE_STATEMENTS,18);
  assert.equal(DISCOVERY_MAX_MUTATION_STATEMENTS,43);assert.equal(DISCOVERY_MAX_D1_STATEMENTS,50);assert.equal(DISCOVERY_MAX_FIXTURE_ROWS_WRITTEN,7500);assert.equal(DISCOVERY_MAX_CONTROL_ROWS_WRITTEN,25);assert.equal(DISCOVERY_MAX_D1_ROWS_WRITTEN,7525);
});

test('prior attempts remain first-attempt-only and conservative',()=>{
  assert.equal(classifyPriorAttempt(null,{now:NOW}).action,'RESERVE_FIRST_ATTEMPT');assert.equal(classifyPriorAttempt({attempt_number:1,outcome:'SUCCEEDED'},{now:NOW}).reason,'succeeded_attempt_requires_reconciliation');
  assert.equal(classifyPriorAttempt({attempt_number:1,outcome:'RESERVED',lease_expires_at:'2026-09-21T12:00:30Z'},{now:NOW}).reason,'request_lease_busy');assert.equal(classifyPriorAttempt({attempt_number:1,outcome:'RESERVED',lease_expires_at:'2026-09-21T11:00:00Z'},{now:NOW}).reason,'expired_reservation_consumed');
  for(const outcome of ['TIMEOUT','TRANSPORT_UNKNOWN','AUTH_FAILURE','QUOTA_BLOCKED','SCHEMA_FAILURE','HTTP_FAILURE'])assert.equal(classifyPriorAttempt({attempt_number:1,outcome},{now:NOW}).reason,'prior_attempt_consumed');
});

test('actual D1 composition stages once, reserves attempt 1 five times, persists, completes and advances one head',async()=>{
  const {result,db,fetches}=await runConcrete({rows:500});assert.equal(result.ok,true);assert.equal(fetches(),5);assert.equal(db.generations.size,1);assert.equal([...db.generations.values()][0].state,'COMMITTED');assert.equal(db.head,result.generationId);
  assert.equal(db.attempts.size,5);assert.equal([...db.attempts.values()].every(row=>row.attempt_number===1&&row.outcome==='SUCCEEDED'),true);assert.equal(db.memberships.size,2500);
  assert.deepEqual(result.operations,{statements:47,mutationStatements:40,rowsWritten:7525,batches:17});
});

test('worst admitted response fragmentation reaches but never exceeds pinned D1 exposure',async()=>{
  const {result,db}=await runConcrete({rows:[1,1,1,497,2000]});assert.equal(result.ok,true);assert.equal(db.memberships.size,2500);
  assert.deepEqual(result.operations,{statements:50,mutationStatements:43,rowsWritten:7525,batches:18});
});

test('concrete D1 adapter reuses unchanged revisions and appends immutable superseding changes',async()=>{
  const db=new DeterministicD1();assert.equal((await runConcrete({db,at:'2026-09-21T12:00:00.000Z'})).result.ok,true);const first=[...db.revisions.values()];assert.equal(first.length,5);
  assert.equal((await runConcrete({db,at:'2026-09-22T12:00:00.000Z'})).result.ok,true);assert.equal(db.revisions.size,5);
  assert.equal((await runConcrete({db,at:'2026-09-23T11:00:00.000Z',status:'FT'})).result.ok,true);assert.equal(db.revisions.size,10);
  const changed=[...db.revisions.values()].filter(row=>row.providerStatus==='FT');assert.equal(changed.length,5);assert.equal(changed.every(row=>first.some(previous=>previous.fixtureRevisionId===row.supersedesRevisionId)),true);
});

for(let failureAt=1;failureAt<=5;failureAt++)test(`semantic failure at discovery request ${failureAt} never advances head`,async()=>{const {result,db,fetches}=await runConcrete({failureAt});assert.equal(result.ok,false);assert.equal(fetches(),failureAt);assert.equal(db.head,null);assert.equal([...db.generations.values()][0].state,'FAILED');});

test('generation ceiling rejects request five before its persistence batch',async()=>{
  const {result,db}=await runConcrete({rows:501});assert.equal(result.reason,'generation_row_ceiling_exceeded');assert.equal(db.memberships.size,2004);assert.equal(db.head,null);
});

test('failure after persistence before completion leaves consumed reservation and duplicate invocation issues no egress',async()=>{
  const db=new DeterministicD1({failCompletionAt:3}),first=await runConcrete({db});assert.equal(first.result.reason,'attempt_completion_uncertain');assert.equal(first.fetches(),3);assert.equal([...db.attempts.values()].at(-1).outcome,'RESERVED');
  const second=await runConcrete({db});assert.equal(second.fetches(),0);assert.equal(second.result.ok,false);assert.equal(db.head,null);
});

test('failure after five completions before generation commit prevents head and duplicate egress',async()=>{
  const db=new DeterministicD1({failCommit:true}),first=await runConcrete({db});assert.equal(first.result.reason,'generation_commit_failed');assert.equal(first.fetches(),5);assert.equal(db.head,null);assert.equal([...db.attempts.values()].every(row=>row.outcome==='SUCCEEDED'),true);
  db.failCommit=false;const second=await runConcrete({db,at:'2026-09-21T23:00:00.000Z'});assert.equal(second.fetches(),0);assert.equal(second.result.reason,'succeeded_attempt_requires_reconciliation');assert.equal(db.head,null);
});

test('active and expired durable reservations both block egress',async()=>{
  for(const [lease,reason] of [['2026-09-21T12:30:00.000Z','request_lease_busy'],['2026-09-21T11:00:00.000Z','expired_reservation_consumed']]){const db=new DeterministicD1(),request=requests()[0];db.attempts.set(request.attemptId,{attempt_id:request.attemptId,attempt_number:1,outcome:'RESERVED',lease_expires_at:lease});const run=await runConcrete({db});assert.equal(run.fetches(),0);assert.equal(run.result.reason,reason);}
});

function preflightEvidence(stage){const attended=stage===COLLECTOR_PREFLIGHT_ATTENDED_STAGE;return {version:COLLECTOR_ACTIVATION_PREFLIGHT_VERSION,stage,migrations:[[1,'shadow_data_foundation'],[2,'official_fpl_structured_history'],[3,'production_query_plan_indexes'],[4,'api_football_shadow_identity'],[5,'api_football_shadow_runtime'],[6,'api_football_mapping_qualification']],foreignKeyViolations:0,authority,mapping:{state:'COMMITTED',isCurrentHead:true,mappingCount:20,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalTeamIds:authority.teamIds.slice(),historicalAuthorityDigest:'a'.repeat(64),historicalAuthorityFetchedAt:'2026-09-20T12:00:00.000Z'},runtime:{provider:'api-football',collectionEnabled:0,credentialState:attended?'AVAILABLE':'UNPROVISIONED',inFlightAttemptId:null,inFlightLeaseExpiresAt:null},inventory:{activation:attended?API_FOOTBALL_ATTENDED_DISCOVERY_ACTIVATION:'REPOSITORY_ONLY_BLOCKED',cronCount:0,workersDev:false,previewUrls:false,databaseIdPlaceholder:!attended,productionBindingProven:attended,workerPresent:attended,deploymentCount:0,configurationExact:attended,versionIdentityExact:attended,routeCount:0,customDomainCount:0,secretBindingPresent:attended,secretBindingNames:attended?['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']:[]},counts:{requestAttempts:0,generations:0,fixtureRevisions:0},priorState:{attempt2Count:0,reservedAttemptCount:0,stagingGenerationCount:0},modelUiImportCount:0};}

test('activation preflight separates immutable mapping provenance from fresh current authority',()=>{
  const evidence=preflightEvidence(COLLECTOR_PREFLIGHT_REPOSITORY_STAGE);
  evidence.mapping.historicalAuthorityDigest='b'.repeat(64);
  assert.notEqual(evidence.mapping.historicalAuthorityDigest,evidence.authority.digest);
  assert.equal(classifyCollectorActivationPreflight(evidence,{now:NOW}).classification,COLLECTOR_REPOSITORY_STAGE_READY);

  const drift=preflightEvidence(COLLECTOR_PREFLIGHT_REPOSITORY_STAGE);
  drift.mapping.canonicalTeamIds=drift.mapping.canonicalTeamIds.slice();
  drift.mapping.canonicalTeamIds[19]='2026-27:fpl:team:99';
  assert.equal(classifyCollectorActivationPreflight(drift,{now:NOW}).reason,'qualified_mapping_unavailable');

  const invalid=preflightEvidence(COLLECTOR_PREFLIGHT_REPOSITORY_STAGE);
  invalid.mapping.historicalAuthorityDigest='not-a-hash';
  assert.equal(classifyCollectorActivationPreflight(invalid,{now:NOW}).reason,'mapping_provenance_invalid');
});

test('activation preflight has closed repository and attended acceptance stages',()=>{
  assert.equal(classifyCollectorActivationPreflight(preflightEvidence(COLLECTOR_PREFLIGHT_REPOSITORY_STAGE),{now:NOW}).classification,COLLECTOR_REPOSITORY_STAGE_READY);
  assert.equal(classifyCollectorActivationPreflight(preflightEvidence(COLLECTOR_PREFLIGHT_ATTENDED_STAGE),{now:NOW}).classification,COLLECTOR_ATTENDED_STAGE_READY);
  for(const mutate of [e=>e.inventory.cronCount=1,e=>e.runtime.collectionEnabled=1,e=>e.inventory.secretBindingPresent=false,e=>e.priorState.reservedAttemptCount=1,e=>e.counts.requestAttempts=1,e=>e.counts.generations=1,e=>e.counts.fixtureRevisions=1,e=>e.modelUiImportCount=1]){const evidence=preflightEvidence(COLLECTOR_PREFLIGHT_ATTENDED_STAGE);mutate(evidence);assert.match(classifyCollectorActivationPreflight(evidence,{now:NOW}).classification,/^STOP_ATTENDED_ACCEPTANCE_/);}
});


class SqliteD1Statement{
  constructor(database,sql){this.database=database;this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async first(){return this.database.prepare(this.sql).get(...this.args)??null;}
  async all(){return {results:this.database.prepare(this.sql).all(...this.args)};}
  async run(){const info=this.database.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(info.changes)}};}
  runSync(){const info=this.database.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(info.changes)}};}
}
class SqliteD1{
  constructor(database){this.database=database;}
  prepare(sql){return new SqliteD1Statement(this.database,sql);}
  async batch(statements){
    this.database.exec('BEGIN IMMEDIATE');
    try{const results=statements.map(statement=>statement.runSync());this.database.exec('COMMIT');return results;}
    catch(error){this.database.exec('ROLLBACK');throw error;}
  }
}

test('concrete collector persistence SQL executes against migrations 0001-0006 in real SQLite',async()=>{
  const database=new DatabaseSync(':memory:');
  try{
    database.exec('PRAGMA foreign_keys=ON');
    for(const migration of [
      '0001_shadow_data_foundation.sql','0002_official_fpl_structured_history.sql','0003_production_query_plan_indexes.sql',
      '0004_api_football_shadow_identity.sql','0005_api_football_shadow_runtime.sql','0006_api_football_mapping_qualification.sql'
    ])database.exec(fs.readFileSync(path.join(root,'workers/data-platform/migrations',migration),'utf8'));
    database.exec(`UPDATE api_football_runtime_state SET collection_enabled=1,credential_state='AVAILABLE',quota_state='KNOWN',
      quota_utc_day='2026-09-21',daily_attempt_count=0,in_flight_attempt_id=NULL,in_flight_lease_expires_at=NULL,
      earliest_next_request_at=NULL WHERE provider='api-football'`);
    const db=new SqliteD1(database),repository=createD1CollectorRepository(db,{authority});
    const transport=async request=>({ok:true,payload:payload(request),completion:{ok:true,outcome:'SUCCEEDED',timeout:0,quotaState:'KNOWN',quota:{dailyLimit:7500,dailyRemaining:7499,minuteLimit:300,minuteRemaining:299}},fetchedAt:NOW});
    const validate=(body,request,fetchedAt)=>validateProviderPayload(body,request,{fetchedAt,teamMappings:mappings});
    const result=await runOneShotDiscoveryGeneration({requests:requests(),repository,transport,validate,now:NOW,clock:clock(NOW),sleep:async()=>{}});
    assert.equal(result.ok,true);assert.equal(result.operations.statements<=50,true);
    const generation=database.prepare("SELECT state,competition_count,fixture_count FROM api_football_discovery_generations WHERE generation_id=?").get(result.generationId);
    assert.deepEqual({...generation},{state:'COMMITTED',competition_count:5,fixture_count:5});
    assert.equal(database.prepare('SELECT COUNT(*) count FROM provider_fixture_identities').get().count,5);
    assert.equal(database.prepare('SELECT COUNT(*) count FROM api_football_fixture_revisions').get().count,5);
    assert.equal(database.prepare('SELECT COUNT(*) count FROM api_football_generation_fixtures WHERE generation_id=?').get(result.generationId).count,5);
    assert.equal(database.prepare("SELECT generation_id FROM api_football_discovery_heads WHERE fpl_season='2026-27'").get().generation_id,result.generationId);
    assert.equal(database.prepare('SELECT COUNT(*) count FROM pragma_foreign_key_check').get().count,0);
  }finally{database.close();}
});
