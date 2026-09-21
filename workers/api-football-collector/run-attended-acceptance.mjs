import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {EXPECTED_D1_DATABASE_ID} from '../data-platform/phase4b/live-contract.mjs';
import {ATTENDED_ACCEPTANCE_PATH} from './collector.mjs';
import {runAttendedAcceptance} from './attended-acceptance.mjs';

const API='https://api.cloudflare.com/client/v4';
const WORKER='teamsheet-api-football-shadow-collector';
const fail=code=>{throw new Error(code);};
const required=(env,name)=>typeof env[name]==='string'&&env[name]?env[name]:fail('attended_environment_incomplete');

export async function executeLiveAttendedAcceptance({env=process.env,fetchImpl=globalThis.fetch}={}){
  const account=required(env,'CLOUDFLARE_ACCOUNT_ID'),token=required(env,'CLOUDFLARE_ATTENDED_MUTATION_TOKEN');
  const versionId=required(env,'API_FOOTBALL_ATTENDED_VERSION_ID'),trigger=required(env,'API_FOOTBALL_ATTENDED_TRIGGER_SECRET');
  const previewUrl=required(env,'API_FOOTBALL_ATTENDED_VERSION_PREVIEW_URL');
  const admission=JSON.parse(fs.readFileSync(required(env,'API_FOOTBALL_ATTENDED_ADMISSION_PATH'),'utf8'));
  const headers={Authorization:'Bearer '+token,'content-type':'application/json'};
  let providerInvocations=0;
  const cloudflare=async(url,init)=>{let response;try{response=await fetchImpl(url,{...init,headers:{...headers,...init?.headers},redirect:'error',signal:AbortSignal.timeout(15_000)});}catch{fail('attended_cloudflare_transport_ambiguous');}let body;try{body=await response.json();}catch{fail('attended_cloudflare_response_ambiguous');}if(!response.ok||body?.success!==true)fail('attended_cloudflare_operation_failed');return body.result;};
  const subdomain=enabled=>cloudflare(`${API}/accounts/${encodeURIComponent(account)}/workers/scripts/${WORKER}/subdomain`,{method:'POST',body:JSON.stringify({enabled:false,previews_enabled:enabled})});
  const runtime=async collectionEnabled=>{
    const sql=collectionEnabled
      ?'UPDATE api_football_runtime_state SET collection_enabled=1 WHERE provider=? AND collection_enabled=0 AND credential_state=? AND in_flight_attempt_id IS NULL'
      :'UPDATE api_football_runtime_state SET collection_enabled=0 WHERE provider=? AND collection_enabled=1';
    const params=collectionEnabled?['api-football','AVAILABLE']:['api-football'];
    const result=await cloudflare(`${API}/accounts/${encodeURIComponent(account)}/d1/database/${encodeURIComponent(EXPECTED_D1_DATABASE_ID)}/query`,{method:'POST',body:JSON.stringify({sql,params})});
    if(!Array.isArray(result)||result.length!==1||result[0]?.success!==true||Number(result[0]?.meta?.changes)!==1)fail('attended_runtime_mutation_ambiguous');
    return result;
  };
  const result=await runAttendedAcceptance({
    admission,versionId,
    enablePreview:()=>subdomain(true),disablePreview:()=>subdomain(false),
    enableCollection:()=>runtime(1),disableCollection:()=>runtime(0),
    invokeOnce:async()=>{
      if(providerInvocations!==0)fail('attended_second_invocation_forbidden');
      const url=new URL(previewUrl);if(url.protocol!=='https:'||url.pathname!=='/'||url.search||!url.hostname.startsWith(versionId+'-'))fail('attended_preview_url_identity_invalid');
      providerInvocations+=1;
      let response;try{response=await fetchImpl(new URL(ATTENDED_ACCEPTANCE_PATH,url),{method:'POST',headers:{'x-teamsheet-attended-trigger':trigger},redirect:'error',signal:AbortSignal.timeout(120_000)});}catch{return {requestCount:1,outcome:'AMBIGUOUS'};}
      if(response.status!==202)fail('attended_invocation_rejected');
      return {requestCount:1,outcome:'ACCEPTED'};
    }
  });
  return Object.freeze({...result,providerInvocations});
}

export async function main(){const result=await executeLiveAttendedAcceptance();console.log(JSON.stringify({ok:result.ok===true,classification:result.classification??null,reason:result.reason??null,providerInvocations:result.providerInvocations,retryAuthorized:false}));return result.ok?0:1;}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
