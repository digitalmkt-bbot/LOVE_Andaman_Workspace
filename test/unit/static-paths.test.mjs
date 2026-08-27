// Regression proof for §rootRedirect (2026-08-27).
//
// The bug: server.js used to SERVE allotment_v2.html in response to "/" while leaving the browser's
// document URL at "/". Every relative reference in the page then resolved one directory too high.
// It was already breaking the app's own images (`assets/hero/<routeId>.jpg` and `assets/logo.png`
// are built relatively in js/08-app.js), and once the CSS and JS were extracted out of the HTML it
// took the whole page down: href="css/01-base.css" was requested as /css/01-base.css.
//
// What this pins down is the invariant, not the symptom: whatever URL the app is reached at, every
// relative src/href in it must resolve to something that exists. Add a stylesheet, rename a bundle,
// or make "/" serve the file again and this fails.
//
// No database needed — these are static routes. Run: node --test test/unit/static-paths.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP_PATH = '/allotment_v2/allotment_v2.html';
const PORT = 8798;
const BASE = `http://127.0.0.1:${PORT}`;

let child;
test.before(async () => {
  child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    let log = '';
    const t = setTimeout(() => reject(new Error('server did not start:\n' + log)), 60_000);
    const on = (d) => { log += d; if (log.includes('LOVE Andaman on')) { clearTimeout(t); resolve(); } };
    child.stdout.on('data', on); child.stderr.on('data', on);
  });
});
test.after(() => child?.kill());

test('"/" redirects to the app rather than serving it at the wrong depth', async () => {
  const r = await fetch(BASE + '/', { redirect: 'manual' });
  assert.equal(r.status, 302, 'serving the file at "/" is exactly the bug this guards');
  assert.equal(r.headers.get('location'), APP_PATH);
});

test('the redirect keeps the query string', async () => {
  const r = await fetch(BASE + '/?view=booking', { redirect: 'manual' });
  assert.equal(r.headers.get('location'), APP_PATH + '?view=booking');
});

test('every relative src/href in the app resolves from the served document URL', async () => {
  const r = await fetch(BASE + '/');            // follow it exactly as a browser would
  assert.equal(r.status, 200);
  assert.ok(r.url.endsWith(APP_PATH), `document settled at ${r.url}`);

  const html = await r.text();
  const refs = [...new Set([...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((h) => !/^(https?:|data:|mailto:|#|\/)/.test(h)))];
  assert.ok(refs.length >= 10, `expected the extracted css/js links, found ${refs.length}`);

  for (const ref of refs) {
    const res = await fetch(new URL(ref, r.url).toString());
    assert.equal(res.status, 200, `${ref} -> ${new URL(ref, r.url).pathname} is ${res.status}`);
  }
});

test('the images js/08-app.js builds relatively resolve too', async () => {
  // Not referenced from the HTML, so the sweep above cannot see them — and they are what proved the
  // app was already mis-served at "/" before the CSS/JS split existed.
  for (const ref of ['assets/logo.png', 'assets/hero/r5.jpg']) {
    const res = await fetch(new URL(ref, BASE + APP_PATH).toString());
    assert.equal(res.status, 200, `${ref} is ${res.status}`);
  }
});

test('the extracted bundles are served with the right content type', async () => {
  const css = await fetch(`${BASE}/allotment_v2/css/01-base.css`);
  assert.match(css.headers.get('content-type'), /text\/css/);
  const js = await fetch(`${BASE}/allotment_v2/js/08-app.js`);
  assert.match(js.headers.get('content-type'), /javascript/);
});
