import http from "node:http";
import {createReadStream,statSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
const root=fileURLToPath(new URL("./dist/",import.meta.url));
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".webmanifest":"application/manifest+json; charset=utf-8",".png":"image/png",".mp4":"video/mp4"};
http.createServer((req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
    const filename=path.resolve(root,"."+pathname+(pathname.endsWith("/")?"index.html":""));
    if(!filename.startsWith(root)){res.writeHead(403).end();return}
    const {size}=statSync(filename),range=req.headers.range;
    const headers={"Content-Type":types[path.extname(filename)]||"application/octet-stream","Accept-Ranges":"bytes"};
    if(range){
      const match=/^bytes=(\d+)-(\d*)$/.exec(range);if(!match){res.writeHead(416,{"Content-Range":"bytes */"+size}).end();return}
      const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),size-1):size-1;
      if(start>end||start>=size){res.writeHead(416,{"Content-Range":"bytes */"+size}).end();return}
      res.writeHead(206,{...headers,"Content-Range":"bytes "+start+"-"+end+"/"+size,"Content-Length":end-start+1});createReadStream(filename,{start,end}).pipe(res);
    }else{res.writeHead(200,{...headers,"Content-Length":size});createReadStream(filename).pipe(res)}
  }catch{res.writeHead(404).end("Not found")}
}).listen(8781,"127.0.0.1",()=>console.log("Local: http://127.0.0.1:8781"));
