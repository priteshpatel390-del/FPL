## Next repository checkpoint after GO 20/20

Owner approval now covers the repository-only [pre-live runtime completion](API-FOOTBALL-PRELIVE-RUNTIME-COMPLETION.md): durable private mapping provenance plus pre-egress planner/orchestration. This does not reopen or repeat the completed 20/20 qualification. No new provider-universe or mapping workflow run is required for this repository checkpoint, and no API-Football request, live D1 mutation, secret, collector deployment, Cron, workload ingestion or model/UI influence is authorized.

## Live attended closeout — GO 20/20

The complete 2026/27 API-Football ↔ Official FPL team-identity gate is now **GO 20/20**. PR #257 merged the private/hash-bound closeout path to protected `main` as `aa694bc1d57faa6f197d4118ea0563808fa4ac0b`; post-merge Verify Teamsheet run `35332702502` passed 2,180/2,180 tests with deterministic byte-identical production rebuilds. The owner then dispatched `API-Football Owner Mapping Qualification` once as run `35333898797`, `run_attempt=1`, on that exact main; both `repository-gate` and `qualify` succeeded.

The sanitized live result is: 20 verified Premier League teams; complete coverage true; 18 new owner-reviewed receipts validated; 2 trusted legacy receipts reused; 0 unresolved mappings; 0 receipt failures; exactly 2 Official FPL requests; 0 API-Football requests. Current Official FPL authority was fetched at `2026-09-18T10:17:32.351Z`. Qualification integrity hash is `670ccccbf62764bc076293962ae4aa85085e06db48b503f597397d882f771367`; crosswalk hash remains `d48c7980d1c39e7d4a6f82cb56d25a750286c925fd4996d0f8c728a4fb45c7f5`; provider-universe revision remains `api-football-team-universe:5b404fb0a736a72973b6a1772d984992acea1dff6e2d2d7336c8253a078ae5f1`.

Sanitized result artifact `10542293263` has GitHub-recorded digest `2b9d5c00ccd8abdb9b3d1d02f994b6a66284c64333921db8f109775e54226c54`. The live result records `rawProviderBodyRetained=false`, `rawOfficialFplBodyRetained=false`, `mappingReceiptsPersisted=false` and `crosswalkPersisted=false`. The exact crosswalk remains outside public repository content.

This GO closes only team-identity qualification. It does not apply migration 0005, persist a live mapping table, enable the API-Football collector or Cron, or authorize any expected-minutes/model, projection, captaincy, transfer, rank, Mini-League, recommendation or UI influence. Those remain separate owner approval gates.

## Historical dedicated attended execution workflow remediation

The owner-approved remediation adds a separate dormant manual-only GitHub Actions workflow for the provider-universe observation rather than reusing the historical EIA-2I5E R7 response-size workflow. The new path executes exact current `main`, accepts no dispatch inputs, reuses protected environment `eia-api-football-qualification`, exposes `API_FOOTBALL_API_KEY` to one execution step, runs the existing team-universe qualification function once, and independently refuses a third HTTP egress. Focused qualification tests and exact-current-`main` checks run before credential-bearing egress. Sanitized output is integrity-validated, written only under `RUNNER_TEMP`, summarized through an allowlist and retained as a seven-day artifact. Provider names/codes remain review assistance only; the workflow cannot issue mapping receipts.

At that repository-remediation stage, zero provider requests and zero credential accesses had occurred; provider execution was still blocked pending merge, exact-main verification, active `refs/heads/main` protection and protected-environment re-verification. Mapping was NO-GO 2/20 at that time, and no collector/runtime/model/UI activation was authorized.

# API-Football ↔ Official FPL 20-club mapping qualification

Date: 18 September 2026  
Status: **live team-identity qualification GO 20/20**; persistence/runtime/model/UI activation remain separately owner-gated.  
Merged by PR #254 to `main` as `83c7d5ce86077502ca691f7ff4e1941568dc083d`. Post-merge Verify Teamsheet run `35321967633` passed 2,162/2,162 tests, byte-identical production rebuilds and exact manifest identity.

## Outcome

PR #254 implemented the repository contract needed to qualify the complete 2026/27 Premier League API-Football ↔ Official FPL team mapping without weakening EIA-2I5A identity rules. PR #257 later added the private/hash-bound owner-closeout path, and attended run `35333898797` completed that contract with **GO 20/20**. The historical PR #254 stage itself made no API-Football request or runtime change; the later closeout likewise made 0 API-Football requests and changed no D1, collector, Cron, model or UI path.

No new EIA checkpoint identifier is assigned here because current canonical `main` did not establish one.

## Qualification-only provider universe request

The pre-live qualification module now owns one closed request shape for a later separately approved attended run:

`GET https://v3.football.api-sports.io/teams?league=39&season=2026`

The request is not added to `API_FOOTBALL_ENDPOINTS`, the collector request contract, scheduler or Worker package. The production/shadow collector therefore remains restricted to its existing four workload endpoint paths.

The request builder accepts no caller-supplied league, season, endpoint, URL, origin, method or parameters. Response admission requires:

- endpoint `teams`;
- echoed league `39`;
- echoed provider season `2026`;
- paging exactly `1/1`;
- exactly 20 rows;
- exactly 20 unique positive provider team IDs;
- valid bounded provider team identity fields;
- response size no greater than 720,896 bytes.

Provider names/codes are retained only as normalized review metadata. They do not create mappings.

## Attended-run harness

`runAttendedApiFootballTeamUniverseQualification()` is dormant library code. It receives its credential, transport, delay function and execution identity from a future explicitly approved caller; it reads no environment variable and schedules nothing itself.

A normal successful qualification consumes one request. At most two attempts are permitted. A second attempt is allowed only after a transport failure, timeout or temporary 5xx and requires an injected 1-second delay. Authentication failures, HTTP 429, other HTTP failures, schema/identity failures, pagination failures, malformed quota headers, oversized responses and team-universe conflicts stop immediately.

Returned evidence is normalized and integrity-bound. Raw provider bodies, credentials and request headers are not retained.

## Evidence and mapping admission

A newly observed provider team is **not** automatically mapped to an FPL team.

New mapping receipts require all of:

- a valid content-bound current Official FPL team-universe authority;
- a structurally valid current-season `VERIFIED` API-Football team mapping;
- mapping method `manually_verified`;
- membership of the exact attended provider-team universe;
- provider-universe integrity validation;
- evidence type `attended_api_football_team_universe`;
- qualification method `owner_verified_provider_id_crosswalk`;
- explicit `OWNER_VERIFIED` review state;
- a non-empty review reference;
- review timestamp at or after the provider observation;
- non-empty provenance;
- an integrity-bound receipt tying provider team ID, FPL identity, provider-universe revision and Official FPL authority digest together.

Display-name equality, fuzzy matching, abbreviations, provider aliases, kickoff proximity or fixture participation alone remain incapable of minting a receipt.

The historical EIA-2I4C adapter remains unchanged and continues to own the existing Chelsea and Leeds receipts.

## Legacy anchors and bijection

Complete mapping qualification additionally fails closed if either historical anchor is contradicted:

- API-Football Chelsea `49` must map to `2026-27:fpl:team:6`;
- API-Football Leeds `63` must map to `2026-27:fpl:team:13`.

The live GO required and satisfied the existing EIA-2I5A/EIA-2I5B exact bijection:

- exactly 20 admitted mappings;
- every provider ID unique;
- every Official FPL ID unique;
- exact coverage of the current Official FPL 20-club authority;
- no extra target;
- no missing club;
- exact season binding;
- valid provenance/revisions/methods;
- no ambiguous or conflicted identity.

The final qualification result is canonicalized and integrity-hashed so identical evidence produces identical output independent of mapping input order.

## Current state after live closeout

Mapping qualification is **GO 20/20** by attended run `35333898797`. The 18 owner-reviewed receipts and 2 trusted legacy receipts formed an exact current-season bijection with zero unresolved mappings or receipt failures. The closeout made 0 API-Football requests because it reused the exact prior provider-universe evidence and refreshed only Official FPL authority with two reads.

The next provider step is intentionally **not selected or auto-authorized**. Any durable mapping persistence, collector/runtime activation, migration 0005 application, Cron, workload ingestion or model/UI influence requires a separate owner-approved checkpoint.

## Preserved boundaries

This checkpoint does not:

- add `teams` to the collector endpoint allowlist;
- make a provider request;
- access or provision a credential;
- apply migration 0005 live;
- mutate D1;
- enable collection;
- declare or activate Cron;
- deploy the API-Football collector;
- alter Official FPL authority;
- alter expected minutes, fixture difficulty, projected points, captaincy, squad, transfers, simulation, rank, Mini Leagues, rivals, strategy, alerts or recommendations;
- create a browser/model/UI provider read path;
- claim predictive improvement.

## Verification

Permanent coverage is owned by `tests/api-football-team-mapping-qualification.test.mjs` plus the existing EIA-2I5A/B/E/F suites.

PR #254 exact-head verification passed 2,162/2,162 tests plus production build, deterministic rebuild and exact build identity. After merge, exact-main Verify Teamsheet run `35321967633` passed the same 2,162/2,162 suite, byte-identical production rebuilds, root/dist equality and manifest identity for merge commit `83c7d5ce86077502ca691f7ff4e1941568dc083d`.