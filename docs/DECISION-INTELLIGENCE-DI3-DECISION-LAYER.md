# DI-3 — Validated Production Decision Layer: Stage A

## Outcome and boundary

DI-3 Stage A is a behaviour-neutral, offline decision representation under `src/decision-intelligence/`. It adds canonical immutable actions, legality proofs, separated consequences, policies, multidimensional uncertainty, reconsideration conditions, deterministic artifacts, current-output adapters and exact artifact diffs. Production modules, providers, UI, build inputs, DATA-S2B and recommendation calculations do not import it. Stage B production integration is **not approved**.

The authoritative implementation baseline was GitHub `main` `75b7be599b1f70af82c954081bc982fbe0a67c86`. Open PRs #119 and #136 concern browser evidence transport and do not touch DI modules; collision risk was therefore low. DATA-S2B's deployed shadow candidate and inactive collection boundary remain unchanged.

## Current production behaviour represented

* `src/squad.mjs::bestXI` groups the owned squad by position, sorts each position by current `xpOf(...).total`, enumerates legal 3–5 defender, 2–5 midfielder and 1–3 forward shapes, selects strictly higher total xP, and orders the remaining bench outfield-first by xP with goalkeeper last. Equal totals retain enumeration/sort order; there is no DI policy.
* Team captain and vice presentation consumes the existing projected squad ordering and simulation outputs; DI-3 does not alter those paths.
* `src/model/transfers.mjs::optimiseTransfers` owns legal one-to-three-transfer search, squad/club/position/bank constraints, exact or estimated selling prices, four-point paid-transfer hits, the five-FT cap, a six-GW default horizon and the existing `0.5` roll utility. Ranking remains `netGain`, gross best-XI points, hit, transfer count, next FT, bank, doubtful incoming and signature. Its zero-transfer baseline remains an explicit plan.
* If production inputs are absent or invalid, existing application fallbacks remain the authority. DI-3 can represent partial/no-decision but is not on the refresh path and therefore cannot break refresh.

## Canonical contracts

`decision-layer.mjs` defines the action union `starting_xi | bench_order | captain | vice_captain | roll | transfer`. Identity is SHA-256 over canonical semantic fields; display text is excluded when absent and never used as an identity shortcut. Actions and artifacts are deeply frozen.

Legality is distinct from preference and requires a versioned proof plus explicit constraints. The Stage-A transfer adapter does not regenerate legal actions: it treats only plans emitted by the existing optimiser as legal and labels that proof accurately.

Consequences preserve expected football points, transfer hits, bank, free transfers, squad changes, horizon, opportunity cost and non-point flexibility descriptors separately. They reject unexplained `score`, `bonus` and `futureValue` fields and reject converting flexibility to points. This representation preserves the existing optimiser's roll difference without validating or changing its `0.5` production utility.

The artifact records deadline/cutoff, build/model/rules/policy lineage, squad basis, recommendations, alternatives, uncertainty, risks, reconsideration predicates, completeness, evidence/assumptions, rationale/graph references, feature-input hash, candidate-action-set hash and content hash. SHA-256 identity excludes no declared semantic input and uses no wall-clock value.

The artifact boundary independently reconstructs every embedded action, recomputes and matches its identity, and revalidates its consequence and legality proof. It also cross-checks roll actions against zero transfers/changes/hits and transfer actions against the exact canonical out/in pairs declared by their consequences. These checks apply equally to recommendations and alternatives without recreating optimiser rules. A formatted action ID is never accepted as semantic proof. Selected recommendations are unique by decision domain so diff tooling cannot silently collapse ambiguity. Action `displayText` is presentation-only: the canonical action boundary removes it before identity and storage.

## Policy, approval and fallback

`di3-policy-v1` exposes objective, comparison basis, materiality (including explicit `null`), uncertainty handling, tie breaks, fallback, alternative selection, required domains and allowed production signals. The parity policy introduces no new preference. Every non-empty allowed-signal entry must pass DI-1's exact signal + version + scope `production_read` ledger lookup; absence fails closed. No DI-2 outcome is an input and no candidate is graduated.

Omitting the approval ledger is valid only when `allowedProductionSignals` is empty. A non-empty list requires the exact ledger object registered by DI-1's `createApprovalLedger()` through module-private identity; duck-typed, forged and copied objects fail closed before exact signal/version/scope lookup. Callers therefore cannot bypass approval by omitting or imitating the capability.

Completeness is `complete`, `partial` or `no_decision`. A policy cannot repeat a required domain. A complete artifact cannot carry missing, stale or conflicting domains and must contain one selected recommendation for every policy-required domain; alternatives never satisfy that requirement. Partial and no-decision artifacts may omit required recommendations while preserving their explicit gap state, and a no-decision artifact cannot carry a recommendation. Missingness and disagreement stay in separate uncertainty dimensions. There is deliberately no universal confidence field.

## Parity and diff evidence

The read-only transfer adapter preserves input bytes, mandatory roll, emitted plan ordering, action semantics and consequence fields. Stage A does not select a different plan: current-output parity means the existing selected/emitted output is represented, not recalculated. No historical production corpus containing every XI/captain/bench/transfer output is committed, so corpus-wide parity remains unavailable.

`diffDecisionArtifacts` deterministically reports changed domain, old/new action IDs, football-point delta, hit delta, bank delta, rationale codes and signal/policy causes. Identical artifacts produce an empty diff. Because the proposed Stage-B behaviour is shadow/offline representation only, the Stage-A production diff is exactly zero cases.

The 14 permanent reference descriptors cover clear and near-tied XI/captain choices, roll versus a marginal transfer, beneficial transfer, hit, missing evidence, stale/conflicting future signal, unapproved signal, partial/no-decision, reconsideration and deterministic tie. They validate infrastructure only and are not football-accuracy evidence.

## Stage-B owner approval proposal

### Existing behaviour

The existing XI, captain, vice, bench and transfers/roll code paths and formulas remain those described above. Production inputs remain Official FPL application data, currently active projection inputs/providers and user squad/bank/FT state. Current provider activation and fallbacks are unchanged; no DI-1 signal has production-read approval and DI-2 candidates remain shadow evaluation artifacts.

### Exact proposed behaviour

If approved, the narrow proposal is to generate the parity-policy artifact in a failure-isolated shadow/offline path after existing outputs are complete. **XI, captain, vice, bench, transfers, hits, bank, free transfers and roll selection would not change.** No artifact result would feed back into production selection. A failure would yield partial/no-decision artifact or no artifact while ordinary refresh and current recommendations continue unchanged.

### Policy and consequence semantics

* objective: `represent_current_output`;
* comparison basis: `current_production_order`;
* materiality threshold: `null` (no suppression or recommendation change);
* uncertainty response: disclose only;
* tie break: preserve current production order;
* alternatives: all outputs made available by the read-only adapter, versioned as `all_adapter_outputs`;
* no-action threshold: none; roll remains mandatory;
* horizon, football xP, hits, bank and FT: copied from current output without recomputation;
* flexibility: descriptive FT delta only in the canonical consequence; no new flexibility points.

### Validation, assumptions and trade-offs

Focused contract, approval, determinism, immutability, isolation, synthetic-matrix, adapter parity and diff tests are permanent. There is no claim of improved accuracy, prospective benefit or out-of-sample performance. Limitations are the small synthetic-only DI-3 evidence set, no committed all-domain historical output corpus, model uncertainty/near ties, missing unapproved signals, no validated new flexibility utility, no competitive strategy and no chip strategy.

### Approval options

* **A.** Approve the exact shadow/offline parity artifact integration above (zero recommendation changes).
* **B.** Approve a narrower domain subset.
* **C.** Keep the DI-3 artifact layer wholly offline (current Stage-A state).
* **D.** Reject or request revision.

No option is assumed. Production integration, provider graduation and behavioural change must wait for Pritesh's separate explicit approval.
