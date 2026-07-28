# Stage 6 implementation notes

This branch implements the owner-approved Transfer Optimiser design. Verification is performed through the temporary branch/PR workflow because the execution environment cannot clone GitHub directly.

Current implementation scope:
- versioned transfer rules and model/rules version bump
- pure transfer optimiser module
- complete zero-to-three move search
- squad legality, position quotas and club rules
- selling-price, shared-bank, free-transfer and hit calculations
- per-Gameweek best-XI horizon scoring
- deterministic plan ordering
- zero-transfer baseline and fail-closed evaluation limit
- Stage 6 transfer-view integration
- dedicated direct-module tests

This record must be replaced with final test counts, exact verified commit identity and remaining limitations after the workflow passes. The temporary verification workflow must be removed before merge.
