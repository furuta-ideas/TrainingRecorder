import {elapsed,toggle,formatDuration,freshSession,summarize} from "./core.js";
import {buildDailyReport} from "./daily-report.js";
const $=id=>document.getElementById(id);
const icons={
  prev:'<path d="M15 5l-7 7 7 7"/><path d="M4 5v14"/>',
  next:'<path d="M9 5l7 7-7 7"/><path d="M20 5v14"/>',
};
const svg=paths=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+paths+'</svg>';
$("prev").innerHTML=svg(icons.prev);$("next").innerHTML=svg(icons.next);
const KEY="rbody-records-v1";
function fitViewport(){document.documentElement.style.setProperty("--app-height",Math.floor(window.visualViewport?.height||window.innerHeight)+"px")}
fitViewport();window.addEventListener("resize",fitViewport);window.visualViewport?.addEventListener("resize",fitViewport);
let db,menus=[],index=0,state={logs:[],sessions:{},learning:{},selectedId:null};
let mediaUrls=[],renderId=0;
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
  stopCountTen();
  if(!current())return;
  if(session().runningSince!==null)toggle(session());
  writeLog();tick();
}
function toggleTraining(){
  if(!current())return;
  if(session().runningSince!==null){stopTraining();notify("実施時間とメモをログに自動保存しました。");return}
  toggle(session());persist();tick();notify("");
}
function move(next){
  if(next<0||next>=menus.length||next===index)return;
  stopTraining();state.sessions[current().id]=freshSession(current().id);
  index=next;state.selectedId=current().id;state.sessions[current().id]=freshSession(current().id);
  persist();render();notify("");
}
function summaryFields(){
  const m=current(),notes=state.learning[m.id]||[],override=state.menuNotes?.[m.id];
  return override||{prescription:m.prescription+" ｜ "+m.durationNote,tip:m.tips,learning:notes.length?"気づき："+summarize(notes.join("。"),46):m.trainerNote||(m.needsConfirmation?"当日の個別説明は未確認":"呼吸とフォームを意識して、丁寧に。")};
}
function renderSummary(){
  const fields=summaryFields();
  for(const [id,key] of [["prescription","prescription"],["tip","tip"],["learning","learning"]]){$(id).textContent=fields[key];$(id).title=fields[key]}
}
function openNoteEditor(){
  if(!current()||$("noteDialog").open)return;
  stopCountTen();const fields=summaryFields();
  $("noteDialog").dataset.menuId=current().id;$("noteMenuName").textContent=current().name;
  $("notePrescription").value=fields.prescription;$("noteTip").value=fields.tip;$("noteLearning").value=fields.learning;
  $("noteError").textContent="";$("noteDialog").showModal();$("noteTip").focus();
}
$("instructions").addEventListener("dblclick",openNoteEditor);
$("instructions").addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openNoteEditor()}});
let lastNoteTap=0;
$("instructions").addEventListener("pointerup",event=>{
  if(event.pointerType!=="touch")return;const now=performance.now();
  if(lastNoteTap&&now-lastNoteTap<400){lastNoteTap=0;openNoteEditor()}else lastNoteTap=now;
});
$("noteForm").addEventListener("submit",event=>{
  event.preventDefault();const id=$("noteDialog").dataset.menuId;
  if(!$("notePrescription").value.trim()){$("noteError").textContent="回数・時間を入力してください。";return}
  const previous=state.menuNotes?.[id];state.menuNotes??={};
  state.menuNotes[id]={prescription:$("notePrescription").value.trim(),tip:$("noteTip").value.trim(),learning:$("noteLearning").value.trim()};
  if(!persist()){if(previous)state.menuNotes[id]=previous;else delete state.menuNotes[id];$("noteError").textContent="保存できませんでした。入力内容をコピーしてから、端末の保存領域をご確認ください。";return}
  renderSummary();$("noteDialog").close();notify("このメニューのメモを保存しました。");
});
$("cancelNote").onclick=()=>$("noteDialog").close();

function request(store,mode,fn){return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode),req=fn(tx.objectStore(store));let result;req.onsuccess=()=>{result=req.result};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
async function initDB(){db=await new Promise((resolve,reject)=>{const r=indexedDB.open("rbody-media-v1",1);r.onupgradeneeded=()=>{r.result.createObjectStore("assets");r.result.createObjectStore("menus",{keyPath:"id"})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function assetURL(asset){
  if(!asset)return null;
  if(asset.blobId){const blob=await request("assets","readonly",s=>s.get(asset.blobId));if(!blob)return null;const url=URL.createObjectURL(blob);mediaUrls.push(url);return url}
  return asset.src;
}
async function render(){
  const generation=++renderId,m=current();
  $("video").pause();$("video").removeAttribute("src");$("video").load();
  mediaUrls.forEach(URL.revokeObjectURL);mediaUrls=[];
  $("name").textContent=m.name;$("position").textContent=(index+1)+" / "+menus.length;
  $("prev").disabled=index===0;$("next").disabled=index===menus.length-1;$("menuSelect").value=m.id;
  renderSummary();tick();
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
}
let countTenInterval=null,countTenStarted=0,countTenValue=0;
const countWords=["いち","に","さん","よん","ご","ろく","なな","はち","きゅう","じゅう"];
function stopCountTen(completed=false){
  clearInterval(countTenInterval);countTenInterval=null;
  if(!completed)window.speechSynthesis?.cancel();
  $("countTen").setAttribute("aria-pressed","false");
  $("countTenLabel").textContent=completed?"10秒完了・もう一度":"音声ON・10秒開始";
  $("countTen").setAttribute("aria-label",completed?"10秒完了。音声ONでもう一度開始":"音声ON・10秒カウント開始");
}
function startCountTen(){
  if(countTenInterval!==null){stopCountTen();return}
  const synth=window.speechSynthesis,canSpeak=!!(synth&&window.SpeechSynthesisUtterance);
  if(canSpeak){synth.cancel();synth.resume();const warmup=new SpeechSynthesisUtterance(" ");warmup.volume=0;synth.speak(warmup)}
  notify(canSpeak?"1秒ごとに1〜10を読み上げます。":"音声読み上げに対応していません。画面で10秒を数えます。");
  countTenStarted=performance.now();countTenValue=0;
  $("countTen").setAttribute("aria-pressed","true");$("countTen").setAttribute("aria-label","10秒カウントを停止");$("countTenLabel").textContent="停止 0 / 10";
  countTenInterval=setInterval(()=>{
    const value=Math.min(10,Math.floor((performance.now()-countTenStarted)/1000));
    if(value<=countTenValue)return;
    countTenValue=value;$("countTenLabel").textContent="停止 "+value+" / 10";
    if(canSpeak){
      synth.cancel();const utterance=new SpeechSynthesisUtterance(countWords[value-1]);utterance.lang="ja-JP";utterance.rate=1.3;
      const voice=synth.getVoices().find(v=>v.lang.startsWith("ja"));if(voice)utterance.voice=voice;
      utterance.onerror=event=>{if(!["interrupted","canceled"].includes(event.error))notify("音声を再生できません。端末の音量を確認してください。画面のカウントは継続します。")};
      synth.speak(utterance);
    }
    if(value===10){stopCountTen(true);notify("10秒カウントが完了しました。")}
  },50);
}
$("countTen").onclick=startCountTen;
$("startStop").onclick=toggleTraining;
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
