create table if not exists hordenbuff_events (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references guilds(id) on delete cascade,
  buff text not null default 'Rend',
  event_date date not null,
  event_time text not null,
  faction text not null default 'Horde',
  status text not null default 'offen',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guild_id, buff, event_date, event_time)
);

create table if not exists hordenbuff_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references hordenbuff_events(id) on delete cascade,
  ally_char text not null default '',
  horde_char text not null default '',
  status text not null default 'offen',
  note text not null default '',
  source text not null default 'railway',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hordenbuff_events_guild_date
  on hordenbuff_events(guild_id, event_date, event_time);

create index if not exists idx_hordenbuff_entries_event
  on hordenbuff_entries(event_id);

create table if not exists bot_update_queue (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references guilds(id) on delete cascade,
  type text not null default 'hordenbuff_update',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_bot_update_queue_open
  on bot_update_queue(guild_id, status, created_at);
