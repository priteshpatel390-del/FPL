# GW1-P2C4 — Genuine GW1 Stage 10 Custody Reconciliation

**Outcome: GENUINE GW1 CLOUD CUSTODY NOT PRESENT**  
**Investigated:** 22 August 2026  
**Mode:** Read-only acceptance investigation

## Live baseline

- Live GitHub `main`: `337734bfa573091e44ebae1588050b5b755d9d14`.
- GW1-P2C3B remains the canonical transport-only PASS.
- Repository verification reproduced 971 tests: 971 passed, 0 failed, 0 skipped, 0 cancelled and 0 todo.
- Application: `https://app.fpltsheet.co.uk`.
- Archive: `https://archive.fpltsheet.co.uk`.
- The hosts are cross-origin and same-site.
- No repository commit after the approved handover SHA changed the Stage 10 archive, schema, outbox or custody contract.

## Read-only operations

The investigation performed only:

1. live GitHub `main` reference discovery;
2. repository and canonical-document inspection;
3. current Wrangler command-help inspection;
4. read-only deployed Worker binding inspection;
5. one D1 `SELECT` using the exact Stage 10 record ID; and
6. one metadata-only R2 listing restricted to the canonical 2026–27 GW1 prefix.

No browser application or browser storage was opened. No evidence body was read. No POST, replay, reconciliation, deployment, configuration change, D1/R2 write or destructive operation was performed.

## Target record

- Stage 10 ID: `predeadline-gw1-3fec5b2f1e134e52`.
- Season: `2026-27`.
- Gameweek: `1`.
- Origin recorded in canonical history: `local_capture`.
- Full 64-character content hash: **not found**.

The missing 48 hexadecimal characters were not inferred from the 16-character content-hash prefix embedded in the snapshot ID.

## D1 manifest

The exact lookup:

```sql
WHERE stage10_record_id = 'predeadline-gw1-3fec5b2f1e134e52'
```

returned zero rows.

- Row exists: **no**.
- Exactly one matching row: **no — zero rows**.
- Full content hash: unavailable.
- D1 R2 key: unavailable.
- D1 manifest custody: **not present**.

Wrangler reported that the query did not change the database and wrote zero rows.

## D1 receipt

No receipt query was performed. The approved sequence required a receipt lookup using the full content hash discovered from the manifest, and no manifest or full hash was found.

- Matching normal ingest receipt: **not established**.
- `subject_hash` was not selected or printed.

## R2 object

The metadata-only listing was restricted to:

```text
evidence/v1/preDeadlineSnapshot/2026-27/gw1/
```

It returned zero objects.

- Target object exists: **no**.
- Expected key: `evidence/v1/preDeadlineSnapshot/2026-27/gw1/{fullContentHash}.json.gz`.
- Actual key: none.
- Upload timestamp: unavailable.
- Stored size: unavailable.
- Custom metadata: unavailable because no object existed.
- Evidence body: not retrieved.

## D1 to R2 reconciliation

There was no D1/R2 pair to reconcile. Each comparison therefore failed its existence prerequisite; no contradictory values were observed.

| Check | Result |
|---|---|
| Content hash | FAIL — no D1 manifest or R2 candidate |
| Stage 10 ID | FAIL — target absent from both custody stores |
| R2 key | FAIL — no D1 key or actual object |
| Stored SHA-256 | FAIL — no values available |
| Byte size | FAIL — no values available |
| Upload timestamp | FAIL — no values available |
| Record type, schema, season, GW and origin | FAIL — no cloud records available to compare |

This is absence, not a D1/R2 integrity mismatch.

## Acceptance result

| Area | Result |
|---|---|
| Transport | **PASS** — previously established by GW1-P2C3B and not retested |
| Validation | **NOT PROVEN** |
| Genuine cloud custody | **NOT PRESENT** |
| Normal ingest receipt | **NOT PROVEN** |
| Browser delivery acknowledgement | **NOT VERIFIED** |
| Genuine duplicate idempotency | **NOT EXERCISED** |
| Genuine recovery | **NOT EXERCISED** |

Genuine duplicate idempotency was not separately exercised because it would add little unique evidence and would introduce unnecessary operational mutation.

## What this proves

The exact genuine Stage 10 ID has no canonical D1 manifest in the deployed evidence database. The canonical R2 season/Gameweek prefix contains no objects. Genuine GW1 Stage 10 Cloudflare custody is therefore not established and is not present under the approved custody contract.

This result does not invalidate GW1-P2C3B. That checkpoint proved browser transport capability only; custody of this genuine record is a separate claim.

## What remains unproven

- Whether the old GitHub Pages-origin outbox still contains the genuine record.
- Whether it attempted delivery and retained a failure state.
- Whether Safari received or persisted any archive acknowledgement.
- The original local 64-character content hash.
- Any byte-for-byte comparison between an original local hash and a cloud hash.
- The exact reason the record did not reach custody.

The old application was not opened because its normal startup, visibility and timer paths can schedule outbox delivery. Server absence must not be presented as proof of the browser's local delivery state.

## Security and privacy

No IP address, location, postcode, coordinates, ISP/network or ASN data, Access JWT, cookie, authenticated identity, Access audience, team-domain value, account identifier, authorization header, API token, secret, `subject_hash`, raw Worker log, raw Cloudflare response or evidence body is retained in this record.

## Next checkpoint and approval gate

The recommended next checkpoint is a separately approved **old-origin genuine evidence preservation and recovery decision**. It must first design and demonstrate a genuinely passive way to preserve or inspect the original `priteshpatel390-del.github.io` record and outbox without starting Teamsheet, scheduling delivery, mutating browser storage or transmitting genuine evidence.

Explicit owner approval is required before browser inspection, evidence export or recovery, genuine transmission, outbox replay, D1/R2 writes or reconciliation. None was performed in GW1-P2C4.
