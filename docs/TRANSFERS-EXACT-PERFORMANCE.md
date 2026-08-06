# Transfers Track A — Exact Performance and Persistent Calculation

<!-- TRANSFERS-TRACK-A-2026-08-06 -->
Status: **Owner-approved and implemented for review on `agent/transfers-exact-performance`; stacked on draft PR #70 over draft PR #69. The first physical iPhone Safari test failed and the approved corrective change is implemented but not yet physically retested. No merge is approved.**

## Product outcome

Transfers begins calculating automatically once Teamsheet has verified data, a complete legal 15-player squad and valid planning assumptions. The ordinary experience has no Calculate or Recalculate button. One exact calculation continues while the manager moves between internal destinations, and returning to Transfers restores the current progress or reuses the completed result immediately.

This item addresses search execution and lifecycle only. It does not claim that the underlying projections or football recommendations are more accurate.

## Physical iPhone Safari failure — recorded honestly

Pritesh performed the first physical test on iPhone Safari against the PR #70 GitHub Pages preview.

| Input | Value |
|---|---|
| Data | Verified saved Official FPL data |
| Squad | Complete and legal |
| Free transfers | 1 |
| Bank | £0.0m |
| Horizon | Six Gameweeks (default) |
| Result limit | Top 8 |

Observed: Transfers opened correctly, no manual Calculate button was shown and the page stayed responsive, but the automatic exact calculation ended with

> Exact search did not complete. No partial result is being presented as optimal.

That message is rendered only for `status: 'search-incomplete'`, which the optimiser returns only when the unchanged 2,000,000 evaluation ceiling is exhausted. This was a real Track A acceptance failure, not a display problem. Fail-closed behaviour worked exactly as designed — no partial incumbent was shown — but the product outcome was unusable.

## Root cause

The pre-correction search was correct but structurally too weak for an Official-scale pool.

1. **Cost per node.** Every partial node rebuilt squad rows, allocated four position arrays, sorted them for each Gameweek, allocated a fresh `Set` and club-count object, and eagerly built an optimistic completion *signature string* even though the signature can only matter on an exact comparator tie. On a reproduction of the failure shape a single node cost roughly 70–90 µs.
2. **Bound looseness.** The identity-preserving bound mixed the best formation's base with the smallest threshold across formations, and its per-position threshold was taken from the branch-level padded pool only. For any position with an outstanding slot that threshold is zero, so a candidate's optimistic gain was its *entire* six-Gameweek score. Bounds that loose cannot separate the thousands of near-tied three-transfer combinations that a real pool produces.
3. **No stopping rule.** Candidates that failed a bound were skipped individually. The enumeration still walked every remaining candidate of a position pool — roughly 200–280 players — at every partial node.
4. **Budget relaxed per player.** The optimistic completion allowed each outstanding slot the *whole* remaining budget independently, which is far too generous with an empty bank, where affordability is the binding constraint.

Together these produced both observed failure modes: on some inputs the leaf count runs past 2,000,000 (the reported failure), and on others the search visits so many partial nodes that it cannot finish in a usable time. On a Node reproduction of the failure shape the previous search took **13 minutes 38 seconds** and visited **9,480,866** partial nodes; the corrected search completes the identical case in **about 1.2 seconds** across **880,555** nodes.

## Corrective exact architecture

The approved Stage 6 objective, comparator, candidate universe and result ordering are unchanged. What changed is how the same problem is searched.

### 1. Position-quota score prefix sums

Every legal transfer is position-preserving, so for a fixed outgoing set the final pool at each position always holds exactly the position quota. Each node therefore holds, per position and per Gameweek, the descending list of member scores and its prefix sums. A horizon best-XI total is then eight formation lookups per Gameweek instead of four array rebuilds and four sorts.

An outstanding incoming slot is held as a **zero placeholder**.

### 2. Admissible bounds

Every bound below is optimistic — it can overstate a descendant but can never understate one.

| Bound | What it bounds | What is relaxed | Why it cannot understate |
|---|---|---|---|
| Zero placeholder | Horizon gross best-XI of a partially chosen node | The identity of every unchosen incoming player | A real incoming player can score below zero, and best-XI totals are non-decreasing in member scores |
| Identity gain | Extra gross best-XI a named candidate can add | The formation, by using the smallest threshold across formations | For pool `P` and score `s`, `topk(P with a placeholder replaced by s) ≤ topk(P) + max(0, s − θ_k)` where `θ_k` is the k-th largest of the padded pool; the largest starting count gives the smallest `θ`, so one gain is valid for every formation and for every outstanding slot at that position |
| Threshold delta | Reuse of a branch-level gain at a deeper node | Nothing; it is a correction term | `max(0, s − b) ≤ max(0, s − a) + max(0, a − b)`, so adding `Σ max(0, θ_branch − θ_node)` per outstanding slot keeps a branch-level gain admissible at any node — this matters only when projections can be negative |
| Final-slot per-formation bound | Gross best-XI when exactly one slot remains | Nothing beyond the placeholder | Applies each formation's own threshold and keeps the candidate's identity in every Gameweek, then takes the maximum over formations |
| Price-capped completion | Gross best-XI of any legal completion | Cross-Gameweek identity, club capacity and candidate reuse for unchosen slots | Each outstanding slot is filled with the highest-scoring candidate *at or below its own price cap*; replacing a real filler with a value at least as large cannot lower a top-k total |
| Joint-budget price cap | The price an outstanding slot can reach | Nothing | The cap is the remaining budget minus a true lower bound on the price of every *other* outstanding slot, taken as the dearest member of the cheapest legal completion at that position |

The exact ties are handled by the unchanged comparator. A bound only rejects a branch outright when its optimistic net gain is strictly below the retained Kth plan's net gain, or when net gain and gross score both tie and the *optimistic* completion — smallest reachable price, fewest reachable doubtful incomings and lexicographically smallest reachable canonical signature — still loses under `comparePlans()`. A branch that could produce a relevant tie is never removed.

### 3. Stopping rules instead of per-candidate rejection

Each position pool is enumerated in descending identity-gain order, which is fixed for the whole outgoing branch. The node ceiling — exact base for everything already chosen, plus an admissible optimistic completion — is a node constant, so `ceiling + gain(candidate)` is non-increasing across the pool. The first candidate whose optimistic net gain falls strictly below the retained Kth plan therefore proves the same for every later candidate, and the remainder of the pool is abandoned rather than scanned. A better retained Kth plan can only make that stopping point earlier, so the rule stays valid as the search improves.

### 4. Price-capped completion tables

Candidates are swept once per position in ascending price, recording, for every distinct price and Gameweek, how many candidates are affordable and their highest scores. A binary search then answers "the best k scores available at or below this price" in constant time. This replaces a price-filtered scan of the whole position pool at every partial node, which was the single largest remaining cost.

### 5. Cheaper leaves and lazy detail

A complete candidate is scored from the prefix sums, compared numerically against the retained Kth plan, and only then materialised. Canonical transfer lists, plan signatures and per-Gameweek best-XI detail are built only for a genuine contender or an exact tie.

### What did not change

- `exhaustiveTransferSearch()` is untouched and shares none of the new pruning. It remains an independent reduced-pool oracle.
- The evaluation ceiling remains 2,000,000 and still counts complete incoming combinations whose exact horizon score is computed. It still fails closed, returning only the zero-transfer baseline with `status: 'search-incomplete'`.
- The default horizon remains six Gameweeks, the result limit remains Top 8, and the maximum transfer depth remains three.

## Measured effect

Reproduction: a deterministic twenty-club Official-scale pool of about 700 players (roughly 50 goalkeepers, 195 defenders, 275 midfielders and 108 forwards eligible after ownership and unavailability), a complete squad inside the £100.0m budget carrying genuine bench fodder, £0.0m bank, one free transfer, six Gameweeks, Top 8, depth three and the unchanged 2,000,000 ceiling. Measured in Node on the review container; device figures will differ.

| Case | Previous | Corrected |
|---|---|---|
| Default six-Gameweek search (seed 7) | 817,571 ms (**13 min 38 s**) | **1,136 ms**, `status: 'ok'` |
| Depth 2 only (seed 7) | 1,834 ms | 107 ms |
| Depth 1 only (seed 7) | 83 ms | 37 ms |
| Partial nodes visited (seed 7) | 9,480,866 | 880,555 |
| Exact evaluations (seed 7) | 32 | 21 |
| Partial nodes visited at depth 2 (seed 7) | 25,891 | 11,083 |
| Complete retained top 8 (seed 7) | — | **identical** to the previous implementation's, field for field |
| Seeds 1, 2, 3, 7, 11 at depth 3 | not measurable | 1.1–3.4 s, all `status: 'ok'`, all below the ceiling |

The two implementations were also run head to head on the identical Official-scale input and their complete retained results compared field for field — signature, transfer count, net gain, gross best-XI points, hit cost, bank after, next-Gameweek free transfers and every per-Gameweek best XI. They agreed exactly on all eight retained plans. This is a recorded one-off measurement rather than a suite test, because the previous implementation needs about thirteen minutes per run; the repeatable exactness gate remains the controlled-pool oracle comparison.

The evaluation counts are low because the bounds now separate branches before a complete incoming combination is formed. Fewer evaluations is a search-efficiency result only; it says nothing about prediction accuracy.

## Football and data boundary

Unchanged:

- model `2.4.0` and rules `2026-27.3`;
- Official FPL, team-level Understat, Odds and archive provider boundaries;
- candidate eligibility and unavailable/doubtful treatment;
- selling prices, pooled affordability and club/position legality;
- free transfers, hits and 0.5 terminal roll utility;
- maximum transfer depth, horizon limits and the two-million evaluation ceiling;
- best-XI objective, comparator and result ordering;
- zero-transfer as a genuine candidate;
- no captain doubling, bench points, auto-subs or future transfer sequencing in the optimiser;
- no Cloudflare calculation and no player-level Understat.

Cheap players, defenders and goalkeepers remain in the broad eligible universe. No price, ownership, recent-points or arbitrary top-N threshold is introduced.

## Automated evidence

Complete repository result: **609 passed, 0 failed, 0 skipped**.

Two independent forms of evidence are kept apart deliberately:

1. **Controlled pools with the oracle.** `tests/transfer-exact-correction.test.mjs` compares the production search against `exhaustiveTransferSearch()` over seven deliberately adversarial shapes — mixed, goalkeeper-only, cheap enablers, doubtful-heavy, exact price boundaries, inherited club excess and fully tied projections — across 45 deterministic seeds each, plus 40 seeds at each fixed depth of one, two and three transfers. Retained plans are additionally re-scored from their own final squad through the reviewed `scoreSquadAcrossHorizon()`, and the prefix-sum machinery is checked against the reviewed best-XI scoring of the same squad.
2. **Official-scale completion, without an oracle.** A full-pool exhaustive comparison is not tractable. For the Official-scale fixture the claim is only that the exact search completes below the unchanged ceiling, returns `status: 'ok'`, returns eight plans, keeps cheap enablers and doubtful players eligible and profiles deterministically. Fail-closed behaviour is proved separately by forcing the ceiling.

Also retained unchanged: `transfer-optimiser.test.mjs`, `transfer-exact-performance.test.mjs`, `transfer-exact-scale.test.mjs`, `transfer-performance.test.mjs` (including worker-versus-direct parity) and `transfer-performance-runtime.test.mjs` (automatic start, single-worker ownership, route persistence, progress restoration, material invalidation, cancellation, stale-result rejection and session reuse).

Automated equality proves implementation agreement with the approved objective. It does not prove prediction accuracy or physical-device speed.

## Remaining acceptance gate

Physical iPhone Safari must still verify:

- immediate Transfers opening;
- automatic start without a manual Calculate button;
- **that the default six-Gameweek exact search now completes and returns plans rather than "Exact search did not complete."**;
- continued progress through repeated internal navigation;
- no Safari freeze, reload or excessive memory pressure;
- prompt explicit cancellation;
- immediate reuse of a completed result;
- default six-Gameweek completion time, ideally well below 30 seconds;
- repeated runs and material input changes;
- VoiceOver announcement of major state changes without noisy progress repetition;
- exact final plans/order matching the frozen reference input.

Until that evidence is recorded, Track A is implemented and automatically verified but **not** product-accepted and **not** approved for merge. No device-speed claim is made before Pritesh completes the new physical test.

## 2026-08-06 — Concurrent continuation reconciliation

Claude's position-pool prefix sums, per-formation/final-slot bounds, price-capped completion tables, joint-budget caps and descending identity-gain stopping rules are retained unchanged.

Two lifecycle/exactness safeguards were added during reconciliation:

1. cancelling, invalidating or superseding a Worker settles the Promise awaiting its result with an internal `AbortError`, allowing the old snapshot, score rows and handlers to be released;
2. a partial node uses the empty string as its optimistic signature, avoiding any assumption that numeric player-ID order matches locale string order. Complete plans still use the unchanged canonical signature and comparator.

The combined build passes 609 tests. Mixed-width IDs match the independent exhaustive oracle, and cancellation/supersession promises are proven to settle. A deterministic seed-7 Official-scale profile completed with 21 exact leaf evaluations across 575 outgoing branches. Physical iPhone acceptance remains outstanding.
