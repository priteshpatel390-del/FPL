# DATA-S1C-R — Data Architecture Reset

Status: **approved repository implementation; no live infrastructure or production-data change**  
Decision date: **26 August 2026**  
Implementation base: `e61f9ba080346326f4aa764206c62781582c17f0`  
Owner gate: Pritesh approved repository implementation only; stop at draft PR review.

## Outcome

DATA-S1C-R replaces transport-first DATA-S1C planning with a stable data boundary:

`Official FPL canonical current core + explicitly promoted enrichment + owner overlay -> current decision dataset`

and, separately:

`validated observations -> historical/shadow store -> point-in-time research and evaluation`.

The production application must consume stable domain contracts rather than know whether a future approved enrichment was collected through D1, a Worker, a static artefact or another transport. Transport is therefore a replaceable implementation detail. No new production transport is selected by this checkpoint.

The previous private Service Binding/RPC design and the unimplemented custom bearer-HTTPS alternative are **retired from the forward architecture**. Their repository and live evidence are not deleted here. Existing RPC source, workflow, deployed caller/target state and Access-protected HTTP rollback assets remain historical evidence and possible rollback material until a separately approved cleanup checkpoint.

This record is the current DATA-S1C forward architecture. Where older current-status wording in `CLAUDE.md`, `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `ROADMAP.md`, `KNOWN_LIMITATIONS.md`, `DATA_SOURCES.md`, `SECURITY.md`, `TESTING.md` or the historical DATA-S1C RPC record conflicts with this forward decision, this record supersedes that forward-looking wording only. Dated facts and live evidence remain historical evidence.

## 1. Canonical current core

Official FPL remains the canonical source for current FPL structure and current player/competition facts used by Teamsheet. The existing owner-controlled Official FPL gateway, existing client validation and existing verified-cache/restricted-mode behaviour remain unchanged.

The canonical current core includes, where already supplied and validated by Official FPL:

- season and Gameweek/event identity and deadline state;
- team identities;
- player identities and current player-to-team assignment;
- fixture identities, home/away teams, Gameweek/event assignment and kickoff;
- current player status, price, ownership and other already-consumed Official FPL fields;
- the existing Official FPL team-strength and fixture-difficulty inputs used by the current model.

DATA-S1/D1 does not become authoritative for these current facts in this checkpoint, and the production application does not gain a DATA-S1 read dependency.

## 2. Approved enrichment is a separate layer

Supplemental intelligence must never silently overwrite or become equivalent to canonical Official FPL state. Every supplemental category starts as research/shadow information and may influence production only after a separately approved promotion.

Examples of possible future enrichment categories include expected-minutes evidence, cited team news, predicted line-ups, market information, calendar/workload facts, set-piece/role evidence and other provider-neutral observations. Naming a category here is not approval to acquire, retain, redistribute, weight or use any provider.

A production promotion proposal must state and obtain approval for all of the following before any recommendation dependency is created:

1. the decision purpose and exact fields/categories;
2. source identity, rights, retention and redistribution position;
3. acquisition reliability, freshness and timestamp/provenance contract;
4. canonical player/team/fixture mapping rules and fail-closed behaviour;
5. validation, contradiction and quality handling;
6. ablation and available out-of-sample evidence where the data can change a model/calculation;
7. fallback behaviour when the enrichment is absent, stale, incompatible or failing;
8. security/privacy and credential boundaries;
9. permanent tests and evidence required for acceptance;
10. explicit owner approval.

A D1 observation being `accepted` means it passed the shadow-store admission contract. It does **not** mean it is approved for production recommendations.

## 3. Historical/shadow store

The existing DATA-S1 structured store remains useful for append-only research, provenance, source governance, canonical mappings, point-in-time replay and later evaluation. Its `shadow_only` boundary remains in force unless separately changed through the normal approval gate.

Historical research must preserve the distinction between `observed_at`, `effective_at`, `fetched_at`, optional expiry, source revision and immutable input revision. Point-in-time reads must not leak facts fetched after the requested `as_of` time into earlier decisions.

D1 availability must not become a prerequisite for opening Teamsheet or producing the already-approved baseline recommendation. The historical store is not the production application's runtime database in this checkpoint.

## 4. Owner overlay stays separate

Manager-specific state stays outside the global football dataset. This includes the manager's team, picks, bank/free-transfer assumptions or authoritative account facts where available, local settings, Mini-League selections and rival selections.

The conceptual production composition is:

`canonical current core + approved compatible enrichment + owner overlay -> decision engine`.

This separation avoids duplicating global football facts per manager and prevents research/history storage from becoming an accidental owner-state authority.

## 5. Compatibility revisions

Future enrichment must be versioned against the smallest canonical context that can make it invalid. A single whole-dataset invalidation hash is too coarse because unrelated Official FPL changes should not discard valid evidence.

The contract therefore distinguishes:

### Current-state revision

A deterministic identity for the complete validated current state used by a recorded decision. This is the reproducibility/audit identity; it does not by itself decide whether every enrichment row is incompatible after any change.

### Player-team context revision

For team-dependent player evidence, compatibility must include at least season, canonical player identity and current canonical team identity. A player transfer or canonical reassignment invalidates team-dependent enrichment. A price or ownership percentage change does not automatically invalidate unrelated team-news or expected-minutes evidence.

### Fixture context revision

For fixture-dependent evidence, compatibility must include at least season, canonical fixture identity, event/Gameweek assignment, home team, away team and kickoff context. A postponement, Gameweek reassignment, changed opponents or changed kickoff invalidates evidence whose meaning depends on that context and requires revalidation/refetch according to its approved freshness policy.

### Source/transform revision

Provider/source governance revision, parser/transform version and validation version remain separate from football-context compatibility. A schema or transform change must not masquerade as a football-context change.

No context identity may be invented when a safe canonical identity is unavailable. Unresolved or ambiguous mapping remains fail-closed.

## 6. Real-season change handling

The intended behaviour is:

| Change | Required handling |
| --- | --- |
| New Official FPL player | admitted by the existing validated current-core refresh; enrichment absent until separately collected/compatible |
| Player changes club | canonical assignment updates; team-dependent player enrichment becomes incompatible |
| Player leaves current FPL population | absent from current core; historical observations remain historical |
| Price/ownership changes | current core updates; unrelated enrichment is not blanket-invalidated |
| Injury/status changes | current core updates; normal calculations rerun under existing behaviour |
| Fixture postponed / event becomes TBD | official fixture identity remains canonical when supplied; fixture-dependent enrichment revalidates |
| Fixture moves Gameweek | fixture-context revision changes; old fixture-context enrichment is not used as current |
| Kickoff changes | time-sensitive fixture enrichment revalidates under its approved freshness rule |
| Double Gameweek | distinct Official FPL fixture IDs remain distinct opportunities |
| Blank Gameweek | absence of a qualifying current fixture remains explicit; no fixture is manufactured |

These are data-contract rules only. DATA-S1C-R changes no projection, fixture, expected-minutes, captaincy, squad, transfer, simulation, rank or Mini-League calculation.

## 7. Freshness and fallback

Every promoted enrichment category must define its own approved freshness rule using explicit timestamps/provenance. There is no universal enrichment TTL.

At decision time an enrichment value is usable only when it is validated, promoted for that production purpose, context-compatible and within its approved freshness/expiry contract. If any condition fails, that enrichment is omitted and Teamsheet falls back to the already-approved production baseline for that layer.

Supplemental failure must not make the canonical Official FPL application unavailable. A partial collector result must not publish a mixed generation as though it were one coherent enrichment revision.

## 8. Production read model

The production-facing contract is a **read model**, not direct access to raw shadow observations. It contains only the canonical core and explicitly promoted, compatible, freshness-valid enrichment required by approved consumers.

The application must not receive arbitrary SQL or D1 access, raw provider payloads merely because they exist in storage, source credentials or keyed URLs, quarantined observations, research-only/local-only fields, generic write capability, or a browser credential for the research store.

No production read-model endpoint or static asset is created by DATA-S1C-R.

## 9. Research access contract

Future ChatGPT/Codex/operator research access to historical DATA-S1 observations should be deliberately narrower than administrative database access. Before implementation, the proposed mechanism must satisfy this logical contract:

- server-side/operator use only; no browser credential;
- read-only capability;
- accepted observations only by default;
- required point-in-time `as_of` semantics;
- bounded page size and bounded total pagination;
- stable ordering and keyset/cursor semantics;
- allowlisted query/filter fields only;
- no arbitrary SQL, generic execute/dispatch or schema mutation;
- no ingest/write credential in a read-only research client;
- no provider secret, account secret or raw forbidden payload returned;
- safe generic failures and secret-safe diagnostics.

The exact transport is intentionally **undecided**. Service Binding RPC and a custom bearer-HTTPS API are not the forward default. If research access is needed for DATA-S2/S3 execution, choose the smallest mechanism that satisfies this contract and gate it separately.

## 10. Transport reset and historical preservation

The private RPC architecture produced useful evidence but did not achieve functional acceptance. It is now retired as the forward DATA-S1C architecture. Do not spend another checkpoint debugging nested/direct RPC merely to preserve that design.

The custom bearer-HTTPS design discussed after RPC failure is also not approved as the default forward architecture. The existence of the Worker's fixed HTTP operations does not create a requirement to expose or cut over a machine API now.

DATA-S1C-R performs **no cleanup** of the existing assets. Preserve the RPC workflow/source/configuration, existing deployed caller/target evidence, Access-protected data hostname and HTTP rollback state until a later cleanup proposal states exactly what is safe to remove and how rollback changes.

The historical RPC design is retained under `docs/historical/data-s1c-r-baseline/DATA-S1C-PRIVATE-SERVICE-BINDING-RPC.md`.

## 11. Single-file application deployment remains unchanged

Teamsheet currently has a deterministic single-file GitHub Pages deployment with build/provenance identity. DATA-S1C-R does not add `current-season.json`, `current-season.js`, a second runtime data asset, a new CSP origin or a DATA-S1 application endpoint.

If a future promoted enrichment needs delivery to the browser, compare transport options at that time against the stable read-model contract. Any change to the single-file deployment boundary requires its own explicit approval and deterministic-build/provenance design.

## 12. Evidence identity implication

If future promoted enrichment can change independently of application code, `BUILD_COMMIT`/model/rules identity alone will not fully identify what informed a decision. Before any such enrichment affects production, Stage 10 or an equivalent immutable decision record must capture the exact current-state revision and exact enrichment/read-model revision used.

DATA-S1C-R records this requirement only; it does not change the Stage 10 schema.

## 13. Forward sequence

The approved control sequence is now:

1. **DATA-S1C-R — Data Architecture Reset**: repository architecture/docs/tests only; this checkpoint.
2. **DATA-S2 — Official FPL Structured History**: collect useful Official FPL historical observations into the shadow/historical store; zero production influence unless separately approved.
3. **DATA-S3 — Official Outcomes Automation**: automate factual Official outcome/revision collection needed for evaluation; separately scoped.
4. **DATA-S4 — Supplemental Intelligence Trials**: evaluate candidate sources in shadow under rights/mapping/freshness/ablation controls; each source remains separately approval-gated.
5. **First production enrichment promotion**: only after evidence and explicit approval; implement the smallest adapter/read-model transport required by the promoted category.
6. **Later consolidation**: move more collection/server composition behind one service only if measured reliability, security or product needs justify it.

DATA-S2 remains blocked until DATA-S1C-R is reviewed, merged with explicit owner approval, and exact-merge `main` verification passes. DATA-S1C-R itself does not approve DATA-S2 implementation.

## 14. Explicit exclusions

This checkpoint does not deploy or modify Cloudflare, Worker secrets, Service Bindings, Access, D1, DNS, routes or Custom Domains; delete live rollback assets; mutate D1 data/schema; add or activate a provider; add a browser/API research credential; add a static production data asset; change CSP or the Official FPL gateway; change application source or production behaviour; change model/fixture/expected-minutes/scoring/captaincy/squad/transfer/simulation/rank/Mini-League/rival/strategy logic; change Stage 10 evidence schema; or start DATA-S2.

## 15. Limitations carried forward

- The exact future research-access transport is intentionally undecided.
- No production-enrichment transport exists because no supplemental category is currently promoted through this architecture.
- Context-revision serialization/hash details must be specified and fixture-tested in the first checkpoint that implements them; this record defines required semantics, not wire bytes.
- Rights and redistribution can independently prevent a stored research observation from appearing in any public/static production read model.
- Existing DATA-S1C RPC/live assets remain operational debt until a separately approved cleanup checkpoint.
- Existing canonical documents contain dated historical checkpoints that describe the former RPC path. They remain evidence; the current DATA-S1C-R supersession marker and this record govern forward work.

## Acceptance for this repository checkpoint

Repository acceptance requires all existing tests plus permanent DATA-S1C-R guards, production build success, deterministic exact-identity rebuilds, root/deployable equality and committed provenance verification. The diff must contain no production application or live-infrastructure behaviour change. Physical iPhone testing and live Cloudflare testing are neither required nor claimed because the approved scope has no executable product or infrastructure change.
