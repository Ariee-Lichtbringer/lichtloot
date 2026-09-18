// Use the persisted raid and database clock; browser parameters cannot extend the deadline.
export function assertP0Window(row) {
  if (!row?.enabled) return;
  const start = Number(row.start_ms), now = Number(row.now_ms);
  if (row.start_ms == null || !Number.isFinite(start) || !Number.isFinite(now)) {
    throw Object.assign(new Error('P0-Eintragung nicht möglich: Bitte zuerst Datum und Uhrzeit des Raids festlegen.'), {statusCode:409});
  }
  if (now >= start - 30 * 60 * 1000) {
    throw Object.assign(new Error('P0/P0+ ist geschlossen: Einträge sind nur bis 30 Minuten vor Raidbeginn möglich.'), {statusCode:409});
  }
}
export async function assertP0Cutoff(client, guildId, raidId, raidKey) {
  const {rows} = await client.query(`select
    coalesce(gs.layout_json->'lootPageSectionsByRaid'->$3->>'p0Cutoff30', 'false') = 'true' as enabled,
    case when r.raid_date is not null and r.raid_time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
      then extract(epoch from ((r.raid_date + r.raid_time::time) at time zone 'Europe/Berlin')) * 1000
      else null end as start_ms,
    extract(epoch from clock_timestamp()) * 1000 as now_ms
    from raids r left join guild_settings gs on gs.guild_id=r.guild_id
    where r.id=$2 and r.guild_id=$1`, [guildId,raidId,raidKey]);
  if (!rows[0]) throw Object.assign(new Error('Raid wurde nicht gefunden.'),{statusCode:404});
  assertP0Window(rows[0]);
}
