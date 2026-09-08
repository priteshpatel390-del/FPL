// DATA-OPS-A1.2 — the observation orchestrator.
//
// One function wires the three sentinels together: it opens an observation run, asks each sentinel
// for its bounded read, normalizes each result into a repository-owned evidence envelope, closes
// the heartbeat, evaluates the chain and produces the A1.1 incident input. It reads no file, reads
// no ambient environment, starts no timer and registers no schedule: the caller supplies the
// environment record, the clock and the fetch implementation, which is exactly what lets the whole
// thing be proven from deterministic fixtures without a network.
//
// THERE IS NO ENTRY POINT HERE ON PURPOSE. A1.2 is repository implementation, not permission to
// deploy a new autonomous observer. Nothing in this module can be executed by a scheduler as it
// stands, and activating one is a separate, explicitly gated owner decision.
//
// AND THERE IS NO ACTUATOR HERE ON PURPOSE. The function returns a verdict, evidence and an
// incident input. It cannot fix a workflow, re-run a job, rotate a credential, redeploy a Worker,
// edit a Cron Trigger, write to D1, repair data, change configuration, open or merge a pull
// request, or call an AI to decide any of those things.
import {deepFreeze} from '../../../src/decision-intelligence/canonical.mjs';
import {createObservation} from './observation-contract.mjs';
import {EXPECTED_DISPATCHER_WORKER,utcDayWindow} from './production-chain-contract.mjs';
import {readGithubChain} from './github-sentinel.mjs';
import {readCloudflareConfiguration} from './cloudflare-sentinel.mjs';
import {readD1State} from './d1-sentinel.mjs';
import {resolveStewardEnvironment} from './environment-contract.mjs';
import {closeObservationRun,evaluateProductionChain,incidentInputFor,observationDayDate,
  openObservationRun,verdictObservation,VERDICT_UNHEALTHY} from './observation-run.mjs';

const at=now=>new Date(now).toISOString();
const instantIso=value=>value===null||value===undefined?null:new Date(value).toISOString();

// A sentinel that could not establish its facts still produces an envelope, so its failure is
// recorded rather than missing. The envelope's state is the failure, and a failed envelope can
// never satisfy the proving test the heartbeat applies.
const failedEnvelope=(sourceType,sourceIdentity,subjectIdentity,reasonCode,now,cryptoImpl)=>
  createObservation({sourceType,sourceIdentity,subjectIdentity,observedAt:at(now),subjectTime:null,
    observationState:'OBSERVATION_FAILED',reasonCode,normalizedState:{observed:false},
    provenance:[],freshnessAgeMs:null},{cryptoImpl});

export async function observeProductionChain({env,fetchImpl,now,cryptoImpl=globalThis.crypto}){
  const day=utcDayWindow(now);
  const dayDate=observationDayDate(now);
  const run=await openObservationRun({startedAt:at(now)},{cryptoImpl});
  const resolved=resolveStewardEnvironment(env);

  const observations={};
  let github=null,cloudflare=null,d1=null;

  if(!resolved.ok){
    // No credential means no read. Every sentinel is recorded as failed for that one reason, and
    // the run fails closed rather than reporting a partially observed chain.
    for(const [sentinelId,subject] of [['github',`github-chain/${dayDate}`],
      ['cloudflare',`dispatcher/${EXPECTED_DISPATCHER_WORKER}`],['d1',`production-d1/${dayDate}`]])
      observations[sentinelId]=await failedEnvelope(sentinelId,`sentinel.${sentinelId}`,subject,
        resolved.reasonCode,now,cryptoImpl);
  }else{
    github=await readGithubChain({token:resolved.githubToken,fetchImpl,now}).catch(()=>null);
    observations.github=github?.ok
      ?await createObservation({sourceType:'github',sourceIdentity:'sentinel.github',
        subjectIdentity:`github-chain/${dayDate}`,observedAt:at(now),
        subjectTime:instantIso(github.day.firstCollectionAt),observationState:'OBSERVED',
        reasonCode:github.reasonCode,
        normalizedState:{mainSha:github.mainSha,verify:github.verify,
          collected:github.day.collected,collectExecutions:github.day.collectExecutions,
          collectFailed:github.day.collectFailed,
          refusedConsumed:github.day.refusedOpportunityConsumed,
          gateRefusedOther:github.day.gateRefusedOther,inFlight:github.day.inFlight,
          unclassified:github.day.unclassified,ownerCollections:github.day.ownerCollections,
          automaticCollections:github.day.automaticCollections,
          duplicateCollection:github.day.duplicateCollection},
        provenance:[`github:workflow-b/${dayDate}`,`github:workflow-c/${dayDate}`],
        freshnessAgeMs:0},{cryptoImpl})
      :await failedEnvelope('github','sentinel.github',`github-chain/${dayDate}`,
        github?.reasonCode??'GITHUB_READ_FAILED',now,cryptoImpl);

    cloudflare=await readCloudflareConfiguration({accountId:resolved.cloudflareAccountId,
      accountFingerprint:resolved.cloudflareAccountFingerprint,token:resolved.cloudflareReadToken,
      fetchImpl}).catch(()=>null);
    observations.cloudflare=cloudflare?.ok
      ?await createObservation({sourceType:'cloudflare',sourceIdentity:'sentinel.cloudflare',
        subjectIdentity:`dispatcher/${EXPECTED_DISPATCHER_WORKER}`,observedAt:at(now),
        subjectTime:cloudflare.deployedAt,observationState:'OBSERVED',reasonCode:cloudflare.reasonCode,
        normalizedState:{worker:cloudflare.worker,cronSetExpected:cloudflare.cronSetExpected,
          cronExpressions:[...cloudflare.cronExpressions],deploymentId:cloudflare.deploymentId,
          observabilityEnabled:cloudflare.observabilityEnabled,
          invocationHistory:cloudflare.invocationHistory},
        provenance:[`cloudflare:worker/${EXPECTED_DISPATCHER_WORKER}`],freshnessAgeMs:0},{cryptoImpl})
      :await failedEnvelope('cloudflare','sentinel.cloudflare',`dispatcher/${EXPECTED_DISPATCHER_WORKER}`,
        cloudflare?.reasonCode??'CLOUDFLARE_READ_FAILED',now,cryptoImpl);

    d1=await readD1State({accountId:resolved.cloudflareAccountId,token:resolved.cloudflareReadToken,
      fetchImpl,dayStartIso:at(day.start),dayEndIso:at(day.end)}).catch(()=>null);
    observations.d1=d1?.ok
      ?await createObservation({sourceType:'d1',sourceIdentity:'sentinel.d1',
        subjectIdentity:`production-d1/${dayDate}`,observedAt:at(now),
        subjectTime:instantIso(d1.runs.latestCompletedAt),observationState:'OBSERVED',
        reasonCode:d1.reasonCode,
        normalizedState:{migrationVersion:d1.governance.migrationVersion,runsTotal:d1.runs.total,
          runsCompleted:d1.runs.completed,runsFailed:d1.runs.failed,runsUnresolved:d1.runs.unresolved,
          observations:d1.integrity.observations,logicalKeys:d1.integrity.logicalKeys,
          heads:d1.integrity.heads,orphanHeads:d1.integrity.orphanHeads,
          rejections:d1.integrity.rejections,consistent:d1.integrity.consistent,
          rowsRead:d1.rowsRead},
        provenance:[`d1:production/${dayDate}`],freshnessAgeMs:0},{cryptoImpl})
      :await failedEnvelope('d1','sentinel.d1',`production-d1/${dayDate}`,
        d1?.reasonCode??'D1_READ_FAILED',now,cryptoImpl);
  }

  const heartbeat=await closeObservationRun({run,observations,completedAt:at(now)},{cryptoImpl});
  const outcome=evaluateProductionChain({heartbeat,github,cloudflare,d1,now});
  const verdictEnvelope=await verdictObservation({outcome,now,dayDate,heartbeat},{cryptoImpl});
  const ordered=heartbeat.required.map(sentinelId=>observations[sentinelId]);
  return deepFreeze({
    dayDate,
    heartbeat,
    outcome,
    observations:deepFreeze(ordered),
    verdictObservation:verdictEnvelope,
    incidentInput:incidentInputFor({outcome,mainSha:github?.mainSha??null,now,observations:ordered,
      verdictEnvelope}),
    // Restated on every run so a reader never has to infer it: A1.2 observes and classifies only.
    remediationAvailable:false,
    escalationRequired:outcome.verdict===VERDICT_UNHEALTHY
  });
}
