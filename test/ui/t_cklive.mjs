// §ckLive2 · หน้าเช็คอินหน้าท่า · สองเครื่องทำพร้อมกันต้องเห็นของกันเองเร็ว
//
// ที่มา (2026-09-22) · "A กดเช็คอิน หน้าจอ B จะอัพเดทอีกใน 10 วินาที ซึ่งนานไป
//   หรือบางที ถ้าอีกหน้าจอจับเม้าอยู่ยิ่งไม่อัพเดท"
//   10 วิ คือคาบของ poll /api/version ซึ่งเป็นตัวสำรอง · ทางหลักคือ SSE ที่ควรถึงใน ~1 วิ
//   ได้ 10 วิพอดีแปลว่า SSE ของเครื่องนั้นตายแล้ว และไม่มีใครปลุกมันอีกเลยทั้งกะ
//
// ⚠ เทสนี้ยกเซิร์ฟเวอร์ปลอมของตัวเอง ไม่ใช้ _harness.mjs
//   ฮาร์เนสตัวนั้นเสิร์ฟไฟล์อย่างเดียว · /api/me ล้ม → ชั้น sync return ออกตั้งแต่ต้น
//   (ตั้งใจไว้สำหรับ dev ที่ไม่มี backend) แปลว่าตัวจับเวลา ตัว SSE และ _laBusy
//   ไม่เคยถูกสร้างขึ้นมาเลย · จะทดสอบเรื่องนี้ได้ต้องมีของจริงให้มันคุยด้วย
//
// กันหกอย่าง
//   1 หน้าเช็คอินเปิดอยู่ · เวอร์ชันขยับ ต้องเห็นภายใน ~2 วิ แม้ SSE เงียบสนิท
//   2 SSE ส่งมา ต้องเห็นเร็วกว่านั้นอีก (ไม่ต้องรอคาบ poll)
//   3 SSE ตาย ต้องมีคนปลุก · ไม่ใช่ปล่อยช้าไปทั้งกะ
//   4 กำลังเลื่อนจอ/แตะจออยู่ ก็ยังต้องอัพเดท
//   5 ลิ้นชักเปิดค้างอยู่ ห้ามถูกวาดทับ (ของที่พิมพ์ค้างต้องไม่หาย)
//   6 ออกจากหน้านี้แล้ว ต้องเลิกถามถี่ · ไม่ใช่ยิงทุก 2 วิทั้งวันทุกหน้า
//   7 หน้าเช็คอินรถก็ต้องเร็วเท่าหน้าท่า · และต้องดึง "วันของหน้าตัวเอง" (§ckVan)
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
      J(200, { ok:true, version:++S.version }); });
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

/* ชั้น sync ต้องตื่นจริง ไม่ใช่ bail แบบ dev ที่ไม่มี backend */
const wired = await page.evaluate(() => ({
  sse: !!window.__laSSE,
  soft: typeof window._laSoftRefresh === 'function'
}));
if (!wired.soft) fail('ชั้น sync ไม่ทำงานในเทส · ที่เหลือวัดอะไรไม่ได้');
else ok('ชั้น sync ตื่นแล้ว' + (wired.sse ? ' · SSE ต่อแล้ว' : ' · ยังไม่มี SSE') + ' · โหลดไปแล้ว ' + S.loads + ' ครั้ง');

await page.evaluate(() => { const el = document.querySelector('.nav-item[data-view="piercheckin"]'); if (el) nav(el); });
await page.waitForTimeout(900);
const onPage = await page.evaluate(() => {
  const a = document.querySelector('.nav-item.active');
  return a && a.dataset ? a.dataset.view : '';
});
if (onPage !== 'piercheckin') fail('เปิดหน้าเช็คอินหน้าท่าไม่ได้ · อยู่ที่ ' + onPage);
else ok('อยู่บนหน้าเช็คอินหน้าท่า');

/* "ไคลเอนต์รู้ตัวแล้ว" วัดจากฝั่งเซิร์ฟเวอร์ · มันจะมาดึง /api/load เมื่อเห็นว่าเวอร์ชันขยับ
   VER อยู่ใน closure ของชั้น sync อ่านจากหน้าไม่ได้ และไม่ควรเปิดออกมาแค่เพื่อเทส */
function pulls(){ return S.loads + S.ckHits; }
async function waitLoad(limitMs){
  const base = pulls(), t0 = Date.now();
  while (Date.now() - t0 < limitMs){
    if (pulls() > base) return Date.now() - t0;
    await sleep(80);
  }
  return -1;
}
/* เฉพาะก้อนเต็ม · ใช้ตอนต้องพิสูจน์ว่า "ถอยไปทางเดิม" จริง */
async function waitFull(limitMs){
  const base = S.loads, t0 = Date.now();
  while (Date.now() - t0 < limitMs){
    if (S.loads > base) return Date.now() - t0;
    await sleep(80);
  }
  return -1;
}

/* ══ 1 · SSE เงียบสนิท · ต้องยังเห็นภายใน ~2 วิ ═══════════════════════════ */
await page.evaluate(() => { try{ if(window.__laSSE) window.__laSSE.close(); window.__laSSE=null; }catch(_){} });
S.sse.forEach(r => { try{ r.end(); }catch(_){} }); S.sse.clear();
S.sseRefuse = true;                       /* ต่อใหม่ไม่ได้ · จำลอง session สะดุดแล้วตายถาวร */
await sleep(300);
bump();                                   /* เครื่อง A เซฟ · ไม่ push ให้เลย */
const t1 = await waitLoad(4000);
if (t1 < 0) fail('SSE เงียบ · หน้าเช็คอินไม่เห็นของใหม่เลยใน 4 วิ');
else if (t1 > 2600) fail('SSE เงียบ · เห็นของใหม่ช้า ' + t1 + 'ms (ควร ≤ ~2 วิ)');
else ok('SSE เงียบสนิท · หน้าเช็คอินยังเห็นของใหม่ใน ' + t1 + 'ms');

/* ══ 2 · SSE ใช้ได้ · ต้องเร็วกว่าคาบ poll ════════════════════════════════ */
S.sseRefuse = false;
await page.evaluate(() => { window.dispatchEvent(new Event('online')); });   /* ทางที่ผู้ใช้เจอจริง · เน็ตกลับมา */
await sleep(900);
const hadSSE = S.sse.size > 0;
if (!hadSSE) fail('ต่อ SSE ใหม่ไม่ได้ · ข้อถัดไปวัดไม่ได้');
else {
  push();
  const t2 = await waitLoad(3000);
  if (t2 < 0) fail('SSE ส่งมาแล้วแต่หน้าไม่ขยับ');
  else if (t2 > 1500) fail('SSE ส่งมาแล้วยังช้า ' + t2 + 'ms');
  else ok('SSE ส่งมา · เห็นใน ' + t2 + 'ms');
}

/* == 3a . กลับมาดูจอ ต้องต่อ SSE ใหม่ทันที =============================
   §ckLive2 . แยกจาก 3b โดยตั้งใจ . รวมเป็นข้อเดียวเมื่อไร
   ทางหนึ่งพังอีกทางจะคลุมให้ แล้วเทสผ่านทั้งที่เหลือทางเดียว */
async function killSSE(){
  S.sse.forEach(r => { try{ r.end(); }catch(_){} }); S.sse.clear();
  await page.evaluate(() => { try{ if(window.__laSSE) window.__laSSE.close(); }catch(_){} });
  await sleep(200);
}
async function waitOpen(from, limitMs){
  const t0 = Date.now();
  while (Date.now() - t0 < limitMs){ if (S.sseOpens > from) return Date.now() - t0; await sleep(120); }
  return -1;
}
let opens0 = S.sseOpens;
await killSSE();
await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
const r3a = await waitOpen(opens0, 2500);
if (r3a < 0) fail('กลับมาดูจอแล้วไม่ต่อ SSE ใหม่');
else ok('กลับมาดูจอ . ต่อ SSE ใหม่ใน ' + r3a + 'ms');

/* == 3b . ไม่มีใครแตะอะไรเลย ตัวเฝ้าต้องปลุกเอง ===================== */
opens0 = S.sseOpens;
await killSSE();
const r3b = await waitOpen(opens0, 18000);
if (r3b < 0) fail('SSE ตายเงียบ ๆ แล้วไม่มีตัวเฝ้าปลุก . จะช้าไปทั้งกะ');
else ok('ไม่มีใครแตะอะไร . ตัวเฝ้าปลุก SSE เองใน ' + Math.round(r3b/1000) + ' วิ');

/* == 4 . มือยังอยู่บนจอ ก็ต้องอัพเดท ====================================
   ตัด SSE ทิ้งตลอดข้อนี้ จะได้วัดทางสำรองจริง ๆ ไม่ใช่บังเอิญที่ SSE บังเอิญต่อกลับมาเอง */
S.sseRefuse = true;
await killSSE();
const stir = setInterval(() => {
  page.evaluate(() => {
    document.dispatchEvent(new WheelEvent('wheel', { bubbles:true, deltaY:60 }));
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles:true }));
  }).catch(() => {});
}, 200);
bump();
const t4 = await waitLoad(6000);
clearInterval(stir);
S.sseRefuse = false;
if (t4 < 0) fail('มือยังอยู่บนจอ . ของใหม่ไม่เข้าเลยใน 6 วิ (อาการที่ผู้ใช้เจอ)');
else if (t4 > 3400) fail('มือยังอยู่บนจอ . ของใหม่เข้าช้า ' + t4 + 'ms (SSE ตาย + แตะจอรัว = กรณีแย่สุด ~3.2 วิ)');
else ok('SSE ตาย + เลื่อนจอและแตะจอรัว ๆ . ของใหม่ยังเข้าใน ' + t4 + 'ms');

/* ══ 5 · ลิ้นชักเปิดค้าง ห้ามโดนวาดทับ ═══════════════════════════════════ */
await page.evaluate(() => {
  const d = document.createElement('div'); d.id = 'pck-drawer';
  d.innerHTML = '<textarea id="pck-note-tx">พิมพ์ค้างไว้</textarea>';
  document.body.appendChild(d);
});
const loads0 = pulls();
bump();
await sleep(3000);
const kept = await page.evaluate(() => {
  const d = document.getElementById('pck-drawer');
  const t = document.getElementById('pck-note-tx');
  return { open: !!d, text: t ? t.value : '' };
});
if (!kept.open || kept.text !== 'พิมพ์ค้างไว้') fail('ลิ้นชักเปิดค้างอยู่แต่โดนวาดทับ · ของที่พิมพ์หาย');
else if (pulls() > loads0) fail('ลิ้นชักเปิดอยู่แต่ยังดึงข้อมูลมาทับ ' + (pulls() - loads0) + ' ครั้ง');
else ok('ลิ้นชักเปิดค้าง · ไม่ถูกวาดทับ และยังไม่ดึงข้อมูลมาทับ');
await page.evaluate(() => { const d = document.getElementById('pck-drawer'); if (d) d.remove(); });
const t5 = await waitLoad(5000);          /* ปิดลิ้นชักแล้วต้องตามทันเอง ไม่ใช่ค้างตลอดไป */
if (t5 < 0) fail('ปิดลิ้นชักแล้วยังไม่ยอมตามข้อมูล');
else ok('ปิดลิ้นชักแล้วตามข้อมูลเองใน ' + t5 + 'ms');

/* ══ 6 · ออกจากหน้านี้แล้วต้องเลิกถามถี่ ═════════════════════════════════ */
await page.evaluate(() => { const el = document.querySelector('.nav-item[data-view="booking"]')
  || document.querySelector('.nav-item[data-view="dashboard"]'); if (el) nav(el); });
await sleep(900);
const h0 = S.verHits;
await sleep(8000);
const hits = S.verHits - h0;
if (hits > 2) fail('ออกจากหน้าเช็คอินแล้วยังถามถี่ · ' + hits + ' ครั้งใน 8 วิ (คาบปกติ 10 วิ ควรได้ไม่เกิน 1)');
else ok('ออกจากหน้าเช็คอินแล้วกลับไปถามตามคาบปกติ · ' + hits + ' ครั้งใน 8 วิ');

/* == 7 . ดึงเฉพาะของวันนั้น ไม่ใช่ก้อนทั้งระบบ ============================
   หัวใจของชั้นสอง . อีกเครื่องเช็คอิน เครื่องนี้ต้องเห็น โดยไม่ต้องโหลด 20MB */
await page.evaluate(() => { const el = document.querySelector('.nav-item[data-view="piercheckin"]'); if (el) nav(el); });
await sleep(1200);
let saves0 = S.saves;   /* นับการเซฟตั้งแต่ก่อนแปะของคนอื่น · การดันกลับเกิดทันทีที่แปะ */
const day = await page.evaluate(() => (typeof _pckDate === 'string' ? _pckDate : ''));
const pick = S.blob.sb_bookings.find(b => (b.trips||[]).some(x => x && x.date === day));
if (!day || !pick) console.log('  ! \u0e27\u0e31\u0e19\u0e17\u0e35\u0e48\u0e40\u0e1b\u0e34\u0e14\u0e2d\u0e22\u0e39\u0e48\u0e44\u0e21\u0e48\u0e21\u0e35\u0e43\u0e1a\u0e08\u0e2d\u0e07 . \u0e02\u0e49\u0e32\u0e21\u0e02\u0e49\u0e2d\u0e14\u0e36\u0e07\u0e41\u0e04\u0e1a');
else {
  const loads0 = S.loads, ck0 = S.ckHits;
  saves0 = S.saves;
  /* \u0e2d\u0e35\u0e01\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e40\u0e0a\u0e47\u0e04\u0e2d\u0e34\u0e19\u0e43\u0e1a\u0e19\u0e35\u0e49 */
  pick.ops = pick.ops || {};
  pick.ops.pierCheckin = { at:new Date().toISOString(), by:'\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07 A', actualPax:1, noShow:0, expected:1, events:[] };
  push();
  await sleep(2500);
  const ckUsed = S.ckHits - ck0, fullUsed = S.loads - loads0;
  const got = await page.evaluate(id => {
    const b = (SB_BOOKINGS||[]).find(x => x && x.id === id);
    return !!(b && b.ops && b.ops.pierCheckin && b.ops.pierCheckin.at);
  }, pick.id);
  if (!got) fail('\u0e14\u0e36\u0e07\u0e41\u0e04\u0e1a\u0e41\u0e25\u0e49\u0e27\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e44\u0e21\u0e48\u0e40\u0e02\u0e49\u0e32\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07');
  else if (!ckUsed) fail('\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e43\u0e0a\u0e49 /api/ck \u0e40\u0e25\u0e22');
  else if (fullUsed) fail('\u0e43\u0e0a\u0e49 /api/ck \u0e41\u0e25\u0e49\u0e27\u0e22\u0e31\u0e07\u0e14\u0e36\u0e07\u0e01\u0e49\u0e2d\u0e19\u0e40\u0e15\u0e47\u0e21\u0e0b\u0e49\u0e33\u0e2d\u0e35\u0e01 ' + fullUsed + ' \u0e04\u0e23\u0e31\u0e49\u0e07');
  else ok('\u0e40\u0e2b\u0e47\u0e19\u0e01\u0e32\u0e23\u0e40\u0e0a\u0e47\u0e04\u0e2d\u0e34\u0e19\u0e02\u0e2d\u0e07\u0e2d\u0e35\u0e01\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07 . \u0e14\u0e36\u0e07\u0e41\u0e04\u0e1a ' + ckUsed + ' \u0e04\u0e23\u0e31\u0e49\u0e07 (' + Math.round(S.ckBytes/1024) + 'KB) \u0e44\u0e21\u0e48\u0e41\u0e15\u0e30\u0e01\u0e49\u0e2d\u0e19\u0e40\u0e15\u0e47\u0e21\u0e40\u0e25\u0e22');
}

/* == 8 . \u0e0a\u0e38\u0e14 id \u0e02\u0e2d\u0e07\u0e27\u0e31\u0e19\u0e44\u0e21\u0e48\u0e15\u0e23\u0e07 \u0e15\u0e49\u0e2d\u0e07\u0e16\u0e2d\u0e22\u0e44\u0e1b\u0e14\u0e36\u0e07\u0e40\u0e15\u0e47\u0e21 ==================== */
{
  const loads0 = S.loads;
  S.ckExtra = true;                        /* \u0e40\u0e0b\u0e34\u0e23\u0e4c\u0e1f\u0e40\u0e27\u0e2d\u0e23\u0e4c\u0e21\u0e35\u0e43\u0e1a\u0e17\u0e35\u0e48\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e19\u0e35\u0e49\u0e44\u0e21\u0e48\u0e23\u0e39\u0e49\u0e08\u0e31\u0e01 */
  push();
  const t8 = await waitFull(6000);
  S.ckExtra = false;
  if (t8 < 0) fail('\u0e0a\u0e38\u0e14 id \u0e44\u0e21\u0e48\u0e15\u0e23\u0e07\u0e41\u0e25\u0e49\u0e27\u0e44\u0e21\u0e48\u0e16\u0e2d\u0e22\u0e44\u0e1b\u0e14\u0e36\u0e07\u0e40\u0e15\u0e47\u0e21 . \u0e43\u0e1a\u0e17\u0e35\u0e48\u0e40\u0e1e\u0e34\u0e48\u0e07\u0e40\u0e01\u0e34\u0e14\u0e08\u0e30\u0e44\u0e21\u0e48\u0e42\u0e1c\u0e25\u0e48\u0e40\u0e25\u0e22');
  else ok('\u0e0a\u0e38\u0e14 id \u0e02\u0e2d\u0e07\u0e27\u0e31\u0e19\u0e44\u0e21\u0e48\u0e15\u0e23\u0e07 . \u0e16\u0e2d\u0e22\u0e44\u0e1b\u0e14\u0e36\u0e07\u0e01\u0e49\u0e2d\u0e19\u0e40\u0e15\u0e47\u0e21\u0e43\u0e19 ' + t8 + 'ms');
}

/* == 9 . \u0e40\u0e0b\u0e34\u0e23\u0e4c\u0e1f\u0e40\u0e27\u0e2d\u0e23\u0e4c\u0e44\u0e21\u0e48\u0e23\u0e39\u0e49\u0e08\u0e31\u0e01 /api/ck \u0e15\u0e49\u0e2d\u0e07\u0e17\u0e33\u0e07\u0e32\u0e19\u0e15\u0e48\u0e2d\u0e44\u0e14\u0e49 ======== */
{
  const loads0 = S.loads;
  S.ckDown = true;
  push();
  const t9 = await waitFull(6000);
  S.ckDown = false;
  if (t9 < 0) fail('/api/ck \u0e43\u0e0a\u0e49\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e41\u0e25\u0e49\u0e27\u0e2b\u0e19\u0e49\u0e32\u0e04\u0e49\u0e32\u0e07\u0e44\u0e1b\u0e40\u0e25\u0e22 . \u0e40\u0e14\u0e1b\u0e25\u0e2d\u0e22\u0e44\u0e04\u0e25\u0e40\u0e2d\u0e19\u0e15\u0e4c\u0e01\u0e48\u0e2d\u0e19\u0e40\u0e0b\u0e34\u0e23\u0e4c\u0e1f\u0e40\u0e27\u0e2d\u0e23\u0e4c\u0e08\u0e30\u0e1e\u0e31\u0e07');
  else ok('/api/ck \u0e43\u0e0a\u0e49\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49 . \u0e16\u0e2d\u0e22\u0e44\u0e1b\u0e17\u0e32\u0e07\u0e40\u0e14\u0e34\u0e21\u0e43\u0e19 ' + t9 + 'ms');
}

/* == 10 . \u0e14\u0e36\u0e07\u0e41\u0e04\u0e1a\u0e41\u0e25\u0e49\u0e27\u0e2b\u0e49\u0e32\u0e21\u0e14\u0e31\u0e19\u0e02\u0e2d\u0e07\u0e04\u0e19\u0e2d\u0e37\u0e48\u0e19\u0e01\u0e25\u0e31\u0e1a\u0e02\u0e36\u0e49\u0e19\u0e44\u0e1b\u0e17\u0e31\u0e1a ===========
   \u0e02\u0e49\u0e2d\u0e17\u0e35\u0e48\u0e2d\u0e31\u0e19\u0e15\u0e23\u0e32\u0e22\u0e17\u0e35\u0e48\u0e2a\u0e38\u0e14\u0e02\u0e2d\u0e07\u0e17\u0e32\u0e07\u0e41\u0e04\u0e1a . BASE \u0e04\u0e37\u0e2d\u0e20\u0e32\u0e1e\u0e02\u0e2d\u0e07\u0e40\u0e0b\u0e34\u0e23\u0e4c\u0e1f\u0e40\u0e27\u0e2d\u0e23\u0e4c\u0e17\u0e35\u0e48\u0e43\u0e0a\u0e49\u0e04\u0e34\u0e14 diff
   \u0e16\u0e49\u0e32\u0e41\u0e1b\u0e30\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e43\u0e19\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e42\u0e14\u0e22\u0e44\u0e21\u0e48\u0e41\u0e1b\u0e30 BASE \u0e01\u0e32\u0e23\u0e40\u0e0b\u0e1f\u0e04\u0e23\u0e31\u0e49\u0e07\u0e16\u0e31\u0e14\u0e44\u0e1b\u0e08\u0e30\u0e40\u0e2b\u0e47\u0e19
   \u0e02\u0e2d\u0e07\u0e04\u0e19\u0e2d\u0e37\u0e48\u0e19\u0e40\u0e1b\u0e47\u0e19 "\u0e01\u0e32\u0e23\u0e41\u0e01\u0e49\u0e02\u0e2d\u0e07\u0e40\u0e23\u0e32" \u0e41\u0e25\u0e49\u0e27\u0e14\u0e31\u0e19\u0e04\u0e48\u0e32\u0e40\u0e01\u0e48\u0e32\u0e01\u0e25\u0e31\u0e1a\u0e02\u0e36\u0e49\u0e19\u0e44\u0e1b\u0e17\u0e31\u0e1a\u0e02\u0e2d\u0e07\u0e08\u0e23\u0e34\u0e07 */
{
  await page.evaluate(() => { try{ laBlobSave(); }catch(_){} });
  await sleep(2600);
  if (S.saves > saves0) fail('\u0e14\u0e36\u0e07\u0e41\u0e04\u0e1a\u0e41\u0e25\u0e49\u0e27\u0e40\u0e0b\u0e1f\u0e04\u0e23\u0e31\u0e49\u0e07\u0e16\u0e31\u0e14\u0e44\u0e1b\u0e14\u0e31\u0e19\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e01\u0e25\u0e31\u0e1a\u0e02\u0e36\u0e49\u0e19\u0e44\u0e1b ' + (S.saves - saves0) + ' \u0e04\u0e23\u0e31\u0e49\u0e07 . BASE \u0e44\u0e21\u0e48\u0e16\u0e39\u0e01\u0e2d\u0e31\u0e1b\u0e40\u0e14\u0e17');
  else ok('\u0e14\u0e36\u0e07\u0e41\u0e04\u0e1a\u0e41\u0e25\u0e49\u0e27\u0e40\u0e0b\u0e1f . diff \u0e40\u0e1b\u0e47\u0e19\u0e28\u0e39\u0e19\u0e22\u0e4c \u0e44\u0e21\u0e48\u0e14\u0e31\u0e19\u0e02\u0e2d\u0e07\u0e04\u0e19\u0e2d\u0e37\u0e48\u0e19\u0e01\u0e25\u0e31\u0e1a\u0e02\u0e36\u0e49\u0e19\u0e44\u0e1b');
}

/* == 11 . \u0e01\u0e14\u0e40\u0e0a\u0e47\u0e04\u0e2d\u0e34\u0e19\u0e41\u0e25\u0e49\u0e27\u0e15\u0e34\u0e4a\u0e01\u0e15\u0e49\u0e2d\u0e07\u0e44\u0e21\u0e48\u0e2b\u0e32\u0e22 ==============================
   \u00a7ckStale . "\u0e01\u0e14\u0e02\u0e36\u0e49\u0e19\u0e40\u0e0a\u0e47\u0e04\u0e2d\u0e34\u0e19 \u0e41\u0e25\u0e49\u0e27\u0e01\u0e47\u0e2b\u0e32\u0e22 \u0e41\u0e25\u0e49\u0e27\u0e01\u0e47\u0e01\u0e25\u0e31\u0e1a\u0e21\u0e32"
   \u0e40\u0e23\u0e35\u0e22\u0e07\u0e43\u0e2b\u0e49\u0e04\u0e33\u0e02\u0e2d\u0e2d\u0e2d\u0e01\u0e40\u0e14\u0e34\u0e19\u0e17\u0e32\u0e07\u0e01\u0e48\u0e2d\u0e19\u0e01\u0e14 \u0e41\u0e25\u0e30\u0e43\u0e2b\u0e49\u0e04\u0e33\u0e15\u0e2d\u0e1a\u0e21\u0e32\u0e16\u0e36\u0e07\u0e2b\u0e25\u0e31\u0e07\u0e40\u0e0b\u0e1f\u0e40\u0e2a\u0e23\u0e47\u0e08 */
await page.evaluate(() => { const el = document.querySelector('.nav-item[data-view="piercheckin"]'); if (el) nav(el); });
await sleep(1200);
const tg = await page.evaluate(() => {
  const b = [].slice.call(document.querySelectorAll('#piercheckin-host .pck-ok')).find(x => /off/.test(x.className));
  if (!b) return null;
  const m = /ckToggle\('([^']+)','([^']+)','([^']+)'/.exec(b.getAttribute('onclick') || '');
  return m ? { id:m[1], date:m[2], kind:m[3] } : null;
});
if (!tg) console.log('  ! \u0e27\u0e31\u0e19\u0e19\u0e35\u0e49\u0e44\u0e21\u0e48\u0e21\u0e35\u0e43\u0e1a\u0e17\u0e35\u0e48\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e40\u0e0a\u0e47\u0e04\u0e2d\u0e34\u0e19 . \u0e02\u0e49\u0e32\u0e21\u0e02\u0e49\u0e2d\u0e19\u0e35\u0e49');
else {
  S.ckDelay = 2500;                       /* \u0e40\u0e19\u0e47\u0e15\u0e2b\u0e19\u0e49\u0e32\u0e17\u0e48\u0e32\u0e0a\u0e49\u0e32 . \u0e04\u0e33\u0e15\u0e2d\u0e1a\u0e43\u0e0a\u0e49\u0e40\u0e27\u0e25\u0e32\u0e2b\u0e25\u0e32\u0e22\u0e27\u0e34\u0e19\u0e32\u0e17\u0e35 */
  S.applySave = () => { const rec = (S.blob.sb_bookings||[]).find(b => b && b.id === tg.id);
    if (rec){ rec.ops = rec.ops || {}; rec.ops.pierCheckin =
      { at:new Date().toISOString(), by:'PIER', actualPax:1, noShow:0, expected:1, events:[] }; } };
  push();                                 /* \u0e40\u0e27\u0e2d\u0e23\u0e4c\u0e0a\u0e31\u0e19\u0e43\u0e2b\u0e21\u0e48\u0e21\u0e32\u0e01\u0e48\u0e2d\u0e19 . \u0e04\u0e33\u0e02\u0e2d\u0e40\u0e23\u0e34\u0e48\u0e21\u0e40\u0e14\u0e34\u0e19\u0e17\u0e32\u0e07 */
  await sleep(300);
  await page.evaluate(t => {
    const b = [].slice.call(document.querySelectorAll('#piercheckin-host .pck-ok'))
      .find(x => (x.getAttribute('onclick')||'').indexOf("'"+t.id+"'") >= 0);
    if (b) b.click();
  }, tg);
  const seen = [];
  for (let i = 0; i < 55; i++){
    await sleep(100);
    seen.push(await page.evaluate(t => {
      const b = (SB_BOOKINGS||[]).find(x => x && x.id === t.id);
      const ck = (b && typeof ckRead === 'function') ? ckRead(b, t.date, t.kind) : null;
      return !!(ck && ck.at);
    }, tg));
  }
  S.ckDelay = 0;
  const first = seen.indexOf(true);
  const lost  = first >= 0 && seen.slice(first).some(x => !x);
  if (first < 0) fail('\u0e01\u0e14\u0e40\u0e0a\u0e47\u0e04\u0e2d\u0e34\u0e19\u0e41\u0e25\u0e49\u0e27\u0e15\u0e34\u0e4a\u0e01\u0e44\u0e21\u0e48\u0e02\u0e36\u0e49\u0e19\u0e40\u0e25\u0e22');
  else if (lost) fail('\u0e15\u0e34\u0e4a\u0e01\u0e41\u0e25\u0e49\u0e27\u0e2b\u0e32\u0e22 . \u0e04\u0e33\u0e15\u0e2d\u0e1a\u0e17\u0e35\u0e48\u0e16\u0e48\u0e32\u0e22\u0e44\u0e27\u0e49\u0e01\u0e48\u0e2d\u0e19\u0e01\u0e14\u0e21\u0e32\u0e17\u0e31\u0e1a\u0e02\u0e2d\u0e07\u0e17\u0e35\u0e48\u0e40\u0e1e\u0e34\u0e48\u0e07\u0e01\u0e14 (\u0e2d\u0e32\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e40\u0e08\u0e2d)');
  else ok('\u0e40\u0e19\u0e47\u0e15\u0e0a\u0e49\u0e32 2.5 \u0e27\u0e34 . \u0e01\u0e14\u0e40\u0e0a\u0e47\u0e04\u0e2d\u0e34\u0e19\u0e41\u0e25\u0e49\u0e27\u0e15\u0e34\u0e4a\u0e01\u0e2d\u0e22\u0e39\u0e48\u0e15\u0e25\u0e2d\u0e14 \u0e44\u0e21\u0e48\u0e2b\u0e32\u0e22\u0e01\u0e25\u0e32\u0e07\u0e04\u0e31\u0e19');
}

/* == 12 . หน้าเช็คอินรถต้องเห็นของอีกเครื่องเร็วเท่าหน้าท่า ==================
   §ckVan . "Transfer02 ทดสอบเช็คอิน แต่ของเรามาขึ้นช้ามาก"
   ทางแคบถูกเปิดให้ทั้งสองหน้า แต่ตัวที่วาดใหม่คือ renderPierCheckin() ตัวเดียว
   อยู่หน้าเช็คอินรถ . ข้อมูลเข้าเครื่องแล้ว แต่หน้าที่วาดคือหน้าท่าซึ่งซ่อนอยู่
   แล้วยังคืน true . ชั้น sync ปักธงว่าตามทันแล้ว ไม่ดึงซ้ำอีก
   ตารางรถบนจอจึงค้างจนกว่าตัววาดทุก 60 วิจะมาถึง
   ⚠ วัดจากเลข "ขึ้นรถ N/M" บนหัวคันซึ่งอ่านจาก DOM . ไม่ได้ถามฟังก์ชันของหน้าเอง
   ⚠ วันที่ใช้ทดสอบเลือกจากข้อมูลดิบเอง ไม่ใช่วันนี้ . ชุดข้อมูลแต่ละชุดมีวันไม่เท่ากัน */
S.applySave = null;
S.ckDelay = 0;

/* หาวันที่มีใบ "จัดรถแล้ว แต่ยังไม่เช็คอินรถ" . คำนวณจาก S.blob ตรง ๆ */
const vpick = (() => {
  const by = {};
  (S.blob.sb_bookings||[]).forEach(b => {
    const o = b && b.ops;
    if (!o || !o.vanId) return;                       /* เอาเฉพาะใบที่ ops แบน . เขียนทับง่าย */
    if (o.vanCheckin && o.vanCheckin.at) return;      /* เช็คอินไปแล้ว ไม่ทำให้เลขขยับ */
    (b.trips||[]).forEach(t => { if (t && t.date){ (by[t.date] = by[t.date] || []).push(b); } });
  });
  const d = Object.keys(by).sort((a, z) => by[z].length - by[a].length)[0];
  return d ? { date:d, list:by[d] } : null;
})();

await page.evaluate(() => { const el = document.querySelector('.nav-item[data-view="vancheckin"]'); if (el) nav(el); });
await sleep(1200);
const vanOn = await page.evaluate(() => {
  const a = document.querySelector('.nav-item.active');
  return a && a.dataset ? a.dataset.view : '';
});
if (vanOn !== 'vancheckin') fail('เปิดหน้าเช็คอินรถไม่ได้ . อยู่ที่ ' + vanOn);
else if (!vpick) console.log('  ! ชุดข้อมูลนี้ไม่มีใบที่จัดรถแล้วและยังไม่เช็คอินรถ . ข้ามข้อ 12');
else {
  await page.evaluate(d => { try{ vckPickDay(d); }catch(_){} }, vpick.date);
  await sleep(1200);
  const vday = await page.evaluate(() => (typeof _vanCkDate === 'string' ? _vanCkDate : ''));
  const pday = await page.evaluate(() => (typeof _pckDate === 'string' ? _pckDate : ''));
  if (vday !== vpick.date) fail('เปิดวัน ' + vpick.date + ' บนหน้ารถไม่ได้ . ได้ ' + vday);
  else {
    ok('อยู่หน้าเช็คอินรถ วันที่ ' + vday + ' (หน้าท่าอยู่วัน ' + pday + ')');
    /* นับจาก DOM . ผลรวมของเลขซ้ายในทุก "ขึ้นรถ N/M" บนหัวคัน */
    const vanChecked = () => page.evaluate(() => {
      const h = document.getElementById('vancheckin-host');
      if (!h) return -1;
      let n = 0, m;
      const re = /\u0e02\u0e36\u0e49\u0e19\u0e23\u0e16 (\d+)\/(\d+)/g;
      const t = h.textContent || '';
      while ((m = re.exec(t))) n += Number(m[1]);
      return n;
    });
    const before = await vanChecked();
    const target = vpick.list[0];
    if (before < 0) fail('ไม่พบกล่องหน้าเช็คอินรถ');
    else {
      const ck0 = S.ckHits, loads0 = S.loads;
      /* อีกเครื่อง (Transfer02) กดขึ้นรถให้ใบนี้ */
      target.ops.vanCheckin = { at:new Date().toISOString(), by:'Transfer02',
        actualPax:1, noShow:0, expected:1, events:[], reasonCode:'', reasonNote:'', reasonAt:'' };
      push();
      let t12 = -1, after = before;
      for (let i = 0; i < 30; i++){
        await sleep(100);
        after = await vanChecked();
        if (after > before){ t12 = (i + 1) * 100; break; }
      }
      const ckUsed = S.ckHits - ck0, fullUsed = S.loads - loads0;
      if (t12 < 0) fail('อีกเครื่องกดขึ้นรถแล้ว . ตารางรถบนจอไม่ขยับเลยใน 3 วิ (อาการที่ผู้ใช้เจอ)');
      else if (t12 > 2600) fail('ตารางรถขยับช้า ' + t12 + 'ms (ควร ≤ ~2 วิ)');
      else ok('อีกเครื่องกดขึ้นรถ . ตารางรถบนจอขึ้นเอง ' + before + '→' + after + ' ใน ' + t12
              + 'ms . ดึงแคบ ' + ckUsed + ' ครั้ง ก้อนเต็ม ' + fullUsed + ' ครั้ง');
    }

    /* == 12b . ต้องดึง "วันของหน้ารถ" ไม่ใช่วันของหน้าท่า ==================
       ข้อนี้แยกจาก 12a โดยตั้งใจ . 12a ผ่านได้ด้วยทางถอย (ดึงก้อนเต็มแล้ววาดใหม่ทั้งหน้า)
       ซึ่งช้าและกินแบนด์วิดท์ . ข้อนี้จึงถามตรง ๆ ว่าไปขอวันไหนมา */
    S.lastCkDate = '';
    const ck1 = S.ckHits;
    push();
    let got = '';
    for (let i = 0; i < 30; i++){
      await sleep(100);
      if (S.ckHits > ck1){ got = S.lastCkDate; break; }
    }
    if (!got) fail('หน้ารถไม่ได้ใช้ทางแคบเลย . ตกไปดึงก้อนเต็มทุกครั้งที่มีคนเช็คอิน');
    else if (got !== vday) fail('อยู่หน้ารถวัน ' + vday + ' แต่ไปดึงวัน ' + got
            + ' (วันของหน้าท่า) . วันบนจอไม่เคยถูกดึงเลย');
    else ok('หน้ารถเปิดวัน ' + vday + ' . ดึงวันเดียวกัน ไม่ใช่วันของหน้าท่า (' + pday + ')');
  }
  await page.evaluate(() => { try{ vanCkToday(); }catch(_){} });
}

console.log(bad ? ('\nพัง ' + bad) : '\nพัง 0');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
