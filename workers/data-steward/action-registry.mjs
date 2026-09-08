import {deepFreeze,stableStringify} from '../../src/decision-intelligence/canonical.mjs';

export const POLICY_VERSION='data-ops-a1.1-v1';
export const AUTONOMY_CLASS=deepFreeze({OBSERVE:0,SAFE_REPAIR:1,REPOSITORY_REPAIR:2,AUTO_MERGE:3,OWNER_APPROVAL:4});
export const DECISION=deepFreeze({ALLOW:'ALLOW',DENY:'DENY',ESCALATE:'ESCALATE'});
export const MUTATION_DOMAINS=deepFreeze(['cloudflare','github_repository','d1','provider','auto_merge']);

const actions=[
  {actionId:'observe.health.inspect',actionClass:0,domain:'observation',description:'Inspect supplied health evidence without network access',mutates:false,ownerApprovalRequired:false,requiredEvidence:['health_snapshot'],permittedClassifications:['GREEN','AMBER','RED'],expectedPreconditions:['incident_matches_context'],allowedParameters:['scope'],idempotence:'read_only',retryBudget:2,rollbackRequired:false,verificationRequired:false,notificationPolicy:'exception_only',enabled:true,mutationDomain:null},
  {actionId:'observe.evidence.generate',actionClass:0,domain:'observation',description:'Generate deterministic incident evidence from supplied state',mutates:false,ownerApprovalRequired:false,requiredEvidence:['incident_snapshot'],permittedClassifications:['GREEN','AMBER','RED'],expectedPreconditions:['incident_matches_context'],allowedParameters:['format'],idempotence:'read_only',retryBudget:2,rollbackRequired:false,verificationRequired:false,notificationPolicy:'exception_only',enabled:true,mutationDomain:null},
  {actionId:'repair.dispatch.retry',actionClass:1,domain:'cloudflare',description:'Future bounded retry of an approved dispatch',mutates:true,ownerApprovalRequired:false,requiredEvidence:['dispatch_failure'],permittedClassifications:['AMBER'],expectedPreconditions:['exact_main','exact_pre_state'],allowedParameters:['dispatchIdentity'],idempotence:'bounded_replay_safe',retryBudget:1,rollbackRequired:false,verificationRequired:true,notificationPolicy:'always',enabled:false,mutationDomain:'cloudflare'},
  {actionId:'repair.repository.draft_pr',actionClass:2,domain:'github_repository',description:'Future branch, test, build and draft pull request repair',mutates:true,ownerApprovalRequired:false,requiredEvidence:['repository_incident'],permittedClassifications:['AMBER','RED'],expectedPreconditions:['exact_main','exact_pre_state'],allowedParameters:['runbookId'],idempotence:'branch_scoped',retryBudget:1,rollbackRequired:true,verificationRequired:true,notificationPolicy:'always',enabled:false,mutationDomain:'github_repository'},
  {actionId:'repair.auto_merge',actionClass:3,domain:'auto_merge',description:'Reserved auto-merge class with empty allowlist',mutates:true,ownerApprovalRequired:false,requiredEvidence:['verified_pull_request'],permittedClassifications:['GREEN'],expectedPreconditions:['exact_main','exact_pre_state'],allowedParameters:[],idempotence:'not_available',retryBudget:0,rollbackRequired:true,verificationRequired:true,notificationPolicy:'always',enabled:false,mutationDomain:'auto_merge'},
  {actionId:'owner.d1.migration.review',actionClass:4,domain:'d1',description:'Non-executable owner review gate for a separately proposed D1 migration',mutates:false,ownerApprovalRequired:true,requiredEvidence:['owner_review_request'],permittedClassifications:['RED'],expectedPreconditions:['separate_migration_approval_required'],allowedParameters:['proposalId'],idempotence:'review_only',retryBudget:0,rollbackRequired:false,verificationRequired:false,notificationPolicy:'always',enabled:false,mutationDomain:null}
];

export const ACTION_REGISTRY=deepFreeze(actions.slice().sort((a,b)=>a.actionId.localeCompare(b.actionId)));
export const AUTO_MERGE_ALLOWLIST=deepFreeze([]);
const byId=new Map(ACTION_REGISTRY.map(action=>[action.actionId,action]));
export const getActionDefinition=actionId=>byId.get(actionId)??null;
export const actionRegistryJson=()=>`${stableStringify(ACTION_REGISTRY)}\n`;
