import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();
const src=fs.readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
const extract=name=>{const m=src.match(new RegExp('^(?:async )?function '+name+'\\(','m'));assert.ok(m,name);return src.slice(m.index,src.indexOf('\n}\n',m.index)+2);};
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`,guild=id(1);
await db.exec(`create table raids(id uuid,guild_id uuid,external_raid_id text,raid_date date,raid_time text,raid_pin text,player_link text,discord_channel_id text,deleted_at timestamptz,prio_enabled boolean,status text);
create table bot_update_queue(id uuid,guild_id uuid,type text,status text,payload jsonb,created_at timestamptz default now(),resolved_at timestamptz);`);
const run=(sql,args)=>db.query(sql,args);let queued=[];
const ctx=vm.createContext({query:run,clean:v=>String(v||'').trim(),raidPublicId:r=>r.external_raid_id||r.id,enqueueBotUpdate:async x=>{queued.push(x);return {success:true};}});
for(const n of ['activePrioReminderRaidSql','currentPrioReminderQueueSql','expireStalePrioReminders','isCurrentRaidForPrioReminder','enqueueRaidMissingPrioReminderRefresh'])vm.runInContext(extract(n),ctx);
for(let n=10;n<19;n++){
 await db.query(`insert into raids values($1,$2,$3,$4,$5,'PIN','','123',null,true,'geöffnet')`,[id(n),guild,'raid'+n,n===10?'2000-01-01':'2099-01-01',n===13?'invalid':'22:00']);
 const payload={raidId:'raid'+n,raidDate:n===10?'2000-01-01':'2099-01-01',raidTime:'22:00',prioPin:'PIN',channelId:'123',messageId:'456',trackedCharacters:['Player'],completedCharacters:[]};
 if(n===14)payload.raidDate='2098-01-01';if(n===15)payload.prioPin='OLD';if(n===16)payload.channelId='999';if(n===18)payload.raidId='missing';
 await db.query('insert into bot_update_queue(id,guild_id,type,status,payload) values($1,$2,\'raid_missing_prio_reminder\',$3,$4)',[id(n+100),guild,n===10?'processing':'open',JSON.stringify(payload)]);
}
await db.query("update raids set status='archiviert' where id=$1",[id(11)]);
await db.query('update raids set deleted_at=now() where id=$1',[id(12)]);
// Cleanup must leave unrelated jobs and other guilds intact.
await db.query("insert into bot_update_queue(id,guild_id,type,status,payload) values($1,$2,'po_post','open','{}'),($3,$4,'raid_missing_prio_reminder','open','{}')",[id(500),guild,id(501),id(2)]);
assert.equal(await ctx.isCurrentRaidForPrioReminder(guild,id(10)),false);
assert.equal(await ctx.isCurrentRaidForPrioReminder(guild,id(17)),true);
const old=await ctx.enqueueRaidMissingPrioReminderRefresh(guild,{id:id(10),external_raid_id:'raid10'},'Player');assert.equal(old.skipped,true);assert.equal(queued.length,0);
await ctx.expireStalePrioReminders(guild);
const remaining=(await db.query("select id from bot_update_queue where status='open' order by id")).rows.map(x=>x.id);
assert.deepEqual(remaining,[id(117),id(500),id(501)]);
assert.equal((await db.query('select payload from bot_update_queue where id=$1',[id(110)])).rows[0].payload.skipReason,'raid_reminder_expired_or_changed');
await ctx.enqueueRaidMissingPrioReminderRefresh(guild,{id:id(17),external_raid_id:'raid17'},'Player');assert.equal(queued.length,1);assert.equal(queued[0].payload.editOnly,true);
await db.query("update bot_update_queue set payload=jsonb_set(payload,'{completedCharacters}','[\"Player\"]') where id=$1",[id(117)]);
const done=await ctx.enqueueRaidMissingPrioReminderRefresh(guild,{id:id(17),external_raid_id:'raid17'},'Player');assert.equal(done.reason,'character_already_completed');assert.equal(queued.length,1);
await ctx.expireStalePrioReminders();assert.equal((await db.query('select status from bot_update_queue where id=$1',[id(501)])).rows[0].status,'done');
await db.close();console.log('Stale reminder tests: past/archived/deleted raids, invalid times, changed date/PIN/channel, processing retries, guild isolation, edit-only refresh and completed-character deduplication passed.');
