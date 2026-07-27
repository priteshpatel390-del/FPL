# KNOWN_LIMITATIONS.md
Purpose: single register of every current limitation. Audience: all sessions; check before promising anything.
Last updated: 2026-07-27. Related: AUDIT.md (origin of most ids), ROADMAP.md (planned stages).

| ID | Description | Reason | Current impact | Planned stage | Status |
|---|---|---|---|---|---|
| SEC-2 | Serverless deferred; odds key client-side (localStorage), visible to a determined page inspector | Owner decision D-08; only low-value secret exists | Capped-cost key exposure to link-holders | On hosted-AI trigger | Accepted-temporary |
| SEC-3 | Frontend Anthropic key field/persistence and keyed browser request path | Removed under D-08; legacy `claudeKey` is deleted from stored config on first run | None; hosted Ask now fails fast, Claude preview remains keyless | Stage 3 | **CLOSED 2026-07-27** (5 tests) |
| CSP-1 | No CSP in deployed build; design proposes hash-based policy with style-src-attr concession | Stage 3 pending | Standard XSS surface until landed | Stage 3 (concession removed Stage 9) | Open |
| XSS-1 | innerHTML interpolation of API/user strings throughout views | Pre-refactor pattern | Injection risk, worst via mini-league rival names + user league names | Stage 3 | Open |
| VAL-1 | No runtime schema validation of provider responses | Fixed: per-endpoint validators in `src/providers/validate.mjs` cover all ten external payloads plus the cached snapshot; fatal vs partial per endpoint | None | Stage 3 | **CLOSED 2026-07-27** (D-14; 33 tests in tests/schema.test.mjs + tests/schema-state.test.mjs) |
| DUP-1 | Duplicate fixture rows would double-count projections/ticker/ease/chip detection | Fixed: `normaliseFixtures` dedupes by provider id (composite fallback) in `hydrate()` before any consumer | None | Stage 3 | **CLOSED 2026-07-26** (D-13; 12 tests in tests/validation.test.mjs) |
| RET-1 | HTTP `Retry-After` is not honoured; a fixed capped backoff is used instead | Under the relay cascade the header describes the relay, not the FPL origin, and an arbitrary server-chosen delay conflicts with keeping a phone app responsive | A provider asking for a longer pause is retried sooner than requested | Revisit with serverless, where requests are direct | Open (accepted) |
| RET-2 | No transport-level per-provider circuit breaker: each call retries independently, so a pooled sweep can still retry once per item | D-16 now provides a durable seven-state signal, but suppressing later requests based on it is a separate transport-policy change and was not silently bundled into the display/state item | On a total outage a 20-rival sweep can still issue roughly twice the ideal number of doomed requests | Stage 3 remaining provider hardening | Open (health prerequisite delivered) |
| HEALTH-1 | Provider Health is session-scoped rather than persisted as an incident history | Persisting status independently of the underlying cache risks showing an old outage as current after app restart | The strip starts from the current load and cannot show multi-session reliability trends | No planned stage; reconsider only if operational evidence needs it | Accepted |
| VAL-2 | Understat validation checks structure (`title` + `history[]`) but not the numeric quality of xG/xGA values | Consumers already coerce via `num()`; a value-range contract needs evidence of what real drift looks like | Nonsense numbers would pass structural validation | Stage 7 (with the odds/Understat ablation) | Open |
| VAL-3 | Archive CSV validates the header contract only, not per-row column counts | Row-level guards exist inline in `computeBacktest`; a fuller row schema belongs with BT-1 dataset pinning | Malformed rows are skipped silently rather than counted | Stage 7 | Open |
| MIN-1 | Expected minutes = season minutes ÷ current GW | Crude v2 model | Largest single projection error source | Stage 4 | Open, quarantined golden |
| DEN-1 | Per-match denominators use GW number, not club matches played | Same | Postponement bias in per-90s | Stage 4 | Open, quarantined golden |
| SCOR-1 | Linear approximations of stepped FPL rules (GC/2, saves/3, DC threshold) | v2 simplification | Small systematic biases | Stage 5 | Open, quarantined golden |
| SCOR-2 | Bonus from BPS/90 heuristic double-counts scored events | v2 simplification | Bonus miscalibration for event-heavy players | Stage 5 | Open, quarantined golden |
| FIX-1 | Blank/double ease constants (0.55 / +0.45) arbitrary | Never tested | Chip-window ease scores approximate | Stage 5/7 | Open, quarantined golden |
| LEAK-1 | Calibration fitted and reported on same sample | v2 backtest method | Published r=0.80 is flattered; treat as upper bound | Stage 7 | Open (D-11 guards claims) |
| TRF-1 | UI claims several ranked moves "can all be made free" without combined-plan validation | v2 planner is single-swap | Potentially illegal/over-budget combos implied | Stage 6 | Open |
| BT-1 | Historical dataset un-pinned (master branch) | Sandbox cannot resolve SHA (robots) | Backtests not strictly reproducible | Stage 7 (or owner supplies SHA) | Open |
| ODDS-2 | No free historical odds → odds/blend ablation must be prospective | Provider pricing | 65% market weight unvalidated | Stage 7 logging → later evaluation | Open (D-09) |
| UST-1 | Pre-season Understat fallback treats last season's closing 6 as current form | v2 shortcut | Early-season team strengths mislabelled | Stage 5 blending config | Open |
| DC-1 | Defensive-contribution history exists only from 2025-26 | Rule introduced 2025-26 | DC scoring can't get multi-season validation | Permanent; label at Stage 7 | Accepted |
| FRAME-1 | frame-ancestors ineffective on static hosting | Meta-CSP ignores it; Pages sets no headers | Clickjacking mitigated only by frame-buster (Stage 3) | Serverless | Accepted-temporary |
| OPS-1 | Full repository tree was not committed | Resolved by the 2026-07-26 repository import | None; repository is now canonical, while one-file deploy remains | Owner action | **CLOSED 2026-07-26** |
| AI-1 | Ask tab works only inside Claude's artifact preview (keyless) | D-08 | No hosted AI features | Serverless | Accepted |
