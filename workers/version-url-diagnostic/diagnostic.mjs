// Disposable Version URL diagnostic Worker. It has no bindings, no secrets and no
// outbound requests. Every request receives the same fixed signature response.
export const DIAGNOSTIC_SIGNATURE_BODY='teamsheet-version-url-diagnostic-ok';
export const DIAGNOSTIC_SIGNATURE_HEADER='x-teamsheet-version-url-diagnostic';

export async function fetch(){
  return new Response(DIAGNOSTIC_SIGNATURE_BODY,{status:200,headers:{
    'content-type':'text/plain; charset=utf-8',
    'cache-control':'no-store',
    [DIAGNOSTIC_SIGNATURE_HEADER]:'1'
  }});
}

export default {fetch};
