import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('evidence archive Cloudflare build root is isolated and byte-identical to the verified source', () => {
  const gateway = JSON.parse(read('workers/wrangler.jsonc'));
  const sourceConfig = read('workers/evidence-wrangler.jsonc');
  const deployConfig = read('workers/evidence-archive/wrangler.jsonc');

  assert.equal(gateway.name, 'teamsheet-fpl-gateway');
  assert.equal(gateway.main, 'fpl-gateway.mjs');
  assert.equal(deployConfig, sourceConfig);
  assert.equal(
    read('workers/evidence-archive/evidence-archive.mjs'),
    read('workers/evidence-archive.mjs')
  );
  assert.equal(
    read('workers/evidence-archive/evidence-archive-core.mjs'),
    read('workers/evidence-archive-core.mjs')
  );
  assert.equal(
    read('workers/evidence-archive/evidence-migrations/0001_evidence_foundation.sql'),
    read('workers/evidence-migrations/0001_evidence_foundation.sql')
  );

  const evidence = JSON.parse(deployConfig);
  assert.equal(evidence.name, 'teamsheet-evidence-archive');
  assert.equal(evidence.main, 'evidence-archive.mjs');
  assert.equal(evidence.d1_databases[0].migrations_dir, 'evidence-migrations');
  assert.notEqual(evidence.name, gateway.name);
  assert.notEqual(evidence.main, gateway.main);
});
