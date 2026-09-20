import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createForeverRaids,foreverSchema} from '../src/forever-raids.js';
import {createForeverAccess,foreverQuery} from '../src/forever-db.js';
const {PGlite}=await import(process.env.FOREVER_PGLITE||'@electric-sql/pglite');
const db=new PGlite();await db.exec(await readFile(new URL('../src/forever-core.sql',import.meta.url),'utf8'));await db.exec(foreverSchema);await db.exec(await readFile(new URL('../src/forever-loot.sql',import.meta.url),'utf8'));
const query=(s,p=[])=>p.length?db.query(s,p):db.exec(s).then(r=>r.at(-1));const pool={connect:async()=>({query,release(){}})};
const guild={id:randomUUID(),slug:'forever',name:'Lichtbringer'},other={id:randomUUID(),slug:'other',name:'Andere'},player=randomUUID(),foreign=randomUUID();
for(const g of [guild,other]){await query('insert into guilds(id,slug,name) values($1,$2,$3)',[g.id,g.slug,g.name]);await query('insert into guild_settings(guild_id,layout_json) values($1,$2)',[g.id,JSON.stringify({game:'forever',sourceGuild:'lichtloot'})]);}
await query('insert into guild_master_codes(guild_id,master_code) values($1,$2)',[guild.id,'TESTMASTER']);
for(const [id,gid] of [[player,guild.id],[foreign,other.id]])await query("insert into players(id,guild_id,player_pin) values($1,$2,'PRIVATE123')",[id,gid]);
const char=randomUUID();await query("insert into forever_characters(id,guild_id,player_id,name,ruleset,class_name,role) values($1,$2,$3,'Ariee Mondlichtung','normal','priest','heal')",[char,guild.id,player]);
const api=createForeverRaids({query,pool}),access=createForeverAccess(query),lead={canManage:true,canAdmin:true,label:'Leitung'};
await assert.rejects(access.requireGuild('era'),e=>e.statusCode===404);

await query("update players set approval_status='approved' where id=$1",[player]);
const member={playerId:player,label:'Spieler',canManage:false,canAdmin:false};
const call=(actor,action,body={})=>api.run(guild,actor,{action,...body});
const key=randomUUID();await call(lead,'pointAdjust',{characterId:char,amount:5,reason:'Manuelle Buchung',requestKey:key});await call(lead,'pointAdjust',{characterId:char,amount:5,reason:'Manuelle Buchung',requestKey:key});
let d=await call(lead,'operationsOverview');assert.equal(d.balances[0].points,'5.00');
await assert.rejects(call(member,'pointAdjust',{characterId:char,amount:50,reason:'Nein',requestKey:randomUUID()}),e=>e.statusCode===403);
await call(lead,'pointReverse',{id:d.journal[0].id,reason:'Korrektur'});await call(lead,'pointReverse',{id:d.journal[0].id,reason:'Korrektur'});d=await call(lead,'operationsOverview');assert.equal(Number(d.balances[0].points),0);assert.equal(d.journal.length,2);
await call(lead,'bankAdjust',{name:'Trank',amount:3,reason:'Einlage',requestKey:randomUUID()});d=await call(member,'operationsOverview');const item=d.items[0].id;
await call(member,'bankRequest',{itemId:item,quantity:2,reason:'Raid'});d=await call(lead,'operationsOverview');await call(lead,'bankDecision',{id:d.requests[0].id,status:'approved'});await assert.rejects(call(lead,'bankDecision',{id:d.requests[0].id,status:'approved'}),e=>e.statusCode===409);
assert.equal((await call(lead,'operationsOverview')).items[0].quantity,1);await assert.rejects(call(lead,'bankAdjust',{name:'Trank',amount:-2,reason:'Entnahme',requestKey:randomUUID()}),e=>e.statusCode===409);
await call(member,'mailCreate',{subject:'Anfrage',message:'Testnachricht'});d=await call(lead,'operationsOverview');await call(lead,'mailReply',{id:d.mail[0].id,reply:'Erledigt',status:'closed'});assert.equal((await call(member,'operationsOverview')).mail[0].reply,'Erledigt');
const otherResult=await api.run(other,{playerId:foreign,canManage:false},{action:'operationsOverview'});assert.equal(otherResult.items.length,0);assert.equal(otherResult.mail.length,0);

const raid=(await call(lead,'saveRaid',{title:'Lootabend',kind:'hyjal',date:'2099-01-01',time:'20:00',size:20,tanks:2,heals:4})).id;
await call(lead,'lootItemSave',{kind:'hyjal',itemId:123,name:'Testgegenstand',p0:true});
await assert.rejects(call(member,'lootItemSave',{kind:'hyjal',itemId:1,name:'Falsch'}),e=>e.statusCode===403);
await call(member,'signup',{raidId:raid,characterId:char,role:'heal',status:'signed'});
await call(member,'prioritySave',{raidId:raid,characterId:char,priorities:[{priority:1,itemId:123}]});
assert.equal((await call(member,'lootOverview',{kind:'hyjal',raidId:raid})).priorities.length,1);
await assert.rejects(call(member,'prioritySave',{raidId:raid,characterId:char,priorities:[{priority:1,itemId:123},{priority:2,itemId:123}]}),/einmal/);
const award={raidId:raid,characterId:char,itemId:123,reason:'Zuteilung',requestKey:randomUUID()};
await assert.rejects(call(lead,'lootAward',award),e=>e.statusCode===409);
await call(lead,'attendance',{raidId:raid,characterId:char,attendance:'present'});await call(lead,'lootAward',award);await call(lead,'lootAward',award);
assert.equal((await call(lead,'lootOverview',{kind:'hyjal',raidId:raid})).awards.length,1);

await assert.rejects(call(member,'prioritySave',{raidId:raid,characterId:char,priorities:[{priority:0,itemId:123}]}),e=>e.statusCode===403);
await call(lead,'p0Approval',{raidId:raid,characterId:char,approved:true});await call(member,'prioritySave',{raidId:raid,characterId:char,priorities:[{priority:0,itemId:123}]});
await call(lead,'formation',{raidId:raid,characterId:char,party:1});assert.equal((await call(member,'overview')).raids.find(r=>r.id===raid).signups[0].party,1);
await assert.rejects(call(member,'formation',{raidId:raid,characterId:char,party:2}),e=>e.statusCode===403);
const loot=(await call(lead,'lootOverview',{kind:'hyjal',raidId:raid})).awards[0];await call(lead,'lootVoid',{raidId:raid,characterId:char,id:loot.id,reason:'Korrektur'});assert.equal((await call(lead,'lootOverview',{kind:'hyjal',raidId:raid})).awards[0].void_reason,'Korrektur');
await db.close();console.log('Operations passed: authorization, guild isolation, idempotent points, reversals, inventory capacity, one-time approval, private mailbox.');
