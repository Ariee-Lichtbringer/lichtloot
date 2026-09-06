import assert from 'node:assert/strict';import {createP0Deletions} from '../src/p0-deletions.js';
const {PGlite}=await import(process.env.PGLITE_MODULE);const db=new PGlite();const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');let active=db,fail=true;
await db.exec('create table raids(id uuid,guild_id uuid);create table prios(raid_id uuid,character_id uuid,comment text);');
await db.query('insert into raids values($1,$2)',[id(1),id(2)]);await db.query('insert into prios values($1,$2,$3),($1,$2,$4)',[id(1),id(3),JSON.stringify({p0OnlySignupId:id(4)}),JSON.stringify({p0OnlySignupId:id(9)})]);
const query=(s,p)=>s.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[]}):active.query(s,p);
const service=createP0Deletions({query,transaction:fn=>db.transaction(async tx=>{active=tx;try{return await fn();}finally{active=db;}}),p0Query:async s=>{if(s.startsWith('select'))return {rows:[{id:id(4)}]};if(fail)throw Error('separate database unavailable');return {rowCount:1};}});
const args={guildId:id(2),event:{id:id(5)},character:{id:id(3)},discordUserId:'owner',archiveMirrors:async()=>{}};
await assert.rejects(service.remove(args),/separate database/);assert.equal(await service.isDeleted(id(2),id(4)),true);assert.equal((await db.query('select * from prios')).rows.length,1);
fail=false;assert.equal((await service.remove(args)).deleted,1);assert.equal((await db.query('select * from p0_signup_deletions')).rows.length,1);await db.close();console.log('PASS P0-only deletion: tombstone survives remote failure; scoped cleanup and retry are idempotent.');
