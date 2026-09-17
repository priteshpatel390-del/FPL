# EIA-2I5E — Pre-Live API-Football Evidence Qualification

Date: 17 September 2026
Base: `6309dae3614aa06e7c021bfab0f138cac2437a2b` (merge of PR #250 / EIA-2I5D)

## Current state — R3 final pre-replay contract hardening

EIA-2I5E-R3 is repository-only. It made **zero API-Football requests**, did not access the API-Football credential, and changed no infrastructure, production constant, collector, model, recommendation or UI path. R3 separates arithmetic candidates from formal attended qualification, removes executable plan injection, requires exact `1/1` pagination, cross-checks enrichment against admitted fixture participants, and sanitizes body-stream failures.

| Current gate | Decision | Reason |
|---|---|---|
| Response size | **NO-GO — requalification required** | R1 preserved byte measurements but not the provider response-side echoed parameters and row-identity facts now required by R2. The 720,896-byte value remains historical arithmetic candidate evidence, not a ceiling qualified under the current contract. |
| Complete 20-club mapping | **NO-GO — 2/20** | Only Chelsea `49→6` and Leeds `63→13` are admitted through the closed canonical EIA-2I4C adapter. Eighteen clubs remain unproven. Generic caller evidence cannot mint an admitted receipt. |

`API_FOOTBALL_MAX_RESPONSE_BYTES` remains `null`. Collector remains undeployed; migration 0005 is not live; no production D1 binding, collector credential or Cron exists; collection remains disabled; runtime is not live accepted; model/UI influence remains none.

## Preserved R2 contract corrections

### Evidence admission precedes receipt integrity

A deterministic hash proves content integrity, not truth. R2 therefore closes generic receipt issuance: arbitrary `provider_fixture_participant`, fixture IDs, source labels, revisions, timestamps and provenance cannot become admitted mapping evidence. Receipt validation is only a content-binding step after the closed adapter has admitted canonical evidence.

The only current adapter is the exact EIA-2I4C repository record at commit `62865c9735095ca6b51006fadce15e0a84e68800`, path `docs/EIA-2I4C-API-FOOTBALL-QUALIFICATION-CLOSEOUT.md`. That record explicitly states Chelsea `49→6` and Leeds `63→13` through fixture `1636205`. It records the date `2026-09-09`, not an acquisition time. R2 therefore uses `evidenceDate: "2026-09-09"`, `timePrecision: "date"`, and `observedAt: null`; R1's manufactured `23:59:59` precision is superseded and not reused.

Current Official FPL authority status is the preserved R1 DATA-S2A authority for season 2026-27: source `official-fpl` / `official-fpl-r1`, exactly 20 clubs, raw payload not retained. R2 made no new authority fetch. Runtime qualification still requires the full content-bound authority object and exact current Chelsea/CHE and Leeds/LEE identities; a labeled or sanitized snapshot cannot self-certify.

### One canonical request manifest

One deep-frozen manifest owns evaluation and attended execution, in operational order:

1. `discovery-2`: `/fixtures?league=2&season=2026`
2. `discovery-3`: `/fixtures?league=3&season=2026`
3. `discovery-848`: `/fixtures?league=848&season=2026`
4. `discovery-45`: `/fixtures?league=45&season=2026`
5. `discovery-48`: `/fixtures?league=48&season=2026`
6. `fixture-1636205`: `/fixtures?id=1636205`
7. `lineups-1636205`: `/fixtures/lineups?fixture=1636205`
8. `players-1636205`: `/fixtures/players?fixture=1636205`
9. `events-1636205`: `/fixtures/events?fixture=1636205`
10. `fixture-1635643`: `/fixtures?id=1635643`
11. `players-1635643`: `/fixtures/players?fixture=1635643`

Any changed league, fixture, endpoint class, query, logical ID, item count, replacement or order returns `qualification_plan_not_canonical` before provider egress.

### Response identity and sample sufficiency

Every response must have exact `get` and exact echoed parameters. Discovery fixture rows must match requested league and season. Known-fixture samples must contain exactly one row with the requested fixture ID. Lineup and players samples must be non-empty and cover exactly two provider teams. Events must be non-empty. Discovery must contain at least one fixture. Sanitized measurements retain only expected request identity, echoed allowlisted parameters, response-identity result, row-identity state, sufficiency, bytes, rows, paging and normalized quota.

The runner stops immediately after authentication failure, 429, redirect, oversize response, quota uncertainty/invalidity, schema failure, response-identity mismatch, unresolved pagination, insufficient sample, transport/timeout failure or other unexpected provider state. No later manifest item is issued after a stop.


## R3 final pre-replay corrections

Synthetic or imported measurements may be passed only to `calculateResponseByteCeilingCandidate()`. It returns `decision: "CANDIDATE"`, `arithmeticState: "CALCULATED"` and `formalQualification: false`; it cannot emit GO. Formal GO exists only inside one successful current `runAttendedApiFootballQualification()` execution after all 11 module-owned canonical requests complete. The runner rejects any supplied `plan` property, including an exact deep clone, before credential validation or transport.

Every provider sample requires integer pagination exactly `current: 1, total: 1`. Missing, zero, negative, non-integer or multi-page states fail as `qualification_pagination_unresolved`. Known fixtures must match requested ID, competition, provider season 2026, completed-state class and two distinct participants. Lineup/player responses require exactly two team-level rows whose distinct IDs equal the admitted fixture participant set. Events must be non-empty, contain valid participant context and introduce no third team.

Body stream rejection is caught before it can escape the runner. Partial chunks are discarded, reader cancellation is best effort, cancellation failure is ignored, `provider_body_read_failed` is retained as primary sanitized reason, and no later request is issued. Timeout, transport, unreadable body and every other safety stop set `stoppedBySafety: true`; secondary quota uncertainty does not replace an already-established primary failure.

## Quota boundaries

R1 headers observed an account/runtime quota of **7,500 requests/day** and **300 requests/minute**. These are observations, not a guaranteed contractual entitlement and not an approved collector budget. R1 used 11 requests; R2 used 0; R3 used 0. Separately, Teamsheet retains its conservative internal `API_FOOTBALL_DAILY_REQUEST_LIMIT = 100` safety ceiling. R3 changes neither value nor behaviour.

## Historical R1 attended measurement — preserved, not current qualification

R1 used 11 of 16 approved attempts, with zero retries. All intended requests returned HTTP 200, known quota state and paging 1/1; raw bodies were not retained. These useful measurements remain unchanged:

| Intended request | Bytes | Rows | Paging |
|---|---:|---:|---|
| `discovery-2` | 220,363 | 234 | 1/1 |
| `discovery-3` | 209,572 | 224 | 1/1 |
| `discovery-848` | 347,982 | 366 | 1/1 |
| `discovery-45` | 215,224 | 224 | 1/1 |
| `discovery-48` | 73,793 | 76 | 1/1 |
| `fixture-1636205` | 38,374 | 1 | 1/1 |
| `lineups-1636205` | 4,068 | 2 | 1/1 |
| `players-1636205` | 26,226 | 2 | 1/1 |
| `events-1636205` | 6,006 | 21 | 1/1 |
| `fixture-1635643` | 42,710 | 1 | 1/1 |
| `players-1635643` | 30,052 | 2 | 1/1 |

R1 observed maxima were discovery 347,982 bytes, fixture 42,710, lineups 4,068, players 30,052 and events 6,006. Overall maximum was **347,982 bytes**. Twice that maximum rounded to the next 64 KiB produced **720,896 bytes**, with 372,914 bytes absolute margin. The separate attended abort ceiling was 8 MiB.

R1 did not preserve exact echoed response parameters or row-identity validation facts. Its request-side labels cannot establish response-side identity after raw-body disposal. Therefore R2 cannot independently re-prove the R1 samples under the stronger contract. Historical measurement state is **preserved**; qualification under current contract is **false**; credentialed response requalification is required under a separate future owner approval.

## Historical initial EIA-2I5E — zero-attempt outcome

The initial checkpoint made zero API-Football attempts because no approved credential route was available in that environment. Response-size and mapping gates were both NO-GO. Official FPL DATA-S2A authority issued exactly 20 clubs; Chelsea `49→6` and Leeds `63→13` were the only qualified mappings. This remains historical and is not rewritten as a provider run.

## Rights, security and isolation

Rights remain `owner_risk_accepted_private_use`: private, one-user, non-commercial normalized research only; no redistribution, public/commercial use or raw provider warehouse; stop on objection. Raw provider bodies and Official FPL source payloads are not retained. No provider evidence has a production/browser read path into expected minutes, projected points, captaincy, squad selection, transfers, simulation, fixture difficulty, rank, Mini-Leagues, rivals, strategy, alerts or UI.

## Remaining gate and stop

Current response-size and mapping decisions are independently NO-GO. The exact proposed next checkpoint is **EIA-2I5E-R4 — Credentialed Canonical Response Requalification**, using the module-owned 11-request manifest and R3 identity, participant, pagination, stream and stop contracts. No such call is approved here. EIA-2I5F, infrastructure provisioning, production ceiling implementation and collector activation do not start.
