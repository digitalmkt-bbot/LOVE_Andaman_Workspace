// §vbFocus · วางบิลรถร่วม · โหมดแก้ไข · กรอกแล้วตัวเลขเด้งกลับเป็น 0 เอง
//
// ที่มา (2026-10-02) · วิดีโอจากหน้างาน · กด "แก้ไข" กรอก ราคาขาย/คน กับ เรต/คัน
//   ยอดขึ้น (฿7,200 · ฿9,000) แล้ว 1–2 วิ ถัดมากลับเป็น ฿0 ทั้งหน้า ทั้งที่ยังไม่ได้กดบันทึก
// เหตุ · โหมดแก้ไขเก็บที่แก้ไว้ในหน่วยความจำอย่างเดียว (vbPersist ตั้งใจไม่เขียน) _dirty จึง false
//   พอมีคนอื่นเซฟอะไรก็ตาม ตัวดึงข้อมูลใหม่เอาของเซิร์ฟเวอร์มาทับ VAN_BILL ทั้งก้อน
//   เป็นมาตั้งแต่มีโหมดแก้ไข (29 ส.ค.) แต่เห็นชัดหลัง §sseCatchup (23 ก.ย.) ที่ทำให้ทุกหน้าตามของใหม่ใน ~0.5 วิ
//
// ⚠ ใช้เซิร์ฟเวอร์ปลอมแบบเดียวกับ t_ssecatch.mjs (ฮาร์เนสปกติไม่มีชั้น sync)
//
// กันสี่อย่าง
//   1 อยู่ในโหมดแก้ไข · คนอื่นเซฟเข้ามา · ตัวเลขที่กรอกไว้ต้องอยู่ครบ
//   2 ยังอยู่ในโหมดแก้ไข และยังไม่มีอะไรถูกส่งขึ้นเซิร์ฟเวอร์ (ปุ่มยกเลิกยังมีความหมาย)
//   3 กดบันทึก · ตัวเลขถูกส่งขึ้นเซิร์ฟเวอร์จริง
//   4 ออกจากโหมดแก้ไขแล้ว · ของที่คนอื่นเซฟต้องกลับมาตามได้เหมือนเดิม (ไม่ได้ปิดการตามถาวร)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../allotment_v2');
const BLOB = process.env.LAD;
if (!BLOB || !fs.existsSync(BLOB)) { console.log('  ! need LAD=<data file> · skipped'); process.exit(0); }

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

const S = { version:1, data:fs.readFileSync(BLOB,'utf8'), sse:new Set(), loads:0, saves:[] };
function push(){ S.version++; const t='data: '+JSON.stringify({version:S.version,updated_by:'A'})+'\n\n';
  S.sse.forEach(r=>{ try{ r.write(t); }catch(_){} }); }
setInterval(() => { S.sse.forEach(r => { try{ r.write('event: hb\ndata: 1\n\n'); }catch(_){} }); }, 1000);

const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (process.env.DBG && u.startsWith('/api/')) console.log('REQ', req.method, req.url.slice(0,120));
  const J = (code, obj) => { res.writeHead(code, {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}); res.end(JSON.stringify(obj)); };
  if (u === '/api/me') return J(200, { username:'test', name:'test', role:'admin', canEdit:true });
  if (u === '/api/version') return J(200, { version:S.version, updated_by:'A', updated_at:new Date().toISOString() });
  if (u === '/api/load'){ S.loads++; return J(200, { version:S.version, data:S.data, updated_by:'A', updated_at:new Date().toISOString() }); }
  if (u === '/api/events'){
    res.writeHead(200, {'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache','connection':'keep-alive'});
    res.write('retry: 1000\n\n'); S.sse.add(res); req.on('close', () => S.sse.delete(res)); return;
  }
  if (u === '/api/save' || u === '/api/v1/_batch'){
    let b = ''; req.on('data', c => b += c);
    return req.on('end', () => { S.saves.push(b); if (S.onSave) S.onSave(); J(200, { ok:true, version:++S.version }); });
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
const ctx = await browser.newContext({ viewport:{ width:1900, height:1000 } });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
const errors = []; page.on('pageerror', e => { errors.push(String(e && e.message || e)); if (process.env.DBG) console.log('PAGEERR', String(e && e.stack || e).slice(0,400)); });
if (process.env.DBG){ const T0=Date.now(); const L=(...a)=>console.log(((Date.now()-T0)/1000).toFixed(1),...a); page.on('crash',()=>L('CRASH')); page.on('close',()=>L('CLOSE')); page.on('framenavigated',f=>{ if(f===page.mainFrame()) L('NAV',f.url()); }); page.on('requestfailed',r=>L('REQFAIL',r.url().slice(0,120))); }
if (process.env.DBG) page.on('console', m => { if (m.type()==='error') console.log('CONSOLE', m.text().slice(0,300)); });
await ctx.route('**/*', r => r.request().url().startsWith(`http://127.0.0.1:${port}/`) ? r.continue() : r.abort());
await page.goto(`http://127.0.0.1:${port}/allotment_v2.html`, { waitUntil:'commit', timeout:60000 });
await page.waitForFunction(() => typeof window.nav === 'function' && typeof window.renderVanBill === 'function'
  && document.querySelectorAll('.nav-item[data-view]').length > 0, null, { timeout:15000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { const el = document.querySelector('.nav-item[data-view="vanbill"]'); if (el) nav(el); });
await page.waitForTimeout(900);

/* ══ 0 · หารอบบิลที่มีงาน แล้วทำให้ใบนั้นว่างทั้งในเครื่องและบนเซิร์ฟเวอร์ปลอม ══ */
const P = await page.evaluate(() => {
  if (typeof vbSuppliers !== 'function' || !document.getElementById('vanbill-host')) return { err: 'van bill page did not open' };
  const sups = vbSuppliers(); let p = null;
  outer:
  for (const s of sups) for (const ym of ['2026-09','2026-08','2026-10','2026-07','2026-06'])
    for (const per of [1,2,3]) { _vb.sup = s; _vb.ym = ym; _vb.per = per; _vb.van = '';
      if (vbRows().length >= 1) { p = { s, ym, per }; break outer; } }
  if (!p) return { err: 'no billing period with rows in this data set' };
  _vb.sup = p.s; _vb.ym = p.ym; _vb.per = p.per; _vb.mode = 'one'; _vb.edit = 0; _vb.open = {};
  const key = vbKey();
  VAN_BILL[key] = { perPax: 0, rate: 0, rows: {}, extra: [], by: '', at: '' };
  renderVanBill();
  return { key, pax: vbRows().reduce((a, r) => a + (+r.pax || 0), 0) };
});
if (P.err) { fail(P.err); await browser.close(); srv.close(); process.exit(1); }
{ const D = JSON.parse(S.data); D.van_bill = D.van_bill || {};
  D.van_bill[P.key] = { perPax: 0, rate: 0, rows: {}, extra: [], by: '', at: '' }; S.data = JSON.stringify(D); }

const perPax = () => page.evaluate(() => vbState().perPax);
const blur = async () => { await page.mouse.click(1200, 6); await page.evaluate(() => { try{ document.activeElement && document.activeElement.blur(); }catch(_){} }); };

/* ══ 1–2 · โหมดแก้ไข · กรอก · ออกจากช่อง · คนอื่นเซฟ ══ */
await page.click('#vanbill-host button[onclick="vbEdit()"]');
await page.waitForTimeout(200);
await page.click('#vanbill-host input[data-vbk="@perPax"]');
await page.keyboard.type('200');
await blur();
await page.waitForTimeout(300);
const before = await perPax();
if (before !== 200) fail('setup: typed 200 but memory has ' + before);
const loads0 = S.loads, saves0 = S.saves.length;
push();                              /* คนอื่นเซฟ · ระหว่างที่ยังไม่ได้กดบันทึก */
await sleep(2500);
push();
await sleep(2500);
const R1 = await page.evaluate(() => ({ pp: vbState().perPax, edit: _vb.edit,
  shown: (document.querySelector('#vanbill-host input[data-vbk="@perPax"]') || {}).value || '' }));
if (R1.pp === 200 && R1.shown === '200') ok('1 โหมดแก้ไข · คนอื่นเซฟเข้ามา 2 ครั้ง · ราคาขาย/คน ที่กรอกไว้ยังเป็น 200');
else fail(`1 ตัวเลขที่กรอกหาย · ในหน่วยความจำ ${R1.pp} · ในช่อง "${R1.shown}" (ดึงข้อมูลใหม่ ${S.loads - loads0} ครั้ง)`);
if (R1.edit === 1 && S.saves.length === saves0) ok('2 ยังอยู่ในโหมดแก้ไข · ยังไม่มีอะไรถูกส่งขึ้นเซิร์ฟเวอร์');
else fail(`2 โหมดแก้ไขผิด: edit=${R1.edit} · ส่งขึ้นเซิร์ฟเวอร์ ${S.saves.length - saves0} ครั้ง`);

/* ══ 3 · กดบันทึก · ต้องถูกส่งขึ้นเซิร์ฟเวอร์ ══ */
/* เซิร์ฟเวอร์ปลอมไม่ได้ประกอบ diff เอง · ให้มันรับค่าของใบนี้ตอนที่คำสั่งเซฟมาถึง เหมือนเซิร์ฟเวอร์จริง */
const want = await page.evaluate(() => JSON.stringify(VAN_BILL[vbKey()]));
S.onSave = () => { const D = JSON.parse(S.data); D.van_bill = D.van_bill || {}; D.van_bill[P.key] = JSON.parse(want); S.data = JSON.stringify(D); };
await page.click('#vanbill-host button[onclick="vbSave()"]');
await sleep(2200);                   /* debounce 1 วิ + ยิง */
const sent = S.saves.slice(saves0).join('\n');
if (S.saves.length > saves0 && sent.indexOf('perPax') >= 0 && /perPax\\*"\s*:\s*200/.test(sent))
  ok('3 กดบันทึก · ราคาขาย/คน 200 ถูกส่งขึ้นเซิร์ฟเวอร์');
else fail(`3 กดบันทึกแล้วไม่ถูกส่ง · ส่ง ${S.saves.length - saves0} ครั้ง · ${sent.slice(0, 200)}`);

/* ══ 4 · ออกจากโหมดแก้ไขแล้ว · ต้องกลับมาตามของคนอื่นได้ ══ */
await blur();
const loads1 = S.loads;
push();
await sleep(2500);
const R4 = await page.evaluate(() => ({ pp: vbState().perPax, edit: _vb.edit }));
if (S.loads > loads1 && R4.pp === 200 && R4.edit === 0) ok('4 บันทึกแล้ว · หน้ากลับมาตามของคนอื่นได้ และตัวเลขที่บันทึกยังอยู่');
else fail(`4 หลังบันทึก: ดึงใหม่ ${S.loads - loads1} ครั้ง · perPax ${R4.pp} · edit ${R4.edit}`);

if (errors.length) fail('page errors: ' + errors.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
