# GW1-P1 — Cloudflare Evidence Foundation

Status: **complete and merged** at `main` `58b834a1824c4977a442e7b3e309e2bbf3d05da1` through PR #118  
Approved scope: Pritesh, 11 August 2026  
Base: `main` `43f109b306071aa0c3c1c45985876fecb3da7aa5`  
Branch: `agent/gw1-p1-cloudflare-evidence-foundation`  
PR: `#118` (merged)  
Successor: [GW1-P2 Browser evidence delivery](GW1-P2-BROWSER-EVIDENCE-DELIVERY.md)

## Outcome

GW1-P1 adds the server-side destination required to preserve the existing Stage 10 pre-deadline snapshot without changing any FPL recommendation logic.

The custody path is:

`existing Stage 10 local_capture -> Cloudflare Access -> evidence Worker -> exact Stage 10 validation -> private content-addressed R2 -> verified R2 read-back -> D1 manifest + ingest receipt`

The Teamsheet browser is deliberately **not** connected in this checkpoint. Browser outbox/sync is GW1-P2.

No model, expected-minutes, fixture, simulation, squad, captaincy, transfer, rank, Mini-League or provider-acquisition behaviour changes in GW1-P1.

## Archive v1 contract

Only these records are accepted:

- `recordType = preDeadlineSnapshot`;
- Stage 10 snapshot schema `1.0.0`;
- archive envelope version `1.0.0`;
- envelope origin `local_capture`.

`recovery_import` is rejected. A restored file cannot become prospective server evidence merely because its internal hashes are valid.

The Worker independently checks the frozen Stage 10 trust contract, including:

- exact record shape;
- season, Gameweek and deadline identity;
- approved provider set and provider-use state;
- forbidden secrets/account identifiers;
- deterministic section/rule hashes;
- duplicate key;
- deadline timing and clock evidence;
- canonical SHA-256 content hash;
- Stage 10 snapshot ID.

The immutable identity remains the Stage 10 SHA-256 of canonical **uncompressed** JSON. Server metadata is never inserted into the Stage 10 record.

## Provider-retention gate

Permanent archival of Understat- or Odds-derived evidence remains separately approval-gated.

GW1-P1 therefore defaults to:

- `ALLOW_UNDERSTAT_RETENTION=false`;
- `ALLOW_ODDS_RETENTION=false`.

The Worker fails closed if either the frozen provider row says Understat/Odds affected the model or meaningful derived data remains in `modelInputs.understat` / `modelInputs.odds`. Null or empty unused containers are allowed.

If retention is not approved, the exact record is rejected rather than stripped or re-hashed. This checkpoint does not change acquisition, caches, keys, fallback or provider weights.

## Private R2 canonical evidence

Object key:

`evidence/v1/preDeadlineSnapshot/{season}/gw{gameweek}/{contentHash}.json.gz`

For each accepted record the Worker:

1. canonicalises the final Stage 10 record;
2. gzip-compresses it;
3. computes SHA-256 for the stored gzip bytes;
4. performs a conditional R2 put using `If-None-Match: *`;
5. stores bounded metadata including canonical hash, stored hash, record type, Stage 10 ID, schema, season, Gameweek, origin and a one-way subject hash;
6. reads the object back;
7. verifies the stored-byte hash;
8. decompresses it;
9. requires exact canonical JSON equality before D1 may claim the evidence exists.

A duplicate content-addressed upload verifies the existing object and never overwrites it.

R2 remains private. GW1-P1 exposes no canonical evidence-body download route.

## Minimal D1 schema

Migration `workers/evidence-migrations/0001_evidence_foundation.sql` creates the minimal backend required for GW1 custody:

- `schema_migrations` — repository-owned migration marker;
- `evidence_records` — immutable manifest/index rows only;
- `ingest_receipts` — idempotency receipts linked to canonical content hashes;
- `rate_limit_windows` — bounded per-subject request counters.

The full Stage 10 JSON is not stored in D1. D1 stores identity, timing/custody classification, build/model/rules versions, private R2 key, original R2 upload timestamp, byte counts and hashes.

## R2-first failure contract

D1 and R2 do not share one transaction. The required order is:

1. validate envelope and exact Stage 10 record;
2. enforce retention policy;
3. create or verify private R2 evidence;
4. only then attempt the D1 manifest + receipt batch;
5. read D1 state back before returning success.

Consequences:

- R2 failure -> no D1 canonical manifest or receipt;
- D1 failure after successful R2 -> invisible recoverable R2 orphan;
- duplicate hash -> existing R2 object is re-read and verified, not overwritten;
- same idempotency key + different hash -> reject;
- a retry of the same evidence preserves the first R2 custody timestamp.

## Orphan reconciliation

`POST /v1/admin/reconcile` scans only the approved evidence prefix in bounded pages.

An unmanifested R2 object is promoted to D1 only after the body and metadata pass the same canonical validation, provider-retention checks and stored-byte hash verification. The manifest uses the original R2 `uploaded` timestamp; reconciliation never fabricates earlier custody.

Unexpected or invalid objects are counted as quarantined and are not promoted.

## Custody semantics

Two facts remain separate:

- `client_official_eligible`: the existing Stage 10 timing/quality decision;
- `server_predeadline_received`: true only when that record was client Official-eligible and the immutable R2 object's first upload timestamp is before the existing safety cutoff.

This is evidence of custody within the Teamsheet/Cloudflare architecture. It is not independent cryptographic notarisation, WORM storage against the Cloudflare account owner or an external timestamp authority.

## Authentication and Cloudflare runtime boundary

Every non-preflight production route requires Cloudflare Access via `Cf-Access-Jwt-Assertion`.

The zero-dependency verifier:

- accepts RS256 only;
- retrieves current Access JWKS from the configured HTTPS `*.cloudflareaccess.com` team domain;
- selects by `kid`;
- imports only public RSA verification fields;
- verifies signature, issuer, audience, expiry, optional `nbf` and non-empty subject;
- caches JWKS briefly so normal key rotation does not require source changes.

`TEAM_DOMAIN` and `POLICY_AUD` are runtime configuration and are not committed.

During live acceptance Cloudflare Workers exposed a runtime incompatibility with Fetch `redirect: "error"` during JWKS retrieval. The permanent Cloudflare entrypoint adapter converts that core fail-closed intent to `redirect: "manual"`. Redirect responses therefore remain non-success responses and are not followed. This compatibility shim is isolated from the portable archive core and has a permanent regression test.

Temporary redacted auth diagnostics used to isolate that defect were removed from the final source.

## Network/security boundary

The evidence Worker is separate from `teamsheet-fpl-gateway`.

The service enforces:

- exact allowed browser origins;
- GET/POST/OPTIONS only;
- fixed route allowlist;
- request-size bounds;
- authenticated-subject rate limiting;
- generic client errors and bounded/redacted operation diagnostics;
- private R2 and Worker-only D1/R2 bindings.

It does not intentionally persist FPL Team ID, manager name/email, league/rival identifiers, Access JWT/cookie, Odds key/keyed URL or arbitrary raw provider payloads.

## Production routes

All non-OPTIONS routes are authenticated:

- `GET /v1/health`
- `POST /v1/evidence/predeadline`
- `GET /v1/evidence/{contentHash}` — safe D1 manifest only
- `POST /v1/admin/reconcile`

There is no public/raw R2 read endpoint.

Temporary owner-only acceptance routes used on 11 August 2026 are **not part of the final production source**.

## Preview/version URL security closeout

Cloudflare documents Preview URLs as a separate Workers routing surface. When `workers_dev` is enabled and `preview_urls` is not explicitly configured, current Wrangler behaviour enables Preview URLs by default. When enabled, versioned and aliased Preview URLs are publicly reachable unless their own Cloudflare Access protection is enabled; protecting the production `workers.dev` hostname alone does not establish protection for Preview URLs.

GW1-P1 therefore does not rely on an independent second Access policy for ephemeral version/alias hostnames. Both the verified source config and isolated deployment config explicitly set:

`"preview_urls": false`

Cloudflare documents that disabling Preview URLs disables routing to both versioned and aliased Preview URLs. `tests/evidence-archive-layout.test.mjs` permanently requires the source/deploy configs to remain byte-identical and `preview_urls` to remain false.

Official references:

- https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/
- https://developers.cloudflare.com/workers/configuration/routing/workers-dev/

**Live security closure passed on 11 August 2026 at 19:22 BST using owner-supplied physical iPhone Safari dashboard evidence.** The Cloudflare Workers & Pages Domains screen showed the production `teamsheet-evidence-archive.fpltsheet.workers.dev` route enabled and marked **Restricted** with the Access-policy sign-in requirement, while the wildcard Preview hostname `*-teamsheet-evidence-archive.fpltsheet.workers.dev` was disabled. This records owner-provided live dashboard evidence at that moment; it is not claimed as independent dashboard/device testing by the assistant. The Access-protected production `workers.dev` route remains intentionally enabled.

## Live production acceptance — 11 August 2026

Acceptance was performed against the owner-controlled `teamsheet-evidence-archive` Worker using physical iPhone Safari and deliberately synthetic season `2099-00`, GW38 records. The synthetic records were incomplete, provider-disabled and explicitly non-official so they could not be mistaken for genuine FPL evidence.

### Access / health

Physical iPhone Safari passed Cloudflare Access and the Worker's own JWT verifier. `GET /v1/health` returned:

`{"ok":true,"archiveVersion":"1.0.0","schemaVersion":"1.0.0","migrationVersion":1}`

The health route also exercised the configured D1 database and R2 binding.

### Positive archive path

A synthetic evidence object with canonical content hash:

`ed5349461d8a324f7874c458e713c5bc61bd26bd00936b295b140bfc283f69f9`

was retained at the expected private key:

`evidence/v1/preDeadlineSnapshot/2099-00/gw38/ed5349461d8a324f7874c458e713c5bc61bd26bd00936b295b140bfc283f69f9.json.gz`

The D1 manifest reported original R2 upload time:

`2026-08-11T16:21:56.345Z`

Live acceptance then verified duplicate/idempotent retry and authenticated manifest read-back. The duplicate path re-read and re-verified the existing R2 metadata, stored checksum, decompressed body and canonical JSON before trusting D1.

### Forced R2 failure

A separate synthetic record deliberately forced the R2 write boundary to fail. Live result:

- forced failure observed: true;
- D1 manifest absent: true;
- ingest receipt absent: true;
- R2 object absent: true.

This verifies the required `R2 failure -> no D1 claim` contract against the real production bindings without disabling or reconfiguring the actual R2 resource.

### Forced D1-after-R2 failure and reconciliation

A third synthetic record deliberately allowed real R2 storage and verification, then forced the D1 batch boundary to fail. Live result:

- forced D1 failure observed: true;
- R2 orphan observed: true;
- manifest restored by real reconciliation: true;
- ingest receipt remained absent after orphan reconciliation: true;
- original R2 upload timestamp preserved: true;
- reconciliation: `reconciled=1`, `quarantined=0`, `truncated=false`.

Original and post-reconciliation R2 upload timestamp:

`2026-08-11T16:41:10.148Z`

This verifies that reconciliation reconstructs index state from the retained canonical R2 object without manufacturing earlier custody.

## Automated regression scope

Permanent tests cover:

- parity with an actual client `finaliseSnapshotRecord()` result;
- mutation rejection;
- provider-retention gates;
- R2-before-D1 ordering and R2 read-back/hash verification;
- duplicate retry/idempotency and first-custody preservation;
- idempotency-key conflict;
- R2 failure with no D1 record;
- D1 failure with recoverable R2 orphan and reconciliation;
- recovery-import rejection;
- RS256 Access signature/issuer/audience/expiry verification;
- Cloudflare redirect compatibility adapter and fail-closed wiring;
- origin/auth/method/route fail-closed behaviour;
- safe manifest read-back and rate limiting;
- source/deploy mirror parity;
- separate Worker/D1/R2/migration configuration;
- explicit disabling of Cloudflare versioned/aliased Preview URLs.

The complete repository suite plus deterministic/provenance/build-identity gates remain mandatory for the final PR head. Exact final-head verification is recorded in PR #118 rather than embedded here as a mutable candidate SHA.

## Explicitly unchanged

GW1-P1 does not change:

- any `src/` application file;
- Stage 10 browser capture/finalisation/local persistence;
- Official FPL gateway/acquisition;
- Understat acquisition/parser/cache/fallback;
- Odds acquisition/key/cache/fallback;
- expected minutes or projection formulas;
- fixture calculations;
- simulation;
- squad/best XI;
- captain/vice;
- transfer optimisation;
- rank/Mini-League logic;
- generated application deployables.

## Remaining boundary

GW1-P1 provides and production-validates the backend foundation only. Its functional backend paths have recorded physical iPhone Safari acceptance, and the Preview URL security closeout is now recorded from owner-supplied live Cloudflare dashboard evidence. Teamsheet browser integration remains outside this checkpoint.

GW1-P2 is now implemented as a separate approval-gated checkpoint and connects the existing Stage 10 browser flow to this service with the persistent local outbox contract. Until GW1-P2 passes its owner physical acceptance gate, automatic browser upload of genuine pre-deadline snapshots is not an accepted behaviour.

Provider-retention flags remain false unless Understat/Odds archival rights receive a separate approved decision.
