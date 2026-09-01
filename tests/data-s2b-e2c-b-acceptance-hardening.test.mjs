import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
