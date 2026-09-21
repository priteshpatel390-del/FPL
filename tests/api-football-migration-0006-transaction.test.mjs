import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {canonicalise,stableStringify} from '../src/decision-intelligence/canonical.mjs';
import {
  API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_INTEGRITY_HASH,API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_OBSERVED_AT,
  API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_REVISION,API_FOOTBALL_OWNER_CROSSWALK_HASH,
  API_FOOTBALL_OWNER_QUALIFICATION_INTEGRITY_HASH,API_FOOTBALL_OWNER_REVIEWED_AT,API_FOOTBALL_OWNER_REVIEW_REFERENCE
} from '../src/decision-intelligence/api-football-owner-mapping.mjs';
import {
  API_FOOTBALL_MAPPING_PERSISTENCE_KIND,API_FOOTBALL_MAPPING_SOURCE_REVISION_ID,
  persistQualifiedTeamMappingPlan,readQualifiedTeamMappings
} from '../workers/api-football-collector/mapping-persistence.mjs';

const migrations=Array.from({length:6},(_,index)=>{
  const prefix=String(index+1).padStart(4,'0')+'_';
  return 'workers/data-platform/migrations/'+fs.readdirSync('workers/data-platform/migrations').find(name=>name.startsWith(prefix));
});
const hash=value=>createHash('sha256').update(String(value)).digest('hex');
const quote=value=>value===null?'NULL':typeof value==='number'?String(value):`'${String(value).replaceAll("'","''")}'`;
const bind=(sql,params)=>{let index=0;const out=sql.replaceAll('?',()=>quote(params[index++]));assert.equal(index,params.length);return out;};
const sqlite=(database,sql)=>{
  const result=spawnSync('sqlite3',['-json',database],{input:`.bail on\nPRAGMA foreign_keys=ON;\n${sql}`,encoding:'utf8'});
  if(result.status!==0)throw new Error('sqlite_test_failure');
  return result.stdout.trim()?JSON.parse(result.stdout):[];
};

function migratedDatabase(){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'migration-0006-'));
  const database=path.join(directory,'test.db');
  for(const migration of migrations)sqlite(database,fs.readFileSync(migration,'utf8'));
  for(let id=1;id<=20;id+=1)sqlite(database,`INSERT INTO canonical_entities VALUES('2026-27:fpl:team:${id}','team','2026-27','fpl','${id}','2026-09-21T00:00:00.000Z');`);
  return {database,close:()=>fs.rmSync(directory,{recursive:true,force:true})};
}

function sqliteAdapter(database,{failRole=null}={}){
  const prepared=(sql,params=[])=>({sql,params,bind(...values){return prepared(sql,values);},async first(){return sqlite(database,bind(sql,params))[0]??null;},async all(){return {results:sqlite(database,bind(sql,params))};}});
  return {prepare:sql=>prepared(sql),async batch(input){
    const statements=input.map(row=>({sql:row.sql,params:[...row.params]}));
    if(failRole==='entity')statements[0].params[4]='2026-27:fpl:team:999';
    if(failRole==='qualification')statements[20].params[3]='missing-source-revision';
    if(failRole==='member')statements[21].params[4]='short';
    if(failRole==='head')statements[42].params[1]='missing-qualification';
    const script=`BEGIN IMMEDIATE;\n${statements.map(row=>bind(row.sql,row.params)+';').join('\n')}\nCOMMIT;`;
    sqlite(database,script);return [];
  }};
}

function plan({breakCommitAnchor=false}={}){
  const rows=[];
  for(let id=1;id<=20;id+=1){
    const providerTeamId=String(id===6?(breakCommitAnchor?249:49):id===13?63:200+id);
    const canonicalFplTeamId=`2026-27:fpl:team:${id}`;
    const mappingBasis=canonicalise({sourceRevisionId:API_FOOTBALL_MAPPING_SOURCE_REVISION_ID,providerEntityType:'team',providerEntityId:providerTeamId,canonicalEntityId:canonicalFplTeamId,mappingVersion:1});
    rows.push({mappingId:'api-football:team-mapping:'+hash(stableStringify(mappingBasis)),providerTeamId,canonicalFplTeamId,mappingMethod:'manually_verified',mappingVersion:1,receiptIntegrityHash:hash('receipt-'+id),verifiedAt:API_FOOTBALL_OWNER_REVIEWED_AT});
  }
  rows.sort((left,right)=>left.canonicalFplTeamId.localeCompare(right.canonicalFplTeamId));
  const values={kind:API_FOOTBALL_MAPPING_PERSISTENCE_KIND,fplSeason:'2026-27',sourceRevisionId:API_FOOTBALL_MAPPING_SOURCE_REVISION_ID,
    approvalQualificationIntegrityHash:API_FOOTBALL_OWNER_QUALIFICATION_INTEGRITY_HASH,currentQualificationIntegrityHash:API_FOOTBALL_OWNER_QUALIFICATION_INTEGRITY_HASH,
    crosswalkIntegrityHash:API_FOOTBALL_OWNER_CROSSWALK_HASH,providerUniverseRevision:API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_REVISION,
    providerUniverseIntegrityHash:API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_INTEGRITY_HASH,providerUniverseObservedAt:API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_OBSERVED_AT,
    ownerReviewReference:API_FOOTBALL_OWNER_REVIEW_REFERENCE,ownerReviewedAt:API_FOOTBALL_OWNER_REVIEWED_AT,
    officialFplAuthorityDigest:hash('authority'),officialFplAuthorityFetchedAt:'2026-09-21T10:15:04.848Z'};
  const basis=canonicalise({...values,rows:rows.map(row=>({providerTeamId:row.providerTeamId,canonicalFplTeamId:row.canonicalFplTeamId,mappingMethod:row.mappingMethod,mappingVersion:row.mappingVersion,receiptIntegrityHash:row.receiptIntegrityHash}))});
  const persistenceIntegrityHash=hash(stableStringify(basis));
  return {...values,ok:true,persistenceIntegrityHash,qualificationId:`api-football:team-mapping:2026-27:${persistenceIntegrityHash}`,createdAt:'2026-09-21T10:15:05.000Z',rows};
}

const counts=database=>sqlite(database,"SELECT (SELECT COUNT(*) FROM entity_mappings WHERE source_revision_id='api-football:eia-2i5a:1') entity_mappings,(SELECT COUNT(*) FROM api_football_team_mapping_qualifications) qualifications,(SELECT COUNT(*) FROM api_football_team_mapping_members) members,(SELECT COUNT(*) FROM api_football_team_mapping_heads) heads")[0];

test('complete private mapping persists as one 43-statement transaction through migration 0006',async()=>{
  const fixture=migratedDatabase();try{
    const db=sqliteAdapter(fixture.database),expected=plan(),result=await persistQualifiedTeamMappingPlan(db,expected);
    const verified=await readQualifiedTeamMappings(db,{season:'2026-27'});
    assert.equal(result.ok,true,JSON.stringify({result,verified}));assert.equal(result.result,'committed');
    assert.deepEqual(counts(fixture.database),{entity_mappings:20,qualifications:1,members:20,heads:1});
    assert.equal(verified.ok,true);assert.equal(verified.persistenceIntegrityHash,expected.persistenceIntegrityHash);
  }finally{fixture.close();}
});

for(const role of ['entity','qualification','member','commit','head'])test(`failure at ${role} role rolls back all 43 statements`,async()=>{
  const fixture=migratedDatabase();try{
    const expected=plan({breakCommitAnchor:role==='commit'}),result=await persistQualifiedTeamMappingPlan(sqliteAdapter(fixture.database,{failRole:role==='commit'?null:role}),expected);
    assert.equal(result.ok,false);assert.equal(result.reason,'mapping_persistence_failed');
    assert.deepEqual(counts(fixture.database),{entity_mappings:0,qualifications:0,members:0,heads:0});
    assert.deepEqual(sqlite(fixture.database,'PRAGMA foreign_key_check'),[]);
  }finally{fixture.close();}
});
