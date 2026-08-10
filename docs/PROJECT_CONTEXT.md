# PROJECT_CONTEXT.md

## Historical checkpoint snapshot — before PR #107 merge: A3 Error-Boundary Separation

GitHub `main` is `d112c673310149a4463def1758242460450600dc`, merge of PR #107. Push-triggered Verify Teamsheet run #127 / `31396393124` succeeded with **842 passed, 0 failed, 0 skipped, 0 cancelled** plus committed provenance, deterministic rebuild, build identity and production-artifact preservation. The `fpl:calib` compatibility checkpoint is complete and PERSIST-4 is closed: unverified stored calibration remains byte-preserved but inert and standard uncalibrated projections remain active.

Pritesh approved A3 Error-Boundary Separation Package EB-1 for implementation. Draft PR #108 is current. The candidate fixes two proven ownership defects without changing provider acquisition policy: a recovery-render exception can no longer disappear behind a real Official FPL collection failure, and an unexpected supporting-layer computation exception can no longer be manufactured into Understat/Odds provider degradation. Existing provider failures, Rule-B supporting-value retain/clear behaviour, Atomic Foreground Refresh rollback and PR #104 persistence semantics are preserved. Unexpected refresh-lifecycle exceptions receive fixed application copy without mutating Provider Health or installing a global swallow boundary.

EB-1 evidence: **856 passed, 0 failed, 0 skipped, 0 cancelled** over the 842-test `main` baseline, with all 842 retained and none weakened; committed deployment provenance from reachable source; two byte-identical production builds with root `index.html` equal to `dist/index.html`; exact manifest build identity. Every temporary diagnostic workflow used while developing the candidate has been removed from the final tree, so the permanent Verify Teamsheet workflow is the only gate. Permanent Verify Teamsheet on the published head remains an outstanding review gate. No physical iPhone testing has been performed or claimed for EB-1; because EB-1 changes user-visible failure copy, an owner device pass is advisable before merge.

After EB-1, Production-Bundle Safeguards is next and begins with investigation/design only.
## 10 August 2026 — PR #103 physical acceptance closeout

The final Small Mobile UI Consistency + Loading Viewport Fix application source is `646eee13960c343fbe07e3a76496717fd9837c0e`, with generated-only child `81cc9130ac2c7b8206f3bd5f6a2cf85bb5ba0777`. The final candidate retains every prior test and passes **803 tests, 0 failed**, deterministic byte-identical builds, root/deployable equality, exact build identity and reachable generated provenance. Permanent Verify Teamsheet run #90 / `31356255017` passed on the exact generated head.

Physical iPhone Safari acceptance is complete: the startup canvas reaches Safari chrome without a light strip; Team, Transfers, Fixtures, Leagues and Settings use the accepted shared header hierarchy; the refined editable/selectable controls are visually proportionate while retaining the no-focus-zoom behaviour; and the Leagues primary box now aligns vertically with the other primary screens. Pritesh explicitly approved PR #103 for merge on 10 August 2026.

No projection, expected-minutes, scoring, fixture, captaincy, squad, transfer, rank, Mini-League/rival, provider, data-source, Atomic Foreground Refresh, navigation, Team-renderer or Player Detail behaviour changed. At documentation closeout, GitHub `main` remained `d5f2572ee4d95c3c242ecbc97ee46802a6f0273d`; the eventual merge commit must be read from latest `main` rather than inferred from this pre-merge documentation commit.

## 10 August 2026 — current checkpoint

**A3 Cache & Persistence Resilience is merged.** GitHub `main` is `9b31f373a23d26c49f81c688a2ca6fde98086cbd`, the merge of PR #104. Small mobile UI consistency PR #103, Atomic Foreground Refresh PR #102 and the D1 design closeout PR #101 are merged before it.

PR #104's reviewed head was `4e434b940e2bcb473374573db5da16f6a645d9eb`, over source/test commit `502a1f7ac0e0456743f3ddb0695433decf8976d1` and generated-only child `02216b8`. It passes **832 tests, 0 failed**, verified committed build provenance, deterministic byte-identical builds and root/deployable equality, with permanent Verify Teamsheet run #105 / `31377157889` on the reviewed head. Physical iPhone acceptance was **explicitly waived by Pritesh**; none was performed and none is claimed.

The current work is **post-A3 Checkpoint 0 housekeeping**: automatic Verify Teamsheet verification of `main`, this documentation reconciliation, and an investigation of duplicate manual-squad handlers. It changes no application runtime source. See [Post-A3 Checkpoint 0](POST-A3-CHECKPOINT-0-HOUSEKEEPING.md).

Data Architecture D1 remains an approved design only; D1/R2/Worker persistence implementation is not approved. The next checkpoint is **`fpl:calib` compatibility and resilience** — investigation/design first, separately model-gated — followed by **A3 error-boundary separation**. Neither is pre-approved. See [Roadmap](ROADMAP.md) for the full sequence.

## 9 August 2026 D1 closeout

At that closeout the authoritative baseline was `main` `6e725485564a51ee2a17bc08e5c8bf95e8c2778c`, merge of PR #100; it has since been superseded — see the current checkpoint above. The iPhone form-focus zoom correction passed 693 tests and physical iPhone Safari acceptance and is complete.

[Data Architecture D1](DATA-ARCHITECTURE-D1.md) is an approved design, not an implementation. It selects D1 plus private R2 behind a separate authenticated data Worker, retains local fallback, and limits Google Sheets to optional downstream reporting. The engineering checkpoint that followed it, Atomic Foreground Refresh, is now merged; D1 implementation itself remains separately approval-gated.

Purpose: current product and engineering state. Audience: every session after `CLAUDE.md`. Last reconciled: 10 August 2026.

Related: [Architecture](ARCHITECTURE.md), [Decisions](DECISIONS.md), [Roadmap](ROADMAP.md), [Known Limitations](KNOWN_LIMITATIONS.md), [Teamsheet 2.0 Product Blueprint](TEAMSHEET2-PRODUCT-BLUEPRINT.md), [Historical Records](HISTORICAL_RECORDS.md).

## Outcome

Teamsheet is a healthy, strongly verified FPL decision product. The complete Teamsheet 2.0 migration, owner-controlled Official FPL gateway, exact persistent Transfers work, Team, Player Detail, Fixtures, Leagues pre-season acceptance, Repository Truth A1, Safe Hygiene A2, Refresh-Load R1, Audit A3, A3-R0, DTR-1, the iPhone form-focus zoom correction, the Data Architecture D1 design closeout, Atomic Foreground Refresh, the small mobile UI consistency checkpoint and A3 cache and persistence resilience are merged. No formula, recommendation or new-provider checkpoint is approved.

Refresh-Load R1 changed acquisition cadence only: valid detailed histories, normalised Understat team inputs and key-free derived Odds inputs can be reused without repeating their network requests. Atomic foreground-state replacement is now merged through PR #102. Understat parser repair and model/data-source expansion remain separately gated. Real minute-history reuse, Stage 10 outcome capture and populated Leagues behaviour still require a completed, officially `data_checked` Gameweek and begin with investigation/evidence only.

## Historical evidence baseline — before PR #107 merge

| Item | Evidence |
|---|---|
| Repository head | GitHub `main` `9b31f373a23d26c49f81c688a2ca6fde98086cbd`, merge of A3 cache and persistence resilience PR #104 |
| Latest merged application checkpoint | PR #104, reviewed head `4e434b940e2bcb473374573db5da16f6a645d9eb`, source `502a1f7ac0e0456743f3ddb0695433decf8976d1` with generated-only child `02216b8` |
| Application tree | The reviewed PR #104 tree is preserved by the merge |
| Permanent automated baseline | PR #104 Verify Teamsheet run #105 / `31377157889` on reviewed head `4e434b9`: 832 passed, 0 failed. The merge commit received no automatic run, because `verify.yml` did not trigger on pushes to `main`; Checkpoint 0A corrects that for future merges. |
| Generated application baseline | PR #104 reproduced committed deployables from reachable source before the test build; double builds were byte-identical and root equalled deployable. Independently reproduced locally at the merge commit `9b31f373…`. |
| Current unmerged candidate | Post-A3 Checkpoint 0 housekeeping on `claude/teamsheet-post-a3-closeout-crqojj`: CI trigger correction, documentation reconciliation and the 0C investigation. No application runtime source change. |
| Deployment architecture | Static GitHub Pages single-file app plus a separate owner-controlled Cloudflare Worker for allowlisted read-only Official FPL transport |
| Approval boundary | D1 design is approved and documented, but D1/R2/Worker persistence implementation is not. PR #104 hardened browser-side persistence only and left `fpl:calib` untouched. The `fpl:calib` compatibility and resilience checkpoint is next, is separately model-gated and begins with investigation; PERSIST-4 stays open until it completes. Error-boundary separation follows it. The Checkpoint 0C duplicate-handler correction is a separate proposed narrow checkpoint, proposed only and not approved. |

## Physical iPhone Safari baseline

Pritesh has physically accepted the tested populated paths for:

- Transfers, including the six-Gameweek exact calculation, result persistence, cancellation/restart, app switching, stale-result protection and **No hit** wording;
- Player Detail scrolling, rotation, background restoration and dock layering;
- Team startup ownership, availability presentation, reserve-goalkeeper bench position and outfield bench order;
- Fixtures horizontal scrolling and remaining-season horizons through GW38;
- the Leagues all-league hub, league selection/switching, primary persistence, back navigation, pre-season standings/exposure states and Official FPL versus manually added league management.

Atomic Foreground Refresh (PR #102) and the small mobile UI consistency checkpoint (PR #103) additionally have completed physical iPhone Safari acceptance on their merged builds.

Do not generalise those checks beyond the recorded paths. [Leagues pre-season acceptance](LEAGUES-PRESEASON-ACCEPTANCE.md) is authoritative. A3 cache and persistence resilience has **no** physical device evidence.

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
- browser persistence failure handling is proven by automated tests only; Teamsheet never installs a `window.storage` manager itself, so the authoritative-backend paths have no physical-device or real-host evidence;
- browser automation cannot replace physical Safari layout and interaction evidence.

These are roadmap inputs, not authority to change them.

## Current and next

### Completed now

**Audit A3/A3-R0:** complete and merged through PR #98. **DTR-1:** complete and merged through PR #99. **iPhone form-focus zoom:** complete and merged through PR #100. **Data Architecture D1 design closeout:** merged through PR #101 as documentation only. **Atomic Foreground Refresh:** complete, physically accepted and merged through PR #102. **Small mobile UI consistency:** complete, physically accepted and merged through PR #103 at `473cfdb3295d2b896a00c0aa7b1308814bf2e043`. **A3 cache and persistence resilience:** complete and merged through PR #104 at `9b31f373a23d26c49f81c688a2ca6fde98086cbd`, with physical iPhone testing explicitly waived by the owner. It hardens the browser persistence boundary only: exact schema/season compatibility for the main `fpl:cache`, season/version ownership for user-owned records, verified writes that mean restorable, safe manual-squad/config ordering, and truthful session-only warnings when a write fails.

### Current checkpoint

**Post-A3 Checkpoint 0 housekeeping** — deliberately small and limited to continuous integration, documentation and investigation. It makes Verify Teamsheet run automatically on every merge to `main`, reconciles canonical documentation after the PR #104 merge, and records an investigation of duplicate manual-squad handlers whose proposed correction is **not implemented and not approved**. No application runtime source changes. See [Post-A3 Checkpoint 0](POST-A3-CHECKPOINT-0-HOUSEKEEPING.md).

### Next planned checkpoint

Begin **`fpl:calib` compatibility and resilience** with investigation/design and a fresh latest-`main` baseline. It is **separately model-gated**, because `fpl:calib` feeds projections and any change to how a legacy calibration record is accepted, rejected or identified crosses the model approval gate. [PERSIST-4](KNOWN_LIMITATIONS.md) is retained as open until that checkpoint completes; nothing about its implementation is approved. **A3 error-boundary separation** follows it, also beginning with investigation/design. The full sequence is in [Roadmap](ROADMAP.md). Separately, after the first completed and officially `data_checked` Gameweek, investigate real minute-history caching, Stage 10 outcome capture and populated Leagues data without changing calculations.

### After real Gameweek data

Perform the deferred Leagues acceptance and begin genuine Stage 10 evidence review. Investigate defects first; do not tune calculations or add football inputs from a small or unavailable sample.

## Non-negotiable limits

Refresh-Load R1 changes acquisition cadence and validated local persistence only. A3 cache and persistence resilience changes browser persistence compatibility, verification and disclosure only, and leaves `fpl:calib` untouched behind the model approval gate. Neither changes any provider/source/endpoint, model, fixture, scoring, expected-minutes, squad, captaincy, simulation, transfer, rank, Mini-League, strategy, route, navigation, Cloudflare or Pages architecture. Historical aggregate r=0.80 remains method-flattered and is not a validated accuracy claim.
