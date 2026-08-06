from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise AssertionError(f"{label}: expected one occurrence, found {count}")
    return text.replace(old, new)


def update_source_and_tests() -> None:
    view = Path("src/ui/transfer-optimiser-view.mjs")
    source = view.read_text()

    net_block = """function transferPlannerNetLabel(value){
  const n=Number(value)||0;
  if(Math.abs(n)<0.05) return 'Level net model comparison';
  return `${n>0?'+':'−'}${Math.abs(n).toFixed(1)} net model ${n>0?'advantage':'disadvantage'}`;
}

function transferPlannerPlanNames"""
    hit_block = """function transferPlannerNetLabel(value){
  const n=Number(value)||0;
  if(Math.abs(n)<0.05) return 'Level net model comparison';
  return `${n>0?'+':'−'}${Math.abs(n).toFixed(1)} net model ${n>0?'advantage':'disadvantage'}`;
}

function transferPlannerHitLabel(value){
  const points=Math.max(0,Math.trunc(Number(value)||0));
  return points?`−${points}`:'No hit';
}

function transferPlannerPlanNames"""
    source = replace_once(source, net_block, hit_block, "hit-label insertion")
    source = replace_once(
        source,
        "transferPlannerMetric('Hit',`−${Number(plan.hitCost)||0}`,'Actual FPL transfer deduction')",
        "transferPlannerMetric('Hit',transferPlannerHitLabel(plan.hitCost),'Actual FPL transfer deduction')",
        "details hit copy",
    )
    source = replace_once(
        source,
        "transferPlannerMetric('Hit',`−${Number(plan.hitCost)||0}`,plan.hitCost?'Paid transfer cost':'No points deduction')",
        "transferPlannerMetric('Hit',transferPlannerHitLabel(plan.hitCost),plan.hitCost?'Paid transfer cost':'No points deduction')",
        "plan-card hit copy",
    )
    source = replace_once(
        source,
        "transferPlannerMetric('Hit','−0','No points deduction')",
        "transferPlannerMetric('Hit',transferPlannerHitLabel(baseline.hitCost),'No points deduction')",
        "baseline hit copy",
    )
    source = replace_once(
        source,
        "  transferPlannerNetLabel,\n  transferPlannerPlanNames,",
        "  transferPlannerNetLabel,\n  transferPlannerHitLabel,\n  transferPlannerPlanNames,",
        "hit-label export",
    )
    view.write_text(source)

    test_file = Path("tests/transfer-baseline-presentation.test.mjs")
    tests = test_file.read_text()
    marker = "test('zero transfer costs use plain No hit copy instead of a negative zero'"
    if marker in tests:
        raise AssertionError("copy regression already exists")
    tests += """

test('zero transfer costs use plain No hit copy instead of a negative zero',async()=>{
  const {T,doc,workers}=openTransfers({trTop:'1'});
  T.renderTransfers();
  await settle();
  sendResult(workers[0],{status:'ok',issues:[],plans:[strongerTransferPlan(T)],evaluations:12,pruned:3,baseline:baselinePlan(),pricingMode:'exact'});
  await settle();

  const text=visibleText(doc.transferOut);
  assert.match(text,/No hit/);
  assert.doesNotMatch(text,/−0/);
});
"""
    test_file.write_text(tests)


def append_entry(path: str, entry: str) -> None:
    target = Path(path)
    text = target.read_text()
    heading = entry.strip().splitlines()[0]
    if heading in text:
        raise AssertionError(f"documentation entry already exists: {path}")
    target.write_text(text.rstrip() + "\n\n" + entry.strip() + "\n")


def update_docs() -> None:
    entries = {
        "docs/DECISIONS.md": """
## 2026-08-06 — Plain-language decision information

**Decision:** user-facing FPL information must be simple, relevant and immediately understandable. A zero transfer-points cost is displayed as **“No hit”**, never as the mathematically awkward **“−0”**. Paid transfer costs retain their actual deduction, such as **“−4”** or **“−8”**. This is a presentation rule only and does not alter optimiser values, scoring or ranking.
""",
        "docs/TESTING.md": """
## 2026-08-06 — Track A physical iPhone Safari evidence

Pritesh physically tested the reconciled PR #72 preview on iPhone Safari with populated Official FPL data. The default six-Gameweek exact calculation completed in approximately **15 seconds** and displayed both the highest-ranked transfer plan and the separate no-transfer baseline. Internal navigation preserved completed results; cancellation and restart responded promptly; an active calculation survived navigation; leaving and returning to Safari caused no freeze or reload; and a newer three-Gameweek request was not overwritten by the older eight-Gameweek result.

VoiceOver was not tested and must not be claimed as physically verified. A final production-bundle regression requires every zero transfer cost to render as **“No hit”** and forbids **“−0”** anywhere in the displayed transfer result.
""",
        "docs/PROJECT_CONTEXT.md": """
## Track A device acceptance update — 2026-08-06

The reconciled exact Transfers flow has passed its core physical iPhone Safari checks on populated data: six-Gameweek completion in about 15 seconds, cached navigation restoration, prompt cancellation/restart, active-navigation persistence, Safari app-switch stability and stale-result protection. The final approved display correction replaces confusing zero-cost **“−0”** text with **“No hit”** everywhere. Track A remains draft/unmerged pending final repository verification and explicit integration approval.
""",
        "docs/ROADMAP.md": """
### Track A acceptance update — 2026-08-06

Core populated-data iPhone Safari acceptance passed for PR #72. Remaining work before integration is limited to verifying the approved plain-language zero-hit display correction, updating generated files and obtaining explicit stacked merge approval. VoiceOver was not physically tested and is not an acceptance claim for this release.
""",
        "docs/KNOWN_LIMITATIONS.md": """
## Track A physical-test limitation — 2026-08-06

The populated Transfers workflow was physically tested on Pritesh's iPhone Safari, but VoiceOver was deliberately not tested. Do not claim physical screen-reader verification. The device result is evidence for the tested calculation, navigation, cancellation, app-switch and stale-result paths only.
""",
        "docs/CHANGELOG.md": """
## 2026-08-06 — Transfers plain-language zero-hit copy

- Replaced confusing **“−0”** transfer-cost output with **“No hit”** across baseline cards, plan summaries and review details.
- Added a production-bundle regression that forbids negative-zero hit copy.
- Recorded populated iPhone Safari evidence: six-Gameweek completion in about 15 seconds, navigation persistence, cancellation/restart, app-switch stability and stale-result protection.
- No optimiser, projection, scoring, ranking, candidate or transfer-rule behaviour changed.
""",
        "docs/TRANSFERS-EXACT-PERFORMANCE.md": """
## Physical iPhone Safari result — 2026-08-06

On populated Official FPL data, the reconciled six-Gameweek exact calculation completed in approximately 15 seconds on Pritesh's iPhone Safari. Completed-result restoration, cancellation/restart, navigation during calculation, Safari background/return and stale-result protection all behaved smoothly. This is device evidence for the tested scenario, not a universal performance guarantee. VoiceOver was not tested. The final presentation rule renders a zero transfer cost as **“No hit”**, without changing the numeric result.
""",
        "CLAUDE.md": """
## Handover update — 2026-08-06

- PR #72 core populated-data iPhone Safari checks passed: six-GW exact completion ~15 seconds; completed and active navigation persistence; prompt cancel/restart; Safari app-switch stability; stale-result protection.
- VoiceOver was not tested and must not be claimed as physically verified.
- Product wording rule: user-facing FPL information must be simple and immediately understandable. Zero transfer cost is **“No hit”**, never **“−0”**.
- This final copy correction is presentation-only. Do not change optimiser, football model, ranking or transfer rules without a new approval gate.
- PRs remain draft/unmerged until Pritesh explicitly approves the stacked integration sequence.
""",
    }
    for path, entry in entries.items():
        append_entry(path, entry)


if __name__ == "__main__":
    update_source_and_tests()
    update_docs()
