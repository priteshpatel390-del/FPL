# KNOWN_LIMITATIONS.md
Purpose: single register of every current limitation. Audience: all sessions.
Last updated: 2026-07-29. Related: AUDIT.md, ROADMAP.md, SECURITY.md.

| ID | Description | Current impact | Planned stage | Status |
|---|---|---|---|---|
| SEC-2 | Odds key remains client-side in local storage and is visible to a determined page inspector | Capped-cost key exposure to browser owner/extensions/compromised same-origin code; mitigated by masked field, direct-only transport, one-action forgetting and diagnostic scrubbing | Serverless trigger under D-08 | Accepted-temporary |
| SEC-3 | Frontend Anthropic key field/persistence and keyed browser request path | None; legacy value is deleted and hosted Ask fails fast | Stage 3 | **CLOSED 2026-07-27** |
| CSP-1 | No CSP in deployed build | Fixed by deterministic hash-based meta CSP with build-time and independent test verification | Stage 3 | **CLOSED 2026-07-28** |
| XSS-1 | Dynamic API/user strings were interpolated into HTML | Fixed by DOM builders; AI output fixed separately by restricted Markdown AST | Stage 3.5/3.6 | **CLOSED 2026-07-28** |
| VAL-1 | No runtime schema validation | Fixed by per-endpoint fatal/partial validation | Stage 3 | **CLOSED 2026-07-27** |
| DUP-1 | Duplicate fixtures could double-count projections | Fixed by provider-boundary identity/deduplication | Stage 3 | **CLOSED 2026-07-26** |
| BUILD-1 | Custom bundler could leave parts of multi-line module declarations in production output | Complete static import/export declarations are stripped and surviving module syntax is rejected | Stage 5 review | **CLOSED 2026-07-28** |
| RET-1 | `Retry-After` is not honoured | Fixed capped backoff may retry sooner than a provider requests | Serverless reconsideration | Open (accepted) |
| RET-2 | No transport-level per-provider circuit breaker | Pooled outages can issue more doomed requests than ideal | Future provider hardening only with separate approval | Open |
| HEALTH-1 | Provider Health is session-scoped | No multi-session incident history; compact global status and full More detail reflect only the current session | No planned stage | Accepted |
| VAL-2 | Understat values are structurally but not range validated | Nonsense numeric values could pass structure checks | Future provider hardening | Open |
| VAL-3 | Archive CSV validates headers but not every row width | Stage 7 replay rejects and counts malformed required values instead of manufacturing defaults | Stage 7 | **CLOSED and verified 2026-07-28** |
| MIN-1 | Expected minutes = season minutes ÷ current GW | Replaced by tiered current-season histories with aggregate/prior fallback | Stage 4 | **CLOSED 2026-07-28** |
| DEN-1 | Per-match denominators use GW number | Replaced by completed team fixtures and detailed player opportunities | Stage 4 | **CLOSED 2026-07-28** |
| SCOR-1 | Linear approximations of stepped FPL rules | Replaced by deterministic expected-value distributions for saves, conceded goals and defensive contributions | Stage 5 | **CLOSED and verified 2026-07-28** |
| SCOR-2 | Bonus uses BPS/90 heuristic | Replaced by awarded bonus per estimated appearance with positional shrinkage | Stage 5 | **CLOSED and verified 2026-07-28** |
| FIX-1 | Blank/double ease constants are arbitrary | Removed; genuine blanks score zero and doubles add both fixtures | Stage 5 | **CLOSED and verified 2026-07-28** |
| SCOR-3 | Stage 5 Poisson and shrinkage constants are judgement-based | Rule implementation is explicit but not validated as an accuracy optimum | Prospective validation | Open |
| SCOR-4 | Bonus is empirical rather than a full match-relative BPS simulation | Stage 8 samples bounded bonus outcomes but cannot model match-specific BPS rank or ties | Future only with separate approval | Accepted-temporary |
| SCOR-5 | Clean-sheet retention after a player leaves was simplified | Stage 8 uncertainty samples discrete minutes and clean-sheet outcomes, but does not yet model a full match goal-timing hazard | Stage 8 | Partially addressed; limitation remains |
| LEAK-1 | Calibration fitted and reported on the same sample | Replaced by chronological train/calibration/holdout folds | Stage 7 | **CLOSED and verified 2026-07-28** |
| TRF-1 | Transfer UI did not validate combined plans | Stage 6 exact optimiser validates complete squad legality, budget and club quotas | Stage 6 | **CLOSED and verified 2026-07-28** |
| BT-1 | Historical dataset was unpinned | Stage 7 uses an immutable vaastav commit and runtime SHA-256 | Stage 7 | **CLOSED and verified 2026-07-28** |
| BT-2 | Historical pre-deadline snapshots do not exist for several live inputs | Stage 7 is an honest scoring diagnostic, not full validation of every live production input | Prospective logging from 2026/27 | Open (accepted) |
| SIM-1 | Stage 8 uncertainty is conditional on the existing model | Percentiles do not include every real-world source of uncertainty or prove calibrated coverage | Prospective 2026/27 validation | Open (accepted) |
| SIM-2 | Player attacking samples are not allocated from a complete simulated team score | Player outcomes can be marginally coherent without strict match-level event conservation | Future only with separate approval | Open (accepted) |
| SIM-3 | Detailed simulation is disabled in pre-season | No precise percentiles or haul probabilities until live event-level inputs exist | Live GW1 | Accepted-honest |
| SIM-4 | No full match-relative BPS, tactical substitution or detailed game-state engine | Some correlations and tail outcomes remain approximate | Future only with separate approval | Open (accepted) |
| ODDS-2 | No free historical odds | Odds/blend ablation must be prospective | Stage 7+ | Open |
| UST-1 | Pre-season Understat uses previous closing six matches | Early-season form may be mislabelled | Prospective validation | Open |
| DC-1 | Defensive-contribution history starts in 2025/26 | No multi-season validation | Permanent | Accepted |
| FRAME-1 | `frame-ancestors` is ineffective in meta CSP on GitHub Pages | Frame-buster is compensating control | Serverless | Accepted-temporary |
| STYLE-1 | `style-src-attr 'unsafe-inline'` remained necessary | Replaced fixed/dynamic styles with classes, progress and SVG attributes; source/build/deployable guards reject style attributes and the CSP concession is removed | Stage 9.6 | **CLOSED and verified 2026-07-29** |
| UI-1 | No persistent browser-level screenshot-regression suite | Stage 9.6 completed representative mobile/desktop browser review with no console errors, but future visual changes still require human device review | Future tooling only with separate approval | Open (accepted) |
| PREVIEW-1 | Decision previews are intentionally session-only | Transfer/captain previews disappear on refresh and are not submitted to FPL; this prevents accidental persistence or account changes | By design | Accepted |
| PREVIEW-2 | Transfer preview pitch is next-Gameweek only while optimiser gain can span several Gameweeks | The banner must be read alongside the pitch to distinguish next-GW XI score from multi-GW net gain | Stage 9.4 | Accepted-labelled |
| EVID-1 | Browser timing evidence is not externally notarised | Same-origin HTTP `Date` plus clock-skew checks support leakage review but cannot prove capture time to an independent third party | Future serverless only with separate approval | Open (accepted) |
| EVID-2 | Local evidence can be cleared and JSON exports are unencrypted | The owner must export and retain files safely; bounded compressed local copies are recovery only | Stage 10.4 operating workflow | Open (accepted) |
| EVID-3 | Physical iPhone capture/export/import acceptance | Owner accepted the silent loader and startup behaviour; local-preview chrome was distinguished from app UI | Stage 10.1 review | **CLOSED 2026-07-29** |
| EVID-4 | Prospective sample size begins at zero | No validation or calibration claim is possible until enough live Gameweeks and observations are collected | Stage 10.2–10.5 | Open (expected) |
| OUTCOME-1 | Static GitHub Pages cannot collect while the app is fully closed or suspended | Missed Gameweeks are collected when Teamsheet next opens; guaranteed closed-app timing needs a separately approved backend | Future serverless only with separate approval | Open (accepted) |
| OUTCOME-2 | Official FPL live and manager endpoints are undocumented | Schema drift can delay collection; strict validators quarantine ambiguity rather than manufacturing facts | Stage 10.2 operations | Open (accepted) |
| OUTCOME-3 | Manager outcome may be unavailable while global player/fixture facts are complete | Squad, captain and bench coverage can be lower than player coverage without blocking global metrics | Stage 10.3 reporting | Open (accepted) |
| METRIC-1 | Prospective metric samples begin at zero | Early values are volatile and must remain raw-only or descriptive under the approved sample warnings | Stage 10.3+ operations | Open (expected) |
| METRIC-2 | Blank Gameweek zeroes can flatter all-player metrics | All-player results may look better because many structurally blank rows have easy zero outcomes; schedule-aligned and fixture-class segments must remain visible | Stage 10.3 reporting | Accepted-labelled |
| METRIC-3 | Official starts and Double Gameweek per-fixture minutes may be incomplete | Start Brier and fixture-minutes coverage can be lower than player-points coverage; ambiguous rows fail closed rather than being inferred | Stage 10.3 reporting | Open (accepted) |
| METRIC-4 | Actual manager transfer identities are not stored | Stage 10.3 can evaluate frozen optimiser plans but cannot calculate realised gain for the manager's actual transfers | Future collection only with separate approval | Open (accepted) |
| METRIC-5 | Provider-state comparisons are observational and clustered | Hundreds of player rows can share one Gameweek/provider event, so association cannot establish causal provider value | Future formal inference only with separate approval | Open (accepted) |
| METRIC-6 | The legal-XI oracle uses realised outcomes | It is a descriptive hindsight upper bound from the same frozen squad, not a recommendation available before the deadline | By design | Accepted-labelled |
| OPS-1 | Full repository tree was not committed | None | Owner action | **CLOSED 2026-07-26** |
| AI-1 | Ask works only inside Claude artifact preview | No hosted AI features | Serverless | Accepted |

## Stage 10.1 automatic refresh limitations
- “Latest” means the latest data that passed approved validation. It does not guarantee every optional provider is live.
- GitHub Pages and iPhone Safari cannot reliably wake a fully closed or suspended app. Automatic work begins on startup or foreground return; guaranteed closed-app scheduling requires a later server-side design.
- Foreground verification temporarily makes decision controls inert to prevent mixed-state use. Existing verified content remains visible.
- Recovery imports are deliberately non-official. They restore owner-controlled records but cannot establish authorship or external timestamp notarisation.

## Stage 10.2 outcome limitations
- Outcome collection starts only after the verified app becomes usable and cannot wake a fully closed iPhone app.
- A record is not final merely because fixtures say `finished`; official event `data_checked` and complete validated player data are required.
- Corrections are monitored daily for fourteen days and by later app openings, but there is no guaranteed server-side polling.
- Bounded local storage is recovery rather than a permanent archive. Complete exports are unencrypted.
- Infrastructure completion is not evidence that the model is accurate or calibrated.

## Stage 10.3 metric limitations
- Player and probability results begin with very small, clustered samples. The interface shows raw-only, descriptive or potentially-stable wording but never a formal significance claim.
- All-player results must be read beside schedule-aligned and blank/single/double segments because structural blank zeroes can flatter error metrics.
- Start facts are used only where Official FPL supplies them. Double Gameweek fixture minutes are included only where they can be allocated and reconciled safely.
- Missing manager outcomes reduce squad/captain/bench coverage without blocking global player evaluation.
- Actual manager transfer identities are unavailable; only frozen optimiser plans can be evaluated against their frozen zero-transfer baseline.
- Hindsight oracle and alternative comparisons are descriptive only and must not be presented as retrospective recommendations.
- Provider-state comparisons are observational and cannot prove causal value or uptime quality.
- Confidence intervals, clustered resampling, multiple-comparison control and statistical significance remain separately scoped future work.
- Metric records are bounded browser recovery, not a permanent database or externally authenticated archive.
- Stage 10.3 implementation and 397 passing tests prove contract integrity, not prediction accuracy or probability calibration.
