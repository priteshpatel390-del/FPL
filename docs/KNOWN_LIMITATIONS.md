# KNOWN_LIMITATIONS.md
Purpose: single register of every current limitation. Audience: all sessions.
Last updated: 2026-07-28. Related: AUDIT.md, ROADMAP.md, SECURITY.md.

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
| HEALTH-1 | Provider Health is session-scoped | No multi-session incident history | No planned stage | Accepted |
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
| STYLE-1 | `style-src-attr 'unsafe-inline'` remains necessary | Style attributes are not hash-locked | Stage 9 class migration | Accepted-temporary |
| UI-1 | No browser-level screenshot/visual-regression suite | Automated tests verify DOM structure, accessibility helpers and deterministic output, but final responsive appearance still requires human device review | Stage 9.6 | Open |
| OPS-1 | Full repository tree was not committed | None | Owner action | **CLOSED 2026-07-26** |
| AI-1 | Ask works only inside Claude artifact preview | No hosted AI features | Serverless | Accepted |
