import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {listPlatformForeverGuilds,resetPlatformForeverCode} from '../src/platform-forever-guilds.js';
import {openPlatformGuildLeadership} from '../src/platform-guild-entry.js';
const {PGlite}=await import(process.env.FOREVER_PGLITE||'@electric-sql/pglite');
const db=new PGlite();await db.exec(await readFile(new URL('../src/forever-core.sql',import.meta.url),'utf8'));
await db.exec('create table forever_raids(id uuid primary key,guild_id uuid references guilds(id))');
const query=(s,p=[])=>db.query(s,p),pool={connect:async()=>({query,release(){}})};
for(const [slug,game] of [['sandbox','forever'],['era','era']]){const id=randomUUID();await query('insert into guilds(id,slug,name) values($1,$2,$2)',[id,slug]);await query('insert into guild_settings(guild_id,layout_json) values($1,$2)',[id,JSON.stringify({game})]);await query('insert into guild_master_codes(guild_id,master_code) values($1,$2)',[id,'OLD-'+slug]);}
const rows=await listPlatformForeverGuilds(query);assert.equal(rows.length,1);assert.equal(rows[0].slug,'sandbox');assert.equal(rows[0].game,'forever');assert.equal(rows[0].readiness.ready,true);assert.equal(rows[0].players,0);assert.equal(rows[0].analyticsAvailable,false);assert.ok(!JSON.stringify(rows).includes('OLD-'));
await resetPlatformForeverCode(pool,'sandbox','NEW-SECRET-123');assert.equal((await query("select master_code from guild_master_codes m join guilds g on g.id=m.guild_id where g.slug='sandbox'")).rows[0].master_code,'NEW-SECRET-123');
assert.equal((await query("select master_code from guild_master_codes m join guilds g on g.id=m.guild_id where g.slug='era'")).rows[0].master_code,'OLD-era');
await assert.rejects(resetPlatformForeverCode(pool,'era','NEW'),e=>e.statusCode===404);
let authorized=false;
const result=await openPlatformGuildLeadership({slug:'sandbox',game:'forever',masterCode:'platform'},{authorize:()=>{authorized=true;},foreverGuild:async slug=>{assert.ok(authorized);return {slug,name:'Elternabend'};},query:()=>{throw Error('Must not read Era');}});
assert.equal(result.requiresPin,true);assert.equal(result.leadershipCode,undefined);assert.equal(result.game,'forever');
await assert.rejects(openPlatformGuildLeadership({slug:'sandbox',game:'forever'},{authorize:()=>{throw Error('Denied');},foreverGuild:()=>{throw Error('Must not read guild before auth');}}),/Denied/);
await db.close();console.log('Platform Forever list, game isolation, readiness, code reset, credential-free leadership entry and auth checks passed.');
