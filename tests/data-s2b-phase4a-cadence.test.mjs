import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DATA_S2_COLLECTION_CRON,DATA_S2_DAILY_UTC_HOUR,DATA_S2_DAILY_UTC_MINUTE,DATA_S2_PRE_DEADLINE_WINDOW_MS,
  classifyOfficialFplSchedule,readNextOfficialFplDeadline,scheduledOfficialFplHistory
} from '../workers/data-platform/official-fpl-history.mjs';

const ms=value=>Date.parse(value);

function controller(at,cron=DATA_S2_COLLECTION_CRON){return {cron,scheduledTime:ms(at)};}

function successfulCollector(counter){
  return async(_env,options)=>{
    counter.calls+=1;counter.options.push(options);
    return {ok:true,result:'unchanged',changed:0,recordsSeen:9000};
  };
}

test('Phase 4A repository candidate uses one half-hour schedule check rather than fixed intraday collection',()=>{
  const config=JSON.parse(fs.readFileSync('workers/data-platform/wrangler.jsonc','utf8'));
  assert.deepEqual(config.triggers.crons,[DATA_S2_COLLECTION_CRON]);
  assert.equal(DATA_S2_COLLECTION_CRON,'*/30 * * * *');
  assert.equal(DATA_S2_DAILY_UTC_HOUR,1);
  assert.equal(DATA_S2_DAILY_UTC_MINUTE,0);
  assert.equal(DATA_S2_PRE_DEADLINE_WINDOW_MS,30*60*1000);
});

test('unrecognised Cron and malformed scheduled time fail closed without a collection decision',()=>{
  assert.deepEqual(classifyOfficialFplSchedule({cron:'0 * * * *',scheduledTime:ms('2026-08-21T17:00:00Z')}),{collect:false,reason:'cron_unrecognised'});
  assert.deepEqual(classifyOfficialFplSchedule({cron:DATA_S2_COLLECTION_CRON,scheduledTime:'bad'}),{collect:false,reason:'scheduled_time_invalid'});
});

test('01:00 UTC is the single routine daily full-collection slot',()=>{
  assert.deepEqual(classifyOfficialFplSchedule({cron:DATA_S2_COLLECTION_CRON,scheduledTime:ms('2026-08-22T01:00:00Z')}),{collect:true,reason:'daily'});
  assert.deepEqual(classifyOfficialFplSchedule({cron:DATA_S2_COLLECTION_CRON,scheduledTime:ms('2026-08-22T01:30:00Z')}),{collect:false,reason:'deadline_unavailable'});
});

test('pre-deadline collection is allowed only at the final half-hour schedule opportunity before deadline',()=>{
  const deadline='2026-08-21T17:30:00.000Z';
  assert.deepEqual(classifyOfficialFplSchedule({
    cron:DATA_S2_COLLECTION_CRON,scheduledTime:ms('2026-08-21T17:00:00Z'),deadlineTime:deadline,actualTime:ms('2026-08-21T17:00:05Z')
  }),{collect:true,reason:'pre_deadline',deadlineTime:deadline,leadMs:30*60*1000});
  assert.deepEqual(classifyOfficialFplSchedule({
    cron:DATA_S2_COLLECTION_CRON,scheduledTime:ms('2026-08-21T16:30:00Z'),deadlineTime:deadline,actualTime:ms('2026-08-21T16:30:05Z')
  }),{collect:false,reason:'outside_deadline_window',deadlineTime:deadline});
  assert.deepEqual(classifyOfficialFplSchedule({
    cron:DATA_S2_COLLECTION_CRON,scheduledTime:ms('2026-08-21T17:00:00Z'),deadlineTime:deadline,actualTime:ms('2026-08-21T17:30:00Z')
  }),{collect:false,reason:'deadline_elapsed',deadlineTime:deadline});
});

test('next-deadline lookup is a bounded read of current completed event deadline heads only',async()=>{
  let sql=null,args=null;
  const db={prepare(statement){sql=statement;return {bind(...values){args=values;return {first:async()=>({deadline_time:'2026-08-29T10:00:00Z'})};}};}};
  const result=await readNextOfficialFplDeadline({TEAMSHEET_DATA_DB:db,DATA_S2_SEASON:'2026-27'},{afterTime:ms('2026-08-28T10:00:00Z')});
  assert.equal(result,'2026-08-29T10:00:00.000Z');
  assert.match(sql,/^SELECT /);
  assert.match(sql,/observation_heads/);
  assert.match(sql,/official_fpl_event/);
  assert.match(sql,/deadline_time/);
  assert.match(sql,/r\.status='completed'/);
  assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER)\b/i);
  assert.equal(args[0],'official-fpl|2026-27|event|');
  assert.equal(args[1],'official-fpl|2026-27|event|\uffff');
  assert.equal(args.at(-1),'2026-08-28T10:00:00.000Z');
});

test('routine daily scheduled invocation collects once without a deadline-head read',async()=>{
  const counter={calls:0,options:[]};let reads=0;
  const result=await scheduledOfficialFplHistory(controller('2026-08-22T01:00:00Z'),{},
    {collectImpl:successfulCollector(counter),readDeadlineImpl:async()=>{reads+=1;return null;},now:()=>ms('2026-08-22T01:00:01Z')});
  assert.equal(result.result,'unchanged');
  assert.equal(counter.calls,1);
  assert.equal(reads,0);
  assert.equal(counter.options[0].scheduledTime,ms('2026-08-22T01:00:00Z'));
});

test('ordinary half-hour invocation reads one deadline then skips with zero collection',async()=>{
  const counter={calls:0,options:[]};let reads=0;
  const result=await scheduledOfficialFplHistory(controller('2026-08-21T16:30:00Z'),{},
    {collectImpl:successfulCollector(counter),readDeadlineImpl:async()=>{reads+=1;return '2026-08-21T17:30:00.000Z';},now:()=>ms('2026-08-21T16:30:02Z')});
  assert.deepEqual(result,{ok:true,result:'schedule_skip',reason:'outside_deadline_window',scheduledTime:ms('2026-08-21T16:30:00Z'),changed:0});
  assert.equal(reads,1);
  assert.equal(counter.calls,0);
});

test('final pre-deadline half-hour invocation reads one deadline and performs one full collection',async()=>{
  const counter={calls:0,options:[]};let reads=0;
  const result=await scheduledOfficialFplHistory(controller('2026-08-21T17:00:00Z'),{},
    {collectImpl:successfulCollector(counter),readDeadlineImpl:async()=>{reads+=1;return '2026-08-21T17:30:00.000Z';},now:()=>ms('2026-08-21T17:00:02Z')});
  assert.equal(result.result,'unchanged');
  assert.equal(reads,1);
  assert.equal(counter.calls,1);
});

test('wrong Cron cannot read D1 or invoke the collector',async()=>{
  const counter={calls:0,options:[]};let reads=0;
  const result=await scheduledOfficialFplHistory(controller('2026-08-21T17:00:00Z','0 * * * *'),{},
    {collectImpl:successfulCollector(counter),readDeadlineImpl:async()=>{reads+=1;return '2026-08-21T17:30:00.000Z';}});
  assert.equal(result.reason,'cron_unrecognised');
  assert.equal(reads,0);
  assert.equal(counter.calls,0);
});

test('deadline lookup failure is visible and cannot fall through to collection',async()=>{
  const counter={calls:0,options:[]};
  await assert.rejects(()=>scheduledOfficialFplHistory(controller('2026-08-21T17:00:00Z'),{},
    {collectImpl:successfulCollector(counter),readDeadlineImpl:async()=>{throw new Error('d1 unavailable');}}),/data_s2_schedule_read_failed/);
  assert.equal(counter.calls,0);
});

test('existing collector failure remains a failed scheduled invocation',async()=>{
  await assert.rejects(()=>scheduledOfficialFplHistory(controller('2026-08-22T01:00:00Z'),{},
    {collectImpl:async()=>({ok:false,reason:'official_fpl_http_failed'})}),/data_s2_official_fpl_http_failed/);
});
