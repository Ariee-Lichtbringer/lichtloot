-- Gildenbankanträge (Rüstungsteile, AQ20-Token, Skarabäen und Götzen).
-- Die API legt diese Tabelle bei der ersten Nutzung automatisch an; die Datei dokumentiert das Schema.
BEGIN;
create table if not exists armor_requests (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references guilds(id) on delete cascade,
  player_id uuid,
  character_id uuid,
  character_name text not null,
  server text not null default '',
  class_name text not null default '',
  tier text not null default '',
  item_id text not null,
  item_name text not null,
  token jsonb,
  materials jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  review_note text not null default '',
  reviewed_at timestamptz,
  queue_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_armor_requests_guild on armor_requests(guild_id,status,created_at desc);
COMMIT;
