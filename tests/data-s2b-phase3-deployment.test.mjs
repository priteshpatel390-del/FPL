import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CANDIDATE_VERSION_ID,EXPECTED_PRODUCTION_HOSTNAME,ROLLBACK_VERSION_ID,classifyMutationReconciliation,
  deploymentBody,validateDomains,validatePreflightDeployment,validateSoleActive,validateVersionHistory
} from '../workers/data-platform/phase3/deploy-candidate.mjs';
import {EXPECTED_ACTIVE_DEPLOYMENT_ID} from '../workers/data-platform/phase2/readonly-closeout.mjs';

const workflow=fs.readFileSync('.github/workflows/data-s2b-phase3-deployment.yml','utf8');
const helper=fs.readFileSync('workers/data-platform/phase3/deploy-candidate.mjs','utf8');
const executable=`${workflow}\n${helper}`;

test('Phase 3 identities and deployment bodies are closed over the approved candidate and rollback only',()=>{
  assert.equal(CANDIDATE_VERSION_ID,'3a2b065a-6527-4887-9bf8-b08e82e81133');
  assert.equal(ROLLBACK_VERSION_ID,'5edbe951-4be4-46bc-b2cf-17b550396105');
  assert.deepEqual(deploymentBody(CANDIDATE_VERSION_ID),{strategy:'percentage',versions:[{version_id:CANDIDATE_VERSION_ID,percentage:100}]});
  assert.deepEqual(deploymentBody(ROLLBACK_VERSION_ID),{strategy:'percentage',versions:[{version_id:ROLLBACK_VERSION_ID,percentage:100}]});
  assert.throws(()=>deploymentBody('unexpected'),/phase3_deployment_target_forbidden/);
});

test('preflight pins the old deployment and postflight requires the intended sole active version',()=>{
  const pre={deploymentId:EXPECTED_ACTIVE_DEPLOYMENT_ID,versionId:ROLLBACK_VERSION_ID};
  assert.equal(validatePreflightDeployment(pre),pre);
  assert.throws(()=>validatePreflightDeployment({...pre,versionId:CANDIDATE_VERSION_ID}),/phase3_active_deployment_drift/);
  assert.equal(validateSoleActive({deploymentId:'new',versionId:CANDIDATE_VERSION_ID},CANDIDATE_VERSION_ID).versionId,CANDIDATE_VERSION_ID);
  assert.throws(()=>validateSoleActive({deploymentId:'new',versionId:ROLLBACK_VERSION_ID},CANDIDATE_VERSION_ID),/phase3_active_version_unexpected/);
});

test('version history permits no new Worker Version or newer drift',()=>{
  const history=[CANDIDATE_VERSION_ID,ROLLBACK_VERSION_ID,'older'];
  assert.equal(validateVersionHistory(history,[...history]),true);
  assert.throws(()=>validateVersionHistory(history,[CANDIDATE_VERSION_ID,'new',ROLLBACK_VERSION_ID,'older']),/phase3_unexpected_worker_version_created/);
  assert.throws(()=>validateVersionHistory(['newer',...history],['newer',...history]),/phase3_version_history_drift/);
});

test('custom-domain posture is exact and mutation ambiguity is reconciled without retry',()=>{
  assert.deepEqual(validateDomains([{service:'other',hostname:'other.example'},{service:'teamsheet-data-platform',hostname:EXPECTED_PRODUCTION_HOSTNAME}]),[EXPECTED_PRODUCTION_HOSTNAME]);
  assert.throws(()=>validateDomains([]),/phase3_custom_domain_drift/);
  assert.equal(classifyMutationReconciliation(CANDIDATE_VERSION_ID,CANDIDATE_VERSION_ID,ROLLBACK_VERSION_ID),'TARGET_ACTIVE');
  assert.equal(classifyMutationReconciliation(ROLLBACK_VERSION_ID,CANDIDATE_VERSION_ID,ROLLBACK_VERSION_ID),'PREVIOUS_ACTIVE');
  assert.equal(classifyMutationReconciliation('unknown',CANDIDATE_VERSION_ID,ROLLBACK_VERSION_ID),'UNRESOLVED');
});

test('workflow is manual-only, exact-main/CI gated, then releases a protected mutation environment',()=>{
  assert.match(workflow,/^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow,/^\s{2}(?:push|pull_request|pull_request_target|schedule):/m);
  assert.match(workflow,/phase3-deployment:\n    needs: repository-gate/);
  assert.match(workflow,/name: data-s2b-phase3-deployment/);
  assert.match(workflow,/test "\$EVENT_REF" = refs\/heads\/main/);
  assert.match(workflow,/remote_main.*git ls-remote/);
  assert.match(workflow,/row\.head_sha===process\.env\.APPROVED_SHA/);
  assert.ok(workflow.indexOf('repository-gate:')<workflow.indexOf('phase3-deployment:'));
});

test('mutation surface is Deployments-only and contains no forbidden capability',()=>{
  assert.equal((helper.match(/method:'POST'/g)??[]).length,2); // D1 SELECT transport and the one deployment function.
  assert.match(helper,/request\(`\$\{workerBase\}\/deployments`,\{method:'POST',body:deploymentBody\(versionId\),ambiguous:true\}\)/);
  assert.doesNotMatch(executable,/wrangler\s+(?:deploy|versions|triggers)|bindings_inherit|\/versions\?[^\n]*method:\s*['"]POST/i);
  assert.doesNotMatch(executable,/\/schedules[^\n]*method:\s*['"](?:POST|PUT|PATCH|DELETE)|\/time_travel\/restore/i);
  assert.doesNotMatch(executable,/\/routes|\/access\/|\/secrets/);
  assert.match(helper,/body:\{sql:validateReadOnlySql\(sql\)\}/);
  assert.doesNotMatch(helper,/fetchOfficial|official-fpl-history|scheduled\(/i);
});

test('rollback is one-shot, mutation responses are reconciled, and outcomes are explicit',()=>{
  assert.match(helper,/let databaseId,mutationCount=0/);
  assert.match(helper,/if\(mutationCount===0\)/);
  assert.match(helper,/if\(active!==CANDIDATE_VERSION_ID\)/);
  assert.match(helper,/await deploy\(ROLLBACK_VERSION_ID\)/);
  assert.match(helper,/phase3_mutation_response_ambiguous/);
  for(const outcome of ['PHASE 3 PASS','PHASE 3 FAIL','ROLLBACK PASS','UNRESOLVED/STOP'])assert.match(helper,new RegExp(outcome.replace('/','\\/')));
  assert.doesNotMatch(helper,/force\s*[:=]\s*true|retry|setTimeout/);
});

test('postflight proves health and immutable D1, Cron, version, binding and domain state',()=>{
  assert.match(helper,/https:\/\/\$\{EXPECTED_PRODUCTION_HOSTNAME\}\/v1\/health/);
  assert.match(helper,/CF-Access-Client-Id/);
  assert.match(helper,/Authorization:`Bearer \$\{healthToken\}`/);
  assert.match(helper,/await invariantRead\(CANDIDATE_VERSION_ID\);await health\(\);await invariantRead\(CANDIDATE_VERSION_ID\)/);
  assert.match(helper,/validatePostPhase1State/);
  assert.match(helper,/PHASE1_D1_SIZE_BYTES/);
  assert.match(helper,/assessCron/);
  assert.match(helper,/validateUploadedVersion/);
  assert.match(helper,/validateActiveVersion/);
});

test('credentials and identifiers are masked and durable output is sanitized',()=>{
  assert.match(helper,/for\(const value of sensitive\)process\.stdout\.write\(`::add-mask::\$\{value\}/);
  assert.match(helper,/::add-mask::\$\{databaseId\}/);
  assert.doesNotMatch(helper,/writeFileSync|upload-artifact|console\.log|set -x/);
  assert.doesNotMatch(workflow,/CLOUDFLARE_WORKER_UPLOAD_TOKEN|CLOUDFLARE_D1_WRITE_TOKEN/);
});
