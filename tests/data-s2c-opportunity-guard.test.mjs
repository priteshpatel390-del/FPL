// DATA-S2C — permanent regressions for the daily routine-collection opportunity guard.
//
// DATA-S2 offers exactly one full collection opportunity per UTC day. Before DATA-S2C that was
// only true because exactly one trigger existed; the external execution path makes it something
// the repository has to prove. These tests hold the guard's scope, its two window rules, its
// fail-closed behaviour, the exact repository files and job name it governs, and the shared
// concurrency membership it deliberately does not try to replace.
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AMBIGUOUS_REQUIRES_OWNER_ATTENTION,AUTOMATIC_COLLECTION,OPPORTUNITY_AVAILABLE,
  OPPORTUNITY_COLLECT_JOB_NAME,OPPORTUNITY_CONSUMED,OPPORTUNITY_GUARD_MAX_READS,
  COLLECT_JOB_STATUSES,OPPORTUNITY_GUARD_REPOSITORY,OPPORTUNITY_REASONS,
  OPPORTUNITY_TRAILING_WINDOW_MS,
  OWNER_COLLECTION,ROUTINE_COLLECTION_WORKFLOWS,CANDIDATE_DISCOVERY_LOOKBACK_MS,
  CONSUMING_RUN_ATTEMPT,MAX_RERUNS_PER_RUN,MAX_RUN_ATTEMPTS,MAX_WORKFLOW_RUN_PAGES,
  WORKFLOW_RUNS_PAGE_SIZE,
  WORKFLOW_RUN_TIME_LIMIT_DAYS,candidateDiscoveryDate,
  candidateDiscoveryStart,classifyOpportunity,opportunityWindowStart,resolveOpportunity,
  runJobsRequest,workflowRunsRequest}
  from '../workers/data-platform/scheduled/opportunity-guard.mjs';

const read=file=>fs.readFileSync(file,'utf8');
const uncommented=source=>source.split('\n').filter(line=>!/^\s*(#|\/\/)/.test(line)).join('\n');
const GUARD_MODULE_PATH='workers/data-platform/scheduled/opportunity-guard.mjs';
const GUARD_ENTRY_PATH='workers/data-platform/scheduled/run-opportunity-guard.mjs';
// The shared production entry point. It is NEVER modified by DATA-S2C; it is read here because the
// invariant it carries is what makes attempts after the first harmless, and therefore what justifies
// the 35-day candidate-discovery horizon.
const PRODUCTION_ENTRY_PATH='workers/data-platform/run-production-collection.mjs';
const SCHEDULED_WORKFLOW='.github/workflows/data-s2-production-scheduled.yml';
const EXTERNAL_WORKFLOW='.github/workflows/data-s2-production-external.yml';
const MANUAL_WORKFLOW='.github/workflows/data-s2-production-collection.yml';

const NOW=Date.UTC(2026,8,6,9,0,0);
const at=(...args)=>new Date(Date.UTC(...args)).toISOString();
// A decoded job execution. Every execution belongs to a numbered attempt, carries a status and, if
// it ever started, a start instant — and it is that start instant, not the run's creation, that
// dates a collection.
const job=(name,conclusion,startedAt=null,{status,attempt=1}={})=>({
  name,conclusion,status:status??(conclusion===null?'in_progress':'completed'),
  startedAt,runAttempt:attempt});
const collect=(conclusion,startedAt,options)=>job('collect',conclusion,startedAt,options);
const gate=(conclusion,startedAt=null,options)=>job('repository-gate',conclusion,startedAt,options);
const run=(id,createdAt,jobs)=>({id,createdAt,jobs});
const empty=()=>({totalCount:0,runs:[]});
const listing=(...runs)=>({totalCount:runs.length,runs});
const world=({scheduled=empty(),external=empty(),manual=empty()}={})=>({
  [SCHEDULED_WORKFLOW]:scheduled,[EXTERNAL_WORKFLOW]:external,[MANUAL_WORKFLOW]:manual});
const classify=(workflows,options={})=>classifyOpportunity({workflows,now:NOW,...options});

/* ------------------------------- governed scope is exact ------------------------------- */

test('the guard governs exactly the three routine collection workflows that exist',()=>{
  assert.deepEqual(ROUTINE_COLLECTION_WORKFLOWS.map(entry=>entry.path),
    [SCHEDULED_WORKFLOW,EXTERNAL_WORKFLOW,MANUAL_WORKFLOW]);
  assert.deepEqual(ROUTINE_COLLECTION_WORKFLOWS.map(entry=>entry.kind),
    [AUTOMATIC_COLLECTION,AUTOMATIC_COLLECTION,OWNER_COLLECTION]);
  for(const entry of ROUTINE_COLLECTION_WORKFLOWS){
    // The repository file the guard names must exist, and the identifier it gives the Actions API
    // must be exactly that file's name, so the two can never drift apart.
    assert.ok(fs.existsSync(entry.path),entry.path);
    assert.equal(entry.path,`.github/workflows/${entry.file}`);
    // Every governed workflow really does carry a credentialled job literally named `collect`.
    assert.match(read(entry.path),/^\n {2}collect:$/m,entry.path);
  }
  assert.equal(OPPORTUNITY_COLLECT_JOB_NAME,'collect');
  assert.equal(OPPORTUNITY_GUARD_REPOSITORY,'priteshpatel390-del/FPL');
});

test('resume, migration and read-only operational workflows are not part of the daily guard',()=>{
  const governed=new Set(ROUTINE_COLLECTION_WORKFLOWS.map(entry=>entry.path));
  const nonRoutine=['.github/workflows/data-s2-production-resume.yml',
    '.github/workflows/data-s2b-migration-0003.yml',
    '.github/workflows/data-s2-first-run-reconciliation.yml',
    '.github/workflows/data-s2b-committed-run-integrity.yml',
    '.github/workflows/data-s2b-explain-acceptance.yml'];
  for(const path of nonRoutine){
    assert.ok(fs.existsSync(path),path);
    assert.ok(!governed.has(path),path);
    // They stay in the shared production group, which is what actually serializes them, and they
    // keep their own owner-input and approval gates.
    assert.match(read(path),/group: data-s2-production-collection\n  cancel-in-progress: false/,path);
    assert.doesNotMatch(read(path),/run-opportunity-guard/,path);
    // None of them carries a `collect` job, so none of them could consume a day even by accident.
    assert.doesNotMatch(read(path),/^\n {2}collect:$/m,path);
  }
  // A non-routine group member is ignored by the day guard even when it is asked about directly.
  const nonRoutineKey=world();
  nonRoutineKey['.github/workflows/data-s2-production-resume.yml']=
    listing(run(9001,at(2026,8,6,1,20),[job('first-run-resume','success')]));
  assert.equal(classify(nonRoutineKey).classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION);
});

/* --------------------------------- consumption semantics --------------------------------- */

test('an unconsumed day is available for both automatic paths',()=>{
  const outcome=classify(world());
  assert.equal(outcome.classification,OPPORTUNITY_AVAILABLE);
  assert.equal(outcome.reason,'opportunity_available');
  assert.ok(Object.isFrozen(outcome));
});

test('workflow A refuses after workflow B has already collected today',()=>{
  const outcome=classify(world({external:listing(
    run(4101,at(2026,8,6,1,25),[gate('success'),collect('success',at(2026,8,6,1,26))]))}),
    {selfRunId:4200});
  assert.equal(outcome.classification,OPPORTUNITY_CONSUMED);
  assert.equal(outcome.reason,'automatic_collection_consumed');
});

test('workflow B refuses after workflow A has already collected today',()=>{
  const outcome=classify(world({scheduled:listing(
    run(4102,at(2026,8,6,1,20),[gate('success'),collect('failure',at(2026,8,6,1,21))]))}),
    {selfRunId:4300});
  assert.equal(outcome.classification,OPPORTUNITY_CONSUMED);
  assert.equal(outcome.reason,'automatic_collection_consumed');
  // A failed collection still consumed the day: it reached the collector and may have mutated
  // production, so a second automatic attempt is exactly what must not happen.
});

test('both automatic paths refuse after an attended owner collection today',()=>{
  const outcome=classify(world({manual:listing(
    run(4103,at(2026,8,6,7,45),[gate('success'),collect('success',at(2026,8,6,7,46))]))}));
  assert.equal(outcome.classification,OPPORTUNITY_CONSUMED);
  assert.equal(outcome.reason,'owner_collection_today');
});

test('the attended owner workflow is deliberately left unguarded',()=>{
  const manual=read(MANUAL_WORKFLOW);
  assert.doesNotMatch(manual,/run-opportunity-guard/);
  assert.doesNotMatch(manual,/opportunity/i);
  // Only the two automatic paths run the guard.
  assert.match(read(SCHEDULED_WORKFLOW),/node workers\/data-platform\/scheduled\/run-opportunity-guard\.mjs/);
  assert.match(read(EXTERNAL_WORKFLOW),/node workers\/data-platform\/scheduled\/run-opportunity-guard\.mjs/);
  const guarded=fs.readdirSync('.github/workflows').filter(name=>/\.ya?ml$/.test(name))
    .filter(name=>/run-opportunity-guard/.test(read(`.github/workflows/${name}`))).sort();
  assert.deepEqual(guarded,['data-s2-production-external.yml','data-s2-production-scheduled.yml']);
});

test('a skipped collect job never consumes the day',()=>{
  // A run whose credential-free repository gate refused looks exactly like this from the Actions
  // API: the gate failed and the dependent `collect` job is reported as skipped.
  const gateOnly=classify(world({scheduled:listing(
    run(4104,at(2026,8,6,1,18),[gate('failure'),collect('skipped',null)]))}));
  assert.equal(gateOnly.classification,OPPORTUNITY_AVAILABLE);
  // A run still inside its gate has no collect job at all, and also leaves the day available.
  const inGate=classify(world({external:listing(
    run(4105,at(2026,8,6,1,18),[gate(null,at(2026,8,6,1,18))]))}));
  assert.equal(inGate.classification,OPPORTUNITY_AVAILABLE);
});

test('a queued or running collect job does consume the day',()=>{
  for(const conclusion of [null,'success','failure','cancelled','timed_out','neutral','action_required'])
    assert.equal(classify(world({scheduled:listing(
      run(4106,at(2026,8,6,1,20),[collect(conclusion,at(2026,8,6,1,21))]))})).classification,
      OPPORTUNITY_CONSUMED,
      String(conclusion));
});

test('a run can never consume its own opportunity',()=>{
  const self=classify(world({external:listing(
    run(4107,at(2026,8,6,9,0),[collect(null,at(2026,8,6,9,0))]))}),{selfRunId:4107});
  assert.equal(self.classification,OPPORTUNITY_AVAILABLE);
  const other=classify(world({external:listing(
    run(4107,at(2026,8,6,9,0),[collect(null,at(2026,8,6,9,0))]))}),{selfRunId:4108});
  assert.equal(other.classification,OPPORTUNITY_CONSUMED);
});

/* ------------------------- re-run attempts, and what they cannot hide ------------------------- */

// The defect this section pins: `filter=latest` returns only the most recent execution of each
// job, so a re-run whose newest attempt skips `collect` would hide an attempt that really did
// collect, and the guard would call a spent day free.
test('an earlier attempt that collected is never erased by a later skipped re-run',()=>{
  const rerun=world({scheduled:listing(run(4301,at(2026,8,6,1,17),[
    gate('success',at(2026,8,6,1,17),{attempt:1}),
    collect('success',at(2026,8,6,1,18),{attempt:1}),
    gate('failure',at(2026,8,6,4,0),{attempt:2}),
    collect('skipped',null,{attempt:2})]))});
  const outcome=classify(rerun,{selfRunId:4399});
  assert.equal(outcome.classification,OPPORTUNITY_CONSUMED);
  assert.equal(outcome.reason,'automatic_collection_consumed');
  // Order is irrelevant: the newest attempt appearing first changes nothing.
  const reordered=world({scheduled:listing(run(4301,at(2026,8,6,1,17),[
    collect('skipped',null,{attempt:2}),
    collect('success',at(2026,8,6,1,18),{attempt:1})]))});
  assert.equal(classify(reordered,{selfRunId:4399}).classification,OPPORTUNITY_CONSUMED);
});

test('an earlier attempt that failed after starting collect still consumes the day',()=>{
  const rerun=world({external:listing(run(4302,at(2026,8,6,1,30),[
    gate('success',at(2026,8,6,1,30),{attempt:1}),
    collect('failure',at(2026,8,6,1,31),{attempt:1}),
    gate('failure',at(2026,8,6,5,0),{attempt:2}),
    collect('skipped',null,{attempt:2})]))});
  // It reached the collector and may have mutated production. A second automatic attempt is
  // exactly what must not happen.
  assert.equal(classify(rerun,{selfRunId:4399}).classification,OPPORTUNITY_CONSUMED);
});

test('multiple attempts that never started collect leave the day available',()=>{
  const neverCollected=world({scheduled:listing(run(4303,at(2026,8,6,1,17),[
    gate('failure',at(2026,8,6,1,17),{attempt:1}),
    collect('skipped',null,{attempt:1}),
    gate('failure',at(2026,8,6,3,0),{attempt:2}),
    collect('skipped',null,{attempt:2}),
    // A third attempt still inside its gate has no collect execution at all.
    gate(null,at(2026,8,6,8,0),{attempt:3})]))});
  const outcome=classify(neverCollected,{selfRunId:4399});
  assert.equal(outcome.classification,OPPORTUNITY_AVAILABLE);
  assert.equal(outcome.reason,'opportunity_available');
});

test('the asking run cannot consume itself on any attempt',()=>{
  const self=world({external:listing(run(4304,at(2026,8,6,8,50),[
    gate('success',at(2026,8,6,8,50),{attempt:1}),
    collect('failure',at(2026,8,6,8,51),{attempt:1}),
    gate('success',at(2026,8,6,8,58),{attempt:2}),
    collect(null,at(2026,8,6,8,59),{attempt:2})]))});
  assert.equal(classify(self,{selfRunId:4304}).classification,OPPORTUNITY_AVAILABLE);
  // The same history belonging to any other run consumes the day.
  assert.equal(classify(self,{selfRunId:4305}).classification,OPPORTUNITY_CONSUMED);
});

// Only attempt 1 can consume. `filter=all` still matters — a later attempt must never hide attempt
// 1's evidence — but a later attempt is never evidence of a collection in its own right, because
// the production entry point refuses it before any production work happens.
test('attempt 1 consumes the day from its own collect start',()=>{
  const first=world({scheduled:listing(run(4310,at(2026,8,6,1,17),[
    gate('success',at(2026,8,6,1,17),{attempt:1}),
    collect('success',at(2026,8,6,1,18),{attempt:1})]))});
  const outcome=classify(first,{selfRunId:4399});
  assert.equal(outcome.classification,OPPORTUNITY_CONSUMED);
  assert.equal(outcome.reason,'automatic_collection_consumed');
  assert.equal(CONSUMING_RUN_ATTEMPT,1);
});

test('a later attempt never consumes the day on its own',()=>{
  // Attempt 1's gate refused, so attempt 1 collected nothing. Attempt 2 is a re-run, and a re-run
  // reaching the collector is exactly what `workflow_retry_forbidden` prevents — so its metadata is
  // never read as a collection. The failing shapes a real re-run can produce are ignored outright.
  for(const conclusion of ['failure','cancelled','timed_out']){
    const rerun=world({scheduled:listing(run(4311,at(2026,8,6,1,17),[
      gate('failure',at(2026,8,6,1,17),{attempt:1}),
      collect('skipped',null,{attempt:1}),
      gate('success',at(2026,8,6,4,0),{attempt:2}),
      collect(conclusion,at(2026,8,6,4,1),{attempt:2})]))});
    const outcome=classify(rerun,{selfRunId:4399});
    assert.equal(outcome.classification,OPPORTUNITY_AVAILABLE,conclusion);
    assert.equal(outcome.reason,'opportunity_available',conclusion);
  }
  // A queued or running later attempt is equally not a collection.
  const running=world({scheduled:listing(run(4312,at(2026,8,6,1,17),[
    collect('skipped',null,{attempt:1}),
    collect(null,at(2026,8,6,4,1),{attempt:2})]))});
  assert.equal(classify(running,{selfRunId:4399}).classification,OPPORTUNITY_AVAILABLE);
});

test('a later attempt reporting a successful collect is impossible state and fails closed',()=>{
  // The entry point throws before it resolves any production identity, so a re-run's collect can
  // only ever fail. Metadata claiming otherwise contradicts the repository contract, and the guard
  // refuses rather than trusting it in either direction — and it is never OPPORTUNITY_CONSUMED
  // solely because a later attempt appears to have collected.
  const impossible=world({scheduled:listing(run(4313,at(2026,8,6,1,17),[
    gate('failure',at(2026,8,6,1,17),{attempt:1}),
    collect('skipped',null,{attempt:1}),
    gate('success',at(2026,8,6,4,0),{attempt:2}),
    collect('success',at(2026,8,6,4,1),{attempt:2})]))});
  const outcome=classify(impossible,{selfRunId:4399});
  assert.equal(outcome.classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION);
  assert.equal(outcome.reason,'guard_rerun_contract_violated');
  assert.ok(OPPORTUNITY_REASONS.includes(outcome.reason));
});

test('a later attempt can never make a day that attempt 1 already collected available again',()=>{
  // Attempt 1 collected; every later-attempt shape leaves the day consumed, and the successful one
  // fails closed. No ordering of the executions changes either answer.
  for(const [conclusion,expected] of [['skipped',OPPORTUNITY_CONSUMED],['failure',OPPORTUNITY_CONSUMED],
    ['cancelled',OPPORTUNITY_CONSUMED],['success',AMBIGUOUS_REQUIRES_OWNER_ATTENTION]]){
    const jobs=[collect('success',at(2026,8,6,1,18),{attempt:1}),
      collect(conclusion,conclusion==='skipped'?null:at(2026,8,6,4,1),{attempt:2})];
    assert.equal(classify(world({scheduled:listing(run(4314,at(2026,8,6,1,17),jobs))}),
      {selfRunId:4399}).classification,expected,conclusion);
    assert.equal(classify(world({scheduled:listing(run(4314,at(2026,8,6,1,17),[...jobs].reverse()))}),
      {selfRunId:4399}).classification,expected,`${conclusion} reversed`);
  }
});

test('a later attempt never needs timing and never makes the day ambiguous on timing',()=>{
  // Attempt 1 is the only attempt whose start instant has to be usable. A later attempt with no
  // start, an unparseable start or a start that contradicts its own run is ignored, not an
  // ambiguity — the day is decided entirely by attempt 1.
  for(const started of [null,'never',at(2026,8,5,1,0)]){
    const noisy=world({scheduled:listing(run(4315,at(2026,8,6,1,17),[
      collect('skipped',null,{attempt:1}),
      collect('failure',started,{attempt:2})]))});
    assert.equal(classify(noisy,{selfRunId:4399}).classification,OPPORTUNITY_AVAILABLE,String(started));
  }
});

test('the jobs listing asks for every attempt and never only the latest',()=>{
  const url=runJobsRequest(4301,'t').url;
  assert.ok(url.includes('filter=all'),url);
  assert.ok(!url.includes('filter=latest'),url);
  assert.ok(url.includes('per_page=100'),url);
  // Structurally, not only in the value this call happened to return.
  const source=uncommented(read(GUARD_MODULE_PATH));
  assert.match(source,/filter=all/);
  assert.doesNotMatch(source,/filter=latest/);
  // The jobs listing itself stays one bounded page: no `page` parameter, on any run id. Matched as
  // a parameter rather than a substring, because `per_page` legitimately contains it.
  for(const runId of [1,4301,999999])assert.doesNotMatch(runJobsRequest(runId,'t').url,/[?&]page=/,
    runJobsRequest(runId,'t').url);
  // Pagination exists only for the candidate listing, and only as an explicitly numbered sequence:
  // no cursor, no `Link` header following, no recursion and no unbounded loop anywhere.
  assert.doesNotMatch(source,/while\s*\(|for\s*\(;;\)|link|cursor|\bnext_page\b/i);
  assert.doesNotMatch(source,/readWorkflowRunsPages\s*\([^)]*\)[\s\S]*?readWorkflowRunsPages\(/);
  assert.equal([...source.matchAll(/readWorkflowRunsPages/g)].length,2,'defined once, called once');
});

test('a jobs listing the provider counts higher than it returned is truncated and fails closed',
  async()=>{
    // Two attempts of two jobs each is four executions; a page carrying three cannot prove which
    // attempt is missing, and the missing one may be the attempt that collected.
    const t=transport([
      ['/actions/runs/71/jobs',ok({total_count:4,jobs:[
        jobRow('repository-gate','failure',at(2026,8,6,4,0),2),
        jobRow('collect','skipped',null,2),
        jobRow('repository-gate','success',at(2026,8,6,1,17),1)]})],
      ['data-s2-production-scheduled.yml/runs',ok(runsBody({id:71,created_at:at(2026,8,6,1,17)}))],
      ['/runs',ok(runsBody())]]);
    const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now:NOW});
    assert.equal(outcome.classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION);
    assert.equal(outcome.reason,'guard_read_failed');
  });

// The largest history one page CAN carry: 50 attempts of two jobs is exactly 100 rows, and the
// provider's count matches what it returned, so nothing is truncated and the normal decision stands.
test('a one-page jobs history at the page bound still decodes normally',async()=>{
  const jobs=[jobRow('repository-gate','success',at(2026,8,6,1,17),1),
    jobRow('collect','success',at(2026,8,6,1,18),1)];
  for(let attempt=2;attempt<=50;attempt+=1){
    jobs.push(jobRow('repository-gate','failure',at(2026,8,6,4,0),attempt));
    jobs.push(jobRow('collect','skipped',null,attempt));
  }
  assert.equal(jobs.length,WORKFLOW_RUNS_PAGE_SIZE);
  const t=transport([
    ['/actions/runs/71/jobs',ok(jobsBody(...jobs))],
    ['data-s2-production-scheduled.yml/runs',ok(runsBody({id:71,created_at:at(2026,8,6,1,17)}))],
    ['/runs',ok(runsBody())]]);
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now:NOW,selfRunId:99});
  // Attempt 1 collected this morning, so the day is consumed — read, not refused.
  assert.equal(outcome.classification,OPPORTUNITY_CONSUMED);
  assert.equal(outcome.reason,'automatic_collection_consumed');
});

// The accepted pathological limit, proved rather than assumed away. GitHub permits 50 re-runs BESIDE
// the original attempt, so a fully exhausted run carries 51 attempts and, at two governed jobs each,
// 102 job executions — two more than the single 100-row page can return. The guard neither pages for
// the remainder nor infers it: the provider's own count exceeds the rows returned, so it fails closed
// exactly like any other truncation.
test('the full permitted re-run history exceeds one jobs page and fails closed',async()=>{
  const jobs=[];
  for(let attempt=1;attempt<=50;attempt+=1){
    jobs.push(jobRow('repository-gate','success',at(2026,8,6,1,17),attempt));
    jobs.push(jobRow('collect','skipped',null,attempt));
  }
  assert.equal(jobs.length,WORKFLOW_RUNS_PAGE_SIZE);
  const t=transport([
    ['/actions/runs/71/jobs',ok({total_count:MAX_RUN_ATTEMPTS*2,jobs})],
    ['data-s2-production-scheduled.yml/runs',ok(runsBody({id:71,created_at:at(2026,8,6,1,17)}))],
    ['/runs',ok(runsBody())]]);
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now:NOW});
  assert.equal(outcome.classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION);
  assert.equal(outcome.reason,'guard_read_failed');
  // Exactly one jobs request was issued for that run, and no second page was ever asked for.
  const jobCalls=t.calls.filter(call=>call.url.includes('/actions/runs/71/jobs'));
  assert.equal(jobCalls.length,1);
  assert.doesNotMatch(jobCalls[0].url,/[?&]page=/,jobCalls[0].url);
  assert.ok(jobCalls[0].url.includes('per_page=100'),jobCalls[0].url);
  assert.ok(jobCalls[0].url.includes('filter=all'),jobCalls[0].url);
});

test('a real two-attempt jobs payload resolves to consumed end to end',async()=>{
  const t=transport([
    ['/actions/runs/71/jobs',ok(jobsBody(
      jobRow('repository-gate','success',at(2026,8,6,1,17),1),
      jobRow('collect','success',at(2026,8,6,1,18),1),
      jobRow('repository-gate','failure',at(2026,8,6,4,0),2),
      jobRow('collect','skipped',null,2)))],
    ['data-s2-production-scheduled.yml/runs',ok(runsBody({id:71,created_at:at(2026,8,6,1,17)}))],
    ['/runs',ok(runsBody())]]);
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now:NOW,selfRunId:99});
  assert.equal(outcome.classification,OPPORTUNITY_CONSUMED);
  assert.equal(outcome.reason,'automatic_collection_consumed');
  assert.ok(t.calls.some(call=>call.url.includes('filter=all')));
  assert.ok(!t.calls.some(call=>call.url.includes('filter=latest')));
  assert.ok(t.calls.length<=OPPORTUNITY_GUARD_MAX_READS);
});

/* --------------------- collection is dated by when collect actually began --------------------- */

test('a run created before midnight whose collect started after it belongs to the new day',()=>{
  // The run object is created at 23:50 and then waits — on GitHub, on environment admission, or
  // behind the shared production concurrency group — until 00:10, when collection truly begins.
  const now=Date.UTC(2026,8,7,8,0,0);
  const delayed=world({scheduled:listing(run(4401,at(2026,8,6,23,50),[
    gate('success',at(2026,8,6,23,51)),collect('success',at(2026,8,7,0,10))]))});
  assert.equal(classifyOpportunity({workflows:delayed,now}).classification,OPPORTUNITY_CONSUMED);
  // Proof that the decision used the collect start and not the run's creation: at 08:00 on the 7th
  // the window opens at 00:00 on the 7th, so 23:50 on the 6th is outside both rules and a
  // created_at reading would have called the day free.
  assert.equal(opportunityWindowStart(now),Date.UTC(2026,8,7,0,0,0));
  assert.ok(Date.parse(at(2026,8,6,23,50))<opportunityWindowStart(now));
  assert.ok(Date.parse(at(2026,8,7,0,10))>=opportunityWindowStart(now));
  // Move only the collect start back outside the window and the same run stops consuming.
  const early=world({scheduled:listing(run(4401,at(2026,8,6,23,50),[
    gate('success',at(2026,8,6,23,51)),collect('success',at(2026,8,6,23,52))]))});
  assert.equal(classifyOpportunity({workflows:early,now}).classification,OPPORTUNITY_AVAILABLE);
});

test('an old run whose collect started inside the window still consumes',()=>{
  // 05:00 on the 7th: the trailing rule reaches back to 23:00 on the 6th and is the wider of the
  // two, so the window opens there.
  const now=Date.UTC(2026,8,7,5,0,0);
  assert.equal(opportunityWindowStart(now),Date.UTC(2026,8,6,23,0,0));
  // The run object was created an hour before the window opened; its collect began inside it.
  const waited=world({external:listing(run(4402,at(2026,8,6,22,0),[
    gate('success',at(2026,8,6,22,1)),collect(null,at(2026,8,6,23,30))]))});
  assert.ok(Date.parse(at(2026,8,6,22,0))<opportunityWindowStart(now));
  assert.equal(classifyOpportunity({workflows:waited,now}).classification,OPPORTUNITY_CONSUMED);
});

test('a collect that claims to have started before its own run, or in the future, fails closed',()=>{
  const beforeRun=world({scheduled:listing(run(4403,at(2026,8,6,8,0),[
    collect('success',at(2026,8,6,7,0))]))});
  const impossible=classify(beforeRun);
  assert.equal(impossible.classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION);
  assert.equal(impossible.reason,'guard_collect_timing_unusable');
  // A start instant later than the current clock is equally contradictory.
  const future=world({scheduled:listing(run(4404,at(2026,8,6,8,0),[
    collect(null,at(2026,8,6,23,0))]))});
  assert.equal(classify(future).reason,'guard_collect_timing_unusable');
});

test('a started collect whose start instant is missing or unusable is ambiguous, never available',
  ()=>{
    for(const startedAt of [null,'','never','2026-13-45T99:99:99Z'])
      for(const conclusion of [null,'success','failure'])
        assert.equal(classify(world({scheduled:listing(
          run(4405,at(2026,8,6,1,17),[collect(conclusion,startedAt)]))})).reason,
          'guard_collect_timing_unusable',`${String(startedAt)}/${String(conclusion)}`);
    // An unrecognised job state is not assumed harmless either.
    assert.equal(classify(world({scheduled:listing(run(4406,at(2026,8,6,1,17),
      [collect(null,at(2026,8,6,1,18),{status:'waiting'})]))})).reason,
      'guard_collect_timing_unusable');
    assert.deepEqual(COLLECT_JOB_STATUSES,['queued','in_progress','completed']);
  });

test('a skipped collect needs no timing and never consumes, however recent its run',()=>{
  const skipped=world({scheduled:listing(run(4407,at(2026,8,6,8,59),[
    gate('failure',at(2026,8,6,8,59)),collect('skipped',null)]))});
  const outcome=classify(skipped,{selfRunId:4499});
  assert.equal(outcome.classification,OPPORTUNITY_AVAILABLE);
  assert.equal(outcome.reason,'opportunity_available');
});

test('every terminal collect conclusion consumes the day from its own start instant',()=>{
  for(const conclusion of ['success','failure','cancelled','timed_out','neutral','action_required'])
    assert.equal(classify(world({external:listing(run(4408,at(2026,8,6,2,0),
      [collect(conclusion,at(2026,8,6,2,1))]))}),{selfRunId:4499}).classification,
      OPPORTUNITY_CONSUMED,conclusion);
  // Queued and in-progress collect jobs consume too: they are running, or about to.
  for(const status of ['queued','in_progress'])
    assert.equal(classify(world({external:listing(run(4409,at(2026,8,6,2,0),
      [collect(null,at(2026,8,6,2,1),{status})]))}),{selfRunId:4499}).classification,
      OPPORTUNITY_CONSUMED,status);
});

/* ------------------------------------ the two windows ------------------------------------ */

test('the current UTC day rule admits every collection since midnight UTC',()=>{
  const midnight=Date.UTC(2026,8,6,23,50,0);
  const dayStart=opportunityWindowStart(midnight);
  assert.equal(dayStart,Date.UTC(2026,8,6,0,0,0));
  // At 23:50 the trailing six hours reaches only 17:50, so the calendar day is the wider rule and
  // a collection at 01:17 that morning still consumes.
  assert.equal(classifyOpportunity({workflows:world({scheduled:listing(
    run(4201,at(2026,8,6,1,17),[collect('success',at(2026,8,6,1,18))]))}),now:midnight}).classification,
    OPPORTUNITY_CONSUMED);
});

test('the trailing six-hour rule closes the UTC-midnight duplicate hole',()=>{
  assert.equal(OPPORTUNITY_TRAILING_WINDOW_MS,6*60*60*1000);
  // 00:03 UTC on 7 September. The calendar day alone would call this a fresh opportunity even
  // though a late run collected five minutes earlier, at 23:58 on the 6th.
  const justAfterMidnight=Date.UTC(2026,8,7,0,3,0);
  assert.equal(opportunityWindowStart(justAfterMidnight),Date.UTC(2026,8,6,18,3,0));
  const late=world({scheduled:listing(
    run(4202,at(2026,8,6,23,58),[collect('success',at(2026,8,6,23,59))]))});
  assert.equal(classifyOpportunity({workflows:late,now:justAfterMidnight}).classification,
    OPPORTUNITY_CONSUMED);
  // A collection older than both rules leaves the day available.
  const yesterday=world({scheduled:listing(
    run(4203,at(2026,8,6,1,17),[collect('success',at(2026,8,6,1,18))]))});
  assert.equal(classifyOpportunity({workflows:yesterday,now:justAfterMidnight}).classification,
    OPPORTUNITY_AVAILABLE);
  // The window is the union of the two rules, never the intersection.
  assert.equal(opportunityWindowStart(NOW),Math.min(Date.UTC(2026,8,6),NOW-OPPORTUNITY_TRAILING_WINDOW_MS));
  // Candidate discovery is a different, wider window and is asserted separately below.
  assert.ok(candidateDiscoveryStart(justAfterMidnight)<opportunityWindowStart(justAfterMidnight));
});

/* ------------------------------------- fail closed ------------------------------------- */

test('malformed, partial or truncated metadata is ambiguous and never available',()=>{
  const bad=[
    null,'runs',[],{},
    world({scheduled:null}),
    world({scheduled:{totalCount:2,runs:[run(1,at(2026,8,6,1,17),[])]}}),
    world({scheduled:{totalCount:'1',runs:[]}}),
    world({scheduled:{totalCount:1,runs:'many'}}),
    world({scheduled:listing({id:0,createdAt:at(2026,8,6,1,17),jobs:[]})}),
    world({scheduled:listing({id:1,createdAt:'not-a-time',jobs:[]})}),
    world({scheduled:listing({id:1,createdAt:at(2026,8,6,1,17),jobs:null})}),
    world({scheduled:listing(run(1,at(2026,8,6,1,17),[{...gate('success'),name:7}]))}),
    world({scheduled:listing(run(1,at(2026,8,6,1,17),[{...collect('success',at(2026,8,6,1,18)),conclusion:5}]))}),
    // Job metadata the cross-attempt reading depends on: status, start instant and attempt number.
    world({scheduled:listing(run(1,at(2026,8,6,1,17),[{...collect('success',at(2026,8,6,1,18)),status:9}]))}),
    world({scheduled:listing(run(1,at(2026,8,6,1,17),[{...collect('success',at(2026,8,6,1,18)),startedAt:17}]))}),
    world({scheduled:listing(run(1,at(2026,8,6,1,17),[{...collect('success',at(2026,8,6,1,18)),runAttempt:0}]))}),
    world({scheduled:listing(run(1,at(2026,8,6,1,17),[{...collect('success',at(2026,8,6,1,18)),runAttempt:'1'}]))})];
  for(const workflows of bad){
    const outcome=classify(workflows);
    assert.equal(outcome.classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION,JSON.stringify(workflows));
    assert.equal(outcome.reason,'guard_input_invalid');
  }
  // A missing governed workflow, or an extra one, is ambiguous rather than assumed empty.
  const short=world();delete short[EXTERNAL_WORKFLOW];
  assert.equal(classify(short).classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION);
  const extra=world();extra['.github/workflows/verify.yml']=empty();
  assert.equal(classify(extra).classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION);
  // A nonsensical clock or self identity is ambiguous too.
  for(const options of [{now:-1},{now:1.5},{now:'now'},{selfRunId:0},{selfRunId:1.5},{selfRunId:'4'}])
    assert.equal(classifyOpportunity({workflows:world(),now:NOW,...options}).classification,
      AMBIGUOUS_REQUIRES_OWNER_ATTENTION,JSON.stringify(options));
  assert.throws(()=>opportunityWindowStart(Number.NaN),/opportunity_now_invalid/);
});

test('every reported reason comes from the closed set',()=>{
  assert.ok(Object.isFrozen(OPPORTUNITY_REASONS));
  for(const workflows of [world(),
    world({manual:listing(run(1,at(2026,8,6,2,0),[collect('success',at(2026,8,6,2,1))]))}),
    world({scheduled:listing(run(2,at(2026,8,6,2,0),[collect('success',at(2026,8,6,2,1))]))}),
    world({scheduled:listing(run(3,at(2026,8,6,2,0),[collect('success',null)]))}),null])
    assert.ok(OPPORTUNITY_REASONS.includes(classify(workflows).reason));
});

/* ---------------------------- bounded, read-only resolution ---------------------------- */

const ok=body=>({status:200,json:async()=>body});
const runsBody=(...rows)=>({total_count:rows.length,workflow_runs:rows});
const jobsBody=(...rows)=>({total_count:rows.length,jobs:rows});
// A provider-shaped job row, exactly as the `filter=all` jobs listing returns one.
const jobRow=(name,conclusion,started_at=null,run_attempt=1)=>({name,conclusion,
  status:conclusion===null?'in_progress':'completed',started_at,run_attempt});

function transport(routes){
  const calls=[];
  return {calls,fetchImpl:async(url,init)=>{
    calls.push({url,method:init.method});
    for(const [fragment,response] of routes)if(url.includes(fragment))return response;
    return {status:404,json:async()=>({})};
  }};
}

test('resolution reads only Actions metadata, read-only, and inside a fixed bound',async()=>{
  const t=transport([
    ['data-s2-production-scheduled.yml/runs',ok(runsBody({id:71,created_at:at(2026,8,6,1,20)}))],
    ['data-s2-production-external.yml/runs',ok(runsBody())],
    ['data-s2-production-collection.yml/runs',ok(runsBody())],
    ['/actions/runs/71/jobs',ok(jobsBody(jobRow('repository-gate','success',at(2026,8,6,1,20)),
      jobRow('collect','success',at(2026,8,6,1,21))))]].reverse());
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now:NOW,selfRunId:99});
  assert.equal(outcome.classification,OPPORTUNITY_CONSUMED);
  assert.equal(outcome.reason,'automatic_collection_consumed');
  assert.ok(t.calls.length<=OPPORTUNITY_GUARD_MAX_READS);
  for(const call of t.calls){
    assert.equal(call.method,'GET');
    assert.ok(call.url.startsWith(`https://api.github.com/repos/${OPPORTUNITY_GUARD_REPOSITORY}/actions/`),call.url);
  }
  // The provider itself bounds the listing by creation date, so the guard never relies on an
  // unbounded page happening to be ordered newest first.
  assert.ok(t.calls[0].url.includes(`created=${encodeURIComponent(`>=${candidateDiscoveryDate(NOW)}`)}`));
  assert.ok(t.calls[0].url.includes('per_page=100'));
});

test('the asking run costs no read of its own jobs',async()=>{
  const t=transport([
    ['data-s2-production-scheduled.yml/runs',ok(runsBody({id:71,created_at:at(2026,8,6,8,55)}))],
    ['/runs',ok(runsBody())]]);
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now:NOW,selfRunId:71});
  assert.equal(outcome.classification,OPPORTUNITY_AVAILABLE);
  assert.ok(!t.calls.some(call=>call.url.includes('/actions/runs/71/jobs')));
});

test('an unreadable, malformed, truncated or failing Actions response fails closed',async()=>{
  const broken=[
    [['/runs',{status:500,json:async()=>({})}]],
    [['/runs',ok({total_count:1,workflow_runs:[]})]],
    [['/runs',ok({workflow_runs:[]})]],
    [['/runs',ok(null)]],
    [['/runs',{status:200,json:async()=>{throw new Error('bad json');}}]],
    [['/runs',ok(runsBody({id:71,created_at:'never'}))]],
    [['/jobs',ok({total_count:2,jobs:[]})],
      ['data-s2-production-scheduled.yml/runs',ok(runsBody({id:71,created_at:at(2026,8,6,1,20)}))],
      ['/runs',ok(runsBody())]]];
  for(const routes of broken){
    const outcome=await resolveOpportunity({token:'t',fetchImpl:transport(routes).fetchImpl,now:NOW});
    assert.equal(outcome.classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION,JSON.stringify(routes[0][0]));
    assert.equal(outcome.reason,'guard_read_failed');
  }
  // A transport failure is ambiguous, never available.
  const thrown=await resolveOpportunity({token:'t',fetchImpl:async()=>{throw new Error('offline');},now:NOW});
  assert.equal(thrown.classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION);
  // So is a caller that supplies no usable token, clock, transport or bound.
  for(const bad of [{token:''},{fetchImpl:null},{now:-1},{maxReads:0},
    {maxReads:OPPORTUNITY_GUARD_MAX_READS+1},{selfRunId:-2}])
    assert.equal((await resolveOpportunity({token:'t',fetchImpl:async()=>ok(runsBody()),now:NOW,...bad}))
      .classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION,JSON.stringify(bad));
});

test('exhausting the read bound is an ambiguity, never a licence to keep reading',async()=>{
  const many=Array.from({length:6},(_,index)=>({id:index+1,created_at:at(2026,8,6,1,index)}));
  const t=transport([['/jobs',ok(jobsBody(jobRow('repository-gate','failure',at(2026,8,6,1,0))))],
    ['data-s2-production-scheduled.yml/runs',ok(runsBody(...many))],['/runs',ok(runsBody())]]);
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now:NOW,maxReads:4});
  assert.equal(outcome.classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION);
  assert.equal(outcome.reason,'guard_read_bound_exhausted');
  assert.equal(t.calls.length,4);
});

/* ------------ candidate discovery is a wider window than the consumption decision ------------ */

// The defect this section pins: the classifier decides on `collect.started_at`, but the Actions API
// can only filter a run listing on the run's own `created_at`. Asking it for runs created inside the
// consumption window omits the run created at 23:50 whose collect started at 00:10 — the classifier
// would refuse correctly, and never sees it.
test('the candidate lookback is the documented workflow-run limit alone, and not 65 days',()=>{
  // A workflow run is limited to "35 days / workflow run ... includes execution duration, and time
  // spent on waiting and approval", which is the whole horizon an ORIGINAL attempt's collect can sit
  // inside. GitHub's 30-day re-run eligibility is deliberately excluded: no re-run can consume the
  // day, because the production entry point refuses every attempt after the first.
  assert.equal(WORKFLOW_RUN_TIME_LIMIT_DAYS,35);
  assert.equal(CANDIDATE_DISCOVERY_LOOKBACK_MS,35*24*60*60*1000);
  assert.notEqual(CANDIDATE_DISCOVERY_LOOKBACK_MS,65*24*60*60*1000);
  // The superseded chained derivation is gone from the module, constant and all.
  const source=uncommented(read(GUARD_MODULE_PATH));
  assert.doesNotMatch(source,/RERUN_ELIGIBILITY_DAYS/);
  assert.doesNotMatch(source,/65/);
  // The 50-re-run cap survives as the reasoning about the single unpaginated jobs page, and nothing
  // else. It is NOT a total attempt count — see the arithmetic regression below.
  assert.equal(MAX_RERUNS_PER_RUN,50);
  assert.equal(MAX_RUN_ATTEMPTS,51);
});

// The corrected provider arithmetic. GitHub documents "A workflow run can be re-run a maximum of 50
// times", and those re-runs are IN ADDITION to the original attempt, so the permitted maximum is 51
// attempts rather than 50. The superseded reasoning treated 50 as the total, concluded that two jobs
// per attempt gave exactly 100 executions, and therefore claimed one 100-row page covered every
// history a run could have. It does not.
test('50 re-runs is 51 permitted attempts and 102 governed job executions',()=>{
  assert.equal(MAX_RERUNS_PER_RUN,50);
  assert.equal(MAX_RUN_ATTEMPTS,1+MAX_RERUNS_PER_RUN);
  assert.equal(MAX_RUN_ATTEMPTS,51);
  // Two governed jobs per attempt.
  assert.equal(MAX_RUN_ATTEMPTS*2,102);
  // Which is strictly more than the one 100-row page the jobs listing reads, so the page is bounded
  // by fail-closed truncation rather than by this cap.
  assert.ok(MAX_RUN_ATTEMPTS*2>WORKFLOW_RUNS_PAGE_SIZE);
  assert.notEqual(MAX_RERUNS_PER_RUN*2,MAX_RUN_ATTEMPTS*2);
  // The superseded claim is gone from the module, comments included.
  const source=read(GUARD_MODULE_PATH);
  assert.doesNotMatch(source,/50 attempts is 100 job executions/);
});

// The load-bearing justification for excluding re-run eligibility from the 35-day horizon. If this
// invariant ever moves, disappears, or comes to sit after production identity resolution or the
// collector, the discovery horizon is no longer sound and this must fail.
test('the production entry point refuses a re-run before any production work',()=>{
  const entry=read(PRODUCTION_ENTRY_PATH);
  const refusal="if(process.env.GITHUB_RUN_ATTEMPT!=='1')throw new Error('workflow_retry_forbidden');";
  // The exact literal, at the top level of the module rather than inside any function or branch.
  assert.match(entry,/^if\(process\.env\.GITHUB_RUN_ATTEMPT!=='1'\)throw new Error\('workflow_retry_forbidden'\);$/m);
  const refusalAt=entry.indexOf(refusal);
  assert.ok(refusalAt>=0,'the re-run refusal literal must be present verbatim');
  assert.equal(entry.indexOf(refusal,refusalAt+1),-1,'exactly one refusal');
  // Import statements name these symbols before the refusal by necessity; what must come after it
  // is every CALL and every network use. Blank the import lines and pin the source order of the
  // remainder.
  const executable=entry.split('\n').map(line=>/^import\s/.test(line)?'':line).join('\n');
  const refusalIndex=executable.indexOf(refusal);
  assert.ok(refusalIndex>=0);
  for(const marker of ['resolveProductionIdentity(','maskProductionIdentity(','runProductionCollection(',
    'fetch']){
    const at=executable.indexOf(marker);
    assert.ok(at>=0,marker);
    assert.ok(at>refusalIndex,`${marker} must occur after the re-run refusal`);
  }
  // Nothing reaches the network, Official FPL or D1 before the refusal.
  const before=executable.slice(0,refusalIndex);
  for(const forbidden of [/fetch/,/https?:/,/api\.cloudflare/i,/fantasy\.premierleague/i,/d1/i,
    /await\s/,/runProductionCollection/,/ProductionIdentity/])
    assert.doesNotMatch(before,forbidden,String(forbidden));
});

test('candidate discovery reaches strictly further back than the consumption window',()=>{
  for(const now of [NOW,Date.UTC(2026,8,7,0,3,0),Date.UTC(2026,8,7,8,0,0),Date.UTC(2026,8,6,23,50,0)]){
    const consumption=opportunityWindowStart(now);
    const discovery=candidateDiscoveryStart(now);
    assert.ok(discovery<consumption,String(now));
    assert.equal(discovery,consumption-CANDIDATE_DISCOVERY_LOOKBACK_MS);
    // The filter the provider is given is a whole UTC date, which can only ever widen the search.
    assert.ok(Date.parse(`${candidateDiscoveryDate(now)}T00:00:00Z`)<=discovery);
  }
  // A clock close to the epoch cannot produce a negative filter date.
  assert.equal(candidateDiscoveryStart(0),0);
  assert.equal(candidateDiscoveryDate(0),'1970-01-01');
});

// The mandatory end-to-end regression. Nothing is injected into the classifier: the run has to be
// discovered through the real generated request, read through the real jobs request and classified.
test('a run created before midnight whose collect started after it is discovered and consumes',
  async()=>{
    const now=Date.UTC(2026,8,7,8,0,0);
    const t=transport([
      ['/actions/runs/71/jobs',ok(jobsBody(
        jobRow('repository-gate','success',at(2026,8,6,23,51),1),
        jobRow('collect','success',at(2026,8,7,0,10),1)))],
      ['data-s2-production-scheduled.yml/runs',ok(runsBody({id:71,created_at:at(2026,8,6,23,50)}))],
      ['/runs',ok(runsBody())]]);
    const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now,selfRunId:99});
    assert.equal(outcome.classification,OPPORTUNITY_CONSUMED);
    assert.equal(outcome.reason,'automatic_collection_consumed');
    // The generated request really does reach back past the run's creation date, and the old
    // consumption-window filter really would have excluded it.
    const listing=t.calls.find(call=>call.url.includes('/runs?'));
    const filtered=decodeURIComponent(listing.url.split('created=')[1].split('&')[0]).replace('>=','');
    assert.ok(Date.parse(`${filtered}T00:00:00Z`)<=Date.parse(at(2026,8,6,23,50)),filtered);
    assert.equal(opportunityWindowStart(now),Date.UTC(2026,8,7,0,0,0));
    assert.ok(Date.parse(at(2026,8,6,23,50))<opportunityWindowStart(now));
  });

test('the same discovery holds on the tightest date boundary',async()=>{
  // 23:59 on the previous UTC day, collect at 00:01 on the current one.
  const now=Date.UTC(2026,8,7,7,0,0);
  const t=transport([
    ['/actions/runs/72/jobs',ok(jobsBody(
      jobRow('repository-gate','success',at(2026,8,6,23,59),1),
      jobRow('collect',null,at(2026,8,7,0,1),1)))],
    ['data-s2-production-external.yml/runs',ok(runsBody({id:72,created_at:at(2026,8,6,23,59)}))],
    ['/runs',ok(runsBody())]]);
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now,selfRunId:99});
  assert.equal(outcome.classification,OPPORTUNITY_CONSUMED);
  assert.equal(outcome.reason,'automatic_collection_consumed');
});

test('a conservatively discovered run whose collect is outside both rules does not consume',
  async()=>{
    const now=Date.UTC(2026,8,7,8,0,0);
    // Discovered because it was created inside the 35-day lookback; it collected days ago.
    const t=transport([
      ['/actions/runs/73/jobs',ok(jobsBody(
        jobRow('repository-gate','success',at(2026,8,1,1,17),1),
        jobRow('collect','success',at(2026,8,1,1,18),1)))],
      ['data-s2-production-scheduled.yml/runs',ok(runsBody({id:73,created_at:at(2026,8,1,1,17)}))],
      ['/runs',ok(runsBody())]]);
    const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now,selfRunId:99});
    assert.equal(outcome.classification,OPPORTUNITY_AVAILABLE);
    assert.equal(outcome.reason,'opportunity_available');
  });

test('an old run whose original attempt collected this morning is discovered and consumes',async()=>{
  // The exact case the 35-day lookback exists for: the run object was created 20 days ago and
  // waited — on environment admission and behind the shared production concurrency group — and its
  // ORIGINAL attempt's collect started this morning. Its `created_at` is far outside the consumption
  // window and inside the discovery window.
  const now=Date.UTC(2026,8,7,8,0,0);
  const t=transport([
    ['/actions/runs/74/jobs',ok(jobsBody(
      jobRow('repository-gate','success',at(2026,7,18,1,17),1),
      jobRow('collect','success',at(2026,8,7,2,5),1)))],
    ['data-s2-production-scheduled.yml/runs',ok(runsBody({id:74,created_at:at(2026,7,18,1,17)}))],
    ['/runs',ok(runsBody())]]);
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now,selfRunId:99});
  assert.equal(outcome.classification,OPPORTUNITY_CONSUMED);
  assert.equal(outcome.reason,'automatic_collection_consumed');
});

test('an old run re-run into the current window does not consume through the re-run',async()=>{
  // The same run, but attempt 1's gate refused and only the re-run reached `collect`. Under the
  // pinned entry-point invariant that re-run cannot have collected, so a reported success is
  // impossible state and the guard refuses rather than reading it as a collection.
  const now=Date.UTC(2026,8,7,8,0,0);
  const t=transport([
    ['/actions/runs/74/jobs',ok(jobsBody(
      jobRow('repository-gate','failure',at(2026,7,29,1,17),1),
      jobRow('collect','skipped',null,1),
      jobRow('repository-gate','success',at(2026,8,7,2,0),2),
      jobRow('collect','success',at(2026,8,7,2,5),2)))],
    ['data-s2-production-scheduled.yml/runs',ok(runsBody({id:74,created_at:at(2026,7,29,1,17)}))],
    ['/runs',ok(runsBody())]]);
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now,selfRunId:99});
  assert.equal(outcome.classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION);
  assert.equal(outcome.reason,'guard_rerun_contract_violated');
  // The one thing it must never be.
  assert.notEqual(outcome.classification,OPPORTUNITY_CONSUMED);
  // And the realistic shape — the re-run failing fast, as the entry point makes it — simply leaves
  // the day available, because attempt 1 never collected.
  const realistic=transport([
    ['/actions/runs/74/jobs',ok(jobsBody(
      jobRow('repository-gate','failure',at(2026,7,29,1,17),1),
      jobRow('collect','skipped',null,1),
      jobRow('repository-gate','success',at(2026,8,7,2,0),2),
      jobRow('collect','failure',at(2026,8,7,2,5),2)))],
    ['data-s2-production-scheduled.yml/runs',ok(runsBody({id:74,created_at:at(2026,7,29,1,17)}))],
    ['/runs',ok(runsBody())]]);
  assert.equal((await resolveOpportunity({token:'t',fetchImpl:realistic.fetchImpl,now,selfRunId:99}))
    .classification,OPPORTUNITY_AVAILABLE);
});

test('the asking run is still excluded when the wider lookback discovers it',async()=>{
  const now=Date.UTC(2026,8,7,8,0,0);
  const t=transport([
    ['data-s2-production-external.yml/runs',ok(runsBody({id:75,created_at:at(2026,8,6,23,50)}))],
    ['/runs',ok(runsBody())]]);
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now,selfRunId:75});
  assert.equal(outcome.classification,OPPORTUNITY_AVAILABLE);
  // And it costs no jobs read of its own.
  assert.ok(!t.calls.some(call=>call.url.includes('/actions/runs/75/jobs')));
});

test('a truncated candidate listing fails closed rather than discovering a subset',async()=>{
  const t=transport([
    ['data-s2-production-scheduled.yml/runs',ok({total_count:3,
      workflow_runs:[{id:71,created_at:at(2026,8,6,23,50)}]})],
    ['/runs',ok(runsBody())]]);
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now:NOW});
  assert.equal(outcome.classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION);
  assert.equal(outcome.reason,'guard_read_failed');
});

/* ---------------- bounded candidate-listing pagination, and the hard read cap ---------------- */

// A provider-shaped candidate listing paged exactly as GitHub pages one: `total_count` is the size
// of the whole filtered set on every page, and each page carries only the rows that remain.
const runRows=(count,offset=0)=>Array.from({length:count},
  (_,index)=>({id:offset+index+1,created_at:at(2026,8,6,1,0)}));
const runsPage=(rows,pageNumber)=>({total_count:rows.length,
  workflow_runs:rows.slice((pageNumber-1)*WORKFLOW_RUNS_PAGE_SIZE,pageNumber*WORKFLOW_RUNS_PAGE_SIZE)});
const pageOf=url=>{const match=/[?&]page=([0-9]+)/.exec(url);return match?Number(match[1]):null;};
const runIdOf=url=>{const match=/\/actions\/runs\/([0-9]+)\/jobs/.exec(url);return match?Number(match[1]):null;};
const gateOnlyJobs=ok(jobsBody(jobRow('repository-gate','failure',at(2026,8,6,1,0))));

// Routes a whole paginated world: each governed workflow file answers from its own run set, job
// listings answer per run id, and `override` can corrupt one specific response.
function paged({scheduled=[],external=[],manual=[],jobs=()=>gateOnlyJobs,override=null}={}){
  const calls=[];
  const sets=[['data-s2-production-scheduled.yml',scheduled],
    ['data-s2-production-external.yml',external],['data-s2-production-collection.yml',manual]];
  return {calls,fetchImpl:async(url,init)=>{
    calls.push({url,method:init.method});
    const forced=override?override(url):null;
    if(forced)return forced;
    for(const [file,rows] of sets)if(url.includes(`${file}/runs`))return ok(runsPage(rows,pageOf(url)));
    const runId=runIdOf(url);
    if(runId!==null)return jobs(runId);
    return {status:404,json:async()=>({})};
  }};
}
const listingCalls=(calls,file)=>calls.filter(call=>call.url.includes(`${file}/runs`));

test('every candidate-listing request is an explicitly numbered page of the fixed page size',()=>{
  const request=workflowRunsRequest('data-s2-production-external.yml','t',NOW,3);
  assert.ok(request.url.includes(`per_page=${WORKFLOW_RUNS_PAGE_SIZE}`),request.url);
  assert.ok(request.url.includes('&page=3'),request.url);
  assert.equal(request.init.method,'GET');
  // Page 1 is the default, so an unnumbered call is still an explicit first page.
  assert.ok(workflowRunsRequest('data-s2-production-external.yml','t',NOW).url.includes('&page=1'));
  // The page number is validated, and the page cap is a real ceiling on the request itself.
  for(const bad of [0,-1,1.5,'2',null,MAX_WORKFLOW_RUN_PAGES+1])
    assert.throws(()=>workflowRunsRequest('data-s2-production-external.yml','t',NOW,bad),
      /opportunity_page_invalid/,String(bad));
  assert.doesNotThrow(()=>workflowRunsRequest('data-s2-production-external.yml','t',NOW,
    MAX_WORKFLOW_RUN_PAGES));
});

// The defect this pins: workflow B gains three dispatch opportunities a day under Package C, so a
// 35-day horizon holds more than one page of candidates and a single page would silently omit the
// run that collected.
test('a consuming run on the second candidate page is discovered and refuses the day',async()=>{
  const rows=runRows(101,7000);
  const consuming=rows[100].id;
  const t=paged({external:rows,jobs:runId=>runId===consuming
    ?ok(jobsBody(jobRow('repository-gate','success',at(2026,8,6,1,17),1),
      jobRow('collect','success',at(2026,8,6,1,18),1)))
    :gateOnlyJobs});
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now:NOW,selfRunId:99});
  assert.equal(outcome.classification,OPPORTUNITY_CONSUMED);
  assert.equal(outcome.reason,'automatic_collection_consumed');
  // The run really was only reachable on page 2, and its jobs really were read.
  assert.ok(t.calls.some(call=>call.url.includes(`/actions/runs/${consuming}/jobs`)));
  assert.equal(listingCalls(t.calls,'data-s2-production-external.yml').length,2);
});

test('pagination stops exactly when the provider count is satisfied',async()=>{
  for(const [count,pages] of [[0,1],[1,1],[100,1],[101,2]]){
    const t=paged({external:runRows(count,9000)});
    assert.equal((await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now:NOW}))
      .classification,OPPORTUNITY_AVAILABLE,String(count));
    assert.equal(listingCalls(t.calls,'data-s2-production-external.yml').length,pages,String(count));
    // The other two workflows are empty and cost exactly one page each — never zero, never two.
    assert.equal(listingCalls(t.calls,'data-s2-production-scheduled.yml').length,1);
    assert.equal(listingCalls(t.calls,'data-s2-production-collection.yml').length,1);
    // Page numbers are the exact ascending sequence, with no repeat and no gap.
    assert.deepEqual(listingCalls(t.calls,'data-s2-production-external.yml').map(call=>pageOf(call.url)),
      Array.from({length:pages},(_,index)=>index+1));
  }
  // Above 200 candidates every page is still read on the same arithmetic — three pages for 201 —
  // and it is the job listings, not the paging, that then exhaust the read bound.
  const large=paged({external:runRows(201,9900)});
  const outcome=await resolveOpportunity({token:'t',fetchImpl:large.fetchImpl,now:NOW});
  assert.deepEqual(listingCalls(large.calls,'data-s2-production-external.yml').map(call=>pageOf(call.url)),
    [1,2,3]);
  assert.equal(outcome.reason,'guard_read_bound_exhausted');
  assert.equal(large.calls.length,OPPORTUNITY_GUARD_MAX_READS);
});

test('a malformed later candidate page fails closed rather than discovering a subset',async()=>{
  for(const broken of [ok(null),ok({workflow_runs:[]}),ok({total_count:101}),
    {status:500,json:async()=>({})},{status:200,json:async()=>{throw new Error('bad json');}},
    ok({total_count:101,workflow_runs:[{id:'x',created_at:at(2026,8,6,1,0)}]}),
    ok({total_count:101,workflow_runs:[{id:1,created_at:'never'}]}),
    // Short and over-full pages are both rejected: page 2 of a 101-run set must carry exactly one.
    ok({total_count:101,workflow_runs:[]}),
    ok({total_count:101,workflow_runs:runRows(2,9500)})]){
    const t=paged({external:runRows(101,9000),
      override:url=>url.includes('data-s2-production-external.yml/runs')&&pageOf(url)===2?broken:null});
    const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now:NOW});
    assert.equal(outcome.classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION,JSON.stringify(broken.status));
    assert.equal(outcome.reason,'guard_read_failed');
  }
});

test('a total_count that changes between pages is an ambiguity, never a reconciliation',async()=>{
  // Page 2 is internally consistent with its own smaller total — zero rows remain after 100 — so
  // only the explicit cross-page reconciliation catches it.
  const shrunk=paged({external:runRows(101,9000),
    override:url=>url.includes('data-s2-production-external.yml/runs')&&pageOf(url)===2
      ?ok({total_count:100,workflow_runs:[]}):null});
  const outcome=await resolveOpportunity({token:'t',fetchImpl:shrunk.fetchImpl,now:NOW});
  assert.equal(outcome.classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION);
  assert.equal(outcome.reason,'guard_read_failed');
  // A set that grew is equally unusable.
  const grown=paged({external:runRows(101,9000),
    override:url=>url.includes('data-s2-production-external.yml/runs')&&pageOf(url)===2
      ?ok({total_count:300,workflow_runs:runRows(100,9600)}):null});
  assert.equal((await resolveOpportunity({token:'t',fetchImpl:grown.fetchImpl,now:NOW})).reason,
    'guard_read_failed');
});

test('a run repeated across pages is an ambiguity, never silently de-duplicated',async()=>{
  // A filtered set that shifted underneath the sequence can drop a run as easily as repeat one, so
  // the repeat is treated as evidence the read is unusable rather than as a tidy-up.
  const rows=runRows(101,9000);
  const t=paged({external:rows,
    override:url=>url.includes('data-s2-production-external.yml/runs')&&pageOf(url)===2
      ?ok({total_count:101,workflow_runs:[rows[0]]}):null});
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now:NOW});
  assert.equal(outcome.classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION);
  assert.equal(outcome.reason,'guard_read_failed');
});

test('more candidate pages than the page cap allows stops before the second request',async()=>{
  // Placed in the workflow the guard reads first, so "stops immediately" is provable by call count.
  const t=paged({scheduled:runRows(MAX_WORKFLOW_RUN_PAGES*WORKFLOW_RUNS_PAGE_SIZE+1,20000)});
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now:NOW});
  assert.equal(outcome.classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION);
  assert.equal(outcome.reason,'guard_read_bound_exhausted');
  // The page count is fixed from page 1, so the run stops after exactly one listing read.
  assert.equal(t.calls.length,1);
});

/* -------- the hard read cap: 200 requests, counted across listings and job listings -------- */

test('the hard read bound is 200 and counts every GitHub request the guard makes',async()=>{
  assert.equal(OPPORTUNITY_GUARD_MAX_READS,200);
  // Two listing pages plus 196 job listings for workflow A, plus one empty page each for B and C,
  // is exactly 200 requests — and exactly 200 is allowed.
  const t=paged({scheduled:runRows(196,30000)});
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now:NOW});
  assert.equal(outcome.classification,OPPORTUNITY_AVAILABLE);
  assert.equal(outcome.reason,'opportunity_available');
  assert.equal(t.calls.length,OPPORTUNITY_GUARD_MAX_READS);
  assert.equal(listingCalls(t.calls,'data-s2-production-scheduled.yml').length,2);
  assert.equal(t.calls.filter(call=>call.url.includes('/jobs')).length,196);
});

test('a cycle needing a 201st request fails closed and never issues it',async()=>{
  // One more candidate run: two listing pages plus 197 job listings plus B's page is 200, and C's
  // page would be the 201st.
  const t=paged({scheduled:runRows(197,31000)});
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now:NOW});
  assert.equal(outcome.classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION);
  assert.equal(outcome.reason,'guard_read_bound_exhausted');
  // The bound is a hard cap: the guard stops at it, it does not overshoot and then notice.
  assert.equal(t.calls.length,OPPORTUNITY_GUARD_MAX_READS);
  assert.ok(!t.calls.some(call=>call.url.includes('data-s2-production-collection.yml/runs')));
});

test('the approved overlap footprint of 35 A runs and 105 B runs fits inside the bound',async()=>{
  // The steady state the 200 cap is budgeted for: workflow A asking once a day and workflow B three
  // times a day across the 35-day discovery horizon, with workflow C small.
  const t=paged({scheduled:runRows(35,40000),external:runRows(105,41000),manual:runRows(2,42000)});
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now:NOW});
  assert.equal(outcome.classification,OPPORTUNITY_AVAILABLE);
  // 1 + 2 + 1 listing pages, plus one job listing per candidate run.
  assert.equal(listingCalls(t.calls,'data-s2-production-scheduled.yml').length,1);
  assert.equal(listingCalls(t.calls,'data-s2-production-external.yml').length,2);
  assert.equal(listingCalls(t.calls,'data-s2-production-collection.yml').length,1);
  assert.equal(t.calls.filter(call=>call.url.includes('/jobs')).length,142);
  assert.equal(t.calls.length,146);
  assert.ok(t.calls.length<OPPORTUNITY_GUARD_MAX_READS);
  // Headroom is stated, not implied: the budget is a budget and not a proof.
  assert.equal(OPPORTUNITY_GUARD_MAX_READS-t.calls.length,54);
  // The same population still refuses correctly when one of those B runs collected today.
  const consuming=41105;
  const spent=paged({scheduled:runRows(35,40000),external:runRows(105,41000),manual:runRows(2,42000),
    jobs:runId=>runId===consuming
      ?ok(jobsBody(jobRow('repository-gate','success',at(2026,8,6,1,17),1),
        jobRow('collect','success',at(2026,8,6,1,18),1)))
      :gateOnlyJobs});
  assert.equal((await resolveOpportunity({token:'t',fetchImpl:spent.fetchImpl,now:NOW,selfRunId:99}))
    .reason,'automatic_collection_consumed');
});

test('the asking run still costs no job listing when the population is large',async()=>{
  const rows=runRows(150,50000);
  const t=paged({external:rows});
  const selfRunId=rows[120].id;
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now:NOW,selfRunId});
  assert.equal(outcome.classification,OPPORTUNITY_AVAILABLE);
  assert.ok(!t.calls.some(call=>call.url.includes(`/actions/runs/${selfRunId}/jobs`)));
  // 149 job listings for 150 candidates, plus 2 + 1 + 1 listing pages.
  assert.equal(t.calls.filter(call=>call.url.includes('/jobs')).length,149);
  assert.equal(t.calls.length,153);
});

test('a jobs listing truncated by the provider still fails closed at scale',async()=>{
  const rows=runRows(101,60000);
  const t=paged({external:rows,jobs:runId=>runId===rows[100].id
    ?ok({total_count:4,jobs:[jobRow('repository-gate','failure',at(2026,8,6,1,0),1)]})
    :gateOnlyJobs});
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now:NOW});
  assert.equal(outcome.classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION);
  assert.equal(outcome.reason,'guard_read_failed');
});

test('discovery never changes how consumption is decided',async()=>{
  // A run created comfortably inside the consumption window, whose collect started before it.
  // Discovery finds it either way; only `collect.started_at` decides, and it does not consume.
  const now=Date.UTC(2026,8,7,12,0,0);
  const t=transport([
    ['/actions/runs/76/jobs',ok(jobsBody(
      jobRow('repository-gate','success',at(2026,8,7,5,0),1),
      jobRow('collect','success',at(2026,8,7,5,1),1)))],
    ['data-s2-production-scheduled.yml/runs',ok(runsBody({id:76,created_at:at(2026,8,7,5,0)}))],
    ['/runs',ok(runsBody())]]);
  // At 12:00 the window opens at 00:00, so this one does consume.
  assert.equal((await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now,selfRunId:99}))
    .classification,OPPORTUNITY_CONSUMED);
  // The jobs request still asks for every attempt.
  assert.ok(t.calls.some(call=>call.url.includes('filter=all')));
  assert.ok(!t.calls.some(call=>call.url.includes('filter=latest')));
});

test('the guard never dispatches, re-runs, cancels or writes anything',()=>{
  const source=uncommented(`${read(GUARD_MODULE_PATH)}\n${read(GUARD_ENTRY_PATH)}`);
  // Write verbs and the mutating Actions endpoints, matched as URL path segments rather than as
  // bare words: the module legitimately names GitHub's documented re-run limits as constants, and a
  // constant carrying a number is not a request. What must never appear is the endpoint itself.
  for(const forbidden of [/'POST'/,/"POST"/,/'PUT'/,/'PATCH'/,/'DELETE'/,/dispatches/,/workflow_dispatch/,
    /\/rerun/i,/rerun-failed-jobs/i,/\/rerequest/i,/\/cancel/i,/method:'(?!GET)/])
    assert.doesNotMatch(source,forbidden,String(forbidden));
  // Positively: every URL this module can build is one of exactly two read-only listing shapes.
  for(const entry of ROUTINE_COLLECTION_WORKFLOWS){
    const request=workflowRunsRequest(entry.file,'t',NOW);
    assert.equal(request.init.method,'GET');
    assert.match(request.url,
      /^https:\/\/api\.github\.com\/repos\/[\w.-]+\/[\w.-]+\/actions\/workflows\/[\w.-]+\/runs\?/);
  }
  assert.match(runJobsRequest(12,'t').url,
    /^https:\/\/api\.github\.com\/repos\/[\w.-]+\/[\w.-]+\/actions\/runs\/12\/jobs\?/);
  assert.equal(workflowRunsRequest('data-s2-production-external.yml','t',NOW).init.method,'GET');
  assert.equal(runJobsRequest(12,'t').init.method,'GET');
  assert.equal(runJobsRequest(12,'t').url,
    `https://api.github.com/repos/${OPPORTUNITY_GUARD_REPOSITORY}/actions/runs/12/jobs?per_page=100&filter=all`);
  for(const bad of [0,-1,1.5,'12',null])assert.throws(()=>runJobsRequest(bad,'t'),/opportunity_run_id_invalid/);
  assert.throws(()=>workflowRunsRequest('verify.yml','t',NOW),/opportunity_workflow_unknown/);
  for(const bad of ['',null])assert.throws(()=>workflowRunsRequest('data-s2-production-scheduled.yml',bad,NOW),
    /opportunity_token_missing/);
});

test('the guard holds no Cloudflare credential, D1 credential or production identifier',()=>{
  // Executable source only: the module header legitimately explains what it must never hold.
  const source=uncommented(`${read(GUARD_MODULE_PATH)}\n${read(GUARD_ENTRY_PATH)}`);
  for(const forbidden of [/CLOUDFLARE/i,/D1_TOKEN/i,/ACCOUNT_ID/i,/FINGERPRINT/i,/database_id/i,
    /fantasy\.premierleague/i,/ANTHROPIC/i,/ODDS/i,/api\.cloudflare/i])
    assert.doesNotMatch(source,forbidden,String(forbidden));
  // The only host it contacts is the GitHub API.
  assert.deepEqual([...new Set([...source.matchAll(/https:\/\/([a-z.]+)\//g)].map(row=>row[1]))],
    ['api.github.com']);
  // Its only credential is the job's own GitHub token, taken from the environment and never
  // written back out.
  assert.match(read(GUARD_ENTRY_PATH),/required\('GH_TOKEN'\)/);
  // The entry point discards the original error so no request URL, header or identifier can reach
  // the workflow log through a runtime message.
  assert.match(read(GUARD_ENTRY_PATH),/catch\{outcome=\{classification:AMBIGUOUS_REQUIRES_OWNER_ATTENTION/);
  assert.doesNotMatch(uncommented(read(GUARD_ENTRY_PATH)),/error\.message|String\(error\)|console\.error/);
});

/* ------------------------ shared concurrency membership, unchanged ------------------------ */

test('every member of the shared production group stays non-cancelling with no queue key',()=>{
  const members=fs.readdirSync('.github/workflows').filter(name=>/\.ya?ml$/.test(name))
    .filter(name=>/^\s{2}group: data-s2-production-collection$/m.test(read(`.github/workflows/${name}`)))
    .sort();
  // Membership drift detection: this exact set, no more and no fewer.
  assert.deepEqual(members,['data-s2-first-run-reconciliation.yml','data-s2-production-collection.yml',
    'data-s2-production-external.yml','data-s2-production-resume.yml','data-s2-production-scheduled.yml',
    'data-s2b-committed-run-integrity.yml','data-s2b-explain-acceptance.yml',
    'data-s2b-migration-0003.yml']);
  for(const name of members){
    const source=read(`.github/workflows/${name}`);
    assert.match(source,/concurrency:\n  group: data-s2-production-collection\n  cancel-in-progress: false/,name);
    assert.equal([...source.matchAll(/^concurrency:$/gm)].length,1,name);
    // `queue:` is deliberately not implemented in this package.
    assert.doesNotMatch(uncommented(source),/^\s*queue:/m,name);
  }
});
