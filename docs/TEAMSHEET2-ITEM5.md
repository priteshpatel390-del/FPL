# Teamsheet 2.0.5 — Mini-League Intelligence

Status: complete and merged through PR #63 at `0b04dd68194207d301667a7100c3ed804ec1e056`.
Approval: 2 August 2026.
Merge: 3 August 2026.
Parent checkpoint: Teamsheet 2.0.4 — Mini Leagues.
Model version: `2.4.0`.
Rules version: `2026-27.3`.
Verified baseline: **510 passed, 0 failed, 0 skipped**; deterministic exact-identity production builds; root `index.html` equals `dist/index.html`.

## Objective

Add compact factual intelligence across an explicitly selected set of relevant rivals without predicting outcomes or changing Team, Transfers, projection, simulation or strategy logic.

## Implemented behaviour

- ID-free `#/leagues/exposure` route.
- Up to five explicitly selected rivals.
- Candidates from pins, nearest above, nearest below, league leader and a manager opened from loaded standings.
- Current-Gameweek public picks loaded only after the user requests them.
- At most two logical picks requests concurrently.
- Current-session reuse and stale fallback.
- Exact player-set overlap and selected-rival owner, captain, vice-captain and chip counts.
- Complete aggregate denominator requires 15 unique resolved players in positions 1–15.
- Incomplete, unavailable and stale rivals remain explicit and are excluded from the default aggregate.
- Version-2 local persistence stores choices only.
- Optional Official FPL context fields are validated before aggregation.

## Factual formulas

For complete fresh selected rivals `C`, with user player set `U` and rival set `Rᵢ`:

- pairwise overlap: `|U ∩ Rᵢ|`;
- pairwise different places: `15 - |U ∩ Rᵢ|`;
- selected-rival owner count for player `p`: `Σ I(p ∈ Rᵢ)`;
- captain and vice counts use the same exact count over validated single captain/vice records;
- unique to user: `p ∈ U` with owner count zero;
- rival-only: `p ∉ U` with owner count above zero.

The UI uses exact `X of N loaded selected rivals` wording. It does not describe the selected set as the entire league.

## Explicit exclusions

- projected rival scores or league position;
- remaining-player or live-rank simulation;
- captaincy gain/loss prediction;
- effective-ownership strategy;
- differential recommendations;
- protect, balanced or chase logic;
- full-league squad scanning;
- rival-history requests;
- new providers, origins or endpoint families;
- Team, Transfers, player-detail or primary-navigation redesign;
- Stage 10 evidence or export integration.

## Reliability and privacy

Public endpoint failure degrades per rival. A prior valid current-session record may remain visible as stale, but stale records are excluded from the fresh aggregate by default. Persisted state contains only league and rival choices; standings, picks and derived facts remain session-only. Identifiers stay out of routes, page titles, Provider Health and Stage 10 evidence.

## Acceptance limitations

Physical testing of the actual merged repository build on an iPhone was not performed. VoiceOver acceptance was not performed. Live populated-data acceptance was not performed. Automated source, calculation, route, privacy and build verification cannot establish physical iPhone Safari layout, assistive reading order or live endpoint availability.

## Implemented review refinements

- Rivals not yet requested are labelled `not loaded`, not `incomplete`.
- A comparison-set change invalidates late aggregate results and clears the busy state immediately.
- The selection identity is deterministic regardless of rival ordering.
- A direct `#/leagues/exposure` load hands focus to the exposure heading after the dynamically built section is rendered.
- Automated tests exercise concurrency two, cache/no-preload source contracts and selection-key race invalidation.

## Completion evidence

- Merge PR: #63.
- Merge commit: `0b04dd68194207d301667a7100c3ed804ec1e056`.
- Tests: **510 passed, 0 failed, 0 skipped**.
- Production builds: deterministic and byte-identical for the exact verified identity.
- Deployment equality: root `index.html` equals `dist/index.html`.
- Model version: `2.4.0`.
- Rules version: `2026-27.3`.

The next formal checkpoint is Teamsheet 2.0.6 — Research, Evidence and Diagnostics Organisation. Investigation and design may proceed; implementation requires explicit owner approval.
