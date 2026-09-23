import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {guildGame,provisionForeverGuild,foreverSetupReadiness} from '../src/guild-game-setup.js';
const {PGlite}=await import(process.env.FOREVER_PGLITE||'@electric-sql/pglite');
const era=new PGlite(),forever=new PGlite();
await forever.exec(await readFile(new URL('../src/forever-core.sql',import.meta.url),'utf8'));
const fq=(s,p=[])=>forever.query(s,p),eq=(s,p=[])=>era.query(s,p);
const fp={connect:async()=>({query:fq,release(){}})};
const source=await readFile(new URL('../src/server.js',import.meta.url),'utf8');
const extract=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
let eraWrites=0,failSourceCompletion=false;
const context=vm.createContext({URL,process,console,guildGame,provisionForeverGuild,foreverSetupReadiness,foreverPool:fp,foreverQuery:fq,
 query:async(s,p)=>{if(failSourceCompletion&&s.includes("set status='completed'"))throw Error('simulated source outage');return eq(s,p);},
 pool:{connect:async()=>({query:eq,release(){}})},
 clean:v=>String(v??'').trim(),normalizePin:v=>String(v??'').trim().toUpperCase(),lootSystem:v=>v==='dkp'?'dkp':'prio',
 buildLootSlug:(name,loot)=>String(loot||name).toLowerCase().replace(/[^a-z0-9]+/g,'-'),resolveGuildSlug:v=>v,
 guildLogoUrlForSlug:(_,url)=>url||'',ensureGuildDiscordConfigSchema:async()=>{},
 createGuild:async()=>{eraWrites++;throw Error('Era route reached');},evaluateGuildReadiness:async()=>({ready:false}),
 });
for(const [a,b] of [
 ['async function ensureGuildApplicationSchema()', 'async function getGuildApplications('],
 ['async function getGuildSetup(', 'async function requireCompletedGuildSetupToken('],
 ['async function completeGuildSetup(', 'function normalizePin(']
])vm.runInContext(extract(a,b),context);
const call=(name,...args)=>context[name](...args);
assert.equal(guildGame(),'era');assert.equal(guildGame('forever'),'forever');assert.throws(()=>guildGame('retail'));
const app=await call('submitGuildApplication',{query:{},body:{guildName:'Forever Guild',lootName:'sandbox',game:'forever',contactName:'Test',contactEmail:'test@example.invalid'}});
assert.equal(app.application.game,'forever');
const id=app.application.id;
await eq("update guild_applications set status='approved',setup_token='test-token' where id=$1",[id]);
assert.equal((await call('getGuildSetup',{query:{token:'test-token'}})).application.game,'forever');
await assert.rejects(call('completeGuildSetup',{query:{},body:{token:'test-token',guildPin:'ABC'}}),/mindestens 6/);
assert.equal((await fq('select count(*) from guilds')).rows[0].count,0);
const body={token:'test-token',guildPin:'SECURE123',game:'forever'};
failSourceCompletion=true;
await assert.rejects(call('completeGuildSetup',{query:{},body}),/source outage/);
assert.equal((await fq('select count(*) from guilds')).rows[0].count,1);
assert.equal((await eq('select setup_game from guild_applications where id=$1',[id])).rows[0].setup_game,'forever');
await assert.rejects(call('completeGuildSetup',{query:{},body:{...body,game:'era'}}),/andere Spielversion/);
failSourceCompletion=false;
const completed=await call('completeGuildSetup',{query:{},body});
assert.equal(completed.application.status,'completed');assert.equal(completed.application.game,'forever');assert.equal(eraWrites,0);
assert.equal((await fq('select count(*) from guilds')).rows[0].count,1);
assert.match(completed.startUrl,/forever-start/);assert.match(completed.leadershipUrl,/forever-leitung/);
assert.equal((await fq('select master_code from guild_master_codes')).rows[0].master_code,'SECURE123');
const reload=await call('getGuildSetup',{query:{token:'test-token'}});
assert.equal(reload.application.guildPin,'');assert.equal(reload.application.desiredGuildPin,'');assert.equal(reload.readiness.ready,true);
await assert.rejects(call('completeGuildSetup',{query:{},body}),/bereits abgeschlossen/);
const other=await call('submitGuildApplication',{query:{},body:{guildName:'Duplicate',lootName:'sandbox',game:'forever',contactName:'Test',contactEmail:'test@example.invalid'}});
await eq("update guild_applications set status='approved',setup_token='other-token' where id=$1",[other.application.id]);
await assert.rejects(call('completeGuildSetup',{query:{},body:{...body,token:'other-token'}}),/existiert bereits/);
assert.equal((await fq('select name from guilds')).rows[0].name,'Forever Guild');
const eraApp=await call('submitGuildApplication',{query:{},body:{guildName:'Era Guild',contactName:'Test',contactEmail:'test@example.invalid'}});
assert.equal(eraApp.application.game,'era');
await eq("update guild_applications set status='approved',setup_token='era-token' where id=$1",[eraApp.application.id]);
await assert.rejects(call('completeGuildSetup',{query:{},body:{token:'era-token',guildPin:'SECURE123'}}),/Era route reached/);
assert.equal(eraWrites,1);
await assert.rejects(provisionForeverGuild(null,{}),e=>e.statusCode===503);
await era.close();await forever.close();console.log('Guild game setup: persisted choice, legacy Era default, isolated Forever creation, leadership code, completed links, redaction, failed-commit retry, duplicate protection, destination freeze and unavailable DB passed.');
