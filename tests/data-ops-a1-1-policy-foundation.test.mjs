import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ACTION_REGISTRY,AUTO_MERGE_ALLOWLIST,AUTONOMY_CLASS,DECISION,MUTATION_DOMAINS,POLICY_VERSION,actionRegistryJson,getActionDefinition} from '../workers/data-steward/action-registry.mjs';
import {classifyOperationalState,createIncident} from '../workers/data-steward/incident.mjs';
import {evaluateActionPolicy,executableObserveAction} from '../workers/data-steward/policy-engine.mjs';
import {AUDIT_SCHEMA_VERSION,auditRecordJson,createAuditRecord} from '../workers/data-steward/audit.mjs';
import {validateProviderHealthContract} from '../workers/data-steward/provider-health-contract.mjs';

const SHA='a'.repeat(40),FINGERPRINT='b'.repeat(64),INCIDENT=`incident-${'c'.repeat(24)}`;
const switches=(enabled=true)=>({overallAutonomy:enabled,cloudflare:enabled,github_repository:enabled,d1:enabled,provider:enabled,auto_merge:enabled});
const proposal=(overrides={})=>({actionId:'observe.health.inspect',actionClass:0,incidentId:INCIDENT,mainSha:SHA,expectedStateFingerprint:FINGERPRINT,parameters:{scope:'all'},policyVersion:POLICY_VERSION,expiresAt:'2026-09-08T12:00:00.000Z',nonce:'nonce-1234567890abcdef',evidence:['health_snapshot'],...overrides});
const context=(overrides={})=>({now:'2026-09-08T11:00:00.000Z',currentMainSha:SHA,currentIncidentId:INCIDENT,currentExpectedStateFingerprint:FINGERPRINT,consumedNonces:[],incidentActionCount:0,actionRetryCount:0,cooldownUntil:null,circuitBreakerTripped:false,killSwitches:switches(),...overrides});
const reason=(p={},c={})=>evaluateActionPolicy(proposal(p),context(c)).reasonCode;

test('registry is deterministic, closed, and Class 3 allowlist is empty',()=>{
  assert.deepEqual(AUTONOMY_CLASS,{OBSERVE:0,SAFE_REPAIR:1,REPOSITORY_REPAIR:2,AUTO_MERGE:3,OWNER_APPROVAL:4});
  assert.deepEqual(AUTO_MERGE_ALLOWLIST,[]);
  assert.equal(actionRegistryJson(),actionRegistryJson());
  assert.deepEqual(ACTION_REGISTRY.map(row=>row.actionId),[...ACTION_REGISTRY].map(row=>row.actionId).sort());
  for(const action of ACTION_REGISTRY)assert.deepEqual(Object.keys(action).sort(),['actionId','actionClass','allowedParameters','description','domain','enabled','expectedPreconditions','idempotence','mutates','mutationDomain','notificationPolicy','ownerApprovalRequired','requiredEvidence','retryBudget','rollbackRequired','verificationRequired'].sort());
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
  for(const actionId of ['shell.execute','sql.execute','http.request','github.api.call','cloudflare.api.call'])assert.equal(reason({actionId}),'UNKNOWN_ACTION_ID');
});

test('unexpected parameters and disguised mutation cannot enter observation',()=>{
  assert.equal(reason({parameters:{scope:'all',command:'rm -rf /'}}),'UNEXPECTED_PARAMETER');
  assert.equal(reason({parameters:{scope:'../../production'}}),'UNEXPECTED_PARAMETER');
  assert.equal(reason({actionClass:1}),'ACTION_CLASS_MISMATCH');
  assert.equal(reason({evidence:[]}),'MISSING_REQUIRED_EVIDENCE');
  assert.equal(evaluateActionPolicy({...proposal(),confidence:1},context()).reasonCode,'MALFORMED_REQUEST');
  assert.equal(evaluateActionPolicy({...proposal(),killSwitches:switches()},context()).reasonCode,'MALFORMED_REQUEST');
});

test('Class 1 and Class 2 remain disabled and no future mutation has an executable surface',()=>{
  const class1={actionId:'repair.dispatch.retry',actionClass:1,parameters:{dispatchIdentity:'d'.repeat(64)},evidence:['dispatch_failure']};
  const class2={actionId:'repair.repository.draft_pr',actionClass:2,parameters:{runbookId:'known.runbook'},evidence:['repository_incident']};
  assert.equal(reason(class1),'AUTONOMY_CLASS_DISABLED');
  assert.equal(reason(class2),'AUTONOMY_CLASS_DISABLED');
  assert.equal(executableObserveAction(class1.actionId),null);
  assert.equal(executableObserveAction(class2.actionId),null);
  assert.equal(executableObserveAction('owner.arbitrary_sql'),null);
  assert.equal(typeof executableObserveAction('observe.health.inspect'),'object');
});

test('Class 3 remains empty and Class 4 escalates to owner',()=>{
  assert.equal(reason({actionId:'repair.auto_merge',actionClass:3,parameters:{},evidence:['verified_pull_request']}),'AUTO_MERGE_ALLOWLIST_EMPTY');
  const decision=evaluateActionPolicy(proposal({actionId:'owner.arbitrary_sql',actionClass:4,parameters:{},evidence:['owner_review']}),context());
  assert.equal(decision.decision,'ESCALATE');
  assert.equal(decision.reasonCode,'OWNER_APPROVAL_REQUIRED');
});

test('overall and independent mutation kill switches fail closed',()=>{
  assert.equal(reason({}, {killSwitches:switches(false)}),'AUTONOMY_DISABLED');
  const killSwitches=switches();killSwitches.cloudflare=false;
  assert.equal(reason({actionId:'repair.dispatch.retry',actionClass:1,parameters:{dispatchIdentity:'d'.repeat(64)},evidence:['dispatch_failure']},{killSwitches}),'MUTATION_DOMAIN_DISABLED');
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

test('classification needs registered deterministic rule, never proposer confidence',()=>{
  const evidence=[{reference:'github:run/1',hash:'e'.repeat(64)}];
  assert.deepEqual(classifyOperationalState({conditionId:'healthy',domain:'github',expectedState:{ok:true},observedState:{ok:true},evidence}),{classification:'GREEN',reasonCode:'HEALTHY_EXPECTED_STATE'});
  assert.deepEqual(classifyOperationalState({conditionId:'dispatch_failure_bounded',domain:'github',expectedState:{ok:true},observedState:{ok:false},evidence}),{classification:'AMBER',reasonCode:'KNOWN_BOUNDED_DISPATCH_FAILURE'});
  assert.equal(classifyOperationalState({conditionId:'novel_issue',domain:'github',expectedState:{},observedState:{},evidence}).classification,'RED');
  assert.equal(classifyOperationalState({conditionId:'dispatch_failure_bounded',domain:'unknown',expectedState:{},observedState:{},evidence}).classification,'RED');
  assert.equal(classifyOperationalState({conditionId:'dispatch_failure_bounded',domain:'github',expectedState:{},observedState:{},evidence,confidence:1}).classification,'RED');
});

test('incident identity and serialization are deterministic and evidence-bound',async()=>{
  const input={detectorId:'github.workflow',detectorVersion:'v1',detectedAt:'2026-09-08T11:00:00.000Z',domain:'github',expectedState:{status:'success'},observedState:{status:'failure'},evidence:[{reference:'github:run/1',hash:'e'.repeat(64)}],conditionId:'dispatch_failure_bounded',mainSha:SHA,actionHistory:[],finalDisposition:null};
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

test('provider health contract describes approved providers but cannot approve or influence one',()=>{
  const contract={providerId:'fpl',approvedPurpose:'Official operational health observation',approvedFields:['availability'],freshnessRequirementMs:60000,schemaVersion:'v1',parserVersion:'v1',requiredFields:['status'],quotaStatus:'AVAILABLE',authStatus:'VALID',qualityStatus:'HEALTHY',approvedFallbackState:'NONE',costBoundary:{currency:'GBP',maximumMinorUnits:0,period:'month'},prohibitedInfluence:['model','recommendation']};
  const result=validateProviderHealthContract(contract);
  assert.equal(result.ok,true);assert.equal(result.mayInfluenceProduction,false);assert.deepEqual(result.contract,contract);
});

test('provider contract rejects unknown provider, extra capability and secret material',()=>{
  const base={providerId:'fpl',approvedPurpose:'health',approvedFields:['availability'],freshnessRequirementMs:0,schemaVersion:'v1',parserVersion:'v1',requiredFields:['status'],quotaStatus:'UNKNOWN',authStatus:'MISSING',qualityStatus:'UNKNOWN',approvedFallbackState:'NONE',costBoundary:{currency:'GBP',maximumMinorUnits:0,period:'month'},prohibitedInfluence:['model']};
  assert.equal(validateProviderHealthContract({...base,providerId:'new-provider'}).reasonCode,'PROVIDER_NOT_APPROVED');
  assert.equal(validateProviderHealthContract({...base,mayInfluenceProduction:true}).reasonCode,'PROVIDER_CONTRACT_MALFORMED');
  assert.equal(validateProviderHealthContract({...base,costBoundary:{token:'secret'}}).reasonCode,'PROVIDER_CONTRACT_SECRET_FORBIDDEN');
});

test('foundation contains no actuator, network, credential, SQL or environment capability',()=>{
  for(const file of ['action-registry.mjs','incident.mjs','policy-engine.mjs','audit.mjs','provider-health-contract.mjs']){
    const source=fs.readFileSync(`workers/data-steward/${file}`,'utf8');
    assert.doesNotMatch(source,/\bfetch\s*\(|child_process|exec(?:File)?\s*\(|process\.env|CLOUDFLARE_API_TOKEN|GITHUB_TOKEN|\b(?:INSERT|UPDATE|DELETE|DROP|ALTER)\b/i,file);
  }
});
