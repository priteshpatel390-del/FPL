#!/usr/bin/env node
// build.mjs — deterministic bundle: flattens src/ modules into one script in
// fixed order, strips module scaffolding, injects into app.html, embeds a
// build manifest (adjustment 9). Same sources → same output bytes, except the
// commit id which comes from the BUILD_COMMIT env var (default 'unversioned').
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ORDER = [
  'src/config.mjs', 'src/util.mjs', 'src/state.mjs', 'src/storage.mjs',
  'src/providers/registry.mjs', 'src/providers/transport.mjs', 'src/providers/common.mjs',
  'src/providers/understat.mjs', 'src/providers/odds.mjs',
  'src/model/fixtures.mjs', 'src/model/scoring.mjs', 'src/squad.mjs',
  'src/model/backtest.mjs', 'src/main.mjs', 'src/ui/views.mjs',
];
// shims (model/minutes.mjs, model/xp.mjs) are re-export-only: excluded from the bundle.

const strip = code => code.split('\n').filter(l => {
  const t = l.trim();
  if (t.startsWith('import ')) return false;
  if (/^export \{[^}]*\};?$/.test(t)) return false;
  if (/^export \{[^}]*\} from /.test(t)) return false;
  return true;
}).join('\n')
  .replace(/^export (const|function|async function|let|class)/gm, '$1');

const hash = createHash('sha256');
let bundle = '';
for (const path of ORDER) {
  const raw = readFileSync(path, 'utf8');
  hash.update(path).update('\0').update(raw);
  bundle += `\n/* ===== ${path} ===== */\n` + strip(raw) + '\n';
}
const sourceHash = hash.digest('hex');
const commit = process.env.BUILD_COMMIT || 'unversioned';
const cfg = readFileSync('src/config.mjs', 'utf8');
const modelVersion = /MODEL_VERSION\s*=\s*'([^']+)'/.exec(cfg)[1];
const rulesVersion = /RULES_VERSION\s*=\s*'([^']+)'/.exec(cfg)[1];

const manifest = { modelVersion, rulesVersion, sourceHash, commit, moduleOrder: ORDER };
bundle = `/* BUILD ${JSON.stringify({ modelVersion, rulesVersion, sourceHash: sourceHash.slice(0,16), commit })} */\n`
  + `const BUILD_INFO = ${JSON.stringify(manifest)};\n` + bundle;

mkdirSync('dist', { recursive: true });
writeFileSync('dist/app.bundle.js', bundle);
writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
const html = readFileSync('app.html', 'utf8')
  .replace('<script src="app.js"></script>', '<script>\n' + bundle + '\n</script>');
writeFileSync('dist/index.html', html);
console.log(`built dist/index.html (${html.length}b)  model ${modelVersion}  rules ${rulesVersion}  src ${sourceHash.slice(0,12)}  commit ${commit}`);
