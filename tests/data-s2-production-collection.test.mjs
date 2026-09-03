import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {EXPECTED_D1_ROWS_READ_PER_CYCLE,FIRST_PRODUCTION_RUN_SCHEDULED_AT,PRODUCTION_MUTATION_DEFINITE_COMPLETED,PRODUCTION_MUTATION_NONE,PRODUCTION_MUTATION_UNKNOWN,STATIC_D1_FIXED_READ_RESERVE as RESERVE,assertCycleReadBudget,estimateStructuralCycleRowsRead,productionFailureClassification,classifyProductionFailure,FUTURE_PRODUCTION_COLLECTION_SCHEDULE,MAX_D1_API_CALLS_PER_CYCLE,MAX_D1_ROWS_READ_PER_CYCLE,MAX_D1_ROWS_WRITTEN_PER_CYCLE,OFFICIAL_FPL_ENDPOINTS,STATIC_D1_FIXED_READ_RESERVE,STATIC_D1_ROWS_PER_LOGICAL_FACT,assertStaticReadBudget,assertStaticWriteBudget,canonicalResumeExecutionTime,classifyRowsRead,validateProductionPostflight,PRODUCTION_D1_ID,runProductionCollection} from '../workers/data-platform/production-collection.mjs';
import {buildCurrentHeadsRead,buildProductionPopulationAndHeadsRead,estimateRoutineCommitRowsWritten,inspectOfficialFplD1RestPlan,MAX_ROUTINE_CHANGED_OBSERVATIONS_PER_RUN,ROUTINE_WRITE_AMPLIFICATION} from '../workers/data-platform/official-fpl-d1-rest-plan.mjs';
import {normaliseOfficialFplHistory} from '../workers/data-platform/official-fpl-canonical.mjs';
const account='production_account';const fingerprint=createHash('sha256').update(account).digest('hex');
const revision={migration_version:3,migration_name:'production_query_plan_indexes',source_revision_id:'official-fpl-r1',source_id:'source-official-fpl',revision:1,schema_version:'data-s2a-v1',rights_classification:'durable_allowed',retention_allowed:1,redistribution_allowed:0,attribution_required:0,attribution_text:null,terms_reference:'docs/DATA_SOURCES.md',terms_reviewed_at:'2026-08-26T00:00:00.000Z',acquisition_status:'approved_internal_shadow_history',shadow_ingest_allowed:1,supersedes_revision_id:null,created_at:'2026-08-26T00:00:00.000Z',source_key:'official-fpl',source_kind:'official_fpl'};
function world(){const events=Array.from({length:38},(_,i)=>({id:i+1,name:`GW ${i+1}`,deadline_time:new Date(Date.UTC(2026,7,15+i*7)).toISOString()}));const teams=Array.from({length:20},(_,i)=>({id:i+1,name:`Team ${i+1}`,short_name:`T${i+1}`,strength:1,strength_overall_home:1,strength_overall_away:1,strength_attack_home:1,strength_attack_away:1,strength_defence_home:1,strength_defence_away:1}));const elements=Array.from({length:400},(_,i)=>({id:i+1,team:i%20+1,element_type:i%4+1,web_name:`P${i}`,now_cost:50,status:'a',chance_of_playing_next_round:null,chance_of_playing_this_round:null,news:'',news_added:null,selected_by_percent:'1'}));const fixtures=Array.from({length:300},(_,i)=>({id:i+1,event:i%38+1,kickoff_time:new Date(Date.UTC(2026,8,1+i)).toISOString(),team_h:i%20+1,team_a:(i+1)%20+1,team_h_difficulty:2,team_a_difficulty:2}));return [{events,teams,elements,element_types:[{id:1},{id:2},{id:3},{id:4}]},fixtures];}
const response=value=>({status:200,arrayBuffer:async()=>new TextEncoder().encode(JSON.stringify(value)).buffer});
function harness({heads=[],ambiguousCommit=false,initialRun=null,observationCount=heads.length,postflight={},governanceRead=1,commitWritten=null,historicalObservations=null,headPopulation=null,headsRead=null,postflightRead=4}={}){const requests=[];let run=initialRun,count=observationCount,runCount=0;const transport=async request=>{requests.push(request);const body=JSON.parse(request.body),statements=body.batch??[body],sql=statements[0].sql;if(sql.includes('schema_migrations'))return ok([[revision]],governanceRead,0);if(sql.startsWith('SELECT run_id'))return ok([[...(run?[run]:[])]],1,0);if(sql.startsWith('WITH observation_state'))return ok([[{...run,run_observations:runCount,observations:count,heads:heads.length||count,logical_keys:heads.length||count,orphan_heads:0,invalid_heads:0,non_accepted:0,quarantined_observations:0,rejections:0,...postflight}]],postflightRead,0);if(sql.startsWith('SELECT o.*'))return ok([heads,[{observations:historicalObservations??count}],[{heads:headPopulation??heads.length}]],headsRead??heads.length,0);if(sql.startsWith('INSERT OR IGNORE INTO ingestion_runs')){run=started(statements[0].params[2]);return ok([[]],0,1);}if(sql.startsWith('UPDATE ingestion_runs')||statements.at(-1).sql.startsWith('UPDATE ingestion_runs')){const accepted=Number(statements.at(-1).params[2]);run={...run,status:'completed',completed_at:statements.at(-1).params[0],records_accepted:accepted,records_seen:Number(statements.at(-1).params[1])};count+=accepted;runCount=accepted;if(ambiguousCommit)throw new Error('lost response');return ok(statements.map(()=>[]),0,commitWritten??accepted*2+1);}throw new Error('unexpected');};return {requests,transport};}
const started=startedAt=>({run_id:`gha-${createHash('sha256').update(`official-fpl-r1:${startedAt}`).digest('hex').slice(0,40)}`,source_revision_id:'official-fpl-r1',run_type:'official_fpl_structured_history',mode:'shadow_only',started_at:startedAt,completed_at:null,status:'started',safe_endpoint_class:'official_fpl_public_core',parser_version:'data-s2a-official-fpl-validation-v2',transform_version:'data-s2a-official-fpl-history-v1',schema_version:'data-s2a-v1',records_seen:0,records_accepted:0,records_quarantined:0,records_rejected:0,error_class:null});
function ok(results,read,written){return {status:200,json:async()=>({success:true,result:results.map((rows,i)=>({success:true,results:rows,meta:{rows_read:i?0:read,rows_written:i?0:written,changes:0}}))})};}
const options=transport=>({accountId:account,accountFingerprint:fingerprint,databaseId:PRODUCTION_D1_ID,season:'2026-27',token:'secret',scheduledAt:'2026-09-02T01:17:00.000Z',transport,fetchImpl:async url=>response(world()[OFFICIAL_FPL_ENDPOINTS.indexOf(url)])});

test('initial activation is manual-only: PR, push and schedule cannot trigger collection',()=>{const yml=fs.readFileSync('.github/workflows/data-s2-production-collection.yml','utf8');const trigger=yml.slice(yml.indexOf('on:'),yml.indexOf('\npermissions:'));assert.match(trigger,/^on:\s+workflow_dispatch:\s*$/m);assert.doesNotMatch(trigger,/pull_request:|push:|schedule:|cron:/);assert.match(yml,/if: github\.event_name == 'workflow_dispatch'/);assert.doesNotMatch(yml,/github\.event_name == '(?:schedule|push|pull_request)'/);assert.equal(FUTURE_PRODUCTION_COLLECTION_SCHEDULE,'17 1 * * *');});
test('manual workflow retains protected environment, main checkout, least privilege and serialization',()=>{const yml=fs.readFileSync('.github/workflows/data-s2-production-collection.yml','utf8');assert.match(yml,/permissions:\s+contents: read/);assert.match(yml,/environment:\s+name: data-s2-production-collection/);assert.match(yml,/group: data-s2-production-collection\s+cancel-in-progress: false/);assert.match(yml,/ref: main/);assert.doesNotMatch(yml,/workers\/scripts|schedules|wrangler/);});
test('first-run resume is manual-only, exact-SHA gated, serialized and has no identity input',()=>{const yml=fs.readFileSync('.github/workflows/data-s2-production-resume.yml','utf8');const trigger=yml.slice(yml.indexOf('on:'),yml.indexOf('\npermissions:'));assert.match(trigger,/^on:\n  workflow_dispatch:\n    inputs:\n      approved_sha:/m);assert.deepEqual([...new Set([...yml.matchAll(/inputs\.([a-z_]+)/g)].map(row=>row[1]))],['approved_sha']);assert.doesNotMatch(trigger,/pull_request:|push:|schedule:|cron:/);assert.match(yml,/environment:\n      name: data-s2-production-collection/);assert.match(yml,/group: data-s2-production-collection\n  cancel-in-progress: false/);assert.doesNotMatch(yml,/ref: main\b/);assert.doesNotMatch(yml,/workers\/scripts|schedules|COLLECTION_SCHEDULED_AT/);const runner=fs.readFileSync('workers/data-platform/run-production-resume.mjs','utf8');assert.match(runner,/FIRST_PRODUCTION_RUN_SCHEDULED_AT/);assert.match(runner,/resumeStarted:true/);assert.doesNotMatch(runner,/process\.env\.(?:COLLECTION|RUN)/);});
test('fixed endpoints, identities, season and budgets are closed constants',()=>{assert.deepEqual([...OFFICIAL_FPL_ENDPOINTS],['https://fantasy.premierleague.com/api/bootstrap-static/','https://fantasy.premierleague.com/api/fixtures/']);assert.equal(PRODUCTION_D1_ID,'01e2b4f9-313a-4a14-8ce6-86c5aecc50d7');assert.equal(MAX_D1_API_CALLS_PER_CYCLE,8);assert.equal(EXPECTED_D1_ROWS_READ_PER_CYCLE,100000);assert.equal(MAX_D1_ROWS_READ_PER_CYCLE,125000);assert.equal(MAX_D1_ROWS_WRITTEN_PER_CYCLE,40000);assert.equal(MAX_ROUTINE_CHANGED_OBSERVATIONS_PER_RUN,4000);});
test('static read model admits accepted scale and classifies expected versus hard headroom',()=>{assert.equal(STATIC_D1_ROWS_PER_LOGICAL_FACT,7);assert.equal(assertStaticReadBudget(9860),true);assert.equal(classifyRowsRead(100000),'expected');assert.equal(classifyRowsRead(100001),'hard_ceiling_headroom');assert.throws(()=>classifyRowsRead(125001),/production_d1_read_budget_exceeded/);});
test('full baseline-shaped delta is rejected before any mutation under the routine contract',async()=>{const h=harness();await assert.rejects(runProductionCollection(options(h.transport)),/write_budget_exceeded/);assert.equal(h.requests.filter(r=>r.body.includes('INSERT OR IGNORE INTO ingestion_runs')).length,0);assert.equal(h.requests.filter(r=>r.body.includes('UPDATE ingestion_runs')).length,0);});

test('index-aware write estimator admits 4,000 and rejects 4,001 before mutation',()=>{const observations=Array.from({length:4000},(_,i)=>({logical_key:`k${i}`})),entities=Array.from({length:1064},(_,i)=>({canonical_entity_id:`e${i}`}));const estimate=estimateRoutineCommitRowsWritten({entities,previousRows:[],observations});assert.deepEqual(estimate,{freshEntities:1064,newHeads:4000,updatedHeads:0,rowsWritten:35193});assert.ok(ROUTINE_WRITE_AMPLIFICATION.startInsert+estimate.rowsWritten<MAX_D1_ROWS_WRITTEN_PER_CYCLE);assert.throws(()=>estimateRoutineCommitRowsWritten({entities:[],previousRows:[],observations:[...observations,{logical_key:'overflow'}]}),/write_budget_exceeded/);});

test('4,001 genuine deltas fail before start or commit mutation',async()=>{const data=world(),normal=normaliseOfficialFplHistory({bootstrap:data[0],fixtures:data[1],season:'2026-27',fetchedAt:'2026-09-02T01:17:00.000Z'}),heads=normal.candidates.map(row=>({...row,value_boolean:row.value_type==='boolean'?Number(row.value_boolean):row.value_boolean}));for(let i=0;i<4001;i++){const row=heads[i];heads[i]=row.value_type==='number'?{...row,value_number:Number(row.value_number)+1}:row.value_type==='boolean'?{...row,value_boolean:Number(!Boolean(Number(row.value_boolean)))}:{...row,value_text:`${row.value_text} changed`};}const h=harness({heads});await assert.rejects(runProductionCollection(options(h.transport)),/write_budget_exceeded/);assert.equal(h.requests.filter(r=>r.body.includes('INSERT OR IGNORE INTO ingestion_runs')||r.body.includes('UPDATE ingestion_runs')).length,0);});

test('static write budget rejects amplification above 40k before commit',()=>{assert.equal(assertStaticWriteBudget({providerRowsWritten:0,resumeStarted:false,writeEstimate:{rowsWritten:35193}}),true);assert.throws(()=>assertStaticWriteBudget({providerRowsWritten:0,resumeStarted:false,writeEstimate:{rowsWritten:40000}}),/production_static_write_budget_exceeded/);});

test('returned provider row metadata enforces exact hard read and write ceilings',async()=>{const costlyRead=harness({governanceRead:125001});await assert.rejects(runProductionCollection(options(costlyRead.transport)),/production_d1_budget_exceeded/);assert.equal(costlyRead.requests.length,1);const data=world(),normal=normaliseOfficialFplHistory({bootstrap:data[0],fixtures:data[1],season:'2026-27',fetchedAt:'2026-09-02T01:17:00.000Z'}),heads=normal.candidates.map(row=>({...row,value_boolean:row.value_type==='boolean'?Number(row.value_boolean):row.value_boolean}));const changed=heads.findIndex(row=>row.value_type==='number');heads[changed]={...heads[changed],value_number:Number(heads[changed].value_number)+1};const costlyWrite=harness({heads,commitWritten:40001});await assert.rejects(runProductionCollection(options(costlyWrite.transport)),/production_d1_budget_exceeded/);});

test('append-only postflight accepts historical observations above current logical-key heads',()=>{const state={run_id:'run',status:'completed',records_seen:9860,records_accepted:1,run_observations:1,records_quarantined:0,records_rejected:0,error_class:null,observations:9861,heads:9860,logical_keys:9860,orphan_heads:0,invalid_heads:0,non_accepted:0,quarantined_observations:0,rejections:0};assert.equal(validateProductionPostflight([state],{runId:'run',changed:1,recordsSeen:9860}),true);assert.equal(validateProductionPostflight([{...state,records_accepted:0,run_observations:0}],{runId:'run',changed:0,recordsSeen:9860}),true);});

test('postflight fails closed for ownership, head, orphan, retained, quarantine, rejection and run defects',()=>{const base={run_id:'run',status:'completed',records_seen:10,records_accepted:1,run_observations:1,records_quarantined:0,records_rejected:0,error_class:null,observations:11,heads:10,logical_keys:10,orphan_heads:0,invalid_heads:0,non_accepted:0,quarantined_observations:0,rejections:0};for(const defect of [{run_observations:2},{logical_keys:9},{orphan_heads:1},{invalid_heads:1},{non_accepted:1},{quarantined_observations:1},{rejections:1},{status:'started'},{error_class:'x'}])assert.throws(()=>validateProductionPostflight([{...base,...defect}],{runId:'run',changed:1,recordsSeen:10}),/production_postflight_mismatch/);});

test('resume execution timestamp remains independent, canonical and later than immutable identity time',()=>{assert.equal(canonicalResumeExecutionTime(new Date('2026-09-02T18:09:10.123Z'),FIRST_PRODUCTION_RUN_SCHEDULED_AT),'2026-09-02T18:09:10.123Z');for(const time of [FIRST_PRODUCTION_RUN_SCHEDULED_AT,'2026-09-02T17:40:00.000Z','invalid'])assert.throws(()=>canonicalResumeExecutionTime(time,FIRST_PRODUCTION_RUN_SCHEDULED_AT),/production_resume_execution_time_invalid/);assert.equal(started(FIRST_PRODUCTION_RUN_SCHEDULED_AT).started_at,FIRST_PRODUCTION_RUN_SCHEDULED_AT);});
test('append-only changed and subsequent unchanged cycles retain synchronous postflight',async()=>{const data=world(),normal=normaliseOfficialFplHistory({bootstrap:data[0],fixtures:data[1],season:'2026-27',fetchedAt:'2026-09-02T01:17:00.000Z'});const heads=normal.candidates.map(row=>({...row,value_boolean:row.value_type==='boolean'?Number(row.value_boolean):row.value_boolean}));const changed=heads.findIndex(row=>row.value_type==='number');heads[changed]={...heads[changed],value_number:Number(heads[changed].value_number)+1};const first=harness({heads});const result=await runProductionCollection(options(first.transport));assert.equal(result.changed,1);assert.equal(result.state.observations,heads.length+1);assert.equal(result.state.heads,heads.length);assert.ok(first.requests.some(r=>r.body.includes('WITH observation_state')));const laterHeads=normal.candidates.map(row=>({...row,value_boolean:row.value_type==='boolean'?Number(row.value_boolean):row.value_boolean}));const later=harness({heads:laterHeads,observationCount:heads.length+1});const unchanged=await runProductionCollection({...options(later.transport),scheduledAt:'2026-09-02T02:17:00.000Z'});assert.equal(unchanged.result,'unchanged');assert.equal(unchanged.state.observations,heads.length+1);});


const facts=()=>{const data=world();const normal=normaliseOfficialFplHistory({bootstrap:data[0],fixtures:data[1],season:'2026-27',fetchedAt:'2026-09-02T01:17:00.000Z'});return normal.candidates.map(row=>({...row,value_boolean:row.value_type==='boolean'?Number(row.value_boolean):row.value_boolean}));};
const mutate=(heads,count)=>{const copy=heads.map(row=>({...row}));for(let i=0;i<count;i++){const row=copy[i];copy[i]=row.value_type==='number'?{...row,value_number:Number(row.value_number)+1}:row.value_type==='boolean'?{...row,value_boolean:Number(!Boolean(Number(row.value_boolean)))}:{...row,value_text:`${row.value_text} changed`};}return copy;};

test('structural read model reconciles with the established 7N baseline when history equals current facts',()=>{
  const n=9860,baseline=estimateStructuralCycleRowsRead({observations:n,heads:n,changed:0});
  assert.equal(baseline.cycleRows,n*STATIC_D1_ROWS_PER_LOGICAL_FACT+RESERVE);
  assert.equal(baseline.cycleRows,69084);
  assert.equal(baseline.populationProbe,2*n);
  assert.equal(baseline.totalRows,baseline.populationProbe+baseline.cycleRows);
  assert.equal(assertCycleReadBudget({rowsReadSoFar:0,estimate:baseline}).classification,'expected');
});

test('append-only history above current heads raises the structural estimate independently of fact count',()=>{
  const n=9860,flat=estimateStructuralCycleRowsRead({observations:n,heads:n,changed:0});
  const grown=estimateStructuralCycleRowsRead({observations:n*3,heads:n,changed:0});
  assert.ok(grown.totalRows>flat.totalRows);
  assert.equal(grown.heads,flat.heads);
  assert.equal(grown.totalRows-flat.totalRows,5*(n*3-n));
  assert.throws(()=>assertCycleReadBudget({rowsReadSoFar:0,estimate:estimateStructuralCycleRowsRead({observations:200000,heads:n,changed:0})}),/production_cycle_read_budget_exceeded/);
  assert.throws(()=>assertCycleReadBudget({rowsReadSoFar:MAX_D1_ROWS_READ_PER_CYCLE,estimate:flat}),/production_cycle_read_budget_exceeded/);
  for(const bad of [{observations:-1,heads:0,changed:0},{observations:0,heads:1.5,changed:0},{observations:0,heads:0,changed:-1}])assert.throws(()=>estimateStructuralCycleRowsRead(bad),/production_structural_read_model_invalid/);
});

test('grown append-only history rejects before start and commit even when the fact count is unchanged',async()=>{
  const heads=facts(),h=harness({heads:mutate(heads,1),historicalObservations:200000,headPopulation:heads.length,headsRead:1});
  await assert.rejects(runProductionCollection(options(h.transport)),error=>{
    assert.match(String(error.message),/production_cycle_read_budget_exceeded/);
    assert.equal(productionFailureClassification(error).mutation,PRODUCTION_MUTATION_NONE);
    return true;});
  assert.equal(h.requests.filter(r=>r.body.includes('INSERT OR IGNORE INTO ingestion_runs')).length,0);
  assert.equal(h.requests.filter(r=>r.body.includes('UPDATE ingestion_runs')).length,0);
  const same=harness({heads:mutate(heads,1),historicalObservations:heads.length,headPopulation:heads.length});
  assert.equal((await runProductionCollection(options(same.transport))).changed,1);
});

test('history cardinality is counted directly and can never be inferred from ingestion-run ledger totals',async()=>{
  const plan=inspectOfficialFplD1RestPlan(buildProductionPopulationAndHeadsRead({sourceRevisionId:'official-fpl-r1'}));
  assert.equal(plan.statements.length,3);
  assert.equal(plan.statements[0].sql,inspectOfficialFplD1RestPlan(buildCurrentHeadsRead({sourceRevisionId:'official-fpl-r1'})).statements[0].sql);
  assert.equal(plan.statements[1].sql,'SELECT COUNT(*) AS observations FROM shadow_observations WHERE source_revision_id=?');
  assert.equal(plan.statements[2].sql,'SELECT COUNT(*) AS heads FROM observation_heads');
  for(const statement of plan.statements.slice(1))assert.doesNotMatch(statement.sql,/ingestion_runs|records_accepted|SUM\(/);
  const source=fs.readFileSync('workers/data-platform/production-collection.mjs','utf8');
  assert.match(source,/historicalObservations=population\(populationAndHeads,1,'observations'\)/);
  assert.doesNotMatch(source,/records_accepted[^)]*historical|historicalObservations=[^;]*records_accepted/);
  const heads=facts(),ledgerUnderstated=harness({heads:mutate(heads,1),historicalObservations:200000,headPopulation:heads.length,headsRead:1,initialRun:null});
  await assert.rejects(runProductionCollection(options(ledgerUnderstated.transport)),/production_cycle_read_budget_exceeded/);
  for(const contract of [[[{}],[{heads:1}]],[[{observations:-1}],[{heads:1}]]]){
    const broken=harness({heads:mutate(heads,1)});
    const inner=broken.transport;
    broken.transport=async request=>{const out=await inner(request);const body=JSON.parse(request.body);if((body.batch??[body])[0].sql.startsWith('SELECT o.*'))return {status:200,json:async()=>{const payload=await out.json();payload.result[1].results=contract[0];payload.result[2].results=contract[1];return payload;}};return out;};
    await assert.rejects(runProductionCollection(options(broken.transport)),/production_population_contract_invalid/);
  }
});

test('the population probe shares the current-head request and stays inside the API-call ceiling',async()=>{
  const heads=facts(),normal=harness({heads:mutate(heads,1)});
  const result=await runProductionCollection(options(normal.transport));
  assert.equal(result.population.historicalObservations,heads.length);
  assert.equal(result.population.currentHeads,heads.length);
  assert.equal(result.population.structuralRowsRead,estimateStructuralCycleRowsRead({observations:heads.length,heads:heads.length,changed:1}).totalRows);
  const probe='SELECT COUNT(*) AS observations FROM shadow_observations WHERE source_revision_id=?';
  assert.equal(normal.requests.filter(r=>r.body.includes(probe)).length,1);
  assert.equal(normal.requests.filter(r=>r.body.includes('SELECT o.*')&&r.body.includes(probe)&&r.body.includes('SELECT COUNT(*) AS heads FROM observation_heads')).length,1);
  assert.ok(result.d1.apiCalls<=MAX_D1_API_CALLS_PER_CYCLE);
  const ambiguous=harness({heads:mutate(heads,1),ambiguousCommit:true});
  const reconciled=await runProductionCollection(options(ambiguous.transport));
  assert.equal(reconciled.result,'changed_reconciled');
  assert.ok(reconciled.d1.apiCalls<=MAX_D1_API_CALLS_PER_CYCLE);
});

test('postflight resource overage after a definite successful commit is never reported as no-write or retryable',async()=>{
  const heads=facts(),h=harness({heads:mutate(heads,1),postflightRead:MAX_D1_ROWS_READ_PER_CYCLE+1});
  await assert.rejects(runProductionCollection(options(h.transport)),error=>{
    const classification=productionFailureClassification(error);
    assert.equal(classification.mutation,PRODUCTION_MUTATION_DEFINITE_COMPLETED);
    assert.equal(classification.phase,'postflight_read');
    assert.equal(classification.retryable,false);
    assert.notEqual(classification.mutation,PRODUCTION_MUTATION_NONE);
    return true;});
  assert.equal(h.requests.filter(r=>r.body.includes('WITH observation_state')).length,1);
  const mismatch=harness({heads:mutate(heads,1),postflight:{orphan_heads:1}});
  await assert.rejects(runProductionCollection(options(mismatch.transport)),error=>{
    const classification=productionFailureClassification(error);
    assert.equal(classification.mutation,PRODUCTION_MUTATION_DEFINITE_COMPLETED);
    assert.equal(classification.phase,'postflight_acceptance');
    return true;});
  const unknown=harness({heads:mutate(heads,1),ambiguousCommit:true,postflight:{records_accepted:0}});
  await assert.rejects(runProductionCollection(options(unknown.transport)),error=>{
    assert.equal(productionFailureClassification(error).mutation,PRODUCTION_MUTATION_DEFINITE_COMPLETED);
    return true;});
});

test('redispatch cannot create a second run, retry blindly, or claim success without postflight',async()=>{
  const heads=facts(),completed={...started('2026-09-02T01:17:00.000Z'),status:'completed',completed_at:'2026-09-02T01:20:00.000Z',records_seen:heads.length,records_accepted:0};
  const h=harness({heads,initialRun:completed});
  await assert.rejects(runProductionCollection(options(h.transport)),error=>{
    assert.match(String(error.message),/production_run_already_completed/);
    assert.equal(productionFailureClassification(error).mutation,PRODUCTION_MUTATION_NONE);
    return true;});
  assert.equal(h.requests.filter(r=>r.body.includes('INSERT OR IGNORE INTO ingestion_runs')).length,0);
  const runner=fs.readFileSync('workers/data-platform/run-production-resume.mjs','utf8');
  assert.match(runner,/GITHUB_RUN_ATTEMPT!=='1'\)throw new Error\('workflow_retry_forbidden'\)/);
  assert.match(runner,/productionFailureClassification\(error\)/);
  assert.match(runner,/DATA-S2 first-run resume STOPPED/);
  assert.match(runner,/if\(process\.env\.GITHUB_STEP_SUMMARY\)fs\.appendFileSync/);
  assert.equal(productionFailureClassification({productionMutation:PRODUCTION_MUTATION_UNKNOWN,productionPhase:'commit_dispatch',code:'d1_http_failed'}).code,'d1_http_failed');
  const collection=fs.readFileSync('workers/data-platform/production-collection.mjs','utf8');
  for(const phase of ['start_dispatch','start_reconciliation','commit_dispatch','commit_reconciliation'])assert.match(collection,new RegExp(`PRODUCTION_MUTATION_UNKNOWN,'${phase}'`));
  for(const phase of ['commit_resource','postflight_read','postflight_acceptance','postflight_report'])assert.match(collection,new RegExp(`PRODUCTION_MUTATION_DEFINITE_COMPLETED,'${phase}'`));
  assert.doesNotMatch(collection,/catch\(error\)\{if\(error\?\.code!=='d1_mutation_outcome_unknown'\)throw error;/);
  assert.equal(productionFailureClassification(new Error('Bearer super-secret leaked')).code,'unclassified');
});

test('wrong fingerprint, D1 and season fail before dispatch without credential output',async()=>{const h=harness();for(const changed of [{accountFingerprint:'0'.repeat(64)},{databaseId:'wrong'},{season:'2025-26'}])await assert.rejects(runProductionCollection({...options(h.transport),...changed}),error=>{assert.doesNotMatch(String(error),/secret|production_account$/);return true;});assert.equal(h.requests.length,0);});

/* --------- unknown commit outcome: the read-back may never downgrade to "no mutation" --------- */

// A transport whose commit response is lost and whose single post-commit read-back then fails in
// the named way. Once the commit has been issued, no later failure may report the run as a
// no-write, and there is never a second mutation or a retry of the read-back.
function lostCommit(readBackFailure){
  const requests=[],heads=mutate(facts(),1);let run=null,committed=false;
  const transport=async request=>{
    requests.push(request);
    const body=JSON.parse(request.body),statements=body.batch??[body],sql=statements[0].sql;
    if(sql.includes('schema_migrations'))return ok([[revision]],1,0);
    if(sql.startsWith('SELECT run_id')){
      if(!committed)return ok([[...(run?[run]:[])]],1,0);
      return readBackFailure();
    }
    if(sql.startsWith('SELECT o.*'))return ok([heads,[{observations:heads.length}],[{heads:heads.length}]],heads.length,0);
    if(sql.startsWith('INSERT OR IGNORE INTO ingestion_runs')){run=started(statements[0].params[2]);return ok([[]],0,1);}
    if(sql.startsWith('UPDATE ingestion_runs')||statements.at(-1).sql.startsWith('UPDATE ingestion_runs')){
      committed=true;throw new Error('lost response');
    }
    throw new Error('unexpected');
  };
  return {requests,transport,
    commits:()=>requests.filter(r=>r.body.includes('UPDATE ingestion_runs')).length,
    readBacks:()=>requests.filter(r=>JSON.parse(r.body).sql?.startsWith('SELECT run_id')).length};
}

const lostCommitCases=[
  ['read-back transport failure',()=>{throw new Error('network down');}],
  ['malformed read-back response',()=>({status:200,json:async()=>({success:true,result:[]})})],
  ['read-back provider accounting failure',()=>({status:200,json:async()=>({success:true,
    result:[{success:true,results:[],meta:{rows_read:'many',rows_written:0,changes:0}}]})})],
  ['read-back resource ceiling failure',()=>ok([[]],MAX_D1_ROWS_READ_PER_CYCLE+1,0)],
  ['read-back HTTP failure',()=>({status:500,json:async()=>({success:false})})]
];

for(const [name,failure] of lostCommitCases)
  test(`a lost commit response followed by ${name} stays unknown, never a no-write`,async()=>{
    const h=lostCommit(failure);
    await assert.rejects(runProductionCollection(options(h.transport)),error=>{
      const classification=productionFailureClassification(error);
      assert.equal(classification.mutation,PRODUCTION_MUTATION_UNKNOWN);
      assert.notEqual(classification.mutation,PRODUCTION_MUTATION_NONE);
      assert.equal(classification.phase,'commit_reconciliation');
      assert.equal(classification.retryable,false);
      return true;});
    // Exactly one commit mutation, exactly one post-commit read-back, and no second mutation.
    assert.equal(h.commits(),1);
    assert.equal(h.readBacks(),2);
  });

test('the outer wrapper never downgrades a carried unknown mutation classification',()=>{
  // classifyProductionFailure keeps the first classification an error carries, which is exactly
  // what runProductionCollection's outer catch relies on.
  const carried=classifyProductionFailure(new Error('d1_transport_failed'),PRODUCTION_MUTATION_UNKNOWN,'commit_reconciliation');
  const rewrapped=classifyProductionFailure(carried,PRODUCTION_MUTATION_NONE);
  assert.equal(rewrapped,carried);
  assert.equal(rewrapped.productionMutation,PRODUCTION_MUTATION_UNKNOWN);
  assert.equal(rewrapped.productionPhase,'commit_reconciliation');
  assert.equal(productionFailureClassification(rewrapped).mutation,PRODUCTION_MUTATION_UNKNOWN);
  // The read-back is classified inside the unknown-commit branch, before it can escape.
  const source=fs.readFileSync('workers/data-platform/production-collection.mjs','utf8');
  assert.match(source,/try\{reconciled=rows\(await readRun\(\)\);\}\n\s*catch\(error\)\{throw classifyProductionFailure\(error,PRODUCTION_MUTATION_UNKNOWN,'commit_reconciliation'\);\}/);
});
