import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UPSTREAM_BASE, matchApprovedRoute, safeErrorDiagnostic, handleFplGatewayRequest
} from '../workers/fpl-gateway.mjs';

const ORIGIN='https://priteshpatel390-del.github.io';
const jsonResponse=(body,status=200,headers={})=>new Response(JSON.stringify(body),{
  status,headers:{'Content-Type':'application/json',...headers}
});
const request=(path,options={})=>{
  const headers=new Headers(options.headers||{});
  const origin=options.origin===undefined?ORIGIN:options.origin;
  if(origin) headers.set('Origin',origin);
  return new Request('https://gateway.example'+path,{
    method:options.method||'GET',headers
  });
};

test('route allowlist accepts only approved Official FPL path and query shapes',()=>{
  assert.deepEqual(matchApprovedRoute(new URL('https://x/fpl/bootstrap-static/')),
    {upstreamPath:'/bootstrap-static/',cacheable:true});
  assert.deepEqual(matchApprovedRoute(new URL('https://x/fpl/fixtures/?event=3')),
    {upstreamPath:'/fixtures/?event=3',cacheable:false});
  assert.deepEqual(matchApprovedRoute(new URL('https://x/fpl/leagues-classic/99/standings/?page_standings=4')),
    {upstreamPath:'/leagues-classic/99/standings/?page_standings=4',cacheable:false});
  for(const value of [
    'https://x/fpl/fixtures/?url=https://evil.example',
    'https://x/fpl/fixtures/?event=39',
    'https://x/fpl/entry/0/',
    'https://x/fpl/event/39/live/',
    'https://x/fpl/../admin/'
  ]) assert.equal(matchApprovedRoute(new URL(value)),null,value);
});

test('gateway forwards a clean read-only request and never forwards credentials',async()=>{
  let seen=null;
  const response=await handleFplGatewayRequest(request('/fpl/bootstrap-static/',{
    headers:{Cookie:'session=secret',Authorization:'Bearer secret','X-Test':'nope'}
  }),{}, {fetchFn:async(url,options)=>{
    seen={url,options};return jsonResponse({events:[],teams:[],elements:[],element_types:[]},200,{ETag:'abc'});
  }});
  assert.equal(response.status,200);
  assert.equal(seen.url,UPSTREAM_BASE+'/bootstrap-static/');
  assert.equal(seen.options.redirect,'manual');
  const headers=new Headers(seen.options.headers);
  assert.equal(headers.get('Accept'),'application/json');
  assert.equal(headers.get('Cookie'),null);
  assert.equal(headers.get('Authorization'),null);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),ORIGIN);
  assert.equal(response.headers.get('Cache-Control'),'public, max-age=60, s-maxage=300');
  assert.equal(response.headers.get('ETag'),'abc');
});

test('dynamic account and league responses are not shared-cacheable',async()=>{
  const response=await handleFplGatewayRequest(request('/fpl/entry/123/'),{},
    {fetchFn:async()=>jsonResponse({name:'Team'})});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
});

test('unsupported methods, arbitrary routes and disallowed browser origins fail closed',async()=>{
  assert.equal((await handleFplGatewayRequest(request('/fpl/bootstrap-static/',{method:'POST'}))).status,405);
  assert.equal((await handleFplGatewayRequest(request('/fpl/proxy/?url=https://evil.example'))).status,404);
  assert.equal((await handleFplGatewayRequest(request('/fpl/bootstrap-static/',{origin:'https://evil.example'}))).status,403);
});

test('CORS preflight returns the exact approved origin without credentials',async()=>{
  const response=await handleFplGatewayRequest(request('/fpl/bootstrap-static/',{
    method:'OPTIONS',headers:{'Access-Control-Request-Method':'GET'}
  }));
  assert.equal(response.status,204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),ORIGIN);
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'),null);
  assert.match(response.headers.get('Access-Control-Allow-Methods'),/GET/);
});

test('non-JSON and malformed upstream responses are rejected rather than relayed',async()=>{
  let response=await handleFplGatewayRequest(request('/fpl/bootstrap-static/'),{},
    {fetchFn:async()=>new Response('<html>',{status:200,headers:{'Content-Type':'text/html'}})});
  assert.equal(response.status,502);
  assert.deepEqual(await response.json(),{error:'upstream_not_json'});
  response=await handleFplGatewayRequest(request('/fpl/bootstrap-static/'),{},
    {fetchFn:async()=>new Response('{broken',{status:200,headers:{'Content-Type':'application/json'}})});
  assert.equal(response.status,502);
  assert.deepEqual(await response.json(),{error:'upstream_invalid_json'});
});

test('upstream redirects are never followed or exposed to the client',async()=>{
  const response=await handleFplGatewayRequest(request('/fpl/bootstrap-static/'),{},
    {fetchFn:async()=>new Response(null,{status:302,headers:{Location:'https://evil.example/collect'}})});
  assert.equal(response.status,502);
  assert.deepEqual(await response.json(),{error:'upstream_redirect'});
  assert.equal(response.headers.get('Location'),null);
});

test('upstream HTTP status is preserved with a generic response body',async()=>{
  const response=await handleFplGatewayRequest(request('/fpl/entry/999/'),{},
    {fetchFn:async()=>jsonResponse({detail:'Not found.'},404)});
  assert.equal(response.status,404);
  assert.deepEqual(await response.json(),{error:'upstream_unavailable'});
});

test('server-side requests without Origin remain read-only but receive no CORS grant',async()=>{
  const response=await handleFplGatewayRequest(request('/fpl/fixtures/',{origin:null}),{},
    {fetchFn:async()=>jsonResponse([])});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
});

test('upstream exceptions emit redacted diagnostics while clients receive a generic error',async()=>{
  const error=new TypeError('fetch failed for https://fantasy.premierleague.com/api/entry/123/?token=secret');
  error.cause={code:'NETWORK_123'};
  const diagnostic=safeErrorDiagnostic(error);
  assert.equal(diagnostic.name,'TypeError');
  assert.doesNotMatch(JSON.stringify(diagnostic),/123|secret|https?:\/\//);

  const logs=[];
  const response=await handleFplGatewayRequest(request('/fpl/bootstrap-static/'),{}, {
    fetchFn:async()=>{ throw error; },
    logger:{error:(label,details)=>logs.push({label,details})}
  });
  assert.equal(response.status,502);
  assert.deepEqual(await response.json(),{error:'upstream_unreachable'});
  assert.equal(logs.length,1);
  assert.equal(logs[0].label,'Official FPL upstream fetch failed');
  assert.doesNotMatch(JSON.stringify(logs),/123|secret|https?:\/\//);
});
