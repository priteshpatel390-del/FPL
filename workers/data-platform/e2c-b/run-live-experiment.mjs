import fs from 'node:fs';
import {runE2LiveHttpContract} from '../e2-live-orchestrator.mjs';
import {e2IdentityFingerprint} from '../e2-live-http-adapter.mjs';
import {E2_INITIAL_SCHEMA_FINGERPRINT} from '../e2-d1-rest-validation-plan.mjs';

const required=name=>{const value=process.env[name];if(typeof value!=='string'||!value)throw Object.assign(new Error('e2c_b_environment_invalid'),{code:'e2c_b_environment_invalid'});return value;};
const canonicalNow=()=>new Date().toISOString();
const approvedSha=required('APPROVED_SHA'),accountId=required('CLOUDFLARE_ACCOUNT_ID'),databaseId=required('E2C_DATABASE_ID');
const identity=Object.freeze({accountFingerprint:e2IdentityFingerprint(accountId),approvedAccountFingerprint:e2IdentityFingerprint(accountId),productionAccountFingerprint:required('PRODUCTION_ACCOUNT_FINGERPRINT'),databaseName:required('E2C_DATABASE_NAME'),databaseFingerprint:e2IdentityFingerprint(databaseId),expectedDatabaseFingerprint:e2IdentityFingerprint(databaseId),schemaFingerprint:E2_INITIAL_SCHEMA_FINGERPRINT,tables:[]});
const startedAt=canonicalNow();let evidence=[],state='FAILED',failureClassification=null;
try{const result=await runE2LiveHttpContract({sourceSha:approvedSha,approvedSourceSha:approvedSha,runnerIdentity:'github-e2c-b-v1',startedAt,endedAt:canonicalNow(),identity,accountId,databaseId,token:required('CLOUDFLARE_API_TOKEN'),fetchImpl:globalThis.fetch});evidence=result.evidence;state=result.state;}
catch(error){evidence=Array.isArray(error?.evidence)?error.evidence:[];failureClassification=typeof error?.code==='string'&&/^e2[a-z0-9_-]{1,63}$/.test(error.code)?error.code:'e2c_b_failed';}
const report=Object.freeze({evidenceSchemaVersion:'e2c-b-report-v1',sourceSha:approvedSha,state,failureClassification,cleanupState:'NOT_PERFORMED_BY_E2C_B',evidence});
const output=JSON.stringify(report,null,2)+'\n',path=required('E2C_EVIDENCE_PATH');fs.writeFileSync(path,output,{encoding:'utf8',mode:0o600});
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## DATA-S2B E2C-B sanitized evidence\n\n- State: **${state}**\n- Failure classification: **${failureClassification??'none'}**\n- Evidence records: **${evidence.length}**\n- Cleanup: **NOT PERFORMED**\n`);
if(state!=='STOP')process.exitCode=1;
