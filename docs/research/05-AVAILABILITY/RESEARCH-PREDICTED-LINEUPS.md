# Research — Predicted Line-ups and Start Probability

Status: **Research complete**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§3.4, 11–12, 14  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **13 August 2026**

## 1. Research question

Can predicted-lineup sources provide useful calibrated evidence for `pStart`, `pAppear`, `p60` and `expMin`, and how should multiple-source disagreement be represented?

## 2. Current Teamsheet behaviour

Expected minutes are derived from Official FPL histories/availability and existing priors. Predicted line-ups are not a production input.

Current production already uses Official FPL `starts` directly: aggregate `pStart` is based on cumulative starts and detailed recent-history rows derive `started` from each row's `starts` value. The earlier Step 4 closeout statement that current production inferred starts from a `>=45-minute` minutes proxy was incorrect and is superseded by current code/tests on `main`. There is therefore no current `>=45 proxy versus starts` prospective experiment to run.

A source saying “starts” must never be converted directly into `pStart = 1`, nor absence from a predicted XI into `pStart = 0`.

## 3. Why this matters

Predicted line-ups may contain useful tactical/rotation information that factual injury status does not. They remain uncertain editorial/model predictions, can be revised near deadlines and may incorporate the same press-conference information already reflected elsewhere. Their value therefore has to be measured prospectively against the exact frozen production baseline.

## 4. Candidate sources / repositories / approaches

Focused Step 5 research refined the candidate position:

- **Fantasy Football Scout (FFS):** high-value editorial prior art with all-20-club predicted line-ups and deadline-near revisions, but current terms reviewed on 13 August 2026 prohibit mass/systematic automated extraction and creating another electronic database from site material without permission. **Not currently suitable for systematic Teamsheet prospective collection without permission.**
- **Sportmonks:** structured line-up data can distinguish predictive from confirmed line-up state and may be useful in an expanded future protocol. First-party terms are materially clearer on API-data storage than API-Football's, but this does not approve collection or a predicted-lineup experiment.
- **API-Football:** useful for official/near-kickoff line-ups and outcomes, but not established here as a genuine FPL-deadline predicted-XI product; provider rights remain clarification-gated for retained Teamsheet research data.

No predicted-lineup provider is approved for collection or production use.

## 5. Exact fields or observations required

For every prospective prediction observation retain only what is necessary:

- provider/source identity;
- canonical and provider player/team/fixture IDs;
- categorical state `START`, `BENCH`, `NOT_LISTED` or `UNKNOWN`, or a genuine published source probability;
- source publication time where supplied;
- source revision time/version where observable;
- `retrieved_at`;
- FPL deadline and fixture kickoff;
- mapping status;
- raw-versus-normalised designation;
- rights/retention classification;
- retained-record hash.

Do not manufacture probabilities where a source publishes only an XI.

## 6. Coverage

A useful source should repeatedly cover all Premier League clubs/fixtures, including promoted teams and missing-source cases. Coverage and source-age statistics must remain visible rather than silently excluding missing predictions.

## 7. Freshness / update cadence

Prediction revisions are scientifically material. Preserve every **distinct observed state** rather than every poll response. This permits three derived views with little storage: first observed state, all distinct revisions and last pre-deadline state.

A prediction counts as pre-deadline evidence only if Teamsheet actually retrieved the frozen state no later than the official FPL deadline. A page fetched after the deadline cannot be promoted to pre-deadline evidence because it claims an earlier publication time.

Later revisions create new observations and never overwrite the earlier frozen state.

## 8. Reliability

This investigation established no robust independent accuracy dataset for the serious predicted-lineup candidates. Self-reported provider accuracy, if encountered, is marketing evidence rather than independent validation.

Teamsheet should establish reliability itself prospectively: frozen provider prediction -> official actual XI/minutes -> provider-specific out-of-sample evaluation. Preserve sample size and coverage for every slice; do not invent a minimum threshold during research.

Categorical XI sources should first be evaluated with categorical diagnostics such as confusion matrices, starter precision/recall, coverage and revision behaviour. Brier/log-loss analysis is appropriate only when a source genuinely supplies probabilities or a later separately approved protocol pre-registers a probability mapping.

## 9. Historical availability

**Research conclusion:** exact predicted-XI state as seen at a deadline is **Class C — prospective evidence required** for most mutable providers unless an immutable timestamped revision archive proves the exact vintage. A current page claiming or displaying an old prediction is not sufficient temporal provenance.

This remains materially different from completed-match workload, which is generally reconstructible later.

## 10. Cost / free-tier constraints

FFS access/subscription boundaries are time-sensitive, but rights—not headline price—currently block systematic Teamsheet capture without permission. Sportmonks PL access appears to require trial or paid coverage and must be re-verified before any provider proposal. No subscription/account/spend is approved here.

## 11. Rights / licensing / retention

Rights are a hard pre-collection gate.

- **FFS:** current first-party terms reviewed on 13 August 2026 permit limited personal/non-commercial copying with acknowledgement but prohibit mass/systematic automated extraction and creation/inclusion in another electronic database without permission. A repeated GW-by-GW Teamsheet research store should therefore not proceed without explicit permission. **RIGHTS CLARIFICATION REQUIRED.**
- **Sportmonks:** provider-contract terms are materially clearer for API-data storage, but exact subscribed features, Premier League entitlement, retention and current terms still require implementation-time re-verification.
- **API-Football:** provider functionality does not itself grant rights to retain/use Premier League-derived data; **RIGHTS CLARIFICATION REQUIRED**.

Public accessibility is not an automation/retention licence.

## 12. Security / privacy

No user-private data is expected. Credentials, paywall bypass and unapproved scraping are outside this record. Any future authenticated source requires separate security review and server-side secret handling.

## 13. Canonical identity / mapping requirements

Map every prediction to season-aware canonical Official FPL player/team/fixture identity, retaining stable provider IDs where available. Name-only matching is forbidden. Mapping status should distinguish `EXACT_CROSSWALK`, `MANUALLY_VERIFIED`, `CONFLICT` and `UNRESOLVED`; uncertain mappings are quarantined from metrics and production.

## 14. Proposed provider-neutral / shadow contract

Store an evidence observation, never a model instruction. Research-only provenance should preserve provider/source, evidence class, prediction, source publication/revision timing, `retrieved_at`, FPL deadline, canonical/provider identities, raw-versus-normalised state, mapping status and rights classification.

The safest linkage is from the isolated research record to the existing Stage 10 snapshot ID/hash. Do not modify the production snapshot merely to embed experimental evidence.

For multiple sources, preserve disagreement rather than collapsing it prematurely. Different domains must not be assumed independent if they may derive from the same press conference or copied consensus.

## 15. Fallback behaviour

Current expected-minutes behaviour remains unchanged when predictions are absent, stale, conflicting, invalid, rights-blocked or unavailable. A future research source failure must not affect production decisions.

## 16. Failure modes

Late edits, missing revision provenance, copied consensus across sites, ambiguous players, wrong fixture, stale prediction, source disagreement, no explicit probability, provider access/licence changes, identity mismatch, rights uncertainty and post-deadline retrieval.

## 17. Double-counting / leakage risks

Predicted line-ups may incorporate the same injuries, congestion and press-conference news reflected in FPL or factual availability sources. Future evaluation must test incremental signal conditional on the exact production baseline. Confirmed line-ups and later prediction revisions cannot be backfilled as if known at the FPL deadline.

## 18. Validation / ablation plan

Predicted line-ups remain the **expanded protocol**, not the first prospective evidence test. First establish the minimum factual-availability protocol operationally and scientifically.

If predicted-lineup collection is later separately approved, freeze lawful predictions before deadlines and evaluate source behaviour against actual START/APPEAR/60/MINUTES outcomes. For categorical XI sources, use categorical diagnostics; use Brier/calibration/log loss only for genuine probabilities or a separately pre-registered mapping. Then, only after source reliability is established, predeclare a shadow expected-minutes candidate against unchanged Stage 10 production.

Anything designed using GW1–GW5 outcomes must later face untouched future Gameweeks.

## 19. Required tests

Any future implementation would require point-in-time immutability, identity quarantine, revision handling, disagreement preservation, source-age/deadline enforcement, probability bounds, no binary override, missing/stale fallback, rights fail-closed behaviour, network/secret isolation and structural no-production-effect tests.

Production xP/XI/bench/captain/transfer outputs must remain invariant with research evidence enabled or disabled.

## 20. Evidence required before production use

Lawful prospective frozen predictions with reliable timestamps/revisions, enough outcomes to characterise source behaviour honestly, a separately approved fixed expected-minutes candidate, and untouched future validation. Source reliability does not itself approve expected-minutes integration.

## 21. Current recommendation

**Research complete. Predicted line-ups remain the second-priority expected-minutes evidence class after factual availability, but systematic FFS collection is not currently suitable without permission. Do not start a predicted-lineup collector in the minimum protocol. Any expanded protocol needs a rights-cleared source, prospective revision capture and a separate owner approval. No pre-GW1 production change is justified.**

## 22. Explicit implementation approval gate

No predicted-lineup provider, account/subscription, prospective collection, stored evidence, shadow model or influence on expected minutes/recommendations is approved. Each transition requires a separate evidence-led proposal and Pritesh's explicit approval.