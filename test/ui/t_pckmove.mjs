// §pckMove · Pier Check-in · ย้ายลำฉุกเฉิน · สิทธิ์ act-pckmove ที่ admin เลือกให้รายคน
//
// ที่มา (10 ต.ค. 2026) · เจ้าของ: "ในหน้า pier check in user สามารถย้ายเรือได้ไหม · กรณีต้องมีสลับฉุกเฉิน
//   · ทำเลย · สิทธิ์ให้ admin เป็นคนกำหนดเอาว่า user ไหนสามารถทำการย้ายได้"
//
// กันแปดอย่าง
//   1 ไม่มีสิทธิ์ · ไม่มีปุ่ม · เรียกตรง ๆ ก็ไม่ได้ (alert ภาษาอังกฤษ) · เรือไม่เปลี่ยน
//   2 admin ติ๊กสิทธิ์ "ย้ายลำหน้าท่า" ในหน้าจัดการผู้ใช้ · คีย์รอดตัวกรองของ server.js จริง
//   3 มีสิทธิ์ · ปุ่มอยู่ในแถบรายละเอียด · ตัวเลือกเฉพาะลำอื่นของโปรแกรมเดียวกัน · ลำที่เต็มกดไม่ได้ · เตือนอุปกรณ์ที่เบิกไปแล้ว
//   4 ต้องเลือกลำ · ต้องเลือกเหตุผล · "อื่น ๆ" ต้องพิมพ์
//   5 ย้ายสำเร็จ · ลงประวัติ (จาก → ไป · เหตุผล · ใคร) · สถานะเช็คอินไม่เปลี่ยน · แถบรายละเอียดขึ้นลำใหม่
//   6 ใบที่แยกลงหลายลำ · ย้ายที่นี่ไม่ได้
//   7 ใบเหมาลำ · ไม่มีปุ่ม
//   8 ไม่มี error
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

const PIER = OPS.concat(['piercheckin']);
/* หาเคส · วันที่มีโปรแกรมที่มีเรือวิ่ง ≥2 ลำ · มีใบลงเรือลำหนึ่ง (ไม่แยกลำ ไม่เหมา) */
const setup = page => page.evaluate(() => {
  const dates = [...new Set((SB_BOOKINGS || []).flatMap(b => (b.trips || []).map(t => t && t.date)).filter(Boolean))].sort();
  for (const d of dates) {
    for (const b of SB_BOOKINGS) {
      if (['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)) continue;
      const t = (b.trips || []).find(x => x.date === d && x.bookingMode !== 'charter'); if (!t) continue;
      let pool = baBoatsForRoute(d, t.routeId).filter(x => !baCharterBoatIds(d).has(x.boatId)); if (!pool.length) continue;
      /* ชุดข้อมูลทดสอบมักมีลำเดียวต่อโปรแกรม · ผูกเรือว่างเพิ่มให้วิ่งโปรแกรมเดียวกันวันนั้น (เหมือนที่ Boat Operation ทำ) */
      const used = new Set(Object.keys(TRIPS[d] || {}));
      const free = (BOATS || []).filter(x => !used.has(x.id) && x.cap > 0);
      for (let i = 0; pool.length < 3 && i < free.length; i++) { TRIPS[d] = TRIPS[d] || {}; TRIPS[d][free[i].id] = { route: t.routeId, type: 'normal', booked: 0 };
        pool = baBoatsForRoute(d, t.routeId).filter(x => !baCharterBoatIds(d).has(x.boatId)); }
      if (pool.length < 2) continue;
      if (bkBoatSplits(b, d)) continue;
      const pax = bkV2PaxAllTot(t.pax || {}); if (pax < 4) continue;   /* ต้องพอให้ลำปลายทางเต็มได้ */
      bkOpsFor(b, d).boatId = pool[0].boatId;
      /* ลำปลายทาง · ที่ว่างพอ · และอีกลำทำให้เต็ม (ถ้ามี) */
      const to = pool[1].boatId, bo = getBoat(to); bo.cap = baAssignedPax(d, to) + pax + 5; bo.licensePax = bo.cap + 10;
      let full = null;
      if (pool[2]) { full = pool[2].boatId; const bf = getBoat(full); bf.cap = Math.max(1, baAssignedPax(d, full) + pax - 3); bf.licensePax = bf.cap + 1; }
      ckWrite(b, d, 'pier', { at: '07:40', by: 'tester', actualPax: pax });
      PIER_MOVES.push({ id: 'pm_t1', date: d, pier: (getBoat(pool[0].boatId) || {}).pier || 'panwa', itemId: (PIER_ITEMS[0] || {}).id, boatId: pool[0].boatId, type: 'issue', qty: 3 });
      _pckDate = d;
      window.__S = { d, bk: b.id, from: pool[0].boatId, to, full, pax, fromNm: getBoat(pool[0].boatId).name, toNm: bo.name };
      return window.__S;
    }
  }
  return { err: 'no date with 2 boats on one programme' };
});

/* ══ 1 · ไม่มีสิทธิ์ ══ */
{
  const { page, dlg, close } = await session({ username: 'Pier.A', name: 'A', role: 'staff', canEdit: true, perms: PIER.slice(), editAreas: ['operations'], salesId: null });
  const P = await setup(page);
  if (P.err) { fail('prep ' + P.err); process.exit(1); }
  dlg.length = 0;
  const r = await page.evaluate(() => { const s = __S; pckDetailOpen(s.bk); const btn = !!document.querySelector('#pck-drawer .pck-mvbtn'); pckDetailClose(); pckMoveOpen(s.bk);
    return { btn, modal: !!document.getElementById('pck-move'), can: pckMoveCan(), boat: bkOpsRead(SB_BOOKINGS.find(x => x.id === s.bk), s.d).boatId }; });
  if (!r.btn && !r.modal && !r.can && dlg.length === 1 && /No permission/.test(dlg[0].msg) && !/[^\x00-\x7F]/.test(dlg[0].msg) && r.boat === P.from)
    ok('1 ไม่มีสิทธิ์ · แถบรายละเอียดไม่มีปุ่มย้ายลำ · เรียกตรง ๆ ก็ขึ้น "No permission" · เรือไม่เปลี่ยน');
  else fail('1 ' + JSON.stringify({ r, dlg }));
  await close();
}
/* ══ 2 · admin ให้สิทธิ์ในหน้าจัดการผู้ใช้ ══ */
{
  const { page, close } = await session({ username: 'ADMIN01', name: 'Boss', role: 'admin', canEdit: true, perms: null, editAreas: null, salesId: null });
  await page.evaluate(() => __laUsers()); await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector('#la-uwin [onclick="__laEditPerms(2)"]').click()); await page.waitForTimeout(500);
  const c0 = await page.evaluate(() => { const c = document.querySelector('#la-pmask [data-act="act-pckmove"]'); return c ? { on: /\bon\b/.test(c.className), txt: c.textContent.trim() } : null; });
  if (c0) { await page.evaluate(() => document.querySelector('#la-pmask [data-act="act-pckmove"]').click()); await page.waitForTimeout(250);
    await page.evaluate(() => document.querySelector('#la-pmask [onclick^="__laSavePerms"]').click()); await page.waitForTimeout(1200); }
  const sent = S.posts[S.posts.length - 1] || {}, kept = USERS[1].perms || [];
  if (c0 && !c0.on && (sent.perms || []).includes('act-pckmove') && kept.includes('act-pckmove')) ok('2 admin ติ๊ก "' + c0.txt.slice(0, 40) + '" ให้ผู้ใช้ · คีย์รอดตัวกรองของเซิร์ฟเวอร์จริง');
  else fail('2 ' + JSON.stringify({ c0, sent: sent.perms, kept }));
  await close();
}
/* ══ 3–7 · มีสิทธิ์ ══ */
{
  const { page, dlg, close } = await session({ username: 'Pier.B', name: 'B', role: 'staff', canEdit: true, perms: PIER.concat(['act-pckmove']), editAreas: ['operations'], salesId: null });
  const P = await setup(page);
  const r3 = await page.evaluate(() => { const s = __S; pckDetailOpen(s.bk); const btn = document.querySelector('#pck-drawer .pck-mvbtn'); if (btn) btn.click();
    const m = document.getElementById('pck-move'); if (!m) return { err: 'no move dialog', btn: !!btn };
    const opts = [...m.querySelectorAll('input[name=pmvb]')].map(i => ({ id: i.value, dis: i.disabled }));
    return { btn: !!btn, opts, warn: (m.querySelector('.warnbox') || {}).textContent || '' }; });
  const fullOpt = P.full ? (r3.opts || []).find(o => o.id === P.full) : null;
  if (r3.btn && r3.opts && !r3.opts.some(o => o.id === P.from) && r3.opts.some(o => o.id === P.to && !o.dis) && (!P.full || (fullOpt && fullOpt.dis)) && /เบิกอุปกรณ์/.test(r3.warn))
    ok(`3 ปุ่มย้ายลำในแถบรายละเอียด · ตัวเลือก ${r3.opts.length} ลำ ไม่มีลำเดิม${P.full ? ' · ลำที่เต็มกดไม่ได้' : ''} · เตือนว่าลำเดิมเบิกอุปกรณ์ไปแล้ว`);
  else fail('3 ' + JSON.stringify({ r3, P }));
  const r4 = await page.evaluate(() => { const s = __S, er = () => document.getElementById('pmverr').textContent;
    const a = (pckMoveSave(s.bk), er());
    document.querySelector('#pck-move input[value="' + s.to + '"]').checked = true;
    const b = (pckMoveSave(s.bk), er());
    document.getElementById('pmvwhy').value = 'other';
    const c = (pckMoveSave(s.bk), er());
    return { a, b, c, still: bkOpsRead(SB_BOOKINGS.find(x => x.id === s.bk), s.d).boatId }; });
  if (/เลือกลำ/.test(r4.a) && /เลือกเหตุผล/.test(r4.b) && /ต้องพิมพ์/.test(r4.c) && r4.still === P.from) ok('4 ไม่เลือกลำ / ไม่เลือกเหตุผล / "อื่น ๆ" ไม่พิมพ์ · ไม่บันทึก');
  else fail('4 ' + JSON.stringify(r4));
  const r5 = await page.evaluate(() => { const s = __S; document.getElementById('pmvwhy').value = 'breakdown'; document.getElementById('pmvnote').value = 'เครื่องซ้ายดับ';
    const okk = pckMoveSave(s.bk); const b = SB_BOOKINGS.find(x => x.id === s.bk), h = (b.history || []).slice(-1)[0] || {};
    const ck = ckRead(b, s.d, 'pier') || {};
    return { okk, boat: bkOpsRead(b, s.d).boatId, h, ckAt: ck.at, actual: ck.actualPax, modal: !!document.getElementById('pck-move'),
      drawer: ((document.querySelector('#pck-drawer') || {}).textContent || '').indexOf(s.toNm) >= 0, me: laBy() }; });
  if (r5.okk && r5.boat === P.to && !r5.modal && r5.h.tag === 'Boat' && r5.h.text.indexOf(P.fromNm + ' → ' + P.toNm) > 0 && /เรือเสีย/.test(r5.h.text) && /เครื่องซ้ายดับ/.test(r5.h.text) && r5.h.by === r5.me
      && r5.ckAt === '07:40' && r5.actual === P.pax && r5.drawer)
    ok(`5 ย้าย ${P.fromNm} → ${P.toNm} · ประวัติ "${r5.h.text}" by ${r5.h.by} · สถานะเช็คอิน (07:40 · ${P.pax} คน) อยู่ครบ · แถบรายละเอียดขึ้นลำใหม่`);
  else fail('5 ' + JSON.stringify({ r5, P }));
  const r6 = await page.evaluate(() => { const s = __S; const b = SB_BOOKINGS.find(x => x.id === s.bk);
    bkOpsFor(b, s.d).boatSplits = [{ boatId: s.from, pax: 1 }, { boatId: s.to, pax: 1 }];
    const sp = !!bkBoatSplits(b, s.d); const C = pckMoveCtx(s.bk, s.d); delete bkOpsFor(b, s.d).boatSplits; return { sp, err: C.err || '' }; });
  if (r6.sp && /แยกลงหลายลำ/.test(r6.err)) ok('6 ใบที่แยกลงหลายลำ · ย้ายที่นี่ไม่ได้ ชี้ไปหน้า Booking');
  else fail('6 ' + JSON.stringify(r6));
  const r7 = await page.evaluate(() => { const s = __S; const b = SB_BOOKINGS.find(x => x.id === s.bk); const t = b.trips.find(x => x.date === s.d); const m0 = t.bookingMode; t.bookingMode = 'charter';
    pckDetailOpen(s.bk); const btn = !!document.querySelector('#pck-drawer .pck-mvbtn'); const C = pckMoveCtx(s.bk, s.d); t.bookingMode = m0; pckDetailClose(); return { btn, err: C.err || '' }; });
  if (!r7.btn && /เหมาลำ/.test(r7.err)) ok('7 ใบเหมาลำ · ไม่มีปุ่ม · ย้ายที่นี่ไม่ได้'); else fail('7 ' + JSON.stringify(r7));
  await close();
}
const e1 = allErr.filter(e => !/Failed to load resource/.test(e));
if (!e1.length) ok('8 ไม่มี error บนหน้า'); else fail('8 ' + e1.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
