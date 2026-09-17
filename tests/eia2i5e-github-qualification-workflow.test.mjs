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
