import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const extract=(s,n)=>{const m=s.match(new RegExp('^function '+n+'\\(', 'm'));return s.slice(m.index,s.indexOf('\n}',m.index)+2)};
for(const file of ['../raidlead-panel.html','public/raidlead-panel.html']){
 const s=fs.readFileSync(file,'utf8');const c=vm.createContext({currentRaidKey:'zg',currentGuildInfo:{layout:{}},currentGuildSlug:()=> 'lichtloot'});
 for(const n of ['isAllowedP0Raid','isPlainP0Raid'])vm.runInContext(extract(s,n),c);
 assert.equal(c.isAllowedP0Raid(),true);assert.equal(c.isPlainP0Raid(),false);
 c.currentGuildInfo.layout={lootPageSectionsByRaid:{zg:{p0Plus:false}}};assert.equal(c.isAllowedP0Raid(),false);
 c.currentGuildInfo.layout={};c.currentGuildSlug=()=> 'other';assert.equal(c.isAllowedP0Raid(),false);assert.equal(c.isPlainP0Raid(),true);
 c.currentRaidKey='zg-late';assert.equal(c.isAllowedP0Raid(),true);
}
console.log('Normal ZG: shared guild P0+, disabled configuration and other guild separation passed');
const server=fs.readFileSync('src/server.js','utf8');const m=server.match(/^async function resolveZgPointTarget\(/m);const fn=server.slice(m.index,server.indexOf('\n}',m.index)+2);const c=vm.createContext({normalizeRaidType:v=>v});vm.runInContext(fn,c);
let guild='lichtloot';const client={query:async sql=>({rows:sql.includes('select slug')?[{slug:guild}]:[]})};
assert.equal(await c.resolveZgPointTarget(client,'g',{raid_type:'zg',raid_date:'2026-09-17'},'zg'),'zg');
guild='nachtloot';assert.equal(await c.resolveZgPointTarget(client,'g',{raid_type:'zg',raid_date:'2026-09-16'},'zg'),'zg-mittwoch');
console.log('Shared Lichtbringer ZG and Nachtwächter Wednesday targets remain distinct');
