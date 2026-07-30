const STAGE10_DOWNLOAD_REVOKE_DELAY_MS=30*1000;
function requestStage10Download(filename,text,type,{documentImpl=globalThis.document,urlImpl=globalThis.URL,BlobImpl=globalThis.Blob,setTimeoutImpl=globalThis.setTimeout}={}){
  if(!documentImpl?.createElement||!documentImpl?.body||!urlImpl?.createObjectURL||typeof BlobImpl!=='function') throw new Error('Browser download support is unavailable');
  const blob=new BlobImpl([String(text)],{type:String(type||'application/octet-stream')}),url=urlImpl.createObjectURL(blob),anchor=documentImpl.createElement('a');
  anchor.href=url;anchor.download=String(filename);anchor.rel='noopener';documentImpl.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeoutImpl(()=>urlImpl.revokeObjectURL(url),STAGE10_DOWNLOAD_REVOKE_DELAY_MS);
  return {filename:String(filename),requested:true,bytes:typeof TextEncoder!=='undefined'?new TextEncoder().encode(String(text)).length:String(text).length*2};
}
function stage10DownloadRequestedMessage(filename){return `Download requested — confirm ${String(filename)} appears in Files or Downloads.`;}
export {STAGE10_DOWNLOAD_REVOKE_DELAY_MS,requestStage10Download,stage10DownloadRequestedMessage};
