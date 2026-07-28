const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));
const fmt1 = v => (Math.round(v*10)/10).toFixed(1);

// The only rendering primitive dynamic views should need. Attribute names are
// explicit at the call site; all children become text nodes unless they are
// already DOM nodes. This makes provider/user strings inert by construction.
function el(tag, attrs = {}, ...children){
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if(value == null || value === false) return;
    if(key === 'class') node.className = String(value);
    else if(key === 'text') node.textContent = String(value);
    else if(key === 'style' && value && typeof value === 'object')
      Object.entries(value).forEach(([name, v]) => { node.style[name] = String(v); });
    else if(key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if(key === 'dataset') Object.entries(value).forEach(([name, v]) => { node.dataset[name] = String(v); });
    else if(value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  });
  const add = child => {
    if(child == null || child === false) return;
    if(Array.isArray(child)){ child.forEach(add); return; }
    node.appendChild(child && typeof child === 'object' && child.nodeType
      ? child : document.createTextNode(String(child)));
  };
  children.forEach(add);
  return node;
}

function setChildren(node, ...children){
  while(node.firstChild) node.removeChild(node.firstChild);
  children.flat(Infinity).forEach(child => {
    if(child == null || child === false) return;
    node.appendChild(child && typeof child === 'object' && child.nodeType
      ? child : document.createTextNode(String(child)));
  });
  return node;
}

const ESC_MAP = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const escapeHTML = v => String(v).replace(/[&<>"']/g, c => ESC_MAP[c]);
export { $, num, clamp, fmt1, escapeHTML, el, setChildren };
