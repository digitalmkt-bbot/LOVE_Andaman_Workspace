// §pjWbSave · ชื่อสีสายรัดข้อมือ · "แก้แล้วบันทึก หรือแก้แล้วหาย"
//
// ที่มา (2026-09-23) · คำถามตรง ๆ หลังเจอเคสเช็คอินที่ติ๊กขึ้นบนจอแต่ไม่เคยออกจากเครื่อง
//   (§ckOwn · BASE กับข้อมูลจริงถือ object ตัวเดียวกัน · diff เลยว่าง ไม่เซฟ และไม่มีใครรู้)
//   ช่องชื่อสีเพิ่งเพิ่มเข้ามา จึงต้องพิสูจน์ทั้งเส้นทาง ไม่ใช่แค่ว่าขึ้นบนจอ
//
// ⚠ เทสนี้ยกเซิร์ฟเวอร์ปลอมของตัวเอง ไม่ใช้ _harness.mjs
//   ฮาร์เนสตัวนั้นเสิร์ฟไฟล์อย่างเดียว · /api/me ล้ม → ชั้น sync ไม่ตื่น
//   ไม่มีชั้น sync = ไม่มีการเซฟให้วัด · เทสจะเขียวโดยไม่ได้วัดอะไรเลย
// ⚠ และต้องตอบ /api/v1 ด้วยรายการตารางจริงจาก os_repo
//   ตอบ {} เมื่อไหร่ ไคลเอนต์จะถอยไปทาง /api/save แบบเก่า (ส่งทั้งก้อน ~500KB)
//   ซึ่งไม่ใช่ทางที่ของจริงเดิน · วัดแล้วได้ผลที่ไม่ตรงกับหน้างาน
//
// กันหกอย่าง
//   1 แก้แล้วต้องมีคำขอเซฟออกไปจริง ไม่ใช่เงียบ
//   2 ต้องไปทางแคบ (/api/v1/_batch · put pier_job ใบเดียว) ไม่ใช่ยัดทั้งก้อน
//   3 ของที่ส่งไปต้องมีชื่อสีอยู่ในนั้นจริง และเซิร์ฟเวอร์เก็บลงที่ถูก
//   4 เซฟแล้วต้องไม่ยิงซ้ำไปเรื่อย ๆ (สถานะค้าง = ไม่รับของคนอื่นอีกเลย)
//   5 ดึงก้อนใหม่จากเซิร์ฟเวอร์ ชื่อต้องยังอยู่
//   6 คำตอบที่ถ่ายไว้ "ก่อนแก้" มาถึงทีหลัง ต้องทับของที่เพิ่งแก้ไม่ได้
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../allotment_v2');
const REPO = path.resolve(HERE, '../..');
const BLOB = process.env.LAD;
if (!BLOB || !fs.existsSync(BLOB)) { console.log('  ! ต้องมี LAD=<ไฟล์ข้อมูล> · ข้ามเทสนี้'); process.exit(0); }

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* รายการตารางจริง · คิดแบบเดียวกับที่ server.js คิด REST_RES ทุกบรรทัด
   ไม่ hardcode · แผนที่เปลี่ยนเมื่อไหร่เทสจะเห็นของจริงตามไปด้วย */
let RES = null;
try {
  const req = createRequire(import.meta.url);
  const osRepo = req(path.join(REPO, 'os-backend/src/mapping/os_repo.js'));
  const plan = osRepo._plan || {};
  RES = {};
  for (const [t, pl] of Object.entries(plan))
    if (!pl.isChild && (pl.container === 'array' || pl.container === 'map') && pl.appKey)
      RES[pl.appKey] = pl.container;
} catch(e){ RES = null; }
if (!RES) console.log('  ! อ่าน os_repo ไม่ได้ · ข้ามข้อที่วัดทางแคบ (' + REPO + ')');

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

const S = {
  version: 1,
  blob: JSON.parse(fs.readFileSync(BLOB, 'utf8')),
  sse: new Set(),
  loads: 0, saves: 0,
  loadDelay: 0,          // หน่วงคำตอบ · จำลองเน็ตช้า (ถ่ายข้อมูล ณ ตอนคำขอมาถึง)
  bodies: []             // ทุก payload ที่ถูกส่งมาเซฟ
};
function bump(){ S.version++; return { version:S.version, updated_by:'เครื่อง A' }; }
function push(){ const m = bump(); const t = 'data: ' + JSON.stringify(m) + '\n\n';
  S.sse.forEach(r => { try{ r.write(t); }catch(_){} }); return m; }

/* เอา ops ลงก้อนจริง ๆ เท่าที่เทสนี้ต้องใช้ · ของจริงลงฐานข้อมูล
   ที่ต้องทำเองเพราะข้อ 5 วัดว่า "ดึงกลับมาแล้วยังอยู่" · ถ้า mock ไม่เก็บ ก็วัดไม่ได้ */
function applyOps(ops){
  (ops || []).forEach(o => {
    if (!o) return;
    if (o.op === 'meta'){ S.blob[o.id] = o.body; return; }
    const c = RES ? RES[o.r] : null;
    if (o.op === 'putall'){ S.blob[o.r] = o.body; return; }
    if (c === 'map'){
      S.blob[o.r] = S.blob[o.r] || {};
      if (o.op === 'put') S.blob[o.r][o.id] = o.body;
      else if (o.op === 'patch') S.blob[o.r][o.id] = Object.assign({}, S.blob[o.r][o.id] || {}, o.body && o.body.m);
      else if (o.op === 'del') delete S.blob[o.r][o.id];
    } else if (c === 'array'){
      const arr = Array.isArray(S.blob[o.r]) ? S.blob[o.r] : (S.blob[o.r] = []);
      const i = arr.findIndex(x => x && String(x.id) === String(o.id));
      if (o.op === 'put'){ if (i >= 0) arr[i] = o.body; else arr.push(o.body); }
      else if (o.op === 'patch'){ if (i >= 0) Object.assign(arr[i], (o.body && o.body.m) || {}); }
      else if (o.op === 'del' && i >= 0) arr.splice(i, 1);
    }
  });
}

const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const J = (code, obj) => { res.writeHead(code, {'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store'}); res.end(JSON.stringify(obj)); };
  if (u === '/api/me') return J(200, { username:'test', name:'ทดสอบ', role:'admin', canEdit:true });
  if (u === '/api/version') return J(200, { version:S.version, updated_by:'เครื่อง A',
    updated_at:new Date().toISOString() });
  if (u === '/api/v1') return J(200, { resources: RES || {} });
  if (u === '/api/load'){ S.loads++;
    /* ถ่าย ณ ตอนคำขอมาถึง แล้วค่อยตอบช้า · พฤติกรรมจริงของเน็ตช้า
       คำตอบที่ได้จึงเป็นภาพ "ก่อนแก้" ทั้งที่มาถึงหลังแก้ */
    const snap = { version:S.version, data:JSON.stringify(S.blob),
      updated_by:'เครื่อง A', updated_at:new Date().toISOString() };
    return setTimeout(() => J(200, snap), S.loadDelay); }
  if (u === '/api/events'){
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
    return req.on('end', () => {
      S.bodies.push({ url:u, body });
      try { const p = JSON.parse(body); if (Array.isArray(p.ops)) applyOps(p.ops); } catch(_){}
      J(200, { ok:true, version:++S.version });
    });
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
const ctx = await browser.newContext({ viewport:{ width:1600, height:1100 } });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
/* สาย SSE ที่เปิดค้างทำให้ 'load' ไม่มาถึง · รอแค่นาวิเกตติดหน้า แล้วรอของที่ต้องใช้เอง */
await page.goto(`http://127.0.0.1:${port}/allotment_v2.html`, { waitUntil:'commit', timeout:60000 });
await page.waitForFunction(() => typeof window.nav === 'function'
  && document.querySelectorAll('.nav-item[data-view]').length > 0, null, { timeout:30000 });
await page.waitForTimeout(1500);

const wired = await page.evaluate(() => typeof window._laSoftRefresh === 'function');
if (!wired){ fail('ชั้น sync ไม่ทำงานในเทส · ที่เหลือวัดอะไรไม่ได้'); console.log('\nพัง ' + bad);
  await browser.close(); srv.close(); process.exit(1); }
ok('ชั้น sync ตื่นแล้ว · รู้จักตาราง ' + (RES ? Object.keys(RES).length : 0) + ' ตัว');

/* ── ปลูกเคส · เปิดใบงานเรือของท่าที่มีลำวิ่งจริง ───────────────────────── */
const P = await page.evaluate(() => {
  const D = '2026-09-23';
  const tryPier = pier => {
    const mine = (BOATS || []).filter(x => (x.pier || '') === pier);
    const rt = (ROUTES || []).find(r => (r.pier || '') === pier) || (ROUTES || [])[0];
    if (!mine.length || !rt) return null;
    TRIPS[D] = TRIPS[D] || {};
    mine.forEach(b => { if (!TRIPS[D][b.id]) TRIPS[D][b.id] = { route: rt.id, type:'normal', booked:0 }; });
    _poDate = D; _poPier = pier;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const v = document.getElementById('view-poj-' + pier);
    if (v) v.classList.add('active');
    renderPierJob(pier);
    const sw = document.querySelector('.pj-pop[id^="pjwb-"] .pj-sw[onclick]');
    const m = sw ? /pjWbSet\('([^']+)'/.exec(sw.getAttribute('onclick') || '') : null;
    return m ? { bid:m[1], pier } : null;
  };
  let got = null;
  for (const p of (PO_PIERS || []).map(x => x.k)){ got = tryPier(p); if (got) break; }
  return Object.assign({ bid:'', pier:'', date:D,
    canEdit:(typeof poCanEdit === 'function') ? poCanEdit() : null }, got || {});
});
if (!P.canEdit){ console.log('  ! ผู้ใช้ชุดนี้แก้ไม่ได้ · ข้ามเทสทั้งไฟล์'); console.log('\nพัง 0');
  await browser.close(); srv.close(); process.exit(0); }
if (!P.bid){ console.log('  ! วันนี้ไม่มีลำที่วิ่ง · ข้ามเทสทั้งไฟล์'); console.log('\nพัง 0');
  await browser.close(); srv.close(); process.exit(0); }
console.log('ปลูกเคส · ' + P.date + ' ท่า ' + P.pier + ' · ใช้ ' + P.bid);

const KEY = await page.evaluate(b => pjKey(_poDate, b), P.bid);
const stored = () => page.evaluate(k => {
  const o = PIER_JOB[k] || {};
  return { wb:String(o.wb || ''), wbc:String(o.wbc || '') };
}, KEY);
/* ของที่อยู่ในก้อนกลางจริง ๆ (ตัวที่ถูกส่งขึ้นเซิร์ฟเวอร์) ไม่ใช่แค่ตัวแปรในหน้า */
const inBlob = () => page.evaluate(k => {
  try{ const d = laBlob(); const o = (d && d.pier_job && d.pier_job[k]) || {};
    return String(o.wb || ''); }catch(_){ return '(อ่านก้อนไม่ได้)'; }
}, KEY);

const NAME = 'ส้มอ่อน ล็อต 7';

/* ── อุ่นเครื่องก่อนวัด ────────────────────────────────────────────────────
   การเซฟ "ครั้งแรก" ของทุกเซสชันไม่ได้มีแต่ของที่เราเพิ่งแก้
   ตอนบูต แอปจะไล่ปรับข้อมูลให้เข้ารูป (เติมของที่ขาด · แปลงของเก่า · ล้างของทิ้ง)
   ทั้งหมดนั้นค้างอยู่ในเครื่องจนกว่าจะมีใครสั่งเซฟอะไรสักอย่าง แล้วไปพร้อมกันหมด
   ชุดข้อมูลย่อยที่ใช้เทสยิ่งเยอะ เพราะขาดหลายตารางแล้วโดนเติมให้ตอนบูต
   ไม่อุ่นก่อน = วัดกองนั้นแทนที่จะวัดการแก้ชื่อสี · ตัวเลขที่ได้ไม่ได้แปลว่าอะไรเลย */
await page.evaluate(a => pjWbName(a.b, a.n), { b:P.bid, n:'อุ่นเครื่อง' });
for (let i = 0; i < 60; i++){ await sleep(100); if (S.saves > 0) break; }
await sleep(2500);

/* ══ 1 · แก้แล้วต้องมีคำขอเซฟออกไปจริง ═══════════════════════════════════
   อาการที่กลัวคือ "ขึ้นบนจอแต่ไม่เคยออกจากเครื่อง" · วัดที่ฝั่งเซิร์ฟเวอร์เท่านั้น */
const saves0 = S.saves, bodies0 = S.bodies.length;
await page.evaluate(a => pjWbName(a.b, a.n), { b:P.bid, n:NAME });
await page.waitForTimeout(400);
const onScreen = await stored();
if (onScreen.wb !== NAME) fail('ตั้งชื่อแล้วในเครื่องยังไม่เปลี่ยน · ได้ "' + onScreen.wb + '"');
else ok('ตั้งชื่อแล้ว · ในเครื่องเป็น "' + onScreen.wb + '"');

let t1 = -1;
for (let i = 0; i < 45; i++){ await sleep(100); if (S.saves > saves0){ t1 = (i + 1) * 100; break; } }
await sleep(400);
if (t1 < 0) fail('แก้แล้วไม่มีคำขอเซฟออกไปเลยใน 4.5 วิ · ขึ้นบนจออย่างเดียว (อาการ "แก้แล้วหาย")');
else ok('แก้แล้วเซฟขึ้นเซิร์ฟเวอร์จริง · ใน ' + t1 + 'ms');

/* ══ 2 · ต้องไปทางแคบ ไม่ใช่ยัดทั้งก้อน ════════════════════════════════════
   ทางเก่า /api/save ส่ง diff ทั้งก้อนราวครึ่งเมกฯ ต่อการแก้หนึ่งครั้ง
   บนเน็ตหน้าท่าคือช้า และทับงานคนอื่นง่ายกว่า เพราะส่งทั้งวัตถุไม่ใช่ทีละช่อง */
const mine = S.bodies.slice(bodies0);
if (t1 >= 0 && RES){
  const batch = mine.filter(x => x.url === '/api/v1/_batch');
  const legacy = mine.filter(x => x.url === '/api/save');
  const kb = Math.round(mine.reduce((s, x) => s + x.body.length, 0) / 1024);
  let nOps = 0;
  batch.forEach(x => { try{ nOps += (JSON.parse(x.body).ops || []).length; }catch(_){} });
  if (!batch.length) fail('ถอยไปทาง /api/save แบบเก่า · ส่งไป ' + kb + 'KB ต่อการแก้ชื่อหนึ่งครั้ง');
  else if (legacy.length) fail('ส่งทั้งสองทาง · มี /api/save ปนมา ' + legacy.length + ' ครั้ง');
  else if (nOps > 3) fail('ส่งไป ' + nOps + ' รายการ ทั้งที่แก้ช่องเดียว · กวาดของอื่นไปด้วย');
  else if (kb > 20) fail('ไปทางแคบแล้วแต่ยังใหญ่ ' + kb + 'KB · น่าจะยัดของเกินมาด้วย');
  else ok('ไปทางแคบ /api/v1/_batch · ' + nOps + ' รายการ ' + (kb || '<1') + 'KB ต่อการแก้หนึ่งครั้ง');
}

/* ══ 3 · ของที่ส่งไปต้องมีชื่อสี และเซิร์ฟเวอร์เก็บลงที่ถูก ══════════════════
   มีคำขอออกไป ไม่ได้แปลว่าของที่ต้องการอยู่ในนั้น · diff อาจว่างแล้วส่งของอื่นไปแทน */
if (t1 >= 0){
  let put = null;
  mine.forEach(x => { try{ const p = JSON.parse(x.body);
    (p.ops || []).forEach(o => { if (o && o.r === 'pier_job' && String(o.id) === KEY) put = o; });
  }catch(_){} });
  const raw = mine.map(x => x.body).join('\n');
  if (!raw.includes(NAME)) fail('คำขอเซฟไม่มีชื่อสีอยู่ในนั้น · เซิร์ฟเวอร์ไม่มีทางเก็บได้');
  else if (RES && !put) fail('มีชื่อสีแต่ไม่ได้ส่งมาเป็น pier_job/' + KEY + ' · เซิร์ฟเวอร์ไม่รู้จะเก็บลงไหน');
  else if (put && String((put.body || {}).wb) !== NAME)
    fail('ส่ง pier_job มาแล้วแต่ช่อง wb ไม่ใช่ชื่อที่พิมพ์ · ได้ "' + (put.body || {}).wb + '"');
  else ok('ส่งไปเป็น ' + (put ? (put.op + ' pier_job/' + put.id) : 'diff ทั้งก้อน') + ' · wb = "' + NAME + '"');

  const srvHas = String(((S.blob.pier_job || {})[KEY] || {}).wb || '');
  if (srvHas !== NAME) fail('เซิร์ฟเวอร์รับไปแล้วแต่ไม่ได้เก็บลง pier_job · เก็บเป็น "' + srvHas + '"');
  else ok('ฝั่งเซิร์ฟเวอร์เก็บแล้ว · pier_job["' + KEY + '"].wb = "' + srvHas + '"');

  const b = await inBlob();
  if (b !== NAME) fail('ชื่ออยู่ในตัวแปรหน้าจอ แต่ไม่ได้ลงก้อนกลางในเครื่อง · ได้ "' + b + '"');
  else ok('ก้อนกลางในเครื่องมีแล้ว · รีเฟรชหน้าเองก็ยังอยู่');
}

/* ══ 4 · เซฟเสร็จแล้วต้องไม่ยิงซ้ำไปเรื่อย ๆ ════════════════════════════════
   ยิงซ้ำ = สถานะ "ยังไม่ได้เซฟ" ค้าง · ชั้น sync จะไม่ยอมรับของใหม่จากคนอื่นอีกเลย */
if (t1 >= 0){
  await sleep(1200);
  const s2 = S.saves;
  await sleep(2500);
  if (S.saves > s2) fail('เซฟแล้วยังยิงซ้ำอีก ' + (S.saves - s2) + ' ครั้ง · สถานะค้าง');
  else ok('เซฟครั้งเดียวจบ · ไม่ยิงซ้ำ');
}

/* ══ 5 · ดึงก้อนใหม่แล้วชื่อต้องยังอยู่ ═════════════════════════════════════
   ของที่เซิร์ฟเวอร์เก็บมาจากการเซฟจริงในข้อ 3 ไม่ได้เขียนใส่มือ
   จำลองว่ามีคนอื่นแก้อย่างอื่น · เครื่องนี้ดึงก้อนใหม่มาทั้งก้อน */
if (t1 >= 0){
  const l0 = S.loads;
  push();
  let got = false;
  for (let i = 0; i < 40; i++){ await sleep(100); if (S.loads > l0){ got = true; break; } }
  await sleep(1200);
  const v = await stored();
  if (!got) console.log('  ! ไม่ได้ดึงก้อนใหม่ในรอบนี้ · ข้ามข้อ 5');
  else if (v.wb !== NAME) fail('ดึงก้อนใหม่แล้วชื่อหาย · ได้ "' + v.wb + '"');
  else ok('ดึงก้อนใหม่จากเซิร์ฟเวอร์ · ชื่อ "' + v.wb + '" ยังอยู่');
}

/* ══ 6 · คำตอบที่ถ่ายไว้ "ก่อนแก้" ต้องทับของที่เพิ่งแก้ไม่ได้ ══════════════
   §ckStale · เน็ตหน้าท่าช้าเป็นวินาที · คำขอออกไปก่อน คนแก้ทีหลัง คำตอบมาทีหลังอีก
   ไม่มีด่าน = คำตอบชุดเก่าทับงานที่เพิ่งทำ · "แก้แล้วหาย" แบบที่หาสาเหตุยากที่สุด */
{
  const NAME2 = 'เขียวมะนาว ล็อต 9';
  S.loadDelay = 2500;
  push();                                  /* เวอร์ชันขยับก่อน · คำขอเริ่มเดินทาง */
  await sleep(350);
  await page.evaluate(a => pjWbName(a.b, a.n), { b:P.bid, n:NAME2 });   /* แก้ระหว่างคำตอบยังลอยอยู่ */
  const seen = [];
  for (let i = 0; i < 55; i++){
    await sleep(100);
    seen.push((await stored()).wb === NAME2);
  }
  S.loadDelay = 0;
  const first = seen.indexOf(true);
  const lost  = first >= 0 && seen.slice(first).some(x => !x);
  if (first < 0) fail('แก้ชื่อรอบสองแล้วไม่ขึ้นเลย');
  else if (lost) fail('แก้แล้วหาย · ก้อนที่ถ่ายไว้ก่อนแก้มาทับของที่เพิ่งแก้');
  else ok('เน็ตช้า 2.5 วิ · แก้ชื่อแล้วอยู่ตลอด ไม่ถูกก้อนเก่าทับ');
}

console.log(bad ? ('\nพัง ' + bad) : '\nพัง 0');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
