const API='https://api.cloudflare.com/client/v4';
const ID=/^[A-Fa-f0-9-]{16,64}$/;const ACCOUNT=/^[A-Za-z0-9_-]{1,128}$/;
const invalid=()=>{throw new Error('e2_http_adapter_config_invalid');};
/** Inert until explicitly constructed with an injected fetch implementation. */
export function createE2LiveHttpAdapter({accountId,databaseId,token,fetchImpl}){
  if(!ACCOUNT.test(accountId||'')||!ID.test(databaseId||'')||typeof token!=='string'||!token||typeof fetchImpl!=='function')invalid();
  const base=`${API}/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}`;
  const request=async(method,path,body)=>fetchImpl(`${base}${path}`,{method,redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body})});
  return Object.freeze({readExactMetadata:()=>request('GET',''),query:body=>{if(typeof body!=='string'||!body)throw new Error('e2_http_query_body_invalid');return request('POST','/query',body);}});
}
export const E2_LIVE_HTTP_CAPABILITY=Object.freeze({host:'api.cloudflare.com',metadataMethod:'GET',queryMethod:'POST',querySuffix:'/query'});
