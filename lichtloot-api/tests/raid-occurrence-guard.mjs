import assert from 'node:assert/strict';
import {ensureRaidOccurrenceGuard} from '../src/raid-occurrence-guard.js';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
const query=(sql,params)=>params?db.query(sql,params):db.exec(sql);
const variants=type=>type==='mc'?['mc','molten-core']:[type];
for(const table of ['raids','p0_only_events']) {
  const external=table==='raids'?'external_raid_id':'external_p0_id';
  await db.exec(`create table ${table}(id uuid primary key default gen_random_uuid(),guild_id uuid,${external} text,raid_type text,raid_date date,raid_time text,status text default 'geschlossen',deleted_at timestamptz,unique(guild_id,${external}))`);
  const insert=(name,date='2026-09-25',time='21:00',type='mc',guild='00000000-0000-0000-0000-000000000001')=>query(`insert into ${table}(guild_id,${external},raid_type,raid_date,raid_time) values($1,$2,$3,$4,$5) returning id`,[guild,name,type,date,time]);
  await insert('legacy');await insert('legacy-duplicate');
  await ensureRaidOccurrenceGuard(query,table,variants);
  await assert.rejects(insert('recreated'),/bereits einen Anmelder/);
  await assert.rejects(insert('alias','2026-09-25','21:00:00','molten-core'),/bereits einen Anmelder/);
  await query(`update ${table} set status='archiviert' where ${external}='legacy'`);
  await assert.rejects(insert('archived-recreated'),/bereits einen Anmelder/);
  await insert('other-time','2026-09-25','22:00');
  await insert('other-date','2026-09-26');
  await insert('other-guild','2026-09-25','21:00','mc','00000000-0000-0000-0000-000000000002');
  await assert.rejects(query(`update ${table} set raid_time='21:00' where ${external}='other-time'`),/bereits einen Anmelder/);
  await query(`insert into ${table}(guild_id,${external},raid_type,raid_date,raid_time) values('00000000-0000-0000-0000-000000000001','legacy','mc','2026-09-25','21:00') on conflict(guild_id,${external}) do update set status='geschlossen'`);
  await query(`update ${table} set deleted_at=now() where ${external} in ('legacy','legacy-duplicate')`);
  await insert('replacement');
  await assert.rejects(query(`update ${table} set deleted_at=null where ${external}='legacy'`),/bereits einen Anmelder/);
}
await db.close();
console.log('PASS: both stores reject duplicates, aliases, time variants, conflicting edits/restores; historical rows, idempotent upserts, different times/dates/guilds preserved.');
