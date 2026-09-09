import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ACTION_REGISTRY,AUTO_MERGE_ALLOWLIST} from '../workers/data-steward/action-registry.mjs';
import {classifyOperationalState,createIncident} from '../workers/data-steward/incident.mjs';
import {DISPATCH_REPOSITORY,DISPATCH_WORKFLOW_FILE} from '../workers/schedule-dispatcher/dispatch-contract.mjs';
import {OPPORTUNITY_COLLECT_JOB_NAME,OPPORTUNITY_GUARD_REPOSITORY}
  from '../workers/data-platform/scheduled/opportunity-guard.mjs';
import {DATA_S2_SOURCE_REVISION_ID} from '../workers/data-platform/official-fpl-canonical.mjs';
import {PRODUCTION_D1_ID} from '../workers/data-platform/production-collection.mjs';
import {createObservation,isProvingObservation,observationEvidenceRow,OBSERVATION_SCHEMA_VERSION,
  OBSERVATION_SOURCES,OBSERVATION_STATES,validNormalizedState} from '../workers/data-steward/sentinels/observation-contract.mjs';
import {EVALUATION_AWAITING_LATER_OPPORTUNITY,EVALUATION_DUE,EVALUATION_NOT_DUE,
  EVALUATION_TOLERANCE_MS,EXPECTED_COLLECT_JOB,EXPECTED_CRON_EXPRESSIONS,EXPECTED_DISPATCHER_WORKER,
  EXPECTED_GATE_JOB,EXPECTED_GUARD_STEP,EXPECTED_REPOSITORY,EXPECTED_WORKFLOW_B_FILE,
  EXPECTED_WORKFLOW_C_FILE,MAX_EVIDENCE_AGE_MS,WORKFLOW_B_COLLECT_TIMEOUT_MINUTES,
  WORKFLOW_B_GATE_TIMEOUT_MINUTES,WORKFLOW_B_MAX_EXECUTION_MS,evaluationDeadline,evaluationPhase,
  opportunityInstants,utcDayWindow} from '../workers/data-steward/sentinels/production-chain-contract.mjs';
import {GITHUB_GUARD_LOG_MAX_BYTES,GUARD_RESULT_AMBIGUOUS,GUARD_RESULT_AVAILABLE,
  GUARD_RESULT_CONSUMED,GUARD_RESULT_INVALID,RUN_COLLECTED,RUN_COLLECT_FAILED,RUN_GATE_REFUSED_OTHER,RUN_IN_FLIGHT,
  RUN_GUARD_AMBIGUOUS,RUN_GUARD_CONTRADICTORY,RUN_REFUSED_OPPORTUNITY_CONSUMED,RUN_UNCLASSIFIED,
  classifyGovernedRun,decodeJobs,decodeMainRef,
  decodeRunsPage,interpretGithubDay,mainRefRequest,parseGuardSemanticOutcome,readGithubChain,
  repositoryGateLogRequest,runJobsRequest,
  verifyCheckRunsRequest,workflowRunsRequest} from '../workers/data-steward/sentinels/github-sentinel.mjs';
import {CLOUDFLARE_CRON_MISMATCH,CLOUDFLARE_DEPLOYMENTS_READ_FAILED,CLOUDFLARE_IDENTITY_MISMATCH,
  CLOUDFLARE_INVOCATION_UNOBSERVABLE,CLOUDFLARE_READS,CLOUDFLARE_SCHEDULES_ARRAY_INVALID,
  CLOUDFLARE_SCHEDULES_AUTH_REFUSED,CLOUDFLARE_SCHEDULES_COUNT_EXCEEDED,
  CLOUDFLARE_SCHEDULES_CRON_NOT_STRING,CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED,
  CLOUDFLARE_SCHEDULES_ENVELOPE_INVALID,CLOUDFLARE_SCHEDULES_HTTP_FAILED,
  CLOUDFLARE_SCHEDULES_JSON_INVALID,CLOUDFLARE_SCHEDULES_NOT_FOUND,
  CLOUDFLARE_SCHEDULES_RESULT_INVALID,CLOUDFLARE_SCHEDULES_TRANSPORT_FAILED,
  CLOUDFLARE_SENTINEL_MAX_READS,CLOUDFLARE_SETTINGS_READ_FAILED,assertProductionAccount,
  classifySchedulesPayload,cloudflareReadRequest,cronSetMatches,decodeDeployments,decodeEnvelope,
  decodeSchedules,decodeSettings,readCloudflareConfiguration} from '../workers/data-steward/sentinels/cloudflare-sentinel.mjs';
import {D1_OBSERVATION_QUERIES,D1_OBSERVATION_QUERY_IDS,D1_SENTINEL_MAX_ROWS_READ,
  D1_SENTINEL_RECENT_RUN_LIMIT,assertReadOnlySql,buildDailyObservationBatch,buildObservationPlan,
  d1QueryUrl,inspectObservationPlan,interpretIntegrity,interpretRuns,readD1State,
  runObservationBatch} from '../workers/data-steward/sentinels/d1-sentinel.mjs';
import {FORBIDDEN_PERMISSIONS,STEWARD_ENVIRONMENT,STEWARD_ENVIRONMENT_NAMES,
  resolveStewardEnvironment} from '../workers/data-steward/sentinels/environment-contract.mjs';
import {REQUIRED_SENTINELS,VERDICT_HEALTHY,VERDICT_NOT_EVALUATED,VERDICT_UNHEALTHY,VERDICT_REASONS,
  closeObservationRun,evaluateProductionChain,incidentInputFor,openObservationRun}
  from '../workers/data-steward/sentinels/observation-run.mjs';
import {observeProductionChain} from '../workers/data-steward/sentinels/observe-production-chain.mjs';

const A12_FILES=['observation-contract.mjs','production-chain-contract.mjs','github-sentinel.mjs',
  'cloudflare-sentinel.mjs','d1-sentinel.mjs','environment-contract.mjs','observation-run.mjs',
  'observe-production-chain.mjs'];
const source=file=>fs.readFileSync(`workers/data-steward/sentinels/${file}`,'utf8');
const workflowB=fs.readFileSync('.github/workflows/data-s2-production-external.yml','utf8');
const STEWARD_PLATFORM_IMPORT=/\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)['"]([^'"]*data-platform\/[^'"]+)['"]/g;
const stewardPlatformEdges=(file,text)=>[...text.matchAll(STEWARD_PLATFORM_IMPORT)].map(([,specifier])=>
  `${path.normalize(file)} -> ${path.normalize(path.join(path.dirname(file),specifier))}`);

const DAY='2026-09-08';
const t=iso=>Date.parse(iso);
const AFTER_DEADLINE=t(`${DAY}T09:30:00.000Z`);
const SHA='c6708e4940c81b34b96adb53e624e98453ac2800';
const ACCOUNT='abcdef0123456789abcdef0123456789';
const FINGERPRINT=(await import('node:crypto')).createHash('sha256').update(ACCOUNT).digest('hex');
const ENV={DATA_STEWARD_GITHUB_TOKEN:'gh-token',DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID:ACCOUNT,
  DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,DATA_STEWARD_CLOUDFLARE_READ_TOKEN:'cf-token'};

// ---------------------------------------------------------------- fixtures

const step=(name,conclusion='success')=>({name,status:'completed',conclusion});
const gateSteps=guardConclusion=>[step('Validate external dispatch event before checkout'),
  step('Check out exact dispatched revision'),step('Gate exact current main and clean tree'),
  step('Set up exact Node'),step('Require exact-head Verify Teamsheet success within a bounded wait'),
  step(EXPECTED_GUARD_STEP,guardConclusion)];

const job=(name,{id=name===EXPECTED_GATE_JOB?501:502,conclusion='success',status='completed',startedAt=null,runAttempt=1,steps=null}={})=>
  ({id,name,status,conclusion,started_at:startedAt,run_attempt:runAttempt,
    ...(steps===null?{}:{steps})});

const collectedJobs=startedAt=>[job(EXPECTED_GATE_JOB,{steps:gateSteps('success')}),
  job(EXPECTED_COLLECT_JOB,{startedAt})];
const refusedJobs=()=>[job(EXPECTED_GATE_JOB,{conclusion:'failure',steps:gateSteps('failure')}),
  job(EXPECTED_COLLECT_JOB,{conclusion:'skipped'})];
const otherGateFailureJobs=()=>[
  job(EXPECTED_GATE_JOB,{conclusion:'failure',steps:[step('Validate external dispatch event before checkout'),
    step('Check out exact dispatched revision'),step('Gate exact current main and clean tree','failure'),
    step('Set up exact Node','skipped'),
    step('Require exact-head Verify Teamsheet success within a bounded wait','skipped'),
    step(EXPECTED_GUARD_STEP,'skipped')]}),
  job(EXPECTED_COLLECT_JOB,{conclusion:'skipped'})];

const runRow=(id,createdAt,conclusion='success')=>({id,created_at:createdAt,head_branch:'main',
  head_sha:SHA,event:'workflow_dispatch',status:'completed',conclusion});

const jobsBody=jobs=>({total_count:jobs.length,jobs});
const runsBody=runs=>({total_count:runs.length,workflow_runs:runs});

const checkRunsBody=(sha=SHA,conclusion='success')=>({check_runs:[{name:'Tests and deterministic build',
  head_sha:sha,app:{slug:'github-actions'},details_url:`https://github.com/${EXPECTED_REPOSITORY}/actions/runs/1`,
  status:'completed',conclusion}]});

const d1Row=(results,rowsRead=100)=>({success:true,meta:{rows_read:rowsRead,rows_written:0},results});
const governanceRow=(overrides={})=>({migration_version:3,migration_name:'production_query_plan_indexes',
  source_revision_id:DATA_S2_SOURCE_REVISION_ID,schema_version:'data-s2a-v1',
  rights_classification:'durable_allowed',retention_allowed:1,redistribution_allowed:0,
  shadow_ingest_allowed:1,source_key:'official-fpl',source_kind:'official_fpl',...overrides});
const ingestionRow=(overrides={})=>({run_id:`gha-${'a'.repeat(40)}`,started_at:`${DAY}T01:17:00.000Z`,
  completed_at:`${DAY}T01:17:43.000Z`,status:'completed',records_seen:10157,records_accepted:70,
  records_quarantined:0,records_rejected:0,error_class:null,...overrides});
const integrityRow=(overrides={})=>({observations:11348,logical_keys:10157,heads:10157,orphan_heads:0,
  non_accepted:0,non_shadow:0,rejections:0,latest_observation_at:`${DAY}T01:17:43.000Z`,...overrides});

const d1Body=({governance=[governanceRow()],runs=[ingestionRow()],integrity=[integrityRow()]}={})=>
  ({success:true,result:[d1Row(governance),d1Row(runs),d1Row(integrity)]});

const cfEnvelope=result=>({success:true,result});
const schedulesBody=(crons=EXPECTED_CRON_EXPRESSIONS)=>cfEnvelope({schedules:crons.map(cron=>({cron}))});
const deploymentsBody=()=>cfEnvelope({deployments:[{id:'7c3c8be5-0000-4000-8000-000000000000',
  created_on:'2026-09-08T08:00:00.000Z'}]});
const settingsBody=()=>cfEnvelope({observability:{enabled:true}});

// A deterministic fake transport. It routes on the URL alone, records every request it saw, and
// never reaches a network.
function fakeFetch(routes){
  const seen=[];
  const impl=async(url,init)=>{
    seen.push({url,method:init?.method??'GET'});
    for(const [match,body] of routes){
      if(!url.includes(match))continue;
      if(body==='ERROR')throw new Error('transport');
      if(typeof body==='number')return {status:body,json:async()=>({})};
      return {status:200,json:async()=>(typeof body==='function'?body():body)};
    }
    return {status:404,json:async()=>({})};
  };
  impl.seen=seen;
  return impl;
}

const healthyRoutes=({bRuns,bJobs,cRuns=runsBody([]),cJobs={},d1=d1Body(),schedules=schedulesBody()}={})=>[
  ['/git/ref/heads/main',{ref:'refs/heads/main',object:{sha:SHA}}],
  ['/check-runs',checkRunsBody()],
  [`/workflows/${EXPECTED_WORKFLOW_B_FILE}/runs`,bRuns],
  [`/workflows/${EXPECTED_WORKFLOW_C_FILE}/runs`,cRuns],
  ['/actions/runs/',()=>null],
  ['/schedules',schedules],
  ['/deployments',deploymentsBody()],
  ['/settings',settingsBody()],
  ['/d1/database/',d1]
];

// The jobs endpoint has to answer per run id, so it is routed separately.
function chainFetch({bRuns,jobsById,cRuns=runsBody([]),d1=d1Body(),schedules=schedulesBody(),
  githubStatus=null,guardLogs={501:'DATA-S2 daily collection opportunity: OPPORTUNITY_CONSUMED (automatic_collection_consumed)\n'}}={}){
  return async(url,init)=>{
    if(githubStatus&&url.includes('api.github.com'))return {status:githubStatus,json:async()=>({})};
    if(url.includes('/git/ref/heads/main'))return {status:200,json:async()=>({ref:'refs/heads/main',object:{sha:SHA}})};
    if(url.includes('/check-runs'))return {status:200,json:async()=>checkRunsBody()};
    if(url.includes(`/workflows/${EXPECTED_WORKFLOW_B_FILE}/runs`))return {status:200,json:async()=>bRuns};
    if(url.includes(`/workflows/${EXPECTED_WORKFLOW_C_FILE}/runs`))return {status:200,json:async()=>cRuns};
    const jobsMatch=/\/actions\/runs\/(\d+)\/jobs/.exec(url);
    if(jobsMatch)return {status:200,json:async()=>jobsBody(jobsById[jobsMatch[1]]??[])};
    const logMatch=/\/actions\/jobs\/(\d+)\/logs/.exec(url);
    if(logMatch){
      const body=guardLogs[logMatch[1]];
      if(body==='ERROR')throw new Error('transport');
      if(body===undefined)return {status:404,arrayBuffer:async()=>new ArrayBuffer(0)};
      const bytes=new TextEncoder().encode(body);
      return {status:200,headers:{get:name=>name==='content-length'?String(bytes.byteLength):null},
        body:new ReadableStream({start(controller){controller.enqueue(bytes);controller.close();}})};
    }
    if(url.includes('/schedules'))return {status:200,json:async()=>schedules};
    if(url.includes('/deployments'))return {status:200,json:async()=>deploymentsBody()};
    if(url.includes('/settings'))return {status:200,json:async()=>settingsBody()};
    if(url.includes('/d1/database/')){
      assert.equal(init.method,'POST');
      return {status:200,json:async()=>d1};
    }
    return {status:404,json:async()=>({})};
  };
}

const HEALTHY_DAY={
  bRuns:runsBody([runRow(101,`${DAY}T01:17:05.000Z`),runRow(102,`${DAY}T02:17:04.000Z`,'failure')]),
  jobsById:{101:collectedJobs(`${DAY}T01:17:30.000Z`),102:refusedJobs()}
};

const observe=(overrides={},now=AFTER_DEADLINE,env=ENV)=>
  observeProductionChain({env,fetchImpl:chainFetch({...HEALTHY_DAY,...overrides}),now});

// ================================================================ contract pinning

test('A1.2 pins the real DATA-S2C chain rather than a remembered one',()=>{
  assert.equal(EXPECTED_REPOSITORY,DISPATCH_REPOSITORY);
  assert.equal(EXPECTED_REPOSITORY,OPPORTUNITY_GUARD_REPOSITORY);
  assert.equal(EXPECTED_WORKFLOW_B_FILE,DISPATCH_WORKFLOW_FILE);
  assert.equal(EXPECTED_COLLECT_JOB,OPPORTUNITY_COLLECT_JOB_NAME);
  assert.equal(EXPECTED_DISPATCHER_WORKER,'teamsheet-data-s2-dispatcher');
  // The chain is Cloudflare Cron plus a dispatcher Worker. It is not a Cloudflare Workflow, and
  // no A1.2 module may speak of one.
  for(const file of A12_FILES)
    assert.doesNotMatch(source(file),/\/workflows\/instances|cloudflare[^\n]*workflows\b/i,file);
});

test('the observed cron set is exactly the dispatcher configuration the repository declares',()=>{
  const declared=JSON.parse(fs.readFileSync('workers/schedule-dispatcher/wrangler.jsonc','utf8')
    .split('\n').filter(line=>!line.trim().startsWith('//')).join('\n'));
  assert.deepEqual([...EXPECTED_CRON_EXPRESSIONS],declared.triggers.crons);
  assert.deepEqual([...EXPECTED_CRON_EXPRESSIONS],['17 1 * * *','17 2 * * *','17 3 * * *']);
  assert.equal(declared.name,EXPECTED_DISPATCHER_WORKER);
});

test('the evaluation tolerance is derived from workflow B and Cloudflare, not chosen',()=>{
  const gate=/repository-gate:[\s\S]*?timeout-minutes:\s*(\d+)/.exec(workflowB);
  const collect=/\n  collect:[\s\S]*?timeout-minutes:\s*(\d+)/.exec(workflowB);
  assert.equal(Number(gate[1]),WORKFLOW_B_GATE_TIMEOUT_MINUTES);
  assert.equal(Number(collect[1]),WORKFLOW_B_COLLECT_TIMEOUT_MINUTES);
  assert.equal(WORKFLOW_B_MAX_EXECUTION_MS,30*60*1000);
  // 30 minutes of permitted execution plus Cloudflare's published 15-minute propagation figure.
  assert.equal(EVALUATION_TOLERANCE_MS,45*60*1000);
  // One whole opportunity interval, taken from the declared schedule rather than picked.
  assert.equal(MAX_EVIDENCE_AGE_MS,60*60*1000);
});

test('the governed job and step names exist verbatim in workflow B',()=>{
  assert.ok(workflowB.includes(`  ${EXPECTED_GATE_JOB}:`));
  assert.ok(workflowB.includes(`  ${EXPECTED_COLLECT_JOB}:`));
  assert.ok(workflowB.includes(EXPECTED_GUARD_STEP));
});

test('opportunity instants, deadline and evaluation phases follow the real schedule',()=>{
  const day=utcDayWindow(AFTER_DEADLINE);
  assert.equal(day.date,DAY);
  assert.deepEqual([...opportunityInstants(AFTER_DEADLINE)],
    [t(`${DAY}T01:17:00.000Z`),t(`${DAY}T02:17:00.000Z`),t(`${DAY}T03:17:00.000Z`)]);
  assert.equal(evaluationDeadline(AFTER_DEADLINE),t(`${DAY}T04:02:00.000Z`));
  assert.equal(evaluationPhase(t(`${DAY}T00:30:00.000Z`)).phase,EVALUATION_NOT_DUE);
  assert.equal(evaluationPhase(t(`${DAY}T01:40:00.000Z`)).phase,EVALUATION_NOT_DUE);
  assert.equal(evaluationPhase(t(`${DAY}T01:55:00.000Z`)).phase,EVALUATION_AWAITING_LATER_OPPORTUNITY);
  assert.equal(evaluationPhase(t(`${DAY}T01:55:00.000Z`)).remainingOpportunities,2);
  assert.equal(evaluationPhase(t(`${DAY}T04:01:00.000Z`)).phase,EVALUATION_AWAITING_LATER_OPPORTUNITY);
  assert.equal(evaluationPhase(t(`${DAY}T04:02:00.000Z`)).phase,EVALUATION_DUE);
  assert.equal(evaluationPhase(AFTER_DEADLINE).phase,EVALUATION_DUE);
});

// ================================================================ evidence envelope

const envelope=(overrides={})=>({sourceType:'github',sourceIdentity:'sentinel.github',
  subjectIdentity:`github-chain/${DAY}`,observedAt:`${DAY}T09:30:00.000Z`,subjectTime:null,
  observationState:'OBSERVED',reasonCode:'GITHUB_CHAIN_OBSERVED',normalizedState:{collected:1},
  provenance:[`github:workflow-b/${DAY}`],freshnessAgeMs:0,...overrides});

test('an observation envelope is canonical, versioned, hash-identified and deterministic',async()=>{
  const a=await createObservation(envelope()),b=await createObservation(envelope());
  assert.deepEqual(a,b);
  assert.equal(a.schemaVersion,OBSERVATION_SCHEMA_VERSION);
  assert.match(a.evidenceHash,/^[0-9a-f]{64}$/);
  assert.deepEqual(observationEvidenceRow(a),{reference:`github:github-chain/${DAY}`,hash:a.evidenceHash});
  assert.deepEqual([...OBSERVATION_SOURCES],['github','cloudflare','d1','steward']);
  assert.ok(OBSERVATION_STATES.includes('OBSERVATION_UNAVAILABLE'));
});

test('a raw provider object cannot travel into classification through an envelope',async()=>{
  // Unknown fields, nested payloads, unbounded text and non-closed sources all fail closed.
  await assert.rejects(createObservation({...envelope(),rawBody:{}}),/observation_schema_invalid/);
  await assert.rejects(createObservation({...envelope(),sourceType:'anthropic'}),/observation_source_invalid/);
  await assert.rejects(createObservation({...envelope(),observationState:'AMBER'}),/observation_state_invalid/);
  await assert.rejects(createObservation({...envelope(),normalizedState:{run:{id:1}}}),/observation_normalized_state_invalid/);
  await assert.rejects(createObservation({...envelope(),normalizedState:{log:'x'.repeat(257)}}),/observation_normalized_state_invalid/);
  await assert.rejects(createObservation({...envelope(),normalizedState:{bad_key:1}}),/observation_normalized_state_invalid/);
  await assert.rejects(createObservation({...envelope(),provenance:['https://api.github.com/x']}),/observation_provenance_invalid/);
  await assert.rejects(createObservation({...envelope(),observedAt:'2026-09-08'}),/observation_time_invalid/);
  await assert.rejects(createObservation({...envelope(),reasonCode:'lowercase'}),/observation_reason_invalid/);
  assert.equal(validNormalizedState({ok:true,list:['a','b']}),true);
  assert.equal(validNormalizedState({ok:[{a:1}]}),false);
});

test('no credential can ever be hashed into or carried by an envelope',async()=>{
  await assert.rejects(createObservation({...envelope(),normalizedState:{token:'ghp_abc'}}),/observation_secret_forbidden/);
  await assert.rejects(createObservation({...envelope(),normalizedState:{note:'Bearer sk-live-123456'}}),/observation_secret_forbidden/);
});

test('only a fresh, actually observed envelope can ever prove anything',async()=>{
  const observed=await createObservation(envelope());
  assert.equal(isProvingObservation(observed,MAX_EVIDENCE_AGE_MS),true);
  assert.equal(isProvingObservation(await createObservation({...envelope(),freshnessAgeMs:MAX_EVIDENCE_AGE_MS+1}),MAX_EVIDENCE_AGE_MS),false);
  assert.equal(isProvingObservation(await createObservation({...envelope(),observationState:'OBSERVATION_UNAVAILABLE',freshnessAgeMs:null}),MAX_EVIDENCE_AGE_MS),false);
  for(const state of ['NOT_DUE','AWAITING_LATER_OPPORTUNITY','NOT_EVALUATED','OBSERVATION_FAILED','OBSERVATION_STALE'])
    assert.equal(isProvingObservation(await createObservation({...envelope(),observationState:state}),MAX_EVIDENCE_AGE_MS),false);
});

// ================================================================ GitHub sentinel

test('every GitHub request this sentinel can build is a GET against a fixed read path',()=>{
  const requests=[mainRefRequest('t'),verifyCheckRunsRequest(SHA,'t'),
    workflowRunsRequest(EXPECTED_WORKFLOW_B_FILE,'t',AFTER_DEADLINE,1),
    workflowRunsRequest(EXPECTED_WORKFLOW_C_FILE,'t',AFTER_DEADLINE,1),runJobsRequest(101,'t'),
    repositoryGateLogRequest(501,'t')];
  for(const request of requests){
    assert.equal(request.init.method,'GET');
    assert.ok(request.url.startsWith(`https://api.github.com/repos/${EXPECTED_REPOSITORY}/`));
    assert.doesNotMatch(request.url,/dispatch|rerun|re-run|cancel|enable|disable|secret|merge|pulls|issues/i);
  }
  // Discovery reaches back one extra UTC day so a run created before midnight that collected after
  // it is still found.
  assert.ok(workflowRunsRequest(EXPECTED_WORKFLOW_B_FILE,'t',AFTER_DEADLINE,1).url.includes('2026-09-07'));
  assert.throws(()=>workflowRunsRequest('verify.yml','t',AFTER_DEADLINE,1),/github_workflow_unknown/);
  assert.throws(()=>workflowRunsRequest(EXPECTED_WORKFLOW_B_FILE,'t',AFTER_DEADLINE,3),/github_page_invalid/);
  assert.throws(()=>mainRefRequest(''),/github_token_missing/);
  assert.throws(()=>verifyCheckRunsRequest('not-a-sha','t'),/github_sha_invalid/);
  assert.throws(()=>runJobsRequest(0,'t'),/github_run_id_invalid/);
  assert.throws(()=>repositoryGateLogRequest(0,'t'),/github_job_id_invalid/);
});

test('malformed, truncated and over-full GitHub responses fail closed',()=>{
  assert.equal(decodeMainRef({ref:'refs/heads/other',object:{sha:SHA}}),null);
  assert.equal(decodeMainRef({ref:'refs/heads/main',object:{sha:'short'}}),null);
  assert.equal(decodeMainRef(null),null);
  assert.equal(decodeRunsPage({total_count:2,workflow_runs:[runRow(1,`${DAY}T01:00:00Z`)]},1),null);
  assert.equal(decodeRunsPage({total_count:1,workflow_runs:[{...runRow(1,`${DAY}T01:00:00Z`),created_at:'nope'}]},1),null);
  assert.equal(decodeRunsPage('nope',1),null);
  assert.equal(decodeJobs({total_count:2,jobs:[job('collect')]}),null);
  assert.equal(decodeJobs({total_count:1,jobs:[{...job('collect'),id:0}]}),null);
  assert.equal(decodeJobs({total_count:1,jobs:[{...job('collect'),run_attempt:0}]}),null);
  assert.equal(decodeJobs({total_count:1,jobs:[{...job('collect'),steps:[{name:1}]}]}),null);
  assert.deepEqual(decodeJobs(jobsBody([job('collect',{startedAt:`${DAY}T01:17:30.000Z`})]))[0].steps,null);
});

test('a run is classified from its governed jobs and steps, never from its run conclusion',()=>{
  assert.equal(classifyGovernedRun(decodeJobs(jobsBody(collectedJobs(`${DAY}T01:17:30.000Z`)))).outcome,RUN_COLLECTED);
  // The T2 acceptance shape: overall failure, guard step failed, collect correctly skipped.
  assert.equal(classifyGovernedRun(decodeJobs(jobsBody(refusedJobs())),GUARD_RESULT_CONSUMED).outcome,
    RUN_REFUSED_OPPORTUNITY_CONSUMED);
  assert.equal(classifyGovernedRun(decodeJobs(jobsBody(refusedJobs())),GUARD_RESULT_AMBIGUOUS).outcome,
    RUN_GUARD_AMBIGUOUS);
  assert.equal(classifyGovernedRun(decodeJobs(jobsBody(refusedJobs())),GUARD_RESULT_AVAILABLE).outcome,
    RUN_GUARD_CONTRADICTORY);
  // A gate that failed somewhere else is a different event and never wears the healthy label.
  assert.equal(classifyGovernedRun(decodeJobs(jobsBody(otherGateFailureJobs()))).outcome,RUN_GATE_REFUSED_OTHER);
  assert.equal(classifyGovernedRun(decodeJobs(jobsBody([job(EXPECTED_GATE_JOB,{steps:gateSteps('success')}),
    job(EXPECTED_COLLECT_JOB,{conclusion:'failure',startedAt:`${DAY}T01:17:30.000Z`})]))).outcome,RUN_COLLECT_FAILED);
  assert.equal(classifyGovernedRun(decodeJobs(jobsBody([job(EXPECTED_GATE_JOB,{steps:gateSteps('success')}),
    job(EXPECTED_COLLECT_JOB,{status:'in_progress',conclusion:null})]))).outcome,RUN_IN_FLIGHT);
});

test('guard log evidence reduces exact allowlisted syntax and rejects every ambiguous shape',()=>{
  const prefix='2026-09-08T02:18:01.1234567Z ';
  const consumed='DATA-S2 daily collection opportunity: OPPORTUNITY_CONSUMED (automatic_collection_consumed)';
  assert.equal(parseGuardSemanticOutcome(`${prefix}${consumed}\n`),GUARD_RESULT_CONSUMED);
  assert.equal(parseGuardSemanticOutcome('DATA-S2 daily collection opportunity: OPPORTUNITY_CONSUMED (owner_collection_today)'),GUARD_RESULT_CONSUMED);
  assert.equal(parseGuardSemanticOutcome('DATA-S2 daily collection opportunity: AMBIGUOUS_REQUIRES_OWNER_ATTENTION (guard_read_failed)'),GUARD_RESULT_AMBIGUOUS);
  assert.equal(parseGuardSemanticOutcome('DATA-S2 daily collection opportunity: OPPORTUNITY_AVAILABLE (opportunity_available)'),GUARD_RESULT_AVAILABLE);
  for(const malformed of ['',`prefix ${consumed}`,`${consumed} suffix`,
    'DATA-S2 daily collection opportunity: OPPORTUNITY_CONSUMED (future_reason)',
    'DATA-S2 daily collection opportunity: FUTURE_RESULT (automatic_collection_consumed)',
    `${consumed}\n${consumed}`,
    `${consumed}\nDATA-S2 daily collection opportunity: AMBIGUOUS_REQUIRES_OWNER_ATTENTION (guard_read_failed)`])
    assert.equal(parseGuardSemanticOutcome(malformed),GUARD_RESULT_INVALID,malformed);
});

test('unprovable, contradictory and unknown run shapes are UNCLASSIFIED rather than assumed benign',()=>{
  // Step evidence absent: the healthy refusal cannot be proven, so it is not claimed.
  assert.equal(classifyGovernedRun(decodeJobs(jobsBody([job(EXPECTED_GATE_JOB,{conclusion:'failure'}),
    job(EXPECTED_COLLECT_JOB,{conclusion:'skipped'})]))).outcome,RUN_GATE_REFUSED_OTHER);
  // A collect that ran without a usable start instant cannot be dated, so it cannot be counted.
  assert.equal(classifyGovernedRun(decodeJobs(jobsBody([job(EXPECTED_GATE_JOB,{steps:gateSteps('success')}),
    job(EXPECTED_COLLECT_JOB,{startedAt:null})]))).outcome,RUN_UNCLASSIFIED);
  // A successful collect on a later attempt contradicts `workflow_retry_forbidden` outright.
  assert.equal(classifyGovernedRun(decodeJobs(jobsBody([...collectedJobs(`${DAY}T01:17:30.000Z`),
    job(EXPECTED_COLLECT_JOB,{runAttempt:2,startedAt:`${DAY}T02:00:00.000Z`})]))).outcome,RUN_UNCLASSIFIED);
  // A gate that succeeded while collect skipped is a shape this repository does not produce.
  assert.equal(classifyGovernedRun(decodeJobs(jobsBody([job(EXPECTED_GATE_JOB,{steps:gateSteps('success')}),
    job(EXPECTED_COLLECT_JOB,{conclusion:'skipped'})]))).outcome,RUN_UNCLASSIFIED);
  // A run missing one of its two governed jobs entirely is not interpreted at all.
  assert.equal(classifyGovernedRun(decodeJobs(jobsBody([job(EXPECTED_GATE_JOB,{steps:gateSteps('success')})]))).outcome,RUN_UNCLASSIFIED);
  assert.equal(classifyGovernedRun(null).outcome,RUN_UNCLASSIFIED);
});

test('the GitHub day view dates a collection by when it collected and counts executions, not successes',()=>{
  const runs=[
    {createdAt:`${DAY}T01:17:05.000Z`,kind:'automatic',classification:classifyGovernedRun(decodeJobs(jobsBody(collectedJobs(`${DAY}T01:17:30.000Z`))))},
    {createdAt:`${DAY}T02:17:04.000Z`,kind:'automatic',classification:classifyGovernedRun(
      decodeJobs(jobsBody(refusedJobs())),GUARD_RESULT_CONSUMED)}
  ];
  const day=interpretGithubDay({runs,now:AFTER_DEADLINE});
  assert.equal(day.collected,1);
  assert.equal(day.refusedOpportunityConsumed,1);
  assert.equal(day.collectExecutions,1);
  assert.equal(day.duplicateCollection,false);
  assert.equal(day.firstCollectionAt,t(`${DAY}T01:17:30.000Z`));
  // A run created before midnight whose collect began after it belongs to the later day.
  const late=interpretGithubDay({runs:[{createdAt:'2026-09-07T23:58:00.000Z',kind:'automatic',
    classification:classifyGovernedRun(decodeJobs(jobsBody(collectedJobs(`${DAY}T00:03:00.000Z`))))}],
    now:AFTER_DEADLINE});
  assert.equal(late.collected,1);
  // A failed collect still executed, so it still consumed the day and still counts as a duplicate.
  const twice=interpretGithubDay({runs:[runs[0],{createdAt:`${DAY}T02:17:04.000Z`,kind:'automatic',
    classification:classifyGovernedRun(decodeJobs(jobsBody([job(EXPECTED_GATE_JOB,{steps:gateSteps('success')}),
      job(EXPECTED_COLLECT_JOB,{conclusion:'failure',startedAt:`${DAY}T02:17:30.000Z`})])))}],
    now:AFTER_DEADLINE});
  assert.equal(twice.collectExecutions,2);
  assert.equal(twice.duplicateCollection,true);
});

test('a GitHub read that cannot complete is a failed observation, never an empty healthy one',async()=>{
  const failing=async()=>{throw new Error('down');};
  assert.equal((await readGithubChain({token:'t',fetchImpl:failing,now:AFTER_DEADLINE})).ok,false);
  const notFound=async()=>({status:404,json:async()=>({})});
  assert.equal((await readGithubChain({token:'t',fetchImpl:notFound,now:AFTER_DEADLINE})).reasonCode,'GITHUB_READ_FAILED');
  const impl=fakeFetch(healthyRoutes({bRuns:runsBody([])}));
  assert.equal((await readGithubChain({token:'t',fetchImpl:impl,now:AFTER_DEADLINE})).ok,true);
  assert.ok(impl.seen.every(entry=>entry.method==='GET'));
  await assert.rejects(readGithubChain({token:'t',fetchImpl:impl,now:AFTER_DEADLINE,maxReads:1}),
    /github_read_bound_exhausted/);
});

test('guard refusal is healthy only with independently proven consumed semantics',async()=>{
  const read=guardLogs=>readGithubChain({token:'t',now:AFTER_DEADLINE,
    fetchImpl:chainFetch({...HEALTHY_DAY,guardLogs})});
  const line=value=>`DATA-S2 daily collection opportunity: ${value}\n`;
  assert.equal((await read({501:line('OPPORTUNITY_CONSUMED (automatic_collection_consumed)')}))
    .day.refusedOpportunityConsumed,1);
  for(const evidence of [
    line('AMBIGUOUS_REQUIRES_OWNER_ATTENTION (guard_read_failed)'),
    line('AMBIGUOUS_REQUIRES_OWNER_ATTENTION (guard_collect_timing_unusable)'),
    line('OPPORTUNITY_AVAILABLE (opportunity_available)')]){
    const result=await read({501:evidence});
    assert.equal(result.ok,true);
    assert.equal(result.day.refusedOpportunityConsumed,0);
    assert.equal(evidence.includes('AMBIGUOUS')?result.day.guardAmbiguous:result.day.guardContradictory,1);
  }
  for(const evidence of [undefined,'ERROR','',
    line('OPPORTUNITY_CONSUMED (future_reason)'),
    line('FUTURE_RESULT (automatic_collection_consumed)'),
    line('OPPORTUNITY_CONSUMED (automatic_collection_consumed)').repeat(2),
    line('OPPORTUNITY_CONSUMED (automatic_collection_consumed)')
      +line('AMBIGUOUS_REQUIRES_OWNER_ATTENTION (guard_read_failed)'),
    'x'.repeat(GITHUB_GUARD_LOG_MAX_BYTES+1)])
    assert.deepEqual(await read(evidence===undefined?{}:{501:evidence}),
      {ok:false,reasonCode:'GITHUB_READ_FAILED'});
});

// ================================================================ Cloudflare sentinel

test('the Cloudflare sentinel can only ever GET three fixed paths under the dispatcher',()=>{
  assert.deepEqual([...CLOUDFLARE_READS],['schedules','deployments','settings']);
  for(const read of CLOUDFLARE_READS){
    const request=cloudflareReadRequest(read,{accountId:ACCOUNT,token:'t'});
    assert.equal(request.init.method,'GET');
    assert.equal(request.url,
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/${EXPECTED_DISPATCHER_WORKER}/${read}`);
    assert.ok(!('body' in request.init));
  }
  assert.equal(CLOUDFLARE_SENTINEL_MAX_READS,3);
  assert.throws(()=>cloudflareReadRequest('versions',{accountId:ACCOUNT,token:'t'}),/cloudflare_read_forbidden/);
  assert.throws(()=>cloudflareReadRequest('schedules',{accountId:'bad account',token:'t'}),/cloudflare_account_invalid/);
  assert.throws(()=>cloudflareReadRequest('schedules',{accountId:ACCOUNT,token:''}),/cloudflare_token_missing/);
});

test('the production account must be proved, never derived from the credential it validates',()=>{
  assert.equal(assertProductionAccount({accountId:ACCOUNT,accountFingerprint:FINGERPRINT}),true);
  assert.throws(()=>assertProductionAccount({accountId:ACCOUNT,accountFingerprint:'f'.repeat(64)}),/cloudflare_account_mismatch/);
  assert.throws(()=>assertProductionAccount({accountId:ACCOUNT,accountFingerprint:null}),/cloudflare_account_unproven/);
  // Live first-run evidence (run 34269989975) proved a provisioning mistake: the runtime contract
  // requires exactly 64 lowercase hex characters and never a `sha256:` prefix, and that must stay
  // a hard rejection rather than a second accepted shape.
  assert.throws(()=>assertProductionAccount({accountId:ACCOUNT,accountFingerprint:`sha256:${FINGERPRINT}`}),
    /cloudflare_account_unproven/);
  assert.throws(()=>assertProductionAccount({accountId:ACCOUNT,accountFingerprint:FINGERPRINT.toUpperCase()}),
    /cloudflare_account_unproven/);
});

test('Cloudflare responses are decoded strictly and the cron set must match exactly',()=>{
  assert.equal(decodeEnvelope({success:false,result:{}}),null);
  assert.deepEqual(decodeSchedules(decodeEnvelope(schedulesBody())),[...EXPECTED_CRON_EXPRESSIONS]);
  assert.equal(decodeSchedules({schedules:[{cron:'DROP TABLE x'}]}),null);
  assert.equal(decodeSchedules({}),null);
  assert.equal(decodeDeployments({deployments:[]}),null);
  assert.equal(decodeDeployments(decodeEnvelope(deploymentsBody())).deploymentId,'7c3c8be5-0000-4000-8000-000000000000');
  assert.deepEqual(decodeSettings(decodeEnvelope(settingsBody())),{observabilityEnabled:true});
  assert.equal(decodeSettings({observability:'yes'}),null);
  assert.equal(cronSetMatches([...EXPECTED_CRON_EXPRESSIONS].reverse()),true);
  assert.equal(cronSetMatches(['17 1 * * *','17 2 * * *']),false);
  assert.equal(cronSetMatches(['*/30 * * * *','17 2 * * *','17 3 * * *']),false);
  assert.equal(cronSetMatches([...EXPECTED_CRON_EXPRESSIONS,'17 4 * * *']),false);
});

test('Cloudflare configuration reads succeed, fail closed, and never claim invocation evidence',async()=>{
  const ok=await readCloudflareConfiguration({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
    token:'t',fetchImpl:fakeFetch(healthyRoutes({bRuns:runsBody([])}))});
  assert.equal(ok.ok,true);
  assert.equal(ok.cronSetExpected,true);
  // The permanent limitation is restated in every successful reading rather than implied.
  assert.equal(ok.invocationHistory,CLOUDFLARE_INVOCATION_UNOBSERVABLE);
  assert.equal(ok.reads,CLOUDFLARE_SENTINEL_MAX_READS);
  const drifted=await readCloudflareConfiguration({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
    token:'t',fetchImpl:fakeFetch(healthyRoutes({bRuns:runsBody([]),schedules:schedulesBody(['17 1 * * *'])}))});
  assert.equal(drifted.reasonCode,'CLOUDFLARE_CRON_SET_MISMATCH');
});

test('identity mismatch fails closed before any Cloudflare request is issued',async()=>{
  const impl=fakeFetch(healthyRoutes({bRuns:runsBody([])}));
  const result=await readCloudflareConfiguration({accountId:ACCOUNT,accountFingerprint:'0'.repeat(64),
    token:'t',fetchImpl:impl});
  assert.equal(result.reasonCode,CLOUDFLARE_IDENTITY_MISMATCH);
  assert.equal(impl.seen.length,0);
});

// Live evidence (run 34277208819, head d9599c4aa557ce0727c4f8b6ddd24a4778b21497) proved identity
// admission succeeds live but the collapsed `CLOUDFLARE_READ_FAILED` code could not identify which
// of the three fixed reads actually failed. Each stage now carries its own closed reason code and
// the sequence stops the instant one stage fails, so the request count itself is load-bearing
// diagnostic evidence: a schedules failure issues 1 request, a deployments failure issues 2, and a
// settings failure issues 3 — never more, and never a retry of the failed stage.
//
// Live evidence (run 34311398342, head 465e54260005c96591bd77be0a1fe1cb44547631) then proved the
// failure narrows specifically to `/schedules`, but the still-collapsed per-stage code could not
// say which broad category. `/schedules` alone was then classified into five closed categories.
//
// Live evidence (run 34319945520, head 90d7851d0084f45577c330e9fa7f1c15432f80c0) then proved the
// failure classifies as `CLOUDFLARE_SCHEDULES_RESPONSE_INVALID`: the request reaches HTTP 200, so
// the failure sits somewhere inside response processing, but that one collapsed code could not say
// whether the JSON body failed to parse, the Cloudflare envelope failed to decode, or the schedules
// payload failed to decode. Those three response-processing layers are now separately named. The
// HTTP status and which processing step first failed are read only to select one enum member and
// never themselves leave the sentinel.
const scheduleFailureCase=async(schedules,expectedReasonCode)=>{
  const impl=fakeFetch(healthyRoutes({bRuns:runsBody([]),schedules}));
  const result=await readCloudflareConfiguration({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
    token:'t',fetchImpl:impl});
  assert.equal(result.ok,false);
  assert.equal(result.reasonCode,expectedReasonCode);
  assert.equal(impl.seen.length,1);
  assert.ok(impl.seen[0].url.endsWith('/schedules'));
  assert.equal(impl.seen[0].method,'GET');
};

test('a schedules transport failure is classified as CLOUDFLARE_SCHEDULES_TRANSPORT_FAILED',async()=>{
  await scheduleFailureCase('ERROR',CLOUDFLARE_SCHEDULES_TRANSPORT_FAILED);
});

test('a schedules 401 or 403 is classified as CLOUDFLARE_SCHEDULES_AUTH_REFUSED',async()=>{
  await scheduleFailureCase(401,CLOUDFLARE_SCHEDULES_AUTH_REFUSED);
  await scheduleFailureCase(403,CLOUDFLARE_SCHEDULES_AUTH_REFUSED);
});

test('a schedules 404 is classified as CLOUDFLARE_SCHEDULES_NOT_FOUND',async()=>{
  await scheduleFailureCase(404,CLOUDFLARE_SCHEDULES_NOT_FOUND);
});

test('any other non-200 schedules response is classified as CLOUDFLARE_SCHEDULES_HTTP_FAILED',async()=>{
  await scheduleFailureCase(429,CLOUDFLARE_SCHEDULES_HTTP_FAILED);
  await scheduleFailureCase(500,CLOUDFLARE_SCHEDULES_HTTP_FAILED);
  await scheduleFailureCase(503,CLOUDFLARE_SCHEDULES_HTTP_FAILED);
});

test('a 200 response whose body cannot be parsed as JSON is classified as CLOUDFLARE_SCHEDULES_JSON_INVALID',async()=>{
  await scheduleFailureCase(()=>{throw new Error('bad json');},CLOUDFLARE_SCHEDULES_JSON_INVALID);
  await scheduleFailureCase(()=>{throw new SyntaxError('Unexpected token < in JSON');},CLOUDFLARE_SCHEDULES_JSON_INVALID);
});

test('a 200 response with valid JSON that is not a valid Cloudflare envelope is classified as CLOUDFLARE_SCHEDULES_ENVELOPE_INVALID',async()=>{
  // `decodeEnvelope` itself is not touched by this test; these are the exact same rejection shapes
  // it has always rejected, now surfaced through their own reason code.
  await scheduleFailureCase({success:false},CLOUDFLARE_SCHEDULES_ENVELOPE_INVALID);
  await scheduleFailureCase({not:'an envelope'},CLOUDFLARE_SCHEDULES_ENVELOPE_INVALID);
  await scheduleFailureCase(null,CLOUDFLARE_SCHEDULES_ENVELOPE_INVALID);
  await scheduleFailureCase([],CLOUDFLARE_SCHEDULES_ENVELOPE_INVALID);
  await scheduleFailureCase({success:true},CLOUDFLARE_SCHEDULES_ENVELOPE_INVALID);
});

// Live evidence (run 34325772296, head dea6a3239443970dd2e5495fe7759e187fb34e20) proved identity
// admission and response-layer decoding both succeed, so the failure sits inside `decodeSchedules`
// itself, but the collapsed `CLOUDFLARE_SCHEDULES_PAYLOAD_INVALID` code could not say which of its
// predicates rejected the live result. These five tests pin one closed code per predicate, in the
// same order `classifySchedulesPayload` (and therefore `decodeSchedules`) evaluates them.
// `decodeSchedules` itself is not touched: these are the exact same rejection shapes it has always
// rejected, now surfaced through their own reason code instead of one shared one.
test('a schedules result that is not an object, or is an array, is classified as CLOUDFLARE_SCHEDULES_RESULT_INVALID',async()=>{
  await scheduleFailureCase(cfEnvelope('nope'),CLOUDFLARE_SCHEDULES_RESULT_INVALID);
  await scheduleFailureCase(cfEnvelope(42),CLOUDFLARE_SCHEDULES_RESULT_INVALID);
  await scheduleFailureCase(cfEnvelope([]),CLOUDFLARE_SCHEDULES_RESULT_INVALID);
  assert.equal(classifySchedulesPayload(null),CLOUDFLARE_SCHEDULES_RESULT_INVALID);
});

test('a missing or non-array schedules property is classified as CLOUDFLARE_SCHEDULES_ARRAY_INVALID',async()=>{
  await scheduleFailureCase(cfEnvelope({}),CLOUDFLARE_SCHEDULES_ARRAY_INVALID);
  await scheduleFailureCase(cfEnvelope({schedules:'nope'}),CLOUDFLARE_SCHEDULES_ARRAY_INVALID);
  await scheduleFailureCase(cfEnvelope({schedules:null}),CLOUDFLARE_SCHEDULES_ARRAY_INVALID);
  await scheduleFailureCase(cfEnvelope({schedules:{cron:'17 1 * * *'}}),CLOUDFLARE_SCHEDULES_ARRAY_INVALID);
});

test('a schedules array over the 16-entry bound is classified as CLOUDFLARE_SCHEDULES_COUNT_EXCEEDED',async()=>{
  await scheduleFailureCase(cfEnvelope({schedules:new Array(17).fill({cron:'17 1 * * *'})}),
    CLOUDFLARE_SCHEDULES_COUNT_EXCEEDED);
});

test('a schedule row with no usable cron value is classified as CLOUDFLARE_SCHEDULES_CRON_NOT_STRING',async()=>{
  await scheduleFailureCase(cfEnvelope({schedules:[{}]}),CLOUDFLARE_SCHEDULES_CRON_NOT_STRING);
  await scheduleFailureCase(cfEnvelope({schedules:[{cron:null}]}),CLOUDFLARE_SCHEDULES_CRON_NOT_STRING);
  await scheduleFailureCase(cfEnvelope({schedules:[{cron:42}]}),CLOUDFLARE_SCHEDULES_CRON_NOT_STRING);
  await scheduleFailureCase(cfEnvelope({schedules:[{cron:{}}]}),CLOUDFLARE_SCHEDULES_CRON_NOT_STRING);
  await scheduleFailureCase(cfEnvelope({schedules:[null]}),CLOUDFLARE_SCHEDULES_CRON_NOT_STRING);
  await scheduleFailureCase(cfEnvelope({schedules:[42]}),CLOUDFLARE_SCHEDULES_CRON_NOT_STRING);
});

test('a cron string the existing CRON pattern rejects is classified as CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED',async()=>{
  await scheduleFailureCase(cfEnvelope({schedules:[{cron:'DROP TABLE x'}]}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
  await scheduleFailureCase(cfEnvelope({schedules:['not a cron']}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
});

// Live evidence (run 34342701912, head dfc78882a507e90662f2937582ab0b35af34bdec) proved a
// byte-identical-text requirement was itself the defect: the owner's Cloudflare dashboard showed
// the approved daily 01:17 trigger legitimately represented as a full day-of-month enumeration
// (`17 1 1,2,...,31 * *`) rather than the repository's textual wildcard. These tests pin the narrow
// semantic canonicaliser that lets both encodings compare equal, without accepting anything beyond
// the closed subset this observer needs.
const fullDayOfMonth=Array.from({length:31},(_,day)=>day+1).join(',');
const expanded=(minute,hour)=>`${minute} ${hour} ${fullDayOfMonth} * *`;

test('a full day-of-month enumeration for each approved daily schedule canonicalises to the repository textual wildcard',()=>{
  assert.deepEqual(decodeSchedules({schedules:[expanded(17,1)]}),['17 1 * * *']);
  assert.deepEqual(decodeSchedules({schedules:[expanded(17,2)]}),['17 2 * * *']);
  assert.deepEqual(decodeSchedules({schedules:[expanded(17,3)]}),['17 3 * * *']);
});

test('a mixed API result of wildcard and full day-of-month enumeration rows still canonicalises to the exact approved set',()=>{
  const decoded=decodeSchedules({schedules:['17 1 * * *',{cron:expanded(17,2)},expanded(17,3)]});
  assert.deepEqual(decoded,[...EXPECTED_CRON_EXPRESSIONS]);
  assert.equal(cronSetMatches(decoded),true);
});

test('a live cycle whose /schedules response uses full day-of-month enumerations still succeeds and uses exactly three reads',async()=>{
  const impl=fakeFetch(healthyRoutes({bRuns:runsBody([]),
    schedules:cfEnvelope({schedules:[expanded(17,1),expanded(17,2),expanded(17,3)]})}));
  const result=await readCloudflareConfiguration({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
    token:'t',fetchImpl:impl});
  assert.equal(result.ok,true);
  assert.equal(result.cronSetExpected,true);
  assert.deepEqual([...result.cronExpressions],[...EXPECTED_CRON_EXPRESSIONS].sort());
  assert.equal(impl.seen.length,3);
  // The canonical output never carries the raw expanded provider text.
  assert.doesNotMatch(JSON.stringify(result),new RegExp(fullDayOfMonth.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('a canonicalised but different daily schedule still reaches CLOUDFLARE_CRON_SET_MISMATCH rather than being accepted',async()=>{
  const minuteDrift=await readCloudflareConfiguration({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
    token:'t',fetchImpl:fakeFetch(healthyRoutes({bRuns:runsBody([]),
      schedules:cfEnvelope({schedules:['18 1 * * *','17 2 * * *','17 3 * * *']})}))});
  assert.equal(minuteDrift.ok,false);
  assert.equal(minuteDrift.reasonCode,CLOUDFLARE_CRON_MISMATCH);
  const hourDrift=await readCloudflareConfiguration({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
    token:'t',fetchImpl:fakeFetch(healthyRoutes({bRuns:runsBody([]),
      schedules:cfEnvelope({schedules:[expanded(17,4),'17 2 * * *','17 3 * * *']})}))});
  assert.equal(hourDrift.ok,false);
  assert.equal(hourDrift.reasonCode,CLOUDFLARE_CRON_MISMATCH);
  // `18 1 * * *` and the hour-4 enumeration both parse successfully (three requests were issued);
  // the mismatch comes from set comparison, not from the pattern stage.
});

test('a partial day-of-month list is not canonicalised to the wildcard and fails closed',async()=>{
  const partial=Array.from({length:30},(_,day)=>day+1).join(','); // 1..30, missing day 31
  await scheduleFailureCase(cfEnvelope({schedules:[`17 1 ${partial} * *`]}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
});

test('a day-of-month list missing entries fails closed rather than being treated as the complete domain',async()=>{
  await scheduleFailureCase(cfEnvelope({schedules:['17 1 1,2,3 * *']}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
});

test('a day-of-month list with a duplicate entry fails closed',async()=>{
  // 31 entries, but day 31 is replaced by a repeat of day 1, so day 31 itself is missing and day 1
  // appears twice: neither a complete domain nor a supported shape, and there is no existing reason
  // to treat a duplicated day specially, so this is rejected exactly like any other incomplete list.
  const withDuplicate=[...Array.from({length:30},(_,day)=>day+1),1].join(',');
  await scheduleFailureCase(cfEnvelope({schedules:[`17 1 ${withDuplicate} * *`]}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
});

test('an out-of-range day-of-month value fails closed',async()=>{
  const zeroBased=Array.from({length:31},(_,day)=>day).join(','); // 0..30, day 0 is out of range
  await scheduleFailureCase(cfEnvelope({schedules:[`17 1 ${zeroBased} * *`]}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
  const overflow=fullDayOfMonth.replace(/,31$/,',32'); // day 32 is out of range
  await scheduleFailureCase(cfEnvelope({schedules:[`17 1 ${overflow} * *`]}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
});

test('a minute outside 0-59 fails closed',async()=>{
  await scheduleFailureCase(cfEnvelope({schedules:['60 1 * * *']}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
  await scheduleFailureCase(cfEnvelope({schedules:['-1 1 * * *']}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
});

test('an hour outside 0-23 fails closed',async()=>{
  await scheduleFailureCase(cfEnvelope({schedules:['17 24 * * *']}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
  await scheduleFailureCase(cfEnvelope({schedules:['17 -1 * * *']}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
});

test('malformed minute/hour number syntax fails closed',async()=>{
  await scheduleFailureCase(cfEnvelope({schedules:['1a 1 * * *']}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
  await scheduleFailureCase(cfEnvelope({schedules:['1.5 1 * * *']}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
  await scheduleFailureCase(cfEnvelope({schedules:['17 1a * * *']}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
});

test('a six-field or seven-field cron fails closed',async()=>{
  await scheduleFailureCase(cfEnvelope({schedules:['17 1 * * * *']}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
  await scheduleFailureCase(cfEnvelope({schedules:['17 1 * * * * 2026']}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
});

test('unsupported month or day-of-week semantics fail closed',async()=>{
  await scheduleFailureCase(cfEnvelope({schedules:['17 1 * 1 *']}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
  await scheduleFailureCase(cfEnvelope({schedules:['17 1 * JAN *']}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
  await scheduleFailureCase(cfEnvelope({schedules:['17 1 * * 1']}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
  await scheduleFailureCase(cfEnvelope({schedules:['17 1 * * MON']}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
});

test('a rejected day-of-month enumeration never exposes the raw expanded cron text in the observation result',async()=>{
  const partial=Array.from({length:30},(_,day)=>day+1).join(',');
  const impl=fakeFetch(healthyRoutes({bRuns:runsBody([]),schedules:cfEnvelope({schedules:[`17 1 ${partial} * *`]})}));
  const result=await readCloudflareConfiguration({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
    token:'t',fetchImpl:impl});
  assert.deepEqual(Object.keys(result),['ok','reasonCode']);
  assert.equal(result.reasonCode,CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED);
  assert.doesNotMatch(JSON.stringify(result),/,3\d,|,2\d,/);
});

// `classifySchedulesPayload` and `decodeSchedules` are both one-line delegations to the single
// internal `analyseSchedulesPayload`, so on any input they read the `reasonCode` and `crons` fields
// of the exact same evaluation rather than running the five predicates twice — there is no second
// implementation that could drift, and this is a property of the source rather than something a
// finite test suite could prove for every possible input. What this test *does* establish, over the
// fixture set below, is behavioural: for each fixture, `decodeSchedules` returns `null` exactly when
// `classifySchedulesPayload` returns a non-null code, and whenever `decodeSchedules` accepts, its
// extracted cron list matches the pre-existing direct row/`row.cron` extraction exactly. The fixture
// set exercises every predicate branch and the successful path, but it is a set of examples, not a
// proof of every input this function could ever receive.
test('decodeSchedules and classifySchedulesPayload agree on the fixture set exercising every predicate branch',()=>{
  const cases=[null,'nope',42,[],{},{schedules:'nope'},{schedules:null},{schedules:{cron:'17 1 * * *'}},
    {schedules:new Array(17).fill({cron:'17 1 * * *'})},{schedules:[{}]},{schedules:[{cron:null}]},
    {schedules:[{cron:42}]},{schedules:[null]},{schedules:[42]},{schedules:[{cron:'DROP TABLE x'}]},
    {schedules:['not a cron']},{schedules:[]},{schedules:['17 1 * * *']},
    {schedules:[...EXPECTED_CRON_EXPRESSIONS].map(cron=>({cron}))}];
  for(const result of cases){
    const classification=classifySchedulesPayload(result);
    const decoded=decodeSchedules(result);
    assert.equal(decoded===null,classification!==null);
    if(decoded!==null){
      assert.deepEqual(decoded,result.schedules.map(row=>typeof row==='string'?row:row.cron));
    }
  }
});

// Structural regression: a live cycle must evaluate the five schedules-payload predicates exactly
// once per decoded envelope. `readSchedulesStage` is required to call the shared internal analyser
// directly rather than calling the public `decodeSchedules`/`classifySchedulesPayload` wrappers
// separately, which would otherwise run the same predicates twice on a rejected live payload.
test('readSchedulesStage evaluates the schedules payload once, through the shared analyser, never through decodeSchedules and classifySchedulesPayload separately',()=>{
  const text=source('cloudflare-sentinel.mjs');
  const match=text.match(/async function readSchedulesStage\([^)]*\)\{([\s\S]*?)\n\}/);
  assert.ok(match,'readSchedulesStage function body not found');
  const body=match[1];
  assert.doesNotMatch(body,/\bdecodeSchedules\(/);
  assert.doesNotMatch(body,/\bclassifySchedulesPayload\(/);
  assert.match(body,/\banalyseSchedulesPayload\(/);
  assert.equal((body.match(/\banalyseSchedulesPayload\(/g)??[]).length,1);
});

test('a healthy envelope and a valid schedules payload still succeed and proceed to deployments/settings',async()=>{
  const impl=fakeFetch(healthyRoutes({bRuns:runsBody([])}));
  const result=await readCloudflareConfiguration({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
    token:'t',fetchImpl:impl});
  assert.equal(result.ok,true);
  assert.equal(impl.seen.length,3);
});

test('no schedules failure category ever carries a numeric status, provider text, a URL or exception text',async()=>{
  const cases=[['ERROR',CLOUDFLARE_SCHEDULES_TRANSPORT_FAILED],[401,CLOUDFLARE_SCHEDULES_AUTH_REFUSED],
    [404,CLOUDFLARE_SCHEDULES_NOT_FOUND],[500,CLOUDFLARE_SCHEDULES_HTTP_FAILED],
    [()=>{throw new Error('bad json');},CLOUDFLARE_SCHEDULES_JSON_INVALID],
    [{not:'an envelope'},CLOUDFLARE_SCHEDULES_ENVELOPE_INVALID],
    [cfEnvelope('nope'),CLOUDFLARE_SCHEDULES_RESULT_INVALID],
    [cfEnvelope({schedules:'nope'}),CLOUDFLARE_SCHEDULES_ARRAY_INVALID],
    [cfEnvelope({schedules:new Array(17).fill({cron:'17 1 * * *'})}),CLOUDFLARE_SCHEDULES_COUNT_EXCEEDED],
    [cfEnvelope({schedules:[{cron:42}]}),CLOUDFLARE_SCHEDULES_CRON_NOT_STRING],
    [cfEnvelope({schedules:[{cron:'DROP TABLE x'}]}),CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED]];
  for(const [schedules,expectedReasonCode] of cases){
    const impl=fakeFetch(healthyRoutes({bRuns:runsBody([]),schedules}));
    const result=await readCloudflareConfiguration({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
      token:'t',fetchImpl:impl});
    assert.deepEqual(Object.keys(result),['ok','reasonCode']);
    assert.equal(result.reasonCode,expectedReasonCode);
    assert.equal(impl.seen.length,1);
    const serialised=JSON.stringify(result);
    assert.doesNotMatch(serialised,/\b(?:401|403|404|429|500|503)\b/);
    assert.doesNotMatch(serialised,/https?:\/\/|authorization|bearer|nope|DROP TABLE|bad json|not an envelope|SyntaxError|Unexpected token/i);
  }
});

test('a deployments-stage failure is diagnosed precisely and stops the sequence at exactly two requests',async()=>{
  for(const deployments of ['ERROR',500,cfEnvelope({deployments:[]})]){
    const routes=healthyRoutes({bRuns:runsBody([])}).filter(([match])=>match!=='/deployments');
    const impl=fakeFetch([...routes,['/deployments',deployments]]);
    const result=await readCloudflareConfiguration({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
      token:'t',fetchImpl:impl});
    assert.equal(result.ok,false);
    assert.equal(result.reasonCode,CLOUDFLARE_DEPLOYMENTS_READ_FAILED);
    assert.equal(impl.seen.length,2);
    assert.ok(impl.seen[0].url.endsWith('/schedules'));
    assert.ok(impl.seen[1].url.endsWith('/deployments'));
  }
});

test('a settings-stage failure is diagnosed precisely and stops the sequence at exactly three requests',async()=>{
  for(const settings of ['ERROR',500,cfEnvelope({observability:'yes'})]){
    const routes=healthyRoutes({bRuns:runsBody([])}).filter(([match])=>match!=='/settings');
    const impl=fakeFetch([...routes,['/settings',settings]]);
    const result=await readCloudflareConfiguration({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
      token:'t',fetchImpl:impl});
    assert.equal(result.ok,false);
    assert.equal(result.reasonCode,CLOUDFLARE_SETTINGS_READ_FAILED);
    assert.equal(impl.seen.length,3);
    assert.ok(impl.seen[0].url.endsWith('/schedules'));
    assert.ok(impl.seen[1].url.endsWith('/deployments'));
    assert.ok(impl.seen[2].url.endsWith('/settings'));
  }
});

test('a healthy cycle issues exactly three GET requests, in order, against the three fixed paths',async()=>{
  const impl=fakeFetch(healthyRoutes({bRuns:runsBody([])}));
  const result=await readCloudflareConfiguration({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
    token:'t',fetchImpl:impl});
  assert.equal(result.ok,true);
  assert.equal(impl.seen.length,3);
  assert.deepEqual(impl.seen.map(entry=>entry.method),['GET','GET','GET']);
  assert.ok(impl.seen[0].url.endsWith('/schedules'));
  assert.ok(impl.seen[1].url.endsWith('/deployments'));
  assert.ok(impl.seen[2].url.endsWith('/settings'));
});

test('the deployments/settings stage-specific reason codes are closed identifiers carrying no provider text',()=>{
  const STAGE_REASON=/^CLOUDFLARE_[A-Z]+_READ_FAILED$/;
  for(const code of [CLOUDFLARE_DEPLOYMENTS_READ_FAILED,CLOUDFLARE_SETTINGS_READ_FAILED]){
    assert.match(code,STAGE_REASON);
    assert.ok(code.length<=63);
  }
  assert.notEqual(CLOUDFLARE_DEPLOYMENTS_READ_FAILED,CLOUDFLARE_SETTINGS_READ_FAILED);
});

test('the eleven schedules category codes are closed, distinct, uppercase identifiers',()=>{
  const CATEGORY_REASON=/^[A-Z][A-Z0-9_]{1,63}$/;
  const codes=[CLOUDFLARE_SCHEDULES_AUTH_REFUSED,CLOUDFLARE_SCHEDULES_NOT_FOUND,
    CLOUDFLARE_SCHEDULES_HTTP_FAILED,CLOUDFLARE_SCHEDULES_JSON_INVALID,
    CLOUDFLARE_SCHEDULES_ENVELOPE_INVALID,CLOUDFLARE_SCHEDULES_TRANSPORT_FAILED,
    CLOUDFLARE_SCHEDULES_RESULT_INVALID,CLOUDFLARE_SCHEDULES_ARRAY_INVALID,
    CLOUDFLARE_SCHEDULES_COUNT_EXCEEDED,CLOUDFLARE_SCHEDULES_CRON_NOT_STRING,
    CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED];
  for(const code of codes)assert.match(code,CATEGORY_REASON);
  assert.equal(new Set(codes).size,codes.length);
  assert.equal(codes.length,11);
});

// Frozen-decoder proof: the response-layer split calls `decodeEnvelope` and `decodeSchedules`
// exactly as the generic `read()` helper always has, so the same inputs must still produce the
// same outputs as the direct decoder unit test above. This is a behavioural proof rather than a
// source-hash pin, so it survives any future non-semantic refactor of this file.
test('decodeEnvelope and decodeSchedules are invoked with unchanged semantics by the schedules-stage split',()=>{
  assert.equal(decodeEnvelope({success:false,result:{}}),null);
  assert.equal(decodeEnvelope({success:true}),null);
  assert.deepEqual(decodeSchedules(decodeEnvelope(schedulesBody())),[...EXPECTED_CRON_EXPRESSIONS]);
  assert.equal(decodeSchedules({schedules:'nope'}),null);
  assert.equal(decodeSchedules({schedules:[{cron:'DROP TABLE x'}]}),null);
  assert.equal(decodeSchedules({}),null);
});

test('a production-account mismatch is not diagnosed as a stage read failure',async()=>{
  const wrongAccount=await readCloudflareConfiguration({accountId:ACCOUNT,accountFingerprint:'0'.repeat(64),
    token:'t',fetchImpl:async()=>({status:200,json:async()=>({})})});
  assert.equal(wrongAccount.reasonCode,'CLOUDFLARE_IDENTITY_MISMATCH');
});

// ================================================================ D1 sentinel

test('the D1 observation surface is a fixed SELECT-only registry and nothing else',()=>{
  assert.deepEqual([...D1_OBSERVATION_QUERY_IDS],['governance','recent_runs','integrity']);
  for(const id of D1_OBSERVATION_QUERY_IDS){
    const sql=D1_OBSERVATION_QUERIES[id];
    assert.match(sql,/^SELECT\s/);
    assert.doesNotMatch(sql,/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|PRAGMA|ATTACH|VACUUM|REINDEX|RETURNING)\b/i);
    assert.ok(!sql.includes(';')&&!sql.includes('--')&&!sql.includes('/*'));
  }
  assert.ok(D1_OBSERVATION_QUERIES.recent_runs.includes(`LIMIT ${D1_SENTINEL_RECENT_RUN_LIMIT}`));
  // Every statement is written against the real migrated schema, and only against it.
  assert.ok(D1_OBSERVATION_QUERIES.integrity.includes('shadow_observations'));
  assert.ok(D1_OBSERVATION_QUERIES.integrity.includes('observation_heads'));
  assert.ok(D1_OBSERVATION_QUERIES.governance.includes('schema_migrations'));
});

test('arbitrary SQL cannot be supplied, smuggled or assembled anywhere in A1.2',()=>{
  for(const sql of ['DELETE FROM shadow_observations','UPDATE ingestion_runs SET status=1',
    'INSERT INTO observation_heads VALUES(1)','DROP TABLE shadow_observations',
    'PRAGMA writable_schema=ON','SELECT 1; DELETE FROM x','SELECT 1 -- DELETE',
    'CREATE INDEX x ON y(z)','SELECT * FROM x RETURNING 1','ATTACH DATABASE x AS y'])
    assert.throws(()=>assertReadOnlySql(sql),/d1_sentinel_sql_forbidden/,sql);
  // The builder takes a registered id and bound values. It takes no SQL and no identifier.
  assert.throws(()=>buildObservationPlan('DELETE FROM x',[]),/d1_sentinel_query_unknown/);
  assert.throws(()=>buildObservationPlan('integrity',[{}]),/d1_sentinel_parameter_invalid/);
  assert.throws(()=>buildObservationPlan('integrity',new Array(17).fill('x')),/d1_sentinel_parameter_invalid/);
  // A hand-made plan object is not executable, however exactly it imitates a real one.
  assert.equal(inspectObservationPlan({queryId:'integrity',sql:'SELECT 1',params:[]}),null);
  assert.equal(inspectObservationPlan(buildObservationPlan('governance',['official-fpl-r1']))!==null,true);
});

test('the D1 client refuses untrusted plans, non-200 answers and any written row',async()=>{
  const plans=buildDailyObservationBatch({dayStartIso:`${DAY}T00:00:00.000Z`,dayEndIso:'2026-09-09T00:00:00.000Z'});
  assert.equal(plans.length,3);
  await assert.rejects(runObservationBatch({accountId:ACCOUNT,token:'t',fetchImpl:async()=>({}),
    plans:[{queryId:'integrity',sql:'SELECT 1',params:[]}]}),/d1_sentinel_plan_untrusted/);
  await assert.rejects(runObservationBatch({accountId:ACCOUNT,token:'',fetchImpl:async()=>({}),plans}),
    /d1_sentinel_token_missing/);
  const written=await runObservationBatch({accountId:ACCOUNT,token:'t',plans,
    fetchImpl:async()=>({status:200,json:async()=>({success:true,result:[
      {success:true,meta:{rows_read:1,rows_written:1},results:[]},
      {success:true,meta:{rows_read:1,rows_written:0},results:[]},
      {success:true,meta:{rows_read:1,rows_written:0},results:[]}]})})});
  assert.equal(written.reasonCode,'D1_WRITE_DETECTED');
  const overBudget=await runObservationBatch({accountId:ACCOUNT,token:'t',plans,
    fetchImpl:async()=>({status:200,json:async()=>({success:true,result:[
      {success:true,meta:{rows_read:D1_SENTINEL_MAX_ROWS_READ+1,rows_written:0},results:[]},
      {success:true,meta:{rows_read:0,rows_written:0},results:[]},
      {success:true,meta:{rows_read:0,rows_written:0},results:[]}]})})});
  assert.equal(overBudget.reasonCode,'D1_READ_BUDGET_EXCEEDED');
  assert.equal((await runObservationBatch({accountId:ACCOUNT,token:'t',plans,
    fetchImpl:async()=>({status:500,json:async()=>({})})})).reasonCode,'D1_READ_FAILED');
  assert.ok(d1QueryUrl(ACCOUNT).endsWith(`/d1/database/${PRODUCTION_D1_ID}/query`));
});

test('D1 rows are interpreted against the production collection contract, and drift fails closed',async()=>{
  const call=body=>readD1State({accountId:ACCOUNT,token:'t',dayStartIso:`${DAY}T00:00:00.000Z`,
    dayEndIso:'2026-09-09T00:00:00.000Z',fetchImpl:async()=>({status:200,json:async()=>body})});
  const ok=await call(d1Body());
  assert.equal(ok.ok,true);
  assert.equal(ok.runs.completed,1);
  assert.equal(ok.integrity.consistent,true);
  assert.equal((await call(d1Body({governance:[governanceRow({migration_version:4})]}))).reasonCode,'D1_GOVERNANCE_MISMATCH');
  assert.equal((await call(d1Body({governance:[governanceRow({rights_classification:'unknown_fail_closed'})]}))).reasonCode,'D1_GOVERNANCE_MISMATCH');
  assert.equal((await call(d1Body({integrity:[integrityRow({orphan_heads:2})]}))).reasonCode,'D1_STATE_INCONSISTENT');
  assert.equal((await call(d1Body({integrity:[integrityRow({heads:9})]}))).reasonCode,'D1_STATE_INCONSISTENT');
  assert.equal((await call(d1Body({integrity:[integrityRow({rejections:1})]}))).reasonCode,'D1_STATE_INCONSISTENT');
  // A malformed row is never partially believed.
  assert.equal((await call(d1Body({runs:[ingestionRow({run_id:'not-a-run'})]}))).reasonCode,'D1_READ_FAILED');
  assert.equal((await call(d1Body({governance:[]}))).reasonCode,'D1_READ_FAILED');
});

test('a run only counts as the day collection when it matches the postflight shape',()=>{
  assert.equal(interpretRuns([ingestionRow()]).completed,1);
  assert.equal(interpretRuns([ingestionRow({records_quarantined:3})]).completed,0);
  assert.equal(interpretRuns([ingestionRow({records_rejected:1})]).completed,0);
  assert.equal(interpretRuns([ingestionRow({error_class:'production_d1_budget_exceeded'})]).completed,0);
  assert.equal(interpretRuns([ingestionRow({status:'started',completed_at:null})]).unresolved,1);
  assert.equal(interpretRuns([ingestionRow({status:'failed'})]).failed,1);
  assert.equal(interpretRuns([]).completed,0);
  assert.equal(interpretRuns(new Array(D1_SENTINEL_RECENT_RUN_LIMIT+1).fill(ingestionRow())),null);
  assert.equal(interpretIntegrity([integrityRow({non_accepted:1})]).consistent,false);
  assert.equal(interpretIntegrity([integrityRow({non_shadow:1})]).consistent,false);
});

// ================================================================ heartbeat

test('an observation run has a deterministic identity and records every required sentinel',async()=>{
  const run=await openObservationRun({startedAt:`${DAY}T09:30:00.000Z`});
  const same=await openObservationRun({startedAt:`${DAY}T09:30:00.000Z`});
  assert.deepEqual(run,same);
  assert.match(run.runId,/^[0-9a-f]{64}$/);
  assert.deepEqual([...run.required],[...REQUIRED_SENTINELS].sort());
  await assert.rejects(openObservationRun({startedAt:'not a time'}),/observation_run_start_invalid/);
  await assert.rejects(openObservationRun({startedAt:`${DAY}T09:30:00.000Z`,sentinels:['github','github']}),
    /observation_run_sentinels_invalid/);
  await assert.rejects(openObservationRun({startedAt:`${DAY}T09:30:00.000Z`,sentinels:['anthropic']}),
    /observation_run_sentinels_invalid/);
});

const sentinelEnvelope=(sourceType,overrides={})=>createObservation(envelope({sourceType,
  sourceIdentity:`sentinel.${sourceType}`,subjectIdentity:`${sourceType}/${DAY}`,...overrides}));

const heartbeatFor=async(states={})=>{
  const run=await openObservationRun({startedAt:`${DAY}T09:30:00.000Z`});
  const observations={};
  for(const id of REQUIRED_SENTINELS){
    const override=states[id];
    if(override==='missing')continue;
    observations[id]=await sentinelEnvelope(id,override??{});
  }
  return closeObservationRun({run,observations,completedAt:`${DAY}T09:30:05.000Z`});
};

test('a crashed or silent sentinel is recorded, and can never look like a completed one',async()=>{
  const complete=await heartbeatFor();
  assert.equal(complete.allCompleted,true);
  assert.equal(complete.allProving,true);
  assert.match(complete.heartbeatHash,/^[0-9a-f]{64}$/);
  assert.equal(complete.sentinels.length,3);
  const missing=await heartbeatFor({d1:'missing'});
  assert.equal(missing.allCompleted,false);
  assert.equal(missing.sentinels.find(entry=>entry.sentinelId==='d1').state,'NOT_EVALUATED');
  const failed=await heartbeatFor({cloudflare:{observationState:'OBSERVATION_FAILED',freshnessAgeMs:null}});
  assert.equal(failed.allCompleted,true);
  assert.equal(failed.allProving,false);
});

// ================================================================ cross-source causality

const gh=(day={})=>({ok:true,mainSha:SHA,verify:'verify_success',verifySuccess:true,
  day:{collected:1,collectFailed:0,refusedOpportunityConsumed:1,guardAmbiguous:0,
    guardContradictory:0,gateRefusedOther:0,inFlight:0,
    unclassified:0,ownerCollections:0,automaticCollections:1,firstCollectionAt:t(`${DAY}T01:17:30.000Z`),
    lastRunCreatedAt:t(`${DAY}T02:17:04.000Z`),collectExecutions:1,duplicateCollection:false,...day}});
const cf=(overrides={})=>({ok:true,cronSetExpected:true,...overrides});
const dd=({runs={},integrity={},governance={}}={})=>({ok:true,
  governance:{ok:true,migrationVersion:3,...governance},
  runs:{total:1,completed:1,failed:0,unresolved:0,latestCompletedAt:t(`${DAY}T01:17:43.000Z`),
    latestCompletedRunId:`gha-${'a'.repeat(40)}`,...runs},
  integrity:{consistent:true,observations:11348,logicalKeys:10157,heads:10157,orphanHeads:0,
    nonAccepted:0,nonShadow:0,rejections:0,latestObservationAt:t(`${DAY}T01:17:43.000Z`),...integrity}});

const evaluate=async(parts={},now=AFTER_DEADLINE,states={})=>evaluateProductionChain({
  heartbeat:await heartbeatFor(states),github:gh(),cloudflare:cf(),d1:dd(),...parts,now});
const evaluateGuardLog=async log=>{
  const github=await readGithubChain({token:'t',now:AFTER_DEADLINE,
    fetchImpl:chainFetch({...HEALTHY_DAY,guardLogs:{501:log}})});
  return evaluate({github});
};

test('1. an early collection followed by a guard refusal is HEALTHY, not a failure',async()=>{
  assert.deepEqual(await evaluate(),{verdict:VERDICT_HEALTHY,reasonCode:'HEALTHY_EXPECTED_STATE'});
});

test('proven consumed is the only failed-guard semantic healthy after an earlier collection',async()=>{
  const consumed='DATA-S2 daily collection opportunity: OPPORTUNITY_CONSUMED (automatic_collection_consumed)\n';
  assert.deepEqual(await evaluateGuardLog(consumed),
    {verdict:VERDICT_HEALTHY,reasonCode:'HEALTHY_EXPECTED_STATE'});
});

test('every approved ambiguous guard reason is RED after an earlier collection',async()=>{
  for(const reason of ['guard_input_invalid','guard_collect_timing_unusable','guard_read_failed',
    'guard_read_bound_exhausted','guard_rerun_contract_violated']){
    const log=`DATA-S2 daily collection opportunity: AMBIGUOUS_REQUIRES_OWNER_ATTENTION (${reason})\n`;
    assert.deepEqual(await evaluateGuardLog(log),
      {verdict:VERDICT_UNHEALTHY,reasonCode:'OPPORTUNITY_GUARD_AMBIGUOUS'},reason);
  }
});

test('failed guard reporting available is contradictory and RED after an earlier collection',async()=>{
  const available='DATA-S2 daily collection opportunity: OPPORTUNITY_AVAILABLE (opportunity_available)\n';
  assert.deepEqual(await evaluateGuardLog(available),
    {verdict:VERDICT_UNHEALTHY,reasonCode:'OPPORTUNITY_GUARD_CONTRADICTORY'});
});

test('missing, malformed, unknown and unreadable guard evidence are RED after an earlier collection',async()=>{
  for(const evidence of [undefined,'',
    'DATA-S2 daily collection opportunity: FUTURE_RESULT (future_reason)\n','ERROR']){
    const guardLogs=evidence===undefined?{}:{501:evidence};
    const github=await readGithubChain({token:'t',now:AFTER_DEADLINE,
      fetchImpl:chainFetch({...HEALTHY_DAY,guardLogs})});
    assert.deepEqual(await evaluate({github}),
      {verdict:VERDICT_UNHEALTHY,reasonCode:'SENTINEL_EVIDENCE_UNAVAILABLE'});
  }
});

test('ambiguous guard is RED without a collection too',async()=>{
  assert.deepEqual(await evaluate({github:gh({collected:0,collectExecutions:0,
    refusedOpportunityConsumed:0,guardAmbiguous:1,automaticCollections:0,firstCollectionAt:null}),
    d1:dd({runs:{total:0,completed:0,latestCompletedAt:null,latestCompletedRunId:null}})}),
    {verdict:VERDICT_UNHEALTHY,reasonCode:'OPPORTUNITY_GUARD_AMBIGUOUS'});
});

test('2. a later opportunity collecting after an earlier one produced no run is HEALTHY',async()=>{
  assert.deepEqual(await evaluate({github:gh({refusedOpportunityConsumed:0,
    firstCollectionAt:t(`${DAY}T02:17:30.000Z`)})}),
    {verdict:VERDICT_HEALTHY,reasonCode:'HEALTHY_EXPECTED_STATE'});
});

test('3. an absent early opportunity is NOT prematurely RED while later ones remain',async()=>{
  const nothing={github:gh({collected:0,refusedOpportunityConsumed:0,collectExecutions:0,
    automaticCollections:0,firstCollectionAt:null}),d1:dd({runs:{total:0,completed:0,latestCompletedAt:null,
      latestCompletedRunId:null}})};
  assert.deepEqual(await evaluate(nothing,t(`${DAY}T00:40:00.000Z`)),
    {verdict:VERDICT_NOT_EVALUATED,reasonCode:'EVALUATION_NOT_DUE'});
  assert.deepEqual(await evaluate(nothing,t(`${DAY}T01:55:00.000Z`)),
    {verdict:VERDICT_NOT_EVALUATED,reasonCode:'AWAITING_LATER_OPPORTUNITY'});
  assert.deepEqual(await evaluate(nothing,t(`${DAY}T03:50:00.000Z`)),
    {verdict:VERDICT_NOT_EVALUATED,reasonCode:'AWAITING_LATER_OPPORTUNITY'});
});

test('4. once every opportunity plus tolerance has passed with no collection, it is RED',async()=>{
  assert.deepEqual(await evaluate({github:gh({collected:0,refusedOpportunityConsumed:0,
    collectExecutions:0,automaticCollections:0,firstCollectionAt:null}),
    d1:dd({runs:{total:0,completed:0,latestCompletedAt:null,latestCompletedRunId:null}})},
    t(`${DAY}T04:02:00.000Z`)),
    {verdict:VERDICT_UNHEALTHY,reasonCode:'PRODUCTION_COLLECTION_NOT_PROVEN'});
});

test('5. a successful workflow run with no matching D1 commit is RED',async()=>{
  assert.deepEqual(await evaluate({d1:dd({runs:{total:0,completed:0,latestCompletedAt:null,
    latestCompletedRunId:null}})}),
    {verdict:VERDICT_UNHEALTHY,reasonCode:'D1_COMMIT_ABSENT_AFTER_SUCCESSFUL_RUN'});
});

test('6. an attended workflow C collection that consumed the day is HEALTHY',async()=>{
  assert.deepEqual(await evaluate({github:gh({ownerCollections:1,automaticCollections:0,
    refusedOpportunityConsumed:2})}),{verdict:VERDICT_HEALTHY,reasonCode:'HEALTHY_EXPECTED_STATE'});
});

test('7. a duplicate production collection is RED from either side of the chain',async()=>{
  assert.deepEqual(await evaluate({github:gh({collected:2,collectExecutions:2,duplicateCollection:true})}),
    {verdict:VERDICT_UNHEALTHY,reasonCode:'DUPLICATE_PRODUCTION_COLLECTION'});
  assert.deepEqual(await evaluate({d1:dd({runs:{completed:2}})}),
    {verdict:VERDICT_UNHEALTHY,reasonCode:'DUPLICATE_PRODUCTION_COLLECTION'});
});

test('8. an unavailable source after the evaluation point is RED, never GREEN',async()=>{
  assert.deepEqual(await evaluate({github:{ok:false,reasonCode:'GITHUB_READ_FAILED'}}),
    {verdict:VERDICT_UNHEALTHY,reasonCode:'SENTINEL_EVIDENCE_UNAVAILABLE'});
  // Any stage-specific Cloudflare failure reason folds into the same unavailable-evidence verdict;
  // evaluateProductionChain branches on `cloudflare.ok` alone, never on which stage failed.
  assert.deepEqual(await evaluate({cloudflare:{ok:false,reasonCode:CLOUDFLARE_SCHEDULES_AUTH_REFUSED}}),
    {verdict:VERDICT_UNHEALTHY,reasonCode:'SENTINEL_EVIDENCE_UNAVAILABLE'});
  assert.deepEqual(await evaluate({d1:{ok:false,reasonCode:'D1_READ_FAILED'}}),
    {verdict:VERDICT_UNHEALTHY,reasonCode:'SENTINEL_EVIDENCE_UNAVAILABLE'});
  assert.deepEqual(await evaluate({},AFTER_DEADLINE,{github:'missing'}),
    {verdict:VERDICT_UNHEALTHY,reasonCode:'SENTINEL_RUN_INCOMPLETE'});
  assert.deepEqual(evaluateProductionChain({heartbeat:null,github:gh(),cloudflare:cf(),d1:dd(),now:AFTER_DEADLINE}),
    {verdict:VERDICT_UNHEALTHY,reasonCode:'SENTINEL_RUN_INCOMPLETE'});
});

test('9. stale evidence is RED, because a superseded reading is no reading',async()=>{
  assert.deepEqual(await evaluate({},AFTER_DEADLINE,
    {d1:{freshnessAgeMs:MAX_EVIDENCE_AGE_MS+1}}),
    {verdict:VERDICT_UNHEALTHY,reasonCode:'SENTINEL_EVIDENCE_STALE'});
});

test('10. unknown external state, drifted configuration and contradictions are RED',async()=>{
  assert.deepEqual(await evaluate({github:gh({unclassified:1})}),
    {verdict:VERDICT_UNHEALTHY,reasonCode:'GITHUB_RUN_STATE_UNRECOGNIZED'});
  assert.deepEqual(await evaluate({cloudflare:cf({cronSetExpected:false})}),
    {verdict:VERDICT_UNHEALTHY,reasonCode:'CLOUDFLARE_CRON_SET_MISMATCH'});
  assert.deepEqual(await evaluate({d1:dd({runs:{unresolved:1}})}),
    {verdict:VERDICT_UNHEALTHY,reasonCode:'D1_RUN_UNRESOLVED'});
  // The guard reports a day consumed only when a collect actually executed, so a refusal with no
  // execution anywhere contradicts the guard's own rule.
  assert.deepEqual(await evaluate({github:gh({collected:0,collectExecutions:0,automaticCollections:0,
    firstCollectionAt:null}),d1:dd({runs:{total:0,completed:0,latestCompletedAt:null,
      latestCompletedRunId:null}})},t(`${DAY}T02:00:00.000Z`)),
    {verdict:VERDICT_UNHEALTHY,reasonCode:'GUARD_REFUSAL_WITHOUT_COLLECTION'});
  // A gate failure for any reason other than the guard is unexpected when the day did not collect.
  assert.deepEqual(await evaluate({github:gh({collected:0,collectExecutions:0,automaticCollections:0,
    refusedOpportunityConsumed:0,gateRefusedOther:1,firstCollectionAt:null}),
    d1:dd({runs:{total:0,completed:0,latestCompletedAt:null,latestCompletedRunId:null}})}),
    {verdict:VERDICT_UNHEALTHY,reasonCode:'WORKFLOW_B_UNEXPECTED_FAILURE'});
  // A non-guard gate failure remains distinct and can be immaterial after a proven collection.
  assert.deepEqual(await evaluate({github:gh({gateRefusedOther:1})}),
    {verdict:VERDICT_HEALTHY,reasonCode:'HEALTHY_EXPECTED_STATE'});
});

test('every verdict reason this module can emit is registered and no verdict is AMBER',async()=>{
  assert.ok(!VERDICT_REASONS.includes('AMBER'));
  assert.deepEqual([...new Set(VERDICT_REASONS)].length,VERDICT_REASONS.length);
  for(const file of A12_FILES)assert.doesNotMatch(source(file),/['"]AMBER['"]/,file);
});

// ================================================================ A1.1 integration

test('A1.2 supplies observations to A1.1 and never classifies, escalates or authorizes itself',async()=>{
  const heartbeat=await heartbeatFor();
  const observations=await Promise.all(REQUIRED_SENTINELS.map(id=>sentinelEnvelope(id)));
  const verdictEnvelope=await sentinelEnvelope('steward');
  const healthy=incidentInputFor({outcome:{verdict:VERDICT_HEALTHY,reasonCode:'HEALTHY_EXPECTED_STATE'},
    mainSha:SHA,now:AFTER_DEADLINE,observations,verdictEnvelope});
  const incident=await createIncident(healthy);
  assert.equal(incident.classification,'GREEN');
  assert.equal(incident.reasonCode,'HEALTHY_EXPECTED_STATE');
  const unhealthy=incidentInputFor({outcome:{verdict:VERDICT_UNHEALTHY,reasonCode:'PRODUCTION_COLLECTION_NOT_PROVEN'},
    mainSha:SHA,now:AFTER_DEADLINE,observations,verdictEnvelope});
  assert.equal((await createIncident(unhealthy)).classification,'RED');
  // An open evaluation window is not an operational state and never enters the incident stream.
  assert.equal(incidentInputFor({outcome:{verdict:VERDICT_NOT_EVALUATED,reasonCode:'EVALUATION_NOT_DUE'},
    mainSha:SHA,now:AFTER_DEADLINE,observations,verdictEnvelope}),null);
  // A1.2 cannot smuggle a classification, a confidence or a suggested action into A1.1.
  assert.deepEqual(Object.keys(healthy).sort(),['actionHistory','conditionId','detectedAt','detectorId',
    'detectorVersion','domain','evidence','expectedState','finalDisposition','mainSha','observedState'].sort());
  assert.equal(classifyOperationalState({conditionId:'healthy',domain:'observation',
    expectedState:{status:'healthy'},observedState:{status:'unhealthy'},
    evidence:healthy.evidence}).classification,'RED');
  assert.ok(heartbeat.allProving);
});

test('A1.1 policy is untouched: Class 1-3 stay disabled and no A1.2 action is registered',()=>{
  assert.deepEqual(AUTO_MERGE_ALLOWLIST,[]);
  assert.deepEqual(ACTION_REGISTRY.map(row=>row.actionId),['observe.evidence.generate',
    'observe.health.inspect','owner.d1.migration.review','repair.auto_merge',
    'repair.dispatch.retry','repair.repository.draft_pr']);
  for(const action of ACTION_REGISTRY)
    if(action.actionClass>0)assert.equal(action.enabled,false,action.actionId);
  assert.deepEqual(ACTION_REGISTRY.filter(action=>action.enabled).map(action=>action.actionClass),[0,0]);
});

// ================================================================ end-to-end orchestration

test('a whole observation run resolves the healthy day from fixtures alone',async()=>{
  const result=await observe();
  assert.equal(result.dayDate,DAY);
  assert.deepEqual(result.outcome,{verdict:VERDICT_HEALTHY,reasonCode:'HEALTHY_EXPECTED_STATE'});
  assert.equal(result.heartbeat.allProving,true);
  assert.equal(result.observations.length,3);
  assert.equal(result.remediationAvailable,false);
  assert.equal(result.escalationRequired,false);
  assert.equal((await createIncident(result.incidentInput)).classification,'GREEN');
  assert.equal(result.verdictObservation.normalizedState.verdict,VERDICT_HEALTHY);
});

test('an observation run without credentials fails closed and observes nothing',async()=>{
  const result=await observe({},AFTER_DEADLINE,{});
  assert.equal(result.outcome.verdict,VERDICT_UNHEALTHY);
  assert.equal(result.outcome.reasonCode,'SENTINEL_EVIDENCE_UNAVAILABLE');
  assert.equal(result.escalationRequired,true);
  for(const observation of result.observations)assert.equal(observation.observationState,'OBSERVATION_FAILED');
  const resolved=resolveStewardEnvironment({});
  assert.equal(resolved.ok,false);
  assert.deepEqual([...resolved.missing],[...STEWARD_ENVIRONMENT_NAMES]);
  assert.equal(resolveStewardEnvironment(ENV).ok,true);
});

test('an observation run with an unreachable GitHub is RED end to end',async()=>{
  const result=await observeProductionChain({env:ENV,now:AFTER_DEADLINE,
    fetchImpl:chainFetch({...HEALTHY_DAY,githubStatus:503})});
  assert.equal(result.outcome.verdict,VERDICT_UNHEALTHY);
  const githubObservation=result.observations.find(entry=>entry.sourceType==='github');
  assert.equal(githubObservation.observationState,'OBSERVATION_FAILED');
  assert.equal((await createIncident(result.incidentInput)).classification,'RED');
});

test('an observation run that sees a run it cannot classify is RED end to end',async()=>{
  const result=await observe({jobsById:{101:[job(EXPECTED_GATE_JOB,{steps:gateSteps('success')}),
    job(EXPECTED_COLLECT_JOB,{startedAt:null})],102:refusedJobs()}});
  assert.equal(result.outcome.reasonCode,'GITHUB_RUN_STATE_UNRECOGNIZED');
});

// ================================================================ security and autonomy

test('the environment contract is least privilege and names no secret value',()=>{
  assert.deepEqual([...STEWARD_ENVIRONMENT_NAMES],['DATA_STEWARD_GITHUB_TOKEN',
    'DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID','DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT',
    'DATA_STEWARD_CLOUDFLARE_READ_TOKEN']);
  for(const entry of STEWARD_ENVIRONMENT){
    assert.equal(entry.required,true);
    assert.doesNotMatch(entry.minimumPermission,/write|edit|admin|deploy|dispatch/i,entry.name);
  }
  assert.ok(FORBIDDEN_PERMISSIONS.includes('workers_scripts:write'));
  assert.ok(FORBIDDEN_PERMISSIONS.includes('d1:write'));
  assert.ok(FORBIDDEN_PERMISSIONS.includes('actions:write'));
  // No credential value, and no AI credential of any kind, appears anywhere in A1.2.
  for(const file of A12_FILES){
    const text=source(file);
    assert.doesNotMatch(text,/ANTHROPIC_API_KEY|OPENAI_API_KEY|api\.anthropic\.com|api\.openai\.com|generativelanguage|\bsk-ant-|\bsk-[A-Za-z0-9]{16,}/,file);
    assert.doesNotMatch(text,/CLOUDFLARE_D1_TOKEN|GITHUB_DISPATCH_TOKEN|GH_TOKEN\b/,file);
  }
});

test('A1.2 contains no mutation, actuator, shell or AI capability of any kind',()=>{
  for(const file of A12_FILES){
    const text=source(file);
    // No write verb reaches any provider.
    assert.doesNotMatch(text,/method\s*:\s*['"](PUT|PATCH|DELETE)['"]/i,file);
    // No SQL that writes, in any form.
    assert.doesNotMatch(text,/\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|DROP\s+(TABLE|INDEX)|ALTER\s+TABLE|CREATE\s+(TABLE|INDEX)|PRAGMA\s+\w+\s*=)/i,file);
    // No GitHub write, dispatch, re-run or administrative endpoint.
    assert.doesNotMatch(text,/\/dispatches|\/rerun|\/cancel|\/actions\/permissions|\/actions\/secrets|\/merges?\b|\/pulls\b|\/issues\b/i,file);
    // No Cloudflare mutation endpoint.
    assert.doesNotMatch(text,/\/versions\b|\/scripts\/[^/'"`]*\/?(?:content|secrets|routes|domains|subdomain)|\/purge_cache|\/tokens\/\$/i,file);
    // No shell, process, filesystem or ambient-environment access.
    assert.doesNotMatch(text,/child_process|node:fs|node:os|spawn(?:Sync)?\s*\(|exec(?:File|Sync)?\s*\(|process\.env/,file);
    // No generic actuator surface.
    assert.doesNotMatch(text,/function\s+(?:runShell|runSql|httpRequest|apiCall|execute[A-Z])/,file);
  }
  // The only POST anywhere in A1.2 is the D1 read query, and only one module can issue it.
  const posters=A12_FILES.filter(file=>/method\s*:\s*['"]POST['"]/i.test(source(file)));
  assert.deepEqual(posters,['d1-sentinel.mjs']);
  assert.equal((source('d1-sentinel.mjs').match(/method\s*:\s*['"]POST['"]/gi)??[]).length,1);
});

test('A1.2 can observe the dispatcher but can never arm, change or redeploy it',()=>{
  // The dispatcher, its contract, the guard, the workflows and the migrations are all untouched.
  const dispatcher=fs.readFileSync('workers/schedule-dispatcher/wrangler.jsonc','utf8');
  assert.ok(dispatcher.includes('"17 1 * * *"')&&dispatcher.includes('"17 2 * * *"')
    &&dispatcher.includes('"17 3 * * *"'));
  assert.deepEqual(fs.readdirSync('workers/data-platform/migrations').sort(),
    ['0001_shadow_data_foundation.sql','0002_official_fpl_structured_history.sql',
      '0003_production_query_plan_indexes.sql']);
  // A1.2 itself added no workflow. A1.3's separate workflow is pinned by its own dormant-runtime tests.
  assert.ok(!fs.existsSync('.github/workflows/data-ops-a1-2-observation.yml'));
});

test('the application stays isolated and every steward-to-platform edge is denied unless exactly allowlisted',()=>{
  // The compensating half of the production dependency scan. A1.2 is the control plane FOR the
  // data platform, so it names it; the deterministic Teamsheet application still may not know the
  // steward exists, and the steward still may not hold the production D1 binding.
  const walk=dir=>fs.readdirSync(dir,{withFileTypes:true})
    .flatMap(entry=>entry.isDirectory()?walk(`${dir}/${entry.name}`)
      :entry.name.endsWith('.mjs')?[`${dir}/${entry.name}`]:[]);
  for(const file of walk('src'))
    assert.doesNotMatch(fs.readFileSync(file,'utf8'),/data-steward|observeProductionChain/i,file);
  assert.doesNotMatch(fs.readFileSync('app.html','utf8'),/data-steward|observeProductionChain/i);
  for(const file of walk('workers/data-steward'))
    assert.doesNotMatch(fs.readFileSync(file,'utf8'),/TEAMSHEET_DATA_DB/,file);
  // Exact source-to-target edges only. Discovery covers every current and future steward module;
  // adding a file gives it no inherited permission to reach any data-platform module.
  const allowed=new Set([
    'workers/data-steward/sentinels/cloudflare-sentinel.mjs -> workers/data-platform/production-identity.mjs',
    'workers/data-steward/sentinels/d1-sentinel.mjs -> workers/data-platform/official-fpl-canonical.mjs',
    'workers/data-steward/sentinels/d1-sentinel.mjs -> workers/data-platform/production-collection.mjs',
    'workers/data-steward/sentinels/github-sentinel.mjs -> workers/data-platform/scheduled/exact-head-verify.mjs'
  ]);
  const actual=new Set();
  for(const file of walk('workers/data-steward')){
    const text=fs.readFileSync(file,'utf8');
    for(const edge of stewardPlatformEdges(file,text)){
      assert.ok(allowed.has(edge),`unreviewed steward dependency: ${edge}`);
      actual.add(edge);
    }
  }
  assert.deepEqual([...actual].sort(),[...allowed].sort());
  // Nothing in A1.2 imports the module that can build production mutations.
  for(const file of A12_FILES)
    assert.doesNotMatch(source(file),/official-fpl-d1-rest-plan|d1-rest-client|official-fpl-history/,file);
});

test('whole-steward scanner rejects regular, side-effect, dynamic and require platform imports',()=>{
  const future='workers/data-steward/future-module.mjs';
  const forms=[
    "import {x} from '../data-platform/unreviewed.mjs';",
    "import '../data-platform/unreviewed.mjs';",
    "await import('../data-platform/unreviewed.mjs');",
    "require('../data-platform/unreviewed.mjs');"
  ];
  for(const form of forms){
    const edges=stewardPlatformEdges(future,form);
    assert.deepEqual(edges,
      ['workers/data-steward/future-module.mjs -> workers/data-platform/unreviewed.mjs'],form);
  }
});
