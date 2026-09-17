import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  API_FOOTBALL_DAILY_REQUEST_LIMIT,API_FOOTBALL_ORIGIN,API_FOOTBALL_REQUEST_TIMEOUT_MS
} from '../src/decision-intelligence/api-football-foundation.mjs';
import {API_FOOTBALL_FPL_SEASON,mappingCoverage} from '../src/decision-intelligence/api-football-discovery.mjs';
import {issueOfficialFplTeamUniverseAuthority} from '../src/decision-intelligence/api-football-shadow-contracts.mjs';
import {API_FOOTBALL_MAX_RESPONSE_BYTES} from '../workers/api-football-collector/runtime-contracts.mjs';
import {
  EIA_2I5E_BYTE_CEILING_QUANTUM_BYTES,EIA_2I5E_CHECKPOINT,EIA_2I5E_MAX_ATTEMPTS,EIA_2I5E_MEASUREMENT_ABORT_BYTES,
  EIA_2I5E_MIN_GAP_MS,EIA_2I5E_PRODUCTION_BYTE_CEILING,OFFICIAL_FPL_BOOTSTRAP_URL,OFFICIAL_FPL_FIXTURES_URL,
  PREVIOUSLY_QUALIFIED_PL_TEAMS,confirmPreviouslyQualifiedTeamMappings,eia2i5eActivationBlocks,eia2i5eRequestPlan,
  fetchOfficialFplAuthority,measureDiscardingBody,qualifyTwentyClubMapping,recommendResponseByteCeiling,
  resolveAttendedCredential,runAttendedApiFootballQualification,sanitizeOfficialFplAuthority,validateQualificationPlanItem
} from '../src/decision-intelligence/api-football-prelive-qualification.mjs';

const KEY='deliberate-test-key-material';
const season=API_FOOTBALL_FPL_SEASON;
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const CURRENT_PL_TEAM_IDS=Object.freeze([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]);
function officialFplWorld(overrides={}){
  const teamIds=overrides.teamIds||CURRENT_PL_TEAM_IDS;
  const named=overrides.namedTeams||{};
  const events=overrides.events||Array.from({length:38},(_,i)=>({id:i+1,name:`Gameweek ${i+1}`,deadline_time:new Date(Date.UTC(2026,7,15+i*7,10)).toISOString()}));
  const teams=overrides.teams||teamIds.map((id,i)=>{
    const special=named[id];
    return {
      id,name:special?.name||`Team ${id}`,short_name:special?.short_name||`T${String(id).padStart(2,'0')}`,
      strength:1000+i,strength_overall_home:1001+i,strength_overall_away:999+i,
      strength_attack_home:1002+i,strength_attack_away:998+i,strength_defence_home:1003+i,strength_defence_away:997+i
    };
  });
  const element_types=overrides.element_types||[1,2,3,4].map(id=>({id}));
  const elements=overrides.elements||Array.from({length:401},(_,i)=>({
    id:i+1,team:teamIds[i%teamIds.length],element_type:i%4+1,web_name:`Player ${i+1}`,now_cost:45+i%100,status:'a',
    chance_of_playing_next_round:null,chance_of_playing_this_round:null,news:'',news_added:null,selected_by_percent:String((i%500)/10)
  }));
  const fixtures=overrides.fixtures||Array.from({length:300},(_,i)=>{
    const home=teamIds[i%teamIds.length];const away=teamIds[(i+7)%teamIds.length];
    return {id:i+1,event:i%38+1,kickoff_time:new Date(Date.UTC(2026,7,15+i,14)).toISOString(),team_h:home,team_a:away,team_h_difficulty:2+i%4,team_a_difficulty:2+(i+1)%4};
  });
  return {bootstrap:{events,teams,elements,element_types},fixtures,season:overrides.season||season,fetchedAt:overrides.fetchedAt||'2026-09-17T06:00:00.000Z'};
}
const namedWorld=()=>officialFplWorld({namedTeams:{6:{name:'Chelsea',short_name:'CHE'},13:{name:'Leeds',short_name:'LEE'}}});
const issued=()=>issueOfficialFplTeamUniverseAuthority(namedWorld());
const team=(providerEntityId,canonicalFplId,overrides={})=>({
  provider:'api-football',entityType:'team',providerEntityId:String(providerEntityId),canonicalFplId,mappingRevision:'r1',revision:1,
  status:'VERIFIED',season,method:'manually_verified',provenance:'owner-reviewed current-season fixture participation',...overrides
});
function envelope(endpoint,rows,paging={current:1,total:1}){
  return {get:endpoint,parameters:endpoint==='fixtures'?{league:'48',season:'2026'}:{id:'1636205'},errors:{},results:rows.length,paging,response:rows};
}
function quotaHeaders(){
  return {'x-ratelimit-requests-limit':'7500','x-ratelimit-requests-remaining':'7499','x-ratelimit-limit':'300','x-ratelimit-remaining':'299'};
}
function jsonResponse(payload,{status=200,headers={}}={}){
  const body=JSON.stringify(payload);
  return new Response(body,{status,headers:{'content-type':'application/json','content-length':String(Buffer.byteLength(body)),...quotaHeaders(),...headers}});
}
const fixtureRow=(id=1636205,home=49,away=63)=>({
  fixture:{id,date:'2026-09-09T19:00:00+00:00',status:{short:'FT',elapsed:90}},
  league:{id:48,season:2026},
  teams:{home:{id:home},away:{id:away}},
  goals:{home:6,away:3}
});
function measurement(endpointClass,actualBytes,overrides={}){
  return {ok:true,schemaMatched:true,endpointClass,actualBytes,highWaterCandidate:false,paginationPresent:false,bodyRetained:false,...overrides};
}

test('EIA-2I5E attempt budget stays far below the UTC safety ceiling and does not set the production byte constant',()=>{
  assert.equal(EIA_2I5E_CHECKPOINT,'EIA-2I5E');
  assert.equal(EIA_2I5E_MAX_ATTEMPTS,16);
  assert.ok(EIA_2I5E_MAX_ATTEMPTS<API_FOOTBALL_DAILY_REQUEST_LIMIT/5);
  assert.equal(EIA_2I5E_MIN_GAP_MS,1000);
  assert.equal(API_FOOTBALL_REQUEST_TIMEOUT_MS,15000);
  assert.equal(API_FOOTBALL_MAX_RESPONSE_BYTES,null);
  assert.equal(EIA_2I5E_PRODUCTION_BYTE_CEILING,null);
  assert.equal(eia2i5eActivationBlocks().responseLimitUnqualified,true);
  assert.equal(eia2i5eActivationBlocks().collectionEnabled,false);
  assert.equal(eia2i5eActivationBlocks().cronActive,false);
  assert.equal(eia2i5eActivationBlocks().collectorDeployed,false);
});

test('request plan is closed to approved endpoint classes, leagues, season and known fixtures',()=>{
  const plan=eia2i5eRequestPlan();
  assert.equal(plan.ok,true);assert.equal(plan.maxAttempts,16);assert.equal(plan.origin,API_FOOTBALL_ORIGIN);
  assert.equal(plan.productionByteCeiling,null);
  assert.ok(plan.items.length<=EIA_2I5E_MAX_ATTEMPTS);
  assert.ok(plan.items.every(item=>validateQualificationPlanItem(item).ok));
  assert.deepEqual([...new Set(plan.items.filter(item=>item.endpointClass==='fixtures_discovery').map(item=>item.search.league))].sort(),['2','3','45','48','848']);
  assert.ok(plan.items.every(item=>item.endpointClass!=='fixtures_discovery'||item.search.season==='2026'));
  assert.ok(plan.items.some(item=>item.search.id==='1636205'||item.search.fixture==='1636205'));
  assert.ok(plan.items.some(item=>item.search.id==='1635643'||item.search.fixture==='1635643'));
  assert.equal(validateQualificationPlanItem({endpointClass:'fixtures_discovery',endpoint:'fixtures',search:{league:'39',season:'2026'}}).ok,false);
  assert.equal(validateQualificationPlanItem({endpointClass:'fixture',endpoint:'fixtures',search:{id:'1636205',league:'48'}}).ok,false);
});

test('missing attended credential yields zero provider attempts and NO-GO response-size evidence',async()=>{
  let calls=0;
  const result=await runAttendedApiFootballQualification({apiKey:'',fetchImpl:async()=>{calls+=1;},sleep:async()=>{}});
  assert.equal(result.reason,'credential_unavailable');assert.equal(result.attempts,0);assert.equal(calls,0);
  assert.equal(result.responseLimit.decision,'NO-GO');assert.equal(result.implementedCeiling,false);
  assert.equal(resolveAttendedCredential(null).reason,'credential_unavailable');
});

test('401 stops immediately without reading the provider body',async()=>{
  let bodyReads=0,calls=0,sleeps=[];
  const result=await runAttendedApiFootballQualification({
    apiKey:KEY,
    fetchImpl:async()=>{
      calls+=1;
      return {status:401,ok:false,headers:new Headers(quotaHeaders()),get body(){bodyReads+=1;return {getReader(){return {read:async()=>({done:true})};}};}};
    },
    sleep:async ms=>{sleeps.push(ms);}
  });
  assert.equal(calls,1);assert.equal(bodyReads,0);assert.equal(result.attempts,1);
  assert.equal(result.stoppedReason,'provider_authentication_failed');
  assert.equal(result.measurements[0].bodyRetained,false);
  assert.doesNotMatch(JSON.stringify(result),/deliberate-test-key-material|x-apisports-key/i);
});

test('403 and 429 stop the attended session',async()=>{
  for(const status of [403,429]){
    let calls=0;
    const result=await runAttendedApiFootballQualification({
      apiKey:KEY,
      fetchImpl:async()=>{calls+=1;return jsonResponse({error:'ignored'},{status});},
      sleep:async()=>{}
    });
    assert.equal(calls,1,String(status));assert.equal(result.attempts,1,String(status));
    assert.equal(result.stoppedReason,status===429?'quota_exhausted':'provider_authentication_failed',String(status));
  }
});

test('attended requests are serial, spaced by the approved gap, and never retain raw bodies',async()=>{
  const sleeps=[];let inFlight=0,maxInFlight=0;
  const plan=eia2i5eRequestPlan();
  const subset={...plan,items:plan.items.filter(item=>item.endpointClass==='fixtures_discovery').slice(0,2)};
  const payload=envelope('fixtures',[fixtureRow()]);
  const result=await runAttendedApiFootballQualification({
    apiKey:KEY,plan:subset,
    fetchImpl:async(url,init)=>{
      inFlight+=1;maxInFlight=Math.max(maxInFlight,inFlight);
      assert.equal(init.method,'GET');assert.equal(init.redirect,'error');
      assert.equal(url.origin,API_FOOTBALL_ORIGIN);assert.equal(url.username,'');assert.equal(url.password,'');
      assert.equal(init.headers['x-apisports-key'],KEY);
      const response=jsonResponse(payload);
      inFlight-=1;
      return response;
    },
    sleep:async ms=>{sleeps.push(ms);}
  });
  assert.equal(maxInFlight,1);assert.deepEqual(sleeps,[EIA_2I5E_MIN_GAP_MS]);
  assert.equal(result.attempts,2);assert.equal(result.stoppedReason,null);
  assert.ok(result.measurements.every(row=>row.ok&&row.bodyRetained===false&&row.schemaMatched&&Number.isInteger(row.actualBytes)));
  assert.ok(result.measurements.every(row=>row.providerTeamIds.includes('49')&&row.providerTeamIds.includes('63')));
  assert.equal(result.measurements.some(row=>'Home FC' in row||row.raw||row.payload),false);
  assert.doesNotMatch(JSON.stringify(result),/deliberate-test-key-material/);
});

test('measurement records bytes, rows, paging and quota then discards the payload',async()=>{
  const payload=envelope('fixtures/players',[{team:{id:49},players:[{player:{id:1}}]}],{current:1,total:1});
  const measured=await measureDiscardingBody(jsonResponse(payload),{endpoint:'fixtures/players',endpointClass:'players',fixtureId:'1636205',highWaterCandidate:true});
  assert.equal(measured.ok,true);assert.equal(measured.schemaMatched,true);assert.equal(measured.rowCount,1);
  assert.equal(measured.paginationPresent,false);assert.equal(measured.bodyRetained,false);
  assert.equal(measured.quota.state,'known');assert.equal(measured.quota.requestsLimit,7500);
  assert.ok(measured.actualBytes>0);assert.equal(measured.contentLengthHeader,measured.actualBytes);
  assert.deepEqual(measured.providerTeamIds,['49']);assert.equal(Object.hasOwn(measured,'payload'),false);
});

test('pagination on a high-water sample and missing endpoint classes keep the byte ceiling NO-GO',()=>{
  assert.equal(recommendResponseByteCeiling([]).decision,'NO-GO');
  const incomplete=[measurement('fixtures_discovery',80000,{highWaterCandidate:true}),measurement('players',180000,{highWaterCandidate:true})];
  assert.equal(recommendResponseByteCeiling(incomplete).reason,'endpoint_class_coverage_incomplete');
  const paged=[
    measurement('fixtures_discovery',90000,{highWaterCandidate:true,paginationPresent:true}),
    measurement('fixture',12000),measurement('lineups',40000),measurement('players',180000,{highWaterCandidate:true}),measurement('events',25000,{highWaterCandidate:true})
  ];
  assert.equal(recommendResponseByteCeiling(paged).reason,'high_water_pagination_unresolved');
});

test('complete class coverage yields an exact recommended ceiling without implementing the runtime constant',()=>{
  const rows=[
    measurement('fixtures_discovery',80000,{highWaterCandidate:true}),
    measurement('fixture',12000),
    measurement('lineups',45000),
    measurement('players',180000,{highWaterCandidate:true}),
    measurement('events',25000,{highWaterCandidate:true})
  ];
  const result=recommendResponseByteCeiling(rows);
  assert.equal(result.decision,'GO');assert.equal(result.observedMaximum,180000);
  assert.equal(result.classMaxima.players,180000);assert.equal(result.proposedCeiling,393216);
  assert.equal(result.proposedCeiling%EIA_2I5E_BYTE_CEILING_QUANTUM_BYTES,0);
  assert.equal(result.implemented,false);assert.equal(result.productionConstant,null);
  assert.equal(API_FOOTBALL_MAX_RESPONSE_BYTES,null);
  assert.ok(result.proposedCeiling>result.observedMaximum);
  const huge=[...rows.slice(0,3),measurement('players',2_000_000,{highWaterCandidate:true}),measurement('events',1000,{highWaterCandidate:true})];
  assert.equal(recommendResponseByteCeiling(huge).reason,'observed_maximum_too_large_to_bound');
});

test('Official FPL authority cannot be a labeled 20-team snapshot and Chelsea/Leeds reuse requires current exact identity',()=>{
  const snapshot={season,teams:CURRENT_PL_TEAM_IDS.map(id=>({id,name:`Team ${id}`,short_name:`T${id}`})),sourceKey:'official-fpl',sourceRevisionId:'official-fpl-r1'};
  const coverage=qualifyTwentyClubMapping({authority:snapshot,mappings:[]});
  assert.equal(coverage.decision,'NO-GO');assert.notEqual(coverage.reason,'current_season_pl_team_mapping_incomplete');
  const reused=confirmPreviouslyQualifiedTeamMappings(issued());
  assert.equal(reused.ok,true);assert.equal(reused.mappings.length,2);
  assert.deepEqual(reused.mappings.map(row=>row.providerEntityId).sort(),['49','63']);
  const renamed=issueOfficialFplTeamUniverseAuthority(officialFplWorld());
  const blocked=confirmPreviouslyQualifiedTeamMappings(renamed);
  assert.equal(blocked.ok,false);assert.equal(blocked.mappings.length,0);
  assert.ok(blocked.rejected.every(row=>row.conflict==='current_official_fpl_identity_mismatch'));
});

test('20-club mapping is GO only for a verified 1:1 bijection and never certifies name-only rows',()=>{
  const authority=issued();
  const two=qualifyTwentyClubMapping({authority,mappings:confirmPreviouslyQualifiedTeamMappings(authority).mappings});
  assert.equal(two.decision,'NO-GO');assert.equal(two.verifiedPremierLeagueTeamCount,2);assert.equal(two.nameOnlyCertified,false);
  assert.equal(two.table.filter(row=>row.qualificationStatus==='VERIFIED').length,2);
  assert.equal(two.table.find(row=>row.officialFplTeamId==='6').apiFootballTeamId,'49');
  assert.equal(two.table.find(row=>row.officialFplTeamId==='13').apiFootballTeamId,'63');
  assert.equal(two.unresolved.length,18);
  const nameOnly=qualifyTwentyClubMapping({authority,mappings:[team('42',`${season}:fpl:team:1`,{method:'name_similarity',club:'Arsenal'})]});
  assert.equal(nameOnly.decision,'NO-GO');assert.equal(nameOnly.reason,'name_only_mapping_forbidden');
  const complete=CURRENT_PL_TEAM_IDS.map((id,index)=>team(200+index,`${season}:fpl:team:${id}`,{club:`Team ${id}`}));
  const go=qualifyTwentyClubMapping({authority,mappings:complete});
  assert.equal(go.decision,'GO');assert.equal(go.completeTwentyClubCoverage,true);assert.equal(go.verifiedPremierLeagueTeamCount,20);
  assert.equal(mappingCoverage(complete,season,{officialFplAuthority:authority}).completeTwentyClubCoverage,true);
});

test('sanitized Official FPL authority drops raw bootstrap/fixtures and the fetch path rejects redirects',async()=>{
  const world=namedWorld();
  const issuedAuthority=issueOfficialFplTeamUniverseAuthority(world);
  const sanitized=sanitizeOfficialFplAuthority(issuedAuthority);
  assert.equal(Object.hasOwn(sanitized,'bootstrap'),false);assert.equal(Object.hasOwn(sanitized,'fixtures'),false);
  assert.equal(sanitized.teams.length,20);assert.equal(sanitized.counts.teams,20);
  let sawRedirectBody=false;
  const redirected=await fetchOfficialFplAuthority({
    fetchImpl:async()=>({status:302,ok:false,json:async()=>{sawRedirectBody=true;return {};}}),
    now:()=>'2026-09-17T06:00:00.000Z'
  });
  assert.equal(redirected.reason,'official_fpl_redirect_rejected');assert.equal(sawRedirectBody,false);
  const urls=[];
  const fetched=await fetchOfficialFplAuthority({
    fetchImpl:async(url,options)=>{
      urls.push({url,options});
      assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
      const payload=String(url).includes('bootstrap-static')?world.bootstrap:world.fixtures;
      return {status:200,ok:true,json:async()=>payload};
    },
    now:()=>'2026-09-17T06:00:00.000Z'
  });
  assert.equal(fetched.ok,true);assert.deepEqual(urls.map(row=>String(row.url)),[OFFICIAL_FPL_BOOTSTRAP_URL,OFFICIAL_FPL_FIXTURES_URL]);
  assert.equal(fetched.identities.length,20);
});

test('measurement abort cap is not a production ceiling and oversize bodies are not retained',async()=>{
  assert.ok(EIA_2I5E_MEASUREMENT_ABORT_BYTES>1_000_000);
  const huge=jsonResponse(envelope('fixtures',[fixtureRow()]),{headers:{'content-length':String(EIA_2I5E_MEASUREMENT_ABORT_BYTES+1)}});
  const measured=await measureDiscardingBody(huge,{endpoint:'fixtures',endpointClass:'fixture'});
  assert.equal(measured.reason,'provider_response_too_large');assert.equal(measured.bodyRetained,false);
  assert.equal(API_FOOTBALL_MAX_RESPONSE_BYTES,null);
});

test('EIA-2I5E stays isolated from production, browser, collector activation and secret material',()=>{
  const source=fs.readFileSync(path.join(root,'src/decision-intelligence/api-football-prelive-qualification.mjs'),'utf8');
  assert.doesNotMatch(source,/process\.env|localStorage|setInterval|setTimeout|console\.|RapidAPI|collection_enabled\s*=\s*1/i);
  assert.match(source,/redirect:'error'/);
  assert.match(source,/apiFootballRequestInit/);
  assert.doesNotMatch(source,/x-apisports-key['"]?\s*:\s*['"][^'"]+/);
  const production=['src/model/minutes.mjs','src/model/scoring.mjs','src/squad.mjs','src/model/transfers.mjs','src/main.mjs','src/providers/registry.mjs','src/ui/team-decision-home.mjs','src/ui/transfer-optimiser-view.mjs','dist/index.html','index.html','build.mjs'];
  for(const file of production)assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/api-football-prelive-qualification|EIA_2I5E_MAX_ATTEMPTS/i,file);
  const wrangler=fs.readFileSync(path.join(root,'workers/api-football-collector/wrangler.jsonc'),'utf8');
  assert.match(wrangler,/"crons": \[\]/);assert.match(wrangler,/REPOSITORY_ONLY_BLOCKED/);
  assert.match(wrangler,/00000000-0000-0000-0000-000000000000/);
  assert.doesNotMatch(wrangler,/"database_id": "[1-9a-f]/i);
  const contracts=fs.readFileSync(path.join(root,'workers/api-football-collector/runtime-contracts.mjs'),'utf8');
  assert.match(contracts,/API_FOOTBALL_MAX_RESPONSE_BYTES=null/);
  for(const file of fs.readdirSync(path.join(root,'.github/workflows'))){
    assert.doesNotMatch(fs.readFileSync(path.join(root,'.github/workflows',file),'utf8'),/API_FOOTBALL_API_KEY|x-apisports-key/i,file);
  }
  assert.equal(PREVIOUSLY_QUALIFIED_PL_TEAMS.length,2);
});
