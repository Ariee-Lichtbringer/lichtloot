create table if not exists issue_reports (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references guilds(id) on delete cascade,
  type text,
  source text,
  category text,
  raid text,
  item text,
  slot text,
  points text,
  player text,
  server text,
  note text,
  page text,
  original_date text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists player_messages (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references guilds(id) on delete cascade,
  player_pin text not null,
  title text not null,
  body text not null,
  raid_id text,
  raid_name text,
  raid_date date,
  raid_time text,
  lead_pin text,
  sender text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_issue_reports_guild_open
  on issue_reports(guild_id, created_at desc)
  where resolved_at is null;

create index if not exists idx_player_messages_guild_pin
  on player_messages(guild_id, player_pin, created_at desc);
