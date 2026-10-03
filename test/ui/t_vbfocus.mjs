// §vbFocus · หน้าวางบิลรถร่วม · กรอกแล้วเคอร์เซอร์ต้องไปช่องที่ผู้ใช้ไป ไม่เด้งกลับช่องเดิม
//
// ที่มา (2026-10-02) · ผู้ใช้แจ้ง "คีย์ ๆ อยู่แล้วเด้ง ยังไม่ได้บันทึก เด้งรีเฟรช แล้วหาย"
//   ทำซ้ำได้ตรงตัว · พิมพ์ 1500 ในช่องเรต กด Tab พิมพ์ 200 ตั้งใจลงช่อง EXTRA
//   ของเดิมหน้าวาดใหม่ทันทีตอนออกจากช่อง แล้วคืนโฟกัสให้ "ช่องที่เพิ่งกรอก"
//   200 จึงพิมพ์ทับ 1500 · เรตเหลือ 200 ช่อง EXTRA ว่าง ไม่มีอะไรเตือน
//
// ⚠ เทสพิมพ์จริงผ่านคีย์บอร์ดและเมาส์ของเบราว์เซอร์ · ไม่เรียก vbSetRow ตรง ๆ
//    บั๊กนี้อยู่ที่ลำดับเหตุการณ์ของโฟกัส เรียกฟังก์ชันตรงจะมองไม่เห็นเลย
// ⚠ เทสเขียนใบวางบิลของตัวเองบนข้อมูลจริง แล้วคืนสถานะตอนจบ
//
// เทสนี้กันหกอย่าง
//   1 Tab · ตัวเลขลงช่องที่ตั้งใจ ช่องก่อนหน้าไม่ถูกทับ
//   2 คลิกช่องถัดไป · ตัวเลขลงช่องที่คลิก ช่องก่อนหน้ายังอยู่
//   3 Enter · บันทึกแล้วอยู่ช่องเดิม
//   4 ทุกช่องลงที่เก็บทันที (ไม่ต้องกดบันทึก)
//   5 โหมดแก้ไข · พิมพ์ช่องสุดท้ายแล้วคลิกปุ่มบันทึก การคลิกต้องไม่หาย · และ Tab ในโหมดแก้ไขไม่ทับช่องเดิม
//   6 โหมดแก้ไขกันตัวดึงข้อมูลใหม่ไม่ให้เอาของเซิร์ฟเวอร์มาทับ (ตรวจจากซอร์สของ _laBusy)
//   7 ไม่มี error บนหน้า

import { open, goView, ROOT } from './_harness.mjs';
import fs from 'node:fs';
import path from 'node:path';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1000 });
await goView(page, 'vanbill', 900);

/* ══ 0 · หาเจ้า+รอบบิลที่มีงานอย่างน้อย 3 แถว แล้วล้างใบให้ว่าง ══════════════════ */
const S = await page.evaluate(() => {
  if (typeof vbRenderSoon !== 'function') return { err: 'ยังไม่มี vbRenderSoon' };
  const sups = vbSuppliers(); let p = null;
  outer:
  for (const s of sups) for (const ym of ['2026-09','2026-08','2026-10','2026-07','2026-06'])
    for (const per of [1,2,3]) { _vb.sup = s; _vb.ym = ym; _vb.per = per; _vb.van = '';
      if (vbRows().length >= 3) { p = { s, ym, per }; break outer; } }
  if (!p) return { err: 'ชุดนี้ไม่มีรอบบิลที่มีงานถึง 3 แถว · เทสนี้พิสูจน์อะไรไม่ได้' };
  _vb.sup = p.s; _vb.ym = p.ym; _vb.per = p.per; _vb.mode = 'one'; _vb.edit = 0; _vb.open = {};
  const key = vbKey(); const snap = VAN_BILL[key] ? JSON.stringify(VAN_BILL[key]) : null;
  VAN_BILL[key] = { perPax: 0, rate: 0, rows: {}, extra: [], by: '', at: '' };
  renderVanBill();
  const ks = [...document.querySelectorAll('#vanbill-host input[data-vbk]')].map(e => e.getAttribute('data-vbk'));
  return { p, key, snap, rates: ks.filter(k => /~[^|]*\|rate$/.test(k)) };
});
if (S.err) { fail(S.err); await close(); process.exit(1); }
const [K1, K2, K3] = S.rates;
const sel = k => `#vanbill-host input[data-vbk="${k}"]`;
const focusKey = () => page.evaluate(() => (document.activeElement && document.activeElement.getAttribute) ? (document.activeElement.getAttribute('data-vbk') || '') : '');
const rowOf = k => page.evaluate(kk => { const st = vbState(); return st.rows[kk.split('|')[0]] || {}; }, k);
const EX1 = K1.replace(/\|rate$/, '|ex');

/* ══ 1 · Tab ═════════════════════════════════════════════════════════════════ */
await page.click(sel(K1));
await page.keyboard.type('1500');
await page.keyboard.press('Tab');
await page.waitForTimeout(120);
const f1 = await focusKey();
await page.keyboard.type('200');
await page.keyboard.press('Tab');
await page.waitForTimeout(120);
const r1 = await rowOf(K1);
if (f1 === EX1 && r1.rate === 1500 && r1.ex === 200)
  ok('1 Tab · 1500 อยู่ช่องเรต 200 ลงช่อง EXTRA · เคอร์เซอร์ไปช่องถัดไป ไม่เด้งกลับ');
else fail(`1 Tab แล้วตัวเลขลงผิดช่อง: โฟกัสหลัง Tab = ${f1} (ควรเป็น ${EX1}) · แถว = ${JSON.stringify(r1)}`);

/* ══ 2 · คลิกช่องถัดไป ═══════════════════════════════════════════════════════ */
await page.click(sel(K2));
await page.keyboard.type('1600');
await page.click(sel(K3));
await page.waitForTimeout(120);
const f2 = await focusKey();
await page.keyboard.type('1700');
await page.keyboard.press('Tab');
await page.waitForTimeout(120);
const r2 = await rowOf(K2), r3 = await rowOf(K3);
if (f2 === K3 && r2.rate === 1600 && r3.rate === 1700)
  ok('2 คลิกช่องถัดไป · 1600 กับ 1700 ลงคนละช่องตามที่คลิก');
else fail(`2 คลิกแล้วตัวเลขลงผิดช่อง: โฟกัสหลังคลิก = ${f2} (ควรเป็น ${K3}) · ${JSON.stringify({ r2, r3 })}`);

/* ══ 3 · Enter ══════════════════════════════════════════════════════════════ */
const CUT1 = K1.replace(/\|rate$/, '|cut');
await page.click(sel(CUT1));
await page.keyboard.type('50');
await page.keyboard.press('Enter');
await page.waitForTimeout(120);
const f3 = await focusKey(); const r1b = await rowOf(K1);
if (f3 === CUT1 && r1b.cut === 50 && r1b.rate === 1500 && r1b.ex === 200)
  ok('3 Enter · บันทึกแล้วอยู่ช่องเดิม ช่องอื่นของแถวไม่ขยับ');
else fail(`3 Enter ผิด: โฟกัส = ${f3} · แถว = ${JSON.stringify(r1b)}`);

/* ══ 4 · ลงที่เก็บทันที ═════════════════════════════════════════════════════ */
const R4 = await page.evaluate(p => {
  const D = JSON.parse(localStorage.getItem('loveandaman_v2') || '{}');
  const st = (D.van_bill || {})[p.key] || { rows: {} };
  const g = k => (st.rows[k.split('|')[0]] || {});
  return { a: g(p.K1), b: g(p.K2), c: g(p.K3), by: !!st.at };
}, { key: S.key, K1, K2, K3 });
if (R4.a.rate === 1500 && R4.a.ex === 200 && R4.a.cut === 50 && R4.b.rate === 1600 && R4.c.rate === 1700 && R4.by)
  ok('4 ทุกช่องที่กรอกลงที่เก็บแล้วโดยไม่ต้องกดบันทึก');
else fail(`4 กรอกแล้วไม่ลงที่เก็บ: ${JSON.stringify(R4)}`);

/* ══ 5 · โหมดแก้ไข ═══════════════════════════════════════════════════════════ */
await page.evaluate(() => { vbEdit(); });
await page.waitForTimeout(150);
await page.click(sel(K1));
await page.keyboard.press('Control+A'); await page.keyboard.type('1800');
await page.keyboard.press('Tab');
await page.waitForTimeout(120);
const f5 = await focusKey();
await page.keyboard.press('Control+A'); await page.keyboard.type('250');
/* ยังไม่ออกจากช่อง · คลิกปุ่มบันทึกเลย เหมือนที่คนทำจริง */
const saveBtn = await page.$('#vanbill-host [onclick="vbSave()"]');
if (!saveBtn) fail('5 ไม่เจอปุ่มบันทึกในโหมดแก้ไข · ข้อนี้พิสูจน์อะไรไม่ได้');
else {
  /* กดค้าง 90ms แบบนิ้วคนจริง · คลิกของเครื่องเร็วเกินจนมองไม่เห็นบั๊ก
     (หน้าถูกวาดใหม่ระหว่างกดกับปล่อย ปุ่มที่กดอยู่ถูกทำลาย การคลิกหายเงียบ) */
  const bb = await saveBtn.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
  await page.waitForTimeout(250);
  const R5 = await page.evaluate(p => {
    const D = JSON.parse(localStorage.getItem('loveandaman_v2') || '{}');
    const st = (D.van_bill || {})[p.key] || { rows: {} };
    return { edit: _vb.edit, mem: vbState().rows[p.K1.split('|')[0]] || {}, stored: st.rows[p.K1.split('|')[0]] || {} };
  }, { key: S.key, K1 });
  if (f5 === EX1 && R5.edit === 0 && R5.mem.rate === 1800 && R5.mem.ex === 250 && R5.stored.rate === 1800 && R5.stored.ex === 250)
    ok('5 โหมดแก้ไข · Tab ไม่ทับช่องเดิม · พิมพ์ค้างแล้วคลิกบันทึก การคลิกไม่หาย ค่าลงที่เก็บครบ');
  else fail(`5 โหมดแก้ไขผิด: โฟกัสหลัง Tab = ${f5} · ${JSON.stringify(R5)}`);
}

/* ══ 6 · โหมดแก้ไขกันตัวดึงข้อมูลใหม่ ═════════════════════════════════════════
   ที่แก้ไว้ในโหมดแก้ไขอยู่ในหน่วยความจำอย่างเดียว (vbPersist ตั้งใจไม่เขียน) _dirty จึง false
   ถ้า _laBusy ไม่รู้จักโหมดนี้ ตัวดึงข้อมูลใหม่จะเอาของเซิร์ฟเวอร์มาทับตอนโฟกัสไม่ได้อยู่ในช่องพิมพ์
   ฮาร์เนสไม่มีเซิร์ฟเวอร์ ชั้น sync จึงไม่ทำงานที่นี่ · ตรวจจากซอร์สของ _laBusy แทน */
{
  const src = fs.readFileSync(path.join(ROOT, 'js/01-auth-sync.js'), 'utf8');
  const a = src.indexOf('function _laBusy('), b = src.indexOf('function _laSaveView(');
  const body = (a >= 0 && b > a) ? src.slice(a, b) : '';
  const hit = /window\._vb\s*&&\s*window\._vb\.edit\)\s*return true/.test(body);
  const order = hit && body.search(/window\._vb\s*&&/) < body.indexOf('if(skipIdle) return false');
  const glob = await page.evaluate(() => { vbEdit(); const v = !!(window._vb && window._vb.edit); vbCancel(1); return v && !window._vb.edit; });
  if (hit && order && glob) ok('6 _laBusy นับโหมดแก้ไขของใบวางบิลเป็นงานค้าง · window._vb.edit อ่านได้จริงจากชั้น sync');
  else fail(`6 ตัวดึงข้อมูลใหม่ยังทับงานที่แก้ค้างได้: guard=${hit} ก่อนทางลัด=${order} ตัวแปรเห็นจากนอก=${glob}`);
}

/* ══ คืนสถานะ ═══════════════════════════════════════════════════════════════ */
await page.evaluate(p => {
  if (p.snap) VAN_BILL[p.key] = JSON.parse(p.snap); else delete VAN_BILL[p.key];
  _vb.edit = 0; _vb.open = {};
  try { laBlob().van_bill = VAN_BILL; laBlobSave(); } catch (e) {}
}, { key: S.key, snap: S.snap });

/* ══ 7 ═══════════════════════════════════════════════════════════════════════ */
const realErr = errors.filter(e => !/Failed to load resource/.test(e));
if (!realErr.length) ok('7 ไม่มี error บนหน้า');
else fail('7 มี error: ' + realErr.slice(0, 3).join(' | '));

await close();
console.log(bad ? `\n§vbFocus · ไม่ผ่าน ${bad} ข้อ` : '\n§vbFocus · ผ่านทั้งหมด');
process.exit(bad ? 1 : 0);
