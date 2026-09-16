# EIA-2I5B — Hardened Provider Request and Fixture Discovery Layer

Status: owner-approved repository implementation; draft review gate.  
Base: `dd5b6e105f3dbdda2510f56eec2309e1d3ee7f81` (merge of PR #248 / EIA-2I5A).

## Outcome

EIA-2I5B adds a repository-only, dormant, hardened API-Football fixture-discovery capability. It is technically able to perform the five approved league/season discovery requests when a credential and transport are injected. This checkpoint did **not**:

- connect a real API-Football credential or Cloudflare secret;
- add a Worker route, Cron trigger or GitHub Actions schedule;
- write discovered fixtures to D1;
- add migration 0005 or any request/quota/scheduler table;
- wire API-Football discovery into production, `teamsheet-data-platform`, or the production model/UI.

GitHub/Cloudflare did automatically produce a **PR/branch preview deployment** for draft PR #249. That preview is not API-Football runtime activation: no provider credential, secret, collector, scheduler, D1 writer or production import was added. Production app artefacts remained unchanged.

No authenticated API-Football request was made while implementing this checkpoint.

Explicit request timeout/abort handling is **not** implemented here and remains a mandatory pre-live gate before any credential, unattended scheduler or production-runtime approval.

## Request surfaces

The EIA-2I1 known-ID client remains closed. It still admits only:

- `fixtures?id=<providerFixtureId>`
- `fixtures/lineups?fixture=<providerFixtureId>`
- `fixtures/players?fixture=<providerFixtureId>`
- `fixtures/events?fixture=<providerFixtureId>`

Discovery is a separate bounded surface in `src/decision-intelligence/api-football-discovery.mjs`. It reuses pinned HTTPS transport primitives from `api-football-foundation.mjs` and does not turn the known-ID API into a generic provider proxy.

Approved discovery configuration is repository-controlled. For FPL season `2026-27` the provider season is exactly `2026`, and the complete initial scan is exactly:

- `/fixtures?league=2&season=2026` — UEFA Champions League
- `/fixtures?league=3&season=2026` — UEFA Europa League
- `/fixtures?league=848&season=2026` — UEFA Conference League
- `/fixtures?league=45&season=2026` — FA Cup
- `/fixtures?league=48&season=2026` — League Cup

Callers cannot inject arbitrary league IDs, seasons, endpoints, query parameters, origins, absolute URLs or protocol-relative URLs. Malformed requests fail before fetch and consume zero quota.

## Security

Credential-bearing requests stay pinned to `https://v3.football.api-sports.io`, use `GET`, `redirect: 'error'`, and send the key only in `x-apisports-key`. The credential must not appear in the URL, normalized output, errors, logs, audit, generated application assets, D1 or test snapshots. There is no configurable-origin escape hatch and no environment reader. Redirects are rejected. HTTP 200 is not sufficient: the envelope, paging, competition/season identity, fixture/team IDs, dates, status codes and secret-material scan must all validate. Unexpected pagination is an explicit `pagination_unsupported` limitation rather than uncontrolled follow-up calls. Raw provider payloads remain transient; there is no raw-response warehouse.

## Quota, retries and audit

Exact subscription tier is still unknown. Historical runtime evidence of approximately 7,500/day and 300/minute is not hardcoded as contractual truth. Where present, case-insensitive `x-ratelimit-requests-limit`, `x-ratelimit-requests-remaining`, `x-ratelimit-limit` and `x-ratelimit-remaining` are normalized to bounded numeric counts. Missing headers are `unknown`; malformed present values fail closed. Raw headers are not persisted.

A normal scan is five successful logical requests, serial (`concurrency = 1`), with an injected delay of 1000 ms between provider attempts. Each logical request allows at most one retry, and only for transport failure or qualifying temporary server failure. Malformed/schema responses and authentication failures are not retried. HTTP 429 **always** stops the scan with a sanitized quota-exhausted result, including when rate-limit headers are absent or malformed, and does not retry. A complete five-competition scan therefore never exceeds ten provider attempts.

The in-memory audit may record logical competition key, provider league/season, attempt number, success/failure category, sanitized HTTP class, normalized quota counts, fetched timestamp, observed provider-row counts, and bounded admission/rejection counts. Provider-row diagnostics may remain on a failed scan. Final `workloadRelevantAdmitted` / rejected / unmapped / conflicted counters are admissions of a committed generation only; an unsuccessful generation keeps those admission counters at zero. The audit must not record the API key, request headers, raw bodies, provider error text, stacks, credential-bearing URLs, raw team/player names or payload fragments. No D1 request-audit table is added.

## Identity, filtering and failure

Provider fixture identity remains `<season>:api-football:fixture:<providerFixtureId>` and is independent of kickoff, venue, round, score, status or names. Home/away orientation is preserved. Qualification reuses the EIA-2I5A contract. Independent cross-source candidates are **fixture-scoped** by provider fixture ID/identity before `crossSourceQualify()`; evidence for fixture A cannot turn unrelated fixture B conflicted. Workload relevance is taken from the **final** effective qualification: `PROVIDER_QUALIFIED` and `CROSS_SOURCE_VERIFIED` are relevant; `DISCOVERED`, `REJECTED`, `AMBIGUOUS` and `CONFLICTED` are not. Names, fuzzy matching and kickoff proximity cannot map. Contradictory verified mappings remain `CONFLICTED`. Duplicate observations of the same provider fixture ID must share one core identity (season, competition, league, oriented home/away). Kickoff/status/score/venue differences do not mint a new identity; incompatible core identity fails closed as `CONFLICTED` and is never workload-relevant. Non-PL opponents keep provider-scoped identity. Canonical Chelsea–Leeds evidence is API-Football Chelsea `49` → Official FPL `6`, Leeds `63` → Official FPL `13`, fixture `1636205` on 9 September 2026; 19:00 UTC versus 19:15 UTC remains an explicit kickoff conflict with no time tolerance; canonical kickoff may stay null.

Complete current-season 20-club mapping coverage is **not** claimed and is a pre-live limitation/gate. Coverage is true only when mappings pass EIA-2I5A `validateProviderMapping()` **and** form an exact one-to-one bijection with a team universe issued from a successful DATA-S2A `normaliseOfficialFplHistory()` result. That path requires the full Official FPL bootstrap and fixtures payloads (events, 20 teams, players, element types, fixtures, season derived from GW1 deadline evidence, relationship checks). The issued authority is content-bound: season, fetched time, validator versions, the 20 club identities, and a fingerprint of the validated input. A caller-supplied array of 20 IDs, `{id}` rows, or a labeled 20-team snapshot (`official-fpl` / `official-fpl-r1` / version strings / timestamp) cannot self-certify. Copying a valid receipt and changing a team id/name, the digest, or the season fails closed. If both `teams` and `bootstrap.teams` are supplied and they disagree, or the optional `teams` representation is malformed (null rows, primitives, arrays, or missing id/name/short_name), the gate fails closed as `official_fpl_team_representation_conflicted` rather than throwing or preferring one side. Wrong season, 19/21/duplicate/malformed bootstrap teams, extra non-authoritative targets, provider→multiple-FPL, multiple-provider→same-FPL, missing mapping provenance, invalid revision, non-approved method, or non-API-Football source all fail closed. Malformed bootstrap teams without an optional representation still fail through the canonical DATA-S2A validator rather than an uncontrolled exception.

A complete five-competition discovery generation is **output-atomic**. Successful logical competitions may be held provisionally in memory while the scan runs, but newly discovered fixture evidence becomes externally visible only when all five approved competitions succeed, `scanState === 'completed'` and `ok === true`. Incomplete or failed generation — including `stopped_quota_exhausted`, `completed_with_failures`, `stopped_attempt_limit`, configuration failure after the scan begins, terminal authentication/schema failure, pagination rejection, malformed responses, exhausted retries, and other provider failures that prevent the complete five-query generation — exposes `fixtures: []`. Provisional rows collected before the failure are not reconciled or admitted. A valid HTTP 200 envelope with zero fixture rows is a successful logical competition when it passes existing validation; it does not by itself invalidate the generation. Provider failure yields no new shadow discovery evidence. It must not erase previously valid fixture identity, infer that no fixtures exist, remove a mapping, or alter Official FPL data, projections, expected minutes, captaincy or transfers. There is no D1 persistence in this checkpoint, so atomicity is an in-memory output rule rather than a storage transaction. API-Football has no automatic fallback provider. Official FPL remains authoritative for Premier League facts.

## Rights, isolation and storage

The narrow `owner_risk_accepted_private_use` contract is unchanged: exact provider `api-football`, approved EIA owner identity, one-user private non-commercial research, normalized facts only, no redistribution/public/commercial/raw-payload retention, stop on objection, shadow ingest only. No parallel rights store and no generic provider-rights escape hatch.

Discovery has zero effect on pStart, pAppear, p60, expMin, xP, scoring, best XI, captaincy, vice-captaincy, bench, transfers, optimisation, simulations, Global Rank, Mini Leagues, rivals, strategy, Provider Health or visible production UI. No production module imports this layer. No fatigue coefficient or prediction-accuracy claim is added. EIA-2I3 participation/duration semantics are untouched.

Migration 0004 remains the latest D1 schema. EIA-2I5B does not write D1, add lifecycle tables, or change wrangler/Worker/secret/Cron configuration. Durable provider persistence, durable quota accounting, and the actual provider egress/runtime environment remain later separately approved checkpoints.

## Next gate

A later owner-approved checkpoint is required before any live credential, collector, scheduler, D1 write path, Cloudflare runtime or model-adjacent use. No part of that work starts automatically.
