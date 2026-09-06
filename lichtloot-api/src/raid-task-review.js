const actions={manual:'task_manual_transfer',cancel:'task_raid_cancelled',reopen:'task_reopened'};
const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
export function createRaidTaskReviewService({pool,authorize,authorizeWrite=authorize}){
  async function list(guild,params){
    await authorize(guild,params);
    const result=await pool.query(`select distinct on (a.raid_id) a.raid_id,r.external_raid_id,a.action,a.note,a.created_at
      from p0plus_point_audit a join raids r on r.id=a.raid_id and r.guild_id=a.guild_id
      where a.guild_id=$1 and a.action=any($2::text[])
      order by a.raid_id,a.created_at desc,a.id desc`,[guild.id,Object.values(actions)]);
    return {success:true,reviews:result.rows.map(r=>({raidId:r.external_raid_id||r.raid_id,internalRaidId:r.raid_id,state:Object.keys(actions).find(k=>actions[k]===r.action),note:r.note||'',reviewedAt:r.created_at}))};
  }
  async function set(guild,params){
    await authorizeWrite(guild,params);
    const state=String(params.state||''),note=String(params.note||'').trim();
    if(!Object.hasOwn(actions,state))throw fail('Ungültige Aufgabenentscheidung.');
    if(!params.raidId)throw fail('Bitte einen Raid auswählen.');
    if(!note||note.length>500)throw fail('Bitte eine Notiz mit 1 bis 500 Zeichen eingeben.');
    if(params.confirmed!==true)throw fail('Bitte die Entscheidung ausdrücklich bestätigen.');
    const client=await pool.connect();
    try{
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock(hashtext($1),hashtext($2))',[String(guild.id),'p0plus-review']);
      const raid=(await client.query(`select * from raids where guild_id=$1 and (id::text=$2 or external_raid_id=$2) for update`,[guild.id,String(params.raidId)])).rows[0];
      if(!raid)throw fail('Raid wurde in dieser Gilde nicht gefunden.',404);
      if(raid.deleted_at||['gelöscht','geloescht','deleted'].includes(String(raid.status).toLowerCase()))throw fail('Gelöschte Raids können hier nicht geändert werden.',409);
      const previous=(await client.query(`select action from p0plus_point_audit where guild_id=$1 and raid_id=$2 and action=any($3::text[]) order by created_at desc,id desc limit 1`,[guild.id,raid.id,Object.values(actions)])).rows[0];
      if(state==='reopen'&&!previous)throw fail('Für diesen Raid gibt es keine erledigte Aufgabe.',409);
      if(state==='manual'&&['abgesagt','cancelled','canceled'].includes(String(raid.status).toLowerCase()))throw fail('Der Raid ist abgesagt. Bitte zuerst die Absage zurücknehmen.',409);
      if(state==='cancel')await client.query("update raids set status='abgesagt',p0plus_freigabe='geschlossen',updated_at=now() where id=$1 and guild_id=$2",[raid.id,guild.id]);
      if(state==='reopen'&&previous.action===actions.cancel){
        await client.query("update raids set status='geschlossen',updated_at=now() where id=$1 and guild_id=$2 and lower(status) in ('abgesagt','cancelled','canceled')",[raid.id,guild.id]);
      }
      if(previous?.action!==actions[state])await client.query(`insert into p0plus_point_audit(guild_id,raid_id,raid_type,action,source,note,old_points,new_points,delta_points) values($1,$2,$3,$4,'Gildenleitung Aufgaben',$5,0,0,0)`,[guild.id,raid.id,raid.raid_type,actions[state],note]);
      await client.query('commit');return {success:true,raidId:raid.external_raid_id||raid.id,state,pointsChanged:false};
    }catch(error){await client.query('rollback').catch(()=>{});throw error;}finally{client.release();}
  }
  return {list,set};
}
