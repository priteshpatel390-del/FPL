// DATA-OPS A1.3 — narrow GitHub Actions adapter for one read-only observation run.
// Ambient environment access, clock, fetch and operational logging stop here. Sentinel and domain
// modules remain dependency-injected and have no process environment or logging capability.
import {pathToFileURL} from 'node:url';
import {observeProductionChain} from './sentinels/observe-production-chain.mjs';
import {STEWARD_ENVIRONMENT_NAMES} from './sentinels/environment-contract.mjs';

export const readStewardEnvironment=(ambient=process.env)=>Object.freeze(Object.fromEntries(
  STEWARD_ENVIRONMENT_NAMES.map(name=>[name,ambient[name]])));

export const sanitizedSummary=result=>Object.freeze({
  dayDate:result.dayDate,
  verdict:result.outcome.verdict,
  evaluationReason:result.outcome.reasonCode,
  heartbeat:result.heartbeat.allCompleted&&result.heartbeat.allProving?'COMPLETE':'INCOMPLETE',
  escalationRequired:result.escalationRequired,
  sentinels:Object.freeze(result.observations.map(observation=>Object.freeze({
    sentinel:observation.sourceType,
    state:observation.observationState,
    reasonCode:observation.reasonCode,
    ...(observation.sourceType==='d1'&&Number.isSafeInteger(observation.normalizedState?.rowsRead)
      ?{rowsRead:observation.normalizedState.rowsRead}:{})
  })))
});

export async function runObserver({ambient=process.env,fetchImpl=globalThis.fetch,
  now=Date.now(),log=console.log,observeImpl=observeProductionChain}={}){
  const result=await observeImpl({env:readStewardEnvironment(ambient),fetchImpl,now});
  log(JSON.stringify(sanitizedSummary(result)));
  return result.escalationRequired?1:0;
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
  const exitCode=await runObserver().catch(()=>{
    console.log(JSON.stringify({verdict:'UNHEALTHY',evaluationReason:'OBSERVER_RUNTIME_FAILED',
      heartbeat:'INCOMPLETE',escalationRequired:true,sentinels:[]}));
    return 1;
  });
  process.exitCode=exitCode;
}
