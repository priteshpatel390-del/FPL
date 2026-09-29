import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {ATTENDED_VERSION_APPROVED_SHA,ATTENDED_VERSION_ID} from './attended-version.mjs';
import {runApiFootballActivationLivePreflight} from './activation-live-preflight.mjs';
import {
  COLLECTOR_LIFECYCLE_CLONE_CLOSEOUT_READY,COLLECTOR_PREFLIGHT_ATTENDED_STAGE,
  COLLECTOR_PREFLIGHT_LIFECYCLE_CLONE_CLOSEOUT_STAGE
} from './activation-preflight.mjs';
import {
  VERSION_URL_CREATION_EXPERIMENT_VERSION
} from './run-version-url-creation-experiment.mjs';
import {classifyLifecycleRouting,validateLifecycleProbeEvidence} from './run-version-url-lifecycle-observation.mjs';

export const VERSION_URL_CREATION_RECONCILIATION_VERSION='api-football-version-url-creation-reconciliation-v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safe=value=>Object.freeze(value);

function exactFoundation(report){
  const inventory=report?.inventory||{},runtime=report?.runtime||{},prior=report?.priorState||{},mapping=report?.mapping||{};
  return report?.migrationCount===6&&report?.foreignKeyViolations===0&&report?.officialFplAuthority?.valid===true&&report?.officialFplAuthority?.teamCount===20&&
    mapping.state==='COMMITTED'&&mapping.mappingCount===20&&mapping.memberCount===20&&mapping.distinctProviderIds===20&&mapping.distinctFplIds===20&&
    mapping.canonicalCoverageMatches===true&&mapping.historicalAuthorityProvenancePresent===true&&runtime.collectionEnabled===0&&runtime.credentialState==='AVAILABLE'&&
    runtime.activeLease===false&&prior.requestAttempts===0&&prior.generations===0&&prior.fixtureRevisions===0&&prior.attempt2Count===0&&
    prior.reservedAttemptCount===0&&prior.stagingGenerationCount===0&&inventory.workerPresent===true&&inventory.workersDev===false&&inventory.previewUrls===false&&
    inventory.deploymentCount===0&&inventory.cronCount===0&&inventory.routeCount===0&&inventory.customDomainCount===0&&inventory.productionBindingProven===true&&
    inventory.configurationExact===true&&inventory.previewUrlIdentityExact===true&&inventory.secretBindingPresent===true&&
    JSON.stringify(inventory.secretBindingNames)===JSON.stringify(['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET'])&&
    report?.evidence?.productionMutations===0&&report?.evidence?.apiFootballRequests===0&&report?.evidence?.secretValuesRead===0;
}

function evidenceShape(e){
  const keys=['approvedSha','classification','cloneAttendedProbe','cloneRootProbe','cloneRouting','cloneVersionId','cloneVersionUrlReads','comparison',
    'cronRouteDomainMutations','d1Mutations','deploymentMutations','ok','oldAttendedProbe','oldRootProbe','oldRouting','oldVersionUrlReads',
    'previewDisableSucceeded','previewEnableAttempted','previewEnableSucceeded','previewMutationSubmissions','providerRequests','reason','retryAuthorized',
    'secretBindingsSubmitted','sourceVersionApprovedSha','sourceVersionId','triggerSecretRequestEgress','version','versionMutationSubmissions','versionUploadDisposition'];
  return e&&typeof e==='object'&&JSON.stringify(Object.keys(e).sort())===JSON.stringify(keys.sort());
}

function recomputeComparison(oldRouting,cloneRouting){
  if(oldRouting==='EXISTING_VERSION_ROUTABILITY_NOT_PROVEN'&&cloneRouting==='EXISTING_VERSION_ROUTABLE_BOTH_PATHS')return 'OLD_NOT_PROVEN_NEW_ROUTABLE_BOTH_PATHS';
  if(oldRouting===cloneRouting)return 'OLD_AND_NEW_ROUTING_CLASSIFICATION_MATCH';
  return 'OLD_AND_NEW_ROUTING_CLASSIFICATION_DIFFER';
}

export function classifyVersionUrlCreationReconciliation(report,{experimentEvidence}={}){
  const base={ok:false,version:VERSION_URL_CREATION_RECONCILIATION_VERSION,retryAuthorized:false};
  const stop=(reason,classification='VERSION_URL_CREATION_EXPERIMENT_RECONCILIATION_REQUIRED')=>safe({...base,classification,reason});
  if(!exactFoundation(report))return stop('pristine_state_not_reproved');
  const inventory=report.inventory||{},e=experimentEvidence;
  if(!evidenceShape(e)||e.version!==VERSION_URL_CREATION_EXPERIMENT_VERSION||e.approvedSha!==report.approvedSha||
    e.sourceVersionId!==ATTENDED_VERSION_ID||e.sourceVersionApprovedSha!==ATTENDED_VERSION_APPROVED_SHA||e.retryAuthorized!==false)return stop('experiment_identity_invalid');

  if(!UUID.test(String(e.cloneVersionId||''))){
    if(report.stage===COLLECTOR_PREFLIGHT_ATTENDED_STAGE&&report.ok===true&&inventory.reviewedVersionId===ATTENDED_VERSION_ID&&
      inventory.versionIdentityExact===true&&inventory.versionInventoryExact===true)return stop('experiment_stopped_before_clone_creation','VERSION_URL_CREATION_EXPERIMENT_SAFE_STOP');
    return stop('clone_identity_ambiguous');
  }

  if(report.stage!==COLLECTOR_PREFLIGHT_LIFECYCLE_CLONE_CLOSEOUT_STAGE||report.ok!==true||report.classification!==COLLECTOR_LIFECYCLE_CLONE_CLOSEOUT_READY||
    inventory.reviewedVersionId!==ATTENDED_VERSION_ID||inventory.cloneVersionId!==e.cloneVersionId||inventory.cloneVersionIdentityExact!==true||
    inventory.originalVersionIdentityExact!==true||inventory.versionIdentityExact!==true||inventory.versionInventoryExact!==true)return stop('three_version_inventory_not_proved');

  const fixed=e.versionMutationSubmissions===1&&e.previewMutationSubmissions===2&&e.previewEnableAttempted===true&&e.previewEnableSucceeded===true&&
    e.previewDisableSucceeded===true&&e.secretBindingsSubmitted===2&&e.triggerSecretRequestEgress===0&&e.providerRequests===0&&e.d1Mutations===0&&
    e.deploymentMutations===0&&e.cronRouteDomainMutations===0&&['definite','reconciled'].includes(e.versionUploadDisposition);
  if(!fixed)return stop('experiment_mutation_or_cleanup_evidence_invalid');

  const probes=[e.oldRootProbe,e.oldAttendedProbe,e.cloneRootProbe,e.cloneAttendedProbe];
  if(!probes.every(p=>validateLifecycleProbeEvidence(p)&&p.outcome==='HTTP_RESPONSE'))return stop('experiment_probe_evidence_incomplete');
  const oldRouting=classifyLifecycleRouting({rootProbe:e.oldRootProbe,attendedProbe:e.oldAttendedProbe});
  const cloneRouting=classifyLifecycleRouting({rootProbe:e.cloneRootProbe,attendedProbe:e.cloneAttendedProbe});
  if(e.oldRouting!==oldRouting||e.cloneRouting!==cloneRouting||e.comparison!==recomputeComparison(oldRouting,cloneRouting))return stop('experiment_routing_classification_inconsistent');
  if(e.ok!==true||e.classification!=='VERSION_URL_CREATION_EXPERIMENT_COMPLETE_RECONCILIATION_REQUIRED'||e.reason!=='experiment_complete_requires_reconciliation')return stop('experiment_completion_invalid');

  return safe({...base,ok:true,classification:'VERSION_URL_CREATION_EXPERIMENT_RECONCILED',reason:null,comparison:e.comparison,oldRouting,cloneRouting,cloneVersionId:e.cloneVersionId});
}

export async function main(){
  const experimentPath=process.env.API_FOOTBALL_VERSION_URL_CREATION_EXPERIMENT_REPORT_PATH;
  const experimentEvidence=experimentPath?JSON.parse(fs.readFileSync(experimentPath,'utf8')):null;
  const hasClone=UUID.test(String(experimentEvidence?.cloneVersionId||''));
  const env={...process.env,
    API_FOOTBALL_PREFLIGHT_STAGE:hasClone?COLLECTOR_PREFLIGHT_LIFECYCLE_CLONE_CLOSEOUT_STAGE:COLLECTOR_PREFLIGHT_ATTENDED_STAGE,
    API_FOOTBALL_ATTENDED_VERSION_ID:ATTENDED_VERSION_ID,
    API_FOOTBALL_ATTENDED_VERSION_APPROVED_SHA:ATTENDED_VERSION_APPROVED_SHA,
    API_FOOTBALL_LIFECYCLE_CLONE_VERSION_ID:hasClone?experimentEvidence.cloneVersionId:''
  };
  const report=await runApiFootballActivationLivePreflight({env,stage:env.API_FOOTBALL_PREFLIGHT_STAGE});
  const result=classifyVersionUrlCreationReconciliation(report,{experimentEvidence});
  const output=safe({
    version:result.version,observedAt:report.observedAt,approvedSha:report.approvedSha,stage:report.stage,
    classification:result.classification,reason:result.reason??null,comparison:result.comparison??experimentEvidence?.comparison??null,
    oldRouting:result.oldRouting??experimentEvidence?.oldRouting??null,cloneRouting:result.cloneRouting??experimentEvidence?.cloneRouting??null,
    cloneVersionId:result.cloneVersionId??experimentEvidence?.cloneVersionId??null,retryAuthorized:false,
    migrationCount:report.migrationCount,foreignKeyViolations:report.foreignKeyViolations,runtime:report.runtime,priorState:report.priorState,
    inventory:report.inventory,evidence:safe({...report.evidence,productionMutations:0,apiFootballRequests:0,secretValuesRead:0})
  });
  const outputPath=process.env.API_FOOTBALL_VERSION_URL_CREATION_RECONCILIATION_PATH;
  if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:result.ok,classification:result.classification,reason:result.reason??null,comparison:output.comparison,oldRouting:output.oldRouting,cloneRouting:output.cloneRouting,retryAuthorized:false}));
  return result.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
