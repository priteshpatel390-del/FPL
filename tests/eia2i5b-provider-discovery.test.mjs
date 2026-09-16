import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  API_FOOTBALL_COLLECTION_MODE,API_FOOTBALL_ENDPOINTS,API_FOOTBALL_ORIGIN,buildPinnedApiFootballUrl,
  createApiFootballClient,createDailyRequestBudget,normalizeApiFootballQuotaHeaders
} from '../src/decision-intelligence/api-football-foundation.mjs';
import {
  API_FOOTBALL_DISCOVERY_ATTEMPT_GAP_MS,API_FOOTBALL_DISCOVERY_MAX_ATTEMPTS_PER_QUERY,API_FOOTBALL_DISCOVERY_MAX_SCAN_ATTEMPTS,
  API_FOOTBALL_DISCOVERY_MODE,API_FOOTBALL_FPL_SEASON,API_FOOTBALL_PROVIDER_SEASON,apiFootballDiscoveryPlan,
  buildApiFootballDiscoveryRequest,mappingCoverage,qualifyDiscoveredFixture,runApiFootballDiscoveryScan
} from '../src/decision-intelligence/api-football-discovery.mjs';
import {apiFootballFixtureIdentity,apiFootballTeamIdentity,crossSourceQualify} from '../src/decision-intelligence/api-football-shadow-contracts.mjs';

const KEY='deliberate-test-key-material';
const season=API_FOOTBALL_FPL_SEASON;
const rights=()=>({classification:'owner_risk_accepted_private_use',provider:'api-football',ownerApprovalId:'EIA-2I1',allowedUse:'private_noncommercial_research',retentionAllowed:true,redistributionAllowed:false,publicUseAllowed:false,commercialUseAllowed:false,rawPayloadRetentionAllowed:false,stopOnObjection:true,attributionRequired:false});
const team=(providerEntityId,canonicalFplId,status='VERIFIED')=>({provider:'api-football',entityType:'team',providerEntityId:String(providerEntityId),canonicalFplId,mappingRevision:'r1',revision:1,status,season,method:'manually_verified',provenance:'owner-reviewed'});
const maps=[team(49,`${season}:fpl:team:6`),team(63,`${season}:fpl:team:10`)];
const headers=(values={})=>({get(name){const key=String(name).toLowerCase();return values[key]??values[name]??null;},...values});
const envelope=(league,rows)=>({get:'fixtures',parameters:{league:String(league),season:'2026'},errors:{},results:rows.length,paging:{current:1,total:1},response:rows});
const row=({id,league,home,away,date='2026-09-16T19:00:00+00:00',status='NS'}={})=>({
  fixture:{id,date,status:{short:status,long:'Not Started',elapsed:null},venue:{id:1,name:'Ignored',city:'Ignored'},referee:'Ignored'},
  league:{id:league,name:'Ignored Cup',season:2026,round:'Ignored',logo:'https://ignored.test/league.png'},
  teams:{home:{id:home,name:'Home FC',logo:'https://ignored.test/home.png'},away:{id:away,name:'Away FC',logo:'https://ignored.test/away.png'}},
  goals:{home:null,away:null},score:{halftime:{home:null,away:null},fulltime:{home:null,away:null}}
});
const chelseaLeeds=row({id:1636205,league:48,home:49,away:63,date:'2026-09-16T19:00:00Z',status:'NS'});
const nonPl=row({id:9002,league:45,home:49,away:900,date:'2026-09-17T14:00:00Z',status:'NS'});
const payloads={
  '2':envelope(2,[row({id:2001,league:2,home:49,away:531})]),
  '3':envelope(3,[row({id:3001,league:3,home:63,away:532})]),
  '848':envelope(848,[row({id:8481,league:848,home:49,away:533})]),
  '45':envelope(45,[nonPl]),
  '48':envelope(48,[chelseaLeeds])
};
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
  assert.equal(stopped.audit.at(-1).category,'quota_exhausted');assert.ok(stopped.fixtures.length>=1);
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
  const coverage=mappingCoverage(maps);assert.equal(coverage.completeTwentyClubCoverage,false);assert.equal(coverage.limitation,'current_season_pl_team_mapping_incomplete');
});

test('Chelsea-Leeds 19:00 versus 19:15 remains an explicit kickoff conflict without time tolerance',async()=>{
  const scan=await runApiFootballDiscoveryScan(scanOptions({kickoffObservations:[
    {providerFixtureId:'1636205',value:'2026-09-16T19:00:00.000Z',source:'leeds',sourceRevision:'leeds-r1'},
    {providerFixtureId:'1636205',value:'2026-09-16T19:15:00.000Z',source:'chelsea',sourceRevision:'chelsea-r1'}
  ]}));
  const fixture=scan.fixtures.find(row=>row.providerFixtureId==='1636205');
  assert.equal(fixture.identity,'2026-27:api-football:fixture:1636205');assert.equal(fixture.kickoff.state,'CONFLICTED');assert.equal(fixture.canonicalKickoff,null);
  assert.equal(fixture.qualification.state,'PROVIDER_QUALIFIED');assert.equal(fixture.kickoffObservation.value,'2026-09-16T19:00:00.000Z');
  const source=fs.readFileSync('src/decision-intelligence/api-football-discovery.mjs','utf8');
  assert.doesNotMatch(source,/15\s*\*\s*60|900000|tolerance|fuzzy|closest-time|closestTime|scheduled-vs-actual/i);
});

test('multiple independent identity candidates remain ambiguous',()=>{
  const fixture=qualifyDiscoveredFixture({
    identity:'2026-27:api-football:fixture:1636205',providerFixtureId:'1636205',providerLeagueId:'48',canonicalCompetitionId:'league_cup',
    fplSeason:season,providerHomeTeamId:'49',providerAwayTeamId:'63',providerSeason:2026,
    kickoffObservation:{value:'2026-09-16T19:00:00.000Z',source:'api-football',sourceRevision:'r1'}
  },{teamMappings:maps,independentCandidates:[
    {fixtureId:'club-1',season,canonicalCompetitionId:'league_cup',homeTeamIdentity:`${season}:fpl:team:6`,awayTeamIdentity:`${season}:fpl:team:10`,identitiesResolved:true,identityResolutionMethod:'verified_identity_crosswalk',identityResolutionProvenance:'a'},
    {fixtureId:'club-2',season,canonicalCompetitionId:'league_cup',homeTeamIdentity:`${season}:fpl:team:6`,awayTeamIdentity:`${season}:fpl:team:10`,identitiesResolved:true,identityResolutionMethod:'verified_identity_crosswalk',identityResolutionProvenance:'b'}
  ]});
  assert.equal(fixture.qualification.state,'AMBIGUOUS');assert.equal(fixture.workloadRelevant,false);assert.equal(fixture.conflicted,false);
  assert.equal(crossSourceQualify(fixture.qualification,[]).state,'AMBIGUOUS');
});

test('final qualification, not the preliminary provider state, owns workloadRelevant',()=>{
  const chelseaLeedsFixture={
    identity:'2026-27:api-football:fixture:1636205',providerFixtureId:'1636205',providerLeagueId:'48',canonicalCompetitionId:'league_cup',
    fplSeason:season,providerHomeTeamId:'49',providerAwayTeamId:'63',providerSeason:2026,
    kickoffObservation:{value:'2026-09-16T19:00:00.000Z',source:'api-football',sourceRevision:'r1'}
  };
  const candidate=(overrides={})=>({fixtureId:'club-1',season,canonicalCompetitionId:'league_cup',homeTeamIdentity:`${season}:fpl:team:6`,awayTeamIdentity:`${season}:fpl:team:10`,identitiesResolved:true,identityResolutionMethod:'verified_identity_crosswalk',identityResolutionProvenance:'club-site',...overrides});
  const providerOnly=qualifyDiscoveredFixture(chelseaLeedsFixture,{teamMappings:maps});
  assert.equal(providerOnly.qualification.state,'PROVIDER_QUALIFIED');assert.equal(providerOnly.workloadRelevant,true);assert.equal(providerOnly.conflicted,false);assert.equal(providerOnly.unmapped,false);assert.equal(providerOnly.rejected,false);
  const verified=qualifyDiscoveredFixture(chelseaLeedsFixture,{teamMappings:maps,independentCandidates:[candidate()]});
  assert.equal(verified.qualification.state,'CROSS_SOURCE_VERIFIED');assert.equal(verified.workloadRelevant,true);assert.equal(verified.conflicted,false);
  const ambiguous=qualifyDiscoveredFixture(chelseaLeedsFixture,{teamMappings:maps,independentCandidates:[candidate(),candidate({fixtureId:'club-2',identityResolutionProvenance:'second-site'})]});
  assert.equal(ambiguous.qualification.state,'AMBIGUOUS');assert.equal(ambiguous.workloadRelevant,false);assert.equal(ambiguous.conflicted,false);assert.equal(ambiguous.unmapped,false);
  const mismatched=qualifyDiscoveredFixture(chelseaLeedsFixture,{teamMappings:maps,independentCandidates:[candidate({homeTeamIdentity:`${season}:fpl:team:1`,awayTeamIdentity:`${season}:fpl:team:2`})]});
  assert.equal(mismatched.qualification.state,'CONFLICTED');assert.equal(mismatched.workloadRelevant,false);assert.equal(mismatched.conflicted,true);
});

test('discovery audit does not admit ambiguous or conflicted fixtures as workload relevant',async()=>{
  const conflictedScan=await runApiFootballDiscoveryScan(scanOptions({independentCandidates:[
    {fixtureId:'other-1',season,canonicalCompetitionId:'league_cup',homeTeamIdentity:`${season}:fpl:team:1`,awayTeamIdentity:`${season}:fpl:team:2`,identitiesResolved:true,identityResolutionMethod:'verified_identity_crosswalk',identityResolutionProvenance:'mismatch'}
  ]}));
  assert.ok(conflictedScan.fixtures.length>=1);
  assert.ok(conflictedScan.fixtures.every(row=>row.qualification.state==='CONFLICTED'&&row.workloadRelevant===false&&row.conflicted===true));
  assert.ok(conflictedScan.audit.filter(row=>row.category==='success').every(row=>row.workloadRelevantAdmitted===0));
  const ambiguousScan=await runApiFootballDiscoveryScan(scanOptions({independentCandidates:[
    {fixtureId:'club-1',season,canonicalCompetitionId:'league_cup',homeTeamIdentity:`${season}:fpl:team:6`,awayTeamIdentity:`${season}:fpl:team:10`,identitiesResolved:true,identityResolutionMethod:'verified_identity_crosswalk',identityResolutionProvenance:'a'},
    {fixtureId:'club-2',season,canonicalCompetitionId:'league_cup',homeTeamIdentity:`${season}:fpl:team:6`,awayTeamIdentity:`${season}:fpl:team:10`,identitiesResolved:true,identityResolutionMethod:'verified_identity_crosswalk',identityResolutionProvenance:'b'}
  ]}));
  const leagueCup=ambiguousScan.fixtures.find(row=>row.providerFixtureId==='1636205');
  assert.equal(leagueCup.qualification.state,'AMBIGUOUS');assert.equal(leagueCup.workloadRelevant,false);
  const leagueCupAudit=ambiguousScan.audit.find(row=>row.logicalCompetitionKey==='league_cup'&&row.category==='success');
  assert.equal(leagueCupAudit.workloadRelevantAdmitted,0);
  assert.ok(ambiguousScan.audit.filter(row=>row.category==='success').every(row=>row.workloadRelevantAdmitted===0));
});

test('mappingCoverage uses full EIA-2I5A validation rather than a VERIFIED label',()=>{
  const twenty=Array.from({length:20},(_,i)=>team(100+i,`${season}:fpl:team:${i+1}`));
  const complete=mappingCoverage(twenty);
  assert.equal(complete.verifiedPremierLeagueTeamCount,20);assert.equal(complete.completeTwentyClubCoverage,true);assert.equal(complete.limitation,null);
  const nineteen=mappingCoverage(twenty.slice(0,19));
  assert.equal(nineteen.verifiedPremierLeagueTeamCount,19);assert.equal(nineteen.completeTwentyClubCoverage,false);
  const noProvenance=mappingCoverage(twenty.map(row=>({...row,provenance:''})));
  assert.equal(noProvenance.verifiedPremierLeagueTeamCount,0);assert.equal(noProvenance.completeTwentyClubCoverage,false);
  const badRevision=mappingCoverage(twenty.map(row=>({...row,revision:'r1'})));
  assert.equal(badRevision.verifiedPremierLeagueTeamCount,0);assert.equal(badRevision.completeTwentyClubCoverage,false);
  const badMethod=mappingCoverage(twenty.map(row=>({...row,method:'fuzzy_name'})));
  assert.equal(badMethod.verifiedPremierLeagueTeamCount,0);assert.equal(badMethod.completeTwentyClubCoverage,false);
  const wrongSeason=mappingCoverage(twenty.map(row=>({...row,season:'2025-26',canonicalFplId:'2025-26:fpl:team:1'})));
  assert.equal(wrongSeason.verifiedPremierLeagueTeamCount,0);assert.equal(wrongSeason.completeTwentyClubCoverage,false);
  const otherProvider=mappingCoverage(twenty.map(row=>({...row,provider:'understat'})));
  assert.equal(otherProvider.verifiedPremierLeagueTeamCount,0);assert.equal(otherProvider.completeTwentyClubCoverage,false);
  const duplicates=mappingCoverage([...twenty,...twenty.map(row=>({...row,revision:2}))]);
  assert.equal(duplicates.verifiedPremierLeagueTeamCount,20);assert.equal(duplicates.completeTwentyClubCoverage,true);
  const conflicted=mappingCoverage([...twenty,{...twenty[0],canonicalFplId:`${season}:fpl:team:99`,revision:2}]);
  assert.equal(conflicted.verifiedPremierLeagueTeamCount,19);assert.equal(conflicted.completeTwentyClubCoverage,false);
  const providerConflict=qualifyDiscoveredFixture({
    identity:'2026-27:api-football:fixture:1',providerFixtureId:'1',providerLeagueId:'45',canonicalCompetitionId:'fa_cup',
    fplSeason:season,providerHomeTeamId:'49',providerAwayTeamId:'63',providerSeason:2026,
    kickoffObservation:{value:'2026-09-16T19:00:00.000Z',source:'api-football',sourceRevision:'r1'}
  },{teamMappings:[maps[0],maps[1],{...maps[1],canonicalFplId:`${season}:fpl:team:11`,revision:2}]});
  assert.equal(providerConflict.qualification.state,'CONFLICTED');assert.equal(providerConflict.workloadRelevant,false);assert.equal(providerConflict.conflicted,true);
});

test('API-Football discovery stays isolated from production, live config and migration 0005',()=>{
  const discovery=fs.readFileSync('src/decision-intelligence/api-football-discovery.mjs','utf8');
  const foundation=fs.readFileSync('src/decision-intelligence/api-football-foundation.mjs','utf8');
  assert.doesNotMatch(discovery,/process\.env|localStorage|setInterval|setTimeout|console\.|wrangler|cron|RapidAPI/i);
  assert.doesNotMatch(foundation,/process\.env|localStorage|setInterval|setTimeout|console\.|RapidAPI/i);
  const production=['src/model/minutes.mjs','src/model/scoring.mjs','src/squad.mjs','src/model/transfers.mjs','src/main.mjs','src/providers/registry.mjs','src/ui/team-decision-home.mjs','src/ui/transfer-optimiser-view.mjs','dist/index.html','index.html','build.mjs'];
  for(const file of production)assert.doesNotMatch(fs.readFileSync(file,'utf8'),/api-football-discovery|api-football-foundation|x-apisports-key/i,file);
  const migrations=fs.readdirSync('workers/data-platform/migrations').sort();
  assert.deepEqual(migrations.filter(name=>name.startsWith('0005')),[]);
  assert.ok(migrations.includes('0004_api_football_shadow_identity.sql'));
  for(const file of ['workers/data-platform/wrangler.jsonc','workers/wrangler.jsonc','workers/evidence-wrangler.jsonc']){
    if(!fs.existsSync(file))continue;
    const source=fs.readFileSync(file,'utf8');assert.doesNotMatch(source,/api-football|x-apisports|API_FOOTBALL/i,file);
  }
  for(const file of fs.readdirSync('.github/workflows')){
    const source=fs.readFileSync(path.join('.github/workflows',file),'utf8');
    assert.doesNotMatch(source,/API_FOOTBALL|x-apisports-key|v3\.football\.api-sports\.io/i,file);
  }
  assert.doesNotMatch(discovery,/provider_request_audit|quota_accounting|CREATE TABLE/);
  assert.equal(API_FOOTBALL_ENDPOINTS.includes('fixtures'),true);
});
