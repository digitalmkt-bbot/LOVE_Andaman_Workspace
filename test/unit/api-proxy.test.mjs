// The backend switch (api-proxy.js, 2026-08-28): send /api routes to the new backend without
// touching the client.
//
// allotment_v2 has no API base URL — every call is a hardcoded same-origin absolute path — so the
// switch has to happen server-side. Four things here are easy to get wrong and expensive:
//   1. a proxied route must reach upstream intact: method, path, query, body, cookies
//   2. NOTHING outside /api may ever be proxied — a proxied app.html or bundle is a white screen
//   3. with API_PROXY_ROUTES set, an unlisted /api route must still be served locally (strangler fig)
//   4. an unreachable upstream must 502 fast, not hang
//
// Runs server.js against an in-test stand-in for the new backend. No database, no real backend.
// Run: node --test test/unit/api-proxy.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const UP_PORT = 8843, ALL_PORT = 8844, SOME_PORT = 8845, DEAD_PORT = 8846;
const UPSTREAM = `http://127.0.0.1:${UP_PORT}`;
const ALL = `http://127.0.0.1:${ALL_PORT}`;       // API_PROXY_ROUTES unset  → every /api route
const SOME = `http://127.0.0.1:${SOME_PORT}`;     // API_PROXY_ROUTES=/api/v1/rate-types
const DEAD = `http://127.0.0.1:${DEAD_PORT}`;     // points at a port nothing listens on

let upstream, seen = [], kids = [];

function boot(port, env) {
  const c = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), SESSION_SECRET: 'test-secret',
           DATABASE_URL: '', AUTH_OIDC_ISSUER: '', AUTH_OIDC_CLIENT_ID: '', ...env },
  });
  kids.push(c);
  return new Promise((resolve, reject) => {
    let log = '';
    const t = setTimeout(() => reject(new Error(`server on ${port} did not start:\n` + log)), 60_000);
    const on = (d) => { log += d; if (log.includes('LOVE Andaman on')) { clearTimeout(t); resolve(log); } };
    c.stdout.on('data', on); c.stderr.on('data', on);
  });
}

test.before(async () => {
  upstream = http.createServer((q, s) => {
    let body = '';
    q.on('data', (d) => (body += d));
    q.on('end', () => {
      seen.push({ method: q.method, url: q.url, body, headers: q.headers });
      s.writeHead(201, { 'Content-Type': 'application/json', 'X-Upstream': 'yes',
                         'Set-Cookie': 'from_upstream=1; Path=/' });
      s.end(JSON.stringify({ hello: 'from the new backend', saw: q.url }));
    });
  });
  await new Promise((r) => upstream.listen(UP_PORT, r));
  await boot(ALL_PORT,  { API_PROXY_URL: UPSTREAM });
  await boot(SOME_PORT, { API_PROXY_URL: UPSTREAM, API_PROXY_ROUTES: '/api/v1/rate-types' });
  await boot(DEAD_PORT, { API_PROXY_URL: `http://127.0.0.1:1` });
});
test.after(() => { kids.forEach((c) => c.kill()); upstream?.close(); });

const get = (base, p, opt = {}) => fetch(base + p, { redirect: 'manual', ...opt });

test('a proxied route reaches the new backend intact', async () => {
  seen = [];
  const r = await get(ALL, '/api/v1/rate-types?active=1', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sess=abc' },
    body: JSON.stringify({ code: 'RT1' }),
  });
  assert.equal(r.status, 201, 'upstream status must pass through, not be rewritten');
  assert.equal(r.headers.get('x-upstream'), 'yes', 'upstream headers must pass through');
  assert.deepEqual(await r.json(), { hello: 'from the new backend', saw: '/api/v1/rate-types?active=1' });

  assert.equal(seen.length, 1);
  const [hit] = seen;
  assert.equal(hit.method, 'POST');
  assert.equal(hit.url, '/api/v1/rate-types?active=1', 'path AND query string must survive');
  assert.equal(hit.body, '{"code":"RT1"}', 'the request body must be streamed upstream');
  assert.equal(hit.headers.cookie, 'sess=abc', 'the session cookie must reach the new backend');
  assert.equal(hit.headers.host, `127.0.0.1:${UP_PORT}`,
    'host must be rewritten to the upstream, or a vhost router serves the wrong service');
  assert.ok(hit.headers['x-forwarded-host'], 'upstream must still learn who the browser asked for');
});

test('nothing outside /api is ever proxied', async () => {
  seen = [];
  for (const p of ['/allotment_v2/allotment_v2.html', '/allotment_v2/js/08-app.js',
                   '/allotment_v2/css/01-base.css', '/auth/login', '/']) {
    const r = await get(ALL, p, { headers: { Accept: 'text/html' } });
    assert.notEqual(r.headers.get('x-upstream'), 'yes', p + ' must never be proxied');
  }
  assert.equal(seen.length, 0, 'the new backend must not have been contacted at all');
});

test('API_PROXY_ROUTES moves one route without moving the rest', async () => {
  seen = [];
  const moved = await get(SOME, '/api/v1/rate-types');
  assert.equal(moved.headers.get('x-upstream'), 'yes', 'the listed route goes to the new backend');

  const stayed = await get(SOME, '/api/me');
  assert.notEqual(stayed.headers.get('x-upstream'), 'yes', 'an unlisted route stays local');
  assert.equal(stayed.status, 401, 'and is answered by this server exactly as before');
  assert.equal(seen.length, 1, 'only the listed route reached upstream');
});

test('an unreachable backend fails fast and says so', async () => {
  const r = await get(DEAD, '/api/load');
  assert.equal(r.status, 502);
  const body = await r.json();
  assert.match(body.error, /api proxy failed/, 'the message must name the proxy, not look like an app bug');
  assert.equal(body.path, '/api/load');
});

test('the switch is off unless API_PROXY_URL is set', async () => {
  const log = await boot(8847, {});                       // no API_PROXY_URL
  assert.ok(!log.includes('[proxy]'), 'an unconfigured proxy must not announce itself');
  const r = await fetch('http://127.0.0.1:8847/api/me');
  assert.equal(r.status, 401, 'and /api/me is answered locally, exactly as before');
});
