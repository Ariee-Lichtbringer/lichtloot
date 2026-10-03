import test from 'node:test';
import assert from 'node:assert/strict';
import { installAccessSecurity } from '../src/auth-security.js';

function setup() {
  let middleware;
  const security = installAccessSecurity({ use(path, handler) { middleware = handler; } }, {
    allowedOrigins: new Set(['https://lichtloot.de']), enforceTransport: false
  });
  function request(status, body, action = 'savePrio') {
    let reached = false;
    const req = { ip: 'fixture', path: '/apps-script', query: {}, body: { action, playerPin: 'fixture' }, get: () => undefined };
    const res = { statusCode: 200, set() {}, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    middleware(req, res, () => { reached = true; res.statusCode = status; res.json(body); });
    return { reached, status: res.statusCode };
  }
  return { request, close: security.close };
}

test('server, timeout, rate and validation errors never lock a valid user out', () => {
  const f = setup();
  try {
    for (let i = 0; i < 60; i++) {
      for (const status of [500, 502, 503, 504, 400, 404, 409, 429]) assert.equal(f.request(status, { success: false, error: 'failure' }).reached, true);
    }
    assert.equal(f.request(200, { success: true }).reached, true);
  } finally { f.close(); }
});

test('invalid credentials still trigger the brute-force limit', () => {
  const f = setup();
  try {
    for (let i = 0; i < 30; i++) assert.equal(f.request(i % 2 ? 401 : 403, { success: false }).reached, true);
    assert.deepEqual(f.request(200, { success: true }), { reached: false, status: 429 });
  } finally { f.close(); }
});

test('an empty successful character lookup counts; a failed lookup does not', () => {
  const f = setup();
  try {
    for (let i = 0; i < 40; i++) assert.equal(f.request(500, { characters: [] }, 'getCharactersByPin').reached, true);
    for (let i = 0; i < 30; i++) assert.equal(f.request(200, { characters: [] }, 'getCharactersByPin').reached, true);
    assert.equal(f.request(200, { characters: [{}] }, 'getCharactersByPin').status, 429);
  } finally { f.close(); }
});
