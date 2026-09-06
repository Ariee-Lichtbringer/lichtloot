export async function queueActiveSignupRefresh(pool, guild, p0OnlyRaids = []) {
  const client=await pool.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(73924062)');
    const result=await client.query(`select id::text,discord_channel_id,discord_message_id,false as p0_only from raids r
      where guild_id=$1 and deleted_at is null
        and (coalesce(prio_enabled,true) or coalesce(raidhelper_enabled,true))
        and lower(coalesce(status,'')) not in ('archiviert','archive','archived','gelöscht','geloescht','deleted','abgesagt','cancelled','canceled','geschlossen','closed','beendet','finished','completed')
        and coalesce(discord_channel_id,'') ~ '^[0-9]+$' and coalesce(discord_message_id,'') ~ '^[0-9]+$'
        and case when coalesce(raid_time,'') ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
          then ((raid_date+raid_time::time) at time zone 'Europe/Berlin') > now() else false end
      union
      select e.id,e.discord_channel_id,e.discord_message_id,true as p0_only
      from jsonb_to_recordset($2::jsonb) as e(id text,discord_channel_id text,discord_message_id text,raid_date date,raid_time text,status text)
      where lower(coalesce(e.status,'')) not in ('archiviert','archive','archived','gelöscht','geloescht','deleted','abgesagt','cancelled','canceled','beendet','finished','completed')
        and coalesce(e.discord_channel_id,'') ~ '^[0-9]+$' and coalesce(e.discord_message_id,'') ~ '^[0-9]+$'
        and case when coalesce(e.raid_time,'') ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
          then ((e.raid_date+e.raid_time::time) at time zone 'Europe/Berlin') > now() else false end`,[guild.id,JSON.stringify(p0OnlyRaids.filter(r=>r.p0Only===true && r.guildId===guild.id).map(r=>({id:r.raidId,discord_channel_id:r.discordChannelId,discord_message_id:r.discordMessageId,raid_date:r.raidDate,raid_time:r.raidTime,status:r.status})))]);
    let queued=0,alreadyQueued=0;
    for(const raid of result.rows){
      const queueType=raid.p0_only?'p0_post_refresh':'active_signup_refresh';
      const existing=await client.query(`select id from bot_update_queue where guild_id=$1 and type=$3
        and payload->>'raidId'=$2 and (status in ('open','processing') or created_at>now()-interval '1 minute') limit 1`,[guild.id,raid.id,queueType]);
      if(existing.rows.length){alreadyQueued++;continue;}
      await client.query(`insert into bot_update_queue(guild_id,type,status,payload) values($1,$3,'open',$2::jsonb)`,[guild.id,JSON.stringify({guildId:guild.id,guildSlug:guild.slug,raidId:raid.id,channelId:raid.discord_channel_id,messageId:raid.discord_message_id,editOnly:true}),queueType]);
      queued++;
    }
    await client.query('commit');
    return {success:true,activeCount:result.rows.length,queuedCount:queued,alreadyQueuedCount:alreadyQueued};
  }catch(error){await client.query('rollback');throw error;}finally{client.release();}
}

export function mergeP0PostIdentity(raid, event) {
  if(!event || raid.raidHelperEnabled!==false || !String(raid.raidId||"").startsWith("P0-") || raid.raidId!==event.raidId || raid.guildId!==event.guildId)return raid;
  return {...raid,p0Only:true,discordChannelId:event.discordChannelId||raid.discordChannelId,discordMessageId:event.discordMessageId||raid.discordMessageId};
}
