import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';

// §embedRoute · /embed/calendar and /embed/bytrip are 302s to the app with the embed parameters (lk-inbox's server.js served the same).
function get(port, path) {
  return new Promise((ok, bad) => http.get({ port, path, host: '127.0.0.1' }, (r) => { r.resume(); r.on('end', () => ok({ status: r.statusCode, location: r.headers.location })); }).on('error', bad));
}
let proc, port = 3000 + 800 + Math.floor(Math.random() * 150);
test.before(async () => {
  proc = spawn(process.execPath, ['static-server.js'], { env: { ...process.env, PORT: String(port), OPS_API_URL: 'direct' }, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { await get(port, '/health'); return; } catch (_) { await new Promise((r) => setTimeout(r, 100)); } }
  throw new Error('static-server did not start');
});
test.after(() => proc && proc.kill());

const APP = '/allotment_v2/allotment_v2.html';
test('calendar and bytrip redirect to the booking tab in embed mode (view only: no edit=1 unless asked)', async () => {
  assert.deepEqual(await get(port, '/embed/calendar'), { status: 302, location: APP + '?embed=1&view=booking&tab=cal' });
  assert.deepEqual(await get(port, '/embed/bytrip?date=2026-09-20&route=r5'), { status: 302, location: APP + '?embed=1&view=booking&tab=bytrip&date=2026-09-20&route=r5' });
  assert.equal((await get(port, '/embed/calendar?edit=1&chrome=1')).location, APP + '?embed=1&view=booking&tab=cal&chrome=1&edit=1');
  assert.equal((await get(port, '/embed/calendar/')).status, 302, 'a trailing slash is fine');
});
test('the ticket is carried to the page (it exchanges it itself); unknown or malformed values are dropped', async () => {
  assert.equal((await get(port, '/embed/calendar?t=abc_DEF-1.xyz_9')).location, APP + '?embed=1&view=booking&tab=cal&t=abc_DEF-1.xyz_9');
  assert.equal((await get(port, '/embed/calendar?date=tomorrow&route=a%0d%0aSet-Cookie:x&foo=1&t=bad%20ticket')).location, APP + '?embed=1&view=booking&tab=cal');
});
test('an unknown embed page is a 404, not a redirect', async () => {
  assert.equal((await get(port, '/embed/nope')).status, 404);
  assert.equal((await get(port, '/embed')).status, 404);
});
