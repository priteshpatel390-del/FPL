// Immutable deployed Version preservation (repository only). No Cloudflare, D1 or API-Football action is performed.
// Proves: the deployed Version 4171f3cf stays reproducible byte-for-byte from SHA-256-verified historical snapshots,
// the corrected-code identity is a separate, upload-less boundary, and the R1 failure-class encoding breaks no consumer.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {ATTENDED_VERSION_MODULE_SHA256,buildLifecycleCloneIdentity,buildReviewedAttendedIdentity} from '../workers/api-football-collector/attended-version.mjs';
import {
  CORRECTED_VERSION_CANDIDATE_CHANGED_FROM_DEPLOYED,CORRECTED_VERSION_CANDIDATE_CONTRACT,CORRECTED_VERSION_CANDIDATE_MODULE_SHA256,
  CORRECTED_VERSION_CANDIDATE_STATE,CORRECTED_VERSION_CANDIDATE_SUPERSEDES_VERSION_ID,buildCorrectedVersionCandidateIdentity,
  correctedVersionCandidateModuleSha256,readCorrectedCandidateModuleSource
} from '../workers/api-football-collector/corrected-version-candidate.mjs';
import {
  REMEDIATED_SNAPSHOT_PURPOSE,REMEDIATED_VERSION_CREATION_SHA,REMEDIATED_VERSION_ID,REVIEWED_REMEDIATED_MODULE_SNAPSHOTS,readReviewedRemediatedModuleSource
} from '../workers/api-football-collector/reviewed-remediated-snapshots.mjs';
import {REVIEWED_ATTENDED_MODULE_SNAPSHOTS,REVIEWED_MODULE_PATHS,resolveModuleGraph} from '../workers/api-football-collector/stage-inactive-version.mjs';
import {
  TRANSPORT_REMEDIATED_VERSION_CONTRACT,TRANSPORT_REMEDIATED_VERSION_MODULE_SHA256,buildTransportRemediatedVersionIdentity,
  buildTransportRemediatedVersionUploadForm,readCurrentTreeModuleSource,resolveTransportRemediatedModuleGraph
} from '../workers/api-football-collector/transport-remediated-version.mjs';
import {PROMOTION_CANDIDATE_CREATION_SHA,PROMOTION_CANDIDATE_VERSION_ID} from '../workers/api-football-collector/transport-remediated-deployment-promotion.mjs';
import {composeSchemaFailureClass} from '../workers/api-football-collector/runtime-contracts.mjs';

const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const sha256=value=>createHash('sha256').update(value).digest('hex');
const SNAPSHOT_DIRECTORY='workers/api-football-collector/reviewed-remediated-module-snapshots';
// Gate A run 37680114065 recorded these for the Version it created (CLAUDE.md, Gate A closeout).
const GATE_A_GRAPH_SHA256='03db54c4faf0bfc08f52382e56fc165cadccb7337786581053328e07f2f8f6cc';
const GATE_A_METADATA_SHA256='67097c838c1e0f9a5f2c765ea17dff3eb690bb4e646688c35cab4c66055b1119';
const CHANGED_PATHS=[
  'workers/api-football-collector/activation-orchestrator.mjs','workers/api-football-collector/collector.mjs',
  'workers/api-football-collector/planner-orchestrator.mjs','workers/api-football-collector/runtime-contracts.mjs',
  'workers/api-football-collector/semantic-validation.mjs'
];

test('deployed Version constants are unchanged and agree across the snapshot, promotion and preparation modules',()=>{
  assert.equal(REMEDIATED_VERSION_ID,'4171f3cf-953e-452e-9e5f-068df9a3ca47');assert.equal(REMEDIATED_VERSION_ID,PROMOTION_CANDIDATE_VERSION_ID);
  assert.equal(REMEDIATED_VERSION_CREATION_SHA,'f01ccff5b13a4bbc98d7927cf620f69f46c4c54c');assert.equal(REMEDIATED_VERSION_CREATION_SHA,PROMOTION_CANDIDATE_CREATION_SHA);
  assert.equal(REMEDIATED_SNAPSHOT_PURPOSE,'HISTORICAL_IDENTITY_VERIFICATION_ONLY');
  assert.equal(TRANSPORT_REMEDIATED_VERSION_CONTRACT,'api-football-transport-remediated-version-v1');
  assert.equal(CORRECTED_VERSION_CANDIDATE_SUPERSEDES_VERSION_ID,REMEDIATED_VERSION_ID);
});

test('snapshot set is exactly the 17 reviewed modules, stored as inert .snapshot files, each verified against its pinned raw SHA-256',()=>{
  assert.deepEqual(Object.keys(REVIEWED_REMEDIATED_MODULE_SNAPSHOTS).sort(),[...REVIEWED_MODULE_PATHS].sort());
  assert.equal(REVIEWED_MODULE_PATHS.length,17);
  const files=fs.readdirSync(path.join(root,SNAPSHOT_DIRECTORY)).sort();
  assert.deepEqual(files,Object.values(REVIEWED_REMEDIATED_MODULE_SNAPSHOTS).map(entry=>path.basename(entry.file)).sort());
  assert.ok(files.every(file=>file.endsWith('.mjs.snapshot')),'snapshots must not be loadable .mjs modules');
  for(const [repoPath,entry] of Object.entries(REVIEWED_REMEDIATED_MODULE_SNAPSHOTS)){
    assert.match(entry.sha256,/^[0-9a-f]{64}$/);assert.ok(Object.isFrozen(entry));
    assert.equal(sha256(read(entry.file)),entry.sha256,repoPath);
    assert.equal(readReviewedRemediatedModuleSource(repoPath),read(entry.file),repoPath);
  }
  assert.ok(Object.isFrozen(REVIEWED_REMEDIATED_MODULE_SNAPSHOTS));
});

test('snapshot reads reject tampered bytes, missing files and unreviewed paths',()=>{
  for(const repoPath of REVIEWED_MODULE_PATHS){
    const original=read(REVIEWED_REMEDIATED_MODULE_SNAPSHOTS[repoPath].file);
    assert.throws(()=>readReviewedRemediatedModuleSource(repoPath,{readText:()=>original+' '}),/collector_remediated_snapshot_drift/,repoPath);
    assert.throws(()=>readReviewedRemediatedModuleSource(repoPath,{readText:()=>original.slice(0,-1)}),/collector_remediated_snapshot_drift/,repoPath);
    assert.throws(()=>readReviewedRemediatedModuleSource(repoPath,{readText:()=>{throw new Error('ENOENT');}}),/collector_remediated_snapshot_missing/,repoPath);
  }
  for(const bad of ['src/main.mjs','../etc/passwd','workers/api-football-collector/run-gate-c.mjs','toString','__proto__','constructor'])
    assert.throws(()=>readReviewedRemediatedModuleSource(bad),/collector_remediated_snapshot_unreviewed_module/,bad);
});

test('snapshots are byte-identical to the creation commit (strict in CI; skipped only when the commit is absent from a shallow local clone)',t=>{
  try{execFileSync('git',['cat-file','-e',`${REMEDIATED_VERSION_CREATION_SHA}^{commit}`],{cwd:root,stdio:'ignore'});}
  catch{
    if(process.env.GITHUB_ACTIONS)assert.fail('creation commit must be present in CI (fetch-depth 0)');
    t.skip('creation commit not present in this shallow local clone');return;
  }
  for(const repoPath of REVIEWED_MODULE_PATHS){
    const committed=execFileSync('git',['show',`${REMEDIATED_VERSION_CREATION_SHA}:${repoPath}`],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
    assert.equal(committed,read(REVIEWED_REMEDIATED_MODULE_SNAPSHOTS[repoPath].file),repoPath);
    assert.equal(sha256(committed),REVIEWED_REMEDIATED_MODULE_SNAPSHOTS[repoPath].sha256,repoPath);
  }
});

test('the deployed Version is reproduced exactly: 17 module hashes, graph hash and metadata hash match the Gate A record',()=>{
  const identity=buildTransportRemediatedVersionIdentity(REMEDIATED_VERSION_CREATION_SHA);
  assert.equal(Object.keys(identity.moduleSha256).length,17);
  assert.deepEqual(identity.moduleSha256,TRANSPORT_REMEDIATED_VERSION_MODULE_SHA256);
  assert.equal(identity.graphSha256,GATE_A_GRAPH_SHA256);assert.equal(identity.metadataSha256,GATE_A_METADATA_SHA256);
  assert.equal(identity.contract,TRANSPORT_REMEDIATED_VERSION_CONTRACT);assert.equal(identity.approvedSha,REMEDIATED_VERSION_CREATION_SHA);
  // The uploaded multipart bytes are the verified snapshot bytes (specifier-rewritten exactly as in Gate A).
  const form=buildTransportRemediatedVersionUploadForm(REMEDIATED_VERSION_CREATION_SHA,{apiKey:'synthetic-api-key-0123456789',triggerSecret:'synthetic-trigger-secret-'.padEnd(48,'t')});
  const seen={};
  for(const [name,value] of form.entries())if(name!=='metadata')seen[name]=value;
  return Promise.all(Object.entries(seen).map(async([name,file])=>[name,sha256(await file.text())])).then(pairs=>assert.deepEqual(Object.fromEntries(pairs),TRANSPORT_REMEDIATED_VERSION_MODULE_SHA256));
});

test('historical identity is independent of the working tree: the current tree has moved on in exactly five modules and cannot pass as the deployed Version',()=>{
  const moved=REVIEWED_MODULE_PATHS.filter(repoPath=>readReviewedRemediatedModuleSource(repoPath)!==readCurrentTreeModuleSource(repoPath));
  assert.deepEqual(moved,CHANGED_PATHS);
  assert.throws(()=>buildTransportRemediatedVersionIdentity(REMEDIATED_VERSION_CREATION_SHA,{readFile:readCurrentTreeModuleSource}),/collector_transport_remediated_source_drift/);
  const graph=resolveTransportRemediatedModuleGraph();
  for(const repoPath of REVIEWED_MODULE_PATHS)assert.equal(graph.get(repoPath),readReviewedRemediatedModuleSource(repoPath),repoPath);
});

test('attended Version 04d79556 and its lifecycle clone still reproduce from verified snapshots, not from the working tree',()=>{
  const graph=resolveModuleGraph();
  for(const repoPath of REVIEWED_MODULE_PATHS){
    const expected=REVIEWED_ATTENDED_MODULE_SNAPSHOTS[repoPath]?read(REVIEWED_ATTENDED_MODULE_SNAPSHOTS[repoPath].file):readReviewedRemediatedModuleSource(repoPath);
    assert.equal(graph.get(repoPath),expected,repoPath);
  }
  assert.deepEqual(buildReviewedAttendedIdentity('d'.repeat(40)).moduleSha256,ATTENDED_VERSION_MODULE_SHA256);
  assert.deepEqual(buildLifecycleCloneIdentity('d'.repeat(40)).moduleSha256,ATTENDED_VERSION_MODULE_SHA256);
  // The attended reader may only differ from the deployed-Version snapshots in the two attended-specific snapshots.
  assert.deepEqual(Object.keys(REVIEWED_ATTENDED_MODULE_SNAPSHOTS).sort(),['src/decision-intelligence/api-football-foundation.mjs','workers/api-football-collector/collector.mjs']);
});

test('corrected-code identity is a distinct, pinned, upload-less boundary that cannot be satisfied by historical snapshots',()=>{
  const candidate=buildCorrectedVersionCandidateIdentity();
  assert.equal(candidate.contract,CORRECTED_VERSION_CANDIDATE_CONTRACT);assert.notEqual(candidate.contract,TRANSPORT_REMEDIATED_VERSION_CONTRACT);
  assert.equal(candidate.state,CORRECTED_VERSION_CANDIDATE_STATE);assert.equal(candidate.state,'NOT_CREATED_NOT_UPLOADED_NOT_DEPLOYED');
  assert.equal(candidate.uploadAuthorized,false);assert.equal(candidate.deploymentAuthorized,false);assert.ok(Object.isFrozen(candidate));
  assert.deepEqual(candidate.moduleSha256,CORRECTED_VERSION_CANDIDATE_MODULE_SHA256);
  assert.deepEqual(correctedVersionCandidateModuleSha256(),CORRECTED_VERSION_CANDIDATE_MODULE_SHA256);
  const deployed=buildTransportRemediatedVersionIdentity(REMEDIATED_VERSION_CREATION_SHA);
  assert.notEqual(candidate.graphSha256,deployed.graphSha256);
  const differing=Object.keys(CORRECTED_VERSION_CANDIDATE_MODULE_SHA256).filter(name=>CORRECTED_VERSION_CANDIDATE_MODULE_SHA256[name]!==TRANSPORT_REMEDIATED_VERSION_MODULE_SHA256[name]).sort();
  assert.deepEqual(differing,[...CORRECTED_VERSION_CANDIDATE_CHANGED_FROM_DEPLOYED].sort());assert.equal(differing.length,5);
  // Historical snapshot bytes can never be accepted as the corrected Version's source.
  assert.throws(()=>buildCorrectedVersionCandidateIdentity({readFile:readReviewedRemediatedModuleSource}),/corrected_version_candidate_source_drift/);
  // Any change to a reviewed current-tree module fails closed until a new pin is reviewed.
  for(const repoPath of REVIEWED_MODULE_PATHS)
    assert.throws(()=>buildCorrectedVersionCandidateIdentity({readFile:target=>target===repoPath?readCorrectedCandidateModuleSource(target)+'\n// drift\n':readCorrectedCandidateModuleSource(target)}),/corrected_version_candidate_source_drift/,repoPath);
  assert.throws(()=>readCorrectedCandidateModuleSource('src/main.mjs'),/corrected_version_candidate_unreviewed_module/);
  // The candidate still carries the corrected provider request contract and both forensic corrections.
  const collector=readCorrectedCandidateModuleSource('workers/api-football-collector/collector.mjs');
  assert.match(collector,/httpStatusClass/);assert.match(read('workers/api-football-collector/planner-orchestrator.mjs'),/r\.fixture_revision_id=gf\.fixture_revision_id/);
});

test('boundary is enforced statically: no import path, workflow or executor connects snapshots to a corrected Version',()=>{
  const code=file=>read(file).split('\n').filter(line=>!/^\s*\/\//.test(line)).join('\n');
  const candidate=code('workers/api-football-collector/corrected-version-candidate.mjs');
  assert.doesNotMatch(candidate,/reviewed-remediated-snapshots|reviewed-attended-module-snapshots|REVIEWED_REMEDIATED_MODULE_SNAPSHOTS|readReviewedRemediatedModuleSource/);
  assert.doesNotMatch(candidate,/FormData|new File\(|fetch\(|Authorization|api\.cloudflare\.com|createRequester|buildVersionUploadForm|multipart|\.bind\(|prepare\(/i);
  assert.doesNotMatch(candidate,/transport-remediated|TRANSPORT_REMEDIATED/,'candidate does not extend the deployed-Version contract');
  const imports=[...candidate.matchAll(/from\s+'([^']+)'/g)].map(match=>match[1]).sort();
  assert.deepEqual(imports,['../../src/decision-intelligence/canonical.mjs','./stage-inactive-version.mjs','node:crypto','node:fs','node:path','node:url']);
  const importersOf=name=>{
    const hits=[];
    const walk=directory=>{for(const entry of fs.readdirSync(path.join(root,directory),{withFileTypes:true})){
      const relative=`${directory}/${entry.name}`;
      if(entry.isDirectory()){if(!['node_modules','.git','reviewed-remediated-module-snapshots','reviewed-attended-module-snapshots'].includes(entry.name))walk(relative);}
      else if(/\.(mjs|js)$/.test(entry.name)){if(new RegExp(`(?:from|import)\\s*\\(?\\s*['"][^'"]*${name}`).test(read(relative)))hits.push(relative);}
      else if(/\.(yml|yaml|json)$/.test(entry.name)&&read(relative).includes(name))hits.push(relative);
    }};
    for(const directory of ['workers','src','scripts','.github'])walk(directory);
    if(fs.existsSync(path.join(root,'build.mjs'))&&read('build.mjs').includes(name))hits.push('build.mjs');
    return hits.sort();
  };
  assert.deepEqual(importersOf('corrected-version-candidate'),['workers/api-football-collector/corrected-version-preparation.mjs'],'only the separately reviewed corrected-Version preparation contract may import the candidate');
  assert.deepEqual(importersOf('reviewed-remediated-snapshots'),[
    'workers/api-football-collector/stage-inactive-version.mjs','workers/api-football-collector/transport-remediated-version.mjs'
  ]);
  // Neither the production application nor its build can reach the Worker identity modules.
  for(const file of ['src/main.mjs','src/providers/registry.mjs','build.mjs'])assert.doesNotMatch(read(file),/corrected-version-candidate|reviewed-remediated-snapshots/,file);
});

test('R1 encoding audit: no repository consumer compares failure_class or error_class to provider_schema_invalid by equality',()=>{
  const offenders=[];
  const scan=directory=>{for(const entry of fs.readdirSync(path.join(root,directory),{withFileTypes:true})){
    const relative=`${directory}/${entry.name}`;
    if(entry.isDirectory()){if(!['node_modules','.git','reviewed-remediated-module-snapshots','reviewed-attended-module-snapshots'].includes(entry.name))scan(relative);continue;}
    if(!/\.(mjs|js|sql|yml|yaml)$/.test(entry.name))continue;
    const text=read(relative);
    if(/(failure_class|error_class|failureClass|errorClass)\s*(=|===|==|!==|!=)\s*['"]provider_schema_invalid['"]/.test(text)||/['"]provider_schema_invalid['"]\s*(===|==|!==|!=)\s*[\w.?]*(failure_class|error_class|failureClass|errorClass)/.test(text))offenders.push(relative);
  }};
  for(const directory of ['workers','src','scripts','.github'])scan(directory);
  assert.deepEqual(offenders,[]);
  // The only SQL equality checks on failure_class target other classes, which keep their exact stored form.
  const preflight=read('workers/api-football-collector/activation-live-preflight.mjs');
  assert.deepEqual([...preflight.matchAll(/failure_class='([a-z_]+)'/g)].map(match=>match[1]).sort(),['attempt_completion_uncertain','persistence_uncertain']);
});

test('R1 encoding audit: error_class readers are scoped to non-API-Football source revisions and the encoding keeps the exact class as its first token',()=>{
  assert.match(read('workers/data-steward/sentinels/d1-sentinel.mjs'),/FROM ingestion_runs\s+WHERE source_revision_id=\? AND run_type=\?/);
  assert.match(read('workers/data-platform/phase4b/diagnostics-contract.mjs'),/WHERE r\.source_revision_id = 'official-fpl-r1'/);
  for(const diagnostic of [{subReason:'errors_nonempty_rate_limit',contentTypeClass:'json',bodyBytesBucket:'lt_1k',quotaHeaderState:'absent'},{subReason:'envelope_other'},{}]){
    const value=composeSchemaFailureClass('provider_schema_invalid',diagnostic);
    assert.equal(value.split(/[:;]/)[0],'provider_schema_invalid');assert.ok(value.length<=80);assert.match(value,/^[a-z0-9_:;=]+$/);
  }
  assert.equal(composeSchemaFailureClass('transport_failure',{subReason:'body_not_json'}),'transport_failure');
});
