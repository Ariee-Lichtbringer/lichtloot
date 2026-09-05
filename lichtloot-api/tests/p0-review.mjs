import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();
const src=fs.readFileSync(new URL('../src/server.js',import.meta.url),'utf8');const extract=(text,name)=>{const m=text.match(new RegExp('^(?:async )?function '+name+'\\(','m'));return text.slice(m.index,text.indexOf('\n}\n',m.index)+2);};
const uuid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`,guild=uuid(1),raid=uuid(2),otherRaid=uuid(3),item=uuid(4),secondItem=uuid(5);
await db.exec(`create table guilds(id uuid primary key);create table players(id uuid primary key,guild_id uuid);create table characters(id uuid primary key,player_id uuid,name text,server text,class_name text,created_at timestamptz default now());create table raids(id uuid primary key,guild_id uuid,raid_type text,external_raid_id text,raid_pin text,raid_date date,raid_time text,name text,created_at timestamptz default now());create table items(id uuid primary key,name text,raid_type text,item_id text,created_at timestamptz default now());create table prios(id uuid default gen_random_uuid(),raid_id uuid,character_id uuid,p1_item_id uuid,comment text,bench text,updated_at timestamptz default now());create table p0plus_points(id uuid default gen_random_uuid(),guild_id uuid,character_id uuid,item_id uuid,points numeric,source text,note text);create table raid_signups(raid_id uuid,character_id uuid,status text,staff_benched bool);create table raid_external_signups(raid_id uuid,guild_id uuid,player_name text,status text,staff_benched bool,discord_user_id text);create table discord_player_links(guild_id uuid,character_id uuid,discord_user_id text);`);
await db.exec("alter table raids add column status text default 'geschlossen', add column p0plus_transferred_at timestamptz, add column p0plus_transfer_reset_at timestamptz, add column updated_at timestamptz");
const auditSql=extract(src,'ensureP0PlusAuditSchema').match(/`(create table[\s\S]+?)`/)[1];await db.exec(auditSql);
await db.query('insert into guilds values($1)',[guild]);await db.query(`insert into raids(id,guild_id,raid_type,external_raid_id,raid_pin,raid_date,raid_time,name,created_at) values($1,$2,'naxx','RAID','PIN','2020-01-01','20:00','Naxx',now()),($3,$2,'naxx','OTHER','OTHER','2020-01-02','20:00','Naxx',now())`,[raid,guild,otherRaid]);await db.query(`insert into items(id,name,raid_type,item_id) values($1,'Gressil','naxx','100'),($2,'Andere Waffe','naxx','101')`,[item,secondItem]);
for(let n=10;n<=14;n++){await db.query('insert into players values($1,$2)',[uuid(n+100),guild]);await db.query(`insert into characters(id,player_id,name,server) values($1,$2,$3,'Everlook')`,[uuid(n),uuid(n+100),'Spieler'+n]);await db.query(`insert into prios(raid_id,character_id,p1_item_id,comment,bench) values($1,$2,$3,'{"p0Plus":"ja"}','')`,[n===14?otherRaid:raid,uuid(n),item]);}
await db.query(`insert into p0plus_points(guild_id,character_id,item_id,points,source,note) values($1,$2,$3,10,'Alt',''),($1,$4,$3,3,'Alt',''),($1,$5,$3,2,'Raidlead Transfer','RaidID: RAID')`,[guild,uuid(10),item,uuid(11),uuid(13)]);
const sqlRun=async(sql,args)=>{const r=await db.query(sql,args);for(const row of r.rows){if(typeof row.raid_date==='string')row.raid_date=new Date(row.raid_date);}return {...r,rowCount:r.affectedRows??r.rows.length};};let exports=[];
const ctx=vm.createContext({Date,console,createHmac,analyticsHashSecret:'test',clean:v=>String(v??'').trim(),normalizeRaidType:v=>String(v||'').toLowerCase(),raidTypeSearchValues:v=>[v],commentMeta:v=>JSON.parse(v),raidPublicId:r=>r.external_raid_id||r.id,getGuildEraConfiguration:async()=>({rules:{p0Plus:{raidTransferPoints:1}}}),requireConfiguredSpecialRaidType:async()=>{},pool:{connect:async()=>({query:sqlRun,release(){}})},query:sqlRun,upsertItem:async(client,type,name)=>(await client.query('select * from items where raid_type=$1 and name=$2',[type,name])).rows[0],archivePoPostEntriesForRaid:async()=>0,queueP0PlusTransferCsvExport:async payload=>{exports.push(payload);return {success:true};}});
for(const name of ['resolveZgPointTarget','staffBenchPrioSql','p0ItemReceivedPrioSql','insertP0PlusAudit','getP0PlusPointTotal','findCharacterByName','clearP0PlusForPlayer','transferP0PlusPoints'])vm.runInContext(extract(src,name),ctx);
const receive=(n,raidId='RAID')=>ctx.clearP0PlusForPlayer({guildId:guild,query:{raid:'naxx',raidId,player:'Spieler'+n,server:'Everlook',item:'Gressil'}});
await assert.rejects(receive(10,'INVALID'));assert.equal(Number((await db.query('select sum(points) total from p0plus_points where character_id=$1',[uuid(10)])).rows[0].total),10);
assert.equal((await receive(10)).pointsCleared,false);assert.equal(Number((await db.query('select sum(points) total from p0plus_points where character_id=$1',[uuid(10)])).rows[0].total),10);assert.equal((await receive(10)).pointsCleared,false);const flag=async(n,r=raid)=> (await db.query(`select ${ctx.p0ItemReceivedPrioSql()} flag from prios pr where character_id=$1 and raid_id=$2`,[uuid(n),r])).rows[0]?.flag;
assert.equal(await flag(10),true);assert.equal(await flag(11),false);assert.equal(await flag(14,otherRaid),false);
// Add a zero-point receipt on another raid: it must not affect this raid's transfer.
await db.query(`insert into prios(raid_id,character_id,p1_item_id,comment,bench) values($1,$2,$3,'{"p0Plus":"ja"}','')`,[otherRaid,uuid(12),item]);assert.equal((await receive(12,'OTHER')).itemReceived,true);assert.equal(await flag(12,otherRaid),true);assert.equal(await flag(12),false);
const transfer=extra=>ctx.transferP0PlusPoints({guildId:guild,query:{raid:'naxx',raidId:'RAID',...extra}});const count=async()=>Number((await db.query('select count(*) n from p0plus_points')).rows[0].n);
const before=await count();let plan=await transfer({preview:true});assert.equal(await count(),before);assert.equal(exports.length,0);assert.equal((await db.query('select status from raids where id=$1',[raid])).rows[0].status,'geschlossen');assert.equal(plan.entries.length,2);assert.equal(plan.receivedItems.find(r=>r.characterId===uuid(10)).deletedPoints,10);assert.equal(plan.receivedItems.find(r=>r.characterId===uuid(10)).pending,true);assert.ok(plan.skippedEntries.some(r=>r.player==='Spieler13'));
const edits=p=>p.entries.map((r,i)=>({characterId:r.characterId,itemId:r.itemId,points:r.characterId===uuid(11)?0.5:0}));
await assert.rejects(transfer({reviewToken:plan.reviewToken,pointEdits:edits(plan).map(r=>({...r,points:-1}))}));assert.equal(await count(),before);
await db.query(`insert into p0plus_points(guild_id,character_id,item_id,points,source,note) values($1,$2,$3,1,'Korrektur','')`,[guild,uuid(11),item]);await assert.rejects(transfer({reviewToken:plan.reviewToken,pointEdits:edits(plan)}),/Vorschau neu laden/);
plan=await transfer({preview:true});
const auditWriter=ctx.insertP0PlusAudit;
ctx.insertP0PlusAudit=async(client,entry)=>{if(entry.action==='raid_transfer')throw new Error('Simulierter Schreibfehler');return auditWriter(client,entry);};
await assert.rejects(transfer({reviewToken:plan.reviewToken,pointEdits:edits(plan)}),/Schreibfehler/);
ctx.insertP0PlusAudit=auditWriter;
assert.equal(Number((await db.query('select sum(points) total from p0plus_points where character_id=$1',[uuid(10)])).rows[0].total),10,'Failed transfer rolls receipt deletion back');
assert.equal((await receive(10)).pointsCleared,false);
const saved=await transfer({reviewToken:plan.reviewToken,pointEdits:edits(plan)});assert.equal(saved.awarded,2);assert.equal(Number((await db.query('select count(*) n from p0plus_points where character_id=$1',[uuid(10)])).rows[0].n),0);assert.equal((await receive(10)).pointsCleared,true);assert.equal((await db.query('select status from raids where id=$1',[raid])).rows[0].status,'archiviert');assert.equal(exports.length,1);assert.deepEqual(Array.from(exports[0].awardedRows,r=>r.awardPoints).sort(),[0,0.5]);
const awarded=await db.query(`select character_id,points from p0plus_points where source='Raidlead Transfer' order by character_id`);assert.equal(awarded.rows.length,3,'Existing same-item transfer survives');assert.equal(Number(awarded.rows.find(r=>r.character_id===uuid(13)).points),2);assert.equal(Number(awarded.rows.find(r=>r.character_id===uuid(11)).points),0.5);
await assert.rejects(transfer({reviewToken:plan.reviewToken,pointEdits:edits(plan)}));assert.equal((await transfer({preview:true})).entries.length,0,'Zero-point decision also prevents duplicates');
// Management summary uses immutable audit totals even after point deletion.
const summarySql=src.match(/const auditSummary = await query\(`([\s\S]*?)`, \[guildId/)[1];
const summary=await db.query(summarySql,[guild,[raid]]);
assert.equal(Number(summary.rows.find(r=>r.action==='raid_transfer'&&r.character_id===uuid(11)).points),0.5);
assert.equal(Number(summary.rows.find(r=>r.action==='item_received_clear'&&r.character_id===uuid(10)).points),10);
await db.query('update raids set p0plus_transfer_reset_at=now() where id=$1',[raid]);
assert.equal((await db.query(summarySql,[guild,[raid]])).rows.filter(r=>r.action==='raid_transfer').length,0);
// Receipt highlighting remains tied to the awarded item even after editing P1.
await db.query('update prios set p1_item_id=$1 where character_id=$2 and raid_id=$3',[secondItem,uuid(10),raid]);assert.equal(await flag(10),false);
// ZG uses exact raids and separate point buckets, including generic Nachtwächter Wednesdays.
await db.exec("alter table guilds add column slug text; update guilds set slug='nachtloot'");
const types=['zg','zg-mittwoch','zg-prime','zg-late'];
for (let i=0;i<types.length;i++) {
  await db.query("insert into items(id,name,raid_type,item_id) values($1,'ZG Item',$2,'200')",[uuid(200+i),types[i]]);
  await db.query("insert into p0plus_points(guild_id,character_id,item_id,points,source,note) values($1,$2,$3,7,'Alt','')",[guild,uuid(10),uuid(200+i)]);
}
for (const [n,type] of [[210,'zg'],[211,'zg-prime'],[212,'zg-late'],[213,'zg-prime']]) {
  await db.query("insert into raids(id,guild_id,raid_type,external_raid_id,raid_date,raid_time,name) values($1,$2,$3,$4,'2020-01-01','22:00',$3)",[uuid(n),guild,type,'ZG'+n]);
  await db.query(`insert into prios(raid_id,character_id,p1_item_id,comment,bench) values($1,$2,$3,'{"p0Plus":"ja"}','')`,[uuid(n),uuid(n===213?11:10),uuid(200+types.indexOf(type))]);
}
const zgReceive=(n,type)=>ctx.clearP0PlusForPlayer({guildId:guild,query:{raid:type,raidId:'ZG'+n,player:'Spieler10',server:'Everlook',item:'ZG Item'}});
const zgTransfer=(n,type,extra={})=>ctx.transferP0PlusPoints({guildId:guild,query:{raid:type,raidId:'ZG'+n,...extra}});
const zgPoints=async type=>Number((await db.query('select coalesce(sum(points),0) total from p0plus_points where character_id=$1 and item_id=$2',[uuid(10),uuid(200+types.indexOf(type))])).rows[0].total);
assert.equal((await zgReceive(210,'zg')).pointsCleared,false);
assert.equal(await flag(10,uuid(210)),true);
assert.equal(await zgPoints('zg-mittwoch'),7);
assert.equal(await flag(10,uuid(211)),false);
await assert.rejects(zgTransfer(210,'zg',{targetRaid:'zg-prime',preview:true}),/passt nicht/);
await assert.rejects(zgTransfer(211,'zg-prime',{targetRaid:'zg-late',preview:true}),/passt nicht/);
let zgPlan=await zgTransfer(210,'zg',{preview:true});
assert.equal(zgPlan.receivedItems.length,1);assert.equal(zgPlan.receivedItems[0].deletedPoints,7);
await zgTransfer(210,'zg',{reviewToken:zgPlan.reviewToken,pointEdits:[]});
assert.equal(await zgPoints('zg-mittwoch'),0);assert.equal(await zgPoints('zg-prime'),7);assert.equal(await zgPoints('zg-late'),7);assert.equal(await zgPoints('zg'),7);
assert.equal((await zgReceive(210,'zg')).pointsCleared,true);
zgPlan=await zgTransfer(211,'zg-prime',{preview:true});assert.equal(zgPlan.entries.length,1,'Same-date second Prime raid must not be merged');assert.equal(zgPlan.entries[0].player,'Spieler10');
await db.query('update raids set p0plus_transferred_at=now() where id=$1',[uuid(212)]);
assert.equal((await zgReceive(212,'zg-late')).pointsCleared,true);assert.equal(await zgPoints('zg-late'),0);assert.equal(await zgPoints('zg-prime'),7);
assert.equal(await flag(10,uuid(212)),true);assert.equal(await flag(10,uuid(211)),false);
console.log('ZG: Wednesday target, Prime/Late isolation, exact same-date raid identity, receipt flags and pending/immediate deletion passed.');
await db.close();console.log('P0 review: deferred deletion, retry idempotence, transactional rollback, receipt persistence, zero points, item/raid isolation, read-only preview, editable decimals/zero, invalid and stale review rejection, no duplicate/deleted prior awards passed.');
