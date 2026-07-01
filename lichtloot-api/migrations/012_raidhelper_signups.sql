alter table raids
  add column if not exists raidhelper_enabled boolean not null default true,
  add column if not exists signup_deadline text,
  add column if not exists max_players integer,
  add column if not exists tank_slots integer,
  add column if not exists heal_slots integer,
  add column if not exists dd_slots integer,
  add column if not exists discord_channel_id text,
  add column if not exists discord_message_id text,
  add column if not exists description text,
  add column if not exists raid_image_url text;

alter table raid_signups
  add column if not exists role text not null default 'flex',
  add column if not exists source text not null default 'lichtloot',
  add column if not exists discord_user_id text,
  add column if not exists discord_name text;

create index if not exists idx_raid_signups_raid_status
  on raid_signups(raid_id, status);

create table if not exists raid_external_signups (
  id uuid primary key default gen_random_uuid(),
  raid_id uuid references raids(id) on delete cascade,
  guild_id uuid not null references guilds(id) on delete cascade,
  raid_type text not null,
  raid_date date,
  raid_time text,
  player_name text not null,
  class_name text,
  role text not null default 'flex',
  status text not null default 'signed',
  source text not null default 'discord',
  discord_user_id text,
  discord_name text,
  discord_channel_id text,
  discord_message_id text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_raid_external_signups_unique_source
  on raid_external_signups(guild_id, coalesce(raid_id::text, ''), lower(player_name), source);

create index if not exists idx_raid_external_signups_guild_raid
  on raid_external_signups(guild_id, raid_id, raid_date);

create table if not exists discord_bot_channels (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references guilds(id) on delete cascade,
  discord_guild_id text,
  discord_guild_name text,
  channel_id text not null,
  channel_name text not null,
  channel_type text,
  category_name text,
  position integer,
  can_send boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (guild_id, channel_id)
);

create index if not exists idx_discord_bot_channels_guild
  on discord_bot_channels(guild_id, category_name, position, channel_name);
