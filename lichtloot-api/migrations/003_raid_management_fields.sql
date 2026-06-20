alter table raids
  add column if not exists external_raid_id text,
  add column if not exists raid_time text,
  add column if not exists guild_name text,
  add column if not exists player_link text,
  add column if not exists p0plus_freigabe text not null default 'geschlossen';

alter table prios
  add column if not exists bench text not null default '';

create unique index if not exists idx_raids_guild_external_raid_id
  on raids(guild_id, external_raid_id)
  where external_raid_id is not null and external_raid_id <> '';

create index if not exists idx_raids_guild_lead_pin on raids(guild_id, lead_pin);
create index if not exists idx_raids_guild_raid_pin on raids(guild_id, raid_pin);
