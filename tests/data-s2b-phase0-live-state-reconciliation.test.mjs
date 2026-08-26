import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractD1DatabaseDetails,normaliseD1Binding,validateWorkerBindingSet} from '../workers/data-platform/phase0/readonly-preflight.mjs';

const helper=fs.readFileSync('workers/data-platform/phase0/readonly-preflight.mjs','utf8');

test('Phase 0 pre-mutation bindings accept required D1 with optional retained DATA-S1 secret',()=>{
  const d1={type:'d1',name:'TEAMSHEET_DATA_DB',database_id:'db-current'};
  const retained={type:'secret_text',name:'DATA_S1_HTTP_AUTH_TOKEN'};
  assert.deepEqual(validateWorkerBindingSet({bindings:[d1]},'pre'),{bindings:[d1]});
  assert.deepEqual(validateWorkerBindingSet({bindings:[d1,retained]},'pre'),{bindings:[d1,retained]});
  assert.deepEqual(validateWorkerBindingSet({bindings:[retained,d1]},'pre'),{bindings:[retained,d1]});
});

test('Phase 0 never reads the retained DATA-S1 secret value',()=>{
  const d1={type:'d1',name:'TEAMSHEET_DATA_DB',database_id:'db-current'};
  const retained={type:'secret_text',name:'DATA_S1_HTTP_AUTH_TOKEN'};
  Object.defineProperty(retained,'text',{get(){throw new Error('secret value was read');}});
  assert.doesNotThrow(()=>validateWorkerBindingSet({bindings:[d1,retained]},'pre'));
  assert.doesNotMatch(helper,/DATA_S1_HTTP_AUTH_TOKEN[^\n]*(?:\.text|text:|value:)/);
});

test('Phase 0 pre-mutation bindings fail closed on live DATA-S2 season or unexplained drift',()=>{
  const d1={type:'d1',name:'TEAMSHEET_DATA_DB',database_id:'db-current'};
  const retained={type:'secret_text',name:'DATA_S1_HTTP_AUTH_TOKEN'};
  const season={type:'plain_text',name:'DATA_S2_SEASON',text:'2026-27'};
  assert.throws(()=>validateWorkerBindingSet({bindings:[d1,season]},'pre'),/season_var_unexpectedly_live/);
  for(const bindings of [
    [],
    [retained],
    [d1,d1],
    [d1,retained,retained],
    [{...d1,type:'kv_namespace'}],
    [d1,{...retained,type:'plain_text'}],
    [d1,{type:'secret_text',name:'EXTRA_SECRET'}],
    [d1,{type:'kv_namespace',name:'EXTRA_KV',namespace_id:'kv'}],
    [d1,{type:'r2_bucket',name:'EXTRA_R2',bucket_name:'bucket'}],
    [d1,{type:'service',name:'EXTRA_SERVICE',service:'worker'}]
  ])assert.throws(()=>validateWorkerBindingSet({bindings},'pre'),/worker_binding_set_drift/);
  assert.throws(()=>validateWorkerBindingSet({bindings:[d1]},'unknown'),/worker_binding_phase_invalid/);
});

test('Phase 0 execution selects pre-mutation binding validation and safe summary state',()=>{
  const main=helper.slice(helper.indexOf('async function main(){'));
  assert.match(main,/validateWorkerBindingSet\([^\n]+,'pre'\)/);
  assert.match(main,/DATA_S2_SEASON: \$\{report\.dataS2Season\} \(expected pre-mutation\)/);
  assert.match(main,/Retained DATA_S1_HTTP_AUTH_TOKEN binding: \$\{report\.retainedDataS1Secret\}/);
  assert.match(main,/retainedDataS1Secret:retainedDataS1Secret\?'PRESENT':'ABSENT'/);
});

test('Phase 0 resolves D1 identity from the Worker binding UUID, not a name search',()=>{
  const binding=normaliseD1Binding({bindings:[{type:'d1',name:'TEAMSHEET_DATA_DB',database_id:'db-target'}]});
  assert.deepEqual(extractD1DatabaseDetails({name:'teamsheet-data',uuid:'db-target',file_size:152000},{uuid:binding.databaseId}),{name:'teamsheet-data',uuid:'db-target',file_size:152000});
  assert.throws(()=>extractD1DatabaseDetails({name:'teamsheet-data-s1b-validation-20260822',uuid:'db-target',file_size:1},{uuid:binding.databaseId}),/database_details_contract_invalid/);
  assert.throws(()=>extractD1DatabaseDetails({name:'teamsheet-data',uuid:'db-other',file_size:1},{uuid:binding.databaseId}),/database_details_contract_invalid/);
  const main=helper.slice(helper.indexOf('async function main(){'));
  assert.match(main,/const databaseId=d1\.databaseId;/);
  assert.match(main,/\{uuid:databaseId\}\);/);
  assert.doesNotMatch(main,/d1\/database\?name=teamsheet-data/);
});
