# Corrected R1/R2 Worker Version preparation — repository-only foundation

Date: 8 October 2026. Status: **DORMANT REPOSITORY CANDIDATE; no upload, Deployment, Cloudflare or D1 read/write, API-Football request, workflow dispatch or merge authorised by repository approval.**

## Baseline and authority

GitHub `main` starting SHA: `ce0d85fd058fc1bad160e66bb6eb188e2a47b80b` (PR #319). Post-merge Verify Teamsheet run `37801742455` passed 2,627/2,627, provenance and two exact byte-identical production builds. GitHub Pages run `37801741510` completed successfully. Gate C run `37776873809` is FAILED and permanently CONSUMED; never rerun. Gate A `37680114065` and Gate B `37688525299` are also consumed. They are historical evidence, not authority for a new run.

The existing immutable Version `4171f3cf-953e-452e-9e5f-068df9a3ca47` from creation SHA `f01ccff5b13a4bbc98d7927cf620f69f46c4c54c` remains old code, promoted through active Deployment `9b48b57a-e505-4213-9547-fe44835a9bdb`. Its 17 reviewed module bytes are reproduced from SHA-256-verified historical snapshots, with unchanged original pins and Gate A graph/metadata hashes. Historical snapshots are **never** a source for the new corrected Version.

## Source and identity boundaries

`corrected-version-candidate.mjs` pins the 17-module current-tree R1/R2 identity. Exactly five module hashes differ from the existing deployed Version: `collector.mjs`, `activation-orchestrator.mjs`, `planner-orchestrator.mjs`, `runtime-contracts.mjs` and `semantic-validation.mjs`; 12 remain byte-identical. All 17 were independently checked on the baseline main. The candidate is `NOT_CREATED_NOT_UPLOADED_NOT_DEPLOYED`.

`corrected-version-preparation.mjs` is a separate preparation contract; it rechecks the current-tree candidate and requires a reviewed full creation SHA. Its graph SHA-256 includes the new contract, creation SHA, exact module hashes, main module and public metadata hash. The metadata includes only secret *names and types*: the Worker remains `teamsheet-api-football-shadow-collector`, main `collector.mjs`, compatibility date `2026-09-16`, D1 binding `TEAMSHEET_DATA_DB`, plain vars for seasons `2026-27`/`2026` and activation `ATTENDED_ONE_SHOT_DISCOVERY`, and exactly `API_FOOTBALL_API_KEY`/`API_FOOTBALL_ATTENDED_TRIGGER_SECRET` secret bindings. The source is resolved with the *explicit corrected current-tree reader*, not any historical default. It refuses missing/unreviewed modules, dynamic/external imports, wrong hashes and altered bytes. Before a separately approved upload, the upload-form bytes must independently match each pinned SHA-256.

The eventual creation SHA is the separately owner-approved current main at upload time, **not today's baseline SHA unless no later merge occurs**. After creation it is permanent immutable Version provenance, distinct from later promotion or collection execution SHAs.

## Proposed future protected workflow (dormant)

`.github/workflows/api-football-corrected-version-preparation.yml` is separate from consumed Gate A/B/C. It is manual-only, exact-main, first-attempt-only, shared non-cancelling concurrency and protected:
1. Repository gate: exact approved main, full-history checkout, exact-head Verify Teamsheet success, focused offline tests.
2. Fresh read-only admission: protected `data-steward-readonly`, no upload/trigger/provider secret. Independently reads immutable Versions, active/historical Deployments, inert routing, D1 runtime and consumed history. SHA-256-binds the sanitized admission handoff.
3. **Separate future live approval required** for the protected `api-football-corrected-version-upload` environment and execution. It must be created and secured by the owner; repository approval does not provision it. The executor requires distinct least-privilege topology-read, read and Version-upload credentials; provider key and attended trigger secret values appear only in the in-memory multipart form, never the identity, annotations, logs or artifacts. It rechecks Cloudflare-only state immediately before one exact Version POST. All other mutations and non-Cloudflare network destinations are refused. No D1 endpoint is permitted in that protected executor.
4. Independent read-only reconciliation: must show exactly one new Version carrying identical module bytes and metadata; four historical Versions, two unchanged Deployments and inert routes; identical D1 history; zero Deployment, D1, worker, Preview, Cron, route, domain and provider mutation.

### Admission history — must NOT reuse Gates A/B/C history predicates

The baseline after failed Gate C consists of *five total request attempts* (the earlier consumed `TRANSPORT_UNKNOWN` and four on 8 October), *two FAILED generations*, three successful discovery requests, one schema failure, no attempt 2, no committed generation, no discovery heads, **824 fixture revisions and 824 memberships**. Exact per-generation membership relationships are tested separately from `api_football_fixture_revisions.generation_id`, which may describe first creation rather than future content-addressed reuse. D1 checks require zero orphans and zero cross-identity revision mismatches, exact October 8 counts and foreign-key integrity, 20/20 qualified team mappings, six migrations, valid Official FPL authority, collection disabled, credential available and no lease. Nothing is deleted/reset, and zero committed heads remains authoritative.

Expected Cloudflare state at admission is exactly **four historical Versions and two existing Deployments**, with active Version `4171f3cf…` at 100%, historical Deployment unchanged, and workers.dev/Preview off with zero Cron, routes or custom domains. The new upload may raise Version count to **five** but may not alter the two Deployments. These are recorded historical expectations; fresh live inventory remains unproven without another explicit owner approval.

## Upload mutation and ambiguity policy

Maximum one Version POST to the exact original Worker, never a second POST or automatic retry. A clear 4xx rejection is non-success; 2xx result requires readback. Transport errors, malformed results, 5xx and bounded readback absence are `AMBIGUOUS_OWNER_ATTENTION` unless an exact new Version is independently observed. Readback attempts are bounded (immediate, +2s, +5s), GET-only. No automated rollback/deletion/restore. A successful upload is **prepared and inert**, not promoted or exercised. Even independent success does not approve the next gate.

## Validation and limitations

Offline tests cover exact 17-byte SHA pins and graph identity, historical preservation and snapshot substitution, creation-SHA/metadata drift, secret redaction, wrong/missing/duplicate Version IDs, two-Deployment admission, non-pristine D1 history, 824 membership semantics, malformed Version detail, one-upload ceiling and ambiguous outcomes, denied D1/provider/Worker/Deployment requests, and independent read-only reconciliation. `./run-tests.sh`, production builds twice, exact build-input and root/deployable identity, and fresh exact-head CI are required for review. Tests must not be weakened.

This work proves only repository contracts on synthetic fixtures, **not** fresh Cloudflare topology, live D1 membership truth, correct protected credential configuration, upload success, provider transport, the specific FA Cup failure predicate, response reliability or model accuracy. R3/R4, new live collection and any model/product influence remain excluded.

## Separate approval gates

1. Repository-only foundation → draft PR and exact-head CI.
2. Owner reviews and approves **merge**; verify resulting main.
3. Owner separately approves first live read-only admission, provisions protected upload environment and narrowly scoped credentials, and approves **one-time Version upload**.
4. Independently reconcile five Versions, unchanged two Deployments and inert runtime/history. NO automatic promotion.
5. Owner separately approves a new Deployment promotion design and live invocation.
6. Independently prove inert Deployment with new Version at 100%.
7. Owner separately designs/approves a **new** live collection gate able to handle non-pristine history and quota uncertainty, without reusing Gate C run `37776873809`.

Every checkpoint stops unless newly and explicitly authorised.
## Post-upload reconciliation failure forensics — run 37841681952 (8 October 2026)

Run `37841681952` (main `073ac6a53d09f004e5ada5b94fb1cea6df3ef228`, attempt 1) uploaded Version `509f5a98-38fc-4e58-8a26-1b8fc4c9c787` (outcome `CREATED`, one POST) and then stopped in independent reconciliation with `corrected_version_byte_or_metadata_drift`. That string was an aggregate: `validateCorrectedVersion()` threw on any of about twenty conditions and the catch collapsed them all.

**Verified:** the reconciliation job log carries only the aggregate reason; the reconciliation artifact is 695 bytes and holds no Version-level detail. The protected upload job started 7 seconds after creation, so no environment-reviewer wait occurred (the workflow correctly declares `api-football-corrected-version-upload`; reviewer enforcement is GitHub environment configuration that this repository cannot read or set).

**Not verified:** which condition failed. Live Cloudflare Version JSON and the artifact blobs were not retrievable in the investigating session. The root cause is therefore **unproven**; the candidate Version is **unqualified**, neither verified nor shown to differ.

**Hypothesis, not a finding:** the corrected validator compares the whole `annotations` object, while every previously live-proven validator (attended, transport-remediated) checks only `workers/message` and `workers/tag`. If Cloudflare adds its own annotation keys, a whole-object comparison would reject an identical Version. This must be confirmed from the real response before any comparison is changed.

**Change (diagnostics only, no acceptance rule altered):** rejections now carry one closed sub-reason from `CORRECTED_VERSION_FAILURE_REASONS` (for example `annotations_mismatch`, `module_content_mismatch`, `binding_type_mismatch`). Reconciliation reports `corrected_version_byte_or_metadata_drift:<sub-reason>`; missing stable/beta evidence is reported as `corrected_version_evidence_unavailable` rather than as a mismatch. No remote value, name or hash is ever placed in a reason.

**Next:** a separately approved read-only re-check of Version `509f5a98…` using these diagnostics. No upload, Deployment or collection is authorised by this change.

**Owner action (external):** in GitHub → Settings → Environments, confirm `api-football-corrected-version-upload` has Required reviewers and that self-review is not allowed to bypass the pause you expect.
