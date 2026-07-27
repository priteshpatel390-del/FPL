/* ---------------------------------------------------------------------
   RETRY POLICY (Stage 3 item 3, D-15) — bounded, iterative retry for
   transient provider failures.

   Placement: this sits INSIDE the transport layer. Consumers call api(),
   fetchVia() or fetchT() exactly as before and never learn that a retry
   happened. Nothing here touches scoring, projections or calibration.

   Two rules shape the whole design:

   1. Only genuinely transient failures are retried. A malformed payload,
      a parse failure, a rejected key or a 404 will fail identically on
      the next attempt, so retrying them only wastes the user's time and,
      for metered providers, their quota. Schema validation (D-14) runs
      AFTER transport and its failures are permanent by definition —
      they never re-enter this layer.

   2. Retries are bounded three ways at once: a hard attempt ceiling, an
      elapsed-time budget, and a capped backoff. The budget matters more
      than it looks — the FPL relay cascade can burn 40s before failing,
      and without a budget a "max 3 attempts" policy would licence a
      two-minute spinner. Cheap failures get retried; expensive ones do not.

   This module is pure and imports nothing, so it can be unit-tested with
   fake clocks. All timing dependencies are injectable.
   --------------------------------------------------------------------- */

// Transient at the HTTP level: the same request may well succeed shortly.
const RETRYABLE_STATUS = Object.freeze([429, 500, 502, 503, 504]);
// Permanent at the HTTP level: retrying cannot change the answer.
const PERMANENT_STATUS = Object.freeze([400, 401, 403, 404]);

const isRetryableStatus = status => RETRYABLE_STATUS.includes(status);
const isPermanentStatus = status => PERMANENT_STATUS.includes(status);

/* Per-provider configuration. attempts counts the FIRST try, so attempts:2
   means one initial request plus at most one retry. Delays are deliberately
   short: this is a phone app and a user staring at a spinner is a worse
   outcome than a missing optional layer.

   budgetMs is elapsed time since the operation began, checked BEFORE
   sleeping. For fpl/understat one "attempt" is a full relay cascade, which
   is why their budgets are lower than their theoretical worst-case runtime —
   a cascade that took longer than the budget is not a transient blip. */
const RETRY_POLICY = Object.freeze({
  fpl: Object.freeze({ provider: 'fpl', attempts: 3,
    baseDelayMs: 300, maxDelayMs: 1200, budgetMs: 15000 }),
  understat: Object.freeze({ provider: 'understat', attempts: 2,
    baseDelayMs: 300, maxDelayMs: 1200, budgetMs: 15000 }),
  odds: Object.freeze({ provider: 'odds', attempts: 2,
    baseDelayMs: 400, maxDelayMs: 1600, budgetMs: 12000 }),
  archive: Object.freeze({ provider: 'archive', attempts: 2,
    baseDelayMs: 800, maxDelayMs: 3200, budgetMs: 90000 })
});

const ATTEMPT_CEILING = 5;   // hard upper bound, whatever a policy claims

function policyFor(provider, overrides) {
  const base = RETRY_POLICY[provider] || RETRY_POLICY.fpl;
  const p = { ...base, ...(overrides || {}) };
  // Defensive clamp: a policy can never authorise an unbounded or absent loop.
  p.attempts = Math.max(1, Math.min(ATTEMPT_CEILING, Math.floor(p.attempts) || 1));
  return p;
}

/* Half-jitter exponential backoff: 50–100% of the capped exponential delay.
   Jitter avoids every client on a flaky relay retrying in lockstep; the 50%
   floor keeps the delay meaningful. Pure — the random source is injected, so
   tests get exact numbers. */
function retryDelay(attempt, policy, random = Math.random) {
  const exp = Math.min(policy.baseDelayMs * Math.pow(2, attempt - 1), policy.maxDelayMs);
  if (policy.jitter === false) return exp;
  return Math.round(exp * (0.5 + 0.5 * random()));
}

/* Endpoint labels for retry metadata. Two jobs:
   - strip the query string, because the odds request carries the API key
     there and metadata must never contain a secret;
   - collapse digit runs, so /entry/12345/event/7/picks/ becomes a stable
     key instead of creating one metadata entry per rival manager. */
function safeEndpoint(url) {
  const s = String(url);
  const noQuery = s.split('?')[0].split('#')[0];
  return noQuery.replace(/\d+/g, '{id}');
}

function defaultSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* withRetry(task, policy, deps) -> { result, record }

   `task(attempt)` must resolve to an outcome object, never throw:
     { ok:true,  value, status }                       success
     { ok:false, retryable:boolean, status, reason }   failure

   Making the task classify its own failure is deliberate. Only the caller
   knows whether a thrown error was a dead socket (transient) or a JSON
   parse failure (permanent), and collapsing that distinction into a generic
   catch here is exactly how malformed payloads end up being retried.

   The loop is a plain bounded `for`. There is no recursion and no
   condition under which it can run more than policy.attempts times. */
async function withRetry(task, policy, deps = {}) {
  const sleep = deps.sleep || defaultSleep;
  const random = deps.random || Math.random;
  const now = deps.now || Date.now;
  const p = policyFor(policy && policy.provider, policy);
  const started = now();

  const record = { provider: p.provider, endpoint: p.endpoint || 'unknown',
    attempts: 0, finalStatus: null, retryable: false, exhausted: false,
    budgetExceeded: false };

  let result = null;
  for (let attempt = 1; attempt <= p.attempts; attempt++) {
    record.attempts = attempt;
    result = await task(attempt);

    if (result && result.ok) {
      record.finalStatus = result.status === undefined ? 'ok' : result.status;
      record.retryable = false;
      record.exhausted = false;
      return { result, record };
    }

    record.finalStatus = result && result.status !== undefined
      ? result.status : (result && result.reason) || 'error';
    record.retryable = !!(result && result.retryable);

    if (!record.retryable) return { result, record };   // permanent — stop now
    if (attempt >= p.attempts) break;                    // attempt ceiling reached
    if (p.budgetMs && (now() - started) >= p.budgetMs) { // too slow to be transient
      record.budgetExceeded = true;
      break;
    }
    await sleep(retryDelay(attempt, p, random));
  }

  record.exhausted = true;
  return { result, record };
}

export { RETRYABLE_STATUS, PERMANENT_STATUS, RETRY_POLICY, ATTEMPT_CEILING, isRetryableStatus, isPermanentStatus, policyFor, retryDelay, safeEndpoint, withRetry };
