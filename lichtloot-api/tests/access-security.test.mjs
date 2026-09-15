import assert from 'node:assert/strict';
import express from 'express';
import { installAccessSecurity, hashSecurityAnswer, verifySecurityAnswer, migrateSecurityAnswers, redactAccessDetails } from '../src/auth-security.js';
let clock = 1000;
const app = express(); app.use(express.json());
const auth = installAccessSecurity(app, { allowedOrigins: new Set(['https://lichtloot.de']), now: () => clock });
app.post('/api/echo', (req, res) => res.json({ success: req.body.pin !== 'wrong', ...req.body }));
const server = app.listen(0); await new Promise(r => server.once('listening', r));
const base = 'http://127.0.0.1:' + server.address().port;
async function call(path, body, headers = {}) {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json(), headers: response.headers };
}
try {
  for (const key of ['pin','playerPin','masterCode','securityAnswer','queueToken']) {
    const r = await call('/api/echo?' + key + '=TEST'); assert.equal(r.status,400); assert.equal(r.data.code,'CREDENTIALS_IN_URL'); assert.equal(r.headers.get('Cache-Control'),'no-store');
  }
  assert.equal((await call('/api/echo', { pin:'TEST' }, { Origin:'https://evil.test' })).status,403);
  assert.equal((await call('/api/echo', { pin:'TEST' }, { Origin:'null' })).status,403);
  assert.equal((await call('/api/echo?callback=test')).status,400);
  assert.equal((await call('/api/guilds/test/players/by-pin/TEST/characters')).status,400);
  // Normal guild activity must not consume the failed-login budget.
  for(let i=0;i<80;i++) assert.equal((await call('/api/echo',{pin:'valid'+i},{Origin:'https://lichtloot.de'})).status,200);
  for(let i=0;i<30;i++) assert.equal((await call('/api/echo',{pin:'wrong',masterCode:'constant'})).status,200);
  assert.equal((await call('/api/echo',{pin:'valid'})).status,429);
  clock += 900001;
  assert.equal((await call('/api/echo',{pin:'valid'})).status,200);
  for(let i=0;i<5;i++) assert.equal((await call('/api/echo',{action:'resetPlayerPinBySecurity',guild:'test',char:'Target',server:'Realm',securityAnswer:'wrong',securityQuestion:'q'+i})).status,200);
  assert.equal((await call('/api/echo',{action:'resetPlayerPinBySecurity',guild:'test',char:'TARGET',server:'Realm',securityAnswer:'wrong',securityQuestion:'different'})).status,429);
  const h=await hashSecurityAnswer(' Mäxchen '); assert(await verifySecurityAnswer(h,'MÄXCHEN')); assert(!(await verifySecurityAnswer(h,'wrong'))); assert(!(await verifySecurityAnswer('Mäxchen','Mäxchen'))); assert.notEqual(h,await hashSecurityAnswer('Mäxchen')); assert.equal(await hashSecurityAnswer(''),null);
  let row={id:1,security_answer:'Mäxchen'};
  const query=async(sql,args)=>{if(sql.startsWith('select'))return {rows:row.security_answer.startsWith('scrypt-v1$')?[]:[{...row}]};assert.equal(args[2],row.security_answer);row.security_answer=args[0];return {rowCount:1};};
  assert.equal(await migrateSecurityAnswers(query),1); assert(await verifySecurityAnswer(row.security_answer,'mäxchen')); assert.equal(await migrateSecurityAnswers(query),0);
  const redacted=redactAccessDetails('page?playerPin=SECRET&masterCode=SECRET2 {"securityAnswer":"SECRET3"} /players/by-pin/SECRET4/characters');
  assert(!redacted.includes('SECRET')); assert(redacted.includes('[REDACTED]'));
  console.log('PASS origins, URL/JSONP rejection, failed-access limits, successful activity, recovery limit, expiry, salted hashes, migration, redaction');
} finally { auth.close(); server.close(); }
