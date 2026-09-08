export function createPrioReceipts({query,findCharacter}) {
  async function owned(guildId,params){
    const c=await findCharacter(guildId,params.playerPin||params.pin,params.player||params.char,params.server);
    if(!c){const e=new Error('Dieser Charakter gehört nicht zu diesem SpielerPin.');e.statusCode=403;throw e;}return c;
  }
  async function history(guildId,characterId=null){
    const result=await query(`select id,recorded_at,operation,source,old_state,new_state from prio_history
      where guild_id=$1 and ($2::uuid is null or character_id=$2::uuid) order by id desc limit 100`,[guildId,characterId]);
    return {success:true,entries:result.rows};
  }
  return {
    history,
    async playerHistory(guildId,params){const c=await owned(guildId,params);return history(guildId,c.id);},
    async state(guildId,params){
      const c=await owned(guildId,params);
      if(!/^[0-9a-f-]{36}$/i.test(String(params.prioId||''))){const e=new Error('Ungültige Prio-ID.');e.statusCode=400;throw e;}
      const result=await query(`select pr.id,pr.updated_at,r.id as raid_id,r.name as raid_name,r.raid_date,r.raid_time,
        c.name as character,c.server,pr.p1_item_id,pr.p2_item_id,pr.p3_item_id,
        i1.name as p1,i2.name as p2,i3.name as p3,rs.status as signup_status
        from prios pr join raids r on r.id=pr.raid_id join characters c on c.id=pr.character_id
        left join items i1 on i1.id=pr.p1_item_id left join items i2 on i2.id=pr.p2_item_id left join items i3 on i3.id=pr.p3_item_id
        left join raid_signups rs on rs.raid_id=pr.raid_id and rs.character_id=pr.character_id
        where r.guild_id=$1 and pr.character_id=$2 and pr.id=$3`,[guildId,c.id,params.prioId]);
      return {success:true,entry:result.rows[0]||null};
    }
  };
}
