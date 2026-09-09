import assert from 'node:assert/strict';
import {archiveLoot,installRaidArchive} from '../src/raid-archive.js';
const receipt={id:'r1',recipient:'Ariee-Everlook',itemId:1,itemName:'Item',quantity:1,observedAt:100,secret:'private'};
assert.deepEqual(archiveLoot([{sessionId:'a',receipts:[receipt,receipt]},{sessionId:'b',receipts:[receipt]}]).length,2);
assert.equal(archiveLoot([{sessionId:'a',receipts:[receipt]}])[0].secret,undefined);
async function request({logsExist=true,found=true,past=true,published=false}={}){
 let handler;const calls=[];
 installRaidArchive({get:(path,fn)=>handler=fn},{resolveGuildSlug:s=>s,requireGuild:async()=>({id:'guild-a'}),
 query:async(sql,args)=>{calls.push({sql,args});if(sql.includes('from raids'))return {rows:found?[{id:'internal',external_raid_id:'raid-a',raid_date:'2026-09-08',raid_type:'aq40',past}]:[]};if(sql.includes('to_regclass'))return {rows:[{logs:logsExist?'guildloot_era_logs':null}]};return {rows:[{payload:{sessionId:'a',receipts:[receipt],token:'secret'}}]};},
 getPublishedPrios:async({guildId,query})=>{assert.equal(guildId,'guild-a');assert.equal(query.raidId,'raid-a');return {published,prios:[{player:'Ariee',p1:'Item',leadPin:'private'}]};}});
 let result,status=200;
 await handler({query:{guild:'lichtloot',raidId:'raid-a'}},{setHeader(){},status(n){status=n;return this;},json(data){result=data;}},error=>{throw error;});
 return {result,calls,status};
}
let {result,calls}=await request();assert.equal(result.hasLootLog,true);assert.equal(result.loot.length,1);assert.equal(result.prios[0].leadPin,undefined);
assert.match(calls[0].sql,/guild_id=\$1/);assert.match(calls[0].sql,/raid_date < timezone/);assert.deepEqual(calls.at(-1).args,['guild-a','internal']);
({result,calls}=await request({logsExist:false}));assert.equal(result.hasLootLog,false);assert.deepEqual(result.loot,[]);assert.equal(calls.length,2);
assert.equal((await request({found:false})).status,404);
console.log('raid archive: scoped reads, safe fields, missing logs and deduplication OK');

assert.equal((await request({past:false})).result.prios[0].p1,'gesetzt');
assert.equal((await request({past:false,published:true})).result.prios[0].p1,'Item');
assert.equal((await request({past:true})).result.prios[0].p1,'Item');
