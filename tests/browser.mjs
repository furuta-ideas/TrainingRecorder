import {createRequire} from "node:module";
import assert from "node:assert/strict";
const require=createRequire(import.meta.url);
const {chromium}=require("C:/Users/kashi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const browser=await chromium.launch({channel:"msedge",headless:true});
try{
  const page=await browser.newPage({viewport:{width:1194,height:834}});
  await page.addInitScript(()=>{
    window.speechCalls={start:0,abort:0};
    window.SpeechRecognition=class{
      start(){window.speechCalls.start++;window.testRecognition=this}
      abort(){window.speechCalls.abort++}
    };
  });
  await page.route("**/menus.json",async route=>{
    const response=await route.fetch();const data=await response.json();
    data.menus[0].images.push({...data.menus[0].images[0]});
    await route.fulfill({response,json:data});
  });
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:8781");await page.locator("#name").filter({hasText:"リラックス呼吸"}).waitFor();
  assert.equal(await page.locator("#menuSelect option").count(),15);
  assert.equal(await page.locator("#micOn,#micOff,#photoDialog").count(),0);
  assert.equal(await page.locator("#photos img").count(),2);
  assert.ok(await page.locator("#photos img").first().evaluate(i=>i.complete&&i.naturalWidth>0));
  const photos=await page.locator("#photos img").evaluateAll(imgs=>imgs.map(i=>({top:i.getBoundingClientRect().top,bottom:i.getBoundingClientRect().bottom})));
  assert.ok(photos[1].top>=photos[0].bottom);
  assert.equal(await page.locator("#name").evaluate(e=>getComputedStyle(e).color),"rgb(17, 17, 17)");
  assert.ok(await page.locator("#name").evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>24));
  assert.ok(await page.locator(".instructions").evaluate(e=>parseFloat(getComputedStyle(e).lineHeight)<25));
  await page.locator("#clock").click();await page.waitForTimeout(1100);
  assert.ok(await page.locator("#clock").evaluate(e=>e.classList.contains("running")));
  assert.equal(await page.evaluate(()=>window.speechCalls.start),1);
  await page.evaluate(()=>window.testRecognition.onresult({resultIndex:0,results:[Object.assign([{transcript:"腰を反らさない"}],{isFinal:true})]}));
  assert.match(await page.locator("#memo").inputValue(),/腰/);
  await page.evaluate(()=>{window.staleResult=window.testRecognition.onresult;window.staleEnd=window.testRecognition.onend;window.staleStart=window.testRecognition.onstart});
  await page.locator("#memo").click();
  assert.ok(await page.locator("#clock").evaluate(e=>e.classList.contains("paused")));
  assert.equal(await page.evaluate(()=>window.speechCalls.abort),1);
  const stoppedMemo=await page.locator("#memo").inputValue();
  await page.evaluate(()=>window.staleResult({resultIndex:0,results:[Object.assign([{transcript:"停止後の古い結果"}],{isFinal:true})]}));
  assert.equal(await page.locator("#memo").inputValue(),stoppedMemo);
  const duration=await page.locator("#elapsed").innerText();await page.waitForTimeout(1100);assert.equal(await page.locator("#elapsed").innerText(),duration);
  await page.locator("#memo").click();await page.waitForTimeout(1100);await page.locator("#clock").click();
  await page.locator("#editMemo").click();await page.locator("#memo").fill("腰を反らさない。背中を意識する。");await page.locator("#editMemo").click();await page.locator("#next").click();
  assert.equal(await page.locator(".log-entry").count(),1);assert.match(await page.locator(".log-duration").innerText(),/00:02/);
  await page.locator("#video").waitFor({state:"visible"});await page.waitForFunction(()=>document.querySelector("#video").readyState>=2);
  assert.equal(await page.locator("#video").evaluate(v=>v.loop&&v.muted&&v.playsInline),true);
  await page.reload();await page.locator("#name").filter({hasText:"ポールで胸椎を動かす"}).waitFor();assert.equal(await page.locator(".log-entry").count(),1);
  await page.locator("#memo").click();
  await page.evaluate(()=>window.testRecognition.onerror({error:"not-allowed"}));
  assert.ok(await page.locator("#clock").evaluate(e=>e.classList.contains("paused")));
  assert.match(await page.locator("#notice").innerText(),/許可/);
  await page.locator("#clock").click();
  await page.evaluate(()=>{window.testRecognition.onresult({resultIndex:0,results:[Object.assign([{transcript:"移動前の音声メモ"}],{isFinal:true})]});window.priorRecognition=window.testRecognition;window.priorEnd=window.testRecognition.onend;window.priorResult=window.testRecognition.onresult;window.priorStart=window.testRecognition.onstart;window.startsBeforeMove=window.speechCalls.start});
  await page.waitForTimeout(1100);await page.locator("#next").click();
  assert.ok(await page.locator("#clock").evaluate(e=>e.classList.contains("idle")));
  assert.equal(await page.locator(".log-entry").count(),2);
  assert.match(await page.locator(".log-entry").first().innerText(),/移動前の音声メモ/);
  assert.match(await page.locator(".log-entry").first().innerText(),/00:01/);
  assert.equal(await page.locator("#memo").inputValue(),"");
  assert.match(await page.locator("#micStatus").innerText(),/音声OFF/);
  const abortBefore=await page.evaluate(()=>window.speechCalls.abort);
  await page.evaluate(()=>{window.priorEnd();window.priorStart();window.priorResult({resultIndex:0,results:[Object.assign([{transcript:"前の種目から遅れて届いた音声"}],{isFinal:true})]})});
  assert.equal(await page.evaluate(()=>window.speechCalls.start===window.startsBeforeMove),true);
  assert.ok(await page.evaluate(()=>window.speechCalls.abort)>abortBefore);
  assert.equal(await page.locator("#memo").inputValue(),"");
  await page.waitForTimeout(1100);assert.equal(await page.locator("#elapsed").innerText(),"00:00");
  await page.locator("#prev").click();
  await page.locator("#prev").click();assert.match(await page.locator("#learning").innerText(),/背中/);
  await page.locator("#memo").click();
  await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"))});
  assert.ok(await page.locator("#clock").evaluate(e=>e.classList.contains("paused")));
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event("visibilitychange"))});
  await page.screenshot({path:"qa-ipad.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:"qa-iphone.png",fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  for(const width of [320,768,1024]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,"horizontal overflow at "+width)}
  await page.locator("#manage").click();await page.locator('[name=name]').fill("追加テスト");await page.locator('[name=prescription]').fill("1セット × 2回");await page.locator('[name=durationNote]').fill("30秒");await page.locator('[name=tips]').fill("背中を意識する");await page.locator('[type=submit]').click();
  await page.locator("#name").filter({hasText:"追加テスト"}).waitFor();assert.equal(await page.locator("#menuSelect option").count(),16);
  await page.reload();await page.locator("#name").filter({hasText:"追加テスト"}).waitFor();assert.equal(await page.locator("#menuSelect option").count(),16);
  assert.deepEqual(errors,[]);console.log("PASS: integrated voice/timer, permission rejection, menu transition, cumulative timing, logs, persistence, stacked photos, title/spacing, responsive layout, custom menu");
}finally{await browser.close()}
