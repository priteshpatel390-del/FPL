import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { safeMarkdownHref, parseRestrictedMarkdown } from '../src/ui/markdown.mjs';

const flattenText = value => {
  if(Array.isArray(value)) return value.map(flattenText).join('');
  if(!value || typeof value !== 'object') return '';
  return (value.text || '') + flattenText(value.children) + flattenText(value.items);
};

test('allows only absolute HTTP and HTTPS links', () => {
  assert.equal(safeMarkdownHref('https://example.com/a'), 'https://example.com/a');
  assert.equal(safeMarkdownHref('HTTP://EXAMPLE.COM'), 'http://example.com/');
  for(const href of ['javascript:alert(1)','JaVaScRiPt:alert(1)','data:text/html,x','vbscript:x','//evil.example','mailto:x@example.com','/relative','file:///tmp/x']){
    assert.equal(safeMarkdownHref(href), null, href);
  }
});

test('rejects encoded, entity-obscured and control-character schemes', () => {
  for(const href of ['%6a%61%76%61%73%63%72%69%70%74:alert(1)','%256a%2561vascript:alert(1)','jav&#x61;script:alert(1)','java\nscript:alert(1)','https://example.com/\u0000x']){
    assert.equal(safeMarkdownHref(href), null, href);
  }
});

test('raw HTML and handler-shaped text remain text tokens', () => {
  const input = '<script>alert(1)</script> <img src=x onerror=alert(2)> <svg onload=alert(3)>';
  const ast = parseRestrictedMarkdown(input);
  assert.equal(flattenText(ast), input);
  assert.equal(JSON.stringify(ast).includes('script'), true);
  assert.equal(JSON.stringify(ast).includes('href'), false);
});

test('hostile Markdown links lose the link but keep their label', () => {
  const ast = parseRestrictedMarkdown('[safe label](javascript:alert(1)) [good](https://example.com)');
  const serialised = JSON.stringify(ast);
  assert.match(serialised, /safe label/);
  assert.doesNotMatch(serialised, /javascript:/i);
  assert.match(serialised, /"type":"link"/);
  assert.match(serialised, /https:\/\/example\.com\//);
});

test('restricted blocks include only headings, lists and paragraphs', () => {
  const ast = parseRestrictedMarkdown('## Heading\n\n- one\n- **two**\n\nParagraph *three*');
  assert.deepEqual(ast.map(x => x.type), ['heading','list','paragraph']);
  assert.equal(flattenText(ast), 'HeadingonetwoParagraph three');
});

test('nested and unbalanced HTML cannot create an executable structure', () => {
  const input = '<div><a href="javascript:alert(1)" onclick="x">broken';
  const ast = parseRestrictedMarkdown(input);
  assert.equal(flattenText(ast), input);
  assert.deepEqual(ast.map(x => x.type), ['paragraph']);
});

test('input is bounded deterministically', () => {
  const huge = 'a'.repeat(60000);
  assert.equal(flattenText(parseRestrictedMarkdown(huge)).length, 50000);
  assert.deepEqual(parseRestrictedMarkdown(huge), parseRestrictedMarkdown(huge));
});

test('bundled renderer contains the DOM-only sanitised replacement', () => {
  const source = readFileSync(new URL('../src/ui/markdown.mjs', import.meta.url), 'utf8');
  assert.match(source, /setChildren\(\$\('thread'\)/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
  assert.match(source, /rel:'noopener noreferrer'/);
  assert.match(source, /target:'_blank'/);
});
