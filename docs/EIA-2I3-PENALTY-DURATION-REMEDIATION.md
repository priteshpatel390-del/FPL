# EIA-2I3 — Penalty/Duration Contract Remediation and Live Closeout

Status: **repository remediation implemented; provider conditionally qualified for prospective private shadow workload only**  
Baseline: `66f1f1439e71238129d6f94275d7187c125d0c3b`  
Decision date: 15 September 2026

## Outcome

EIA-2I2 found API-Football technically useful for structured fixture, lineup, bench, appearance, direct-minute and event evidence, with observed free limits of 100 requests/day and 10 requests/minute. Qualification remained conditional because League Cup penalty fixtures exposed `status.short: PEN` and `status.elapsed: 120` even where that combination did not safely establish that extra time was played. EIA-2I1 treated any accepted duration above 90 as proof of extra time, so it could create a false normalized fact.

EIA-2I3 corrects that contract. Provider `elapsed` is evidence, not universally authoritative played duration. Direct player minutes remain independent direct workload evidence and never manufacture fixture duration or extra-time state. API-Football remains disabled, transient, private/non-commercial, shadow-only and isolated from every production calculation.

## Duration state matrix

| Final state and evidence | Authoritative duration | `extraTime` | Fallback |
|---|---:|---:|---|
| `FT`, integer provider elapsed from 1 through 90 | provider elapsed | `false` | invalid or over-90 elapsed is not qualified: both values `null` |
| `AET`, integer provider elapsed above 90 through 130 | provider elapsed | `true` | absent, invalid or at-most-90 elapsed is internally inconsistent: both values `null` |
| `PEN`, exactly one verified fixture-specific qualification proves extra time and supplies duration above 90 | qualified duration | `true` | missing qualification remains unknown |
| `PEN`, exactly one verified fixture-specific qualification proves no extra time and supplies duration at most 90 | qualified duration | `false` | missing qualification remains unknown |
| `PEN` plus provider elapsed 120 but no independent qualification | `null` | `null` | never infer extra time or no extra time |
| unsupported/incomplete final state | no observation | no observation | fail closed |

A penalty qualification is accepted only when it identifies exact provider and fixture, is explicitly verified, declares `played` or `not_played`, supplies a consistent bounded duration and carries provenance. Missing qualifications are not errors and preserve unknown; duplicate or internally contradictory qualifications fail closed. Player minutes are bounded direct facts. They are checked against authoritative duration when one exists, but minutes above 90 remain retainable when fixture duration is unknown and do not change `extraTime`.

## Bounded live closeout

EIA-2I3 used 11 additional credentialed calls. The first seven-call sequence completed; four bounded repeat calls recovered sanitized FA Cup and correction output after the command runner detached from the original output stream. Calls were paced at seven-second intervals. Endpoint totals were two `fixtures`, three `fixtures/lineups`, three `fixtures/players` and three `fixtures/events`. Combined programme accounting is 48 provider calls: EIA-2I2 37 plus EIA-2I3 11. Final safely observed headers reported 100 daily allowance, 65 remaining and 10 requests/minute. No raw response was persisted.

League Cup fixture `1287651` returned two lineups, 11 starters and nine substitutes per team, two player-stat team records containing 40 player rows, 28 events and nine substitutions. Explicit bench players who had no substitution-on event remained present in `fixtures/players` with direct `games.minutes: null`, not zero and not an omitted row. This proves a listed unused player must remain unknown unless another qualified fact proves non-appearance; it must not be converted to zero minutes or `not_used`.

The same fixture retained `PEN` plus provider elapsed 120. Under the corrected contract that evidence normalizes to `authoritativeDurationMinutes: null` and `extraTime: null` unless an independent fixture-specific qualification exists. The re-fetch supported same-session technical correction comparison only; it does not establish long-term stability.

FA Cup fixture `1373151` returned two lineups, 11 starters and nine substitutes per team, two player-stat team records containing 40 player rows, 15 events and six substitutions. Its explicit unused bench players followed the same player-row-present/direct-minutes-null representation. Neither selected closeout fixture exposed a red-card event.

Historical 2024/25 FA Cup and League Cup detail is structural evidence, not completed 2026/27 proof. Current-date EIA-2I2 discovery exposed 2026/27 UEL, FA Cup and League Cup fixtures, while free season-wide 2026 queries were rejected. Completed/current 2026/27 workload detail, a live dismissal example and independently verified FPL player mapping remain unproven.

## Competition closeout

| Competition | Discovery | XI | Bench | Appearance | Direct minutes | Events | Duration / ET | Provider identity | FPL mapping | Free viability |
|---|---|---|---|---|---|---|---|---|---|---|
| UCL | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | PASS |
| UEL | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | PASS | PARTIAL | PASS |
| UECL | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | PASS |
| FA Cup | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | PASS | PARTIAL | PASS |
| League Cup | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | PASS | PARTIAL | PASS |

`PARTIAL` duration means safe unknown behavior exists but every competition/round combination has not been empirically qualified. `PARTIAL` FPL mapping means provider IDs are stable and the repository mapping contract is deterministic, but no mapping was accepted from display name alone and a live Official-FPL corroboration set was not built in this checkpoint.

## Verdict, rights and exclusions

Overall provider verdict remains **CONDITIONALLY QUALIFIED** for prospective shadow workload evidence. Direct-minute suitability is unchanged: qualified endpoints supply direct minutes, including above 90 in genuine AET samples, but missing values remain unknown and events never reconstruct minutes. Remaining bounded work is completed 2026/27 detail plus pre-verified FPL mapping evidence.

Live use stayed within `owner_risk_accepted_private_use`: official API, one user, private non-commercial research, no resale, redistribution, public feed or raw-payload warehouse. Credential-bearing requests used only `x-apisports-key` to the pinned API-Football HTTPS origin with redirects disabled. No second account or paid plan was used.

No collector, Worker, Cron, D1 change, deployment, model input, fatigue coefficient, expected-minutes rule, projection, recommendation, UI or predictive-value claim is included. Nothing here approves production influence or merge.

## Verification

Focused EIA-2I1/EIA-2I3 and documentation verification passed 28/28. Full repository verification passed 2,027/2,027 with zero failures, skips or cancellations. The production build reproduced twice using the recorded build commit; both runs were byte-identical to each other and to tracked `dist/app.bundle.js`, `dist/index.html`, `dist/manifest.json` and root `index.html`, with root/deployable equality. API-Football remains absent from generated application artefacts and production imports.

## Next approval gate

Proposed **EIA-2I4 — Completed 2026/27 Workload and FPL Mapping Closeout**: after suitable target matches finish, acquire one bounded completed 2026/27 domestic-cup sample and one UEFA sample, prove a revisioned FPL player/team mapping with non-name corroboration, and re-evaluate remaining `PARTIAL` cells. Exclude collector implementation, persistence, scheduling, deployment, model influence and public/commercial use.
