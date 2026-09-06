// Completion describes work still required, independently of the current point balance.
export function raidCompletionState(raid, {enabled=true, taskAction='', transferred=false}={}) {
  const status=String(raid.status||'').trim().toLowerCase();
  if (raid.deleted_at || ['abgesagt','cancelled','canceled','deleted','gelöscht','geloescht'].includes(status) || taskAction==='task_raid_cancelled') return 'cancelled';
  if (!enabled) return 'not_required';
  if (taskAction==='task_manual_transfer') return 'manual';
  const completedAt=Date.parse(raid.p0plus_transferred_at||'');
  const resetAt=Date.parse(raid.p0plus_transfer_reset_at||'');
  const recorded=Number.isFinite(completedAt) && (!Number.isFinite(resetAt)||completedAt>=resetAt);
  return transferred || recorded ? 'transferred' : 'open';
}

export async function loadRaidCompletion(client, guildId, raid, {enabled=true}={}) {
  const notes=[...new Set([`RaidID: ${raid.external_raid_id||raid.id}`,`RaidID: ${raid.id}`,raid.raid_pin?`RaidID: ${raid.raid_pin}`:''].filter(Boolean))];
  const result=await client.query(`select
    (select a.action from p0plus_point_audit a where a.guild_id=$1 and a.raid_id=$2
      and a.action in ('task_manual_transfer','task_raid_cancelled','task_reopened')
      order by a.created_at desc,a.id desc limit 1) task_action,
    (exists(select 1 from p0plus_point_audit a where a.guild_id=$1 and a.raid_id=$2
      and a.action='raid_transfer' and ($4::timestamptz is null or a.created_at >= $4))
     or exists(select 1 from p0plus_points pp where pp.guild_id=$1
      and pp.source='Raidlead Transfer' and pp.note=any($3::text[]))) transferred`,
    [guildId,raid.id,notes,raid.p0plus_transfer_reset_at||null]);
  const row=result.rows[0]||{};
  return raidCompletionState(raid,{enabled,taskAction:row.task_action,transferred:row.transferred===true});
}
