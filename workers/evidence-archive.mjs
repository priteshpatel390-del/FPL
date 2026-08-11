export * from './evidence-archive-core.mjs';
import { handleEvidenceArchiveRequest, verifyAccessJwt } from './evidence-archive-core.mjs';

function cloudflareAccessFetch(fetchFn=globalThis.fetch){
  return (input,init={})=>fetchFn(input,{...init,redirect:init.redirect==='error'?'manual':init.redirect});
}

async function cloudflareAuthVerifier(request,env,deps={}){
  const fetchFn=cloudflareAccessFetch(deps.fetchFn||globalThis.fetch);
  return verifyAccessJwt(request.headers.get('Cf-Access-Jwt-Assertion'),env,{...deps,fetchFn});
}

async function fetch(request,env,ctx){
  return handleEvidenceArchiveRequest(request,env,{logger:console,authVerifier:cloudflareAuthVerifier});
}

export { cloudflareAccessFetch, cloudflareAuthVerifier };
export default {fetch};
