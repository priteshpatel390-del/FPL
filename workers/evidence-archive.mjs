export * from './evidence-archive-core.mjs';
import { handleEvidenceArchiveRequest, verifyAccessJwt, allowedOrigins } from './evidence-archive-core.mjs';

function cloudflareAccessFetch(fetchFn=globalThis.fetch){
  return (input,init={})=>fetchFn(input,{...init,redirect:init.redirect==='error'?'manual':init.redirect});
}

async function cloudflareAuthVerifier(request,env,deps={}){
  const fetchFn=cloudflareAccessFetch(deps.fetchFn||globalThis.fetch);
  return verifyAccessJwt(request.headers.get('Cf-Access-Jwt-Assertion'),env,{...deps,fetchFn});
}

/* GW1-P2D-P3 — credentialled browser CORS must explicitly permit credentials.
   The core has already enforced the exact origin allowlist before any response
   reaches this adapter. Keep the grant narrow: only mirror the permission when
   the core response itself grants that exact approved origin. */
function credentialledCorsResponse(response,request,env={}){
  const origin=request.headers.get('Origin');
  if(!origin||!allowedOrigins(env).has(origin)) return response;
  if(response.headers.get('Access-Control-Allow-Origin')!==origin) return response;
  const headers=new Headers(response.headers);
  headers.set('Access-Control-Allow-Credentials','true');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

async function fetch(request,env,ctx){
  const response=await handleEvidenceArchiveRequest(request,env,{logger:console,authVerifier:cloudflareAuthVerifier});
  return credentialledCorsResponse(response,request,env);
}

export { cloudflareAccessFetch, cloudflareAuthVerifier, credentialledCorsResponse };
export default {fetch};
