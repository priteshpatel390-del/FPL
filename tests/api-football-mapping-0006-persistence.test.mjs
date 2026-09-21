import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path='.github/workflows/api-football-mapping-0006-persistence.yml';
const workflow=fs.readFileSync(path,'utf8');
const jobs=name=>{
  const start=workflow.indexOf(`  ${name}:`);
  const tail=workflow.slice(start+3);
  const next=tail.search(/\n  [a-z0-9-]+:\n/);
  return workflow.slice(start,next===-1?undefined:start+3+next);
};

test('persistence gate is manual first-attempt exact-main and exact-Verify only',()=>{
  assert.match(workflow,/on:\n  workflow_dispatch:/);
  assert.doesNotMatch(workflow,/\n  (?:push|schedule|pull_request):/);
  assert.match(jobs('repository-gate'),/github\.run_attempt == 1/);
  assert.match(jobs('repository-gate'),/refs\/heads\/main/);
  assert.match(jobs('repository-gate'),/Tests and deterministic build/);
  assert.match(workflow,/group: data-s2-production-collection/);
  assert.match(workflow,/cancel-in-progress: false/);
});

test('writer cannot start before approved reconciliation and fresh mapping admission',()=>{
  const writer=jobs('private-mapping');
  assert.match(writer,/needs: \[repository-gate, approved-evidence-gate, mapping-preflight\]/);
  assert.match(jobs('mapping-preflight'),/needs: \[repository-gate, approved-evidence-gate\]/);
  assert.match(jobs('mapping-preflight'),/MIGRATION_0006_PREFLIGHT_MODE: mapping_pre/);
  assert.match(jobs('approved-evidence-gate'),/35604949049/);
  assert.match(jobs('approved-evidence-gate'),/10641607212/);
  assert.match(jobs('approved-evidence-gate'),/4d0798c7ddbb84e61098b180b4d15036331987f4c746ee022e1204b127bf9f29/);
  assert.match(jobs('approved-evidence-gate'),/NO_SUBMITTED_MAPPING_STATE_VISIBLE/);
  assert.match(jobs('approved-evidence-gate'),/productionMutations!==0\|\|r\.apiFootballRequests!==0/);
});

test('private crosswalk enters only protected persistence step and is never retained',()=>{
  const writer=jobs('private-mapping');
  assert.match(writer,/environment: data-s2-production-collection/);
  assert.equal((workflow.match(/API_FOOTBALL_OWNER_CROSSWALK_JSON/g)||[]).length,3);
  assert.match(writer,/API_FOOTBALL_OWNER_CROSSWALK_JSON: "\$\{\{ secrets\.API_FOOTBALL_OWNER_CROSSWALK_JSON \}\}"/);
  assert.match(writer,/test -n "\$API_FOOTBALL_OWNER_CROSSWALK_JSON"/);
  assert.doesNotMatch(workflow,/GITHUB_OUTPUT[^\n]*(?:CROSSWALK|crosswalk)|upload-artifact[^\n]*(?:CROSSWALK|crosswalk)/);
});

test('only existing mapping runner can mutate; schema and provider egress stay impossible',()=>{
  const writer=jobs('private-mapping');
  assert.match(writer,/MIGRATION_0006_PHASE: mapping/);
  assert.match(writer,/node workers\/data-platform\/run-migration-0006\.mjs/);
  assert.doesNotMatch(workflow,/MIGRATION_0006_PHASE: schema|MIGRATION_0006_PREFLIGHT_MODE: schema_(?:pre|post)|migration-0006-schema\.json/);
  assert.doesNotMatch(workflow,/API_FOOTBALL_API_KEY|api-sports\.io|wrangler\s+(?:d1|deploy|secret|triggers)/i);
});

test('qualified provider artifact remains pinned and independently integrity checked',()=>{
  const gate=jobs('approved-evidence-gate');
  assert.match(gate,/10540321648/);
  assert.match(gate,/4a69b38d20857767007b23f6259efe5894aab35202ad8e10ee8cdc62bdafce97/);
  assert.match(gate,/065a3057d6b9cb1543f942fdc6882ab29850beca95533549e5cbfb7c96efaad8/);
});

test('independent sanitized postflight runs after any attempted write',()=>{
  const post=jobs('mapping-postflight');
  assert.match(post,/if: always\(\) && needs\.private-mapping\.result != 'skipped'/);
  assert.match(post,/environment: \{name: data-steward-readonly, deployment: false\}/);
  assert.match(post,/MIGRATION_0006_PREFLIGHT_MODE: mapping_post/);
  assert.match(post,/MIGRATION_0006_PREFLIGHT_REPORT_PATH/);
  assert.match(post,/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f/);
});
