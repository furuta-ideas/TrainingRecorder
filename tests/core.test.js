import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {elapsed,toggle,formatDuration,freshSession,summarize} from "../dist/core.js";
test("停止時間を除き、複数回の再開時間を合算する",()=>{
  const s=freshSession("a");toggle(s,1000);assert.equal(elapsed(s,16000),15000);
  toggle(s,21000);assert.equal(elapsed(s,80000),20000);
  toggle(s,91000);toggle(s,121000);assert.equal(elapsed(s,999000),50000);
  assert.equal(s.startedAt,1000);assert.equal(formatDuration(elapsed(s)),"00:50");
});
test("再読み込み後も保存した開始時刻から計測を継続できる",()=>{
  const s=freshSession("a");toggle(s,1000);const restored=JSON.parse(JSON.stringify(s));
  assert.equal(elapsed(restored,62000),61000);assert.equal(formatDuration(elapsed(restored,62000)),"01:01");
});
test("気づきを短くまとめ、重複を除く",()=>{
  assert.equal(summarize("腰を反らさない。腰を反らさない。"),"腰を反らさない");
  assert.ok(summarize("背中を意識しながらゆっくりと動く".repeat(10),30).length<=30);
});
test("Notionの15種目・写真15点・動画11点が揃い、教材は実在する",()=>{
  const {menus}=JSON.parse(readFileSync(new URL("../dist/menus.json",import.meta.url)));
  assert.equal(menus.length,15);assert.equal(new Set(menus.map(m=>m.id)).size,15);
  assert.equal(menus.flatMap(m=>m.images).length,15);assert.equal(menus.filter(m=>m.video).length,11);
  for(const menu of menus){
    assert.ok(menu.name&&menu.prescription&&menu.durationNote);
    for(const asset of [...menu.images,...(menu.video?[menu.video]:[])])assert.ok(statSync(new URL("../dist/"+asset.src,import.meta.url)).size>1000);
  }
});
