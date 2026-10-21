import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';

test('15種目・写真15点・動画11点の教材が揃う',()=>{
 const {menus}=JSON.parse(readFileSync(new URL('../dist/menus.json',import.meta.url)));
 assert.equal(menus.length,15);assert.equal(new Set(menus.map(menu=>menu.id)).size,15);
 assert.equal(menus.flatMap(menu=>menu.images).length,15);assert.equal(menus.filter(menu=>menu.video).length,11);
 for(const menu of menus)for(const asset of [...menu.images,...(menu.video?[menu.video]:[])])assert.ok(statSync(new URL('../dist/'+asset.src,import.meta.url)).size>1000);
});
