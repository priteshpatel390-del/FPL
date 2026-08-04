# Teamsheet 2.0.6 — Research, Evidence and Diagnostics Organisation

Status: complete and merged through PR #65 at merge commit `cd1ad52ea4d13a247a82bc90f80f2db0b6f77aa4`.
Approval: implementation scope approved 4 August 2026; merge explicitly approved 4 August 2026.
Parent checkpoint: Teamsheet 2.0.5 — Mini-League Intelligence.
Reviewed source commit: `72bb55d484d3033a859ee51f2c3f3e7aa6bc55e6`.
Generated-build branch head: `0402e66d53ad470bea81117a59ca64accc57902f`.
Generated source hash: `146431ec24cf7bedcf205a4495ee515baa02643dca099b868cb1e8c8a8b67f5c`.
Model version: `2.4.0`.
Rules version: `2026-27.3`.
Verified baseline: **520 passed, 0 failed, 0 skipped**; deterministic exact-identity production builds; root `index.html` equals `dist/index.html`.
Next formal checkpoint: Teamsheet 2.0.7 — Final Mobile Polish and Acceptance. It must begin with investigation and design only; implementation requires explicit owner approval.

## Objective

Finish organising advanced and technical content so ordinary weekly FPL decisions remain quick and uncluttered while research, evidence, provider detail, recovery and help remain fully available through Settings.

## Implemented information architecture

Settings retains the five approved sections and gives each user goal a route-owned landing and child destinations.

### Team & Account

- `#/settings/team-account`
- `#/settings/team-account/manual-squad`
- `#/settings/team-account/connection`

Team ID, bank, free transfers, load status and manual-mode choice remain on Team because they affect weekly decisions. Manual squad construction and connection guidance live under Settings. Saved-league guidance links to Leagues rather than duplicating competitive controls.

### Research Tools

- `#/settings/research`
- `#/settings/research/players`

Player Explorer remains outside primary navigation. Its existing ranking and Player Detail behaviour are unchanged. Narrow screens use stacked result cards rather than forcing the full desktop-width table into the phone viewport.

### Evidence & Performance

- `#/settings/evidence`
- `#/settings/evidence/deadline`
- `#/settings/evidence/outcomes`
- `#/settings/evidence/metrics`
- `#/settings/evidence/review`
- `#/settings/evidence/exports`

Deadline evidence, Official FPL outcomes, descriptive metrics, operating review and owner-controlled exports are separated by purpose. Existing record schemas, hashes, storage and export formats are unchanged.

### Data & Diagnostics

- `#/settings/data`
- `#/settings/data/providers`
- `#/settings/data/optional-sources`
- `#/settings/data/calibration`
- `#/settings/data/recovery`
- `#/settings/data/storage`

Provider Health, Odds/Understat controls, the existing deadline-safe historical diagnostic, recovery imports, integrity diagnostics and dataset-specific deletion controls are separated. Recovery imports remain recovery-only. Deleting local records does not remove downloaded files.

### Help & About

- `#/settings/help`
- `#/settings/help/recommendations`
- `#/settings/help/uncertainty`
- `#/settings/help/limitations`
- `#/settings/help/privacy`
- `#/settings/help/about`
- `#/settings/help/operations`

The application now explains recommendation boundaries, expected points and uncertainty, current limitations, local data handling, live-season operations and the actual generated model/rules/commit/source identity.

## Explicit mount ownership

Evidence modules no longer infer their destination from sibling order or `parentElement` chains. The shell creates explicit hosts for:

- outcomes;
- metrics;
- operating review;
- snapshot/outcome/review exports;
- snapshot/outcome recovery;
- recovery diagnostics;
- snapshot/outcome/metric deletion.

This changes UI ownership only. Snapshot, outcome, metric and review engines remain unchanged.

## Provider Health and material warnings

Healthy Provider Health does not occupy the header. Full Live, Cached, Stale, Fallback, Partial, Disabled and Unavailable detail remains under Settings → Data & Diagnostics → Provider Health.

Primary warnings are consequence-led:

- Live, Partial and deliberately Disabled optional-source states remain Settings-only where the current action is still valid.
- Cached, Stale or Fallback core Official FPL data produces one plain-English saved-data warning with age and a link to Provider Health.
- Team retains its existing recommendation-risk priority.
- Transfers, Fixtures and Leagues show the core warning beside the affected journey.
- No usable core data remains a blocking state where the route requires it.

No provider state, threshold, transport, retry, fallback or calculation changed.

## Routing, history and accessibility

- Legacy Players routes still resolve to Player Explorer; More still resolves to Settings.
- Unknown nested Settings routes fall back to the nearest valid subsection landing.
- Routes contain no Team, league, manager, API-key, evidence-record or snapshot identifier.
- Each route owns one exact focusable heading.
- Browser history remains hash-based.
- Parent-aware Back controls return to the correct subsection.
- The opener is remembered so Back restores focus to the relevant Settings card where possible.
- Hidden routes remain outside the accessibility tree.
- Blocking states use alerts; background status remains polite.
- Settings inputs and actions use the 44-pixel touch-target contract.

## Explicit exclusions

- Team Home redesign;
- Transfers redesign or optimiser change;
- Fixtures redesign or fixture calculation change;
- Leagues or Mini-League intelligence change;
- Player Detail redesign;
- watchlist or player-comparison persistence;
- projected global rank or rival outcomes;
- remaining-player simulation;
- effective-ownership or differential strategy;
- protect, balanced or chase logic;
- new providers, origins, endpoints or data sources;
- provider transport changes;
- evidence, metric or export schema changes;
- automatic Google Sheets integration;
- model, expected-minutes, scoring, squad, captaincy or transfer calculation changes;
- Teamsheet 2.0.7 final-polish work.

## Verification evidence

- Tests: **520 passed, 0 failed, 0 skipped**.
- Existing model, optimiser, league, evidence and security suites remain green.
- New tests cover route hierarchy, nearest-parent fallbacks, explicit mount ownership, export/recovery/deletion separation, Help/About content, warning materiality, identifier-free routes, mobile Player Explorer metadata and focus restoration.
- Headless Chromium smoke checks cover direct Settings deep links, exact heading focus, active Settings navigation, parent/back focus restoration, explicit module mounts, duplicate-ID absence and saved-data warnings.
- Production builds were deterministic and byte-identical for the exact reviewed source identity.
- Root `index.html` equals `dist/index.html`.
- Model remains `2.4.0`; rules remain `2026-27.3`.
- No provider, data source, model, fixture, scoring, squad, captaincy, simulation, optimiser, rank or Mini-League calculation changed.

## Acceptance limitations

Physical testing of the actual repository build on an iPhone Safari was not performed. VoiceOver acceptance was not performed. Live populated-data acceptance was not performed. The environment browser smoke check is not equivalent to iPhone Safari, one-handed use, real VoiceOver reading order or live Official FPL transport acceptance.

These are outstanding acceptance limitations for Teamsheet 2.0.7; they do not reopen the completed 2.0.6 implementation scope. Teamsheet 2.0.7 must begin with investigation and design only, and implementation requires explicit owner approval.
