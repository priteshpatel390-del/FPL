import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  API_FOOTBALL_COLLECTION_MODE,API_FOOTBALL_DAILY_REQUEST_LIMIT,API_FOOTBALL_SOURCE_KEY,API_FOOTBALL_TARGET_COMPETITIONS,
  buildApiFootballWorkloadObservation,createApiFootballClient,createDailyRequestBudget,
  decodeApiFootballResponse,resolveApiFootballCompetition,resolveApiFootballIdentity
} from '../src/decision-intelligence/api-football-foundation.mjs';
import {classifyRights,persistenceDecision,RIGHTS_CLASSIFICATIONS} from '../src/decision-intelligence/rights.mjs';

const ownerRights=()=>({classification:'owner_risk_accepted_private_use',provider:'api-football',ownerApprovalId:'EIA-2I1',allowedUse:'private_noncommercial_research',retentionAllowed:true,redistributionAllowed:false,publicUseAllowed:false,commercialUseAllowed:false,rawPayloadRetentionAllowed:false,stopOnObjection:true,attributionRequired:false});
const envelope=(get,response)=>({get,parameters:{fixture:'9001'},errors:{},results:response.length,paging:{current:1,total:1},response});
const fixture=(status='FT')=>envelope('fixtures',[{fixture:{id:9001,date:'2026-09-01T19:00:00Z',status:{short:status}},league:{id:44,name:'Configured Cup'},teams:{home:{id:10},away:{id:20}}}]);
const lineups=({starter=true,bench=false}={})=>envelope('fixtures/lineups',[{team:{id:10},startXI:starter?[{player:{id:7,name:'Same Name'}}]:[],substitutes:bench?[{player:{id:7,name:'Same Name'}}]:[]}]);
const players=minutes=>envelope('fixtures/players',[{team:{id:10},players:minutes==='absent'?[]:[{player:{id:7,name:'Same Name'},statistics:[{games:{minutes}}]}]}]);
const events=(rows=[])=>envelope('fixtures/events',rows);
const mappings=()=>[
  {provider:'api-football',providerEntityType:'player',providerEntityId:'7',canonicalFplId:'2026-27:fpl:player:351',mappingRevision:'p1',status:'verified'},
  {provider:'api-football',providerEntityType:'team',providerEntityId:'10',canonicalFplId:'2026-27:fpl:team:1',mappingRevision:'t1',status:'verified'},
  {provider:'api-football',providerEntityType:'fixture',providerEntityId:'9001',canonicalFplId:'2026-27:fpl:fixture:500',mappingRevision:'f1',status:'verified'}
];
const competitions=()=>[{provider:'api-football',providerLeagueId:'44',targetCompetition:'fa_cup',canonicalCompetitionId:'2026-27:fpl:competition:44',competitionName:'FA Cup',enabled:true,provenance:'owner-reviewed-config-v1'}];
const input=(overrides={})=>({fixtureResponse:fixture(),lineupResponse:lineups(),playersResponse:players(90),eventsResponse:events(),providerPlayerId:7,providerTeamId:10,identityMappings:mappings(),competitionConfig:competitions(),fetchedAt:'2026-09-01T22:00:00Z',sourceRevision:'api-football-r1',rights:ownerRights(),...overrides});

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

test('identity mapping requires one verified provider-ID target and never uses names',()=>{
  assert.equal(resolveApiFootballIdentity(mappings(),{providerEntityType:'player',providerEntityId:7}).canonicalFplId,'2026-27:fpl:player:351');
  assert.equal(resolveApiFootballIdentity([],{providerEntityType:'player',providerEntityId:7}).reason,'identity_missing');
  assert.equal(resolveApiFootballIdentity([{provider:'api-football',providerEntityType:'player',providerEntityId:'7',canonicalFplId:'2026-27:fpl:player:1',mappingRevision:'p1',status:'verified'},{provider:'api-football',providerEntityType:'player',providerEntityId:'7',canonicalFplId:'2026-27:fpl:player:2',mappingRevision:'p2',status:'verified'}],{providerEntityType:'player',providerEntityId:7}).reason,'identity_ambiguous');
  assert.equal(resolveApiFootballIdentity([{provider:'api-football',providerEntityType:'player',providerEntityId:'8',displayName:'Same Name',canonicalFplId:'2026-27:fpl:player:351',status:'verified'}],{providerEntityType:'player',providerEntityId:7}).reason,'identity_missing');
  assert.equal(resolveApiFootballIdentity([{...mappings()[0],canonicalFplId:'display-name-only'}],{providerEntityType:'player',providerEntityId:7}).reason,'identity_missing');
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

test('decoder rejects malformed shape, provider errors, drift and key-like material',()=>{
  assert.equal(decodeApiFootballResponse(envelope('fixtures',[]),{endpoint:'fixtures'}).ok,true);assert.equal(decodeApiFootballResponse({...envelope('fixtures',[]),errors:[]},{endpoint:'fixtures'}).ok,true);
  for(const payload of [{...envelope('fixtures',[]),extra:true},{...envelope('fixtures',[]),get:'players'},{...envelope('fixtures',[]),results:1},{...envelope('fixtures',[]),errors:{rate:'bad'}},{...envelope('fixtures',[]),apiKey:'deliberate'}])assert.equal(decodeApiFootballResponse(payload,{endpoint:'fixtures'}).ok,false);
});

test('direct starter minutes and deterministic hash normalize without raw payload',async()=>{
  const a=await buildApiFootballWorkloadObservation(input()),b=await buildApiFootballWorkloadObservation(input());
  assert.equal(a.ok,true);assert.equal(a.observation.participation.status,'starter');assert.equal(a.observation.participation.minutes,90);assert.equal(a.observation.participation.directMinutes,true);assert.equal(a.observation.observationHash,b.observation.observationHash);
  assert.equal(a.observation.identity.canonicalPlayerId,'2026-27:fpl:player:351');assert.equal(a.observation.source.providerRecordIds.playerId,'7');assert.equal(a.observation.rights.redistributionAllowed,false);
  assert.doesNotMatch(JSON.stringify(a.observation),/startXI|statistics|x-apisports-key|deliberate-test-key-material/);
});

test('starter subbed off, substitute on, unused substitute and dismissal preserve facts',async()=>{
  const off=await buildApiFootballWorkloadObservation(input({playersResponse:players(61),eventsResponse:events([{type:'subst',player:{id:7},assist:{id:8},time:{elapsed:61,extra:null}}])}));
  assert.equal(off.observation.participation.substitutionOffMinute,61);
  const on=await buildApiFootballWorkloadObservation(input({lineupResponse:lineups({starter:false,bench:true}),playersResponse:players(29),eventsResponse:events([{type:'subst',player:{id:8},assist:{id:7},time:{elapsed:61,extra:null}}])}));
  assert.equal(on.observation.participation.status,'substitute');assert.equal(on.observation.participation.appeared,true);assert.equal(on.observation.participation.substitutionOnMinute,61);
  const unused=await buildApiFootballWorkloadObservation(input({lineupResponse:lineups({starter:false,bench:true}),playersResponse:players(0)}));
  assert.equal(unused.observation.participation.status,'not_used');assert.equal(unused.observation.participation.unusedSubstitute,true);assert.equal(unused.observation.participation.appeared,false);
  const dismissed=await buildApiFootballWorkloadObservation(input({playersResponse:players(72),eventsResponse:events([{type:'Card',detail:'Red Card',player:{id:7},time:{elapsed:72,extra:0}}])}));
  assert.deepEqual(dismissed.observation.participation.dismissal,{minute:72,redCard:true});
});

test('missing player/minutes remain unknown and extra-time direct minutes are bounded',async()=>{
  const absent=await buildApiFootballWorkloadObservation(input({lineupResponse:envelope('fixtures/lineups',[]),playersResponse:players('absent')}));
  assert.equal(absent.ok,true);assert.equal(absent.observation.participation.minutes,null);assert.equal(absent.observation.participation.appeared,null);assert.ok(absent.observation.quality.missingFields.includes('minutes'));
  const extra=await buildApiFootballWorkloadObservation(input({fixtureResponse:fixture('AET'),playersResponse:players(117)}));assert.equal(extra.ok,true);assert.equal(extra.observation.participation.extraTime,true);assert.equal(extra.observation.participation.minutes,117);
  assert.equal((await buildApiFootballWorkloadObservation(input({playersResponse:players(117)}))).reason,'minutes_invalid');
  for(const invalid of [-1,131,'ninety'])assert.equal((await buildApiFootballWorkloadObservation(input({playersResponse:players(invalid)}))).reason,'minutes_invalid');
});

test('incomplete fixtures, unsupported competitions, missing lineups and schema drift fail closed',async()=>{
  assert.equal((await buildApiFootballWorkloadObservation(input({fixtureResponse:envelope('fixtures',[])}))).reason,'fixture_incomplete');
  assert.equal((await buildApiFootballWorkloadObservation(input({competitionConfig:[]}))).reason,'competition_unsupported');
  const missingLineup=await buildApiFootballWorkloadObservation(input({lineupResponse:envelope('fixtures/lineups',[])}));assert.equal(missingLineup.ok,true);assert.equal(missingLineup.observation.participation.status,'unknown');assert.equal(missingLineup.observation.participation.starter,false);
  assert.equal((await buildApiFootballWorkloadObservation(input({eventsResponse:{...events(),newField:true}}))).reason,'provider_schema_invalid');
});

test('security and shadow topology exclude application/model paths and generated artefacts',()=>{
  const source=fs.readFileSync('src/decision-intelligence/api-football-foundation.mjs','utf8');
  assert.doesNotMatch(source,/console\.|process\.env|localStorage|setInterval|setTimeout|paid|RapidAPI/i);
  for(const file of ['src/model/minutes.mjs','src/model/scoring.mjs','src/squad.mjs','src/model/transfers.mjs','src/main.mjs','dist/index.html','index.html'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/api-football-foundation|x-apisports-key/i);
  assert.equal(API_FOOTBALL_SOURCE_KEY,'api-football');
});
