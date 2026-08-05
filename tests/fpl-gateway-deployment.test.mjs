import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normaliseGatewayBase, gatewayRequestUrl } from '../src/providers/transport.mjs';

const GATEWAY = 'https://teamsheet-fpl-gateway.fpltsheet.workers.dev/fpl';
const ORIGIN = 'https://teamsheet-fpl-gateway.fpltsheet.workers.dev';

test('production build is pinned to the owner-controlled Official FPL gateway', () => {
  assert.equal(normaliseGatewayBase(GATEWAY), GATEWAY);
  assert.equal(gatewayRequestUrl('/bootstrap-static/', GATEWAY), GATEWAY + '/bootstrap-static/');
  for (const file of ['app.html', 'index.html', 'dist/index.html']) {
    const html = readFileSync(file, 'utf8');
    assert.match(html, new RegExp(`<meta name="teamsheet-fpl-gateway" content="${GATEWAY}">`));
  }
});

test('generated CSP permits only the stable production Worker origin', () => {
  for (const file of ['index.html', 'dist/index.html']) {
    const html = readFileSync(file, 'utf8');
    const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html)?.[1] || '';
    assert.ok(csp.includes(ORIGIN));
    assert.doesNotMatch(csp, /\*-teamsheet-fpl-gateway/);
  }
});
