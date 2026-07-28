# FPL Planner — Data Source Audit (Stage 1 deliverable)
Date: 2026-07-26 · App version audited: single-file build, 96,153 bytes · Auditor: Claude

## 1. Source audit table

| Source | Data supplied | Current use | Reliability | Refresh | Risks | Recommended action | Fallback |
|---|---|---|---|---|---|---|---|
| Official FPL API (unofficial/undocumented) | Players, prices, teams+strengths, fixtures, GWs, ownership, transfers, status, chance_of_playing, news(+age), minutes, points, bonus, BPS, DC, xG/xA per-90, entry/picks/history, league standings | Foundation of everything | High when reachable; undocumented schema can change without notice | Every load | No CORS headers → depends on public relays; schema drift; picks lag one GW | KEEP as foundation. Add runtime schema validation + degraded-data warnings (Stage 2/3) | Cached snapshot (exists, needs schemaVersion) |
| Public CORS relays ×5 (allorigins, corsproxy.io, codetabs, thingproxy) | Transport only | All FPL + Understat traffic; odds fallback path | Poor–fair; rate limits; outages already observed in production use | n/a | **Relay operators see full request incl. odds key in fallback path (line 221)**; availability; MITM trust | REDUCE now (strip key from relay path), REMOVE at serverless migration | Multiple relays tried in order; cached data |
| Understat (scraped league page) | Team last-6 xG/xGA (season fallback: previous year) | Team-strength blend, 45% weight vs FPL strengths | Fragile: regex on embedded JSON; breaks on any page change | Each load (excessive; matches change ~daily) | ToS-grey scraping; via relays; name-mapping drift; prev-season last-6 treated as "current form" pre-season (mislabels) | KEEP conditionally pending ablation (§7); refresh only after completed matches; fix early-season blending per spec | FPL strengths only, confidence flag |
| The Odds API (licensed) | EPL h2h + totals (UK region, ~40 soft books; no sharp books) | Market-implied team xG, 65% weight when quoted | Good (real API, licensed) | Each load + key change (excessive vs 500 credits/mo; 2 credits/call ≈ 250 calls) | Quota exhaustion under auto-refresh; **key exposure via relay fallback**; devig only partial (h2h per-book, avg-of-probs); split exponent 0.45 unvalidated; no staleness check; fixture matching by team-pair only (no event id/kickoff) | KEEP; throttle to few×/day + pre-deadline; proper multi-book devig; record updatedAt; historical odds NOT free → ablation must be prospective (§7) | Internal team model, confidence downgrade |
| vaastav archive (raw.githubusercontent) | Per-GW per-player history 2016– (incl. 2025-26 with DC) | Backtest download in-browser | Good; community-maintained; served with CORS | On demand | Un-pinned `master` branch → not reproducible; name|position join key collides on duplicates | KEEP; pin to commit SHA; join on element id within season | 2024-25 file fallback (exists) |
| window.storage / localStorage | Config, squad, leagues, cache, calibration | Persistence | Good after Stage-1 fixes | n/a | No schemaVersion/season on cache; odds key in localStorage (accepted temporarily per owner decision, labelled) | Add versioned cache envelope (Stage 2); key noted as known limitation | In-memory |

## 2. Usage map (source → module → formula)
- FPL bootstrap → state.hydrate → strengths feed matchContext (layer 1); per-90s feed playerFixtureXP; status/chance feed availability(); transfers_in/out feed priceMomentum; events feed deadlines.
- FPL fixtures → teamFixtures → ticker, ease, xP per fixture, blank/double detection.
- FPL entry/picks/history → mySquad, chipsUsed, bank prefill. Picks lag one GW (documented).
- Understat teamsData → S.ustat multipliers → matchContext layer 2 (0.55/0.45 blend).
- Odds → S.odds map "homeId|awayId" → matchContext layer 3 (0.35/0.65 blend).
- vaastav merged_gw → runBacktest → S.calib per-position multiplier → final xP scale.

## 3. Issues found (severity-ordered)
1. **SEC-1 (high):** odds key transits public relays in fallback (app.js:221). Fix in Stage 3: never send key via relay; direct-only, else degrade to internal model.
2. **LEAK-1 (high, methodology):** calibration fitted and reported on the same sample. Walk-forward + train/calibrate/holdout split (Stage 7).
3. **MIN-1 (high):** expectedMinutes = season minutes ÷ currentGW (app.js:561, 457). Ignores recent starts, injuries, postponements. Stage 4 rebuild.
4. **DEN-1 (medium):** per-match denominators use current GW, not actual club matches played. Postponements bias per-90s.
5. **SCOR-1 (medium):** linear approximations where FPL rules are stepped: goals-conceded −(xGA/2)·0.72 vs floor(GC/2); saves/3 linear vs floor(saves/3); DC sigmoid vs P(cross threshold). Stage 5 distributions (Poisson).
6. **SCOR-2 (medium):** bonus heuristic from BPS/90 double-counts events already scored (goals/CS feed BPS). Stage 5: historical bonus/start with shrinkage.
7. **ODDS-1 (medium):** devig incomplete (no multi-book consolidation standard), 0.45 goal-split exponent hard-coded, no market-staleness rejection, single market family.
8. **UST-1 (medium):** pre-season uses previous season's *closing* last-6 as if current; spec-compliant early-season prior needed. Refresh cadence wasteful.
9. **TRF-1 (medium, UI claim):** "top N moves can all be made free" shown without combined-plan validation. Remove in Stage 6.
10. **CACHE-1 (low):** no schemaVersion/season/modelVersion; kickoff_time/started/provisional not retained in slim().
11. **XSS-1 (closed Stage 3.5):** API/provider/user strings across the approved view inventory now
    render through text-node-first DOM builders. Ask `md()` remains a separate Stage 3.6 scope.
12. **BT-1 (low):** backtest joins on name|position (duplicate-name collisions); un-pinned dataset.
13. **FIX-1 (low):** blank-GW ease constants (0.55/1.0) and double bonus (+0.45) arbitrary/untested.

## 4. Keep / remove / replace / add
- KEEP: FPL API (foundation), vaastav (pinned), Odds API (throttled, hardened), localStorage persistence (versioned).
- KEEP-PENDING-ABLATION: Understat layer. If ablation shows no out-of-sample gain over FPL-strengths+prior, remove.
- REPLACE: public-relay transport for anything key-bearing (immediate), all relay transport at serverless migration.
- ADD (evaluate, not commit): ClubElo ratings (free CSV API, licensing-friendly) as candidate replacement for Understat team layer — enters the same ablation. FBref: deferred; scraping risk + no defined model component yet. Predicted-lineups: provider-neutral interface only (schema in §5); no scraping of subscription services. Transfermarkt injury history: deferred pending licensing check.
- DO NOT ADD: sentiment/socials/trends per spec §6.

## 5. Proposed internal data schema (normalised)
```js
// every external value arrives wrapped:
{ value, source, fetchedAt, confidence, isFallback, warnings: [] }
// providers implement:
{ providerName, fetchData(), validateResponse(), normaliseData(), getLastUpdated(), getHealthStatus() }
// team-strength record (per team, per venue):
{ teamId, venue:'H'|'A', atk, def, layers:{fpl,ustat?,odds?,elo?}, blendedAt, season }
// minutes record (Stage 4 target):
{ playerId, pStart, pAppear, p60, expMinIfStart, expMinIfBench, expMin, confidence, source, updatedAt }
// cache envelope:
{ schemaVersion, modelVersion, season, provider, fetchedAt, expiresAt, payload }
```

## 6. Provider & fallback architecture
Hierarchy per modelling task exactly as specified in the brief §7 (adopted verbatim). All provider calls behind modules in `src/providers/`; projection code consumes normalised records only; a `sourceHealth` registry drives a compact data-health strip in the UI (FPL: live · Understat: 3h old · Odds: unavailable → internal model · confidence: Medium). Browser→`/api/...` switch is a one-line base-URL change per provider at serverless migration.

## 7. Ablation-testing plan
Configurations: (1) FPL-only, (2) +Understat, (3) +Odds, (4) +both, (5) +ClubElo variants.
Protocol: walk-forward on pinned seasons; weights fitted on training season, validated on separate season, reported on untouched season. Metrics: MAE, RMSE, r, calibration, top-10/top-25 precision, captain top-pick, CS Brier, goal log-loss, transfer-gain vs rolling, by position/GW/blanks-doubles.
**Honest limitation:** free tier has no historical odds (10× credit cost, and coverage gaps), so configs (3)/(4) cannot be backtested historically. Odds ablation must run prospectively: log market-implied xG each GW of 2026-27 alongside model outputs, evaluate after ~10 GWs. Until then odds weight stays configurable, labelled unvalidated.

## 8. Legal / licensing decisions required from owner
- Understat: automated scraping is ToS-grey. Continue (typical community practice, low volume, cached) or drop? My recommendation: continue at reduced cadence pending ablation; drop if ablation is null.
- FPL API: unofficial but universally tolerated at this volume. Proceed.
- The Odds API: licensed, terms-clean. Proceed.
- vaastav dataset: public repo, community-standard; attribution in README. Proceed, pinned.
- ClubElo: public API intended for reuse. Proceed if adopted.
- FBref/Transfermarkt: NOT scraped until you approve and terms are checked.
