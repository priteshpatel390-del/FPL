# UX-A2 Player Detail dock-layering follow-up

Status: **Physically accepted and merged through PR #78.**

This file is the authoritative canonical record for the PR #78 dock-layering correction. `UX-A2-MERGE-RECORD.md` remains authoritative for the preceding original PR #76 UX-A2 scroll-and-rotation checkpoint.

## Merged checkpoint

- pull request: #78, **Fix Player Detail layering above the primary dock**
- merged `main`: `ebb8838e7bfd081371a0639c9b4bdacfc9b92bc6`
- accepted PR head: `d0b193aee88ad78e5206454d386b70bcec8b3d7c`
- branch: `agent/ux-a2-player-detail-dock-layering`
- base `main`: `2f2930de125cbb63600aa9514123f516d8b9e188`
- verified implementation source: `44154da4190d35b6d6b747f537c19a060892bc14`
- physical acceptance: populated iPhone Safari passed on 7 August 2026
- automated result: **645 passed, 0 failed, 0 skipped, 0 cancelled**
- deterministic production builds: passed
- root/deployable equality: passed
- GitHub Pages deployment: succeeded from the merged PR #78 checkpoint
- Cloudflare Workers production build: succeeded for `teamsheet-fpl-gateway`
- limitation status: `UI-14` closed

## Owner-reported defect

On 7 August 2026, Pritesh confirmed that the merged UX-A2 scrolling and rotation behaviour worked, but found that the fixed primary navigation dock covered the final line of **How the projection is built** until the sheet was dragged farther upward.

The defect was a stacking-order conflict rather than missing content padding: the final primary-dock rule used `z-index:1000`, while the Player Detail backdrop and panel used `38` and `39`.

## Approved correction

- Player Detail backdrop: `z-index:1010`
- Player Detail panel: `z-index:1011`
- fixed primary dock: unchanged at `z-index:1000`

The backdrop now covers the dock and the panel remains above the backdrop. The existing dialog content, safe-area padding, internal scrolling, closing, focus restoration, route behaviour and all FPL calculations are unchanged.

## Verification

- focused regression before correction: failed for the expected dock-over-modal ordering
- focused regression after correction: **21 passed, 0 failed**
- complete suite: **645 passed, 0 failed, 0 skipped, 0 cancelled**
- two production builds using exact `BUILD_COMMIT=44154da4190d35b6d6b747f537c19a060892bc14`: byte-identical
- root `index.html`: byte-identical to `dist/index.html`
- golden/model expectations: unchanged

### Generated-output identity

The merged PR verification demonstrated deterministic byte-identical production builds and root `index.html` equality with `dist/index.html`. A duplicated SHA-256 list previously recorded in this follow-up conflicted with the merged PR record, so that list is deliberately removed rather than treated as authoritative or replaced with guessed values. The deterministic-build and root/deployable-equality evidence above remains the canonical generated-output verification for this correction.

## Physical iPhone acceptance

On 7 August 2026, Pritesh retested the deployed populated preview in Safari and confirmed the defect was fixed. He then explicitly approved PR #78 for merge.

The accepted check confirmed that the final projection line was no longer covered by the primary dock. The previously accepted Player Detail scrolling and rotation behaviour remained satisfactory. VoiceOver was not a project acceptance gate.

## Merge and deployment result

PR #78 subsequently merged to `main` at `ebb8838e7bfd081371a0639c9b4bdacfc9b92bc6`. GitHub Pages deployment succeeded from that merged checkpoint, and the Cloudflare Workers production build succeeded for `teamsheet-fpl-gateway`. The merge closes `UI-14`.

## Explicit exclusions

No Player Detail information was removed or rearranged. No navigation sizing, route, projection, expected-minutes, fixture, scoring, squad, captaincy, simulation, transfer, rank, Mini-League, provider, data source, persistence, security, Cloudflare or Pages configuration changed.

This correction does not approve UX-A3, Track B, a concise-Player-Detail redesign, provider changes, data-source changes or any model/calculation change.