# T-02 iPhone availability-wrap follow-up

## Outcome

Physical iPhone Safari review after PR #82 confirmed that the reserve goalkeeper display order and horizontal availability centring were corrected, but the `Unavailable` label wrapped mid-word on the narrow four-column bench.

## Approved scope

Presentation only: keep unavailable/suspended bench badges on one centred line at iPhone widths by reducing their mobile badge typography/padding. The general availability row remains centred, and longer doubtful wording keeps its existing wrapping behaviour.

## Explicit exclusions

No changes to squad selection, `bestXI()`, bench calculation, projections, expected minutes, captaincy, transfers, fixtures, providers, persistence, Mini Leagues or Worker behaviour.

## Validation

A focused regression is added to require the narrow-mobile `.bench-player .pitch-availability.out` rule to use single-line wrapping. The finalizer proves that regression fails against the pre-fix CSS before applying the correction, then runs the complete test suite and deterministic double build. Physical iPhone acceptance remains required after deployment.
