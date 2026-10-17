import test from "node:test";
import assert from "node:assert/strict";
import {handleDailyMail} from "../server/mail.js";
const now=Date.parse("2026-10-15T03:00:00Z");
const logs=[{name:"呼吸",memo:"背中を丸める",startedAt:now-60000,duration:60000}];
function request(data={logs},extra={}){
  const headers={"Origin":"https://training.example","Content-Type":"application/json","oai-authenticated-user-id":"owner",...extra};
  return new Request("https://training.example/api/daily-report",{method:"POST",headers,body:JSON.stringify(data)});
}
test("未設定では送信せず明示的な503を返す",async()=>{
  let called=false;const r=await handleDailyMail(request(),{},async()=>{called=true},now);
  assert.equal(r.status,503);assert.equal((await r.json()).code,"mail_not_configured");assert.equal(called,false);
});
test("認証と同一オリジンを要求し、不正入力を拒否する",async()=>{
  assert.equal((await handleDailyMail(request({logs},{"oai-authenticated-user-id":""}),{},null,now)).status,401);
  assert.equal((await handleDailyMail(request({logs},{"Origin":"https://other.example"}),{},null,now)).status,403);
  assert.equal((await handleDailyMail(request({logs:[{...logs[0],duration:-1}]}),{},null,now)).status,400);
  assert.equal((await handleDailyMail(request({logs:[{...logs[0],startedAt:1e100}]}),{},null,now)).status,400);
});
test("固定宛先・日本時間の件名・プレーン本文で送信し同じ内容には同じ重複防止キーを使う",async()=>{
  const calls=[];
  const send=async(url,options)=>{calls.push({url,...options,body:JSON.parse(options.body)});return Response.json({id:"email_accepted"})};
  const env={RESEND_API_KEY:"test-only-secret",R_BODY_MAIL_FROM:"R-Body <sender@example.com>"};
  for(let i=0;i<2;i++){
    const r=await handleDailyMail(request({logs,to:"untrusted@example.com",subject:"ignored"}),env,send,now);
    assert.equal(r.status,200);assert.equal((await r.json()).status,"accepted");
  }
  assert.equal(calls[0].url,"https://api.resend.com/emails");
  assert.deepEqual(calls[0].body.to,["furuta.ideas@gmail.com"]);
  assert.equal(calls[0].body.subject,"20261015 本日のトレーニング内容");
  assert.match(calls[0].body.text,/背中を丸める/);
  assert.match(calls[0].body.text,/実施時間：01:00/);
  assert.equal(calls[0].headers["Idempotency-Key"],calls[1].headers["Idempotency-Key"]);
  assert.equal(calls[0].body.html,undefined);
});
test("送信サービスの拒否と不明な結果を成功として扱わない",async()=>{
  const env={RESEND_API_KEY:"test-only-secret"};
  const denied=await handleDailyMail(request(),env,async()=>Response.json({message:"denied"},{status:403}),now);
  assert.equal(denied.status,502);assert.equal((await denied.json()).code,"send_failed");
  const uncertain=await handleDailyMail(request(),env,async()=>{throw Error("timeout")},now);
  assert.equal(uncertain.status,502);assert.equal((await uncertain.json()).code,"send_unknown");
});
import {mailStatus} from '../server/mail.js';
test('設定診断はキー自体を返さず、認証済みユーザーに有無だけを返す',async()=>{
 const unauth=new Request('https://training.example/api/mail-status');assert.equal(mailStatus(unauth,{}).status,401);
 const req=new Request('https://training.example/api/mail-status',{headers:{'oai-authenticated-user-id':'owner'}});
 assert.deepEqual(await mailStatus(req,{}).json(),{configured:false});assert.deepEqual(await mailStatus(req,{RESEND_API_KEY:'not-exposed'}).json(),{configured:true});
});
