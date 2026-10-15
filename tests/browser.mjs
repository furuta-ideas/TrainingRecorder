import {createRequire} from "node:module";
import assert from "node:assert/strict";
const require=createRequire(import.meta.url);
const {chromium}=require("C:/Users/kashi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const browser=await chromium.launch({channel:"msedge",headless:true});
try{
  const page=await browser.newPage({viewport:{width:1024,height:768}}),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.speechCalls={start:0,abort:0};
    window.SpeechRecognition=class{
      start(){window.speechCalls.start++;window.testRecognition=this}
      abort(){window.speechCalls.abort++}
    };
  });
  await page.goto("http://127.0.0.1:8781");
  await page.locator("#name").filter({hasText:"リラックス呼吸"}).waitFor();
  assert.equal(await page.locator("#menuSelect option").count(),15);
  assert.equal(await page.locator("#finish,#export,#manage,#date,#timerHint,#manager").count(),0);
  assert.equal(await page.locator(".appbar #prev,.appbar #next,.appbar #menuSelect").count(),0);
  await page.locator("#photos img").waitFor({state:"visible"});
  assert.ok(await page.locator("#photos img").evaluate(i=>i.complete&&i.naturalWidth>0));
  assert.equal(await page.locator("#mediaStage").evaluate(e=>getComputedStyle(e).backgroundColor),"rgb(255, 255, 255)");
  assert.equal(await page.locator("#video").isVisible(),false);
  assert.equal(await page.locator("#name").evaluate(e=>getComputedStyle(e).color),"rgb(0, 100, 181)");
  assert.match(await page.locator("#name").evaluate(e=>getComputedStyle(e).fontFamily),/Maru/);
  await page.locator("#clock").click();await page.locator("#memo").click();
  assert.equal(await page.locator("#startStop").getAttribute("aria-pressed"),"false");
  await page.locator("#startStop").click();await page.waitForTimeout(1100);
  assert.equal(await page.locator("#startStop").innerText(),"終了");
  assert.equal(await page.evaluate(()=>window.speechCalls.start),0);
  await page.locator("#micToggle").click();
  await page.evaluate(()=>{
    window.testRecognition.onresult({resultIndex:0,results:[Object.assign([{transcript:"腰を反らさない"}],{isFinal:true})]});
    window.staleResult=window.testRecognition.onresult;window.staleEnd=window.testRecognition.onend;window.staleStart=window.testRecognition.onstart;
  });
  await page.locator("#startStop").click();
  assert.equal(await page.locator("#startStop").innerText(),"開始");
  assert.equal(await page.locator("#startStop").getAttribute("aria-pressed"),"false");
  assert.equal(await page.locator("#micToggle").getAttribute("aria-pressed"),"false");
  assert.equal(await page.locator(".log-entry").count(),1);
  assert.match(await page.locator(".log-entry").innerText(),/腰を反らさない/);
  const stopped=await page.locator("#elapsed").innerText();
  await page.waitForTimeout(1100);assert.equal(await page.locator("#elapsed").innerText(),stopped);
  await page.evaluate(()=>{window.staleEnd();window.staleStart();window.staleResult({resultIndex:0,results:[Object.assign([{transcript:"古い音声"}],{isFinal:true})]})});
  assert.doesNotMatch(await page.locator("#memo").inputValue(),/古い/);
  await page.locator("#startStop").click();await page.waitForTimeout(1100);await page.locator("#startStop").click();
  assert.equal(await page.locator(".log-entry").count(),1,"repeated end must update same log");
  assert.ok((await page.locator("#elapsed").innerText())>stopped);
  await page.locator("#editMemo").click();await page.locator("#memo").fill("腰を反らさない。背中を意識する。");await page.locator("#editMemo").click();
  assert.match(await page.locator(".log-entry").innerText(),/背中/);
  await page.locator("#next").click();
  assert.equal(await page.locator("#elapsed").innerText(),"00:00");
  assert.equal(await page.locator(".log-entry").count(),1,"navigation after end must not duplicate");
  await page.locator("#video").waitFor({state:"visible"});await page.waitForFunction(()=>document.querySelector("#video").readyState>=2);
  assert.equal(await page.locator("#photos img").count(),0,"video menu must not render photos");
  assert.ok(await page.locator("#video").evaluate(v=>v.loop&&v.muted&&v.playsInline));
  await page.locator("#startStop").click();await page.locator("#micToggle").click();
  await page.evaluate(()=>window.testRecognition.onerror({error:"not-allowed"}));
  assert.equal(await page.locator("#micToggle").getAttribute("aria-pressed"),"false");
  assert.equal(await page.locator("#startStop").getAttribute("aria-pressed"),"true","microphone failure must not stop training");
  await page.locator("#micToggle").click();
  await page.evaluate(()=>{window.testRecognition.onresult({resultIndex:0,results:[Object.assign([{transcript:"移動前のメモ"}],{isFinal:false})]});window.oldResult=window.testRecognition.onresult;window.oldEnd=window.testRecognition.onend;window.startsBeforeMove=window.speechCalls.start});
  await page.waitForTimeout(1100);await page.locator("#next").click();
  assert.equal(await page.locator(".log-entry").count(),2);assert.match(await page.locator(".log-entry").first().innerText(),/移動前/);
  assert.equal(await page.locator("#elapsed").innerText(),"00:00");assert.equal(await page.locator("#memo").inputValue(),"");
  assert.equal(await page.locator("#micToggle").getAttribute("aria-pressed"),"false");
  await page.evaluate(()=>{window.oldEnd();window.oldResult({resultIndex:0,results:[Object.assign([{transcript:"前の種目の遅延音声"}],{isFinal:true})]})});
  assert.ok(await page.evaluate(()=>window.speechCalls.start===window.startsBeforeMove));
  assert.equal(await page.locator("#memo").inputValue(),"");
  await page.selectOption("#menuSelect",{label:"片膝立ちから全身ストレッチ"});
  await page.waitForFunction(()=>document.querySelector("#video").readyState>=2);
  for(const viewport of [{width:1024,height:768},{width:1194,height:834},{width:768,height:1024},{width:1180,height:700},{width:1024,height:600}]){
    await page.setViewportSize(viewport);
    const bounds=await page.evaluate(()=>Object.fromEntries(["memo","prev","next","menuSelect","startStop","clock","elapsed"].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id,{top:r.top,bottom:r.bottom,left:r.left,right:r.right}]})));
    for(const [id,r] of Object.entries(bounds))assert.ok(r.bottom<=viewport.height&&r.top>=0,id+" outside "+JSON.stringify(viewport));
    assert.ok(bounds.startStop.bottom<=bounds.clock.top);assert.ok(bounds.clock.bottom<=bounds.elapsed.top);
    assert.ok(bounds.startStop.right>viewport.width*.75);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),true);
    assert.ok(await page.locator("#micToggle").evaluate(e=>e.getBoundingClientRect().width>=48));
    assert.ok(await page.locator("#editMemo").evaluate(e=>e.getBoundingClientRect().width>=48));
  }
  await page.setViewportSize({width:1024,height:768});await page.screenshot({path:"qa-training-video.png",fullPage:true});
  await page.selectOption("#menuSelect",{label:"リラックス呼吸"});
  await page.locator("#photos img").waitFor({state:"visible"});await page.screenshot({path:"qa-training-photo.png",fullPage:true});
  assert.equal(await page.locator("#elapsed").innerText(),"00:00","returning to menu starts a new visit");
  await page.reload();await page.locator("#name").filter({hasText:"リラックス呼吸"}).waitFor();
  assert.equal(await page.locator(".log-entry").count(),2);assert.equal(await page.locator("#startStop").getAttribute("aria-pressed"),"false");
  for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)}
  await page.screenshot({path:"qa-training-iphone.png",fullPage:true});
  assert.deepEqual(errors,[]);console.log("PASS: video-only media, full-size white photo area, explicit mic/edit controls, automatic logs, cumulative timer, reset on navigation, stale speech protection, persistence and iPad/iPhone layout");
}finally{await browser.close()}
