# DI-4 — Weekly Decision Synthesis / Product Integration

## Outcome

DI-4 adds a versioned, deterministic product read model and a mobile-first weekly decision surface at the top of **Team**. The direction is exclusively:

`existing production decisions -> DI-3 ephemeral artifact -> DI-4 read model -> Team presentation`

The surface leads with the transfer/roll action and captaincy, then progressively discloses the XI, bench, artifact-ordered alternatives, multidimensional uncertainty, reconsideration conditions and a short decision-basis statement. It never submits an FPL action.

Authoritative reconciled implementation base: GitHub `main` `054c3ed1a02cdcb0dbab46565442493a985f4223`. PR #187's DATA-S2B redirect-remediation changes were reconciled into the DI-4 branch and retained unchanged.

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

Physical iPhone Safari acceptance **PASSED** on 30 August 2026 against exact candidate `490ffedeea60e0fecc35276e14f9b4de97a579c7` using normal Safari with Prevent Cross-Site Tracking enabled. The owner verified:

1. Fresh/unavailable and Team-only partial states were calm, readable and correctly located.
2. A real Team-ID-loaded squad rendered captain, vice, XI and bench correctly.
3. The real flow Team -> Transfers -> Team upgraded the card to **Complete weekly decision** without refresh or a second transfer calculation.
4. Long player names wrapped without visible horizontal overflow.
5. Starting XI/bench, alternatives and decision-basis disclosures opened and closed normally.
6. Player detail, Transfers and primary navigation continued to behave normally.
7. No schema, hash, manifest or internal implementation identifier appeared in the primary flow.

Observed non-blocking product follow-ups: repeated bank/FT consequence text is semantically noisy on non-transfer cards; eight transfer alternatives create a long mobile scroll; current uncertainty is thin; and current parity artifacts provide no reconsideration conditions. These observations do not change the zero-recommendation-diff acceptance result and are not claims about transfer quality.

## Explicit exclusions and limitations

No recommendation, model formula, expected-minutes rule, fixture calculation, XI/captain/bench/transfer selection, roll utility, signal/provider approval, chip/rank strategy, LLM decision, FPL account write, security/auth change, D1/Cloudflare/DATA-S2B persistence, cron or external service changes. DI-3 currently carries `not_adapted` uncertainty dimensions and no reconsideration conditions in parity runtime output; DI-4 states that honestly and invents neither. This checkpoint claims presentation coherence, not improved FPL accuracy.

Transfer recommendations remain representations of the existing production optimiser. DI-4 physical acceptance does not establish that the underlying transfer recommendation is accurate, complete, or ready to be trusted without the separately governed external-intelligence programme.

## Physical iPhone failure and repository remediation — 30 August 2026

Physical iPhone Safari acceptance on candidate `94f84d54aff2019650c1e6cc17fb5a6787777847` **FAILED**: the calm unavailable state passed its layout checks, Team and Transfers remained functional, but Team -> Transfers -> Team never displayed the generated artifact. The failure was not a basis mismatch or artifact-integrity rejection. The production bundler kept `createWeeklyDecisionReadModel` private inside the DI IIFE while the flattened renderer's stripped import expected a lexical binding outside that scope; its defensive `typeof` guard therefore returned without replacing the static unavailable state. Native-ESM tests passed because the source import was correct, which is why the missing production wiring escaped the earlier suite.

The remediation returns exactly the read-model function from the private DI IIFE into a same-named, non-global lexical binding. DI-3 and its runtime remain private except for the already-approved `DI3_PARITY_RUNTIME`; no `globalThis` DI-4 API is added. A production-bundle call-site regression now drives the real Team renderer, controllable Transfers Worker result, DI runtime and return-to-Team render. It proves unavailable -> Team-only partial -> complete, reverse order, public estimated and manual exact pricing, bank tenths, FT, order-independent squad identity, byte-identical production inputs, and no DI-4 global.

The runtime also applies a minimal monotonic generation counter: each generation captures Team and Transfers snapshots, and only the newest generation may replace `latest`. This is defensive ordering hardening rather than the diagnosed first physical cause. Genuine basis differences still fail closed with the exact mismatched field available through the existing in-memory runtime result for deterministic tests; technical errors remain absent from normal UI.

## Second physical iPhone failure and route-refresh remediation — 30 August 2026

Physical iPhone Safari acceptance on candidate `6b568985b637e7e3b31ea57bdf883b2a918c786b` again **FAILED**, at a narrower boundary. Fresh unavailable and real Team-only partial states passed physically, including captain/vice, responsive layout, navigation and metadata containment. After the normal Transfers UI visibly completed, returning to Team left the earlier partial DOM visible with `Transfer decision missing`.

The exact cause was stale presentation state. The accepted fresh and cached result paths both call `recordTransfer`; the DI runtime can retain a complete artifact. However, app-shell route activation only hides/unhides top-level views and dispatches `teamsheet:route-change`; it does not rerun `renderSquad`. The card therefore retained the Team-only partial DOM created before visiting Transfers. The prior production regression explicitly invoked `renderSquad` after changing the hash and did not model that real route lifecycle.

The narrow remediation subscribes the weekly-decision renderer to parity-runtime publications while Team is visible and renders `runtime.latest()` whenever the existing route event returns to Team. It neither recomputes Team nor changes navigation. The runtime adds a metadata-only developer diagnostic containing snapshot-presence flags, generation identities, last successful domains, latest error and exact mismatch field; it contains no raw snapshots or user-facing technical text.

Permanent production-bundle tests now use a public-picks-style squad (`bought:null`) and prove fresh and cache-hit result handoffs, route return without a Team recomputation, repeated Team route activation, manual exact/public estimated pricing, shared bank-tenths and FT semantics, stale-cache mismatch rejection and fresh supersession, rejected result guards, output immutability and no DI-4 global.

## Final physical acceptance — 30 August 2026

Exact candidate `490ffedeea60e0fecc35276e14f9b4de97a579c7` **PASSED** physical iPhone Safari acceptance. The previously failing lifecycle now works through normal bottom navigation: a real Team-ID squad forms a partial artifact, accepted Transfers output is recorded, and returning to Team renders a complete weekly decision without recomputation or refresh. The owner also verified XI/bench disclosure, transfer alternatives, decision basis, player detail and normal Transfers behaviour. GitHub Pages was restored to `main` after acceptance.
