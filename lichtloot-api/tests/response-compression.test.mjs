import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { gunzipSync, brotliDecompressSync } from 'node:zlib';
import express from 'express';
import { responseCompression } from '../src/response-compression.js';

const app = express();
app.use(responseCompression);
const payload = { success: true, snapshots: Array.from({ length: 2000 }, (_, i) => ({ row: i, cells: ['Raid', 'Spieler', '#ffffff'] })) };
const original = Buffer.from(JSON.stringify(payload));
app.post('/data', (req, res) => res.set('Cache-Control', 'no-store').json(payload));
app.get('/small', (req, res) => res.json({ success: true }));
app.get('/no-transform', (req, res) => res.set('Cache-Control', 'no-store, no-transform').json(payload));
app.get('/events', (req, res) => res.type('text/event-stream').send('data: ' + 'x'.repeat(3000) + '\n\n'));
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const request = (path, encoding) => new Promise((resolve, reject) => {
  const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path, method: path === '/data' ? 'POST' : 'GET', headers: encoding === undefined ? {} : { 'Accept-Encoding': encoding } }, res => {
    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => resolve({ headers: res.headers, body: Buffer.concat(chunks), status: res.statusCode }));
    res.on('error', reject);
  });
  req.on('error', reject);
  req.end();
});
try {
  for (const [encoding, decode] of [['gzip', gunzipSync], ['br', brotliDecompressSync]]) {
    const result = await request('/data', encoding);
    assert.equal(result.status, 200);
    assert.equal(result.headers['content-encoding'], encoding);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.match(result.headers.vary, /Accept-Encoding/);
    assert.deepEqual(decode(result.body), original);
    assert.ok(result.body.length < original.length / 4);
  }
  for (const encoding of [undefined, 'identity', 'gzip;q=0, br;q=0, deflate;q=0']) {
    const result = await request('/data', encoding);
    assert.equal(result.headers['content-encoding'], undefined);
    assert.deepEqual(result.body, original);
  }
  for (const path of ['/small', '/no-transform', '/events']) {
    assert.equal((await request(path, 'gzip, br')).headers['content-encoding'], undefined);
  }
  console.log('PASS: gzip/Brotli preserve data; plain clients, no-store, small responses, no-transform and event streams remain compatible.');
} finally {
  await new Promise(resolve => server.close(resolve));
}
