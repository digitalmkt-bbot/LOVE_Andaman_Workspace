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
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/allotment_v2.html`);
  await page.waitForFunction(() => typeof window.nav === 'function' && document.querySelectorAll('.nav-item[data-view]').length > 0, null, { timeout: 25000 }); await page.waitForTimeout(1500);
  return { page, errors, close: async () => { await browser.close(); srv.close(); } };
}
const probe = async (page) => page.evaluate(async () => {
  const z = ms => new Promise(f => setTimeout(f, ms)); const vis = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
  nav(document.querySelector('.nav-item[data-view="booking"]')); await z(500);
  _bkV2.filterDate = '2026-10-15'; bkV2SwitchTab('all'); await z(600);
  const tabAfterAll = _bkV2.tab;
  const tabs = [...document.querySelectorAll('#view-booking .bkv2-utab')].filter(vis).map(b => b.textContent.trim());
  const nb = vis(document.querySelector('#view-booking .bkv2-newbtn2'));
  bkV2SwitchTab('bytrip'); await z(900);
  const H = document.querySelector('#view-booking .bt-hgrid');
  const kids = H ? [...H.children].filter(vis).length : -1;
  const prog = vis(document.querySelector('#view-booking .bt-c.bt-prog')), boat = vis(document.querySelector('#view-booking .bt-c.bt-boat')), tbl = vis(document.querySelector('#view-booking .t2-wrap'));
  const progW = prog ? Math.round(document.querySelector('#view-booking .bt-c.bt-prog').getBoundingClientRect().width) : 0;
  bkV2NewBooking(); await z(300); const nbOpen = !!_bkV2.newBooking;
  const someId = (SB_BOOKINGS.find(b => b.status === 'confirmed') || {}).id; bkV2OpenDetail(someId); await z(300); const det = !!_bkV2.detailId;
  _bkV2.newBooking = null; _bkV2.detailId = null; bkV2SwitchTab('cal'); await z(500); const cal = _bkV2.tab === 'cal' && vis(document.querySelector('#view-booking .bkv2-cal-cell'));
  return { tabAfterAll, tabs, nb, kids, prog, boat, tbl, progW, nbOpen, det, cal, body: document.body.classList.contains('la-bkprog') };
});

// 1 · ผู้ใช้ที่ติดข้อจำกัด
{ const { page, errors, close } = await run({ username: 'tua', name: 'K.Tua', role: 'staff', perms: ['booking', 'calendar', '*explicit', 'lim-bkprog'], editAreas: [] });
  const r = await probe(page);
  if (process.env.SHOT) { await page.evaluate(async () => { bkV2SwitchTab('bytrip'); await new Promise(f => setTimeout(f, 900)); }); await page.screenshot({ path: '/mnt/user-data/outputs/bklim_bytrip.png' }); }
  if (r.body && r.tabs.join('|') === 'Calendar|By trip · date' && !r.nb && r.tabAfterAll === 'bytrip') ok('1 limited · แท็บเหลือ Calendar + By trip · ไม่มี New booking · กดแท็บอื่นเด้งกลับ By trip'); else fail('1 ' + JSON.stringify(r));
  if (r.prog && !r.boat && !r.tbl && r.kids === 1 && r.progW > 1200) ok(`2 limited · By trip เห็นแค่การ์ดตารางโปรแกรม กว้างเต็ม (${r.progW}px) · ไม่มีการ์ดเรือ/รถ/ล็อก · ไม่มีตารางรายชื่อ`); else fail('2 ' + JSON.stringify(r));
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
  if (r.LL.join() === 'lim-bkprog' && r.AA.every(k => /^act-/.test(k)) && !r.lim && !r.body) ok('5 admin ไม่โดนข้อจำกัดแม้มีคีย์ · LA_ACTS แยก lim / act ถูก'); else fail('5 ' + JSON.stringify(r));
  await close(); }

const srvSrc = fs.readFileSync(process.env.SRV || path.resolve(ROOT, '../server.js'), 'utf8');
if (/PERM_KEYS\.add\('lim-bkprog'\)/.test(srvSrc)) ok('6 server.js รู้จักคีย์ lim-bkprog (cleanPerms ไม่ตัดทิ้งตอนบันทึก)'); else fail('6 server.js ไม่มี PERM_KEYS.add(lim-bkprog)');
console.log(bad ? `FAIL ${bad}` : 'PASS'); process.exit(bad ? 1 : 0);
