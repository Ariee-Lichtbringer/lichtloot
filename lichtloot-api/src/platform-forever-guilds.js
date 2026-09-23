export async function listPlatformForeverGuilds(query) {
  const result = await query(`select g.id,g.slug,g.name,g.server,g.created_at,g.discord_guild_id,
    (select count(*)::int from players p where p.guild_id=g.id) as players,
    (select count(*)::int from forever_raids r where r.guild_id=g.id) as raids,
    exists(select 1 from guild_master_codes c where c.guild_id=g.id and c.master_code<>'') as master_configured
    from guilds g join guild_settings s on s.guild_id=g.id
    where s.layout_json->>'game'='forever' order by g.created_at,g.name`);
  return result.rows.map(({master_configured,...guild})=>({...guild,game:'forever',views_30:null,visitors_30:null,analyticsAvailable:false,
    readiness:{game:'forever',ready:master_configured,checks:{masterConfigured:master_configured,layoutConfigured:true}}}));
}
export async function resetPlatformForeverCode(pool,slug,newCode) {
  if(!pool)throw Object.assign(new Error('Forever-Datenbank ist nicht verfügbar.'),{statusCode:503});
  const db=await pool.connect();
  try {
    await db.query('begin');
    const result=await db.query("select g.id,g.slug from guilds g join guild_settings s on s.guild_id=g.id where g.slug=$1 and s.layout_json->>'game'='forever' for update of g",[slug]);
    const guild=result.rows[0];if(!guild)throw Object.assign(new Error('Forever-Gilde nicht gefunden.'),{statusCode:404});
    const duplicate=await db.query('select 1 from guilds g left join guild_master_codes c on c.guild_id=g.id where g.id<>$1 and (g.guild_pin=$2 or c.master_code=$2) limit 1',[guild.id,newCode]);
    if(duplicate.rows.length)throw Object.assign(new Error('Dieser Leitungscode wird bereits verwendet.'),{statusCode:409});
    await db.query('insert into guild_master_codes(guild_id,master_code) values($1,$2) on conflict(guild_id) do update set master_code=excluded.master_code,updated_at=now()',[guild.id,newCode]);
    await db.query('update guilds set guild_pin=$2,updated_at=now() where id=$1',[guild.id,newCode]);
    await db.query('commit');
    return {success:true,game:'forever',slug:guild.slug,message:'Forever-Leitungscode wurde zurückgesetzt.'};
  }catch(error){await db.query('rollback');throw error;}finally{db.release();}
}
