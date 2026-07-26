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
