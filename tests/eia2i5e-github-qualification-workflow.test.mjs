// EIA-2I5E-R7A — permanent regressions for the dormant GitHub qualification workflow.
//
// These tests inspect repository text and executable shell fragments only. They never import the
// PR #251 qualification module, never read an environment secret, and never call API-Football.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {API_FOOTBALL_MAX_RESPONSE_BYTES} from '../workers/api-football-collector/runtime-contracts.mjs';

const WORKFLOW_PATH = '.github/workflows/eia-2i5e-api-football-qualification.yml';
const CANDIDATE_SHA = '03cd231cd3e1d38821194a5d1aad87bc87232154';
const CANDIDATE_BRANCH = 'eia-2i5e-prelive-qualification';
const ENVIRONMENT = 'eia-api-football-qualification';
const MODULE_PATH = 'src/decision-intelligence/api-football-prelive-qualification.mjs';
const R3_TEST_PATH = 'tests/eia2i5e-prelive-qualification.test.mjs';
const SECRET_EXPR = 'secrets.API_FOOTBALL_API_KEY';

const read = file => fs.readFileSync(file, 'utf8');
const uncommented = source => source.split('\n').filter(line => !/^\s*#/.test(line)).join('\n');
const workflow = read(WORKFLOW_PATH);
const live = uncommented(workflow);

const GATE_START = '  repository-gate:';
const QUALIFY_START = '\n  qualify:';
const gateBlock = () => workflow.slice(workflow.indexOf(GATE_START), workflow.indexOf(QUALIFY_START));
const qualifyBlock = () => workflow.slice(workflow.indexOf(QUALIFY_START));

function permissionsBlock(source, indent) {
  const marker = `\n${indent}permissions:\n`;
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const scopes = {};
  for (const line of source.slice(start + marker.length).split('\n')) {
    const match = line.match(/^\s*([a-z-]+): (read|write|none)$/);
    if (!match || !line.startsWith(`${indent}  `)) break;
    scopes[match[1]] = match[2];
  }
  return scopes;
}

function effectivePermissions(source, jobBlock) {
  const workflowLevel = permissionsBlock(source, '');
  const jobLevel = permissionsBlock(jobBlock, '    ');
  assert.ok(workflowLevel !== null, 'a workflow-level permissions block must exist');
  return jobLevel === null ? workflowLevel : jobLevel;
}

function stepScript(source, marker) {
  const start = source.indexOf(marker);
  assert.ok(start > 0, marker);
  const body = source.slice(source.indexOf('run: |', start) + 'run: |\n'.length).split('\n');
  const script = [];
  for (const line of body) {
    if (line.trim() === '') {
      script.push('');
      continue;
    }
    if (!line.startsWith('          ')) break;
    script.push(line.slice(10));
  }
  return script.join('\n').trimEnd();
}

function namedSteps(jobBlock) {
  return [...jobBlock.matchAll(/^\s+- name: (.+)$/gm)].map(row => row[1]);
}

function envAssignments(stepText) {
  const block = stepText.split('\n');
  const env = {};
  let inEnv = false;
  for (const line of block) {
    if (/^\s+env:\s*$/.test(line)) {
      inEnv = true;
      continue;
    }
    if (inEnv) {
      const match = line.match(/^\s{10}([A-Z0-9_]+): (.+)$/);
      if (!match) break;
      env[match[1]] = match[2];
    }
  }
  return env;
}

test('R7A does not import or copy the PR #251 qualification module onto main', () => {
  assert.equal(fs.existsSync(MODULE_PATH), false);
  assert.equal(fs.existsSync(R3_TEST_PATH), false);
  assert.equal([...live.matchAll(/runAttendedApiFootballQualification\(/g)].length, 1);
  assert.match(live, /src\/decision-intelligence\/api-football-prelive-qualification\.mjs/);
});

test('the workflow exists, is named exactly, and is workflow_dispatch-only with zero inputs', () => {
  assert.ok(fs.existsSync(WORKFLOW_PATH));
  assert.match(workflow, /^name: EIA-2I5E API-Football Qualification$/m);
  const body = live;
  const trigger = body.slice(body.indexOf('\non:'), body.indexOf('\npermissions:'));
  assert.equal(trigger.trim(), 'on:\n  workflow_dispatch:');
  for (const forbidden of [
    /^\s{2}schedule:/m, /cron:/, /^\s{2}push:/m, /^\s{2}pull_request:/m, /pull_request_target/,
    /repository_dispatch/, /workflow_call/, /workflow_run/, /^\s{2}release:/m, /^\s{2}issues:/m
  ]) assert.doesNotMatch(body, forbidden, String(forbidden));
  assert.doesNotMatch(body, /^\s*inputs:/m);
  assert.equal([...workflow.matchAll(/inputs\./g)].length, 0);
  assert.equal([...workflow.matchAll(/github\.event\.inputs/g)].length, 0);
  assert.match(workflow, /if: github\.event_name == 'workflow_dispatch'/);
  assert.equal([...workflow.matchAll(/if: github\.event_name == 'workflow_dispatch'/g)].length, 2);
});

test('candidate SHA, branch and PR are hard-coded and not user-controlled', () => {
  assert.match(workflow, new RegExp(`QUALIFICATION_CANDIDATE_SHA: ${CANDIDATE_SHA}`));
  assert.match(workflow, new RegExp(`QUALIFICATION_BRANCH: ${CANDIDATE_BRANCH}`));
  assert.match(workflow, /QUALIFICATION_PR: '251'/);
  assert.doesNotMatch(live, /\$\{\{\s*inputs\./);
  assert.doesNotMatch(live, /github\.event\.inputs/);
  assert.match(qualifyBlock(), new RegExp(`ref: ${CANDIDATE_SHA}`));
  assert.doesNotMatch(qualifyBlock(), /ref: \$\{\{\s*github\.sha/);
  assert.doesNotMatch(qualifyBlock(), /ref: \$\{\{\s*github\.ref/);
  assert.match(gateBlock(), /ref: \$\{\{\s*github\.sha\s*\}\}/);
  assert.equal([...workflow.matchAll(new RegExp(CANDIDATE_SHA, 'g'))].length >= 8, true);
});

test('both jobs declare contents:read only and no write scope exists anywhere', () => {
  assert.deepEqual(permissionsBlock(workflow, ''), {contents: 'read'});
  assert.deepEqual(effectivePermissions(workflow, gateBlock()), {contents: 'read'});
  assert.deepEqual(effectivePermissions(workflow, qualifyBlock()), {contents: 'read'});
  for (const forbidden of [
    /contents: write/, /actions: write/, /pull-requests: write/, /issues: write/,
    /deployments: write/, /id-token: write/, /packages: write/, /checks: write/
  ]) assert.doesNotMatch(live, forbidden, String(forbidden));
  for (const scopes of [effectivePermissions(workflow, gateBlock()), effectivePermissions(workflow, qualifyBlock())]) {
    for (const [name, level] of Object.entries(scopes)) assert.equal(level, 'read', name);
  }
});

test('the repository gate has no environment and no API-Football secret', () => {
  const gate = gateBlock();
  assert.doesNotMatch(gate, /environment:/);
  assert.doesNotMatch(gate, /secrets\./);
  assert.doesNotMatch(gate, /API_FOOTBALL_API_KEY/);
  assert.doesNotMatch(uncommented(gate), /GH_TOKEN|github\.token|CLOUDFLARE/);
});

test('only the qualify job uses the owner-configured protected environment', () => {
  assert.match(qualifyBlock(), new RegExp(`environment:\\n      name: ${ENVIRONMENT}\\n`));
  assert.equal([...workflow.matchAll(new RegExp(`name: ${ENVIRONMENT}`, 'g'))].length, 1);
  assert.match(qualifyBlock(), /needs: repository-gate/);
  assert.doesNotMatch(live, /data-s2-production-collection|data-s2-production-scheduled/);
});

test('API_FOOTBALL_API_KEY is referenced once, only as the GitHub secret, only on the execution step', () => {
  assert.equal([...workflow.matchAll(/API_FOOTBALL_API_KEY/g)].length, 3);
  assert.equal([...workflow.matchAll(/secrets\.API_FOOTBALL_API_KEY/g)].length, 1);
  assert.equal([...workflow.matchAll(/process\.env\.API_FOOTBALL_API_KEY/g)].length, 1);
  assert.match(workflow, new RegExp(`API_FOOTBALL_API_KEY: \\$\\{\\{ ${SECRET_EXPR} \\}\\}`));
  const qualifySteps = qualifyBlock().split('\n      - name: ').slice(1);
  const secretSteps = qualifySteps.filter(step => step.includes(SECRET_EXPR));
  assert.equal(secretSteps.length, 1);
  assert.match(secretSteps[0], /^Invoke attended qualification runner once\n/);
  assert.deepEqual(envAssignments(`      - name: ${secretSteps[0]}`), {
    API_FOOTBALL_API_KEY: `\${{ ${SECRET_EXPR} }}`
  });
  assert.doesNotMatch(gateBlock(), /API_FOOTBALL_API_KEY|secrets\./);
  const summary = qualifySteps.find(step => step.startsWith('Write allowlisted job summary'));
  const upload = qualifySteps.find(step => step.startsWith('Upload sanitized qualification result'));
  const tests = qualifySteps.find(step => step.startsWith('Run focused R3 qualification tests'));
  assert.ok(summary && upload && tests);
  assert.doesNotMatch(summary, /API_FOOTBALL_API_KEY|secrets\./);
  assert.doesNotMatch(upload, /API_FOOTBALL_API_KEY|secrets\./);
  assert.doesNotMatch(tests, /API_FOOTBALL_API_KEY|secrets\./);
});

test('the secret-bearing step is after checkout, branch reconfirm and the R3 test gate', () => {
  const names = namedSteps(qualifyBlock());
  assert.deepEqual(names, [
    'Check out the hard-coded PR #251 candidate',
    'Reconfirm candidate HEAD and remote qualification branch',
    'Set up exact Node',
    'Run focused R3 qualification tests before any secret is introduced',
    'Invoke attended qualification runner once',
    'Write allowlisted job summary',
    'Upload sanitized qualification result'
  ]);
  assert.ok(names.indexOf('Run focused R3 qualification tests before any secret is introduced')
    < names.indexOf('Invoke attended qualification runner once'));
  assert.ok(names.indexOf('Reconfirm candidate HEAD and remote qualification branch')
    < names.indexOf('Invoke attended qualification runner once'));
});

test('checkout uses persist-credentials:false and fetch-depth 0 on both jobs', () => {
  assert.equal([...workflow.matchAll(/persist-credentials: false/g)].length, 2);
  assert.equal([...workflow.matchAll(/fetch-depth: 0/g)].length, 2);
  assert.equal([...workflow.matchAll(/uses: actions\/checkout@v5/g)].length, 2);
  assert.match(workflow, /node-version: 24\.19\.0/);
  assert.match(workflow, /test "\$\(node --version\)" = v24\.19\.0/);
});

test('the workflow does not install packages, dump env, or call arbitrary HTTP helpers', () => {
  for (const forbidden of [
    /npm install/, /npm ci/, /npx /, /yarn /, /pnpm /, /package installation/i,
    /printenv/, /^\s+env\s*$/m, /env \|/, /compgen -e/, /JSON\.stringify\(process\.env/,
    /Object\.keys\(process\.env/, /Object\.entries\(process\.env/,
    /\bcurl\b/, /\bwget\b/, /\bhttpie\b/, /\baxios\b/, /node-fetch/,
    /v3\.football\.api-sports\.io/, /x-apisports-key/,
    /uses: .*retry/i, /nick-fields\/retry/, /max-attempts:/, /retry_wait/,
    /continue-on-error:\s*true/, /strategy:\s*\n\s*matrix:/,
    /git push/, /git commit/, /gh api /, /gh workflow/, /contents: write/,
    /workflow_dispatch:\s*\n\s*inputs:/
  ]) assert.doesNotMatch(live, forbidden, String(forbidden));
  assert.doesNotMatch(live, /https:\/\/(?!github\.com\/priteshpatel390-del\/FPL\.git)/);
});

test('the driver imports the candidate module, invokes the runner once, and writes outside the tree', () => {
  const driver = stepScript(workflow, '      - name: Invoke attended qualification runner once');
  assert.match(driver, /runAttendedApiFootballQualification/);
  assert.equal([...driver.matchAll(/runAttendedApiFootballQualification\(/g)].length, 1);
  assert.match(driver, /src\/decision-intelligence\/api-football-prelive-qualification\.mjs/);
  assert.match(driver, /fetchImpl: globalThis\.fetch/);
  assert.match(driver, /const sleep = ms => new Promise\(resolve => setTimeout\(resolve, ms\)\)/);
  assert.match(driver, /invocations \+= 1/);
  assert.match(driver, /if \(invocations !== 1\)/);
  assert.match(driver, /MAX_PROVIDER_ATTEMPTS = 11/);
  assert.match(driver, /attempts > MAX_PROVIDER_ATTEMPTS/);
  assert.match(driver, /qualification_retry_detected/);
  assert.match(driver, /bodyRetained !== false/);
  assert.match(driver, /qualification_runner_unexpected_exception/);
  assert.match(driver, /serialized\.includes\(apiKey\)/);
  assert.match(driver, /join\(runnerTemp, RESULT_NAME\)/);
  assert.match(driver, /eia-2i5e-qualification-result\.json/);
  assert.doesNotMatch(driver, /Object\.hasOwn\(options,\s*'plan'\)|plan:/);
  assert.doesNotMatch(driver, /GITHUB_WORKSPACE|process\.cwd\(\).*\.json/);
  assert.doesNotMatch(driver, /console\.log/);
  assert.doesNotMatch(driver, /console\.error\(result|console\.error\(serialized|console\.error\(apiKey/);
  assert.doesNotMatch(driver, /stack|error\.message|String\(error\)/);
});

test('the result artifact is sanitized JSON outside the repository tree with bounded retention', () => {
  assert.match(qualifyBlock(), /uses: actions\/upload-artifact@v6/);
  assert.match(qualifyBlock(), /name: eia-2i5e-qualification-result/);
  assert.match(qualifyBlock(), /retention-days: 7/);
  assert.match(qualifyBlock(), /if-no-files-found: error/);
  assert.match(qualifyBlock(), /\$\{\{\s*runner\.temp\s*\}\}\/eia-2i5e-qualification-result\.json/);
  assert.doesNotMatch(live, /path: dist\/|path: \.\/|path: src\//);
});

test('the job summary is allowlisted and does not dump arbitrary JSON or secrets', () => {
  const summary = stepScript(workflow, '      - name: Write allowlisted job summary');
  assert.match(summary, /Candidate SHA/);
  assert.match(summary, /Runner invocation count: 1/);
  assert.match(summary, /Formal response-size decision/);
  assert.match(summary, /Raw body retained/);
  assert.match(summary, /Production constant remains null/);
  assert.doesNotMatch(summary, /JSON\.stringify\(result\)/);
  assert.doesNotMatch(summary, /appendFileSync\([^)]*serialized/);
  assert.doesNotMatch(summary, /API_FOOTBALL_API_KEY|x-apisports-key|authorization/i);
  assert.doesNotMatch(summary, /error\.stack|headers/);
});

test('focused R3 tests and the null production ceiling are required before secret-bearing execution', () => {
  const tests = stepScript(workflow, '      - name: Run focused R3 qualification tests before any secret is introduced');
  assert.match(tests, /node --test tests\/eia2i5e-prelive-qualification\.test\.mjs/);
  assert.match(tests, /API_FOOTBALL_MAX_RESPONSE_BYTES/);
  assert.match(tests, /API_FOOTBALL_MAX_RESPONSE_BYTES !== null/);
  assert.equal(API_FOOTBALL_MAX_RESPONSE_BYTES, null);
});

test('production constant remains unqualified on this branch', () => {
  assert.equal(API_FOOTBALL_MAX_RESPONSE_BYTES, null);
  const contracts = read('workers/api-football-collector/runtime-contracts.mjs');
  assert.match(contracts, /API_FOOTBALL_MAX_RESPONSE_BYTES=null/);
});

function runGateShell(script, {head, liveMain, liveCandidate, dirty = false, eventSha = CANDIDATE_SHA} = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eia-r7a-gate-'));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  const candidate = liveCandidate ?? CANDIDATE_SHA;
  const main = liveMain ?? (eventSha || CANDIDATE_SHA);
  fs.writeFileSync(path.join(bin, 'git'), `#!/bin/sh
case "$1" in
  rev-parse) echo ${head ?? eventSha};;
  status) ${dirty ? "echo ' M README.md'" : ':'} ;;
  ls-remote)
    if echo "$*" | grep -q 'refs/heads/main'; then printf '%s\\trefs/heads/main\\n' ${main}; exit 0; fi
    if echo "$*" | grep -q 'refs/heads/${CANDIDATE_BRANCH}'; then printf '%s\\trefs/heads/${CANDIDATE_BRANCH}\\n' ${candidate}; exit 0; fi
    exit 1;;
  *) exit 1;;
esac
exit 0
`, {mode: 0o755});
  const out = spawnSync('bash', ['-c', script], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      EVENT_SHA: eventSha,
      QUALIFICATION_CANDIDATE_SHA: CANDIDATE_SHA,
      QUALIFICATION_BRANCH: CANDIDATE_BRANCH,
      QUALIFICATION_PR: '251'
    }
  });
  fs.rmSync(dir, {recursive: true, force: true});
  return out.status;
}

test('a moved main, moved candidate branch, wrong head or dirty tree fails the credential-free gate', () => {
  const script = stepScript(workflow, '      - name: Prove current main, pinned candidate branch and a clean tree');
  const eventSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  assert.equal(runGateShell(script, {eventSha, liveMain: eventSha, liveCandidate: CANDIDATE_SHA, head: eventSha}), 0);
  for (const blocked of [
    {liveMain: CANDIDATE_SHA},
    {liveMain: "''"},
    {head: CANDIDATE_SHA},
    {liveCandidate: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'},
    {liveCandidate: "''"},
    {dirty: true}
  ]) {
    assert.notEqual(
      runGateShell(script, {eventSha, liveMain: eventSha, liveCandidate: CANDIDATE_SHA, head: eventSha, ...blocked}),
      0,
      JSON.stringify(blocked)
    );
  }
});

test('candidate branch movement between the gate and the protected job fails closed before the secret step', () => {
  const script = stepScript(workflow, '      - name: Reconfirm candidate HEAD and remote qualification branch');
  assert.equal(runGateShell(script, {eventSha: CANDIDATE_SHA, liveMain: CANDIDATE_SHA, liveCandidate: CANDIDATE_SHA, head: CANDIDATE_SHA}), 0);
  assert.notEqual(
    runGateShell(script, {
      eventSha: CANDIDATE_SHA,
      head: CANDIDATE_SHA,
      liveCandidate: 'cccccccccccccccccccccccccccccccccccccccc'
    }),
    0
  );
  assert.notEqual(
    runGateShell(script, {
      eventSha: CANDIDATE_SHA,
      head: 'dddddddddddddddddddddddddddddddddddddddd',
      liveCandidate: CANDIDATE_SHA
    }),
    0
  );
});

test('event validation refuses anything other than workflow_dispatch on main of this repository', () => {
  const script = stepScript(workflow, '      - name: Validate dispatch event before checkout');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eia-r7a-event-'));
  const pass = spawnSync('bash', ['-c', script], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      EVENT_NAME: 'workflow_dispatch',
      EVENT_REF: 'refs/heads/main',
      EVENT_REPOSITORY: 'priteshpatel390-del/FPL',
      EVENT_SHA: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      QUALIFICATION_CANDIDATE_SHA: CANDIDATE_SHA,
      QUALIFICATION_BRANCH: CANDIDATE_BRANCH,
      QUALIFICATION_PR: '251'
    }
  });
  assert.equal(pass.status, 0);
  for (const blocked of [
    {EVENT_NAME: 'push'},
    {EVENT_REF: 'refs/heads/eia-2i5e-prelive-qualification'},
    {EVENT_REPOSITORY: 'other/FPL'},
    {EVENT_SHA: 'not-a-sha'},
    {QUALIFICATION_CANDIDATE_SHA: 'ffffffffffffffffffffffffffffffffffffffff'}
  ]) {
    const out = spawnSync('bash', ['-c', script], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        EVENT_NAME: 'workflow_dispatch',
        EVENT_REF: 'refs/heads/main',
        EVENT_REPOSITORY: 'priteshpatel390-del/FPL',
        EVENT_SHA: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        QUALIFICATION_CANDIDATE_SHA: CANDIDATE_SHA,
        QUALIFICATION_BRANCH: CANDIDATE_BRANCH,
        QUALIFICATION_PR: '251',
        ...blocked
      }
    });
    assert.notEqual(out.status, 0, JSON.stringify(blocked));
  }
  fs.rmSync(dir, {recursive: true, force: true});
});

test('this workflow is not a member of the Official FPL production collection group', () => {
  assert.doesNotMatch(workflow, /group: data-s2-production-collection/);
  assert.doesNotMatch(live, /run-production-collection|CLOUDFLARE_D1_TOKEN|wrangler/);
});

test('Grok, Codex and the workflow itself have no mechanism to print or retrieve the secret value', () => {
  assert.doesNotMatch(live, /echo "\$API_FOOTBALL_API_KEY"|echo \$API_FOOTBALL_API_KEY/);
  assert.doesNotMatch(live, /::add-mask::\$API_FOOTBALL_API_KEY/);
  assert.doesNotMatch(live, /fingerprint|sha256sum.*API_FOOTBALL|length of.*API_FOOTBALL/i);
  assert.match(workflow, /A GitHub UI re-run is another provider attempt and requires fresh owner approval/);
});
