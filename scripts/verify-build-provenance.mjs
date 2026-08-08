#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { hashBuildInputs } from '../build-utils.mjs';

const ROOT = new URL('../', import.meta.url);
const rootPath = ROOT.pathname;
const manifest = JSON.parse(readFileSync(new URL('../dist/manifest.json', import.meta.url), 'utf8'));
const outputs = ['dist/app.bundle.js', 'dist/index.html', 'dist/manifest.json', 'index.html'];

function git(args, options = {}){
  return execFileSync('git', args, { cwd:rootPath, stdio:['ignore', 'pipe', 'pipe'], ...options });
}

if(!/^[0-9a-f]{40}$/.test(manifest.commit || ''))
  throw new Error('Committed manifest must record a full 40-character source commit');

git(['cat-file', '-e', `${manifest.commit}^{commit}`]);
try {
  git(['merge-base', '--is-ancestor', manifest.commit, 'HEAD']);
} catch {
  throw new Error(`Manifest source ${manifest.commit} is not a reachable ancestor of HEAD`);
}

if(!Array.isArray(manifest.moduleOrder) || !Array.isArray(manifest.buildInputFiles))
  throw new Error('Committed manifest is missing build input provenance');

const currentHash = hashBuildInputs(manifest.moduleOrder, path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
if(currentHash !== manifest.buildInputHash)
  throw new Error(`Build input hash mismatch: manifest ${manifest.buildInputHash}, current ${currentHash}`);

for(const path of manifest.buildInputFiles){
  const current = readFileSync(new URL(`../${path}`, import.meta.url));
  const recorded = git(['show', `${manifest.commit}:${path}`]);
  if(!current.equals(recorded)) throw new Error(`Build input changed after recorded source commit: ${path}`);
}

const work = mkdtempSync(join(tmpdir(), 'teamsheet-provenance-'));
try {
  for(const path of manifest.buildInputFiles){
    const target = join(work, path);
    mkdirSync(dirname(target), { recursive:true });
    copyFileSync(new URL(`../${path}`, import.meta.url), target);
  }
  execFileSync(process.execPath, ['build.mjs'], {
    cwd:work,
    env:{ ...process.env, BUILD_COMMIT:manifest.commit },
    stdio:'pipe'
  });
  for(const path of outputs){
    const tracked = readFileSync(new URL(`../${path}`, import.meta.url));
    const reproduced = readFileSync(join(work, path));
    if(!tracked.equals(reproduced)) throw new Error(`Committed output does not reproduce exactly: ${path}`);
  }
} finally {
  rmSync(work, { recursive:true, force:true });
}

console.log(`Verified committed build provenance from reachable source ${manifest.commit}`);
