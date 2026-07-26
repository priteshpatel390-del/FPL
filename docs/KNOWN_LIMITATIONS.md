# KNOWN_LIMITATIONS.md
Purpose: single register of every current limitation. Audience: all sessions; check before promising anything.
Last updated: 2026-07-26. Related: AUDIT.md (origin of most ids), ROADMAP.md (planned stages).

| ID | Description | Reason | Current impact | Planned stage | Status |
|---|---|---|---|---|---|
| SEC-2 | Serverless deferred; odds key client-side (localStorage), visible to a determined page inspector | Owner decision D-08; only low-value secret exists | Capped-cost key exposure to link-holders | On hosted-AI trigger | Accepted-temporary |
| SEC-3 | Deployed build still contains Anthropic key field | Stage 3 (removal) designed, not yet implemented | Users could paste a key into an unhardened field | Stage 3 | Open |
| CSP-1 | No CSP in deployed build; design proposes hash-based policy with style-src-attr concession | Stage 3 pending | Standard XSS surface until landed | Stage 3 (concession removed Stage 9) | Open |
| XSS-1 | innerHTML interpolation of API/user strings throughout views | Pre-refactor pattern | Injection risk, worst via mini-league rival names + user league names | Stage 3 | Open |
| VAL-1 | No runtime schema validation of provider responses | Pre-refactor pattern | Schema drift fails silently or crashes | Stage 3 | Open |
| DUP-1 | Duplicate fixture rows would double-count projections/ticker/ease/chip detection | No dedupe; live feed has unique ids so exposure is malformed-input only | Latent | Stage 3 (proposed) | Open, pinned in tests |
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
| OPS-1 | Phone-only ops: full repo tree not yet committed (only index.html live); folder upload needs a computer | GitHub mobile limits | Canonical tree lives in stage zips until a desktop commit | Owner action | Open |
| AI-1 | Ask tab works only inside Claude's artifact preview (keyless) | D-08 | No hosted AI features | Serverless | Accepted |
