# TESTING.md

## DI-1 permanent contract suite

`tests/decision-intelligence-platform.test.mjs` covers valid/invalid admission, deterministic identities, display-name rejection, subject/season/fixture mismatch, distinct and impossible timing, deadline eligibility, rights failure closure, registry uniqueness, signal/version and approval scope exactness, secret rejection, malformed/stale/conflicting isolation, Provider Health invariance, unavailable production reads and forbidden production import paths. These are architecture/safety tests; they make no model-accuracy claim and exercise no provider or live store.

<!-- DATA-S2B-PHASE4B-CRON-ACTIVATION-PREPARATION-2026-08-28 -->
## Phase 4B Cron-activation preparation coverage

`tests/data-s2b-phase4b-cron-activation.test.mjs` permanently pins the intended candidate and rollback Version IDs, `*/30 * * * *` schedule, Worker/hostname/compatibility/season/binding/D1 anchors, exact Schedules PUT allowlist, executable schedule-response fixtures, immutable postflight, manual-only exact-main workflow gate, protected-credential ordering, cleanup, and the absence of Version/Deployment/D1/domain/Access/secret/collector or Wrangler mutation paths. Executable injected-transport tests additionally prove the explicit 15-second request bound, mutation-timeout ambiguity, exactly one read-only schedules reconciliation, `TARGET_PRESENT`-only postflight, fail-closed `ABSENT`/`UNEXPECTED`/`UNPROVABLE`, no second PUT, and ordinary-read timeout failure. The remediated repository-only candidate contains **1,189 tests**, subject to final full-suite confirmation. **No DATA-S2B production Cloudflare read or mutation was performed by this repository-only preparation task.** An unrelated automatic `teamsheet-fpl-gateway` preview build/check is not a DATA-S2B production mutation.

<!-- DATA-S2B-PHASE4B-LATEST-INHERITANCE-REMEDIATION-2026-08-28 -->
## Phase 4B `latest` inheritance remediation coverage

`tests/data-s2b-phase4b-version-upload.test.mjs` permanently requires literal `latest` for exactly the inherited D1 and retained-secret bindings, forbids an inherited UUID or exposed secret text, and retains `bindings_inherit=strict` plus the one-endpoint mutation allowlist. It pins the final immediate latest==expected-active and rollback checks, the precise pre-upload snapshot, no retry/reconciliation requirement for ambiguous outcomes, and post-success provenance: exactly one new newest Version, returned-ID equality, both active/rollback anchors, resolved D1 identity, secret binding shape, season/compatibility, unchanged Deployment/Cron/D1/domain and passing authenticated health. Structural checks continue to forbid Deployment, Schedule, D1-write, Access, secret, route/domain, collector and Wrangler mutation paths.


<!-- DATA-S2B-PHASE4B-READONLY-PREFLIGHT-CANDIDATE-2026-08-28 -->
## Phase 4B mutation-free live-preflight permanent coverage

`tests/data-s2b-phase4b-readonly-preflight.test.mjs` proves exact Worker/hostname/active/rollback/configuration identities, sole-Version 100% traffic, exact bindings without secret exposure, empty-Cron/D1 governance and size contracts, authenticated-health semantics, the exact read endpoint allowlist, validated `SELECT`-only D1 POST transport, rejection of every mutation class, sanitized all-zero mutation accounting, absence of Official acquisition/collector paths, and manual exact-main/CI/protected-credential workflow separation. It now pins `data-s2b-phase3-deployment`, `workflow_dispatch` as the only trigger, the exact mapping from `CLOUDFLARE_PHASE3_DEPLOY_TOKEN` to the helper's `CLOUDFLARE_API_TOKEN`, the exact five-name secret reference set, absence of `CLOUDFLARE_WORKER_UPLOAD_TOKEN`, `CLOUDFLARE_D1_WRITE_TOKEN` and any direct `CLOUDFLARE_API_TOKEN` secret reference, and absence of upload/deploy/collector execution or raw secret serialization. Runs `33170157089` and `33171701995` both failed before any request, under the former Phase 0 and Phase 2 environments respectively; the corrected workflow then passed as run `33173358713` on exact `main` `e45828ad34273eb71d7d6ae928e0931c30b4e95f`.

<!-- DATA-S2B-PHASE4B-REPOSITORY-CANDIDATE-2026-08-28 -->
## DATA-S2B Phase 4B permanent safety coverage

`tests/data-s2b-phase4b-version-upload.test.mjs` pins Phase 4 config while proving frozen Phase 2 rejection, exact modules/config/bindings, deterministic hashes/metadata, D1 and retained-secret inheritance pinned to the exact verified active Version ID, one-shot ambiguity reconciliation, immutable Cron/D1 state and the exact `/versions` mutation allowlist. `tests/data-s2b-phase4b-deployment.test.mjs` pins explicit candidate/active identities, sole-Version 100% bodies, the exact `/deployments` mutation allowlist, pre/post health and immutable-state brackets, read-only ambiguity reconciliation, exact one-shot rollback and incident classification for Cron/D1 drift. Both statically prove manual exact-main CI gates, protected credential ordering, Node `24.19.0`, workflow separation and absence of Wrangler deploy/trigger commands. The Version-upload workflow tests additionally pin `workflow_dispatch` as the only trigger, the exact 40-character approved-SHA pattern, exact repository identity, checkout of the approved SHA in both jobs, remote-`main` equality, clean-tree and exact-head `Tests and deterministic build` gates before any credential, the protected environment `data-s2b-phase3-deployment`, the exact mapping from `CLOUDFLARE_PHASE3_DEPLOY_TOKEN` to the helper's `CLOUDFLARE_WORKER_UPLOAD_TOKEN`, the exact five-name secret reference set, absence of `secrets.CLOUDFLARE_WORKER_UPLOAD_TOKEN`, `secrets.CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_D1_WRITE_TOKEN` and the superseded Phase 0/1/2 environment names, and `workers/data-platform/phase4b/upload-version.mjs` as the sole executed script with no deployment, preflight, migration, closeout, collector or Wrangler invocation. The Phase 4B upload-environment correction candidate baseline is **1,167 passed, 0 failed, 0 skipped, 0 cancelled**; the earlier Phase 4B repository candidate recorded 1,149 on its own head.

<!-- DATA-S2B-PHASE3-REPOSITORY-GATE-2026-08-27 -->
## DATA-S2B Phase 3 permanent deployment-gate coverage

Permanent tests pin the candidate, rollback and active-deployment identities; exact 100%-only Deployment bodies; exact-main/CI-to-protected-environment ordering; a dedicated non-cancelling concurrency group; no-Version-creation history checks; exact Version Detail binding/compatibility checks; old-production authenticated health bracketed by immutable checks before the candidate Deployment is reachable; behavioural proof that health failure submits no Deployment; immutable Cron/D1/domain/health candidate postflight; rollback health bracketed by immutable checks; one-shot rollback; definite-rejection versus ambiguous-state outcome classification; read-only ambiguity reconciliation; explicit outcomes; credential masking; sanitized artifacts; and absence of Version-upload, Cron, D1-write, route/domain, Access, secret, collector and retry paths. No live workflow dispatch is part of repository testing. See [Phase 3 deployment gating](../workers/data-platform/DATA-S2B-PHASE-3-DEPLOYMENT-GATING.md).

<!-- DATA-S2B-PHASE0-CANDIDATE-2026-08-26 -->
## DATA-S2B Phase 0 permanent safety coverage

`tests/data-s2b-phase0-readonly.test.mjs` behaviorally verifies SQL validation, missing-credential failure, HTTP 401/403 classification, Cron drift, migration drift, rollback evidence and `NOT PROVABLE` metrics. It also structurally verifies the manual-only immutable-SHA workflow, pre-credential identity/CI ordering, executable mutation-command absence, fixed SQL inputs, redaction/debug policy, application/runtime isolation and the unchanged synthetic 6,825 invariant.

The suite also exercises the first-party Cloudflare response contracts at their extraction boundary: deployment and schedule wrappers, Worker Settings bindings using current `type: "d1"` plus `database_id`, D1 database/query result arrays and the Workers domains array. The complete Worker binding set is allowlisted to exactly `TEAMSHEET_DATA_DB` (`d1`) and `DATA_S2_SEASON` (`plain_text`): missing, duplicate, wrong-type, extra KV/R2/service/secret/plain-text or arbitrary bindings fail closed before individual value/identity checks. Missing/malformed wrappers and database-identity mismatch also fail closed; the deprecated `d1_namespace`/`id` binding shape is not accepted.

Final-review fixtures separately prove that D1 list identity is followed through the documented UUID-based Get Database path to a details response containing matching `uuid`/`name` and finite non-negative `file_size`; both database-name path substitution and treating the list record as size metadata are rejected. Deployment fixtures require Cloudflare's documented first-array-entry active ordering even when a historical entry has a later-looking timestamp, plus malformed-current, active-version ambiguity and genuinely distinct rollback failures. Custom-domain HTTP 403 remains optional `NOT PROVABLE`, while 401/404, malformed responses and transport failures fail closed. SQL adversarial cases include quoted unsafe words, every prohibited verb, comment/semicolon evasion, unterminated comment/string and a non-`SELECT` first token.

<!-- DATA-S2A-2026-08-26 -->
## Current DATA-S2A repository verification

DATA-S1C-R supersedes the RPC/custom-HTTP path for forward collection; the permanent DATA-S1C tests below preserve historical architecture and failure evidence rather than define DATA-S2 transport. DATA-S2A's permanent suite verifies fixed Official FPL `bootstrap-static`/`fixtures` allowlists, explicit nulls, fail-closed population/reference validation, exact **6,825** baseline candidates, delta-only append history, atomic heads, lifecycle disappearance/reappearance, the 15,000-change guard, bounded bulk D1 statements, source governance, direct scheduled D1 wiring and absence of production application influence.

The current repository baseline is **1,036 passed, 0 failed, 0 skipped, 0 cancelled**, plus production build, deterministic byte identity, root/deployable equality, exact build identity, committed provenance and exact-head Verify Teamsheet. This is repository evidence only: no live baseline, unchanged cycle, changed fact, D1 accounting, Workers Free CPU suitability, deployment, D1 mutation or Cron activation is proven. DATA-S2B begins with a mutation-free Phase 0 preflight; every later live migration, Worker version upload/deployment and Cron activation remains separately owner-approval-gated with rollback/stop on failure.

## DATA-S1C permanent acceptance-workflow verification

`tests/data-s1c-private-rpc-workflow.test.mjs` permanently checks the manual-only trigger, no-input and read-only GitHub permissions, immutable event-SHA/current-remote-main gate, approved secret-name allowlist, exact Node/Wrangler pins, temporary read-only probe, fetch-before-health-before-query sequencing, 20-page bound, forbidden mutation/debug/artifact patterns, unconditional post-functional topology verification after an established PRE-state, independent preservation of functional/topology failure, and unconditional cleanup. The workflow tests also exercise zero-row, one-row, two-row/no-cursor and real-cursor-continuation result shapes, including the HTTP 400 `cursor_invalid` mismatch contract. A successful read RPC is not treated as proof of unsupported row-dependent properties: insufficient existing rows remain `NOT PROVABLE`, and no synthetic production write is used to manufacture pagination evidence. The topology-reader tests execute representative classifications for HTTP 401/403/404/other, network failure, malformed JSON, numeric Cloudflare error codes, invalid `result.deployments` and invalid active-version state; they also prevent response bodies, messages or credentials from entering diagnostics and require a skipped functional step to be summarized as `NOT RUN`.

The first manual workflow attempt, run `32896875022`, established that both environment secrets were present and non-empty but failed closed during PRE-state before functional acceptance. No Wrangler process or edge-preview session started, and no caller or D1 operation ran. Because the original output gave only a generic PRE-state failure, it did not establish whether the cause was network, HTTP authentication/authorization/resource access, JSON or contract validation. The categorical diagnostic remediation is repository evidence only; it has not been executed, no successful DATA-S1C acceptance is claimed, and any later run remains separately owner-approved. GitHub Actions remains the fallback because Codex remote-preview transport failed with `ENETUNREACH` before the caller.

Second manual run `32899866456` passed caller PRE validation but stopped at target `ACTIVE_VERSION_INVALID`; functional fetch, health and query were `NOT RUN`. Follow-up reads proved the target pin was current and exposed a history-extraction defect: eight historical deployment records each retained a 100% allocation, while only the unique latest record represented the current allocation. Executable regression cases now cover one deployment, eight historical deployments, unsorted history, newest-version mismatch, zero/multiple current 100% allocations, empty history, invalid timestamps, equal-latest ambiguity and invalid current versions. Both embedded PRE/POST classifiers must select the unique greatest valid `created_on` and ignore historical allocations. This remediation remains repository-only and is not successful live acceptance evidence.

Third manual run `32902010718` passed both PRE checks and reached the acceptance caller's empty-404 fetch discriminator. Cloudflare observed the following JSRPC `health` call terminate with its runtime hang exception; health was not accepted and query remained `NOT RUN`, while POST topology and cleanup passed. Permanent caller tests now require `health()` and `queryObservations(query)` to be async, to await downstream custom thenables into ordinary resolved results, and to propagate downstream rejection. They retain executable empty-404 fetch coverage, the exact single read Service Binding and the absence of ingest/storage/generic-dispatch capability. This is repository evidence only; another live run remains separately owner-approved.

After PR #156 merged, the corrected acceptance caller was deployed alone from exact main as version `cf9c150d-84b0-46f9-a166-530b7243e863`; the previous live attempts had still executed `43d28a3a-5720-48b3-950e-b081e33bcc8b`. Workflow regressions require the new caller ID in both PRE and POST, forbid the old ID, and retain the exact unchanged target pin `5edbe951-4be4-46bc-b2cf-17b550396105`, current-deployment history selection, manual trigger, least privilege and mutation prohibitions. The deployment itself invoked no caller method and supplies no successful RPC acceptance evidence.

Run `32906524221` used the awaited caller version but the caller `health` JSRPC still ended in the runtime hang exception; target query remained unrun while topology and cleanup passed. Option 2 regression coverage now requires the temporary probe's sole functional binding to be `DATA_PLATFORM_READ -> teamsheet-data-platform -> DataPlatformReadEntrypoint` with `remote: true`, forbids every `CALLER` invocation in the functional probe, and requires direct health before bounded direct query. Existing query evidence shapes, exact caller/target PRE/POST pins, deployment-history parsing, unconditional POST/cleanup and final fail-closed enforcement remain. The sanitized summary must say `caller forwarding result: NOT PROVEN`; a direct-target success cannot satisfy that separate property.

<!-- DATA-S1B-PREFLIGHT-CURRENT-2026-08-23 -->
## Current repository gate — DATA-S1B mutation-free preflight PASS

**Supersedes older current baseline claims below; their historical results remain evidence for their own commits.** The DATA-S1B mutation-free live preflight is complete and **PASS**, with the final phase-gated procedure in the [DATA-S1B Final Preflight and Deployment Runbook](DATA-S1B-FINAL-PREFLIGHT-AND-DEPLOYMENT-RUNBOOK.md). DATA-S1 remains **NOT LIVE DEPLOYED**. No DATA-S1 Worker, production or validation D1, migration, Access configuration, service token, DNS/Custom Domain, route or production binding was created. Owner evidence records **Workers Free — Active** and current/projected billable usage **$0.00**; execution must remain within Workers Free/D1 Free limits and stop rather than upgrade.

The reviewed PR #147 candidate gate is **986 tests passed, 0 failed, 0 skipped, 0 cancelled**, research/document integrity, deterministic byte-identical builds, root/deployable equality, exact build identity, committed provenance and exact-head Verify Teamsheet. Merge authorizes **no Cloudflare mutation**. After merge, re-read latest GitHub `main` and require the same Verify Teamsheet gate on the exact merge commit. Only then may the owner consider the separately gated **Phase 2 disposable D1 validation**. DATA-S2 remains blocked until DATA-S1B live deployment/acceptance fully closes. The delivered GW1 readiness checkpoint remains PR #121 as historical application evidence. No model, provider, fixture, captaincy, squad, transfer, simulation, rank, Mini-League or application behaviour changed.

<!-- GW1-P2C5-CURRENT-2026-08-22 -->
## Historical GW1-P2C5 live acceptance evidence

Separate from the unchanged 971-test repository baseline, one physical iPhone Safari acceptance passed for the fixed synthetic `2099-00`/GW38 fixture: browser terminal `Archived`, exact accepted D1 receipt, exact D1 manifest and exact R2 metadata with matching identity, size, stored SHA-256 and R2-first/D1-second timestamps. This is live infrastructure evidence, not an automated-test substitute and not evidence of natural Stage 10 capture or Official eligibility. The temporary implementation PR #143 was closed unmerged and production restored to `main`. See [GW1-P2C5 closeout](GW1-P2C5-STAGE10-PRODUCTION-PATH-ACCEPTANCE-CLOSEOUT.md).

<!-- GW1-P2C3B-CURRENT-2026-08-22 -->
## Historical GW1-P2C3B acceptance evidence

The historical GW1-P2C2 automated baseline was **971 tests, 971 passed, 0 failed, 0 skipped, 0 cancelled**. Separately, owner-supplied physical evidence from a real iPhone in normal Safari with Prevent Cross-Site Tracking ON directly demonstrated same-site browser transport: OPTIONS 204, matching deliberately invalid `{}` POST 422, and readable `{"error":"envelope_schema"}`. No additional physical probe was performed for this repository closeout.

This is transport-only evidence. Automated tests and the physical invalid-body invocation do not prove genuine Stage 10 custody, D1/R2 persistence or idempotency; literal physical ACAO, ACAC and `Vary` response values were not directly captured. Older wording below that says the sibling-domain physical transport test remains pending is superseded.


<!-- GW1-P2C2-CURRENT-2026-08-21 -->
## GW1-P2C2 candidate evidence — 21 August 2026

Merged `main` retains its then-current **907/907** baseline until an approved merge. The GW1-P2C2 candidate tree runs **971 tests, 971 passed, 0 failed, 0 skipped, 0 cancelled**; the intermediate branch counts of 918 and 940 are superseded. Focused coverage pins the exact custom archive endpoint/CSP, the dual exact-origin migration allowlist, credentialled browser delivery semantics and PR #137's single adapter-level credential authority. `tests/evidence-delivery.test.mjs` is the reconciled PR #119 behavioural suite — canonical bytes delivered unchanged, content-hash idempotency, durable outbox across a simulated restart, bounded retry/backoff, Access identity gaps kept distinct from rejection, fail-closed provider retention, single-flight concurrency and the guarantee that an archive fault never mutates canonical evidence — with its transport target moved to the approved sibling subdomain. `tests/gw1-p2c2-same-site-transport.test.mjs` additionally drives both Workers from their own deployed Wrangler `ALLOWED_ORIGINS` so the new application origin is proven admitted, and every other origin proven fail-closed, rather than only asserted as configuration text.

This branch result is repository evidence only. Final PR acceptance still requires the permanent Verify Teamsheet workflow on the exact final head, including committed provenance, the complete suite, two deterministic builds, root/deployable equality, exact build identity and preservation of committed production outputs. No repository test substitutes for the later physical iPhone Safari custom-domain acceptance.


## Current repository baseline

**Current reviewed candidate result: 986 tests, 986 passed, 0 failed, 0 skipped, 0 cancelled**, with production build, committed provenance, deterministic exact-identity rebuild, root/deployable equality, exact build identity and production-output preservation. Earlier counts recorded elsewhere in this file (985, 971, 940, 918, 907, 904, 898, 883, 868, 866, 864, 859, 856, 842, …) are permanent checkpoint evidence for their own commits and are not current claims. This document does not restate the current `main` commit SHA; exact-head PR verification and exact-merge post-merge verification remain separate required gates.

### GW1 readiness safety guard coverage

The pre-GW1 Transfers guard delivered on PR #121 adds `tests/gw1-initial-squad-guard.test.mjs` (14 regressions) and one documentation-integrity regression. The guard suite pins the derivation rule and its exact boundaries — open only before the official GW1 deadline; closed at the deadline instant and after; closed for any other Gameweek context; closed as `deadline_unavailable` for every missing, non-list, absent or unparseable deadline and for an unusable clock, so no false unlimited-change claim can be produced. It also pins the runtime contract: the guarded screen starts no worker, claims no optimiser result, presents no free-transfer/hit/ranked-plan advice and hides the planning-assumption inputs; a verified-data change starts no guarded work; entering the guard terminates in-flight work and clears both the stale result and any previewed plan; and a passed deadline, unusable deadline data or a later Gameweek all run the ordinary weekly optimiser unchanged. Source contracts assert that no season-specific date is hard-coded, that the guard cannot enter the optimiser, and that all four runtime entry points consult it.

The documentation-integrity regression pins every owner navigation path the live Stage 10 operating procedure names to a declared application route title and rejects the removed `More →` navigation. It was verified to fail against the pre-fix text before the correction was applied.

Physical device behaviour is never a repository-testable fact. The guarded pre-deadline Transfers screen was physically accepted by Pritesh on iPhone Safari; the **after-deadline transition cannot be physically tested before the real first deadline**, because no approved non-production deadline-override mechanism exists and none was invented. That transition is covered by automated tests only.

## GW1-P2 final-gate boundary

GW1-P2 is an unmerged candidate on draft PR #119. It adds two permanent suites: `tests/evidence-outbox.test.mjs` covers the pure delivery state machine (envelope contract against the real Worker validator, canonical-byte and hash immutability, fixed enqueue time, terminal success/duplicate, permanent rejection, retention fail-closed, bounded backoff and Retry-After, the separate authentication schedule, the amendment-4 configuration-versus-identity 403 split, pinning and visible release, idempotent enqueue, compatibility drops and closed-set outcome strings). `tests/evidence-delivery.test.mjs` covers storage and transport (exact endpoint contract, byte-identical upload, duplicate handling, offline-to-restart-to-success, Access interception and opaque redirect, backend faults with idempotent retry, blocked provider material never sent, recovery imports never queued, pending-record survival, corrupt/unwritable storage, single-flight concurrency, no secret or account identifier persisted, generic user copy, CSP reachability and bundle presence). Existing Worker and CSP suites gained credentialled-CORS and archive-origin regressions.

GW1-P2 browser acceptance is **not** a repository-testable fact. No automated test can prove Safari third-party cookie behaviour, Cloudflare Access preflight handling or live CORS state; those remain owner physical acceptance and live dashboard gates.

GW1-P1 is merged through PR #118 at `58b834a…`. Its backend implementation added permanent Node coverage for canonical Stage 10 parity/mutation rejection, provider-retention gates, R2-before-D1 ordering and R2 read-back verification, duplicate/idempotent ingestion, first-custody preservation, idempotency conflict, R2 failure with no D1 claim, D1-after-R2 orphan recovery, Access RS256 validation, route/origin/method/rate boundaries, safe manifest reads, Cloudflare runtime adapter behaviour and source/deployment mirror parity.

The final preview/version-route audit adds one more repository invariant: both byte-identical evidence Wrangler configs must explicitly set `preview_urls:false`. This prevents the Cloudflare version/alias Preview URL surface from silently following `workers_dev:true` again. Repository verification can prove the config and test contract but never the live route state; **live Cloudflare route state is always a separate acceptance item** and must be evidenced under the Worker's Domains settings or an equivalent negative routing check. For this candidate that separate item is satisfied by owner-supplied 11 August 2026 Cloudflare Domains dashboard evidence recorded in [SECURITY.md](SECURITY.md) and the [GW1-P1 record](GW1-P1-CLOUDFLARE-EVIDENCE-FOUNDATION.md); it is not a repository-testable fact and is not independent assistant testing.

The final PR candidate must run the complete repository gate after every final config/doc change. Required evidence is: exact final head, exact test count with zero failures/skips/cancellations, production build, committed provenance, deterministic exact-identity rebuild, root/deployable equality and production-output preservation. A prior green run on an older head is not final evidence. No physical iPhone testing is newly claimed by this documentation closeout; the production functional acceptance described in the GW1-P1 record was performed by Pritesh on the earlier accepted backend candidate.

GW1-P2 browser saved/pending/failed/offline/upload states are covered by the two suites named above. Their live-device and live-Cloudflare behaviour remains a separate owner acceptance gate.

## Historical — 11 August 2026 A3 engineering baseline

The A3 engineering baseline entering documentation/architecture closeout is GitHub `main` `1060e60d3affadabdf97924c7ece85cc62d8e360`, merge of A3-SC-1 Small Stale-Code Cleanup PR #116 from reviewed head `097fabb6065afc4c322238985eb7f237a503a7c3`. The reviewed tree passed **868 tests, 868 passed, 0 failed, 0 skipped, 0 cancelled** in permanent Verify Teamsheet run #193 / `31469449540`, together with committed provenance, production build, deterministic rebuild, root/deployable equality, exact build identity and production-output preservation.

Permanent post-merge Verify Teamsheet run #194 / `31470879289` then passed the repository verification gate on exact merge commit `1060e60…`. GitHub Pages run #120 / `31470878300` succeeded for the same merge commit. No physical iPhone testing was performed or claimed for PR #116.

PR #116 retained the 866-test PR #115 baseline and added two structural A3-SC-1 regressions. Its first CI failure demonstrated that stale-code investigation must search **test-side consumers as well as application source**. Future stale-code investigations must search production source, test source, shared harness/export lists, mocks/fixtures, runtime replacement mechanisms, generated bundle/deployable surfaces and DOM/event references before a symbol is treated as safely unreachable.

At that checkpoint, the brittle `selectMiniLeague` exact-source-string assertion remained deliberately untouched as narrowly scoped test-hardening debt; it was not a failing test or product defect. PR #124 subsequently replaced that formatting-coupled assertion with behavioural execution of the real function, a whitespace-insensitive structural ownership/delegation contract and mutation-sensitivity coverage, without changing production Mini-League behaviour.

The permanent `verify.yml` completion gate runs `./run-tests.sh`, committed deployment provenance, two exact-identity production builds, deterministic byte comparison, root/deployable equality and exact manifest identity. Its GitHub-owned action runtimes are `actions/checkout@v5` and `actions/upload-artifact@v6`, both on Node 24. This changes CI action runtime only; it adds no project dependency or application behaviour.

Route-Aware Rendering and Performance M1 is complete through PR #115 at `02ea634464cc415ac43d4b9cb13b4005fc276646` on an **866-test** exact-main baseline. M1 is measurement tooling only. Route-aware **optimisation is not approved**, so future tests must follow separately approved evidence rather than presuppose an optimisation.

## Historical checkpoint — 10 August 2026 EB-1 merged verification and iPhone acceptance closeout

A3 Error-Boundary Separation Package EB-1 is merged through PR #108 at `main` `ba5daa2000345ddde3d8e6f6d381d44603e7cd29` from reviewed head `13224f53d7df95a295ee5f69124e99eb64e7a9e9`.

The merged tree contains **856 tests, 856 passed, 0 failed, 0 skipped, 0 cancelled**. All 842 pre-EB-1 tests were retained and the fourteen additions remain in `tests/error-boundary-separation.test.mjs`. Exact candidate head `13224f53…` passed permanent Verify Teamsheet run #153 / `31408465921`. After merge, permanent run #154 / `31410817472` repeated the gate on exact merge commit `ba5daa20…` and passed committed deployment provenance, the complete suite, production build, deterministic rebuild, root/deployable equality, exact build identity and production-output preservation.

Physical iPhone Safari acceptance passed the executable EB-1 paths on the exact candidate: normal online startup, manual online refresh, in-app offline refresh retaining saved verified data, and return-online recovery. A clean Private Safari tab opened while already offline could not load the uncached GitHub Pages application shell, so the no-core clean-offline application state remains automated-test evidence rather than a device failure. The acceptance session used an incomplete manual squad, so device evidence proves retained verified core data but does not independently prove survival of a previously available recommendation. GitHub Pages was restored to `main` before merge.

No projection, expected-minutes, scoring, fixture, captaincy, squad, transfer, optimisation, simulation, rank, Mini-League/rival, provider endpoint, retry cadence or weighting behaviour changed. At that historical checkpoint Production-Bundle Safeguards was next; it and the later State-Ownership Cleanup are now complete and merged.

## Historical candidate verification — `fpl:calib` compatibility

PR #107 added six focused calibration-compatibility regressions: legacy bytes are preserved but rejected; malformed JSON fails closed; speculative versioned records remain rejected before a methodology is approved; startup activation remains behind `sget(K_CAL)`; the current walk-forward path remains diagnostic-only with no calibration writer; and the existing scoring multiplier formula is unchanged. The full suite was 842 passed, 0 failed, 0 skipped, 0 cancelled. Normal Verify Teamsheet run #123 passed provenance, the complete suite, deterministic double build, root/deployable equality, build identity and artifact preservation on head `69e539647ae687f49605633505e7147da76125e2`. PR #107 subsequently merged and PERSIST-4 is closed; this paragraph remains the candidate-era evidence record.

## 10 August 2026 — PR #103 physical acceptance closeout

The final Small Mobile UI Consistency + Loading Viewport Fix application source is `646eee13960c343fbe07e3a76496717fd9837c0e`, with generated-only child `81cc9130ac2c7b8206f3bd5f6a2cf85bb5ba0777`. The final candidate retains every prior test and passes **803 tests, 0 failed**, deterministic byte-identical builds, root/deployable equality, exact build identity and reachable generated provenance. Permanent Verify Teamsheet run #90 / `31356255017` passed on the exact generated head.

Physical iPhone Safari acceptance is complete: the startup canvas reaches Safari chrome without a light strip; Team, Transfers, Fixtures, Leagues and Settings use the accepted shared header hierarchy; the refined editable/selectable controls are visually proportionate while retaining the no-focus-zoom behaviour; and the Leagues primary box now aligns vertically with the other primary screens. Pritesh explicitly approved PR #103 for merge on 10 August 2026.

No projection, expected-minutes, scoring, fixture, captaincy, squad, transfer, rank, Mini-League/rival, provider, data-source, Atomic Foreground Refresh, navigation, Team-renderer or Player Detail behaviour changed. At documentation closeout, GitHub `main` remained `d5f2572ee4d95c3c242ecbc97ee46802a6f0273d`; the eventual merge commit must be read from latest `main` rather than inferred from this pre-merge documentation commit.

## 10 August 2026 — final verification state

PR #103 final source `646eee13960c343fbe07e3a76496717fd9837c0e` and generated-only child `81cc9130ac2c7b8206f3bd5f6a2cf85bb5ba0777` pass **803/803** tests. Publication run `31356159321` passed before branch publication; permanent Verify Teamsheet run #90 / `31356255017` passed every exact-revision, committed-provenance, full-suite, production-build, deterministic-byte, build-identity and artifact-preservation stage. Physical iPhone Safari acceptance passed all four presentation findings and merge is explicitly owner-approved.

## GW1-P1 evidence-backend verification and the GW1-P2 client gate

[Data Architecture D1](DATA-ARCHITECTURE-D1.md) was originally a documentation-only decision. The separately approved GW1-P1 backend checkpoint now implements and tests the canonical pre-deadline archive foundation. Its permanent backend suites are `tests/evidence-archive-worker.test.mjs`, `tests/evidence-archive-cloudflare.test.mjs` and `tests/evidence-archive-layout.test.mjs`.

GW1-P1 verification covers exact Stage 10 record parity, canonical/hash mutation rejection, fail-closed provider retention, R2-first/D1-second ordering, duplicate/idempotency behaviour, R2 and D1 partial-failure contracts, orphan reconciliation with first-upload preservation, Access JWT validation, exact CORS/method/route/payload/rate boundaries, generic/redacted failures, source/deploy parity, D1/R2/migration configuration and explicit Preview URL disable. The full repository deterministic/provenance/build gates remain mandatory even though GW1-P1 changes no application build input.

The **GW1-P2** client gate remains separate from GW1-P1's backend gate: persistent local outbox compatibility, non-blocking upload, honest saved/pending/failed/offline states, retry/recovery across reload and no recommendation dependency are now covered by the two GW1-P2 suites named in the current-boundary section above. Physical iPhone acceptance of those browser states is still outstanding and is not a repository-testable fact. Existing live-season evidence gates also remain unchanged.

<!-- FIXTURES-ACCEPTANCE-2026-08-07 -->
> **Historical Fixtures acceptance verification:** PR #86 exact head `be90b4f25b90472a3f30b3b765e56d23d8d95862` passed **660 tests, 660 passed, 0 failed, 0 skipped, 0 cancelled** in permanent Verify Teamsheet run `31198545580`, with deterministic byte-identical double builds, root/deployable equality and exact manifest identity. The merged tree was deployed at `e49599a75bbb77618292fdb6100fcffd81685c44`; owner iPhone Safari acceptance passed for GW23 reachability, sticky TEAM behaviour beyond GW12 and GW38 boundary normalisation. No model formula, provider, source or golden expectation changed.

<!-- FIXTURES-MOBILE-SCROLL-TESTING-2026-08-07 -->
> **Historical PR #85 verification — accepted:** four focused regressions cover truthful fallback-aware copy, a non-scrolling mode explanation, a shared sticky TEAM header/body column and removal of the left scrolling gutter. PR #85 reached **656 passed, 0 failed, 0 skipped, 0 cancelled** and its deployed mobile path was physically confirmed during the subsequent Fixtures acceptance sequence.

<!-- TEAM-ACCEPTANCE-2026-08-07 -->
> **Historical Team populated-acceptance checkpoint:** PRs #80–#83 merged through `385e5102c0e86e4b926503bffceba08bd6d831c3`. Exact PR #83 head `990a85eb69319064038be458081d029d8a3b8828` passed **652 tests, 0 failed, 0 skipped, 0 cancelled**, deterministic byte-identical double-build verification, root/deployable equality and exact manifest build identity. Pritesh physically accepted startup ownership, availability, reserve-goalkeeper display, outfield bench order and narrow unavailable-label presentation on iPhone Safari. Fixtures and the Leagues pre-season path were accepted later. No calculation, provider, data-source or security behaviour changed.

<!-- T02-BENCH-GK-AVAILABILITY-FOLLOW-UP-2026-08-07 -->
> **Historical T-02 bench/availability follow-up state — superseded by the Team merge record:** physical iPhone evidence after PR #81 exposed a visual bench-role mismatch and incomplete availability centring. The approved review branch changes display ordering only: reserve GK first, then the pre-existing outfield bench order; `bestXI().bench` remains unchanged. Availability becomes its own centred intrinsic-width row. Verification is **651 passed, 0 failed, 0 skipped, 0 cancelled** before deterministic production-build verification. Final physical iPhone acceptance subsequently passed after PR #83 deployment; see the current Team acceptance record above.

<!-- PR80-REPOSITORY-VERIFICATION-2026-08-07 -->
> **Repository PR verification - introduced with Team UX PR #80:** The verify.yml workflow runs the existing completion gate automatically for pull requests and supports manual workflow dispatch. It checks out the exact PR revision, runs the complete test suite, performs two production builds with that revision as build identity, compares generated outputs byte-for-byte, verifies root/deployable equality and manifest identity, and retains verified production outputs as a short-lived review artifact. It has read-only repository permission, performs no deployment and adds no project dependency. Corrected T-01/T-02 source reached **649 passed, 0 failed, 0 skipped, 0 cancelled** with deterministic builds. A 390x844 first-paint mobile rendering with script execution disabled showed only the startup gate; header, main and the fixed dock were hidden. **Physical iPhone Safari T-01 acceptance subsequently passed on 7 August 2026** against the corrected PR #80 preview: the startup experience owned the viewport and no bottom navigation dock was visible during loading. T-02 could not be physically exercised on the owner's current squad because no player was flagged; that visual check is unperformed rather than claimed, while its starting/bench availability and accessibility wording remain covered by focused automated regressions.
<!-- UX-A2-DOCK-LAYERING-TESTING-2026-08-07 -->
> **Historical merged baseline — PR #78 dock-layering correction:** the focused regression first failed against the pre-correction merged ordering, then passed after the narrow CSS correction. The complete suite is **645 passed, 0 failed, 0 skipped, 0 cancelled**. Two builds using exact source `44154da4190d35b6d6b747f537c19a060892bc14` are byte-identical for all generated outputs, and root `index.html` equals `dist/index.html`. Populated physical iPhone Safari acceptance passed on 7 August 2026. PR #78 merged at `ebb8838e7bfd081371a0639c9b4bdacfc9b92bc6`; GitHub Pages deployment succeeded and the Cloudflare Workers production build succeeded for `teamsheet-fpl-gateway`. `UI-14` is closed.

<!-- UX-A2-2026-08-06 -->
> **UX-A2 Player Detail Scroll and Rotation Correction — merged verification:** UX-A2 merged through PR #76 to `main` at `bffcba8e9231adfc216125913f8ab83c042c3e10`; the branch adds twenty focused behaviour and CSS-contract tests in one new file without deleting, weakening or skipping any existing test and without changing a golden/model expectation. The complete baseline moves from **624** to **644 passed, 0 failed, 0 skipped**. Two production builds using the exact reviewed source commit are byte-identical for `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json`; root `index.html` equals `dist/index.html`. Automated evidence covers exact background-offset capture and restoration, root plus body locking, internal scroll reset, `preventScroll` focus on open and on close, close-button/backdrop/Escape parity, player replacement while open, route-driven close without stale scroll or focus restoration, detached and hidden trigger rejection, viewport-property fallback, flex-scroll constraints, `vh`-before-`dvh` ordering, compact-landscape sizing, four-sided safe areas, the dialog-not-a-route boundary, the root text-size-adjustment contract that stops Safari inflating text on rotation, and the no-inline-style and no-data-reach guards. **Physical populated iPhone Safari acceptance passed on 6 August 2026** and is recorded in `UX-A2-ACCEPTANCE.md`; the rotation text-inflation defect it exposed was corrected and physically retested successfully. The device script below is retained as the reusable procedure, not as an outstanding gate. VoiceOver is not a Teamsheet acceptance gate.

<!-- UX-A1-2026-08-06 -->
> **Historical status superseded — UX-A1 Team Resources and Bench Clarity:** the original review branch added eleven focused presentation contracts without changing a golden/model expectation and reached **624 passed, 0 failed, 0 skipped** with deterministic builds and root/deployable equality. Populated physical iPhone Safari acceptance subsequently passed on 6 August 2026 and PR #74 merged. Earlier wording describing device acceptance as pending is superseded by `UX-A1-MERGE-RECORD.md`. VoiceOver is not a Teamsheet acceptance gate.

<!-- TRANSFERS-TRACK-A-2026-08-06 -->
> **Historical Track A review state — superseded by the merged checkpoint:** the first populated iPhone Safari exact-search attempt exposed the evaluation ceiling and a later retest exposed the separately returned zero-transfer baseline presentation defect. Those issues were corrected without changing the approved football problem, comparator, candidate universe, horizon or evaluation ceiling. The final accepted Track A checkpoint is merged through PRs #69, #70 and #72 with **613 passed, 0 failed, 0 skipped**, deterministic builds and populated iPhone Safari acceptance for the tested calculation/lifecycle paths. VoiceOver is not a project acceptance gate. That Track A checkpoint and the later PR #78 baseline are historical; the current repository baseline is recorded below.

> **Historical FPL-T1 review verification:** the owner-controlled Official FPL gateway review reached **590 passed, 0 failed, 0 skipped** with deterministic builds, exact Worker/CSP configuration and successful physical iPhone live bootstrap transport. FPL-T1 subsequently merged through PR #69 and Track A through PRs #70 and #72. This historical 590-test checkpoint is not the current repository baseline.
Purpose: test architecture and rules of engagement. Audience: every session before coding.
Last reconciled: 2026-08-12. Related: tests/, CLAUDE.md, STAGE8-DESIGN.md, STAGE10-ITEM3.md, GW1-P1-CLOUDFLARE-EVIDENCE-FOUNDATION.md, GW1-P2-BROWSER-EVIDENCE-DELIVERY.md.

## Exact-head verification rule

Every candidate must be judged by its **final exact head**, not by an earlier green candidate. The exact final test count and final Verify Teamsheet run belong in the PR description once the final source/config/documentation commit has completed the permanent workflow. Until that run is green, the prior successful runs are historical evidence only. This rule applied to PR #118 and applies now to PR #119 and to any documentation-only PR.

A checkpoint that changes no application build input or generated application deployable — including a documentation-only checkpoint — still requires the ordinary production build, deterministic rebuild, committed provenance, root/deployable equality, exact manifest/build identity and production-output preservation, so a backend or docs checkpoint cannot accidentally drift the deployed app.

Live production functional acceptance recorded in `GW1-P1-CLOUDFLARE-EVIDENCE-FOUNDATION.md` was performed by Pritesh on physical iPhone Safari, and the explicit `preview_urls:false` config received its separate post-deployment live proof from owner-supplied Cloudflare Domains dashboard evidence on 11 August 2026. No automated test can substitute for live Cloudflare route state, Access dashboard state or Safari cross-site cookie behaviour; those remain owner acceptance items in every checkpoint.

## Historical A3 verified baseline

The A3 engineering baseline entering documentation/architecture closeout is PR #116 merge commit `1060e60d3affadabdf97924c7ece85cc62d8e360`. The reviewed head `097fabb6065afc4c322238985eb7f237a503a7c3` passed **868 tests, 868 passed, 0 failed, 0 skipped, 0 cancelled** in Verify Teamsheet run #193 / `31469449540`, with committed provenance, the complete suite, production build, deterministic rebuild, root/deployable equality, exact build identity and production-output preservation. Post-merge run #194 / `31470879289` passed the repository gate on the exact merge commit.

The preceding Route-Aware M1 PR #115 merged at `02ea634464cc415ac43d4b9cb13b4005fc276646` on an **866-test** exact-main baseline. The preceding A3 State-Ownership Cleanup PR #112 merged at `691d9f929284d51c233b61d099c34cafe1030db6` on an **864-test** baseline. Those counts are valid historical checkpoint evidence, not the current repository baseline.

No test or golden was deleted, weakened, regenerated or skipped by PR #116. Route-aware **optimisation** remains unapproved; test additions must follow evidence rather than presuppose an optimisation.

Physical PR #112, PR #115 and PR #116 device testing was not performed and none is claimed. Existing physical evidence for EB-1 remains limited to normal online startup, manual online refresh, saved-data in-app offline refresh and return-online recovery. The clean/private offline-first state could not execute because Safari could not load an uncached GitHub Pages shell while already offline, so automated regressions remain the evidence for that path. Because the EB-1 acceptance session used an incomplete manual squad, recommendation-survival was not independently demonstrated on device even though verified core-state retention was observed.

Three pinned assertions in `tests/atomic-foreground-refresh.test.mjs` were updated in place, none weakened:

- test 73 (`the wrapper path and the commit path share one apply gate`) is **unchanged**. EB-1 deliberately wraps rather than replaces the shared gate, so the literal `applyProviderResult('understat' | 'odds' | 'minutes'` call sites remain in the commit path and the original assertion still holds.
- test 61-63's `errorClass` regex now pins the extended expression that adds the `internal_error` class. The same exact-source guarantee applies to the new text.
- test 63 (`a throw in the failure-path render …`) previously pinned the literal empty catch `if(S.boot){ try{ renderVerifiedState(); }catch(error){} }` — the defect EB-1A exists to remove. It now asserts the stronger property: the recovery render is still guarded and still cannot escape `loadAll`, the caught error is recorded rather than discarded, the failure path never rethrows or re-enters acquisition, and the result carries `collection_failed` plus a separate `secondaryErrorClass`. The behavioural proof lives in the new file.

### A3 error-boundary coverage

`tests/error-boundary-separation.test.mjs` drives `loadAll()` and `runVerifiedRefresh()` against a working minimal DOM — a genuine node implementation, so the restricted no-core render path executes instead of throwing and disguising itself as the very render failure under test. It covers:

- successful acquisition and commit followed by a render throw: `render_failed`, committed data retained, FPL Live unchanged, no acquisition retry;
- a genuine collection failure with a verified snapshot plus a recovery-render throw: `collection_failed` stays primary, `secondaryErrorClass:'render_failed'`, the previously accepted core object stays identical and FPL Fallback remains justified;
- a gateway failure with no usable cache: FPL Unavailable, restricted, no unverified core admitted;
- a fatal feed-shape failure: acquisition/validation ownership retained, `feedShape` preserved and exactly one bootstrap request — no generic application retry;
- a no-core failure-state render throw: the provider classification survives, the application failure is owned and nothing escapes;
- unexpected Understat, Odds and minute-history computation exceptions: `internal_error`, the underlying error observable on the report, **no** provider-health row manufactured, and the core FPL row and its minute detail left truthful;
- both halves of Rule B under an application exception: where the accepted value is incompatible it is cleared and its stale row removed, and where it is still compatible it is retained with its prior provider success evidence neither advanced nor overwritten;
- normal Understat-only and Odds-only provider failures for contrast: a genuine provider failure still publishes a provider-owned Fallback row where an application exception publishes none;
- refresh-lifecycle ownership: a throw during `captureRefreshInputs()` is classified `internal_error`, the startup gate, interaction lock and refresh promise are all released, Provider Health is untouched, no raw exception text reaches the user, and the queued-manual-refresh and no-retry structure is pinned at source.

The PR #104 evidence below remains historical.

- PR #104 merged `main` complete suite: **832 tests, 832 passed, 0 failed, 0 skipped, 0 cancelled**
- exact PR #104 reviewed head: `4e434b940e2bcb473374573db5da16f6a645d9eb`; source `502a1f7ac0e0456743f3ddb0695433decf8976d1`; generated-only child `02216b8`
- permanent Verify Teamsheet run #105 / `31377157889`, completed successfully on the reviewed head. The merge commit itself received no automatic run because `verify.yml` did not trigger on pushes to `main`; the complete suite and every build gate were reproduced locally at `9b31f373…`, and Checkpoint 0A makes future merges verify automatically.
- merged production builds: byte-identical; root equals deployable; exact module-source and complete build-input identity; committed deployables reproduced from reachable source before the test build
- A3 persistence candidate: **832 tests, 832 passed, 0 failed, 0 skipped, 0 cancelled** locally
- `persistence-resilience.test.mjs` adds cache/config/manual-squad/Mini-League compatibility, verified-write and authoritative-backend regressions; no existing test or golden expectation is removed, weakened, regenerated or skipped
- model, calculation, provider identity/endpoint and data-source behaviour: unchanged

Earlier baselines in this file are retained as historical records and are superseded by the current GW1-P1 final-gate section above. PR #94 was documentation/test-infrastructure only and preserved the then-current PR #92 application baseline. Its three documentation-integrity tests raised the repository suite from 664 to 667 without creating a new application-behaviour claim.

### A3 persistence coverage

`tests/persistence-resilience.test.mjs` proves the browser persistence contracts directly rather than through the bundle: the versioned main-cache envelope, previous-season and unsupported-schema rejection, narrow deadline-verified legacy acceptance, malformed JSON, failed replacement preserving the previous durable bytes, legacy configuration migration with account-state removal, manual-squad version/season fail-closed behaviour, squad-before-config write ordering, Mini-League version/season rejection and version-safe Odds-key removal.

It also fixes the authoritative-backend durability contract. When a storage manager is selected, the read order only consults `localStorage` if the manager read is itself unusable, so a fallback written after a manager write failure can be permanently unreadable. Coverage therefore separates two cases that are not the same contract: a manager that fails to write but can still read is a reported persistence failure with no divergent local copy written, while a wholly unusable manager keeps its existing genuinely restorable `localStorage` fallback. The pre-existing Atomic Foreground Refresh contract that `ssetChecked` falls through to `localStorage` when the manager is unavailable is retained unchanged.

Transfers, Player Detail, Team and Fixtures have populated iPhone acceptance evidence for their tested paths. Leagues has pre-season physical acceptance; post-Gameweek populated checks are deliberately deferred. VoiceOver is not a Teamsheet acceptance gate.

The form-focus candidate changes editable-control typography across Team setup/resources, Fixtures, Transfers, player search, Leagues and Ask. Automated contracts cannot prove Safari's native focus scale, keyboard close or viewport recovery; the exact PR build therefore requires the focused device script below before merge.

### DTR-1 direct-renderer merged evidence

- `team-direct-renderer-runtime.test.mjs` runs the production bundle and verifies final ready/placeholder order, no legacy Team summary, 15 direct player actions, GK/1st/2nd/3rd display roles, captain selection/reset, valid and invalid transfer previews, incoming/clear behaviour, bench and all-15 Player Detail horizons, stable module ownership and removal of runtime renderer replacement.
- `rendering-security.test.mjs` now reaches the shipped direct renderer because `team-decision-home.mjs` is bundled before the `views.mjs` async-initialiser harness boundary.
- the Team resource, availability, preview, manual-runtime and architecture suites now assert final behaviour and direct ownership instead of requiring the removed post-render DOM surgery.
- the complete result is 691/691. Permanent CI, exact source/generated provenance and physical iPhone acceptance passed before PR #99 merged at `09e595c275b4f3614c09fb502291de6831813999`.

### iPhone form-focus zoom candidate
- `iphone-form-focus-zoom.test.mjs` requires the complete current text-entry control inventory—text, number, search, password, select and textarea—to render at a minimum 16px.
- the viewport must retain normal browser magnification: `maximum-scale` and `user-scalable=no` remain forbidden.
- checkbox, file and range controls remain outside the text-entry typography selector.
- the change adds no JavaScript, state, persistence, calculation, provider, route or account-write behaviour.
- focused automated coverage can establish the CSS contract only. Physical iPhone Safari testing must focus a numeric resource field, close the keyboard without pinching and confirm the page remains at normal scale and still saves the value.

### Repository Truth A1 merged evidence

- Exact remote PR #94 head `1a8af48c96a4aa5ed9d856061be7e95e98f1b3d4` passed **667 tests, 667 passed, 0 failed, 0 skipped, 0 cancelled** in permanent Verify Teamsheet run `31255585665`.
- The unchanged 664 application tests plus three documentation-integrity tests make up that total.
- Two exact-head production builds were byte-identical for `dist/app.bundle.js`, `dist/index.html`, `dist/manifest.json` and root `index.html`.
- Root `index.html` equalled `dist/index.html`, manifest identity matched the exact PR head and the verified tree merged unchanged at `cdc3cb709d97b858f29234678e7860baab918b78`.
- A1 changed no application behaviour or tracked generated deployable.

### Safe Hygiene A2 merged evidence

- Focused review/export, provider, transport, fixture, Odds, storage, build and documentation-integrity coverage passed **143/143**.
- Exact source commit `ed4517900caaf26d711bccf66bbe3459e574fd5b` passed **667 tests, 667 passed, 0 failed, 0 skipped, 0 cancelled** without removing, weakening or skipping a test or changing a golden expectation.
- Two production builds stamped with that exact source commit were byte-identical for `dist/app.bundle.js`, `dist/index.html`, `dist/manifest.json` and root `index.html`.
- Root `index.html` equalled `dist/index.html`; manifest identity matched the exact source commit; generated source hash was `9581b55c94eba9fc2948d56651e581ebc064fae5163d834a15329e8c8f1b9d77`.
- Connector-created PR #95 head `c1ebd7610b9a81f893457b8bb1bb41316de80dc0` preserved the verified tree exactly and passed permanent Verify Teamsheet run `31256999867`.
- PR #95 merged at `2eee62b77291af06552e3d1952b6e1a6355ca7e0`. Physical iPhone testing was unnecessary because no rendered or interactive behaviour changed.

### Refresh-Load R1 merged evidence

- The 667 prior tests remain unchanged and all pass. Twelve tests in `refresh-load-r1.test.mjs` plus two iPhone-found offline-disclosure regressions in `startup-refresh.test.mjs` raise the corrected candidate suite to **681 tests, 681 passed, 0 failed, 0 skipped, 0 cancelled**.
- New coverage proves active-squad-first 95-player ordering, checked-fixture revision identity, fresh-cache zero requests, missing-player-only refresh, seven-day backstop, two-failed-batch outage stop, unchanged success timestamps, separate minute-health detail, Understat 24-hour/completed-match cadence and six-hour cooldown, normalised-only storage/manual bypass, Odds one/six-hour cadence, six-hour maximum use, key-free derived storage, rejection cooldown and fresh-cache reuse.
- The offline regressions prove that only an explicit browser `onLine === false` signal is treated as definitely offline and that the acquisition path stops before networking, preserves saved FPL data, reports FPL Fallback and uses explicit offline copy rather than a gateway-loaded claim.
- All model, expected-minutes, projection, scoring, fixture, captaincy, transfer, rank, League and golden expectations remain unchanged.
- Corrected exact source commit `d1b6ac0527d7b785962d7c7a02a7f266f42ba209` passed **681 tests, 681 passed, 0 failed, 0 skipped, 0 cancelled** without removing, weakening or skipping a test or changing a golden expectation.
- Two production builds stamped with that exact source commit were byte-identical for `dist/app.bundle.js`, `dist/index.html`, `dist/manifest.json` and root `index.html`. Root equalled deployable; the manifest recorded the exact source commit and source hash `95d57ddc3b63494cef850a034ec6be0ab50fcbb3193c736225d3ecf3f6e3bf7a`.
- Exact remote head `967856246a0c17972c43eaf444651bceb8b9f728` preserved reviewed tree `fd40deff72c458286e77f44a66b79a0e720e700c`, passed permanent Verify Teamsheet run `31265107597` and merged through PR #96 at `2ddb33c81fa2092598f290d60320364f2e0c35dc` with the same tree.
- The first physical iPhone pass accepted online startup, build identity, short background return, Provider Health, manual refresh, cached repeat launch and in-app offline resilience. It also proved that a full offline hard reload cannot load the static app shell. The focused corrected-build retest then accepted explicit FPL Fallback/offline wording with the original saved timestamp; Pages on `main` served the same accepted build identity after merge.
- Minute-history revision/reuse remains physically unexercised until a Gameweek is complete and officially checked. Odds cadence/reuse remains physically unexercised while Odds is disabled. These are deferred evidence boundaries, not failed automated contracts.

## Coverage map
1. `characterisation.test.mjs` — production-bundle behaviour and reviewed goldens.
2. `sec1.test.mjs` — odds key never reaches relays.
3. `unit.test.mjs` and `resilience.test.mjs` — core model/provider/storage behaviour and fallbacks.
4. Validation and schema suites — fixture identity, payload filtering and state integration.
5. Retry and transport suites — bounded retry, endpoint scrubbing and metadata.
6. Provider Health suite — seven-state vocabulary and transitions.
7. Rendering, Markdown and security-completion suites — hostile input, secret handling, class-only style boundaries, generated-deployable scans and CSP.
8. `minutes-model.test.mjs` — Stage 4 denominators, histories, probabilities, shrinkage and invariants.
9. `scoring-rules.test.mjs` — official rule configuration, Poisson groups, defensive thresholds, rare events, bonus denominator, penalty-role gating and genuine blank/double behaviour.
10. `transfer-optimiser.test.mjs` — Stage 6 legality, affordability, hit accounting, search completeness and deterministic ordering.
11. `walk-forward.test.mjs` and `archive-replay.test.mjs` — Stage 7 fold chronology, leakage rejection, train-only calibration, metrics, immutable dataset provenance, malformed rows, double Gameweeks and deadline-safe replay.
12. `simulation.test.mjs` — Stage 8 seeded randomness, minutes-state marginals, expected-minutes convergence, bounded inconsistent inputs, percentile ordering and probability thresholds.
13. `squad-simulation.test.mjs` — Stage 8 legal formations, goalkeeper substitution, ordered outfield substitutions and captain/vice fallback.
14. `player-detail.test.mjs` — Stage 9.3 spread thresholds, quality suppression, range geometry, official availability labels, dialog accessibility/focus and surface wiring.
15. `decision-preview.test.mjs` — Stage 9.4 transfer-copy non-mutation, optimiser-final-squad agreement, captain/vice rules, stale-state invalidation, deterministic signatures, score separation and no-persistence wiring.
16. `provider-health-ui.test.mjs` — Provider Health age/status palette, saved-core-data materiality, quiet healthy/optional states and Settings/full-detail wiring.
17. Stage 9.6 coverage in `team-pitch.test.mjs` and `security-completion.test.mjs` — deterministic palette classes, DOM-helper style rejection, progress/SVG wiring, CSP concession removal and source/deployable scans.
18. `build-bundle.test.mjs` — generated-bundle guard plus direct fixture tests for import/export stripping and surviving module syntax; PR #111 extends complete-bundle parsing, late-module retention and late runtime replacement/navigation execution safeguards.
19. `evidence-snapshot.test.mjs` and `evidence-storage.test.mjs` — Stage 10.1 deadline boundaries, network-clock grades, provider cutoff, immutable hashes, strict approved-provider import validation, privacy, chunking, compression, bounded recovery, non-official restore, quota failures and delete/reset.
20. `startup-refresh.test.mjs` — silent startup gate, refresh-age rule, shared startup/foreground orchestration, definite-offline acquisition/disclosure, deferred provider settlement, non-blocking automatic evidence and recovery-only UI wiring.
21. `outcome-collection.test.mjs` — Stage 10.2 endpoint validation, blank/double/postponed Gameweeks, delayed checking, corrections, squad facts, snapshot-safe records and tamper detection.
22. `outcome-storage.test.mjs` — immutable revision pointers, recovery-only imports, journal recovery, bounds, quota failure, cadence and deletion isolation.
23. `metrics.test.mjs` — exact player/minutes/probability/interval calculations; zero and signed errors; Pearson/Spearman ties and zero variance; approved error/price/season boundaries; singles, doubles and postponements; legal automatic substitutions, goalkeeper and captain fallback; authoritative joins, corrections, tamper detection, non-mutation, segmentation, frozen transfer horizons, public record-field contracts and static no-model-recomputation guards.
24. `metrics-storage.test.mjs` — verified compressed metric writes, deterministic metadata, current/superseded revision pointers, correction retention, interrupted-write journal recovery, tamper rejection, bounds, quota failure and deletion isolation from source evidence.
25. `stage10-hardening.test.mjs` — dangerous-key rejection, diagnostic redaction, strict journals/current reconciliation, transfer-version parity, line-feed spreadsheet protection, honest download requests and bounded retry/orchestration wiring.
26. `navigation-settings.test.mjs` — primary order, hash normalisation, legacy aliases, safe fallback, Settings hierarchy, Team resource relocation, Fixtures/Leagues promotion, Ask Teamsheet access, shortcut routes and removal of legacy click-to-hide navigation.
27. `team-decision-home.test.mjs` — legal-squad gating, Official/manual/cache provenance, explicit base-XI/captain forecast, risk priority, advisory deadline actions, neutral close-captaincy wording, placeholder pitch and presentation-only wiring.
28. `mini-leagues.test.mjs`, `mini-leagues-ui.test.mjs` and `mini-leagues-intelligence.test.mjs` — versioned migration, classic-league discovery, official movement/gap helpers, exact squad and selected-rival set arithmetic, ID-free routes, targeted/incremental pagination, explicit on-demand fetching, concurrency two, selection-race invalidation, stale/incomplete/unavailable wording, mobile layout, accessibility and no-strategy/model guards.
29. `settings-organisation.test.mjs` — Teamsheet 2.0.6 nested route hierarchy, nearest-parent fallback, explicit Stage 10 mount ownership, export/recovery/deletion separation, consequence-led warnings, Help/About truth, build identity, identifier-free routes, mobile Player Explorer metadata and focus-restoration contracts.
30. `fpl-gateway-worker.test.mjs`, `retry-transport.test.mjs` and `fpl-gateway-deployment.test.mjs` — fixed upstream/endpoint allowlist, exact CORS, method and query rejection, credential isolation, redirect refusal, cache boundaries, diagnostic redaction, exact production meta configuration and CSP origin pinning.
31. `transfer-exact-performance.test.mjs` and `transfer-exact-scale.test.mjs` — prepared-versus-oracle equality across varied Gameweek score shapes, materialisation bounds, deterministic profiling, evaluation-ceiling fail-closed behaviour and tie-heavy scale ordering.
32. `transfer-exact-correction.test.mjs` — the Track A correction. Controlled-pool equality with the independent `exhaustiveTransferSearch()` oracle across seven adversarial shapes (mixed, goalkeeper-only, cheap enablers, doubtful-heavy, exact price boundaries, inherited club excess and fully tied projections) at 45 deterministic seeds each; oracle equality at each fixed depth of one, two and three transfers; re-scoring every retained plan from its own final squad through the reviewed scorer; prefix-sum pool totals against the reviewed best-XI scoring; canonical bank, doubtful-count and signature tie-breaking on a fully tied pool; zero-transfer ranking agreement; Official-scale six-Gameweek completion below the unchanged 2,000,000 ceiling with `status: 'ok'`; deterministic Official-scale profiling; and Official-scale fail-closed behaviour when the ceiling is genuinely exceeded.
33. `transfer-baseline-presentation.test.mjs` — Worker-result and cache regressions for a separately returned mandatory zero-transfer baseline when it falls outside the unchanged ranked Top K, plus fail-closed handling of a missing or malformed baseline.
34. `team-resources-bench-clarity.test.mjs` — UX-A1 resource-bar adjacency and exact labels, honest manual provenance and edit route, compact-chip removal/non-duplication, separate exact bench roles, index-preserving order, two-line names, fixture/xP readability, complete accessible labels, Player Detail tapping and a presentation-only dependency guard.
35. `player-detail-scroll-rotation.test.mjs` — UX-A2 dialog scroll behaviour and PR #78 stacking regression. Exact background-offset capture on a fresh open and restoration on a normal close, proved against a simulated mobile-Safari lock that clamps the page to the top; root and body lock application and removal; internal scroll reset on every open; `preventScroll` focus on the close control and on the restored trigger; identical close/backdrop/Escape outcomes; player replacement while open preserving the original offset and trigger; route-driven close that unlocks but restores neither scroll nor focus; a no-op route change while closed; detached and hidden trigger rejection; documented viewport-property fallback; and the CSS contracts for flex scrolling with `min-height:0`, `vh` declared before `dvh`, compact-landscape full-height sizing, four-sided safe areas, **Player Detail layering above the fixed primary dock**, the dialog-not-a-route boundary, no runtime inline styling and no data/model reach.
36. `refresh-load-r1.test.mjs` — detailed-history request suppression/delta ordering/outage guard/timestamp preservation, Understat normalised cache/cadence/cooldown/manual bypass, Odds key-free derived cache/near-deadline cadence/expiry/cooldown and supporting-data health separation.
37. `documentation-integrity.test.mjs` — canonical maintainer references, local Markdown link resolution, complete documentation indexing and unique decision/limitation identifiers. This is repository guidance protection only and does not exercise or alter application behaviour.
38. State-Ownership Cleanup focused regressions — declared shared-slot inventory, undeclared direct/static `S` property rejection, refresh-owned-key subset, one-way Mini-League compatibility authority and hostile saved-league rendering through canonical state.
39. `route-render-performance.test.mjs` — PR #115 measurement-only evidence for known route/render relationships, inactive work, duplicate Mini-League rendering, hidden Transfers preparation, production-output preservation and the M1 tooling-outside-build-input boundary. It does not assert that an optimisation is required.
40. `stale-code-cleanup.test.mjs` — PR #116 structural proof that the deleted Mini-League helpers and old `#leagueChips` target remain absent while live state/render owners remain, including absence from the generated bundle and shared harness; PR #124 additionally replaces the exact-format `selectMiniLeague` assertion with behavioural execution, whitespace-insensitive structural ownership/delegation checks and mutation-sensitivity coverage, so harmless formatting is tolerated while disabled selection or direct canonical-state writes fail.
41. `evidence-archive-worker.test.mjs`, `evidence-archive-cloudflare.test.mjs` and `evidence-archive-layout.test.mjs` — GW1-P1 canonical archive contract, provider-retention fail-closed behaviour, R2/D1 ordering and read-back, duplicate/idempotency and custody preservation, orphan recovery, Access/JWKS/runtime boundaries, safe route/rate/origin behaviour, isolated source/deploy parity and explicit Cloudflare Preview URL disabling.

Two forms of Transfers evidence are deliberately separate. Oracle equality is proved only on controlled pools, where an exhaustive comparison is tractable. On the Official-scale pool the claim is only that the exact search completes below the unchanged ceiling and returns `status: 'ok'`; it is not an exactness proof, and a lower evaluation count is never presented as improved prediction accuracy.

## Teamsheet 2.0.6 merged verification
The reviewed source `72bb55d484d3033a859ee51f2c3f3e7aa6bc55e6` passes **520/520 tests**, zero failures and zero skipped. New checks verify route-owned Settings destinations, explicit module hosts, warning materiality, Help/About content, identifier-free URLs and responsive Player Explorer metadata. A headless Chromium smoke check additionally exercises direct deep links, active Settings state, exact heading focus, Back restoration, dynamic module mounts, duplicate-ID absence and saved-core-data warning output. Production builds were deterministic, root `index.html` matched `dist/index.html`, and PR #65 merged at `cd1ad52ea4d13a247a82bc90f80f2db0b6f77aa4`.

This historical evidence does not replace physical iPhone Safari or live populated-data acceptance for untested features. VoiceOver is not a Teamsheet acceptance gate. Remaining feature-specific live acceptance is tracked under FPL-2.

## Golden discipline
Goldens are reviewed repository data, not verification output. `UPDATE_GOLDEN=1` may be used only during an explicitly reviewed stage update. Final verification runs against committed goldens without regenerating them.

Stages 8–10.3 change no deterministic projection formula and require no golden regeneration. Stage 10.3 adds downstream evaluation and presentation only. GW1-P1 changes no application formula or golden expectation.

## Harness
`tests/harness.mjs` stubs DOM, storage and fetch, then loads `dist/app.bundle.js`. Characterisation therefore exercises the production bundling path rather than a separate test-only implementation.

A3-SC-1 demonstrated that the harness itself can be a consumer of production-bundle symbols. A stale-code search that omits the harness, export lists or other test-side consumers is therefore incomplete even when production source and generated output show no runtime consumer.

## External Intelligence Foundation — documentation only, no new coverage

The External Intelligence Foundation checkpoint adds no test and changes no test. It is a documentation-only research record, so the repository baseline is unchanged by it. The invariant that matters most for that record is already pinned elsewhere: `APPROVED_PROVIDER_NAMES` must remain exactly `fpl`, `understat`, `odds`, `archive`, asserted in `tests/atomic-foreground-refresh.test.mjs`. Its presence in `docs/` is held by the existing `documentation-integrity` historical-index regression, which is what a new unindexed record fails against.

That record deliberately defers its own structural tests to the future implementation proposal that would need them. When a shadow observation foundation is separately approved, its proposal must bring tests proving that production model modules do not import the shadow store; that production results are identical with shadow data absent, present, stale, malformed or conflicting; that a shadow provider failure cannot move Provider Health; that shadow writes cannot mutate `S` model or provider inputs; that shadow storage failure cannot block the verified refresh or recommendation path; that unknown rights classifications fail closed for durable retention; that secrets, keys and keyed URLs never enter shadow records; and that display-name-only entity matching is rejected. None of those tests exists today, and none should, because nothing they would guard exists yet.

## Resolved narrow test-hardening

PR #124 replaced the brittle exact-format `selectMiniLeague` source assertion with behavioural execution of the real function, a whitespace-insensitive structural ownership/delegation contract and mutation-sensitivity coverage. The production implementation remained byte-unchanged. The hardened contract tolerates harmless line breaks, indentation, spacing and an equivalent `await`, while still failing if the function disappears, no longer delegates through `upsertMiniLeague`, disables selection, writes `S.miniLeagues` directly or persists outside the canonical owner. Do not weaken or delete those protections as part of unrelated work.

## Required checks before completion
1. Run `./run-tests.sh` with every committed test green and no golden regeneration.
2. For a generated checkpoint, verify the committed manifest source resolves, is an ancestor of the artifact commit, matches every declared build input and reproduces all tracked generated files byte-for-byte. For a non-build-input checkpoint such as GW1-P1, prove the committed application deployables remain unchanged and still reproduce from their recorded source.
3. Build twice with the same exact source commit in `BUILD_COMMIT`.
4. Compare `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json` byte-for-byte, then verify the generated root `index.html` deployment copy is identical to `dist/index.html`.
5. Independently verify CSP/build identity through the committed security tests and emitted manifest.
6. Confirm `BUILD_INFO`, manifest module order, module-source hash, complete build-input hash, commit identity and generated files agree.
7. Commit reviewed inputs first, then commit only verified generated artefacts when generated files actually change; documentation/backend-only pull requests must confirm generated application files are absent from their diff.
8. Remove temporary verification workflows before merge.
9. Where a security conclusion depends on Cloudflare route/dashboard state, obtain live post-deployment evidence; repository tests cannot manufacture that evidence.

## Philosophy
Never delete or weaken a test to make a change pass. A green suite proves deterministic agreement with encoded contracts; it does not prove improved prediction accuracy or calibrated uncertainty. Stage 10 metrics must remain descriptive until enough genuine prospective observations exist.

## Stage 10.1 evidence tests
`evidence-snapshot.test.mjs` covers canonical JSON, SHA-256, secret rejection, every approved deadline boundary, same-origin clock evidence, client-only/conflict/late grades, provider cutoffs, immutable identity, section tampering, deadline revisions, official selection, privacy, all-player output shape, chunked collection and bundle/UI wiring.

`evidence-storage.test.mjs` covers random stable anonymous references, gzip/plain recovery encoding, three-row metadata/two-record bounds, verified reload, recovery-import segregation, quota failure surfacing and explicit delete/reset. `startup-refresh.test.mjs` covers the automatic verified-data gate and foreground trigger contracts.

## Stage 10.2 outcome verification
The Stage 10.2 baseline was **376/376 passing tests**, successful production build, byte-identical two-build comparison, exact build identity and root/deployable equality. Outcome tests cover strict player/fixture identity, blank and double Gameweeks, postponed fixtures, delayed bonus/data checking, provisional-to-complete and corrected revisions, snapshot matching boundaries, no-snapshot collection, manager availability, recovery imports, tamper detection, bounded storage, quota/interruption recovery, automatic startup/foreground checks and non-blocking access.

## Stage 10.3 metric verification
The final Stage 10.3 run completed **397/397 tests**, zero failures and zero skipped. It directly verifies:

- prediction-minus-outcome formula conventions and approved public field names;
- fixture-level minutes/probability evaluation and fail-closed ambiguous doubles;
- immutable correction revisions and exact snapshot/outcome linking;
- legal goalkeeper/outfield substitutions, captain fallback and descriptive oracle labelling;
- frozen transfer plans versus the exact zero-transfer baseline, with hits subtracted and roll value retained only as context;
- sample-warning boundaries, including provider comparisons requiring both 100 observations and five Gameweeks;
- deterministic ordering, canonical hashes, storage journals and source-record non-mutation;
- absence of production projection/minutes/simulation/optimiser calls from the metric engine;
- successful build, byte-identical exact-identity rebuild and root/deployable equality.

Verified source: `3eaae862b8a8277e450af062ff4bcecd15b12f3f`. Verified generated artefacts: `8c4b60a367b9858146b42ff8710d888856462c21`. Merge commit: `2c703be2ccebc9bd0c4d782ad07b5324b1ed0997`.

## Stage 10.4 review/export coverage
Stage 10.4 adds `operating-review.test.mjs`, `cumulative-review.test.mjs`, `review-export.test.mjs`, `review-ui.test.mjs` and shared canonical evidence fixtures. Coverage includes correction chains, current-revision selection, pruned/missing exact records, unsupported schemas, incomplete transfer horizons, null minutes, schedule changes, one-segment limits, deterministic bundle hashes/bytes, all eight CSV contracts, formula-injection cases, manager-reference boundaries, Markdown wording, class-only CSP rules and downstream-only imports.

A synthetic 38-Gameweek × 700-player case exercises 26,600 player rows and equivalent fixture-minute rows with a 10-second ceiling. Source `1eca9a8817da41597d0632c819142237d31627fb` ran `./run-tests.sh`: **413 tests passed, 0 failed, 0 skipped** in 4.58 seconds. A second build with the same `BUILD_COMMIT` was byte-identical for `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json`; root `index.html` matched the deployable exactly.

## Stage 10.5 hardening verification
Stage 10.5 adds deterministic fault-injection coverage for snapshot/outcome/metric journals, corrupt journals, duplicate-current reconciliation, compression fallback, dangerous JSON keys, version parity, diagnostic redaction, line-feed formula injection, bounded automatic retry, immediate outcome-to-metric orchestration and honest delayed-cleanup downloads. Verified source `0302c54e3eb1d77657b3d892bebb33c90438fa92` passes **428/428 tests** with byte-identical exact-identity builds and root/deployable equality.

## Teamsheet 2.0.1 navigation verification
The Teamsheet 2.0.1 baseline is **445/445 tests** with zero failures and zero skipped. Coverage verifies the exact five-destination order, URL aliases and safe fallback, browser-history wiring, `aria-current`, static link semantics, no account/key/evidence identities in routes, free transfers and bank on Team, Player Explorer under Research Tools, purpose-led Settings sections, direct evidence/provider shortcuts and Ask Teamsheet as a global/Team action rather than a sixth tab.

Automated checks cannot independently prove exact iPhone Safari rendering or thumb comfort. PR #48 is merged; its historical physical findings remain recorded, while populated-data transport is tracked separately and remaining feature acceptance is tracked under FPL-2.

## Teamsheet 2.0.1 physical-review regression coverage
The navigation suite verifies the persistent global Ask composer and internal arrow, absence of global Data/Evidence pills, controlled SVG dock icons, one fixed five-column safe-area contract, keyboard visual-viewport recovery, invisible focus presentation for programmatically focused headings, and arrow-only Settings subsection navigation. Automated checks still cannot prove every physical iPhone placement or populated FPL behaviour.

## Teamsheet 2.0.2 Team decision-home verification
The final Teamsheet 2.0.2 merged baseline is **459/459 tests** with zero failures and zero skipped. Coverage verifies legal-15 gating, immediate placeholder/connected pitch structure, explicit provenance, base XI plus captain uplift arithmetic, deterministic material-risk priority, advisory/no-submission deadline wording, preview distinction, neutral ownership context, preserved routes and absence of model/optimiser/persistence calls from the presentation wrapper.

Completion also required two byte-identical builds using the exact verified source commit, root/deployable equality and the existing CSP/build-identity suites. Automated checks cannot prove physical iPhone pitch position, text scaling or thumb comfort. At that checkpoint Team device acceptance remained open; it subsequently passed through PR #83. VoiceOver is not a Teamsheet acceptance gate.

## Teamsheet 2.0.4 Mini-League verification
Teamsheet 2.0.4 is merged through PR #59 at `a2841b0831193f645548cfc4155809b82a520d92`. The verified source suite is **493/493 passing tests**. Coverage includes:
- deterministic migration from `fpl:config.leagueId` and `fpl:leagues` into version-1 minimal state;
- deduplicated league records and five-rival pin cap;
- public classic-league discovery and strict displayed-field validation;
- ordinal/movement wording, nearest-above/below selection and exact squad set arithmetic;
- pre-season, provisional and checked Official FPL labels;
- semantic ID-free League landing/standings/rival/manage routes and League-active navigation;
- page 1, pages around official rank and explicit load-more contracts without rival fan-out;
- one selected public rival picks request, incomplete comparisons and stale session fallback;
- absence of legacy threat/differential thresholds, projected-rank language and protect/chase logic;
- iPhone-width wrapping/touch-target structure, route focus, live regions and reduced motion;
- deterministic bundle ordering and unchanged model/rules boundaries.
Two exact-identity production builds were byte-identical and root `index.html` matched `dist/index.html`. Automated tests do not prove real Official FPL availability or physical iPhone density. Physical testing had not been performed at this 2.0.4 checkpoint; the later PR #92/#93 Leagues sequence established pre-season iPhone acceptance while correctly deferring post-Gameweek populated evidence. VoiceOver is not a Teamsheet acceptance gate.

## Teamsheet 2.0.5 Mini-League intelligence verification
Teamsheet 2.0.5 is complete and merged through PR #63 at `0b04dd68194207d301667a7100c3ed804ec1e056`. The verified suite is **510 passed, 0 failed, 0 skipped**. Coverage verifies:

- deterministic version-1 to version-2 Mini-League state migration;
- an explicit maximum-five selected-rival group with no automatic picks requests;
- two-request maximum concurrency and current-session reuse;
- exact set arithmetic and selected-rival owner/captain/vice/chip counts;
- aggregate denominators containing only complete, fresh 15-player squads;
- distinct not-loaded, stale, incomplete, unavailable and outside-loaded-standings behaviour;
- optional Official FPL rank, Gameweek-total, multiplier, captain, vice and chip validation;
- ID-free `#/leagues/exposure` routing, history and focus contracts;
- privacy boundaries keeping fetched standings and picks session-only;
- accessibility and narrow-screen source contracts;
- selection-key race invalidation and immediate busy-state cleanup;
- absence of projection, scoring, simulation, rank and transfer-optimiser calls.

Two production builds using the exact verified identity were byte-identical, root `index.html` equalled `dist/index.html`, model version remained `2.4.0`, and rules version remained `2026-27.3`.

Physical testing had not been performed at this 2.0.5 checkpoint. The later PR #92/#93 Leagues sequence established pre-season iPhone acceptance; published standings, gaps and real selected-rival exposure remain deferred until post-Gameweek data exists. VoiceOver is not a Teamsheet acceptance gate, and automated source/build evidence still cannot substitute for those deferred real-data checks.

## Teamsheet 2.0.7 implementation verification

Teamsheet 2.0.7 is complete and merged through PR #68. Its approved final-polish implementation added `final-mobile-polish.test.mjs` and updated presentation contracts for native controls, touch targets, restricted states, route focus/scroll, Player Detail route closure, Ask resilience, Fixture render isolation, table semantics and Transfers wording. The historical implementation branch completed **533 passed, 0 failed, 0 skipped**, deterministic exact-identity builds and root/deployable equality for source commit `5a61ec5510c447580afa6070a5a9815516babe86`. The Safari foreground-resume correction subsequently passed owner retest. VoiceOver is not a Teamsheet acceptance gate. Remaining populated live acceptance is tracked by feature rather than reopening 2.0.7.

## Safari foreground-resume correction verification

Physical iPhone testing exposed an untested failure path: unsuccessful startup attempts did not start the automatic refresh cooldown, and foreground refreshes temporarily made the application inert. Regression coverage verifies failed-attempt cooldown, hidden-page suppression, foreground interactivity and in-flight deduplication while preserving immediate manual refresh. The correction completed automated deterministic-build verification and then passed the owner's physical iPhone Safari app-switch retest before PR #68 was merged. `REFRESH-1` is closed.

## FPL-T1 gateway verification
Gateway tests cover exact route/query allowlisting, CORS, unsupported methods, credential/header non-forwarding, cache boundaries, generic upstream failures and invalid JSON. Client transport tests cover configured/unconfigured behaviour, bounded retries, optional 404 handling, relay exclusion for Official FPL and retained optional Understat fallback. The owner-controlled gateway subsequently passed physical live-data iPhone transport acceptance and merged through PR #69. Feature-specific populated acceptance remains separately tracked under FPL-2.

## PR #69 populated-data regression coverage
`live-preseason-regressions.test.mjs` verifies next-Gameweek public-picks derivation, no invented Gameweek, explicit unavailable/manual copy, missing-strength issue reporting, Official FPL difficulty fallback, finite neutral pre-season projections and unchanged activation of the normal strength model when all required fields are valid. The tested live transport/Transfers path subsequently passed owner acceptance; Team and Fixtures later passed their recorded paths, and Leagues passed pre-season acceptance with post-Gameweek evidence deferred under FPL-2/ML-3.

## Truthful FDR fallback coverage
The live pre-season regression suite verifies that missing strengths force the overall lens, the displayed run value is the direct average Official FPL difficulty, lower values sort as easier, higher values sort as harder, and valid-strength mode retains the established attacker/defender model contract. The correction does not activate historical data or change normal valid-input projections.

## Transfers background performance correction
The PR #69 performance correction moves the exact transfer search into a deterministic Blob Web Worker. Transfers now paints a lightweight shell first, calculation is explicit, projection preparation yields in fixed batches, route exit/input refresh cancels obsolete work, unchanged session inputs reuse the exact completed result, and the search retains only the comparator-defined top result set. The production search formula, transfer depth, horizon, evaluation ceiling, legality, selling prices, hits, free-transfer utility and ordering remain unchanged.

### Defect found in the first implementation
The first attempt assembled the worker by rewriting the embedded model source at runtime, replacing the single string `if(plan) plans.push(plan);`. That string occurs **twice** in `src/model/transfers.mjs` — once in `exhaustiveTransferSearch()` and once in `optimiseTransfers()` — so the assembly threw before any worker was created and **Calculate transfers could never succeed in the shipped deployable**. The suite was green because no test built the worker from the real model; the only coverage fed the assembler a synthetic one-line stub.

The correction removes runtime source rewriting entirely:

- bounded top-K retention now lives in `src/model/transfers.mjs` as `retainPlan()`, used at the single retention site inside `optimiseTransfers()`;
- `exhaustiveTransferSearch()` is unchanged and remains the independent oracle;
- the worker embeds the reviewed stripped model **verbatim**, so the background search and a direct `optimiseTransfers()` call execute identical code;
- the previously duplicated synchronous `renderTransfers()` in `transfer-optimiser-view.mjs` is deleted. That module is now presentation-only and there is exactly one Transfers renderer, declared in `transfer-performance.mjs` and never reassigned at runtime.

### Retention equivalence
`comparePlans()` is a total order: its final tiebreak is the plan signature, signatures are unique per transfer set, and they contain only ASCII digits, `>` and `|`, so two distinct plans never compare equal. With a total order, retaining the best `maxResults` plans as they are produced returns exactly the same plans in exactly the same order as retaining every plan, sorting once and slicing. The zero-transfer baseline participates as an ordinary member and is evicted exactly where a full sort and slice would evict it. No comparator, ranking, eligibility, pricing, hit, free-transfer or evaluation-count semantics changed, and no accuracy improvement is claimed.

### Coverage added
`transfer-performance.test.mjs` and `transfer-performance-runtime.test.mjs` now cover:

- bounded versus exhaustive equality across 60 deterministic synthetic cases, all transfer depths 0–3, comparator-tie fixtures, and every `maxResults` from 1 to 20 including values that evict the baseline;
- worker versus direct `optimiseTransfers()` equality across 25 deterministic cases, executed from the assembled worker source;
- the same check against the **shipped** `dist/app.bundle.js` embed, so a deployable that cannot build or run its own worker fails the suite;
- fail-closed `search-incomplete` behaviour through the worker boundary;
- the progress hook proven inert — identical plans, evaluations and pruning with and without it — and throttled rather than posted per evaluation;
- route rendering that constructs no worker and records no optimiser result; explicit calculation; cancel, route exit, verified-data change and superseding calculations all terminating real workers; stale results unable to render or become `S.lastOptimiser`;
- session-cache reuse and invalidation for horizon, return limit, free transfers, bank, Gameweek, purchase price and squad identity;
- honest failure when `Worker` is unavailable, with internal reasons kept out of the interface;
- re-rendering the workspace cancelling work that belongs to the previous inputs before reading a new snapshot;
- deployable CSP granting exactly `worker-src 'self' blob:` with no remote, `data:`, wildcard, `child-src` or `unsafe-eval` concession, an unchanged hash-locked `script-src`, and a single inline script with no separately deployed asset.

`tests/harness.mjs` gains an opt-in `interactive` mode supplying a document event registry, `CustomEvent`, a hash location and a controllable `Worker`/`Blob`/`URL` trio. Default loads keep the original inert stubs, so existing suites are unaffected. The harness truncates the bundle at the `init()` boundary, so `manual-squad-runtime.mjs` route wiring remains covered by its own source-level suite rather than the bundle harness.

One existing assertion was replaced rather than removed: `transfer-optimiser-view.test.mjs` previously required that module to call `optimiseTransfers({...})` directly. That call *was* the synchronous main-thread search, so the assertion is now the stronger pair — the presentation module must not be able to enter the optimiser at all, and the worker must be the only entry point. `final-mobile-polish.test.mjs` and `settings-organisation.test.mjs` now read both Transfers modules so their wording and route-warning contracts still apply after the split.

The historical PR #69 implementation baseline was **590 passed, 0 failed, 0 skipped** with two byte-identical exact-source builds and root/deployable equality. Subsequent Track A corrections and regressions moved the accepted merged checkpoint to **613 passed, 0 failed, 0 skipped** and populated physical iPhone Safari acceptance for the tested calculation/lifecycle paths. The current A3 engineering baseline before GW1-P1 was PR #116 with **868 passing tests**, recorded above.

## 2026-08-06 — Concurrent continuation reconciliation
The reconciled branch passes **609 tests**. Added contracts prove that explicit cancellation and force-start supersession settle their pending calculation promises, and that mixed-width player IDs with reversed input order preserve exact production-versus-exhaustive results.

Claude's controlled-shape, fixed-depth, re-score, prefix-sum, tied-comparator and Official-scale suites remain intact. The seed-7 automated profile completed with **21 exact leaf evaluations** across **575 outgoing branches**. Automated timing is not physical-iPhone evidence.

## 2026-08-06 — Track A physical iPhone Safari evidence

Pritesh physically tested the reconciled PR #72 preview on iPhone Safari with populated Official FPL data. The default six-Gameweek exact calculation completed in approximately **15 seconds** and displayed both the highest-ranked transfer plan and the separate no-transfer baseline. Internal navigation preserved completed results; cancellation and restart responded promptly; an active calculation survived navigation; leaving and returning to Safari caused no freeze or reload; and a newer three-Gameweek request was not overwritten by the older eight-Gameweek result.

VoiceOver was not tested and must not be claimed as physically verified. A final production-bundle regression requires every zero transfer cost to render as **“No hit”** and forbids **“−0”** anywhere in the displayed transfer result.

## 2026-08-06 — Track A merged checkpoint

- Approved stack merged in order: PR #69 at `00a35bacd2396a125a8a914bff9980b4f18b257f`, PR #70 at `78b2729c51419a36c5e6f757fa54830100b5435c`, and PR #72 at `be742e1eb707b3892f6405adf5d8769e084eee65`.
- The final `main` tree `3794e8e7ab9859717950296766dc9d64c9e5473f` exactly matches the verified PR #72 head tree, proving the merge introduced no file-content drift.
- The accepted pre-merge gate remains **613 passed, 0 failed, 0 skipped**, with deterministic production builds and root/deployable equality. No new runtime test run is claimed after the merge; the tree-identity check ties that merged checkpoint directly to the verified content.
- Populated physical iPhone Safari passed the six-Gameweek exact calculation in about 15 seconds, result restoration, active navigation, cancel/restart, Safari background/return, stale-result protection, separate no-transfer comparison and final **No hit** wording.
- VoiceOver was not tested and is not claimed.

## UX-A1 populated iPhone Safari owner test script
**Completed and passed by the owner on 6 August 2026.** The script is retained as the reusable procedure for future Team resource/bench presentation changes.

Use a populated legal 15-player team and the production deployment. Record portrait and landscape separately.

1. Open Team in portrait with Safari's address bar expanded. Confirm **Free transfers** and **Money in bank** are readable without zoom and the resource bar sits directly above the pitch.
2. Confirm the entered values are visually prominent, **Entered manually** is visible but secondary, and no compact conflicting FT/bank chip appears in the Team header.
3. Use **Edit resources**, change both existing manual inputs, return to Team and confirm the resource bar reflects the new values once each.
4. Confirm the bench roles are immediately understandable as **GK**, **1st**, **2nd**, **3rd**, with each role visually separate from the player name.
5. Check real long player names. Confirm they remain identifiable over up to two lines and do not obscure fixture or projected-points text.
6. Tap each of the four bench cards and confirm the correct Player Detail opens; close it and confirm the same Team position is retained.
7. Confirm captain and vice-captain badges remain clear and are not crowded by the resource or bench changes.
8. Repeat steps 1–7 with Safari's address bar collapsed.
9. Rotate to landscape and repeat the resource, bench-role, long-name, fixture/xP and tap checks with both address-bar states where available.
10. Record any overlap, clipped text, accidental tap, horizontal scroll or confusing duplicate value. VoiceOver is outside this UX-A1 device script and is not a Teamsheet acceptance gate.

## UX-A2 populated iPhone Safari owner test script
**Completed and passed by the owner on 6 August 2026.** Every step below passed. Step 10 initially exposed Safari automatically enlarging text on the return to portrait; root text-size adjustment is now fixed at 100% in the production stylesheet and the owner physically retested the corrected behaviour successfully, with scrolling and closing still intact. The script is retained below as the reusable procedure for future Player Detail changes. The later PR #78 dock-layering correction was separately physically accepted on 7 August 2026.

Use a populated legal 15-player team and the production deployment. Record portrait and landscape separately, and repeat with Safari's browser controls expanded and collapsed.

1. Open Team or Players in portrait and scroll the surface partway down — far enough that the top of the page is off screen.
2. Open Player Detail from a player that is visible at that scroll position.
3. Confirm the background page does not move, jump or scroll behind the dialog while it is open, including when you drag on the backdrop.
4. Scroll inside Player Detail all the way to its final section and confirm nothing is cut off or unreachable.
5. Close with the close button and confirm the background returns to the **exact** position you left, not the top of the page.
6. Reopen the same player and confirm the detail starts at the top rather than where you had scrolled it.
7. Repeat steps 1–6 with Safari's browser controls collapsed, then again with them expanded.
8. With Player Detail open, rotate from portrait to landscape.
9. In landscape, confirm the close button is fully visible and tappable and that you can still scroll to the last section.
10. Rotate back from landscape to portrait and confirm the dialog is still usable and nothing is clipped.
11. Close after rotating and confirm the background position is still correct.
12. Repeat the close checks using the backdrop and, on an external keyboard if available, Escape. All three must behave identically.
13. Open Player Detail and press browser Back once.
14. Confirm one Back press leaves the previous underlying route — no second Back needed, no stale scroll jump and no Player Detail URL.
15. Record any clipped close button, unreachable content, background jump, wrong restored position, horizontal scroll or rotation glitch. VoiceOver is outside this script; it is not a Teamsheet acceptance gate.

## T-02 availability-badge centring follow-up — 7 August 2026

Physical iPhone Safari review exposed a right-shifted standalone availability badge caused by the generic `.flag` horizontal margin. The follow-up regression is required to fail before the centring override and pass after `.pitch-availability{margin-left:0}` is applied. Full-suite and deterministic-build evidence is recorded on the follow-up pull request.

## iPhone form-focus zoom owner test script — 9 August 2026

Use the exact draft-PR build in normal iPhone Safari. Do not pinch zoom during the native-recovery checks.

1. Open Team and tap **Edit resources**.
2. Focus **Free transfers**, change the value, close the keyboard using **Done**, and confirm the page stays at its normal scale.
3. Save and confirm the resource bar updates once; restore the original value afterward.
4. Repeat the focus/Done check for **Money in bank**.
5. Open Settings → Team & Account and focus a text or number field; confirm no focus enlargement and normal save behaviour.
6. Open Transfers and focus each editable assumption; confirm no enlargement, clipping or horizontal overflow.
7. Open Fixtures and focus a number field and a select; confirm the interface remains at normal scale after dismissal.
8. Open Settings → Data & Providers, focus the masked Odds API key password field without changing or revealing its value, dismiss the keyboard and confirm normal scale is retained.
9. Confirm ordinary pinch zoom still works, then return to normal scale.
10. Rotate portrait → landscape → portrait and repeat one resource-field focus/Done cycle.
11. Record any enlarged scale, clipped field, layout shift, accidental value change, duplicate save or failure to recover. VoiceOver is not a Teamsheet acceptance gate.

## Atomic Foreground Refresh

`tests/atomic-foreground-refresh.test.mjs` retains its 96 cases covering the numbered R3.4 contract and the first PR #102 correction regressions. `tests/atomic-foreground-refresh-runtime.test.mjs` retains the production-bundle focus test. `tests/atomic-refresh-rollback-regression.test.mjs` adds two rollback regressions, taking the candidate to 792 tests while retaining all 790 previously passing tests.

Coverage groups:

- **Collection purity** — deep state-snapshot comparison across `S`, the health registry and `xpCache`; frozen staged inputs; live typed minute transport; no in-place `S.retryStats`/source write; health marks returned as data.
- **Rule A / Rule B separation** — a revision change keeps a usable value active and Cached; only provenance and R1 age bounds clear a slice; a club rename and a kickoff swap invalidate the computation signature.
- **Bounded recomputation** — one requeue per provider per apply cycle on a signature mismatch; none for a current-input failure, a cooling skip or a disabled provider.
- **Minute provenance** — season id reuse, schema/model mismatch and missing metadata all fail closed; the seven-day backstop leaves an entry usable; non-cohort players stay persisted but inactive.
- **Typed transport** — 404 is notfound; a 200 carrying `detail` or failing endpoint validation is failed and therefore carries compatible account state forward.
- **Account slices and health** — carry keys; entry as the root; Live only on a clean core and clean replacement of every requested slice.
- **Commit and rollback** — no `await`, dispatch, DOM or storage call inside the commit; an actual later forced failure restores account keys and every commit-owned/module-private mutation, preserves `xpCache` byte-for-byte with the same cached object references, and restores the pending recomputation `Set` in place with its exact prior contents; re-entrancy rejected.
- **Error classification** — only `collection_failed` may mark FPL Fallback or Unavailable.
- **Invariants** — the D-13 ordering invariant that made the withdrawn A5-3 finding a non-defect; `S` exposes only data properties.
- **Race and persistence regressions** — complete later-refresh and direct-wrapper coverage for Understat, Odds and minutes; core/configuration/manual-cohort invalidation; source-time precedence; rejected-result no-write behaviour.
- **Focused production render** — the actual built bundle preserves `document.activeElement` and the raw focused `fxFrom`/`fxSpan` value through `renderAll()`.

`tests/startup-refresh.test.mjs` line 77–79 previously pinned the pre-atomic provider call shape (`loadUnderstat({force:Boolean(options.forceSupporting)})`). Providers now receive the staged core and captured configuration, so those three assertions were replaced with ones that pin the staged context **as well as** the `forceSupporting` propagation they always covered. No assertion was removed or weakened.


<!-- DATA-S1-2026-08-22 -->
## DATA-S1 repository foundation — 22 August 2026

The separately approved [DATA-S1 Shadow Structured Data Foundation](DATA-S1-SHADOW-STRUCTURED-DATA-FOUNDATION.md) adds the isolated, provider-neutral `teamsheet-data-platform` repository service and separate future `teamsheet-data` D1 binding. Only `shadow_only` is valid. It has no production/browser/model/Provider Health read path, no new R2, no provider activation and no Google Sheets integration; existing Stage 10 D1/R2 custody remains separate and unchanged. No live infrastructure was created or modified. PR #145 is merged and repository-verified, but DATA-S1 remains **not live deployed**. DATA-S1A is the current control reconciliation. The separately owner-gated sequence is DATA-S1B live Cloudflare preflight/deployment/acceptance, DATA-S2 Official FPL structured history, DATA-S3 automated Official outcomes, DATA-S4 provider trials/evaluation, DATA-S5 downstream Sheets automation, then later explicit production/model gates. See the [DATA-S1B plan](DATA-S1B-LIVE-DEPLOYMENT-ACCEPTANCE-PLAN.md).

Effective **22 August 2026**, the owner superseded the blanket £0 recurring-cost constraint: free remains preferred where comparable, while a small paid provider may be considered only with explicit pricing, rights and value/cost justification, preferably after a shadow trial. This approves no provider and does not rewrite historical research conducted under the former constraint.
