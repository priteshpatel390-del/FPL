# API-Football Gate C forensic remediation (R1/R2) and immutable Version preservation

Repository-only. Written 8 October 2026 after the failed Gate C run `37776873809`. No Cloudflare change, Version upload,
Deployment, workflow dispatch, API-Football request, D1 write or schema change is made or authorised by this work.

## 1. Status of Gate C

Gate C run `37776873809` (attempt 1) **failed and is permanently consumed. It must never be rerun.**

Facts established by owner-authorised read-only D1 queries (8 October 2026, database `teamsheet-data`, every response
`rows_written = 0`):

| Fact | Value |
|---|---|
| Discovery requests executed | 4: Champions League, Europa League, Conference League, FA Cup |
| Outcomes | first three `SUCCEEDED`; FA Cup (`league=45`) `SCHEMA_FAILURE` |
| League Cup (`league=48`) | never attempted |
| Generation / ingestion run | `FAILED`, stored class `provider_schema_invalid` (exact) |
| Stored counters | `competition_count=0`, `fixture_count=0` (counters are not updated on failure) |
| Retained rows | 824 fixture revisions and 824 generation memberships, all against the failed generation |
| Discovery heads | 0, so no committed generation exists |
| Foreign-key violations | 0 |
| Runtime | collection disabled, credential `AVAILABLE`, `quota_state=QUOTA_UNCERTAIN`, daily attempt count 4, no lease |
| `http_class` | null on every attempt (the deployed code never populated it) |

**The exact cause of the FA Cup schema failure is unresolved.** The deployed code stores only the class
`provider_schema_invalid`, no sub-reason, no HTTP status class and no response body. Offline analysis shows the recorded
signature (`SCHEMA_FAILURE` plus `QUOTA_UNCERTAIN` on a 2xx) is reproduced by a response whose quota headers were absent or
unusable together with an invalid body or a non-empty provider `errors` object. That is an inference from code, not proof.
The rejected response is not stored, so it cannot be recovered from D1.

The 824 retained revisions are inert: no head references the failed generation and the shadow-only isolation means nothing
reads them. They are not deleted by this work.

## 2. R2: planner generation isolation

`readPlannerFixtures()` (`workers/api-football-collector/planner-orchestrator.mjs`) previously took the identity list from the
head generation's memberships but chose each revision as the newest by `fetched_at` across **all** generations. A newer
**failed** generation could therefore replace a committed generation's fixture data. It now joins the membership's own
`fixture_revision_id`, requires the identity to match, and requires the head generation to be `COMMITTED` for the same season.

Today there is no discovery head, so the planner view is empty and the defect had no live effect. It would have become live
shadow-planner exposure once a first generation was committed. No FPL model, projection, captaincy, transfer, rank or Mini-League
code is touched, and no production FPL or UI path reads API-Football tables.

Regression tests (`tests/api-football-gate-c-forensic-remediation.test.mjs`) include a committed generation followed by a newer
failed generation, and identical-content reuse. Three of them fail against the previous SQL.

## 3. R1: closed diagnostics

Added without a migration, a new table, a new column, or any stored provider text:

* `api_football_request_attempts.http_class` is populated (`2xx`, `3xx`, `4xx`, `5xx`) whenever an HTTP response exists.
  A thrown fetch has no response and stays null.
* On a schema failure the persisted `failure_class` (and the mirrored `ingestion_runs.error_class`) gains a closed suffix:

  `provider_schema_invalid[:<sub-reason>][;ct=<content-type class>][;b=<size bucket>][;q=<quota-header state>]`

  * sub-reason: one of a fixed enum of 19 values (`body_empty`, `body_not_json`, `body_read_exception`, `payload_not_object`,
    `response_not_array`, `get_mismatch`, `parameters_shape`, `errors_shape`, `errors_nonempty_{rate_limit|requests|plan|credential|access|other}`,
    `results_not_integer`, `results_count_mismatch`, `envelope_keys`, `paging_shape`, `envelope_other`);
  * `ct` in `json|html|text|other|none`; `b` in `0|lt1k|lt64k|ge64k`; `q` in `known|none|bad|skew`.
* Provider `errors` keys are mapped through a fixed allowlist; any other key becomes `other`. No key, message, body, header value,
  credential or number outside a fixed bucket is ever stored or returned. The longest possible value is 74 characters, inside the
  existing 80-character cap, and a test proves this over the whole cross-product.
* **Meaning is unchanged.** The returned `reason` is still exactly `provider_schema_invalid`, the first token of the stored value
  is still exactly `provider_schema_invalid`, and every other failure class is stored exactly as before.

### Encoding audit

Every consumer of these columns was audited:

* `failure_class`: written only by `failGeneration`/`commitGeneration`; the only SQL equality checks
  (`activation-live-preflight.mjs`) target `persistence_uncertain` and `attempt_completion_uncertain`, which are not altered. The
  `NOT NULL` check for `FAILED` rows still holds. No code compares it to `provider_schema_invalid` by equality (a test now enforces this).
* `error_class`: every reader (`d1-sentinel`, the Phase 4B diagnostics and live contracts, production postflight, first-run
  reconciliation, committed-run integrity) is scoped to Official FPL source revisions; API-Football runs use
  `api-football:eia-2i5a:1`.
* Gate C admission and reconciliation read counts by attempt `outcome`, not by class text.

No consumer needs a change, so no migration or broader compatibility change is required. **If a future reader needs to match the
class, it must match the first token (before the first `:` or `;`) or use `LIKE 'provider_schema_invalid%'`, never equality.**
Alternatives that would need a migration (dedicated diagnostic columns) are not implemented and need separate approval.

## 4. Immutable deployed Version preservation

The deployed Version `4171f3cf-953e-452e-9e5f-068df9a3ca47` (created by Gate A from `f01ccff5b13a4bbc98d7927cf620f69f46c4c54c`,
promoted by Gate B) contains the old, uncorrected code. It is immutable and unchanged.

Its identity used to be checked against the **working tree**, with SHA-256 pins. Any edit to one of the 17 reviewed modules
therefore broke every Gate A/B/C identity check, which is a correct fail-closed behaviour but made it impossible to land R1/R2.
The pins were **not** updated to follow the new code. Instead:

* `workers/api-football-collector/reviewed-remediated-module-snapshots/` holds the verbatim bytes of all 17 reviewed modules at
  `f01ccff5…` (`git show f01ccff5:<path>`), stored as inert `.snapshot` files.
* `reviewed-remediated-snapshots.mjs` pins each snapshot's raw SHA-256 and re-verifies it on every read. Drift, a missing file or an
  unreviewed path fails closed.
* `buildTransportRemediatedVersionIdentity()` and its graph/upload builders now default to the verified snapshots. The existing
  upload-module pins (`TRANSPORT_REMEDIATED_VERSION_MODULE_SHA256`) are untouched. The identity reproduces Gate A's recorded graph hash
  `03db54c4…8f6cc` and metadata hash `67097c83…b1119` exactly, and the uploaded multipart bytes hash to the pinned values.
* The attended Version `04d79556` (and the historical lifecycle clone) keep their two attended-specific snapshots; their other 15 modules,
  whose pins equal the deployed Version's, now also come from the verified snapshots instead of the moving tree.

Consumed Gate A, B and C workflows, their identities, safety rules and evidence are unchanged. No workflow file was edited.

## 5. Boundary between deployed code and future corrected code

`corrected-version-candidate.mjs` is a separate identity: contract `api-football-gate-c-forensic-corrected-version-candidate-v1`,
state `NOT_CREATED_NOT_UPLOADED_NOT_DEPLOYED`, its own pinned module hashes for the current tree, and exactly five modules that
differ from the deployed Version (`collector`, `activation-orchestrator`, `planner-orchestrator`, `runtime-contracts`,
`semantic-validation`). It has no upload form, no Cloudflare request, no D1, no secret handling and no importer. It does not import the
historical snapshots, and the historical snapshots are rejected as its source by its own pins. Tests enforce all of this statically.

## 6. Remaining risks and future approval gates

* The deployed Version still runs the old code. R1/R2 reach production only through a **new** Version, which needs: Version preparation
  and review of the candidate pins, a one-time upload, a Deployment promotion, and a new live collection gate. Each is a separate,
  explicitly approved gate. The consumed Gate C workflow must not be reused.
* The cause of the FA Cup failure will only be learned by a future live attempt carrying R1. The 824 retained revisions will be reused
  (content-addressed) by a later generation of identical content. Their `generation_id` stays tagged to the failed generation, so
  reconciliation must count by membership, not by revision `generation_id`. This is not changed here (R3/R4 are out of scope).
* A failed generation also updates shared `provider_fixture_identities` fields and leaves its counters at 0; unchanged here (R3).
* Provider-reported `errors` are still classed as `provider_schema_invalid` (R4 not implemented), now with a precise sub-reason.
* The sqlite-CLI based tests cannot run in environments without the `sqlite3` binary; they run in CI.
