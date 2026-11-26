import {trainingConfig} from './training-config.js';
import {normalizePlan,slotAt,applyMenuOrder} from './training.js';

const $=id=>document.getElementById(id);
const STORAGE_KEY='rbody-semi-auto-v1';
let menus=[],baseMenus=[],index=0,running=false,started=false,startedAt=0,raf=0,renderToken=0,mediaUrls=[];
let state=loadState();

function loadState(){
 try{
  const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
  if(saved&&typeof saved==='object')return {order:Array.isArray(saved.order)?saved.order:[],edits:saved.edits&&typeof saved.edits==='object'?saved.edits:{},updatedAt:Number(saved.updatedAt)||0};
 }catch{}
 try{
  const legacy=JSON.parse(localStorage.getItem('rbody-records-v1')||'{}'),edits={};
  for(const [id,note] of Object.entries(legacy.menuNotes||{}))edits[id]={name:note.name,memo:[note.tip,note.learning].filter(Boolean).join('\n')};
  return {order:Array.isArray(legacy.menuOrder)?legacy.menuOrder:[],edits,updatedAt:0};
 }catch{return {order:[],edits:{},updatedAt:0}}
}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
// ユーザーの変更（メモ・種目名・並び順）を保存し、共有中なら他の端末へ送る
function commit(){state.updatedAt=Date.now();persist();schedulePush()}
function current(){return menus[index]}
function format(ms){const sec=Math.max(0,Math.floor(ms/1000));return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}
function viewport(){document.documentElement.style.setProperty('--app-height',Math.floor(window.visualViewport?.height||innerHeight)+'px')}
viewport();addEventListener('resize',viewport);window.visualViewport?.addEventListener('resize',viewport);

setTimeout(()=>{
 $('openingScreen').hidden=true;document.body.classList.remove('opening');$('app').inert=false;
},3000);
setInterval(()=>{$('wallClock').textContent=new Date().toLocaleTimeString('ja-JP',{hour12:false})},1000);

async function initialize(){
 baseMenus=(await fetch('menus.json').then(r=>r.json())).menus;
 menus=buildMenus();state.order=menus.map(m=>m.id);persist();renderMenu();await renderCurrent();
 pullRemote();
}
function buildMenus(){
 const enriched=baseMenus.map((menu,i)=>{
  const edit=state.edits[menu.id]||{},config=trainingConfig[i];
  return {...menu,...config,id:menu.id,name:edit.name||config.name,memo:edit.memo||config.memo,originalIndex:i};
 });
 return applyMenuOrder(enriched,state.order);
}
function renderHeader(){const menu=current();if(!menu)return;$('name').textContent=menu.name;$('position').textContent=(index+1)+' / '+menus.length;$('memo').textContent=menu.memo}

function renderMenu(){
 $('menuList').replaceChildren();
 menus.forEach((menu,i)=>{
  const li=document.createElement('li'),button=document.createElement('button');
  button.type='button';button.textContent=(i+1)+'. '+menu.name;button.className=i===index?'selected':'';
  button.onclick=()=>selectMenu(i);li.append(button);$('menuList').append(li);
 });
}
async function selectMenu(next){
 if(next<0||next>=menus.length)return;
 index=next;startedAt=performance.now();renderMenu();await renderCurrent();
 if(started&&!running){running=true;startedAt=performance.now();loop()}
}
async function renderCurrent(){
 const token=++renderToken,menu=current();if(!menu)return;
 renderHeader();
 renderTimeline(0);await renderMedia(menu,token);
}
async function assetUrl(asset){return asset?.src||null}
async function renderMedia(menu,token){
 $('video').pause();$('video').removeAttribute('src');$('video').load();mediaUrls.forEach(URL.revokeObjectURL);mediaUrls=[];
 $('video').hidden=true;$('photos').hidden=true;$('photos').replaceChildren();$('photos').classList.remove('split');$('mediaEmpty').hidden=true;
 $('mediaStage').classList.toggle('has-video',Boolean(menu.video));$('mediaStage').classList.toggle('has-photos',!menu.video);
 if(menu.video){
  $('mediaLabel').textContent='MOVIE';$('video').src=await assetUrl(menu.video);if(token!==renderToken)return;$('video').hidden=false;$('video').play().catch(()=>{});return;
 }
 $('mediaLabel').textContent='PHOTO';$('photos').hidden=false;
 for(const [assetIndex,asset] of menu.images.entries()){
  const src=await assetUrl(asset);if(token!==renderToken)return;
  if(asset.frames?.length){
   $('photos').classList.add('split');
   asset.frames.forEach((frame,frameIndex)=>{
    // figure=グリッドのセル、crop=写真本来の縦横比を保つ切り抜き枠（引き伸ばし防止）
    const cell=document.createElement('figure'),crop=document.createElement('div'),image=new Image();cell.className='photo-frame';cell.setAttribute('role','img');cell.setAttribute('aria-label',menu.name+' 写真 '+(frameIndex+1));
    crop.className='photo-crop';crop.style.setProperty('--ratio',String(frame.width/frame.height));
    image.src=src;image.alt='';image.style.width=(asset.sourceWidth/frame.width*100)+'%';image.style.height=(asset.sourceHeight/frame.height*100)+'%';image.style.left=(-frame.x/frame.width*100)+'%';image.style.top=(-frame.y/frame.height*100)+'%';
    crop.append(image);cell.append(crop);$('photos').append(cell);
   });
  }else{const img=new Image();img.src=src;img.alt=menu.name+' 写真 '+(assetIndex+1);$('photos').append(img)}
 }
 $('mediaEmpty').hidden=$('photos').childElementCount>0;
}

function renderTimeline(elapsedMs){
 const plan=normalizePlan(current()),active=slotAt(elapsedMs);$('timeline').replaceChildren();
 plan.forEach((step,i)=>{
  const isStandby=step.bottom==='スタンバイ',cell=document.createElement('div');cell.className='timeline-cell '+(step.active?'active':'unused')+(isStandby?' standby':'');
  if(step.active&&i<active)cell.classList.add('done');if(step.active&&i===active)cell.classList.add('current');
  const top=document.createElement('b'),bottom=document.createElement('span');top.textContent=step.top||'';bottom.textContent=wrapCue(step.bottom||'');cell.append(top,bottom);$('timeline').append(cell);
 });
 const cue=plan[Math.min(active,plan.length-1)];$('currentCue').textContent=running&&cue?.active?[cue.top,cue.bottom].filter(Boolean).join('・'):'';
}
function wrapCue(text){return ({'スタンバイ':'スタン\nバイ','スクワット':'スクワ\nット','ブリッジ':'ブリッ\nジ','プランク':'プラン\nク','水平運動':'水平\n運動','垂直運動':'垂直\n運動'}[text]||text)}
function loop(now=performance.now()){
 cancelAnimationFrame(raf);if(!running)return;
 const elapsed=now-startedAt,duration=current().durationSeconds*1000;
 $('elapsed').textContent=format(elapsed);renderTimeline(elapsed);
 if(elapsed>=duration){advance();return}
 raf=requestAnimationFrame(loop);
}
async function advance(){
 running=false;cancelAnimationFrame(raf);
 if(index>=menus.length-1){finish(true);return}
 index++;startedAt=performance.now();renderMenu();await renderCurrent();running=true;loop();
}
function begin(){
 if(started)return;started=true;running=true;startedAt=performance.now();
 $('startWorkout').textContent='トレーニング実施中';$('startWorkout').disabled=true;$('statusText').textContent='実施中';loop();
}
function finish(completed=false){
 running=false;cancelAnimationFrame(raf);$('finishDialog').close();$('app').hidden=true;$('completeScreen').hidden=false;
 $('completeScreen').querySelector('p').textContent=completed?'15種目すべて完了しました。':'本日のトレーニングは終了です。';
}
$('startWorkout').onclick=begin;
$('endWorkout').onclick=()=>{$('finishTitle').textContent='トレーニングを終了しますか？';$('finishMessage').textContent='現在の進行を終了します。';$('finishDialog').showModal()};
$('cancelFinish').onclick=()=>$('finishDialog').close();$('confirmFinish').onclick=()=>finish(false);
$('restart').onclick=()=>location.reload();

function openEditor(){const menu=current();$('editName').value=menu.name;$('editMemo').value=menu.memo;$('editDialog').showModal();$('editName').focus()}
$('instructions').onclick=openEditor;
$('editForm').onsubmit=event=>{
 event.preventDefault();const menu=current(),name=$('editName').value.trim(),memo=$('editMemo').value.trim();if(!name||!memo)return;
 menu.name=name;menu.memo=memo;state.edits[menu.id]={name,memo};commit();$('editDialog').close();renderMenu();renderCurrent();
};
$('cancelEdit').onclick=()=>$('editDialog').close();

// 並べ替え：ドラッグ中の行（＝ポインターをキャプチャしたハンドルの親）はDOM上で動かさず、
// 周囲の行を前後へ移す。行自体を移動するとキャプチャが外れ、pointerupが届かず順番が確定しないため。
let drag=null,dragScroll=0;
function dragTo(y){
 if(!drag)return;const row=drag.row;drag.y=y;let other;
 while((other=row.previousElementSibling)){const r=other.getBoundingClientRect();if(y<r.top+r.height/2)row.after(other);else break}
 while((other=row.nextElementSibling)){const r=other.getBoundingClientRect();if(y>r.top+r.height/2)row.before(other);else break}
}
function startDrag(row,handle,e){
 if(drag||(e.pointerType==='mouse'&&e.button!==0))return;
 e.preventDefault();drag={row,handle,pointerId:e.pointerId,y:e.clientY};row.classList.add('dragging');
 try{handle.setPointerCapture(e.pointerId)}catch{}
 clearInterval(dragScroll);dragScroll=setInterval(()=>{
  if(!drag)return;const dialog=$('menuDialog'),rect=dialog.getBoundingClientRect(),edge=56;
  const step=drag.y<rect.top+edge?-10:drag.y>rect.bottom-edge?10:0;
  if(step){dialog.scrollTop+=step;dragTo(drag.y)}
 },16);
}
function endDrag(){
 if(!drag)return;const {row,handle,pointerId}=drag,currentId=current().id;drag=null;clearInterval(dragScroll);row.classList.remove('dragging');
 try{handle.releasePointerCapture(pointerId)}catch{}
 const ids=[...$('menuRows').children].map(el=>el.dataset.id);menus=ids.map(id=>menus.find(m=>m.id===id));index=menus.findIndex(m=>m.id===currentId);
 state.order=ids;commit();fillDialog();renderMenu();renderHeader();
}
function fillDialog(){
 $('menuRows').replaceChildren();
 menus.forEach((menu,i)=>{
  const row=document.createElement('div'),choose=document.createElement('button'),handle=document.createElement('button');
  row.className='menu-row'+(i===index?' selected':'');row.dataset.id=menu.id;
  choose.type='button';choose.className='menu-choice';choose.textContent=(i+1)+'. '+menu.name;choose.onclick=()=>{$('menuDialog').close();selectMenu(menus.findIndex(m=>m.id===menu.id))};
  handle.type='button';handle.className='drag-handle';handle.setAttribute('aria-label',menu.name+'を並べ替え');handle.textContent='⠿';
  handle.onpointerdown=e=>startDrag(row,handle,e);
  handle.onpointermove=e=>{if(!drag||drag.pointerId!==e.pointerId)return;e.preventDefault();dragTo(e.clientY)};
  handle.onpointerup=handle.onpointercancel=handle.onlostpointercapture=e=>{if(drag&&drag.pointerId===e.pointerId)endDrag()};
  // iOS Safariでハンドル上のタッチがスクロールや長押しメニューに奪われないようにする
  handle.addEventListener('touchstart',e=>e.preventDefault(),{passive:false});handle.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
  handle.oncontextmenu=e=>e.preventDefault();
  row.append(choose,handle);$('menuRows').append(row);
 });
}
$('name').onclick=()=>{fillDialog();$('menuDialog').showModal()};$('closeMenu').onclick=()=>$('menuDialog').close();

// ---- 端末間共有：合言葉ごとに、メモ・種目名・並び順をサーバーへ保存して同期する ----
const SYNC_URL='https://training-recorder-sync.furuta-ideas.workers.dev',SYNC_STORAGE='rbody-sync-v1';
let syncKey=localStorage.getItem(SYNC_STORAGE)||'',syncNote='',pushTimer=0;
async function syncRequest(key,method,body){
 const res=await fetch(SYNC_URL+'/state/'+key,{method,cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
 if(res.status===404)return null;
 if(!res.ok&&res.status!==409)throw new Error('sync '+res.status);
 return res.json();
}
function syncDone(ok){syncNote=ok?'最終同期 '+new Date().toLocaleTimeString('ja-JP',{hour12:false}):'サーバーに接続できませんでした。通信できるときに自動で再試行します。';renderSync()}
function schedulePush(){if(!syncKey)return;clearTimeout(pushTimer);pushTimer=setTimeout(pushRemote,500)}
async function pushRemote(){
 if(!syncKey)return;
 try{const res=await syncRequest(syncKey,'PUT',state);if(res?.conflict)applyRemote(res.state);syncDone(true)}catch{syncDone(false)}
}
async function pullRemote(){
 if(!syncKey||!baseMenus.length||started||drag||$('editDialog').open)return;
 try{
  const remote=await syncRequest(syncKey,'GET');
  if(remote&&remote.updatedAt>state.updatedAt)applyRemote(remote);
  else if(!remote||remote.updatedAt<state.updatedAt){await pushRemote();return}
  syncDone(true);
 }catch{syncDone(false)}
}
function applyRemote(remote){
 const currentId=current()?.id;
 state={order:Array.isArray(remote.order)?remote.order:[],edits:remote.edits&&typeof remote.edits==='object'?remote.edits:{},updatedAt:Number(remote.updatedAt)||0};
 menus=buildMenus();state.order=menus.map(m=>m.id);persist();index=Math.max(0,menus.findIndex(m=>m.id===currentId));
 renderMenu();renderHeader();if($('menuDialog').open)fillDialog();
}
async function hashPassphrase(text){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('training-recorder:'+text));
 return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function renderSync(){
 const on=Boolean(syncKey);
 $('syncInfo').textContent=on?'共有中です。同じ合言葉を設定した端末と、メモ・種目名・並び順が自動で同期されます。':'スマホとiPadで同じ合言葉を設定すると、メモ・種目名・並び順を共有できます。合言葉は他の人に推測されにくいものにしてください。';
 $('syncStatus').textContent=on?syncNote:'';$('syncLabel').hidden=on;$('syncStart').hidden=on;$('syncStop').hidden=!on;
}
$('openSync').onclick=()=>{$('menuDialog').close();$('syncPass').value='';renderSync();$('syncDialog').showModal()};
$('syncClose').onclick=()=>$('syncDialog').close();
$('syncStop').onclick=()=>{syncKey='';syncNote='';localStorage.removeItem(SYNC_STORAGE);renderSync()};
$('syncForm').onsubmit=async event=>{
 event.preventDefault();const pass=$('syncPass').value.trim();
 if(pass.length<8){$('syncStatus').textContent='合言葉は8文字以上で入力してください。';return}
 $('syncStart').disabled=true;$('syncStatus').textContent='接続しています…';
 try{
  const key=await hashPassphrase(pass),remote=await syncRequest(key,'GET');
  if(remote&&!confirm('この合言葉の共有データが見つかりました。\nこの端末のメモ・種目名・並び順を、共有データの内容に置き換えます。よろしいですか？')){$('syncStatus').textContent='';return}
  syncKey=key;localStorage.setItem(SYNC_STORAGE,key);
  if(remote){applyRemote(remote);syncDone(true)}else{state.updatedAt=Date.now();persist();await pushRemote()}
 }catch{$('syncStatus').textContent='サーバーに接続できませんでした。通信環境を確認して、もう一度お試しください。'}
 finally{$('syncStart').disabled=false}
};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pullRemote()});
setInterval(()=>{if(document.visibilityState==='visible')pullRemote()},60000);

initialize().catch(error=>{console.error(error);$('memo').textContent='データを読み込めませんでした。再読み込みしてください。'});
