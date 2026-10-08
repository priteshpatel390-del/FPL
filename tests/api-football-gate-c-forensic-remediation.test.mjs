// Gate C forensic remediation: R2 (planner generation isolation) and R1 (closed, sanitized schema-failure diagnostics).
// Fully offline: in-memory SQLite over the real migrations, synthetic Response objects, no network, no credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createD1CollectorRepository} from '../workers/api-football-collector/d1-persistence.mjs';
import {executeProviderTransport} from '../workers/api-football-collector/collector.mjs';
import {runOneShotDiscoveryGeneration} from '../workers/api-football-collector/activation-orchestrator.mjs';
import {readPlannerFixtures,requestPlanForOpportunity} from '../workers/api-football-collector/planner-orchestrator.mjs';
import {discoveryOpportunity} from '../workers/api-football-collector/scheduler.mjs';
import {API_FOOTBALL_SCHEMA_SUBREASONS,bodyBytesBucket,composeSchemaFailureClass,contentTypeClass,httpStatusClass,quotaHeaderState,readBoundedJson} from '../workers/api-football-collector/runtime-contracts.mjs';
import {validateDiscoveryPayload,validateProviderPayload} from '../workers/api-football-collector/semantic-validation.mjs';

const root=path.resolve(import.meta.dirname,'..');
const NOW='2026-10-08T12:27:47.915Z';
const day=n=>`2026-10-0${n}T12:00:00.000Z`;
const providerIds=Array.from({length:20},(_,index)=>String(500+index));
const mappings=providerIds.map((providerEntityId,index)=>({provider:'api-football',entityType:'team',providerEntityId,canonicalFplId:`2026-27:fpl:team:${index+1}`,mappingRevision:'qualified',revision:1,status:'VERIFIED',season:'2026-27',method:'manually_verified',provenance:'synthetic-owner-qualified'}));
const goodHeaders={'x-ratelimit-requests-limit':'7500','x-ratelimit-requests-remaining':'7499','x-ratelimit-limit':'300','x-ratelimit-remaining':'299'};

function openDatabase(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON;');
  const dir=path.join(root,'workers/data-platform/migrations');
  for(const name of fs.readdirSync(dir).filter(file=>/^000[1-5]_/.test(file)).sort())sqlite.exec(fs.readFileSync(path.join(dir,name),'utf8'));
  const statement=sql=>({args:[],bind(...args){this.args=args;return this;},
    async first(){return sqlite.prepare(sql).get(...this.args)??null;},
    async all(){return {results:sqlite.prepare(sql).all(...this.args)};},
    exec(){const result=sqlite.prepare(sql).run(...this.args);return {success:true,meta:{changes:Number(result.changes)}};},
    async run(){return this.exec();}});
  const db={prepare:statement,async batch(list){sqlite.exec('BEGIN');try{const out=list.map(item=>item.exec());sqlite.exec('COMMIT');return out;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
  return {sqlite,db};
}
const authority={season:'2026-27',sourceKey:'official-fpl',sourceRevisionId:'official-fpl-r1',runId:'official-run',runStatus:'completed',fetchedAt:'2026-10-08T01:00:00.000Z',digest:'a'.repeat(64),teamIds:Array.from({length:20},(_,index)=>`2026-27:fpl:team:${index+1}`)};
function seedAuthorityAndRuntime(sqlite){
  sqlite.exec(`INSERT INTO ingestion_runs(run_id,source_revision_id,run_type,mode,started_at,status,parser_version,transform_version,schema_version,created_at) VALUES('official-run','official-fpl-r1','x','shadow_only','2026-10-08T01:00:00Z','completed','p','t','s','2026-10-08T01:00:00Z')`);
  sqlite.exec(`UPDATE api_football_runtime_state SET collection_enabled=1,credential_state='AVAILABLE',quota_state='UNOBSERVED',disable_reason=NULL`);
}

// ---------------------------------------------------------------- R2: planner generation isolation
function faRequests(opportunityId){
  return requestPlanForOpportunity(discoveryOpportunity(NOW)).requests.map(request=>({...request,opportunityLogicalId:opportunityId}));
}
function faFixtures(at,rows){
  const requests=faRequests('shape');const fa=requests.find(request=>request.search.league==='45');
  const response=rows.map(row=>({fixture:{id:4_500_000+row.i,date:'2026-11-01T15:00:00+00:00',status:{short:row.status||'NS'}},league:{id:45,season:2026},teams:{home:{id:500+(row.i%10)},away:{id:510+(row.i%10)}}}));
  const payload={get:'fixtures',parameters:{league:'45',season:'2026'},errors:[],results:response.length,paging:{current:1,total:1},response};
  const validated=validateDiscoveryPayload(payload,fa,{fetchedAt:at,teamMappings:mappings});assert.equal(validated.ok,true);
  return validated.fixtures;
}
async function stageGeneration(db,sqlite,n,tag,rows,{commit}){
  const requests=faRequests(`ISO:${n}:${tag}`);
  const repository=createD1CollectorRepository(db,{authority});
  const staged=await repository.createStaging({requests,now:day(n)});assert.equal(staged.ok,true);
  const persisted=await repository.persistValidated(requests[3],staged.generationId,faFixtures(day(n),rows),day(n));assert.equal(persisted.ok,true);
  if(commit){
    requests.forEach((request,index)=>sqlite.prepare("INSERT INTO api_football_request_attempts(attempt_id,logical_request_id,attempt_number,operation_class,endpoint_class,generation_id,ingestion_run_id,source_revision_id,quota_utc_day,reserved_at,lease_expires_at,outcome) VALUES(?,?,1,'DISCOVERY','fixtures_discovery',?,?,?,?,?,?,'SUCCEEDED')").run(`${request.attemptId}:${tag}`,`${request.logicalRequestId}:${tag}`,staged.generationId,staged.ingestionRunId,'api-football:eia-2i5a:1',day(n).slice(0,10),day(n),day(n)));
    const committed=await repository.commitGeneration(staged.generationId,{fixtureCount:rows.length,now:day(n)});assert.equal(committed.ok,true);
  }else{
    const failed=await repository.failGeneration(staged.generationId,'provider_schema_invalid',day(n));assert.equal(failed.ok,true);
  }
  return staged.generationId;
}
const plannerView=async db=>Object.fromEntries((await readPlannerFixtures(db)).fixtures.map(fixture=>[fixture.providerFixtureId.slice(-1),`${fixture.status}${fixture.changed?'*':''}`]));

test('R2: planner reads exactly the head generation membership revisions, never a newer failed generation',async()=>{
  const {sqlite,db}=openDatabase();seedAuthorityAndRuntime(sqlite);
  await stageGeneration(db,sqlite,1,'A',[{i:1},{i:2},{i:3}],{commit:true});
  assert.deepEqual(await plannerView(db),{1:'NS',2:'NS',3:'NS'});
  // A newer FAILED generation changes fixture 1 and adds fixture 4; the head still points at A.
  await stageGeneration(db,sqlite,2,'B',[{i:1,status:'PST'},{i:2},{i:3},{i:4}],{commit:false});
  assert.equal(sqlite.prepare('SELECT COUNT(*) c FROM api_football_fixture_revisions').get().c>3,true,'failed generation really staged a changed revision');
  assert.deepEqual(await plannerView(db),{1:'NS',2:'NS',3:'NS'},'failed-generation revision must not leak into the committed view');
});

test('R2: a later committed generation with unchanged content keeps its own membership revision',async()=>{
  const {sqlite,db}=openDatabase();seedAuthorityAndRuntime(sqlite);
  await stageGeneration(db,sqlite,1,'A',[{i:1},{i:2},{i:3}],{commit:true});
  await stageGeneration(db,sqlite,2,'B',[{i:1,status:'PST'},{i:2},{i:3}],{commit:false});
  const committed=await stageGeneration(db,sqlite,3,'C',[{i:1},{i:2},{i:3}],{commit:true});
  assert.equal(sqlite.prepare('SELECT generation_id FROM api_football_discovery_heads').get().generation_id,committed);
  assert.equal(sqlite.prepare('SELECT COUNT(*) c FROM api_football_fixture_revisions WHERE generation_id=?').get(committed).c,0,'identical content reuses existing revisions');
  assert.deepEqual(await plannerView(db),{1:'NS',2:'NS',3:'NS'});
});

test('R2: a committed generation that really changed content is reported as changed from its own revision',async()=>{
  const {sqlite,db}=openDatabase();seedAuthorityAndRuntime(sqlite);
  await stageGeneration(db,sqlite,1,'A',[{i:1},{i:2}],{commit:true});
  await stageGeneration(db,sqlite,2,'B',[{i:1,status:'FT'},{i:2}],{commit:true});
  assert.deepEqual(await plannerView(db),{1:'FT*',2:'NS'});
});

test('R2: with no committed head the planner view is empty even when failed generations hold revisions',async()=>{
  const {sqlite,db}=openDatabase();seedAuthorityAndRuntime(sqlite);
  await stageGeneration(db,sqlite,1,'A',[{i:1},{i:2}],{commit:false});
  assert.equal(sqlite.prepare('SELECT COUNT(*) c FROM api_football_fixture_revisions').get().c,2);
  assert.deepEqual(await plannerView(db),{});
});

test('R2: planner SQL is membership-bound and no longer selects the newest revision across generations',()=>{
  const source=fs.readFileSync(path.join(root,'workers/api-football-collector/planner-orchestrator.mjs'),'utf8');
  const sql=source.slice(source.indexOf('export async function readPlannerFixtures'),source.indexOf('export async function readCompletedPlannerLogicalIds'));
  assert.match(sql,/r\.fixture_revision_id=gf\.fixture_revision_id/);
  assert.match(sql,/g\.state='COMMITTED'/);
  assert.doesNotMatch(sql,/ORDER BY rr\.fetched_at/);
  assert.doesNotMatch(sql,/SELECT rr\.fixture_revision_id/);
});

// ---------------------------------------------------------------- R1: closed schema-failure diagnostics
function faRequest(){return requestPlanForOpportunity(discoveryOpportunity(NOW)).requests.find(request=>request.search.league==='45');}
function body(over={},rows=3){
  const response=Array.from({length:rows},(_,index)=>({fixture:{id:4_500_000+index+1,date:'2026-11-01T15:00:00+00:00',status:{short:'NS'}},league:{id:45,season:2026},teams:{home:{id:500+index},away:{id:510+index}}}));
  return {get:'fixtures',parameters:{league:'45',season:'2026'},errors:[],results:rows,paging:{current:1,total:1},response,...over};
}
const validate=payload=>validateDiscoveryPayload(payload,faRequest(),{fetchedAt:NOW,teamMappings:mappings});

test('R1: every schema failure keeps reason provider_schema_invalid and names a closed sub-reason',()=>{
  const cases=[
    ['not an object',[],'payload_not_object'],['null payload',null,'payload_not_object'],
    ['get mismatch',body({get:'fixture'}),'get_mismatch'],
    ['parameters array',body({parameters:[]}),'parameters_shape'],
    ['errors array non-empty',body({errors:['x']}),'errors_nonempty_other'],
    ['errors rateLimit',body({errors:{rateLimit:'x'},results:0,response:[]}),'errors_nonempty_rate_limit'],
    ['errors requests',body({errors:{requests:'x'},results:0,response:[]}),'errors_nonempty_requests'],
    ['errors plan',body({errors:{plan:'x'},results:0,response:[]}),'errors_nonempty_plan'],
    ['errors token',body({errors:{token:'x'},results:0,response:[]}),'errors_nonempty_credential'],
    ['errors access',body({errors:{access:'x'},results:0,response:[]}),'errors_nonempty_access'],
    ['errors unknown key',body({errors:{whatever:'x'},results:0,response:[]}),'errors_nonempty_other'],
    ['errors null',body({errors:null}),'errors_shape'],['errors string',body({errors:'x'}),'errors_shape'],
    ['response not array',body({response:{}}),'response_not_array'],['response null',body({response:null}),'response_not_array'],
    ['results string',body({results:'3'}),'results_not_integer'],['results mismatch',body({results:2}),'results_count_mismatch'],
    ['extra top-level key',body({message:'x'}),'envelope_keys'],
    ['paging extra key',body({paging:{current:1,total:1,limit:20}}),'paging_shape']
  ];
  for(const [label,payload,expected] of cases){
    const result=validate(payload);
    assert.equal(result.ok,false,label);assert.equal(result.reason,'provider_schema_invalid',label);assert.equal(result.subReason,expected,label);
    assert.ok(API_FOOTBALL_SCHEMA_SUBREASONS.includes(result.subReason),label);
  }
});

test('R1: classes other than provider_schema_invalid are unchanged and carry no sub-reason',()=>{
  for(const [payload,reason] of [
    [body({paging:{current:1,total:2}}),'pagination_unsupported'],[(()=>{const p=body();delete p.paging;return p;})(),'pagination_unsupported'],
    [body({parameters:{league:'45',season:'2025'}}),'response_parameters_mismatch'],
    [body({},0),null]
  ]){const result=validate(payload);if(reason===null){assert.equal(result.ok,true);continue;}assert.equal(result.ok,false);assert.equal(result.reason,reason);assert.equal('subReason' in result,false);}
  const fixtureLevel=validate({...body(),response:[{fixture:{id:1,date:'2026-11-01T15:00:00+00:00',status:{short:'NS'}},league:{id:45,season:2026},teams:{home:{id:null},away:{id:511}}}],results:1});
  assert.equal(fixtureLevel.reason,'fixture_identity_invalid');assert.equal('subReason' in fixtureLevel,false);
  const known=validateProviderPayload(body({errors:{rateLimit:'x'}}),faRequest(),{fetchedAt:NOW,teamMappings:mappings});
  assert.equal(known.reason,'provider_schema_invalid');assert.equal(known.subReason,'errors_nonempty_rate_limit');
});

test('R1: body decoding names its sub-reason and records only the byte count',async()=>{
  const read=async (text,headers={})=>readBoundedJson(new Response(text,{headers}));
  for(const [text,expected] of [['','body_empty'],['<html>blocked</html>','body_not_json'],['{"get":"fixtures","response":[','body_not_json'],['null','payload_not_object'],['"ok"','payload_not_object'],['[]','payload_not_object'],['{"get":"fixtures"}','response_not_array'],['{"response":{}}','response_not_array']]){
    const result=await read(text);assert.equal(result.ok,false,text);assert.equal(result.reason,'provider_schema_invalid',text);assert.equal(result.subReason,expected,text);assert.equal(result.bodyBytes,new TextEncoder().encode(text).byteLength);
  }
  const ok=await read(JSON.stringify({response:[]}));assert.equal(ok.ok,true);assert.equal(ok.bodyBytes,15);
  assert.equal((await read(JSON.stringify({response:[1,2]}),{})).ok,true);
  assert.equal((await readBoundedJson(new Response(JSON.stringify({response:[1,2]})),{maxRows:1})).reason,'provider_row_limit_exceeded');
  assert.equal((await readBoundedJson(new Response('{}',{headers:{'content-length':'999'}}),{maxBytes:2})).reason,'provider_response_too_large');
});

test('R1: closed helper vocabularies bucket every input and never echo it',()=>{
  assert.deepEqual([200,204,301,404,503,99,undefined,'x'].map(httpStatusClass),['2xx','2xx','3xx','4xx','5xx','unknown','transport','transport']);
  const headers=value=>new Headers(value===null?{}:{'content-type':value});
  assert.deepEqual([null,'application/json; charset=utf-8','application/problem+json','text/html','text/plain','image/png'].map(value=>contentTypeClass(headers(value))),['absent','json','json','html','text','other']);
  assert.deepEqual([0,1,1023,1024,65535,65536,-1,1.5,null].map(bodyBytesBucket),['zero','lt_1k','lt_1k','lt_64k','lt_64k','ge_64k',null,null,null]);
  assert.equal(quotaHeaderState(new Headers()),'absent');
  assert.equal(quotaHeaderState(new Headers(goodHeaders)),'known');
  assert.equal(quotaHeaderState(new Headers({...goodHeaders,'x-ratelimit-limit':'abc'})),'invalid');
  assert.equal(quotaHeaderState(new Headers({...goodHeaders,'x-ratelimit-remaining':'999'})),'inconsistent');
  assert.equal(quotaHeaderState(new Headers({...goodHeaders,'x-ratelimit-requests-remaining':'9000'})),'inconsistent');
});

test('R1: composed failure class is closed, bounded to the 80-character column cap and ignores hostile input',()=>{
  const contentTypes=['json','html','text','other','absent'],buckets=['zero','lt_1k','lt_64k','ge_64k'],quotas=['known','absent','invalid','inconsistent'];
  let longest=0;
  for(const subReason of API_FOOTBALL_SCHEMA_SUBREASONS)for(const contentTypeClass of contentTypes)for(const bodyBytesBucket of buckets)for(const quotaHeaderState of quotas){
    const text=composeSchemaFailureClass('provider_schema_invalid',{subReason,contentTypeClass,bodyBytesBucket,quotaHeaderState});
    assert.match(text,/^provider_schema_invalid(:[a-z_]+)?(;ct=[a-z]+)?(;b=[a-z0-9]+)?(;q=[a-z]+)?$/);longest=Math.max(longest,text.length);
  }
  assert.ok(longest<=80,`longest composed class ${longest} must fit the 80-character cap`);
  assert.equal(composeSchemaFailureClass('provider_schema_invalid',undefined),'provider_schema_invalid');
  assert.equal(composeSchemaFailureClass('transport_failure',{subReason:'body_not_json'}),'transport_failure');
  assert.equal(composeSchemaFailureClass('pagination_unsupported',{subReason:'body_not_json'}),'pagination_unsupported');
  const hostile=composeSchemaFailureClass('provider_schema_invalid',{subReason:'<script>alert(1)</script>',contentTypeClass:'application/json; secret=abc',bodyBytesBucket:'999999',quotaHeaderState:'toString'});
  assert.equal(hostile,'provider_schema_invalid');
});

test('R1: sub-reason output never contains provider-controlled text',async()=>{
  const marker='ZZ-PROVIDER-MARKER-ZZ';
  const results=[validate(body({errors:{[marker]:marker},results:0,response:[]})),validate(body({errors:[marker]})),validate(body({message:marker})),validate(body({get:marker}))];
  for(const result of results)assert.equal(JSON.stringify(result).includes(marker),false);
  const transport=await executeProviderTransport({env:{API_FOOTBALL_API_KEY:'synthetic-only'},request:faRequest(),fetchImpl:async()=>new Response(JSON.stringify(body({errors:{[marker]:marker},results:0,response:[]})),{status:200,headers:{'content-type':`application/json; x=${marker}`}}),now:()=>NOW,timeoutSignal:()=>new AbortController().signal});
  assert.equal(transport.ok,true);
  assert.equal(JSON.stringify({diagnostic:transport.diagnostic,completion:transport.completion}).includes('PROVIDER-MARKER'),false,'diagnostics must not echo header or body text');
});

test('R1: http_class is populated for every transport outcome',async()=>{
  const run=async fetchImpl=>executeProviderTransport({env:{API_FOOTBALL_API_KEY:'synthetic-only'},request:faRequest(),fetchImpl,now:()=>NOW,timeoutSignal:()=>new AbortController().signal});
  const json=JSON.stringify(body());
  assert.equal((await run(async()=>new Response(json,{status:200,headers:goodHeaders}))).completion.httpClass,'2xx');
  assert.equal((await run(async()=>new Response('',{status:500}))).completion.httpClass,'5xx');
  assert.equal((await run(async()=>new Response('',{status:429}))).completion.httpClass,'4xx');
  assert.equal((await run(async()=>new Response('',{status:401}))).completion.httpClass,'4xx');
  assert.equal((await run(async()=>new Response('',{status:302,headers:{location:'https://evil.example/'}}))).completion.httpClass,'3xx');
  assert.equal('httpClass' in (await run(async()=>{throw new TypeError('boom');})).completion,false,'a thrown fetch has no HTTP response, so http_class stays null');
  const schema=await run(async()=>new Response('<html>x</html>',{status:200,headers:{'content-type':'text/html'}}));
  assert.equal(schema.reason,'provider_schema_invalid');assert.equal(schema.completion.outcome,'SCHEMA_FAILURE');assert.equal(schema.completion.httpClass,'2xx');
  assert.deepEqual({...schema.diagnostic},{subReason:'body_not_json',httpClass:'2xx',contentTypeClass:'html',bodyBytesBucket:'lt_1k',quotaHeaderState:'absent'});
  const stream=await run(async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"get"'));controller.error(new Error('reset'));}}),{status:200,headers:goodHeaders}));
  assert.equal(stream.reason,'provider_schema_invalid');assert.equal(stream.diagnostic.subReason,'body_read_exception');
});

async function runGate(fourth){
  const {sqlite,db}=openDatabase();seedAuthorityAndRuntime(sqlite);
  const requests=requestPlanForOpportunity(discoveryOpportunity(NOW)).requests.filter(request=>request.operationClass==='DISCOVERY');
  let tick=0,calls=0;const clock=()=>new Date(Date.parse(NOW)+(tick++)*1100).toISOString();
  const leagues=[2,3,848,45,48];
  const fetchImpl=async()=>{
    calls+=1;if(calls===4)return fourth();
    const league=leagues[calls-1],response=Array.from({length:calls*5},(_,index)=>({fixture:{id:league*100_000+index+1,date:'2026-11-01T15:00:00+00:00',status:{short:'NS'}},league:{id:league,season:2026},teams:{home:{id:500+(index%10)},away:{id:510+(index%10)}}}));
    return new Response(JSON.stringify({get:'fixtures',parameters:{league:String(league),season:'2026'},errors:[],results:response.length,paging:{current:1,total:1},response}),{status:200,headers:{'content-type':'application/json',...goodHeaders}});
  };
  const repository=createD1CollectorRepository(db,{authority});
  const result=await runOneShotDiscoveryGeneration({requests,repository,now:NOW,clock,sleep:async()=>{},
    transport:request=>executeProviderTransport({env:{API_FOOTBALL_API_KEY:'synthetic-only'},request,fetchImpl,now:clock,timeoutSignal:()=>new AbortController().signal}),
    validate:(payload,request,fetchedAt)=>validateProviderPayload(payload,request,{fetchedAt,teamMappings:mappings})});
  const generation=sqlite.prepare('SELECT state,failure_class,competition_count,fixture_count FROM api_football_discovery_generations').get();
  const run=sqlite.prepare("SELECT status,error_class FROM ingestion_runs WHERE run_type='fixture_discovery'").get();
  const attempts=sqlite.prepare('SELECT outcome,http_class,quota_state FROM api_football_request_attempts ORDER BY reserved_at').all().map(row=>({...row}));
  const runtime={...sqlite.prepare('SELECT quota_state,daily_attempt_count,in_flight_attempt_id FROM api_football_runtime_state').get()};
  return {result,calls,generation:{...generation},run:{...run},attempts,runtime,revisions:sqlite.prepare('SELECT COUNT(*) c FROM api_football_fixture_revisions').get().c,heads:sqlite.prepare('SELECT COUNT(*) c FROM api_football_discovery_heads').get().c};
}
const rateLimitBody=()=>JSON.stringify({...body({errors:{rateLimit:'Too many requests'},results:0,response:[]})});

test('R1: persisted failure class reproduces the Gate C signature and names the exact predicate (errors object, no quota headers)',async()=>{
  const run=await runGate(async()=>new Response(rateLimitBody(),{status:200,headers:{'content-type':'application/json'}}));
  assert.equal(run.result.reason,'provider_schema_invalid','returned reason is unchanged');
  assert.equal(run.calls,4,'no fifth request and no retry');
  assert.equal(run.generation.state,'FAILED');assert.equal(run.generation.failure_class,'provider_schema_invalid:errors_nonempty_rate_limit;ct=json;b=lt1k;q=none');
  assert.equal(run.run.status,'failed');assert.equal(run.run.error_class,run.generation.failure_class);
  assert.deepEqual(run.attempts.map(row=>row.outcome),['SUCCEEDED','SUCCEEDED','SUCCEEDED','SCHEMA_FAILURE']);
  assert.deepEqual(run.attempts.map(row=>row.http_class),['2xx','2xx','2xx','2xx'],'http_class is now populated for every attempt');
  assert.deepEqual(run.attempts.map(row=>row.quota_state),['KNOWN','KNOWN','KNOWN','QUOTA_UNCERTAIN']);
  assert.deepEqual(run.runtime,{quota_state:'QUOTA_UNCERTAIN',daily_attempt_count:4,in_flight_attempt_id:null});
  assert.equal(run.generation.competition_count,0);assert.equal(run.generation.fixture_count,0);assert.equal(run.heads,0);assert.ok(run.revisions>0);
});

test('R1: persisted class distinguishes non-JSON bodies, stream failures and normal-header errors',async()=>{
  const html=await runGate(async()=>new Response('<html>blocked</html>',{status:200,headers:{'content-type':'text/html'}}));
  assert.equal(html.generation.failure_class,'provider_schema_invalid:body_not_json;ct=html;b=lt1k;q=none');
  const empty=await runGate(async()=>new Response('',{status:200,headers:goodHeaders}));
  assert.equal(empty.generation.failure_class,'provider_schema_invalid:body_empty;ct=text;b=0;q=known');
  const stream=await runGate(async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"get"'));controller.error(new Error('reset'));}}),{status:200,headers:goodHeaders}));
  assert.equal(stream.generation.failure_class,'provider_schema_invalid:body_read_exception;ct=none;q=known');
  const extra=await runGate(async()=>new Response(JSON.stringify({...body({message:'x'})}),{status:200,headers:{'content-type':'application/json',...goodHeaders}}));
  assert.equal(extra.generation.failure_class,'provider_schema_invalid:envelope_keys;ct=json;b=lt1k;q=known');
  assert.equal(extra.attempts[3].quota_state,'KNOWN');assert.equal(extra.runtime.quota_state,'KNOWN');
});

test('R1: failure classes outside provider_schema_invalid are persisted exactly as before',async()=>{
  const fixtureLevel=await runGate(async()=>new Response(JSON.stringify({...body(),response:[{fixture:{id:1,date:'2026-11-01T15:00:00+00:00',status:{short:'NS'}},league:{id:45,season:2026},teams:{home:{id:null},away:{id:511}}}],results:1}),{status:200,headers:{'content-type':'application/json',...goodHeaders}}));
  assert.equal(fixtureLevel.generation.failure_class,'fixture_identity_invalid');
  const paging=await runGate(async()=>new Response(JSON.stringify(body({paging:{current:1,total:2}})),{status:200,headers:{'content-type':'application/json',...goodHeaders}}));
  assert.equal(paging.generation.failure_class,'pagination_unsupported');
  const unavailable=await runGate(async()=>new Response('',{status:500,headers:goodHeaders}));
  assert.equal(unavailable.generation.failure_class,'provider_unavailable');assert.equal(unavailable.attempts[3].http_class,'5xx');
});

test('R1: the control run still commits one generation and persists http_class',async()=>{
  const control=await runGate(async()=>new Response(JSON.stringify(body({},5)),{status:200,headers:{'content-type':'application/json',...goodHeaders}}));
  assert.equal(control.result.ok,true);assert.equal(control.generation.state,'COMMITTED');assert.equal(control.generation.failure_class,null);assert.equal(control.heads,1);
  assert.ok(control.attempts.every(row=>row.http_class==='2xx'&&row.outcome==='SUCCEEDED'));
});

test('R1: diagnostics add no module, network path, schema change or model dependency',()=>{
  const read=file=>fs.readFileSync(path.join(root,file),'utf8');
  const contracts=read('workers/api-football-collector/runtime-contracts.mjs');
  const helpers=contracts.slice(contracts.indexOf('export const API_FOOTBALL_SCHEMA_SUBREASONS'),contracts.indexOf('export async function readBoundedJson'));
  assert.doesNotMatch(helpers,/fetch\(|XMLHttpRequest|process\.env|console\./);
  const migrations=fs.readdirSync(path.join(root,'workers/data-platform/migrations')).filter(file=>file.endsWith('.sql')).sort();
  assert.equal(migrations.at(-1).slice(0,4),'0006','no migration beyond 0006 was added');
  const collectorModules=fs.readdirSync(path.join(root,'workers/api-football-collector')).filter(file=>file.endsWith('.mjs'));
  assert.equal(collectorModules.some(file=>/schema-diagnostic|failure-class/.test(file)),false,'diagnostics live in existing reviewed modules, not a new module');
});
