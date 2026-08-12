# GW1 Research Evidence Readiness

Status: **Awaiting evidence**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§9, 12–13, 15  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **12 August 2026 foundation conclusions; branch-specific evidence pending**

## 1. Research question

Which decision-time evidence cannot be reconstructed later, what is already captured by current Stage 10, and what must be verified during the genuine GW1 pre-deadline window so later research remains possible?

## 2. Current Teamsheet behaviour

Current Stage 10 pre-deadline evidence already preserves the normalised provider inputs that actually affected a prediction, including accepted derived Odds fixture inputs when Odds is healthy. Local capture/recovery/owner-controlled export remains the operating evidence path on merged `main`; PR #119 cloud custody is a separate unmerged/acceptance-incomplete stream and is not required to produce the local record.

## 3. Why this matters

Some decision-time market/news/lineup information is ephemeral. Once GW1 passes, missing point-in-time evidence can make later evaluation impossible or force weaker hindsight approximations.

## 4. Candidate sources / repositories / approaches

This branch is evidence-readiness, not provider selection. Start with current Stage 10 and the Foundation's irreconstructibility analysis. Any additional ephemeral source needs its own research/provider approval before collection.

## 5. Exact fields or observations required

For current production evaluation: frozen snapshot identity/hash, deadline/Gameweek, capture/clock provenance, provider state, accepted normalised inputs actually used, transform/model/rules identity and owner export. Later outcomes/corrections link to the frozen record without rewriting it.

For optional future market research, raw bookmaker quotes/intraday movement are **not** currently preserved and cannot be assumed reconstructible on the free tier.

## 6. Coverage

Immediate scope: the genuine GW1 pre-deadline production decision state. Later programme evidence should extend across enough Gameweeks for the planned GW5→GW6 review and untouched future validation.

## 7. Freshness / update cadence

Use the existing Stage 10 eligibility/timing rules. A late/post-deadline record remains evidence but cannot be promoted as if it were the official pre-deadline decision snapshot.

## 8. Reliability

Verify record hash/identity, timing grade, provider provenance and export integrity. A provider marked fallback/unavailable is truthful evidence of that state, not a failed experiment to be replaced retrospectively.

## 9. Historical availability

Known Foundation conclusion: normalised Odds inputs used by production are prospectively available through ordinary Stage 10 capture when healthy; individual bookmaker prices, intraday line movement and other raw-quotation transforms are not retained and are not reconstructible later on the current free plan. Predicted-lineup/team-news historical availability remains branch-specific/TBD.

## 10. Cost / free-tier constraints

No new collection spend is approved. Current free-tier/provider limits remain as documented and must be re-verified before any expansion.

## 11. Rights / licensing / retention

Local capture/export remains subject to current canonical contracts. Permanent provider-derived cloud retention stays fail-closed where rights are unresolved. Do not alter the canonical record to make it archivable.

## 12. Security / privacy

Exports remain complete, unencrypted and owner-controlled. No provider key/keyed URL, manager/team identifier or forbidden secret may enter the canonical evidence record.

## 13. Canonical identity / mapping requirements

Preserve exact snapshot/model/rules/provider/fixture/player identities and hashes. Do not reconstruct missing records by name matching after the event.

## 14. Proposed provider-neutral / shadow contract

No new shadow contract is implemented here. Future ephemeral observations should use the Shadow Architecture branch/Foundation contract and remain isolated from production.

## 15. Fallback behaviour

If Odds or another approved optional provider is unavailable during capture, retain the truthful frozen fallback/unavailable state and existing production fallback. Do not run an emergency unapproved provider/model change merely to improve the record.

## 16. Failure modes

Missed capture, late capture, clock conflict, provider unavailable/stale, export not retained, corrupt/tampered record, incomplete provider provenance and confusing cloud-custody failure with local evidence failure.

## 17. Double-counting / leakage risks

Never backfill later odds, lineups, injuries, confirmed results or corrected facts into the pre-deadline snapshot. Later outcomes are linked downstream for evaluation only.

## 18. Validation / ablation plan

Use frozen pre-deadline records to run the Foundation's predeclared variants where supported. GW1–GW5 is evidence collection, not a standalone validation sample. Anything designed using those Gameweeks must face untouched later Gameweeks.

## 19. Required tests

Existing Stage 10 snapshot/storage/hash/timing/provenance tests remain authoritative. No new runtime test is required by this documentation branch. Future new capture fields/sources need schema, privacy, timing, rights and no-production-effect tests.

## 20. Evidence required before production use

A genuine eligible GW1 pre-deadline capture/export with truthful provider state, followed by completed/corrected Official FPL outcomes and enough later observations for the planned evaluation. This evidence may support a proposal; it does not auto-approve a change.

## 21. Current recommendation

**Await genuine evidence. Preserve the pre-GW1 code freeze. Use the existing Stage 10 capture/export path and verify provenance/timestamps rather than adding emergency collection code.**

## 22. Explicit implementation approval gate

No additional source collection, raw Odds archival, production shadow store or model/provider change is authorised by evidence-readiness planning. Each requires separate approval.