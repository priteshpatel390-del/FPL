# Stage 3 — Approved design and implementation record (in progress)

## 1. Security architecture

```
                    GitHub Pages (static)                    
  ┌────────────────────────────────────────────────────────┐
  │ dist/index.html                                        │
  │  CSP meta (hash-based) · frame-buster · BUILD_INFO     │
  │                                                        │
  │  UI (DOM-builder rendering, no string HTML for         │
  │      API/user/AI content)                              │
  │        │ normalised records only                       │
  │  ┌─────┴──────────────────────────────────────┐        │
  │  │ provider layer                             │        │
  │  │  fetch → retry(backoff+jitter) → validate  │        │
  │  │  → normalise → health mark → cache(envelope)│       │
  │  └─────┬────────────┬───────────┬─────────────┘        │
  └────────┼────────────┼───────────┼──────────────────────┘
     FPL via relays  Understat   Odds API (DIRECT ONLY,
     (no secrets     via relays   key client-side: accepted
      ever carried)  (no secrets) temporary limitation)
                                  archive: raw.githubusercontent (direct)
Future serverless: each provider's base URL flips to /api/<provider>;
secrets move to env vars; relays deleted. No model/UI rewrite required.
```
Anthropic: NO key storage or key field in the frontend (removed this stage).
Inside Claude's preview the Ask tab keeps working keylessly; anywhere else it
shows "AI assistant requires the serverless migration" and stops. connect-src
retains api.anthropic.com solely for the in-Claude keyless path.

## 2. Provider validation flow
**STATUS: IMPLEMENTED 2026-07-27 (D-14).** Per-endpoint validators live in
`src/providers/validate.mjs`; the inventory, fatal/partial rules and cached-data
treatment are recorded in DATA_SOURCES.md. The design below is retained as the
approved intent; where the implementation differs it is noted inline.
fetch → (retry policy §3) → parse JSON/text → `validate(spec, data)`:
- FATAL (reject, use fallback, health=Unavailable): missing required top-level
  shape — e.g. bootstrap without elements/teams/events arrays; fixtures not an
  array; picks without picks[]; standings without standings.results; odds
  response not an array; Understat page without parseable teamsData.
- DEGRADED (accept, warn, health=Partial): optional fields missing (xG per-90,
  DC, chance_of_playing, kickoff_time, news_added, bookmaker last_update) —
  defaults applied, per-field miss counters kept.
- UNKNOWN fields: ignored, counted (schema-drift telemetry in health detail).
- NORMALISE: fixture dedupe by id (fallback key event|team_h|team_a) —
  **APPROVED 2026-07-26 (D-13), IMPLEMENTED**: src/providers/validate.mjs, applied in hydrate();
  exact duplicates collapsed, conflicting identities reported as partial, unidentifiable rows
  excluded and reported, genuine doubles preserved; numeric coercion at the boundary; team-id existence
  checks on fixtures/picks.
Errors surfaced as category + counts only — never raw payloads, never URLs
with query strings (odds URL carries the key).

Implementation notes (D-14), where reality differed from the sketch above:
- "UNKNOWN fields: ignored, counted" was NOT implemented as a counter. Unknown
  fields are tolerated and passed through untouched, but counting them would
  produce noise on every load (the FPL feed carries many fields no consumer
  reads) without telling us anything actionable. Schema-drift telemetry is
  reconsidered with the health model (item 4).
- Core data (bootstrap + fixtures) validates inside `hydrate()` so cached and
  fresh snapshots share one path; a fatal payload returns early leaving state
  untouched. A fatal-only `bootstrapStructure()` guard additionally runs before
  `slim()` on the fresh path, since `slim()` would throw first and a payload
  that broken must never be cached.
- Optional providers degrade to their existing fallbacks; they never block core
  FPL data. Their issues are recorded per provider+endpoint and replaced on each
  refresh, and pooled calls are collapsed so fan-out cannot flood the report.
- Deferred: numeric-range validation of Understat values (VAL-2) and per-row
  archive column checks (VAL-3). Retry interaction is item 3; health-state
  mapping is item 4 — this task only emits the structured input they consume.

## 3. Retry policy
**STATUS: IMPLEMENTED 2026-07-27 (D-15).** Engine in `src/providers/retry.mjs`;
integrated in `providers/transport.mjs`, `providers/odds.mjs`, `model/backtest.mjs`.
The approved intent is retained below; deviations are noted after it.

Retryable: timeout/abort, network error, HTTP 429 (honouring Retry-After when
present), 500/502/503/504. Non-retryable: 400/401/403/404, JSON parse or
schema-FATAL, invalid key (401 odds), and — structurally impossible, not just
policy — odds via relay. Schedule: max 3 attempts, delay = 500ms·2^n with full
jitter, per-provider circuit: after a failed cycle the provider is marked and
not re-tried until next load/refresh. Relay cascade counts as ONE attempt
(rotation is transport selection, not retry); max 2 cascades for FPL/Understat.

Implementation notes (D-15), where reality differed from the sketch above:
- **Elapsed-time budget added.** Attempt ceilings alone are not a real bound
  here: one FPL cascade can burn ~40s before failing, so "max 3 attempts"
  would have licensed a two-minute spinner. Every policy now carries
  `budgetMs`, checked before sleeping. Cheap failures are retried; expensive
  ones are not. This is what actually keeps latency bounded.
- **Backoff is shorter and half-jittered, not 500ms·2^n with full jitter.**
  Base 300–800ms per provider, capped at 1.2–3.2s, jitter spanning 50–100% of
  the exponential. Full jitter can produce a near-zero delay, which defeats the
  point; the 50% floor keeps every wait meaningful. Worst-case added delay is
  under 5s for every shipped policy, asserted by test.
- **Retry-After is NOT honoured** (limitation RET-1). Under the relay cascade
  the header describes the relay, not the FPL origin, and obeying an arbitrary
  server-chosen delay conflicts directly with the "avoid long waits"
  requirement on a phone. Fixed capped backoff is used instead.
- **Odds 429 is treated as permanent, not retryable.** It signals an exhausted
  quota *window*, not a transient burst; retrying returns the same answer later
  and the existing user-facing message is already correct.
- **Optional FPL endpoints get a reduced allowance** (2 attempts vs 3 for core).
  Rival picks are fetched in a pool of twenty, so the full allowance would turn
  a single outage into roughly 300 doomed requests. Optional endpoints already
  degrade gracefully, so the extra attempt buys much less.
- **Per-provider circuit breaker NOT implemented** (limitation RET-2). It needs
  a durable "this provider is down" signal, which is precisely what the
  seven-state health model (item 4) exists to produce. Building a second,
  private version of that state inside transport would be the wrong shape.
- Retry metadata is emitted to `S.retryStats` in the shape item 4 will consume:
  `{provider, endpoint, attempts, finalStatus, retryable, exhausted, budgetExceeded}`.
  Nothing reads it yet.

## 4. CSP strategy — hash-based, no broad unsafe-inline
Build computes SHA-256 of the single inline <script> and the single inline
<style> block and emits them in a CSP <meta>:
- default-src 'none'
- script-src 'sha256-<bundle>'
- style-src-elem 'sha256-<style>' https://fonts.googleapis.com
- style-src-attr 'unsafe-inline'   ← the one documented concession, see below
- font-src https://fonts.gstatic.com
- connect-src https://fantasy.premierleague.com https://api.allorigins.win
  https://corsproxy.io https://api.codetabs.com https://thingproxy.freeboard.io
  https://understat.com https://api.the-odds-api.com
  https://raw.githubusercontent.com https://api.anthropic.com
- img-src 'self' data:
- object-src 'none' · base-uri 'none' · form-action 'self'
Concession, stated plainly: the views use inline `style=""` attributes
throughout; CSP cannot hash attributes without 'unsafe-hashes' sprawl. Risk of
style *attributes* (script cannot run from them) is far below inline
script/style elements, which ARE hash-locked. Migration to classes is folded
into the Stage 9 view rewrite, after which the concession is deleted.
Limitation, stated plainly: `frame-ancestors` is ignored in <meta> CSP (header
-only directive) and GitHub Pages cannot set headers. Compensating control: a
frame-buster (`if (top !== self) top.location = self.location`). The directive
ships in the policy string anyway so the serverless migration inherits it as a
real header. Build fails if the emitted hashes don't match the embedded assets.

## 5. Sanitisation strategy + rendering inventory (deliverable 7)
Rendering primitive: `el(tag, attrs, ...children)` building real DOM nodes;
all dynamic text via textContent. escapeHTML survives only inside the Markdown
pipeline. Inventory of every innerHTML site and its class/treatment:

| Site | Class | Treatment |
|---|---|---|
| gwstrip | API (team/entry name) | DOM builder |
| srcStatus / chipState / status / askStatus / manualCount | API+provider strings | DOM builder / textContent |
| ticker table + swings notes | API (team names) | DOM builder |
| playerTable rows + breakdown drawer | API (web_name, news) | DOM builder |
| squadOut (entry name, players, news, notes) | API | DOM builder |
| capgrid cards | API | DOM builder |
| transferOut table | API | DOM builder |
| leagueOut (league name, rival names) | API (third-party-controlled names — highest-risk API class) | DOM builder |
| leagueChips | **user-derived** (custom league names) | DOM builder, textContent |
| manualList pills / pResults dropdown | API + user search context | DOM builder |
| btOut (results, error messages) | derived + error strings | DOM builder; errors category-only |
| thread (Ask) | **AI/Markdown output** | dedicated pipeline below |
| static shells (panel scaffolding, legends, empty-states) | static trusted template | may remain literal templates (no interpolation) |

AI/Markdown pipeline (separate, per your §4): escape ALL input first → parse a
restricted subset only (bold, italic, h4 from ##/###, ul/li, paragraphs,
inline links) → raw HTML never honoured → links: scheme allow-list http/https
only (javascript:, data:, vbscript:, protocol-relative and encoded variants
rejected), rendered with rel="noopener noreferrer" target="_blank" → output is
DOM nodes, not an HTML string. Security tests: <script>, on* handler
attributes, javascript: (plain, mixed-case, entity- and %-encoded), data:
URLs, quote-injection into attributes, nested/unbalanced HTML, markdown link
with hostile href, image tags.

## 6. Health-state model
States: Live · Cached (fresh snapshot in use, provider not re-queried) ·
Stale (cache older than provider-specific threshold; still shown, flagged) ·
Fallback (substitute model active) · Partial (degraded validation) ·
Disabled (user choice — never styled as failure) · Unavailable.
Thresholds: FPL stale >30min during live GWs / >6h otherwise; Understat >24h;
odds >6h. Each entry carries lastSuccess, age, and a consequence line, e.g.
"Odds unavailable — internal model active", "Understat stale by 18h — team
form may lag", "FPL live". Surfaced as a compact strip in the settings panel
(full redesign of placement belongs to Stage 9).

## 7. Anthropic key handling (your §9) — **IMPLEMENTED 2026-07-27 (D-08 / SEC-3)**
`claudeKey` input, persistence and load-time restore are removed entirely; any legacy stored
value is actively deleted from config on first run. `ask()` sends no key headers; outside Claude
it fails fast before any Anthropic request. Five focused tests cover migration, persistence,
hosted fail-fast, the keyless preview request and static key-affordance removal.

Remaining in this section: Odds key "Forget API key" button (clears field + storage); a `scrub()` helper
strips the key from any string destined for logs, errors, health notes or UI;
manifest and BUILD_INFO verified key-free; test asserts no key material in any
rendered output or thrown error under forced failures.

## 8. Remaining known limitations after Stage 3
1. Odds key still client-side (owner-accepted, labelled, one-tap forgettable).
2. style-src-attr concession until Stage 9.
3. frame-ancestors ineffective on static hosting (frame-buster compensates).
4. Public relays remain for FPL/Understat transport (no secrets carried);
   removed only at serverless migration.
5. Dataset SHA pinning (BT-1) still owed — needs a SHA from you or ETag
   capture at Stage 7.
6. In-Claude Ask depends on the keyless artifact environment; no SLA.

## Stage 3 test additions (your §10)
Schema: valid/malformed/partial payloads per provider spec (fatal vs degraded
vs unknown-field counting). Retry: retryable vs non-retryable classes, max-
attempt ceiling, backoff monotonicity (jitter-bounded), 429 Retry-After.
CSP: build emits hashes matching embedded assets (build self-verifies; test
recomputes independently). Sanitisation: the §5 battery. Cache: stale
detection thresholds; stale-flagged rendering. Health: transition sequences
(Live→Stale→Fallback; Disabled never Unavailable). Secrets: forced failures
across providers, assert key absent from every log line, error, health note
and DOM. All 96 existing tests kept green; characterisation goldens expected
unchanged (no model formulas touched — scope per your §2).
```
