# Team UX T-01 / T-02 implementation record

Status: **Draft implementation with automated verification green; owner review pending. Not merged.**

Date: 7 August 2026.

Base `main`: `d742562059c966e6e456abe39247fa3a18e6c72c`.
Branch: `agent/team-ux-startup-availability`.
Draft PR: #80.

## Approved scope

### T-01 — Startup loading ownership

The existing startup gate remains the startup mechanism and the existing verified refresh/provider flow is unchanged. While the document still has the existing `startup-pending` state, the Team presentation layer synchronously marks the application header, main content and fixed primary navigation as hidden and inert when the application bundle initialises. Those shell nodes are released only by the existing one-shot `teamsheet:startup-ready` event after the startup refresh finishes.

This removes the fixed dock from the active rendered shell during the actual verified-data loading period without changing refresh cadence, fallback behaviour, provider calls, data validation, calculations or routing.

The source HTML still assigns the startup gate a lower stacking value than the fixed dock. The synchronous shell lock prevents the dock remaining above the gate once application JavaScript initialises, but automated evidence cannot prove that Safari never paints a pre-script frame before that lock is installed. Physical iPhone Safari review therefore remains required for final acceptance of T-01.

### T-02 — Team availability clarity

Starting-XI and bench cards now add an explicit visible availability badge for Official FPL flagged states:

- `d`: `Doubtful`, including the supplied chance of playing when present;
- `s`: `Suspended`;
- `i`, `u`, `n`: `Unavailable`.

The same state is appended to each affected card's existing accessible label. The presentation is added after the existing verified Team renderer has already selected the XI, captain, vice-captain and bench. It consumes only the status fields already present on each rendered player.

## Explicitly unchanged

No projection model, expected-minutes logic, scoring, best-XI selection, formation, captaincy, vice-captaincy, bench order, fixture calculation, risk calculation, transfer logic, Mini-League logic, provider behaviour, data source, Cloudflare Worker, GitHub Pages configuration, navigation architecture, persistence or security architecture is changed.

No dependency or framework is added. `src/ui/team-pitch.mjs` remains visual-only.

## Regression coverage

`tests/team-ux-startup-availability.test.mjs` adds focused contracts for explicit availability wording, both starting and bench card annotation, accessible labels, unchanged Team-selection ownership, startup shell ownership and release through the existing `teamsheet:startup-ready` event.

No existing test or golden expectation is deleted, weakened or regenerated.

## Repository verification workflow

With owner approval, `.github/workflows/verify.yml` adds repository-owned verification for pull requests and manual `workflow_dispatch` runs. It is verification infrastructure only: read-only repository permission, no deployment, no package installation, no generated-file write-back and no application behaviour change.

The workflow checks out the exact PR revision, runs the existing `./run-tests.sh`, creates two production builds with the exact revision supplied as `BUILD_COMMIT`, compares `dist/app.bundle.js`, `dist/index.html`, `dist/manifest.json` and root `index.html` byte-for-byte, verifies root `index.html` equals `dist/index.html`, and confirms the emitted manifest records the exact source revision.

## Verification evidence

The accepted starting baseline on `main` remains **645 passed, 0 failed, 0 skipped, 0 cancelled**, deterministic byte-identical production builds and root/deployable equality. GitHub Pages and the `teamsheet-fpl-gateway` Cloudflare Worker were verified at that merged baseline.

GitHub Actions **Verify Teamsheet run #1** verified source `68d16a2a8fc3113da27491c3ddf0282f9fbbbc26` successfully on 7 August 2026:

- `./run-tests.sh`: **648 passed, 0 failed, 0 skipped, 0 cancelled**;
- all three added T-01/T-02 regressions passed;
- two exact-identity production builds were byte-identical for `dist/app.bundle.js`, `dist/index.html` and `dist/manifest.json`;
- root `index.html` was byte-identical across builds and exactly equal to `dist/index.html`;
- manifest `commit` exactly matched the verified source revision;
- model/golden expectations remained unchanged.

Every later PR-head commit triggers the same verification automatically. The PR check displayed for the current head is the authoritative automated verification result for that exact revision.

No GitHub Pages or Cloudflare deployment is requested or changed by this branch.

Generated production files created by the workflow are verification outputs in the GitHub runner and are not written back to the branch. If this implementation checkpoint requires committed generated artefacts before merge, that remains a separate repository-completion step; no generated file has been hand-edited.

## Remaining acceptance limitation

Automated verification cannot establish whether iPhone Safari ever paints a pre-script frame before the synchronous startup shell lock runs. A physical iPhone Safari startup review remains required before T-01 is treated as physically accepted.

## Review gate

This work remains a Draft PR and must not merge until Pritesh explicitly approves it. Automated repository verification is available on every PR head; physical iPhone Safari review of T-01 and any required generated-artefact commit remain the outstanding completion checks.
