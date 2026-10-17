import test from 'node:test';
import assert from 'node:assert/strict';
import {timerSeconds,applyMenuOrder} from '../dist/training.js';
test('時間指定をセット数込みの秒数へ変換し、未指定は60秒・個別設定を優先する',()=>{
 assert.equal(timerSeconds({prescription:'2セット × 30秒',durationNote:''}),60);
 assert.equal(timerSeconds({prescription:'1セット × 1分',durationNote:''}),60);
 assert.equal(timerSeconds({prescription:'２セット × １０回',durationNote:'時間指定なし'}),60);
 assert.equal(timerSeconds({prescription:'1セット × 10回'},{timerSeconds:7}),7);
 assert.equal(timerSeconds({prescription:'1分'},{timerSeconds:0}),0);
});
test('保存した順番を適用し、新しいメニューを失わず末尾へ追加する',()=>{
 const menus=[{id:'a'},{id:'b'},{id:'c'}];assert.deepEqual(applyMenuOrder(menus,['b','a']).map(m=>m.id),['b','a','c']);assert.deepEqual(menus.map(m=>m.id),['a','b','c']);
});
