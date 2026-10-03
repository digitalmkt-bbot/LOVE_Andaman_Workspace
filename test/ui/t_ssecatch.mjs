// §sseCatchup · หน้าทั่วไป (ไม่ใช่หน้าเช็คอิน) ต้องเห็นของที่คนอื่นเซฟเร็ว
//
// ที่มา (2026-09-23) · "user 1 แก้ · user 2 เห็นอีก ~10 วิ"
//   วัดบน prod 47 นาที · SSE หลุดเอง 4 ครั้ง · ช่วงหนึ่งเปิดค้างแต่เงียบ ~8 นาที
//   ต่อใหม่แล้วไม่มีใครถามเวอร์ชัน → รอ poll 10 วิ · หน้าทั่วไปรอด่านว่าง 2 วิ + ตัวเดิน 3 วิ อีกชั้น
//
// ⚠ ใช้เซิร์ฟเวอร์ปลอมแบบเดียวกับ t_cklive.mjs (ต้องมี /api/me · SSE · /api/version จริง)
//
// กันห้าอย่าง
//   1 หน้าทั่วไป · SSE ส่งมา ต้องดึงภายใน ~1 วิ (เดิมได้ถึง ~5 วิ)
//   2 เพิ่งคลิกไป · ต้องตามภายใน ~1 วิหลังมือหยุด (เดิมรอ 2 วิ + ตัวเดิน 3 วิ)
//   3 สายหลุดแล้วต่อเอง · ของที่เซฟระหว่างหลุดต้องถูกตามทันทีที่ต่อได้ ไม่ใช่รอ poll 10 วิ
//   4 /api/load ช้า · ห้ามยิงซ้อนหลายลูก แต่สุดท้ายต้องได้เวอร์ชันล่าสุด
//   5 สายเปิดค้างแต่เงียบ (ไม่มี hb) · ต้องถูกตัดแล้วต่อใหม่เอง (ข้อนี้ใช้เวลา ~90 วิ · SKIP_SLOW=1 ข้าม)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../allotment_v2');
const BLOB = process.env.LAD;
if (!BLOB || !fs.existsSync(BLOB)) { console.log('  ! ต้องมี LAD=<ไฟล์ข้อมูล> · ข้ามเทสนี้'); process.exit(0); }

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

const S = { version:1, data:fs.readFileSync(BLOB,'utf8'), sse:new Set(), sseOpens:0,
  loads:0, loadsInFlight:0, maxInFlight:0, loadDelay:0, lastLoadVer:0, verHits:0,
  hb:true };        // false = สายเปิดค้างแต่ไม่ส่ง hb (จำลองพร็อกซีกลืน event)
function bump(){ S.version++; }
function push(){ bump(); const t='data: '+JSON.stringify({version:S.version,updated_by:'A'})+'\n\n';
  S.sse.forEach(r=>{ try{ r.write(t); }catch(_){} }); }
setInterval(() => { if (S.hb) S.sse.forEach(r => { try{ r.write('event: hb\ndata: 1\n\n'); }catch(_){} }); }, 1000);

const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const J = (code, obj) => { res.writeHead(code, {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}); res.end(JSON.stringify(obj)); };
  if (u === '/api/me') return J(200, { username:'test', name:'ทดสอบ', role:'admin', canEdit:true });
  if (u === '/api/version'){ S.verHits++; return J(200, { version:S.version, updated_by:'A', updated_at:new Date().toISOString() }); }
  if (u === '/api/load'){
    S.loads++; S.loadsInFlight++; S.maxInFlight = Math.max(S.maxInFlight, S.loadsInFlight);
    const snap = { version:S.version, data:S.data, updated_by:'A', updated_at:new Date().toISOString() };
    return setTimeout(() => { S.loadsInFlight--; S.lastLoadVer = snap.version; J(200, snap); }, S.loadDelay);
  }
  if (u === '/api/events'){
    S.sseOpens++;
    res.writeHead(200, {'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache','connection':'keep-alive'});
    res.write('retry: 1000\n\n');
    S.sse.add(res); req.on('close', () => S.sse.delete(res));
    return;
  }
  if (u === '/api/save' || u === '/api/v1/_batch'){ req.resume(); return req.on('end', () => J(200, { ok:true, version:++S.version })); }
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
await page.goto(`http://127.0.0.1:${port}/allotment_v2.html`, { waitUntil:'commit', timeout:60000 });
await page.waitForFunction(() => typeof window.nav === 'function'
  && document.querySelectorAll('.nav-item[data-view]').length > 0, null, { timeout:25000 });
await page.waitForTimeout(1500);

/* หน้าทั่วไป · Booking (ไม่ใช่หน้าเช็คอิน) */
await page.evaluate(() => { const el = document.querySelector('.nav-item[data-view="booking"]'); if (el) nav(el); });
await page.waitForTimeout(1200);
const view = await page.evaluate(() => { const a = document.querySelector('.nav-item.active'); return a && a.dataset ? a.dataset.view : ''; });
if (view === 'piercheckin' || view === 'vancheckin' || !view) fail('ไม่ได้อยู่หน้าทั่วไป · ' + view);
else ok('อยู่หน้า ' + view + ' (ไม่ใช่หน้าเช็คอิน)');
await page.mouse.move(5, 900);   /* ให้โฟกัสไม่ค้างในช่องพิมพ์ */
await page.evaluate(() => { try{ document.activeElement && document.activeElement.blur(); }catch(_){} });
await sleep(800);

async function waitLoad(limitMs){
  const base = S.loads, t0 = Date.now();
  while (Date.now() - t0 < limitMs){ if (S.loads > base) return Date.now() - t0; await sleep(50); }
  return -1;
}

/* ══ 1 · SSE ส่งมา · หน้าทั่วไปต้องดึงภายใน ~1 วิ ══ */
push();
const t1 = await waitLoad(6000);
if (t1 < 0) fail('SSE ส่งมาแล้ว หน้าทั่วไปไม่ดึงเลยใน 6 วิ');
else if (t1 > 1200) fail('SSE ส่งมาแล้ว หน้าทั่วไปดึงช้า ' + t1 + 'ms (ควร ≤ ~1 วิ)');
else ok('หน้าทั่วไป · SSE ส่งมา ดึงใน ' + t1 + 'ms');
await sleep(1500);

/* ══ 2 · เพิ่งคลิก · ต้องตามภายใน ~1 วิ (ด่านว่าง 300ms ไม่ใช่ 2 วิ) ══ */
await page.mouse.down(); await page.mouse.up();   /* stamp _laLastInput */
push();
const t2 = await waitLoad(6000);
if (t2 < 0) fail('เพิ่งคลิก · ไม่ดึงเลยใน 6 วิ');
else if (t2 > 1200) fail('เพิ่งคลิก · ดึงช้า ' + t2 + 'ms (ควร ≤ ~1 วิ)');
else ok('เพิ่งคลิก · ดึงใน ' + t2 + 'ms');
await sleep(1500);

/* ══ 3 · สายหลุด · ของที่เซฟระหว่างหลุดต้องถูกตามทันทีที่ต่อได้ ══ */
const opens0 = S.sseOpens;
S.sse.forEach(r => { try{ r.end(); }catch(_){} }); S.sse.clear();   /* เซิร์ฟเวอร์ตัดสาย · EventSource ต่อเองใน retry 1 วิ */
bump();                                                              /* เซฟระหว่างสายหลุด · ไม่มีใคร push */
const t3 = await waitLoad(8000);
if (S.sseOpens <= opens0) fail('สายหลุดแล้วไม่ต่อใหม่เอง');
if (t3 < 0) fail('ต่อสายใหม่แล้ว ไม่ตามของที่หลุดไปใน 8 วิ (ต้องรอ poll 10 วิ)');
else if (t3 > 3000) fail('ต่อสายใหม่แล้ว ตามช้า ' + t3 + 'ms');
else ok('สายหลุด · ต่อใหม่แล้วตามของที่หลุดไปใน ' + t3 + 'ms');
await sleep(1500);

/* ══ 4 · /api/load ช้า · ห้ามยิงซ้อน ══ */
S.loadDelay = 2500; S.maxInFlight = 0;
push();
await sleep(400); push(); await sleep(400); push();
await sleep(6500);
const want = S.version;
if (S.maxInFlight > 1) fail('/api/load ยิงซ้อน ' + S.maxInFlight + ' ลูกพร้อมกัน');
else ok('/api/load ช้า · ไม่ยิงซ้อน (สูงสุด ' + S.maxInFlight + ' ลูก)');
if (S.lastLoadVer < want) fail('สุดท้ายไม่ได้เวอร์ชันล่าสุด · ได้ ' + S.lastLoadVer + ' ต้องการ ' + want);
else ok('สุดท้ายตามทันเวอร์ชันล่าสุด (' + want + ')');
S.loadDelay = 0;

/* ══ 5 · สายเปิดค้างแต่เงียบ · ต้องถูกตัดแล้วต่อใหม่ ══ */
if (process.env.SKIP_SLOW) console.log('  ! SKIP_SLOW · ข้ามข้อ 5');
else {
  await sleep(1500);
  S.hb = false;                                     /* สายยังเปิด แต่ไม่มีอะไรมาอีกเลย */
  const o5 = S.sseOpens, t0 = Date.now();
  while (Date.now() - t0 < 95000 && S.sseOpens === o5) await sleep(500);
  const dt = Date.now() - t0;
  if (S.sseOpens === o5) fail('สายเงียบ 95 วิ · ไม่มีใครตัดแล้วต่อใหม่');
  else ok('สายเงียบ · ตัดแล้วต่อใหม่เองใน ' + Math.round(dt/1000) + ' วิ');
  S.hb = true;
}

await browser.close(); srv.close();
console.log('\nพัง ' + bad);
process.exit(bad ? 1 : 0);
