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

Expected minutes are derived from Official FPL histories/availability and existing priors. Predicted line-ups are not a production input. Current `pStart` is inferred from a >=45-minute recent-minutes proxy even though FPL detailed history contains a `starts` field; that mismatch is a research finding, not approval to alter production during the freeze.

A source saying “starts” must never be converted directly into `pStart = 1`, nor absence from a predicted XI into `pStart = 0`.

## 3. Why this matters

Predicted line-ups may contain useful tactical/rotation information that factual injury status does not. They remain uncertain editorial/model predictions, can be revised near deadlines and may incorporate the same press-conference information already reflected elsewhere. Their value therefore has to be measured prospectively against the frozen production baseline.

## 4. Candidate sources / repositories / approaches

**Fantasy Football Scout (FFS) — high-value research candidate.** On 13 August 2026 its 2026/27 Team News/Predicted Line-ups product covered all 20 Premier League clubs and explicitly refined predictions as deadlines approached and after press conferences. That revision behaviour makes exact pre-deadline state preservation essential for faithful evaluation.

Other football preview/team-news sources remain possible research subjects, but this investigation did not establish enough current licensing, archive, automation and accuracy evidence to elevate them above medium/low priority.

No predicted-lineup provider is approved for collection or production use.

## 5. Exact fields or observations required

For every pre-deadline freeze: provider, source page/record, canonical/provider player and team IDs, fixture/event, prediction type (`START`, `BENCH`, `OUT`, or a genuine provider probability), source publication time, retrieval time, revision/version/hash where allowed, raw-versus-normalised designation, source age at deadline, and rights/retention classification.

After the fixture, collect actual start, appearance, minutes and whether the player reached 60 minutes.

## 6. Coverage

A useful source should repeatedly cover all Premier League clubs/fixtures, including promoted teams and missing-source cases. FFS currently provides all-20-club coverage as a research candidate, but access/product terms must be re-verified before any collection proposal.

## 7. Freshness / update cadence

Prediction revisions are scientifically material. Later revisions must never overwrite what was frozen before the FPL deadline. Source publication/update time and Teamsheet retrieval time are separate causal facts; both are required. A page fetched after the deadline cannot automatically be treated as evidence Teamsheet possessed before it.

## 8. Reliability

This investigation established no robust independent accuracy dataset for the serious predicted-lineup candidates. Self-reported provider accuracy, if encountered, is marketing evidence rather than independent validation.

Teamsheet should establish reliability itself prospectively: frozen provider prediction -> official actual XI/minutes -> provider-specific out-of-sample evaluation. Preserve sample size for every slice; do not invent a minimum threshold during research.

## 9. Historical availability

**Research conclusion:** exact predicted-XI state as seen at a deadline is **Class C — prospective evidence required** for most mutable web providers unless an immutable timestamped revision archive proves the exact vintage. A current page claiming or displaying an old prediction is not sufficient temporal provenance.

This makes predicted line-ups different from completed-match workload, which is generally reconstructible later.

## 10. Cost / free-tier constraints

FFS product/access boundaries and any subscription requirements are time-sensitive and require implementation-time re-verification. This research does not approve subscription scraping, paywall bypass or a collection mechanism.

## 11. Rights / licensing / retention

Before any collection, verify from first-party terms whether the exact pre-deadline state needed for evaluation may lawfully be automated, retained and used for research. Prediction text/feeds may have stricter rights than factual outcomes. The first source-selection question is therefore: **can Teamsheet lawfully preserve the exact pre-deadline state needed for evaluation?**

## 12. Security / privacy

No user-private data is expected. Credentials, paywall bypass and unapproved scraping are outside this record. Any future authenticated source requires separate security review.

## 13. Canonical identity / mapping requirements

Map every prediction to canonical Official FPL player/team/fixture identity, retaining stable provider IDs where available. Name-only matching is forbidden. Transfers, youth players, accents/abbreviations, duplicate names and promoted teams require explicit mapping review.

## 14. Proposed provider-neutral / shadow contract

Store an evidence observation, never a model instruction. Research-only provenance should preserve provider/source, evidence class, observation/prediction, source timestamp, `retrieved_at`, revision/version/hash where permitted, canonical/provider identities, raw-versus-normalised state, source age and rights classification.

For multiple sources, preserve disagreement rather than collapsing it prematurely. Different domains must not be assumed independent if they may derive from the same press conference or copied consensus.

## 15. Fallback behaviour

Current expected-minutes behaviour remains unchanged when predictions are absent, stale, conflicting, invalid or unavailable. A future research source failure must not affect production decisions.

## 16. Failure modes

Late edits, missing revision provenance, copied consensus across sites, ambiguous players, wrong fixture, stale prediction, source disagreement, no explicit probability, provider access/licence changes, identity mismatch and post-deadline retrieval.

## 17. Double-counting / leakage risks

Predicted line-ups may incorporate the same injuries, congestion and press-conference news reflected in FPL or factual availability sources. Future evaluation must test incremental signal conditional on the production baseline. Confirmed line-ups and later prediction revisions cannot be backfilled as if known at the FPL deadline.

## 18. Validation / ablation plan

Freeze predictions before deadlines and evaluate source-by-source and collectively against actual start, appearance, >=60 and minutes. Use start accuracy plus Brier score/calibration where genuine probabilities exist; precision/recall and disagreement subsets for categorical predictions; and analyse club, injury status, congestion and source age.

Then, only after source reliability is established, predeclare a shadow expected-minutes ablation against unchanged production. `pStart`, `pAppear`, `p60` and `expMin` must be evaluated separately. Anything designed using GW1–GW5 outcomes must later face untouched future Gameweeks.

## 19. Required tests

Future implementation would require point-in-time immutability, identity, revision handling, disagreement preservation, expiry/source-age handling, probability bounds, no binary override, missing/stale fallback, rights/provenance, network/secret isolation and structural no-production-effect tests. Production xP/XI/bench/captain/transfer outputs must remain invariant with shadow evidence enabled or disabled.

## 20. Evidence required before production use

Lawful prospective frozen predictions with reliable timestamps/revisions, enough outcomes to evaluate source behaviour transparently, predeclared shadow ablation against production and untouched future validation for any model effect. Source reliability does not itself approve expected-minutes integration.

## 21. Current recommendation

**Research complete. Predicted line-ups are the second-priority additional expected-minutes evidence class after factual availability. FFS is the clearest currently verified research candidate, but no collection or provider is approved. Prospective capture is required for most faithful evaluation; no pre-GW1 production change is justified.**

## 22. Explicit implementation approval gate

No predicted-lineup provider, prospective collection, stored evidence, shadow model or influence on expected minutes/recommendations is approved. Each transition requires a separate evidence-led proposal and Pritesh's explicit approval.