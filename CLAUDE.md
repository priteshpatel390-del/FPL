
<!-- DECISION-INTELLIGENCE-DI4-2026-08-29 -->

<!-- DATA-S2B-OPTION3-GITHUB-D1-REST-2026-09-02 -->
### Current DATA-S2B checkpoint — Option 3 repository implementation

The forward automated collection contract is one protected daily GitHub Actions opportunity
at 01:17 UTC, fixed Official FPL fetch/validation/diff/hash on the runner, and bounded direct
Cloudflare D1 REST writes. It invokes no production Worker, so collection Worker CPU is not
applicable. Production Cron remains intentionally absent and must not be restored. Repository
implementation is awaiting owner review, merge, protected-environment configuration and a
separately approved first production execution. See [Option 3 collection](workers/data-platform/DATA-S2B-GITHUB-ACTIONS-D1-REST-COLLECTION.md).

<!-- DATA-S2B-INTENTIONAL-CRON-STOP-2026-09-02 -->
### Current DATA-S2B checkpoint — collection intentionally stopped on Worker CPU; execution architecture unresolved

The consolidated read ran. Protected diagnostics run `33644480107`, dispatched from exact `main` `c5db7629d0f7bb7e5d88b8e4b5a4d5fba495370e` after exact-head Verify `33643906698`, completed with no fatal stop; all twenty-two reads passed, including Worker health. One dispatch produced the whole remaining read-only bundle, so the one-failure-per-merge loop is closed.

**Production Cron is absent because collection was intentionally stopped, not because of drift.** Owner-provided historical fact, absent from this repository: the production scheduled collector was observed using approximately **630 ms of Worker CPU** — roughly sixty-three times the 10 ms Workers Free Cron Trigger ceiling — and the trigger was deliberately removed so it would not fire again at 01:00 UTC and risk breaching Free-tier constraints. The disposable E2 programme and the GitHub Actions machinery exist specifically to progress the data path without re-running that collector. The repository had pre-registered exactly this procedure: DATA-S2A §"Important Free-plan CPU limitation" ("if the exact Free-plan Cron exceeds the CPU ceiling, activation stops … redesign/split the collector or separately approve a paid Workers decision"), the DATA-S2B plan's "After Cron activation" stop sequence (remove Cron first, preserve D1 evidence), and Phase 4A step 11 ("Cron removal is the first stop action"). The plan already defines **NO-GO — FREE LIMITS** as a legitimate outcome. **Do not restore the Cron.** An earlier reading of this bundle called the absence an unexplained defect and proposed restoring it; that reading is withdrawn.

The proven state is otherwise strong. One genuine populated Official FPL baseline: 9,860 observations reconciling exactly against 9,860 heads and 9,860 distinct logical keys, zero orphans, zero quarantine, zero rejections; redirect remediation proven live; both failed runs wrote nothing; provider/rights/security boundaries all pass; active Version, deployment, database identity, season binding and rollback targets all correct, with no stale repository constant found. `unchanged_cycle_proof` and `changed_fact_proof` stay PENDING and **the old requirement for another natural production Cron cycle is itself superseded** pending the execution decision. The earlier claim that the baseline completing proved Free-plan CPU fitness is **withdrawn**: Cloudflare isolates tolerate infrequent overruns and terminate only on consistent ones, so completion at ~630 ms proves tolerance, not fitness.

The unresolved question is how collection should execute safely. `workers/data-platform/official-fpl-d1-rest-plan.mjs` and `d1-rest-client.mjs` already express the whole Official FPL collection path as bounded D1 REST plans, E2-validated live at 9,860 writes, and are imported by no Worker. A D1 REST call invokes no Worker, so it consumes no Workers CPU; D1 row/storage limits and the 1,200-per-5-minute Cloudflare API limit still apply regardless of caller. A GitHub Actions execution proposal is recorded in [read-only production diagnostics](workers/data-platform/DATA-S2B-PHASE-4B-READ-ONLY-DIAGNOSTICS.md) and awaits explicit owner approval; nothing is implemented.

<!-- DATA-S2B-READONLY-PRODUCTION-DIAGNOSTICS-2026-09-02 -->
### Current DATA-S2B checkpoint — bounded read-only production diagnostics candidate

The one-failure-per-merge protected-read pattern is replaced. Runs `33620632272` and `33622647158` each spent a whole merge/Verify/dispatch cycle to reveal a single stale repository constant and never reached D1. This candidate adds a separate bounded read-only production diagnostic (`phase4b/diagnostics-contract.mjs`, `phase4b/readonly-diagnostics.mjs` and a manual exact-main/exact-Verify protected workflow) that gathers the whole remaining read-only acceptance evidence in one pass and reports a seventeen-row PASS/FAIL/PARTIAL/PENDING/SUPERSEDED matrix instead of throwing at the first safe mismatch. Identity is taken from the genuinely active Worker Version, never from a repository pin, so a stale pin is recorded as `SUPERSEDED` rather than aborting.

It stays fail-closed on repository/account/Worker/database identity, unauthorized endpoints, non-allowlisted SQL, malformed or unbounded responses, secret exposure risk and any condition needing mutation. It has no reachable upload, deployment, Cron, D1 write, collector, cleanup or retry surface, and the strict `phase4b/preflight.mjs` gate is retained unchanged. Worker CPU time and D1 rows read/written are reported NOT AVAILABLE through the approved read surface rather than widening permissions; current Workers/D1 Free limits were re-verified on 2 September 2026, including Cloudflare's new enforcement of D1 free-tier daily row limits from 1 September 2026. This is repository evidence only: no Cloudflare request, workflow dispatch, deployment or credential change was performed. A completed bundle proves the read finished, not DATA-S2B acceptance. See [read-only production diagnostics](workers/data-platform/DATA-S2B-PHASE-4B-READ-ONLY-DIAGNOSTICS.md).

<!-- DATA-S2B-PRODUCTION-CRON-DIAGNOSTIC-2026-09-02 -->
### Current DATA-S2B checkpoint — post-merge Cron drift diagnostic

PR #203 merged as `17d41df8e90ab9b4bd99ddf055cb90d1f37cc086`; Verify `33621816997` passed. Corrected protected read `33622647158` proved the promoted Worker identity and failed closed at `phase4b_cron_drift` before D1 reads. The candidate adds only a bounded sanitized schedule diagnostic and continues to reject drift. Merge and another exact-main protected read require owner approval.

<!-- DATA-S2B-PRODUCTION-ACCEPTANCE-RECONCILIATION-2026-09-02 -->
### Current DATA-S2B checkpoint — production acceptance read-contract correction

Read-only run `33620632272` passed exact-main/Verify gating and failed before D1 reads because the preflight still pinned the predecessor Version after successful deployment `33433195713` promoted Version `222e62d5-9979-468d-9c54-b97f903d58f6`. The candidate pins the deployed/rollback Versions and admits only internally reconciled populated completed history. It performs no live mutation and does not claim baseline, unchanged, changed-fact, D1 accounting or CPU acceptance. A merge, exact-head Verify and corrected protected read are required. See [production acceptance reconciliation](workers/data-platform/DATA-S2B-PRODUCTION-ACCEPTANCE-RECONCILIATION.md).

<!-- DATA-S2B-E2-D1-QUERY-ARRAY-2026-09-02 -->
### Current DATA-S2B checkpoint — E2 disposable D1 query-array compatibility candidate

Live isolation proved `pragma_table_xinfo` unsupported (`33604986736`), `PRAGMA table_info` supported but top-level arrays unsupported (`33606192013`), and corrected `{batch:[...]}` groups fully compatible (`33606874736`). Bounded object probe `33607321730` proved the untouched D1 contains exactly Cloudflare's `_cf_KV`, now narrowly allowlisted. After manual reset, contract run `33616862569` passed INITIAL through A03, storage affinity and W00, but W01 returned an ambiguous transport outcome. Read-only reconciliation `33617288427` proved W01 wrote nothing, and EXPLAIN isolation `33617620578` proved only the five head-upsert statements fail syntax parsing. The correction adds SQLite's required `WHERE true` disambiguator before `ON CONFLICT`. Corrected W01 returned success and read-only reconciliation `33618133440` proved the exact completed state: 1,064 entities, 9,862 observations (9,860 analogue plus two prior affinity rows), 9,860 heads, zero orphans and a completed 9,860-record run. The reconciliation contract now includes those two intentional pre-existing observations. See [E2C-B preparation](workers/data-platform/DATA-S2B-E2C-B-DISPOSABLE-LIVE-EXPERIMENT-PREPARATION.md).

### DI-4 physical acceptance remediation — review candidate


Physical iPhone Safari acceptance also failed on `6b568985b637e7e3b31ea57bdf883b2a918c786b` after the lexical fix: unavailable and Team-only partial states passed, but returning from visibly completed Transfers retained the old partial DOM. Diagnosis proved app-shell route activation unhides Team without rerunning its renderer. The narrow remediation publishes parity-runtime changes to the weekly card while Team is visible and refreshes from `latest()` on the existing Team route event; it adds metadata-only developer diagnostics and public-squad/fresh/cache route regressions. No navigation, artifact, recommendation, model, provider or persistence semantics change; physical retest remains pending.

### Current Decision Intelligence checkpoint — DI-4 review candidate

DI-4 renders the frozen, ephemeral DI-3 parity artifact through a narrow deterministic read model in a mobile-first Team weekly-decision surface. Complete, partial and unavailable states fail closed; artifact actions, consequences and order are copied without recomputation or feedback. No recommendation/model/provider/persistence/security/account behaviour changes. Physical iPhone Safari acceptance remains pending. See [DI-4 Weekly Decision Synthesis](docs/DECISION-INTELLIGENCE-DI4-PRODUCT-INTEGRATION.md).

# CLAUDE.md — onboarding for every future development session

<!-- DATA-S2B-E2C-B-INITIAL-SCHEMA-COMPATIBILITY-2026-09-02 -->
### Current DATA-S2B checkpoint — E2C-B initial schema compatibility candidate

E2C-B live attempt 2 stopped before mutation when its 21-statement INITIAL schema inspection received HTTP 400. The narrow repository candidate replaces bound table-name arguments in the 15 table/index/foreign-key PRAGMA table-valued calls with deterministically quoted literals generated only from the fixed five-table repository allowlist. The REST batch shape, 21-result contract, semantic schema acceptance, ordering, mutations, retries and cleanup remain unchanged. No Cloudflare request, workflow dispatch, D1 operation, deployment or credential/environment change was performed while preparing this correction. See [E2C-B preparation](workers/data-platform/DATA-S2B-E2C-B-DISPOSABLE-LIVE-EXPERIMENT-PREPARATION.md).

<!-- DATA-S2B-PHASE4B-POST-ACTIVATION-MACHINERY-2026-08-31 -->
### Current DATA-S2B checkpoint — post-activation deployment machinery remediation candidate

The repository-only Phase 4B machinery and diagnostics are merged. Protected diagnostic preflight run `33428846434` proved that row index `0` differs only in `error_class`, with exact live value `Invalid_redirect_value__must_be_one_of__follow__or__manual____er`; later rows remain unproven. The narrow correction candidate replaces the disproven shorter exact constant without widening acceptance and preserves bounded fail-closed diagnostics. It authorises no live preflight, upload, Deployment, Cron/D1 mutation or collector invocation. After merge, another exact-main protected preflight needs separate owner approval; upload/deployment remains a later owner decision and scheduled baseline acceptance remains outstanding. See [post-activation machinery remediation](workers/data-platform/DATA-S2B-PHASE-4B-POST-ACTIVATION-DEPLOYMENT-MACHINERY.md).


<!-- DATA-S2B-PHASE4B-REDIRECT-REMEDIATION-2026-08-30 -->
### Current DATA-S2B checkpoint — daily collector redirect remediation review candidate

The first unconditional daily production collection on 30 August 2026 selected the intended daily path and created one fail-closed ingestion run, but Cloudflare Workers rejected the collector's explicit `redirect: "error"` request option before either Official FPL response could be consumed. The narrow repository candidate uses Workers-supported `manual` mode and explicitly rejects every 3xx response, retaining the no-redirect host boundary. End-to-end regression coverage also exposed and fixes the baseline-only null comparison that would otherwise have failed after successful 200 responses. Cadence, Cron, daily hour, deadline gate, endpoints, schema, normalisation, D1 commit design, providers and application/model behaviour are unchanged. See [Phase 4B redirect remediation](workers/data-platform/DATA-S2B-PHASE-4B-OFFICIAL-FPL-REDIRECT-REMEDIATION.md).

This is repository evidence only. DATA-S2B remains live-unaccepted until an owner-approved merge/deployment is followed by another genuine scheduled daily event proving a completed populated baseline and consistent D1 state; do not manually invoke collection as a substitute.

<!-- DECISION-INTELLIGENCE-DI3-2026-08-29 -->
### Current Decision Intelligence checkpoint — DI-3 Stage B Option A review candidate

DI-3 Stage A established the canonical contracts. Pritesh subsequently approved Stage B Option A: a one-way, ephemeral parity-artifact runtime consumes already-formed Team and Transfers outputs after selection, copies their semantics without reranking or recomputation, and catches every DI failure without affecting the existing recommendation. It renders no UI, persists nothing, activates no signal and creates no DI-to-production dependency. See [DI-3 Validated Production Decision Layer](docs/DECISION-INTELLIGENCE-DI3-DECISION-LAYER.md).

<!-- DECISION-INTELLIGENCE-DI2-2026-08-29 -->
### Current Decision Intelligence checkpoint — DI-2 review candidate

DI-2 adds a zero-dependency, offline shadow evaluation runner under `src/decision-intelligence/`: immutable/hash-addressed manifests, deadline-frozen feature views, explicit factorial arms, versioned Brier/MAE/RMSE/calibration adapters, deterministic JSON/Markdown evidence and a permanent synthetic reference experiment. It creates no production approval or feedback path and is absent from the deployable build graph. No provider, DATA-S2B/D1/Cloudflare, Stage 10, application, model, recommendation or UI behaviour changes. The generated experiment is synthetic infrastructure evidence only. See [DI-2 Automated Evaluation & Ablation](docs/DECISION-INTELLIGENCE-DI2-EVALUATION.md).

<!-- DECISION-INTELLIGENCE-DI1-2026-08-29 -->
### Current Decision Intelligence checkpoint — DI-1 review candidate

DI-1 implements a repository-only, provider-neutral shadow intelligence contract under `src/decision-intelligence/`. It supplies deterministic canonical observations, Official-FPL identity and bitemporal validation, fail-closed rights classification, a versioned signal registry, an exact production-approval ledger contract and an in-memory shadow repository with no production-read capability. No signal or approval is registered, no provider or collector is activated, and production modules/build inputs do not import DI code. DATA-S2B, D1, Cloudflare, Stage 10, Provider Health, application UI and every recommendation calculation remain unchanged. See [Decision Intelligence Foundation](docs/DECISION-INTELLIGENCE-FOUNDATION.md). DI-2 evaluation work and every production promotion remain separate owner-approved checkpoints.

<!-- DATA-S2B-PHASE3-LIVE-CLOSEOUT-2026-08-28 -->
### Current repository checkpoint — DATA-S2B Phase 3 live deployment PASS

**This section supersedes the Phase 3 repository-gate and Phase 2 present-tense checkpoints below; their design and evidence remain authoritative history.** Manual protected workflow run `33142804502` (#4) passed on exact `main` SHA `d48913332bf5df37b29d98b06579f369f338f6e4`. Existing candidate Worker Version `3a2b065a-6527-4887-9bf8-b08e82e81133` is the sole active Version at 100%; previous production Version `5edbe951-4be4-46bc-b2cf-17b550396105` remains the rollback target, and rollback was not required. Exactly one candidate Deployment mutation was submitted. Postflight passed, Version History remained unchanged, and the workflow performed no Version upload or Cron/D1/route/domain/Access/secret mutation. See [Phase 3 live closeout](workers/data-platform/DATA-S2B-PHASE-3-LIVE-CLOSEOUT.md) and the retained [Phase 3 deployment gating contract](workers/data-platform/DATA-S2B-PHASE-3-DEPLOYMENT-GATING.md).

Before the successful run, the owner manually replaced an unrecognized Access service-token credential pair, narrowed the existing Service Auth policy to the replacement token, and identified the working retained Worker bearer through sanitized HTTP/JSON health checks. Those prior manual authentication changes are separate from the successful workflow's mutation accounting; no credential values are recorded, and obsolete-credential cleanup is not claimed. Phase 4 Cron activation and collection remain separately unapproved. Do not enable Cron, run the collector, write D1, change Access or secrets, add providers, or change application/model/calculation behaviour under this checkpoint.


<!-- DATA-S2B-PHASE2-POSTFLIGHT-2026-08-27 -->
### Current repository checkpoint — DATA-S2B Phase 2 live closeout PASS

**This section supersedes the older present-tense DATA-S2A / DATA-S2B Phase 0 and Phase 1 wording below while preserving dated evidence as history.** DATA-S2B Phase 0 live read-only preflight passed in run `32996481967`, and Phase 1 migration 0002 passed in run `33011334466`. Phase 2 attempt #3, run `33050859823`, created inactive Worker Version `3a2b065a-6527-4887-9bf8-b08e82e81133`; its postflight red result was a false failure caused by treating `/settings` as active-version binding authority after a newer inactive Version existed. PR #170 corrected the verification model to use Deployments plus exact Version Detail, merged, and post-merge exact-main Verify Teamsheet run `33074154222` passed on `2176a3dd29562fecff10614b689ed99a06db6bfa`.

The dedicated Phase 2 read-only closeout run `33088512116` is **PASS**. Production remained on active deployment `10f7a065-3d82-4b34-9fb1-dc6c3a0be524` and active version `5edbe951-4be4-46bc-b2cf-17b550396105`; the Phase 2 candidate remained inactive. Exact Version Detail reconciled both binding sets, Cron remained empty, Phase 1 D1 governance/count state remained exact, ingestion/history/observation/head counts remained zero, and D1 size remained exactly `151552` bytes before and after the bounded read. Accidental upload run `33088187544` was cancelled while its mutation-capable job still waited behind protected-environment approval, so it created no Worker Version or other mutation. See [DATA-S2B Phase 2 Live Read-Only Closeout](workers/data-platform/DATA-S2B-PHASE-2-LIVE-CLOSEOUT.md) for the detailed evidence and limitation.

Phase 2 PASS means one exact inactive candidate exists and has been independently reconciled; it does **not** mean production deployment or production acceptance. The next checkpoint after this documentation closeout is Phase 3 investigation/design only. Phase 3 deployment requires a new explicit owner approval, and Phase 4 Cron activation/collection remains separately unapproved. Do not deploy/promote/split/delete the candidate, enable Cron, run the collector, write D1, change Access or secrets, add providers, or change application/model/calculation behaviour under this checkpoint.

<!-- DATA-S2A-CURRENT-2026-08-26 -->
### Current repository checkpoint — DATA-S2A merged; DATA-S2B live acceptance next

**This section supersedes the older present-tense DATA-S1C/DATA-S1B wording below; dated evidence remains historical.** DATA-S1C-R retired private Service Binding/RPC and the unimplemented custom bearer-HTTP alternative from the forward collection architecture after RPC functional acceptance was not achieved. Their repository and deployed assets remain historical/rollback evidence; do not continue transport-first debugging for DATA-S2 collection. The stable forward boundary is the existing isolated `teamsheet-data-platform` Worker and `teamsheet-data` D1, with transport chosen only when a later consumer actually requires it. See [DATA-S1C-R — Data Architecture Reset](docs/DATA-S1C-PRIVATE-SERVICE-BINDING-RPC.md).

DATA-S2A is merged through PR #160 and repository-verified on its exact merge commit. Its **repository-only, shadow-only** Official FPL structured-history implementation collects only fixed `bootstrap-static` and `fixtures` payloads, validates a strict event/team/player/fixture allowlist, compares with D1 heads, and appends only genuine changes so prior facts remain queryable. It does not replace the existing live Official FPL application gateway and changes no Teamsheet runtime, model or recommendation behaviour. DATA-S2A remains **live-unaccepted**: no DATA-S2A Worker deployment, live migration/D1 mutation or Cron activation has occurred.

The next checkpoint is **DATA-S2B**. It begins with a mutation-free Phase 0 live preflight; migration, Worker version upload/deployment and Cron activation remain later, separate explicit owner-approval gates. DATA-S2B must then prove a real baseline, an unchanged cycle with no observation/head changes, changed-fact behaviour, actual D1 accounting, Workers Free CPU suitability, and rollback/stop on any failure. DATA-S2A merge does not approve DATA-S2B mutation, DATA-S3, production use or redistribution.

<!-- DATA-S1C-CURRENT-2026-08-25 -->
### Current repository checkpoint — DATA-S1C private Service Binding + RPC candidate

**This section supersedes the older DATA-S1B preflight current-state wording below.** The production `teamsheet-data-platform` Worker, `teamsheet-data` D1, `TEAMSHEET_DATA_DB` binding and `data.fpltsheet.co.uk` Custom Domain already exist; Access remains the proven live outer protection. DATA-S1C includes a permanent, manual-only GitHub Actions procedure for separately owner-approved private read-RPC acceptance. The latest nested-path run `32906524221` used the corrected, pinned caller version `cf9c150d-84b0-46f9-a166-530b7243e863`: caller and target PRE/POST checks passed, the caller fetch discriminator arrived, but the caller `health` JSRPC still ended in the runtime hang exception and query did not run. Awaited forwarding was therefore not the complete cause; nested RPC versus target RPC versus Wrangler remote-preview behavior remains unproved. The approved Option 2 repository redesign now makes the temporary probe bind directly to `teamsheet-data-platform -> DataPlatformReadEntrypoint`, with no D1/write/ingest capability, to isolate one-hop target RPC and GitHub-hosted remote-binding compatibility. The deployed caller is not retired or changed: its exact version, private single-read-binding topology and PRE/POST stability remain separate evidence, and the workflow summary permanently reports caller forwarding as `NOT PROVEN`. This redesign has not been executed; no successful GitHub Actions RPC acceptance is claimed and any run remains separately owner-approved. See [DATA-S1C private Service Binding and RPC architecture](docs/DATA-S1C-PRIVATE-SERVICE-BINDING-RPC.md).

<!-- DATA-S1B-PREFLIGHT-CURRENT-2026-08-23 -->
### Current checkpoint — DATA-S1B mutation-free preflight PASS

**This section supersedes older current C5, DATA-S1 and DATA-S1A wording below; historical records remain unchanged.** The DATA-S1B mutation-free live preflight is complete and **PASS**, and the final phase-gated deployment procedure is recorded in the [DATA-S1B Final Preflight and Deployment Runbook](docs/DATA-S1B-FINAL-PREFLIGHT-AND-DEPLOYMENT-RUNBOOK.md). DATA-S1 remains **NOT LIVE DEPLOYED**. This checkpoint created no DATA-S1 Worker, production or validation D1, migration, Access configuration, service token, DNS/Custom Domain, route or production binding. Owner evidence records **Workers Free — Active** with current and projected billable usage of **$0.00**; execution must remain within Workers Free and D1 Free limits and stop rather than upgrade the plan.

The reviewed PR #147 repository candidate baseline is **986 tests passed, 0 failed, 0 skipped, 0 cancelled**, plus deterministic build/provenance gates and exact-head Verify Teamsheet. PR #147 merge authorizes **no Cloudflare mutation**. After merge, re-read latest GitHub `main` and require Verify Teamsheet to pass on that exact merge commit. Only then may the owner consider the next separately gated live mutation: **Phase 2 disposable D1 validation** from the approved runbook. DATA-S2 remains blocked until DATA-S1B live deployment and acceptance fully close. The delivered GW1 readiness checkpoint remains PR #121 as historical application evidence. No model, provider, fixture, captaincy, squad, transfer, simulation, rank, Mini-League or application behaviour changed.

<!-- GW1-P2C5-CURRENT-2026-08-22 -->
### Historical checkpoint — 22 August 2026: GW1-P2C5 synthetic production-path acceptance PASS

GW1-P2C5 passed the production infrastructure path with one unmistakably synthetic `2099-00`/GW38 record on a physical iPhone in normal Safari with Prevent Cross-Site Tracking enabled. The normal local storage/event/outbox/scheduled-delivery path reached the unchanged archive Worker; sanitized read-only reconciliation found the exact accepted D1 receipt, exact D1 manifest and exact private R2 metadata, with R2-first/D1-second timestamps and matching identity, size and stored SHA-256. The browser reached terminal **Archived** status. See [GW1-P2C5 closeout](docs/GW1-P2C5-STAGE10-PRODUCTION-PATH-ACCEPTANCE-CLOSEOUT.md).

The temporary candidate was removed from production by restoring GitHub Pages to authoritative `main`; draft PR #143 was closed unmerged and retained as history. The accepted synthetic cloud record remains untouched. This is synthetic infrastructure acceptance only: natural Stage 10 capture, genuine prospective custody, natural GW2 capture and Official eligibility remain separate future observational gates. Historic GW1 recovery remains parked. No Worker, Access, DNS, D1/R2 configuration, model, provider, timing or calculation behaviour changed.

<!-- GW1-P2C3B-CURRENT-2026-08-22 -->
### Historical checkpoint — 22 August 2026: GW1-P2C3B same-site transport closeout

**Supersedes older GW1-P2/GW1-P2C2 current-state wording below where it describes sibling-domain deployment or physical browser transport acceptance as pending.** The live sibling origins are `https://app.fpltsheet.co.uk` and `https://archive.fpltsheet.co.uk`. On a real physical iPhone in normal Safari with **Prevent Cross-Site Tracking ON**, an authenticated, deliberately invalid `{}` request directly demonstrated `Sec-Fetch-Site: same-site`: OPTIONS reached the Worker and returned 204; the matching POST reached it and returned 422; Safari read `{"error":"envelope_schema"}`. **GW1-P2C3B browser transport acceptance therefore passes, for transport only.**

No genuine Stage 10 record was sent. This result proves neither genuine evidence custody nor valid archival, D1 receipt/manifest creation, R2 object creation, persistence, idempotency, duplicate handling, or any recommendation/model behaviour. The literal physical returned values of `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials` and `Vary` were not directly captured. Sanitized evidence is recorded in [GW1-P2C3B Same-site transport closeout](docs/GW1-P2C3B-SAME-SITE-TRANSPORT-CLOSEOUT.md). The legacy GitHub Pages origin allowlist, legacy `workers.dev` archive hostname, its Access protection and existing rollback deployments/versions remain intentionally retained; cleanup is a separate checkpoint. No application, Worker, configuration or live-infrastructure behaviour changes in this closeout.


<!-- GW1-P2C2-CURRENT-2026-08-21 -->
### Historical checkpoint — 21 August 2026: GW1-P2C2 repository preparation

**Supersedes older GW1-P2 text below where it describes the physical cross-site POST as still pending.** The 21 August controlled iPhone Safari diagnostic on the deployed PR #137 CORS remediation reached the evidence Worker with the credentialled OPTIONS request and received HTTP 204, but the subsequent POST never reached the Worker and Teamsheet received no HTTP status. That result proves the earlier missing `Access-Control-Allow-Credentials: true` defect was real and was corrected; it does **not** prove a single browser/Access root cause for the remaining cross-site failure. Option A (`github.io` → `workers.dev`) is therefore exhausted rather than accepted.

The approved next checkpoint is **GW1-P2C2 — sibling same-site custom-domain transport repository preparation**, implemented only on draft PR #139. The intended browser origins are `https://app.fpltsheet.co.uk` and `https://archive.fpltsheet.co.uk`; they are same-site but remain cross-origin, so exact-origin credentialled CORS remains mandatory. PR #139 selectively carries forward PR #119's durable outbox/browser-delivery semantics, preserves PR #137 as the single credentialled-CORS adapter authority, emits the exact archive ingestion endpoint `https://archive.fpltsheet.co.uk/v1/evidence/predeadline`, and temporarily keeps the existing GitHub Pages origin beside the new app origin in the Official FPL gateway allowlist for rollback.

**No live custom-domain architecture is claimed.** DNS, GitHub Pages custom-domain configuration, Cloudflare Worker Custom Domain/Access configuration, deployment and physical iPhone Safari acceptance are separate future approval gates. `main` remains the operating source of truth until an approved merge. No model, provider, fixture, expected-minutes, scoring, squad, captaincy, transfer, optimiser, simulation, rank or Mini-League calculation changed in GW1-P2C2.


## Research programme control centre — mandatory before external-intelligence work

The permanent pre-GW1 and later external-intelligence research programme is indexed at [docs/research/README.md](docs/research/README.md). The original [External Intelligence Foundation](docs/EXTERNAL-INTELLIGENCE-FOUNDATION.md) remains the unmoved historical/root investigation; the research index does not replace or duplicate it.

Before any provider evaluation, external-data proposal, expected-minutes evidence proposal, shadow observation/store proposal, external-repository adoption, model ablation or other external-intelligence implementation proposal, read **both** the Foundation and `docs/research/README.md`, then read the relevant topic branch record. A branch marked `Research complete`, `Awaiting evidence` or `Ready for approval` still does not approve a provider, data source, retention right, model input, weight, formula or runtime path. Time-sensitive access, pricing/free-tier, terms, licensing, retention rights, source maintenance and reliability must be re-verified before implementation. Production behaviour remains governed by the canonical docs and the normal explicit owner approval gates.

## Historical operating state before C5 closeout and DATA-S1

> **Superseded historical record:** The instructions and open gates in this section describe the repository before C5 closed. They are retained as evidence only and are not current operating instructions. The DATA-S1 control section at the top of this file is authoritative.

**This file describes the tree it lives in.** It deliberately does not restate the current `main` commit SHA: GitHub owns that fact, it changes on every merge, and duplicating it here is how this documentation went stale before. Read the live SHA with `git rev-parse origin/main`, and read live pull-request state from GitHub. Everything below is a durable statement about the work itself.

### Historical two-stream framing

Do not collapse these. They have different scopes, different gates and different owners.

**Stream 1 — the Teamsheet application. Ready for GW1.**

The most recent application checkpoint is **GW1 readiness — pre-deadline Transfers safety guard**, delivered on **PR #121**. Before the first Official FPL deadline of a season the Transfers screen suppresses the weekly free-transfer/hit optimiser and states that initial squad changes are unlimited; the rule is derived from verified Official FPL event data and normal weekly behaviour resumes at the deadline instant. No optimiser mathematics changed. **Pritesh physically accepted it on iPhone Safari** on the exact candidate head `f72023043813566fe8b11da2d959e374d34bca39`, which passed Verify Teamsheet #262 / `31583716004` with **898 tests, 898 passed, 0 failed, 0 skipped, 0 cancelled** (the then-current baseline for that application head; the same PR's documentation reconciliation raises the repository baseline to **904** without touching application code), deterministic byte-identical builds, root/deployable equality and verified committed build provenance. GitHub Pages was pointed at the branch for that acceptance and then restored to `main`, each observed built (Pages #126 branch, **#127 `main`**). See [GW1 readiness safety guard](docs/GW1-READINESS-SAFETY-GUARD.md).

**Historical GW1-P2C2 candidate baseline: 971 tests for that earlier tree.** The 898 above is the then-current count on the physically accepted application head; the documentation-integrity regressions added by the same PR's reconciliation raised it to 904, and the pre-GW1 housekeeping closeout reached 907 by adding one documentation-integrity regression and splitting the hardened `selectMiniLeague` coverage into behavioural and mutation-sensitivity contracts. 907 remains the then-current merged `main` baseline until an approved merge. The GW1-P2C2 candidate then added the reconciled PR #119 browser-delivery behavioural suite and the same-site migration coverage, reaching 971. No application code changed across any of those steps. Earlier counts (940, 918, 907, 904, 898, 883, 868, 864, …) are historical checkpoint evidence, not current claims.

The GW1 readiness audit that preceded PR #121 found **zero blockers** and two should-fix items; PR #121 addressed both. The application is suitable for GW1 subject only to the separate live-only gates named below. No model, provider, fixture, expected-minutes, scoring, squad, captaincy, transfer, optimiser, simulation, rank or Mini-League behaviour was authorised or changed by readiness work.

**Stream 2 — automatic cloud evidence custody. Still unaccepted, and not a GW1 blocker.**

**GW1-P2 — Browser evidence delivery and durable outbox** is an implemented candidate on **draft, unmerged PR #119**, branch `claude/gw1-p2-evidence-delivery-design-ejsb0d`, head `252c5eba0381c8aa5afb7bda1686dd102326c6df`. It connects the existing Stage 10 browser capture path to the GW1-P1 archive through a durable local outbox, a transport-independent delivery state machine, content-hash idempotency and fail-closed provider retention. Cloud custody remains a one-way side effect: the FPL recommendation never reads, waits for, or fails because of the archive, so **GW1-P2 is not a recommendation dependency and does not gate GW1**.

Until PR #119 is accepted and merged, **local Stage 10 capture, recovery and owner-controlled export remain the operating fallback** for pre-deadline evidence. That fallback is complete and merged; nothing about GW1 operation waits on PR #119.

### Planning record — External Intelligence Foundation, documentation only

[External Intelligence Foundation](docs/EXTERNAL-INTELLIGENCE-FOUNDATION.md) is the canonical research and shadow-architecture record for future external football information. It is **documentation only and approves nothing**: no provider, endpoint, API key, acquisition cadence, retention right, model, weighting, expected-minutes, fixture, squad, captaincy, transfer, simulation, rank or Mini-League change is authorised by it, and it does not alter the pre-GW1 freeze.

Read it before any future provider, external-data, expected-minutes-evidence or ablation proposal. It fixes three things that later work must not quietly undo: external observations must normalise into a **provider-neutral contract** with separate `observedAt` / `effectiveAt` / `fetchedAt` timing, canonical Official FPL identity and an explicit rights/retention classification; any first implementation must be **`shadow_only`**, with no path from shadow storage into projected points, the optimiser, captaincy, transfers or Mini-Leagues without separate explicit approval; and the layers — structural strength, recent performance, market expectation, availability/expected minutes, calendar/workload, set-piece and role, matchup microstats, transfer economics, competitive strategy — must stay separate rather than collapsing into one confidence score. Its free-source research is dated 12 August 2026 and must be re-verified from first-party sources before any implementation approval.

Its one operationally relevant conclusion for now: current Stage 10 **already** preserves the normalised Odds inputs that affected a prediction when Odds is healthy, so the primary market-layer on/off ablation needs no new pre-GW1 code — only a genuine, healthy, exported capture. Raw bookmaker prices and intraday line movement are not preserved and are not reconstructible on the free tier, and that lost optionality does **not** justify breaking the freeze.

### Historical immediate operating state

Pre-GW1 code freeze and operational rehearsal. The next work is **not** post-GW1 model or provider enhancement. In order:

1. Hold the freeze; make only separately approved fixes.
2. Operate GW1 and collect prospective evidence.
3. Perform the GW1-P2 live acceptance when the genuine Stage 10 window opens, **20 August 2026 at 18:30 BST**.
4. Review evidence at the **GW5 → GW6** international break.

### Historical GW1-P2 gate detail

Separate what is done from what is unproven. Do not collapse these three into one status:

1. **Completed owner preparation — recorded, do not repeat or re-request.** Cloudflare Access `Bypass OPTIONS requests to origin` was enabled and saved for `teamsheet-evidence-archive`. No Access-layer allowed-origin response was configured, so the Worker remains the sole owner of exact allowed-origin CORS enforcement and no Access policy for `POST`, `GET` or any other method changed. Top-level physical iPhone Safari Cloudflare Access authentication succeeded and protected `GET /v1/health` returned `{"ok":true,"archiveVersion":"1.0.0","schemaVersion":"1.0.0","migrationVersion":1}`. Settings → Evidence showed the expected pre-window state, non-destructive storage telemetry showed approximately 546.2 KB of Teamsheet-owned data, and GitHub Pages was switched to the PR #119 branch and restored to `main`, each observed built. `TEAM_DOMAIN`, `POLICY_AUD`, Access JWTs and cookies must still never be printed, pasted or logged.
2. **The decisive application POST is still unproven — this is the open acceptance gate.** None of the above proves the credentialled cross-site background upload from `priteshpatel390-del.github.io` to `teamsheet-evidence-archive.fpltsheet.workers.dev`. The direct credentialled cross-origin transport is approved as a *feasibility implementation only*, not as the accepted permanent iPhone transport. Acceptance requires the owner's physical iPhone Safari test with **Prevent Cross-Site Tracking ON**, against a genuine Stage 10 record, from the configured window opening **20 August 2026 at 18:30 BST**. Disabling that setting is a diagnostic comparison and must never become a product requirement. If the transport fails under normal privacy settings, stop and return with a revised Option B versus Option C comparison; do not implement either without separate approval, and do not remove the transport-independent outbox/delivery work.
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

Read this first. GitHub `main` plus the live state of the active pull request are the permanent source of truth; repository evidence overrides conversations, old uploads and generated deployables. Last reconciled: 12 August 2026.

## Historical pre-C5 baseline table

| Item | Current evidence |
|---|---|
| Latest merged `main` | Read it live: `git rev-parse origin/main`. Deliberately not restated here — see the note at the top of this file. |
| Historical GW1-P2C2 repository test baseline | **971 tests, 971 passed, 0 failed, 0 skipped, 0 cancelled**, with deterministic byte-identical builds, root/deployable equality, exact build identity and verified committed build provenance. Merged `main` separately holds the then-current 907/907 until an approved merge |
| Most recent application checkpoint | GW1 readiness — pre-deadline Transfers safety guard, delivered on PR #121 from `agent/gw1-readiness-safety-guard`. Physically accepted by Pritesh on iPhone Safari at head `f72023043813566fe8b11da2d959e374d34bca39`, Verify Teamsheet #262 / `31583716004` passing 898/898 — the then-current count for that application head, before this PR's documentation-integrity additions. See [GW1 readiness safety guard](docs/GW1-READINESS-SAFETY-GUARD.md) |
| GW1 readiness verdict | Audit found **0 blockers** and two should-fix items; PR #121 addressed both. The application is suitable for GW1 subject only to the separate live-only gates in this table |
| Unmerged application candidate | GW1-P2 — Browser evidence delivery and durable outbox, draft PR #119, branch `claude/gw1-p2-evidence-delivery-design-ejsb0d`, head `252c5eba0381c8aa5afb7bda1686dd102326c6df`, Verify Teamsheet #255 / `31537859087` passing 931/931. Not accepted, not merged, **not a GW1 blocker** |
| Pre-deadline evidence fallback | Until PR #119 is accepted and merged, local Stage 10 capture, recovery and owner-controlled export remain the operating path. That fallback is complete and merged |
| GW1-P2 implementation boundary | Pure outbox state machine; browser delivery service; bounded retries and single-flight; content-hash idempotency; pending-record persistence across restart; fail-closed provider retention; minimal Settings → Evidence status/action; CSP/meta wiring; exact-origin credentialled CORS. |
| GW1-P1 functional production acceptance | Repository record documents Pritesh's physical iPhone Safari acceptance of Access, D1/R2, positive ingest/read-back, duplicate handling, forced R2 failure, forced D1-after-R2 failure and orphan reconciliation. |
| GW1-P1 security state | Repository config explicitly disables Cloudflare Preview URLs and tests that invariant. Owner-supplied live Cloudflare Domains evidence on 11 August 2026 showed production Access-`Restricted` and the wildcard Preview hostname disabled. It is owner dashboard evidence, not independent assistant testing. |
| GW1-P2 completed preparation | Cloudflare Access `Bypass OPTIONS requests to origin` enabled and saved with no Access-layer allowed-origin response; top-level iPhone Safari Access sign-in; protected `GET /v1/health`; expected pre-window Evidence state; non-destructive storage telemetry; Pages branch switch and restoration. |
| Historical GW1-P2 open acceptance gate | The decisive credentialled cross-site background POST from physical iPhone Safari with Prevent Cross-Site Tracking ON, against a genuine Stage 10 record from 20 August 2026 at 18:30 BST. Unproven. |
| GW1-P2 unresolved limitation | The bounded outbox `pinLimit` stays at 4. The usable iPhone storage ceiling is not evidenced and must not be claimed as proven. |
| Final repository gate | The final exact PR head must pass Verify Teamsheet after all config/doc changes. Earlier green runs are historical once the head changes. |
| GW1-P2 merge gate | PR #119 must stay draft and must not merge until Pritesh performs the physical acceptance test and explicitly approves it. |
| External intelligence planning | [External Intelligence Foundation](docs/EXTERNAL-INTELLIGENCE-FOUNDATION.md) — documentation only. Provider-neutral contract, hard `shadow_only` boundary, dated free-source research, double-counting controls and a pre-registered ablation method. Approves no provider, retention, model or calculation change |
| Immediate operating state | Pre-GW1 code freeze and operational rehearsal. Not post-GW1 model or provider work. |
| Deferred live-season acceptance | Published League rank/movement, populated standings and gaps, nearby/pairwise rivals, selected-rival squad/captain/vice/chip exposure, stale/incomplete rival handling and relevant large-league pagination |

[Leagues pre-season acceptance](docs/LEAGUES-PRESEASON-ACCEPTANCE.md) is authoritative for what was accepted and what remains deferred. The deferred checks are not defects while Official FPL has not published the required post-Gameweek facts.

## Historical approval boundary before C5 closeout

Repository Truth A1, Safe Hygiene A2, Refresh-Load R1, A3/A3-R0, DTR-1, Atomic Foreground Refresh, A3 cache/persistence, `fpl:calib` compatibility, EB-1, Production-Bundle Safeguards, State-Ownership Cleanup, Route-Aware M1 and A3-SC-1 are complete and merged. A3 closeout is complete. GW1-P1 is merged through PR #118 at `58b834a…`, and the GW1 readiness safety guard is delivered and physically accepted on PR #121.

GW1 readiness remediation is complete: the audit found no blockers, and its two should-fix items are addressed. It authorised **no** model, provider, fixture, expected-minutes, scoring, squad, captaincy, transfer, optimiser, simulation, rank or Mini-League change, and none was made.

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
8. [GW1-P1 Cloudflare Evidence Foundation](docs/GW1-P1-CLOUDFLARE-EVIDENCE-FOUNDATION.md) and [GW1-P2 Browser evidence delivery](docs/GW1-P2-BROWSER-EVIDENCE-DELIVERY.md)
9. Before provider or security work: [Data Sources](docs/DATA_SOURCES.md) and [Security](docs/SECURITY.md)
10. Before model, projection, fixture, squad, captaincy, optimisation, rank or Mini-League calculation work: [Projection Model](docs/PROJECTION_MODEL.md) and [Testing](docs/TESTING.md)
11. Before any new external-data, provider-evaluation, shadow-evidence or ablation proposal: [External Intelligence Foundation](docs/EXTERNAL-INTELLIGENCE-FOUNDATION.md)
12. Before Decision Intelligence work: [Decision Intelligence DI-0 Foundation](docs/DECISION-INTELLIGENCE-FOUNDATION.md)
13. Historical A3 records only when needed: [A3-SC-1 Small Stale-Code Cleanup](docs/A3-SC-1-SMALL-STALE-CODE-CLEANUP.md), [Route-Aware Rendering and Performance](docs/ROUTE-AWARE-RENDERING-PERFORMANCE.md), [A3 State-Ownership Cleanup](docs/A3-STATE-OWNERSHIP-CLEANUP.md), [A3 error-boundary separation](docs/A3-ERROR-BOUNDARY-SEPARATION.md) and [Historical Records](docs/HISTORICAL_RECORDS.md)

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


<!-- DATA-S1-2026-08-22 -->
## DATA-S1 repository foundation — 22 August 2026

The separately approved [DATA-S1 Shadow Structured Data Foundation](docs/DATA-S1-SHADOW-STRUCTURED-DATA-FOUNDATION.md) adds the isolated, provider-neutral `teamsheet-data-platform` repository service and separate future `teamsheet-data` D1 binding. Only `shadow_only` is valid. It has no production/browser/model/Provider Health read path, no new R2, no provider activation and no Google Sheets integration; existing Stage 10 D1/R2 custody remains separate and unchanged. No live infrastructure was created or modified. PR #145 is merged and repository-verified, but DATA-S1 remains **not live deployed**. DATA-S1A is the current control reconciliation. The separately owner-gated sequence is DATA-S1B live Cloudflare preflight/deployment/acceptance, DATA-S2 Official FPL structured history, DATA-S3 automated Official outcomes, DATA-S4 provider trials/evaluation, DATA-S5 downstream Sheets automation, then later explicit production/model gates. See the [DATA-S1B plan](docs/DATA-S1B-LIVE-DEPLOYMENT-ACCEPTANCE-PLAN.md).

Effective **22 August 2026**, the owner superseded the blanket £0 recurring-cost constraint: free remains preferred where comparable, while a small paid provider may be considered only with explicit pricing, rights and value/cost justification, preferably after a shadow trial. This approves no provider and does not rewrite historical research conducted under the former constraint.
<!-- EXTERNAL-INTELLIGENCE-EIA1-2026-08-30 -->
### Current external-intelligence checkpoint — EIA-1 review candidate

EIA-1 adds pure offline adapters for existing snapshot/outcome/DATA-S2B exports and a provider-neutral workload contract. DATA-S2B remains live-unaccepted and is fixture-proven only. TheSportsDB is `local_research_only`, durable retention is blocked, and qualification is FAIL for expected-minutes workload evidence. No signal, provider, model, recommendation, UI or infrastructure behaviour changes. See [EIA-1](docs/EXTERNAL-INTELLIGENCE-EIA1-XMINS-EVIDENCE.md).

<!-- DATA-S2B-E2A-2026-09-01 -->
### Current DATA-S2B checkpoint — E2A repository-only D1 REST validation candidate

E2A adds deterministic synthetic atomicity, affinity, statement/body and 9,860-write analogue plans plus an unforgeable E2A-factory fake-transport harness, phase-specific derived empty/setup schema fingerprints, exact-table-set disposable-identity firewall, no-retry ambiguity classifications and sanitized evidence. It performs and approves no Cloudflare request, account/token/resource inspection, D1 creation/query/mutation, workflow, Cron or deployment. It proves no live REST atomicity, affinity or size behaviour. E2B/E2C/E2D require separate explicit owner approval. See [E2A record](workers/data-platform/DATA-S2B-E2A-REPOSITORY-D1-REST-VALIDATION.md).

<!-- DATA-S2B-E2C-A-2026-09-01 -->
### DATA-S2B E2C-A repository-only live-validation contract

E2C-A adds inert, fail-closed disposable-D1 experiment plans, an identity-bound authentic-plan-only HTTP adapter, a strict Cloudflare-shaped response decoder, pre-mutation exact metadata and clean-INITIAL-schema gates, closed post-setup object-set plus semantic-schema enforcement, closed adapter-to-orchestrator composition, quote-aware CHECK canonicalisation, response/state-paired atomicity acceptance, reconcile-then-stop mutation ambiguity handling, W00/W01 reconciliation and strictly bounded sanitized evidence including canonical UTC timestamps. It performs no Cloudflare request and proves no live atomicity, parameter affinity or request-size behaviour. Any live experiment, credential, resource, workflow/environment, cleanup or production decision remains separately owner-approved. See [E2C-A record](workers/data-platform/DATA-S2B-E2C-A-LIVE-VALIDATION-CONTRACT.md).

<!-- DATA-S2B-E2C-B-2026-09-01 -->
### DATA-S2B E2C-B disposable live experiment preparation

E2C-B makes production-account fingerprinting mandatory, adds exact returned-value affinity/storage acceptance, preserves missing versus zero provider metadata with bounded attempts, and adds a dormant manual-only exact-main/exact-Verify protected workflow with rerun rejection and no cleanup. It is repository-only: no resource, credential, environment, workflow dispatch or Cloudflare request occurred. See [E2C-B record](workers/data-platform/DATA-S2B-E2C-B-DISPOSABLE-LIVE-EXPERIMENT-PREPARATION.md).

The corrected boundary takes the approved disposable-account fingerprint independently from the protected environment, proves the runtime raw disposable account hashes to it and proves it differs from production before transport. Evidence end time is captured only after the awaited contract settles, on success or failure; it cannot be caller-precomputed.
