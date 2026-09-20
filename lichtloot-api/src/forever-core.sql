-- Dedicated Forever database. No Era raid, loot or points data.
create table if not exists guilds (
 "id" uuid default gen_random_uuid() not null,
 "name" text not null,
 "slug" text not null,
 "faction" text,
 "server" text,
 "logo_url" text,
 "background_url" text,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 "guild_pin" text,
 "discord_guild_id" text default ''::text not null,
 PRIMARY KEY (id),
 UNIQUE (slug)
);
create table if not exists guild_settings (
 "guild_id" uuid not null,
 "points_label" text default 'P0/P0+'::text not null,
 "prio_slots" integer default 3 not null,
 "allow_player_pin_login" boolean default true not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 "primary_color" text default '#facc15'::text not null,
 "accent_color" text default '#1d4ed8'::text not null,
 "layout_json" jsonb default '{}'::jsonb not null,
 FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
 PRIMARY KEY (guild_id)
);
create table if not exists players (
 "id" uuid default gen_random_uuid() not null,
 "guild_id" uuid not null,
 "player_pin" text not null,
 "security_question" text,
 "security_answer" text,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 "role" text default 'member'::text not null,
 "is_blocked" boolean default false not null,
 "blocked_at" timestamp with time zone,
 "blocked_reason" text default ''::text not null,
 "approval_status" text default 'pending'::text not null,
 "approved_at" timestamp with time zone,
 "approved_by" text default ''::text not null,
 "discord_role_ids" jsonb default '[]'::jsonb not null,
 "permissions" jsonb default '[]'::jsonb not null,
 "notification_discord_names" jsonb default '[]'::jsonb not null,
 "login_notice_queued_at" timestamp with time zone,
 PRIMARY KEY (id),
 UNIQUE (guild_id, player_pin),
 FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);
create table if not exists characters (
 "id" uuid default gen_random_uuid() not null,
 "player_id" uuid not null,
 "name" text not null,
 "server" text not null,
 "class_name" text not null,
 "role" text,
 "is_main" boolean default false not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 "recruit_status_lifted" boolean default false not null,
 "recruit_status_lifted_at" timestamp with time zone,
 "recruit_status_lifted_by" text,
 PRIMARY KEY (id),
 FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
 UNIQUE (player_id, name, server)
);
create table if not exists guild_master_codes (
 "guild_id" uuid not null,
 "master_code" text not null,
 "updated_at" timestamp with time zone default now() not null,
 FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
 PRIMARY KEY (guild_id)
);
