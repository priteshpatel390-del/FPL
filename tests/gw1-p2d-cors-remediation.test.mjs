import test from 'node:test';
import assert from 'node:assert/strict';
import { credentialledCorsResponse } from '../workers/evidence-archive.mjs';

const APPROVED='https://priteshpatel390-del.github.io';
function request(origin=APPROVED){
  return new Request('https://teamsheet-evidence-archive.fpltsheet.workers.dev/v1/evidence/predeadline',{
    method:'OPTIONS',headers:origin?{Origin:origin}:{}
  });
}
function response(origin=APPROVED,status=204){
  const headers=new Headers();
  if(origin) headers.set('Access-Control-Allow-Origin',origin);
  return new Response(null,{status,headers});
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
