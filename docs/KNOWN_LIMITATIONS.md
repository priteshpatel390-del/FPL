# KNOWN_LIMITATIONS.md

<!-- DATA-S1B-PREFLIGHT-CURRENT-2026-08-23 -->
## Current DATA-S1B limitation boundary

The DATA-S1B mutation-free live preflight is complete and **PASS**, and its final phase-gated procedure is the [DATA-S1B Final Preflight and Deployment Runbook](DATA-S1B-FINAL-PREFLIGHT-AND-DEPLOYMENT-RUNBOOK.md). DATA-S1 remains **NOT LIVE DEPLOYED**: this checkpoint created no DATA-S1 Worker, production or validation D1, migration, Access configuration, service token, DNS/Custom Domain, route or production binding. Owner evidence records **Workers Free — Active** and current/projected billable usage **$0.00**. Workers Free/D1 Free limits are accepted constraints; any need to exceed them must stop rather than upgrade the plan.

The reviewed PR #147 candidate baseline is **986 tests passed, 0 failed, 0 skipped, 0 cancelled**, deterministic build/provenance gates and exact-head Verify Teamsheet. Merge authorizes **no Cloudflare mutation**. After merge, latest GitHub `main` and exact-merge Verify Teamsheet must be re-read before the owner may consider the separately gated **Phase 2 disposable D1 validation**. DATA-S2 remains blocked until DATA-S1B live deployment/acceptance fully closes. The delivered GW1 readiness checkpoint remains PR #121 as historical application evidence. No application, model, provider, fixture, captaincy, squad, transfer, simulation, rank or Mini-League behaviour changed.

<!-- GW1-P2C5-CURRENT-2026-08-22 -->
## Post-C5 evidence boundary

The synthetic production infrastructure path is accepted: physical iPhone Safari, normal scheduling, unchanged Worker validation, exact R2/D1 custody and browser terminal acknowledgement passed for the fixed `2099-00`/GW38 fixture. This removes the infrastructure-path uncertainty only. It does not prove natural capture, genuine evidence completeness/custody, deadline timing or Official eligibility. Natural GW2 observation remains required. The temporary acceptance mechanism was closed unmerged and removed from production by restoring authoritative `main`; the accepted synthetic cloud record remains intentionally untouched. See [GW1-P2C5 closeout](GW1-P2C5-STAGE10-PRODUCTION-PATH-ACCEPTANCE-CLOSEOUT.md).

<!-- GW1-P2C3B-CURRENT-2026-08-22 -->
## Current same-site transport limitation boundary

GW1-P2C3B passes browser transport only: real iPhone Safari with Prevent Cross-Site Tracking ON directly observed same-site OPTIONS 204 and a matching invalid `{}` POST returning readable 422 `envelope_schema`. Because no genuine Stage 10 record was sent, genuine custody, valid archival, D1 receipt/manifest creation, R2 object creation, persistence, idempotency and duplicate handling remain unproven. Literal physical ACAO, ACAC and `Vary` response values were not directly captured. Legacy rollback paths remain intentionally retained.


<!-- GW1-P2C2-CURRENT-2026-08-21 -->
## GW1-P2C2 limitations — 21 August 2026

The sibling-domain repository candidate does **not** prove that the live custom-domain transport works on iPhone Safari. The only controlled physical result so far is the superseded Option A topology: credentialled OPTIONS reached the Worker and returned 204 after PR #137, while POST never reached the Worker. No conclusion about D1/R2 ingestion can be drawn from that missing POST, and no single remaining browser/Access cause has been proven.

`app.fpltsheet.co.uk` and `archive.fpltsheet.co.uk` are repository targets until separately deployed and verified. The existing GitHub Pages origin is intentionally retained in the Official FPL gateway allowlist as a migration rollback path; removing it requires later evidence and approval. Cloud custody remains non-blocking and local evidence/recovery/export remains the operational fallback.


## Current GW1 readiness limitation boundary

GW1 readiness remediation is complete through PR #121. The readiness audit found **zero blockers**; its two should-fix items are closed and neither remains an open limitation. Three narrow limitations belong to the pre-GW1 Transfers guard itself and are recorded as `GW1R-1` to `GW1R-3` in the register below: the window depends on the device clock, it is re-evaluated on render rather than on a timer, and its after-deadline transition has automated evidence only because no approved non-production deadline-override mechanism exists.

Nothing about GW1 operation waits on cloud evidence custody. Local Stage 10 capture, recovery and owner-controlled export are complete, merged and remain the pre-deadline evidence path; the GW1-P2 limitations below are a separate stream.

## Current GW1-P2 evidence boundary

GW1-P1 is merged and provides a deployed/tested backend evidence destination: separate authenticated Worker, private R2 and minimal D1 manifest/receipt state. GW1-P2 adds the browser delivery client and durable outbox on top of it.

**Automatic in-app cloud custody is implemented but not yet accepted.** Its transport depends on Cloudflare Access sending a third-party cookie from `github.io` to `workers.dev`, which iPhone Safari blocks under normal privacy settings. Whether the approved Option A transport works on the owner's device is **unknown until the owner physically tests it with Prevent Cross-Site Tracking ON**; no device claim is made, and disabling that setting must never become a product requirement. Two further limitations are open. The pinned pending-record limit is held at four as a deliberately conservative bounded-outbox policy for the first acceptance cycle; the measured record and supporting-store sizes are valid evidence, but **the usable storage ceiling on the owner's current iPhone is not evidenced**, so four is not claimed to be proven safe and commonly quoted per-origin figures are not a measurement of that device. Non-destructive device evidence — current Teamsheet usage and `navigator.storage.estimate()` where supported — is read from the Settings → Evidence panel before final readiness, and no destructive fill-until-quota test may be run against real evidence. Separately, iOS purges script-writable storage for sites without recent interaction, so a pending record can be lost before it is ever archived (surfaced as `expired_local`; GW1-P1 orphan reconciliation cannot recover it because nothing reached R2).

**Historical pre-C5 limitation — closed by the later C5 record.** Cloudflare Access CORS/preflight configuration was no longer an open gate: the owner enabled and saved “Bypass OPTIONS requests to origin” with no Access-layer allowed-origin response, leaving the Worker as sole owner of exact-origin CORS. Top-level Safari Access sign-in and protected `GET /v1/health` also succeeded. The real unresolved limitation is narrower and unchanged by that preparation: **the credentialled cross-site background upload from GitHub Pages to the evidence Worker has not been accepted on a physical iPhone under normal Safari privacy settings**, and it cannot be until a genuine Stage 10 record exists from 20 August 2026 at 18:30 BST. Live dashboard state also remains outside repository evidence, so a later redeploy or dashboard change could alter it without any repository change.

The backend remains a one-way side effect and cannot be treated as recommendation availability. Permanent Understat/Odds-derived archival remains fail-closed pending approved retention rights. Merged GW1-P1 also explicitly disables Cloudflare Preview URLs in repository configuration, and owner-supplied live Cloudflare **Domains** dashboard evidence on 11 August 2026 showed production Access-`Restricted` with the wildcard Preview hostname disabled. That closes the preview/version security item. The residual limitation is one of provenance rather than an open gap: it is owner-supplied dashboard evidence at a single moment, not independent assistant testing or continuous monitoring, and a future redeploy could change live route state without any repository change.

## Historical — 11 August 2026 A3 documentation-closeout evidence boundary

The A3 engineering baseline entering documentation/architecture closeout is GitHub `main` `1060e60d3affadabdf97924c7ece85cc62d8e360`, merge of A3-SC-1 PR #116 from reviewed head `097fabb6065afc4c322238985eb7f237a503a7c3`. The reviewed tree passed **868 tests, 868 passed, 0 failed, 0 skipped, 0 cancelled** in Verify Teamsheet run #193 / `31469449540`. Permanent post-merge Verify Teamsheet run #194 / `31470879289` passed the repository gate on that exact merge commit, and GitHub Pages run #120 / `31470878300` succeeded for the same commit.

A3-SC-1 is complete. It removed two proven-unreachable Mini-League helpers and stale test-side consumers with no intended behaviour change. No physical iPhone testing was performed or claimed for PR #116. At that checkpoint, its remaining brittle `selectMiniLeague` exact-source-string assertion was test-hardening debt, not a demonstrated product defect. PR #124 subsequently hardened that test without changing production Mini-League behaviour.

Route-Aware Rendering and Performance M1 is complete through PR #115. It is measurement instrumentation only and demonstrated real avoidable inactive-route work **without** demonstrating material user-visible lag. That absence of evidence remains a limitation: no performance claim, in either direction, is supported for a physical iPhone. Route-aware optimisation is not approved.

A3 engineering remediation is complete through PR #116. This documentation/architecture reconciliation is the final A3 closeout layer; no A3-specific engineering or documentation task follows it. Separately gated live-season evidence, D1 implementation, Understat/Odds repair, ChatGPT migration and Cloudflare/agent expansion are not A3 engineering defects or unfinished A3 closeout work.

## Historical — 10 August 2026 evidence boundary after A3 State-Ownership Cleanup

A3 State-Ownership Cleanup is complete and merged through PR #112 at `main` `691d9f929284d51c233b61d099c34cafe1030db6`, from reviewed head `620daf14d1c354668b16df74daf05e29d8a1eb25`. Permanent post-merge Verify Teamsheet run #167 / `31430700053` passed **864 tests, 864 passed, 0 failed, 0 skipped, 0 cancelled**, committed deployment provenance, production build, deterministic rebuild, root/deployable equality, exact build identity and production-output preservation. GitHub Pages run #117 / `31430697347` also succeeded on that exact merge commit.

The checkpoint closes the two medium ownership risks it targeted: the legitimate cross-module `S` surface is now explicitly inventoried, and the legacy Mini-League compatibility alias can no longer become a reverse authority over canonical `S.miniLeagues` preferences. It is not a general state-management framework. No physical iPhone testing was performed or claimed for PR #112.

One deliberate ownership limitation remains and is recorded as `STATE-1` below: the zero-dependency source regression guards direct/static `S` property access and the explicit refresh-owned subset, but it is not a general JavaScript data-flow proof for arbitrary computed property access. Route-Aware Rendering and Performance was the next substantive checkpoint at that time; its M1 measurement stage has since merged and optimisation remains unapproved, as recorded above.

## Historical checkpoint — 10 August 2026 A3 error-boundary separation (EB-1)

PR #108 is merged at `main` `ba5daa2000345ddde3d8e6f6d381d44603e7cd29`. The two confirmed failure-ownership defects are addressed: a recovery-render failure after a genuine Official FPL collection failure is no longer silently swallowed, and an unexpected internal exception escaping Understat/Odds/minute-history computation is no longer converted into fabricated provider degradation. Genuine provider transport/validation evidence continues to own Provider Health. No provider endpoint, validation rule, retry cadence, weighting or model calculation changed.

The merged tree contains **856 tests, 856 passed, 0 failed, 0 skipped, 0 cancelled**. Permanent Verify Teamsheet run #154 / `31410817472` passed every stage on exact merge commit `ba5daa20…`.

Physical iPhone Safari acceptance passed the executable EB-1 paths: normal online startup, manual online refresh, in-app offline refresh retaining saved verified data, and return-online recovery. The clean no-core private-tab offline-first path was not physically executable because Safari could not load the uncached static GitHub Pages shell while already offline; automated coverage remains authoritative for that application state. The acceptance session used an incomplete manual squad, so recommendation-survival was not independently observed on device. See ERR-1 to ERR-4 below and [A3 error-boundary separation](A3-ERROR-BOUNDARY-SEPARATION.md).

## 10 August 2026 — PERSIST-4 is closed

`fpl:calib` compatibility and resilience is merged through PR #107 at `main` `d112c673310149a4463def1758242460450600dc`. Existing unverified `fpl:calib` bytes are preserved but are not restored into `S.calib`, so standard uncalibrated projections remain active. No safe legacy migration is claimed, no production calibration generator/methodology was added and no accuracy improvement is claimed. Permanent Verify Teamsheet run #127 / `31396393124` passed every stage on the merge commit, on an 842-test baseline. PERSIST-4 is therefore closed.

## 10 August 2026 — PR #103 physical acceptance closeout

The final Small Mobile UI Consistency + Loading Viewport Fix application source is `646eee13960c343fbe07e3a76496717fd9837c0e`, with generated-only child `81cc9130ac2c7b8206f3bd5f6a2cf85bb5ba0777`. The final candidate retains every prior test and passes **803 tests, 0 failed**, deterministic byte-identical builds, root/deployable equality, exact build identity and reachable generated provenance. Permanent Verify Teamsheet run #90 / `31356255017` passed on the exact generated head.

Physical iPhone Safari acceptance is complete: the startup canvas reaches Safari chrome without a light strip; Team, Transfers, Fixtures, Leagues and Settings use the accepted shared header hierarchy; the refined editable/selectable controls are visually proportionate while retaining the no-focus-zoom behaviour; and the Leagues primary box now aligns vertically with the other primary screens. Pritesh explicitly approved PR #103 for merge on 10 August 2026.

No projection, expected-minutes, scoring, fixture, captaincy, squad, transfer, rank, Mini-League/rival, provider, data-source, Atomic Foreground Refresh, navigation, Team-renderer or Player Detail behaviour changed. At documentation closeout, GitHub `main` remained `d5f2572ee4d95c3c242ecbc97ee46802a6f0273d`; the eventual merge commit must be read from latest `main` rather than inferred from this pre-merge documentation commit.

## 10 August 2026 — current UI limitation state

The PR #103 startup-canvas, primary-header, form-control visual/no-zoom and Leagues vertical-alignment findings are physically accepted and no longer open UI defects. The separate post-Gameweek populated Leagues evidence gate remains deferred until Official FPL publishes the required live facts.

## D1/GW1 persistence limitations

The Cloudflare evidence backend exists under merged GW1-P1: an authenticated evidence Worker, private R2, minimal D1 manifest/receipt schema, canonical validation/idempotency and R2-orphan reconciliation are implemented and have recorded live functional acceptance. D1/R2 commits are still cross-product recoverable rather than atomic, and cost/capacity estimates still use synthetic evidence. Provider archival rights remain unconfirmed and Understat/Odds permanent retention remains fail-closed.

Automatic Teamsheet custody is **not an accepted behaviour**. GW1-P2 implements the persistent outbox/upload integration, but it is unmerged and acceptance-incomplete, so on deployed `main` genuine Stage 10 captures continue to have the existing local/manual semantics in normal app use. The explicit `preview_urls:false` hardening received its live post-deployment route confirmation from owner-supplied dashboard evidence on 11 August 2026, closing the GW1-P1 security item. See [Data Architecture D1](DATA-ARCHITECTURE-D1.md), [GW1-P1 Cloudflare Evidence Foundation](GW1-P1-CLOUDFLARE-EVIDENCE-FOUNDATION.md) and [GW1-P2 Browser evidence delivery](GW1-P2-BROWSER-EVIDENCE-DELIVERY.md).

Purpose: register of current, accepted and deliberately deferred limitations, with closed rows retained for traceability. Audience: all sessions. Last reconciled: 12 August 2026.

Historical GW1-P2C2 evidence boundary: that repository baseline was **971/971 tests** with the full deterministic/provenance/build-identity gates; merged `main` separately holds the then-current 907/907 until an approved merge. GW1 readiness remediation is complete through PR #121, whose guarded pre-deadline Transfers screen Pritesh physically accepted on iPhone Safari at head `f720230…`; its after-deadline transition remains automated-only evidence. GW1-P1 backend functional acceptance is recorded and PR #118 is merged at `58b834a…`, with its exact-head verification and preview-route live confirmation both satisfied. GW1-P2 remains an unmerged candidate on PR #119; its decisive physical iPhone Safari transport acceptance is outstanding and is not a GW1 blocker. A3 engineering remediation is complete through PR #116 at baseline `1060e60d3affadabdf97924c7ece85cc62d8e360`. The reviewed PR #116 tree passed 868/868; permanent post-merge Verify Teamsheet run #194 passed the repository gate and Pages run #120 succeeded on that exact merge commit. PR #116, Route-Aware M1/PR #115 and State-Ownership Cleanup/PR #112 have no physical device evidence and none is claimed. A3 Error-Boundary Separation's executable iPhone Safari paths were physically accepted; its clean uncached offline-shell path remains automated-only because static Pages cannot load in a new offline context. A3 cache and persistence resilience also remains physically untested by explicit owner waiver. Leagues post-Gameweek evidence remains deferred.

Related: [Project Context](PROJECT_CONTEXT.md), [Roadmap](ROADMAP.md), [Security](SECURITY.md), [GW1-P1 Cloudflare Evidence Foundation](GW1-P1-CLOUDFLARE-EVIDENCE-FOUNDATION.md), [Leagues pre-season acceptance](LEAGUES-PRESEASON-ACCEPTANCE.md), [External Intelligence Foundation](EXTERNAL-INTELLIGENCE-FOUNDATION.md), [Historical Records](HISTORICAL_RECORDS.md).

Several open rows below — including `ODDS-2`, `UST-1`, `BT-2`, `SCOR-3`, `SIM-1`, `EVID-4` and `METRIC-1` — are evidence gaps that only prospective Gameweeks can close. [External Intelligence Foundation](EXTERNAL-INTELLIGENCE-FOUNDATION.md) records the pre-registered method for closing them and which information is irretrievable if it is not captured at the time. It is documentation only and closes no limitation by itself.

| ID | Description | Current impact | Planned stage | Status |
|---|---|---|---|---|
| GW1R-1 | The pre-first-deadline Transfers guard resolves the deadline against the device clock | A device clock set far enough in the past could in principle hold the guard open past the real deadline. The guard additionally requires `nextGW` 1, no current Gameweek and no finished Gameweek, so this would also need a simultaneously stale Official FPL payload; every missing or unparseable deadline falls back to normal weekly behaviour rather than claiming unlimited changes. The existing deadline countdown and Stage 10 timing surfaces share the same clock dependency | GW1 readiness safety guard | Open (accepted) |
| GW1R-2 | The guard window is evaluated when Transfers renders, not on a timer | A session left open across the deadline instant keeps showing the guarded screen until the next render, exactly as the existing countdown chip does not tick. The first route change, assumption edit or verified refresh re-evaluates it, and a `teamsheet:data-rendered` refresh on app resume starts the normal calculation, so returning to the app after the deadline recovers without user action | GW1 readiness safety guard | Open (accepted) |
| GW1R-3 | The guard's after-deadline transition has automated evidence only | The guarded pre-deadline screen was physically accepted on iPhone Safari, but the transition back to normal weekly behaviour cannot be physically tested before the real first deadline. No approved non-production deadline-override mechanism exists and none was invented | First real Official FPL deadline | Open (evidence gate) |
| SEC-2 | Odds key remains client-side in local storage and is visible to a determined page inspector | Capped-cost key exposure to browser owner/extensions/compromised same-origin code; mitigated by masked field, direct-only transport, one-action forgetting and diagnostic scrubbing | Serverless trigger under D-08 | Accepted-temporary |
| SEC-3 | Frontend Anthropic key field/persistence and keyed browser request path | None; legacy value is deleted and hosted Ask fails fast | Stage 3 | **CLOSED 2026-07-27** |
| CSP-1 | No CSP in deployed build | Fixed by deterministic hash-based meta CSP with build-time and independent test verification | Stage 3 | **CLOSED 2026-07-28** |
| XSS-1 | Dynamic API/user strings were interpolated into HTML | Fixed by DOM builders; AI output fixed separately by restricted Markdown AST | Stage 3.5/3.6 | **CLOSED 2026-07-28** |
| VAL-1 | No runtime schema validation | Fixed by per-endpoint fatal/partial validation | Stage 3 | **CLOSED 2026-07-27** |
| DUP-1 | Duplicate fixtures could double-count projections | Fixed by provider-boundary identity/deduplication | Stage 3 | **CLOSED 2026-07-26** |
| BUILD-1 | Custom bundler could leave parts of multi-line module declarations in production output | Complete static import/export declarations are stripped and surviving module syntax is rejected | Stage 5 review | **CLOSED 2026-07-28** |
| BUILD-2 | The tracked R1 deployable reproduced exactly but recorded an unreachable local generating commit, and its source hash covered runtime modules rather than every build input | A3-R0 added complete input identity, reachable-ancestor verification and exact committed-artifact reproduction before ordinary builds | A3-R0 | **CLOSED and merged 2026-08-09 through PR #98 (`5ee735f864aaea2b6c423dfaeb267f18f5fe3b2f`)** |
| STATE-1 | Shared-state inventory enforcement is intentionally source-structural rather than a general JavaScript data-flow proof | Direct `S.key`, static `S['key']` and the explicit refresh-owned subset are mechanically guarded, but arbitrary future computed-property access would require separate review rather than being proven impossible by the current regression | State-Ownership Cleanup / future ownership audits | Open (accepted) |
| UI-18 | Team on `main` used a legacy-render-then-reconstruct boundary | DTR-1 directly creates the accepted final DOM and passed 691/691 permanent tests, generated provenance and physical iPhone Safari acceptance before merge | DTR-1 | **CLOSED and merged 2026-08-09 through PR #99 (`09e595c275b4f3614c09fb502291de6831813999`)** |
| UI-19 | Focusing sub-16px editable fields made iPhone Safari zoom strongly and the page could remain enlarged after the keyboard closed | PR #100 raised text-like editable controls to a focus-safe 16px without disabling pinch zoom; PR #103 retained that declaration while refining visual x-height/chrome. Physical iPhone Safari testing confirmed normal scale after keyboard close. | iPhone form-focus zoom checkpoint / PR #103 refinement | **CLOSED by physical acceptance; PR #103 merge approved 2026-08-10** |
| RET-1 | `Retry-After` is not honoured | Fixed capped backoff may retry sooner than a provider requests | Serverless reconsideration | Open (accepted) |
| RET-2 | No general transport-level per-provider circuit breaker | R1 adds a minute-history-specific two-failed-batch guard and provider cooldowns, but other pooled endpoint families retain their existing bounded retries | Future provider hardening only with separate approval | Open |
| HEALTH-1 | Provider Health is session-scoped | No multi-session incident history; compact global status and full Settings detail reflect only the current session | No planned stage | Accepted |
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
| ODDS-2 | No free historical odds | Odds/blend ablation must be prospective. The limitation is narrower than it first appears: a Stage 10 pre-deadline record already preserves the normalised derived Odds inputs that actually affected the prediction whenever Odds is healthy at capture, so the primary market-layer on/off ablation needs only a genuine healthy capture and export, not new collection code. What cannot be reconstructed later is individual bookmaker prices, intraday line movement and any alternative transform needing raw quotations; that lost optionality is real but does not justify a pre-GW1 production change | Stage 7+ | Open (bounded) |
| UST-1 | Pre-season Understat uses previous closing six matches | Early-season form may be mislabelled | Prospective validation | Open |
| UST-2 | The measured current Understat HTML did not contain the parser's expected `teamsData` structure | R1 prevents repeated automatic waste with a six-hour cooldown and can retain recent validated cache, but does not repair or replace the parser | Separate provider investigation and approval | Open (gated) |
| DC-1 | Defensive-contribution history starts in 2025/26 | No multi-season validation | Permanent | Accepted |
| FRAME-1 | `frame-ancestors` is ineffective in meta CSP on GitHub Pages | Frame-buster is compensating control | Serverless | Accepted-temporary |
| STYLE-1 | `style-src-attr 'unsafe-inline'` remained necessary | Replaced fixed/dynamic styles with classes, progress and SVG attributes; source/build/deployable guards reject style attributes and the CSP concession is removed | Stage 9.6 | **CLOSED and verified 2026-07-29** |
| UI-13 | UX-A2 Player Detail scroll and rotation correction had not yet received populated physical iPhone Safari acceptance | Acceptance was performed by the owner on 6 August 2026 and passed: background locking, internal scrolling to the final content, close-control reachability, exact background-position restoration on normal close, reopening at the top, backdrop close and both orientations. The first return to portrait exposed Safari automatically enlarging text; root text-size adjustment is now fixed at 100% and the owner physically retested the corrected behaviour successfully. VoiceOver is not a Teamsheet acceptance gate. | UX-A2 owner acceptance | **CLOSED and merged 2026-08-06 through PR #76** |
| UI-14 | The fixed primary dock layered above Player Detail and could cover the final projection line | PR #78 raised the Player Detail backdrop and panel above the unchanged fixed primary dock, added a focused stacking regression, passed the 645-test and deterministic-build gates, received populated iPhone Safari acceptance and merged at `ebb8838e7bfd081371a0639c9b4bdacfc9b92bc6`. No calculation, model, provider, route or data-source behaviour changed. | UX-A2 post-merge follow-up | **CLOSED and merged 2026-08-07 through PR #78** |
| UI-12 | UX-A1 Team resources and bench clarity had not yet received populated physical iPhone Safari acceptance | UX-A1 populated iPhone Safari acceptance passed on 6 August 2026 and the accepted checkpoint merged through PR #74. VoiceOver is not a Teamsheet acceptance gate. | UX-A1 owner acceptance | **CLOSED and merged 2026-08-06 through PR #74** |
| UI-1 | No persistent browser-level screenshot-regression suite | Stage 9.6 completed representative mobile/desktop browser review with no console errors, but future visual changes still require human device review | Future tooling only with separate approval | Open (accepted) |
| UI-2 | Stage 9 primary navigation remained Team, Players, Transfers and More | Replaced by Team, Transfers, Fixtures, Leagues and Settings with Ask Teamsheet as a global/Team action | Teamsheet 2.0.1 | **CLOSED and verified 2026-07-31** |
| UI-3 | Settings and supporting tools were distributed through the Stage 9 More hierarchy | 2.0.1 created the approved hierarchy; 2.0.6 adds route-owned subsections and explicit content mounts | Teamsheet 2.0.1/2.0.6 | **CLOSED and merged 2026-08-04 through PR #65** |
| UI-5 | Physical iPhone rendering of the five-tab navigation is not independently automated | Static responsive, route and accessibility contracts pass, but exact device chrome, text scaling and thumb comfort require owner review | Teamsheet 2.0.1 review and 2.0.7 | Open (acceptance gate) |
| UI-4 | The Team screen did not provide the complete approved decision-home summary | Pitch-first hierarchy, XI/captain/bench forecast, one material risk, deadline action and honest setup/degraded states are implemented without calculation changes | Teamsheet 2.0.2 | **CLOSED and verified 2026-07-31** |
| PREVIEW-1 | Decision previews are intentionally session-only | Transfer/captain previews disappear on refresh and are not submitted to FPL; this prevents accidental persistence or account changes | By design | Accepted |
| PREVIEW-2 | Transfer preview pitch is next-Gameweek only while optimiser gain can span several Gameweeks | The banner must be read alongside the pitch to distinguish next-GW XI score from multi-GW net gain | Stage 9.4 | Accepted-labelled |
| ML-1 | Leagues exposed only a top-N sampled ownership comparison | Replaced by the official 2.0.4 foundation: primary league, current position/movement, points gaps, nearby standings and selected-rival factual comparison | Teamsheet 2.0.4 | **CLOSED and merged 2026-08-02 through PR #59** |
| ML-2 | No approved tactical Mini-League recommendation model | 2.0.5 adds exact selected-rival factual exposure only; it does not predict outcomes, rank meaningful differentials or alter Team/Transfers advice | Separate model gate | Open (gated) |
| ML-3 | Post-Gameweek populated Leagues acceptance is not yet possible | The pre-season hub, selection, empty states and management paths passed physical iPhone Safari review. Published rank/movement, populated standings/gaps, real rival comparison/exposure and relevant pagination still require Official FPL post-Gameweek data. | First relevant completed Gameweek | Deferred evidence gate; not a current defect |
| RANK-1 | Projected final Gameweek score and rank movement are not yet designed or validated | Teamsheet must not manufacture live-rank precision or blur projection with confirmed Official FPL results | Separate design and explicit approval | Open (expected) |
| STRAT-1 | No protect, balanced or chase Mini-League strategy model is approved | League position may be described, but it cannot silently alter production recommendations | Separate design and explicit approval | Open (gated) |
| EVID-1 | Browser timing evidence is not externally notarised | Same-origin HTTP `Date` plus clock-skew checks support leakage review but cannot prove capture time to an independent third party | Future serverless only with separate approval | Open (accepted) |
| EVID-2 | Local evidence can be cleared and JSON exports are unencrypted | GW1-P1 adds a private server archive destination, but until GW1-P2 the normal Teamsheet browser does not upload to it automatically; local evidence can still be cleared and manual JSON exports remain unencrypted | GW1-P2 browser custody integration | Open (accepted until GW1-P2) |
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
| UI-6 | First Teamsheet 2.0.1 physical iPhone review found dock, icon, focus and Settings-header defects | Approved corrections were implemented and merged through PR #48; populated-data transport remains tracked separately by FPL-1 | Teamsheet 2.0.1 | **CLOSED and merged 2026-07-31** |
| UI-7 | Teamsheet 2.0.2 populated physical iPhone acceptance was not recorded | Final Team acceptance passed on 7 August 2026 after PRs #80–#83: startup ownership, availability wording, reserve-GK display slot, outfield bench order and narrow unavailable badge were physically confirmed. | Team feature-specific live acceptance | **CLOSED and merged 2026-08-07 through PR #83 (`385e5102c0e86e4b926503bffceba08bd6d831c3`)** |
| UI-8 | Teamsheet 2.0.6 physical iPhone and live populated-data acceptance is not recorded | Automated and headless-browser checks cover routes, focus, mounts, warning states and responsive CSS, but they do not establish iPhone Safari density, one-handed comfort or live transport behaviour. VoiceOver is not a Teamsheet acceptance gate. | Feature-specific live acceptance | Open (acceptance gate) |
| UI-15 | Fixtures 12-Gameweek horizontal scrolling exposed an incoherent sticky TEAM column/header and a fallback explanation that travelled with the table | PR #85 corrected the sticky TEAM header/body presentation, kept the fallback explanation outside the horizontal scroller and corrected fallback-aware intro copy; the deployed path was physically accepted on iPhone Safari during the PR #86 follow-up | Fixtures feature-specific live acceptance | **CLOSED and merged 2026-08-07 through PR #85 (`01c16588b63bf41b099adc64b6a1c9044eba9eec`)** |
| UI-16 | Fixtures allowed a typed horizon above 12 while runtime silently clamped the calculation/render span to 12 | PR #86 exposes 1–38 Gameweeks, caps at the remaining season, synchronises the visible value and prevents post-GW38 swing windows without changing fixture formulas; owner verified GW23 reachability and GW38 boundary behaviour on deployed iPhone Safari | Fixtures feature-specific live acceptance | **CLOSED and merged 2026-08-07 through PR #86 (`e49599a75bbb77618292fdb6100fcffd81685c44`)** |
| REFRESH-1 | Qualifying foreground return temporarily locked the app after unsuccessful loading | Every completed attempt now starts the ten-minute cooldown, paired Safari events deduplicate and foreground refresh remains interactive; physical owner retest passed | Teamsheet 2.0.7 | **CLOSED and merged 2026-08-05 through PR #68** |
| REFRESH-2 | Foreground refresh mutated runtime provider state before one final render instead of constructing a fully atomic replacement | Atomic Foreground Refresh stages collection, applies one synchronous no-throw commit, keys account carry-forward, and separates collection/commit/render/persistence errors | Atomic Foreground Refresh | **CLOSED and merged 2026-08-09 through PR #102 (`d5f2572ee4d95c3c242ecbc97ee46802a6f0273d`), physically accepted** |
| REFRESH-6 | Storage-quota and serialisation write failures are silently swallowed by `sset` | `ssetChecked` gives the refresh persistence phase an observable `persist_failed` class; full quota handling and eviction remain out of scope | Separate design | Open (gated) |
| PERSIST-1 | A failed browser write may only survive for the current session | The change stays active and the app states explicitly that it was not saved; a reload returns the last durable value, the default or a rediscovered Official FPL value | By design of a local-only store | Accepted-labelled |
| PERSIST-2 | Fail-closed compatibility can require the user to re-enter data | Unversioned, previous-season, unsupported-schema or malformed configuration, manual-squad and Mini-League records are dropped rather than guessed, so Team ID, resources, a manual squad or league selections may need re-entering after a season or schema change | By design; guessing season ownership is unsafe | Accepted-labelled |
| PERSIST-3 | Durability during normal Teamsheet use is still only as good as the browser backend | Merged GW1-P1 provides a server archive destination, but on `main` the browser is not connected; the GW1-P2 client that connects it is unmerged and acceptance-incomplete. A verified local write can still later be evicted/cleared or lost with the device, and normal app capture has no accepted automatic server copy yet | GW1-P2 persistent outbox/upload | Open (gated) |
| PERSIST-4 | `fpl:calib` lacked a compatibility-owned restore contract | Fails closed on every current unverified calibration record, preserves the stored bytes and keeps standard uncalibrated projections active; no production calibration methodology is introduced | `fpl:calib` compatibility and resilience | **CLOSED and merged 2026-08-10 through PR #107 (`d112c673310149a4463def1758242460450600dc`), verified by Verify Teamsheet run #127** |
| PERSIST-5 | The storage-manager persistence paths have no physical device evidence | Teamsheet itself never installs `window.storage`, so the authoritative-backend contracts are proven by automated tests against stub backends only, not on a host that provides one | Requires a host that supplies a storage manager | Open (evidence gap) |
| ERR-1 | A recovery-render failure after a genuine Official FPL collection failure was silently swallowed | EB-1 keeps the recovery render guarded so it still cannot escape `loadAll`, but records the caught error and returns it as `secondaryErrorClass:'render_failed'` beside the primary `collection_failed`; the real provider Fallback/Unavailable classification and the previously verified state both survive | A3 error-boundary separation | **CLOSED and merged 2026-08-10 through PR #108 (`ba5daa2000345ddde3d8e6f6d381d44603e7cd29`)** |
| ERR-2 | An unexpected internal exception from Understat or Odds computation was converted into fabricated provider degradation | EB-1 marks such results application-owned. They still pass through the one shared apply gate so Rule B's retain/clear decision is unchanged, but the pre-application Provider Health is restored afterwards and a cleared supporting value removes its row rather than publishing a false provider result | A3 error-boundary separation | **CLOSED and merged 2026-08-10 through PR #108 (`ba5daa2000345ddde3d8e6f6d381d44603e7cd29`)** |
| ERR-3 | The application error boundary is deliberately narrow | EB-1 owns unexpected exceptions only at the verified-refresh lifecycle edge (startup, manual and foreground). No global `window.onerror` or `unhandledrejection` layer is installed, so an unexpected exception raised by an unrelated event handler still surfaces as an ordinary uncaught browser error | By design; a global swallowing layer would hide real defects | Accepted-labelled |
| ERR-4 | The clean/no-core offline EB-1 application state has no physical iPhone app evidence | Normal startup, manual refresh, saved-data offline refresh and return-online recovery passed on physical iPhone Safari. In a clean Private tab while already offline, Safari could not load the uncached static Pages shell, so the no-core application state could not execute; automated regressions own that path. The acceptance squad was incomplete, so recommendation-survival was not separately observed on device. | Static offline-shell limitation / automated EB-1 coverage | Accepted evidence limitation; executable EB-1 paths physically accepted 2026-08-10 |
| REFRESH-7 | Fire-and-forget evidence, outcome and metrics consumers can straddle a commit and read mixed state | Not addressed by this checkpoint | Separate design | Open (gated) |
| REFRESH-8 | No `online` event listener, so reconnection does not itself trigger recovery | Recovery still depends on the next `visibilitychange`/`pageshow` or manual Load data | Separate design | Open (gated) |
| REFRESH-9 | Leagues rival cache keyed on `S.currentGW` can orphan in-flight records across a commit | Not addressed by this checkpoint | Separate design | Open (gated) |
| REFRESH-10 | An open player card may display a superseded generation, and focus restore on close may target a detached node | Automatic card rerendering is excluded from Atomic Foreground Refresh by approval | Separate design | Open (gated) |
| REFRESH-3 | Refresh-Load R1's corrected offline disclosure lacked its focused physical iPhone retest | Pritesh physically retested corrected source `d1b6ac0…`: the already-open app stayed usable, preserved the saved timestamp, labelled FPL Fallback and explicitly stated the device was offline; PR #96 then merged and the same build identity was verified from Pages on `main` | R1 owner acceptance | **CLOSED and merged 2026-08-08 through PR #96 (`2ddb33c81fa2092598f290d60320364f2e0c35dc`)** |
| REFRESH-4 | A full offline Safari reload cannot load the static GitHub Pages application shell | R1 can preserve an already-open verified state during offline refresh, but cannot start the app document itself without a service worker/offline-shell architecture | Separate offline-shell design and approval | Open (gated; outside R1) |
| FPL-1 | Static Pages could not reliably read Official FPL through anonymous browser relays | Replaced by the owner-controlled allowlisted gateway; live 2026/27 transport passed on physical iPhone Safari | FPL-T1 | **CLOSED and merged 2026-08-06 through PR #69 (`00a35bacd2396a125a8a914bff9980b4f18b257f`)** |
| FPL-2 | Full populated Teamsheet behaviour has not yet been accepted across every live Official FPL account and league path | Gateway, Transfers, Player Detail, Team and Fixtures tested paths have passed. The Leagues pre-season path is accepted; remaining checks require published post-Gameweek League data and are listed in `LEAGUES-PRESEASON-ACCEPTANCE.md`. | First relevant completed Gameweek | Deferred evidence gate — Leagues post-Gameweek only |
| TRF-A1 | Initial exact Transfers device tests exposed the evaluation-ceiling and missing-baseline presentation failures | Exact search, lifecycle handling and separate-baseline presentation were corrected; populated physical iPhone Safari acceptance passed, including final **No hit** wording | Track A | **CLOSED and merged 2026-08-06 through PR #72 (`be742e1eb707b3892f6405adf5d8769e084eee65`)** |
| TRF-A2 | Official-scale exactness is not proved against the exhaustive oracle | A full-pool exhaustive comparison is not tractable; oracle equality is proved on controlled pools and the Official-scale claim is only that the exact search completes below the unchanged ceiling with `status: 'ok'` | By design of the evidence | Accepted-labelled |
| TRF-A3 | Reduced evaluation counts are a search-efficiency result only | Fewer evaluated plans say nothing about projection quality; no prediction-accuracy claim is created or implied | By design | Accepted |
| ACCOUNT-1 | Bank and available free transfers remain manual inputs rather than proven authoritative account values | Values can be entered but are not yet verified from the connected FPL account; no inference may be labelled authoritative | Separate data/security design | Open (gated) |
| MANUAL-1 | Manual squad editing requires the verified Official FPL player catalogue | First-run core-data failure means player search and saved-ID resolution cannot operate; controls are now disabled and honestly labelled, while production remedies remain separately gated | Manual fallback investigation | Open (design gate) |
| AI-1 | Ask works only inside Claude artifact preview | No hosted AI features | Serverless | Accepted |

| UI-9 | Transfer optimisation previously ran synchronously on the Safari UI thread | Explicit browser Web Worker, batched preparation, persistent calculation, cancellation and result reuse passed populated iPhone Safari acceptance | Track A | **CLOSED and merged through PRs #69–#72** |
| UI-10 | Blob Web Workers depend on the browser accepting `worker-src 'self' blob:` | The live Pages CSP path passed on the target physical iPhone Safari; unsupported browsers still fail honestly without a main-thread fallback | Track A target-device acceptance | Accepted-tested; fallback retained |
| UI-11 | Deadline evidence capture can still run the transfer search on the main thread | `src/evidence/snapshot.mjs` calls `optimiseTransfers()` directly when no matching result is cached. Evidence capture is outside Approved Scope for the Transfers performance correction, so it was documented rather than changed | PR #69 performance correction | Open (scope gate) |
| UI-17 | The session result cache stores each result under an exact key and a weaker alias | The alias omits the player price/status hash. In practice `teamsheet:data-rendered` clears the cache on every verified render, so a price change cannot outlive it, but the alias is not itself price-aware | PR #69 performance correction | Accepted |

## Teamsheet 2.0 migration limitations
- Teamsheet 2.0.1–2.0.7 are complete and merged, implementing the approved navigation, Team, Transfers, factual Mini-League foundation, selected-rival factual exposure, organised Settings/research/evidence/diagnostic surfaces and final mobile polish. Projected rank, rival-score prediction, remaining-player simulation, effective-ownership strategy and tactical recommendation work remain separately gated.
- The Stage 9 engineering foundation remains valid, while its primary information architecture is superseded.
- No new projection, captaincy, optimiser, Mini-League strategy or rank model is authorised by the blueprint.
- The migration must preserve verified engineering and existing access to every current functional surface.
- Provider Health retains all seven states. Full detail now remains in Settings; only material core Official FPL consequences surface on primary routes. Provider behaviour is unchanged.
- Official results and projected values require explicit separation in future rank and Mini-League work.
- Low ownership alone must not be presented as a positive differential recommendation.
- Teamsheet 2.0.7 is merged through PR #68; its Safari foreground-resume correction passed owner retest. VoiceOver is not a Teamsheet acceptance gate. FPL-T1 and Track A are merged through PRs #69–#72; UX-A1, UX-A2 and the PR #78 dock-layering correction are also merged. Team and Fixtures tested populated paths subsequently passed. Leagues pre-season acceptance is recorded through PR #93, while post-Gameweek populated evidence remains deferred under FPL-2/ML-3.

## Stage 10.1 automatic refresh limitations
- “Latest” means the latest data that passed approved validation. It does not guarantee every optional provider is live.
- GitHub Pages and iPhone Safari cannot reliably wake a fully closed or suspended app. Automatic work begins on startup or foreground return; guaranteed closed-app scheduling requires a later server-side design.
- Startup and explicit manual loading own the interaction gate. Foreground refresh remains interactive — Atomic Foreground Refresh makes that safe by construction rather than by locking, because the commit contains no suspension point.
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
- Metric records are bounded browser recovery, not a permanent database or externally authenticated archive during normal app use until GW1-P2 uploads them.
- Stage 10.3 implementation and 397 passing tests prove contract integrity, not prediction accuracy or probability calibration.

## Stage 10.4 operating-review limitations
- Review quality cannot exceed retained evidence quality. Pruned or missing exact snapshot/outcome/evaluation payloads are reported as partial and cannot be reconstructed.
- Local Stage 10 retention remains recovery-oriented rather than a permanent season archive in normal app use until GW1-P2; a season JSON bundle may therefore be partial on one device.
- Google Sheets import is manual. The app does not authenticate to Drive, select a workbook, append rows or run unattended exports.
- No XLSX or ZIP export exists. The eight CSV files are downloaded individually to avoid browser multi-download and mobile reliability problems.
- Exports above 25 MiB fail rather than truncate; no compression or automatic splitting is implemented.
- Transfer-horizon gains are not summed cumulatively because horizons can overlap and plans are alternatives.
- Provider-state comparisons are observational, not causal. One Gameweek is never labelled calibrated/uncalibrated or accurate/inaccurate.
- Static phone-first tests pass, but physical iPhone acceptance was not separately recorded. The old standalone Stage 10.5 rehearsal gate is superseded by checkpoint-specific checks and final Teamsheet 2.0.7 rehearsal.

## Stage 10.5 hardening limitations
- Safari can acknowledge only that a download was requested; Pritesh must confirm the file in Files or Downloads.
- Browser storage and exported JSON remain unencrypted and are not a permanent database during normal app use until GW1-P2 connects the archive.
- Static GitHub Pages cannot perform guaranteed closed-app collection.
- Recovery-only imports cannot become official/current or automatically recreate every local metric view.
- No migration engine exists because no older supported Stage 10 schema currently requires one.
- Stage 10 infrastructure completion does not establish prediction accuracy or calibration.

## Teamsheet 2.0.4 acceptance evidence

Automated contracts cover League state migration, official-data validation, ID-free routes, standings/rival states, honest wording, mobile layout and build integrity. Teamsheet 2.0.4 is complete and merged through PR #59. Physical testing of the actual repository build on an iPhone was not separately performed and live populated-data acceptance was not performed. VoiceOver is not a Teamsheet acceptance gate. The approved sample preview established design direction but was not equivalent to full repository-device acceptance. Public FPL transport limitation FPL-1 has since been closed, but feature-specific Leagues acceptance remains open under FPL-2.

## Teamsheet 2.0.4 Mini-League limitations
- Official FPL entry, standings and picks endpoints are undocumented; strict field validation may reduce coverage when schemas drift.
- Only classic public league membership is discovered. Private/authenticated access remains excluded.
- Large leagues are not scanned in full. Teamsheet loads page 1, pages around the official manager rank and additional sequential pages only when requested.
- Rival public picks are loaded one selected manager at a time and may be unavailable or incomplete.
- Fetched standings and rival squads are session-only. A failed refresh may retain the last session result with explicit stale wording; a page reload refetches public data.
- Points gaps and squad overlap are factual derivations. They do not establish projected rank, captaincy gain, meaningful differential quality or protect/chase strategy.
- League/member identifiers remain local but are necessarily sent to Official FPL/public relays for the requested read-only endpoint. They are omitted from routes, rendered diagnostics and Stage 10 evidence.

## Teamsheet 2.0.6 acceptance evidence

Teamsheet 2.0.6 is complete and merged through PR #65 at `cd1ad52ea4d13a247a82bc90f80f2db0b6f77aa4`. Automated contracts cover the nested Settings route map, nearest-parent fallbacks, exact route headings, parent-aware Back focus, identifier-free URLs, explicit Stage 10 UI hosts, export/recovery/deletion separation, consequence-led core-data warnings, build identity, mobile Player Explorer presentation, CSP and deterministic build integrity. A headless Chromium smoke check exercised direct deep links, active navigation, exact focus, Back restoration, dynamic hosts, warning copy and duplicate-ID absence. The verified baseline is **520 passed, 0 failed, 0 skipped**, with deterministic builds and root `index.html` equal to `dist/index.html`.

Physical testing of the actual repository build on an iPhone Safari was not performed for the relevant 2.0.6 surfaces. Live populated-data acceptance was not performed. VoiceOver is not a Teamsheet acceptance gate. Headless Chromium is not equivalent to iPhone Safari, actual touch comfort or public endpoint availability. Relevant remaining acceptance is tracked under FPL-2.

## Teamsheet 2.0.6 organisation limitations

- Player Explorer mobile cards change presentation only; a persistent watchlist and multi-player comparison remain unimplemented and require separate product approval.
- The warning classifier intentionally covers core Official FPL availability only. Optional-provider detail remains in Settings unless an existing recommendation path already exposes a material consequence.
- Browser Back focus restoration depends on the opener remaining in the current DOM. If it is unavailable, the exact route heading receives focus.
- Evidence, outcome and metric storage remains bounded local recovery in normal app use until GW1-P2. Reorganisation does not create a migration engine.
- A persistent screenshot-regression suite remains absent, so later visual changes still require human device review.

## Teamsheet 2.0.7 implementation acceptance status

Teamsheet 2.0.7 is complete and merged through PR #68. Its Safari foreground-resume correction passed owner retest. VoiceOver is not a Teamsheet acceptance gate and no physical screen-reader claim is made. FPL-1 is closed. Subsequent FPL-T1 and Track A work is merged through PRs #69–#72, UX-A1 through PR #74, UX-A2 through PR #76 and the Player Detail dock-layering correction through PR #78. Remaining feature-specific populated acceptance is tracked under FPL-2 for Leagues only; Team and Fixtures have since passed their tested populated iPhone paths.

### Physical iPhone Safari foreground resume

The repeat-refresh interaction freeze identified on physical iPhone Safari was corrected in PR #68 and the owner successfully repeated the app-switch test. `REFRESH-1` is closed; this is historical evidence rather than an outstanding gate.

### PR #69 populated-data correction note
Physical iPhone review exposed pre-season public-picks and missing-team-strength gaps. The correction derives public picks from the current or explicit next Gameweek and fails honestly to manual setup when FPL withholds a complete public squad. Missing strength inputs no longer create `NaN`: Official FPL difficulty temporarily drives the fixture table/sort while player projections use neutral multipliers. The tested Transfers/live-transport path was subsequently accepted; FPL-2 remains open only for the separately listed Leagues populated-acceptance path; Team and Fixtures have since passed.

### Overall FDR fallback limitation
When current Official FPL attack/defence strengths are unavailable, the Fixtures surface uses the provider's single overall 1–5 difficulty rating. It cannot honestly distinguish attacker and defender fixture quality, so those lenses are hidden and the direct average FDR is shown with lower meaning easier. This is coarse contextual data, not a position-specific model. A historical pre-season prior remains a separately gated design item.

<!-- TRANSFERS-TRACK-A-2026-08-06 -->
## Transfers Track A limitations

| ID | Description | Current impact | Planned stage | Status |
|---|---|---|---|---|
| TRF-PERF-1 | Exact automatic/persistent search required physical iPhone performance acceptance | The default six-Gameweek calculation completed in about 15 seconds and the tested persistence, cancellation, app-switch and stale-result paths passed. This evidence does not establish universal browser performance or indefinite repeated-run memory behaviour. | Track A physical acceptance | **CLOSED for the tested target path; broader browser performance remains unclaimed** |
| TRF-PERF-2 | A browser reload or page close ends the in-memory worker and result cache | The next valid session recalculates automatically; no durable optimiser-result database is introduced | By approved design | Accepted |
| TRF-PERF-3 | Exact pruning is intentionally conservative | It may leave performance on the table rather than risk changing plans or ordering; heuristic candidate restriction remains unapproved | Future only if device target fails | Accepted |
| TRF-PERF-4 | Deadline evidence can still invoke the optimiser directly outside the app-scoped Transfers controller | Evidence capture may retain a main-thread search path; this Track A UI architecture does not silently broaden into Stage 10 evidence orchestration | Separate scope gate | Open |

The Track A implementation does not address captaincy, bench emergency value, auto-subs, future transfer sequencing, recent player attacking-role form or heuristic/progressive search. Those remain separate model/data approval gates.

## 2026-08-06 — Concurrent continuation reconciliation

The unresolved-promise risk for cancelled or superseded transfer Workers is closed by explicit settlement and runtime tests. Mixed-width player-ID tie handling is covered against the independent exhaustive oracle.

This was the interim reconciliation limitation. The combined Track A path was subsequently physically accepted on iPhone Safari for the recorded calculation, navigation, cancellation, backgrounding and stale-result checks. CI still cannot establish universal device memory pressure, thermal behaviour or untested browser behaviour, and VoiceOver is not claimed.

## Track A physical-test limitation — 2026-08-06

The populated Transfers workflow was physically tested on Pritesh's iPhone Safari, but VoiceOver was deliberately not tested. Do not claim physical screen-reader verification. The device result is evidence for the tested calculation, navigation, cancellation, app-switch and stale-result paths only.

## Track A acceptance boundary — 2026-08-06

The target populated iPhone Safari Transfers paths are accepted. This does not establish universal browser performance, VoiceOver behaviour or full live acceptance for every Team, Fixtures or Leagues path. Player Detail has since received populated iPhone acceptance for the tested PR #78 correction path. Remaining feature-specific live acceptance stays under FPL-2 for Leagues only; Team and Fixtures have since passed.


<!-- DATA-S1-2026-08-22 -->
## DATA-S1 repository foundation — 22 August 2026

The separately approved [DATA-S1 Shadow Structured Data Foundation](DATA-S1-SHADOW-STRUCTURED-DATA-FOUNDATION.md) adds the isolated, provider-neutral `teamsheet-data-platform` repository service and separate future `teamsheet-data` D1 binding. Only `shadow_only` is valid. It has no production/browser/model/Provider Health read path, no new R2, no provider activation and no Google Sheets integration; existing Stage 10 D1/R2 custody remains separate and unchanged. No live infrastructure was created or modified. PR #145 is merged and repository-verified, but DATA-S1 remains **not live deployed**. DATA-S1A is the current control reconciliation. The separately owner-gated sequence is DATA-S1B live Cloudflare preflight/deployment/acceptance, DATA-S2 Official FPL structured history, DATA-S3 automated Official outcomes, DATA-S4 provider trials/evaluation, DATA-S5 downstream Sheets automation, then later explicit production/model gates. See the [DATA-S1B plan](DATA-S1B-LIVE-DEPLOYMENT-ACCEPTANCE-PLAN.md).

Effective **22 August 2026**, the owner superseded the blanket £0 recurring-cost constraint: free remains preferred where comparable, while a small paid provider may be considered only with explicit pricing, rights and value/cost justification, preferably after a shadow trial. This approves no provider and does not rewrite historical research conducted under the former constraint.
