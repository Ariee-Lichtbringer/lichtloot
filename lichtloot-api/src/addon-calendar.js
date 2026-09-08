// Personal calendar: only authenticated character signups; ambiguous external names are excluded.
export async function addonCalendar(query,guildId,character){
 const result=await query(`select r.id,r.name,r.raid_type,r.raid_date,r.raid_time,
   case when coalesce(r.raid_time,'') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    then extract(epoch from ((r.raid_date+r.raid_time::time) at time zone 'Europe/Berlin'))::bigint else null end as starts_at,
   coalesce(r.prio_enabled,true) as prio_enabled,
   exists(select 1 from prios pr join raids related on related.id=pr.raid_id
     where pr.character_id=$2 and related.guild_id=$1 and related.raid_date=r.raid_date and related.raid_type=r.raid_type
       and (pr.p1_item_id is not null or pr.p2_item_id is not null or pr.p3_item_id is not null)) as has_prio
  from raids r
  where r.guild_id=$1 and r.raid_date between current_date and current_date+interval '90 days'
   and lower(coalesce(r.status,'')) not in ('archiviert','archive','archived','gelöscht','deleted','abgesagt','cancelled','canceled')
   and (
    exists(select 1 from raid_signups rs where rs.raid_id=r.id and rs.character_id=$2 and lower(coalesce(rs.status,'signed')) in ('signed','active','aktiv','angemeldet','dabei','yes','confirmed','bestaetigt','bestätigt','bench','bank','ersatz','late','spät','spaet'))
    or exists(select 1 from raid_external_signups es
      where es.guild_id=$1 and es.raid_id=r.id and lower(es.player_name)=lower($3)
       and lower(coalesce(es.status,'signed')) in ('signed','active','aktiv','angemeldet','dabei','yes','confirmed','bestaetigt','bestätigt','bench','bank','ersatz','late','spät','spaet')
       and exists(select 1 from discord_player_links dpl where dpl.guild_id=$1 and dpl.character_id=$2 and dpl.discord_user_id=es.discord_user_id)
       and not exists(select 1 from characters other join players op on op.id=other.player_id where op.guild_id=$1 and lower(other.name)=lower($3) and other.id<>$2))
   ) order by r.raid_date,r.raid_time,r.id`,[guildId,character.id,character.name]);
 return result.rows.map(r=>({id:r.id,name:r.name||r.raid_type,raid:r.raid_type,date:r.raid_date instanceof Date?r.raid_date.toISOString().slice(0,10):String(r.raid_date).slice(0,10),time:r.raid_time||'',startsAt:r.starts_at?Number(r.starts_at):null,hasPrio:r.has_prio,needsPrio:r.prio_enabled}));
}
