import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RESEARCH_ROOT = resolve(ROOT, 'docs/research');
const read = path => readFileSync(resolve(ROOT, path), 'utf8');
const fail = message => { throw new Error(`research documentation integrity: ${message}`); };

const BRANCHES = Object.freeze([
  'docs/research/01-TEAM-STRENGTH/RESEARCH-TEAM-STRENGTH.md',
  'docs/research/02-RECENT-FORM/RESEARCH-UNDERSTAT-ALTERNATIVES.md',
  'docs/research/03-MARKET/RESEARCH-MARKET-MODEL.md',
  'docs/research/04-CALENDAR-WORKLOAD/RESEARCH-CALENDAR-WORKLOAD.md',
  'docs/research/04-CALENDAR-WORKLOAD/RESEARCH-NON-PL-PLAYER-WORKLOAD.md',
  'docs/research/05-AVAILABILITY/RESEARCH-AVAILABILITY.md',
  'docs/research/05-AVAILABILITY/RESEARCH-PREDICTED-LINEUPS.md',
  'docs/research/06-PLAYER-ROLES/RESEARCH-PLAYER-ROLE-CHANGES.md',
  'docs/research/07-TRANSFERS-OPTIMISATION/RESEARCH-FPL-OPTIMISERS.md',
  'docs/research/08-HISTORICAL-EVALUATION/RESEARCH-HISTORICAL-EVALUATION.md',
  'docs/research/09-EXTERNAL-REPOSITORIES/RESEARCH-EXTERNAL-REPOSITORIES.md',
  'docs/research/10-SHADOW-ARCHITECTURE/RESEARCH-SHADOW-IMPLEMENTATION-DESIGN.md',
  'docs/research/11-GW1-EVIDENCE/GW1-RESEARCH-EVIDENCE-READINESS.md'
]);

const REQUIRED_HEADINGS = Object.freeze([
  'Research question',
  'Current Teamsheet behaviour',
  'Why this matters',
  'Candidate sources / repositories / approaches',
  'Exact fields or observations required',
  'Coverage',
  'Freshness / update cadence',
  'Reliability',
  'Historical availability',
  'Cost / free-tier constraints',
  'Rights / licensing / retention',
  'Security / privacy',
  'Canonical identity / mapping requirements',
  'Proposed provider-neutral / shadow contract',
  'Fallback behaviour',
  'Failure modes',
  'Double-counting / leakage risks',
  'Validation / ablation plan',
  'Required tests',
  'Evidence required before production use',
  'Current recommendation',
  'Explicit implementation approval gate'
]);

function markdownFiles(directory) {
  const found = [];
  for (const entry of readdirSync(directory)) {
    const absolute = resolve(directory, entry);
    if (statSync(absolute).isDirectory()) found.push(...markdownFiles(absolute));
    else if (entry.endsWith('.md')) found.push(relative(ROOT, absolute));
  }
  return found.sort();
}

function localMarkdownTargets(sourcePath) {
  const source = read(sourcePath);
  const sourceDirectory = dirname(resolve(ROOT, sourcePath));
  const targets = [];
  for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(raw)) continue;
    const path = raw.split('#', 1)[0];
    if (!path.endsWith('.md')) continue;
    targets.push(resolve(sourceDirectory, path));
  }
  return targets;
}

if (!existsSync(RESEARCH_ROOT)) fail('docs/research is missing');
if (existsSync(resolve(RESEARCH_ROOT, 'EXTERNAL-INTELLIGENCE-FOUNDATION.md'))) {
  fail('duplicate Foundation exists under docs/research; canonical root must remain docs/EXTERNAL-INTELLIGENCE-FOUNDATION.md');
}

const expectedFiles = new Set(['docs/research/README.md', 'docs/research/RESEARCH-TEMPLATE.md', ...BRANCHES]);
const actualFiles = markdownFiles(RESEARCH_ROOT);
for (const path of expectedFiles) if (!actualFiles.includes(path)) fail(`missing required record: ${path}`);
if (actualFiles.length !== expectedFiles.size) {
  const unexpected = actualFiles.filter(path => !expectedFiles.has(path));
  fail(`unexpected/unregistered Markdown record(s): ${unexpected.join(', ') || 'count mismatch'}`);
}

const index = read('docs/research/README.md');
if (!index.includes('(../EXTERNAL-INTELLIGENCE-FOUNDATION.md)')) fail('research index does not point to the unmoved Foundation');
if (!index.includes('(RESEARCH-TEMPLATE.md)')) fail('research index does not point to the standard template');
for (const path of BRANCHES) {
  const relativeFromResearch = path.replace(/^docs\/research\//, '');
  if (!index.includes(`(${relativeFromResearch})`)) fail(`research index does not register: ${path}`);
}

for (const sourcePath of actualFiles) {
  for (const target of localMarkdownTargets(sourcePath)) {
    if (!existsSync(target)) fail(`${sourcePath} links to missing file: ${relative(ROOT, target)}`);
  }
}

for (const path of ['docs/research/RESEARCH-TEMPLATE.md', ...BRANCHES]) {
  const text = read(path);
  for (const [index, heading] of REQUIRED_HEADINGS.entries()) {
    if (!text.includes(`## ${index + 1}. ${heading}`)) fail(`${path} missing standard heading ${index + 1}: ${heading}`);
  }
}

for (const path of BRANCHES) {
  const text = read(path);
  if (!/Status: \*\*(?:Planned|Investigating|Research complete|Awaiting evidence|Ready for approval|Approved for implementation|Deferred|Rejected)\*\*/.test(text)) {
    fail(`${path} has no valid programme status`);
  }
  if (!/Implementation approval: \*\*Not granted\*\*/.test(text)) fail(`${path} does not record its implementation approval as not granted`);
  if (!/Production effect: \*\*None\*\*/.test(text)) fail(`${path} does not record zero production effect`);
}

const externalRepos = read('docs/research/09-EXTERNAL-REPOSITORIES/RESEARCH-EXTERNAL-REPOSITORIES.md');
for (const repository of [
  'alan-turing-institute/AIrsenal',
  'solioanalytics/open-fpl-solver',
  'amosbastian/understat',
  'openfootball/football.json',
  'vaastav/Fantasy-Premier-League',
  'jeppe-smith/fpl-api'
]) {
  if (!externalRepos.includes(repository)) fail(`external repository candidate is not preserved: ${repository}`);
}

const claude = read('CLAUDE.md');
if (!claude.includes('(docs/research/README.md)')) fail('CLAUDE.md does not direct future work to the research control centre');

console.log(`Research documentation integrity verified: ${BRANCHES.length} branches, ${actualFiles.length} Markdown records, all local links resolved.`);
