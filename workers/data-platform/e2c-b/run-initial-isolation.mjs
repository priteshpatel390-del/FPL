import fs from 'node:fs';
import {buildSchemaInspectionPlan} from '../e2-d1-rest-validation-plan.mjs';
import {e2IdentityFingerprint} from '../e2-live-http-adapter.mjs';

const required=name=>{const value=process.env[name];if(typeof value!=='string'||!value)throw new Error('e2c_b_isolation_environment_invalid');return value;};
const fingerprint=name=>{const value=required(name);if(!/^sha256:[0-9a-f]{64}$/.test(value))throw new Error('e2c_b_isolation_identity_invalid');return value;};
const boundedStatus=value=>Number.isInteger(value)&&value>=100&&value<=599?value:null;
const accountId=required('CLOUDFLARE_ACCOUNT_ID'),databaseId=required('E2C_DATABASE_ID'),databaseName=required('E2C_DATABASE_NAME');
if(e2IdentityFingerprint(accountId)!==fingerprint('CLOUDFLARE_E2C_APPROVED_ACCOUNT_FINGERPRINT')||e2IdentityFingerprint(accountId)===fingerprint('PRODUCTION_ACCOUNT_FINGERPRINT')||e2IdentityFingerprint(databaseId)!==fingerprint('CLOUDFLARE_E2C_APPROVED_DATABASE_FINGERPRINT'))throw new Error('e2c_b_isolation_identity_invalid');
const token=required('CLOUDFLARE_API_TOKEN'),headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'},base=`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}`;
const inspect=async(probeId,url,options,expectedResults)=>{
  let response;try{response=await fetch(url,{...options,headers,redirect:'error'});}catch{return {outcome:{probeId,httpStatus:null,jsonParsed:false,topLevelSuccess:null,resultCount:null,successfulResultCount:null,expectedResults},payload:null};}
  let payload,jsonParsed=false;try{payload=await response.json();jsonParsed=true;}catch{}
  const results=Array.isArray(payload?.result)?payload.result:null;
  const schemaObjects=probeId==='S00'&&Array.isArray(results?.[0]?.results)&&results[0].results.length<=10&&results[0].results.every(value=>value&&['table','index','view','trigger'].includes(value.type)&&typeof value.name==='string'&&/^[A-Za-z0-9_]{1,64}$/.test(value.name))?results[0].results.map(({type,name})=>({type,name})):null;
  return {outcome:{probeId,httpStatus:boundedStatus(response.status),jsonParsed,topLevelSuccess:typeof payload?.success==='boolean'?payload.success:null,resultCount:results?.length??null,successfulResultCount:results?results.filter(value=>value?.success===true).length:null,expectedResults,schemaObjects},payload};
};
const metadataResult=await inspect('M00',base,{method:'GET'},1),metadata=metadataResult.outcome;
if(metadata.httpStatus!==200||metadata.topLevelSuccess!==true)throw new Error('e2c_b_isolation_metadata_failed');
if(metadataResult.payload?.result?.uuid!==databaseId||metadataResult.payload?.result?.name!==databaseName)throw new Error('e2c_b_isolation_metadata_identity_failed');
const statements=buildSchemaInspectionPlan().statements;
const probes=[...statements.map((_,index)=>[`S${String(index).padStart(2,'0')}`,[index]]),['G02',[0,1]],['G04',[0,1,2,3]],['T04',[1,2,3,4]],['G08',[0,1,2,3,4,5,6,7]],['G16',Array.from({length:16},(_,i)=>i)],['G21',Array.from({length:21},(_,i)=>i)]];
const outcomes=[metadata];
for(const [probeId,indexes] of probes){const selected=indexes.map(index=>statements[index]);outcomes.push((await inspect(probeId,`${base}/query`,{method:'POST',body:JSON.stringify(selected.length===1?selected[0]:{batch:selected})},selected.length)).outcome);}
const report={evidenceSchemaVersion:'e2c-b-initial-isolation-v1',sourceSha:required('APPROVED_SHA'),mutationOccurred:false,cleanupOccurred:false,outcomes};
fs.writeFileSync(required('E2C_EVIDENCE_PATH'),JSON.stringify(report,null,2)+'\n',{encoding:'utf8',mode:0o600});
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## DATA-S2B E2C-B INITIAL isolation\n\n- Metadata: **PASS**\n- Read-only probes: **${probes.length}**\n- Mutation: **NONE**\n- Cleanup: **NONE**\n`);
