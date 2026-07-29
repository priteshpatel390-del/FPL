import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SNAPSHOT_SCHEMA_VERSION,
  EVIDENCE_RULES,
  canonicalise,
  stableStringify,
  sha256Hex,
  findForbiddenEvidence,
  assertEvidenceSafe,
  deadlineWindow,
  sampleNetworkClock,
  collectPreDeadlinePayload,
  collectPreDeadlinePayloadAsync,
  assessDeadlineTiming,
  finaliseSnapshotRecord,
  validateSnapshotRecord,
  selectOfficialSnapshot,
  boundedSnapshotIndex
} from '../src/evidence/snapshot.mjs';
import { S } from '../src/state.mjs';
import { clearXP } from '../src/model/scoring.mjs';
import { resetHealth, markLive } from '../src/providers/registry.mjs';

const deadline = Date.parse('2026-08-15T10:00:00.000Z');
const network = at => ({status:'available',serverAt:at,clientMidpointAt:at,skewMs:0,requestStartedAt:at-20,responseReceivedAt:at+20,roundTripMs:40,source:'same_origin_http_date'});
const provider = (name,at,included=true) => ({provider:name,state:included?'Live':'Disabled',included,didAffectModel:included,acceptedRecordCount:included?1:0,rejectedRecordCount:0,recordedAt:new Date(at).toISOString(),lastSuccessAt:included?new Date(at).toISOString():null,ageMs:included?0:null,thresholdMs:null,note:'',consequence:''});
const approvedProviders = at => ['fpl','understat','odds','archive'].map(name=>provider(name,at,name==='fpl'));
function payload(overrides={}){
  return {
    recordType:'preDeadlineSnapshot',
    schemaVersion:SNAPSHOT_SCHEMA_VERSION,
    metricVersion:'1.0.0',
    segmentationVersion:'1.0.0',
    managerRef:'mgr-0123456789abcdef0123456789abcdef',
    season:'2026-27',
    gameweek:1,
    deadlineTime:new Date(deadline).toISOString(),
    build:{modelVersion:'2.4.0',rulesVersion:'2026-27.3',sourceHash:'abc',commit:'def',moduleOrder:[]},
    versions:{model:'2.4.0',rules:'2026-27.3',simulation:'1.0.0',snapshot:SNAPSHOT_SCHEMA_VERSION},
    rules:{fpl:{season:'2026-27'},minutes:{},scoring:{},transfer:{},simulation:{version:'1.0.0'},odds:{},fixture:{baseGoals:1.42,homeTilt:1.1}},
    providers:approvedProviders(deadline-30*60*1000),
    completeness:{complete:true,sections:{coreInputs:'complete',playerProjections:'complete'},fatalFplIssue:false,playerCount:1,expectedPlayerCount:1},
    capture:{startedAt:new Date(deadline-31*60*1000).toISOString(),projectionStartedAt:new Date(deadline-30*60*1000).toISOString(),projectionCompletedAt:new Date(deadline-29*60*1000).toISOString(),horizon:6},
    modelInputs:{players:[{id:1}],teams:[],events:[],fixtures:[],minuteHistory:{},calibration:null,understat:null,odds:null},
    outputs:{players:[{playerId:1}],squad:{status:'not_available'}},
    retries:[],issues:[],quality:{projectionDurationMs:1,simulationSamplesPerAvailablePlayer:5000,seasonLive:true},
    ...overrides
  };
}

test('Stage 10.1 canonical JSON is deterministic and rejects non-finite numbers',()=>{
  assert.equal(stableStringify({z:1,a:{d:2,b:3}}),'{"a":{"b":3,"d":2},"z":1}');
  assert.deepEqual(canonicalise({b:-0,a:[2,1]}),{a:[2,1],b:0});
  assert.throws(()=>stableStringify({bad:Infinity}),/non-finite/);
});

test('Stage 10.1 SHA-256 is stable',async()=>{
  assert.equal(await sha256Hex('teamsheet'),'4b181308804047bdf0042e7a22393a9e1420ca4f16c1bd47f9efd15df1ca5bbf');
});

test('Stage 10.1 evidence safety rejects secret fields and values',()=>{
  assert.deepEqual(findForbiddenEvidence({safe:'ok'}),[]);
  assert.throws(()=>assertEvidenceSafe({oddsKey:'not-for-export'}),/secret_key/);
  assert.throws(()=>assertEvidenceSafe({note:'Authorization: Bearer abc'}),/secret_value/);
});

test('Stage 10.1 evidence safety rejects manager and configuration identifiers',()=>{
  assert.throws(()=>assertEvidenceSafe({teamId:'123'}),/secret_key/);
  assert.throws(()=>assertEvidenceSafe({leagueId:'456'}),/secret_key/);
  assert.throws(()=>assertEvidenceSafe({managerName:'Private manager'}),/secret_key/);
  assert.doesNotThrow(()=>assertEvidenceSafe({clubId:1,managerRef:'mgr-0123456789abcdef0123456789abcdef'}));
});

test('evidence import rejects unknown, duplicate or missing providers',async()=>{
  const completed=deadline-20*60*1000;
  const base=await finaliseSnapshotRecord(payload(),{
    captureStartedAt:completed-1000,captureCompletedAt:completed,
    networkBefore:network(completed-900),networkAfter:network(completed)
  });
  const unknown=JSON.parse(JSON.stringify(base)); unknown.providers[0].provider='unapproved-feed';
  assert.equal((await validateSnapshotRecord(unknown)).reason,'provider_unapproved');
  const duplicate=JSON.parse(JSON.stringify(base)); duplicate.providers[1].provider='fpl';
  assert.equal((await validateSnapshotRecord(duplicate)).reason,'provider_duplicate');
  const missing=JSON.parse(JSON.stringify(base)); missing.providers.pop();
  assert.equal((await validateSnapshotRecord(missing)).reason,'provider_missing');
});

test('deadline window applies the approved 24-hour, one-hour and two-minute boundaries',()=>{
  assert.equal(deadlineWindow(new Date(deadline).toISOString(),deadline-24*60*60*1000-1).state,'too_early');
  assert.equal(deadlineWindow(new Date(deadline).toISOString(),deadline-24*60*60*1000).state,'open');
  assert.equal(deadlineWindow(new Date(deadline).toISOString(),deadline-60*60*1000).state,'due_soon');
  assert.equal(deadlineWindow(new Date(deadline).toISOString(),deadline-15*60*1000).state,'ideal');
  assert.equal(deadlineWindow(new Date(deadline).toISOString(),deadline-EVIDENCE_RULES.safetyCutoffMs).state,'safety_cutoff');
  assert.equal(deadlineWindow(new Date(deadline).toISOString(),deadline).state,'closed');
});

test('same-origin HTTP Date sampling records round-trip and skew evidence',async()=>{
  const times=[1000,1040];
  const result=await sampleNetworkClock({
    locationHref:'https://example.test/teamsheet/',
    nowFn:()=>times.shift(),
    fetchFn:async()=>({headers:{get:name=>name==='date'?new Date(1020).toUTCString():null}})
  });
  assert.equal(result.status,'available');
  assert.equal(result.roundTripMs,40);
  assert.equal(result.skewMs,-20); // HTTP dates have one-second resolution; the recorded arithmetic remains explicit.
});

test('network-attested complete captures before the cutoff are official-eligible',()=>{
  const completed=deadline-20*60*1000;
  const result=assessDeadlineTiming({
    deadlineTime:new Date(deadline).toISOString(),captureStartedAt:completed-1000,captureCompletedAt:completed,
    networkBefore:network(completed-900),networkAfter:network(completed),providers:[provider('fpl',completed-2000)],complete:true
  });
  assert.equal(result.grade,'network_attested');
  assert.equal(result.officialEligible,true);
  assert.deepEqual(result.reasons,[]);
});

test('client-only time is retained but cannot become the official snapshot',()=>{
  const completed=deadline-20*60*1000;
  const result=assessDeadlineTiming({
    deadlineTime:new Date(deadline).toISOString(),captureStartedAt:completed-1000,captureCompletedAt:completed,
    networkBefore:{status:'unavailable'},networkAfter:{status:'unavailable'},providers:[provider('fpl',completed-2000)],complete:true
  });
  assert.equal(result.grade,'client_recorded');
  assert.equal(result.officialEligible,false);
  assert.ok(result.reasons.includes('network_time_unavailable'));
});

test('clock conflicts, safety-cutoff captures and late included providers fail closed',()=>{
  const completed=deadline-3*60*1000;
  const conflict=assessDeadlineTiming({
    deadlineTime:new Date(deadline).toISOString(),captureStartedAt:completed-1000,captureCompletedAt:completed,
    networkBefore:{...network(completed-900),skewMs:EVIDENCE_RULES.maxClockSkewMs+1},networkAfter:network(completed),providers:[provider('fpl',completed-2000)],complete:true
  });
  assert.equal(conflict.grade,'clock_conflict');
  assert.equal(conflict.officialEligible,false);
  const cutoff=assessDeadlineTiming({
    deadlineTime:new Date(deadline).toISOString(),captureStartedAt:deadline-EVIDENCE_RULES.safetyCutoffMs-1000,captureCompletedAt:deadline-EVIDENCE_RULES.safetyCutoffMs,
    networkBefore:network(deadline-EVIDENCE_RULES.safetyCutoffMs-900),networkAfter:network(deadline-EVIDENCE_RULES.safetyCutoffMs),providers:[provider('fpl',deadline-10*60*1000)],complete:true
  });
  assert.equal(cutoff.grade,'late');
  assert.ok(cutoff.reasons.includes('inside_safety_cutoff'));
  const lateSource=assessDeadlineTiming({
    deadlineTime:new Date(deadline).toISOString(),captureStartedAt:completed-1000,captureCompletedAt:completed,
    networkBefore:network(completed-900),networkAfter:network(completed),providers:[provider('fpl',deadline-60*1000)],complete:true
  });
  assert.ok(lateSource.reasons.includes('provider_after_cutoff:fpl'));
});

test('final records are immutable, hash-verifiable and tamper-evident',async()=>{
  const completed=deadline-20*60*1000;
  const record=await finaliseSnapshotRecord(payload(),{
    captureStartedAt:completed-1000,captureCompletedAt:completed,
    networkBefore:network(completed-900),networkAfter:network(completed)
  });
  assert.ok(Object.isFrozen(record));
  assert.ok(Object.isFrozen(record.outputs));
  assert.match(record.identity.snapshotId,/^predeadline-gw1-[0-9a-f]{16}$/);
  assert.deepEqual(Object.keys(record.identity.sectionHashes),['archiveInputs','decisions','fplInputs','minutes','modelInputs','oddsInputs','playerProjections','providers','ruleConfiguration','uncertainty','understatInputs']);
  Object.values(record.identity.sectionHashes).forEach(hash=>assert.match(hash,/^[0-9a-f]{64}$/));
  assert.equal(record.identity.ruleHashes.configuration,record.identity.sectionHashes.ruleConfiguration);
  assert.equal((await validateSnapshotRecord(record)).ok,true);
  const tampered=JSON.parse(JSON.stringify(record)); tampered.gameweek=2;
  assert.equal((await validateSnapshotRecord(tampered)).reason,'duplicate_key');
});

test('import validation rejects unknown top-level fields and invalid manager references',async()=>{
  const completed=deadline-20*60*1000;
  const record=await finaliseSnapshotRecord(payload(),{
    captureStartedAt:completed-1000,captureCompletedAt:completed,
    networkBefore:network(completed-900),networkAfter:network(completed)
  });
  const unknown=JSON.parse(JSON.stringify(record)); unknown.unapproved='value';
  assert.equal((await validateSnapshotRecord(unknown)).reason,'top_level_schema');
  const manager=JSON.parse(JSON.stringify(record)); manager.managerRef='manager-name';
  assert.equal((await validateSnapshotRecord(manager)).reason,'manager_ref');
});

test('official snapshot selection keeps the latest eligible complete capture only',async()=>{
  const make=async(minutes,complete=true,eligible=true)=>{
    const completed=deadline-minutes*60*1000;
    const record=await finaliseSnapshotRecord(payload({completeness:{...payload().completeness,complete}}),{
      captureStartedAt:completed-1000,captureCompletedAt:completed,
      networkBefore:eligible?network(completed-900):{status:'unavailable'},networkAfter:eligible?network(completed):{status:'unavailable'}
    });
    return record;
  };
  const early=await make(30), latest=await make(10), incomplete=await make(5,false), clientOnly=await make(8,true,false);
  assert.equal(selectOfficialSnapshot([early,incomplete,clientOnly,latest],1).identity.snapshotId,latest.identity.snapshotId);
});

test('deadline revisions prevent an older deadline snapshot from being selected as official',async()=>{
  const oldDeadline=new Date(deadline).toISOString();
  const revisedDeadline=new Date(deadline+60*60*1000).toISOString();
  const make=async(deadlineTime,minutes,complete=true)=>{
    const target=Date.parse(deadlineTime), completed=target-minutes*60*1000;
    return finaliseSnapshotRecord(payload({deadlineTime,completeness:{...payload().completeness,complete}}),{
      captureStartedAt:completed-1000,captureCompletedAt:completed,
      networkBefore:network(completed-900),networkAfter:network(completed)
    });
  };
  const oldOfficial=await make(oldDeadline,15,true);
  const revisedIncomplete=await make(revisedDeadline,5,false);
  assert.equal(selectOfficialSnapshot([oldOfficial,revisedIncomplete],1),null);
  const revisedComplete=await make(revisedDeadline,20,true);
  assert.equal(selectOfficialSnapshot([oldOfficial,revisedComplete,revisedIncomplete],1).identity.snapshotId,revisedComplete.identity.snapshotId);
});

test('section hashes identify output tampering before the whole-record hash check',async()=>{
  const completed=deadline-20*60*1000;
  const record=await finaliseSnapshotRecord(payload(),{
    captureStartedAt:completed-1000,captureCompletedAt:completed,
    networkBefore:network(completed-900),networkAfter:network(completed)
  });
  const tampered=JSON.parse(JSON.stringify(record));
  tampered.outputs.players[0].playerId=2;
  assert.equal((await validateSnapshotRecord(tampered)).reason,'section_hash');
});

test('bounded local metadata keeps three newest unique snapshots',async()=>{
  const records=[];
  for(let i=0;i<4;i++){
    const completed=deadline-(40-i)*60*1000;
    records.push(await finaliseSnapshotRecord(payload({gameweek:i+1,deadlineTime:new Date(deadline+i*86400000).toISOString()}),{
      captureStartedAt:completed-1000,captureCompletedAt:completed,
      networkBefore:network(completed-900),networkAfter:network(completed)
    }));
  }
  let index=[]; records.forEach(record=>{ index=boundedSnapshotIndex(index,record); });
  assert.equal(index.length,3);
  assert.deepEqual(index.map(row=>row.gameweek),[4,3,2]);
});


test('a collected snapshot freezes model outputs without exporting the manager Team ID or name',()=>{
  const fields={
    useManual:{checked:false}, bankIn:{value:'0'}, ftCount:{value:'1'}, trHorizon:{value:'1'}
  };
  globalThis.document={getElementById:id=>fields[id]||{value:'',checked:false}};
  const teamA={id:1,name:'Alpha',short_name:'ALP',strength_attack_home:1100,strength_attack_away:1050,strength_defence_home:1120,strength_defence_away:1070};
  const teamB={id:2,name:'Beta',short_name:'BET',strength_attack_home:1000,strength_attack_away:980,strength_defence_home:990,strength_defence_away:970};
  const player={id:10,web_name:'Example',team:1,element_type:3,now_cost:75,total_points:0,form:'0',points_per_game:'0',selected_by_percent:'1',minutes:0,starts:0,goals_scored:0,assists:0,clean_sheets:0,saves:0,bonus:0,bps:0,expected_goals_per_90:0.2,expected_assists_per_90:0.2,expected_goal_involvements_per_90:0.4,expected_goals_conceded_per_90:1.4,defensive_contribution:0,defensive_contribution_per_90:0,status:'a',chance_of_playing_next_round:100,news:'',news_added:null,cost_change_event:0,cost_change_start:0,transfers_in_event:0,transfers_out_event:0,penalties_order:null,direct_freekicks_order:null,corners_and_indirect_freekicks_order:null,ep_next:'3.0',yellow_cards:0,red_cards:0,own_goals:0,penalties_missed:0,penalties_saved:0};
  S.boot={events:[{id:1,deadline_time:'2026-08-15T10:00:00Z',is_current:false,is_next:true,finished:false,name:'Gameweek 1'}],teams:[teamA,teamB],elements:[player],element_types:[{id:3,singular_name_short:'MID',singular_name:'Midfielder'}]};
  S.fixtures=[{event:1,id:100,team_h:1,team_a:2,team_h_difficulty:3,team_a_difficulty:3,kickoff_time:'2026-08-15T12:00:00Z',started:false,finished:false,provisional_start_time:false}];
  S.teams={1:teamA,2:teamB}; S.byId={10:player}; S.posName={3:'MID'}; S.posFull={3:'Midfielder'};
  S.avg={atkH:1050,atkA:1015,defH:1055,defA:1020}; S.nextGW=1; S.currentGW=0; S.seasonLive=false;
  S.cachedAt=Date.parse('2026-08-15T09:00:00Z'); S.dataIssues=[]; S.retryStats={}; S.minuteHistory={};
  S.manual=[]; S.picks=null; S.calib=null; S.ustat=null; S.odds=null; S.teamId='7654321'; S.entry={name:'PRIVATE MANAGER NAME'};
  clearXP(); resetHealth(); markLive('fpl','synthetic','core current',Date.parse('2026-08-15T09:00:00Z'));
  const record=collectPreDeadlinePayload({managerRef:'mgr-0123456789abcdef0123456789abcdef',horizon:1,startedAt:Date.parse('2026-08-15T09:00:00Z')});
  const text=stableStringify(record);
  assert.equal(text.includes('7654321'),false);
  assert.equal(text.includes('PRIVATE MANAGER NAME'),false);
  assert.equal(record.outputs.players.length,1);
  assert.equal(record.outputs.players[0].uncertainty.status,'not_available');
  assert.equal(record.providers.find(row=>row.provider==='fpl').included,true);
  assert.equal(record.outputs.squad.status,'not_available');
});

test('chunked collection preserves projections while yielding between player batches',async()=>{
  let yields=0;
  const extra={...S.boot.elements[0],id:11,web_name:'Second'};
  S.boot.elements.push(extra); S.byId[11]=extra; clearXP();
  try{
    const sync=collectPreDeadlinePayload({managerRef:'mgr-0123456789abcdef0123456789abcdef',horizon:1,startedAt:Date.parse('2026-08-15T09:00:00Z')});
    const chunked=await collectPreDeadlinePayloadAsync({managerRef:'mgr-0123456789abcdef0123456789abcdef',horizon:1,startedAt:Date.parse('2026-08-15T09:00:00Z'),yieldEvery:1,yieldFn:async()=>{ yields++; }});
    assert.deepEqual(chunked.outputs.players,sync.outputs.players);
    assert.deepEqual(chunked.modelInputs,sync.modelInputs);
    assert.equal(yields,1);
  }finally{
    S.boot.elements.pop(); delete S.byId[11]; clearXP();
  }
});

test('Stage 10.1 UI and deterministic bundle order include the evidence surface',()=>{
  const html=readFileSync(new URL('../app.html',import.meta.url),'utf8');
  const build=readFileSync(new URL('../build.mjs',import.meta.url),'utf8');
  assert.match(html,/id="evidencePanel"/);
  assert.match(html,/id="captureEvidenceBtn"/);
  assert.match(html,/id="evidenceImport"/);
  assert.match(html,/id="deleteEvidenceBtn"/);
  assert.ok(build.indexOf("src/evidence/snapshot.mjs")<build.indexOf("src/ui/evidence.mjs"));
  const dist=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
  assert.match(dist,/function findForbiddenEvidence\(value,path='\$',findings=\[\]\)/);
  assert.doesNotMatch(dist,/\n<\/body>\n<\/html>\n,findings=/);
});
