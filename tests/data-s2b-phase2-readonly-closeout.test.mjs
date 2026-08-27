import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  EXPECTED_ACTIVE_DEPLOYMENT_ID,EXPECTED_ACTIVE_VERSION_ID,EXPECTED_PHASE2_VERSION_ID,PHASE1_D1_SIZE_BYTES,
  validateCloseoutDatabaseSize,validateCloseoutDeployment,validateCloseoutVersions
} from '../workers/data-platform/phase2/readonly-closeout.mjs';

const workflowPath='.github/workflows/data-s2b-phase2-readonly-closeout.yml';
const helperPath='workers/data-platform/phase2/readonly-closeout.mjs';
const uploadHelperPath='workers/data-platform/phase2/upload-version.mjs';
const workflow=fs.readFileSync(workflowPath,'utf8');
const helper=fs.readFileSync(helperPath,'utf8');
const uploadHelper=fs.readFileSync(uploadHelperPath,'utf8');

function runBlocks(source){return [...source.matchAll(/^\s+run: \|\n((?:\s{10}.*\n?)*)/gm)].map(match=>match[1]).join('\n');}

test('Phase 2 closeout pins the observed attempt #3 artifact and pre-existing active deployment',()=>{
  assert.equal(EXPECTED_PHASE2_VERSION_ID,'3a2b065a-6527-4887-9bf8-b08e82e81133');
  assert.equal(EXPECTED_ACTIVE_DEPLOYMENT_ID,'10f7a065-3d82-4b34-9fb1-dc6c3a0be524');
  assert.equal(EXPECTED_ACTIVE_VERSION_ID,'5edbe951-4be4-46bc-b2cf-17b550396105');
  assert.equal(PHASE1_D1_SIZE_BYTES,151552);
});

test('closeout deployment must remain the exact attempt #3 active deployment and version',()=>{
  const deployment={deploymentId:EXPECTED_ACTIVE_DEPLOYMENT_ID,versionId:EXPECTED_ACTIVE_VERSION_ID,timestamp:'2026-08-25T00:00:00.000Z',rollback:'PASS'};
  assert.equal(validateCloseoutDeployment(deployment),deployment);
  assert.throws(()=>validateCloseoutDeployment({...deployment,deploymentId:'different'}),/phase2_closeout_active_deployment_drift/);
  assert.throws(()=>validateCloseoutDeployment({...deployment,versionId:'different'}),/phase2_closeout_active_deployment_drift/);
});

test('closeout requires the Phase 2 artifact to remain latest while the old active version remains available',()=>{
  assert.equal(validateCloseoutVersions([EXPECTED_PHASE2_VERSION_ID,EXPECTED_ACTIVE_VERSION_ID,'older']),true);
  assert.throws(()=>validateCloseoutVersions(['newer',EXPECTED_PHASE2_VERSION_ID,EXPECTED_ACTIVE_VERSION_ID]),/phase2_closeout_latest_version_drift/);
  assert.throws(()=>validateCloseoutVersions([EXPECTED_PHASE2_VERSION_ID,'older']),/phase2_closeout_active_version_missing/);
});

test('closeout D1 accounting is pinned to the recorded Phase 1 size baseline',()=>{
  assert.equal(validateCloseoutDatabaseSize({file_size:PHASE1_D1_SIZE_BYTES}),true);
  assert.throws(()=>validateCloseoutDatabaseSize({file_size:PHASE1_D1_SIZE_BYTES+4096}),/phase2_closeout_d1_size_drift/);
  assert.throws(()=>validateCloseoutDatabaseSize({file_size:'invalid'}),/phase2_closeout_d1_size_drift/);
});

test('closeout workflow is manual-only, exact-main gated and reuses the read-only Phase 0 environment',()=>{
  assert.match(workflow,/^on:\n  workflow_dispatch:\n    inputs:\n      approved_sha:/m);
  assert.doesNotMatch(workflow,/^\s{2}(?:push|pull_request|pull_request_target|schedule):/m);
  assert.deepEqual([...workflow.matchAll(/^\s{6}([a-z_]+):\n\s{8}description:/gm)].map(row=>row[1]),['approved_sha']);
  assert.match(workflow,/test "\$EVENT_REF" = refs\/heads\/main/);
  assert.match(workflow,/git ls-remote https:\/\/github\.com\/priteshpatel390-del\/FPL\.git refs\/heads\/main/);
  assert.match(workflow,/row\.head_sha===process\.env\.APPROVED_SHA/);
  assert.match(workflow,/name: data-s2b-phase0-readonly/);
  assert.match(workflow,/CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  assert.doesNotMatch(workflow,/CLOUDFLARE_WORKER_UPLOAD_TOKEN|CLOUDFLARE_D1_WRITE_TOKEN/);
});

test('closeout helper has no Worker mutation and limits D1 POSTs to validated SELECT queries',()=>{
  const executable=`${runBlocks(workflow)}\n${helper}`;
  assert.doesNotMatch(executable,/\bwrangler\b|\/versions\?bindings_inherit=strict/);
  assert.doesNotMatch(helper,/\/deployments[^`'"\n]*['"`]??\s*,\s*\{\s*method:\s*['"](?:POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(helper,/\/versions(?:\/|\?)[^`'"\n]*['"`]??\s*,\s*\{\s*method:\s*['"](?:POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(helper,/\/schedules[^`'"\n]*['"`]??\s*,\s*\{\s*method:\s*['"](?:POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(helper,/\/(?:routes|domains|subdomain|secrets)(?:\/|`|'|")[^\n]*method:\s*['"](?:POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(helper,/\/time_travel\/restore/i);
  assert.match(helper,/body:\{sql:validateReadOnlySql\(sql\)\}/);
  assert.doesNotMatch(helper,/body:\s*\{\s*(?:batch|sql\s*:\s*(?!validateReadOnlySql))/i);
});

test('closeout explicitly validates active and uploaded version detail and never relies on script/version settings',()=>{
  assert.match(helper,/versions\/\$\{encodeURIComponent\(EXPECTED_ACTIVE_VERSION_ID\)\}/);
  assert.match(helper,/validateActiveVersion\(activeDetail,\{activeVersionId:EXPECTED_ACTIVE_VERSION_ID\}\)/);
  assert.match(helper,/versions\/\$\{encodeURIComponent\(EXPECTED_PHASE2_VERSION_ID\)\}/);
  assert.match(helper,/validateUploadedVersion\(uploadedDetail,\{uploadedId:EXPECTED_PHASE2_VERSION_ID,databaseId\}\)/);
  assert.doesNotMatch(helper,/\$\{workerBase\}\/settings/);
  assert.doesNotMatch(uploadHelper,/\$\{workerBase\}\/settings/);
});

test('closeout proves Cron and Phase 1 D1 state without collecting or writing',()=>{
  assert.match(helper,/assessCron\(schedules\)/);
  assert.match(helper,/validatePostPhase1State\(\{/);
  assert.match(helper,/PHASE0_QUERIES\.migrations/);
  assert.match(helper,/PHASE1_QUERIES\.source/);
  assert.match(helper,/PHASE1_QUERIES\.revision/);
  assert.match(helper,/PHASE0_QUERIES\.counts/);
  assert.match(helper,/PHASE0_QUERIES\.officialHistory/);
  assert.doesNotMatch(helper,/official-fpl-history|fetchOfficial|scheduled\(/i);
});

test('closeout credentials and D1 identifier are masked and raw responses are not persisted',()=>{
  assert.match(helper,/::add-mask::\$\{token\}/);
  assert.match(helper,/::add-mask::\$\{account\}/);
  assert.match(helper,/::add-mask::\$\{databaseId\}/);
  assert.doesNotMatch(helper,/writeFileSync|console\.log|set -x/);
  assert.doesNotMatch(workflow,/upload-artifact|artifacts:/i);
});
