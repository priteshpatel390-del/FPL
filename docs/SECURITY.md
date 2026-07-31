# SECURITY.md
Purpose: security posture record. Audience: all sessions; Stage 3 implementers especially.
Last updated: 2026-07-29. Related: STAGE3-DESIGN.md, STAGE10-ITEM3.md, KNOWN_LIMITATIONS.md, DECISIONS.md.

## Current architecture
Static single-file application on GitHub Pages. Stage 3 security hardening is complete and merged through PR #6 at `3f662b7e133ce2995da74c5e52165ae84744e120`. The verified Stage 3 baseline was 210 passing tests with deterministic two-build output.

- Odds transport is DIRECT ONLY. The key cannot enter the FPL/Understat relay cascade.
- Anthropic secrets are banned client-side. Legacy `claudeKey` storage is removed on migration.
- Provider and user strings render through DOM builders; AI output uses the restricted Markdown AST.
- External payloads are validated at provider boundaries and transient failures use bounded retry.
- Provider Health exposes Live, Cached, Stale, Fallback, Partial, Disabled and Unavailable; full current-session detail is organised under Settings → Data & Diagnostics. The navigation placement changes presentation only.
- Stage 9.6 forbids style attributes/runtime style APIs and removes the related CSP concession without changing provider, storage or model behaviour.
- Stage 10 snapshot, outcome and metric records use allowlisted shapes, canonical finite JSON, immutable revisions and deterministic SHA-256 verification.

## Odds-key hygiene
The Odds API key remains client-side as the accepted-temporary SEC-2 limitation. Current controls:

- password-masked field;
- saved only when non-empty;
- one-action **Forget API key** removes the stored property, clears the field and active odds data, marks the provider Disabled and returns projections to the internal team model;
- direct-only transport remains structurally isolated from relays;
- retry endpoint labels strip query strings;
- user-facing errors and health notes are fixed safe strings;
- `scrubOddsSecret()` removes the current raw/encoded key and `apiKey=` values from any future diagnostic string before it can leave the provider boundary;
- regression tests cover forgetting, storage omission, output scrubbing, relay isolation and generated-artefact secret scans.

This does not make a browser-held key secret from the browser owner, extensions or compromised same-origin code. Server-side environment storage remains deferred until the serverless trigger.

## Content Security Policy
`build.mjs` emits a deterministic meta CSP whose SHA-256 hashes match the exact single inline script and single inline style block. The build re-extracts final HTML and independently verifies both hashes. It rejects static `style=` attributes, runtime style APIs and any generated style attribute before output is accepted.

Policy shape:

- `default-src 'none'`
- hash-only `script-src`
- hash-only inline style element plus `https://fonts.googleapis.com`
- no `style-src-attr` directive and no `unsafe-inline` token
- `font-src https://fonts.gstatic.com`
- explicit `connect-src` allow-list for same-origin timing evidence, FPL, relays, Understat, Odds, archive and Claude preview
- `img-src 'self' data:`
- `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`
- `frame-ancestors 'none'` retained for future header migration

GitHub Pages cannot send CSP headers and meta CSP ignores `frame-ancestors`. A browser-safe frame-buster is inside the single hashed script as the compensating control. FRAME-1 remains accepted-temporary.

Stage 10.3 adds no network origin and no CSP relaxation. Metrics are computed from locally stored validated evidence only.

## Deferred triggers
Serverless proxies, environment-held secrets, origin checks, server rate limiting, real CSP headers and hosted Anthropic support remain deferred until hosted AI is required under D-08 or another separately approved trigger exists.

## Stage 10 evidence security
Evidence construction is allowlist-only and rejects secret-shaped keys or values before finalisation. It never serialises configuration or core state wholesale. Numeric entry and league identifiers are redacted from retry/issue endpoints; FPL Team ID, manager name and league IDs are omitted. A random 128-bit device-local reference is used instead.

Imported JSON is accepted only after schema, section-hash, whole-record-hash and identity verification. Browser recovery records use native gzip where available, but exports are complete unencrypted JSON and must be handled as user-controlled files. Delete controls remove local records; they cannot remove files already exported by the browser.

## Verified startup and recovery trust boundary (Stage 10.1)
The startup screen is an orchestration gate: access is released only after the approved provider cycle completes or the app enters explicit restricted mode. Refreshes suppress intermediate renders, temporarily make decision controls inert and apply one final state, preventing action on a visible mixture of old and new data.

Runtime Provider Health rejects unknown provider identities. Imported evidence must contain exactly the approved provider set and pass schema, privacy, timing and hash checks. Imports remain `recovery_import` with `officialEligible=false`; self-consistent third-party JSON cannot silently become official evidence or model input.

This does not authenticate the author of an exported JSON file and is not an external timestamp signature. The safety property is narrower: imported files cannot affect recommendations and cannot become the local official prospective record.

## Stage 10.2 outcome security
Outcome records are allowlist-built and reuse the secret/personal-identifier rejection boundary. They exclude API keys, raw configuration, manager names, league identifiers, raw provider responses and FPL Team ID. Team ID is transient request input only; persisted endpoint labels use `[redacted]`.

Whole-record, official-data and section hashes detect storage/import tampering. Imported outcome JSON is schema/hash checked but marked recovery-only, is never current and cannot silently supersede a local official revision. Outcome collection adds no CSP origin, authentication cookie, FPL write action or server code.

## Stage 10.3 metric security and integrity
Metric records are derived only from a validated officially eligible local snapshot and a validated complete/corrected linked outcome with exact identity agreement. Recovery imports, late/incomplete snapshots, provisional outcomes, deadline mismatches, manager-reference mismatches, duplicate player IDs and conflicting fixture identities fail closed.

`gameweekEvaluation` and `transferHorizonEvaluation` records reuse Stage 10 canonicalisation, forbidden-secret checks, deep freezing and SHA-256 identity. Section/data/content hashes detect tampering. Corrected outcomes append a new immutable metric revision; earlier records are not rewritten. Identical source data creates no duplicate revision.

Metric storage uses compressed verified writes, an interrupted-write journal, current pointers and bounded superseded revisions. Quota and reload failures surface rather than being treated as successful collection. Metric deletion is isolated from source snapshots and outcomes.

The metric engine never serialises configuration, API keys, account identifiers or arbitrary model state. It does not fetch providers, add a network origin or execute post-deadline production projection/minutes/simulation/optimiser functions. It reads only frozen allowlisted fields and writes only downstream descriptive evidence. Metrics cannot alter recommendations, calibration, model state or FPL account state.

Hindsight comparisons are labelled and have no recommendation pathway. No composite score or automatic model-update channel exists. The 397-test verification demonstrates deterministic contract integrity, not external authorship, timestamp notarisation, prediction accuracy or probability calibration.

## Stage 10.4 export security
- Review input is allowlisted canonical Stage 10 evidence; arbitrary runtime state, provider payloads, configuration and secrets are never exported wholesale.
- The exact JSON bundle preserves canonical source records and their identities for verification. Derived summaries, Markdown and CSV omit `managerRef` and public Team ID remains redacted by the outcome contract.
- Every JSON bundle carries source-record hashes, manifest identity, review hash and bundle hash; import validation recomputes identity and fails closed.
- CSV cells are typed. Numeric negatives remain numeric; text beginning after leading whitespace with `=`, `+`, `-`, `@`, tab or carriage return is apostrophe-neutralised and RFC 4180 quoted where required.
- Stage 10.4 adds no network origin, OAuth flow, Drive token, backend, database, relay or scheduled job. Google Sheets remains a manual user-controlled import boundary.
- Export generation is on demand, not retained as another local copy, and rejects payloads above 25 MiB without partial output.

## Stage 10.5 storage and import hardening
Untrusted JSON now rejects prototype-bearing keys before canonicalisation. Metric and transfer validators enforce supported versions, exact public shapes, identity consistency and forbidden-evidence checks. Diagnostic text strips queries/fragments, numeric manager/league paths and raw or encoded secret-shaped values. Phase journals may complete only a hash-verified local transaction; imports and unproven orphans remain recovery-only. CSV text beginning with line-feed and other formula-control prefixes is neutralised while genuine numeric negatives remain numeric.
