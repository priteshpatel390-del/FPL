# GW1 Research Evidence Readiness

Status: **Research complete**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§9, 12–13, 15  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **13 August 2026**

## 1. Research question

Which decision-time evidence cannot be reconstructed later, what is already captured by current Stage 10, and what must be preserved during the genuine GW1 pre-deadline window so later evaluation remains scientifically useful without hindsight leakage?

## 2. Current Teamsheet behaviour

The current merged evidence path is:

`live provider state -> validated in-memory model inputs -> model calculations -> Stage 10 pre-deadline capture -> canonical JSON -> section hashes + whole-record SHA-256 -> verified browser storage -> owner-triggered JSON export`

Stage 10 freezes the normalised production state actually used at decision time, including official FPL inputs, provider health/fallback state, accepted normalised supporting-provider inputs, expected-minutes estimates, projections, uncertainty, squad/decision output, model/rules/build identity, timing evidence and cryptographic hashes.

Local capture/recovery/owner-controlled export remains the accepted operating path on merged `main`. PR #119, GW1-P2 Browser Evidence Delivery and Durable Outbox, is a separate unmerged acceptance stream that can improve custody but is not required to create a scientifically useful local Stage 10 record.

## 3. Why this matters

Some decision-time information is mutable or ephemeral. If it is not frozen prospectively, later analysis can accidentally substitute hindsight for what Teamsheet actually knew.

The central scientific requirement is therefore not to archive everything. It is to preserve the minimum evidence needed to answer:

- what Teamsheet knew before the deadline;
- when it knew it;
- which providers were healthy or in fallback;
- what transformed inputs the production model actually consumed;
- what expected minutes, projections and recommendations were produced;
- which build/model/rules produced them; and
- what happened afterwards, recorded separately as outcomes.

## 4. Candidate sources / repositories / approaches

This branch is evidence-readiness, not provider selection.

The research reviewed:

- current Stage 10 capture/canonicalisation/storage/export behaviour;
- current Odds ingestion and transformation behaviour;
- current Official FPL mutable inputs used by production;
- current expected-minutes/availability inputs and outputs;
- GW1-P1 server custody and draft PR #119 delivery/outbox behaviour;
- current first-party Odds API documentation, pricing/history/terms as of 13 August 2026;
- current first-party FPL deadline/finalisation information as of 13 August 2026; and
- current WebKit/Safari storage/privacy behaviour relevant to relying on browser-only custody.

Time-sensitive provider/API/terms facts must be re-verified before any implementation or spending decision.

## 5. Exact fields or observations required

### Minimum viable pre-deadline evidence pack

**Essential:**

- season, Gameweek and official deadline identity;
- capture/projection timestamps and network clock-attestation evidence;
- canonical snapshot identity, whole-record hash and section hashes;
- exact build/source hash plus model/rules/simulation versions and configuration;
- mutable Official FPL inputs actually relevant to current production, including player identity/team/position/price, availability status/chance/news, cumulative model inputs, team strengths, fixtures/deadline and set-piece orders;
- provider state, retries/issues, inclusion/fallback state and accepted normalised supporting-provider inputs;
- current expected-minutes outputs: `pStart`, `pAppear`, `p60`, `expMin`;
- player projection outputs and uncertainty;
- complete squad decision evidence where a 15-player squad is loaded: XI, bench, captain, vice-captain, optimiser/decision state; and
- one durable copy outside ordinary Safari storage.

**Essential after the Gameweek:**

- completed/corrected Official FPL outcome evidence linked to the prospective snapshot without rewriting it.

### Evidence classification

| Class | Evidence | Current capture status | Action |
|---|---|---|---|
| **A — MUST CAPTURE BEFORE DEADLINE** | Canonical Stage 10 decision snapshot, timing, build/model/rules identity and hashes | Captured | Export durably |
| **A — MUST** | Mutable Official FPL inputs used by production | Captured | No additional collection |
| **A — MUST** | Expected-minutes estimates and projections | Captured | No additional collection |
| **A — MUST** | Normalised Odds input actually consumed, when Odds is active | Captured at transformed production-input boundary | Export durably |
| **A — MUST** | Provider health/fallback/provenance state | Captured | Verify completeness |
| **A — MUST** | XI/bench/captain/vice/decision state | Captured when complete squad is loaded | Ensure 15-player squad is loaded |
| **B — SHOULD, OPTIONAL RESEARCH** | Exact raw bookmaker quotations and source update timestamps | **Not captured** | Separate future approval only |
| **B — CONDITIONAL** | Future third-party availability/line-up observations | No approved provider | No pre-GW1 action |
| **B — CONDITIONAL** | Future non-PL scheduled workload state | Not a current input | No pre-GW1 action |
| **C — CAN RECONSTRUCT/COLLECT LATER** | Final outcomes, realised starts/minutes/results/workload | Post-GW evidence path | Collect after finalisation |
| **D — NOT CURRENTLY WORTH CAPTURING** | Whole unused raw FPL payload, screenshots, speculative travel/tactical prose | Not needed | Do not collect |

## 6. Coverage

The research conclusion applies to the current production system entering GW1 and the intended GW1–GW5 prospective evidence-collection period.

The current architecture is sufficient for later evaluation of the decisions the current production system actually makes, provided an official-eligible Stage 10 record is created and preserved outside Safari for each Gameweek.

This conclusion does not claim that the current evidence set is sufficient for every future research question. In particular, it does not preserve raw bookmaker-level transformation forensics.

## 7. Freshness / update cadence

Use the existing Stage 10 timing rules.

For the current GW1 deadline of Friday 21 August 2026 at 18:30 BST, the existing rules imply:

- capture window opens at T−24h;
- preferred capture window is T−20 to T−10 minutes, i.e. approximately 18:10–18:20 BST for GW1;
- T−2 minutes, 18:28 BST for GW1, is the hard safety cutoff for starting new official evidence.

The exact FPL deadline must be re-verified shortly before operational use.

A late/post-deadline record remains evidence but must not be promoted as if it were the official prospective decision snapshot.

## 8. Reliability

A valid evidence pack should verify:

- snapshot completeness;
- timing grade and network attestation;
- whole-record and section hashes;
- build/model/rules identity;
- provider inclusion/fallback state;
- a complete 15-player squad when squad-level recommendations are being evaluated; and
- durable export outside ordinary Safari storage.

A provider marked unavailable/fallback is truthful evidence of what production actually did. It must not be replaced retrospectively with a hypothetical healthy-provider value.

## 9. Historical availability

### Official FPL

Mutable current-state fields that matter to production should be assumed unsafe to reconstruct exactly later unless prospectively frozen. Stage 10 already freezes the relevant current FPL inputs.

### Odds

The key research finding is that current Stage 10 preserves the **normalised market input actually consumed by production**, including derived expected team goals and summary metadata, but not the raw bookmaker quotations that produced it.

Current ingestion discards, after transformation:

- bookmaker identities/keys used in the final set;
- individual h2h/totals prices and totals points;
- bookmaker/market upstream `last_update` timestamps;
- exact de-vigged per-book probabilities;
- exact pre-filter and post-outlier quotation membership; and
- the full point-by-point transformation audit trail.

As of 13 August 2026, first-party Odds API research indicated that free access did not include historical odds, while paid historical data used periodic snapshots rather than proving the exact arbitrary-second live quotation set Teamsheet received. Therefore later historical queries must not be treated as evidentiary reconstruction of the exact live feed seen by Teamsheet.

**Conclusion:** raw bookmaker evidence is irreconstructible exactly unless captured prospectively, but this is a research-optionality gap rather than a blocker to evaluating the current production market layer because Stage 10 already freezes the derived market input production actually used.

## 10. Cost / free-tier constraints

No new spend is approved or required for GW1 evidence readiness.

Current Odds API plan/history/quota facts are time-sensitive and must be re-verified before any future paid-history, sampling or archival proposal.

A paid historical product would not by itself establish exact equivalence with the live quotation set Teamsheet received, so purchase must never be presented as a substitute for prospective raw capture.

## 11. Rights / licensing / retention

Current local Stage 10 capture/export remains the accepted evidence path.

Permanent provider-derived cloud retention remains fail-closed where rights are unresolved. Current GW1-P1 governance does not permit assuming that Odds/Understat material may be archived merely because transport exists.

First-party Odds API terms reviewed on 13 August 2026 did not provide a sufficiently explicit basis to treat permanent raw bookmaker-level cloud archival rights as approved. Any future raw-Odds archive therefore requires a separate rights/retention review and explicit approval before implementation.

Do not strip, alter or re-canonicalise a Stage 10 record merely to make it archivable.

## 12. Security / privacy

Exports remain owner-controlled evidence records.

No provider key, keyed URL, forbidden secret or unnecessary private identifier may enter the canonical evidence record.

PR #119 must preserve the current architectural rule that cloud custody is a one-way side effect: recommendations never read from, wait for or fail because of the archive.

## 13. Canonical identity / mapping requirements

Preserve exact snapshot/model/rules/build/provider/fixture/player identities and hashes.

The official prospective record must remain immutable. A later capture is a new independently hashed snapshot; post-Gameweek corrections belong to outcome revisions rather than rewriting the pre-deadline record.

If raw Odds observations are ever separately approved, their minimum provider-neutral identity/timing contract should include event/fixture identity, bookmaker key, market key, outcome/price/point, upstream update time where provided, Teamsheet fetch time and inclusion/rejection disposition.

## 14. Proposed provider-neutral / shadow contract

No new contract is implemented by this closeout.

For future ephemeral external observations, the minimum generic research contract should separate:

- canonical player/team/fixture identity;
- provider/source;
- observation type;
- fact versus prediction classification;
- normalised value/claim/prediction;
- source `observedAt`/publication/update time where available;
- `effectiveAt`/fixture applicability;
- Teamsheet `fetchedAt`;
- parser/transform version;
- provenance and quality metadata; and
- rights/retention classification.

Such observations must remain `shadow_only` until separately approved for production use.

## 15. Fallback behaviour

If Odds or another approved optional provider is unavailable during capture, retain the truthful frozen fallback/unavailable state and current production fallback.

If PR #119 remains unavailable or fails acceptance, local Stage 10 capture plus owner export remains the scientific evidence path.

Do not implement an emergency provider, model, transport or data-collection change merely to improve the apparent completeness of a GW1 record.

## 16. Failure modes

Principal failure modes are:

- missing the pre-deadline capture;
- starting a new capture after the safety cutoff;
- clock-attestation conflict;
- provider unavailable/stale without truthful provenance;
- incomplete 15-player squad when decision evidence is required;
- retaining the only full record inside ordinary Safari storage;
- forgetting the owner export;
- corrupt/tampered export;
- confusing cloud-custody failure with local evidence failure;
- retrospectively replacing fallback state with later provider information; and
- treating historical Odds snapshots as exact reconstruction of the live quotations originally received.

## 17. Double-counting / leakage risks

Never backfill later odds, confirmed line-ups, injuries, results or corrected facts into the pre-deadline snapshot.

Post-Gameweek outcomes must remain separate downstream evidence.

Future tactical/set-piece/availability research must also account for signals already embedded in historical xG/xA, starts/minutes or Official FPL availability to avoid double counting.

GW1–GW5 outcomes may be used for integrity checks and diagnosis, but anything designed after seeing those outcomes must face untouched later Gameweeks before any predictive-improvement claim.

## 18. Validation / ablation plan

### GW1–GW5 evidence plan

For every Gameweek:

**Before the deadline**

1. refresh verified inputs during the preferred T−20 to T−10 window;
2. ensure the complete 15-player squad is loaded;
3. preserve one complete, official-eligible, preferably network-attested Stage 10 snapshot;
4. inspect provider/fallback state truthfully; and
5. export the canonical JSON to durable storage outside ordinary Safari.

**After the Gameweek**

1. wait for Official FPL finalisation before treating outcomes as final;
2. collect/preserve the outcome record linked to the correct prospective snapshot;
3. retain legitimate later outcome corrections as revisions; and
4. verify snapshot/outcome identity linkage and evidence integrity.

**Do not tune during GW1–GW5**

Do not change or optimise Odds weight, expected minutes, fixture strength, role adjustments, transfer rules, captaincy, provider selection or model formulas using the same early-Gameweek sample being diagnosed.

At the GW5→GW6 review, follow the Foundation order: evidence integrity -> current model performance -> predeclared current-layer ablations -> error-source diagnosis -> next experiment.

Five Gameweeks may reveal operational/missingness/calibration problems but do not validate a model.

## 19. Required tests

Existing Stage 10 snapshot/storage/hash/timing/provenance tests remain authoritative.

This research closeout requires no new runtime test and no production behaviour change.

Any future new evidence field/source would require, at minimum:

- schema/canonicalisation tests;
- identity and timing tests;
- privacy/secret-redaction tests;
- rights/retention gate tests;
- stale/missing/fallback tests; and
- structural tests proving zero production/model effect while `shadow_only`.

## 20. Evidence required before production use

The branch research question is now answered, but prospective evidence still has to be collected operationally.

Required future evidence includes:

- a genuine eligible GW1 Stage 10 capture/export with truthful provider state;
- equivalent prospective captures through the intended early-Gameweek collection period;
- completed/corrected Official FPL outcomes linked to those snapshots; and
- enough untouched later observations for any subsequently proposed model/provider change to be evaluated honestly.

This evidence may support a future proposal. It does not auto-approve one.

## 21. Current recommendation

**Research conclusion: YES — Teamsheet can enter GW1 with the evidence architecture currently merged on `main` without losing anything essential for later evaluation of the current production system, provided each official Stage 10 record is preserved outside Safari.**

### Architecture gap classification

**GREEN — already adequate for the current evaluation question**

- deadline/capture/projection timing and network attestation;
- canonicalisation and cryptographic identity;
- build/model/rules identity;
- mutable Official FPL production inputs;
- expected-minutes estimates;
- transformed Odds input actually consumed when active;
- provider health/fallback/retry state;
- projections/uncertainty;
- squad XI/bench/captain/vice/decision evidence; and
- post-Gameweek outcome/revision architecture.

**AMBER — operational/custody discipline required**

- local bounded retention is not an archive;
- ordinary Safari storage must not be the only durable copy;
- export is owner-triggered;
- the complete squad must be loaded for full decision evidence;
- PR #119 remains a separate acceptance-incomplete custody enhancement; and
- provider-derived cloud retention remains separately rights-gated.

**RED — research optionality, not a GW1 blocker**

Exact raw bookmaker quotations, source update timestamps, per-book de-vigged probabilities and exact outlier membership are not retained and cannot reliably be reconstructed later.

This Red gap blocks only future forensic re-performance of the raw Odds ingestion pipeline against the exact live quotes Teamsheet saw. It does **not** block evaluation of the current normalised market layer because the derived production input is already frozen.

### Pre-GW1 owner checklist

For GW1, subject to re-verifying the official deadline shortly beforehand:

- ensure the correct complete 15-player squad is loaded;
- refresh/capture in the preferred 18:10–18:20 BST window for an 18:30 BST deadline;
- verify the record is complete and official-eligible, preferably `network_attested`;
- accept truthful Odds/Understat fallback if that is the genuine state;
- do not start a new official capture after 18:28 BST;
- export the validated GW1 snapshot JSON and save it somewhere durable outside ordinary Safari storage;
- if PR #119 is available for physical acceptance, treat successful cloud delivery as additional custody, not as a prerequisite for the recommendation or a substitute for the local export; and
- collect final/corrected outcomes after the Gameweek through the separate outcome path.

### Time-sensitive facts to re-verify

Before operational use or implementation, re-verify:

- live `main` and PR #119 state;
- the exact FPL deadline;
- current Odds API free-tier/history/quota/pricing behaviour;
- current Odds API terms relevant to retention/redistribution;
- current Cloudflare Access/CORS/cookie behaviour if a transport change is considered; and
- current Safari/WebKit storage/privacy behaviour if custody assumptions change.

## 22. Explicit implementation approval gate

This research closeout approves **no runtime change**.

It does not approve:

- raw Odds retention or extra Odds calls;
- a paid Odds API tier;
- Odds or Understat cloud archival rights;
- injury/team-news/predicted-line-up providers;
- ClubElo or calendar providers;
- workload/fatigue modelling;
- expected-minutes changes;
- tactical/set-piece bonuses;
- provider weighting or projection formulas;
- PR #119 merge;
- alternative P2 transport;
- new D1/R2 structures;
- production shadow storage; or
- any other repository/runtime implementation beyond this documentation closeout.

Any such work requires a separate evidence-led proposal and Pritesh's explicit approval.