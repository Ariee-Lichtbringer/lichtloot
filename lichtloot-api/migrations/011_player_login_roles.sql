alter table players
  add column if not exists role text not null default 'member';
