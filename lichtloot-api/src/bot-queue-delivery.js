// Token-scoped leases for workers that explicitly claim one job before sending.
export function createBotQueueDelivery(query) {
  const valid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
  async function claim(guildId, id) {
    if (!valid(id)) return {success:false, claimed:false};
    const result = await query(`update bot_update_queue
      set status='processing', claimed_at=now(),
          payload=payload || jsonb_build_object('workerLease',gen_random_uuid()::text)
      where guild_id=$1 and id=$2 and
        (status='open' or (status='processing' and claimed_at<now()-interval '5 minutes'))
      returning payload->>'workerLease' as token`, [guildId,id]);
    return {success:true,claimed:result.rows.length===1,leaseToken:result.rows[0]?.token || ''};
  }
  async function renew(guildId,id,token) {
    if (!valid(id) || !valid(token)) return {success:false,renewed:false};
    const result=await query(`update bot_update_queue set claimed_at=now()
      where guild_id=$1 and id=$2 and status='processing' and payload->>'workerLease'=$3
      and claimed_at>=now()-interval '5 minutes' returning id`,[guildId,id,token]);
    return {success:true,renewed:result.rows.length===1};
  }
  async function complete(guildId,id,token,messageId='',channelId='') {
    if (!valid(id) || !valid(token)) return {success:false};
    const result=await query(`update bot_update_queue set status='done',resolved_at=now(),
      payload=(payload-'workerLease') || jsonb_build_object('deliveryState','sent') ||
        case when $4::text='' then '{}'::jsonb else jsonb_build_object('messageId',$4::text) end ||
        case when $5::text='' then '{}'::jsonb else jsonb_build_object('postChannelId',$5::text) end
      where guild_id=$1 and id=$2 and status='processing' and payload->>'workerLease'=$3
      and claimed_at>=now()-interval '5 minutes' returning id`,[guildId,id,token,messageId,channelId]);
    return {success:result.rows.length===1};
  }
  async function retry(guildId,id,token,reason,terminal=false) {
    if (!valid(id) || !valid(token)) return {success:false};
    const result=await query(`with attempt as (
      select id,coalesce((payload->>'deliveryAttempts')::int,0)+1 as n
      from bot_update_queue where guild_id=$1 and id=$2 and status='processing'
      and payload->>'workerLease'=$3 and claimed_at>=now()-interval '5 minutes' for update
    ) update bot_update_queue q set
      status=case when $5::boolean or a.n>=5 then 'failed' else 'processing' end,
      claimed_at=now(),resolved_at=case when $5::boolean or a.n>=5 then now() else null end,
      payload=(q.payload-'workerLease') || jsonb_build_object(
        'deliveryAttempts',a.n,'failureReason',$4::text,
        'deliveryState',case when $5::boolean or a.n>=5 then 'blocked' else 'retrying' end)
      from attempt a where q.id=a.id returning q.status,a.n as attempts`,
      [guildId,id,token,String(reason || 'Zustellung fehlgeschlagen').slice(0,500),Boolean(terminal)]);
    return {success:result.rows.length===1,...result.rows[0]};
  }
  return {claim,renew,complete,retry};
}
