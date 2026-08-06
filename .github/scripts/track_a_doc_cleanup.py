from pathlib import Path
import re

MAIN_SHA = "be742e1eb707b3892f6405adf5d8769e084eee65"
PR69_SHA = "00a35bacd2396a125a8a914bff9980b4f18b257f"
PR70_SHA = "78b2729c51419a36c5e6f757fa54830100b5435c"
TREE_SHA = "3794e8e7ab9859717950296766dc9d64c9e5473f"


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise AssertionError(f"{label}: expected one occurrence, found {count}")
    p.write_text(text.replace(old, new))


def replace_regex(path, pattern, new, label):
    p = Path(path)
    text = p.read_text()
    updated, count = re.subn(pattern, new, text, count=1, flags=re.S)
    if count != 1:
        raise AssertionError(f"{label}: expected one match, found {count}")
    p.write_text(updated)


# CLAUDE.md: make the interim reconciliation line explicitly historical.
replace_once(
    "CLAUDE.md",
    "- Automated verification: 609 passed, zero failed or skipped, deterministic builds. Physical iPhone Safari retest remains required.",
    "- Interim reconciliation verification was 609 passed with deterministic builds. That pending device gate was subsequently completed on PR #72 and is superseded by the accepted 613-test merged checkpoint above.",
    "CLAUDE interim device status",
)

# PROJECT_CONTEXT.md: remove the stale draft/unmerged conclusion from the earlier device update.
replace_once(
    "docs/PROJECT_CONTEXT.md",
    "Track A remains draft/unmerged pending final repository verification and explicit integration approval.",
    f"That interim state was subsequently verified and merged through PRs #69, #70 and #72 at final `main` `{MAIN_SHA}`, as recorded below.",
    "PROJECT_CONTEXT interim integration status",
)

# ROADMAP.md: replace obsolete upcoming work, blockers and handovers with the actual post-merge position.
replace_regex(
    "docs/ROADMAP.md",
    r"## Upcoming\n.*?(?=\n\n## Current blockers and gates)",
    """## Upcoming
1. Operate pre-deadline snapshots and durable owner-controlled exports during the 2026/27 season.
2. Complete feature-specific live populated acceptance still listed for Team captain/bench, Fixtures, Player Detail and Leagues.
3. Collect Official outcomes and descriptive metrics prospectively; do not claim accuracy or calibration until approved sample safeguards are met.
4. Investigate any new product, provider, model or Track B proposal before defining scope or implementation. No new implementation item is currently approved.""",
    "ROADMAP upcoming",
)
replace_regex(
    "docs/ROADMAP.md",
    r"## Current blockers and gates\n.*?(?=\n\n## Post-merge Teamsheet 2\.0\.1 investigations)",
    """## Current blockers and gates
1. Physical iPhone and live populated acceptance is not recorded for every Team, Fixtures, Player Detail and Leagues path; the tested Transfers paths must not be generalised to those features.
2. VoiceOver was deliberately not tested for Track A and remains accepted-unverified elsewhere; no physical screen-reader claim is permitted.
3. A persistent screenshot-regression suite is absent; visual changes still require human device checks.
4. Free historical odds and other missing pre-deadline provider snapshots require prospective 2026/27 logging.
5. Prospective sample size begins at zero; Stage 10 infrastructure does not establish model accuracy or calibration.
6. Projected live rank, projected rival outcomes, remaining-player simulations and protect/balanced/chase strategy logic require separate designs and explicit approval.
7. Official FPL endpoints remain undocumented and can drift; validation must continue to fail closed.
8. Bank and available free transfers remain manual rather than proven authoritative account values.""",
    "ROADMAP blockers",
)
replace_once(
    "docs/ROADMAP.md",
    "- Non-blocking foreground refresh, reliable populated Official FPL transport and authoritative read-only bank/free-transfer retrieval remain separately gated investigations.",
    "- Non-blocking foreground refresh and reliable Official FPL transport are implemented and merged; authoritative read-only bank/free-transfer retrieval remains separately gated.",
    "ROADMAP post-2.0.1 investigation",
)
replace_regex(
    "docs/ROADMAP.md",
    r"## Teamsheet 2\.0\.7 current handover\n.*?(?=\n\n## Transfers Track A corrective status)",
    f"""## Teamsheet 2.0.7 final handover

Scope S-2.0.7 is complete and merged through PR #68. Its Safari foreground-resume correction passed owner retest. VoiceOver remains accepted-unverified. Subsequent FPL-T1 and Track A work is complete and merged through PR #69 (`{PR69_SHA}`), PR #70 (`{PR70_SHA}`) and PR #72 (`{MAIN_SHA}`). Remaining live populated acceptance is tracked by feature and does not reopen the completed checkpoint.""",
    "ROADMAP 2.0.7 handover",
)
replace_regex(
    "docs/ROADMAP.md",
    r"## Transfers Track A corrective status — 2026-08-06\n.*?Track B football-intelligence changes remain outside this checkpoint and unapproved\.",
    f"""## Transfers Track A final status — 2026-08-06

- [x] Record the first physical iPhone Safari evaluation-ceiling failure and its root cause.
- [x] Rebuild the exact search with admissible position-quota, price-capped and joint-budget bounds plus descending-gain stopping rules.
- [x] Preserve the independent exhaustive oracle and prove exactness on controlled adversarial pools.
- [x] Complete Official-scale exact-search verification below the unchanged ceiling.
- [x] Correct Worker cancellation/supersession settlement and mixed-width-ID partial tie bounds.
- [x] Correct the separate no-transfer baseline presentation contract without changing ranked Top K.
- [x] Replace zero-cost **“−0”** copy with **“No hit”**.
- [x] Pass the final 613-test gate with deterministic production builds and root/deployable equality.
- [x] Pass the populated physical iPhone Safari calculation and lifecycle checks, including the final wording confirmation.
- [x] Receive explicit stacked integration approval and merge PR #69, PR #70 and PR #72 in order.

Final `main` is `{MAIN_SHA}` and has the identical tree `{TREE_SHA}` as the verified PR #72 head. VoiceOver was not tested. Track B football-intelligence changes remain outside this checkpoint and unapproved.""",
    "ROADMAP Track A final status",
)
replace_regex(
    "docs/ROADMAP.md",
    r"## 2026-08-06 — Concurrent continuation reconciliation\n.*?(?=\n\n### Track A acceptance update)",
    """## 2026-08-06 — Concurrent continuation reconciliation

- [x] Assess and retain Claude's concurrent exact-search correction.
- [x] Reconcile explicit cancellation and force-start promise settlement.
- [x] Harden partial signature bounds for mixed-width IDs.
- [x] Complete the combined 609-test interim verification, followed by the final 613-test baseline/presentation/copy gate.
- [x] Publish and physically test the combined preview on populated iPhone Safari.
- [x] Record duration, responsiveness, cancellation, persistence, cache reuse, app-switch and stale-result evidence.
- [x] Obtain explicit approval and complete the stacked integration sequence.

VoiceOver was deliberately not tested and is not an acceptance claim.""",
    "ROADMAP reconciliation checklist",
)
replace_regex(
    "docs/ROADMAP.md",
    r"### Track A acceptance update — 2026-08-06\n.*?(?=\n\n## Track A merge record)",
    f"""### Track A acceptance update — 2026-08-06

Core populated-data iPhone Safari acceptance passed for the exact six-Gameweek calculation and tested lifecycle paths, and the final **“No hit”** wording was visually confirmed. The accepted repository gate is 613 passing tests with deterministic builds. The approved stack is merged through final `main` `{MAIN_SHA}`. VoiceOver was not physically tested and is not an acceptance claim for this release.""",
    "ROADMAP acceptance update",
)

# KNOWN_LIMITATIONS.md: correct the remaining migration-summary reference to a draft PR.
replace_once(
    "docs/KNOWN_LIMITATIONS.md",
    "- Teamsheet 2.0.7 is merged through PR #68; its Safari foreground-resume correction passed owner retest and VoiceOver remains accepted-unverified. FPL-T1 now provides verified live bootstrap transport on draft PR #69, while full populated application acceptance remains open under FPL-2.",
    f"- Teamsheet 2.0.7 is merged through PR #68; its Safari foreground-resume correction passed owner retest and VoiceOver remains accepted-unverified. FPL-T1 and Track A are merged through PRs #69–#72 at `{MAIN_SHA}`; tested Transfers paths passed, while remaining feature-specific populated acceptance stays open under FPL-2.",
    "KNOWN_LIMITATIONS migration summary",
)
