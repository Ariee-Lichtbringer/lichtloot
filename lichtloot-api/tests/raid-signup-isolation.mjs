import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const {PGlite} = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const src = fs.readFileSync(process.env.SIGNUP_TEST_SOURCE || new URL('../src/server.js', import.meta.url), 'utf8');
const extract = name => {
  const start = src.indexOf(`async function ${name}(`);
  assert.ok(start >= 0);
  return src.slice(start, src.indexOf('\n}\n', start) + 2);
};
try {
 await db.exec(`
 create table players(id text primary key,guild_id text);
 create table characters(id text primary key,player_id text,name text);
 create table raids(id text primary key,guild_id text,raid_type text,raid_date date,raid_time text,raid_pin text,external_raid_id text,status text,raidhelper_enabled boolean);
 create table raid_signups(raid_id text,character_id text,status text,note text,role text,source text,discord_user_id text,discord_name text,staff_benched boolean,updated_at timestamptz,primary key(raid_id,character_id));
 create table raid_external_signups(guild_id text,raid_id text,player_name text,player_pin text,discord_user_id text);
 create table po_post_entries(guild_id text,raid_pin text,player_name text,discord_user_id text,archived_at timestamptz,post_key text,source_channel_id text,target_channel_id text,discord_message_id text,raid text,title text);
 insert into players values('account','g');
 insert into characters values('main','account','Main'),('alt','account','Alt');
 insert into raids values
 ('first','g','zg-prime','2099-09-12','22:00','PIN1','public1','geschlossen',true),
 ('second','g','zg-prime','2099-09-12','23:00','PIN2','public2','geschlossen',true),
 ('late','g','zg-late','2099-09-12','23:30','PIN3','public3','geschlossen',true);
 `);
 const query = async (sql, params) => {const r=await db.query(sql,params);return {...r,rowCount:r.affectedRows??r.rows.length};};
 const ctx = vm.createContext({
  query, clean:v=>String(v??'').trim(), normalizePin:v=>v,
  raidTypeSearchValues:v=>[v],normalizeSignupStatus:v=>v||'signed',normalizeSignupRole:v=>v||'flex',normalizePlayerApprovalStatus:v=>v,
  findRaid:async(g,p)=>(await query('select * from raids where guild_id=$1 and id=$2',[g,p.raidId])).rows[0],
  findCharacterForPin:async(g,p,name)=>p==='LOGIN'?(await query("select c.*, 'approved' as approval_status from characters c join players p on p.id=c.player_id where p.guild_id=$1 and c.name=$2",[g,name])).rows[0]:null,
  getRaidHelper:async()=>null,normalizeRaidRow:r=>r,normalizeRaidSignupRow:r=>r,
  ensurePoPostEntriesSchema:async()=>{},deletePoSignupPrioForEntry:async()=>{},enqueueBotUpdate:async()=>({success:true}),console
 });
 for(const name of ['deletePoEntriesAfterRaidSignupChange','saveRaidSignup','deleteRaidSignup'])vm.runInContext(extract(name),ctx);
 const signup=(raidId,char='Main')=>ctx.saveRaidSignup({guildId:'g',query:{raidId,char,playerPin:'LOGIN'}});
 await signup('first');await signup('second');await signup('late');
 // Real SQL for normal and imported signups plus all three PO post aliases.
 for(const [raid,pin,pub] of [['first','PIN1','public1'],['second','PIN2','public2'],['late','PIN3','public3']]){
  await query("insert into raid_external_signups values('g',$1,'Alt','LOGIN','')",[raid]);
  for(const key of [raid,pin,pub])await query("insert into po_post_entries(guild_id,raid_pin,player_name,discord_user_id) values('g',$1,'Main','')",[key]);
 }
 await signup('second','Alt');
 assert.deepEqual((await query('select raid_id,character_id from raid_signups order by raid_id')).rows,[{raid_id:'first',character_id:'main'},{raid_id:'late',character_id:'main'},{raid_id:'second',character_id:'alt'}], 'Switching in second occurrence preserves first and Late');
 assert.deepEqual((await query('select raid_id from raid_external_signups order by raid_id')).rows.map(r=>r.raid_id),['first','late']);
 assert.deepEqual((await query('select raid_pin from po_post_entries order by raid_pin')).rows.map(r=>r.raid_pin),['PIN1','PIN3','first','late','public1','public3'],'Only selected occurrence PO aliases are deleted');
 await signup('second','Main');
 await ctx.deleteRaidSignup({guildId:'g',query:{raidId:'second',char:'Main',playerPin:'LOGIN'}});
 assert.deepEqual((await query('select raid_id from raid_signups order by raid_id')).rows.map(r=>r.raid_id),['first','late'],'Unregistering leaves other occurrences intact');
 // Execute the production prerequisite query, rather than a mocked yes/no answer.
 const prio=extract('savePrio');
 const block=prio.slice(prio.indexOf('const signupResult = await client.query('));
 const sql=block.match(/`([\s\S]*?)`/)[1];
 const args=block.match(/`,\s*(\[[\s\S]*?\])\s*\);/)[1];
 const hasSignup=async(id)=>{
  ctx.guildId='g';ctx.savedRaidForSignupCheck=(await query('select * from raids where id=$1',[id])).rows[0];ctx.character={player_id:'account'};
  return (await query(sql,vm.runInContext(args,ctx))).rows.length>0;
 };
 assert.equal(await hasSignup('second'),false,'Other occurrence cannot satisfy prerequisite');
 assert.equal(await hasSignup('first'),true,'Existing account signup satisfies prerequisite');
 await query("update raid_signups set status='absent' where raid_id='first'");
 assert.equal(await hasSignup('first'),false,'Absent signup does not satisfy prerequisite');
 await signup('first','Alt');assert.equal(await hasSignup('first'),true,'Another character of the account may satisfy prerequisite in the SAME raid');
 for(const status of ['archiviert','archive','archived','gelöscht','geloescht','deleted','abgesagt','cancelled','canceled']){
  await query('update raids set status=$1 where id=$2',[status,'second']);
  await assert.rejects(()=>signup('second'),e=>e.statusCode===409);
 }
 await query("update raids set status='geschlossen',raidhelper_enabled=false where id='second'");
 await assert.rejects(()=>signup('second'),e=>e.statusCode===409);
 assert.equal((await query("select * from raid_signups where raid_id='second'")).rows.length,0,'Rejected saves have no writes');
 await query("update raids set raidhelper_enabled=true where id='second'");
 await signup('second');
 assert.equal((await query("select * from raid_signups where raid_id='second'")).rows.length,1,'Closed prio publication does not disable signup');
 console.log('PASS: exact occurrence isolation for signup, unregister, PO cleanup, imports and prio prerequisites; inactive raids reject writes; active closed-prio raids work.');
} finally {await db.close();}
