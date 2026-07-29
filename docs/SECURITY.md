# SECURITY.md
Purpose: security posture record. Audience: all sessions; Stage 3 implementers especially.
Last updated: 2026-07-29. Related: STAGE3-DESIGN.md, KNOWN_LIMITATIONS.md, DECISIONS.md.

## Current architecture
Static single-file application on GitHub Pages. Stage 3 security hardening is complete and merged through PR #6 at `3f662b7e133ce2995da74c5e52165ae84744e120`. The verified Stage 3 baseline was 210 passing tests with deterministic two-build output.

- Odds transport is DIRECT ONLY. The key cannot enter the FPL/Understat relay cascade.
- Anthropic secrets are banned client-side. Legacy `claudeKey` storage is removed on migration.
- Provider and user strings render through DOM builders; AI output uses the restricted Markdown AST.
- External payloads are validated at provider boundaries and transient failures use bounded retry.
- Provider Health exposes Live, Cached, Stale, Fallback, Partial, Disabled and Unavailable through a compact global status and full current-session detail under More; Stage 9.5 changes presentation only.
- Stage 9.6 forbids style attributes/runtime style APIs and removes the related CSP concession without changing provider, storage or model behaviour.

## Odds-key hygiene
The Odds API key remains client-side as the accepted-temporary SEC-2 limitation. Current controls:

- password-masked field;
- saved only when non-empty;
- one-action **Forget API key** removes the stored property, clears the field and active odds data,
  marks the provider Disabled and returns projections to the internal team model;
- direct-only transport remains structurally isolated from relays;
- retry endpoint labels strip query strings;
- user-facing errors and health notes are fixed safe strings;
- `scrubOddsSecret()` removes the current raw/encoded key and `apiKey=` values from any future
  diagnostic string before it can leave the provider boundary;
- regression tests cover forgetting, storage omission, output scrubbing, relay isolation and
  generated-artefact secret scans.

This does not make a browser-held key secret from the browser owner, extensions or compromised
same-origin code. Server-side environment storage remains deferred until the serverless trigger.

## Content Security Policy
`build.mjs` emits a deterministic meta CSP whose SHA-256 hashes match the exact single inline script
and single inline style block. The build re-extracts the final HTML and independently verifies both
hashes before writing a deployable. The build also rejects static `style=` attributes, runtime style APIs and any generated style attribute before output is accepted.

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

GitHub Pages cannot send CSP headers and meta CSP ignores `frame-ancestors`. A browser-safe frame-buster
is inside the single hashed script as the compensating control. FRAME-1 therefore remains an
accepted-temporary limitation.

## Deferred triggers
Serverless proxies, environment-held secrets, origin checks, server rate limiting, real CSP headers
and hosted Anthropic support remain deferred until hosted AI is required under D-08.


## Stage 10 evidence security
Evidence construction is allowlist-only and rejects secret-shaped keys or values before finalisation. It never serialises configuration or core state wholesale. Numeric entry and league identifiers are redacted from retry/issue endpoints; FPL Team ID, manager name and league IDs are omitted. A random 128-bit device-local reference is used instead.

Imported JSON is accepted only after schema, section-hash, whole-record-hash and snapshot-ID verification. Browser recovery records use built-in gzip where available, but exports are deliberately complete unencrypted JSON and must be handled as user-controlled files. A visible delete action removes local records and the anonymous reference; it cannot remove files already exported by the browser.


## Verified startup and recovery trust boundary (Stage 10.1 amendment)
The startup screen is an orchestration gate, not a security theatre animation: access is released only after the approved provider cycle completes or the app enters explicit restricted mode. Refreshes suppress intermediate renders, temporarily make decision controls inert and apply one final state, preventing the user from acting on a visible mixture of old and new provider data.

Runtime Provider Health rejects unknown provider identities. Imported evidence must contain exactly the approved provider set and pass schema, privacy, timing and hash checks. Even then, imports are labelled `recovery_import` and local metadata forces `officialEligible=false`; self-consistent third-party JSON therefore cannot silently become official evidence or model input.

This does not authenticate the author of an exported JSON file and is not an external timestamp signature. The safety property is narrower: imported files cannot affect recommendations and cannot become the local official prospective record.

## Stage 10.2 outcome security
Outcome records are allowlist-built and reuse the Stage 10 secret/personal-identifier rejection boundary. They exclude API keys, raw configuration, manager names, league identifiers, raw provider responses and the FPL Team ID. The Team ID is used transiently only to request the optional public manager outcome; persisted endpoint labels use `[redacted]`.

Whole-record, official-data and section SHA-256 hashes detect storage or import tampering. Imported outcome JSON is schema/hash checked but marked `recovery_import`, is never current, and cannot silently supersede a locally collected official revision. Outcome collection adds no CSP origin, authentication cookie, FPL write action or server code. Exports remain complete unencrypted owner-controlled files.
