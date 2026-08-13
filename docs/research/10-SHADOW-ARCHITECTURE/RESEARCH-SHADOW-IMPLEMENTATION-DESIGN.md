# Research — Shadow Implementation Design

Status: **Planned**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§4–6, 10, 14  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **TBD**

## 1. Research question

What exact provider-neutral observation, identity, provenance, rights and storage design would let Teamsheet collect/evaluate external intelligence while structurally proving zero effect on production recommendations?

## 2. Current Teamsheet behaviour

No external-intelligence shadow store exists. Runtime provider identity remains the approved closed set. The Foundation defines the future observation categories, timing fields, canonical Official FPL identity, rights classifications and hard `shadow_only` boundary.

## 3. Why this matters

Research data needs a durable, reviewable contract before multiple sources are explored. Without structural isolation, experimental facts could accidentally influence Provider Health or model state before evidence/approval.

## 4. Candidate sources / repositories / approaches

Planned: provider-neutral observation envelope from the Foundation; possible storage/research-access arrangements consistent with D1/security constraints. **No production storage technology is approved by this branch.**

## 5. Exact fields or observations required

At minimum Foundation fields for identity, metric/value/unit, `observedAt`, `effectiveAt`, `fetchedAt`, expiry, source/provenance, quality/conflict, rights/retention/redistribution/attribution and `mode: shadow_only|production_eligible`.

## 6. Coverage

TBD across registered research categories while avoiding provider-specific schema leakage into consumers.

## 7. Freshness / update cadence

Per observation/category, not a universal cadence. Timing must support point-in-time replay and stale/conflict decisions.

## 8. Reliability

TBD: validation rules, conflict handling, rejected-observation retention and provenance completeness.

## 9. Historical availability

The architecture must explicitly distinguish prospective observations from reconstructible historical facts; it must not imply missing point-in-time history exists.

## 10. Cost / free-tier constraints

TBD. Storage/collection cost is a later implementation concern and cannot justify weakening rights or evidence contracts.

## 11. Rights / licensing / retention

Foundation classifications govern: `durable_allowed`, `attribution_required`, `local_research_only`, `durable_blocked`, `unknown_fail_closed`. Unknown must fail closed.

## 12. Security / privacy

No API key, keyed URL, cookie, token, account identifier or unnecessary personal/user data in shadow records. Raw payloads transient by default. Research failures must not leak raw provider errors to users.

## 13. Canonical identity / mapping requirements

Official FPL IDs are canonical where applicable. Team/player/fixture/competition mapping must be explicit, versioned/reviewed and never display-name-only.

## 14. Proposed provider-neutral / shadow contract

Foundation §4 is the starting contract, not implementation approval. Detailed schema/versioning/storage/access design remains TBD. First runtime version, if separately approved, must be `shadow_only` with no model/provider-state read path.

## 15. Fallback behaviour

Shadow acquisition/storage failure has **no production fallback consequence** because production must not depend on the shadow layer. Research UI/tools, if ever approved, must report missing evidence honestly.

## 16. Failure modes

Identity mismatch, ambiguous timing, stale/conflicting observations, rights change, partial write, schema migration, source removal, secret contamination and accidental production imports.

## 17. Double-counting / leakage risks

Store category/source provenance so later experiments can detect overlap. Point-in-time query/replay must prevent post-deadline observations entering pre-deadline variants.

## 18. Validation / ablation plan

Architecture validation comes first: prove structural non-influence before measuring predictive value. Later branch-specific ablations use frozen observations against unchanged production.

## 19. Required tests

A future implementation proposal must include structural tests proving production model modules do not import the shadow store; production outputs are identical with shadow absent/present/stale/malformed/conflicting; shadow failures cannot change Provider Health; shadow writes cannot mutate `S` production inputs; storage failure cannot block verified refresh/recommendations; unknown rights fail closed; secrets/keyed URLs are rejected; display-name-only mapping is rejected.

## 20. Evidence required before production use

For the shadow foundation itself: complete contract/security/rights/storage design and structural isolation tests. For any later production use: separate branch-specific prospective evidence plus separate approval.

## 21. Current recommendation

**Planned. Preserve the Foundation contract and design the detailed shadow implementation before writing runtime code.**

## 22. Explicit implementation approval gate

This research file does not approve a production shadow store. A separate exact implementation proposal and Pritesh approval are mandatory before code.