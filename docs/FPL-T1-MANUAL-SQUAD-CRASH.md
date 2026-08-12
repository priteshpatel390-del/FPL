# FPL-T1 — Manual squad completion and legality corrections

Status: **historical record — complete and merged.** Approved by Pritesh on 5 August 2026, implemented and automatically verified on then-draft PR #69, which merged at `00a35bacd2396a125a8a914bff9980b4f18b257f`. The "physical iPhone Safari retest remains required" wording was true only at this checkpoint; the later integrated FPL-T1/Track A acceptance is recorded in `CHANGELOG.md` and `TRANSFERS-EXACT-PERFORMANCE.md`.

## Physical acceptance defect: fifteenth-player crash

On physical iPhone Safari, adding the fifteenth manual player caused the page to freeze or crash. The squad editor saved each addition and then called the full application renderer. That renderer also ran the exact transfer optimiser while Transfers was hidden. Fourteen-player squads stopped at the incomplete-squad guard; the fifteenth player crossed the optimiser activation threshold and could start up to the existing two-million-evaluation search synchronously on Safari's main thread.

The physical symptom and code path are a high-confidence match. A Safari crash log was not available, so the defect record does not claim platform-level proof beyond the reproduced activation boundary.

## Approved crash correction

- Manual add/remove actions update the manual editor and Team presentation only.
- The transfer optimiser is deferred while Transfers is not the active route.
- Opening Transfers or explicitly forcing a transfer refresh runs the existing optimiser unchanged.
- Position quotas and the three-per-club limit are checked before a player is added.
- A fifteen-player list is labelled complete only when it is a legal 2 GKP, 5 DEF, 5 MID and 3 FWD squad.
- Legacy invalid saved squads remain visible but receive an explicit correction message.
- The squad is persisted before Team rendering; a later Team-render failure cannot silently discard the saved fifteen.

## Approved budget correction

Physical review then identified that the manual editor did not enforce the initial £100.0m squad budget. A structurally legal but over-budget squad could be saved and labelled complete and legal.

The approved correction:

- defines the manual squad budget explicitly as 1,000 price units (£100.0m);
- displays running manual purchase cost and remaining budget;
- permits the exact £100.0m boundary;
- rejects a player before saving when the resulting purchase cost would exceed £100.0m;
- keeps an existing over-budget saved squad visible but marks it invalid with the amount over budget;
- uses each saved manual purchase price where available, rather than retrospectively invalidating a squad solely because a player's current market price later rises;
- falls back to the verified current price only when a legacy entry lacks a stored purchase price;
- fails closed when a required price cannot be verified.

This is manual-squad legality validation. It does not change transfer selling-price calculations, bank handling or any optimiser ranking.

## Preserved boundaries

No transfer candidate generation, scoring, hit, free-transfer, selling-price, bank, horizon, ranking or pruning formula changes. No projection, fixture, captaincy, squad-selection, simulation, rank, Mini-League, provider or security logic changes.

## Automatic verification evidence

- The legal fifteenth-player path does not invoke the hidden optimiser.
- Transfer rendering is deferred until Transfers is opened.
- Position and club limits are rejected before saving.
- An exact £100.0m squad is accepted and displays £0.0m remaining.
- A £100.1m squad is rejected before saving.
- Legacy invalid and over-budget squads remain visible but are not labelled legal.
- Stored purchase prices remain stable when current market prices rise.
- `./run-tests.sh`: 557 passed, 0 failed, 0 skipped.
- Two exact-identity production builds were byte-identical.
- Root `index.html` matched `dist/index.html` byte-for-byte.

## Remaining physical acceptance

On the final Pages review build, restore or construct the manual squad and confirm:

1. the running `£x.xm used · £y.ym left` status is visible;
2. an addition that would exceed £100.0m is refused without losing the existing squad;
3. completing a legal 15-player squad does not freeze or crash;
4. Team opens without triggering Transfers;
5. Transfers calculates only when that workspace is opened.

PR #69 remains draft and unmerged until Pritesh explicitly approves merge.
