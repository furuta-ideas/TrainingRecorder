import test from 'node:test';
import assert from 'node:assert/strict';
import {trainingConfig} from '../dist/training-config.js';
import {normalizePlan,slotAt,applyMenuOrder} from '../dist/training.js';

test('15種目すべてに5秒単位の最大2分タイムラインを作る',()=>{
 assert.equal(trainingConfig.length,15);
 for(const menu of trainingConfig){
  const plan=normalizePlan(menu);assert.equal(plan.length,24);
  assert.equal(plan.filter(step=>step.active).length,menu.minutes*12);
 }
 assert.equal(trainingConfig.filter(menu=>menu.minutes===1).length,2);
});
test('経過時間を5秒単位の現在位置へ変換する',()=>{
 assert.equal(slotAt(0),0);assert.equal(slotAt(4999),0);assert.equal(slotAt(5000),1);assert.equal(slotAt(999999),23);
});
test('回数は丸数字で表示し、スタンバイ区間を識別できる',()=>{
 const shoulder=trainingConfig[1];
 assert.equal(shoulder.steps[2].top,'①');assert.equal(shoulder.steps[11].top,'⑩');
 assert.equal(shoulder.steps[0].bottom,'スタンバイ');
 assert.ok(trainingConfig.flatMap(menu=>menu.steps).filter(step=>step.top).every(step=>!/^[0-9]+$/.test(step.top)));
});
test('保存した順番を適用し、新規メニューを末尾に残す',()=>{
 const menus=[{id:'a'},{id:'b'},{id:'c'}];assert.deepEqual(applyMenuOrder(menus,['b','a']).map(m=>m.id),['b','a','c']);
});
