/* GW1-P2C5 — deterministic infrastructure-acceptance evidence.

   This builder is intentionally independent of runtime state. It accepts no
   arguments, performs no reads and uses no network-derived facts. Its fixed
   2099-00/GW38 identity can therefore never contain a manager, squad,
   provider-cache or league fact from the person running Teamsheet. */

import { finaliseSnapshotRecord } from './snapshot.mjs';

const STAGE10_ACCEPTANCE_SEASON = '2099-00';
const STAGE10_ACCEPTANCE_GAMEWEEK = 38;
const STAGE10_ACCEPTANCE_MANAGER_REF = 'mgr-000000000000000000000000000000c5';
const STAGE10_ACCEPTANCE_DEADLINE = '2099-05-23T18:30:00.000Z';
const STAGE10_ACCEPTANCE_CAPTURE_STARTED = '2099-05-23T18:00:00.000Z';
const STAGE10_ACCEPTANCE_CAPTURE_COMPLETED = '2099-05-23T18:00:01.000Z';
/* Filled from finaliseSnapshotRecord(), never hand-authored. The constants
   make both UI admission and foreign-season outbox admission fail closed. */
const STAGE10_ACCEPTANCE_CONTENT_HASH = 'ae9149da8e77faaaf1f25400310de7f5c2e7a1c2f20c9645e7ba99a9fa3c4408';
const STAGE10_ACCEPTANCE_SNAPSHOT_ID = 'predeadline-gw38-ae9149da8e77faaa';

function disabledProvider(provider){
  return {
    provider,state:'Disabled',included:false,didAffectModel:false,
    acceptedRecordCount:0,rejectedRecordCount:0,
    recordedAt:STAGE10_ACCEPTANCE_CAPTURE_COMPLETED,lastSuccessAt:null,
    ageMs:null,thresholdMs:null,note:'synthetic acceptance fixture; provider disabled',
    consequence:'excluded from model use'
  };
}

function stage10AcceptancePayload(){
  return {
    recordType:'preDeadlineSnapshot',schemaVersion:'1.0.0',metricVersion:'1.0.0',segmentationVersion:'1.0.0',
    managerRef:STAGE10_ACCEPTANCE_MANAGER_REF,season:STAGE10_ACCEPTANCE_SEASON,gameweek:STAGE10_ACCEPTANCE_GAMEWEEK,
    deadlineTime:STAGE10_ACCEPTANCE_DEADLINE,
    capture:{startedAt:STAGE10_ACCEPTANCE_CAPTURE_STARTED,projectionStartedAt:STAGE10_ACCEPTANCE_CAPTURE_STARTED,
      projectionCompletedAt:STAGE10_ACCEPTANCE_CAPTURE_COMPLETED,horizon:1},
    build:{modelVersion:'acceptance-fixture',rulesVersion:'acceptance-fixture',sourceHash:'gw1-p2c5-stage10-acceptance-v1',
      commit:'synthetic-fixture',moduleOrder:[]},
    versions:{model:'acceptance-fixture',rules:'acceptance-fixture',simulation:'acceptance-fixture',snapshot:'1.0.0'},
    rules:{fpl:{season:STAGE10_ACCEPTANCE_SEASON},minutes:{},scoring:{},transfer:{},simulation:{version:'acceptance-fixture'},
      odds:{},fixture:{baseGoals:0,homeTilt:0}},
    providers:['fpl','understat','odds','archive'].map(disabledProvider),
    retries:[],issues:[],
    modelInputs:{events:[],teams:[],players:[],fixtures:[],minuteHistory:{},calibration:null,understat:null,odds:null},
    outputs:{players:[],squad:{status:'not_available',reason:'synthetic_acceptance_fixture',players:[],modelDecision:null,userPreview:null,optimiser:null}},
    completeness:{complete:false,sections:{coreInputs:'incomplete',playerProjections:'incomplete',uncertainty:'not_available',squad:'not_available'},
      fatalFplIssue:false,playerCount:0,expectedPlayerCount:0},
    quality:{projectionDurationMs:1000,simulationSamplesPerAvailablePlayer:0,seasonLive:false}
  };
}

async function buildStage10AcceptanceFixture(cryptoImpl=globalThis.crypto){
  const record=await finaliseSnapshotRecord(stage10AcceptancePayload(),{
    captureStartedAt:Date.parse(STAGE10_ACCEPTANCE_CAPTURE_STARTED),
    captureCompletedAt:Date.parse(STAGE10_ACCEPTANCE_CAPTURE_COMPLETED),
    networkBefore:{status:'unavailable',reason:'synthetic_fixture_no_network'},
    networkAfter:{status:'unavailable',reason:'synthetic_fixture_no_network'}
  },cryptoImpl);
  return record;
}

function isExactStage10AcceptanceIdentity(value){
  return value?.season===STAGE10_ACCEPTANCE_SEASON && value?.gameweek===STAGE10_ACCEPTANCE_GAMEWEEK &&
    (value?.recordType===undefined || value.recordType==='preDeadlineSnapshot') &&
    (value?.schemaVersion===undefined || value.schemaVersion==='1.0.0') &&
    (value?.origin===undefined || value.origin==='local_capture') &&
    (value?.completeness===undefined || value.completeness?.complete===false) &&
    (value?.timing===undefined || (value.timing?.officialEligible===false && value.timing?.grade==='client_recorded')) &&
    (value?.identity?.contentHash ?? value?.contentHash)===STAGE10_ACCEPTANCE_CONTENT_HASH &&
    (value?.identity?.snapshotId ?? value?.snapshotId)===STAGE10_ACCEPTANCE_SNAPSHOT_ID;
}

export {
  STAGE10_ACCEPTANCE_SEASON,STAGE10_ACCEPTANCE_GAMEWEEK,STAGE10_ACCEPTANCE_MANAGER_REF,
  STAGE10_ACCEPTANCE_CONTENT_HASH,STAGE10_ACCEPTANCE_SNAPSHOT_ID,
  stage10AcceptancePayload,buildStage10AcceptanceFixture,isExactStage10AcceptanceIdentity
};
