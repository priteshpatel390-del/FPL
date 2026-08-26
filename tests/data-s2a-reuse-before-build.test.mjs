import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DATA_S2_SOURCE_REVISION_ID,
  DATA_S2_VALIDATION_VERSION,
  collectOfficialFplHistory,
  deriveOfficialFplSeason
} from '../workers/data-platform/official-fpl-history.mjs';

const revision={
  source_revision_id:DATA_S2_SOURCE_REVISION_ID,
  source_key:'official-fpl',
  source_kind:'official_fpl',
  rights_classification:'durable_allowed',
  retention_allowed:1,
  shadow_ingest_allowed:1,
  attribution_required:0
};

function rolloverBootstrap(startYear){
  return {
    events:Array.from({length:30},(_,i)=>({
      id:i+1,
      deadline_time:new Date(Date.UTC(startYear,7,15+i*7,10)).toISOString()
    })),
    teams:Array.from({length:20},()=>({})),
    elements:Array.from({length:400},()=>({})),
    element_types:[]
  };
}

function response(payload){return {ok:true,json:async()=>payload};}

test('DATA-S2A derives the season from Official FPL GW1 deadline evidence',()=>{
  assert.equal(deriveOfficialFplSeason(rolloverBootstrap(2026)),'2026-27');
  assert.equal(deriveOfficialFplSeason(rolloverBootstrap(2025)),'2025-26');
  assert.equal(DATA_S2_VALIDATION_VERSION,'data-s2a-official-fpl-validation-v2');
});

test('season rollover mismatch fails closed before any observation-head read or batch write',async()=>{
  const sqlCalls=[];
  let failedArgs=null;
  let batchCalls=0;
  const db={
    prepare(sql){
      sqlCalls.push(sql);
      return {
        bind(...args){
          return {
            async first(){
              assert.match(sql,/data_source_revisions/);
              return revision;
            },
            async run(){
              if(/INSERT OR IGNORE INTO ingestion_runs/.test(sql))return {meta:{changes:1}};
              if(/status='failed'/.test(sql)){failedArgs=args;return {meta:{changes:1}};}
              throw new Error(`unexpected_run:${sql}`);
            },
            async all(){throw new Error('observation_heads_should_not_be_read');}
          };
        }
      };
    },
    async batch(){batchCalls+=1;throw new Error('batch_should_not_run');}
  };
  const fixtures=Array.from({length:300},()=>({}));
  const fetchImpl=async url=>response(url.includes('/bootstrap-static/')?rolloverBootstrap(2025):fixtures);
  const now=()=>Date.parse('2026-08-26T10:00:00.000Z');
  const result=await collectOfficialFplHistory({TEAMSHEET_DATA_DB:db,DATA_S2_SEASON:'2026-27'},{
    scheduledTime:Date.parse('2026-08-26T10:00:00.000Z'),fetchImpl,now
  });

  assert.equal(result.ok,false);
  assert.equal(result.reason,'season_mismatch');
  assert.equal(batchCalls,0);
  assert.equal(sqlCalls.some(sql=>/observation_heads/.test(sql)),false);
  assert.ok(failedArgs);
  assert.equal(failedArgs[1],'season_mismatch');
});

test('Reuse Before Build is a permanent engineering gate and DATA-S2 audit remains non-provider-changing',()=>{
  const principle=fs.readFileSync('docs/REUSE-BEFORE-BUILD.md','utf8');
  const audit=fs.readFileSync('docs/research/09-EXTERNAL-REPOSITORIES/DATA-S2-BACKEND-REUSE-AUDIT.md','utf8');
  assert.match(principle,/Has somebody already solved this well\?/);
  for(const classification of ['Adopt','Adapt','Port','Reference','Reject'])assert.match(principle,new RegExp(`\\b${classification}\\b`));
  assert.match(audit,/TopMarx\/fpl/);
  assert.match(audit,/season rollover/i);
  assert.match(audit,/keep PR #160/i);
  assert.match(audit,/no new runtime provider/i);
});
