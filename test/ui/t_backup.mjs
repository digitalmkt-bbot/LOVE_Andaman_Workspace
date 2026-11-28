// t_backup · topbar 💾 Backup and 📥 Import against a REAL operation-backend (in-process store) · js/ops/89-ops-backup.js
//
//   OPS_BACKEND_DIR=<operation-backend checkout with /v1/backup> node test/ui/t_backup.mjs
//
//   [1] Backup   the button shows; a click downloads GET /v1/backup as backup_YYYY-MM-DD_HHmm.json; alert "Backup OK"
//   [2] Import   a server change, then the file back: dry run → confirm lists the change → OK → the server holds the file's value
//   [3] refused  a file that is not a backup → "Import failed: <server's message>", nothing written
import { serve } from './_harness.mjs';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OPS_DIR = process.env.OPS_BACKEND_DIR || 'D:/projects/operation-backend';
const PROD = /https:\/\/operationbackend-production\.up\.railway\.app/;

const backend = spawn(process.execPath, ['--import', 'tsx', path.join(HERE, '../helpers/ops-backend-local.mjs')], { cwd: OPS_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
let backendLog = '';
const opsPort = await new Promise((ok, bad) => {
  const t = setTimeout(() => bad(new Error('backend did not start:\n' + backendLog)), 30000);
  backend.on('exit', (code) => { if (code) { clearTimeout(t); bad(new Error(`backend exited with code ${code}:\n${backendLog}`)); } });
  backend.stdout.on('data', (b) => { backendLog += b; const m = /OPS_LISTENING (\d+)/.exec(backendLog); if (m){ clearTimeout(t); ok(+m[1]); } });
  backend.stderr.on('data', (b) => { backendLog += b; });
});
const OPS = `http://127.0.0.1:${opsPort}`;
const token = (await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester', password: 'pw' }) })).json()).access_token;
const api = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(init.headers || {}) } });
  return r.status === 204 ? null : r.json();
};
const thai = async (name) => ((await api('/operations/pickup-names-th')).names.find((n) => n.name === name) || {}).name_th;
const putThai = (name, name_th) => api('/operations/pickup-names-th', { method: 'PUT', body: JSON.stringify({ name, name_th }) });

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't_backup-'));
const cleanup = () => { try { backend.kill(); } catch (_) {} try { srv.close(); } catch (_) {} try { browser.close(); } catch (_) {} };
process.on('exit', cleanup);

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);
const calls = [];
await ctx.route(PROD, async (route) => {
  const req = route.request(), u = new URL(req.url());
  calls.push(req.method() + ' ' + u.pathname + u.search);
  const hd = req.headers(), fwd = {};
  for (const k of ['authorization', 'content-type']) if (hd[k]) fwd[k] = hd[k];
  const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: fwd, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postDataBuffer() || undefined) });
  const buf = r.status === 204 ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
  const headers = { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Disposition' };
  if (r.headers.get('content-disposition')) headers['content-disposition'] = r.headers.get('content-disposition');
  await route.fulfill({ status: r.status, headers, body: buf });
});
const page = await ctx.newPage();
const errors = [], dialogs = [];
let answerConfirm = true;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message()); d.type() === 'confirm' ? (answerConfirm ? d.accept() : d.dismiss()) : d.accept(); });

const fails = [];
const ok = (name, cond, got) => { console.log((cond ? '  ✓ ' : '  ✖ ') + name + (cond ? '' : '  → ' + (JSON.stringify(got) || '').slice(0, 600))); if (!cond) fails.push(name); };
const waitFor = async (fn, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await page.waitForTimeout(200); } return false; };
// the topbar tools sit behind its ⋯ toggle: open them after every load
const boot = async () => {
  await page.waitForFunction(() => window.laOps && window.laOps.state.loaded, null, { timeout: 30000 }); await page.waitForTimeout(800);
  if (!(await page.locator('[onclick="flBackupData()"]').isVisible())) await page.locator('.topbar-toggle').click();
};
// 📥 Import → the file picker. A toast in the top-right corner sits over the topbar buttons: wait for it to go first.
const pickFile = async () => {
  await page.mouse.move(600, 600);   // a toast under the pointer stays (laSaveToast pauses on mouseenter)
  await waitFor(() => page.evaluate(() => ![...document.querySelectorAll('.la-st')].some((t) => t.getBoundingClientRect().height > 0 && getComputedStyle(t).opacity !== '0')), 20000);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 15000 }), page.locator('[onclick="flImportData()"]').click()]);
  return chooser;
};

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await boot();

console.log('\n[1] Backup');
await putThai('BK Sea View', 'ซีวิว');
const btn = page.locator('[onclick="flBackupData()"]');
ok('the Backup button shows', await btn.isVisible(), null);
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), btn.click()]);
const file = path.join(tmp, dl.suggestedFilename());
await dl.saveAs(file);
ok('file named backup_YYYY-MM-DD_HHmm.json', /^backup_\d{4}-\d{2}-\d{2}_\d{4}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
const b = JSON.parse(fs.readFileSync(file, 'utf8'));
ok('it is the server\'s backup, holding the Thai pickup name', b.format === 'operation-backend-backup' && JSON.stringify(b.tables).includes('ซีวิว'), { format: b.format });
ok('asked GET /v1/backup', calls.includes('GET /v1/backup'), calls.filter((c) => c.includes('backup')));
await waitFor(() => dialogs.some((d) => d.startsWith('alert: Backup OK: ' + dl.suggestedFilename())));
ok('alert "Backup OK: <file>"', dialogs.some((d) => d.startsWith('alert: Backup OK: ' + dl.suggestedFilename())), dialogs);

console.log('\n[2] Import');
await putThai('BK Sea View', 'เปลี่ยนแล้ว');
dialogs.length = 0; calls.length = 0;
answerConfirm = false;   // first: Cancel at the confirm → nothing written
let fc = await pickFile();
await fc.setFiles(file);
await waitFor(() => dialogs.some((d) => d.startsWith('confirm:')));
const conf = dialogs.find((d) => d.startsWith('confirm:')) || '';
ok('confirm names the file and the rows it changes', conf.includes(dl.suggestedFilename()) && /แก้ [1-9]/.test(conf), conf);
ok('only a dry run went out', calls.join() === 'POST /v1/backup/restore?dry_run=1', calls);
await page.waitForTimeout(500);
ok('Cancel writes nothing', (await thai('BK Sea View')) === 'เปลี่ยนแล้ว', await thai('BK Sea View'));

answerConfirm = true; dialogs.length = 0; calls.length = 0;
fc = await pickFile();
const reloaded = page.waitForEvent('load', { timeout: 30000 });
await fc.setFiles(file);
await reloaded;
ok('dry run, then the restore', calls.slice(0, 2).join() === 'POST /v1/backup/restore?dry_run=1,POST /v1/backup/restore', calls);
ok('alert "Import OK ✓" then reload', dialogs.some((d) => d.startsWith('alert: Import OK ✓')), dialogs);
ok('the server holds the file\'s value again', (await thai('BK Sea View')) === 'ซีวิว', await thai('BK Sea View'));
await boot();

console.log('\n[3] refused');
const bad = path.join(tmp, 'not_a_backup.json');
fs.writeFileSync(bad, JSON.stringify({ sb_bookings: [] }));
dialogs.length = 0; calls.length = 0;
fc = await pickFile();
await fc.setFiles(bad);
await waitFor(() => dialogs.some((d) => d.startsWith('alert: Import failed:')));
ok('alert "Import failed: <server message>"', dialogs.some((d) => d.startsWith('alert: Import failed:') && !/HTTP 4\d\d/.test(d)), dialogs);
ok('no restore without dry_run went out', !calls.includes('POST /v1/backup/restore'), calls);

ok('no page errors', errors.length === 0, errors);
console.log(fails.length ? `\n✖ ${fails.length} failed` : '\n✓ all passed');
cleanup();
process.exit(fails.length ? 1 : 0);
