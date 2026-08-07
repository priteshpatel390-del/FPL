# Team UX T-01 / T-02 implementation record

Status: **Draft implementation for owner review. Not merged.**

Date: 7 August 2026.

Base `main`: `d742562059c966e6e456abe39247fa3a18e6c72c`.
Branch: `agent/team-ux-startup-availability`.

## Approved scope

### T-01 — Startup loading ownership

The existing startup gate remains the startup mechanism and the existing verified refresh/provider flow is unchanged. While the document still has the existing `startup-pending` state, the Team presentation layer marks the application header, main content and fixed primary navigation as hidden and inert. Those shell nodes are released only by the existing `teamsheet:startup-ready` event.

This is presentation ownership only. It does not change refresh cadence, fallback behaviour, provider calls, data validation, calculations or routing.

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

`tests/team-ux-startup-availability.test.mjs` adds focused contracts for:

- explicit doubtful, unavailable and suspended presentation;
- chance-of-playing wording and screen-reader wording;
- both starting and bench card annotation;
- preservation of the existing Team-selection functions rather than replacement;
- startup ownership of header, main and primary navigation;
- release through the existing one-shot `teamsheet:startup-ready` event.

No existing test or golden expectation is deleted, weakened or regenerated.

## Verification status

The accepted starting baseline on `main` is **645 passed, 0 failed, 0 skipped, 0 cancelled**, deterministic byte-identical production builds and root/deployable equality. GitHub Pages and the `teamsheet-fpl-gateway` Cloudflare Worker were verified at that baseline.

Full branch verification with `./run-tests.sh`, two exact-identity production builds, byte comparison and root/deployable equality is still required before this implementation can be called complete. The current execution environment does not provide a local GitHub checkout or GitHub CLI, and the repository has no GitHub Actions workflow on which to run the required build/test command without introducing unapproved CI infrastructure. This draft record therefore does **not** claim that the new branch has passed the full completion gate.

No GitHub Pages or Cloudflare deployment is requested or changed by this draft.

## Review gate

This work must remain a Draft PR and must not merge until Pritesh explicitly approves it. If full branch verification cannot be performed in the implementation environment, that limitation remains blocking for completion rather than being treated as a pass.
