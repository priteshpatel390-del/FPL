import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildCurrentHeadsRead,buildProductionCurrentHeadsExplainRead,buildProductionPopulationAndHeadsRead,buildProductionGovernanceRead,buildProductionPostflightRead,buildRunRead,inspectOfficialFplD1RestPlan,SUPERSEDED_OH_HEADS_SQL,validateProductionCurrentHeadsExplain} from '../workers/data-platform/official-fpl-d1-rest-plan.mjs';

const migrations=['0001_shadow_data_foundation.sql','0002_official_fpl_structured_history.sql','0003_production_query_plan_indexes.sql'];
const read=name=>fs.readFileSync(`workers/data-platform/migrations/${name}`,'utf8');
const sqlite=(db,input)=>{const out=spawnSync('sqlite3',[db],{input,encoding:'utf8'});if(out.status!==0)throw new Error(out.stderr);return out.stdout;};
const explain=(db,plan)=>sqlite(db,`EXPLAIN QUERY PLAN ${plan.statements[0].sql.replaceAll('?',"'official-fpl-r1'")};`).trim().split('\n');

function database(count=100){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'data-s2-plan-')),db=path.join(dir,'schema.db');sqlite(db,read(migrations[0])+read(migrations[1]));const seed=`INSERT INTO ingestion_runs VALUES('run','official-fpl-r1','official_fpl_structured_history','shadow_only','2026-09-02T17:41:00.000Z','2026-09-02T18:00:00.000Z','completed','official_fpl_public_core','data-s2a-official-fpl-validation-v2','data-s2a-official-fpl-history-v1','data-s2a-v1',${count},${count},0,0,NULL,'2026-09-02T17:41:00.000Z');\n`+Array.from({length:count},(_,i)=>`INSERT INTO canonical_entities VALUES('e${i}','player','2026-27','official_fpl','${i}','x');INSERT INTO shadow_observations(observation_id,logical_key,ingestion_run_id,source_revision_id,category,subject_type,subject_entity_id,provenance_kind,metric,value_type,value_number,transform_version,validation_version,input_revision,admission_state,quality_state,mode,fetched_at,created_at) VALUES('${String(i).padStart(64,'0')}','k${i}','run','official-fpl-r1','player','player','e${i}','canonical_native_fpl','cost','number',1,'t','v','i${i}','accepted','fresh','shadow_only','x','x');INSERT INTO observation_heads VALUES('k${i}','${String(i).padStart(64,'0')}','x');`).join('\n');sqlite(db,seed);return {db,dir};}

// A seeded database whose history is deliberately deeper than its head set, plus the awkward
// states the current-head predicate has to exclude: an incomplete run, rows on another source
// revision, and a head whose observation does not exist.
function equivalenceDatabase({observations,heads,revisions,startedRun=false,wrongRevision=false,orphanHead=false}){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'data-s2-equiv-')),db=path.join(dir,'schema.db');
  sqlite(db,read(migrations[0])+read(migrations[1])+read(migrations[2]));
  const runRow=(id,revision,status)=>`INSERT INTO ingestion_runs VALUES('${id}','${revision}','official_fpl_structured_history','shadow_only','a',${status==='completed'?"'b'":'NULL'},'${status}','c','p','t','s',0,0,0,0,NULL,'x');`;
  const observation=(index,key,run,revision)=>`INSERT INTO shadow_observations(observation_id,logical_key,ingestion_run_id,source_revision_id,category,subject_type,subject_entity_id,provenance_kind,metric,value_type,value_number,transform_version,validation_version,input_revision,admission_state,quality_state,mode,fetched_at,created_at) VALUES('${String(index).padStart(64,'0')}','${key}','${run}','${revision}','player','player','e${key.slice(1)}','canonical_native_fpl','cost','number',${index},'t','v','i${index}','accepted','fresh','shadow_only','x','x');`;
  // Which run and revision each historical observation belongs to. Bucket 1 is diverted to an
  // incomplete run or to another source revision where the scenario asks for it, so the
  // current-head predicate has genuine rows it must exclude rather than a uniform population.
  const owner=index=>{
    const bucket=index%revisions;
    if(startedRun&&revisions>1&&bucket===1)return {run:'run-started',revision:'official-fpl-r1'};
    if(wrongRevision&&revisions>1&&bucket===1)return {run:'run-other',revision:'official-fpl-r2'};
    return {run:'run',revision:'official-fpl-r1'};
  };
  let seed=runRow('run','official-fpl-r1','completed');
  if(startedRun)seed+=runRow('run-started','official-fpl-r1','started');
  if(wrongRevision)seed+=runRow('run-other','official-fpl-r2','completed');
  for(let i=0;i<heads;i++)seed+=`INSERT INTO canonical_entities VALUES('e${i}','player','2026-27','official_fpl','${i}','x');`;
  for(let i=0;i<observations;i++){const {run,revision}=owner(i);seed+=observation(i,`k${i%Math.max(heads,1)}`,run,revision);}
  // Each head points at the newest historical observation for its logical key, whoever owns it.
  // Where that newest row belongs to an incomplete run or another revision, the head is one the
  // current-head predicate must exclude — which is exactly the case worth proving equivalent.
  for(let i=0;i<heads;i++){
    let chosen=null;
    for(let j=i;j<observations;j+=Math.max(heads,1))chosen=j;
    if(chosen!==null)seed+=`INSERT INTO observation_heads VALUES('k${i}','${String(chosen).padStart(64,'0')}','x');`;
  }
  sqlite(db,seed);
  // An orphan head points at no observation at all. Foreign keys are off in this harness, which
  // is what lets the forbidden state the postflight has to detect be seeded deliberately.
  if(orphanHead)sqlite(db,`INSERT INTO observation_heads VALUES('k-orphan','${'f'.repeat(64)}','x');`);
  return {db,dir};
}

test('migration ordering is append-only and existing migration bytes remain accepted',()=>{assert.deepEqual(fs.readdirSync('workers/data-platform/migrations').filter(x=>/^\d{4}_/.test(x)).sort(),migrations);assert.equal(read(migrations[0]).length,6832);assert.equal(read(migrations[1]).length,1162);assert.match(read(migrations[2]),/CREATE INDEX observation_heads_observation_id ON observation_heads\(observation_id\)/);});

test('0003 is additive, ordered, and repeat application fails without duplicating its ledger row',()=>{const {db,dir}=database(0);try{sqlite(db,read(migrations[2]));assert.equal(sqlite(db,"SELECT group_concat(version||':'||name,',') FROM (SELECT * FROM schema_migrations ORDER BY version);").trim(),'1:shadow_data_foundation,2:official_fpl_structured_history,3:production_query_plan_indexes');const second=spawnSync('sqlite3',[db],{input:read(migrations[2]),encoding:'utf8'});assert.notEqual(second.status,0);assert.equal(sqlite(db,'SELECT COUNT(*) FROM schema_migrations WHERE version=3;').trim(),'1');}finally{fs.rmSync(dir,{recursive:true,force:true});}});

test('the current-head statement is O(N): one covering head pass, then indexed probes',()=>{const {db,dir}=database();try{const plan=inspectOfficialFplD1RestPlan(buildCurrentHeadsRead({sourceRevisionId:'official-fpl-r1'}));
  // Before migration 0003 the head index does not exist, so the bounded pass cannot be covering.
  const before=explain(db,plan);assert.ok(before.some(x=>x.includes('SCAN h')&&!x.includes('COVERING INDEX observation_heads_observation_id')),before.join('\n'));
  assert.throws(()=>validateProductionCurrentHeadsExplain(before.slice(1).map(detail=>({detail:detail.replace(/^[|`\-\s]+/,'')}))),/production_query_plan_mismatch/);
  sqlite(db,read(migrations[2]));
  const after=explain(db,plan);
  // Exactly one bounded covering pass of observation_heads drives the statement, and both other
  // tables are reached as indexed probes from it. No revision-led traversal of the append-only
  // history survives, which is what makes the cost proportional to N rather than H.
  assert.ok(after.some(x=>x.includes('SCAN h USING COVERING INDEX observation_heads_observation_id')),after.join('\n'));
  assert.equal(after.filter(x=>/\bh\b/.test(x)&&/SCAN|SEARCH/.test(x)).length,1,after.join('\n'));
  assert.ok(after.some(x=>x.includes('SEARCH o USING INDEX sqlite_autoindex_shadow_observations_1')),after.join('\n'));
  assert.ok(after.some(x=>/SEARCH r USING INDEX sqlite_autoindex_ingestion_runs_\d+/.test(x)),after.join('\n'));
  assert.ok(!after.some(x=>x.includes('shadow_observation_idempotency')),after.join('\n'));
  assert.ok(!after.some(x=>x.includes('AUTOMATIC INDEX')),after.join('\n'));
  assert.equal(validateProductionCurrentHeadsExplain(after.slice(1).map(detail=>({detail:detail.replace(/^[|`\-\s]+/,'')}))),true);
}finally{fs.rmSync(dir,{recursive:true,force:true});}});

// Row-set equivalence between the superseded O(H) statement and the O(N) replacement, across the
// representative governed states. The plan changed; the answer must not.
test('the O(N) current-head statement returns the identical row set to the superseded O(H) statement',()=>{
  const scenarios=[
    ['normal completed heads',{observations:60,heads:60,revisions:1}],
    ['changed heads with multiple historical observations per logical key',{observations:180,heads:60,revisions:3}],
    ['large history, small head set',{observations:400,heads:40,revisions:10}],
    ['no changes at all',{observations:40,heads:40,revisions:1}],
    ['an incomplete started run beside the completed one',{observations:120,heads:60,revisions:2,startedRun:true}],
    ['rows on a different source revision',{observations:120,heads:60,revisions:2,wrongRevision:true}],
    ['an orphan-like head pointing at no observation',{observations:60,heads:60,revisions:1,orphanHead:true}],
    ['an empty governed population',{observations:0,heads:0,revisions:1}]
  ];
  for(const [label,shape] of scenarios){
    const {db,dir}=equivalenceDatabase(shape);
    try{
      const current=inspectOfficialFplD1RestPlan(buildCurrentHeadsRead({sourceRevisionId:'official-fpl-r1'})).statements[0].sql;
      assert.notEqual(current,SUPERSEDED_OH_HEADS_SQL);
      const rowsOf=sql=>sqlite(db,`.mode json\nSELECT * FROM (${sql.replaceAll('?',"'official-fpl-r1'")}) ORDER BY observation_id;`).trim();
      assert.equal(rowsOf(current),rowsOf(SUPERSEDED_OH_HEADS_SQL),label);
      // The answer must be genuinely exercised, never vacuously empty, and never larger than the
      // head population — that upper bound is the whole reason the O(N) plan is admissible.
      const count=Number(sqlite(db,`SELECT COUNT(*) FROM (${current.replaceAll('?',"'official-fpl-r1'")});`).trim());
      assert.ok(count<=shape.heads,`${label}: ${count} > ${shape.heads}`);
      if(shape.observations>0&&!shape.startedRun&&!shape.wrongRevision)assert.equal(count,shape.heads,label);
      if(shape.observations===0)assert.equal(count,0,label);
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
  }
});

test('all production SELECT plans expose the complete static traversal structure at schema 0003',()=>{const {db,dir}=database();try{sqlite(db,read(migrations[2]));const plans=[buildProductionGovernanceRead({sourceRevisionId:'official-fpl-r1'}),buildRunRead({runId:'run',sourceRevisionId:'official-fpl-r1'}),buildCurrentHeadsRead({sourceRevisionId:'official-fpl-r1'}),buildProductionPostflightRead({runId:'run',sourceRevisionId:'official-fpl-r1'})];for(const plan of plans){const rows=explain(db,inspectOfficialFplD1RestPlan(plan));assert.ok(rows.every(x=>!x.includes('AUTOMATIC INDEX')),rows.join('\n'));}const heads=explain(db,plans[2]);assert.ok(heads.some(x=>x.includes('SCAN h USING COVERING INDEX observation_heads_observation_id')));assert.ok(!heads.some(x=>x.includes('shadow_observation_idempotency')));const post=explain(db,plans[3]);assert.ok(post.some(x=>x.includes('SCAN h')));assert.ok(post.some(x=>x.includes('sqlite_autoindex_shadow_observations_1')));assert.equal(post.filter(x=>x.includes('shadow_observation_idempotency')).length,1,post.join('\n'));assert.equal((inspectOfficialFplD1RestPlan(plans[3]).statements[0].sql.match(/FROM shadow_observations/g)||[]).length,1);assert.equal((inspectOfficialFplD1RestPlan(plans[3]).statements[0].sql.match(/FROM observation_heads/g)||[]).length,1);}finally{fs.rmSync(dir,{recursive:true,force:true});}});


test('population probe statements stay covering-index only and reuse the exact current-head SQL',()=>{const {db,dir}=database();try{sqlite(db,read(migrations[2]));const plan=inspectOfficialFplD1RestPlan(buildProductionPopulationAndHeadsRead({sourceRevisionId:'official-fpl-r1'}));assert.equal(plan.statements.length,3);assert.equal(plan.statements[0].sql,inspectOfficialFplD1RestPlan(buildCurrentHeadsRead({sourceRevisionId:'official-fpl-r1'})).statements[0].sql);const observations=sqlite(db,`EXPLAIN QUERY PLAN ${plan.statements[1].sql.replaceAll('?',"'official-fpl-r1'")};`).trim().split('\n');assert.ok(observations.some(x=>x.includes('COVERING INDEX shadow_observation_idempotency')),observations.join('\n'));const heads=sqlite(db,`EXPLAIN QUERY PLAN ${plan.statements[2].sql};`).trim().split('\n');assert.ok(heads.some(x=>x.includes('COVERING INDEX observation_heads_observation_id')),heads.join('\n'));assert.ok(!heads.some(x=>/SCAN observation_heads(?! USING COVERING INDEX)/.test(x)),heads.join('\n'));for(const rows of [observations,heads])assert.ok(rows.every(x=>!x.includes('AUTOMATIC INDEX')));assert.equal(Number(sqlite(db,`${plan.statements[1].sql.replaceAll('?',"'official-fpl-r1'")};`).trim()),100);assert.equal(Number(sqlite(db,`${plan.statements[2].sql};`).trim()),100);}finally{fs.rmSync(dir,{recursive:true,force:true});}});

test('live-plan acceptance is fixed to the repository O(N) current-head SQL and rejects the old shapes',()=>{const plan=inspectOfficialFplD1RestPlan(buildProductionCurrentHeadsExplainRead({sourceRevisionId:'official-fpl-r1'}));assert.equal(plan.statements.length,1);assert.match(plan.statements[0].sql,/^EXPLAIN QUERY PLAN SELECT o\.\* FROM observation_heads h CROSS JOIN shadow_observations o/);assert.deepEqual([...plan.statements[0].params],['official-fpl-r1']);
  assert.equal(validateProductionCurrentHeadsExplain([
    {detail:'SCAN h USING COVERING INDEX observation_heads_observation_id'},
    {detail:'SEARCH o USING INDEX sqlite_autoindex_shadow_observations_1 (observation_id=?)'},
    {detail:'SEARCH r USING INDEX sqlite_autoindex_ingestion_runs_2'}]),true);
  const rejected=[
    [],
    [{detail:'SCAN h'}],
    [{detail:'SEARCH h USING AUTOMATIC INDEX'}],
    // The superseded O(H) plan.
    [{detail:'SEARCH o USING INDEX shadow_observation_idempotency'},{detail:'SEARCH h USING COVERING INDEX observation_heads_observation_id (observation_id=?)'},{detail:'SEARCH r USING INDEX sqlite_autoindex_ingestion_runs_2'}],
    // The pre-migration-0003 plan.
    [{detail:'SEARCH o USING INDEX shadow_observation_idempotency'},{detail:'SEARCH r USING INDEX sqlite_autoindex_ingestion_runs_2'},{detail:'SCAN h'}],
    // A repeated head pass.
    [{detail:'SCAN h USING COVERING INDEX observation_heads_observation_id'},{detail:'SCAN h USING COVERING INDEX observation_heads_observation_id'},{detail:'SEARCH o USING INDEX sqlite_autoindex_shadow_observations_1'},{detail:'SEARCH r USING INDEX sqlite_autoindex_ingestion_runs_2'}],
    // An unindexed run probe.
    [{detail:'SCAN h USING COVERING INDEX observation_heads_observation_id'},{detail:'SEARCH o USING INDEX sqlite_autoindex_shadow_observations_1'},{detail:'SCAN r'}]
  ];
  for(const rows of rejected)assert.throws(()=>validateProductionCurrentHeadsExplain(rows),/production_query_plan_mismatch/,JSON.stringify(rows));
  assert.throws(()=>buildProductionCurrentHeadsExplainRead({sourceRevisionId:''}),/source_revision_invalid/);});
