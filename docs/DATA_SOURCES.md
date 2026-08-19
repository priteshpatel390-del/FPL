# DATA_SOURCES.md

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
