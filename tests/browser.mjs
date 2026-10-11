import {createRequire} from "node:module";
import assert from "node:assert/strict";
const require=createRequire(import.meta.url);
const {chromium}=require("C:/Users/kashi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const browser=await chromium.launch({channel:"msedge",headless:true});
try{
  const page=await browser.newPage({viewport:{width:1194,height:834}});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:8781");await page.locator("#name").filter({hasText:"リラックス呼吸"}).waitFor();
  assert.equal(await page.locator("#menuSelect option").count(),15);
  await page.locator("#clock").click();await page.waitForTimeout(1100);await page.locator("#clock").click();
  const duration=await page.locator("#elapsed").innerText();await page.waitForTimeout(1100);assert.equal(await page.locator("#elapsed").innerText(),duration);
  await page.locator("#clock").click();await page.waitForTimeout(1100);await page.locator("#clock").click();
  await page.locator("#memo").fill("腰を反らさない。背中を意識する。");await page.locator("#next").click();
  assert.equal(await page.locator(".log-entry").count(),1);assert.match(await page.locator(".log-duration").innerText(),/00:02/);
  await page.locator("#video").waitFor({state:"visible"});await page.waitForFunction(()=>document.querySelector("#video").readyState>=2);
  assert.equal(await page.locator("#video").evaluate(v=>v.loop&&v.muted&&v.playsInline),true);
  await page.reload();await page.locator("#name").filter({hasText:"ポールで胸椎を動かす"}).waitFor();assert.equal(await page.locator(".log-entry").count(),1);
  await page.locator("#prev").click();assert.match(await page.locator("#learning").innerText(),/背中/);
  await page.screenshot({path:"qa-ipad.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:"qa-iphone.png",fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  for(const width of [320,768,1024]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,"horizontal overflow at "+width)}
  await page.locator("#manage").click();await page.locator('[name=name]').fill("追加テスト");await page.locator('[name=prescription]').fill("1セット × 2回");await page.locator('[name=durationNote]').fill("30秒");await page.locator('[name=tips]').fill("背中を意識する");await page.locator('[type=submit]').click();
  await page.locator("#name").filter({hasText:"追加テスト"}).waitFor();assert.equal(await page.locator("#menuSelect option").count(),16);
  await page.reload();await page.locator("#name").filter({hasText:"追加テスト"}).waitFor();assert.equal(await page.locator("#menuSelect option").count(),16);
  assert.deepEqual(errors,[]);console.log("PASS: timer, pause/resume, log, persistence, video, summary, 390px layout, custom menu");
}finally{await browser.close()}
