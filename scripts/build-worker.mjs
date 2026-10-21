import fs from "node:fs";
import path from "node:path";
const root=path.resolve(import.meta.dirname,".."),dist=path.join(root,"dist");
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".webmanifest":"application/manifest+json; charset=utf-8",".png":"image/png"};
const assets={},media={};
function visit(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(["server",".openai"].includes(entry.name))continue;
    const filename=path.join(dir,entry.name);
    if(entry.isDirectory()){visit(filename);continue}
    const relative=path.relative(dist,filename).replaceAll("\\","/"),url="/"+relative;
    if(relative.startsWith("media/")){media[url]="https://raw.githubusercontent.com/furuta-ideas/TrainingRecorder/6bc773f6ee3188bcf5c3ce7ba1963c9d8dbbc478/dist/"+relative;continue}
    assets[url]={type:types[path.extname(filename)]||"application/octet-stream",body:fs.readFileSync(filename).toString("base64")};
  }
}
visit(dist);
const stripImports=source=>source.replace(/^import .*;\r?\n/gm,"");
const worker=stripImports(fs.readFileSync(path.join(root,"server/worker.js"),"utf8"));
const source=[worker,"export default createWorker("+JSON.stringify(assets)+","+JSON.stringify(media)+");"].join("\n");
fs.mkdirSync(path.join(dist,"server"),{recursive:true});fs.mkdirSync(path.join(dist,".openai"),{recursive:true});
fs.writeFileSync(path.join(dist,"server/index.js"),source);
fs.copyFileSync(path.join(root,".openai/hosting.json"),path.join(dist,".openai/hosting.json"));
console.log("Built training Worker: "+Object.keys(assets).length+" embedded assets, "+Object.keys(media).length+" media URLs");
