// Boots the real server.js (the actual write path — not a mock) as a child process against
// whatever DATABASE_URL/DATA_BACKEND the caller sets, and gives back a small HTTP client bound to
// a session cookie once logged in. Uses Node's built-in `fetch` (stable since Node 18) — no test
// HTTP client dependency needed.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

/**
 * @param {object} opts
 * @param {number} [opts.port]
 * @param {Record<string,string>} [opts.env] - merged over process.env; must include DATABASE_URL
 *   and DATA_BACKEND for a relational-mode boot.
 * @param {number} [opts.timeoutMs] - how long to wait for the HTTP listener to come up.
 */
export async function startServer({ port = 8791, env = {}, timeoutMs = 15000 } = {}) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: REPO_ROOT,
    env: { ...process.env, PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logLines = [];
  child.stdout.on('data', (d) => logLines.push(String(d)));
  child.stderr.on('data', (d) => logLines.push(String(d)));

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + timeoutMs;
  let up = false;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error('server.js exited early (code ' + child.exitCode + ')\n' + logLines.join(''));
    }
    try {
      const r = await fetch(baseUrl + '/api/version');
      if (r.status) { up = true; break; }
    } catch (_) {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!up) {
    child.kill();
    throw new Error('server.js did not become ready within ' + timeoutMs + 'ms\n' + logLines.join(''));
  }

  return {
    baseUrl,
    logLines,
    async stop() {
      child.kill();
      const stopDeadline = Date.now() + 5000;
      while (child.exitCode === null && Date.now() < stopDeadline) {
        await new Promise((r) => setTimeout(r, 100));
      }
    },
  };
}

/** Log in and return a fetch-alike bound to the resulting session cookie. Throws with the
 *  response body on a non-2xx so a schema-missing 401/500 fails loudly and specifically rather
 *  than silently returning an unauthenticated client. */
export async function loginClient(baseUrl, username, password) {
  const res = await fetch(baseUrl + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('login failed: ' + res.status + ' ' + JSON.stringify(body));
  const setCookie = res.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0]; // "sess=<token>"
  if (!cookie) throw new Error('login succeeded but no session cookie was set');

  return {
    cookie,
    async request(pathname, { method = 'GET', body: reqBody } = {}) {
      const r = await fetch(baseUrl + pathname, {
        method,
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: reqBody !== undefined ? JSON.stringify(reqBody) : undefined,
      });
      const text = await r.text();
      let json;
      try { json = JSON.parse(text); } catch (_) { json = text; }
      return { status: r.status, ok: r.ok, body: json };
    },
  };
}
