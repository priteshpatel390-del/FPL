#!/usr/bin/env python3
from pathlib import Path
import os
import subprocess

ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)


def replace(path,old,new):
    p=Path(path); text=p.read_text(encoding='utf-8')
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{path}: expected one match, found {count}')
    p.write_text(text.replace(old,new,1),encoding='utf-8')

replace('docs/ROADMAP.md','''## Teamsheet 2.0.1 physical iPhone follow-up

- **Approved interface correction:** global Ask composer, stable dock/icons, focus presentation and simplified Settings back hierarchy.
- **Investigation only:** non-blocking foreground refresh, reliable populated preview transport, and authoritative read-only bank/free-transfer retrieval.
- **Merge gate:** full tests/build/reproducibility, refreshed preview, repeat physical iPhone review, populated-data acceptance and explicit owner approval.
''','''## Post-merge Teamsheet 2.0.1 investigations

- The global Ask composer, stable dock/icons, focus presentation and simplified Settings hierarchy were merged through PR #48.
- Non-blocking foreground refresh, reliable populated Official FPL transport and authoritative read-only bank/free-transfer retrieval remain separately gated investigations.
- These unresolved data/account items do not reopen the completed 2.0.1 navigation scope.
''')
replace('docs/TESTING.md','Automated checks cannot independently prove exact iPhone Safari rendering or thumb comfort. Physical owner acceptance remains required before merge, with the complete end-to-end pre-season rehearsal deferred to Teamsheet 2.0.7.','Automated checks cannot independently prove exact iPhone Safari rendering or thumb comfort. PR #48 is merged; its historical physical findings remain recorded, while populated-data transport is tracked separately and the complete end-to-end rehearsal remains deferred to Teamsheet 2.0.7.')
replace('docs/ARCHITECTURE.md','`ui/review.mjs` remains subordinate under Settings → Evidence & Performance. It performs on-demand generation, keeps Google Sheets import manual and introduces no origin, authentication, backend, scheduler or persistent review cache. Future relocation under Settings → Evidence & Performance is a Teamsheet 2.0 product migration, not an architecture change.','`ui/review.mjs` remains subordinate under Settings → Evidence & Performance. It performs on-demand generation, keeps Google Sheets import manual and introduces no origin, authentication, backend, scheduler or persistent review cache. This is the current Teamsheet 2.0 placement and does not change the review architecture.')
replace('docs/SECURITY.md','Provider Health exposes Live, Cached, Stale, Fallback, Partial, Disabled and Unavailable through a compact global status and full current-session detail under More; Stage 9.5 changes presentation only.','Provider Health exposes Live, Cached, Stale, Fallback, Partial, Disabled and Unavailable; full current-session detail is organised under Settings → Data & Diagnostics. The navigation placement changes presentation only.')

env=os.environ.copy(); env['BUILD_COMMIT']='f0ca01317b4a9bb9749b807d41c3cc0451d4d128'
subprocess.run(['./run-tests.sh'],check=True,env=env)
subprocess.run(['cmp','-s','index.html','dist/index.html'],check=True)
subprocess.run(['git','diff','--exit-code','--','dist','index.html'],check=True)
subprocess.run(['git','add','docs/ROADMAP.md','docs/TESTING.md','docs/ARCHITECTURE.md','docs/SECURITY.md'],check=True)
for path in ['tools/implement-team-decision-home.py','.github/workflows/teamsheet-2.0.2-final-docs.yml']:
    if Path(path).exists(): subprocess.run(['git','rm',path],check=True)
subprocess.run(['git','commit','-m','Finalise Teamsheet 2.0.2 documentation'],check=True)
branch=os.environ.get('GITHUB_HEAD_REF') or 'agent/teamsheet-2.0.2-team-decision-home'
subprocess.run(['git','push','origin',f'HEAD:{branch}'],check=True)
