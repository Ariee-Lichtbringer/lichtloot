export async function queueActiveSignupRefresh(pool, guild) {
  const client=await pool.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(73924062)');
    const result=await client.query(`select id,discord_channel_id,discord_message_id from raids r
      where guild_id=$1 and deleted_at is null
        and (coalesce(prio_enabled,true) or coalesce(raidhelper_enabled,true))
        and lower(coalesce(status,'')) not in ('archiviert','archive','archived','gelöscht','geloescht','deleted','abgesagt','cancelled','canceled','geschlossen','closed','beendet','finished','completed')
        and coalesce(discord_channel_id,'') ~ '^[0-9]+$' and coalesce(discord_message_id,'') ~ '^[0-9]+$'
        and case when coalesce(raid_time,'') ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
          then ((raid_date+raid_time::time) at time zone 'Europe/Berlin') > now() else false end`,[guild.id]);
    let queued=0,alreadyQueued=0;
    for(const raid of result.rows){
      const existing=await client.query(`select id from bot_update_queue where guild_id=$1 and type='active_signup_refresh'
        and payload->>'raidId'=$2 and (status in ('open','processing') or created_at>now()-interval '1 minute') limit 1`,[guild.id,raid.id]);
      if(existing.rows.length){alreadyQueued++;continue;}
      await client.query(`insert into bot_update_queue(guild_id,type,status,payload) values($1,'active_signup_refresh','open',$2::jsonb)`,[guild.id,JSON.stringify({guildId:guild.id,guildSlug:guild.slug,raidId:raid.id,channelId:raid.discord_channel_id,messageId:raid.discord_message_id,editOnly:true})]);
      queued++;
    }
    await client.query('commit');
    return {success:true,activeCount:result.rows.length,queuedCount:queued,alreadyQueuedCount:alreadyQueued};
  }catch(error){await client.query('rollback');throw error;}finally{client.release();}
}
