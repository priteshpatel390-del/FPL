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
| BUILD-1 | Custom bundler could leave parts of multi-line module declarations in production output | Complete static import/export declarations are stripped, unterminated declarations fail and any surviving module syntax is rejected; fixture-based regressions cover supported and unsupported forms | Stage 5 review | **CLOSED 2026-07-28** |
| RET-1 | `Retry-After` is not honoured | Fixed capped backoff may retry sooner than a provider requests | Serverless reconsideration | Open (accepted) |
| RET-2 | No transport-level per-provider circuit breaker | Pooled outages can issue more doomed requests than ideal | Future provider hardening only with separate approval | Open |
| HEALTH-1 | Provider Health is session-scoped | No multi-session incident history | No planned stage | Accepted |
| VAL-2 | Understat values are structurally but not range validated | Nonsense numeric values could pass structure checks | Stage 7 ablation | Open |
| VAL-3 | Archive CSV validates headers but not every row width | Bad rows are skipped rather than counted | Stage 7 | Open |
| MIN-1 | Expected minutes = season minutes ÷ current GW | Replaced by tiered current-season histories with aggregate/prior fallback and explicit pStart/pAppear/p60/expMin/confidence outputs | Stage 4 | **CLOSED 2026-07-28** |
| DEN-1 | Per-match denominators use GW number | Replaced by completed team fixtures and detailed player opportunities | Stage 4 | **CLOSED 2026-07-28** |
| SCOR-1 | Linear approximations of stepped FPL rules | Replaced in PR #9 by deterministic expected-value distributions for saves and goals conceded plus threshold probability for defensive contributions | Stage 5 | **CLOSED and verified 2026-07-28** |
| SCOR-2 | Bonus uses BPS/90 heuristic | Replaced in PR #9 by awarded bonus per estimated appearance with positional shrinkage; aggregate appearances reuse the Stage 4 completed-match model | Stage 5 | **CLOSED and verified 2026-07-28** |
| FIX-1 | Blank/double ease constants are arbitrary | Removed in PR #9; genuine blank coverage asserts zero and doubles add both fixture values over the requested GW denominator | Stage 5 | **CLOSED and verified 2026-07-28** |
| SCOR-3 | Stage 5 Poisson and shrinkage constants are judgement-based | Rule implementation is explicit but not validated as an accuracy optimum | Stage 7 | Open |
| SCOR-4 | Bonus is empirical rather than a full match-relative BPS simulation | Cannot model match-specific bonus rank or tie outcomes prospectively | Stage 8+ only with separate approval | Accepted-temporary |
| SCOR-5 | Clean-sheet retention after a player leaves is simplified as full-match CS probability × p60 | Understates some early-substitution clean sheets | Stage 8 | Open |
| LEAK-1 | Calibration fitted and reported on same sample | Published r=0.80 is method-flattered | Stage 7 | Open |
| TRF-1 | Transfer UI does not validate combined plans | Potentially illegal or over-budget combinations implied | Stage 6 | Open |
| BT-1 | Historical dataset is unpinned | Backtests not strictly reproducible | Stage 7 | Open |
| ODDS-2 | No free historical odds | Odds/blend ablation must be prospective | Stage 7+ | Open |
| UST-1 | Pre-season Understat uses previous closing six matches | Early-season form may be mislabelled | Stage 7 ablation | Open |
| DC-1 | Defensive-contribution history starts in 2025/26 | No multi-season validation | Permanent | Accepted |
| FRAME-1 | `frame-ancestors` is ineffective in meta CSP on GitHub Pages | Frame-buster is compensating control; real header unavailable | Serverless | Accepted-temporary |
| STYLE-1 | `style-src-attr 'unsafe-inline'` remains necessary | Style attributes are not hash-locked; scripts remain hash-only | Stage 9 class migration | Accepted-temporary |
| OPS-1 | Full repository tree was not committed | None | Owner action | **CLOSED 2026-07-26** |
| AI-1 | Ask works only inside Claude artifact preview | No hosted AI features | Serverless | Accepted |

## Stage 6 optimiser
- Exact search is synchronous and capped at three transfers; progress/cancellation and worker execution are deferred.
- Manual-squad selling values depend on recorded purchase price; public picks use FPL `selling_price`.
- The objective deliberately excludes captaincy, autosubs, bench percentage and uncertainty weighting.
