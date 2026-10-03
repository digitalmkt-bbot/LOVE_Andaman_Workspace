// §btStay · หน้า By trip ไม่กระโดดเมื่อมีใบจองของคนอื่นเข้ามา · §fcOrd · Fleet Calendar เรียงโปรแกรมตาม Program Config
//
// ที่มา (2026-10-03) · ผู้ใช้
//   "Fleet Calendar การเรียง ควรเรียงลำดับเหมือนของ Program ใน Config และไปที่หน้า By trip date
//    เวลาเราเลื่อน ๆ อยู่ แล้วมี User แอดบุคกิ้งเข้า ชอบเด้ง และทำให้เราเลื่อนใหม่"
//   วัดจริงก่อนแก้ · scrollY ถูกคืนเท่าเดิม แต่แถวใหม่แทรกอยู่ข้างบน แถวที่ดูอยู่จึงเลื่อนหนีไปทั้งก้อน
//   และการคืนค่ารอบ 60ms ดึงกลับตำแหน่งเก่าทั้งที่ผู้ใช้เลื่อนต่อไปแล้ว
//
// กันเจ็ดอย่าง
//   1 ใบจองใหม่แทรกเหนือจุดที่ดูอยู่ · แถวที่ดูอยู่ยังอยู่ที่เดิมบนจอ (±2px) ทั้งทันทีและหลังนิ่ง
//   2 แถวที่ยึดไว้หายไป (ใบนั้นถูกยกเลิก) · ยึดแถวถัดไปแทน ไม่กระโดด
//   3 ผู้ใช้เลื่อนต่อระหว่างที่หน้ากำลังวาดใหม่ · ไม่ถูกดึงกลับ
//   4 ไม่มีอะไรเปลี่ยน · ตำแหน่งเลื่อนเท่าเดิมเป๊ะ
//   5 กำลังลากแถบเลื่อน/ปัดจอ (scroll) · ตัวดึงข้อมูลใหม่รอก่อน · หยุดเลื่อนแล้วจึงดึง
//   6 Fleet Calendar · แถวโปรแกรมในแต่ละท่าเรียงตามช่อง sort ของ Program Config · สลับ sort แล้วแถวสลับตาม · Charter ท้ายสุด
//   7 ไม่มี error บนหน้า
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { open, goView, ROOT } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 800 });
page.on('dialog', async d => { try { await d.accept(); } catch (_) {} });
await goView(page, 'booking', 900);

const day = await page.evaluate(async () => {
  const per = {};
  (SB_BOOKINGS || []).forEach(b => { if (['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)) return;
    (b.trips || []).forEach(t => { if (t && t.date) per[t.date] = (per[t.date] || 0) + 1; }); });
  const d = Object.keys(per).sort((a, b) => per[b] - per[a])[0];
  _bkV2.filterDate = d; _bkV2.filterRoute = null; bkV2SwitchTab('bytrip');
  await new Promise(z => setTimeout(z, 900));
  window.__rows = () => [...document.querySelectorAll('#bkv2-host tr.t2-row[data-al]')];
  /* แถวใบจองแถวแรกที่อยู่ใต้ขอบบนของจอ = แถวที่ "กำลังดูอยู่" */
  window.__see = () => { const r = __rows().find(x => x.getBoundingClientRect().top >= 0); return r ? { id: r.dataset.al, top: Math.round(r.getBoundingClientRect().top) } : null; };
  window.__topOf = id => { const r = __rows().find(x => x.dataset.al === id); return r ? Math.round(r.getBoundingClientRect().top) : null; };
  window.__settle = () => new Promise(z => setTimeout(z, 260));
  return d;
});

/* ══ 1 · ใบจองใหม่แทรกข้างบน ══ */
const r1 = await page.evaluate(async day => {
  const rows = __rows(); if (rows.length < 12) return { err: 'only ' + rows.length + ' rows' };
  const tgt = rows[Math.floor(rows.length * 0.7)];
  window.scrollTo(0, Math.round(tgt.getBoundingClientRect().top + scrollY - 200)); await __settle();
  const a = __see(), y0 = Math.round(scrollY);
  const first = rows[0].dataset.al, src = SB_BOOKINGS.find(b => b.id === first || b.voucher === first) || SB_BOOKINGS.find(b => (b.trips || []).some(t => t.date === day));
  const cp = JSON.parse(JSON.stringify(src)); cp.id = 'BK-STAY-1'; cp.voucher = 'STAY-1'; SB_BOOKINGS.unshift(cp);
  const n0 = rows.length;
  window._laRerender();
  const sync = __topOf(a.id); await __settle();
  return { a, y0, sync, late: __topOf(a.id), y1: Math.round(scrollY), added: __rows().length - n0, first, srcId: src && src.id };
}, day);
if (r1.err) { fail('1 setup · ' + r1.err); }
else if (r1.added >= 1 && r1.y1 - r1.y0 >= 20 && Math.abs(r1.sync - r1.a.top) <= 2 && Math.abs(r1.late - r1.a.top) <= 2)
  ok(`1 ใบจองใหม่แทรกข้างบน (+${r1.added} แถว · หน้ายาวขึ้น ${r1.y1 - r1.y0}px เหนือจุดที่ดู) · แถว ${r1.a.id} ยังอยู่ที่ ${r1.late}px เท่าเดิม`);
else fail('1 ' + JSON.stringify(r1));

/* ══ 2 · แถวที่ยึดไว้หายไป ══ */
const r2 = await page.evaluate(async () => {
  await __settle();
  const a = __see(), rows = __rows(), i = rows.findIndex(x => x.dataset.al === a.id);
  let nx = null; for (let k = i + 1; k < rows.length; k++) { if (rows[k].dataset.al !== a.id) { nx = rows[k]; break; } }
  if (!nx) return { err: 'no next row' };
  const nxId = nx.dataset.al, nxTop = Math.round(nx.getBoundingClientRect().top);
  if (nxTop >= innerHeight) return { err: 'next row off screen ' + nxTop };
  /* ตัดแถวบนสุดของตารางออกด้วย · ไม่งั้นแถวถัดไปขยับขึ้นแทนที่พอดี มองไม่ออกว่ายึดหรือไม่ยึด */
  const kill = [a.id, 'BK-STAY-1'];
  SB_BOOKINGS.forEach(b => { if (kill.includes(b.id)) b.status = 'cancelled'; });
  const y0 = Math.round(scrollY);
  window._laRerender(); await __settle();
  return { a, nxId, nxTop, gone: __topOf(a.id) === null, after: __topOf(nxId), dy: Math.round(scrollY) - y0 };
});
if (r2.err) fail('2 setup · ' + r2.err);
else if (r2.after !== null && Math.abs(r2.after - r2.nxTop) <= 2 && r2.dy !== 0)
  ok(`2 แถวที่ยึด (${r2.a.id}) ${r2.gone ? 'หายไป' : 'เปลี่ยนที่'} · แถวถัดไป ${r2.nxId} ยังอยู่ที่ ${r2.after}px (หน้าเลื่อนชดเชย ${r2.dy}px)`);
else fail('2 ' + JSON.stringify(r2));

/* ══ 3 · เลื่อนต่อระหว่างวาดใหม่ ══ */
const r3 = await page.evaluate(async () => {
  await __settle();
  const y0 = Math.round(scrollY);
  window._laRerender();
  const ySync = Math.round(scrollY);
  await new Promise(z => setTimeout(z, 15));
  window.scrollBy(0, 180);                           /* ผู้ใช้เลื่อนเองก่อนรอบคืนค่า 60ms */
  await __settle();
  return { y0, ySync, y1: Math.round(scrollY) };
});
if (Math.abs(r3.ySync - r3.y0) <= 2 && Math.abs(r3.y1 - (r3.ySync + 180)) <= 2) ok(`3 เลื่อนต่ออีก 180px ระหว่างวาดใหม่ · ไม่ถูกดึงกลับ (${r3.y0} → ${r3.y1})`);
else fail('3 ' + JSON.stringify(r3));

/* ══ 4 · ไม่มีอะไรเปลี่ยน ══ */
const r4 = await page.evaluate(async () => { await __settle(); const y0 = Math.round(scrollY), a = __see(); window._laRerender(); await __settle();
  return { y0, y1: Math.round(scrollY), a, top: __topOf(a.id) }; });
if (r4.y0 > 300 && r4.y1 === r4.y0 && r4.top === r4.a.top) ok(`4 ไม่มีอะไรเปลี่ยน · ตำแหน่งเลื่อนเท่าเดิม (${r4.y1}px)`);
else fail('4 ' + JSON.stringify(r4));

/* ══ 5 · ของจริงทั้งเส้น · อีกคนเพิ่มใบจองผ่านเซิร์ฟเวอร์ ระหว่างที่เรากำลังเลื่อนอยู่ ══ */
{
  const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8' };
  const S = { version: 1, data: fs.readFileSync(process.env.LAD, 'utf8'), sse: new Set(), loads: 0 };
  const push = () => { S.version++; const t = 'data: ' + JSON.stringify({ version: S.version, updated_by: 'A' }) + '\n\n'; S.sse.forEach(r => { try { r.write(t); } catch (_) {} }); };
  const hb = setInterval(() => { S.sse.forEach(r => { try { r.write('event: hb\ndata: 1\n\n'); } catch (_) {} }); }, 1000);
  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    const J = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
    if (u === '/api/me') return J(200, { username: 'test', name: 'test', role: 'admin', canEdit: true });
    if (u === '/api/version') return J(200, { version: S.version, updated_by: 'A', updated_at: new Date().toISOString() });
    if (u === '/api/load') { S.loads++; return J(200, { version: S.version, data: S.data, updated_by: 'A', updated_at: new Date().toISOString() }); }
    if (u === '/api/events') { res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', 'connection': 'keep-alive' }); res.write('retry: 1000\n\n'); S.sse.add(res); req.on('close', () => S.sse.delete(res)); return; }
    if (u === '/api/save' || u === '/api/v1/_batch') { let b = ''; req.on('data', c => b += c); return req.on('end', () => J(200, { ok: true, version: ++S.version })); }
    if (u.startsWith('/api/')) return J(200, {});
    const rel = decodeURIComponent(u).replace(/^\/+/, '') || 'allotment_v2.html', f = path.join(ROOT, rel);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nope'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  const port = await new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 800 } });
  const p2 = await ctx.newPage(); const err2 = []; p2.on('pageerror', e => err2.push(String(e && e.message || e))); p2.on('dialog', d => d.accept());
  await ctx.route('**/*', r => r.request().url().startsWith(`http://127.0.0.1:${port}/`) ? r.continue() : r.abort());
  await p2.goto(`http://127.0.0.1:${port}/allotment_v2.html`, { waitUntil: 'commit', timeout: 60000 });
  await p2.waitForFunction(() => typeof window.nav === 'function' && typeof window.bkV2SwitchTab === 'function' && document.querySelectorAll('.nav-item[data-view]').length > 0, null, { timeout: 15000 });
  await p2.waitForTimeout(1500);
  const a5 = await p2.evaluate(async day => {
    /* ตัวบูตคืนหน้าที่เปิดค้างไว้ (_laRestoreView) หลังโหลดก้อนแรกเสร็จ · กดเมนูซ้ำจนหน้าอยู่นิ่ง */
    const el = document.querySelector('.nav-item[data-view="booking"]');
    for (let i = 0; i < 12; i++) { nav(el); await new Promise(z => setTimeout(z, 500)); if (document.getElementById('view-booking').classList.contains('active') && i >= 2) break; }
    if (!document.getElementById('view-booking').classList.contains('active')) return { err: 'booking page did not stay open' };
    _bkV2.filterDate = day; _bkV2.filterRoute = null; bkV2SwitchTab('bytrip'); await new Promise(z => setTimeout(z, 900));
    window.__rows = () => [...document.querySelectorAll('#bkv2-host tr.t2-row[data-al]')];
    const rows = __rows(); if (rows.length < 12) return { err: 'only ' + rows.length + ' rows' };
    const tgt = rows[Math.floor(rows.length * 0.7)];
    window.scrollTo(0, Math.round(tgt.getBoundingClientRect().top + scrollY - 200));
    try { document.activeElement && document.activeElement.blur(); } catch (_) {}
    return { first: rows[0].dataset.al, n: rows.length };
  }, day);
  if (a5.err) fail('5 setup · ' + a5.err);
  else {
    /* อีกคนเพิ่มใบจองวันเดียวกัน · อยู่บนสุดของตาราง */
    const D = JSON.parse(S.data), src = D.sb_bookings.find(b => b.id === a5.first) || D.sb_bookings.find(b => (b.trips || []).some(t => t.date === day));
    const cp = JSON.parse(JSON.stringify(src)); cp.id = 'BK-STAY-9'; cp.voucher = 'STAY-9'; D.sb_bookings.unshift(cp); S.data = JSON.stringify(D);
    await p2.waitForTimeout(700);
    const loads0 = S.loads;
    /* เลื่อนต่อเนื่อง 2 วิ ด้วย scroll ล้วน ๆ (เหมือนลากแถบเลื่อน/ปัดจอ · ไม่มี wheel ไม่มี mousedown) · อีกคนเซฟเข้ามากลางคัน */
    const scrolling = p2.evaluate(async () => { for (let i = 0; i < 20; i++) { window.scrollBy(0, i % 2 ? 6 : -6); await new Promise(z => setTimeout(z, 100)); } });
    await p2.waitForTimeout(350); push(); await scrolling;
    const during = { loads: S.loads - loads0, has: await p2.evaluate(() => __rows().some(r => r.dataset.al === 'BK-STAY-9')) };
    const see = await p2.evaluate(() => { const r = __rows().find(x => x.getBoundingClientRect().top >= 0); return { id: r.dataset.al, top: Math.round(r.getBoundingClientRect().top), y: Math.round(scrollY) }; });
    let got = false; for (let i = 0; i < 40 && !got; i++) { await p2.waitForTimeout(150); got = await p2.evaluate(() => __rows().some(r => r.dataset.al === 'BK-STAY-9')); }
    await p2.waitForTimeout(300);
    const aft = await p2.evaluate(id => { const r = __rows().find(x => x.dataset.al === id); return { top: r ? Math.round(r.getBoundingClientRect().top) : null, y: Math.round(scrollY) }; }, see.id);
    if (during.loads === 0 && !during.has && got && Math.abs(aft.top - see.top) <= 2 && aft.y - see.y >= 20)
      ok(`5 อีกคนเพิ่มใบจองขณะเรากำลังเลื่อน · หน้าไม่วาดใหม่กลางคัน · หยุดเลื่อนแล้วใบใหม่ขึ้น แถวที่ดูอยู่ยังอยู่ที่ ${aft.top}px (หน้ายาวขึ้น ${aft.y - see.y}px ข้างบน)`);
    else fail('5 ' + JSON.stringify({ during, got, see, aft }));
  }
  const e2 = err2.filter(e => !/Failed to load resource/.test(e)); if (e2.length) fail('7 errors (sync page): ' + e2.slice(0, 2).join(' | '));
  clearInterval(hb); await browser.close(); srv.close();
}

/* ══ 6 · Fleet Calendar ══ */
await goView(page, 'fleetcal', 1000);
const r6 = await page.evaluate(async () => {
  const c = {}; Object.keys(TRIPS || {}).forEach(d => { c[d] = Object.values(TRIPS[d] || {}).filter(o => o && !Array.isArray(o) && o.route).length; });
  const d = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; _fc.from = d; _fc.mode = 'm14'; _fc.pier = 'all';
  const read = () => { renderFleetCal(); const g = []; let cur = null;
    [...document.querySelectorAll('.fc-mt tbody tr, .fc-mt tr')].forEach(tr => {
      if (tr.classList.contains('fc-mg')) { cur = { pier: tr.textContent.trim().slice(0, 14), names: [] }; g.push(cur); }
      else if (tr.classList.contains('fc-pr') && cur && !tr.classList.contains('fr')) { const fl = tr.querySelector('.nm .fl'); const nm = fl ? fl.textContent : (/Charter/.test(tr.textContent) ? '__chr' : ''); if (nm && !cur.names.includes(nm)) cur.names.push(nm); } });
    return g; };
  const byName = n => (ROUTES || []).find(r => r.name === n);
  const keep = ROUTES.map(r => r.sort);
  const seen = []; read().forEach(g => g.names.forEach(n => { const r = byName(n); if (r && !seen.includes(r)) seen.push(r); }));
  const check = g => g.every(x => { const rs = x.names.filter(n => n !== '__chr'); const want = rs.slice().sort((a, b) => laRouteOrdCmp(byName(a), byName(b)));
    return rs.join('|') === want.join('|') && (!x.names.includes('__chr') || x.names[x.names.length - 1] === '__chr'); });
  /* ตั้ง sort เองสองแบบ · ลำดับบนจอต้องกลับด้านตาม */
  seen.forEach((r, i) => { r.sort = i + 1; }); const A = read(), okA = check(A);
  seen.forEach((r, i) => { r.sort = 1000 - i; }); const B = read(), okB = check(B);
  ROUTES.forEach((r, i) => { r.sort = keep[i]; }); const C = read(), okC = check(C);
  const multi = A.filter(x => x.names.filter(n => n !== '__chr').length >= 2);
  const flipped = multi.every(x => { const b = B.find(y => y.pier === x.pier); const ra = x.names.filter(n => n !== '__chr'), rb = b.names.filter(n => n !== '__chr'); return ra.slice().reverse().join('|') === rb.join('|'); });
  return { d, multi: multi.length, okA, okB, okC, flipped, chr: A.some(x => x.names.includes('__chr')), ex: multi[0] ? [multi[0].names, B.find(y => y.pier === multi[0].pier).names] : null };
});
if (r6.multi >= 1 && r6.okA && r6.okB && r6.okC && r6.flipped) ok(`6 Fleet Calendar · ${r6.multi} ท่าที่มี 2+ โปรแกรม เรียงตาม sort ของ Program Config · สลับ sort แล้วแถวสลับตาม${r6.chr ? ' · Charter ท้ายสุด' : ''}`);
else fail('6 ' + JSON.stringify(r6));

const e1 = errors.filter(e => !/Failed to load resource/.test(e));
if (!e1.length) ok('7 ไม่มี error บนหน้า'); else fail('7 ' + e1.slice(0, 3).join(' | '));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
