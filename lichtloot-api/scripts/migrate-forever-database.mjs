// Run once with SOURCE_DATABASE_URL and FOREVER_DATABASE_URL. Never logs credentials.
// The old Forever rows remain as a read-only rollback copy. Era rows are untouched.
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {foreverSchema} from '../src/forever-raids.js';
const ssl={rejectUnauthorized:false};
if(!process.env.SOURCE_DATABASE_URL||!process.env.FOREVER_DATABASE_URL||process.env.SOURCE_DATABASE_URL===process.env.FOREVER_DATABASE_URL)throw Error('Two different databases are required.');
const source=new pg.Client({connectionString:process.env.SOURCE_DATABASE_URL,ssl}),target=new pg.Client({connectionString:process.env.FOREVER_DATABASE_URL,ssl});
const tables=['guilds','guild_settings','guild_master_codes','players','characters','forever_groups','forever_characters','forever_raids','forever_signups','forever_audit'];
const quote=v=>'"'+v.replaceAll('"','""')+'"';
try{
 await source.connect();await target.connect();
 await target.query('begin');
 await target.query(await readFile(new URL('../src/forever-core.sql',import.meta.url),'utf8'));
 await target.query(foreverSchema);
 await target.query(await readFile(new URL('../src/forever-loot.sql',import.meta.url),'utf8'));
 if(Number((await target.query('select count(*) from guilds')).rows[0].count))throw Error('Target is not empty. Refusing to overwrite.');
 await source.query('begin');
 await source.query('set local lock_timeout=\'10s\'');
 await source.query('lock table '+tables.map(quote).join(',')+' in share row exclusive mode');
 const ids=(await source.query("select guild_id from guild_settings where layout_json->>'game'='forever'")).rows.map(r=>r.guild_id);
 if(!ids.length)throw Error('No Forever guilds to migrate.');
 for(const table of ['raids','p0plus_points']){const count=await source.query('select count(*) from '+quote(table)+' where guild_id=any($1)',[ids]);if(Number(count.rows[0].count))throw Error('Unexpected legacy Forever data in '+table+'; map this before migration.');}
 const priorities=await source.query('select count(*) from prios where character_id in (select c.id from characters c join players p on p.id=c.player_id where p.guild_id=any($1))',[ids]);if(Number(priorities.rows[0].count))throw Error('Unexpected legacy Forever priorities; map before migration.');
 const report={};
 for(const t of tables){const predicate=t==='guilds'?'id=any($1)':t==='characters'?'player_id in (select id from players where guild_id=any($1))':'guild_id=any($1)';const {rows}=await source.query('select * from '+quote(t)+' where '+predicate,[ids]);for(const row of rows){const cols=Object.keys(row);await target.query('insert into '+quote(t)+' ('+cols.map(quote).join(',')+') values('+cols.map((_,i)=>'$'+(i+1)).join(',')+')',cols.map(k=>row[k]!==null&&typeof row[k]==='object'&&!(row[k] instanceof Date)?JSON.stringify(row[k]):row[k]));}
 const copied=await target.query('select * from '+quote(t)+' order by 1');
 // Exact row equality, including existing access codes and recovery hashes.
 const canonical=row=>JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))));
 if(JSON.stringify(rows.map(canonical).sort())!==JSON.stringify(copied.rows.map(canonical).sort()))throw Error('Verification failed: '+t);
 report[t]=rows.length;
 }
 await target.query("select setval(pg_get_serial_sequence('forever_audit','id'),coalesce((select max(id) from forever_audit),1),(select count(*)>0 from forever_audit))");
 // Freeze only the migrated guild IDs, allowing all Era writes to continue.
 await source.query(`create or replace function block_migrated_forever_write() returns trigger language plpgsql as $$
 declare row_guild uuid; row_data jsonb;
 begin
 row_data=case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
 if TG_TABLE_NAME='guilds' then row_guild=(row_data->>'id')::uuid;
 elsif TG_TABLE_NAME='characters' then select guild_id into row_guild from players where id=(row_data->>'player_id')::uuid;
 else row_guild=(row_data->>'guild_id')::uuid; end if;
 if row_guild=any(ARRAY[${ids.map(id=>"'"+id+"'::uuid").join(',')}]) then raise exception 'Forever wurde in eine eigene Datenbank verschoben. Bitte die Forever-Seite verwenden.'; end if;
 if TG_OP='DELETE' then return OLD; end if;return NEW;
 end $$`);
 for(const t of tables){await source.query('create trigger forever_migrated_readonly before insert or update or delete on '+quote(t)+' for each row execute function block_migrated_forever_write()');}
 await target.query('commit');await source.query('commit');
 console.log(JSON.stringify({verified:true,sourceForeverReadOnly:true,counts:report}));
}catch(error){await source.query('rollback').catch(()=>{});await target.query('rollback').catch(()=>{});throw error;}finally{await source.end();await target.end();}
