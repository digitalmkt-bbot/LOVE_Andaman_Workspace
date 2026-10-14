// §userRename · หน้า Users & Access · แก้ username (ชื่อที่ใช้ล็อกอิน) และชื่อที่แสดงได้
//
// ที่มา (2026-10-14) · owner (screenshot Users & Access · KL.MILD): "ขอให้แก้ชื่อ User ได้หน่อย"
//   เดิมสร้างแล้วแก้ชื่อไม่ได้ · ต้องลบแล้วสร้างใหม่ สิทธิ์ที่ตั้งไว้หายหมด
//
// ⚠ เซิร์ฟเวอร์ปลอมทำตามกติกาของ /api/users/rename ใน server.js · ตรวจกับเซิร์ฟเวอร์จริง + Postgres แล้วตอนทำ
//   (เปลี่ยน username → session เดิมถูกตัด · ชื่อเดิมล็อกอินไม่ได้ · ชื่อใหม่ + รหัสเดิมได้ · ซ้ำ 409 · ช่องว่าง 400 · staff 403)
//
// กัน
//   1 หน้ารายละเอียดผู้ใช้มีปุ่ม "แก้ชื่อ" · กดแล้วเปิดกล่อง ช่องกรอกมีค่าเดิม · ปุ่มบันทึกปิดอยู่ (ยังไม่เปลี่ยน)
//   2 พิมพ์ username ซ้ำคนอื่น (ตัวพิมพ์ต่างกัน) / มีช่องว่าง / ว่าง · บันทึกไม่ได้ พร้อมเหตุผล
//   3 เปลี่ยน username + ชื่อ · มีคำเตือนว่าต้องล็อกอินใหม่ · บันทึก → ส่ง id/username/name ถูก · รายชื่อขึ้นชื่อใหม่ · ยังเลือกคนเดิมอยู่ · สิทธิ์ไม่หาย
//   4 แก้แค่ชื่อที่แสดง · ไม่มีคำเตือนล็อกอินใหม่
//   5 เซิร์ฟเวอร์ปฏิเสธ (ซ้ำที่เพิ่งมีคนสร้าง) · ขึ้นข้อความของเซิร์ฟเวอร์ · กล่องยังเปิด ไม่มีอะไรเปลี่ยน
//   6 admin เปลี่ยน username ตัวเอง · ขึ้นข้อความแล้วรีโหลดหน้า (session เดิมถูกตัด)
//   7 ไม่มี error · ไม่มี alert()
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT } from './_harness.mjs';

let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const USERS = [
  { id: 1, username: 'ADMIN01', name: 'Boss', role: 'admin', perms: null, canEdit: true, editAreas: null, dept: 'admin', salesId: '' },
  { id: 7, username: 'KL.MILD', name: 'MILD', role: 'staff', perms: ['booking', 'operation', '*explicit'], canEdit: true, editAreas: ['operations'], dept: 'pier', salesId: '' },
  { id: 8, username: 'RSVN01', name: 'Earn', role: 'staff', perms: ['booking', '*explicit'], canEdit: true, editAreas: ['sales'], dept: 'rsvn', salesId: '' },
];
const S = { version: 1, data: fs.readFileSync(process.env.LAD, 'utf8'), posts: [], me: { username: 'ADMIN01', name: 'Boss', role: 'admin', canEdit: true, perms: null, editAreas: null, salesId: null }, loads: 0 };
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const J = (c, o) => { res.writeHead(c, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)); };
  if (u === '/api/me') return J(200, S.me);
  if (u === '/api/version') return J(200, { version: S.version });
  if (u === '/api/load') { S.loads++; return J(200, { version: S.version, data: S.data }); }
  if (u === '/api/users' && req.method === 'GET') return J(200, { users: USERS });
  if (u === '/api/users/rename' && req.method === 'POST') { let b = ''; req.on('data', c => b += c);
    return req.on('end', () => { let j = {}; try { j = JSON.parse(b); } catch (e) {} S.posts.push(j);
      const id = parseInt(j.id, 10), un = String(j.username || '').trim(), nm = String(j.name || '').trim();
      const t = USERS.find(x => x.id === id); if (!t) return J(404, { error: 'ไม่พบผู้ใช้นี้' });
      if (!un) return J(400, { error: 'ต้องมี username' });
      if (/\s/.test(un) || un.length > 60) return J(400, { error: 'username ห้ามมีช่องว่าง และยาวไม่เกิน 60 ตัวอักษร' });
      if (USERS.some(x => x.id !== id && x.username.toLowerCase() === un.toLowerCase())) return J(409, { error: 'username นี้มีอยู่แล้ว' });
      const renamed = t.username.toLowerCase() !== un.toLowerCase(), self = t.username === S.me.username;
      t.username = un; t.name = nm || un; J(200, { ok: true, username: un, name: t.name, renamed, self }); }); }
  if (u === '/api/events') { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }); res.write('retry: 1000\n\n'); return; }
  if (u === '/api/save' || u === '/api/v1/_batch') { let b = ''; req.on('data', c => b += c); return req.on('end', () => J(200, { ok: true, version: ++S.version })); }
  if (u.startsWith('/api/')) return J(200, {});
  const f = path.join(ROOT, decodeURIComponent(u).replace(/^\/+/, '') || 'allotment_v2.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const port = await new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1000 } });
const page = await ctx.newPage(); const errs = [], dlg = [];
page.on('pageerror', e => errs.push(String(e && e.message || e).slice(0, 160)));
page.on('dialog', async d => { dlg.push(d.message()); try { await d.accept(); } catch (_) {} });
await ctx.route('**/*', r => r.request().url().startsWith(`http://127.0.0.1:${port}/`) ? r.continue() : r.abort());
await page.goto(`http://127.0.0.1:${port}/allotment_v2.html`, { waitUntil: 'commit', timeout: 60000 });
await page.waitForFunction(() => typeof window.nav === 'function' && typeof window.__laUsers === 'function', null, { timeout: 25000 });
await page.waitForTimeout(3000);
await page.evaluate(() => __laUsers()); await page.waitForTimeout(900);
await page.evaluate(() => __laPick(7)); await page.waitForTimeout(300);

const box = () => page.evaluate(() => { const m = document.getElementById('la-rmask'); if (!m) return null;
  return { u: m.querySelector('#la-r1').value, n: m.querySelector('#la-r2').value, go: !m.querySelector('#la-rgo').disabled, msg: m.querySelector('#la-rmsg').textContent.trim(), toast: (document.querySelector('#la-uwin .tst') || {}).textContent || '' }; });
const type = async (sel, v) => { await page.fill(sel, v); await page.waitForTimeout(60); };

// 1
const btn = await page.evaluate(() => { const b = [...document.querySelectorAll('#la-uwin button')].find(x => /แก้ชื่อ/.test(x.textContent) && /__laRename\(7\)/.test(x.getAttribute('onclick') || '')); return b ? b.getBoundingClientRect().height > 10 : false; });
await page.evaluate(() => [...document.querySelectorAll('#la-uwin button')].find(x => /__laRename\(7\)/.test(x.getAttribute('onclick') || '')).click()); await page.waitForTimeout(250);
let b1 = await box();
if (btn && b1 && b1.u === 'KL.MILD' && b1.n === 'MILD' && !b1.go) ok(`1 ปุ่มแก้ชื่อ · กล่องมีค่าเดิม ${b1.u} / ${b1.n} · ยังไม่เปลี่ยน บันทึกไม่ได้`); else fail('1 ' + JSON.stringify({ btn, b1 }));
// 2
await type('#la-r1', 'rsvn01'); const d1 = await box();
await type('#la-r1', 'Pier Mild'); const d2 = await box();
await type('#la-r1', ''); const d3 = await box();
if (!d1.go && /มีคนใช้อยู่แล้ว/.test(d1.msg) && !d2.go && /ช่องว่าง/.test(d2.msg) && !d3.go && /ต้องมี username/.test(d3.msg) && !S.posts.length) ok('2 ซ้ำ (rsvn01) / มีช่องว่าง / ว่าง · บันทึกไม่ได้ พร้อมเหตุผล');
else fail('2 ' + JSON.stringify({ d1, d2, d3 }));
// 3
await type('#la-r1', 'Pier.Mild'); await type('#la-r2', 'Mild K.'); const d4 = await box();
await page.click('#la-rgo'); await page.waitForTimeout(400);
const after = await page.evaluate(() => { const on = document.querySelector('#la-uwin .ur.on');
  return { open: !!document.getElementById('la-rmask'), sel: on ? (on.getAttribute('onclick') || '') : '', row: on ? on.textContent.replace(/\s+/g, ' ') : '',
    head: (document.querySelector('#la-uwin .dh3 .u3 b') || {}).textContent || '', toast: (document.querySelector('#la-uwin .tst') || {}).textContent || '' }; });
const p3 = S.posts[S.posts.length - 1] || {};
if (d4.go && /เข้าสู่ระบบใหม่/.test(d4.msg) && /Pier\.Mild/.test(d4.msg) && p3.id === 7 && p3.username === 'Pier.Mild' && p3.name === 'Mild K.' && !after.open && /__laPick\(7\)/.test(after.sel) && /Pier\.Mild Mild K\./.test(after.row) && /แก้ได้ 1 พื้นที่/.test(after.row) && after.head === 'Pier.Mild' && /Pier\.Mild/.test(after.toast))
  ok(`3 เปลี่ยน KL.MILD → Pier.Mild (Mild K.) · มีคำเตือนล็อกอินใหม่ · รายชื่อ/หัวการ์ดขึ้นชื่อใหม่ · สิทธิ์ยังอยู่`);
else fail('3 ' + JSON.stringify({ d4, p3, after }));
// 4
await page.evaluate(() => __laRename(7)); await page.waitForTimeout(200);
await type('#la-r2', 'Mild'); const d5 = await box();
if (d5.go && !/เข้าสู่ระบบใหม่/.test(d5.msg)) ok('4 แก้แค่ชื่อที่แสดง · ไม่มีคำเตือนล็อกอินใหม่'); else fail('4 ' + JSON.stringify(d5));
// 5
USERS.push({ id: 9, username: 'Pier.New', name: 'n', role: 'staff', perms: [], canEdit: false, editAreas: [], dept: 'pier', salesId: '' });
await type('#la-r1', 'Pier.New'); await page.click('#la-rgo'); await page.waitForTimeout(300); const d6 = await box();
const row7 = await page.evaluate(() => (document.querySelector('#la-uwin .dh3 .u3 b') || {}).textContent || '');
if (d6 && /มีอยู่แล้ว/.test(d6.toast) && row7 === 'Pier.Mild' && USERS.find(x => x.id === 7).username === 'Pier.Mild') ok('5 เซิร์ฟเวอร์ปฏิเสธ (ซ้ำ) · ขึ้นข้อความ · กล่องยังเปิด · ไม่มีอะไรเปลี่ยน'); else fail('5 ' + JSON.stringify({ d6, row7 }));
await page.evaluate(() => { const m = document.getElementById('la-rmask'); if (m) m.remove(); });
// 6
const loads0 = S.loads;
await page.evaluate(() => { __laPick(1); __laRename(1); }); await page.waitForTimeout(200);
await type('#la-r1', 'ADMIN.Boss'); const d7 = await box();
await page.click('#la-rgo'); await page.waitForTimeout(400);
const t6 = await page.evaluate(() => (document.querySelector('#la-uwin .tst') || {}).textContent || '');
S.me = { username: 'ADMIN.Boss', name: 'Boss', role: 'admin', canEdit: true, perms: null, editAreas: null, salesId: null };
await page.waitForTimeout(2500);
if (/คุณ/.test(d7.msg) && /เข้าสู่ระบบใหม่/.test(t6) && S.loads > loads0) ok('6 admin เปลี่ยน username ตัวเอง · ขึ้นข้อความ แล้วรีโหลดหน้า'); else fail('6 ' + JSON.stringify({ d7, t6, loads0, loads: S.loads }));
// 7
if (!errs.length && !dlg.length) ok('7 ไม่มี error · ไม่มี alert()'); else fail('7 ' + JSON.stringify({ errs, dlg }));
await browser.close(); srv.close();
console.log(bad ? `FAIL ${bad}` : 'PASS'); process.exit(bad ? 1 : 0);
