import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { scrubOddsSecret, forgetOddsKey } from '../src/providers/odds.mjs';
import { S } from '../src/state.mjs';
import { getHealth } from '../src/providers/registry.mjs';

const html = () => readFileSync('dist/index.html','utf8');
const bundle = () => readFileSync('dist/app.bundle.js','utf8');
const manifest = () => JSON.parse(readFileSync('dist/manifest.json','utf8'));
const sha256 = value => 'sha256-' + createHash('sha256').update(value,'utf8').digest('base64');

test('odds secret scrubber removes raw and encoded key material plus apiKey values', () => {
  const key = 'sentinel key/+?';
  const encoded = encodeURIComponent(key);
  const input = `failed ${key} https://example.test/?apiKey=${encoded}&x=1`;
  const out = scrubOddsSecret(input,key);
  assert.equal(out.includes(key),false);
  assert.equal(out.includes(encoded),false);
  assert.match(out,/apiKey=\[REDACTED\]/);
});

test('forget odds key clears field, storage property and active odds state', async () => {
  const field = { value:'sentinel-secret' };
  let stored = null;
  S.odds = { '1|2': { xGH:1.2 } };
  S.oddsNote = 'active';
  const result = await forgetOddsKey({
    field,
    getConfig: async () => ({teamId:'123',oddsKey:'sentinel-secret',useUstat:true}),
    setConfig: async value => { stored = value; }
  });
  assert.equal(field.value,'');
  assert.deepEqual(result,{teamId:'123',useUstat:true});
  assert.deepEqual(stored,result);
  assert.equal(S.odds,null);
  assert.equal(S.oddsNote,'');
  assert.equal(getHealth('odds').state,'Disabled');
});

test('storage source omits an empty odds key rather than persisting an empty secret', () => {
  const source = readFileSync('src/storage.mjs','utf8');
  assert.match(source,/if\(oddsKey\) config\.oddsKey = oddsKey/);
  assert.doesNotMatch(source,/oddsKey:\s*\$\('oddsKey'\)/);
});

test('built UI masks the key and provides the one-action forget control', () => {
  const js = bundle();
  assert.match(js,/oddsFieldForSecurity\.type = 'password'/);
  assert.match(js,/id:'forgetOddsKey'/);
  assert.match(js,/await forgetOddsKey\(\)/);
});

test('CSP hashes independently match the exact emitted inline script and style', () => {
  const page = html();
  const scripts = [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  const styles = [...page.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)];
  const policy = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)">/.exec(page)?.[1];
  assert.equal(scripts.length,1);
  assert.equal(styles.length,1);
  assert.ok(policy);
  assert.ok(policy.includes(`script-src '${sha256(scripts[0][1])}'`));
  assert.ok(policy.includes(`style-src-elem '${sha256(styles[0][1])}'`));
});

test('CSP removes every unsafe-inline concession and retains provider origins', () => {
  const policy = /Content-Security-Policy"\s+content="([^"]+)"/.exec(html())?.[1] || '';
  assert.ok(policy.includes("default-src 'none'"));
  assert.equal(policy.includes("'unsafe-inline'"),false);
  assert.equal(policy.includes('style-src-attr'),false);
  for(const origin of [
    'https://api.allorigins.win','https://corsproxy.io',
    'https://api.codetabs.com','https://thingproxy.freeboard.io','https://understat.com',
    'https://api.the-odds-api.com','https://raw.githubusercontent.com','https://api.anthropic.com'
  ]) assert.ok(policy.includes(origin),origin);
  assert.equal(policy.includes('https://fantasy.premierleague.com'),false,'browser must not contact Official FPL directly');
  assert.match(readFileSync('app.html','utf8'),/name="teamsheet-fpl-gateway" content="https:\/\/teamsheet-fpl-gateway\.fpltsheet\.workers\.dev\/fpl"/);
assert.ok(policy.includes('https://teamsheet-fpl-gateway.fpltsheet.workers.dev'));
assert.equal(policy.includes('*-teamsheet-fpl-gateway'),false);
  assert.ok(policy.includes("object-src 'none'"));
  assert.ok(policy.includes("base-uri 'none'"));
  assert.ok(policy.includes("form-action 'self'"));
  assert.ok(policy.includes("frame-ancestors 'none'"));
});


test('source and generated deployable contain no inline style attributes or runtime style APIs', () => {
  const sourceFiles = ['app.html'];
  const walk = dir => {
    for(const entry of readdirSync(dir,{withFileTypes:true})){
      const path = `${dir}/${entry.name}`;
      if(entry.isDirectory()) walk(path);
      else if(/\.(?:mjs|js|html)$/.test(entry.name)) sourceFiles.push(path);
    }
  };
  walk('src');
  for(const path of sourceFiles){
    const source = readFileSync(path,'utf8');
    assert.doesNotMatch(source,/\sstyle\s*=/i,path);
    assert.doesNotMatch(source,/\bstyle\s*:/,path);
    assert.doesNotMatch(source,/\.style(?:\.|\[|\s*=)/,path);
    assert.doesNotMatch(source,/setAttribute\(\s*['"]style/,path);
    assert.doesNotMatch(source,/\bcssText\b/,path);
  }
  assert.doesNotMatch(html(),/\sstyle\s*=/i);
  assert.doesNotMatch(bundle(),/\.style(?:\.|\[|\s*=)/);
});

test('dynamic visual geometry uses style-free progress and SVG attributes', () => {
  const views = readFileSync('src/ui/views.mjs','utf8');
  assert.match(views,/elNode\('progress'/);
  assert.match(views,/svgNode\('svg'/);
  assert.match(views,/teamPitchPaletteClass/);
  assert.doesNotMatch(views,/style:/);
});

test('frame-buster and current Stage 3 modules are inside the single hashed bundle', () => {
  const js = bundle();
  const man = manifest();
  assert.match(js,/typeof top !== 'undefined'.*top !== self.*top\.location = self\.location/);
  assert.ok(man.moduleOrder.includes('src/ui/markdown.mjs'));
  assert.ok(man.moduleOrder.includes('src/ui/security-wiring.mjs'));
  assert.deepEqual(JSON.parse(/const BUILD_INFO = (\{.*?\});/.exec(js)[1]).moduleOrder,man.moduleOrder);
});

test('generated artefacts contain no planted odds secret', () => {
  const sentinel = 'STAGE3-ODDS-SECRET-SENTINEL-9f4d2';
  for(const content of [html(),bundle(),JSON.stringify(manifest())]){
    assert.equal(content.includes(sentinel),false);
  }
});
