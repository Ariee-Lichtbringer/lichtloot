import { randomUUID } from 'node:crypto';

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
export function scheduleTimes(params, now = Date.now()) {
  const parse = value => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
  const execute = parse(params.executeAt), deadline = parse(params.deadlineAt);
  if (!Number.isFinite(execute) || !Number.isFinite(deadline)) throw fail('Ausführungszeit und P0-Schluss mit Zeitzone angeben.');
  if (execute < now + 5000) throw fail('Die Ausführung muss mindestens 5 Sekunden in der Zukunft liegen.');
  if (execute >= deadline) throw fail('Die Ausführung muss vor dem P0-Schluss liegen.');
  if (deadline > now + 90 * 86400000) throw fail('Planungen sind höchstens 90 Tage im Voraus möglich.');
  return { executeAt: new Date(execute).toISOString(), deadlineAt: new Date(deadline).toISOString() };
}

// One row lock spans the actual priority write and the terminal job update.
// A restart can retry pending jobs without applying a committed priority twice.
export async function lockSchedule(client, id) {
  const result = await client.query(`select *, clock_timestamp() as database_now from p0_schedules where id=$1 for update`, [id]);
  const job = result.rows[0];
  if (!job || job.status !== 'pending') return null;
  const now = new Date(job.database_now).getTime();
  if (now < new Date(job.execute_at).getTime()) return null;
  if (now >= new Date(job.deadline_at).getTime()) throw fail('P0-Schluss verpasst; es wurde keine P0 gesetzt.', 409);
  return job;
}

export function createP0Scheduler({ query, prepare, execute }) {
  let schema, running = false;
  function ensure() {
    if (!schema) schema = query(`create table if not exists p0_schedules (
      id uuid primary key, guild_id uuid not null references guilds(id),
      raid_id uuid not null references raids(id) on delete cascade,
      character_id uuid not null references characters(id) on delete cascade,
      player_name text not null, server text not null default '', item_name text not null,
      execute_at timestamptz not null, deadline_at timestamptz not null,
      status text not null default 'pending' check(status in ('pending','applied','failed','cancelled')),
      detail text not null default '', created_at timestamptz not null default now(), finished_at timestamptz,
      check(execute_at < deadline_at)
    )`).then(() => query(`create unique index if not exists p0_schedules_pending_player
      on p0_schedules(guild_id, raid_id, character_id) where status='pending'`))
      .then(() => query(`create index if not exists p0_schedules_due on p0_schedules(execute_at) where status='pending'`))
      .catch(error => { schema = null; throw error; });
    return schema;
  }
  async function handle(guild, params) {
    await ensure();
    if (params.action === 'guildScheduleP0') {
      const times = scheduleTimes(params);
      const { raid, character, item } = await prepare(guild.id, params);
      // Validation may involve several database round trips.
      scheduleTimes(times);
      try {
        const result = await query(`insert into p0_schedules
          (id,guild_id,raid_id,character_id,player_name,server,item_name,execute_at,deadline_at)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
          [randomUUID(),guild.id,raid.id,character.id,character.name,character.server || '',item.name,times.executeAt,times.deadlineAt]);
        return { success: true, id: result.rows[0].id };
      } catch (error) {
        if (error.code === '23505') throw fail('Für diesen Charakter und Raid ist bereits eine P0 geplant. Bitte zuerst stornieren.',409);
        throw error;
      }
    }
    if (params.action === 'guildCancelScheduledP0') {
      if (!/^[0-9a-f-]{36}$/i.test(String(params.id || ''))) throw fail('Ungültige Planungs-ID.');
      const result = await query(`update p0_schedules set status='cancelled',finished_at=now()
        where id=$1 and guild_id=$2 and status='pending' returning id`,[params.id,guild.id]);
      if (!result.rows.length) throw fail('Die Planung wurde bereits ausgeführt, storniert oder nicht gefunden.',409);
      return { success: true };
    }
    const result = await query(`select s.id,s.player_name,s.server,s.item_name,s.execute_at,s.deadline_at,
      s.status,s.detail,s.finished_at,r.name as raid_name,r.raid_date
      from p0_schedules s join raids r on r.id=s.raid_id
      where s.guild_id=$1 order by (s.status='pending') desc,s.execute_at desc limit 250`,[guild.id]);
    return { success: true, jobs: result.rows, serverTime: new Date().toISOString() };
  }
  async function tick() {
    if (running) return;
    running = true;
    try {
      await ensure();
      const due = await query(`select id,guild_id,raid_id,character_id,item_name from p0_schedules
        where status='pending' and execute_at<=clock_timestamp() order by execute_at limit 20`);
      await Promise.allSettled(due.rows.map(async job => {
        try { await execute(job); }
        catch (error) {
          // An applied job is never retried if Discord refresh fails later.
          await query(`update p0_schedules set status='failed',detail=$2,finished_at=now()
            where id=$1 and status='pending'`,[job.id,String(error.message || 'Ausführung fehlgeschlagen.').slice(0,600)]);
        }
      }));
    } finally { running = false; }
  }
  return { handle, tick, ensure };
}
