#!/usr/bin/env node
// build.mjs — deterministic bundle: flattens src/ modules into one script in
// fixed order, strips module scaffolding, injects into app.html, embeds a
// build manifest and emits a hash-locked meta CSP. Same sources → same output
// bytes, except the commit id supplied through BUILD_COMMIT.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { stripModuleSyntax, assertNoModuleSyntax } from './build-utils.mjs';

const ORDER = [
  'src/config.mjs', 'src/util.mjs', 'src/providers/retry.mjs', 'src/providers/validate.mjs', 'src/providers/outcome-validate.mjs',
  'src/state.mjs', 'src/storage.mjs', 'src/ui/mini-leagues-state.mjs',
  'src/providers/registry.mjs', 'src/providers/transport.mjs', 'src/providers/common.mjs',
  'src/providers/understat.mjs', 'src/providers/odds.mjs', 'src/providers/minutes-history.mjs',
  'src/model/fixtures.mjs', 'src/model/minutes.mjs', 'src/model/scoring-rules.mjs',
  'src/model/scoring.mjs', 'src/model/simulation.mjs', 'src/squad.mjs',
  'src/model/squad-simulation.mjs', 'src/model/transfers.mjs', 'src/model/walk-forward.mjs',
  'src/model/archive-replay.mjs', 'src/model/backtest.mjs', 'src/main.mjs',
  'src/ui/app-shell.mjs', 'src/ui/team-pitch.mjs', 'src/ui/player-detail.mjs', 'src/ui/decision-preview.mjs',
  'src/evidence/snapshot.mjs', 'src/evidence/outcome.mjs', 'src/evidence/metrics.mjs', 'src/evidence/review.mjs',
  'src/ui/transfer-optimiser-view.mjs', 'src/ui/mini-leagues-view.mjs', 'src/ui/views.mjs', 'src/ui/team-decision-home.mjs', 'src/ui/backtest-copy.mjs',
  'src/ui/markdown.mjs', 'src/ui/security-wiring.mjs', 'src/ui/evidence-recovery.mjs', 'src/ui/download.mjs', 'src/ui/evidence.mjs', 'src/ui/outcomes.mjs', 'src/ui/metrics.mjs', 'src/ui/review.mjs',
];
// model/xp.mjs remains a re-export-only shim and is excluded from the bundle.

const sourceHasher = createHash('sha256');
let bundle = '';
for (const path of ORDER) {
  const raw = readFileSync(path, 'utf8');
  if(/\bstyle\s*:/.test(raw) || /\.style(?:\.|\[|\s*=)/.test(raw) || /setAttribute\(\s*['\"]style/.test(raw) || /\bcssText\b/.test(raw))
    throw new Error(`Inline style API is forbidden in ${path}; use the hash-locked stylesheet`);
  sourceHasher.update(path).update('\0').update(raw);
  bundle += `\n/* ===== ${path} ===== */\n` + stripModuleSyntax(raw) + '\n';
}
assertNoModuleSyntax(bundle);
const sourceHash = sourceHasher.digest('hex');
const commit = process.env.BUILD_COMMIT || 'unversioned';
const cfg = readFileSync('src/config.mjs', 'utf8');
const modelVersion = /MODEL_VERSION\s*=\s*'([^']+)'/.exec(cfg)[1];
const rulesVersion = /RULES_VERSION\s*=\s*'([^']+)'/.exec(cfg)[1];

const manifest = { modelVersion, rulesVersion, sourceHash, commit, moduleOrder: ORDER };
bundle = (`/* BUILD ${JSON.stringify({ modelVersion, rulesVersion, sourceHash: sourceHash.slice(0,16), commit })} */\n`
  + `const BUILD_INFO = ${JSON.stringify(manifest)};\n`
  + `if (typeof top !== 'undefined' && typeof self !== 'undefined' && top !== self) top.location = self.location;\n`
  + bundle).trimEnd() + '\n';

const sha256Csp = value => 'sha256-' + createHash('sha256').update(value, 'utf8').digest('base64');
const template = readFileSync('app.html', 'utf8');
if(/\sstyle\s*=/.test(template)) throw new Error('Inline style attribute remains in app.html');
const styleMatches = [...template.matchAll(/<style>([\s\S]*?)<\/style>/g)];
if(styleMatches.length !== 1) throw new Error(`CSP build requires exactly one inline style block; found ${styleMatches.length}`);
const styleContent = styleMatches[0][1];
const scriptContent = '\n' + bundle + '\n';
const scriptHash = sha256Csp(scriptContent);
const styleHash = sha256Csp(styleContent);
const csp = [
  "default-src 'none'",
  `script-src '${scriptHash}'`,
  `style-src-elem '${styleHash}' https://fonts.googleapis.com`,
  'font-src https://fonts.gstatic.com',
  "connect-src 'self' https://fantasy.premierleague.com https://api.allorigins.win https://corsproxy.io https://api.codetabs.com https://thingproxy.freeboard.io https://understat.com https://api.the-odds-api.com https://raw.githubusercontent.com https://api.anthropic.com",
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

let html = template
  .replace('</title>', `</title>\n<meta http-equiv="Content-Security-Policy" content="${csp}">`)
  .replace('<script src="app.js"></script>', () => '<script>' + scriptContent + '</script>');

const emittedScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
const emittedStyles = [...html.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)];
const emittedCsp = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)">/.exec(html)?.[1];
if(emittedScripts.length !== 1) throw new Error(`CSP verification requires exactly one inline script; found ${emittedScripts.length}`);
if(emittedStyles.length !== 1) throw new Error(`CSP verification requires exactly one inline style block; found ${emittedStyles.length}`);
if(!emittedCsp) throw new Error('CSP verification could not find the emitted policy');
const verifiedScriptHash = sha256Csp(emittedScripts[0][1]);
const verifiedStyleHash = sha256Csp(emittedStyles[0][1]);
if(!emittedCsp.includes(`script-src '${verifiedScriptHash}'`)) throw new Error('CSP script hash does not match emitted script bytes');
if(!emittedCsp.includes(`style-src-elem '${verifiedStyleHash}'`)) throw new Error('CSP style hash does not match emitted style bytes');
if(emittedCsp.includes("'unsafe-inline'")) throw new Error('CSP must not allow unsafe-inline for scripts or styles');
if(emittedCsp.includes('style-src-attr')) throw new Error('CSP must not include a style-src-attr concession');
if(/\sstyle\s*=/.test(html)) throw new Error('Generated deployable contains an inline style attribute');

mkdirSync('dist', { recursive: true });
writeFileSync('dist/app.bundle.js', bundle);
writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
writeFileSync('dist/index.html', html);
writeFileSync('index.html', html);
console.log(`built dist/index.html + index.html (${html.length}b)  model ${modelVersion}  rules ${rulesVersion}  src ${sourceHash.slice(0,12)}  commit ${commit}`);
