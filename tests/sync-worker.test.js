import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../sync-worker/worker.js';

const KEY='a'.repeat(64),URL_BASE='https://sync.example/state/';
function fakeEnv(){const map=new Map();return {SYNC:{get:async(k,type)=>map.has(k)?(type==='json'?JSON.parse(map.get(k)):map.get(k)):null,put:async(k,v)=>{map.set(k,v)}}}}
const put=(env,body,key=KEY)=>worker.fetch(new Request(URL_BASE+key,{method:'PUT',body:JSON.stringify(body)}),env);
const get=(env,key=KEY)=>worker.fetch(new Request(URL_BASE+key),env);

test('保存した並び順とメモを別端末から取得できる',async()=>{
 const env=fakeEnv();assert.equal((await get(env)).status,404);
 const saved=await put(env,{order:['b','a'],edits:{a:{name:'名前',memo:'メモ'}},updatedAt:100,extra:'x'});
 assert.equal(saved.status,200);
 const res=await get(env);assert.equal(res.status,200);
 assert.deepEqual(await res.json(),{order:['b','a'],edits:{a:{name:'名前',memo:'メモ'}},updatedAt:100});
});
test('古い内容では新しい内容を上書きせず、保存済みの内容を返す',async()=>{
 const env=fakeEnv();await put(env,{order:['a'],edits:{},updatedAt:200});
 const res=await put(env,{order:['b'],edits:{},updatedAt:100});assert.equal(res.status,409);
 const body=await res.json();assert.equal(body.conflict,true);assert.deepEqual(body.state.order,['a']);
 assert.equal((await put(env,{order:['c'],edits:{},updatedAt:300})).status,200);
});
test('不正なキーや内容を拒否し、公開サイトからのアクセスを許可する',async()=>{
 const env=fakeEnv();
 assert.equal((await get(env,'short')).status,404);
 assert.equal((await put(env,{order:'x',updatedAt:1})).status,400);
 const res=await worker.fetch(new Request(URL_BASE+KEY,{method:'OPTIONS',headers:{Origin:'https://furuta-ideas.github.io'}}),env);
 assert.equal(res.status,204);assert.equal(res.headers.get('Access-Control-Allow-Origin'),'https://furuta-ideas.github.io');
});
