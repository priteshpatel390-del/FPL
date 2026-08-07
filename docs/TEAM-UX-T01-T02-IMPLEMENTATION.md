# Team UX T-01 / T-02 implementation record

Status: **Draft implementation with automated verification green; owner review pending. Not merged.**

Date: 7 August 2026.

Base `main`: `d742562059c966e6e456abe39247fa3a18e6c72c`.
Branch: `agent/team-ux-startup-availability`.
Draft PR: #80.

## Approved scope

### T-01 — Startup loading ownership

The existing startup gate remains the startup mechanism and the existing verified refresh/provider flow is unchanged. While `startup-pending` is active, the Team presentation layer synchronously marks the application header, main content and fixed primary navigation as hidden and inert when the application bundle initialises. Those shell nodes are released only by the existing one-shot `teamsheet:startup-ready` event after startup finishes.

This changes presentation ownership only. Refresh cadence, fallback behaviour, providers, data validation, calculations and routing are unchanged.

### T-02 — Team availability clarity

Starting-XI and bench cards add an explicit visible availability badge for Official FPL flagged states: `Doubtful` with the supplied chance when present, `Suspended`, or `Unavailable`. The same state is appended to each affected card's existing accessible label.

The annotation occurs after the existing verified Team renderer has selected the XI, captain, vice-captain and bench. It does not participate in those calculations.

## Explicitly unchanged

No projection model, expected-minutes logic, scoring, best-XI selection, formation, captaincy, vice-captaincy, bench order, fixture calculation, risk calculation, transfer logic, Mini-League logic, provider behaviour, data source, Cloudflare Worker, GitHub Pages configuration, navigation architecture, persistence or security architecture is changed.

No dependency or framework is added. `src/ui/team-pitch.mjs` remains visual-only.

## Regression coverage

`tests/team-ux-startup-availability.test.mjs` adds three focused contracts for availability wording/presentation and startup shell ownership. No existing test or golden expectation is deleted, weakened or regenerated.

## Repository verification workflow

With owner approval, `.github/workflows/verify.yml` adds repository-owned verification for pull requests and manual `workflow_dispatch` runs. It has read-only repository permission, performs no deployment, installs no package and writes no generated files back to the repository.

It checks out the exact PR revision, runs `./run-tests.sh`, performs two production builds with the exact revision as `BUILD_COMMIT`, compares the generated outputs byte-for-byte, verifies root `index.html` equals `dist/index.html`, and verifies the manifest build identity.

## Verification evidence

The accepted starting baseline on `main` remains **645 passed, 0 failed, 0 skipped, 0 cancelled**, deterministic byte-identical production builds and root/deployable equality. GitHub Pages and the `teamsheet-fpl-gateway` Cloudflare Worker were verified at that merged baseline.

GitHub Actions **Verify Teamsheet run #1** verified source `68d16a2a8fc3113da27491c3ddf0282f9fbbbc26` successfully on 7 August 2026:

- `./run-tests.sh`: **648 passed, 0 failed, 0 skipped, 0 cancelled**;
- all three T-01/T-02 regressions passed;
- two exact-identity production builds were byte-identical for `dist/app.bundle.js`, `dist/index.html` and `dist/manifest.json`;
- root `index.html` was byte-identical across builds and exactly equal to `dist/index.html`;
- manifest `commit` exactly matched the verified source revision;
- model/golden expectations remained unchanged.

Every later PR-head commit automatically triggers the same workflow. The PR check displayed for the current head is the authoritative automated verification result for that exact revision.

No GitHub Pages or Cloudflare deployment is requested or changed by this branch.

Generated production files created by the workflow are verification outputs and are not written back to the branch. If committed generated artefacts are required before merge, that remains a separate completion step; no generated file has been hand-edited.

## Remaining acceptance limitation

The startup shell lock is installed synchronously when the application bundle initialises. Automated verification cannot prove that iPhone Safari never paints a pre-script frame before JavaScript executes, so a physical startup review remains the final T-01 visual acceptance check.

## Review gate

This work remains a Draft PR and must not merge until Pritesh explicitly approves it. Automated repository verification is now available on every PR; physical iPhone Safari review of T-01 and any required generated-artefact commit remain the outstanding completion checks.
