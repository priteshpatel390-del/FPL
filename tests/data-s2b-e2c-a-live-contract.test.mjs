import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as plan from '../workers/data-platform/e2-d1-rest-validation-plan.mjs';
import {E2_EXPECTED_SEMANTIC_SCHEMA,E2_EXPECTED_SEMANTIC_SCHEMA_FINGERPRINT,canonicalizeLiveSchema,deriveLiveSchemaFingerprint,validateInitialLiveObjects,validateSetupLiveSchema} from '../workers/data-platform/e2-live-schema-contract.mjs';
import {createE2LiveHttpAdapter,e2IdentityFingerprint,E2_LIVE_HTTP_CAPABILITY} from '../workers/data-platform/e2-live-http-adapter.mjs';
import {E2_LIVE_RESPONSE_CLASS,runE2LiveContract} from '../workers/data-platform/e2-live-orchestrator.mjs';

const clone=value=>structuredClone(value);
const rawAccount='acct_e2';
const rawDatabase='12345678-1234-1234-1234-123456789abc';
const identity={accountFingerprint:e2IdentityFingerprint(rawAccount),approvedAccountFingerprint:e2IdentityFingerprint(rawAccount),productionAccountFingerprint:e2IdentityFingerprint('acct-production'),databaseName:'teamsheet-data-e2-rest-validation-20260901-a1b2c3',databaseFingerprint:e2IdentityFingerprint(rawDatabase),expectedDatabaseFingerprint:e2IdentityFingerprint(rawDatabase),schemaFingerprint:plan.E2_INITIAL_SCHEMA_FINGERPRINT,tables:[]};
const finalRow={entities:1064,observations:9860,heads:9860,orphan_heads:0,run_rows:1,run_status:'completed',records_accepted:9860};

function responseFor(caseId){return {classification:['A02','A03'].includes(caseId)?E2_LIVE_RESPONSE_CLASS.SQL_FAILURE:E2_LIVE_RESPONSE_CLASS.SUCCESS,completionChanges:caseId==='W01'?1:undefined};}
function reconciliationFor(item){
  if(item.caseId==='SCHEMA-RECONCILE')return {metadata:clone(E2_EXPECTED_SEMANTIC_SCHEMA)};
  if(item.caseId?.startsWith('A04-'))return {rows:item.caseId.endsWith('A01')?[{sequence_no:1},{sequence_no:2},{sequence_no:3}]:[]};
  if(item.caseId==='P-STORAGE-READ')return {classification:'COMPLETE_SUCCESS'};
  if(item.caseId==='W00-R')return {rows:[{run_id:'e2-run-full-write',status:'started',records_accepted:0}]};
  return {rows:[finalRow]};
}
function options(overrides={}){return {sourceSha:'a'.repeat(40),approvedSourceSha:'a'.repeat(40),runnerIdentity:'e2c-a-runner-v1',identity,initialObjects:[],query:async item=>responseFor(item.caseId),reconcile:async item=>reconciliationFor(item),...overrides};}

async function runAtomicVariant(caseId,responseClassification,rows){
  return runE2LiveContract(options({query:async item=>item.caseId===caseId?{classification:responseClassification}:responseFor(item.caseId),reconcile:async item=>item.caseId===`A04-${caseId}`?{rows}:reconciliationFor(item)}));
}

test('W00 is exact and W01 retains its independent 24-statement 2,378,752-byte mutation identity',()=>{
  assert.deepEqual(plan.buildFullWriteRunStart().statements[0].params,['e2-run-full-write','0']);
  assert.equal(plan.reconcileFullWriteRunStart([{run_id:'e2-run-full-write',status:'started',records_accepted:0}]),true);
  const w01=plan.buildSyntheticFullWriteAnalogue();assert.equal(w01.statements.length,24);assert.equal(plan.serializedBodyBytes(w01),plan.E2_W01_SERIALIZED_REQUEST_BYTES);assert.equal(plan.E2_W01_SERIALIZED_REQUEST_BYTES,2378752);
  assert.equal(plan.E2_REPRESENTATIVE_REQUEST_BYTES,3688875);assert.equal(plan.E2_BODY_PROFILE_TARGETS[3],3688875);assert.equal(plan.E2_BODY_PROFILE_TARGETS[4],4611094);
});

test('W01 reconciliation rejects zero-row completion and every count/state drift',()=>{assert.equal(plan.reconcileFullWrite([finalRow],1),true);assert.equal(plan.reconcileFullWrite([finalRow],0),false);for(const key of Object.keys(finalRow))assert.equal(plan.reconcileFullWrite([{...finalRow,[key]:key==='run_status'?'started':999}],1),false);});

test('affinity plans preserve exact strings, explicit ordering, native JSON and isolated storage probes',()=>{const affinity=plan.buildAffinityPlan(),raw=JSON.stringify(affinity);for(const value of ['42','3.125','0042','0','1','true','false'])assert.ok(affinity.statements.flatMap(row=>row.params).includes(value));for(const token of ['typeof(CAST','COLLATE BINARY','text_order','numeric_order','json_type','sqlite_value_type'])assert.match(raw,new RegExp(token.replace(/[()]/g,'\\$&')));assert.deepEqual(JSON.parse(affinity.statements.at(-1).params[0]).map(row=>row.value),[42,3.125,'0042',true,null]);assert.equal(plan.buildStorageAffinityMutation().mutation,true);assert.equal(plan.buildStorageAffinityReconciliation().mutation,false);});

test('expected live semantic schema has a separate deterministic repository-owned identity',()=>{assert.equal(E2_EXPECTED_SEMANTIC_SCHEMA.length,5);assert.equal(deriveLiveSchemaFingerprint(E2_EXPECTED_SEMANTIC_SCHEMA),E2_EXPECTED_SEMANTIC_SCHEMA_FINGERPRINT);assert.equal(validateSetupLiveSchema(clone(E2_EXPECTED_SEMANTIC_SCHEMA)),E2_EXPECTED_SEMANTIC_SCHEMA_FINGERPRINT);assert.equal(canonicalizeLiveSchema(E2_EXPECTED_SEMANTIC_SCHEMA),canonicalizeLiveSchema(clone(E2_EXPECTED_SEMANTIC_SCHEMA)));assert.notEqual(E2_EXPECTED_SEMANTIC_SCHEMA_FINGERPRINT,plan.E2_SETUP_SCHEMA_FINGERPRINT);});

test('semantic validation rejects every required same-name structural drift',()=>{
  const drifts={
    column_type:s=>{s[0].columns[0].type='INTEGER';},column_order:s=>{s[0].columns.reverse();s[0].columns.forEach((v,i)=>v.cid=i);},not_null:s=>{s[0].columns[0].notnull=0;},default:s=>{s[4].columns[2].dflt_value='1';},pk_position:s=>{s[0].columns[0].pk=2;},missing_unique:s=>{s[0].indexes.pop();},unexpected_index:s=>{s[0].indexes.push(clone(s[0].indexes[0]));},index_order:s=>{s[0].indexes[0].columns.reverse();s[0].indexes[0].columns.forEach((v,i)=>v.seqno=i);},index_collation:s=>{s[0].indexes[0].columns[0].coll='NOCASE';},foreign_key_target:s=>{s[2].foreignKeys[0].table='e2_entities';},foreign_key_action:s=>{s[2].foreignKeys[0].on_delete='CASCADE';},required_check:s=>{s[0].checks=[];},extra_column:s=>{s[0].columns.push({cid:4,name:'extra',type:'TEXT',notnull:0,dflt_value:null,pk:0,hidden:0});},missing_column:s=>{s[0].columns.pop();}
  };
  for(const [name,mutate] of Object.entries(drifts)){const observed=clone(E2_EXPECTED_SEMANTIC_SCHEMA);mutate(observed);assert.throws(()=>validateSetupLiveSchema(observed),/semantic_mismatch/,name);}
});

test('CHECK extraction tolerates SQLite whitespace normalization but not changed semantics',()=>{const observed=clone(E2_EXPECTED_SEMANTIC_SCHEMA);observed[0].sql='CREATE TABLE e2_atomicity (... CHECK ( valid_value IN ( 0 , 1 ) ))';delete observed[0].checks;assert.equal(validateSetupLiveSchema(observed),E2_EXPECTED_SEMANTIC_SCHEMA_FINGERPRINT);observed[0].sql='CREATE TABLE e2_atomicity (... CHECK (valid_value IN (0,1,2)))';assert.throws(()=>validateSetupLiveSchema(observed),/semantic_mismatch/);});

test('initial schema policy rejects unknown system-looking and production objects',()=>{assert.equal(validateInitialLiveObjects([]),true);assert.equal(validateInitialLiveObjects([{type:'table',name:'sqlite_sequence'}]),true);for(const row of [{type:'table',name:'_cf_future'},{type:'view',name:'sqlite_sequence'},{type:'table',name:'shadow_observations'}])assert.throws(()=>validateInitialLiveObjects([row]));});

test('HTTP adapter accepts only authentic plans and internally owns exact metadata/query requests',async()=>{const calls=[];const adapter=createE2LiveHttpAdapter({accountId:rawAccount,databaseId:rawDatabase,token:'test-token',identity,fetchImpl:async(...args)=>{calls.push(args);return {};}});assert.deepEqual(Object.keys(adapter),['readExactMetadata','execute']);await adapter.readExactMetadata();const authentic=plan.buildStatementProfile(1);await adapter.execute(authentic);assert.equal(calls[0][1].method,'GET');assert.equal(calls[0][0],`https://api.cloudflare.com/client/v4/accounts/${rawAccount}/d1/database/${rawDatabase}`);assert.equal(calls[1][1].method,'POST');assert.equal(calls[1][0],`${calls[0][0]}/query`);assert.deepEqual(JSON.parse(calls[1][1].body),authentic.statements[0]);assert.equal(E2_LIVE_HTTP_CAPABILITY.host,'api.cloudflare.com');assert.throws(()=>adapter.execute('SELECT 1'),/plan_untrusted/);assert.throws(()=>adapter.execute({statements:[{sql:'DELETE FROM anything'}]}),/plan_untrusted/);assert.equal(calls.length,2);});

test('HTTP authority construction rejects production and mismatched identities',()=>{const make=value=>createE2LiveHttpAdapter({accountId:rawAccount,databaseId:rawDatabase,token:'x',identity:value,fetchImpl:async()=>({})});assert.throws(()=>make({...identity,databaseName:'teamsheet-data'}));assert.throws(()=>make({...identity,accountFingerprint:identity.productionAccountFingerprint,approvedAccountFingerprint:identity.productionAccountFingerprint}));assert.throws(()=>make({...identity,databaseFingerprint:e2IdentityFingerprint('wrong')}));assert.throws(()=>createE2LiveHttpAdapter({accountId:'other',databaseId:rawDatabase,token:'x',identity,fetchImpl:async()=>({})}));});

test('atomicity accepts only A01 success/complete and A02/A03 known failure/full rollback',async()=>{await assert.doesNotReject(runAtomicVariant('A01',E2_LIVE_RESPONSE_CLASS.SUCCESS,[{sequence_no:1},{sequence_no:2},{sequence_no:3}]));await assert.rejects(runAtomicVariant('A01',E2_LIVE_RESPONSE_CLASS.SQL_FAILURE,[]),/a01_rejected/);for(const id of ['A02','A03']){await assert.doesNotReject(runAtomicVariant(id,E2_LIVE_RESPONSE_CLASS.SQL_FAILURE,[]));await assert.rejects(runAtomicVariant(id,E2_LIVE_RESPONSE_CLASS.SUCCESS,[]),new RegExp(`${id.toLowerCase()}_rejected`));await assert.rejects(runAtomicVariant(id,E2_LIVE_RESPONSE_CLASS.SQL_FAILURE,[{sequence_no:1}]),new RegExp(`${id.toLowerCase()}_rejected`));await assert.rejects(runAtomicVariant(id,E2_LIVE_RESPONSE_CLASS.SQL_FAILURE,[{sequence_no:1},{sequence_no:2},{sequence_no:3}]),new RegExp(`${id.toLowerCase()}_rejected`));}});

test('orchestration reaches fixed 125% gate and dispatches every mutation once',async()=>{const seen=[];const result=await runE2LiveContract(options({query:async item=>{seen.push(item.caseId);return responseFor(item.caseId);}}));assert.equal(result.state,'STOP');assert.deepEqual(seen.slice(-2),['W00','W01']);assert.equal(seen.at(seen.indexOf('A01')-1),`L-body-${plan.E2_BODY_PROFILE_TARGETS.at(-1)}`);for(const id of ['F-SCHEMA-SETUP','A01','A02','A03','P-STORAGE-WRITE','W00','W01'])assert.equal(result.dispatchCounts[id],1);});

test('every ambiguous mutation reconciles once, records state, stops, and is never retried',async()=>{for(const id of ['F-SCHEMA-SETUP','A01','A02','A03','P-STORAGE-WRITE','W00','W01']){const dispatches=[],reconciliations=[];let error;try{await runE2LiveContract(options({query:async item=>{dispatches.push(item.caseId);if(item.caseId===id)throw new Error('secret transport body');return responseFor(item.caseId);},reconcile:async item=>{reconciliations.push(item.caseId);return reconciliationFor(item);}}));}catch(value){error=value;}assert.ok(error,id);assert.equal(dispatches.filter(value=>value===id).length,1,id);const expected={"F-SCHEMA-SETUP":'SCHEMA-RECONCILE',A01:'A04-A01',A02:'A04-A02',A03:'A04-A03','P-STORAGE-WRITE':'P-STORAGE-READ',W00:'W00-R',W01:'W01-R'}[id];assert.equal(reconciliations.filter(value=>value===expected).length,1,id);const item=error.evidence.find(value=>value.testCaseId===id);assert.equal(item.responseClassification,E2_LIVE_RESPONSE_CLASS.UNKNOWN);assert.notEqual(item.reconciliationClassification,null);}});

test('failed 100% body gate stops before all atomicity and write mutations',async()=>{const seen=[];await assert.rejects(runE2LiveContract(options({query:async item=>{seen.push(item.caseId);return {classification:item.caseId===`L-body-${plan.E2_BODY_PROFILE_TARGETS[3]}`?E2_LIVE_RESPONSE_CLASS.TRANSPORT:responseFor(item.caseId).classification};}})),/body_profile_failed/);assert.ok(!seen.includes('A01'));assert.ok(!seen.includes('W01'));});

test('evidence rejects or bounds malicious caller/provider fields without nested passthrough',async()=>{await assert.rejects(runE2LiveContract(options({runnerIdentity:'Authorization: Bearer stolen'})),/runner_identity_invalid/);const result=await runE2LiveContract(options({query:async item=>({...responseFor(item.caseId),providerTimingMs:Infinity,rowsRead:-1,rowsWritten:2.5,changes:999999999,syntheticTableCounts:{e2_runs:1,token:'stolen'},provider:{Authorization:'Bearer stolen'},rawBody:'SELECT secret'})}));const raw=JSON.stringify(result.evidence);for(const forbidden of ['Bearer stolen','SELECT secret','Authorization','"token"','"provider"','"rawBody"'])assert.doesNotMatch(raw,new RegExp(forbidden));for(const item of result.evidence){assert.equal(item.providerTimingMs,0);assert.equal(item.rowsRead,0);assert.equal(item.rowsWritten,0);assert.equal(item.changes,0);assert.equal(item.syntheticTableCounts,null);}});

test('static authority surface has no generic Cloudflare or production mutation path',()=>{const files=['workers/data-platform/e2-live-http-adapter.mjs','workers/data-platform/e2-live-orchestrator.mjs'];const raw=files.map(file=>fs.readFileSync(file,'utf8')).join('\n');for(const forbidden of ['wrangler deploy','set -x','/workers/scripts','/access/','/secrets','/zones','/routes','database/create','database/delete','console.log','process.env','listDatabases','baseUrl'])assert.doesNotMatch(raw,new RegExp(forbidden.replace('/','\\/'),'i'));});
