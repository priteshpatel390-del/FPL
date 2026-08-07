# UX-A2 Player Detail dock-layering follow-up

Status: **Implemented, automatically verified, physically accepted on iPhone Safari and approved for merge.**

## Owner-reported defect

On 7 August 2026, Pritesh confirmed that the merged UX-A2 scrolling and rotation behaviour worked, but found that the fixed primary navigation dock covered the final line of **How the projection is built** until the sheet was dragged farther upward.

The defect was a stacking-order conflict rather than missing content padding: the final primary-dock rule used `z-index:1000`, while the Player Detail backdrop and panel used `38` and `39`.

## Approved correction

- branch: `agent/ux-a2-player-detail-dock-layering`
- base `main`: `2f2930de125cbb63600aa9514123f516d8b9e188`
- verified source commit: `44154da4190d35b6d6b747f537c19a060892bc14`
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

### SHA-256 generated outputs

```
f9767d31bb0a5ed4d9dd4f32dd1a1f6869168905bf27a0528d94969a2c1806ab  dist/app.bundle.js
ef5c649ef78a008b32d933aa7fe285433f7d3fa9ce4afa0a67bba7fce41f4ca4  dist/index.html
e45bd5a60ceba14e3049c6a5197bb26a0946931f62eb218205377760c3d12caf  dist/manifest.json
ef5c649ef78a008b32d933aa7fe285433f7d3fa9ce4afa0a67bba7fce41f4ca4  index.html
```

## Physical iPhone acceptance

On 7 August 2026, Pritesh retested the deployed populated preview in Safari and confirmed the defect was fixed. He then explicitly approved PR #78 for merge.

The accepted check confirmed that the final projection line was no longer covered by the primary dock. The previously accepted Player Detail scrolling and rotation behaviour remained satisfactory. VoiceOver was not a project acceptance gate.

## Explicit exclusions

No Player Detail information was removed or rearranged. No navigation sizing, route, projection, expected-minutes, fixture, scoring, squad, captaincy, simulation, transfer, rank, Mini-League, provider, data source, persistence, security, Cloudflare or Pages configuration changed.
