// §actPerm · ปลด cap เรือได้เฉพาะคนที่ admin ให้สิทธิ์พิเศษ
//
// ที่มา (2026-10-03) · ต่อจาก §baCapGate · ผู้ใช้ถาม "ปลดได้เฉพาะ Role ที่เรา Assign ได้ไหม"
//   ระบบสิทธิ์เดิมมีแค่ "หน้าที่เปิดได้" กับ "พื้นที่ที่แก้ได้" · ใครแก้ Operations ได้ก็ปลด cap ได้หมด
//   เพิ่มสิทธิ์พิเศษรายการกระทำ act-capunlock · เก็บในช่อง perms เดิม · admin ติ๊กให้รายคนในหน้าจัดการผู้ใช้
//
// ⚠ เซิร์ฟเวอร์ปลอมกรองคีย์ด้วยกติกาที่อ่านจาก server.js จริง (เหมือน t_perm) · ลืม PERM_KEYS.add แล้วเทสนี้พัง
//
// กันแปดอย่าง
//   1 พนักงานที่แก้ Operations ได้ แต่ไม่มีสิทธิ์พิเศษ · เรือเต็มแล้วใส่เพิ่มไม่ได้ · ไม่ถูกถามให้ปลด · ข้อความบอกว่าต้องมีสิทธิ์
//   2 คนเดียวกันเปิดหน้าปรับ cap เองแล้วเพิ่มเกินปกติ · บันทึกไม่ได้ · ลด cap ยังทำได้
//   3 เรียกตัวตั้งค่าตรง ๆ ก็เพิ่มไม่ได้ (กันชั้นใน)
//   4 พนักงานที่มีสิทธิ์พิเศษ · ถูกถาม · ปลดได้ · ใบจองลงเรือ
//   5 หน้าจัดการผู้ใช้ · มีหมวด "สิทธิ์พิเศษ" · ติ๊กให้แล้วบันทึก · คีย์ถูกส่งและรอดตัวกรองของเซิร์ฟเวอร์จริง
//   6 เปิดกล่องใหม่ยังติ๊กอยู่ · กด "ทุกพื้นที่" ไม่ติ๊กสิทธิ์พิเศษให้เอง
//   7 บันทึกจากตารางสิทธิ์ (แก้พื้นที่อื่น) · สิทธิ์พิเศษไม่หาย
//   8 ไม่มี error บนหน้า
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT } from './_harness.mjs';

const REPO = path.resolve(ROOT, '..');
let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

function realPermKeys(){
  const src = fs.readFileSync(path.join(REPO, 'server.js'), 'utf8');
  const m = src.match(/const PERM_KEYS\s*=\s*new Set\(\[([\s\S]*?)\]\)\s*;/); if (!m) return null;
  const keys = new Set([...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]));
  const cli = fs.readFileSync(path.join(ROOT, 'js', '01-auth-sync.js'), 'utf8').slice(0, 400000);
  [...cli.matchAll(/\{\s*v\s*:\s*'([a-z0-9_-]+)'\s*,\s*t\s*:[^}]*?a\s*:\s*'([a-z0-9_-]+)'\s*\}/gi)].forEach(x => keys.add(x[1]));
  if (/PERM_KEYS\.add\(\s*LA_PERM_EXPLICIT\s*\)/.test(src)) keys.add('*explicit');
  [...src.matchAll(/PERM_KEYS\.add\(\s*'([^']+)'\s*\)/g)].forEach(x => keys.add(x[1]));
  return keys;
}
const KEYS = realPermKeys();
if (!KEYS) { console.log('  ! cannot read PERM_KEYS from server.js'); process.exit(1); }
const cleanPerms = a => Array.isArray(a) ? a.filter(x => KEYS.has(x)) : null;

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8' };
const OPS = ['booking', 'operation', 'fleetcal', '*explicit'];
const USERS = [
  { id: 1, username: 'ADMIN01', name: 'Boss', role: 'admin', perms: null, canEdit: true, editAreas: null, dept: 'admin', salesId: '' },
  { id: 2, username: 'Ops.A', name: 'A', role: 'staff', perms: OPS.slice(), canEdit: true, editAreas: ['operations'], dept: 'rsvn', salesId: '' },
];
const S = { version: 1, data: fs.readFileSync(process.env.LAD, 'utf8'), sse: new Set(), posts: [], me: null };
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const J = (c, o) => { res.writeHead(c, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)); };
  if (u === '/api/me') return J(200, S.me);
  if (u === '/api/version') return J(200, { version: S.version });
  if (u === '/api/load') return J(200, { version: S.version, data: S.data });
  if (u === '/api/users' && req.method === 'GET') return J(200, { users: USERS });
  if (u === '/api/users/perms' && req.method === 'POST') { let b = ''; req.on('data', c => b += c);
    return req.on('end', () => { let j = {}; try { j = JSON.parse(b); } catch (e) {} S.posts.push(JSON.parse(JSON.stringify(j)));
      const t = USERS.find(x => x.id === parseInt(j.id, 10)); if (t) { t.perms = cleanPerms(j.perms); t.editAreas = Array.isArray(j.editAreas) ? j.editAreas : null; } J(200, { ok: true }); }); }
  if (u === '/api/events') { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'connection': 'keep-alive' }); res.write('retry: 1000\n\n'); S.sse.add(res); req.on('close', () => S.sse.delete(res)); return; }
  if (u === '/api/save' || u === '/api/v1/_batch') { let b = ''; req.on('data', c => b += c); return req.on('end', () => J(200, { ok: true, version: ++S.version })); }
  if (u.startsWith('/api/')) return J(200, {});
  const f = path.join(ROOT, decodeURIComponent(u).replace(/^\/+/, '') || 'allotment_v2.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const port = await new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const browser = await chromium.launch();
const allErr = [];

async function session(me){
  S.me = me;
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await ctx.newPage(); const dlg = [];
  page.on('pageerror', e => allErr.push(String(e && e.message || e).slice(0, 160)));
  page.on('dialog', async d => { dlg.push({ type: d.type(), msg: d.message() }); try { await d.accept(); } catch (_) {} });
  await ctx.route('**/*', r => r.request().url().startsWith(`http://127.0.0.1:${port}/`) ? r.continue() : r.abort());
  await page.goto(`http://127.0.0.1:${port}/allotment_v2.html`, { waitUntil: 'commit', timeout: 60000 });
  await page.waitForFunction(() => typeof window.nav === 'function' && typeof window.bkV2AssignBoat === 'function' && document.querySelectorAll('.nav-item[data-view]').length > 0, null, { timeout: 25000 });
  await page.waitForTimeout(3500);
  return { page, dlg, close: () => ctx.close() };
}
/* เรือเต็มที่ cap+2 พอดี · มีใบหนึ่งค้างยังไม่ได้ลงเรือ */
const setup = page => page.evaluate(() => {
  const per = {}; (SB_BOOKINGS || []).forEach(b => { if (['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)) return; (b.trips || []).forEach(t => { if (t && t.date) per[t.date] = (per[t.date] || 0) + 1; }); });
  const day = Object.keys(per).sort((a, b) => per[b] - per[a])[0];
  const on = {}; SB_BOOKINGS.forEach(b => { if (['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)) return; const o = bkOpsRead(b, day);
    if (!o || !o.boatId || o.boatSplits) return; if ((b.trips || []).some(t => t.date === day && t.bookingMode === 'charter')) return; if (!(b.trips || []).some(t => t.date === day)) return; (on[o.boatId] = on[o.boatId] || []).push(b); });
  const boatId = Object.keys(on).filter(k => !baCharterBoatIds(day).has(k)).sort((a, b) => on[b].length - on[a].length)[0];
  const x = on[boatId][0], p = (x.trips || []).filter(t => t.date === day).reduce((s, t) => s + bkV2PaxAllTot(t.pax || {}), 0);
  bkOpsFor(x, day).boatId = null; const L = baAssignedPax(day, boatId), bo = getBoat(boatId);
  bo.cap = L - 2; bo.licensePax = L + p + 6; delete BOAT_CAP_OVR[day + '::' + boatId];
  window.__S = { day, boatId, bk: x.id, cap: bo.cap, want: L + p };
  return { ...window.__S, name: bo.name, canAct: laCanAct('act-capunlock'), canEdit: laCanEditArea('operations') };
});
const st = page => page.evaluate(() => { const s = __S, b = SB_BOOKINGS.find(x => x.id === s.bk);
  return { boat: bkOpsRead(b, s.day).boatId || '', modal: !!document.getElementById('bcap-ov'), cap: boatCapFor(s.boatId, s.day), ovr: !!BOAT_CAP_OVR[s.day + '::' + s.boatId] }; });

/* ══ 1–3 · ไม่มีสิทธิ์พิเศษ ══ */
{
  const { page, dlg, close } = await session({ username: 'Ops.A', name: 'A', role: 'staff', canEdit: true, perms: OPS.slice(), editAreas: ['operations'], salesId: null });
  const P = await setup(page);
  dlg.length = 0; await page.evaluate(() => bkV2AssignBoat(__S.bk, __S.boatId, __S.day)); await page.waitForTimeout(250);
  const a = await st(page), m = dlg[0] || { msg: '' };
  if (P.canEdit && !P.canAct && dlg.length === 1 && m.type === 'alert' && /special permission/.test(m.msg) && !/[^\x00-\x7F]/.test(m.msg) && !a.boat && !a.modal && !a.ovr)
    ok(`1 แก้ Operations ได้แต่ไม่มีสิทธิ์พิเศษ · ${P.name} เต็ม ใส่เพิ่มไม่ได้ · ไม่ถูกถามให้ปลด · ข้อความบอกว่าต้องมีสิทธิ์`);
  else fail('1 ' + JSON.stringify({ P, dlg, a }));
  /* เปิดหน้าปรับ cap เอง */
  dlg.length = 0;
  const b = await page.evaluate(async () => { const s = __S; boatCapModalOpen(s.boatId, s.day); await new Promise(z => setTimeout(z, 150));
    document.getElementById('bcap-val').value = s.want; document.getElementById('bcap-reason').value = 'try'; _bcapSave(s.boatId, s.day); await new Promise(z => setTimeout(z, 150));
    const up = boatCapFor(s.boatId, s.day), stayed = !!document.getElementById('bcap-ov');
    if (!stayed) { boatCapModalOpen(s.boatId, s.day); await new Promise(z => setTimeout(z, 150)); }
    document.getElementById('bcap-val').value = s.cap - 3; document.getElementById('bcap-reason').value = 'engine'; _bcapSave(s.boatId, s.day); await new Promise(z => setTimeout(z, 150));
    return { up, stayed, down: boatCapFor(s.boatId, s.day), modal: !!document.getElementById('bcap-ov') }; });
  if (b.up === P.cap && b.stayed && dlg.length === 1 && /special permission/.test(dlg[0].msg) && b.down === P.cap - 3 && !b.modal) ok(`2 เปิดหน้าปรับ cap เอง · เพิ่มเป็น ${P.want} ไม่ได้ (ยัง ${b.up}) · ลดเป็น ${b.down} ได้`);
  else fail('2 ' + JSON.stringify({ b, dlg }));
  const c = await page.evaluate(() => { const s = __S; delete BOAT_CAP_OVR[s.day + '::' + s.boatId]; boatCapSet(s.boatId, s.day, s.want, 'direct'); return boatCapFor(s.boatId, s.day); });
  if (c === P.cap) ok('3 เรียกตัวตั้งค่าตรง ๆ ก็เพิ่มไม่ได้'); else fail('3 cap ' + c + ' want ' + P.cap);
  await close();
}
/* ══ 4 · มีสิทธิ์พิเศษ ══ */
{
  const { page, dlg, close } = await session({ username: 'Ops.B', name: 'B', role: 'staff', canEdit: true, perms: OPS.concat(['act-capunlock']), editAreas: ['operations'], salesId: null });
  const P = await setup(page);
  dlg.length = 0; await page.evaluate(() => bkV2AssignBoat(__S.bk, __S.boatId, __S.day)); await page.waitForTimeout(300);
  const a = await st(page);
  await page.evaluate(() => { document.getElementById('bcap-reason').value = 'emergency'; _bcapSave(__S.boatId, __S.day); }); await page.waitForTimeout(400);
  const b = await st(page);
  if (P.canAct && dlg.length === 1 && dlg[0].type === 'confirm' && /EMERGENCY ONLY/.test(dlg[0].msg) && a.modal && b.cap === P.want && b.boat === P.boatId) ok(`4 มีสิทธิ์พิเศษ · ถูกถาม · ปลด cap ${P.cap} → ${b.cap} · ใบจองลงเรือ`);
  else fail('4 ' + JSON.stringify({ P, dlg, a, b }));
  await close();
}
/* ══ 5–7 · หน้าจัดการผู้ใช้ ══ */
{
  const { page, close } = await session({ username: 'ADMIN01', name: 'Boss', role: 'admin', canEdit: true, perms: null, editAreas: null, salesId: null });
  await page.evaluate(() => __laUsers()); await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector('#la-uwin [onclick="__laEditPerms(2)"]').click()); await page.waitForTimeout(500);
  const chip = () => page.evaluate(() => { const c = document.querySelector('#la-pmask [data-act="act-capunlock"]'); return c ? { on: /\bon\b/.test(c.className), vis: c.getBoundingClientRect().height > 8, txt: c.textContent, head: (document.querySelector('#la-pmask [data-acts] .nm b') || {}).textContent || '' } : null; });
  const c0 = await chip();
  await page.evaluate(() => document.querySelector('#la-pmask [data-act="act-capunlock"]').click()); await page.waitForTimeout(250);
  const c1 = await chip();
  if (process.env.SHOT) { const el = await page.$('#la-pmask .dlg'); if (el) await el.screenshot({ path: process.env.SHOT }); }
  await page.evaluate(() => document.querySelector('#la-pmask [onclick^="__laSavePerms"]').click()); await page.waitForTimeout(1200);
  const sent = S.posts[S.posts.length - 1] || {}, kept = USERS[1].perms || [];
  if (c0 && c0.vis && !c0.on && c1.on && (sent.perms || []).includes('act-capunlock') && kept.includes('act-capunlock') && kept.includes('*explicit') && kept.includes('booking'))
    ok(`5 หมวด "${c0.head}" · ติ๊ก "${c0.txt}" แล้วบันทึก · คีย์รอดตัวกรองของเซิร์ฟเวอร์จริง`);
  else fail('5 ' + JSON.stringify({ c0, c1, sent: sent.perms, kept }));
  await page.evaluate(() => document.querySelector('#la-uwin [onclick="__laEditPerms(2)"]').click()); await page.waitForTimeout(500);
  const c2 = await chip();
  /* ผู้ใช้อีกคนที่ยังไม่มี · กด "ทุกพื้นที่" */
  USERS.push({ id: 3, username: 'Ops.C', name: 'C', role: 'staff', perms: ['booking', '*explicit'], canEdit: true, editAreas: ['operations'], dept: 'rsvn', salesId: '' });
  await page.evaluate(() => { const m = document.getElementById('la-pmask'); if (m) m.remove(); __laLoadUsers(); }); await page.waitForTimeout(900);
  const has3 = await page.evaluate(() => { const b = document.querySelector('#la-uwin [onclick="__laEditPerms(3)"]'); if (b) b.click(); return !!b || [...document.querySelectorAll('#la-uwin [onclick^="__laEditPerms"]')].map(x => x.getAttribute('onclick')).join(','); }); await page.waitForTimeout(400);
  if (has3 !== true) fail('6 setup · no edit button for user 3 · ' + has3);
  await page.evaluate(() => __laPreset('p', 'ALL')); await page.waitForTimeout(250);
  const c3 = await chip();
  const pfxOk = await page.evaluate(() => !!document.getElementById('p-ar-acts'));
  if (c2 && c2.on && pfxOk && c3 && !c3.on) ok('6 เปิดกล่องใหม่ยังติ๊กอยู่ · กด "ทุกพื้นที่" ให้อีกคน ไม่ติ๊กสิทธิ์พิเศษให้เอง');
  else fail('6 ' + JSON.stringify({ c2, c3, pfxOk }));
  await page.evaluate(() => { const m = document.getElementById('la-pmask'); if (m) m.remove(); });
  /* ตารางสิทธิ์ · แก้พื้นที่อื่นของ Ops.A แล้วบันทึก */
  const n0 = S.posts.length;
  const mx = await page.evaluate(async () => { window.__laTab = 'matrix'; __laRender(); await new Promise(z => setTimeout(z, 300));
    const cell = [...document.querySelectorAll('#la-uwin [onclick^="__laCycle"]')].find(x => /\(2,|'2'|"2"/.test(x.getAttribute('onclick')) && /sales/.test(x.getAttribute('onclick')));
    if (!cell) return { err: 'no matrix cell · ' + [...document.querySelectorAll('#la-uwin [onclick]')].map(x => x.getAttribute('onclick').slice(0, 40)).filter((v, i, a) => a.indexOf(v) === i).slice(0, 12).join(' | ') };
    cell.click(); await new Promise(z => setTimeout(z, 200)); __laSaveMatrix(); await new Promise(z => setTimeout(z, 900)); return { ok: 1 }; });
  const p7 = S.posts.slice(n0).find(x => parseInt(x.id, 10) === 2);
  if (mx.ok && p7 && p7.perms.includes('act-capunlock') && (USERS[1].perms || []).includes('act-capunlock') && p7.perms.some(k => !OPS.includes(k) && k !== 'act-capunlock')) ok('7 บันทึกจากตารางสิทธิ์ (เพิ่มพื้นที่ Sales) · สิทธิ์พิเศษไม่หาย');
  else fail('7 ' + JSON.stringify({ mx, p7: p7 && p7.perms.slice(-6), kept: USERS[1].perms }));
  await close();
}
const e1 = allErr.filter(e => !/Failed to load resource/.test(e));
if (!e1.length) ok('8 ไม่มี error บนหน้า'); else fail('8 ' + e1.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
