export async function maintainRaidRefreshQueue(query){
 const obsolete=await query(`update bot_update_queue q set status='cancelled',resolved_at=now(),payload=q.payload||jsonb_build_object('skipReason','raid_inactive_or_past')
 where q.type='raid_announcement_refresh' and q.status='open' and exists(select 1 from raids r where r.guild_id=q.guild_id and (r.id::text=q.payload->>'raidId' or r.external_raid_id=q.payload->>'raidId') and (r.deleted_at is not null or lower(coalesce(r.status,'')) in ('archiviert','archived','archive','abgesagt','cancelled','canceled','deleted','gelöscht','geloescht') or r.raid_date<(now() at time zone 'Europe/Berlin')::date))`);
 const older=await query(`update bot_update_queue q set status='cancelled',resolved_at=now(),payload=q.payload||jsonb_build_object('skipReason','superseded_refresh')
 where q.type='raid_announcement_refresh' and q.status='open' and exists(select 1 from bot_update_queue n where n.guild_id=q.guild_id and n.type=q.type and n.status in ('open','processing') and n.payload->>'raidId'=q.payload->>'raidId' and (n.created_at,n.id)>(q.created_at,q.id))`);
 return {obsolete:obsolete.rowCount||0,superseded:older.rowCount||0};
}
export async function failBotQueue(query,guildId,id,reason){
 if(!/^[0-9a-f-]{36}$/i.test(String(id)) || !String(reason||'').trim())throw Object.assign(new Error('Ungültiger Fehlerauftrag.'),{statusCode:400});
 const r=await query(`update bot_update_queue set status='failed',resolved_at=now(),payload=payload||jsonb_build_object('deliveryState','blocked','failureReason',$3::text,'failedAt',now()) where guild_id=$1 and id=$2 and status in ('open','processing') returning id`,[guildId,id,String(reason).slice(0,1000)]);
 return {success:true,blocked:r.rows.length===1};
}
