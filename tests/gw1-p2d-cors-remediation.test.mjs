import test from 'node:test';
import assert from 'node:assert/strict';
import { credentialledCorsResponse, handleEvidenceArchiveRequest } from '../workers/evidence-archive.mjs';

const APPROVED='https://priteshpatel390-del.github.io';
const WORKER='https://teamsheet-evidence-archive.fpltsheet.workers.dev';

function request(origin=APPROVED){
  return new Request(`${WORKER}/v1/evidence/predeadline`,{
    method:'OPTIONS',headers:origin?{Origin:origin}:{}
  });
}
function response(origin=APPROVED,status=204){
  const headers=new Headers();
  if(origin) headers.set('Access-Control-Allow-Origin',origin);
  return new Response(null,{status,headers});
}
function preflight({origin=APPROVED,method='POST',headers='content-type'}={}){
  const requestHeaders=new Headers();
  if(origin) requestHeaders.set('Origin',origin);
  if(method) requestHeaders.set('Access-Control-Request-Method',method);
  if(headers) requestHeaders.set('Access-Control-Request-Headers',headers);
  return new Request(`${WORKER}/v1/evidence/predeadline`,{method:'OPTIONS',headers:requestHeaders});
}
function actual(path='/v1/health',{origin=APPROVED,method='GET'}={}){
  const headers=new Headers();
  if(origin) headers.set('Origin',origin);
  return new Request(`${WORKER}${path}`,{method,headers});
}
function healthyEnv(){
  const firstFor=async sql=>{
    if(sql.includes('rate_limit_windows')) return {request_count:1};
    if(sql.includes('schema_migrations')) return {version:1};
    throw new Error(`Unexpected D1 first(): ${sql}`);
  };
  const db={
    prepare(sql){
      const statement={bind(){return statement;},first(){return firstFor(sql);}};
      return statement;
    }
  };
  const bucket={list:async()=>({objects:[],truncated:false,cursor:null})};
  return {EVIDENCE_DB:db,EVIDENCE_BUCKET:bucket,MAX_REQUESTS_PER_MINUTE:'30'};
}
async function throughCloudflareAdapter(request,env={},deps={}){
  const coreResponse=await handleEvidenceArchiveRequest(request,env,deps);
  return credentialledCorsResponse(coreResponse,request,env);
}

test('approved archive CORS response explicitly permits credentials without widening origin',()=>{
  const result=credentialledCorsResponse(response(),request(),{});
  assert.equal(result.headers.get('Access-Control-Allow-Origin'),APPROVED);
  assert.equal(result.headers.get('Access-Control-Allow-Credentials'),'true');
  assert.notEqual(result.headers.get('Access-Control-Allow-Origin'),'*');
});

test('missing origin never receives a credentialled CORS grant',()=>{
  const result=credentialledCorsResponse(response(null),request(null),{});
  assert.equal(result.headers.get('Access-Control-Allow-Origin'),null);
  assert.equal(result.headers.get('Access-Control-Allow-Credentials'),null);
});

test('foreign origin never receives a credentialled CORS grant',()=>{
  const foreign='https://example.com';
  const result=credentialledCorsResponse(response(foreign),request(foreign),{});
  assert.equal(result.headers.get('Access-Control-Allow-Credentials'),null);
});

test('adapter never upgrades a response unless core already granted the exact approved origin',()=>{
  const result=credentialledCorsResponse(response(null),request(),{});
  assert.equal(result.headers.get('Access-Control-Allow-Credentials'),null);
});

test('explicit configured approved origins receive the same narrow credential grant',()=>{
  const review='https://review.example.test';
  const result=credentialledCorsResponse(response(review),request(review),{ALLOWED_ORIGINS:review});
  assert.equal(result.headers.get('Access-Control-Allow-Origin'),review);
  assert.equal(result.headers.get('Access-Control-Allow-Credentials'),'true');
});

test('real OPTIONS path returns exact credentialled CORS contract for approved POST preflight',async()=>{
  const result=await throughCloudflareAdapter(preflight());
  assert.equal(result.status,204);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'),APPROVED);
  assert.equal(result.headers.get('Access-Control-Allow-Credentials'),'true');
  assert.match(result.headers.get('Access-Control-Allow-Methods')||'',/(^|,\s*)POST(,|$)/);
  assert.equal(result.headers.get('Access-Control-Allow-Headers'),'Content-Type');
  assert.equal(result.headers.get('Access-Control-Max-Age'),'600');
  assert.equal(result.headers.get('Vary'),'Origin');
  assert.notEqual(result.headers.get('Access-Control-Allow-Origin'),'*');
});

test('real OPTIONS path rejects foreign origins and does not grant credential permission',async()=>{
  const result=await throughCloudflareAdapter(preflight({origin:'https://example.com'}));
  assert.equal(result.status,403);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'),null);
  assert.equal(result.headers.get('Access-Control-Allow-Credentials'),null);
});

test('real OPTIONS path remains method-limited and header-limited',async()=>{
  const result=await throughCloudflareAdapter(preflight({method:'DELETE',headers:'authorization'}));
  assert.equal(result.status,405);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'),APPROVED);
  assert.equal(result.headers.get('Access-Control-Allow-Credentials'),'true');
  assert.equal(result.headers.get('Access-Control-Allow-Headers'),null);
  assert.equal(result.headers.get('Access-Control-Allow-Methods'),null);

  const allowedMethod=await throughCloudflareAdapter(preflight({headers:'authorization'}));
  assert.equal(allowedMethod.status,204);
  assert.equal(allowedMethod.headers.get('Access-Control-Allow-Headers'),'Content-Type');
  assert.doesNotMatch(allowedMethod.headers.get('Access-Control-Allow-Headers')||'',/authorization/i);
});

test('real authenticated success response is readable by the approved credentialled origin',async()=>{
  const env=healthyEnv();
  const result=await throughCloudflareAdapter(actual('/v1/health'),env,{authVerifier:async()=>({sub:'owner'})});
  assert.equal(result.status,200);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'),APPROVED);
  assert.equal(result.headers.get('Access-Control-Allow-Credentials'),'true');
  assert.equal(result.headers.get('Vary'),'Origin');
  assert.notEqual(result.headers.get('Access-Control-Allow-Origin'),'*');
  assert.deepEqual(await result.json(),{ok:true,archiveVersion:'1.0.0',schemaVersion:'1.0.0',migrationVersion:1});
});

test('real authenticated error response retains credentialled CORS while authentication still fails closed',async()=>{
  const unauthorised=Object.assign(new Error('denied'),{code:'unauthorised'});
  const result=await throughCloudflareAdapter(actual('/v1/health'),{}, {authVerifier:async()=>{throw unauthorised;}});
  assert.equal(result.status,403);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'),APPROVED);
  assert.equal(result.headers.get('Access-Control-Allow-Credentials'),'true');
  assert.equal(result.headers.get('Vary'),'Origin');
  assert.deepEqual(await result.json(),{error:'unauthorised'});
});
