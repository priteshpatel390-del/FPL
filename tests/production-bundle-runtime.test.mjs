import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { Script } from 'node:vm';
import { loadApp } from './harness.mjs';

const BUNDLE_PATH = 'dist/app.bundle.js';
const STARTUP_MARKER = '(async function init(){';
const LATE_RUNTIME_MARKER = '/* ===== src/ui/manual-squad-runtime.mjs ===== */';

function bundleWithoutLiveStartup(bundle){
  const start = bundle.indexOf(STARTUP_MARKER);
  const lateRuntime = bundle.indexOf(LATE_RUNTIME_MARKER);
  assert.ok(start >= 0, 'generated bundle must contain the production startup IIFE');
  assert.ok(lateRuntime > start, 'manual-squad runtime must remain after production startup in the generated order');
  assert.equal(bundle.indexOf(STARTUP_MARKER, start + STARTUP_MARKER.length), -1,
    'generated bundle must contain exactly one production startup IIFE');
  return bundle.slice(0, start) + bundle.slice(lateRuntime);
}

test('complete generated production bundle parses as one classic script', () => {
  const bundle = readFileSync(BUNDLE_PATH, 'utf8');
  assert.doesNotThrow(() => new Script(bundle, { filename:BUNDLE_PATH }));
});

test('runtime harness suppresses only live startup and retains every late production module', () => {
  const bundle = readFileSync(BUNDLE_PATH, 'utf8');
  const runtimeBundle = bundleWithoutLiveStartup(bundle);

  assert.doesNotMatch(runtimeBundle, /\(async function init\(\)\{/);
  for(const path of [
    'src/ui/manual-squad-runtime.mjs',
    'src/ui/backtest-copy.mjs',
    'src/ui/markdown.mjs',
    'src/ui/security-wiring.mjs',
    'src/ui/evidence-recovery.mjs',
    'src/ui/download.mjs',
    'src/ui/evidence.mjs',
    'src/ui/outcomes.mjs',
    'src/ui/metrics.mjs',
    'src/ui/review.mjs'
  ]) assert.match(runtimeBundle, new RegExp(`/\\* ===== ${path.replaceAll('.', '\\.') } ===== \\*/`));
  assert.doesNotThrow(() => new Script(runtimeBundle, { filename:'dist/app.bundle.runtime-test.js' }));
});

test('generated bundle executes its late runtime replacements under the existing zero-dependency harness', () => {
  const bundle = readFileSync(BUNDLE_PATH, 'utf8');
  const runtimeBundle = bundleWithoutLiveStartup(bundle) + `\n
// Test-only probes run after every generated production module. They do not
// modify repository source or the deployed artefact.
globalThis.__PB_RENDER_THREAD__ = renderThread;
globalThis.__PB_SANITISED_THREAD__ = renderSanitisedThread;
globalThis.__PB_NORMALISE_ROUTE__ = normaliseTeamsheetRoute;
`;
  const relativeTarget = `dist/.production-bundle-runtime-${process.pid}.js`;
  writeFileSync(relativeTarget, runtimeBundle);
  const previousTarget = process.env.APP_TARGET;
  process.env.APP_TARGET = relativeTarget;

  try{
    const { T } = loadApp({}, { interactive:true });

    // manual-squad-runtime.mjs must have replaced the shared production
    // renderTransfers binding with the route-aware wrapper.
    globalThis.location.hash = '#/team';
    assert.deepEqual(T.renderTransfers(), { deferred:true });

    // markdown.mjs must have replaced the legacy thread renderer with the
    // sanitised implementation in the same flattened lexical scope.
    assert.equal(globalThis.__PB_RENDER_THREAD__, globalThis.__PB_SANITISED_THREAD__);

    // Keep the production navigation contract in the same executed artefact:
    // the route implementation used by the global bridge is present and usable.
    assert.equal(globalThis.__PB_NORMALISE_ROUTE__('#more'), '#/settings');
    assert.match(runtimeBundle, /globalThis\.__teamsheetNavigate\s*=\s*navigateTeamsheetRoute/);
  } finally {
    if(previousTarget === undefined) delete process.env.APP_TARGET;
    else process.env.APP_TARGET = previousTarget;
    delete globalThis.__PB_RENDER_THREAD__;
    delete globalThis.__PB_SANITISED_THREAD__;
    delete globalThis.__PB_NORMALISE_ROUTE__;
    unlinkSync(relativeTarget);
  }
});
