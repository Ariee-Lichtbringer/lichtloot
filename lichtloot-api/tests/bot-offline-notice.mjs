import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {collectOfflineTargets, queueOfflineNotice, OFFLINE_MESSAGE, UPDATE_MESSAGE, recoveryTargets, queueOnlineNotice, onlineNoticeContent} from '../src/bot-offline-notice.js';
const {PGlite}=await import(process.env.PGLITE_MODULE);
const db=new PGlite();
await db.exec(`create table bot_update_queue(id uuid default gen_random_uuid(),guild_id uuid,type text,payload jsonb,status text,created_at timestamptz default now());`);
let fail=false,released=0;
const pool={connect:async()=>({query:async(sql,args)=>{
 if(sql.includes('pg_advisory_xact_lock'))return {rows:[]};
 if(fail&&sql.startsWith('insert'))throw Error('simulated database failure');
 return db.query(sql,args);
},release:()=>released++})};
const guildId='00000000-0000-0000-0000-000000000001';
const guilds=[{guildId,slug:'lichtloot',discordGuildId:'99',layout:{worldbuffChannelId:'123',raidAnnouncementChannelId:'123',p0PlusBackupChannelId:'456',logSourceChannelId:'999'}}];
const targets=collectOfflineTargets(guilds,[{guild_id:guildId,channel_id:'789',bot:'po'},{guild_id:guildId,channel_id:'555',bot:'po'}],[{channel_id:'555',discord_guild_id:'88'}]);
assert.deepEqual(targets.map(t=>t.channelId),['123','456','789']);
assert.equal(targets[0].bot,'lichtbuff');
assert.equal((await queueOfflineNotice(pool,targets,guildId)).channelCount,3);
assert.equal((await queueOfflineNotice(pool,targets,guildId)).alreadyQueued,true);
assert.equal((await db.query('select * from bot_update_queue')).rows.length,3);
await db.exec("update bot_update_queue set status='done',created_at=now()-interval '6 minutes'");
fail=true;await assert.rejects(()=>queueOfflineNotice(pool,targets,guildId),/simulated/);
assert.equal((await db.query('select * from bot_update_queue')).rows.length,3);
fail=false;assert.equal((await queueOfflineNotice(pool,targets,guildId)).queued,true);
assert.equal(released,4);
const otherGuildId='00000000-0000-0000-0000-000000000002';
const otherTargets=targets.map(t=>({...t,guildId:otherGuildId,guildSlug:'nachtloot'}));
assert.equal((await queueOfflineNotice(pool,otherTargets,otherGuildId)).queued,true);
assert.equal((await queueOfflineNotice(pool,targets,guildId,'update')).queued,true);
assert.equal((await queueOfflineNotice(pool,targets,guildId,'update')).alreadyQueued,true);
await assert.rejects(()=>queueOfflineNotice(pool,otherTargets,guildId),/anderen Gilde/);
await assert.rejects(()=>queueOfflineNotice(pool,targets,guildId,'invalid'),/Unbekannter/);
const updateRows=(await db.query("select payload from bot_update_queue where payload->>'noticeKind'='update'")).rows;
assert.equal(updateRows.length,3);
assert.equal(updateRows[0].payload.content,UPDATE_MESSAGE);
assert.match(UPDATE_MESSAGE,/GuildLoot ist gerade nicht erreichbar/);
assert.doesNotMatch(UPDATE_MESSAGE,/weiterhin möglich|2 Stunden/);
assert.match(OFFLINE_MESSAGE,/\*\*2 Stunden offline\*\*/);
const server=fs.readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
const route=server.slice(server.indexOf('if (["guildPreviewBotOfflineNotice"'),server.indexOf('if (action === "lichtbotListGuilds")',server.indexOf('const postParams =')));
assert.ok(route.indexOf('requireMasterCodeForGuild')>=0);
assert.ok(route.indexOf('requireMasterCodeForGuild')<route.indexOf('const settings'));
assert.ok(route.includes('requireExplicitGuildSlug(postParams.guild)'));
assert.ok(!route.includes('listGuildsForBot'));
// Execute the real authorization function with independent guild codes.
const authSource=server.slice(server.indexOf('function requireMasterCodeForGuild('),server.indexOf('function requireRaidleadP0MasterCodeForGuild('));
const auth=vm.createContext({clean:v=>String(v||'').trim(),masterCode:'platform',defaultGuildSlug:'lichtloot',masterCodeOverrides:new Map([[guildId,'guild-one'],[otherGuildId,'guild-two']]),worldbuffAccessCodeOverrides:new Map([[guildId,'buff-only']])});
vm.runInContext(authSource,auth);
auth.requireMasterCodeForGuild({id:guildId,slug:'lichtloot'},'guild-one','guildQueueBotOfflineNotice');
assert.throws(()=>auth.requireMasterCodeForGuild({id:otherGuildId,slug:'nachtloot'},'guild-one','guildQueueBotOfflineNotice'));
assert.throws(()=>auth.requireMasterCodeForGuild({id:guildId,slug:'lichtloot'},'buff-only','guildQueueBotOfflineNotice'));
assert.throws(()=>auth.requireMasterCodeForGuild({id:guildId,slug:'lichtloot'},'','guildQueueBotOfflineNotice'));
for(const rel of ['../../gildenleitung.html','../../gildenleitung-public.html','../../loot/gildenleitung.html','../public/gildenleitung.html','../public/loot/gildenleitung.html','../src/gildenleitung.html']){
 const html=fs.readFileSync(new URL(rel,import.meta.url),'utf8');
 assert.ok(html.includes("openBotOfflineNotice('update')"));
 assert.ok(!html.includes('platformQueueBotOfflineNotice'));
 assert.equal((html.match(/async function openBotOfflineNotice\(/g)||[]).length,1);
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) if(match[1].trim())new vm.Script(match[1]);
}

// Durable message IDs survive restarts; restoration queues edits only.
await db.exec("delete from bot_update_queue; alter table bot_update_queue add column resolved_at timestamptz");
await queueOfflineNotice(pool,targets,guildId,'bot');
assert.equal((await recoveryTargets({query:(sql,args)=>db.query(sql,args)},guildId,'bot')).pending,true);
await assert.rejects(()=>queueOnlineNotice(pool,guildId,'bot'),/noch zugestellt/);
const originalRows=(await db.query('select * from bot_update_queue')).rows;
const resolverSource=server.slice(server.indexOf('async function resolveBotQueue('),server.indexOf('async function claimBotQueue('));
const resolver=vm.createContext({clean:v=>String(v||'').trim(),isUuid:()=>true,requireMasterOrQueueToken:()=>{},query:(sql,args)=>db.query(sql,args)});
vm.runInContext(resolverSource,resolver);
for (const [index,row] of originalRows.entries()) await resolver.resolveBotQueue({guildId,query:{rowNumber:row.id,messageId:String(9000+index)}});
const restored=await queueOnlineNotice(pool,guildId,'bot');
assert.equal(restored.channelCount,3);
const edits=(await db.query("select * from bot_update_queue where payload->>'editOnly'='true'")).rows;
assert.equal(edits.length,3);
for (const row of edits) {
 assert.equal(row.payload.content,'✅ **PO Bot ist wieder erreichbar.**');
 assert.ok(originalRows.some(original=>original.id===row.payload.sourceQueueId));
 assert.match(row.payload.messageId,/^900[0-2]$/);
}
assert.equal((await queueOnlineNotice(pool,guildId,'bot')).alreadyQueued,true);
await assert.rejects(()=>queueOnlineNotice(pool,otherGuildId,'bot'),/Keine gespeicherte/);
await assert.rejects(()=>queueOnlineNotice(pool,guildId,'update'),/Keine gespeicherte/);
assert.equal(onlineNoticeContent('update'),'✅ **GuildLoot ist wieder erreichbar.**');
// Even a completed original job without a message ID must not create a post.
await db.exec("delete from bot_update_queue");
await queueOfflineNotice(pool,targets,guildId,'update');
await db.exec("update bot_update_queue set status='done'");
await assert.rejects(()=>queueOnlineNotice(pool,guildId,'update'),/Keine gespeicherte/);
await db.close();console.log('Offline notice: channel selection, deduplication, cooldown, rollback, guild authorization, separate message types, durable message IDs, recovery edits, missing-ID protection and all six UI scripts passed.');
