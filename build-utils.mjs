// Build-only helpers for the zero-dependency bundler.
// Static module declarations are removed as complete declarations; unsupported
// module syntax is rejected later by build.mjs rather than leaking to production.

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

export { stripModuleSyntax, assertNoModuleSyntax };
