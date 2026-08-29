import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {createSignalRegistry} from '../src/decision-intelligence/registry.mjs';
import {freezeEvaluationManifest} from '../src/decision-intelligence/evaluation-manifest.mjs';
import {freezePointInTimeView} from '../src/decision-intelligence/evaluation-view.mjs';
import {evaluateMetric} from '../src/decision-intelligence/evaluation-metrics.mjs';
import {runEvaluation} from '../src/decision-intelligence/evaluation-runner.mjs';

const manifest=()=>JSON.parse(fs.readFileSync(new URL('../experiments/di2-synthetic/manifest.json',import.meta.url)));
const inputs=()=>JSON.parse(fs.readFileSync(new URL('../experiments/di2-synthetic/input.json',import.meta.url)));
const signal=id=>({signalId:`synthetic.${id}`,version:'1.0.0',domain:'availability',sourceKey:'synthetic',subjectType:'player',requiredTimingFields:['sourcePublishedAt','observedAt','fetchedAt'],rightsClassification:'durable_allowed',persistenceAllowed:true,expectedEvidenceType:'structured_fact',upstreamDependencies:[],overlapRisks:[],evaluationDomain:'availability',productionStatus:'shadow_only'});
const registry=()=>createSignalRegistry([signal('a'),signal('b')]);
const freeze=(value=manifest())=>freezeEvaluationManifest(value,{registry:registry(),cryptoImpl:webcrypto});

test('DI-2 validates, freezes and hash-addresses a manifest deterministically',async()=>{
  const a=await freeze(),b=await freeze();assert.equal(a.manifestHash,b.manifestHash);assert.equal(Object.isFrozen(a.manifest.cohort.timeSplit),true);assert.throws(()=>{a.manifest.title='changed';},TypeError);assert.match(a.identity,/exploratory/);
});
test('DI-2 rejects invalid schemas, duplicate arms, unknown signal versions and invalid metrics',async()=>{
  for(const mutate of [m=>m.schemaVersion='bad',m=>m.arms.push(structuredClone(m.arms[0])),m=>m.candidates[0].version='9.0.0',m=>m.metrics[0].adapter='accuracy']){const m=manifest();mutate(m);await assert.rejects(freeze(m),/manifest_/);}
});
test('DI-2 exploratory and confirmatory registrations have distinct identities',async()=>{const exploratory=await freeze(),m=manifest();m.mode='confirmatory';const confirmatory=await freeze(m);assert.notEqual(exploratory.manifestHash,confirmatory.manifestHash);assert.match(confirmatory.identity,/confirmatory/);});

test('DI-2 frozen view enforces publication, correction, expiry, required timing and leakage rules',async()=>{
  const f=await freeze(),data=inputs();data.observations.push({...data.observations[4],recordId:'a-p2-correction',subjectId:'p2',timing:{...data.observations[4].timing,sourcePublishedAt:'2026-08-20T17:01:00Z',observedAt:'2026-08-20T17:01:00Z',fetchedAt:'2026-08-20T17:02:00Z'}});data.observations.push({...data.observations[4],recordId:'missing-published',subjectId:'p3',timing:{observedAt:'2026-08-20T15:00:00Z',fetchedAt:'2026-08-20T15:01:00Z'}});
  const view=await freezePointInTimeView({manifest:f.manifest,...data},webcrypto),reasons=Object.fromEntries(view.rejections.map(row=>[row.recordId,row.reason]));
  assert.equal(reasons['a-p3-late'],'after_cutoff');assert.equal(reasons['a-p2-correction'],'after_cutoff');assert.equal(reasons['a-p4-expired'],'expired');assert.equal(reasons['missing-published'],'missing_sourcePublishedAt');assert.equal(reasons['leak-p1'],'outcome_leakage');assert.equal(reasons['b-p2-conflict'],'unresolved_conflict');
});
test('DI-2 cohort inclusion and exclusion are deterministic',async()=>{const f=await freeze(),a=await freezePointInTimeView({manifest:f.manifest,...inputs()},webcrypto),b=await freezePointInTimeView({manifest:f.manifest,observations:inputs().observations.reverse(),outcomes:inputs().outcomes.reverse()},webcrypto);assert.equal(a.viewHash,b.viewHash);assert.deepEqual(a.outcomes.map(row=>row.subjectId),['p1','p2','p3','p4']);});

test('DI-2 metric adapters return known Brier, MAE and RMSE values with missing pairs excluded',()=>{const rows=[{prediction:{p:.8},outcome:{y:1}},{prediction:{p:.2},outcome:{y:0}},{prediction:{},outcome:{y:1}}],metric=adapter=>({metricId:adapter,adapter,version:'1.0.0',predictionField:'p',outcomeField:'y'});assert.deepEqual(evaluateMetric(rows,metric('brier')),{metricId:'brier',adapter:'brier',version:'1.0.0',sampleCount:2,value:.04});assert.equal(evaluateMetric(rows,metric('mae')).value,.2);assert.equal(evaluateMetric(rows,metric('rmse')).value,.2);});
test('DI-2 fixed calibration bins are deterministic and versioned',()=>{const result=evaluateMetric([{prediction:{p:.1},outcome:{y:0}},{prediction:{p:.9},outcome:{y:1}}],{metricId:'cal',adapter:'calibration',version:'1.0.0',predictionField:'p',outcomeField:'y',binEdges:[0,.5,1]});assert.equal(result.value,.1);assert.deepEqual(result.bins.map(bin=>bin.count),[1,1]);assert.equal(result.version,'1.0.0');});

test('DI-2 runs only explicitly declared baseline, A, B and A+B arms on one outcome cohort',async()=>{const report=await runEvaluation(await freeze(),inputs(),webcrypto);assert.deepEqual(report.result.arms.map(a=>a.armId),['baseline','baseline-a','baseline-b','baseline-a-b']);assert.deepEqual(new Set(report.result.arms.map(a=>a.samples.outcome)),new Set([4]));assert.equal(report.result.arms[0].samples.evaluated,4);assert.equal(report.result.arms[1].samples.incompleteCandidateCoverage,2);});
test('DI-2 baseline-only manifests retain exact arm identity',async()=>{const m=manifest();m.arms=[m.arms[0]];const report=await runEvaluation(await freeze(m),inputs(),webcrypto);assert.deepEqual(report.result.arms.map(row=>row.armId),['baseline']);});
test('DI-2 canonical JSON, Markdown, lineage, warnings and bytes reproduce exactly',async()=>{const frozen=await freeze(),a=await runEvaluation(frozen,inputs(),webcrypto),b=await runEvaluation(frozen,inputs(),webcrypto);assert.equal(a.json,b.json);assert.equal(a.markdown,b.markdown);assert.equal(a.result.runIdentity,b.result.runIdentity);assert.equal(a.result.lineage.manifestHash,frozen.manifestHash);assert.match(a.result.lineage.viewHash,/^[a-f0-9]{64}$/);assert.deepEqual(a.result.warnings,['insufficient_sample','excluded_observations','incomplete_candidate_coverage']);assert.match(a.markdown,/creates no production approval/);});

test('DI-2 remains offline and isolated from production, providers and DATA-S2B mutation paths',()=>{
  const files=['evaluation-manifest.mjs','evaluation-view.mjs','evaluation-metrics.mjs','evaluation-runner.mjs'].map(name=>fs.readFileSync(new URL(`../src/decision-intelligence/${name}`,import.meta.url),'utf8')).join('\n');
  assert.doesNotMatch(files,/src\/(?:model|providers|state)|workers\/data-platform|production_read|observation_heads|fetch\s*\(/);assert.doesNotMatch(fs.readFileSync(new URL('../build.mjs',import.meta.url),'utf8'),/decision-intelligence/);assert.equal(fs.existsSync(new URL('../src/decision-intelligence/production-approval.mjs',import.meta.url)),false);
});
