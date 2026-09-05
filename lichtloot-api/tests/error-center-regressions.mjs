import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
function extract(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
const decode = text => text.replace(/&(amp|quot|#39|lt|gt);/g, (_, key) =>
  ({amp:'&', quot:'"', '#39':"'", lt:'<', gt:'>'})[key]);
for (const prefix of ['loot/', 'lichtloot-api/public/loot/', 'lichtloot-api/public/']) {
  for (const raid of ['aq40', 'bwl']) {
    const page = `${prefix}${raid}-loot.html`, source = read(page);
    for (const script of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
      new vm.Script(script[1], {filename: page});
    }
    const context = vm.createContext({});
    vm.runInContext(extract(source, 'jsonAttribute'), context);
    vm.runInContext(extract(source, 'reportButtonHtml'), context);
    const payload = {item:"Ahn'Qiraj", note:'"quoted" \\ path\n<&quot;>', player:'Utus'};
    context.payload = payload;
    const html = vm.runInContext('reportButtonHtml(payload)', context);
    const handler = html.match(/onclick='([^']*)'/)[1];
    let received;
    context.openReportModal = value => { received = value; };
    vm.runInContext(decode(handler), context);
    assert.equal(JSON.stringify(received), JSON.stringify(payload));
    console.log(`${page}: syntax and special-character payload OK`);
  }
}

const server = read('lichtloot-api/src/server.js');
const updateSource = 'async ' + extract(server, 'adminUpdateRaidHelperSignup');
async function runUpdate({rename = false, ambiguous = false, dbError} = {}) {
  let updated = false, notified = false;
  const context = vm.createContext({
    clean: value => String(value ?? '').trim(),
    isUuid: () => true,
    normalizeSignupStatus: value => value || 'signed',
    requireMasterCode: () => {},
    findRaidHelperSignupForAdmin: async () => ({player:'SameName', characterId:'original-id'}),
    normalizeRaidSignupRow: row => row,
    enqueueRaidHelperAdminSideEffects: async () => { notified = true; return {}; },
    query: async (sql, values) => {
      if (sql.includes('update raid_external_signups')) return {rows:[]};
      if (sql.includes('select c.id')) {
        assert.equal(values[2], rename ? null : 'original-id');
        return {rows: ambiguous ? [{id:'one'}, {id:'two'}] : [{id:rename ? 'new-id' : 'original-id'}]};
      }
      assert.ok(sql.includes('update raid_signups'));
      updated = true;
      if (dbError) throw dbError;
      return {rows:[{id:'signup-id'}]};
    }
  });
  vm.runInContext(updateSource, context);
  try {
    await context.adminUpdateRaidHelperSignup({guildId:'guild', query:{
      signupId:'signup-id', masterCode:'test', playerName:rename ? 'OtherName' : 'SameName', role:'heal'
    }});
    assert.equal(notified, true);
    return null;
  } catch (error) {
    assert.equal(notified, false);
    if (ambiguous) assert.equal(updated, false);
    return error;
  }
}
assert.equal(await runUpdate(), null);
assert.equal(await runUpdate({rename:true}), null);
assert.equal((await runUpdate({rename:true, ambiguous:true})).statusCode, 409);
const duplicate = await runUpdate({rename:true, dbError:{code:'23505', constraint:'raid_signups_raid_id_character_id_key'}});
assert.equal(duplicate.statusCode, 409);
assert.match(duplicate.message, /bereits.*angemeldet/);
const unrelated = {code:'08006', message:'connection lost'};
assert.equal(await runUpdate({dbError:unrelated}), unrelated);
console.log('Signup identity, ambiguity, duplicate conflict and unrelated errors OK');

for (const path of ['loot/raid-signup-mirror.js', 'lichtloot-api/public/loot/raid-signup-mirror.js']) {
  const source = read(path);
  new vm.Script(source, {filename:path});
  const start = source.indexOf('  async function saveOwnSignup(){');
  const end = source.indexOf('\n  }', start) + 4;
  const feedback = {};
  const context = vm.createContext({
    activeSignupRaidId: () => '', currentPlayerPin: () => 'test', currentPlayerName: () => 'test',
    document: {getElementById: () => null, querySelectorAll: () => [feedback]},
    apiJsonp: () => { throw Error('Must not send without a raid'); }
  });
  vm.runInContext(source.slice(start, end), context);
  await context.saveOwnSignup();
  assert.match(feedback.textContent, /zuerst einen Raid/);
  console.log(`${path}: missing raid blocked before API request`);
}
