create extension if not exists pgcrypto;

create table if not exists guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  faction text,
  server text,
  logo_url text,
  background_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guild_settings (
  guild_id uuid primary key references guilds(id) on delete cascade,
  points_label text not null default 'P0/P0+',
  prio_slots integer not null default 3,
  allow_player_pin_login boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references guilds(id) on delete cascade,
  name text not null,
  admin_pin text not null,
  role text not null default 'raidlead',
  created_at timestamptz not null default now(),
  unique (guild_id, admin_pin)
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references guilds(id) on delete cascade,
  player_pin text not null,
  security_question text,
  security_answer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guild_id, player_pin)
);

create table if not exists characters (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  name text not null,
  server text not null,
  class_name text not null,
  role text,
  is_main boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, name, server)
);

create table if not exists raids (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references guilds(id) on delete cascade,
  name text not null,
  raid_type text not null,
  raid_date date not null,
  status text not null default 'open',
  raid_pin text,
  lead_pin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists raid_signups (
  id uuid primary key default gen_random_uuid(),
  raid_id uuid not null references raids(id) on delete cascade,
  character_id uuid not null references characters(id) on delete cascade,
  status text not null default 'signed',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (raid_id, character_id)
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  raid_type text not null,
  item_id text,
  name text not null,
  quality text,
  icon_url text,
  created_at timestamptz not null default now()
);

create index if not exists items_raid_type_name_idx
  on items (lower(raid_type), lower(name));

create index if not exists items_raid_type_item_id_idx
  on items (lower(raid_type), item_id)
  where item_id is not null;

create table if not exists prios (
  id uuid primary key default gen_random_uuid(),
  raid_id uuid not null references raids(id) on delete cascade,
  character_id uuid not null references characters(id) on delete cascade,
  p1_item_id uuid references items(id),
  p2_item_id uuid references items(id),
  p3_item_id uuid references items(id),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (raid_id, character_id)
);

create table if not exists p0plus_points (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references guilds(id) on delete cascade,
  character_id uuid not null references characters(id) on delete cascade,
  item_id uuid references items(id),
  points numeric(10,2) not null default 0,
  source text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_players_guild_pin on players(guild_id, player_pin);
create index if not exists idx_characters_player on characters(player_id);
create index if not exists idx_raids_guild_date on raids(guild_id, raid_date desc);
create index if not exists idx_prios_raid on prios(raid_id);
create index if not exists idx_p0plus_guild_character on p0plus_points(guild_id, character_id);

insert into guilds (name, slug)
values ('LichtLoot', 'lichtloot')
on conflict (slug) do nothing;

insert into guild_settings (guild_id)
select id from guilds where slug = 'lichtloot'
on conflict (guild_id) do nothing;
