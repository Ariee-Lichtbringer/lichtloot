alter table guild_settings
  add column if not exists primary_color text not null default '#facc15',
  add column if not exists accent_color text not null default '#1d4ed8';
