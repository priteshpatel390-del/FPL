import fs from 'node:fs';
import {createHash} from 'node:crypto';

export const MIGRATION_0006_PATH='workers/data-platform/migrations/0006_api_football_mapping_qualification.sql';
export const MIGRATION_0006_GIT_BLOB_SHA='8d1212d3cae74de13c2d15dc20ac49d4588403b9';
export const MIGRATION_0006_BYTES=6632;
export const MIGRATION_0006_VERSION=6;
export const MIGRATION_0006_NAME='api_football_mapping_qualification';
export const MIGRATION_0006_APPLIED_AT='2026-09-18T00:00:00.000Z';
export const MIGRATION_0006_STATEMENT_COUNT=12;
export const MIGRATION_0006_PRIOR_LEDGER=Object.freeze([
  [1,'shadow_data_foundation'],[2,'official_fpl_structured_history'],[3,'production_query_plan_indexes'],
  [4,'api_football_shadow_identity'],[5,'api_football_shadow_runtime']
]);
export const MIGRATION_0006_REQUIRED_OBJECTS=Object.freeze([
  ['table','api_football_team_mapping_qualifications','api_football_team_mapping_qualifications'],
  ['table','api_football_team_mapping_members','api_football_team_mapping_members'],
  ['trigger','api_football_mapping_member_insert','api_football_team_mapping_members'],
  ['trigger','api_football_mapping_qualification_commit','api_football_team_mapping_qualifications'],
  ['trigger','api_football_mapping_qualification_immutable','api_football_team_mapping_qualifications'],
  ['trigger','api_football_mapping_member_update_immutable','api_football_team_mapping_members'],
  ['trigger','api_football_mapping_member_delete_immutable','api_football_team_mapping_members'],
  ['table','api_football_team_mapping_heads','api_football_team_mapping_heads'],
  ['trigger','api_football_mapping_head_insert','api_football_team_mapping_heads'],
  ['trigger','api_football_mapping_head_update','api_football_team_mapping_heads'],
  ['index','api_football_mapping_members_provider','api_football_team_mapping_members']
]);
export const MIGRATION_0006_EXACT_PRE='exact_0005_pre_state';
export const MIGRATION_0006_EXACT_POST_EMPTY='exact_0006_schema_empty';
export const MIGRATION_0006_POST_WITH_MAPPING='exact_0006_mapping_present';
export const MIGRATION_0006_INCONSISTENT='inconsistent';

const gitBlobSha=content=>createHash('sha1').update(`blob ${Buffer.byteLength(content,'utf8')}\0`).update(content,'utf8').digest('hex');
const fail=code=>{throw new Error(code);};

export function splitMigration0006Sql(sql){
  if(typeof sql!=='string'||!sql)fail('migration_0006_content_invalid');
  const source=sql.replace(/^[ \t]*--.*(?:\r?\n|$)/gm,'');
  const statements=[];let buffer='',quote=null,trigger=false;
  for(let index=0;index<source.length;index+=1){
    const char=source[index];
    if(quote!==null){buffer+=char;if(char===quote){if(source[index+1]===quote)buffer+=source[++index];else quote=null;}continue;}
    if(char==="'"||char==='"'){quote=char;buffer+=char;continue;}
    buffer+=char;
    if(!trigger&&buffer.trimStart().toUpperCase().startsWith('CREATE TRIGGER'))trigger=true;
    if(char===';'){
      const candidate=buffer.slice(0,-1).trim();
      if(!trigger||candidate.toUpperCase().endsWith('END')){if(candidate)statements.push(candidate);buffer='';trigger=false;}
    }
  }
  if(quote!==null||buffer.trim())fail('migration_0006_statement_contract_invalid');
  return Object.freeze(statements);
}

export function assertPinnedMigration0006Statements(statements){
  if(!Array.isArray(statements)||statements.length!==MIGRATION_0006_STATEMENT_COUNT)fail('migration_0006_statement_contract_invalid');
  const prefixes=[
    'INSERT INTO schema_migrations (version, name, applied_at)',
    'CREATE TABLE api_football_team_mapping_qualifications (','CREATE TABLE api_football_team_mapping_members (',
    'CREATE TRIGGER api_football_mapping_member_insert','CREATE TRIGGER api_football_mapping_qualification_commit',
    'CREATE TRIGGER api_football_mapping_qualification_immutable','CREATE TRIGGER api_football_mapping_member_update_immutable',
    'CREATE TRIGGER api_football_mapping_member_delete_immutable','CREATE TABLE api_football_team_mapping_heads (',
    'CREATE TRIGGER api_football_mapping_head_insert','CREATE TRIGGER api_football_mapping_head_update',
    'CREATE INDEX api_football_mapping_members_provider'
  ];
  for(let i=0;i<prefixes.length;i++)if(!String(statements[i]??'').startsWith(prefixes[i]))fail('migration_0006_statement_contract_invalid');
  const triggers=statements.filter(statement=>statement.startsWith('CREATE TRIGGER'));
  if(triggers.length!==7||triggers.some(statement=>!statement.trimEnd().toUpperCase().endsWith('END')))fail('migration_0006_statement_contract_invalid');
  return Object.freeze([...statements]);
}

export function readPinnedMigration0006(readFile=path=>fs.readFileSync(path,'utf8')){
  const sql=readFile(MIGRATION_0006_PATH);
  if(Buffer.byteLength(sql,'utf8')!==MIGRATION_0006_BYTES||gitBlobSha(sql)!==MIGRATION_0006_GIT_BLOB_SHA)fail('migration_0006_content_drift');
  return assertPinnedMigration0006Statements(splitMigration0006Sql(sql));
}

const number=value=>{const parsed=Number(value);if(!Number.isSafeInteger(parsed)||parsed<0)fail('migration_0006_state_invalid');return parsed;};
export function classifyMigration0006State({ledger,objects,mappingCounts}){
  if(!Array.isArray(ledger)||!Array.isArray(objects))return MIGRATION_0006_INCONSISTENT;
  const exactPrior=MIGRATION_0006_PRIOR_LEDGER.every(([version,name],index)=>Number(ledger[index]?.version)===version&&ledger[index]?.name===name);
  if(!exactPrior)return MIGRATION_0006_INCONSISTENT;
  const sixth=ledger[5];
  const keys=new Set(objects.map(row=>`${row.type}:${row.name}:${row.tbl_name}`));
  const required=MIGRATION_0006_REQUIRED_OBJECTS.every(([type,name,table])=>keys.has(`${type}:${name}:${table}`));
  const any=MIGRATION_0006_REQUIRED_OBJECTS.some(([type,name,table])=>keys.has(`${type}:${name}:${table}`));
  if(ledger.length===5&&!any)return MIGRATION_0006_EXACT_PRE;
  if(ledger.length!==6||Number(sixth?.version)!==6||sixth?.name!==MIGRATION_0006_NAME||sixth?.applied_at!==MIGRATION_0006_APPLIED_AT||!required)
    return MIGRATION_0006_INCONSISTENT;
  const counts=mappingCounts??{};
  const qualifications=number(counts.qualifications),members=number(counts.members),heads=number(counts.heads);
  if(qualifications===0&&members===0&&heads===0)return MIGRATION_0006_EXACT_POST_EMPTY;
  if(qualifications===1&&members===20&&heads===1)return MIGRATION_0006_POST_WITH_MAPPING;
  return MIGRATION_0006_INCONSISTENT;
}
