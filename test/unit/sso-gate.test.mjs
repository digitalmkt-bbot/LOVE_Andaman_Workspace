// The SSO gate (§ssoGate, 2026-08-27): with Authentik configured, Authentik IS the login page.
//
// Before this, /auth/login existed but nothing used it — opening the app just showed the built-in
// username/password modal (js/01-auth-sync.js showLogin(), reached when /api/me answers 401).
//
// Three things here are easy to break and expensive to get wrong, so each is asserted:
//   1. only a top-level HTML navigation is redirected — never fetch/XHR, never an asset
//   2. ?login=password always serves the built-in form, or a broken Authentik locks everyone out
//   3. sign-out ends the Authentik session too, or the next load silently signs the user back in
//
// Runs server.js against an in-test stand-in for Authentik. No database, no real IdP.
// Run: node --test test/unit/sso-gate.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const IDP_PORT = 8833, APP_PORT = 8834;
const ISSUER = `http://127.0.0.1:${IDP_PORT}/application/o/latest`;
const BASE = `http://127.0.0.1:${APP_PORT}`;
const APP = '/allotment_v2/allotment_v2.html';
const HTML = { Accept: 'text/html,application/xhtml+xml' };

let idp, child;
const get = (p, opt = {}) => fetch(BASE + p, { redirect: 'manual', ...opt });

test.before(async () => {
  idp = http.createServer((q, s) => {
    if (q.url.includes('.well-known')) {
      s.writeHead(200, { 'Content-Type': 'application/json' });
      return s.end(JSON.stringify({
        authorization_endpoint: ISSUER + '/authorize/', token_endpoint: ISSUER + '/token/',
        jwks_uri: ISSUER + '/jwks/', end_session_endpoint: ISSUER + '/end-session/',
      }));
    }
    s.writeHead(404); s.end();
  });
  await new Promise((r) => idp.listen(IDP_PORT, r));

  child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(APP_PORT), SESSION_SECRET: 'test-secret',
           AUTH_OIDC_ISSUER: ISSUER, AUTH_OIDC_CLIENT_ID: 'la-ops' },
  });
  await new Promise((resolve, reject) => {
    let log = '';
    const t = setTimeout(() => reject(new Error('server did not start:\n' + log)), 60_000);
    const on = (d) => { log += d; if (log.includes('LOVE Andaman on')) { clearTimeout(t); resolve(); } };
    child.stdout.on('data', on); child.stderr.on('data', on);
  });
});
test.after(() => { child?.kill(); idp?.close(); });

test('an unauthenticated page load goes to Authentik, not the built-in form', async () => {
  const r = await get(APP, { headers: HTML });
  assert.equal(r.status, 302);
  const loc = new URL(r.headers.get('location'), BASE);
  assert.equal(loc.pathname, '/auth/login');
  assert.equal(loc.searchParams.get('next'), APP, 'where to return must survive the round trip');
});

test('"/" still reaches the gate through the app path', async () => {
  const r = await get('/', { headers: HTML });
  assert.equal(r.headers.get('location'), APP);
});

test('?login=password is an escape hatch a broken Authentik cannot take away', async () => {
  const r = await get(APP + '?login=password', { headers: HTML });
  assert.equal(r.status, 200, 'must serve the app so the built-in login modal can render');
});

test('only top-level HTML navigations are gated', async () => {
  // A fetch/XHR for the page (no Accept: text/html) must not be answered with a redirect to an IdP
  // login screen — the caller wants the document, and /api/me is what reports "not logged in".
  assert.equal((await get(APP)).status, 200, 'fetch/XHR must not be redirected');
  for (const asset of ['/allotment_v2/css/01-base.css', '/allotment_v2/js/08-app.js']) {
    assert.equal((await get(asset, { headers: HTML })).status, 200, asset + ' must not be gated');
  }
  const me = await get('/api/me');
  assert.equal(me.status, 401, '/api/me keeps answering 401 rather than redirecting');
});

test('/api/logout tells the client to finish at Authentik', async () => {
  const r = await get('/api/logout');
  const body = await r.json();
  assert.equal(body.ok, true);
  assert.equal(body.ssoLogout, '/auth/logout',
    'without this the client just reloads, the SSO gate fires, and Authentik signs the user back in');
});

test('/auth/logout clears the session and ends the Authentik one', async () => {
  const r = await get('/auth/logout', { headers: HTML });
  assert.equal(r.status, 302);
  assert.match(r.headers.get('set-cookie') || '', /sess=;/, 'app session must be cleared');
  const loc = new URL(r.headers.get('location'));
  assert.equal(loc.pathname, '/application/o/latest/end-session/');
  const back = loc.searchParams.get('post_logout_redirect_uri');
  assert.ok(back.startsWith('http://127.0.0.1:' + APP_PORT), `scheme/host must match the request, got ${back}`);
  assert.ok(back.endsWith('?login=password'),
    'returning to the escape hatch avoids bouncing straight back into Authentik');
});
