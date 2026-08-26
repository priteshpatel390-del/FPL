import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const read = path => readFileSync(join(ROOT, path), 'utf8');

function filesUnder(dir){
  const root = join(ROOT, dir);
  const out = [];
  for(const name of readdirSync(root)){
    const path = join(root, name);
    if(statSync(path).isDirectory()) out.push(...filesUnder(relative(ROOT, path)));
    else out.push(relative(ROOT, path).replaceAll('\\', '/'));
  }
  return out;
}

const RESET_DOC = 'docs/DATA-S1C-PRIVATE-SERVICE-BINDING-RPC.md';
const RPC_ARCHIVE = 'docs/historical/data-s1c-r-baseline/DATA-S1C-PRIVATE-SERVICE-BINDING-RPC.md';

// DATA-S1C-R is a documentation/control checkpoint. These guards deliberately
// protect the negative space: no new application runtime path, data asset or
// silent promotion from shadow storage into recommendations.

test('DATA-S1C-R record pins canonical core, enrichment, history and owner-overlay boundaries', () => {
  const doc = read(RESET_DOC);
  for(const phrase of [
    'Official FPL canonical current core',
    'Approved enrichment is a separate layer',
    'Historical/shadow store',
    'Owner overlay stays separate',
    'Current-state revision',
    'Player-team context revision',
    'Fixture context revision',
    'DATA-S2 remains blocked'
  ]) assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(doc, /D1 observation being `accepted`[\s\S]*does \*\*not\*\* mean it is approved for production recommendations/);
});

test('stable DATA-S1C path carries the reset while the superseded RPC design remains archived', () => {
  assert.ok(existsSync(join(ROOT, RPC_ARCHIVE)), 'historical RPC record must remain present');
  const archive = read(RPC_ARCHIVE);
  assert.match(archive, /Run `32906524221`/);
  assert.match(archive, /direct-target diagnostic harness awaits separately approved execution/);
  const current = read(RESET_DOC);
  assert.match(current, /^# DATA-S1C-R — Data Architecture Reset/m);
  assert.match(current, /retired from the forward architecture/);
  assert.match(current, /docs\/historical\/data-s1c-r-baseline\/DATA-S1C-PRIVATE-SERVICE-BINDING-RPC\.md/);
});

test('existing canonical DATA-S1C pointers resolve directly to the reset authority', () => {
  for(const path of ['CLAUDE.md', 'docs/PROJECT_CONTEXT.md', 'docs/ARCHITECTURE.md', 'docs/ROADMAP.md']){
    const text = read(path);
    assert.match(text, /DATA-S1C-PRIVATE-SERVICE-BINDING-RPC\.md/, `${path} must retain its stable DATA-S1C design pointer`);
  }
  assert.match(read(RESET_DOC), /This record is the current DATA-S1C forward architecture/);
});

test('production application source has no DATA-S1 runtime dependency', () => {
  const forbidden = [
    'data.fpltsheet.co.uk',
    '/v1/shadow/observations',
    'DATA_S1_HTTP_',
    'DataPlatformReadEntrypoint',
    'DataPlatformIngestEntrypoint'
  ];
  for(const path of filesUnder('src').filter(path => path.endsWith('.mjs'))){
    const text = read(path);
    for(const token of forbidden) assert.equal(text.includes(token), false, `${path} must not gain DATA-S1 runtime token ${token}`);
  }
});

test('single-file build remains independent of a DATA-S1 static read-model asset', () => {
  const build = read('build.mjs');
  for(const token of ['current-season.json', 'current-season.js', 'data.fpltsheet.co.uk', '/v1/shadow/observations']){
    assert.equal(build.includes(token), false, `build.mjs must not add ${token}`);
  }
  assert.match(build, /writeFileSync\('dist\/index\.html', html\)/);
  assert.match(build, /writeFileSync\('index\.html', html\)/);
});

test('RPC acceptance assets are retained as historical rollback evidence and remain manual-only', () => {
  const workflowPath = '.github/workflows/data-s1c-private-rpc-acceptance.yml';
  assert.ok(existsSync(join(ROOT, workflowPath)), 'RPC acceptance workflow must not be deleted in DATA-S1C-R');
  const workflow = read(workflowPath);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\bschedule:/);
  assert.doesNotMatch(workflow, /\bpush:/);
  assert.doesNotMatch(workflow, /\bpull_request:/);
});

test('shadow storage remains shadow-only and is not promoted by architecture reset', () => {
  const migration = read('workers/data-platform/migrations/0001_shadow_data_foundation.sql');
  assert.match(migration, /CHECK\(mode='shadow_only'\)/);
  const doc = read(RESET_DOC);
  assert.match(doc, /Its `shadow_only` boundary remains in force/);
  assert.match(doc, /No production read-model endpoint or static asset is created by DATA-S1C-R/);
});