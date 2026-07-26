# TESTING.md
Purpose: test architecture and rules of engagement. Audience: every session before coding.
Last updated: 2026-07-26. Related: tests/, docs/STAGE1.md, CLAUDE.md.

## Stack
node:test only (zero dependencies, Node ≥18). Entry: `./run-tests.sh` (builds first — the bundle is
a test target). 96 tests across 4 suites; all must stay green in every stage.

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
4. **resilience.test.mjs (8)** — corruption/outage/malformed-input behaviour, including honestly-
   titled pinned limitations (e.g. DUP-1).

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
