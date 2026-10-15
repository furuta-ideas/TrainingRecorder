import {formatDuration} from "./core.js";
export const REPORT_RECIPIENT="furuta.ideas@gmail.com";
const zone="Asia/Tokyo";
const dateParts=value=>Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(value)).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
function dayKey(value){const p=dateParts(value);return p.year+p.month+p.day}
export function buildDailyReport(logs,now=Date.now()){
  const key=dayKey(now),p=dateParts(now);
  const entries=logs.filter(log=>Number.isFinite(log.startedAt)&&Number.isFinite(log.duration)&&log.duration>=0&&dayKey(log.startedAt)===key).sort((a,b)=>a.startedAt-b.startedAt);
  const total=entries.reduce((sum,log)=>sum+log.duration,0);
  const lines=["R-Bodyトレーニング記録",p.year+"/"+p.month+"/"+p.day+" 本日のトレーニング内容","記録数："+entries.length+"件","合計実施時間："+formatDuration(total),"",""];
  entries.forEach((log,index)=>{
    const parts=dateParts(log.startedAt),time=new Intl.DateTimeFormat("ja-JP",{timeZone:zone,hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(log.startedAt));
    lines.push((index+1)+". "+log.name,Number(parts.month)+"/"+Number(parts.day)+" "+time,"気づき："+(log.memo?.trim()||"気づきメモなし"),"実施時間："+formatDuration(log.duration),"────────────────────","");
  });
  return {to:REPORT_RECIPIENT,subject:key+" 本日のトレーニング内容",body:lines.join("\r\n").trim(),count:entries.length,totalDuration:total,dateKey:key};
}
