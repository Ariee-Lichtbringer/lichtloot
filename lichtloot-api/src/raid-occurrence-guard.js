// Keep historical duplicates intact, but reject new registrations for an
// occupied guild/type/date/time. Runs for all writers, including imports.
const installed = new WeakMap();
export function ensureRaidOccurrenceGuard(query, table, variants) {
  if (!['raids', 'p0_only_events'].includes(table)) throw new Error('Invalid raid table');
  let tables = installed.get(query);
  if (!tables) installed.set(query, tables = new Map());
  if (!tables.has(table)) {
    const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
    const types = ['mc','bwl','aq40','naxx','zg','zg-mittwoch','zg-prime','zg-late','aq20','ony'];
    const canonical = field => `(case ${types.map(type => `when lower(trim(${field})) in (${variants(type).map(literal).join(',')}) then ${literal(type)}`).join(' ')} else lower(trim(${field})) end)`;
    const external = table === 'raids' ? 'external_raid_id' : 'external_p0_id';
    const active = row => `${row}.deleted_at is null and lower(coalesce(${row}.status,'')) not in ('gelöscht','geloescht','deleted','abgesagt','cancelled','canceled')`;
    const time = row => `coalesce(nullif(trim(${row}.raid_time),''),'00:00')::time`;
    const promise = query(`create or replace function guard_${table}_occurrence() returns trigger language plpgsql as $guard$
      begin
        if NEW.raid_date is null or not (${active('NEW')}) then return NEW; end if;
        -- Existing duplicates can still be archived and audited. Moving or
        -- restoring one into an occupied occurrence is never allowed.
        if TG_OP='UPDATE' then
          if (${active('OLD')}) and NEW.guild_id=OLD.guild_id
            and ${canonical('NEW.raid_type')}=${canonical('OLD.raid_type')}
            and NEW.raid_date=OLD.raid_date and ${time('NEW')}=${time('OLD')}
          then return NEW; end if;
        end if;
        perform pg_advisory_xact_lock(hashtext(NEW.guild_id::text),hashtext('raid-occurrence'));
        -- BEFORE INSERT also runs for an idempotent external-ID upsert.
        if TG_OP='INSERT' and exists(select 1 from ${table} r
          where r.guild_id=NEW.guild_id and nullif(r.${external},'')=NEW.${external}
            and (${active('r')}) and ${canonical('r.raid_type')}=${canonical('NEW.raid_type')}
            and r.raid_date=NEW.raid_date and ${time('r')}=${time('NEW')})
        then return NEW; end if;
        if exists(select 1 from ${table} r where r.guild_id=NEW.guild_id and r.id<>NEW.id
          and (${active('r')}) and ${canonical('r.raid_type')}=${canonical('NEW.raid_type')}
          and r.raid_date=NEW.raid_date and ${time('r')}=${time('NEW')}) then
          raise exception 'Für diesen Raidtermin gibt es bereits einen Anmelder. Bitte den vorhandenen Anmelder verwenden.' using errcode='23505', constraint='raid_occurrence_unique';
        end if;
        return NEW;
      end $guard$;
      create or replace trigger ${table}_occurrence_guard before insert or update of guild_id,raid_type,raid_date,raid_time,deleted_at,status
        on ${table} for each row execute function guard_${table}_occurrence();`)
      .catch(error => { tables.delete(table); throw error; });
    tables.set(table, promise);
  }
  return tables.get(table);
}
