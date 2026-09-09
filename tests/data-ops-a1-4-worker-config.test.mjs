import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WATCHDOG_D1_BINDING,WATCHDOG_EMAIL_BINDING,WATCHDOG_GITHUB_TOKEN}
  from '../workers/data-steward-watchdog/lib/environment-contract.mjs';
import {WATCHDOG_PROBLEMS,WATCHDOG_REASON_CODES} from '../workers/data-steward-watchdog/lib/reason-codes.mjs';
import {STEWARD_ENVIRONMENT_NAMES} from '../workers/data-steward/sentinels/environment-contract.mjs';

const wrangler=JSON.parse(fs.readFileSync('workers/data-steward-watchdog/wrangler.jsonc','utf8'));
const watchdogSource=fs.readFileSync('workers/data-steward-watchdog/watchdog.mjs','utf8');

test('the watchdog Worker holds its own dedicated identity, never a reused one',()=>{
  assert.equal(wrangler.name,'teamsheet-data-steward-watchdog');
  const otherNames=[
    JSON.parse(fs.readFileSync('workers/schedule-dispatcher/wrangler.jsonc','utf8')).name,
    JSON.parse(fs.readFileSync('workers/data-platform/wrangler.jsonc','utf8')).name,
    JSON.parse(fs.readFileSync('workers/evidence-archive/wrangler.jsonc','utf8')).name
  ];
  assert.ok(!otherNames.includes(wrangler.name));
});

test('exactly one Cloudflare Cron Trigger entry, firing roughly every six hours',()=>{
  assert.equal(wrangler.triggers.crons.length,1,
    'one cron expression is preferred over several separate trigger entries');
  assert.match(wrangler.triggers.crons[0],/^\d{1,2} \d{1,2}(?:,\d{1,2}){0,3} \* \* \*$/);
  const hours=wrangler.triggers.crons[0].split(' ')[1].split(',').map(Number);
  assert.equal(hours.length,4,'roughly every six hours across one UTC day');
  for(let i=1;i<hours.length;i+=1)assert.equal(hours[i]-hours[i-1],6);
});

test('the D1 binding is its own isolated database, never the production or evidence one',()=>{
  assert.equal(wrangler.d1_databases.length,1);
  assert.equal(wrangler.d1_databases[0].binding,WATCHDOG_D1_BINDING);
  assert.notEqual(wrangler.d1_databases[0].database_name,'teamsheet-data');
  assert.equal(wrangler.d1_databases[0].migrations_dir,'migrations');
  assert.deepEqual(fs.readdirSync('workers/data-steward-watchdog/migrations'),
    ['0001_watchdog_foundation.sql']);
});

test('the send_email binding restricts delivery to exactly one fixed destination address',()=>{
  assert.equal(wrangler.send_email.length,1);
  assert.equal(wrangler.send_email[0].name,WATCHDOG_EMAIL_BINDING);
  assert.ok('destination_address' in wrangler.send_email[0],
    'destination_address (not allowed_destination_addresses, not omitted) is the maximally restrictive binding type');
  assert.ok(!('allowed_destination_addresses' in wrangler.send_email[0]));
  // The tracked repository never carries the owner's real address. The placeholder is
  // structurally invalid as a real destination and must be replaced locally, uncommitted, before
  // any live deployment — see the A1.4 design doc's live-closeout instructions.
  assert.match(wrangler.send_email[0].destination_address,/^REPLACE_LOCALLY_BEFORE_DEPLOY@/);
  assert.doesNotMatch(JSON.stringify(wrangler),/gmail\.com|priteshpatel390/i);
});

test('no public HTTP surface, no workers.dev, no route, no custom domain',()=>{
  assert.equal(wrangler.workers_dev,false);
  assert.equal(wrangler.preview_urls,false);
  assert.ok(!('routes' in wrangler));
  assert.doesNotMatch(watchdogSource,/export\s+default\s*\{[^}]*\bfetch\s*[(:]/s);
  assert.match(watchdogSource,/async scheduled\(/);
});

test('no accidental binding beyond the three the environment contract names',()=>{
  assert.deepEqual(Object.keys(wrangler).sort(),
    ['$schema','d1_databases','main','name','observability','preview_urls','send_email',
      'triggers','workers_dev','compatibility_date'].sort());
  assert.ok(!('kv_namespaces' in wrangler)&&!('r2_buckets' in wrangler)&&!('services' in wrangler)
    &&!('vars' in wrangler)&&!('durable_objects' in wrangler));
});

test('the watchdog GitHub credential is its own, distinct from every A1.3 environment name',()=>{
  assert.equal(WATCHDOG_GITHUB_TOKEN,'DATA_STEWARD_WATCHDOG_GITHUB_TOKEN');
  assert.ok(!STEWARD_ENVIRONMENT_NAMES.includes(WATCHDOG_GITHUB_TOKEN));
});

test('the closed reason-code and problem vocabularies cannot be widened at runtime',()=>{
  assert.ok(Object.isFrozen(WATCHDOG_REASON_CODES));
  assert.ok(Object.isFrozen(WATCHDOG_PROBLEMS));
  assert.throws(()=>{WATCHDOG_PROBLEMS.NEW_PROBLEM={problemClass:'X',component:'y'};},TypeError);
  for(const code of WATCHDOG_REASON_CODES)assert.match(code,/^[A-Z][A-Z0-9_]{1,63}$/);
});

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true})
    .flatMap(entry=>entry.isDirectory()?walk(`${dir}/${entry.name}`)
      :entry.name.endsWith('.mjs')?[`${dir}/${entry.name}`]:[]);
}
const WATCHDOG_FILES=walk('workers/data-steward-watchdog');

test('the watchdog package never imports the production platform, dispatcher or evidence archive',()=>{
  const forbidden=/workers\/data-platform|workers\/schedule-dispatcher|workers\/evidence-archive|TEAMSHEET_DATA_DB|EVIDENCE_DB|EVIDENCE_BUCKET|GITHUB_DISPATCH_TOKEN/;
  for(const file of WATCHDOG_FILES)assert.doesNotMatch(fs.readFileSync(file,'utf8'),forbidden,file);
});

test('the watchdog package builds no GitHub write, Cloudflare mutation or generic actuator surface',()=>{
  for(const file of WATCHDOG_FILES){
    const text=fs.readFileSync(file,'utf8');
    assert.doesNotMatch(text,/\/dispatches|\/rerun|\/cancel|\/actions\/permissions|\/actions\/secrets|\/merges?\b|\/pulls\b|\/issues\b/i,file);
    assert.doesNotMatch(text,/\/versions\b|\/scripts\/[^/'"`]*\/?(?:content|secrets|routes|domains|subdomain)|\/cron_triggers|\/purge_cache/i,file);
    assert.doesNotMatch(text,/child_process|spawn(?:Sync)?\s*\(|exec(?:File|Sync)?\s*\(|process\.env/,file);
    assert.doesNotMatch(text,/function\s+(?:runShell|runSql|httpRequest|apiCall|execute[A-Z])/,file);
    assert.doesNotMatch(text,/\bworkflow_dispatch\b.*method\s*:\s*['"]POST['"]|method\s*:\s*['"]POST['"][^;]*dispatches/is,file);
  }
});

test('the whole-application source stays unaware the watchdog exists, in both directions',()=>{
  const applicationFiles=[...walk('src'),'app.html'];
  for(const file of applicationFiles){
    const text=fs.readFileSync(file,'utf8');
    assert.doesNotMatch(text,/data-steward-watchdog|runWatchdogCycle/i,file);
  }
  const dataSteward=walk('workers/data-steward');
  for(const file of dataSteward)
    assert.doesNotMatch(fs.readFileSync(file,'utf8'),/data-steward-watchdog/i,file);
});

test('only the D1 sentinel-style repository module ever issues a POST, and only to its own database',()=>{
  const posters=WATCHDOG_FILES.filter(file=>/method\s*:\s*['"]POST['"]/i.test(fs.readFileSync(file,'utf8')));
  assert.deepEqual(posters,[]);
  // The D1 access path is the native Worker binding (`db.prepare(...).bind(...).run()`), not an
  // HTTP call at all, so there is no POST request to find — this assertion pins that shape.
  const repository=fs.readFileSync('workers/data-steward-watchdog/persistence/repository.mjs','utf8');
  assert.match(repository,/\.prepare\(/);
  assert.doesNotMatch(repository,/fetch\(/);
});

test('the migration file declares no destructive or schema-widening statement',()=>{
  const migration=fs.readFileSync('workers/data-steward-watchdog/migrations/0001_watchdog_foundation.sql','utf8');
  assert.doesNotMatch(migration,/DROP |ALTER |ATTACH |PRAGMA /i);
  assert.match(migration,/CREATE TABLE watchdog_observations/);
  assert.match(migration,/CREATE TABLE watchdog_incidents/);
  assert.match(migration,/CREATE TABLE watchdog_notifications/);
});
