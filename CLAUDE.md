# CLAUDE.md — onboarding for every future development session

## Research programme control centre — mandatory before external-intelligence work

The permanent pre-GW1 and later external-intelligence research programme is indexed at [docs/research/README.md](docs/research/README.md). The original [External Intelligence Foundation](docs/EXTERNAL-INTELLIGENCE-FOUNDATION.md) remains the unmoved historical/root investigation; the research index does not replace or duplicate it.

Before any provider evaluation, external-data proposal, expected-minutes evidence proposal, shadow observation/store proposal, external-repository adoption, model ablation or other external-intelligence implementation proposal, read **both** the Foundation and `docs/research/README.md`, then read the relevant topic branch record. A branch marked `Research complete`, `Awaiting evidence` or `Ready for approval` still does not approve a provider, data source, retention right, model input, weight, formula or runtime path. Time-sensitive access, pricing/free-tier, terms, licensing, retention rights, source maintenance and reliability must be re-verified before implementation. Production behaviour remains governed by the canonical docs and the normal explicit owner approval gates.

## Current state — read this section first

**This file describes the tree it lives in.** It deliberately does not restate the current `main` commit SHA: GitHub owns that fact, it changes on every merge, and duplicating it here is how this documentation went stale before. Read the live SHA with `git rev-parse origin/main`, and read live pull-request state from GitHub. Everything below is a durable statement about the work itself.

### Two independent streams

Do not collapse these. They have different scopes, different gates and different owners.

**Stream 1 — the Teamsheet application. Ready for GW1.**

The most recent application checkpoint is **GW1 readiness — pre-deadline Transfers safety guard**, delivered on **PR #121**. Before the first Official FPL deadline of a season the Transfers screen suppresses the weekly free-transfer/hit optimiser and states that initial squad changes are unlimited; the rule is derived from verified Official FPL event data and normal weekly behaviour resumes at the deadline instant. No optimiser mathematics changed. **Pritesh physically accepted it on iPhone Safari** on the exact candidate head `f72023043813566fe8b11da2d959e374d34bca39`, which passed Verify Teamsheet #262 / `31583716004` with **898 tests, 898 passed, 0 failed, 0 skipped, 0 cancelled** (the then-current baseline for that application head; the same PR's documentation reconciliation raises the repository baseline to **904** without touching application code), deterministic byte-identical builds, root/deployable equality and verified committed build provenance. GitHub Pages was pointed at the branch for that acceptance and then restored to `main`, each observed built (Pages #126 branch, **#127 `main`**). See [GW1 readiness safety guard](docs/GW1-READINESS-SAFETY-GUARD.md).

**934 is the current repository test baseline.** The 898 above is the then-current count on the physically accepted application head; the documentation-integrity regressions added by the same PR's reconciliation raised it to 904, and the pre-GW1 housekeeping closeout then added one documentation-integrity regression and split the hardened `selectMiniLeague` coverage into behavioural and mutation-sensitivity contracts, reaching 907. The GW1-P2D-P1 diagnostic transport probe then added its focused regressions, reaching 934. No model, provider or application decision behaviour changed across any of those steps. Earlier counts (907, 904, 898, 883, 868, 864, …) are historical checkpoint evidence, not current claims.

The GW1 readiness audit that preceded PR #121 found **zero blockers** and two should-fix items; PR #121 addressed both. The application is suitable for GW1 subject only to the separate live-only gates named below. No model, provider, fixture, expected-minutes, scoring, squad, captaincy, transfer, optimiser, simulation, rank or Mini-League behaviour was authorised or changed by readiness work.

**Stream 2 — automatic cloud evidence custody. Still unaccepted, and not a GW1 blocker.**

**GW1-P2 — Browser evidence delivery and durable outbox** is an implemented candidate on **draft, unmerged PR #119**, branch `claude/gw1-p2-evidence-delivery-design-ejsb0d`, head `414eb58f6207b3e2a78515a93d0c4c98685b3863`. It connects the existing Stage 10 browser capture path to the GW1-P1 archive through a durable local outbox, a transport-independent delivery state machine, content-hash idempotency and fail-closed provider retention. Cloud custody remains a one-way side effect: the FPL recommendation never reads, waits for, or fails because of the archive, so **GW1-P2 is not a recommendation dependency and does not gate GW1**.

**Option A failed its physical acceptance on 20 August 2026** and PR #134 recorded that closeout. On a real iPhone in normal Safari with Prevent Cross-Site Tracking ON, a genuine Stage 10 record was captured and Access top-level authentication and protected `GET /v1/health` both succeeded, but the automatic `Waiting to archive` → `Archived` transition was never observed. **The root cause was not isolated**: Safari, ITP, Access, CORS, preflight, Worker configuration and client scheduling all remain unexcluded, and none may be stated as the cause. Option C same-site hosting is the preferred next architecture by feasibility decision only; nothing is approved for implementation.

**GW1-P2D-P1 — Diagnostic transport probe** is the current unmerged diagnostic candidate that follows it. It adds owner-initiated diagnostic instrumentation only — no transport fix and no replacement architecture — so the failed stage can be isolated before any architecture is chosen. See [GW1-P2D-P1 Diagnostic transport probe](docs/GW1-P2D-DIAGNOSTIC-TRANSPORT-PROBE.md).

Until PR #119 is accepted and merged, **local Stage 10 capture, recovery and owner-controlled export remain the operating fallback** for pre-deadline evidence. That fallback is complete and merged; nothing about GW1 operation waits on PR #119.

### Planning record — External Intelligence Foundation, documentation only

[External Intelligence Foundation](docs/EXTERNAL-INTELLIGENCE-FOUNDATION.md) is the canonical research and shadow-architecture record for future external football information. It is **documentation only and approves nothing**: no provider, endpoint, API key, acquisition cadence, retention right, model, weighting, expected-minutes, fixture, squad, captaincy, transfer, simulation, rank or Mini-League change is authorised by it, and it does not alter the pre-GW1 freeze.

Read it before any future provider, external-data, expected-minutes-evidence or ablation proposal. It fixes three things that later work must not quietly undo: external observations must normalise into a **provider-neutral contract** with separate `observedAt` / `effectiveAt` / `fetchedAt` timing, canonical Official FPL identity and an explicit rights/retention classification; any first implementation must be **`shadow_only`**, with no path from shadow storage into projected points, the optimiser, captaincy, transfers or Mini-Leagues without separate explicit approval; and the layers — structural strength, recent performance, market expectation, availability/expected minutes, calendar/workload, set-piece and role, matchup microstats, transfer economics, competitive strategy — must stay separate rather than collapsing into one confidence score. Its free-source research is dated 12 August 2026 and must be re-verified from first-party sources before any implementation approval.

Its one operationally relevant conclusion for now: current Stage 10 **already** preserves the normalised Odds inputs that affected a prediction when Odds is healthy, so the primary market-layer on/off ablation needs no new pre-GW1 code — only a genuine, healthy, exported capture. Raw bookmaker prices and intraday line movement are not preserved and are not reconstructible on the free tier, and that lost optionality does **not** justify breaking the freeze.

### Immediate operating state

Pre-GW1 code freeze and operational rehearsal. The next work is **not** post-GW1 model or provider enhancement. In order:

1. Hold the freeze; make only separately approved fixes.
2. Operate GW1 and collect prospective evidence.
3. Isolate the failed Option A transport stage with the GW1-P2D-P1 diagnostic before choosing any replacement architecture.
4. Review evidence at the **GW5 → GW6** international break.

### GW1-P2 gate detail

Separate what is done from what is unproven. Do not collapse these three into one status:

1. **Completed owner preparation — recorded, do not repeat or re-request.** Cloudflare Access `Bypass OPTIONS requests to origin` was enabled and saved for `teamsheet-evidence-archive`. No Access-layer allowed-origin response was configured, so the Worker remains the sole owner of exact allowed-origin CORS enforcement and no Access policy for `POST`, `GET` or any other method changed. Top-level physical iPhone Safari Cloudflare Access authentication succeeded and protected `GET /v1/health` returned `{"ok":true,"archiveVersion":"1.0.0","schemaVersion":"1.0.0","migrationVersion":1}`. Settings → Evidence showed the expected pre-window state, non-destructive storage telemetry showed approximately 546.2 KB of Teamsheet-owned data, and GitHub Pages was switched to the PR #119 branch and restored to `main`, each observed built. `TEAM_DOMAIN`, `POLICY_AUD`, Access JWTs and cookies must still never be printed, pasted or logged.
2. **The decisive application POST failed physical acceptance and its cause is still unisolated.** The credentialled cross-site background upload from `priteshpatel390-del.github.io` to `teamsheet-evidence-archive.fpltsheet.workers.dev` did not deliver on 20 August 2026 under normal Safari privacy settings, and the predeclared behavioural rule was followed: the test was stopped rather than weakening Safari privacy. Disabling Prevent Cross-Site Tracking is a diagnostic comparison only and must never become a product requirement. Do not implement Option B or Option C without separate approval, and do not remove the transport-independent outbox/delivery work. The GW1-P2D-P1 diagnostic is the approved next step and proves no cause by itself.
3. **Durable-retention cap — an unresolved limitation, not a gate to close by testing harder.** `OUTBOX_RULES.pinLimit` is held at **4** as a deliberately conservative bounded-outbox policy for the first acceptance cycle. The measured record and supporting-store sizes are valid evidence; the usable storage ceiling on the owner's iPhone is **not** evidenced, so four is not claimed to be proven safe and browser-reported available-space estimates are not a quota guarantee. Do not raise it to 5 or 6 in this checkpoint, and do not introduce IndexedDB or any other persistence technology without a separate proposal. Non-destructive device evidence is read from the Settings → Evidence panel; never run a destructive fill-until-quota test against real evidence. See [GW1-P2 Browser evidence delivery](docs/GW1-P2-BROWSER-EVIDENCE-DELIVERY.md).

The first relevant 2026/27 international break is **GW5 → GW6**, not GW2 → GW3. GW1–GW5 is the initial stability/prospective-evidence period and the GW5 → GW6 break is the first major evidence-led review opportunity. This planning correction does not pull any model or provider change forward.

GW1-P1 implemented only the backend half of the approved D1 evidence architecture: a separate Cloudflare Access-authenticated evidence Worker, private content-addressed R2 evidence, minimal D1 manifest/receipt/index state, independent canonical Stage 10 validation, idempotency and orphan reconciliation. The deterministic Teamsheet recommendation path remains independent. The browser was **not connected** to this service in GW1-P1; that connection is the GW1-P2 work described above.

The repository GW1-P1 record documents Pritesh's physical iPhone Safari functional production acceptance of the Access/D1/R2/ingest/idempotency/forced-failure/reconciliation paths using deliberately synthetic evidence. Do not generalise that acceptance beyond the recorded paths or claim new device testing without owner evidence.

The final preview/version-route audit found one security hardening gap: with `workers_dev` enabled, the evidence Wrangler configs relied on Cloudflare's implicit Preview URL behaviour. The GW1-P1 candidate now explicitly sets `preview_urls:false` in both byte-identical evidence configs and permanently tests that invariant. Repository configuration is never by itself proof of deployed Cloudflare route state. **Live route-state closure was recorded on 11 August 2026 at 19:22 BST from owner-supplied Cloudflare dashboard evidence**: the Workers & Pages Domains screen showed the production `teamsheet-evidence-archive.fpltsheet.workers.dev` route enabled and **Restricted** behind its Access policy, and the wildcard Preview hostname `*-teamsheet-evidence-archive.fpltsheet.workers.dev` disabled. That is owner-supplied dashboard evidence, not independent assistant dashboard or device testing.

Provider archival rights remain fail-closed: permanent Understat-derived retention is unresolved and Odds-derived permanent retention requires its approved governance position. GW1-P1 must not strip provider material from an already-canonical snapshot to make it archivable because that would change its hash. No provider acquisition, weighting, model, fixture, squad, captaincy, transfer, simulation, rank, Mini-League, UI or client-sync behaviour changes in this checkpoint.

That GW1-P1 closeout sequence is complete and PR #118 is merged. The GW1-P2 closeout sequence is: exact-final-head repository verification after every source/config/documentation change; the owner's Cloudflare Access OPTIONS-bypass configuration and non-destructive device storage evidence — **both recorded as performed**; then the outstanding physical iPhone Safari acceptance test against a genuine Stage 10 record under normal privacy settings. **PR #119 stays draft and unmerged until Pritesh completes that physical acceptance and explicitly approves it.**

## Historical — 11 August 2026 A3 engineering state entering documentation closeout

The A3 engineering baseline entering documentation/architecture closeout was GitHub `main` `1060e60d3affadabdf97924c7ece85cc62d8e360`, the merge of **A3-SC-1 Small Stale-Code Cleanup** PR #116 from reviewed head `097fabb6065afc4c322238985eb7f237a503a7c3`. The reviewed tree contains **868 tests, 868 passed, 0 failed, 0 skipped, 0 cancelled**. Permanent post-merge Verify Teamsheet run #194 / `31470879289` passed the repository gate on that exact merge commit, and GitHub Pages run #120 / `31470878300` succeeded for the same commit.

A3-SC-1 removed only the two proven-unreachable Mini-League helpers `renderLeagueChips()` and `rememberLeague()` plus stale test-side consumers, and added structural regressions. No physical iPhone testing was performed or claimed for PR #116. Its first CI failure demonstrated that future stale-code investigations must search production source, test source, shared harness/export lists, mocks/fixtures, runtime replacement mechanisms, generated bundle/deployable surfaces and DOM/event references. At that checkpoint, the brittle `selectMiniLeague` exact-source-string assertion remained separate deferred test-hardening debt. It was subsequently hardened in the pre-GW1 housekeeping closeout (PR #124) without changing production Mini-League behaviour.

Route-Aware Rendering and Performance M1 is complete and merged through PR #115. M1 delivered measurement instrumentation only. `scripts/measure-route-rendering.mjs` reads the generated bundle and runs an instrumented copy through the existing harness; it is deliberately outside every production build input. **Route-aware optimisation itself remains unapproved** — do not change route scheduling or rendering behaviour without separate explicit approval. See [Route-Aware Rendering and Performance](docs/ROUTE-AWARE-RENDERING-PERFORMANCE.md).

A3 engineering remediation is complete through PR #116. The documentation and architecture reconciliation was the final A3 closeout layer; no A3-specific engineering or documentation task follows it. See [Roadmap](docs/ROADMAP.md) and [Historical Records](docs/HISTORICAL_RECORDS.md).

## Historical checkpoint — 10 August 2026 A3 State-Ownership Cleanup is merged and accepted

A3 State-Ownership Cleanup is complete. PR #112 merged at `main` `691d9f929284d51c233b61d099c34cafe1030db6` from reviewed head `620daf14d1c354668b16df74daf05e29d8a1eb25`.

The checkpoint makes `src/state.mjs` the explicit inventory of legitimate cross-module `S` slots without turning it into the semantic owner of every value. `S.miniLeagues` remains the canonical writable Mini-League preference state and the legacy `S.leagues` alias is now a one-way read-only compatibility bridge. The package is deliberately narrow: no broad state-management rewrite and no model, provider, persistence-format, error-boundary, Atomic Foreground Refresh, routing-performance or bundler behaviour change.

Evidence: the merged tree contains **864 tests, 864 passed, 0 failed, 0 skipped, 0 cancelled**. Permanent Verify Teamsheet run #167 / `31430700053` passed every stage on exact merge commit `691d9f9…`, including committed provenance, the complete suite, production build, deterministic rebuild, root/deployable equality, exact build identity and production-output preservation. GitHub Pages deployment run #117 / `31430697347` also succeeded on that exact merge commit. No physical iPhone testing was performed for PR #112 and none is claimed. See [A3 State-Ownership Cleanup](docs/A3-STATE-OWNERSHIP-CLEANUP.md).

At that checkpoint the next substantive work was **Route-Aware Rendering and Performance**, to begin with investigation, measurement and evidence only. Its M1 measurement stage has since been implemented and merged through PR #115; route-aware optimisation remains unapproved.

## Historical checkpoint — 10 August 2026 A3 error-boundary separation (EB-1)

Package EB-1 is complete. PR #108 merged at `main` `ba5daa2000345ddde3d8e6f6d381d44603e7cd29` from reviewed head `13224f53d7df95a295ee5f69124e99eb64e7a9e9`.

EB-1 fixes failure **ownership** only. A recovery-render failure after a genuine Official FPL collection failure is recorded as a secondary `render_failed` beside the unchanged primary `collection_failed` instead of being swallowed by an empty catch. An unexpected exception escaping Understat, Odds or minute-history computation is application-owned `internal_error`: it still passes through the one shared `applyProviderResult()` gate so Rule B's retain/clear decision is unchanged, but it no longer manufactures Understat/Odds/FPL Provider Health. Startup, manual and foreground refreshes own an otherwise escaping exception at a narrow lifecycle boundary that begins before `captureRefreshInputs()`; no global `window.onerror` or `unhandledrejection` layer was added.

Evidence: the merged tree contains **856 tests, 856 passed, 0 failed, 0 skipped, 0 cancelled**. Permanent Verify Teamsheet run #154 / `31410817472` passed every stage on exact merge commit `ba5daa20…`, including committed provenance, the complete suite, production build, deterministic rebuild, root/deployable equality, exact build identity and production-output preservation.

Physical iPhone Safari acceptance passed the executable EB-1 paths on the exact PR #108 candidate: normal online startup, manual online refresh, in-app offline refresh retaining saved verified data, and return-online recovery. A clean Private Safari tab opened while already offline could not load the uncached GitHub Pages shell, so the no-core clean-offline application path remains automated-test evidence rather than a device failure. The acceptance session used an incomplete manual squad, so device evidence proves retained verified core data but not survival of a previously available recommendation. GitHub Pages was restored to `main` before merge. See [A3 error-boundary separation](docs/A3-ERROR-BOUNDARY-SEPARATION.md).

## 10 August 2026 — `fpl:calib` compatibility is merged

PR #107 is merged at `main` `d112c673310149a4463def1758242460450600dc`, over source/tests/docs commit `862eefc32b0edb070290ad9ce82d85b1123b0596`, generated-only child `69e539647ae687f49605633505e7147da76125e2` and documentation child `6ba905d`. Permanent Verify Teamsheet run #127 / `31396393124` passed every stage on the merge commit, on an 842-test baseline. The merged behaviour rejects every existing unverified `fpl:calib` record from active model state while preserving its bytes, uses standard uncalibrated projections, and keeps the Stage 7 walk-forward check diagnostic-only. No calibration values, raw model formula or production calibration methodology were added. PERSIST-4 is closed.

## 10 August 2026 — Post-A3 0C manual-squad dead-handler cleanup

Post-A3 Checkpoint 0 PR #105 is merged at `main` `dd74365256fe6d9338b720ffecf1913e48ac77eb`. Checkpoint 0A's new automatic push trigger was proven immediately: Verify Teamsheet run #110 / `31383479683` ran on the exact merge commit and passed every stage, on an 835-test baseline.

Pritesh explicitly approved the separate narrow **0C cleanup**. It removes only the two proven-unreachable per-button manual-squad listeners from `src/ui/views.mjs`, keeps the rendered `data-rm`/`data-add` hooks, keeps `src/ui/manual-squad-runtime.mjs` byte-unchanged as the sole validating interaction owner, and adds an ownership regression. One existing A3 test, `manual squad builder has no unchecked squad persistence path`, was re-pointed from the deleted code to the live runtime and made stricter on `views.mjs`; nothing was weakened, deleted or skipped. No football rule or model behaviour changes. See [Post-A3 0C cleanup](docs/POST-A3-0C-MANUAL-SQUAD-DEAD-HANDLER-CLEANUP.md).

## 10 August 2026 — A3 cache and persistence resilience is merged

PR #104 is merged at `main` `9b31f373a23d26c49f81c688a2ca6fde98086cbd`. Its reviewed head was `4e434b940e2bcb473374573db5da16f6a645d9eb`, over source/test commit `502a1f7ac0e0456743f3ddb0695433decf8976d1` and generated-only child `02216b8`, based on the former `main` `473cfdb3295d2b896a00c0aa7b1308814bf2e043`.

The checkpoint keeps Atomic Foreground Refresh ordering unchanged while adding a schema/season-bound main `fpl:cache`, verified user-owned saves, season-bound manual-squad and Mini-League preference records, and explicit session-only warnings when browser persistence fails. Independent review found and corrected one real defect: a failed authoritative storage-manager write could fall back to `localStorage` and be reported as a durable save even though no later read could return it. The Refresh-Load R1 supporting-cache cadence/compatibility rules and Stage 10 evidence stores are unchanged. Legacy `fpl:calib` remained deliberately untouched behind the separate model approval gate until PR #107.

Evidence: **832 passing tests, 0 failed**, verified committed build provenance, two byte-identical production builds, and permanent Verify Teamsheet run #105 / `31377157889` on the reviewed head `4e434b9`. Pritesh **explicitly waived physical iPhone testing** for this checkpoint and explicitly approved the merge. No physical device testing was performed, and none is claimed.

## 10 August 2026 — PR #103 physical acceptance closeout

The final Small Mobile UI Consistency + Loading Viewport Fix application source is `646eee13960c343fbe07e3a76496717fd9837c0e`, with generated-only child `81cc9130ac2c7b8206f3bd5f6a2cf85bb5ba0777`. The final candidate retains every prior test and passes **803 tests, 0 failed**, deterministic byte-identical builds, root/deployable equality, exact build identity and reachable generated provenance. Permanent Verify Teamsheet run #90 / `31356255017` passed on the exact generated head.

Physical iPhone Safari acceptance is complete: the startup canvas reaches Safari chrome without a light strip; Team, Transfers, Fixtures, Leagues and Settings use the accepted shared header hierarchy; the refined editable/selectable controls are visually proportionate while retaining the no-focus-zoom behaviour; and the Leagues primary box now aligns vertically with the other primary screens. Pritesh explicitly approved PR #103 for merge on 10 August 2026.

No projection, expected-minutes, scoring, fixture, captaincy, squad, transfer, rank, Mini-League/rival, provider, data-source, Atomic Foreground Refresh, navigation, Team-renderer or Player Detail behaviour changed.

## Historical — 11 August 2026 A3 closeout boundary

A3 engineering remediation is complete through PR #116. The A3 engineering baseline entering closeout was `1060e60d3affadabdf97924c7ece85cc62d8e360`. Post-A3 Checkpoint 0 (PR #105), the 0C manual-squad dead-handler cleanup (PR #106), `fpl:calib` compatibility (PR #107), EB-1 (PR #108), Production-Bundle Safeguards (PR #111), State-Ownership Cleanup (PR #112), Route-Aware M1 (PR #115) and A3-SC-1 (PR #116) are all merged. [PERSIST-4](docs/KNOWN_LIMITATIONS.md) is closed.

At the time of the A3 closeout record, Data Architecture D1 had only the original design approval. **A later separately approved GW1-P1 checkpoint authorised the backend evidence foundation now implemented in PR #118.** That later approval does not reopen A3 and does not authorise GW1-P2 browser integration, Understat/Odds repair, route-aware optimisation, ChatGPT migration, agent work or live-season model changes.

## Historical — 9 August 2026 reconciliation

The authoritative baseline at that historical checkpoint was `main` `6e725485564a51ee2a17bc08e5c8bf95e8c2778c`, merge of iPhone form-focus zoom PR #100. Its permanent verification passed **693 tests**. DTR-1 and the physical iPhone form-focus zoom checkpoint are complete and merged.

[Data Architecture D1](docs/DATA-ARCHITECTURE-D1.md) was approved then as a documentation-only design decision: Cloudflare D1 for structured records, private R2 for exact immutable evidence, a separate authenticated data Worker, local browser fallback/outbox, and optional downstream Google Sheets reporting. No persistence implementation was approved **by that 9 August checkpoint**. GW1-P1 was approved later as a separate backend-only implementation checkpoint.

**Atomic Foreground Refresh** is complete, physically accepted and merged through PR #102, after five design rounds (R2, R3, R3.1, R3.2, R3.3, R3.4) and the PR #102 correctness review. See [Atomic Foreground Refresh](docs/ATOMIC-FOREGROUND-REFRESH.md).

Read this first. GitHub `main` plus the live state of the active pull request are the permanent source of truth; repository evidence overrides conversations, old uploads and generated deployables. Last reconciled: 20 August 2026.

## Current baseline

| Item | Current evidence |
|---|---|
| Latest merged `main` | Read it live: `git rev-parse origin/main`. Deliberately not restated here — see the note at the top of this file. |
| Repository test baseline | **934 tests, 934 passed, 0 failed, 0 skipped, 0 cancelled**, with deterministic byte-identical builds, root/deployable equality, exact build identity and verified committed build provenance |
| Most recent application checkpoint | GW1 readiness — pre-deadline Transfers safety guard, delivered on PR #121 from `agent/gw1-readiness-safety-guard`. Physically accepted by Pritesh on iPhone Safari at head `f72023043813566fe8b11da2d959e374d34bca39`, Verify Teamsheet #262 / `31583716004` passing 898/898 — the then-current count for that application head, before this PR's documentation-integrity additions. See [GW1 readiness safety guard](docs/GW1-READINESS-SAFETY-GUARD.md) |
| GW1 readiness verdict | Audit found **0 blockers** and two should-fix items; PR #121 addressed both. The application is suitable for GW1 subject only to the separate live-only gates in this table |
| Unmerged application candidate | GW1-P2 — Browser evidence delivery and durable outbox, draft PR #119, branch `claude/gw1-p2-evidence-delivery-design-ejsb0d`, head `414eb58f6207b3e2a78515a93d0c4c98685b3863`. Its own 955/955 candidate verification is separate historical evidence for that head and is not the repository baseline. Not accepted, not merged, **not a GW1 blocker** |
| Unmerged diagnostic candidate | GW1-P2D-P1 — Diagnostic transport probe, branch `claude/gw1-p2d-diagnostic-probe-22czjn`. Diagnostic instrumentation only; pending the owner's physical iPhone test. See [GW1-P2D-P1 Diagnostic transport probe](docs/GW1-P2D-DIAGNOSTIC-TRANSPORT-PROBE.md) |
| Pre-deadline evidence fallback | Until PR #119 is accepted and merged, local Stage 10 capture, recovery and owner-controlled export remain the operating path. That fallback is complete and merged |
| GW1-P2 implementation boundary | Pure outbox state machine; browser delivery service; bounded retries and single-flight; content-hash idempotency; pending-record persistence across restart; fail-closed provider retention; minimal Settings → Evidence status/action; CSP/meta wiring; exact-origin credentialled CORS. |
| GW1-P1 functional production acceptance | Repository record documents Pritesh's physical iPhone Safari acceptance of Access, D1/R2, positive ingest/read-back, duplicate handling, forced R2 failure, forced D1-after-R2 failure and orphan reconciliation. |
| GW1-P1 security state | Repository config explicitly disables Cloudflare Preview URLs and tests that invariant. Owner-supplied live Cloudflare Domains evidence on 11 August 2026 showed production Access-`Restricted` and the wildcard Preview hostname disabled. It is owner dashboard evidence, not independent assistant testing. |
| GW1-P2 completed preparation | Cloudflare Access `Bypass OPTIONS requests to origin` enabled and saved with no Access-layer allowed-origin response; top-level iPhone Safari Access sign-in; protected `GET /v1/health`; expected pre-window Evidence state; non-destructive storage telemetry; Pages branch switch and restoration. |
| GW1-P2 acceptance outcome | **Failed** on 20 August 2026 on a real iPhone with Prevent Cross-Site Tracking ON: `Waiting to archive` never became `Archived`. The cause remains unisolated and must not be attributed to Safari, ITP, Access, CORS, the Worker or scheduling. |
| GW1-P2 unresolved limitation | The bounded outbox `pinLimit` stays at 4. The usable iPhone storage ceiling is not evidenced and must not be claimed as proven. |
| Final repository gate | The final exact PR head must pass Verify Teamsheet after all config/doc changes. Earlier green runs are historical once the head changes. |
| GW1-P2 merge gate | PR #119 must stay draft and must not merge until Pritesh performs the physical acceptance test and explicitly approves it. |
| External intelligence planning | [External Intelligence Foundation](docs/EXTERNAL-INTELLIGENCE-FOUNDATION.md) — documentation only. Provider-neutral contract, hard `shadow_only` boundary, dated free-source research, double-counting controls and a pre-registered ablation method. Approves no provider, retention, model or calculation change |
| Immediate operating state | Pre-GW1 code freeze and operational rehearsal. Not post-GW1 model or provider work. |
| Deferred live-season acceptance | Published League rank/movement, populated standings and gaps, nearby/pairwise rivals, selected-rival squad/captain/vice/chip exposure, stale/incomplete rival handling and relevant large-league pagination |

[Leagues pre-season acceptance](docs/LEAGUES-PRESEASON-ACCEPTANCE.md) is authoritative for what was accepted and what remains deferred. The deferred checks are not defects while Official FPL has not published the required post-Gameweek facts.

## Current approval boundary

Repository Truth A1, Safe Hygiene A2, Refresh-Load R1, A3/A3-R0, DTR-1, Atomic Foreground Refresh, A3 cache/persistence, `fpl:calib` compatibility, EB-1, Production-Bundle Safeguards, State-Ownership Cleanup, Route-Aware M1 and A3-SC-1 are complete and merged. A3 closeout is complete. GW1-P1 is merged through PR #118 at `58b834a…`, and the GW1 readiness safety guard is delivered and physically accepted on PR #121.

GW1 readiness remediation is complete: the audit found no blockers, and its two should-fix items are addressed. It authorised **no** model, provider, fixture, expected-minutes, scoring, squad, captaincy, transfer, optimiser, simulation, rank or Mini-League change, and none was made.

**GW1-P2D-P1 is approved only as diagnostic instrumentation**, within the boundary recorded in [GW1-P2D-P1 Diagnostic transport probe](docs/GW1-P2D-DIAGNOSTIC-TRANSPORT-PROBE.md). It authorises no transport fix, no Worker redeployment, no Access or hosting change and no replacement architecture.

**GW1-P2 is approved only within the boundary recorded in [GW1-P2 Browser evidence delivery](docs/GW1-P2-BROWSER-EVIDENCE-DELIVERY.md)**, with the open acceptance gate and the unresolved retention limitation named above. Nothing beyond that boundary is approved: no Option B delivery window, no hosting change, no broader D1 schema expansion, no scheduled collection, no Sheets automation, no provider repair and no model work.

The [External Intelligence Foundation](docs/EXTERNAL-INTELLIGENCE-FOUNDATION.md) record is approved as **documentation and research only**. Recording a source in its research matrix is not approval to acquire, integrate, retain or weight it; recording a future sequence is not approval to start it. `APPROVED_PROVIDER_NAMES` remains exactly `fpl`, `understat`, `odds`, `archive`, and a permanent test pins that. Every item in that record's post-GW1 sequence — including the shadow foundation itself — needs its own evidence-led proposal and explicit approval before any code is written.

The approved GW1-P1 evidence flow is:

`canonical Stage10 record -> validate/recanonicalise -> canonical SHA-256 -> private R2 create/verify -> D1 manifest/receipt -> ACK only after D1 commit`

D1 must never point to an R2 object that does not exist. If R2 succeeds and D1 fails, return no ACK; the R2 object is an invisible orphan. Reconciliation may recover it later only after the same canonical/body/metadata checks, preserving the original R2 upload time and never fabricating earlier custody. Duplicate ingestion must be idempotent.

Permanent provider retention remains fail-closed. Understat rights remain unresolved; Odds retention requires the separately approved governance position. Do not alter provider acquisition/weighting or silently strip canonical provider material. Google Sheets remains downstream reporting only.

The first completed and officially `data_checked` Gameweek remains an evidence gate for real minute history, Stage 10 outcomes and populated Leagues behaviour. Those gates do not authorise model changes.

## Owner and communication

Pritesh is a non-developer but rigorous reviewer who primarily works from an iPhone. Lead with the outcome, then evidence, risks and recommendation. Distinguish fact, inference, proposal and limitation. Never claim success, accuracy, deployment or physical-device acceptance without evidence.

## Read in this order

1. [Project Context](docs/PROJECT_CONTEXT.md)
2. [Architecture](docs/ARCHITECTURE.md)
3. [Decisions](docs/DECISIONS.md)
4. [Roadmap](docs/ROADMAP.md)
5. [Known Limitations](docs/KNOWN_LIMITATIONS.md)
6. [Teamsheet 2.0 Product Blueprint](docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md)
7. [Data Architecture D1](docs/DATA-ARCHITECTURE-D1.md)
8. [GW1-P1 Cloudflare Evidence Foundation](docs/GW1-P1-CLOUDFLARE-EVIDENCE-FOUNDATION.md), [GW1-P2 Browser evidence delivery](docs/GW1-P2-BROWSER-EVIDENCE-DELIVERY.md) and [GW1-P2D-P1 Diagnostic transport probe](docs/GW1-P2D-DIAGNOSTIC-TRANSPORT-PROBE.md)
9. Before provider or security work: [Data Sources](docs/DATA_SOURCES.md) and [Security](docs/SECURITY.md)
10. Before model, projection, fixture, squad, captaincy, optimisation, rank or Mini-League calculation work: [Projection Model](docs/PROJECTION_MODEL.md) and [Testing](docs/TESTING.md)
11. Before any new external-data, provider-evaluation, shadow-evidence or ablation proposal: [External Intelligence Foundation](docs/EXTERNAL-INTELLIGENCE-FOUNDATION.md)
12. Historical A3 records only when needed: [A3-SC-1 Small Stale-Code Cleanup](docs/A3-SC-1-SMALL-STALE-CODE-CLEANUP.md), [Route-Aware Rendering and Performance](docs/ROUTE-AWARE-RENDERING-PERFORMANCE.md), [A3 State-Ownership Cleanup](docs/A3-STATE-OWNERSHIP-CLEANUP.md), [A3 error-boundary separation](docs/A3-ERROR-BOUNDARY-SEPARATION.md) and [Historical Records](docs/HISTORICAL_RECORDS.md)

## What Teamsheet is

Teamsheet is a team-first, decision-first FPL application for the manager's complete 15-player squad. The primary destinations are Team, Transfers, Fixtures, Leagues and Settings. Player research lives under Settings; Ask Teamsheet has a separate route but hosted AI remains disabled. Teamsheet is advisory and performs no FPL account write.

The app currently provides:

- a best XI, captain, vice-captain and bench order;
- exact legal zero-to-three-transfer comparisons with a mandatory no-transfer baseline, suppressed in favour of an explicit unlimited-changes notice before the first Official FPL deadline of a season;
- fixture-run and swing-window planning through GW38;
- an all-league hub, selected-league detail, targeted standings and explicitly loaded rival comparisons;
- settings, provider health, evidence, outcomes, descriptive metrics, review and deterministic exports.

It does not yet provide a validated projected-rank model, protect/balanced/chase strategy, cited team-news intelligence, automated Google Sheets sync or prospectively proven model accuracy. Merged GW1-P1 adds a server-side evidence destination but does **not** give the normal Teamsheet browser automatic cloud custody. GW1-P2 implements that custody, but it is unmerged and acceptance-incomplete, so the app has no automatic cloud custody and local Stage 10 capture/export remains the pre-deadline evidence path.

## Non-negotiable engineering rules

- Never change projection, expected-minutes, scoring, fixture, captaincy, squad, simulation, transfer, rank, Mini-League or strategy logic without first presenting existing and proposed behaviour, inputs, fallbacks, assumptions, limitations, trade-offs and validating evidence, then receiving explicit approval.
- Never add a provider or data source without an approved purpose, field contract, reliability assessment, validation/ablation plan, fallback, security/privacy review, cost and tests.
- Never delete, weaken or skip a test to make a change pass.
- Never claim improved prediction accuracy without genuine out-of-sample validation. The historical aggregate r=0.80 is method-flattered.
- Transfer pruning must remain admissible, and `exhaustiveTransferSearch()` must remain independent of production pruning.
- Preserve deterministic builds, exact reachable `BUILD_COMMIT` identity, complete build-input identity, root/deployable equality and generated-file provenance.
- Preserve Vanilla JavaScript ES modules, the zero-dependency toolchain, Node built-in tests, the custom bundler, GitHub Pages and the single-file deployment unless separately approved.
- Generated `dist/` and root `index.html` files come only from `build.mjs`; never hand-edit them.
- Anthropic keys remain banned client-side. Odds requests remain direct-only and the key must never be relayed, logged, rendered or exposed in diagnostics.
- Understat remains team-level only. Optional-provider failure must degrade gracefully.
- Supporting caches contain only validated model inputs: no Understat HTML and no Odds key or keyed URL.
- Preserve mobile-first iPhone usability and the accepted physical behaviours touched by a future change.
- For the evidence archive specifically, R2 remains private, the evidence Worker exposes no generic SQL/R2 browser access, Access errors stay generic, sensitive auth/account/provider-key material is never logged/stored, and backend availability must never become a recommendation dependency. GW1-P2's client adds no permanent browser service token and persists no secret, cookie, team domain, policy audience or account identifier.

## Current security and data boundaries

- Official FPL reads use the owner-controlled, allowlisted Cloudflare gateway and still pass client validators.
- GW1-P1 uses a **separate** Access-authenticated evidence Worker backed by private R2 and D1. On merged `main` the browser does not call it; the unmerged GW1-P2 candidate adds an exact-origin credentialled call as a one-way side effect. No wildcard `Access-Control-Allow-Origin` exists anywhere.
- Every non-preflight evidence route requires the Worker's own validation of `Cf-Access-Jwt-Assertion`; `TEAM_DOMAIN` and `POLICY_AUD` are runtime configuration and must not be printed or hard-coded.
- Evidence Wrangler config keeps the accepted production `workers.dev` route enabled and explicitly disables `preview_urls`. Live route-state confirmation is always required separately after deployment; for the current candidate it is recorded from owner-supplied 11 August 2026 Cloudflare Domains dashboard evidence.
- Provider and user strings use DOM builders; AI output uses restricted Markdown.
- The Odds key is masked, direct-only, forgettable and scrubbed from diagnostics.
- The generated single script and style are SHA-256 locked by CSP.
- Runtime style APIs and style attributes are forbidden.
- Stage 10 evidence is allowlisted, hash-verified and recovery-oriented; exports are complete, unencrypted and owner controlled.
- League and manager identifiers stay out of routes, page titles, provider diagnostics and Stage 10 evidence.
- Permanent Understat/Odds server retention is fail-closed until separately approved.

## Workflow

1. Inspect latest `main` and the live active PR; read this file first.
2. State the exact baseline, scope, exclusions, risks and approval gate.
3. Obtain explicit approval where required.
4. Create a separate branch; never push directly to `main`.
5. Implement only the approved scope.
6. Add or update tests without weakening existing protection.
7. Run `./run-tests.sh` and the production build.
8. Verify two exact-identity builds, root/deployable equality and manifest identity where relevant.
9. Update affected canonical documentation.
10. Open/update a draft pull request with evidence and exclusions.
11. Where security depends on live Cloudflare route/dashboard state, obtain that evidence explicitly; repository config alone is insufficient.
12. Move a draft PR to ready only when every gate is satisfied.
13. Merge only after explicit owner approval, then verify `main`.

## Completion report for every implementation item

Report the exact changes, deliberate exclusions, test count and result, deterministic-build evidence, root/deployable result, documentation updates, judgement calls, remaining limitations, physical-device/live-infrastructure evidence actually performed, branch, commit and pull-request link/state.
