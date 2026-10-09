import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {diagnoseCorrectedAnnotations,ANNOTATION_PROBE_CREATION_SHA,ANNOTATION_PROBE_VERSION_ID,
  ANNOTATION_PROBE_CONTRACT,ANNOTATION_PROBE_WORKER} from '../workers/api-football-collector/corrected-version-annotation-probe.mjs';

const id=ANNOTATION_PROBE_VERSION_ID;
const expected=Object.freeze({
  'workers/message':'API-Football corrected R1/R2 Version from '+ANNOTATION_PROBE_CREATION_SHA,
  'workers/tag':'api-football-corrected-r1-r2-'+ANNOTATION_PROBE_CREATION_SHA.slice(0,12)
});
const probe=(annotations,other={})=>diagnoseCorrectedAnnotations({
  stable:{id,...(other.stable??{})},
  beta:{id,annotations,...(other.beta??{})},
  versionId:id,expected
});

test('approved annotations are compared exactly without claiming Version qualification',()=>{
  const result=probe({...expected});
  assert.equal(result.contract,ANNOTATION_PROBE_CONTRACT);
  assert.equal(result.classification,'EXACT_TWO_FIELD_ANNOTATIONS');
  assert.equal(result.version_id_matches,true);
  assert.equal(result.beta_annotations.workers_message_exact_match,true);
  assert.equal(result.beta_annotations.workers_tag_exact_match,true);
  assert.equal(result.beta_annotations.additional_annotation_count,0);
  assert.equal(result.original_whole_object_comparison_equal,true);
  assert.equal(result.version_qualified,false);
});
test('key order alone is distinguishable from real value drift',()=>{
  const result=probe({'workers/tag':expected['workers/tag'],'workers/message':expected['workers/message']});
  assert.equal(result.classification,'REQUIRED_ANNOTATIONS_EXACT_KEY_ORDER_ONLY');
  assert.equal(result.beta_annotations.workers_message_exact_match,true);
  assert.equal(result.beta_annotations.workers_tag_exact_match,true);
  assert.equal(result.original_whole_object_comparison_equal,false);
});
test('the documented server-owned key is counted, not silently accepted or valued',()=>{
  const result=probe({...expected,'workers/triggered_by':'secret-unrelated-payload'});
  assert.equal(result.classification,'REQUIRED_ANNOTATIONS_EXACT_WITH_EXTRA_KEYS');
  assert.equal(result.beta_annotations.additional_annotation_count,1);
  assert.equal(result.beta_annotations.documented_triggered_by_key_present,true);
  assert.equal(result.beta_annotations.unrecognised_additional_key_count,0);
  assert.equal(result.original_whole_object_comparison_equal,false);
  assert.equal(result.version_qualified,false);
  assert.doesNotMatch(JSON.stringify(result),/secret-unrelated-payload/);
});
test('unknown metadata is counted without exposing its name or value',()=>{
  const result=probe({...expected,'private-unexpected-field':'do-not-print'});
  assert.equal(result.classification,'REQUIRED_ANNOTATIONS_EXACT_WITH_EXTRA_KEYS');
  assert.equal(result.beta_annotations.unrecognised_additional_key_count,1);
  assert.doesNotMatch(JSON.stringify(result),/private-unexpected-field|do-not-print/);
});
test('wrong required annotation values are separately exposed as closed booleans',()=>{
  for(const key of ['workers/message','workers/tag']){
    const result=probe({...expected,[key]:'untrusted-value'});
    assert.equal(result.classification,'REQUIRED_ANNOTATION_VALUE_MISMATCH');
    assert.equal(result.beta_annotations[key==='workers/message'?'workers_message_exact_match':'workers_tag_exact_match'],false);
    assert.equal(result.version_qualified,false);
    assert.doesNotMatch(JSON.stringify(result),/untrusted-value/);
  }
});
test('missing required fields fail the observation classification',()=>{
  for(const key of ['workers/message','workers/tag']){
    const obj={...expected};delete obj[key];
    const result=probe(obj);
    assert.equal(result.classification,'REQUIRED_ANNOTATION_MISSING');
    assert.equal(result.beta_annotations[key==='workers/message'?'workers_message_present':'workers_tag_present'],false);
  }
});
test('malformed annotations never appear to be legitimate required fields',()=>{
  for(const actual of [null,[],true,'unexpected',14,undefined]){
    const result=probe(actual);
    assert.equal(result.classification,'BETA_ANNOTATION_SHAPE_INVALID');
    assert.equal(result.beta_annotations.workers_message_exact_match,false);
    assert.equal(result.beta_annotations.workers_tag_exact_match,false);
  }
});
test('both independent Version identifiers must match the pinned target',()=>{
  for(const update of [{stable:{id:'different'}},{beta:{id:'different'}}]){
    const result=probe(expected,update);
    assert.equal(result.classification,'VERSION_ID_MISMATCH');
    assert.equal(result.version_id_matches,false);
    assert.equal(result.version_qualified,false);
  }
});
test('stable and beta representation differences are reported without leaking values',()=>{
  const same=probe(expected,{stable:{annotations:{...expected}}});
  assert.equal(same.stable_beta_required_values_agree,true);
  const diff=probe(expected,{stable:{annotations:{...expected,'workers/tag':'do-not-expose'}}});
  assert.equal(diff.stable_beta_required_values_agree,false);
  assert.equal(diff.classification,'EXACT_TWO_FIELD_ANNOTATIONS');
  assert.doesNotMatch(JSON.stringify(diff),/do-not-expose/);
  assert.equal(probe(expected).stable_beta_required_values_agree,null);
});
test('invalid local expected identity fails before any diagnostic',()=>{
  assert.throws(()=>diagnoseCorrectedAnnotations({stable:{id},beta:{id},versionId:id,expected:{}}),
    /ANNOTATION_PROBE_EXPECTED_IDENTITY_INVALID/);
});
test('manual-only workflow proves exact-main CI and original immutable evidence before Cloudflare reads',()=>{
  const yml=fs.readFileSync('.github/workflows/api-football-corrected-version-annotation-proof.yml','utf8');
  assert.match(yml,/workflow_dispatch:/);
  assert.doesNotMatch(yml,/^\s+(push|pull_request|schedule):/m);
  assert.match(yml,/github\.run_attempt == 1/);
  assert.match(yml,/environment:\s*\n\s+name: data-steward-readonly/);
  assert.match(yml,/deployment: false/);
  assert.match(yml,/37841681952/);
  assert.match(yml,/dfac83bfc4bd67baa5dad7b59a8c51bc6f9d29ba474a0afe1c6513fa66629e43/);
  assert.match(yml,/Tests and deterministic build/);
  const pinned=yml.indexOf('Validate source evidence before any Cloudflare GET');
  const reading=yml.indexOf('Read existing stable and beta Version metadata');
  assert.ok(pinned>0&&reading>pinned);
  const forbidden=['CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN','CLOUDFLARE_ATTENDED_MUTATION_TOKEN',
    'API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET',
    'wrangler deploy','run-gate-c.mjs','run-corrected-version-upload.mjs',
    'run-corrected-version-readonly.mjs'];
  for(const term of forbidden)assert.equal(yml.includes(term),false,term);
  const source=fs.readFileSync('workers/api-football-collector/corrected-version-annotation-probe.mjs','utf8');
  assert.match(source,/method:'GET'/);
  assert.match(source,/redirect:'manual'/);
  assert.match(source,/\?include=modules/);
  assert.match(source,/ANNOTATION_PROBE_VERSION_ID='509f5a98-38fc-4e58-8a26-1b8fc4c9c787'/);
  assert.match(source,/ANNOTATION_PROBE_CREATION_SHA='073ac6a53d09f004e5ada5b94fb1cea6df3ef228'/);
  assert.equal(ANNOTATION_PROBE_WORKER,'teamsheet-api-football-shadow-collector');
  assert.doesNotMatch(source,/method:'POST'|method:'PUT'|method:'DELETE'/);
  const validator=fs.readFileSync('workers/api-football-collector/corrected-version-preparation.mjs','utf8');
  assert.match(validator,/if\(!correctedAnnotationsMatch\(beta\.annotations,identity\.metadata\.annotations\)\)meta\('annotations_mismatch'\)/);
  assert.match(validator,/Reflect\.ownKeys\(actual\)/);
  assert.match(validator,/Object\.hasOwn\(actual,'workers\/triggered_by'\)/);
  assert.match(validator,/typeof actual\['workers\/triggered_by'\]==='string'/);
  assert.doesNotMatch(validator,/if\(!same\(beta\.annotations,identity\.metadata\.annotations\)\)/);
  assert.match(validator,/module_content_mismatch/);
});
