// §pcSug · เงินสดย่อย · พิมพ์รายการในสมุดแล้วขึ้นรายการที่เคยลง (เปลี่ยนวันที่ให้)
// ที่มา (2026-10-15) · owner "เวลาพิมพ์ของวันถัดไป ให้ขึ้นตัวที่เคยพิมพ์ด้วยได้ไหม เพราะ User จ่ายรายการเดิม ๆ คล้าย ๆ กัน เพียงแต่เปลี่ยนวันที่"
// กัน (ท่าทับละมุ · 14-16 ต.ค. 2026 ในหน่วยความจำ · วันนี้ของหน้า = 16)
//   1 เปิดบรรทัดจ่ายใหม่ → รายการแนะนำขึ้นเลย · ล่าสุดก่อน · ข้อความเดียวกันต่างวัน = อันเดียว (2 ครั้ง) · บรรทัดที่ดึงจากชีท/รายรับไม่ขึ้น
//   2 พิมพ์ "ไกด์" → เหลือรายการไกด์ · วันที่ในข้อความเป็น 16/10/26 (รูปแบบเดิม ค.ศ. 2 หลัก)
//   3 ↓ + Enter → ช่องรายการได้ข้อความวันใหม่ · ยอด = ยอดครั้งล่าสุด · Enter อีกที = บันทึก
//   4 วันที่แบบไทย "15 ต.ค. 69" → "16 ต.ค. 69" · 15/10/2569 → 16/10/2569 · 5 ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1100 });
await goView(page, 'pop-tublamu', 1000);
await page.evaluate(() => {
  window.pcGuard = () => true; window.pcSave = () => {};
  const P = 'tublamu', d = ds => { const D = pcDay(P, ds, true); D['in'] = []; D.out = []; D.pk = {}; D.lt = {}; return D; };
  const a = d('2026-10-14'), b = d('2026-10-15'); d('2026-10-16');
  a.out.push({ id: 'h1', txt: 'ค่ารถตู้นอกโซนภูเก็ต SL 14/10/26 (1คัน) นายสมศักดิ์', amt: 2800, at: '16:00' });
  a.out.push({ id: 'h2', txt: 'ค่าอาหารกลางวันอุทยานสุรินทร์ 14 ต.ค. 69', amt: 11000, at: '19:00' });
  b.out.push({ id: 'h3', txt: 'ค่ารถตู้นอกโซนภูเก็ต SL 15/10/26 (1คัน) นายสมศักดิ์', amt: 2900, at: '16:02' });
  b.out.push({ id: 'h4', txt: 'ค่าแรงไกด์รัสเซียไปเกาะสิมิลัน 15/10/26 (Romeo) SL (Guide Elias)', amt: 1500, at: '16:11' });
  b.out.push({ id: 'pkl|tublamu|2026-10-15|zz', src: 'pk', txt: 'ค่าอุทยานเกาะสิมิลัน 15 ต.ค. 69 Zeus', amt: 15100, at: '' });
  b['in'].push({ id: 'h5', txt: 'รับเงินคืน 3 วัน', amt: 90000, at: '09:00' });
  _pcPier = P; _pcDate = '2026-10-16'; _pcYM = '2026-10'; _pcTab = 0; _pcSugC = null; renderPierCash(P);
  pc2EdNew('out'); });
await page.waitForTimeout(300);
const box = () => page.evaluate(() => { const b = document.getElementById('pc2-sug'); return b ? [...b.querySelectorAll('[data-i]')].map(e => e.textContent.replace(/\s+/g, ' ').trim()) : null; });
const b1 = await box();
const want1 = ['ค่ารถตู้นอกโซนภูเก็ต SL 16/10/26 (1คัน) นายสมศักดิ์ 15 ต.ค. · 2 ครั้ง 2,900', 'ค่าแรงไกด์รัสเซียไปเกาะสิมิลัน 16/10/26 (Romeo) SL (Guide Elias) 15 ต.ค. 1,500', 'ค่าอาหารกลางวันอุทยานสุรินทร์ 16 ต.ค. 69 14 ต.ค. 11,000'];
const ns = a => a.map(x => x.replace(/\s+/g, ''));
if (b1 && JSON.stringify(ns(b1)) === JSON.stringify(ns(want1))) ok('1 เปิดบรรทัดใหม่ → แนะนำ 3 รายการ (ล่าสุดก่อน · รถตู้ 2 วันรวมเป็นอันเดียว 2 ครั้ง · ไม่มีบรรทัดดึงจากชีท/รายรับ)'); else fail('1 ' + JSON.stringify(b1));
await page.type('#pc2-ed-txt', 'ไกด์'); await page.waitForTimeout(200);
const b2 = await box();
if (b2 && b2.length === 1 && /^ค่าแรงไกด์รัสเซียไปเกาะสิมิลัน 16\/10\/26/.test(b2[0])) ok('2 พิมพ์ "ไกด์" → เหลือ 1 รายการ · วันที่เปลี่ยนเป็น 16/10/26'); else fail('2 ' + JSON.stringify(b2));
await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
const e3 = await page.evaluate(() => { const E = pc2EdCur(); return { txt: E.txt, amt: E.amt, focus: document.activeElement && document.activeElement.id, box: !!document.getElementById('pc2-sug') }; });
await page.keyboard.press('Enter'); await page.waitForTimeout(250);
const s3 = await page.evaluate(() => pcDay('tublamu', '2026-10-16').out.map(x => x.txt + '=' + x.amt));
if (e3.txt === 'ค่าแรงไกด์รัสเซียไปเกาะสิมิลัน 16/10/26 (Romeo) SL (Guide Elias)' && e3.amt === '1500' && e3.focus === 'pc2-ed-amt' && !e3.box && s3.length === 1 && s3[0] === e3.txt + '=1500')
  ok('3 ↓ Enter → ข้อความวันใหม่ + ยอด 1,500 · โฟกัสช่องยอด · Enter = บันทึก');
else fail('3 ' + JSON.stringify({ e3, s3 }));
const c4 = await page.evaluate(() => [pcSugRedate('ค่าอาหาร 15 ต.ค. 69', '2026-10-16'), pcSugRedate('ค่าเรือ 15/10/2569 และ 15/10/2026', '2026-10-16'), pcSugRedate('ค่ารถ 5/1/26', '2026-10-16')]);
if (JSON.stringify(c4) === JSON.stringify(['ค่าอาหาร 16 ต.ค. 69', 'ค่าเรือ 16/10/2569 และ 16/10/2026', 'ค่ารถ 16/10/26'])) ok('4 รูปแบบวันที่: ' + c4.join(' · ')); else fail('4 ' + JSON.stringify(c4));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('5 ไม่มี error'); else fail('5 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
