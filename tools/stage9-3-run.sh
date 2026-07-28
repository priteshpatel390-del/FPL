#!/usr/bin/env bash
set -euo pipefail

BRANCH='agent/stage9-3-player-detail-uncertainty'
SOURCE_SHA='40dde666fc776e0fdcf1bab6c8dad30138825d08'
ARTEFACT_SHA='ae7f7f35bd69c17686e776b97d416d4be56ae8df'

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'

python - <<'PY'
from pathlib import Path

SOURCE='40dde666fc776e0fdcf1bab6c8dad30138825d08'
ARTEFACT='ae7f7f35bd69c17686e776b97d416d4be56ae8df'

def replace_once(path, old, new, label):
    p=Path(path); text=p.read_text()
    if old not in text:
        raise SystemExit(f'{label} marker not found in {path}')
    p.write_text(text.replace(old,new,1))

def prepend_once(path, marker, addition, token):
    p=Path(path); text=p.read_text()
    if token in text:
        return
    if marker not in text:
        raise SystemExit(f'prepend marker not found in {path}')
    p.write_text(text.replace(marker,marker+addition,1))

replace_once('CLAUDE.md',
"Stage 9.1 is merged into `main` through PR #17 at `9f4333e3f2e8d71d02355389f8c7d2115d3d17e4`. Checkpoint 9.2 — Team pitch and shirts is implemented and verified on draft PR #18 from branch `agent/stage9-2-pitch-shirts`: portrait model-selected XI, repository-owned CSS shirts, clear captain/vice treatment and preserved bench order. Verified source `38bb08e2e8f903deeb39dc4e1a4db070da4d4870` passes **288/288** tests with deterministic builds; generated artefacts are committed at `a806ccc0`. No model, provider, simulation or optimiser behaviour changed. Owner review and explicit merge approval remain required. Checkpoint 9.3 must not begin before 9.2 is merged, and its descriptive uncertainty spread-label thresholds remain separately gated for owner approval.",
"Stage 9.2 is merged into `main` through PR #18 at `4cbbe588697845677e6aef5992e15f13f47c6281`. Checkpoint 9.3 — Player detail and uncertainty is implemented and verified on draft PR #20 from branch `agent/stage9-3-player-detail-uncertainty`. Tapping a player opens a mobile bottom sheet or desktop side panel with decision summary, expected minutes, confidence/source, P25–P75 and expanded P10–P90 ranges, outcome probabilities and the preserved projection breakdown. Owner-approved spread labels are Tight ≤2.0, Moderate >2.0–5.0 and Wide >5.0 points; labels are suppressed in pre-season and for reduced-quality inputs. Verified source `40dde666fc776e0fdcf1bab6c8dad30138825d08` passes **295/295** tests with deterministic builds; generated artefacts are committed at `ae7f7f35bd69c17686e776b97d416d4be56ae8df`. No model, provider, simulation, squad, captaincy or optimiser behaviour changed. Owner review and explicit merge approval remain required before checkpoint 9.4.",
'CLAUDE checkpoint')

replace_once('docs/PROJECT_CONTEXT.md',
"- Stages 1–8 and Stage 9 checkpoint 9.1 are complete and merged.\n- Stage 9.1 merged through PR #17 at `9f4333e3f2e8d71d02355389f8c7d2115d3d17e4`, establishing Team, Players, Transfers and More with Team as the default landing screen.\n- Stage 9.2 — Team pitch and shirts is implemented and verified on draft PR #18 with 288 passing tests, successful deterministic builds, narrow-iPhone summary polish and owner review still required.",
"- Stages 1–8 and Stage 9 checkpoints 9.1–9.2 are complete and merged.\n- Stage 9.2 merged through PR #18 at `4cbbe588697845677e6aef5992e15f13f47c6281`, adding the portrait team pitch, repository-owned shirts and narrow-iPhone summary polish.\n- Stage 9.3 — Player detail and uncertainty is implemented and verified on draft PR #20 with 295 passing tests and deterministic builds; owner review and explicit merge approval remain required.",
'project current status')
replace_once('docs/PROJECT_CONTEXT.md',
"Completed: Stage 1 characterisation/audit, SEC-1, Stage 2 modularisation, repository handover, Stage 3 security/provider hardening, Stage 4 expected minutes, Stage 5 scoring corrections, Stage 6 transfer optimiser, Stage 7 walk-forward backtest, Stage 8 uncertainty/squad simulation and Stage 9.1 app shell.\n\nCurrent: Stage 9.2 implementation and owner review on draft PR #18. It presents the unchanged model-selected XI on a portrait pitch with repository-owned CSS shirts and clear model-selected captain/vice treatment.\n\nNext after Stage 9.2 merge: Stage 9.3 player detail and uncertainty presentation. Descriptive spread-label thresholds require separate owner approval before implementation.",
"Completed: Stage 1 characterisation/audit, SEC-1, Stage 2 modularisation, repository handover, Stage 3 security/provider hardening, Stage 4 expected minutes, Stage 5 scoring corrections, Stage 6 transfer optimiser, Stage 7 walk-forward backtest, Stage 8 uncertainty/squad simulation, Stage 9.1 app shell and Stage 9.2 pitch/shirts.\n\nCurrent: Stage 9.3 implementation and owner review on draft PR #20. Player taps open an accessible bottom sheet on mobile and side panel on desktop, presenting existing deterministic projections, expected-minutes outputs and Stage 8 uncertainty without changing their formulas.\n\nNext after Stage 9.3 merge: Stage 9.4 temporary decision previews for captaincy and transfer plans, with preview state kept separate from model recommendations and persistence.",
'project completed/current/next')

replace_once('docs/ARCHITECTURE.md',
"  ui/                    app shell, visual-only team-pitch helpers, views, restricted Markdown and security wiring",
"  ui/                    app shell, visual-only team-pitch helpers, player-detail controller, views, restricted Markdown and security wiring",
'architecture ui tree')
replace_once('docs/ARCHITECTURE.md',
"The bundler flattens application modules in a fixed, explicit order. Stage 8 modules are bundled after deterministic scoring and before downstream squad/transfer consumers. `ui/team-pitch.mjs` is bundled after the Stage 9 app shell and before the main views so its pure visual helpers are available without owning selection logic. Direct ES imports remain the source/test contract. The build rejects surviving module syntax and requires unique top-level names in the flattened scope.",
"The bundler flattens application modules in a fixed, explicit order. Stage 8 modules are bundled after deterministic scoring and before downstream squad/transfer consumers. `ui/team-pitch.mjs` remains visual-only; `ui/player-detail.mjs` is bundled before the main views and owns the dialog controller plus pure presentation helpers. `ui/views.mjs` composes those helpers with existing model outputs. Direct ES imports remain the source/test contract. The build rejects surviving module syntax and requires unique top-level names in the flattened scope.",
'architecture build boundary')
replace_once('docs/ARCHITECTURE.md',
"`ui/app-shell.mjs` owns the four primary destinations. `ui/team-pitch.mjs` owns only deterministic visual grouping and repository-owned shirt palettes. `ui/views.mjs` continues to call the existing `bestXI()` and projection functions, then renders those unchanged results onto the portrait pitch. Captain and vice badges represent the first two distinct players from the existing captain ranking; no formula or persisted squad state is changed.",
"`ui/app-shell.mjs` owns the four primary destinations. `ui/team-pitch.mjs` owns only deterministic visual grouping and repository-owned shirt palettes. `ui/player-detail.mjs` owns open/close behaviour, Escape handling, focus restoration/trapping, approved spread-label thresholds and range positioning; it does not calculate projections or simulation samples. `ui/views.mjs` calls the existing projection, expected-minutes and Stage 8 simulation functions, then renders their unchanged outputs in the portrait pitch and player detail panel. Captain/vice, squad and persisted state remain unchanged.",
'architecture stage9 boundary')
replace_once('docs/ARCHITECTURE.md',
"The single inline production script and style are SHA-256 hash locked by CSP. Stage 9.2 adds no provider, storage or secret surface.",
"The single inline production script and style are SHA-256 hash locked by CSP. Stage 9.3 adds no provider, storage or secret surface; the approved inline-style concession remains until checkpoint 9.6.",
'architecture security')
replace_once('docs/ARCHITECTURE.md',
"Characterisation tests execute the built production bundle. Direct imports cover formulas and contracts. Stage 8 adds player-simulation and squad-simulation suites. Stage 9.2 adds direct visual-helper tests for formation grouping, captain/vice identity and deterministic shirt palettes. Build tests directly exercise module stripping. Goldens may change only for approved user-visible consequences and final verification runs without regeneration.",
"Characterisation tests execute the built production bundle. Direct imports cover formulas and contracts. Stage 8 adds player-simulation and squad-simulation suites. Stage 9.2 covers formation grouping, captain/vice identity and deterministic shirt palettes. Stage 9.3 adds direct tests for exact spread thresholds, unavailable/reduced-quality suppression, range positioning, official availability labels, dialog semantics, Escape/focus restoration and removal of the legacy inline drawer. Build tests directly exercise module stripping. Goldens may change only for approved user-visible consequences and final verification runs without regeneration.",
'architecture testing')

road=Path('docs/ROADMAP.md'); text=road.read_text()
completed_marker="""- **Checkpoint 9.1 — App shell and primary navigation** · DONE and merged through PR #17 at `9f4333e3f2e8d71d02355389f8c7d2115d3d17e4`.
  - Four primary destinations: Team, Players, Transfers and More.
  - Team is the default landing screen; existing supporting tools are regrouped under More.
  - Verified baseline: **284/284 tests passed**, successful build and deterministic build checks.
"""
completed_add=completed_marker+"""- **Checkpoint 9.2 — Team pitch and shirts** · DONE and merged through PR #18 at `4cbbe588697845677e6aef5992e15f13f47c6281`.
  - Portrait pitch, repository-owned CSS shirts, captain/vice treatment and preserved bench order.
  - Verified source `38bb08e2e8f903deeb39dc4e1a4db070da4d4870`: **288/288 tests passed** with deterministic builds.
"""
if completed_marker not in text: raise SystemExit('roadmap completed marker missing')
text=text.replace(completed_marker,completed_add,1)
start=text.index('## Current')
end=text.index('## Upcoming')
current="""## Current
- **Stage 9 — UI integration** · approved design in `docs/STAGE9-DESIGN.md`.
- **Checkpoint 9.3 — Player detail and uncertainty** · implemented and verified on draft PR #20; owner review and explicit merge approval remain.
  - Mobile bottom sheet and desktop side panel replace the legacy inline table drawer.
  - Existing expected-minutes outputs, confidence/source, P25–P75, P10–P90 and outcome probabilities are presented without formula changes.
  - Approved labels: Tight ≤2.0, Moderate >2.0–5.0 and Wide >5.0 points; labels are suppressed in pre-season and for reduced-quality inputs.
  - Verified source `40dde666fc776e0fdcf1bab6c8dad30138825d08`: **295/295 tests passed**, successful build, deterministic two-build comparison and build-identity check.
  - Verified generated deployables committed at `ae7f7f35bd69c17686e776b97d416d4be56ae8df`.

"""
text=text[:start]+current+text[end:]
text=text.replace("1. **Checkpoint 9.3 — Player detail and uncertainty** · only after 9.2 is merged; spread-label thresholds require separate owner approval.\n2. **Checkpoint 9.4 — Decision previews** · temporary captain/vice and transfer-plan previews.\n3. **Checkpoint 9.5 — Settings and Provider Health integration**.\n4. **Checkpoint 9.6 — Inline-style migration, CSP tightening and final UI polish**.",
"1. **Checkpoint 9.4 — Decision previews** · temporary captain/vice and transfer-plan previews.\n2. **Checkpoint 9.5 — Settings and Provider Health integration**.\n3. **Checkpoint 9.6 — Inline-style migration, CSP tightening and final UI polish**.")
old_blockers="""## Current blockers
1. Owner review and explicit merge approval for Stage 9.2 draft PR #18.
2. Descriptive uncertainty spread-label thresholds remain unapproved for checkpoint 9.3.
3. Free historical odds and other missing pre-deadline provider snapshots require prospective 2026/27 logging.
4. Live-season prospective data requirements begin with GW1 on 21 August 2026.
"""
new_blockers="""## Current blockers
1. Owner review and explicit merge approval for Stage 9.3 draft PR #20.
2. Browser-level visual regression tooling is not yet present; final mobile/desktop appearance still needs human review.
3. Free historical odds and other missing pre-deadline provider snapshots require prospective 2026/27 logging.
4. Live-season prospective data requirements begin with GW1 on 21 August 2026.
"""
if old_blockers not in text: raise SystemExit('roadmap blockers marker missing')
road.write_text(text.replace(old_blockers,new_blockers,1))

replace_once('docs/STAGE9-DESIGN.md',
"- P25–P75 is the main compact range.\n- P10–P90 appears in expanded detail.\n- Numeric thresholds for descriptive spread labels such as stable, moderate range and high variance are **not approved**.\n- Those thresholds must return to Pritesh for separate approval during checkpoint 9.3 before being encoded.",
"- P25–P75 is the main compact range.\n- P10–P90 appears in expanded detail.\n- Pritesh approved the presentation labels on 28 July 2026: **Tight** for widths ≤2.0 points, **Moderate** for widths >2.0 and ≤5.0 points, and **Wide** for widths >5.0 points.\n- Labels describe modelled spread only; they are not accuracy or calibration claims.\n- Descriptive labels are suppressed in pre-season and when Stage 8 reports reduced-quality inputs, while available numeric ranges may still be shown with an explicit warning.",
'stage9 uncertainty approval')
replace_once('docs/STAGE9-DESIGN.md',
"- Add mobile bottom-sheet and desktop side-panel player detail.\n- Present expected minutes, confidence and approved uncertainty ranges.\n- Return descriptive spread-label thresholds to Pritesh for approval before implementation.",
"- Add mobile bottom-sheet and desktop side-panel player detail.\n- Present expected minutes, confidence and approved uncertainty ranges.\n- **Implemented and verified on draft PR #20:** accessible dialog behaviour, preserved projection breakdown, exact approved labels and pre-season/reduced-quality safeguards; no model formula changed.",
'stage9 checkpoint 9.3')

p=Path('docs/DECISIONS.md'); text=p.read_text().replace('Last updated: 2026-07-26.','Last updated: 2026-07-28.',1)
if 'D-19 · 2026-07-28' not in text:
    text += """

**D-19 · 2026-07-28 · Accepted · Stage 9.3 uncertainty labels are presentation-only absolute widths**
Reason: percentage spreads behave poorly when a player median is near zero, while absolute FPL-point widths remain understandable and comparable. Pritesh approved Tight ≤2.0 points, Moderate >2.0–5.0 points and Wide >5.0 points. Labels are suppressed when detailed simulation is unavailable in pre-season or input quality is reduced; the UI states that simulations are model-conditional and not externally calibrated. Consequences: `ui/player-detail.mjs` owns only the presentation categorisation. Stage 8 sampling, percentiles, probability thresholds, expected-minutes logic, projections, captaincy, squad selection and optimisation remain unchanged.
"""
p.write_text(text)

change=Path('docs/CHANGELOG.md'); text=change.read_text()
entry=f"""
## [Stage 9.3] — 2026-07-28 — Player detail and uncertainty
### Added
- Accessible mobile bottom sheet and desktop side panel opened from the pitch, Players table and all-15 squad table.
- Decision summary, expected minutes, start/appearance/60-minute probabilities, confidence/source, compact P25–P75 and expanded P10–P90 ranges.
- Blank, return, haul and mega-haul probabilities with explicit model-conditional wording.
- Owner-approved Tight/Moderate/Wide presentation labels and safeguards for pre-season and reduced-quality inputs.
- Seven focused tests, including exact 2.0/5.0 boundaries, dialog focus/Escape behaviour and official doubtful-status presentation.
### Changed
- Replaced the legacy inline player-table breakdown row while preserving the existing projection component breakdown inside the new detail surface.
- Pitch players and all-15 rows are now keyboard-focusable player-detail triggers.
### Verification
- Verified source commit `{SOURCE}`.
- Full suite: **295/295 passing**.
- Production build succeeded; deterministic two-build comparison and exact build-identity checks passed.
- Verified generated artefacts committed at `{ARTEFACT}`.
### Unchanged
- No projection, expected-minutes, scoring, fixture, simulation, best-XI, captaincy, bench, transfer-optimiser, provider, storage or security formula/behaviour changed.
- No prediction-accuracy or probability-calibration claim.
### Status
- Implemented and verified on draft PR #20; awaiting owner review and explicit merge approval.

"""
if '## [Stage 9.3]' not in text:
    text=text.replace('Last updated: 2026-07-28. Related: STAGE_HISTORY.md for engineering detail.\n',
                      'Last updated: 2026-07-28. Related: STAGE_HISTORY.md for engineering detail.\n'+entry,1)
text=text.replace('- Implemented and verified on draft PR #18; awaiting owner review and explicit merge approval.',
                  '- Merged through PR #18 at `4cbbe588697845677e6aef5992e15f13f47c6281`.',1)
change.write_text(text)

history=Path('docs/STAGE_HISTORY.md'); text=history.read_text()
history_entry=f"""
## Stage 9.3 — Player detail and uncertainty (IMPLEMENTED AND VERIFIED 2026-07-28; awaiting merge)
Replaced the legacy inline Players-table drawer with an accessible mobile bottom sheet and desktop side panel. The detail surface composes existing expected-points, expected-minutes and Stage 8 simulation outputs into a decision summary, compact P25–P75 range, expanded P10–P90 detail, outcome probabilities and the preserved scoring-component explanation. Pitch players and squad/player rows open the same surface; Escape closes it and focus returns to the trigger.

Pritesh approved presentation-only spread labels: Tight ≤2.0, Moderate >2.0–5.0 and Wide >5.0 points. Labels are suppressed in pre-season and for reduced-quality inputs. Review caught and corrected a wording defect where a 50% officially doubtful player could have appeared “Unavailable”; official doubtful status now remains Doubtful without changing the availability factor used by the model.

Verified source `{SOURCE}`: **295/295 tests passed**, production build succeeded, two builds were byte-identical and build identity passed. Verified generated artefacts were committed at `{ARTEFACT}`. No projection, expected-minutes, simulation, captaincy, squad or optimiser formula changed. PR #20 remains unmerged pending owner approval.

## Stage 9.2 — Team pitch and shirts (MERGED 2026-07-28)
Added the portrait pitch, repository-owned CSS shirts, captain/vice treatment and narrow-iPhone summary polish while preserving the existing model-selected XI and bench order. Verified 288/288 tests and deterministic builds; merged through PR #18 at `4cbbe588697845677e6aef5992e15f13f47c6281`.

"""
if '## Stage 9.3 — Player detail and uncertainty' not in text:
    marker='Related: STAGE1.md, STAGE2.md, STAGE3-DESIGN.md, STAGE4-DESIGN.md, STAGE5-DESIGN.md, STAGE6-DESIGN.md, STAGE7-DESIGN.md, AUDIT.md.\n'
    if marker not in text: raise SystemExit('history marker missing')
    text=text.replace(marker,marker+history_entry,1)
history.write_text(text)

known=Path('docs/KNOWN_LIMITATIONS.md'); text=known.read_text()
row="| UI-1 | No browser-level screenshot/visual-regression suite | Automated tests verify DOM structure, accessibility helpers and deterministic output, but final responsive appearance still requires human device review | Stage 9.6 | Open |\n"
if '| UI-1 |' not in text:
    marker='| OPS-1 | Full repository tree was not committed |'
    if marker not in text: raise SystemExit('known limitations marker missing')
    text=text.replace(marker,row+marker,1)
known.write_text(text)

replace_once('docs/TESTING.md',
"Stage 7 merged baseline: **274/274 passing tests**, successful production build, deterministic two-build comparison and build-identity checks.\n\nStage 8 draft PR #16 adds ten direct tests, taking the current verified branch baseline to **284/284 passing tests**. A branch-only workflow also verifies a deterministic two-build comparison. Verified generated artefacts are committed from the successful workflow; the temporary workflow is removed in the same finalisation commit.",
"Stage 9.3 verified branch baseline: **295/295 passing tests**, successful production build, deterministic two-build comparison and exact build-identity checks. Verified source is `40dde666fc776e0fdcf1bab6c8dad30138825d08`; generated artefacts are committed at `ae7f7f35bd69c17686e776b97d416d4be56ae8df`.",
'testing baseline')
replace_once('docs/TESTING.md',
"14. `build-bundle.test.mjs` — generated-bundle guard plus direct fixture tests for import/export stripping and surviving module syntax.",
"14. `player-detail.test.mjs` — Stage 9.3 spread thresholds, quality suppression, range geometry, official availability labels, dialog accessibility/focus and surface wiring.\n15. `build-bundle.test.mjs` — generated-bundle guard plus direct fixture tests for import/export stripping and surviving module syntax.",
'testing suites')
replace_once('docs/TESTING.md',
"Stage 8 changes no deterministic projection formula and requires no golden regeneration.",
"Stages 8 and 9.3 change no deterministic projection formula and require no golden regeneration.",
'testing golden note')
PY

git add CLAUDE.md docs/PROJECT_CONTEXT.md docs/ARCHITECTURE.md docs/ROADMAP.md docs/STAGE9-DESIGN.md docs/DECISIONS.md docs/CHANGELOG.md docs/STAGE_HISTORY.md docs/KNOWN_LIMITATIONS.md docs/TESTING.md
git rm -f --ignore-unmatch .github/workflows/stage9-3-diagnostic.yml .github/workflows/stage9-3-smoke.yml .stage9-3-result .stage9-3-run .stage9-3-smoke tools/stage9-3-run.sh
git commit -m 'Document and clean Stage 9.3 review branch'
git push origin HEAD:"$BRANCH"
