import test from 'node:test';
import assert from 'node:assert/strict';
import {ObserverClockReadError,readObserverClockReceipt}
  from '../workers/data-steward-watchdog/lib/observer-clock-reader.mjs';

const OPPORTUNITY_0417='2026-09-10T04:17:00.000Z';
const OPPORTUNITY_0817='2026-09-10T08:17:00.000Z';
const RUN_ID=34450000001;
const row=(overrides={})=>({opportunity_at:OPPORTUNITY_0417,cron:'17 4 * * *',dispatch_state:'DISPATCHED',
  github_run_id:RUN_ID,reason_code:'observer_dispatch_accepted',claimed_at:'2026-09-10T04:17:00.100Z',
  finalized_at:'2026-09-10T04:17:01.000Z',...overrides});

function db(value,{throwRead=false}={}){
  const state={sql:null,args:null,runs:0};
  return {state,prepare(sql){state.sql=sql;return {bind(...args){state.args=args;return {
    async first(){if(throwRead)throw new Error('d1 unavailable');return value;},
    async run(){state.runs+=1;throw new Error('mutation forbidden');}
  };}};}};
}

test('reads exactly one receipt by exact opportunity through SELECT only',async()=>{
  const fake=db(row());
  const result=await readObserverClockReceipt(fake,OPPORTUNITY_0417);
  assert.deepEqual(result,{opportunityAt:OPPORTUNITY_0417,state:'DISPATCHED',workflowRunId:RUN_ID,
    reasonCode:'observer_dispatch_accepted',claimedAt:'2026-09-10T04:17:00.100Z',
    finalizedAt:'2026-09-10T04:17:01.000Z'});
  assert.match(fake.state.sql,/^SELECT /);
  assert.match(fake.state.sql,/WHERE opportunity_at=\?1$/);
  assert.deepEqual(fake.state.args,[OPPORTUNITY_0417]);
  assert.equal(fake.state.runs,0);
});

test('accepts the exact 08:17 receipt with its matching cron',async()=>{
  const value=row({opportunity_at:OPPORTUNITY_0817,cron:'17 8 * * *',
    claimed_at:'2026-09-10T08:17:00.100Z',finalized_at:'2026-09-10T08:17:01.000Z'});
  const result=await readObserverClockReceipt(db(value),OPPORTUNITY_0817);
  assert.equal(result.opportunityAt,OPPORTUNITY_0817);
  assert.equal(result.workflowRunId,RUN_ID);
});

test('missing receipt is absence, never guessed evidence',async()=>{
  assert.equal(await readObserverClockReceipt(db(null),OPPORTUNITY_0417),null);
});

test('CLAIMED is valid only while unfinalized and has no trusted run id',async()=>{
  const result=await readObserverClockReceipt(db(row({dispatch_state:'CLAIMED',github_run_id:null,
    reason_code:'observer_dispatch_claimed',finalized_at:null})),OPPORTUNITY_0417);
  assert.equal(result.state,'CLAIMED');assert.equal(result.workflowRunId,null);
  await assert.rejects(readObserverClockReceipt(db(row({dispatch_state:'CLAIMED',github_run_id:null,
    reason_code:'observer_dispatch_claimed'})),OPPORTUNITY_0417),ObserverClockReadError);
});

test('FAILED and AMBIGUOUS require finalization and can never carry a run id',async()=>{
  for(const state of ['FAILED','AMBIGUOUS']){
    const valid=await readObserverClockReceipt(db(row({dispatch_state:state,github_run_id:null})),OPPORTUNITY_0417);
    assert.equal(valid.state,state);assert.equal(valid.workflowRunId,null);
    await assert.rejects(readObserverClockReceipt(db(row({dispatch_state:state})),OPPORTUNITY_0417),ObserverClockReadError);
    await assert.rejects(readObserverClockReceipt(db(row({dispatch_state:state,github_run_id:null,
      finalized_at:null})),OPPORTUNITY_0417),ObserverClockReadError);
  }
});

test('DISPATCHED requires a positive run id, matching cron and valid timestamps',async()=>{
  for(const overrides of [{github_run_id:null},{github_run_id:0},{cron:'17 8 * * *'},
    {claimed_at:'bad'},{finalized_at:null},{opportunity_at:OPPORTUNITY_0817}]){
    await assert.rejects(readObserverClockReceipt(db(row(overrides)),OPPORTUNITY_0417),ObserverClockReadError);
  }
});

test('D1 failures and malformed input fail closed with named clock errors',async()=>{
  await assert.rejects(readObserverClockReceipt(db(null,{throwRead:true}),OPPORTUNITY_0417),error=>
    error instanceof ObserverClockReadError&&error.code==='WATCHDOG_CLOCK_DB_UNAVAILABLE');
  await assert.rejects(readObserverClockReceipt(null,OPPORTUNITY_0417),error=>
    error.code==='WATCHDOG_CLOCK_DB_UNAVAILABLE');
  await assert.rejects(readObserverClockReceipt(db(null),'bad'),error=>
    error.code==='WATCHDOG_CLOCK_RECEIPT_INVALID');
});
