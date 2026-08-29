import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {canonicalise,stableStringify} from '../src/decision-intelligence/canonical.mjs';
import {classifyRights,persistenceDecision} from '../src/decision-intelligence/rights.mjs';
import {admitObservation,canonicalFplIdentity,eligibleAsOf,VALIDATION_VERSION,validateIdentity,validateTiming} from '../src/decision-intelligence/observation.mjs';
import {createSignalRegistry,signalVersionKey} from '../src/decision-intelligence/registry.mjs';
import {approvalKey,createApprovalLedger,createShadowRepository} from '../src/decision-intelligence/capabilities.mjs';
import {healthRows,markLive,resetHealth,snapshotHealth} from '../src/providers/registry.mjs';
import {matchContext} from '../src/model/fixtures.mjs';

const candidate={signalId:'availability.fact',domain:'availability',sourceKey:'synthetic-test',version:'1.0.0',subjectType:'player',requiredTimingFields:['sourcePublishedAt','observedAt','fetchedAt'],rightsClassification:'durable_allowed',persistenceAllowed:true,expectedEvidenceType:'factual_claim',upstreamDependencies:['official-fpl-identity'],overlapRisks:['official-fpl-status'],evaluationDomain:'minutes',productionStatus:'shadow_only'};
const registry=createSignalRegistry([candidate]);
const base={identity:{category:'availability',subjectType:'player',canonicalSubjectId:'2026-27:fpl:player:42',fixtureId:'2026-27:fpl:fixture:9',competitionId:'2026-27:fpl:competition:1',season:'2026-27'},value:{metric:'availability_state',value:'available',unit:null},timing:{sourcePublishedAt:'2026-08-20T10:00:00Z',effectiveAt:'2026-08-20T09:00:00Z',observedAt:'2026-08-20T10:01:00Z',fetchedAt:'2026-08-20T10:02:00Z',expiresAt:'2026-08-21T10:02:00Z'},source:{sourceKey:'synthetic-test',recordId:'record-7',transformVersion:'test-v1'},quality:{state:'accepted',rejectionReasons:[],confidence:null,sourceQuality:null,conflictState:'none'},provenance:{sourceTimestamp:'2026-08-20T10:00:00Z',inputRevision:'revision-3',validationVersion:VALIDATION_VERSION,evidenceReferences:['synthetic:7']},rights:{classification:'durable_allowed',retentionAllowed:true,redistributionAllowed:false,attributionRequired:false}};

test('DI-1 admits a valid provider-neutral observation with deterministic canonical identity',async()=>{
  const one=await admitObservation(base,{signal:registry.get('availability.fact','1.0.0')});
  const reordered=canonicalise({rights:base.rights,provenance:base.provenance,quality:base.quality,source:base.source,timing:base.timing,value:base.value,identity:base.identity});
  const two=await admitObservation(reordered,{signal:registry.get('availability.fact','1.0.0')});
  assert.equal(one.ok,true);assert.match(one.observation.identity.observationId,/^obs-[0-9a-f]{64}$/);
  assert.equal(one.observation.identity.observationId,two.observation.identity.observationId);
  assert.equal(stableStringify(one.observation),stableStringify(two.observation));
  assert.equal(one.observation.boundary.capability,'shadow_only');
});

test('DI-1 observations are deeply immutable without changing deterministic identity',async()=>{
  const {observation}=await admitObservation(base,{signal:candidate});
  const id=observation.identity.observationId,bytes=stableStringify(observation);
  for(const mutate of [
    ()=>{observation.identity.canonicalSubjectId='2026-27:fpl:player:99';},
    ()=>{observation.timing.fetchedAt='2026-08-20T11:00:00.000Z';},
    ()=>{observation.rights.retentionAllowed=false;},
    ()=>{observation.boundary.capability='production_eligible';},
    ()=>{observation.provenance.evidenceReferences.push('synthetic:8');},
    ()=>{observation.quality.rejectionReasons.push('mutated');}
  ])assert.throws(mutate,TypeError);
  assert.equal(observation.identity.observationId,id);
  assert.equal(stableStringify(observation),bytes);
  assert.equal((await admitObservation(base,{signal:candidate})).observation.identity.observationId,id);
});

test('DI-1 canonical Official FPL identities reject display-name, type, season and fixture mismatches',()=>{
  assert.equal(canonicalFplIdentity('2026-27','player',42),'2026-27:fpl:player:42');
  assert.equal(validateIdentity({season:'2026-27',subjectType:'player',displayName:'Example'}).reason,'display_name_only_identity');
  assert.equal(validateIdentity({...base.identity,canonicalSubjectId:'2026-27:fpl:team:42'}).reason,'subject_type_mismatch');
  assert.equal(validateIdentity({...base.identity,canonicalSubjectId:'2025-26:fpl:player:42'}).reason,'season_mismatch');
  assert.equal(validateIdentity({...base.identity,fixtureId:'2026-27:fpl:team:9'}).reason,'fixture_mismatch');
});

test('DI-1 timing preserves clocks, rejects impossible order and supports deadline as-of eligibility',async()=>{
  assert.equal(validateTiming(base.timing,['sourcePublishedAt','observedAt','fetchedAt']).ok,true);
  assert.equal(validateTiming({...base.timing,observedAt:'2026-08-20T10:03:00Z'}).reason,'observed_after_fetched');
  assert.match(validateTiming({...base.timing,sourcePublishedAt:null},['sourcePublishedAt']).reason,/timing_required/);
  assert.equal(validateTiming({...base.timing,expiresAt:'2026-08-20T10:01:00Z'}).reason,'expired_when_fetched');
  const {observation}=await admitObservation(base,{signal:candidate});
  assert.equal(eligibleAsOf(observation,'2026-08-20T10:01:30Z'),false);
  assert.equal(eligibleAsOf(observation,'2026-08-20T10:03:00Z'),true);
  assert.equal(eligibleAsOf(observation,'2026-08-22T10:03:00Z'),false);
});

test('DI-1 rights classifications fail closed and never infer a legal conclusion',()=>{
  assert.deepEqual(classifyRights({}),{classification:'unknown_fail_closed',retentionAllowed:false,redistributionAllowed:false,attributionRequired:false,attributionText:null,valid:false});
  assert.equal(persistenceDecision({classification:'local_research_only',retentionAllowed:true,redistributionAllowed:false,attributionRequired:false}).ok,false);
  assert.equal(persistenceDecision(base.rights).ok,true);
  assert.equal(classifyRights({classification:'attribution_required',retentionAllowed:true,redistributionAllowed:false,attributionRequired:true}).valid,false);
});

test('DI-1 registry enforces unique signal/version identity and shadow-only candidates',()=>{
  assert.equal(signalVersionKey('availability.fact','1.0.0'),'availability.fact@1.0.0');
  assert.throws(()=>createSignalRegistry([candidate,candidate]),/signal_duplicate/);
  assert.throws(()=>createSignalRegistry([{...candidate,productionStatus:'approved'}]),/signal_invalid/);
  assert.equal(registry.list()[0].productionStatus,'shadow_only');
  assert.throws(()=>registry.get('availability.fact','1.0.0').overlapRisks.push('mutated'),TypeError);
  assert.throws(()=>registry.list().push(candidate),TypeError);
});

test('DI-1 approval ledger is exact by signal, version and scope; DI-1 contains no approvals',()=>{
  const empty=createApprovalLedger();
  assert.throws(()=>empty.requireProductionRead('availability.fact','1.0.0','minutes'),/production_read_unapproved/);
  const record={approvalId:'approval-1',signalId:'availability.fact',version:'1.0.0',scope:'minutes',capability:'production_read',status:'approved',approvedAt:'2026-08-29T00:00:00Z',approvedBy:'owner'};
  const ledger=createApprovalLedger([record]);
  assert.equal(approvalKey(record.signalId,record.version,record.scope),'availability.fact@1.0.0#minutes');
  assert.equal(ledger.requireProductionRead('availability.fact','1.0.0','minutes').approvalId,'approval-1');
  assert.throws(()=>ledger.requireProductionRead('availability.fact','1.0.1','minutes'),/production_read_unapproved/);
  assert.throws(()=>ledger.requireProductionRead('availability.fact','1.0.0','scoring'),/production_read_unapproved/);
  assert.throws(()=>{ledger.requireProductionRead('availability.fact','1.0.0','minutes').scope='scoring';},TypeError);
});

test('DI-1 rejects malformed records and all secret material before shadow admission',async()=>{
  assert.equal((await admitObservation({...base,value:{metric:'availability_state'}},{signal:candidate})).reason,'value_invalid');
  assert.equal((await admitObservation({...base,source:{...base.source,apiKey:'not-allowed'}},{signal:candidate})).reason,'secret_material');
  assert.equal((await admitObservation({...base,source:{...base.source,recordId:'https://example.test/x?token=hidden'}},{signal:candidate})).reason,'secret_material');
  assert.equal((await admitObservation(base,{})).reason,'signal_unregistered');
});

test('DI-1 shadow repository rejects malformed writes and exposes no production read',async()=>{
  const repository=createShadowRepository(),{observation}=await admitObservation(base,{signal:candidate});
  repository.add(observation);assert.equal(repository.list().length,1);
  assert.throws(()=>repository.add({...observation,boundary:{capability:'production_eligible'}}),/shadow_observation_invalid/);
  assert.throws(()=>repository.productionRead(),/no_production_capability/);
});

test('DI-1 repository lists deeply immutable records without exposing mutable internal state',async()=>{
  const repository=createShadowRepository(),{observation}=await admitObservation(base,{signal:candidate});
  const id=repository.add(observation),listed=repository.list(),bytes=stableStringify(listed);
  assert.throws(()=>{listed[0].value.value='injured';},TypeError);
  assert.throws(()=>{listed[0].timing.fetchedAt='2026-08-20T11:00:00.000Z';},TypeError);
  assert.throws(()=>listed.push(observation),TypeError);
  assert.equal(repository.list()[0].identity.observationId,id);
  assert.equal(stableStringify(repository.list()),bytes);
});

test('DI-1 valid shadow observations leave a production recommendation input byte-identical',async()=>{
  const before=stableStringify(matchContext(-1,-2,true));
  const repository=createShadowRepository(),{observation}=await admitObservation(base,{signal:candidate});
  repository.add(observation);
  assert.equal(stableStringify(matchContext(-1,-2,true)),before);
});

test('DI-1 malformed, stale and conflicting shadow records cannot contaminate Provider Health',async()=>{
  resetHealth();markLive('fpl','verified', '', 1000);const before=snapshotHealth();
  const repository=createShadowRepository();
  for(const mutation of [
    {...base,quality:{...base.quality,conflictState:'conflicting'}},
    {...base,timing:{...base.timing,expiresAt:'2026-08-20T10:03:00Z'}},
    {...base,value:{} }
  ]){const admitted=await admitObservation(mutation,{signal:candidate});if(admitted.ok)repository.add(admitted.observation);}
  assert.deepEqual(snapshotHealth(),before);assert.equal(healthRows().some(row=>row.provider==='synthetic-test'),false);
  resetHealth();
});

test('DI-1 is structurally absent from production model/provider/state/build dependency paths',()=>{
  const roots=['src/main.mjs','src/state.mjs','src/squad.mjs',...fs.readdirSync('src/model').map(name=>path.join('src/model',name)),...fs.readdirSync('src/providers').map(name=>path.join('src/providers',name))];
  for(const file of roots)assert.doesNotMatch(fs.readFileSync(file,'utf8'),/decision-intelligence/,file);
  assert.doesNotMatch(fs.readFileSync('build.mjs','utf8'),/decision-intelligence\/(?:observation|registry|rights|capabilities)\.mjs/);
});
