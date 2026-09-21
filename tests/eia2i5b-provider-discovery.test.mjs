import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  API_FOOTBALL_COLLECTION_MODE,API_FOOTBALL_ENDPOINTS,API_FOOTBALL_ORIGIN,API_FOOTBALL_REQUEST_TIMEOUT_MS,buildPinnedApiFootballUrl,
  createApiFootballClient,createDailyRequestBudget,normalizeApiFootballQuotaHeaders,sendApiFootballRequest
} from '../src/decision-intelligence/api-football-foundation.mjs';
import {
  API_FOOTBALL_DISCOVERY_ATTEMPT_GAP_MS,API_FOOTBALL_DISCOVERY_MAX_ATTEMPTS_PER_QUERY,API_FOOTBALL_DISCOVERY_MAX_SCAN_ATTEMPTS,
  API_FOOTBALL_DISCOVERY_MODE,API_FOOTBALL_FPL_SEASON,API_FOOTBALL_PROVIDER_SEASON,apiFootballDiscoveryPlan,
  buildApiFootballDiscoveryRequest,mappingCoverage,qualifyDiscoveredFixture,runApiFootballDiscoveryScan
} from '../src/decision-intelligence/api-football-discovery.mjs';
import {apiFootballFixtureIdentity,apiFootballTeamIdentity,crossSourceQualify,currentSeasonOfficialFplTeamIdentities,issueOfficialFplTeamUniverseAuthority,OFFICIAL_FPL_SCHEMA_VERSION,OFFICIAL_FPL_SOURCE_KEY,OFFICIAL_FPL_SOURCE_REVISION_ID,OFFICIAL_FPL_TEAM_UNIVERSE_KIND,OFFICIAL_FPL_TRANSFORM_VERSION,OFFICIAL_FPL_VALIDATION_VERSION,verifyOfficialFplTeamUniverseAuthority} from '../src/decision-intelligence/api-football-shadow-contracts.mjs';
import {normaliseOfficialFplHistory as diNormaliseOfficialFplHistory} from '../src/decision-intelligence/official-fpl-history-canonical.mjs';
import {OFFICIAL_FPL_SOURCE_KEY as PLATFORM_OFFICIAL_FPL_SOURCE_KEY} from '../workers/data-platform/data-platform-core.mjs';
import {DATA_S2_SCHEMA_VERSION,DATA_S2_SOURCE_REVISION_ID,DATA_S2_TRANSFORM_VERSION,DATA_S2_VALIDATION_VERSION,normaliseOfficialFplHistory} from '../workers/data-platform/official-fpl-canonical.mjs';

const KEY='deliberate-test-key-material';
const season=API_FOOTBALL_FPL_SEASON;
const rights=()=>({classification:'owner_risk_accepted_private_use',provider:'api-football',ownerApprovalId:'EIA-2I1',allowedUse:'private_noncommercial_research',retentionAllowed:true,redistributionAllowed:false,publicUseAllowed:false,commercialUseAllowed:false,rawPayloadRetentionAllowed:false,stopOnObjection:true,attributionRequired:false});
const team=(providerEntityId,canonicalFplId,status='VERIFIED')=>({provider:'api-football',entityType:'team',providerEntityId:String(providerEntityId),canonicalFplId,mappingRevision:'r1',revision:1,status,season,method:'manually_verified',provenance:'owner-reviewed'});
const CURRENT_PL_TEAM_IDS=Object.freeze([1,2,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,19,20,21]);
function clubRows(ids=CURRENT_PL_TEAM_IDS){return ids.map(id=>({id,name:`Club ${id}`,short_name:`C${id}`}));}
function officialFplWorld(overrides={}){
  const teamIds=overrides.teamIds||CURRENT_PL_TEAM_IDS;
  const events=overrides.events||Array.from({length:38},(_,i)=>({id:i+1,name:`Gameweek ${i+1}`,deadline_time:new Date(Date.UTC(2026,7,15+i*7,10)).toISOString()}));
  const teams=overrides.teams||teamIds.map((id,i)=>({
    id,name:`Team ${id}`,short_name:`T${String(id).padStart(2,'0')}`,
    strength:1000+i,strength_overall_home:1001+i,strength_overall_away:999+i,
    strength_attack_home:1002+i,strength_attack_away:998+i,strength_defence_home:1003+i,strength_defence_away:997+i
  }));
  const element_types=overrides.element_types||[1,2,3,4].map(id=>({id}));
  const elements=overrides.elements||Array.from({length:401},(_,i)=>({
    id:i+1,team:teamIds[i%teamIds.length],element_type:i%4+1,web_name:`Player ${i+1}`,now_cost:45+i%100,status:'a',
    chance_of_playing_next_round:null,chance_of_playing_this_round:null,news:'',news_added:null,
    selected_by_percent:String((i%500)/10)
  }));
  const fixtures=overrides.fixtures||Array.from({length:300},(_,i)=>{
    const home=teamIds[i%teamIds.length];const away=teamIds[(i+7)%teamIds.length];
    return {id:i+1,event:i%38+1,kickoff_time:new Date(Date.UTC(2026,7,15+i,14)).toISOString(),team_h:home,team_a:away,team_h_difficulty:2+i%4,team_a_difficulty:2+(i+1)%4};
  });
  return {bootstrap:{events,teams,elements,element_types},fixtures,season:overrides.season||season,fetchedAt:overrides.fetchedAt||'2026-09-16T11:00:00.000Z'};
}
function labeledSnapshot(overrides={}){
  return {
    sourceKey:OFFICIAL_FPL_SOURCE_KEY,sourceKind:'official_fpl',sourceRevisionId:OFFICIAL_FPL_SOURCE_REVISION_ID,
    schemaVersion:OFFICIAL_FPL_SCHEMA_VERSION,validationVersion:OFFICIAL_FPL_VALIDATION_VERSION,transformVersion:OFFICIAL_FPL_TRANSFORM_VERSION,
    season,fetchedAt:'2026-09-16T11:00:00.000Z',teams:clubRows(),...overrides
  };
}
function issuedAuthority(overrides={}){return issueOfficialFplTeamUniverseAuthority(officialFplWorld(overrides));}
const officialAuthority=issuedAuthority();
const maps=[team(49,`${season}:fpl:team:6`),team(63,`${season}:fpl:team:13`)];
const headers=(values={})=>({get(name){const key=String(name).toLowerCase();return values[key]??values[name]??null;},...values});
const envelope=(league,rows)=>({get:'fixtures',parameters:{league:String(league),season:'2026'},errors:{},results:rows.length,paging:{current:1,total:1},response:rows});
const row=({id,league,home,away,date='2026-09-16T19:00:00+00:00',status='NS'}={})=>({
  fixture:{id,date,status:{short:status,long:'Not Started',elapsed:null},venue:{id:1,name:'Ignored',city:'Ignored'},referee:'Ignored'},
  league:{id:league,name:'Ignored Cup',season:2026,round:'Ignored',logo:'https://ignored.test/league.png'},
  teams:{home:{id:home,name:'Home FC',logo:'https://ignored.test/home.png'},away:{id:away,name:'Away FC',logo:'https://ignored.test/away.png'}},
  goals:{home:null,away:null},score:{halftime:{home:null,away:null},fulltime:{home:null,away:null}}
});
const chelseaLeeds=row({id:1636205,league:48,home:49,away:63,date:'2026-09-09T19:00:00Z',status:'NS'});
const nonPl=row({id:9002,league:45,home:49,away:900,date:'2026-09-17T14:00:00Z',status:'NS'});
const payloads={
  '2':envelope(2,[row({id:2001,league:2,home:49,away:531})]),
  '3':envelope(3,[row({id:3001,league:3,home:63,away:532})]),
  '848':envelope(848,[row({id:8481,league:848,home:49,away:533})]),
  '45':envelope(45,[nonPl]),
  '48':envelope(48,[chelseaLeeds])
};
const chelseaLeedsFixture={
  identity:'2026-27:api-football:fixture:1636205',providerFixtureId:'1636205',providerLeagueId:'48',canonicalCompetitionId:'league_cup',
  fplSeason:season,providerHomeTeamId:'49',providerAwayTeamId:'63',providerSeason:2026,
  kickoffObservation:{value:'2026-09-09T19:00:00.000Z',source:'api-football',sourceRevision:'r1'}
};
const candidate=(overrides={})=>({providerFixtureId:'1636205',fixtureId:'club-1',season,canonicalCompetitionId:'league_cup',homeTeamIdentity:`${season}:fpl:team:6`,awayTeamIdentity:`${season}:fpl:team:13`,identitiesResolved:true,identityResolutionMethod:'verified_identity_crosswalk',identityResolutionProvenance:'club-site',...overrides});
function planItem(league){return apiFootballDiscoveryPlan().items.find(item=>item.providerLeagueId===String(league));}
function mockFetch(handler){
  let inFlight=0,maxInFlight=0,calls=[];
  const fetchImpl=async(url,options)=>{
    inFlight+=1;maxInFlight=Math.max(maxInFlight,inFlight);calls.push({url,options,href:String(url)});
    try{return await handler(url,options,calls.length);}finally{inFlight-=1;}
  };
  return {fetchImpl,calls,get maxInFlight(){return maxInFlight;}};
}
function successFetch(){
  return mockFetch(async url=>{
    const league=url.searchParams.get('league');
    return {ok:true,status:200,headers:headers({'x-ratelimit-requests-limit':'7500','x-ratelimit-requests-remaining':'7495','X-RateLimit-Limit':'300','X-RateLimit-Remaining':'299'}),json:async()=>payloads[league]};
  });
}
const delays=[];
const sleepImpl=async ms=>{delays.push(ms);};
const nowImpl=()=>'2026-09-16T11:00:00.000Z';
function scanOptions(overrides={}){
  delays.length=0;
  const transport=overrides.transport||successFetch();
  return {apiKey:KEY,fetchImpl:transport.fetchImpl,sleepImpl,budget:createDailyRequestBudget({day:'2026-09-16',limit:10}),nowImpl,sourceRevision:'api-football-discovery-r1',rights:rights(),teamMappings:maps,transport,...overrides};
}

test('discovery plan is exactly five repository-controlled 2026 queries',()=>{
  const plan=apiFootballDiscoveryPlan();
  assert.equal(plan.ok,true);assert.equal(plan.items.length,5);assert.equal(plan.providerSeason,2026);assert.equal(plan.fplSeason,'2026-27');
  assert.deepEqual(plan.items.map(item=>item.providerLeagueId),['2','3','848','45','48']);
  assert.deepEqual(plan.items.map(item=>item.logicalCompetitionKey),['uefa_champions_league','uefa_europa_league','uefa_conference_league','fa_cup','league_cup']);
  assert.ok(plan.items.every(item=>item.providerSeason===2026&&item.endpoint==='fixtures'&&item.liveCollectionEnabled===false));
  assert.equal(apiFootballDiscoveryPlan('2025-26').reason,'season_not_allowed');
  assert.equal(API_FOOTBALL_PROVIDER_SEASON,2026);assert.equal(API_FOOTBALL_FPL_SEASON,'2026-27');
});

test('arbitrary leagues, seasons, parameters, endpoints and origins fail before fetch',async()=>{
  assert.equal(buildApiFootballDiscoveryRequest({providerLeagueId:'39',providerSeason:2026}).reason,'league_not_allowed');
  assert.equal(buildApiFootballDiscoveryRequest({providerLeagueId:'2',providerSeason:2025}).reason,'season_not_allowed');
  assert.equal(buildApiFootballDiscoveryRequest({parameters:{league:'2',season:'2026',timezone:'UTC'}}).reason,'parameters_invalid');
  assert.equal(buildApiFootballDiscoveryRequest({endpoint:'fixtures/lineups',providerLeagueId:'2',providerSeason:2026}).reason,'endpoint_not_allowed');
  assert.equal(buildApiFootballDiscoveryRequest({endpoint:'players',providerLeagueId:'2'}).reason,'endpoint_not_allowed');
  for(const url of ['https://attacker.test/steal','//attacker.test/steal','ftp://attacker.test/steal','https://v3.football.api-sports.io/fixtures?league=2&season=2026']){
    assert.equal(buildApiFootballDiscoveryRequest({url,providerLeagueId:'2',providerSeason:2026}).reason,'endpoint_not_allowed');
  }
  assert.equal(buildPinnedApiFootballUrl('https://attacker.test/steal',{league:'2'}).reason,'endpoint_not_allowed');
  assert.equal(buildPinnedApiFootballUrl('//attacker.test/steal',{id:'1'}).reason,'endpoint_not_allowed');
  let calls=0;
  const known=createApiFootballClient({apiKey:KEY,budget:createDailyRequestBudget({day:'2026-09-16',limit:1}),fetchImpl:async()=>{calls+=1;return {ok:true,json:async()=>({})};}});
  assert.equal((await known.request('fixtures',{league:'2',season:'2026'})).reason,'parameters_invalid');assert.equal(calls,0);
});

test('invalid discovery requests consume zero quota and never include the credential',async()=>{
  const budget=createDailyRequestBudget({day:'2026-09-16',limit:3});let calls=0;
  const fetchImpl=async()=>{calls+=1;return {ok:true,status:200,json:async()=>({})};};
  for(const input of [
    {providerLeagueId:'1',providerSeason:2026},{providerLeagueId:'2',providerSeason:2019},{endpoint:'fixtures/events',providerLeagueId:'2',providerSeason:2026},
    {url:'https://example.test',providerLeagueId:'2',providerSeason:2026},{parameters:{id:'1636205'}}
  ]){
    const built=buildApiFootballDiscoveryRequest(input);assert.equal(built.ok,false);assert.equal(budget.used,0);assert.equal(calls,0);
    assert.doesNotMatch(JSON.stringify(built),/deliberate-test-key-material|x-apisports-key/i);
  }
  const disabled=await runApiFootballDiscoveryScan({fetchImpl,sleepImpl,budget,nowImpl,sourceRevision:'r1',rights:rights()});
  assert.equal(disabled.reason,'provider_disabled_secret_missing');assert.equal(calls,0);assert.equal(budget.used,0);
  const rightsDenied=await runApiFootballDiscoveryScan({apiKey:KEY,fetchImpl,sleepImpl,budget,nowImpl,sourceRevision:'r1',rights:{classification:'durable_allowed',retentionAllowed:true,redistributionAllowed:false,attributionRequired:false}});
  assert.equal(rightsDenied.reason,'rights_invalid');assert.equal(calls,0);
});

test('credential is header-only, origin-pinned, GET, redirect-error and absent from output',async()=>{
  const options=scanOptions();const scan=await runApiFootballDiscoveryScan(options);
  assert.equal(scan.ok,true);assert.equal(options.transport.calls.length,5);
  for(const call of options.transport.calls){
    assert.equal(call.url.origin,API_FOOTBALL_ORIGIN);assert.equal(call.options.method,'GET');assert.equal(call.options.redirect,'error');
    assert.equal(call.options.headers['x-apisports-key'],KEY);assert.doesNotMatch(call.href,/deliberate-test-key-material|api[_-]?key/i);
    assert.equal(call.options.signal.aborted,false);assert.notEqual(call.options.signal,undefined);
    assert.equal(call.url.searchParams.get('league')!=null,true);assert.equal(call.url.searchParams.get('season'),'2026');
    assert.equal(call.url.pathname,'/fixtures');assert.deepEqual([...call.url.searchParams.keys()].sort(),['league','season']);
  }
  const serial=JSON.stringify(scan);assert.doesNotMatch(serial,/deliberate-test-key-material|x-apisports-key|Home FC|Away FC|Ignored|referee|logo|startXI|statistics/i);
  assert.equal(scan.origin,API_FOOTBALL_ORIGIN);assert.equal(scan.mode,API_FOOTBALL_DISCOVERY_MODE);assert.equal(scan.collectionMode,API_FOOTBALL_COLLECTION_MODE);
});

test('redirects are rejected without retry and requests stay serial',async()=>{
  const transport=mockFetch(async()=>({ok:false,status:302,headers:headers(),json:async()=>({})}));
  const scan=await runApiFootballDiscoveryScan(scanOptions({transport,budget:createDailyRequestBudget({day:'2026-09-16',limit:10})}));
  assert.equal(scan.ok,false);assert.ok(scan.audit.every(row=>row.category==='redirect_rejected'&&row.attemptNumber===1));
  assert.equal(transport.calls.length,5);assert.equal(transport.maxInFlight,1);
  const serial=successFetch();const clean=await runApiFootballDiscoveryScan(scanOptions({transport:serial}));
  assert.equal(clean.ok,true);assert.equal(serial.maxInFlight,1);assert.equal(serial.calls.length,5);
});

test('a clean scan makes five serial attempts, delays one second, and cannot exceed ten',async()=>{
  const options=scanOptions();const scan=await runApiFootballDiscoveryScan(options);
  assert.equal(scan.ok,true);assert.equal(scan.attempts,5);assert.equal(options.transport.calls.length,5);
  assert.deepEqual(delays,[1000,1000,1000,1000]);assert.equal(API_FOOTBALL_DISCOVERY_ATTEMPT_GAP_MS,1000);
  assert.equal(API_FOOTBALL_DISCOVERY_MAX_SCAN_ATTEMPTS,10);assert.equal(API_FOOTBALL_DISCOVERY_MAX_ATTEMPTS_PER_QUERY,2);
  let throws=0;const retryTransport=mockFetch(async()=>{throws+=1;if(throws%2===1)throw new Error('temporary');return {ok:true,status:200,headers:headers(),json:async()=>payloads[retryTransport.calls[retryTransport.calls.length-1].url.searchParams.get('league')]};});
  delays.length=0;const retried=await runApiFootballDiscoveryScan(scanOptions({transport:retryTransport,budget:createDailyRequestBudget({day:'2026-09-16',limit:10})}));
  assert.equal(retried.ok,true);assert.equal(retried.attempts,10);assert.equal(retryTransport.calls.length,10);
  assert.ok(retried.audit.filter(row=>row.logicalCompetitionKey==='fa_cup').length<=2);
});

test('429 stops the scan, authentication and schema failures are not retried',async()=>{
  const transport429=mockFetch(async(url,options,n)=>n===2?{ok:false,status:429,headers:headers({'x-ratelimit-requests-remaining':'0'})}:{ok:true,status:200,headers:headers(),json:async()=>payloads[url.searchParams.get('league')]});
  const stopped=await runApiFootballDiscoveryScan(scanOptions({transport:transport429}));
  assert.equal(stopped.scanState,'stopped_quota_exhausted');assert.equal(stopped.attempts,2);assert.equal(transport429.calls.length,2);
  assert.equal(stopped.audit.at(-1).category,'quota_exhausted');assert.equal(stopped.fixtures.length,0);assert.equal(stopped.ok,false);
  const auth=mockFetch(async()=>({ok:false,status:401,headers:headers()}));
  const authScan=await runApiFootballDiscoveryScan(scanOptions({transport:auth}));
  assert.equal(auth.calls.length,5);assert.ok(authScan.audit.every(row=>row.category==='authentication_failure'&&row.attemptNumber===1));
  const schema=mockFetch(async()=>({ok:true,status:200,headers:headers(),json:async()=>({...envelope(2,[]),extra:true})}));
  const schemaScan=await runApiFootballDiscoveryScan(scanOptions({transport:schema}));
  assert.equal(schema.calls.length,5);assert.ok(schemaScan.audit.every(row=>row.category==='provider_schema_invalid'&&row.attemptNumber===1));
});

test('quota headers normalize case-insensitively and malformed values fail closed',()=>{
  const known=normalizeApiFootballQuotaHeaders(headers({'X-RateLimit-Requests-Limit':'7500','x-ratelimit-requests-remaining':'7499','x-ratelimit-limit':'300','x-ratelimit-remaining':'299'}));
  assert.equal(known.ok,true);assert.equal(known.state,'known');assert.equal(known.requestsLimit,7500);assert.equal(known.remaining,299);
  const missing=normalizeApiFootballQuotaHeaders(headers());assert.equal(missing.ok,true);assert.equal(missing.state,'unknown');assert.equal(missing.requestsLimit,null);
  assert.equal(normalizeApiFootballQuotaHeaders(headers({'x-ratelimit-requests-limit':'unlimited'})).reason,'quota_headers_invalid');
  assert.equal(normalizeApiFootballQuotaHeaders(headers({'x-ratelimit-remaining':'-1'})).reason,'quota_headers_invalid');
});

test('normalized discovery retains identity facts only and reuses EIA-2I5A qualification',async()=>{
  const scan=await runApiFootballDiscoveryScan(scanOptions());
  const leagueCup=scan.fixtures.find(row=>row.providerFixtureId==='1636205');
  const faCup=scan.fixtures.find(row=>row.providerFixtureId==='9002');
  assert.equal(leagueCup.identity,'2026-27:api-football:fixture:1636205');
  assert.equal(leagueCup.identity,apiFootballFixtureIdentity({season,providerFixtureId:'1636205'}));
  assert.equal(leagueCup.providerHomeTeamId,'49');assert.equal(leagueCup.providerAwayTeamId,'63');
  assert.equal(leagueCup.qualification.state,'PROVIDER_QUALIFIED');assert.equal(leagueCup.workloadRelevant,true);
  assert.equal(faCup.awayTeamIdentity,apiFootballTeamIdentity({season,providerTeamId:'900'}));assert.equal(faCup.awayIdentityScope,'PROVIDER');assert.equal(faCup.workloadRelevant,true);
  const serial=JSON.stringify(scan);assert.doesNotMatch(serial,/"response"|venue|referee|logo|Home FC|round/);
  const moved=qualifyDiscoveredFixture({...leagueCup,kickoffObservation:{value:'2026-09-16T19:15:00.000Z',source:'api-football',sourceRevision:'r2'}},{teamMappings:maps});
  assert.equal(moved.identity,leagueCup.identity);assert.equal(moved.qualification.state,'PROVIDER_QUALIFIED');
});

test('names never map, contradictory verified mappings conflict, and missing mappings stay unmapped',()=>{
  const discovered={identity:'2026-27:api-football:fixture:1',providerFixtureId:'1',providerLeagueId:'45',canonicalCompetitionId:'fa_cup',fplSeason:season,providerHomeTeamId:'49',providerAwayTeamId:'900',providerSeason:2026,kickoffObservation:{value:'2026-09-16T19:00:00.000Z',source:'api-football',sourceRevision:'r1'},statusObservation:{value:'NS',source:'api-football',sourceRevision:'r1'}};
  const named=qualifyDiscoveredFixture(discovered,{teamMappings:[{...maps[0],providerEntityId:'999',canonicalFplId:`${season}:fpl:team:6`,displayName:'Home FC'}]});
  assert.equal(named.unmapped,true);assert.equal(named.workloadRelevant,false);assert.equal(named.qualification.state,'DISCOVERED');
  const conflicted=qualifyDiscoveredFixture({...discovered,providerAwayTeamId:'63'},{teamMappings:[maps[1],{...maps[1],canonicalFplId:`${season}:fpl:team:11`,revision:2}]});
  assert.equal(conflicted.conflicted,true);assert.equal(conflicted.qualification.state,'CONFLICTED');assert.equal(conflicted.workloadRelevant,false);
  const coverage=mappingCoverage(maps,season,{officialFplAuthority:officialAuthority});assert.equal(coverage.completeTwentyClubCoverage,false);assert.equal(coverage.limitation,'current_season_pl_team_mapping_incomplete');
});

test('Chelsea-Leeds 19:00 versus 19:15 remains an explicit kickoff conflict without time tolerance',async()=>{
  const scan=await runApiFootballDiscoveryScan(scanOptions({kickoffObservations:[
    {providerFixtureId:'1636205',value:'2026-09-09T19:00:00.000Z',source:'leeds',sourceRevision:'leeds-r1'},
    {providerFixtureId:'1636205',value:'2026-09-09T19:15:00.000Z',source:'chelsea',sourceRevision:'chelsea-r1'}
  ]}));
  const fixture=scan.fixtures.find(row=>row.providerFixtureId==='1636205');
  assert.equal(fixture.identity,'2026-27:api-football:fixture:1636205');assert.equal(fixture.kickoff.state,'CONFLICTED');assert.equal(fixture.canonicalKickoff,null);
  assert.equal(fixture.qualification.state,'PROVIDER_QUALIFIED');assert.equal(fixture.kickoffObservation.value,'2026-09-09T19:00:00.000Z');
  assert.equal(fixture.providerHomeTeamId,'49');assert.equal(fixture.providerAwayTeamId,'63');
  assert.equal(fixture.homeTeamIdentity,`${season}:fpl:team:6`);assert.equal(fixture.awayTeamIdentity,`${season}:fpl:team:13`);
  assert.equal(maps[1].canonicalFplId,`${season}:fpl:team:13`);
  const source=fs.readFileSync('src/decision-intelligence/api-football-discovery.mjs','utf8');
  assert.doesNotMatch(source,/15\s*\*\s*60|900000|tolerance|fuzzy|closest-time|closestTime|scheduled-vs-actual/i);
});

test('independent candidates are scoped to the provider fixture they belong to',async()=>{
  const otherSameCompetition={identity:'2026-27:api-football:fixture:9002',providerFixtureId:'9002',providerLeagueId:'45',canonicalCompetitionId:'fa_cup',fplSeason:season,providerHomeTeamId:'49',providerAwayTeamId:'900',providerSeason:2026,kickoffObservation:{value:'2026-09-17T14:00:00.000Z',source:'api-football',sourceRevision:'r1'}};
  const mismatchOnA=qualifyDiscoveredFixture(chelseaLeedsFixture,{teamMappings:maps,independentCandidates:[candidate({homeTeamIdentity:`${season}:fpl:team:1`,awayTeamIdentity:`${season}:fpl:team:2`})]});
  const untouchedB=qualifyDiscoveredFixture(otherSameCompetition,{teamMappings:maps,independentCandidates:[candidate({homeTeamIdentity:`${season}:fpl:team:1`,awayTeamIdentity:`${season}:fpl:team:2`})]});
  assert.equal(mismatchOnA.qualification.state,'CONFLICTED');assert.equal(mismatchOnA.workloadRelevant,false);
  assert.equal(untouchedB.qualification.state,'PROVIDER_QUALIFIED');assert.equal(untouchedB.workloadRelevant,true);
  const sameCompetitionB=qualifyDiscoveredFixture({...otherSameCompetition,providerLeagueId:'48',canonicalCompetitionId:'league_cup',providerAwayTeamId:'900'},{teamMappings:maps,independentCandidates:[candidate({homeTeamIdentity:`${season}:fpl:team:1`,awayTeamIdentity:`${season}:fpl:team:2`})]});
  assert.equal(sameCompetitionB.qualification.state,'PROVIDER_QUALIFIED');
  assert.equal(qualifyDiscoveredFixture(chelseaLeedsFixture,{teamMappings:maps}).qualification.state,'PROVIDER_QUALIFIED');
  assert.equal(qualifyDiscoveredFixture(chelseaLeedsFixture,{teamMappings:maps,independentCandidates:[candidate()]}).qualification.state,'CROSS_SOURCE_VERIFIED');
  assert.equal(qualifyDiscoveredFixture(chelseaLeedsFixture,{teamMappings:maps,independentCandidates:[candidate(),candidate({fixtureId:'club-2',identityResolutionProvenance:'second-site'})]}).qualification.state,'AMBIGUOUS');
  const unscopedPoison=await runApiFootballDiscoveryScan(scanOptions({independentCandidates:[
    {fixtureId:'global',season,canonicalCompetitionId:'league_cup',homeTeamIdentity:`${season}:fpl:team:1`,awayTeamIdentity:`${season}:fpl:team:2`,identitiesResolved:true,identityResolutionMethod:'verified_identity_crosswalk',identityResolutionProvenance:'unscoped'}
  ]}));
  assert.ok(unscopedPoison.ok);
  assert.ok(unscopedPoison.fixtures.every(row=>row.qualification.state!=='CONFLICTED'||row.identityCollision));
  assert.ok(unscopedPoison.fixtures.some(row=>row.qualification.state==='PROVIDER_QUALIFIED'&&row.workloadRelevant===true));
  const scopedConflictScan=await runApiFootballDiscoveryScan(scanOptions({independentCandidates:[candidate({homeTeamIdentity:`${season}:fpl:team:1`,awayTeamIdentity:`${season}:fpl:team:2`})]}));
  const leagueCup=scopedConflictScan.fixtures.find(row=>row.providerFixtureId==='1636205');
  const other=scopedConflictScan.fixtures.find(row=>row.providerFixtureId==='9002');
  assert.equal(leagueCup.qualification.state,'CONFLICTED');assert.equal(leagueCup.workloadRelevant,false);assert.equal(leagueCup.conflicted,true);
  assert.equal(other.qualification.state,'PROVIDER_QUALIFIED');assert.equal(other.workloadRelevant,true);
  const leagueCupAudit=scopedConflictScan.audit.find(row=>row.logicalCompetitionKey==='league_cup'&&row.category==='success');
  assert.equal(leagueCupAudit.workloadRelevantAdmitted,0);
  const faCupAudit=scopedConflictScan.audit.find(row=>row.logicalCompetitionKey==='fa_cup'&&row.category==='success');
  assert.ok(faCupAudit.workloadRelevantAdmitted>=1);
});

test('multiple independent identity candidates remain ambiguous',()=>{
  const fixture=qualifyDiscoveredFixture(chelseaLeedsFixture,{teamMappings:maps,independentCandidates:[candidate(),candidate({fixtureId:'club-2',identityResolutionProvenance:'b'})]});
  assert.equal(fixture.qualification.state,'AMBIGUOUS');assert.equal(fixture.workloadRelevant,false);assert.equal(fixture.conflicted,false);
  assert.equal(crossSourceQualify(fixture.qualification,[]).state,'AMBIGUOUS');
});

test('final qualification, not the preliminary provider state, owns workloadRelevant',()=>{
  const providerOnly=qualifyDiscoveredFixture(chelseaLeedsFixture,{teamMappings:maps});
  assert.equal(providerOnly.qualification.state,'PROVIDER_QUALIFIED');assert.equal(providerOnly.workloadRelevant,true);assert.equal(providerOnly.conflicted,false);assert.equal(providerOnly.unmapped,false);assert.equal(providerOnly.rejected,false);
  const verified=qualifyDiscoveredFixture(chelseaLeedsFixture,{teamMappings:maps,independentCandidates:[candidate()]});
  assert.equal(verified.qualification.state,'CROSS_SOURCE_VERIFIED');assert.equal(verified.workloadRelevant,true);assert.equal(verified.conflicted,false);
  const ambiguous=qualifyDiscoveredFixture(chelseaLeedsFixture,{teamMappings:maps,independentCandidates:[candidate(),candidate({fixtureId:'club-2',identityResolutionProvenance:'second-site'})]});
  assert.equal(ambiguous.qualification.state,'AMBIGUOUS');assert.equal(ambiguous.workloadRelevant,false);assert.equal(ambiguous.conflicted,false);assert.equal(ambiguous.unmapped,false);
  const mismatched=qualifyDiscoveredFixture(chelseaLeedsFixture,{teamMappings:maps,independentCandidates:[candidate({homeTeamIdentity:`${season}:fpl:team:1`,awayTeamIdentity:`${season}:fpl:team:2`})]});
  assert.equal(mismatched.qualification.state,'CONFLICTED');assert.equal(mismatched.workloadRelevant,false);assert.equal(mismatched.conflicted,true);
});

test('Official FPL team universe requires canonical DATA-S2A validation and cannot self-certify',()=>{
  assert.equal(OFFICIAL_FPL_SOURCE_KEY,PLATFORM_OFFICIAL_FPL_SOURCE_KEY);
  assert.equal(OFFICIAL_FPL_SOURCE_REVISION_ID,DATA_S2_SOURCE_REVISION_ID);
  assert.equal(OFFICIAL_FPL_SCHEMA_VERSION,DATA_S2_SCHEMA_VERSION);
  assert.equal(OFFICIAL_FPL_VALIDATION_VERSION,DATA_S2_VALIDATION_VERSION);
  assert.equal(OFFICIAL_FPL_TRANSFORM_VERSION,DATA_S2_TRANSFORM_VERSION);
  assert.equal(diNormaliseOfficialFplHistory,normaliseOfficialFplHistory);
  const twenty=CURRENT_PL_TEAM_IDS.map((id,i)=>team(200+i,`${season}:fpl:team:${id}`));
  const fabricatedIds=CURRENT_PL_TEAM_IDS.slice();
  const fabricatedRows=CURRENT_PL_TEAM_IDS.map(id=>({id}));
  assert.equal(currentSeasonOfficialFplTeamIdentities(season,fabricatedIds).reason,'authoritative_pl_team_set_unavailable');
  assert.equal(mappingCoverage(twenty,season,{officialTeams:fabricatedRows}).limitation,'authoritative_pl_team_set_unavailable');
  assert.equal(mappingCoverage(twenty,season,{officialFplSnapshot:labeledSnapshot()}).limitation,'authoritative_pl_team_set_unavailable');
  assert.equal(mappingCoverage(twenty).limitation,'authoritative_pl_team_set_unavailable');
  assert.equal(currentSeasonOfficialFplTeamIdentities(season,labeledSnapshot()).reason,'authoritative_pl_team_set_unavailable');
  assert.equal(issueOfficialFplTeamUniverseAuthority(labeledSnapshot()).reason,'authoritative_pl_team_set_unavailable');
  const world=officialFplWorld();
  assert.equal(normaliseOfficialFplHistory(world).counts.teams,20);
  const authority=issueOfficialFplTeamUniverseAuthority(world);
  assert.equal(authority.ok,true);assert.equal(authority.kind,OFFICIAL_FPL_TEAM_UNIVERSE_KIND);
  assert.equal(authority.identities.length,20);assert.equal(authority.digest.includes(season),true);
  const established=currentSeasonOfficialFplTeamIdentities(season,authority);
  assert.equal(established.ok,true);assert.equal(established.identities.length,20);
  assert.equal(established.sourceKey,OFFICIAL_FPL_SOURCE_KEY);assert.equal(established.sourceRevisionId,OFFICIAL_FPL_SOURCE_REVISION_ID);
  assert.deepEqual(established.identities,CURRENT_PL_TEAM_IDS.map(id=>`${season}:fpl:team:${id}`).sort((a,b)=>Number(a.split(':').pop())-Number(b.split(':').pop())));
  assert.ok(!CURRENT_PL_TEAM_IDS.includes(10));assert.ok(CURRENT_PL_TEAM_IDS.includes(6)&&CURRENT_PL_TEAM_IDS.includes(13));
  const tamperedId={...authority,teams:authority.teams.map((row,i)=>i?row:{...row,id:99})};
  assert.equal(verifyOfficialFplTeamUniverseAuthority(season,tamperedId).reason,'official_fpl_team_representation_conflicted');
  const tamperedName={...authority,teams:authority.teams.map((row,i)=>i?row:{...row,name:'Forged FC'})};
  assert.equal(verifyOfficialFplTeamUniverseAuthority(season,tamperedName).reason,'official_fpl_team_representation_conflicted');
  assert.equal(verifyOfficialFplTeamUniverseAuthority('2025-26',authority).reason,'official_fpl_season_mismatch');
  assert.equal(currentSeasonOfficialFplTeamIdentities('2025-26',authority).reason,'official_fpl_season_mismatch');
  const wrongUniverse={...authority,bootstrap:{...authority.bootstrap,teams:authority.bootstrap.teams.map((row,i)=>i?row:{...row,id:99,name:'Wrong'})},teams:authority.teams.map((row,i)=>i?row:{...row,id:99,name:'Wrong'})};
  assert.equal(verifyOfficialFplTeamUniverseAuthority(season,wrongUniverse).ok,false);
  const nineteenWorld=officialFplWorld({teamIds:CURRENT_PL_TEAM_IDS.slice(0,19)});
  assert.equal(issueOfficialFplTeamUniverseAuthority(nineteenWorld).reason,'authoritative_pl_team_set_invalid');
  const twentyOneWorld=officialFplWorld({teamIds:[...CURRENT_PL_TEAM_IDS,99]});
  assert.equal(issueOfficialFplTeamUniverseAuthority(twentyOneWorld).reason,'authoritative_pl_team_set_invalid');
  const duplicateWorld=officialFplWorld();duplicateWorld.bootstrap.teams=[...duplicateWorld.bootstrap.teams];duplicateWorld.bootstrap.teams[1]={...duplicateWorld.bootstrap.teams[1],id:6,name:'Dup',short_name:'DUP'};
  assert.equal(issueOfficialFplTeamUniverseAuthority(duplicateWorld).reason,'authoritative_pl_team_set_invalid');
  const conflicted=officialFplWorld();conflicted.teams=conflicted.bootstrap.teams.map((row,i)=>i?row:{...row,name:'Other Name'});
  assert.equal(issueOfficialFplTeamUniverseAuthority(conflicted).reason,'official_fpl_team_representation_conflicted');
  assert.equal(currentSeasonOfficialFplTeamIdentities(season,null).reason,'authoritative_pl_team_set_unavailable');
  assert.equal(currentSeasonOfficialFplTeamIdentities(season,{kind:OFFICIAL_FPL_TEAM_UNIVERSE_KIND,season,digest:''}).reason,'official_fpl_provenance_invalid');
  const forgedDigest={...authority,digest:authority.digest.replace(season,'2099-00')};
  assert.equal(verifyOfficialFplTeamUniverseAuthority(season,forgedDigest).reason,'official_fpl_authority_tampered');
  const matchingTeams=officialFplWorld();matchingTeams.teams=matchingTeams.bootstrap.teams;
  assert.equal(issueOfficialFplTeamUniverseAuthority(matchingTeams).ok,true);
});

test('mappingCoverage requires exact authoritative current-season PL bijection',()=>{
  const authority=officialAuthority;
  const twenty=CURRENT_PL_TEAM_IDS.map((id,i)=>team(200+i,`${season}:fpl:team:${id}`));
  const complete=mappingCoverage(twenty,season,{officialFplAuthority:authority});
  assert.equal(complete.verifiedPremierLeagueTeamCount,20);assert.equal(complete.completeTwentyClubCoverage,true);assert.equal(complete.limitation,null);
  const fromEvidence=mappingCoverage(twenty,season,{officialFplEvidence:officialFplWorld()});
  assert.equal(fromEvidence.completeTwentyClubCoverage,true);
  const nineteen=mappingCoverage(twenty.slice(0,19),season,{officialFplAuthority:authority});
  assert.equal(nineteen.verifiedPremierLeagueTeamCount,19);assert.equal(nineteen.completeTwentyClubCoverage,false);
  const extraNonAuthoritative=mappingCoverage([...twenty,team(999,`${season}:fpl:team:99`)],season,{officialFplAuthority:authority});
  assert.equal(extraNonAuthoritative.completeTwentyClubCoverage,false);
  const sameClub=mappingCoverage([...twenty,{...twenty[0],providerEntityId:'999',revision:9}],season,{officialFplAuthority:authority});
  assert.equal(sameClub.completeTwentyClubCoverage,false);assert.equal(sameClub.verifiedPremierLeagueTeamCount,19);
  const splitProvider=mappingCoverage([...twenty,{...twenty[0],canonicalFplId:`${season}:fpl:team:${CURRENT_PL_TEAM_IDS[1]}`,revision:2}],season,{officialFplAuthority:authority});
  assert.equal(splitProvider.completeTwentyClubCoverage,false);
  const duplicates=mappingCoverage([...twenty,...twenty.map(row=>({...row,revision:2}))],season,{officialFplAuthority:authority});
  assert.equal(duplicates.verifiedPremierLeagueTeamCount,20);assert.equal(duplicates.completeTwentyClubCoverage,true);
  assert.equal(mappingCoverage(twenty.map(row=>({...row,provenance:''})),season,{officialFplAuthority:authority}).verifiedPremierLeagueTeamCount,0);
  assert.equal(mappingCoverage(twenty.map(row=>({...row,revision:'r1'})),season,{officialFplAuthority:authority}).verifiedPremierLeagueTeamCount,0);
  assert.equal(mappingCoverage(twenty.map(row=>({...row,method:'fuzzy_name'})),season,{officialFplAuthority:authority}).verifiedPremierLeagueTeamCount,0);
  assert.equal(mappingCoverage(twenty.map(row=>({...row,season:'2025-26',canonicalFplId:'2025-26:fpl:team:6'})),season,{officialFplAuthority:authority}).verifiedPremierLeagueTeamCount,0);
  assert.equal(mappingCoverage(twenty.map(row=>({...row,provider:'understat'})),season,{officialFplAuthority:authority}).verifiedPremierLeagueTeamCount,0);
  assert.equal(mappingCoverage(twenty.map(row=>({...row,status:'CANDIDATE'})),season,{officialFplAuthority:authority}).verifiedPremierLeagueTeamCount,0);
  assert.equal(mappingCoverage([team(1,`${season}:fpl:team:99`)],season,{officialFplAuthority:authority}).verifiedPremierLeagueTeamCount,0);
  const unavailable=mappingCoverage(twenty);
  assert.equal(unavailable.completeTwentyClubCoverage,false);assert.equal(unavailable.limitation,'authoritative_pl_team_set_unavailable');
  const labeled=mappingCoverage(twenty,season,{officialFplSnapshot:labeledSnapshot()});
  assert.equal(labeled.completeTwentyClubCoverage,false);assert.equal(labeled.limitation,'authoritative_pl_team_set_unavailable');
  const providerConflict=qualifyDiscoveredFixture({
    identity:'2026-27:api-football:fixture:1',providerFixtureId:'1',providerLeagueId:'45',canonicalCompetitionId:'fa_cup',
    fplSeason:season,providerHomeTeamId:'49',providerAwayTeamId:'63',providerSeason:2026,
    kickoffObservation:{value:'2026-09-16T19:00:00.000Z',source:'api-football',sourceRevision:'r1'}
  },{teamMappings:[maps[0],maps[1],{...maps[1],canonicalFplId:`${season}:fpl:team:11`,revision:2}]});
  assert.equal(providerConflict.qualification.state,'CONFLICTED');assert.equal(providerConflict.workloadRelevant,false);assert.equal(providerConflict.conflicted,true);
});

test('HTTP 429 stops the scan even when quota headers are absent or malformed',async()=>{
  const stopCases=[
    headers({'x-ratelimit-requests-remaining':'0','x-ratelimit-requests-limit':'7500','x-ratelimit-limit':'300','x-ratelimit-remaining':'0'}),
    headers(),
    headers({'x-ratelimit-requests-limit':'unlimited'})
  ];
  for(const hdrs of stopCases){
    const transport=mockFetch(async(url,options,n)=>n===2?{ok:false,status:429,headers:hdrs}:{ok:true,status:200,headers:headers(),json:async()=>payloads[url.searchParams.get('league')]});
    const stopped=await runApiFootballDiscoveryScan(scanOptions({transport}));
    assert.equal(stopped.scanState,'stopped_quota_exhausted');assert.equal(stopped.attempts,2);assert.equal(transport.calls.length,2);
    assert.equal(stopped.audit.at(-1).category,'quota_exhausted');assert.equal(stopped.fixtures.length,0);assert.equal(stopped.ok,false);
    assert.doesNotMatch(JSON.stringify(stopped),/deliberate-test-key-material|x-apisports-key|Home FC/i);
  }
  const malformedSuccess=mockFetch(async()=>({ok:true,status:200,headers:headers({'x-ratelimit-remaining':'-1'}),json:async()=>({})}));
  const failed=await runApiFootballDiscoveryScan(scanOptions({transport:malformedSuccess}));
  assert.equal(failed.ok,false);assert.ok(failed.audit.every(row=>row.category==='quota_headers_invalid'&&row.attemptNumber===1));
  assert.equal(malformedSuccess.calls.length,5);
});

test('duplicate provider fixture IDs with incompatible core identity conflict',async()=>{
  const identical=envelope(48,[chelseaLeeds,chelseaLeeds]);
  const kickoffOnly=envelope(48,[chelseaLeeds,row({id:1636205,league:48,home:49,away:63,date:'2026-09-09T19:15:00Z'})]);
  const orientation=envelope(48,[chelseaLeeds,row({id:1636205,league:48,home:63,away:49,date:'2026-09-09T19:00:00Z'})]);
  const teamChange=envelope(48,[chelseaLeeds,row({id:1636205,league:48,home:49,away:64,date:'2026-09-09T19:00:00Z'})]);
  async function scanLeagueCup(payload){
    const transport=mockFetch(async url=>{
      const league=url.searchParams.get('league');
      return {ok:true,status:200,headers:headers(),json:async()=>league==='48'?payload:payloads[league]};
    });
    return runApiFootballDiscoveryScan(scanOptions({transport}));
  }
  const same=await scanLeagueCup(identical);
  const sameFixture=same.fixtures.filter(row=>row.providerFixtureId==='1636205');
  assert.equal(sameFixture.length,1);assert.equal(sameFixture[0].identity,'2026-27:api-football:fixture:1636205');assert.equal(sameFixture[0].workloadRelevant,true);
  const moved=await scanLeagueCup(kickoffOnly);
  const movedFixture=moved.fixtures.find(row=>row.providerFixtureId==='1636205');
  assert.equal(movedFixture.identity,'2026-27:api-football:fixture:1636205');assert.equal(movedFixture.kickoff.state,'CONFLICTED');assert.equal(movedFixture.canonicalKickoff,null);assert.equal(movedFixture.qualification.state,'PROVIDER_QUALIFIED');
  for(const payload of [orientation,teamChange]){
    const scan=await scanLeagueCup(payload);
    const fixture=scan.fixtures.find(row=>row.providerFixtureId==='1636205');
    assert.equal(fixture.qualification.state,'CONFLICTED');assert.equal(fixture.workloadRelevant,false);assert.equal(fixture.conflicted,true);
    const audit=scan.audit.find(row=>row.logicalCompetitionKey==='league_cup'&&row.category==='success');
    assert.equal(audit.workloadRelevantAdmitted,0);
  }
  const crossComp=await runApiFootballDiscoveryScan(scanOptions({transport:mockFetch(async url=>{
    const league=url.searchParams.get('league');
    const payload=league==='45'?envelope(45,[row({id:1636205,league:45,home:49,away:900})]):payloads[league];
    return {ok:true,status:200,headers:headers(),json:async()=>payload};
  })}));
  const collided=crossComp.fixtures.filter(row=>row.providerFixtureId==='1636205');
  assert.equal(collided.length,1);assert.equal(collided[0].qualification.state,'CONFLICTED');assert.equal(collided[0].workloadRelevant,false);
});

test('incomplete discovery generations are atomic and admit no fixture evidence',async()=>{
  function assertUncommitted(scan,{scanState,attempts,calls,transport}={}){
    assert.equal(scan.ok,false);assert.equal(scan.scanState,scanState);assert.equal(scan.reason,scanState);
    assert.equal(scan.fixtures.length,0);assert.deepEqual(scan.fixtures,[]);
    if(attempts!=null)assert.equal(scan.attempts,attempts);
    if(calls!=null)assert.equal(transport.calls.length,calls);
    assert.ok(scan.audit.every(row=>row.workloadRelevantAdmitted===0&&row.rejected===0&&row.unmapped===0&&row.conflicted===0));
    assert.doesNotMatch(JSON.stringify(scan),/deliberate-test-key-material|x-apisports-key|Home FC/i);
  }
  const firstThen=(failing)=>mockFetch(async(url,options,n)=>{
    if(n===1)return {ok:true,status:200,headers:headers(),json:async()=>payloads[url.searchParams.get('league')]};
    return typeof failing==='function'?failing(url,n):failing;
  });

  const stop429=firstThen({ok:false,status:429,headers:headers()});
  const stoppedEarly=await runApiFootballDiscoveryScan(scanOptions({transport:stop429}));
  assertUncommitted(stoppedEarly,{scanState:'stopped_quota_exhausted',attempts:2,calls:2,transport:stop429});
  assert.equal(stoppedEarly.audit[0].category,'success');assert.equal(stoppedEarly.audit[0].providerRowsObserved,1);
  assert.equal(stoppedEarly.audit.at(-1).category,'quota_exhausted');assert.equal(stoppedEarly.audit.at(-1).httpClass,'4xx');

  const later429=mockFetch(async(url,options,n)=>n>=4?{ok:false,status:429,headers:headers()}:{ok:true,status:200,headers:headers(),json:async()=>payloads[url.searchParams.get('league')]});
  const stoppedLater=await runApiFootballDiscoveryScan(scanOptions({transport:later429}));
  assertUncommitted(stoppedLater,{scanState:'stopped_quota_exhausted',attempts:4,calls:4,transport:later429});
  assert.equal(stoppedLater.audit.filter(row=>row.category==='success').length,3);

  const auth=firstThen({ok:false,status:401,headers:headers()});
  const authScan=await runApiFootballDiscoveryScan(scanOptions({transport:auth}));
  assertUncommitted(authScan,{scanState:'completed_with_failures',attempts:5,calls:5,transport:auth});
  assert.ok(authScan.audit.slice(1).every(row=>row.category==='authentication_failure'&&row.attemptNumber===1));

  const schema=firstThen({ok:true,status:200,headers:headers(),json:async()=>({...envelope(3,[]),extra:true})});
  const schemaScan=await runApiFootballDiscoveryScan(scanOptions({transport:schema}));
  assertUncommitted(schemaScan,{scanState:'completed_with_failures',attempts:5,calls:5,transport:schema});
  assert.ok(schemaScan.audit.slice(1).every(row=>row.category==='provider_schema_invalid'&&row.attemptNumber===1));

  const paging=firstThen({ok:true,status:200,headers:headers(),json:async()=>({...envelope(3,[row({id:3001,league:3,home:63,away:532})]),paging:{current:1,total:2}})});
  const pagingScan=await runApiFootballDiscoveryScan(scanOptions({transport:paging}));
  assertUncommitted(pagingScan,{scanState:'completed_with_failures',attempts:5,calls:5,transport:paging});
  assert.equal(pagingScan.audit[1].category,'pagination_unsupported');assert.equal(pagingScan.audit[1].attemptNumber,1);

  const retryTransport=mockFetch(async(url,options,n)=>{
    if(url.searchParams.get('league')==='3')throw new Error('temporary');
    return {ok:true,status:200,headers:headers(),json:async()=>payloads[url.searchParams.get('league')]};
  });
  const retriedOut=await runApiFootballDiscoveryScan(scanOptions({transport:retryTransport,budget:createDailyRequestBudget({day:'2026-09-16',limit:10})}));
  assertUncommitted(retriedOut,{scanState:'completed_with_failures',attempts:6,calls:6,transport:retryTransport});
  assert.equal(retriedOut.audit.filter(row=>row.logicalCompetitionKey==='uefa_europa_league').length,2);

  const ceiling=mockFetch(async()=>{throw new Error('temporary');});
  const limitScan=await runApiFootballDiscoveryScan(scanOptions({transport:ceiling,budget:createDailyRequestBudget({day:'2026-09-16',limit:10})}));
  assert.equal(limitScan.ok,false);assert.equal(limitScan.fixtures.length,0);assert.equal(limitScan.attempts,10);assert.equal(ceiling.calls.length,10);
  assert.ok(limitScan.scanState==='completed_with_failures'||limitScan.scanState==='stopped_attempt_limit');
  assert.ok(limitScan.audit.every(row=>row.workloadRelevantAdmitted===0));

  let slept=0;const boomSleep=async()=>{slept+=1;if(slept>=1)throw new Error('sleep-fail');};
  const configTransport=successFetch();
  const configScan=await runApiFootballDiscoveryScan(scanOptions({transport:configTransport,sleepImpl:boomSleep}));
  assert.equal(configScan.ok,false);assert.equal(configScan.reason,'provider_disabled_configuration_invalid');
  assert.equal(configScan.fixtures.length,0);assert.equal(configTransport.calls.length,1);
});

test('a complete five-competition scan still returns reconciled fixtures, including valid zero-row competitions',async()=>{
  const complete=await runApiFootballDiscoveryScan(scanOptions());
  assert.equal(complete.ok,true);assert.equal(complete.scanState,'completed');assert.equal(complete.reason,null);
  assert.ok(complete.fixtures.length>=5);assert.ok(complete.audit.every(row=>row.category==='success'));
  assert.ok(complete.audit.reduce((sum,row)=>sum+row.workloadRelevantAdmitted,0)>=1);
  const leagueCup=complete.audit.find(row=>row.logicalCompetitionKey==='league_cup');
  assert.ok(leagueCup.workloadRelevantAdmitted>=1);assert.equal(leagueCup.providerRowsObserved,1);

  const emptyEuropa=envelope(3,[]);
  const withEmpty=mockFetch(async url=>{
    const league=url.searchParams.get('league');
    return {ok:true,status:200,headers:headers(),json:async()=>league==='3'?emptyEuropa:payloads[league]};
  });
  const emptyScan=await runApiFootballDiscoveryScan(scanOptions({transport:withEmpty}));
  assert.equal(emptyScan.ok,true);assert.equal(emptyScan.scanState,'completed');
  assert.equal(withEmpty.calls.length,5);
  assert.equal(emptyScan.audit.find(row=>row.logicalCompetitionKey==='uefa_europa_league').category,'success');
  assert.equal(emptyScan.audit.find(row=>row.logicalCompetitionKey==='uefa_europa_league').providerRowsObserved,0);
  assert.ok(emptyScan.fixtures.some(row=>row.providerFixtureId==='1636205'));
  assert.equal(emptyScan.fixtures.some(row=>row.providerLeagueId==='3'),false);
});

test('malformed optional Official FPL team representations fail closed without throwing',()=>{
  function conflicted(mutate){
    const world=officialFplWorld();mutate(world);return issueOfficialFplTeamUniverseAuthority(world);
  }
  assert.doesNotThrow(()=>conflicted(world=>{world.teams=world.bootstrap.teams.map((row,i)=>i?row:null);}));
  assert.equal(conflicted(world=>{world.teams=world.bootstrap.teams.map((row,i)=>i?row:null);}).reason,'official_fpl_team_representation_conflicted');
  assert.equal(conflicted(world=>{world.teams=world.bootstrap.teams.map((row,i)=>i?row:'Chelsea');}).reason,'official_fpl_team_representation_conflicted');
  assert.equal(conflicted(world=>{world.teams=world.bootstrap.teams.map((row,i)=>i?row:12);}).reason,'official_fpl_team_representation_conflicted');
  assert.equal(conflicted(world=>{world.teams=world.bootstrap.teams.map((row,i)=>i?row:[row]);}).reason,'official_fpl_team_representation_conflicted');
  assert.equal(conflicted(world=>{world.teams=world.bootstrap.teams.map((row,i)=>i?row:({...row,id:undefined}));}).reason,'official_fpl_team_representation_conflicted');
  assert.equal(conflicted(world=>{world.teams=world.bootstrap.teams.map((row,i)=>i?row:({id:row.id,short_name:row.short_name}));}).reason,'official_fpl_team_representation_conflicted');
  assert.equal(conflicted(world=>{world.teams=world.bootstrap.teams.map((row,i)=>i?row:({id:row.id,name:row.name}));}).reason,'official_fpl_team_representation_conflicted');
  assert.equal(conflicted(world=>{world.teams=world.bootstrap.teams.map((row,i)=>i?row:({...row,id:99}));}).reason,'official_fpl_team_representation_conflicted');
  assert.equal(conflicted(world=>{world.teams=world.bootstrap.teams.map((row,i)=>i?row:({...row,name:'Other Name'}));}).reason,'official_fpl_team_representation_conflicted');
  assert.equal(conflicted(world=>{world.teams=world.bootstrap.teams.map((row,i)=>i?row:({...row,short_name:'ZZZ'}));}).reason,'official_fpl_team_representation_conflicted');
  const reordered=officialFplWorld();reordered.teams=[...reordered.bootstrap.teams].reverse();
  assert.equal(issueOfficialFplTeamUniverseAuthority(reordered).ok,true);
  const omitted=officialFplWorld();delete omitted.teams;
  assert.equal(issueOfficialFplTeamUniverseAuthority(omitted).ok,true);
  const malformedBootstrap=officialFplWorld();malformedBootstrap.bootstrap.teams=[null,...malformedBootstrap.bootstrap.teams.slice(1)];
  assert.doesNotThrow(()=>issueOfficialFplTeamUniverseAuthority(malformedBootstrap));
  assert.equal(issueOfficialFplTeamUniverseAuthority(malformedBootstrap).reason,'authoritative_pl_team_set_invalid');
  assert.equal(currentSeasonOfficialFplTeamIdentities(season,malformedBootstrap).reason,'authoritative_pl_team_set_invalid');
});

test('API-Football requests abort at a repository-controlled timeout without waiting on hung transport',async()=>{
  assert.equal(API_FOOTBALL_REQUEST_TIMEOUT_MS,15000);assert.equal(typeof AbortSignal.timeout,'function');
  function timeoutReason(){return Object.assign(new Error('timeout'),{name:'TimeoutError'});}
  function immediateTimeoutSignal(){const controller=new AbortController();controller.abort(timeoutReason());return controller.signal;}
  const timeoutMsSeen=[];const signals=[];
  const timeoutSignal=ms=>{timeoutMsSeen.push(ms);const signal=immediateTimeoutSignal();signals.push(signal);return signal;};
  function hanging(){return mockFetch(()=>new Promise(()=>{}));}

  const hung=hanging();
  const hungBudget=createDailyRequestBudget({day:'2026-09-16',limit:10});
  const timedOut=await runApiFootballDiscoveryScan(scanOptions({transport:hung,timeoutSignal,budget:hungBudget}));
  assert.equal(timedOut.ok,false);assert.equal(timedOut.fixtures.length,0);assert.equal(timedOut.scanState,'stopped_attempt_limit');
  assert.equal(timedOut.attempts,10);assert.equal(hung.calls.length,10);assert.equal(signals.length,10);assert.equal(hungBudget.used,10);
  assert.ok(timeoutMsSeen.every(ms=>ms===API_FOOTBALL_REQUEST_TIMEOUT_MS));
  assert.ok(timedOut.audit.every(row=>row.category==='provider_timeout'&&row.httpClass==='timeout'&&row.attemptNumber<=2));
  assert.ok(timedOut.audit.filter(row=>row.logicalCompetitionKey==='fa_cup').length<=2);
  assert.equal(new Set(signals).size,signals.length);
  assert.equal(new Set(hung.calls.map(call=>call.options.signal)).size,hung.calls.length);
  assert.ok(hung.calls.every(call=>call.options.signal.aborted===true&&call.options.signal.reason?.name==='TimeoutError'));
  assert.ok(timedOut.audit.every(row=>!Object.hasOwn(row,'signal')));
  assert.doesNotMatch(JSON.stringify(timedOut),/deliberate-test-key-material|x-apisports-key|AbortSignal|TimeoutError|stack/i);
  assert.ok(timedOut.audit.every(row=>row.workloadRelevantAdmitted===0));

  const firstSuccessThenHang=mockFetch(async(url,options,n)=>{
    if(n<=2)return {ok:true,status:200,headers:headers(),json:async()=>payloads[url.searchParams.get('league')]};
    return new Promise(()=>{});
  });
  let created=0;
  const mixedSignal=ms=>{
    created+=1;
    if(created<=2)return new AbortController().signal;
    return immediateTimeoutSignal();
  };
  const afterSuccess=await runApiFootballDiscoveryScan(scanOptions({transport:firstSuccessThenHang,timeoutSignal:mixedSignal}));
  assert.equal(afterSuccess.ok,false);assert.equal(afterSuccess.fixtures.length,0);assert.equal(afterSuccess.scanState,'completed_with_failures');
  assert.ok(afterSuccess.audit.some(row=>row.category==='success'));
  assert.ok(afterSuccess.audit.some(row=>row.category==='provider_timeout'));
  assert.ok(afterSuccess.audit.every(row=>row.workloadRelevantAdmitted===0));

  const thrown=mockFetch(async()=>{throw new Error('socket reset');});
  const transportScan=await runApiFootballDiscoveryScan(scanOptions({transport:thrown,budget:createDailyRequestBudget({day:'2026-09-16',limit:10})}));
  assert.ok(transportScan.audit.every(row=>row.category==='transport_failure'));assert.equal(transportScan.fixtures.length,0);
  assert.notEqual(transportScan.audit[0].category,'provider_timeout');

  const serverError=mockFetch(async(url,options,n)=>{
    if(n%2===1)return {ok:false,status:500,headers:headers()};
    return {ok:true,status:200,headers:headers(),json:async()=>payloads[url.searchParams.get('league')]};
  });
  const retried5xx=await runApiFootballDiscoveryScan(scanOptions({transport:serverError,budget:createDailyRequestBudget({day:'2026-09-16',limit:10})}));
  assert.equal(retried5xx.ok,true);assert.equal(retried5xx.attempts,10);assert.equal(serverError.calls.length,10);
  assert.ok(retried5xx.audit.some(row=>row.category==='temporary_server_failure'));
  assert.ok(retried5xx.fixtures.length>=1);assert.equal(retried5xx.audit.some(row=>row.category==='provider_timeout'),false);

  const stop429=mockFetch(async(url,options,n)=>n===2?{ok:false,status:429,headers:headers()}:{ok:true,status:200,headers:headers(),json:async()=>payloads[url.searchParams.get('league')]});
  const stopped=await runApiFootballDiscoveryScan(scanOptions({transport:stop429}));
  assert.equal(stopped.scanState,'stopped_quota_exhausted');assert.equal(stop429.calls.length,2);assert.equal(stopped.audit.at(-1).category,'quota_exhausted');
  assert.equal(stopped.fixtures.length,0);assert.equal(stop429.calls[1].options.signal.aborted,false);

  const auth=mockFetch(async()=>({ok:false,status:403,headers:headers()}));
  const authScan=await runApiFootballDiscoveryScan(scanOptions({transport:auth}));
  assert.equal(auth.calls.length,5);assert.ok(authScan.audit.every(row=>row.category==='authentication_failure'&&row.attemptNumber===1));

  const schema=mockFetch(async()=>({ok:true,status:200,headers:headers(),json:async()=>({...envelope(2,[]),extra:true})}));
  const schemaScan=await runApiFootballDiscoveryScan(scanOptions({transport:schema}));
  assert.equal(schema.calls.length,5);assert.ok(schemaScan.audit.every(row=>row.category==='provider_schema_invalid'&&row.attemptNumber===1));

  const success=scanOptions();
  const clean=await runApiFootballDiscoveryScan(success);
  assert.equal(clean.ok,true);assert.equal(clean.scanState,'completed');assert.ok(clean.fixtures.length>=1);
  assert.equal(clean.audit.some(row=>row.category==='provider_timeout'),false);
  assert.ok(success.transport.calls.every(call=>call.options.signal.aborted===false));
  assert.equal(new Set(success.transport.calls.map(call=>call.options.signal)).size,success.transport.calls.length);

  const knownHangCalls=[];
  const known=createApiFootballClient({
    apiKey:KEY,budget:createDailyRequestBudget({day:'2026-09-16',limit:3}),
    fetchImpl:async(url,options)=>{knownHangCalls.push(options.signal);return new Promise(()=>{});},
    timeoutSignal
  });
  const knownTimeout=await known.request('fixtures',{id:1636205});
  assert.equal(knownTimeout.reason,'provider_timeout');assert.equal(knownHangCalls.length,1);
  assert.doesNotMatch(JSON.stringify(knownTimeout),/deliberate-test-key-material|x-apisports-key/i);
  const knownThrow=createApiFootballClient({apiKey:KEY,budget:createDailyRequestBudget({day:'2026-09-16',limit:1}),fetchImpl:async()=>{throw new Error('reset');}});
  assert.equal((await knownThrow.request('fixtures',{id:1636205})).reason,'provider_unavailable');
  let invalidCalls=0;const invalidBudget=createDailyRequestBudget({day:'2026-09-16',limit:2});
  const invalid=createApiFootballClient({apiKey:KEY,budget:invalidBudget,fetchImpl:async()=>{invalidCalls+=1;return {ok:true};},timeoutSignal});
  assert.equal((await invalid.request('fixtures',{league:'2',season:'2026'})).reason,'parameters_invalid');assert.equal(invalidCalls,0);assert.equal(invalidBudget.used,0);
  const overrideMs=[];
  const sent=await sendApiFootballRequest({
    fetchImpl:async()=>new Promise(()=>{}),
    url:new URL('https://v3.football.api-sports.io/fixtures'),
    init:{method:'GET',redirect:'error',headers:{}},
    timeoutMs:1,
    timeoutSignal:ms=>{overrideMs.push(ms);return immediateTimeoutSignal();}
  });
  assert.equal(sent.reason,'provider_timeout');assert.equal(Object.hasOwn(sent,'signal'),false);assert.deepEqual(overrideMs,[API_FOOTBALL_REQUEST_TIMEOUT_MS]);
  const misconfigured=await runApiFootballDiscoveryScan(scanOptions({timeoutSignal:15000}));
  assert.equal(misconfigured.reason,'provider_disabled_configuration_invalid');assert.equal(misconfigured.attempts,0);assert.equal(misconfigured.fixtures.length,0);
});

test('API-Football discovery stays isolated from production, live config and migration 0005',()=>{
  const discovery=fs.readFileSync('src/decision-intelligence/api-football-discovery.mjs','utf8');
  const foundation=fs.readFileSync('src/decision-intelligence/api-football-foundation.mjs','utf8');
  assert.doesNotMatch(discovery,/process\.env|localStorage|setInterval|setTimeout|console\.|wrangler|cron|RapidAPI/i);
  assert.doesNotMatch(foundation,/process\.env|localStorage|setInterval|setTimeout|console\.|RapidAPI/i);
  assert.match(foundation,/API_FOOTBALL_REQUEST_TIMEOUT_MS=15000/);
  assert.match(foundation,/timeoutSignal=AbortSignal\.timeout/);
  assert.match(discovery,/timeoutSignal=AbortSignal\.timeout/);
  assert.match(discovery,/provider_timeout/);
  const production=['src/model/minutes.mjs','src/model/scoring.mjs','src/squad.mjs','src/model/transfers.mjs','src/main.mjs','src/providers/registry.mjs','src/ui/team-decision-home.mjs','src/ui/transfer-optimiser-view.mjs','dist/index.html','index.html','build.mjs'];
  for(const file of production)assert.doesNotMatch(fs.readFileSync(file,'utf8'),/api-football-discovery|api-football-foundation|x-apisports-key/i,file);
  const migrations=fs.readdirSync('workers/data-platform/migrations').sort();
  assert.deepEqual(migrations.filter(name=>name.startsWith('0005')),['0005_api_football_shadow_runtime.sql']);
  assert.ok(migrations.includes('0004_api_football_shadow_identity.sql'));
  for(const file of ['workers/data-platform/wrangler.jsonc','workers/wrangler.jsonc','workers/evidence-wrangler.jsonc']){
    if(!fs.existsSync(file))continue;
    const source=fs.readFileSync(file,'utf8');assert.doesNotMatch(source,/api-football|x-apisports|API_FOOTBALL/i,file);
  }
  const apiFootballWorkflowAllowlist=new Set([
    'eia-2i5e-api-football-qualification.yml',
    'api-football-team-universe-qualification.yml',
    'api-football-owner-mapping-qualification.yml',
    'api-football-live-storage-preflight.yml',
    'api-football-migration-0004.yml',
    'api-football-migration-0005.yml',
    'api-football-migration-0006-readonly-preflight.yml',
    'api-football-mapping-0006-persistence.yml',
    'api-football-mapping-0006-reconciliation.yml',
    'api-football-mapping-0006-recovery.yml',
    'api-football-migration-0006.yml'
  ]);
  const workflowFiles=fs.readdirSync('.github/workflows');
  assert.deepEqual(
    workflowFiles.filter(file=>/api-football/i.test(file)).sort(),
    [...apiFootballWorkflowAllowlist].sort()
  );
  for(const file of workflowFiles){
    const source=fs.readFileSync(path.join('.github/workflows',file),'utf8');
    if(file==='eia-2i5e-api-football-qualification.yml'){
      assert.match(source,/secrets\.API_FOOTBALL_API_KEY/);
      assert.doesNotMatch(source,/x-apisports-key|v3\.football\.api-sports\.io/);
      continue;
    }
    if(file==='api-football-team-universe-qualification.yml'){
      assert.match(source,/secrets\.API_FOOTBALL_API_KEY/);
      assert.match(source,/runAttendedApiFootballTeamUniverseQualification/);
      assert.match(source,/teams\?league=39&season=2026/);
      assert.match(source,/MAX_PROVIDER_ATTEMPTS = 2/);
      assert.doesNotMatch(source,/runAttendedApiFootballQualification\s*\(|wrangler|collection_enabled\s*=\s*1/i);
      continue;
    }
    if(file==='api-football-owner-mapping-qualification.yml'){
      assert.match(source,/secrets\.API_FOOTBALL_OWNER_CROSSWALK_JSON/);
      assert.match(source,/issueOwnerApprovedTwentyClubMappings/);
      assert.match(source,/fetchOfficialFplAuthority/);
      assert.match(source,/apiFootballRequests:0/);
      assert.doesNotMatch(source,/secrets\.API_FOOTBALL_API_KEY|x-apisports-key|v3\.football\.api-sports\.io|wrangler|collection_enabled\s*=\s*1/i);
      continue;
    }
    if(file==='api-football-live-storage-preflight.yml'){
      assert.match(source,/name: data-steward-readonly/);
      assert.match(source,/DATA_STEWARD_CLOUDFLARE_READ_TOKEN/);
      assert.match(source,/live-storage-preflight\.mjs/);
      assert.match(source,/github\.run_attempt == 1/);
      assert.doesNotMatch(source,/secrets\.API_FOOTBALL_API_KEY|x-apisports-key|v3\.football\.api-sports\.io|wrangler\s+(?:deploy|secret)|collection_enabled\s*=\s*1|schedule:/i);
      continue;
    }
    if(file==='api-football-mapping-0006-recovery.yml'||file==='api-football-mapping-0006-persistence.yml'){
      assert.match(source,/secrets\.API_FOOTBALL_OWNER_CROSSWALK_JSON/);
      assert.match(source,/MIGRATION_0006_PHASE: mapping/);
      assert.match(source,/MIGRATION_0006_PREFLIGHT_MODE: mapping_pre/);
      assert.match(source,/MIGRATION_0006_PREFLIGHT_MODE: mapping_post/);
      assert.match(source,/environment: data-s2-production-collection/);
      assert.match(source,/group: data-s2-production-collection/);
      assert.match(source,/cancel-in-progress: false/);
      assert.doesNotMatch(source,/MIGRATION_0006_PHASE: schema|MIGRATION_0006_PREFLIGHT_MODE: schema_(?:pre|post)/);
      assert.doesNotMatch(source,/secrets\.API_FOOTBALL_API_KEY|x-apisports-key|v3\.football\.api-sports\.io|wrangler\s+(?:deploy|secret)|collection_enabled\s*=\s*1|schedule:/i);
      continue;
    }
    if(file==='api-football-mapping-0006-reconciliation.yml'){
      assert.match(source,/name: data-steward-readonly/);
      assert.match(source,/DATA_STEWARD_CLOUDFLARE_READ_TOKEN/);
      assert.match(source,/migration6\/reconciliation\.mjs/);
      assert.match(source,/github\.run_attempt == 1/);
      assert.doesNotMatch(source,/CLOUDFLARE_D1_TOKEN|API_FOOTBALL_OWNER_CROSSWALK_JSON|secrets\.API_FOOTBALL_API_KEY|api-sports\.io|wrangler\s+(?:deploy|secret)|collection_enabled\s*=\s*1|schedule:/i);
      continue;
    }
    if(file==='api-football-migration-0006.yml'){
      assert.match(source,/secrets\.API_FOOTBALL_OWNER_CROSSWALK_JSON/);
      assert.match(source,/MIGRATION_0006_PHASE: mapping/);
      assert.doesNotMatch(source,/secrets\.API_FOOTBALL_API_KEY|x-apisports-key|v3\.football\.api-sports\.io|wrangler\s+(?:deploy|secret)|collection_enabled\s*=\s*1|schedule:/i);
      continue;
    }
    assert.doesNotMatch(source,/API_FOOTBALL|x-apisports-key|v3\.football\.api-sports\.io/i,file);
  }
  const contracts=fs.readFileSync('src/decision-intelligence/api-football-shadow-contracts.mjs','utf8');
  const canonical=fs.readFileSync('src/decision-intelligence/official-fpl-history-canonical.mjs','utf8');
  assert.doesNotMatch(discovery,/fantasy\.premierleague\.com|bootstrap-static/i);
  assert.doesNotMatch(contracts,/fantasy\.premierleague\.com|bootstrap-static|data-platform/i);
  assert.doesNotMatch(canonical,/fantasy\.premierleague\.com|bootstrap-static|data-platform/i);
  assert.doesNotMatch(discovery,/\[1,\s*2,\s*3,\s*4,\s*5,\s*6,\s*7,\s*8,\s*9/);
  assert.doesNotMatch(contracts,/\[1,\s*2,\s*3,\s*4,\s*5,\s*6,\s*7,\s*8,\s*9/);
  assert.doesNotMatch(canonical,/\[1,\s*2,\s*3,\s*4,\s*5,\s*6,\s*7,\s*8,\s*9/);
  assert.doesNotMatch(discovery,/provider_request_audit|quota_accounting|CREATE TABLE/);
  assert.equal(API_FOOTBALL_ENDPOINTS.includes('fixtures'),true);
});
