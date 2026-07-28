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
| RET-1 | `Retry-After` is not honoured | Fixed capped backoff may retry sooner than a provider requests | Serverless reconsideration | Open (accepted) |
| RET-2 | No transport-level per-provider circuit breaker | Pooled outages can issue more doomed requests than ideal | Future provider hardening only with separate approval | Open |
| HEALTH-1 | Provider Health is session-scoped | No multi-session incident history | No planned stage | Accepted |
| VAL-2 | Understat values are structurally but not range validated | Nonsense numeric values could pass structure checks | Stage 7 ablation | Open |
| VAL-3 | Archive CSV validates headers but not every row width | Bad rows are skipped rather than counted | Stage 7 | Open |
| MIN-1 | Expected minutes = season minutes ÷ current GW | Largest projection error source | Stage 4 | Open, quarantined golden |
| DEN-1 | Per-match denominators use GW number | Postponement bias | Stage 4 | Open, quarantined golden |
| SCOR-1 | Linear approximations of stepped FPL rules | Small systematic scoring biases | Stage 5 | Open, quarantined golden |
| SCOR-2 | Bonus uses BPS/90 heuristic | Bonus miscalibration | Stage 5 | Open, quarantined golden |
| FIX-1 | Blank/double ease constants are arbitrary | Chip-window ease approximate | Stage 5/7 | Open, quarantined golden |
| LEAK-1 | Calibration fitted and reported on same sample | Published r=0.80 is method-flattered | Stage 7 | Open |
| TRF-1 | Transfer UI does not validate combined plans | Potentially illegal/over-budget combinations implied | Stage 6 | Open |
| BT-1 | Historical dataset is unpinned | Backtests not strictly reproducible | Stage 7 | Open |
| ODDS-2 | No free historical odds | Odds/blend ablation must be prospective | Stage 7+ | Open |
| UST-1 | Pre-season Understat uses previous closing six matches | Early-season form may be mislabelled | Stage 5 | Open |
| DC-1 | Defensive-contribution history starts in 2025-26 | No multi-season validation | Permanent | Accepted |
| FRAME-1 | `frame-ancestors` is ineffective in meta CSP on GitHub Pages | Frame-buster is compensating control; real header unavailable | Serverless | Accepted-temporary |
| STYLE-1 | `style-src-attr 'unsafe-inline'` remains necessary | Style attributes are not hash-locked; scripts remain hash-only | Stage 9 class migration | Accepted-temporary |
| OPS-1 | Full repository tree was not committed | None | Owner action | **CLOSED 2026-07-26** |
| AI-1 | Ask works only inside Claude artifact preview | No hosted AI features | Serverless | Accepted |
