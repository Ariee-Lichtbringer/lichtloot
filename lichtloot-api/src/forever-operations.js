import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
export const operationsSchema=readFileSync(new URL('./forever-loot.sql',import.meta.url),'utf8')+`
alter table forever_point_entries add column if not exists reversal_of uuid references forever_point_entries(id);
create unique index if not exists forever_points_reversal on forever_point_entries(guild_id,reversal_of) where reversal_of is not null;
create table if not exists forever_bank_items(id uuid primary key, guild_id uuid not null references guilds(id),name text not null,quantity integer not null default 0 check(quantity>=0),unique(guild_id,id),unique(guild_id,name));
create table if not exists forever_bank_requests(id uuid primary key,guild_id uuid not null,item_id uuid not null,player_id uuid not null references players(id),quantity integer not null check(quantity>0),reason text not null,status text not null default 'pending' check(status in ('pending','approved','rejected')),created_at timestamptz not null default now(),foreign key(guild_id,item_id) references forever_bank_items(guild_id,id));
create table if not exists forever_bank_journal(id uuid primary key,guild_id uuid not null,item_id uuid not null,amount integer not null,reason text not null,actor text not null,request_key uuid not null,created_at timestamptz not null default now(),unique(guild_id,request_key),foreign key(guild_id,item_id) references forever_bank_items(guild_id,id));
create table if not exists forever_mail(id uuid primary key,guild_id uuid not null references guilds(id),player_id uuid not null references players(id),subject text not null,message text not null,reply text not null default '',status text not null default 'open' check(status in ('open','closed')),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
`;
const fail=(m,s=400)=>Object.assign(new Error(m),{statusCode:s});
const uuid=v=>{if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(v)))throw fail('Ungültige Auswahl.');return v;};
const text=(v,max=2000)=>{const s=String(v||'').trim();if(!s||s.length>max)throw fail('Bitte Text mit höchstens '+max+' Zeichen eingeben.');return s;};
const whole=(v)=>{const n=Number(v);if(!Number.isInteger(n)||!n||Math.abs(n)>1000000)throw fail('Bitte eine ganze Zahl zwischen -1000000 und 1000000 eingeben (ohne 0).');return n;};
export const operationActions=['operationsOverview','pointAdjust','pointReverse','bankAdjust','bankRequest','bankDecision','mailCreate','mailReply'];
export function createForeverOperations({pool,query}){
 async function tx(fn){const db=await pool.connect();try{await db.query('begin');const result=await fn(db);await db.query('commit');return result;}catch(e){await db.query('rollback');throw e;}finally{db.release();}}
 const audit=(db,g,a,action,detail)=>db.query('insert into forever_audit(guild_id,actor,action,detail) values($1,$2,$3,$4)',[g.id,a.label,action,detail]);
 return {async run(g,a,b){
  if(b.action==='operationsOverview'){
   const balances=await query(`select c.id,c.name,c.class_name,coalesce(sum(p.amount),0)::text as points from forever_characters c left join forever_point_entries p on p.guild_id=c.guild_id and p.character_id=c.id where c.guild_id=$1 group by c.id order by c.name`,[g.id]);
   const journal=a.canAdmin?(await query('select p.*,c.name from forever_point_entries p join forever_characters c on c.guild_id=p.guild_id and c.id=p.character_id where p.guild_id=$1 order by p.created_at desc limit 200',[g.id])).rows:[];
   const items=(await query('select * from forever_bank_items where guild_id=$1 order by name',[g.id])).rows;
   const requests=(await query('select r.*,i.name,(select name from forever_characters where guild_id=r.guild_id and player_id=r.player_id order by created_at limit 1) as player_name from forever_bank_requests r join forever_bank_items i on i.guild_id=r.guild_id and i.id=r.item_id where r.guild_id=$1 and ($2::boolean or r.player_id=$3::uuid) order by r.created_at desc limit 200',[g.id,!!a.canAdmin,a.playerId||null])).rows;
   const mail=(await query('select m.*,(select name from forever_characters where guild_id=m.guild_id and player_id=m.player_id order by created_at limit 1) as player_name from forever_mail m where guild_id=$1 and ($2::boolean or player_id=$3::uuid) order by created_at desc limit 200',[g.id,!!a.canAdmin,a.playerId||null])).rows;
   return {success:true,balances:balances.rows,journal,items,requests,mail};
  }
  if(['bankRequest','mailCreate'].includes(b.action)){if(!a.playerId)throw fail('Bitte mit deinem SpielerLogin anmelden.',403);}else if(!a.canAdmin)throw fail('Nur die Gildenleitung darf diese Änderung vornehmen.',403);
  return tx(async db=>{
   // Serialize resource changes per guild, including idempotency and reversals.
   await db.query('select id from guilds where id=$1 for update',[g.id]);
   if(b.action==='pointAdjust'){
    const char=uuid(b.characterId),amount=whole(b.amount),reason=text(b.reason),key=uuid(b.requestKey);
    if(!(await db.query('select id from forever_characters where guild_id=$1 and id=$2',[g.id,char])).rows.length)throw fail('Charakter nicht gefunden.',404);
    const previous=(await db.query('select id from forever_point_entries where guild_id=$1 and request_key=$2',[g.id,key])).rows[0];if(previous)return {success:true,id:previous.id,replayed:true};
    const id=randomUUID();await db.query('insert into forever_point_entries(id,guild_id,character_id,amount,reason,created_by,request_key) values($1,$2,$3,$4,$5,$6,$7)',[id,g.id,char,amount,reason,a.label,key]);await audit(db,g,a,'points',`${char} · ${amount} · ${reason}`);return {success:true,id};
   }
   if(b.action==='pointReverse'){
    const row=(await db.query('select * from forever_point_entries where guild_id=$1 and id=$2',[g.id,uuid(b.id)])).rows[0];if(!row)throw fail('Buchung nicht gefunden.',404);if(row.reversal_of)throw fail('Eine Gegenbuchung kann nicht erneut storniert werden.');
    await db.query('insert into forever_point_entries(id,guild_id,character_id,raid_id,amount,reason,created_by,request_key,reversal_of) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict do nothing',[randomUUID(),g.id,row.character_id,row.raid_id,-Number(row.amount),'Storno: '+text(b.reason),a.label,'reverse:'+row.id,row.id]);await audit(db,g,a,'points_reverse',row.id);return {success:true};
   }
   if(b.action==='bankAdjust'){
    const amount=whole(b.amount),name=text(b.name,150),reason=text(b.reason),key=uuid(b.requestKey);
    if((await db.query('select id from forever_bank_journal where guild_id=$1 and request_key=$2',[g.id,key])).rows.length)return {success:true,replayed:true};
    await db.query('insert into forever_bank_items(id,guild_id,name) values($1,$2,$3) on conflict(guild_id,name) do nothing',[randomUUID(),g.id,name]);
    const item=(await db.query('select * from forever_bank_items where guild_id=$1 and name=$2 for update',[g.id,name])).rows[0];if(item.quantity+amount<0)throw fail('Nicht genügend Bestand.',409);
    await db.query('update forever_bank_items set quantity=quantity+$3 where guild_id=$1 and id=$2',[g.id,item.id,amount]);await db.query('insert into forever_bank_journal(id,guild_id,item_id,amount,reason,actor,request_key) values($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),g.id,item.id,amount,reason,a.label,key]);await audit(db,g,a,'bank',name+' · '+amount);return {success:true};
   }
   if(b.action==='bankRequest'){
    const quantity=whole(b.quantity);if(quantity<1)throw fail('Menge muss positiv sein.');if(!(await db.query('select id from forever_bank_items where guild_id=$1 and id=$2',[g.id,uuid(b.itemId)])).rows.length)throw fail('Gegenstand nicht gefunden.',404);
    await db.query('insert into forever_bank_requests(id,guild_id,item_id,player_id,quantity,reason) values($1,$2,$3,$4,$5,$6)',[randomUUID(),g.id,b.itemId,a.playerId,quantity,text(b.reason)]);await audit(db,g,a,'bank_request',b.itemId);return {success:true};
   }
   if(b.action==='bankDecision'){
    if(!['approved','rejected'].includes(b.status))throw fail('Ungültige Entscheidung.');const request=(await db.query('select * from forever_bank_requests where guild_id=$1 and id=$2 for update',[g.id,uuid(b.id)])).rows[0];if(!request)throw fail('Antrag nicht gefunden.',404);if(request.status!=='pending')throw fail('Antrag bereits bearbeitet.',409);
    if(b.status==='approved'){const item=(await db.query('select * from forever_bank_items where guild_id=$1 and id=$2 for update',[g.id,request.item_id])).rows[0];if(item.quantity<request.quantity)throw fail('Nicht genügend Bestand.',409);await db.query('update forever_bank_items set quantity=quantity-$3 where guild_id=$1 and id=$2',[g.id,item.id,request.quantity]);await db.query('insert into forever_bank_journal(id,guild_id,item_id,amount,reason,actor,request_key) values($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),g.id,item.id,-request.quantity,'Freigabe Antrag '+request.id,a.label,request.id]);}
    await db.query('update forever_bank_requests set status=$3 where guild_id=$1 and id=$2',[g.id,request.id,b.status]);await audit(db,g,a,'bank_decision',request.id+' · '+b.status);return {success:true};
   }
   if(b.action==='mailCreate'){await db.query('insert into forever_mail(id,guild_id,player_id,subject,message) values($1,$2,$3,$4,$5)',[randomUUID(),g.id,a.playerId,text(b.subject,150),text(b.message,4000)]);return {success:true};}
   if(b.action==='mailReply'){if(!['open','closed'].includes(b.status))throw fail('Ungültiger Status.');const result=await db.query('update forever_mail set reply=$3,status=$4,updated_at=now() where guild_id=$1 and id=$2 returning id',[g.id,uuid(b.id),text(b.reply,4000),b.status]);if(!result.rows.length)throw fail('Nachricht nicht gefunden.',404);await audit(db,g,a,'mail_reply',b.id);return {success:true};}
   throw fail('Unbekannte Aktion.');
  });
 }};
}
