# STAGE_HISTORY.md — engineering diary
Purpose: permanent per-stage record. Audience: retrospective/context. Last updated: 2026-07-29.
Related: STAGE1.md, STAGE2.md, STAGE3-DESIGN.md, STAGE4-DESIGN.md, STAGE5-DESIGN.md, STAGE6-DESIGN.md, STAGE7-DESIGN.md, AUDIT.md.


## Stage 10.1 — Deadline-safe snapshot foundation (DRAFT PR #27; owner/device review pending)
The owner approved the complete Stage 10 design and 10.1–10.5 sequence. Stage 10.1 adds immutable anonymised pre-deadline records, official-deadline timing/leakage controls, provider/source provenance, all-player projections/minutes/uncertainty summaries, available squad/decision/optimiser context, whole-record and section hashes, bounded compressed local recovery and complete JSON export/import.

The first 620-player benchmark exposed a runtime above three minutes. Review preserved the approved 5,000 samples and removed repeated invariant fixture calculations, reducing the synthetic run to roughly 2.8–3.5 seconds in the repository environment. A later owner-approved amendment adds a minimalist startup gate, automatic startup/ten-minute foreground verification, a closed four-provider allowlist, deferred one-shot rendering, automatic eligible evidence capture and recovery-only imports. Verified source `73cdca817f7070a745fb642e1070d77a6bdaca9b` passes 349/349 tests with a successful production build, byte-identical two-build output and exact build identity. Physical iPhone startup/foreground/recovery acceptance remains pending. No formula, provider blend, calibration, captaincy, squad or optimiser objective changed. The work remains unmerged on draft PR #27 pending owner/device review.

## Stage 9.6 — Style migration, CSP and final polish (MERGED 2026-07-29)
Removed every static and generated style attribute and runtime style API from the production boundary. Fixed presentation now uses utility and club-palette classes; projection component bars use native progress elements; uncertainty geometry uses namespace-correct SVG attributes. The shared DOM helper rejects style input and the build fails closed if source or generated deployables contain style attributes/runtime style APIs.

The emitted CSP no longer contains `style-src-attr` or any `unsafe-inline`; the one inline style element remains exact-hash locked. Representative mobile and desktop browser review covered Team, player detail, More, Provider Health, Settings, Fixtures and Mini-league surfaces with zero console errors and zero application-created style attributes. Verified source `4a4b14c1d0f422088c080e714ee259efbd7cc39d`: **313/313 tests passed**, production build succeeded, two builds were byte-identical and build identity passed. Generated artefacts were committed at `7fb09142156a8061adc375a72bf3d7e2a1b25985`. No model, provider, storage, secret or optimiser behaviour changed. Merged through PR #25 at `c52f6f08f51bff5bfe7702bfec58265647afe439`, completing Stage 9.

## Stage 9.5 — More, Settings and Provider Health (MERGED 2026-07-29)
Reframed the existing setup surface as a clear Settings area under More and added a compact Provider Health control to the global header. Activating the compact control opens More and focuses a full detail panel showing every active provider's existing seven-state value, last-success age, note and consequence. The compact label deterministically surfaces the most consequential present state without creating a synthetic score.

The implementation is presentation-only. Provider registry transitions, staleness thresholds, transports, retries, validation, caches, fallbacks, odds-key hygiene and persisted configuration remain unchanged. Verified source `da8258df25e196af1f1521c025edefde23612abd`: **310/310 tests passed**, production build succeeded, two builds were byte-identical and build identity passed. Generated artefacts were committed at `5401f2882f72b70c7034157c2e3a686dab966c64`. Six focused tests cover compact modelling, age labels, state priority, palette reuse and shell wiring. Browser screenshot regression remained deferred to checkpoint 9.6. Merged through PR #24 at `a5ac5fcc12bb492948365851587d4e1cd2f30301`.

## Stage 9.4 — Temporary decision previews (MERGED 2026-07-29)
Added session-only transfer-plan and captain/vice previews while keeping the real squad, model recommendations and persisted state authoritative. Exact optimiser plans are applied to cloned squad entries and checked against `finalSquadIds`; the resulting temporary squad uses the unchanged `bestXI()` for pitch presentation. Preview captaincy remains distinct, supports role swapping and shows its uplift separately from the base XI score.

Preview state is invalidated by real-squad changes and by optimiser input or result changes. Review caught and fixed two stale-state gaps before completion: optimiser result values were added to the signature, and captain-only previews now clear when optimiser context changes. Verified source `849ff757c68c35e92744dc96efc34848110fa19e`: **304/304 tests passed**, production build succeeded, two builds were byte-identical and build identity passed. Generated artefacts were committed at `ed275d2a148d90d09836199f8d1485394d72b6f5`. No formula, storage, provider, security or FPL-write behaviour changed. Merged through PR #23 at `5e62f2f65d6e21d86ca3f0ef8dd0b7112fd4a8c8`.

## Stage 9.3 — Player detail and uncertainty (MERGED 2026-07-28)
Replaced the legacy inline Players-table drawer with an accessible mobile bottom sheet and desktop side panel. The detail surface composes existing expected-points, expected-minutes and Stage 8 simulation outputs into a decision summary, compact P25–P75 range, expanded P10–P90 detail, outcome probabilities and the preserved scoring-component explanation. Pitch players and squad/player rows open the same surface; Escape closes it and focus returns to the trigger.

Pritesh approved presentation-only spread labels: Tight ≤2.0, Moderate >2.0–5.0 and Wide >5.0 points. Labels are suppressed in pre-season and for reduced-quality inputs. Review caught and corrected a wording defect where a 50% officially doubtful player could have appeared “Unavailable”; official doubtful status now remains Doubtful without changing the availability factor used by the model.

Verified source `40dde666fc776e0fdcf1bab6c8dad30138825d08`: **295/295 tests passed**, production build succeeded, two builds were byte-identical and build identity passed. Verified generated artefacts were committed at `ae7f7f35bd69c17686e776b97d416d4be56ae8df`. No projection, expected-minutes, simulation, captaincy, squad or optimiser formula changed. Merged through PR #20 at `eb636d023bed6706f46f5a03366485ede9b15c89`.

## Stage 9.2 — Team pitch and shirts (MERGED 2026-07-28)
Added the portrait pitch, repository-owned CSS shirts, captain/vice treatment and narrow-iPhone summary polish while preserving the existing model-selected XI and bench order. Verified 288/288 tests and deterministic builds; merged through PR #18 at `4cbbe588697845677e6aef5992e15f13f47c6281`.

## Stage 7 — Walk-forward backtest (IMPLEMENTED AND VERIFIED 2026-07-28; awaiting merge)
Replaced the misleading live backtest presentation with a deterministic deadline-information-only walk-forward framework. The evaluator enforces chronological train/calibration/holdout separation, rejects future-information leakage and conflicting duplicates, calculates MAE, RMSE, bias and Pearson correlation, supports position/Gameweek/prediction-band segmentation and compares named ablations only on identical holdout keys.

The replay adapter pins the final 2025/26 vaastav archive commit `f9ed3e8839b0f970e0d5d4a83c5628f6eaee755a`, computes SHA-256 from the exact downloaded bytes, aggregates double Gameweeks to one player/Gameweek observation and counts malformed rows without manufacturing required values. Fold calibration is fitted only on each prior calibration window and never updates production `S.calib` or persisted projection settings. The legacy H1/H2 diagnostic remains only for regression comparison and is no longer presented as validated accuracy.

Verified source commit `42d3106fcb15f2e68db7409e0ae96fd27cd4f61a`: **274/274 tests passed**, production build succeeded, two builds were byte-identical and build-identity checks passed. Verified generated artefacts were committed at `d2f1e7d93cf200e5a1d6d1a2d96829e750740ff9`. Historical pre-deadline snapshots for Understat, odds, detailed minutes inputs and production fixture ratings do not exist; this remains an honest scoring diagnostic rather than full validation of every live production input. No prediction-accuracy improvement is claimed.

## Stage 5 — Scoring corrections (MERGED 2026-07-28)
Implemented the owner-approved 2026/27 scoring rulebook, deterministic Poisson grouped scoring for saves and goals conceded, defensive-contribution threshold probability, empirical awarded-bonus shrinkage, explicit rare disciplinary/penalty events, penalty-role gating and real blank/double fixture-run scoring. The public projection surface and downstream squad/captaincy/transfer contracts remained unchanged.

Review identified four justified corrections. The custom bundler now strips complete single-line and multi-line static imports and export lists, fails on unterminated declarations and rejects surviving module syntax; direct fixture tests guard the boundary. Aggregate bonus appearances now reuse the Stage 4 completed-match × aggregate-pAppear model rather than minutes/60. The fixture test now creates a genuine blank. Final verification no longer regenerates goldens.

Verified source commit `aee6d0fee7cc177622a046f37885b554013debbd`: 241/241 tests passing against committed goldens, deterministic two-build comparison passed and independent CSP verification passed. Generated artefacts embed that exact identity. Temporary workflow removed at `99d9cf8184589ef5ed79b8fdad2bff13a9f96552`. Merged through PR #9 at `68877333ebf13060e764b82b91dfc0c9752a78c8`. No accuracy improvement is claimed.

## Stage 4 — Expected minutes (MERGED 2026-07-28)
Replaced season-minutes/current-GW and GW-number denominators with completed-team fixtures, validated detailed current-season histories, recency weighting, aggregate/prior fallbacks and explicit pStart/pAppear/p60/expMin/confidence outputs. Official availability is applied once and scoring consumes the minutes boundary without circular dependency. Verified baseline: 220/220 tests and deterministic builds. Merged through PR #8 at `eb08c7af43a2e8040ea65064fc725ba8d1778882`.

## Stage 3.6 — AI/Markdown sanitisation (MERGED 2026-07-28)
Replaced the Ask surface's string-to-HTML Markdown path with a bounded, default-deny parser and DOM renderer. The supported subset is deliberately small: paragraphs, `##`/`###` headings, unordered lists, bold, italic and absolute HTTP(S) links. Raw HTML and unsupported Markdown remain inert text. Unsafe, relative, protocol-relative, encoded, entity-obscured and control-character URL targets are rejected while preserving visible labels.

Eight adversarial tests bring the suite from 194 to 202. GitHub Actions run `30336857903` passed the full `./run-tests.sh` step and deterministic two-build byte comparison. A temporary verification workflow was removed before merge, so no CI-policy change remains in the product diff. No model, provider, retry, key-handling, CSP, formula or visual-design behaviour changed.

## Stage 3.5 — DOM-builder rendering (MERGED 2026-07-28)
Introduced shared text-node-first DOM primitives and migrated the complete approved inventory:
gameweek/source/chip status, ticker and swing notes, player table and drawer, squad/captain/best-XI,
transfers, league output and controls, manual squad/search, core failure states and backtest output.
Hostile provider/user strings now become text nodes rather than HTML. Ask Markdown was explicitly
restored to its Stage 3.4 baseline because AI sanitisation belongs to separately approved Stage 3.6.
Five adversarial checks bring the suite from 189 to 194; formulas and golden results are unchanged.
The work landed through PR #3: implementation commit `138f2b826487c487733cd32546a577d515459646`,
merge commit `5623abb594159916b4041e6bd3c44be80f714ce7`. The recorded implementation run was
194/194 with deterministic builds; no GitHub Actions run is attached to the merge.

## Pre-stage era (v1.x, founding conversation)
Objective: working product. Changes: full app built iteratively (ticker → xP engine → transfers →
league → data layers → backtest → calibration → multi-league → persistence). Issues discovered &
fixed en route: availability discount missing from attacking returns (caught by synthetic tests);
bonus over-calibration; settings lost on failed load (save-on-input rewrite); GitHub Pages 404
(Index.html capitalisation); Claude-preview sandbox blocks network (moved to Pages). Lessons:
characterise before touching anything (→ Stage 1); test names must describe reality.

## Stage 1 — Characterisation & audit (DONE, owner-verified)
Objective: freeze behaviour; audit data stack. Changes: none to app. Files: tests/harness.mjs,
tests/characterisation.test.mjs, tests/golden.json, run-tests.sh, docs/AUDIT.md, docs/STAGE1.md.
Tests added: 77. Issues discovered: 13 (AUDIT §3) incl. SEC-1 key-via-relay, LEAK-1 calibration
leakage, MIN-1 minutes. Lessons: expected-to-change quarantine keeps honesty and refactor-safety
compatible. Outstanding: none (audit decisions delegated to owner).

## SEC-1 hot-fix (DONE, deployed)
Objective: stop the odds key transiting relays immediately. Changes: relay fallback removed from
loadOdds; degrade-to-internal-model note. Files: app.js (then src/providers/odds.mjs), tests/
sec1.test.mjs. Tests: +1 (fetch-spy). Lessons: security fixes ship separately from refactors.

## Stage 2 — Module extraction (DONE, owner-approved)
Objective: modular architecture without behaviour change. Changes: 17 src/ modules (verbatim moves
via tools/split.py + sanctioned edits: odds provenance/rules/kickoff-matching, slim() fixture
fields, cache envelope, pure computeBacktest + provenance, registry, escapeHTML). Files: src/**,
build.mjs, tests/unit.test.mjs, tests/resilience.test.mjs, README-BUILD.md. Tests: 96 total.
Issues discovered BY the suites during extraction: dropped final line of init IIFE (bundle syntax);
duplicate computeBacktest export; wrong relative import paths in generated headers; hydrate's DOM
touch breaking direct imports. All fixed same-stage. Lessons: the characterisation gate earned its
keep four times in one stage; generated code needs path tests. Outstanding: BT-1 pinning; views
module intentionally monolithic until Stage 9.

## Stage 3 — Security & hardening (DONE, merged 2026-07-28)
Design: docs/STAGE3-DESIGN.md (8 deliverables), approved with CSP intentionally specified last.
First implementation: D-13 fixture validation/deduplication in `hydrate()`; DUP-1 closed and suite
96 → 108. Second implementation (2026-07-27): SEC-3 closed — Anthropic key field, persistence,
key headers and hosted browser request removed; one-time stored-config migration added; keyless
Claude-preview path retained. Five focused tests bring the suite to 113. Third implementation:
D-14 per-endpoint schema validation, atomic hydrate and safe issue reporting; VAL-1 closed and suite
113 → 146. Fourth implementation: D-15 bounded transient-only retry with attempt/time ceilings and
normalised metadata for the health model; suite 146 → 179.

Fifth implementation: D-16 Provider Health. The Stage-2 boolean marker was replaced with Live,
Cached, Stale, Fallback, Partial, Disabled and Unavailable while retaining derived `ok` and
`usingFallback` fields for backwards compatibility. FPL, Understat and Odds now report distinct
consequences; provider-specific stale thresholds are derived on read; a compact strip is inserted
into the existing settings panel with DOM nodes. Ten tests bring the suite 179 → 189. The first CI
run correctly caught the removed `usingFallback` compatibility field; the field was restored as a
derived value rather than weakening the old test. Full suite and deterministic two-build comparison
then passed. Item was merged through PR #2.

Sixth implementation: Stage 3.5 DOM-builder rendering, recorded above. Seventh implementation:
Stage 3.6 AI/Markdown sanitisation, recorded above. Eighth implementation: odds-key hygiene and
hash-based CSP. The key is password-masked, omitted when empty, removable in one action and scrubbed
from diagnostics. The build emits and independently verifies SHA-256 hashes for the exact inline
script and style, with a hashed frame-buster compensating for GitHub Pages' inability to enforce
`frame-ancestors` via meta CSP. Eight focused tests bring the suite 202 → 210. Verified generated
`dist/` files were checked byte-for-byte against the successful build artefact and committed before
the temporary verification workflow was removed.

Stage 3 landed through PR #6 at merge commit `3f662b7e133ce2995da74c5e52165ae84744e120`.
The verified completion baseline is 210/210 tests passing, successful build and deterministic
two-build comparison. No projection, expected-minutes, scoring, fixture, captaincy, squad or
optimisation formula changed.

## Documentation stage (DONE, 2026-07-26)
Objective: repository becomes source of truth; conversation becomes disposable. Changes: /docs
system (12 files) + CLAUDE.md; no code. Lessons: a several-hundred-turn founding conversation is a
liability; decision records should have started at turn one.

## Stage 8 — Uncertainty and squad simulation
- Approved design recorded in `docs/STAGE8-DESIGN.md`.
- Added deterministic seeded player simulations, percentile/threshold summaries, legal auto-subs and captain-to-vice fallback.
- Deterministic `projectXP()` and transfer optimiser behaviour deliberately unchanged.
- Verified 284/284 tests, successful build and deterministic two-build comparison on source commit `${SOURCE_COMMIT}`.