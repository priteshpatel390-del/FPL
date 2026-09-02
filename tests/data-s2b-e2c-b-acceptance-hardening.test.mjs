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
const isolationRunner=fs.readFileSync('workers/data-platform/e2c-b/run-initial-isolation.mjs','utf8');
const w01Runner=fs.readFileSync('workers/data-platform/e2c-b/run-w01-reconciliation.mjs','utf8');

test('E2C-B workflow is manual-only with fixed non-cancelling concurrency',()=>{
  assert.match(workflow,/on:\n  workflow_dispatch:/);
  for(const forbidden of [/\n  push:/,/\n  schedule:/,/\n  workflow_call:/,/pull_request:/])assert.doesNotMatch(workflow,forbidden);
  assert.match(workflow,/group: data-s2b-e2c-b-disposable-live-experiment\n  cancel-in-progress: false/);
  assert.match(workflow,/options:\n          - contract\n          - initial-isolation\n          - w01-reconciliation/);
});

test('W01 reconciliation mode is fixed, read-only, schema-gated and bounded',()=>{
  for(const required of ['buildFullWriteReconciliation()','buildSchemaInspectionPlan()','validateSetupLiveSchema','mutationOccurred:false','cleanupOccurred:false','E2_INITIAL_SCHEMA_FINGERPRINT'])assert.match(w01Runner,new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const forbidden of ['INSERT INTO','UPDATE ','DELETE FROM','CREATE TABLE','database/delete','console.log','error.message','error.stack'])assert.doesNotMatch(w01Runner,new RegExp(forbidden,'i'));
  assert.match(workflow,/node workers\/data-platform\/e2c-b\/run-w01-reconciliation\.mjs/);
});

test('INITIAL isolation is a fixed read-only matrix with bounded evidence and production identity rejection',()=>{
  assert.match(isolationRunner,/const statements=buildSchemaInspectionPlan\(\)\.statements/);
  assert.match(isolationRunner,/\['G02',\[0,1\]\].*\['G21',Array\.from\(\{length:21\}/s);
  assert.match(isolationRunner,/mutationOccurred:false,cleanupOccurred:false/);
  for(const forbidden of ['console.log','DELETE FROM','CREATE TABLE','INSERT INTO','UPDATE ','retry','error.message','error.stack','provider'])assert.doesNotMatch(isolationRunner,new RegExp(forbidden,'i'));
  assert.match(isolationRunner,/e2IdentityFingerprint\(accountId\)===fingerprint\('PRODUCTION_ACCOUNT_FINGERPRINT'\)/);
});

test('INITIAL isolation reports the exact failing statement index without retaining SQL or provider payloads',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'teamsheet-e2c-isolation-')),preload=path.join(directory,'fetch.mjs'),evidence=path.join(directory,'evidence.json'),calls=path.join(directory,'calls.jsonl');
  fs.writeFileSync(preload,`import fs from 'node:fs';globalThis.fetch=async(url,request)=>{if(request.method==='GET')return new Response(JSON.stringify({success:true,result:{uuid:process.env.E2C_DATABASE_ID,name:process.env.E2C_DATABASE_NAME}}),{status:200,headers:{'content-type':'application/json'}});const value=JSON.parse(request.body),statements=value.batch||[value];fs.appendFileSync(process.env.CALLS,JSON.stringify({batch:Array.isArray(value.batch),count:statements.length})+'\\n');return new Response(JSON.stringify({success:true,result:statements.map(statement=>({success:true,results:statement.sql.includes('sqlite_schema')?[{type:'table',name:'sqlite_sequence',tbl_name:'sqlite_sequence',sql:'CREATE TABLE sqlite_sequence(name,seq)'}]:[],meta:{changes:0}}))}),{status:200,headers:{'content-type':'application/json'}});};\n`);
  const account='disposable',database='11111111-2222-4333-8444-555555555555',env={...process.env,APPROVED_SHA:'a'.repeat(40),CLOUDFLARE_ACCOUNT_ID:account,E2C_DATABASE_ID:database,E2C_DATABASE_NAME:'teamsheet-data-e2-rest-validation-20260901-a1b2c3',CLOUDFLARE_API_TOKEN:'fake',CLOUDFLARE_E2C_APPROVED_ACCOUNT_FINGERPRINT:e2IdentityFingerprint(account),CLOUDFLARE_E2C_APPROVED_DATABASE_FINGERPRINT:e2IdentityFingerprint(database),PRODUCTION_ACCOUNT_FINGERPRINT:e2IdentityFingerprint('production'),E2C_EVIDENCE_PATH:evidence,CALLS:calls};
  const result=spawnSync(process.execPath,['--import',preload,'workers/data-platform/e2c-b/run-initial-isolation.mjs'],{cwd:process.cwd(),env,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const report=JSON.parse(fs.readFileSync(evidence,'utf8')),byId=Object.fromEntries(report.outcomes.map(value=>[value.probeId,value]));assert.equal(report.outcomes.length,28);assert.equal(byId.M00.httpStatus,200);assert.equal(byId.S00.httpStatus,200);assert.deepEqual(byId.S00.schemaObjects,[{type:'table',name:'sqlite_sequence'}]);assert.equal(byId.S01.httpStatus,200);assert.equal(byId.S02.httpStatus,200);assert.equal(report.mutationOccurred,false);assert.equal(report.cleanupOccurred,false);assert.doesNotMatch(JSON.stringify(report),/SELECT|pragma_|fake|disposable|11111111/);
  const sent=fs.readFileSync(calls,'utf8').trim().split('\n').map(JSON.parse);assert.equal(sent.length,27);assert.ok(sent.slice(0,21).every(value=>value.batch===false&&value.count===1));assert.ok(sent.slice(21).every(value=>value.batch===true&&value.count>1));
  fs.rmSync(directory,{recursive:true,force:true});
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

test('E2C-B gate pins an allowlisted exact branch head, exact-head Verify and rejects reruns in both jobs',()=>{
  for(const required of ['test "$RUN_ATTEMPT" = 1','test "${GITHUB_RUN_ATTEMPT}" = 1','test "$remote_ref" = "$APPROVED_SHA"',"grep -Eq '^(main|fix/data-s2b-e2-disposable-d1-live)$'",'row.head_sha===process.env.APPROVED_SHA',"row.name==='Tests and deterministic build'","row.conclusion==='success'"])assert.match(workflow,new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
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

test('E2C-B report admits only validated closed pre-mutation diagnostics',()=>{assert.match(runner,/preMutationDiagnostics=Array\.isArray\(error\?\.preMutationDiagnostics\)\?error\.preMutationDiagnostics\.map\(validateE2PreMutationDiagnostic\):\[\]/);assert.match(runner,/preMutationDiagnostics:Object\.freeze\(preMutationDiagnostics\)/);for(const forbidden of ['error.message','error.stack','error.response','JSON.stringify(error)'])assert.doesNotMatch(runner,new RegExp(forbidden.replace('.','\\.')));});
