import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
const start = source.indexOf('function raidP0SignupCountSql()');
const context = vm.createContext({});
vm.runInContext(source.slice(start, source.indexOf('\n}\n', start) + 2), context);
assert.equal((source.match(/\$\{raidP0SignupCountSql\(\)\}/g) || []).length, 2, 'Both overview endpoints use the shared count');
await db.exec(`
  create table raids(id text, guild_id text, external_raid_id text, raid_pin text);
  create table players(id text, guild_id text);
  create table characters(id text, player_id text, name text, server text);
  create table items(id text, name text);
  create table prios(raid_id text, character_id text, p1_item_id text, comment text);
  create table p0_discord_signups(guild_id text, raid_id text, player_name text, server text, item_name text, discord_user_id text);
  create table po_post_entries(guild_id text, raid_id text, raid_pin text, player_name text, server text, item_name text, archived_at text, config_only boolean);
  insert into raids values ('naxx','guild','public-naxx','5AT'), ('bwl','guild','','');
  insert into players values ('account','guild');
  insert into items values ('item','Die zehrende Kälte');
`);
const count = async (raid = 'naxx') => (await db.query(`select ${context.raidP0SignupCountSql()} as count from raids r where id = $1`, [raid])).rows[0].count;
try {
  // Bot posts have no server column in the production schema.
  await db.exec('alter table po_post_entries rename column server to unused_fixture_server');
  assert.equal(await count(), 0);
  // Screenshot scenario: six P0 selections plus one ordinary P1/P2/P3 player.
  for (let n = 0; n < 7; n++) {
    await db.query('insert into characters values ($1,$2,$3,$4)', [`char${n}`, 'account', `Player${n}`, 'Lichtbringer']);
    await db.query('insert into prios values ($1,$2,$3,$4)', ['naxx', `char${n}`, 'item', JSON.stringify(n < 6 ? {p0Selected:'ja'} : {p0Selected:'nein'})]);
  }
  assert.equal(await count(), 6, 'P0 selections from the loot page are counted');
  await db.exec(`insert into p0_discord_signups values ('guild','naxx','PLAYER0','lichtbringer','Die zehrende Kälte','discord');
    insert into po_post_entries values ('guild','naxx','','Player0','','Die zehrende Kälte',null,false);`);
  assert.equal(await count(), 6, 'Website, Discord and serverless bot mirrors count once');
  await db.exec(`insert into p0_discord_signups values ('guild','naxx','Alt','Lichtbringer','Die zehrende Kälte','discord');`);
  assert.equal(await count(), 7, 'Alts on the same Discord account remain separate');
  await db.exec(`insert into p0_discord_signups values ('guild','naxx','Player0','Other server','Die zehrende Kälte','other');`);
  assert.equal(await count(), 8, 'Same-name characters on distinct servers remain separate');
  await db.exec(`insert into po_post_entries values
    ('guild','old-raid','5AT','Wrong raid','','Item',null,false),
    ('other','naxx','5AT','Wrong guild','','Item',null,false),
    ('guild','','','Unassigned','','Item',null,false),
    ('guild','naxx','','Archived','','Item','yesterday',false),
    ('guild','naxx','','Config','','Item',null,true),
    ('guild','naxx','','Empty','','',null,false);`);
  assert.equal(await count(), 8, 'Reused PINs, other guilds, archived/config/empty rows are excluded');
  assert.equal(await count('bwl'), 0, 'Empty IDs/PINs cannot match unrelated rows');
  await db.exec(`insert into po_post_entries values ('guild','','5AT','Legacy','','Item',null,false);`);
  assert.equal(await count(), 9, 'PIN fallback works for legacy rows without raid ID');
  await db.query('update prios set comment=$1 where character_id=$2', [JSON.stringify({p0Plus:'ja'}), 'char6']);
  assert.equal(await count(), 10, 'P0+ metadata counts');
  await db.query('update prios set comment=$1 where character_id=$2', [JSON.stringify({p0Item:'Die zehrende Kälte'}), 'char6']);
  assert.equal(await count(), 10, 'Legacy P0 item metadata counts');
  await db.query('update prios set comment=$1 where character_id=$2', [JSON.stringify({p0Selected:'nein',p0Item:'Die zehrende Kälte'}), 'char6']);
  assert.equal(await count(), 9, 'Explicitly deselected P0 is not inferred from an old item');
  await db.query('update prios set comment=$1 where character_id=$2', ['ordinary free-text comment', 'char6']);
  assert.equal(await count(), 9, 'Non-JSON comments do not break overview queries');
  console.log('P0 overview count: website selections, mirrors, alts, servers, raid/guild isolation, legacy metadata and deselection passed.');
} finally {
  await db.close();
}
