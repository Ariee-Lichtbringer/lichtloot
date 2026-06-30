alter table raids
  drop constraint if exists raids_guild_id_raid_type_raid_date_key;

create unique index if not exists idx_raids_guild_external_raid_id
  on raids(guild_id, external_raid_id)
  where external_raid_id is not null and external_raid_id <> '';
