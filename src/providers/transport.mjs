import { S } from '../state.mjs';
/* ---------------------------------------------------------------------
   FETCH — the FPL API sends no CORS headers, so requests cascade through
   public read-only relays. Each attempt is capped so one dead relay
   cannot stall the chain.
   --------------------------------------------------------------------- */
const BASE = 'https://fantasy.premierleague.com/api';
const RELAYS = [
  u => u,
  u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
  u => 'https://corsproxy.io/?' + encodeURIComponent(u),
  u => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u),
  u => 'https://thingproxy.freeboard.io/fetch/' + u
];
let relayIdx = 0;

async function fetchT(url, ms){
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try{ return await fetch(url, {signal:c.signal, headers:{'Accept':'application/json'}}); }
  finally{ clearTimeout(t); }
}

async function api(path, {optional=false, timeout=8000} = {}){
  const url = BASE + path;
  for(let i=0;i<RELAYS.length;i++){
    const idx = (relayIdx + i) % RELAYS.length;
    try{
      const res = await fetchT(RELAYS[idx](url), timeout);
      if(!res.ok) continue;
      const data = await res.json();
      if(data && (data.detail === 'Not found.' || data.detail)) { if(optional) return null; continue; }
      relayIdx = idx;
      S.source = idx === 0 ? 'direct' : 'relay ' + idx;
      return data;
    }catch(e){ /* next relay */ }
  }
  if(optional) return null;
  throw new Error('feed unreachable: ' + path);
}

// limited-concurrency map, so 20 rival lookups don't hammer one relay
async function pool(items, worker, size=4){
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({length:Math.min(size, items.length)}, async () => {
    while(i < items.length){
      const idx = i++;
      try{ out[idx] = await worker(items[idx]); }catch(e){ out[idx] = null; }
    }
  }));
  return out;
}

// generic relay fetch for non-FPL sites (Understat needs it; raw GitHub doesn't)
async function fetchVia(url, {timeout=12000, asText=false} = {}){
  for(const wrap of RELAYS){
    try{
      const res = await fetchT(wrap(url), timeout);
      if(!res.ok) continue;
      return asText ? await res.text() : await res.json();
    }catch(e){}
  }
  return null;
}

export { BASE, RELAYS, fetchT, api, pool, fetchVia };
