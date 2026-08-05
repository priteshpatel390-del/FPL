// Official FPL gateway integration and bounded retry behaviour.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  api, fetchVia, RELAYS, normaliseGatewayBase, gatewayRequestUrl
} from '../src/providers/transport.mjs';
import { S } from '../src/state.mjs';

const GATEWAY = 'https://gateway.example/fpl';
const originalFetch = globalThis.fetch;

function stubFetch(handler){
  const seen=[];
  globalThis.fetch=async (url,options={})=>{
    seen.push({url:String(url),options});
    return handler(String(url),seen.length,options);
  };
  return seen;
}
const jsonRes=(body,status=200)=>({ok:status>=200&&status<300,status,
  json:async()=>body,text:async()=>JSON.stringify(body)});
const statusRes=status=>({ok:false,status,json:async()=>({}),text:async()=>''});
const badJsonRes=()=>({ok:true,status:200,json:async()=>{throw new SyntaxError('bad json');},text:async()=>'<html>'});
const statOf=(provider,endpoint)=>S.retryStats[provider+'|'+endpoint];

test.beforeEach(()=>{S.retryStats={};delete globalThis.__TEAMSHEET_FPL_GATEWAY_BASE__;});
test.after(()=>{globalThis.fetch=originalFetch;});

test('gateway base accepts exact HTTPS /fpl roots and rejects unsafe values',()=>{
  assert.equal(normaliseGatewayBase('https://gateway.example/fpl/'),GATEWAY);
  assert.equal(normaliseGatewayBase('https://user@gateway.example/fpl'),null);
  assert.equal(normaliseGatewayBase('https://gateway.example/fpl?q=1'),null);
  assert.equal(normaliseGatewayBase('https://gateway.example/proxy'),null);
  assert.equal(gatewayRequestUrl('/bootstrap-static/',GATEWAY),GATEWAY+'/bootstrap-static/');
  assert.equal(gatewayRequestUrl('https://evil.example/',GATEWAY),null);
});

test('healthy Official FPL request uses only the configured Teamsheet gateway',async()=>{
  const seen=stubFetch(()=>jsonRes({events:[],teams:[]}));
  const data=await api('/bootstrap-static/',{gatewayBase:GATEWAY});
  assert.deepEqual(data,{events:[],teams:[]});
  assert.equal(seen.length,1);
  assert.equal(seen[0].url,GATEWAY+'/bootstrap-static/');
  assert.equal(seen[0].options.credentials,'omit');
  assert.equal(S.source,'Teamsheet gateway');
  assert.equal(statOf('fpl','/bootstrap-static/').attempts,1);
  assert.ok(!seen[0].url.includes('allorigins')&&!seen[0].url.includes('corsproxy'));
});

test('transient gateway failure is retried and can recover',async()=>{
  const seen=stubFetch((_url,n)=>n===1?statusRes(503):jsonRes({recovered:true}));
  const data=await api('/fixtures/',{gatewayBase:GATEWAY});
  assert.deepEqual(data,{recovered:true});
  assert.equal(seen.length,2);
  assert.equal(statOf('fpl','/fixtures/').attempts,2);
});

test('exhausted core gateway retries remain bounded at three attempts',async()=>{
  const seen=stubFetch(()=>statusRes(503));
  await assert.rejects(()=>api('/bootstrap-static/',{gatewayBase:GATEWAY}),/feed unreachable/);
  assert.equal(seen.length,3);
  const record=statOf('fpl','/bootstrap-static/');
  assert.equal(record.attempts,3);
  assert.equal(record.exhausted,true);
  assert.equal(record.finalStatus,503);
});

test('network failure is transient while malformed JSON is permanent',async()=>{
  let seen=stubFetch(()=>{throw new TypeError('Failed to fetch');});
  await assert.rejects(()=>api('/bootstrap-static/',{gatewayBase:GATEWAY}));
  assert.equal(seen.length,3);
  S.retryStats={};
  seen=stubFetch(()=>badJsonRes());
  await assert.rejects(()=>api('/bootstrap-static/',{gatewayBase:GATEWAY}));
  assert.equal(seen.length,1);
  assert.equal(statOf('fpl','/bootstrap-static/').finalStatus,'parse');
});

test('unconfigured gateway fails closed without contacting Official FPL or a relay',async()=>{
  const seen=stubFetch(()=>{throw new Error('must not fetch');});
  await assert.rejects(()=>api('/bootstrap-static/'),/feed unreachable/);
  assert.equal(seen.length,0);
  assert.equal(statOf('fpl','/bootstrap-static/').finalStatus,'gateway-unconfigured');
});

test('optional 404 is an answer and optional transient retries are capped at two',async()=>{
  let seen=stubFetch(()=>statusRes(404));
  assert.equal(await api('/entry/123/',{optional:true,gatewayBase:GATEWAY}),null);
  assert.equal(seen.length,1);
  S.retryStats={};
  seen=stubFetch(()=>statusRes(502));
  assert.equal(await api('/entry/123/history/',{optional:true,gatewayBase:GATEWAY}),null);
  assert.equal(seen.length,2);
});

test('retry metadata remains identifier-normalised and contains no response payload',async()=>{
  stubFetch(()=>jsonRes({picks:[],secret:'do-not-log-me'}));
  await api('/entry/111/event/5/picks/',{optional:true,gatewayBase:GATEWAY});
  assert.deepEqual(Object.keys(S.retryStats),['fpl|/entry/{id}/event/{id}/picks/']);
  assert.equal(JSON.stringify(S.retryStats).includes('do-not-log-me'),false);
});

test('optional Understat transport retains the separate bounded relay cascade',async()=>{
  const seen=stubFetch((_url,n)=>n<=RELAYS.length?statusRes(500):({ok:true,status:200,text:async()=> 'teamsData = ...'}));
  const html=await fetchVia('https://understat.com/league/EPL',{asText:true});
  assert.equal(html,'teamsData = ...');
  assert.equal(seen.length,RELAYS.length+1);
  assert.equal(statOf('understat','https://understat.com/league/EPL').attempts,2);
});
