// Stage 3.6 — restricted Markdown renderer for untrusted AI output.
// The parser returns a tiny, explicit AST. Rendering uses the shared DOM builder,
// so provider output never becomes HTML and raw tags remain inert text.

const MD_MAX_INPUT = 50000;

function safeMarkdownHref(raw){
  let value = String(raw ?? '').trim();
  if(!value || value.startsWith('//') || /[\u0000-\u001f\u007f]/.test(value)) return null;
  // HTML entities are never needed in an approved absolute URL and can hide a
  // dangerous scheme from a superficial check.
  if(/&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i.test(value)) return null;
  try{
    for(let i=0;i<3;i++){
      const decoded = decodeURIComponent(value);
      if(decoded === value) break;
      value = decoded.trim();
    }
  }catch{ return null; }
  if(value.startsWith('//') || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try{
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  }catch{ return null; }
}

function parseMarkdownInline(text){
  const source = String(text ?? '');
  const out = [];
  let plain = '';
  const flush = () => { if(plain){ out.push({type:'text', text:plain}); plain = ''; } };

  for(let i=0;i<source.length;){
    if(source.startsWith('**', i)){
      const end = source.indexOf('**', i+2);
      if(end > i+2){
        flush();
        out.push({type:'strong', children:parseMarkdownInline(source.slice(i+2,end))});
        i = end+2; continue;
      }
    }
    if(source[i] === '*' && source[i+1] !== '*'){
      const end = source.indexOf('*', i+1);
      if(end > i+1){
        flush();
        out.push({type:'em', children:parseMarkdownInline(source.slice(i+1,end))});
        i = end+1; continue;
      }
    }
    if(source[i] === '['){
      const close = source.indexOf('](', i+1);
      const end = close >= 0 ? source.indexOf(')', close+2) : -1;
      if(close > i+1 && end > close+2){
        const label = source.slice(i+1, close);
        const href = safeMarkdownHref(source.slice(close+2, end));
        flush();
        if(href) out.push({type:'link', href, children:parseMarkdownInline(label)});
        else out.push({type:'text', text:label});
        i = end+1; continue;
      }
    }
    plain += source[i++];
  }
  flush();
  return out;
}

function parseRestrictedMarkdown(input){
  const text = String(input ?? '').slice(0, MD_MAX_INPUT).replace(/\r\n?/g,'\n');
  const lines = text.split('\n');
  const blocks = [];
  let paragraph = [];
  let list = [];
  const flushParagraph = () => {
    if(paragraph.length){
      blocks.push({type:'paragraph', children:parseMarkdownInline(paragraph.join('\n'))});
      paragraph = [];
    }
  };
  const flushList = () => {
    if(list.length){ blocks.push({type:'list', items:list}); list = []; }
  };

  for(const line of lines){
    const heading = /^(?:##|###)\s+(.+)$/.exec(line);
    const item = /^[-•]\s+(.+)$/.exec(line);
    if(heading){
      flushParagraph(); flushList();
      blocks.push({type:'heading', children:parseMarkdownInline(heading[1])});
    }else if(item){
      flushParagraph();
      list.push(parseMarkdownInline(item[1]));
    }else if(!line.trim()){
      flushParagraph(); flushList();
    }else{
      flushList(); paragraph.push(line);
    }
  }
  flushParagraph(); flushList();
  return blocks;
}

function markdownInlineNodes(tokens){
  return tokens.map(token => {
    if(token.type === 'strong') return el('b',{},markdownInlineNodes(token.children));
    if(token.type === 'em') return el('i',{},markdownInlineNodes(token.children));
    if(token.type === 'link') return el('a',{href:token.href,target:'_blank',rel:'noopener noreferrer'},markdownInlineNodes(token.children));
    return token.text;
  });
}

function restrictedMarkdownNodes(input){
  return parseRestrictedMarkdown(input).map(block => {
    if(block.type === 'heading') return el('h4',{},markdownInlineNodes(block.children));
    if(block.type === 'list') return el('ul',{},block.items.map(item => el('li',{},markdownInlineNodes(item))));
    const children = [];
    block.children.forEach(token => {
      const nodes = markdownInlineNodes([token]);
      nodes.forEach(node => {
        if(typeof node === 'string' && node.includes('\n')){
          node.split('\n').forEach((part,index) => { if(index) children.push(el('br')); children.push(part); });
        }else children.push(node);
      });
    });
    return el('p',{},children);
  });
}

function renderSanitisedThread(){
  setChildren($('thread'), S.thread.map(message =>
    el('div',{class:`answer ${message.role === 'user' ? 'me' : ''}`},restrictedMarkdownNodes(message.content))));
}

// The bundle loads this file immediately after views.mjs. Replacing the legacy
// renderer here keeps Stage 3.6 focused and removes the final dynamic innerHTML sink.
if(typeof renderThread !== 'undefined') renderThread = renderSanitisedThread;

export { MD_MAX_INPUT, safeMarkdownHref, parseMarkdownInline, parseRestrictedMarkdown };
