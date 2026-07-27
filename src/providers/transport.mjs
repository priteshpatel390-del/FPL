import { S, recordRetry } from '../state.mjs';
import { policyFor, withRetry, isRetryableStatus, safeEndpoint } from './retry.mjs';
/* ---------------------------------------------------------------------
   FETCH — the FPL API sends no CORS headers, so requests cascade through
   public read-only relays. Each attempt is capped so one dead relay
   cannot stall the chain.

   D-15: retry sits around the WHOLE cascade, not around each relay.
   Rotating to the next relay is transport selection, not a retry — it is
   already the redundancy mechanism. Retrying each of five relays three
   times would mean fifteen requests and roughly two minutes of spinner
   on a total outage. One cascade therefore counts as one attempt, and a
   second cascade only runs if the first failed transiently AND failed
   quickly enough to still look like a blip (the elapsed-time budget).
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

/* One full pass over the relay list. Returns an outcome describing what
   happened, including whether the failures looked transient:
     {outcome:'value',    value, status}
     {outcome:'notfound', status}          provider says the entry isn't there
     {outcome:'failed',   retryable, status}
   A parse failure does NOT mark the cascade retryable — a relay returning
   junk will keep returning junk — but the next relay is still tried, since
   that is a different upstream and may well be fine. */
async function cascadeOnce(url, timeout, optional){
  let sawRetryable = false, lastStatus = null;
  for(let i=0;i<RELAYS.length;i++){
    const idx = (relayIdx + i) % RELAYS.length;
    let res;
    try{ res = await fetchT(RELAYS[idx](url), timeout); }
    catch(e){ sawRetryable = true; lastStatus = 'network'; continue; }

    if(!res.ok){
      lastStatus = res.status;
      if(isRetryableStatus(res.status)) sawRetryable = true;
      continue;
    }

    let data;
    try{ data = await res.json(); }
    catch(e){ lastStatus = 'parse'; continue; }

    if(data && (data.detail === 'Not found.' || data.detail)){
      if(optional) return {outcome:'notfound', status:'not-found'};
      lastStatus = 'detail';
      continue;
    }

    relayIdx = idx;
    S.source = idx === 0 ? 'direct' : 'relay ' + idx;
    return {outcome:'value', value:data, status:res.status};
  }
  return {outcome:'failed', retryable:sawRetryable, status:lastStatus};
}

async function api(path, {optional=false, timeout=8000} = {}){
  const url = BASE + path;
  // Optional endpoints already have a graceful fallback, and several of them
  // are fetched in a pool of twenty (rival squads). Spending the full core-data
  // allowance on each would turn one outage into hundreds of doomed requests,
  // so they get a smaller one. Core data keeps the full allowance.
  const policy = policyFor('fpl');
  if(optional) policy.attempts = Math.min(policy.attempts, 2);

  const { result, record } = await withRetry(
    async () => {
      const c = await cascadeOnce(url, timeout, optional);
      if(c.outcome === 'value')    return {ok:true, value:c.value, status:c.status};
      if(c.outcome === 'notfound') return {ok:true, value:null, status:'not-found'};
      return {ok:false, retryable:c.retryable, status:c.status};
    },
    { ...policy, endpoint: safeEndpoint(path) }
  );
  recordRetry(record);

  if(result && result.ok) return result.value;
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
  const { result, record } = await withRetry(
    async () => {
      let sawRetryable = false, lastStatus = null;
      for(const wrap of RELAYS){
        let res;
        try{ res = await fetchT(wrap(url), timeout); }
        catch(e){ sawRetryable = true; lastStatus = 'network'; continue; }

        if(!res.ok){
          lastStatus = res.status;
          if(isRetryableStatus(res.status)) sawRetryable = true;
          continue;
        }
        try{ return {ok:true, value: asText ? await res.text() : await res.json(), status:res.status}; }
        catch(e){ lastStatus = 'parse'; continue; }
      }
      return {ok:false, retryable:sawRetryable, status:lastStatus};
    },
    { ...policyFor('understat'), endpoint: safeEndpoint(url) }
  );
  recordRetry(record);
  return result && result.ok ? result.value : null;
}

export { BASE, RELAYS, fetchT, api, pool, fetchVia, cascadeOnce };
