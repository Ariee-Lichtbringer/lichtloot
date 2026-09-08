// Personal calendar: authenticated character signups and submitted priorities; ambiguous external names are excluded.
export async function addonCalendar(query,guildId,character,{p0Query,visibleP0Rows=async rows=>rows}={}){
 const result=await query(`select r.id,r.name,r.raid_type,r.raid_date,r.raid_time,
   case when coalesce(r.raid_time,'') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    then extract(epoch from ((r.raid_date+r.raid_time::time) at time zone 'Europe/Berlin'))::bigint else null end as starts_at,
   coalesce(r.prio_enabled,true) as prio_enabled,
   exists(select 1 from prios pr join raids related on related.id=pr.raid_id
     where pr.character_id=$2 and related.guild_id=$1 and related.raid_date=r.raid_date and related.raid_type=r.raid_type
       and related.deleted_at is null) as has_prio
  from raids r
  where r.guild_id=$1 and r.deleted_at is null and r.raid_date between current_date and current_date+interval '90 days'
   and lower(coalesce(r.status,'')) not in ('archiviert','archive','archived','gelöscht','deleted','abgesagt','cancelled','canceled')
   and (
    exists(select 1 from prios own_prio where own_prio.raid_id=r.id and own_prio.character_id=$2)
    or exists(select 1 from raid_signups rs where rs.raid_id=r.id and rs.character_id=$2 and lower(coalesce(rs.status,'signed')) in ('signed','active','aktiv','angemeldet','dabei','yes','confirmed','bestaetigt','bestätigt','bench','bank','ersatz','late','spät','spaet'))
    or exists(select 1 from raid_external_signups es
      where es.guild_id=$1 and es.raid_id=r.id and lower(es.player_name)=lower($3)
       and lower(coalesce(es.status,'signed')) in ('signed','active','aktiv','angemeldet','dabei','yes','confirmed','bestaetigt','bestätigt','bench','bank','ersatz','late','spät','spaet')
       and exists(select 1 from discord_player_links dpl where dpl.guild_id=$1 and dpl.character_id=$2 and dpl.discord_user_id=es.discord_user_id)
       and not exists(select 1 from characters other join players op on op.id=other.player_id where op.guild_id=$1 and lower(other.name)=lower($3) and other.id<>$2))
   ) order by r.raid_date,r.raid_time,r.id`,[guildId,character.id,character.name]);
 const rows=[...result.rows];
 if(p0Query){
  const personal=await p0Query(`select s.*,e.id as calendar_event_id,e.linked_raid_id,e.raid_name,e.raid_type,e.raid_date,e.raid_time,
    case when coalesce(e.raid_time,'') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      then extract(epoch from ((e.raid_date+e.raid_time::time) at time zone 'Europe/Berlin'))::bigint else null end as starts_at
   from p0_only_signups s join p0_only_events e on e.id=s.event_id
   where s.guild_id=$1 and e.guild_id=$1 and e.deleted_at is null
     and e.raid_date between current_date and current_date+interval '90 days'
     and lower(coalesce(e.status,'')) not in ('archiviert','archive','archived','gelöscht','deleted','abgesagt','cancelled','canceled')
     and lower(coalesce(s.approval_status,'')) in ('pending','approved')
     and (s.character_id=$2 or (lower(s.player_name)=lower($3) and lower(s.server)=lower($4)))`,[guildId,character.id,character.name,character.server]);
  const seen=new Set(rows.map(r=>String(r.id)));
  for(const r of await visibleP0Rows(personal.rows)){
   const id='p0:'+r.calendar_event_id;
   if(seen.has(id)||seen.has(r.linked_raid_id))continue;
   seen.add(id);rows.push({...r,id,name:r.raid_name,has_prio:true,prio_enabled:true});
  }
 }
 return rows.map(r=>({id:r.id,name:r.name||r.raid_type,raid:r.raid_type,date:r.raid_date instanceof Date?r.raid_date.toISOString().slice(0,10):String(r.raid_date).slice(0,10),time:r.raid_time||'',startsAt:r.starts_at?Number(r.starts_at):null,hasPrio:r.has_prio,needsPrio:r.prio_enabled})).sort((a,b)=>(a.date+' '+a.time).localeCompare(b.date+' '+b.time));
}
