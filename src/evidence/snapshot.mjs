import { S, KEEP } from '../state.mjs';
import { $, num } from '../util.mjs';
import {
  MODEL_VERSION, RULES_VERSION, FPL_RULES, MINUTES_RULES, SCORING_RULES,
  TRANSFER_RULES, SIMULATION_RULES, ODDS_RULES, BASE_GOALS, HOME_TILT
} from '../config.mjs';
import { APPROVED_PROVIDER_NAMES, healthRows, HEALTH_STATES, providerTrustError } from '../providers/registry.mjs';
import { minutesEstimate } from '../model/minutes.mjs';
import { projectXP, xpOf } from '../model/scoring.mjs';
import { teamFixtures } from '../model/fixtures.mjs';
import { simulatePlayerGameweek } from '../model/simulation.mjs';
import { mySquad, bestXI } from '../squad.mjs';
import { optimiseTransfers } from '../model/transfers.mjs';
import { decisionPreviewSnapshot, decisionPreviewSquadSignature } from '../ui/decision-preview.mjs';

const SNAPSHOT_SCHEMA_VERSION = '1.0.0';
const SNAPSHOT_METRIC_VERSION = '1.0.0';
const SNAPSHOT_SEGMENTATION_VERSION = '1.0.0';
const EVIDENCE_RULES = Object.freeze({
  captureWindowMs:24 * 60 * 60 * 1000,
  promptWindowMs:60 * 60 * 1000,
  idealWindowStartMs:20 * 60 * 1000,
  idealWindowEndMs:10 * 60 * 1000,
  safetyCutoffMs:2 * 60 * 1000,
  maxClockSkewMs:60 * 1000,
  localFullRecordLimit:2,
  localIndexLimit:3
});
const FORBIDDEN_KEY = /^(?:api[-_]?key|odds[-_]?key|claude[-_]?key|anthropic[-_]?key|authorization|password|secret|access[-_]?token|refresh[-_]?token|token|team[-_]?id|entry(?:[-_]?id)?|league[-_]?id|manager[-_]?name|email|phone)$/i;
const RESTRICTED_SECRET_PREFIX = ['sk','ant'].join('-') + '-';
const FORBIDDEN_VALUE = /(?:api[_-]?key\s*[:=]|authorization\s*[:=]\s*bearer)/i;

function canonicalise(value){
  if(value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if(typeof value === 'number'){
    if(!Number.isFinite(value)) throw new Error('Evidence records cannot contain non-finite numbers');
    return Object.is(value,-0) ? 0 : value;
  }
  if(Array.isArray(value)) return value.map(canonicalise);
  if(typeof value === 'object'){
    const out = {};
    Object.keys(value).sort().forEach(key => {
      if(value[key] !== undefined) out[key] = canonicalise(value[key]);
    });
    return out;
  }
  throw new Error('Evidence records contain an unsupported value');
}
function stableStringify(value){ return JSON.stringify(canonicalise(value)); }

async function sha256Hex(text, cryptoImpl = globalThis.crypto){
  if(!cryptoImpl?.subtle || typeof TextEncoder === 'undefined') throw new Error('SHA-256 is unavailable in this browser');
  const bytes = new TextEncoder().encode(String(text));
  const digest = await cryptoImpl.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,'0')).join('');
}
function deepFreeze(value){
  if(!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}
function findForbiddenEvidence(value,path='$',findings=[]){
  if(value === null || value === undefined) return findings;
  if(typeof value === 'string'){
    if(value.includes(RESTRICTED_SECRET_PREFIX) || FORBIDDEN_VALUE.test(value)) findings.push(`${path}:secret_value`);
    return findings;
  }
  if(Array.isArray(value)){
    value.forEach((entry,index) => findForbiddenEvidence(entry,`${path}[${index}]`,findings));
    return findings;
  }
  if(typeof value === 'object'){
    Object.entries(value).forEach(([key,entry]) => {
      if(FORBIDDEN_KEY.test(key)) findings.push(`${path}.${key}:secret_key`);
      findForbiddenEvidence(entry,`${path}.${key}`,findings);
    });
  }
  return findings;
}
function assertEvidenceSafe(value){
  const findings = findForbiddenEvidence(value);
  if(findings.length) throw new Error(`Evidence safety check failed: ${findings.join(', ')}`);
  return true;
}
function buildInfo(){
  const info = typeof BUILD_INFO !== 'undefined' ? BUILD_INFO : globalThis.BUILD_INFO;
  return info && typeof info === 'object' ? canonicalise(info) : {
    modelVersion:MODEL_VERSION,
    rulesVersion:RULES_VERSION,
    sourceHash:'unavailable',
    commit:'unversioned',
    moduleOrder:[]
  };
}
function iso(value){
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
function deadlineWindow(deadlineTime, now = Date.now()){
  const deadlineMs = Date.parse(deadlineTime);
  if(!Number.isFinite(deadlineMs)) return {state:'unavailable',deadlineMs:null,remainingMs:null};
  const remainingMs = deadlineMs - now;
  let state = 'closed';
  if(remainingMs > EVIDENCE_RULES.captureWindowMs) state = 'too_early';
  else if(remainingMs > EVIDENCE_RULES.promptWindowMs) state = 'open';
  else if(remainingMs > EVIDENCE_RULES.idealWindowStartMs) state = 'due_soon';
  else if(remainingMs >= EVIDENCE_RULES.idealWindowEndMs) state = 'ideal';
  else if(remainingMs > EVIDENCE_RULES.safetyCutoffMs) state = 'final_window';
  else if(remainingMs > 0) state = 'safety_cutoff';
  return {state,deadlineMs,remainingMs};
}

async function sampleNetworkClock({fetchFn=globalThis.fetch,locationHref=globalThis.location?.href,nowFn=Date.now}={}){
  if(typeof fetchFn !== 'function' || !/^https?:/i.test(String(locationHref||'')))
    return {status:'unavailable',reason:'same_origin_http_unavailable'};
  const requestStartedAt = nowFn();
  try{
    const url = new URL(locationHref);
    url.hash = '';
    url.searchParams.set('_teamsheet_clock',String(requestStartedAt));
    const response = await fetchFn(url.toString(),{method:'HEAD',cache:'no-store',credentials:'same-origin'});
    const responseReceivedAt = nowFn();
    const rawDate = response?.headers?.get?.('date');
    const serverAt = Date.parse(rawDate);
    if(!Number.isFinite(serverAt)) return {status:'unavailable',reason:'date_header_unavailable',requestStartedAt,responseReceivedAt};
    const clientMidpointAt = requestStartedAt + (responseReceivedAt-requestStartedAt)/2;
    return {
      status:'available',
      requestStartedAt,
      responseReceivedAt,
      serverAt,
      clientMidpointAt,
      roundTripMs:Math.max(0,responseReceivedAt-requestStartedAt),
      skewMs:serverAt-clientMidpointAt,
      source:'same_origin_http_date'
    };
  }catch(error){
    return {status:'unavailable',reason:'network_time_request_failed',requestStartedAt,responseReceivedAt:nowFn()};
  }
}

function safeEndpoint(value){
  return String(value||'').replace(/\/entry\/\d+/g,'/entry/[redacted]').replace(/\/leagues-classic\/\d+/g,'/leagues-classic/[redacted]').slice(0,160);
}
function safeIssue(issue){
  return canonicalise({
    provider:String(issue?.provider||''),
    endpoint:safeEndpoint(issue?.endpoint),
    code:String(issue?.code||''),
    severity:String(issue?.severity||''),
    count:Number.isFinite(Number(issue?.count)) ? Number(issue.count) : 1,
    received:issue?.received == null ? null : String(issue.received).slice(0,80)
  });
}
function safeRetry(record){
  return canonicalise({
    provider:String(record?.provider||''),
    endpoint:safeEndpoint(record?.endpoint),
    attempts:Math.max(0,Math.trunc(num(record?.attempts))),
    outcome:String(record?.outcome||record?.status||'').slice(0,80),
    usedFallback:Boolean(record?.usedFallback),
    completedAt:Number.isFinite(Number(record?.completedAt||record?.at)) ? Number(record.completedAt||record.at) : null
  });
}
function providerIncluded(name){
  if(name === 'fpl') return Boolean(S.boot);
  if(name === 'understat') return Boolean(S.ustat);
  if(name === 'odds') return Boolean(S.odds && Object.keys(S.odds).length);
  if(name === 'archive') return Boolean(S.calib);
  return false;
}
function providerAcceptedCount(name){
  if(name === 'fpl') return (S.boot?.elements?.length||0)+(S.boot?.teams?.length||0)+(S.fixtures?.length||0);
  if(name === 'understat') return S.ustat ? Object.keys(S.ustat).length : 0;
  if(name === 'odds') return S.odds ? Object.keys(S.odds).length : 0;
  if(name === 'archive') return S.calib ? Object.keys(S.calib).length : 0;
  return 0;
}
function providerRejectedCount(name){
  return (S.dataIssues||[]).filter(issue=>issue?.provider===name).reduce((sum,issue)=>sum+Math.max(1,Math.trunc(num(issue?.count)||1)),0);
}
function providerEvidence(now){
  const rows = healthRows({seasonLive:S.seasonLive},now);
  const byName = Object.fromEntries(rows.map(row => [row.provider,row]));
  if(!byName.fpl){
    byName.fpl = {provider:'fpl',state:S.boot?HEALTH_STATES.CACHED:HEALTH_STATES.UNAVAILABLE,note:'runtime health record missing',consequence:'',lastSuccess:S.cachedAt||null,at:now,ageMs:S.cachedAt?Math.max(0,now-S.cachedAt):null};
  }
  return APPROVED_PROVIDER_NAMES.map(name => {
    const included=providerIncluded(name);
    const row = byName[name] || (included
      ? {provider:name,state:HEALTH_STATES.CACHED,note:'saved model input active',consequence:'affects current projections',lastSuccess:null,at:now,ageMs:null,thresholdMs:null}
      : {provider:name,state:HEALTH_STATES.DISABLED,note:'not active',consequence:'',lastSuccess:null,at:now,ageMs:null,thresholdMs:null});
    return canonicalise({
      provider:name,
      state:row.state,
      included,
      didAffectModel:included,
      acceptedRecordCount:providerAcceptedCount(name),
      rejectedRecordCount:providerRejectedCount(name),
      lastSuccessAt:row.lastSuccess ? new Date(row.lastSuccess).toISOString() : null,
      recordedAt:row.at ? new Date(row.at).toISOString() : new Date(now).toISOString(),
      ageMs:row.ageMs,
      thresholdMs:row.thresholdMs ?? null,
      note:String(row.note||''),
      consequence:String(row.consequence||'')
    });
  });
}
function playerInput(player){
  const out = {};
  KEEP.forEach(key => { if(player?.[key] !== undefined) out[key] = player[key]; });
  return canonicalise(out);
}
function minuteHistoryInput(){
  const out = {};
  Object.keys(S.minuteHistory||{}).sort((a,b)=>Number(a)-Number(b)).forEach(id => {
    out[id] = (Array.isArray(S.minuteHistory[id]) ? S.minuteHistory[id] : []).map(row => canonicalise({
      event:Number(row?.event)||0,
      minutes:Number(row?.minutes)||0,
      starts:row?.starts == null ? null : Number(row.starts)
    }));
  });
  return out;
}
function projectionSourceUsage(player,nextGW,horizon,minutes){
  const fixtures=teamFixtures(player.team,nextGW,horizon).flat();
  const understat=fixtures.some(game=>Boolean(S.ustat?.[player.team]&&S.ustat?.[game.oppId]));
  const odds=fixtures.some(game=>{
    const pair=game.home?`${player.team}|${game.oppId}`:`${game.oppId}|${player.team}`;
    return Boolean(S.odds?.[pair]);
  });
  return canonicalise({
    fpl:true,
    understat,
    odds,
    minutesSource:String(minutes?.source||'unknown'),
    archiveCalibration:Boolean(S.calib?.[player.element_type])
  });
}
function projectionRecord(player,nextGW,horizon){
  const perGameweek = [];
  for(let gw=nextGW;gw<nextGW+horizon;gw++){
    const projection = projectXP(player,gw,1);
    perGameweek.push(canonicalise({gw,total:projection.total,games:projection.games,parts:projection.parts}));
  }
  const aggregate = projectXP(player,nextGW,horizon);
  const minutes = minutesEstimate(player);
  const simulation = simulatePlayerGameweek(player,nextGW,{includeSamples:false});
  const uncertainty = simulation.available ? canonicalise({
    status:'available',
    quality:simulation.quality,
    seed:simulation.seed ?? null,
    sampleCount:Number(simulation.sampleCount)||0,
    mean:simulation.mean,
    p10:simulation.p10,
    p25:simulation.p25,
    median:simulation.median,
    p75:simulation.p75,
    p90:simulation.p90,
    blankProbability:simulation.blankProbability,
    returnProbability:simulation.returnProbability,
    haulProbability:simulation.haulProbability,
    megaHaulProbability:simulation.megaHaulProbability,
    appearanceProbability:simulation.appearanceProbability,
    sixtyProbability:simulation.sixtyProbability
  }) : canonicalise({status:'not_available',reason:simulation.reason||'unavailable',quality:simulation.quality||null,sampleCount:0});
  return canonicalise({
    playerId:Number(player.id),
    clubId:Number(player.team),
    position:Number(player.element_type),
    nowCost:Number(player.now_cost),
    status:String(player.status||''),
    chanceOfPlaying:player.chance_of_playing_next_round == null ? null : Number(player.chance_of_playing_next_round),
    minutes,
    nextGameweek:perGameweek[0]||{gw:nextGW,total:0,games:0,parts:{}},
    perGameweek,
    aggregate:{fromGameweek:nextGW,horizon,total:aggregate.total,perGameweek:aggregate.perGW,games:aggregate.games,parts:aggregate.parts},
    uncertainty,
    sourceUsage:projectionSourceUsage(player,nextGW,horizon,minutes)
  });
}
function planRecord(plan){
  if(!plan) return null;
  return canonicalise({
    transferCount:plan.transferCount,
    transfers:plan.transfers||[],
    finalSquadIds:plan.finalSquadIds||[],
    bankBefore:plan.bankBefore,
    bankAfter:plan.bankAfter,
    freeTransfersBefore:plan.freeTransfersBefore,
    paidTransfers:plan.paidTransfers,
    hitCost:plan.hitCost,
    freeTransfersNextGW:plan.freeTransfersNextGW,
    grossBestXIPoints:plan.grossBestXIPoints,
    grossGain:plan.grossGain,
    rollDifference:plan.rollDifference,
    netGain:plan.netGain,
    perGameweekBestXI:plan.perGameweekBestXI||[],
    signature:plan.signature||'',
    warnings:plan.warnings||[],
    pricingMode:plan.pricingMode||null
  });
}
function squadEvidence(nextGW,horizon){
  const squad = mySquad();
  if(squad.length !== 15) return {status:'not_available',reason:'complete_squad_not_loaded',players:[],modelDecision:null,userPreview:canonicalise(decisionPreviewSnapshot()),optimiser:null};
  const xi = bestXI(squad,nextGW);
  const ranked = xi.xi.slice().sort((a,b)=>xpOf(b.p,nextGW,1).total-xpOf(a.p,nextGW,1).total || Number(a.p.id)-Number(b.p.id));
  const bank = Math.max(0,Math.round(num($('bankIn')?.value)*10));
  const freeTransfers = Math.max(0,Math.min(5,Math.trunc(num($('ftCount')?.value)||0)));
  const squadSignature=decisionPreviewSquadSignature(squad);
  const cached=S.lastOptimiser;
  const optimiser=cached&&cached.squadSignature===squadSignature&&cached.horizon===horizon&&cached.bank===bank&&
    cached.freeTransfers===freeTransfers&&cached.startGW===nextGW
    ? cached.result
    : optimiseTransfers({
      squad,
      players:S.boot?.elements||[],
      bank,
      freeTransfers,
      startGW:nextGW,
      horizon,
      maxResults:20,
      scorePlayer:(player,gw)=>xpOf(player,gw,1).total
    });
  return canonicalise({
    status:'available',
    source:$('useManual')?.checked ? 'manual' : 'fpl_public_picks',
    players:squad.map(entry => ({
      playerId:Number(entry.p.id),
      purchasePrice:entry.bought == null ? null : Number(entry.bought),
      position:entry.position == null ? null : Number(entry.position),
      multiplier:entry.multiplier == null ? null : Number(entry.multiplier),
      isCaptain:Boolean(entry.is_captain)
    })).sort((a,b)=>a.playerId-b.playerId),
    modelDecision:{
      gameweek:nextGW,
      formation:xi.shape,
      bestXIPlayerIds:xi.xi.map(entry=>Number(entry.p.id)),
      benchPlayerIds:xi.bench.map(entry=>Number(entry.p.id)),
      xiProjectedPoints:xi.tot,
      captainId:ranked[0]?.p?.id ?? null,
      viceCaptainId:ranked[1]?.p?.id ?? null
    },
    userPreview:decisionPreviewSnapshot(),
    optimiser:{
      status:optimiser.status,
      horizon,
      evaluations:optimiser.evaluations??null,
      pruned:optimiser.pruned??null,
      issues:optimiser.issues||[],
      baseline:planRecord(optimiser.baseline),
      plans:(optimiser.plans||[]).map(planRecord)
    }
  });
}
function collectPreDeadlinePayload({managerRef,horizon,startedAt=Date.now(),projectionRows=null,projectionStartedAtOverride=null,projectionCompletedAtOverride=null}={}){
  if(!S.boot || !Array.isArray(S.boot.events) || !Array.isArray(S.boot.elements)) throw new Error('Season data must be loaded before evidence can be captured');
  const nextGW = Number(S.nextGW)||1;
  const event = S.boot.events.find(row => Number(row.id)===nextGW);
  if(!event?.deadline_time) throw new Error('The next FPL deadline is unavailable');
  const cleanHorizon = Math.max(1,Math.min(8,Math.trunc(num(horizon)||6)));
  const projectionStartedAt = projectionStartedAtOverride ?? Date.now();
  const projections = projectionRows || S.boot.elements.slice().sort((a,b)=>Number(a.id)-Number(b.id)).map(player => projectionRecord(player,nextGW,cleanHorizon));
  const projectionCompletedAt = projectionCompletedAtOverride ?? Date.now();
  const issues = (S.dataIssues||[]).map(safeIssue);
  const providers = providerEvidence(projectionCompletedAt);
  const fatalFplIssue = issues.some(issue => issue.provider==='fpl' && issue.severity==='fatal');
  const projectionComplete = projections.length===S.boot.elements.length && projections.every(row => row.minutes && row.nextGameweek && row.uncertainty);
  const squad = squadEvidence(nextGW,cleanHorizon);
  const sections = {
    coreInputs:S.boot && S.fixtures ? 'complete' : 'incomplete',
    playerProjections:projectionComplete ? 'complete' : 'incomplete',
    uncertainty:S.seasonLive ? (projections.every(row=>row.uncertainty.status==='available')?'complete':'incomplete') : 'not_available_preseason',
    squad:squad.status
  };
  const payload = {
    recordType:'preDeadlineSnapshot',
    schemaVersion:SNAPSHOT_SCHEMA_VERSION,
    metricVersion:SNAPSHOT_METRIC_VERSION,
    segmentationVersion:SNAPSHOT_SEGMENTATION_VERSION,
    managerRef:String(managerRef||''),
    season:FPL_RULES.season,
    gameweek:nextGW,
    deadlineTime:new Date(event.deadline_time).toISOString(),
    capture:{startedAt:new Date(startedAt).toISOString(),projectionStartedAt:new Date(projectionStartedAt).toISOString(),projectionCompletedAt:new Date(projectionCompletedAt).toISOString(),horizon:cleanHorizon},
    build:buildInfo(),
    versions:{model:MODEL_VERSION,rules:RULES_VERSION,simulation:SIMULATION_RULES.version,snapshot:SNAPSHOT_SCHEMA_VERSION},
    rules:{
      fpl:FPL_RULES,
      minutes:MINUTES_RULES,
      scoring:SCORING_RULES,
      transfer:TRANSFER_RULES,
      simulation:SIMULATION_RULES,
      odds:ODDS_RULES,
      fixture:{baseGoals:BASE_GOALS,homeTilt:HOME_TILT}
    },
    providers,
    retries:Object.values(S.retryStats||{}).map(safeRetry).sort((a,b)=>(a.provider+a.endpoint).localeCompare(b.provider+b.endpoint)),
    issues,
    modelInputs:{
      events:S.boot.events.map(row=>canonicalise(row)),
      teams:S.boot.teams.map(row=>canonicalise(row)).sort((a,b)=>a.id-b.id),
      players:S.boot.elements.map(playerInput).sort((a,b)=>a.id-b.id),
      fixtures:(S.fixtures||[]).map(row=>canonicalise(row)).sort((a,b)=>(a.event??99)-(b.event??99)||a.id-b.id),
      minuteHistory:minuteHistoryInput(),
      calibration:S.calib ? canonicalise(S.calib) : null,
      understat:S.ustat ? canonicalise(S.ustat) : null,
      odds:S.odds ? canonicalise(S.odds) : null
    },
    outputs:{players:projections,squad},
    completeness:{complete:sections.coreInputs==='complete'&&sections.playerProjections==='complete'&&!fatalFplIssue,sections,fatalFplIssue,playerCount:projections.length,expectedPlayerCount:S.boot.elements.length},
    quality:{projectionDurationMs:Math.max(0,projectionCompletedAt-projectionStartedAt),simulationSamplesPerAvailablePlayer:SIMULATION_RULES.productionSamples,seasonLive:Boolean(S.seasonLive)}
  };
  assertEvidenceSafe(payload);
  return canonicalise(payload);
}

async function collectPreDeadlinePayloadAsync({managerRef,horizon,startedAt=Date.now(),yieldEvery=20,yieldFn=null}={}){
  if(!S.boot || !Array.isArray(S.boot.events) || !Array.isArray(S.boot.elements)) throw new Error('Season data must be loaded before evidence can be captured');
  const nextGW=Number(S.nextGW)||1;
  const cleanHorizon=Math.max(1,Math.min(8,Math.trunc(num(horizon)||6)));
  const projectionStartedAt=Date.now(), projections=[];
  const players=S.boot.elements.slice().sort((a,b)=>Number(a.id)-Number(b.id));
  const pause=yieldFn||(()=>new Promise(resolve=>setTimeout(resolve,0)));
  for(let i=0;i<players.length;i++){
    projections.push(projectionRecord(players[i],nextGW,cleanHorizon));
    if(yieldEvery>0&&(i+1)%yieldEvery===0&&i+1<players.length) await pause();
  }
  return collectPreDeadlinePayload({
    managerRef,horizon:cleanHorizon,startedAt,projectionRows:projections,
    projectionStartedAtOverride:projectionStartedAt,projectionCompletedAtOverride:Date.now()
  });
}

function clockSampleUsable(sample){
  return sample?.status==='available' && Number.isFinite(Number(sample.serverAt)) && Number.isFinite(Number(sample.skewMs));
}
function assessDeadlineTiming({deadlineTime,captureStartedAt,captureCompletedAt,networkBefore,networkAfter,providers=[],complete=false}={}){
  const deadlineMs = Date.parse(deadlineTime);
  const startedMs = Number(captureStartedAt);
  const completedMs = Number(captureCompletedAt);
  if(!Number.isFinite(deadlineMs)||!Number.isFinite(startedMs)||!Number.isFinite(completedMs)) throw new Error('Deadline timing inputs are invalid');
  const cutoffMs = deadlineMs-EVIDENCE_RULES.safetyCutoffMs;
  const beforeUsable = clockSampleUsable(networkBefore);
  const afterUsable = clockSampleUsable(networkAfter);
  const skewConflict = (beforeUsable&&Math.abs(networkBefore.skewMs)>EVIDENCE_RULES.maxClockSkewMs) || (afterUsable&&Math.abs(networkAfter.skewMs)>EVIDENCE_RULES.maxClockSkewMs);
  const referenceCompletedAt = afterUsable ? Number(networkAfter.serverAt) : completedMs;
  const includedProviders = (providers||[]).filter(row=>row.included);
  const lateProvider = includedProviders.find(row => {
    const at = Date.parse(row.recordedAt);
    return !Number.isFinite(at) || at>=cutoffMs;
  });
  const reasons=[];
  if(referenceCompletedAt>deadlineMs) reasons.push('after_deadline');
  if(referenceCompletedAt>=cutoffMs) reasons.push('inside_safety_cutoff');
  if(deadlineMs-referenceCompletedAt>EVIDENCE_RULES.captureWindowMs) reasons.push('outside_capture_window');
  if(!complete) reasons.push('snapshot_incomplete');
  if(lateProvider) reasons.push(`provider_after_cutoff:${lateProvider.provider}`);
  if(!beforeUsable||!afterUsable) reasons.push('network_time_unavailable');
  if(skewConflict) reasons.push('clock_conflict');
  let grade = 'network_attested';
  if(referenceCompletedAt>=cutoffMs) grade='late';
  else if(skewConflict) grade='clock_conflict';
  else if(!beforeUsable||!afterUsable) grade='client_recorded';
  const officialEligible = grade==='network_attested' && reasons.length===0;
  return canonicalise({
    grade,
    officialEligible,
    reasons,
    deadlineTime:new Date(deadlineMs).toISOString(),
    safetyCutoffTime:new Date(cutoffMs).toISOString(),
    captureStartedAt:new Date(startedMs).toISOString(),
    captureCompletedAt:new Date(completedMs).toISOString(),
    networkBefore:networkBefore||{status:'unavailable'},
    networkAfter:networkAfter||{status:'unavailable'},
    referenceCompletedAt:new Date(referenceCompletedAt).toISOString(),
    includedProviderCount:includedProviders.length,
    allIncludedProvidersBeforeCutoff:!lateProvider,
    withinCaptureWindow:deadlineMs-referenceCompletedAt<=EVIDENCE_RULES.captureWindowMs && referenceCompletedAt<deadlineMs,
    beforeSafetyCutoff:referenceCompletedAt<cutoffMs
  });
}
async function computeSectionHashes(payload,cryptoImpl=globalThis.crypto){
  const players=payload.outputs?.players||[];
  const sections={
    modelInputs:payload.modelInputs||null,
    playerProjections:players.map(row=>({playerId:row.playerId,nextGameweek:row.nextGameweek,perGameweek:row.perGameweek,aggregate:row.aggregate,sourceUsage:row.sourceUsage})),
    minutes:players.map(row=>({playerId:row.playerId,minutes:row.minutes})),
    uncertainty:players.map(row=>({playerId:row.playerId,uncertainty:row.uncertainty})),
    decisions:payload.outputs?.squad||null,
    providers:payload.providers||[],
    fplInputs:{events:payload.modelInputs?.events||[],teams:payload.modelInputs?.teams||[],players:payload.modelInputs?.players||[],fixtures:payload.modelInputs?.fixtures||[],minuteHistory:payload.modelInputs?.minuteHistory||{}},
    understatInputs:payload.modelInputs?.understat??null,
    oddsInputs:payload.modelInputs?.odds??null,
    archiveInputs:payload.modelInputs?.calibration??null,
    ruleConfiguration:payload.rules||null
  };
  const entries=await Promise.all(Object.entries(sections).map(async([name,value])=>[name,await sha256Hex(stableStringify(value),cryptoImpl)]));
  return canonicalise(Object.fromEntries(entries));
}
function recordHashMaterial(record){
  const copy = canonicalise(record);
  if(copy.identity){ delete copy.identity.contentHash; delete copy.identity.snapshotId; }
  return copy;
}
async function finaliseSnapshotRecord(payload,{captureStartedAt,captureCompletedAt,networkBefore,networkAfter}={},cryptoImpl=globalThis.crypto){
  assertEvidenceSafe(payload);
  const timing = assessDeadlineTiming({
    deadlineTime:payload.deadlineTime,
    captureStartedAt,
    captureCompletedAt,
    networkBefore,
    networkAfter,
    providers:payload.providers,
    complete:Boolean(payload.completeness?.complete)
  });
  const duplicateKey = [payload.season,`gw${payload.gameweek}`,payload.deadlineTime,payload.build?.sourceHash||'unknown',payload.versions?.model||MODEL_VERSION,payload.versions?.rules||RULES_VERSION].join('|');
  const sectionHashes=await computeSectionHashes(payload,cryptoImpl);
  const ruleHashes=canonicalise({configuration:sectionHashes.ruleConfiguration});
  const draft = canonicalise({...payload,timing,identity:{duplicateKey,sectionHashes,ruleHashes,contentHash:null,snapshotId:null}});
  const contentHash = await sha256Hex(stableStringify(recordHashMaterial(draft)),cryptoImpl);
  const snapshotId = `predeadline-gw${payload.gameweek}-${contentHash.slice(0,16)}`;
  const record = canonicalise({...draft,identity:{duplicateKey,sectionHashes,ruleHashes,contentHash,snapshotId}});
  assertEvidenceSafe(record);
  return deepFreeze(record);
}
function recordShapeError(record){
  const requiredTopLevel=['build','capture','completeness','deadlineTime','gameweek','identity','issues','managerRef','metricVersion','modelInputs','outputs','providers','quality','recordType','retries','rules','schemaVersion','season','segmentationVersion','timing','versions'];
  const keys=Object.keys(record||{}).sort();
  if(stableStringify(keys)!==stableStringify(requiredTopLevel.slice().sort())) return 'top_level_schema';
  if(!/^mgr-[0-9a-f]{32}$/.test(record.managerRef||'')) return 'manager_ref';
  if(!/^\d{4}-\d{2}$/.test(record.season||'')) return 'season';
  if(!Number.isInteger(record.gameweek)||record.gameweek<1||record.gameweek>38) return 'gameweek';
  if(!iso(record.deadlineTime)) return 'deadline';
  if(!record.build||typeof record.build!=='object'||!record.versions||typeof record.versions!=='object') return 'build_identity';
  if(!Array.isArray(record.providers)||!Array.isArray(record.retries)||!Array.isArray(record.issues)) return 'provider_schema';
  const providerError=providerTrustError(record.providers);
  if(providerError) return providerError;
  if(!record.modelInputs||typeof record.modelInputs!=='object'||!record.outputs||typeof record.outputs!=='object'||!Array.isArray(record.outputs.players)) return 'payload_schema';
  if(!record.completeness||typeof record.completeness.complete!=='boolean') return 'completeness_schema';
  if(!record.timing||!['network_attested','client_recorded','clock_conflict','late'].includes(record.timing.grade)||typeof record.timing.officialEligible!=='boolean'||!Array.isArray(record.timing.reasons)) return 'timing_schema';
  if(!record.identity||!/^predeadline-gw\d+-[0-9a-f]{16}$/.test(record.identity.snapshotId||'')||!/^[0-9a-f]{64}$/.test(record.identity.contentHash||'')) return 'identity_schema';
  if(!record.identity.sectionHashes||typeof record.identity.sectionHashes!=='object'||!record.identity.ruleHashes||typeof record.identity.ruleHashes!=='object') return 'identity_schema';
  return null;
}

async function validateSnapshotRecord(record,cryptoImpl=globalThis.crypto){
  try{
    if(!record || record.recordType!=='preDeadlineSnapshot') return {ok:false,reason:'record_type'};
    if(record.schemaVersion!==SNAPSHOT_SCHEMA_VERSION) return {ok:false,reason:'schema_version'};
    const shapeError=recordShapeError(record);
    if(shapeError) return {ok:false,reason:shapeError};
    assertEvidenceSafe(record);
    const sectionHashes=await computeSectionHashes(record,cryptoImpl);
    if(stableStringify(sectionHashes)!==stableStringify(record.identity.sectionHashes)) return {ok:false,reason:'section_hash'};
    if(record.identity.ruleHashes.configuration!==sectionHashes.ruleConfiguration) return {ok:false,reason:'rule_hash'};
    const expectedDuplicateKey=[record.season,`gw${record.gameweek}`,record.deadlineTime,record.build?.sourceHash||'unknown',record.versions?.model||MODEL_VERSION,record.versions?.rules||RULES_VERSION].join('|');
    if(record.identity.duplicateKey!==expectedDuplicateKey) return {ok:false,reason:'duplicate_key'};
    const expectedTiming=assessDeadlineTiming({
      deadlineTime:record.deadlineTime,
      captureStartedAt:Date.parse(record.timing.captureStartedAt),
      captureCompletedAt:Date.parse(record.timing.captureCompletedAt),
      networkBefore:record.timing.networkBefore,
      networkAfter:record.timing.networkAfter,
      providers:record.providers,
      complete:record.completeness.complete
    });
    if(stableStringify(expectedTiming)!==stableStringify(record.timing)) return {ok:false,reason:'timing_evidence'};
    const expected = await sha256Hex(stableStringify(recordHashMaterial(record)),cryptoImpl);
    if(expected!==record.identity?.contentHash) return {ok:false,reason:'content_hash'};
    if(record.identity?.snapshotId!==`predeadline-gw${record.gameweek}-${expected.slice(0,16)}`) return {ok:false,reason:'snapshot_id'};
    return {ok:true,record:deepFreeze(canonicalise(record))};
  }catch(error){ return {ok:false,reason:'invalid_record',message:error.message}; }
}
async function capturePreDeadlineSnapshot({managerRef,horizon,fetchFn=globalThis.fetch,locationHref=globalThis.location?.href,nowFn=Date.now,cryptoImpl=globalThis.crypto}={}){
  const captureStartedAt = nowFn();
  const networkBefore = await sampleNetworkClock({fetchFn,locationHref,nowFn});
  const payload = await collectPreDeadlinePayloadAsync({managerRef,horizon,startedAt:captureStartedAt});
  const networkAfter = await sampleNetworkClock({fetchFn,locationHref,nowFn});
  const captureCompletedAt = nowFn();
  return finaliseSnapshotRecord(payload,{captureStartedAt,captureCompletedAt,networkBefore,networkAfter},cryptoImpl);
}
function selectOfficialSnapshot(records,gameweek,deadlineTime=null){
  const gameweekRecords=(records||[]).filter(record=>Number(record?.gameweek)===Number(gameweek));
  if(!gameweekRecords.length) return null;
  const activeDeadline=deadlineTime
    ? new Date(deadlineTime).toISOString()
    : gameweekRecords.slice().sort((a,b)=>Date.parse(b.timing?.referenceCompletedAt||b.timing?.captureCompletedAt)-Date.parse(a.timing?.referenceCompletedAt||a.timing?.captureCompletedAt))[0]?.deadlineTime;
  return gameweekRecords
    .filter(record=>record?.deadlineTime===activeDeadline&&record?.timing?.officialEligible&&record?.completeness?.complete)
    .sort((a,b)=>Date.parse(b.timing.referenceCompletedAt)-Date.parse(a.timing.referenceCompletedAt)||String(a.identity.snapshotId).localeCompare(String(b.identity.snapshotId)))[0]||null;
}
function compactSnapshotMetadata(record,{origin='local_capture'}={}){
  const trustedLocal=origin==='local_capture';
  return canonicalise({
    snapshotId:record.identity.snapshotId,
    contentHash:record.identity.contentHash,
    gameweek:record.gameweek,
    season:record.season,
    deadlineTime:record.deadlineTime,
    capturedAt:record.timing.captureCompletedAt,
    timingGrade:record.timing.grade,
    origin,
    recordOfficialEligible:Boolean(record.timing.officialEligible),
    officialEligible:Boolean(trustedLocal&&record.timing.officialEligible),
    complete:Boolean(record.completeness.complete),
    buildCommit:record.build?.commit||'unversioned',
    modelVersion:record.versions?.model,
    rulesVersion:record.versions?.rules
  });
}
function boundedSnapshotIndex(existing,record,options={}){
  const metadata = compactSnapshotMetadata(record,options);
  const rows = [metadata,...(Array.isArray(existing)?existing:[]).filter(row=>row.snapshotId!==metadata.snapshotId)]
    .sort((a,b)=>Date.parse(b.capturedAt)-Date.parse(a.capturedAt)||a.snapshotId.localeCompare(b.snapshotId));
  return rows.slice(0,EVIDENCE_RULES.localIndexLimit);
}

export {
  SNAPSHOT_SCHEMA_VERSION,
  SNAPSHOT_METRIC_VERSION,
  SNAPSHOT_SEGMENTATION_VERSION,
  EVIDENCE_RULES,
  canonicalise,
  stableStringify,
  sha256Hex,
  deepFreeze,
  findForbiddenEvidence,
  assertEvidenceSafe,
  deadlineWindow,
  sampleNetworkClock,
  collectPreDeadlinePayload,
  collectPreDeadlinePayloadAsync,
  assessDeadlineTiming,
  computeSectionHashes,
  finaliseSnapshotRecord,
  recordShapeError,
  validateSnapshotRecord,
  capturePreDeadlineSnapshot,
  selectOfficialSnapshot,
  compactSnapshotMetadata,
  boundedSnapshotIndex
};
