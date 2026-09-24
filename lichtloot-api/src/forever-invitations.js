import {randomUUID} from 'node:crypto';
const fail=(m,s=400)=>Object.assign(new Error(m),{statusCode:s});
export function createInvitations({query,eraQuery,pool,access}){
 let ready;const ensure=()=>ready ||= query(`create table if not exists forever_invitations(id uuid primary key,guild_id uuid not null references guilds(id),raid_id uuid not null,recipient_id text not null,recipient_name text not null,message text not null,status text not null default 'pending',error text not null default '',message_id text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(guild_id,raid_id,recipient_id),foreign key(guild_id,raid_id) references forever_raids(guild_id,id))`).catch(e=>{ready=null;throw e;});
 const members=async()=> (await eraQuery("select g.slug as source,m.user_id as id,m.username,coalesce(nullif(m.display_name,''),m.username) as name,m.updated_at from discord_bot_members m join guilds g on g.id=m.guild_id where g.slug in ('lichtloot','nachtloot') and not m.bot order by g.slug,lower(coalesce(nullif(m.display_name,''),m.username))")).rows;
 return {
 async run(body){
  const guild=await access.requireGuild(body.guild),actor=await access.authorize(guild,body);
  if(guild.slug!=='lichtbringer-forever'||!actor.canAdmin)throw fail('Nur die Lichtbringer-Forever-Gildenleitung darf diese Mitglieder auswählen.',403);
  await ensure();const raid=(await query("select r.*,p.message_id,p.channel_id,p.discord_guild_id from forever_raids r left join forever_discord_posts p on p.guild_id=r.guild_id and p.raid_id=r.id where r.guild_id=$1 and r.id=$2 and r.deleted_at is null",[guild.id,body.raidId])).rows[0];if(!raid)throw fail('Raid nicht gefunden.',404);
  const list=await members();
  if(body.action==='list')return {success:true,members:list,raid:{title:raid.title,startsAt:raid.starts_at,description:raid.description},link:raid.message_id?'https://discord.com/channels/'+raid.discord_guild_id+'/'+raid.channel_id+'/'+raid.message_id:null,deliveries:(await query('select recipient_id,recipient_name,status,error from forever_invitations where guild_id=$1 and raid_id=$2',[guild.id,raid.id])).rows};
  if(body.action!=='send')throw fail('Unbekannte Aktion.');
  if(!raid.message_id||new Date(raid.starts_at)<=new Date()||['cancelled','completed','archived'].includes(raid.status))throw fail('Bitte zuerst einen kommenden aktiven Raid in Discord veröffentlichen.');
  const recipients=[...new Set(Array.isArray(body.recipients)?body.recipients:[])],message=String(body.message||'').trim();
  if(!recipients.length||recipients.length>50||recipients.some(id=>!list.some(m=>m.id===id)))throw fail('Bitte 1–50 Mitglieder aus der Liste auswählen.');
  if(message.length<10||message.length>2000)throw fail('Die Nachricht muss 10–2000 Zeichen lang sein.');
  const db=await pool.connect();let count=0;
  try{await db.query('begin');for(const id of recipients){const result=await db.query("insert into forever_invitations(id,guild_id,raid_id,recipient_id,recipient_name,message) values($1,$2,$3,$4,$5,$6) on conflict(guild_id,raid_id,recipient_id) do nothing returning id",[randomUUID(),guild.id,raid.id,id,list.find(m=>m.id===id).name,message]);count+=result.rows.length;}await db.query('commit');}catch(e){await db.query('rollback');throw e;}finally{db.release();}
  return {success:true,message:count+' Einladungen zum Versand vorgemerkt. Bereits benachrichtigte oder vorgemerkte Mitglieder werden nicht doppelt angeschrieben.'};
 },
 async bot(body){await ensure();
  if(body.action==='invitationPoll'){const jobs=await query("update forever_invitations set status='sending',updated_at=now() where id in (select i.id from forever_invitations i join forever_raids r on r.id=i.raid_id and r.guild_id=i.guild_id where i.status='pending' and r.deleted_at is null and r.status not in ('cancelled','completed','archived') and r.starts_at>now() order by i.created_at limit 10 for update of i skip locked) returning id,recipient_id,message");return {success:true,jobs:jobs.rows};}
  if(body.action==='invitationAck'){await query("update forever_invitations set status=$2,error=$3,message_id=$4,updated_at=now() where id=$1 and status='sending'",[body.id,body.success?'sent':'failed',String(body.error||'').slice(0,250),body.messageId||null]);return {success:true};}
  throw fail('Unbekannte Aktion.');
 }
 };
}
export function installInvitations(app,service,rateLimit){app.post('/api/forever/invitations',async(req,res,next)=>{res.set('Cache-Control','no-store');try{rateLimit(req,'forever-invitations',30,60000);res.json(await service.run(req.body||{}));}catch(e){next(e);}});}
