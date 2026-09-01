import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {e2IdentityFingerprint} from '../workers/data-platform/e2-live-http-adapter.mjs';

const workflowPath='.github/workflows/data-s2b-e2c-b-live-experiment.yml';
const workflow=fs.readFileSync(workflowPath,'utf8');
const runner=fs.readFileSync('workers/data-platform/e2c-b/run-live-experiment.mjs','utf8');

test('E2C-B workflow is manual-only with fixed non-cancelling concurrency',()=>{
  assert.match(workflow,/on:\n  workflow_dispatch:/);
  for(const forbidden of [/\n  push:/,/\n  schedule:/,/\n  workflow_call:/,/pull_request:/])assert.doesNotMatch(workflow,forbidden);
  assert.match(workflow,/group: data-s2b-e2c-b-disposable-live-experiment\n  cancel-in-progress: false/);
});

test('E2C-B repository gate precedes the sole protected credential-bearing job',()=>{
  assert.match(workflow,/repository-gate:[\s\S]*disposable-live-experiment:\n    needs: repository-gate/);
  const gate=workflow.slice(workflow.indexOf('  repository-gate:'),workflow.indexOf('  disposable-live-experiment:'));
  for(const forbidden of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_E2C_DATABASE_ID','environment:'])assert.doesNotMatch(gate,new RegExp(forbidden));
  assert.match(workflow,/environment:\n      name: data-s2b-e2c-b-live-experiment/);
});

test('E2C-B uses runner context only at step scope and shares one bounded evidence path',()=>{
  const liveJob=workflow.slice(workflow.indexOf('  disposable-live-experiment:'));
  const jobEnv=liveJob.slice(liveJob.indexOf('    env:'),liveJob.indexOf('    steps:'));
  assert.doesNotMatch(jobEnv,/\$\{\{\s*runner\./);
  const evidencePath='${{ runner.temp }}/e2c-b-sanitized-evidence.json';
  assert.equal(liveJob.split(evidencePath).length-1,2);
  assert.match(liveJob,/Reconfirm identity and run once without retry or cleanup\n        env:\n          E2C_EVIDENCE_PATH: \$\{\{ runner\.temp \}\}\/e2c-b-sanitized-evidence\.json\n        run:/);
  assert.match(liveJob,/name: data-s2b-e2c-b-sanitized-evidence\n          path: \$\{\{ runner\.temp \}\}\/e2c-b-sanitized-evidence\.json/);
});

test('E2C-B gate pins approved current main, exact-head Verify and rejects reruns in both jobs',()=>{
  for(const required of ['test "$RUN_ATTEMPT" = 1','test "${GITHUB_RUN_ATTEMPT}" = 1','test "$remote_main" = "$APPROVED_SHA"','row.head_sha===process.env.APPROVED_SHA',"row.name==='Tests and deterministic build'","row.conclusion==='success'"])assert.match(workflow,new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.equal((workflow.match(/workflow_dispatch/g)||[]).length,2);
});

test('E2C-B wrapper has no cleanup, arbitrary provider error, raw evidence or retry surface',()=>{
  for(const forbidden of ['retry','database/delete','DELETE FROM','console.log','error.message','error.stack','Authorization','request.body','response.body'])assert.doesNotMatch(runner,new RegExp(forbidden,'i'));
  for(const required of ["failureClassification", "cleanupState:'NOT_PERFORMED_BY_E2C_B'",'PRODUCTION_ACCOUNT_FINGERPRINT','CLOUDFLARE_E2C_APPROVED_ACCOUNT_FINGERPRINT','E2C_EVIDENCE_PATH'])assert.match(runner,new RegExp(required));
  assert.match(workflow,/CLOUDFLARE_E2C_APPROVED_ACCOUNT_FINGERPRINT: \$\{\{ vars\.CLOUDFLARE_E2C_APPROVED_ACCOUNT_FINGERPRINT \}\}/);
  assert.match(runner,/approvedAccountFingerprint=fingerprint\('CLOUDFLARE_E2C_APPROVED_ACCOUNT_FINGERPRINT'\)/);
  assert.doesNotMatch(runner,/approvedAccountFingerprint:e2IdentityFingerprint\(accountId\)/);
  assert.doesNotMatch(workflow,/database\/delete|wrangler d1 delete|retry-action|nick-fields\/retry/i);
});

test('E2C-B workflow supplies the independently approved database fingerprint from protected variables',()=>{
  assert.match(workflow,/CLOUDFLARE_E2C_APPROVED_DATABASE_FINGERPRINT: \$\{\{ vars\.CLOUDFLARE_E2C_APPROVED_DATABASE_FINGERPRINT \}\}/);
  assert.match(runner,/approvedDatabaseFingerprint=fingerprint\('CLOUDFLARE_E2C_APPROVED_DATABASE_FINGERPRINT'\)/);
  assert.match(runner,/expectedDatabaseFingerprint:approvedDatabaseFingerprint/);
  assert.doesNotMatch(runner,/expectedDatabaseFingerprint:e2IdentityFingerprint\(databaseId\)/);
});

test('E2C-B database approval is canonical and gates every Cloudflare request',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'teamsheet-e2c-b-'));
  const marker=path.join(directory,'fetch-called');
  const preload=path.join(directory,'fetch-stub.mjs');
  fs.writeFileSync(preload,"import fs from 'node:fs';globalThis.fetch=async()=>{fs.writeFileSync(process.env.FETCH_MARKER,'called');return new Response('{}',{status:500});};\n");
  const databaseId='11111111-2222-4333-8444-555555555555';
  const base={...process.env,APPROVED_SHA:'a'.repeat(40),CLOUDFLARE_ACCOUNT_ID:'disposable-account',E2C_DATABASE_ID:databaseId,E2C_DATABASE_NAME:'teamsheet-data-e2-rest-validation-20260901-a1b2c3',CLOUDFLARE_API_TOKEN:'unused-test-token',CLOUDFLARE_E2C_APPROVED_ACCOUNT_FINGERPRINT:e2IdentityFingerprint('disposable-account'),PRODUCTION_ACCOUNT_FINGERPRINT:e2IdentityFingerprint('production-account'),E2C_EVIDENCE_PATH:path.join(directory,'evidence.json'),FETCH_MARKER:marker};
  const run=overrides=>spawnSync(process.execPath,['--import',preload,'workers/data-platform/e2c-b/run-live-experiment.mjs'],{cwd:process.cwd(),env:{...base,...overrides},encoding:'utf8'});
  for(const value of [undefined,'sha256:ABC','sha256:'+'0'.repeat(63),'sha256:'+'g'.repeat(64)]){
    fs.rmSync(marker,{force:true});
    const env={CLOUDFLARE_E2C_APPROVED_DATABASE_FINGERPRINT:value};
    const result=run(env);
    assert.notEqual(result.status,0);
    assert.equal(fs.existsSync(marker),false);
  }
  fs.rmSync(marker,{force:true});
  const mismatch=run({CLOUDFLARE_E2C_APPROVED_DATABASE_FINGERPRINT:e2IdentityFingerprint('different-database')});
  assert.notEqual(mismatch.status,0);
  assert.equal(fs.existsSync(marker),false);
  const exact=run({CLOUDFLARE_E2C_APPROVED_DATABASE_FINGERPRINT:e2IdentityFingerprint(databaseId)});
  assert.notEqual(exact.status,0);
  assert.equal(fs.readFileSync(marker,'utf8'),'called');
  fs.rmSync(directory,{recursive:true,force:true});
});

test('E2C-B runner records end only after awaited experiment settles',()=>{
  const awaitIndex=runner.indexOf('await runE2LiveHttpContract');
  const endIndex=runner.indexOf('const endedAt=canonicalNow()');
  assert.ok(awaitIndex>0&&endIndex>awaitIndex);
  assert.match(runner,/finalizeE2Evidence\(rawEvidence,endedAt\)/);
  assert.doesNotMatch(runner,/runE2LiveHttpContract\([^;]*endedAt/s);
});

test('E2C-B workflow retains only a bounded sanitized artifact and never automates cleanup',()=>{
  assert.match(workflow,/retention-days: 14/);
  assert.match(workflow,/name: data-s2b-e2c-b-sanitized-evidence/);
  assert.match(workflow,/run once without retry or cleanup/);
  assert.doesNotMatch(workflow,/actions\/cache|curl[^\n]*(\/query|d1\/database)|wrangler/);
});
