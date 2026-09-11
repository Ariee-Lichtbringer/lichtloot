const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
function extract(source, name) {
  const start = source.indexOf(`async function ${name}(`);
  const end = source.indexOf('\nasync function ', start + 1);
  return source.slice(start, end < 0 ? undefined : end);
}
(async () => {
  for (const file of ['lichtloot-api/src/server.js', 'server.js']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const calls = [];
    const ctx = vm.createContext({
      clean: value => String(value || '').trim(),
      normalizeRaidType: value => String(value || '').toLowerCase(),
      raidTypeSearchValues: value => [value],
      isUuid: () => false,
      query: async (sql, values) => { calls.push({sql, values}); return {rows: []}; }
    });
    vm.runInContext(source.slice(source.indexOf('function raidIdentityTypeSearchValues('), source.indexOf('async function findRaid(')), ctx);
    vm.runInContext(extract(source, 'findRaid'), ctx);
    // Missing regular AQ40 must stay missing so getPublishedPrios can use P0-only events.
    assert.equal(await ctx.findRaid('guild', {raid: 'aq40', playerPin: 'JEG'}), null);
    assert.equal(calls.length, 1, 'No untyped PIN fallback into archived Naxx');
    assert(calls[0].sql.includes('lower(raid_type) = any('));
    calls.length = 0;
    await ctx.findRaid('guild', {raid: 'aq40', raidId: 'NAXX-old'});
    assert(calls[0].sql.includes('lower(raid_type) = any('), 'Explicit IDs still constrained by page type');
    calls.length = 0;
    await ctx.findRaid('guild', {playerPin: 'JEG'});
    assert.equal(calls.length, 1);
    assert(!calls[0].sql.includes('lower(raid_type)'), 'PIN-only discovery remains supported');

    calls.length = 0;
    await ctx.findRaid('guild', {raid:'zg', playerPin:'PRIME'});
    assert(calls[0].values.some(v=>Array.isArray(v)&&v.includes('zg-prime')&&v.includes('zg-late')));
    calls.length = 0;
    await ctx.findRaid('guild', {raid:'zg-prime', playerPin:'LATE'});
    assert(!calls[0].values.some(v=>Array.isArray(v)&&v.includes('zg-late')), 'Explicit subtypes stay separate');
    calls.length = 0;
    await ctx.findRaid('guild', {raid:'zg', raidDate:'2026-09-12'});
    assert(!calls[0].values.some(v=>Array.isArray(v)&&v.includes('zg-prime')), 'Date-only lookup must not switch events');

    const sqlCalls = [];
    let mode = 'wrong-id';
    let p0Lookups = 0;
    const client = {
      async query(sql, values) {
        sqlCalls.push(sql);
        if (/^\s*select id, external_raid_id/.test(sql)) {
          if (mode === 'wrong-id') return {rows: [{id:'old-naxx', raid_type:'naxx'}]};
          if (mode === 'zg-prime') return {rows: [{id:'prime',external_raid_id:'ZG PRIME-test',raid_type:'zg-prime'}]};
          return {rows: []};
        }
        if (/select lower\(g.slug\)/.test(sql)) throw Object.assign(new Error('identity accepted'), {code:'IDENTITY_ACCEPTED'});
        return {rows: []};
      },
      release() {}
    };
    Object.assign(ctx, {
      dkpService: {assertPrio: async()=>{}},
      lootSourceRaidType: ()=>{throw Object.assign(new Error('identity accepted'),{code:'IDENTITY_ACCEPTED'});},
      pool: {connect: async()=>client},
      findCharacterForPin: async()=>({id:'character',player_id:'player'}),
      findP0OnlyEvent: async()=>{p0Lookups++; return null;},
    });
    for (const name of ['ensurePoPostEntriesSchema','ensurePrioSchema','ensureUnlinkedP0PlusSchema','ensureCharacterPoReleaseSchema','ensureGuildPoItemsSchema']) ctx[name] = async()=>{};
    vm.runInContext(extract(source, 'savePrio'), ctx);
    await assert.rejects(ctx.savePrio({guildId:'guild',query:{raid:'aq40',raidId:'NAXX-old',raidPin:'JEG'}}), error=>error.statusCode===409);
    assert(sqlCalls.includes('rollback'));
    assert(!sqlCalls.some(sql=>/insert into|update /i.test(sql)), 'No writes or DM for a mismatched raid');
    mode='zg-prime';sqlCalls.length=0;
    await assert.rejects(ctx.savePrio({guildId:'guild',query:{raid:'zg',raidId:'ZG PRIME-test',raidPin:'PRIME'}}),error=>error.code==='IDENTITY_ACCEPTED');
    assert(!sqlCalls.some(sql=>/insert into|update /i.test(sql)));
    mode = 'not-found'; sqlCalls.length = 0;
    await assert.rejects(ctx.savePrio({guildId:'guild',query:{raid:'aq40',raidPin:'JEG'}}), error=>error.statusCode===404);
    assert.equal(p0Lookups, 1, 'AQ40 P0 event lookup is reached after regular raid miss');
    assert.equal(sqlCalls.filter(sql=>/^\s*select id, external_raid_id/.test(sql)).length, 1);
    p0Lookups = 0; sqlCalls.length = 0;
    await assert.rejects(ctx.savePrio({guildId:'guild',query:{raid:'aq40',raidId:'missing-explicit-id',raidPin:'JEG'}}), error=>error.statusCode===404);
    assert.equal(p0Lookups, 0, 'An explicit missing ID cannot silently change the save target');
    console.log(`${file}: raid identity regressions passed`);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
