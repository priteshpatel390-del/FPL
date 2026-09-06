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
  OPPORTUNITY_GUARD_REPOSITORY,OPPORTUNITY_REASONS,OPPORTUNITY_TRAILING_WINDOW_MS,
  OWNER_COLLECTION,ROUTINE_COLLECTION_WORKFLOWS,classifyOpportunity,opportunityWindowDate,
  opportunityWindowStart,resolveOpportunity,runJobsRequest,workflowRunsRequest}
  from '../workers/data-platform/scheduled/opportunity-guard.mjs';

const read=file=>fs.readFileSync(file,'utf8');
const uncommented=source=>source.split('\n').filter(line=>!/^\s*(#|\/\/)/.test(line)).join('\n');
const GUARD_MODULE_PATH='workers/data-platform/scheduled/opportunity-guard.mjs';
const GUARD_ENTRY_PATH='workers/data-platform/scheduled/run-opportunity-guard.mjs';
const SCHEDULED_WORKFLOW='.github/workflows/data-s2-production-scheduled.yml';
const EXTERNAL_WORKFLOW='.github/workflows/data-s2-production-external.yml';
const MANUAL_WORKFLOW='.github/workflows/data-s2-production-collection.yml';

const NOW=Date.UTC(2026,8,6,9,0,0);
const at=(...args)=>new Date(Date.UTC(...args)).toISOString();
const job=(name,conclusion)=>({name,conclusion});
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
    run(4101,at(2026,8,6,1,25),[job('repository-gate','success'),job('collect','success')]))}),
    {selfRunId:4200});
  assert.equal(outcome.classification,OPPORTUNITY_CONSUMED);
  assert.equal(outcome.reason,'automatic_collection_consumed');
});

test('workflow B refuses after workflow A has already collected today',()=>{
  const outcome=classify(world({scheduled:listing(
    run(4102,at(2026,8,6,1,20),[job('repository-gate','success'),job('collect','failure')]))}),
    {selfRunId:4300});
  assert.equal(outcome.classification,OPPORTUNITY_CONSUMED);
  assert.equal(outcome.reason,'automatic_collection_consumed');
  // A failed collection still consumed the day: it reached the collector and may have mutated
  // production, so a second automatic attempt is exactly what must not happen.
});

test('both automatic paths refuse after an attended owner collection today',()=>{
  const outcome=classify(world({manual:listing(
    run(4103,at(2026,8,6,7,45),[job('repository-gate','success'),job('collect','success')]))}));
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
    run(4104,at(2026,8,6,1,18),[job('repository-gate','failure'),job('collect','skipped')]))}));
  assert.equal(gateOnly.classification,OPPORTUNITY_AVAILABLE);
  // A run still inside its gate has no collect job at all, and also leaves the day available.
  const inGate=classify(world({external:listing(
    run(4105,at(2026,8,6,1,18),[job('repository-gate',null)]))}));
  assert.equal(inGate.classification,OPPORTUNITY_AVAILABLE);
});

test('a queued or running collect job does consume the day',()=>{
  for(const conclusion of [null,'success','failure','cancelled','timed_out','neutral','action_required'])
    assert.equal(classify(world({scheduled:listing(
      run(4106,at(2026,8,6,1,20),[job('collect',conclusion)]))})).classification,OPPORTUNITY_CONSUMED,
      String(conclusion));
});

test('a run can never consume its own opportunity',()=>{
  const self=classify(world({external:listing(
    run(4107,at(2026,8,6,9,0),[job('collect',null)]))}),{selfRunId:4107});
  assert.equal(self.classification,OPPORTUNITY_AVAILABLE);
  const other=classify(world({external:listing(
    run(4107,at(2026,8,6,9,0),[job('collect',null)]))}),{selfRunId:4108});
  assert.equal(other.classification,OPPORTUNITY_CONSUMED);
});

/* ------------------------------------ the two windows ------------------------------------ */

test('the current UTC day rule admits every collection since midnight UTC',()=>{
  const midnight=Date.UTC(2026,8,6,23,50,0);
  const dayStart=opportunityWindowStart(midnight);
  assert.equal(dayStart,Date.UTC(2026,8,6,0,0,0));
  // At 23:50 the trailing six hours reaches only 17:50, so the calendar day is the wider rule and
  // a collection at 01:17 that morning still consumes.
  assert.equal(classifyOpportunity({workflows:world({scheduled:listing(
    run(4201,at(2026,8,6,1,17),[job('collect','success')]))}),now:midnight}).classification,
    OPPORTUNITY_CONSUMED);
});

test('the trailing six-hour rule closes the UTC-midnight duplicate hole',()=>{
  assert.equal(OPPORTUNITY_TRAILING_WINDOW_MS,6*60*60*1000);
  // 00:03 UTC on 7 September. The calendar day alone would call this a fresh opportunity even
  // though a late run collected five minutes earlier, at 23:58 on the 6th.
  const justAfterMidnight=Date.UTC(2026,8,7,0,3,0);
  assert.equal(opportunityWindowStart(justAfterMidnight),Date.UTC(2026,8,6,18,3,0));
  const late=world({scheduled:listing(run(4202,at(2026,8,6,23,58),[job('collect','success')]))});
  assert.equal(classifyOpportunity({workflows:late,now:justAfterMidnight}).classification,
    OPPORTUNITY_CONSUMED);
  // A collection older than both rules leaves the day available.
  const yesterday=world({scheduled:listing(run(4203,at(2026,8,6,1,17),[job('collect','success')]))});
  assert.equal(classifyOpportunity({workflows:yesterday,now:justAfterMidnight}).classification,
    OPPORTUNITY_AVAILABLE);
  // The window is the union of the two rules, never the intersection.
  assert.equal(opportunityWindowStart(NOW),Math.min(Date.UTC(2026,8,6),NOW-OPPORTUNITY_TRAILING_WINDOW_MS));
  assert.equal(opportunityWindowDate(justAfterMidnight),'2026-09-06');
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
    world({scheduled:listing(run(1,at(2026,8,6,1,17),[{name:7,conclusion:null}]))}),
    world({scheduled:listing(run(1,at(2026,8,6,1,17),[{name:'collect',conclusion:5}]))})];
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
  for(const workflows of [world(),world({manual:listing(run(1,at(2026,8,6,2,0),[job('collect','success')]))}),
    world({scheduled:listing(run(2,at(2026,8,6,2,0),[job('collect','success')]))}),null])
    assert.ok(OPPORTUNITY_REASONS.includes(classify(workflows).reason));
});

/* ---------------------------- bounded, read-only resolution ---------------------------- */

const ok=body=>({status:200,json:async()=>body});
const runsBody=(...rows)=>({total_count:rows.length,workflow_runs:rows});
const jobsBody=(...rows)=>({total_count:rows.length,jobs:rows});

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
    ['/actions/runs/71/jobs',ok(jobsBody({name:'repository-gate',conclusion:'success'},
      {name:'collect',conclusion:'success'}))]].reverse());
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
  assert.ok(t.calls[0].url.includes(`created=${encodeURIComponent('>=2026-09-06')}`));
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
  const t=transport([['/jobs',ok(jobsBody({name:'repository-gate',conclusion:'failure'}))],
    ['data-s2-production-scheduled.yml/runs',ok(runsBody(...many))],['/runs',ok(runsBody())]]);
  const outcome=await resolveOpportunity({token:'t',fetchImpl:t.fetchImpl,now:NOW,maxReads:4});
  assert.equal(outcome.classification,AMBIGUOUS_REQUIRES_OWNER_ATTENTION);
  assert.equal(outcome.reason,'guard_read_bound_exhausted');
  assert.equal(t.calls.length,4);
});

test('the guard never dispatches, re-runs, cancels or writes anything',()=>{
  const source=uncommented(`${read(GUARD_MODULE_PATH)}\n${read(GUARD_ENTRY_PATH)}`);
  for(const forbidden of [/'POST'/,/"POST"/,/'PUT'/,/'PATCH'/,/'DELETE'/,/dispatches/,/workflow_dispatch/,
    /rerun/i,/re-run/i,/rerequest/i,/re-request/i,/cancel/i,/method:'(?!GET)/])
    assert.doesNotMatch(source,forbidden,String(forbidden));
  assert.equal(workflowRunsRequest('data-s2-production-external.yml','t',NOW).init.method,'GET');
  assert.equal(runJobsRequest(12,'t').init.method,'GET');
  assert.equal(runJobsRequest(12,'t').url,
    `https://api.github.com/repos/${OPPORTUNITY_GUARD_REPOSITORY}/actions/runs/12/jobs?per_page=100&filter=latest`);
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
