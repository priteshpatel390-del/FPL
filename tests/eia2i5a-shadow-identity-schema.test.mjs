import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {
  apiFootballCompetitionRegistry,apiFootballFixtureIdentity,apiFootballPlayerIdentity,apiFootballTeamIdentity,candidatePlayerMapping,
  crossSourceQualify,deterministicRevision,normalizeParticipation,qualifyProviderFixture,resolveFieldObservations,validateProviderMapping
} from '../src/decision-intelligence/api-football-shadow-contracts.mjs';
import {rightsAdmission} from '../workers/data-platform/data-platform-core.mjs';

const season='2026-27';
const team=(providerEntityId,canonicalFplId,status='VERIFIED',mappedSeason=season)=>({provider:'api-football',entityType:'team',providerEntityId:String(providerEntityId),canonicalFplId,mappingRevision:'r1',revision:1,status,season:mappedSeason,method:'manually_verified',provenance:'owner-reviewed'});
const fixture=(overrides={})=>({season,providerFixtureId:'1636205',providerLeagueId:'48',canonicalCompetitionId:'league_cup',providerHomeTeamId:'10',providerAwayTeamId:'20',...overrides});
const maps=[team(10,`${season}:fpl:team:1`),team(20,`${season}:fpl:team:12`)];
const sqlite=(db,input)=>spawnSync('sqlite3',[db],{input,encoding:'utf8'});

test('competition registry is exact, season-scoped, provider-specific and disabled',()=>{
  const rows=apiFootballCompetitionRegistry(season);assert.deepEqual(rows.map(row=>row.providerLeagueId),['2','3','848','45','48']);
  assert.ok(rows.every(row=>row.season===season&&row.provider==='api-football'&&!row.liveCollectionEnabled&&row.registryVersion===1));
  assert.throws(()=>apiFootballCompetitionRegistry('2026'),/season_invalid/);
});

test('provider fixture identity is stable across mutable metadata and revisions deterministic',async()=>{
  assert.equal(apiFootballFixtureIdentity(fixture({kickoff:'2026-09-01T19:00:00Z'})),apiFootballFixtureIdentity(fixture({kickoff:'2026-09-01T19:15:00Z',venue:'Elsewhere'})));
  assert.equal(apiFootballFixtureIdentity(fixture()),'2026-27:api-football:fixture:1636205');
  assert.equal(await deterministicRevision('fixture',fixture()),await deterministicRevision('fixture',{...fixture()}));
  assert.notEqual(await deterministicRevision('fact',{kickoff:'19:00'}),await deterministicRevision('fact',{kickoff:'19:15'}));
});

test('team mappings require exact current-season verified identity',()=>{
  assert.equal(validateProviderMapping(maps[0],{entityType:'team',season}).ok,true);
  assert.equal(validateProviderMapping(team(10,'2025-26:fpl:team:1','VERIFIED','2025-26'),{entityType:'team',season}).ok,false);
  for(const status of ['UNMAPPED','CANDIDATE','AMBIGUOUS','CONFLICTED'])assert.equal(validateProviderMapping(team(10,`${season}:fpl:team:1`,status),{entityType:'team',season}).ok,false);
  assert.equal(validateProviderMapping({...maps[0],displayName:'Chelsea',canonicalFplId:null},{entityType:'team',season}).ok,false);
});

test('player identity survives transfer and exact-name evidence only creates candidate',()=>{
  assert.equal(apiFootballPlayerIdentity(7),apiFootballPlayerIdentity('7'));
  const one=candidatePlayerMapping({providerPlayerId:7,season,normalizedFullName:'alex smith',providerTeamMapping:maps[0],canonicalTeamId:maps[0].canonicalFplId});
  assert.equal(one.status,'CANDIDATE');assert.equal(one.playerIdentity,'api-football:player:7');
  assert.equal(candidatePlayerMapping({providerPlayerId:7,season,normalizedFullName:'alex smith',providerTeamMapping:{...maps[0],status:'CANDIDATE'},canonicalTeamId:maps[0].canonicalFplId}).ok,false);
  assert.equal(candidatePlayerMapping({providerPlayerId:7,season,normalizedFullName:'alex smith',providerTeamMapping:{...maps[0],method:'name_guess'},canonicalTeamId:maps[0].canonicalFplId}).ok,false);
  assert.equal(candidatePlayerMapping({providerPlayerId:7,season,normalizedFullName:'alex smith',providerTeamMapping:{...maps[0],season:'2025-26'},canonicalTeamId:maps[0].canonicalFplId}).ok,false);
  assert.equal(candidatePlayerMapping({season,normalizedFullName:'alex smith',providerTeamMapping:maps[0],canonicalTeamId:maps[0].canonicalFplId}).ok,false);
});

test('provider and independent fixture qualification use stable identities only',()=>{
  const provider=qualifyProviderFixture(fixture(),{teamMappings:maps});assert.equal(provider.state,'PROVIDER_QUALIFIED');
  const candidate={fixtureId:'club-fixture-1',season,canonicalCompetitionId:'league_cup',homeTeamIdentity:maps[0].canonicalFplId,awayTeamIdentity:maps[1].canonicalFplId,identitiesResolved:true,identityResolutionMethod:'verified_identity_crosswalk',identityResolutionProvenance:'club-fixture-r1',kickoff:'2026-09-01T19:15:00Z'};
  assert.equal(crossSourceQualify(provider,[candidate]).state,'CROSS_SOURCE_VERIFIED');
  assert.equal(crossSourceQualify(provider,[candidate,{...candidate,fixtureId:'duplicate'}]).state,'AMBIGUOUS');
  assert.equal(crossSourceQualify(provider,[{...candidate,canonicalCompetitionId:'fa_cup'}]).state,'CONFLICTED');
  assert.equal(crossSourceQualify(provider,[{...candidate,homeTeamIdentity:maps[1].canonicalFplId,awayTeamIdentity:maps[0].canonicalFplId}]).state,'CONFLICTED');
  const unmapped=qualifyProviderFixture(fixture(),{teamMappings:[team(10,'2025-26:fpl:team:1','VERIFIED','2025-26')]});
  assert.equal(unmapped.state,'DISCOVERED');
});

test('fixture qualification uses complete mappings and contradictory verified targets conflict',()=>{
  for(const malformed of [{...maps[0],canonicalFplId:'bad'},{...maps[0],method:'name_guess'},{...maps[0],provenance:''},{...maps[0],revision:0},{...maps[0],season:'2025-26'}])assert.equal(qualifyProviderFixture(fixture(),{teamMappings:[malformed]}).state,'DISCOVERED');
  assert.equal(qualifyProviderFixture(fixture(),{teamMappings:[maps[0]]}).state,'PROVIDER_QUALIFIED');
  assert.equal(qualifyProviderFixture(fixture(),{teamMappings:[maps[0],{...maps[0],canonicalFplId:`${season}:fpl:team:2`,revision:2}]}).state,'CONFLICTED');
});

test('provider-scoped non-PL team identity supports strict cup verification',()=>{
  const cup=qualifyProviderFixture(fixture({providerLeagueId:'45',canonicalCompetitionId:'fa_cup'}),{teamMappings:[maps[0]]});
  assert.equal(cup.state,'PROVIDER_QUALIFIED');assert.equal(cup.awayTeamIdentity,apiFootballTeamIdentity({season,providerTeamId:20}));assert.equal(cup.awayIdentityScope,'PROVIDER');
  const candidate={fixtureId:'independent-fa-cup-1',season,canonicalCompetitionId:'fa_cup',homeTeamIdentity:maps[0].canonicalFplId,awayTeamIdentity:apiFootballTeamIdentity({season,providerTeamId:20}),identitiesResolved:true,identityResolutionMethod:'provider_id_crosswalk',identityResolutionProvenance:'independent-crosswalk-r1'};
  assert.equal(crossSourceQualify(cup,[candidate]).state,'CROSS_SOURCE_VERIFIED');
  assert.equal(crossSourceQualify(cup,[{...candidate,identitiesResolved:false,awayTeamName:'Opponent'}]).state,'CONFLICTED');
  assert.equal(crossSourceQualify(cup,[{...candidate,awayTeamIdentity:apiFootballTeamIdentity({season,providerTeamId:21})}]).state,'CONFLICTED');
  assert.equal(crossSourceQualify(cup,[{...candidate,homeTeamIdentity:candidate.awayTeamIdentity,awayTeamIdentity:candidate.homeTeamIdentity}]).state,'CONFLICTED');
  assert.equal(crossSourceQualify(cup,[{...candidate,canonicalCompetitionId:'league_cup'}]).state,'CONFLICTED');
});

test('fixture collision fails closed and mutable corrections preserve identity',()=>{
  const collision={provider:'api-football',entityType:'fixture',providerEntityId:'1636205',coreIdentity:'2026-27|fa_cup|10|20'};
  assert.equal(qualifyProviderFixture(fixture(),{teamMappings:[...maps,collision]}).state,'CONFLICTED');
  assert.equal(apiFootballFixtureIdentity(fixture()),apiFootballFixtureIdentity(fixture({kickoff:'changed'})));
});

test('Chelsea-Leeds kickoff conflict remains explicit without invalidating fixture identity',()=>{
  const kickoff=resolveFieldObservations('kickoff',[{value:'2026-09-01T19:00:00.000Z',source:'api-football',sourceRevision:'af-r1'},{value:'2026-09-01T19:00:00.000Z',source:'leeds',sourceRevision:'page-r1'},{value:'2026-09-01T19:15:00.000Z',source:'chelsea',sourceRevision:'page-r2'}]);
  assert.equal(kickoff.state,'CONFLICTED');assert.equal(kickoff.canonicalValue,null);assert.equal(kickoff.observations.length,3);
  assert.equal(apiFootballFixtureIdentity(fixture()),'2026-27:api-football:fixture:1636205');
});

test('participation preserves zero versus null, substitution direction and conflicts',()=>{
  assert.deepEqual(normalizeParticipation({explicitLineupRole:'BENCH',directMinutes:0,substitutionEvidenceState:'COMPLETE'}).appearanceState,'NOT_USED');
  assert.equal(normalizeParticipation({explicitLineupRole:'BENCH',directMinutes:0,substitutionEvidenceState:'MISSING'}).appearanceState,'UNKNOWN');
  assert.equal(normalizeParticipation({explicitLineupRole:'BENCH',directMinutes:null}).appearanceState,'UNKNOWN');
  assert.equal(normalizeParticipation({explicitLineupRole:'NO_LINEUP_EVIDENCE',directMinutes:null}).lineupRole,'NO_LINEUP_EVIDENCE');
  assert.equal(normalizeParticipation({explicitLineupRole:'BENCH',directMinutes:12,substitutionOn:true,substitutionEvidenceState:'COMPLETE'}).appearanceState,'SUBBED_ON');
  const conflict=normalizeParticipation({explicitLineupRole:'BENCH',directMinutes:0,substitutionOn:true,substitutionEvidenceState:'COMPLETE'});assert.equal(conflict.conflictState,'CONFLICTED');assert.equal(conflict.appearanceState,'UNKNOWN');
});

test('D1 admits narrow owner-risk rights and rejects unsupported variants',()=>{
  const rights={rights_classification:'owner_risk_accepted_private_use',source_key:'api-football',provider:'api-football',owner_approval_id:'EIA-2I5A',allowed_use:'private_noncommercial_research',normalized_facts_only:1,retention_allowed:1,redistribution_allowed:0,public_use_allowed:0,commercial_use_allowed:0,raw_payload_retention_allowed:0,stop_on_objection:1,shadow_ingest_allowed:1,attribution_required:0};
  assert.equal(rightsAdmission(rights).ok,true);
  assert.equal(rightsAdmission({...rights,public_use_allowed:1}).reason,'rights_inconsistent');
  assert.equal(rightsAdmission({...rights,rights_classification:'invented'}).reason,'rights_unknown');
});

test('migration provides minimal identity, participation and rights storage only',()=>{
  const sql=fs.readFileSync('workers/data-platform/migrations/0004_api_football_shadow_identity.sql','utf8');
  for(const table of ['data_source_revisions_new','provider_fixture_identities','provider_participation_revisions'])assert.match(sql,new RegExp(`CREATE TABLE ${table}`));
  assert.doesNotMatch(sql,/provider_rights_admissions/);assert.match(sql,/owner_risk_accepted_private_use/);assert.match(sql,/substitution_evidence_state='COMPLETE'/);assert.match(sql,/supersedes_revision_id/);
  assert.doesNotMatch(sql,/quota|request_audit|cron|secret|api[-_ ]key/i);
});

test('full SQLite migration chain admits exact owner-risk canonical mapping path and rejects malformed rights and NOT_USED',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'eia2i5a-')),db=path.join(dir,'shadow.db');
  try{
    const migrations=fs.readdirSync('workers/data-platform/migrations').sort();
    for(const file of migrations.slice(0,3)){const result=sqlite(db,fs.readFileSync(`workers/data-platform/migrations/${file}`,'utf8'));assert.equal(result.status,0,result.stderr);}
    assert.equal(sqlite(db,"INSERT INTO canonical_entities VALUES('historical-team','team','2026-27','fpl','99','2026-09-01T00:00:00.000Z'); INSERT INTO entity_mappings VALUES('historical-mapping','official-fpl-r1','team','99','historical-team','provider_id_crosswalk','verified',NULL,NULL,'2026-09-01T00:00:00.000Z',1,NULL,'2026-09-01T00:00:00.000Z');").status,0);
    const migration=sqlite(db,fs.readFileSync(`workers/data-platform/migrations/${migrations[3]}`,'utf8'));assert.equal(migration.status,0,migration.stderr);
    assert.equal(sqlite(db,"SELECT COUNT(*) FROM entity_mappings WHERE mapping_id='historical-mapping'; PRAGMA foreign_key_check;").stdout.trim(),'1');
    assert.equal(sqlite(db,"INSERT INTO data_sources VALUES('source-api-football','api-football','API-Football','external_provider','2026-09-16T00:00:00.000Z');").status,0);
    const revision="'api-football-r1','source-api-football',1,'eia-2i5a-v1','owner_risk_accepted_private_use',1,0,0,NULL,'docs/DATA_SOURCES.md','2026-09-16T00:00:00.000Z','owner_approved_private_shadow',1,NULL,'2026-09-16T00:00:00.000Z','api-football','api-football','EIA-2I5A','private_noncommercial_research',1,0,0,0,1";
    assert.equal(sqlite(db,`INSERT INTO data_source_revisions VALUES(${revision});`).status,0);
    assert.equal(sqlite(db,"INSERT INTO canonical_entities VALUES('2026-27:fpl:team:1','team','2026-27','fpl','1','2026-09-16T00:00:00.000Z'); INSERT INTO entity_mappings VALUES('mapping-team-10','api-football-r1','team','10','2026-27:fpl:team:1','manually_verified','verified','2026-08-01T00:00:00.000Z',NULL,'2026-09-16T00:00:00.000Z',1,NULL,'2026-09-16T00:00:00.000Z');").status,0);
    assert.equal(sqlite(db,"SELECT COUNT(*) FROM entity_mappings WHERE source_revision_id='api-football-r1';").stdout.trim(),'1');
    assert.equal(sqlite(db,"INSERT INTO data_sources VALUES('source-other','other-provider','Other','external_provider','2026-09-16T00:00:00.000Z');").status,0);
    const unrelated=sqlite(db,`INSERT INTO data_source_revisions VALUES(${revision.replace("'api-football-r1','source-api-football',1","'other-r1','source-other',1")});`);assert.notEqual(unrelated.status,0);assert.match(unrelated.stderr,/owner_risk_source_mismatch/);
    const malformed=sqlite(db,`INSERT INTO data_source_revisions VALUES(${revision.replace("'api-football-r1','source-api-football',1","'bad-r1','source-api-football',2").replace("'EIA-2I5A'","'UNAPPROVED'")});`);assert.notEqual(malformed.status,0);assert.match(malformed.stderr,/CHECK constraint failed/);
    assert.equal(sqlite(db,"INSERT INTO provider_fixture_identities VALUES('2026-27:api-football:fixture:1','api-football','1','2026-27','fa_cup','45','10','20','mapping-team-10',NULL,'PROVIDER_QUALIFIED','test','fixture-r1','2026-09-16T00:00:00.000Z','2026-09-16T00:00:00.000Z');").status,0);
    const invalid="INSERT INTO provider_participation_revisions VALUES('part-r1','2026-27:api-football:fixture:1','7',NULL,NULL,'BENCH','NOT_USED',0,0,0,'NONE','MISSING','api-football-r1','input-r1',NULL,'2026-09-16T00:00:00.000Z','2026-09-16T00:00:00.000Z');";
    assert.notEqual(sqlite(db,invalid).status,0);
    assert.equal(sqlite(db,'PRAGMA foreign_key_check;').stdout.trim(),'');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('shadow contracts have no production model or browser dependency path',()=>{
  for(const file of ['src/model/minutes.mjs','src/model/scoring.mjs','src/squad.mjs','src/model/transfers.mjs','src/main.mjs'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/api-football-shadow-contracts|provider_participation_revisions/);
  const source=fs.readFileSync('src/decision-intelligence/api-football-shadow-contracts.mjs','utf8');assert.doesNotMatch(source,/fetch\(|x-apisports-key|process\.env|setInterval|setTimeout/);
});
