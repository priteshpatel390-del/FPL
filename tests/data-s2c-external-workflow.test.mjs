// DATA-S2C — permanent regressions for the externally triggered production collection workflow.
//
// Workflow B is a second unattended path into the same production collection, so its trust
// boundary has to match the scheduled path's rather than approximate it. These tests hold its
// trigger and zero-input surface, its exact permissions, its credential-free gate, its
// exact-main and clean-tree proofs, its bounded exact-head Verify wait through the unchanged
// module, its opportunity guard, its dedicated unattended environment, the shared production
// concurrency group, the second remote-main check in the same shell as the runner, the shared
// no-rerun refusal and the completely unchanged collector, entry point and resource envelope.
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import {EXPECTED_D1_ROWS_READ_PER_CYCLE,MAX_D1_API_CALLS_PER_CYCLE,MAX_D1_ROWS_READ_PER_CYCLE,
  MAX_D1_ROWS_WRITTEN_PER_CYCLE,MAX_OFFICIAL_RESPONSE_BYTES,OFFICIAL_FPL_ENDPOINTS,
  PRODUCTION_COLLECTION_SCHEDULE,PRODUCTION_D1_ID,PRODUCTION_SEASON,PROVIDER_READ_AMPLIFICATION,
  PROVIDER_READ_SAFETY_RESERVE,SOFT_D1_ROWS_READ_PER_CYCLE}
  from '../workers/data-platform/production-collection.mjs';
import {MAX_ROUTINE_CHANGED_OBSERVATIONS_PER_RUN}
  from '../workers/data-platform/official-fpl-d1-rest-plan.mjs';

const EXTERNAL_WORKFLOW_PATH='.github/workflows/data-s2-production-external.yml';
const MANUAL_WORKFLOW_PATH='.github/workflows/data-s2-production-collection.yml';
const COLLECTION_ENTRY_PATH='workers/data-platform/run-production-collection.mjs';
const COLLECTOR_PATH='workers/data-platform/production-collection.mjs';
const PLATFORM_CONFIG_PATH='workers/data-platform/wrangler.jsonc';
const read=file=>fs.readFileSync(file,'utf8');
const external=read(EXTERNAL_WORKFLOW_PATH);
const uncommented=source=>source.split('\n').filter(line=>!/^\s*(#|\/\/)/.test(line)).join('\n');
const GATE_START='  repository-gate:';
const COLLECT_START='\n  collect:';
const gateBlock=()=>external.slice(external.indexOf(GATE_START),external.indexOf(COLLECT_START));
const collectBlock=()=>external.slice(external.indexOf(COLLECT_START));
const COLLECT_RUN_MARKER='      - name: Reconfirm identity and remote main, then collect Official FPL to D1 REST';
const GATE_RUN_MARKER='      - name: Gate exact current main and clean tree';
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// GitHub Actions permissions are INHERITED: a job that declares no `permissions:` block runs with
// the workflow-level block. Reading the absence of a job-level block as an absence of permission is
// exactly the mistake this helper exists to make impossible. It resolves a job's EFFECTIVE scope —
// the job's own block when it has one, otherwise the workflow-level default.
function permissionsBlock(source,indent){
  const marker=`\n${indent}permissions:\n`;
  const start=source.indexOf(marker);
  if(start<0)return null;
  const scopes={};
  for(const line of source.slice(start+marker.length).split('\n')){
    const match=line.match(/^\s*([a-z-]+): (read|write|none)$/);
    if(!match||!line.startsWith(`${indent}  `))break;
    scopes[match[1]]=match[2];
  }
  return scopes;
}

function effectivePermissions(source,jobBlock){
  const workflowLevel=permissionsBlock(source,'');
  const jobLevel=permissionsBlock(jobBlock,'    ');
  assert.ok(workflowLevel!==null,'a workflow-level permissions block must exist');
  return jobLevel===null?workflowLevel:jobLevel;
}

function stepScript(source,marker){
  const start=source.indexOf(marker);
  assert.ok(start>0,marker);
  const body=source.slice(source.indexOf('run: |',start)+'run: |\n'.length).split('\n');
  const script=[];
  for(const line of body){
    if(line.trim()===''){script.push('');continue;}
    if(!line.startsWith('          '))break;
    script.push(line.slice(10));
  }
  return script.join('\n').trimEnd();
}

/* --------------------------------- trigger and input surface --------------------------------- */

test('workflow B exists and is workflow_dispatch-only with zero inputs',()=>{
  assert.ok(fs.existsSync(EXTERNAL_WORKFLOW_PATH));
  assert.match(external,/^name: DATA-S2 External Production Collection via D1 REST$/m);
  const body=uncommented(external);
  const trigger=body.slice(body.indexOf('\non:'),body.indexOf('\npermissions:'));
  assert.equal(trigger.trim(),'on:\n  workflow_dispatch:');
  for(const forbidden of [/^\s{2}schedule:/m,/cron:/,/^\s{2}push:/m,/^\s{2}pull_request:/m,
    /pull_request_target/,/repository_dispatch/,/workflow_call/,/workflow_run/,/^\s{2}release:/m,
    /^\s{2}issues:/m])
    assert.doesNotMatch(uncommented(external),forbidden,String(forbidden));
  // Zero inputs. A caller supplies the ref and nothing else; no SHA, timestamp, season, database,
  // endpoint, SQL or statement may enter as a value the caller chooses.
  assert.doesNotMatch(uncommented(external),/^\s*inputs:/m);
  assert.equal([...external.matchAll(/inputs\./g)].length,0);
  assert.equal([...external.matchAll(/github\.event\.inputs/g)].length,0);
  for(const forbidden of [/approved_sha/,/sql/i,/database_id/i,/run_id/i,/COLLECTION_SCHEDULED_AT: /,
    /DATA_S2_SEASON: \$\{\{/,/endpoint/i])
    assert.doesNotMatch(uncommented(external),forbidden,String(forbidden));
});

test('workflow B declares exactly the permissions it needs and no more',()=>{
  // The workflow-level default is the scope every job inherits when it declares none, so the
  // Actions read scope must not live here.
  assert.match(external,/^permissions:\n  contents: read\n  checks: read\n\n/m);
  assert.deepEqual(permissionsBlock(external,''),{contents:'read',checks:'read'});
  for(const forbidden of [/contents: write/,/actions: write/,/packages:/,/id-token:/,/pull-requests:/,
    /issues: write/,/deployments:/])
    assert.doesNotMatch(uncommented(external),forbidden,String(forbidden));
});

// EFFECTIVE permissions, not declared ones. A job with no `permissions:` block inherits the
// workflow-level block, so proving that the credentialled job simply lacks a block would prove
// nothing at all about what it can reach.
test('workflow B grants the Actions read scope to the credential-free gate alone',()=>{
  const gate=effectivePermissions(external,gateBlock());
  const collect=effectivePermissions(external,collectBlock());
  // The daily opportunity guard and the bounded Verify wait read Actions run and job metadata.
  assert.deepEqual(gate,{contents:'read',checks:'read',actions:'read'});
  assert.equal(gate.actions,'read');
  // The credentialled production job reads no Actions metadata and holds no `GH_TOKEN`.
  assert.deepEqual(collect,{contents:'read',checks:'read'});
  assert.equal(collect.actions,undefined);
  assert.ok(!('actions' in collect));
  // Declared explicitly on the job rather than inherited, so the scope cannot widen silently if
  // the workflow-level default ever changes again.
  assert.match(collectBlock(),/^    permissions:\n      contents: read\n      checks: read$/m);
  // No effective write scope anywhere in workflow B.
  for(const scopes of [gate,collect])
    for(const [name,level] of Object.entries(scopes))
      assert.equal(level,'read',`${name} must be read-only`);
  assert.doesNotMatch(uncommented(collectBlock()),
    /GH_TOKEN|github\.token|actions\/runs|api\.github\.com/);
});

test('workflow B is a separate file and never reuses the attended manual boundary',()=>{
  const manual=read(MANUAL_WORKFLOW_PATH);
  assert.notEqual(EXTERNAL_WORKFLOW_PATH,MANUAL_WORKFLOW_PATH);
  assert.ok(!external.includes('name: data-s2-production-collection\n'));
  assert.match(manual,/environment:\n      name: data-s2-production-collection/);
  // The manual workflow is untouched by DATA-S2C.
  assert.doesNotMatch(manual,/external|opportunity|dispatcher/i);
  assert.ok(!manual.includes(PRODUCTION_COLLECTION_SCHEDULE));
  // Retired workflow A is absent, so GitHub carries no automatic production clock.
  assert.ok(!fs.existsSync('.github/workflows/data-s2-production-scheduled.yml'));
  const scheduledWorkflows=fs.readdirSync('.github/workflows').filter(name=>/\.ya?ml$/.test(name))
    .filter(name=>/^\s*- cron:/m.test(read(`.github/workflows/${name}`)));
  // A1.3 adds only its dormant read-only observer; it is not a production collection clock.
  assert.deepEqual(scheduledWorkflows,['data-steward-readonly-observer.yml']);
  const observer=read('.github/workflows/data-steward-readonly-observer.yml');
  assert.doesNotMatch(observer,/production-collection|run-production-collection|schedule-dispatcher/);
  assert.match(observer,/vars\.DATA_STEWARD_SCHEDULED_ENABLED == 'true'/);
  assert.equal(PRODUCTION_COLLECTION_SCHEDULE,'17 1 * * *');
});

/* ------------------------------- the dispatched SHA trust model ------------------------------- */

test('the dispatch event itself is the only source of the immutable candidate SHA',()=>{
  const gate=gateBlock();
  for(const required of [
    'DISPATCHED_SHA: ${{ github.sha }}',
    'test "$EVENT_NAME" = workflow_dispatch',
    'test "$EVENT_REF" = refs/heads/main',
    'test "$EVENT_REPOSITORY" = priteshpatel390-del/FPL',
    "printf '%s' \"$DISPATCHED_SHA\" | grep -Eq '^[0-9a-f]{40}$'",
    'ref: ${{ github.sha }}',
    'fetch-depth: 0',
    'persist-credentials: false',
    'test "$(git rev-parse HEAD)" = "$DISPATCHED_SHA"',
    'test "$remote_main" = "$DISPATCHED_SHA"',
    'test -z "$(git status --porcelain)"'])
    assert.ok(gate.includes(required),required);
  assert.match(external,/if: github\.event_name == 'workflow_dispatch'/);
  // Never a floating ref, never a newer commit, never "latest successful build". The caller's
  // `ref: main` reaches GitHub, never this workflow's checkout.
  assert.doesNotMatch(uncommented(external),/^\s*ref: main\s*$/m);
  assert.doesNotMatch(uncommented(external),/git (?:pull|merge|checkout main)/);
  assert.deepEqual([...uncommented(external).matchAll(/^\s*ref: (.+)$/gm)].map(row=>row[1]),
    ['${{ github.sha }}','${{ needs.repository-gate.outputs.dispatched_sha }}']);
});

test('remote main is proved by the gate and independently again under production credentials',()=>{
  const resolve=/remote_main="\$\(git ls-remote https:\/\/github\.com\/priteshpatel390-del\/FPL\.git refs\/heads\/main \| cut -f1\)"/;
  assert.match(gateBlock(),resolve);
  assert.equal([...external.matchAll(new RegExp(resolve.source,'g'))].length,2);
  assert.doesNotMatch(external,/outputs:[\s\S]{0,400}remote_main/);
  const lines=stepScript(external,COLLECT_RUN_MARKER).split('\n').map(line=>line.trim()).filter(Boolean);
  assert.equal(lines.at(-1),'node workers/data-platform/run-production-collection.mjs');
  assert.equal(lines.at(-2),'test "$remote_main" = "$SCHEDULED_SHA"');
  assert.equal(lines.at(-3),'test -n "$remote_main"');
  assert.match(lines.at(-4),/^remote_main="\$\(git ls-remote /);
  assert.equal(lines[0],'set -euo pipefail');
  assert.ok(lines.includes('test "$(node --version)" = v24.19.0'));
  assert.ok(lines.includes('test -z "$(git status --porcelain)"'));
  assert.ok(lines.some(line=>line.startsWith('rm -f node_modules/.bin/wrangler')));
  assert.ok(lines.some(line=>line.startsWith('rm -rf node_modules/wrangler')));
  // Nothing before the recheck reaches Cloudflare.
  assert.ok(!lines.slice(0,-1).some(line=>/cloudflare|api\.cloudflare|curl/i.test(line)));
});

/* ------------------- executable proof of both fail-closed identity shells ------------------- */

function runShell(script,{shaVariable,liveMain,head,dirty=false}={}){
  const approved='0123456789abcdef0123456789abcdef01234567';
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'external-gate-'));
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

test('a moved main, a wrong head or a dirty tree stops the external production runner',()=>{
  const script=stepScript(external,COLLECT_RUN_MARKER);
  const pass=runShell(script,{shaVariable:'SCHEDULED_SHA'});
  assert.equal(pass.status,0);
  assert.equal(pass.invoked,true);
  assert.match(pass.stamp,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
  for(const blocked of [{liveMain:'fedcba9876543210fedcba9876543210fedcba98'},{liveMain:"''"},
    {head:'fedcba9876543210fedcba9876543210fedcba98'},{dirty:true}]){
    const out=runShell(script,{shaVariable:'SCHEDULED_SHA',...blocked}),label=JSON.stringify(blocked);
    assert.notEqual(out.status,0,label);
    assert.equal(out.invoked,false,label);
  }
});

test('the credential-free external gate shell also fails closed on every identity mismatch',()=>{
  const script=stepScript(external,GATE_RUN_MARKER);
  assert.equal(runShell(script,{shaVariable:'DISPATCHED_SHA'}).status,0);
  for(const blocked of [{liveMain:'fedcba9876543210fedcba9876543210fedcba98'},{liveMain:"''"},
    {head:'fedcba9876543210fedcba9876543210fedcba98'},{dirty:true}])
    assert.notEqual(runShell(script,{shaVariable:'DISPATCHED_SHA',...blocked}).status,0,JSON.stringify(blocked));
});

test('the one attempt collection identity is fixed once, after every repository identity check',()=>{
  assert.equal([...external.matchAll(/COLLECTION_SCHEDULED_AT=/g)].length,1);
  assert.doesNotMatch(external,/GITHUB_ENV/);
  const lines=stepScript(external,COLLECT_RUN_MARKER).split('\n').map(line=>line.trim()).filter(Boolean);
  assert.ok(lines.includes('COLLECTION_SCHEDULED_AT="$(date -u +%Y-%m-%dT%H:%M:00.000Z)"'));
  assert.ok(lines.includes('export COLLECTION_SCHEDULED_AT'));
  assert.ok(lines.includes('test -n "$COLLECTION_SCHEDULED_AT"'));
  const stamp=lines.indexOf('COLLECTION_SCHEDULED_AT="$(date -u +%Y-%m-%dT%H:%M:00.000Z)"');
  assert.ok(stamp>lines.indexOf('test "$(git rev-parse HEAD)" = "$SCHEDULED_SHA"'));
  assert.ok(stamp<lines.findIndex(line=>line.startsWith('remote_main=')));
});

/* ------------------------ credential-free gate and protected collection ------------------------ */

test('the external repository gate holds no environment, credential, fingerprint or database identity',()=>{
  const gate=gateBlock();
  assert.doesNotMatch(gate,/environment:|secrets\.CLOUDFLARE|CLOUDFLARE_|vars\./);
  assert.ok(!gate.includes(PRODUCTION_D1_ID));
  assert.equal([...gate.matchAll(/secrets\./g)].length,0);
  assert.ok(gate.includes('GH_TOKEN: ${{ github.token }}'));
});

test('the protected production job exists only after the gate and runs exactly the gated SHA',()=>{
  assert.ok(external.indexOf(GATE_START)<external.indexOf(COLLECT_START));
  assert.match(external,/\n  collect:\n    needs: repository-gate/);
  const collect=collectBlock();
  // The dedicated unattended boundary, shared with the scheduled path, never the attended one.
  assert.match(collect,/environment:\n      name: data-s2-production-scheduled/);
  assert.match(collect,/ref: \$\{\{ needs\.repository-gate\.outputs\.dispatched_sha \}\}/);
  assert.match(collect,/SCHEDULED_SHA: \$\{\{ needs\.repository-gate\.outputs\.dispatched_sha \}\}/);
  assert.equal([...external.matchAll(/node-version: 24\.19\.0/g)].length,2);
});

test('production identifier masking is registered before any variable is materialised',()=>{
  const steps=collectBlock().split('\n      - name: ').slice(1);
  assert.match(steps[0],/^Register production identifier masks before any other step/);
  assert.ok(steps[0].includes("printf '::add-mask::%s\\n'"));
  const fingerprintSteps=steps.filter(step=>step.includes('CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT'));
  assert.equal(fingerprintSteps.length,1);
  assert.equal(fingerprintSteps[0],steps.at(-1));
  assert.equal([...uncommented(external).matchAll(/vars\./g)].length,1);
  const collect=collectBlock();
  const jobEnv=collect.slice(collect.indexOf('    env:'),collect.indexOf('    steps:'));
  assert.doesNotMatch(jobEnv,/FINGERPRINT|D1_ID|vars\./);
  assert.doesNotMatch(external,/CLOUDFLARE_PRODUCTION_D1_ID/);
  assert.ok(!external.includes(PRODUCTION_D1_ID));
});

/* ------------------------------ permanent repository gate ------------------------------ */

test('workflow B reuses the unchanged bounded exact-head Verify module and adds the guard',()=>{
  const gate=gateBlock();
  assert.ok(gate.includes('node workers/data-platform/scheduled/run-exact-head-verify.mjs'));
  assert.ok(gate.includes('node workers/data-platform/scheduled/run-opportunity-guard.mjs'));
  // The Verify wait runs before the guard, and both complete before the protected job exists.
  assert.ok(gate.indexOf('run-exact-head-verify.mjs')<gate.indexOf('run-opportunity-guard.mjs'));
  assert.deepEqual([...uncommented(external).matchAll(/node workers\/data-platform\/[a-z0-9/-]+\.mjs/g)]
    .map(row=>row[0]),
    ['node workers/data-platform/scheduled/run-exact-head-verify.mjs',
     'node workers/data-platform/scheduled/run-opportunity-guard.mjs',
     'node workers/data-platform/run-production-collection.mjs']);
});

test('workflow B adds no Cron, Wrangler, deployment, migration or provider surface',()=>{
  const body=uncommented(external);
  for(const forbidden of [/run-migration-0003/,/run-production-resume/,/run-first-run-reconciliation/,
    /run-production-explain/,/phase4b/i,/phase-4b/i,/wrangler deploy/,/wrangler triggers/,/"crons"/,
    /crons:/,/understat/i,/odds/i,/migrations\//,/secrets:\s*inherit/,/continue-on-error/])
    assert.doesNotMatch(body,forbidden,String(forbidden));
  for(const line of body.split('\n').filter(line=>/wrangler/i.test(line)))
    assert.match(line.trim(),/^rm -(f|rf) /,line);
  assert.deepEqual([...new Set([...body.matchAll(/https:\/\/([a-z.]+)\//g)].map(row=>row[1]))].sort(),
    ['github.com']);
  // The historical Cloudflare collector Worker declaration stays untouched and unreferenced.
  assert.match(read(PLATFORM_CONFIG_PATH),/"crons": \["\*\/30 \* \* \* \*"\]/);
  assert.ok(!body.includes('wrangler.jsonc'));
});

/* ---------------------- unchanged collector, entry point and envelope ---------------------- */

test('workflow B refuses a GitHub re-run through the same unchanged shared entry point',()=>{
  const entry=uncommented(read(COLLECTION_ENTRY_PATH));
  assert.match(entry,/GITHUB_RUN_ATTEMPT!=='1'\)throw new Error\('workflow_retry_forbidden'\)/);
  assert.ok(entry.indexOf('GITHUB_RUN_ATTEMPT')<entry.indexOf('resolveProductionIdentity(process.env)'));
  assert.equal([...entry.matchAll(/runProductionCollection\(/g)].length,1);
  assert.ok(external.includes('node workers/data-platform/run-production-collection.mjs'));
  // The workflow itself retries nothing.
  assert.doesNotMatch(uncommented(external),/rerun|retry|continue-on-error/i);
});

test('DATA-S2C changes no production collector byte, resource ceiling or projection factor',()=>{
  // Byte identity of the production collection surface, pinned by hash.
  assert.equal(sha256(COLLECTOR_PATH),'83a5fe3f43c138400e4c2fa76a90a1628a1d2f2f5970fbb6adf7d69346bc98f7');
  assert.equal(sha256(COLLECTION_ENTRY_PATH),'189e78c07198074957825f1b47959b168e160bf0e75d53b9f154085735454c19');
  assert.equal(sha256(PLATFORM_CONFIG_PATH),'2814f28b9fb14cc0ebf42e1f4ce083b5f3b1fe6d37d57a64ced88edf2c5535b6');
  // The unchanged envelope, shared by every routine collection path. There is no external fast
  // path and no external-only ceiling.
  assert.equal(EXPECTED_D1_ROWS_READ_PER_CYCLE,150000);
  assert.equal(SOFT_D1_ROWS_READ_PER_CYCLE,200000);
  assert.equal(MAX_D1_ROWS_READ_PER_CYCLE,250000);
  assert.equal(MAX_D1_ROWS_WRITTEN_PER_CYCLE,40000);
  assert.equal(MAX_D1_API_CALLS_PER_CYCLE,8);
  assert.equal(PROVIDER_READ_AMPLIFICATION,1.35);
  assert.equal(PROVIDER_READ_SAFETY_RESERVE,2000);
  assert.equal(MAX_ROUTINE_CHANGED_OBSERVATIONS_PER_RUN,4000);
  assert.equal(MAX_OFFICIAL_RESPONSE_BYTES,8*1024*1024);
  assert.equal(PRODUCTION_SEASON,'2026-27');
  assert.deepEqual([...OFFICIAL_FPL_ENDPOINTS],['https://fantasy.premierleague.com/api/bootstrap-static/',
    'https://fantasy.premierleague.com/api/fixtures/']);
  assert.ok(external.includes(`DATA_S2_SEASON: '${PRODUCTION_SEASON}'`));
  // Exactly the reviewed migrations and indexes, with no migration 0004.
  const migrations=fs.readdirSync('workers/data-platform/migrations').sort();
  assert.deepEqual(migrations,['0001_shadow_data_foundation.sql',
    '0002_official_fpl_structured_history.sql','0003_production_query_plan_indexes.sql']);
  assert.equal(migrations.flatMap(name=>
    read(`workers/data-platform/migrations/${name}`).match(/CREATE (?:UNIQUE )?INDEX (\w+)/g)||[]).length,5);
  const collector=read(COLLECTOR_PATH);
  assert.match(collector,/validateProductionPostflight/);
  assert.doesNotMatch(collector,/SCHEDULED_SHA|DISPATCHED_SHA|github\.event|process\.env/);
});
