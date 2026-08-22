# GW1-P2C5 — Stage 10 production-path acceptance closeout

**Outcome: PASS — synthetic infrastructure acceptance only**  
**Accepted and reconciled: 22 August 2026**

## Scope and boundary

One unmistakably synthetic `preDeadlineSnapshot` was exercised exactly once on a physical iPhone in normal Safari with Prevent Cross-Site Tracking enabled. The path was the production application at `https://app.fpltsheet.co.uk` through normal local Stage 10 storage, the normal `teamsheet:evidence-stored` listener, durable outbox and scheduled delivery to `https://archive.fpltsheet.co.uk`, then unchanged Worker validation, private R2, D1 manifest/receipt and browser terminal acknowledgement.

This proves the production infrastructure path for the declared synthetic fixture only. It is not genuine prospective evidence, does not prove natural Stage 10 capture, and cannot establish Official eligibility. Natural GW2 capture and Official eligibility remain separate future observational gates. Historic GW1 recovery remains parked and untouched.

## Physical browser result

Owner-supplied physical iPhone evidence recorded exactly once:

- browser terminal status: **Archived — Evidence is stored in the cloud archive.**
- acceptance-panel status: **Synthetic fixture stored locally. Normal background archive delivery has been scheduled.**
- `Run archive acceptance` was disabled after successful local creation.

No repeat, manual retry or duplicate submission was performed.

## Synthetic identity

- record type: `preDeadlineSnapshot`;
- schema: `1.0.0`;
- season/Gameweek: `2099-00` / GW38;
- origin: `local_capture`;
- timing: `client_recorded`;
- client Official eligibility: false;
- server pre-deadline qualification: false;
- snapshot ID: `predeadline-gw38-ae9149da8e77faaa`;
- content hash/idempotency key: `ae9149da8e77faaaf1f25400310de7f5c2e7a1c2f20c9645e7ba99a9fa3c4408`;
- R2 key: `evidence/v1/preDeadlineSnapshot/2099-00/gw38/ae9149da8e77faaaf1f25400310de7f5c2e7a1c2f20c9645e7ba99a9fa3c4408.json.gz`.

## Sanitized read-only reconciliation

An exact D1 manifest `SELECT`, exact accepted-receipt `SELECT` and metadata-only R2 listing were performed. Both D1 queries reported `changed_db:false`, zero changes and zero rows written. No evidence body, authentication identity or subject hash was selected or retained.

Exactly one D1 manifest matched both the full hash and snapshot ID. It recorded the identity above, canonical size 4,728 bytes, stored size 1,495 bytes, stored SHA-256 `70e03a4e13911faf96f2879197e5b706de59e8d69a018ab0f02af6279d50348c`, R2 upload time `2026-08-22T14:54:40.562Z`, and D1 creation time `2026-08-22T14:54:41.003Z`.

Exactly one receipt matched the same full hash as both idempotency key and content hash. Its result was `accepted` at `2026-08-22T14:54:41.003Z`.

Exactly one R2 object matched the complete key. Its metadata matched D1 for canonical hash, stored SHA-256, record type, snapshot ID, schema, season, Gameweek and origin; its size was 1,495 bytes and last-modified timestamp was `2026-08-22T14:54:40.562Z`. It was gzip-encoded JSON with `no-store` cache control. R2 preceded the D1 manifest/receipt by 441 ms, consistent with the unchanged R2-first/D1-second custody protocol.

The object body was not downloaded or independently rehashed during closeout. The unchanged ingest contract verifies stored bytes and decompressed canonical text before D1 commit; the matching R2/D1 integrity metadata and accepted receipt are the approved read-only reconciliation evidence.

## Repository and production disposition

The temporary candidate was exact head `1cff56a334cbf72e7aa23dc047a545c9baee87d6` on draft PR #143. After acceptance, GitHub Pages was restored to authoritative `main` `89c3d839209244c2c9fba155d92d7539fb55ffd4`; Pages build/deployment run `32580818414` succeeded and deployment `6038119851` records that exact `main` SHA. PR #143 was closed unmerged while its branch and PR history were retained. The temporary acceptance fixture, UI and foreign-season admission therefore are not part of canonical `main` or the restored production application.

The accepted synthetic D1 manifest, receipt and R2 object remain untouched as infrastructure-acceptance evidence. No replay, deletion, reconciliation write, Worker/Access/DNS/D1/R2 configuration change, historic GW1 action, model/provider/timing/calculation change or merge was performed.

## Remaining gates

- natural Stage 10 capture on the production application;
- genuine prospective evidence completeness;
- genuine browser-to-cloud custody;
- natural GW2 deadline timing and Official eligibility;
- any evidence-led model or provider review.

None is implied or approved by this synthetic infrastructure PASS.
