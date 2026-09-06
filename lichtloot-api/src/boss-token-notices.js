const norm=value=>String(value||'').trim().toLowerCase();
export async function queueBossTokenNotice(pool,guildId,payload){
  const identity=[guildId,payload.raidId,payload.token,payload.player,payload.server].map(norm);
  if(!identity[1]||!identity[2]||!identity[3])throw new Error('Unvollständiger Worldbuff-Hinweis.');
  const eventKey=JSON.stringify(identity),client=await pool.connect();
  try{
    await client.query('begin');
    // Serialize equal awards, including simultaneous requests and older queue rows.
    await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[eventKey]);
    const existing=await client.query(`select id,status,payload from bot_update_queue
      where guild_id=$1 and type='boss_token_notice' and status<>'cancelled'
        and lower(trim(coalesce(payload->>'raidId','')))=$2
        and lower(trim(coalesce(payload->>'token','')))=$3
        and lower(trim(coalesce(payload->>'player','')))=$4
        and lower(trim(coalesce(payload->>'server','')))=$5
      order by created_at asc limit 1`,identity);
    let row=existing.rows[0];
    if(!row){
      row=(await client.query(`insert into bot_update_queue(guild_id,type,status,payload)
        values($1,'boss_token_notice','open',$2::jsonb) returning id,status,payload`,[guildId,JSON.stringify({...payload,eventKey})])).rows[0];
    }
    await client.query('commit');
    return {success:true,skipped:existing.rows.length>0,reason:existing.rows.length?'boss_token_notice_already_queued':'',rowNumber:row.id,type:'boss_token_notice',payload:row.payload,status:row.status};
  }catch(error){await client.query('rollback');throw error;}finally{client.release();}
}
