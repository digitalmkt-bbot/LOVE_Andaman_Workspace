// §pcRefund · เงินสดย่อย · สรุปตั้งเบิกรายวัน + จับคู่เงินคืนกับวันที่ตั้งเบิก
// ที่มา (2026-10-15) · owner "ในแต่ละวันต้องสรุปสำหรับการตั้งเบิก ว่าชื่อรายการนี้ยอดเท่าไหร่ · วันที่มีเงินคืนมาอาจเป็น 3 วันรวมกันเป็น 1 ก้อน
//   ก็รับเข้ามาในวันนั้น ๆ · ช่วยรีเช็คว่าตั้งเบิกไปแล้ว ยอดรับคืนมาตรงกัน" · เงินคืน = "รับเงินคืน…" หรือ "เงินเบิกคืน…" (ทั้งสอง)
// ข้อมูล (ท่าทับละมุ ในหน่วยความจำ): ตั้งเบิก 13 ต.ค. 30,000 · 14 = 25,000 · 15 = 40,000 · 16 = 10,000
//   17 "รับเงินคืน" 95,000 (ไม่ระบุวัน) · 17 "เงินทดรองเพิ่ม" 50,000 (ไม่ใช่เงินคืน) · 18 "เงินเบิกคืน 16/10/26" 9,500 · 19 "รับเงินคืน" 1,234 (ไม่มีชุดที่พอดี)
// กัน
//   1 95,000 → 13–15 ต.ค. ตรง (วันติดกันที่ยอดพอดี) · 9,500 → 16 ต.ค. จากข้อความ · ขาด 500 · 1,234 → ไม่ตรง · เงินทดรองไม่นับ
//   2 สมุดวันที่ 17: ชิป "↩ 13–15 ต.ค. · ตรง" · หมวด "เงินคืน" · บรรทัดเงินทดรองไม่มีชิป
//   3 การ์ดตั้งเบิก ณ 18: ค้างรับคืน 1 วัน (16 ต.ค. 500) · เงินคืนล่าสุดบอกวัน/ตรง/ขาด
//   4 สรุปตั้งเบิกวันที่ 15: แยกกลุ่ม รายการ ยอด · รวม 40,000 · สถานะคืนแล้วครบ (รับวันที่ 17) · 5 ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1200 });
await goView(page, 'pop-tublamu', 1000);
await page.evaluate(() => {
  window.pcGuard = () => true; window.pcSave = () => {};
  const P = 'tublamu', A = pcPier(P); Object.keys(A).forEach(k => delete A[k]);
  const d = ds => pcDay(P, ds, true);
  d('2026-10-13').out.push({ id: 'a1', txt: 'ค่ารถตู้นอกโซนภูเก็ต SL 13/10/26 (2คัน) นายA', amt: 20000, at: '16:00' }, { id: 'a2', txt: 'ค่าแรงไกด์รัสเซียไปเกาะสิมิลัน 13/10/26', amt: 10000, at: '16:10' });
  d('2026-10-14').out.push({ id: 'b1', txt: 'ค่าอาหารกลางวันอุทยานสุรินทร์ 14/10/26', amt: 25000, at: '19:00' });
  d('2026-10-15').out.push({ id: 'c1', txt: 'ค่ารถตู้นอกโซนภูเก็ต SL 15/10/26 (1คัน) นายB', amt: 2900, at: '16:02' }, { id: 'c2', txt: 'ค่ารถตู้นอกโซนภูเก็ต SL 15/10/26 (3คัน) นายC', amt: 8600, at: '16:06' },
    { id: 'c3', txt: 'ค่าแรงไกด์รัสเซียไปเกาะสิมิลัน 15/10/26 (Romeo)', amt: 1500, at: '16:11' }, { id: 'pkl|tublamu|2026-10-15|zz', src: 'pk', txt: 'ค่าอุทยานเกาะสิมิลัน 15 ต.ค. 69 Zeus', amt: 27000, at: '' });
  d('2026-10-16').out.push({ id: 'd1', txt: 'ซื้อน้ำแข็ง', amt: 10000, at: '10:00' });
  d('2026-10-17')['in'].push({ id: 'r1', txt: 'รับเงินคืน', amt: 95000, at: '09:00' }, { id: 'n1', txt: 'เงินทดรองเพิ่ม', amt: 50000, at: '09:30' });
  d('2026-10-18')['in'].push({ id: 'r2', txt: 'เงินเบิกคืน 16/10/26', amt: 9500, at: '09:00' });
  d('2026-10-19')['in'].push({ id: 'r3', txt: 'รับเงินคืน', amt: 1234, at: '09:00' });
  _pcPier = P; _pcTab = 0; _pcYM = '2026-10'; });
const M = await page.evaluate(() => { const R = pcRefundMatch('tublamu').res; const o = {}; Object.keys(R).forEach(k => o[k] = { days: R[k].days, how: R[k].how, diff: R[k].diff, exact: R[k].exact }); return o; });
const m1 = M.r1 && M.r1.exact && M.r1.how === 'run' && M.r1.days.join() === '2026-10-13,2026-10-14,2026-10-15'
  && M.r2 && M.r2.how === 'text' && M.r2.days.join() === '2026-10-16' && M.r2.diff === -500 && !M.r2.exact && M.r3 && !M.r3.exact && !M.n1;
if (m1) ok('1 95,000 → 13–15 ต.ค. ตรง · 9,500 "เงินเบิกคืน 16/10/26" → 16 ต.ค. ขาด 500 · 1,234 ไม่ตรง · เงินทดรองไม่นับเป็นเงินคืน'); else fail('1 ' + JSON.stringify(M));
const r2 = await page.evaluate(() => { _pcDate = '2026-10-17'; renderPierCash('tublamu');
  const row = id => document.getElementById(pcSelRowId('in', id));
  return { c1: (row('r1').querySelector('.pc-rf') || {}).textContent, cat1: row('r1').querySelector('.ct em').textContent, c2: !!row('n1').querySelector('.pc-rf'), cat2: row('n1').querySelector('.ct em').textContent }; });
if (r2.c1 === '↩ 13–15 ต.ค. · ตรง' && r2.cat1 === 'เงินคืน' && !r2.c2 && r2.cat2 === 'รับเงิน') ok('2 สมุด 17 ต.ค.: "↩ 13–15 ต.ค. · ตรง" · หมวดเงินคืน · เงินทดรองเป็นรับเงินธรรมดา'); else fail('2 ' + JSON.stringify(r2));
const r3 = await page.evaluate(() => { _pcDate = '2026-10-18'; renderPierCash('tublamu'); const c = document.querySelector('#pc-host-tublamu .pc2-claim'); return c ? c.innerText.replace(/\s+/g, ' ') : ''; });
if (/ค้างรับคืน · 1 วัน 16 ต\.ค\. ฿500/.test(r3) && /คืนของ 16 ต\.ค\. ฿9,500 ขาด 500/.test(r3) && /คืนของ 13–15 ต\.ค\. ฿95,000 ตรง/.test(r3)) ok('3 การ์ด ณ 18 ต.ค.: ค้างรับคืน 16 ต.ค. 500 · เงินคืน 9,500 ขาด 500 · 95,000 ตรง'); else fail('3 ' + r3);
const r4 = await page.evaluate(() => { _pcDate = '2026-10-15'; let html = ''; const o = window.open; window.open = () => ({ document: { open() {}, write(h) { html += h; }, close() {} }, focus() {} });
  pcPrintClaim(); window.open = o; const d = document.createElement('div'); d.innerHTML = html;
  return { gh: [...d.querySelectorAll('.cl-tb tr.gh')].map(t => t.textContent.replace(/\s+/g, ' ').trim()), sum: (d.querySelector('.cl-tb tr.sum') || {}).textContent, st: (d.querySelector('.cl-st') || {}).textContent }; });
if (JSON.stringify(r4.gh) === JSON.stringify(['รถตู้ · 2 รายการ11,500', 'ไกด์ · 1 รายการ1,500', 'อุทยานสิมิลัน · 1 รายการ27,000']) && /40,000/.test(r4.sum) && /คืนแล้ว 40,000 บาท \(รับวันที่ .*\) · ครบ/.test(r4.st))
  ok('4 สรุปตั้งเบิก 15 ต.ค.: รถตู้ 11,500 · ไกด์ 1,500 · อุทยานสิมิลัน 27,000 · รวม 40,000 · คืนแล้วครบ');
else fail('4 ' + JSON.stringify(r4));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('5 ไม่มี error'); else fail('5 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
