import {D1_MAX_BATCH_STATEMENTS,inspectOfficialFplD1RestPlan} from './official-fpl-d1-rest-plan.mjs';

export const D1_REST_REQUEST_LIMIT_BYTES=16*1024*1024;
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const encoder=new TextEncoder();
export class D1RestError extends Error{constructor(code){super(code);this.name='D1RestError';this.code=code;}}
const fail=code=>{throw new D1RestError(code);};

export function createD1RestClient(options){
  if(!options||Object.keys(options).some(key=>!['accountId','databaseId','token','transport'].includes(key)))fail('d1_config_invalid');
  const {accountId,databaseId,token,transport}=options||{};
  if(!ID.test(accountId||'')||!ID.test(databaseId||'')||typeof token!=='string'||!token||typeof transport!=='function')fail('d1_config_invalid');
  const url=`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
  return Object.freeze({run:async plan=>{
    const trusted=inspectOfficialFplD1RestPlan(plan);if(!trusted)fail('d1_plan_untrusted');
    if(trusted.statements.length>D1_MAX_BATCH_STATEMENTS)fail('d1_plan_untrusted');
    const bodyObject=trusted.statements.length===1?trusted.statements[0]:{batch:trusted.statements};
    const body=JSON.stringify(bodyObject);if(encoder.encode(body).byteLength>D1_REST_REQUEST_LIMIT_BYTES)fail('d1_request_too_large');
    let response;try{response=await transport(Object.freeze({method:'POST',url,headers:Object.freeze({Authorization:`Bearer ${token}`,'Content-Type':'application/json'}),body,redirect:'error'}));}
    catch{fail(trusted.mutation?'d1_mutation_outcome_unknown':'d1_transport_failed');}
    const status=Number(response?.status);if(status===401||status===403)fail('d1_auth_failed');if(status===429)fail('d1_rate_limited');if(!Number.isInteger(status)||status<200||status>=300)fail('d1_http_failed');
    let payload;try{payload=typeof response.json==='function'?await response.json():JSON.parse(response.body);}catch{fail('d1_response_json_invalid');}
    if(!payload||payload.success!==true)fail('d1_api_failed');
    const results=Array.isArray(payload.result)?payload.result:null;if(!results||results.length!==trusted.statements.length)fail('d1_result_contract_invalid');
    for(const result of results)if(!result||result.success!==true)fail('d1_statement_failed');
    // Provider accounting. The aggregate `usage` scalar is unchanged and stays the single value
    // every existing caller and ceiling reads. Alongside it the per-statement integer breakdown is
    // now preserved rather than discarded, so a resource failure can name which statement in a
    // batch consumed the rows instead of only reporting one total. It carries integers only: no
    // SQL text, no bound parameter, no request URL, no identifier and no response body.
    const usage={rowsRead:0,rowsWritten:0,changes:0};
    const statements=[];
    for(const result of results){
      const meta=result.meta??{};
      const entry={rowsRead:0,rowsWritten:0,changes:0};
      for(const [provider,key] of [['rows_read','rowsRead'],['rows_written','rowsWritten'],['changes','changes']]){
        const value=meta[provider]??0;
        if(!Number.isSafeInteger(value))fail(`d1_result_contract_invalid_${provider}_type`);
        if(value<0||value>1000000)fail(`d1_result_contract_invalid_${provider}_range`);
        usage[key]+=value;entry[key]=value;
      }
      statements.push(Object.freeze(entry));
    }
    const requestBytes=encoder.encode(body).byteLength;
    return Object.freeze({results,usage:Object.freeze(usage),requestBytes,
      statements:Object.freeze(statements)});
  }});
}
