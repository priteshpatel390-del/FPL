import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {runApiFootballActivationLivePreflight} from './activation-live-preflight.mjs';
import {validateAdmissionHandoff} from './run-attended-acceptance.mjs';
import {classifyLifecycleRouting,validateLifecycleProbeEvidence,VERSION_URL_LIFECYCLE_OBSERVATION_VERSION} from './run-version-url-lifecycle-observation.mjs';

export const VERSION_URL_LIFECYCLE_RECONCILIATION_VERSION='api-football-version-url-lifecycle-reconciliation-v1';
const safe=value=>Object.freeze(value);

function exactObservationShape(evidence){
  const keys=['approvedSha','attendedProbe','classification','d1Mutations','ok','previewDisableSucceeded','previewEnableSucceeded','previewMutations','providerRequests','reason','retryAuthorized','rootProbe','routing','triggerSecretReads','version','versionId','versionMutations','versionUrlReads'];
  return evidence&&typeof evidence==='object'&&JSON.stringify(Object.keys(evidence).sort())===JSON.stringify(keys.sort());
}

export function classifyVersionUrlLifecycleReconciliation(report,{observationEvidence}={}){
  const base={ok:false,version:VERSION_URL_LIFECYCLE_RECONCILIATION_VERSION,retryAuthorized:false};
  const stop=reason=>safe({...base,classification:'VERSION_URL_LIFECYCLE_RECONCILIATION_REQUIRED',reason});
  try{
    validateAdmissionHandoff(report,{approvedSha:report?.approvedSha,versionId:report?.inventory?.reviewedVersionId,versionApprovedSha:report?.versionApprovedSha,accountFingerprint:report?.accountFingerprint});
  }catch{return stop('pristine_state_not_reproved');}
  const runtime=report?.runtime||{},prior=report?.priorState||{},inventory=report?.inventory||{};
  if(inventory.previewUrls!==false||inventory.workersDev!==false||inventory.deploymentCount!==0||inventory.cronCount!==0||inventory.routeCount!==0||inventory.customDomainCount!==0)return stop('preview_or_infrastructure_cleanup_unproved');
  if(runtime.collectionEnabled!==0||runtime.credentialState!=='AVAILABLE'||runtime.activeLease!==false)return stop('runtime_state_unexpected');
  if(prior.requestAttempts!==0||prior.generations!==0||prior.fixtureRevisions!==0||prior.attempt2Count!==0||prior.reservedAttemptCount!==0||prior.stagingGenerationCount!==0)return stop('provider_history_unexpected');
  if(report?.evidence?.productionMutations!==0||report?.evidence?.apiFootballRequests!==0||report?.evidence?.secretValuesRead!==0)return stop('reconciliation_evidence_unexpected');

  const evidence=observationEvidence;
  if(!exactObservationShape(evidence)||evidence.version!==VERSION_URL_LIFECYCLE_OBSERVATION_VERSION||evidence.approvedSha!==report.approvedSha||evidence.versionId!==inventory.reviewedVersionId)return stop('observation_identity_invalid');
  if(evidence.ok!==true||evidence.classification!=='LIFECYCLE_OBSERVATION_COMPLETE_RECONCILIATION_REQUIRED'||evidence.reason!=='observation_complete_requires_reconciliation'||evidence.retryAuthorized!==false)return stop('observation_completion_invalid');
  if(evidence.providerRequests!==0||evidence.d1Mutations!==0||evidence.versionMutations!==0||evidence.triggerSecretReads!==0)return stop('forbidden_activity_detected');
  if(evidence.previewEnableSucceeded!==true||evidence.previewDisableSucceeded!==true||evidence.previewMutations!==2)return stop('preview_cleanup_unproved');
  if(!Number.isInteger(evidence.versionUrlReads)||evidence.versionUrlReads<1||evidence.versionUrlReads>3)return stop('version_url_read_count_invalid');
  if(!validateLifecycleProbeEvidence(evidence.rootProbe)||!validateLifecycleProbeEvidence(evidence.attendedProbe))return stop('probe_evidence_invalid');
  const routing=classifyLifecycleRouting({rootProbe:evidence.rootProbe,attendedProbe:evidence.attendedProbe});
  if(evidence.routing!==routing)return stop('routing_classification_inconsistent');
  return safe({...base,ok:true,classification:'VERSION_URL_LIFECYCLE_RECONCILED',reason:null,routing});
}

export async function main(){
  const observationPath=process.env.API_FOOTBALL_VERSION_URL_LIFECYCLE_REPORT_PATH;
  const observationEvidence=observationPath?JSON.parse(fs.readFileSync(observationPath,'utf8')):null;
  const report=await runApiFootballActivationLivePreflight({stage:'ATTENDED_ACCEPTANCE'});
  const result=classifyVersionUrlLifecycleReconciliation(report,{observationEvidence});
  const output=safe({version:result.version,observedAt:report.observedAt,approvedSha:report.approvedSha,versionApprovedSha:report.versionApprovedSha,stage:report.stage,classification:result.classification,reason:result.reason??null,routing:result.routing??null,retryAuthorized:false,migrationCount:report.migrationCount,foreignKeyViolations:report.foreignKeyViolations,runtime:report.runtime,priorState:report.priorState,inventory:report.inventory,evidence:safe({...report.evidence,productionMutations:0,apiFootballRequests:0,secretValuesRead:0})});
  const outputPath=process.env.API_FOOTBALL_VERSION_URL_LIFECYCLE_RECONCILIATION_PATH;
  if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:result.ok,classification:result.classification,reason:result.reason??null,routing:result.routing??null,retryAuthorized:false}));
  return result.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
