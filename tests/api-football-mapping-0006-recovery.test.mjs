import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path='.github/workflows/api-football-mapping-0006-recovery.yml';
const workflow=fs.readFileSync(path,'utf8');

test('mapping recovery is manual one-shot exact-main and exact-Verify gated',()=>{
  assert.match(workflow,/on:\n  workflow_dispatch:/);
  assert.doesNotMatch(workflow,/\n  (push|schedule|pull_request):/);
  assert.match(workflow,/github\.run_attempt == 1/);
  assert.match(workflow,/refs\/heads\/main/);
  assert.match(workflow,/Tests and deterministic build/);
  assert.match(workflow,/group: data-s2-production-collection/);
  assert.match(workflow,/cancel-in-progress: false/);
});

test('mapping recovery has no schema mutation path and admits only mapping persistence state',()=>{
  assert.match(workflow,/MIGRATION_0006_PREFLIGHT_MODE: mapping_pre/);
  assert.match(workflow,/MIGRATION_0006_PREFLIGHT_MODE: mapping_post/);
  assert.doesNotMatch(workflow,/MIGRATION_0006_PREFLIGHT_MODE: schema_(pre|post)/);
  assert.doesNotMatch(workflow,/MIGRATION_0006_PHASE: schema/);
  assert.doesNotMatch(workflow,/migration-0006-schema\.json/);
});

test('private crosswalk exists only on protected writer persistence step',()=>{
  assert.match(workflow,/private-mapping:[\s\S]*environment: data-s2-production-collection/);
  assert.equal((workflow.match(/API_FOOTBALL_OWNER_CROSSWALK_JSON/g)||[]).length,3);
  assert.match(workflow,/API_FOOTBALL_OWNER_CROSSWALK_JSON: "\$\{\{ secrets\.API_FOOTBALL_OWNER_CROSSWALK_JSON \}\}"/);
  assert.match(workflow,/test -n "\$API_FOOTBALL_OWNER_CROSSWALK_JSON"/);
  assert.doesNotMatch(workflow,/GITHUB_OUTPUT[^\n]*(CROSSWALK|crosswalk)|upload-artifact[^\n]*(CROSSWALK|crosswalk)/);
});

test('recovery retains pinned provider evidence, sanitized report and no provider activation',()=>{
  assert.match(workflow,/10540321648/);
  assert.match(workflow,/4a69b38d20857767007b23f6259efe5894aab35202ad8e10ee8cdc62bdafce97/);
  assert.match(workflow,/MAPPING_0006_REPORT_PATH/);
  assert.doesNotMatch(workflow,/API_FOOTBALL_API_KEY|api-sports\.io|wrangler deploy|wrangler secret|wrangler triggers/);
});
