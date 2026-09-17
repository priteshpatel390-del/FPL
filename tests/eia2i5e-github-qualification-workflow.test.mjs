// EIA-2I5E-R7A / R7A-R1 — permanent regressions for the dormant GitHub qualification workflow.
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
const JOB_IF = "if: github.event_name == 'workflow_dispatch' && github.run_attempt == 1";
const APPROVED_ACTIONS = Object.freeze({
  'actions/checkout': 'fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09',
  'actions/setup-node': 'a0853c24544627f65ddf259abe73b1d18a591444',
  'actions/upload-artifact': 'b7c566a772e6b6bfb58ed0dc250532a479d7789f'
});
const DISPATCH_SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

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

function mainTreeHas(file) {
  for (const ref of ['origin/main', 'main']) {
    const probe = spawnSync('git', ['rev-parse', '--verify', `${ref}:${file}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    if (probe.status === 0) return true;
  }
  const fetched = spawnSync('git', ['fetch', '--depth', '1', 'origin', 'main:refs/remotes/origin/main'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  assert.equal(fetched.status, 0, `unable to fetch origin/main while checking ${file}: ${fetched.stderr}`);
  const probe = spawnSync('git', ['rev-parse', '--verify', `origin/main:${file}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return probe.status === 0;
}

test('R7A does not import or copy the PR #251 qualification module onto main', () => {
  assert.equal(mainTreeHas(MODULE_PATH), false);
  assert.equal(mainTreeHas(R3_TEST_PATH), false);
  assert.equal(fs.existsSync(MODULE_PATH), true);
  assert.equal(fs.existsSync(R3_TEST_PATH), true);
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
  assert.equal([...workflow.matchAll(new RegExp(JOB_IF.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))].length, 2);
  assert.doesNotMatch(gateBlock(), /^    if: github\.event_name == 'workflow_dispatch'$/m);
  assert.doesNotMatch(qualifyBlock(), /^    if: github\.event_name == 'workflow_dispatch'$/m);
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
  assert.match(workflow, new RegExp(`API_FOOTBALL_API_KEY: \\\$\\{\\{ ${SECRET_EXPR} \\}\\}`));
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
  const finalRecheck = qualifySteps.find(step => step.startsWith('Reconfirm remote main and candidate immediately before secret-bearing execution'));
  assert.ok(summary && upload && tests && finalRecheck);
  assert.doesNotMatch(summary, /API_FOOTBALL_API_KEY|secrets\./);
  assert.doesNotMatch(upload, /API_FOOTBALL_API_KEY|secrets\./);
  assert.doesNotMatch(tests, /API_FOOTBALL_API_KEY|secrets\./);
  assert.doesNotMatch(finalRecheck, /API_FOOTBALL_API_KEY|secrets\./);
});

test('the secret-bearing step is after checkout, branch/main reconfirm, R3 tests and the final pre-egress recheck', () => {
  const names = namedSteps(qualifyBlock());
  assert.deepEqual(names, [
    'Refuse GitHub UI reruns and confirm dispatch identity',
    'Check out the hard-coded PR #251 candidate',
    'Reconfirm candidate HEAD, remote qualification branch and current main',
    'Set up exact Node',
    'Run focused R3 qualification tests before any secret is introduced',
    'Reconfirm remote main and candidate immediately before secret-bearing execution',
    'Invoke attended qualification runner once',
    'Write allowlisted job summary',
    'Upload sanitized qualification result'
  ]);
  assert.ok(names.indexOf('Run focused R3 qualification tests before any secret is introduced')
    < names.indexOf('Reconfirm remote main and candidate immediately before secret-bearing execution'));
  assert.ok(names.indexOf('Reconfirm remote main and candidate immediately before secret-bearing execution')
    < names.indexOf('Invoke attended qualification runner once'));
  assert.ok(names.indexOf('Reconfirm candidate HEAD, remote qualification branch and current main')
    < names.indexOf('Invoke attended qualification runner once'));
});

test('checkout uses persist-credentials:false, fetch-depth 0, and SHA-pinned actions', () => {
  assert.equal([...workflow.matchAll(/persist-credentials: false/g)].length, 2);
  assert.equal([...workflow.matchAll(/fetch-depth: 0/g)].length, 2);
  assert.equal([...live.matchAll(new RegExp(`uses: actions/checkout@${APPROVED_ACTIONS['actions/checkout']}`, 'g'))].length, 2);
  assert.match(qualifyBlock(), new RegExp(`uses: actions/setup-node@${APPROVED_ACTIONS['actions/setup-node']}`));
  assert.match(workflow, /node-version: 24\.19\.0/);
  assert.match(workflow, /test "\$\(node --version\)" = v24\.19\.0/);
});

test('every external uses reference is an approved immutable 40-character SHA', () => {
  const uses = [...live.matchAll(/^\s+uses:\s+([^\s#]+)/gm)].map(row => row[1]);
  assert.equal(uses.length, 4);
  for (const reference of uses) {
    const match = reference.match(/^([a-z0-9-]+\/[a-z0-9-]+)@([0-9a-f]{40})$/);
    assert.ok(match, reference);
    assert.equal(APPROVED_ACTIONS[match[1]], match[2], reference);
  }
  assert.deepEqual(new Set(uses.map(value => value.split('@')[0])), new Set(Object.keys(APPROVED_ACTIONS)));
  for (const forbidden of [
    /uses: actions\/checkout@v\d/, /uses: actions\/setup-node@v\d/, /uses: actions\/upload-artifact@v\d/,
    /uses: [^\s]+@v\d/, /uses: [^\s]+@main\b/, /uses: [^\s]+@master\b/, /uses: [^\s]+@releases\//,
    /uses: [^\s]+@[0-9a-f]{1,39}(?:\s|#|$)/
  ]) assert.doesNotMatch(live, forbidden, String(forbidden));
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
  assert.match(driver, /fetchImpl: boundedFetch/);
  assert.doesNotMatch(driver, /fetchImpl: globalThis\.fetch/);
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
  assert.match(qualifyBlock(), new RegExp(`uses: actions/upload-artifact@${APPROVED_ACTIONS['actions/upload-artifact']}`));
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
  assert.match(summary, /UI reruns are structurally blocked\. A new provider attempt requires a new manual workflow_dispatch and a new protected-environment approval\./);
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

function runGateShell(script, {
  head,
  liveMain,
  liveCandidate,
  dirty = false,
  eventSha = DISPATCH_SHA,
  extraEnv = {}
} = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eia-r7a-gate-'));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  const candidate = liveCandidate ?? CANDIDATE_SHA;
  const main = liveMain ?? eventSha;
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
      EVENT_NAME: 'workflow_dispatch',
      EVENT_REF: 'refs/heads/main',
      EVENT_SHA: eventSha,
      EVENT_RUN_ATTEMPT: '1',
      QUALIFICATION_CANDIDATE_SHA: CANDIDATE_SHA,
      QUALIFICATION_BRANCH: CANDIDATE_BRANCH,
      QUALIFICATION_PR: '251',
      ...extraEnv
    }
  });
  fs.rmSync(dir, {recursive: true, force: true});
  return out.status;
}

test('a moved main, moved candidate branch, wrong head or dirty tree fails the credential-free gate', () => {
  const script = stepScript(workflow, '      - name: Prove current main, pinned candidate branch and a clean tree');
  assert.equal(runGateShell(script, {eventSha: DISPATCH_SHA, liveMain: DISPATCH_SHA, liveCandidate: CANDIDATE_SHA, head: DISPATCH_SHA}), 0);
  for (const blocked of [
    {liveMain: CANDIDATE_SHA},
    {liveMain: "''"},
    {head: CANDIDATE_SHA},
    {liveCandidate: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'},
    {liveCandidate: "''"},
    {dirty: true}
  ]) {
    assert.notEqual(
      runGateShell(script, {eventSha: DISPATCH_SHA, liveMain: DISPATCH_SHA, liveCandidate: CANDIDATE_SHA, head: DISPATCH_SHA, ...blocked}),
      0,
      JSON.stringify(blocked)
    );
  }
});

test('candidate or main movement after environment admission fails closed before the secret step', () => {
  const script = stepScript(workflow, '      - name: Reconfirm candidate HEAD, remote qualification branch and current main');
  assert.equal(runGateShell(script, {
    eventSha: DISPATCH_SHA,
    liveMain: DISPATCH_SHA,
    liveCandidate: CANDIDATE_SHA,
    head: CANDIDATE_SHA
  }), 0);
  for (const blocked of [
    {liveCandidate: 'cccccccccccccccccccccccccccccccccccccccc'},
    {head: 'dddddddddddddddddddddddddddddddddddddddd'},
    {liveMain: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'},
    {extraEnv: {EVENT_REF: 'refs/heads/eia-2i5e-prelive-qualification'}},
    {extraEnv: {EVENT_SHA: 'not-a-sha'}}
  ]) {
    assert.notEqual(
      runGateShell(script, {
        eventSha: DISPATCH_SHA,
        liveMain: DISPATCH_SHA,
        liveCandidate: CANDIDATE_SHA,
        head: CANDIDATE_SHA,
        ...blocked
      }),
      0,
      JSON.stringify(blocked)
    );
  }
});

test('final pre-egress reconfirm refuses a moved main, moved candidate, rerun or wrong ref', () => {
  const script = stepScript(workflow, '      - name: Reconfirm remote main and candidate immediately before secret-bearing execution');
  assert.equal(runGateShell(script, {
    eventSha: DISPATCH_SHA,
    liveMain: DISPATCH_SHA,
    liveCandidate: CANDIDATE_SHA,
    head: CANDIDATE_SHA
  }), 0);
  for (const blocked of [
    {liveMain: 'ffffffffffffffffffffffffffffffffffffffff'},
    {liveCandidate: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'},
    {head: DISPATCH_SHA},
    {dirty: true},
    {extraEnv: {EVENT_RUN_ATTEMPT: '2'}},
    {extraEnv: {EVENT_NAME: 'push'}},
    {extraEnv: {EVENT_REF: 'refs/heads/develop'}}
  ]) {
    assert.notEqual(
      runGateShell(script, {
        eventSha: DISPATCH_SHA,
        liveMain: DISPATCH_SHA,
        liveCandidate: CANDIDATE_SHA,
        head: CANDIDATE_SHA,
        ...blocked
      }),
      0,
      JSON.stringify(blocked)
    );
  }
});

test('event validation admits only workflow_dispatch attempt 1 on main of this repository', () => {
  const script = stepScript(workflow, '      - name: Validate dispatch event before checkout');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eia-r7a-event-'));
  const baseEnv = {
    PATH: process.env.PATH,
    EVENT_NAME: 'workflow_dispatch',
    EVENT_REF: 'refs/heads/main',
    EVENT_REPOSITORY: 'priteshpatel390-del/FPL',
    EVENT_SHA: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    EVENT_RUN_ATTEMPT: '1',
    QUALIFICATION_CANDIDATE_SHA: CANDIDATE_SHA,
    QUALIFICATION_BRANCH: CANDIDATE_BRANCH,
    QUALIFICATION_PR: '251'
  };
  assert.equal(spawnSync('bash', ['-c', script], {cwd: dir, encoding: 'utf8', env: baseEnv}).status, 0);
  for (const blocked of [
    {EVENT_NAME: 'push'},
    {EVENT_REF: 'refs/heads/eia-2i5e-prelive-qualification'},
    {EVENT_REPOSITORY: 'other/FPL'},
    {EVENT_SHA: 'not-a-sha'},
    {EVENT_RUN_ATTEMPT: '2'},
    {EVENT_RUN_ATTEMPT: '0'},
    {QUALIFICATION_CANDIDATE_SHA: 'ffffffffffffffffffffffffffffffffffffffff'}
  ]) {
    const out = spawnSync('bash', ['-c', script], {
      cwd: dir,
      encoding: 'utf8',
      env: {...baseEnv, ...blocked}
    });
    assert.notEqual(out.status, 0, JSON.stringify(blocked));
  }
  fs.rmSync(dir, {recursive: true, force: true});
});

test('qualify identity step admits run_attempt 1 and rejects reruns before checkout', () => {
  const script = stepScript(workflow, '      - name: Refuse GitHub UI reruns and confirm dispatch identity');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eia-r7a-rerun-'));
  const baseEnv = {
    PATH: process.env.PATH,
    EVENT_NAME: 'workflow_dispatch',
    EVENT_REF: 'refs/heads/main',
    EVENT_SHA: DISPATCH_SHA,
    EVENT_RUN_ATTEMPT: '1'
  };
  assert.equal(spawnSync('bash', ['-c', script], {cwd: dir, encoding: 'utf8', env: baseEnv}).status, 0);
  for (const blocked of [
    {EVENT_RUN_ATTEMPT: '2'},
    {EVENT_RUN_ATTEMPT: '3'},
    {EVENT_NAME: 'workflow_run'},
    {EVENT_REF: 'refs/heads/eia-2i5e-r7a-github-qualification-workflow'},
    {EVENT_SHA: 'short'}
  ]) {
    assert.notEqual(
      spawnSync('bash', ['-c', script], {cwd: dir, encoding: 'utf8', env: {...baseEnv, ...blocked}}).status,
      0,
      JSON.stringify(blocked)
    );
  }
  fs.rmSync(dir, {recursive: true, force: true});
});

test('both jobs structurally refuse GitHub UI reruns so they cannot reach environment approval or the secret', () => {
  assert.match(gateBlock(), new RegExp(`^    ${JOB_IF.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.match(qualifyBlock(), new RegExp(`^    ${JOB_IF.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.match(qualifyBlock(), /github\.run_attempt == 1/);
  assert.match(gateBlock(), /github\.run_attempt == 1/);
  const secretIndex = qualifyBlock().indexOf('Invoke attended qualification runner once');
  const environmentIndex = qualifyBlock().indexOf('environment:');
  const ifIndex = qualifyBlock().indexOf(JOB_IF);
  assert.ok(ifIndex >= 0 && ifIndex < environmentIndex && environmentIndex < secretIndex);
});

test('this workflow is not a member of the Official FPL production collection group', () => {
  assert.doesNotMatch(workflow, /group: data-s2-production-collection/);
  assert.doesNotMatch(live, /run-production-collection|CLOUDFLARE_D1_TOKEN|wrangler/);
});

test('qualification dispatches are serialized and never cancel an in-progress run', () => {
  const body = live;
  const start = body.indexOf('\nconcurrency:');
  assert.ok(start > 0);
  const block = body.slice(start, body.indexOf('\nenv:'));
  assert.match(block, /concurrency:\n  group: eia-2i5e-api-football-qualification\n  cancel-in-progress: false/);
  assert.equal([...workflow.matchAll(/group: eia-2i5e-api-football-qualification/g)].length, 1);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.doesNotMatch(live, /cancel-in-progress:\s*true/);
});

test('boundedFetch exists, does not inspect the request, and blocks a 12th network invocation before fetch', async () => {
  const driver = stepScript(workflow, '      - name: Invoke attended qualification runner once');
  const wrapperMatch = driver.match(/let actualEgressAttempts = 0;\nconst boundedFetch = async \(\.\.\.args\) => \{\n  if \(actualEgressAttempts >= MAX_PROVIDER_ATTEMPTS\) \{\n    throw new Error\('qualification_execution_attempt_ceiling_reached'\);\n  \}\n  actualEgressAttempts \+= 1;\n  return globalThis\.fetch\(\.\.\.args\);\n\};/);
  assert.ok(wrapperMatch, 'exact opaque boundedFetch wrapper');
  assert.match(driver, /fetchImpl: boundedFetch/);
  assert.match(driver, /actualEgressAttempts > MAX_PROVIDER_ATTEMPTS/);
  assert.match(driver, /actualEgressAttempts > attempts/);
  assert.doesNotMatch(wrapperMatch[0], /url|headers|apiKey|console\.|retry|wget|curl/);
  let fetchCalls = 0;
  const observed = [];
  const factory = new Function('fetchImpl', `
    const MAX_PROVIDER_ATTEMPTS = 11;
    const globalThis = { fetch: fetchImpl };
    ${wrapperMatch[0]}
    return { boundedFetch, getAttempts: () => actualEgressAttempts };
  `);
  const {boundedFetch, getAttempts} = factory(async (...args) => {
    fetchCalls += 1;
    observed.push(args);
    return {ok: true};
  });
  for (let i = 0; i < 11; i += 1) await boundedFetch('https://example.test/' + i, {method: 'GET'});
  assert.equal(fetchCalls, 11);
  assert.equal(getAttempts(), 11);
  await assert.rejects(
    () => boundedFetch('https://example.test/blocked', {headers: {secret: 'no'}}),
    error => error instanceof Error && error.message === 'qualification_execution_attempt_ceiling_reached'
  );
  assert.equal(fetchCalls, 11);
  assert.equal(getAttempts(), 11);
  assert.equal(observed.length, 11);
});

test('Grok, Codex and the workflow itself have no mechanism to print or retrieve the secret value', () => {
  assert.doesNotMatch(live, /echo "\$API_FOOTBALL_API_KEY"|echo \$API_FOOTBALL_API_KEY/);
  assert.doesNotMatch(live, /::add-mask::\$API_FOOTBALL_API_KEY/);
  assert.doesNotMatch(live, /fingerprint|sha256sum.*API_FOOTBALL|length of.*API_FOOTBALL/i);
  assert.match(workflow, /UI reruns are structurally blocked\. A new provider attempt requires a new manual workflow_dispatch/);
  assert.doesNotMatch(live, /A GitHub UI re-run is another provider attempt and requires fresh owner approval/);
});
