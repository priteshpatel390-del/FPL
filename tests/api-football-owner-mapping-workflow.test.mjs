import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path='.github/workflows/api-football-owner-mapping-qualification.yml';
const source=fs.readFileSync(path,'utf8');

test('owner mapping qualification workflow is manual-only, exact-main and rerun-blocked',()=>{
  assert.match(source,/^on:\n  workflow_dispatch:\s*$/m);
  assert.doesNotMatch(source,/^\s+(?:schedule|push|pull_request|pull_request_target):/m);
  assert.match(source,/github\.event_name == 'workflow_dispatch' && github\.run_attempt == 1/g);
  assert.match(source,/test "\$EVENT_REF" = refs\/heads\/main/g);
  assert.ok((source.match(/git ls-remote https:\/\/github\.com\/priteshpatel390-del\/FPL\.git refs\/heads\/main/g)||[]).length>=3);
  assert.match(source,/environment:\n      name: eia-api-football-qualification/);
  assert.match(source,/cancel-in-progress: false/);
});

test('owner mapping qualification workflow uses one protected crosswalk secret and never receives API-Football credential',()=>{
  assert.equal((source.match(/secrets\.API_FOOTBALL_OWNER_CROSSWALK_JSON/g)||[]).length,1);
  assert.equal((source.match(/API_FOOTBALL_OWNER_CROSSWALK_JSON:/g)||[]).length,1);
  assert.doesNotMatch(source,/secrets\.API_FOOTBALL_API_KEY|x-apisports-key|v3\.football\.api-sports\.io/i);
  assert.match(source,/owner_crosswalk_secret_missing/);
  assert.match(source,/owner_crosswalk_secret_invalid/);
  assert.match(source,/crosswalkPersisted:false/);
});

test('owner mapping qualification workflow pins the exact prior sanitized provider evidence',()=>{
  assert.match(source,/35328500278/);
  assert.match(source,/10540321648/);
  assert.match(source,/4a69b38d20857767007b23f6259efe5894aab35202ad8e10ee8cdc62bdafce97/);
  assert.match(source,/api-football-team-universe-qualification-result\.json/);
  assert.match(source,/validateApiFootballTeamUniverseEvidence/);
  assert.match(source,/API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_REVISION/);
  assert.match(source,/sha256sum --check/);
  assert.match(source,/actions\/artifacts\/10540321648\/zip/);
});

test('owner mapping qualification workflow makes only two current Official FPL fetches and zero API-Football requests',()=>{
  assert.match(source,/OFFICIAL_FPL_BOOTSTRAP_URL,OFFICIAL_FPL_FIXTURES_URL,fetchOfficialFplAuthority/);
  assert.match(source,/new Set\(\[OFFICIAL_FPL_BOOTSTRAP_URL,OFFICIAL_FPL_FIXTURES_URL\]\)/);
  assert.match(source,/officialFplRequests>=2/);
  assert.match(source,/if\(!authority\.ok\|\|officialFplRequests!==2\)/);
  assert.match(source,/apiFootballRequests:0/);
  assert.match(source,/rawOfficialFplBodyRetained:false/);
  assert.doesNotMatch(source,/runAttendedApiFootballTeamUniverseQualification\s*\(|runAttendedApiFootballQualification\s*\(/);
});

test('owner mapping qualification workflow runs focused tests before secret use and retains only sanitized GO evidence',()=>{
  const testsIndex=source.indexOf('Run focused mapping qualification tests before crosswalk secret introduction');
  const secretIndex=source.indexOf('API_FOOTBALL_OWNER_CROSSWALK_JSON:');
  assert.ok(testsIndex>=0&&secretIndex>testsIndex);
  assert.match(source,/tests\/api-football-owner-mapping\.test\.mjs/);
  assert.match(source,/tests\/api-football-owner-mapping-workflow\.test\.mjs/);
  assert.match(source,/issueOwnerApprovedTwentyClubMappings/);
  assert.match(source,/verifiedPremierLeagueTeamCount/);
  assert.match(source,/newReceiptCount/);
  assert.match(source,/legacyReceiptCount/);
  assert.match(source,/mappingReceiptsPersisted:false/);
  assert.match(source,/providerEntityId\|apiFootballTeamId\|canonicalFplId\|qualificationEvidenceReceipt\|"table"\|"mappings"/);
  assert.match(source,/retention-days: 7/);
});

test('owner mapping qualification workflow keeps repository and runtime permissions narrow',()=>{
  assert.match(source,/permissions:\n  contents: read\n  actions: read/);
  assert.match(source,/persist-credentials: false/g);
  assert.match(source,/actions\/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09/);
  assert.match(source,/actions\/setup-node@a0853c24544627f65ddf259abe73b1d18a591444/);
  assert.match(source,/actions\/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f/);
  assert.doesNotMatch(source,/wrangler|collection_enabled\s*=\s*1|migration 0005.*apply|git push|npm install/i);
});
