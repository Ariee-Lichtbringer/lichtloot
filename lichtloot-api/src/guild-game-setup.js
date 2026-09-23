// Application IDs make Forever provisioning retryable across the two databases.
export function guildGame(value = 'era') {
  const game = String(value).trim().toLowerCase();
  if (!['era', 'forever'].includes(game)) throw Object.assign(new Error('Bitte WoW Classic Era oder WoW Forever auswählen.'), {statusCode:400});
  return game;
}
const conflict = message => Object.assign(new Error(message), {statusCode:409});
export async function provisionForeverGuild(pool, input) {
  if (!pool) throw Object.assign(new Error('Die Forever-Datenbank ist derzeit nicht verfügbar.'), {statusCode:503});
  const db = await pool.connect();
  try {
    await db.query('begin');
    await db.query('select pg_advisory_xact_lock(hashtext($1))', [input.applicationId]);
    const existing = await db.query(`select g.*,s.layout_json,s.primary_color,s.accent_color from guilds g join guild_settings s on s.guild_id=g.id where g.id=$1`, [input.applicationId]);
    if (existing.rows[0]) {
      const row = existing.rows[0];
      if (row.layout_json.game !== 'forever' || row.layout_json.applicationId !== input.applicationId) throw conflict('Diese Gilde gehört zu einer anderen Einrichtung.');
      await db.query('commit');
      return row;
    }
    // Never overwrite another guild just because its name/slug matches.
    const duplicate = await db.query('select id from guilds where slug=$1', [input.slug]);
    if (duplicate.rows.length) throw conflict('Dieser Forever-Gildenbereich existiert bereits. Bitte einen anderen Lootsystem-Namen wählen.');
    const guild = (await db.query(`insert into guilds(id,name,slug,server,guild_pin,discord_guild_id,logo_url,background_url)
      values($1,$2,$3,$4,$5,$6,$7,$8) returning *`, [input.applicationId,input.name,input.slug,input.server,input.code,input.discordGuildId,input.logoUrl,input.backgroundUrl])).rows[0];
    const layout = {game:'forever',applicationId:input.applicationId,lootName:input.lootName,lootSystem:'prio',onboarding:{setupComplete:true}};
    await db.query(`insert into guild_settings(guild_id,primary_color,accent_color,layout_json) values($1,$2,$3,$4::jsonb)`, [guild.id,input.primaryColor,input.accentColor,JSON.stringify(layout)]);
    await db.query('insert into guild_master_codes(guild_id,master_code) values($1,$2)', [guild.id,input.code]);
    await db.query('commit');
    return {...guild,layout_json:layout,primary_color:input.primaryColor,accent_color:input.accentColor};
  } catch(error) {
    await db.query('rollback');
    if(error.code === '23505') throw conflict('Dieser Forever-Gildenbereich existiert bereits.');
    throw error;
  } finally { db.release(); }
}
export async function foreverSetupReadiness(query, slug) {
  const result = await query(`select g.slug,m.master_code is not null as master_configured from guilds g
    join guild_settings s on s.guild_id=g.id left join guild_master_codes m on m.guild_id=g.id
    where g.slug=$1 and s.layout_json->>'game'='forever'`, [slug]);
  if (!result.rows[0]) throw Object.assign(new Error('Forever-Gilde nicht gefunden.'), {statusCode:404});
  return {game:'forever',ready:result.rows[0].master_configured,checks:{masterConfigured:result.rows[0].master_configured,layoutConfigured:true}};
}
