// tests/retry.test.mjs — Stage 3 item 3 (D-15): the retry engine itself.
// Every timing dependency is injected, so these are pure, instant and exact.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RETRYABLE_STATUS, PERMANENT_STATUS, RETRY_POLICY, ATTEMPT_CEILING,
  isRetryableStatus, isPermanentStatus, policyFor, retryDelay, safeEndpoint, withRetry
} from '../src/providers/retry.mjs';

/* A fake clock: sleep() advances it instead of waiting, so elapsed-time
   budgets are exercised exactly without a single millisecond of real delay. */
function fakeDeps({ random = 1, startAt = 0, costPerSleep = null } = {}) {
  const slept = [];
  let clock = startAt;
  return {
    slept,
    tick: ms => { clock += ms; },
    now: () => clock,
    random: () => random,
    sleep: async ms => { slept.push(ms); clock += (costPerSleep === null ? ms : costPerSleep); }
  };
}

const ok = value => ({ ok: true, value, status: 200 });
const transient = status => ({ ok: false, retryable: true, status });
const permanent = status => ({ ok: false, retryable: false, status });

/* A task that fails `failures` times then succeeds. Records the order in
   which attempts were made so ordering can be asserted, not assumed. */
function flakyTask(failures, order, outcome = () => transient(503)) {
  return async attempt => {
    order.push(attempt);
    return attempt <= failures ? outcome(attempt) : ok('payload-' + attempt);
  };
}

const policy = over => ({ provider: 'fpl', attempts: 3, baseDelayMs: 100,
  maxDelayMs: 800, budgetMs: 10000, endpoint: '/test/', ...over });

/* ---------------- success paths ---------------- */

test('retry: immediate success makes exactly one attempt and never sleeps', async () => {
  const deps = fakeDeps();
  const order = [];
  const { result, record } = await withRetry(flakyTask(0, order), policy(), deps);
  assert.equal(result.value, 'payload-1');
  assert.deepEqual(order, [1]);
  assert.deepEqual(deps.slept, [], 'a healthy provider is never delayed');
  assert.equal(record.attempts, 1);
  assert.equal(record.exhausted, false);
  assert.equal(record.retryable, false);
  assert.equal(record.finalStatus, 200);
});

test('retry: success after one retry', async () => {
  const deps = fakeDeps();
  const order = [];
  const { result, record } = await withRetry(flakyTask(1, order), policy(), deps);
  assert.equal(result.value, 'payload-2');
  assert.deepEqual(order, [1, 2]);
  assert.equal(deps.slept.length, 1);
  assert.equal(record.attempts, 2);
  assert.equal(record.exhausted, false);
});

test('retry: success after multiple retries', async () => {
  const deps = fakeDeps();
  const order = [];
  const { result, record } = await withRetry(flakyTask(2, order), policy({ attempts: 4 }), deps);
  assert.equal(result.value, 'payload-3');
  assert.deepEqual(order, [1, 2, 3], 'attempts run in strict ascending order');
  assert.equal(record.attempts, 3);
  assert.equal(record.exhausted, false);
});

/* ---------------- exhaustion and bounds ---------------- */

test('retry: exhausted retries stop at the attempt ceiling and report it', async () => {
  const deps = fakeDeps();
  const order = [];
  const { result, record } = await withRetry(flakyTask(99, order), policy({ attempts: 3 }), deps);
  assert.equal(result.ok, false);
  assert.deepEqual(order, [1, 2, 3], 'exactly three attempts, no more');
  assert.equal(deps.slept.length, 2, 'n attempts means n-1 sleeps');
  assert.equal(record.attempts, 3);
  assert.equal(record.exhausted, true);
  assert.equal(record.retryable, true);
  assert.equal(record.finalStatus, 503);
});

test('retry: attempts are clamped — no policy can authorise an unbounded loop', async () => {
  for (const bad of [999, Infinity, -5, 0, null, undefined, NaN, '7']) {
    const p = policyFor('fpl', { attempts: bad });
    assert.ok(Number.isInteger(p.attempts));
    assert.ok(p.attempts >= 1 && p.attempts <= ATTEMPT_CEILING,
      `attempts ${bad} clamped into range, got ${p.attempts}`);
  }
  const order = [];
  const { record } = await withRetry(flakyTask(99, order), policy({ attempts: 999 }), fakeDeps());
  assert.equal(order.length, ATTEMPT_CEILING, 'the loop is bounded regardless of the request');
  assert.equal(record.attempts, ATTEMPT_CEILING);
});

test('retry: the elapsed-time budget stops slow failures being retried', async () => {
  // each attempt burns 9s of the fake clock; the budget is 10s
  const deps = fakeDeps();
  const order = [];
  const slowTask = async attempt => { order.push(attempt); deps.tick(9000); return transient(503); };
  const { record } = await withRetry(slowTask, policy({ attempts: 4, budgetMs: 10000 }), deps);
  assert.deepEqual(order, [1, 2], 'stopped once the budget was blown, not after 4 attempts');
  assert.equal(record.budgetExceeded, true);
  assert.equal(record.exhausted, true);
});

test('retry: a fast-failing provider still gets its full allowance', async () => {
  const deps = fakeDeps({ costPerSleep: 0 });
  const order = [];
  const fastTask = async attempt => { order.push(attempt); deps.tick(50); return transient(503); };
  const { record } = await withRetry(fastTask, policy({ attempts: 3, budgetMs: 10000 }), deps);
  assert.deepEqual(order, [1, 2, 3]);
  assert.equal(record.budgetExceeded, false);
});

/* ---------------- classification ---------------- */

test('retry: retryable HTTP statuses are retried', async () => {
  for (const status of RETRYABLE_STATUS) {
    assert.equal(isRetryableStatus(status), true, status + ' should be retryable');
    const order = [];
    const task = async a => { order.push(a); return transient(status); };
    await withRetry(task, policy({ attempts: 3 }), fakeDeps());
    assert.equal(order.length, 3, status + ' should have been retried');
  }
});

test('retry: non-retryable HTTP statuses fail on the first attempt', async () => {
  for (const status of PERMANENT_STATUS) {
    assert.equal(isPermanentStatus(status), true);
    assert.equal(isRetryableStatus(status), false);
    const order = [];
    const deps = fakeDeps();
    const task = async a => { order.push(a); return permanent(status); };
    const { record } = await withRetry(task, policy({ attempts: 3 }), deps);
    assert.deepEqual(order, [1], status + ' must not be retried');
    assert.deepEqual(deps.slept, [], 'and must not delay the user');
    assert.equal(record.exhausted, false, 'stopping early is not exhaustion');
    assert.equal(record.retryable, false);
    assert.equal(record.finalStatus, status);
  }
});

test('retry: a malformed payload is never retried', async () => {
  const order = [];
  const task = async a => { order.push(a); return { ok: false, retryable: false, status: 'parse' }; };
  const { record } = await withRetry(task, policy({ attempts: 3 }), fakeDeps());
  assert.deepEqual(order, [1], 'junk will still be junk on the next attempt');
  assert.equal(record.finalStatus, 'parse');
  assert.equal(record.exhausted, false);
});

test('retry: a schema validation failure is never retried', async () => {
  // D-14 validation runs after transport; a fatal issue is permanent by
  // definition and must not be fed back into the retry loop.
  const order = [];
  const task = async a => {
    order.push(a);
    return { ok: false, retryable: false, status: 'schema',
      reason: 'bootstrap_missing_collection' };
  };
  const { record } = await withRetry(task, policy({ attempts: 3 }), fakeDeps());
  assert.deepEqual(order, [1]);
  assert.equal(record.retryable, false);
  assert.equal(record.exhausted, false);
});

test('retry: a timeout is treated as transient and retried', async () => {
  const order = [];
  const task = async a => { order.push(a); return { ok: false, retryable: true, status: 'timeout' }; };
  const { record } = await withRetry(task, policy({ attempts: 3 }), fakeDeps());
  assert.deepEqual(order, [1, 2, 3]);
  assert.equal(record.finalStatus, 'timeout');
  assert.equal(record.exhausted, true);
});

/* ---------------- backoff ---------------- */

test('retry: backoff grows exponentially, is capped, and is deterministic', async () => {
  const p = policy({ baseDelayMs: 100, maxDelayMs: 800 });
  // random() === 1 → the top of the half-jitter band, i.e. the plain exponential
  assert.equal(retryDelay(1, p, () => 1), 100);
  assert.equal(retryDelay(2, p, () => 1), 200);
  assert.equal(retryDelay(3, p, () => 1), 400);
  assert.equal(retryDelay(4, p, () => 1), 800);
  assert.equal(retryDelay(5, p, () => 1), 800, 'capped at maxDelayMs');
  // random() === 0 → the bottom of the band: half, never zero
  assert.equal(retryDelay(1, p, () => 0), 50);
  assert.equal(retryDelay(3, p, () => 0), 200);
  // jitter disabled is exactly the exponential
  assert.equal(retryDelay(2, { ...p, jitter: false }, () => 0.123), 200);
});

test('retry: jitter always lands inside the half-to-full band', () => {
  const p = policy({ baseDelayMs: 200, maxDelayMs: 5000 });
  for (const r of [0, 0.13, 0.5, 0.77, 0.999, 1]) {
    for (const attempt of [1, 2, 3]) {
      const exp = Math.min(200 * Math.pow(2, attempt - 1), 5000);
      const d = retryDelay(attempt, p, () => r);
      assert.ok(d >= exp * 0.5 - 1 && d <= exp + 1, `delay ${d} outside band for r=${r}`);
    }
  }
});

test('retry: the same inputs always produce the same delay sequence', async () => {
  const run = async () => {
    const deps = fakeDeps({ random: 0.5 });
    await withRetry(flakyTask(99, []), policy({ attempts: 4 }), deps);
    return deps.slept;
  };
  assert.deepEqual(await run(), await run(), 'retry ordering and timing are deterministic');
  assert.deepEqual(await run(), [75, 150, 300]);
});

/* ---------------- metadata hygiene ---------------- */

test('retry: endpoint labels drop query strings so an API key can never leak', () => {
  const withKey = 'https://api.the-odds-api.com/v4/sports/soccer_epl/odds/' +
    '?regions=uk&markets=h2h,totals&oddsFormat=decimal&apiKey=sk-live-SECRET';
  const label = safeEndpoint(withKey);
  assert.ok(!label.includes('sk-live-SECRET'), 'the key must not survive into metadata');
  assert.ok(!label.includes('apiKey'));
  assert.ok(!label.includes('?'));
  assert.ok(label.startsWith('https://api.the-odds-api.com/'));
});

test('retry: endpoint labels collapse ids so metadata cannot grow per manager', () => {
  assert.equal(safeEndpoint('/entry/12345/event/7/picks/'), '/entry/{id}/event/{id}/picks/');
  assert.equal(safeEndpoint('/entry/999/event/7/picks/'), '/entry/{id}/event/{id}/picks/');
  assert.equal(safeEndpoint('/leagues-classic/8811/standings/'), '/leagues-classic/{id}/standings/');
  assert.equal(safeEndpoint('/bootstrap-static/'), '/bootstrap-static/');
});

test('retry: the record carries exactly the fields the health model will consume', async () => {
  const { record } = await withRetry(flakyTask(99, []), policy({ endpoint: '/bootstrap-static/' }), fakeDeps());
  assert.deepEqual(Object.keys(record).sort(),
    ['attempts', 'budgetExceeded', 'endpoint', 'exhausted', 'finalStatus', 'provider', 'retryable']);
  assert.equal(record.provider, 'fpl');
  assert.equal(record.endpoint, '/bootstrap-static/');
  assert.equal(typeof record.attempts, 'number');
  assert.equal(typeof record.exhausted, 'boolean');
  assert.equal(typeof record.retryable, 'boolean');
  assert.equal(typeof record.budgetExceeded, 'boolean');
});

/* ---------------- shipped configuration ---------------- */

test('retry: every shipped provider policy is bounded and conservative', () => {
  for (const [name, p] of Object.entries(RETRY_POLICY)) {
    assert.equal(p.provider, name);
    assert.ok(p.attempts >= 1 && p.attempts <= ATTEMPT_CEILING, name + ' attempts in range');
    assert.ok(p.baseDelayMs > 0 && p.baseDelayMs <= 1000, name + ' base delay is short');
    assert.ok(p.maxDelayMs >= p.baseDelayMs, name + ' cap is above the base');
    assert.ok(p.budgetMs > 0, name + ' has an elapsed-time budget');
    // worst-case added delay, ignoring the budget guard
    let worst = 0;
    for (let a = 1; a < p.attempts; a++) worst += retryDelay(a, p, () => 1);
    assert.ok(worst <= 5000, `${name} adds at most ${worst}ms of waiting`);
  }
});

test('retry: an unknown provider falls back to a real policy rather than undefined', () => {
  const p = policyFor('does-not-exist');
  assert.ok(p.attempts >= 1);
  assert.ok(p.budgetMs > 0);
});
