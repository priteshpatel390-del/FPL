# Historical Records Index

Purpose: make the repository's operational guidance and immutable project history easy to distinguish without deleting, moving or rewriting historical evidence. Last reconciled: 12 August 2026.

Historical records legitimately state the commit SHAs, test counts and merge states that were true at their own checkpoint. Those values are permanent evidence and must not be rewritten to match today. Current status lives only in [Project Context](PROJECT_CONTEXT.md), [Roadmap](ROADMAP.md) and `CLAUDE.md`.

## How to use this index

- Start with the operational spine below for current work.
- Use checkpoint and acceptance records when a later change touches behaviour they protect.
- Treat stage/design/implementation records as evidence of what was approved and true at that time, not as the current roadmap.
- Where historical wording conflicts with current status, [Project Context](PROJECT_CONTEXT.md) and [Roadmap](ROADMAP.md) control current operations. Historical facts remain valuable and should not be silently rewritten.

## Operational spine — current guidance

- [Project Context](PROJECT_CONTEXT.md) — current product, technical and approval state.
- [Architecture](ARCHITECTURE.md) — current system map and ownership.
- [Decisions](DECISIONS.md) — permanent approved decision log.
- [Roadmap](ROADMAP.md) — current, proposed and deferred checkpoints.
- [Known Limitations](KNOWN_LIMITATIONS.md) — current constraints and deferred evidence.
- [Teamsheet 2.0 Product Blueprint](TEAMSHEET2-PRODUCT-BLUEPRINT.md) — approved product direction.
- [Testing](TESTING.md) — current verification architecture and permanent rules.
- [Projection Model](PROJECTION_MODEL.md) — current calculation contracts and evidence gates.
- [Data Sources](DATA_SOURCES.md) — current external-source and endpoint boundaries.
- [Security](SECURITY.md) — current security and trust boundaries.
- [Changelog](CHANGELOG.md) — chronological/high-level change record; detailed evidence remains in the records below.
- [Root onboarding](../CLAUDE.md) and [Build & Test](../README-BUILD.md).
- [Cloudflare Worker operations](../workers/README.md).

## A3 remediation closeout index

A3 engineering remediation is complete through A3-SC-1 / PR #116. The documentation/architecture reconciliation represented by this index is the final A3 closeout layer; no A3-specific engineering or documentation task follows it. The repository's canonical sequence treats the separate 0C correction as a narrow follow-up to Checkpoint 0 rather than renumbering every later item.

1. Post-A3 Checkpoint 0 housekeeping — complete through PR #105; separate 0C manual-squad dead-handler cleanup complete through PR #106.
2. `fpl:calib` compatibility and resilience — complete through PR #107.
3. A3 Error-Boundary Separation — complete through PR #108.
4. Production-Bundle Safeguards — complete through PR #111.
5. State-Ownership Cleanup — complete through PR #112.
6. Route-Aware Rendering & Performance M1 — measurement-only work complete through PR #115; route-aware optimisation remains unapproved.
7. A3 Small Stale-Code Cleanup — complete through PR #116.
8. Documentation/architecture closeout — this reconciliation; final A3 closeout layer.

Separately tracked live-season evidence gates, D1 implementation, Understat repair, Odds API repair, ChatGPT migration, Cloudflare/agent expansion and route-aware optimisation are not unfinished A3 engineering remediation or closeout work.

## Current operational and acceptance records

- [External Intelligence Foundation](EXTERNAL-INTELLIGENCE-FOUNDATION.md) — the research and shadow-architecture record for future external football information. It maps the current production model/data ownership, separates structural strength, recent performance, market expectation, availability/expected minutes, calendar/workload, transfer economics and competitive strategy, defines a provider-neutral observation contract with first-class timing and rights/retention classification, requires a hard `shadow_only` boundary with no path from shadow storage into projection or recommendation, records dated free-source research and double-counting controls, pre-registers the ablation method, and sets the pre-GW1 operational-only actions and the proposal-only post-GW1 sequence. **Documentation only: it approves no provider, endpoint, retention, model or calculation change, and its external pricing/terms/coverage research must be re-verified from first-party sources before any future implementation approval.**
- [GW1 readiness safety guard](GW1-READINESS-SAFETY-GUARD.md) — the narrow implementation checkpoint after the GW1 readiness audit's *go with conditions* outcome (zero blockers, two should-fix items, both addressed). Before the first Official FPL deadline of a season the Transfers screen suppresses the weekly free-transfer/hit optimiser and states that initial squad changes are unlimited; the rule is derived from verified Official FPL event data, normal weekly behaviour resumes at the deadline instant, and no optimiser mathematics changes. Delivered on PR #121 and physically accepted by Pritesh on iPhone Safari at head `f720230…` (Verify Teamsheet #262 / `31583716004`, then-current 898/898). It also carries the surgical operator and current-status documentation corrections and the canonical pre-merge documentation reconciliation.
- [GW1-P2D-P1 Diagnostic transport probe](GW1-P2D-DIAGNOSTIC-TRANSPORT-PROBE.md) — diagnostic instrumentation only, added after the 20 August 2026 Option A physical acceptance failure to isolate which transport stage failed. One owner-initiated signed-in check and one sign-in-free control check post a deliberately invalid non-evidence payload to the already-deployed archive ingestion route, expecting a controlled `422 envelope_schema`. It creates no evidence custody, persists nothing and changes no Worker. Unmerged and pending the owner's physical iPhone test; no root cause is proven by implementation alone.
- [GW1-P2 Browser evidence delivery and durable outbox](GW1-P2-BROWSER-EVIDENCE-DELIVERY.md) — connects the existing Stage 10 browser capture path to the GW1-P1 archive through a durable local outbox, a transport-independent delivery state machine, content-hash idempotency and fail-closed provider retention. The direct credentialled cross-origin transport is approved as a feasibility implementation only. Owner-performed preparation has recorded the live Cloudflare Access OPTIONS-bypass configuration, top-level Safari Access sign-in and protected `/v1/health`; the decisive physical iPhone Safari acceptance of the credentialled cross-site background upload under normal privacy settings remains outstanding, and the bounded outbox `pinLimit` of four remains a conservative policy rather than a measured device ceiling.
- [GW1-P1 Cloudflare Evidence Foundation](GW1-P1-CLOUDFLARE-EVIDENCE-FOUNDATION.md) — approved backend-only predeadline evidence-custody foundation: separate authenticated Worker, private R2-first archive, minimal D1 manifest/receipt layer, fail-closed optional-provider retention gates and recovery/reconciliation contract; live backend deployment acceptance passed on 11 August 2026, and the checkpoint is complete and merged through PR #118 at `main` `58b834a1824c4977a442e7b3e309e2bbf3d05da1`. Teamsheet client integration is the separate GW1-P2 checkpoint recorded above.
- [A3-SC-1 Small Stale-Code Cleanup](A3-SC-1-SMALL-STALE-CODE-CLEANUP.md) — complete, merged and post-merge verified through PR #116 at A3 engineering baseline `1060e60d3affadabdf97924c7ece85cc62d8e360`; candidate-era CI evidence is preserved in the record and the brittle `selectMiniLeague` exact-source-string assertion remains separate deferred test-hardening debt.
- [Route-Aware Rendering and Performance](ROUTE-AWARE-RENDERING-PERFORMANCE.md) — M1 measurement tooling is complete and merged through PR #115; investigation found real avoidable inactive-route/shared-render work but did not demonstrate material user-visible lag. Route-aware optimisation remains separately approval-gated, with future recheck triggers around live-season Mini-League load, material rendering/workload changes and physical iPhone symptoms.
- [A3 State-Ownership Cleanup](A3-STATE-OWNERSHIP-CLEANUP.md) — completed, merged and post-merge verified through PR #112 at `main` `691d9f929284d51c233b61d099c34cafe1030db6`; `state.mjs` is the declared shared-slot inventory and the legacy Mini-League alias is one-way, without a state-management rewrite.
- [A3 error-boundary separation](A3-ERROR-BOUNDARY-SEPARATION.md) — complete, merged and post-merge verified through PR #108; provider evidence, commit, render, persistence and application-owned exceptions are separated without changing provider or model behaviour, with the recorded executable iPhone paths physically accepted.
- [`fpl:calib` compatibility and resilience](FPL-CALIB-COMPATIBILITY-RESILIENCE.md) — complete and merged through PR #107; legacy/unverified calibration remains inert and standard uncalibrated projections stay active unless a future production methodology is separately approved.
- [Post-A3 0C manual-squad dead-handler cleanup](POST-A3-0C-MANUAL-SQUAD-DEAD-HANDLER-CLEANUP.md) — complete and merged through PR #106; the proven-unreachable per-button listeners are removed and the validating capture-phase runtime remains the sole interaction owner.
- [Post-A3 Checkpoint 0](POST-A3-CHECKPOINT-0-HOUSEKEEPING.md) — automatic `main` verification, post-merge documentation reconciliation and the duplicate manual-squad handler investigation; merged through PR #105, with the 0C correction approved and implemented separately.
- [A3 cache and persistence resilience](A3-CACHE-PERSISTENCE-RESILIENCE.md) — browser-side cache/persistence compatibility, verified user-owned writes and session-only persistence warnings; merged through PR #104.
- [Data Architecture D1](DATA-ARCHITECTURE-D1.md) — approved historical/live persistence design. Its backend evidence-custody half is implemented and merged as GW1-P1 through PR #118; browser delivery is the unmerged GW1-P2 candidate, and the remaining structured-record and downstream-reporting scope stays deferred.
- [DTR-1 direct Team renderer](DTR-1-DIRECT-TEAM-RENDERER.md) — complete, physically accepted and merged through PR #99; the accepted Team DOM is now created directly rather than rendered then reconstructed.
- [Atomic Foreground Refresh](ATOMIC-FOREGROUND-REFRESH.md) — complete, physically accepted and merged through PR #102; foreground collection is staged and applied through one synchronous commit with rollback protection.
- [Leagues pre-season acceptance](LEAGUES-PRESEASON-ACCEPTANCE.md) — authoritative accepted/deferred League boundary as of 8 August 2026.
- [Leagues hub design](LEAGUES-HUB-DESIGN.md) — accepted hub-first and Official-versus-manual management design.
- [Fixtures acceptance merge record](FIXTURES-ACCEPTANCE-MERGE-RECORD.md) — accepted populated Fixtures path through GW38.
- [Team UX T-01/T-02 merge record](TEAM-UX-T01-T02-MERGE-RECORD.md) — accepted populated Team follow-up.
- [UX-A1 merge record](UX-A1-MERGE-RECORD.md) — Team resources and bench clarity acceptance.
- [UX-A2 acceptance](UX-A2-ACCEPTANCE.md), [UX-A2 merge record](UX-A2-MERGE-RECORD.md) and [UX-A2 dock-layering follow-up](UX-A2-DOCK-LAYERING-FOLLOW-UP.md) — Player Detail physical evidence.
- [VoiceOver decision](VOICEOVER-DECISION.md) — VoiceOver is not a project acceptance gate.
- [Stage 10 operations](STAGE10-OPERATIONS.md) — live evidence/export operating procedure.
- [Transfer optimiser test matrix](TRANSFER-OPTIMISER-TEST-MATRIX.md) — permanent optimiser evidence map.
- [FPL gateway design](FPL-GATEWAY-DESIGN.md) — approved owner-controlled transport boundary.

## Project-wide history and audits

- [Initial audit](AUDIT.md).
- [Stage history](STAGE_HISTORY.md).
- [Change log](CHANGELOG.md).
- [Stage 6 branch note](ROADMAP-STAGE6-BRANCH-NOTE.md).

## Stage 1–8 records

- [Stage 1](STAGE1.md).
- [Stage 2](STAGE2.md).
- [Stage 3 design](STAGE3-DESIGN.md).
- [Stage 3 item 4](STAGE3-ITEM4.md).
- [Stage 3 item 5](STAGE3-ITEM5.md).
- [Stage 3 item 6](STAGE3-ITEM6.md).
- [Stage 3 security completion](STAGE3-SECURITY-COMPLETION.md).
- [Stage 4 design](STAGE4-DESIGN.md).
- [Stage 5 design](STAGE5-DESIGN.md).
- [Stage 5 verification](STAGE5-VERIFICATION.md).
- [Stage 6 approval](STAGE6-APPROVAL.md).
- [Stage 6 design](STAGE6-DESIGN.md).
- [Stage 6 implementation notes](STAGE6-IMPLEMENTATION-NOTES.md).
- [Stage 7 design](STAGE7-DESIGN.md).
- [Stage 8 design](STAGE8-DESIGN.md).

## Stage 9 records

- [Stage 9 design](STAGE9-DESIGN.md).
- [Stage 9.4 scope](STAGE9-4-SCOPE.md).
- [Stage 9.5 scope](STAGE9-5-SCOPE.md).
- [Stage 9.6 scope](STAGE9-6-SCOPE.md).

## Stage 10 records

- [Stage 10 design](STAGE10-DESIGN.md).
- [Stage 10 item 1](STAGE10-ITEM1.md).
- [Stage 10 item 2](STAGE10-ITEM2.md).
- [Stage 10 item 3](STAGE10-ITEM3.md).
- [Stage 10 item 4](STAGE10-ITEM4.md).
- [Stage 10 item 5](STAGE10-ITEM5.md).

## Teamsheet 2.0 checkpoint records

- [Teamsheet 2.0 item 1](TEAMSHEET2-ITEM1.md) and [iPhone review](TEAMSHEET2-ITEM1-IPHONE-REVIEW.md).
- [Teamsheet 2.0 item 2](TEAMSHEET2-ITEM2.md).
- [Teamsheet 2.0 item 3](TEAMSHEET2-ITEM3.md).
- [Teamsheet 2.0 item 4](TEAMSHEET2-ITEM4.md).
- [Teamsheet 2.0 item 5](TEAMSHEET2-ITEM5.md).
- [Teamsheet 2.0 item 6](TEAMSHEET2-ITEM6.md).
- [Teamsheet 2.0 item 7](TEAMSHEET2-ITEM7.md).
- [Manual fallback investigation](TEAMSHEET2-MANUAL-FALLBACK-INVESTIGATION.md).

## Later feature, correction and follow-up records

- [FPL-T1 manual-squad crash record](FPL-T1-MANUAL-SQUAD-CRASH.md).
- [Transfers exact performance record](TRANSFERS-EXACT-PERFORMANCE.md).
- [Team T-01/T-02 implementation](TEAM-UX-T01-T02-IMPLEMENTATION.md).
- [Team unavailable-wrap follow-up](TEAM-UX-T02-UNAVAILABLE-WRAP-FOLLOW-UP.md).
- [Fixtures mobile-scroll follow-up](FIXTURES-MOBILE-SCROLL-FOLLOW-UP.md).
- [UX-A2 scope](UX-A2-SCOPE.md).

No historical file is archived by location in this checkpoint. “Historical” is a reading classification only; Git history and every listed record remain intact.