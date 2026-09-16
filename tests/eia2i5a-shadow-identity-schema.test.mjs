import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  apiFootballCompetitionRegistry,apiFootballFixtureIdentity,apiFootballPlayerIdentity,candidatePlayerMapping,
  crossSourceQualify,deterministicRevision,normalizeParticipation,qualifyProviderFixture,resolveFieldObservations,validateProviderMapping
} from '../src/decision-intelligence/api-football-shadow-contracts.mjs';
import {rightsAdmission} from '../workers/data-platform/data-platform-core.mjs';

const season='2026-27';
const team=(providerEntityId,canonicalFplId,status='VERIFIED',mappedSeason=season)=>({provider:'api-football',entityType:'team',providerEntityId:String(providerEntityId),canonicalFplId,mappingRevision:'r1',revision:1,status,season:mappedSeason,method:'manually_verified',provenance:'owner-reviewed'});
const fixture=(overrides={})=>({season,providerFixtureId:'1636205',providerLeagueId:'48',canonicalCompetitionId:'league_cup',providerHomeTeamId:'10',providerAwayTeamId:'20',...overrides});
const maps=[team(10,`${season}:fpl:team:1`),team(20,`${season}:fpl:team:12`)];

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
  assert.equal(candidatePlayerMapping({season,normalizedFullName:'alex smith',providerTeamMapping:maps[0],canonicalTeamId:maps[0].canonicalFplId}).ok,false);
});

test('provider and independent fixture qualification use stable identities only',()=>{
  const provider=qualifyProviderFixture(fixture(),{teamMappings:maps});assert.equal(provider.state,'PROVIDER_QUALIFIED');
  const candidate={fixtureId:'club-fixture-1',season,canonicalCompetitionId:'league_cup',canonicalHomeTeamId:maps[0].canonicalFplId,canonicalAwayTeamId:maps[1].canonicalFplId,identitiesResolved:true,kickoff:'2026-09-01T19:15:00Z'};
  assert.equal(crossSourceQualify(provider,[candidate]).state,'CROSS_SOURCE_VERIFIED');
  assert.equal(crossSourceQualify(provider,[candidate,{...candidate,fixtureId:'duplicate'}]).state,'AMBIGUOUS');
  assert.equal(crossSourceQualify(provider,[{...candidate,canonicalCompetitionId:'fa_cup'}]).state,'CONFLICTED');
  assert.equal(crossSourceQualify(provider,[{...candidate,canonicalHomeTeamId:maps[1].canonicalFplId,canonicalAwayTeamId:maps[0].canonicalFplId}]).state,'CONFLICTED');
  const unmapped=qualifyProviderFixture(fixture(),{teamMappings:[team(10,'2025-26:fpl:team:1','VERIFIED','2025-26')]});
  assert.equal(unmapped.state,'DISCOVERED');assert.notEqual(crossSourceQualify({...unmapped,state:'PROVIDER_QUALIFIED'},[{...candidate,canonicalHomeTeamId:null,canonicalAwayTeamId:null}]).state,'CROSS_SOURCE_VERIFIED');
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
  assert.deepEqual(normalizeParticipation({explicitLineupRole:'BENCH',directMinutes:0,noSubOnEvidence:true}).appearanceState,'NOT_USED');
  assert.equal(normalizeParticipation({explicitLineupRole:'BENCH',directMinutes:null}).appearanceState,'UNKNOWN');
  assert.equal(normalizeParticipation({explicitLineupRole:'NO_LINEUP_EVIDENCE',directMinutes:null}).lineupRole,'NO_LINEUP_EVIDENCE');
  assert.equal(normalizeParticipation({explicitLineupRole:'BENCH',directMinutes:12,substitutionOn:true}).appearanceState,'SUBBED_ON');
  assert.equal(normalizeParticipation({explicitLineupRole:'BENCH',directMinutes:0,substitutionOn:true}).conflictState,'CONFLICTED');
});

test('D1 admits narrow owner-risk rights and rejects unsupported variants',()=>{
  const rights={rights_classification:'owner_risk_accepted_private_use',source_key:'api-football',provider:'api-football',owner_approval_id:'EIA-2I5A',allowed_use:'private_noncommercial_research',retention_allowed:1,redistribution_allowed:0,public_use_allowed:0,commercial_use_allowed:0,raw_payload_retention_allowed:0,stop_on_objection:1,shadow_ingest_allowed:1,attribution_required:0};
  assert.equal(rightsAdmission(rights).ok,true);
  assert.equal(rightsAdmission({...rights,public_use_allowed:1}).reason,'rights_inconsistent');
  assert.equal(rightsAdmission({...rights,rights_classification:'invented'}).reason,'rights_unknown');
});

test('migration provides minimal identity, participation and rights storage only',()=>{
  const sql=fs.readFileSync('workers/data-platform/migrations/0004_api_football_shadow_identity.sql','utf8');
  for(const table of ['provider_rights_admissions','provider_fixture_identities','provider_participation_revisions'])assert.match(sql,new RegExp(`CREATE TABLE ${table}`));
  assert.match(sql,/owner_risk_accepted_private_use/);assert.match(sql,/direct_minutes IS NULL/);assert.match(sql,/supersedes_revision_id/);
  assert.doesNotMatch(sql,/quota|request_audit|cron|secret|api[-_ ]key/i);
});

test('shadow contracts have no production model or browser dependency path',()=>{
  for(const file of ['src/model/minutes.mjs','src/model/scoring.mjs','src/squad.mjs','src/model/transfers.mjs','src/main.mjs'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/api-football-shadow-contracts|provider_participation_revisions/);
  const source=fs.readFileSync('src/decision-intelligence/api-football-shadow-contracts.mjs','utf8');assert.doesNotMatch(source,/fetch\(|x-apisports-key|process\.env|setInterval|setTimeout/);
});
