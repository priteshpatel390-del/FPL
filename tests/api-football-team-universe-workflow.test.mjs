import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = '.github/workflows/api-football-team-universe-qualification.yml';
const workflow = fs.readFileSync(file, 'utf8');
const live = workflow.split('\n').filter(line => !/^\s*#/.test(line)).join('\n');
const qualify = workflow.slice(workflow.indexOf('\n  qualify:'));

function step(marker) {
  const start = workflow.indexOf(marker);
  assert.ok(start >= 0, marker);
  const run = workflow.indexOf('run: |', start);
  const lines = workflow.slice(run + 'run: |\n'.length).split('\n');
  const out = [];
  for (const line of lines) {
    if (line.trim() === '') { out.push(''); continue; }
    if (!line.startsWith('          ')) break;
    out.push(line.slice(10));
  }
  return out.join('\n').trimEnd();
}

test('manual-only current-main protected workflow boundary', () => {
  assert.match(workflow, /^name: API-Football Premier League Team Universe Qualification$/m);
  assert.equal(live.slice(live.indexOf('\non:'), live.indexOf('\npermissions:')).trim(), 'on:\n  workflow_dispatch:');
  assert.doesNotMatch(live, /^\s*inputs:/m);
  assert.doesNotMatch(live, /^\s{2}(schedule|push|pull_request):/m);
  assert.doesNotMatch(live, /pull_request_target|repository_dispatch|workflow_call|workflow_run/);
  assert.equal([...workflow.matchAll(/if: github\.event_name == 'workflow_dispatch' && github\.run_attempt == 1/g)].length, 2);
  assert.match(qualify, /environment:\n      name: eia-api-football-qualification/);
  assert.equal([...workflow.matchAll(/secrets\.API_FOOTBALL_API_KEY/g)].length, 1);
  assert.equal([...workflow.matchAll(/process\.env\.API_FOOTBALL_API_KEY/g)].length, 1);
  assert.equal([...live.matchAll(/git ls-remote https:\/\/github\.com\/priteshpatel390-del\/FPL\.git refs\/heads\/main/g)].length, 3);
  assert.equal([...live.matchAll(/ref: \$\{\{ github\.sha \}\}/g)].length, 2);
  assert.doesNotMatch(live, /03cd231cd3e1d38821194a5d1aad87bc87232154|QUALIFICATION_CANDIDATE_SHA|eia-2i5e-prelive-qualification/);
});

test('focused tests and final main gate precede the only secret execution step', () => {
  const focused = qualify.indexOf('Run focused team-universe contract tests before secret introduction');
  const gate = qualify.indexOf('Reconfirm current main immediately before credential-bearing execution');
  const execute = qualify.indexOf('Invoke team-universe qualification runner once');
  assert.ok(focused >= 0 && focused < gate && gate < execute);
  const focusedScript = step('      - name: Run focused team-universe contract tests before secret introduction');
  assert.match(focusedScript, /api-football-team-mapping-qualification\.test\.mjs/);
  assert.match(focusedScript, /api-football-team-universe-workflow\.test\.mjs/);
  assert.match(focusedScript, /API_FOOTBALL_TEAM_MAPPING_MAX_ATTEMPTS !== 2/);
  assert.match(focusedScript, /API_FOOTBALL_TEAM_MAPPING_MAX_RESPONSE_BYTES !== 720896/);
  assert.match(focusedScript, /https:\/\/v3\.football\.api-sports\.io\/teams\?league=39&season=2026/);
});

test('driver invokes only team-universe qualification with an independent two-egress ceiling', () => {
  const driver = step('      - name: Invoke team-universe qualification runner once');
  assert.equal([...driver.matchAll(/runAttendedApiFootballTeamUniverseQualification\s*\(/g)].length, 1);
  assert.doesNotMatch(driver, /runAttendedApiFootballQualification\s*\(/);
  assert.match(driver, /const MAX_PROVIDER_ATTEMPTS = 2;/);
  assert.match(driver, /fetchImpl: boundedFetch/);
  assert.match(driver, /actualEgressAttempts >= MAX_PROVIDER_ATTEMPTS/);
  assert.match(driver, /actualEgressAttempts !== attemptsUsed/);
  assert.match(driver, /validateApiFootballTeamUniverseEvidence\(result\.providerUniverse\)/);
  assert.match(driver, /result\.providerUniverse\.teams\.length !== 20/);
  assert.match(driver, /result\.rawBodyRetained !== false/);
  assert.match(driver, /serialized\.includes\(apiKey\)/);
  assert.match(driver, /x-apisports-key/i);
  assert.doesNotMatch(driver, /console\.log|console\.error\(result|console\.error\(serialized|console\.error\(apiKey|error\.stack|error\.message/);
});

test('sanitized evidence is retained without mapping or runtime activation authority', () => {
  assert.match(qualify, /name: api-football-team-universe-qualification-result/);
  assert.match(qualify, /retention-days: 7/);
  const summary = step('      - name: Write allowlisted qualification summary');
  assert.match(summary, /Evidence revision/);
  assert.match(summary, /Integrity hash/);
  assert.match(summary, /Provider team ID/);
  assert.match(summary, /review assistance only/);
  assert.match(summary, /does not admit provider→Official-FPL mappings/);
  assert.doesNotMatch(summary, /JSON\.stringify\(result\)|API_FOOTBALL_API_KEY|authorization|headers|x-apisports-key/i);
  for (const forbidden of [
    /wrangler/, /collection_enabled\s*=\s*1/i, /cron:/,
    /issueQualificationMappingReceipt\s*\(/, /qualifyTwentyClubMapping\s*\(/,
    /fetchOfficialFplAuthority\s*\(/, /git push|git commit|gh api|contents: write/
  ]) assert.doesNotMatch(live, forbidden);
});

test('external actions are SHA-pinned and repository token remains read-only', () => {
  const approved = {
    'actions/checkout': 'fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09',
    'actions/setup-node': 'a0853c24544627f65ddf259abe73b1d18a591444',
    'actions/upload-artifact': 'b7c566a772e6b6bfb58ed0dc250532a479d7789f'
  };
  const uses = [...live.matchAll(/^\s+uses:\s+([^\s#]+)/gm)].map(row => row[1]);
  assert.equal(uses.length, 4);
  for (const ref of uses) {
    const match = ref.match(/^([a-z0-9-]+\/[a-z0-9-]+)@([0-9a-f]{40})$/);
    assert.ok(match, ref);
    assert.equal(approved[match[1]], match[2]);
  }
  assert.equal([...workflow.matchAll(/persist-credentials: false/g)].length, 2);
  assert.equal([...workflow.matchAll(/fetch-depth: 0/g)].length, 2);
  assert.equal([...live.matchAll(/contents: read/g)].length, 3);
  assert.doesNotMatch(live, /contents: write|actions: write|deployments: write|id-token: write/);
});


test('independent boundedFetch rejects a third network call before fetch', async () => {
  const driver = step('      - name: Invoke team-universe qualification runner once');
  const wrapper = driver.match(/let actualEgressAttempts = 0;\nconst boundedFetch = async \(\.\.\.args\) => \{[\s\S]*?return globalThis\.fetch\(\.\.\.args\);\n\};/);
  assert.ok(wrapper, 'boundedFetch wrapper');
  assert.doesNotMatch(wrapper[0], /url|headers|apiKey|console\.|retry|wget|curl/);
  let calls = 0;
  const factory = new Function('fetchImpl', 'const MAX_PROVIDER_ATTEMPTS=2; const globalThis={fetch:fetchImpl}; ' + wrapper[0] + '; return boundedFetch;');
  const boundedFetch = factory(async () => { calls += 1; return {ok:true}; });
  await boundedFetch('one');
  await boundedFetch('two');
  await assert.rejects(() => boundedFetch('three'), /qualification_execution_attempt_ceiling_reached/);
  assert.equal(calls, 2);
});
