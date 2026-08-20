/* Minimal DOM sufficient to execute the real setupAppShell() and a real tap. */
function parseSelector(selector){
  return String(selector).split(',').map(part=>{
    const last=part.trim().split(/\s+/).pop();
    const attr=/\[([a-zA-Z-]+)(?:([\^$*]?=)"([^"]*)")?\]/.exec(last);
    const bare=last.replace(/\[[^\]]*\]/g,'');
    const id=/#([A-Za-z0-9_-]+)/.exec(bare)?.[1]||null;
    const cls=[...bare.matchAll(/\.([A-Za-z0-9_-]+)/g)].map(m=>m[1]);
    const tag=/^([a-zA-Z][a-zA-Z0-9]*)/.exec(bare)?.[1]||null;
    return {tag,id,cls,attr:attr?{name:attr[1],op:attr[2]||null,value:attr[3]??null}:null};
  });
}
function matchesOne(node,s){
  if(node.nodeType!==1) return false;
  if(s.tag&&node.tagName!==s.tag.toUpperCase()) return false;
  if(s.id&&node.id!==s.id) return false;
  if(s.cls.length&&!s.cls.every(c=>node.classList.contains(c))) return false;
  if(s.attr){
    const value=node.getAttribute(s.attr.name);
    if(value==null) return false;
    if(s.attr.op==='='&&value!==s.attr.value) return false;
    if(s.attr.op==='^='&&!value.startsWith(s.attr.value)) return false;
  }
  return true;
}
class Element {
  constructor(tag){
    this.tagName=String(tag).toUpperCase(); this.nodeType=1; this.id='';
    this.attrs=new Map(); this.children=[]; this.parentNode=null;
    this._text=''; this.dataset={}; this.listeners=new Map(); this.hidden=false;
    const owner=this;
    this.classList={
      add(...names){ names.forEach(n=>owner._classes().add(n)); owner._syncClass(); },
      remove(...names){ names.forEach(n=>owner._classes().delete(n)); owner._syncClass(); },
      contains(name){ return owner._classes().has(name); },
      toggle(name,force){ const on=force===undefined?!owner._classes().has(name):Boolean(force);
        if(on) owner._classes().add(name); else owner._classes().delete(name); owner._syncClass(); return on; }
    };
  }
  _classes(){ if(!this._classSet) this._classSet=new Set(String(this.attrs.get('class')||'').split(/\s+/).filter(Boolean)); return this._classSet; }
  _syncClass(){ this.attrs.set('class',[...this._classes()].join(' ')); }
  get className(){ return this.attrs.get('class')||''; }
  set className(value){ this.attrs.set('class',String(value)); this._classSet=null; }
  setAttribute(name,value){
    if(name==='class'){ this.className=value; return; }
    if(name==='id'){ this.id=String(value); }
    if(name==='hidden'){ this.hidden=true; }
    if(name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);
    this.attrs.set(name,String(value));
  }
  getAttribute(name){ return name==='class'?this.className:(this.attrs.has(name)?this.attrs.get(name):null); }
  removeAttribute(name){ this.attrs.delete(name); if(name==='hidden') this.hidden=false; }
  get firstChild(){ return this.children[0]||null; }
  appendChild(node){ if(node.parentNode) node.parentNode.removeChild(node); node.parentNode=this; this.children.push(node); return node; }
  append(...nodes){ nodes.forEach(n=>this.appendChild(n)); }
  insertBefore(node,ref){
    if(node.parentNode) node.parentNode.removeChild(node);
    const index=ref?this.children.indexOf(ref):-1;
    node.parentNode=this;
    if(index===-1) this.children.push(node); else this.children.splice(index,0,node);
    return node;
  }
  removeChild(node){ const i=this.children.indexOf(node); if(i>=0){ this.children.splice(i,1); node.parentNode=null; } return node; }
  remove(){ this.parentNode?.removeChild(this); }
  get textContent(){ return this._text+this.children.map(c=>c.textContent??'').join(''); }
  set textContent(value){ this.children.forEach(c=>{c.parentNode=null;}); this.children=[]; this._text=String(value); }
  matches(selector){ return parseSelector(selector).some(s=>matchesOne(this,s)); }
  closest(selector){ let node=this; while(node&&node.nodeType===1){ if(node.matches(selector)) return node; node=node.parentNode; } return null; }
  querySelectorAll(selector){
    const parsed=parseSelector(selector); const found=[];
    const visit=current=>{ for(const child of current.children){ if(child.nodeType===1){ if(parsed.some(s=>matchesOne(child,s))) found.push(child); visit(child); } } };
    visit(this); return found;
  }
  querySelector(selector){ return this.querySelectorAll(selector)[0]||null; }
  contains(node){ let current=node; while(current){ if(current===this) return true; current=current.parentNode; } return false; }
  focus(){ documentRef.activeElement=this; }
  addEventListener(type,handler){ if(!this.listeners.has(type)) this.listeners.set(type,[]); this.listeners.get(type).push(handler); }
  dispatchEvent(event){
    event.target=event.target||this;
    const chain=[]; let node=this; while(node){ chain.push(node); node=node.parentNode; }
    chain.push(documentRef);
    chain.reverse().forEach(n=>(n.listeners?.get(event.type)||[]).forEach(h=>h(event)));
    return true;
  }
}
class TextNode { constructor(text){ this.nodeType=3; this._text=String(text); this.parentNode=null; this.children=[]; } get textContent(){ return this._text; } }
const documentRef={
  nodeType:9, activeElement:null, listeners:new Map(), title:'',
  body:new Element('body'),
  documentElement:new Element('html'),
  createElement(tag){ return new Element(tag); },
  createElementNS(_ns,tag){ return new Element(tag); },
  createTextNode(text){ return new TextNode(text); },
  getElementById(id){ return documentRef.body.querySelectorAll(`#${id}`)[0]||null; },
  querySelector(selector){ return documentRef.body.querySelector(selector); },
  querySelectorAll(selector){ return documentRef.body.querySelectorAll(selector); },
  contains(node){ return documentRef.body.contains(node); },
  addEventListener(type,handler){ if(!documentRef.listeners.has(type)) documentRef.listeners.set(type,[]); documentRef.listeners.get(type).push(handler); },
  dispatchEvent(event){ (documentRef.listeners.get(event.type)||[]).forEach(h=>h(event)); return true; }
};
documentRef.body.dataset={};
export { Element, documentRef, parseSelector };
