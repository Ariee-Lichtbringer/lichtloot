import {randomUUID} from 'node:crypto';
const clean=v=>String(v??'').trim();
const fail=(message,statusCode=409)=>{throw Object.assign(new Error(message),{statusCode});};
// The post belongs to a guild, raid and channel, never to a delivery attempt.
export function createPrioReminderPosts({pool,query,activeRaidSql,raidTypes}) {
 let ready;
 function ensure(){return ready ||= query(`create table if not exists prio_reminder_posts (
  id uuid primary key,guild_id uuid not null references guilds(id),raid_id uuid not null references raids(id),
  channel_id text not null,message_id text,lease_token uuid,lease_until timestamptz,
  updated_at timestamptz not null default now(),unique(guild_id,raid_id,channel_id))`).catch(e=>{ready=null;throw e;});}
 async function prepare(guildId,queueId){
  await ensure();const client=await pool.connect();
  try{
   await client.query('begin');
   const job=(await client.query("select payload from bot_update_queue where id=$1 and guild_id=$2 and type='raid_missing_prio_reminder'",[queueId,guildId])).rows[0];
   if(!job)fail('Erinnerungsauftrag nicht gefunden.',404);
   const p=job.payload;
   const raid=(await client.query(`select r.*,r.raid_date::text as day from raids r where r.guild_id=$1 and (r.id::text=$2 or r.external_raid_id=$2) and ${activeRaidSql('r')}
    and not exists(select 1 from guild_settings gs where gs.guild_id=r.guild_id and gs.layout_json->>'lootSystem'='dkp')`,[guildId,p.raidId])).rows[0];
   if(!raid || raid.day!==p.raidDate || clean(raid.raid_time).slice(0,5)!==clean(p.raidTime).slice(0,5) || clean(raid.raid_pin||raid.player_link)!==clean(p.prioPin)){
    await client.query('commit');return {success:true,skipped:'raid_changed_or_expired'};
   }
   const channel=clean(raid.discord_channel_id);
   if(!channel || channel!==clean(p.channelId||p.discordChannelId))fail('Der Zielkanal der Erinnerung wurde geändert.');
   await client.query('insert into prio_reminder_posts(id,guild_id,raid_id,channel_id) values($1,$2,$3,$4) on conflict(guild_id,raid_id,channel_id) do nothing',[randomUUID(),guildId,raid.id,channel]);
   let post=(await client.query('select *,lease_until>now() as leased from prio_reminder_posts where guild_id=$1 and raid_id=$2 and channel_id=$3 for update',[guildId,raid.id,channel])).rows[0];
   if(post.leased)fail('Dieser Erinnerungsbeitrag wird bereits aktualisiert.');
   // Recover the earliest recorded Discord snowflake, including legacy jobs.
   const oldest=(await client.query(`select payload->>'messageId' as id from bot_update_queue where guild_id=$1 and type='raid_missing_prio_reminder'
    and payload->>'raidId'=any($2::text[]) and coalesce(payload->>'channelId',payload->>'discordChannelId')=$3
    and payload->>'messageId' ~ '^[0-9]{1,22}$' order by (payload->>'messageId')::numeric asc limit 1`,[guildId,[raid.id,raid.external_raid_id].filter(Boolean),channel])).rows[0]?.id;
   let messageId=post.message_id;
   if(oldest && (!messageId||BigInt(oldest)<BigInt(messageId)))messageId=oldest;
   const leaseToken=randomUUID();
   await client.query("update prio_reminder_posts set message_id=$2,lease_token=$3,lease_until=now()+interval '10 minutes',updated_at=now() where id=$1",[post.id,messageId||null,leaseToken]);
   const related=(await client.query(`select id from raids where guild_id=$1 and lower(raid_type)=any($2::text[]) and raid_date=$3 and coalesce(raid_time,'')=coalesce($4,'') and deleted_at is null`,[guildId,raidTypes(raid.raid_type),raid.raid_date,raid.raid_time])).rows.map(r=>r.id);
   const attending=['signed','registered','angemeldet','confirmed','fest'];
   const internal=(await client.query(`select c.name,p.id as player_id from raid_signups s join characters c on c.id=s.character_id join players p on p.id=c.player_id where s.raid_id=$1 and p.guild_id=$2 and lower(coalesce(s.status,'signed'))=any($3::text[])`,[raid.id,guildId,attending])).rows;
   const external=(await client.query(`select player_name as name from raid_external_signups where raid_id=$1 and guild_id=$2 and lower(coalesce(status,'signed'))=any($3::text[])`,[raid.id,guildId,attending])).rows;
   const prios=(await client.query(`select c.name,c.player_id from prios pr join characters c on c.id=pr.character_id join players p on p.id=c.player_id where p.guild_id=$1 and pr.raid_id=any($2::uuid[]) and (pr.p1_item_id is not null or pr.p2_item_id is not null or pr.p3_item_id is not null)`,[guildId,[...new Set([raid.id,...related])]])).rows;
   const doneIds=new Set(prios.map(r=>r.player_id)),doneNames=new Set(prios.map(r=>clean(r.name).toLocaleLowerCase('de-DE')));
   const names=new Map();for(const r of [...internal,...external]){const key=clean(r.name).toLocaleLowerCase('de-DE');if(key&&!names.has(key))names.set(key,{name:clean(r.name),done:r.player_id?doneIds.has(r.player_id):doneNames.has(key)});}
   const rows=[...names.values()].sort((a,b)=>a.name.localeCompare(b.name,'de'));
   if(!rows.length&&!messageId){await client.query('update prio_reminder_posts set lease_token=null,lease_until=null where id=$1',[post.id]);await client.query('commit');return {success:true,skipped:'no_attendees'};}
   await client.query('commit');
   return {success:true,postId:post.id,leaseToken,payload:{...p,postId:post.id,reconcileOriginal:!post.message_id,messageId:messageId||'',editOnly:!!messageId,trackedCharacters:rows.map(r=>r.name),missingCharacters:rows.filter(r=>!r.done).map(r=>r.name),completedCharacters:rows.filter(r=>r.done).map(r=>r.name)}};
  }catch(e){await client.query('rollback').catch(()=>{});throw e;}finally{client.release();}
 }
 async function complete(guildId,params){
  await ensure();if(!/^\d{1,22}$/.test(clean(params.messageId)))fail('Ungültige Discord-Nachrichten-ID.',400);
  const result=await query(`update prio_reminder_posts set message_id=$4,lease_token=null,lease_until=null,updated_at=now()
   where guild_id=$1 and id=$2 and lease_token=$3 and (message_id is null or message_id::numeric >= $4::numeric) returning id`,[guildId,params.postId,params.leaseToken,clean(params.messageId)]);
  if(!result.rows.length)fail('Die Zuordnung des ursprünglichen Beitrags konnte nicht bestätigt werden.');
  return {success:true};
 }
 return {ensure,prepare,complete};
}
