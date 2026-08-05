# Teamsheet 2.0.7 — Final Mobile Polish and Acceptance

Status: **complete and merged through PR #68 at `2f7e4ba6978ccd68e9d6c36b56d4063cea06beaf`; Safari foreground-resume retest passed, VoiceOver remains accepted-unverified and live populated-data moved to approved blocker FPL-1/FPL-T1.**
Approval: exact Scope S-2.0.7 approved by Pritesh on 4 August 2026.
Base commit: `0f9e6c879859a2584ab8d7b9d4879a84efbfaf5d`.
Model version: `2.4.0`.
Rules version: `2026-27.3`.
Automated baseline: **533 passed, 0 failed, 0 skipped**.
Reviewed source commit: `5a61ec5510c447580afa6070a5a9815516babe86`.
Generated-build commit: `71397382911a4e32633de15200ad59cfb26dc439`.

## Implemented scope

- native keyboard-operable Player Detail actions in Player Explorer and Team's All-15 table;
- native manual-squad search and removal controls;
- 44-pixel minimum target contract for active mobile controls;
- coherent no-core-data restricted states across Team, Transfers, Fixtures and Leagues;
- deterministic route heading focus, parent/browser return focus and per-route scroll restoration;
- Player Detail closure before route changes with safe focus fallback;
- honest hosted Ask unavailability, retained failed prompts, Retry, log/live-region semantics and latest-message scrolling;
- isolated Fixture render dependencies;
- table captions and heading scopes;
- exact Transfers no-hit, optimiser-limit and alternative-count wording;
- bounded responsive and safe-area corrections only.

## Preserved boundaries

No provider, endpoint, data source, model, fixture calculation, expected-minutes, scoring, squad, captaincy, simulation, optimiser, rank or Mini-League calculation changed. No framework, package dependency, service worker, backend, authentication or FPL account-write behaviour was introduced. Anthropic keys remain banned client-side.

## Automated verification

- `./run-tests.sh`: **533 passed, 0 failed, 0 skipped**;
- successful exact-source production build;
- two exact-identity builds were byte-identical;
- root `index.html` equals `dist/index.html`;
- manifest model/rules/commit/source identity verified;
- security, CSP, generated-file and no-account-write guards remain green.

## Acceptance still required

Teamsheet 2.0.7 is merged and its Safari foreground-resume defect passed physical owner retest. VoiceOver remains accepted-unverified. FPL-T1 has since established live Official FPL bootstrap transport on physical iPhone Safari through the owner-controlled Worker, but full populated Team, Transfers, Fixtures, Player Detail and Leagues acceptance remains open on draft PR #69.

## Physical iPhone Safari foreground-resume correction — 5 August 2026

Physical iPhone testing found that returning from another app could start another Official FPL refresh immediately after an unsuccessful startup attempt. Safari can emit both visibility and page-resume events; because only successful verification had been timestamped, every return remained eligible for another blocking retry.

Pritesh approved a narrow correction: every completed refresh attempt now starts the existing ten-minute automatic cooldown, paired resume events remain deduplicated by the in-flight promise, foreground refreshes no longer disable the app, and the manual **Load data** action continues to bypass the cooldown. No provider, endpoint, source, calculation, persistence schema or security boundary changed.

Automated verification for source `5a61ec5510c447580afa6070a5a9815516babe86` completed **533 passed, 0 failed, 0 skipped** with deterministic exact-identity builds and root/deployable equality.

Pritesh then retested the deployed PR build on a physical iPhone in Safari and reported that the app-switch return was working normally. This closes the specific foreground-resume defect. It does not by itself establish complete mobile-layout acceptance, VoiceOver acceptance or live populated-data acceptance.

## Explicit exclusions retained

No Team or Transfers redesign; no Player Detail data redesign; no new feature programme; no provider remedy; no projected rank, rival prediction, remaining-player simulation, differential strategy or protect/balanced/chase logic; no automatic Google Sheets integration; no calculation changes.
