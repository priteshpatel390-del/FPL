const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));
const fmt1 = v => (Math.round(v*10)/10).toFixed(1);
const SVG_NS = 'http://www.w3.org/2000/svg';

// The only rendering primitives dynamic views should need. Attribute names are
// explicit at the call site; all children become text nodes unless they are
// already DOM nodes. Inline style attributes are deliberately rejected: Stage
// 9.6 requires every presentation rule to live in the hash-locked stylesheet.
function applyAttributes(node, attrs = {}, svg = false){
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if(value == null || value === false) return;
    if(key === 'style') throw new Error('Inline style attributes are forbidden; use a class or safe element attribute.');
    if(key === 'class'){
      if(svg) node.setAttribute('class', String(value));
      else node.className = String(value);
    }
    else if(key === 'text') node.textContent = String(value);
    else if(key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if(key === 'dataset') Object.entries(value).forEach(([name, v]) => { node.dataset[name] = String(v); });
    else if(value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  });
  return node;
}

function appendChildren(node, children){
  const add = child => {
    if(child == null || child === false) return;
    if(Array.isArray(child)){ child.forEach(add); return; }
    node.appendChild(child && typeof child === 'object' && child.nodeType
      ? child : document.createTextNode(String(child)));
  };
  children.forEach(add);
  return node;
}

function el(tag, attrs = {}, ...children){
  return appendChildren(applyAttributes(document.createElement(tag), attrs), children);
}

function svgEl(tag, attrs = {}, ...children){
  return appendChildren(applyAttributes(document.createElementNS(SVG_NS, tag), attrs, true), children);
}

function setChildren(node, ...children){
  while(node.firstChild) node.removeChild(node.firstChild);
  return appendChildren(node, children.flat(Infinity));
}

const ESC_MAP = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const escapeHTML = v => String(v).replace(/[&<>"']/g, c => ESC_MAP[c]);
export { $, num, clamp, fmt1, escapeHTML, el, svgEl, setChildren };
