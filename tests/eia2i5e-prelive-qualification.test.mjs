import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {API_FOOTBALL_DAILY_REQUEST_LIMIT,API_FOOTBALL_ORIGIN,API_FOOTBALL_REQUEST_TIMEOUT_MS} from '../src/decision-intelligence/api-football-foundation.mjs';
import {API_FOOTBALL_FPL_SEASON} from '../src/decision-intelligence/api-football-discovery.mjs';
import {issueOfficialFplTeamUniverseAuthority} from '../src/decision-intelligence/api-football-shadow-contracts.mjs';
import {API_FOOTBALL_MAX_RESPONSE_BYTES} from '../workers/api-football-collector/runtime-contracts.mjs';
import {
  EIA_2I5E_BYTE_CEILING_QUANTUM_BYTES,EIA_2I5E_CANONICAL_REQUEST_MANIFEST,EIA_2I5E_CHECKPOINT,
  EIA_2I5E_MAX_ATTEMPTS,EIA_2I5E_MEASUREMENT_ABORT_BYTES,EIA_2I5E_MIN_GAP_MS,EIA_2I5E_PRODUCTION_BYTE_CEILING,
  OFFICIAL_FPL_BOOTSTRAP_URL,OFFICIAL_FPL_FIXTURES_URL,PREVIOUSLY_QUALIFIED_PL_TEAMS,
  confirmPreviouslyQualifiedTeamMappings,eia2i5eActivationBlocks,eia2i5eRequestPlan,fetchOfficialFplAuthority,
  issueQualificationMappingReceipt,measureDiscardingBody,qualifyTwentyClubMapping,recommendResponseByteCeiling,
  resolveAttendedCredential,runAttendedApiFootballQualification,sanitizeOfficialFplAuthority,
  validateCanonicalQualificationPlan,validateQualificationPlanItem
} from '../src/decision-intelligence/api-football-prelive-qualification.mjs';

const KEY='deliberate-test-key-material';
const season=API_FOOTBALL_FPL_SEASON;
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const IDS=Object.freeze(Array.from({length:20},(_,index)=>index+1));
function officialFplWorld(overrides={}){
  const named=overrides.namedTeams||{};
  const teams=overrides.teams||IDS.map((id,index)=>({id,name:named[id]?.name||`Team ${id}`,short_name:named[id]?.short_name||`T${String(id).padStart(2,'0')}`,strength:1000+index,strength_overall_home:1001+index,strength_overall_away:999+index,strength_attack_home:1002+index,strength_attack_away:998+index,strength_defence_home:1003+index,strength_defence_away:997+index}));
  const events=Array.from({length:38},(_,index)=>({id:index+1,name:`Gameweek ${index+1}`,deadline_time:new Date(Date.UTC(2026,7,15+index*7,10)).toISOString()}));
  const elements=Array.from({length:401},(_,index)=>({id:index+1,team:IDS[index%20],element_type:index%4+1,web_name:`Player ${index+1}`,now_cost:45+index%100,status:'a',chance_of_playing_next_round:null,chance_of_playing_this_round:null,news:'',news_added:null,selected_by_percent:String((index%500)/10)}));
  const fixtures=Array.from({length:300},(_,index)=>({id:index+1,event:index%38+1,kickoff_time:new Date(Date.UTC(2026,7,15+index,14)).toISOString(),team_h:IDS[index%20],team_a:IDS[(index+7)%20],team_h_difficulty:2+index%4,team_a_difficulty:2+(index+1)%4}));
  return {bootstrap:{events,teams,elements,element_types:[1,2,3,4].map(id=>({id}))},fixtures,season,fetchedAt:'2026-09-17T06:00:00.000Z'};
}
const namedWorld=()=>officialFplWorld({namedTeams:{6:{name:'Chelsea',short_name:'CHE'},13:{name:'Leeds',short_name:'LEE'}}});
const issued=()=>issueOfficialFplTeamUniverseAuthority(namedWorld());
const team=(providerEntityId,canonicalFplId,overrides={})=>({provider:'api-football',entityType:'team',providerEntityId:String(providerEntityId),canonicalFplId,mappingRevision:'r1',revision:1,status:'VERIFIED',season,method:'manually_verified',provenance:'caller assertion',...overrides});
const clone=value=>JSON.parse(JSON.stringify(value));
function quotaHeaders(){return {'x-ratelimit-requests-limit':'7500','x-ratelimit-requests-remaining':'7499','x-ratelimit-limit':'300','x-ratelimit-remaining':'299'};}
function response(payload,{status=200,headers={}}={}){const body=JSON.stringify(payload);return new Response(body,{status,headers:{'content-type':'application/json','content-length':String(Buffer.byteLength(body)),...quotaHeaders(),...headers}});}
function fixture(id,league=48){return {fixture:{id,date:'2026-09-09T19:00:00Z',status:{short:'FT',elapsed:90}},league:{id:league,season:2026},teams:{home:{id:49},away:{id:63}},goals:{home:1,away:0}};}
function rowsFor(item){
  if(item.endpointClass==='fixtures_discovery')return [fixture(900000+Number(item.search.league),Number(item.search.league))];
  if(item.endpointClass==='fixture')return [fixture(Number(item.search.id),item.competition)];
  if(item.endpointClass==='lineups')return [{team:{id:49},startXI:[],substitutes:[]},{team:{id:63},startXI:[],substitutes:[]}];
  if(item.endpointClass==='players')return [{team:{id:49},players:[]},{team:{id:63},players:[]}];
  return [{time:{elapsed:1},team:{id:49},player:{id:1},type:'Goal',detail:'Normal Goal'}];
}
function payloadFor(item,overrides={}){const rows=overrides.rows??rowsFor(item);return {get:overrides.get??item.endpoint,parameters:overrides.parameters??item.search,errors:overrides.errors??{},results:rows.length,paging:overrides.paging??{current:1,total:1},response:rows};}
function identity(item){return JSON.stringify({endpoint:item.endpoint,endpointClass:item.endpointClass,search:item.search});}
function completeMeasurements(overrides={}){return eia2i5eRequestPlan().items.map((item,index)=>({ok:true,schemaMatched:true,sampleSufficient:true,responseIdentityMatched:true,rowIdentityValidationState:'MATCHED',logicalRequestId:item.id,requestIdentity:identity(item),expectedRequestIdentity:identity(item),attempted:true,quota:{state:'known'},endpointClass:item.endpointClass,endpoint:item.endpoint,competition:item.competition,fixtureId:item.search.id||item.search.fixture||null,actualBytes:50_000+index*10_000,highWaterCandidate:item.highWaterCandidate,paginationPresent:false,bodyRetained:false,...(overrides[item.id]||{})}));}
async function runWithResponses(factory){let calls=0;const result=await runAttendedApiFootballQualification({apiKey:KEY,fetchImpl:async url=>{const item=EIA_2I5E_CANONICAL_REQUEST_MANIFEST.items[calls];calls+=1;return factory(item,calls,url);},sleep:async()=>{}});return {result,calls};}

 test('constants and activation remain bounded, dormant, and production ceiling null',()=>{
  assert.equal(EIA_2I5E_CHECKPOINT,'EIA-2I5E');assert.equal(EIA_2I5E_MAX_ATTEMPTS,16);assert.ok(EIA_2I5E_MAX_ATTEMPTS<API_FOOTBALL_DAILY_REQUEST_LIMIT/5);
  assert.equal(EIA_2I5E_MIN_GAP_MS,1000);assert.equal(API_FOOTBALL_REQUEST_TIMEOUT_MS,15000);assert.equal(API_FOOTBALL_MAX_RESPONSE_BYTES,null);assert.equal(EIA_2I5E_PRODUCTION_BYTE_CEILING,null);
  assert.deepEqual(eia2i5eActivationBlocks(),{collectorDeployed:false,migration0005Live:false,credentialProvisioned:false,cronActive:false,collectionEnabled:false,providerShadowRuntimeLiveAccepted:false,modelOrUiInfluence:false,productionByteCeiling:null,responseLimitUnqualified:true});
});

test('one deep-frozen canonical manifest contains only the approved 11 requests',()=>{
  const plan=eia2i5eRequestPlan();assert.equal(plan,EIA_2I5E_CANONICAL_REQUEST_MANIFEST);assert.ok(Object.isFrozen(plan)&&Object.isFrozen(plan.items)&&plan.items.every(Object.isFrozen));assert.equal(plan.items.length,11);
  assert.deepEqual(plan.items.map(item=>item.id),['discovery-2','discovery-3','discovery-848','discovery-45','discovery-48','fixture-1636205','lineups-1636205','players-1636205','events-1636205','fixture-1635643','players-1635643']);
  assert.ok(plan.items.every(item=>validateQualificationPlanItem(item).ok));assert.equal(validateCanonicalQualificationPlan(plan).ok,true);
});

test('every alternate manifest fails before provider egress',async()=>{
  const mutations=[
    plan=>{plan.items[0].search.league='48';},plan=>{plan.items[5].search.id='1';},plan=>{plan.items[0].endpointClass='fixture';},plan=>{plan.items[0].search={id:'2'};},
    plan=>{plan.items[0].id='changed';},plan=>{plan.items.pop();},plan=>{plan.items.push(clone(plan.items[0]));},plan=>{plan.items[0]=clone(plan.items[1]);},plan=>{plan.items.reverse();}
  ];
  for(const mutate of mutations){const plan=clone(EIA_2I5E_CANONICAL_REQUEST_MANIFEST);mutate(plan);let calls=0;const result=await runAttendedApiFootballQualification({apiKey:KEY,plan,fetchImpl:async()=>{calls+=1;},sleep:async()=>{}});assert.equal(result.reason,'qualification_plan_not_canonical');assert.equal(calls,0);assert.equal(recommendResponseByteCeiling([],plan).reason,'qualification_plan_not_canonical');}
});

test('missing credential is zero-egress and exposes no credential',async()=>{let calls=0;const result=await runAttendedApiFootballQualification({apiKey:'',fetchImpl:async()=>{calls+=1;},sleep:async()=>{}});assert.equal(result.reason,'credential_unavailable');assert.equal(result.attempts,0);assert.equal(calls,0);assert.equal(resolveAttendedCredential(null).reason,'credential_unavailable');});

test('canonical attended requests are serial, fully completed, spaced, and raw-body free',async()=>{
  let calls=0,inFlight=0,maxInFlight=0;const sleeps=[];
  const result=await runAttendedApiFootballQualification({apiKey:KEY,fetchImpl:async(url,init)=>{const item=EIA_2I5E_CANONICAL_REQUEST_MANIFEST.items[calls++];inFlight+=1;maxInFlight=Math.max(maxInFlight,inFlight);assert.equal(url.origin,API_FOOTBALL_ORIGIN);assert.equal(init.method,'GET');assert.equal(init.redirect,'error');const out=response(payloadFor(item));inFlight-=1;return out;},sleep:async ms=>sleeps.push(ms)});
  assert.equal(calls,11);assert.equal(maxInFlight,1);assert.deepEqual(sleeps,Array(10).fill(1000));assert.equal(result.stoppedReason,null);assert.equal(result.responseLimit.decision,'GO');assert.ok(result.measurements.every(row=>row.responseIdentityMatched&&row.sampleSufficient&&!row.bodyRetained));assert.doesNotMatch(JSON.stringify(result),/deliberate-test-key-material/);
});

test('response identity validates exact echoed parameters and row identity per endpoint class',async()=>{
  for(const item of EIA_2I5E_CANONICAL_REQUEST_MANIFEST.items){const measured=await measureDiscardingBody(response(payloadFor(item)),{planItem:item});assert.equal(measured.ok,true,item.id);assert.deepEqual(measured.echoedResponseParameters,item.search);assert.equal(measured.responseIdentityMatched,true);assert.equal(measured.sampleSufficient,true);assert.equal(measured.bodyRetained,false);}
  const discovery=EIA_2I5E_CANONICAL_REQUEST_MANIFEST.items[0];assert.equal((await measureDiscardingBody(response(payloadFor(discovery,{parameters:{league:'3',season:'2026'}})),{planItem:discovery})).reason,'provider_response_identity_mismatch');
  assert.equal((await measureDiscardingBody(response(payloadFor(discovery,{parameters:{...discovery.search,extra:'x'}})),{planItem:discovery})).reason,'provider_response_identity_mismatch');
  assert.equal((await measureDiscardingBody(response(payloadFor(discovery,{rows:[fixture(1,3)]})),{planItem:discovery})).reason,'provider_response_identity_mismatch');
  const known=EIA_2I5E_CANONICAL_REQUEST_MANIFEST.items[5];assert.equal((await measureDiscardingBody(response(payloadFor(known,{rows:[fixture(99,48)]})),{planItem:known})).reason,'provider_response_identity_mismatch');
});

test('sample sufficiency rejects empty discovery, fixture, lineup, players, and events evidence',async()=>{
  for(const item of EIA_2I5E_CANONICAL_REQUEST_MANIFEST.items){const rows=item.endpointClass==='fixture'?[fixture(Number(item.search.id),item.competition),fixture(Number(item.search.id),item.competition)]:item.endpointClass==='lineups'||item.endpointClass==='players'?[{team:{id:49}}]:[];const measured=await measureDiscardingBody(response(payloadFor(item,{rows})),{planItem:item});assert.equal(measured.ok,false,item.id);assert.equal(measured.sampleSufficient,false,item.id);}
});

test('every first-request safety failure stops after exactly one sanitized attempt',async()=>{
  const first=EIA_2I5E_CANONICAL_REQUEST_MANIFEST.items[0];
  const cases=[
    ['provider_schema_invalid',()=>response({bad:true})],
    ['provider_response_identity_mismatch',()=>response(payloadFor(first,{parameters:{league:'3',season:'2026'}}))],
    ['qualification_pagination_unresolved',()=>response(payloadFor(first,{paging:{current:1,total:2}}))],
    ['provider_response_too_large',()=>response(payloadFor(first),{headers:{'content-length':String(EIA_2I5E_MEASUREMENT_ABORT_BYTES+1)}})],
    ['quota_headers_uncertain',()=>{const body=JSON.stringify(payloadFor(first));return new Response(body,{status:200,headers:{'content-length':String(Buffer.byteLength(body))}});}],
    ['quota_headers_uncertain',()=>new Response('{}',{status:500})],
    ['redirect_rejected',()=>response(payloadFor(first),{status:302})],['provider_authentication_failed',()=>response({}, {status:401})],['quota_exhausted',()=>response({}, {status:429})],['provider_unavailable',()=>response({}, {status:500})]
  ];
  for(const [reason,make] of cases){const {result,calls}=await runWithResponses(()=>make());assert.equal(calls,1,reason);assert.equal(result.attempts,1,reason);assert.equal(result.stoppedReason,reason);assert.ok(result.measurements.every(row=>row.bodyRetained===false));assert.doesNotMatch(JSON.stringify(result),/deliberate-test-key-material|x-apisports-key/i);}
});

test('failure after successful samples skips every remaining request',async()=>{const {result,calls}=await runWithResponses((item,call)=>call===4?response(payloadFor(item,{parameters:{league:'2',season:'2026'}})):response(payloadFor(item)));assert.equal(calls,4);assert.equal(result.attempts,4);assert.equal(result.stoppedReason,'provider_response_identity_mismatch');assert.equal(result.responseLimit.requiredManifest.filter(row=>row.skipped).length,7);});

test('complete current-contract evidence alone permits arithmetic ceiling without mutating production',()=>{const rows=completeMeasurements({'players-1636205':{actualBytes:180000}});const result=recommendResponseByteCeiling(rows);assert.equal(result.decision,'GO');assert.equal(result.observedMaximum,180000);assert.equal(result.proposedCeiling,393216);assert.equal(result.proposedCeiling%EIA_2I5E_BYTE_CEILING_QUANTUM_BYTES,0);assert.equal(result.productionConstant,null);assert.equal(API_FOOTBALL_MAX_RESPONSE_BYTES,null);assert.notEqual(EIA_2I5E_MEASUREMENT_ABORT_BYTES,result.proposedCeiling);});

test('historical R1-shaped measurements lack response identity and are NO-GO under R2',()=>{const historical=completeMeasurements().map(({expectedRequestIdentity,responseIdentityMatched,rowIdentityValidationState,sampleSufficient,...row})=>row);const result=recommendResponseByteCeiling(historical);assert.equal(result.decision,'NO-GO');assert.equal(result.reason,'required_sample_manifest_incomplete');});

test('generic caller evidence cannot mint an admitted mapping receipt or mapping GO',async()=>{const authority=issued();const complete=IDS.map((id,index)=>team(200+index,`${season}:fpl:team:${id}`));for(const row of complete){const receipt=await issueQualificationMappingReceipt({mapping:row,authority,evidence:{evidenceType:'provider_fixture_participant',stableEvidenceId:'9999',source:'caller',sourceRevision:'caller',observedAt:'2026-09-17T00:00:00Z',provenance:'asserted',qualificationMethod:'attended_provider_evidence'}});assert.equal(receipt.reason,'mapping_evidence_not_admitted');}const result=await qualifyTwentyClubMapping({authority,mappings:complete});assert.equal(result.decision,'NO-GO');assert.equal(result.verifiedPremierLeagueTeamCount,0);});

test('mapping rejects provenance-only, name/fuzzy methods, arbitrary fixture/source, mismatches, tampering, season and duplicates',async()=>{
  const authority=issued();const historical=await confirmPreviouslyQualifiedTeamMappings(authority);const [chelsea,leeds]=historical.mappings;assert.equal((await qualifyTwentyClubMapping({authority,mappings:historical.mappings})).verifiedPremierLeagueTeamCount,2);
  assert.equal((await qualifyTwentyClubMapping({authority,mappings:[team(1,`${season}:fpl:team:1`)]})).verifiedPremierLeagueTeamCount,0);
  for(const method of ['name_similarity','fuzzy_name'])assert.equal((await qualifyTwentyClubMapping({authority,mappings:[team(1,`${season}:fpl:team:1`,{method})]})).reason,'name_only_mapping_forbidden');
  const variants=[{...chelsea,providerEntityId:'999'},{...chelsea,canonicalFplId:`${season}:fpl:team:1`},{...chelsea,season:'2025-26'},{...chelsea,qualificationEvidenceReceipt:{...chelsea.qualificationEvidenceReceipt,stableEvidenceId:'9999'}},{...chelsea,qualificationEvidenceReceipt:{...chelsea.qualificationEvidenceReceipt,sourceRevision:'untrusted'}},{...chelsea,qualificationEvidenceReceipt:{...chelsea.qualificationEvidenceReceipt,integrityHash:'0'.repeat(64)}}];
  for(const row of variants)assert.equal((await qualifyTwentyClubMapping({authority,mappings:[row]})).verifiedPremierLeagueTeamCount,0);
  assert.equal((await qualifyTwentyClubMapping({authority,mappings:[chelsea,{...leeds,providerEntityId:chelsea.providerEntityId}]})).decision,'NO-GO');
  assert.equal((await qualifyTwentyClubMapping({authority,mappings:[chelsea,{...leeds,canonicalFplId:chelsea.canonicalFplId}]})).decision,'NO-GO');
});

test('Chelsea/Leeds adapter is closed, date-precision honest, exact-revision bound, and authority dependent',async()=>{const reused=await confirmPreviouslyQualifiedTeamMappings(issued());assert.equal(reused.ok,true);assert.deepEqual(reused.mappings.map(row=>row.providerEntityId).sort(),['49','63']);for(const row of reused.mappings){const receipt=row.qualificationEvidenceReceipt;assert.equal(receipt.observedAt,null);assert.equal(receipt.evidenceDate,'2026-09-09');assert.equal(receipt.timePrecision,'date');assert.equal(receipt.sourceRevision,'62865c9735095ca6b51006fadce15e0a84e68800');assert.equal(receipt.sourcePath,'docs/EIA-2I4C-API-FOOTBALL-QUALIFICATION-CLOSEOUT.md');}const blocked=await confirmPreviouslyQualifiedTeamMappings(issueOfficialFplTeamUniverseAuthority(officialFplWorld()));assert.equal(blocked.ok,false);assert.equal(blocked.mappings.length,0);});

test('Official FPL authority remains canonical, sanitized, and redirect rejecting',async()=>{const world=namedWorld();const authority=issueOfficialFplTeamUniverseAuthority(world);const sanitized=sanitizeOfficialFplAuthority(authority);assert.equal(sanitized.teams.length,20);assert.equal(Object.hasOwn(sanitized,'bootstrap'),false);let read=false;const redirect=await fetchOfficialFplAuthority({fetchImpl:async()=>({status:302,json:async()=>{read=true;}}),now:()=>'2026-09-17T06:00:00Z'});assert.equal(redirect.reason,'official_fpl_redirect_rejected');assert.equal(read,false);const urls=[];const fetched=await fetchOfficialFplAuthority({fetchImpl:async(url,options)=>{urls.push(String(url));assert.equal(options.redirect,'error');return {status:200,json:async()=>String(url).includes('bootstrap-static')?world.bootstrap:world.fixtures};},now:()=>'2026-09-17T06:00:00Z'});assert.equal(fetched.ok,true);assert.deepEqual(urls,[OFFICIAL_FPL_BOOTSTRAP_URL,OFFICIAL_FPL_FIXTURES_URL]);});

test('R2 remains isolated from production, browser, collector activation, and secrets',()=>{const source=fs.readFileSync(path.join(root,'src/decision-intelligence/api-football-prelive-qualification.mjs'),'utf8');assert.doesNotMatch(source,/process\.env|localStorage|setInterval|setTimeout|console\.|RapidAPI|collection_enabled\s*=\s*1/i);for(const file of ['src/model/minutes.mjs','src/model/scoring.mjs','src/squad.mjs','src/model/transfers.mjs','src/main.mjs','src/providers/registry.mjs','src/ui/team-decision-home.mjs','dist/index.html','index.html','build.mjs'])assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/api-football-prelive-qualification|EIA_2I5E_MAX_ATTEMPTS/i,file);const wrangler=fs.readFileSync(path.join(root,'workers/api-football-collector/wrangler.jsonc'),'utf8');assert.match(wrangler,/"crons": \[\]/);assert.match(wrangler,/00000000-0000-0000-0000-000000000000/);assert.equal(API_FOOTBALL_MAX_RESPONSE_BYTES,null);assert.equal(PREVIOUSLY_QUALIFIED_PL_TEAMS.length,2);});
