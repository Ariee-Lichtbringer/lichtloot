-- Storage foundation only. No point awards or priority submissions enabled yet.
create table if not exists forever_point_entries (
 id uuid primary key default gen_random_uuid(), guild_id uuid not null,
 character_id uuid not null, raid_id uuid, amount numeric(12,2) not null,
 reason text not null, created_by text not null, created_at timestamptz not null default now(),
 request_key text not null, unique(guild_id,request_key),
 foreign key(guild_id,character_id) references forever_characters(guild_id,id),
 foreign key(guild_id,raid_id) references forever_raids(guild_id,id)
);
create table if not exists forever_priority_entries (
 id uuid primary key default gen_random_uuid(), guild_id uuid not null,
 character_id uuid not null, raid_id uuid not null, item_id bigint not null check(item_id>0),
 priority integer not null check(priority>=0), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(guild_id,raid_id,character_id,priority),
 unique(guild_id,raid_id,character_id,item_id),
 foreign key(guild_id,character_id) references forever_characters(guild_id,id),
 foreign key(guild_id,raid_id) references forever_raids(guild_id,id)
);
