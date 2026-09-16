import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  API_FOOTBALL_COLLECTION_MODE,API_FOOTBALL_DAILY_REQUEST_LIMIT,API_FOOTBALL_ENDPOINTS,API_FOOTBALL_ORIGIN,API_FOOTBALL_REQUEST_TIMEOUT_MS,API_FOOTBALL_SOURCE_KEY,API_FOOTBALL_TARGET_COMPETITIONS,
  buildApiFootballWorkloadObservation,createApiFootballClient,createDailyRequestBudget,
  decodeApiFootballResponse,resolveApiFootballCompetition,resolveApiFootballFplIdentity,sendApiFootballRequest
} from '../src/decision-intelligence/api-football-foundation.mjs';
import {classifyRights,persistenceDecision,RIGHTS_CLASSIFICATIONS} from '../src/decision-intelligence/rights.mjs';
import {normaliseWorkloadObservation} from '../src/decision-intelligence/eia1-workload-contract.mjs';

const ownerRights=()=>({classification:'owner_risk_accepted_private_use',provider:'api-football',ownerApprovalId:'EIA-2I1',allowedUse:'private_noncommercial_research',retentionAllowed:true,redistributionAllowed:false,publicUseAllowed:false,commercialUseAllowed:false,rawPayloadRetentionAllowed:false,stopOnObjection:true,attributionRequired:false});
const envelope=(get,response)=>({get,parameters:{fixture:'9001'},errors:{},results:response.length,paging:{current:1,total:1},response});
const fixture=({status='FT',duration=90}={})=>envelope('fixtures',[{fixture:{id:9001,date:'2026-09-01T19:00:00Z',status:{short:status,...(duration===undefined?{}:{elapsed:duration})}},league:{id:44,name:'Configured Cup'},teams:{home:{id:10},away:{id:20}}}]);
const lineups=({starter=true,bench=false}={})=>envelope('fixtures/lineups',[{team:{id:10},startXI:starter?[{player:{id:7,name:'Same Name'}}]:[],substitutes:bench?[{player:{id:7,name:'Same Name'}}]:[]}]);
const players=minutes=>envelope('fixtures/players',[{team:{id:10},players:minutes==='absent'?[]:[{player:{id:7,name:'Same Name'},statistics:[{games:{minutes}}]}]}]);
const events=(rows=[])=>envelope('fixtures/events',rows);
const mappings=()=>[
  {provider:'api-football',providerEntityType:'player',providerEntityId:'7',canonicalFplId:'2026-27:fpl:player:351',mappingRevision:'p1',status:'verified'},
  {provider:'api-football',providerEntityType:'team',providerEntityId:'10',canonicalFplId:'2026-27:fpl:team:1',mappingRevision:'t1',status:'verified'}
];
const competitions=()=>[{provider:'api-football',providerLeagueId:'44',targetCompetition:'fa_cup',competitionName:'FA Cup',enabled:true,provenance:'owner-reviewed-config-v1'}];
const input=(overrides={})=>({fixtureResponse:fixture(),lineupResponse:lineups(),playersResponse:players(90),eventsResponse:events(),providerPlayerId:7,providerTeamId:10,identityMappings:mappings(),competitionConfig:competitions(),fetchedAt:'2026-09-01T22:00:00Z',sourceRevision:'api-football-r1',rights:ownerRights(),...overrides});
const contractInput=participation=>({schemaVersion:'eia1-workload-observation-v1',source:{sourceKey:'api-football'},participation:{minutes:null,...participation},quality:{missingFields:[]},rights:ownerRights()});

test('owner-risk rights are narrow, retainable, non-redistributable and malformed records fail closed',()=>{
  assert.ok(RIGHTS_CLASSIFICATIONS.includes('owner_risk_accepted_private_use'));
  const accepted=classifyRights(ownerRights());
  assert.equal(accepted.valid,true);assert.equal(accepted.retentionAllowed,true);assert.equal(accepted.redistributionAllowed,false);assert.equal(persistenceDecision(ownerRights()).ok,true);
  for(const mutation of [
    {provider:'another-provider'},{ownerApprovalId:''},{allowedUse:'public'},{retentionAllowed:false},{redistributionAllowed:true},{publicUseAllowed:true},{commercialUseAllowed:true},{rawPayloadRetentionAllowed:true},{stopOnObjection:false},{attributionRequired:true}
  ])assert.equal(classifyRights({...ownerRights(),...mutation}).valid,false);
});

test('existing rights behaviour remains fail closed',()=>{
  assert.equal(persistenceDecision({classification:'durable_allowed',retentionAllowed:true,redistributionAllowed:false,attributionRequired:false}).ok,true);
  assert.equal(persistenceDecision({classification:'attribution_required',retentionAllowed:true,redistributionAllowed:false,attributionRequired:true,attributionText:'Required credit'}).ok,true);
  for(const classification of ['local_research_only','durable_blocked','unknown_fail_closed'])assert.equal(persistenceDecision({classification,retentionAllowed:true,redistributionAllowed:false,attributionRequired:false}).ok,false);
  assert.equal(classifyRights({classification:'invented',retentionAllowed:true,attributionRequired:false}).classification,'unknown_fail_closed');
});

test('player and PL-team mapping requires one verified FPL identity and never uses names',()=>{
  assert.equal(resolveApiFootballFplIdentity(mappings(),{providerEntityType:'player',providerEntityId:7}).canonicalFplId,'2026-27:fpl:player:351');
  assert.equal(resolveApiFootballFplIdentity(mappings(),{providerEntityType:'team',providerEntityId:10}).canonicalFplId,'2026-27:fpl:team:1');
  assert.equal(resolveApiFootballFplIdentity([],{providerEntityType:'player',providerEntityId:7}).reason,'identity_missing');
  assert.equal(resolveApiFootballFplIdentity([{provider:'api-football',providerEntityType:'player',providerEntityId:'7',canonicalFplId:'2026-27:fpl:player:1',mappingRevision:'p1',status:'verified'},{provider:'api-football',providerEntityType:'player',providerEntityId:'7',canonicalFplId:'2026-27:fpl:player:2',mappingRevision:'p2',status:'verified'}],{providerEntityType:'player',providerEntityId:7}).reason,'identity_ambiguous');
  assert.equal(resolveApiFootballFplIdentity([{...mappings()[1],canonicalFplId:'2026-27:fpl:team:2',mappingRevision:'t2'},mappings()[1]],{providerEntityType:'team',providerEntityId:10}).reason,'identity_ambiguous');
  assert.equal(resolveApiFootballFplIdentity([{provider:'api-football',providerEntityType:'player',providerEntityId:'8',displayName:'Same Name',canonicalFplId:'2026-27:fpl:player:351',mappingRevision:'p1',status:'verified'}],{providerEntityType:'player',providerEntityId:7}).reason,'identity_missing');
  assert.equal(resolveApiFootballFplIdentity([{...mappings()[0],canonicalFplId:'display-name-only'}],{providerEntityType:'player',providerEntityId:7}).reason,'identity_missing');
});

test('competition support is explicit configuration, unique and provenance-bound',()=>{
  assert.equal(resolveApiFootballCompetition(competitions(),44).competitionName,'FA Cup');
  assert.equal(resolveApiFootballCompetition(competitions(),45).reason,'competition_unsupported');
  assert.equal(resolveApiFootballCompetition([...competitions(),...competitions()],44).reason,'competition_ambiguous');
  assert.deepEqual(API_FOOTBALL_TARGET_COMPETITIONS,['uefa_champions_league','uefa_europa_league','uefa_conference_league','fa_cup','league_cup']);
});

test('request budget accounts exactly and stops without paid fallback',()=>{
  const budget=createDailyRequestBudget({day:'2026-09-01',limit:2});
  assert.equal(budget.consume(),true);assert.equal(budget.used,1);assert.equal(budget.consume(),true);assert.equal(budget.consume(),false);assert.equal(budget.remaining,0);
  assert.equal(API_FOOTBALL_DAILY_REQUEST_LIMIT,100);assert.equal(API_FOOTBALL_COLLECTION_MODE,'disabled_post_match_only');
});

test('client is disabled without server secret and sanitizes network/schema/quota failures',async()=>{
  assert.deepEqual(await createApiFootballClient({fetchImpl:()=>assert.fail()}).request('fixtures'),{ok:false,reason:'provider_disabled_secret_missing'});
  const budget=createDailyRequestBudget({day:'2026-09-01',limit:1});let captured;
  const client=createApiFootballClient({apiKey:'deliberate-test-key-material',budget,fetchImpl:async(url,options)=>{captured={url:String(url),options};return {ok:false,status:500};}});
  assert.deepEqual(await client.request('fixtures',{id:9001}),{ok:false,reason:'provider_unavailable'});
  assert.equal(captured.options.headers['x-apisports-key'],'deliberate-test-key-material');assert.doesNotMatch(captured.url,/key|deliberate/);
  assert.deepEqual(await client.request('fixtures',{id:9001}),{ok:false,reason:'quota_exhausted'});
  assert.doesNotMatch(JSON.stringify(await client.request('fixtures')),/deliberate-test-key-material/);
});

test('credential-bearing requests are origin-pinned and endpoint-closed before budget or fetch',async()=>{
  for(const endpoint of ['https://attacker.test/steal','//attacker.test/steal','ftp://attacker.test/steal','unknown/path']){
    let calls=0;const budget=createDailyRequestBudget({day:'2026-09-01',limit:4});
    const client=createApiFootballClient({apiKey:'deliberate-test-key-material',budget,fetchImpl:async()=>{calls+=1;return {ok:true,json:async()=>envelope('fixtures',[])}}});
    assert.deepEqual(await client.request(endpoint,{id:9001}),{ok:false,reason:'endpoint_not_allowed'});assert.equal(calls,0);assert.equal(budget.used,0);
  }
  let captured;const budget=createDailyRequestBudget({day:'2026-09-01',limit:1});
  const client=createApiFootballClient({apiKey:'deliberate-test-key-material',budget,fetchImpl:async(url,options)=>{captured={url,options};return {ok:true,json:async()=>envelope('fixtures',[])}}});
  assert.equal((await client.request('fixtures',{id:9001})).ok,true);assert.equal(captured.url.origin,API_FOOTBALL_ORIGIN);assert.equal(captured.options.redirect,'error');assert.equal(captured.options.headers['x-apisports-key'],'deliberate-test-key-material');assert.doesNotMatch(String(captured.url),/deliberate-test-key-material|api[_-]?key/i);assert.deepEqual(API_FOOTBALL_ENDPOINTS,['fixtures','fixtures/lineups','fixtures/players','fixtures/events']);
});

test('known-ID requests abort at the repository timeout and keep generic transport distinct',async()=>{
  assert.equal(API_FOOTBALL_REQUEST_TIMEOUT_MS,15000);assert.equal(typeof AbortSignal.timeout,'function');
  function timeoutReason(){return Object.assign(new Error('timeout'),{name:'TimeoutError'});}
  function immediateTimeoutSignal(){const controller=new AbortController();controller.abort(timeoutReason());return controller.signal;}
  const seen=[];const signals=[];
  const timeoutSignal=ms=>{seen.push(ms);const signal=immediateTimeoutSignal();signals.push(signal);return signal;};
  const budget=createDailyRequestBudget({day:'2026-09-01',limit:3});
  let calls=0;
  const client=createApiFootballClient({apiKey:'deliberate-test-key-material',budget,fetchImpl:async()=>{calls+=1;return new Promise(()=>{});},timeoutSignal});
  const timedOut=await client.request('fixtures',{id:9001});
  assert.deepEqual(timedOut,{ok:false,reason:'provider_timeout'});assert.equal(calls,1);assert.equal(budget.used,1);
  assert.deepEqual(seen,[API_FOOTBALL_REQUEST_TIMEOUT_MS]);assert.equal(signals[0].aborted,true);
  assert.doesNotMatch(JSON.stringify(timedOut),/deliberate-test-key-material|x-apisports-key|TimeoutError|stack/i);
  const thrown=createApiFootballClient({apiKey:'deliberate-test-key-material',budget:createDailyRequestBudget({day:'2026-09-01',limit:1}),fetchImpl:async()=>{throw new Error('reset');}});
  assert.deepEqual(await thrown.request('fixtures',{id:9001}),{ok:false,reason:'provider_unavailable'});
  let invalidCalls=0;const invalidBudget=createDailyRequestBudget({day:'2026-09-01',limit:1});
  const invalid=createApiFootballClient({apiKey:'deliberate-test-key-material',budget:invalidBudget,fetchImpl:async()=>{invalidCalls+=1;return {ok:true};},timeoutSignal});
  assert.equal((await invalid.request('fixtures',{league:'2'})).reason,'parameters_invalid');assert.equal(invalidCalls,0);assert.equal(invalidBudget.used,0);
  const overrideMs=[];
  const sent=await sendApiFootballRequest({
    fetchImpl:async()=>new Promise(()=>{}),url:new URL('https://v3.football.api-sports.io/fixtures?id=9001'),
    init:{method:'GET',redirect:'error',headers:{}},timeoutMs:1,
    timeoutSignal:ms=>{overrideMs.push(ms);return immediateTimeoutSignal();}
  });
  assert.equal(sent.reason,'provider_timeout');assert.equal(Object.hasOwn(sent,'signal'),false);assert.deepEqual(overrideMs,[API_FOOTBALL_REQUEST_TIMEOUT_MS]);
});

test('decoder rejects malformed shape, provider errors, drift and key-like material',()=>{
  assert.equal(decodeApiFootballResponse(envelope('fixtures',[]),{endpoint:'fixtures'}).ok,true);assert.equal(decodeApiFootballResponse({...envelope('fixtures',[]),errors:[]},{endpoint:'fixtures'}).ok,true);
  for(const payload of [{...envelope('fixtures',[]),extra:true},{...envelope('fixtures',[]),get:'players'},{...envelope('fixtures',[]),results:1},{...envelope('fixtures',[]),errors:{rate:'bad'}},{...envelope('fixtures',[]),apiKey:'deliberate'}])assert.equal(decodeApiFootballResponse(payload,{endpoint:'fixtures'}).ok,false);
});

test('direct starter minutes and deterministic hash normalize without raw payload',async()=>{
  const a=await buildApiFootballWorkloadObservation(input()),b=await buildApiFootballWorkloadObservation(input());
  assert.equal(a.ok,true);assert.equal(a.observation.participation.status,'starter');assert.equal(a.observation.participation.minutes,90);assert.equal(a.observation.participation.directMinutes,true);assert.equal(a.observation.observationHash,b.observation.observationHash);
  assert.equal(a.observation.participation.starter,true);assert.equal(a.observation.participation.bench,false);
  assert.equal(a.observation.identity.canonicalPlayerId,'2026-27:fpl:player:351');assert.equal(a.observation.source.providerRecordIds.playerId,'7');assert.equal(a.observation.rights.redistributionAllowed,false);
  assert.equal(a.observation.identity.externalFixtureId,'2026-27:api-football:fixture:9001');assert.equal(a.observation.identity.externalCompetitionId,'2026-27:external:competition:fa_cup');assert.doesNotMatch(a.observation.identity.externalFixtureId,/:fpl:/);assert.doesNotMatch(a.observation.identity.externalCompetitionId,/:fpl:/);assert.equal(a.observation.source.providerRecordIds.fixtureId,'9001');assert.equal(a.observation.source.providerRecordIds.leagueId,'44');
  assert.doesNotMatch(JSON.stringify(a.observation),/startXI|statistics|x-apisports-key|deliberate-test-key-material/);
});

test('starter subbed off, substitute on, unused substitute and dismissal preserve facts',async()=>{
  const off=await buildApiFootballWorkloadObservation(input({playersResponse:players(61),eventsResponse:events([{type:'subst',player:{id:7},assist:{id:8},time:{elapsed:61,extra:null}}])}));
  assert.equal(off.observation.participation.substitutionOffMinute,61);
  const on=await buildApiFootballWorkloadObservation(input({lineupResponse:lineups({starter:false,bench:true}),playersResponse:players(29),eventsResponse:events([{type:'subst',player:{id:8},assist:{id:7},time:{elapsed:61,extra:null}}])}));
  assert.equal(on.observation.participation.status,'substitute');assert.equal(on.observation.participation.starter,false);assert.equal(on.observation.participation.bench,true);assert.equal(on.observation.participation.appeared,true);assert.equal(on.observation.participation.substitutionOnMinute,61);
  const unused=await buildApiFootballWorkloadObservation(input({lineupResponse:lineups({starter:false,bench:true}),playersResponse:players(0)}));
  assert.equal(unused.observation.participation.status,'not_used');assert.equal(unused.observation.participation.starter,false);assert.equal(unused.observation.participation.bench,true);assert.equal(unused.observation.participation.unusedSubstitute,true);assert.equal(unused.observation.participation.appeared,false);
  const dismissed=await buildApiFootballWorkloadObservation(input({playersResponse:players(72),eventsResponse:events([{type:'Card',detail:'Red Card',player:{id:7},time:{elapsed:72,extra:0}}])}));
  assert.deepEqual(dismissed.observation.participation.dismissal,{minute:72,redCard:true});
});

test('duration qualification keeps FT, AET and PEN extra time tri-state without deriving it from direct minutes',async()=>{
  const absent=await buildApiFootballWorkloadObservation(input({lineupResponse:envelope('fixtures/lineups',[]),playersResponse:players('absent')}));
  assert.equal(absent.ok,true);assert.equal(absent.observation.participation.minutes,null);assert.equal(absent.observation.participation.appeared,null);assert.ok(absent.observation.quality.missingFields.includes('minutes'));
  const ft=await buildApiFootballWorkloadObservation(input());assert.equal(ft.observation.participation.extraTime,false);assert.equal(ft.observation.fixture.authoritativeDurationMinutes,90);
  const aet=await buildApiFootballWorkloadObservation(input({fixtureResponse:fixture({status:'AET',duration:120}),playersResponse:players(117)}));assert.equal(aet.ok,true);assert.equal(aet.observation.participation.extraTime,true);assert.equal(aet.observation.fixture.authoritativeDurationMinutes,120);
  const ambiguousPen=await buildApiFootballWorkloadObservation(input({fixtureResponse:fixture({status:'PEN',duration:120}),playersResponse:players(117)}));assert.equal(ambiguousPen.ok,true);assert.equal(ambiguousPen.observation.participation.extraTime,null);assert.equal(ambiguousPen.observation.fixture.authoritativeDurationMinutes,null);assert.equal(ambiguousPen.observation.participation.minutes,117);
  const penExtra=await buildApiFootballWorkloadObservation(input({fixtureResponse:fixture({status:'PEN',duration:120}),playersResponse:players(117),durationQualifications:[{provider:'api-football',providerFixtureId:'9001',verified:true,extraTimeStatus:'played',authoritativeDurationMinutes:120,provenance:'competition-round-rules-r1'}]}));assert.equal(penExtra.ok,true);assert.equal(penExtra.observation.participation.extraTime,true);assert.equal(penExtra.observation.fixture.authoritativeDurationMinutes,120);
  assert.equal(penExtra.observation.provenance.durationQualificationProvenance,'competition-round-rules-r1');
  const penNoExtra=await buildApiFootballWorkloadObservation(input({fixtureResponse:fixture({status:'PEN',duration:120}),playersResponse:players(90),durationQualifications:[{provider:'api-football',providerFixtureId:'9001',verified:true,extraTimeStatus:'not_played',authoritativeDurationMinutes:90,provenance:'competition-round-rules-r1'}]}));assert.equal(penNoExtra.ok,true);assert.equal(penNoExtra.observation.participation.extraTime,false);assert.equal(penNoExtra.observation.fixture.authoritativeDurationMinutes,90);
  const penUnknown=await buildApiFootballWorkloadObservation(input({fixtureResponse:fixture({status:'PEN',duration:null}),playersResponse:players(90)}));assert.equal(penUnknown.ok,true);assert.equal(penUnknown.observation.participation.extraTime,null);assert.equal(penUnknown.observation.fixture.authoritativeDurationMinutes,null);
  const directWithoutDuration=await buildApiFootballWorkloadObservation(input({fixtureResponse:fixture({status:'PEN',duration:null}),playersResponse:players(117)}));assert.equal(directWithoutDuration.ok,true);assert.equal(directWithoutDuration.observation.participation.minutes,117);assert.equal(directWithoutDuration.observation.participation.extraTime,null);
  const inconsistentAet=await buildApiFootballWorkloadObservation(input({fixtureResponse:fixture({status:'AET',duration:90}),playersResponse:players(90)}));assert.equal(inconsistentAet.ok,true);assert.equal(inconsistentAet.observation.participation.extraTime,null);assert.equal(inconsistentAet.observation.fixture.authoritativeDurationMinutes,null);
  const incompleteFt=await buildApiFootballWorkloadObservation(input({fixtureResponse:fixture({status:'FT',duration:null}),playersResponse:players(90)}));assert.equal(incompleteFt.ok,true);assert.equal(incompleteFt.observation.participation.extraTime,null);assert.equal(incompleteFt.observation.fixture.authoritativeDurationMinutes,null);
  assert.equal((await buildApiFootballWorkloadObservation(input({fixtureResponse:fixture({status:'PEN',duration:120}),durationQualifications:[{provider:'api-football',providerFixtureId:'9001',verified:true,extraTimeStatus:'played',authoritativeDurationMinutes:90,provenance:'bad'}]}))).reason,'duration_qualification_invalid');
  const qualified={provider:'api-football',providerFixtureId:'9001',verified:true,extraTimeStatus:'played',authoritativeDurationMinutes:120,provenance:'one'};
  assert.equal((await buildApiFootballWorkloadObservation(input({fixtureResponse:fixture({status:'PEN',duration:120}),durationQualifications:[qualified,{...qualified,provenance:'two'}]}))).reason,'duration_qualification_ambiguous');
  assert.equal((await buildApiFootballWorkloadObservation(input({fixtureResponse:fixture({status:'AET',duration:'120'}),playersResponse:players(117)}))).reason,'duration_invalid');
  const maximum=await buildApiFootballWorkloadObservation(input({fixtureResponse:fixture({status:'AET',duration:130}),playersResponse:players(130)}));assert.equal(maximum.ok,true);assert.equal(maximum.observation.participation.minutes,130);
  for(const invalid of [-1,131,'ninety'])assert.equal((await buildApiFootballWorkloadObservation(input({playersResponse:players(invalid)}))).reason,'minutes_invalid');
});

test('owner-risk workload retention is source-bound and local research behavior is unchanged',async()=>{
  const base=contractInput({status:'unknown',starter:null,bench:null});
  assert.ok((await normaliseWorkloadObservation(base)).observationHash);
  await assert.rejects(normaliseWorkloadObservation({...base,source:{sourceKey:'another-provider'}}),/rights_source_mismatch/);
  await assert.rejects(normaliseWorkloadObservation({...base,source:{}}),/rights_source_mismatch/);
  assert.ok((await normaliseWorkloadObservation({...base,source:{sourceKey:'legacy-research'},rights:{classification:'local_research_only'}})).observationHash);
  await assert.rejects(normaliseWorkloadObservation({...base,rights:{classification:'durable_allowed',retentionAllowed:true,redistributionAllowed:false,attributionRequired:false}}),/retention_not_fail_closed/);
});

test('reusable workload contract enforces complete lineup state matrix',async()=>{
  for(const participation of [
    {status:'starter',starter:true,bench:false},
    {status:'substitute',starter:false,bench:true},
    {status:'not_used',starter:false,bench:true,minutes:0},
    {status:'unknown',starter:null,bench:null}
  ])assert.ok((await normaliseWorkloadObservation(contractInput(participation))).observationHash);
  for(const participation of [
    {status:'starter',starter:true,bench:true},{status:'starter',starter:true,bench:null},{status:'starter',starter:false,bench:false},
    {status:'substitute',starter:false,bench:false},{status:'substitute',starter:false,bench:null},{status:'substitute',starter:true,bench:true},
    {status:'not_used',starter:false,bench:false,minutes:0},{status:'not_used',starter:false,bench:null,minutes:0},{status:'not_used',starter:true,bench:true,minutes:0},
    {status:'unknown',starter:null,bench:false},{status:'unknown',starter:false,bench:null},{status:'unknown',starter:false,bench:false},{status:'unknown',starter:null,bench:true},
    {status:'unknown',starter:undefined,bench:undefined}
  ])await assert.rejects(normaliseWorkloadObservation(contractInput(participation)),/lineup_semantics/);
  await assert.rejects(normaliseWorkloadObservation(contractInput({status:'not_used',starter:false,bench:true,minutes:null})),/not_used_minutes/);
});

test('fetchedAt and sourceRevision require bounded explicit provenance',async()=>{
  assert.equal((await buildApiFootballWorkloadObservation(input())).ok,true);
  for(const fetchedAt of [null,'','not-a-date','2026-02-31T22:00:00Z',0,true])assert.equal((await buildApiFootballWorkloadObservation(input({fetchedAt}))).reason,'provenance_invalid');
  for(const sourceRevision of [undefined,'',' '.repeat(2),'x'.repeat(129)])assert.equal((await buildApiFootballWorkloadObservation(input({sourceRevision}))).reason,'provenance_invalid');
});

test('incomplete fixtures, unsupported competitions, missing lineups and schema drift fail closed',async()=>{
  assert.equal((await buildApiFootballWorkloadObservation(input({fixtureResponse:envelope('fixtures',[])}))).reason,'fixture_incomplete');
  assert.equal((await buildApiFootballWorkloadObservation(input({competitionConfig:[]}))).reason,'competition_unsupported');
  const missingLineup=await buildApiFootballWorkloadObservation(input({lineupResponse:envelope('fixtures/lineups',[])}));assert.equal(missingLineup.ok,true);assert.equal(missingLineup.observation.participation.status,'unknown');assert.equal(missingLineup.observation.participation.starter,null);assert.equal(missingLineup.observation.participation.bench,null);assert.ok(missingLineup.observation.quality.missingFields.includes('lineupStatus'));
  assert.equal((await buildApiFootballWorkloadObservation(input({eventsResponse:{...events(),newField:true}}))).reason,'provider_schema_invalid');
});

test('missing or unqualified lineup evidence stays tri-state while appearance evidence remains independent',async()=>{
  const noEvidence=await buildApiFootballWorkloadObservation(input({lineupResponse:envelope('fixtures/lineups',[]),playersResponse:players('absent')}));
  assert.deepEqual({status:noEvidence.observation.participation.status,starter:noEvidence.observation.participation.starter,bench:noEvidence.observation.participation.bench,appeared:noEvidence.observation.participation.appeared},{status:'unknown',starter:null,bench:null,appeared:null});assert.ok(noEvidence.observation.quality.missingFields.includes('lineupStatus'));
  const direct=await buildApiFootballWorkloadObservation(input({lineupResponse:envelope('fixtures/lineups',[]),playersResponse:players(25)}));
  assert.deepEqual({status:direct.observation.participation.status,starter:direct.observation.participation.starter,bench:direct.observation.participation.bench,appeared:direct.observation.participation.appeared},{status:'unknown',starter:null,bench:null,appeared:true});
  const substitution=await buildApiFootballWorkloadObservation(input({lineupResponse:envelope('fixtures/lineups',[]),playersResponse:players('absent'),eventsResponse:events([{type:'subst',player:{id:8},assist:{id:7},time:{elapsed:65,extra:0}}])}));
  assert.deepEqual({status:substitution.observation.participation.status,starter:substitution.observation.participation.starter,bench:substitution.observation.participation.bench,appeared:substitution.observation.participation.appeared,substitutionOnMinute:substitution.observation.participation.substitutionOnMinute},{status:'unknown',starter:null,bench:null,appeared:true,substitutionOnMinute:65});
  const absentFromTeamLineup=await buildApiFootballWorkloadObservation(input({lineupResponse:lineups({starter:false,bench:false}),playersResponse:players('absent')}));
  assert.deepEqual({status:absentFromTeamLineup.observation.participation.status,starter:absentFromTeamLineup.observation.participation.starter,bench:absentFromTeamLineup.observation.participation.bench},{status:'unknown',starter:null,bench:null});assert.ok(absentFromTeamLineup.observation.quality.missingFields.includes('lineupStatus'));
});

test('security and shadow topology exclude application/model paths and generated artefacts',()=>{
  const source=fs.readFileSync('src/decision-intelligence/api-football-foundation.mjs','utf8');
  assert.doesNotMatch(source,/console\.|process\.env|localStorage|setInterval|setTimeout|paid|RapidAPI/i);
  assert.match(source,/API_FOOTBALL_REQUEST_TIMEOUT_MS=15000/);
  assert.match(source,/timeoutSignal=AbortSignal\.timeout/);
  for(const file of ['src/model/minutes.mjs','src/model/scoring.mjs','src/squad.mjs','src/model/transfers.mjs','src/main.mjs','dist/index.html','index.html'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/api-football-foundation|x-apisports-key/i);
  assert.equal(API_FOOTBALL_SOURCE_KEY,'api-football');
});
