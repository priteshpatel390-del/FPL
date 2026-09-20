import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {
  CLOUDFLARE_API_BASE,EXPECTED_DATA_PLATFORM_WORKER,runApiFootballLiveStoragePreflight
} from '../../api-football-collector/live-storage-preflight.mjs';

export const D1_FREE_ROWS_WRITTEN_PER_UTC_DAY=100000;
export const MIGRATION_0005_ACCOUNT_ROWS_WRITTEN_ADMISSION_MAX=50000;
const TIMEOUT_MS=15000;
const GRAPHQL_URL='https://api.cloudflare.com/client/v4/graphql';
const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const integer=value=>Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):null;

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
  return {ok:true,count:rows.map(row=>typeof row==='string'?row:row?.cron).filter(value=>typeof value==='string').length};
}

export function summarizeAccountD1WriteUsage(payload,{utcDate}){
  const accounts=payload?.data?.viewer?.accounts;
  if(Array.isArray(payload?.errors)&&payload.errors.length)return {ok:false,reason:'d1_write_usage_unreadable'};
  if(!Array.isArray(accounts)||accounts.length!==1)return {ok:false,reason:'d1_write_usage_unreadable'};
  const groups=accounts[0]?.d1AnalyticsAdaptiveGroups;
  if(!Array.isArray(groups))return {ok:false,reason:'d1_write_usage_unreadable'};
  let rowsWritten=0;
  for(const group of groups){
    const date=group?.dimensions?.date;
    const value=integer(group?.sum?.rowsWritten??0);
    if(value===null||typeof date!=='string'||date!==utcDate)return {ok:false,reason:'d1_write_usage_unreadable'};
    rowsWritten+=value;
    if(!Number.isSafeInteger(rowsWritten))return {ok:false,reason:'d1_write_usage_unreadable'};
  }
  return Object.freeze({ok:true,utcDate,rowsWritten});
}

export async function readAccountD1WriteUsage(fetchImpl,{accountId,token,nowIso}){
  const utcDate=String(nowIso).slice(0,10);
  const query=`query TeamsheetD1WriteBudget($accountTag: string!, $start: Date!, $end: Date!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      d1AnalyticsAdaptiveGroups(limit: 10000, filter: { date_geq: $start, date_leq: $end }) {
        sum { rowsWritten }
        dimensions { date databaseId }
      }
    }
  }
}`;
  let response;
  try{
    response=await fetchImpl(GRAPHQL_URL,{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query,variables:{accountTag:accountId,start:utcDate,end:utcDate}}),signal:AbortSignal.timeout(TIMEOUT_MS)});
  }catch{return {ok:false,reason:'d1_write_usage_unreadable'};}
  if(response?.status!==200)return {ok:false,reason:'d1_write_usage_unreadable'};
  let payload;try{payload=await response.json();}catch{return {ok:false,reason:'d1_write_usage_unreadable'};}
  return summarizeAccountD1WriteUsage(payload,{utcDate});
}

export async function runMigration0005Preflight({
  env=process.env,fetchImpl=globalThis.fetch,now=()=>new Date().toISOString(),
  livePreflightImpl=runApiFootballLiveStoragePreflight,usageImpl=readAccountD1WriteUsage
}={}){
  const mode=env.MIGRATION_0005_PREFLIGHT_MODE;
  if(!['pre','post'].includes(mode))return {ok:false,reason:'migration_0005_preflight_mode_invalid'};
  const report=await livePreflightImpl({env,fetchImpl,now});
  if(!report?.ok)return {ok:false,reason:report?.reason??'live_storage_preflight_failed'};
  if(report.hardStops.length!==0)return {ok:false,reason:'live_storage_preflight_hard_stop',hardStops:report.hardStops};
  const expected=mode==='pre'?'READY_FOR_MIGRATION_0005':'READY_FOR_MIGRATION_0006';
  if(report.nextAction!==expected)return {ok:false,reason:'migration_0005_preflight_state_not_admitted',nextAction:report.nextAction};

  const accountId=env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID;
  const token=env.DATA_STEWARD_CLOUDFLARE_READ_TOKEN;
  const fingerprint=env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT;
  if(typeof accountId!=='string'||!accountId||typeof token!=='string'||!token||typeof fingerprint!=='string'||digest(accountId)!==fingerprint)
    return {ok:false,reason:'migration_0005_preflight_identity_invalid'};
  const schedules=await readSchedules(fetchImpl,{accountId,token});
  if(!schedules.ok)return schedules;
  if(schedules.count!==0)return {ok:false,reason:'legacy_data_platform_cron_present',count:schedules.count};

  let writeBudget=null;
  if(mode==='pre'){
    const nowIso=new Date(now()).toISOString();
    const usage=await usageImpl(fetchImpl,{accountId,token,nowIso});
    if(!usage?.ok)return {ok:false,reason:usage?.reason??'d1_write_usage_unreadable'};
    if(usage.rowsWritten>MIGRATION_0005_ACCOUNT_ROWS_WRITTEN_ADMISSION_MAX)
      return {ok:false,reason:'d1_daily_write_headroom_insufficient',rowsWritten:usage.rowsWritten,admissionMax:MIGRATION_0005_ACCOUNT_ROWS_WRITTEN_ADMISSION_MAX};
    writeBudget=Object.freeze({
      utcDate:usage.utcDate,observedRowsWritten:usage.rowsWritten,
      admissionMax:MIGRATION_0005_ACCOUNT_ROWS_WRITTEN_ADMISSION_MAX,
      freeDailyLimit:D1_FREE_ROWS_WRITTEN_PER_UTC_DAY,
      reservedHeadroom:D1_FREE_ROWS_WRITTEN_PER_UTC_DAY-MIGRATION_0005_ACCOUNT_ROWS_WRITTEN_ADMISSION_MAX
    });
  }

  return Object.freeze({
    ok:true,mode,observedAt:report.observedAt,nextAction:report.nextAction,
    migrationLedger:report.migrations.ledger.map(row=>Object.freeze({version:row.version,name:row.name})),
    foreignKeyViolations:report.foreignKeyViolations,
    officialFplAuthority:Object.freeze({valid:report.officialFplAuthority.valid,fresh:report.officialFplAuthority.fresh,teamCount:report.officialFplAuthority.teamCount,completedAt:report.officialFplAuthority.completedAt}),
    legacyDataPlatformCronCount:0,writeBudget,
    apiFootballState:Object.freeze({
      mappingRowCount:report.apiFootballState.mappingRowCount,runtimePresent:report.apiFootballState.runtimeState.present,
      collectionEnabled:report.apiFootballState.runtimeState.collectionEnabled??null,
      requestAttemptCount:report.apiFootballState.requestAttemptCount,fixtureRevisionCount:report.apiFootballState.fixtureRevisionCount,
      mappingQualificationCount:report.apiFootballState.mappingQualifications?.total??0
    }),
    collector:Object.freeze({exists:report.collector.exists,deploymentCount:report.collector.deploymentCount,cronCount:report.collector.crons.length,apiFootballSecretBindingPresent:report.collector.apiFootballSecretBindingPresent}),
    evidence:Object.freeze({productionMutations:0,apiFootballRequests:0,liveStorageCloudflareGets:report.evidence.cloudflareGets,extraCloudflareGets:1,analyticsQueries:mode==='pre'?1:0,d1QueryCalls:report.evidence.d1QueryCalls,d1RowsRead:report.evidence.d1RowsRead})
  });
}

export async function main(){
  const report=await runMigration0005Preflight();
  const path=process.env.MIGRATION_0005_PREFLIGHT_REPORT_PATH;
  if(typeof path==='string'&&path)fs.writeFileSync(path,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  if(typeof process.env.GITHUB_STEP_SUMMARY==='string'&&process.env.GITHUB_STEP_SUMMARY){
    const lines=['### Migration 0005 '+String(process.env.MIGRATION_0005_PREFLIGHT_MODE||'')+'flight','',
      '- Outcome: '+(report.ok?'PASS':'FAIL'),'- State: '+String(report.nextAction??report.reason??'unknown'),
      '- Legacy data-platform Cron count: '+String(report.legacyDataPlatformCronCount??'unknown'),
      '- Account D1 rows written today: '+String(report.writeBudget?.observedRowsWritten??'not-read'),
      '- Production mutations: 0','- API-Football requests: 0'];
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
  }
  console.log(JSON.stringify({ok:report.ok,mode:report.mode??null,nextAction:report.nextAction??null,reason:report.reason??null,productionMutations:0,apiFootballRequests:0}));
  return report.ok?0:1;
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
