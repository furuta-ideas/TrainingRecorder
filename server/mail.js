import {buildDailyReport} from "../dist/daily-report.js";
const json=(value,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store"}});
export async function handleDailyMail(request,env,sendFetch=fetch,now=Date.now()){
  if(request.method!=="POST")return json({error:"POSTで送信してください。"},405);
  const origin=new URL(request.url).origin;
  if(request.headers.get("Origin")!==origin)return json({error:"この画面から送信してください。"},403);
  const userId=request.headers.get("oai-authenticated-user-id");
  if(!userId)return json({error:"アプリにログインしてから送信してください。"},401);
  if(!request.headers.get("Content-Type")?.startsWith("application/json"))return json({error:"送信形式が正しくありません。"},415);
  if(Number(request.headers.get("Content-Length")||0)>500000)return json({error:"ログが大きすぎます。"},413);
  let data;
  try{const raw=await request.text();if(raw.length>500000)return json({error:"ログが大きすぎます。"},413);data=JSON.parse(raw)}catch{return json({error:"送信データを読み取れません。"},400)}
  if(!Array.isArray(data.logs)||data.logs.length>2000)return json({error:"ログの形式が正しくありません。"},400);
  const valid=data.logs.every(log=>log&&typeof log.name==="string"&&log.name.length<=200&&typeof log.memo==="string"&&log.memo.length<=20000&&Number.isFinite(log.startedAt)&&Number.isFinite(new Date(log.startedAt).getTime())&&Number.isFinite(log.duration)&&log.duration>=0&&log.duration<=86400000);
  if(!valid)return json({error:"ログの形式が正しくありません。"},400);
  const report=buildDailyReport(data.logs,now);
  if(!report.count)return json({error:"今日のトレーニング記録がありません。"},400);
  if(!env.RESEND_API_KEY)return json({error:"メール送信サービスが未設定です。記録は端末に保存されています。",code:"mail_not_configured"},503);
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify({userId,subject:report.subject,body:report.body})));
  const key="rbody-"+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
  let response;
  try{response=await sendFetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json","Idempotency-Key":key},body:JSON.stringify({from:env.R_BODY_MAIL_FROM||"R-Body <onboarding@resend.dev>",to:[report.to],subject:report.subject,text:report.body}),signal:AbortSignal.timeout(20000)})}
  catch{return json({error:"送信結果を確認できませんでした。記録は保存済みです。同じ内容で再試行できます。",code:"send_unknown"},502)}
  let result;try{result=await response.json()}catch{return json({error:"送信結果を確認できませんでした。記録は保存済みです。",code:"send_unknown"},502)}
  if(!response.ok||typeof result.id!=="string"){
    const error=response.status===401?"メール送信サービスのAPIキーをご確認ください。":response.status===403?"Resendの送信元・宛先の利用条件をご確認ください。":response.status===429?"送信が混み合っています。少し待って再試行してください。":"メールを送信できませんでした。記録は端末に保存されています。";
    return json({error,code:"send_failed"},502);
  }
  return json({status:"accepted",messageId:result.id,dateKey:report.dateKey,count:report.count});
}
