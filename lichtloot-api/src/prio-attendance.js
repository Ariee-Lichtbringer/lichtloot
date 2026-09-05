// Nachtwächter ZG attendance is derived from saved GuildLoot priority lists.
// Never create signups, award points, or fabricate a Warcraft Logs report.
export const ZG_ATTENDANCE_START = '2026-08-15';
const ZG_TYPES = ['zg', 'zg-mittwoch', 'zg-prime', 'zg-late'];

export function buildZgPrioAttendance(rows) {
  const raids = new Map();
  for (const row of rows) {
    const id = String(row.raid_id);
    if (!raids.has(id)) raids.set(id, {
      raid: {
        id, raidId: row.external_raid_id || id, raid: row.raid_type,
        raidName: row.raid_name, raidDate: row.raid_date, raidTime: row.raid_time || '',
        attendanceSource: 'prio-list', warnings: []
      },
      players: new Map()
    });
    const entry = raids.get(id);
    const bench = String(row.bench || '').trim().toLowerCase();
    entry.players.set(String(row.character_id), {
      characterId: String(row.character_id), player: row.player_name,
      char: row.player_name, server: row.server || '', className: row.class_name || '',
      status: bench && !['0', 'false', 'nein', 'no'].includes(bench) ? 'bench' : 'signed',
      source: 'prio-list'
    });
  }
  return [...raids.values()].map(({raid, players}) => ({raid, signups:[...players.values()]}));
}

export async function getZgPrioAttendance(query, {guildId, guildSlug, raidKey = 'zg'}) {
  if (guildSlug !== 'nachtloot' || !ZG_TYPES.includes(raidKey)) {
    const error = new Error('Diese Priolisten-Attendance ist nur für ZG der Nachtwächter verfügbar.');
    error.statusCode = 400;
    throw error;
  }
  const types = raidKey === 'zg' ? ZG_TYPES : raidKey === 'zg-mittwoch' ? ['zg', 'zg-mittwoch'] : [raidKey];
  const result = await query(`
    select * from (
      select r.id as raid_id, r.external_raid_id, r.name as raid_name,
        lower(r.raid_type) as raid_type, r.raid_date::text as raid_date, r.raid_time,
        c.id as character_id, c.name as player_name, c.server, c.class_name, pr.bench,
        row_number() over (partition by r.id, p.id
          order by coalesce(pr.updated_at, pr.created_at) desc, pr.created_at desc, pr.id desc) as prio_rank
      from raids r
      join guilds g on g.id = r.guild_id and g.slug = 'nachtloot'
      join prios pr on pr.raid_id = r.id
      join characters c on c.id = pr.character_id
      join players p on p.id = c.player_id and p.guild_id = r.guild_id
      where r.guild_id = $1 and lower(r.raid_type) = any($2::text[])
        and r.raid_date >= $3::date
        and r.raid_date < (now() at time zone 'Europe/Berlin')::date
        and lower(trim(coalesce(r.status, ''))) not in ('abgesagt', 'cancelled', 'canceled', 'gelöscht', 'deleted')
    ) ranked where prio_rank = 1
    order by raid_date desc, raid_time desc, raid_id, lower(player_name), character_id
  `, [guildId, types, ZG_ATTENDANCE_START]);
  const rows = buildZgPrioAttendance(result.rows);
  return {
    success:true, source:'prio-list', sourceLabel:'GuildLoot-Priolisten',
    since:ZG_ATTENDANCE_START, raidKey, rows,
    raidCount:rows.length,
    participationCount:rows.reduce((sum, row) => sum + row.signups.filter(player => player.status === 'signed').length, 0),
    benchCount:rows.reduce((sum, row) => sum + row.signups.filter(player => player.status === 'bench').length, 0)
  };
}

export async function getZgAttendanceByCharacter(query, {guildId, guildSlug, window = 16, countBench = false}) {
  if (guildSlug !== 'nachtloot') return {byCharacter:new Map(), totals:{}};
  const result = await getZgPrioAttendance(query, {guildId, guildSlug});
  const byCharacter = new Map();
  for (const key of ['zg-mittwoch', 'zg-prime', 'zg-late']) {
    const rows = result.rows.filter(row => (row.raid.raid === 'zg' ? 'zg-mittwoch' : row.raid.raid) === key).slice(0, window);
    for (const row of rows) for (const player of row.signups) {
      if (!byCharacter.has(player.characterId)) byCharacter.set(player.characterId, {});
      const totals = byCharacter.get(player.characterId);
      if (!totals[key]) totals[key] = {attended:0, bench:0, total:rows.length, source:'prio-list'};
      if (player.status === 'bench') { totals[key].bench++; if (countBench) totals[key].attended++; }
      else totals[key].attended++;
    }
    for (const totals of byCharacter.values()) if (!totals[key]) totals[key] = {attended:0, bench:0, total:rows.length, source:'prio-list'};
  }
  // Include all three denominators also for characters first encountered in a later variant.
  const totals = Object.fromEntries(['zg-mittwoch','zg-prime','zg-late'].map(key => [key,
    result.rows.filter(row => (row.raid.raid === 'zg' ? 'zg-mittwoch' : row.raid.raid) === key).slice(0,window).length]));
  return {byCharacter, totals};
}
