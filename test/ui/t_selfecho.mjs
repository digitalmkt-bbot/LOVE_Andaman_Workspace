// §selfEcho · your own save must not come back as "new data from someone else" and redraw your page
//
// Source (2026-10-11) · owner (screenshot of the "มีข้อมูลใหม่จากคนอื่น · โดย admin" box, logged in as admin):
//   "วันนี้เป็นอะไรไม่รู้ เด้งขึ้นรัวๆ"
//   The server answers the save, then broadcasts the new version on SSE. The SSE line can land BEFORE the
//   HTTP answer, while VER is still the old number, so the client files its own save as someone else's:
//   the banner pops up, and a few seconds later the whole page reloads and redraws. Every edit = one jump.
// Checks
//   1 own save, SSE echo first · no banner, no reload of the data
//   2 own save while someone else saved in between (server says behind) · still reloads (nothing missed)
//   3 someone else saves · still shows/reloads as before
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

/* ── เซิร์ฟเวอร์ปลอม · พูดภาษาเดียวกับของจริงเฉพาะเท่าที่ชั้น sync ใช้ ───── */
const S = {
  version: 1,
  data: fs.readFileSync(BLOB, 'utf8'),
  sse: new Set(),
  sseOpens: 0,          // นับจำนวนครั้งที่ไคลเอนต์มาเปิดสาย · ใช้พิสูจน์ว่ามีคนปลุก
  verHits: 0,           // นับจำนวนครั้งที่ถูกถามเวอร์ชัน · ใช้พิสูจน์ว่าหยุดถามเมื่อออกจากหน้า
  loads: 0,
  sseRefuse: false,     // true = ตอบ 401 ให้ EventSource (จำลอง session สะดุด)
  ckHits: 0, ckBytes: 0, ckDown: false, ckExtra: false,
  saves: 0, lastSave: '',
  ckDelay: 0,           // หน่วงคำตอบ · จำลองเน็ตหน้าท่าที่ช้าเป็นวินาที
  lastCkDate: '',       // วันที่ถูกขอมาล่าสุด · ใช้พิสูจน์ว่าถามวันของหน้าที่เปิดอยู่จริง
  blob: null            // ก้อนข้อมูลแบบ object · ใช้ตอบ /api/ck และแก้เพื่อจำลองว่าอีกเครื่องเช็คอิน
};
S.blob = JSON.parse(S.data);
S.applySave = null;
function bump(by){ S.version++; return { version:S.version, updated_by:by||'เครื่อง A' }; }
function push(by){ const m=bump(by); const t='data: '+JSON.stringify(m)+'\n\n';
  S.sse.forEach(r=>{ try{ r.write(t); }catch(_){} }); return m; }

const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const J = (code, obj) => { res.writeHead(code, {'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store'}); res.end(JSON.stringify(obj)); };
  if (u === '/api/me') return J(200, { username:'test', name:'ทดสอบ', role:'admin', canEdit:true });
  if (u === '/api/version'){ S.verHits++; return J(200, { version:S.version, updated_by:'เครื่อง A',
    updated_at:new Date().toISOString() }); }
  if (u === '/api/load'){ S.loads++;
    /* ถ่ายข้อมูล ณ ตอนคำขอมาถึง แล้วค่อยตอบช้า ๆ · นี่คือพฤติกรรมจริงของเน็ตช้า
       คำตอบที่ได้จึงเป็นภาพของ "ก่อนกด" ทั้งที่มาถึงหลังกด */
    const snap = { version:S.version, data:JSON.stringify(S.blob),
      updated_by:'เครื่อง A', updated_at:new Date().toISOString() };
    return setTimeout(()=>J(200, snap), S.ckDelay); }
  if (u === '/api/ck'){
    S.ckHits++;
    S.lastCkDate = new URLSearchParams(req.url.split('?')[1]||'').get('date')||'';
    if (S.ckDown) return J(501, { error:'ck off' });          /* จำลองเซิร์ฟเวอร์รุ่นเก่า/โหมด blob */
    const date = new URLSearchParams(req.url.split('?')[1]||'').get('date')||'';
    const recs = (S.blob.sb_bookings||[]).filter(b => (b.trips||[]).some(x => x && x.date === date));
    if (S.ckExtra) recs.push({ id:'__ผี__', trips:[{ date, routeId:'x', pax:{} }] });  /* ชุด id ไม่ตรง */
    S.ckBytes += JSON.stringify(recs).length;
    const snap = { date, version:S.version, bookings:JSON.parse(JSON.stringify(recs)) };
    return setTimeout(()=>J(200, snap), S.ckDelay);
  }
  if (u === '/api/events'){
    S.sseOpens++;
    if (S.sseRefuse){ res.writeHead(401); return res.end(); }
    res.writeHead(200, {'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache',
      'connection':'keep-alive'});
    res.write('retry: 1000\n\n');
    S.sse.add(res);
    req.on('close', () => S.sse.delete(res));
    return;
  }
  if (u === '/api/save' || u === '/api/v1/_batch'){
    S.saves++;
    let body = ''; req.on('data', c => body += c);
    return req.on('end', () => { S.lastSave = body;
      try{ if(S.applySave) S.applySave(); }catch(_){}    /* ของจริงเอา ops ลงฐาน · mock ทำเท่าที่เทสต้องใช้ */
      const v = ++S.version;
      /* §selfEcho · จำลองจังหวะจริง · เสียงสะท้อน SSE ของ "การเซฟของเราเอง" มาถึงก่อนคำตอบ HTTP */
      if (S.echoFirst){ const t='data: '+JSON.stringify({ version:v, updated_by:'test' })+'\n\n'; S.sse.forEach(r=>{ try{ r.write(t); }catch(_){} }); }
      setTimeout(() => J(200, { ok:true, version:v, behind:S.behind||0 }), S.echoFirst ? 250 : 0); });
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
/* §ckVan · เทสต้องไม่ออกเน็ตจริง · หน้านี้ดึงฟอนต์ Google กับ xlsx จาก CDN
   บนเครื่องที่ออกเน็ตไม่ได้ สองตัวนี้ค้าง → หน้าโหลดไม่จบสักที
   ตัดทิ้งไป · ทั้งสองอย่างไม่เกี่ยวกับสิ่งที่เทสนี้วัด และทำให้เทสขึ้นกับเน็ตของเครื่องที่รัน */
await ctx.route('**/*', r => {
  const u = r.request().url();
  return u.startsWith(`http://127.0.0.1:${port}/`) ? r.continue() : r.abort();
});
/* §ckVan · สาย SSE ที่เปิดค้างตลอดทำให้ goto รอจนหมดเวลา
   จึงรอแค่นาวิเกตติดหน้า · ด้านล่างมี waitForFunction รอของที่ต้องใช้จริงอยู่แล้ว */
await page.goto(`http://127.0.0.1:${port}/allotment_v2.html`, { waitUntil:'commit', timeout:60000 });
await page.waitForFunction(() => typeof window.nav === 'function'
  && document.querySelectorAll('.nav-item[data-view]').length > 0, null, { timeout:25000 });
await page.waitForTimeout(1200);


const wired = await page.evaluate(() => ({ sse: !!window.__laSSE, soft: typeof window._laSoftRefresh === 'function' }));
if (!wired.soft) { fail('sync layer did not start'); await browser.close(); srv.close(); process.exit(1); }
await page.evaluate(() => { const el = document.querySelector('.nav-item[data-view="booking"]'); if (el) nav(el); });
await page.waitForTimeout(1500);
const edit = (n) => page.evaluate(n => { const b = SB_BOOKINGS.find(x => x.status === 'confirmed'); b.notes = 'echo test ' + n; acctPersistBookings(); }, n);
const watch = async ms => { const l0 = S.loads + S.ckHits; let banner = false; const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(() => !!document.getElementById('la-refresh'))) banner = true; await sleep(100); }
  return { loads: S.loads + S.ckHits - l0, banner }; };

S.echoFirst = true; S.behind = 0;
const s0 = S.saves; await edit(1);
const r1 = await watch(5000);
if (S.saves > s0 && r1.loads === 0 && !r1.banner) ok('1 own save with the SSE echo first · no "new data" banner, no reload');
else fail('1 ' + JSON.stringify({ saves: S.saves - s0, ...r1 }));

S.behind = 1;
await edit(2);
const r2 = await watch(5000);
if (r2.loads >= 1) ok('2 server says we were behind · the other change is still fetched'); else fail('2 ' + JSON.stringify(r2));

S.echoFirst = false; S.behind = 0;
push('someone else');
const r3 = await watch(4000);
if (r3.loads >= 1) ok('3 someone else saved · page still picks it up'); else fail('3 ' + JSON.stringify(r3));

await browser.close(); srv.close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
