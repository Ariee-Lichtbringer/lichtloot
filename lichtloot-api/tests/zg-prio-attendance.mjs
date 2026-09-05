import assert from 'node:assert/strict';
import {getZgPrioAttendance,buildZgPrioAttendance,getZgAttendanceByCharacter} from '../src/prio-attendance.js';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
try {
 await db.exec(`
 create table guilds(id text primary key,slug text);
 create table players(id text primary key,guild_id text);
 create table characters(id text primary key,player_id text,name text,server text,class_name text);
 create table raids(id text primary key,guild_id text,external_raid_id text,name text,raid_type text,raid_date date,raid_time text,status text);
 create table prios(id text primary key,raid_id text,character_id text,bench text,created_at timestamptz,updated_at timestamptz);
 insert into guilds values ('g','nachtloot'),('other','lichtloot');
 insert into players values ('a','g'),('b','g'),('c','other');
 insert into characters values ('old','a','Alt','Everlook','Mage'),('main','a','Reyna','Everlook','Warrior'),('other-server','b','Reyna','Lakeshire','Mage'),('foreign','c','Foreign','Everlook','Warrior');
 insert into raids values
 ('prime','g','prime-public','ZG Prime','zg-prime','2026-08-22','22:00','archiviert'),
 ('late','g','late-public','ZG Late','zg-late','2026-08-22','23:30','archiviert'),
 ('empty-duplicate','g','dup','ZG Prime','zg-prime','2026-08-22','22:00','archiviert'),
 ('wed','g','wed-public','ZG Mittwoch','zg','2026-08-19','21:30','geschlossen'),
 ('other-guild','other','other','ZG','zg-prime','2026-08-22','22:00','archiviert'),
 ('cancelled','g','cancel','ZG','zg-prime','2026-08-22','22:00','abgesagt'),
 ('old-raid','g','older','ZG','zg-prime','2026-08-14','22:00','archiviert'),
 ('today','g','today','ZG','zg-prime',(now() at time zone 'Europe/Berlin')::date,'22:00','geschlossen'),
 ('future','g','future','ZG','zg-prime',(now() at time zone 'Europe/Berlin')::date+1,'22:00','geschlossen'),
 ('mc','g','mc','MC','mc','2026-08-22','22:00','archiviert');
 insert into prios values
 ('1','prime','old','', '2026-08-20','2026-08-20'),
 ('2','prime','main','', '2026-08-20','2026-08-21'),
 ('3','prime','other-server','ja', '2026-08-20','2026-08-21'),
 ('4','late','main','', '2026-08-20','2026-08-21'),
 ('5','wed','old','false', '2026-08-18','2026-08-18'),
 ('6','prime','foreign','', '2026-08-20','2026-08-21'),
 ('7','other-guild','foreign','', '2026-08-20','2026-08-21'),
 ('8','cancelled','main','', '2026-08-20','2026-08-21'),
 ('9','old-raid','main','', '2026-08-13','2026-08-13'),
 ('10','today','main','', now(),now()),
 ('11','future','main','', now(),now()),
 ('12','mc','main','', '2026-08-20','2026-08-21');
 `);
 const get=raidKey=>getZgPrioAttendance((...args)=>db.query(...args),{guildId:'g',guildSlug:'nachtloot',raidKey});
 const prime=await get('zg-prime');
 assert.equal(prime.raidCount,1);assert.equal(prime.participationCount,1);assert.equal(prime.benchCount,1);
 assert.deepEqual(prime.rows[0].signups.map(p=>p.characterId).sort(),['main','other-server']);
 assert.equal(prime.rows[0].raid.id,'prime');
 const late=await get('zg-late');assert.equal(late.raidCount,1);assert.equal(late.participationCount,1);assert.equal(late.benchCount,0);assert.equal(late.rows[0].raid.id,'late');
 const wed=await get('zg-mittwoch');assert.equal(wed.raidCount,1);assert.equal(wed.rows[0].raid.id,'wed');
 const all=await get('zg');assert.equal(all.raidCount,3);assert.equal(all.participationCount,3);assert.equal(all.benchCount,1);
 assert.equal(new Set(all.rows.map(row=>row.raid.id)).size,3,'Same-date Prime and Late are separate raid IDs');
 assert.equal((await get('zg-prime')).participationCount,1,'Repeated reads do not add attendance');
 const summary=await getZgAttendanceByCharacter((...args)=>db.query(...args),{guildId:'g',guildSlug:'nachtloot'});
 assert.deepEqual(summary.totals,{'zg-mittwoch':1,'zg-prime':1,'zg-late':1});
 assert.equal(summary.byCharacter.get('main')['zg-prime'].attended,1);
 assert.equal(summary.byCharacter.get('other-server')['zg-prime'].attended,0);
 assert.equal(summary.byCharacter.get('other-server')['zg-prime'].bench,1);
 assert.equal(summary.byCharacter.get('main')['zg-late'].attended,1);
 assert.equal(summary.byCharacter.get('old')['zg-mittwoch'].source,'prio-list');
 const counted=await getZgAttendanceByCharacter((...args)=>db.query(...args),{guildId:'g',guildSlug:'nachtloot',countBench:true});
 assert.equal(counted.byCharacter.get('other-server')['zg-prime'].attended,1);
 await db.query("update prios set bench='true' where id='2'");assert.equal((await get('zg-prime')).participationCount,0,'Prio correction takes effect without backfill duplicates');
 await assert.rejects(()=>getZgPrioAttendance(()=>{throw Error('Must not query')},{guildId:'g',guildSlug:'lichtloot',raidKey:'zg'}),/nur für ZG/);
 await assert.rejects(()=>get('mc'),/nur für ZG/);
 assert.deepEqual(buildZgPrioAttendance([]),[]);
 console.log('PASS: raid-ID and guild isolation, Prime/Late same day, Wednesday, duplicate scheduling, latest character per login, same name across servers, bench, date boundaries, cancellations, refresh and source restrictions.');
} finally {await db.close()}
