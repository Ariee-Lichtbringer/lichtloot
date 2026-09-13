create table if not exists raid_loot_assignments (
 guild_id uuid not null references guilds(id), raid_id uuid not null references raids(id), receipt_key text not null,
 character_id uuid, player_name text not null default '', server text not null default '',
 revision integer not null default 1, updated_at timestamptz not null default now(),
 primary key(guild_id,raid_id,receipt_key)
);
create table if not exists raid_loot_assignment_history (
 id bigserial primary key, guild_id uuid not null, raid_id uuid not null, receipt_key text not null,
 character_id uuid, player_name text not null, server text not null, revision integer not null,
 changed_at timestamptz not null default now(), changed_by text not null default 'Gildenleitung'
);
