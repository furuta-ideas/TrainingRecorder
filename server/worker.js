import {handleDailyMail} from "./mail.js";
// The build embeds HTML/JS/icons and injects a fixed allowlist for media.
export function createWorker(assets,media){
  return {async fetch(request,env){
    const url=new URL(request.url),pathname=url.pathname;
    if(pathname==="/api/daily-report")return handleDailyMail(request,env);
    if(!["GET","HEAD"].includes(request.method))return new Response("Method not allowed",{status:405});
    const asset=assets[pathname==="/" ? "/index.html" : pathname];
    if(asset){const bytes=Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0));return new Response(request.method==="HEAD"?null:bytes,{headers:{"Content-Type":asset.type,"Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"}})}
    if(media[pathname]){
      const headers=new Headers();if(request.headers.has("Range"))headers.set("Range",request.headers.get("Range"));
      try{
        const response=await fetch(media[pathname],{method:request.method,headers,signal:AbortSignal.timeout(30000)});
        const outgoing=new Headers();for(const name of ["content-type","content-length","content-range","accept-ranges","etag"])if(response.headers.has(name))outgoing.set(name,response.headers.get(name));
        outgoing.set("Cache-Control","public, max-age=86400");
        return new Response(response.body,{status:response.status,headers:outgoing});
      }catch{return new Response("Media temporarily unavailable",{status:502})}
    }
    return new Response("Not found",{status:404});
  }};
}
