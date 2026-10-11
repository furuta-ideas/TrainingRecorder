import {elapsed,toggle,formatDuration,freshSession,summarize} from "./core.js";
const $=id=>document.getElementById(id);
const icons={prev:'<path d="M15 5l-7 7 7 7"/><path d="M4 5v14"/>',next:'<path d="M9 5l7 7-7 7"/><path d="M20 5v14"/>',mic:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0014 0v-2M12 19v3M8 22h8"/>',off:'<path d="M3 3l18 18M9 9v3a3 3 0 005 2M9 5a3 3 0 016 0v5M5 10v2a7 7 0 0012 5M19 10v2M12 19v3M8 22h8"/>'};
function svg(paths){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+paths+'</svg>'}
$("prev").innerHTML=svg(icons.prev);$("next").innerHTML=svg(icons.next);
let db,menus=[],index=0,state={logs:[],sessions:{},learning:{},selectedId:null},recognition=null,listening=false,mediaUrls=[];
const KEY="rbody-records-v1";
function notify(message){$("notice").textContent=message}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));return true}catch{notify("保存領域が不足しています。記録を書き出してバックアップしてください。");return false}}
const current=()=>menus[index];
const session=()=>state.sessions[current().id]??(state.sessions[current().id]=freshSession(current().id));
function saveMemo(){if(!current())return;session().memo=$("memo").value;persist()}
function stopMic(){listening=false;const previous=recognition;recognition=null;previous?.abort()}
function stopUnified(){if(current()&&session().runningSince!==null)toggle(session());stopMic();saveMemo();tick()}
function toggleUnified(){
  if(!current()||!$("memo").readOnly)return;
  if(session().runningSince!==null){stopUnified();return}
  toggle(session());persist();tick();startMic();
}
function finish(){
  stopUnified();saveMemo();const s=session(),duration=elapsed(s);
  if(s.startedAt===null&&!s.memo.trim())return false;
  const endedAt=Date.now();
  state.logs.unshift({id:crypto.randomUUID(),menuId:current().id,name:current().name,startedAt:s.startedAt??endedAt,endedAt,duration,memo:s.memo.trim()});
  if(s.memo.trim()){
    const prior=state.learning[current().id]||[];
    state.learning[current().id]=[...prior,s.memo.trim()].slice(-12);
  }
  state.sessions[current().id]=freshSession(current().id);persist();$("memo").value="";renderLogs();renderSummary();tick();notify("トレーニングを保存しました。");return true;
}
function move(next){
  if(next<0||next>=menus.length||next===index)return;
  finish();index=next;state.selectedId=current().id;persist();render();
}
function renderSummary(){
  const m=current();$("prescription").textContent=m.prescription+" ｜ "+m.durationNote;
  $("tip").textContent=m.tips;$("tip").title=m.tips;
  const notes=state.learning[m.id]||[];
  $("learning").textContent=notes.length?"気づき："+summarize(notes.join("。"),46):m.needsConfirmation?"当日の個別説明は未確認": "呼吸とフォームを意識して、丁寧に。";
  $("learning").title=notes.slice(-3).join("\n");
}
async function assetURL(asset){
  if(!asset)return null;
  if(asset.blobId){const blob=await request("assets","readonly",s=>s.get(asset.blobId));if(!blob)return null;const url=URL.createObjectURL(blob);mediaUrls.push(url);return url}
  return asset.src;
}
let renderId=0;
async function render(){
  const generation=++renderId;
  $("video").pause();$("video").removeAttribute("src");$("video").load();
  mediaUrls.forEach(URL.revokeObjectURL);mediaUrls=[];
  const m=current();$("name").textContent=m.name;$("position").textContent="TRAINING "+String(index+1).padStart(2,"0")+" / "+String(menus.length).padStart(2,"0");
  $("prev").disabled=index===0;$("next").disabled=index===menus.length-1;$("menuSelect").value=m.id;
  $("memo").value=session().memo;$("memo").readOnly=true;$("editMemo").textContent="手入力";renderSummary();tick();
  $("photos").replaceChildren();
  for(const [i,a] of m.images.entries()){
    const src=await assetURL(a);if(generation!==renderId)return;
    const figure=document.createElement("figure");figure.className="training-photo";
    const img=document.createElement("img");img.src=src;img.alt=m.name+" フォーム "+(i+1);img.onerror=()=>{img.alt="教材を読み込めませんでした"};
    const caption=document.createElement("figcaption");caption.textContent="フォーム "+(i+1);figure.append(img,caption);$("photos").append(figure);
  }
  const src=await assetURL(m.video);if(generation!==renderId)return;
  $("video").hidden=!src;$("noVideo").hidden=!!src;$("noVideo").replaceChildren();
  if(src){
    $("video").src=src;$("videoStatus").textContent="● 繰り返し再生";
    $("video").play().catch(()=>{$("videoStatus").textContent="再生ボタンをタップしてください"});
  }else{
    const img=document.createElement("img");const photo=await assetURL(m.images[0]);if(photo)img.src=photo;else img.hidden=true;img.alt=m.name;
    const p=document.createElement("p");p.textContent="この種目の動画は未登録です。静止画でフォームを確認できます。";$("noVideo").append(img,p);$("videoStatus").textContent="静止画教材";
  }
}
function renderLogs(){
  $("count").textContent=state.logs.length;$("logs").replaceChildren();
  if(!state.logs.length){const empty=document.createElement("div");empty.className="empty";empty.innerHTML=svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>')+"今日の一歩を、ここに。<br>計測してメニューを移動すると<br>記録が積み重なります。";$("logs").append(empty);return}
  for(const log of state.logs){
    const el=document.createElement("article");el.className="log-entry";
    const time=document.createElement("time"),d=new Date(log.startedAt);time.dateTime=d.toISOString();time.textContent=(d.getMonth()+1)+"/"+d.getDate()+" "+d.toLocaleTimeString("ja-JP",{hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"});
    const title=document.createElement("h3");title.textContent=log.name;
    const comment=document.createElement("p");comment.textContent=log.memo||"気づきメモなし";
    const duration=document.createElement("span");duration.className="log-duration";duration.textContent="実施時間 "+formatDuration(log.duration);
    el.append(time,title,comment,duration);$("logs").append(el);
  }
}
function tick(){
  $("wallClock").textContent=new Date().toLocaleTimeString("ja-JP",{hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"});
  if(!current())return;const s=session(),running=s.runningSince!==null,mode=running?"running":s.startedAt!==null?"paused":"idle";
  $("clock").className="clock "+mode;$("elapsed").textContent=formatDuration(elapsed(s));
  $("timerState").textContent=running?"計測中":mode==="paused"?"一時停止":"待機中";
  $("timerHint").textContent=running?"音声メモ欄をタップして停止":"音声メモ欄をタップして開始・再開";
  $("memo").classList.toggle("recording",running);
  $("micStatus").textContent=running?(SpeechRecognition?"● 音声メモ・計測中":"● 計測中（音声入力非対応）"):mode==="paused"?"停止中 · メモ欄をタップで再開":"メモ欄をタップで開始";
  $("memo").setAttribute("aria-label",$("memo").readOnly?(running?"音声メモと計測を停止":"音声メモと計測を開始・再開"):"気づきメモを手入力");
}
$("memo").onclick=toggleUnified;
$("memo").onkeydown=e=>{if($("memo").readOnly&&(e.key===" "||e.key==="Enter")){e.preventDefault();toggleUnified()}};
$("editMemo").onclick=()=>{stopUnified();$("memo").readOnly=!$("memo").readOnly;$("editMemo").textContent=$("memo").readOnly?"手入力":"手入力を完了";tick();if(!$("memo").readOnly)$("memo").focus()};
$("prev").onclick=()=>move(index-1);$("next").onclick=()=>move(index+1);$("finish").onclick=finish;
$("menuSelect").onchange=e=>move(menus.findIndex(m=>m.id===e.target.value));$("memo").oninput=saveMemo;
$("video").onerror=()=>{$("videoStatus").textContent="動画を読み込めませんでした。静止画またはNotionをご確認ください。"};
$("manage").onclick=()=>{stopUnified();$("manager").showModal()};$("closeManager").onclick=()=>$("manager").close();
function request(store,mode,fn){return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode),req=fn(tx.objectStore(store));let result;req.onsuccess=()=>{result=req.result};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
async function initDB(){db=await new Promise((resolve,reject)=>{const r=indexedDB.open("rbody-media-v1",1);r.onupgradeneeded=()=>{r.result.createObjectStore("assets");r.result.createObjectStore("menus",{keyPath:"id"})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function fillSelect(){ $("menuSelect").replaceChildren(...menus.map(m=>{const o=document.createElement("option");o.value=m.id;o.textContent=m.name;return o}))}
$("addForm").onsubmit=async e=>{
  e.preventDefault();const form=e.target,button=form.querySelector('[type=submit]');button.disabled=true;
  try{
    if(!db)throw Error("このブラウザでは教材の保存が使えません。Safariで開いてください。");
    const data=new FormData(form),images=[],id=crypto.randomUUID();
    async function keep(file){const blobId=crypto.randomUUID();await request("assets","readwrite",s=>s.put(file,blobId));return {blobId,name:file.name}}
    for(const file of data.getAll("photos"))if(file.size)images.push(await keep(file));
    const vf=data.get("video"),video=vf.size?await keep(vf):null;
    const menu={id,name:data.get("name").trim(),prescription:data.get("prescription").trim(),durationNote:data.get("durationNote").trim(),tips:data.get("tips").trim(),images,video,needsConfirmation:false};
    await request("menus","readwrite",s=>s.put(menu));menus.push(menu);fillSelect();form.reset();$("manager").close();move(menus.length-1);notify("メニューを追加しました。教材はこの端末に保存されます。");
  }catch(error){$("addStatus").textContent="追加できませんでした："+error.message}finally{button.disabled=false}
};
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
function startMic(){
  if(!SpeechRecognition){notify("音声入力非対応のため計測のみ開始しました。「手入力」からメモを入力できます。");return}
  const r=new SpeechRecognition();recognition=r;r.lang="ja-JP";r.continuous=true;r.interimResults=true;
  let base="",finalText="";
  r.onresult=e=>{if(!listening||recognition!==r)return;let interim="";for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)finalText+=e.results[i][0].transcript+"。";else interim+=e.results[i][0].transcript}$("memo").value=base+finalText+interim;saveMemo()};
  r.onerror=e=>{if(recognition!==r||e.error==="no-speech")return;stopUnified();notify(e.error==="not-allowed"?"マイクが許可されていないため音声入力と計測を停止しました。":"音声入力と計測を停止しました。マイク設定をご確認ください。")};
  r.onend=()=>{if(listening&&recognition===r){base=$("memo").value+"\n";finalText="";try{r.start()}catch{stopUnified();notify("音声入力と計測を停止しました。メモ欄をタップして再開してください。")}}};
  base=$("memo").value+($("memo").value?"\n":"");
  try{listening=true;r.start()}catch{stopUnified();notify("音声入力を開始できませんでした。マイク設定をご確認ください。")}
}
$("export").onclick=()=>{
  saveMemo();const blob=new Blob([JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),state,customMenus:menus.filter(m=>m.images.some(a=>a.blobId)||m.video?.blobId)},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="rbody-records-"+new Date().toISOString().slice(0,10)+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);notify("記録を書き出しました。追加教材のファイル自体は含まれません。");
};
$("restore").onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{const data=JSON.parse(await file.text());if(data.schemaVersion!==1||!Array.isArray(data.state?.logs))throw Error("対応していない形式です");
    const valid=data.state.logs.every(l=>typeof l.id==="string"&&typeof l.name==="string"&&typeof l.memo==="string"&&Number.isFinite(l.startedAt)&&Number.isFinite(l.duration)&&l.duration>=0);
    if(!valid)throw Error("記録の形式が正しくありません");
    const ids=new Set(state.logs.map(l=>l.id));state.logs.push(...data.state.logs.filter(l=>!ids.has(l.id)));state.logs.sort((a,b)=>b.startedAt-a.startedAt);
    for(const [id,notes] of Object.entries(data.state.learning||{}))if(Array.isArray(notes)&&notes.every(n=>typeof n==="string"))state.learning[id]=[...new Set([...(state.learning[id]||[]),...notes])].slice(-12);
    persist();renderLogs();renderSummary();$("manager").close();notify("記録を復元しました。既存の記録と統合しました。");
  }catch(err){$("addStatus").textContent="復元できません："+err.message}e.target.value="";
};
window.addEventListener("pagehide",stopUnified);
document.addEventListener("visibilitychange",()=>{if(document.hidden)stopUnified();else tick()});
async function init(){
  const response=await fetch("./menus.json");if(!response.ok)throw Error("メニューを取得できませんでした");
  menus=(await response.json()).menus;
  try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&Array.isArray(saved.logs)&&saved.sessions&&saved.learning)state=saved}catch{notify("端末保存データを読み込めませんでした。")}
  for(const s of Object.values(state.sessions))if(s.runningSince!==null)toggle(s);
  persist();
  try{await initDB();menus.push(...await request("menus","readonly",s=>s.getAll()))}catch{notify("追加教材の端末保存は利用できません。")}
  index=Math.max(0,menus.findIndex(m=>m.id===state.selectedId));fillSelect();renderLogs();await render();
  $("date").textContent=new Date().toLocaleDateString("ja-JP",{year:"numeric",month:"long",day:"numeric",weekday:"short"});
  setInterval(tick,250);
}
init().catch(error=>{notify(error.message+"。ページを再読み込みしてください。");$("name").textContent="教材の読み込みに失敗しました"});
