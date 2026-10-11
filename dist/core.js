export function elapsed(session, now=Date.now()) {
  return (session.accumulated||0)+(session.runningSince===null?0:Math.max(0,now-session.runningSince));
}
export function toggle(session, now=Date.now()) {
  if(session.runningSince===null){session.runningSince=now;session.startedAt??=now}
  else{session.accumulated=elapsed(session,now);session.runningSince=null}
  return session;
}
export function formatDuration(ms){const sec=Math.floor(ms/1000);return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0")}
export function freshSession(menuId){return {menuId,accumulated:0,runningSince:null,startedAt:null,memo:""}}
export function summarize(text,limit=44){
  const sentences=text.replace(/\s+/g," ").split(/[。！？\n]/).map(s=>s.trim()).filter(Boolean);
  const unique=[...new Set(sentences)];
  const candidates=unique.filter(s=>/意識|注意|感じ|コツ|ゆっくり|肋骨|腰|呼吸|力|背|肩|足/.test(s));
  const result=(candidates.length?candidates:unique).slice(-2).join("。");
  return result.length>limit?result.slice(0,limit-1)+"…":result;
}
