// tests/sec1.test.mjs — regression: the odds API key never transits a public relay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, syntheticWorld } from './harness.mjs';

const RELAY_HOSTS = ['allorigins.win', 'corsproxy.io', 'codetabs.com', 'thingproxy.freeboard.io'];

test('SEC-1: odds key is direct-only; failures degrade to internal model, never relay', async () => {
  const { T, doc, setFetch } = loadApp({ oddsKey: 'sk-test-SECRET-KEY' });
  syntheticWorld(T);
  doc['oddsKey'].value = 'sk-test-SECRET-KEY';

  const seenUrls = [];
  setFetch(async (url) => { seenUrls.push(String(url)); throw new Error('network down'); });

  await T.S.constructor; // no-op; keep linter calm
  // loadOdds is not exported by name in harness list; access via evaluated global path:
  // it was captured indirectly — call through the exported surface instead.
  // The harness exports runBacktest etc.; loadOdds needs adding: use global fallback.
  const loadOdds = globalThis.loadOdds || null;
  assert.ok(typeof loadOdds === 'function', 'loadOdds reachable in harness scope');

  await loadOdds();

  assert.ok(seenUrls.length >= 1, 'a direct attempt was made');
  for (const u of seenUrls) {
    for (const host of RELAY_HOSTS)
      assert.ok(!u.includes(host), `key-bearing request must not touch relay ${host}: ${u}`);
  }
  // exactly the direct provider host, nothing else
  assert.ok(seenUrls.every(u => u.startsWith('https://api.the-odds-api.com/')),
    'only the provider itself may see the key');
  assert.equal(T.S.odds, null, 'no odds data on failure');
  assert.match(T.S.oddsNote, /internal team model/i, 'confidence-reduction note set');
});
