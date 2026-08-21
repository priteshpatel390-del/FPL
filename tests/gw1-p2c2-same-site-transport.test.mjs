import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const APP_ORIGIN = 'https://app.fpltsheet.co.uk';
const LEGACY_APP_ORIGIN = 'https://priteshpatel390-del.github.io';
const ARCHIVE_ORIGIN = 'https://archive.fpltsheet.co.uk';
const ARCHIVE_ENDPOINT = `${ARCHIVE_ORIGIN}/v1/evidence/predeadline`;
const LEGACY_ARCHIVE_ORIGIN = 'https://teamsheet-evidence-archive.fpltsheet.workers.dev';

function text(path){
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}
function exactMigrationOrigins(path){
  const wrangler = JSON.parse(text(path));
  return String(wrangler.vars?.ALLOWED_ORIGINS || '').split(',').map(value=>value.trim()).filter(Boolean);
}

test('GitHub Pages custom hostname is prepared through the reviewed repository CNAME',()=>{
  assert.equal(text('CNAME'),'app.fpltsheet.co.uk\n');
});

test('GW1-P2C2 production build emits only the approved sibling-subdomain archive target',()=>{
  const build = text('build.mjs');
  assert.match(build,/const EVIDENCE_ARCHIVE_ENDPOINT = 'https:\/\/archive\.fpltsheet\.co\.uk\/v1\/evidence\/predeadline';/);
  assert.match(build,/hostname !== 'archive\.fpltsheet\.co\.uk'/);

  const html = text('index.html');
  assert.ok(html.includes(`name="teamsheet-evidence-archive" content="${ARCHIVE_ENDPOINT}"`));
  assert.equal(html.includes(`name="teamsheet-evidence-archive" content="${LEGACY_ARCHIVE_ORIGIN}/v1/evidence/predeadline"`),false);

  const policy = /Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1] || '';
  const connect = policy.split(';').map(part=>part.trim()).find(part=>part.startsWith('connect-src')) || '';
  assert.ok(connect.includes(ARCHIVE_ORIGIN));
  assert.equal(connect.includes(LEGACY_ARCHIVE_ORIGIN),false);
  assert.equal(connect.includes('*.fpltsheet.co.uk'),false);
  assert.equal(connect.includes('*.workers.dev'),false);
});

test('GW1-P2C2 keeps both Worker migration allowlists exact and rollback-safe',()=>{
  // The deployable archive build root is what Cloudflare actually reads, so the exact
  // migration allowlist is pinned there too, not only in the verified source config.
  for(const path of ['workers/wrangler.jsonc','workers/evidence-wrangler.jsonc','workers/evidence-archive/wrangler.jsonc']){
    const origins = exactMigrationOrigins(path);
    assert.deepEqual(origins,[LEGACY_APP_ORIGIN,APP_ORIGIN],path);
    assert.equal(origins.some(origin=>origin.includes('*')),false,path);
    assert.equal(new Set(origins).size,origins.length,path);
  }

  const archive = JSON.parse(text('workers/evidence-wrangler.jsonc'));
  assert.equal(archive.workers_dev,true,'workers.dev remains available only as rollback/diagnostic infrastructure');
  assert.equal(archive.preview_urls,false);
  assert.deepEqual(archive.routes,[{pattern:'archive.fpltsheet.co.uk',custom_domain:true}]);
  assert.deepEqual(archive.d1_databases.map(row=>row.binding),['EVIDENCE_DB']);
  assert.deepEqual(archive.r2_buckets.map(row=>row.binding),['EVIDENCE_BUCKET']);
});

test('the browser delivery semantics remain credentialled CORS and independent of recommendations',()=>{
  const delivery = text('src/ui/evidence-delivery.mjs');
  const evidence = text('src/ui/evidence.mjs');
  assert.match(delivery,/credentials:'include'/);
  assert.match(delivery,/mode:'cors'/);
  assert.match(delivery,/method:'POST'/);
  assert.equal(evidence.includes('evidence-delivery.mjs'),false,'Stage 10 capture must not depend on delivery');
  assert.equal(evidence.includes('fetch('),false,'Stage 10 capture must not contact the archive');
});

test('PR #137 remains the single Cloudflare adapter authority for credential permission',()=>{
  const adapter = text('workers/evidence-archive.mjs');
  const core = text('workers/evidence-archive-core.mjs');
  assert.match(adapter,/Access-Control-Allow-Credentials/);
  assert.match(adapter,/Access-Control-Allow-Origin/);
  assert.equal(core.includes('Access-Control-Allow-Credentials'),false,
    'credential permission must not be duplicated into the archive core');
});
