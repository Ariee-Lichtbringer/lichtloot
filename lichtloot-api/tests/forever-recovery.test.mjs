import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {installForeverRegistration} from '../src/forever-registration.js';
import {hashSecurityAnswer} from '../src/auth-security.js';
import {foreverSchema} from '../src/forever-raids.js';
const {PGlite}=await import(process.env.FOREVER_PGLITE||'@electric-sql/pglite'),db=new PGlite();await db.exec(await readFile(new URL('../src/forever-core.sql',import.meta.url),'utf8'));await db.exec(foreverSchema);
const gid=randomUUID(),pid=randomUUID(),cid=randomUUID();await db.query('insert into guilds(id,slug,name) values($1,$2,$3)',[gid,'test','Test']);await db.query("insert into players(id,guild_id,player_pin,approval_status,security_question,security_answer) values($1,$2,'OLDLOGIN','approved','Frage?', $3)",[pid,gid,await hashSecurityAnswer('Antwort')]);await db.query("insert into forever_characters(id,guild_id,player_id,name,ruleset,class_name,role) values($1,$2,$3,'Ariee Mondlichtung','normal','priest','heal')",[cid,gid,pid]);
const handlers={};installForeverRegistration({post:(path,fn)=>handlers[path]=fn},{query:db.query.bind(db),rateLimit(){},explicitGuild:g=>g,requireGuild:async g=>{if(g!=='test')throw Error('Guild');return {id:gid};},requireForeverGuild:async()=>{}});
async function recover(body){let result,error;await handlers['/api/forever/recover']({body},{set(){},json:r=>result=r},e=>error=e);if(error)throw error;return result;}
const input={guild:'test',firstName:'Ariee',lastName:'Mondlichtung',question:'Frage?',answer:'Antwort',newPin:'NEWLOGIN123'};
await assert.rejects(recover({...input,answer:'Falsch'}),e=>e.statusCode===403);assert.equal((await db.query('select player_pin from players')).rows[0].player_pin,'OLDLOGIN');assert.equal((await recover(input)).success,true);assert.equal((await db.query('select player_pin from players')).rows[0].player_pin,'NEWLOGIN123');await db.query('update players set is_blocked=true');await assert.rejects(recover(input),e=>e.statusCode===403);await db.close();console.log('Recovery passed: hashed answer verification, rejection leaves code unchanged, successful reset, blocked account rejected.');
