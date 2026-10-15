import {elapsed,toggle,formatDuration,freshSession,summarize} from "./core.js";
import {buildDailyReport} from "./daily-report.js";
const $=id=>document.getElementById(id);
const icons={
  prev:'<path d="M15 5l-7 7 7 7"/><path d="M4 5v14"/>',
  next:'<path d="M9 5l7 7-7 7"/><path d="M20 5v14"/>',
  mic:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0014 0v-2M12 19v3M8 22h8"/>',
  off:'<path d="M3 3l18 18M9 9v3a3 3 0 005 2M9 5a3 3 0 016 0v5M5 10v2a7 7 0 0012 5M19 10v2M12 19v3M8 22h8"/>',
  edit:'<path d="M15 4l5 5M4 20l5-1L21 7a2 2 0 00-5-5L4 14z"/>',
  check:'<path d="M5 12l4 4L20 5"/>'
};
const svg=paths=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+paths+'</svg>';
$("prev").innerHTML=svg(icons.prev);$("next").innerHTML=svg(icons.next);
const KEY="rbody-records-v1",SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
function fitViewport(){document.documentElement.style.setProperty("--app-height",Math.floor(window.visualViewport?.height||window.innerHeight)+"px")}
fitViewport();window.addEventListener("resize",fitViewport);window.visualViewport?.addEventListener("resize",fitViewport);
let db,menus=[],index=0,state={logs:[],sessions:{},learning:{},selectedId:null};
let recognition=null,listening=false,recognitionGeneration=0,mediaUrls=[],renderId=0;
let sendingReport=false;
const photoResize=new ResizeObserver(entries=>{
  for(const entry of entries){
    const gallery=entry.target;if(!gallery.classList.contains("split"))continue;
    gallery.style.setProperty("--photo-cols",entry.contentRect.width/Math.max(1,entry.contentRect.height)>=202/148?2:1);
  }
});
photoResize.observe($("photos"));
const current=()=>menus[index];
const session=()=>state.sessions[current().id]??(state.sessions[current().id]=freshSession(current().id));
function notify(message){$("notice").textContent=message}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));return true}catch{notify("端末への保存ができません。ブラウザの保存領域をご確認ください。");return false}}
function saveMemo(){if(!current())return;session().memo=$("memo").value;persist()}
function stopMic(){
  listening=false;recognitionGeneration++;const previous=recognition;recognition=null;
  if(previous){previous.onresult=null;previous.onerror=null;previous.onend=null;try{previous.abort()}catch{}}
  if(current())tick();
}
function writeLog(){
  if(!current())return false;const s=session(),memo=s.memo.trim();
  if(s.startedAt===null&&!memo)return false;
  s.logId??=crypto.randomUUID();
  const entry={id:s.logId,menuId:current().id,name:current().name,startedAt:s.startedAt??Date.now(),endedAt:Date.now(),duration:elapsed(s),memo};
  const existing=state.logs.findIndex(log=>log.id===s.logId);
  if(existing<0)state.logs.unshift(entry);else state.logs[existing]=entry;
  if(memo&&memo!==s.learnedMemo){
    state.learning[current().id]=[...new Set([...(state.learning[current().id]||[]),memo])].slice(-12);s.learnedMemo=memo;
  }
  persist();renderLogs();renderSummary();return true;
}
function stopTraining(){
  if(!current())return;
  if(session().runningSince!==null)toggle(session());
  stopMic();saveMemo();writeLog();tick();
}
function toggleTraining(){
  if(!current())return;
  if(session().runningSince!==null){stopTraining();notify("実施時間とメモをログに自動保存しました。");return}
  saveMemo();toggle(session());persist();tick();notify("");
}
function move(next){
  if(next<0||next>=menus.length||next===index)return;
  stopTraining();state.sessions[current().id]=freshSession(current().id);
  index=next;state.selectedId=current().id;state.sessions[current().id]=freshSession(current().id);
  persist();render();notify("");
}
function renderSummary(){
  const m=current();$("prescription").textContent=m.prescription+" ｜ "+m.durationNote;
  $("tip").textContent=m.tips;$("tip").title=m.tips;
  const notes=state.learning[m.id]||[];
  $("learning").textContent=notes.length?"気づき："+summarize(notes.join("。"),46):m.needsConfirmation?"当日の個別説明は未確認":"呼吸とフォームを意識して、丁寧に。";
  $("learning").title=notes.slice(-3).join("\n");
}
function request(store,mode,fn){return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode),req=fn(tx.objectStore(store));let result;req.onsuccess=()=>{result=req.result};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
async function initDB(){db=await new Promise((resolve,reject)=>{const r=indexedDB.open("rbody-media-v1",1);r.onupgradeneeded=()=>{r.result.createObjectStore("assets");r.result.createObjectStore("menus",{keyPath:"id"})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function assetURL(asset){
  if(!asset)return null;
  if(asset.blobId){const blob=await request("assets","readonly",s=>s.get(asset.blobId));if(!blob)return null;const url=URL.createObjectURL(blob);mediaUrls.push(url);return url}
  return asset.src;
}
function setEditing(editing){$("memo").readOnly=!editing;$("editMemo").innerHTML=svg(editing?icons.check:icons.edit);$("editMemo").setAttribute("aria-label",editing?"手入力を完了":"手入力する");$("editMemo").setAttribute("aria-pressed",String(editing))}
async function render(){
  const generation=++renderId,m=current();
  $("video").pause();$("video").removeAttribute("src");$("video").load();
  mediaUrls.forEach(URL.revokeObjectURL);mediaUrls=[];
  $("name").textContent=m.name;$("position").textContent=(index+1)+" / "+menus.length;
  $("prev").disabled=index===0;$("next").disabled=index===menus.length-1;$("menuSelect").value=m.id;
  $("memo").value=session().memo;setEditing(false);renderSummary();tick();
  $("photos").replaceChildren();$("photos").classList.remove("split");$("mediaEmpty").hidden=true;
  $("video").hidden=true;$("photos").hidden=true;
  $("mediaStage").className="media-stage "+(m.video?"has-video":"has-photos");
  $("mediaLabel").textContent=m.video?"MOVIE":"PHOTO";
  if(m.video){
    const src=await assetURL(m.video);if(generation!==renderId)return;
    if(!src){$("mediaEmpty").hidden=false;return}
    $("video").src=src;$("video").hidden=false;$("videoStatus").textContent="繰り返し再生";
    $("video").play().catch(()=>{if(generation===renderId)$("videoStatus").textContent="再生ボタンをタップしてください"});
  }else{
    $("photos").hidden=false;$("videoStatus").textContent="";
    for(const [i,asset] of m.images.entries()){
      const src=await assetURL(asset);if(generation!==renderId)return;if(!src)continue;
      if(asset.frames?.length){
        $("photos").classList.add("split");
        for(const [frameIndex,frame] of asset.frames.entries()){
          const figure=document.createElement("figure"),ns="http://www.w3.org/2000/svg",picture=document.createElementNS(ns,"svg"),image=document.createElementNS(ns,"image");
          picture.setAttribute("viewBox",[frame.x,frame.y,frame.width,frame.height].join(" "));picture.setAttribute("role","img");picture.setAttribute("aria-label",m.name+" 写真 "+(frameIndex+1));
          const defs=document.createElementNS(ns,"defs"),clip=document.createElementNS(ns,"clipPath"),rect=document.createElementNS(ns,"rect"),clipId="photo-"+generation+"-"+i+"-"+frameIndex;
          clip.setAttribute("id",clipId);clip.setAttribute("clipPathUnits","userSpaceOnUse");
          for(const key of ["x","y","width","height"])rect.setAttribute(key,frame[key]);
          clip.append(rect);defs.append(clip);picture.append(defs);
          image.setAttribute("href",src);image.setAttribute("width",asset.sourceWidth);image.setAttribute("height",asset.sourceHeight);image.setAttribute("clip-path","url(#"+clipId+")");picture.append(image);figure.append(picture);$("photos").append(figure);
        }
      }else{
        const figure=document.createElement("figure"),img=document.createElement("img");
        img.src=src;img.alt=m.name+" フォーム "+(i+1);figure.append(img);$("photos").append(figure);
      }
    }
    $("mediaEmpty").hidden=$("photos").childElementCount>0;
  }
}
function renderLogs(){
  $("count").textContent=state.logs.length;$("logs").replaceChildren();
  if(!state.logs.length){const p=document.createElement("p");p.className="empty";p.textContent="終了・メニュー移動時に自動保存されます。";$("logs").append(p);return}
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
  if(!current())return;const running=session().runningSince!==null;
  $("startStop").classList.toggle("running",running);$("startStop").textContent=running?"終了":"開始";$("startStop").setAttribute("aria-pressed",String(running));
  $("elapsed").textContent=formatDuration(elapsed(session()));
  $("micToggle").innerHTML=svg(listening?icons.off:icons.mic);$("micToggle").classList.toggle("recording",listening);
  $("micToggle").setAttribute("aria-label",listening?"音声メモを停止":"音声メモを開始");$("micToggle").setAttribute("aria-pressed",String(listening));
  $("micStatus").textContent=listening?"● 音声入力中":"マイクOFF";$("memo").classList.toggle("recording",listening);
}
function startMic(){
  if(!SpeechRecognition){notify("音声入力に対応していません。鉛筆アイコンから手入力できます。");return}
  saveMemo();setEditing(false);
  const r=new SpeechRecognition();recognition=r;r.lang="ja-JP";r.continuous=true;r.interimResults=true;
  const generation=++recognitionGeneration,menuId=current().id;
  const active=()=>listening&&recognition===r&&recognitionGeneration===generation&&current()?.id===menuId;
  let base=$("memo").value+($("memo").value?"\n":""),finalText="";
  r.onstart=()=>{if(!active()){try{r.abort()}catch{}}};
  r.onresult=e=>{if(!active())return;let interim="";for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)finalText+=e.results[i][0].transcript+"。";else interim+=e.results[i][0].transcript}$("memo").value=base+finalText+interim;saveMemo();if(session().logId)writeLog()};
  r.onerror=e=>{if(!active()||e.error==="no-speech")return;stopMic();saveMemo();notify(e.error==="not-allowed"?"マイクの許可をご確認ください。時間計測は開始／終了ボタンで操作できます。":"音声入力を停止しました。鉛筆アイコンから手入力できます。")};
  r.onend=()=>{if(active()){base=$("memo").value+"\n";finalText="";try{r.start()}catch{stopMic();notify("音声入力を停止しました。マイクアイコンで再開できます。")}}};
  try{listening=true;r.start();tick();notify("")}catch{stopMic();notify("音声入力を開始できませんでした。マイク設定をご確認ください。")}
}
$("startStop").onclick=toggleTraining;
$("micToggle").onclick=()=>{if(listening){stopMic();saveMemo();if(session().logId)writeLog()}else startMic()};
$("editMemo").onclick=()=>{stopMic();saveMemo();setEditing($("memo").readOnly);if(!$("memo").readOnly)$("memo").focus();else if(session().logId)writeLog()};
$("memo").oninput=()=>{saveMemo();if(session().logId)writeLog()};
$("prev").onclick=()=>move(index-1);$("next").onclick=()=>move(index+1);
$("menuSelect").onchange=e=>move(menus.findIndex(m=>m.id===e.target.value));
$("video").onerror=()=>{$("videoStatus").textContent="動画を読み込めません。再読み込みしてください。"};
async function sendDailyReport(){
  if(sendingReport||!current())return {ok:false};
  stopTraining();
  const report=buildDailyReport(state.logs);
  if(!report.count){notify("今日のトレーニング記録がありません。");return {ok:false,error:"今日のトレーニング記録がありません。"}}
  const fingerprint=JSON.stringify({subject:report.subject,body:report.body});
  if(state.reportReceipts?.[report.dateKey]?.fingerprint===fingerprint){notify("今日の同じ内容のログは送信済みです。");return {ok:true,message:"今日の同じ内容のログは送信済みです。"}}
  sendingReport=true;$("endWorkout").disabled=true;$("endWorkout").textContent="メール送信中…";notify("今日のログを送信しています。");
  try{
    const todayLogs=state.logs.filter(log=>buildDailyReport([log]).count>0);
    const response=await fetch("/api/daily-report",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({logs:todayLogs}),signal:AbortSignal.timeout(30000)});
    let result;try{result=await response.json()}catch{throw Error("送信結果を確認できませんでした。記録は端末に保存されています。")}
    if(!response.ok||result.status!=="accepted"||typeof result.messageId!=="string")throw Error(result.error||"メールを送信できませんでした。記録は保存済みです。");
    state.reportReceipts??={};state.reportReceipts[report.dateKey]={fingerprint,messageId:result.messageId,sentAt:Date.now()};persist();
    notify(report.to+" 宛てのメール送信を受け付けました。記録："+report.count+"件");
    return {ok:true,message:"furuta.ideas@gmail.com 宛てのメール送信を受け付けました。"};
  }catch(error){const message=error.name==="TimeoutError"?"送信結果を確認できませんでした。記録は保存済みです。同じ内容で再試行できます。":error.message;notify(message);return {ok:false,error:message}}
  finally{sendingReport=false;$("endWorkout").disabled=false;$("endWorkout").textContent="トレーニング終了"}
}
function closeWorkout(message){
  stopTraining();$("video").pause();$("endDialog").close();$("closedMessage").textContent=message;
  document.body.classList.add("workout-closed");$("closedScreen").hidden=false;
  try{window.close()}catch{}
}
$("endWorkout").onclick=()=>{
  stopTraining();const report=buildDailyReport(state.logs);
  $("endMessage").textContent="今日の記録："+report.count+"件。記録はこの端末に保存しました。";
  $("sendAndClose").disabled=false;$("skipAndClose").disabled=false;$("cancelEnd").disabled=false;$("endDialog").showModal();
};
$("sendAndClose").onclick=async()=>{
  $("sendAndClose").disabled=true;$("skipAndClose").disabled=true;$("cancelEnd").disabled=true;$("endMessage").textContent="メールを送信しています…";
  const result=await sendDailyReport();
  if(result.ok)closeWorkout(result.message);
  else{$("endMessage").textContent=(result.error||"送信できませんでした。")+" 記録は保存済みです。再試行するか、送信せず終了できます。";$("sendAndClose").disabled=false;$("skipAndClose").disabled=false;$("cancelEnd").disabled=false;}
};
$("skipAndClose").onclick=()=>closeWorkout("メールは送信していません。トレーニング記録はこの端末に保存されています。");
$("cancelEnd").onclick=()=>$("endDialog").close();
$("endDialog").addEventListener("cancel",event=>{if(sendingReport)event.preventDefault()});
$("returnApp").onclick=()=>{document.body.classList.remove("workout-closed");$("closedScreen").hidden=true};
window.addEventListener("pagehide",stopTraining);
document.addEventListener("visibilitychange",()=>{if(document.hidden)stopTraining();else tick()});
async function init(){
  const response=await fetch("./menus.json");if(!response.ok)throw Error("メニューを取得できませんでした");
  menus=(await response.json()).menus;
  try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&Array.isArray(saved.logs)&&saved.sessions&&saved.learning)state=saved}catch{notify("端末保存データを読み込めませんでした。")}
  for(const s of Object.values(state.sessions))if(s.runningSince!==null)toggle(s);
  persist();
  try{await initDB();menus.push(...await request("menus","readonly",s=>s.getAll()))}catch{notify("追加教材の端末保存を読み込めませんでした。")}
  index=Math.max(0,menus.findIndex(m=>m.id===state.selectedId));
  $("menuSelect").replaceChildren(...menus.map(m=>{const o=document.createElement("option");o.value=m.id;o.textContent=m.name;return o}));
  renderLogs();await render();setInterval(tick,250);
}
init().catch(error=>{notify(error.message+"。ページを再読み込みしてください。");$("name").textContent="教材の読み込みに失敗しました"});
