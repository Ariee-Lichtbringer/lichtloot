create table if not exists log_analyses (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references guilds(id) on delete cascade,
  report_code text not null,
  report_url text not null,
  title text,
  raid text,
  raid_date date,
  status text not null default 'pending',
  summary jsonb not null default '{}'::jsonb,
  discord_channel_id text,
  discord_message_id text,
  discord_author text,
  posted_at timestamptz,
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guild_id, report_code)
);

create index if not exists log_analyses_guild_created_idx
  on log_analyses (guild_id, created_at desc);
