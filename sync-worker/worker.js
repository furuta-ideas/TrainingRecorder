// 端末間共有用の小さな保存API（Cloudflare Worker + KV）。
// GET /state/<key> で取得、PUT /state/<key> で保存。<key> は合言葉のSHA-256（16進64桁）。
const ALLOWED_ORIGINS=['https://furuta-ideas.github.io'];
const MAX_BODY=64*1024;

function corsHeaders(request){
 const origin=request.headers.get('Origin')||'';
 const ok=ALLOWED_ORIGINS.includes(origin)||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
 return {'Access-Control-Allow-Origin':ok?origin:ALLOWED_ORIGINS[0],'Access-Control-Allow-Methods':'GET,PUT,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400','Vary':'Origin','Cache-Control':'no-store'};
}
function json(request,status,body){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders(request),'Content-Type':'application/json; charset=utf-8'}})}

// 保存する内容を、アプリが使う形（並び順・編集内容・更新時刻）だけに絞る
export function sanitizeState(input){
 if(!input||typeof input!=='object')return null;
 const updatedAt=Number(input.updatedAt);
 if(!Array.isArray(input.order)||!Number.isFinite(updatedAt)||updatedAt<0)return null;
 const order=input.order.filter(id=>typeof id==='string'&&id.length<=100).slice(0,100),edits={};
 if(input.edits&&typeof input.edits==='object'){
  for(const [id,edit] of Object.entries(input.edits).slice(0,100)){
   if(id.length>100||!edit||typeof edit!=='object')continue;
   edits[id]={name:String(edit.name??'').slice(0,80),memo:String(edit.memo??'').slice(0,500)};
  }
 }
 return {order,edits,updatedAt};
}

export default {
 async fetch(request,env){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders(request)});
  const match=/^\/state\/([0-9a-f]{64})$/.exec(new URL(request.url).pathname);
  if(!match)return json(request,404,{error:'not_found'});
  const key='state:'+match[1];
  if(request.method==='GET'){
   const stored=await env.SYNC.get(key,'json');
   return stored?json(request,200,stored):json(request,404,{error:'no_data'});
  }
  if(request.method==='PUT'){
   const text=await request.text();
   if(text.length>MAX_BODY)return json(request,413,{error:'too_large'});
   let state=null;try{state=sanitizeState(JSON.parse(text))}catch{}
   if(!state)return json(request,400,{error:'invalid_state'});
   // 古い端末の内容で新しい内容を上書きしない
   const stored=await env.SYNC.get(key,'json');
   if(stored&&stored.updatedAt>state.updatedAt)return json(request,409,{conflict:true,state:stored});
   await env.SYNC.put(key,JSON.stringify(state));
   return json(request,200,state);
  }
  return json(request,405,{error:'method_not_allowed'});
 }
};
