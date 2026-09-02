# DATA-S2B production acceptance reconciliation — 2 September 2026

## Outcome

Production acceptance is **blocked at the exact-main protected read boundary**, not complete. Latest authoritative `main` is `80d37a9894d1e834434c83ac94f2c57045338bdb`; Verify Teamsheet run `33619346522` passed. Read-only preflight run `33620632272` passed its exact-main/Verify gate and, after protected-environment approval, stopped before D1 reads with `phase4b_preflight_active_version_drift`. It made no mutation. This is repository contract drift: successful deployment run `33433195713` promoted redirect-compatible Version `222e62d5-9979-468d-9c54-b97f903d58f6`, while the preflight still required predecessor `733093ef-e01f-43a8-828a-0c8c67e7626f`.

## Reconciled state and narrow correction

Upload run `33432353930` created Version `222e62d5-9979-468d-9c54-b97f903d58f6`; deployment run `33433195713` promoted it from predecessor `733093ef-e01f-43a8-828a-0c8c67e7626f`. The correction pins those active/rollback identities, records rather than guesses the response-created current Deployment ID, and replaces the obsolete failed-history-only D1 gate with a fail-closed populated-history contract. The contract requires the two known redirect failures, at least one completed populated Official FPL run, positive records seen, accepted counts bounded by seen counts, zero quarantine/rejection, observation totals equal the sum of completed accepted counts, and positive bounded heads. Provider, source, rights, season, bindings, hostname, Cron and health gates remain exact.

This correction does not establish baseline, unchanged, changed-fact, head-orphan, CPU, rows-read/written or storage acceptance. Those facts require a protected read from exact merged main. The workflow cannot execute branch code and intentionally requires current `main` plus exact-head Verify. Owner merge approval is therefore the genuine next gate; no merge is performed here.

## Phase 4 / 4B status at this checkpoint

| Area | Status | Evidence |
|---|---|---|
| production Worker version/deployment | PARTIAL | Upload `33432353930`; deployment `33433195713`; stale-contract failure `33620632272` proves predecessor pin is no longer active, but current Deployment response ID awaits corrected read |
| Cron/triggers and collector cadence | PASS | activation and prior preflight evidence; repository/live contract remains sole `*/30 * * * *` trigger with collection selected daily at `01:00 UTC` or bounded pre-deadline opportunity |
| collector fetch transport | PASS | deployed candidate is the `manual` redirect/reject-3xx remediation; deployment `33433195713` |
| Official bootstrap/fixtures, season, baseline, unchanged, changed fact | PENDING | protected D1 read was blocked before these facts in `33620632272` |
| D1 consistency, run bookkeeping and accounting | PENDING | corrected exact-main read required |
| CPU/resource suitability | PENDING | no accepted live CPU/rows evidence in current main records |
| rollback/stop evidence | PASS | predecessor retained as exact rollback; failed runs retained and collector failed closed; runs `33433195713`, `33620632272` |
| post-activation observability | PARTIAL | observability enabled and failures observable; final metrics evidence pending |
| provider/data/security boundaries | PASS | correction remains read-only; Official FPL only, fixed endpoints, shadow-only, no raw payload or credential output |
