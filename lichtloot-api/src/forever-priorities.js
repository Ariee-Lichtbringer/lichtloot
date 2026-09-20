import {randomUUID} from 'node:crypto';
export const prioritySchema=`
create table if not exists forever_loot_catalog(guild_id uuid not null references guilds(id),kind text not null,item_id bigint not null check(item_id>0),name text not null,p0 boolean not null default false,primary key(guild_id,kind,item_id));
create table if not exists forever_loot_awards(id uuid primary key,guild_id uuid not null,raid_id uuid not null,character_id uuid not null,item_id bigint not null,item_name text not null,reason text not null,created_by text not null,created_at timestamptz not null default now(),request_key uuid not null,unique(guild_id,request_key),foreign key(guild_id,raid_id) references forever_raids(guild_id,id),foreign key(guild_id,character_id) references forever_characters(guild_id,id));
alter table forever_loot_awards add column if not exists void_reason text;
create table if not exists forever_p0_approvals(guild_id uuid not null,raid_id uuid not null,character_id uuid not null,approved boolean not null,actor text not null,primary key(guild_id,raid_id,character_id),foreign key(guild_id,raid_id) references forever_raids(guild_id,id),foreign key(guild_id,character_id) references forever_characters(guild_id,id));
`;
const fail=(m,s=400)=>Object.assign(new Error(m),{statusCode:s});
const id=v=>{if(!/^[0-9a-f-]{36}$/i.test(String(v)))throw fail('Ungültige Auswahl.');return v;};
const kinds=['hyjal','barrow','onyxia','dungeon','other'];
export const priorityActions=['lootOverview','lootItemSave','prioritySave','lootAward','p0Approval','lootVoid'];
export function createForeverPriorities({pool,query}){
 async function tx(fn){const db=await pool.connect();try{await db.query('begin');const r=await fn(db);await db.query('commit');return r;}catch(e){await db.query('rollback');throw e;}finally{db.release();}}
 return {async run(g,a,b){
  if(b.action==='lootOverview'){
   if(!kinds.includes(b.kind))throw fail('Raidziel fehlt.');const items=(await query('select * from forever_loot_catalog where guild_id=$1 and kind=$2 order by name',[g.id,b.kind])).rows;
   let priorities=[],awards=[],approvals=[];if(b.raidId){const raid=(await query('select * from forever_raids where guild_id=$1 and id=$2',[g.id,id(b.raidId)])).rows[0];if(!raid)throw fail('Raid nicht gefunden.',404);
    priorities=(await query(`select p.*,c.name as character_name,i.name as item_name from forever_priority_entries p join forever_characters c on c.guild_id=p.guild_id and c.id=p.character_id join forever_loot_catalog i on i.guild_id=p.guild_id and i.kind=$3 and i.item_id=p.item_id where p.guild_id=$1 and p.raid_id=$2 and ($4::boolean or c.player_id=$5::uuid) order by c.name,p.priority`,[g.id,raid.id,raid.kind,!!a.canManage||new Date(raid.starts_at)<=new Date(),a.playerId||null])).rows;
    awards=(await query('select l.*,c.name as character_name from forever_loot_awards l join forever_characters c on c.guild_id=l.guild_id and c.id=l.character_id where l.guild_id=$1 and l.raid_id=$2 order by l.created_at desc',[g.id,raid.id])).rows;
   approvals=(await query('select character_id,approved from forever_p0_approvals where guild_id=$1 and raid_id=$2',[g.id,raid.id])).rows;}return {success:true,items,priorities,awards,approvals};
  }
  if(b.action==='lootItemSave'){
   if(!a.canAdmin)throw fail('Nur die Gildenleitung darf Lootlisten bearbeiten.',403);const item=Number(b.itemId),name=String(b.name||'').trim();if(!kinds.includes(b.kind)||!Number.isSafeInteger(item)||item<1||!name||name.length>200)throw fail('Bitte Raid, gültige Item-ID und Namen eingeben.');
   return tx(async db=>{await db.query('insert into forever_loot_catalog(guild_id,kind,item_id,name,p0) values($1,$2,$3,$4,$5) on conflict(guild_id,kind,item_id) do update set name=excluded.name,p0=excluded.p0',[g.id,b.kind,item,name,b.p0===true]);await db.query('insert into forever_audit(guild_id,actor,action,detail) values($1,$2,$3,$4)',[g.id,a.label,'loot_catalog',b.kind+' · '+name]);return {success:true};});
  }
  return tx(async db=>{
   const raid=(await db.query('select * from forever_raids where guild_id=$1 and id=$2 for update',[g.id,id(b.raidId)])).rows[0];if(!raid)throw fail('Raid nicht gefunden.',404);
   const char=(await db.query('select * from forever_characters where guild_id=$1 and id=$2',[g.id,id(b.characterId)])).rows[0];if(!char)throw fail('Charakter nicht gefunden.',404);
   if(b.action==='p0Approval'){if(!a.canAdmin)throw fail('Nur die Gildenleitung darf P0 freigeben.',403);await db.query('insert into forever_p0_approvals(guild_id,raid_id,character_id,approved,actor) values($1,$2,$3,$4,$5) on conflict(guild_id,raid_id,character_id) do update set approved=excluded.approved,actor=excluded.actor',[g.id,raid.id,char.id,b.approved===true,a.label]);if(b.approved!==true)await db.query('delete from forever_priority_entries where guild_id=$1 and raid_id=$2 and character_id=$3 and priority=0',[g.id,raid.id,char.id]);await db.query('insert into forever_audit(guild_id,raid_id,actor,action,detail) values($1,$2,$3,$4,$5)',[g.id,raid.id,a.label,'p0_approval',char.name+' · '+(b.approved===true)]);return {success:true};}
   if(b.action==='lootVoid'){if(!a.canAdmin&&!a.canLoot)throw fail('Nur die Gildenleitung oder der zugewiesene Plündermeister darf Vergaben stornieren.',403);const reason=String(b.reason||'').trim();if(!reason||reason.length>2000)throw fail('Bitte eine Begründung eingeben.');const r=await db.query('update forever_loot_awards set void_reason=$4 where guild_id=$1 and raid_id=$2 and id=$3 and character_id=$5 and void_reason is null returning id',[g.id,raid.id,id(b.id),reason,char.id]);if(!r.rows.length)throw fail('Vergabe nicht gefunden oder bereits storniert.',409);await db.query('insert into forever_audit(guild_id,raid_id,actor,action,detail) values($1,$2,$3,$4,$5)',[g.id,raid.id,a.label,'loot_void',b.id+' · '+reason]);return {success:true};}
   if(b.action==='prioritySave'){
    if(!a.playerId||char.player_id!==a.playerId)throw fail('Bitte eigenen Charakter auswählen.',403);
    if(!['open','closed'].includes(raid.status)||new Date(raid.starts_at)<=new Date())throw fail('Die Prio-Auswahl ist geschlossen.',409);
    const signup=(await db.query("select character_id from forever_signups where guild_id=$1 and raid_id=$2 and player_id=$3 and status in ('signed','bench','late','tentative')",[g.id,raid.id,a.playerId])).rows[0];if(signup?.character_id!==char.id)throw fail('Bitte diesen Charakter zuerst für den Raid anmelden.',409);
    if(!Array.isArray(b.priorities)||b.priorities.length>4)throw fail('Ungültige Prioritäten.');const slots=new Set(),items=new Set();
    for(const p of b.priorities){if(!Number.isInteger(p.priority)||p.priority<0||p.priority>3||slots.has(p.priority)||items.has(Number(p.itemId)))throw fail('Jeder Platz und Gegenstand darf nur einmal gewählt werden.');const item=(await db.query('select p0 from forever_loot_catalog where guild_id=$1 and kind=$2 and item_id=$3',[g.id,raid.kind,Number(p.itemId)])).rows[0];if(!item||(p.priority===0&&!item.p0))throw fail('Dieses Item ist für diese Priorität nicht freigegeben.');if(p.priority===0&&!(await db.query('select character_id from forever_p0_approvals where guild_id=$1 and raid_id=$2 and character_id=$3 and approved',[g.id,raid.id,char.id])).rows.length)throw fail('Für P0 ist eine Freigabe der Leitung erforderlich.',403);slots.add(p.priority);items.add(Number(p.itemId));}
    await db.query('delete from forever_priority_entries where guild_id=$1 and raid_id=$2 and character_id in (select id from forever_characters where guild_id=$1 and player_id=$3)',[g.id,raid.id,a.playerId]);
    for(const p of b.priorities)await db.query('insert into forever_priority_entries(id,guild_id,character_id,raid_id,item_id,priority) values($1,$2,$3,$4,$5,$6)',[randomUUID(),g.id,char.id,raid.id,Number(p.itemId),p.priority]);
    await db.query('insert into forever_audit(guild_id,raid_id,actor,action,detail) values($1,$2,$3,$4,$5)',[g.id,raid.id,a.label,'priority',char.name]);return {success:true};
   }
   if(b.action==='lootAward'){
    if(!a.canAdmin&&!a.canLoot)throw fail('Nur die Gildenleitung oder der zugewiesene Plündermeister darf Loot vergeben.',403);if(['cancelled','archived'].includes(raid.status))throw fail('Dieser Raid ist geschlossen.',409);
    const key=id(b.requestKey),reason=String(b.reason||'').trim();if(!reason||reason.length>2000)throw fail('Bitte eine Begründung eingeben.');
    const item=(await db.query('select * from forever_loot_catalog where guild_id=$1 and kind=$2 and item_id=$3',[g.id,raid.kind,Number(b.itemId)])).rows[0];if(!item)throw fail('Gegenstand fehlt in der Lootliste.');
    if(!(await db.query("select character_id from forever_signups where guild_id=$1 and raid_id=$2 and character_id=$3 and attendance='present'",[g.id,raid.id,char.id])).rows.length)throw fail('Die tatsächliche Teilnahme muss zuerst erfasst werden.',409);
    await db.query('insert into forever_loot_awards(id,guild_id,raid_id,character_id,item_id,item_name,reason,created_by,request_key) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(guild_id,request_key) do nothing',[randomUUID(),g.id,raid.id,char.id,item.item_id,item.name,reason,a.label,key]);await db.query('insert into forever_audit(guild_id,raid_id,actor,action,detail) values($1,$2,$3,$4,$5)',[g.id,raid.id,a.label,'loot_award',char.name+' · '+item.name]);return {success:true};
   }throw fail('Unbekannte Aktion.');
  });
 }};
}
