// §lazyBase + §hiddenDefer (2026-10-15) · /api/load ก้อนเต็มทุกครั้งที่ใครเซฟ ทำจอค้าง
//
// ที่มา · วัดบน prod 15 ต.ค. 2026 · ก้อน 34.6 MB · ดึงใหม่ 2 รอบใน 30 วิ (คนอื่นเซฟ)
//   แต่ละรอบ parse 34 MB สามครั้ง (คำตอบ · BASE · _laReloadData) แล้ววาดหน้าใหม่ = จอค้าง 1.5 วิ+ บนเครื่องแรง
//   และแท็บที่ซ่อนอยู่ก็ดึง+วาดเหมือนกัน (รอบ 10 วิ/SSE ไม่ดู document.hidden)
//
// กันห้าอย่าง
//   1 ดึงก้อนใหม่หนึ่งรอบ parse ก้อนใหญ่ไม่เกินสองครั้ง (คำตอบ + ข้อมูลที่ใช้) · ของเดิมสาม
//   2 ของที่คนอื่นแก้มาถึงหน้าจอจริง
//   3 แก้ของเราหลังจากนั้น · ส่งขึ้นเฉพาะใบที่เราแก้ · ไม่ส่งของคนอื่นกลับไปทับ (BASE ต้องเป็นก้อนล่าสุด)
//   4 ดึงสองรอบติดแล้วค่อยแก้ · BASE ต้องเป็นของรอบหลัง ไม่ใช่สตริงเก่าที่ค้าง
//   5 แท็บซ่อน · เวอร์ชันขยับ ไม่ดึง · กลับมาดูจอ ดึงทันที
//
// ไม่ต้องใช้ LAD · สร้างก้อนข้อมูลปลอมเอง (~2 MB) · ยกเซิร์ฟเวอร์ปลอมแบบเดียวกับ t_selfecho
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../allotment_v2');

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

/* ก้อนปลอม · ใบจองพอให้ใหญ่กว่าเกณฑ์ "ก้อนใหญ่" ของเทส (500 KB) แบบชัด ๆ */
const bookings = [];
for (let i = 0; i < 2500; i++) {
  bookings.push({ id:'zz_test_bk_' + i, schemaVer:2, status:'confirmed', agentId:'', channel:'agent',
    leadPax:'Guest ' + i, hotelName:'Hotel ' + (i % 40), notes:'',
    trips:[{ routeId:'r1', date:'2026-10-' + String(10 + (i % 20)).padStart(2,'0'), bookingMode:'seat',
             pax:{ ad_fr:2, ad_th:0, chd_fr:0, chd_th:0, inf_fr:0, inf_th:0, foc:0 } }],
    passengers:[], addOns:[], history:[{ at:'2026-10-01T00:00:00Z', by:'seed', what:'x'.repeat(400) }] });
}
const S = {
  version: 1, sse: new Set(), loads: 0, saves: 0, lastSave: '',
  blob: { sb_bookings: bookings, sb_agents: [] }
};
function push(by){ S.version++; const t = 'data: ' + JSON.stringify({ version:S.version, updated_by:by||'เครื่อง A' }) + '\n\n';
  S.sse.forEach(r => { try{ r.write(t); }catch(_){} }); }

const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const J = (code, obj) => { res.writeHead(code, {'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store'}); res.end(JSON.stringify(obj)); };
  if (u === '/api/me') return J(200, { username:'test', name:'ทดสอบ', role:'admin', canEdit:true });
  if (u === '/api/version') return J(200, { version:S.version, updated_by:'เครื่อง A', updated_at:new Date().toISOString() });
  if (u === '/api/load'){ S.loads++;
    return J(200, { version:S.version, data:JSON.stringify(S.blob), updated_by:'เครื่อง A', updated_at:new Date().toISOString() }); }
  if (u === '/api/ck') return J(501, { error:'ck off' });     /* บังคับทางก้อนเต็ม · ทางที่เทสนี้วัด */
  if (u === '/api/events'){
    res.writeHead(200, {'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache','connection':'keep-alive'});
    res.write('retry: 1000\n\n'); S.sse.add(res); req.on('close', () => S.sse.delete(res)); return;
  }
  if (u === '/api/save' || u === '/api/v1/_batch'){
    S.saves++; let body = ''; req.on('data', c => body += c);
    return req.on('end', () => { S.lastSave = body; const v = ++S.version; J(200, { ok:true, version:v, behind:0 }); });
  }
  if (u.startsWith('/api/')) return J(200, {});
  const rel = decodeURIComponent(u).replace(/^\/+/, '') || 'allotment_v2.html';
  const f = path.join(ROOT, rel);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const port = await new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{ width:1600, height:950 } });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
await ctx.route('**/*', r => r.request().url().startsWith(`http://127.0.0.1:${port}/`) ? r.continue() : r.abort());
/* นับ JSON.parse ของสตริงใหญ่ · ติดตั้งก่อนสคริปต์ของหน้าทำงาน · document.hidden ให้เทสสลับได้ */
await page.addInitScript(() => {
  const jp = JSON.parse; window.__bigParse = 0;
  JSON.parse = function(s, r){ if (typeof s === 'string' && s.length > 500000) window.__bigParse++; return jp.call(JSON, s, r); };
  window.__hid = false;
  Object.defineProperty(document, 'hidden', { configurable:true, get(){ return window.__hid; } });
  Object.defineProperty(document, 'visibilityState', { configurable:true, get(){ return window.__hid ? 'hidden' : 'visible'; } });
});
await page.goto(`http://127.0.0.1:${port}/allotment_v2.html`, { waitUntil:'commit', timeout:60000 });
await page.waitForFunction(() => typeof window.nav === 'function'
  && document.querySelectorAll('.nav-item[data-view]').length > 0, null, { timeout:25000 });
await page.waitForTimeout(2500);
const wired = await page.evaluate(() => typeof window._laSoftRefresh === 'function');
if (!wired) { fail('sync layer did not start'); await browser.close(); srv.close(); process.exit(1); }
await page.evaluate(() => { const el = document.querySelector('.nav-item[data-view="booking"]'); if (el) nav(el); });
await page.waitForTimeout(1500);
/* ให้เซฟตอนบูต (seed ของคีย์ที่ไม่มีในก้อนปลอม) จบก่อน */
await page.waitForFunction(() => true, null, { timeout:1000 });
await sleep(2500);

const notesOf = id => page.evaluate(id => (SB_BOOKINGS.find(b => b.id === id) || {}).notes, id);
const waitLoad = async (n0, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (S.loads > n0) return true; await sleep(100); } return false; };
const waitNotes = async (id, want, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await notesOf(id) === want) return true; await sleep(100); } return false; };

/* 1 + 2 · คนอื่นแก้ใบ 1 */
await page.evaluate(() => { window.__bigParse = 0; });
S.blob.sb_bookings[1].notes = 'from machine A';
let l0 = S.loads; push();
const got = await waitNotes('zz_test_bk_1', 'from machine A', 8000);
await sleep(800);
const parses = await page.evaluate(() => window.__bigParse);
if (got) ok('2 another machine\'s edit reaches the screen'); else fail('2 edit never arrived · loads ' + (S.loads - l0));
if (S.loads - l0 === 1 && parses <= 2) ok('1 one refresh = ' + parses + ' big parses (was 3)');
else fail('1 ' + JSON.stringify({ loads:S.loads - l0, parses }));

/* 4 · รอบที่สอง · คนอื่นแก้ใบ 2 */
S.blob.sb_bookings[2].notes = 'from machine B';
l0 = S.loads; push();
if (await waitNotes('zz_test_bk_2', 'from machine B', 8000)) ok('4a second refresh applied');
else fail('4a second refresh never arrived');
await sleep(800);

/* 3 + 4 · เราแก้ใบ 3 · ที่ส่งขึ้นต้องมีแค่ใบ 3 */
const s0 = S.saves;
await page.evaluate(() => { const b = SB_BOOKINGS.find(x => x.id === 'zz_test_bk_3'); b.notes = 'mine'; acctPersistBookings(); });
const t0 = Date.now(); while (S.saves === s0 && Date.now() - t0 < 6000) await sleep(100);
const body = S.lastSave;
const has = id => body.indexOf('"' + id + '"') >= 0;
if (S.saves > s0 && has('zz_test_bk_3') && !has('zz_test_bk_1') && !has('zz_test_bk_2'))
  ok('3+4 own save carries only the edited booking · nothing from the two refreshes is pushed back');
else fail('3 ' + JSON.stringify({ saves:S.saves - s0, bk3:has('zz_test_bk_3'), bk1:has('zz_test_bk_1'), bk2:has('zz_test_bk_2'), len:body.length }));
await sleep(1500);

/* 5 · แท็บซ่อน */
await page.evaluate(() => { window.__hid = true; document.dispatchEvent(new Event('visibilitychange')); });
S.blob.sb_bookings[4].notes = 'while hidden';
l0 = S.loads; push();
await sleep(12000);                                   /* เกินคาบ poll 10 วิ + ตัว 3 วิ */
if (S.loads === l0) ok('5a hidden tab: version moved, no /api/load (12s)'); else fail('5a hidden tab pulled ' + (S.loads - l0) + 'x');
await page.evaluate(() => { window.__hid = false; document.dispatchEvent(new Event('visibilitychange')); });
if (await waitNotes('zz_test_bk_4', 'while hidden', 5000)) ok('5b tab shown again → pulls at once');
else fail('5b nothing pulled after the tab came back');

await browser.close(); srv.close();
console.log(bad ? `\n  ${bad} failed` : '\n  all passed');
process.exit(bad ? 1 : 0);
