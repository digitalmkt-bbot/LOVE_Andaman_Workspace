// §bkLim · ผู้ใช้ที่ติดข้อจำกัด lim-bkprog · Booking เหลือ Calendar + By trip (การ์ดตารางโปรแกรมอย่างเดียว)
// ฮาร์เนสปกติข้ามระบบ login (localhost) · เทสนี้ตอบ /api/me + /api/load เอง ให้ตัวบูตเดินทางเดียวกับของจริง
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../allotment_v2');
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json' };
const BLOB = fs.readFileSync(process.env.LAD, 'utf8');
async function run(me){
  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/api/me') { res.writeHead(200, {'content-type':'application/json'}); res.end(JSON.stringify(me)); return; }
    if (u === '/api/load') { res.writeHead(200, {'content-type':'application/json'}); res.end(JSON.stringify({ data: BLOB, version: 1, updated_by: 'x', updated_at: new Date().toISOString() })); return; }
    if (u.startsWith('/api/')) { res.writeHead(404, {'content-type':'application/json'}); res.end('{}'); return; }
    const f = path.join(ROOT, decodeURIComponent(u).replace(/^\/+/, '') || 'allotment_v2.html');
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
  await page.addInitScript(() => { try { localStorage.setItem('_nat_bootstrap_done', '1'); } catch (_) {} });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.route(u => !/^http:\/\/127\.0\.0\.1/.test(String(u)), r => r.abort());
  await page.goto(`http://127.0.0.1:${srv.address().port}/allotment_v2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.nav === 'function' && document.querySelectorAll('.nav-item[data-view]').length > 0, null, { timeout: 25000 }); await page.waitForTimeout(1500);
  return { page, errors, close: async () => { await browser.close(); srv.close(); } };
}
const probe = async (page) => page.evaluate(async () => {
  const z = ms => new Promise(f => setTimeout(f, ms)); const vis = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
  nav(document.querySelector('.nav-item[data-view="booking"]')); await z(500);
  _bkV2.filterDate = '2026-10-15'; bookingV2SwitchTab('all'); await z(600);
  const tabAfterAll = _bkV2.tab;
  const tabs = [...document.querySelectorAll('#view-booking .bkv2-utab')].filter(vis).map(b => b.textContent.trim());
  const nb = vis(document.querySelector('#view-booking .bkv2-newbtn2'));
  bookingV2SwitchTab('bytrip'); await z(900);
  const H = document.querySelector('#view-booking .bt-hgrid');
  const kids = H ? [...H.children].filter(vis).length : -1;
  const prog = vis(document.querySelector('#view-booking .bt-c.bt-prog')), boat = vis(document.querySelector('#view-booking .bt-c.bt-boat')), tbl = vis(document.querySelector('#view-booking .t2-wrap'));
  const progW = prog ? Math.round(document.querySelector('#view-booking .bt-c.bt-prog').getBoundingClientRect().width) : 0;
  const boatW = boat ? Math.round(document.querySelector('#view-booking .bt-c.bt-boat').getBoundingClientRect().width) : 0;
  const col3 = vis(document.querySelector('#view-booking .bt-col3'));
  bookingV2NewBooking(); await z(300); const nbOpen = !!_bkV2.newBooking;
  const someId = (SB_BOOKINGS.find(b => b.status === 'confirmed') || {}).id; bookingV2OpenDetail(someId); await z(300); const det = !!_bkV2.detailId;
  _bkV2.newBooking = null; _bkV2.detailId = null; bookingV2SwitchTab('cal'); await z(500); const cal = _bkV2.tab === 'cal' && vis(document.querySelector('#view-booking .bkv2-cal-cell'));
  return { tabAfterAll, tabs, nb, kids, prog, boat, tbl, progW, boatW, col3, nbOpen, det, cal, body: document.body.classList.contains('la-bkprog') };
});

// 1 · ผู้ใช้ที่ติดข้อจำกัด
{ const { page, errors, close } = await run({ username: 'tua', name: 'K.Tua', role: 'staff', perms: ['booking', 'calendar', '*explicit', 'lim-bkprog'], editAreas: [] });
  const r = await probe(page);
  if (process.env.SHOT) { await page.evaluate(async () => { bookingV2SwitchTab('bytrip'); await new Promise(f => setTimeout(f, 900)); }); await page.screenshot({ path: '/mnt/user-data/outputs/bklim_bytrip.png' }); }
  if (r.body && r.tabs.join('|') === 'Calendar|By trip · date' && !r.nb && r.tabAfterAll === 'bytrip') ok('1 limited · แท็บเหลือ Calendar + By trip · ไม่มี New booking · กดแท็บอื่นเด้งกลับ By trip'); else fail('1 ' + JSON.stringify(r));
  if (r.prog && r.boat && !r.col3 && !r.tbl && r.kids === 2 && r.progW > 600 && r.boatW > 500) ok(`2 limited · By trip เห็นการ์ดตารางโปรแกรม (${r.progW}px) + Boats running (${r.boatW}px) · ไม่มีโหมด/ล็อก/Notice · ไม่มีตารางรายชื่อ`); else fail('2 ' + JSON.stringify(r));
  if (!r.nbOpen && !r.det && r.cal) ok('3 limited · New booking / เปิดใบจอง ทางลัดถูกกัน · Calendar ใช้ได้'); else fail('3 ' + JSON.stringify(r));
  if (errors.length) fail('errors(limited): ' + errors.join(' | ')); await close(); }

// 2 · ผู้ใช้ปกติ (ไม่ติ๊ก) · เห็นเหมือนเดิม
{ const { page, errors, close } = await run({ username: 'rsvn', name: 'RSVN', role: 'staff', perms: ['booking', 'calendar', '*explicit'], editAreas: ['operations'] });
  const r = await probe(page);
  if (!r.body && r.tabs.length >= 5 && r.nb && r.tabAfterAll === 'all' && r.boat && r.tbl && r.nbOpen) ok(`4 ผู้ใช้ปกติ · แท็บ ${r.tabs.length} · การ์ดเรือ + ตารางรายชื่อ + New booking ครบเหมือนเดิม`); else fail('4 ' + JSON.stringify(r));
  if (errors.length) fail('errors(normal): ' + errors.join(' | ')); await close(); }

// 3 · หน้าต่างจัดการผู้ใช้ · กล่องข้อจำกัดแยกจากสิทธิ์พิเศษ
{ const { page, errors, close } = await run({ username: 'admin', name: 'Admin', role: 'admin', perms: null, editAreas: [] });
  if (process.env.SHOT) { await page.evaluate(async () => { const z = ms => new Promise(f => setTimeout(f, ms)); const D = { perms: ['booking','calendar'], edit: [], acts: ['lim-bkprog'] }; const el = document.createElement('div'); el.id = 'shotperm'; el.style.cssText = 'position:fixed;left:0;top:0;width:760px;background:#fff;z-index:999999;padding:16px'; document.body.appendChild(el); window.__shotD = D; }); }
  const r = await page.evaluate(() => { const fn = Object.keys(window).find(k => /^__la/.test(k)); const LL = LA_ACTS.filter(a => a.lim).map(a => a.v), AA = LA_ACTS.filter(a => !a.lim).map(a => a.v); return { LL, AA, lim: laLimited('lim-bkprog'), body: document.body.classList.contains('la-bkprog') }; });
  if (r.LL.join() === 'lim-pjlite,lim-bkct,lim-bkprog' && r.AA.every(k => /^act-/.test(k)) && !r.lim && !r.body) ok('5 admin ไม่โดนข้อจำกัดแม้มีคีย์ · LA_ACTS แยก lim / act ถูก'); else fail('5 ' + JSON.stringify(r));
  await close(); }

const srvSrc = fs.readFileSync(process.env.SRV || path.resolve(ROOT, '../server.js'), 'utf8');
if (/PERM_KEYS\.add\('lim-bkprog'\)/.test(srvSrc)) ok('6 server.js รู้จักคีย์ lim-bkprog (cleanPerms ไม่ตัดทิ้งตอนบันทึก)'); else fail('6 server.js ไม่มี PERM_KEYS.add(lim-bkprog)');

// §navHole · Rate Expiry ต้องอยู่ใต้สิทธิ์ · City Tour ซ่อนได้ด้วย lim-bkct
const navProbe = (page) => page.evaluate(() => { const vis = el => !!el && getComputedStyle(el).display !== 'none'; return { rate: vis(document.querySelector('.nav-item[data-view="rate-admin"]')), ct: vis(document.querySelector('.nav-item[data-citytour]')), bk: vis(document.querySelector('.nav-item[data-view="booking"]:not([data-citytour])')) }; });
{ const { page, close } = await run({ username: 'tua', name: 'K.Tua', role: 'staff', perms: ['booking', 'calendar', '*explicit', 'lim-bkprog', 'lim-bkct'], editAreas: [] });
  const r = await navProbe(page);
  if (r.bk && !r.rate && !r.ct) ok('7 K.Tua (Booking+Calendar · ติ๊ก lim-bkct) · ไม่เห็น Rate Expiry และ City Tour · Booking ยังอยู่'); else fail('7 ' + JSON.stringify(r)); await close(); }
{ const { page, close } = await run({ username: 'tua', name: 'K.Tua', role: 'staff', perms: ['booking', 'calendar', '*explicit'], editAreas: [] });
  const r = await navProbe(page);
  if (r.bk && !r.rate && r.ct) ok('8 ไม่ติ๊ก lim-bkct · City Tour ยังเห็นตามเดิม · Rate Expiry ไม่หลุดมาเอง'); else fail('8 ' + JSON.stringify(r)); await close(); }
{ const { page, close } = await run({ username: 'sale', name: 'Sale', role: 'staff', perms: ['rate-types', 'agents', '*explicit'], editAreas: ['sales'] });
  const r = await navProbe(page);
  if (r.rate) ok('9 คนที่ถือ Rate Types อยู่แล้ว · ยังเห็น Rate Expiry โดยไม่ต้องติ๊กใหม่'); else fail('9 ' + JSON.stringify(r)); await close(); }
if (/PERM_KEYS\.add\('lim-bkct'\)/.test(srvSrc) && /PERM_KEYS\.add\('rate-admin'\)/.test(srvSrc)) ok('10 server.js รู้จัก lim-bkct + rate-admin'); else fail('10 server keys');

// §pjLim · ใบงานเรือ: ไม่เห็นทีมเรือ/ไกด์ · ไม่มีปุ่มพิมพ์
const pjProbe = (page) => page.evaluate(async () => { const z = ms => new Promise(f => setTimeout(f, ms)); const vis = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
  const el = document.querySelector('.nav-item[data-view^="poj-"]'); if (!el) return { none: true }; nav(el); await z(1200);
  const V = document.querySelector('.view.active'); const card = V.querySelector('.bc');
  const sec = k => vis(V.querySelector('.bc > .pj-gh[data-sec="' + k + '"]'));
  let printed = 0; const _o = window.open; window.open = () => { printed++; return null; }; try { pjPrint(); } catch (_) {} window.open = _o;
  return { crew: sec('crew'), guide: sec('guide'), lang: sec('lang'), kit: sec('kit'), cust: sec('cust'), note: sec('note'), rows: [...V.querySelectorAll('.bc > .pj-rw')].filter(vis).length, top: vis(card && card.querySelector('.top')),
    print: vis(V.querySelector('button[onclick^="pjPrint"]')), gj: [...V.querySelectorAll('button[onclick^="pjGuideJob"]')].filter(vis).length, lic: [...V.querySelectorAll('.pj-licbox')].filter(vis).length, foot: [...V.querySelectorAll('.bc > .foot')].filter(vis).length, printed }; });
{ const { page, close } = await run({ username: 'tua', name: 'K.Tua', role: 'staff', perms: ['poj-panwa', 'poj-tublamu', 'poj-ranong', '*explicit', 'lim-pjlite'], editAreas: [] });
  const r = await pjProbe(page);
  if (process.env.SHOT) await page.screenshot({ path: '/mnt/user-data/outputs/pjlim.png' });
  if (!r.crew && !r.guide && r.rows === 0 && r.lic === 0 && r.foot === 0 && r.top && r.lang && r.kit && r.cust && r.note) ok('11 ใบงานเรือ (lim-pjlite) · ไม่เห็น Captain & Crew / Guides & Trainee / ใบอนุญาต / ปุ่มทีม · ยังเห็นหัวเรือ ภาษา ครัว ลูกค้า โน้ต'); else fail('11 ' + JSON.stringify(r));
  if (!r.print && r.gj === 0) ok('12 ใบงานเรือ (lim-pjlite) · ไม่มีปุ่มพิมพ์ และปุ่มใบงานไกด์'); else fail('12 ' + JSON.stringify(r));
  await close(); }
{ const { page, close } = await run({ username: 'po', name: 'Pier', role: 'staff', perms: ['poj-panwa', 'poj-tublamu', 'poj-ranong', '*explicit'], editAreas: ['pier'] });
  const r = await pjProbe(page);
  if (r.crew && r.guide && r.rows > 0 && r.print) ok('13 ใบงานเรือ ผู้ใช้ปกติ · ทีมเรือ ไกด์ ปุ่มพิมพ์ ครบเหมือนเดิม'); else fail('13 ' + JSON.stringify(r));
  await close(); }
if (/PERM_KEYS\.add\('lim-pjlite'\)/.test(srvSrc)) ok('14 server.js รู้จัก lim-pjlite'); else fail('14 server key');
console.log(bad ? `FAIL ${bad}` : 'PASS'); process.exit(bad ? 1 : 0);
