# Team UX T-01 / T-02 merge and acceptance record

## Outcome

The Team populated-live acceptance sequence is complete through PR #83. At that checkpoint `main` was `385e5102c0e86e4b926503bffceba08bd6d831c3`; read the current `main` live with `git rev-parse origin/main`.

PR sequence:
- PR #80 — startup ownership and availability clarity — merged at `99c02593026ddd9f9ac99a21c413e9c996cea31b`.
- PR #81 — centred availability badges — merged at `2df2ec1ae46c094f74b10307aba399f7dc8384fb`.
- PR #82 — reserve-GK display slot and centred availability row — merged at `11102516f8bc2f9c5b81ffe4868f510aeb014a53`.
- PR #83 — narrow-iPhone one-line unavailable badge — merged at `385e5102c0e86e4b926503bffceba08bd6d831c3`.

## Automated evidence

The exact final PR #83 head `990a85eb69319064038be458081d029d8a3b8828` passed:
- **652 tests, 0 failed, 0 skipped, 0 cancelled**;
- two byte-identical exact-identity production builds;
- root `index.html` equality with `dist/index.html`;
- exact manifest build identity.

The final PR head and merge commit share Git tree `70b38bf4bf5b5bdb0f295fa6738554266441e62b`, so the tested branch content is the content merged to `main`. No test was deleted, weakened or skipped and no golden/model expectation changed.

GitHub Pages deployment for exact merge commit `385e5102c0e86e4b926503bffceba08bd6d831c3` completed successfully.

## Physical iPhone Safari acceptance

After deployment Pritesh physically accepted the populated Team path on normal iPhone Safari on 7 August 2026. He confirmed:
1. the startup/loading screen owns the viewport correctly;
2. availability status is visible for unavailable/doubtful players;
3. the reserve goalkeeper is displayed in the `GK` bench slot;
4. outfield substitutes retain their existing relative `1st` / `2nd` / `3rd` order;
5. `Unavailable` is horizontally centred;
6. `Unavailable` remains on one line on the narrow iPhone bench card;
7. no overlap with player name, fixture or xP was observed.

The final observed bench was Dúbravka — GK, Reinildo — 1st, Dasilva — 2nd and Baleba — 3rd, with Baleba's `Unavailable` badge centred on one line.

## Browser-storage clarification

Normal Safari retained and displayed the manually saved squad. Safari Private Browsing maintains separate browser storage, so a squad saved in normal Safari is not expected to appear in a private tab. The observed difference is therefore not currently classified as a Teamsheet persistence defect.

## Boundaries

The follow-ups are presentation-only. They do not alter projection, expected-minutes, scoring, fixture, best-XI, squad-selection, captaincy, transfer, simulation, rank, Mini-League, provider, data-source, persistence or security logic. The reserve goalkeeper change affects displayed bench order only; `bestXI()` and its calculated bench array remain unchanged.

## Next checkpoint

Team is complete in the current feature-specific populated live-acceptance sequence. The next approved work is **investigation-only populated live acceptance of Fixtures**, followed by Leagues. No Fixtures implementation or calculation change is approved by this record.
