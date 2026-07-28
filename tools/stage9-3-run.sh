#!/usr/bin/env bash
set -euo pipefail

BRANCH='agent/stage9-3-player-detail-uncertainty'

if grep -q "function playerDetailAvailabilityLabel" src/ui/player-detail.mjs; then
  echo 'Stage 9.3 availability refinement already present.'
  exit 0
fi

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'

python - <<'PY'
from pathlib import Path

detail=Path('src/ui/player-detail.mjs')
text=detail.read_text()
marker="""function playerDetailRangePosition(value,min,max){
  const low = num(min), high = num(max);
  if(high <= low) return 50;
  return clamp((num(value)-low)/(high-low)*100,0,100);
}
"""
addition=marker+"""
function playerDetailAvailabilityLabel(p = {}){
  if(['i','u','s','n'].includes(p.status)) return 'Unavailable';
  if(p.status === 'd') return 'Doubtful';
  return 'Available';
}
"""
if marker not in text:
    raise SystemExit('player detail range marker not found')
text=text.replace(marker,addition,1)
export_marker="""  playerDetailSpread,
  playerDetailRangePosition,
  playerDetailSetup,
"""
export_new="""  playerDetailSpread,
  playerDetailRangePosition,
  playerDetailAvailabilityLabel,
  playerDetailSetup,
"""
if export_marker not in text:
    raise SystemExit('player detail export marker not found')
detail.write_text(text.replace(export_marker,export_new,1))

views=Path('src/ui/views.mjs')
text=views.read_text()
old="availability(p)>=1?'Available':availability(p)>=.75?'Doubtful':'Unavailable'"
if old not in text:
    raise SystemExit('availability presentation marker not found')
views.write_text(text.replace(old,'playerDetailAvailabilityLabel(p)',1))

tests=Path('tests/player-detail.test.mjs')
text=tests.read_text()
import_marker="""  playerDetailSpread,
  playerDetailRangePosition,
  playerDetailSetup,
"""
import_new="""  playerDetailSpread,
  playerDetailRangePosition,
  playerDetailAvailabilityLabel,
  playerDetailSetup,
"""
if import_marker not in text:
    raise SystemExit('player detail test import marker not found')
text=text.replace(import_marker,import_new,1)
test_marker="""test('range marker positions are deterministic and bounded',()=>{
"""
new_test="""test('official doubtful status stays doubtful regardless of percentage',()=>{
  assert.equal(playerDetailAvailabilityLabel({status:'d',chance_of_playing_next_round:25}),'Doubtful');
  assert.equal(playerDetailAvailabilityLabel({status:'i'}),'Unavailable');
  assert.equal(playerDetailAvailabilityLabel({status:'a'}),'Available');
});

test('range marker positions are deterministic and bounded',()=>{
"""
if test_marker not in text:
    raise SystemExit('player detail test insertion marker not found')
tests.write_text(text.replace(test_marker,new_test,1))
PY

git add src/ui/player-detail.mjs src/ui/views.mjs tests/player-detail.test.mjs
git commit -m 'Correct Stage 9.3 availability presentation'
SOURCE_SHA=$(git rev-parse HEAD)

BUILD_COMMIT="$SOURCE_SHA" ./run-tests.sh | tee /tmp/stage9-3-refine.log
mkdir -p /tmp/stage9-3-refine-first
cp dist/index.html dist/app.bundle.js dist/manifest.json /tmp/stage9-3-refine-first/
BUILD_COMMIT="$SOURCE_SHA" node build.mjs
cmp /tmp/stage9-3-refine-first/index.html dist/index.html
cmp /tmp/stage9-3-refine-first/app.bundle.js dist/app.bundle.js
cmp /tmp/stage9-3-refine-first/manifest.json dist/manifest.json
node -e "const m=require('./dist/manifest.json');if(m.commit!=='$SOURCE_SHA')throw new Error('build identity mismatch: '+m.commit)"

git add dist/index.html dist/app.bundle.js dist/manifest.json
git commit -m 'Refresh verified Stage 9.3 deployables'
ARTEFACT_SHA=$(git rev-parse HEAD)

{
  echo "status=0"
  echo "source=$SOURCE_SHA"
  echo "artefact=$ARTEFACT_SHA"
  echo '--- log tail ---'
  tail -n 100 /tmp/stage9-3-refine.log
} > .stage9-3-result

git add .stage9-3-result
git commit -m 'Refresh Stage 9.3 verification result'
git push origin HEAD:"$BRANCH"
