import assert from 'node:assert/strict';
import test from 'node:test';
import {
  API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_EXECUTION_IDENTITY,
  API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_INTEGRITY_HASH,
  API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_OBSERVED_AT,
  API_FOOTBALL_OWNER_CROSSWALK_HASH,
  OFFICIAL_FPL_2026_27_OWNER_REVIEW_TEAM_LABELS
} from '../src/decision-intelligence/api-football-owner-mapping.mjs';
import {runAttendedApiFootballTeamUniverseQualification} from '../src/decision-intelligence/api-football-prelive-qualification.mjs';
import {issueOfficialFplTeamUniverseAuthority} from '../src/decision-intelligence/api-football-shadow-contracts.mjs';
import {prepareQualifiedTeamMappingPersistence} from '../workers/api-football-collector/mapping-persistence.mjs';
import {
  API_FOOTBALL_MAX_PLANNED_REQUESTS_PER_WAKE,buildScheduledCollectionPlan,requestPlanForOpportunity
} from '../workers/api-football-collector/planner-orchestrator.mjs';
import {discoveryOpportunity,fixtureOpportunities} from '../workers/api-football-collector/scheduler.mjs';
import {validateCollectorRequest} from '../workers/api-football-collector/runtime-contracts.mjs';

const IDS=Object.freeze(Array.from({length:20},(_,index)=>index+1));
const PROVIDER_IDS=Object.freeze(IDS.map(id=>String(id===6?49:id===13?63:200+id)));

function officialFplWorld(){
  const labels=new Map(OFFICIAL_FPL_2026_27_OWNER_REVIEW_TEAM_LABELS.map(row=>[Number(row.officialFplTeamId),row]));
  const teams=IDS.map((id,index)=>{
    const label=labels.get(id);
    return {id,name:label.name,short_name:label.shortName,strength:1000+index,strength_overall_home:1001+index,strength_overall_away:999+index,strength_attack_home:1002+index,strength_attack_away:998+index,strength_defence_home:1003+index,strength_defence_away:997+index};
  });
  const events=Array.from({length:38},(_,index)=>({id:index+1,name:'Gameweek '+(index+1),deadline_time:new Date(Date.UTC(2026,7,15+index*7,10)).toISOString()}));
  const elements=Array.from({length:401},(_,index)=>({id:index+1,team:IDS[index%20],element_type:index%4+1,web_name:'Player '+(index+1),now_cost:45+index%100,status:'a',chance_of_playing_next_round:null,chance_of_playing_this_round:null,news:'',news_added:null,selected_by_percent:String((index%500)/10)}));
  const fixtures=Array.from({length:300},(_,index)=>({id:index+1,event:index%38+1,kickoff_time:new Date(Date.UTC(2026,7,15+index,14)).toISOString(),team_h:IDS[index%20],team_a:IDS[(index+7)%20],team_h_difficulty:2+index%4,team_a_difficulty:2+(index+1)%4}));
  return {bootstrap:{events,teams,elements,element_types:[1,2,3,4].map(id=>({id}))},fixtures,season:'2026-27',fetchedAt:'2026-09-18T10:30:00.000Z'};
}
function crosswalk(){return Object.fromEntries(IDS.map((id,index)=>[String(id),PROVIDER_IDS[index]]));}
function providerPayload(){return {get:'teams',parameters:{league:'39',season:'2026'},errors:{},results:20,paging:{current:1,total:1},response:PROVIDER_IDS.map((id,index)=>({team:{id:Number(id),name:'Synthetic '+(index+1),code:'S'+String(index+1).padStart(2,'0')}}))};}
function providerResponse(){const body=JSON.stringify(providerPayload());return new Response(body,{status:200,headers:{'content-type':'application/json','content-length':String(Buffer.byteLength(body)),'x-ratelimit-requests-limit':'7500','x-ratelimit-requests-remaining':'7499','x-ratelimit-limit':'300','x-ratelimit-remaining':'299'}});}
function hexBuffer(hex){return Uint8Array.from(hex.match(/../g),part=>Number.parseInt(part,16)).buffer;}
function testCrypto(){
  const native=globalThis.crypto;
  return {subtle:{async digest(algorithm,data){
    const text=new TextDecoder().decode(data);
    if(text.startsWith('1:201|'))return hexBuffer(API_FOOTBALL_OWNER_CROSSWALK_HASH);
    if(text.includes('"kind":"api-football-team-universe-evidence-v1"'))return hexBuffer(API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_INTEGRITY_HASH);
    return native.subtle.digest(algorithm,data);
  }}};
}
async function universe(){
  const result=await runAttendedApiFootballTeamUniverseQualification({apiKey:'test-only-key',fetchImpl:async()=>providerResponse(),sleepImpl:async()=>{},nowImpl:()=>API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_OBSERVED_AT,executionIdentity:API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_EXECUTION_IDENTITY,cryptoImpl:testCrypto()});
  assert.equal(result.ok,true);return result.providerUniverse;
}

test('qualified mapping persistence plan is exact-20, private-pair ready and hash bound',async()=>{
  const authority=issueOfficialFplTeamUniverseAuthority(officialFplWorld());assert.equal(authority.ok,true);
  const plan=await prepareQualifiedTeamMappingPersistence({authority,providerUniverse:await universe(),crosswalk:crosswalk(),now:'2026-09-18T12:00:00Z',cryptoImpl:testCrypto()});
  assert.equal(plan.ok,true);assert.equal(plan.rows.length,20);assert.match(plan.persistenceIntegrityHash,/^[0-9a-f]{64}$/);
  assert.equal(new Set(plan.rows.map(row=>row.providerTeamId)).size,20);assert.equal(new Set(plan.rows.map(row=>row.canonicalFplTeamId)).size,20);
  assert.equal(plan.rows.find(row=>row.canonicalFplTeamId==='2026-27:fpl:team:6').providerTeamId,'49');
  assert.equal(plan.rows.find(row=>row.canonicalFplTeamId==='2026-27:fpl:team:13').providerTeamId,'63');
  assert.equal(plan.crosswalkIntegrityHash,API_FOOTBALL_OWNER_CROSSWALK_HASH);
  assert.equal(plan.rows.every(row=>/^[0-9a-f]{64}$/.test(row.receiptIntegrityHash)),true);
});

test('qualified mapping persistence rejects wrong owner crosswalk before any D1 work',async()=>{
  const authority=issueOfficialFplTeamUniverseAuthority(officialFplWorld());const wrong=crosswalk();wrong['6']='999';
  const plan=await prepareQualifiedTeamMappingPersistence({authority,providerUniverse:await universe(),crosswalk:wrong,now:'2026-09-18T12:00:00Z',cryptoImpl:testCrypto()});
  assert.equal(plan.ok,false);assert.equal(plan.reason,'legacy_anchor_conflict');
});

function runtimeAuthority(){
  return {season:'2026-27',sourceKey:'official-fpl',sourceRevisionId:'official-fpl-r1',runStatus:'completed',fetchedAt:'2026-09-21T12:00:00.000Z',digest:'a'.repeat(64),teamIds:IDS.map(id=>'2026-27:fpl:team:'+id)};
}
function runtimeMappings(){
  return {ok:true,completeTwentyClubCoverage:true,verifiedPremierLeagueTeamCount:20,mappings:IDS.map((id,index)=>({provider:'api-football',entityType:'team',providerEntityId:PROVIDER_IDS[index],canonicalFplId:'2026-27:fpl:team:'+id,mappingRevision:'qualified',revision:1,status:'VERIFIED',season:'2026-27',method:'manually_verified',provenance:'owner-qualified'}))};
}

test('prelive planner converts discovery and fixture checks into closed request contracts only',()=>{
  const now='2026-09-21T13:00:00Z';
  const fixtures=[{providerFixtureId:'1001',kickoff:'2026-09-20T12:00:00Z',status:'FT',finalityChecks:2,changed:false,incomplete:false,conflicted:false}];
  const plan=buildScheduledCollectionPlan({now,authority:runtimeAuthority(),mappingAuthority:runtimeMappings(),fixtures,completedLogicalIds:[]});
  assert.equal(plan.ok,true);assert.equal(plan.requestCount,API_FOOTBALL_MAX_PLANNED_REQUESTS_PER_WAKE);
  assert.equal(plan.blockedOperations.some(row=>row.kind==='FINAL_ENRICHMENT'),true);
  assert.equal(plan.blockedOperations.some(row=>row.kind==='CORRECTION'),true);
  assert.equal(plan.requests.some(row=>row.endpoint==='fixtures/players'||row.endpoint==='fixtures/events'||row.endpoint==='fixtures/lineups'),false);
  for(const request of plan.requests)assert.equal(validateCollectorRequest(request).ok,true);
});

test('workload enrichment and correction opportunities remain explicitly blocked',()=>{
  const opportunities=fixtureOpportunities({providerFixtureId:'10',kickoff:'2026-09-20T12:00:00Z',status:'FT',finalityChecks:2,changed:true});
  for(const op of opportunities.filter(row=>row.kind==='FINAL_ENRICHMENT'||row.kind==='CORRECTION')){
    const plan=requestPlanForOpportunity(op);assert.equal(plan.ok,true);assert.equal(plan.blocked,true);assert.equal(plan.requests.length,0);assert.equal(plan.reason,'workload_ingestion_not_approved');
  }
});

test('daily discovery planning is deterministic and exactly five requests',()=>{
  const op=discoveryOpportunity('2026-09-18T15:15:00Z'),plan=requestPlanForOpportunity(op);
  assert.equal(plan.ok,true);assert.equal(plan.requests.length,5);
  assert.deepEqual(plan.requests.map(row=>String(row.search.league)),['2','3','848','45','48']);
  assert.equal(plan.requests.every(row=>row.operationClass==='DISCOVERY'&&row.endpointClass==='fixtures_discovery'),true);
});

test('planner refuses stale authority and mismatched mapping authority',()=>{
  const stale=buildScheduledCollectionPlan({now:'2026-09-21T13:00:00Z',authority:runtimeAuthority(),mappingAuthority:runtimeMappings()});
  assert.equal(stale.reason,'official_fpl_authority_stale');
  const fresh=runtimeAuthority();fresh.fetchedAt='2026-09-21T12:00:00Z';
  const broken=runtimeMappings();broken.mappings=broken.mappings.slice(1);
  assert.equal(buildScheduledCollectionPlan({now:'2026-09-21T13:00:00Z',authority:fresh,mappingAuthority:broken}).reason,'qualified_mapping_unavailable');
});
