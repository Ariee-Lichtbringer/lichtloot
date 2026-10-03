import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('raid scheduler catches database failure, releases guard and retries on next tick', async () => {
  const source = fs.readFileSync(process.env.SCHEMA_TEST_SOURCE || new URL('../src/server.js', import.meta.url), 'utf8');
  const start = source.indexOf('let raidHelperScheduleTickRunning = false;');
  const end = source.indexOf('\nlet missingPrioReminderTickRunning', start);
  let fail = true, calls = 0, warnings = 0, processed = 0;
  const context = vm.createContext({
    ensureRaidHelperScheduleSchema: async () => { calls++; if (fail) throw Error('Query read timeout'); },
    query: async () => ({ rows: [{ guild_id: 'fixture' }] }),
    processRaidHelperSchedules: async () => { processed++; },
    console: { warn() { warnings++; } }
  });
  vm.runInContext(source.slice(start, end), context);
  await context.runRaidHelperScheduleTick();
  assert.equal(warnings, 1);
  assert.equal(processed, 0);
  fail = false;
  await Promise.all([context.runRaidHelperScheduleTick(), context.runRaidHelperScheduleTick()]);
  assert.equal(calls, 2);
  assert.equal(processed, 1);
  context.query = async () => { throw Error('connection lost'); };
  await context.runRaidHelperScheduleTick();
  assert.equal(warnings, 2);
});
