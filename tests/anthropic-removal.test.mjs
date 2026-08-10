// Stage 3 item 1 / D-08 / SEC-3: Anthropic secrets are forbidden client-side.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadApp, syntheticWorld } from './harness.mjs';

const secret = 'sk-ant-test-DO-NOT-KEEP';

test('SEC-3: legacy claudeKey is removed while unversioned account state fails closed', async () => {
  const { T } = loadApp();
  localStorage.setItem('fpl:config', JSON.stringify({ teamId:'123', oddsKey:'odds-ok', claudeKey:secret }));
  const cfg = await T.loadCfg();
  assert.deepEqual(cfg, { oddsKey:'odds-ok' });
  const stored = JSON.parse(localStorage.getItem('fpl:config'));
  assert.equal(stored.version, 1);
  assert.deepEqual(stored.preferences, { oddsKey:'odds-ok' });
  assert.equal(stored.account, null);
  assert.equal(JSON.stringify(stored).includes(secret), false);
  assert.equal(JSON.stringify(stored).includes('123'), false);
});

test('SEC-3: saveCfg never writes an Anthropic key field', async () => {
  const { T, doc } = loadApp();
  doc.teamId.value = '12abc34';
  doc.oddsKey.value = 'odds-key';
  // Even a hostile/legacy DOM node cannot make saveCfg persist the old field.
  doc.claudeKey = { value:secret };
  await T.saveCfg();
  const cfg = JSON.parse(localStorage.getItem('fpl:config'));
  assert.equal(Object.hasOwn(cfg, 'claudeKey'), false);
  assert.equal(JSON.stringify(cfg).includes(secret), false);
});

test('SEC-3: hosted Ask fails fast and never contacts Anthropic', async () => {
  const { T, doc, setFetch } = loadApp();
  syntheticWorld(T);
  document.getElementById('q').value = 'Who should I captain?';
  let calls = 0;
  setFetch(async () => { calls++; throw new Error('must not be called'); });
  await T.ask();
  assert.equal(calls, 0);
  assert.match(T.S.thread.at(-1).content, /serverless migration/i);
  assert.match(T.S.thread.at(-1).content, /does not accept or store Anthropic API keys/i);
});

test('SEC-3: Claude preview request is keyless and contains no dangerous browser-access header', async () => {
  const { T, doc, setFetch } = loadApp();
  syntheticWorld(T);
  window.storage = {}; // project-standard signal for Claude artifact preview
  document.getElementById('q').value = 'Captain call';
  let request;
  setFetch(async (url, options) => {
    request = { url:String(url), options };
    return { ok:true, json:async () => ({ content:[{type:'text', text:'Hold transfer.'}] }) };
  });
  await T.ask();
  assert.equal(request.url, 'https://api.anthropic.com/v1/messages');
  const headers = request.options.headers;
  assert.deepEqual(headers, {'Content-Type':'application/json'});
  assert.equal(JSON.stringify(request).includes('x-api-key'), false);
  assert.equal(JSON.stringify(request).includes('anthropic-dangerous-direct-browser-access'), false);
  assert.equal(JSON.stringify(request).includes(secret), false);
  assert.equal(T.S.thread.at(-1).content, 'Hold transfer.');
});

test('SEC-3: source UI and built output contain no Anthropic key affordance or keyed request path', () => {
  const paths = ['app.html', 'src/ui/views.mjs', 'dist/index.html'];
  for(const path of paths){
    const text = readFileSync(path, 'utf8');
    assert.equal(/id=["']claudeKey|\$\(["']claudeKey|sk-ant|console\.anthropic\.com|x-api-key|anthropic-dangerous-direct-browser-access/.test(text), false,
      `${path} must not contain an Anthropic key field, UI lookup, hint or header`);
  }
  const storage = readFileSync('src/storage.mjs', 'utf8');
  assert.match(storage, /delete config\.claudeKey/, 'legacy property is retained only for one-time deletion');
  assert.equal(/\$\(["']claudeKey/.test(storage), false, 'storage never reads a key field from the UI');
});
