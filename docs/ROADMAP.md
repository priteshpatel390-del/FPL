# ROADMAP.md — current and proposed checkpoints

## Decision Intelligence — DI-1 review candidate

DI-1 implements the generic shadow contract approved by DI-0: deterministic observations, canonical identity/timing/provenance, fail-closed rights, signal registry, approval ledger and hard shadow repository boundary. It registers and activates no real source, contains no production approval/read path, and changes no recommendation, provider, DATA-S2B/D1/Cloudflare, Stage 10 or UI behaviour. After owner review, merge remains an explicit gate. The next proposed checkpoint is DI-2 automated evaluation and ablation, separately approved and still shadow-only.

<!-- DATA-S2B-READ-BUDGET-REMEDIATION-2026-09-05 -->
## Current DATA-S2B gate — read-budget remediation P2+ (repository only)

**The permanent cadence produced a natural run, and it failed on resource enforcement.** Run
`33948145320`, event `schedule`, attempt 1, head `main` `9a1c6a87e17de08ed2c5b650b05cdc3eab96291c`.
GitHub created it at `2026-09-05T05:48:05Z` against a 01:17 UTC nominal minute — approximately
**4h31m** of schedule-event delivery delay, upstream of the workflow, with no proven cause, and
never a collection delay. `repository-gate` succeeded; `collect` failed with
`production_d1_budget_exceeded` in phase `postflight_read`, carrying
`productionMutation: 'definite_completed'` and `productionRetryable: false`. The commit therefore
**completed**, the postflight D1 read **was issued and returned**, and resource enforcement then
failed on its returned accounting before `validateProductionPostflight()` could validate the
returned state. The postflight read ran; postflight validation did not. **The state that run left in
production D1 is therefore unproven — which is not evidence that it is invalid or corrupt**. The owner then disabled the scheduled workflow; it **remains disabled** and this
checkpoint does not re-enable it.

**The read model is proven defective.** The preceding successful run `33901634593` measured
**124,430** actual `rowsRead` against a **94,844** structural estimate — a 29,586-row delta, about
31.19%, finishing 570 rows below the 125,000 ceiling. The exact attribution of that delta is only
partly known and is deliberately not invented.

This checkpoint is **repository implementation only**: nothing was executed against Cloudflare. It
corrects the pre-mutation read projection, adds an explicit mutation-read estimator and a
conservative INFERRED provider amplification and reserve, separates the predictive soft gate from
the hard circuit breaker, adds bounded sanitized per-call resource telemetry, re-plans current-head
retrieval from O(H) to O(N) with an identical row set and a strictly stronger EXPLAIN contract, and
adds a strictly read-only committed-run integrity workflow that **has not been dispatched**.

**Reported honestly: Stage 3 alone does not restore collection capability.** The re-plan saves only
`3(H − N) = 1,446` structural rows at the current population; its value is removing the term that
grows without bound. Applying the corrected projection to the population run `33948145320` left
behind exceeds 125,000, so under those population and change assumptions the soft gate would refuse
before mutation with `mutation = none` rather than commit and then fail. The exact outcome of any
future execution is not claimed — it depends on that cycle's own population, changed-observation
count and rows already billed before the gate — but if the next cycle presents a comparable or
higher projected workload, the soft gate will refuse before mutation. That is a safety improvement,
not a recovery. Per the stop condition, no
ceiling was raised, **no migration 0004 was created** and no covering index was added.

Next gates, each separate and owner-approved: merge and exact-`main` Verify; then one dispatch of
the committed-run integrity workflow; then, only on that evidence plus a decision about whether a
schema change is warranted, any question of collection or scheduler re-enable. See
[read-budget remediation](../workers/data-platform/DATA-S2B-READ-BUDGET-REMEDIATION.md).

<!-- DATA-S2B-GITHUB-ACTIONS-DAILY-SCHEDULE-2026-09-04 -->
## Current DATA-S2B gate — natural schedule accepted; permanent cadence restored

**The first natural scheduled production run has succeeded.** Run `33901634593`, event `schedule`,
attempt 1, head branch `main`, head SHA `dac27b3860428bc55c6d505e8a817a207d30f904`, with
`repository-gate` and `collect` both successful, and no `workflow_dispatch` used. It closed the
temporary acceptance windows, so this checkpoint restores the permanent cadence `17 1 * * *`
(01:17 UTC). GitHub created that run at 17:38:15Z against a 14:17 UTC nominal minute — an observed
schedule-event **delivery** delay of approximately 3h21m, upstream of the workflow and with no
proven cause; the run itself then completed in about 43 seconds. GitHub Actions is the approved
scheduler and Cloudflare Cron stays superseded and absent.

**Merging this restoration changes the live production schedule** from 14:17 UTC back to 01:17 UTC.
It is not operationally complete at merge: the next live gate was the **first genuine natural run
produced by `17 1 * * *`**, judged on event `schedule`, exact then-current `main`, and
`repository-gate` and `collect` success. **That gate is closed and it did not pass.** Run
`33948145320` was that natural run: the gate and the commit succeeded, resource enforcement then
failed at `postflight_read`, and the scheduler is now owner-disabled. See the checkpoint above.

The hardened manual normal production collection has run live and succeeded: run `33818972728`,
attempt 1, event `workflow_dispatch`, head SHA `319dfddd8ac83ae5ab7d20bfb684d3760bf64fbf`, both
jobs successful, the runner completing through synchronous postflight. Owner-side Cloudflare
telemetry in a cleaner 30-minute window around it showed approximately 32k rows read, 375 rows
written and 10 queries — dashboard time-window aggregates, not per-workflow accounting — which is
far below every ceiling. **That reading is superseded.** It was an account-level dashboard
aggregate over a window, not per-workflow accounting, and the later Step Summary for run
`33901634593` measured 124,430 actual `rowsRead` against a 94,844 structural estimate. Resource
headroom remediation **is** justified and is implemented by the checkpoint above. No ceiling moved
then and none moves now.

Stage D adds a separate scheduled workflow with exactly one trigger — the permanent approved
cadence `17 1 * * *` (01:17 UTC), restored after the temporary 4 September 2026 acceptance windows
closed — a
credential-free scheduled-SHA gate with a bounded read-only exact-head Verify wait, and the
dedicated unattended `data-s2-production-scheduled` environment. The manual workflow stays
`workflow_dispatch`-only and attended, both share one non-cancelling concurrency group, and the
collector, ceilings and postflight are unchanged. Cloudflare Cron stays superseded and absent.

The environment gate is satisfied in practice: the accepted natural run was admitted to
`data-s2-production-scheduled` and its credentials resolved. The environment's protection rules
still cannot be proved from this repository and remain owner-side. A pre-deadline opportunity, any
second daily collection and any shorter cadence remain separate later decisions. See
[daily GitHub Actions schedule](../workers/data-platform/DATA-S2B-GITHUB-ACTIONS-DAILY-SCHEDULE.md).

<!-- DATA-S2B-MANUAL-COLLECTION-HARDENING-2026-09-03 -->
## Earlier DATA-S2B gate — manual collection hardening; one manual collection was the next live gate

**Closed by the Stage D gate above:** that one manual collection ran and succeeded as run
`33818972728`, and recurring GitHub scheduling has since been separately approved and implemented.

The first production collection run is completed: reconciliation run `33792104384` and resume run
`33815400284` both succeeded on exact `main` `d79dd37451e16b642ce96709b8635c3ac618c366`, and the
success contracts of those entry points prove `RESUME_RECONCILIATION_SAFE` and a validated
synchronous postflight respectively. Exact provider row accounting for them is unavailable.

The manual normal collection workflow is now hardened to the same trust boundary as the
migration-0003, EXPLAIN, reconciliation and resume paths, and remains manual-only. Next gate is
owner review and merge; after merge, exact-`main` Verify Teamsheet must pass, and only then may
the owner separately approve exactly **one** manual production collection. Recurring GitHub
scheduling and Cloudflare Cron remain disabled and separately unapproved; activation is a later
checkpoint after one observed manual collection.

<!-- DATA-S2B-PHASE4B-LATEST-INHERITANCE-REMEDIATION-2026-08-28 -->
## Current DATA-S2B gate — review Phase 4B `latest` inheritance remediation

Run `33186084206` on exact `main` `035e5fa768e47bee8548df9a39e9e629c811eea5` passed its repository/credential gates but Cloudflare rejected both explicit UUID inherit references with HTTP 400 / `CF_10057`; no retry or successful Version ID followed. Mutation-free run `33186488030` then passed on the same SHA: the expected Version remained latest and solely active at 100%, rollback remained present, and Cron/D1/hostname/health state remained expected. No newer deployable Version from the rejected request was observed.

The repository candidate changes the required transport value to literal `latest`, performs its final latest==expected-active check immediately before the sole Version POST, and requires a post-success exact-one/newest Version delta matching the returned ID plus resolved-binding and unchanged-production checks. `latest` is not atomic with the pre-check; concurrent creation remains a residual risk and any unexpected delta blocks Deployment and requires reconciliation. Next gate is owner review and merge approval. Merge and exact-main verification still require a completely new explicit approval for one inactive upload attempt; no Deployment, traffic, Cron or collector approval follows.


<!-- DATA-S2B-PHASE4B-UPLOAD-ENVIRONMENT-CANDIDATE-2026-08-28 -->
## Current DATA-S2B gate — Phase 4B inactive-Version-upload environment correction

The corrected mutation-free preflight passed as run `33173358713` on exact `main` `e45828ad34273eb71d7d6ae928e0931c30b4e95f`, reconciling fresh live Version, traffic, hostname, compatibility, season, Cron, D1 governance, count, size and authenticated-health state without any mutation. The remaining defect is in the standalone inactive-Version-upload workflow, which still selected the Phase 2 upload environment and its upload-token secret — the same pairing live run `33171701995` proved does not supply the Worker bearer or Access service credentials the upload helper requires before its first Cloudflare request.

This narrow correction moves that job to `data-s2b-phase3-deployment`, whose credential presence is live-proven by successful runs `33142804502` and `33173358713`, and maps its existing deploy-token secret into the upload helper's unchanged token variable. The upload executable, its single `/versions` mutation endpoint, its binding-inheritance design and every postflight control are unchanged.

It must merge and pass exact-main Verify Teamsheet before the owner may dispatch the already-approved single inactive Worker Version upload. That upload would authorize no Deployment, no production traffic change, no Cron activation and no collector execution.

<!-- DATA-S2B-PHASE4B-REPOSITORY-CANDIDATE-2026-08-28 -->
## Current DATA-S2B gate — Phase 4B repository candidate; live actions unapproved

The repository now prepares two future separately approved operations: one inactive immutable Phase 4 Version upload, then a later exact-Version 100% Deployment retaining the current production Version for bounded rollback. This checkpoint does not upload, deploy, activate Cron, execute collection or write D1. Next is owner review and merge approval; after merge, a fresh mutation-free live preflight and new explicit approval are required before any Version upload. Deployment and Cron/collection remain later independent approvals.

<!-- DATA-S2B-PHASE3-LIVE-CLOSEOUT-2026-08-28 -->
## Current DATA-S2B gate — Phase 3 live deployment PASS; Phase 4 unapproved

Phase 0 read-only preflight, Phase 1 migration, Phase 2 inactive-Version closeout and Phase 3 production deployment are PASS. Protected workflow run `33142804502` on exact SHA `d48913332bf5df37b29d98b06579f369f338f6e4` deployed existing candidate `3a2b065a-6527-4887-9bf8-b08e82e81133` as the sole active Version at 100%. Rollback Version `5edbe951-4be4-46bc-b2cf-17b550396105` was retained and rollback was not required. Exactly one Deployment mutation occurred; postflight passed; no new Version or Cron/D1/route/domain/Access/secret mutation was made by the workflow. See [Phase 3 live closeout](../workers/data-platform/DATA-S2B-PHASE-3-LIVE-CLOSEOUT.md).

The next gate is **Phase 4 investigation/design/approval only**. Cron activation and collection remain blocked and unapproved, as do provider, model, calculation and application changes.

<!-- DATA-S2B-PHASE2-POSTFLIGHT-2026-08-27 -->
## Current DATA-S2B gate — Phase 2 live closeout PASS; Phase 3 design next

**Supersedes the older present-tense DATA-S2A / DATA-S2B Phase 0 and Phase 1 status wording below while preserving those dated records as historical evidence.** DATA-S2B Phase 0 live read-only preflight is complete PASS (`32996481967`), and Phase 1 migration 0002 is complete PASS (`33011334466`). Phase 2 attempt #3 (`33050859823`) created inactive Worker Version `3a2b065a-6527-4887-9bf8-b08e82e81133`; its postflight red result was a false failure caused by using `/settings` as active-version binding authority. PR #170 corrected the model to Deployments plus exact Version Detail, merged, and exact-main Verify Teamsheet run `33074154222` passed on `2176a3dd29562fecff10614b689ed99a06db6bfa`.

Phase 2 read-only closeout run `33088512116` is **PASS**. Production remained on active deployment/version `10f7a065-3d82-4b34-9fb1-dc6c3a0be524` / `5edbe951-4be4-46bc-b2cf-17b550396105`; the candidate remained inactive. Exact Version Detail reconciled bindings, Cron remained empty, Phase 1 D1 governance/count state remained exact, collection/history counts remained zero, and D1 size remained exactly `151552` bytes across the bounded read. Accidental upload run `33088187544` was cancelled before its protected mutation-capable job was released and created no new Worker Version. See [DATA-S2B Phase 2 Live Read-Only Closeout](../workers/data-platform/DATA-S2B-PHASE-2-LIVE-CLOSEOUT.md).

Next gate after this documentation closeout: **Phase 3 investigation/design only**. Phase 2 PASS does not deploy the candidate or establish production acceptance. Phase 3 deployment requires a new explicit owner approval; Phase 4 Cron activation and collection remain separately unapproved. No deploy/promote/split/delete, collector run, D1 write, Access/secret change, provider/model/calculation change or application change is authorized here.

<!-- DATA-S2B-PHASE0-CANDIDATE-2026-08-26 -->
## Current DATA-S2B gate

The Phase 0 read-only Action is a repository candidate only. It remains unexecuted against Cloudflare. Next is exact-head repository verification, followed by separate owner decisions for protected-environment/secret setup and then a separately approved first live read. Migration, Worker Versions upload/deployment and Cron activation remain later mutation gates; DATA-S3 remains excluded.

<!-- DATA-S2A-2026-08-26 -->
## Current checkpoint — DATA-S2A repository candidate; DATA-S2B next

DATA-S1C-R is complete and supersedes the failed RPC/custom-HTTP direction for forward collection while preserving those assets as historical/rollback evidence. DATA-S2A is the current repository-only, `shadow_only` Official FPL history candidate: fixed `bootstrap-static` plus `fixtures`, strict allowlisted facts, delta-only append history in D1 and no Teamsheet runtime/model influence. The declared hourly Cron is not active; no DATA-S2A deployment or live D1 mutation has occurred.

**Next, only after separate owner approval: DATA-S2B.** Its gate is live migration/deployment, Cron activation, one real baseline, an unchanged cycle with zero observation/head changes, a precise changed-fact append, actual D1 accounting, Workers Free CPU suitability, and rollback/stop on failure. DATA-S3 outcomes, production use and every later provider/model checkpoint remain outside DATA-S2B unless separately approved.

<!-- DATA-S1C-2026-08-25 -->
## Current checkpoint — DATA-S1C repository candidate

Private Service Binding/RPC preparation is implemented: split named read/ingest entrypoints share DATA-S1 operations, and the deployed neutral read-only acceptance caller has no D1 or public route. Because the awaited nested caller RPC still hung, the pending Option 2 diagnostic harness binds directly to the target read entrypoint while preserving separate PRE/POST caller topology evidence. A direct-target pass would not prove caller forwarding, which remains `NOT PROVEN`; any live run still requires separate approval. DATA-S2 and all production writes remain blocked. See [DATA-S1C private Service Binding and RPC architecture](DATA-S1C-PRIVATE-SERVICE-BINDING-RPC.md).

<!-- DATA-S1B-PREFLIGHT-CURRENT-2026-08-23 -->
## Current checkpoint — DATA-S1B mutation-free preflight PASS

The delivered GW1 readiness checkpoint remains PR #121; it is retained as application evidence and is not superseded as product behaviour by DATA-S1.

The DATA-S1B mutation-free live preflight is complete and **PASS**, with the final phase-gated procedure recorded in the [DATA-S1B Final Preflight and Deployment Runbook](DATA-S1B-FINAL-PREFLIGHT-AND-DEPLOYMENT-RUNBOOK.md). DATA-S1 remains **NOT LIVE DEPLOYED**. No DATA-S1 Worker, production or validation D1, migration, Access configuration, service token, DNS/Custom Domain, route or production binding was created. Owner evidence records **Workers Free — Active** and current/projected billable usage **$0.00**; deployment must remain within Workers Free/D1 Free limits and stop rather than upgrade.

The reviewed PR #147 candidate baseline is **986 tests passed, 0 failed, 0 skipped, 0 cancelled**, deterministic build/provenance gates and exact-head Verify Teamsheet. Merge authorizes **no Cloudflare mutation**. After merge, re-read latest GitHub `main` and require green Verify Teamsheet on the exact merge commit. Only then may the owner consider the next separately gated live mutation, **Phase 2 disposable D1 validation**. DATA-S2 remains blocked until DATA-S1B live deployment and acceptance fully close. No model, provider, fixture, captaincy, squad, transfer, simulation, rank, Mini-League or application behaviour changed.

<!-- GW1-P2C5-CURRENT-2026-08-22 -->
## GW1-P2C5 closeout — synthetic infrastructure gate complete

GW1-P2C5 is complete and **PASS for the synthetic production path only**: one physical iPhone acceptance reached browser `Archived`, and exact read-only D1/R2 reconciliation confirmed the accepted receipt, manifest, object identity, integrity metadata and R2-first custody. The temporary candidate is no longer deployed and PR #143 is closed unmerged. The next evidence gate is observational, not implementation work: natural GW2 Stage 10 capture, genuine prospective custody and Official eligibility remain unproven. Historic GW1 recovery remains parked. See [GW1-P2C5 closeout](GW1-P2C5-STAGE10-PRODUCTION-PATH-ACCEPTANCE-CLOSEOUT.md).

<!-- GW1-P2C3B-CURRENT-2026-08-22 -->
## GW1-P2C3B closeout — completed transport gate

The physical sibling-domain browser transport gate is complete and **PASS (transport only)**. Real iPhone Safari with Prevent Cross-Site Tracking ON directly observed same-site OPTIONS 204 and matching invalid-body POST 422 with readable `envelope_schema`. Genuine Stage 10 custody, valid archival, D1/R2 persistence and idempotency remain separate future evidence gates. Rollback cleanup also remains a separate future checkpoint. Older entries below are historical and must not be read as saying same-site deployment or transport acceptance is still pending.


<!-- GW1-P2C2-CURRENT-2026-08-21 -->
## Current gate — GW1-P2C2, 21 August 2026

Option A cross-site acceptance is closed as unsuccessful after the 21 August iPhone Safari diagnostic: corrected OPTIONS reached the Worker (204), but POST did not reach it. The next sequence is deliberately gated: **(1)** complete and review draft PR #139 repository preparation; **(2)** obtain explicit approval for live custom-domain rollout; **(3)** configure/verify `app.fpltsheet.co.uk` and `archive.fpltsheet.co.uk` without weakening Access/CORS; **(4)** perform one controlled physical iPhone Safari acceptance under normal privacy settings; **(5)** only then decide whether GW1-P2 is accepted and whether the legacy rollback origin can be removed.

Do not pull post-GW1 provider/model work into this sequence. Local Stage 10 evidence/recovery/export remains the fallback and GW1 recommendation behaviour does not depend on cloud custody.


Purpose: open, next and deferred work only. Historical stage and merge records are indexed in [Historical Records](HISTORICAL_RECORDS.md). Last reconciled: 12 August 2026.

## Current sequence

This document describes the tree it lives in. It does not restate the current `main` commit SHA — read that live with `git rev-parse origin/main`.

**GW1 readiness remediation is complete.** The readiness audit found **zero blockers** and two should-fix items; both were addressed by the **GW1 readiness — pre-deadline Transfers safety guard** checkpoint delivered on **PR #121**, which Pritesh physically accepted on iPhone Safari at head `f720230…` (Verify Teamsheet #262 / `31583716004`, then-current **898/898**). No readiness engineering item remains open, and readiness work authorised no model, provider or calculation change.

GW1-P1 is complete and merged through PR #118. GW1-P2 is a separate, still-unaccepted stream on **draft PR #119**, exact head `252c5eba0381c8aa5afb7bda1686dd102326c6df`; its exact-head Verify Teamsheet #255 / `31537859087` passed **931/931 tests** plus deterministic/provenance/build-identity gates. It is not accepted and not merged, and **it does not gate GW1**.

### Completed before GW1

1. **Canonical documentation reconciliation** — merged through PR #120.
2. **GW1 Readiness Audit — investigation only.** Concluded *go with conditions*: zero blockers, two should-fix items.
3. **GW1 readiness safety guard** — the approved narrow fix for both items, delivered on PR #121 and physically accepted.
4. **External Intelligence Foundation — documentation only.** The forward research and shadow-architecture record for external football information: provider-neutral observation contract, hard `shadow_only` boundary, dated free-source research, double-counting controls and a pre-registered ablation method. It authorises **no** provider, endpoint, retention, model, calculation or recommendation change and does not alter the freeze. See [External Intelligence Foundation](EXTERNAL-INTELLIGENCE-FOUNDATION.md).

### Historical immediate operating state — pre-GW1 freeze

> Superseded by the C5 closeout and current DATA-S1 control section above. The sequence below is retained as historical planning evidence and is not an instruction to repeat elapsed acceptance work.

5. **Code freeze and operational rehearsal.** Make only separately approved fixes; every change still passes the full repository gate.
6. Operate GW1 and collect prospective evidence, using local Stage 10 capture, recovery and owner-controlled export as the pre-deadline evidence path. Confirm the Stage 10 record truthfully reports whether Odds affected the model, then export it — that capture is what makes the primary market-layer ablation possible later, and no pre-GW1 code change is needed for it.

The next work is **not** post-GW1 model or provider enhancement.

### GW1-P2 live acceptance — a separate gating stream

7. Perform the decisive GW1-P2 physical iPhone Safari acceptance once a genuine Stage 10 record can exist, from **20 August 2026 at 18:30 BST**.
8. Do not merge PR #119 before successful live acceptance, final exact-head verification and explicit owner approval.

This stream runs alongside GW1 operation. Because cloud custody is a one-way side effect that the recommendation never depends on, a failure or delay here does not block GW1; it only leaves local capture/export as the evidence path for longer.

### Evidence-led review

9. Review accumulated prospective evidence at the **GW5 → GW6** international break, following the ordered review method — evidence integrity, then current model performance, then predeclared current-layer ablations, then error-source diagnosis, then the next experiment — recorded in [External Intelligence Foundation](EXTERNAL-INTELLIGENCE-FOUNDATION.md) §15. GW1–GW5 is an evidence-collection period, not a validation sample: anything designed from it must face untouched future Gameweeks before any predictive claim.

### GW1-P2 acceptance boundary

Owner-performed preparation has established that Access `Bypass OPTIONS requests to origin` was configured, top-level iPhone Safari Access authentication worked, the protected `/v1/health` route worked, non-destructive storage telemetry was observed, and Pages branch switching/restoration was exercised.

The decisive credentialled cross-site application POST with **Prevent Cross-Site Tracking ON** remains unproven. If it fails, stop and return with an evidence-led Option B versus Option C comparison. Do not disable Safari privacy protection as a product requirement and do not implement either alternative without separate approval.

The bounded outbox `pinLimit` remains conservative at four. The usable iPhone storage ceiling is not evidenced, so that value is not claimed to be proven safe and must not be raised in this checkpoint.

### Early-season evidence period

The previous planning assumption of a major review after GW2 was incorrect. The first relevant 2026/27 international break is **between GW5 and GW6**.

Therefore:

- GW1 readiness remediation is complete, so the immediate operating state is pre-GW1 code freeze and operational rehearsal;
- **GW1–GW5** is the initial stability and prospective-evidence collection period;
- the **GW5 → GW6 international break** is the first major evidence-led review/improvement opportunity;
- by then Teamsheet may have up to five Gameweeks of prospective evidence, depending on what was genuinely captured and validated.

This timing statement authorises **no** model, fixture, expected-minutes, scoring, provider, squad, captaincy, transfer, optimiser, simulation, rank or Mini-League change. Any such change remains separately approval-gated and evidence-led.

## Deferred beyond GW1-P2

Longer-horizon product work remains separately gated. Nothing below is implementation-approved by GW1 readiness work or by either GW1-P checkpoint:

- Understat repair.
- Odds API repair.
- Broader D1 historical/live schema expansion beyond the minimal GW1-P1 evidence manifest/receipt foundation.
- Claude-to-ChatGPT migration.
- Cloudflare automation expansion.
- AI agents and richer external intelligence. Every step of the post-GW1 sequence in [External Intelligence Foundation](EXTERNAL-INTELLIGENCE-FOUNDATION.md) — the provider-neutral shadow observation foundation, the Stage 10 replay/ablation harness, competition/workload facts, role-change tracking, richer minutes evidence, a ClubElo structural experiment, the Understat decision, team-news/tactical facts and matchup microstats — is a proposal only and needs its own evidence-led approval. Recording a source in that document's research matrix is not approval to acquire, integrate, retain or weight it.
- Route-aware optimisation unless future workload/responsiveness evidence justifies a separate proposal.
- Any GW1-P2 transport alternative (Option B or Option C) unless the decisive Option A acceptance fails and a separate evidence-led comparison is approved.

The brittle `selectMiniLeague` exact-source-string assertion is deferred narrow test-hardening debt. Live-Gameweek evidence gates remain unchanged: real minute-history behaviour, Stage 10 outcome/correction evidence and populated Mini-League ranking/rival/pagination acceptance require the relevant official post-Gameweek facts.

## Completed foundations relevant to the current path

- Teamsheet 2.0 product sequence and A3 engineering remediation are complete through their recorded merged checkpoints.
- Data Architecture D1 was approved as the evidence architecture.
- **GW1-P1 — Cloudflare Evidence Foundation** is complete and merged through PR #118.
- **GW1-P2 — Browser Evidence Delivery + Durable Outbox** is implemented as a draft candidate but remains acceptance-incomplete.
- **GW1 readiness — pre-deadline Transfers safety guard** is complete and physically accepted, delivered on PR #121.
- **External Intelligence Foundation** is complete as a documentation-only research and shadow-architecture record. It authorises no implementation.

Historical roadmap entries below remain historical snapshots. They must not override this current sequence or live GitHub state.

## Historical — 11 August 2026 checkpoint: GW1-P1 final closeout

**Historical snapshot; GW1-P1 has since merged through PR #118 as recorded above.**

At that checkpoint **GW1-P1 — Cloudflare Evidence Foundation was implemented on draft PR #118 and was in final closeout.** Latest merged `main` was `43f109b306071aa0c3c1c45985876fecb3da7aa5`. The checkpoint is backend-only: separate authenticated evidence Worker, private R2 canonical objects, minimal D1 manifest/receipt state, canonical Stage 10 validation, idempotency and orphan reconciliation. Repository records also capture owner-performed physical iPhone Safari production functional acceptance.

Preview/version URL security is closed: the repository candidate explicitly disables Cloudflare Preview URLs and tests that invariant, and owner-supplied live Cloudflare Domains dashboard evidence on 11 August 2026 showed the production route Access-`Restricted` with the wildcard Preview hostname disabled. Canonical documentation reconciliation, exact final-head repository verification after every documentation/config change, and final PR diff/description review were the closing work.

At that time GW1-P2 was not to be started, and Teamsheet browser sync/persistent outbox upload was unimplemented and separately approval-gated. It has since been separately approved and implemented as the PR #119 candidate. Provider archival rights remain fail-closed; Understat/Odds repair, provider weighting, model/calculation work, Sheets automation, agents and scheduled collectors remain outside both GW1-P1 and GW1-P2.

## Historical — 11 August 2026 A3 checkpoint status

**A3-SC-1 Small Stale-Code Cleanup is complete, merged and post-merge verified.** PR #116 merged at A3 engineering baseline `1060e60d3affadabdf97924c7ece85cc62d8e360` from reviewed head `097fabb6065afc4c322238985eb7f237a503a7c3`. The reviewed tree passed **868 tests, 868 passed, 0 failed, 0 skipped, 0 cancelled** in Verify Teamsheet run #193 / `31469449540`. Permanent post-merge Verify Teamsheet run #194 / `31470879289` passed the repository gate on the exact merge commit, and GitHub Pages run #120 / `31470878300` succeeded for the same commit. No physical iPhone testing was performed or claimed for PR #116.

A3-SC-1 removed only the two proven-unreachable Mini-League helpers `renderLeagueChips()` and `rememberLeague()` plus stale test-side consumers. It added structural regressions and changed no intended application behaviour. The brittle `selectMiniLeague` exact-source-string assertion remains deliberately untouched as future narrow test-hardening debt.

**A3 engineering remediation is complete through PR #116. This documentation/architecture reconciliation was the final A3 closeout layer.** It reconciled canonical current-state, architecture, roadmap, limitation, testing and historical wording; no A3-specific engineering or documentation task follows it, and it did not authorise implementation work outside that documentation boundary.

Route-Aware Rendering and Performance M1 is complete through PR #115 at `02ea634464cc415ac43d4b9cb13b4005fc276646`. Exact-main Verify Teamsheet run #183 / `31459954883` passed **866 tests, 866 passed, 0 failed, 0 skipped, 0 cancelled**. M1 delivered measurement instrumentation only, deliberately outside every production build input. It changed no route scheduling, rendering behaviour or production output. **Route-aware optimisation is not implementation-approved.** See [Route-Aware Rendering and Performance](ROUTE-AWARE-RENDERING-PERFORMANCE.md).

## Historical — 10 August 2026 checkpoint status

**A3 State-Ownership Cleanup is complete, merged and post-merge verified.** PR #112 merged at `main` `691d9f929284d51c233b61d099c34cafe1030db6` from reviewed head `620daf14d1c354668b16df74daf05e29d8a1eb25`. Exact-main Verify Teamsheet run #167 / `31430700053` passed **864 tests, 864 passed, 0 failed, 0 skipped, 0 cancelled**, together with committed provenance, production build, deterministic rebuild, root/deployable equality, exact build identity and production-output preservation. GitHub Pages deployment run #117 / `31430697347` also succeeded on that exact merge commit. No physical iPhone testing was performed or claimed.

The completed checkpoint keeps `src/state.mjs` as an explicit cross-module shared-slot inventory rather than a new semantic state owner and makes the legacy Mini-League alias one-way so `S.miniLeagues` remains the only writable runtime preference representation. It is not a general state-management rewrite and changes no model, provider/data-source, persistence-format, error-boundary, Atomic Foreground Refresh, routing-performance or bundler behaviour. See [A3 State-Ownership Cleanup](A3-STATE-OWNERSHIP-CLEANUP.md).

At that checkpoint Route-Aware Rendering and Performance was the next substantive work, beginning with investigation and measurement only. Its M1 measurement stage has since merged through PR #115; optimisation remains unapproved, as recorded in the current-status section above.

## 10 August 2026 — `fpl:calib` compatibility and resilience is merged

PR #107 is merged at `main` `d112c673310149a4463def1758242460450600dc`, over source `862eefc32b0edb070290ad9ce82d85b1123b0596`, generated-only child `69e539647ae687f49605633505e7147da76125e2` and documentation child `6ba905d`. Permanent Verify Teamsheet run #127 / `31396393124` passed every stage on the merge commit itself, on an **842-test** baseline. The merged behaviour fails closed on every current unverified calibration record, preserves the stored bytes, keeps standard uncalibrated projections active, and adds no production calibration generator or tuned factors. PERSIST-4 is therefore closed.

## 10 August 2026 — A3 cache and persistence resilience is merged

PR #104 is merged at `main` `9b31f373a23d26c49f81c688a2ca6fde98086cbd`, from reviewed head `4e434b940e2bcb473374573db5da16f6a645d9eb` over source/test commit `502a1f7ac0e0456743f3ddb0695433decf8976d1` and generated-only child `02216b8`.

It keeps Atomic Foreground Refresh ordering unchanged while adding a schema/season-bound main `fpl:cache`, verified user-owned saves, season-bound manual-squad and Mini-League preference records, and explicit session-only warnings when browser persistence fails. Independent review found and corrected one real defect: a failed authoritative storage-manager write could fall back to `localStorage` and be reported as a durable save even though no later read could return it. The Refresh-Load R1 supporting-cache cadence/compatibility rules and Stage 10 evidence stores are unchanged. Legacy `fpl:calib` remained deliberately untouched behind the separate model approval gate until PR #107.

Evidence: **832 passing tests, 0 failed**, verified committed build provenance, two byte-identical production builds, and permanent Verify Teamsheet run #105 / `31377157889` on the reviewed head. Pritesh explicitly waived physical iPhone testing and explicitly approved the merge. No physical device testing was performed, and none is claimed.

## 10 August 2026 — PR #103 physical acceptance closeout

The final Small Mobile UI Consistency + Loading Viewport Fix application source is `646eee13960c343fbe07e3a76496717fd9837c0e`, with generated-only child `81cc9130ac2c7b8206f3bd5f6a2cf85bb5ba0777`. The final candidate retains every prior test and passes **803 tests, 0 failed**, deterministic byte-identical builds, root/deployable equality, exact build identity and reachable generated provenance. Permanent Verify Teamsheet run #90 / `31356255017` passed on the exact generated head.

Physical iPhone Safari acceptance is complete: the startup canvas reaches Safari chrome without a light strip; Team, Transfers, Fixtures, Leagues and Settings use the accepted shared header hierarchy; the refined editable/selectable controls are visually proportionate while retaining the no-focus-zoom behaviour; and the Leagues primary box now aligns vertically with the other primary screens. Pritesh explicitly approved PR #103 for merge on 10 August 2026.

No projection, expected-minutes, scoring, fixture, captaincy, squad, transfer, rank, Mini-League/rival, provider, data-source, Atomic Foreground Refresh, navigation, Team-renderer or Player Detail behaviour changed. At documentation closeout, GitHub `main` remained `d5f2572ee4d95c3c242ecbc97ee46802a6f0273d`; the eventual merge commit must be read from latest `main` rather than inferred from this pre-merge documentation commit.

## Completed before the current sequence

- **Data Architecture D1 design — complete:** approved architecture is recorded in [DATA-ARCHITECTURE-D1.md](DATA-ARCHITECTURE-D1.md). The later separately approved GW1-P1 backend foundation is merged through PR #118; the separately approved GW1-P2 Teamsheet browser integration/persistent outbox is implemented on the unmerged PR #119 candidate.
- **Atomic Foreground Refresh — complete and merged:** PR #102 is merged and physically accepted. See [Atomic Foreground Refresh](ATOMIC-FOREGROUND-REFRESH.md).
- **Cache and persistence resilience — complete and merged** through PR #104; 832 tests, committed build provenance, deterministic double-build validation, permanent Verify Teamsheet run #105 and independent review of the final diff all passed. Physical iPhone testing was explicitly waived by the owner.
- **Production-Bundle Safeguards — complete and merged** through PR #111 at `main` `5a1a036…`; exact-main run #159 passed 859/859 and the three complete-bundle safeguards are permanent tests.
- **State-Ownership Cleanup — complete and merged** through PR #112 at `main` `691d9f9…`; exact-main run #167 passed 864/864, the shared-state inventory and one-way Mini-League compatibility ownership are permanent, and no physical iPhone testing was performed or claimed.
- **Route-Aware Rendering and Performance M1 — complete and merged** through PR #115 at `main` `02ea634…`; exact-main run #183 passed 866/866. M1 is measurement instrumentation only and route-aware optimisation remains unapproved.
- **A3-SC-1 Small Stale-Code Cleanup — complete and merged** through PR #116 at A3 engineering baseline `1060e60…`; reviewed-head run #193 passed 868/868 and post-merge run #194 passed the exact-main repository gate. No physical iPhone testing was performed or claimed.
- **GW1-P1 Cloudflare Evidence Foundation — complete and merged** through PR #118 at `main` `58b834a…`; reviewed head `7b739e5…` passed Verify Teamsheet #251 / `31526697241` on an 883-test baseline. Backend only.
- **Canonical documentation reconciliation — complete and merged** through PR #120 at `main` `be9d3c9…`; post-merge run #260 passed the exact-main repository gate on the then-current 883-test baseline. Documentation only.
- **GW1 readiness — pre-deadline Transfers safety guard — complete and physically accepted**, delivered on PR #121; head `f720230…` passed Verify Teamsheet #262 / `31583716004` on the then-current **898**-test baseline, and Pritesh physically accepted the guarded Transfers screen on iPhone Safari. Presentation and scheduling only; no optimiser mathematics changed. See [GW1 readiness safety guard](GW1-READINESS-SAFETY-GUARD.md).

## A3 remediation and closeout sequence

The engineering remediation entries below are complete. **Item 8 was the final documentation/architecture reconciliation; no further A3-specific engineering or documentation task follows it.** Route-aware optimisation is not part of the remediation sequence and remains separately unapproved.

1. **Post-A3 Checkpoint 0 housekeeping — complete and merged through PR #105.** Automatic Verify Teamsheet verification of `main`, post-merge documentation reconciliation and the duplicate manual-squad handler investigation. See [Post-A3 Checkpoint 0](POST-A3-CHECKPOINT-0-HOUSEKEEPING.md).
2. **`fpl:calib` compatibility and resilience — complete and merged through PR #107** at `main` `d112c67`. The checkpoint was separately model-gated and was approved and merged as a fail-closed compatibility change only: no production calibration generator, no tuned factors and no accuracy claim. [PERSIST-4](KNOWN_LIMITATIONS.md) is closed by it.
3. **A3 error-boundary separation (Package EB-1) — complete, physically accepted on the executable paths, merged and post-merge verified through PR #108** at `main` `ba5daa20…`. It fixes failure ownership only: recovery-render failures are explicitly observable instead of swallowed, unexpected supporting-layer exceptions stay application-owned instead of manufacturing Understat/Odds provider evidence, and startup/manual/foreground refreshes classify otherwise escaping exceptions at a narrow lifecycle boundary. Provider endpoints, validation, retry cadence, weighting, Rule-B retain/clear and every model calculation are unchanged. See [A3 error-boundary separation](A3-ERROR-BOUNDARY-SEPARATION.md).
4. **Production-Bundle Safeguards — complete and merged through PR #111** at `main` `5a1a036…`. It is test/harness-only and protects complete generated-bundle parsing, late-module retention and execution of late runtime replacements/navigation under the zero-dependency harness.
5. **State-ownership cleanup — complete, merged and post-merge verified through PR #112** at `main` `691d9f9…`. `state.mjs` is the explicit shared-slot inventory rather than a new semantic state owner; the legacy Mini-League alias is one-way; focused lifecycle/ownership regressions are permanent. No wholesale state-management rewrite. See [A3 State-Ownership Cleanup](A3-STATE-OWNERSHIP-CLEANUP.md).
6. **Route-aware rendering and performance — M1 measurement complete and merged through PR #115** at `main` `02ea634…`. Measurement demonstrated real avoidable inactive-route and shared-render work but did not demonstrate material user-visible lag, and the instrumentation stays outside every production build input. **Optimisation is not approved.** See [Route-Aware Rendering and Performance](ROUTE-AWARE-RENDERING-PERFORMANCE.md).
7. **Small stale-code cleanup (A3-SC-1) — complete and merged through PR #116** at A3 engineering baseline `1060e60…`. It used a reviewed deletion list limited to `renderLeagueChips()` and `rememberLeague()` plus stale test-side consumers; no opportunistic broad cleanup. The brittle `selectMiniLeague` exact-source-string assertion remains deferred test-hardening debt. See [A3-SC-1 Small Stale-Code Cleanup](A3-SC-1-SMALL-STALE-CODE-CLEANUP.md).
8. **A3 documentation and architecture closeout — complete.** Documentation-only reconciliation; no application, test, build, generated, model, provider or later-programme implementation belonged in that package.

### Separate narrow checkpoint — duplicate manual-squad handler correction (0C) — complete

Post-A3 Checkpoint 0C established, with empirical evidence, that the per-button manual-squad add and remove listeners in `src/ui/views.mjs` were unreachable, because `src/ui/manual-squad-runtime.mjs` installs a capture-phase document listener on the same selectors and calls `stopImmediatePropagation()`. The dead path omitted the position, club and budget checks and the FPL-T1 optimiser deferral, so it was a latent hazard rather than a live defect.

The owner-approved correction removed the dead listeners, left `manual-squad-runtime.mjs` as the single owner, added a regression proving the validating implementation runs and merged through PR #106. The original findings are in [Post-A3 Checkpoint 0](POST-A3-CHECKPOINT-0-HOUSEKEEPING.md); implementation and verification are in [Post-A3 0C cleanup](POST-A3-0C-MANUAL-SQUAD-DEAD-HANDLER-CLEANUP.md).

## Historical baseline — D1 design closeout era

Retained as the scope/evidence record of that checkpoint. **This is not the current baseline.** Current repository head, verification and acceptance evidence are in [Project Context](PROJECT_CONTEXT.md), [GW1-P1 Cloudflare Evidence Foundation](GW1-P1-CLOUDFLARE-EVIDENCE-FOUNDATION.md), [GW1-P2 Browser evidence delivery](GW1-P2-BROWSER-EVIDENCE-DELIVERY.md) and `CLAUDE.md`.

- Repository head at that checkpoint: `main` `deb4ea26ba96112dba07660e23a61f04d4b6596d` (D1 design closeout through PR #101).
- Latest substantive application checkpoint at that time: DTR-1 PR #99, reviewed source `a15443f3de889561fd301c4aa1792d19f7b21c83`, generated head `b45f89baf45e12de09cdb1ad34826756e9e5378b`, merge `09e595c275b4f3614c09fb502291de6831813999`.
- Permanent repository verification at that time: run `31301475598`; 691 passed, 0 failed, 0 skipped, 0 cancelled; reachable-source reproduction; deterministic double build; root/deployable equality; exact source and complete build-input identity. That baseline is historical and has been superseded.
- Transfers, Player Detail, Team and Fixtures tested paths are physically accepted on iPhone Safari.
- Leagues is accepted for the currently available pre-season data. Populated post-Gameweek acceptance remains deferred, not failed.
- Refresh-Load R1 is merged, deployed from `main` and physically accepted for every currently testable iPhone path. Live minute-history reuse awaits a completed checked Gameweek; Odds reuse awaits an enabled Odds configuration.

## Historical checkpoint — iPhone form-focus zoom correction

**Status:** complete, permanently verified, physically accepted and merged through PR #100 at `6e725485564a51ee2a17bc08e5c8bf95e8c2778c`. Retained below as the scope/evidence record.

**Scope:** render text, number, search, password, select and textarea controls at a minimum 16px so iPhone Safari does not auto-zoom on focus. Preserve browser pinch zoom and leave checkbox, file and range controls unchanged.

**Finalisation (as performed):** reviewed source/test/documentation changes were committed first, built with that reachable commit as `BUILD_COMMIT`, then the four generated deployables were committed. Permanent CI passed and focus, keyboard close, scale recovery and save behaviour were physically verified on the exact PR build before owner merge approval.

**Exclusions:** disabling zoom through viewport restrictions; body typography changes; control redesign; calculation, provider, data source, cache, persistence, route, navigation, security-origin or dependency changes; D1 and later roadmap work.

**Risks:** automated CSS contracts cannot prove physical Safari focus behaviour; the accepted evidence is limited to the tested owner device/browser path.

## Completed checkpoint — DTR-1 Direct Team renderer

**Status:** complete and merged through PR #99 at `09e595c275b4f3614c09fb502291de6831813999` after 691/691 permanent tests, exact generated provenance, deterministic builds, populated physical iPhone Safari acceptance and explicit owner approval.

DTR-1 replaced the legacy Team render/reconstruct boundary with one direct renderer while preserving the accepted design, calculations, providers, data sources, routes and persistence. Its exact-device pass exposed the separate pre-existing form-focus zoom issue now isolated above.

## Completed checkpoint — A3-R0 durable build provenance

**Status:** complete and merged through PR #98 at `5ee735f864aaea2b6c423dfaeb267f18f5fe3b2f`.

The generated manifest now carries complete build-input identity. CI requires the generating commit to be a reachable ancestor, verifies exact source inputs and reproduces committed deployables before ordinary builds overwrite them. Permanent run `31283849251` passed 685/685 with deterministic builds and root/deployable equality. No application behaviour changed.

## Completed checkpoint — Refresh-Load R1

**Status:** complete and merged through PR #96 at `2ddb33c81fa2092598f290d60320364f2e0c35dc`. The first iPhone pass exposed and bounded an offline-disclosure defect; corrected source `d1b6ac0…` passed exact remote verification and the focused device retest before owner-approved merge.

**Objective:** stop unchanged validated supporting inputs from being fetched again on every eligible startup/foreground cycle while preserving honest age, fallback and manual-refresh behaviour.

**Why it matters:** a connected live-season cycle can otherwise make roughly 102 requests, including 95 detailed histories, even when its seven-day cache is fresh. Optional outages also repeat retry latency and can consume Odds quota.

**Exact scope:**

- minute histories require matching schema/model/season, validated player entries, an unchanged finished-and-data-checked fixture revision and a maximum seven-day age;
- load the active connected or manual squad first, then the unchanged 80-player research cohort, requesting only missing/invalid/due players;
- stop after two completely failed four-player batches and never advance successful timestamps on failure;
- persist validated normalised Understat team inputs only, refresh after a completed match or 24 hours and use a six-hour automatic failure cooldown;
- persist validated key-free derived Odds inputs only, refresh hourly within 48 hours of a deadline/kickoff or six-hourly otherwise, and exclude inputs older than six hours;
- persist secret-free Odds cooldown state for rejected keys, quota exhaustion and transient failure;
- let manual Load Data and explicit optional-source setting changes bypass provider cooldowns;
- keep all seven Provider Health states and show detailed-minute age/cache use separately from core Official FPL freshness;
- reconcile merged A2 status and regenerate deployables only through `build.mjs`.

**Exclusions:** Understat parser repair/replacement; atomic foreground-state redesign; core bootstrap reduction; new provider/endpoint/origin; gateway change; formula, model, ranking or recommendation change; navigation redesign; golden change.

**Risks:** historical player corrections can arrive without a fixture revision, cached Odds may be up to one/six hours old, and cooldowns can delay automatic recovery. The seven-day backstop, six-hour maximum Odds use and manual bypass bound those risks.

**Test requirements:** all 667 prior tests plus request count/order, revision/age, missing-only refresh, outage guard, unchanged timestamp, Understat/Odds cadence/cache/cooldown/key-free persistence and manual-bypass coverage; deterministic double build, root/deployable equality, exact manifest identity and remote CI. No test or golden may be removed or weakened.

**Physical acceptance:** online startup, exact build identity, short background return, Provider Health, manual refresh, cached repeat launch and in-app offline resilience passed on iPhone Safari. The focused corrected-build retest also passed: FPL showed Fallback, explicit offline copy and the unchanged saved-data time, and the same accepted build identity was verified after Pages returned to `main`. Minute-history reuse cannot yet be physically exercised before a completed Gameweek; Odds reuse cannot be exercised while Odds is disabled. Full offline hard reload is outside R1 because the static Pages shell is not available without a service worker.

**Completion evidence:** exact remote head `967856246a0c17972c43eaf444651bceb8b9f728`, reviewed/merged tree `fd40deff72c458286e77f44a66b79a0e720e700c`, permanent run `31265107597`, 681/681 tests, deterministic builds, root/deployable equality, exact manifest identity, focused physical retest and explicit owner merge approval. Parser repair, offline-shell/service-worker support and atomic-state work remain separate proposals.

## Historical investigation — Data Architecture D1

**Status:** investigation/design complete and merged through PR #101 as documentation only; the original design checkpoint did not authorise implementation. The later GW1-P1 backend checkpoint was separately approved and is merged through PR #118. The later GW1-P2 browser checkpoint was separately approved and is implemented on the unmerged PR #119 candidate.

**Objective:** define the correct historical and live data platform for Teamsheet. Compare Cloudflare D1, KV, R2, Durable Objects and Google Sheets against retention, query, update, cost, reliability, privacy, export and iPhone-operation requirements. Treat the existing Sheets as field prototypes; classify each field as persist, derive, export or remove. Google Sheets is a potential human-readable reporting/analysis layer, not an assumed core database.

**Boundary at the time:** do not repair Understat or Odds, change providers/calculations, implement storage or migrate AI without a separate approved checkpoint. The accepted design is recorded in [Data Architecture D1](DATA-ARCHITECTURE-D1.md). GW1-P1 later implemented the backend evidence foundation and GW1-P2 later implemented the browser delivery client; those original exclusions otherwise remain.

## Deferred live-evidence checkpoint — First live evidence and Leagues acceptance

**Status:** evidence-gated, not an implementation approval.

**Objective:** test the paths that pre-season Official FPL data cannot exercise.

**Exact scope:**

- execute the deferred Leagues script using published rank and standings;
- verify real movement, points gaps, nearby rivals, pairwise comparison and explicitly loaded selected-rival exposure;
- exercise relevant targeted pagination and stale/incomplete public-picks handling;
- confirm Stage 10 outcome capture and Official FPL `data_checked` handling;
- record observed defects without changing calculations.

**Exclusions:** projected League strategy, model tuning, new providers, full-league fan-out and synthetic closure of unavailable data paths.

**Risks:** provisional or corrected Official FPL facts could be mistaken for an app defect.

**Dependencies:** a completed Gameweek, official checking and a relevant connected League membership.

**Test requirements:** existing suite plus redacted fixture shapes for each real defect before a correction is approved.

**Physical acceptance:** all items in [Leagues pre-season acceptance](LEAGUES-PRESEASON-ACCEPTANCE.md), plus a weekly Team/Transfers/Fixtures smoke check.

**Approval gate:** investigation report first; every correction receives its own scope and approval.

## Proposed product checkpoint — Weekly action and primary navigation

**Status:** after live weekly use, not approved.

**Objective:** decide whether Fixtures remains a fifth primary destination and make the most important weekly action easier to identify.

**Why it matters:** current code and the approved 31 July blueprint use five tabs, while later product direction names Team, Transfers, Leagues and Settings. This is a product decision, not evidence that Fixtures is defective.

**Exact scope:** compare five-tab, contextual Fixtures and nested Fixtures wireflows; review the dormant hosted Ask affordance; prototype one honest weekly action summary while preserving every accepted capability.

**Exclusions:** model, provider, projected-rank or strategy changes.

**Risks:** hiding fixture planning, overloading Team, breaking route/back/focus behaviour or presenting projections as certainty.

**Dependencies:** real weekly usage evidence and Pritesh's explicit information-architecture choice.

**Test requirements:** routes, aliases, focus, dock, Settings and every feature entry point.

**Physical acceptance:** complete one-handed primary-navigation workflow on iPhone Safari.

**Approval gate:** approve the wireflow and exact wording before code.

## Proposed evidence checkpoint — Prospective calibration review

**Status:** after several completed Gameweeks; evaluation only.

**Objective:** assess expected points, expected minutes, captaincy, squad decisions and transfer horizons without automatic tuning.

**Exact scope:** approved metrics by relevant segment; probability reliability; frozen decision versus outcome; completed transfer horizons; provider-state comparison with existing safeguards.

**Exclusions:** automatic model updates, retrospective cherry-picking, small-sample accuracy claims and formula changes hidden inside analysis.

**Risks:** clustered samples, revised outcomes, incomplete horizons and observational provider comparisons.

**Dependencies:** enough immutable pre-deadline snapshots, complete/corrected outcomes and retained evidence.

**Test requirements:** evidence identity, schedule alignment, correction revision and deterministic export contracts.

**Physical acceptance:** review/export readability only; formula acceptance remains a separate model gate.

**Approval gate:** evidence report first. Every proposed input or formula change requires the full model approval package.

## Proposed later checkpoint — Google Sheets archive automation

**Status:** later, not approved.

**Objective:** create an idempotent downstream season archive after the manual export schema survives live use.

**Exact scope:** map existing review/export tables, append after official completion, append corrections without duplicating identities and retain manual export fallback.

**Exclusions:** Sheets as a live application database, model feedback, client-side OAuth secrets and dependency of weekly recommendations on Drive availability.

**Risks:** duplicate rows, partial writes, OAuth/token exposure, formula injection, quota failures and schema drift.

**Dependencies:** stable export schemas plus approved authentication, ownership, retention and cost design.

**Test requirements:** schema, idempotency, revision, injection, retry and fallback coverage.

**Physical acceptance:** export/sync status on iPhone and direct review of the target Sheet by Pritesh.

**Approval gate:** provider/security/cost proposal before implementation.

## Proposed later checkpoint — Cited football-news intelligence pilot

**Status:** later, shadow evaluation only unless separately promoted.

**Objective:** test whether predicted line-ups, press-conference news and non-Premier-League congestion materially improve expected-minutes decisions.

**Exact scope:** source/licensing review; provenance and freshness; player/team identity mapping; deterministic rest/congestion fields; citation-backed AI summary; prospective shadow capture and ablation.

**Exclusions:** uncited rumours, direct AI probability overrides, autonomous tuning and recommendation changes before evidence.

**Risks:** licensing, misinformation, late team-news changes, false confidence, cost and identity errors.

**Dependencies:** an approved provider/data contract and enough prospective outcomes.

**Test requirements:** schema, provenance, stale/contradiction fallback, identity mapping, ablation and reviewed golden examples.

**Physical acceptance:** explanation clarity, source visibility and degraded-state honesty if promoted into the product.

**Approval gate:** approve source and shadow evaluation first; separately approve any effect on recommendations.

**Method:** this pilot is Step 9 of the post-GW1 sequence in [External Intelligence Foundation](EXTERNAL-INTELLIGENCE-FOUNDATION.md) and must follow the contracts recorded there — provider-neutral normalisation, canonical Official FPL identity with no display-name-only matching, separate `observedAt` / `effectiveAt` / `fetchedAt` timing so post-deadline knowledge cannot leak into a pre-deadline decision, an explicit rights/retention classification and a hard `shadow_only` boundary. A predicted line-up is one piece of evidence about expected minutes, never a direct `pStart = 1/0` instruction.

## Deliberately deferred

- framework or package-manager migration;
- mass source/test/document directory moves;
- generated root/dist redesign;
- projection, scoring, fixture or simulation consolidation without numeric identity evidence;
- transfer optimiser rewrite or removal of the independent oracle;
- Mini-League migration-key removal without a deprecation plan;
- broad CSS/component abstraction;
- automatic AI tuning or unvalidated new providers;
- tactical protect/balanced/chase recommendations without a separately validated strategy model.

## Completed foundation summary

Stages 1–10.5, Teamsheet 2.0.1–2.0.7, the Official FPL gateway, exact persistent Transfers, UX-A1, UX-A2, Team populated acceptance, Fixtures populated acceptance, the Leagues pre-season checkpoint, Repository Truth A1, Safe Hygiene A2, Refresh-Load R1, A3-R0, DTR-1, iPhone form-focus zoom, Data Architecture D1 design, Atomic Foreground Refresh, the small mobile UI consistency checkpoint, A3 cache/persistence resilience, Post-A3 Checkpoint 0/0C, `fpl:calib` compatibility, A3 Error-Boundary Separation, A3 Production-Bundle Safeguards, A3 State-Ownership Cleanup, Route-Aware Rendering and Performance M1, A3-SC-1 and GW1-P1 are complete and merged. Their exact records remain in the repository history and [Historical Records](HISTORICAL_RECORDS.md); they are not open implementation work. GW1-P2 is not included in this merged-foundation list because PR #119 remains unmerged. Separately gated work above remains outside GW1-P1 and GW1-P2.


<!-- DATA-S1-2026-08-22 -->
## DATA-S1 repository foundation — 22 August 2026

The separately approved [DATA-S1 Shadow Structured Data Foundation](DATA-S1-SHADOW-STRUCTURED-DATA-FOUNDATION.md) adds the isolated, provider-neutral `teamsheet-data-platform` repository service and separate future `teamsheet-data` D1 binding. Only `shadow_only` is valid. It has no production/browser/model/Provider Health read path, no new R2, no provider activation and no Google Sheets integration; existing Stage 10 D1/R2 custody remains separate and unchanged. No live infrastructure was created or modified. PR #145 is merged and repository-verified, but DATA-S1 remains **not live deployed**. DATA-S1A is the current control reconciliation. The separately owner-gated sequence is DATA-S1B live Cloudflare preflight/deployment/acceptance, DATA-S2 Official FPL structured history, DATA-S3 automated Official outcomes, DATA-S4 provider trials/evaluation, DATA-S5 downstream Sheets automation, then later explicit production/model gates. See the [DATA-S1B plan](DATA-S1B-LIVE-DEPLOYMENT-ACCEPTANCE-PLAN.md).

Effective **22 August 2026**, the owner superseded the blanket £0 recurring-cost constraint: free remains preferred where comparable, while a small paid provider may be considered only with explicit pricing, rights and value/cost justification, preferably after a shadow trial. This approves no provider and does not rewrite historical research conducted under the former constraint.

## DI-4 repository implementation (29 August 2026)

DI-4 Weekly Decision Synthesis is repository-side review-ready: a deterministic artifact-only read model and Team surface cover complete, partial and unavailable states with permanent parity/isolation/mobile tests. Physical iPhone Safari acceptance remains pending, so DI-4 is not fully complete. No work beyond DI-4 is approved.
# EIA-1 checkpoint (30 August 2026)

EIA-1 adds offline real-evidence adapters and a provider-neutral workload contract without production use. TheSportsDB qualification fails for expected-minutes workload evidence; workload evaluation remains not yet evaluable. See [EIA-1](EXTERNAL-INTELLIGENCE-EIA1-XMINS-EVIDENCE.md).

## DATA-S2B-E2A repository validation candidate

E2A is the repository-only machinery checkpoint after E1: deterministic synthetic REST plans, production/network firewalls, no-retry outcome classification and sanitized evidence. No live D1 experiment or Cloudflare action is included. The next possible checkpoint is E2B investigation/design only after E2A review/merge and separate explicit owner approval; E2C/E2D remain unapproved.

<!-- DATA-S2B-E2C-A-2026-09-01 -->
### DATA-S2B E2C-A repository-only live-validation contract

E2C-A adds inert, fail-closed disposable-D1 experiment plans, an identity-bound authentic-plan-only HTTP adapter, a strict Cloudflare-shaped response decoder, pre-mutation exact metadata and clean-INITIAL-schema gates, closed post-setup object-set plus semantic-schema enforcement, closed adapter-to-orchestrator composition, quote-aware CHECK canonicalisation, response/state-paired atomicity acceptance, reconcile-then-stop mutation ambiguity handling, W00/W01 reconciliation and strictly bounded sanitized evidence including canonical UTC timestamps. It performs no Cloudflare request and proves no live atomicity, parameter affinity or request-size behaviour. Any live experiment, credential, resource, workflow/environment, cleanup or production decision remains separately owner-approved. See [E2C-A record](../workers/data-platform/DATA-S2B-E2C-A-LIVE-VALIDATION-CONTRACT.md).

<!-- DATA-S2B-E2C-B-2026-09-01 -->
## DATA-S2B E2C-B repository-only preparation

E2C-B hardens the disposable live boundary with mandatory production-account separation, exact returned-value affinity/storage semantics, missing-versus-zero bounded provider metadata, sanitized evidence and a manual exact-main/exact-Verify protected workflow that rejects reruns and never cleans up. No live action occurred; preparation, execution, acceptance and manual cleanup remain separate owner gates. See [E2C-B implementation record](../workers/data-platform/DATA-S2B-E2C-B-DISPOSABLE-LIVE-EXPERIMENT-PREPARATION.md).
