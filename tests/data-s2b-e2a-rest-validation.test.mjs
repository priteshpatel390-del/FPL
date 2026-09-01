import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as plan from '../workers/data-platform/e2-d1-rest-validation-plan.mjs';
import * as harnessModule from '../workers/data-platform/e2-d1-rest-validation-harness.mjs';
const {createE2FakeTransport,createE2ValidationHarness,validateDisposableIdentity,E2_OUTCOME_CLASSIFICATIONS}=harnessModule;
const identity={accountFingerprint:'acct-e2',approvedAccountFingerprint:'acct-e2',productionAccountFingerprint:'acct-production',databaseName:'teamsheet-data-e2-rest-validation-20260901-a1b2c3',databaseFingerprint:'db-e2',expectedDatabaseFingerprint:'db-e2',schemaFingerprint:plan.E2_INITIAL_SCHEMA_FINGERPRINT,tables:[]};
const code=value=>error=>error?.code===value;
const results=count=>Array.from({length:count},()=>({success:true}));
const fakeResponse=(status,payload)=>createE2FakeTransport({kind:'response',status,payload});

test('phase enumeration defaults omitted phase to initial and rejects every other value',()=>{
  assert.ok(validateDisposableIdentity(identity));
  assert.ok(validateDisposableIdentity({...identity,phase:'initial'}));
  const setup={...identity,phase:'setup',schemaFingerprint:plan.E2_SETUP_SCHEMA_FINGERPRINT,tables:[...plan.E2_APPROVED_TABLES]};
  assert.ok(validateDisposableIdentity(setup));
  for(const phase of ['anything-else','live','production','',null,1,{},[]])assert.throws(()=>validateDisposableIdentity({...identity,phase}),/e2_schema_phase_invalid/);
  assert.throws(()=>validateDisposableIdentity({...identity,phase:'anything-else',tables:['e2_unexpected']}),/e2_schema_phase_invalid/);
});

test('initial schema requires the derived empty identity and no user tables',()=>{
  assert.deepEqual(plan.E2_INITIAL_SCHEMA_REPRESENTATION,[]);
  assert.equal(plan.deriveE2SchemaFingerprint(plan.E2_INITIAL_SCHEMA_REPRESENTATION),plan.E2_INITIAL_SCHEMA_FINGERPRINT);
  assert.notEqual(plan.E2_INITIAL_SCHEMA_FINGERPRINT,plan.E2_SETUP_SCHEMA_FINGERPRINT);
  assert.ok(validateDisposableIdentity(identity));
  assert.throws(()=>validateDisposableIdentity({...identity,schemaFingerprint:plan.E2_SETUP_SCHEMA_FINGERPRINT}),/e2_initial_schema_fingerprint_mismatch/);
  assert.throws(()=>validateDisposableIdentity({...identity,schemaFingerprint:'caller-selected'}),/e2_initial_schema_fingerprint_mismatch/);
  assert.throws(()=>validateDisposableIdentity({...identity,tables:['e2_atomicity']}),/e2_initial_schema_not_empty/);
  assert.throws(()=>validateDisposableIdentity({...identity,expectedSchemaFingerprint:plan.E2_INITIAL_SCHEMA_FINGERPRINT}),/e2_identity_invalid/);
});

test('setup schema requires its derived fingerprint and exact canonical table set',()=>{
  const setup={...identity,phase:'setup',schemaFingerprint:plan.E2_SETUP_SCHEMA_FINGERPRINT,tables:[...plan.E2_APPROVED_TABLES]};
  assert.equal(plan.deriveE2SchemaFingerprint(plan.E2_SCHEMA_DDL),plan.E2_SETUP_SCHEMA_FINGERPRINT);
  assert.ok(validateDisposableIdentity(setup));
  assert.ok(validateDisposableIdentity({...setup,tables:[...setup.tables].reverse()}));
  assert.throws(()=>validateDisposableIdentity({...setup,tables:setup.tables.slice(0,-1)}),/e2_setup_schema_tables_mismatch/);
  assert.throws(()=>validateDisposableIdentity({...setup,tables:[...setup.tables,'e2_unexpected']}),/e2_setup_schema_tables_mismatch/);
  assert.throws(()=>validateDisposableIdentity({...setup,tables:[...setup.tables,setup.tables[0]]}),/e2_setup_schema_tables_mismatch/);
  assert.throws(()=>validateDisposableIdentity({...setup,tables:[...setup.tables,'shadow_observations']}),/e2_production_schema_rejected/);
  assert.throws(()=>validateDisposableIdentity({...setup,schemaFingerprint:plan.E2_INITIAL_SCHEMA_FINGERPRINT}),/e2_setup_schema_fingerprint_mismatch/);
});

test('canonical synthetic schema owns exact constraints and a derived deterministic fingerprint',()=>{
  assert.equal(plan.E2_SCHEMA_DDL.length,5);
  const atomicity=plan.E2_SCHEMA_DDL[0];
  assert.match(atomicity,/PRIMARY KEY \(run_id, sequence_no\)/);
  assert.match(atomicity,/UNIQUE \(run_id, marker\)/);
  assert.match(atomicity,/CHECK \(valid_value IN \(0, 1\)\)/);
  assert.equal(plan.deriveE2SchemaFingerprint(plan.E2_SCHEMA_DDL),plan.E2_SETUP_SCHEMA_FINGERPRINT);
  const modified=[...plan.E2_SCHEMA_DDL];modified[0]=modified[0].replace('IN (0, 1)','IN (0, 1, 2)');
  assert.notEqual(plan.deriveE2SchemaFingerprint(modified),plan.E2_SETUP_SCHEMA_FINGERPRINT);
  assert.equal(plan.buildSyntheticSchemaSetupPlan().schemaFingerprint,plan.E2_SETUP_SCHEMA_FINGERPRINT);
  assert.equal(plan.buildSyntheticSchemaSetupPlan().phase,'setup');
  assert.ok(plan.E2_APPROVED_TABLES.every(table=>table.startsWith('e2_')));
});

test('A01-A03 have isolated run identities and pin the runtime and syntax failures',()=>{
  const cases=['A01','A02','A03'].map(plan.buildAtomicityCase);
  assert.equal(new Set(cases.map(value=>value.runId)).size,3);
  assert.deepEqual(cases.map(value=>value.runId),['e2-run-a01','e2-run-a02','e2-run-a03']);
  assert.equal(cases[1].statements[1].params.at(-1),'2');
  assert.match(cases[2].statements[1].sql,/INVALID SQL/);
  for(const built of cases)for(const statement of built.statements)assert.ok(statement.params.every(value=>typeof value==='string'));
});

test('A04 reconciliation is scenario-specific and rejects unknown cases',()=>{
  const reconciliation=plan.buildAtomicityReconciliation('A02');
  assert.equal(reconciliation.runId,'e2-run-a02');
  assert.deepEqual(reconciliation.statements[0].params,['e2-run-a02']);
  assert.doesNotMatch(JSON.stringify(reconciliation),/e2-run-a0[13]/);
  assert.throws(()=>plan.buildAtomicityReconciliation('A99'),/e2_reconciliation_case_invalid/);
  assert.equal(plan.classifyAtomicityRows([]),'FULL_ROLLBACK');
  assert.equal(plan.classifyAtomicityRows([{sequence_no:1},{sequence_no:2},{sequence_no:3}]),'COMPLETE_SUCCESS');
  assert.equal(plan.classifyAtomicityRows([{sequence_no:1}]),'PARTIAL_WRITE');
  assert.equal(plan.classifyAtomicityRows([{sequence_no:99}]),'AMBIGUOUS');
});

test('P01-P09 direct affinity values are strings and JSON mixed/null path is inspectable',()=>{
  const built=plan.buildAffinityPlan(),params=built.statements.flatMap(row=>row.params);
  for(const expected of ['42','3.125','0042','0','1','2026-09-01T12:34:56.000Z','true','false'])assert.ok(params.includes(expected));
  assert.ok(params.every(value=>typeof value==='string'));
  assert.deepEqual(JSON.parse(built.statements.at(-1).params[0]).map(row=>row.value),[42,3.125,'0042',true,null]);
  assert.ok(Buffer.byteLength(plan.buildLargeJsonAffinityPlan().statements[0].params[0])<2000000);
});

test('L01-L06 statement profiles preserve representative count and reject >40',()=>{
  for(const count of [1,10,plan.E2_REPRESENTATIVE_STATEMENTS,35,40])assert.equal(plan.buildStatementProfile(count).statements.length,count);
  assert.equal(plan.buildSyntheticFullWriteAnalogue().statements.length,24);
  assert.throws(()=>plan.buildStatementProfile(41),/e2_statement_count_invalid/);
});

test('L07-L11 body profiles preserve exact deterministic serialized bytes',()=>{
  assert.deepEqual(plan.E2_BODY_PROFILE_TARGETS,[922219,1844438,2766656,3688875,4611094]);
  for(const target of plan.E2_BODY_PROFILE_TARGETS){const built=plan.buildBodySizeProfile(target);assert.equal(plan.serializedBodyBytes(built),target);assert.equal(built.mutation,false);}
});

test('W01-W02 analogue preserves native nested JSON types and production chunk mechanics',()=>{
  const built=plan.buildSyntheticFullWriteAnalogue();
  assert.equal(built.statements.length,24);
  assert.equal(typeof built.statements[1].params[0],'string');
  const first=JSON.parse(built.statements[1].params[0]);
  assert.equal(first.length,600);assert.equal(JSON.parse(built.statements[17].params[0]).length,260);
  assert.equal(JSON.parse(built.statements[18].params[0]).length,2000);assert.equal(JSON.parse(built.statements[22].params[0]).length,1860);
  assert.ok(first.some(row=>typeof row.value_number==='number'&&Number.isFinite(row.value_number)));
  assert.ok(first.some(row=>typeof row.value_boolean==='boolean'));
  assert.ok(first.some(row=>row.value_number===null&&row.value_boolean===null));
  assert.ok(first.some(row=>typeof row.value_text==='string'));
  const raw=JSON.stringify(built);for(const forbidden of ['shadow_observations','observation_heads','canonical_entities','official-fpl-r1'])assert.doesNotMatch(raw,new RegExp(forbidden));
  assert.deepEqual(plan.buildSyntheticFullWriteAnalogue(),built);
});

test('transport trust rejects arbitrary sync, async and fetch-capable functions',()=>{
  for(const transport of [()=>{},async()=>{},async()=>globalThis.fetch])assert.throws(()=>createE2ValidationHarness({identity,transport}),code('e2_trusted_fake_transport_required'));
  assert.throws(()=>createE2ValidationHarness({identity,transport:createE2FakeTransport({kind:'throw'}),baseUrl:'https://example.invalid'}),code('e2_trusted_fake_transport_required'));
  assert.deepEqual(Object.keys(harnessModule).filter(key=>/trust|marker|bless/i.test(key)),[]);
});

test('trusted E2-owned fake transports support deterministic success and error shapes',async()=>{
  const success=createE2ValidationHarness({identity,transport:fakeResponse(200,{success:true,result:results(3)})});
  assert.equal((await success.execute(plan.buildAtomicityCase('A01'))).classification,'success');
  for(const transport of [createE2FakeTransport({kind:'throw'}),createE2FakeTransport({kind:'malformed_json'}),fakeResponse(401,{}),fakeResponse(429,{})])assert.doesNotThrow(()=>createE2ValidationHarness({identity,transport}));
});

test('provider response requires exact count and every statement success',async()=>{
  const cases=[
    [{success:true,result:results(3)},'success'],
    [{success:true,result:[{success:false},...results(2)]},'known_sql_provider_failure'],
    [{success:true,result:[{success:true},{success:false},{success:true}]},'known_sql_provider_failure'],
    [{success:true,result:[...results(2),{success:false}]},'known_sql_provider_failure'],
    [{success:true,result:results(2)},'malformed_provider_response'],
    [{success:true,result:results(4)},'malformed_provider_response'],
    [{success:true,result:[{success:true},null,{success:true}]},'malformed_provider_response'],
    [{success:true,result:[{success:true},{unexpected:true},{success:true}]},'malformed_provider_response'],
    [{success:false,result:[]},'known_sql_provider_failure']
  ];
  for(const [payload,expected] of cases){const evidence=await createE2ValidationHarness({identity,transport:fakeResponse(200,payload)}).execute(plan.buildAtomicityCase('A01'));assert.equal(evidence.classification,expected);assert.equal(evidence.dispatchCount,1);}
});

test('HTTP, malformed JSON and transport ambiguity classify once without retry',async()=>{
  const cases=[[fakeResponse(403,{}),'auth_failure'],[fakeResponse(429,{}),'rate_limited'],[fakeResponse(500,{}),'known_sql_provider_failure'],[createE2FakeTransport({kind:'malformed_json'}),'malformed_provider_response'],[createE2FakeTransport({kind:'throw'}),E2_OUTCOME_CLASSIFICATIONS.UNKNOWN]];
  for(const [transport,expected] of cases){const evidence=await createE2ValidationHarness({identity,transport}).execute(plan.buildAtomicityCase('A01'));assert.equal(evidence.classification,expected);assert.equal(evidence.dispatchCount,1);}
});

test('sanitized evidence excludes auth, raw bodies, responses, SQL and raw IDs',async()=>{
  const evidence=await createE2ValidationHarness({identity,transport:fakeResponse(200,{success:true,result:results(1)})}).execute(plan.buildAtomicityReconciliation('A01'),{sourceSha:'abc123'});
  const raw=JSON.stringify(evidence);for(const forbidden of ['bearer-super-secret','Authorization','acct-e2','db-e2','SELECT','result'])assert.doesNotMatch(raw,new RegExp(forbidden));
  assert.match(evidence.accountFingerprint,/^sha256:/);assert.equal(evidence.sourceSha,'abc123');
});

test('static network firewall has no fetch, URL, environment, headers, logging or retry capability',()=>{
  for(const file of ['workers/data-platform/e2-d1-rest-validation-plan.mjs','workers/data-platform/e2-d1-rest-validation-harness.mjs']){
    const source=fs.readFileSync(file,'utf8');assert.doesNotMatch(source,/globalThis\.fetch|\bfetch\s*\(|https?:\/\/|process\.env|Authorization|headers\s*:|console\.(?:log|error)|setTimeout|retry/i);
  }
});
