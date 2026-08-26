# DATA-S2B — Live Deployment and Acceptance Plan

Status: **investigation/design only — no live Cloudflare mutation approved by this record**  
Prepared: **26 August 2026**  
Repository baseline: `94952ed01564a970e4d5139adae05aa6f17af25c` (PR #160 merge)

## 1. Purpose

DATA-S2B is the separately owner-gated live acceptance checkpoint for the merged DATA-S2A Official FPL structured-history collector. Its only purpose is to prove that the exact merged shadow collector can operate safely on the existing private `teamsheet-data-platform` Worker and `teamsheet-data` D1 within the accepted Cloudflare Free limits.

DATA-S2B does **not** connect D1 to the Teamsheet application, change projections or recommendations, add a provider, retain raw FPL payloads, start DATA-S3, or approve production/model use of shadow history.

## 2. Authoritative merged candidate

The accepted repository candidate is the PR #160 merge on `main`. The live collector path is:

`Cloudflare Cron -> teamsheet-data-platform scheduled() -> Official FPL bootstrap-static + fixtures -> TEAMSHEET_DATA_DB`

The Worker continues to expose its pre-existing HTTP/RPC rollback surfaces, but DATA-S2 collection uses the Worker's D1 binding directly.

Repository configuration currently declares:

- Worker: `teamsheet-data-platform`;
- D1 binding: `TEAMSHEET_DATA_DB` -> `teamsheet-data`;
- non-secret season: `DATA_S2_SEASON = "2026-27"`;
- target Cron: `0 * * * *` (hourly, UTC);
- observability enabled;
- `workers_dev = false` and preview URLs disabled.

Migrations are ordered:

1. `0001_shadow_data_foundation.sql`;
2. `0002_official_fpl_structured_history.sql`.

Migration 0002 creates the governed `official-fpl-r1` source revision for durable internal `shadow_only` retention with redistribution disabled.

## 3. Current platform limits to re-verify immediately before execution

First-party Cloudflare documentation was rechecked on 26 August 2026. The current relevant Workers Free / D1 Free limits are:

- Worker CPU time per Cron Trigger: **10 ms**;
- D1 queries per Free Worker invocation: **50**;
- D1 rows read: **5,000,000/day**;
- D1 rows written: **100,000/day**;
- D1 database size: **500 MB/database** on Free;
- D1 total account storage: **5 GB** on Free;
- Worker Cron Triggers: **5/account** on Workers Free.

These values are time-sensitive. Recheck first-party Cloudflare limits/pricing immediately before any live mutation. If current limits are lower or materially different, stop and return for owner review.

Relevant first-party references:

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/observability/metrics-analytics/
- https://developers.cloudflare.com/workers/observability/metrics-and-analytics/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://developers.cloudflare.com/workers/wrangler/commands/d1/
- https://developers.cloudflare.com/workers/wrangler/commands/workers/

## 4. Important deployment-control finding

Do **not** use a normal `wrangler deploy` for the first DATA-S2B promotion.

The merged Wrangler configuration already contains the hourly Cron. Cloudflare documents that Wrangler-managed Cron configuration is applied with deployment and replaces the Worker's existing Cron set. A one-step `wrangler deploy` would therefore couple Worker promotion and Cron activation, removing the deliberate acceptance pause between them.

DATA-S2B should instead use Cloudflare Workers Versions to separate these actions:

1. `wrangler versions upload` — create the exact reviewed Worker version without deploying it;
2. inspect and record that version;
3. `wrangler versions deploy` — promote that version while leaving Cron management separate;
4. only after post-deploy health checks, use `wrangler triggers deploy` to attach the approved hourly Cron.

Cloudflare documents `triggers deploy` as the trigger-management companion when using Workers Versions. This separation is an execution-safety requirement for DATA-S2B, not an architecture change.

Worker Versions do **not** version D1 contents. D1 migration/rollback evidence must therefore be handled separately.

## 5. Phase 0 — mutation-free account preflight

This phase must complete before any approval request for live mutation. Every action is read-only.

### Worker state

Record:

- current deployed Worker version/deployment ID;
- deployment timestamp and source;
- current D1 binding name/database identity;
- current custom-domain/route state;
- current environment variables relevant to DATA-S2, confirming `DATA_S2_SEASON` is not already live unless previously approved;
- current Cron Trigger set, expected to contain **no DATA-S2 hourly trigger** before activation;
- current Worker errors, CPU-time metrics and invocation baseline;
- current Workers plan and relevant account Cron count.

Unexpected active Cron, unexpected binding drift, or an unexplained Worker deployment is a STOP condition.

### D1 state

Read-only inspect the remote `teamsheet-data` database and record:

- remote migration list / pending migrations;
- `schema_migrations` contents;
- existence and schema of DATA-S1 tables needed by DATA-S2A;
- whether `official-fpl` / `official-fpl-r1` already exists;
- row counts for `data_sources`, `data_source_revisions`, `ingestion_runs`, `shadow_observations`, `observation_heads` and `canonical_entities`;
- any existing rows belonging to `official-fpl-r1`;
- current database size;
- current D1 rows-read / rows-written baseline and recent query activity.

Expected normal case: migration 0001 is already compatible with the live D1; migration 0002 is pending; `official-fpl-r1` has no live history yet. Do not assume that state — prove it.

If 0001 is not present/compatible, 0002 appears partly applied, source-governance rows conflict, or unexplained Official FPL history already exists, STOP. Do not repair live state ad hoc.

### Repository identity

Before mutation, re-read `main` and require its exact Verify Teamsheet run to be green. The deployment source must be pinned to an exact reviewed commit; never deploy an uncommitted workspace or a moving branch tip.

## 6. Owner approval gate after Phase 0

Phase 0 is investigation only. Present the read-only evidence before any mutation.

The live mutation request must explicitly identify:

- exact `main` SHA to deploy;
- current Worker deployment/version to preserve for rollback;
- exact D1 migrations pending;
- exact pre-mutation D1 counts/size/usage;
- exact current Cron set;
- current first-party Free limits;
- rollback/stop procedure.

No migration, version upload/deployment or Cron change occurs without owner approval of that evidence.

## 7. Phase 1 — D1 migration, if approved

Apply only the already-reviewed pending migration(s), normally migration 0002, to remote `teamsheet-data`.

Cloudflare documents that `wrangler d1 migrations apply --remote` records applied migrations and captures a backup; a failed migration is rolled back while previous successful migrations remain applied.

Immediately verify:

- migration 0002 is recorded exactly once;
- `source-official-fpl` exists exactly once;
- `official-fpl-r1` exists exactly once;
- rights fields equal the merged migration contract (`durable_allowed`, retention enabled, redistribution disabled, shadow ingest enabled);
- observation/head counts have not changed merely because the governance migration was applied.

Any duplicate/conflicting governance row or unexpected observation write is a STOP condition.

## 8. Phase 2 — upload exact Worker version without activation

Use `wrangler versions upload` from the exact approved `main` checkout. Record:

- source commit;
- generated Worker version ID;
- binding/config summary;
- upload result.

Do not activate Cron in this phase. Do not use a public preview URL as an acceptance dependency; the merged configuration disables preview URLs.

If upload output indicates unexpected binding, route, secret, trigger or environment drift, STOP before deployment.

## 9. Phase 3 — deploy exact version, Cron still inactive

Promote the exact uploaded Worker version with `wrangler versions deploy` at 100% only after Phase 2 evidence matches the approved candidate.

Immediately verify the pre-existing protected HTTP health path and existing security boundary. Confirm:

- Worker health remains good;
- existing custom-domain/Access behaviour has not regressed;
- D1 binding remains correct;
- no DATA-S2 ingestion run occurred because Cron is still inactive;
- previous Worker version/deployment remains recorded for code rollback.

Failure here means restore the previous Worker deployment and STOP. Do not activate Cron.

## 10. Phase 4 — activate the hourly Cron

Only after Phase 3 passes, attach exactly:

`0 * * * *`

using the separately controlled trigger deployment path. Cloudflare states Cron Trigger changes can take up to approximately 15 minutes to propagate and execute in UTC.

Do not temporarily increase frequency merely to accelerate acceptance unless separately approved. The production target remains hourly.

## 11. First real baseline acceptance

Observe the first natural scheduled run and reconcile it from D1 and Worker observability.

Required evidence:

- one completed `official_fpl_structured_history` ingestion run;
- correct configured/served season with no `season_mismatch`;
- successful Official FPL `bootstrap-static` + `fixtures` collection;
- logical baseline observations and heads agree exactly;
- no partial/failed generation advanced heads;
- Worker invocation outcome is successful;
- CPU-time evidence is captured;
- D1 rows read/written and database-size change are captured.

### Do not use 6,825 as the live expected count

`6,825` is the permanent **synthetic regression baseline** from the repository fixture (38 events, 20 teams, 401 players, 300 fixtures). It protects the tested allowlist shape; it is not a claim about the exact current Official FPL population.

For a real payload, calculate the expected candidate count from the validated live populations:

`events * 3 + teams * 10 + players * 11 + fixtures * 7`

and require the first baseline's logical observation/head count to equal that derived value. Also require it to remain below the hard `MAX_CHANGED_OBSERVATIONS_PER_RUN = 15000` guard.

A mismatch between derived live candidate count and stored logical observations/heads is a STOP condition.

## 12. Unchanged-cycle proof

Allow the next hourly run to execute against materially unchanged Official FPL state.

Required evidence:

- a new completed ingestion-run record exists;
- `records_seen` matches the validated current candidate count;
- `records_accepted = 0` (or the exact merged run field semantics for zero delta);
- `shadow_observations` count does not increase;
- `observation_heads` rows/values do not change;
- only the small run bookkeeping row is written;
- CPU and D1 usage are captured again.

If Official FPL genuinely changes between runs, that run cannot be used as the unchanged proof; classify the actual deltas and wait for a later unchanged pair rather than falsifying the evidence.

## 13. Changed-fact proof

Prefer a naturally occurring Official FPL change. Compare before/after heads and immutable observations and prove that only the changed logical facts append and advance.

Examples include price, ownership percentage, player status/news, player team assignment, fixture event assignment or kickoff changes.

Do not modify production Official FPL data, inject synthetic rows into the live Official source revision or create a fake external provider merely to satisfy this proof.

If no natural change occurs during the bounded acceptance window, report the changed-fact proof as pending rather than manufacturing evidence. A separately approved isolated validation database may be used if a controlled synthetic proof is later judged necessary.

## 14. Resource acceptance

Capture both per-invocation and account/database metrics.

### Worker

Use Workers metrics/observability to record CPU time per Cron invocation, wall time, outcome and errors. Free-plan suitability is accepted only if the real collector operates reliably within the current Free CPU constraint; occasional runtime flexibility is not evidence that a systematically over-limit job is safe.

Any `exceededCpu` / Worker resource-limit failure during the accepted candidate is a STOP condition. Do not silently upgrade to Workers Paid.

### D1

Use D1 query metadata and/or D1 analytics to record:

- rows read;
- rows written;
- query counts;
- query latency;
- database size.

Cloudflare exposes rows-read/rows-written in D1 result metadata and per-database/account analytics. Logical table-row deltas and billable row metrics should both be recorded; do not assume index/DDL effects equal the logical observation count.

If projected hourly operation risks the current Free daily rows-written/rows-read/storage limits, STOP and return with evidence before redesign or paid-tier discussion.

## 15. Failure and rollback rules

### Before Cron activation

- migration conflict -> STOP; do not deploy Worker;
- Worker upload/config drift -> STOP; do not deploy;
- post-deploy health regression -> restore previous Worker deployment; do not activate Cron.

### After Cron activation

If collection is invalid, repeatedly failing, over CPU/resource limits or writing unexpected deltas:

1. remove/disable the DATA-S2 Cron first using the Wrangler-managed trigger path;
2. verify no further scheduled runs occur after propagation;
3. restore the previous Worker version if the problem is code/config related;
4. preserve D1 evidence for diagnosis rather than deleting history;
5. use D1 backup/Time Travel only if an actual storage rollback is justified and separately approved.

Do not delete accepted historical rows merely to make counts look clean. Corrections must preserve provenance.

## 16. Acceptance result categories

DATA-S2B may close only as one of:

- **PASS** — real baseline, unchanged cycle, changed-fact evidence, resource accounting and rollback readiness all pass;
- **PASS WITH CHANGED-FACT PENDING** — baseline/unchanged/resource/rollback pass but no natural changed fact occurred; DATA-S3 and production use remain blocked until the missing proof is closed;
- **NO-GO — FREE LIMITS** — correctness appears sound but the exact candidate is not operationally viable on the accepted Free constraints;
- **NO-GO — CORRECTNESS/STATE** — live storage, delta, migration, season, atomicity or security evidence fails;
- **INCOMPLETE** — required evidence could not be obtained without expanding scope.

Do not translate a repository-green or partially live result into a claim of improved FPL accuracy.

## 17. Explicit exclusions

DATA-S2B does not approve:

- Teamsheet reading from D1;
- production publication of shadow history;
- DATA-S3 realised outcomes;
- expected-minutes changes;
- provider trials or external providers;
- projection/scoring changes;
- fixture interpretation/model changes;
- squad/captaincy/transfer/optimiser changes;
- rank or Mini-League logic;
- raw Official FPL payload retention;
- new R2 storage;
- paid Cloudflare upgrade;
- changes to the existing live Official FPL application gateway.

## 18. Completion evidence

A DATA-S2B closeout must record:

- exact repository SHA;
- pre/post Worker version/deployment IDs;
- pre/post Cron set;
- migration evidence;
- D1 pre/post counts and source-governance rows;
- first real baseline derived candidate count and stored counts;
- unchanged-cycle delta evidence;
- changed-fact evidence or truthful pending status;
- per-run CPU/outcome evidence;
- D1 rows-read/rows-written/query/storage evidence;
- rollback/stop evidence;
- confirmation of no Teamsheet/model/provider/runtime dependency change.

Until that evidence exists, DATA-S2 remains live-unaccepted and the Teamsheet application continues using its existing Official FPL gateway.