import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflowPath='.github/workflows/api-football-corrected-version-independent-requalification.yml';
const consumedWorkflowPath='.github/workflows/api-football-corrected-version-forensic-replay.yml';
const codePath='workers/api-football-collector/corrected-version-readonly.mjs';
const originalSha='073ac6a53d09f004e5ada5b94fb1cea6df3ef228';
const existingVersion='509f5a98-38fc-4e58-8a26-1b8fc4c9c787';
const originalEvidenceHash='dfac83bfc4bd67baa5dad7b59a8c51bc6f9d29ba474a0afe1c6513fa66629e43';
const read=path=>fs.readFileSync(path,'utf8');

function verifyNewReadOnlyBoundary(yaml){
  assert.match(yaml,/^name: API-Football Corrected Version Independent Requalification$/m);
  assert.match(yaml,/^on:\n  workflow_dispatch:\s*$/m);
  assert.doesNotMatch(yaml,/^\s+(push|pull_request|schedule):/m);
  assert.match(yaml,/github\.event_name == 'workflow_dispatch' && github\.run_attempt == 1/);
  assert.match(yaml,/group: api-football-corrected-version-independent-requalification/);
  assert.match(yaml,/name: data-steward-readonly/);
  assert.match(yaml,/deployment: false/);
  assert.match(yaml,/node-version: 24\.19\.0/);
  assert.match(yaml,/test "\$EVENT_REF" = refs\/heads\/main/);
  assert.match(yaml,/git ls-remote https:\/\/github\.com\/priteshpatel390-del\/FPL\.git refs\/heads\/main/);
  assert.match(yaml,/Tests and deterministic build/);
  assert.match(yaml,/head_sha===sha/);
  assert.match(yaml,/run-id: 37841681952/);
  assert.match(yaml,new RegExp(originalEvidenceHash));
  assert.match(yaml,new RegExp(originalSha));
  assert.match(yaml,new RegExp(existingVersion));
  assert.match(yaml,/API_FOOTBALL_CORRECTED_MODE: RECONCILIATION/);
  assert.match(yaml,/corrected-version-readonly\.mjs/);
  assert.match(yaml,/DATA_STEWARD_CLOUDFLARE_READ_TOKEN/);
  assert.match(yaml,/CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN/);
  assert.match(yaml,/name: corrected-version-independent-requalification/);
  const output='corrected-independent-requalification.json';
  assert.match(yaml,new RegExp('API_FOOTBALL_CORRECTED_REPORT_PATH: .*'+output.replace(/\\./g,'\\\\.')));
  assert.match(yaml,new RegExp('path: .*'+output.replace(/\\./g,'\\\\.')));
  assert.doesNotMatch(yaml,/corrected-forensic-replay\.json/);
  const guard=yaml.indexOf('Verify fresh main and successful exact-head CI before any live read');
  const evidence=yaml.indexOf('Verify byte-pinned execution evidence and immutable creation identity');
  const live=yaml.indexOf('Independently requalify exact existing Version');
  assert.ok(guard>0&&evidence>guard&&live>evidence,'main and original pinned evidence must gate any Cloudflare reads');
  assert.doesNotMatch(yaml.replace(/^\s*#.*$/gm,''),/CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN|CLOUDFLARE_ATTENDED_MUTATION_TOKEN|CLOUDFLARE_D1_WRITE_TOKEN|secrets\.API_FOOTBALL_API_KEY|secrets\.API_FOOTBALL_ATTENDED_TRIGGER_SECRET|run-corrected-version-upload|run-gate-c|run-deployed-one-shot|\/deployments|workers\.dev|wrangler\s+deploy|method:\s*POST|schedule:/i);
  return true;
}

test('independent corrected Version requalification uses a fresh name and all exact evidence gates',()=>{
  assert.equal(verifyNewReadOnlyBoundary(read(workflowPath)),true);
  assert.match(read(consumedWorkflowPath),/name: API-Football Corrected Version Forensic Replay/);
  assert.notEqual(read(workflowPath),read(consumedWorkflowPath));
  assert.doesNotMatch(read(workflowPath),/name: corrected-version-forensic-replay/);
});
test('read-only guard tests actively reject removal of source evidence and introduction of mutating credentials',()=>{
  const yaml=read(workflowPath);
  assert.throws(()=>verifyNewReadOnlyBoundary(yaml.replace(originalEvidenceHash,'incorrect')),assert.AssertionError);
  assert.throws(()=>verifyNewReadOnlyBoundary(yaml.replace('github.run_attempt == 1','github.run_attempt == 2')),assert.AssertionError);
  assert.throws(()=>verifyNewReadOnlyBoundary(yaml.replace('data-steward-readonly','api-football-corrected-version-upload')),assert.AssertionError);
  assert.throws(()=>verifyNewReadOnlyBoundary(yaml+'\n# injected\nCLOUDFLARE_ATTENDED_MUTATION_TOKEN: injected\n'),assert.AssertionError);
});
test('new independent workflow reuses fixed GET and fixed SELECT-only reconciliation, not upload path',()=>{
  const reader=read(codePath);
  assert.match(reader,/runCorrectedReconciliation/);
  assert.match(reader,/classifyCorrectedReconciliation/);
  assert.match(reader,/method:'GET'/);
  assert.match(reader,/CORRECTED_HISTORY_QUERY=`SELECT/);
  assert.match(reader,/method:'POST'/); // D1 read uses the Cloudflare query endpoint with SELECT only.
  assert.doesNotMatch(reader,/submitCorrectedVersionOnce|buildCorrectedUploadForm|createCorrectedGuardedFetch/);
  const query=reader.match(/CORRECTED_HISTORY_QUERY=`([\s\S]*?)`;/)?.[1];
  assert.ok(query,'read-only query must be found');
  assert.match(query,/SELECT COUNT/);
  assert.doesNotMatch(query,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|REPLACE|CREATE)\b/i);
  const s=read('workers/api-football-collector/corrected-version-preparation.mjs');
  assert.match(s,/if\(!correctedAnnotationsMatch\(beta\.annotations,identity\.metadata\.annotations\)\)meta\('annotations_mismatch'\)/);
  assert.match(s,/typeof actual\['workers\/triggered_by'\]==='string'/);
  assert.match(s,/module_content_mismatch/);
  assert.match(s,/secret_binding_value_exposed/);
});
