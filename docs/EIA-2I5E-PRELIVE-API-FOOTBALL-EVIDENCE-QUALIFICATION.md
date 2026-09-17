# EIA-2I5E — Pre-Live API-Football Evidence Qualification

Date: 17 September 2026
Base: `6309dae3614aa06e7c021bfab0f138cac2437a2b` (merge of PR #250 / EIA-2I5D).

## Outcome

EIA-2I5E is an attended evidence-qualification checkpoint. It does **not** activate the collector.

| Gate | Decision | Reason |
|---|---|---|
| Response-size / `API_FOOTBALL_MAX_RESPONSE_BYTES` | **NO-GO** | No authorized API-Football credential was available through an already-approved secure route. Zero provider HTTP attempts were made. The production constant remains `null`. |
| Complete 20-club API-Football → Official FPL bijection | **NO-GO** | Official FPL DATA-S2A authority issued successfully (exactly 20 current-season clubs). Only Chelsea `49→6` and Leeds `63→13` remain verified. Eighteen clubs are unmapped. Names were not used to fill gaps. |

Canonical EIA-2I5D status after this closeout:

- EIA-2I5D repository implementation: **MERGED** (PR #250)
- exact-main verification: **PASSED** (Verify Teamsheet run `35152280445`, run number 735)
- collector: **NOT** deployed
- migration 0005: **NOT** applied live
- credential: **NOT** provisioned to collector runtime
- Cron: **NOT** active
- collection: **DISABLED**
- provider shadow runtime: **NOT** live accepted
- model/UI influence: **NONE**

No production `API_FOOTBALL_MAX_RESPONSE_BYTES` value is implemented. No Cron, Worker secret, live D1 mutation, collector deployment or model path was added.

## Approval boundary

Owner approval covered documentation status closeout, investigation, and bounded attended API-Football requests strictly necessary to gather response-size and 20-club mapping evidence. It did **not** authorize production collector activation, live D1 mutation, Cron, kill-switch enablement, secret provisioning, or model/UI influence.

The hard attempt budget declared before any provider request was **16**. That is below one-fifth of the repository 100-attempt UTC safety ceiling. Retries would have counted. The budget was not expanded.

## Live request plan (not executed)

Approved closed surface only, serial GET, origin `https://v3.football.api-sports.io`, header `x-apisports-key`, redirect rejected, 15-second timeout, ≥1s gap:

1. discovery `GET /fixtures?league=48&season=2026` (League Cup high-water candidate)
2. discovery `GET /fixtures?league=2&season=2026` (UCL high-water candidate)
3. discovery `GET /fixtures?league=3&season=2026`
4. discovery `GET /fixtures?league=848&season=2026`
5. discovery `GET /fixtures?league=45&season=2026`
6. known fixture `GET /fixtures?id=1636205`
7. `GET /fixtures/lineups?fixture=1636205`
8. `GET /fixtures/players?fixture=1636205` (expected largest class)
9. `GET /fixtures/events?fixture=1636205`
10. known fixture `GET /fixtures?id=1635643`
11. `GET /fixtures/players?fixture=1635643`

Stop immediately on 401, 403, 429, or uncertain quota headers. Raw bodies remain transient. This plan was recorded and tested with injected transport; it was **not** sent to the provider.

## Official FPL / DATA-S2A authority

Public Official FPL `bootstrap-static` and `fixtures` were fetched once, redirects rejected, then passed through `normaliseOfficialFplHistory()` / `issueOfficialFplTeamUniverseAuthority()`. Raw payloads were discarded immediately after issuing the 20-club receipt.

| Field | Value |
|---|---|
| Season | `2026-27` (derived from GW1 deadline `2026-08-21T17:30:00Z`) |
| Fetched | `2026-09-17T05:54:58.321Z` |
| Counts | 38 events, 20 teams, 659 players, 380 fixtures |
| Source | `official-fpl` / `official-fpl-r1` |
| Raw retained | no |

A labeled 20-ID snapshot cannot self-certify. This receipt used the full bootstrap+fixtures canonical path.

## 20-club mapping table

| Club | API-Football team ID | Official FPL team ID | Evidence | Status |
|---|---:|---:|---|---|
| Arsenal | — | 1 | current Official FPL authority only | UNMAPPED |
| Aston Villa | — | 2 | current Official FPL authority only | UNMAPPED |
| Bournemouth | — | 3 | current Official FPL authority only | UNMAPPED |
| Brentford | — | 4 | current Official FPL authority only | UNMAPPED |
| Brighton | — | 5 | current Official FPL authority only | UNMAPPED |
| Chelsea | 49 | 6 | EIA-2I4C fixture `1636205` + current Official FPL `Chelsea`/`CHE` | VERIFIED |
| Coventry City | — | 7 | current Official FPL authority only | UNMAPPED |
| Crystal Palace | — | 8 | current Official FPL authority only | UNMAPPED |
| Everton | — | 9 | current Official FPL authority only | UNMAPPED |
| Fulham | — | 10 | current Official FPL authority only | UNMAPPED |
| Hull City | — | 11 | current Official FPL authority only | UNMAPPED |
| Ipswich Town | — | 12 | current Official FPL authority only | UNMAPPED |
| Leeds | 63 | 13 | EIA-2I4C fixture `1636205` + current Official FPL `Leeds`/`LEE` | VERIFIED |
| Liverpool | — | 14 | current Official FPL authority only | UNMAPPED |
| Man City | — | 15 | current Official FPL authority only | UNMAPPED |
| Man Utd | — | 16 | current Official FPL authority only | UNMAPPED |
| Newcastle | — | 17 | current Official FPL authority only | UNMAPPED |
| Nott'm Forest | — | 18 | current Official FPL authority only | UNMAPPED |
| Spurs | — | 19 | current Official FPL authority only | UNMAPPED |
| Sunderland | — | 20 | current Official FPL authority only | UNMAPPED |

Chelsea/Leeds reuse required exact current Official FPL identity, not name similarity. No other club was certified. Kickoff conflict 19:00 vs 19:15 UTC on fixture `1636205` remains explicit and does not invalidate those team identities.

## Response-size recommendation

No observed provider byte counts exist. EIA-2I4C recorded row shapes, not body sizes. The qualification helper will recommend an exact ceiling only when all five endpoint classes succeed, discovery and players high-water samples are present without unresolved pagination, and twice the observed maximum rounded up to the next 64KiB remains ≤ 2MiB. That helper does **not** write `API_FOOTBALL_MAX_RESPONSE_BYTES`. An 8MiB attended abort cap is a session safety net, not a production ceiling.

If a later attended credentialed sample is GO, runtime exceedance must continue to fail closed as `provider_response_too_large` without admitting the body.

## Rights, security and isolation

`owner_risk_accepted_private_use` is unchanged: private one-user non-commercial normalized research; no redistribution, public/commercial use or raw-payload warehouse; stop on objection. No first-party provider-terms contradiction was observed because no API-Football request was made.

No API key, request header, keyed URL, raw provider body or arbitrary provider error was printed, logged or persisted. Official FPL raw bootstrap/fixtures were discarded after authority issuance.

Shadow evidence has no read path into pStart, pAppear, p60, expected minutes, projected points, captaincy, transfers, squad selection, simulations, fixture difficulty, rank, Mini-Leagues, rivals, strategy, alerts or UI.

## Remaining live gates

Separate owner approval is still required for: attended credentialed response-size qualification; complete 20-club bijection from non-name evidence; real existing-D1 binding; live migration 0005; Worker secret; deployed collector Worker still disabled; no Cron; fail-closed live infrastructure proof. Actual shadow collection activation remains later than that.

Proposed next checkpoint, not approved here: **EIA-2I5F — Disabled Live Infrastructure Provisioning & Acceptance**, and only after both EIA-2I5E gates are independently GO. This checkpoint stops without activation.
