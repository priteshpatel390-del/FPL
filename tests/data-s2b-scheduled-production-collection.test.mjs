// DATA-S2B Stage D — the once-daily GitHub Actions production collection schedule.
//
// These are permanent trust-boundary regressions for the scheduled collection path. They prove
// the scheduled workflow's trigger, its scheduled-SHA trust model, its credential-free repository
// gate, its bounded exact-head Verify wait, its dedicated unattended environment, its second
// remote-main check, its shared serialization and no-rerun behaviour, and that none of it weakens
// the manual boundary, the collector semantics, the resource ceilings or the Cron supersession.
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {EXPECTED_D1_ROWS_READ_PER_CYCLE,MAX_D1_API_CALLS_PER_CYCLE,MAX_D1_ROWS_READ_PER_CYCLE,MAX_D1_ROWS_WRITTEN_PER_CYCLE,MAX_OFFICIAL_RESPONSE_BYTES,OFFICIAL_FPL_ENDPOINTS,PRODUCTION_COLLECTION_SCHEDULE,PRODUCTION_D1_ID,PRODUCTION_SEASON} from '../workers/data-platform/production-collection.mjs';
import {MAX_ROUTINE_CHANGED_OBSERVATIONS_PER_RUN} from '../workers/data-platform/official-fpl-d1-rest-plan.mjs';
import {EXACT_HEAD_VERIFY_CHECK_NAME,EXACT_HEAD_VERIFY_INTERVAL_MS,EXACT_HEAD_VERIFY_MAX_ATTEMPTS,VERIFY_ABSENT,VERIFY_FAILED,VERIFY_PENDING,VERIFY_SUCCESS,awaitExactHeadVerify,classifyExactHeadVerify,exactHeadVerifyRequest} from '../workers/data-platform/scheduled/exact-head-verify.mjs';

const SCHEDULED_WORKFLOW_PATH='.github/workflows/data-s2-production-scheduled.yml';
const MANUAL_WORKFLOW_PATH='.github/workflows/data-s2-production-collection.yml';
const VERIFY_MODULE_PATH='workers/data-platform/scheduled/exact-head-verify.mjs';
const VERIFY_ENTRY_PATH='workers/data-platform/scheduled/run-exact-head-verify.mjs';
const COLLECTION_ENTRY_PATH='workers/data-platform/run-production-collection.mjs';
const read=file=>fs.readFileSync(file,'utf8');
const scheduled=read(SCHEDULED_WORKFLOW_PATH);
const manual=read(MANUAL_WORKFLOW_PATH);
const uncommented=source=>source.split('\n').filter(line=>!/^\s*(#|\/\/)/.test(line)).join('\n');
const GATE_START='  repository-gate:';
const COLLECT_START='\n  collect:';
const gateBlock=()=>scheduled.slice(scheduled.indexOf(GATE_START),scheduled.indexOf(COLLECT_START));
const collectBlock=()=>scheduled.slice(scheduled.indexOf(COLLECT_START));
const COLLECT_RUN_MARKER='      - name: Reconfirm identity and remote main, then collect Official FPL to D1 REST';
const GATE_RUN_MARKER='      - name: Gate exact current main and clean tree';

// The exact shell of one named `run: |` step, dedented so it can be executed against stubs.
function stepScript(marker){
  const start=scheduled.indexOf(marker);
  assert.ok(start>0,marker);
  const body=scheduled.slice(scheduled.indexOf('run: |',start)+'run: |\n'.length).split('\n');
  const script=[];
  for(const line of body){
    if(line.trim()===''){script.push('');continue;}
    if(!line.startsWith('          '))break;
    script.push(line.slice(10));
  }
  return script.join('\n').trimEnd();
}

/* --------------------------- trigger and workflow separation --------------------------- */

test('the scheduled workflow exists and carries exactly one schedule trigger at 17 1 * * *',()=>{
  assert.ok(fs.existsSync(SCHEDULED_WORKFLOW_PATH));
  assert.match(scheduled,/^name: DATA-S2 Scheduled Production Collection via D1 REST$/m);
  const trigger=scheduled.slice(scheduled.indexOf('\non:'),scheduled.indexOf('\npermissions:'));
  assert.equal(trigger.trim(),"on:\n  schedule:\n    - cron: '17 1 * * *'");
  assert.equal([...scheduled.matchAll(/^\s*- cron:/gm)].length,1);
  assert.equal([...scheduled.matchAll(/^  schedule:$/gm)].length,1);
  // One daily opportunity only, from the single wired repository constant.
  assert.equal(PRODUCTION_COLLECTION_SCHEDULE,'17 1 * * *');
  assert.ok(scheduled.includes(`- cron: '${PRODUCTION_COLLECTION_SCHEDULE}'`));
});

test('no other event can trigger the scheduled production collection',()=>{
  for(const forbidden of [/workflow_dispatch/,/^\s{2}push:/m,/^\s{2}pull_request:/m,/pull_request_target/,
    /workflow_call/,/repository_dispatch/,/^\s{2}issues:/m,/^\s{2}release:/m,/workflow_run/])
    assert.doesNotMatch(uncommented(scheduled),forbidden,String(forbidden));
  assert.match(scheduled,/if: github\.event_name == 'schedule'/);
  assert.doesNotMatch(scheduled,/github\.event_name == '(?:workflow_dispatch|push|pull_request)'/);
});

test('the scheduled workflow accepts no input of any kind',()=>{
  assert.doesNotMatch(uncommented(scheduled),/^\s*inputs:/m);
  assert.equal([...scheduled.matchAll(/inputs\./g)].length,0);
  assert.equal([...scheduled.matchAll(/github\.event\.inputs/g)].length,0);
  // No production semantics may be supplied: no SHA, timestamp, season, database, endpoint or SQL
  // may enter as a value the caller chooses.
  for(const forbidden of [/approved_sha/,/sql/i,/database_id/i,/run_id/i,/COLLECTION_SCHEDULED_AT: /,
    /DATA_S2_SEASON: \$\{\{/,/endpoint/i])
    assert.doesNotMatch(uncommented(scheduled),forbidden,String(forbidden));
});

test('the manual workflow stays workflow_dispatch-only, human-approved and unmodified in shape',()=>{
  const trigger=manual.slice(manual.indexOf('on:'),manual.indexOf('\npermissions:'));
  assert.match(trigger,/^on:\n  workflow_dispatch:\n    inputs:\n      approved_sha:/m);
  assert.doesNotMatch(trigger,/schedule:|cron:/);
  assert.doesNotMatch(manual,/^\s{2}(?:push|pull_request|pull_request_target|schedule|repository_dispatch):/m);
  assert.match(manual,/environment:\n      name: data-s2-production-collection/);
  assert.ok(!manual.includes(PRODUCTION_COLLECTION_SCHEDULE));
  assert.ok(!manual.includes('data-s2-production-scheduled'));
  // The two workflows are separate files; the scheduled one never reuses the manual environment.
  assert.ok(!collectBlock().includes('name: data-s2-production-collection\n'));
});

/* ----------------------------- scheduled SHA trust model ----------------------------- */

test('the scheduled event itself is the only source of the immutable candidate SHA',()=>{
  const gate=gateBlock();
  for(const required of [
    'SCHEDULED_SHA: ${{ github.sha }}',
    'EVENT_SCHEDULE: ${{ github.event.schedule }}',
    'test "$EVENT_NAME" = schedule',
    "test \"$EVENT_SCHEDULE\" = '17 1 * * *'",
    'test "$EVENT_REF" = refs/heads/main',
    'test "$EVENT_REPOSITORY" = priteshpatel390-del/FPL',
    "printf '%s' \"$SCHEDULED_SHA\" | grep -Eq '^[0-9a-f]{40}$'",
    'ref: ${{ github.sha }}',
    'test "$(git rev-parse HEAD)" = "$SCHEDULED_SHA"',
    'test "$remote_main" = "$SCHEDULED_SHA"',
    'test -z "$(git status --porcelain)"'])
    assert.ok(gate.includes(required),required);
  // Never a floating ref, never a newer commit, never "latest successful build".
  assert.doesNotMatch(scheduled,/ref: main\b/);
  assert.doesNotMatch(uncommented(scheduled),/git (?:pull|merge|checkout main)/);
  assert.deepEqual([...uncommented(scheduled).matchAll(/^\s*ref: (.+)$/gm)].map(row=>row[1]),
    ['${{ github.sha }}','${{ needs.repository-gate.outputs.scheduled_sha }}']);
});

test('remote main is proved by the gate and independently again under production credentials',()=>{
  const resolve=/remote_main="\$\(git ls-remote https:\/\/github\.com\/priteshpatel390-del\/FPL\.git refs\/heads\/main \| cut -f1\)"/;
  assert.match(gateBlock(),resolve);
  assert.equal([...scheduled.matchAll(new RegExp(resolve.source,'g'))].length,2);
  // The second resolution is never a value carried between jobs.
  assert.doesNotMatch(scheduled,/outputs:[\s\S]{0,400}remote_main/);
  const lines=stepScript(COLLECT_RUN_MARKER).split('\n').map(line=>line.trim()).filter(Boolean);
  assert.equal(lines.at(-1),'node workers/data-platform/run-production-collection.mjs');
  assert.equal(lines.at(-2),'test "$remote_main" = "$SCHEDULED_SHA"');
  assert.equal(lines.at(-3),'test -n "$remote_main"');
  assert.match(lines.at(-4),/^remote_main="\$\(git ls-remote /);
  assert.equal(lines[0],'set -euo pipefail');
  assert.ok(lines.includes('test "$(node --version)" = v24.19.0'));
  assert.ok(lines.includes('test "$(git rev-parse HEAD)" = "$SCHEDULED_SHA"'));
  assert.ok(lines.includes('test -z "$(git status --porcelain)"'));
  assert.ok(lines.some(line=>line.startsWith('rm -f node_modules/.bin/wrangler')));
  assert.ok(lines.some(line=>line.startsWith('rm -rf node_modules/wrangler')));
  // Nothing before the recheck reaches Cloudflare.
  assert.ok(!lines.slice(0,-1).some(line=>/cloudflare|api\.cloudflare|curl/i.test(line)));
});

/* ------------------- executable proof of both fail-closed identity shells ------------------- */

// Runs one workflow shell against stubbed `git` and `node` binaries and reports whether the
// production runner was reached.
function runShell(script,{shaVariable,liveMain,head,dirty=false}={}){
  const approved='0123456789abcdef0123456789abcdef01234567';
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'scheduled-gate-'));
  const bin=path.join(dir,'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin,'node'),`#!/bin/sh\nif [ "$1" = "--version" ]; then echo v24.19.0; exit 0; fi\necho "$@" > "${dir}/invoked"\nprintenv COLLECTION_SCHEDULED_AT > "${dir}/scheduled"\nexit 0\n`,{mode:0o755});
  fs.writeFileSync(path.join(bin,'git'),`#!/bin/sh\ncase "$1" in\n  rev-parse) echo ${head??approved};;\n  status) ${dirty?"echo ' M src/app.mjs'":':'} ;;\n  ls-remote) printf '%s\\trefs/heads/main\\n' ${liveMain??approved};;\n  *) exit 1;;\nesac\nexit 0\n`,{mode:0o755});
  const out=spawnSync('bash',['-c',script],{cwd:dir,encoding:'utf8',
    env:{PATH:`${bin}:${process.env.PATH}`,[shaVariable]:approved,GITHUB_OUTPUT:path.join(dir,'out')}});
  const invoked=fs.existsSync(path.join(dir,'invoked'));
  const scheduledPath=path.join(dir,'scheduled');
  const stamp=fs.existsSync(scheduledPath)?fs.readFileSync(scheduledPath,'utf8').trim():null;
  fs.rmSync(dir,{recursive:true,force:true});
  return {status:out.status,invoked,stamp};
}

test('a moved main, a wrong head or a dirty tree stops the scheduled production runner',()=>{
  const script=stepScript(COLLECT_RUN_MARKER);
  const pass=runShell(script,{shaVariable:'SCHEDULED_SHA'});
  assert.equal(pass.status,0);
  assert.equal(pass.invoked,true);
  // Minute-precision UTC collection identity, fixed inside this one shell from the runner clock.
  assert.match(pass.stamp,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
  for(const blocked of [{liveMain:'fedcba9876543210fedcba9876543210fedcba98'},{liveMain:"''"},
    {head:'fedcba9876543210fedcba9876543210fedcba98'},{dirty:true}]){
    const out=runShell(script,{shaVariable:'SCHEDULED_SHA',...blocked}),label=JSON.stringify(blocked);
    assert.notEqual(out.status,0,label);
    assert.equal(out.invoked,false,label);
  }
});

test('the credential-free gate shell also fails closed on a moved main, wrong head or dirty tree',()=>{
  const script=stepScript(GATE_RUN_MARKER);
  assert.equal(runShell(script,{shaVariable:'SCHEDULED_SHA'}).status,0);
  for(const blocked of [{liveMain:'fedcba9876543210fedcba9876543210fedcba98'},{liveMain:"''"},
    {head:'fedcba9876543210fedcba9876543210fedcba98'},{dirty:true}])
    assert.notEqual(runShell(script,{shaVariable:'SCHEDULED_SHA',...blocked}).status,0,JSON.stringify(blocked));
});

test('the one attempt collection identity is fixed once, after every repository identity check',()=>{
  assert.equal([...scheduled.matchAll(/COLLECTION_SCHEDULED_AT=/g)].length,1);
  // No earlier, mutable stage may establish production identity through the job environment.
  assert.doesNotMatch(scheduled,/GITHUB_ENV/);
  const lines=stepScript(COLLECT_RUN_MARKER).split('\n').map(line=>line.trim()).filter(Boolean);
  assert.ok(lines.includes('COLLECTION_SCHEDULED_AT="$(date -u +%Y-%m-%dT%H:%M:00.000Z)"'));
  assert.ok(lines.includes('export COLLECTION_SCHEDULED_AT'));
  assert.ok(lines.includes('test -n "$COLLECTION_SCHEDULED_AT"'));
  const stamp=lines.indexOf('COLLECTION_SCHEDULED_AT="$(date -u +%Y-%m-%dT%H:%M:00.000Z)"');
  assert.ok(stamp>lines.indexOf('test "$(git rev-parse HEAD)" = "$SCHEDULED_SHA"'));
  assert.ok(stamp<lines.findIndex(line=>line.startsWith('remote_main=')));
  // The nominal cron minute is never used as the collection instant.
  assert.ok(!lines.some(line=>line.includes('01:17')||line.includes('github.event.schedule')));
  assert.ok(read(COLLECTION_ENTRY_PATH).includes("required('COLLECTION_SCHEDULED_AT')"));
});

/* --------------------------- credential-free repository gate --------------------------- */

test('the repository gate holds no environment, credential, fingerprint or database identity',()=>{
  const gate=gateBlock();
  assert.doesNotMatch(gate,/environment:|secrets\.CLOUDFLARE|CLOUDFLARE_|vars\./);
  assert.ok(!gate.includes(PRODUCTION_D1_ID));
  assert.match(scheduled,/permissions:\n  contents: read\n  checks: read/);
  assert.equal([...scheduled.matchAll(/^permissions:$/gm)].length,1);
  // The gate's only credential is the job's own GitHub token, used read-only.
  assert.ok(gate.includes('GH_TOKEN: ${{ github.token }}'));
  assert.equal([...gate.matchAll(/secrets\./g)].length,0);
});

test('the protected production job exists only after the gate and runs exactly the gated SHA',()=>{
  assert.ok(scheduled.indexOf(GATE_START)<scheduled.indexOf(COLLECT_START));
  assert.match(scheduled,/\n  collect:\n    needs: repository-gate/);
  const collect=collectBlock();
  assert.match(collect,/environment:\n      name: data-s2-production-scheduled/);
  assert.match(collect,/ref: \$\{\{ needs\.repository-gate\.outputs\.scheduled_sha \}\}/);
  assert.match(collect,/SCHEDULED_SHA: \$\{\{ needs\.repository-gate\.outputs\.scheduled_sha \}\}/);
  assert.match(scheduled,/node-version: 24\.19\.0/);
  assert.equal([...scheduled.matchAll(/node-version: /g)].length,2);
});

test('production identifier masking is registered before any variable is materialised',()=>{
  const steps=collectBlock().split('\n      - name: ').slice(1);
  assert.match(steps[0],/^Register production identifier masks before any other step/);
  assert.ok(steps[0].includes("printf '::add-mask::%s\\n'"));
  const fingerprintSteps=steps.filter(step=>step.includes('CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT'));
  assert.equal(fingerprintSteps.length,1);
  assert.equal(fingerprintSteps[0],steps.at(-1));
  assert.equal([...uncommented(scheduled).matchAll(/vars\./g)].length,1);
  // Neither the workflow nor the job env carries the fingerprint or any D1 identifier, and the
  // reviewed production database constant never reaches a workflow or environment value.
  const collect=collectBlock();
  const jobEnv=collect.slice(collect.indexOf('    env:'),collect.indexOf('    steps:'));
  assert.doesNotMatch(jobEnv,/FINGERPRINT|D1_ID|vars\./);
  assert.doesNotMatch(scheduled,/CLOUDFLARE_PRODUCTION_D1_ID/);
  assert.ok(!scheduled.includes(PRODUCTION_D1_ID));
  assert.match(read(COLLECTION_ENTRY_PATH),/maskProductionIdentity\(resolveProductionIdentity\(process\.env\)\)/);
});

/* ------------------------ bounded exact-head Verify wait ------------------------ */

const checkRun=(overrides={})=>({name:EXACT_HEAD_VERIFY_CHECK_NAME,status:'completed',conclusion:'success',
  head_sha:'a'.repeat(40),app:{slug:'github-actions'},
  details_url:'https://github.com/priteshpatel390-del/FPL/actions/runs/1',...overrides});
const sha='a'.repeat(40);
const body=runs=>({status:200,json:async()=>({check_runs:runs})});
function waiter(pages){
  const sleeps=[];let calls=0;
  const fetchImpl=async()=>{const page=pages[Math.min(calls,pages.length-1)];calls+=1;return page;};
  return {sleeps,fetchImpl,calls:()=>calls,sleep:async ms=>{sleeps.push(ms);}};
}

test('an exact-head success proceeds immediately and needs no wait',async()=>{
  const w=waiter([body([checkRun()])]);
  const result=await awaitExactHeadVerify({sha,token:'t',fetchImpl:w.fetchImpl,sleep:w.sleep});
  assert.deepEqual({...result},{classification:VERIFY_SUCCESS,attempts:1});
  assert.equal(w.calls(),1);
  assert.deepEqual(w.sleeps,[]);
});

test('a pending exact-head check may be waited for, but only inside the fixed bound',async()=>{
  const pending=body([checkRun({status:'in_progress',conclusion:null})]);
  const late=waiter([pending,pending,body([checkRun()])]);
  const result=await awaitExactHeadVerify({sha,token:'t',fetchImpl:late.fetchImpl,sleep:late.sleep});
  assert.equal(result.classification,VERIFY_SUCCESS);
  assert.equal(result.attempts,3);
  assert.deepEqual(late.sleeps,[EXACT_HEAD_VERIFY_INTERVAL_MS,EXACT_HEAD_VERIFY_INTERVAL_MS]);
  // Exhausting the bound stops; it never polls indefinitely.
  const stuck=waiter([pending]);
  await assert.rejects(awaitExactHeadVerify({sha,token:'t',fetchImpl:stuck.fetchImpl,sleep:stuck.sleep,maxAttempts:3}),
    /verify_check_wait_exhausted/);
  assert.equal(stuck.calls(),3);
  assert.deepEqual(stuck.sleeps,[EXACT_HEAD_VERIFY_INTERVAL_MS,EXACT_HEAD_VERIFY_INTERVAL_MS]);
  // A caller can narrow the bound but never widen it.
  for(const bad of [0,-1,1.5,EXACT_HEAD_VERIFY_MAX_ATTEMPTS+1])
    await assert.rejects(awaitExactHeadVerify({sha,token:'t',fetchImpl:stuck.fetchImpl,sleep:stuck.sleep,maxAttempts:bad}),
      /verify_wait_bound_invalid/);
});

test('a failed, cancelled, absent or wrong-SHA exact-head check stops the scheduled run',async()=>{
  for(const conclusion of ['failure','cancelled','timed_out','action_required','neutral','skipped',null]){
    const w=waiter([body([checkRun({conclusion})])]);
    await assert.rejects(awaitExactHeadVerify({sha,token:'t',fetchImpl:w.fetchImpl,sleep:w.sleep}),/verify_check_failed/);
    assert.equal(w.calls(),1,String(conclusion));
    assert.deepEqual(w.sleeps,[]);
  }
  for(const wrong of [[],[checkRun({head_sha:'b'.repeat(40)})],[checkRun({name:'Other check'})],
    [checkRun({app:{slug:'some-app'}})],[checkRun({details_url:'https://github.com/other/repo/actions/runs/1'})]]){
    const w=waiter([body(wrong)]);
    await assert.rejects(awaitExactHeadVerify({sha,token:'t',fetchImpl:w.fetchImpl,sleep:w.sleep,maxAttempts:2}),
      /verify_check_absent/);
    assert.equal(w.calls(),2);
  }
  const http=waiter([{status:500,json:async()=>({})}]);
  await assert.rejects(awaitExactHeadVerify({sha,token:'t',fetchImpl:http.fetchImpl,sleep:http.sleep}),/verify_check_http_failed/);
  for(const malformed of [{},{check_runs:null},{check_runs:'many'}])
    assert.throws(()=>classifyExactHeadVerify(malformed,sha),/verify_check_contract_invalid/);
  for(const badSha of ['','A'.repeat(40),'a'.repeat(39),'main',null])
    assert.throws(()=>classifyExactHeadVerify({check_runs:[]},badSha),/scheduled_sha_invalid/);
});

test('the exact-head classification is exhaustive and success requires an exact completed pass',()=>{
  assert.equal(classifyExactHeadVerify({check_runs:[checkRun()]},sha),VERIFY_SUCCESS);
  assert.equal(classifyExactHeadVerify({check_runs:[checkRun({status:'queued',conclusion:null})]},sha),VERIFY_PENDING);
  assert.equal(classifyExactHeadVerify({check_runs:[checkRun({conclusion:'failure'})]},sha),VERIFY_FAILED);
  assert.equal(classifyExactHeadVerify({check_runs:[]},sha),VERIFY_ABSENT);
  // A completed success on this exact head is proof even beside an earlier failed attempt.
  assert.equal(classifyExactHeadVerify({check_runs:[checkRun({conclusion:'failure'}),checkRun()]},sha),VERIFY_SUCCESS);
  // A success on a different commit is never evidence for this one.
  assert.equal(classifyExactHeadVerify({check_runs:[checkRun({head_sha:'c'.repeat(40)})]},sha),VERIFY_ABSENT);
});

test('the Verify wait is strictly read-only: it never dispatches, re-runs or re-requests anything',()=>{
  const request=exactHeadVerifyRequest(sha,'token');
  assert.equal(request.init.method,'GET');
  assert.equal(request.url,`https://api.github.com/repos/priteshpatel390-del/FPL/commits/${sha}/check-runs?per_page=100`);
  const source=`${read(VERIFY_MODULE_PATH)}\n${read(VERIFY_ENTRY_PATH)}`;
  for(const forbidden of [/'POST'/,/"POST"/,/rerun/i,/re-request/i,/rerequest/i,/dispatches/,/workflow_dispatch/,
    /method:'(?!GET)/,/cancel/i])
    assert.doesNotMatch(uncommented(source),forbidden,String(forbidden));
  assert.equal([...uncommented(source).matchAll(/https:\/\/api\.github\.com/g)].length,1);
  assert.doesNotMatch(uncommented(source),/cloudflare|CLOUDFLARE/);
  // The gate step invokes exactly this entry point and nothing else.
  assert.ok(gateBlock().includes('node workers/data-platform/scheduled/run-exact-head-verify.mjs'));
  assert.deepEqual([...uncommented(scheduled).matchAll(/node workers\/data-platform\/[a-z0-9/-]+\.mjs/g)].map(row=>row[0]),
    ['node workers/data-platform/scheduled/run-exact-head-verify.mjs',
     'node workers/data-platform/run-production-collection.mjs']);
});

/* --------------------- serialization, re-runs and unchanged contracts --------------------- */

test('scheduled and manual collection share one non-cancelling production concurrency group',()=>{
  assert.match(scheduled,/concurrency:\n  group: data-s2-production-collection\n  cancel-in-progress: false/);
  assert.match(manual,/concurrency:\n  group: data-s2-production-collection\n  cancel-in-progress: false/);
  assert.match(read('.github/workflows/data-s2-production-resume.yml'),/group: data-s2-production-collection\n  cancel-in-progress: false/);
  assert.equal([...scheduled.matchAll(/^concurrency:$/gm)].length,1);
  assert.doesNotMatch(scheduled,/group: data-s2-production-scheduled/);
});

test('a scheduled production collection refuses a GitHub re-run before any identity or request',()=>{
  const entry=uncommented(read(COLLECTION_ENTRY_PATH));
  assert.match(entry,/GITHUB_RUN_ATTEMPT!=='1'\)throw new Error\('workflow_retry_forbidden'\)/);
  assert.ok(entry.indexOf('GITHUB_RUN_ATTEMPT')<entry.indexOf('resolveProductionIdentity(process.env)'));
  assert.ok(entry.indexOf('resolveProductionIdentity(process.env)')<entry.indexOf('runProductionCollection({'));
  // Nothing retries, repairs or completes an unclassified run, and the stopped classification is
  // still reported rather than a silent no-write.
  assert.doesNotMatch(entry,/for\s*\(|while\s*\(|setTimeout/);
  assert.equal([...entry.matchAll(/runProductionCollection\(/g)].length,1);
  assert.match(entry,/productionFailureClassification\(error\)/);
  assert.match(entry,/DATA-S2 production collection STOPPED/);
  // No workflow retries or reruns the collection either.
  assert.doesNotMatch(uncommented(scheduled),/rerun|retry|continue-on-error/i);
});

test('the scheduled path uses the same collector and the same unchanged resource ceilings',()=>{
  assert.equal(MAX_D1_API_CALLS_PER_CYCLE,8);
  assert.equal(EXPECTED_D1_ROWS_READ_PER_CYCLE,100000);
  assert.equal(MAX_D1_ROWS_READ_PER_CYCLE,125000);
  assert.equal(MAX_D1_ROWS_WRITTEN_PER_CYCLE,40000);
  assert.equal(MAX_ROUTINE_CHANGED_OBSERVATIONS_PER_RUN,4000);
  assert.equal(MAX_OFFICIAL_RESPONSE_BYTES,8*1024*1024);
  assert.equal(PRODUCTION_SEASON,'2026-27');
  assert.deepEqual([...OFFICIAL_FPL_ENDPOINTS],['https://fantasy.premierleague.com/api/bootstrap-static/',
    'https://fantasy.premierleague.com/api/fixtures/']);
  // There is no scheduled fast path: both workflows invoke the identical entry point, and the
  // scheduled workflow declares the same season the repository constant fixes.
  assert.ok(scheduled.includes('node workers/data-platform/run-production-collection.mjs'));
  assert.ok(manual.includes('node workers/data-platform/run-production-collection.mjs'));
  assert.ok(scheduled.includes(`DATA_S2_SEASON: '${PRODUCTION_SEASON}'`));
  const collector=read('workers/data-platform/production-collection.mjs');
  assert.match(collector,/validateProductionPostflight/);
  assert.doesNotMatch(collector,/SCHEDULED_SHA|github\.event|process\.env/);
});

test('the Stage D record states the schedule, the live acceptance and the owner environment gate',()=>{
  const record=read('workers/data-platform/DATA-S2B-GITHUB-ACTIONS-DAILY-SCHEDULE.md');
  for(const required of ['17 1 * * *','33818972728','319dfddd8ac83ae5ab7d20bfb684d3760bf64fbf',
    'data-s2-production-scheduled','data-s2-production-collection',
    'CLOUDFLARE_D1_TOKEN','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT',
    'first natural scheduled','Merging this checkpoint activates the schedule'])
    assert.ok(record.includes(required),required);
  // Dashboard aggregates must never be stated as exact provider accounting.
  assert.match(record,/approximately 32k rows read, 375 rows written and 10 queries/);
  assert.match(record,/not exact per-workflow provider\naccounting/);
  assert.doesNotMatch(record,/used exactly 32k|exactly 375 writes/);
  // Cloudflare Cron stays superseded, and the historical Worker records say so at the top.
  for(const historical of ['workers/data-platform/DATA-S2B-PHASE-4A-CADENCE-PREPARATION.md',
    'workers/data-platform/DATA-S2B-PHASE-4B-CRON-ACTIVATION-PREPARATION.md'])
    assert.match(read(historical).slice(0,1200),/Historical design only — superseded/,historical);
  assert.ok(read('CLAUDE.md').includes('(workers/data-platform/DATA-S2B-GITHUB-ACTIONS-DAILY-SCHEDULE.md)'));
});

test('the scheduled workflow adds no Cron, Wrangler, deployment, migration or provider surface',()=>{
  const body=uncommented(scheduled);
  for(const forbidden of [/run-migration-0003/,/run-production-resume/,/run-first-run-reconciliation/,
    /run-production-explain/,/phase4b/i,/phase-4b/i,/wrangler deploy/,/wrangler triggers/,/versions/,
    /deployments/,/secrets:\s*inherit/,/understat/i,/odds/i,/migrations\//])
    assert.doesNotMatch(body,forbidden,String(forbidden));
  for(const line of body.split('\n').filter(line=>/wrangler/i.test(line)))
    assert.match(line.trim(),/^rm -(f|rf) /,line);
  // The only network host this workflow itself contacts is GitHub; the gate's read-only check-run
  // reads are the module's single api.github.com call, proved separately above.
  assert.deepEqual([...new Set([...body.matchAll(/https:\/\/([a-z.]+)\//g)].map(row=>row[1]))].sort(),
    ['github.com']);
  // Cloudflare Cron stays superseded: the historical Worker declaration is untouched and is not
  // referenced by any collection workflow.
  assert.match(read('workers/data-platform/wrangler.jsonc'),/"crons": \["\*\/30 \* \* \* \*"\]/);
  assert.ok(!body.includes('wrangler.jsonc'));
  assert.doesNotMatch(body,/\*\/30 \* \* \* \*/);
  assert.doesNotMatch(body,/'0 1 \* \* \*'/);
});
