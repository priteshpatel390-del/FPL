import { S, recordRetry } from '../state.mjs';
import { policyFor, withRetry, isRetryableStatus, safeEndpoint } from './retry.mjs';
/* ---------------------------------------------------------------------
   Official FPL transport.

   Browser requests use the owner-controlled Teamsheet gateway declared
   in the document meta tag. The gateway is a narrow read-only transport
   to fantasy.premierleague.com; it is not another football-data provider.
   Anonymous public relays remain available only to the optional Understat
   HTML loader and are never part of the Official FPL request path.
   --------------------------------------------------------------------- */
const BASE = 'https://fantasy.premierleague.com/api';
const FPL_GATEWAY_META = 'teamsheet-fpl-gateway';
const RELAYS = [
  u => u,
  u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
  u => 'https://corsproxy.io/?' + encodeURIComponent(u),
  u => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u),
  u => 'https://thingproxy.freeboard.io/fetch/' + u
];

async function fetchT(url, ms, options = {}){
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try{ return await fetch(url, {...options, signal:c.signal}); }
  finally{ clearTimeout(t); }
}

function normaliseGatewayBase(value){
  if(typeof value !== 'string' || !value.trim()) return null;
  try{
    const u = new URL(value.trim());
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if(u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return null;
    if(u.username || u.password || u.search || u.hash) return null;
    if(!/^\/fpl\/?$/.test(u.pathname)) return null;
    return u.origin + '/fpl';
  }catch(error){ return null; }
}

function configuredGatewayBase(documentRef = globalThis.document){
  const injected = normaliseGatewayBase(globalThis.__TEAMSHEET_FPL_GATEWAY_BASE__);
  if(injected) return injected;
  const meta = documentRef?.querySelector?.(`meta[name="${FPL_GATEWAY_META}"]`);
  return normaliseGatewayBase(meta?.content || '');
}

function gatewayRequestUrl(path, gatewayBase = configuredGatewayBase()){
  const base = normaliseGatewayBase(gatewayBase);
  if(!base || typeof path !== 'string' || !path.startsWith('/') ||
     path.includes('://') || path.includes('..') || path.includes('\\')) return null;
  return base + path;
}

async function gatewayOnce(path, timeout, optional, gatewayBase){
  const url = gatewayRequestUrl(path, gatewayBase);
  if(!url) return {outcome:'failed', retryable:false, status:'gateway-unconfigured'};
  let res;
  try{
    res = await fetchT(url, timeout, {
      method:'GET',
      credentials:'omit',
      redirect:'error',
      referrerPolicy:'no-referrer',
      headers:{'Accept':'application/json'}
    });
  }catch(error){
    return {outcome:'failed', retryable:true, status:'network'};
  }
  if(!res.ok){
    if(optional && res.status === 404) return {outcome:'notfound', status:'not-found'};
    return {outcome:'failed', retryable:isRetryableStatus(res.status), status:res.status};
  }
  let data;
  try{ data = await res.json(); }
  catch(error){ return {outcome:'failed', retryable:false, status:'parse'}; }
  if(data && data.detail){
    if(optional) return {outcome:'notfound', status:'not-found'};
    return {outcome:'failed', retryable:false, status:'detail'};
  }
  S.source = 'Teamsheet gateway';
  return {outcome:'value', value:data, status:res.status};
}

async function api(path, {optional=false, timeout=8000, gatewayBase} = {}){
  const policy = policyFor('fpl');
  if(optional) policy.attempts = Math.min(policy.attempts, 2);
  const { result, record } = await withRetry(
    async () => {
      const response = await gatewayOnce(path, timeout, optional, gatewayBase);
      if(response.outcome === 'value') return {ok:true, value:response.value, status:response.status};
      if(response.outcome === 'notfound') return {ok:true, value:null, status:'not-found'};
      return {ok:false, retryable:response.retryable, status:response.status};
    },
    {...policy, endpoint:safeEndpoint(path)}
  );
  recordRetry(record);
  if(result && result.ok) return result.value;
  if(optional) return null;
  throw new Error('feed unreachable: ' + path);
}

// limited-concurrency map, so rival and player-history lookups stay bounded
async function pool(items, worker, size=4){
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({length:Math.min(size, items.length)}, async () => {
    while(i < items.length){
      const idx = i++;
      try{ out[idx] = await worker(items[idx]); }catch(error){ out[idx] = null; }
    }
  }));
  return out;
}

// Generic relay cascade retained only for optional non-FPL sources.
async function cascadeOnce(url, timeout, {asText=false} = {}){
  let sawRetryable = false, lastStatus = null;
  for(const wrap of RELAYS){
    let res;
    try{ res = await fetchT(wrap(url), timeout, {headers:{'Accept':asText?'text/html':'application/json'}}); }
    catch(error){ sawRetryable = true; lastStatus = 'network'; continue; }
    if(!res.ok){
      lastStatus = res.status;
      if(isRetryableStatus(res.status)) sawRetryable = true;
      continue;
    }
    try{
      return {outcome:'value', value:asText ? await res.text() : await res.json(), status:res.status};
    }catch(error){ lastStatus = 'parse'; }
  }
  return {outcome:'failed', retryable:sawRetryable, status:lastStatus};
}

async function fetchVia(url, {timeout=12000, asText=false} = {}){
  const { result, record } = await withRetry(
    async () => {
      const response = await cascadeOnce(url, timeout, {asText});
      if(response.outcome === 'value') return {ok:true, value:response.value, status:response.status};
      return {ok:false, retryable:response.retryable, status:response.status};
    },
    {...policyFor('understat'), endpoint:safeEndpoint(url)}
  );
  recordRetry(record);
  return result && result.ok ? result.value : null;
}

export {
  BASE, FPL_GATEWAY_META, RELAYS, fetchT, normaliseGatewayBase,
  configuredGatewayBase, gatewayRequestUrl, gatewayOnce, api, pool,
  fetchVia, cascadeOnce
};
