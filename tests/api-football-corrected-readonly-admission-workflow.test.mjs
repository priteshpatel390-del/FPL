import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const body=fs.readFileSync(path.join(root,'.github/workflows/api-football-corrected-version-readonly-admission.yml'),'utf8');
test('corrected read-only admission workflow has no upload path or write credential',()=>{
  assert.match(body,/API_FOOTBALL_CORRECTED_MODE: ADMISSION/);
  assert.doesNotMatch(body,/run-corrected-version-upload|api-football-corrected-version-upload|VERSION_UPLOAD_TOKEN|API_FOOTBALL_API_KEY|ATTENDED_TRIGGER_SECRET|RECONCILIATION/);
  assert.equal((body.match(/environment:/g)??[]).length,1);
  assert.match(body,/name: data-steward-readonly/);
  assert.match(body,/workflow_dispatch/);
  assert.doesNotMatch(body,/\n  (push|schedule|pull_request):/);
  assert.match(body,/permissions:\n  contents: read\n  checks: read/);
  assert.match(body,/group: api-football-collector-attended-acceptance\n  cancel-in-progress: false/);
});
