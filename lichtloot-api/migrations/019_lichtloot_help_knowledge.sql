create table if not exists lichtloot_help_knowledge (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references guilds(id) on delete cascade,
  question text not null default '',
  answer text not null default '',
  status text not null default 'pending',
  submitted_by_discord_id text not null default '',
  submitted_by_name text not null default '',
  approved_by_discord_id text not null default '',
  approved_by_name text not null default '',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lichtloot_help_knowledge_status_check
    check (status in ('pending', 'approved', 'rejected'))
);

create index if not exists idx_lichtloot_help_knowledge_guild_status
  on lichtloot_help_knowledge(guild_id, status, updated_at desc);

