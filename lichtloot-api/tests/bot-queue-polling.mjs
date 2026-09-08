import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import {createBotQueueDelivery} from '../src/bot-queue-delivery.js';
const {PGlite}=process.env.PGLITE_MODULE ? await import(pathToFileURL(process.env.PGLITE_MODULE).href) : await import('@electric-sql/pglite');
const server=await readFile(new URL('../src/server.js',import.meta.url),'utf8');
function extract(name){
  const start=server.indexOf(`async function ${name}(`);
  assert.ok(start>=0,`${name} exists`);
  const tail=server.slice(start);
  const end=tail.slice(1).search(/^(?:async )?function /m);
  assert.ok(end>=0,'next function boundary exists');
  return tail.slice(0,end+1);
}
const db=new PGlite();
let checks=0;
async function test(name,fn){await db.exec('TRUNCATE bot_update_queue');await fn();checks++;console.log(`PASS ${name}`);}
try{
  await db.exec(`CREATE TABLE guilds(id text PRIMARY KEY,slug text,name text);
  INSERT INTO guilds VALUES ('a','guild-a','Guild A');
  CREATE TABLE bot_update_queue(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guild_id text NOT NULL,
   type text NOT NULL,status text NOT NULL DEFAULT 'open',payload jsonb NOT NULL DEFAULT '{}',
   created_at timestamptz NOT NULL DEFAULT now(),claimed_at timestamptz,resolved_at timestamptz)`);
  const query=async(sql,args)=>{const result=await db.query(sql,args);return {...result,rowCount:result.affectedRows};};
  const noop=async()=>{};
  const sandbox={query,botQueueDelivery:createBotQueueDelivery(query),clean:v=>String(v??'').trim(),isUuid:v=>/^[0-9a-f-]{36}$/i.test(v),requireMasterOrQueueToken:()=>{},
    ensurePendingPlayerLoginNoticesQueued:noop,ensureRaidMissingPrioRemindersQueued:noop,maintainRaidRefreshQueue:noop,expireStalePrioReminders:noop,currentPrioReminderQueueSql:()=> 'true'};
  vm.createContext(sandbox);
  vm.runInContext(['getBotQueueAllGuilds','claimBotQueue','resolveBotQueue'].map(extract).join('\n'),sandbox);
  const add=async()=> (await query("INSERT INTO bot_update_queue(guild_id,type) VALUES ('a','po_approval_notice') RETURNING id")).rows[0].id;
  const row=async id=>(await query('SELECT * FROM bot_update_queue WHERE id=$1',[id])).rows[0];
  const poll=(manual=true)=>sandbox.getBotQueueAllGuilds({query:{types:'po_approval_notice',...(manual?{claimMode:'manual-v1'}:{})}});
  const claim=id=>sandbox.claimBotQueue({guildId:'a',query:{rowNumber:id,leaseProtocol:'v1'}});
  const resolve=(id,leaseToken)=>sandbox.resolveBotQueue({guildId:'a',query:{rowNumber:id,...(leaseToken?{leaseToken}:{})}});
  const expire=id=>query("UPDATE bot_update_queue SET claimed_at=now()-interval '6 minutes' WHERE id=$1",[id]);
  await test('manual listing leaves open; two readers but only one claim winner',async()=>{
    const id=await add();
    const listings=await Promise.all([poll(),poll()]);
    assert.ok(listings.every(x=>x.items[0].rowNumber===id));
    assert.equal((await row(id)).status,'open');assert.equal((await row(id)).claimed_at,null);
    const claims=await Promise.all([claim(id),claim(id)]);
    assert.equal(claims.filter(x=>x.claimed).length,1);
    assert.equal((await row(id)).status,'processing');
    assert.equal((await poll()).items.length,0);
  });
  await test('legacy automatic poll still claims and tokenless resolve completes',async()=>{
    const id=await add();const listed=await poll(false);
    assert.equal(listed.claimMode,'automatic');assert.equal(listed.items[0].rowNumber,id);
    assert.equal((await row(id)).status,'processing');assert.ok((await row(id)).claimed_at);
    assert.equal((await row(id)).payload.workerLease,undefined);
    await resolve(id);assert.equal((await row(id)).status,'done');
  });
  await test('expiry returns job to manual listing and replaces lease',async()=>{
    const id=await add();const old=await claim(id);await expire(id);
    assert.equal((await poll()).items[0].rowNumber,id);
    assert.equal((await row(id)).status,'open');assert.equal((await row(id)).payload.workerLease,undefined);
    const next=await claim(id);assert.equal(next.claimed,true);assert.notEqual(next.leaseToken,old.leaseToken);
    assert.equal((await resolve(id,old.leaseToken)).success,false);
    assert.equal((await row(id)).status,'processing');
    assert.equal((await resolve(id,next.leaseToken)).success,true);
  });
  await test('tokenless legacy resolution cannot override active lease',async()=>{
    const id=await add();const leased=await claim(id);
    await resolve(id);
    assert.equal((await row(id)).status,'processing');assert.equal((await row(id)).payload.workerLease,leased.leaseToken);
    assert.equal((await resolve(id,leased.leaseToken)).success,true);
  });
  await test('legacy direct claim replaces an expired v1 lease',async()=>{
    const id=await add();await claim(id);await expire(id);
    const legacy=await sandbox.claimBotQueue({guildId:'a',query:{rowNumber:id}});
    assert.equal(legacy.claimed,true);
    assert.equal((await row(id)).payload.workerLease,undefined);
    await resolve(id);assert.equal((await row(id)).status,'done');
  });
  console.log(`${checks} real server queue polling tests passed`);
}finally{await db.close();}
