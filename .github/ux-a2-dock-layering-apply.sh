#!/usr/bin/env bash
set -euo pipefail

BRANCH='agent/ux-a2-player-detail-dock-layering'
EXPECTED_BASE='2f2930de125cbb63600aa9514123f516d8b9e188'
WORKFLOW='.github/workflows/ux-a2-dock-layering-apply.yml'
SCRIPT='.github/ux-a2-dock-layering-apply.sh'

git fetch origin main
test "$(git rev-parse origin/main)" = "$EXPECTED_BASE"
test "$(git merge-base HEAD origin/main)" = "$EXPECTED_BASE"

python3 - <<'PY'
from pathlib import Path

path=Path('tests/player-detail-scroll-rotation.test.mjs')
text=path.read_text(encoding='utf-8')
name='Player Detail layers above the fixed primary dock so final content cannot be covered'
if name in text:
    raise SystemExit('dock-layering regression already exists unexpectedly')
anchor='\n// The physical iPhone Safari review found'
if text.count(anchor) != 1:
    raise SystemExit('Player Detail test insertion point is not unique')
test=r'''

test('Player Detail layers above the fixed primary dock so final content cannot be covered',()=>{
  const numericZIndex = (css,label) => {
    const match = /(?:^|;)z-index:(\d+)/.exec(css);
    assert.ok(match,`expected numeric z-index for ${label}`);
    return Number(match[1]);
  };
  const navRules = [...app.matchAll(/(?:^|\n)nav\.tabs\{([^}]*)\}/g)].map(match => match[1]);
  assert.ok(navRules.length >= 1,'expected primary dock CSS');
  const dockZIndex = Math.max(...navRules.map((rule,index) => numericZIndex(rule,`primary dock rule ${index + 1}`)));
  const backdropZIndex = numericZIndex(ruleBody(detailCss,'.player-detail-backdrop'),'Player Detail backdrop');
  const panelZIndex = numericZIndex(ruleBody(detailCss,'.player-detail-panel'),'Player Detail panel');
  assert.ok(backdropZIndex > dockZIndex,'the modal backdrop must cover the fixed primary dock');
  assert.ok(panelZIndex > backdropZIndex,'the modal panel must sit above its backdrop');
});
'''
path.write_text(text.replace(anchor,test+anchor,1),encoding='utf-8')
PY

set +e
node --test tests/player-detail-scroll-rotation.test.mjs > /tmp/ux-a2-red.log 2>&1
RED_STATUS=$?
set -e
test "$RED_STATUS" -ne 0
grep -Fq 'the modal backdrop must cover the fixed primary dock' /tmp/ux-a2-red.log

python3 - <<'PY'
from pathlib import Path
path=Path('app.html')
text=path.read_text(encoding='utf-8')
old_backdrop='.player-detail-backdrop{position:fixed;inset:0;z-index:38;'
old_panel='.player-detail-panel{position:fixed;z-index:39;'
if text.count(old_backdrop) != 1:
    raise SystemExit('expected one Player Detail backdrop layering rule')
if text.count(old_panel) != 1:
    raise SystemExit('expected one Player Detail panel layering rule')
text=text.replace(old_backdrop,'.player-detail-backdrop{position:fixed;inset:0;z-index:1010;',1)
text=text.replace(old_panel,'.player-detail-panel{position:fixed;z-index:1011;',1)
path.write_text(text,encoding='utf-8')
PY

node --test tests/player-detail-scroll-rotation.test.mjs | tee /tmp/ux-a2-focused.log
grep -q '^# tests 21$' /tmp/ux-a2-focused.log
grep -q '^# pass 21$' /tmp/ux-a2-focused.log
grep -q '^# fail 0$' /tmp/ux-a2-focused.log

git config user.name 'Teamsheet UX-A2 Agent'
git config user.email 'actions@users.noreply.github.com'
git rm "$WORKFLOW" "$SCRIPT"
git add app.html tests/player-detail-scroll-rotation.test.mjs
git commit -m 'Fix Player Detail layering above primary dock'
SOURCE_SHA=$(git rev-parse HEAD)
export SOURCE_SHA

BUILD_COMMIT="$SOURCE_SHA" ./run-tests.sh | tee /tmp/ux-a2-full.log
grep -q '^# tests 645$' /tmp/ux-a2-full.log
grep -q '^# pass 645$' /tmp/ux-a2-full.log
grep -q '^# fail 0$' /tmp/ux-a2-full.log
grep -q '^# cancelled 0$' /tmp/ux-a2-full.log
grep -q '^# skipped 0$' /tmp/ux-a2-full.log

rm -rf /tmp/ux-a2-build-a /tmp/ux-a2-build-b
mkdir -p /tmp/ux-a2-build-a /tmp/ux-a2-build-b

BUILD_COMMIT="$SOURCE_SHA" node build.mjs
cp dist/app.bundle.js /tmp/ux-a2-build-a/app.bundle.js
cp dist/index.html /tmp/ux-a2-build-a/dist-index.html
cp dist/manifest.json /tmp/ux-a2-build-a/manifest.json
cp index.html /tmp/ux-a2-build-a/root-index.html

BUILD_COMMIT="$SOURCE_SHA" node build.mjs
cp dist/app.bundle.js /tmp/ux-a2-build-b/app.bundle.js
cp dist/index.html /tmp/ux-a2-build-b/dist-index.html
cp dist/manifest.json /tmp/ux-a2-build-b/manifest.json
cp index.html /tmp/ux-a2-build-b/root-index.html

cmp /tmp/ux-a2-build-a/app.bundle.js /tmp/ux-a2-build-b/app.bundle.js
cmp /tmp/ux-a2-build-a/dist-index.html /tmp/ux-a2-build-b/dist-index.html
cmp /tmp/ux-a2-build-a/manifest.json /tmp/ux-a2-build-b/manifest.json
cmp /tmp/ux-a2-build-a/root-index.html /tmp/ux-a2-build-b/root-index.html
cmp dist/index.html index.html

APP_SHA=$(sha256sum dist/app.bundle.js | awk '{print $1}')
DIST_SHA=$(sha256sum dist/index.html | awk '{print $1}')
MANIFEST_SHA=$(sha256sum dist/manifest.json | awk '{print $1}')
ROOT_SHA=$(sha256sum index.html | awk '{print $1}')
export APP_SHA DIST_SHA MANIFEST_SHA ROOT_SHA

python3 - <<'PY'
from pathlib import Path
import os

branch='agent/ux-a2-player-detail-dock-layering'
base='2f2930de125cbb63600aa9514123f516d8b9e188'
source=os.environ['SOURCE_SHA']
app_sha=os.environ['APP_SHA']
dist_sha=os.environ['DIST_SHA']
manifest_sha=os.environ['MANIFEST_SHA']
root_sha=os.environ['ROOT_SHA']

record=f'''# UX-A2 Player Detail dock-layering follow-up

Status: **Implemented and verified on a draft branch; populated physical iPhone Safari confirmation pending.**

## Owner-reported defect

On 7 August 2026, Pritesh confirmed that the merged UX-A2 scrolling and rotation behaviour worked, but found that the fixed primary navigation dock covered the final line of **How the projection is built** until the sheet was dragged farther upward.

The defect was a stacking-order conflict rather than missing content padding: the final primary-dock rule used `z-index:1000`, while the Player Detail backdrop and panel used `38` and `39`.

## Approved correction

- branch: `{branch}`
- base `main`: `{base}`
- verified source commit: `{source}`
- Player Detail backdrop: `z-index:1010`
- Player Detail panel: `z-index:1011`
- fixed primary dock: unchanged at `z-index:1000`

The backdrop now covers the dock and the panel remains above the backdrop. The existing dialog content, safe-area padding, internal scrolling, closing, focus restoration, route behaviour and all FPL calculations are unchanged.

## Verification

- focused regression before correction: failed for the expected dock-over-modal ordering
- focused regression after correction: **21 passed, 0 failed**
- complete suite: **645 passed, 0 failed, 0 skipped, 0 cancelled**
- two production builds using exact `BUILD_COMMIT={source}`: byte-identical
- root `index.html`: byte-identical to `dist/index.html`
- golden/model expectations: unchanged

### SHA-256 generated outputs

```
{app_sha}  dist/app.bundle.js
{dist_sha}  dist/index.html
{manifest_sha}  dist/manifest.json
{root_sha}  index.html
```

## Explicit exclusions

No Player Detail information was removed or rearranged. No navigation sizing, route, projection, expected-minutes, fixture, scoring, squad, captaincy, simulation, transfer, rank, Mini-League, provider, data source, persistence, security, Cloudflare or Pages configuration changed.

## Remaining gate

A populated physical iPhone Safari recheck must confirm that the final projection line is no longer covered by the dock and that scrolling, closing and rotation remain intact. VoiceOver is not a project acceptance gate.
'''
Path('docs/UX-A2-DOCK-LAYERING-FOLLOW-UP.md').write_text(record,encoding='utf-8')

def insert_banner(path,marker,block):
    target=Path(path)
    text=target.read_text(encoding='utf-8')
    if marker in text:
        raise SystemExit(f'{marker} already exists unexpectedly')
    first,rest=text.split('\n',1)
    target.write_text(first+'\n\n'+block.strip()+'\n\n'+rest,encoding='utf-8')

insert_banner('CLAUDE.md','UX-A2-DOCK-LAYERING-2026-08-07',f'''
<!-- UX-A2-DOCK-LAYERING-2026-08-07 -->
> **UX-A2 post-merge dock-layering follow-up — implemented and verified in draft review:** `{branch}` is based on `main` `{base}`. It raises only the existing Player Detail backdrop and panel above the unchanged fixed primary dock so the final projection line cannot be covered. Verification is **645 passed, 0 failed, 0 skipped, 0 cancelled** with deterministic exact-identity builds and root/deployable equality. Every FPL calculation, Player Detail content, route and navigation dimension is unchanged. Populated physical iPhone Safari confirmation remains pending; UX-A3 and Track B remain unapproved.
''')

insert_banner('docs/PROJECT_CONTEXT.md','UX-A2-DOCK-LAYERING-CONTEXT-2026-08-07',f'''
<!-- UX-A2-DOCK-LAYERING-CONTEXT-2026-08-07 -->
> **Current approved follow-up:** `{branch}` corrects a post-merge Player Detail stacking conflict found by Pritesh on physical iPhone Safari. The fixed primary dock was above the modal and covered its final projection line. The backdrop and panel now layer above the unchanged dock. Automated verification is **645 passed** with deterministic builds; populated physical iPhone Safari confirmation is pending. No model, provider, route, navigation sizing or Player Detail information change is included.
''')

insert_banner('docs/ROADMAP.md','UX-A2-DOCK-LAYERING-ROADMAP-2026-08-07',f'''
<!-- UX-A2-DOCK-LAYERING-ROADMAP-2026-08-07 -->
> **Approved UX-A2 follow-up in draft review:** `{branch}` fixes only the Player Detail/modal stacking conflict above the fixed primary dock. Automated verification is **645 passed** with deterministic builds. Populated physical iPhone Safari confirmation and explicit merge approval remain outstanding. UX-A3, Track B and all model/provider work remain unapproved.
''')

insert_banner('docs/TESTING.md','UX-A2-DOCK-LAYERING-TESTING-2026-08-07',f'''
<!-- UX-A2-DOCK-LAYERING-TESTING-2026-08-07 -->
> **UX-A2 dock-layering follow-up verification:** the new regression first failed against the merged ordering, then passed after the narrow CSS correction. The complete suite is **645 passed, 0 failed, 0 skipped, 0 cancelled**. Two builds using exact source `{source}` are byte-identical for all generated outputs, and root `index.html` equals `dist/index.html`. Populated physical iPhone Safari confirmation remains pending.
''')

known=Path('docs/KNOWN_LIMITATIONS.md')
text=known.read_text(encoding='utf-8')
if '| UI-14 |' in text:
    raise SystemExit('UI-14 already exists unexpectedly')
ui13='| UI-13 | UX-A2 Player Detail scroll and rotation correction had not yet received populated physical iPhone Safari acceptance | Acceptance was performed by the owner on 6 August 2026 and passed: background locking, internal scrolling to the final content, close-control reachability, exact background-position restoration on normal close, reopening at the top, backdrop close and both orientations. The first return to portrait exposed Safari automatically enlarging text; root text-size adjustment is now fixed at 100% and the owner physically retested the corrected behaviour successfully. VoiceOver is not a Teamsheet acceptance gate. | UX-A2 owner acceptance | **CLOSED and merged 2026-08-06 through PR #76** |\n'
if text.count(ui13) != 1:
    raise SystemExit('UI-13 insertion anchor is not unique')
ui14='| UI-14 | The fixed primary dock layered above Player Detail and could cover the final projection line | Corrected on the approved follow-up branch by placing the modal backdrop and panel above the unchanged dock; automated regression and full verification pass | UX-A2 post-merge follow-up | In draft review; populated physical iPhone Safari confirmation pending |\n'
text=text.replace(ui13,ui13+ui14,1)
text=text.replace('Last updated: 2026-08-06.','Last updated: 2026-08-07.',1)
known.write_text(text,encoding='utf-8')

merge=Path('docs/UX-A2-MERGE-RECORD.md')
text=merge.read_text(encoding='utf-8')
marker='UX-A2-DOCK-LAYERING-FOLLOW-UP-2026-08-07'
if marker in text:
    raise SystemExit('merge-record follow-up already exists unexpectedly')
text=text.rstrip()+f'''\n\n## Post-merge dock-layering follow-up — draft review\n\n<!-- {marker} -->\n\nOn 7 August 2026, Pritesh found that the fixed primary dock could cover the final Player Detail projection line even though UX-A2 scrolling and rotation otherwise worked correctly. The approved branch `{branch}` raises only the existing modal layers above the unchanged dock. Automated verification is **645 passed** with deterministic builds. This follow-up is not merged and populated physical iPhone Safari confirmation remains pending; the historical UX-A2 merge facts above remain unchanged.\n'''
merge.write_text(text,encoding='utf-8')
PY

git add CLAUDE.md docs/ dist/app.bundle.js dist/index.html dist/manifest.json index.html
git commit -m 'Build and document Player Detail dock correction'
git push origin "HEAD:$BRANCH"
