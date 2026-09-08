import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createP0Scheduler, scheduleTimes, lockSchedule} from '../src/p0-schedules.js';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite(); const query=(...args)=>db.query(...args);
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const guild={id:id(1)}, raid={id:id(2),guild_id:guild.id,raid_type:'naxx',status:'geöffnet',raid_pin:'RAID',external_raid_id:'EXT'},character={id:id(3),name:'Test',server:'Everlook',approval_status:'approved'},item={id:id(4),name:'Gressil'};
await db.exec(`create table guilds(id uuid primary key);create table raids(id uuid primary key,guild_id uuid,status text,deleted_at timestamptz,name text,raid_date date);create table characters(id uuid primary key);create table po_post_entries(guild_id uuid,raid_id text,archived_at timestamptz);create table prios(id uuid default gen_random_uuid(),raid_id uuid,character_id uuid,p1_item_id uuid,p2_item_id uuid,p3_item_id uuid,comment text,updated_at timestamptz,unique(raid_id,character_id));create table mirror(item text);`);
await query('insert into guilds values($1)',[guild.id]);await query("insert into raids(id,guild_id,status,name,raid_date) values($1,$2,'geöffnet','Naxx','2026-09-08')",[raid.id,guild.id]);await query('insert into characters values($1)',[character.id]);await query('insert into po_post_entries values($1,$2,null)',[guild.id,raid.id]);
let blocked=false, releases=true, failDuringWrite=false, queueCalls=0, expireDuringWrite=false, activeJob;
const source=fs.readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
const start=source.indexOf('async function savePoSignupPrioFromBot('),end=source.indexOf('\nconst p0Scheduler',start);
const context=vm.createContext({
  dkpService:{assertPrio:async()=>{}},requireMasterOrQueueToken:p=>{if(p.masterCode!=='secret')throw new Error('Unauthorized');},
  ensurePoPostEntriesSchema:async()=>{},ensurePrioSchema:async()=>{},ensureCrossGuildPlayerLogin:async()=>{},
  clean:v=>String(v??'').trim(),normalizePin:v=>v,normalizeRaidType:v=>v,normalizeStatus:v=>v,normalizePlayerApprovalStatus:v=>v,
  query:async(sql,args)=>sql.startsWith('select * from raids where id=')?{rows:[{...raid,...(await query('select * from raids where id=$1',[args[0]])).rows[0]}]}:query(sql,args),
  findCharacterForPin:async(g,pin)=>blocked||pin!=='player-pin'?null:character,
  normalizePoReleaseRaid:v=>v,getPoReleaseDisplaySettings:async()=>({}),guildPoItemRequiresRelease:async()=>true,
  poReleasesRequiredForRaid:()=>true,checkCharacterPoRelease:async()=>({allowed:releases}),
  requireGuildPoItem:async(g,i,name)=>{if(name!==item.name)throw new Error('Invalid item');return item;},
  pool:{connect:async()=>({query,release(){}})},lockSchedule,upsertItem:async()=>item,
  removeDuplicatePriosForCharacterName:async()=>{},removeDuplicatePriosForPlayerLogin:async()=>{},commentMeta:v=>v?JSON.parse(v):{},
  syncPoPostEntryFromPrio:async(client)=>{await client.query('insert into mirror values($1)',[item.name]);if(failDuringWrite)throw new Error('Simulated failure');if(expireDuringWrite)await client.query("update p0_schedules set deadline_at=clock_timestamp()-interval '0.1 second' where id=$1",[activeJob.id]);return [{}];},
  enqueuePoPostRefreshPayloads:async()=>{queueCalls++;return {success:true};},enqueueRaidAnnouncementRefreshAfterPrioChange:async()=>({success:true}),raidPublicId:r=>r.id
});
vm.runInContext(source.slice(start,end),context);
const params={masterCode:'secret',playerPin:'player-pin',player:character.name,server:character.server,item:item.name};
const options={query,prepare:async()=>({raid,character,item}),execute:job=>context.savePoSignupPrioFromBot({guildId:guild.id,query:params},{raidId:raid.id,jobId:job.id})};
let scheduler=createP0Scheduler(options);
const times=()=>({executeAt:new Date(Date.now()+10000).toISOString(),deadlineAt:new Date(Date.now()+60000).toISOString()});
assert.throws(()=>scheduleTimes({executeAt:'2026-09-08T19:14:58',deadlineAt:'2026-09-08T19:15:00'}),/Zeitzone/);
assert.throws(()=>scheduleTimes({executeAt:new Date(0).toISOString(),deadlineAt:new Date(1).toISOString()}),/Zukunft/);
assert.throws(()=>scheduleTimes({executeAt:new Date(Date.now()+10000).toISOString(),deadlineAt:new Date(Date.now()+9000).toISOString()}),/vor dem/);
const create=()=>scheduler.handle(guild,{action:'guildScheduleP0',...times()});
const due=job=>query("update p0_schedules set execute_at=now()-interval '1 second' where id=$1",[job.id]);
const state=async job=>(await query('select * from p0_schedules where id=$1',[job.id])).rows[0];
let job=await create();await assert.rejects(create(),/bereits/);
await scheduler.tick();assert.equal((await state(job)).status,'pending');
await assert.rejects(scheduler.handle({id:id(99)},{action:'guildCancelScheduledP0',id:job.id}),/nicht gefunden/);
await scheduler.handle(guild,{action:'guildCancelScheduledP0',id:job.id});await due(job);await scheduler.tick();assert.equal((await query('select * from prios')).rows.length,0);
job=await create();await due(job);scheduler=createP0Scheduler(options);await scheduler.tick();assert.equal((await state(job)).status,'applied');assert.equal((await query('select * from prios')).rows.length,1);assert.equal((await query('select * from mirror')).rows.length,1);assert.equal(queueCalls,1);
await options.execute({...await state(job)});assert.equal(queueCalls,1);
job=await create();await query("update p0_schedules set execute_at=now()-interval '2 seconds',deadline_at=now()-interval '1 second' where id=$1",[job.id]);await scheduler.tick();assert.equal((await state(job)).status,'failed');assert.equal(queueCalls,1);
job=await create();await due(job);blocked=true;await scheduler.tick();assert.equal((await state(job)).status,'failed');blocked=false;
job=await create();await due(job);releases=false;await scheduler.tick();assert.equal((await state(job)).status,'failed');releases=true;
job=await create();await due(job);await query("update raids set status='geschlossen'");await scheduler.tick();assert.equal((await state(job)).status,'failed');await query("update raids set status='geöffnet'");
job=await create();await due(job);failDuringWrite=true;await scheduler.tick();assert.equal((await state(job)).status,'failed');assert.equal((await query('select * from mirror')).rows.length,1);assert.equal(queueCalls,1);failDuringWrite=false;
job=await create();activeJob=job;await due(job);expireDuringWrite=true;await scheduler.tick();assert.equal((await state(job)).status,'failed');assert.equal((await query('select * from mirror')).rows.length,1);assert.equal(queueCalls,1);expireDuringWrite=false;
const list=await scheduler.handle(guild,{action:'guildListScheduledP0'});assert.equal(list.jobs.length,8);assert.ok(!JSON.stringify(list).includes('secret'));assert.ok(!JSON.stringify(list).includes('player-pin'));
assert.match(source,/requireMasterCodeForGuild\(guild, postParams.masterCode, action, postParams\);\n      enforceSecurityRateLimit\(req, "p0-schedule"/);
console.log('PASS: time validation, future job, duplicate, guild-scoped cancellation, restart, single execution, deadline, blocked login, withdrawn release, closed raid, transactional rollback, deadline during write, credential-free listing.');
await db.close();
