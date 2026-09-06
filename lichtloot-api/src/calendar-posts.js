export function createCalendarPosts({query,transaction}) {
  async function ensure(){await query(`create table if not exists discord_calendar_posts(guild_id uuid not null,channel_id text not null,message_id text,lease_token uuid,lease_until timestamptz,updated_at timestamptz not null default now(),primary key(guild_id,channel_id))`);}
  async function prepare(guildId,channelId){
    await ensure();return transaction(async()=>{
      const config=(await query('select channel_id,enabled from guild_raid_calendar_configs where guild_id=$1',[guildId])).rows[0];
      if(!config?.enabled||config.channel_id!==channelId)throw Object.assign(Error('Kalenderkanal ist nicht mehr konfiguriert.'),{statusCode:409});
      await query('insert into discord_calendar_posts(guild_id,channel_id) values($1,$2) on conflict do nothing',[guildId,channelId]);
      const r=(await query(`update discord_calendar_posts set lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes' where guild_id=$1 and channel_id=$2 and (lease_until is null or lease_until<now()) returning message_id,lease_token`,[guildId,channelId])).rows[0];
      return r?{success:true,claimed:true,messageId:r.message_id||'',leaseToken:r.lease_token}:{success:true,claimed:false};
    });
  }
  async function complete(guildId,channelId,token,messageId){
    const r=await query(`update discord_calendar_posts set message_id=$4,lease_token=null,lease_until=null,updated_at=now() where guild_id=$1 and channel_id=$2 and lease_token=$3 and (message_id is null or message_id=$4) returning message_id`,[guildId,channelId,token,messageId]);
    return {success:r.rows.length===1};
  }
  async function release(guildId,channelId,token){await query('update discord_calendar_posts set lease_token=null,lease_until=null where guild_id=$1 and channel_id=$2 and lease_token=$3',[guildId,channelId,token]);return {success:true};}
  return {prepare,complete,release};
}
