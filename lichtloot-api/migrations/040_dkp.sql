create table if not exists dkp_auctions (
 id uuid primary key, guild_id uuid not null references guilds(id),
 item text not null, raid text not null default '', min_bid numeric(14,2) not null check(min_bid>0),
 high_bid numeric(14,2) not null default 0 check(high_bid>=0),
 winner_id uuid references characters(id), status text not null default 'open' check(status in ('open','closed','cancelled')),
 created_at timestamptz not null default now(), closed_at timestamptz,
 unique(guild_id,id)
);
create table if not exists dkp_ledger (
 id uuid primary key, guild_id uuid not null references guilds(id), character_id uuid not null references characters(id),
 amount numeric(14,2) not null check(amount<>0), kind text not null check(kind in ('credit','loot','adjustment','auction')),
 reason text not null, item text not null default '', raid text not null default '', actor_role text not null,
 auction_id uuid, created_at timestamptz not null default now(),
 foreign key(guild_id,auction_id) references dkp_auctions(guild_id,id), unique(auction_id)
);
create index if not exists dkp_ledger_guild_character on dkp_ledger(guild_id,character_id);
create table if not exists dkp_bids (
 id uuid primary key,guild_id uuid not null references guilds(id),auction_id uuid not null,
 character_id uuid not null references characters(id),amount numeric(14,2) not null check(amount>0),created_at timestamptz not null default now(),
 foreign key(guild_id,auction_id) references dkp_auctions(guild_id,id)
);
create table if not exists dkp_requests (
 guild_id uuid not null references guilds(id),request_id uuid not null,fingerprint text not null,result jsonb not null,
 created_at timestamptz not null default now(),primary key(guild_id,request_id)
);

create table if not exists dkp_rules (
 guild_id uuid primary key references guilds(id), revision integer not null default 0,
 rules jsonb not null default '{}'::jsonb
);
create table if not exists dkp_awards (
 guild_id uuid not null references guilds(id), award_key text not null,
 details jsonb not null, created_at timestamptz not null default now(), primary key(guild_id,award_key)
);
