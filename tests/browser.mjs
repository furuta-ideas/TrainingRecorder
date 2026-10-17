import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/kashi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1024,height:768}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.spoken=[];window.close=()=>{};
  Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},resume(){},getVoices(){return []},speak(u){if(u.text.trim())window.spoken.push(u.text)}}});
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
  if(!localStorage.getItem('rbody-records-v1'))localStorage.setItem('rbody-records-v1',JSON.stringify({logs:[{id:'legacy',menuId:'old',name:'以前の記録',memo:'以前の音声メモを残す',duration:10000,startedAt:Date.now(),endedAt:Date.now()}],sessions:{},learning:{}}));
 });
 await page.goto('http://127.0.0.1:8781');await page.locator('#name').filter({hasText:'リラックス呼吸'}).waitFor();
 assert.equal(await page.locator('#memo,#micToggle,#editMemo,.memo').count(),0);
 assert.equal(await page.locator('#menuSelect option').count(),15);
 assert.equal(await page.locator('#photos svg').count(),2);
 assert.match(await page.locator('.log-entry').innerText(),/以前の音声メモを残す/);
 const original=await page.locator('#tip').innerText();
 await page.locator('#instructions').dblclick();await page.locator('#noteDialog').waitFor({state:'visible'});
 await page.locator('#noteTip').fill('破棄する変更');await page.locator('#cancelNote').click();assert.equal(await page.locator('#tip').innerText(),original);
 await page.locator('#instructions').dblclick();await page.locator('#notePrescription').fill('1セット × 4回 ｜ 60秒');
 await page.locator('#noteTip').fill('自分のフォームのメモ');await page.locator('#noteLearning').fill('肋骨を前に出さない');await page.locator('#saveNote').click();
 assert.equal(await page.locator('#tip').innerText(),'自分のフォームのメモ');assert.equal(await page.locator('#learning').innerText(),'肋骨を前に出さない');
 assert.equal(await page.locator('.log-entry').count(),1,'editing guidance must not create an exercise log');
 await page.locator('#next').click();assert.notEqual(await page.locator('#tip').innerText(),'自分のフォームのメモ');
 await page.locator('#instructions').focus();await page.keyboard.press('Enter');await page.locator('#noteTip').fill('2番目だけのメモ');await page.locator('#saveNote').click();
 await page.locator('#prev').click();assert.equal(await page.locator('#tip').innerText(),'自分のフォームのメモ');
 await page.reload();await page.locator('#tip').filter({hasText:'自分のフォームのメモ'}).waitFor();
 await page.locator('#next').click();assert.equal(await page.locator('#tip').innerText(),'2番目だけのメモ');
 await page.locator('#video').waitFor({state:'visible'});assert.equal(await page.locator('#photos svg,#photos img').count(),0);
 await page.locator('#instructions').dblclick();await page.locator('#noteTip').fill('<script>危険なHTMLではなく文字として表示</script>');await page.locator('#saveNote').click();assert.match(await page.locator('#tip').innerText(),/<script>/);assert.equal(await page.locator('#tip script').count(),0);
 await page.locator('#instructions').dblclick();await page.locator('#noteTip').fill('保存に失敗する内容');
 await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('quota')}});await page.locator('#saveNote').click();
 assert.match(await page.locator('#noteError').innerText(),/保存できません/);assert.equal(await page.locator('#noteDialog').isVisible(),true);
 await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem});await page.locator('#cancelNote').click();assert.match(await page.locator('#tip').innerText(),/<script>/);
 await page.locator('#startStop').click();await page.waitForTimeout(1100);await page.locator('#startStop').click();assert.equal(await page.locator('.log-entry').count(),2);
 const elapsed=await page.locator('#elapsed').innerText();await page.waitForTimeout(1100);assert.equal(await page.locator('#elapsed').innerText(),elapsed);
 await page.locator('#startStop').click();await page.waitForTimeout(1100);await page.locator('#startStop').click();assert.ok((await page.locator('#elapsed').innerText())>elapsed);assert.equal(await page.locator('.log-entry').count(),2);
 await page.locator('#next').click();assert.equal(await page.locator('#elapsed').innerText(),'00:00');
 await page.locator('#countTen').click();await page.waitForFunction(()=>document.querySelector('#countTenLabel').textContent.includes('10秒完了'),{},{timeout:13000});
 assert.deepEqual(await page.evaluate(()=>window.spoken),['いち','に','さん','よん','ご','ろく','なな','はち','きゅう','じゅう']);
 await page.locator('#countTen').click();await page.locator('#next').click();assert.equal(await page.locator('#countTen').getAttribute('aria-pressed'),'false');
 await page.locator('#endWorkout').click();assert.match(await page.locator('#endTitle').innerText(),/メールで/);await page.locator('#sendAndClose').click();
 await page.waitForFunction(()=>document.querySelector('#endMessage').textContent.includes('未設定'));assert.equal(await page.locator('#endDialog').isVisible(),true);await page.locator('#cancelEnd').click();
 let requests=0;await page.route('**/api/daily-report',async route=>{requests++;await route.fulfill({status:200,json:{status:'accepted',messageId:'mock'}})});
 await page.locator('#endWorkout').click();await page.locator('#sendAndClose').click();await page.locator('#closedScreen').waitFor({state:'visible'});await page.locator('#returnApp').click();assert.equal(requests,1);
 for(const viewport of [{width:1024,height:768},{width:1194,height:834},{width:768,height:1024},{width:1180,height:700},{width:1024,height:600},{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:430,height:750},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.waitForFunction(()=>Math.abs(document.body.getBoundingClientRect().height-innerHeight)<1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth),true);
  for(const id of ['instructions','mediaStage','countTen','startStop','endWorkout','menuSelect']){const r=await page.locator('#'+id).boundingBox();assert.ok(r.y>=0&&r.y+r.height<=viewport.height,id+' outside '+JSON.stringify(viewport))}
 }
 await page.setViewportSize({width:390,height:844});await page.selectOption('#menuSelect',{label:'リラックス呼吸'});
 await page.locator('#instructions').dispatchEvent('pointerup',{pointerType:'touch'});await page.locator('#instructions').dispatchEvent('pointerup',{pointerType:'touch'});
 await page.locator('#noteDialog').waitFor({state:'visible'});await page.locator('#noteTip').fill('ダブルタップで保存');await page.locator('#saveNote').click();assert.equal(await page.locator('#tip').innerText(),'ダブルタップで保存');
 await page.screenshot({path:'qa-training-iphone.png',fullPage:true});
 await page.locator('#instructions').dblclick();await page.screenshot({path:'qa-training-note-editor.png',fullPage:true});await page.keyboard.press('Escape');assert.equal(await page.locator('#noteDialog').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS: per-menu editing, reload persistence, cancellation, legacy logs, quota failure, literal text, double tap, audio count, automatic time logs, mail dialog and iPhone/iPad layout');
}finally{await browser.close()}
