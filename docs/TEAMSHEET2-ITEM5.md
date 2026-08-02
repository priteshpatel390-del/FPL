# Teamsheet 2.0.5 — Mini-League Intelligence

Status: owner-approved implementation in review.  
Approval: 2 August 2026.  
Parent checkpoint: Teamsheet 2.0.4 — Mini Leagues.  
Model version: `2.4.0`.  
Rules version: `2026-27.3`.

## Objective

Add compact factual intelligence across an explicitly selected set of relevant rivals without predicting outcomes or changing Team, Transfers, projection, simulation or strategy logic.

## Approved behaviour

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

Automated source and build verification cannot establish physical iPhone Safari layout, VoiceOver reading order or live populated-data availability. Those checks must be reported only when separately performed.
