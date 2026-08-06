from pathlib import Path

MARKER = "## 2026-08-06 — Transfers exact-search physical-test correction"

sections = {
    "CLAUDE.md": """
## 2026-08-06 — Transfers exact-search physical-test correction

- Physical iPhone Safari Test 1 reached the unchanged 2,000,000-evaluation safety ceiling at the default six-Gameweek horizon. The fail-closed contract worked: no partial incumbent was presented as optimal.
- Track A was corrected without changing projections, football formulas, candidate eligibility, transfer depth, ranking, tie-breaks, horizon limits, pricing, hits, free-transfer utility or the safety ceiling.
- The exact optimiser now applies tighter identity-preserving optimistic bounds throughout the search tree and tie-aware pruning that respects the existing comparator.
- Independent exhaustive-oracle, tie-heavy, negative-score and official-scale regressions now cover the correction.
- Automated gate: 597 passing tests and deterministic production builds. A 650-candidate six-Gameweek synthetic run completed with 11,128 exact leaf evaluations; this is engineering evidence only, not physical-iPhone acceptance.
- Physical iPhone retest remains the approval gate. Track B football-intelligence work remains unapproved and unimplemented.
""",
    "docs/PROJECT_CONTEXT.md": """
## 2026-08-06 — Transfers exact-search physical-test correction

**Observed fact:** the first physical iPhone Safari run of Track A failed to complete at the default six-Gameweek horizon because the exact optimiser reached the unchanged 2,000,000-evaluation ceiling. The interface correctly withheld partial recommendations.

**Approved corrective scope:** performance architecture only. The complete player universe, zero-to-three transfer depth, model projections, scoring formulas, affordability, club limits, hits, free-transfer utility, comparator and deterministic ordering remain unchanged.

**Correction:** tighter identity-preserving optimistic bounds are now evaluated at each exact-search node. Equal-score pruning uses optimistic bank, doubtful-player and canonical-signature values so it cannot discard a plan that could win under the existing comparator.

**Evidence:** 597 repository tests pass. New tests compare the production search with the independent exhaustive oracle across official-scale-shaped, tie-heavy, negative and tied projection cases. A 650-candidate, six-Gameweek synthetic run completed at 11,128 exact leaf evaluations.

**Remaining gate:** repeat the physical iPhone Safari acceptance test. Synthetic or CI timing does not establish device speed, memory behaviour, cancellation latency or responsiveness.
""",
    "docs/ARCHITECTURE.md": """
## 2026-08-06 — Exact-search bound correction

The Transfers worker still runs the canonical optimiser verbatim in one app-scoped Web Worker. The search remains complete and exact.

The search tree now combines two safe optimistic ceilings:

1. the existing relaxed per-position best-XI ceiling; and
2. an identity-preserving ceiling built from each remaining candidate's best possible marginal contribution across the horizon.

At each node, the tighter ceiling may prune only when the branch cannot beat the current top-K frontier under the full existing comparator. Equal-score pruning uses optimistic bank remaining, doubtful-incoming count and canonical signature. Affordability and club checks remain exact leaf constraints.

No candidate pre-filter, heuristic shortlist, approximate scoring path or altered evaluation ceiling was introduced.
""",
    "docs/DECISIONS.md": """
## 2026-08-06 — Decision: preserve exactness after the first physical-test failure

**Decision:** retain the 2,000,000-evaluation fail-closed ceiling and strengthen only mathematically optimistic branch bounds.

**Rejected alternatives:**
- increasing the ceiling and asking Safari to do more work;
- limiting the player universe;
- reducing the default horizon or transfer depth;
- returning a partial incumbent;
- changing model scores or recommendation ordering.

**Reason:** each rejected option would weaken safety, exactness or the approved product behaviour. The implemented bounds alter traversal and pruning only; exhaustive-oracle tests verify identical plans and order.
""",
    "docs/ROADMAP.md": """
## 2026-08-06 — Transfers Track A corrective status

- [x] Record first physical iPhone Safari failure at the two-million evaluation ceiling.
- [x] Add exact identity-preserving and tie-aware branch bounds.
- [x] Add official-scale, tie-heavy, negative-score and exhaustive-oracle regressions.
- [x] Pass the 597-test repository gate and deterministic build verification.
- [ ] Repeat physical iPhone Safari Test 1 on the corrected preview.
- [ ] Complete navigation persistence, cancellation, cache reuse and VoiceOver physical checks.
- [ ] Obtain explicit approval before merge.

Track B football-intelligence changes remain outside this checkpoint.
""",
    "docs/KNOWN_LIMITATIONS.md": """
## 2026-08-06 — Transfers exact-search device limitation

The first physical iPhone Safari test of Track A reached the exact optimiser's two-million evaluation safety ceiling and returned no recommendation. The architecture has since been corrected with tighter exact bounds and passes official-scale-shaped automated tests, but physical device acceptance is still pending.

CI and synthetic Node timing cannot establish iPhone Safari speed, memory pressure, thermal behaviour, background-worker persistence or cancellation latency. Until the physical retest passes, Transfers Track A is not device-accepted.
""",
    "docs/TESTING.md": """
## 2026-08-06 — Transfers exact-search corrective evidence

The first physical iPhone Safari Test 1 reached the unchanged 2,000,000-evaluation ceiling. Expected fail-closed behaviour was observed: `search-incomplete` produced no partial recommendation.

Corrective automated coverage now includes:

- production search versus the independent exhaustive oracle;
- official-scale-shaped pools with all four positions and six Gameweeks;
- tie-heavy comparator paths;
- negative and tied projection values;
- unchanged safety-ceiling fail-closed behaviour;
- deterministic profiling and exact plan ordering.

The repository gate passes **597 tests** with zero failures or skips. A 650-candidate, six-Gameweek synthetic benchmark completed with **11,128 exact leaf evaluations**, **122 identity-bound prunes** and **117 materialised contenders**. This benchmark is not physical-device acceptance evidence.

Physical retest must verify automatic start, completion, responsive navigation, worker persistence, cancellation, cached reuse and VoiceOver status announcements.
""",
    "docs/CHANGELOG.md": """
## 2026-08-06 — Transfers exact-search physical-test correction

### Fixed
- Strengthened exact branch-and-bound pruning after the first iPhone Safari test reached the two-million evaluation ceiling.
- Added identity-preserving optimistic ceilings and comparator-aware tie pruning without changing transfer recommendations or model inputs.
- Added official-scale, tie-heavy, negative-score and exhaustive-oracle regression coverage.

### Verification
- 597 tests pass.
- Deterministic production build retained.
- Model version remains 2.4.0.
- Rules version remains 2026-27.3.
- Physical iPhone retest remains pending.
""",
    "docs/TRANSFERS-EXACT-PERFORMANCE.md": """
## 2026-08-06 — Physical Test 1 failure and exact correction

### Observed failure

On iPhone Safari, the default six-Gameweek run reached the unchanged 2,000,000-evaluation ceiling. Teamsheet displayed `Exact search did not complete` and withheld all partial plans. That confirms the safety contract worked, but the performance acceptance gate failed.

### Corrective architecture

The candidate universe, score rows, transfer depths, affordability rules, club constraints, hit calculation, free-transfer utility, plan comparator and top-K contract are unchanged.

The exact search now adds:

- an identity-preserving optimistic horizon gain for each candidate;
- a required-position upper bound at every recursive node;
- branch ordering by optimistic identity gain, then cost and ID;
- optimistic tie fields for bank, doubtful incoming players and canonical signature;
- deterministic profiling of identity-bound prunes.

These values are optimistic relaxations. They can remove a branch only when even its best fictional completion cannot beat the current top-K frontier under the existing comparator.

### Automated evidence

- 597 repository tests pass.
- Production output remains deterministic.
- Official-scale-shaped, tie-heavy, negative-score and tied-score cases match the independent exhaustive oracle exactly.
- A 650-candidate six-Gameweek synthetic run completed with 11,128 exact leaf evaluations, 122 identity-bound prunes and 117 materialised contenders.

### Remaining acceptance gate

The synthetic run does not establish iPhone Safari performance. The corrected preview must repeat the full physical checklist before Track A can be accepted.
""",
}

for raw_path, section in sections.items():
    path = Path(raw_path)
    text = path.read_text()
    if MARKER in text:
        raise SystemExit(f"marker already present in {raw_path}")
    path.write_text(text.rstrip() + "\n\n" + section.strip() + "\n")
