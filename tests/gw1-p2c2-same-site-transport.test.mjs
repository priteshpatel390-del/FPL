import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { credentialledCorsResponse, handleEvidenceArchiveRequest } from '../workers/evidence-archive.mjs';
import { allowedOrigins as fplAllowedOrigins, handleFplGatewayRequest } from '../workers/fpl-gateway.mjs';
import { deliveryEnvelope, envelopeText, outboxRow } from '../src/evidence/outbox.mjs';
import { stableStringify } from '../src/evidence/snapshot.mjs';

const APP='https://app.fpltsheet.co.uk';
const LEGACY='https://priteshpatel390-del.github.io';
const ARCHIVE='https://archive.fpltsheet.co.uk/v1/evidence/predeadline';
const ARCHIVE_ORIGIN='https://archive.fpltsheet.co.uk';
const EVIDENCE_ENV={ALLOWED_ORIGINS:`${LEGACY},${APP}`};

function archivePreflight(origin=APP){
  const headers=new Headers();
  if(origin) headers.set('Origin',origin);
  headers.set('Access-Control-Request-Method','POST');
  headers.set('Access-Control-Request-Headers','content-type');
  return new Request(ARCHIVE,{method:'OPTIONS',headers});
}
async function throughArchiveAdapter(request,env=EVIDENCE_ENV){
  const core=await handleEvidenceArchiveRequest(request,env,{});
  return credentialledCorsResponse(core,request,env);
}

test('GitHub Pages custom hostname is represented only by reviewed CNAME',()=>{
  assert.equal(readFileSync(new URL('../CNAME',import.meta.url),'utf8'),'app.fpltsheet.co.uk\n');
});

test('build owns the exact archive custom-domain endpoint and rejects the old workers.dev transport',()=>{
  const build=readFileSync(new URL('../build.mjs',import.meta.url),'utf8');
  assert.ok(build.includes(`const EVIDENCE_ARCHIVE_ENDPOINT = '${ARCHIVE}'`));
  assert.ok(build.includes("evidenceUrl.hostname !== 'archive.fpltsheet.co.uk'"));
  assert.ok(build.includes("evidenceUrl.pathname !== '/v1/evidence/predeadline'"));
  assert.ok(build.includes("evidenceUrl.hostname.endsWith('.workers.dev')"));
});

test('generated deployable carries exactly the custom archive endpoint and exact connect-src origin',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/name="teamsheet-evidence-archive" content="https:\/\/archive\.fpltsheet\.co\.uk\/v1\/evidence\/predeadline"/);
  assert.equal(html.includes('teamsheet-evidence-archive.fpltsheet.workers.dev/v1/evidence/predeadline'),false);
  const policy=/Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1]||'';
  const connect=policy.split(';').map(v=>v.trim()).find(v=>v.startsWith('connect-src'))||'';
  assert.ok(connect.includes(ARCHIVE_ORIGIN));
  assert.equal(connect.includes('*.workers.dev'),false);
  assert.equal(connect.includes('*-teamsheet-evidence-archive'),false);
});

test('archive migration allowlist is exact and keeps the legacy Pages origin only as a rollback path',()=>{
  const config=JSON.parse(readFileSync(new URL('../workers/evidence-wrangler.jsonc',import.meta.url),'utf8'));
  assert.equal(config.vars.ALLOWED_ORIGINS,`${LEGACY},${APP}`);
  assert.equal(config.preview_urls,false);
  assert.deepEqual(config.d1_databases.map(row=>row.binding),['EVIDENCE_DB']);
  assert.deepEqual(config.r2_buckets.map(row=>row.binding),['EVIDENCE_BUCKET']);
  assert.equal(config.vars.ALLOWED_ORIGINS.includes('*'),false);
});

test('new app origin receives exact credentialled archive preflight without wildcard CORS',async()=>{
  const result=await throughArchiveAdapter(archivePreflight());
  assert.equal(result.status,204);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'),APP);
  assert.equal(result.headers.get('Access-Control-Allow-Credentials'),'true');
  assert.equal(result.headers.get('Access-Control-Allow-Headers'),'Content-Type');
  assert.match(result.headers.get('Access-Control-Allow-Methods')||'',/(^|,\s*)POST(,|$)/);
  assert.notEqual(result.headers.get('Access-Control-Allow-Origin'),'*');
});

test('archive remains fail-closed for foreign and missing origins after migration',async()=>{
  for(const origin of ['https://example.com',null]){
    const result=await throughArchiveAdapter(archivePreflight(origin));
    assert.equal(result.status,403);
    assert.equal(result.headers.get('Access-Control-Allow-Origin'),null);
    assert.equal(result.headers.get('Access-Control-Allow-Credentials'),null);
  }
});

test('legacy Pages origin remains explicitly allowed during the rollback window',async()=>{
  const result=await throughArchiveAdapter(archivePreflight(LEGACY));
  assert.equal(result.status,204);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'),LEGACY);
  assert.equal(result.headers.get('Access-Control-Allow-Credentials'),'true');
});

test('Official FPL gateway admits only exact migration origins without changing its method contract',async()=>{
  const config=JSON.parse(readFileSync(new URL('../workers/wrangler.jsonc',import.meta.url),'utf8'));
  const allowed=fplAllowedOrigins({ALLOWED_ORIGINS:config.vars.ALLOWED_ORIGINS});
  assert.deepEqual([...allowed].sort(),[APP,LEGACY].sort());
  assert.equal(allowed.has('https://evil.fpltsheet.co.uk'),false);
  const request=new Request('https://teamsheet-fpl-gateway.fpltsheet.workers.dev/fpl/bootstrap-static/',{
    method:'OPTIONS',headers:{Origin:APP,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'Accept'}
  });
  const result=await handleFplGatewayRequest(request,{ALLOWED_ORIGINS:config.vars.ALLOWED_ORIGINS});
  assert.equal(result.status,204);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'),APP);
  assert.equal(result.headers.get('Access-Control-Allow-Methods'),'GET, HEAD, OPTIONS');
  assert.equal(result.headers.get('Access-Control-Allow-Headers'),'Accept');
});

test('canonical evidence bytes and content-hash idempotency stay transport-independent',()=>{
  const record={identity:{snapshotId:'predeadline-gw1-0123456789abcdef',contentHash:'a'.repeat(64)},season:'2026-27',gameweek:1,recordType:'preDeadlineSnapshot'};
  const row=outboxRow({snapshotId:record.identity.snapshotId,contentHash:record.identity.contentHash,season:record.season,gameweek:1,enqueuedAt:'2026-08-21T12:00:00.000Z'});
  const envelope=deliveryEnvelope(row,record);
  assert.equal(envelope.idempotencyKey,record.identity.contentHash);
  assert.equal(envelope.record,record);
  assert.equal(envelopeText(row,record),stableStringify(envelope));
  assert.equal(stableStringify(envelope.record),stableStringify(record));
});
