# Research — Availability, Injuries, Suspensions and Team News

Status: **Research complete**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§3.4, 7–8, 14  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **13 August 2026** (Step 7 zero-cost closeout; supersedes the Step 6 recommendation recorded in §21.1)

**Current conclusion: NO-GO — OFFICIAL FPL ONLY through GW1–GW5.** See §21 for the exact wording, §21.1 for the preserved Step 6 finding it supersedes, and §22 for the future evidence gate.

## 1. Research question

Which factual sources can reliably supplement Official FPL availability with injuries, suspensions and team news while preserving freshness, provenance, rights and conflict handling — and, under the owner's £0 recurring-subscription constraint, is any of them worth adding at all before the first evidence review?

## 2. Current Teamsheet behaviour

**FACT (verified against current canonical `main`).** Official FPL availability/news/status remains the production baseline. Current expected-minutes production uses Official FPL `starts` directly: aggregate `pStart` is based on cumulative `starts / completed team matches`, while detailed recent-history rows derive `started` from each row's `starts` value. The earlier Step 4 closeout statement that current production inferred starts from a `>=45-minute` minutes proxy was incorrect and is superseded by current code/tests on `main`.

**FACT.** Availability itself remains consequential: statuses `i`, `u`, `s` and `n` hard-gate `pStart`, `pAppear`, `p60` and `expMin` to zero, while `d` scales them by `chance_of_playing_next_round` (defaulting to 50% when absent). No new injury/team-news source is approved.

**FACT.** Stage 10 already freezes the exact pre-deadline decision state, including the Official FPL availability fields above, which is what a later prospective comparison needs as its immutable control.

## 3. Why this matters

Availability mistakes have asymmetric downstream consequences. A factual false high or false zero can affect xP, XI/bench order, captaincy and transfers more materially than a modest minutes error for a stable starter. First-party authority is therefore valuable, but ambiguous prose must not be converted into false numerical certainty.

**LIMITATION — do not overstate either side.** This record does not claim Official FPL availability is perfect, complete or optimally timed. It claims only that no material recurring gap has yet been demonstrated strongly enough to justify another availability layer, and that no zero-cost candidate has demonstrated enough independent incremental value to close one.

## 4. Candidate sources / repositories / approaches

Research priority remains:

1. Official FPL and first-party FPL context as the existing baseline;
2. official club websites/manager press conferences for authoritative injury/fitness statements;
3. official disciplinary/competition records for formal suspensions/ineligibility;
4. a rights-cleared structured provider for prospective factual research only.

### 4.1 Step 7 zero-cost assessment — 13 August 2026

Step 7 examined existing approved inputs, first-party Premier League/FPL material, official club and disciplinary sources, sustainable free API tiers, open datasets/repositories and public football sites under the £0 recurring-subscription constraint.

- **Official FPL — FACT.** Already integrated, already frozen in Stage 10, zero marginal cost, canonical identity, no new rights question. It is the incumbent and the comparison baseline, not a candidate to be added.
- **Official club sources — INFERENCE.** Highest potential authority for what they explicitly state, but heterogeneous across twenty clubs, frequently prose rather than structured fields, and often published as manager commentary in which fact and expectation are interleaved. Manager interpretation must stay separate from fact. Public readability does not imply permission for systematic scraping or full-text archival. These are realistically a **manual/assisted** evidence class, not an automation-ready one.
- **Official disciplinary/competition records — INFERENCE.** Potentially valuable as a narrow deterministic evidence class for accumulated bookings, red cards and formal ineligibility, where the fact is categorical rather than interpretive. Still not established here as automation-ready, and still not approved for automated integration.
- **API-Football free tier — LIMITATION.** Remains a legitimate free-tier research comparator. This pass did not establish sustainable current Premier League availability scope on the free tier, nor durable data-retention rights comparable to what Teamsheet research storage would require. **Not implementation-ready.**
- **Open datasets/community repositories — INFERENCE.** Useful for retrospective study and for prior art, but availability state at a past deadline is generally not preserved with trustworthy field-level temporal provenance, so they do not solve the pre-deadline question this branch asks.
- **Public aggregator/football sites — LIMITATION.** Coverage is often derivative of the same club statements, rights are typically unclear or restrictive, and maintenance burden falls on Teamsheet whenever a page or schema changes. No candidate in this class cleared the value/rights/maintenance gates.
- **Sportmonks and other paid providers — comparators only.** See §21.1. Under the owner constraint these are benchmarks for what a structured factual feed would look like, not pilot or implementation candidates.

**INFERENCE — the shape of the plausible gap.** If Official FPL has a genuine weakness, it is most likely narrow: earlier factual confirmation than the FPL status field carries, clearer provenance for *why* a status was set, richer first-party club detail, and deterministic suspension information. That is a plausible gap, not a measured one. No prospective evidence yet shows it is material or recurring.

Official FPL Player Notes remain a noteworthy first-party evidence class. Their exact API representation and historical/version accessibility were not established here.

No candidate is an approved production provider.

## 5. Exact fields or observations required

**PROPOSAL — applies only if a later gate approves any collection.** The minimum prospective factual record should retain only what is needed to test the hypothesis.

For a capture manifest:

- schema version and capture ID;
- source and evidence class;
- `retrievedAt` and official FPL deadline;
- season/Gameweek;
- exact Stage 10 evidence identity/hash used as the immutable production control;
- capture success/failure status;
- deterministic manifest hash.

For a factual observation row:

- canonical FPL player/team/fixture IDs plus any stable source-side identifiers;
- source record/type identifiers and category only where required to reproduce the factual normalisation;
- nullable start/end dates where supplied;
- one provider-neutral normalised factual category;
- mapping status;
- deterministic record hash.

Do not invent source publication/update timestamps that the source does not expose. `retrievedAt` is Teamsheet's epistemic timestamp.

The minimum admitted factual semantics are intentionally narrow:

- explicit injury sideline -> `UNAVAILABLE_INJURY`;
- explicit suspension/disciplinary sideline -> `UNAVAILABLE_SUSPENSION`;
- other explicit factual sideline -> `OTHER_SIDELINED`, analysed separately;
- resolved historical sideline -> secondary evidence only, never direct proof of current fitness;
- no source flag -> `NO_SOURCE_FLAG`, **not** a factual claim that the player is fit.

Ambiguous prose such as doubtful, likely fit, expected back, late fitness test, likely starter or predicted bench remains interpretation/prediction and is excluded from the minimum factual protocol.

## 6. Coverage

Research target is all active Premier League players/clubs with injury, illness, suspension, eligibility and late team-news relevance. First-party club information is authoritative but heterogeneous and unstructured; structured providers may offer broader normalisation but do not gain authority merely by republishing the same underlying fact.

**LIMITATION.** No zero-cost candidate examined in Step 7 demonstrated proven all-20-club Premier League 2026/27 coverage, including promoted-club squads, under terms Teamsheet could rely on. Coverage claims from any future candidate are approval conditions, not assumed facts.

## 7. Freshness / update cadence

Publication, source revision, Teamsheet retrieval, FPL deadline, fixture kickoff and outcome availability are distinct clocks. Canonical research timing should use UTC ISO-8601/RFC-3339 timestamps.

An observation counts as **PRE_DEADLINE** only when Teamsheet actually completes retrieval no later than the official FPL deadline. There is no discretionary grace period. A later source correction creates a new observation and never rewrites the pre-deadline record.

**LIMITATION.** No candidate examined offers a documented availability-update SLA or a reliable source-side `updated_at` for sideline state. Historical source state therefore cannot substitute for prospective `retrievedAt` evidence.

**PROPOSAL — only if a later gate approves collection.** The minimum cadence would be two independent research captures per Gameweek: approximately 24 hours before the official FPL deadline, and a final capture targeted about 10–15 minutes before the deadline, eligible only if retrieval completes before or at the deadline. Neither capture may trigger or alter Stage 10.

## 8. Reliability

Official club and competition statements have high authority for what they explicitly state, but language can remain ambiguous and later be superseded. FPL chance-of-playing values should be treated as provider indicators; this research found no authoritative evidence establishing them as empirically calibrated probabilities.

**LIMITATION.** No candidate examined establishes a contractual correctness or update guarantee for availability data. Source errors, omissions and late updates must remain visible research observations rather than being removed after outcomes are known.

Any future source trial should first measure coverage, mapping success, capture success, conflict/transition behaviour and eventual START/APPEAR/60/MINUTES outcomes before any expected-minutes candidate formula is designed.

## 9. Historical availability

Exact FPL availability/news state at a past deadline is generally **Class C — prospective capture required** unless a frozen Stage 10 snapshot or immutable timestamped archive establishes the exact vintage. Club articles may be **Class B** when publication timing is durable, but edit/version history may remain unknown. Press-conference/team-news state is often **B/C**.

Actual starts/minutes are outcome labels, not historical pre-deadline features. Gameweek-labelled data does not prove pre-deadline knowledge.

Structured third-party sideline data also requires prospective freezing for claims about what Teamsheet knew before a deadline, because source-side start/end dates do not establish when the record was actually retrievable.

## 10. Cost / free-tier constraints

**Owner constraint — FACT, 13 August 2026.** External-intelligence implementation proposals must have **£0 recurring subscription cost**. Paid providers may remain documented research comparators. A temporary free trial of a normally paid product does **not** satisfy the constraint when the intended continuing path would require payment.

**Historical Step 6 cost research — preserved.** First-party research dated 13 August 2026 found Sportmonks Football API 3.0 Starter publicly listed at **€29/month**, or **€24/month equivalent on annual billing**, before applicable VAT, with five selected leagues and published capacity far above this experiment's needs. Premier League was not part of permanent free access; a one-time 14-day paid-plan trial path was documented and requires billing attention. Under the owner constraint this is a comparator figure only — it is not a path to propose.

The minimum two-capture fixture-level plan would have been approximately:

`10 Premier League fixtures × 2 captures × 38 Gameweeks = 760 primary fixture requests/season`,

with a planning envelope of roughly **900–1,000 requests/season** allowing mapping/verification/retry overhead. Request quota was never the limiting issue; rights, incremental value and sustainable zero cost are.

Prices, VAT, trial conversion, rate limits and exact entitlements are time-sensitive and must be re-verified from first-party sources before any future proposal, even though none is proposed now.

No account creation, subscription, trial or spend is approved by this research record.

## 11. Rights / licensing / retention

Rights are a hard pre-collection gate and remain **fail-closed**.

- **First-party club pages — LIMITATION.** Public access does not imply permission for systematic scraping or full-text retention. Any future use should prefer minimum lawful normalised facts plus provenance, gathered manually or with assistance rather than by an automated collector.
- **Official disciplinary/competition records — LIMITATION.** Categorical facts are attractive, but redistribution and systematic retrieval terms were not established here.
- **API-Football — RIGHTS CLARIFICATION REQUIRED.** This pass did not establish explicit durable storage/retention permission adequate for Teamsheet research retention.
- **Sportmonks — historical finding preserved.** First-party terms reviewed on 13 August 2026 expressly permit storage of data supplied through the service and prohibit direct resale, and support building applications/products from the data. No explicit post-cancellation raw/selected/derived-data retention duration or deletion deadline was found, so provider-identifiable retention after termination remained **RIGHTS CLARIFICATION REQUIRED**. This finding stands as research history; it is not a live pilot path under the £0 constraint.

Any future minimum protocol should voluntarily avoid public redistribution of raw or source-normalised observations even where broader contractual language may permit distribution. No source response, selected fields or normalised third-party data should be committed to GitHub or exposed in the production bundle.

If acquisition/retention/derived-data rights are unresolved, the future research path must fail closed.

## 12. Security / privacy

No user-private data is expected. Credentials, paywall bypass, subscription scraping or unapproved authentication are outside this research.

**PROPOSAL — conditional on a future approval that does not exist.** Any future source token must remain server-side only, preferably sent by `Authorization` header, with a dedicated research token that can be rotated/revoked. It must never enter browser source, generated `dist/index.html`, GitHub Pages, Stage 10, exported evidence, logs, keyed URLs or public Git history. The preferred conceptual isolation boundary is a dedicated research-side service or namespace with no synchronous dependency from production refresh/recommendations. **No Worker, D1 database, R2 bucket, secret or Cloudflare configuration is approved, designed or changed here.**

Source failure, malformed data, mapping failure or research-storage failure must affect only the research capture. Production continues unchanged.

## 13. Canonical identity / mapping requirements

Canonical identity should be season-aware Official FPL identity: season + FPL player ID, season + FPL team ID, and FPL fixture ID. Stable source-side IDs should be retained as provenance.

Name matching may generate candidates only; it must not silently establish identity. Mapping status should distinguish exact/verified from conflict/unresolved states. Uncertain mappings are quarantined from metrics and production.

Transfers, promoted teams, youth players, new signings, source/FPL timing mismatches and rescheduled fixtures require explicit revalidation rather than fuzzy fallback.

## 14. Proposed provider-neutral / shadow contract

**PROPOSAL only. Nothing in this section is an approved runtime schema, store or contract.**

The minimum prospective contract would be:

`existing immutable Stage 10 production baseline`
+ `independently frozen factual sideline observation`
+ `canonical player/fixture/deadline identity`
+ `Teamsheet retrieval timing`
+ `minimal source-native type/category fields needed to reproduce normalisation`
+ `post-match Official FPL START/APPEAR/60/MINUTES truth`.

Research observations would reference the existing Stage 10 snapshot ID/hash; they would never be embedded into or mutate the production snapshot.

If any storage were ever separately approved, the recommended shape remains **research-only structured storage holding selected fields + normalised factual category + deterministic hashes**. Full raw payload archives are rejected for a minimum protocol because they add rights, duplication and operational surface without a demonstrated scientific need. **No such store is approved, and none is created by this checkpoint.**

## 15. Fallback behaviour

Official FPL availability remains the production baseline. Missing, stale, conflicting, ambiguous, rights-blocked or unavailable external evidence must not manufacture an availability state or alter production decisions.

`NO_SOURCE_FLAG` is merely absence of a qualifying record, not confirmation of fitness.

## 16. Failure modes

Rumour presented as fact, interpretation presented as probability, stale update, retraction, source conflict, ambiguous player, suspension competition mismatch, page/schema change, source outage, revision after capture, identity mismatch, rights uncertainty, post-deadline retrieval, entitlement mismatch, incomplete promoted-player coverage, unbounded maintenance burden from heterogeneous first-party pages, and accidental raw-payload retention.

## 17. Double-counting / leakage risks

FPL status, club team news, structured injury providers, predicted-lineup sites and market odds can react to the same underlying press-conference/injury information. Future evaluation must measure incremental signal conditional on the frozen production FPL baseline rather than treating different domains as independent evidence. Post-deadline confirmations must never be backfilled into pre-deadline decisions.

## 18. Validation / ablation plan

The first question is source quality and demonstrated gap, not a numerical expected-minutes adjustment.

**The Step 7 decision moves the first evaluation inside Teamsheet's own frozen evidence.** Before any external source is considered again, the GW1–GW5 Stage 10 record must be inspected for evidence that a gap exists at all. That inspection is the Availability Gap sub-gate defined in §22.2.

If — and only if — that sub-gate finds a material recurring gap, a later source trial would report:

- source-query/capture coverage;
- exact mapping success;
- capture success before deadline;
- deadline proximity based on `retrievedAt`;
- source flag rate and Official FPL flag rate;
- source/FPL conflict matrix;
- changes between the ~24h and final captures;
- eventual Official FPL START/APPEAR/>=60/MINUTES outcomes, with injury/suspension separated where counts permit.

Do not treat tactical non-appearance as proof of an availability miss and do not invent a promotion threshold. Sparse early observations require visible counts/denominators and uncertainty.

Only after a separate approval may a fixed expected-minutes candidate be designed. Anything designed using GW1–GW5 outcomes must later face untouched future Gameweeks.

## 19. Required tests

**No test change is required by this checkpoint, because no code changes.** The list below states what a future collection implementation would have to prove if it were ever separately approved:

- research enabled vs disabled leaves production projections identical;
- source success, no response, timeout, auth/rate/server errors and malformed JSON leave `pStart`, `pAppear`, `p60`, `expMin`, xP and recommendations identical;
- parser exceptions and research-storage failures cannot break normal production refresh;
- research rows present vs absent leave Stage 10 output/hash identical;
- production model/recommendation modules cannot import/read the research source/store;
- production provider allowlists remain unchanged and no research source is enabled as a production model provider — `APPROVED_PROVIDER_NAMES` remains exactly `fpl`, `understat`, `odds`, `archive`;
- Official FPL remains the sole production availability input;
- Stage 10 canonical identity/hash semantics remain unchanged;
- no credential appears in browser JS, HTML, generated artifacts or logs;
- equivalent production inputs remain deterministic and the full existing test/build/reproducibility gate still passes.

No test may be weakened merely to accommodate a research path.

## 20. Evidence required before production use

Demonstrated gap first, source second. In order: frozen GW1–GW5 Stage 10 evidence of repeated decision-relevant Official FPL availability gaps; then prospective source reliability/freshness evidence; then lawful zero-cost acquisition/retention; then canonical identity coverage; then a separately approved fixed candidate design; then untouched future evaluation demonstrating incremental expected-minutes value. Source, collection, candidate-model and production approvals remain separate gates.

A short assisted pilot may reveal schema, identity, rights and operational problems; it is not enough to validate predictive usefulness.

## 21. Current recommendation

**Research complete — NO-GO — OFFICIAL FPL ONLY through GW1–GW5. No additional factual-availability source, collector, shadow store, automation or expected-minutes mapping is recommended or approved for the initial evidence period. Official FPL remains the sole production availability input; Stage 10 remains the immutable frozen control. A narrow gap around earlier factual confirmation, clearer provenance, first-party club detail and deterministic suspension information is plausible, but no material recurring gap has yet been demonstrated, and no sustainable £0 candidate currently combines independent incremental value, rights clarity, temporal provenance and low maintenance strongly enough to justify collection. Availability is reassessed as a named sub-gate inside the existing GW5→GW6 evidence-led review, not as a new roadmap checkpoint.**

Concretely, through **GW1–GW5** there is:

- no additional availability provider;
- no new collector or scheduled job;
- no shadow storage;
- no automation of club, disciplinary or aggregator sources;
- no expected-minutes mapping from any external availability observation;
- no `pStart`, `pAppear`, `p60` or `expMin` change;
- no Stage 10 change;
- no Cloudflare, Worker, D1 or R2 change;
- no account, API key, trial or spend.

No new essential pre-GW1 evidence-preservation requirement was found. Missing early external availability observations does not invalidate later prospective research, so the production freeze remains the correct operating state.

### 21.1 Preserved Step 6 finding — superseded, not erased

**Historical FACT — recorded 13 August 2026, before the owner cost constraint.** Step 6 provider/security approval research concluded **GO WITH CONDITIONS** for Sportmonks Football API 3.0 Starter as the preferred structured candidate for a minimum factual-availability research pilot. That finding held that Sportmonks was technically the strongest researched candidate — stable identifiers, `sidelined` factual records, adequate published capacity — and that collection would nonetheless not be approval-ready until three conditions closed:

1. written clarification of post-cancellation retention/deletion obligations for selected, raw and derived data;
2. verification of Starter + Premier League 2026/27 fixture-level `sidelined` entitlement and completeness, including promoted clubs;
3. inspection of an authorised sample to confirm live type/schema semantics.

**That technical assessment is not withdrawn and is not claimed to have been wrong.** What changed is the decision frame: the owner subsequently fixed a **£0 recurring subscription cost** constraint. Sportmonks is a paid recurring service, and its documented 14-day trial is a temporary free trial of a normally paid product, which the constraint explicitly does not accept. Sportmonks is therefore **no longer a pilot or implementation candidate**; it remains a research comparator for what a structured factual availability feed would provide. The Step 6 `GO WITH CONDITIONS` recommendation is superseded by the Step 7 NO-GO above and must not be cited as a live approval path.

## 22. Explicit implementation approval gate

**Implementation remains Not approved.** Step 7A closes research/documentation only. Nothing in this record authorises a source, account, key, collector, store, Cloudflare change, model input or recommendation change.

### 22.1 Roadmap placement

[ROADMAP.md](../../ROADMAP.md) remains authoritative for the **GW5 → GW6 evidence-led review** and is unchanged by this closeout. Availability is **not** a new competing top-level roadmap checkpoint. It is nested underneath that existing review as a research sub-gate, defined below.

### 22.2 Availability Gap sub-gate — inside the existing GW5→GW6 evidence-led review

**PROPOSAL — a research question to be answered at that review; it authorises nothing by itself.**

**Question.** Does frozen GW1–GW5 Stage 10 evidence show repeated decision-relevant cases where Official FPL availability was demonstrably missing, materially late, or materially ambiguous relative to an authoritative source that was genuinely available before the deadline?

**Relevant evidence.**

- the exact frozen Stage 10 state for each affected Gameweek;
- Official FPL status, news and chance-of-playing fields as captured;
- timestamps where available, keeping publication, retrieval, deadline and kickoff as distinct clocks;
- later official START / APPEAR / >=60 / MINUTES outcomes;
- authoritative pre-deadline source evidence **only** where provenance and pre-deadline availability can be established.

**Explicitly does not count as evidence of a gap.**

- hindsight articles;
- post-deadline confirmations;
- predicted line-ups;
- rumours;
- vague manager optimism;
- one-off anecdotal misses;
- tactical non-selection treated as proof of an availability-data failure.

**Possible outcomes.**

- **A — NO MATERIAL GAP.** Remain Official FPL only and stop pursuing availability expansion. This is a legitimate and expected terminal outcome.
- **B — MATERIAL REPEATED GAP.** Prepare a separate **Manual First-Party Availability Pilot Approval** proposal for the owner. Nothing is auto-authorised by outcome B; the proposal still faces the normal gate.

### 22.3 Manual First-Party Availability Pilot — future concept only, not approved

**PROPOSAL, contingent on outcome B above. Do not implement, propose or prepare it now.** If future evidence justified it, the next possible owner gate would be tightly bounded to:

- inspecting only genuinely uncertain or FPL-flagged cases, not the whole player set;
- preferring official club and competition sources;
- retaining minimal normalised factual observations plus provenance;
- **no scraping**;
- **no automated collector**;
- **no provider subscription**;
- **no direct expected-minutes mapping**;
- **no production effect**.

Automation, shadow storage, provider registration and any expected-minutes or recommendation effect would each require their own later separate approvals after pilot evidence. A pilot approval would authorise the pilot only.


> **Dated cost-policy supersession — 22 August 2026:** The owner has superseded the blanket £0 recurring-cost constraint used when this historical research conclusion was reached. Free remains preferred where genuinely comparable; small recurring paid options may now be considered only after explicit current pricing, rights and value/cost justification, preferably through a shadow trial. The original conclusion and its historical context above are intentionally preserved. This amendment approves no provider, acquisition, subscription, retention or production use.
