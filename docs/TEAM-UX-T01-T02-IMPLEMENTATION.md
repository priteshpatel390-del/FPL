# Team UX T-01 / T-02 implementation record

Status: **Implementation, automated verification and physical T-01 acceptance complete. Owner approved to merge. Not yet merged.**

Date: 7 August 2026.

Base `main`: `d742562059c966e6e456abe39247fa3a18e6c72c`.
Branch: `agent/team-ux-startup-availability`.
Draft PR: #80.

## Approved scope

### T-01 — Startup loading ownership

The existing startup gate remains the startup mechanism and the existing verified refresh/provider flow is unchanged.

While `startup-pending` is active, static source CSS hides the application header, main content and fixed primary navigation. This rule is present in `app.html`, so the loading gate owns the visible viewport from first paint rather than depending on application JavaScript to run first.

The Team presentation layer additionally marks those same shell nodes hidden and inert when the application bundle initialises, and releases them only through the existing one-shot `teamsheet:startup-ready` event after startup finishes. The JavaScript layer therefore preserves interaction/accessibility ownership while the static CSS closes the pre-script visual gap.

This changes presentation ownership only. Refresh cadence, fallback behaviour, providers, data validation, calculations and routing are unchanged.

### T-02 — Team availability clarity

Starting-XI and bench cards add an explicit visible availability badge for Official FPL flagged states: `Doubtful` with the supplied chance when present, `Suspended`, or `Unavailable`. The same state is appended to each affected card's existing accessible label.

The annotation occurs after the existing verified Team renderer has selected the XI, captain, vice-captain and bench. It does not participate in those calculations.

## Explicitly unchanged

No projection model, expected-minutes logic, scoring, best-XI selection, formation, captaincy, vice-captaincy, bench order, fixture calculation, risk calculation, transfer logic, Mini-League logic, provider behaviour, data source, Cloudflare Worker, GitHub Pages configuration, navigation architecture, persistence or security architecture is changed.

No dependency or framework is added. `src/ui/team-pitch.mjs` remains visual-only.

## Regression coverage

`tests/team-ux-startup-availability.test.mjs` contains four focused contracts covering:

- explicit doubtful, unavailable and suspended wording;
- starting and bench availability annotation plus accessible wording;
- startup shell hide/inert ownership through the existing ready event;
- static first-paint CSS ownership before application JavaScript runs.

No existing test or golden expectation is deleted, weakened or regenerated.

## Repository verification workflow

With owner approval, `.github/workflows/verify.yml` adds repository-owned verification for pull requests and manual `workflow_dispatch` runs. It has read-only repository permission, performs no deployment and installs no project package.

It checks out the exact PR revision, runs `./run-tests.sh`, performs two production builds with the exact revision as `BUILD_COMMIT`, compares generated outputs byte-for-byte, verifies root `index.html` equals `dist/index.html`, verifies manifest build identity, and retains the verified production outputs as a short-lived workflow artifact for review/finalisation.

## Verification evidence

The accepted starting baseline on `main` remains **645 passed, 0 failed, 0 skipped, 0 cancelled**, deterministic byte-identical production builds and root/deployable equality. GitHub Pages and the `teamsheet-fpl-gateway` Cloudflare Worker were verified at that merged baseline.

Before the static first-paint correction, GitHub Actions verified the three original T-01/T-02 regressions with **648 passed, 0 failed, 0 skipped, 0 cancelled**, deterministic byte-identical builds, root/deployable equality and exact manifest build identity.

An iPhone-sized first-paint rendering then exposed a genuine residual T-01 issue: the fixed dock could still be painted before JavaScript established shell ownership. That result was treated as a failed visual acceptance check, not as a pass. The static CSS correction above was added in response, together with the fourth regression. The corrected source revision 17ddfa6250ad9039317c159459a63ded30b893a6 passed the permanent repository workflow with **649 passed, 0 failed, 0 skipped, 0 cancelled**, two byte-identical production builds, root/deployable equality and exact manifest build identity.

Generated deployment files are produced only by `build.mjs`; they are never hand-edited. The branch uses a one-time self-removing finalisation workflow when necessary to commit verified generated outputs because GitHub Pages serves the committed production artefacts.

No Cloudflare Worker change or deployment is requested by this branch.

## Visual acceptance

The required visual condition is that an iPhone first paint shows only the startup/loading experience with no header, application content or fixed navigation dock visible above or through it. After the corrected build also passed a 390x844 browser first-paint simulation, Pritesh physically tested the exact PR #80 preview on iPhone Safari on 7 August 2026. The startup screen showed only the Teamsheet loading experience and **no bottom navigation dock**; T-01 therefore passed physical acceptance. T-02 could not be visually exercised on the owner's current squad because no player was flagged at the time of review. That is recorded as an unperformed physical T-02 presentation check, not a pass; the explicit starting/bench availability wording and accessibility labels remain protected by focused automated regressions.

## Review gate

Pritesh approved merge after documentation updates and successful T-01 visual acceptance. Those conditions are now satisfied: automated verification is green, generated deployables are current, and physical iPhone Safari T-01 acceptance passed. T-02 physical presentation was not observable because the current squad had no flagged player; automated T-02 coverage remains green. PR #80 is ready to merge under the existing owner approval.
