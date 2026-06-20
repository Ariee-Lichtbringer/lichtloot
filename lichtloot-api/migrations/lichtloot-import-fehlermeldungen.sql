begin;

with g as (select id from guilds where slug = 'lichtloot')
insert into issue_reports (guild_id, type, source, category, raid, item, slot, points, player, server, note, page, original_date, created_at)
values
((select id from g), 'Icon falsch', 'BWL Lootseite', 'Lootdaten', 'bwl', 'Rezept: Untod zu Wasser transmutieren', 'Rezept', null, null, null, 'ist grün', 'https://lichtloot.de/loot/bwl-loot.html?pin=GTP', null, to_timestamp('16.06.2026 22:38:23', 'DD.MM.YYYY HH24:MI:SS')),
((select id from g), 'Icon falsch', 'BWL Lootseite', 'Lootdaten', 'bwl', 'Roter Sack voller Edelsteine', null, null, null, null, null, 'https://lichtloot.de/loot/bwl-loot.html?pin=GTP', null, to_timestamp('18.06.2026 14:04:14', 'DD.MM.YYYY HH24:MI:SS')),
((select id from g), 'Icon falsch', 'BWL Lootseite', 'Lootdaten', 'bwl', 'Sack Edelsteine', null, null, null, null, null, 'https://lichtloot.de/loot/bwl-loot.html?pin=GTP', null, to_timestamp('18.06.2026 14:04:22', 'DD.MM.YYYY HH24:MI:SS')),
((select id from g), 'Icon falsch', 'AQ20 Prioliste', 'Prio/P0+ Punkte', 'aq20', 'Sandpolierter Hammer | Sandpolierter Hammer | Sandpolierter Hammer | Sandpolierter Hammer', null, null, 'Silentrage', 'Everlook', null, 'https://lichtloot.de/loot/aq20-loot.html?pin=F69', null, to_timestamp('18.06.2026 19:08:38', 'DD.MM.YYYY HH24:MI:SS')),
((select id from g), 'Icon falsch', 'AQ20 Lootseite', 'Lootdaten', 'aq20', 'Dicker Silithidenbrustschutz', 'Brust', null, null, null, null, 'https://lichtloot.de/loot/aq20-loot.html?pin=F69', null, to_timestamp('18.06.2026 19:08:50', 'DD.MM.YYYY HH24:MI:SS')),
((select id from g), 'Icon falsch', 'AQ20 Lootseite', 'Lootdaten', 'aq20', 'Gewänder der Sandstürme', 'Brust', null, null, null, null, 'https://lichtloot.de/loot/aq20-loot.html?pin=F69', null, to_timestamp('18.06.2026 19:09:10', 'DD.MM.YYYY HH24:MI:SS')),
((select id from g), 'Icon falsch', 'AQ20 Lootseite', 'Lootdaten', 'aq20', 'Kralle der gewaltigen Konzentration', 'In Schildhand geführt', null, null, null, null, 'https://lichtloot.de/loot/aq20-loot.html?pin=F69', null, to_timestamp('18.06.2026 19:09:19', 'DD.MM.YYYY HH24:MI:SS')),
((select id from g), 'Prio/P0+ Punkte falsch', 'ZG Lootseite', 'Lootdaten', 'zg', 'Gamaschen des Animisten', 'Beine', null, null, null, 'leder XD', 'https://lichtloot.de/loot/zg-loot.html?pin=FGU', null, to_timestamp('18.06.2026 21:00:20', 'DD.MM.YYYY HH24:MI:SS')),
((select id from g), 'Sonstiges', 'AQ20 Lootseite', 'Lootdaten', 'aq20', 'Maladath, Runenverzierte Klinge des schwarzen Drachenschwarms', 'Einhändig', null, null, null, 'Droppt in BWL, nicht AQ20', 'https://lichtloot.de/loot/aq20-loot.html?pin=9NL', null, to_timestamp('19.06.2026 16:04:00', 'DD.MM.YYYY HH24:MI:SS'));

commit;
