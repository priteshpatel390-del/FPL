# DATA-S2B bounded read-only production diagnostics

## Outcome and gate

This repository candidate replaces the one-mismatch-per-merge acceptance loop with one manual, exact-main, exact-Verify, protected read. It gathers Worker, Deployment, Cron, D1 governance/schema/count, bounded ingestion history, observation/head/orphan, health and available resource evidence into one sanitized JSON artifact and status matrix. It performs no live action while under review. Owner merge approval remains required before the first protected diagnostic run.

The authoritative preparation baseline is `0c0ddc7a782a842ce592bc4cb805225242b57a71`; Verify Teamsheet run `33623858539` passed. Historical protected run `33622647158` proved the promoted Version but stopped at Cron drift before D1. The new path records safe stale expectations and continues; identity, resource ambiguity, unauthorized endpoints, malformed responses and unsafe/unbounded output still stop immediately.

## Identity and request boundary

Before its first request the executable requires the exact production account SHA-256 fingerprint, fixed Worker name and fixed D1 UUID. It masks all runtime identities and credentials. Its request guard permits only Deployments, deployable Versions, exact Version detail, Schedules, Workers Domains, exact D1 metadata, and exact D1 query POSTs after the existing read-only SQL validator. There is no upload, Deployment create, Schedule mutation, D1 mutation, collector, cleanup, retry or arbitrary URL/SQL path.

The production account is retained only as a SHA-256 fingerprint. The artifact does not contain the raw account or database UUID, tokens, headers, raw API responses, arbitrary schedule fields or unrestricted exceptions.

## Bounded evidence contract

The `data-s2b-production-diagnostics-v1` JSON artifact is capped at 40,000 bytes and retained for 30 days. It contains:

- repository SHA and generation time;
- current Deployment identifier, active Version, traffic percentage, compatibility date and rollback presence;
- schedule count, at most three sanitized expressions and exact classification (`matches_repository_expectation`, `daily_only`, `absent`, `unexpected`);
- D1 size, fixed migration/governance rows, relevant counts, fixed schema-object allowlist and orphan-head count;
- at most 12 recent Official FPL runs with timestamps, derived season, status, four counters, sanitized error class, run observation count and current-head reference count;
- baseline, unchanged and changed-fact assessments without manufacturing data;
- explicit null/unavailable resource fields when CPU, invocation and per-invocation D1 row metrics are not available through approved endpoints;
- the required PASS/FAIL/PARTIAL/PENDING/SUPERSEDED status vocabulary across all acceptance areas.

A stale Cron or expected Version records FAIL/PARTIAL and does not prevent later safe D1 reads. The executable does not silently accept drift. Historical head state is not manufactured: unchanged or changed-fact evidence is PENDING unless retained rows prove the applicable contract.

## Known limitation

The current approved REST/read path exposes D1 file size but not necessarily Worker CPU time, invocation outcome, or per-invocation D1 rows read/written. Those fields remain explicit `null`/PENDING rather than widening token permissions or introducing GraphQL access in this checkpoint. Current first-party limit interpretation belongs in the post-run consolidated acceptance analysis; this preparation makes no Free-plan suitability claim.
