# GW1-READINESS-SAFETY-GUARD.md — pre-deadline Transfers safety guard

Purpose: the record for the narrow implementation checkpoint that followed the GW1 readiness audit. Audience: any session touching the Transfers screen or the pre-season application state. Last updated: 12 August 2026.

Related: [Project Context](PROJECT_CONTEXT.md), [Architecture](ARCHITECTURE.md), [Roadmap](ROADMAP.md), [Known Limitations](KNOWN_LIMITATIONS.md), [Stage 10 operations](STAGE10-OPERATIONS.md), [Historical Records](HISTORICAL_RECORDS.md).

## Baseline

Branch `agent/gw1-readiness-safety-guard`, created from `main` `be9d3c98ceff3549574535815a41cd75bb93d0f6` — the merge of the canonical documentation reconciliation PR #120. The GW1 readiness audit concluded **go with conditions**: zero blockers and two items to fix before GW1. This checkpoint implements exactly those two items and nothing else.

GW1-P2 draft PR #119 is untouched by this checkpoint.

## Problem

Before the first Official FPL deadline of a season, Official FPL allows unlimited changes to the initial squad. Free transfers, transfer costs and points hits do not exist in that window.

The Transfers screen was an ordinary weekly optimiser at all times. It accepted a 0–5 free-transfer assumption, applied `transferHit()` deductions, ranked one-to-three transfer plans against a mandatory no-transfer baseline, and presented free-transfer rollover and hit consequences. That behaviour is correct for a normal Gameweek and misleading during the initial unlimited-change period, where a "−4 hit" or a "keep 2 free transfers" statement describes rules that are not yet in force.

## Behaviour

### Before

Opening `#/transfers` always painted the weekly workspace, always collected the free-transfer and bank assumptions, and always started one automatic background optimiser calculation for the current squad.

### After

The screen has one additional, strictly time-bounded state. While the pre-GW1 unlimited-change window is open, Transfers:

- runs and presents no weekly optimiser calculation;
- presents no free-transfer count, no hit cost, no ranked plan and no no-transfer baseline;
- hides the planning-assumptions fieldset, so no free-transfer or bank assumption is collected;
- states that Official FPL allows unlimited initial-squad changes until the GW1 deadline, that Teamsheet's weekly optimiser applies after that deadline, and that Team and the Team-setup manual squad builder are where the initial squad is reviewed and changed;
- keeps the existing context chips, so the Gameweek, the official deadline and the existing verified/saved data truth-labelling are unchanged.

Everything else on the screen and everywhere else in the application is unchanged.

## The rule

The window is derived from verified Official FPL event data already held in state — never from a hard-coded season date. `initialSquadWindow(state, now)` in `src/ui/transfer-optimiser-view.mjs` returns `{active, reason, gameweek, deadlineMs, remainingMs}` and is active only when **all** of the following hold:

1. `S.nextGW` is `1`;
2. `S.currentGW` is `0`;
3. `S.seasonLive` is not `true`;
4. `S.boot.events` contains a GW1 event whose `deadline_time` parses to a finite instant;
5. the current instant is strictly before that deadline.

Conditions 2 and 3 are deliberate redundancy. Official FPL's `is_next` already moves to GW2 once the first deadline passes, so condition 5 is the operative rule; conditions 2 and 3 mean that a contradictory feed, a wrong-season payload or a badly skewed device clock resolves to normal weekly behaviour rather than to a false unlimited-change claim.

Boundary and failure behaviour:

| Situation | Result |
|---|---|
| GW1, deadline in the future | Guard active |
| GW1, the exact deadline instant | Guard inactive — normal weekly behaviour |
| GW1, deadline passed | Guard inactive |
| Any later Gameweek | Guard inactive |
| No verified core, no GW1 event, absent or unparseable deadline | Guard inactive, `deadline_unavailable` |
| Unusable clock value | Guard inactive, `deadline_unavailable` |

Failing conservatively means falling back to the existing weekly path, whose own error states already handle missing verified data. It never means inventing an unlimited-change state.

## Ownership at runtime

`transferPerformanceInitialSquadClaim()` in `src/ui/transfer-performance.mjs` is the single guard entry point. It is consulted by `renderTransfers()`, by `transferPerformanceEnsure()`, by `transferPerformanceStart()` and by the automatic scheduling timer, so no route render, no verified-data change, no assumption edit and no queued auto-start can begin optimiser work while the window is open.

When the guard claims the screen, `transferPerformanceInitialSquadSuspend()` clears the pending auto-schedule timer, cancels and terminates any in-flight worker, clears the session result cache, clears the cancelled/failed signatures, clears `S.lastOptimiser` and clears any previewed transfer plan through the existing `transferPlannerClearPreview()` path. Suspension is idempotent, so repeated guarded renders are safe. A previewed plan therefore cannot survive on the Team pitch, and a cached or paused result cannot be repainted.

## Deliberate exclusions

No optimiser mathematics changed. `optimiseTransfers()`, `exhaustiveTransferSearch()`, `transferHit()`, pruning, admissibility, the free-transfer rollover utility and the worker model source are byte-unchanged, and the guard cannot enter the optimiser. No projection, expected-minutes, scoring, fixture, deadline-calculation, squad-legality, captaincy, vice-captaincy, bench, simulation, rank, Mini-League, rival, provider, Understat, Odds, gateway, Worker, Cloudflare, D1/R2, evidence-canonicalisation or evidence-transport behaviour changed. Team and the manual squad builder are untouched. GW1-P2 PR #119 is untouched. No golden expectation changed.

## Documentation corrections

Only demonstrably stale operator and current-status text was corrected:

- `docs/STAGE10-OPERATIONS.md` — the live pre-deadline and post-Gameweek procedures pointed at a `More →` menu that no longer exists. They now name the current owner path, `Settings → Evidence & Performance → Deadline evidence` and `… → Operating review`. Historical Stage 10 records that describe the navigation of their own era were deliberately left unchanged.
- `docs/PROJECT_CONTEXT.md` — the canonical documentation reconciliation was still described as the current checkpoint and `main` was still recorded at the pre-PR-#120 commit. Both now record the merged state, and this checkpoint is named as the current one.
- `docs/HISTORICAL_RECORDS.md` — the Data Architecture D1 index entry still said implementation remains deferred, which contradicts the merged GW1-P1 backend evidence foundation. The entry now separates the merged backend half, the unmerged GW1-P2 browser half and the still-deferred remainder, without rewriting chronology.

No broad documentation cleanup was performed.

## Limitations

- The rule depends on the device clock, exactly as the existing deadline countdown and Stage 10 timing surfaces already do. A device clock set far enough in the past could in principle hold the guard open past the real deadline; conditions 2 and 3 above make that require a simultaneously stale Official FPL payload.
- The pre-deadline state is testable on a physical device now. The after-deadline transition cannot be physically tested before the real GW1 deadline, because no approved non-production deadline-override mechanism exists and none was invented. That transition is covered by automated tests only.
- The guard is a presentation and scheduling boundary. It does not and must not assert anything about squad legality, budget or the correctness of the initial 15 players.
- The window is evaluated when Transfers renders, not on a timer. A session left open across the deadline instant keeps showing the guarded screen until the next render — exactly as the existing deadline countdown chip does not tick. The first route change, assumption edit or verified refresh re-evaluates it, and a `teamsheet:data-rendered` refresh on app resume starts the normal calculation, so returning to the app after the deadline recovers without user action.
- `S.lastOptimiser` is cleared when the guard claims the screen. In a real pre-GW1 session it is already null, because the guard prevents the only code path that sets it, so Stage 10 evidence capture takes its existing independent `optimiseTransfers()` fallback either way. No evidence schema, canonicalisation or capture-window behaviour changes.
