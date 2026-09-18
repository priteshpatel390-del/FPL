import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  API_FOOTBALL_ATTEMPT_RETENTION_DAYS,API_FOOTBALL_AUTHORITY_MAX_AGE_MS,API_FOOTBALL_DAILY_REQUEST_LIMIT,
  API_FOOTBALL_LEASE_MS,API_FOOTBALL_MAX_RESPONSE_BYTES,API_FOOTBALL_MAX_ROWS,API_FOOTBALL_SCHEDULE,
  classifyCompletion,effectiveRequestGapMs,normalizeQuotaTelemetry,readBoundedJson,requestAttemptIdentity,reservationDecision,utcDay,validateAuthority,validateCollectorRequest,validateRuntimeConfiguration
} from '../workers/api-football-collector/runtime-contracts.mjs';
import {discoveryOpportunity,dueOpportunities,fixtureOpportunities} from '../workers/api-football-collector/scheduler.mjs';
import {executeReservedRequest,sanitizedEvent} from '../workers/api-football-collector/collector.mjs';
import {reserveAttempt} from '../workers/api-football-collector/d1-persistence.mjs';

const root=path.resolve(import.meta.dirname,'..');
const authority=(fetchedAt='2026-09-16T00:00:00.000Z')=>({season:'2026-27',sourceKey:'official-fpl',sourceRevisionId:'official-fpl-r1',runStatus:'completed',fetchedAt,digest:'a'.repeat(64),teamIds:Array.from({length:20},(_,i)=>`2026-27:fpl:team:${i+1}`)});
const state=overrides=>({provider:'api-football',collection_enabled:1,credential_state:'AVAILABLE',quota_state:'KNOWN',quota_utc_day:'2026-09-16',daily_attempt_count:0,in_flight_attempt_id:null,in_flight_lease_expires_at:null,earliest_next_request_at:null,...overrides});

test('runtime constants pin operational ceiling, lease, freshness, retention and qualified response limit',()=>{
  assert.equal(API_FOOTBALL_DAILY_REQUEST_LIMIT,100);assert.equal(API_FOOTBALL_LEASE_MS,30_000);
  assert.equal(API_FOOTBALL_AUTHORITY_MAX_AGE_MS,48*60*60*1000);assert.equal(API_FOOTBALL_ATTEMPT_RETENTION_DAYS,35);
  assert.equal(API_FOOTBALL_MAX_ROWS,2000);assert.equal(API_FOOTBALL_MAX_RESPONSE_BYTES,720_896);assert.equal(API_FOOTBALL_SCHEDULE,'15 * * * *');
});
test('UTC accounting resets only on UTC date',()=>{assert.equal(utcDay('2026-09-16T23:59:59Z'),'2026-09-16');assert.equal(utcDay('2026-09-17T00:00:00Z'),'2026-09-17');});
test('kill switch and missing D1 fail before egress',async()=>{
  assert.equal(reservationDecision(state({collection_enabled:0}),{now:'2026-09-16T01:00:00Z',authority:authority()}).reason,'collection_disabled');
  let calls=0;const result=await executeReservedRequest({env:{API_FOOTBALL_API_KEY:'synthetic'},request:{logicalRequestId:'known:1',attemptId:'known:1:attempt:1',attemptNumber:1,operationClass:'FINALITY',endpoint:'fixtures',endpointClass:'fixture',search:{id:1}},fetchImpl:async()=>{calls++;}});
  assert.equal(result.reason,'storage_unavailable');assert.equal(calls,0);
});
test('invalid endpoint and query fail before storage or quota',async()=>{
  let prepared=0,calls=0;const db={prepare(){prepared++;throw new Error('must not read');}};
  const result=await executeReservedRequest({env:{TEAMSHEET_DATA_DB:db,API_FOOTBALL_API_KEY:'synthetic'},request:{endpoint:'https://evil.test',search:{id:1}},fetchImpl:async()=>{calls++;}});
  assert.equal(result.reason,'request_contract_invalid');assert.equal(prepared,0);assert.equal(calls,0);
});
test('request contract allows only exact discovery and known-ID query shapes',()=>{
  const base={logicalRequestId:'request:1',attemptNumber:1,operationClass:'DISCOVERY'};base.attemptId=requestAttemptIdentity(base.logicalRequestId,1);
  const valid=[['fixtures','fixtures_discovery',{league:2,season:2026}],['fixtures','fixture',{id:10}],['fixtures/lineups','lineups',{fixture:10}],['fixtures/players','players',{fixture:10}],['fixtures/events','events',{fixture:10}]];
  for(const [endpoint,endpointClass,search] of valid)assert.equal(validateCollectorRequest({...base,endpoint,endpointClass,search}).ok,true,`${endpoint}:${endpointClass}`);
  for(const [endpoint,endpointClass,search] of valid)assert.equal(validateCollectorRequest({...base,endpoint,endpointClass:endpointClass==='fixture'?'events':'fixture',search}).reason,'endpoint_class_mismatch',`${endpoint}:${endpointClass}`);
  assert.equal(validateCollectorRequest({...base,endpoint:'fixtures',endpointClass:'fixtures_discovery',search:{league:1,season:2026}}).reason,'parameters_invalid');
  assert.equal(validateCollectorRequest({...base,endpoint:'fixtures',endpointClass:'fixtures_discovery',search:{league:2,season:2026,timezone:'UTC'}}).reason,'parameters_invalid');
  assert.equal(validateCollectorRequest({...base,endpoint:'fixtures/players',endpointClass:'players',search:{team:10}}).reason,'parameters_invalid');
});
test('qualified response byte limit satisfies runtime configuration while storage and credential gates remain',()=>{
  assert.equal(validateRuntimeConfiguration({TEAMSHEET_DATA_DB:{},API_FOOTBALL_API_KEY:'synthetic'}).ok,true);
  assert.equal(validateRuntimeConfiguration({API_FOOTBALL_API_KEY:'synthetic'}).reason,'storage_unavailable');
  assert.equal(validateRuntimeConfiguration({TEAMSHEET_DATA_DB:{}}).reason,'credential_unavailable');
});
test('100-attempt ceiling blocks attempt 101 and new UTC day permits one probe',()=>{
  assert.equal(reservationDecision(state({daily_attempt_count:100}),{now:'2026-09-16T01:00:00Z',authority:authority()}).reason,'daily_ceiling_reached');
  const next=reservationDecision(state({daily_attempt_count:100}),{now:'2026-09-17T00:00:00Z',authority:authority('2026-09-16T00:00:00Z')});
  assert.equal(next.ok,true);assert.equal(next.nextCount,1);assert.equal(next.probeRequired,true);
});
test('active lease serializes provider egress and stale lease recovers',()=>{
  assert.equal(reservationDecision(state({in_flight_attempt_id:'a',in_flight_lease_expires_at:'2026-09-16T01:00:20Z'}),{now:'2026-09-16T01:00:00Z',authority:authority()}).reason,'request_lease_busy');
  assert.equal(reservationDecision(state({in_flight_attempt_id:'a',in_flight_lease_expires_at:'2026-09-16T00:59:59Z'}),{now:'2026-09-16T01:00:00Z',authority:authority()}).ok,true);
});
class AtomicDb{
  constructor({insertFails=false,attempts=[]}={}){this.shared=state({});this.attempts=new Map(attempts.map(id=>[id,{attemptId:id,outcome:'RESERVED'}]));this.insertFails=insertFails;this.lock=Promise.resolve();}
  prepare(sql){const statement={sql,args:[],bind(...args){this.args=args;return this;},first:async()=>({...this.shared})};statement.first=statement.first.bind(this);return statement;}
  async batch(statements){let release;const previous=this.lock;this.lock=new Promise(resolve=>{release=resolve;});await previous;const snapshot={shared:{...this.shared},attempts:new Map(this.attempts)};
    try{await new Promise(resolve=>setTimeout(resolve,1));const first=statements[0];
      if(first.sql.startsWith('UPDATE api_football_runtime_state SET quota_utc_day=')){
        const now=first.args.at(-2);if(this.shared.in_flight_attempt_id&&Date.parse(this.shared.in_flight_lease_expires_at)>Date.parse(now))return [{meta:{changes:0}},{meta:{changes:0}}];
        this.shared={...this.shared,quota_utc_day:first.args[0],daily_attempt_count:first.args[1],quota_state:first.args[2],in_flight_attempt_id:first.args[8],in_flight_lease_expires_at:first.args[9]};
        const insert=statements[1],attemptId=insert.args[0];if(this.insertFails||this.attempts.has(attemptId))throw new Error('attempt insert failed');
        this.attempts.set(attemptId,{attemptId,outcome:'RESERVED'});return [{meta:{changes:1}},{meta:{changes:1}}];
      }
      const attemptId=first.args.at(-1),attempt=this.attempts.get(attemptId);if(attempt){attempt.outcome=first.args[1];attempt.completedAt=first.args[0];}
      const runtime=statements[1],outcome=runtime.args[0];this.shared.in_flight_attempt_id=null;this.shared.in_flight_lease_expires_at=null;this.shared.quota_state=runtime.args[3];
      if(outcome==='AUTH_FAILURE'){this.shared.collection_enabled=0;this.shared.disable_reason='PROVIDER_AUTHENTICATION_FAILED';this.shared.credential_state='INVALID';}
      return [{meta:{changes:attempt?1:0}},{meta:{changes:1}}];
    }catch(error){this.shared=snapshot.shared;this.attempts=snapshot.attempts;throw error;}finally{release();}
  }
}
const reservationInput=(id='logical')=>({now:'2026-09-16T01:00:00Z',requiresAuthority:false,attemptId:`${id}:attempt:1`,logicalRequestId:id,attemptNumber:1,operationClass:'DISCOVERY',endpointClass:'fixtures_discovery'});
async function reservationRace(size){const db=new AtomicDb();const results=await Promise.all(Array.from({length:size},(_,i)=>reserveAttempt(db,reservationInput(`l${i}`))));return {db,results};}
test('attempt-row failure atomically rolls back count and lease before egress',async()=>{const db=new AtomicDb({insertFails:true});let calls=0;const result=await reserveAttempt(db,reservationInput());if(result.ok)calls++;assert.equal(result.reason,'attempt_reservation_failed');assert.equal(db.shared.daily_attempt_count,0);assert.equal(db.shared.in_flight_attempt_id,null);assert.equal(db.attempts.size,0);assert.equal(calls,0);});
test('duplicate attempt identity cannot consume count or strand lease',async()=>{const id='logical:attempt:1',db=new AtomicDb({attempts:[id]});const result=await reserveAttempt(db,reservationInput());assert.equal(result.reason,'attempt_reservation_failed');assert.equal(db.shared.daily_attempt_count,0);assert.equal(db.shared.in_flight_attempt_id,null);assert.equal(db.attempts.size,1);});
test('successful durable reservation remains consumed after simulated crash',async()=>{const db=new AtomicDb();assert.equal((await reserveAttempt(db,reservationInput())).ok,true);assert.equal(db.shared.daily_attempt_count,1);assert.equal(db.shared.in_flight_attempt_id,'logical:attempt:1');assert.equal(db.attempts.size,1);});
test('two concurrent promises produce one global lease winner',async()=>{const {db,results}=await reservationRace(2);assert.equal(results.filter(row=>row.ok).length,1);assert.equal(db.attempts.size,1);assert.equal(db.shared.daily_attempt_count,1);});
test('five concurrent promises still produce one global lease winner',async()=>{const {db,results}=await reservationRace(5);assert.equal(results.filter(row=>row.ok).length,1);assert.equal(db.attempts.size,1);assert.equal(db.shared.daily_attempt_count,1);});
test('quota uncertain and 429 block later attempts until next UTC day',()=>{
  for(const quota_state of ['QUOTA_UNCERTAIN','BLOCKED_429'])assert.equal(reservationDecision(state({quota_state}),{now:'2026-09-16T01:00:00Z',authority:authority()}).ok,false);
  assert.equal(reservationDecision(state({quota_state:'BLOCKED_429'}),{now:'2026-09-17T00:00:00Z',authority:authority()}).ok,true);
});
test('quota headers normalize known telemetry but never imply entitlement',()=>{
  const headers=new Headers({'x-ratelimit-requests-limit':'7500','x-ratelimit-requests-remaining':'7499','x-ratelimit-limit':'300','x-ratelimit-remaining':'299'});
  assert.deepEqual({...normalizeQuotaTelemetry(headers),headerNames:undefined},{ok:true,dailyLimit:7500,dailyRemaining:7499,minuteLimit:300,minuteRemaining:299,headerNames:undefined});
  assert.equal(normalizeQuotaTelemetry(new Headers()).reason,'quota_headers_uncertain');
  assert.equal(normalizeQuotaTelemetry(new Headers({'x-ratelimit-limit':'bad'})).reason,'quota_headers_uncertain');
});
test('minute telemetry can only slow existing one-second spacing',()=>{assert.equal(effectiveRequestGapMs(300),1000);assert.equal(effectiveRequestGapMs(30),2000);assert.equal(effectiveRequestGapMs(null),1000);});
test('timeout and transport-unknown remain consumed completion outcomes',()=>{
  assert.equal(classifyCompletion({timedOut:true,now:'2026-09-16T00:00:00Z'}).outcome,'TIMEOUT');
  assert.equal(classifyCompletion({transportUnknown:true,now:'2026-09-16T00:00:00Z'}).outcome,'TRANSPORT_UNKNOWN');
});
test('429 is non-inferential durable block',()=>{const row=classifyCompletion({status:429,headers:new Headers(),now:'2026-09-16T00:00:00Z'});assert.equal(row.quotaState,'BLOCKED_429');assert.equal(row.outcome,'QUOTA_BLOCKED');assert.equal('window' in row,false);});
for(const status of [401,403])test(`${status} persists authentication block regardless of valid quota telemetry`,async()=>{const db=new AtomicDb(),request={...reservationInput(`auth-${status}`),operationClass:'FINALITY',endpoint:'fixtures',endpointClass:'fixture',search:{id:10}};let calls=0,bodyReads=0;const response={status,ok:false,headers:new Headers({'x-ratelimit-requests-limit':'7500','x-ratelimit-requests-remaining':'7499'}),get body(){bodyReads++;return null;}};const options={env:{TEAMSHEET_DATA_DB:db,API_FOOTBALL_API_KEY:'synthetic-secret'},request,fetchImpl:async()=>{calls++;return response;},now:()=>status===401?'2026-09-16T01:00:00Z':'2026-09-16T02:00:00Z',maxResponseBytes:100,timeoutSignal:()=>new AbortController().signal};const result=await executeReservedRequest(options);assert.equal(result.reason,'provider_authentication_failed');assert.equal(calls,1);assert.equal(bodyReads,0);assert.equal(db.shared.collection_enabled,0);assert.equal(db.shared.credential_state,'INVALID');assert.equal(db.shared.quota_state,'AUTH_BLOCKED');assert.equal(db.shared.daily_attempt_count,1);assert.equal([...db.attempts.values()][0].outcome,'AUTH_FAILURE');const blocked=await executeReservedRequest(options);assert.equal(blocked.reason,'collection_disabled');assert.equal(calls,1);assert.doesNotMatch(JSON.stringify({result,shared:db.shared,attempts:[...db.attempts.values()]}),/synthetic-secret|response body/i);});
test('missing quota headers after success enter quota uncertain',()=>{assert.equal(classifyCompletion({status:200,headers:new Headers(),now:'2026-09-16T00:00:00Z'}).quotaState,'QUOTA_UNCERTAIN');});
test('authority requires successful DATA-S2A identity, exact 20-team bijection and freshness',()=>{
  assert.equal(validateAuthority(authority(),{now:'2026-09-17T23:59:59Z'}).ok,true);
  assert.equal(validateAuthority({...authority(),teamIds:authority().teamIds.slice(1)},{now:'2026-09-16T01:00:00Z'}).reason,'official_fpl_authority_conflicted');
  assert.equal(validateAuthority(authority(),{now:'2026-09-18T00:00:01Z'}).reason,'official_fpl_authority_stale');
  assert.equal(validateAuthority({...authority(),runStatus:'failed'},{now:'2026-09-16T01:00:00Z'}).reason,'official_fpl_authority_invalid');
});
test('bounded reader rejects declared and streamed oversize payloads',async()=>{
  let result=await readBoundedJson(new Response('{}',{headers:{'content-length':'3'}}),{maxBytes:2});assert.equal(result.reason,'provider_response_too_large');
  result=await readBoundedJson(new Response(JSON.stringify({response:[{x:'12345'}]})),{maxBytes:10});assert.equal(result.reason,'provider_response_too_large');
});
test('bounded reader rejects row amplification and admits bounded JSON',async()=>{
  let result=await readBoundedJson(new Response(JSON.stringify({response:[1,2]})),{maxBytes:100,maxRows:1});assert.equal(result.reason,'provider_row_limit_exceeded');
  result=await readBoundedJson(new Response(JSON.stringify({response:[]})),{maxBytes:100,maxRows:1});assert.equal(result.ok,true);
});
test('planner creates one daily discovery identity',()=>{assert.equal(discoveryOpportunity('2026-09-16T15:15:00Z').logicalId,discoveryOpportunity('2026-09-16T23:15:00Z').logicalId);});
test('fixture planner bounds pre-match, finality, enrichment and corrections',()=>{
  const base={providerFixtureId:10,kickoff:'2026-09-20T12:00:00Z',status:'FT',finalityChecks:2};
  assert.equal(fixtureOpportunities(base).filter(row=>row.kind==='FINALITY').length,3);
  assert.equal(fixtureOpportunities(base).filter(row=>row.kind==='CORRECTION').length,1);
  assert.equal(fixtureOpportunities({...base,conflicted:true}).filter(row=>row.kind==='CORRECTION').length,2);
  assert.equal(fixtureOpportunities({...base,status:'PST'}).length,2);
});
test('duplicate logical scheduler opportunities are filtered before work',()=>{const row=discoveryOpportunity('2026-09-16T15:15:00Z');assert.equal(dueOpportunities([row],{now:'2026-09-16T16:00:00Z',claimedLogicalIds:[row.logicalId]}).length,0);});
test('sanitized observability drops credentials, URLs, names, raw errors and D1 identifiers',()=>{assert.deepEqual(sanitizedEvent({operationClass:'DISCOVERY',failureReason:'quota_uncertain',apiKey:'secret',url:'https://x?q=y',name:'player',stack:'raw',generationId:'private'}),{operationClass:'DISCOVERY',failureReason:'quota_uncertain'});});
test('worker is scheduled-only with dormant configuration and no public route',()=>{
  const source=fs.readFileSync(path.join(root,'workers/api-football-collector/collector.mjs'),'utf8');
  const config=fs.readFileSync(path.join(root,'workers/api-football-collector/wrangler.jsonc'),'utf8');
  assert.doesNotMatch(source,/export default\s*\{[^}]*fetch/);assert.match(source,/export default \{scheduled\}/);
  assert.match(config,/"workers_dev": false/);assert.match(config,/"preview_urls": false/);assert.match(config,/"crons": \[\]/);assert.doesNotMatch(config,/routes?|custom_domains?/i);
});
test('credential appears only as future Worker secret name and never as a value',()=>{
  const files=['workers/api-football-collector/collector.mjs','workers/api-football-collector/wrangler.jsonc','workers/api-football-collector/runtime-contracts.mjs'].map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
  assert.match(files,/API_FOOTBALL_API_KEY/);assert.doesNotMatch(files,/x-apisports-key['"]?\s*:\s*['"][^'"]+/);assert.doesNotMatch(files,/api[_-]?key=/i);
});
test('migration contains no raw payload warehouse, credential, URL, logo, image, venue or referee fields',()=>{const sql=fs.readFileSync(path.join(root,'workers/data-platform/migrations/0005_api_football_shadow_runtime.sql'),'utf8');const schema=sql.replace(/raw_payload_retention_allowed/g,'rights_retention_guard');assert.doesNotMatch(schema,/raw_payload|api_key|request_url|logo|image|venue|referee/i);});
test('production/browser/model graph does not import collector or API-Football persistence',()=>{
  const production=[...fs.readdirSync(path.join(root,'src')).filter(name=>name.endsWith('.js')).map(name=>path.join(root,'src',name)),path.join(root,'build.mjs')];
  for(const file of production)assert.doesNotMatch(fs.readFileSync(file,'utf8'),/api-football-collector|api_football_(?:runtime|request|discovery|fixture|generation)/,file);
  for(const file of [path.join(root,'index.html'),path.join(root,'dist/index.html'),path.join(root,'dist/app.bundle.js')])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/API_FOOTBALL_API_KEY|api_football_request_attempts/,file);
});
test('manual/backfill remains inside same closed operation and reservation contract',()=>{const source=fs.readFileSync(path.join(root,'workers/api-football-collector/runtime-contracts.mjs'),'utf8');assert.match(source,/MANUAL_BACKFILL/);assert.equal((fs.readFileSync(path.join(root,'workers/api-football-collector/collector.mjs'),'utf8').match(/reserveAttempt\(/g)||[]).length,1);});