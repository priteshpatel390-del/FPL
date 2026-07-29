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
hashes before writing a deployable.

Policy shape:

- `default-src 'none'`
- hash-only `script-src`
- hash-only inline style element plus `https://fonts.googleapis.com`
- `style-src-attr 'unsafe-inline'` as the sole approved concession until Stage 9
- `font-src https://fonts.gstatic.com`
- explicit `connect-src` allow-list for FPL, relays, Understat, Odds, archive and Claude preview
- `img-src 'self' data:`
- `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`
- `frame-ancestors 'none'` retained for future header migration

GitHub Pages cannot send CSP headers and meta CSP ignores `frame-ancestors`. A browser-safe frame-buster
is inside the single hashed script as the compensating control. FRAME-1 therefore remains an
accepted-temporary limitation.

## Deferred triggers
Serverless proxies, environment-held secrets, origin checks, server rate limiting, real CSP headers
and hosted Anthropic support remain deferred until hosted AI is required under D-08.
