# Atomic Foreground Refresh

Purpose: the design and implementation record for the Atomic Foreground Refresh checkpoint. Audience: all future sessions. Status: implementation candidate; merge and physical iPhone acceptance remain owner-gated.

Approved basis: R2 as amended by R3 A1–A8, R3.1 B1–B8, R3.2 C1–C8, R3.3 D1–D7 and R3.4 E1–E7, plus the three binding approval clarifications.

Related: [Architecture](ARCHITECTURE.md), [Decisions](DECISIONS.md), [Known Limitations](KNOWN_LIMITATIONS.md), [Testing](TESTING.md), [Data Sources](DATA_SOURCES.md).

## The defect

`REFRESH-2`. On resume or manual refresh, live data was fetched and written into the shared state object `S` in stages separated by `await` points. Because a foreground refresh deliberately stays interactive, a user could observe and act on a mixture of old and new generations.

Investigation confirmed three consequences beyond the recorded issue:

- A transient failure on `/entry/`, `/picks/` or `/history/` erased valid squad state and still reported a successful **Live** refresh, because those calls use `optional:true` and return `null` for both transport failure and authoritative absence.
- `markLive('fpl', …)` fired before the account and supporting-provider phases had run, so the app asserted fresh Official FPL data while those slices were empty or stale.
- A manual **Load data** pressed during an in-flight foreground refresh was silently downgraded to that refresh, discarding `force` and the interaction lock.

One finding raised during investigation was **withdrawn**: the pre-validation `K_CACHE` write is safe. `bootstrapStructure` passing guarantees `prepareCore`/`hydrate` cannot find a fatal, and the ordering is the documented D-13 design. Test 21 now locks that invariant.

## The design

```
requestRefresh(reason)
   └─ queue if in flight (manual is queued, never downgraded)
        ├─ captureRefreshInputs()   → the epoch is a captured value, not a counter
        ├─ collectRefresh(inputs)   → PURE: no writes to S, health or diagnostics
        ├─ lifecycle-epoch check    → work crossing a persisted restoration is discarded in full
        ├─ applyRefreshCommit()     ══ SYNCHRONOUS · NO-THROW · NO-REENTRANT ══
        ├─ render once
        ├─ await persistence        → ssetChecked, so persist_failed is observable
        └─ drain bounded recomputation
```

**Why synchronous is sufficient.** Every renderer reads `S` synchronously from an event-loop task. A mutation block with no suspension point cannot be interleaved. The codebase contains no `MutationObserver`, `IntersectionObserver`, `Proxy` or accessor property on `S`, so a plain assignment cannot dispatch to user code. Test 22a locks that. No interaction lock is therefore needed, and the accepted D-36 behaviour that foreground refresh stays interactive is preserved.

**No refresh generation.** `verifiedRefreshPromise` already makes refreshes a singleton, so a counter guarding "an older refresh commits after a newer one" would defend an unreachable scenario. The genuine overlap is provider-level — the settings handlers call providers outside that guard — and is handled by per-provider tokens.

## Two independent rules per provider

| Rule | Governs | Contents |
|---|---|---|
| **A · computation signature** | whether a returned result may be applied | season, schema/model, team identity (id **and** name), provider-specific revisions, Odds key epoch |
| **B · value compatibility** | whether the value already live in `S` stays active | provenance from the in-memory applied record, R1's own map validators against the committed core, R1's age bounds |

Fixture, event and cohort revisions appear in Rule A only. They trigger correction; they never make an otherwise R1-usable value unusable. Every slice resolves to exactly one of **REPLACE**, **RETAIN** or **CLEAR**.

`applyProviderResult()` in `src/providers/applied.mjs` is the single gate. Both the refresh commit and the exported `loadUnderstat` / `loadOdds` / `loadMinuteHistories` wrappers call it, so the two paths cannot diverge.

### Odds key epoch

An opaque in-memory counter, incremented when the trimmed key value changes. Never a hash — a hash of a low-entropy key is recoverable and would still be key-derived material in a signature. Never persisted, never in diagnostics, Provider Health, evidence or exports. Tests 70–72 lock this.

## Account slices

`entry` is the root. If it clears for any reason, `picks`, `history`, `chipsUsed` and `picksStatus` clear with it. Each slice carries its own compatibility key:

| Slice | Key |
|---|---|
| `entry` | `teamId · season · schema` |
| `picks` | `teamId · picksGameweek · season · schema` |
| `history` | `teamId · season · schema` |

`outcome:'value'` → replace · `outcome:'notfound'` (HTTP 404 only) → clear · `outcome:'failed'` → carry when the key matches, otherwise clear.

A 200 response carrying a `detail` field is **failed**, not notfound. Ambiguity must preserve user data, never destroy it — a false notfound would clear a valid squad, which is the defect this checkpoint exists to fix.

## FPL health aggregation

**Live** iff the core hydration produced no partial issues **and** either no account data was requested, or every requested slice replaced with no partial validation issues of its own. Otherwise **Partial**. Fallback and Unavailable remain reserved for core FPL failure and are unreachable from an account outcome.

This is a deliberate correction of misleading disclosure, not a preserved behaviour.

## Minute-history provenance

`S.minuteHistory` remains restricted to the captured current cohort and keeps its model-facing shape `{ [playerId]: history[] }`. Non-cohort histories stay persisted but inactive. `S.minuteHistoryMeta` carries `{season, schemaVersion, modelVersion, fetchedAt, revision}` on the same key set.

**Admission gate:** a history enters `S.minuteHistory` only when its metadata matches the committed season, schema and model, the player exists in the committed core, and the player is in the current cohort. Element ids are reused between seasons, so an id match alone proves nothing.

Revision change and the seven-day backstop remain **correction triggers**. There is no minute-history usage expiry: a validated entry stays active when its correction fails.

## Error classification

| Phase | Class | FPL health | Data state |
|---|---|---|---|
| Collection | `collection_failed` | Fallback / Unavailable | previous generation retained |
| Commit | `commit_failed` | **unchanged** | previous generation restored |
| Render | `render_failed` | **unchanged** | new generation committed and valid |
| Persistence | `persist_failed` | **unchanged** | committed and rendered |

**Only `collection_failed` may state that the Official FPL feed failed.** Previously a throw inside `renderVerifiedState()` was caught by the same handler and reported as "Live feed unreachable".

## Commit journal

Four domains, restored together in reverse commit order:

- refresh-owned keys of `S` (`REFRESH_OWNED_KEYS`)
- `S.retryStats`, **cloned** — `recordRetry` writes in place, so a reference snapshot restores nothing
- the health registry, via `snapshotHealth()` / `restoreHealth()` — module-private, unreachable from `S`
- `xpCache`, cleared rather than restored — it is a pure memo, so clearing is always safe and restoring stale entries would not be

## Files

| File | Change |
|---|---|
| `src/providers/applied.mjs` | **new** — tokens, signatures, Rule B, the shared apply gate |
| `src/main.mjs` | `collectRefresh` + `applyRefreshCommit` + queue + lifecycle epoch + error classes + health aggregate |
| `src/state.mjs` | `prepareCore` / `assignCore`, commit journal, `populatePositionFilter` extracted from `hydrate` |
| `src/storage.mjs` | `ssetChecked` added; `sset` byte-identical |
| `src/providers/transport.mjs` | typed result; `notfound` restricted to 404; no `S.source` write during collection |
| `src/providers/{understat,odds,minutes-history}.mjs` | pure `compute*` plus wrappers through the shared gate |
| `src/providers/common.mjs` | `mapTeamName(external, teams)` |
| `src/providers/registry.mjs` | `snapshotHealth` / `restoreHealth` |
| `src/model/scoring.mjs` | `xpCacheValueSnapshot` / `xpCacheRefSnapshot` |
| `src/ui/views.mjs` | focused-control value preservation |
| `build.mjs` | `applied.mjs` added to `ORDER` |

## Limitations

- **REFRESH-10** — an open player card may show a superseded generation; automatic rerendering is excluded from this checkpoint by approval. Focus restore on close may target a detached node.
- **REFRESH-4**, **REFRESH-6**, **REFRESH-7**, **REFRESH-8**, **REFRESH-9** remain open and separately gated. `persist_failed` gives REFRESH-6 a defined and observable class but does not resolve quota handling.
- Physical iPhone Safari acceptance has **not** been performed. No device claim is made.
- This checkpoint improves state consistency. It does **not** validate minute-history behaviour, Stage 10 outcomes, transfer-horizon evidence, populated Mini-League behaviour, recommendation accuracy or provider contribution. Those gates are unchanged.
