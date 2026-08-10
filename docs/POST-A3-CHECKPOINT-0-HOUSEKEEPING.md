# Post-A3 Checkpoint 0 — housekeeping

Status: implementation candidate on `claude/teamsheet-post-a3-closeout-crqojj`. Items 0A and 0B are implemented. Item 0C is **investigation only**; its proposed correction is not implemented and is not approved.

Baseline: GitHub `main` `9b31f373a23d26c49f81c688a2ca6fde98086cbd`, merge of A3 cache and persistence resilience PR #104.

This checkpoint is deliberately small. It changes no application runtime source. It touches continuous integration configuration, tests and documentation only.

## 0A — Verify Teamsheet did not automatically verify `main`

### Finding (fact)

`.github/workflows/verify.yml` triggered on `pull_request` and `workflow_dispatch` only. A push to `main` — that is, a merge — started no verification run.

Confirmed against the repository's own Actions history at this baseline. Of the thirty most recent Verify Teamsheet runs:

- runs with `head_branch` = `main`: **0**
- runs whose head commit is the PR #104 merge `9b31f373a23d26c49f81c688a2ca6fde98086cbd`: **none**
- trigger events present: `pull_request` and `workflow_dispatch` only

So PR #104 has exact verification of its *pull-request head* `4e434b940e2bcb473374573db5da16f6a645d9eb` (run #105 / `31377157889`, success), while the merge commit that actually became `main` received no complete Verify Teamsheet run. GitHub Pages deployment is a publication step and is not a substitute for repository verification.

### Correction (implemented)

```yaml
on:
  pull_request:
  push:
    branches:
      - main
  workflow_dispatch:
```

A second, less obvious defect was corrected at the same time. The workflow used `cancel-in-progress: true` for every event. Two merges landing in quick succession share the concurrency group `refs/heads/main`, so the earlier merge commit's run would be cancelled and that commit would permanently lack a verification result — reintroducing the same gap this item exists to close. Cancellation is now restricted to non-push events:

```yaml
cancel-in-progress: ${{ github.event_name != 'push' }}
```

Superseded pull-request pushes remain cancellable, which is the behaviour that keeps PR feedback fast.

### Why the existing job body needs no change (fact, verified locally)

`BUILD_COMMIT` is already `${{ github.event.pull_request.head.sha || github.sha }}`. On a push event there is no pull request, so it resolves to `github.sha`, which for a push is the merge commit. Every stage was executed locally against merge commit `9b31f373a23d26c49f81c688a2ca6fde98086cbd` exactly as a push-triggered run would:

| Stage | Result |
|---|---|
| `git rev-parse HEAD` equals `BUILD_COMMIT` | pass |
| Committed build provenance (`scripts/verify-build-provenance.mjs`) | pass — reachable source `502a1f7a…` |
| Complete suite (`./run-tests.sh`) | 832 passed, 0 failed, 0 skipped, 0 cancelled |
| Two exact-identity production builds | byte-identical |
| Root `index.html` equals `dist/index.html` | pass |
| Manifest build identity | pass — commit `9b31f373…`, build-input hash `da6f316b…` |

The provenance step is the only stage whose behaviour differs conceptually on a merge commit: it requires the manifest's recorded source to be a reachable ancestor of `HEAD`. Source `502a1f7a…` is an ancestor of the merge, so the check passes rather than merely being skipped.

### Regression protection

Three tests in `tests/build-provenance.test.mjs` now hold this open, taking the suite from 832 to **835 passing, 0 failed**:

- the trigger block contains `pull_request`, `push` restricted to `main`, and `workflow_dispatch`;
- `cancel-in-progress` is the event-conditional expression and no unconditional `cancel-in-progress: true` remains;
- the `BUILD_COMMIT` fallback and the exact-revision assertion are both present, so each trigger path verifies the revision it names.

### Limitation

This makes future merges verify automatically. It does not retrospectively verify `9b31f373a23d26c49f81c688a2ca6fde98086cbd`. That commit's verification evidence is currently the local reproduction recorded above plus the PR-head run #105. A `workflow_dispatch` run against `main` can produce a permanent record on demand if wanted.

## 0B — Post-merge documentation reconciliation

### Finding (fact)

PR #104 merged at `9b31f373a23d26c49f81c688a2ca6fde98086cbd` on 10 August 2026, merged by the repository owner. Canonical documentation was written before that merge and still described the checkpoint as an unmerged draft, and still named the superseded `main` `473cfdb3295d2b896a00c0aa7b1308814bf2e043` as the repository head.

Reconciled: `CLAUDE.md`, `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, `docs/TESTING.md`, `docs/KNOWN_LIMITATIONS.md`, `docs/A3-CACHE-PERSISTENCE-RESILIENCE.md` and `docs/HISTORICAL_RECORDS.md`.

Physical iPhone Safari acceptance for PR #104 was **explicitly waived by the owner**. It is recorded as waived, never as performed.

## 0C — Duplicate manual-squad handlers (investigation only)

**No code change is proposed for implementation in this checkpoint. The correction below requires explicit owner approval before any future session implements it.**

### Finding (fact)

Two independent implementations of manual-squad add and remove exist in the shipped bundle.

1. `src/ui/views.mjs` attaches a click listener to each `[data-add]` button inside `#pResults` (`searchPlayers()`, lines 425–434) and to each `[data-rm]` button inside `#manualList` (`renderManual()`, lines 411–414). These are re-attached on every render.
2. `src/ui/manual-squad-runtime.mjs` installs a single **capture-phase** listener on `document` matching the same two selector/container pairs, and calls `event.stopImmediatePropagation()` on a match (`manualSquadInstallBrowserRuntime()`, lines 207–266).

The runtime listener wins. Capture-phase listeners on `document` run before listeners attached to the target element, and `stopImmediatePropagation()` prevents the event from reaching the target at all. The `views.mjs` listeners therefore never execute.

This was verified empirically, not only by reading the specification: a reproduction of the exact listener structure was executed in headless Chromium, and the recorded outcome was `["RUNTIME-add","RUNTIME-remove"]` — neither legacy listener fired. (Chromium confirms standard DOM UI Events behaviour; it is not evidence about Safari specifically, though propagation semantics are not engine-specific.)

Install is unconditional in the shipped bundle. The guard `typeof document!=='undefined' && typeof renderTransfers==='function'` is satisfied because the zero-dependency bundler strips module syntax and concatenates every module into one shared scope, where `function renderTransfers()` is hoisted. Verified in the committed `dist/app.bundle.js`: the declaration, the legacy listeners and the install call are all present, and the install call is evaluated at load time, before any click.

### Why this matters (inference, not an observed failure)

The two implementations are not equivalent. The legacy path is materially weaker:

| Behaviour | `manual-squad-runtime.mjs` (live) | `views.mjs` (dead) |
|---|---|---|
| Position quota check before add | yes | no |
| Three-per-club check before add | yes | no |
| £100.0m budget check before add | yes | no |
| Verified persistence and session-only warning on failure | yes | writes, ignores the result on remove |
| `useManual` enabled only after a successful squad write | yes | sets `useManual` before persistence is confirmed |
| Transfer optimiser deferred while Transfers is hidden | yes | calls `renderAll()`, the FPL-T1 crash path |

The dead path is a fully wired regression to the two defects that `docs/FPL-T1-MANUAL-SQUAD-CRASH.md` records as corrected — the fifteenth-player optimiser crash and the unenforced budget — plus the A3 persistence guarantees. It is currently unreachable, so this is a latent hazard and **not** a live defect. Nothing in the repository detects if it ever became reachable again: a change to the capture flag, the `stopImmediatePropagation()` call, the selectors, or the `documentElement.dataset` install guard would silently fall back to the weaker path with no failing test.

### Testing gap (fact)

`tests/harness.mjs` does not model event propagation. Its element `click()` invokes only that element's own listeners and never consults document-level capture listeners. No existing test can therefore distinguish "the runtime handled this" from "the legacy handler handled this"; both would appear to pass. This is why the duplication survived.

### Proposal (requires approval, not implemented)

1. Delete the two dead listener blocks in `src/ui/views.mjs`, leaving `renderManual()` and `searchPlayers()` responsible for rendering only.
2. Keep `manual-squad-runtime.mjs` as the single owner of manual add/remove.
3. Add a regression test proving the manual add/remove path runs the validating implementation, so a future propagation change fails loudly instead of silently degrading.

Assessment: low risk, because the deleted code is proven unreachable. It is still a change to manual-squad handling, which sits inside the squad-legality approval boundary, so it is presented rather than performed.

Not proposed here: any change to `manualSquadApplyStatus` status-text ownership, the `renderManual()` counter text it overwrites, or any other manual-squad behaviour.

## Deliberate exclusions

- `fpl:calib` is untouched. It remains behind the separate model approval gate.
- No projection, expected-minutes, scoring, fixture, captaincy, squad-selection, transfer, simulation, rank, Mini-League/rival or strategy change.
- No provider, endpoint, gateway, security-boundary, cache-cadence or persistence-behaviour change.
- No application runtime source change of any kind.
- No error-boundary separation work; that remains the next checkpoint and begins with investigation.

## Physical device evidence

None performed and none claimed. This checkpoint changes no application runtime source, so there is no user-visible behaviour to test on a device.
