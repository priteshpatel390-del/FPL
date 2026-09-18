import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {API_FOOTBALL_ENDPOINTS,API_FOOTBALL_ORIGIN} from '../src/decision-intelligence/api-football-foundation.mjs';
import {API_FOOTBALL_FPL_SEASON} from '../src/decision-intelligence/api-football-discovery.mjs';
import {issueOfficialFplTeamUniverseAuthority} from '../src/decision-intelligence/api-football-shadow-contracts.mjs';
import {
  API_FOOTBALL_PL_LEAGUE_ID,API_FOOTBALL_PL_TEAM_UNIVERSE_ENDPOINT,API_FOOTBALL_TEAM_MAPPING_MAX_ATTEMPTS,
  API_FOOTBALL_TEAM_MAPPING_MAX_RESPONSE_BYTES,API_FOOTBALL_TEAM_MAPPING_RECEIPT_REVISION,
  buildApiFootballPlTeamUniverseQualificationRequest,confirmPreviouslyQualifiedTeamMappings,
  decodeApiFootballPlTeamUniverseQualificationResponse,issueQualificationMappingReceipt,qualifyTwentyClubMapping,
  runAttendedApiFootballTeamUniverseQualification,validateApiFootballTeamUniverseEvidence
} from '../src/decision-intelligence/api-football-prelive-qualification.mjs';
import {validateCollectorRequest} from '../workers/api-football-collector/runtime-contracts.mjs';

const KEY='deliberate-test-key-material';
const season=API_FOOTBALL_FPL_SEASON;
const IDS=Object.freeze(Array.from({length:20},(_,index)=>index+1));
const PROVIDER_IDS=Object.freeze(IDS.map(id=>String(id===6?49:id===13?63:200+id)));
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');

function officialFplWorld(){
  const teams=IDS.map((id,index)=>({
    id,name:id===6?'Chelsea':id===13?'Leeds':`Official Club ${id}`,short_name:id===6?'CHE':id===13?'LEE':`O${String(id).padStart(2,'0')}`,
    strength:1000+index,strength_overall_home:1001+index,strength_overall_away:999+index,
    strength_attack_home:1002+index,strength_attack_away:998+index,strength_defence_home:1003+index,strength_defence_away:997+index
  }));
  const events=Array.from({length:38},(_,index)=>({id:index+1,name:`Gameweek ${index+1}`,deadline_time:new Date(Date.UTC(2026,7,15+index*7,10)).toISOString()}));
  const elements=Array.from({length:401},(_,index)=>({
    id:index+1,team:IDS[index%20],element_type:index%4+1,web_name:`Player ${index+1}`,now_cost:45+index%100,status:'a',
    chance_of_playing_next_round:null,chance_of_playing_this_round:null,news:'',news_added:null,selected_by_percent:String((index%500)/10)
  }));
  const fixtures=Array.from({length:300},(_,index)=>({
    id:index+1,event:index%38+1,kickoff_time:new Date(Date.UTC(2026,7,15+index,14)).toISOString(),
    team_h:IDS[index%20],team_a:IDS[(index+7)%20],team_h_difficulty:2+index%4,team_a_difficulty:2+(index+1)%4
  }));
  return {bootstrap:{events,teams,elements,element_types:[1,2,3,4].map(id=>({id}))},fixtures,season,fetchedAt:'2026-09-18T08:00:00.000Z'};
}
const authority=()=>issueOfficialFplTeamUniverseAuthority(officialFplWorld());

function providerRows(){
  return PROVIDER_IDS.map((providerTeamId,index)=>({
    team:{id:Number(providerTeamId),name:`Provider Identity ${String.fromCharCode(65+index)}`,code:`P${String(index+1).padStart(2,'0')}`,country:'England',national:false}
  }));
}
function payload(overrides={}){
  const rows=overrides.rows??providerRows();
  return {
    get:overrides.get??'teams',parameters:overrides.parameters??{league:'39',season:'2026'},errors:overrides.errors??{},
    results:rows.length,paging:overrides.paging??{current:1,total:1},response:rows
  };
}
function quotaHeaders(){return {'x-ratelimit-requests-limit':'7500','x-ratelimit-requests-remaining':'7499','x-ratelimit-limit':'300','x-ratelimit-remaining':'299'};}
function response(body,{status=200,headers={}}={}){
  const json=JSON.stringify(body);
  return new Response(json,{status,headers:{'content-type':'application/json','content-length':String(Buffer.byteLength(json)),...quotaHeaders(),...headers}});
}
async function providerUniverseEvidence(fetchImpl=async()=>response(payload())){
  return runAttendedApiFootballTeamUniverseQualification({
    apiKey:KEY,fetchImpl,sleepImpl:async()=>{},nowImpl:()=>'2026-09-18T09:00:00.000Z',
    executionIdentity:'test-attended-run:1'
  });
}
function mapping(fplId){
  const providerEntityId=PROVIDER_IDS[fplId-1];
  return {
    provider:'api-football',entityType:'team',providerEntityId,canonicalFplId:`${season}:fpl:team:${fplId}`,
    mappingRevision:`mapping-${fplId}`,revision:1,status:'VERIFIED',season,method:'manually_verified',
    provenance:`owner reviewed provider ${providerEntityId} to FPL ${fplId}`,club:`Club ${fplId}`
  };
}
function reviewEvidence(fplId){
  return {
    evidenceType:'attended_api_football_team_universe',qualificationMethod:'owner_verified_provider_id_crosswalk',
    reviewState:'OWNER_VERIFIED',reviewReference:`owner-review-${fplId}`,reviewedAt:'2026-09-18T10:00:00.000Z',
    provenance:`owner verified stable provider identity for FPL ${fplId}`
  };
}
async function completeMappings(providerUniverse){
  const auth=authority();
  const legacy=await confirmPreviouslyQualifiedTeamMappings(auth);
  const legacyByFpl=new Map(legacy.mappings.map(row=>[Number(row.canonicalFplId.split(':').pop()),row]));
  const rows=[];
  for(const id of IDS){
    if(legacyByFpl.has(id)){rows.push(legacyByFpl.get(id));continue;}
    const row=mapping(id);
    const receipt=await issueQualificationMappingReceipt({mapping:row,evidence:reviewEvidence(id),authority:auth,providerUniverse});
    assert.equal(receipt.revision,API_FOOTBALL_TEAM_MAPPING_RECEIPT_REVISION);
    rows.push({...row,qualificationEvidenceReceipt:receipt});
  }
  return {auth,rows};
}

test('mapping qualification request is one closed qualification-only /teams query',()=>{
  const request=buildApiFootballPlTeamUniverseQualificationRequest();
  assert.equal(request.ok,true);
  const url=new URL(request.url);
  assert.equal(url.origin,API_FOOTBALL_ORIGIN);
  assert.equal(url.pathname,'/teams');
  assert.equal(url.searchParams.get('league'),'39');
  assert.equal(url.searchParams.get('season'),'2026');
  assert.equal(request.endpoint,API_FOOTBALL_PL_TEAM_UNIVERSE_ENDPOINT);
  assert.equal(API_FOOTBALL_PL_LEAGUE_ID,'39');
  assert.equal(API_FOOTBALL_TEAM_MAPPING_MAX_ATTEMPTS,2);
  assert.equal(API_FOOTBALL_TEAM_MAPPING_MAX_RESPONSE_BYTES,720896);
  for(const input of [{league:'39'},{season:'2026'},{url:'https://example.test'},{endpoint:'fixtures'}])assert.equal(buildApiFootballPlTeamUniverseQualificationRequest(input).reason,'parameters_invalid');
  assert.deepEqual(API_FOOTBALL_ENDPOINTS,['fixtures','fixtures/lineups','fixtures/players','fixtures/events']);
  assert.equal(validateCollectorRequest({operationClass:'DISCOVERY',endpoint:'teams',endpointClass:'teams',logicalRequestId:'x',attemptNumber:1,attemptId:'x:attempt:1',search:{league:'39',season:'2026'}}).reason,'request_contract_invalid');
});

test('provider team universe requires exact response identity, one page and exactly 20 unique stable IDs',()=>{
  const valid=decodeApiFootballPlTeamUniverseQualificationResponse(payload());
  assert.equal(valid.ok,true);assert.equal(valid.teams.length,20);
  assert.deepEqual(valid.teams.map(row=>row.providerTeamId).sort((a,b)=>Number(a)-Number(b)),[...PROVIDER_IDS].sort((a,b)=>Number(a)-Number(b)));
  assert.equal(decodeApiFootballPlTeamUniverseQualificationResponse(payload({parameters:{league:'40',season:'2026'}})).reason,'provider_response_identity_mismatch');
  assert.equal(decodeApiFootballPlTeamUniverseQualificationResponse(payload({paging:{current:1,total:2}})).reason,'qualification_pagination_unresolved');
  assert.equal(decodeApiFootballPlTeamUniverseQualificationResponse(payload({rows:providerRows().slice(0,19)})).reason,'provider_team_universe_count_invalid');
  assert.equal(decodeApiFootballPlTeamUniverseQualificationResponse(payload({rows:[...providerRows(),{team:{id:999,name:'Extra',code:'EXT'}}]})).reason,'provider_team_universe_count_invalid');
  const duplicate=providerRows();duplicate[19]={...duplicate[19],team:{...duplicate[19].team,id:duplicate[0].team.id}};
  assert.equal(decodeApiFootballPlTeamUniverseQualificationResponse(payload({rows:duplicate})).reason,'provider_team_universe_conflicted');
});

test('attended harness uses one request normally, retains normalized evidence only and never returns credential material',async()=>{
  let calls=0;
  const run=await providerUniverseEvidence(async(url,init)=>{
    calls+=1;
    assert.equal(String(url),'https://v3.football.api-sports.io/teams?league=39&season=2026');
    assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(init.headers['x-apisports-key'],KEY);
    return response(payload());
  });
  assert.equal(run.ok,true);assert.equal(run.decision,'EVIDENCE_CAPTURED');assert.equal(calls,1);assert.equal(run.attemptsUsed,1);assert.equal(run.retries,0);
  assert.equal(run.providerUniverse.teams.length,20);assert.equal(run.providerUniverse.rawBodyRetained,false);
  assert.equal(run.rawBodyRetained,false);assert.equal(run.credentialPrinted,false);assert.equal(run.credentialPersisted,false);
  assert.equal((await validateApiFootballTeamUniverseEvidence(run.providerUniverse)).ok,true);
  assert.doesNotMatch(JSON.stringify(run),/deliberate-test-key-material|x-apisports-key/i);
});

test('attended harness retries only bounded transient failure and stops on auth, quota, schema and oversize failures',async()=>{
  const sleeps=[];let calls=0;
  const retried=await runAttendedApiFootballTeamUniverseQualification({
    apiKey:KEY,fetchImpl:async()=>{calls+=1;return calls===1?response({},{status:500}):response(payload());},
    sleepImpl:async ms=>sleeps.push(ms),nowImpl:()=>'2026-09-18T09:00:00.000Z',executionIdentity:'test-retry'
  });
  assert.equal(retried.ok,true);assert.equal(calls,2);assert.deepEqual(sleeps,[1000]);assert.equal(retried.retries,1);
  for(const [status,reason] of [[401,'authentication_failure'],[403,'authentication_failure'],[429,'quota_exhausted']]){
    let n=0;const stopped=await runAttendedApiFootballTeamUniverseQualification({apiKey:KEY,fetchImpl:async()=>{n+=1;return response({},{status});},sleepImpl:async()=>{},executionIdentity:`test-${status}`});
    assert.equal(stopped.reason,reason);assert.equal(n,1);
  }
  let malformedCalls=0;const malformed=await runAttendedApiFootballTeamUniverseQualification({apiKey:KEY,fetchImpl:async()=>{malformedCalls+=1;return response(payload({parameters:{league:'40',season:'2026'}}));},sleepImpl:async()=>{},executionIdentity:'test-schema'});
  assert.equal(malformed.reason,'provider_response_identity_mismatch');assert.equal(malformedCalls,1);
  const oversized=await runAttendedApiFootballTeamUniverseQualification({apiKey:KEY,fetchImpl:async()=>response(payload(),{headers:{'content-length':String(API_FOOTBALL_TEAM_MAPPING_MAX_RESPONSE_BYTES+1)}}),sleepImpl:async()=>{},executionIdentity:'test-oversize'});
  assert.equal(oversized.reason,'provider_response_too_large');
});

test('new mapping receipts require attended universe evidence plus explicit owner review; names never auto-admit',async()=>{
  const run=await providerUniverseEvidence();const auth=authority();const row=mapping(1);
  const missingReview=await issueQualificationMappingReceipt({mapping:row,evidence:{evidenceType:'attended_api_football_team_universe'},authority:auth,providerUniverse:run.providerUniverse});
  assert.equal(missingReview.reason,'mapping_evidence_not_admitted');
  const receipt=await issueQualificationMappingReceipt({mapping:row,evidence:reviewEvidence(1),authority:auth,providerUniverse:run.providerUniverse});
  assert.equal(receipt.revision,API_FOOTBALL_TEAM_MAPPING_RECEIPT_REVISION);assert.equal(receipt.providerTeamId,row.providerEntityId);
  assert.equal(receipt.providerObservedName,'Provider Identity A');
  assert.equal(receipt.canonicalFplId,`${season}:fpl:team:1`);
  const renamedAuth=issueOfficialFplTeamUniverseAuthority({...officialFplWorld(),bootstrap:{...officialFplWorld().bootstrap,teams:officialFplWorld().bootstrap.teams.map(team=>team.id===1?{...team,name:'Totally Different FPL Label'}:team)}});
  assert.equal(renamedAuth.ok,true);
  const renamedReceipt=await issueQualificationMappingReceipt({mapping:row,evidence:reviewEvidence(1),authority:renamedAuth,providerUniverse:run.providerUniverse});
  assert.equal(renamedReceipt.revision,API_FOOTBALL_TEAM_MAPPING_RECEIPT_REVISION);
});

test('complete 20-club manifest is an exact deterministic bijection and preserves Chelsea 49→6 / Leeds 63→13 anchors',async()=>{
  const run=await providerUniverseEvidence();const {auth,rows}=await completeMappings(run.providerUniverse);
  const one=await qualifyTwentyClubMapping({authority:auth,mappings:rows,providerUniverse:run.providerUniverse});
  const two=await qualifyTwentyClubMapping({authority:auth,mappings:[...rows].reverse(),providerUniverse:run.providerUniverse});
  assert.equal(one.ok,true);assert.equal(one.decision,'GO');assert.equal(one.completeTwentyClubCoverage,true);assert.equal(one.verifiedPremierLeagueTeamCount,20);
  assert.equal(one.table.length,20);assert.equal(one.unresolved.length,0);assert.equal(one.nameOnlyCertified,false);
  assert.equal(one.table.find(row=>row.officialFplTeamId==='6').apiFootballTeamId,'49');
  assert.equal(one.table.find(row=>row.officialFplTeamId==='13').apiFootballTeamId,'63');
  assert.equal(one.integrityHash,two.integrityHash);
  assert.equal(one.providerUniverseRevision,run.providerUniverse.revision);
});

test('19/20, duplicate identities, stale/tampered universe and anchor conflicts remain NO-GO',async()=>{
  const run=await providerUniverseEvidence();const {auth,rows}=await completeMappings(run.providerUniverse);
  assert.equal((await qualifyTwentyClubMapping({authority:auth,mappings:rows.slice(0,19),providerUniverse:run.providerUniverse})).decision,'NO-GO');
  const anchorConflict=[...rows.filter(row=>row.canonicalFplId!==`${season}:fpl:team:6`),{...rows.find(row=>row.canonicalFplId===`${season}:fpl:team:6`),providerEntityId:'999'}];
  assert.equal((await qualifyTwentyClubMapping({authority:auth,mappings:anchorConflict,providerUniverse:run.providerUniverse})).reason,'legacy_anchor_conflict');
  const tampered={...run.providerUniverse,teams:run.providerUniverse.teams.map((row,index)=>index?row:{...row,name:'tampered'})};
  assert.equal((await qualifyTwentyClubMapping({authority:auth,mappings:rows,providerUniverse:tampered})).reason,'provider_team_universe_evidence_invalid');
  const duplicateTarget=[...rows];duplicateTarget[0]={...duplicateTarget[0],canonicalFplId:duplicateTarget[1].canonicalFplId};
  assert.equal((await qualifyTwentyClubMapping({authority:auth,mappings:duplicateTarget,providerUniverse:run.providerUniverse})).decision,'NO-GO');
});

test('mapping qualification remains isolated from collector, production model, browser, D1 and schedules',()=>{
  const source=fs.readFileSync(path.join(root,'src/decision-intelligence/api-football-prelive-qualification.mjs'),'utf8');
  assert.doesNotMatch(source,/process\.env|localStorage|setInterval|setTimeout|collection_enabled\s*=\s*1/i);
  for(const file of ['src/model/minutes.mjs','src/model/scoring.mjs','src/squad.mjs','src/model/transfers.mjs','src/main.mjs']){
    assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/API_FOOTBALL_PL_TEAM_UNIVERSE_ENDPOINT|runAttendedApiFootballTeamUniverseQualification/);
  }
  const wrangler=fs.readFileSync(path.join(root,'workers/api-football-collector/wrangler.jsonc'),'utf8');
  assert.match(wrangler,/"crons": \[\]/);assert.match(wrangler,/00000000-0000-0000-0000-000000000000/);
});
