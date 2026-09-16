import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'eia2i5a-d1-local-'));
const config=path.join(temp,'wrangler.jsonc');
const persist=path.join(temp,'state');
const seed=path.join(temp,'seed.sql');
const run=args=>spawnSync('npx',['--yes','wrangler@4.37.1',...args,'--config',config],{cwd:root,encoding:'utf8',env:{...process.env,NO_COLOR:'1'}});
const executeFile=file=>run(['d1','execute','teamsheet-data','--local','--persist-to',persist,'--file',file]);
try{
  fs.writeFileSync(config,JSON.stringify({name:'eia-2i5a-local',main:path.join(root,'workers/data-platform/data-platform-rpc.mjs'),compatibility_date:'2026-08-22',d1_databases:[{binding:'TEAMSHEET_DATA_DB',database_name:'teamsheet-data',database_id:'00000000-0000-0000-0000-000000000000',migrations_dir:path.join(root,'workers/data-platform/migrations')}]}));
  fs.writeFileSync(seed,`INSERT INTO canonical_entities VALUES('historical-team','team','2026-27','fpl','99','2026-09-01T00:00:00.000Z');
INSERT INTO entity_mappings VALUES('historical-mapping','official-fpl-r1','team','99','historical-team','provider_id_crosswalk','verified',NULL,NULL,'2026-09-01T00:00:00.000Z',1,NULL,'2026-09-01T00:00:00.000Z');
INSERT INTO ingestion_runs VALUES('historical-run','official-fpl-r1','official_fpl_structured_history','shadow_only','2026-09-01T00:00:00.000Z','2026-09-01T00:01:00.000Z','completed','official_fpl_public_core','parser-v1','transform-v1','schema-v1',1,1,0,0,NULL,'2026-09-01T00:00:00.000Z');
INSERT INTO shadow_observations(observation_id,logical_key,ingestion_run_id,source_revision_id,category,subject_type,subject_entity_id,metric,value_type,value_number,provenance_kind,transform_version,validation_version,input_revision,admission_state,quality_state,mode,fetched_at,created_at) VALUES('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','historical-key','historical-run','official-fpl-r1','player','team','historical-team','cost','number',1,'canonical_native_fpl','transform-v1','validation-v1','input-v1','accepted','fresh','shadow_only','2026-09-01T00:00:00.000Z','2026-09-01T00:00:00.000Z');
INSERT INTO observation_heads VALUES('historical-key','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','2026-09-01T00:00:00.000Z');
INSERT INTO observation_rejections VALUES('historical-rejection','historical-run','official-fpl-r1','schema_invalid','player','player','safe-fingerprint','2026-09-01T00:00:00.000Z');`);
  for(const file of ['workers/data-platform/migrations/0001_shadow_data_foundation.sql','workers/data-platform/migrations/0002_official_fpl_structured_history.sql','workers/data-platform/migrations/0003_production_query_plan_indexes.sql',seed,'workers/data-platform/migrations/0004_api_football_shadow_identity.sql']){
    const result=executeFile(file);assert.equal(result.status,0,`${file}\n${result.stdout}\n${result.stderr}`);
  }
  const query="SELECT (SELECT count(*) FROM data_source_revisions WHERE source_revision_id='official-fpl-r1') revision_ok,(SELECT count(*) FROM entity_mappings WHERE mapping_id='historical-mapping') mapping_ok,(SELECT count(*) FROM ingestion_runs WHERE run_id='historical-run') run_ok,(SELECT count(*) FROM shadow_observations WHERE logical_key='historical-key') observation_ok,(SELECT count(*) FROM observation_heads WHERE logical_key='historical-key') head_ok,(SELECT count(*) FROM observation_rejections WHERE rejection_id='historical-rejection') rejection_ok,(SELECT count(*) FROM pragma_foreign_key_check) fk_violations;";
  const result=run(['d1','execute','teamsheet-data','--local','--persist-to',persist,'--command',query]);
  assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`);
  for(const field of ['revision_ok','mapping_ok','run_ok','observation_ok','head_ok','rejection_ok'])assert.match(result.stdout,new RegExp(`"${field}"\\s*:\\s*1`));
  assert.match(result.stdout,/"fk_violations"\s*:\s*0/);
  process.stdout.write('EIA-2I5A Wrangler local D1 migration compatibility: PASS\n');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
