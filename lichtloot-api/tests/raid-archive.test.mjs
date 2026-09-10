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
assert.match(calls[1].sql,/guild_id=\$1/);assert.match(calls[1].sql,/raid_date < timezone/);assert.deepEqual(calls.at(-1).args,['guild-a','internal']);
({result,calls}=await request({logsExist:false}));assert.equal(result.hasLootLog,false);assert.deepEqual(result.loot,[]);assert.equal(calls.length,2);
assert.equal((await request({found:false})).status,404);
console.log('raid archive: scoped reads, safe fields, missing logs and deduplication OK');

assert.equal((await request({past:false,logsExist:false})).result.prios[0].p1,'gesetzt');
assert.equal((await request({past:false,published:true})).result.prios[0].p1,'Item');
assert.equal((await request({past:true})).result.prios[0].p1,'Item');

const {decorateLoot}=await import('../src/raid-archive.js');
const awards=[{player:'Ariee',server:'Everlook',p0Item:'Item',p0ItemReceived:true}];
const metadata=new Map([['1',{quality:'epic',iconUrl:'inv_test',type:'Armor',slot:'Head'}]]);
const gold=decorateLoot(archiveLoot([{sessionId:'a',receipts:[receipt]}]),awards,metadata);
assert.equal(gold[0].p0Received,true);assert.equal(gold[0].p0Recipient,'Ariee-Everlook');assert.equal(gold[0].quality,'epic');assert.equal(gold[0].category,'equipment');
assert.equal(decorateLoot(gold,[{...awards[0],p0ItemReceived:false}])[0].p0Received,false);
assert.equal(decorateLoot(gold,[{...awards[0],server:'Lakeshire'}])[0].p0Received,false);
assert.equal(decorateLoot(gold,[{...awards[0],p0Item:'Anderes Item'}])[0].p0Received,false);
assert.equal(decorateLoot(gold,[],new Map([['1',{type:'Trade Goods'}]]))[0].category,'materials');
console.log('Confirmed P0 recipient+realm+item matching and item categories OK');
const {parseArchiveItemXml}=await import('../src/raid-archive-items.js');
assert.deepEqual(parseArchiveItemXml('<quality id="0">Poor</quality><class id="15">Misc</class><icon displayId="0">inv_shoulder_04</icon>'),{quality:0,itemClass:15,iconUrl:'inv_shoulder_04'});
assert.equal(parseArchiveItemXml('<html>Failed</html>'),null);
assert.equal(decorateLoot(gold,[],new Map([['1',{itemClass:7}]]))[0].category,'materials');
assert.equal(decorateLoot(gold,[],new Map([['1',{itemClass:2}]]))[0].category,'equipment');
assert.equal(decorateLoot(gold,[],new Map([['1',{itemClass:15,type:'Armor'}]]))[0].category,'other');

assert.match((await request()).calls[1].sql,/or exists \(select 1 from guildloot_era_logs/);
assert.match((await request()).calls[1].sql,/and not \(exists/);
assert.doesNotMatch((await request({logsExist:false})).calls[1].sql,/from guildloot_era_logs/);

const {includeConfirmedAwards}=await import('../src/raid-archive.js');
const confirmed={player:'Aeranor',server:'Everlook',p0Item:'Die zehrende Kälte',p1:'Die zehrende Kälte',p1ItemId:'23577',p0ItemReceived:true};
const added=includeConfirmedAwards([], [confirmed]);assert.equal(added.length,1);assert.equal(added[0].time,null);assert.equal(added[0].source,'confirmed_award');
assert.equal(includeConfirmedAwards(added,[confirmed]).length,1);
assert.equal(includeConfirmedAwards([],[{...confirmed,p0ItemReceived:false}]).length,0);
assert.equal(includeConfirmedAwards(added,[{...confirmed,server:'Lakeshire'}]).length,2);

assert.equal((await request({past:false,published:false})).result.prios[0].p1,'Item');
