# TESTING.md
Purpose: test architecture and rules of engagement. Audience: every session before coding.
Last updated: 2026-07-28. Related: tests/, docs/STAGE1.md, CLAUDE.md.

## Stack
`node:test` only (zero dependencies, Node ≥18). Entry: `./run-tests.sh`, which builds first because
the generated bundle is itself a test target. Current verified baseline: **210 passing tests**.

## Suites
1. **characterisation.test.mjs (77)** — model behaviour against the built bundle and golden snapshots.
2. **sec1.test.mjs (1)** — odds key never reaches a relay.
3. **unit.test.mjs (10)** — direct ES-module model/provider/storage tests.
4. **resilience.test.mjs (8)** — corruption, outage and malformed-input behaviour.
5. **validation.test.mjs (12)** — fixture identity/deduplication and payload-safe summaries.
6. **anthropic-removal.test.mjs (5)** — legacy secret migration and hosted fail-fast behaviour.
7. **schema.test.mjs (25)** — per-endpoint fatal/partial payload contracts.
8. **schema-state.test.mjs (8)** — validation/state integration and cache rejection.
9. **retry.test.mjs (20)** — bounded retry engine and endpoint scrubbing.
10. **retry-transport.test.mjs (13)** — transport integration and retry metadata.
11. **provider-health.test.mjs (10)** — seven-state health vocabulary and transitions.
12. **rendering-security.test.mjs (5)** — hostile API/user strings remain inert text.
13. **markdown-sanitisation.test.mjs (8)** — restricted Markdown and hostile-link battery.
14. **security-completion.test.mjs (8)** — odds forgetting/scrubbing, storage omission, masked UI,
    CSP hash verification, policy allow-list, frame-buster/build identity and artefact secret scans.

## Harness
`tests/harness.mjs` stubs DOM, storage and fetch, then loads `dist/app.bundle.js`. The frame-buster is
guarded for non-browser execution so the same production bundle remains the characterisation target.

## Required checks
Before implementation work is described as complete:

1. Run `./run-tests.sh` with all tests green.
2. Build twice with the same explicit `BUILD_COMMIT` and compare `dist/index.html`,
   `dist/app.bundle.js` and `dist/manifest.json` byte-for-byte.
3. Independently recompute the CSP hashes from the exact emitted inline script/style bytes.
4. Confirm `BUILD_INFO`, manifest module order and generated files agree.
5. For security work, use planted sentinel secrets and adversarial inputs rather than policy-only claims.

## Philosophy
Never delete or weaken a test to make a change pass. Golden changes belong only to the stage that
fixes their recorded issue. Security guarantees require adversarial regression coverage. Prediction
accuracy cannot be claimed from in-sample or method-flattered results.
