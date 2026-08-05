#!/usr/bin/env python3
import os
import sys
from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)


def apply_source():
    main_path = Path('src/main.mjs')
    main = main_path.read_text()
    main = replace_once(
        main,
        "let lastVerifiedRefreshAt = 0;\nlet verifiedRefreshTriggersInstalled = false;",
        "let lastVerifiedRefreshAt = 0;\nlet lastRefreshAttemptAt = 0;\nlet verifiedRefreshTriggersInstalled = false;",
        'refresh attempt declaration'
    )
    main = replace_once(
        main,
        "function shouldRefreshVerifiedData(lastVerifiedAt,now=Date.now(),minAgeMs=VERIFIED_REFRESH_MIN_AGE_MS){\n  return !Number.isFinite(Number(lastVerifiedAt)) || now-Number(lastVerifiedAt)>=minAgeMs;\n}\nfunction setStartupPhase(key){",
        "function shouldRefreshVerifiedData(lastVerifiedAt,now=Date.now(),minAgeMs=VERIFIED_REFRESH_MIN_AGE_MS){\n  return !Number.isFinite(Number(lastVerifiedAt)) || now-Number(lastVerifiedAt)>=minAgeMs;\n}\nfunction shouldBlockRefreshInteractions({reason='manual',startup=false}={}){\n  return Boolean(startup||reason==='manual');\n}\nfunction shouldRunForegroundRefresh(lastAttemptAt,{visibilityState='visible',now=Date.now()}={}){\n  if(visibilityState&&visibilityState!=='visible') return false;\n  return shouldRefreshVerifiedData(lastAttemptAt,now);\n}\nfunction setStartupPhase(key){",
        'refresh policy helpers'
    )
    main = replace_once(
        main,
        "  if(!force&&!shouldRefreshVerifiedData(lastVerifiedRefreshAt,nowFn())) return {ok:true,criticalReady:Boolean(S.boot),skipped:true,reason:'recently_verified'};\n  verifiedRefreshPromise=(async()=>{\n    if(startup) setStartupGateVisible(true);\n    setRefreshInteractionLock(true,{startup});",
        "  if(!force&&!shouldRefreshVerifiedData(lastRefreshAttemptAt,nowFn())) return {ok:true,criticalReady:Boolean(S.boot),skipped:true,reason:'recently_attempted'};\n  const blockInteractions=shouldBlockRefreshInteractions({reason,startup});\n  verifiedRefreshPromise=(async()=>{\n    if(startup) setStartupGateVisible(true);\n    if(blockInteractions) setRefreshInteractionLock(true,{startup});",
        'refresh entry policy'
    )
    main = replace_once(
        main,
        "    }finally{\n      setRefreshInteractionLock(false,{startup});\n      if(startup){",
        "    }finally{\n      lastRefreshAttemptAt=nowFn();\n      if(blockInteractions) setRefreshInteractionLock(false,{startup});\n      if(startup){",
        'completed attempt timestamp'
    )
    main = replace_once(
        main,
        "  const refreshIfDue=()=>{\n    if(document.visibilityState&&document.visibilityState!=='visible') return;\n    if(shouldRefreshVerifiedData(lastVerifiedRefreshAt)) runVerifiedRefresh({reason:'foreground'});\n  };",
        "  const refreshIfDue=()=>{\n    if(!shouldRunForegroundRefresh(lastRefreshAttemptAt,{visibilityState:document.visibilityState})) return;\n    void runVerifiedRefresh({reason:'foreground'});\n  };",
        'foreground resume trigger'
    )
    main = replace_once(
        main,
        "  shouldRefreshVerifiedData,\n  setStartupPhase,",
        "  shouldRefreshVerifiedData,\n  shouldBlockRefreshInteractions,\n  shouldRunForegroundRefresh,\n  setStartupPhase,",
        'helper exports'
    )
    main_path.write_text(main)

    test_path = Path('tests/startup-refresh.test.mjs')
    tests = test_path.read_text()
    tests = replace_once(
        tests,
        "  shouldRefreshVerifiedData,\n  dispatchVerifiedData",
        "  shouldRefreshVerifiedData,\n  shouldBlockRefreshInteractions,\n  shouldRunForegroundRefresh,\n  dispatchVerifiedData",
        'test imports'
    )
    insertion = """

test('failed refresh attempts respect the foreground cooldown',()=>{
  const now=2_000_000;
  const failedAttemptCompletedAt=now-1_000;
  assert.equal(shouldRunForegroundRefresh(failedAttemptCompletedAt,{visibilityState:'visible',now}),false);
  assert.equal(shouldRunForegroundRefresh(now-VERIFIED_REFRESH_MIN_AGE_MS,{visibilityState:'visible',now}),true);
  assert.equal(shouldRunForegroundRefresh(0,{visibilityState:'hidden',now}),false);
});

test('only startup and manual refreshes block app interaction',()=>{
  assert.equal(shouldBlockRefreshInteractions({reason:'startup',startup:true}),true);
  assert.equal(shouldBlockRefreshInteractions({reason:'manual',startup:false}),true);
  assert.equal(shouldBlockRefreshInteractions({reason:'foreground',startup:false}),false);
});

test('Safari resume uses completed-attempt throttling and in-flight deduplication',()=>{
  assert.match(MAIN_SOURCE,/let lastRefreshAttemptAt = 0;/);
  assert.match(MAIN_SOURCE,/if\(verifiedRefreshPromise\) return verifiedRefreshPromise;/);
  assert.match(MAIN_SOURCE,/finally\{\s*lastRefreshAttemptAt=nowFn\(\);/);
  assert.match(MAIN_SOURCE,/shouldRunForegroundRefresh\(lastRefreshAttemptAt/);
  assert.match(MAIN_SOURCE,/if\(blockInteractions\) setRefreshInteractionLock\(true/);
});
"""
    marker = "\ntest('startup and foreground paths use the same deferred verified refresh',()=>{"
    tests = replace_once(tests, marker, insertion + marker, 'resume regression tests')
    test_path.write_text(tests)


def update_docs():
    source = os.environ['SOURCE_COMMIT']
    passes = os.environ['PASS_COUNT']
    old_source = '3baeb8fd51ea68af353c5097b0e5d2d49837dcf6'
    old_generated = 'db48549fe6c527e235615eb7fd057f8a51de4d7a'
    generated_placeholder = '__GENERATED_COMMIT__'

    current_docs = [
        Path('CLAUDE.md'),
        Path('docs/PROJECT_CONTEXT.md'),
        Path('docs/ROADMAP.md'),
        Path('docs/TESTING.md'),
        Path('docs/TEAMSHEET2-ITEM7.md'),
    ]
    for path in current_docs:
        text = path.read_text()
        text = text.replace(old_source, source)
        text = text.replace(old_generated, generated_placeholder)
        text = text.replace('530 passed, 0 failed, 0 skipped', f'{passes} passed, 0 failed, 0 skipped')
        text = text.replace('530/530 passing tests', f'{passes}/{passes} passing tests')
        text = text.replace('530/530 tests', f'{passes}/{passes} tests')
        text = text.replace(
            'Physical iPhone Safari, VoiceOver and live populated-data acceptance remain pending.',
            'Physical iPhone Safari testing identified a foreground-resume defect; the approved correction is implemented and pending owner retest. VoiceOver and live populated-data acceptance remain pending.'
        )
        path.write_text(text)

    item = Path('docs/TEAMSHEET2-ITEM7.md')
    text = item.read_text()
    text = text.replace(
        'Status: **implemented on the approved branch for automated review; physical iPhone Safari, VoiceOver and live populated-data acceptance remain pending.**',
        'Status: **implemented on the approved branch for automated review; the physical iPhone Safari foreground-resume defect is corrected and pending owner retest, while VoiceOver and live populated-data acceptance remain pending.**'
    )
    heading = '## Physical iPhone Safari foreground-resume correction — 5 August 2026'
    if heading not in text:
        section = f'''\n\n{heading}\n\nPhysical iPhone testing found that returning from another app could start another Official FPL refresh immediately after an unsuccessful startup attempt. Safari can emit both visibility and page-resume events; because only successful verification had been timestamped, every return remained eligible for another blocking retry.\n\nPritesh approved a narrow correction: every completed refresh attempt now starts the existing ten-minute automatic cooldown, paired resume events remain deduplicated by the in-flight promise, foreground refreshes no longer disable the app, and the manual **Load data** action continues to bypass the cooldown. No provider, endpoint, source, calculation, persistence schema or security boundary changed.\n\nAutomated verification for source `{source}` completed **{passes} passed, 0 failed, 0 skipped** with deterministic exact-identity builds and root/deployable equality. Physical iPhone retesting remains required before this finding can be closed.\n'''
        text = text.replace('\n## Explicit exclusions retained', section + '\n## Explicit exclusions retained')
    item.write_text(text)

    known = Path('docs/KNOWN_LIMITATIONS.md')
    text = known.read_text()
    heading = '### Physical iPhone Safari foreground resume'
    if heading not in text:
        text += f'''\n\n{heading}\n\nPhysical device acceptance identified a repeat-refresh interaction freeze when Safari returned from another app after an unsuccessful startup load. The approved correction is implemented on PR #68 and automated regression coverage passes, but the limitation remains open until Pritesh repeats the physical app-switch test successfully.\n'''
    known.write_text(text)

    testing = Path('docs/TESTING.md')
    text = testing.read_text()
    heading = '## Safari foreground-resume correction verification'
    if heading not in text:
        text += f'''\n\n{heading}\n\nPhysical iPhone testing exposed an untested failure path: unsuccessful startup attempts did not start the automatic refresh cooldown, and foreground refreshes temporarily made the application inert. Regression coverage now verifies failed-attempt cooldown, hidden-page suppression, foreground interactivity and in-flight deduplication while preserving immediate manual refresh. Source `{source}` completed **{passes} passed, 0 failed, 0 skipped**, two byte-identical builds and root/deployable equality. Physical iPhone retesting remains an evidence gate.\n'''
    testing.write_text(text)

    decisions = Path('docs/DECISIONS.md')
    text = decisions.read_text()
    heading = '## D-36 · 2026-08-05 · Accepted · Safari foreground-resume refresh correction'
    if heading not in text:
        text += f'''\n\n{heading}\n\nReason: physical iPhone acceptance found that returning to Safari after an unsuccessful startup load could immediately start another blocking Official FPL refresh, making the app appear frozen.\n\nApproach: timestamp every completed refresh attempt for the existing ten-minute automatic cooldown, retain in-flight promise deduplication for paired Safari resume events, keep foreground refresh interaction non-blocking, and preserve the force-enabled manual **Load data** retry.\n\nConsequences: this is refresh orchestration and interaction behaviour only. It changes no provider, endpoint, data source, model, fixture, scoring, squad, captaincy, simulation, optimiser, rank, Mini-League, persistence or security logic. Physical iPhone retesting remains required.\n'''
    decisions.write_text(text)

    architecture = Path('docs/ARCHITECTURE.md')
    text = architecture.read_text()
    bullet = '- Foreground resume uses the timestamp of the last completed refresh attempt, not only the last successful verification; automatic retries retain the ten-minute cooldown and do not make the application inert.'
    if bullet not in text:
        text += '\n' + bullet + '\n'
    architecture.write_text(text)

    changelog = Path('docs/CHANGELOG.md')
    text = changelog.read_text()
    bullet = '- Corrected iPhone Safari foreground resume so unsuccessful loads respect the automatic cooldown and background refreshes do not freeze interaction; physical-device retest remains pending.'
    if bullet not in text:
        text += '\n' + bullet + '\n'
    changelog.write_text(text)


def finalise_docs():
    generated = os.environ['GENERATED_COMMIT']
    for name in [
        'CLAUDE.md',
        'docs/PROJECT_CONTEXT.md',
        'docs/ROADMAP.md',
        'docs/TESTING.md',
        'docs/TEAMSHEET2-ITEM7.md',
    ]:
        path = Path(name)
        text = path.read_text()
        if '__GENERATED_COMMIT__' not in text:
            raise SystemExit(f'generated commit placeholder missing from {name}')
        path.write_text(text.replace('__GENERATED_COMMIT__', generated))


if __name__ == '__main__':
    phase = sys.argv[1] if len(sys.argv) > 1 else ''
    if phase == 'source':
        apply_source()
    elif phase == 'docs':
        update_docs()
    elif phase == 'final':
        finalise_docs()
    else:
        raise SystemExit('usage: apply-safari-resume-fix.py source|docs|final')
