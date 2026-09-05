# PROJECT_CONTEXT.md

<!-- DATA-S2B-CAPACITY-ENVELOPE-RESTORATION-2026-09-05 -->
## Current DATA-S2B checkpoint — production capacity envelope restored (repository only)

**FACT: the 5 September integrity question is closed.** Workflow `DATA-S2B Committed Run Integrity`
(workflow `350897195`), run `33966125991`, run number 1, attempt 1, event `workflow_dispatch`, head
`main` `bfcac663f4bfb02274843caa8d4332d8622f68d7`, conclusion **success**, both `repository-gate`
and `committed-run-integrity` succeeding. That runner rethrows for every classification other than
`COMMITTED_STATE_VALID`, so its success proves the state scheduled run `33948145320` committed
satisfies the existing production postflight contract. It was read-only: one D1 call,
`rows_written` required to be exactly zero, `mutationIssued: false`. **This checkpoint is capacity
only; corruption and repair are not reopened.**

**FACT: the previous 125,000 envelope was operationally too tight.** Under the corrected
conservative model merged in PR #223, the pre-mutation projection at the governed population run
`33948145320` left behind returns **132,015** for a 264-change cycle, and stays above 125,000 even
with **no changed observations at all**. The predictive gate would therefore have refused every
realistic cycle before mutation. A threshold that refuses everything protects nothing.

**DECISION — Package A, capacity envelope only.** Three distinct thresholds replace the superseded
pair of 100,000 expected / 125,000 hard, and the predictive gate no longer compares against the
hard ceiling:

| | Constant | Value | Input | Blocking |
|---|---|---|---|---|
| EXPECTED | `EXPECTED_D1_ROWS_READ_PER_CYCLE` | 150,000 | projection, structural total, final actual rows | **No** — classifies only |
| SOFT | `SOFT_D1_ROWS_READ_PER_CYCLE` | 200,000 | amplified provider projection, once, before the start mutation | **Yes** — `production_projected_read_budget_exceeded`, `mutation = none` |
| HARD | `MAX_D1_ROWS_READ_PER_CYCLE` | 250,000 | Cloudflare's returned `meta.rows_read`, after every call | **Yes** — `production_d1_budget_exceeded` |

**RATIONALE.** The order is the justification: PR #223 corrected the dishonest estimator **first**,
and only then was the envelope resized — raising a ceiling behind an estimator that under-predicted
by 31% would have been permission to overrun further. The soft refusal now happens before any
mutation and writes nothing; the hard breaker remains independent and based on actual provider
accounting; the 25% gap between them absorbs a projection error five times larger than the one
observed on the only measured sample, which is what removes the failure mode run `33948145320` hit.
At 250,000 the internal breaker is **5.0%** of the Cloudflare Workers Free daily allowance of
5,000,000 rows read for the one approved cycle a day, so it stays far tighter than the provider
quota. No SQL, schema or index change is justified before live per-statement telemetry exists.

The closed planning enum keeps two members: `hard_ceiling_headroom` is renamed `above_expected`,
because a name promising headroom against one named ceiling is false at the two call sites that
measure against a different one. Bounded telemetry now carries `rowsReadExpected`, `rowsReadSoft`
and `rowsReadHard` explicitly.

**Nothing else moved.** No SQL, no query plan, no `EXPLAIN` contract, no migration (still exactly
0001–0003, five indexes, **no migration 0004**), no index, no schema, no data semantics, no
postflight weakening. `PROVIDER_READ_AMPLIFICATION = 1.35`, `PROVIDER_READ_SAFETY_RESERVE = 2000`,
the mutation-read and write estimators, the 40,000 write ceiling, the 8-call API ceiling and the
`17 1 * * *` cron are all unchanged, and the scheduled workflow remains **owner-disabled**.

**Nothing was executed.** No Cloudflare request, D1 read, D1 mutation, workflow dispatch, Stage 0
re-run, collection, migration, deployment, cron, schedule, environment or credential change was
performed.

**LIMITATIONS.** This restores an operating envelope; it is **not** proof that production
collection works, and no cycle has run under it. 1.35 and 2,000 remain INFERRED from one sample. No
season-long capacity guarantee is claimed — the structural model carries a `2H` term over an
append-only history, and the average changed-observation count per collection has exactly one
measurement. GitHub schedule-delivery lateness remains a separate matter.

Next gates, each separate: **(1)** owner review and merge; **(2)** exact-`main` Verify; **(3)** a
separate owner approval for exactly **one** attended manual production collection while the
scheduler stays disabled, whose per-call telemetry replaces the inferred factors with measured
ones. Scheduler re-enable and any schema change remain later, separate gates. See
[capacity envelope restoration](../workers/data-platform/DATA-S2B-CAPACITY-ENVELOPE-RESTORATION.md).

<!-- DATA-S2B-READ-BUDGET-REMEDIATION-2026-09-05 -->
## Current DATA-S2B checkpoint — read-budget remediation P2+ (repository only)

> **Superseded in its forward-looking part by the capacity checkpoint above.** Its recorded
> evidence stands and its model corrections are unchanged. Two of its statements are no longer
> current: the committed state it describes as unproven **has since been proved valid** by Stage 0
> run `33966125991`, and the 125,000 hard ceiling it holds unchanged **has since been resized** to
> the three-threshold envelope of 150,000 expected / 200,000 soft / 250,000 hard. Where it says the
> corrected projection exceeds 125,000 and the soft gate would refuse, that remains an accurate
> statement about the superseded envelope and is the evidence the resize rests on.


**The first natural run on the permanent cadence failed on resource enforcement.** Run
`33948145320`, event `schedule`, attempt 1, head `main`
`9a1c6a87e17de08ed2c5b650b05cdc3eab96291c`, verified independently from the GitHub Actions API.
GitHub created it at `2026-09-05T05:48:05Z` against a 01:17 UTC nominal minute — approximately
**4h31m** of schedule-event **delivery** delay, upstream of the workflow, with no proven cause and
never a collection delay. `repository-gate` succeeded. The commit mutation **completed**
(`productionMutation: 'definite_completed'`) and its accounting passed the hard enforcement check.
The postflight D1 read **was issued and returned**; its returned provider accounting took the
cumulative total past the internal hard read envelope, `enforce()` threw
`production_d1_budget_exceeded` in phase `postflight_read`, and `validateProductionPostflight()` was
never reached. **The postflight read ran; postflight validation did not.** The state that run
committed therefore **remains unproven** — an absence of proof, not evidence that it is invalid or
corrupt. The owner then disabled the scheduled workflow; GitHub reports it `disabled_manually` and
it must remain disabled.

**PR #223 is repository-only remediation.** No Cloudflare request, workflow dispatch, D1 read or
mutation, collection, migration, deployment, schedule, cron, environment or credential change was
performed. It corrects the pre-mutation read projection (explicit mutation-read estimator; a
conservative INFERRED provider amplification and reserve; a predictive soft gate separated from the
unchanged hard circuit breaker), adds bounded sanitized per-call resource telemetry, and re-plans
current-head retrieval from O(H) to O(N) with an identical row set and a strictly tightened EXPLAIN
contract.

**Stage 3 / O(N) alone does not restore collection capability.** At the analysed population it
saves only `3(H − N) = 1,446` structural rows; its value is removing the term that grows without
bound. Under the analysed population and change assumptions the corrected projection exceeds
125,000, so the soft gate would refuse before mutation rather than commit and then fail. **The
125,000 ceiling is unchanged**, no migration 0004 was created and no covering index was added.

A strictly read-only committed-run integrity workflow now exists to answer whether the committed
state satisfies the existing production postflight contract. **It has NOT been dispatched.**

Next gates, each separate: **(1)** owner review and merge of PR #223; **(2)** exact-`main` Verify;
**(3)** separate owner approval for one committed-run integrity dispatch. Collection, scheduler
re-enable and any schema change remain later, separate gates. See
[read-budget remediation](../workers/data-platform/DATA-S2B-READ-BUDGET-REMEDIATION.md).

<!-- DATA-S2B-MANUAL-COLLECTION-HARDENING-2026-09-03 -->
## Current DATA-S2B checkpoint — manual collection hardening; first production run completed

The originally unresolved first production collection run is **completed**. Owner-dispatched
read-only reconciliation run `33792104384` and first-run resume run `33815400284`, both attempt 1
on exact `main` `d79dd37451e16b642ce96709b8635c3ac618c366`, each succeeded and were verified
independently from the GitHub Actions API; the reconciliation entry point exits zero only on
`RESUME_RECONCILIATION_SAFE` and the resume returns only after synchronous postflight proves the
exact completed run. Exact provider `rows_read`/`rows_written` for those runs are **unavailable**
— they reach only the GitHub Step Summary — and Cloudflare dashboard aggregates are account-level
figures, never per-workflow accounting.

This checkpoint brings the manual normal production collection workflow to the hardened
migration-0003 / EXPLAIN / reconciliation / resume trust boundary: one immutable `approved_sha`, a
credential-free repository gate proving event, repository, ref, exact checkout, clean tree, fresh
remote `main` and exact-head Verify success, then a protected job that re-resolves remote `main`
in the same shell as the runner and fixes the one attempt's collection identity there. No
collector semantic, provider, schema, migration, model or recommendation behaviour changes, no
ceiling moves, and no production action was performed. Scheduling stays disabled and Cloudflare
Cron stays intentionally absent. Its next live gate — exactly one separately approved manual
production collection after merge and exact-`main` Verify — is **closed and was passed**: that
collection ran as run `33818972728`. Recurring scheduling was separately approved and implemented
afterwards, and the current position is the checkpoint above. See
[manual collection hardening](../workers/data-platform/DATA-S2B-MANUAL-COLLECTION-HARDENING.md).

<!-- DECISION-INTELLIGENCE-DI1-2026-08-29 -->
## Current Decision Intelligence checkpoint — DI-1 review candidate

DI-1 adds isolated, zero-dependency contracts for future shadow observations and candidates. The implementation validates canonical Official FPL identity, distinct publication/effective/observation/fetch/expiry clocks, provenance, quality/conflict state, fail-closed rights, signal/version metadata and exact scope-specific production approvals. The repository contains neither a registered real candidate nor a production approval. Its shadow repository deliberately has no production-read operation, and permanent structural tests prohibit Decision Intelligence imports from production model/provider/state/build paths. This checkpoint changes no provider, collector, DATA-S2B/D1/Cloudflare asset, Stage 10 semantic, Provider Health row, product surface or recommendation.

<!-- DATA-S2B-PHASE4B-LATEST-INHERITANCE-REMEDIATION-2026-08-28 -->
## Current repository checkpoint — Phase 4B binding-inheritance remediation

Live inactive-Version-upload run `33186084206` reached its sole `POST .../versions?bindings_inherit=strict` request on exact `main` `035e5fa768e47bee8548df9a39e9e629c811eea5`, then failed without retry or a successful Version ID: Cloudflare returned HTTP 400 / `CF_10057` because explicit UUID `version_id` values for inherited `TEAMSHEET_DATA_DB` and `DATA_S1_HTTP_AUTH_TOKEN` are unsupported by this live upload endpoint, which requires literal `latest`. Fresh mutation-free reconciliation run `33186488030` passed on that same SHA: the expected production Version remained latest and solely active at 100%, rollback remained present, and hostname/Cron/D1/health state remained expected. No newer deployable Version from the rejected request was observed; the read-only check does not assert an exhaustive total of hidden or non-deployable history.

The repository-only remediation uses `latest` strictly as required transport syntax. Immediately before the one POST, the helper rechecks that latest equals the exact expected active Version and retains the rollback anchor. After definite success it requires one and only one new, newest deployable Version matching the response ID, validates resolved D1/secret/season/compatibility state, and re-proves unchanged production, Cron, D1, hostname and health. An unexpected delta blocks Deployment. This narrows and detects observable concurrency drift but is not an atomic UUID pin: a residual race remains between the final read and Cloudflare resolving `latest`, so the guarded manual operation assumes no concurrent authorized Version creation. Ambiguous outcomes are never retried and require separate read-only reconciliation.

This remediation has not been exercised live and authorizes no second upload. Next is owner review and merge approval; after merge and exact-main verification, one new explicit approval is required for one inactive upload attempt. Deployment, traffic change, Cron activation and collector execution remain separately unapproved.


<!-- DATA-S2B-PHASE4B-UPLOAD-ENVIRONMENT-CANDIDATE-2026-08-28 -->
## Current repository checkpoint — Phase 4B inactive-Version-upload environment correction

The mutation-free live preflight now **passes**. Run `33173358713` succeeded on exact `main` `e45828ad34273eb71d7d6ae928e0931c30b4e95f` under the Phase 3 deployment environment, which supplied all five required credentials populated and masked. It reconciled fresh live state — active Version `3a2b065a-6527-4887-9bf8-b08e82e81133`, rollback Version `5edbe951-4be4-46bc-b2cf-17b550396105` present, sole active Version at 100%, hostname `data.fpltsheet.co.uk`, compatibility date `2026-08-22`, season `2026-27`, Cron absent, valid Phase 1 D1 governance, zero history counts, D1 size `151552` bytes and authenticated `shadow_only` health — and performed no mutation.

The standalone inactive-Version-upload workflow still referenced the Phase 2 upload environment and its upload-token secret. Live run `33171701995` had already disproved that pairing: under `data-s2b-phase2-version-upload` with the upload-token secret, `DATA_S1_HTTP_AUTH_TOKEN`, `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` were empty, so a dispatch could only have failed closed before reaching its upload step. This narrow correction moves that job to the evidence-backed `data-s2b-phase3-deployment` and maps its existing deploy-token secret into the upload helper's unchanged token variable. `phase4b/upload-version.mjs` is unchanged, and its single permitted mutation remains exactly `POST .../versions?bindings_inherit=strict`, with no Deployment, Cron, Access, secret, route/domain or D1-write path.

This change performs no live upload. The owner has approved one inactive Version upload only; execution stays blocked until this correction merges, exact-main CI passes and the merged workflow is dispatched against that exact `main` SHA. No Version has been uploaded, and Deployment, Cron activation and collector execution remain unapproved.

<!-- DATA-S2B-PHASE4B-REPOSITORY-CANDIDATE-2026-08-28 -->
## Current repository checkpoint — DATA-S2B Phase 4B repository preparation

Phase 4B adds separate manual, protected, fail-closed preparation paths for a future inactive Worker Version upload and a later exact-Version 100% Deployment. Explicit endpoint allowlists separate `/versions` from `/deployments`; neither path can intentionally write Schedules/Cron, D1, routes/domains, Access or secrets, and neither runs the collector. Historical Phase 2/3 tooling remains frozen. This is repository evidence only: no live Cloudflare action is authorized or claimed. See [Phase 4B preparation](../workers/data-platform/DATA-S2B-PHASE-4B-VERSION-DEPLOYMENT-PREPARATION.md).

<!-- DATA-S2B-PHASE3-LIVE-CLOSEOUT-2026-08-28 -->
## Current repository checkpoint — DATA-S2B Phase 3 live deployment PASS

**Supersedes the Phase 3 repository-gate and Phase 2 present-tense checkpoints below while preserving their design and evidence as history.** Manual protected workflow run `33142804502` (#4) completed success on exact `main` SHA `d48913332bf5df37b29d98b06579f369f338f6e4`. Existing candidate `3a2b065a-6527-4887-9bf8-b08e82e81133` became the sole active Worker Version at 100%. Previous production Version `5edbe951-4be4-46bc-b2cf-17b550396105` remains the rollback target; rollback was not required. Exactly one candidate Deployment mutation was submitted, authenticated health and all approved postflight invariants passed, Version History remained unchanged, and the workflow performed no Version upload or Cron/D1/route/domain/Access/secret mutation.

Sanitized manual remediation before the successful run replaced an Access credential pair that Cloudflare had not recognized, cut the existing Service Auth policy over to the replacement service token, and identified the working retained Worker bearer. Those prior manual authentication changes are separate from the workflow's mutation accounting, and obsolete-credential cleanup is not claimed. The detailed authority is [Phase 3 live closeout](../workers/data-platform/DATA-S2B-PHASE-3-LIVE-CLOSEOUT.md); the historical security/design authority remains [Phase 3 deployment gating](../workers/data-platform/DATA-S2B-PHASE-3-DEPLOYMENT-GATING.md). Phase 4 Cron activation/collection and every provider, application or model change remain unapproved.

<!-- DATA-S2B-PHASE2-POSTFLIGHT-2026-08-27 -->
## Current repository checkpoint — DATA-S2B Phase 2 live closeout PASS

**Supersedes the older present-tense DATA-S2A / DATA-S2B Phase 0 and Phase 1 wording below while preserving those dated records as historical evidence.** DATA-S2B Phase 0 live read-only preflight is complete PASS (`32996481967`), and Phase 1 migration 0002 is complete PASS (`33011334466`). The approved Official FPL governance/schema state exists in live `teamsheet-data`.

Phase 2 attempt #3 (`33050859823`) successfully created inactive Worker Version `3a2b065a-6527-4887-9bf8-b08e82e81133`. Its postflight red result was a false failure because `GET /workers/scripts/{script}/settings` was incorrectly treated as proof of the separately active deployment's bindings after the newer inactive Version existed. PR #170 corrected the authority to Deployments plus exact Version Detail, merged, and exact-main Verify Teamsheet run `33074154222` passed on `2176a3dd29562fecff10614b689ed99a06db6bfa`.

Phase 2 read-only closeout run `33088512116` is **PASS**. Production remained on deployment `10f7a065-3d82-4b34-9fb1-dc6c3a0be524` and active version `5edbe951-4be4-46bc-b2cf-17b550396105`; the Phase 2 version remained inactive. Exact Version Detail reconciled active and candidate bindings, Cron remained empty, Phase 1 D1 governance/count state remained exact, collection/history counts remained zero, and D1 size remained exactly `151552` bytes and stable across the bounded read. Accidental upload run `33088187544` was cancelled before its protected mutation-capable job was released and created no new Worker Version. The detailed authority is [DATA-S2B Phase 2 Live Read-Only Closeout](../workers/data-platform/DATA-S2B-PHASE-2-LIVE-CLOSEOUT.md).

Phase 2 PASS records an independently reconciled inactive candidate; it is not production deployment or production acceptance. The next checkpoint after this documentation closeout is Phase 3 investigation/design only. Phase 3 deployment requires a new explicit owner approval, and Phase 4 Cron activation/collection remains separately unapproved. No deploy/promote/split/delete, collector run, D1 write, Access/secret change, provider/data-source change, application behaviour change or model/calculation change is authorized here.

<!-- DATA-S2B-PHASE0-CANDIDATE-2026-08-26 -->
## Current repository checkpoint — DATA-S2B Phase 0 read-only candidate

The repository contains a manual-only, fail-closed DATA-S2B Phase 0 read-only GitHub Action candidate. It gates a 40-character lowercase approved SHA against exact current remote `main`, a clean checkout and successful exact-head Verify Teamsheet before the protected Cloudflare environment can expose credentials. Fixed audited D1 `SELECT` queries and Workers/D1 REST reads then inspect pre-mutation state; permanent tests prohibit executable mutation commands, arbitrary SQL and unsafe output. The candidate has **not** been executed with Cloudflare credentials and proves no live account state. Environment/secret setup and the first live read each require separate explicit owner approval. See [DATA-S2B Phase 0 implementation](../workers/data-platform/DATA-S2B-PHASE-0-READ-ONLY-IMPLEMENTATION.md).

<!-- DATA-S2A-CURRENT-2026-08-26 -->
## Current repository checkpoint — DATA-S2A merged; DATA-S2B live acceptance next

**Supersedes older present-tense DATA-S1C/DATA-S1B status below while preserving its dated evidence.** DATA-S1C-R retired Service Binding/RPC and custom bearer-HTTP as forward defaults after functional RPC acceptance failed. The forward data architecture is the stable isolated Worker/D1 boundary; retained RPC/HTTP assets are historical and rollback evidence, not the collection direction.

DATA-S2A is merged through PR #160 and repository-verified on its exact merge commit. Its repository-only, `shadow_only` implementation validates fixed Official FPL `bootstrap-static` and `fixtures` inputs and preserves allowlisted event, team, player and fixture changes as append-only D1 observations with atomic current heads. It neither replaces Teamsheet's existing live Official FPL gateway nor creates a runtime/model dependency. It remains live-unaccepted: it has not been deployed, has not mutated live D1 and has not activated its declared hourly Cron.

DATA-S2B is next and begins with a mutation-free Phase 0 live preflight. Live migration, Worker version upload/deployment and Cron activation remain separate explicit owner-approval gates, followed by real-baseline, unchanged-cycle, changed-fact, D1-accounting, Workers Free CPU and rollback/stop evidence. No DATA-S2B mutation or production-use approval follows from DATA-S2A.

<!-- DATA-S1C-CURRENT-2026-08-25 -->
## Current repository checkpoint — DATA-S1C private Service Binding + RPC candidate

**Supersedes the older DATA-S1B preflight current-state wording below.** Live handover evidence records the production `teamsheet-data-platform` Worker, `teamsheet-data` D1, `TEAMSHEET_DATA_DB` binding and `data.fpltsheet.co.uk` Custom Domain as existing, with Access still the proven outer protection. This repository-only candidate adds split named read/ingest RPC entrypoints over the shared DATA-S1 operations and a private read-only acceptance caller with no D1. Its candidate baseline is **993 tests passed, 0 failed, 0 skipped, 0 cancelled** plus deterministic build/provenance/identity gates. It performs and proves no live Cloudflare change. See [DATA-S1C private Service Binding and RPC architecture](DATA-S1C-PRIVATE-SERVICE-BINDING-RPC.md).

<!-- DATA-S1B-PREFLIGHT-CURRENT-2026-08-23 -->
## Current repository checkpoint — DATA-S1B mutation-free preflight PASS

The delivered GW1 readiness checkpoint remains PR #121; it is retained as application evidence and is not superseded as product behaviour by DATA-S1.

**Supersedes older current-state evidence-stream and DATA-S1A wording below.** The DATA-S1B mutation-free live preflight is complete and **PASS**; its final phase-gated procedure is the [DATA-S1B Final Preflight and Deployment Runbook](DATA-S1B-FINAL-PREFLIGHT-AND-DEPLOYMENT-RUNBOOK.md). DATA-S1 remains **NOT LIVE DEPLOYED**. This checkpoint created no DATA-S1 Worker, production or validation D1, migration, Access configuration, service token, DNS/Custom Domain, route or production binding. Owner evidence records **Workers Free — Active**, current/projected billable usage **$0.00**, and a hard requirement to remain within Workers Free/D1 Free limits and stop rather than upgrade.

The reviewed PR #147 candidate baseline is **986 tests passed, 0 failed, 0 skipped, 0 cancelled**, plus deterministic build/provenance gates and exact-head Verify Teamsheet. Merge authorizes **no Cloudflare mutation**. After merge, re-read latest GitHub `main` and require Verify Teamsheet on the exact merge commit; only then may the owner consider the separately gated **Phase 2 disposable D1 validation**. DATA-S2 remains blocked until DATA-S1B live deployment/acceptance fully closes. No model, provider, fixture, captaincy, squad, transfer, simulation, rank, Mini-League or application behaviour changed.

<!-- GW1-P2C5-CURRENT-2026-08-22 -->
## Historical evidence-path checkpoint — 22 August 2026

GW1-P2C5 passes the production Stage 10 infrastructure path for one unmistakably synthetic `2099-00`/GW38 fixture. Physical iPhone Safari reached terminal `Archived`; exact read-only D1/R2 reconciliation found one accepted receipt, one matching manifest and one exact R2 object with consistent identity, size, stored SHA-256 and R2-first/D1-second timestamps. The temporary candidate was removed by restoring Pages to authoritative `main`, and PR #143 was closed unmerged. This does not prove natural capture, genuine prospective custody or Official eligibility; natural GW2 observation remains a separate gate. See [GW1-P2C5 closeout](GW1-P2C5-STAGE10-PRODUCTION-PATH-ACCEPTANCE-CLOSEOUT.md).

<!-- GW1-P2C3B-CURRENT-2026-08-22 -->
## Historical transport checkpoint — 22 August 2026

GW1-P2C3B closes the sibling-domain **browser transport** gate as PASS. On a real physical iPhone in normal Safari with Prevent Cross-Site Tracking ON, the authenticated `app.fpltsheet.co.uk` → `archive.fpltsheet.co.uk` invocation directly showed `Sec-Fetch-Site: same-site`; OPTIONS returned 204, its matching deliberately invalid `{}` POST returned 422, and Safari read `{"error":"envelope_schema"}`. This supersedes older current-state wording below that calls deployment or physical same-site transport acceptance pending.

The boundary is strict: no genuine Stage 10 record was submitted, and genuine evidence custody, valid archival, D1/R2 persistence, idempotency and duplicate handling remain unproven. Literal physical ACAO, ACAC and `Vary` response values were not directly captured. Rollback origins, hostnames, Access protection and deployments remain retained. See [GW1-P2C3B Same-site transport closeout](GW1-P2C3B-SAME-SITE-TRANSPORT-CLOSEOUT.md).


<!-- GW1-P2C2-CURRENT-2026-08-21 -->
## Historical transport checkpoint — 21 August 2026

The previously pending GW1-P2 physical cross-site acceptance has now produced **Outcome B**: on iPhone Safari with normal privacy settings, the PR #137 CORS-remediated credentialled OPTIONS request reached the evidence Worker and returned 204, while the POST did not reach the Worker and exposed no HTTP status to Teamsheet. This closes further Option A (`github.io` → `workers.dev`) tweaking as the chosen path without attributing the remaining failure to one unproven browser or Access mechanism.

GW1-P2C2 is the approved **repository-only** preparation for sibling hosts `app.fpltsheet.co.uk` and `archive.fpltsheet.co.uk`. Draft PR #139 carries the durable browser evidence outbox/delivery semantics forward, changes only the browser/archive transport boundary, retains exact CORS, and leaves recommendation/model/provider behaviour untouched. The custom domains are **not live** in this repository checkpoint; existing production hosting remains authoritative until separately approved infrastructure rollout and physical acceptance.


Purpose: current product and engineering state. Audience: every session after `CLAUDE.md`. Last reconciled: 12 August 2026.

Related: [Architecture](ARCHITECTURE.md), [Decisions](DECISIONS.md), [Roadmap](ROADMAP.md), [Known Limitations](KNOWN_LIMITATIONS.md), [Teamsheet 2.0 Product Blueprint](TEAMSHEET2-PRODUCT-BLUEPRINT.md), [Data Architecture D1](DATA-ARCHITECTURE-D1.md), [GW1-P1 Cloudflare Evidence Foundation](GW1-P1-CLOUDFLARE-EVIDENCE-FOUNDATION.md), [GW1-P2 Browser evidence delivery](GW1-P2-BROWSER-EVIDENCE-DELIVERY.md), [External Intelligence Foundation](EXTERNAL-INTELLIGENCE-FOUNDATION.md), [Historical Records](HISTORICAL_RECORDS.md).

## Canonical current state

Live GitHub is authoritative over this document and all historical handovers. This section describes the tree it lives in and deliberately does not restate the current `main` commit SHA — that changes on every merge and duplicating it here is how this documentation went stale before. Read it live with `git rev-parse origin/main`, and read live pull-request state from GitHub.

**Reviewed repository candidate baseline: 986 tests, 986 passed, 0 failed, 0 skipped, 0 cancelled**, with deterministic byte-identical production builds, root/deployable equality, exact build identity, verified committed build provenance and exact-head Verify Teamsheet. Post-merge `main` must separately pass the same gate on its exact merge commit. Earlier counts (985, 971, 940, 918, 907, 904, 898, 883, 868, 864, 856, …) remain historical checkpoint evidence and are not current claims.

### Application — ready for GW1

The most recent application checkpoint is **GW1 readiness — pre-deadline Transfers safety guard**, delivered on **PR #121** from `agent/gw1-readiness-safety-guard`. Before the first Official FPL deadline of a season the Transfers screen suppresses the weekly free-transfer/hit optimiser and states that initial squad changes are unlimited, pointing the manager at Team and the Team-setup manual squad builder. The window is derived only from verified Official FPL event data; the deadline instant, later Gameweeks and any missing or unparseable deadline all restore normal weekly behaviour. **No optimiser mathematics changed.**

**Pritesh physically accepted it on iPhone Safari** at the exact candidate head `f72023043813566fe8b11da2d959e374d34bca39`, which passed Verify Teamsheet #262 / `31583716004` on the then-current 898-test baseline. GitHub Pages was pointed at the branch for that acceptance and then restored to `main`, each observed built (Pages #126 branch, **#127 `main`**).

The GW1 readiness audit that preceded PR #121 concluded **go with conditions**: **zero blockers** and two should-fix items, both addressed by PR #121. The application is suitable for GW1 subject only to the separate live-only gates recorded below. Readiness work authorised **no** model, provider, fixture, expected-minutes, scoring, squad, captaincy, transfer, optimiser, simulation, rank or Mini-League change, and none was made. See [GW1 readiness safety guard](GW1-READINESS-SAFETY-GUARD.md).

### Historical cloud evidence custody stream before C5 closeout

> **Superseded historical record:** C5 later closed this stream. The dates, candidate state and actions below are retained only as checkpoint evidence, not present-tense instructions. The DATA-S1 current section at the top is authoritative.

**GW1-P2 — Browser Evidence Delivery + Durable Outbox** is an implemented candidate on draft PR #119, branch `claude/gw1-p2-evidence-delivery-design-ejsb0d`, exact head `252c5eba0381c8aa5afb7bda1686dd102326c6df`. Verify Teamsheet #255 / `31537859087` passed on that head with **931/931 tests**, no failures/skips/cancellations, deterministic production build and provenance/build-identity gates.

GW1-P2 is implementation-complete as a candidate but **acceptance-incomplete**. It remains draft and unmerged, and **it is not a GW1 blocker**: cloud custody is a one-way side effect and the recommendation path never reads, waits for or fails because of the archive. Until PR #119 is accepted and merged, **local Stage 10 capture, recovery and owner-controlled export remain the operating pre-deadline evidence path**; that fallback is complete and merged.

### Owner-performed live acceptance preparation

Recorded physical iPhone Safari / live Cloudflare preparation proves only these paths:

- Cloudflare Access `Bypass OPTIONS requests to origin` was enabled and saved for `teamsheet-evidence-archive`.
- No Access-layer allowed-origin response was configured; the Worker remains the sole owner of exact-origin CORS.
- GitHub Pages was temporarily served from the PR #119 branch and observed built, then restored to `main` and observed built.
- Settings → Evidence showed the expected pre-window state: evidence not due, no saved snapshots and `Nothing waiting`.
- current Teamsheet-owned data was approximately **546.2 KB** in that session.
- top-level Safari Cloudflare Access authentication succeeded.
- protected `GET /v1/health` returned `{"ok":true,"archiveVersion":"1.0.0","schemaVersion":"1.0.0","migrationVersion":1}`.

This does **not** prove the decisive cross-site application transport. The browser storage estimate shown during the session is not a usable quota guarantee.

### Historical GW1-P2 gate — subsequently closed

The genuine Stage 10 window opens **20 August 2026 at 18:30 BST**. The remaining acceptance question is whether normal physical iPhone Safari, with **Prevent Cross-Site Tracking ON**, can automatically perform the credentialled cross-site background upload from GitHub Pages to the Access-protected evidence Worker, then retain correct archive/reload/idempotency/canonical-hash behaviour.

If Option A fails under normal Safari privacy settings, stop. Do not make disabling Prevent Cross-Site Tracking a product requirement and do not implement Option B or Option C without a separate evidence-led comparison and explicit approval.

### External intelligence planning — documentation only, changes nothing

[External Intelligence Foundation](EXTERNAL-INTELLIGENCE-FOUNDATION.md) is the canonical forward record for external football information. It **approves nothing** and changes no behaviour: no provider, endpoint, API key, acquisition cadence, retention right, weighting, model, expected-minutes, fixture, squad, captaincy, transfer, optimiser, simulation, rank or Mini-League change follows from it, and it does not alter the pre-GW1 freeze. `APPROVED_PROVIDER_NAMES` remains exactly `fpl`, `understat`, `odds`, `archive`.

It records the current production model/data map; the layer separation between structural strength, recent performance, market expectation, availability/expected minutes, calendar/workload, set-piece and role, matchup microstats, transfer economics and competitive strategy; a provider-neutral observation contract with first-class `observedAt` / `effectiveAt` / `fetchedAt` timing, canonical Official FPL identity and explicit rights/retention classification; a hard `shadow_only` boundary with no path from shadow storage into projection or recommendation; dated free-source research; double-counting controls; and a pre-registered ablation method. Its external pricing, terms and coverage research is dated 12 August 2026 and must be re-verified from first-party sources before any implementation approval.

One conclusion is operationally relevant now: current Stage 10 already preserves the normalised Odds inputs that actually affected a prediction when Odds is healthy, so the primary market-layer on/off ablation is supported by capture and export alone and needs no pre-GW1 code. Raw bookmaker prices and intraday line movement are **not** preserved and are not reconstructible on the free tier; that lost optionality does not justify breaking the freeze.

## Historical pre-C5 immediate sequence

Completed:

1. Canonical documentation reconciliation — merged through PR #120.
2. **GW1 Readiness Audit — investigation only**. Concluded *go with conditions*: zero blockers, two items to fix before GW1.
3. **GW1 readiness safety guard** — the approved narrow fix for those two items, delivered on PR #121 and physically accepted on iPhone Safari.

Immediate operating state and what follows:

4. **Pre-GW1 code freeze and operational rehearsal.** Only separately approved fixes.
5. Operate GW1 and collect prospective evidence.
6. Live GW1-P2 acceptance when the real Stage 10 window opens on 20 August 2026 at 18:30 BST — a separate gating stream, not a GW1 blocker.
7. Evidence-led review at the GW5 → GW6 international break.

The next work is **not** post-GW1 model or provider enhancement. Every such change remains separately approval-gated and evidence-led.

The first relevant 2026/27 international break is **GW5 → GW6**, not GW2 → GW3. Treat GW1–GW5 as the initial stability/prospective-evidence period and the GW5 → GW6 break as the first major evidence-led review opportunity, subject to evidence actually available. This planning correction does not authorise model/provider changes.

## Outcome

Teamsheet is a strongly verified FPL decision product. The complete Teamsheet 2.0 migration, owner-controlled Official FPL gateway, exact persistent Transfers work, Team, Player Detail, Fixtures, Leagues pre-season acceptance, Repository Truth A1, Safe Hygiene A2, Refresh-Load R1, Audit A3, A3-R0, DTR-1, the iPhone form-focus zoom correction, the Data Architecture D1 design closeout, Atomic Foreground Refresh, the small mobile UI consistency checkpoint, A3 cache and persistence resilience, Post-A3 Checkpoint 0/0C, `fpl:calib` compatibility, A3 Error-Boundary Separation, A3 Production-Bundle Safeguards, A3 State-Ownership Cleanup, Route-Aware M1, A3-SC-1 and **GW1-P1** are merged. A3 engineering remediation and documentation closeout are complete, and GW1 readiness remediation is complete through PR #121.

**Historical status at that checkpoint: GW1-P2 was the unmerged application candidate.** It connects the existing Stage 10 browser capture path to the merged GW1-P1 backend and does not change the deterministic recommendation path. Until GW1-P2 passes its physical acceptance and is merged, a normal Teamsheet browser session does not automatically upload genuine Stage 10 evidence to that backend, and local capture/export is the pre-deadline evidence path. No formula, recommendation or new-provider checkpoint is approved by GW1-P1, GW1-P2 or GW1 readiness work.

Refresh-Load R1 changed acquisition cadence only: valid detailed histories, normalised Understat team inputs and key-free derived Odds inputs can be reused without repeating their network requests. Atomic foreground-state replacement is merged through PR #102. EB-1 changes failure ownership only. Production-Bundle Safeguards changes test/harness coverage only. State-Ownership Cleanup clarifies shared-state inventory and removes reverse authority from the legacy Mini-League alias only. Route-Aware M1 changes measurement tooling only. A3-SC-1 removes proven-unreachable code only. Understat parser repair and model/data-source expansion remain separately gated. Real minute-history reuse, Stage 10 outcome capture and populated Leagues behaviour still require a completed, officially `data_checked` Gameweek and begin with investigation/evidence only.

## Physical iPhone Safari baseline

Pritesh has physically accepted the tested populated paths for:

- Transfers, including the six-Gameweek exact calculation, result persistence, cancellation/restart, app switching, stale-result protection and **No hit** wording;
- the pre-GW1 Transfers unlimited-changes guard: the guarded screen with no free-transfer, hit or ranked-plan advice and no planning-assumption inputs, with Team, the manual squad builder and navigation unaffected;
- Player Detail scrolling, rotation, background restoration and dock layering;
- Team startup ownership, availability presentation, reserve-goalkeeper bench position and outfield bench order;
- Fixtures horizontal scrolling and remaining-season horizons through GW38;
- the Leagues all-league hub, league selection/switching, primary persistence, back navigation, pre-season standings/exposure states and Official FPL versus manually added league management.

Atomic Foreground Refresh (PR #102) and the small mobile UI consistency checkpoint (PR #103) additionally have completed physical iPhone Safari acceptance on their merged builds.

EB-1 (PR #108) additionally passed physical iPhone Safari acceptance for normal online startup, manual online refresh, in-app offline refresh retaining saved verified data, and return-online recovery. The clean uncached private-tab offline-first application state could not be exercised because Safari itself could not load the static Pages shell while offline; that path remains automated-only evidence. The incomplete manual squad used during acceptance means recommendation-survival was not independently observed on device.

GW1-P1's repository record additionally documents Pritesh's physical iPhone Safari production functional acceptance of the evidence Worker using deliberately synthetic evidence. That acceptance covers the recorded Access/D1/R2/ingest/idempotency/failure/reconciliation paths only. The later Preview URL hardening was not part of that functional device session; its live route state was confirmed separately on 11 August 2026 at 19:22 BST from an owner-supplied Cloudflare Domains dashboard screenshot showing production **Restricted** and the wildcard Preview hostname disabled. Owner-supplied dashboard evidence is not independent assistant device testing.

GW1-P2's owner-performed preparation is recorded in the current-state section above and in [GW1-P2 Browser evidence delivery](GW1-P2-BROWSER-EVIDENCE-DELIVERY.md). It proves the Access configuration step, top-level Access sign-in, protected `/v1/health` reachability, the expected pre-window Evidence panel state and the Pages branch switch/restoration. It does **not** prove the decisive credentialled cross-site background upload, which remains unaccepted.

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
- the merged GW1-P1 backend custody foundation exists server-side; the browser upload/outbox integration is implemented on the unmerged GW1-P2 candidate and is not yet an accepted behaviour.

## Engineering foundation

- Vanilla JavaScript ES modules; no framework and zero runtime dependencies.
- Node built-in tests and a custom deterministic bundler.
- `src/` plus `app.html` are canonical; `dist/` and root `index.html` are generated only by `build.mjs`.
- GitHub Pages serves the byte-identical root deployment copy.
- The owner-controlled Official FPL Cloudflare Worker is transport-only and performs no account write, model computation or secret handling.
- GW1-P1 adds a **separate** owner-authenticated evidence Worker with private R2 and D1; it is a persistence side effect and never a recommendation dependency. On merged `main` the browser does not call it; the GW1-P2 candidate adds that call as a one-way side effect.
- Optional providers fail gracefully; Understat remains team-level and Odds remains direct-only.
- Validated supporting inputs use separate local caches; Understat raw HTML and Odds secrets are never stored in those caches.
- Stage 10 evidence flows one way from frozen prediction to outcome to evaluation to review and cannot feed back into live recommendations.
- `src/state.mjs` is the declared cross-module `S` slot inventory; domain modules remain the semantic owners of their own mutable state.

## Current product gaps

- No single synthesised weekly action across Team, Transfers and Fixtures.
- No validated projected-rank or tactical Mini-League strategy model.
- No cited team-news, predicted-line-up, press-conference, cup-congestion or travel intelligence. The evaluation path for those is planned but unimplemented and unapproved in [External Intelligence Foundation](EXTERNAL-INTELLIGENCE-FOUNDATION.md).
- Bank and free transfers are not yet authoritative account-derived values.
- Hosted Ask Teamsheet remains unavailable.
- Prospective 2026/27 accuracy and calibration evidence has not yet accumulated.
- Google Sheets export is manual and the app cannot run guaranteed work while fully closed on iPhone.
- Automatic in-app cloud evidence custody is implemented on the GW1-P2 candidate but is not an accepted or merged behaviour, so it is not available in the deployed app.

## Current technical risks

- real post-Gameweek minute-history cache reuse and revision-triggered refresh have automated coverage but cannot yet have physical live-season evidence;
- the flattened bundle still depends on an explicit module order that is broader than the direct import graph, protected by PR #111's complete-bundle safeguards;
- browser persistence failure handling is proven by automated tests only; Teamsheet never installs a `window.storage` manager itself, so the authoritative-backend paths have no physical-device or real-host evidence;
- the shared-state inventory regression guards direct/static `S` property access but is not a general data-flow proof for arbitrary computed property access;
- D1 and R2 cannot share one transaction, so the GW1-P1 custody protocol is recoverable rather than atomic and depends on verified orphan handling;
- the GW1-P2 credentialled cross-site upload depends on Safari third-party cookie behaviour that no automated test can prove, and its bounded outbox `pinLimit` of four is a conservative policy rather than a measured device storage ceiling;
- permanent Understat/Odds-derived archival rights remain unresolved and the server retention flags remain fail-closed;
- repository `preview_urls:false` is not proof of the currently deployed Cloudflare route state; the current live state rests on owner-supplied 11 August 2026 dashboard evidence at a single moment, and any later redeploy or dashboard change could alter it without a repository change;
- browser automation cannot replace physical Safari layout and interaction evidence.

These are roadmap inputs, not authority to change them.

## Current and next

### Most recent application checkpoint

**GW1 readiness — pre-deadline Transfers safety guard**, delivered on PR #121. The narrow implementation checkpoint that followed the GW1 readiness audit's *go with conditions* outcome. Before the first Official FPL deadline of a season, Transfers stops presenting the weekly free-transfer/hit optimiser and states that initial squad changes are unlimited until that deadline. The rule is derived from verified Official FPL event data, no optimiser mathematics changes and normal weekly behaviour resumes at the deadline instant. Physically accepted on iPhone Safari at head `f720230…`, Verify Teamsheet #262 / `31583716004` on the then-current 898-test baseline. It also carried the surgical operator and current-status documentation corrections. See [GW1 readiness safety guard](GW1-READINESS-SAFETY-GUARD.md).

**GW1 readiness remediation is complete.** No further readiness engineering item is open.

### Previous checkpoint — historical

**Canonical documentation reconciliation after the GW1-P1 merge.** Merged through PR #120 at `be9d3c98ceff3549574535815a41cd75bb93d0f6`, with Verify Teamsheet #260 / `31575507007` and Pages #125 / `31575506352` passing on that exact merge commit at the then-current **883/883** baseline. It recorded the merged GW1-P1 state, the GW1-P2 candidate, the owner-performed live acceptance preparation and the GW5 → GW6 planning correction, and changed no application, model, provider, Worker, schema, hosting or generated behaviour. That SHA and test count are permanent evidence for PR #120, not the current repository baseline.

### Unmerged application candidate

**GW1-P2 — Browser Evidence Delivery + Durable Outbox** on draft PR #119. Implementation is complete and repository-verified; the decisive physical iPhone Safari transport acceptance is outstanding and the PR must stay draft until it passes and Pritesh explicitly approves merge. It is a separate gating stream and is not a GW1 blocker.

### Historical immediate operating state

Pre-GW1 code freeze and operational rehearsal.

### Completed merged foundation

**Audit A3/A3-R0:** complete and merged through PR #98. **DTR-1:** complete and merged through PR #99. **iPhone form-focus zoom:** complete and merged through PR #100. **Data Architecture D1 design closeout:** merged through PR #101 as documentation only. **Atomic Foreground Refresh:** complete, physically accepted and merged through PR #102. **Small mobile UI consistency:** complete, physically accepted and merged through PR #103. **A3 cache and persistence resilience:** complete and merged through PR #104 with physical iPhone testing explicitly waived. **Post-A3 Checkpoint 0:** complete and merged through PR #105. **0C manual-squad dead-handler cleanup:** complete and merged through PR #106. **`fpl:calib` compatibility:** complete and merged through PR #107. **A3 Error-Boundary Separation (EB-1):** complete, physically accepted on the executable device paths, merged and post-merge verified through PR #108. **A3 Production-Bundle Safeguards:** complete and merged through PR #111. **A3 State-Ownership Cleanup:** complete and merged through PR #112. **Route-Aware Rendering and Performance M1:** measurement instrumentation only, complete and merged through PR #115. **A3-SC-1 Small Stale-Code Cleanup:** complete and merged through PR #116. **A3 documentation/architecture reconciliation:** complete. **GW1-P1 — Cloudflare Evidence Foundation:** backend only, complete and merged through PR #118 at `58b834a…`. **Canonical documentation reconciliation:** documentation only, complete and merged through PR #120. **GW1 readiness — pre-deadline Transfers safety guard:** complete, physically accepted and delivered on PR #121.

GW1-P2 is not in this merged list because PR #119 remains unmerged.

### Next only after GW1-P2 acceptance and separate approval

Understat repair, Odds repair, broader D1 schema expansion, Google Sheets automation, hosted AI/ChatGPT migration, scheduled collectors, Cloudflare automation expansion, agents and route-aware optimisation remain separately gated. So does every step of the [External Intelligence Foundation](EXTERNAL-INTELLIGENCE-FOUNDATION.md) post-GW1 sequence, including the shadow observation foundation itself. The GW1 Readiness Audit is complete: it concluded *go with conditions* with zero blockers, and PR #121 addressed both of its should-fix items.

### After real Gameweek data

After the first completed and officially `data_checked` Gameweek, investigate real minute-history caching, Stage 10 outcome capture and populated Leagues data without changing calculations. Perform deferred Leagues acceptance and begin genuine Stage 10 evidence review. Investigate defects first; do not tune calculations or add football inputs from a small or unavailable sample.

## Product and technical invariants

Teamsheet remains a polished, fast, mobile-first FPL decision desk. Preserve vanilla JavaScript ES modules, the zero-dependency toolchain, Node built-in tests/custom bundler, deterministic builds, GitHub Pages/single-file deployment, graceful optional-provider fallback and iPhone usability unless separately approved.

No model, expected-minutes, fixture, scoring, captaincy, squad, transfer, optimiser, simulation, rank, Mini-League/rival, provider acquisition/weighting, Understat/Odds repair, Worker behaviour, D1/R2 schema, evidence canonicalisation or hosting change is authorised by this documentation checkpoint.

## Non-negotiable limits

GW1-P1 was approved only for the backend Cloudflare evidence foundation and its direct security/tests/docs/deployment hardening. GW1-P2 is approved only within the boundary recorded in [GW1-P2 Browser evidence delivery](GW1-P2-BROWSER-EVIDENCE-DELIVERY.md). Neither authorises provider additions/acquisition changes, Understat/Odds repair, model or calculation changes, fixture/scoring/expected-minutes/squad/captaincy/simulation/transfer/rank/Mini-League logic, Google Sheets automation, AI agents, scheduled collectors, UI redesign, route-performance work or unrelated cleanup. Historical aggregate r=0.80 remains method-flattered and is not a validated accuracy claim.

## Historical — 11 August 2026 GW1-P1 checkpoint

**Historical snapshot of that checkpoint; GW1-P1 has since merged as recorded above.**

At that checkpoint the latest merged GitHub `main` was `43f109b306071aa0c3c1c45985876fecb3da7aa5`, and **GW1-P1 — Cloudflare Evidence Foundation** was the current unmerged checkpoint in draft PR #118 on `agent/gw1-p1-cloudflare-evidence-foundation`.

GW1-P1 implements only the backend half of the approved D1 evidence architecture: a separate Cloudflare Access-authenticated evidence Worker, private content-addressed R2 objects, minimal D1 manifest/receipt/index state, independent canonical Stage 10 validation, idempotent duplicate handling and bounded orphan reconciliation. The accepted custody order remains R2 first and D1 second; backend failure is a one-way evidence side effect and must not affect recommendation availability.

The repository record documents owner-performed physical iPhone Safari functional production acceptance of Access, D1/R2, canonical ingest/read-back, duplicate handling, forced R2 failure, forced D1-after-R2 failure and orphan reconciliation.

The final preview/version-route security audit found that the evidence Wrangler configuration relied on the implicit Preview URL default while `workers_dev` was enabled. The GW1-P1 candidate explicitly sets `preview_urls:false` in both byte-identical evidence deployment configs and permanently tests that invariant. Repository configuration alone never proves deployed Cloudflare route state. **Live route state was confirmed on 11 August 2026 at 19:22 BST from owner-supplied Cloudflare dashboard evidence**: production `teamsheet-evidence-archive.fpltsheet.workers.dev` enabled and **Restricted** behind Access, and the wildcard Preview hostname disabled. That closes the preview/version security item as owner-supplied dashboard evidence, not as independent assistant testing.

The Teamsheet browser was deliberately **not connected** to this backend by GW1-P1 itself. Persistent pending-upload/outbox integration and automatic in-app cloud custody were GW1-P2 and were separately approval-gated at that time; GW1-P2 has since been approved and implemented as the candidate recorded above. Existing Stage 10 local capture, recovery and export semantics are unchanged. Understat/Odds permanent archival remains fail-closed pending separately approved retention rights. No provider acquisition, provider weighting, projection, expected-minutes, fixture, squad, captaincy, transfer, simulation, rank, Mini-League or UI behaviour changed in GW1-P1.

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

## Historical — 9 August 2026 D1 design closeout

At that closeout the authoritative baseline was `main` `6e725485564a51ee2a17bc08e5c8bf95e8c2778c`, merge of PR #100; it has since been superseded. The iPhone form-focus zoom correction passed 693 tests and physical iPhone Safari acceptance and is complete.

[Data Architecture D1](DATA-ARCHITECTURE-D1.md) was approved at that checkpoint as a design only. It selected D1 plus private R2 behind a separate authenticated data Worker, retained local fallback and limited Google Sheets to optional downstream reporting. **A later, separately approved GW1-P1 checkpoint authorised and implemented the backend-only foundation, which is now merged through PR #118.** A further separately approved GW1-P2 checkpoint authorised the Teamsheet browser integration, pending-upload/outbox and automatic upload now implemented on the unmerged PR #119 candidate.

Historical records remain valid for their recorded dates; they must not be read as current status where the current-state section above or live GitHub says otherwise.


<!-- DATA-S1-2026-08-22 -->
## DATA-S1 repository foundation — 22 August 2026

The separately approved [DATA-S1 Shadow Structured Data Foundation](DATA-S1-SHADOW-STRUCTURED-DATA-FOUNDATION.md) adds the isolated, provider-neutral `teamsheet-data-platform` repository service and separate future `teamsheet-data` D1 binding. Only `shadow_only` is valid. It has no production/browser/model/Provider Health read path, no new R2, no provider activation and no Google Sheets integration; existing Stage 10 D1/R2 custody remains separate and unchanged. No live infrastructure was created or modified. PR #145 is merged and repository-verified, but DATA-S1 remains **not live deployed**. DATA-S1A is the current control reconciliation. The separately owner-gated sequence is DATA-S1B live Cloudflare preflight/deployment/acceptance, DATA-S2 Official FPL structured history, DATA-S3 automated Official outcomes, DATA-S4 provider trials/evaluation, DATA-S5 downstream Sheets automation, then later explicit production/model gates. See the [DATA-S1B plan](DATA-S1B-LIVE-DEPLOYMENT-ACCEPTANCE-PLAN.md).

Effective **22 August 2026**, the owner superseded the blanket £0 recurring-cost constraint: free remains preferred where comparable, while a small paid provider may be considered only with explicit pricing, rights and value/cost justification, preferably after a shadow trial. This approves no provider and does not rewrite historical research conducted under the former constraint.

## Decision Intelligence DI-4 (29 August 2026)

The Team experience now includes an artifact-only weekly decision synthesis above the unchanged pitch. It renders DI-3's existing production decisions, alternatives, uncertainty and reconsideration fields through a deterministic fail-closed read model. It is coherence and disclosure, not a smarter engine; recommendation diff is zero and physical iPhone Safari acceptance remains pending.

<!-- DATA-S2B-E2C-B-2026-09-01 -->
## DATA-S2B E2C-B repository-only preparation

E2C-B hardens the disposable live boundary with mandatory production-account separation, exact returned-value affinity/storage semantics, missing-versus-zero bounded provider metadata, sanitized evidence and a manual exact-main/exact-Verify protected workflow that rejects reruns and never cleans up. No live action occurred; preparation, execution, acceptance and manual cleanup remain separate owner gates. See [E2C-B implementation record](../workers/data-platform/DATA-S2B-E2C-B-DISPOSABLE-LIVE-EXPERIMENT-PREPARATION.md).
