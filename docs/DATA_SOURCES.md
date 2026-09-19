## API-Football migration 0004 application boundary

Draft PR #262 does not change API-Football source qualification, rights or collection status. Migration 0004 remains only the schema foundation for normalized private-use shadow identity/participation facts under `owner_risk_accepted_private_use`: one-user non-commercial research, normalized facts only, no raw payload retention, no redistribution/public/commercial use and stop-on-objection. The production application foundation makes zero API-Football requests, receives no API-Football credential and persists no private 20/20 crosswalk. Official FPL remains authoritative. Applying 0004 later would still not authorize migration 0005/0006, provider collection, mapping persistence or model/product use. See [migration 0004 production application foundation](API-FOOTBALL-MIGRATION-0004-PRODUCTION-APPLICATION.md).

## API-Football live storage read-only preflight

The approved live-storage checkpoint begins with observation only. PR #260 adds a fixed-query production preflight under the existing read-only steward credential so current D1 migration/runtime/mapping counts and collector infrastructure state can be proven without provider egress. It does not acquire new football data, rerun the provider universe, call API-Football, retain a raw payload or broaden rights. Official FPL remains the Premier League identity authority. A missing live migration 0004 is a hard stop before 0005; this preflight does not authorize applying 0004. See [API-Football Live Storage Foundation](API-FOOTBALL-LIVE-STORAGE-FOUNDATION.md).

## API-Football post-20/20 persistence/planner boundary

The repository candidate may persist only normalized current-season team identity mappings that have passed the existing owner-approved exact-20 qualification contract. The source remains `api-football` under `owner_risk_accepted_private_use`; Official FPL remains the Premier League identity authority. Public repository content retains only hashes/review metadata, not the 18 private provider-ID pairs. Migration 0006 stores mapping qualification provenance and receipt hashes, not raw provider payloads. The pre-egress planner may only emit the existing five approved fixture-discovery queries and known-fixture `fixtures?id=` checks; workload-detail endpoints remain blocked until a later owner gate. No live provider request is authorized by this checkpoint.

## API-Football 20-club mapping live qualification source status

Team-identity qualification is now **GO 20/20**. Attended closeout run `35333898797` executed on exact protected `main` `aa694bc1d57faa6f197d4118ea0563808fa4ac0b` and validated 18 new owner-reviewed mappings plus the 2 trusted Chelsea/Leeds anchors against a freshly issued content-bound Official FPL authority. The run used exactly 2 Official FPL requests and 0 API-Football requests; Official FPL authority was fetched at `2026-09-18T10:17:32.351Z`. Provider-side identity evidence remained the prior integrity-bound attended universe from run `35328500278`; approved crosswalk SHA-256 remains `d48c7980d1c39e7d4a6f82cb56d25a750286c925fd4996d0f8c728a4fb45c7f5`, and final qualification integrity hash is `670ccccbf62764bc076293962ae4aa85085e06db48b503f597397d882f771367`. Raw bodies, crosswalk content and mapping receipts were not retained. Official FPL remains the authoritative Premier League source. This qualification adds no durable provider mapping store and changes no collector/runtime/model/UI source path; API-Football remains `owner_risk_accepted_private_use` and shadow-only.

## Historical API-Football 2026 Premier League team-universe qualification path

API-Football remains shadow-only and inactive in production. The qualification-only source operation for Premier League team identity review was exactly `GET https://v3.football.api-sports.io/teams?league=39&season=2026`. Attended provider-universe run `35328500278` executed that closed request successfully under the protected workflow and retained only normalized integrity/provenance evidence; raw provider bodies and credentials were not retained. That evidence established the provider universe but did not itself create Official FPL mappings. At that stage Chelsea 49→6 and Leeds 63→13 were the only admitted mappings; the subsequent owner-reviewed closeout run `35333898797` established GO 20/20.

## Historical API-Football mapping and response-ceiling status — PR #254

PR #254 merged the qualification-specific `/teams?league=39&season=2026` evidence path and explicit owner-reviewed mapping receipts to `main` as `83c7d5ce86077502ca691f7ff4e1941568dc083d`. Post-merge verification passed 2,162/2,162 tests and deterministic-build identity. EIA-2I5F's production repository ceiling is exactly **720,896 bytes**, bound to attended EIA-2I5E R7 evidence. At the PR #254 checkpoint, the separate team-mapping gate remained **NO-GO 2/20** because that PR made zero provider requests and admitted no new mappings. `teams` is still absent from the collector source surface. API-Football remains `owner_risk_accepted_private_use`; raw bodies and credentials are not retained. See [mapping qualification](API-FOOTBALL-20-CLUB-MAPPING-QUALIFICATION.md) and [EIA-2I5F](EIA-2I5F-QUALIFIED-RESPONSE-CEILING.md).

## Retained EIA-2I5E qualification history — response-size status superseded

At the earlier R1/R3 stage, API-Football remained `owner_risk_accepted_private_use`; R3 made zero provider requests and preserved R1's 11 sanitized byte measurements. Because R1 discarded raw bodies without preserving exact response parameters and row identity, that checkpoint correctly remained response-size NO-GO and treated 720,896 bytes as historical arithmetic only. That response-size status is now superseded by the later attended EIA-2I5E R7 qualification and EIA-2I5F implementation: the current repository ceiling is **720,896 bytes**. The historical request-count and observed quota facts remain evidence: R1 used 11 provider calls; R2 and R3 used zero; observed headers showed 7,500/day and 300/minute, which are observed account limits rather than guaranteed entitlement or collector budget. Teamsheet's separate conservative internal ceiling remains 100 attempts/day. At that retained historical checkpoint, team mapping remained independently NO-GO 2/20. See [EIA-2I5E](EIA-2I5E-PRELIVE-API-FOOTBALL-EVIDENCE-QUALIFICATION.md) and [EIA-2I5F](EIA-2I5F-QUALIFIED-RESPONSE-CEILING.md).

## API-Football EIA-2I5D persistence status

API-Football remains `owner_risk_accepted_private_use`: private one-user non-commercial normalized research only; no redistribution, public/commercial use or raw-payload warehouse; stop on objection. Migration 0005 seeds this narrow source revision and no broader right. Runtime remains disabled and uncredentialed. See [EIA-2I5D](EIA-2I5D-API-FOOTBALL-SHADOW-RUNTIME-PERSISTENCE.md).

# DATA_SOURCES.md

## EIA-2I5B API-Football discovery (dormant)

API-Football remains a private shadow source only. EIA-2I5B can construct the five approved fixture-discovery queries and normalize stable provider fixture/team/season/kickoff/status facts when an injected credential and transport are supplied. A complete five-competition generation is output-atomic; incomplete/failed scans expose no new fixture evidence. Every HTTP attempt is bounded by a 15-second `AbortSignal.timeout`. Collection, authenticated live requests, D1 persistence and production imports remain disabled. Draft PR #249's automatic branch preview is not provider activation. Independent candidates are fixture-scoped. 20-club completeness is a 1:1 bijection against a team universe issued only after DATA-S2A canonical Official FPL validation of bootstrap+fixtures; a labeled 20-team snapshot cannot self-certify, and malformed optional team representations fail closed instead of throwing. Official FPL remains the production Premier League source.

## EIA-2I5A API-Football storage admission

Only normalized private shadow facts may use `owner_risk_accepted_private_use`, under exact API-Football, owner-approval, private non-commercial, no-redistribution, no-public/commercial-use, no-raw-payload-retention and stop-on-objection constraints. Migration 0004 represents this explicitly. Collection remains disabled.

## 15 September 2026 — API-Football paid-window qualification closeout

API-Football is qualified only for a separately approved private shadow-collector and fixture-identity design checkpoint. Current-season League Cup and Champions League samples proved known-ID fixture detail, structured XI/bench, stable IDs, direct player minutes and events; one 2026/27 Cole Palmer mapping is verified. Historical Free known-ID enrichment remains evidence for one 2024 League Cup fixture, not permanent entitlement. Paid runtime headers showed 300 requests/minute and 7,500/day, while exact tier remains unknown. Chelsea–Leeds identity is verified but exact kickoff is unresolved across API-Football/Leeds (19:00 UTC) and Chelsea (19:15 UTC). Pritesh accepts recurring paid API-Football, so Free viability is no longer a release gate. Existing rights, transient raw-response, security, fallback, duration and model-isolation boundaries remain. See [EIA-2I4C](EIA-2I4C-API-FOOTBALL-QUALIFICATION-CLOSEOUT.md).

## 15 September 2026 — API-Football conditional qualification

EIA-2I3 preserves API-Football as a private/non-commercial shadow-only source. Direct player minutes qualify as independent workload facts; provider elapsed qualifies fixture duration only under the explicit FT/AET/PEN state matrix. Bounded live closeout adds no collector, persistence or production source. See [EIA-2I3](EIA-2I3-PENALTY-DURATION-REMEDIATION.md).


<!-- DATA-OPS-A1-3-A1-4-2026-09-10-CLOCK-CORRECTION -->
## Current Data-Ops source boundary — draft PR #242

**Supersedes conflicting current source descriptions below; older sections remain historical.** This correction adds no provider or product/model data source. A1.3 still reads existing operational evidence. Its isolated Cloudflare dispatcher stores only dispatch receipts and exact GitHub run identity in a dedicated clock D1. A1.4 reads that receipt plus the exact GitHub run and strict observer summary, then writes only its separate lifecycle bookkeeping. Neither component gains production Official FPL data mutation access, and manual runs cannot become automatic heartbeat evidence. Active repository schedules are 01:17, 04:17 and 04:47 UTC only; live Cloudflare activation remains unproven.


<!-- DATA-OPS-A1-4-2026-09-09-FINAL-INTEGRATION-CORRECTION -->
## A1.4 final integration correction (PR #240, draft and unmerged)

This section supersedes conflicting A1.4 integration details and test counts below; older text remains as review history.

The watchdog now validates semantic summaries for up to the two newest terminal **scheduled**
candidates per cycle; manual dispatches never consume this fixed read allowance. Each scheduled
run attempt is durably attributed to exactly one declared opportunity: candidates are opportunities
whose inclusive five-hour window contains `run_created_at`, considered oldest first, with an
already-consumed opportunity skipped. Existing attribution for the same run id/attempt is reused.
Thus a 09:01 run consumes 04:17 before 08:17, while a genuinely delayed 08:17 run after 09:17 has
only 08:17 as a candidate. Bootstrap excludes older opportunities.

Observation identity and evidence hashes include `run_attempt`. Decisive evidence is selected for
the exact attributed opportunity by run attempt descending, terminal state before in-flight,
completion-or-observation time descending, observation time descending, then observation id.
Lifecycle monotonicity uses the decisive run completion/observation timestamp, or the stable logical
opportunity instant for absence; repeated identical GitHub-unavailable states reuse their persisted
evidence instant. Failed email delivery is retried through the same notification row and key even
when lifecycle replay returns `NONE`; retry creates neither a notification reservation nor a
lifecycle occurrence. Exactly-once external delivery is not claimed. Repository-only: no live
resource, credential, schedule, email, deployment, merge, provider, model, calculation or
remediation authority changed.

<!-- DATA-OPS-A1-4-2026-09-09-CORRECTED -->
## DATA-OPS A1.4 watchdog source boundary (corrected repository candidate, PR #240, unmerged)

A1.4 activates no provider and adds no data source, unchanged by the owner-directed correction pass
recorded elsewhere in this repository's Data-Ops checkpoints. Its two inputs are the repository's
own existing GitHub Actions history for A1.3's workflow (bounded, read-only — now also reading the
freshest failed run's job log, not only a successful one's, so a genuine execution failure is
evidenced rather than silently unread) and its own isolated watchdog D1 database, which holds only
its own observation/incident/notification bookkeeping, now including real GitHub evidence
provenance fields (run id, run attempt, head SHA, observed timestamp) rather than placeholders —
never Official FPL data, never application/model data. No Official FPL acquisition, retention,
collection or model input changes. See [A1.4](DATA-OPS-A1-4-WATCHDOG-LIFECYCLE.md).

<!-- DATA-OPS-A1-3-2026-09-08 -->
## DATA-OPS A1.3 runtime source boundary

A1.3 activates no provider and changes no Official FPL acquisition, retention, collection or model input. Its observer reads only existing GitHub operational metadata, Cloudflare dispatcher configuration and fixed SELECT-only production D1 aggregates through the A1.2 contracts. Sanitized summaries are operational output, not a new data store or product source. The manual attended path has since executed successfully live (run `34346126189`, exact `main` `174a7ece2f6c52257902c79ac9a46de846edeb91`, `HEALTHY`/`HEALTHY_EXPECTED_STATE`) — that changes nothing about this boundary: still no provider, still no acquisition/retention/collection/model-input change, and the scheduled path remains dormant until a separate owner-approved activation.


<!-- DATA-OPS-A1-2-2026-09-08 -->
## DATA-OPS-A1.2 observation-source boundary

A1.2 adds **no data provider**. Its three sources are Teamsheet's own infrastructure — the GitHub
Actions metadata of this repository, the Cloudflare configuration of the dispatcher Worker, and the
production D1 database — read strictly to observe operational health. Nothing observed by A1.2
reaches a projection, an expected-minutes estimate, a fixture, a captaincy, squad, transfer,
simulation, rank or Mini-League calculation, or any product surface, and Official FPL provider
semantics, approval and cadence are unchanged. The D1 sentinel reads the governed Official FPL
history only to count and reconcile it; it extracts no player, team or fixture fact and creates no
new retention. A1.2 is built so further approved providers could later be observed the same way, but
none is implemented and none is approved here.

<!-- DATA-OPS-A1-1-2026-09-08 -->
## DATA-OPS-A1.1 provider-health boundary

A1.1 adds only a provider health-contract validator. Caller input contains dynamic health facts, not
approval policy. Identity, authority and purpose come from immutable repository-controlled
`APPROVED_PROVIDER_SOURCES`; unknown policy facts remain absent/null. Caller attempts to redefine
purpose, fallback or prohibited influence fail exact-schema validation. Production influence is
always false. No provider, endpoint, acquisition, retention, fallback, weighting or model behavior changes.

<!-- DATA-S2C-CLOSEOUT-2026-09-08 -->
## Current Official FPL scheduled collection state

**Supersedes earlier DATA-S2C current-state wording below.** Cloudflare is accepted as sole automatic
clock after T1 run `34207638275` completed Official FPL collection to production D1 and T2 run
`34209137195` stopped the second same-day collection at the opportunity guard. Workflow B and the
unchanged Official FPL collector remain; workflow C remains attended recovery; obsolete workflow A
is deleted. No provider contract, field, validation, normalisation, retention, D1 schema, collector or
resource threshold changed in closeout. UTC 2026-09-07 has a confirmed, non-reconstructible history
gap because no governed A/B/C run occurred.


<!-- DATA-S2B-MANUAL-COLLECTION-HARDENING-2026-09-03 -->
## DATA-S2B collection state — first run completed, manual collection gate hardened

The first Official FPL production collection run is completed: owner-dispatched reconciliation run
`33792104384` proved `RESUME_RECONCILIATION_SAFE` read-only, and resume run `33815400284` returned
only after synchronous postflight proved the exact completed run, its counters and consistent
observation/head state. Endpoints, allowlisted fields, canonical normalisation, rights
classification, retention and redistribution posture are unchanged; no provider was added or
altered and no raw payload is retained. Exact provider `rows_read`/`rows_written` for those runs
are unavailable, and Cloudflare dashboard aggregates are not per-workflow accounting.

Routine normal collection **has now run, both manually and on a natural schedule.** The hardened
manual workflow succeeded once as run `33818972728`, and the dedicated scheduled workflow then
succeeded on a genuine `schedule` event as run `33901634593` on `main`
`dac27b3860428bc55c6d505e8a817a207d30f904`, with `repository-gate` and `collect` both successful.
Its Step Summary measured 124,430 provider `rowsRead` against a 94,844 structural estimate, finishing
570 rows below the 125,000 ceiling **that applied at the time**. That envelope has since been
restored to 150,000 expected / 200,000 soft pre-mutation / 250,000 hard, so the same measured run
would today finish with real headroom; the measured figures themselves are unchanged facts. **The next natural scheduled run then failed.** Run
`33948145320` on `main` `9a1c6a87e17de08ed2c5b650b05cdc3eab96291c` passed its `repository-gate`,
committed to D1 and failed `production_d1_budget_exceeded` at `postflight_read`
with `productionMutation: 'definite_completed'`. The postflight D1 read was issued and returned;
resource enforcement failed on its returned accounting before `validateProductionPostflight()` could
validate the returned state. The postflight read ran; postflight validation did not, so **the
Official FPL facts that run committed are present in D1 but have never been validated by the
postflight contract at the time** — an absence of proof, not evidence that they were invalid. That
absence has since been closed: Stage 0 run `33966125991` proved the state that run committed
satisfies the production postflight contract. The scheduled workflow was owner-disabled at that
point, was re-enabled and produced successful natural run `34015422874` on 6 September 2026, and was
then disabled again on 7 September 2026 for the DATA-S2C timer retirement; it now reports
`state: disabled_manually`. No
provider, endpoint, rights classification, retention posture, normalisation or canonical identity
changed as a result; the correction was to the resource model and then to the resource envelope
only.

**Collection has since been proven under the restored envelope.** Attended manual run
`33990959542`, event `workflow_dispatch`, on exact `main`
`2ef79bf961eb22d9d86d75e99abe9ca769aebcf8`, completed successfully with both jobs green. It
appended 141 changed observations against 10,157 records seen, leaving `completed` state with
11,278 observations, 10,157 heads equal to 10,157 logical keys, and zero orphan heads, quarantined
and rejected. Its Step Summary measured **113,352** provider `rowsRead`, 1,005 `rowsWritten`, 6 API
calls and 209,511 request bytes, against a projection of 121,902 — the projection over-predicted by
8,550, the conservative direction, and actual usage was ≈ 45.34% of the 250,000 hard ceiling.
Endpoints, allowlist, validation, normalisation, canonical identity, rights classification and
retention posture are all unchanged by that run. See
[capacity live acceptance closeout](../workers/data-platform/DATA-S2B-CAPACITY-LIVE-ACCEPTANCE-CLOSEOUT.md).
The manual workflow stays the owner-approved manual and recovery boundary, gated by one immutable
approved SHA, a credential-free repository gate and a second remote-`main` check in the same shell
as the runner. **GitHub Actions is the current approved scheduler and remains the execution engine
throughout**: one production schedule trigger, `17 1 * * *` (01:17 UTC), and historical Cloudflare
*Worker collection* stays superseded and forbidden. That cron
minute is a best-effort daily opportunity, not a guaranteed execution instant — GitHub delivered
the accepted natural run approximately 3h21m after its nominal minute and the following one
approximately 4h31m after its own, and two earlier windows produced no run at all. That timing
limitation is what DATA-S2C addresses.

**Forward direction, 7 September 2026:** under [D-DATA-S2C-D](DECISIONS.md) the *timer* moves to an
isolated Cloudflare dispatcher Worker while GitHub Actions keeps running the collection. GitHub's
automatic scheduler workflow is to be **disabled before** Cloudflare automatic scheduling is
activated, so Cloudflare becomes the only automatic clock rather than a second one beside GitHub;
there is no planned period of deliberate dual automatic scheduling. That moves a **Cron Trigger**
onto the dedicated `teamsheet-data-s2-dispatcher` identity, which is a different thing from the
superseded Cloudflare Worker collector and does not reopen it. **That direction is now partly live and
is recorded accurately here rather than as the original "nothing is live" statement:** the owner
disabled the GitHub scheduler workflow on 7 September 2026 (`state: disabled_manually`), created the
narrowly scoped dispatch credential, bound it as the single encrypted Cloudflare secret, and deployed
the isolated dispatcher — with **zero Cron Triggers**, so it cannot yet be invoked automatically. The
repository now declares the approved 01:17 / 02:17 / 03:17 UTC opportunities, but the deployed Worker
still holds none of them until a separately gated attended activation, so **there is currently no
automatic collection path at all** and no Official FPL request has been made through DATA-S2C. The
Official FPL endpoints, payloads, validation, normalisation and retention rights are untouched by any
of this: DATA-S2C changes only which clock asks for a collection. See
[manual collection hardening](../workers/data-platform/DATA-S2B-MANUAL-COLLECTION-HARDENING.md) and
the [daily GitHub Actions schedule](../workers/data-platform/DATA-S2B-GITHUB-ACTIONS-DAILY-SCHEDULE.md).

<!-- DATA-S2A-2026-08-26 -->
## Official FPL DATA-S2A internal structured-history approval

DATA-S2A approves one repository-only `shadow_only` purpose: durable internal change history from the fixed Official FPL `bootstrap-static` and `fixtures` endpoints. It retains only normalised, allowlisted facts:

- events: lifecycle presence, name and deadline;
- teams: lifecycle presence, names and Official strength fields;
- players: lifecycle presence, team/position identity, web name, cost, status, chance-of-playing fields, news/news timestamp and selected percentage;
- fixtures: lifecycle presence, event assignment, kickoff, home/away team identities and Official difficulties.

Durable **internal shadow retention** of those facts is approved; redistribution is disabled. Raw Official FPL payloads are not retained. Manager/account, picks, bank/free transfers, captain/chip, league and rival data are excluded. The source revision is not approved for production publication or model/runtime use, which remain separately gated. DATA-S2A does not replace the live Official FPL gateway. DATA-S2B Phase 3 deployed the existing `shadow_only` candidate at 100%, but did not run the collector, mutate D1 or activate Cron; [the live closeout](../workers/data-platform/DATA-S2B-PHASE-3-LIVE-CLOSEOUT.md) records the exact boundary.

DATA-S1C-R retired RPC/custom bearer-HTTP as forward collection defaults. DATA-S2A instead collects inside the existing D1-owning Worker. DATA-S2B Phases 0–3 have completed their separately approved read-only preflight, migration, inactive-Version upload/reconciliation and production deployment gates. Phase 4 remains a separate investigation/design/approval gate for Cron activation, real baseline, unchanged-cycle and changed-fact proof, D1 accounting, Workers Free CPU suitability and stop/rollback controls. Collection remains unapproved.

> **Superseded on 4 September 2026 — current state.** The two sentences above are the dated
> 26 August 2026 position and are retained as history. The Worker collection path and Cloudflare
> Cron were both superseded: the collector was stopped on Worker CPU grounds, and the forward
> architecture is GitHub Actions to the fixed Official FPL endpoints to bounded direct Cloudflare
> D1 REST, which invokes no Worker. Phase 4 Cron activation is **no longer the next gate** and must
> not be restored. Collection is **approved and has executed in production**, manually as run
> `33818972728` and on a genuine natural `schedule` event as run `33901634593`. The approved
> permanent cadence is one daily GitHub Actions trigger at `17 1 * * *`.


## 12 August 2026 — candidate external sources are research, not approval

This file remains the authoritative record of **approved** sources. Runtime provider identity is closed to `APPROVED_PROVIDER_NAMES` — exactly `fpl`, `understat`, `odds`, `archive` — and a permanent test pins that set.

[External Intelligence Foundation](EXTERNAL-INTELLIGENCE-FOUNDATION.md) carries a dated 12 August 2026 research matrix covering ClubElo, football-data.org, API-Football/API-SPORTS, TheSportsDB, Wikidata and the Football-Data.co.uk CSV archive, plus a role-based selection order and a rights/retention classification scheme. **None of those is an approved source, and appearing in that matrix is not approval to acquire, integrate, retain or weight it.** A terms page permitting API calls is not automatically a licence to retain or republish the underlying competition data, so provider terms and underlying data rights must both be assessed. That research is time-sensitive and must be re-verified from first-party sources before any implementation approval.

The existing positions here are unchanged by that record: Understat stays team-level only under D-05 with its acquisition still fragile and its parser deliberately unrepaired; the Odds API stays the market layer with its direct-only key boundary under D-06/SEC-1; the 45% and 65% blend weights stay unvalidated under D-09; and ClubElo stays an unimplemented candidate prior/anchor under D-10. Adding any source still requires an approved purpose, field contract, reliability assessment, validation/ablation plan, fallback, security/privacy review, cost and tests.

## 11 August 2026 — GW1-P1 evidence-backend status; provider acquisition unchanged

GW1-P1 implements the backend-only Cloudflare custody foundation selected by D1: a separate authenticated evidence Worker, private R2 canonical objects and a minimal D1 manifest/receipt/index. This does **not** add or change a football-data provider, endpoint, acquisition cadence, retry policy, cache, fallback or model input. GW1-P2 connects the Teamsheet browser to that archive as a one-way evidence side effect and likewise adds no provider, endpoint, cadence, cache, fallback or model input; a record whose provider material is not approved for retention is never uploaded and is never stripped to make it archivable.

Permanent retention of provider-derived material remains fail-closed. Understat archival rights remain unresolved and Odds permanent retention requires the separately approved governance position. The evidence Worker defaults both retention flags to false and rejects an already-canonical snapshot whose retained provider material is not permitted rather than stripping it and changing its hash.

## 10 August 2026 — provider evidence versus application error ownership

PR #107 is merged at `main` `d112c673310149a4463def1758242460450600dc`; `fpl:calib` now fails closed on every current unverified stored record while preserving its bytes. EB-1 does not add or change any source, endpoint, field, cadence, retry policy or provider fallback.

For current refreshes, Provider Health may change only from actual provider-layer evidence: transport/acquisition outcome, response validation, accepted provider cache/fallback use or explicit provider configuration. Commit, persistence, rendering and unexpected application exceptions are not provider evidence. Expected Understat/Odds/minute failures continue to return their existing structured results. Unexpected supporting computation exceptions are application-owned but still use the existing Rule-B data retain/clear decision so stale incompatible values cannot survive.

## GW1-P1 historical evidence persistence

[Data Architecture D1](DATA-ARCHITECTURE-D1.md) approves D1 plus private R2 behind a separate data Worker as the evidence platform. GW1-P1 implements the backend foundation and canonical pre-deadline ingestion path only. Only accepted normalised inputs actually used may be retained where retention is approved. Raw provider responses/HTML, Odds keys, keyed URLs and secrets must not be retained. Permanent Understat- or Odds-derived retention requires a separate provider-rights review. Google Sheets is downstream reporting only.

The backend does not alter provider acquisition. Normal Teamsheet Stage 10 evidence remains local/manual until the separately approved GW1-P2 browser outbox/sync path is implemented.
## 14 September 2026 — API-Football private-use shadow exception

EIA-2I1 supersedes the prior API-Football block only for private, non-commercial, one-user research under `owner_risk_accepted_private_use`, source-bound to exact `api-football`. This is Pritesh's risk acceptance, not full underlying-rights proof. Normalized workload facts may be retained; redistribution, public/commercial use and raw-payload warehousing remain prohibited. R1 pins credential transmission to the official HTTPS origin and four closed endpoint paths. Players/PL teams retain verified FPL mappings, while non-PL fixtures and competitions use external identities rather than fabricated FPL IDs. Collection/use stops on objection pending review. Foundation is disabled, no live 2026/27 coverage is proven, and no production model or user-facing provider registration changes. See [EIA-2I1](EIA-2I1-API-FOOTBALL-SHADOW-FOUNDATION.md).

Purpose: reference for every external source. Audience: provider work, Stage 3+.
Last reconciled: 2026-08-12. Related: AUDIT.md §1–3 (full audit tables — kept as the detailed record;
this file is the maintained summary), STAGE3-DESIGN.md §2 (validation flow), DECISIONS D-05/D-06/D-09/D-10, GW1-P1-CLOUDFLARE-EVIDENCE-FOUNDATION.md.

## Official FPL API — foundation
Purpose: players/prices/teams/fixtures/GWs/ownership/status/news/minutes/points/BPS/DC/xG-xA/entry/
picks/history/leagues. Authority: high (game's own data; player xG is Opta-derived). Transport: owner-controlled narrow FPL gateway under approved Scope FPL-T1; Official FPL remains the
provider and every response still passes the existing validators. The browser sends no cookies, credentials or
arbitrary upstream URL. Bootstrap and unfiltered fixtures may use a five-minute shared edge cache; manager,
picks, histories, leagues and outcomes are no-store initially. Fallback: verified device cache with age labelling,
otherwise restricted mode. Schema stability: medium (undocumented; validate at runtime from Stage 3).
Licensing: unofficial, tolerated. The production Worker is deployed at `https://teamsheet-fpl-gateway.fpltsheet.workers.dev`, the app uses its exact `/fpl` base and live 2026/27 bootstrap transport was verified on physical iPhone Safari. Transfers, Player Detail, Team and Fixtures tested paths are accepted, as is the Leagues pre-season path. Published post-Gameweek League rank/standings/rival evidence remains deferred under FPL-2/ML-3.

Detailed expected-minutes history uses `/element-summary/{id}/` for the active connected/manual squad followed by a bounded 80-player research cohort and stores a separate schema/model/season-versioned device cache. R1 reuses validated entries while the finished-plus-data-checked fixture revision is unchanged and each player success is no older than the seven-day correction backstop. Only missing/invalid/due players are requested. Two completely failed four-player batches stop further fan-out; cached histories remain active where valid and all other players use the existing aggregate/prior minutes fallback. Failure never advances a successful player timestamp.

If Safari definitively reports the device offline, R1 performs no Official FPL or optional-provider acquisition attempt. The last verified device snapshot remains active with its original timestamp and FPL is disclosed as Fallback. This prevents a browser HTTP-cache response from being mistaken for a new live gateway success; it does not provide the static application shell on a full offline reload.

## Understat — team form layer only (D-05)
Purpose: last-6 team xG/xGA multipliers, 45% blend vs FPL strengths. Authority: medium (own xG
model; NOT comparable to Opta figures — never mix at player level). Transport: relay scrape of
embedded teamsData JSON — fragile. Licensing: ToS-grey; owner-approved continue-at-reduced-cadence
pending ablation. R1 persists only validated normalised team inputs—never raw HTML—and reuses them until a completed-match revision changes or 24 hours elapse. Missing expected page structure starts a six-hour automatic failure cooldown; explicit manual refresh bypasses it. Recent validated cache remains active as Cached, while inputs older than 24 hours fall back to FPL strengths. The measured current HTML lacked the expected `teamsData` structure; R1 does not repair the parser.
Fallback: FPL strengths, confidence reduced. Future: survives only if prospective ablation shows
out-of-sample value; ClubElo remains an unimplemented prior/anchor candidate (D-10).

Permanent server archival of Understat-derived Stage 10 material is **not approved by GW1-P1**. The archive retention gate remains false until rights are explicitly resolved.

## The Odds API — market layer
Purpose: h2h+totals (UK region) → devigged, outlier-filtered, staleness-cut market-implied team
goals; 65% blend where a fixture is confidently quoted (weight unvalidated — D-09). Authority: high.
Transport: DIRECT ONLY (D-06/SEC-1) — key never relayed. Licensing: clean. Quota: 500 credits/mo,
2/call ≈ 250 calls. R1 persists validated derived fixture inputs only—never the key or keyed URL—and refreshes at most hourly when a relevant deadline/kickoff is within 48 hours, or every six hours otherwise. Derived inputs older than six hours do not affect the model. Rejected-key, quota and transient cooldowns persist without diagnostic secrets; manual refresh and explicit key changes bypass them. Schema: stable;
per-event provenance retained (id, kickoff, fetchedAt, books, markets, confidence). Matching: teams
+ kickoff proximity (72h). Fallback: internal team model, reduced confidence. Historical: none on
free tier → prospective logging from GW1 2026-27 (ODDS-2).

Permanent server archival of Odds-derived Stage 10 material remains disabled until the approved governance/retention position permits it. The API key and keyed URL are never archive inputs.

Scope of the prospective-logging gap: a Stage 10 pre-deadline record already preserves the **normalised** derived Odds inputs that actually affected the prediction whenever Odds is healthy at capture, so the primary market-layer on/off ablation is supported by ordinary capture and export with no code change. What is not preserved, and is not reconstructible on the free tier, is individual bookmaker prices, intraday line movement and anything else needing raw quotations. See ODDS-2 in [Known Limitations](KNOWN_LIMITATIONS.md) and [External Intelligence Foundation](EXTERNAL-INTELLIGENCE-FOUNDATION.md) §9.

## vaastav historical archive
Purpose: per-GW per-player CSVs for backtesting/calibration. Transport: raw.githubusercontent,
direct, CORS-open, user-initiated download with progress. The 2025/26 dataset is pinned to commit
`f9ed3e8839b0f970e0d5d4a83c5628f6eaee755a`; the downloaded bytes receive a runtime SHA-256 identity
that is retained with replay provenance. Licensing: public community dataset. Stage 7 chronological
replay is implemented; BT-1 is closed. The archive remains a historical diagnostic rather than a
substitute for genuine pre-deadline provider snapshots.

## Storage (window.storage / localStorage)
Config, manual squad, saved leagues, calibration, cache envelope. Never stores Anthropic keys
(D-08); odds key accepted-temporary with Stage-3 hygiene (forget action, scrubbing).

A storage manager (`window.storage`) is the authoritative backend whenever the host provides one;
`localStorage` is consulted only when the manager read is unusable. Reads and writes honour that
same order, so a record is treated as durable only when the backend that will serve the next read
actually holds it.

Main Official FPL cache (`fpl:cache`): written as a `teamsheet.main-fpl-cache` envelope carrying the
cache version, repository schema version, exact `FPL_RULES.season`, fetched timestamp and the slim
Official FPL snapshot. A versioned record is used only when cache version, schema and season all
match, and the payload still passes the existing validators before state is mutated. The immediately
preceding raw shape is accepted only when its Official FPL event deadline years establish the current
season; previous-season, unsupported-schema, malformed and structurally incompatible records are
ignored rather than promoted. Model or build identity is deliberately not an acceptance gate here,
because this cache stores Official FPL facts rather than derived projections, and no arbitrary
maximum age is imposed — same-season older data keeps its existing stale/offline behaviour.

User-owned records carry season/version ownership. `fpl:config` version 1 separates season-independent
preferences (Understat toggle, transfer horizon, result count, locally held Odds configuration) from a
season-owned account section (Team ID, free transfers, bank, manual-team mode); a previous-season or
invalid account section is dropped while valid preferences survive, and an unversioned legacy record
can only contribute preferences. `fpl:squad` version 1 and `fpl:mini-leagues` version 3 are season-owned
and fail closed, so an unversioned or previous-season record is not restored. `fpl:calib` is fail-closed after merged PR #107: existing unverified bytes are preserved but are not restored into active model state.

The Refresh-Load R1 supporting caches (`fpl:minutes-history`, `fpl:understat-team-inputs`,
`fpl:odds-derived-inputs`) keep their own schema/model/season contracts and cadence rules unchanged.
A local write failure is reported as a local persistence problem only; it never becomes an Official FPL
or optional-provider health state.

GW1-P1 does not replace any of these browser records. Its server archive is a separate one-way evidence destination. GW1-P2 uploads a copy of the already-stored canonical record and changes no local recovery or export semantics; a record that cannot be archived stays saved on the device.

## Explicitly rejected sources
Sentiment/social/trends/etc. (owner spec §6); player-level Understat (D-05); FBref & Transfermarkt
scraping without owner licensing approval; subscription predicted-lineup scraping (a provider-
neutral startProbability interface may ingest a PERMITTED source later — Stage 4 optional input).

The candidate sources researched in [External Intelligence Foundation](EXTERNAL-INTELLIGENCE-FOUNDATION.md) are neither rejected here nor approved above: they are unevaluated research candidates whose rights, coverage and reliability positions remain open.

## Endpoint validation inventory (D-14, Stage 3 item 2)
Every externally fetched payload and its cached equivalent, the consumer that
defines its minimum shape, and what fatal/partial mean for it. Validators live
in `src/providers/validate.mjs`; issues land on `S.dataIssues`.

| Provider | Endpoint | Consumer | Minimum required shape | FATAL | PARTIAL |
|---|---|---|---|---|---|
| fpl | `/bootstrap-static/` | `slim()`, `hydrate()` | object with `events[]`, `teams[]`, `elements[]`, `element_types[]` | not an object; any of the four collections missing or not an array | rows that are not objects or lack an `id`; duplicate `id` (first kept) |
| fpl | `/fixtures/` | `hydrate()` → ticker, projections, chips | array | not an array | duplicate/conflicting/unidentifiable rows (D-13) |
| fpl | `/entry/{id}/` | `loadAll`, squad/header and Leagues hub | object; `name` read for display; optional `leagues.classic[]` rows require `id` + `name`; optional published ranks are numeric-like | not an object | display name, classic membership row or optional rank fields invalid; unusable rows/fields are dropped, not manufactured |
| fpl | `/entry/{id}/event/{gw}/picks/` | `mySquad()` | object with `picks[]`, rows having `element` + `position` | not an object; `picks` missing or not an array | invalid rows; duplicate `element` (first kept) |
| fpl | `/entry/{id}/history/` | chip list | object; `chips[]` optional | not an object | `chips` present but wrong type (emptied); chip rows without `name` |
| fpl | `/leagues-classic/{id}/standings/` | league comparison | object with `standings.results[]`, rows having `entry` | not an object; `standings.results` missing | invalid rows; duplicate `entry` (first kept) |
| fpl | explicitly selected rival picks (same shape) | pairwise comparison and selected-rival exposure | as picks above, plus validated optional multiplier/captain/vice/chip context | per-response only — never blocks League standings | incomplete/stale/unavailable rivals remain explicit and are excluded from fresh complete denominators |
| understat | `league/EPL` (+ prior season) | team xG blend | object map of team → `{title, history[]}` | not an object; no usable teams (→ FPL ratings fallback) | individual unusable teams dropped |
| odds | `v4/sports/soccer_epl/odds` | market blend | array of events with string `home_team`/`away_team`, `bookmakers` absent or an array | not an array (→ internal model fallback) | unusable events dropped, remainder still priced |
| archive | `merged_gw.csv` | `computeBacktest()` | header row containing name, position, minutes, total_points, GW | missing header or required columns | — (row-level guards remain inline; see VAL-3) |
| cache | `K_CACHE` snapshot envelope | `hydrate()` | same shape as bootstrap + fixtures | same rules as the live endpoints | same rules as the live endpoints |

Cached-data treatment: the snapshot passes through the identical validator as a
fresh fetch, because `hydrate()` is the single point both paths meet. A fatal
cached payload is discarded and re-fetched, never rendered. Row-level filtering
happens in `hydrate()` rather than `slim()`, so the cached snapshot stays
raw-shaped for provenance (D-13).

Criticality: only bootstrap, fixtures and the cache are core. Every other
payload is optional — a fatal there degrades to the existing fallback and must
never prevent core FPL data from loading.

## Retry inventory (D-15, Stage 3 item 3)
Retry sits inside the transport layer; consumers are unaware of it. One relay
cascade counts as one attempt. `attempts` includes the first try.

| Provider | Applies to | Attempts | Base / max delay | Budget | Retried on | Never retried on |
|---|---|---|---|---|---|---|
| fpl | `/bootstrap-static/`, `/fixtures/` (core) | 3 | 300ms / 1.2s | 15s | network, timeout, 429, 5xx | 400/401/403/404, parse, schema-FATAL |
| fpl | entry, picks, history, standings, rival picks (optional) | 2 | 300ms / 1.2s | 15s | as above | as above; provider "not found" is an answer, not a failure |
| understat | `league/EPL` via relay cascade | 2 | 300ms / 1.2s | 15s | network, timeout, 429, 5xx | parse, permanent 4xx |
| odds | `v4/sports/soccer_epl/odds` (direct only) | 2 | 400ms / 1.6s | 12s | network, timeout, 5xx | **401 (bad key), 429 (quota window)**, parse |
| archive | `merged_gw.csv` | 2 | 800ms / 3.2s | 90s | network, timeout, 5xx | parse, permanent 4xx |

Interaction with validation (D-14): validation runs *after* transport. A schema
failure is permanent by definition and never re-enters the retry loop — a feed
that returned the wrong shape will return the wrong shape again.

Interaction with SEC-1: only the direct odds request is retried. The key still
cannot reach a relay, because the retry wraps the direct call and the relay
cascade is not part of that path at all.

Metadata: each call writes `{provider, endpoint, attempts, finalStatus,
retryable, exhausted, budgetExceeded}` to `S.retryStats`, keyed by provider and
a normalised endpoint — query strings stripped (so the odds key cannot appear)
and digit runs collapsed to `{id}` (so twenty rivals cannot create twenty keys).


## Stage 10 evidence provenance
A pre-deadline record stores the normalized FPL, Understat, odds, archive-calibration and detailed-minutes inputs that actually affected its outputs, plus Provider Health state, age, threshold, consequence, accepted/rejected counts and retry/validation summaries. It does not store provider keys, raw configuration or account identifiers.

The same-origin GitHub Pages response `Date` header is sampled before and after capture solely as deadline-timing evidence. It is not a model provider, is not blended into projections and is not an external timestamp authority. If it is unavailable, conflicts with the device clock by more than 60 seconds or completes inside the two-minute cutoff, the record remains exportable but cannot become official.

GW1-P1 can archive this existing canonical record only after revalidation and only when its provider-derived contents pass the retention gate. It does not change how the record is constructed or whether the client marks it Official-eligible.

## Automatic approved-source startup gate (Stage 10.1 amendment)
Runtime provider identity is closed to `fpl`, `understat`, `odds` and `archive`. Provider Health refuses any unregistered name, and evidence import requires one unique provenance row for every approved provider with a valid known state and usage/count/timestamp fields. This is a trust boundary, not a recommendation to add more feeds.

On app startup and qualifying foreground return, Official FPL is refreshed and validated first; enabled supporting sources then settle through their existing validators, retry budgets, caches and fallbacks. No intermediate provider result is rendered. The app applies one complete verified state after all approved sources resolve. Optional unavailability never manufactures values; critical FPL failure uses an acceptable verified cache or disables recommendations.

Backup JSON is not a football-data provider. Restored evidence is quarantined as recovery-only and cannot influence projections, recommendations or official prospective evaluation.

## Stage 10.2 Official FPL outcome endpoints
| Endpoint | Authority and purpose | Validation/finalisation | Storage |
|---|---|---|---|
| `/event/{gw}/live/` | Canonical all-player Gameweek totals and per-fixture explanation | Unique player IDs; finite allowlisted statistics; explanation fixture IDs must belong to the Gameweek | Normalised facts only; raw response discarded |
| `/fixtures/?event={gw}` | Canonical fixture assignment, kickoff, score and completion | Official fixture ID; conflicting duplicates fail closed; every currently assigned fixture must finish | Normalised allowlisted fixture facts/statistics |
| `/bootstrap-static/` event row | Deadline plus Gameweek `finished` and `data_checked` | Both completion flags required for a final record | Event identity and flags only |
| `/entry/{id}/event/{gw}/picks/` | Optional official pick multipliers, captain/vice, bench, auto-subs, chip and manager summary | Duplicate picks fail closed; Team ID is redacted from evidence | Allowlisted outcome fields only |
| `/entry/{id}/history/` | Optional summary cross-check and missed-Gameweek discovery | Unique Gameweek rows; conflicts keep the squad section partial | Current-row facts and chips only |

No new provider is introduced. `/element-summary/{id}/` remains a bounded expected-minutes input and is not fanned out for outcome collection. Existing optional FPL retry limits and relay rules remain unchanged.

## Stage 10.4 review/export sources
Stage 10.4 introduces no provider and fetches no new football data. Its only inputs are already-retained, hash-validated Stage 10.1 snapshots, Stage 10.2 Official FPL outcomes, Stage 10.3 Gameweek evaluations and completed transfer-horizon evaluations. Provider-state rows are historical provenance copied from the frozen snapshot and are not re-queried or reinterpreted causally.

The live Google Sheet is an optional manual destination for selected CSV imports, not a source of truth and not a runtime data source. The historical archive workbook remains separate and read-only. Any future automatic export must pin the exact live spreadsheet ID and requires a separately approved authentication, token-storage, scheduler and idempotency design.

## Stage 10.5 data-source boundary
Stage 10.5 changes no provider, transport, endpoint, validation threshold or source allowlist. Recovery and metrics operate only on existing validated immutable records. Google Sheets remains a manual analysis destination and is not a provider or authoritative evidence source.

## Current Official FPL League field contract

No provider or network origin is added. The existing Official FPL endpoints are consumed more deliberately:

| Endpoint | 2.0.4 fields used | Behaviour |
|---|---|---|
| `/entry/{id}/` | `name`, overall points/rank where supplied, `leagues.classic[].{id,name,league_type,entry_rank,entry_last_rank}` | Build the no-fan-out all-league hub, distinguish invitational/general membership when supplied and locate the manager without scanning standings. Invalid membership rows/rank fields are dropped or degraded and reported. Unpublished rank is `Not ranked yet`, never a fabricated position. |
| `/leagues-classic/{id}/standings/?page_standings={page}` | `league.name`, `standings.results[].{entry,entry_name,player_name,rank,last_rank,total,event_total}`, `has_next` | Official current table, movement and simple points gaps. Page 1 and pages around the official rank load first; further pages are user requested. |
| `/entry/{id}/event/{gw}/picks/` | `picks[].{element,position,multiplier,is_captain,is_vice_captain}`, `active_chip` | On-demand selected-rival squad, captaincy and exact set comparison. No league-wide fan-out. |

League names/IDs, primary/selected choice, selected rival, pins and the explicitly confirmed at-most-five comparison group persist locally under `fpl:mini-leagues` version 3, season-owned and fail-closed against older or previous-season records. Standings, points, rival squads and derived exposure are session-only and are not model inputs, Stage 10 evidence or exports. Opening the hub makes no standings request. Connected Official FPL memberships cannot be misleadingly removed locally; only a league confirmed absent from the connected entry is labelled manually added and removable. Public endpoint failure preserves only a clearly labelled in-session stale result where one exists; no value is manufactured.

## Teamsheet 2.0.5 selected-rival exposure contract

No provider, origin or endpoint family is added. The existing Official FPL standings and current-Gameweek picks endpoints support an explicitly selected group of at most five rivals.

- Rival picks load only after an explicit user action.
- At most two logical rival requests run concurrently.
- Current-session results are reused by league, rival and Gameweek.
- Aggregate squad exposure includes only fresh records with 15 unique, resolved players in positions 1–15.
- Incomplete, unavailable and stale records remain visible but are excluded from the default denominator.
- Counts are labelled as selected-rival facts rather than whole-league ownership or effective ownership.
- Optional `entry_rank`, `entry_last_rank`, `last_rank`, `event_total`, `multiplier`, captain, vice-captain and active-chip fields are validated before aggregation. Invalid optional context degrades to unavailable without discarding otherwise valid player ownership.
- Standings, picks and derived exposure remain session-only. Only the explicit selected rival IDs and labels persist under `fpl:mini-leagues` version 3.


<!-- DATA-S1-2026-08-22 -->
## DATA-S1 repository foundation — 22 August 2026

The separately approved [DATA-S1 Shadow Structured Data Foundation](DATA-S1-SHADOW-STRUCTURED-DATA-FOUNDATION.md) adds the isolated, provider-neutral `teamsheet-data-platform` repository service and separate future `teamsheet-data` D1 binding. Only `shadow_only` is valid. It has no production/browser/model/Provider Health read path, no new R2, no provider activation and no Google Sheets integration; existing Stage 10 D1/R2 custody remains separate and unchanged. No live infrastructure was created or modified. The separately approved intended sequence is DATA-S2 Official FPL history, DATA-S3 automated Official outcomes, DATA-S4 provider trials/evaluation, DATA-S5 downstream Sheets automation, then later explicit production/model gates.

Effective **22 August 2026**, the owner superseded the blanket £0 recurring-cost constraint: free remains preferred where comparable, while a small paid provider may be considered only with explicit pricing, rights and value/cost justification, preferably after a shadow trial. This approves no provider and does not rewrite historical research conducted under the former constraint.

<!-- DATA-S2B-E2C-B-2026-09-01 -->
## DATA-S2B E2C-B repository-only preparation

E2C-B hardens the disposable live boundary with mandatory production-account separation, exact returned-value affinity/storage semantics, missing-versus-zero bounded provider metadata, sanitized evidence and a manual exact-main/exact-Verify protected workflow that rejects reruns and never cleans up. No live action occurred; preparation, execution, acceptance and manual cleanup remain separate owner gates. See [E2C-B implementation record](../workers/data-platform/DATA-S2B-E2C-B-DISPOSABLE-LIVE-EXPERIMENT-PREPARATION.md).