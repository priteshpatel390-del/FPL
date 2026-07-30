import { webcrypto } from 'node:crypto';
import { S } from '../src/state.mjs';
import { finaliseSnapshotRecord } from '../src/evidence/snapshot.mjs';
import { collectOutcomePayload, finaliseOutcomeRecord } from '../src/evidence/outcome.mjs';
import { buildGameweekEvaluation, buildTransferHorizonEvaluation } from '../src/evidence/metrics.mjs';

export const REVIEW_MANAGER_REF='mgr-0123456789abcdef0123456789abcdef';

function deadlineForGameweek(gameweek){return `2026-08-${String(21+(gameweek-1)*7).padStart(2,'0')}T17:30:00.000Z`;}
function network(at){return {status:'available',serverAt:at,clientMidpointAt:at,skewMs:0,requestStartedAt:at-20,responseReceivedAt:at+20,roundTripMs:40,source:'same_origin_http_date'};}
function provider(name,at,included=true){return {provider:name,state:included?'Live':'Disabled',included,didAffectModel:included,acceptedRecordCount:included?1:0,rejectedRecordCount:0,recordedAt:new Date(at).toISOString(),lastSuccessAt:included?new Date(at).toISOString():null,ageMs:included?0:null,thresholdMs:null,note:'',consequence:''};}
function prediction(playerId,gameweek,fixtureId,{predictedPoints=5,clubId=1,name=`Player ${playerId}`}={}){
  return {
    playerId,web_name:name,clubId,position:3,nowCost:75,status:'a',
    minutes:{pStart:.7,pAppear:.9,p60:.6,expMin:70,confidence:.8,confidenceLabel:'High',source:'detailed'},
    nextGameweek:{gw:gameweek,total:predictedPoints,games:1,parts:{}},
    perGameweek:[{gw:gameweek,total:predictedPoints,games:1,parts:{}}],
    aggregate:{fromGameweek:gameweek,horizon:1,total:predictedPoints,perGameweek:[predictedPoints],games:1,parts:{}},
    uncertainty:{status:'available',p10:1,p25:3,median:5,p75:7,p90:10,blankProbability:.2,returnProbability:.5,haulProbability:.1,megaHaulProbability:.02},
    sourceUsage:{fpl:true,understat:false,odds:false,minutesSource:'detailed',archiveCalibration:false},fixtureId
  };
}
function snapshotPayload(gameweek,fixtureId,deadlineTime,players){
  const deadline=Date.parse(deadlineTime),recordedAt=deadline-30*60*1000;
  return {
    recordType:'preDeadlineSnapshot',schemaVersion:'1.0.0',metricVersion:'1.0.0',segmentationVersion:'1.0.0',managerRef:REVIEW_MANAGER_REF,
    season:'2026-27',gameweek,deadlineTime,
    build:{modelVersion:'2.4.0',rulesVersion:'2026-27.3',sourceHash:`source-gw${gameweek}`,commit:`commit-gw${gameweek}`,moduleOrder:[]},
    versions:{model:'2.4.0',rules:'2026-27.3',simulation:'1.0.0',snapshot:'1.0.0'},
    rules:{fpl:{season:'2026-27'},minutes:{},scoring:{},transfer:{},simulation:{version:'1.0.0'},odds:{},fixture:{baseGoals:1.42,homeTilt:1.1}},
    providers:['fpl','understat','odds','archive'].map(name=>provider(name,recordedAt,name==='fpl')),
    completeness:{complete:true,sections:{coreInputs:'complete',playerProjections:'complete'},fatalFplIssue:false,playerCount:players.length,expectedPlayerCount:players.length},
    capture:{startedAt:new Date(recordedAt-60*1000).toISOString(),projectionStartedAt:new Date(recordedAt).toISOString(),projectionCompletedAt:new Date(recordedAt+1000).toISOString(),horizon:6},
    modelInputs:{players:players.map(row=>({id:row.playerId,web_name:row.web_name})),teams:[],events:[],fixtures:[{id:fixtureId,event:gameweek,team_h:1,team_a:2,team_h_difficulty:2,team_a_difficulty:4}],minuteHistory:{},calibration:null,understat:null,odds:null},
    outputs:{players,squad:{status:'not_available'}},retries:[],issues:[],quality:{projectionDurationMs:1,simulationSamplesPerAvailablePlayer:5000,seasonLive:true}
  };
}
function event(gameweek,deadlineTime){return {id:gameweek,deadline_time:deadlineTime,finished:true,data_checked:true};}
function fixture(gameweek,fixtureId){return {id:fixtureId,code:fixtureId*10,event:gameweek,team_h:1,team_a:2,kickoff_time:new Date(Date.parse(deadlineForGameweek(gameweek))+24*60*60*1000).toISOString(),started:true,finished:true,finished_provisional:true,team_h_score:1,team_a_score:0,minutes:90,provisional_start_time:false,stats:[]};}
function officialPlayer(playerId,fixtureId,{observedPoints=6,minutes=90,starts=1}={}){
  return {id:playerId,stats:{total_points:observedPoints,minutes,starts,goals_scored:0,assists:0,clean_sheets:1,goals_conceded:0,saves:0,bonus:0,bps:20,yellow_cards:0,red_cards:0,own_goals:0,penalties_missed:0,penalties_saved:0,defensive_contribution:0},explain:[{fixture:fixtureId,stats:[{identifier:'total_points',points:observedPoints,value:observedPoints},{identifier:'minutes',points:0,value:minutes},{identifier:'starts',points:0,value:starts}]}]};
}

export async function makeReviewEvidence({gameweek=1,predictedPoints=5,observedPoints=6,frozenFixtureId=gameweek*10,officialFixtureId=frozenFixtureId,previousOutcome=null,previousEvaluation=null,playerName=`Player ${gameweek}`}={}){
  const deadlineTime=deadlineForGameweek(gameweek),deadline=Date.parse(deadlineTime),completed=deadline-20*60*1000,players=[prediction(gameweek,gameweek,frozenFixtureId,{predictedPoints,name:playerName})];
  const snapshot=await finaliseSnapshotRecord(snapshotPayload(gameweek,frozenFixtureId,deadlineTime,players),{captureStartedAt:completed-1000,captureCompletedAt:completed,networkBefore:network(completed-900),networkAfter:network(completed)},webcrypto);
  S.boot={events:[event(gameweek,deadlineTime)],elements:[{id:gameweek}],teams:[],element_types:[]};S.retryStats={};S.teamId='';
  const collected=await collectOutcomePayload({managerRef:REVIEW_MANAGER_REF,gameweek,event:event(gameweek,deadlineTime),fixturesPayload:[fixture(gameweek,officialFixtureId)],livePayload:{elements:[officialPlayer(gameweek,officialFixtureId,{observedPoints})]},snapshotRecords:[snapshot],startedAt:completed+60*60*1000,completedAt:completed+60*60*1000+1000,cryptoImpl:webcrypto});
  if(!collected.ok) throw new Error(`Outcome fixture failed: ${collected.reason}`);
  const outcomeResult=await finaliseOutcomeRecord(collected.payload,{previousRecord:previousOutcome},webcrypto),outcome=outcomeResult.record;
  const evaluationResult=await buildGameweekEvaluation(snapshot,outcome,{previousRecord:previousEvaluation,cryptoImpl:webcrypto});
  if(!evaluationResult.ok) throw new Error(`Evaluation fixture failed: ${evaluationResult.reason}`);
  return {snapshot,outcome,evaluation:evaluationResult.record};
}

export async function makeTransferEvaluation(startEvaluation){
  const positions=new Map([[1,1],[2,1],[3,2],[4,2],[5,2],[6,2],[7,2],[8,3],[9,3],[10,3],[11,3],[12,3],[13,4],[14,4],[15,4],[16,4]]),squad=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],planSquad=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,16],xi=[1,3,4,5,8,9,10,11,13,14,15],planXi=[1,3,4,5,8,9,10,11,13,14,16];
  const players=[...positions].map(([playerId,position])=>({playerId,position,perGameweek:[{gw:startEvaluation.gameweek,total:playerId===16?8:4}]}));
  const synthetic={...startEvaluation,observations:{players:[...positions].map(([playerId])=>({playerId,observedPoints:playerId===16?12:playerId===15?2:4,appeared:true,scheduleAligned:true}))},decisions:{transferBasis:{horizon:1,players,baseline:{transferCount:0,finalSquadIds:squad,perGameweekBestXI:[{gw:startEvaluation.gameweek,playerIds:xi}],hitCost:0,rollDifference:0,freeTransfersNextGW:2,signature:''},plans:[{transferCount:1,finalSquadIds:planSquad,perGameweekBestXI:[{gw:startEvaluation.gameweek,playerIds:planXi}],hitCost:4,rollDifference:-1,freeTransfersNextGW:1,signature:'15>16',transfers:[{outPlayerId:15,inPlayerId:16}]}]}}};
  const built=await buildTransferHorizonEvaluation(synthetic,new Map([[Number(startEvaluation.gameweek),synthetic]]),{cryptoImpl:webcrypto});
  if(!built.ok) throw new Error(`Transfer fixture failed: ${built.reason}`);
  return built.record;
}
