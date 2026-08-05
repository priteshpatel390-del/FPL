const UPSTREAM_BASE = 'https://fantasy.premierleague.com/api';
const DEFAULT_ALLOWED_ORIGINS = Object.freeze(['https://priteshpatel390-del.github.io']);
const UPSTREAM_TIMEOUT_MS = 10000;

function positiveInteger(value, maximum){
  if(typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number <= maximum ? number : null;
}

function hasOnlyQuery(searchParams, allowed){
  const keys = [...searchParams.keys()];
  return keys.every(key => allowed.includes(key)) &&
    allowed.every(key => searchParams.getAll(key).length <= 1);
}

function matchApprovedRoute(url){
  const path = url.pathname;
  const query = url.searchParams;
  if(path === '/fpl/bootstrap-static/' && ![...query.keys()].length)
    return {upstreamPath:'/bootstrap-static/', cacheable:true};
  if(path === '/fpl/fixtures/'){
    if(!hasOnlyQuery(query,['event'])) return null;
    const event = query.has('event') ? positiveInteger(query.get('event'),38) : null;
    if(query.has('event') && !event) return null;
    return {upstreamPath:'/fixtures/' + (event ? `?event=${event}` : ''), cacheable:!event};
  }
  let match = /^\/fpl\/entry\/([1-9]\d*)\/$/.exec(path);
  if(match && ![...query.keys()].length)
    return {upstreamPath:`/entry/${match[1]}/`, cacheable:false};
  match = /^\/fpl\/entry\/([1-9]\d*)\/event\/([1-9]\d*)\/picks\/$/.exec(path);
  if(match && positiveInteger(match[2],38) && ![...query.keys()].length)
    return {upstreamPath:`/entry/${match[1]}/event/${match[2]}/picks/`, cacheable:false};
  match = /^\/fpl\/entry\/([1-9]\d*)\/history\/$/.exec(path);
  if(match && ![...query.keys()].length)
    return {upstreamPath:`/entry/${match[1]}/history/`, cacheable:false};
  match = /^\/fpl\/leagues-classic\/([1-9]\d*)\/standings\/$/.exec(path);
  if(match){
    if(!hasOnlyQuery(query,['page_standings'])) return null;
    const page = query.has('page_standings') ? positiveInteger(query.get('page_standings'),10000) : null;
    if(query.has('page_standings') && !page) return null;
    return {upstreamPath:`/leagues-classic/${match[1]}/standings/` + (page ? `?page_standings=${page}` : ''), cacheable:false};
  }
  match = /^\/fpl\/element-summary\/([1-9]\d*)\/$/.exec(path);
  if(match && ![...query.keys()].length)
    return {upstreamPath:`/element-summary/${match[1]}/`, cacheable:false};
  match = /^\/fpl\/event\/([1-9]\d*)\/live\/$/.exec(path);
  if(match && positiveInteger(match[1],38) && ![...query.keys()].length)
    return {upstreamPath:`/event/${match[1]}/live/`, cacheable:false};
  return null;
}

function allowedOrigins(env = {}){
  const values = new Set(DEFAULT_ALLOWED_ORIGINS);
  for(const origin of String(env.ALLOWED_ORIGINS || '').split(',')){
    const value = origin.trim();
    if(!value) continue;
    try{
      const parsed = new URL(value);
      if(parsed.origin === value && ['https:','http:'].includes(parsed.protocol)) values.add(value);
    }catch(error){}
  }
  return values;
}

function corsHeaders(origin){
  const headers = new Headers({
    'Vary':'Origin',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer'
  });
  if(origin){
    headers.set('Access-Control-Allow-Origin',origin);
    headers.set('Access-Control-Expose-Headers','Cache-Control, ETag, Last-Modified');
  }
  return headers;
}

function jsonError(code, status, origin){
  const headers = corsHeaders(origin);
  headers.set('Content-Type','application/json; charset=utf-8');
  headers.set('Cache-Control','no-store');
  return new Response(JSON.stringify({error:code}),{status,headers});
}

function safeErrorDiagnostic(error){
  const clean = (value, limit) => String(value || '')
    .replace(/https?:\/\/\S+/gi,'[url]')
    .replace(/\d+/g,'[number]')
    .replace(/[\r\n\t]+/g,' ')
    .slice(0,limit);
  return {
    name:clean(error?.name || 'Error',40),
    code:clean(error?.cause?.code || error?.code || '',60),
    message:clean(error?.message || 'No message',180)
  };
}

async function handleFplGatewayRequest(request, env = {}, deps = {}){
  const fetchFn = deps.fetchFn || fetch;
  const logger = deps.logger || console;
  const setTimer = deps.setTimeoutFn || setTimeout;
  const clearTimer = deps.clearTimeoutFn || clearTimeout;
  const origin = request.headers.get('Origin');
  const allowed = allowedOrigins(env);
  if(origin && !allowed.has(origin)) return jsonError('origin_not_allowed',403,null);
  const corsOrigin = origin && allowed.has(origin) ? origin : null;

  if(request.method === 'OPTIONS'){
    if(!corsOrigin) return jsonError('origin_required',403,null);
    const requested = request.headers.get('Access-Control-Request-Method');
    if(requested && !['GET','HEAD'].includes(requested)) return jsonError('method_not_allowed',405,corsOrigin);
    const headers = corsHeaders(corsOrigin);
    headers.set('Access-Control-Allow-Methods','GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers','Accept');
    headers.set('Access-Control-Max-Age','86400');
    return new Response(null,{status:204,headers});
  }
  if(!['GET','HEAD'].includes(request.method)){
    const response = jsonError('method_not_allowed',405,corsOrigin);
    response.headers.set('Allow','GET, HEAD, OPTIONS');
    return response;
  }

  const url = new URL(request.url);
  const route = matchApprovedRoute(url);
  if(!route) return jsonError('route_not_allowed',404,corsOrigin);

  const controller = new AbortController();
  const timer = setTimer(() => controller.abort(), Number(env.UPSTREAM_TIMEOUT_MS) || UPSTREAM_TIMEOUT_MS);
  let upstream;
  try{
    const options = {
      method:request.method,
      redirect:'manual',
      signal:controller.signal,
      headers:{'Accept':'application/json'}
    };
    if(route.cacheable) options.cf = {cacheEverything:true,cacheTtl:300};
    upstream = await fetchFn(UPSTREAM_BASE + route.upstreamPath, options);
  }catch(error){
    logger.error?.('Official FPL upstream fetch failed',safeErrorDiagnostic(error));
    return jsonError(error?.name === 'AbortError' ? 'upstream_timeout' : 'upstream_unreachable',
      error?.name === 'AbortError' ? 504 : 502,corsOrigin);
  }finally{
    clearTimer(timer);
  }

  if(upstream.status >= 300 && upstream.status < 400)
    return jsonError('upstream_redirect',502,corsOrigin);
  if(!upstream.ok) return jsonError('upstream_unavailable',upstream.status,corsOrigin);
  const contentType = upstream.headers.get('Content-Type') || '';
  if(request.method !== 'HEAD' && !/\bapplication\/json\b/i.test(contentType))
    return jsonError('upstream_not_json',502,corsOrigin);

  let body = null;
  if(request.method !== 'HEAD'){
    body = await upstream.text();
    try{ JSON.parse(body); }
    catch(error){ return jsonError('upstream_invalid_json',502,corsOrigin); }
  }
  const headers = corsHeaders(corsOrigin);
  headers.set('Content-Type','application/json; charset=utf-8');
  headers.set('Cache-Control',route.cacheable ? 'public, max-age=60, s-maxage=300' : 'no-store');
  for(const name of ['ETag','Last-Modified']){
    const value = upstream.headers.get(name);
    if(value) headers.set(name,value);
  }
  return new Response(body,{status:upstream.status,headers});
}

export {
  UPSTREAM_BASE, DEFAULT_ALLOWED_ORIGINS, UPSTREAM_TIMEOUT_MS,
  positiveInteger, hasOnlyQuery, matchApprovedRoute, allowedOrigins,
  safeErrorDiagnostic, handleFplGatewayRequest
};

export default { fetch: handleFplGatewayRequest };