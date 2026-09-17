# EIA-2I5E — Pre-Live API-Football Evidence Qualification

Date: 17 September 2026
Base at closeout: `7314c30580f52a56c014bd5c8fb1e7de6ad14ca2` (merge of PR #252 / EIA-2I5E-R7A)
Executed candidate: `03cd231cd3e1d38821194a5d1aad87bc87232154`

## Current state — R7 successful attended qualification closeout

The owner manually dispatched `EIA-2I5E API-Football Qualification` from protected `main`. GitHub Actions run `35248079758` (run number 1, attempt 1, event `workflow_dispatch`) checked out and executed exact candidate `03cd231cd3e1d38821194a5d1aad87bc87232154`. The run concluded **success**. Sanitized artifact `eia-2i5e-qualification-result` ID `10508920046` digest `sha256:dd6b907cefe6c5d0b29b8c269d91a622ff45411303a571eeb1831d004b5e3459` had seven-day GitHub retention.

| Current gate | Decision | Detail |
|---|---|---|
| Response size | **GO** | Formal qualification `ATTENDED_CANONICAL_QUALIFIED`. Observed maximum **347,982 bytes**. Qualified proposed ceiling **720,896 bytes**. |
| Implemented production ceiling | **NO** | `API_FOOTBALL_MAX_RESPONSE_BYTES` remains **`null`**. 720,896 is a qualified proposed value awaiting a separate implementation approval. |
| Complete 20-club mapping | **NO-GO — 2/20** | Only Chelsea `49→6` and Leeds `63→13` are admitted through the closed canonical EIA-2I4C adapter. Eighteen clubs remain unproven. R7 did not expand mapping. |
| Collector / infrastructure | **inactive** | Not activated by this checkpoint. No Cloudflare provisioning, D1 migration application, Cron or model/UI influence. |

R7 closeout itself made **0** API-Football requests and **0** credential accesses. The 11 provider requests belong only to attended run `35248079758`.

### R7 formal result

Response-size GO / `ATTENDED_CANONICAL_QUALIFIED`. attempts 11, retries 0, stoppedReason null. observedMaximum 347982. proposedCeiling 720896. doubledMaximum 695964. marginBytes 372914. productionConstant null. implemented false.

### R7 live measurements

Acquisition timestamps are GitHub run/artifact times only: started `2026-09-17T16:40:53Z`, artifact `2026-09-17T16:41:34Z`, updated `2026-09-17T16:41:37Z`.

| Canonical request | HTTP | Bytes | Rows | Quota remaining | Minute remaining |
|---|---:|---:|---:|---:|---:|
| `discovery-2` | 200 | 220363 | 234 | 7488 | 299 |
| `discovery-3` | 200 | 209572 | 224 | 7487 | 298 |
| `discovery-848` | 200 | 347982 | 366 | 7486 | 297 |
| `discovery-45` | 200 | 215224 | 224 | 7485 | 296 |
| `discovery-48` | 200 | 80228 | 83 | 7484 | 295 |
| `fixture-1636205` | 200 | 38371 | 1 | 7483 | 294 |
| `lineups-1636205` | 200 | 4068 | 2 | 7482 | 293 |
| `players-1636205` | 200 | 26226 | 2 | 7481 | 292 |
| `events-1636205` | 200 | 6006 | 21 | 7480 | 291 |
| `fixture-1635643` | 200 | 42710 | 1 | 7479 | 290 |
| `players-1635643` | 200 | 30052 | 2 | 7478 | 289 |

Every sample passed HTTP 200, response identity, exact echoed parameters, sample sufficiency, pagination 1/1, participant checks where applicable, known quota state, and raw-body-retained false. Class maxima: fixtures_discovery 347982, fixture 42710, lineups 4068, players 30052, events 6006. Arithmetic: 347982 * 2 = 695964, rounded to next 65536 = 720896. R1 is historical corroboration only (`discovery-48` 73793/76 then vs 80228/83 now; `fixture-1636205` 38374 then vs 38371 now). Formal GO is exclusively run 35248079758. Known client attempts 23; confirmed successful provider HTTP 22.

## Historical state — R5 transport preflight stopped safely

EIA-2I5E-R5 DNS passed and TCP/TLS failed with `ENETUNREACH`. Phase B did not run.

## R5 transport preflight result

| Check | Result |
|---|---|
| DNS resolution | passed |
| TCP/TLS connection to port 443 with exact-host SNI | failed — `ENETUNREACH` |
| Certificate validation through normal trust store | not reached |
| HTTP requests written during preflight | 0 |
| Credential accessed during preflight | false |
| Canonical runner invocations | 0 |
| API-Football HTTP attempts | 0 |
| Retries | 0 |

R5 stop reason is `tcp_connection_failed`. No response headers or body arrived, so HTTP state, streamed bytes, rows, paging, echoed parameters, identity, participant evidence and quota telemetry are unavailable. All 11 canonical requests were skipped. Known EIA-2I5E qualification attempts therefore remain 12: R1 11, R2 0, R3 0, R4 1 and R5 0.

## Historical R4 attended result

Attempt budget was 11; one attempt was used and retries were zero. Known EIA-2I5E qualification attempts are now 12: R1 11, R2 0, R3 0 and R4 1. Whether the failed transport reached provider accounting is not provable without response headers.

| Canonical request | State | HTTP | Bytes | Rows | Paging | Echoed parameters | Identity |
|---|---|---:|---:|---:|---|---|---|
| `discovery-2` — `/fixtures?league=2&season=2026` | attempted; `transport_failure` | unavailable | unavailable | unavailable | unavailable | unavailable | not established |
| `discovery-3` — `/fixtures?league=3&season=2026` | skipped | — | — | — | — | — | not evaluated |
| `discovery-848` — `/fixtures?league=848&season=2026` | skipped | — | — | — | — | — | not evaluated |
| `discovery-45` — `/fixtures?league=45&season=2026` | skipped | — | — | — | — | — | not evaluated |
| `discovery-48` — `/fixtures?league=48&season=2026` | skipped | — | — | — | — | — | not evaluated |
| `fixture-1636205` — `/fixtures?id=1636205` | skipped | — | — | — | — | — | not evaluated |
| `lineups-1636205` — `/fixtures/lineups?fixture=1636205` | skipped | — | — | — | — | — | not evaluated |
| `players-1636205` — `/fixtures/players?fixture=1636205` | skipped | — | — | — | — | — | not evaluated |
| `events-1636205` — `/fixtures/events?fixture=1636205` | skipped | — | — | — | — | — | not evaluated |
| `fixture-1635643` — `/fixtures?id=1635643` | skipped | — | — | — | — | — | not evaluated |
| `players-1635643` — `/fixtures/players?fixture=1635643` | skipped | — | — | — | — | — | not evaluated |

No fixture participant set was admitted, so enrichment participant validation and sample sufficiency were not reached. Provider daily/rate limits and starting/ending remaining counters are unavailable because no response headers were received. Raw body retention is false; no response body existed to retain. Credential value was neither printed nor persisted.

R4 class maxima, overall maximum, doubled maximum, 64-KiB rounding, proposed ceiling and absolute margin are all unavailable. Compared with R1's 347,982-byte maximum and 720,896-byte arithmetic candidate, R4 provides no higher or lower candidate: the transport failure prevented measurement. R1 remains historical evidence only. Residual risk remains unbounded for current responses, including large player-stat rows, pagination and provider schema expansion.

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

Response-size is independently **GO**. Mapping remains independently **NO-GO 2/20**. Do not collapse those into one overall GO. Production ceiling implementation, the remaining 18 mappings, collector activation, Cloudflare provisioning, D1 mutation, Cron and model/UI consumption each need separate owner approval. R7 closeout made zero provider requests. PR #251 remains draft, owner-gated and unmerged.
