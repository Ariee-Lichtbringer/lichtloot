import {randomUUID,timingSafeEqual} from 'node:crypto';
const fail=(m,s=400)=>Object.assign(new Error(m),{statusCode:s});
const snow=v=>{const s=String(v||'');if(!/^\d{17,20}$/.test(s))throw fail('Ungültige Discord-ID.');return s;};
export const foreverDiscordSchema=`
create table if not exists forever_discord_channels(guild_id uuid primary key references guilds(id),discord_guild_id text not null,channel_id text not null,updated_at timestamptz not null default now());
create table if not exists forever_discord_links(guild_id uuid not null references guilds(id),discord_user_id text not null,player_id uuid not null references players(id),created_at timestamptz not null default now(),primary key(guild_id,discord_user_id),unique(guild_id,player_id));
create table if not exists forever_discord_posts(guild_id uuid not null,raid_id uuid not null,discord_guild_id text not null,channel_id text not null,message_id text,lease_token uuid,lease_until timestamptz,content_hash text not null default '',last_error text not null default '',updated_at timestamptz not null default now(),primary key(guild_id,raid_id),foreign key(guild_id,raid_id) references forever_raids(guild_id,id));`;
export async function publishForeverDiscord(query,guild,actor,body){
 if(!actor.canManage)throw fail('Nur die Raidleitung darf Discord-Anmelder veröffentlichen.',403);
 await query(foreverDiscordSchema);
 const raid=(await query('select id from forever_raids where guild_id=$1 and id=$2',[guild.id,body.raidId])).rows[0];if(!raid)throw fail('Raid nicht gefunden.',404);
 const config=(await query('select * from forever_discord_channels where guild_id=$1',[guild.id])).rows[0];if(!config)throw fail('Verbinde zuerst den Discord-Kanal mit /forever_verbinden.',409);
 await query(`insert into forever_discord_posts(guild_id,raid_id,discord_guild_id,channel_id) values($1,$2,$3,$4) on conflict(guild_id,raid_id) do update set message_id=case when forever_discord_posts.last_error like 'Discord-Nachricht fehlt%' then null else forever_discord_posts.message_id end,content_hash='',last_error='',updated_at=now()`,[guild.id,raid.id,config.discord_guild_id,config.channel_id]);
 return {success:true,message:'Der Forever-Anmelder wird im verbundenen Discord-Kanal veröffentlicht bzw. aktualisiert.'};
}
export function createForeverDiscord({query,pool,access,raids}){
 let ready;const ensure=()=>ready||=query(foreverDiscordSchema).catch(e=>{ready=null;throw e;});
 const attempts=new Map();
 async function snapshot(post){const guild=await access.requireGuild(post.slug);const result=await raids.run(guild,{label:'Discord',canManage:false},{action:'overview',archive:post.archived,raidId:post.raid_id});const raid=result.raids.find(r=>r.id===post.raid_id);if(!raid)return null;return {guild:{slug:guild.slug,name:guild.name},raid,channelId:post.channel_id,discordGuildId:post.discord_guild_id,messageId:post.message_id,hash:post.content_hash,lastError:post.last_error};}
 async function published(body){const guild=await access.requireGuild(body.guild);const p=(await query('select * from forever_discord_posts where guild_id=$1 and raid_id=$2',[guild.id,body.raidId])).rows[0];if(!p||p.message_id!==snow(body.messageId)||p.channel_id!==snow(body.channelId)||p.discord_guild_id!==snow(body.discordGuildId))throw fail('Dieser Discord-Post gehört nicht zu diesem Raid.',403);return {guild,post:p};}
 async function actor(guild,user){const p=(await query("select p.id,p.role,(select c.name from forever_characters c where c.guild_id=p.guild_id and c.player_id=p.id order by c.created_at limit 1) as name from forever_discord_links l join players p on p.id=l.player_id and p.guild_id=l.guild_id where l.guild_id=$1 and l.discord_user_id=$2 and p.approval_status='approved' and not p.is_blocked",[guild.id,snow(user)])).rows[0];if(!p)throw fail('Bitte deinen Forever-SpielerLogin verbinden.',401);return {playerId:p.id,canManage:false,canAdmin:false,label:p.name||'Discord-Spieler'};}
 return {async run(body){
 await ensure();const action=body.action;
 if(action==='configure'){
  const key='config:'+String(body.guild)+':'+snow(body.discordGuildId),now=Date.now(),previous=attempts.get(key);const attempt=previous&&previous.until>now?previous:{n:0,until:now+15*60e3};if(++attempt.n>5)throw fail('Zu viele Verbindungsversuche. Bitte in 15 Minuten erneut versuchen.',429);attempts.set(key,attempt);
  const guild=await access.requireGuild(body.guild),a=await access.authorize(guild,{masterCode:body.masterCode});if(!a.canAdmin)throw fail('Leitungscode erforderlich.',403);
  await query('insert into forever_discord_channels(guild_id,discord_guild_id,channel_id) values($1,$2,$3) on conflict(guild_id) do update set discord_guild_id=$2,channel_id=$3,updated_at=now()',[guild.id,snow(body.discordGuildId),snow(body.channelId)]);attempts.delete(key);return {success:true,guild:guild.name};
 }
 if(action==='poll'){
  const rows=(await query("select p.*,g.slug,(r.starts_at<now() or r.status in ('completed','cancelled')) as archived from forever_discord_posts p join guilds g on g.id=p.guild_id join forever_raids r on r.guild_id=p.guild_id and r.id=p.raid_id where r.starts_at>now()-interval '30 days' and ($1::uuid is null or (p.guild_id,p.raid_id)>($1::uuid,$2::uuid)) order by p.guild_id,p.raid_id limit 100",[body.cursor?.guildId||null,body.cursor?.raidId||null])).rows;
  const posts=[];for(const p of rows){const s=await snapshot(p);if(s)posts.push(s);}return {success:true,posts,cursor:rows.length===100?{guildId:rows.at(-1).guild_id,raidId:rows.at(-1).raid_id}:null};
 }
 if(['claim','ack','failed'].includes(action)){
  const guild=await access.requireGuild(body.guild);
  if(action==='claim'){const token=randomUUID();const r=await query("update forever_discord_posts set lease_token=$3,lease_until=now()+interval '90 seconds' where guild_id=$1 and raid_id=$2 and (lease_until is null or lease_until<now()) returning raid_id",[guild.id,body.raidId,token]);return {success:true,leaseToken:r.rows.length?token:null};}
  if(action==='ack'){const r=await query("update forever_discord_posts set message_id=$4,content_hash=$5,last_error='',lease_token=null,lease_until=null,updated_at=now() where guild_id=$1 and raid_id=$2 and lease_token=$3 returning raid_id",[guild.id,body.raidId,body.leaseToken,snow(body.messageId),String(body.hash||'').slice(0,80)]);if(!r.rows.length)throw fail('Veröffentlichungsauftrag abgelaufen.',409);}
  else await query("update forever_discord_posts set last_error=$4,lease_token=null,lease_until=null,updated_at=now() where guild_id=$1 and raid_id=$2 and lease_token=$3",[guild.id,body.raidId,body.leaseToken,String(body.error||'Discord nicht erreichbar.').slice(0,300)]);
  return {success:true};
 }
 const {guild}=await published(body),user=snow(body.discordUserId);
 if(action==='connect'){
  const k=guild.id+':'+user,now=Date.now();for(const [key,v] of attempts)if(v.until<now)attempts.delete(key);const t=attempts.get(k)||{n:0,until:now+15*60e3};if(++t.n>5)throw fail('Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.',429);attempts.set(k,t);
  const a=await access.authorize(guild,{playerPin:body.playerPin});if(!a.playerId)throw fail('SpielerLogin erforderlich.',403);
  try{await query('insert into forever_discord_links(guild_id,discord_user_id,player_id) values($1,$2,$3) on conflict(guild_id,discord_user_id) do update set player_id=excluded.player_id',[guild.id,user,a.playerId]);}catch(e){if(e.code==='23505')throw fail('Dieser SpielerLogin ist bereits mit einem anderen Discord-Konto verbunden.',409);throw e;}attempts.delete(k);
 }
 if(action==='unlink'){await query('delete from forever_discord_links where guild_id=$1 and discord_user_id=$2',[guild.id,user]);return {success:true};}
 const a=await actor(guild,user);
 if(action==='signup')return raids.run(guild,a,{action:'signup',raidId:body.raidId,characterId:body.characterId,role:body.role,status:body.status,note:body.note||''});
 if(action==='context'||action==='connect'){const r=(await query("select starts_at<now() or status in ('completed','cancelled') as archived from forever_raids where guild_id=$1 and id=$2",[guild.id,body.raidId])).rows[0];const result=await raids.run(guild,a,{action:'overview',archive:r?.archived,raidId:body.raidId});return {success:true,characters:result.characters,raid:result.raids.find(r=>r.id===body.raidId)||null};}
 throw fail('Unbekannte Discord-Aktion.');
 }};
}
export function installForeverDiscord(app,deps){const service=createForeverDiscord(deps);app.post('/api/forever/bot',async(req,res,next)=>{res.set('Cache-Control','no-store');try{const actual=Buffer.from(deps.token||''),given=Buffer.from(String(req.headers['x-forever-bot-token']||''));if(!actual.length||given.length!==actual.length||!timingSafeEqual(actual,given))throw fail('Bot-Zugang erforderlich.',403);res.json(await service.run(req.body||{}));}catch(e){next(e);}});return service;}
