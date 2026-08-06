from pathlib import Path
import re

MAIN_SHA = "be742e1eb707b3892f6405adf5d8769e084eee65"
PR69_SHA = "00a35bacd2396a125a8a914bff9980b4f18b257f"
PR70_SHA = "78b2729c51419a36c5e6f757fa54830100b5435c"
PR72_HEAD = "7257e8601b4a4f2fae80ce30a787f7069974a926"
TREE_SHA = "3794e8e7ab9859717950296766dc9d64c9e5473f"

TRACK_BLOCK = f"""<!-- TRANSFERS-TRACK-A-2026-08-06 -->
> **Current Track A status — complete and merged:** FPL-T1 and Track A are integrated on `main` through PR #69 (`{PR69_SHA}`), PR #70 (`{PR70_SHA}`) and PR #72 (`{MAIN_SHA}`). The final `main` merge commit and the verified PR #72 head (`{PR72_HEAD}`) have the identical repository tree `{TREE_SHA}`. The accepted branch baseline is **613 passed, 0 failed, 0 skipped** with deterministic production builds and root/deployable equality. On populated physical iPhone Safari, the six-Gameweek exact calculation completed in about 15 seconds; completed and active navigation persistence, prompt cancellation/restart, Safari app switching, stale-result protection, the separate no-transfer baseline and the final **“No hit”** wording all passed. VoiceOver was deliberately not tested and must not be claimed as physically verified. No prediction-accuracy improvement is claimed, and Track B football intelligence remains unapproved and unimplemented."""


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_regex(path, pattern, replacement, label, flags=re.S):
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise AssertionError(f"{label}: expected one match, found {count}")
    write(path, updated)


def replace_text(path, old, new, label):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise AssertionError(f"{label}: expected one occurrence, found {count}")
    write(path, text.replace(old, new))


def replace_row(path, row_id, replacement):
    replace_regex(path, rf"^\| {re.escape(row_id)} \|.*$", replacement, f"{path}:{row_id}", flags=re.M)


def append_section(path, heading, body):
    text = read(path)
    if heading in text:
        raise AssertionError(f"{path}: section already exists: {heading}")
    write(path, text.rstrip() + "\n\n" + heading + "\n\n" + body.strip() + "\n")


def update_claude():
    path = "CLAUDE.md"
    replace_regex(path, r"<!-- TRANSFERS-TRACK-A-2026-08-06 -->\n> .*?(?=\n\n)", TRACK_BLOCK, "CLAUDE Track block")
    checkpoint = f"""## Current checkpoint
FPL-T1 and Track A are complete and merged on `main` through PR #69 (`{PR69_SHA}`), PR #70 (`{PR70_SHA}`) and PR #72 (`{MAIN_SHA}`). The final merge tree exactly matches the verified PR #72 tree `{TREE_SHA}`. The accepted automated baseline is **613 passed, 0 failed, 0 skipped**, with deterministic production builds and root `index.html` equal to `dist/index.html`. Populated iPhone Safari acceptance passed for the exact Transfers calculation and tested lifecycle paths; VoiceOver was not tested. Full live populated acceptance outside the tested Transfers paths remains open where separately recorded, including other Team, Fixtures, Player Detail and Leagues flows. Current operational work is pre-season readiness and prospective 2026/27 evidence collection. No new product, provider, model or Track B implementation is approved; begin any new development with investigation, exact scope and Pritesh's explicit approval."""
    replace_regex(path, r"## Current checkpoint\n.*?(?=\n\n## Non-negotiable rules)", checkpoint, "CLAUDE current checkpoint")
    replace_text(
        path,
        "- PRs remain draft/unmerged until Pritesh explicitly approves the stacked integration sequence.",
        f"- PRs #69, #70 and #72 were explicitly approved and merged in sequence; final `main` is `{MAIN_SHA}` and matches the verified PR #72 tree.",
        "CLAUDE handover merge status",
    )


def update_project_context():
    path = "docs/PROJECT_CONTEXT.md"
    replace_regex(path, r"<!-- TRANSFERS-TRACK-A-2026-08-06 -->\n> .*?(?=\n\n)", TRACK_BLOCK, "PROJECT_CONTEXT Track block")
    fpl = f"> **FPL-T1 and Track A:** Complete and merged through PR #69 (`{PR69_SHA}`), PR #70 (`{PR70_SHA}`) and PR #72 (`{MAIN_SHA}`). The owner-controlled Official FPL gateway remains transport-only, and the exact browser-worker optimiser remains local to the app. The final accepted automated baseline is **613 passed, 0 failed, 0 skipped** with deterministic builds; the tested populated iPhone Safari Transfers paths passed. Remaining live populated acceptance outside those tested paths stays separately recorded."
    replace_regex(path, r"> \*\*FPL-T1 current work:\*\*.*?(?=\n\n)", fpl, "PROJECT_CONTEXT FPL-T1 block")
    ts = f"> **Teamsheet 2.0.7:** Complete and merged through PR #68. Its Safari foreground-resume correction passed owner retest. Subsequent FPL-T1 and Track A work is merged through PRs #69, #70 and #72 at final `main` `{MAIN_SHA}`. VoiceOver remains accepted-unverified."
    replace_regex(path, r"> \*\*Teamsheet 2\.0\.7:\*\*.*?(?=\nPurpose:)", ts + "\n", "PROJECT_CONTEXT 2.0.7 block")
    replace_text(path, "Audience: anyone joining the project. Last updated: 2026-08-05.", "Audience: anyone joining the project. Last updated: 2026-08-06.", "PROJECT_CONTEXT updated date")
    marker = "## Current status\n"
    insertion = f"## Current status\n- FPL-T1 and Track A are complete and merged through PRs #69, #70 and #72; final `main` is `{MAIN_SHA}` and has the exact verified PR #72 tree `{TREE_SHA}`. Accepted verification: **613 passed, 0 failed, 0 skipped**, deterministic builds and populated iPhone Safari acceptance for the tested Transfers paths.\n"
    replace_text(path, marker, insertion, "PROJECT_CONTEXT current status insertion")
    current = f"Current development item: **no new implementation checkpoint is approved.** FPL-T1 and Track A are merged through PRs #69, #70 and #72 at `{MAIN_SHA}`. Current work is pre-season readiness, live operational checks and prospective 2026/27 evidence collection. Full populated acceptance outside the tested Transfers paths remains separately tracked. Any new product, provider, model or Track B work requires investigation, an exact scope and Pritesh's explicit approval."
    replace_regex(path, r"Current development item:.*?(?=\n\n## Teamsheet 2\.0 migration checkpoints)", current, "PROJECT_CONTEXT current development item")
    append_section(
        path,
        "## Track A integrated checkpoint — 2026-08-06",
        f"PR #69 merged at `{PR69_SHA}`, PR #70 at `{PR70_SHA}` and PR #72 at `{MAIN_SHA}`. The final merge tree `{TREE_SHA}` is identical to the verified PR #72 head tree, so integration introduced no content drift. The accepted runtime/build evidence remains 613 passing tests, deterministic production builds and the recorded populated iPhone Safari checks. VoiceOver was not tested. Track B remains unapproved.",
    )


def update_roadmap():
    path = "docs/ROADMAP.md"
    replace_regex(path, r"<!-- TRANSFERS-TRACK-A-2026-08-06 -->\n> .*?(?=\n\n)", TRACK_BLOCK, "ROADMAP Track block")
    current_item = f"> **Current approved item:** No new implementation item is approved. FPL-T1 and Track A are complete and merged through PR #69 (`{PR69_SHA}`), PR #70 (`{PR70_SHA}`) and PR #72 (`{MAIN_SHA}`). Current work is pre-season readiness and prospective evidence collection; Track B remains separately gated."
    replace_regex(path, r"> \*\*Current approved item — FPL-T1:\*\*.*?(?=\n\n)", current_item, "ROADMAP current approved item")
    replace_text(path, "Purpose: stage plan with status. Audience: session planning. Last updated: 2026-08-05.", "Purpose: stage plan with status. Audience: session planning. Last updated: 2026-08-06.", "ROADMAP updated date")
    completed_marker = "## Completed\n"
    completed = f"## Completed\n- **FPL-T1 and Track A — Official FPL gateway plus exact persistent Transfers** · COMPLETE AND MERGED through PR #69 (`{PR69_SHA}`), PR #70 (`{PR70_SHA}`) and PR #72 (`{MAIN_SHA}`). Final accepted evidence: 613 passing tests, deterministic builds, exact merge-tree identity and populated iPhone Safari acceptance for the tested Transfers paths; VoiceOver was not tested.\n"
    replace_text(path, completed_marker, completed, "ROADMAP completed insertion")
    current_section = """## Current
- **Pre-season readiness and prospective validation** · OPERATIONAL. Genuine pre-deadline evidence collection begins with the 2026/27 season.
- **Remaining live populated acceptance outside tested Transfers paths** · OPEN where separately recorded for Team, Fixtures, Player Detail and Leagues.
- **New implementation work** · NOT APPROVED. Track B and any product, provider or model change require a new investigation and approval gate."""
    replace_regex(path, r"## Current\n.*?(?=\n\n## Teamsheet 2\.0 migration sequence)", current_section, "ROADMAP current section")
    migration = """7. **Teamsheet 2.0.7 — Final mobile polish and acceptance** · COMPLETE AND MERGED through PR #68.
   - Safari foreground-resume behaviour passed owner retest.
   - VoiceOver remains accepted-unverified.
   - Subsequent FPL-T1 and Track A integration is complete through PRs #69, #70 and #72; remaining live populated acceptance is tracked by feature rather than blocking the merged checkpoint."""
    replace_regex(path, r"7\. \*\*Teamsheet 2\.0\.7 — Final mobile polish and acceptance\*\*.*?(?=\n\nEvery checkpoint)", migration, "ROADMAP migration item 7")
    append_section(
        path,
        "## Track A merge record — 2026-08-06",
        f"The approved stack merged in order: PR #69 → `{PR69_SHA}`, PR #70 → `{PR70_SHA}`, PR #72 → `{MAIN_SHA}`. Final `main` has the same tree `{TREE_SHA}` as the verified PR #72 head. No Track B work was pulled forward.",
    )


def update_limitations():
    path = "docs/KNOWN_LIMITATIONS.md"
    replace_text(path, "Last updated: 2026-08-05.", "Last updated: 2026-08-06.", "KNOWN_LIMITATIONS updated date")
    replace_row(path, "FPL-1", f"| FPL-1 | Static Pages could not reliably read Official FPL through anonymous browser relays | Replaced by the owner-controlled allowlisted gateway; live 2026/27 transport passed on physical iPhone Safari | FPL-T1 | **CLOSED and merged 2026-08-06 through PR #69 (`{PR69_SHA}`)** |")
    replace_row(path, "FPL-2", "| FPL-2 | Full populated Teamsheet behaviour has not yet been accepted across every live Official FPL account, fixture, player and league path | Gateway and tested Transfers paths passed; remaining Team captain/bench, Fixtures, Player Detail and Leagues acceptance is not fully recorded | Feature-specific live acceptance | Open (acceptance gate) |")
    replace_row(path, "TRF-A1", f"| TRF-A1 | Initial exact Transfers device tests exposed the evaluation-ceiling and missing-baseline presentation failures | Exact search, lifecycle handling and separate-baseline presentation were corrected; populated physical iPhone Safari acceptance passed, including final **No hit** wording | Track A | **CLOSED and merged 2026-08-06 through PR #72 (`{MAIN_SHA}`)** |")
    replace_row(path, "UI-9", f"| UI-9 | Transfer optimisation previously ran synchronously on the Safari UI thread | Explicit browser Web Worker, batched preparation, persistent calculation, cancellation and result reuse passed populated iPhone Safari acceptance | Track A | **CLOSED and merged through PRs #69–#72** |")
    replace_row(path, "UI-10", "| UI-10 | Blob Web Workers depend on the browser accepting `worker-src 'self' blob:` | The live Pages CSP path passed on the target physical iPhone Safari; unsupported browsers still fail honestly without a main-thread fallback | Track A target-device acceptance | Accepted-tested; fallback retained |")
    append_section(
        path,
        "## Track A acceptance boundary — 2026-08-06",
        "The target populated iPhone Safari Transfers paths are accepted. This does not establish universal browser performance, VoiceOver behaviour or full live acceptance for every Team, Fixtures, Player Detail or Leagues path. Those limitations remain separately listed and must not be collapsed into a broader claim.",
    )


def update_records():
    append_section(
        "docs/TESTING.md",
        "## 2026-08-06 — Track A merged checkpoint",
        f"- Approved stack merged in order: PR #69 at `{PR69_SHA}`, PR #70 at `{PR70_SHA}`, and PR #72 at `{MAIN_SHA}`.\n- The final `main` tree `{TREE_SHA}` exactly matches the verified PR #72 head tree, proving the merge introduced no file-content drift.\n- The accepted pre-merge gate remains **613 passed, 0 failed, 0 skipped**, with deterministic production builds and root/deployable equality. No new runtime test run is claimed after the merge; the tree-identity check ties `main` directly to that verified content.\n- Populated physical iPhone Safari passed the six-Gameweek exact calculation in about 15 seconds, result restoration, active navigation, cancel/restart, Safari background/return, stale-result protection, separate no-transfer comparison and final **No hit** wording.\n- VoiceOver was not tested and is not claimed.",
    )
    append_section(
        "docs/CHANGELOG.md",
        "## 2026-08-06 — FPL-T1 and Track A integrated",
        f"- Merged the approved stack in order: PR #69 (`{PR69_SHA}`), PR #70 (`{PR70_SHA}`), PR #72 (`{MAIN_SHA}`).\n- Confirmed final `main` has the identical tree `{TREE_SHA}` as the verified PR #72 head.\n- Preserved the 613-test deterministic-build evidence and recorded populated iPhone Safari acceptance for the tested Transfers lifecycle and final **No hit** wording.\n- No Track B intelligence, provider expansion, prediction formula or accuracy claim was introduced.",
    )
    append_section(
        "docs/TRANSFERS-EXACT-PERFORMANCE.md",
        "## Integrated main checkpoint — 2026-08-06",
        f"The approved stack is merged: PR #69 at `{PR69_SHA}`, PR #70 at `{PR70_SHA}` and PR #72 at final `main` `{MAIN_SHA}`. The merge commit's tree `{TREE_SHA}` exactly matches the verified PR #72 head tree. Accepted evidence remains 613 passing tests, deterministic builds and the populated iPhone Safari result: approximately 15 seconds for the six-Gameweek exact calculation, smooth navigation/cancellation/app-switch/stale-result paths, the required no-transfer comparison and final **No hit** wording. VoiceOver was not tested, and no universal device-speed or prediction-accuracy claim is made.",
    )


if __name__ == "__main__":
    update_claude()
    update_project_context()
    update_roadmap()
    update_limitations()
    update_records()
