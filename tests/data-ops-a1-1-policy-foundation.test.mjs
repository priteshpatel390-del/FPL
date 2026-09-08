import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ACTION_REGISTRY,AUTO_MERGE_ALLOWLIST,AUTONOMY_CLASS,DECISION,MUTATION_DOMAINS,POLICY_VERSION,actionRegistryJson,getActionDefinition} from '../workers/data-steward/action-registry.mjs';
import {classifyOperationalState,createIncident} from '../workers/data-steward/incident.mjs';
import {evaluateActionPolicy,executableObserveAction} from '../workers/data-steward/policy-engine.mjs';
import {AUDIT_SCHEMA_VERSION,auditRecordJson,createAuditRecord} from '../workers/data-steward/audit.mjs';
import {PROVIDER_APPROVAL_POLICY,validateProviderHealthContract} from '../workers/data-steward/provider-health-contract.mjs';

const SHA='a'.repeat(40),FINGERPRINT='b'.repeat(64),INCIDENT=`incident-${'c'.repeat(24)}`;
const switches=(enabled=true)=>({overallAutonomy:enabled,cloudflare:enabled,github_repository:enabled,d1:enabled,provider:enabled,auto_merge:enabled});
const authoritativeEvidence=(evidenceType='health_snapshot',incidentId=INCIDENT)=>[{incidentId,evidenceType,reference:'github:run/1',hash:'e'.repeat(64)}];
const proposal=(overrides={})=>({actionId:'observe.health.inspect',actionClass:0,incidentId:INCIDENT,mainSha:SHA,expectedStateFingerprint:FINGERPRINT,parameters:{scope:'all'},policyVersion:POLICY_VERSION,expiresAt:'2026-09-08T12:00:00.000Z',nonce:'nonce-1234567890abcdef',...overrides});
const context=(overrides={})=>({now:'2026-09-08T11:00:00.000Z',currentMainSha:SHA,currentIncidentId:INCIDENT,currentClassification:'GREEN',currentClassificationReasonCode:'HEALTHY_EXPECTED_STATE',currentExpectedStateFingerprint:FINGERPRINT,authoritativeEvidence:authoritativeEvidence(),consumedNonces:[],incidentActionCount:0,actionRetryCount:0,cooldownUntil:null,circuitBreakerTripped:false,killSwitches:switches(),...overrides});
const reason=(p={},c={})=>evaluateActionPolicy(proposal(p),context(c)).reasonCode;

test('registry is deterministic, closed, and Class 3 allowlist is empty',()=>{
  assert.deepEqual(AUTONOMY_CLASS,{OBSERVE:0,SAFE_REPAIR:1,REPOSITORY_REPAIR:2,AUTO_MERGE:3,OWNER_APPROVAL:4});
  assert.deepEqual(AUTO_MERGE_ALLOWLIST,[]);
  assert.equal(actionRegistryJson(),actionRegistryJson());
  assert.deepEqual(ACTION_REGISTRY.map(row=>row.actionId),[...ACTION_REGISTRY].map(row=>row.actionId).sort());
  for(const action of ACTION_REGISTRY)assert.deepEqual(Object.keys(action).sort(),['actionId','actionClass','allowedParameters','description','domain','enabled','expectedPreconditions','idempotence','mutates','mutationDomain','notificationPolicy','ownerApprovalRequired','permittedClassifications','requiredEvidence','retryBudget','rollbackRequired','verificationRequired'].sort());
});

test('valid Class 0 observation is allowed with stable machine reason',()=>{
  assert.deepEqual(evaluateActionPolicy(proposal(),context()),{actionId:'observe.health.inspect',decision:DECISION.ALLOW,incidentId:INCIDENT,policyVersion:POLICY_VERSION,reasonCode:'OBSERVE_ACTION_ALLOWED'});
});

test('unknown, malformed, forged and generic authority requests fail closed',()=>{
  assert.equal(reason({actionId:'forged.action'}),'UNKNOWN_ACTION_ID');
  assert.equal(evaluateActionPolicy(null,context()).reasonCode,'MALFORMED_REQUEST');
  assert.equal(evaluateActionPolicy({...proposal(),extra:true},context()).reasonCode,'MALFORMED_REQUEST');
  assert.equal(reason({parameters:[]}),'MALFORMED_REQUEST');
  assert.equal(reason({actionClass:99}),'UNSUPPORTED_AUTONOMY_CLASS');
  for(const actionId of ['shell.execute','sql.execute','http.request','github.api.call','cloudflare.api.call','owner.arbitrary_sql'])assert.equal(reason({actionId}),'UNKNOWN_ACTION_ID');
  assert.equal(getActionDefinition('owner.arbitrary_sql'),null);
  assert.ok(ACTION_REGISTRY.every(action=>!/arbitrary|(?:sql|shell|http|api)\.execute|api\.call/i.test(action.actionId)));
});

test('unexpected parameters and disguised mutation cannot enter observation',()=>{
  assert.equal(reason({parameters:{scope:'all',command:'rm -rf /'}}),'UNEXPECTED_PARAMETER');
  assert.equal(reason({parameters:{scope:'../../production'}}),'UNEXPECTED_PARAMETER');
  assert.equal(reason({actionClass:1}),'ACTION_CLASS_MISMATCH');
  assert.equal(evaluateActionPolicy({...proposal(),evidence:['health_snapshot']},context()).reasonCode,'MALFORMED_REQUEST');
  assert.equal(evaluateActionPolicy({...proposal(),evidenceHash:'e'.repeat(64)},context()).reasonCode,'MALFORMED_REQUEST');
  assert.equal(evaluateActionPolicy({...proposal(),authoritativeEvidence:authoritativeEvidence()},context()).reasonCode,'MALFORMED_REQUEST');
  assert.equal(evaluateActionPolicy({...proposal(),confidence:1},context()).reasonCode,'MALFORMED_REQUEST');
  assert.equal(evaluateActionPolicy({...proposal(),killSwitches:switches()},context()).reasonCode,'MALFORMED_REQUEST');
});

test('Class 1 and Class 2 remain disabled and no future mutation has an executable surface',()=>{
  const class1={actionId:'repair.dispatch.retry',actionClass:1,parameters:{dispatchIdentity:'d'.repeat(64)}};
  const class2={actionId:'repair.repository.draft_pr',actionClass:2,parameters:{runbookId:'known.runbook'}};
  assert.equal(reason(class1,{currentClassification:'AMBER',currentClassificationReasonCode:'KNOWN_BOUNDED_DISPATCH_FAILURE',authoritativeEvidence:authoritativeEvidence('dispatch_failure')}),'AUTONOMY_CLASS_DISABLED');
  assert.equal(reason(class2,{currentClassification:'RED',currentClassificationReasonCode:'REPOSITORY_INCIDENT',authoritativeEvidence:authoritativeEvidence('repository_incident')}),'AUTONOMY_CLASS_DISABLED');
  assert.equal(executableObserveAction(class1.actionId),null);
  assert.equal(executableObserveAction(class2.actionId),null);
  assert.equal(executableObserveAction('owner.d1.migration.review'),null);
  assert.equal(typeof executableObserveAction('observe.health.inspect'),'object');
});

test('Class 3 remains empty and Class 4 escalates to owner',()=>{
  assert.equal(reason({actionId:'repair.auto_merge',actionClass:3,parameters:{}},{authoritativeEvidence:authoritativeEvidence('verified_pull_request')}),'AUTO_MERGE_ALLOWLIST_EMPTY');
  const decision=evaluateActionPolicy(proposal({actionId:'owner.d1.migration.review',actionClass:4,parameters:{proposalId:'d'.repeat(64)}}),context({currentClassification:'RED',currentClassificationReasonCode:'OWNER_REVIEW_REQUIRED',authoritativeEvidence:authoritativeEvidence('owner_review_request')}));
  assert.equal(decision.decision,'ESCALATE');
  assert.equal(decision.reasonCode,'OWNER_APPROVAL_REQUIRED');
});

test('overall and independent mutation kill switches fail closed',()=>{
  assert.equal(reason({}, {killSwitches:switches(false)}),'AUTONOMY_DISABLED');
  const killSwitches=switches();killSwitches.cloudflare=false;
  assert.equal(reason({actionId:'repair.dispatch.retry',actionClass:1,parameters:{dispatchIdentity:'d'.repeat(64)}},{killSwitches,currentClassification:'AMBER',currentClassificationReasonCode:'KNOWN_BOUNDED_DISPATCH_FAILURE',authoritativeEvidence:authoritativeEvidence('dispatch_failure')}),'MUTATION_DOMAIN_DISABLED');
  assert.deepEqual(MUTATION_DOMAINS,['cloudflare','github_repository','d1','provider','auto_merge']);
  assert.equal(getActionDefinition('repair.dispatch.retry').mutationDomain,'cloudflare');
});

test('state, expiry, replay, budget, cooldown and circuit breaker controls are exact',()=>{
  assert.equal(reason({}, {now:'2026-09-08T12:00:00.000Z'}),'STALE_AUTHORIZATION');
  assert.equal(reason({}, {currentMainSha:'d'.repeat(40)}),'MAIN_SHA_MISMATCH');
  assert.equal(reason({}, {currentIncidentId:`incident-${'d'.repeat(24)}`}),'INCIDENT_CONTEXT_MISMATCH');
  assert.equal(reason({}, {currentExpectedStateFingerprint:'d'.repeat(64)}),'PRE_STATE_MISMATCH');
  assert.equal(reason({}, {consumedNonces:['nonce-1234567890abcdef']}),'REPLAY_DETECTED');
  assert.equal(reason({}, {incidentActionCount:3}),'INCIDENT_ACTION_BUDGET_EXHAUSTED');
  assert.equal(reason({}, {actionRetryCount:2}),'ACTION_RETRY_BUDGET_EXHAUSTED');
  assert.equal(reason({}, {cooldownUntil:'2026-09-08T11:01:00.000Z'}),'ACTION_COOLDOWN_ACTIVE');
  assert.equal(reason({}, {circuitBreakerTripped:true}),'CIRCUIT_BREAKER_TRIPPED');
});

test('only incident-bound trusted context evidence can satisfy action requirements',()=>{
  assert.equal(reason({}, {authoritativeEvidence:[]}),'MISSING_REQUIRED_EVIDENCE');
  assert.equal(reason({}, {authoritativeEvidence:authoritativeEvidence('fake_claim')}),'MISSING_REQUIRED_EVIDENCE');
  assert.equal(reason({}, {authoritativeEvidence:authoritativeEvidence('health_snapshot',`incident-${'d'.repeat(24)}`)}),'EVIDENCE_INCIDENT_MISMATCH');
  assert.equal(reason({}, {authoritativeEvidence:authoritativeEvidence('health_snapshot')}),'OBSERVE_ACTION_ALLOWED');
  assert.equal(evaluateActionPolicy({...proposal(),evidence:['health_snapshot']},context({authoritativeEvidence:[]})).reasonCode,'MALFORMED_REQUEST');
});

test('classification needs registered deterministic rule, never proposer confidence',()=>{
  const evidence=[{reference:'github:run/1',hash:'e'.repeat(64)}];
  const healthy={conditionId:'healthy',domain:'github',expectedState:{status:'healthy'},observedState:{status:'healthy'},evidence};
  assert.deepEqual(classifyOperationalState(healthy),{classification:'GREEN',reasonCode:'HEALTHY_EXPECTED_STATE'});
  assert.equal(classifyOperationalState({...healthy,observedState:{status:'unhealthy'}}).classification,'RED');
  const bounded={conditionId:'dispatch_failure_bounded',domain:'github',expectedState:{maxAttempts:1,operation:'workflow_dispatch'},observedState:{classification:'REJECTED',reasonCode:'dispatch_status_rejected',retryable:false,status:'failed'},evidence};
  assert.deepEqual(classifyOperationalState(bounded),{classification:'AMBER',reasonCode:'KNOWN_BOUNDED_DISPATCH_FAILURE'});
  assert.equal(classifyOperationalState({...bounded,observedState:{classification:'ACCEPTED_WITH_IDENTITY',reasonCode:'dispatch_accepted',retryable:false,status:'success'}}).classification,'RED');
  const consumed={conditionId:'opportunity_consumed',domain:'github',expectedState:{collectionPolicy:'one_routine_per_utc_day'},observedState:{reasonCode:'automatic_collection_consumed',status:'consumed'},evidence};
  assert.deepEqual(classifyOperationalState(consumed),{classification:'GREEN',reasonCode:'ROUTINE_OPPORTUNITY_ALREADY_CONSUMED'});
  assert.equal(classifyOperationalState({...consumed,observedState:{reasonCode:'automatic_collection_consumed',status:'available'}}).classification,'RED');
  assert.equal(classifyOperationalState({conditionId:'novel_issue',domain:'github',expectedState:{},observedState:{},evidence}).classification,'RED');
  assert.equal(classifyOperationalState({...bounded,domain:'unknown'}).classification,'RED');
  assert.equal(classifyOperationalState({...bounded,observedState:{status:'failed'}}).classification,'RED');
  assert.equal(classifyOperationalState({...bounded,observedState:{status:'success'},evidence:[{reference:'random:claim',hash:'f'.repeat(64)}]}).classification,'RED');
  assert.equal(classifyOperationalState({...bounded,confidence:1}).classification,'RED');
});

test('incident identity and serialization are deterministic and evidence-bound',async()=>{
  const input={detectorId:'github.workflow',detectorVersion:'v1',detectedAt:'2026-09-08T11:00:00.000Z',domain:'github',expectedState:{maxAttempts:1,operation:'workflow_dispatch'},observedState:{classification:'REJECTED',reasonCode:'dispatch_token_missing',retryable:false,status:'failed'},evidence:[{reference:'github:run/1',hash:'e'.repeat(64)}],conditionId:'dispatch_failure_bounded',mainSha:SHA,actionHistory:[],finalDisposition:null};
  const a=await createIncident(input),b=await createIncident(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(a,b);assert.equal(a.classification,'AMBER');assert.match(a.incidentId,/^incident-[0-9a-f]{24}$/);assert.equal(a.policyVersion,POLICY_VERSION);
});

const auditInput=()=>({incidentId:INCIDENT,timestamp:'2026-09-08T11:00:00.000Z',sourceSha:SHA,detectorId:'github.workflow',detectorVersion:'v1',policyVersion:POLICY_VERSION,expectedStateFingerprint:FINGERPRINT,observedStateFingerprint:'d'.repeat(64),evidence:['github:run/1#sha256='+('e'.repeat(64))],classification:'AMBER',diagnosticSummary:'Known bounded dispatch failure',requestedActionId:'observe.health.inspect',decision:'ALLOW',reasonCode:'OBSERVE_ACTION_ALLOWED',executorIdentity:null,beforeStateFingerprint:null,afterStateFingerprint:null,verificationEvidence:[],rollbackTarget:null,rollbackResult:null,finalStatus:'OBSERVED',notificationDisposition:'EXCEPTION_ONLY'});

test('audit contract is stable, canonical, hash-identified and secret rejecting',async()=>{
  const a=await createAuditRecord(auditInput()),b=await createAuditRecord({...auditInput(),evidence:[...auditInput().evidence]});
  assert.deepEqual(a,b);assert.equal(a.schemaVersion,AUDIT_SCHEMA_VERSION);assert.match(a.auditId,/^[0-9a-f]{64}$/);assert.equal(auditRecordJson(a),auditRecordJson(b));
  await assert.rejects(createAuditRecord({...auditInput(),diagnosticSummary:'Bearer secret-value-123'}),/audit_secret_forbidden/);
  await assert.rejects(createAuditRecord({...auditInput(),token:'secret'}),/audit_schema_invalid/);
});

const health=(providerId='fpl')=>({providerId,observedAt:'2026-09-08T11:00:00.000Z',availability:'AVAILABLE',quotaStatus:'AVAILABLE',authStatus:'VALID',freshnessAgeMs:1000,observedSchemaVersion:'v1',observedParserVersion:'v1',qualityStatus:'HEALTHY',costUsageMinorUnits:null});

test('provider health returns immutable repository-controlled policy without production influence',()=>{
  const result=validateProviderHealthContract(health());
  assert.equal(result.ok,true);assert.equal(result.mayInfluenceProduction,false);assert.deepEqual(result.health,health());
  assert.deepEqual(result.policy,PROVIDER_APPROVAL_POLICY.fpl);
  assert.equal(result.policy.approvedPurpose,'players, teams, fixtures, deadlines, squads and outcomes');
  assert.equal(validateProviderHealthContract(health('understat')).policy.approvedPurpose,'team-level rolling xG only');
});

test('caller cannot forge provider identity, purpose, influence or fallback policy',()=>{
  assert.equal(validateProviderHealthContract(health('new_provider')).reasonCode,'PROVIDER_NOT_APPROVED');
  for(const forged of [
    {...health(),approvedPurpose:'player-level predictions'},
    {...health('understat'),approvedPurpose:'player-level xG'},
    {...health(),prohibitedInfluence:[]},
    {...health(),approvedFallbackState:'APPROVED'},
    {...health(),providerPolicy:{newPermission:true}}
  ])assert.equal(validateProviderHealthContract(forged).reasonCode,'PROVIDER_HEALTH_MALFORMED');
  assert.equal(validateProviderHealthContract({...health(),authorization:'Bearer secret-value'}).reasonCode,'PROVIDER_HEALTH_MALFORMED');
});

test('foundation contains no actuator, network, credential, SQL or environment capability',()=>{
  for(const file of ['action-registry.mjs','incident.mjs','policy-engine.mjs','audit.mjs','provider-health-contract.mjs']){
    const source=fs.readFileSync(`workers/data-steward/${file}`,'utf8');
    assert.doesNotMatch(source,/\bfetch\s*\(|child_process|exec(?:File)?\s*\(|process\.env|CLOUDFLARE_API_TOKEN|GITHUB_TOKEN|\b(?:INSERT|UPDATE|DELETE|DROP|ALTER)\b/i,file);
  }
});
