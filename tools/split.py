#!/usr/bin/env python3
# tools/split.py — Stage 2 extraction. Moves app.js sections VERBATIM into ES
# modules; only import/export scaffolding is added. Behaviour is frozen by the
# characterisation suite, which runs against the rebuilt bundle.
import re, os, hashlib

SRC = open('app.js').read()
lines = SRC.split('\n')

# [start, end) line ranges (1-based inclusive start, exclusive end) per module.
# Boundaries taken from the section banners just surveyed.
SECTIONS = {
  'src/util.mjs':            (6, 10),
  'src/_config_body.tmp':    (11, 17),
  'src/_state_body.tmp':     (18, 24),
  'src/storage.mjs':         (25, 57),
  'src/providers/transport.mjs': (57, 122),
  'src/providers/common.mjs':(122, 144),
  'src/providers/understat.mjs':(144, 189),
  'src/providers/odds.mjs':  (189, 263),
  'src/model/backtest.mjs':  (263, 422),
  'src/state.mjs':           (422, 475),
  'src/model/fixtures.mjs':  (475, 550),
  'src/model/scoring.mjs':   (550, 670),  # includes minutes fn; re-exported via model/minutes.mjs shim
  'src/squad.mjs':           (670, 732),
  'src/main.mjs':            (732, 788),
  'src/ui/views.mjs':        (788, 1420), # all views + saved leagues + ask + manual + wiring (init stripped at build for tests)
}

HEADERS = {
  'src/util.mjs': '',
  'src/storage.mjs': "import { S } from './state.mjs';\nimport { $, num } from './util.mjs';\nimport { SCHEMA_VERSION } from './config.mjs';\n",
  'src/providers/transport.mjs': "import { S } from './state.mjs';\n",
  'src/providers/common.mjs': "import { S } from './state.mjs';\n",
  'src/providers/understat.mjs': "import { S } from './state.mjs';\nimport { $, num } from './util.mjs';\nimport { fetchVia } from './transport.mjs';\nimport { mapTeamName } from './common.mjs';\nimport { markHealth } from './registry.mjs';\n",
  'src/providers/odds.mjs': "import { S } from './state.mjs';\nimport { $, num, clamp } from './util.mjs';\nimport { fetchT } from './transport.mjs';\nimport { mapTeamName } from './common.mjs';\nimport { ODDS_RULES } from './config.mjs';\nimport { markHealth } from './registry.mjs';\n",
  'src/model/backtest.mjs': "import { S } from './state.mjs';\nimport { $, num, clamp } from '../util.mjs';\nimport { GOAL_PTS, CS_PTS, ASSIST_PTS, DC_THRESH, BASE_GOALS, MODEL_VERSION, RULES_VERSION } from '../config.mjs';\nimport { sset } from '../storage.mjs';\nimport { fetchT } from '../providers/transport.mjs';\nimport { clearXP } from './xp.mjs';\n",
  'src/state.mjs': "",
  'src/model/fixtures.mjs': "import { S } from '../state.mjs';\nimport { clamp, num } from '../util.mjs';\nimport { BASE_GOALS, HOME_TILT } from '../config.mjs';\n",
  'src/model/scoring.mjs': "import { S } from '../state.mjs';\nimport { clamp, num } from '../util.mjs';\nimport { GOAL_PTS, CS_PTS, ASSIST_PTS, DC_THRESH, BASE_GOALS } from '../config.mjs';\nimport { teamFixtures } from './fixtures.mjs';\n",
  'src/squad.mjs': "import { S } from './state.mjs';\nimport { $, num } from './util.mjs';\nimport { xpOf } from './model/xp.mjs';\n",
  'src/main.mjs': "import { S } from './state.mjs';\nimport { $, num } from './util.mjs';\nimport { api } from './providers/transport.mjs';\nimport { sget, sset, saveCfg, K_CFG, K_CACHE, K_CAL } from './storage.mjs';\nimport { slim, hydrate } from './state.mjs';\nimport { loadUnderstat } from './providers/understat.mjs';\nimport { loadOdds } from './providers/odds.mjs';\nimport { clearXP } from './model/xp.mjs';\n",
  'src/ui/views.mjs': "// Views import broadly; the bundler flattens everything into one scope.\n",
}

EXPORTS = {
  'src/util.mjs': ['$','num','clamp','fmt1'],
  'src/storage.mjs': ['K_CFG','K_SQUAD','K_CACHE','K_CAL','sget','sset','saveCfg'],
  'src/providers/transport.mjs': ['BASE','RELAYS','fetchT','api','pool','fetchVia'],
  'src/providers/common.mjs': ['NAME_ALIASES','mapTeamName'],
  'src/providers/understat.mjs': ['parseUnderstat','loadUnderstat'],
  'src/providers/odds.mjs': ['poissonOver','solveLambda','loadOdds'],
  'src/model/backtest.mjs': ['parseCSV','pearson','computeBacktest','runBacktest'],
  'src/state.mjs': ['S','KEEP','slim','hydrate'],
  'src/model/fixtures.mjs': ['matchContext','teamFixtures','multToDiff','runScore'],
  'src/model/scoring.mjs': ['availability','per90','expectedMinutes','priceBaseline','playerFixtureXP','projectXP'],
  'src/squad.mjs': ['flagsFor','priceMomentum','newsAge','sellPrice','mySquad','bestXI'],
  'src/main.mjs': ['loadAll'],
  'src/ui/views.mjs': [],
}

def cut(a, b):
    return '\n'.join(lines[a-1:b-1]).rstrip() + '\n'

os.makedirs('src/providers', exist_ok=True)
os.makedirs('src/model', exist_ok=True)
os.makedirs('src/ui', exist_ok=True)

for path, (a, b) in SECTIONS.items():
    body = cut(a, b)
    exp = EXPORTS.get(path, [])
    tail = ('\nexport { ' + ', '.join(exp) + ' };\n') if exp else ''
    open(path, 'w').write(HEADERS.get(path, '') + body + tail)
    print(f'{path:34s} lines {a}-{b}  sha {hashlib.sha256(body.encode()).hexdigest()[:10]}')
print('split complete')
