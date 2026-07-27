// tests/retry-transport.test.mjs — D-15 integration: retry as it actually
// behaves inside api() and fetchVia(), with a stubbed global fetch.
// These use the real backoff, so they cost a few hundred ms each by design —
// that is the cost being asserted as bounded.
import test from 'node:test';
import assert from 'node:assert/strict';
import { api, fetchVia, RELAYS } from '../src/providers/transport.mjs';
import { S } from '../src/state.mjs';

const RELAY_COUNT = RELAYS.length;

/* Install a fetch stub that plays a scripted sequence of responses.
   Returns the list of URLs seen, so relay behaviour can be asserted. */
function stubFetch(handler) {
  const seen = [];
  globalThis.fetch = async (url) => {
    seen.push(String(url));
    return handler(String(url), seen.length);
  };
  return seen;
}

const jsonRes = (body, status = 200) => ({ ok: status >= 200 && status < 300, status,
  json: async () => body, text: async () => JSON.stringify(body) });
const statusRes = status => ({ ok: false, status,
  json: async () => ({}), text: async () => '' });
const badJsonRes = () => ({ ok: true, status: 200,
  json: async () => { throw new SyntaxError('Unexpected token < in JSON'); },
  text: async () => '<html>nope</html>' });

const statOf = (provider, endpoint) => S.retryStats[provider + '|' + endpoint];

test.beforeEach(() => { S.retryStats = {}; });

/* ---------------- healthy provider: unchanged behaviour ---------------- */

test('transport: a healthy endpoint is fetched once and never retried', async () => {
  const seen = stubFetch(() => jsonRes({ events: [], teams: [] }));
  const data = await api('/bootstrap-static/');
  assert.deepEqual(data, { events: [], teams: [] });
  assert.equal(seen.length, 1, 'one request — retry must be invisible when healthy');
  const rec = statOf('fpl', '/bootstrap-static/');
  assert.equal(rec.attempts, 1);
  assert.equal(rec.exhausted, false);
  assert.equal(rec.finalStatus, 200);
});

/* ---------------- transient failure ---------------- */

test('transport: a transient outage is retried and can recover', async () => {
  let cascade = 0;
  const seen = stubFetch((url, n) => {
    // fail the whole first cascade with 503, then serve the second
    if (n <= RELAY_COUNT) return statusRes(503);
    cascade = 1;
    return jsonRes({ recovered: true });
  });
  const data = await api('/fixtures/');
  assert.deepEqual(data, { recovered: true });
  assert.equal(cascade, 1);
  assert.equal(seen.length, RELAY_COUNT + 1, 'one failed cascade, then success on the retry');
  const rec = statOf('fpl', '/fixtures/');
  assert.equal(rec.attempts, 2);
  assert.equal(rec.exhausted, false);
});

test('transport: exhausted retries throw the original error for core data', async () => {
  const seen = stubFetch(() => statusRes(503));
  await assert.rejects(() => api('/bootstrap-static/'), /feed unreachable/);
  assert.equal(seen.length, RELAY_COUNT * 3, 'exactly three cascades, then stop');
  const rec = statOf('fpl', '/bootstrap-static/');
  assert.equal(rec.attempts, 3);
  assert.equal(rec.exhausted, true);
  assert.equal(rec.retryable, true);
  assert.equal(rec.finalStatus, 503);
});

test('transport: a network failure is transient and retried', async () => {
  const seen = stubFetch(() => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(() => api('/bootstrap-static/'));
  assert.equal(seen.length, RELAY_COUNT * 3);
  assert.equal(statOf('fpl', '/bootstrap-static/').finalStatus, 'network');
});

/* ---------------- permanent failure: no retry ---------------- */

test('transport: a 404 across all relays is permanent — one cascade only', async () => {
  const seen = stubFetch(() => statusRes(404));
  await assert.rejects(() => api('/entry/123/'));
  assert.equal(seen.length, RELAY_COUNT, 'no second cascade for a permanent status');
  const rec = statOf('fpl', '/entry/{id}/');
  assert.equal(rec.attempts, 1);
  assert.equal(rec.retryable, false);
  assert.equal(rec.exhausted, false);
  assert.equal(rec.finalStatus, 404);
});

test('transport: malformed JSON is not retried', async () => {
  const seen = stubFetch(() => badJsonRes());
  await assert.rejects(() => api('/bootstrap-static/'));
  assert.equal(seen.length, RELAY_COUNT, 'every relay tried once, but no retry cascade');
  const rec = statOf('fpl', '/bootstrap-static/');
  assert.equal(rec.attempts, 1);
  assert.equal(rec.retryable, false);
  assert.equal(rec.finalStatus, 'parse');
});

test('transport: a provider "not found" reply short-circuits without retrying', async () => {
  const seen = stubFetch(() => jsonRes({ detail: 'Not found.' }));
  const data = await api('/entry/999999/', { optional: true });
  assert.equal(data, null, 'optional endpoint degrades to null');
  assert.equal(seen.length, 1, 'not-found is an answer, not a failure to retry');
  assert.equal(statOf('fpl', '/entry/{id}/').attempts, 1);
});

/* ---------------- optional providers still fall back ---------------- */

test('transport: an optional endpoint returns null after retries are exhausted', async () => {
  const seen = stubFetch(() => statusRes(502));
  const data = await api('/entry/123/history/', { optional: true });
  assert.equal(data, null, 'the caller sees the same fallback as before D-15');
  // optional endpoints get a reduced allowance: two cascades, not three
  assert.equal(seen.length, RELAY_COUNT * 2);
  const rec = statOf('fpl', '/entry/{id}/history/');
  assert.equal(rec.attempts, 2);
  assert.equal(rec.exhausted, true);
});

test('transport: core data keeps a larger allowance than optional data', async () => {
  stubFetch(() => statusRes(503));
  await assert.rejects(() => api('/bootstrap-static/'));
  const core = statOf('fpl', '/bootstrap-static/').attempts;
  S.retryStats = {};
  stubFetch(() => statusRes(503));
  await api('/entry/7/', { optional: true });
  const opt = statOf('fpl', '/entry/{id}/').attempts;
  assert.ok(core > opt, `core ${core} attempts should exceed optional ${opt}`);
  assert.equal(core, 3);
  assert.equal(opt, 2);
});

test('transport: fetchVia retries transient failures then degrades to null', async () => {
  const seen = stubFetch(() => statusRes(503));
  const html = await fetchVia('https://understat.com/league/EPL', { asText: true });
  assert.equal(html, null, 'Understat degrades to the FPL-ratings fallback');
  assert.equal(seen.length, RELAY_COUNT * 2, 'understat policy allows two attempts');
  const rec = statOf('understat', 'https://understat.com/league/EPL');
  assert.equal(rec.attempts, 2);
  assert.equal(rec.exhausted, true);
});

test('transport: fetchVia recovers when a retry succeeds', async () => {
  const seen = stubFetch((url, n) => n <= RELAY_COUNT
    ? statusRes(500)
    : ({ ok: true, status: 200, text: async () => 'teamsData = ...' }));
  const html = await fetchVia('https://understat.com/league/EPL', { asText: true });
  assert.equal(html, 'teamsData = ...');
  assert.equal(seen.length, RELAY_COUNT + 1);
});

/* ---------------- metadata ---------------- */

test('transport: retry metadata is keyed by normalised endpoint, not manager id', async () => {
  stubFetch(() => jsonRes({ picks: [] }));
  await api('/entry/111/event/5/picks/', { optional: true });
  await api('/entry/222/event/5/picks/', { optional: true });
  await api('/entry/333/event/5/picks/', { optional: true });
  const keys = Object.keys(S.retryStats);
  assert.deepEqual(keys, ['fpl|/entry/{id}/event/{id}/picks/'],
    'twenty rivals must not create twenty metadata entries');
});

test('transport: no metadata value ever contains a raw payload', async () => {
  stubFetch(() => jsonRes({ secret: 'do-not-log-me', elements: [] }));
  await api('/bootstrap-static/');
  const blob = JSON.stringify(S.retryStats);
  assert.ok(!blob.includes('do-not-log-me'));
  assert.ok(!blob.includes('elements'));
});
