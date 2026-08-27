# DATA-S2B — Phase 2 Live Read-Only Closeout

Status: **PASS — inactive Worker Version created and independently reconciled; production deployment unchanged; Phase 3 remains unapproved**  
Recorded: **27 August 2026**

## Outcome

DATA-S2B Phase 2 is closed as a successful **inactive Worker Version** checkpoint.

This does **not** mean the Phase 2 Worker Version has been deployed to production. Production traffic remained on the pre-existing active version throughout Phase 2 and the later read-only closeout.

Authoritative closeout evidence:

- repository `main` approved and executed at `2176a3dd29562fecff10614b689ed99a06db6bfa`;
- post-merge Verify Teamsheet run `33074154222`: completed success on that exact `main` SHA;
- manual read-only closeout run `33088512116` (`DATA-S2B Phase 2 Read-Only Closeout` #1): completed success;
- repository-gate job `98574659850`: completed success;
- protected-environment read-only job `98574703107`: completed success;
- active deployment remained `10f7a065-3d82-4b34-9fb1-dc6c3a0be524`;
- active version remained `5edbe951-4be4-46bc-b2cf-17b550396105`;
- inactive Phase 2 version remained `3a2b065a-6527-4887-9bf8-b08e82e81133` and remained the latest deployable version;
- live Cron remained empty;
- Phase 1 D1 migration/governance/count state remained exact and contained no ingestion, shadow observation or head data;
- D1 database size remained exactly `151552` bytes before and after the bounded closeout read.

## What attempt #3 actually did

Phase 2 attempt #3 was run `33050859823` on exact main `403f4318eda368d8b981f63cd861ddcb2c963c47`.

The Worker Version upload itself succeeded and created:

`3a2b065a-6527-4887-9bf8-b08e82e81133`

The workflow later reported failure because its post-upload verifier treated `GET /workers/scripts/{script}/settings` as though it proved the bindings of the separately active deployment. Once a newer inactive Version existed, that assumption was invalid.

The correct authority is:

1. Deployments identifies the active version.
2. Get Version Detail for that exact active version proves active bindings.
3. Get Version Detail for the exact Phase 2 version proves candidate bindings.

PR #170 corrected that verification model and added the dedicated read-only closeout path. No fourth upload was required.

## Read-only closeout contract proven

The successful closeout run was fail-closed on every required property. A PASS therefore proves that all of these checks succeeded in the same bounded read window:

### Deployment and version identity

- active deployment was exactly `10f7a065-3d82-4b34-9fb1-dc6c3a0be524` before and after reconciliation;
- active version was exactly `5edbe951-4be4-46bc-b2cf-17b550396105` before and after reconciliation;
- latest deployable version was exactly `3a2b065a-6527-4887-9bf8-b08e82e81133`;
- the prior active version remained present in deployable Version History;
- the ordered deployable version list was unchanged across the read window;
- the inactive Phase 2 version was not accidentally active.

### Binding and compatibility identity

The exact active version retained:

- `TEAMSHEET_DATA_DB` as the expected D1 binding;
- `DATA_S1_HTTP_AUTH_TOKEN` as retained `secret_text`;
- no `DATA_S2_SEASON` binding.

The exact inactive Phase 2 version retained:

- the same D1 binding identity;
- `DATA_S1_HTTP_AUTH_TOKEN` as retained `secret_text`;
- `DATA_S2_SEASON=2026-27` as `plain_text`;
- compatibility date `2026-08-22`.

The closeout read did not expose the secret value or persist raw Cloudflare responses.

### Cron and D1 state

- live Worker Cron expressions were empty before and after reconciliation;
- the Phase 1 migration state remained exact;
- the approved Official FPL source and revision governance rows remained exact;
- `ingestion_runs=0`;
- `shadow_observations=0`;
- `observation_heads=0`;
- `canonical_entities=0`;
- D1 file size was `151552` bytes before and after the closeout read.

No collector ran and no Official FPL acquisition occurred during this closeout.

## File-size limitation

The `151552`-byte comparison has two meanings that must not be collapsed:

1. it is the recorded Phase 1 closeout baseline; and
2. the read-only Phase 2 closeout independently observed the database at that same size before and after its own bounded reconciliation read.

It is **not** a reconstructed immediate-before/immediate-after size pair for the original attempt #3 upload. Attempt #3 did not emit its in-memory pre-upload size before the later false failure, so that exact historical pair cannot be recovered after the fact.

## Accidental run #4 — cancelled safely

During owner execution of the closeout, the similarly named `DATA-S2B Phase 2 Inactive Version Upload` workflow was accidentally dispatched once as run `33088187544` on `2176a3dd29562fecff10614b689ed99a06db6bfa`.

The repository gate completed successfully, but the actual `phase2-version-upload` job remained waiting behind its protected environment. The owner cancelled the workflow before releasing that environment.

Therefore:

- no additional Worker Version upload from run #4 executed;
- no deployment executed;
- no Cron or D1 mutation executed;
- the accidental run does not alter the accepted Phase 2 artifact count or identity.

This event is retained because it demonstrates that the protected environment approval boundary stopped an unintended mutation after repository-gate execution but before the mutation-capable job could start.

## Mutation and security boundary

The successful closeout used the existing protected `data-s2b-phase0-readonly` environment and its read-only Cloudflare capability.

The closeout performed no:

- Worker Version upload;
- deployment, promotion or traffic split;
- Worker trigger, route or domain change;
- secret mutation;
- D1 write or migration;
- Time Travel mutation;
- provider or data-source addition;
- application change;
- model or calculation change.

## Phase 2 completion statement

Phase 2 is complete for its approved purpose: **one exact candidate Worker Version exists, remains inactive, and its identity/configuration plus the unchanged production/D1/Cron state have been independently reconciled with a successful read-only live run.**

This is not production acceptance of the Phase 2 code path because the candidate has not served production traffic.

## Next gate

Only after this live result is recorded and repository-verified may **Phase 3 deployment** be proposed.

Phase 3 requires a separate investigation/design and explicit owner approval before any production mutation. Its proposal must define at minimum:

- current and proposed active version behaviour;
- exact deployment/traffic strategy;
- pre-deployment invariants;
- binding and compatibility checks;
- rollback path and rollback trigger;
- production health/functional acceptance checks;
- D1/Cron invariants;
- fail-closed handling for any drift or partial failure.

Phase 3 is **not authorized by this closeout**.

Phase 4 Cron activation and collection remain separately unapproved and must not be pulled forward.