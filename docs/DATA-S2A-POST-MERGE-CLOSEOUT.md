# DATA-S2A — Post-Merge Closeout

Status: **merged and repository-verified; live DATA-S2 remains unaccepted**  
Date: **26 August 2026**

## Outcome

PR #160 — `DATA-S2A: Official FPL structured history repository candidate` — is merged.

Authoritative merge commit:

`94952ed01564a970e4d5139adae05aa6f17af25c`

The exact merge commit passed the post-merge `Verify Teamsheet` workflow (`32960674055`). DATA-S2A is therefore complete at its repository gate.

This record supersedes any older present-tense wording that still describes DATA-S2A as being on draft PR #160. Those earlier sections remain historical evidence of the pre-merge state.

## What is now on main

The merged repository contains:

- the private `shadow_only` Official FPL structured-history collector;
- fixed `bootstrap-static` and `fixtures` inputs;
- strict allowlisted event/team/player/fixture facts;
- season-scoped Official FPL identities;
- append-only change observations and atomic current heads;
- explicit-null lifecycle handling;
- fail-closed season-rollover protection derived from Official FPL GW1 deadline evidence;
- D1 Free-tier bounded bulk writes and a hard 15,000-changed-observation guard;
- permanent Reuse Before Build governance and the DATA-S2 backend reuse audit;
- repository declaration of `DATA_S2_SEASON = "2026-27"` and hourly `0 * * * *` Cron configuration.

The repository Cron declaration is not evidence that the live Cron is active.

## Verification baseline

The reviewed PR head completed with:

- 1,036 tests passed, 0 failed, 0 skipped, 0 cancelled;
- deterministic double production build;
- root/deployable equality;
- exact build identity/provenance;
- research/documentation integrity;
- exact synthetic 6,825 candidate regression unchanged.

The post-merge workflow then passed again on the exact merge commit.

The 6,825 value is a synthetic fixture invariant, not a claim about the exact current live Official FPL population. A real baseline must derive its expected candidate count from the actual validated event/team/player/fixture populations.

## No live acceptance follows from merge

PR #160 merge performed or approved none of the following:

- applying DATA-S2 migrations to live D1;
- deploying the DATA-S2A Worker version;
- activating Cron;
- creating a real Official FPL baseline in D1;
- proving an unchanged live cycle;
- proving a changed live fact;
- proving Workers Free CPU suitability;
- proving actual D1 rows-read/rows-written/storage usage;
- connecting D1 to Teamsheet;
- changing any model/provider/recommendation behaviour.

## Next checkpoint

The next checkpoint is **DATA-S2B — Live Deployment and Acceptance**, separately owner-gated.

Its investigation/design runbook is:

[DATA-S2B Live Deployment and Acceptance Plan](DATA-S2B-LIVE-DEPLOYMENT-ACCEPTANCE-PLAN.md)

DATA-S2B begins with mutation-free live account/D1/Worker preflight. No Cloudflare mutation occurs until the owner reviews that evidence and explicitly approves the mutation phase.