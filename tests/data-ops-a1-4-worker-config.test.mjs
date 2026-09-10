import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WATCHDOG_D1_BINDING,WATCHDOG_EMAIL_BINDING,WATCHDOG_GITHUB_TOKEN,
  WATCHDOG_OBSERVER_CLOCK_D1_BINDING}
  from '../workers/data-steward-watchdog/lib/environment-contract.mjs';
import {WATCHDOG_PROBLEMS,WATCHDOG_REASON_CODES} from '../workers/data-steward-watchdog/lib/reason-codes.mjs';
import {STEWARD_ENVIRONMENT_NAMES} from '../workers/data-steward/sentinels/environment-contract.mjs';

const stripJsoncComments=text=>text.split('\n')
  .filter(line=>!line.trim().startsWith('//')).join('\n');
const wrangler=JSON.parse(stripJsoncComments(
  fs.readFileSync('workers/data-steward-watchdog/wrangler.jsonc','utf8')));
const watchdogSource=fs.readFileSync('workers/data-steward-watchdog/watchdog.mjs','utf8');

test('the watchdog Worker holds its own dedicated identity, never a reused one',()=>{
  assert.equal(wrangler.name,'teamsheet-data-steward-watchdog');
  const otherNames=[
    JSON.parse(fs.readFileSync('workers/schedule-dispatcher/wrangler.jsonc','utf8')).name,
    JSON.parse(fs.readFileSync('workers/data-steward-observer-dispatcher/wrangler.jsonc','utf8')).name,
    JSON.parse(fs.readFileSync('workers/data-platform/wrangler.jsonc','utf8')).name,
    JSON.parse(fs.readFileSync('workers/evidence-archive/wrangler.jsonc','utf8')).name
  ];
  assert.ok(!otherNames.includes(wrangler.name));
});

test('the watchdog declares exactly paired 04:47 and 08:47 UTC Cloudflare Cron Triggers',()=>{
  assert.deepEqual(wrangler.triggers,{crons:['47 4 * * *','47 8 * * *']});
  assert.equal(wrangler.triggers.crons.length,2);
  assert.deepEqual(wrangler.triggers.crons.map(value=>value.split(' ')),
    [['47','4','*','*','*'],['47','8','*','*','*']]);
  assert.doesNotMatch(JSON.stringify(wrangler.triggers),/17 5,11,17,23|47 11|47 17|47 23/);
});

test('the watchdog owns one lifecycle D1 and reads one separate observer-clock D1',()=>{
  assert.equal(wrangler.d1_databases.length,2);
  const lifecycle=wrangler.d1_databases.find(row=>row.binding===WATCHDOG_D1_BINDING);
  const clock=wrangler.d1_databases.find(row=>row.binding===WATCHDOG_OBSERVER_CLOCK_D1_BINDING);
  assert.ok(lifecycle);
  assert.ok(clock);
  assert.equal(lifecycle.database_name,'teamsheet-data-steward-watchdog');
  assert.equal(clock.database_name,'teamsheet-data-steward-observer-clock');
  assert.notEqual(lifecycle.database_name,clock.database_name);
  for(const row of [lifecycle,clock]){
    assert.notEqual(row.database_name,'teamsheet-data');
    assert.notEqual(row.database_name,'teamsheet-evidence');
  }
  assert.equal(lifecycle.migrations_dir,'migrations');
  assert.equal(clock.migrations_dir,undefined,
    'watchdog may read the clock database but does not own its schema');
  assert.deepEqual(fs.readdirSync('workers/data-steward-watchdog/migrations'),
    ['0001_watchdog_foundation.sql']);
});

test('both tracked D1 database ids are inert placeholders, never fabricated live ids',()=>{
  assert.deepEqual(wrangler.d1_databases.map(row=>row.database_id),
    ['00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000']);
});

test('the send_email binding restricts delivery to exactly one fixed destination address',()=>{
  assert.equal(wrangler.send_email.length,1);
  assert.equal(wrangler.send_email[0].name,WATCHDOG_EMAIL_BINDING);
  assert.ok('destination_address' in wrangler.send_email[0],
    'destination_address (not allowed_destination_addresses, not omitted) is the maximally restrictive binding type');
  assert.ok(!('allowed_destination_addresses' in wrangler.send_email[0]));
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

test('no accidental binding beyond lifecycle D1, clock D1 and owner email',()=>{
  assert.deepEqual(Object.keys(wrangler).sort(),
    ['$schema','d1_databases','main','name','observability','preview_urls','send_email',
      'triggers','workers_dev','compatibility_date'].sort());
  assert.ok(!('kv_namespaces' in wrangler)&&!('r2_buckets' in wrangler)&&!('services' in wrangler)
    &&!('vars' in wrangler)&&!('durable_objects' in wrangler));
  assert.deepEqual(wrangler.d1_databases.map(row=>row.binding).sort(),
    [WATCHDOG_D1_BINDING,WATCHDOG_OBSERVER_CLOCK_D1_BINDING].sort());
});

test('the watchdog GitHub read credential is distinct from A1.3 runtime and dispatch credentials',()=>{
  assert.equal(WATCHDOG_GITHUB_TOKEN,'DATA_STEWARD_WATCHDOG_GITHUB_TOKEN');
  assert.ok(!STEWARD_ENVIRONMENT_NAMES.includes(WATCHDOG_GITHUB_TOKEN));
  assert.notEqual(WATCHDOG_GITHUB_TOKEN,'DATA_STEWARD_OBSERVER_DISPATCH_TOKEN');
  assert.notEqual(WATCHDOG_GITHUB_TOKEN,'GITHUB_DISPATCH_TOKEN');
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

function importedPaths(text){
  const paths=[];
  for(const match of text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g))paths.push(match[1]);
  for(const match of text.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g))paths.push(match[1]);
  return paths;
}

test('the watchdog package imports nothing from the FPL application, A1.3 observer runtime, or production Workers',()=>{
  const forbiddenPathFragment=/(^|\/)src\/|\/workers\/data-platform\/|\/workers\/schedule-dispatcher\/|\/workers\/data-steward-observer-dispatcher\/|\/workers\/evidence-archive\/|\/workers\/data-steward\/sentinels\/|\/workers\/data-steward\/[a-z-]+\.mjs$/;
  const forbiddenIdentities=/TEAMSHEET_DATA_DB|EVIDENCE_DB|EVIDENCE_BUCKET|GITHUB_DISPATCH_TOKEN|DATA_STEWARD_OBSERVER_DISPATCH_TOKEN/;
  for(const file of WATCHDOG_FILES){
    const text=fs.readFileSync(file,'utf8');
    for(const specifier of importedPaths(text))
      assert.doesNotMatch(specifier,forbiddenPathFragment,`${file} imports ${specifier}`);
    assert.doesNotMatch(text,forbiddenIdentities,file);
  }
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

test('observer-clock access is structurally SELECT-only inside the watchdog package',()=>{
  const reader=fs.readFileSync('workers/data-steward-watchdog/lib/observer-clock-reader.mjs','utf8');
  assert.match(reader,/SELECT opportunity_at,cron,dispatch_state,github_run_id/);
  assert.match(reader,/WHERE opportunity_at=\?1/);
  assert.doesNotMatch(reader,/\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bALTER\b|\bDROP\b/i);
  assert.doesNotMatch(reader,/\.run\(\)/);
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

test('the watchdog issues no HTTP POST; both D1 paths use native bindings',()=>{
  const posters=WATCHDOG_FILES.filter(file=>/method\s*:\s*['"]POST['"]/i.test(fs.readFileSync(file,'utf8')));
  assert.deepEqual(posters,[]);
  const repository=fs.readFileSync('workers/data-steward-watchdog/persistence/repository.mjs','utf8');
  const clockReader=fs.readFileSync('workers/data-steward-watchdog/lib/observer-clock-reader.mjs','utf8');
  assert.match(repository,/\.prepare\(/);
  assert.match(clockReader,/\.prepare\(/);
  assert.doesNotMatch(repository,/fetch\(/);
  assert.doesNotMatch(clockReader,/fetch\(/);
});

test('the watchdog migration remains isolated and non-destructive',()=>{
  const migration=fs.readFileSync('workers/data-steward-watchdog/migrations/0001_watchdog_foundation.sql','utf8');
  assert.doesNotMatch(migration,/DROP |ALTER |ATTACH |PRAGMA /i);
  assert.match(migration,/CREATE TABLE watchdog_observations/);
  assert.match(migration,/CREATE TABLE watchdog_incidents/);
  assert.match(migration,/CREATE TABLE watchdog_notifications/);
  assert.doesNotMatch(migration,/observer_dispatch_receipts/,
    'observer clock schema is owned by the dispatcher package, never by the watchdog');
});
