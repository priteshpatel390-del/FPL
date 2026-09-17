import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {API_FOOTBALL_MAX_RESPONSE_BYTES,readBoundedJson} from '../workers/api-football-collector/runtime-contracts.mjs';

const root=path.resolve(import.meta.dirname,'..');
const evidence=JSON.parse(fs.readFileSync(path.join(root,'docs/evidence/eia-2i5e-sanitized-qualification.json'),'utf8'));
const responseLimit=evidence.r7AttendedQualification.responseLimit;

test('production response ceiling is exactly the attended-qualified R7 value',()=>{
  assert.equal(responseLimit.decision,'GO');
  assert.equal(responseLimit.formalQualification,true);
  assert.equal(responseLimit.qualificationState,'ATTENDED_CANONICAL_QUALIFIED');
  assert.equal(responseLimit.observedMaximum,347_982);
  assert.equal(responseLimit.doubledMaximum,695_964);
  assert.equal(responseLimit.quantumBytes,65_536);
  assert.equal(responseLimit.proposedCeiling,720_896);
  assert.equal(API_FOOTBALL_MAX_RESPONSE_BYTES,responseLimit.proposedCeiling);
});

test('default bounded decoder enforces the qualified ceiling',async()=>{
  const oversize=await readBoundedJson(new Response('{}',{headers:{'content-length':String(API_FOOTBALL_MAX_RESPONSE_BYTES+1)}}));
  assert.equal(oversize.reason,'provider_response_too_large');
  const bounded=await readBoundedJson(new Response(JSON.stringify({response:[]})));
  assert.equal(bounded.ok,true);
});

test('ceiling implementation does not activate collector infrastructure',()=>{
  const config=fs.readFileSync(path.join(root,'workers/api-football-collector/wrangler.jsonc'),'utf8');
  const migration=fs.readFileSync(path.join(root,'workers/data-platform/migrations/0005_api_football_shadow_runtime.sql'),'utf8');
  assert.match(config,/"EIA_2I5D_ACTIVATION": "REPOSITORY_ONLY_BLOCKED"/);
  assert.match(config,/"crons": \[\]/);
  assert.match(config,/"database_id": "00000000-0000-0000-0000-000000000000"/);
  assert.match(migration,/VALUES\s*\(\s*'api-football'\s*,\s*0\s*,\s*'EIA_2I5D_REPOSITORY_ONLY'/);
});

test('attended evidence remains an immutable historical execution record',()=>{
  assert.equal(responseLimit.productionConstant,null);
  assert.equal(responseLimit.implemented,false);
});