> **Current status — 22 September 2026:** PR #286 is merged as `fda5a45ccd86928f60d91e8e34ded79ff49064da`. Post-merge Verify `35699898106` and Pages `35699897564` succeeded. This acceptance foundation is repository-merged, but no live attended Version, secret provisioning, D1 credential transition, Preview toggle or API-Football request has occurred. The next repository checkpoint is the separately gated [attended preparation foundation](API-FOOTBALL-ATTENDED-PREPARATION-FOUNDATION.md).

# API-Football Attended One-Shot Discovery Acceptance Foundation

## Approval and observed status

Pritesh approved repository remediation only. No live **API-Football collector** Cloudflare mutation, attended Version upload, collector Preview enablement, production D1 mutation, provider execution, Deployment or Cron occurred as part of this task. Cloudflare Git integration separately processed the PR branch for the existing `teamsheet-fpl-gateway` and published its ordinary commit/branch Preview URLs; that unrelated automated project activity is not evidence that `teamsheet-api-football-shadow-collector` was uploaded, routed or executed.

Checked-in collector configuration remains `REPOSITORY_ONLY_BLOCKED`, placeholder-D1, secret-free, Cron-free, `workers_dev=false` and `preview_urls=false`. Repository presence and merge grant no live authority.

## Exact final Version construction and proof

The executable contract no longer pretends that `{name,type:'secret_text'}` is a valid secret-bearing upload. Cloudflare's documented `versions upload --secrets-file` lifecycle uploads code and up to 100 secrets together as one new inactive Version. The repository models that exact multipart Version upload: two runtime-only secret values become `secret_text` bindings inside the ephemeral multipart request, never a retained report or repository object. The expected read-back contract exposes only their names/types.

A future separately approved preparation starts with the one original blocked Version, uploads one final attended Version containing reviewed code and both secrets, and leaves Deployment count zero. The resulting Version ID must differ from the original. Mutation rejection or ambiguity stops without retry. No secret preparation runs in the acceptance-execution job.

Admission derives the reviewed identity from exact approved SHA and the existing closed transitive module graph. It reads both stable Version metadata and the Beta Worker Version detail with `include=modules`, then proves:

- exact final Version UUID;
- exact approved-SHA message/tag provenance;
- exact module-name set and SHA-256 of every returned module byte sequence;
- exact main module and compatibility date;
- exact production `TEAMSHEET_DATA_DB` binding;
- exact season/activation plain-text bindings;
- exactly `API_FOOTBALL_API_KEY` and `API_FOOTBALL_ATTENDED_TRIGGER_SECRET` as secret bindings;
- no unexpected binding or module.

No invented `metadata_sha256` field is used. If either content-bearing API response is absent or malformed, admission fails closed.

## Worker-wide Preview exposure and URL identity

`previews_enabled` is Worker-wide. Admission therefore permits exactly two Versions:

1. original inactive Version `e49ac8f2-4289-46bc-9f0b-87a20cd7be62`, still exact blocked activation, production D1 binding, three expected plain-text values and no secret;
2. exact reviewed final secret-bearing attended Version.

An unexpected third Version, wrong attended Version, activated/secret-bearing original, or any unreadable Version stops before Preview enablement. Nothing is automatically deleted.

The executor accepts no free-form Preview URL. Before mutation it reads trusted Worker and account subdomain metadata. Cloudflare documents Version Preview URLs as `<first-8-Version-ID>-<Worker>.<account-subdomain>.workers.dev`; Wrangler likewise derives the prefix from `versionId.slice(0,8)` plus API-returned `preview_url_suffix`. Repository logic requires exact HTTPS hostname, Worker name, account subdomain, prefix and path, with no port, credentials, query or fragment. Trigger secret egress occurs only after this proof.

## Admission, execution and artifact handoff

The workflow remains manual, first-attempt-only and exact-current-main. It requires an exact-head `Tests and deterministic build` check from `github-actions` whose details URL belongs to this repository's Actions runs. Current-main and clean-tree gates repeat after read-only environment admission, after mutation-capable environment admission and immediately before mutation.

Read-only admission binds its sanitized artifact to exact approved SHA, final Version ID, observation timestamp, attended stage, production-account fingerprint, exact classification and zero mutation/provider/secret-read counters. Direct non-sensitive job outputs carry expected identities and artifact SHA-256; execution verifies both file hash and internal identity before any network mutation.

Only then may the protected executor:

1. verify the production account fingerprint before any Cloudflare request;
2. perform a fresh full attended read-only preflight inside the mutation-capable job using the exact approved SHA and Version, re-proving the two-Version inventory and target module bytes, original blocked Version, production D1 binding, zero Deployments/Cron/routes/domains, workers.dev/Preview disabled, pristine runtime/history and all foundational authority/mapping invariants;
3. derive the exact Preview URL from that fresh preflight's API-returned Preview suffix and account subdomain;
4. enable Worker-wide Preview URLs only if the fresh critical recheck still passes;
5. enable D1 collection;
6. send exactly one authenticated POST to the derived exact Version URL;
7. disable collection regardless of invocation outcome;
8. disable Preview URLs regardless of invocation outcome;
9. stop for independent read-only reconciliation.

The fresh critical recheck is the final network observation before `previews_enabled=true`; drift between the earlier artifact admission and mutation-capable execution therefore fails before any Preview mutation, D1 enablement or trigger-secret egress.

A closed request allowlist admits only Worker-subdomain GET/POST, account-subdomain GET and the exact production D1 query POST. Deployment, Cron, route, domain, Access and arbitrary endpoints fail before fetch.

Only `{requestCount:1,outcome:'ACCEPTED'}` reaches invocation-complete state. Timeout, exception, unknown delivery, malformed/unexpected response or HTTP rejection is a hard reconciliation-required failure with `retryAuthorized=false`; cleanup still runs and no second invocation exists.

## D1 budgets and credential lifecycle

Collector data-path limits remain unchanged: 50 total statements, 43 mutations, 7 reads and at most 7,525 rows written for the five-request generation.

Acceptance control mutations are a separate envelope: exactly two D1 calls/statements and at most two changed rows—one collection enable and one collection disable. Independent read-only admission/reconciliation uses one bounded D1 batch each and is outside the collector mutation envelope.

Credential preparation is a separate earlier gate, capped at one D1 call/statement/row. Runtime may move from `UNPROVISIONED` to `AVAILABLE` only after exact final secret-bearing Version and closed inventory are proven while collection is disabled. Acceptance preflight requires `AVAILABLE`. It remains `AVAILABLE` after execution/reconciliation while the secret-bearing Version exists. A later separately approved cleanup may reset to `UNPROVISIONED`, capped at one D1 call/statement/row, only after secret-bearing Version removal is independently proven. The acceptance workflow neither marks availability nor resets credentials.

## Independent post-run reconciliation

An `always()` read-only job uses the protected steward environment after execution success or failure. It re-reads exact content/inventory, routing, Deployment/Cron state and one fixed read-only D1 batch. Sanitized evidence distinguishes exact five attempt-1 successes and one committed/head-consistent generation from auth, quota, timeout, transport, schema, HTTP, reservation/lease, persistence, completion, commit, cleanup and inventory ambiguity. Every non-clean state returns `retryAuthorized=false`; no repair, provider retry or destructive cleanup occurs.

Success requires collection and Preview disabled, workers.dev disabled, zero Deployments/Cron/routes/domains, credential `AVAILABLE`, no lease, exactly five attempt-1 `SUCCEEDED` rows, no attempt 2/RESERVED row, exactly one committed generation, matching head and membership, 0–2,500 fixture revisions, exact Version inventory, zero model/UI imports and no raw-payload storage surface. In addition, the underlying post-run live preflight must have stopped **only** for the expected `first_acceptance_history_not_pristine` reason; migrations 0001–0006, zero foreign-key violations, fresh exact-20 Official FPL authority, committed exact 20/20 mapping and all attended infrastructure/content invariants must still be valid. A stale authority, mapping drift, migration drift, FK violation or other foundational stop can never be reclassified as success. The reconciliation artifact includes these sanitized aggregate foundation fields but excludes account IDs, tokens, secrets, raw provider payloads and private mapping pairs.

## Preserved provider/model boundary and remaining gate

Discovery remains exactly five `GET /fixtures?league=<id>&season=2026` requests for leagues `2`, `3`, `848`, `45`, `48`; timeout 15,000 ms; response ceiling 720,896 bytes; 2,000 rows/response; 2,500 fixtures/generation; 1,000 ms spacing; five HTTP attempts maximum; no attempt 2 or automatic retry. No lineup, player, event, workload, model or UI path is added.

No real attended Version upload, collector secret provisioning, runtime credential mutation, Versioned Preview toggle, collector invocation, provider request, reconciliation, Version deletion or staging-token cleanup is proven here. Each remains separately owner-gated after merge and exact-main verification.
