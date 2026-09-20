import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {spawnSync} from 'node:child_process';

test('migration 0005 applies to populated 0004 database and preserves atomic constraints without dirtying checkout',()=>{
  const root=path.resolve(import.meta.dirname,'..');
  const gitStatus=()=>spawnSync('git',['status','--porcelain','--untracked-files=all'],{cwd:root,encoding:'utf8'}).stdout;
  const before=gitStatus();
  const result=spawnSync(process.execPath,['tests/eia2i5d-d1-local-migration.mjs'],{cwd:root,encoding:'utf8',timeout:300000});
  const after=gitStatus();
  assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`);assert.match(result.stdout,/PASS/);
  assert.equal(after,before,`local D1 migration harness changed checkout:\nBEFORE:\n${before}\nAFTER:\n${after}`);
});
