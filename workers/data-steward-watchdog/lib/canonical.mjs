// DATA-OPS-A1.4 — the watchdog's own copy of the tiny generic canonicalisation primitives.
//
// This is deliberately a COPY, not an import of `src/decision-intelligence/canonical.mjs`. The
// watchdog is Data-Ops infrastructure; `src/decision-intelligence/` is FPL product/model code.
// Importing across that boundary would make the watchdog depend on product code for no reason
// beyond four generic, dependency-free helper functions, and would let a future product-side edit
// change infrastructure behaviour by accident. A permanent test pins that nothing under
// `workers/data-steward-watchdog/` ever imports `src/`, in either direction.
//
// The implementations below are byte-identical in behaviour to the product copy; only the module
// boundary changed.
const UNSAFE_KEYS=new Set(['__proto__','prototype','constructor']);
const SECRET_KEY=/^(?:api[-_]?key|token|secret|password|authorization|cookie|client[-_]?secret|access[-_]?key|private[-_]?key)$/i;
const SECRET_VALUE=/(?:\bbearer\s+\S+|\b(?:sk|ant)-[A-Za-z0-9_-]{8,}|[?&](?:key|token|api[_-]?key)=)/i;

export function canonicalise(value){
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new Error('non_finite_number');
    return Object.is(value,-0)?0:value;
  }
  if(Array.isArray(value))return value.map(canonicalise);
  if(value&&typeof value==='object'){
    const result={};
    for(const key of Object.keys(value).sort()){
      if(UNSAFE_KEYS.has(key))throw new Error('unsafe_object_key');
      if(value[key]!==undefined)result[key]=canonicalise(value[key]);
    }
    return result;
  }
  throw new Error('unsupported_value');
}
export function stableStringify(value){return JSON.stringify(canonicalise(value));}
export function deepFreeze(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  for(const child of Object.values(value))deepFreeze(child);
  return Object.freeze(value);
}
export async function sha256Hex(value,cryptoImpl=globalThis.crypto){
  if(!cryptoImpl?.subtle)throw new Error('sha256_unavailable');
  const digest=await cryptoImpl.subtle.digest('SHA-256',new TextEncoder().encode(String(value)));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export function secretFinding(value,path='$'){
  if(typeof value==='string')return SECRET_VALUE.test(value)?`${path}:secret_value`:null;
  if(Array.isArray(value)){for(let i=0;i<value.length;i++){const found=secretFinding(value[i],`${path}[${i}]`);if(found)return found;}return null;}
  if(value&&typeof value==='object')for(const [key,child] of Object.entries(value)){
    if(SECRET_KEY.test(key))return `${path}.${key}:secret_key`;
    const found=secretFinding(child,`${path}.${key}`);if(found)return found;
  }
  return null;
}
