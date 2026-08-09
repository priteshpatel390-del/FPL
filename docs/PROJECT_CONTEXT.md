# PROJECT_CONTEXT.md


## 9 August 2026 physical UI correction

The first PR #103 candidate (`0e3a0674416aa069a0f06ebee87854df41907ed0` source, `b53c8026a5485936582da1ea2374f9bad799e44d` generated) passed 798 automated tests and permanent Verify Teamsheet run `31338489146`, but **failed physical iPhone Safari acceptance**: the light startup strip remained and the five primary-route header boxes still presented inconsistent structure/rhythm. The corrected review source is `aec0c4f55ac051fd5016d7e93a70415de2dbc308` with generated-only child `a7bea9e1a96fda958239099a3ec64aef8cc30874`. It adds two regressions, retains all 798 prior tests and passes **800 tests** before publication. The correction gives Safari an explicit opaque dark startup background colour beneath the gradient and gives Team, Transfers, Fixtures, Leagues and Settings one shared `primary-page-header` box/title/intro contract while preserving the Leagues Manage action. Physical iPhone Safari retest remains required; merge is not approved.


## 9 August 2026 current checkpoint

Current GitHub `main` at the start of this checkpoint is `d5f2572ee4d95c3c242ecbc97ee46802a6f0273d`, merge of Atomic Foreground Refresh PR #102. PR #102 is merged and verified at **792 passed, 0 failed, 0 skipped**, with deterministic/generated provenance, independent re-review and physical iPhone Safari acceptance. The current approved implementation candidate is **Small Mobile UI Consistency + Loading Viewport Fix**. Its reviewed source is `0e3a0674416aa069a0f06ebee87854df41907ed0` and generated-only child is `b53c8026a5485936582da1ea2374f9bad799e44d`. Six focused regressions raise the candidate suite to **798 tests**; the publication gate passed the complete suite, deterministic double build, root/deployable equality and reachable generated provenance. Physical iPhone Safari acceptance of this UI candidate remains required before merge. This current-state block supersedes older 9 August wording below where it describes PR #102 as unmerged or cites the 691/693-test application baseline.

## 9 August 2026 D1 closeout

The current authoritative baseline is `main` `6e725485564a51ee2a17bc08e5c8bf95e8c2778c`, merge of PR #100. The iPhone form-focus zoom correction passed 693 tests and physical iPhone Safari acceptance and is complete.

[Data Architecture D1](DATA-ARCHITECTURE-D1.md) is an approved design, not an implementation. It selects D1 plus private R2 behind a separate authenticated data Worker, retains local fallback, and limits Google Sheets to optional downstream reporting. The next engineering checkpoint is Atomic Foreground Refresh; implementation remains separately approval-gated.

Purpose: current product and engineering state. Audience: every session after `CLAUDE.md`. Last reconciled: 9 August 2026.

Related: [Architecture](ARCHITECTURE.md), [Decisions](DECISIONS.md), [Roadmap](ROADMAP.md), [Known Limitations](KNOWN_LIMITATIONS.md), [Teamsheet 2.0 Product Blueprint](TEAMSHEET2-PRODUCT-BLUEPRINT.md), [Historical Records](HISTORICAL_RECORDS.md).

## Outcome

Teamsheet is a healthy, strongly verified FPL decision product. The complete Teamsheet 2.0 migration, owner-controlled Official FPL gateway, exact persistent Transfers work, Team, Player Detail, Fixtures, Leagues pre-season acceptance, Repository Truth A1, Safe Hygiene A2, Refresh-Load R1, Audit A3, A3-R0 and DTR-1 are merged. No formula, recommendation or new-provider checkpoint is approved.

Refresh-Load R1 changed acquisition cadence only: valid detailed histories, normalised Understat team inputs and key-free derived Odds inputs can be reused without repeating their network requests. Understat parser repair, atomic foreground-state replacement and model/data-source expansion remain separately gated. The next substantive checkpoint requires a completed, officially checked Gameweek and begins with investigation/evidence only.

## Evidence baseline

| Item | Evidence |
|---|---|
| Repository head | GitHub `main` `6e725485564a51ee2a17bc08e5c8bf95e8c2778c`, merge of iPhone form-focus zoom PR #100 |
| Latest application checkpoint | iPhone form-focus zoom PR #100, merge `6e725485564a51ee2a17bc08e5c8bf95e8c2778c`; DTR-1 remains complete through PR #99 |
| Application tree | The accepted PR #100 tree is preserved by the merge |
| Permanent automated baseline | PR #100 Verify Teamsheet run `31319724304`: 693 passed, 0 failed |
| Generated application baseline | PR #99 reproduced committed deployables from reachable source `a15443f3de889561fd301c4aa1792d19f7b21c83`; double builds were byte-identical and root equalled deployable |
| Deployment architecture | Static GitHub Pages single-file app plus a separate owner-controlled Cloudflare Worker for allowlisted read-only Official FPL transport |
| Approval boundary | D1 design is approved and documented, but persistence implementation is not. Atomic Foreground Refresh is next and begins with investigation; implementation remains owner-gated. |

## Physical iPhone Safari baseline

Pritesh has physically accepted the tested populated paths for:

- Transfers, including the six-Gameweek exact calculation, result persistence, cancellation/restart, app switching, stale-result protection and **No hit** wording;
- Player Detail scrolling, rotation, background restoration and dock layering;
- Team startup ownership, availability presentation, reserve-goalkeeper bench position and outfield bench order;
- Fixtures horizontal scrolling and remaining-season horizons through GW38;
- the Leagues all-league hub, league selection/switching, primary persistence, back navigation, pre-season standings/exposure states and Official FPL versus manually added league management.

Do not generalise those checks beyond the recorded paths. [Leagues pre-season acceptance](LEAGUES-PRESEASON-ACCEPTANCE.md) is authoritative.

Refresh-Load R1's first PR #96 device pass additionally accepted online startup, exact build identity, short background return, Provider Health, manual refresh, cached repeat launch and in-app offline resilience. It exposed one merge blocker: an offline in-app refresh could be described as newly loaded/live when Safari satisfied gateway requests from HTTP cache. The corrected build prevents network acquisition when Safari definitively reports offline, preserves the saved snapshot and labels FPL Fallback. Pritesh physically retested and accepted that exact path, then verified the accepted build identity after Pages returned to `main`. A full offline hard reload cannot load the static Pages application shell and is explicitly outside R1.

## Deferred live-season acceptance

The following Leagues evidence requires real post-Gameweek Official FPL data and is deliberately deferred:

- published rank and movement;
- populated standings and points gaps;
- nearby-rival selection and pairwise comparison;
- selected-rival squad, captain, vice-captain and chip exposure;
- stale, incomplete and unavailable rival handling against real responses;
- relevant large-league targeted pagination.

These are evidence gaps, not current defects. Any issue found later must be investigated and scoped separately before implementation.

## Product purpose

Teamsheet helps an FPL manager make better decisions about their own complete 15-player squad. It is team-first rather than player-first and decision-first rather than data-first. The ordinary weekly workflow should answer:

1. What is my best XI, captain, vice-captain and bench order?
2. Should I roll, transfer or take a hit?
3. Which fixture runs matter to my current team and transfer plans?
4. Where do I stand in my leagues and how do explicitly selected rivals differ?
5. Is any data limitation material to the decision?

Technical diagnostics, evidence operations and advanced research remain available under Settings without dominating the primary workflow.

## Implemented information architecture

The deployed primary navigation is:

1. **Team**
2. **Transfers**
3. **Fixtures**
4. **Leagues**
5. **Settings**

Player Explorer lives under Settings → Research Tools. Ask Teamsheet has a global/Team route, but hosted AI is disabled because client-side Anthropic keys are prohibited. Free transfers and bank remain visible on Team and are currently manual inputs rather than proven authoritative account values.

## Implemented capability

### Team

- legal 15-player squad gating and a pitch-first connected/manual/restricted experience;
- deterministic best XI, captain, vice-captain and bench order;
- base-XI and captain-uplift forecast presentation;
- one material risk and advisory deadline action;
- session-only decision preview without FPL account writes.

### Transfers

- exact zero-to-three-transfer search over the approved eligible universe;
- mandatory zero-transfer comparison, complete squad legality, affordability, hits, free-transfer utility and roll value;
- application-scoped Web Worker calculation that survives internal navigation;
- independent reduced-pool exhaustive oracle and permanent exactness/performance guards.

### Fixtures

- blanks, doubles, difficulty lenses, run scores and swing windows;
- Official FPL overall-FDR fallback when strength inputs are unavailable;
- user-selected horizons bounded by the remaining season through GW38.

### Leagues

- all-league hub using already-loaded Official FPL membership facts;
- invitational/general/saved grouping and honest unpublished-rank handling;
- selected-league detail, targeted/incremental standings, pairwise rival comparison and at-most-five explicitly selected rival exposure;
- no full-league squad fan-out, projected rank, effective-ownership strategy or protect/chase recommendation.

### Settings and evidence

- Team & Account, Research Tools, Evidence & Performance, Data & Diagnostics and Help & About route groups;
- seven-state Provider Health and consequence-led core-data warnings;
- immutable pre-deadline snapshots, Official FPL outcomes, descriptive metrics and operating review;
- deterministic JSON, Markdown and eight CSV exports; Google Sheets remains a manual downstream destination.

## Engineering foundation

- Vanilla JavaScript ES modules; no framework and zero runtime dependencies.
- Node built-in tests and a custom deterministic bundler.
- `src/` plus `app.html` are canonical; `dist/` and root `index.html` are generated only by `build.mjs`.
- GitHub Pages serves the byte-identical root deployment copy.
- The Cloudflare gateway is transport-only and performs no account write, model computation or secret handling.
- Optional providers fail gracefully; Understat remains team-level and Odds remains direct-only.
- Validated supporting inputs use separate local caches; Understat raw HTML and Odds secrets are never stored in those caches.
- Stage 10 evidence flows one way from frozen prediction to outcome to evaluation to review and cannot feed back into live recommendations.

## Current product gaps

- No single synthesised weekly action across Team, Transfers and Fixtures.
- No validated projected-rank or tactical Mini-League strategy model.
- No cited team-news, predicted-line-up, press-conference, cup-congestion or travel intelligence.
- Bank and free transfers are not yet authoritative account-derived values.
- Hosted Ask Teamsheet remains unavailable.
- Prospective 2026/27 accuracy and calibration evidence has not yet accumulated.
- Google Sheets export is manual and the app cannot run guaranteed work while fully closed on iPhone.

## Current technical risks

- real post-Gameweek minute-history cache reuse and revision-triggered refresh have automated coverage but cannot yet have physical live-season evidence;
- the flattened bundle still depends on an explicit module order that is broader than the direct import graph;
- the form-focus correction changes editable-control typography across multiple routes and requires exact-device focus/keyboard recovery evidence before merge;
- browser automation cannot replace physical Safari layout and interaction evidence.

These are roadmap inputs, not authority to change them.

## Current and next

### Completed now

**Audit A3/A3-R0:** complete and merged through PR #98. **DTR-1:** complete, permanently verified, physically accepted and merged through PR #99 at `09e595c275b4f3614c09fb502291de6831813999`.

### Next planned checkpoint

Complete the approved iPhone form-focus zoom checkpoint, including exact-build physical Safari focus/recovery testing. Then begin Data Architecture D1 investigation/design. D1 must define historical/live requirements and compare Cloudflare D1, KV, R2, Durable Objects and Google Sheets; no implementation is pre-approved. Separately, after the first completed and officially `data_checked` Gameweek, investigate real minute-history caching, Stage 10 outcome capture and populated Leagues data without changing calculations.

### After real Gameweek data

Perform the deferred Leagues acceptance and begin genuine Stage 10 evidence review. Investigate defects first; do not tune calculations or add football inputs from a small or unavailable sample.

## Non-negotiable limits

Refresh-Load R1 changes acquisition cadence and validated local persistence only. It changes no provider/source/endpoint, model, fixture, scoring, expected-minutes, squad, captaincy, simulation, transfer, rank, Mini-League, strategy, route, navigation, Cloudflare or Pages architecture. Historical aggregate r=0.80 remains method-flattered and is not a validated accuracy claim.
