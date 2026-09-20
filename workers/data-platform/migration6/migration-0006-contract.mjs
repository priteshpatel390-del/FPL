import fs from 'node:fs';
import {createHash} from 'node:crypto';

export const MIGRATION_0006_PATH='workers/data-platform/migrations/0006_api_football_mapping_qualification.sql';
export const MIGRATION_0006_GIT_BLOB_SHA='8d1212d3cae74de13c2d15dc20ac49d4588403b9';
export const MIGRATION_0006_BYTES=6632;
export const MIGRATION_0006_VERSION=6;
export const MIGRATION_0006_NAME='api_football_mapping_qualification';
export const MIGRATION_0006_APPLIED_AT='2026-09-18T00:00:00.000Z';
export const MIGRATION_0006_STATEMENT_COUNT=12;
export const MIGRATION_0006_REQUIRED_OBJECTS=Object.freeze([
  'api_football_team_mapping_qualifications','api_football_team_mapping_members',
  'api_football_mapping_member_insert','api_football_mapping_qualification_commit',
  'api_football_mapping_qualification_immutable','api_football_mapping_member_update_immutable',
  'api_football_mapping_member_delete_immutable','api_football_team_mapping_heads',
  'api_football_mapping_head_insert','api_football_mapping_head_update','api_football_mapping_members_provider'
]);

const gitBlobSha=content=>createHash('sha1').update(`blob ${Buffer.byteLength(content,'utf8')}\\0`).update(content,'utf8').digest('hex');
const fail=code=>{throw new Error(code);};

export function splitMigration0006Sql(sql){
  if(typeof sql!=='string'||!sql)fail('migration_0006_content_invalid');
  const source=sql.replace(/^[ \\t]*--.*(?:\\r?\\n|$)/gm,'');
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
    'CREATE TABLE api_football_team_mapping_qualifications (',
    'CREATE TABLE api_football_team_mapping_members (',
    'CREATE TRIGGER api_football_mapping_member_insert',
    'CREATE TRIGGER api_football_mapping_qualification_commit',
    'CREATE TRIGGER api_football_mapping_qualification_immutable',
    'CREATE TRIGGER api_football_mapping_member_update_immutable',
    'CREATE TRIGGER api_football_mapping_member_delete_immutable',
    'CREATE TABLE api_football_team_mapping_heads (',
    'CREATE TRIGGER api_football_mapping_head_insert',
    'CREATE TRIGGER api_football_mapping_head_update',\n    'CREATE INDEX api_football_mapping_members_provider'
  ];
  for(let i=0;i<prefixes.length;i++)if(!String(statements[i]??'').startsWith(prefixes[i]))fail('migration_0006_statement_contract_invalid');
  return Object.freeze([...statements]);
}

export function readPinnedMigration0006(readFile=path=>fs.readFileSync(path,'utf8')){
  const sql=readFile(MIGRATION_0006_PATH);
  if(Buffer.byteLength(sql,'utf8')!==MIGRATION_0006_BYTES||gitBlobSha(sql)!==MIGRATION_0006_GIT_BLOB_SHA)fail('migration_0006_content_drift');
  return assertPinnedMigration0006Statements(splitMigration0006Sql(sql));
}
