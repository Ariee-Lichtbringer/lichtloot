import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createBotQueueDelivery } from '../src/bot-queue-delivery.js';
const runtime = process.env.PGLITE_MODULE;
const { PGlite } = runtime ? await import(pathToFileURL(runtime).href) : await import('@electric-sql/pglite');
const db = new PGlite();
let checks = 0;
async function test(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
try {
  await db.exec(`CREATE TABLE bot_update_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), guild_id text NOT NULL,
    status text NOT NULL DEFAULT 'open', claimed_at timestamptz,
    resolved_at timestamptz, payload jsonb NOT NULL DEFAULT '{}'
  )`);
  const queue = createBotQueueDelivery((sql, args) => db.query(sql, args));
  const add = async () => (await db.query("INSERT INTO bot_update_queue(guild_id,payload) VALUES ('a','{\"original\":true}') RETURNING id")).rows[0].id;
  const row = async id => (await db.query('SELECT * FROM bot_update_queue WHERE id=$1', [id])).rows[0];
  const expire = id => db.query("UPDATE bot_update_queue SET claimed_at=now()-interval '6 minutes' WHERE id=$1", [id]);
  await test('concurrent claims elect exactly one worker', async () => {
    const id = await add();
    const claims = await Promise.all(Array.from({length:8}, () => queue.claim('a',id)));
    assert.equal(claims.filter(c=>c.claimed).length,1);
    assert.ok(claims.find(c=>c.claimed).leaseToken);
    assert.ok(claims.filter(c=>!c.claimed).every(c=>c.leaseToken===''));
  });
  await test('guild isolation applies to claim, renew, complete and retry', async () => {
    const id = await add();
    assert.equal((await queue.claim('b',id)).claimed,false);
    const {leaseToken} = await queue.claim('a',id);
    assert.equal((await queue.renew('b',id,leaseToken)).renewed,false);
    assert.equal((await queue.complete('b',id,leaseToken)).success,false);
    assert.equal((await queue.retry('b',id,leaseToken,'fail')).success,false);
    assert.equal((await row(id)).payload.workerLease,leaseToken);
  });
  await test('active lease renews and completion persists IDs and payload', async () => {
    const id = await add(); const {leaseToken} = await queue.claim('a',id);
    await db.query("UPDATE bot_update_queue SET claimed_at=now()-interval '4 minutes' WHERE id=$1",[id]);
    const before=(await row(id)).claimed_at;
    assert.equal((await queue.renew('a',id,leaseToken)).renewed,true);
    assert.ok(new Date((await row(id)).claimed_at)>new Date(before));
    assert.equal((await queue.complete('a',id,leaseToken,'discord-123','channel-456')).success,true);
    const saved=await row(id);
    assert.equal(saved.status,'done'); assert.ok(saved.resolved_at);
    assert.deepEqual(saved.payload,{original:true,deliveryState:'sent',messageId:'discord-123',postChannelId:'channel-456'});
    assert.equal((await queue.claim('a',id)).claimed,false);
  });
  await test('expired lease cannot complete, retry or renew', async () => {
    const id=await add(); const {leaseToken}=await queue.claim('a',id); await expire(id);
    assert.equal((await queue.complete('a',id,leaseToken)).success,false);
    assert.equal((await queue.retry('a',id,leaseToken,'late')).success,false);
    assert.equal((await queue.renew('a',id,leaseToken)).renewed,false);
    assert.equal((await row(id)).status,'processing');
  });
  await test('replacement worker owns lease and stale token cannot mutate row', async () => {
    const id=await add(); const old=await queue.claim('a',id); await expire(id);
    const replacement=await queue.claim('a',id);
    assert.equal(replacement.claimed,true); assert.notEqual(replacement.leaseToken,old.leaseToken);
    assert.equal((await queue.complete('a',id,old.leaseToken)).success,false);
    assert.equal((await queue.retry('a',id,old.leaseToken,'stale')).success,false);
    assert.equal((await queue.renew('a',id,old.leaseToken)).renewed,false);
    assert.equal((await row(id)).payload.workerLease,replacement.leaseToken);
    assert.equal((await queue.complete('a',id,replacement.leaseToken)).success,true);
  });
  await test('five failures persist a terminal failure and bounded reason', async () => {
    const id=await add();
    for(let attempt=1;attempt<=5;attempt++){
      const claim=await queue.claim('a',id); assert.equal(claim.claimed,true);
      const failed=await queue.retry('a',id,claim.leaseToken,'x'.repeat(800));
      assert.equal(failed.success,true); assert.equal(failed.attempts,attempt);
      assert.equal(failed.status,attempt===5?'failed':'processing');
      assert.equal((await queue.claim('a',id)).claimed,false);
      assert.equal((await queue.retry('a',id,claim.leaseToken,'duplicate')).success,false);
      await expire(id);
    }
    const saved=await row(id);
    assert.equal(saved.status,'failed'); assert.ok(saved.resolved_at);
    assert.equal(saved.payload.deliveryState,'blocked'); assert.equal(saved.payload.deliveryAttempts,5);
    assert.equal(saved.payload.failureReason.length,500); assert.equal(saved.payload.workerLease,undefined);
    assert.equal((await queue.claim('a',id)).claimed,false);
  });
  await test('malformed IDs and tokens are rejected without modifying jobs', async () => {
    const id=await add();
    assert.equal((await queue.claim('a','invalid')).success,false);
    for(const method of ['renew','complete','retry']) assert.equal((await queue[method]('a',id,'invalid')).success,false);
    assert.equal((await row(id)).status,'open');
  });
  console.log(`${checks} queue delivery tests passed`);
} finally { await db.close(); }
