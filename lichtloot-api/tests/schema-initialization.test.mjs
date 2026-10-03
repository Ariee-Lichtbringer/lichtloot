import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createSchemaInitialization } from '../src/schema-initialization.js';

function fixture() {
  const sql = [];
  let connections = 0, releases = 0, clock = 0;
  const pool = { async connect() {
    connections++;
    return { async query(text) { sql.push(text); return { rows: [] }; }, release() { releases++; } };
  } };
  return { sql, pool, ensure: createSchemaInitialization(pool, { now: () => clock }),
    advance: () => { clock += 5001; }, counts: () => ({ connections, releases }) };
}

test('parallel requests share one committed initialization; later reads do no DDL', async () => {
  const f = fixture();
  const initialize = q => q('create table fixture(id int)');
  await Promise.all(Array.from({ length: 30 }, () => f.ensure('fixture', initialize)));
  await f.ensure('fixture', () => { throw Error('must not run'); });
  assert.deepEqual(f.counts(), { connections: 1, releases: 1 });
  assert.deepEqual(f.sql, ['begin', "set local lock_timeout = '2s'", 'create table fixture(id int)', 'commit']);
});

test('failed initialization rolls back; retry is delayed, shared, and can recover', async () => {
  const f = fixture(), failure = new Error('database unavailable');
  const bad = async q => { await q('partial schema'); throw failure; };
  const results = await Promise.allSettled(Array.from({ length: 20 }, () => f.ensure('fixture', bad)));
  assert.ok(results.every(r => r.status === 'rejected' && r.reason === failure));
  await assert.rejects(f.ensure('fixture', bad), error => error === failure);
  assert.deepEqual(f.counts(), { connections: 1, releases: 1 });
  assert.equal(f.sql.at(-1), 'rollback');
  f.advance();
  await f.ensure('fixture', q => q('recovered schema'));
  assert.deepEqual(f.counts(), { connections: 2, releases: 2 });
  assert.equal(f.sql.at(-1), 'commit');
});

test('connection and commit errors never mark a schema ready', async () => {
  for (const stage of ['connect', 'commit']) {
    let attempts = 0, released = 0, clock = 0;
    const ensure = createSchemaInitialization({ async connect() {
      attempts++;
      if (stage === 'connect') throw Error(stage);
      return { async query(sql) { if (sql === 'commit') throw Error(stage); }, release() { released++; } };
    } }, { now: () => clock });
    await assert.rejects(ensure('schema', async () => {}), new RegExp(stage));
    clock = 5001;
    await assert.rejects(ensure('schema', async () => {}), new RegExp(stage));
    assert.equal(attempts, 2);
    assert.equal(released, stage === 'commit' ? 2 : 0);
  }
});

test('independent schemas each initialize once', async () => {
  const f = fixture();
  await Promise.all(['a', 'b', 'a', 'b'].map(name => f.ensure(name, q => q(name))));
  assert.deepEqual(f.counts(), { connections: 2, releases: 2 });
});

test('actual server schema functions reuse committed work and never use caller query', async () => {
  const source = readFileSync(process.env.SCHEMA_TEST_SOURCE || new URL('../src/server.js', import.meta.url), 'utf8');
  const f = fixture();
  const context = vm.createContext({ ensureSchema: f.ensure, query() { throw Error('caller transaction used'); } });
  for (const name of ['ensureGuildDiscordConfigSchema', 'ensureDiscordChannelSchema', 'ensureBuffTables', 'ensureGuildReadinessSchema']) {
    const start = source.indexOf(`async function ${name}() {`);
    assert.ok(start >= 0);
    const end = source.indexOf('\n}', start) + 2;
    vm.runInContext(source.slice(start, end), context);
    await Promise.all(Array.from({ length: 20 }, () => context[name]()));
    const count = f.sql.length;
    await context[name]();
    assert.equal(f.sql.length, count);
  }
  assert.deepEqual(f.counts(), { connections: 4, releases: 4 });
  assert.equal(f.sql.filter(sql => sql.includes('rend_caster')).length, 1);
  assert.equal(f.sql.filter(sql => sql.includes('create table if not exists guild_master_codes')).length, 1);
});

test('schema SQL commits and failed DDL rolls back in isolated PostgreSQL', { skip: !process.env.PGLITE_MODULE }, async () => {
  const { PGlite } = await import(process.env.PGLITE_MODULE);
  const db = new PGlite();
  try {
    await db.exec('create table guilds(id uuid primary key)');
    let clock = 0;
    const ensure = createSchemaInitialization({ async connect() {
      return { query: (sql, args) => db.query(sql, args), release() {} };
    } }, { now: () => clock });
    await assert.rejects(ensure('rollback', async q => {
      await q('create table should_rollback(id int)');
      throw Error('simulated failure');
    }), /simulated failure/);
    assert.equal((await db.query("select to_regclass('should_rollback') as name")).rows[0].name, null);
    clock = 5001;
    await ensure('rollback', q => q('create table should_rollback(id int)'));
    const source = readFileSync(process.env.SCHEMA_TEST_SOURCE || new URL('../src/server.js', import.meta.url), 'utf8');
    const context = vm.createContext({ ensureSchema: ensure });
    for (const name of ['ensureGuildDiscordConfigSchema', 'ensureDiscordChannelSchema', 'ensureBuffTables', 'ensureGuildReadinessSchema']) {
      const start = source.indexOf(`async function ${name}() {`);
      vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), context);
      await context[name]();
      await context[name]();
    }
    const tables = (await db.query("select tablename from pg_tables where schemaname='public'")).rows.map(r => r.tablename);
    for (const name of ['discord_bot_members', 'hordenbuff_events', 'guild_master_codes']) assert.ok(tables.includes(name));
  } finally { await db.close(); }
});
