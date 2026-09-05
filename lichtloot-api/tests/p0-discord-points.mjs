import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
const start=source.indexOf('async function enrichP0SignupPoints(');
const fn=source.slice(start,source.indexOf('\n}\n',start)+2);
const calls=[];
const ctx=vm.createContext({
 clean:v=>String(v??'').trim(),normalizeRaidType:v=>String(v).toLowerCase(),
 itemLookupKey:v=>String(v).toLowerCase(),
 getP0Plus:async(guild,{raid})=>{calls.push([guild,raid]);return {entries:[
  {raid:'zg',player:'Sieglînde',server:'Lakeshire',item:'Götze',points:1},
  {raid:'zg-late',player:'Sieglînde',server:'Lakeshire',item:'Götze',points:3},
  {raid:'zg-prime',player:'Sieglînde',server:'Lakeshire',item:'Götze',points:8},
  {raid:'zg-late',player:'Other',server:'Everlook',item:'Mount',points:20},
  {raid:'zg-late',player:'Twin',server:'Everlook',item:'Mount',points:4},
  {raid:'zg-late',player:'Twin',server:'Lakeshire',item:'Mount',points:7}
 ]};}
});
vm.runInContext(fn,ctx);
const rows=await ctx.enrichP0SignupPoints('guild',[
 {player:'Sieglînde',server:'Lakeshire',item:'Götze',p0plus_points:1},
 {player_name:'Sieglînde',server:'Lakeshire',item_name:'Götze',p0plus_points:0},
 {player:'Other',item:'Mount',p0PlusPoints:0},
 {player:'Twin',item:'Mount'},
 {player:'Twin',server:'Lakeshire',item:'Mount'},
 {player:'Unknown',server:'Everlook',item:'Mount',p0plus_points:99}
],'zg-late');
assert.deepEqual(Array.from(rows,r=>r.p0plus_points),[3,3,20,0,7,0]);
assert.deepEqual(calls,[['guild','zg-late']]);
const prime=await ctx.enrichP0SignupPoints('guild',[rows[0]],'zg-prime');
assert.equal(prime[0].p0plus_points,8);
assert.match(source,/enrichP0SignupPoints\(guildId, \[\.\.\.combinedSignupRows.values\(\)\], raid.raid_type\)/);
console.log('Discord point lookup: fresh raid-scoped totals, stale nonzero/zero overrides, all signup sources and realm isolation passed.');
