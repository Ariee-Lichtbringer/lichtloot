import assert from 'node:assert/strict';
import { buildPrioConfirmation, prioConfirmationMessage, queuePrioConfirmation, prioDmStatus } from '../src/prio-save-confirmation.js';
const base = {raid:{name:'Naxxramas',raid_date:new Date('2026-09-09T00:00:00Z'),raid_time:'19:45:00',raid_pin:'5AT'},character:{id:'char-a',player_id:'account-a',name:'Ariee'},items:[{name:'Formel: Brust – Große Werte'},{name:'Auge des Todes'},{name:'Band des neuen Lebens'}]};
for(const plus of [true,false]) {
 const result=buildPrioConfirmation({...base,p0Selected:true,p0Plus:plus,points:0});
 assert.equal(result.priorities.length,1);assert.equal(result.priorities[0].label,plus?'P0+':'P0');assert.equal(result.points,0);
 const message=prioConfirmationMessage(result);assert.match(message,/09\.09\.2026/);assert.match(message,/19:45/);assert.match(message,/5AT/);assert.match(message,/P0-Punkte.*\*\*0\*\*/);
}
const regular=buildPrioConfirmation({...base,p0Selected:false,points:999});
assert.deepEqual(regular.priorities.map(p=>p.label),['P1','P2','P3']);assert.equal(regular.points,null);assert.doesNotMatch(prioConfirmationMessage(regular),/P0-Punkte/);
assert.equal(buildPrioConfirmation({...base,items:[base.items[0]],p0Selected:false}).priorities.length,1);
assert.match(prioConfirmationMessage(buildPrioConfirmation({...base,p0Selected:true})),/nicht verfügbar/);
let calls=[];
const client={query:async(sql,args)=>{calls.push({sql,args});return {rows:calls.length===1?[{discord_user_id:'123456789'}]:[{id:'queue-1'}]};}};
assert.equal((await queuePrioConfirmation(client,{guildId:'guild-a',character:base.character,prioId:'prio-a',confirmation:regular})).queued,true);
assert.deepEqual(calls[0].args,['guild-a','account-a','char-a']);
assert.match(calls[0].sql,/d.guild_id=\$1 and p.guild_id=\$1/);assert.match(calls[1].sql,/30 seconds/);
const payload=JSON.parse(calls[1].args[1]);assert.equal(payload.discordUserId,'123456789');assert.equal(payload.prioSaveConfirmation,true);assert.doesNotMatch(calls.map(c=>c.sql).join(''),/player_messages/);
let missingCalls=0;
assert.equal((await queuePrioConfirmation({query:async()=>{missingCalls++;return {rows:[]};}},{guildId:'a',character:base.character,prioId:'p',confirmation:regular})).reason,'no_discord_link');assert.equal(missingCalls,1);
await assert.rejects(()=>prioDmStatus(async()=>({rows:[]}), 'other-guild',{messageId:'queue-1'}),/nicht gefunden/);
let statusArgs;
assert.equal((await prioDmStatus(async(sql,args)=>{statusArgs=args;assert.match(sql,/guild_id=\$1/);return {rows:[{payload:{deliveryStatus:'delivered'}}]};},'guild-a',{messageId:'queue-1'})).status,'delivered');assert.deepEqual(statusArgs,['guild-a','queue-1']);
console.log('Prio confirmation: P1–P3, P0, P0+, zero/missing points, recipient isolation, private queue and retry dedup passed.');
