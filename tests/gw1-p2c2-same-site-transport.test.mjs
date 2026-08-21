import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { credentialledCorsResponse, handleEvidenceArchiveRequest } from '../workers/evidence-archive.mjs';
import { handleFplGatewayRequest } from '../workers/fpl-gateway.mjs';

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

/* Behavioural migration coverage.
   ------------------------------
   The assertions above pin the exact allowlist *strings*. These pin what the
   Workers actually do with them. Neither Worker hard-codes the new application
   origin — `DEFAULT_ALLOWED_ORIGINS` in both sources remains the single legacy
   GitHub Pages origin, and `app.fpltsheet.co.uk` is admitted only through the
   deployed `ALLOWED_ORIGINS` var. So the env below is read from the same
   Wrangler configuration the tests above pin, and a config that stopped
   carrying the new origin would fail here rather than pass silently. */
function deployedEnv(path){
  const wrangler = JSON.parse(text(path));
  return {...wrangler.vars};
}
const FOREIGN_ORIGIN = 'https://evil.example';
const PREVIEW_ORIGIN = 'https://8f2a-teamsheet-evidence-archive.fpltsheet.workers.dev';

function archivePreflight(origin,{method='POST',headers='content-type'}={}){
  const requestHeaders = new Headers();
  if(origin) requestHeaders.set('Origin',origin);
  if(method) requestHeaders.set('Access-Control-Request-Method',method);
  if(headers) requestHeaders.set('Access-Control-Request-Headers',headers);
  return new Request(`${ARCHIVE_ORIGIN}/v1/evidence/predeadline`,{method:'OPTIONS',headers:requestHeaders});
}
async function throughArchiveAdapter(request,env){
  return credentialledCorsResponse(await handleEvidenceArchiveRequest(request,env,{}),request,env);
}

test('the deployed archive configuration actually admits the new application origin',async()=>{
  const env = deployedEnv('workers/evidence-wrangler.jsonc');
  for(const origin of [APP_ORIGIN,LEGACY_APP_ORIGIN]){
    const result = await throughArchiveAdapter(archivePreflight(origin),env);
    assert.equal(result.status,204,origin);
    assert.equal(result.headers.get('Access-Control-Allow-Origin'),origin,origin);
    assert.notEqual(result.headers.get('Access-Control-Allow-Origin'),'*',origin);
    assert.equal(result.headers.get('Access-Control-Allow-Credentials'),'true',origin);
    assert.match(result.headers.get('Access-Control-Allow-Methods')||'',/(^|,\s*)POST(,|$)/,origin);
    assert.equal(result.headers.get('Access-Control-Allow-Headers'),'Content-Type',origin);
    assert.equal(result.headers.get('Vary'),'Origin',origin);
  }
});

test('the deployed archive configuration stays fail-closed for every other origin',async()=>{
  const env = deployedEnv('workers/evidence-wrangler.jsonc');
  /* A preview/version hostname is included deliberately: `preview_urls` is
     false, and even if one were reachable it must never be a trusted origin. */
  for(const origin of [FOREIGN_ORIGIN,PREVIEW_ORIGIN,'http://app.fpltsheet.co.uk',
    'https://app.fpltsheet.co.uk.evil.example','https://fpltsheet.co.uk']){
    const result = await throughArchiveAdapter(archivePreflight(origin),env);
    assert.equal(result.status,403,origin);
    assert.equal(result.headers.get('Access-Control-Allow-Origin'),null,origin);
    assert.equal(result.headers.get('Access-Control-Allow-Credentials'),null,origin);
  }
  /* No Origin at all is not an approved origin either. */
  const anonymous = await throughArchiveAdapter(archivePreflight(null),env);
  assert.equal(anonymous.headers.get('Access-Control-Allow-Credentials'),null);
});

/* Bindings are deliberately absent from Wrangler `vars`, and the archive checks
   its D1/R2 bindings before it routes. Supplying healthy stand-ins here is what
   makes the routing assertions below meaningful rather than a 503 that would
   pass for the wrong reason; nothing about D1/R2 schema or layout is exercised
   or changed by them. */
function boundEnv(path){
  const db={prepare(sql){
    const statement={bind(){return statement;},first(){
      if(sql.includes('rate_limit_windows')) return Promise.resolve({request_count:1});
      if(sql.includes('schema_migrations')) return Promise.resolve({version:1});
      return Promise.reject(new Error(`Unexpected D1 first(): ${sql}`));
    }};
    return statement;
  }};
  return {...deployedEnv(path),EVIDENCE_DB:db,EVIDENCE_BUCKET:{list:async()=>({objects:[],truncated:false,cursor:null})}};
}

test('the archive admits the new origin only on the exact ingestion path and method',async()=>{
  const env = boundEnv('workers/evidence-wrangler.jsonc');
  const wrongMethod = await throughArchiveAdapter(archivePreflight(APP_ORIGIN,{method:'DELETE'}),env);
  assert.equal(wrongMethod.status,405);
  assert.equal(wrongMethod.headers.get('Access-Control-Allow-Methods'),null);

  /* An approved origin buys the exact ingestion path and nothing adjacent to
     it, and an unauthenticated POST is never accepted on strength of origin. */
  const authorised = {authVerifier:async()=>({sub:'owner'})};
  for(const path of ['/v1/evidence/predeadline/extra','/v1/evidence','/v1/admin/reconcile','/']){
    const request = new Request(`${ARCHIVE_ORIGIN}${path}`,{method:'POST',headers:new Headers({Origin:APP_ORIGIN})});
    const core = await handleEvidenceArchiveRequest(request,env,authorised);
    const routed = credentialledCorsResponse(core,request,env);
    assert.ok(routed.status>=400,`${path} must not succeed, got ${routed.status}`);
    assert.notEqual(routed.status,200,path);
    assert.notEqual(routed.status,201,path);
  }
});

test('the Official FPL gateway admits the new origin without widening its route or method contract',async()=>{
  const env = deployedEnv('workers/wrangler.jsonc');
  const preflight = (origin,method='GET')=>{
    const headers = new Headers();
    if(origin) headers.set('Origin',origin);
    headers.set('Access-Control-Request-Method',method);
    return new Request('https://gateway.example/fpl/bootstrap-static/',{method:'OPTIONS',headers});
  };
  for(const origin of [APP_ORIGIN,LEGACY_APP_ORIGIN]){
    const allowed = await handleFplGatewayRequest(preflight(origin),env,{});
    assert.equal(allowed.status,204,origin);
    assert.equal(allowed.headers.get('Access-Control-Allow-Origin'),origin,origin);
    assert.notEqual(allowed.headers.get('Access-Control-Allow-Origin'),'*',origin);
    /* Read-only semantics are unchanged by the migration: no POST, and the
       gateway never grants credentials the way the archive deliberately does. */
    assert.equal(allowed.headers.get('Access-Control-Allow-Methods'),'GET, HEAD, OPTIONS',origin);
    assert.equal(allowed.headers.get('Access-Control-Allow-Credentials'),null,origin);

    const write = await handleFplGatewayRequest(preflight(origin,'POST'),env,{});
    assert.equal(write.status,405,origin);

    const headers = new Headers({Origin:origin});
    const badRoute = new Request('https://gateway.example/fpl/entry/0/',{headers});
    assert.equal((await handleFplGatewayRequest(badRoute,env,{})).status,404,origin);
  }
  const foreign = await handleFplGatewayRequest(preflight(FOREIGN_ORIGIN),env,{});
  assert.equal(foreign.status,403);
  assert.equal(foreign.headers.get('Access-Control-Allow-Origin'),null);
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
