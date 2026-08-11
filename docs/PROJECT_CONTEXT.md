# PROJECT_CONTEXT.md

## 11 August 2026 — current GW1-P1 checkpoint

Latest merged GitHub `main` is `43f109b306071aa0c3c1c45985876fecb3da7aa5`. **GW1-P1 — Cloudflare Evidence Foundation** is the current unmerged checkpoint in draft PR #118 on `agent/gw1-p1-cloudflare-evidence-foundation`.

GW1-P1 implements only the backend half of the approved D1 evidence architecture: a separate Cloudflare Access-authenticated evidence Worker, private content-addressed R2 objects, minimal D1 manifest/receipt/index state, independent canonical Stage 10 validation, idempotent duplicate handling and bounded orphan reconciliation. The accepted custody order remains R2 first and D1 second; backend failure is a one-way evidence side effect and must not affect recommendation availability.

The repository record documents owner-performed physical iPhone Safari functional production acceptance of Access, D1/R2, canonical ingest/read-back, duplicate handling, forced R2 failure, forced D1-after-R2 failure and orphan reconciliation. No new physical device testing is claimed by this documentation closeout.

The final preview/version-route security audit found that the evidence Wrangler configuration relied on the implicit Preview URL default while `workers_dev` was enabled. The GW1-P1 candidate now explicitly sets `preview_urls:false` in both byte-identical evidence deployment configs and permanently tests that invariant. **Live post-deployment Cloudflare route evidence is still required before the preview/version security item can be accepted.**

The Teamsheet browser is deliberately **not connected** to this backend in GW1-P1. Persistent pending-upload/outbox integration and automatic in-app cloud custody are GW1-P2 and remain separately approval-gated. Existing Stage 10 local capture, recovery and export semantics are unchanged. Understat/Odds permanent archival remains fail-closed pending separately approved retention rights. No provider acquisition, provider weighting, projection, expected-minutes, fixture, squad, captaincy, transfer, simulation, rank, Mini-League or UI behaviour changes in GW1-P1.

## Historical — 11 August 2026 A3 engineering baseline entering documentation closeout

The A3 engineering baseline entering closeout was GitHub `main` `1060e60d3affadabdf97924c7ece85cc62d8e360`, merge of A3-SC-1 Small Stale-Code Cleanup PR #116 from reviewed head `097fabb6065afc4c322238985eb7f237a503a7c3`. The reviewed tree contained **868 tests, 868 passed, 0 failed, 0 skipped, 0 cancelled**. Permanent post-merge Verify Teamsheet run #194 / `31470879289` passed the repository gate on that exact merge commit, and GitHub Pages run #120 / `31470878300` succeeded for the same commit.

A3 engineering remediation is complete through PR #116. The documentation/architecture reconciliation was the final A3 closeout layer; no A3-specific engineering or documentation task follows it.

Route-Aware Rendering and Performance M1 is complete through PR #115 and remains measurement-only. It demonstrated real avoidable inactive-route work without demonstrating material user-visible lag. **Route-aware optimisation is not approved.** See [Route-Aware Rendering and Performance](ROUTE-AWARE-RENDERING-PERFORMANCE.md).

A3-SC-1 removed only `renderLeagueChips()` and `rememberLeague()` plus stale test-side consumers and added structural regressions. No physical iPhone testing was performed or claimed for PR #116. The brittle `selectMiniLeague` exact-source-string assertion remains separate deferred test-hardening debt. See [A3-SC-1 Small Stale-Code Cleanup](A3-SC-1-SMALL-STALE-CODE-CLEANUP.md).

## Historical — 10 August 2026 baseline after A3 State-Ownership Cleanup

GitHub `main` was `691d9f929284d51c233b61d099c34cafe1030db6`, merge of A3 State-Ownership Cleanup PR #112 from reviewed head `620daf14d1c354668b16df74daf05e29d8a1eb25`.

A3 State-Ownership Cleanup is complete, merged and accepted. It declares the legitimate cross-module `S` slots centrally in `src/state.mjs` without making that module the semantic owner of every value, makes the legacy `S.leagues` Mini-League compatibility alias one-way so `S.miniLeagues` remains canonical, and adds focused ownership regressions. It is deliberately not a general state-management rewrite. No model, provider, persistence-format, error-boundary, Atomic Foreground Refresh, routing-performance or bundler behaviour changed.

The exact-main post-merge Verify Teamsheet run #167 / `31430700053` passed **864 tests, 864 passed, 0 failed, 0 skipped, 0 cancelled**, together with committed deployment provenance, complete production build, deterministic rebuild, root/deployable equality, exact build identity and production-output preservation. GitHub Pages deployment run #117 / `31430697347` also succeeded on that exact merge commit. No physical iPhone testing was performed for PR #112 and none is claimed.

At that checkpoint the next substantive work was **Route-Aware Rendering and Performance**, beginning with investigation and measurement only. Its M1 measurement stage has since merged through PR #115; optimisation remains unapproved, as recorded above.

## Historical checkpoint snapshot — before PR #108 merge: A3 Error-Boundary Separation

**Historical only; superseded by the current baseline above.**

GitHub `main` was `d112c673310149a4463def1758242460450600dc`, merge of PR #107. Push-triggered Verify Teamsheet run #127 / `31396393124` succeeded with **842 passed, 0 failed, 0 skipped, 0 cancelled** plus committed provenance, deterministic rebuild, build identity and production-artifact preservation. The `fpl:calib` compatibility checkpoint was complete and PERSIST-4 closed: unverified stored calibration remained byte-preserved but inert and standard uncalibrated projections remained active.

Pritesh had approved A3 Error-Boundary Separation Package EB-1 for implementation. Draft PR #108 was current. The candidate fixed two proven ownership defects without changing provider acquisition policy: a recovery-render exception could no longer disappear behind a real Official FPL collection failure, and an unexpected supporting-layer computation exception could no longer be manufactured into Understat/Odds provider degradation. Existing provider failures, Rule-B supporting-value retain/clear behaviour, Atomic Foreground Refresh rollback and PR #104 persistence semantics were preserved. Unexpected refresh-lifecycle exceptions received fixed application copy without mutating Provider Health or installing a global swallow boundary.

Candidate evidence at that point was **856 passed, 0 failed, 0 skipped, 0 cancelled** over the 842-test `main` baseline, with all 842 retained and none weakened; committed deployment provenance from reachable source; two byte-identical production builds with root `index.html` equal to `dist/index.html`; exact manifest build identity. Physical acceptance and merge were still outstanding at that snapshot; both are now complete as recorded in repository history.

## 10 August 2026 — PR #103 physical acceptance closeout

The final Small Mobile UI Consistency + Loading Viewport Fix application source is `646eee13960c343fbe07e3a76496717fd9837c0e`, with generated-only child `81cc9130ac2c7b8206f3bd5f6a2cf85bb5ba0777`. The final candidate retains every prior test and passes **803 tests, 0 failed**, deterministic byte-identical builds, root/deployable equality, exact build identity and reachable generated provenance. Permanent Verify Teamsheet run #90 / `31356255017` passed on the exact generated head.

Physical iPhone Safari acceptance is complete: the startup canvas reaches Safari chrome without a light strip; Team, Transfers, Fixtures, Leagues and Settings use the accepted shared header hierarchy; the refined editable/selectable controls are visually proportionate while retaining the no-focus-zoom behaviour; and the Leagues primary box now aligns vertically with the other primary screens. Pritesh explicitly approved PR #103 for merge on 10 August 2026.

No projection, expected-minutes, scoring, fixture, captaincy, squad, transfer, rank, Mini-League/rival, provider, data-source, Atomic Foreground Refresh, navigation, Team-renderer or Player Detail behaviour changed.

## Historical checkpoint — after PR #104 merge

**A3 Cache & Persistence Resilience was merged.** GitHub `main` at that point was `9b31f373a23d26c49f81c688a2ca6fde98086cbd`, the merge of PR #104. Small mobile UI consistency PR #103, Atomic Foreground Refresh PR #102 and the D1 design closeout PR #101 were merged before it.

PR #104's reviewed head was `4e434b940e2bcb473374573db5da16f6a645d9eb`, over source/test commit `502a1f7ac0e0456743f3ddb0695433decf8976d1` and generated-only child `02216b8`. It passes **832 tests, 0 failed**, verified committed build provenance, deterministic byte-identical builds and root/deployable equality, with permanent Verify Teamsheet run #105 / `31377157889` on the reviewed head. Physical iPhone acceptance was **explicitly waived by Pritesh**; none was performed and none is claimed.

The work that followed was post-A3 Checkpoint 0 housekeeping, then 0C, `fpl:calib` compatibility, EB-1, Production-Bundle Safeguards, State-Ownership Cleanup, Route-Aware M1 and A3-SC-1. Those engineering checkpoints are complete.

## Historical — 9 August 2026 D1 design closeout

At that closeout the authoritative baseline was `main` `6e725485564a51ee2a17bc08e5c8bf95e8c2778c`, merge of PR #100; it has since been superseded. The iPhone form-focus zoom correction passed 693 tests and physical iPhone Safari acceptance and is complete.

[Data Architecture D1](DATA-ARCHITECTURE-D1.md) was approved at that checkpoint as a design only. It selected D1 plus private R2 behind a separate authenticated data Worker, retained local fallback and limited Google Sheets to optional downstream reporting. **A later, separately approved GW1-P1 checkpoint authorised and implemented the backend-only foundation now in draft PR #118.** That later approval does not extend to Teamsheet browser integration; the pending-upload/outbox and automatic upload remain GW1-P2.

Purpose: current product and engineering state. Audience: every session after `CLAUDE.md`. Last reconciled: 11 August 2026.

Related: [Architecture](ARCHITECTURE.md), [Decisions](DECISIONS.md), [Roadmap](ROADMAP.md), [Known Limitations](KNOWN_LIMITATIONS.md), [Teamsheet 2.0 Product Blueprint](TEAMSHEET2-PRODUCT-BLUEPRINT.md), [Data Architecture D1](DATA-ARCHITECTURE-D1.md), [GW1-P1 Cloudflare Evidence Foundation](GW1-P1-CLOUDFLARE-EVIDENCE-FOUNDATION.md), [Historical Records](HISTORICAL_RECORDS.md).

## Outcome

Teamsheet is a strongly verified FPL decision product. The complete Teamsheet 2.0 migration, owner-controlled Official FPL gateway, exact persistent Transfers work, Team, Player Detail, Fixtures, Leagues pre-season acceptance, Repository Truth A1, Safe Hygiene A2, Refresh-Load R1, Audit A3, A3-R0, DTR-1, the iPhone form-focus zoom correction, the Data Architecture D1 design closeout, Atomic Foreground Refresh, the small mobile UI consistency checkpoint, A3 cache and persistence resilience, Post-A3 Checkpoint 0/0C, `fpl:calib` compatibility, A3 Error-Boundary Separation, A3 Production-Bundle Safeguards, A3 State-Ownership Cleanup, Route-Aware M1 and A3-SC-1 are merged. A3 engineering remediation and documentation closeout are complete.

**GW1-P1 is the current unmerged checkpoint.** It adds the backend Cloudflare evidence destination and does not change the deterministic recommendation path. Until GW1-P2 is separately approved and implemented, a normal Teamsheet browser session does not automatically upload genuine Stage 10 evidence to that backend. No formula, recommendation or new-provider checkpoint is approved by GW1-P1.

Refresh-Load R1 changed acquisition cadence only: valid detailed histories, normalised Understat team inputs and key-free derived Odds inputs can be reused without repeating their network requests. Atomic foreground-state replacement is merged through PR #102. EB-1 changes failure ownership only. Production-Bundle Safeguards changes test/harness coverage only. State-Ownership Cleanup clarifies shared-state inventory and removes reverse authority from the legacy Mini-League alias only. Route-Aware M1 changes measurement tooling only. A3-SC-1 removes proven-unreachable code only. Understat parser repair and model/data-source expansion remain separately gated. Real minute-history reuse, Stage 10 outcome capture and populated Leagues behaviour still require a completed, officially `data_checked` Gameweek and begin with investigation/evidence only.

## Historical evidence baseline — before PR #107 merge

| Item | Evidence |
|---|---|
| Repository head | GitHub `main` `9b31f373a23d26c49f81c688a2ca6fde98086cbd`, merge of A3 cache and persistence resilience PR #104 |
| Latest merged application checkpoint | PR #104, reviewed head `4e434b940e2bcb473374573db5da16f6a645d9eb`, source `502a1f7ac0e0456743f3ddb0695433decf8976d1` with generated-only child `02216b8` |
| Application tree | The reviewed PR #104 tree is preserved by the merge |
| Permanent automated baseline | PR #104 Verify Teamsheet run #105 / `31377157889` on reviewed head `4e434b9`: 832 passed, 0 failed. |
| Generated application baseline | PR #104 reproduced committed deployables from reachable source before the test build; double builds were byte-identical and root equalled deployable. |
| Deployment architecture at that point | Static GitHub Pages single-file app plus a separate owner-controlled Cloudflare Worker for allowlisted read-only Official FPL transport |
| Approval boundary at that point | D1 was design-only at this historical checkpoint; GW1-P1 backend approval happened later. |

## Physical iPhone Safari baseline

Pritesh has physically accepted the tested populated paths for:

- Transfers, including the six-Gameweek exact calculation, result persistence, cancellation/restart, app switching, stale-result protection and **No hit** wording;
- Player Detail scrolling, rotation, background restoration and dock layering;
- Team startup ownership, availability presentation, reserve-goalkeeper bench position and outfield bench order;
- Fixtures horizontal scrolling and remaining-season horizons through GW38;
- the Leagues all-league hub, league selection/switching, primary persistence, back navigation, pre-season standings/exposure states and Official FPL versus manually added league management.

Atomic Foreground Refresh (PR #102) and the small mobile UI consistency checkpoint (PR #103) additionally have completed physical iPhone Safari acceptance on their merged builds.

EB-1 (PR #108) additionally passed physical iPhone Safari acceptance for normal online startup, manual online refresh, in-app offline refresh retaining saved verified data, and return-online recovery. The clean uncached private-tab offline-first application state could not be exercised because Safari itself could not load the static Pages shell while offline; that path remains automated-only evidence. The incomplete manual squad used during acceptance means recommendation-survival was not independently observed on device.

GW1-P1's repository record additionally documents Pritesh's physical iPhone Safari production functional acceptance of the evidence Worker using deliberately synthetic evidence. That acceptance covers the recorded Access/D1/R2/ingest/idempotency/failure/reconciliation paths only. The later Preview URL hardening was not part of that functional device session and requires separate live Cloudflare route-state confirmation after deployment.

Do not generalise those checks beyond the recorded paths. [Leagues pre-season acceptance](LEAGUES-PRESEASON-ACCEPTANCE.md) is authoritative. A3 cache and persistence resilience has **no** physical device evidence because testing was explicitly waived for that checkpoint. A3 State-Ownership Cleanup, Route-Aware M1 and A3-SC-1 also have **no** physical device evidence; none is claimed for those non-visual/measurement/cleanup checkpoints.

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
- deterministic JSON, Markdown and eight CSV exports; Google Sheets remains a manual downstream destination;
- GW1-P1 backend custody foundation exists server-side, but browser upload/outbox integration is not yet implemented.

## Engineering foundation

- Vanilla JavaScript ES modules; no framework and zero runtime dependencies.
- Node built-in tests and a custom deterministic bundler.
- `src/` plus `app.html` are canonical; `dist/` and root `index.html` are generated only by `build.mjs`.
- GitHub Pages serves the byte-identical root deployment copy.
- The owner-controlled Official FPL Cloudflare Worker is transport-only and performs no account write, model computation or secret handling.
- GW1-P1 adds a **separate** owner-authenticated evidence Worker with private R2 and D1; it is a persistence side effect, not a recommendation dependency, and the browser does not call it until GW1-P2.
- Optional providers fail gracefully; Understat remains team-level and Odds remains direct-only.
- Validated supporting inputs use separate local caches; Understat raw HTML and Odds secrets are never stored in those caches.
- Stage 10 evidence flows one way from frozen prediction to outcome to evaluation to review and cannot feed back into live recommendations.
- `src/state.mjs` is the declared cross-module `S` slot inventory; domain modules remain the semantic owners of their own mutable state.

## Current product gaps

- No single synthesised weekly action across Team, Transfers and Fixtures.
- No validated projected-rank or tactical Mini-League strategy model.
- No cited team-news, predicted-line-up, press-conference, cup-congestion or travel intelligence.
- Bank and free transfers are not yet authoritative account-derived values.
- Hosted Ask Teamsheet remains unavailable.
- Prospective 2026/27 accuracy and calibration evidence has not yet accumulated.
- Google Sheets export is manual and the app cannot run guaranteed work while fully closed on iPhone.
- Automatic in-app cloud evidence custody is not available until GW1-P2 connects the existing Stage 10 browser flow to the GW1-P1 backend with a persistent local outbox.

## Current technical risks

- real post-Gameweek minute-history cache reuse and revision-triggered refresh have automated coverage but cannot yet have physical live-season evidence;
- the flattened bundle still depends on an explicit module order that is broader than the direct import graph, protected by PR #111's complete-bundle safeguards;
- browser persistence failure handling is proven by automated tests only; Teamsheet never installs a `window.storage` manager itself, so the authoritative-backend paths have no physical-device or real-host evidence;
- the shared-state inventory regression guards direct/static `S` property access but is not a general data-flow proof for arbitrary computed property access;
- D1 and R2 cannot share one transaction, so the GW1-P1 custody protocol is recoverable rather than atomic and depends on verified orphan handling;
- permanent Understat/Odds-derived archival rights remain unresolved and the server retention flags remain fail-closed;
- repository `preview_urls:false` is not proof of the currently deployed Cloudflare route state; post-deployment live evidence is required before final GW1-P1 security acceptance;
- browser automation cannot replace physical Safari layout and interaction evidence.

These are roadmap inputs, not authority to change them.

## Current and next

### Current checkpoint

**GW1-P1 — Cloudflare Evidence Foundation final closeout.** Implementation is already approved and exists on draft PR #118. The remaining work is limited to final canonical documentation reconciliation, explicit Preview URL hardening, exact-final-head repository verification, live post-deployment route-state confirmation and PR cleanup/review. Do not merge without Pritesh's explicit approval.

### Completed merged foundation

**Audit A3/A3-R0:** complete and merged through PR #98. **DTR-1:** complete and merged through PR #99. **iPhone form-focus zoom:** complete and merged through PR #100. **Data Architecture D1 design closeout:** merged through PR #101 as documentation only. **Atomic Foreground Refresh:** complete, physically accepted and merged through PR #102. **Small mobile UI consistency:** complete, physically accepted and merged through PR #103. **A3 cache and persistence resilience:** complete and merged through PR #104 with physical iPhone testing explicitly waived. **Post-A3 Checkpoint 0:** complete and merged through PR #105. **0C manual-squad dead-handler cleanup:** complete and merged through PR #106. **`fpl:calib` compatibility:** complete and merged through PR #107. **A3 Error-Boundary Separation (EB-1):** complete, physically accepted on the executable device paths, merged and post-merge verified through PR #108. **A3 Production-Bundle Safeguards:** complete and merged through PR #111. **A3 State-Ownership Cleanup:** complete and merged through PR #112. **Route-Aware Rendering and Performance M1:** measurement instrumentation only, complete and merged through PR #115. **A3-SC-1 Small Stale-Code Cleanup:** complete and merged through PR #116. **A3 documentation/architecture reconciliation:** complete.

GW1-P1 is not in this merged list because PR #118 remains unmerged.

### Next only after GW1-P1 merge and separate approval

The next relevant persistence checkpoint is **GW1-P2 browser evidence sync/persistent outbox design**. It must begin with investigation/design and a fresh approval gate. Do not start it during GW1-P1 closeout. Understat repair, Odds repair, broader D1 schema expansion, Google Sheets automation, hosted AI/ChatGPT migration, scheduled collectors, Cloudflare automation expansion, agents and route-aware optimisation remain separately gated.

### After real Gameweek data

After the first completed and officially `data_checked` Gameweek, investigate real minute-history caching, Stage 10 outcome capture and populated Leagues data without changing calculations. Perform deferred Leagues acceptance and begin genuine Stage 10 evidence review. Investigate defects first; do not tune calculations or add football inputs from a small or unavailable sample.

## Non-negotiable limits

GW1-P1 is approved only for the backend Cloudflare evidence foundation and its direct security/tests/docs/deployment hardening. It does **not** authorise Teamsheet browser sync/outbox behaviour, provider additions/acquisition changes, Understat/Odds repair, model or calculation changes, fixture/scoring/expected-minutes/squad/captaincy/simulation/transfer/rank/Mini-League logic, Google Sheets automation, AI agents, scheduled collectors, UI redesign, route-performance work or unrelated cleanup. Historical aggregate r=0.80 remains method-flattered and is not a validated accuracy claim.
