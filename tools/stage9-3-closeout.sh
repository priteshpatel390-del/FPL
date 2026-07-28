#!/usr/bin/env bash
set -euo pipefail

BRANCH='agent/stage9-3-player-detail-uncertainty-v2'
SOURCE='455e1e1eb143485fd68c3c52d622ef23f9e21c83'
ARTEFACT='3fe0c3467bb451e350f05311420cbe8aa9f81c52'
MERGE_92='4cbbe588697845677e6aef5992e15f13f47c6281'

if grep -q "$SOURCE" CLAUDE.md && grep -q 'Checkpoint 9.3 — Player detail and uncertainty is implemented' CLAUDE.md; then
  echo 'Stage 9.3 documentation already recorded.'
else
python - <<'PY'
from pathlib import Path

SOURCE='455e1e1eb143485fd68c3c52d622ef23f9e21c83'
ARTEFACT='3fe0c3467bb451e350f05311420cbe8aa9f81c52'
MERGE_92='4cbbe588697845677e6aef5992e15f13f47c6281'


def replace_once(path, old, new, label):
    p=Path(path); text=p.read_text()
    if old not in text:
        raise SystemExit(f'{label} marker not found in {path}')
    p.write_text(text.replace(old,new,1))

# CLAUDE onboarding
replace_once('CLAUDE.md',
"Stage 9.1 is merged into `main` through PR #17 at `9f4333e3f2e8d71d02355389f8c7d2115d3d17e4`. Checkpoint 9.2 — Team pitch and shirts is implemented and verified on draft PR #18 from branch `agent/stage9-2-pitch-shirts`: portrait model-selected XI, repository-owned CSS shirts, clear captain/vice treatment and preserved bench order. Verified source `38bb08e2e8f903deeb39dc4e1a4db070da4d4870` passes **288/288** tests with deterministic builds; generated artefacts are committed at `a806ccc0`. No model, provider, simulation or optimiser behaviour changed. Owner review and explicit merge approval remain required. Checkpoint 9.3 must not begin before 9.2 is merged, and its descriptive uncertainty spread-label thresholds remain separately gated for owner approval.",
f"Stage 9.2 is merged into `main` through PR #18 at `{MERGE_92}`. Checkpoint 9.3 — Player detail and uncertainty is implemented and verified on draft PR #22 from branch `agent/stage9-3-player-detail-uncertainty-v2`: accessible mobile bottom sheet/desktop side panel, existing expected-minutes outputs, P25–P75/P10–P90 ranges and approved Tight/Moderate/Wide labels. Verified source `{SOURCE}` passes **294/294** tests with deterministic builds; generated artefacts are committed at `{ARTEFACT}`. No projection, expected-minutes, simulation, squad, captaincy or optimiser behaviour changed. Owner review and explicit merge approval remain required. Checkpoint 9.4 must not begin before 9.3 is merged.",
'CLAUDE checkpoint')

# Project context
replace_once('docs/PROJECT_CONTEXT.md',
"- Stages 1–8 and Stage 9 checkpoint 9.1 are complete and merged.\n- Stage 9.1 merged through PR #17 at `9f4333e3f2e8d71d02355389f8c7d2115d3d17e4`, establishing Team, Players, Transfers and More with Team as the default landing screen.\n- Stage 9.2 — Team pitch and shirts is implemented and verified on draft PR #18 with 288 passing tests, successful deterministic builds, narrow-iPhone summary polish and owner review still required.",
f"- Stages 1–8 and Stage 9 checkpoints 9.1–9.2 are complete and merged.\n- Stage 9.2 merged through PR #18 at `{MERGE_92}`, adding the portrait pitch, repository-owned shirts and narrow-iPhone summary polish with the existing squad logic unchanged.\n- Stage 9.3 — Player detail and uncertainty is implemented and verified on draft PR #22 with 294 passing tests, deterministic builds and owner review still required.",
'project current status')
replace_once('docs/PROJECT_CONTEXT.md',
"Completed: Stage 1 characterisation/audit, SEC-1, Stage 2 modularisation, repository handover, Stage 3 security/provider hardening, Stage 4 expected minutes, Stage 5 scoring corrections, Stage 6 transfer optimiser, Stage 7 walk-forward backtest, Stage 8 uncertainty/squad simulation and Stage 9.1 app shell.\n\nCurrent: Stage 9.2 implementation and owner review on draft PR #18. It presents the unchanged model-selected XI on a portrait pitch with repository-owned CSS shirts and clear model-selected captain/vice treatment.\n\nNext after Stage 9.2 merge: Stage 9.3 player detail and uncertainty presentation. Descriptive spread-label thresholds require separate owner approval before implementation.",
"Completed: Stage 1 characterisation/audit, SEC-1, Stage 2 modularisation, repository handover, Stage 3 security/provider hardening, Stage 4 expected minutes, Stage 5 scoring corrections, Stage 6 transfer optimiser, Stage 7 walk-forward backtest, Stage 8 uncertainty/squad simulation and Stage 9 checkpoints 9.1–9.2.\n\nCurrent: Stage 9.3 implementation and owner review on draft PR #22. It replaces the inline player drawer with an accessible mobile bottom sheet/desktop side panel and presents the existing minutes and uncertainty outputs without changing their formulas.\n\nNext after Stage 9.3 merge: Stage 9.4 temporary captain/vice and transfer-plan previews.",
'project completed/current/next')

# Architecture
replace_once('docs/ARCHITECTURE.md',
"  ui/                    app shell, visual-only team-pitch helpers, views, restricted Markdown and security wiring",
"  ui/                    app shell, team-pitch and player-detail presentation, views, restricted Markdown and security wiring",
'architecture directory')
replace_once('docs/ARCHITECTURE.md',
"The bundler flattens application modules in a fixed, explicit order. Stage 8 modules are bundled after deterministic scoring and before downstream squad/transfer consumers. `ui/team-pitch.mjs` is bundled after the Stage 9 app shell and before the main views so its pure visual helpers are available without owning selection logic. Direct ES imports remain the source/test contract. The build rejects surviving module syntax and requires unique top-level names in the flattened scope.",
"The bundler flattens application modules in a fixed, explicit order. Stage 8 modules are bundled after deterministic scoring and before downstream squad/transfer consumers. `ui/team-pitch.mjs` and `ui/player-detail.mjs` are bundled after the Stage 9 app shell and before the main views. They own visual grouping, descriptive range labelling and accessible sheet/panel state without owning selection or model logic. Direct ES imports remain the source/test contract. The build rejects surviving module syntax and requires unique top-level names in the flattened scope.",
'architecture build boundary')
replace_once('docs/ARCHITECTURE.md',
"`ui/app-shell.mjs` owns the four primary destinations. `ui/team-pitch.mjs` owns only deterministic visual grouping and repository-owned shirt palettes. `ui/views.mjs` continues to call the existing `bestXI()` and projection functions, then renders those unchanged results onto the portrait pitch. Captain and vice badges represent the first two distinct players from the existing captain ranking; no formula or persisted squad state is changed.",
"`ui/app-shell.mjs` owns the four primary destinations. `ui/team-pitch.mjs` owns only deterministic visual grouping and repository-owned shirt palettes. `ui/player-detail.mjs` owns the accessible bottom-sheet/side-panel controller and the approved absolute P25–P75 width labels: Tight ≤2.0, Moderate >2.0–5.0 and Wide >5.0 points. `ui/views.mjs` consumes existing `bestXI()`, expected-minutes and simulation outputs for display only. Descriptive labels are suppressed in pre-season and for reduced-quality inputs; no formula, persisted state or model recommendation is changed.",
'architecture Stage 9 boundary')
replace_once('docs/ARCHITECTURE.md',
"Dynamic provider/user strings use DOM builders; AI output uses a restricted Markdown AST. Odds requests remain direct-only and diagnostics are scrubbed. The single inline production script and style are SHA-256 hash locked by CSP. Stage 9.2 adds no provider, storage or secret surface.",
"Dynamic provider/user strings use DOM builders; AI output uses a restricted Markdown AST. Odds requests remain direct-only and diagnostics are scrubbed. The single inline production script and style are SHA-256 hash locked by CSP. Stage 9.3 adds no provider, storage, persistence or secret surface.",
'architecture security')
replace_once('docs/ARCHITECTURE.md',
"Characterisation tests execute the built production bundle. Direct imports cover formulas and contracts. Stage 8 adds player-simulation and squad-simulation suites. Stage 9.2 adds direct visual-helper tests for formation grouping, captain/vice identity and deterministic shirt palettes. Build tests directly exercise module stripping. Goldens may change only for approved user-visible consequences and final verification runs without regeneration.",
"Characterisation tests execute the built production bundle. Direct imports cover formulas and contracts. Stage 8 adds player-simulation and squad-simulation suites. Stage 9.2 adds visual-helper tests. Stage 9.3 adds exact threshold-boundary, unavailable/reduced-quality, deterministic range-position, dialog accessibility/focus and structural-wiring tests. Build tests directly exercise module stripping. Goldens may change only for approved user-visible consequences and final verification runs without regeneration.",
'architecture testing')

# Roadmap: add 9.2 completion and replace current/upcoming/blockers
replace_once('docs/ROADMAP.md',
"- **Checkpoint 9.1 — App shell and primary navigation** · DONE and merged through PR #17 at `9f4333e3f2e8d71d02355389f8c7d2115d3d17e4`.\n  - Four primary destinations: Team, Players, Transfers and More.\n  - Team is the default landing screen; existing supporting tools are regrouped under More.\n  - Verified baseline: **284/284 tests passed**, successful build and deterministic build checks.",
f"- **Checkpoint 9.1 — App shell and primary navigation** · DONE and merged through PR #17 at `9f4333e3f2e8d71d02355389f8c7d2115d3d17e4`.\n  - Four primary destinations: Team, Players, Transfers and More.\n  - Team is the default landing screen; existing supporting tools are regrouped under More.\n  - Verified baseline: **284/284 tests passed**, successful build and deterministic build checks.\n- **Checkpoint 9.2 — Team pitch and shirts** · DONE and merged through PR #18 at `{MERGE_92}`.\n  - Portrait pitch, repository-owned shirts, captain/vice treatment and preserved bench order.\n  - Verified baseline: **288/288 tests passed**, successful build and deterministic build checks.",
'roadmap completed 9.2')
replace_once('docs/ROADMAP.md',
"## Current\n- **Stage 9 — UI integration** · approved design in `docs/STAGE9-DESIGN.md`.\n- **Checkpoint 9.2 — Team pitch and shirts** · implemented and verified on draft PR #18; owner review and explicit merge approval remain.\n  - Portrait football pitch presents the unchanged model-selected XI.\n  - Repository-owned CSS shirts use deterministic club palettes with safe fallbacks.\n  - Model-ranked captain and vice-captain are marked directly on the pitch; bench order is preserved.\n  - Verified source commit `38bb08e2e8f903deeb39dc4e1a4db070da4d4870`: **288/288 tests passed**, successful build, deterministic two-build comparison and build-identity check.\n  - Generated deployables committed at `a806ccc0`.\n  - No projection, minutes, scoring, fixture, simulation, squad, optimiser or provider behaviour changed.\n\n## Upcoming\n1. **Checkpoint 9.3 — Player detail and uncertainty** · only after 9.2 is merged; spread-label thresholds require separate owner approval.\n2. **Checkpoint 9.4 — Decision previews** · temporary captain/vice and transfer-plan previews.\n3. **Checkpoint 9.5 — Settings and Provider Health integration**.\n4. **Checkpoint 9.6 — Inline-style migration, CSP tightening and final UI polish**.\n\n## Current blockers\n1. Owner review and explicit merge approval for Stage 9.2 draft PR #18.\n2. Descriptive uncertainty spread-label thresholds remain unapproved for checkpoint 9.3.\n3. Free historical odds and other missing pre-deadline provider snapshots require prospective 2026/27 logging.\n4. Live-season prospective data requirements begin with GW1 on 21 August 2026.",
f"## Current\n- **Stage 9 — UI integration** · approved design in `docs/STAGE9-DESIGN.md`.\n- **Checkpoint 9.3 — Player detail and uncertainty** · implemented and verified on draft PR #22; owner review and explicit merge approval remain.\n  - Mobile bottom sheet and desktop side panel replace the legacy inline player drawer.\n  - Existing expected-minutes, confidence/source, P25–P75/P10–P90 and outcome probabilities are presented without changing model logic.\n  - Approved labels: Tight ≤2.0, Moderate >2.0–5.0 and Wide >5.0 P25–P75 points; labels are suppressed in pre-season and for reduced-quality inputs.\n  - Verified source commit `{SOURCE}`: **294/294 tests passed**, successful build, deterministic two-build comparison and build-identity check.\n  - Generated deployables committed at `{ARTEFACT}`.\n\n## Upcoming\n1. **Checkpoint 9.4 — Decision previews** · temporary captain/vice and transfer-plan previews.\n2. **Checkpoint 9.5 — Settings and Provider Health integration**.\n3. **Checkpoint 9.6 — Inline-style migration, CSP tightening and final UI polish**.\n\n## Current blockers\n1. Owner review and explicit merge approval for Stage 9.3 draft PR #22.\n2. Free historical odds and other missing pre-deadline provider snapshots require prospective 2026/27 logging.\n3. Live-season prospective data requirements begin with GW1 on 21 August 2026.",
'roadmap current block')

# Stage 9 design decision
replace_once('docs/STAGE9-DESIGN.md',
"- Numeric thresholds for descriptive spread labels such as stable, moderate range and high variance are **not approved**.\n- Those thresholds must return to Pritesh for separate approval during checkpoint 9.3 before being encoded.",
"- Descriptive labels use absolute P25–P75 width: **Tight ≤2.0 points**, **Moderate >2.0–5.0 points** and **Wide >5.0 points**, approved by Pritesh on 28 July 2026.\n- Labels are suppressed in pre-season and for reduced-quality simulation inputs. They are presentation categories, not probability-calibration or accuracy claims.",
'Stage 9 uncertainty approval')
replace_once('docs/STAGE9-DESIGN.md',
"- Add mobile bottom-sheet and desktop side-panel player detail.\n- Present expected minutes, confidence and approved uncertainty ranges.\n- Return descriptive spread-label thresholds to Pritesh for approval before implementation.",
"- Add mobile bottom-sheet and desktop side-panel player detail.\n- Present expected minutes, confidence and approved uncertainty ranges.\n- Apply the approved Tight/Moderate/Wide P25–P75 width labels, suppressing them in pre-season and for reduced-quality inputs.\n- Preserve the existing projection breakdown and keep the sheet/panel presentation-only.",
'Stage 9.3 checkpoint detail')

# Testing
replace_once('docs/TESTING.md',
"Stage 7 merged baseline: **274/274 passing tests**, successful production build, deterministic two-build comparison and build-identity checks.\n\nStage 8 draft PR #16 adds ten direct tests, taking the current verified branch baseline to **284/284 passing tests**. A branch-only workflow also verifies a deterministic two-build comparison. Verified generated artefacts are committed from the successful workflow; the temporary workflow is removed in the same finalisation commit.",
f"Stage 9.2 merged baseline: **288/288 passing tests**, successful production build, deterministic two-build comparison and build-identity checks.\n\nStage 9.3 draft PR #22 adds six direct tests, taking the verified branch baseline to **294/294 passing tests**. Verified source `{SOURCE}` produced byte-identical builds and generated artefacts committed at `{ARTEFACT}`.",
'Testing baseline')
replace_once('docs/TESTING.md',
"14. `build-bundle.test.mjs` — generated-bundle guard plus direct fixture tests for import/export stripping and surviving module syntax.",
"14. `player-detail.test.mjs` — Stage 9.3 threshold boundaries, unavailable/reduced-quality suppression, deterministic range positions, accessible dialog focus behaviour and structural player-surface wiring.\n15. `build-bundle.test.mjs` — generated-bundle guard plus direct fixture tests for import/export stripping and surviving module syntax.",
'Testing suite list')
replace_once('docs/TESTING.md',
"Stage 8 changes no deterministic projection formula and requires no golden regeneration.",
"Stages 8 and 9.3 change no deterministic projection formula and require no golden regeneration.",
'Testing golden note')
replace_once('docs/TESTING.md',
"Never delete or weaken a test to make a change pass. A green suite proves deterministic agreement with encoded contracts; it does not prove improved prediction accuracy or calibrated uncertainty. Stage 8 probability coverage must be evaluated prospectively during 2026/27 before any calibration claim.",
"Never delete or weaken a test to make a change pass. A green suite proves deterministic agreement with encoded contracts; it does not prove improved prediction accuracy or calibrated uncertainty. Stage 9.3 Tight/Moderate/Wide labels describe P25–P75 width only; probability coverage must still be evaluated prospectively during 2026/27 before any calibration claim.",
'Testing philosophy')

# Changelog prepend and 9.2 status correction
p=Path('docs/CHANGELOG.md'); text=p.read_text()
marker='## [Stage 9.2] — 2026-07-28 — Team pitch and shirts\n'
entry=f"""## [Stage 9.3] — 2026-07-28 — Player detail and uncertainty
### Added
- Accessible mobile bottom sheet and desktop right-side panel for player detail.
- Expected minutes, start/appearance/60-minute probabilities, confidence and source from the existing Stage 4 model.
- P25–P75 primary range, P10–P90 expanded range and existing blank/return/haul/mega-haul probabilities.
- Owner-approved descriptive widths: Tight ≤2.0, Moderate >2.0–5.0 and Wide >5.0 P25–P75 points.
- Six focused tests covering exact thresholds, pre-season/reduced suppression, deterministic range positions, dialog focus behaviour and player-surface wiring.
### Changed
- Players-table rows, pitch/bench players and the all-15 table now open one consistent detail surface; the legacy inline drawer is removed.
- Descriptive labels are suppressed in pre-season and for reduced-quality inputs, while numeric ranges remain available when credible.
### Verification
- Verified source commit `{SOURCE}`.
- Full suite: **294/294 passing**.
- Production build succeeded; deterministic two-build comparison and exact build-identity checks passed.
- Verified generated artefacts committed at `{ARTEFACT}`.
- No golden regeneration.
### Unchanged
- Projection, expected-minutes and simulation formulas; best-XI, captaincy, bench order, transfer optimisation, providers, storage and security behaviour.
- No probability-calibration or prediction-accuracy claim.
### Status
- Implemented and verified on draft PR #22; awaiting owner review and explicit merge approval.

"""
if entry not in text:
    if marker not in text: raise SystemExit('Changelog Stage 9.2 marker not found')
    text=text.replace(marker,entry+marker,1)
old='- Implemented and verified on draft PR #18; awaiting owner review and explicit merge approval.'
if old not in text: raise SystemExit('Changelog Stage 9.2 status marker not found')
text=text.replace(old,f'- Merged through PR #18 at `{MERGE_92}`.',1)
p.write_text(text)

# Stage history prepend
p=Path('docs/STAGE_HISTORY.md'); text=p.read_text()
history=f"""## Stage 9.3 — Player detail and uncertainty (IMPLEMENTED AND VERIFIED 2026-07-28; awaiting merge)
Replaced the legacy inline player-table drawer with one accessible responsive detail surface: a mobile bottom sheet and desktop right-side panel. Players can open it from the Players table, the Team pitch and bench, or the all-15 squad table. It presents the existing decision summary, expected-minutes outputs and confidence/source, P25–P75 and P10–P90 ranges, outcome probabilities and the existing projection-component explanation.

Pritesh approved absolute P25–P75 spread labels of Tight ≤2.0 points, Moderate >2.0–5.0 and Wide >5.0. Labels are deliberately suppressed in pre-season and for reduced-quality inputs. They describe model-conditional spread only and do not claim calibrated coverage or improved accuracy. Verified source `{SOURCE}` passed **294/294 tests**, successful production build, deterministic two-build comparison and build-identity checks; generated artefacts were committed at `{ARTEFACT}`. No projection, expected-minutes, simulation, best-XI, captaincy, bench or optimiser behaviour changed. Draft PR #22 remains behind owner review and explicit merge approval.

## Stage 9.2 — Team pitch and shirts (MERGED 2026-07-28)
Added the portrait pitch, repository-owned CSS shirt representations, direct captain/vice treatment and narrow-iPhone summary polish while preserving the existing model-selected XI and bench order. Verified baseline: 288/288 tests and deterministic builds. Merged through PR #18 at `{MERGE_92}`.

"""
marker='## Stage 7 — Walk-forward backtest'
if history not in text:
    if marker not in text: raise SystemExit('Stage history insertion marker not found')
    text=text.replace(marker,history+marker,1)
p.write_text(text)

# Decision D-19
p=Path('docs/DECISIONS.md'); text=p.read_text()
text=text.replace('Last updated: 2026-07-26.','Last updated: 2026-07-28.',1)
decision="""

**D-19 · 2026-07-28 · Accepted · Absolute descriptive uncertainty-width labels (Stage 9.3)**
Reason: the player-detail UI needs a compact description of the existing P25–P75 spread without implying that the simulator is externally calibrated. Decision: categorise absolute P25–P75 width as Tight at 2.0 points or less, Moderate above 2.0 through 5.0 points, and Wide above 5.0 points. Absolute widths are used instead of percentages because percentage spreads become unstable around low or zero medians. Wording deliberately avoids “stable” and “high variance”. Labels are suppressed in pre-season and whenever simulation input quality is `reduced`; numeric values may still be shown with the existing warning. Consequences: this is presentation-only, does not change any percentile or sample, and cannot be cited as an accuracy or probability-calibration claim.
"""
if '**D-19 ·' not in text: text=text.rstrip()+decision+'\n'
p.write_text(text)

# Known limitation row
p=Path('docs/KNOWN_LIMITATIONS.md'); text=p.read_text()
row='| UI-1 | Stage 9.3 Tight/Moderate/Wide labels are descriptive model-spread categories, not calibrated risk bands | Useful relative shorthand can be mistaken for validated probability coverage unless the accompanying caveat is preserved | Prospective 2026/27 validation | Open (accepted) |\n'
marker='| ODDS-2 | No free historical odds |'
if row not in text:
    if marker not in text: raise SystemExit('Known limitations insertion marker not found')
    text=text.replace(marker,row+marker,1)
p.write_text(text)
PY

  git add CLAUDE.md docs/PROJECT_CONTEXT.md docs/ARCHITECTURE.md docs/ROADMAP.md docs/STAGE9-DESIGN.md docs/TESTING.md docs/CHANGELOG.md docs/STAGE_HISTORY.md docs/DECISIONS.md docs/KNOWN_LIMITATIONS.md
  git commit -m 'Document Stage 9.3 implementation and verification'
fi

# Remove all temporary verification machinery before review.
git rm -f .github/workflows/stage9-3-verify.yml .stage9-3-result tools/stage9-3-run.sh tools/stage9-3-closeout.sh
git commit -m 'Remove temporary Stage 9.3 verification tooling'
git push origin HEAD:"$BRANCH"
