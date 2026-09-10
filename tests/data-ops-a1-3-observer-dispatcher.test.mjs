import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import dispatcher,{runObserverScheduledDispatch}
  from '../workers/data-steward-observer-dispatcher/dispatcher.mjs';
import {AMBIGUOUS,DISPATCHED,DUPLICATE,FAILED,OBSERVER_CLOCK_DB_BINDING,OBSERVER_CRONS,
  OBSERVER_DISPATCH_BODY,OBSERVER_DISPATCH_REPOSITORY,OBSERVER_DISPATCH_TOKEN_BINDING,
  OBSERVER_DISPATCH_URL,observerDispatchRequest}
  from '../workers/data-steward-observer-dispatcher/dispatch-contract.mjs';

const DIR='workers/data-steward-observer-dispatcher';
const config=JSON.parse(fs.readFileSync(`${DIR}/wrangler.jsonc`,'utf8'));
const source=fs.readdirSync(DIR,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?[]:
  entry.name.endsWith('.mjs')?[fs.readFileSync(`${DIR}/${entry.name}`,'utf8')]:[]).join('\n');
const SCHEDULED_0417=Date.UTC(2026,8,10,4,17,0);
const SCHEDULED_0817=Date.UTC(2026,8,10,8,17,0);
const RUN_ID=34450000001;

function fakeDb({claim=true,finalize=true}={}){
  const state={claims:[],finals:[]};
  return {state,prepare(sql){return {bind(...args){return {async run(){
    if(sql.startsWith('INSERT INTO observer_dispatch_receipts')){
      state.claims.push(args);return {success:true,meta:{changes:claim?1:0}};
    }
    if(sql.startsWith('UPDATE observer_dispatch_receipts')){
      state.finals.push(args);return {success:true,meta:{changes:finalize?1:0}};
    }
    throw new Error('unexpected_sql');
  }}};}}};
}

function controller({scheduledTime=SCHEDULED_0417,cron=OBSERVER_CRONS[0]}={}){
  const state={noRetry:0};
  return {state,value:{scheduledTime,cron,noRetry(){state.noRetry+=1;}}};
}

const identity=runId=>({workflow_run_id:runId,
  run_url:`https://api.github.com/repos/${OBSERVER_DISPATCH_REPOSITORY}/actions/runs/${runId}`,
  html_url:`https://github.com/${OBSERVER_DISPATCH_REPOSITORY}/actions/runs/${runId}`});
const response=(status,body)=>({status,json:async()=>body});

async function fire({db=fakeDb(),token='observer-token',reply=response(200,identity(RUN_ID)),
  control=controller()}={}){
  const calls=[];const logs=[];const original=console.log;console.log=line=>logs.push(line);
  let result,error;
  try{
    result=await runObserverScheduledDispatch({controller:control.value,
      env:{[OBSERVER_CLOCK_DB_BINDING]:db,[OBSERVER_DISPATCH_TOKEN_BINDING]:token},
      fetchImpl:async(url,init)=>{calls.push({url,init});return reply;},
      now:()=>control.value.scheduledTime+1000});
  }catch(value){error=value;}
  finally{console.log=original;}
  return {db,calls,logs,result,error,control};
}

test('observer dispatcher has one isolated Worker with exactly 04:17 and 08:17 UTC automatic opportunities',()=>{
  assert.equal(config.name,'teamsheet-data-steward-observer-dispatcher');
  assert.equal(config.main,'dispatcher.mjs');
  assert.deepEqual(config.triggers,{crons:['17 4 * * *','17 8 * * *']});
  assert.equal(config.workers_dev,false);
  assert.equal(config.preview_urls,false);
  assert.equal(typeof dispatcher.scheduled,'function');
  assert.equal(dispatcher.fetch,undefined);
  assert.deepEqual(Object.keys(dispatcher),['scheduled']);
});

test('observer dispatcher owns only its receipt D1 and never a production data binding',()=>{
  assert.equal(config.d1_databases.length,1);
  const [db]=config.d1_databases;
  assert.equal(db.binding,OBSERVER_CLOCK_DB_BINDING);
  assert.equal(db.database_name,'teamsheet-data-steward-observer-clock');
  assert.equal(db.database_id,'00000000-0000-0000-0000-000000000000');
  assert.equal(db.migrations_dir,'migrations');
  for(const forbidden of ['TEAMSHEET_DATA_DB','STEWARD_WATCHDOG_DB','EVIDENCE_DB','EVIDENCE_BUCKET'])
    assert.doesNotMatch(source+JSON.stringify(config),new RegExp(forbidden));
  for(const forbidden of ['kv_namespaces','r2_buckets','services','send_email','routes','route','vars'])
    assert.equal(config[forbidden],undefined,forbidden);
});

test('dispatch contract is fixed to the read-only observer on main with no workflow inputs',()=>{
  assert.deepEqual([...OBSERVER_CRONS],['17 4 * * *','17 8 * * *']);
  assert.equal(OBSERVER_DISPATCH_TOKEN_BINDING,'DATA_STEWARD_OBSERVER_DISPATCH_TOKEN');
  assert.notEqual(OBSERVER_DISPATCH_TOKEN_BINDING,'GITHUB_DISPATCH_TOKEN');
  assert.equal(OBSERVER_DISPATCH_BODY,JSON.stringify({ref:'main',return_run_details:true}));
  const request=observerDispatchRequest('secret');
  assert.equal(request.url,OBSERVER_DISPATCH_URL);
  assert.equal(request.init.method,'POST');
  assert.equal(request.init.body,OBSERVER_DISPATCH_BODY);
  assert.match(request.url,/data-steward-readonly-observer\.yml\/dispatches$/);
});

test('both approved Cloudflare opportunities dispatch independently and receipt exact cron/time',async()=>{
  for(const [scheduledTime,cron] of [[SCHEDULED_0417,OBSERVER_CRONS[0]],[SCHEDULED_0817,OBSERVER_CRONS[1]]]){
    const outcome=await fire({control:controller({scheduledTime,cron})});
    assert.equal(outcome.result.dispatch,DISPATCHED);
    assert.equal(outcome.db.state.claims.length,1);
    assert.equal(outcome.db.state.claims[0][0],new Date(scheduledTime).toISOString());
    assert.equal(outcome.db.state.claims[0][1],cron);
    assert.equal(outcome.calls.length,1);
  }
});

test('noRetry happens before the one outbound dispatch and exact returned run identity is receipted',async()=>{
  const db=fakeDb();const control=controller();let noRetryAtRequest;
  const calls=[];const logs=[];const original=console.log;console.log=line=>logs.push(line);
  try{
    const result=await runObserverScheduledDispatch({controller:control.value,
      env:{[OBSERVER_CLOCK_DB_BINDING]:db,[OBSERVER_DISPATCH_TOKEN_BINDING]:'secret'},
      fetchImpl:async(url,init)=>{noRetryAtRequest=control.state.noRetry;calls.push({url,init});
        return response(200,identity(RUN_ID));},now:()=>SCHEDULED_0417+1000});
    assert.equal(result.dispatch,DISPATCHED);
  }finally{console.log=original;}
  assert.equal(control.state.noRetry,1);
  assert.equal(noRetryAtRequest,1);
  assert.equal(calls.length,1);
  assert.equal(db.state.claims.length,1);
  assert.equal(db.state.finals.length,1);
  assert.equal(db.state.finals[0][1],DISPATCHED);
  assert.equal(db.state.finals[0][2],RUN_ID);
  assert.doesNotMatch(logs.join('\n'),new RegExp(String(RUN_ID)));
  assert.doesNotMatch(logs.join('\n'),/secret|https?:\/\//i);
});

test('duplicate receipt claim dispatches nothing',async()=>{
  const outcome=await fire({db:fakeDb({claim:false})});
  assert.equal(outcome.result.dispatch,DUPLICATE);
  assert.equal(outcome.calls.length,0);
  assert.equal(outcome.db.state.finals.length,0);
  assert.equal(outcome.control.state.noRetry,1);
});

test('missing token is persisted FAILED and cannot dispatch',async()=>{
  const outcome=await fire({token:''});
  assert.ok(outcome.error);
  assert.equal(outcome.calls.length,0);
  assert.equal(outcome.db.state.finals[0][1],FAILED);
  assert.equal(outcome.db.state.finals[0][2],null);
});

test('rejected GitHub response is FAILED; missing identity or transport uncertainty is AMBIGUOUS',async()=>{
  const rejected=await fire({reply:response(403,{})});
  assert.ok(rejected.error);assert.equal(rejected.db.state.finals[0][1],FAILED);
  const noIdentity=await fire({reply:response(204,null)});
  assert.ok(noIdentity.error);assert.equal(noIdentity.db.state.finals[0][1],AMBIGUOUS);
  const malformed=await fire({reply:response(200,{workflow_run_id:RUN_ID})});
  assert.ok(malformed.error);assert.equal(malformed.db.state.finals[0][1],AMBIGUOUS);

  const db=fakeDb();const control=controller();const logs=[];const original=console.log;console.log=line=>logs.push(line);
  try{
    await assert.rejects(runObserverScheduledDispatch({controller:control.value,
      env:{[OBSERVER_CLOCK_DB_BINDING]:db,[OBSERVER_DISPATCH_TOKEN_BINDING]:'secret'},
      fetchImpl:async()=>{throw new Error('possibly accepted');},now:()=>SCHEDULED_0417+1000}));
  }finally{console.log=original;}
  assert.equal(db.state.finals[0][1],AMBIGUOUS);
  assert.equal(control.state.noRetry,1);
});

test('wrong cron, mismatched approved cron or logical time fails before claim or outbound request',async()=>{
  for(const control of [controller({cron:'17 12 * * *'}),controller({cron:OBSERVER_CRONS[1]}),
    controller({scheduledTime:SCHEDULED_0417+60000})]){
    const db=fakeDb();let calls=0;
    await assert.rejects(runObserverScheduledDispatch({controller:control.value,
      env:{[OBSERVER_CLOCK_DB_BINDING]:db,[OBSERVER_DISPATCH_TOKEN_BINDING]:'secret'},
      fetchImpl:async()=>{calls+=1;return response(200,identity(RUN_ID));}}));
    assert.equal(calls,0);assert.equal(db.state.claims.length,0);assert.equal(control.state.noRetry,1);
  }
});

test('package imports stay local and contain no provider, collector or repair authority',()=>{
  const files=fs.readdirSync(DIR).filter(name=>name.endsWith('.mjs'));
  for(const file of files){
    const text=fs.readFileSync(`${DIR}/${file}`,'utf8');
    for(const match of text.matchAll(/from\s*['"]([^'"]+)['"]/g)){
      assert.ok(match[1].startsWith('./'),`${file}: ${match[1]}`);
      assert.ok(!match[1].includes('..'),`${file}: ${match[1]}`);
    }
    assert.doesNotMatch(text,/Official FPL endpoint|TEAMSHEET_DATA_DB|production_d1|rerun|redeploy|repair/i,file);
  }
});

test('receipt migration is narrow, non-destructive and permits only the two approved crons',()=>{
  const migration=fs.readFileSync(`${DIR}/migrations/0001_observer_clock.sql`,'utf8');
  assert.match(migration,/CREATE TABLE IF NOT EXISTS observer_dispatch_receipts/);
  assert.match(migration,/PRIMARY KEY/);
  assert.match(migration,/github_run_id INTEGER UNIQUE/);
  assert.match(migration,/cron IN \('17 4 \* \* \*','17 8 \* \* \*'\)/);
  assert.doesNotMatch(migration,/DROP |ALTER |ATTACH |PRAGMA /i);
});
