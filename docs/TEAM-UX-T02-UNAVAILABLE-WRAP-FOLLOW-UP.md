# T-02 iPhone availability-wrap follow-up

## Outcome

Physical iPhone Safari review after PR #82 confirmed that the reserve goalkeeper display order and horizontal availability centring were corrected, but the `Unavailable` label wrapped mid-word on the narrow four-column bench.

## Approved scope

Presentation only: keep unavailable/suspended bench badges on one centred line at iPhone widths by reducing their mobile badge typography/padding. The general availability row remains centred, and longer doubtful wording keeps its existing wrapping behaviour.

## Explicit exclusions

No changes to squad selection, `bestXI()`, bench calculation, projections, expected minutes, captaincy, transfers, fixtures, providers, persistence, Mini Leagues or Worker behaviour.

## Validation

A focused regression requires the narrow-mobile `.bench-player .pitch-availability.out` rule to use single-line wrapping. The finalizer proved that regression failed against the pre-fix CSS before applying the correction, then the exact final PR #83 head `990a85eb69319064038be458081d029d8a3b8828` passed **652 tests, 0 failed, 0 skipped, 0 cancelled** and deterministic double-build verification. PR #83 merged at `385e5102c0e86e4b926503bffceba08bd6d831c3` and GitHub Pages deployed that merge successfully. Pritesh then physically confirmed on normal iPhone Safari that `Unavailable` remained centred on one line without overlap while the corrected GK/outfield bench ordering remained intact. The physical acceptance gate is complete.
