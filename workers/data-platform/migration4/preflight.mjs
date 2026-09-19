// Migration-0004 read-only admission wrapper.
//
// Reuses the existing API-Football live-storage preflight, then adds the one writer-isolation fact
// that migration 0004 specifically needs: the historical teamsheet-data-platform Worker must still
// have zero Cron triggers. The live Official FPL writer is the isolated 01:17 dispatcher -> GitHub
// workflow path, which shares the production writer concurrency group with the migration workflow.

import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {
  CLOUDFLARE_API_BASE,EXPECTED_DATA_PLATFORM_WORKER,runApiFootballLiveStoragePreflight
} from '../../api-football-collector/live-storage-preflight.mjs';

const TIMEOUT_MS=15000;
const digest=value=>createHash('sha256').update(String(value)).digest('hex');

async function readSchedules(fetchImpl,{accountId,token}){
  const url=`${CLOUDFLARE_API_BASE}/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(EXPECTED_DATA_PLATFORM_WORKER)}/schedules`;
  let response;
  try{response=await fetchImpl(url,{method:'GET',redirect:'error',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(TIMEOUT_MS)});}
  catch{return {ok:false,reason:'legacy_data_platform_schedule_unreadable'};}
  if(response?.status!==200)return {ok:false,reason:'legacy_data_platform_schedule_unreadable'};
  let body;try{body=await response.json();}catch{return {ok:false,reason:'legacy_data_platform_schedule_unreadable'};}
  if(body?.success!==true)return {ok:false,reason:'legacy_data_platform_schedule_unreadable'};
  const rows=Array.isArray(body.result?.schedules)?body.result.schedules:Array.isArray(body.result)?body.result:null;
  if(!rows)return {ok:false,reason:'legacy_data_platform_schedule_unreadable'};
  const crons=rows.map(row=>typeof row==='string'?row:row?.cron).filter(value=>typeof value==='string');
  return {ok:true,count:crons.length};
}

export async function runMigration0004Preflight({env=process.env,fetchImpl=globalThis.fetch,now=()=>new Date().toISOString(),livePreflightImpl=runApiFootballLiveStoragePreflight}={}){
  const mode=env.MIGRATION_0004_PREFLIGHT_MODE;
  if(!['pre','post'].includes(mode))return {ok:false,reason:'migration_0004_preflight_mode_invalid'};
  const report=await livePreflightImpl({env,fetchImpl,now});
  if(!report?.ok)return {ok:false,reason:report?.reason??'live_storage_preflight_failed'};
  if(report.hardStops.length!==0)return {ok:false,reason:'live_storage_preflight_hard_stop',hardStops:report.hardStops};
  const admitted=mode==='pre'
    ?report.nextAction==='STOP_0004_NOT_APPLIED'
    :['READY_FOR_MIGRATION_0005','STOP_0004_NOT_APPLIED'].includes(report.nextAction);
  if(!admitted)return {ok:false,reason:'migration_0004_preflight_state_not_admitted',nextAction:report.nextAction};

  const accountId=env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID;
  const token=env.DATA_STEWARD_CLOUDFLARE_READ_TOKEN;
  const fingerprint=env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT;
  if(typeof accountId!=='string'||!accountId||typeof token!=='string'||!token||
     typeof fingerprint!=='string'||digest(accountId)!==fingerprint)
    return {ok:false,reason:'migration_0004_preflight_identity_invalid'};
  const schedules=await readSchedules(fetchImpl,{accountId,token});
  if(!schedules.ok)return schedules;
  if(schedules.count!==0)return {ok:false,reason:'legacy_data_platform_cron_present',count:schedules.count};

  return Object.freeze({
    ok:true,mode,observedAt:report.observedAt,nextAction:report.nextAction,
    migrationLedger:report.migrations.ledger.map(row=>Object.freeze({version:row.version,name:row.name})),
    foreignKeyViolations:report.foreignKeyViolations,
    officialFplAuthority:Object.freeze({
      valid:report.officialFplAuthority.valid,fresh:report.officialFplAuthority.fresh,
      teamCount:report.officialFplAuthority.teamCount,completedAt:report.officialFplAuthority.completedAt
    }),
    legacyDataPlatformCronCount:0,
    apiFootballState:Object.freeze({
      mappingRowCount:report.apiFootballState.mappingRowCount,
      runtimePresent:report.apiFootballState.runtimeState.present,
      requestAttemptCount:report.apiFootballState.requestAttemptCount,
      fixtureRevisionCount:report.apiFootballState.fixtureRevisionCount,
      mappingQualificationCount:report.apiFootballState.mappingQualifications?.total??0
    }),
    collector:Object.freeze({
      exists:report.collector.exists,deploymentCount:report.collector.deploymentCount,
      cronCount:report.collector.crons.length,apiFootballSecretBindingPresent:report.collector.apiFootballSecretBindingPresent
    }),
    evidence:Object.freeze({
      productionMutations:0,apiFootballRequests:0,
      liveStorageCloudflareGets:report.evidence.cloudflareGets,extraCloudflareGets:1,
      d1QueryCalls:report.evidence.d1QueryCalls,d1RowsRead:report.evidence.d1RowsRead
    })
  });
}

export async function main(){
  const report=await runMigration0004Preflight();
  const path=process.env.MIGRATION_0004_PREFLIGHT_REPORT_PATH;
  if(typeof path==='string'&&path)fs.writeFileSync(path,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  if(typeof process.env.GITHUB_STEP_SUMMARY==='string'&&process.env.GITHUB_STEP_SUMMARY){
    const lines=['### Migration 0004 '+String(process.env.MIGRATION_0004_PREFLIGHT_MODE||'')+'flight','',
      '- Outcome: '+(report.ok?'PASS':'FAIL'),
      '- State: '+String(report.nextAction??report.reason??'unknown'),
      '- Legacy data-platform Cron count: '+String(report.legacyDataPlatformCronCount??'unknown'),
      '- Production mutations: 0','- API-Football requests: 0'];
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
  }
  console.log(JSON.stringify({ok:report.ok,mode:report.mode??null,nextAction:report.nextAction??null,reason:report.reason??null,productionMutations:0,apiFootballRequests:0}));
  return report.ok?0:1;
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
