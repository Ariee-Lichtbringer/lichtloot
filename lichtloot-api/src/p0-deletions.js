export function createP0Deletions({query,transaction,p0Query}) {
  const ensure=()=>query(`create table if not exists p0_signup_deletions(guild_id uuid not null,signup_id uuid not null,event_id uuid not null,character_id uuid not null,discord_user_id text not null,deleted_at timestamptz not null default now(),primary key(guild_id,signup_id))`);
  async function isDeleted(guildId,signupId){await ensure();return Boolean((await query('select 1 from p0_signup_deletions where guild_id=$1 and signup_id=$2',[guildId,signupId])).rows.length);}
  async function remove({guildId,event,character,discordUserId,linkedRaid,archiveMirrors,signupId=null}) {
    await ensure();
    const rows=(await p0Query('select * from p0_only_signups where guild_id=$1 and event_id=$2 and character_id=$3 and discord_user_id=$4 and ($5::uuid is null or id=$5)',[guildId,event.id,character.id,discordUserId,signupId])).rows;
    if(!rows.length){const prior=(await query('select 1 from p0_signup_deletions where guild_id=$1 and event_id=$2 and character_id=$3 and discord_user_id=$4',[guildId,event.id,character.id,discordUserId])).rows;if(prior.length)return {success:true,deleted:0,alreadyDeleted:true};throw Object.assign(Error('Keine passende eigene P0-Anmeldung gefunden.'),{statusCode:404});}
    await transaction(async()=>{
      // Same lock as sync: a context refresh cannot reinsert after cleanup.
      await query('select pg_advisory_xact_lock(hashtext($1))',[guildId+':'+event.id+':'+character.id]);
      for(const row of rows){
        await query('insert into p0_signup_deletions(guild_id,signup_id,event_id,character_id,discord_user_id) values($1,$2,$3,$4,$5) on conflict do nothing',[guildId,row.id,event.id,character.id,discordUserId]);
        await query(`delete from prios p using raids r where r.id=p.raid_id and r.guild_id=$1 and p.character_id=$2 and p.comment::text ~ ('"p0OnlySignupId"[[:space:]]*:[[:space:]]*"'||$3::text||'"')`,[guildId,character.id,row.id]);
      }
      await archiveMirrors({query},guildId,event,character,discordUserId);
      if(linkedRaid)await archiveMirrors({query},guildId,linkedRaid,character,discordUserId);
    });
    // A failed separate-DB delete is retryable; tombstones already prevent
    // rendering or synchronizing the old source in the meantime.
    const result=await p0Query('delete from p0_only_signups where guild_id=$1 and event_id=$2 and character_id=$3 and discord_user_id=$4 and ($5::uuid is null or id=$5) returning id',[guildId,event.id,character.id,discordUserId,signupId]);
    return {success:true,deleted:result.rowCount};
  }
  async function visibleRows(guildId,rows){
    if(!rows.length)return rows;
    await ensure();const deleted=new Set((await query('select signup_id from p0_signup_deletions where guild_id=$1 and signup_id=any($2::uuid[])',[guildId,rows.map(r=>r.id)])).rows.map(r=>r.signup_id));
    return rows.filter(r=>!deleted.has(r.id));
  }
  return {ensure,isDeleted,remove,visibleRows};
}
