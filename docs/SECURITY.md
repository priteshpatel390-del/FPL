# SECURITY.md
Purpose: security posture record. Audience: all sessions; Stage 3 implementers especially.
Last reconciled: 2026-08-08. Related: STAGE3-DESIGN.md, STAGE10-ITEM3.md, KNOWN_LIMITATIONS.md, DECISIONS.md.

## Current architecture
Static single-file application on GitHub Pages plus one owner-controlled, zero-dependency Cloudflare Worker used only as a narrow read-only transport to Official FPL. The Worker is deployed at `https://teamsheet-fpl-gateway.fpltsheet.workers.dev` and accepts only the approved allowlisted FPL paths; it is not a generic proxy. Stage 3 security hardening remains complete and merged through PR #6 at `3f662b7e133ce2995da74c5e52165ae84744e120`.

- Odds transport is DIRECT ONLY. The key cannot enter the FPL/Understat relay cascade.
- Anthropic secrets are banned client-side. Legacy `claudeKey` storage is removed on migration.
- Provider and user strings render through DOM builders; AI output uses the restricted Markdown AST.
- External payloads are validated at provider boundaries and transient failures use bounded retry.
- R1 supporting caches are closed, schema/model/season-bound input envelopes: minute histories contain validated Official FPL rows, Understat contains only normalised team inputs and Odds contains only derived fixture inputs. Raw Understat HTML, Odds keys and keyed URLs are never stored in these caches.
- Provider Health exposes Live, Cached, Stale, Fallback, Partial, Disabled and Unavailable; full current-session detail is organised under Settings → Data & Diagnostics → Provider Health. Healthy state does not occupy the header. Primary screens receive only fixed consequence-led core-data warnings and never raw endpoints, relay errors or identifiers. The placement changes presentation only.
- Stage 9.6 forbids style attributes/runtime style APIs and removes the related CSP concession without changing provider, storage or model behaviour.
- Stage 10 snapshot, outcome and metric records use allowlisted shapes, canonical finite JSON, immutable revisions and deterministic SHA-256 verification.

## Official FPL gateway security
The production gateway uses a fixed Official FPL upstream host and an exact path/query allowlist. It supports only `GET`, `HEAD` and CORS `OPTIONS`, forwards only `Accept: application/json`, omits browser credentials and rejects unknown paths, traversal, arbitrary URLs, non-JSON responses and every redirect without following or exposing its destination. Browser CORS is limited to approved exact origins, but this is not authentication. Redacted observability can record only bounded error type/message data; permanent tests strip URLs, query values and numeric identifiers. Live transport and the tested Transfers, Player Detail, Team, Fixtures and Leagues pre-season paths are accepted; populated post-Gameweek League evidence remains deliberately deferred.

Safe Hygiene A2 removed an unused browser-transport `BASE` constant and export only. Runtime Official FPL requests continue to derive their exact gateway base from the validated configuration/meta boundary, so the merged removal changed no upstream host, endpoint, request, credential, CORS, cache, fallback or trust behaviour.

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
- R1 persists only derived market rows plus fixed reason/cooldown metadata under `fpl:odds-derived-inputs`; tests assert that the raw API key is absent. The direct request URL remains transient and is reduced to a query-free endpoint label before retry metadata is stored.

This does not make a browser-held key secret from the browser owner, extensions or compromised same-origin code. Server-side environment storage remains deferred until the serverless trigger.

## Content Security Policy
`build.mjs` emits a deterministic meta CSP whose SHA-256 hashes match the exact single inline script and single inline style block. The build re-extracts final HTML and independently verifies both hashes. It rejects static `style=` attributes, runtime style APIs and any generated style attribute before output is accepted.

Policy shape:

- `default-src 'none'`
- hash-only `script-src`
- hash-only inline style element plus `https://fonts.googleapis.com`
- no `style-src-attr` directive and no `unsafe-inline` token
- `font-src https://fonts.gstatic.com`
- explicit `connect-src` allow-list for same-origin timing evidence, the exact owner-controlled FPL gateway origin `https://teamsheet-fpl-gateway.fpltsheet.workers.dev`, optional Understat relays, Odds, archive and Claude preview
- `img-src 'self' data:`
- `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`
- `frame-ancestors 'none'` retained for future header migration

GitHub Pages cannot send CSP headers and meta CSP ignores `frame-ancestors`. A browser-safe frame-buster is inside the single hashed script as the compensating control. FRAME-1 remains accepted-temporary.

Stage 10.3 adds no network origin and no CSP relaxation. Metrics are computed from locally stored validated evidence only.

## Deferred triggers
The approved narrow Official FPL transport Worker is implemented and deployed. Environment-held secrets, authenticated/private FPL access, server rate limiting, real CSP headers and hosted Anthropic support remain deferred until separately approved. The Worker stores no FPL credentials or application secrets.

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

## Teamsheet 2.0.4 League privacy boundary

FPL league and manager identifiers are public endpoint identifiers but reveal user-specific competitive relationships when stored together. Teamsheet therefore keeps them out of hash routes, page titles, Provider Health detail, retry issue text and Stage 10 evidence. Versioned local persistence contains only selected/saved league IDs and labels plus selected/pinned rival IDs and labels. Official standings, scores and rival squads are session-only.

Requests remain read-only through the existing Official FPL transport. No cookie, OAuth flow, FPL password, private login, new origin or API key is introduced. Endpoint diagnostics continue to normalise digit runs and strip query strings. Removing a saved league also removes its selected/pinned rival state; it does not attempt to alter Official FPL.

## Teamsheet 2.0.5 selected-rival privacy boundary

The version-2 Mini-League state may persist an explicitly confirmed comparison group of no more than five public rival IDs and locally displayed labels. It does not persist standings, scores, public picks, captaincy, chip state or derived exposure.

The new `#/leagues/exposure` route contains no league, manager, player, Team or Gameweek identifier. Public picks requests remain read-only through the existing Official FPL transport, use bounded concurrency and do not introduce authentication, cookies, account writes, a CSP origin or a provider. Raw rival identifiers remain excluded from Provider Health, Stage 10 evidence and endpoint diagnostics. Removing a league clears its selected comparison group locally.

## Teamsheet 2.0.6 navigation and diagnostic privacy boundary

Every Settings route is semantic and identifier-free. Team, league, manager, rival, API-key, snapshot and record identifiers remain outside hashes and page titles. Build identity displays only public model/rules/commit/source fields already emitted by the deterministic build.

Full provider notes and freshness remain under Provider Health. Primary warnings use fixed application copy derived from approved core states and consequences; they do not render endpoint URLs, transport details or arbitrary provider errors. Existing diagnostic scrubbing remains the boundary for recovery warnings.

Moving restore, export and deletion controls changes no trust rule. Imported snapshots/outcomes remain recovery-only, exports remain complete unencrypted user-controlled files and deleting browser records cannot delete downloaded files. Odds-key masking, direct-only transport, omission from diagnostics and one-action deletion remain unchanged. No origin, CSP permission, authentication, analytics or persistent health history is added.


## Teamsheet 2.0.7 security boundary

Final-polish work adds no network origin, provider, authentication, secret, backend, service worker or account-write route. Hosted Ask is disabled before submission and states that no Anthropic key is accepted or stored. The artifact-preview keyless path remains the only approved AI transport. Restricted startup rendering and route/focus changes are presentation-only and cannot make recovery records official or alter recommendations.

## FPL-T1 Official FPL gateway security boundary
The Worker is not a generic proxy: upstream host and path families are fixed, methods are read-only, query names and numeric ranges are allowlisted, and browser cookies, authorization headers and arbitrary headers are never forwarded. The browser receives CORS only for exact approved origins. The gateway holds no FPL password, account cookie, Odds key or Anthropic key and performs no account write. Dynamic account and league responses are no-store; only bootstrap and unfiltered fixtures may use a five-minute shared cache. Ordinary platform request metadata may still be visible to the infrastructure host and must not be described as private from Cloudflare.
