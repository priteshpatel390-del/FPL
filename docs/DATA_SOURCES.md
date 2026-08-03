# DATA_SOURCES.md
Purpose: reference for every external source. Audience: provider work, Stage 3+.
Last updated: 2026-07-26. Related: AUDIT.md §1–3 (full audit tables — kept as the detailed record;
this file is the maintained summary), STAGE3-DESIGN.md §2 (validation flow), DECISIONS D-05/D-06/D-09/D-10.

## Official FPL API — foundation
Purpose: players/prices/teams/fixtures/GWs/ownership/status/news/minutes/points/BPS/DC/xG-xA/entry/
picks/history/leagues. Authority: high (game's own data; player xG is Opta-derived). Transport:
public CORS relays (no secrets carried) — availability medium. Schema stability: medium
(undocumented; validate at runtime from Stage 3). Licensing: unofficial, tolerated. Refresh: every
load; future SWR per STAGE3-DESIGN §6 thresholds. Caching: versioned envelope (schemaVersion+season).
Fallback: cached snapshot with age labelling. Health: live/cached/stale/partial. Future: /api proxy
at serverless; actual-club-matches denominators (Stage 4).

## Understat — team form layer only (D-05)
Purpose: last-6 team xG/xGA multipliers, 45% blend vs FPL strengths. Authority: medium (own xG
model; NOT comparable to Opta figures — never mix at player level). Transport: relay scrape of
embedded teamsData JSON — fragile. Licensing: ToS-grey; owner-approved continue-at-reduced-cadence
pending ablation. Refresh target: after completed matches only. Fallback: FPL strengths, confidence
reduced. Future: survives only if Stage-7 ablation shows out-of-sample gain; ClubElo evaluated as
prior/anchor alternative (D-10).

## The Odds API — market layer
Purpose: h2h+totals (UK region) → devigged, outlier-filtered, staleness-cut market-implied team
goals; 65% blend where a fixture is confidently quoted (weight unvalidated — D-09). Authority: high.
Transport: DIRECT ONLY (D-06/SEC-1) — key never relayed. Licensing: clean. Quota: 500 credits/mo,
2/call ≈ 250 calls → refresh few×/day + pre-deadline only (never per-load polling). Schema: stable;
per-event provenance retained (id, kickoff, fetchedAt, books, markets, confidence). Matching: teams
+ kickoff proximity (72h). Fallback: internal team model, reduced confidence. Historical: none on
free tier → prospective logging from GW1 2026-27 (ODDS-2).

## vaastav historical archive
Purpose: per-GW per-player CSVs for backtesting/calibration. Transport: raw.githubusercontent,
direct, CORS-open, user-initiated download with progress. Reproducibility: medium until pinned
(BT-1). Licensing: public community dataset; attribute in README. Immutable-once-downloaded caching
planned (Stage 7).

## Storage (window.storage / localStorage)
Config, manual squad, saved leagues, calibration, cache envelope. Never stores Anthropic keys
(D-08); odds key accepted-temporary with Stage-3 hygiene (forget action, scrubbing).

## Explicitly rejected sources
Sentiment/social/trends/etc. (owner spec §6); player-level Understat (D-05); FBref & Transfermarkt
scraping without owner licensing approval; subscription predicted-lineup scraping (a provider-
neutral startProbability interface may ingest a PERMITTED source later — Stage 4 optional input).

## Endpoint validation inventory (D-14, Stage 3 item 2)
Every externally fetched payload and its cached equivalent, the consumer that
defines its minimum shape, and what fatal/partial mean for it. Validators live
in `src/providers/validate.mjs`; issues land on `S.dataIssues`.

| Provider | Endpoint | Consumer | Minimum required shape | FATAL | PARTIAL |
|---|---|---|---|---|---|
| fpl | `/bootstrap-static/` | `slim()`, `hydrate()` | object with `events[]`, `teams[]`, `elements[]`, `element_types[]` | not an object; any of the four collections missing or not an array | rows that are not objects or lack an `id`; duplicate `id` (first kept) |
| fpl | `/fixtures/` | `hydrate()` → ticker, projections, chips | array | not an array | duplicate/conflicting/unidentifiable rows (D-13) |
| fpl | `/entry/{id}/` | `loadAll`, squad + header views | object; `name` read for display | not an object | `name` missing (not manufactured) |
| fpl | `/entry/{id}/event/{gw}/picks/` | `mySquad()` | object with `picks[]`, rows having `element` + `position` | not an object; `picks` missing or not an array | invalid rows; duplicate `element` (first kept) |
| fpl | `/entry/{id}/history/` | chip list | object; `chips[]` optional | not an object | `chips` present but wrong type (emptied); chip rows without `name` |
| fpl | `/leagues-classic/{id}/standings/` | league comparison | object with `standings.results[]`, rows having `entry` | not an object; `standings.results` missing | invalid rows; duplicate `entry` (first kept) |
| fpl | rival picks (pooled, same shape) | effective ownership | as picks above | per-response only — never blocks the panel | collapsed across the pool |
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

## Teamsheet 2.0.4 Official FPL League field contract

No provider or network origin is added. The existing Official FPL endpoints are consumed more deliberately:

| Endpoint | 2.0.4 fields used | Behaviour |
|---|---|---|
| `/entry/{id}/` | `name`, overall points/rank where supplied, `leagues.classic[].{id,name,entry_rank,entry_last_rank}` | Discover public classic leagues and locate the manager without scanning every page. Invalid membership rows are dropped and reported. |
| `/leagues-classic/{id}/standings/?page_standings={page}` | `league.name`, `standings.results[].{entry,entry_name,player_name,rank,last_rank,total,event_total}`, `has_next` | Official current table, movement and simple points gaps. Page 1 and pages around the official rank load first; further pages are user requested. |
| `/entry/{id}/event/{gw}/picks/` | `picks[].{element,position,multiplier,is_captain,is_vice_captain}`, `active_chip` | On-demand selected-rival squad, captaincy and exact set comparison. No league-wide fan-out. |

League names/IDs, selected rivals and pins persist locally under `fpl:mini-leagues` version 1. Standings, points and rival squads are session-only and are not model inputs, Stage 10 evidence or exports. Public endpoint failure preserves only a clearly labelled in-session stale result where one exists; no value is manufactured.

## Teamsheet 2.0.5 selected-rival exposure contract

No provider, origin or endpoint family is added. The existing Official FPL standings and current-Gameweek picks endpoints support an explicitly selected group of at most five rivals.

- Rival picks load only after an explicit user action.
- At most two logical rival requests run concurrently.
- Current-session results are reused by league, rival and Gameweek.
- Aggregate squad exposure includes only fresh records with 15 unique, resolved players in positions 1–15.
- Incomplete, unavailable and stale records remain visible but are excluded from the default denominator.
- Counts are labelled as selected-rival facts rather than whole-league ownership or effective ownership.
- Optional `entry_rank`, `entry_last_rank`, `last_rank`, `event_total`, `multiplier`, captain, vice-captain and active-chip fields are validated before aggregation. Invalid optional context degrades to unavailable without discarding otherwise valid player ownership.
- Standings, picks and derived exposure remain session-only. Only the explicit selected rival IDs and labels persist under `fpl:mini-leagues` version 2.
