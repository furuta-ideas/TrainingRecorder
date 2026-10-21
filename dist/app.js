import {trainingConfig} from './training-config.js';
import {normalizePlan,slotAt,applyMenuOrder} from './training.js';

const $=id=>document.getElementById(id);
const STORAGE_KEY='rbody-semi-auto-v1';
let menus=[],index=0,running=false,started=false,startedAt=0,raf=0,renderToken=0,mediaUrls=[];
let state=loadState();

function loadState(){
 try{
  const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
  if(saved&&typeof saved==='object')return {order:Array.isArray(saved.order)?saved.order:[],edits:saved.edits&&typeof saved.edits==='object'?saved.edits:{}};
 }catch{}
 try{
  const legacy=JSON.parse(localStorage.getItem('rbody-records-v1')||'{}'),edits={};
  for(const [id,note] of Object.entries(legacy.menuNotes||{}))edits[id]={name:note.name,memo:[note.tip,note.learning].filter(Boolean).join('\n')};
  return {order:Array.isArray(legacy.menuOrder)?legacy.menuOrder:[],edits};
 }catch{return {order:[],edits:{}}}
}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function current(){return menus[index]}
function format(ms){const sec=Math.max(0,Math.floor(ms/1000));return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}
function viewport(){document.documentElement.style.setProperty('--app-height',Math.floor(window.visualViewport?.height||innerHeight)+'px')}
viewport();addEventListener('resize',viewport);window.visualViewport?.addEventListener('resize',viewport);

setTimeout(()=>{
 $('openingScreen').hidden=true;document.body.classList.remove('opening');$('app').inert=false;
},3000);
setInterval(()=>{$('wallClock').textContent=new Date().toLocaleTimeString('ja-JP',{hour12:false})},1000);

async function initialize(){
 const data=await fetch('menus.json').then(r=>r.json());
 const enriched=data.menus.map((menu,i)=>{
  const edit=state.edits[menu.id]||{},config=trainingConfig[i];
  return {...menu,...config,id:menu.id,name:edit.name||config.name,memo:edit.memo||config.memo,originalIndex:i};
 });
 menus=applyMenuOrder(enriched,state.order);state.order=menus.map(m=>m.id);persist();renderMenu();await renderCurrent();
}

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
 $('name').textContent=menu.name;$('position').textContent=(index+1)+' / '+menus.length;$('memo').textContent=menu.memo;
 renderTimeline(0);await renderMedia(menu,token);
}
async function assetUrl(asset){return asset?.src||null}
async function renderMedia(menu,token){
 $('video').pause();$('video').removeAttribute('src');$('video').load();mediaUrls.forEach(URL.revokeObjectURL);mediaUrls=[];
 $('video').hidden=true;$('photos').hidden=true;$('photos').replaceChildren();$('mediaEmpty').hidden=true;
 if(menu.video){
  $('mediaLabel').textContent='MOVIE';$('video').src=await assetUrl(menu.video);if(token!==renderToken)return;$('video').hidden=false;$('video').play().catch(()=>{});return;
 }
 $('mediaLabel').textContent='PHOTO';$('photos').hidden=false;
 for(const [assetIndex,asset] of menu.images.entries()){
  const src=await assetUrl(asset);if(token!==renderToken)return;
  if(asset.frames?.length){
   $('photos').classList.add('split');
   asset.frames.forEach((frame,frameIndex)=>{
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),image=document.createElementNS(ns,'image');
    svg.setAttribute('viewBox',[frame.x,frame.y,frame.width,frame.height].join(' '));svg.setAttribute('role','img');svg.setAttribute('aria-label',menu.name+' 写真 '+(frameIndex+1));
    image.setAttribute('href',src);image.setAttribute('width',asset.sourceWidth);image.setAttribute('height',asset.sourceHeight);svg.append(image);$('photos').append(svg);
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
 menu.name=name;menu.memo=memo;state.edits[menu.id]={name,memo};persist();$('editDialog').close();renderMenu();renderCurrent();
};
$('cancelEdit').onclick=()=>$('editDialog').close();

let drag=null;
function fillDialog(){
 $('menuRows').replaceChildren();
 menus.forEach((menu,i)=>{
  const row=document.createElement('div'),choose=document.createElement('button'),handle=document.createElement('button');
  row.className='menu-row'+(i===index?' selected':'');row.dataset.id=menu.id;
  choose.type='button';choose.className='menu-choice';choose.textContent=(i+1)+'. '+menu.name;choose.onclick=()=>{$('menuDialog').close();selectMenu(menus.findIndex(m=>m.id===menu.id))};
  handle.type='button';handle.className='drag-handle';handle.setAttribute('aria-label',menu.name+'を並べ替え');handle.textContent='⠿';
  handle.onpointerdown=e=>{e.preventDefault();drag={row,pointerId:e.pointerId};handle.setPointerCapture(e.pointerId);row.classList.add('dragging')};
  handle.onpointermove=e=>{if(!drag||drag.pointerId!==e.pointerId)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.menu-row');if(target&&target!==row){const rect=target.getBoundingClientRect();target.parentNode.insertBefore(row,e.clientY<rect.top+rect.height/2?target:target.nextSibling)}};
  handle.onpointerup=()=>{if(!drag)return;const currentId=current().id;row.classList.remove('dragging');drag=null;const ids=[...$('menuRows').children].map(el=>el.dataset.id);menus=ids.map(id=>menus.find(m=>m.id===id));index=menus.findIndex(m=>m.id===currentId);state.order=ids;persist();fillDialog();renderMenu()};
  row.append(choose,handle);$('menuRows').append(row);
 });
}
$('name').onclick=()=>{fillDialog();$('menuDialog').showModal()};$('closeMenu').onclick=()=>$('menuDialog').close();

initialize().catch(error=>{console.error(error);$('memo').textContent='データを読み込めませんでした。再読み込みしてください。'});
