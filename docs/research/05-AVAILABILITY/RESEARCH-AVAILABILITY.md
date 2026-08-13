# Research — Availability, Injuries, Suspensions and Team News

Status: **Research complete**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§3.4, 7–8, 14  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **13 August 2026**

## 1. Research question

Which factual sources can reliably supplement Official FPL availability with injuries, suspensions and team news while preserving freshness, provenance, rights and conflict handling?

## 2. Current Teamsheet behaviour

Official FPL availability/news/status remains the production baseline. Current expected-minutes production uses Official FPL `starts` directly: aggregate `pStart` is based on cumulative `starts / completed team matches`, while detailed recent-history rows derive `started` from each row's `starts` value. The earlier Step 4 closeout statement that current production inferred starts from a `>=45-minute` minutes proxy was incorrect and is superseded by current code/tests on `main`.

Availability itself remains consequential: statuses `i`, `u`, `s` and `n` hard-gate `pStart`, `pAppear`, `p60` and `expMin` to zero, while `d` scales them by `chance_of_playing_next_round` (defaulting to 50% when absent). No new injury/team-news source is approved.

## 3. Why this matters

Availability mistakes have asymmetric downstream consequences. A factual false high or false zero can affect xP, XI/bench order, captaincy and transfers more materially than a modest minutes error for a stable starter. First-party authority is therefore valuable, but ambiguous prose must not be converted into false numerical certainty.

## 4. Candidate sources / repositories / approaches

Research priority remains:

1. Official FPL and first-party FPL context as the existing baseline;
2. official club websites/manager press conferences for authoritative injury/fitness statements;
3. official disciplinary/competition records for formal suspensions/ineligibility;
4. a rights-cleared structured provider for prospective factual research only.

Focused Step 5 and Step 6 provider research found:

- **Sportmonks — preferred structured research candidate, conditional:** Football API 3.0 Starter is the strongest currently researched minimum factual-availability candidate. First-party terms reviewed on 13 August 2026 expressly permit storage of service-supplied data while prohibiting direct resale, but post-termination retention duration is not explicit. Exact Premier League 2026/27 `sidelined` entitlement/completeness and the live type/schema semantics must be verified under an authorised account before any collection approval.
- **API-Football — technically capable but rights-unclear:** first-party functionality covers injuries and stable football IDs at a lower headline price, but this research did not establish a comparably explicit storage/retention right. Durable Teamsheet research retention therefore remains **RIGHTS CLARIFICATION REQUIRED**.
- **Official club/disciplinary sources — high authority but operationally heterogeneous:** suitable for tightly scoped manual research where lawful, but public readability does not approve scraping or full-text archival.

Official FPL Player Notes remain a noteworthy first-party evidence class. Their exact API representation and historical/version accessibility were not established here.

No candidate is an approved production provider.

## 5. Exact fields or observations required

The minimum prospective factual record should retain only what is needed to test the hypothesis.

For a capture manifest:

- schema version and capture ID;
- provider and evidence class;
- `retrievedAt` and official FPL deadline;
- season/Gameweek;
- exact Stage 10 evidence identity/hash used as the immutable production control;
- capture success/failure status;
- deterministic manifest hash.

For a factual observation row:

- canonical FPL player/team/fixture IDs plus provider player/team/fixture IDs;
- provider sideline record/type identifiers and category only where required to reproduce the factual normalisation;
- nullable provider start/end dates where supplied;
- one provider-neutral normalised factual category;
- mapping status;
- deterministic record hash.

Do not invent provider publication/update timestamps that the provider does not expose. `retrievedAt` is Teamsheet's epistemic timestamp.

The minimum admitted factual semantics are intentionally narrow:

- explicit injury sideline -> `UNAVAILABLE_INJURY`;
- explicit suspension/disciplinary sideline -> `UNAVAILABLE_SUSPENSION`;
- other explicit factual sideline -> `OTHER_SIDELINED`, analysed separately;
- resolved historical sideline -> secondary evidence only, never direct proof of current fitness;
- no provider sideline record -> `NO_PROVIDER_FLAG`, **not** a factual claim that the player is fit.

Ambiguous prose such as doubtful, likely fit, expected back, late fitness test, likely starter or predicted bench remains interpretation/prediction and is excluded from the minimum factual protocol.

## 6. Coverage

Research target is all active Premier League players/clubs with injury, illness, suspension, eligibility and late team-news relevance. First-party club information is authoritative but heterogeneous and unstructured; structured providers may offer broader normalisation but do not gain authority merely by republishing the same underlying fact.

Sportmonks publicly markets Premier League coverage and Starter permits selected leagues, but public evidence does not prove account-specific 2026/27 Premier League entitlement, all-20-club sideline completeness or promoted-player completeness. Those are approval conditions, not assumed facts.

## 7. Freshness / update cadence

Publication, source revision, Teamsheet retrieval, FPL deadline, fixture kickoff and outcome availability are distinct clocks. Canonical research timing should use UTC ISO-8601/RFC-3339 timestamps.

An observation counts as **PRE_DEADLINE** only when Teamsheet actually completes retrieval no later than the official FPL deadline. There is no discretionary grace period. A later source correction creates a new observation and never rewrites the pre-deadline record.

Sportmonks did not provide an injury-specific SLA or a documented sideline `updated_at` field in the Step 6 research. Historical provider state therefore cannot substitute for prospective `retrievedAt` evidence.

The minimum proposed cadence is two independent research captures per Gameweek:

1. approximately 24 hours before the official FPL deadline;
2. a final capture targeted about 10–15 minutes before the deadline, eligible only if the response completes before or at the deadline.

Neither capture may trigger or alter Stage 10.

## 8. Reliability

Official club and competition statements have high authority for what they explicitly state, but language can remain ambiguous and later be superseded. FPL chance-of-playing values should be treated as provider indicators; this research found no authoritative evidence establishing them as empirically calibrated probabilities.

Sportmonks advertises strong uptime/reliability, but the reviewed material does not establish a contractual injury-data correctness or update SLA and its terms do not guarantee completeness. Provider errors, omissions and late updates must therefore remain visible research observations rather than being removed after outcomes are known.

A future source trial should first measure coverage, mapping success, capture success, conflict/transition behaviour and eventual START/APPEAR/60/MINUTES outcomes before any expected-minutes candidate formula is designed.

## 9. Historical availability

Exact FPL availability/news state at a past deadline is generally **Class C — prospective capture required** unless a frozen Stage 10 snapshot or immutable timestamped archive establishes the exact vintage. Club articles may be **Class B** when publication timing is durable, but edit/version history may remain unknown. Press-conference/team-news state is often **B/C**.

Actual starts/minutes are outcome labels, not historical pre-deadline features. Gameweek-labelled data does not prove pre-deadline knowledge.

Sportmonks factual sideline data also requires prospective freezing for claims about what Teamsheet knew before a deadline because provider-side start/end dates do not establish when the record was actually retrievable.

## 10. Cost / free-tier constraints

Step 6 first-party research dated 13 August 2026 found Sportmonks Football API 3.0 Starter publicly listed at **€29/month**, or **€24/month equivalent on annual billing**, before applicable VAT, with five selected leagues and published capacity far above this experiment's needs. Premier League is not part of the permanent free access; a one-time 14-day paid-plan trial path was documented and requires billing attention.

The minimum two-capture fixture-level plan is approximately:

`10 Premier League fixtures × 2 captures × 38 Gameweeks = 760 primary fixture requests/season`.

Allowing mapping/verification/retry overhead, a planning envelope of roughly **900–1,000 requests/season** is sufficient. API quota is not the limiting issue.

Price, VAT, trial conversion, rate limits and exact current entitlements are time-sensitive and must be re-verified immediately before any owner account approval.

No account creation, subscription or spend is approved by this research record.

## 11. Rights / licensing / retention

Rights are a hard pre-collection gate.

- **Sportmonks:** first-party terms reviewed on 13 August 2026 expressly permit storage of data supplied through the service and prohibit direct resale. The terms also support building applications/products from the data. However, no explicit post-cancellation raw/selected/derived-data retention duration or deletion deadline was found. **RIGHTS CLARIFICATION REQUIRED** before claiming continued provider-identifiable retention after termination.
- **API-Football:** technical API access and lower headline pricing do not resolve the absence of comparably explicit durable storage/retention permission found in this pass. **RIGHTS CLARIFICATION REQUIRED** before Teamsheet durably stores observations.
- **First-party club pages:** public access does not imply permission for systematic scraping or full-text retention. Prefer minimum lawful normalised facts plus provenance.

The minimum protocol should voluntarily avoid public redistribution of raw/provider-normalised observations even where broader contractual language may permit distribution. No provider response, selected fields or normalised provider data should be committed to GitHub or exposed in the production bundle.

Before any account/pilot approval, obtain written Sportmonks confirmation covering post-cancellation retention of the selected factual fields, provider-neutral derived rows/hashes and any required deletion period.

If acquisition/retention/derived-data rights are unresolved, the future research path must fail closed.

## 12. Security / privacy

No user-private data is expected. Credentials, paywall bypass, subscription scraping or unapproved authentication are outside this research.

Any future Sportmonks token must remain server-side only, preferably sent by `Authorization` header, with a dedicated research token that can be rotated/revoked. It must never enter browser source, generated `dist/index.html`, GitHub Pages, Stage 10, exported evidence, logs, keyed URLs or public Git history.

The preferred conceptual isolation boundary is a dedicated/research-side Cloudflare service or namespace that has no synchronous dependency from production refresh/recommendations. This is a design proposal only; no Worker, D1 database, secret or Cloudflare configuration is approved here.

Provider failure, malformed data, mapping failure or research-storage failure must affect only the research capture. Production continues unchanged.

## 13. Canonical identity / mapping requirements

Canonical identity should be season-aware Official FPL identity: season + FPL player ID, season + FPL team ID, and FPL fixture ID. Stable provider IDs should be retained as provenance.

Name matching may generate candidates only; it must not silently establish identity. Mapping status should distinguish exact/verified from conflict/unresolved states. Uncertain mappings are quarantined from metrics and production.

Transfers, promoted teams, youth players, new signings, provider/FPL timing mismatches and rescheduled fixtures require explicit revalidation rather than fuzzy fallback.

## 14. Proposed provider-neutral / shadow contract

The minimum prospective contract is:

`existing immutable Stage 10 production baseline`
+ `independently frozen Sportmonks factual sideline observation`
+ `canonical player/fixture/deadline identity`
+ `Teamsheet retrieval timing`
+ `minimal provider-native type/category fields needed to reproduce normalisation`
+ `post-match Official FPL START/APPEAR/60/MINUTES truth`.

Research observations should reference the existing Stage 10 snapshot ID/hash; they should not be embedded into or mutate the production snapshot.

Recommended future storage, if separately approved, is **research-only D1 with selected structured fields + normalised factual category + deterministic hashes**. Full raw Sportmonks payloads and an R2 raw-response archive are rejected for the minimum protocol because they add rights, duplication and operational surface without a demonstrated scientific need.

This remains a conceptual research contract, not an approved runtime schema or store.

## 15. Fallback behaviour

Official FPL availability remains the production baseline. Missing, stale, conflicting, ambiguous, rights-blocked or unavailable external evidence must not manufacture an availability state or alter production decisions.

`NO_PROVIDER_FLAG` is merely absence of a qualifying provider record, not confirmation of fitness.

## 16. Failure modes

Rumour presented as fact, interpretation presented as probability, stale update, retraction, source conflict, ambiguous player, suspension competition mismatch, page/schema change, provider outage, revision after capture, identity mismatch, rights uncertainty, post-deadline retrieval, account entitlement mismatch, incomplete promoted-player coverage and accidental raw-payload retention.

## 17. Double-counting / leakage risks

FPL status, club team news, structured injury providers, predicted-lineup sites and market odds can react to the same underlying press-conference/injury information. Future evaluation must measure incremental signal conditional on the frozen production FPL baseline rather than treating different domains as independent evidence. Post-deadline confirmations must never be backfilled into pre-deadline decisions.

## 18. Validation / ablation plan

The first protocol question is source quality, not a numerical expected-minutes adjustment.

The pre-registered primary question is whether an explicit, prospectively retrieved provider sideline flag supplies factual information not already represented in frozen Official FPL/Stage 10 availability state.

Initial evaluation should report:

- provider-query/capture coverage;
- exact mapping success;
- capture success before deadline;
- deadline proximity based on `retrievedAt`;
- provider flag rate and Official FPL flag rate;
- provider/FPL conflict matrix;
- changes between the ~24h and final captures;
- eventual Official FPL START/APPEAR/>=60/MINUTES outcomes, with injury/suspension separated where counts permit.

Do not treat tactical non-appearance as proof of an injury miss and do not invent a provider-promotion threshold. Sparse early observations require visible counts/denominators and uncertainty.

Only after a separate approval may a fixed expected-minutes candidate be designed. Anything designed using GW1–GW5 outcomes must later face untouched future Gameweeks.

## 19. Required tests

Any future collection implementation would require, at minimum, structural tests proving:

- research enabled vs disabled leaves production projections identical;
- provider success, no response, timeout, auth/rate/server errors and malformed JSON leave `pStart`, `pAppear`, `p60`, `expMin`, xP and recommendations identical;
- provider parser exceptions and D1 failures cannot break normal production refresh;
- research rows present vs absent leave Stage 10 output/hash identical;
- production model/recommendation modules cannot import/read the research provider/store;
- production provider allowlists remain unchanged and Sportmonks is not enabled as a production model provider;
- Official FPL remains the sole production availability input;
- Stage 10 canonical identity/hash semantics remain unchanged;
- no Sportmonks credential appears in browser JS, HTML, generated artifacts or logs;
- equivalent production inputs remain deterministic and the full existing test/build/reproducibility gate still passes.

No test may be weakened merely to accommodate the research path.

## 20. Evidence required before production use

Prospective source reliability/freshness evidence, lawful acquisition/retention, canonical identity coverage, a separately approved fixed candidate design, and untouched future evaluation demonstrating incremental expected-minutes value. Provider, collection, candidate-model and production approvals remain separate gates.

A two-to-three-Gameweek assisted pilot may reveal schema, entitlement, mapping and operational problems; it is not enough to validate predictive usefulness.

## 21. Current recommendation

**Research complete — GO WITH CONDITIONS. Sportmonks Football API 3.0 Starter remains the preferred structured candidate for a minimum factual-availability research pilot, but collection implementation is not approval-ready. Before any account/pilot or implementation action, close the post-termination retention/derived-data rights question, verify exact Premier League 2026/27 fixture-level `sidelined` entitlement, and inspect an authorised sample to confirm the live type/schema semantics. No provider activation, collection, Worker/D1 code, expected-minutes mapping or pre-GW1 production change is approved.**

No new essential pre-GW1 evidence-preservation requirement was found. Missing early Sportmonks observations does not invalidate later prospective research, so the production freeze remains the correct operating state.

## 22. Explicit implementation approval gate

**Implementation remains Not approved.** Step 6A closes research/documentation only.

The next possible owner gate is **Sportmonks Due-Diligence + Assisted Pilot Approval**, bounded to:

1. obtaining written Sportmonks clarification on post-cancellation selected/raw/derived-data retention and deletion obligations;
2. verifying Starter + Premier League 2026/27 fixture-level sideline entitlement/coverage;
3. once those conditions are satisfactory, separately approving one dedicated research account/trial or monthly subscription;
4. conducting a short two-to-three-Gameweek assisted/manual pilot using only the pre-registered selected fields and two-capture cadence;
5. preserving zero production effect, no public redistribution and no Stage 10/model/provider-registry change.

That gate does **not** approve collection code, an automated Worker/D1 pipeline, a production provider, predicted line-ups, workload acquisition, expected-minutes formulas or recommendation changes. Automated shadow collection requires a later separate implementation approval after pilot evidence.