const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));
const fmt1 = v => (Math.round(v*10)/10).toFixed(1);

const ESC_MAP = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const escapeHTML = v => String(v).replace(/[&<>"']/g, c => ESC_MAP[c]);
export { $, num, clamp, fmt1, escapeHTML };
