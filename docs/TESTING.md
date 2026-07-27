# TESTING.md
Purpose: test architecture and rules of engagement. Audience: every session before coding.
Last updated: 2026-07-27. Related: tests/, docs/STAGE1.md, CLAUDE.md.

## Stack
node:test only (zero dependencies, Node ≥18). Entry: `./run-tests.sh` (builds first — the bundle is
a test target). 189 tests across 11 suite files; all must stay green in every stage.

## Suites
1. **characterisation.test.mjs (77)** — golden-snapshot pinning of model behaviour, executed against
   the BUILT BUNDLE via the DOM harness. Two golden sections: `stable` (must never drift) and
   `expectedToChange` (known-incorrect behaviour keyed to AUDIT ids: MIN1, DEN1, SCOR1, SCOR2,
   FIX1). When a fixing stage lands, its quarantined goldens are updated AS PART OF that stage's
   review — a diff there is the fix arriving, never a silent regression. Regenerate only
   deliberately: `UPDATE_GOLDEN=1 node --test tests/characterisation.test.mjs`, then review the diff.
2. **sec1.test.mjs (1)** — fetch-spy regression: odds key never reaches a relay under any failure.
3. **unit.test.mjs (10)** — direct ES-module imports (no DOM harness) for fixtures, scoring, squad,
   odds maths, pure backtest (planted-bias recovery + provenance), cache envelope, registry, config.
4. **resilience.test.mjs (8)** — corruption/outage/malformed-input behaviour. DUP-1 is now a
   fixed-behaviour characterisation: phantom duplicates collapse while genuine doubles survive.
5. **validation.test.mjs (12)** — pure D-13 fixture-integrity tests: identity, exact/conflicting
   duplicate handling, postponed rows, fatal shape failure, immutability and payload-free summaries.
6. **anthropic-removal.test.mjs (5)** — D-08/SEC-3 regression battery: legacy secret migration,
   no persistence, hosted fail-fast, keyless preview request and static key-affordance scan.
7. **schema.test.mjs (25)** — pure per-endpoint payload contracts covering fatal and partial
   validation, issue collapse, immutability and safe metadata.
8. **schema-state.test.mjs (8)** — D-14 state/orchestration integration: atomic hydrate, issue
   replacement, cache rejection and optional-provider degradation.
9. **retry.test.mjs (20)** — D-15 retry-engine policy: transient/permanent classes, attempt and
   elapsed-time ceilings, bounded half-jitter backoff and endpoint scrubbing.
10. **retry-transport.test.mjs (13)** — transport integration: healthy single attempts, bounded
    relay cascades, recovery, permanent short-circuiting and normalised retry metadata.
11. **provider-health.test.mjs (10)** — D-16 seven-state vocabulary, provider-specific stale
    thresholds, Live/Cached/Stale/Fallback/Partial/Disabled/Unavailable transitions, neutral Disabled
    behaviour, age calculation and Stage-2 compatibility fields.

## Harness
tests/harness.mjs stubs DOM/storage/fetch and loads `dist/app.bundle.js` (APP_TARGET overrides);
syntheticWorld() builds the deterministic 20-team league + archetype players every suite shares.

## Philosophy & rules
- Characterise before refactoring; never delete a test — retitle/re-home with justification.
- New model code: pure functions, direct-import tests, synthetic ground truth with KNOWN planted
  answers (see the backtest bias-recovery pattern).
- Failure modes get tests, not assumptions (resilience suite is the template).
- Security claims get adversarial tests (SEC-1 pattern; Stage 3 adds the sanitisation battery).
- No accuracy claims from tests on training data (D-11).

## Coverage goals
Every exported model/provider/storage function direct-import tested; every AUDIT issue either fixed
or pinned; every stage adds its battery per its design doc; UI logic covered at bundle level until
Stage 9 splits views.
