# SECURITY.md

<!-- DATA-S2B-PHASE4B-READONLY-PREFLIGHT-CANDIDATE-2026-08-28 -->
## Phase 4B standalone read-only preflight boundary

The preflight executable is structurally separate from upload/deployment code. Its request guard allows only exact required GET endpoints and the exact D1 query POST after `validateReadOnlySql`; every Worker/control-plane write and mutating SQL is rejected. Run `33170157089` failed before any request because the Phase 0 environment lacked the Worker bearer and Access credential pair. The corrected workflow reuses `data-s2b-phase2-version-upload`, maps its existing upload-token secret to the helper's read-token variable, and proves repository identity/CI before that environment becomes available. The broader credential does not broaden the executable allowlist or introduce upload/deployment code. Values are masked, raw responses are not persisted or uploaded, and sanitized evidence contains no account ID, D1 UUID or credential content. No successful live preflight or permission to rerun is claimed.

<!-- DATA-S2B-PHASE4B-REPOSITORY-CANDIDATE-2026-08-28 -->
## DATA-S2B Phase 4B endpoint and credential boundary

Phase 4B reuses the existing protected Phase 2 upload and Phase 3 deployment environments/credentials, exposing them only after an exact-current-main, clean-tree and exact-head Verify Teamsheet repository job. Application-level mutation allowlists permit the upload helper only the exact Versions POST and the deployment helper only the exact Deployments POST; Schedules, generic script updates, routes/domains, Access, secrets and D1 writes are rejected regardless of token scope. Secrets are masked, their values are never serialized, and raw Cloudflare responses are transient. No live action is authorized by this repository candidate.

<!-- DATA-S2B-PHASE3-LIVE-CLOSEOUT-2026-08-28 -->
## DATA-S2B Phase 3 live deployment security boundary

Phase 3 run `33142804502` passed after the exact-main/CI job and owner-reviewed protected environment released the serialized deployment job. Cloudflare Create Deployment required the documented coarse **Workers Scripts Write** plus **D1 Read** for bounded validation; protected review, exact-main/exact-head-CI gating and executable endpoint restrictions remained the compensating controls. The workflow submitted exactly one candidate Deployment and no rollback, Version upload, Cron, D1, route, domain, Access or secret mutation. API token, account ID, D1 UUID, retained bearer and Access credentials were masked, and no raw Cloudflare response or secret value was persisted.

Earlier attempts stopped before deployment because Access returned a non-JSON response. Sanitized read-only diagnostics showed Cloudflare had not recognized the supplied service-token pair. Before the successful run, the owner manually created a replacement service token, changed the existing Service Auth Include rule to select only it, updated the protected environment's Access credentials, and identified the working retained Worker bearer via bounded HTTP/JSON health checks. These prior manual Access/credential changes are separate from the successful workflow's mutation accounting. No credential values are recorded, and cleanup of the older service token or other obsolete resources is not claimed. See [Phase 3 live closeout](../workers/data-platform/DATA-S2B-PHASE-3-LIVE-CLOSEOUT.md) and the retained [Phase 3 deployment gating contract](../workers/data-platform/DATA-S2B-PHASE-3-DEPLOYMENT-GATING.md). Phase 4 Cron activation and collection remain unapproved.

<!-- DATA-S2B-PHASE0-CANDIDATE-2026-08-26 -->
## DATA-S2B Phase 0 credential boundary

The manual Phase 0 workflow separates repository identity/CI proof from its protected `data-s2b-phase0-readonly` environment job, so Cloudflare secrets are unavailable until the immutable-current-main gates pass. It accepts no SQL input, executes only validated literal `SELECT` statements, emits sanitized aggregate state, retains raw responses only in `$RUNNER_TEMP`, and fails closed on missing credentials, 401/403, state drift or missing rollback evidence. Minimum future permissions are Workers Scripts Read and D1 Read; broader read scopes are optional and Edit permission is prohibited. The workflow has not been executed live.

Final review also requires the dispatch event itself to originate from canonical `refs/heads/main` and requires the exact-head successful check to belong to the GitHub Actions app and canonical repository Actions URL. This repository is public, so current GitHub documentation makes required reviewers, deployment-branch restrictions and environment secrets available on GitHub Free; those controls still require separate manual owner setup after merge.

<!-- DATA-S2A-2026-08-26 -->
## Current DATA-S2A security boundary

DATA-S1C-R retired Service Binding/RPC and custom bearer-HTTP as forward collection defaults; their code, workflow and deployed state remain historical/rollback evidence. DATA-S2A requires no new public or machine-authenticated read surface: the existing isolated data Worker fetches only fixed Official FPL `bootstrap-static` and `fixtures` URLs and writes through its own D1 binding.

The candidate is `shadow_only`, retains no raw payload, provider secret, browser credential, manager/account/league/rival state or production recommendation data, and has no path into Teamsheet runtime/model behaviour. It does not replace or broaden the live Official FPL gateway. No DATA-S2A deployment, live migration/D1 mutation or Cron activation has occurred. DATA-S2B remains a separate owner gate and must stop/rollback if migration, collection validity, D1 accounting or Workers Free CPU evidence fails.

## DATA-S1C manual private-RPC acceptance boundary

The permanent DATA-S1C acceptance workflow is `workflow_dispatch`-only, exact-current-canonical-`main` gated, read-only, and attached to the dedicated `data-s1c-private-acceptance` environment. Its only secret references are `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; it masks both before tooling, captures raw temporary logs below `$RUNNER_TEMP`, uploads no artifact, and removes all DATA-S1C temporary files unconditionally. The runtime probe binds only the existing private acceptance caller with `remote: true`; it has no D1/R2/KV/queue, route/domain, provider, write or ingest capability. Wrangler's temporary edge-preview session is permitted, but no production deployment command exists. After a valid PRE-state snapshot, read-only POST-state verification and local cleanup run unconditionally; final enforcement retains functional failure or topology drift as failure and performs no automatic remediation. Execution remains separately owner-approved. Codex remote preview was rejected after its WebSocket path failed with `ENETUNREACH` before reaching the caller.

The first manual GitHub Actions attempt, run `32896875022`, failed safely at PRE-state with both required environment secrets present and non-empty. Functional acceptance was skipped, so no Wrangler process, edge-preview session, caller invocation or D1 operation occurred. Its generic failure log was insufficient to distinguish network, HTTP, JSON, Cloudflare or response-contract failure. PRE and POST reads now emit only an allowlisted category, HTTP status category and numeric Cloudflare error codes where available; they never emit response bodies, Cloudflare error messages, account identifiers, tokens or authorization headers. This diagnostic improvement does not weaken any fail-closed gate, and no successful GitHub Actions acceptance is claimed.

Second manual run `32899866456` authenticated and passed caller PRE validation, then failed target PRE validation before functional execution. The failure was a repository extraction defect, not target drift: the endpoint returned deployment history and the reader counted historical 100% allocations together. Read-only reconciliation confirmed the unique latest deployment already uses the accepted target version. Both readers now require valid `created_on` timestamps, reject an empty or ambiguous latest history, and inspect only the unique greatest-timestamp deployment's allocation. Safe categorical logging, fail-closed PRE/POST enforcement and the no-mutation boundary remain unchanged; no Cloudflare correction is required or performed.

Third manual run `32902010718` passed caller and target PRE validation and reached the caller's inert fetch discriminator. Cloudflare then recorded one JSRPC `health` call on the acceptance caller ending in a runtime hang exception; query did not run, POST topology was unchanged and cleanup succeeded. The caller's two read methods had returned downstream RPC custom thenables directly. Cloudflare documents that an RPC client must await such results, so both forwarders now await and return the resolved structured result. Rejections propagate unchanged. The caller still owns no storage or credential and exposes no ingest method; its only binding remains `DATA_PLATFORM_READ -> teamsheet-data-platform -> DataPlatformReadEntrypoint`. This repository correction does not prove live acceptance or authorize another run.

PR #156 merged awaited forwarding, but subsequent live evidence remained on old caller version `43d28a3a-5720-48b3-950e-b081e33bcc8b` because repository merge does not deploy the caller. The corrected caller alone was deployed from exact main as `cf9c150d-84b0-46f9-a166-530b7243e863` at 100%, and the workflow pin now matches it. Post-deployment reads confirmed the same single read Service Binding, disabled `workers.dev` and Preview URLs, zero Custom Domains and no added storage or credential capability. The target remained on `5edbe951-4be4-46bc-b2cf-17b550396105`; no D1, ingest, Access, DNS/domain, route or secret change occurred. Deployment does not prove RPC acceptance, and dispatch remains separately owner-approved.

Run `32906524221` used the corrected caller but its `health` JSRPC still hung after the caller fetch arrived; PRE/POST topology and cleanup passed. Root cause remains unproved. Option 2 now limits functional acceptance to one direct remote Service Binding from the temporary local probe to `teamsheet-data-platform`'s named `DataPlatformReadEntrypoint`. The probe receives neither D1 nor the ingest entrypoint and has no arbitrary service input, public route or production deployment command. The deployed caller remains unchanged and independently version-checked in PRE/POST; a direct-target result is never treated as caller-forwarding evidence, which remains `NOT PROVEN`.

<!-- DATA-S1C-2026-08-25 -->
## DATA-S1 private machine capability

DATA-S1C uses a named Cloudflare Service Binding as the future Worker-to-Worker capability; it adds no shared secret or HTTP authentication bypass. Split read/ingest RPC entrypoints expose only explicit methods and share the DATA-S1 operation layer. `teamsheet-data-platform` remains the sole D1 owner, while the retained external HTTP surface still authenticates bearer credentials before routing, parsing or storage access. Live Access, hostname and bearer cleanup remain separate approval gates. See [DATA-S1C private Service Binding and RPC architecture](DATA-S1C-PRIVATE-SERVICE-BINDING-RPC.md).

<!-- GW1-P2C5-CURRENT-2026-08-22 -->
## GW1-P2C5 security closeout

Only sanitized C5 facts are retained: fixed synthetic identity, browser terminal status, accepted receipt/manifest fields, non-sensitive R2 metadata, sizes, stored SHA-256 and custody timestamps. No evidence body, Access identity/JWT/cookie, subject hash, IP/network data, secret or authorization material is recorded. Read-only D1 queries wrote zero rows; the R2 operation was metadata-only. The synthetic record remains untouched, the temporary client was closed unmerged, and Worker/Access/DNS/D1/R2 configuration did not change. See [GW1-P2C5 closeout](GW1-P2C5-STAGE10-PRODUCTION-PATH-ACCEPTANCE-CLOSEOUT.md).

<!-- GW1-P2C3B-CURRENT-2026-08-22 -->
## GW1-P2C3B security record

Only sanitized transport facts are committed: physical iPhone Safari with Prevent Cross-Site Tracking ON directly reported same-site transport; OPTIONS returned 204; matching invalid `{}` POST returned readable 422 `envelope_schema`. No raw Worker log JSON, IP/location/network data, Access JWT/cookie/email/audience/account identifier, authorization material, TLS fingerprint data, secret or token is stored here. Literal physical ACAO, ACAC and `Vary` response values were not directly captured. Existing exact-origin controls and all legacy rollback protection remain unchanged.


<!-- GW1-P2C2-CURRENT-2026-08-21 -->
## GW1-P2C2 transport security boundary — 21 August 2026

The repository candidate narrows browser archive delivery to the exact endpoint `https://archive.fpltsheet.co.uk/v1/evidence/predeadline` from the intended application origin `https://app.fpltsheet.co.uk`. Sibling hosts are same-site but cross-origin, so the archive must still return the exact approved `Access-Control-Allow-Origin` together with `Access-Control-Allow-Credentials: true`; `*`, preview wildcards and reflective arbitrary origins remain forbidden. Cloudflare Access remains an authentication boundary and its JWTs/cookies, audience values and team-domain details must never be persisted, rendered or logged by Teamsheet.

PR #137's Worker adapter remains the single browser CORS credential authority. GW1-P2C2 does not weaken archive JWT validation, D1/R2 privacy, provider-retention fail-closed behaviour or the separation between cloud custody and recommendations. The dual Official FPL gateway allowlist is temporary exact-origin rollback support, not a trust expansion to arbitrary `fpltsheet.co.uk` subdomains. Live DNS/Access/Custom Domain state is outside repository evidence and requires separate verification.


## 12 August 2026 — external intelligence adds no origin, key or secret

The External Intelligence Foundation checkpoint is documentation only. It adds **no** network origin, endpoint, credential, API key, relay, storage surface or CSP change, and the deployed application is byte-unchanged. The generated single script and style remain SHA-256 locked by CSP, so no researched source could be contacted from the current build even if someone tried.

[External Intelligence Foundation](EXTERNAL-INTELLIGENCE-FOUNDATION.md) does set security conditions that a future, separately approved implementation must satisfy. Raw provider payloads are transient by default even where normalised facts may be retained, so only the fields needed to reproduce an accepted observation and its provenance are kept. Every source carries an explicit rights/retention classification and an unresolved position fails closed rather than defaulting to retention. No API key, keyed URL, cookie, token or account identifier may enter a shadow record — the contingency Shadow Odds shape in that document is deliberately limited to normalised derived values for exactly this reason, and the existing direct-only Odds boundary under D-06/SEC-1 is unchanged and unrelaxed. A shadow failure must not alter production behaviour or manufacture Provider Health, and no bookmaker-level raw export may be created that would amount to reconstructing a provider's feed for others.

Existing boundaries are untouched: Anthropic keys remain banned client-side, Understat remains team-level relay-only, permanent Understat- and Odds-derived server retention remains fail-closed, and League and manager identifiers stay out of routes, page titles, provider diagnostics and Stage 10 evidence.

## 11 August 2026 — GW1-P1 cloud-evidence security reconciliation

GW1-P1 adds a second, deliberately isolated Cloudflare Worker for canonical Stage 10 evidence custody. The evidence Worker is protected by owner-only Cloudflare Access, validates `Cf-Access-Jwt-Assertion` itself, writes exact canonical evidence only to private R2, and stores only the minimal manifest/receipt/index state in D1. `TEAM_DOMAIN` and `POLICY_AUD` remain runtime configuration and are not committed.

The Teamsheet browser was **not** connected to this service in GW1-P1. GW1-P2 connects it. No permanent browser service token, generic SQL/R2 route, new provider acquisition path or application secret is introduced by either checkpoint.

GW1-P2's browser upload is a credentialled cross-origin request carrying the owner's Cloudflare Access session. The evidence Worker therefore answers with an exact allowlisted origin plus `Access-Control-Allow-Credentials: true`; the CORS wildcard is forbidden for credentialled responses and is never emitted, and allowing credentials widens no origin, method or route allowlist. Access still authenticates every non-preflight request. The client reads, writes and logs no token, cookie, team domain or policy audience; every user-facing archiving message is a fixed local literal, and every stored delivery outcome is one of a closed set of local category strings. A Worker origin/configuration rejection is classified separately from an Access identity gap so a known deployment defect cannot sit in an indefinite authentication retry loop. **Cloudflare Access CORS/preflight state is live dashboard configuration and is not evidenced by repository configuration.** The approved arrangement enables only Cloudflare Access's **“Bypass OPTIONS requests to origin”** setting, leaving the Worker as the sole owner of exact allowed-origin CORS enforcement; no Access-layer allowed-origin response is configured, no Access policy for `POST`, `GET` or any other method changes, and no wildcard `Access-Control-Allow-Origin` exists anywhere. Permanent tests prove that with authentication denied the approved-origin preflight still returns 204 with credentials allowed and no wildcard, an absent or foreign origin is refused at the preflight, and `POST /v1/evidence/predeadline`, `GET /v1/health`, `GET /v1/evidence/{hash}` and `POST /v1/admin/reconcile` all fail closed.

**Owner confirmation of that live configuration is recorded.** Pritesh opened the `teamsheet-evidence-archive` Zero Trust Access application and enabled and saved **“Bypass OPTIONS requests to origin”**, and configured **no** Access-layer allowed-origin response. The security boundary is therefore unchanged and still holds in full: the Worker remains the sole owner of exact allowed-origin CORS enforcement, `POST`, `GET` and admin routes remain Access-protected with no policy change, and no wildcard `Access-Control-Allow-Origin` exists anywhere. Access only bypasses unauthenticated `OPTIONS` to the origin. This closes the configuration step, not the transport question: whether physical iPhone Safari with Prevent Cross-Site Tracking ON will send the Access session on the credentialled cross-site background upload is still unproven and remains the outstanding GW1-P2 acceptance gate. Live dashboard state is still not evidenced by repository configuration, so any later redeploy or dashboard change must be re-confirmed separately. `TEAM_DOMAIN`, `POLICY_AUD`, Access JWTs and cookies must never be printed, pasted or logged while configuring or testing it.

Cloudflare Preview URLs are a separate routing surface from the production `workers.dev` hostname. The GW1-P1 candidate therefore explicitly sets `preview_urls: false` in both byte-identical evidence Wrangler configs and tests that invariant. The production `workers.dev` route remains enabled behind its accepted Access policy. Repository configuration is never by itself proof of the currently deployed dashboard state, so live route evidence is required. That evidence was supplied by the project owner on 11 August 2026 at 19:22 BST as a physical iPhone Safari screenshot of the Worker's Cloudflare **Domains** screen: production `teamsheet-evidence-archive.fpltsheet.workers.dev` enabled and marked **Restricted** with the Access sign-in requirement, and the wildcard Preview hostname `*-teamsheet-evidence-archive.fpltsheet.workers.dev` disabled. This closes the preview/version security acceptance item. It is owner-supplied dashboard evidence and is not claimed as independent assistant dashboard or device testing.

## 10 August 2026 — error disclosure and trust ownership

PR #107 is merged and the fail-closed calibration trust boundary is active. EB-1 adds no network origin, credential, secret, provider or backend. Its security consequence is narrower: raw unexpected exception objects remain available only to returned diagnostic/test objects, while user-visible error copy stays fixed and safe. Application exceptions cannot be converted into Provider Health evidence, and no `window.onerror` or `unhandledrejection` swallowing/logging layer is introduced.

Provider warnings continue to avoid raw endpoints, relay errors, keys and identifiers. Odds-key scrubbing, direct-only transport, CSP, Official FPL gateway controls and Stage 10 privacy boundaries are unchanged.

## GW1-P1 D1/R2 security boundary

The approved [Data Architecture D1](DATA-ARCHITECTURE-D1.md) selected a separate authenticated data Worker, private R2, short-lived browser authentication, origin/CSRF/rate/payload controls and Worker-held runtime configuration. GW1-P1 implements the backend-only foundation of that boundary: owner-authenticated routes, exact-origin CORS, payload/rate limits, private R2, D1 manifest/receipts, bounded reconciliation and generic/redacted failures. The static client still contains no permanent service token, database credential, Odds key relay or Anthropic/OpenAI secret.

Manager/team, manual-squad and league/rival data remain outside the GW1-P1 server contract. Understat/Odds permanent retention defaults fail-closed pending separately approved rights. Future AI access remains constrained to audited, field-allowlisted, read-only views and is not part of GW1-P1.
Purpose: security posture record. Audience: all sessions; Stage 3 implementers especially.
Last reconciled: 2026-08-12. Related: STAGE3-DESIGN.md, STAGE10-ITEM3.md, KNOWN_LIMITATIONS.md, DECISIONS.md, GW1-P1-CLOUDFLARE-EVIDENCE-FOUNDATION.md, EXTERNAL-INTELLIGENCE-FOUNDATION.md.

## Current architecture
Static single-file application on GitHub Pages plus two owner-controlled, zero-dependency Cloudflare service boundaries:

- the existing narrow read-only Official FPL transport gateway at `https://teamsheet-fpl-gateway.fpltsheet.workers.dev`;
- the separate GW1-P1 evidence archive Worker, protected by Cloudflare Access and backed by private R2 plus D1.

The browser currently calls only the Official FPL gateway. GW1-P1 does not add application/client evidence sync; that remains GW1-P2. Stage 3 security hardening remains complete and merged through PR #6 at `3f662b7e133ce2995da74c5e52165ae84744e120`.

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

## GW1-P1 evidence archive security

Every non-preflight evidence route requires a valid Cloudflare Access JWT. The zero-dependency verifier accepts RS256 only, resolves the current Access JWKS from the configured `*.cloudflareaccess.com` team domain, selects by `kid`, verifies signature/issuer/audience/time claims and requires a non-empty subject. Auth failures exposed to the browser are generic; raw JWTs and cookies are never logged.

The archive exposes only fixed health/ingest/manifest/reconciliation routes. It has no generic D1 query surface and no raw R2 download endpoint. R2 remains private and D1/R2 are available only through Worker bindings. Exact allowed origins, request-size limits and authenticated-subject rate limits are enforced. Diagnostics use bounded redacted failure categories and must not contain manager/team names, FPL Team ID, league/rival IDs, Access JWT/cookies, Odds keys or keyed Odds URLs.

The persistence order is security- and integrity-relevant: an accepted canonical record is written and verified in R2 before D1 may claim custody. If R2 fails there is no D1 claim; if D1 fails after R2, the object is an invisible orphan that may later be reconciled only after the same canonical/body/metadata checks. Reconciliation preserves the original R2 upload time rather than inventing earlier custody.

The source and isolated deployment Wrangler configs explicitly disable `preview_urls`. This removes routing to both versioned and aliased Preview URLs after deployment under current Cloudflare behaviour. The repository test prevents accidental reversion to an implicit preview setting. Live Cloudflare route state must always be checked separately after a hardened config is deployed; for the current GW1-P1 candidate that check is recorded above from owner-supplied 11 August 2026 dashboard evidence.

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

GW1-P1 likewise changes no application CSP/connect origin because the browser is not yet connected to the evidence Worker. Any future client origin/auth wiring belongs to GW1-P2 and must receive its own security review.

## Deferred triggers
The approved narrow Official FPL transport Worker and the separate GW1-P1 evidence backend are implemented. Evidence Access runtime configuration is Worker-side only. Hosted AI, any OpenAI/Anthropic server secret, moving the existing client-held Odds key server-side, authenticated/private FPL access, server-enforced application CSP headers and other provider-secret migrations remain separately deferred and approval-gated.

## Stage 10 evidence security
Evidence construction is allowlist-only and rejects secret-shaped keys or values before finalisation. It never serialises configuration or core state wholesale. Numeric entry and league identifiers are redacted from retry/issue endpoints; FPL Team ID, manager name and league IDs are omitted. A random 128-bit device-local reference is used instead.

Imported JSON is accepted only after schema, section-hash, whole-record-hash and identity verification. Browser recovery records use native gzip where available, but exports are complete unencrypted JSON and must be handled as user-controlled files. Delete controls remove local records; they cannot remove files already exported by the browser.

GW1-P1 accepts only the existing canonical `preDeadlineSnapshot` `local_capture` record and independently revalidates its frozen Stage 10 contract. `recovery_import` cannot become server prospective evidence. Server metadata is kept outside the canonical record so custody does not alter its hash.

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

## A3 user-persistence boundary

User-owned browser records are fail-closed on identity and verified on write.

- Season/version ownership is required before a stored record is restored. The main `fpl:cache`, `fpl:config`, `fpl:squad` and `fpl:mini-leagues` records each carry an explicit version and, where the value belongs to a season, the exact current season. An unversioned, previous-season, unsupported-schema or malformed record is rejected before application state is mutated rather than being promoted to current data. This is a safety boundary, not only a compatibility one: stale account, squad or league state must never be presented as current.
- User-owned writes are read back before being reported as saved. `ssetVerified()` writes and re-reads the record, so "saved" means restorable rather than merely attempted.
- Backend authority is respected. When a storage manager is selected it owns both the write and the next read; `localStorage` is only consulted when the manager read is unusable. A fallback copy is therefore written only when it is the backend the next read will use, so a failed manager write cannot produce a divergent copy that is reported as durable but can never be read.
- A failed write is disclosed, not swallowed. The change stays active for the current session and the app states that it may revert after reload. Local persistence failure is never attributed to Official FPL or an optional provider.
- Ordering protects account state. A manual squad must persist successfully before configuration may durably record `useManual=true`, so a failed squad save cannot leave a durable manual-team setting pointing at stale or absent squad bytes.
- Legacy migration drops rather than guesses. An unversioned configuration record contributes only season-independent preferences; its account state is discarded, and deprecated `claudeKey` material is removed during migration and never rewritten.

The GW1-P1 backend does not change these browser persistence semantics. Until GW1-P2 connects the outbox/upload path, a normal Teamsheet session cannot treat Cloudflare custody as a replacement for local persistence.

## Teamsheet 2.0.4 League privacy boundary

FPL league and manager identifiers are public endpoint identifiers but reveal user-specific competitive relationships when stored together. Teamsheet therefore keeps them out of hash routes, page titles, Provider Health detail, retry issue text and Stage 10 evidence. Versioned local persistence contains only selected/saved league IDs and labels plus selected/pinned rival IDs and labels. Official standings, scores and rival squads are session-only.

Requests remain read-only through the existing Official FPL transport. No cookie, OAuth flow, FPL password, private login, new origin or API key is introduced. Endpoint diagnostics continue to normalise digit runs and strip query strings. Removing a saved league also removes its selected/pinned rival state; it does not attempt to alter Official FPL.

## Teamsheet 2.0.5 selected-rival privacy boundary

The version-3 season-owned Mini-League state may persist an explicitly confirmed comparison group of no more than five public rival IDs and locally displayed labels. It does not persist standings, scores, public picks, captaincy, chip state or derived exposure.

The new `#/leagues/exposure` route contains no league, manager, player, Team or Gameweek identifier. Public picks requests remain read-only through the existing Official FPL transport, use bounded concurrency and do not introduce authentication, cookies, account writes, a CSP origin or a provider. Raw rival identifiers remain excluded from Provider Health, Stage 10 evidence and endpoint diagnostics. Removing a league clears its selected comparison group locally.

## Teamsheet 2.0.6 navigation and diagnostic privacy boundary

Every Settings route is semantic and identifier-free. Team, league, manager, rival, API-key, snapshot and record identifiers remain outside hashes and page titles. Build identity displays only public model/rules/commit/source fields already emitted by the deterministic build.

Full provider notes and freshness remain under Provider Health. Primary warnings use fixed application copy derived from approved core states and consequences; they do not render endpoint URLs, transport details or arbitrary provider errors. Existing diagnostic scrubbing remains the boundary for recovery warnings.

Moving restore, export and deletion controls changes no trust rule. Imported snapshots/outcomes remain recovery-only, exports remain complete unencrypted user-controlled files and deleting browser records cannot delete downloaded files. Odds-key masking, direct-only transport, omission from diagnostics and one-action deletion remain unchanged. No origin, CSP permission, authentication, analytics or persistent health history is added.


## Teamsheet 2.0.7 security boundary

Final-polish work adds no network origin, provider, authentication, secret, backend, service worker or account-write route. Hosted Ask is disabled before submission and states that no Anthropic key is accepted or stored. The artifact-preview keyless path remains the only approved AI transport. Restricted startup rendering and route/focus changes are presentation-only and cannot make recovery records official or alter recommendations.

## FPL-T1 Official FPL gateway security boundary
The Worker is not a generic proxy: upstream host and path families are fixed, methods are read-only, query names and numeric ranges are allowlisted, and browser cookies, authorization headers and arbitrary headers are never forwarded. The browser receives CORS only for exact approved origins. The gateway holds no FPL password, account cookie, Odds key or Anthropic key and performs no account write. Dynamic account and league responses are no-store; only bootstrap and unfiltered fixtures may use a five-minute shared cache. Ordinary platform request metadata may still be visible to the infrastructure host and must not be described as private from Cloudflare.


<!-- DATA-S1-2026-08-22 -->
## DATA-S1 repository foundation — 22 August 2026

The separately approved [DATA-S1 Shadow Structured Data Foundation](DATA-S1-SHADOW-STRUCTURED-DATA-FOUNDATION.md) adds the isolated, provider-neutral `teamsheet-data-platform` repository service and separate future `teamsheet-data` D1 binding. Only `shadow_only` is valid. It has no production/browser/model/Provider Health read path, no new R2, no provider activation and no Google Sheets integration; existing Stage 10 D1/R2 custody remains separate and unchanged. No live infrastructure was created or modified. PR #145 is merged and repository-verified, but DATA-S1 remains **not live deployed**. DATA-S1A is the current control reconciliation. The separately owner-gated sequence is DATA-S1B live Cloudflare preflight/deployment/acceptance, DATA-S2 Official FPL structured history, DATA-S3 automated Official outcomes, DATA-S4 provider trials/evaluation, DATA-S5 downstream Sheets automation, then later explicit production/model gates. See the [DATA-S1B plan](DATA-S1B-LIVE-DEPLOYMENT-ACCEPTANCE-PLAN.md).

Effective **22 August 2026**, the owner superseded the blanket £0 recurring-cost constraint: free remains preferred where comparable, while a small paid provider may be considered only with explicit pricing, rights and value/cost justification, preferably after a shadow trial. This approves no provider and does not rewrite historical research conducted under the former constraint.
