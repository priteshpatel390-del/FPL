# EXTERNAL-INTELLIGENCE-FOUNDATION.md — research and shadow-architecture plan

Status: **Owner-approved documentation and research record only — 12 August 2026. No implementation, provider activation, model/calculation change or recommendation change is authorised by this document.**

Purpose: preserve the external-intelligence investigation, define the safe future architecture for free external information, identify prospective evidence that can be lost, and pre-register an evidence-led sequence for post-GW1 work.

Audience: future provider, model, expected-minutes, fixture, transfer and evidence work.

Related: [Project Context](PROJECT_CONTEXT.md), [Architecture](ARCHITECTURE.md), [Decisions](DECISIONS.md), [Roadmap](ROADMAP.md), [Known Limitations](KNOWN_LIMITATIONS.md), [Data Sources](DATA_SOURCES.md), [Security](SECURITY.md), [Projection Model](PROJECTION_MODEL.md), [Testing](TESTING.md), [Stage 10 Operations](STAGE10-OPERATIONS.md), [GW1-P2 Browser evidence delivery](GW1-P2-BROWSER-EVIDENCE-DELIVERY.md), [Historical Records](HISTORICAL_RECORDS.md).

Research date: 12 August 2026. External pricing, terms, coverage and access rules are time-sensitive and **must be re-verified from first-party sources before any implementation approval**.

This record deliberately states **no** current repository status. It carries no merged `main` SHA, no current test baseline and no current checkpoint claim; those live only in [Project Context](PROJECT_CONTEXT.md), [Roadmap](ROADMAP.md), [Testing](TESTING.md) and `CLAUDE.md`, and the merged `main` SHA is read live with `git rev-parse origin/main`. Nothing below goes stale when the repository moves on.

---

## 1. Outcome

Teamsheet does not need another production provider before GW1. The useful next architecture is a **provider-neutral, shadow-only External Intelligence Foundation** that lets future information be collected and evaluated without changing projected points or recommendations.

The core design decision is to keep seven concepts separate:

1. **Structural team strength** — broad underlying team quality.
2. **Recent performance** — evidence that a team's current attacking/defensive level differs from the structural baseline.
3. **Match-specific market expectation** — bookmaker information for one fixture at one point in time.
4. **Player availability and expected minutes** — chance to start, appear and reach 60 minutes.
5. **Calendar and workload** — European/domestic-cup commitments, travel, rest and recent player workload.
6. **Transfer economics** — prices, bank, hits, free-transfer rollover, horizon and flexibility.
7. **Competitive strategy** — ownership, rank and selected-rival exposure.

These must not be collapsed into a single confidence score or allowed to contaminate one another. In particular, ownership/rival context must not change football expected points, and a congestion flag must not become an arbitrary fatigue penalty.

The default future path is therefore:

`external fact -> validate -> normalise -> rights/retention gate -> shadow store -> evaluate -> separate approval -> optional production use`

There is **no** path from shadow storage back into the current projection or recommendation engine until a later owner-approved change explicitly creates one.

---

## 2. Current production model map — preserve before experimenting

This section records the current conceptual production surface so future experiments have a defined baseline. The authoritative formula remains [Projection Model](PROJECTION_MODEL.md) and current source code.

### 2.1 Official FPL — foundation

Official FPL currently provides the primary live facts used across Teamsheet, including players, teams, fixtures, Gameweeks, status/news, availability chance, minutes, points, BPS/defensive contributions, prices, transfers, ownership, xG/xA fields, set-piece order fields, manager squad data and Mini-League facts.

It also supplies the detailed player histories used by the expected-minutes layer.

Official FPL remains the production foundation. External intelligence should supplement or test specific gaps rather than duplicate the whole feed.

### 2.2 Structural team strength

Current fixture context begins with Official FPL team strengths, converted into league-average-normalised attacking and defensive expectations.

### 2.3 Understat — current recent/team-form layer

Understat is currently restricted to **team level only** under D-05. The intended production layer is last-six team xG/xGA blended at 45% against the FPL team-strength baseline when valid data exists.

The current acquisition parser is known to be fragile and the measured page structure no longer supplied the expected embedded `teamsData` shape. Refresh-Load R1 deliberately did not repair it. Missing/old Understat data falls back to the FPL structural layer.

Understat's production value is unproven. It survives only if prospective ablation later demonstrates incremental out-of-sample value. Player-level Understat remains explicitly excluded without a new approval.

### 2.4 The Odds API — current market layer

The Odds API is a distinct **match-specific market layer**, not another structural-strength source.

Current production acquisition uses UK-region head-to-head and totals markets. Quotes are validated, stale/outlier material is removed and accepted markets are transformed into market-implied home/away team goals. A sufficiently supported fixture then blends the market estimate at 65%. That weight is judgement-based and remains explicitly unvalidated under D-09.

The direct-only security boundary remains mandatory: the Odds key must never traverse a relay, appear in evidence, logs or diagnostics, or be persisted inside a keyed URL.

The free plan currently has no historical-odds endpoint. Prospective evidence is therefore uniquely important.

### 2.5 Sequential blend implication — an inference, not a new rule

The current fixture code applies Understat and then Odds sequentially. Where both are present, the resulting arithmetic implies an approximate final composition of:

- 19.25% original FPL structural expectation;
- 15.75% Understat team-form expectation;
- 65% Odds market expectation.

This is an **inference from the current sequential blends**, not an approved replacement weighting and not evidence that those proportions are optimal. It is one reason future ablation must compare layers separately rather than assume the current combined mix is justified.

### 2.6 Expected minutes

Current expected minutes are owned by `model/minutes.mjs` and expose:

`{pStart,pAppear,p60,expMin,confidence,confidenceLabel,source}`

The current live model uses the newest eight detailed Official FPL player opportunities, 0.9 recency decay and four-match shrinkage toward aggregate behaviour. Official availability is applied once. No-history priors remain deliberately conservative.

Future lineup, injury, congestion or workload information should enter first as **shadow evidence about expected minutes**, not as direct projected-point multipliers.

### 2.7 Deterministic scoring, squad, captaincy and transfers

Projected points consume the approved fixture context, player event rates and expected minutes. Best XI and model captaincy consume deterministic projected points. Transfers compare legal zero-to-three-transfer plans against the mandatory no-transfer baseline over the approved horizon, including hit and free-transfer-roll utility.

Ownership is contextual information, not part of the football expected-points objective.

No part of this document changes those contracts.

---

## 3. External-intelligence layers and intended questions

### 3.1 Structural team strength

Question: **What is the best broad prior for how strong this team is?**

Candidate evidence:

- Official FPL team strengths — existing production baseline.
- ClubElo — possible independent prior/anchor, especially early season or for promoted teams.

Do not automatically average every strength source. A structural candidate should first compete against the existing structural baseline in an ablation.

### 3.2 Recent performance

Question: **Has recent team performance materially moved away from its structural prior?**

Candidate evidence:

- current Understat team xG/xGA layer, if acquisition can be made sustainable and lawful enough for the intended use;
- future alternative team-performance feeds only after rights, reliability and redundancy review.

Recent form and structural ability are related but not identical. Preserve them as separate features so recent form can be tested rather than baked into the prior.

### 3.3 Match-specific market expectation

Question: **What does a broad market currently imply about this exact fixture?**

The Odds API remains the preferred source. There is no evidence-led reason to replace it now.

Market information can incorporate public injuries, team strength, home advantage, schedule concerns and other information. That is valuable but creates major double-counting risk: public team news or congestion should not also be converted into an independent team-goals penalty without evidence.

### 3.4 Availability and expected minutes

Question: **How likely is this player to start, appear and reach the 60-minute scoring threshold?**

Potential evidence:

- Official FPL status/chance/news — existing production fact layer;
- recent starts/minutes — existing production input;
- confirmed lineups — useful for retrospective validation and future live use only where timing is decision-relevant;
- permitted predicted lineups/team news — future evidence candidate;
- injuries/suspensions — future factual evidence candidate;
- non-Premier-League player minutes — future workload evidence.

Predicted lineups must be treated as observations, not as a direct `pStart = 1/0` instruction. Multiple sources may disagree and source confidence can vary materially.

### 3.5 Calendar, congestion and workload

Question: **What did the club/player have to do around this Premier League fixture?**

Store facts rather than an invented fatigue coefficient:

- previous fixture time;
- next fixture time;
- competition;
- home/away/neutral venue;
- rest hours before/after the FPL fixture;
- matches in previous/next 7 and 14 days;
- extra time played;
- player minutes/starts in recent non-Premier-League matches;
- approximate travel distance where venue identity is reliable.

The primary hypothesis should be **minutes/rotation risk**, not “European game = reduce xP by N%”. Bookmakers may already price some team-level fatigue/rotation expectations.

### 3.6 Set-piece and role change

Question: **Has a player's responsibility changed in a way their historical rate may not yet reflect?**

Official FPL already carries penalty, direct-free-kick and corner/indirect-free-kick order fields. Future work should first detect and retain **role-change events** rather than add fixed projected-point bonuses.

Historical xG/xA may already contain penalties/set pieces. Automatically adding a second set-piece bonus risks double counting.

### 3.7 Fixture/matchup microstats

Question: **Does an opponent systematically permit a specific type of event that adds incremental information beyond general team strength and market prices?**

Examples could include set-piece concession, crosses, shots from zones or transition profiles. This is deliberately late-stage work because it has high data requirements and extremely high redundancy risk with xG/team strength/Odds.

No matchup-microstat source is selected by this document.

### 3.8 Transfer-specific intelligence

Football expected points and transfer strategy must remain separable.

Transfer economics may eventually include:

- buy/sell price;
- bank;
- free transfers and rollover;
- hit cost;
- horizon;
- squad flexibility;
- confirmed blank/double schedule;
- chip timing;
- evidence-backed price-change risk.

Competitive strategy may include ownership, global rank and selected-rival exposure.

Ownership and rival exposure must **never alter the underlying football xP**. They may affect a separately approved protect/balanced/chase strategy layer later.

---

## 4. Provider-neutral observation contract

A future External Intelligence Foundation should not let each provider invent its own state shape and write directly into model state.

The conceptual normalised observation contract should contain:

```text
identity
  observationId
  category
  subjectType        player | team | fixture | venue | competition
  subjectId
  fixtureId?         canonical FPL fixture identity where applicable
  competitionId?

value
  metric
  value
  unit?

timing
  observedAt         when the fact was true/observed at source
  effectiveAt?       when the underlying event/change took effect
  fetchedAt          when Teamsheet acquired it
  expiresAt?         when it must no longer be treated as current

source
  provider
  sourceIdentifier
  providerRecordId?
  transformVersion?

quality
  confidence?
  accepted
  rejectionReasons[]
  conflictStatus?

provenance
  sourceTimestamp?
  inputRevision?
  validationVersion

rights
  classification
  retentionAllowed
  redistributionAllowed
  attributionRequired

boundary
  mode                shadow_only | production_eligible
```

Expected-minutes evidence should normalise separately from raw source facts, for example:

```text
playerId
fixtureId
startProbability
appearanceProbability
p60
expectedMinutes
confidence
generatedAt
modelVersion
evidenceRefs[]
```

A source-predicted lineup should normally be one `evidenceRef`, not an instruction that overwrites the model output.

### 4.1 Canonical identity

Use Official FPL IDs as canonical identities wherever an equivalent exists. Provider IDs remain provenance.

Never join players solely by display name. A future provider requires a validated identity mapping with explicit unmatched/ambiguous handling.

### 4.2 Timing is first-class

`observedAt`, `effectiveAt` and `fetchedAt` are distinct. They must not be collapsed into one timestamp.

This is essential for avoiding hindsight leakage. A fact learned after the FPL deadline cannot be treated as though the model knew it before the deadline merely because it describes an earlier event.

---

## 5. Hard shadow boundary

The initial External Intelligence implementation, when separately approved, should be unable to affect a recommendation by construction.

Required flow:

```text
provider
  -> acquisition
  -> validation
  -> normalisation
  -> rights / retention gate
  -> SHADOW STORE
  -> research / evaluation only
```

Forbidden until a later approval:

```text
SHADOW STORE -X-> production fixture context
SHADOW STORE -X-> production expected minutes
SHADOW STORE -X-> scoring
SHADOW STORE -X-> best XI / captaincy
SHADOW STORE -X-> transfers
SHADOW STORE -X-> simulation / rank / Mini-Leagues
```

### 5.1 Required tests for the future foundation

A future implementation proposal should include structural tests that prove:

- production model modules do not import the shadow store;
- production model results are byte/structure identical with shadow data absent, present, stale, malformed or conflicting;
- a shadow provider failure cannot alter current Provider Health unless a distinct Shadow/Research status surface is explicitly approved;
- shadow writes cannot mutate current `S` model/provider inputs;
- shadow storage failure cannot block the verified refresh or recommendation path;
- unknown rights classifications fail closed for durable retention;
- secrets/keyed URLs/raw credentials never enter shadow records;
- display-name-only entity matching is rejected.

The boundary should be as strong as Stage 10's one-way evidence architecture: observation first, no automatic feedback loop.

---

## 6. Rights and retention classification

Every future source should receive one explicit classification before persistence:

- `durable_allowed` — normalised facts may be retained durably under the reviewed terms.
- `attribution_required` — durable/use appears permitted but attribution is a condition.
- `local_research_only` — useful for owner research but not approved for production/public retention.
- `durable_blocked` — may be queried transiently if otherwise permitted, but retention is not approved.
- `unknown_fail_closed` — rights/retention position is unresolved; do not persist beyond the minimum transient processing necessary.

Raw provider payloads should be transient by default even where normalised facts are retainable. Preserve only the fields needed to reproduce an accepted observation plus its provenance.

A terms page saying an API can be called is **not** automatically a licence to republish all underlying sports data. Provider terms and underlying competition/data rights must both be considered.

---

## 7. Free-source assessment — 12 August 2026 research snapshot

This table is a planning record, not implementation approval. Every row must be re-checked before use.

| Source | Best role | Current free access | Rights/retention research | Integration assessment | Planning verdict |
|---|---|---|---|---|---|
| **Official FPL** | Foundation: player/team/fixture/status/minutes/price/ownership/set-piece facts | Existing owner-controlled gateway and current production contracts | Existing Teamsheet governance applies | Already integrated and authoritative for game-specific facts | **Keep as foundation** |
| **The Odds API** | Match-specific market expectation | Free Starter currently 500 credits/month; current production request is approximately 2 credits per EPL h2h+totals call; historical odds are paid-only | Current terms permit websites/apps/dashboards/analytical tools where the market data is not itself resold/repackaged/redistributed as a standalone data product; API key must remain private | Existing integration already normalises/de-vigs/staleness-filters markets; uniquely prospectively lossy on free tier | **Keep; do not replace. Re-evaluate weight by prospective ablation** |
| **Understat** | Recent team xG/xGA | Public site; current Teamsheet relay parser is broken against measured page structure | Current repository governance is ToS-grey; no expansion approved; permanent server archival remains blocked | Useful conceptual layer, fragile acquisition, production value unproven | **Do not repair before GW1. Later test whether the layer earns its complexity** |
| **ClubElo** | Structural prior / early-season or promoted-team anchor | Public rankings/data; a CSV API is widely consumed at `api.clubelo.com` | ClubElo's own About page explicitly says its calculations, diagrams and rankings may be reused and asks for citation | Very small data surface; independent of xG; maps naturally to team-level prior | **Strongest next structural candidate after evidence foundation; test standalone, not blended by assumption** |
| **football-data.org** | Competition calendar; Premier League + Champions League basic schedules | Free tier currently 12 competitions, fixtures/schedules/tables, 10 calls/minute; free coverage includes Premier League and Champions League | Requires attribution; key is for a single application/domain; current terms say data obtained through the service may no longer be referenced after subscription cancellation, which complicates durable historical evidence | Clean REST API but free competition coverage excludes many useful domestic/European cup competitions | **Potential narrow calendar source, but incomplete workload picture and awkward retention contract** |
| **API-Football / API-SPORTS** | Broad competition fixtures, lineups, injuries, player match participation | Free currently 100 requests/day and 10 requests/minute; pricing advertises all endpoints/competitions with free-season limits | Terms permit building projects including fantasy games but explicitly state the service does not itself grant the licence/permission needed to publish supplied sports data and users must obtain relevant rights | Technically the most complete free candidate; rights burden is material | **Technical benchmark/research candidate only until rights for the intended production use are resolved** |
| **TheSportsDB** | Broad schedules/events/team/player metadata | Free API currently 30 requests/minute; many free queries have result limits | Terms say content returned by official API endpoints may be scraped/copied/modified, prohibit website scraping, and allow free API use for development projects; publishing an app-store app requires paid subscription | Rights wording is clearer than many alternatives; exact cup coverage/completeness/reliability still needs measured acceptance | **Promising shadow calendar/metadata candidate for the web app; measure coverage before selection** |
| **Wikidata** | Static team/venue identity, coordinates, geography | Public SPARQL GET/POST service | Main/property structured data is CC0 | Excellent for stable venue/team mapping and coordinates; not a live football feed | **Preferred static geography/travel support source where identity quality is sufficient** |
| **Football-Data.co.uk CSV archive** | Historical results/odds/match-stat research | Large free downloadable CSV archive; site currently advertises 31 seasons results, 26 seasons odds and 26 seasons match stats | Data is made available free for quantitative analysis, but the site footer states All Rights Reserved and no broad automated redistribution licence was identified in this review | Very useful offline historical research; not a current live provider replacement | **Research/backtest candidate only pending explicit rights position for automated/product use** |

### 7.1 First-party research references

Re-verify these at any future implementation checkpoint:

- The Odds API pricing: https://the-odds-api.com/
- The Odds API terms: https://the-odds-api.com/terms-and-conditions.html
- The Odds API historical endpoint: https://the-odds-api.com/liveapi/guides/v4/
- API-Football pricing: https://www.api-football.com/pricing
- API-Football terms: https://www.api-football.com/terms
- football-data.org pricing: https://www.football-data.org/pricing
- football-data.org coverage: https://www.football-data.org/coverage
- football-data.org terms: https://www.football-data.org/about
- TheSportsDB pricing: https://www.thesportsdb.com/docs_pricing.php
- TheSportsDB terms: https://www.thesportsdb.com/docs_terms_of_use.php
- ClubElo reuse statement: https://clubelo.com/About
- ClubElo data scope: https://clubelo.com/Data
- Wikidata SPARQL/CC0: https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service
- Football-Data.co.uk archive: https://www.football-data.co.uk/data.php

---

## 8. Source selection by role — current planning order

There is no useful single “best provider”. Selection should be role-specific.

### Market

1. **The Odds API** — keep.

No replacement is currently justified.

### Availability / expected minutes

1. Official FPL — current baseline.
2. API-Football — technically rich, but production rights are unresolved.
3. Other permitted team-news/lineup sources — future research only.

### Structural strength

1. Official FPL — current production baseline.
2. ClubElo — strongest independent candidate prior/anchor.
3. Understat — not a structural replacement; keep conceptually in recent-performance layer.

### Competition calendar / congestion

No single reviewed free source currently solves the whole problem cleanly.

- football-data.org: clean REST and free PL/UCL but incomplete cup coverage.
- API-Football: broad technical coverage but rights unresolved.
- TheSportsDB: terms are promising for API content; real competition coverage and reliability need measurement.

A future investigation should compare **coverage of the exact competitions involving 2026/27 Premier League clubs**, not generic competition counts.

### Geography / travel

1. Wikidata for static team/venue identity and coordinates where reliable.
2. Competition provider venue facts as event-level provenance.

Do not invent precise travel effects merely because distance can be calculated.

---

## 9. Data that cannot be safely reconstructed later

This is the main reason to think prospectively before changing anything.

| Signal | Reconstruct later? | Already preserved by current Stage 10? | Pre-GW1 action |
|---|---|---|---|
| Normalised Odds `xGH/xGA` actually used at the decision point | **No** on free Odds tier | **Yes, if Odds is active in the qualifying snapshot** | Operationally obtain a healthy qualifying Stage 10 capture and export it; no code change |
| Individual bookmaker prices used to build the market consensus | **No** on free historical tier | No | Do not add pre-GW1 collection solely for optional research |
| Intraday Odds line movement | **No** on free historical tier | No | No pre-GW1 code; future Shadow Odds collector only if a specific research question justifies it |
| FPL status/chance/news/set-piece orders/price/ownership at deadline | Feed mutates later | Yes | Existing Stage 10 is sufficient |
| PL fixture schedule as known at deadline | Later rescheduling can change feed | Yes | Existing Stage 10 is sufficient |
| External predicted lineups at deadline | Often overwritten/lost | No | No source selected; do not rush one in before GW1 |
| External press/team-news wording/timestamps | Partly reconstructible, often edited | Only current FPL news is preserved | Future source-specific shadow proposal |
| Confirmed lineups | Generally reconstructible after the match | Not required prospectively for the existing model | No urgency |
| European/domestic-cup team fixture schedule | Usually reconstructible | No dedicated external layer | Can begin prospectively after source approval |
| Player minutes in European/domestic cups | Usually reconstructible, but quality/source-dependent | No | Begin after approved source/identity contract; no pre-GW1 urgency |
| Tactical role/formation nuance | Often difficult to reconstruct consistently | No dedicated layer | Future factual shadow observations only |
| Third-party price-change predictions | Ephemeral | No | Future transfer-economics research only |

### 9.1 Critical Odds conclusion

Current Stage 10 is already sufficient for the **primary intended Odds ablation**: compare the existing normalized market layer against a replay with that layer removed, because the snapshot freezes the normalized Odds inputs that actually affected the prediction together with the other model inputs and build/model/rules identity.

Stage 10 is **not** sufficient to test alternative bookmaker-level de-vig/outlier transforms or market movement through the day because raw quote/time-series detail is not retained.

That lost optionality does **not** justify breaking the pre-GW1 freeze. A future Shadow Odds collector should only be proposed if the explicit research question expands from “does the current market layer add value?” to “does market movement or a different market transform add value?”.

---

## 10. Future Shadow Odds contingency — not approved now

If later justified, the smallest useful Shadow Odds record would retain **normalised research facts**, not the API key or keyed URL:

```text
fixtureId
providerEventId
capturedAt
kickoff
fairHomeWinProbability
fairDrawProbability
fairAwayWinProbability
consensusTotalGoals
derivedXGH
derivedXGA
booksUsed
marketCount
confidence
transformVersion
```

Potential fixed decision-relative capture points could then be pre-registered, e.g. one or more consistent offsets before deadline/kickoff.

Even then:

- production must not read the shadow record;
- the current 65% weight must remain unchanged until a separate evidence-led proposal;
- retention must pass the provider-rights gate;
- no raw key/keyed URL may be stored;
- no bookmaker-level raw export may be created merely to reconstruct a data feed for others.

Again: **this is a contingency design, not implementation approval.**

---

## 11. Double-counting risks

External intelligence is useful only if it adds information that is not already present elsewhere.

| Combination | Main risk | Required treatment |
|---|---|---|
| FPL team strength + ClubElo | Both represent broad team quality | Treat as structural alternatives/prior experiments first; ablate before blending |
| FPL team strength + Understat | Structural ability and recent performance overlap | Keep layers explicit; test incremental recent-form value |
| ClubElo + Understat | Broad quality and recent results/performance overlap | Do not blindly average; compare variants |
| Odds + any team-strength layer | Market already incorporates team quality | Odds remains its own match-specific layer; measure incremental value |
| Odds + injury/team news | Market likely prices public information | Use injury/news primarily for individual minutes; do not automatically add another team-goals penalty |
| Odds + congestion | Market may price rotation/fatigue expectations | Test workload through minutes first; separate team-strength effects later only with evidence |
| Player xG/xA + tactical-role inference | Recent rates may already reflect the role | Represent role change as structural-break evidence, not an automatic multiplier |
| Player xG + penalty/set-piece status | Historical xG already contains penalties taken | Do not add a fixed set-piece xP bonus |
| Matchup microstats + Understat/Odds | Similar opponent weaknesses may appear in team xG and market expectations | Require a high incremental-evidence threshold before activation |
| Ownership/rivals + player xP | Competitive context is not football ability | Keep entirely outside football projection |
| Blank/double fixtures + transfer strategy | Schedule is real football opportunity; strategy is horizon/economics | Confirmed fixtures affect projection; uncertainty about future rescheduling belongs in scenario/strategy layer |

No future provider should receive a positive weight merely because its individual correlation with points looks good. It must improve a predeclared out-of-sample comparison against the information already available to the model.

---

## 12. Prospective ablation plan

Future evaluation should pre-register variants before reviewing their outcomes.

Initial team-strength/market variants:

- **A — FPL structural baseline only**
- **B — FPL + Understat**
- **C — FPL + Odds**
- **D — FPL + ClubElo candidate prior/anchor**
- **P — actual production configuration used at the deadline**

Later, after the shadow foundation exists and evidence is captured:

- **E — workload/calendar-informed expected-minutes experiment**
- **F — richer availability/lineup-informed expected-minutes experiment**

Do not silently redefine A/B/C after observing results. Version transformations and acceptance rules.

### 12.1 Player projected-points evaluation

Useful measures include:

- MAE;
- RMSE;
- ranking quality / rank correlation where appropriate;
- top-K selection quality where it maps to a decision;
- calibration of stored probabilities/intervals for the uncertainty layer.

One Gameweek is not evidence of superiority.

### 12.2 Expected-minutes evaluation

Evaluate the actual outputs the model claims:

- start probability — Brier score, log loss and calibration;
- appearance probability — Brier/calibration;
- p60 — Brier/calibration;
- expected minutes — MAE/RMSE.

Segment performance where sample size permits:

- established starters;
- rotation-prone players;
- injury/return cases;
- congested schedules;
- high- versus low-confidence predictions.

### 12.3 Transfer evaluation

For each prospective deadline preserve:

- no-transfer baseline;
- recommended plan;
- outgoing players retained under baseline;
- incoming players;
- hits;
- horizon;
- realised points difference when the horizon completes.

The optimiser's `0.5 × rollDifference` is a judgement-based utility term and must **not** be reported as realised FPL points.

### 12.4 Experimental discipline

GW1–GW5 is an evidence-collection period, not a large validation sample.

If a change is designed or tuned after looking at GW1–GW5, those same Gameweeks cannot then be presented as proof that the change is superior. The revised method must face untouched future Gameweeks.

The historical aggregate `r≈0.80` remains method-flattered and must never be reused as an accuracy claim.

---

## 13. Pre-GW1 action — operational only

No External Intelligence code should be added before GW1.

The only relevant pre-GW1 actions are evidence operations already supported by the product:

1. keep the application code freeze;
2. verify the existing Odds provider can operate normally on the owner's device;
3. obtain an early Official-eligible Stage 10 insurance capture once the genuine window opens on **20 August 2026 at 18:30 BST**;
4. on **21 August 2026**, perform the preferred final verified refresh/capture around **18:10–18:20 BST** for the 18:30 deadline, while staying outside the two-minute cutoff;
5. confirm the Stage 10 record truthfully reports whether Odds affected the model;
6. export the final GW1 snapshot JSON and verify the file exists outside browser storage;
7. keep PR #119's live cloud-custody acceptance as its already separate gate.

If Odds fails at capture time, capture the truthful fallback state. Do not emergency-repair providers or change the model minutes before a deadline.

---

## 14. Post-GW1 implementation sequence — proposals only

This is the preferred order **if and when each checkpoint is separately approved**.

### Step 1 — finish evidence custody first

Complete PR #119's genuine live acceptance and close its custody decision before building a new collection surface. If its approved transport fails, solve that evidence problem under its own gate.

### Step 2 — External Intelligence Shadow Foundation

Implement only:

- provider-neutral observation contract;
- identity mapping boundary;
- timing/provenance contract;
- rights/retention classification;
- shadow persistence;
- hard no-production-read tests;
- research export/evaluation access.

No provider needs to be activated into recommendations in this step.

### Step 3 — Stage 10 replay/ablation harness

Build the ability to evaluate frozen prediction inputs under predeclared variants without contaminating the original prospective record. Start with the current FPL/Understat/Odds question because Stage 10 already contains the necessary normalized production inputs.

### Step 4 — competition/workload facts in shadow

After a source-specific rights/coverage approval:

- team fixtures across relevant competitions;
- rest intervals;
- competition labels;
- home/away/venue facts;
- then player participation/minutes where reliable.

Do not add a production fatigue penalty.

### Step 5 — role-change tracker from already available FPL facts

Research changes in:

- set-piece orders;
- status/news;
- starts/minutes;
- relevant role indicators already present in accepted data.

The initial output is evidence/change detection, not projected-point adjustment.

### Step 6 — richer expected-minutes shadow evidence

Evaluate permitted injury/lineup/workload observations against start/appearance/p60/expMin outcomes.

Only after this evidence exists should a proposed expected-minutes change be presented.

### Step 7 — ClubElo structural experiment

Evaluate ClubElo as a standalone structural prior/anchor candidate. Its intended question is early-season/promoted-team structural stability, not “add another 20% because another source exists”.

### Step 8 — Understat decision

Resolve two questions independently:

1. Can acquisition be made sustainable and acceptable under the intended use?
2. Does the recent-performance layer add out-of-sample value beyond FPL/Odds?

A parser repair may be worthwhile as a **shadow evidence collection** step without reactivating the production layer, but production repair should not be assumed.

### Step 9 — team-news/tactical facts

Only permitted, attributable sources with reliable timestamps and identity mapping should enter shadow research. Manual/official-source curation may be preferable to fragile scraping.

### Step 10 — matchup microstats last

Only investigate if earlier layers still leave a measurable, decision-relevant residual problem. This is the highest double-counting and data-complexity area.

### Step 11 — activation proposals

A shadow source can affect production only through a new approval proposal containing:

- current behaviour;
- proposed behaviour;
- exact input fields and source;
- acquisition cadence;
- identity mapping;
- fallback;
- assumptions and trade-offs;
- rights/security/retention position;
- prospective ablation evidence;
- available out-of-sample evidence;
- tests;
- rollback/disable behaviour.

No automatic promotion from shadow to production is allowed.

---

## 15. GW5 -> GW6 evidence-led review

The first major review remains the international break between GW5 and GW6.

Use the review in this order:

### A. Evidence integrity

Before discussing model quality, confirm:

- which deadlines have Official-eligible snapshots;
- which providers actually affected each prediction;
- provider age/coverage/rejection state;
- exported/durable custody status;
- outcome completeness/corrections;
- no hindsight substitution.

### B. Current model performance

Review:

- player projected points;
- expected minutes and pStart/pAppear/p60;
- uncertainty calibration/descriptive coverage;
- captaincy/bench decisions;
- completed transfer horizons where enough time has passed.

### C. Predeclared current-layer ablations

Where frozen data supports it, compare:

- FPL baseline;
- FPL + Understat;
- FPL + Odds;
- actual production configuration.

Do not infer ClubElo/workload performance unless those data were prospectively captured under a separately approved shadow checkpoint.

### D. Diagnose the error source

Separate errors caused by:

- team-goal expectation;
- player attacking rate;
- expected minutes;
- availability/news;
- fixture identity/schedule;
- optimiser decision logic;
- ordinary football variance.

Do not respond to every projection miss by adding another data source.

### E. Select the next experiment

Choose the narrowest source/layer that addresses the dominant evidenced error.

### F. Preserve a future holdout

Anything designed from GW1–GW5 must be evaluated on untouched future Gameweeks before predictive superiority is claimed.

---

## 16. Explicit non-approvals

This document does **not** approve:

- an Understat parser repair;
- a new provider or API key;
- ClubElo production use;
- football-data.org, API-Football, TheSportsDB or Wikidata integration;
- new background/scheduled collection;
- new D1/R2 schemas;
- permanent retention of Understat/Odds material beyond existing approved gates;
- raw bookmaker quote storage;
- an Odds weight change;
- a team-strength blend change;
- a fatigue/congestion coefficient;
- an expected-minutes formula change;
- predicted-lineup influence;
- set-piece xP bonuses;
- matchup microstats;
- transfer objective changes;
- ownership/rank/Mini-League strategy changes;
- any claim of improved accuracy.

Every item above requires its own evidence-led approval under the existing repository workflow.

---

## 17. Decision rule for future external intelligence

A source should be added only when all of the following are true:

1. it answers a named decision/model question;
2. the information is not already adequately represented by another layer;
3. free access is operationally sufficient for the intended cadence;
4. automated access/use/retention rights are acceptable for the proposed use;
5. identity and timestamps can be validated;
6. failure has a clear non-destructive fallback;
7. it can first operate in shadow without touching recommendations;
8. the ablation/evaluation method is defined before outcomes are inspected;
9. prospective evidence shows incremental value on an appropriate future holdout;
10. Pritesh explicitly approves any production influence.

The goal is not to collect the most football data. The goal is to add the smallest amount of independent, reliable information that measurably improves an FPL decision while preserving Teamsheet's deterministic, explainable and auditable architecture.


<!-- DATA-S1-2026-08-22 -->
## DATA-S1 repository foundation — 22 August 2026

The separately approved [DATA-S1 Shadow Structured Data Foundation](DATA-S1-SHADOW-STRUCTURED-DATA-FOUNDATION.md) adds the isolated, provider-neutral `teamsheet-data-platform` repository service and separate future `teamsheet-data` D1 binding. Only `shadow_only` is valid. It has no production/browser/model/Provider Health read path, no new R2, no provider activation and no Google Sheets integration; existing Stage 10 D1/R2 custody remains separate and unchanged. No live infrastructure was created or modified. The separately approved intended sequence is DATA-S2 Official FPL history, DATA-S3 automated Official outcomes, DATA-S4 provider trials/evaluation, DATA-S5 downstream Sheets automation, then later explicit production/model gates.

Effective **22 August 2026**, the owner superseded the blanket £0 recurring-cost constraint: free remains preferred where comparable, while a small paid provider may be considered only with explicit pricing, rights and value/cost justification, preferably after a shadow trial. This approves no provider and does not rewrite historical research conducted under the former constraint.
