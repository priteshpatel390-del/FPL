# API-Football ↔ Official FPL 20-club mapping qualification

Date: 18 September 2026  
Status: owner-approved repository implementation candidate; no provider execution approved in this checkpoint.  
Base main: `50fd39f92894299b3597bef624bbb55ea2482281` (merge of PR #253 / EIA-2I5F).

## Outcome

This checkpoint implements the repository contract needed to qualify the complete 2026/27 Premier League API-Football ↔ Official FPL team mapping without weakening EIA-2I5A identity rules.

It does **not** claim 20/20 mapping completion. Current admitted mappings remain only Chelsea API-Football `49` → Official FPL `6` and Leeds API-Football `63` → Official FPL `13`. No API-Football request, credential access, D1 mutation, Cloudflare provisioning, migration application, collector activation, Cron activation, deployment, model change or UI read path is part of this repository checkpoint.

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

A future GO still requires the existing EIA-2I5A/EIA-2I5B exact bijection:

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

## Current state after this repository checkpoint

Mapping remains **NO-GO 2/20** until a separately approved attended provider-universe observation is executed and the remaining 18 crosswalks are explicitly owner-reviewed and admitted.

The next owner gate after repository verification/merge is therefore an attended qualification execution proposal. Its expected provider cost is one request, with a hard maximum of two attempts under the retry conditions above.

That later execution does not authorize collector deployment or activation.

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

Completion of this repository checkpoint requires the full repository test suite, production build, deterministic rebuild and exact build-identity verification on the final branch head before owner merge approval.
