insert into guilds (name, slug, server)
values ('Nachtwächter', 'nachtloot', 'Everlook')
on conflict (slug) do update
set name = excluded.name,
    server = excluded.server,
    updated_at = now();

insert into guild_settings (guild_id)
select id from guilds where slug = 'nachtloot'
on conflict (guild_id) do nothing;
