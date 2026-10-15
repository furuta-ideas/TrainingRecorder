import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../dist/server/index.js",import.meta.url),"utf8");
const {default:worker}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
assert.equal(typeof worker.fetch,"function");
const html=await worker.fetch(new Request("https://training.example/"),{});
assert.equal(html.status,200);assert.match(await html.text(),/id="endWorkout"/);
const icon=await worker.fetch(new Request("https://training.example/icons/training-recorder-180.png"),{});
assert.equal(icon.status,200);assert.equal(icon.headers.get("content-type"),"image/png");
const api=await worker.fetch(new Request("https://training.example/api/daily-report"),{});
assert.equal(api.status,405);
const originalFetch=globalThis.fetch;
try{
  globalThis.fetch=async(url,options)=>{
    assert.ok(url.startsWith("https://raw.githubusercontent.com/furuta-ideas/TrainingRecorder/"));
    assert.equal(options.headers.get("Range"),"bytes=0-1");
    assert.equal(options.headers.get("Authorization"),null);
    return new Response(null,{status:206,headers:{"Content-Type":"application/octet-stream","Content-Range":"bytes 0-1/100"}});
  };
  const media=await worker.fetch(new Request("https://training.example/media/02_Mobi_Thoracic_FR.mp4",{headers:{"Range":"bytes=0-1","Authorization":"not-forwarded"}}),{});
  assert.equal(media.status,206);assert.equal(media.headers.get("Content-Type"),"video/mp4");
}finally{globalThis.fetch=originalFetch}
console.log("PASS: standalone Worker, HTML, icon and mail API");
