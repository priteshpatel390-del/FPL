# Stage 6 approval record

Pritesh approved the Stage 6 Transfer Optimiser design before implementation.

Approved decisions:
- exact search of zero to three transfers
- mandatory zero-transfer baseline
- complete 15-player legality and position quotas
- inherited over-quota club handling that cannot worsen and repairs where possible
- exact selling prices when purchase prices are known; clearly labelled estimated mode otherwise
- pooled affordability across the complete plan
- four-point paid-transfer cost and official free-transfer rollover formula
- per-Gameweek legal best-XI scoring across the horizon
- captaincy excluded from the objective
- unavailable players excluded as purchases; doubtful players allowed with warnings
- 0.5-point terminal roll value, explicitly judgement-based and unvalidated
- deterministic ranking and fail-closed incomplete-search behaviour
- production safe pruning verified against an independent exhaustive reference
- pure optimiser module with UI rendering kept downstream

Implementation is verified on draft PR #14. Verified source commit `5181299c8773c118220bdd8c18e80eb053eaf592` passed 254/254 tests and deterministic two-build comparison. Generated artefacts were committed at `212b071687aa1ec6fc99e2006db824eb99291657`; the temporary workflow was removed at `026848dc5b11dded156e0e7fc873d5a457f59067`.

This approval authorised implementation only. Merge still requires Pritesh’s explicit review approval.