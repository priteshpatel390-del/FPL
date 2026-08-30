# DI-4 — Weekly Decision Synthesis / Product Integration

## Outcome

DI-4 adds a versioned, deterministic product read model and a mobile-first weekly decision surface at the top of **Team**. The direction is exclusively:

`existing production decisions -> DI-3 ephemeral artifact -> DI-4 read model -> Team presentation`

The surface leads with the transfer/roll action and captaincy, then progressively discloses the XI, bench, artifact-ordered alternatives, multidimensional uncertainty, reconsideration conditions and a short decision-basis statement. It never submits an FPL action.

Authoritative implementation base: GitHub `main` `b5f9e8566ea4497773cd07cd244f524fcfa75da5`. Open draft PRs #119 and #136 concern historical browser evidence transport; neither touches the Team/Transfers or DI-4 files, so direct collision risk was low.

## Read-model boundary

`src/decision-intelligence/product-read-model.mjs` supports exactly `di3-decision-artifact-v1` and emits `di4-product-read-model-v1`. It copies only presentation-relevant actions, consequences, alternatives in artifact order, uncertainty, risks, reconsideration conditions, completeness, evidence references and provenance. The caller supplies the current instant for deadline formatting, preserving deterministic output for identical artifact/options.

The module imports only DI canonicalisation utilities. It does not import squad, projection, expected-minutes, captaincy, optimiser, provider, persistence, DATA-S2B, network or account-write code. It cannot recompute or rerank a recommendation. The artifact and resulting model are never mutated; output is deeply frozen.

## Product states

* **Complete:** every DI-3 required domain is present with no missing, stale or conflicting domain.
* **Partial:** available artifact decisions remain visible and every missing, stale or conflicting area is disclosed. An alternative never fills a missing selected domain.
* **Unavailable:** a missing, invalid, failed or unsupported artifact produces no rendered decision. Calm copy directs the manager to the unchanged Team and Transfers experiences.
* **Deadline passed:** the surface labels the decision as contextual; it does not schedule, monitor or refresh anything.

DI-3 remains ephemeral. A reload can therefore return to unavailable/partial until production Team and Transfers outputs are represented again. DI-4 adds no storage or endpoint.

## Parity and isolation evidence

The permanent `tests/decision-intelligence-product-integration.test.mjs` suite proves exact XI, bench, captain, vice, selected transfer/roll, multi-transfer, hit, bank and FT mapping; artifact-only alternative order; partial, unavailable, unsupported, stale/conflicting and deadline states; immutability and determinism; no calculation/provider/storage/network/account dependency; and semantic/mobile presentation safeguards. Existing DI-3 integration tests continue to compare production fixture output to the canonical artifact.

Recommendation diff is zero: DI-4 consumes `DI3_PARITY_RUNTIME.latest()` only after production has selected and recorded its output. No DI-4 value feeds any model, optimiser or provider.

## Accessibility and mobile acceptance

The Team card uses semantic headings and sections, screen-reader status text, labelled disclosure controls, non-colour-only state copy, 44px disclosure/action targets, wrapping names, narrow-screen stacking, existing visible focus rules and the current reduced-motion-safe design system. No new navigation item, modal or horizontal scroller is introduced.

Physical iPhone Safari acceptance is **PENDING** and DI-4 must not be called fully complete until the owner checks:

1. Team synthesis loads and the action hierarchy is immediately understandable.
2. No horizontal overflow occurs with long player names.
3. status, XI/bench, alternatives and decision-basis disclosures are easy to tap and collapse.
4. partial and unavailable states remain calm and readable.
5. focusing or tapping controls causes no page zoom or focus trap.
6. Team navigation, player detail, Transfers and normal refresh remain functional.
7. no schema, hash, manifest or internal implementation identifier appears in the primary flow.

## Explicit exclusions and limitations

No recommendation, model formula, expected-minutes rule, fixture calculation, XI/captain/bench/transfer selection, roll utility, signal/provider approval, chip/rank strategy, LLM decision, FPL account write, security/auth change, D1/Cloudflare/DATA-S2B persistence, cron or external service changes. DI-3 currently carries `not_adapted` uncertainty dimensions and no reconsideration conditions in parity runtime output; DI-4 states that honestly and invents neither. This checkpoint claims presentation coherence, not improved FPL accuracy.

## Physical iPhone failure and repository remediation — 30 August 2026

Physical iPhone Safari acceptance on candidate `94f84d54aff2019650c1e6cc17fb5a6787777847` **FAILED**: the calm unavailable state passed its layout checks, Team and Transfers remained functional, but Team → Transfers → Team never displayed the generated artifact. The failure was not a basis mismatch or artifact-integrity rejection. The production bundler kept `createWeeklyDecisionReadModel` private inside the DI IIFE while the flattened renderer's stripped import expected a lexical binding outside that scope; its defensive `typeof` guard therefore returned without replacing the static unavailable state. Native-ESM tests passed because the source import was correct, which is why the missing production wiring escaped the earlier suite.

The remediation returns exactly the read-model function from the private DI IIFE into a same-named, non-global lexical binding. DI-3 and its runtime remain private except for the already-approved `DI3_PARITY_RUNTIME`; no `globalThis` DI-4 API is added. A production-bundle call-site regression now drives the real Team renderer, controllable Transfers Worker result, DI runtime and return-to-Team render. It proves unavailable → Team-only partial → complete, reverse order, public estimated and manual exact pricing, bank tenths, FT, order-independent squad identity, byte-identical production inputs, and no DI-4 global.

The runtime also now applies a minimal monotonic generation counter: each generation captures Team and Transfers snapshots, and only the newest generation may replace `latest`. This is defensive ordering hardening rather than the diagnosed physical cause. Genuine basis differences still fail closed with the exact mismatched field available through the existing in-memory runtime result for deterministic tests; technical errors remain absent from normal UI.

Latest `main` `054c3ed1a02cdcb0dbab46565442493a985f4223` was merged into the DI-4 branch before remediation. PR #187's DATA-S2B redirect remediation files and tests are retained unchanged. Physical retest of the corrected exact head remains **PENDING**.

## Second physical iPhone failure and route-refresh remediation — 30 August 2026

Physical iPhone Safari acceptance on candidate `6b568985b637e7e3b31ea57bdf883b2a918c786b` again **FAILED**, at a narrower boundary. Fresh unavailable and real Team-only partial states passed physically, including captain/vice, responsive layout, navigation and metadata containment. After the normal Transfers UI visibly completed, returning to Team left the earlier partial DOM visible with `Transfer decision missing`.

The exact cause was stale presentation state. The accepted fresh and cached result paths both call `recordTransfer`; the DI runtime can retain a complete artifact. However, app-shell route activation only hides/unhides top-level views and dispatches `teamsheet:route-change`; it does not rerun `renderSquad`. The card therefore retained the Team-only partial DOM created before visiting Transfers. The prior production regression explicitly invoked `renderSquad` after changing the hash and did not model that real route lifecycle.

The narrow remediation subscribes the weekly-decision renderer to successful/failed parity-runtime publications while Team is visible and renders `runtime.latest()` whenever the existing route event returns to Team. It neither recomputes Team nor changes navigation. The runtime adds a metadata-only developer diagnostic containing snapshot-presence flags, generation identities, last successful domains, latest error and exact mismatch field; it contains no raw snapshots or user-facing technical text.

Permanent production-bundle tests now use a public-picks-style squad (`bought:null`) and prove fresh and cache-hit result handoffs, route return without a Team recomputation, repeated Team route activation, manual exact/public estimated pricing, shared bank-tenths and FT semantics, stale-cache mismatch rejection and fresh supersession, rejected result guards, output immutability and no DI-4 global. Physical retest of the next exact candidate remains **PENDING**.
