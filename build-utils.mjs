// Build-only helpers for the zero-dependency bundler.
// Static module declarations are removed as complete declarations; unsupported
// module syntax is rejected later by build.mjs rather than leaking to production.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const BUILD_SYSTEM_INPUTS = Object.freeze(['app.html', 'build.mjs', 'build-utils.mjs']);

function hashNamedInputs(entries){
  const hash = createHash('sha256');
  for(const entry of entries){
    if(!entry || typeof entry.path !== 'string' || !entry.path || typeof entry.content !== 'string')
      throw new TypeError('Build hash entries require a non-empty path and string content');
    hash.update(entry.path).update('\0').update(entry.content);
  }
  return hash.digest('hex');
}

function buildInputFiles(moduleOrder){
  if(!Array.isArray(moduleOrder) || moduleOrder.some(path => typeof path !== 'string' || !path))
    throw new TypeError('Build input identity requires an ordered module list');
  return Object.freeze([...moduleOrder, ...BUILD_SYSTEM_INPUTS]);
}

function hashBuildInputs(moduleOrder, read = path => readFileSync(path, 'utf8')){
  return hashNamedInputs(buildInputFiles(moduleOrder).map(path => ({ path, content:read(path) })));
}

const IMPORT_END = /(?:^|\s)from\s+['"][^'"]+['"]\s*;?$|^import\s*['"][^'"]+['"]\s*;?$/;
const EXPORT_LIST_END = /\}(?:\s+from\s+['"][^'"]+['"])?\s*;?$/;

function stripModuleSyntax(code){
  const kept = [];
  let mode = null;

  for(const line of String(code).split('\n')){
    const t = line.trim();

    if(mode === 'import'){
      if(IMPORT_END.test(t)) mode = null;
      continue;
    }

    if(mode === 'export-list'){
      if(EXPORT_LIST_END.test(t)) mode = null;
      continue;
    }

    if(/^import\s/.test(t)){
      if(!IMPORT_END.test(t)) mode = 'import';
      continue;
    }

    if(/^export\s*\{/.test(t)){
      if(!EXPORT_LIST_END.test(t)) mode = 'export-list';
      continue;
    }

    kept.push(line);
  }

  if(mode === 'import') throw new Error('Bundler found an unterminated import declaration');
  if(mode === 'export-list') throw new Error('Bundler found an unterminated export list');

  return kept.join('\n')
    .replace(/^export (const|function|async function|let|class)/gm, '$1');
}

function assertNoModuleSyntax(code){
  const remaining = /^\s*(?:import|export)\b/m.exec(String(code));
  if(remaining) throw new Error(`Bundler emitted unsupported module syntax: ${remaining[0].trim()}`);
}

export {
  BUILD_SYSTEM_INPUTS,
  hashNamedInputs,
  buildInputFiles,
  hashBuildInputs,
  stripModuleSyntax,
  assertNoModuleSyntax
};
