import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {
  RECONCILIATION_QUERIES,NO_SUBMITTED_MAPPING_STATE_VISIBLE,COMPLETE_QUALIFIED_MAPPING_VISIBLE,
  PARTIAL_OR_UNEXPECTED_MAPPING_STATE_REQUIRES_OWNER_ATTENTION,STATE_CANNOT_SAFELY_BE_DETERMINED,
  classifyMapping0006Reconciliation,decodeReconciliationD1Response,runMapping0006Reconciliation
} from '../workers/data-platform/migration6/reconciliation.mjs';

const workflow=fs.readFileSync('.github/workflows/api-football-mapping-0006-reconciliation.yml','utf8');
const source=fs.readFileSync('workers/data-platform/migration6/reconciliation.mjs','utf8');
const ledger=Array.from({length:6},(_,index)=>({version:index+1,name:[null,'shadow_data_foundation','official_fpl_structured_history','production_query_plan_indexes','api_football_shadow_identity','api_football_shadow_runtime','api_football_mapping_qualification'][index+1],applied_at:'2026-09-18T00:00:00.000Z'}));
const rows=(values={})=>({ledger,foreignKeys:[],mappings:[{total:0,expected_shape:0}],qualifications:[{total:0,staging:0,committed:0,expected_provenance:0}],members:[{total:0,unique_provider:0,unique_fpl:0,expected_shape:0}],heads:[{total:0,expected_shape:0}],...values});
const payload=data=>({success:true,result:Object.keys(RECONCILIATION_QUERIES).map(key=>({success:true,results:data[key],meta:{rows_read:1,rows_written:0}}))});

test('SQL is fixed, aggregate-only and read-only',()=>{
  assert.deepEqual(Object.keys(RECONCILIATION_QUERIES),['ledger','foreignKeys','mappings','qualifications','members','heads']);
  for(const sql of Object.values(RECONCILIATION_QUERIES)){
    assert.match(sql,/^(SELECT|PRAGMA foreign_key_check)/);
    assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|VACUUM)\b/i);
    assert.doesNotMatch(sql,/provider_entity_id\s*,|canonical_entity_id\s*,|SELECT\s+\*/i);
  }
});

test('workflow is manual one-shot exact-main exact-Verify and read-only credential gated',()=>{
  assert.match(workflow,/on:\n  workflow_dispatch:/);assert.doesNotMatch(workflow,/\n  (?:push|schedule|pull_request):/);
  assert.match(workflow,/github\.run_attempt == 1/);assert.match(workflow,/refs\/heads\/main/);
  assert.match(workflow,/Tests and deterministic build/);assert.match(workflow,/name: data-steward-readonly/);
  assert.match(workflow,/DATA_STEWARD_CLOUDFLARE_READ_TOKEN/);
  assert.doesNotMatch(workflow,/CLOUDFLARE_D1_TOKEN|API_FOOTBALL_OWNER_CROSSWALK_JSON|API_FOOTBALL_API_KEY|MIGRATION_0006_PHASE|time_travel|wrangler\s+(?:deploy|secret|triggers)|api-sports\.io/i);
  assert.doesNotMatch(source,/API_FOOTBALL_OWNER_CROSSWALK_JSON|API_FOOTBALL_API_KEY|time_travel|api-sports\.io/i);
});

test('zero, exact complete and partial states classify distinctly',()=>{
  assert.equal(classifyMapping0006Reconciliation(rows()),NO_SUBMITTED_MAPPING_STATE_VISIBLE);
  const complete=rows({mappings:[{total:20,expected_shape:20}],qualifications:[{total:1,staging:0,committed:1,expected_provenance:1}],members:[{total:20,unique_provider:20,unique_fpl:20,expected_shape:20}],heads:[{total:1,expected_shape:1}]});
  assert.equal(classifyMapping0006Reconciliation(complete),COMPLETE_QUALIFIED_MAPPING_VISIBLE);
  assert.equal(classifyMapping0006Reconciliation(rows({mappings:[{total:1,expected_shape:1}]})),PARTIAL_OR_UNEXPECTED_MAPPING_STATE_REQUIRES_OWNER_ATTENTION);
});

test('malformed state and foreign-key violations fail closed',()=>{
  assert.equal(classifyMapping0006Reconciliation(null),STATE_CANNOT_SAFELY_BE_DETERMINED);
  assert.equal(classifyMapping0006Reconciliation(rows({members:[]})),STATE_CANNOT_SAFELY_BE_DETERMINED);
  assert.equal(classifyMapping0006Reconciliation(rows({foreignKeys:[{table:'synthetic'}]})),STATE_CANNOT_SAFELY_BE_DETERMINED);
});

test('complete reconciliation accepts dynamic integrity hashes only through structural and provenance predicates',()=>{
  assert.doesNotMatch(source,/ad89373375a6deed3763126225894e89d380b11ffd32ffbb5b6a1213331a4a02/);
  assert.match(RECONCILIATION_QUERIES.qualifications,/qualification_id='api-football:team-mapping:'\|\|fpl_season\|\|':'\|\|persistence_integrity_hash/);
  assert.match(RECONCILIATION_QUERIES.qualifications,/persistence_integrity_hash NOT GLOB/);
  assert.match(RECONCILIATION_QUERIES.members,/receipt_integrity_hash NOT GLOB/);
});

test('D1 response must contain exact successful reads and report zero written rows',()=>{
  const valid=payload(rows());assert.ok(decodeReconciliationD1Response(valid));
  valid.result[0].meta.rows_written=1;assert.equal(decodeReconciliationD1Response(valid),null);
  assert.equal(decodeReconciliationD1Response({success:true,result:[]}),null);
  assert.equal(decodeReconciliationD1Response({...payload(rows()),errors:[{code:1}]}),null);
});

test('execution emits only sanitized aggregate classification and cannot leak private sentinels',async()=>{
  const account='synthetic-account',token='synthetic-read-token',sentinel='PRIVATE_PAIR_SENTINEL_999_TO_888';
  let request;
  const report=await runMapping0006Reconciliation({env:{DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID:account,DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT:createHash('sha256').update(account).digest('hex'),DATA_STEWARD_CLOUDFLARE_READ_TOKEN:token,[sentinel]:sentinel},fetchImpl:async(url,options)=>{request={url,options};return {status:200,json:async()=>payload(rows())};}});
  assert.equal(report.classification,NO_SUBMITTED_MAPPING_STATE_VISIBLE);assert.equal(report.productionMutations,0);assert.equal(report.apiFootballRequests,0);
  assert.equal(request.options.method,'POST');assert.doesNotMatch(request.options.body,new RegExp(sentinel));
  assert.doesNotMatch(JSON.stringify(report),new RegExp(sentinel));assert.doesNotMatch(workflow,/upload-artifact[\s\S]*(?:entity_mappings|provider_entity_id|canonical_entity_id)/i);
});
