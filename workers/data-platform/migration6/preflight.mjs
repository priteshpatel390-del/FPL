import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {runApiFootballLiveStoragePreflight,CLOUDFLARE_API_BASE,EXPECTED_DATA_PLATFORM_WORKER} from '../../api-football-collector/live-storage-preflight.mjs';
import {D1_FREE_ROWS_WRITTEN_PER_UTC_DAY,MIGRATION_0005_ACCOUNT_ROWS_WRITTEN_ADMISSION_MAX,readAccountD1WriteUsage} from '../migration5/preflight.mjs';

const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const expectedAction=Object.freeze({schema_pre:'READY_FOR_MIGRATION_0006',schema_post:'READY_FOR_PRIVATE_MAPPING_PERSISTENCE',mapping_pre:'READY_FOR_PRIVATE_MAPPING_PERSISTENCE',mapping_post:'EXISTING_MAPPING_STATE_REQUIRES_RECONCILIATION'});

async function dataPlatformSchedules(fetchImpl,{accountId,token}){
  try{
    const response=await fetchImpl(`${CLOUDFLARE_API_BASE}/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(EXPECTED_DATA_PLATFORM_WORKER)}/schedules`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
    const body=response?.status===200?await response.json():null;
    const rows=Array.isArray(body?.result?.schedules)?body.result.schedules:Array.isArray(body?.result)?body.result:null;
    return body?.success===true&&rows?rows.length:null;
  }catch{return null;}
}

export async function runMigration0006Preflight({env=process.env,fetchImpl=globalThis.fetch,now=()=>new Date().toISOString()}={}){
  const mode=env.MIGRATION_0006_PREFLIGHT_MODE;
  if(!Object.hasOwn(expectedAction,mode))return Object.freeze({ok:false,reason:'migration_0006_preflight_mode_invalid'});
  const accountId=env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID,token=env.DATA_STEWARD_CLOUDFLARE_READ_TOKEN;
  if(!accountId||!token||digest(accountId)!==env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT)return Object.freeze({ok:false,reason:'migration_0006_preflight_identity_invalid'});
  const report=await runApiFootballLiveStoragePreflight({env,fetchImpl,now});
  if(!report?.ok||report.hardStops.length||report.nextAction!==expectedAction[mode])return Object.freeze({ok:false,reason:'migration_0006_state_not_admitted',nextAction:report?.nextAction??null});
  const cronCount=await dataPlatformSchedules(fetchImpl,{accountId,token});
  if(cronCount!==0)return Object.freeze({ok:false,reason:'legacy_data_platform_cron_present'});
  let writeBudget=null;
  if(!['schema_post','mapping_post'].includes(mode)){
    const analyticsToken=env.DATA_STEWARD_CLOUDFLARE_ANALYTICS_TOKEN;
    if(!analyticsToken)return Object.freeze({ok:false,reason:'d1_write_usage_credential_missing'});
    const usage=await readAccountD1WriteUsage(fetchImpl,{accountId,token:analyticsToken,nowIso:new Date(now()).toISOString()});
    if(!usage.ok||usage.rowsWritten>MIGRATION_0005_ACCOUNT_ROWS_WRITTEN_ADMISSION_MAX)return Object.freeze({ok:false,reason:'d1_daily_write_headroom_insufficient'});
    writeBudget=Object.freeze({utcDate:usage.utcDate,observedRowsWritten:usage.rowsWritten,admissionMax:MIGRATION_0005_ACCOUNT_ROWS_WRITTEN_ADMISSION_MAX,freeDailyLimit:D1_FREE_ROWS_WRITTEN_PER_UTC_DAY});
  }
  return Object.freeze({ok:true,mode,nextAction:report.nextAction,ledger:report.migrations.ledger,foreignKeyViolations:report.foreignKeyViolations,
    officialFplAuthority:Object.freeze({valid:report.officialFplAuthority.valid,fresh:report.officialFplAuthority.fresh,teamCount:report.officialFplAuthority.teamCount}),
    mapping:Object.freeze({rows:report.apiFootballState.mappingRowCount,qualifications:report.apiFootballState.mappingQualifications?.total??0,headPresent:report.apiFootballState.mappingHead.present}),
    runtime:Object.freeze({collectionEnabled:report.apiFootballState.runtimeState.collectionEnabled,requestAttempts:report.apiFootballState.requestAttemptCount,fixtureRevisions:report.apiFootballState.fixtureRevisionCount}),
    collector:Object.freeze({exists:report.collector.exists,deployments:report.collector.deploymentCount,crons:report.collector.crons.length,apiKeyBinding:report.collector.apiFootballSecretBindingPresent}),
    legacyDataPlatformCronCount:0,writeBudget,productionMutations:0,apiFootballRequests:0});
}

export async function main(){
  const report=await runMigration0006Preflight();
  if(process.env.MIGRATION_0006_PREFLIGHT_REPORT_PATH)fs.writeFileSync(process.env.MIGRATION_0006_PREFLIGHT_REPORT_PATH,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:report.ok,mode:report.mode??null,nextAction:report.nextAction??null,reason:report.reason??null,productionMutations:0,apiFootballRequests:0}));
  return report.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
