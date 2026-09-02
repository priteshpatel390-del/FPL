# DATA-S2B bounded production diagnostics — preparation

## Purpose and checkpoint

Authoritative `main` is `0c0ddc7a782a842ce592bc4cb805225242b57a71`; exact-main Verify Teamsheet run `33623858539` passed. Protected read `33622647158` previously proved the promoted Worker at 100% and then stopped at Cron drift before D1. This candidate replaces first-mismatch termination for non-dangerous expectation drift with one bounded read-only evidence bundle. It does not run live from a branch: after owner-approved merge and exact-head Verify, one protected dispatch is the next checkpoint.

## Strict identity and capability boundary

Before transport, the runner requires the runtime production account ID to match the independently configured SHA-256 production fingerprint and pins the repository Worker name and D1 UUID. It then requires the sole production hostname, active Version detail, exact D1 binding/database identity, and secret binding shape; identity ambiguity, malformed/unbounded responses, database mismatch, secret text exposure, an unauthorized endpoint, or non-SELECT SQL stops immediately.

The executable reuses the existing request guard. Its only Cloudflare methods are GET and D1 query POST containing one of eleven closed repository-owned SELECT statements. It has no upload, Deployment create, schedule mutation, collector, cleanup, arbitrary URL, arbitrary SQL, mutation retry, Wrangler, or application/model path. The protected workflow is manual, exact-current-main and exact-head-Verify gated before credentials. The retained JSON is mode `0600` in runner temporary storage and uploaded for 14 days; raw responses and credentials are never written.

## One-pass evidence contract

Safe expectation mismatches are statuses rather than exceptions. The report records a closed `PASS` / `FAIL` / `PARTIAL` / `PENDING` / `SUPERSEDED` matrix for Worker/deployment, Cron, cadence, fetch transport, endpoint evidence, season, baseline, unchanged and changed facts, observations/heads/orphans, bookkeeping, resources, D1 accounting, rollback/stop, observability and provider/security boundaries.

Bounded fields include current Deployment ID and up to five traffic allocations; at most 100 deployable Version IDs; schedule count and at most ten sanitized expressions; compatibility and season; D1 name/size; closed schema and migration names; governance booleans; table counts; aggregate run statuses; at most twenty sanitized recent run summaries; at most 100 per-run append/head aggregates; and orphan counts. The report explicitly marks CPU, invocation analytics, rows read/written and Cron invocation counts unavailable when the current approved endpoints cannot supply them. It does not widen permissions to obtain them.

A positive changed-fact result requires a positive completed run after the first positive completed baseline, exact accepted/appended equality and at least one corresponding current head. An unchanged result requires positive `records_seen`, zero accepted and zero appended observations. No Official FPL data is manufactured.

## Execution gate

This preparation performs no Cloudflare request or production mutation. The draft must not merge without owner approval. After merge and exact-main Verify, dispatch `.github/workflows/data-s2b-production-diagnostics.yml` once. Its artifact should provide the complete bounded evidence bundle needed for one consolidated acceptance correction rather than another one-failure PR chain.
