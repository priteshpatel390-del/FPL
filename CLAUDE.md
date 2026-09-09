<!-- DATA-OPS-A1-3-2026-09-09-LIVE-ACCEPTANCE -->
### Current Data-Ops checkpoint — A1.3 live read-only observer ACCEPTED (manual); scheduled activation still separate

**Supersedes the Cron semantic-normalisation block below as the current status; that remediation merged as PR #238, post-merge `main` is `174a7ece2f6c52257902c79ac9a46de846edeb91`, and exact-`main` Verify succeeded (run `34345865860`, run number 662, event `push`).** After that merge and Verify, the owner performed a seventh attended `Data Steward Read-Only Observer` dispatch: workflow run `34346126189`, run number 8, event `workflow_dispatch`, branch `main`, head SHA `174a7ece2f6c52257902c79ac9a46de846edeb91`, job `observe-production-chain` (job id `102448024505`), job result **SUCCESS**.

**FACT: this run is A1.3's first complete live HEALTHY observation, and it is a live technical acceptance, not a scheduled-monitoring claim.** Sanitized output:

```json
{"dayDate":"2026-09-09","verdict":"HEALTHY","evaluationReason":"HEALTHY_EXPECTED_STATE",
 "heartbeat":"COMPLETE","escalationRequired":false,
 "sentinels":[
   {"sentinel":"cloudflare","state":"OBSERVED","reasonCode":"CLOUDFLARE_CONFIGURATION_OBSERVED"},
   {"sentinel":"d1","state":"OBSERVED","reasonCode":"D1_STATE_OBSERVED","rowsRead":89066},
   {"sentinel":"github","state":"OBSERVED","reasonCode":"GITHUB_CHAIN_OBSERVED"}]}
```

All three sentinels observed successfully in one live evaluation; heartbeat `COMPLETE`; no escalation. Runtime credentials remained masked in the job logs throughout, per the PR #233 remediation. No collection, repair, D1 write, Cloudflare mutation or schedule activation occurred — the observer remains strictly read-only.

**Interpretation, stated precisely.** The merged PR #238 Cron semantic canonicaliser was sufficient for the live Cloudflare `/schedules` response to be observed and matched against the three approved expressions. This proves the observer runtime is operational end to end against live production Cloudflare, D1 and GitHub state on exact verified `main`. It does **not** prove scheduled/automatic monitoring is active — `DATA_STEWARD_SCHEDULED_ENABLED` was neither read nor changed by this run, remains unset, and scheduled execution stays fail-closed unless a later, separate, explicit owner action sets it to exact lowercase `true`. A1.3 remains observe-only: no actuator, no repair authority, no AI authority, no persistent incident store, no autonomous repository edit, no Cloudflare mutation capability, no D1 write capability, no auto-merge capability. It must never be described as autonomous remediation or as continuously-active monitoring.

**Remaining limitations, unchanged by this acceptance.** A GitHub-hosted observer cannot independently detect a total GitHub outage or a complete absence of its own scheduled runs. There is no independent persistent heartbeat/watchdog outside GitHub Actions run history and this sanitized output. Cloudflare per-fire dispatcher invocation history remains unobservable through any repository-proven read-only API (`CLOUDFLARE_INVOCATION_HISTORY_UNOBSERVABLE`, restated on every successful read). D1 read-cost/bounds remain exactly as designed. None of these are resolved by this run, and none are claimed to be.

**Next owner gate, in order:** (1) owner reviews and approves this documentation-only closeout PR; (2) merge only after explicit owner approval; (3) exact-`main` Verify success on the merged commit; (4) a **separate, explicit** owner decision whether to set `DATA_STEWARD_SCHEDULED_ENABLED=true` and activate scheduled observation — not implied, not assumed, and not part of this closeout. See [A1.3](docs/DATA-OPS-A1-3-LIVE-READONLY-OBSERVER.md).

<!-- DATA-OPS-A1-3-2026-09-09-CRON-SEMANTIC-NORMALISATION -->
### Current Data-Ops checkpoint — A1.3 Cloudflare Cron semantic normalisation, merged as PR #238

**Its checkpoint status is superseded by the live-acceptance block above; its design and evidence below remain accurate as a record and are retained.** This remediation merged as **PR #238**. The owner performed a sixth attended `Data Steward Read-Only Observer` dispatch: workflow run `34342701912`, run number 7, event `workflow_dispatch`, branch `main`, head SHA `dfc78882a507e90662f2937582ab0b35af34bdec`. **This was not, by itself, a live acceptance.** No collection, repair, D1 write, schedule activation or Cloudflare mutation occurred.

**FACT: the payload-decode split above now correctly narrows to a single predicate.** GitHub sentinel `OBSERVED` / `GITHUB_CHAIN_OBSERVED`. D1 sentinel `OBSERVED` / `D1_STATE_OBSERVED`, `rowsRead: 89066`. Cloudflare sentinel `OBSERVATION_FAILED` / `CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED` — identity admission, HTTP 200, JSON parsing, envelope decoding, result-shape and array-bound checks all passed; a row's cron value was a string but the then-current per-field-length Cron pattern rejected it.

**FACT: owner Cloudflare dashboard evidence showed the correct schedule semantics represented in an unexpected text encoding.** `teamsheet-data-s2-dispatcher` shows exactly three live Cron Triggers at 01:17/02:17/03:17 UTC, matching the repository-declared production crons. Its Cron-expression view for the 01:17 trigger displayed an expanded day-of-month field beginning `17 1 1,2,3,...` rather than the repository's textual wildcard `17 1 * * *` — proving Cloudflare can legitimately represent a daily schedule as a complete day-of-month enumeration rather than only as `*`.

**ROOT CAUSE:** the observer required byte-identical Cron text rather than comparing schedule semantics, and its per-field 16-character bound could reject a legitimate full-domain enumeration before any semantic comparison ran.

**IMPLEMENTATION:** a narrow deterministic canonicaliser for exactly the supported schedule subset — minute `0`-`59`, hour `0`-`23`, day-of-month either `*` or the complete `1`..`31` domain (folded to `*`), month and day-of-week always `*` — replaces the old per-field regex inside the same single-pass `analyseSchedulesPayload()` from PR #237. Two valid Cloudflare encodings of the same schedule now compare equal; `cronSetMatches()` still requires the canonicalised set to equal the three approved expressions exactly, so a different-but-parseable schedule still reaches `CLOUDFLARE_CRON_SET_MISMATCH` rather than being accepted. The five closed payload-decode categories from PR #237 are unchanged and unremoved.

**Do not claim.** This checkpoint does not yet claim live success, A1.3 acceptance, or scheduled activation. Wider documentation cleanup stays deferred until after live acceptance, per explicit owner instruction.

**Next live gate, in order:** (1) owner reviews and approves this PR; (2) merge only after explicit owner approval; (3) exact-`main` Verify success on the merged commit; (4) one further attended manual observer dispatch; (5) if Cloudflare, D1 and GitHub all observe successfully, evaluate A1.3 live acceptance; (6) perform final documentation reconciliation; (7) scheduled activation remains a later, separate, still-unapproved gate. See [A1.3](docs/DATA-OPS-A1-3-LIVE-READONLY-OBSERVER.md).

<!-- DATA-OPS-A1-3-2026-09-09-SCHEDULES-PAYLOAD-DECODE -->
### Current Data-Ops checkpoint — A1.3 `decodeSchedules` payload-decode diagnostic split, merged as PR #237

**Supersedes the response-layer block below as the current status; that remediation merged as PR #236, and post-merge `main` is `dea6a3239443970dd2e5495fe7759e187fb34e20` with exact-`main` Verify success.** The owner performed a fifth attended `Data Steward Read-Only Observer` dispatch: workflow run `34325772296`, run number 5, event `workflow_dispatch`, branch `main`, head SHA `dea6a3239443970dd2e5495fe7759e187fb34e20`. **This is not a live acceptance.** No collection, repair, D1 write, schedule activation or Cloudflare mutation occurred.

**FACT: identity admission continues to succeed, and the response-layer decoding above now succeeds in full.** GitHub sentinel `OBSERVED` / `GITHUB_CHAIN_OBSERVED`. D1 sentinel `OBSERVED` / `D1_STATE_OBSERVED`, `rowsRead: 89066`. Cloudflare sentinel `OBSERVATION_FAILED` / `CLOUDFLARE_SCHEDULES_PAYLOAD_INVALID` — the request did not classify as JSON-parse failure or envelope-decode failure, so `response.json()` and the existing `decodeEnvelope()` both succeeded. That rules out every other broad `/schedules` category for this run and places the failure precisely inside the existing `decodeSchedules()`. Protected runtime values remained masked throughout, per the PR #233 remediation.

**FACT: `decodeSchedules()`'s own predicates were still collapsed into one code.** `CLOUDFLARE_SCHEDULES_PAYLOAD_INVALID` collapsed five distinct predicates into one code: the decoded result not being an object (or being an array), `result.schedules` being missing or non-array, the array exceeding the existing 16-entry bound, a row's cron value not being a string, and a cron string failing the existing `CRON` regular expression. This checkpoint replaces it with five closed categories, evaluated in the exact order `decodeSchedules()` always checked them: `CLOUDFLARE_SCHEDULES_RESULT_INVALID`, `CLOUDFLARE_SCHEDULES_ARRAY_INVALID`, `CLOUDFLARE_SCHEDULES_COUNT_EXCEEDED`, `CLOUDFLARE_SCHEDULES_CRON_NOT_STRING`, `CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED`. Which predicate first rejected the live result is read only inside the sentinel to select one of these enums; it, any parsed or raw response body, object keys, schedule entries, any Cron expression, row index, schedule count, provider body, message, header, URL, account id, token, fingerprint or caught exception text never leave the sentinel. `decodeSchedules()` is not modified in its accepted behaviour — a new pure function `classifySchedulesPayload(result)` is the single shared definition of its predicates, and `decodeSchedules()` is now derived from it rather than repeating them, so the two can never drift into different notions of "valid"; a permanent test proves they can never disagree. The `CRON` regular expression, the 16-entry bound, string-row acceptance and `row.cron` extraction are all byte-identical to before. `CLOUDFLARE_SCHEDULES_AUTH_REFUSED`, `CLOUDFLARE_SCHEDULES_NOT_FOUND`, `CLOUDFLARE_SCHEDULES_HTTP_FAILED`, `CLOUDFLARE_SCHEDULES_TRANSPORT_FAILED`, `CLOUDFLARE_SCHEDULES_JSON_INVALID` and `CLOUDFLARE_SCHEDULES_ENVELOPE_INVALID` are unchanged; `/deployments` and `/settings` are unchanged and keep their single collapsed codes; no decoder behaviour, endpoint, path, method, timeout, read order, read cap or credential contract changed.

**Do not claim.** This checkpoint does not claim which of the five predicates is the cause, does not claim Cloudflare's documentation is wrong, does not claim the repository's decoder is wrong, and does not claim A1.3 is live accepted. The precise underlying cause is still unknown until the next attended dispatch reports one of the five new codes.

**Next live gate, in order:** (1) owner reviews and approves this PR; (2) merge only after explicit owner approval; (3) exact-`main` Verify success on the merged commit; (4) one further attended manual observer dispatch; (5) read the new closed payload-decode category code to identify the precise underlying cause; (6) only then propose the actual correction — configuration, credential permission, response-contract correction, or another cause; (7) scheduled activation remains a later, separate, still-unapproved gate. See [A1.3](docs/DATA-OPS-A1-3-LIVE-READONLY-OBSERVER.md).

<!-- DATA-OPS-A1-3-2026-09-09-SCHEDULES-RESPONSE-LAYER -->
### Current Data-Ops checkpoint — A1.3 /schedules response-layer diagnostic split, merged as PR #236

**Its checkpoint status is superseded by the payload-decode block above; its design and evidence below remain accurate as a record and are retained.** This remediation merged as **PR #236**. The owner performed a fourth attended `Data Steward Read-Only Observer` dispatch: workflow run `34319945520`, run number 4, event `workflow_dispatch`, branch `main`, head SHA `90d7851d0084f45577c330e9fa7f1c15432f80c0`. **This is not a live acceptance.** No collection, repair, D1 write, schedule activation or Cloudflare mutation occurred.

**FACT: identity admission continues to succeed, and the request now reaches HTTP 200.** GitHub sentinel `OBSERVED` / `GITHUB_CHAIN_OBSERVED`. D1 sentinel `OBSERVED` / `D1_STATE_OBSERVED`, `rowsRead: 89066`. Cloudflare sentinel `OBSERVATION_FAILED` / `CLOUDFLARE_SCHEDULES_RESPONSE_INVALID` — the request did not classify as an auth refusal, a not-found, any other non-200 status, or a transport failure, so it reached response processing after a successful HTTP 200. That rules out the four other broad `/schedules` categories for this run and places the failure somewhere inside HTTP-200 response processing. Protected runtime values remained masked throughout, per the PR #233 remediation.

**FACT: the response-processing code was itself still ambiguous.** `CLOUDFLARE_SCHEDULES_RESPONSE_INVALID` collapsed three distinct response-processing layers into one code: the HTTP body failing to parse as JSON, a parsed body failing to decode as a valid Cloudflare envelope, and a valid envelope carrying a result the existing schedules decoder rejects. This checkpoint replaces it with three closed categories: `CLOUDFLARE_SCHEDULES_JSON_INVALID` (HTTP 200; `response.json()` throws), `CLOUDFLARE_SCHEDULES_ENVELOPE_INVALID` (HTTP 200; JSON parses; the existing `decodeEnvelope()` returns null), and `CLOUDFLARE_SCHEDULES_PAYLOAD_INVALID` (HTTP 200; JSON parses; `decodeEnvelope()` succeeds; the existing `decodeSchedules()` returns null). Which step first produced an unusable result is read only inside the sentinel to select one of these enums; it, any parsed or raw response body, object keys, provider body, message, header, URL, account id, token, fingerprint, caught exception text or stack trace never leave the sentinel. `decodeEnvelope()` and `decodeSchedules()` are not modified — both are called exactly as before, just no longer folded into one shared failure code. `CLOUDFLARE_SCHEDULES_AUTH_REFUSED`, `CLOUDFLARE_SCHEDULES_NOT_FOUND`, `CLOUDFLARE_SCHEDULES_HTTP_FAILED` and `CLOUDFLARE_SCHEDULES_TRANSPORT_FAILED` are unchanged; `/deployments` and `/settings` are unchanged and keep their single collapsed codes; no decoder, endpoint, path, method, timeout, read order, read cap or credential contract changed.

**Do not claim.** This checkpoint does not claim JSON parsing is the cause, the envelope shape is the cause, `decodeSchedules` is the cause, Cloudflare's documentation is wrong, the repository's decoder is wrong, or that A1.3 is live accepted. The precise underlying response-processing failure is still unknown until the next attended dispatch reports one of the three new codes.

**Next live gate, in order:** (1) owner reviews and approves this PR; (2) merge only after explicit owner approval; (3) exact-`main` Verify success on the merged commit; (4) one further attended manual observer dispatch; (5) read the new closed response-layer category code to identify the precise underlying cause; (6) only then propose the actual correction — configuration, credential permission, response-contract correction, or another cause; (7) scheduled activation remains a later, separate, still-unapproved gate. See [A1.3](docs/DATA-OPS-A1-3-LIVE-READONLY-OBSERVER.md).

<!-- DATA-OPS-A1-3-2026-09-09-SCHEDULES-CLASSIFICATION -->
### Current Data-Ops checkpoint — A1.3 schedules-read failure classification, merged as PR #235

**Its checkpoint status is superseded by the response-layer block above; its design and evidence below remain accurate as a record and are retained.** This remediation merged as **PR #235**. The owner performed a third attended `Data Steward Read-Only Observer` dispatch: workflow run `34311398342`, run number 3, event `workflow_dispatch`, branch `main`, head SHA `465e54260005c96591bd77be0a1fe1cb44547631`. **This is not a live acceptance.** No collection, repair, D1 write, schedule activation or Cloudflare mutation occurred.

**FACT: identity admission continues to succeed.** GitHub sentinel `OBSERVED` / `GITHUB_CHAIN_OBSERVED`. D1 sentinel `OBSERVED` / `D1_STATE_OBSERVED`, `rowsRead: 89066`. Cloudflare sentinel `OBSERVATION_FAILED` / `CLOUDFLARE_SCHEDULES_READ_FAILED` — the failure narrows specifically to the first fixed read, `GET .../schedules`; because reads are sequential and fail closed, `/deployments` and `/settings` were not attempted. Protected runtime values remained masked throughout, per the PR #233 remediation.

**FACT: the per-stage code was itself still ambiguous.** `CLOUDFLARE_SCHEDULES_READ_FAILED` collapsed a transport error, an authorization refusal, a missing-resource response, any other non-200 status, and a successful-but-unusable response into one code. This checkpoint replaces it, for `/schedules` only, with five closed categories: `CLOUDFLARE_SCHEDULES_AUTH_REFUSED` (HTTP 401/403), `CLOUDFLARE_SCHEDULES_NOT_FOUND` (HTTP 404), `CLOUDFLARE_SCHEDULES_HTTP_FAILED` (any other non-200), `CLOUDFLARE_SCHEDULES_RESPONSE_INVALID` (200 but unparseable JSON, an invalid envelope, or a result the existing `decodeSchedules` rejects), and `CLOUDFLARE_SCHEDULES_TRANSPORT_FAILED` (fetch throws or times out before any response exists). The HTTP status is read only inside the sentinel to select one of these enums; it, any provider body, message, header, URL, account id, token or fingerprint never leave the sentinel. `/deployments` and `/settings` are unchanged and keep their single collapsed codes; no decoder, endpoint, path, method, timeout, read order, read cap or credential contract changed.

**Downstream evidence, not proof.** Production Workflow B runs appeared at approximately the three expected 01:17, 02:17 and 03:17 UTC opportunities on 9 September. That is evidence the dispatch chain is operating; it is not independent proof of the Cloudflare Cron configuration or the `/schedules` API response itself, and is not treated as such here.

**Do not claim.** This checkpoint does not claim the token permission is wrong, the Worker is missing, the response decoder is wrong, the Cron configuration is wrong, or that A1.3 is live accepted. The precise underlying `/schedules` failure category is still unknown until the next attended dispatch reports one of the five new codes.

**Next live gate, in order:** (1) owner reviews and approves this PR; (2) merge only after explicit owner approval; (3) exact-`main` Verify success on the merged commit; (4) one further attended manual observer dispatch; (5) read the new closed `/schedules` category code to identify the precise underlying cause; (6) only then propose the actual correction — configuration, credential permission, response-contract correction, or another cause; (7) scheduled activation remains a later, separate, still-unapproved gate. See [A1.3](docs/DATA-OPS-A1-3-LIVE-READONLY-OBSERVER.md).

<!-- DATA-OPS-A1-3-2026-09-08-CLOUDFLARE-READ-DIAGNOSTICS -->
### Current Data-Ops checkpoint — A1.3 Cloudflare fixed-read diagnostic remediation, merged as PR #234

**Its checkpoint status is superseded by the schedules-classification block above; its design and evidence below remain accurate as a record and are retained.** This remediation merged as **PR #234** and its exact-`main` Verify passed. Its statement that "the precise failing stage is still unknown until the next attended dispatch" was accurate when written and has since been answered: the third attended dispatch, run `34311398342`, identified the failing stage as `/schedules` — see the block above.

The owner performed a second attended `Data Steward Read-Only Observer` dispatch: workflow run `34277208819`, run number 2, event `workflow_dispatch`, branch `main`, head SHA `d9599c4aa557ce0727c4f8b6ddd24a4778b21497`. **This is not a live acceptance.** No collection, repair, D1 write, schedule activation or Cloudflare mutation occurred.

**FACT: the PR #233 masking fix worked.** The job log proved the first masking step succeeded, the account id was masked, the fingerprint was masked before materialisation, and the final observer step's resolved environment displayed every protected value as `***`.

**FACT: Cloudflare identity admission now succeeds.** Sanitized result: `verdict: UNHEALTHY`, `evaluationReason: SENTINEL_EVIDENCE_UNAVAILABLE`, `heartbeat: INCOMPLETE`, `escalationRequired: true`. GitHub sentinel: `OBSERVED` / `GITHUB_CHAIN_OBSERVED`. D1 sentinel: `OBSERVED` / `D1_STATE_OBSERVED`, `rowsRead: 88580`. Cloudflare sentinel: `OBSERVATION_FAILED` / `CLOUDFLARE_READ_FAILED` — the previous identity-mismatch failure is gone, and Cloudflare now fails during one of its three already-approved fixed `GET` reads (`/schedules`, `/deployments`, `/settings`) instead of at identity admission.

**Existing ambiguity, now fixed.** `readCloudflareConfiguration()` in `workers/data-steward/sentinels/cloudflare-sentinel.mjs` collapsed a transport error, a non-200 response, a malformed envelope or an invalid decoded result from *any* of the three sequential reads into the single `CLOUDFLARE_READ_FAILED` code, so the live evidence could not say which stage failed. This remediation replaces it with three closed, stage-named reason codes — `CLOUDFLARE_SCHEDULES_READ_FAILED`, `CLOUDFLARE_DEPLOYMENTS_READ_FAILED`, `CLOUDFLARE_SETTINGS_READ_FAILED` — each naming only the failed stage and carrying no HTTP status, provider error code or message, request URL, response body, header, account id, token or fingerprint. The read sequence, its fail-closed short-circuit (a schedules failure issues 1 request and no more; a deployments failure issues 2; a settings failure issues 3), the exactly-three-read cap, the fixed `GET`-only paths and every decoder (`decodeEnvelope`, `decodeSchedules`, `decodeDeployments`, `decodeSettings`) are all unchanged — this is diagnostic precision through a closed enum, not a decoder or permission change. The Cloudflare credential remains exactly Workers Scripts Read plus D1 Read; no token was recreated, rotated or widened.

**Do not claim.** This checkpoint does not claim the token permission, Cloudflare production configuration, Cron configuration or any decoder is wrong, and does not claim A1.3 is live accepted. The precise failing stage is still unknown until the next attended dispatch reports one of the three new codes.

**Next live gate, in order:** (1) merge this diagnostic remediation after owner approval; (2) exact-`main` Verify success; (3) one further attended manual observer dispatch; (4) read the new closed reason code to identify the precise failing Cloudflare stage; (5) only then determine whether the fix is configuration, credential permission, a response-contract correction, or another cause; (6) scheduled activation remains separate and unapproved. See [A1.3](docs/DATA-OPS-A1-3-LIVE-READONLY-OBSERVER.md).

<!-- DATA-OPS-A1-3-2026-09-08-REMEDIATION -->
### Current Data-Ops checkpoint — A1.3 first-live observation and unmerged identifier-masking remediation

**Supersedes the dormant-checkpoint block below as the current status; its design and security facts remain otherwise unchanged and are retained as history.** The owner performed the first attended `Data Steward Read-Only Observer` dispatch: workflow run `34269989975`, run number 1, event `workflow_dispatch`, branch `main`, head SHA `2f8a4850f911779d2ec48db2f835d0f6af5a45c5`. **This is not a live acceptance.** No collection, repair, D1 write, schedule activation or Cloudflare mutation occurred, and none is claimed.

**Sanitized result:** `verdict: UNHEALTHY`, `evaluationReason: SENTINEL_EVIDENCE_UNAVAILABLE`, `heartbeat: INCOMPLETE`, `escalationRequired: true`. GitHub sentinel: `OBSERVED` / `GITHUB_CHAIN_OBSERVED`. D1 sentinel: `OBSERVED` / `D1_STATE_OBSERVED`, `rowsRead: 88580`. Cloudflare sentinel: `OBSERVATION_FAILED` / `CLOUDFLARE_IDENTITY_MISMATCH`.

**Root cause, proved rather than inferred.** The runtime contract in `workers/data-steward/sentinels/cloudflare-sentinel.mjs` requires the account fingerprint to match exactly `^[0-9a-f]{64}$` — 64 lowercase hexadecimal characters, no prefix — and compares it against `derivedAccountFingerprint(accountId)`. The live `DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT` value was provisioned in the `sha256:<hash>` shape, which the pattern rejects outright, so the sentinel failed closed at identity admission before issuing any Cloudflare request. The runtime contract was correct; the provisioning instructions were not explicit enough about the required raw-hex shape. No live protected value, including the fingerprint prefix digits or account id, is recorded in this repository.

**Second live finding — identifier logging.** The same run proved that GitHub Actions echoes each step's resolved environment, including `vars.*` values, in that step's log header — the fingerprint therefore appeared in the observer's job log before any Cloudflare credential was ever exposed. It is not an authentication credential, but this violated A1.3's own identifier-sanitisation boundary. The remediation applies the PR #215 production pattern (`.github/workflows/data-s2-production-collection.yml`), tightened further on owner review: the job's `env:` block is removed **entirely** — no `DATA_STEWARD_GITHUB_TOKEN`, `DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID`, `DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT` or `DATA_STEWARD_CLOUDFLARE_READ_TOKEN` sits at job level. A first step declares, at step level, only the already-secret `DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID`, derives its SHA-256 locally, registers `::add-mask::<derived hash>` and performs no network request, `GITHUB_ENV` write or job output; checkout and setup-node receive no steward value at all; only the final `Execute one read-only observation` step declares, at step level, the complete runtime contract (GitHub token, account id, fingerprint, Cloudflare read token), with the fingerprint materialised only there. GitHub token, account id secret and Cloudflare read token secret, exact `refs/heads/main` guard, `deployment: false`, exact read-only permissions, the `17 4 * * *` / `17 8 * * *` schedules and the exact `DATA_STEWARD_SCHEDULED_ENABLED == 'true'` activation gate are all unchanged.

**Format contract, strengthened rather than weakened.** Documentation and tests now state unambiguously that the required shape is exactly `^[0-9a-f]{64}$` and that a `sha256:` prefix is always invalid; the runtime sentinel is not changed to accept a second shape — the first live failure proved the raw-hex-only contract was already correct.

**Next live gate, unchanged in order and each still separate:** (1) merge this remediation after owner approval; (2) exact-`main` Verify success; (3) owner corrects the live `DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT` value to the raw 64-character lowercase SHA-256 hex; (4) owner performs one new attended manual observer dispatch on the then-current `main`; (5) accept live observation only if every sentinel/cross-source requirement passes; (6) scheduled activation remains a later, separate approval. See [A1.3](docs/DATA-OPS-A1-3-LIVE-READONLY-OBSERVER.md).

> The A1.3 dormant-checkpoint block below records the pre-first-run repository-ready state and its design remains accurate; its checkpoint status is superseded by this block.

<!-- DATA-OPS-A1-3-2026-09-08 -->
### Current Data-Ops checkpoint — A1.3 dormant read-only observer

**Repository-ready; not live-activated.** A1.2 is merged in PR #231 at `b2ce4e4e3e12a4c6b76e0d1075cb22f06ecac2e2`. A1.3 adds a dedicated GitHub Actions observer, manual dispatch and declared UTC opportunities at `17 4 * * *` and `17 8 * * *`. Scheduled execution is fail-closed unless `DATA_STEWARD_SCHEDULED_ENABLED` equals exact `true`, and every event requires exact `refs/heads/main`; this checkpoint creates no variable, protected environment, credential or live run. Authenticated repository tooling received HTTP 403 reading the live activation variable and proves nothing about it; the owner subsequently verified through the GitHub owner UI (Settings → Secrets and variables → Actions → Variables) that `DATA_STEWARD_SCHEDULED_ENABLED` is **absent**, with no variable created, edited or deleted. That is owner UI evidence, not an independent repository read. An absent variable cannot equal exact lowercase `true`, so **the scheduled observer is dormant on merge**. Scheduled activation still requires a later explicit owner-approved creation/set of `DATA_STEWARD_SCHEDULED_ENABLED=true`, and the separate gates for creating/configuring `data-steward-readonly`, restricting it through Selected branches and tags to exact `main`, provisioning read-only Cloudflare credentials and performing one first manual live observation are all unchanged.

The workflow maps ephemeral `${{ github.token }}` to the existing steward contract, grants exactly Contents, Actions and Checks read, and uses `deployment: false` so observer runs create no GitHub Deployment object/status. Before credentials, `data-steward-readonly` must be explicitly created with Selected branches and tags restricted to exact `main`; Protected branches only is unsafe while `main` lacks branch protection. The later Cloudflare token remains Workers Scripts Read plus D1 Read. One narrow adapter reads only four allowlisted environment names, executes one deterministic observation and emits a closed sanitized summary. No remediation, collection, retry, D1 write, production change or migration exists. GitHub-hosted observation cannot independently detect a total GitHub outage or absence of its own scheduled runs. See [A1.3](docs/DATA-OPS-A1-3-LIVE-READONLY-OBSERVER.md).

> The A1.2 block below is merged historical foundation. Its former review/merge next gate is superseded by this block.

<!-- DATA-OPS-A1-2-2026-09-08 -->
### Current Data-Ops checkpoint — A1.2 observe-only production sentinels

**Superseded as current status by A1.3 above.** A1.1 is merged
(PR #230, `47345a7035eba0071c66dcab778f0edc9fef4048`) and unchanged; A1.2 merged in PR #231.

DATA-S2C remains closed and is not redesigned. A1.2 gives the Autonomous Data Steward **eyes, not
hands**: three read-only observation domains under `workers/data-steward/sentinels/` that
deterministically answer whether the expected production chain operated and whether production data
is current and internally consistent.

**The chain observed is the real one:** Cloudflare Cron → isolated dispatcher Worker → GitHub Actions
workflow B → repository gate → opportunity guard → Official FPL collection → production D1, with
workflow C as the attended recovery path. **There is no Cloudflare Workflow in this chain** and a
permanent test refuses any A1.2 module that speaks of one. The permanent cron declaration stays
exactly `17 1 * * *`, `17 2 * * *`, `17 3 * * *` UTC — **three opportunities, not three
collections**.

**The central correction: a workflow B `failure` is not a production failure.** The live T2
acceptance proved that T2 run `34209137195` failed precisely because the gate refused an
already-consumed day with `OPPORTUNITY_CONSUMED (automatic_collection_consumed)` and `collect` was
correctly skipped. A1.2 therefore never classifies on `run.conclusion`; job/step shape identifies
only a candidate refusal. One bounded read of that exact repository-gate job log must independently
prove the exact allowlisted `OPPORTUNITY_CONSUMED` result. Ambiguous, missing, malformed, duplicate,
contradictory, unknown or unreadable semantic evidence fails closed. **Only the proven consumed
refusal is HEALTHY.**

Typed guard ambiguity and a failed-step `OPPORTUNITY_AVAILABLE` contradiction are hard RED before
collection health is considered, so an earlier successful collection cannot forgive them. The
whole-steward exact-edge dependency scan covers ordinary static, side-effect static, dynamic import
and `require()` dependency forms.

**Fail-closed everywhere.** Missing, stale, failed and unavailable observations are all RED. A
crashed or silent sentinel can never produce an implicit GREEN — the heartbeat checks the watcher
before anything it watched. **AMBER is not introduced**: `NOT_DUE` and `AWAITING_LATER_OPPORTUNITY`
are evaluation phases that raise **no incident at all**, never a new operational state and never a
remediation class. Timing is derived, not chosen: 30 minutes from workflow B's own job timeouts plus
Cloudflare's published 15-minute propagation figure gives a 04:02 UTC evaluation deadline, and each
term is pinned by test against its source.

**One named permanent limitation, deliberately not papered over.** No supported read-only Cloudflare
API for per-fire dispatcher invocation history has been proven by this repository, so dispatcher
execution is reported as `CLOUDFLARE_INVOCATION_HISTORY_UNOBSERVABLE`, can never contribute to a
healthy verdict, and causality is established downstream from GitHub and D1 instead. **Absence of
visibility is never turned into GREEN.**

**No arbitrary SQL exists.** The D1 sentinel holds three frozen `SELECT`-only statements with bound
parameters, a private trusted-plan set, a written-row refusal and a read bound, enforced in
application code rather than left to the token. It deliberately does not import the production plan
module, which can build mutations.

**A1.2 is Class 0 and observes only.** No remediation, no mutation, no AI, no credential created or
rotated, no Cloudflare or GitHub change, no D1 write, no scheduler activated, no workflow added, no
D1 schema change (still exactly migrations 0001–0003), and no provider, model, fixture, captaincy,
squad, transfer, rank, Mini-League, product or UI behaviour changed. Merging deploys and arms
nothing. **No live validation was performed and none is claimed.** Minimum credentials are documented
and read-only: GitHub Metadata/Contents/Actions/Checks read, Cloudflare Workers Scripts Read and D1
Read. Repository suite: **1,769 tests, 1,769 passed, 0 failed**; deterministic build unchanged.

A1.2's former owner-review/merge gate is closed by PR #231. Protected Cloudflare credential
provisioning, first live read-only acceptance, scheduled activation and any Class 1+ autonomy remain
separate explicit owner gates. See [A1.2](docs/DATA-OPS-A1-2-OBSERVE-ONLY-PRODUCTION-SENTINELS.md).

<!-- DATA-OPS-A1-1-2026-09-08 -->
### Current Data-Ops checkpoint — A1.1 observe-only foundation

> **Superseded as the current Data-Ops checkpoint on 8 September 2026 by the A1.2 block above.**
> A1.1 is merged and remains the live foundation, unchanged: every contract below is still current,
> and only its checkpoint status is superseded.

DATA-S2C remains closed. A1.1 adds pure offline incident, classification, action-registry, policy,
audit and approved-provider-health contracts under `workers/data-steward/`. Only non-mutating Class 0
is enabled; Classes 1–3 are disabled, Class 3 allowlist is empty, and Class 4 escalates. There is no
live observer, AI integration, credential access, persistence, actuator or production mutation.
GREEN/AMBER require exact registered state predicates; proposer evidence cannot authorize actions;
provider approval policy is repository-controlled; no generic SQL/shell/HTTP/API action exists.
See [A1.1](docs/DATA-OPS-A1-1-POLICY-OBSERVE-ONLY-FOUNDATION.md).

<!-- DATA-S2C-CLOSEOUT-2026-09-08 -->
### Current DATA-S2C state — closed after live Cloudflare acceptance

**This block supersedes every earlier DATA-S2C current-state or next-gate statement below; those
blocks remain historical records.** DATA-S2C Packages D and E were explicitly owner-approved as one
closeout package. Cloudflare is now the sole automatic clock, GitHub Actions remains the execution
engine through workflow B, and attended workflow C remains the manual recovery path. Obsolete GitHub
scheduled workflow A is retired from the repository. Its bounded historical runs remain guarded and
are discovered through immutable GitHub Actions workflow id `350014371`, never through the deleted
workflow filename; lookup failure remains fail-closed.

GitHub independently confirms T1 run `34207638275` on `main` SHA
`c6708e4940c81b34b96adb53e624e98453ac2800`, created `2026-09-08T09:00:53Z`, attempt 1: workflow B,
`repository-gate` and `collect` all succeeded, including the production Official FPL-to-D1 step.
GitHub also confirms expected T2 run `34209137195`, created `2026-09-08T09:17:03Z`, attempt 1: the
repository gate failed specifically at the opportunity guard with `OPPORTUNITY_CONSUMED
(automatic_collection_consumed)`, and `collect` was skipped. This proves a second same-day dispatch
did not produce a second collection.

An earlier Cloudflare scheduled event safely stopped before GitHub: `dispatch: REJECTED`, reason
`dispatch_token_missing`, latency 176 ms, because active Worker version
`7afb02f1-5425-4d8c-bd85-91fec5e8175c` lacked the runtime secret. It was not a GitHub or collection
failure. Under a narrow owner-approved live-operation exception, the owner promoted the newer
secret-containing `7c3c8be5...` version to 100% traffic and used temporary dashboard Cron Triggers
`0 9 8 * * *` and `17 9 8 * * *` for T1/T2. The owner then deleted those temporary triggers and
confirmed the saved final live set is exactly `17 1 * * *`, `17 2 * * *`, `17 3 * * *`. Repository
tooling did not independently read that final Cloudflare trigger state; owner dashboard evidence is
the stated basis.

The accepted replacement gap materialised: GitHub reports zero governed A/B/C production runs during
UTC day 2026-09-07. Missing observations cannot be reconstructed. Ongoing monitoring is normal,
non-blocking and exception-based; healthy days require no owner action. The future Autonomous Data
Steward remains a separate checkpoint. See
[DATA-S2C closeout](workers/data-platform/DATA-S2C-PRODUCTION-SCHEDULER-REPLACEMENT.md#14-package-de-closeout--8-september-2026).


<!-- DATA-S2C-PACKAGE-C-2026-09-07 -->
### Current DATA-S2C checkpoint — Package C repository activation candidate

**This block supersedes the "next gate" statements of the Package B blocks below, and nothing else in
them.** Package B's live facts — workflow A `disabled_manually`, the deployed dispatcher, the bound
credential, zero Cron Triggers, the disconnected Git build integration — are unchanged and remain
current. What changes here is the repository's declared cron list and the state of the Package C gate.

**LIVE STATE, stated first because it is the fact most easily misread: the deployed Worker
`teamsheet-data-s2-dispatcher` still holds ZERO Cron Triggers, and this candidate arms nothing.** A
repository declaration is not a deployment. The deployed Worker keeps the configuration it was last
deployed with — Package B's empty cron list — until a separately gated attended owner deployment
replaces it. There is still **no automatic production collection path at all**: GitHub is no longer an
automatic clock and Cloudflare is not one yet.

**What the repository now declares.** `workers/schedule-dispatcher/wrangler.jsonc` replaces
`"crons": []` with exactly the three owner-approved daily opportunities — `17 1 * * *`, `17 2 * * *`
and `17 3 * * *`. Cloudflare executes Cron Triggers on UTC time and **no timezone override is
declared**, so those are 01:17, 02:17 and 03:17 UTC. There is no fourth entry and no duplicate.

**Three opportunities are not three collections.** 01:17 dispatches workflow B; if that run reaches
`collect` and collects, the UTC day is consumed; 02:17 and 03:17 may still dispatch and their runs may
still exist, but the shared fail-closed opportunity guard refuses production collection for a day
already consumed, so `collect` is skipped. An attended workflow C collection earlier in the day
consumes the day the same way. A later run **existing** is expected; a later run **collecting** would
be the failure. The guard, not the cron list, enforces one collection per UTC day.

**Nothing else in the repository moved.** Dispatcher request semantics, `controller.noRetry()`
placement, timeout, dispatch target, GitHub API version, dispatch body and repository target, the
REJECTED-versus-AMBIGUOUS classification, the opportunity guard (attempt-1-only consumption,
`filter=all`, the 35-day horizon, the 200-request bound, fail-closed truncation), workflow A,
workflow C, the production collection entry point, the collector, every resource threshold, the D1
schema and migrations — still exactly 0001–0003 with five indexes and **no migration 0004** — and
every provider, model, fixture, captaincy, squad, transfer, rank, Mini-League, product and UI
behaviour are all unchanged. The only source edit outside the configuration is a dispatcher header
comment that would otherwise describe the superseded empty list.

**The permanent regressions were replaced, not relaxed.** The test that pinned the dormant
`"crons": []` now pins the approved Package C list: exactly three entries, those exact expressions, no
fourth, no timezone override at any depth, `workers_dev` and `preview_urls` still `false`, the
isolated identity, no forbidden binding, no fetch handler, the unchanged dispatch contract, and that
Package C re-enables no GitHub scheduler and adds no repository deployment surface.

**Activation is attended and is a separate gate.** The repository ships no deployment workflow, no
Cloudflare deployment credential and no Git build integration for this Worker, and Package C adds
none. **The activation boundary is a deployment, and only a deployment:** the dispatcher is
repository-managed through `workers/schedule-dispatcher/wrangler.jsonc`, so live scheduling is
established by deploying that exact verified configuration, never by hand-building live state that
merely matches it. The approved path temporarily reconnects the Cloudflare Workers Git integration to
`priteshpatel390-del/FPL`, targets the existing `teamsheet-data-s2-dispatcher` project with a blank
build command and the deploy command
`npx wrangler deploy --config workers/schedule-dispatcher/wrangler.jsonc`, deploys exact verified
`main`, and then **disconnects the integration again immediately**. That preserves one evidence
chain: reviewed repository, merged `main`, exact-`main` Verify, attended exact-`main` deployment, live
scheduler. **Direct dashboard creation of the three Cron Triggers is not the activation method** — the
dashboard is for verifying the resulting trigger set, viewing Cron Events, checking Worker settings
and emergency rollback only. **A standing Git auto-deploy connection remains forbidden.** Cloudflare
documents that Cron Trigger changes take up to 15 minutes to propagate.

**One newly recorded constraint: the cron budget is an account limit.** Cloudflare's published limits
give **5 Cron Triggers per account on Workers Free**, not per Worker. Three opportunities consume three
of five account-wide, and only if no other Worker in this account holds a live trigger. That cannot be
read through the tooling available here, so the owner must confirm the account's live trigger count
before activating — and must not restore the historical collector's removed trigger to make room.

**No on-demand proof is possible, and none is invented.** Cloudflare's documented ways to fire a
`scheduled()` handler outside its cron — `wrangler dev --test-scheduled` and `/cdn-cgi/local/scheduled`,
Miniflare, the Wrangler test harness — all run a **local** copy of the code, never the deployed Worker,
and would need the real credential outside Cloudflare's secret store. For a deployed Worker, Cloudflare
documents no API or dashboard action that invokes the handler; the dashboard's Cron Events view is
invocation *history*, not an invocation control. Acceptance therefore uses natural cron observation, and
no test route, temporary cron or fetch handler is added to shorten the wait.

**Nothing was executed for this checkpoint.** No Cloudflare deployment, no Cron Trigger created,
changed or removed, no Worker created or modified, no secret created, read or written, no
Cloudflare-to-GitHub dispatch, no workflow dispatched, enabled, disabled or re-run, no D1 request of
any kind, and no Official FPL collection. Reading the account's Worker list and the GitHub workflow
state are read-only queries. Live Cloudflare-to-GitHub dispatch remains **entirely unproven**.

**The accepted history-gap risk stays live and no gap is claimed.** A gap exists only when a UTC day
actually closes with no production collection through any of the three governed workflows, and
observations lost to any gap are not claimed to be reconstructible.

**Next gates, each separate:** owner review and merge — the standing merge gate is **not** waived by
Package C approval; exact-`main` Verify; the attended Cloudflare activation; the first live workflow B
dispatch acceptance; and the proof that a later opportunity refuses once the day is consumed. See
[DATA-S2C external scheduler](workers/data-platform/DATA-S2C-PRODUCTION-SCHEDULER-REPLACEMENT.md) §13.

<!-- DATA-S2C-ROLLOUT-DECISION-2026-09-07 -->
### Current DATA-S2C rollout decision — Cloudflare replaces the GitHub timer, no A+B coexistence

**This block is the canonical current statement of how DATA-S2C is to be rolled out, and it
supersedes every earlier statement in this file describing a deliberate period in which the GitHub
scheduled workflow A and the Cloudflare-dispatched workflow B both run automatically.** Those
statements were accurate at the checkpoints that recorded them and are retained there as history.
They are no longer current. **A future session must not reconstruct the A+B coexistence rollout from
them without a new explicit owner approval.**

**The revised owner-approved sequence.** (1) Merge the Package A repository safety foundation.
(2) **Before** Cloudflare automatic scheduling is activated, disable GitHub's automatic scheduler
workflow A. (3) Confirm no running or pending workflow A execution remains that could later collect.
(4) Provision the Cloudflare dispatcher **dormant** — credential, secret binding, Worker deployment,
zero cron triggers. (5) Prove the dormant dispatcher is harmless. (6) Separately approve Cloudflare
scheduler activation. (7) Cloudflare becomes the **only** automatic clock. (8) GitHub Actions remains
the execution engine. (9) The attended manual workflow stays available for owner-approved recovery.
(10) Observe Cloudflare and prove no more than one production collection per UTC day. (11) Later
retire the obsolete GitHub scheduled workflow once Cloudflare has demonstrated acceptable operation.

**Why it changed.** Teamsheet is still in development and testing. The DATA-S2 history is valuable
but is not yet relied on for normal live decision-making in a way that justifies keeping a scheduler
already known to be unreliable running solely to avoid a temporary collection gap. The previous plan
spent substantial complexity on *"how do we safely operate two automatic schedulers at once?"* when
the simpler option was *"disable the scheduler we already know we do not trust before activating its
replacement."*

**Durable engineering principle, recorded deliberately as more than a scheduler decision:**

> **Prefer removing an unnecessary failure mode over engineering machinery to tolerate it,
> particularly while Teamsheet remains in development and the affected capability is not yet relied
> upon for normal live decision-making.**

Before proposing substantial migration or safety machinery, work this checklist: (1) can the problem
be removed rather than accommodated? (2) does Teamsheet's current maturity justify the complexity?
(3) what is the simplest reversible solution? (4) which safe related steps can be combined into one
owner approval? (5) can validation be automated instead of requiring repeated owner or manual
checking? This is **not** a blanket rule against production hardening — use complexity when the
product or risk actually requires it, but do not automatically design for zero-downtime migration
when the current product stage does not need one.

**Owner involvement is exception-based.** Pritesh makes product, risk and approval decisions and
should not have to shuttle routine technical status between tools when steps can safely be combined
or automatically verified, so safe related actions are grouped into approval packages. That reduces
handoffs and **weakens no approval gate**: live production mutation, credentials, deployment,
scheduler activation, provider/data/model changes and merging each still require explicit owner
approval.

**The guard is not wasted.** Cloudflare's planned scheduler has three dispatch opportunities a day —
01:17, 02:17 and 03:17 UTC — and they are retry **availability**, not three collections: 01:17
collects, then the guard sees the day consumed and refuses at 02:17 and again at 03:17. The guard
also refuses after an attended manual collection has consumed the day. Package A's guard, attempt
semantics, pagination and fail-closed behaviour therefore all stand; only the assumption that they
must support a deliberate long-running A+B overlap experiment is superseded.

**Capability versus rollout — do not conflate them.** *Capability:* the repository safely supports
guarded workflow A and guarded workflow B, and that implementation is unchanged and is not rewritten
because the rollout changed. *Intended rollout:* workflow A is disabled before Cloudflare activation,
so deliberate automatic A+B coexistence is no longer part of acceptance.

**FACT AT THE PACKAGE A CHECKPOINT — retained as history: workflow A was not disabled.** Workflow `350014371` reported `state: active` as live external state, and disabling it was a
separate explicitly owner-approved live action that no documentation change could perform.
**CURRENT STATE: the owner has since disabled it, and workflow `350014371` reports
`state: disabled_manually`.** The owner took that action on 7 September 2026. See the Package B current-state blocks below.

**Accepted temporary history gap.** A DATA-S2 history gap may occur between disabling GitHub
scheduling and successfully activating Cloudflare, and that is an accepted development-stage
trade-off. Observations lost to a gap are **not** claimed to be reconstructible — the next collection
captures then-current Official FPL state, and intermediate changes may be unavailable. **No gap has
occurred**, and none may be reported unless it actually has.

**Nothing in this decision was executed.** No workflow was enabled, disabled or dispatched, no
credential or Cloudflare secret was created, no Worker was deployed, no Cron Trigger was created,
changed or removed, no D1 request was performed and no collection was run. See [DATA-S2C external
scheduler](workers/data-platform/DATA-S2C-PRODUCTION-SCHEDULER-REPLACEMENT.md) §0.

<!-- DECISION-INTELLIGENCE-DI4-2026-08-29 -->

<!-- DATA-S2B-GITHUB-ACTIONS-DAILY-SCHEDULE-2026-09-04 -->
<!-- DATA-S2C-PACKAGE-B-2026-09-07 -->
### Current scheduler state — the GitHub automatic timer is retired and no automatic scheduler is armed

**This block is the canonical current statement of scheduler state, and it supersedes every earlier
statement in this file, and in every other canonical document, that GitHub scheduled workflow A is
active, enabled, or must remain armed.** Those statements were accurate at the checkpoints that
recorded them and are retained there as history. They are no longer current.

**Independently verified here from the GitHub Actions API on 7 September 2026.** Workflow `DATA-S2
Scheduled Production Collection via D1 REST`, id `350014371`, path
`.github/workflows/data-s2-production-scheduled.yml`, reports **`state: disabled_manually`**, last
updated `2026-09-07T04:03:30Z`. The owner disabled it. Reading the workflow state is a read-only
GitHub query; nothing in this checkpoint enabled, disabled, dispatched or re-ran any workflow.

**No workflow A execution remains that could later collect.** At the retirement acceptance read on
`2026-09-07T04:09:54Z` the repository reported **zero** runs with status `queued` and **zero** with
status `in_progress`, across every workflow rather than workflow A alone. Workflow A's own run
population remains exactly **three** runs — `33901634593`, `33948145320` and `34015422874` — with the
newest still `34015422874`, created `2026-09-06T06:01:26Z`, conclusion `success`. No fresh scheduled
run appeared, and no run was cancelled to reach that state.

**One unrelated run is `waiting`, and it is recorded rather than acted on.** Run `33620632272` of
`DATA-S2B Phase 4B Mutation-Free Live Preflight Preparation` (workflow `344574374`, path
`.github/workflows/data-s2b-phase4b-readonly-preflight.yml`), run number 9, attempt 2, event
`workflow_dispatch`, has been `waiting` on protected-environment approval since
`2026-09-02T10:40:00Z`. It is **not** workflow A, it is a strictly read-only Phase 4B preflight, and
it carries no `collect` job, so it cannot perform a production collection. It was deliberately left
untouched: a run this old is stale, but cancelling it is a separate decision that Package B did not
take.

**Workflow B has never been dispatched.** `.github/workflows/data-s2-production-external.yml` reports
a total run population of **zero**. Workflow C, the attended manual collection, still reports exactly
three runs, the newest being `33990959542` from 5 September 2026.

**Operational consequence, stated plainly.** GitHub is no longer an automatic clock, and Cloudflare is
not one either: the dispatcher Worker is now deployed, but it holds **zero** Cron Triggers, so nothing
can invoke it automatically. **There is currently no automatic production collection path at all.**
GitHub Actions remains the execution engine, and the attended manual workflow C remains available for
owner-approved recovery. That is the intended state between GitHub timer retirement and Package C
Cloudflare activation.

**The accepted history-gap risk is now live, and no gap is claimed to have occurred.** As of the
closeout read at `2026-09-07T17:29:36Z` no production collection has run on UTC day 2026-09-07 through
any of the three governed workflows. Whether that day closes without a collection depends on whether an
attended manual collection is separately approved before `2026-09-07T23:59:59Z`, so **it is not yet a
completed gap and must not be reported as one.** Observations lost to any gap are not claimed to be
reconstructible.


<!-- DATA-S2C-PACKAGE-B-2026-09-07 -->
<!-- DATA-S2C-PACKAGE-B-CLOSEOUT-2026-09-07 -->
### Current DATA-S2C checkpoint — Package B dormant provisioning is complete

**This block supersedes the earlier Package B block that described the repository half as complete
and the Cloudflare provisioning as outstanding.** That block was accurate when written and is
retained below as history. The owner has since performed the three attended live actions.

**Package A baseline.** PR #226 merged as `f519e319d107ca1d45834a15c45cd785a173b43f`, and the
post-merge exact-`main` `Verify Teamsheet` run `34081463226` — run number 623, event `push` —
concluded **success**. The full repository suite on that tree is **1,717 tests, 1,717 passed, 0
failed, 0 skipped, 0 cancelled**. `main` has not moved since.

**The isolated dispatcher is deployed, and that is independently verified.** The Cloudflare account
now holds six Workers rather than five, and the new one is **`teamsheet-data-s2-dispatcher`**,
script id `1a02fa1c1ae54ff19d9a85d35a205490`, created `2026-09-07T16:36:12Z`, last modified
`2026-09-07T16:39:30Z`. It is the approved isolated identity; `teamsheet-data-platform` was **not**
reused and its own `modified_on` is unchanged at `2026-08-31T19:46:27Z`. No second Worker was
created.

**The deployed module was read back and matches the approved `main` source.** The retrieved script is
the bundled form of `workers/schedule-dispatcher/dispatcher.mjs` and `dispatch-contract.mjs`, whose
repository bytes are unchanged from `main`. The read-back independently confirms, in the code
actually running in production: `controller.noRetry()` as the first statement of the scheduled
handler; the single credential read `env?.GITHUB_DISPATCH_TOKEN`; the dispatch target
`data-s2-production-external.yml` on `priteshpatel390-del/FPL`; the body `{"ref":"main",
"return_run_details":true}` with no workflow inputs; `REJECTED` confined to 401, 403, 404 and 422
with everything else `AMBIGUOUS`; and **no `fetch` handler exported at all**, so the Worker has no
public HTTP surface. No D1, KV, R2 or service reference appears anywhere in the deployed module.

**The credential exists and is bound as one encrypted Cloudflare secret.** A GitHub fine-grained
personal access token named `teamsheet-data-s2-dispatcher`, owned by `priteshpatel390-del`, scoped to
the single repository `priteshpatel390-del/FPL`, carrying **Actions: read and write** plus the
mandatory read-only Metadata and **no account permissions**, with a **90-day expiry**. It is stored
only as the Cloudflare runtime secret `GITHUB_DISPATCH_TOKEN`, and the dashboard reports its value as
encrypted. Its value is not recorded anywhere in this repository and must never be.

**Zero Cron Triggers, so the dispatcher is dormant.** The Cloudflare Settings page reports
`Cron triggers — No cron triggers configured` after both the deployment and the secret binding, and
no queue consumer is configured. The Worker therefore has a scheduled handler and a credential but
**no timer capable of invoking it**. That is exactly the intended Package B end state.

**The temporary Git build integration was disconnected.** The initial exact-source deployment was
performed through Cloudflare's Workers Git import against `priteshpatel390-del/FPL`, with a blank
build command and the deploy command
`npx wrangler deploy --config workers/schedule-dispatcher/wrangler.jsonc`. After the deployment and
the secret binding, the owner disconnected the Git repository, and the dashboard now offers
`Connect` rather than showing an attached repository. The deployed Worker persists; the build
integration does not. **A future push to `main` cannot silently redeploy or activate this Worker
through that integration**, so Package C activation still requires a new explicit attended action.
This is a claim about that one integration, not a claim that every conceivable Cloudflare deployment
path is impossible.

**Nothing was dispatched and nothing was collected.** Verified from the GitHub Actions API after the
deployment: workflow A `350014371` remains `disabled_manually`; repository-wide runs with status
`queued` are **zero** and with status `in_progress` are **zero**; workflow B
`data-s2-production-external.yml` still reports a total run population of **zero**; workflow C still
reports exactly three runs with the newest unchanged at `33990959542` from 5 September 2026. No
Official FPL collection was run, no D1 request of any kind was performed, and the Worker's
`scheduled()` handler was not invoked manually.

**No repository behaviour changed.** No dispatcher or contract code, no guard semantics, no workflow
YAML, no collector semantics, no resource threshold, no projection factor, no SQL, schema, index or
migration — still exactly 0001–0003 with five indexes and **no migration 0004** — and no provider,
model, fixture, captaincy, squad, transfer, rank, Mini-League, product or UI behaviour.

**What is still unproven, and deliberately so.** Live Cloudflare-to-GitHub dispatch has never been
attempted, so it remains entirely unproven: nothing is known about whether the deployed dispatcher
would reach GitHub, what status GitHub would answer, or whether a 200 body carries the identity shape
the contract expects. Cron activation is unproven because no cron exists. No end-to-end collection
through workflow B has occurred. The supportable acceptance statement is **"the dispatcher is
deployed but has no timer capable of invoking it automatically"** — never that it can dispatch
successfully.

**Next gate: Package C Cloudflare activation**, which requires its own separate explicit owner
approval: replace `"crons": []` with the approved 01:17 / 02:17 / 03:17 UTC opportunities, deploy,
prove external workflow execution, and prove the guard refuses the second and third opportunities of
a day already collected. See [DATA-S2C external
scheduler](workers/data-platform/DATA-S2C-PRODUCTION-SCHEDULER-REPLACEMENT.md) §12.

### Current DATA-S2C checkpoint — Package B dormant provisioning, repository half complete

> **Superseded on 7 September 2026 by "Current DATA-S2C checkpoint — Package B dormant provisioning
> is complete" above.** The owner has since created the dispatch credential, bound it as the single
> Cloudflare secret, and deployed the isolated dispatcher with zero Cron Triggers. The evidence below
> for the GitHub timer retirement and the read-only Cloudflare preflight stands and is retained as
> history; the statements that no credential, secret or deployment existed do not.

**Package A merged and is verified on `main`.** PR #226 merged as
`f519e319d107ca1d45834a15c45cd785a173b43f`, and the post-merge exact-`main` `Verify Teamsheet` run
`34081463226` — run number 623, event `push`, head SHA `f519e319d107ca1d45834a15c45cd785a173b43f` —
concluded **success**. Both facts were read independently from the GitHub Actions API for this
checkpoint. The full repository suite on that tree is **1,717 tests, 1,717 passed, 0 failed, 0
skipped, 0 cancelled**.

**What Package B completed.** The GitHub half is done and independently proven: workflow A reports
`disabled_manually`, no queued or in-progress run exists, workflow A's run population is unchanged at
three, workflow B has never been dispatched, and no production collection was triggered. The
read-only Cloudflare preflight was performed. The canonical documentation now records the actual
state rather than the superseded active-scheduler state.

**What Package B could not complete, and why.** The three live Cloudflare provisioning steps —
creating the dedicated GitHub dispatch credential, binding it as `GITHUB_DISPATCH_TOKEN`, and
deploying the dispatcher Worker — **were not performed**, because this session holds no mechanism
capable of performing them:

* creating a fine-grained GitHub personal access token is an interactive account-owner action, and
  GitHub exposes no API that can mint one;
* no Cloudflare deployment credential is present in the environment;
* Wrangler is not installed, and the repository deliberately ships no Cloudflare deployment workflow
  for the dispatcher;
* the read-only Cloudflare tooling available here can deploy nothing and can set no secret.

No substitute credential was used, and **no deployment machinery was invented to work around the
gap.** Building a bespoke deploy workflow would add exactly the kind of machinery the §0.7 simplicity
principle rejects, for a step the owner can perform once, attended, in a few minutes. The remaining
work is therefore one attended owner action rather than new repository code.

**Cloudflare preflight result, with its limits stated.** The authenticated account is the Teamsheet
account: it holds exactly five Workers — `teamsheet-fpl-gateway`, `teamsheet-evidence-archive`,
`teamsheet-data-platform`, `teamsheet-data-platform-acceptance-caller` and
`teamsheet-data-platform-s1b-validation-20260822`. **`teamsheet-data-s2-dispatcher` does not exist**,
so the approved isolated identity is free: there is no collision, no pre-existing route, binding,
secret or Cron Trigger under that name, and nothing that a first deployment would overwrite. The
historical `teamsheet-data-platform` Worker was read but not touched and not redeployed.
**Limitation:** the read-only tooling available here returns a Worker's name and id only, so the Cron
Triggers, routes and bindings of the *existing* Workers could not be enumerated. That is a tooling
limit, and it is not evidence that they are absent.

**Nothing was activated and nothing was collected.** No Cloudflare Cron Trigger was created, changed
or removed. No Worker was deployed. No credential or Cloudflare secret was created. No workflow was
dispatched or re-run. No D1 request of any kind was performed. No Official FPL collection was run.
Workflow A was not re-enabled. No collector semantics, guard semantics, resource constant,
projection factor, SQL statement, schema, index or migration changed — still exactly 0001–0003 with
five indexes and **no migration 0004** — and no provider, model, fixture, captaincy, squad, transfer,
rank, Mini-League, product or UI behaviour changed.

**Next gates, each separate.** First, the remaining attended Package B owner action: create the
narrowly scoped dispatch credential, bind it as the single dispatcher secret, and deploy the
exact-`main` dispatcher with `"crons": []`. Then Package C Cloudflare activation — replacing the
empty cron list with the approved 01:17 / 02:17 / 03:17 UTC opportunities — which requires its own
separate explicit owner approval. **Live Cloudflare-to-GitHub dispatch remains entirely unproven,**
because Package B deliberately dispatches nothing.


### Current scheduler state — workflow A is enabled and produced a successful natural run

> **Superseded on 7 September 2026 by "Current scheduler state — the GitHub automatic timer is
> retired and no automatic scheduler is armed" above.** The owner has since disabled workflow A, and
> the GitHub Actions API now reports it `disabled_manually`. The evidence below for natural run
> `34015422874` stands and is retained as history; the statement that the workflow is enabled does
> not.

**This block is the canonical current statement of GitHub scheduler state, and it supersedes every
earlier statement in this file that the scheduled production workflow is owner-disabled or must
remain disabled.** Those statements were accurate at the checkpoints that recorded them and are
retained there as history. They are no longer current.

**Independently verified here from the GitHub Actions API.** Workflow `DATA-S2 Scheduled Production
Collection via D1 REST`, id `350014371`, path `.github/workflows/data-s2-production-scheduled.yml`,
reports `state: active` — it is **not** disabled. It produced natural scheduled run
`34015422874`: run number 3, event `schedule`, attempt 1, head branch `main`, head SHA
`b0637270882f0ab120102dbb04a8eb2eef6a763f`, created `2026-09-06T06:01:26Z`, conclusion **success**,
with both jobs succeeding — `repository-gate` (job `101438220728`) and `collect` (job
`101438250715`), every step of both concluding `success`. The run completed at
`2026-09-06T06:01:59Z`, about 33 seconds after it was created.

**The owner re-enabled workflow A after the capacity live-acceptance closeout**, and this run is the
first natural scheduled run produced after that re-enable.

**It arrived 4h44m26s late.** The nominal cron minute is 01:17 UTC and GitHub created the run object
at 06:01:26Z. That is schedule-event **delivery** lateness upstream of the workflow, never a
collection delay: once the run existed the whole collection finished in about 33 seconds. GitHub
exposes no scheduler-registration, armed or next-run state, and documents that schedule events may
be delayed or dropped, so the lateness has **no proven cause** and none is invented.

**Owner-provided Step Summary evidence for that run, recorded with its provenance.** The Step
Summary is not retrievable through the GitHub API available here, so the following values are
**owner-provided and were not independently verified**: `result: changed`,
`mutation: definite_completed`, 70 changed observations, 10,157 records seen; committed state
`completed` with 70 run observations, 11,348 observations, 10,157 heads equal to 10,157 logical
keys, and zero orphan heads, quarantined and rejected; population H 11,278, N 10,157, structural
93,999, projected provider rows 121,103 classified `expected`, mutation reads 635, amplification
1.35, reserve 2,000; provider accounting 6 API calls, 113,279 rows read, 494 rows written, 106,483
request bytes, `readClassification: expected`. The projection over-predicted the actual read by
7,824 rows, about 6.91% above actual; actual utilisation of the 250,000 hard ceiling was about
45.31%, leaving 136,721 of headroom. Run identity, timing and conclusion above are independently
verifiable from GitHub; these Step Summary values are owner evidence. Both are valid to record, and
the distinction is stated rather than blurred.

**Current operational conclusion.** GitHub cron is **active enough to produce natural runs, but
materially late and unreliable as a timer**. Three natural runs have now been delivered
approximately 3h21m, 4h31m and 4h44m after their nominal minutes, and two earlier acceptance windows
produced no run at all. That is exactly the problem DATA-S2C exists to address, and it does not
change the collection engine, the cron cadence `17 1 * * *`, or any resource threshold.

**Nothing in this block was executed.** Reading the GitHub Actions API to verify the run is a
read-only GitHub query. No workflow was dispatched, enabled or disabled, no Cloudflare request, D1
read or mutation, collection, migration, deployment, cron, environment or credential change was
performed.

### Earlier DATA-S2C checkpoint (closed) — external scheduler repository foundation (Package A)

> **Superseded as a current-state statement on 7 September 2026 by the Package B blocks above.** The
> design, guard semantics and rationale below are unchanged and remain in force. What is no longer
> current is its live-state scope: the credential, the Cloudflare secret and the Worker deployment now
> exist.

**Repository implementation only, and at that checkpoint nothing in DATA-S2C was live.** No GitHub
personal access token or App had been created, no Cloudflare secret had been created, no Worker had
been deployed, no Cloudflare Cron Trigger had been created, changed or removed, no workflow had been
dispatched, no D1 request had been performed and no Official FPL collection had been run. The GitHub
cron was `17 1 * * *`, unchanged.

**Why it exists.** GitHub schedule delivery is best-effort and has been measured loose: the
4 September 2026 natural run `33901634593` was created approximately **3h21m** after its nominal
minute, the 5 September run `33948145320` approximately **4h31m**, and the two earlier acceptance
windows `17 10 * * *` and `30 11 * * *` produced **zero** scheduled runs. GitHub documents that
schedule events may be delayed or dropped and exposes no scheduler-registration, armed or next-run
state, so **none of that has a proven cause**. The collection itself is not the problem — the
accepted run finished in about 43 seconds once its run object existed. DATA-S2C therefore adds a
**separate independent way to ask** for the day's collection — an isolated Cloudflare timer Worker
dispatching a GitHub Actions workflow. *(Superseded detail, retained as history: this originally read
"while leaving the GitHub cron in place". Under the 7 September 2026 rollout decision at the top of
this file, GitHub's automatic scheduler is disabled **before** Cloudflare activation, so Cloudflare
becomes the only automatic clock rather than a second one beside GitHub.)* The collection
engine does not change: it remains the GitHub Actions runner invoking the unchanged
`workers/data-platform/run-production-collection.mjs`, and historical Cloudflare Worker collection
stays superseded and forbidden.

**Package A adds five things.** (1) A pure, deterministic, fail-closed **daily opportunity guard**
over GitHub Actions run and job metadata, plus its credential-free entry point. (2) That guard
**wired into the existing scheduled workflow's** credential-free repository gate, which gains a
job-level `actions: read`. Because a job that declares no `permissions:` block inherits the
workflow-level one, the Actions scope is kept out of both workflows' workflow-level defaults, and
each credentialled `collect` job's **effective** scope is `contents: read` and `checks: read` only —
workflow A's by inheritance, workflow B's declared explicitly on the job.
(3) A new **external receiving workflow** `data-s2-production-external.yml`, `workflow_dispatch`
with **zero inputs**, reproducing the scheduled trust boundary exactly — event, ref and repository
assertions, a 40-character event SHA, exact checkout, `HEAD` equality, a fresh remote-`main` proof,
a clean tree, the **unchanged** bounded exact-head Verify module, the guard, the dedicated
unattended `data-s2-production-scheduled` environment, the existing masking order, exact Node
24.19.0, Wrangler removal and a second remote-main check in the same shell before the runner. There
is **no caller-supplied SHA input**: the caller sends `ref: main` and nothing else. (4) A new
**isolated Cloudflare dispatcher Worker** at `workers/schedule-dispatcher/` under the dedicated
identity **`teamsheet-data-s2-dispatcher`**, which must not reuse `teamsheet-data-platform`. (5)
This documentation.

**The guard governs routine collection only** — the scheduled, external and attended manual
workflows, each carrying a credentialled job literally named `collect`. Resume, migration,
reconciliation, EXPLAIN and integrity workflows are **deliberately excluded**; they keep their own
owner-input and approval gates and the shared concurrency group, and counting them would let a
read-only integrity check silently cancel a day's collection. A run consumes the day only through
**attempt 1's** `collect` execution: that execution must exist with any conclusion **other than
`skipped`** and must have **started** in the current UTC day **or** within the **trailing six
hours**; that trailing rule closes the UTC-midnight duplicate hole a late 23:58 start plus a
punctual 00:03 start would otherwise open. A `skipped` collect job — exactly what a refused gate
produces — does not consume; a queued or running attempt-1 one does. The jobs listing is read with
**`filter=all`**, never `filter=latest`, **not because later attempts can consume but so that they
can never hide attempt 1's evidence**: a re-run whose newest attempt skips `collect` must never
erase the earlier attempt that collected. The window is dated by the `collect` job's own
`started_at` rather than the run's `created_at`, so a run that waited hours before collecting is
dated by the collection.

**Only attempt 1 can consume the day**, and that is a repository fact rather than a provider one:
the shared production entry point throws `workflow_retry_forbidden` on every attempt after the
first, **before** it resolves the production identity and **before** it reaches the collector, so a
re-run cannot fetch Official FPL, reach D1 or mutate production. A permanent structural regression
pins that refusal's exact literal and its position ahead of every identity call, the collector and
any network use in `workers/data-platform/run-production-collection.mjs`, which is **not modified**.
`filter=all` stays load-bearing so a later attempt can never hide attempt 1's evidence; a later
attempt is simply never evidence of a collection itself, and a later attempt reporting a
**successful** `collect` contradicts that invariant outright and fails closed as
`guard_rerun_contract_violated`.

**Candidate discovery is a separate, wider window**: the Actions API can only filter a run listing by
`created_at`, so discovery reaches back **35 days** — GitHub's documented workflow-run time limit,
which explicitly includes execution, waiting and approval, and is therefore the whole horizon an
original attempt's `collect` can sit inside. GitHub's 30-day re-run eligibility is **deliberately
excluded**, because re-run eligibility would only matter if a re-run could consume the day and the
pinned entry-point refusal means none can; the superseded chained 65-day derivation is withdrawn.
The classifier still decides on `collect.started_at` alone. Discovery may return runs that cannot
consume; it never omits one that could. No run-level field prunes candidates, because none has
documented semantics strong enough to prove exclusion. A
non-skipped `collect` whose start instant is missing, unparseable, or contradicted by its own run or
the clock is ambiguous, and one page of 100 job executions is the whole bounded read for jobs — a
listing the provider counts higher than it returned is truncated and fails closed. GitHub permits 50
re-runs **in addition to** the original attempt, so a fully exhausted run carries 51 attempts and, at
two governed jobs each, 102 job executions — more than one page returns. That one-page read therefore
deliberately fails closed if that pathological history is ever reached, rather than assuming a page
covers every permitted history.

**The candidate listing is paginated and the read bound is 200.** Workflow B gains three dispatch
opportunities a day under Package C, so a 35-day horizon holds about 35 workflow A runs and about
105 workflow B runs — roughly 140 candidates — which one 100-row page cannot carry and the former
twelve-read bound could not inspect. Candidate listings are now a fixed, non-recursive sequence of
explicitly numbered `page=N` reads at `per_page=100`, capped at ten pages, reconciled against the
provider's own `total_count`: ordering is never relied on, and a short or over-full page, a
`total_count` that changes between pages, a run repeated across pages or a missing page is
`guard_read_failed`. `OPPORTUNITY_GUARD_MAX_READS` is **200**, a hard cap counting every GitHub
request — each listing page and each job listing. The 35 A + 105 B footprint costs about 146
requests, leaving roughly 54 for attended workflow C runs and variance; that is a budget, **not** a
proof that 200 covers every pathological history, and a cycle needing a 201st request refuses with
`guard_read_bound_exhausted` without issuing it. That population was sized for the superseded
coexistence rollout and is **deliberately kept as a conservative assumption**: with workflow A
disabled the real steady state is smaller, and no constant changes. Under the current rollout the
intended steady state is **three automatic guard invocations in a UTC day** — workflow B's 01:17,
02:17 and 03:17 UTC opportunities — with **four** as the upper bound that holds only while workflow A
remains armed, as it does today; each is separately bounded at 200. The earlier "two automatic
invocations per day" wording is superseded, and no unused GitHub rate-limit headroom is claimed:
token and API limits remain an external dependency to observe in live Stage C/D.
The attended manual workflow is **not** guarded, but does consume the day for both automatic paths.
Every malformed, partial, truncated or unreadable response is
`AMBIGUOUS_REQUIRES_OWNER_ATTENTION`. **The guard never fails open.**

**The dispatcher is a timer, not a collector.** It imports nothing outside its own directory, holds
no D1 binding and no Cloudflare data credential, reads and writes no D1, and exposes no fetch
handler, `workers.dev` hostname, preview URL, route or custom domain. Its Package A Wrangler config
declares `"triggers": { "crons": [] }` **explicitly rather than omitting it**, because Cloudflare
treats triggers as a total assignment — an explicit empty array removes triggers from this identity
while omitting the block leaves whatever exists in place. **Package A arms nothing.**
`controller.noRetry()` runs before any dispatch attempt, exactly one dispatch request is issued per
fire, and neither an `AMBIGUOUS` nor a `REJECTED` outcome is ever retried in the same fire; only
401, 403, 404 and 422 are `REJECTED`, and 5xx, 429, any 3xx, transport failures, timeouts, malformed
200 bodies and every unrecognised status are `AMBIGUOUS`. It names exactly one future secret
binding, `GITHUB_DISPATCH_TOKEN`, **which did not exist at that checkpoint** *(superseded — the owner
created and bound that credential in Package B on 7 September 2026; see the Package B closeout
above)*, and its logs carry closed enums and
bounded integers only. The historical `teamsheet-data-platform` Worker — still declaring a
thirty-minute cron and a D1 binding, still exposing a scheduled collector — is left **byte-unchanged**
with its SHA-256 pinned by test.

**Concurrency is unchanged and the limitation is stated honestly.** All eight members of the
`data-s2-production-collection` group, the new workflow included, stay `cancel-in-progress: false`
with **no `queue:` key**, and a permanent test pins that membership. `cancel-in-progress: false`
protects a **running** workflow, not a **pending** one: a newly queued workflow can replace an
existing pending workflow in that group. `queue: max` is deliberately not implemented, and no future
Cloudflare dispatch window may be claimed to bound this exposure while the scheduled workflow
remains armed.

**Live evidence for run `34015422874`, with its provenance split.** Its identity, timing and
conclusion were **independently verified** here from the GitHub Actions API and are recorded in
"Current scheduler state" above. Its Step Summary detail — 70 changes, 10,157 `recordsSeen`, 11,348
observations, 10,157 heads, zero orphan, quarantined and rejected, projected 121,103, actual
113,279, writes 494, 6 API calls, 106,483 request bytes — is **owner-supplied and not independently
verified**, because the Step Summary is not retrievable through the GitHub API available here.
Nothing in Package A read, dispatched or influenced that run. It **supports but does not calibrate**
the capacity model: 1.35 and 2,000 are unchanged and still INFERRED, and 264, 141 and 70 are three
samples, not a distribution.

**Nothing else moved.** No collector semantics, no threshold (150,000 / 200,000 / 250,000 reads,
40,000 writes, 8 API calls, 4,000 routine changed observations, 8 MiB per Official response all
stand), no projection factor, no SQL, no schema, index or migration — still exactly 0001–0003 and
five indexes, with **no migration 0004** — no provider, model, fixture, captaincy, squad, transfer,
rank or Mini-League logic, no product or UI code, no build input, and no generated deployable needed
regeneration.

**Merging does not activate DATA-S2C.** Its one behavioural effect is that future natural runs of
the existing scheduled workflow will execute the new fail-closed guard, which is approved. Whether
GitHub has that scheduled workflow enabled is owner-side state this repository cannot change, and
Package A changes nothing about it. It **is** readable through the GitHub Actions API, and was read
for that checkpoint: workflow `350014371` reported `state: active` and produced successful natural
run `34015422874` on 6 September 2026. *(Superseded: the owner disabled it on 7 September 2026 and it
now reports `state: disabled_manually`, so no armed automatic path remains for the guard to act on
until Package C activates Cloudflare.)* The earlier record of it being owner-disabled after run
`33948145320` is historical.

Next gates, each separate, under the revised rollout at the top of this file: owner review and
merge; exact-`main` Verify; then the owner-approved disable of GitHub scheduler workflow A; then the
dormant Cloudflare provisioning package (credential, secret, deployment, `"crons": []`); then the
change from `"crons": []` to the approved 01:17 / 02:17 / 03:17 UTC entries; then observation of
Cloudflare as the sole automatic scheduler; then eventual retirement of the obsolete GitHub
scheduled workflow. See [DATA-S2C external
scheduler](workers/data-platform/DATA-S2C-PRODUCTION-SCHEDULER-REPLACEMENT.md).

### Current DATA-S2B checkpoint — capacity restoration live acceptance PASS

**FACT: the first attended production collection under the restored envelope succeeded.** Workflow
`DATA-S2 Production Collection via D1 REST` (workflow `348625053`), run `33990959542`, run number 3,
attempt 1, event `workflow_dispatch`, head `main` `2ef79bf961eb22d9d86d75e99abe9ca769aebcf8`,
conclusion **success**, both `repository-gate` and `collect` succeeding, after exact-`main` Verify
Teamsheet **#611** (run `33989822673`) passed on that SHA. Because `runProductionCollection` returns
only after its synchronous postflight has validated the exact completed run, that success is itself
proof that postflight validation ran and passed — the step run `33948145320` never reached.

**Measured result.** `result: changed`, `mutation: definite_completed`, 141 changed observations,
10,157 records seen. Committed state: `completed`, 141 run observations, 11,278 observations, 10,157
heads equal to 10,157 logical keys, and **zero** orphan heads, quarantined and rejected. Population
and planning: H 11,137, N 10,146, D 141, structural 93,924, projected provider rows 121,902, both
classified `expected`. Provider accounting: **6 API calls, 113,352 rows read, 1,005 rows written,
209,511 request bytes**, `readClassification: expected`.

**FACT: the projection was conservative.** Projected 121,902 against actual 113,352 — over-predicting
by **8,550**, which is ≈ 7.54% above actual, or ≈ 7.01% of the projected value. Headroom below the
250,000 hard ceiling was **136,648**, an actual utilisation of ≈ 45.34%; 36,648 below the 150,000
expected band; 78,098 of projected headroom below the 200,000 soft threshold; 38,995 of write
headroom; two spare API calls. **The 150,000 / 200,000 / 250,000 envelope did not bind this cycle.**

**First per-call evidence, recorded but not acted on.** The two population counts billed exactly H
and N, consistent with the index-only plans the repository's `EXPLAIN` contracts already enforce —
provider `rowsRead` alone does not independently establish a physical query plan. `HEADS_SQL`
billed 40,019 against a structural 3N of 30,438 (≈ 1.315); the postflight billed 51,351 against
42,139 (≈ 1.219); the commit's mutation reads were 696 against a modelled 1,266. Whole-cycle actual
over structural was ≈ 1.2068, below the 1.35 planning assumption and **not** comparable with the
4 September 1.311944, which was measured under the superseded O(H) plan. The write estimate matched
measured writes exactly for a second time, now including the head split. **Correct reading: the
first instrumented live sample supports the current conservative projection assumptions.** It does
not prove the amplification correct and the model is not calibrated; one sample is not a
distribution, and 1.35, 2,000 and the mutation-read constants are all unchanged.

**Incident closed.** The chain is: run `33948145320` committed and then failed resource enforcement
before postflight validation; Stage 0 run `33966125991` proved that committed state valid; PR #223
corrected the read model, telemetry and current-head plan; PR #224 set the 150,000 / 200,000 /
250,000 envelope; Verify #611 passed; run `33990959542` completed cleanly at 113,352 rows read.
**The capacity-restoration live acceptance is PASS**, and it closes the immediate D1
capacity-restoration incident.

**It proves nothing beyond that.** Not season-long capacity — the model carries a `2H` term over an
append-only history and changed-observation counts now have two samples (264 and 141), not a
distribution. Not exact future provider billing. Not GitHub schedule reliability. Not that 1.35 and
2,000 are optimal. Not that no later optimisation will be needed.

> **Superseded on 6 September 2026.** The scheduled workflow `350014371` has since been
> re-enabled by the owner and reports `state: active`; it produced successful natural run
> `34015422874`. The statement below was accurate at this checkpoint and is retained as history.
> See "Current scheduler state" at the top of this file.

**Scheduler unchanged and still gated.** The permanent cron stays `17 1 * * *` and the scheduled
workflow `350014371` was verified through the GitHub Actions API as still **`disabled_manually`**.
This checkpoint does not enable it. **GitHub schedule delivery is best-effort**: the cron minute is
an opportunity, never a guaranteed collection instant, and the two natural scheduled runs were
created approximately 3h21m and 4h31m after their nominal minutes. That remains separate and
unresolved.

**Nothing was executed for this closeout.** No Cloudflare request, D1 read, D1 mutation, collection,
workflow dispatch, re-run, migration, index, schema, threshold, cron, scheduler, deployment,
environment or credential change. See
[capacity live acceptance closeout](workers/data-platform/DATA-S2B-CAPACITY-LIVE-ACCEPTANCE-CLOSEOUT.md).

### Current DATA-S2B checkpoint — production capacity envelope restored (repository only)

> **Superseded in its forward-looking part by the live-acceptance checkpoint above.** Its decision,
> rationale and thresholds are unchanged and remain in force. What is no longer current is its
> status: the envelope it describes as untested has since been exercised by attended production run
> `33990959542`, which completed successfully at 113,352 provider rows read against a 121,902
> projection, with clean postflight state. Its statement that collection capability was not yet
> proven was accurate when written and has now been answered for one cycle.


**FACT: the 5 September integrity question is closed.** Workflow `DATA-S2B Committed Run Integrity`
(workflow `350897195`), run `33966125991`, run number 1, attempt 1, event `workflow_dispatch`, head
`main` `bfcac663f4bfb02274843caa8d4332d8622f68d7`, conclusion **success**, both `repository-gate`
and `committed-run-integrity` succeeding. That runner rethrows for every classification other than
`COMMITTED_STATE_VALID`, so its success proves the state scheduled run `33948145320` committed
satisfies the existing production postflight contract. It was read-only: one D1 call,
`rows_written` required to be exactly zero, `mutationIssued: false`. **This checkpoint is capacity
only; corruption and repair are not reopened.**

**FACT: the previous 125,000 envelope was operationally too tight.** Under the corrected
conservative model merged in PR #223, the pre-mutation projection at the governed population run
`33948145320` left behind returns **132,015** for a 264-change cycle, and stays above 125,000 even
with **no changed observations at all**. The predictive gate would therefore have refused every
realistic cycle before mutation. A threshold that refuses everything protects nothing.

**DECISION — Package A, capacity envelope only.** Three distinct thresholds replace the superseded
pair of 100,000 expected / 125,000 hard, and the predictive gate no longer compares against the
hard ceiling:

| | Constant | Value | Input | Blocking |
|---|---|---|---|---|
| EXPECTED | `EXPECTED_D1_ROWS_READ_PER_CYCLE` | 150,000 | projection, structural total, final actual rows | **No** — classifies only |
| SOFT | `SOFT_D1_ROWS_READ_PER_CYCLE` | 200,000 | amplified provider projection, once, before the start mutation | **Yes** — `production_projected_read_budget_exceeded`, `mutation = none` |
| HARD | `MAX_D1_ROWS_READ_PER_CYCLE` | 250,000 | Cloudflare's returned `meta.rows_read`, after every call | **Yes** — `production_d1_budget_exceeded` |

**RATIONALE.** The order is the justification: PR #223 corrected the dishonest estimator **first**,
and only then was the envelope resized — raising a ceiling behind an estimator that under-predicted
by 31% would have been permission to overrun further. The soft refusal now happens before any
mutation and writes nothing; the hard breaker remains independent and based on actual provider
accounting; the 25% gap between them absorbs a projection error five times larger than the one
observed on the only measured sample, which is what removes the failure mode run `33948145320` hit.
At 250,000 the internal breaker is **5.0%** of the Cloudflare Workers Free daily allowance of
5,000,000 rows read for the one approved cycle a day, so it stays far tighter than the provider
quota. No SQL, schema or index change is justified before live per-statement telemetry exists.

The closed planning enum keeps two members: `hard_ceiling_headroom` is renamed `above_expected`,
because a name promising headroom against one named ceiling is false at the two call sites that
measure against a different one. Bounded telemetry now carries `rowsReadExpected`, `rowsReadSoft`
and `rowsReadHard` explicitly.

**Nothing else moved.** No SQL, no query plan, no `EXPLAIN` contract, no migration (still exactly
0001–0003, five indexes, **no migration 0004**), no index, no schema, no data semantics, no
postflight weakening. `PROVIDER_READ_AMPLIFICATION = 1.35`, `PROVIDER_READ_SAFETY_RESERVE = 2000`,
the mutation-read and write estimators, the 40,000 write ceiling, the 8-call API ceiling and the
`17 1 * * *` cron are all unchanged, and the scheduled workflow remains **owner-disabled**
*(historical: the owner has since re-enabled it — see "Current scheduler state" above)*.

**Nothing was executed.** No Cloudflare request, D1 read, D1 mutation, workflow dispatch, Stage 0
re-run, collection, migration, deployment, cron, schedule, environment or credential change was
performed.

**LIMITATIONS.** This restores an operating envelope; it is **not** proof that production
collection works, and no cycle has run under it. 1.35 and 2,000 remain INFERRED from one sample. No
season-long capacity guarantee is claimed — the structural model carries a `2H` term over an
append-only history, and the average changed-observation count per collection has exactly one
measurement. GitHub schedule-delivery lateness remains a separate matter.

Next gates, each separate: **(1)** owner review and merge; **(2)** exact-`main` Verify; **(3)** a
separate owner approval for exactly **one** attended manual production collection while the
scheduler stays disabled, whose per-call telemetry replaces the inferred factors with measured
ones. Scheduler re-enable and any schema change remain later, separate gates. *(All three gates are
closed: the collection ran as `33990959542`, and the scheduler has since been re-enabled — see
"Current scheduler state" above.)* See
[capacity envelope restoration](workers/data-platform/DATA-S2B-CAPACITY-ENVELOPE-RESTORATION.md).

### Current DATA-S2B checkpoint — read-budget remediation P2+ (repository only)

> **Superseded in its forward-looking part by the capacity checkpoint above.** Its recorded
> evidence stands and its model corrections are unchanged. Two of its statements are no longer
> current: the committed state it describes as unproven **has since been proved valid** by Stage 0
> run `33966125991`, and the 125,000 hard ceiling it holds unchanged **has since been resized** to
> the three-threshold envelope of 150,000 expected / 200,000 soft / 250,000 hard. Where it says the
> corrected projection exceeds 125,000 and the soft gate would refuse, that remains an accurate
> statement about the superseded envelope and is the evidence the resize rests on.


**The permanent cadence produced a natural scheduled run and it failed on resource enforcement.**
Verified independently from the GitHub Actions API: run `33948145320`, workflow `DATA-S2 Scheduled
Production Collection via D1 REST`, run number 2, attempt 1, event `schedule`, head branch `main`,
head SHA `9a1c6a87e17de08ed2c5b650b05cdc3eab96291c`, conclusion `failure`. GitHub created it at
`2026-09-05T05:48:05Z` against a 01:17 UTC nominal minute — approximately **4h31m** of
schedule-event **delivery** delay, upstream of the workflow, with no proven cause, and never a
collection delay. `repository-gate` succeeded. `collect` failed `production_d1_budget_exceeded` in
phase `postflight_read`, carrying `productionMutation: 'definite_completed'` and
`productionRetryable: false`. The precise sequence matters: the commit mutation returned
successfully, its accounting passed the hard enforcement check, the postflight D1 read **was issued
and returned**, its `meta.rows_read` was added to cumulative provider accounting, and `enforce()`
then threw — so `validateProductionPostflight()` was never reached. **The postflight read ran;
postflight validation did not.** The commit is `definite_completed` and **the state that run left in
production D1 is therefore unproven — which is not evidence that it is invalid or corrupt.** The owner then disabled the scheduled
workflow; GitHub reported it `disabled_manually` and, **at that checkpoint**, it had to remain
disabled. *(Historical. That hold was lifted after the capacity live acceptance passed: workflow
`350014371` now reports `state: active` and produced successful natural run `34015422874` — see
"Current scheduler state" at the top of this file.)*

**The read model is proven defective.** The preceding successful run `33901634593` measured
**124,430** actual `rowsRead` against a **94,844** structural estimate — a delta of 29,586, about
31.19%, finishing 570 rows below the 125,000 hard ceiling. FACT: the write estimate matched that
run's measured `rowsWritten` of 1,852 exactly; that is a fact about the write model and is **not**
evidence that any particular Cloudflare index or table visit is billed in one particular way. The
read defect is proven because actual `rowsRead` materially exceeded the structural estimate, the
dispatch counts provider `rows_read` from every D1 call, the structural estimator modelled no
mutation-read usage at all, and the current-head statement carried O(H) work. **The exact
attribution of the 29,586 rows remains partly unknown and no precise split is invented.**

**This package is repository implementation only.** No Cloudflare request, workflow dispatch, D1
read or mutation, collection, resume, reconciliation, migration, deployment, Worker action, Cron
change, schedule change, environment change or credential change was performed. It: corrects the
pre-mutation projection so a cycle cannot pass a predictive check, mutate production and only then
discover the envelope was impossible; adds an explicit routine mutation-read estimator mirroring the
write estimator's inputs; adds a conservative **INFERRED** provider amplification of 1.35 and a
2,000-row reserve, both calibrated above the observed 1.311944 raw and ~1.28 residual ratios and
both pinned in tests for later recalibration; separates the predictive soft gate
(`production_projected_read_budget_exceeded`, `mutation = none`, writes nothing) from the unchanged
hard circuit breaker (`production_d1_budget_exceeded`) over the one unchanged ceiling; adds bounded
per-call and per-statement resource telemetry carrying bounded numeric values and closed enums
only, with its stored-call array bound to the production D1 call ceiling; and re-plans
current-head retrieval from O(H) to O(N) using `CROSS JOIN`, with a byte-identical predicate, an
identical row set proven across seeded governed states, and an EXPLAIN contract **tightened rather
than relaxed** so the superseded O(H) and pre-migration-0003 plans stay rejected. The whole-cycle
structural model is now `2H + 7N + 4D + 64` where it was `5H + 4N + 4D + 64`; the established
`7N + 64` baseline at `H = N`, `D = 0` is unchanged.

A strictly read-only committed-run integrity workflow now exists to prove whether the state run
`33948145320` committed satisfies the existing production postflight contract. It reuses the
production postflight read and validator unchanged, derives its run identity from a reviewed
constant (`2026-09-05T05:48:00.000Z`, pinned by test to
`gha-e385726067648e08d44f8870df35ada41aa9b0f4`), takes no SQL/table/statement/identity input, issues
at most one D1 call, requires `rows_written === 0` under a 75,000-row bound, and classifies only
`COMMITTED_STATE_VALID`, `COMMITTED_STATE_INVALID_REQUIRES_OWNER_ATTENTION` or
`AMBIGUOUS_REQUIRES_OWNER_ATTENTION`. **IT HAS NOT BEEN DISPATCHED.**

**Reported honestly: Stage 3 alone does not restore collection capability.** The re-plan saves only
`3(H − N) = 1,446` structural rows at the current population, where H and N are close; its value is
removing the term that grows without bound. Applying the corrected projection to the population run
`33948145320` left behind exceeds 125,000, so under those population and change assumptions the
soft gate would refuse before mutation rather than commit and then fail. The exact outcome of any
future execution is not claimed: it depends on that cycle's own population, changed-observation
count, rows already billed before the gate and the Official FPL state of the day. If the next cycle
presents a comparable or higher projected workload, the soft gate will refuse before mutation.
Per that approval's stop condition this was recorded, not worked around: **the 125,000 ceiling was
unchanged in that package, migration 0004 was not created and no covering index was added.** The
ceiling has since been resized by the separately approved capacity package recorded above;
migration 0004 still does not exist and no covering index has been added.
Whether a schema change is warranted is a separate owner decision informed by the new telemetry and
a first instrumented production validation. Next gates, each separate: merge and exact-`main`
Verify; then one owner-approved dispatch of the committed-run integrity workflow. Collection,
scheduler re-enable and any schema change remain later separate gates. See
[read-budget remediation](workers/data-platform/DATA-S2B-READ-BUDGET-REMEDIATION.md).

### Earlier DATA-S2B checkpoint (gate closed, and it did not pass) — natural schedule accepted; permanent cadence restored

> **Superseded in its forward-looking part.** Its recorded evidence for run `33901634593` stands and
> the permanent cadence `17 1 * * *` is unchanged. Its next live gate — "the first genuine natural
> run produced by `17 1 * * *`" — is **closed and was not passed**: that run was `33948145320`,
> whose gate and commit succeeded and whose resource enforcement then failed. The scheduler has since
> been owner-disabled. See the current checkpoint above.

**The first genuine natural GitHub Actions scheduled production run has succeeded.** Verified
independently from the GitHub Actions API: workflow `DATA-S2 Scheduled Production Collection via D1
REST`, run `33901634593`, run number 1, attempt 1, event `schedule`, head branch `main`, head SHA
`dac27b3860428bc55c6d505e8a817a207d30f904`, conclusion `success`, with both `repository-gate` and
`collect` succeeding. **No `workflow_dispatch` was used for this acceptance.** The gate resolved the
exact-head `Tests and deterministic build` proof as `verify_success after 1 read(s)`, and because
`runProductionCollection` returns only after its synchronous postflight has validated the exact
completed run, the `collect` success proves the whole scheduled trust boundary end to end:
schedule-event creation, credential-free gate, dedicated `data-s2-production-scheduled` environment
admission, Official FPL fetch and the bounded direct Cloudflare D1 REST write path. Exact provider
`meta.rows_read` / `meta.rows_written` reach only the Step Summary, are not retrievable through the
GitHub API available here, and are stated nowhere.

**GitHub's schedule delivery was materially late.** The nominal minute was 14:17 UTC (the third
temporary window's `17 14 * * *`); GitHub created the run object at `2026-09-04T17:38:15Z` and it
completed at `2026-09-04T17:38:58Z`. The observed delay of approximately **3 hours 21 minutes** is a
**schedule-event delivery delay, never a collection delay** — once the run existed it finished in
about 43 seconds. **The cause is not proven and none is invented**: GitHub exposes no
scheduler-registration, armed or next-run state through REST or GraphQL, and documents that
schedule events may be delayed under load or dropped entirely. Treat it as a permanent operational
limitation: the cron minute is an opportunity, never a guaranteed execution instant, no arbitrary
30–60 minute lateness threshold may declare a future run missed, and one success is a single sample
that proves natural delivery and the downstream path but nothing about reliability or timing.

With that acceptance recorded, the single trigger of
`.github/workflows/data-s2-production-scheduled.yml` is **restored from the temporary `17 14 * * *`
to the permanent approved cadence `17 1 * * *` (01:17 UTC)**, together with the wired
`PRODUCTION_COLLECTION_SCHEDULE`, the `EVENT_SCHEDULE` gate comparison and the permanent tests that
bind them. The workflow still declares **no `timezone:` field**, so GitHub interprets the cron in
UTC. Exactly one production schedule trigger exists: no second cron, no temporary window retained,
no diagnostic cron, no schedule probe, no heartbeat workflow, no `workflow_dispatch` on this
workflow, no alternate scheduler and no Cloudflare Cron. Window history: `17 10 * * *` (10:17 UTC)
and `30 11 * * *` (11:30 UTC) each produced **zero** schedule runs; `17 14 * * *` produced the
accepted run above.

**What ran, and what this checkpoint itself did.** Run `33901634593` was a **real natural scheduled
production collection**: it fetched Official FPL and exercised the live Cloudflare D1 REST write
path. It happened on `main` **before** this restoration work began, was produced by GitHub's own
scheduler rather than by any action taken here, and is recorded above as evidence, not as something
this checkpoint performed.

**This restoration itself executed nothing.** Preparing it performed no additional production
collection, no D1 request or mutation, no workflow dispatch, no deliberate Cloudflare operation, no
migration, deployment, Worker action, Cron change, and no environment, secret, variable or
credential change. The manual production collection workflow and the read-only
scheduled-environment preflight workflow are untouched, and no model, provider, schema or
calculation behaviour changes. **Merging changes the live production schedule** from 14:17 UTC back
to 01:17 UTC. Merging is not operational completion: the next live gate is the **first genuine
natural run produced by `17 1 * * *`**, requiring event `schedule`, exact then-current `main`, and
`repository-gate` and `collect` success — never a `workflow_dispatch` substitute and never another
temporary acceptance cron. See
[daily GitHub Actions schedule](workers/data-platform/DATA-S2B-GITHUB-ACTIONS-DAILY-SCHEDULE.md).

### Earlier DATA-S2B checkpoint (gates closed) — manual read-only scheduled-environment credential preflight

> **Superseded — the preflight has since run.** Its next step is no longer a future owner-approved
> dispatch. It was dispatched once and **succeeded**: run `33871716975`, attempt 1, on exact `main`.
> That proved, point in time, that `CLOUDFLARE_ACCOUNT_ID` matches
> `CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT`, that `CLOUDFLARE_D1_TOKEN` verifies as `active`, and
> that those credentials can read the exact reviewed production D1 database. It executed no SQL and
> performed no mutation, and it says nothing about GitHub schedule-event creation, which is strictly
> upstream of every credential it checks. The design text below is retained as history and its
> forward-looking gates are closed.

A separate, manual, strictly read-only diagnostic now exists to prove that the GitHub environment
`data-s2-production-scheduled` holds credentials that are internally consistent and can reach the
reviewed production D1 database. It is **not** a production scheduler: it performs no collection,
executes **no SQL**, never reaches the D1 `/query` endpoint and makes no Cloudflare mutation.
`.github/workflows/data-s2-scheduled-environment-preflight.yml` is `workflow_dispatch`-only with
**zero inputs**, carries no `schedule`, `push`, `pull_request`, `repository_dispatch`,
`workflow_call` or `workflow_run` trigger, grants only `contents: read`, uses no GitHub token,
requests exactly the `data-s2-production-scheduled` environment and holds its own concurrency
group so a read-only diagnostic never serializes with real production work.

It performs exactly three checks, in this order: `SHA-256(CLOUDFLARE_ACCOUNT_ID)` compared
byte-for-byte with `CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT` using the existing canonical
`derivedAccountFingerprint` rather than a competing definition, entirely locally so a mismatched
environment stops before any credential leaves the runner; Cloudflare's official read-only
`GET /client/v4/user/tokens/verify`, requiring `result.status === 'active'`; and Cloudflare's
read-only D1 database detail read `GET .../accounts/{account_id}/d1/database/{database_id}`,
requiring every database identity the response carries to equal the reviewed repository constant
`PRODUCTION_D1_ID`. `CLOUDFLARE_PRODUCTION_D1_ID` is deliberately not introduced as a required
environment variable. There is no retry, no fallback and no repair; every failure is one of a
closed set of stable sanitized classes.

**This diagnostic deliberately says nothing about GitHub's schedule-event creation**, which is
strictly upstream of every credential it checks. A pass would prove the credential/account/D1
access contract only — never that a cron fires, that a collection would succeed, that the token's
scope suffices for a `/query` request, or the environment's protection rules. The PR #215
identifier-logging remediation is preserved exactly: the account id and D1 token stay secrets, the
fingerprint mask is registered by the credentialled job's first step before the variable is
materialised on the final step, the D1 id stays a repository constant in no workflow value, and
the entry point discards the original error object on failure so no runtime message can carry a
request URL into the log.

**Nothing was executed for this checkpoint.** No Cloudflare request, workflow dispatch, D1 read,
D1 SQL, D1 mutation, collection, migration, deployment, schedule change, cron change, environment
or credential change was performed. The scheduled cron was `30 11 * * *` at that checkpoint — since
moved to `17 14 * * *` for the third acceptance window, and now restored to the permanent
`17 1 * * *` by the checkpoint above — and the manual collection workflow is unchanged. The next
gates recorded at that checkpoint — merge and exact-`main` Verify, then separate owner approval to
dispatch the preflight once — are **both closed**: that merge and Verify happened, and the single
approved dispatch ran as run `33871716975` and succeeded. See
[scheduled-environment preflight](workers/data-platform/DATA-S2B-SCHEDULED-ENVIRONMENT-PREFLIGHT.md).

### Earlier DATA-S2B checkpoint (gates closed) — Stage D once-daily GitHub Actions collection schedule

> **Superseded — the schedule is already activated.** The "Merging activates the schedule" gate
> below was the position before Stage D merged; it is history, not a current statement. Stage D did
> merge, the schedule became live, and it produced the accepted natural run `33901634593`. The
> temporary acceptance windows it describes are finished and the permanent cadence `17 1 * * *` is
> restored — see the current checkpoint at the top of this file.

**The hardened manual normal production collection has executed live and succeeded.** Verified
independently from the GitHub Actions API: workflow `DATA-S2 Production Collection via D1 REST`,
run `33818972728`, run number 2, attempt 1, event `workflow_dispatch`, head branch `main`, head
SHA `319dfddd8ac83ae5ab7d20bfb684d3760bf64fbf`, conclusion `success`, with both `repository-gate`
and `collect` succeeding. Because `runProductionCollection` returns only after its synchronous
postflight has validated the exact completed run, that success proves the whole hardened manual
trust boundary end to end. Do not re-run it. Owner-side Cloudflare telemetry in a cleaner
30-minute window surrounding that run showed approximately 32k rows read, 375 rows written and 10
queries with 12.55 MB storage — **database time-window dashboard aggregates, never exact
per-workflow provider accounting**, and never to be recorded as the collection's exact usage.
Exact provider `meta` for the run reaches only its Step Summary and is not retrievable through the
GitHub API available here. That telemetry is nonetheless far below every ceiling, so **no
resource-headroom remediation is justified**: no SQL optimisation, no index change, no migration
0004, and no movement in the 100,000 expected reads, 125,000 hard reads, 40,000 hard writes or
4,000 routine changed-observation ceilings.

Stage D adds the forward scheduler: a **new, separate** workflow
`.github/workflows/data-s2-production-scheduled.yml`, name `DATA-S2 Scheduled Production
Collection via D1 REST`, carrying exactly one trigger — at that checkpoint the third temporary
acceptance window `schedule: - cron: '17 14 * * *'` — and no input of any kind. **That cron was a
TEMPORARY owner-approved acceptance window for 4 September 2026 (14:17 UTC / 15:17 BST); the
permanent cadence `17 1 * * *` (01:17 UTC) has since been restored by the separately reviewed
change recorded in the checkpoint above, after that window produced the accepted natural run
`33901634593`.** It was the **third** approved temporary window; the first two, `17 10 * * *`
(10:17 UTC / 11:17 BST) and `30 11 * * *` (11:30 UTC / 12:30 BST), each **produced zero schedule
runs**. The first was merged as `3c017786bce8cba8daf0091cf2e297f8e57789f8` 42m49s before its
minute — workflow `350014371` runs `total_count: 0` and
repository-wide `event=schedule` `total_count: 0`, so no run object was created and nothing reached
the gate, environment, credentials, Official FPL, D1 or postflight. Across that window the workflow
stayed `active` and every configuration check passed (default branch, single trigger, single cron,
parses, recognised by name; repository public, non-fork, unarchived, User-owned so no org policy
layer). GitHub exposes no scheduler-registration or next-run state in REST or GraphQL, and documents
that schedule events may be delayed or dropped, so the non-fire has **no proven root cause**. Exactly one trigger exists either way: 01:17 UTC is not retained beside
it and no manual trigger is added. One best-effort full collection opportunity each UTC day; no
pre-deadline collection, no polling, no second daily run and **no Cloudflare Cron**. The dormant
constant is now the wired `PRODUCTION_COLLECTION_SCHEDULE`. A schedule event carries no owner
judgement, so its immutable candidate source is the SHA the event itself carries: a
credential-free `repository-gate` proves event name, `github.event.schedule`, repository, ref,
40-character SHA, exact checkout, `HEAD`, clean tree and a freshly resolved remote `main`, then
waits read-only and inside a fixed ten-read bound for that exact head's `Tests and deterministic
build` success — stopping on failure, cancellation, absence, a wrong SHA or an exhausted bound,
and never dispatching, re-running or re-requesting anything. Only then does the `collect` job
request the **dedicated** `data-s2-production-scheduled` environment, re-establish Node, `HEAD`,
clean tree and Wrangler removal, fix `COLLECTION_SCHEDULED_AT` once from the runner clock, resolve
remote `main` again from the remote and invoke the unchanged shared entry point.
`.github/workflows/data-s2-production-collection.yml` is unchanged in shape and stays
`workflow_dispatch`-only against the attended `data-s2-production-collection` environment. Both
share the one non-cancelling `data-s2-production-collection` concurrency group, both refuse
`GITHUB_RUN_ATTEMPT !== '1'`, and there is no scheduled fast path: identical collector, ceilings,
mutation classification and synchronous postflight. The nominal cron minute is an opportunity,
never the execution instant — GitHub may delay or drop a scheduled event, and the collection identity is
always the actual execution minute.

**Nothing was executed for this checkpoint.** No Cloudflare request, workflow dispatch, D1 read or
mutation, collection, migration, deployment, Worker action, Cron change, GitHub environment or
credential change was performed *while preparing Stage D*. **Merging activates the schedule** — the
pre-merge position, now historical: it was not to merge until the owner confirmed `data-s2-production-scheduled` exists with `main`-only deployment branch, no
required reviewers, `CLOUDFLARE_D1_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets and the
`CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT` variable, and no D1 identifier — GitHub otherwise
creates a referenced environment implicitly and unprotected. Live proof is the **first natural
scheduled run**, never a simulation. **That environment gate and that live proof are both
satisfied**: the accepted run `33901634593` was admitted to `data-s2-production-scheduled` and its
credentials resolved — see the checkpoint above. The environment's protection rules still cannot be
proved from this repository and remain owner-side. See
[daily GitHub Actions schedule](workers/data-platform/DATA-S2B-GITHUB-ACTIONS-DAILY-SCHEDULE.md).

<!-- DATA-S2B-MANUAL-COLLECTION-HARDENING-2026-09-03 -->
### Current DATA-S2B checkpoint — manual collection hardening; first production run completed

**The originally unresolved first production collection run is completed.** The owner dispatched
two runs from exact `main` `d79dd37451e16b642ce96709b8635c3ac618c366`, both verified
independently from the GitHub Actions API. Read-only reconciliation `DATA-S2B First Production
Run Reconciliation` run `33792104384` (attempt 1) succeeded; its entry point exits zero only on
`RESUME_RECONCILIATION_SAFE`, so success proves that classification, and the runner required
`rows_written === 0` under a 1,000-row read guard, so it mutated nothing. `DATA-S2 First
Production Run Resume` run `33815400284` (attempt 1) then succeeded in both jobs;
`runProductionCollection` returns only after synchronous postflight has proved the exact
completed run, its counters, run-owned observation ownership, heads equal to distinct logical
keys and zero orphan, invalid, non-accepted, quarantined and rejection state. The unresolved
`started` ledger row therefore needs no further reconciliation or resume. **Exact provider
`meta.rows_read` and `meta.rows_written` for those runs reach only the GitHub Step Summary, are
not retrievable through the GitHub API available here, and are stated nowhere; Cloudflare
dashboard aggregates are account-level time-window figures, are not per-workflow accounting, and
must never be recorded as exact resume usage.**

The **manual normal production collection workflow is now hardened to the same trust boundary**
as the migration-0003, live EXPLAIN, reconciliation and resume paths. It stays manual-only and
takes one immutable `approved_sha`. A credential-free `repository-gate` job — no protected
environment, no Cloudflare secret, no account fingerprint, no D1 — proves the event, the exact
repository `priteshpatel390-del/FPL`, ref `refs/heads/main`, a lowercase 40-character SHA, an
exact checkout, `HEAD` equal to the approved SHA, a clean tree, a freshly resolved remote `main`
equal to it, and a completed, successful, exact-head `Tests and deterministic build` check run
produced by `github-actions`. Only then does the `collect` job request the existing
`data-s2-production-collection` environment and its existing credentials; none were created,
renamed, rotated or widened. Because environment admission can wait while `main` advances, the
final step re-establishes exact Node 24.19.0, exact `HEAD`, a clean tree and Wrangler removal,
then resolves remote `main` again from the remote — never from a value carried between jobs —
in the same shell immediately before the runner, with no Cloudflare request before it. The one
attempt's `COLLECTION_SCHEDULED_AT` is fixed once inside that same protected step rather than
travelling through `GITHUB_ENV`, so no earlier mutable stage establishes production identity; its
minute-precision UTC semantic is unchanged. `GITHUB_RUN_ATTEMPT !== '1'` still refuses a GitHub
re-run, and the entry point now writes the sanitized mutation classification to the workflow
summary before rethrowing, so a stopped collection is never presented as a no-write.

No ceiling moved: 100,000 expected reads, 125,000 hard reads, 40,000 hard writes, 8 D1 calls and
8 MiB per Official response all stand, with no blind retry, bounded unknown-mutation
reconciliation and synchronous postflight intact. The PR #215 identifier-logging remediation is
preserved: no D1 id in any workflow environment, the fingerprint mask registered by the
credentialled job's first step before the variable is materialised, and the variable present only
in the final production step.

**Nothing was executed for this checkpoint.** No Cloudflare request, workflow dispatch, D1 read
or mutation, collection, resume, reconciliation, migration, deployment, schedule, Cron or
credential change was performed. GitHub scheduling stays disabled, live Cloudflare Cron stays
intentionally absent, and `FUTURE_PRODUCTION_COLLECTION_SCHEDULE = '17 1 * * *'` stays unwired.
Next gates: merge and exact-`main` Verify, then separate owner approval for exactly **one**
manual normal production collection. Recurring scheduling remains a later separate approval. See
[manual collection hardening](workers/data-platform/DATA-S2B-MANUAL-COLLECTION-HARDENING.md).

**Superseded by the Stage D checkpoint above**: that one manual collection has since run and
succeeded (`33818972728`), the constant is now the wired `PRODUCTION_COLLECTION_SCHEDULE`, and
recurring GitHub scheduling has been separately approved and implemented. Cloudflare Cron remains
intentionally absent and is still not the forward path.

<!-- DATA-S2B-FIRST-RUN-RECONCILIATION-2026-09-03 -->
### Current DATA-S2B checkpoint — first-run reconciliation, resume hardening, identifier logging

**Migration 0003 is applied** (run `33756058903`) and **live EXPLAIN acceptance passed**: run
`33783839210`, dispatched against approved SHA `faffe2d1e72dd991743b65d35c6c2b77574a4924`,
succeeded, so all four production query plans reached `PLAN_ACCEPTED` under live D1 validation.
That runner requires `rows_written === 0`, so the acceptance performed no D1 mutation. Its exact
provider `rows_read` is not recoverable through the GitHub connector available here and is stated
nowhere. **The first production collection run remains unresolved and unresumed**; no later
collection has run, GitHub scheduling stays disabled and live Cloudflare Cron stays intentionally
absent.

This repository-only checkpoint prepares exactly one safe future resume attempt and nothing else.
A fixed, fail-closed, strictly read-only reconciliation proves whether the failed run left only
its untouched `started` ledger row: one D1 API call, three fixed statements (governance, the
pinned run row, one run-scoped integrity row), no SQL/table/identity/timestamp input,
index-supported observation/head/rejection paths with the few small `ingestion_runs` counters
bounded by the ceiling instead, `rows_written` exactly zero, a 1,000-row read guard, no retry and no
mutation or repair surface reachable. Outcomes are only `RESUME_RECONCILIATION_SAFE`,
`RESUME_RECONCILIATION_BLOCKED` or `AMBIGUOUS_REQUIRES_OWNER_ATTENTION`; SAFE is a precondition,
never an authorisation. The same reconciliation is embedded in the resume runtime before any
fetch or mutation, so a resume cannot proceed from an unproven state. `data-s2-production-resume.yml`
is now hardened to the migration-0003 / EXPLAIN standard — one immutable `approved_sha`, a
credential-free exact-SHA/clean-tree/remote-main/exact-head-Verify gate, a second independent
remote-main check under credentials before any Cloudflare request, shared production concurrency,
Wrangler removed, re-runs refused — and a matching read-only reconciliation workflow exists. The
resume continues the original logical run, caps itself at five D1 calls and exactly one mutation
request, and keeps every existing unknown-outcome, append-only postflight and no-repair rule.

**Production identifier logging is remediated.** The successful EXPLAIN job log printed the
production account fingerprint and D1 database id before runtime masking, because GitHub echoes
each step's resolved environment and only `secrets.*` values are auto-masked; the token stayed
masked. Severity is low and these are identifiers, not credentials — the D1 id is already a public
repository constant and the fingerprint is a hash — but repository policy keeps them out of
diagnostics, so the D1 variable is removed from every credentialled workflow in favour of the
reviewed repository constant, and the fingerprint is declared only on the final production step
after a first mask-registration step. No credential is rotated, no secret renamed, no variable
reclassified as a secret.

Resume envelope from repository truth at `H = N = 9,860`, `D = 0`: 88,804 structural reads plus
the 1,000-row reconciliation guard, so **≤ 89,804 expected**, inside the unchanged 100,000 expected
target and 125,000 hard ceiling; writes stay capped at 40,000. Minimum daily headroom a future
approval should assume is **126,000 `rows_read`**. **No mechanism exists to read remaining daily D1
quota and none was added; real-time remaining allowance cannot be proven from this repository.**

**Nothing was executed.** No Cloudflare request, workflow dispatch, D1 read or mutation, production
reconciliation, resume, collection, migration, deployment, schedule, Cron or credential change was
performed. Next gates: merge and exact-main Verify, then separate owner approval for one read-only
production reconciliation, then — only if SAFE — a further separate approval for one resume.
Normal collection and scheduling remain excluded. See
[first-run reconciliation and resume](workers/data-platform/DATA-S2B-FIRST-RUN-RECONCILIATION-AND-RESUME.md).

<!-- DATA-S2B-LIVE-EXPLAIN-ACCEPTANCE-2026-09-03 -->
### Current DATA-S2B checkpoint — live production EXPLAIN acceptance mechanism

**Migration 0003 is applied.** Manual run `33756058903`, dispatched from exact `main`
`f5aedff686f3b032fee6f7e43c6fcf3104126a97` after exact-main Verify `33729943154`, succeeded in both
jobs. That runner exits zero only through `DEFINITELY_APPLIED_SUCCESSFULLY` or
`DEFINITELY_ALREADY_APPLIED`, and both require its reconciliation to prove the exact version-3
ledger row and all three reviewed indexes with byte-exact definitions, so migration presence is
structurally proven. The exact success shape and the migration request's own `rows_read` /
`rows_written` are not recoverable from the GitHub API and are stated nowhere.

A repository-owned, fail-closed, strictly read-only mechanism now exists to prove the production
query plans live. One trusted plan wraps the **exact existing** production SQL constants in
`EXPLAIN QUERY PLAN`: current heads, observation population, head population and consolidated
postflight. Each index requirement is bound to the operation and the table or alias it must apply
to, so the same index name against an unrelated operation cannot satisfy it; only semantic `detail`
content is validated, never SQLite node ids, ordering or formatting.
`shadow_observations_ingestion_run` is deliberately **not** required, because every production
predicate leads on `source_revision_id`. `GOVERNANCE_SQL` and `RUN_SQL` stay informative and
non-binding. At most one D1 API call, `rows_written` must be exactly zero, and the 1,000-row read
guard is an operational bound rather than a billing prediction; the routine collection ceilings and
the migration-0003 envelope are unchanged and not reinterpreted. Outcomes are only
`PLAN_ACCEPTED`, `PLAN_REJECTED` or `AMBIGUOUS_REQUIRES_OWNER_ATTENTION`, no retry exists inside an
execution, and a failed plan is never repaired by creating or rebuilding an index.

**Live EXPLAIN has since passed** as run `33783839210` on
`faffe2d1e72dd991743b65d35c6c2b77574a4924`; the "not been run" wording below is superseded by the
checkpoint above. Preparing that mechanism itself performed no Cloudflare request, workflow
dispatch, D1 read or mutation, collection, resume, migration, deployment, schedule, Cron or
credential change. Production collection still has one run, `33662554360` (failed); the resume
workflow has never run. GitHub scheduling stays disabled and live Cloudflare
Cron stays intentionally absent — `workers/data-platform/wrangler.jsonc` still declares
`"crons": ["*/30 * * * *"]`, which is historical repository configuration and must not be used to
restore live Cron. Local SQLite plan proofs are repository evidence only and are not a D1
acceptance claim. Live acceptance is a separate owner approval gate, and a successful EXPLAIN
still does **not** approve the first-run resume:
`.github/workflows/data-s2-production-resume.yml` was unapproved and un-hardened at that
checkpoint; it is hardened by the checkpoint above and still requires its own separate approval. See
[live EXPLAIN acceptance](workers/data-platform/DATA-S2B-LIVE-EXPLAIN-ACCEPTANCE.md).

<!-- DATA-S2B-MIGRATION-0003-RUNNER-2026-09-03 -->
### Current DATA-S2B checkpoint — migration 0003 protected production runner

A dedicated, fail-closed, repository-owned runner now exists for
`workers/data-platform/migrations/0003_production_query_plan_indexes.sql` and nothing else. It is
not a generic migration executor: the historical migration-0002 executable is left unchanged, and
the new mechanism accepts no SQL, no migration path, no version and no object name. Its only
workflow input is one immutable lowercase 40-character approved SHA; the repository/CI gate —
exact approved SHA, exact remote `main`, clean tree and a completed, successful, exact-head
GitHub Actions Verify Teamsheet — completes in a job with no environment and no Cloudflare
credentials before the credentialled job can start. Because environment admission can wait while
`main` advances, the credentialled job resolves remote `main` again, from the remote and not from
any value carried between jobs, immediately before the production entry point and before any
Cloudflare request. It requests the existing `data-s2-production-collection` GitHub Environment
and its existing credentials; none were created, rotated or widened, and whether that environment
enforces required reviewers is owner-side configuration this repository cannot prove.

The executable mutation surface is exactly one request carrying the four byte-exact reviewed
statements, read from the pinned migration file and proved by size, SHA-256 and statement
equality. A bounded read-only reconciliation resolves exactly one of three states: the exact
expected pre-state, which alone permits mutation; the exact already-applied state, which issues no
SQL and completes on bounded readback; or inconsistent, which fails closed. Any outcome that
cannot prove completion is UNKNOWN and triggers one read-only reconciliation, never a retry and
never a second mutation, classifying only `DEFINITELY_APPLIED_SUCCESSFULLY`,
`DEFINITELY_ALREADY_APPLIED`, `DEFINITELY_NOT_APPLIED` or
`AMBIGUOUS_REQUIRES_OWNER_ATTENTION`. Once the single request has been issued the resulting state
is always established by exactly one fixed read-only reconciliation, so a resource overrun can
never skip postflight and postflight can never convert an overrun into acceptance. Postflight
proves the exact ledger row and index definitions and that every protected application-data fact
is unchanged; the unresolved first production `started` run is only counted, never updated or
deleted. The runner carries its own
narrow bound — at most three D1 API calls, 150,000 rows read and 40,000 rows written, gated
before mutation from the live population — and does not reinterpret the routine collection
ceilings, which stand unchanged.

**Migration 0003 is NOT applied.** No Cloudflare request, workflow dispatch, D1 read or mutation,
live `EXPLAIN QUERY PLAN`, production resume, collection, deployment, schedule or credential
change was performed. GitHub scheduling remains disabled and Cloudflare Cron remains
intentionally absent. After merge and exact-main Verify Teamsheet, the next gate is explicit
owner approval for one migration-0003 production application; live `EXPLAIN` acceptance, the
first-run resume and normal collection each remain separate later gates. See
[migration 0003 production runner](workers/data-platform/DATA-S2B-MIGRATION-0003-PRODUCTION-RUNNER.md).

<!-- DATA-S2B-OPTION3-GITHUB-D1-REST-2026-09-02 -->
### Current DATA-S2B checkpoint — continuation blocked pending query-safety approval

Owner approval rebases the normalized synchronous full-integrity design: 100,000 `rows_read`
is the expected routine target, 125,000 is the hard read ceiling, 40,000 remains the hard write
ceiling, and the index-aware routine delta maximum is 4,000. The conservative schema-0003 read
model is superseded by a whole-cycle model over append-only history: `5H + 4N + 4D + 64`, whose
cycle term `4H + 3N + 4D + 64` collapses to the established `7N + 64` (69,084 structural visits) at
`H = N` and `D = 0`. `H` comes from a fixed repository-owned governed observation count, never from
ingestion-ledger totals, which cannot be proved free of undercount; the probe shares the current-head
request, so the eight-call ceiling is unchanged, and its own cost is inside the model. All of this is
explicitly local plan evidence, not an exact D1 bill. A pre-commit write estimator rejects
over-budget work before mutation, the whole-cycle read gate rejects structurally infeasible cycles
before start and commit, and returned D1 metadata remains independently enforced. Because a
repository estimate is not provider billing, every failure now carries an explicit `none` /
`unknown` / `definite_completed` mutation classification, so a completed run whose postflight or
resource check then failed is never reported as a no-write and is never blindly retried. The consolidated global append-only postflight remains
synchronous. A fixed repository-owned current-head `EXPLAIN QUERY PLAN` acceptance plan is
prepared but must not run before separately approved migration-3/live acceptance. No baseline
allowance, audit split, production operation, migration, or dispatch is authorized here.

PR #210 merged as `287c89be40a5908cbb29422747500f5106f40fb1`; exact-main Verify
`33665119244` passed. Owner evidence confirms the Cloudflare account exceeded the Workers Free
D1 daily limit of 5,000,000 `rows_read`, blocking read-bearing requests until
`2026-09-03T00:00:00Z`. This account-level notice does not prove failed run `33662554360` alone
consumed all five million reads. Local query-plan investigation found the production current-head
join repeatedly scanned `observation_heads`; additive migration 0003 and an exact migration gate
replace it with an indexed observation-ID lookup. The resume also preserves the original run ID
and `started_at` while recording a genuine later fetch/completion time, and its postflight now
validates append-only history rather than requiring observations to equal heads. The allowance
reset alone does not authorize migration or dispatch. Production remains blocked pending migration-3 approval/application, fixed live-plan acceptance,
exact-head Verify, and explicit owner approval. No live D1 action
or collection is part of this correction. See [Option 3 collection](workers/data-platform/DATA-S2B-GITHUB-ACTIONS-D1-REST-COLLECTION.md).

<!-- DATA-S2B-OPTION3-GITHUB-D1-REST-2026-09-02 -->
### Current DATA-S2B checkpoint — first production attempt requires reconciliation

Exact-main manual production run `33662554360` (attempt 1) required environment approval and
stopped after a definite start-ledger mutation, fixed Official FPL fetch, and before any
observation/head/completion mutation. The sanitized failure was
`d1_result_contract_invalid` while decoding current-head-read provider accounting. The candidate
adds only fixed field/type-or-range diagnostics and records the unresolved `started` row; it
does not relax a ceiling or authorize a retry. A merge, exact-main Verify, explicit approval for
another production dispatch, and reconcile-before-stop review are required. See
[Option 3 collection](workers/data-platform/DATA-S2B-GITHUB-ACTIONS-D1-REST-COLLECTION.md).

<!-- DATA-S2B-OPTION3-GITHUB-D1-REST-2026-09-02 -->
### Current DATA-S2B checkpoint — Option 3 repository implementation

The forward collection contract is protected GitHub Actions, fixed Official FPL
fetch/validation/diff/hash on the runner, and bounded direct Cloudflare D1 REST writes. PR #209
is deliberately **manual-only**: no schedule trigger exists until a separate post-acceptance
activation PR. It invokes no production Worker, so collection Worker CPU is not applicable.
Production Cron remains intentionally absent and must not be restored. Repository implementation
is awaiting owner review, merge, protected-environment configuration and a separately approved
first manual production execution. See [Option 3 collection](workers/data-platform/DATA-S2B-GITHUB-ACTIONS-D1-REST-COLLECTION.md).

<!-- DATA-S2B-INTENTIONAL-CRON-STOP-2026-09-02 -->
### Current DATA-S2B checkpoint — collection intentionally stopped on Worker CPU; execution architecture unresolved

The consolidated read ran. Protected diagnostics run `33644480107`, dispatched from exact `main` `c5db7629d0f7bb7e5d88b8e4b5a4d5fba495370e` after exact-head Verify `33643906698`, completed with no fatal stop; all twenty-two reads passed, including Worker health. One dispatch produced the whole remaining read-only bundle, so the one-failure-per-merge loop is closed.

**Production Cron is absent because collection was intentionally stopped, not because of drift.** Owner-provided historical fact, absent from this repository: the production scheduled collector was observed using approximately **630 ms of Worker CPU** — roughly sixty-three times the 10 ms Workers Free Cron Trigger ceiling — and the trigger was deliberately removed so it would not fire again at 01:00 UTC and risk breaching Free-tier constraints. The disposable E2 programme and the GitHub Actions machinery exist specifically to progress the data path without re-running that collector. The repository had pre-registered exactly this procedure: DATA-S2A §"Important Free-plan CPU limitation" ("if the exact Free-plan Cron exceeds the CPU ceiling, activation stops … redesign/split the collector or separately approve a paid Workers decision"), the DATA-S2B plan's "After Cron activation" stop sequence (remove Cron first, preserve D1 evidence), and Phase 4A step 11 ("Cron removal is the first stop action"). The plan already defines **NO-GO — FREE LIMITS** as a legitimate outcome. **Do not restore the Cron.** An earlier reading of this bundle called the absence an unexplained defect and proposed restoring it; that reading is withdrawn.

The proven state is otherwise strong. One genuine populated Official FPL baseline: 9,860 observations reconciling exactly against 9,860 heads and 9,860 distinct logical keys, zero orphans, zero quarantine, zero rejections; redirect remediation proven live; both failed runs wrote nothing; provider/rights/security boundaries all pass; active Version, deployment, database identity, season binding and rollback targets all correct, with no stale repository constant found. `unchanged_cycle_proof` and `changed_fact_proof` stay PENDING and **the old requirement for another natural production Cron cycle is itself superseded** pending the execution decision. The earlier claim that the baseline completing proved Free-plan CPU fitness is **withdrawn**: Cloudflare isolates tolerate infrequent overruns and terminate only on consistent ones, so completion at ~630 ms proves tolerance, not fitness.

The unresolved question is how collection should execute safely. `workers/data-platform/official-fpl-d1-rest-plan.mjs` and `d1-rest-client.mjs` already express the whole Official FPL collection path as bounded D1 REST plans, E2-validated live at 9,860 writes, and are imported by no Worker. A D1 REST call invokes no Worker, so it consumes no Workers CPU; D1 row/storage limits and the 1,200-per-5-minute Cloudflare API limit still apply regardless of caller. A GitHub Actions execution proposal is recorded in [read-only production diagnostics](workers/data-platform/DATA-S2B-PHASE-4B-READ-ONLY-DIAGNOSTICS.md) and awaits explicit owner approval; nothing is implemented.

<!-- DATA-S2B-READONLY-PRODUCTION-DIAGNOSTICS-2026-09-02 -->
### Current DATA-S2B checkpoint — bounded read-only production diagnostics candidate

The one-failure-per-merge protected-read pattern is replaced. Runs `33620632272` and `33622647158` each spent a whole merge/Verify/dispatch cycle to reveal a single stale repository constant and never reached D1. This candidate adds a separate bounded read-only production diagnostic (`phase4b/diagnostics-contract.mjs`, `phase4b/readonly-diagnostics.mjs` and a manual exact-main/exact-Verify protected workflow) that gathers the whole remaining read-only acceptance evidence in one pass and reports a seventeen-row PASS/FAIL/PARTIAL/PENDING/SUPERSEDED matrix instead of throwing at the first safe mismatch. Identity is taken from the genuinely active Worker Version, never from a repository pin, so a stale pin is recorded as `SUPERSEDED` rather than aborting.

It stays fail-closed on repository/account/Worker/database identity, unauthorized endpoints, non-allowlisted SQL, malformed or unbounded responses, secret exposure risk and any condition needing mutation. It has no reachable upload, deployment, Cron, D1 write, collector, cleanup or retry surface, and the strict `phase4b/preflight.mjs` gate is retained unchanged. Worker CPU time and D1 rows read/written are reported NOT AVAILABLE through the approved read surface rather than widening permissions; current Workers/D1 Free limits were re-verified on 2 September 2026, including Cloudflare's new enforcement of D1 free-tier daily row limits from 1 September 2026. This is repository evidence only: no Cloudflare request, workflow dispatch, deployment or credential change was performed. A completed bundle proves the read finished, not DATA-S2B acceptance. See [read-only production diagnostics](workers/data-platform/DATA-S2B-PHASE-4B-READ-ONLY-DIAGNOSTICS.md).

<!-- DATA-S2B-PRODUCTION-CRON-DIAGNOSTIC-2026-09-02 -->
### Current DATA-S2B checkpoint — post-merge Cron drift diagnostic

PR #203 merged as `17d41df8e90ab9b4bd99ddf055cb90d1f37cc086`; Verify `33621816997` passed. Corrected protected read `33622647158` proved the promoted Worker identity and failed closed at `phase4b_cron_drift` before D1 reads. The candidate adds only a bounded sanitized schedule diagnostic and continues to reject drift. Merge and another exact-main protected read require owner approval.

<!-- DATA-S2B-PRODUCTION-ACCEPTANCE-RECONCILIATION-2026-09-02 -->
### Current DATA-S2B checkpoint — production acceptance read-contract correction

Read-only run `33620632272` passed exact-main/Verify gating and failed before D1 reads because the preflight still pinned the predecessor Version after successful deployment `33433195713` promoted Version `222e62d5-9979-468d-9c54-b97f903d58f6`. The candidate pins the deployed/rollback Versions and admits only internally reconciled populated completed history. It performs no live mutation and does not claim baseline, unchanged, changed-fact, D1 accounting or CPU acceptance. A merge, exact-head Verify and corrected protected read are required. See [production acceptance reconciliation](workers/data-platform/DATA-S2B-PRODUCTION-ACCEPTANCE-RECONCILIATION.md).

<!-- DATA-S2B-E2-D1-QUERY-ARRAY-2026-09-02 -->
### Current DATA-S2B checkpoint — E2 disposable D1 query-array compatibility candidate

Live isolation proved `pragma_table_xinfo` unsupported (`33604986736`), `PRAGMA table_info` supported but top-level arrays unsupported (`33606192013`), and corrected `{batch:[...]}` groups fully compatible (`33606874736`). Bounded object probe `33607321730` proved the untouched D1 contains exactly Cloudflare's `_cf_KV`, now narrowly allowlisted. After manual reset, contract run `33616862569` passed INITIAL through A03, storage affinity and W00, but W01 returned an ambiguous transport outcome. Read-only reconciliation `33617288427` proved W01 wrote nothing, and EXPLAIN isolation `33617620578` proved only the five head-upsert statements fail syntax parsing. The correction adds SQLite's required `WHERE true` disambiguator before `ON CONFLICT`. Corrected W01 returned success and read-only reconciliation `33618133440` proved the exact completed state: 1,064 entities, 9,862 observations (9,860 analogue plus two prior affinity rows), 9,860 heads, zero orphans and a completed 9,860-record run. The reconciliation contract now includes those two intentional pre-existing observations. See [E2C-B preparation](workers/data-platform/DATA-S2B-E2C-B-DISPOSABLE-LIVE-EXPERIMENT-PREPARATION.md).

### DI-4 physical acceptance remediation — review candidate


Physical iPhone Safari acceptance also failed on `6b568985b637e7e3b31ea57bdf883b2a918c786b` after the lexical fix: unavailable and Team-only partial states passed, but returning from visibly completed Transfers retained the old partial DOM. Diagnosis proved app-shell route activation unhides Team without rerunning its renderer. The narrow remediation publishes parity-runtime changes to the weekly card while Team is visible and refreshes from `latest()` on the existing Team route event; it adds metadata-only developer diagnostics and public-squad/fresh/cache route regressions. No navigation, artifact, recommendation, model, provider or persistence semantics change; physical retest remains pending.

### Current Decision Intelligence checkpoint — DI-4 review candidate

DI-4 renders the frozen, ephemeral DI-3 parity artifact through a narrow deterministic read model in a mobile-first Team weekly-decision surface. Complete, partial and unavailable states fail closed; artifact actions, consequences and order are copied without recomputation or feedback. No recommendation/model/provider/persistence/security/account behaviour changes. Physical iPhone Safari acceptance remains pending. See [DI-4 Weekly Decision Synthesis](docs/DECISION-INTELLIGENCE-DI4-PRODUCT-INTEGRATION.md).

# CLAUDE.md — onboarding for every future development session

<!-- DATA-S2B-E2C-B-INITIAL-SCHEMA-COMPATIBILITY-2026-09-02 -->
### Current DATA-S2B checkpoint — E2C-B initial schema compatibility candidate

E2C-B live attempt 2 stopped before mutation when its 21-statement INITIAL schema inspection received HTTP 400. The narrow repository candidate replaces bound table-name arguments in the 15 table/index/foreign-key PRAGMA table-valued calls with deterministically quoted literals generated only from the fixed five-table repository allowlist. The REST batch shape, 21-result contract, semantic schema acceptance, ordering, mutations, retries and cleanup remain unchanged. No Cloudflare request, workflow dispatch, D1 operation, deployment or credential/environment change was performed while preparing this correction. See [E2C-B preparation](workers/data-platform/DATA-S2B-E2C-B-DISPOSABLE-LIVE-EXPERIMENT-PREPARATION.md).

<!-- DATA-S2B-PHASE4B-POST-ACTIVATION-MACHINERY-2026-08-31 -->
### Current DATA-S2B checkpoint — post-activation deployment machinery remediation candidate

The repository-only Phase 4B machinery and diagnostics are merged. Protected diagnostic preflight run `33428846434` proved that row index `0` differs only in `error_class`, with exact live value `Invalid_redirect_value__must_be_one_of__follow__or__manual____er`; later rows remain unproven. The narrow correction candidate replaces the disproven shorter exact constant without widening acceptance and preserves bounded fail-closed diagnostics. It authorises no live preflight, upload, Deployment, Cron/D1 mutation or collector invocation. After merge, another exact-main protected preflight needs separate owner approval; upload/deployment remains a later owner decision and scheduled baseline acceptance remains outstanding. See [post-activation machinery remediation](workers/data-platform/DATA-S2B-PHASE-4B-POST-ACTIVATION-DEPLOYMENT-MACHINERY.md).


<!-- DATA-S2B-PHASE4B-REDIRECT-REMEDIATION-2026-08-30 -->
### Current DATA-S2B checkpoint — daily collector redirect remediation review candidate

The first unconditional daily production collection on 30 August 2026 selected the intended daily path and created one fail-closed ingestion run, but Cloudflare Workers rejected the collector's explicit `redirect: "error"` request option before either Official FPL response could be consumed. The narrow repository candidate uses Workers-supported `manual` mode and explicitly rejects every 3xx response, retaining the no-redirect host boundary. End-to-end regression coverage also exposed and fixes the baseline-only null comparison that would otherwise have failed after successful 200 responses. Cadence, Cron, daily hour, deadline gate, endpoints, schema, normalisation, D1 commit design, providers and application/model behaviour are unchanged. See [Phase 4B redirect remediation](workers/data-platform/DATA-S2B-PHASE-4B-OFFICIAL-FPL-REDIRECT-REMEDIATION.md).

This is repository evidence only. DATA-S2B remains live-unaccepted until an owner-approved merge/deployment is followed by another genuine scheduled daily event proving a completed populated baseline and consistent D1 state; do not manually invoke collection as a substitute.

<!-- DECISION-INTELLIGENCE-DI3-2026-08-29 -->
### Current Decision Intelligence checkpoint — DI-3 Stage B Option A review candidate

DI-3 Stage A established the canonical contracts. Pritesh subsequently approved Stage B Option A: a one-way, ephemeral parity-artifact runtime consumes already-formed Team and Transfers outputs after selection, copies their semantics without reranking or recomputation, and catches every DI failure without affecting the existing recommendation. It renders no UI, persists nothing, activates no signal and creates no DI-to-production dependency. See [DI-3 Validated Production Decision Layer](docs/DECISION-INTELLIGENCE-DI3-DECISION-LAYER.md).

<!-- DECISION-INTELLIGENCE-DI2-2026-08-29 -->
### Current Decision Intelligence checkpoint — DI-2 review candidate

DI-2 adds a zero-dependency, offline shadow evaluation runner under `src/decision-intelligence/`: immutable/hash-addressed manifests, deadline-frozen feature views, explicit factorial arms, versioned Brier/MAE/RMSE/calibration adapters, deterministic JSON/Markdown evidence and a permanent synthetic reference experiment. It creates no production approval or feedback path and is absent from the deployable build graph. No provider, DATA-S2B/D1/Cloudflare, Stage 10, application, model, recommendation or UI behaviour changes. The generated experiment is synthetic infrastructure evidence only. See [DI-2 Automated Evaluation & Ablation](docs/DECISION-INTELLIGENCE-DI2-EVALUATION.md).

<!-- DECISION-INTELLIGENCE-DI1-2026-08-29 -->
### Current Decision Intelligence checkpoint — DI-1 review candidate

DI-1 implements a repository-only, provider-neutral shadow intelligence contract under `src/decision-intelligence/`. It supplies deterministic canonical observations, Official-FPL identity and bitemporal validation, fail-closed rights classification, a versioned signal registry, an exact production-approval ledger contract and an in-memory shadow repository with no production-read capability. No signal or approval is registered, no provider or collector is activated, and production modules/build inputs do not import DI code. DATA-S2B, D1, Cloudflare, Stage 10, Provider Health, application UI and every recommendation calculation remain unchanged. See [Decision Intelligence Foundation](docs/DECISION-INTELLIGENCE-FOUNDATION.md). DI-2 evaluation work and every production promotion remain separate owner-approved checkpoints.

<!-- DATA-S2B-PHASE3-LIVE-CLOSEOUT-2026-08-28 -->
### Current repository checkpoint — DATA-S2B Phase 3 live deployment PASS

**This section supersedes the Phase 3 repository-gate and Phase 2 present-tense checkpoints below; their design and evidence remain authoritative history.** Manual protected workflow run `33142804502` (#4) passed on exact `main` SHA `d48913332bf5df37b29d98b06579f369f338f6e4`. Existing candidate Worker Version `3a2b065a-6527-4887-9bf8-b08e82e81133` is the sole active Version at 100%; previous production Version `5edbe951-4be4-46bc-b2cf-17b550396105` remains the rollback target, and rollback was not required. Exactly one candidate Deployment mutation was submitted. Postflight passed, Version History remained unchanged, and the workflow performed no Version upload or Cron/D1/route/domain/Access/secret mutation. See [Phase 3 live closeout](workers/data-platform/DATA-S2B-PHASE-3-LIVE-CLOSEOUT.md) and the retained [Phase 3 deployment gating contract](workers/data-platform/DATA-S2B-PHASE-3-DEPLOYMENT-GATING.md).

Before the successful run, the owner manually replaced an unrecognized Access service-token credential pair, narrowed the existing Service Auth policy to the replacement token, and identified the working retained Worker bearer through sanitized HTTP/JSON health checks. Those prior manual authentication changes are separate from the successful workflow's mutation accounting; no credential values are recorded, and obsolete-credential cleanup is not claimed. Phase 4 Cron activation and collection remain separately unapproved. Do not enable Cron, run the collector, write D1, change Access or secrets, add providers, or change application/model/calculation behaviour under this checkpoint.


<!-- DATA-S2B-PHASE2-POSTFLIGHT-2026-08-27 -->
### Current repository checkpoint — DATA-S2B Phase 2 live closeout PASS

**This section supersedes the older present-tense DATA-S2A / DATA-S2B Phase 0 and Phase 1 wording below while preserving dated evidence as history.** DATA-S2B Phase 0 live read-only preflight passed in run `32996481967`, and Phase 1 migration 0002 passed in run `33011334466`. Phase 2 attempt #3, run `33050859823`, created inactive Worker Version `3a2b065a-6527-4887-9bf8-b08e82e81133`; its postflight red result was a false failure caused by treating `/settings` as active-version binding authority after a newer inactive Version existed. PR #170 corrected the verification model to use Deployments plus exact Version Detail, merged, and post-merge exact-main Verify Teamsheet run `33074154222` passed on `2176a3dd29562fecff10614b689ed99a06db6bfa`.

The dedicated Phase 2 read-only closeout run `33088512116` is **PASS**. Production remained on active deployment `10f7a065-3d82-4b34-9fb1-dc6c3a0be524` and active version `5edbe951-4be4-46bc-b2cf-17b550396105`; the Phase 2 candidate remained inactive. Exact Version Detail reconciled both binding sets, Cron remained empty, Phase 1 D1 governance/count state remained exact, ingestion/history/observation/head counts remained zero, and D1 size remained exactly `151552` bytes before and after the bounded read. Accidental upload run `33088187544` was cancelled while its mutation-capable job still waited behind protected-environment approval, so it created no Worker Version or other mutation. See [DATA-S2B Phase 2 Live Read-Only Closeout](workers/data-platform/DATA-S2B-PHASE-2-LIVE-CLOSEOUT.md) for the detailed evidence and limitation.

Phase 2 PASS means one exact inactive candidate exists and has been independently reconciled; it does **not** mean production deployment or production acceptance. The next checkpoint after this documentation closeout is Phase 3 investigation/design only. Phase 3 deployment requires a new explicit owner approval, and Phase 4 Cron activation/collection remains separately unapproved. Do not deploy/promote/split/delete the candidate, enable Cron, run the collector, write D1, change Access or secrets, add providers, or change application/model/calculation behaviour under this checkpoint.

<!-- DATA-S2A-CURRENT-2026-08-26 -->
### Current repository checkpoint — DATA-S2A merged; DATA-S2B live acceptance next

**This section supersedes the older present-tense DATA-S1C/DATA-S1B wording below; dated evidence remains historical.** DATA-S1C-R retired private Service Binding/RPC and the unimplemented custom bearer-HTTP alternative from the forward collection architecture after RPC functional acceptance was not achieved. Their repository and deployed assets remain historical/rollback evidence; do not continue transport-first debugging for DATA-S2 collection. The stable forward boundary is the existing isolated `teamsheet-data-platform` Worker and `teamsheet-data` D1, with transport chosen only when a later consumer actually requires it. See [DATA-S1C-R — Data Architecture Reset](docs/DATA-S1C-PRIVATE-SERVICE-BINDING-RPC.md).

DATA-S2A is merged through PR #160 and repository-verified on its exact merge commit. Its **repository-only, shadow-only** Official FPL structured-history implementation collects only fixed `bootstrap-static` and `fixtures` payloads, validates a strict event/team/player/fixture allowlist, compares with D1 heads, and appends only genuine changes so prior facts remain queryable. It does not replace the existing live Official FPL application gateway and changes no Teamsheet runtime, model or recommendation behaviour. DATA-S2A remains **live-unaccepted**: no DATA-S2A Worker deployment, live migration/D1 mutation or Cron activation has occurred.

The next checkpoint is **DATA-S2B**. It begins with a mutation-free Phase 0 live preflight; migration, Worker version upload/deployment and Cron activation remain later, separate explicit owner-approval gates. DATA-S2B must then prove a real baseline, an unchanged cycle with no observation/head changes, changed-fact behaviour, actual D1 accounting, Workers Free CPU suitability, and rollback/stop on any failure. DATA-S2A merge does not approve DATA-S2B mutation, DATA-S3, production use or redistribution.

<!-- DATA-S1C-CURRENT-2026-08-25 -->
### Current repository checkpoint — DATA-S1C private Service Binding + RPC candidate

**This section supersedes the older DATA-S1B preflight current-state wording below.** The production `teamsheet-data-platform` Worker, `teamsheet-data` D1, `TEAMSHEET_DATA_DB` binding and `data.fpltsheet.co.uk` Custom Domain already exist; Access remains the proven live outer protection. DATA-S1C includes a permanent, manual-only GitHub Actions procedure for separately owner-approved private read-RPC acceptance. The latest nested-path run `32906524221` used the corrected, pinned caller version `cf9c150d-84b0-46f9-a166-530b7243e863`: caller and target PRE/POST checks passed, the caller fetch discriminator arrived, but the caller `health` JSRPC still ended in the runtime hang exception and query did not run. Awaited forwarding was therefore not the complete cause; nested RPC versus target RPC versus Wrangler remote-preview behavior remains unproved. The approved Option 2 repository redesign now makes the temporary probe bind directly to `teamsheet-data-platform -> DataPlatformReadEntrypoint`, with no D1/write/ingest capability, to isolate one-hop target RPC and GitHub-hosted remote-binding compatibility. The deployed caller is not retired or changed: its exact version, private single-read-binding topology and PRE/POST stability remain separate evidence, and the workflow summary permanently reports caller forwarding as `NOT PROVEN`. This redesign has not been executed; no successful GitHub Actions RPC acceptance is claimed and any run remains separately owner-approved. See [DATA-S1C private Service Binding and RPC architecture](docs/DATA-S1C-PRIVATE-SERVICE-BINDING-RPC.md).

<!-- DATA-S1B-PREFLIGHT-CURRENT-2026-08-23 -->
### Current checkpoint — DATA-S1B mutation-free preflight PASS

**This section supersedes older current C5, DATA-S1 and DATA-S1A wording below; historical records remain unchanged.** The DATA-S1B mutation-free live preflight is complete and **PASS**, and the final phase-gated deployment procedure is recorded in the [DATA-S1B Final Preflight and Deployment Runbook](docs/DATA-S1B-FINAL-PREFLIGHT-AND-DEPLOYMENT-RUNBOOK.md). DATA-S1 remains **NOT LIVE DEPLOYED**. This checkpoint created no DATA-S1 Worker, production or validation D1, migration, Access configuration, service token, DNS/Custom Domain, route or production binding. Owner evidence records **Workers Free — Active** with current and projected billable usage of **$0.00**; execution must remain within Workers Free and D1 Free limits and stop rather than upgrade the plan.

The reviewed PR #147 repository candidate baseline is **986 tests passed, 0 failed, 0 skipped, 0 cancelled**, plus deterministic build/provenance gates and exact-head Verify Teamsheet. PR #147 merge authorizes **no Cloudflare mutation**. After merge, re-read latest GitHub `main` and require Verify Teamsheet to pass on that exact merge commit. Only then may the owner consider the next separately gated live mutation: **Phase 2 disposable D1 validation** from the approved runbook. DATA-S2 remains blocked until DATA-S1B live deployment and acceptance fully close. The delivered GW1 readiness checkpoint remains PR #121 as historical application evidence. No model, provider, fixture, captaincy, squad, transfer, simulation, rank, Mini-League or application behaviour changed.

<!-- GW1-P2C5-CURRENT-2026-08-22 -->
### Historical checkpoint — 22 August 2026: GW1-P2C5 synthetic production-path acceptance PASS

GW1-P2C5 passed the production infrastructure path with one unmistakably synthetic `2099-00`/GW38 record on a physical iPhone in normal Safari with Prevent Cross-Site Tracking enabled. The normal local storage/event/outbox/scheduled-delivery path reached the unchanged archive Worker; sanitized read-only reconciliation found the exact accepted D1 receipt, exact D1 manifest and exact private R2 metadata, with R2-first/D1-second timestamps and matching identity, size and stored SHA-256. The browser reached terminal **Archived** status. See [GW1-P2C5 closeout](docs/GW1-P2C5-STAGE10-PRODUCTION-PATH-ACCEPTANCE-CLOSEOUT.md).

The temporary candidate was removed from production by restoring GitHub Pages to authoritative `main`; draft PR #143 was closed unmerged and retained as history. The accepted synthetic cloud record remains untouched. This is synthetic infrastructure acceptance only: natural Stage 10 capture, genuine prospective custody, natural GW2 capture and Official eligibility remain separate future observational gates. Historic GW1 recovery remains parked. No Worker, Access, DNS, D1/R2 configuration, model, provider, timing or calculation behaviour changed.

<!-- GW1-P2C3B-CURRENT-2026-08-22 -->
### Historical checkpoint — 22 August 2026: GW1-P2C3B same-site transport closeout

**Supersedes older GW1-P2/GW1-P2C2 current-state wording below where it describes sibling-domain deployment or physical browser transport acceptance as pending.** The live sibling origins are `https://app.fpltsheet.co.uk` and `https://archive.fpltsheet.co.uk`. On a real physical iPhone in normal Safari with **Prevent Cross-Site Tracking ON**, an authenticated, deliberately invalid `{}` request directly demonstrated `Sec-Fetch-Site: same-site`: OPTIONS reached the Worker and returned 204; the matching POST reached it and returned 422; Safari read `{"error":"envelope_schema"}`. **GW1-P2C3B browser transport acceptance therefore passes, for transport only.**

No genuine Stage 10 record was sent. This result proves neither genuine evidence custody nor valid archival, D1 receipt/manifest creation, R2 object creation, persistence, idempotency, duplicate handling, or any recommendation/model behaviour. The literal physical returned values of `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials` and `Vary` were not directly captured. Sanitized evidence is recorded in [GW1-P2C3B Same-site transport closeout](docs/GW1-P2C3B-SAME-SITE-TRANSPORT-CLOSEOUT.md). The legacy GitHub Pages origin allowlist, legacy `workers.dev` archive hostname, its Access protection and existing rollback deployments/versions remain intentionally retained; cleanup is a separate checkpoint. No application, Worker, configuration or live-infrastructure behaviour changes in this closeout.


<!-- GW1-P2C2-CURRENT-2026-08-21 -->
### Historical checkpoint — 21 August 2026: GW1-P2C2 repository preparation

**Supersedes older GW1-P2 text below where it describes the physical cross-site POST as still pending.** The 21 August controlled iPhone Safari diagnostic on the deployed PR #137 CORS remediation reached the evidence Worker with the credentialled OPTIONS request and received HTTP 204, but the subsequent POST never reached the Worker and Teamsheet received no HTTP status. That result proves the earlier missing `Access-Control-Allow-Credentials: true` defect was real and was corrected; it does **not** prove a single browser/Access root cause for the remaining cross-site failure. Option A (`github.io` → `workers.dev`) is therefore exhausted rather than accepted.

The approved next checkpoint is **GW1-P2C2 — sibling same-site custom-domain transport repository preparation**, implemented only on draft PR #139. The intended browser origins are `https://app.fpltsheet.co.uk` and `https://archive.fpltsheet.co.uk`; they are same-site but remain cross-origin, so exact-origin credentialled CORS remains mandatory. PR #139 selectively carries forward PR #119's durable outbox/browser-delivery semantics, preserves PR #137 as the single credentialled-CORS adapter authority, emits the exact archive ingestion endpoint `https://archive.fpltsheet.co.uk/v1/evidence/predeadline`, and temporarily keeps the existing GitHub Pages origin beside the new app origin in the Official FPL gateway allowlist for rollback.

**No live custom-domain architecture is claimed.** DNS, GitHub Pages custom-domain configuration, Cloudflare Worker Custom Domain/Access configuration, deployment and physical iPhone Safari acceptance are separate future approval gates. `main` remains the operating source of truth until an approved merge. No model, provider, fixture, expected-minutes, scoring, squad, captaincy, transfer, optimiser, simulation, rank or Mini-League calculation changed in GW1-P2C2.


## Research programme control centre — mandatory before external-intelligence work

The permanent pre-GW1 and later external-intelligence research programme is indexed at [docs/research/README.md](docs/research/README.md). The original [External Intelligence Foundation](docs/EXTERNAL-INTELLIGENCE-FOUNDATION.md) remains the unmoved historical/root investigation; the research index does not replace or duplicate it.

Before any provider evaluation, external-data proposal, expected-minutes evidence proposal, shadow observation/store proposal, external-repository adoption, model ablation or other external-intelligence implementation proposal, read **both** the Foundation and `docs/research/README.md`, then read the relevant topic branch record. A branch marked `Research complete`, `Awaiting evidence` or `Ready for approval` still does not approve a provider, data source, retention right, model input, weight, formula or runtime path. Time-sensitive access, pricing/free-tier, terms, licensing, retention rights, source maintenance and reliability must be re-verified before implementation. Production behaviour remains governed by the canonical docs and the normal explicit owner approval gates.

## Historical operating state before C5 closeout and DATA-S1

> **Superseded historical record:** The instructions and open gates in this section describe the repository before C5 closed. They are retained as evidence only and are not current operating instructions. The DATA-S1 control section at the top of this file is authoritative.

**This file describes the tree it lives in.** It deliberately does not restate the current `main` commit SHA: GitHub owns that fact, it changes on every merge, and duplicating it here is how this documentation went stale before. Read the live SHA with `git rev-parse origin/main`, and read live pull-request state from GitHub. Everything below is a durable statement about the work itself.

### Historical two-stream framing

Do not collapse these. They have different scopes, different gates and different owners.

**Stream 1 — the Teamsheet application. Ready for GW1.**

The most recent application checkpoint is **GW1 readiness — pre-deadline Transfers safety guard**, delivered on **PR #121**. Before the first Official FPL deadline of a season the Transfers screen suppresses the weekly free-transfer/hit optimiser and states that initial squad changes are unlimited; the rule is derived from verified Official FPL event data and normal weekly behaviour resumes at the deadline instant. No optimiser mathematics changed. **Pritesh physically accepted it on iPhone Safari** on the exact candidate head `f72023043813566fe8b11da2d959e374d34bca39`, which passed Verify Teamsheet #262 / `31583716004` with **898 tests, 898 passed, 0 failed, 0 skipped, 0 cancelled** (the then-current baseline for that application head; the same PR's documentation reconciliation raises the repository baseline to **904** without touching application code), deterministic byte-identical builds, root/deployable equality and verified committed build provenance. GitHub Pages was pointed at the branch for that acceptance and then restored to `main`, each observed built (Pages #126 branch, **#127 `main`**). See [GW1 readiness safety guard](docs/GW1-READINESS-SAFETY-GUARD.md).

**Historical GW1-P2C2 candidate baseline: 971 tests for that earlier tree.** The 898 above is the then-current count on the physically accepted application head; the documentation-integrity regressions added by the same PR's reconciliation raised it to 904, and the pre-GW1 housekeeping closeout reached 907 by adding one documentation-integrity regression and splitting the hardened `selectMiniLeague` coverage into behavioural and mutation-sensitivity contracts. 907 remains the then-current merged `main` baseline until an approved merge. The GW1-P2C2 candidate then added the reconciled PR #119 browser-delivery behavioural suite and the same-site migration coverage, reaching 971. No application code changed across any of those steps. Earlier counts (940, 918, 907, 904, 898, 883, 868, 864, …) are historical checkpoint evidence, not current claims.

The GW1 readiness audit that preceded PR #121 found **zero blockers** and two should-fix items; PR #121 addressed both. The application is suitable for GW1 subject only to the separate live-only gates named below. No model, provider, fixture, expected-minutes, scoring, squad, captaincy, transfer, optimiser, simulation, rank or Mini-League behaviour was authorised or changed by readiness work.

**Stream 2 — automatic cloud evidence custody. Still unaccepted, and not a GW1 blocker.**

**GW1-P2 — Browser evidence delivery and durable outbox** is an implemented candidate on **draft, unmerged PR #119**, branch `claude/gw1-p2-evidence-delivery-design-ejsb0d`, head `252c5eba0381c8aa5afb7bda1686dd102326c6df`. It connects the existing Stage 10 browser capture path to the GW1-P1 archive through a durable local outbox, a transport-independent delivery state machine, content-hash idempotency and fail-closed provider retention. Cloud custody remains a one-way side effect: the FPL recommendation never reads, waits for, or fails because of the archive, so **GW1-P2 is not a recommendation dependency and does not gate GW1**.

Until PR #119 is accepted and merged, **local Stage 10 capture, recovery and owner-controlled export remain the operating fallback** for pre-deadline evidence. That fallback is complete and merged; nothing about GW1 operation waits on PR #119.

### Planning record — External Intelligence Foundation, documentation only

[External Intelligence Foundation](docs/EXTERNAL-INTELLIGENCE-FOUNDATION.md) is the canonical research and shadow-architecture record for future external football information. It is **documentation only and approves nothing**: no provider, endpoint, API key, acquisition cadence, retention right, model, weighting, expected-minutes, fixture, squad, captaincy, transfer, simulation, rank or Mini-League change is authorised by it, and it does not alter the pre-GW1 freeze.

Read it before any future provider, external-data, expected-minutes-evidence or ablation proposal. It fixes three things that later work must not quietly undo: external observations must normalise into a **provider-neutral contract** with separate `observedAt` / `effectiveAt` / `fetchedAt` timing, canonical Official FPL identity and an explicit rights/retention classification; any first implementation must be **`shadow_only`**, with no path from shadow storage into projected points, the optimiser, captaincy, transfers or Mini-Leagues without separate explicit approval; and the layers — structural strength, recent performance, market expectation, availability/expected minutes, calendar/workload, set-piece and role, matchup microstats, transfer economics, competitive strategy — must stay separate rather than collapsing into one confidence score. Its free-source research is dated 12 August 2026 and must be re-verified from first-party sources before any implementation approval.

Its one operationally relevant conclusion for now: current Stage 10 **already** preserves the normalised Odds inputs that affected a prediction when Odds is healthy, so the primary market-layer on/off ablation needs no new pre-GW1 code — only a genuine, healthy, exported capture. Raw bookmaker prices and intraday line movement are not preserved and are not reconstructible on the free tier, and that lost optionality does **not** justify breaking the freeze.

### Historical immediate operating state

Pre-GW1 code freeze and operational rehearsal. The next work is **not** post-GW1 model or provider enhancement. In order:

1. Hold the freeze; make only separately approved fixes.
2. Operate GW1 and collect prospective evidence.
3. Perform the GW1-P2 live acceptance when the genuine Stage 10 window opens, **20 August 2026 at 18:30 BST**.
4. Review evidence at the **GW5 → GW6** international break.

### Historical GW1-P2 gate detail

Separate what is done from what is unproven. Do not collapse these three into one status:

1. **Completed owner preparation — recorded, do not repeat or re-request.** Cloudflare Access `Bypass OPTIONS requests to origin` was enabled and saved for `teamsheet-evidence-archive`. No Access-layer allowed-origin response was configured, so the Worker remains the sole owner of exact allowed-origin CORS enforcement and no Access policy for `POST`, `GET` or any other method changed. Top-level physical iPhone Safari Cloudflare Access authentication succeeded and protected `GET /v1/health` returned `{"ok":true,"archiveVersion":"1.0.0","schemaVersion":"1.0.0","migrationVersion":1}`. Settings → Evidence showed the expected pre-window state, non-destructive storage telemetry showed approximately 546.2 KB of Teamsheet-owned data, and GitHub Pages was switched to the PR #119 branch and restored to `main`, each observed built. `TEAM_DOMAIN`, `POLICY_AUD`, Access JWTs and cookies must still never be printed, pasted or logged.
2. **The decisive application POST is still unproven — this is the open acceptance gate.** None of the above proves the credentialled cross-site background upload from `priteshpatel390-del.github.io` to `teamsheet-evidence-archive.fpltsheet.workers.dev`. The direct credentialled cross-origin transport is approved as a *feasibility implementation only*, not as the accepted permanent iPhone transport. Acceptance requires the owner's physical iPhone Safari test with **Prevent Cross-Site Tracking ON**, against a genuine Stage 10 record, from the configured window opening **20 August 2026 at 18:30 BST**. Disabling that setting is a diagnostic comparison and must never become a product requirement. If the transport fails under normal privacy settings, stop and return with a revised Option B versus Option C comparison; do not implement either without separate approval, and do not remove the transport-independent outbox/delivery work.
3. **Durable-retention cap — an unresolved limitation, not a gate to close by testing harder.** `OUTBOX_RULES.pinLimit` is held at **4** as a deliberately conservative bounded-outbox policy for the first acceptance cycle. The measured record and supporting-store sizes are valid evidence; the usable storage ceiling on the owner's iPhone is **not** evidenced, so four is not claimed to be proven safe and browser-reported available-space estimates are not a quota guarantee. Do not raise it to 5 or 6 in this checkpoint, and do not introduce IndexedDB or any other persistence technology without a separate proposal. Non-destructive device evidence is read from the Settings → Evidence panel; never run a destructive fill-until-quota test against real evidence. See [GW1-P2 Browser evidence delivery](docs/GW1-P2-BROWSER-EVIDENCE-DELIVERY.md).

The first relevant 2026/27 international break is **GW5 → GW6**, not GW2 → GW3. GW1–GW5 is the initial stability/prospective-evidence period and the GW5 → GW6 break is the first major evidence-led review opportunity. This planning correction does not pull any model or provider change forward.

GW1-P1 implemented only the backend half of the approved D1 evidence architecture: a separate Cloudflare Access-authenticated evidence Worker, private content-addressed R2 evidence, minimal D1 manifest/receipt/index state, independent canonical Stage 10 validation, idempotency and orphan reconciliation. The deterministic Teamsheet recommendation path remains independent. The browser was **not connected** to this service in GW1-P1; that connection is the GW1-P2 work described above.

The repository GW1-P1 record documents Pritesh's physical iPhone Safari functional production acceptance of the Access/D1/R2/ingest/idempotency/forced-failure/reconciliation paths using deliberately synthetic evidence. Do not generalise that acceptance beyond the recorded paths or claim new device testing without owner evidence.

The final preview/version-route audit found one security hardening gap: with `workers_dev` enabled, the evidence Wrangler configs relied on Cloudflare's implicit Preview URL behaviour. The GW1-P1 candidate now explicitly sets `preview_urls:false` in both byte-identical evidence configs and permanently tests that invariant. Repository configuration is never by itself proof of deployed Cloudflare route state. **Live route-state closure was recorded on 11 August 2026 at 19:22 BST from owner-supplied Cloudflare dashboard evidence**: the Workers & Pages Domains screen showed the production `teamsheet-evidence-archive.fpltsheet.workers.dev` route enabled and **Restricted** behind its Access policy, and the wildcard Preview hostname `*-teamsheet-evidence-archive.fpltsheet.workers.dev` disabled. That is owner-supplied dashboard evidence, not independent assistant dashboard or device testing.

Provider archival rights remain fail-closed: permanent Understat-derived retention is unresolved and Odds-derived permanent retention requires its approved governance position. GW1-P1 must not strip provider material from an already-canonical snapshot to make it archivable because that would change its hash. No provider acquisition, weighting, model, fixture, squad, captaincy, transfer, simulation, rank, Mini-League, UI or client-sync behaviour changes in this checkpoint.

That GW1-P1 closeout sequence is complete and PR #118 is merged. The GW1-P2 closeout sequence is: exact-final-head repository verification after every source/config/documentation change; the owner's Cloudflare Access OPTIONS-bypass configuration and non-destructive device storage evidence — **both recorded as performed**; then the outstanding physical iPhone Safari acceptance test against a genuine Stage 10 record under normal privacy settings. **PR #119 stays draft and unmerged until Pritesh completes that physical acceptance and explicitly approves it.**

## Historical — 11 August 2026 A3 engineering state entering documentation closeout

The A3 engineering baseline entering documentation/architecture closeout was GitHub `main` `1060e60d3affadabdf97924c7ece85cc62d8e360`, the merge of **A3-SC-1 Small Stale-Code Cleanup** PR #116 from reviewed head `097fabb6065afc4c322238985eb7f237a503a7c3`. The reviewed tree contains **868 tests, 868 passed, 0 failed, 0 skipped, 0 cancelled**. Permanent post-merge Verify Teamsheet run #194 / `31470879289` passed the repository gate on that exact merge commit, and GitHub Pages run #120 / `31470878300` succeeded for the same commit.

A3-SC-1 removed only the two proven-unreachable Mini-League helpers `renderLeagueChips()` and `rememberLeague()` plus stale test-side consumers, and added structural regressions. No physical iPhone testing was performed or claimed for PR #116. Its first CI failure demonstrated that future stale-code investigations must search production source, test source, shared harness/export lists, mocks/fixtures, runtime replacement mechanisms, generated bundle/deployable surfaces and DOM/event references. At that checkpoint, the brittle `selectMiniLeague` exact-source-string assertion remained separate deferred test-hardening debt. It was subsequently hardened in the pre-GW1 housekeeping closeout (PR #124) without changing production Mini-League behaviour.

Route-Aware Rendering and Performance M1 is complete and merged through PR #115. M1 delivered measurement instrumentation only. `scripts/measure-route-rendering.mjs` reads the generated bundle and runs an instrumented copy through the existing harness; it is deliberately outside every production build input. **Route-aware optimisation itself remains unapproved** — do not change route scheduling or rendering behaviour without separate explicit approval. See [Route-Aware Rendering and Performance](docs/ROUTE-AWARE-RENDERING-PERFORMANCE.md).

A3 engineering remediation is complete through PR #116. The documentation and architecture reconciliation was the final A3 closeout layer; no A3-specific engineering or documentation task follows it. See [Roadmap](docs/ROADMAP.md) and [Historical Records](docs/HISTORICAL_RECORDS.md).

## Historical checkpoint — 10 August 2026 A3 State-Ownership Cleanup is merged and accepted

A3 State-Ownership Cleanup is complete. PR #112 merged at `main` `691d9f929284d51c233b61d099c34cafe1030db6` from reviewed head `620daf14d1c354668b16df74daf05e29d8a1eb25`.

The checkpoint makes `src/state.mjs` the explicit inventory of legitimate cross-module `S` slots without turning it into the semantic owner of every value. `S.miniLeagues` remains the canonical writable Mini-League preference state and the legacy `S.leagues` alias is now a one-way read-only compatibility bridge. The package is deliberately narrow: no broad state-management rewrite and no model, provider, persistence-format, error-boundary, Atomic Foreground Refresh, routing-performance or bundler behaviour change.

Evidence: the merged tree contains **864 tests, 864 passed, 0 failed, 0 skipped, 0 cancelled**. Permanent Verify Teamsheet run #167 / `31430700053` passed every stage on exact merge commit `691d9f9…`, including committed provenance, the complete suite, production build, deterministic rebuild, root/deployable equality, exact build identity and production-output preservation. GitHub Pages deployment run #117 / `31430697347` also succeeded on that exact merge commit. No physical iPhone testing was performed for PR #112 and none is claimed. See [A3 State-Ownership Cleanup](docs/A3-STATE-OWNERSHIP-CLEANUP.md).

At that checkpoint the next substantive work was **Route-Aware Rendering and Performance**, to begin with investigation, measurement and evidence only. Its M1 measurement stage has since been implemented and merged through PR #115; route-aware optimisation remains unapproved.

## Historical checkpoint — 10 August 2026 A3 error-boundary separation (EB-1)

Package EB-1 is complete. PR #108 merged at `main` `ba5daa2000345ddde3d8e6f6d381d44603e7cd29` from reviewed head `13224f53d7df95a295ee5f69124e99eb64e7a9e9`.

EB-1 fixes failure **ownership** only. A recovery-render failure after a genuine Official FPL collection failure is recorded as a secondary `render_failed` beside the unchanged primary `collection_failed` instead of being swallowed by an empty catch. An unexpected exception escaping Understat, Odds or minute-history computation is application-owned `internal_error`: it still passes through the one shared `applyProviderResult()` gate so Rule B's retain/clear decision is unchanged, but it no longer manufactures Understat/Odds/FPL Provider Health. Startup, manual and foreground refreshes own an otherwise escaping exception at a narrow lifecycle boundary that begins before `captureRefreshInputs()`; no global `window.onerror` or `unhandledrejection` layer was added.

Evidence: the merged tree contains **856 tests, 856 passed, 0 failed, 0 skipped, 0 cancelled**. Permanent Verify Teamsheet run #154 / `31410817472` passed every stage on exact merge commit `ba5daa20…`, including committed provenance, the complete suite, production build, deterministic rebuild, root/deployable equality, exact build identity and production-output preservation.

Physical iPhone Safari acceptance passed the executable EB-1 paths on the exact PR #108 candidate: normal online startup, manual online refresh, in-app offline refresh retaining saved verified data, and return-online recovery. A clean Private Safari tab opened while already offline could not load the uncached GitHub Pages shell, so the no-core clean-offline application path remains automated-test evidence rather than a device failure. The acceptance session used an incomplete manual squad, so device evidence proves retained verified core data but not survival of a previously available recommendation. GitHub Pages was restored to `main` before merge. See [A3 error-boundary separation](docs/A3-ERROR-BOUNDARY-SEPARATION.md).

## 10 August 2026 — `fpl:calib` compatibility is merged

PR #107 is merged at `main` `d112c673310149a4463def1758242460450600dc`, over source/tests/docs commit `862eefc32b0edb070290ad9ce82d85b1123b0596`, generated-only child `69e539647ae687f49605633505e7147da76125e2` and documentation child `6ba905d`. Permanent Verify Teamsheet run #127 / `31396393124` passed every stage on the merge commit, on an 842-test baseline. The merged behaviour rejects every existing unverified `fpl:calib` record from active model state while preserving its bytes, uses standard uncalibrated projections, and keeps the Stage 7 walk-forward check diagnostic-only. No calibration values, raw model formula or production calibration methodology were added. PERSIST-4 is closed.

## 10 August 2026 — Post-A3 0C manual-squad dead-handler cleanup

Post-A3 Checkpoint 0 PR #105 is merged at `main` `dd74365256fe6d9338b720ffecf1913e48ac77eb`. Checkpoint 0A's new automatic push trigger was proven immediately: Verify Teamsheet run #110 / `31383479683` ran on the exact merge commit and passed every stage, on an 835-test baseline.

Pritesh explicitly approved the separate narrow **0C cleanup**. It removes only the two proven-unreachable per-button manual-squad listeners from `src/ui/views.mjs`, keeps the rendered `data-rm`/`data-add` hooks, keeps `src/ui/manual-squad-runtime.mjs` byte-unchanged as the sole validating interaction owner, and adds an ownership regression. One existing A3 test, `manual squad builder has no unchecked squad persistence path`, was re-pointed from the deleted code to the live runtime and made stricter on `views.mjs`; nothing was weakened, deleted or skipped. No football rule or model behaviour changes. See [Post-A3 0C cleanup](docs/POST-A3-0C-MANUAL-SQUAD-DEAD-HANDLER-CLEANUP.md).

## 10 August 2026 — A3 cache and persistence resilience is merged

PR #104 is merged at `main` `9b31f373a23d26c49f81c688a2ca6fde98086cbd`. Its reviewed head was `4e434b940e2bcb473374573db5da16f6a645d9eb`, over source/test commit `502a1f7ac0e0456743f3ddb0695433decf8976d1` and generated-only child `02216b8`, based on the former `main` `473cfdb3295d2b896a00c0aa7b1308814bf2e043`.

The checkpoint keeps Atomic Foreground Refresh ordering unchanged while adding a schema/season-bound main `fpl:cache`, verified user-owned saves, season-bound manual-squad and Mini-League preference records, and explicit session-only warnings when browser persistence fails. Independent review found and corrected one real defect: a failed authoritative storage-manager write could fall back to `localStorage` and be reported as a durable save even though no later read could return it. The Refresh-Load R1 supporting-cache cadence/compatibility rules and Stage 10 evidence stores are unchanged. Legacy `fpl:calib` remained deliberately untouched behind the separate model approval gate until PR #107.

Evidence: **832 passing tests, 0 failed**, verified committed build provenance, two byte-identical production builds, and permanent Verify Teamsheet run #105 / `31377157889` on the reviewed head `4e434b9`. Pritesh **explicitly waived physical iPhone testing** for this checkpoint and explicitly approved the merge. No physical device testing was performed, and none is claimed.

## 10 August 2026 — PR #103 physical acceptance closeout

The final Small Mobile UI Consistency + Loading Viewport Fix application source is `646eee13960c343fbe07e3a76496717fd9837c0e`, with generated-only child `81cc9130ac2c7b8206f3bd5f6a2cf85bb5ba0777`. The final candidate retains every prior test and passes **803 tests, 0 failed**, deterministic byte-identical builds, root/deployable equality, exact build identity and reachable generated provenance. Permanent Verify Teamsheet run #90 / `31356255017` passed on the exact generated head.

Physical iPhone Safari acceptance is complete: the startup canvas reaches Safari chrome without a light strip; Team, Transfers, Fixtures, Leagues and Settings use the accepted shared header hierarchy; the refined editable/selectable controls are visually proportionate while retaining the no-focus-zoom behaviour; and the Leagues primary box now aligns vertically with the other primary screens. Pritesh explicitly approved PR #103 for merge on 10 August 2026.

No projection, expected-minutes, scoring, fixture, captaincy, squad, transfer, rank, Mini-League/rival, provider, data-source, Atomic Foreground Refresh, navigation, Team-renderer or Player Detail behaviour changed.

## Historical — 11 August 2026 A3 closeout boundary

A3 engineering remediation is complete through PR #116. The A3 engineering baseline entering closeout was `1060e60d3affadabdf97924c7ece85cc62d8e360`. Post-A3 Checkpoint 0 (PR #105), the 0C manual-squad dead-handler cleanup (PR #106), `fpl:calib` compatibility (PR #107), EB-1 (PR #108), Production-Bundle Safeguards (PR #111), State-Ownership Cleanup (PR #112), Route-Aware M1 (PR #115) and A3-SC-1 (PR #116) are all merged. [PERSIST-4](docs/KNOWN_LIMITATIONS.md) is closed.

At the time of the A3 closeout record, Data Architecture D1 had only the original design approval. **A later separately approved GW1-P1 checkpoint authorised the backend evidence foundation now implemented in PR #118.** That later approval does not reopen A3 and does not authorise GW1-P2 browser integration, Understat/Odds repair, route-aware optimisation, ChatGPT migration, agent work or live-season model changes.

## Historical — 9 August 2026 reconciliation

The authoritative baseline at that historical checkpoint was `main` `6e725485564a51ee2a17bc08e5c8bf95e8c2778c`, merge of iPhone form-focus zoom PR #100. Its permanent verification passed **693 tests**. DTR-1 and the physical iPhone form-focus zoom checkpoint are complete and merged.

[Data Architecture D1](docs/DATA-ARCHITECTURE-D1.md) was approved then as a documentation-only design decision: Cloudflare D1 for structured records, private R2 for exact immutable evidence, a separate authenticated data Worker, local browser fallback/outbox, and optional downstream Google Sheets reporting. No persistence implementation was approved **by that 9 August checkpoint**. GW1-P1 was approved later as a separate backend-only implementation checkpoint.

**Atomic Foreground Refresh** is complete, physically accepted and merged through PR #102, after five design rounds (R2, R3, R3.1, R3.2, R3.3, R3.4) and the PR #102 correctness review. See [Atomic Foreground Refresh](docs/ATOMIC-FOREGROUND-REFRESH.md).

Read this first. GitHub `main` plus the live state of the active pull request are the permanent source of truth; repository evidence overrides conversations, old uploads and generated deployables. Last reconciled: 12 August 2026.

## Historical pre-C5 baseline table

| Item | Current evidence |
|---|---|
| Latest merged `main` | Read it live: `git rev-parse origin/main`. Deliberately not restated here — see the note at the top of this file. |
| Historical GW1-P2C2 repository test baseline | **971 tests, 971 passed, 0 failed, 0 skipped, 0 cancelled**, with deterministic byte-identical builds, root/deployable equality, exact build identity and verified committed build provenance. Merged `main` separately holds the then-current 907/907 until an approved merge |
| Most recent application checkpoint | GW1 readiness — pre-deadline Transfers safety guard, delivered on PR #121 from `agent/gw1-readiness-safety-guard`. Physically accepted by Pritesh on iPhone Safari at head `f72023043813566fe8b11da2d959e374d34bca39`, Verify Teamsheet #262 / `31583716004` passing 898/898 — the then-current count for that application head, before this PR's documentation-integrity additions. See [GW1 readiness safety guard](docs/GW1-READINESS-SAFETY-GUARD.md) |
| GW1 readiness verdict | Audit found **0 blockers** and two should-fix items; PR #121 addressed both. The application is suitable for GW1 subject only to the separate live-only gates in this table |
| Unmerged application candidate | GW1-P2 — Browser evidence delivery and durable outbox, draft PR #119, branch `claude/gw1-p2-evidence-delivery-design-ejsb0d`, head `252c5eba0381c8aa5afb7bda1686dd102326c6df`, Verify Teamsheet #255 / `31537859087` passing 931/931. Not accepted, not merged, **not a GW1 blocker** |
| Pre-deadline evidence fallback | Until PR #119 is accepted and merged, local Stage 10 capture, recovery and owner-controlled export remain the operating path. That fallback is complete and merged |
| GW1-P2 implementation boundary | Pure outbox state machine; browser delivery service; bounded retries and single-flight; content-hash idempotency; pending-record persistence across restart; fail-closed provider retention; minimal Settings → Evidence status/action; CSP/meta wiring; exact-origin credentialled CORS. |
| GW1-P1 functional production acceptance | Repository record documents Pritesh's physical iPhone Safari acceptance of Access, D1/R2, positive ingest/read-back, duplicate handling, forced R2 failure, forced D1-after-R2 failure and orphan reconciliation. |
| GW1-P1 security state | Repository config explicitly disables Cloudflare Preview URLs and tests that invariant. Owner-supplied live Cloudflare Domains evidence on 11 August 2026 showed production Access-`Restricted` and the wildcard Preview hostname disabled. It is owner dashboard evidence, not independent assistant testing. |
| GW1-P2 completed preparation | Cloudflare Access `Bypass OPTIONS requests to origin` enabled and saved with no Access-layer allowed-origin response; top-level iPhone Safari Access sign-in; protected `GET /v1/health`; expected pre-window Evidence state; non-destructive storage telemetry; Pages branch switch and restoration. |
| Historical GW1-P2 open acceptance gate | The decisive credentialled cross-site background POST from physical iPhone Safari with Prevent Cross-Site Tracking ON, against a genuine Stage 10 record from 20 August 2026 at 18:30 BST. Unproven. |
| GW1-P2 unresolved limitation | The bounded outbox `pinLimit` stays at 4. The usable iPhone storage ceiling is not evidenced and must not be claimed as proven. |
| Final repository gate | The final exact PR head must pass Verify Teamsheet after all config/doc changes. Earlier green runs are historical once the head changes. |
| GW1-P2 merge gate | PR #119 must stay draft and must not merge until Pritesh performs the physical acceptance test and explicitly approves it. |
| External intelligence planning | [External Intelligence Foundation](docs/EXTERNAL-INTELLIGENCE-FOUNDATION.md) — documentation only. Provider-neutral contract, hard `shadow_only` boundary, dated free-source research, double-counting controls and a pre-registered ablation method. Approves no provider, retention, model or calculation change |
| Immediate operating state | Pre-GW1 code freeze and operational rehearsal. Not post-GW1 model or provider work. |
| Deferred live-season acceptance | Published League rank/movement, populated standings and gaps, nearby/pairwise rivals, selected-rival squad/captain/vice/chip exposure, stale/incomplete rival handling and relevant large-league pagination |

[Leagues pre-season acceptance](docs/LEAGUES-PRESEASON-ACCEPTANCE.md) is authoritative for what was accepted and what remains deferred. The deferred checks are not defects while Official FPL has not published the required post-Gameweek facts.

## Historical approval boundary before C5 closeout

Repository Truth A1, Safe Hygiene A2, Refresh-Load R1, A3/A3-R0, DTR-1, Atomic Foreground Refresh, A3 cache/persistence, `fpl:calib` compatibility, EB-1, Production-Bundle Safeguards, State-Ownership Cleanup, Route-Aware M1 and A3-SC-1 are complete and merged. A3 closeout is complete. GW1-P1 is merged through PR #118 at `58b834a…`, and the GW1 readiness safety guard is delivered and physically accepted on PR #121.

GW1 readiness remediation is complete: the audit found no blockers, and its two should-fix items are addressed. It authorised **no** model, provider, fixture, expected-minutes, scoring, squad, captaincy, transfer, optimiser, simulation, rank or Mini-League change, and none was made.

**GW1-P2 is approved only within the boundary recorded in [GW1-P2 Browser evidence delivery](docs/GW1-P2-BROWSER-EVIDENCE-DELIVERY.md)**, with the open acceptance gate and the unresolved retention limitation named above. Nothing beyond that boundary is approved: no Option B delivery window, no hosting change, no broader D1 schema expansion, no scheduled collection, no Sheets automation, no provider repair and no model work.

The [External Intelligence Foundation](docs/EXTERNAL-INTELLIGENCE-FOUNDATION.md) record is approved as **documentation and research only**. Recording a source in its research matrix is not approval to acquire, integrate, retain or weight it; recording a future sequence is not approval to start it. `APPROVED_PROVIDER_NAMES` remains exactly `fpl`, `understat`, `odds`, `archive`, and a permanent test pins that. Every item in that record's post-GW1 sequence — including the shadow foundation itself — needs its own evidence-led proposal and explicit approval before any code is written.

The approved GW1-P1 evidence flow is:

`canonical Stage10 record -> validate/recanonicalise -> canonical SHA-256 -> private R2 create/verify -> D1 manifest/receipt -> ACK only after D1 commit`

D1 must never point to an R2 object that does not exist. If R2 succeeds and D1 fails, return no ACK; the R2 object is an invisible orphan. Reconciliation may recover it later only after the same canonical/body/metadata checks, preserving the original R2 upload time and never fabricating earlier custody. Duplicate ingestion must be idempotent.

Permanent provider retention remains fail-closed. Understat rights remain unresolved; Odds retention requires the separately approved governance position. Do not alter provider acquisition/weighting or silently strip canonical provider material. Google Sheets remains downstream reporting only.

The first completed and officially `data_checked` Gameweek remains an evidence gate for real minute history, Stage 10 outcomes and populated Leagues behaviour. Those gates do not authorise model changes.

## Owner and communication

Pritesh is a non-developer but rigorous reviewer who primarily works from an iPhone. Lead with the outcome, then evidence, risks and recommendation. Distinguish fact, inference, proposal and limitation. Never claim success, accuracy, deployment or physical-device acceptance without evidence.

## Read in this order

1. [Project Context](docs/PROJECT_CONTEXT.md)
2. [Architecture](docs/ARCHITECTURE.md)
3. [Decisions](docs/DECISIONS.md)
4. [Roadmap](docs/ROADMAP.md)
5. [Known Limitations](docs/KNOWN_LIMITATIONS.md)
6. [Teamsheet 2.0 Product Blueprint](docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md)
7. [Data Architecture D1](docs/DATA-ARCHITECTURE-D1.md)
8. [GW1-P1 Cloudflare Evidence Foundation](docs/GW1-P1-CLOUDFLARE-EVIDENCE-FOUNDATION.md) and [GW1-P2 Browser evidence delivery](docs/GW1-P2-BROWSER-EVIDENCE-DELIVERY.md)
9. Before provider or security work: [Data Sources](docs/DATA_SOURCES.md) and [Security](docs/SECURITY.md)
10. Before model, projection, fixture, squad, captaincy, optimisation, rank or Mini-League calculation work: [Projection Model](docs/PROJECTION_MODEL.md) and [Testing](docs/TESTING.md)
11. Before any new external-data, provider-evaluation, shadow-evidence or ablation proposal: [External Intelligence Foundation](docs/EXTERNAL-INTELLIGENCE-FOUNDATION.md)
12. Before Decision Intelligence work: [Decision Intelligence DI-0 Foundation](docs/DECISION-INTELLIGENCE-FOUNDATION.md)
12a. Before Autonomous Data Steward work: [DATA-OPS-A1.1](docs/DATA-OPS-A1-1-POLICY-OBSERVE-ONLY-FOUNDATION.md) then [DATA-OPS-A1.2](docs/DATA-OPS-A1-2-OBSERVE-ONLY-PRODUCTION-SENTINELS.md) then [DATA-OPS-A1.3](docs/DATA-OPS-A1-3-LIVE-READONLY-OBSERVER.md)
13. Historical A3 records only when needed: [A3-SC-1 Small Stale-Code Cleanup](docs/A3-SC-1-SMALL-STALE-CODE-CLEANUP.md), [Route-Aware Rendering and Performance](docs/ROUTE-AWARE-RENDERING-PERFORMANCE.md), [A3 State-Ownership Cleanup](docs/A3-STATE-OWNERSHIP-CLEANUP.md), [A3 error-boundary separation](docs/A3-ERROR-BOUNDARY-SEPARATION.md) and [Historical Records](docs/HISTORICAL_RECORDS.md)

## What Teamsheet is

Teamsheet is a team-first, decision-first FPL application for the manager's complete 15-player squad. The primary destinations are Team, Transfers, Fixtures, Leagues and Settings. Player research lives under Settings; Ask Teamsheet has a separate route but hosted AI remains disabled. Teamsheet is advisory and performs no FPL account write.

The app currently provides:

- a best XI, captain, vice-captain and bench order;
- exact legal zero-to-three-transfer comparisons with a mandatory no-transfer baseline, suppressed in favour of an explicit unlimited-changes notice before the first Official FPL deadline of a season;
- fixture-run and swing-window planning through GW38;
- an all-league hub, selected-league detail, targeted standings and explicitly loaded rival comparisons;
- settings, provider health, evidence, outcomes, descriptive metrics, review and deterministic exports.

It does not yet provide a validated projected-rank model, protect/balanced/chase strategy, cited team-news intelligence, automated Google Sheets sync or prospectively proven model accuracy. Merged GW1-P1 adds a server-side evidence destination but does **not** give the normal Teamsheet browser automatic cloud custody. GW1-P2 implements that custody, but it is unmerged and acceptance-incomplete, so the app has no automatic cloud custody and local Stage 10 capture/export remains the pre-deadline evidence path.

## Non-negotiable engineering rules

- Never change projection, expected-minutes, scoring, fixture, captaincy, squad, simulation, transfer, rank, Mini-League or strategy logic without first presenting existing and proposed behaviour, inputs, fallbacks, assumptions, limitations, trade-offs and validating evidence, then receiving explicit approval.
- Never add a provider or data source without an approved purpose, field contract, reliability assessment, validation/ablation plan, fallback, security/privacy review, cost and tests.
- Never delete, weaken or skip a test to make a change pass.
- Never claim improved prediction accuracy without genuine out-of-sample validation. The historical aggregate r=0.80 is method-flattered.
- Transfer pruning must remain admissible, and `exhaustiveTransferSearch()` must remain independent of production pruning.
- Preserve deterministic builds, exact reachable `BUILD_COMMIT` identity, complete build-input identity, root/deployable equality and generated-file provenance.
- Preserve Vanilla JavaScript ES modules, the zero-dependency toolchain, Node built-in tests, the custom bundler, GitHub Pages and the single-file deployment unless separately approved.
- Generated `dist/` and root `index.html` files come only from `build.mjs`; never hand-edit them.
- Anthropic keys remain banned client-side. Odds requests remain direct-only and the key must never be relayed, logged, rendered or exposed in diagnostics.
- Understat remains team-level only. Optional-provider failure must degrade gracefully.
- Supporting caches contain only validated model inputs: no Understat HTML and no Odds key or keyed URL.
- Preserve mobile-first iPhone usability and the accepted physical behaviours touched by a future change.
- For the evidence archive specifically, R2 remains private, the evidence Worker exposes no generic SQL/R2 browser access, Access errors stay generic, sensitive auth/account/provider-key material is never logged/stored, and backend availability must never become a recommendation dependency. GW1-P2's client adds no permanent browser service token and persists no secret, cookie, team domain, policy audience or account identifier.

## Current security and data boundaries

- Official FPL reads use the owner-controlled, allowlisted Cloudflare gateway and still pass client validators.
- GW1-P1 uses a **separate** Access-authenticated evidence Worker backed by private R2 and D1. On merged `main` the browser does not call it; the unmerged GW1-P2 candidate adds an exact-origin credentialled call as a one-way side effect. No wildcard `Access-Control-Allow-Origin` exists anywhere.
- Every non-preflight evidence route requires the Worker's own validation of `Cf-Access-Jwt-Assertion`; `TEAM_DOMAIN` and `POLICY_AUD` are runtime configuration and must not be printed or hard-coded.
- Evidence Wrangler config keeps the accepted production `workers.dev` route enabled and explicitly disables `preview_urls`. Live route-state confirmation is always required separately after deployment; for the current candidate it is recorded from owner-supplied 11 August 2026 Cloudflare Domains dashboard evidence.
- Provider and user strings use DOM builders; AI output uses restricted Markdown.
- The Odds key is masked, direct-only, forgettable and scrubbed from diagnostics.
- The generated single script and style are SHA-256 locked by CSP.
- Runtime style APIs and style attributes are forbidden.
- Stage 10 evidence is allowlisted, hash-verified and recovery-oriented; exports are complete, unencrypted and owner controlled.
- League and manager identifiers stay out of routes, page titles, provider diagnostics and Stage 10 evidence.
- Permanent Understat/Odds server retention is fail-closed until separately approved.

## Workflow

1. Inspect latest `main` and the live active PR; read this file first.
2. State the exact baseline, scope, exclusions, risks and approval gate.
3. Obtain explicit approval where required.
4. Create a separate branch; never push directly to `main`.
5. Implement only the approved scope.
6. Add or update tests without weakening existing protection.
7. Run `./run-tests.sh` and the production build.
8. Verify two exact-identity builds, root/deployable equality and manifest identity where relevant.
9. Update affected canonical documentation.
10. Open/update a draft pull request with evidence and exclusions.
11. Where security depends on live Cloudflare route/dashboard state, obtain that evidence explicitly; repository config alone is insufficient.
12. Move a draft PR to ready only when every gate is satisfied.
13. Merge only after explicit owner approval, then verify `main`.

## Completion report for every implementation item

Report the exact changes, deliberate exclusions, test count and result, deterministic-build evidence, root/deployable result, documentation updates, judgement calls, remaining limitations, physical-device/live-infrastructure evidence actually performed, branch, commit and pull-request link/state.


<!-- DATA-S1-2026-08-22 -->
## DATA-S1 repository foundation — 22 August 2026

The separately approved [DATA-S1 Shadow Structured Data Foundation](docs/DATA-S1-SHADOW-STRUCTURED-DATA-FOUNDATION.md) adds the isolated, provider-neutral `teamsheet-data-platform` repository service and separate future `teamsheet-data` D1 binding. Only `shadow_only` is valid. It has no production/browser/model/Provider Health read path, no new R2, no provider activation and no Google Sheets integration; existing Stage 10 D1/R2 custody remains separate and unchanged. No live infrastructure was created or modified. PR #145 is merged and repository-verified, but DATA-S1 remains **not live deployed**. DATA-S1A is the current control reconciliation. The separately owner-gated sequence is DATA-S1B live Cloudflare preflight/deployment/acceptance, DATA-S2 Official FPL structured history, DATA-S3 automated Official outcomes, DATA-S4 provider trials/evaluation, DATA-S5 downstream Sheets automation, then later explicit production/model gates. See the [DATA-S1B plan](docs/DATA-S1B-LIVE-DEPLOYMENT-ACCEPTANCE-PLAN.md).

Effective **22 August 2026**, the owner superseded the blanket £0 recurring-cost constraint: free remains preferred where comparable, while a small paid provider may be considered only with explicit pricing, rights and value/cost justification, preferably after a shadow trial. This approves no provider and does not rewrite historical research conducted under the former constraint.
<!-- EXTERNAL-INTELLIGENCE-EIA1-2026-08-30 -->
### Current external-intelligence checkpoint — EIA-1 review candidate

EIA-1 adds pure offline adapters for existing snapshot/outcome/DATA-S2B exports and a provider-neutral workload contract. DATA-S2B remains live-unaccepted and is fixture-proven only. TheSportsDB is `local_research_only`, durable retention is blocked, and qualification is FAIL for expected-minutes workload evidence. No signal, provider, model, recommendation, UI or infrastructure behaviour changes. See [EIA-1](docs/EXTERNAL-INTELLIGENCE-EIA1-XMINS-EVIDENCE.md).

<!-- DATA-S2B-E2A-2026-09-01 -->
### Current DATA-S2B checkpoint — E2A repository-only D1 REST validation candidate

E2A adds deterministic synthetic atomicity, affinity, statement/body and 9,860-write analogue plans plus an unforgeable E2A-factory fake-transport harness, phase-specific derived empty/setup schema fingerprints, exact-table-set disposable-identity firewall, no-retry ambiguity classifications and sanitized evidence. It performs and approves no Cloudflare request, account/token/resource inspection, D1 creation/query/mutation, workflow, Cron or deployment. It proves no live REST atomicity, affinity or size behaviour. E2B/E2C/E2D require separate explicit owner approval. See [E2A record](workers/data-platform/DATA-S2B-E2A-REPOSITORY-D1-REST-VALIDATION.md).

<!-- DATA-S2B-E2C-A-2026-09-01 -->
### DATA-S2B E2C-A repository-only live-validation contract

E2C-A adds inert, fail-closed disposable-D1 experiment plans, an identity-bound authentic-plan-only HTTP adapter, a strict Cloudflare-shaped response decoder, pre-mutation exact metadata and clean-INITIAL-schema gates, closed post-setup object-set plus semantic-schema enforcement, closed adapter-to-orchestrator composition, quote-aware CHECK canonicalisation, response/state-paired atomicity acceptance, reconcile-then-stop mutation ambiguity handling, W00/W01 reconciliation and strictly bounded sanitized evidence including canonical UTC timestamps. It performs no Cloudflare request and proves no live atomicity, parameter affinity or request-size behaviour. Any live experiment, credential, resource, workflow/environment, cleanup or production decision remains separately owner-approved. See [E2C-A record](workers/data-platform/DATA-S2B-E2C-A-LIVE-VALIDATION-CONTRACT.md).

<!-- DATA-S2B-E2C-B-2026-09-01 -->
### DATA-S2B E2C-B disposable live experiment preparation

E2C-B makes production-account fingerprinting mandatory, adds exact returned-value affinity/storage acceptance, preserves missing versus zero provider metadata with bounded attempts, and adds a dormant manual-only exact-main/exact-Verify protected workflow with rerun rejection and no cleanup. It is repository-only: no resource, credential, environment, workflow dispatch or Cloudflare request occurred. See [E2C-B record](workers/data-platform/DATA-S2B-E2C-B-DISPOSABLE-LIVE-EXPERIMENT-PREPARATION.md).

The corrected boundary takes the approved disposable-account fingerprint independently from the protected environment, proves the runtime raw disposable account hashes to it and proves it differs from production before transport. Evidence end time is captured only after the awaited contract settles, on success or failure; it cannot be caller-precomputed.
