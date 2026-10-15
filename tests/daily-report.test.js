import test from "node:test";
import assert from "node:assert/strict";
import {buildDailyReport} from "../dist/daily-report.js";
test("日本時間の当日だけを抽出し、日時順に本文と指定件名へ変換する",()=>{
  const logs=[
    {name:"ブリッジ",startedAt:Date.parse("2026-10-15T01:00:00Z"),duration:120000,memo:"腰を反らさない"},
    {name:"前日",startedAt:Date.parse("2026-10-14T14:59:59Z"),duration:999000,memo:"除外"},
    {name:"呼吸",startedAt:Date.parse("2026-10-14T15:00:00Z"),duration:60000,memo:""},
    {name:"翌日",startedAt:Date.parse("2026-10-15T15:00:00Z"),duration:999000,memo:"除外"}
  ];
  const report=buildDailyReport(logs,Date.parse("2026-10-15T02:00:00Z"));
  assert.equal(report.to,"furuta.ideas@gmail.com");
  assert.equal(report.subject,"20261015 本日のトレーニング内容");
  assert.equal(report.count,2);assert.equal(report.totalDuration,180000);
  assert.match(report.body,/合計実施時間：03:00/);
  assert.match(report.body,/10\/15 00:00:00/);
  assert.ok(report.body.indexOf("1. 呼吸")<report.body.indexOf("2. ブリッジ"));
  assert.match(report.body,/気づき：腰を反らさない/);assert.doesNotMatch(report.body,/前日|翌日|除外/);
});
test("当日の記録がない場合を判別できる",()=>{
  assert.equal(buildDailyReport([],Date.parse("2026-10-15T02:00:00Z")).count,0);
});
