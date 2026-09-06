import assert from 'node:assert/strict';
import {createRaidCloseoutService} from '../src/raid-closeout.js';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();
const uuid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const guild={id:uuid(1),slug:'test'},raid=uuid(2),future=uuid(3),otherTime=uuid(4),item=uuid(5);
await db.exec(`create table raids(id uuid primary key,guild_id uuid,name text,raid_type text,raid_date date,raid_time text,raid_pin text,external_raid_id text,status text,deleted_at timestamptz,p0plus_transfer_reset_at timestamptz,lead_pin text);
create table players(id uuid primary key,guild_id uuid);create table characters(id uuid primary key,player_id uuid,name text,server text);
create table items(id uuid primary key,name text,item_id text,raid_type text,created_at timestamptz default now());
create table prios(id uuid primary key,raid_id uuid,character_id uuid,comment text,updated_at timestamptz default now(),p1_item_id uuid,p2_item_id uuid,p3_item_id uuid);
create table raid_signups(raid_id uuid,character_id uuid,status text);
create table p0plus_points(id uuid default gen_random_uuid(),guild_id uuid,character_id uuid,item_id uuid,points numeric,source text,note text,created_at timestamptz default now());
create table p0plus_point_audit(id uuid default gen_random_uuid(),guild_id uuid,character_id uuid,item_id uuid,raid_id uuid,raid_type text,player_name text,server text,item_name text,old_points numeric,new_points numeric,delta_points numeric,action text,source text,note text,created_at timestamptz default now());
create table bot_update_queue(id uuid primary key,guild_id uuid,type text,status text,payload jsonb,created_at timestamptz default now(),resolved_at timestamptz);`);
await db.query(`insert into raids(id,guild_id,name,raid_type,raid_date,raid_time,raid_pin,external_raid_id,status,lead_pin) values
 ($1,$4,'ZG PRIME','zg-prime','2020-09-05','22:00','PIN','RAID','archiviert','lead'),
 ($2,$4,'Next Raid','zg-prime','2099-09-05','22:00','NEXT','NEXT','geöffnet','lead'),
 ($3,$4,'Other time','zg-prime','2020-09-05','23:30','OTHER','OTHER','archiviert','lead')`,[raid,future,otherTime,guild.id]);
await db.query("insert into items(id,name,item_id,raid_type) values($1,'Götze','22637','zg-prime')",[item]);
for(let n=0;n<7;n++){
 const char=uuid(10+n);await db.query('insert into players values($1,$2)',[uuid(30+n),guild.id]);await db.query("insert into characters values($1,$2,$3,'Everlook')",[char,uuid(30+n),'Player'+n]);
 const comment=JSON.stringify(n===5?{}:{p0Selected:'ja',p0Plus:[0,6].includes(n)?'nein':'ja',p0Item:'Götze'});
 await db.query('insert into prios(id,raid_id,character_id,comment,p1_item_id,p2_item_id,p3_item_id) values($1,$2,$3,$4,$5,$6,$6)',[uuid(50+n),raid,char,comment,item,n===5?null:item]);
 await db.query('insert into raid_signups values($1,$2,$3)',[raid,char,n===6?'absent':'signed']);
}
await db.query("insert into p0plus_points(guild_id,character_id,item_id,points,source,note) values($1,$2,$3,1,'Raidlead Transfer','RaidID: RAID'),($1,$2,$3,1,'Raidlead Transfer','RaidID: RAID')",[guild.id,uuid(12),item]);
await db.query("insert into p0plus_point_audit(guild_id,character_id,item_id,raid_id,raid_type,player_name,item_name,action) values($1,$2,$3,$4,'zg-prime','Player3','Götze','item_received_pending'),($1,$5,$3,$4,'zg-prime','Player4','Götze','raid_transfer')",[guild.id,uuid(13),item,raid,uuid(14)]);
await db.query("insert into bot_update_queue(id,guild_id,type,status,payload) values($1,$2,'raid_missing_prio_reminder','open',$3)",[uuid(60),guild.id,JSON.stringify({raidId:'RAID',raidDate:'2020-09-05'})]);
let config={layout:{},rules:{p0Plus:{raidTransferPoints:1}}},failAudit=false;
const query=async(sql,args)=>{if(failAudit&&sql.includes('insert into p0plus_point_audit'))throw Error('Injected failure');const r=await db.query(sql,args);return {...r,rowCount:r.affectedRows??r.rows.length};};
const service=createRaidCloseoutService({pool:{connect:async()=>({query,release(){}})},secret:'test-secret',
 authorize:async(g,p,r,write)=>{if((write||p.masterCode)?p.masterCode!=='secret':p.leadPin!=='lead')throw Object.assign(Error('Denied'),{statusCode:403});},
 configuration:async()=>config,resolveTarget:async(c,g,r)=>r.raid_type,plusEnabled:layout=>layout.enabled!==false,itemPlus:async()=>true,
 staffBenchSql:()=> 'false',reminderQueueSql:()=> 'false'});
const params={raidId:'RAID',leadPin:'lead'},review=()=>service.review(guild,params);
const count=async table=>Number((await db.query('select count(*) n from '+table)).rows[0].n);
const before={points:await count('p0plus_points'),audit:await count('p0plus_point_audit')};
let p=await review();assert.equal(p.counts.missingFlags,2);assert.equal(p.counts.missingPoints,2);assert.equal(p.counts.duplicates,1);assert.equal(p.counts.reminders,1);assert.equal(p.counts.pendingReceipts,1);
assert.deepEqual(before,{points:await count('p0plus_points'),audit:await count('p0plus_point_audit')});
assert.equal(p.actions.filter(a=>a.type==='points').length,2);assert.ok(!p.actions.some(a=>a.type==='points'&&a.player==='Player6'));
await assert.rejects(service.review({id:uuid(900)},params),/nicht gefunden/);
await assert.rejects(service.review(guild,{raidId:'RAID',leadPin:'wrong'}),/Denied/);
const next=await service.review(guild,{...params,raidId:'NEXT'});assert.equal(next.status,'upcoming');assert.equal(next.actions.length,0);
const other=await service.review(guild,{...params,raidId:'OTHER'});assert.equal(other.findings.length,0,'Same date, different time must not share findings');
const chosen=p.actions.filter(a=>a.characterId===uuid(10)||a.type==='reminder').map(a=>a.id);
const apply=extra=>service.apply(guild,{raidId:'RAID',masterCode:'secret',reviewToken:p.reviewToken,actionIds:chosen,attendanceConfirmed:true,...extra});
await assert.rejects(apply({attendanceConfirmed:false}),/Teilnahme/);
await assert.rejects(apply({actionIds:['points:unknown']}),/gültige/);
await assert.rejects(apply({masterCode:'wrong'}),/Denied/);
failAudit=true;await assert.rejects(apply(),/Injected failure/);failAudit=false;
assert.equal((await db.query('select comment from prios where id=$1',[uuid(50)])).rows[0].comment.includes('"p0Plus":"nein"'),true);
assert.equal(await count('p0plus_points'),before.points);assert.equal((await db.query('select status from bot_update_queue')).rows[0].status,'open');
// Any changed balance invalidates the reviewed proposal.
await db.query("insert into p0plus_points(guild_id,character_id,item_id,points,source) values($1,$2,$3,2,'Manual')",[guild.id,uuid(10),item]);
await assert.rejects(apply(),/geändert/);p=await review();
const result=await apply();assert.equal(result.points,1);assert.equal(result.applied,3);
assert.equal(Number((await db.query('select sum(points) n from p0plus_points where character_id=$1',[uuid(10)])).rows[0].n),3);
assert.equal((await db.query('select status from bot_update_queue')).rows[0].status,'done');
assert.equal((await db.query("select count(*) n from p0plus_point_audit where character_id=$1 and action='raid_transfer'",[uuid(10)])).rows[0].n,1);
await assert.rejects(apply(),/geändert/);assert.equal((await review()).counts.missingPoints,1);
// A legacy receipt without raid_id also prevents re-awarding points.
await db.query("insert into p0plus_point_audit(guild_id,character_id,item_id,raid_type,action,created_at) values($1,$2,$3,'zg-prime','item_received_clear','2020-09-05T21:00:00Z')",[guild.id,uuid(11),item]);
assert.equal((await review()).counts.missingPoints,0);
config={layout:{enabled:false},rules:{p0Plus:{raidTransferPoints:1}}};assert.equal((await review()).counts.missingFlags,0);
await db.close();console.log('Raid closeout: read-only review, guild/auth/date isolation, absent/received/prior awards, concrete proposals, confirmation, stale tokens, atomic rollback, audit and retry safety passed.');
