// §tsSreq · คำขอพิเศษต้องขึ้นบน Travel Summary
//
// ที่มา (2026-10-01) · ผู้ใช้ส่งภาพสองหน้ามาเทียบกัน ใบ LOV-2766772 ของวันที่ 29 ก.ย.
//   หน้า By trip date ช่อง SPECIAL REQUEST เขียนว่า
//     "เปลี่ยนมาจากเกาะพีพี ไม่ท่อน คืนเงินหน้าท่าเรือ 3,403 // CS แจ้งเวลา"
//   แต่ใน Travel Summary ไม่มีข้อความนี้อยู่ที่ไหนเลย
//
// ทำไมข้อนี้ไม่ใช่แค่คอลัมน์หาย
//   Travel Summary คือเอกสารปิดเงินประจำวัน ท้ายเอกสารมีช่องเซ็นของ Operations /
//   Finance / Management · บรรทัดที่หายไปบอกว่าต้องคืนเงิน 3,403 บาทที่ท่าเรือ
//   ขณะที่ในเอกสารขึ้นว่า Paid และ COT ยังไม่ระบุยอด
//   คนที่ถือเอกสารนี้อย่างเดียวจึงไม่มีทางรู้ว่ามีเงินต้องคืน
//
// ที่วางเป็นแถวเต็มความกว้าง ไม่ใช่คอลัมน์ที่ 17 เพราะข้อความจริงยาว 70-150 ตัวอักษร
// ส่วนตารางนี้ตอนพิมพ์เป็น table-layout:fixed + overflow:hidden ทุกช่อง
// ยัดเป็นคอลัมน์ 8% บน A4 แนวนอนแล้วข้อความจะโดนตัดหายตอนพิมพ์
//
// เทสนี้กันหกอย่าง
//   1 คำขอพิเศษขึ้นเป็นแถวถัดจากบรรทัดของใบนั้น ไม่ใช่ลอยอยู่ที่อื่น
//   2 ข้อความขึ้นครบทุกตัว ไม่ถูกตัดกลางคัน
//   3 ท่อน COT ถูกตัดออก ไม่ขึ้นซ้ำกับคอลัมน์ COT ที่มีอยู่แล้ว
//   4 ใบที่ไม่มีคำขอ ไม่มีแถบโผล่ · เอกสารไม่ยาวขึ้นเปล่า ๆ
//   5 ตอนพิมพ์ต้องยังเห็นและไม่โดนตัด (วัดจาก computed style จริง ไม่ใช่อ่าน CSS)
//   6 ไม่มี error บนหน้า

import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const NOTE = 'เปลี่ยนมาจากเกาะพีพี ไม่ท่อน คืนเงินหน้าท่าเรือ 3,403 // CS แจ้งเวลา';
const COT  = ' · COT 2,000';

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1300 });
await goView(page, 'booking', 900);

/* ══ 0 · ใส่คำขอพิเศษให้ใบหนึ่ง และล้างของอีกใบในวันเดียวกัน ═══════════ */
const R0 = await page.evaluate(([note, cot]) => {
  if (typeof tsSreqOf !== 'function') return { err: 'ยังไม่มี tsSreqOf' };
  const byDate = {};
  (SB_BOOKINGS || []).forEach(b => {
    if (!b || (typeof ckIsCxl === 'function' && ckIsCxl(b))) return;
    (b.trips || []).forEach(t => { if (!t.date || !t.routeId) return; (byDate[t.date] = byDate[t.date] || []).push(b); });
  });
  const date = Object.keys(byDate).sort().find(d => byDate[d].length >= 2);
  if (!date) return { err: 'ไม่มีวันไหนที่มี booking ถึงสองใบ' };
  const [A, B] = byDate[date];
  const prev = { a: A.notes, b: B.notes };
  A.notes = note + cot;     // ใบที่มีคำขอ · พ่วงท่อน COT มาด้วยแบบของจริง
  B.notes = '';             // ใบที่ไม่มีคำขอเลย
  if (typeof acctPersistBookings === 'function') acctPersistBookings();
  return { date, prev,
           A: { id: A.id, vc: A.voucherRef || A.code || A.id, sreq: tsSreqOf(A) },
           B: { id: B.id, vc: B.voucherRef || B.code || B.id, sreq: tsSreqOf(B) } };
}, [NOTE, COT]);
if (R0.err) { fail(R0.err); console.log('\n✗ 1 ข้อไม่ผ่าน'); await close(); process.exit(1); }
ok('ตั้งใบทดสอบในวันที่ ' + R0.date + ' · ใบที่มีคำขอ ' + R0.A.vc + ' · ใบที่ไม่มี ' + R0.B.vc);

await goView(page, 'travelsum', 900);

/* ══ 1 · 2 · 3 · 4 ═══════════════════════════════════════════════════ */
const R = await page.evaluate(([date, vcA, vcB]) => {
  _tsDate = date; _tsRoute = ''; _tsVatF = ''; _tsOnlyIssue = false;
  renderTravelSum();
  const trs = [...document.querySelectorAll('#travelsum-host table.ts-man tbody tr')];
  const rowOf = vc => trs.findIndex(t => !t.classList.contains('ts-sqrow') && (t.textContent || '').indexOf(vc) >= 0);
  const iA = rowOf(vcA), iB = rowOf(vcB);
  const nextA = iA >= 0 ? trs[iA + 1] : null;
  const nextB = iB >= 0 ? trs[iB + 1] : null;
  const host = document.querySelector('#travelsum-host');
  return {
    iA, iB,
    aHasRow: !!(nextA && nextA.classList.contains('ts-sqrow')),
    aText: nextA && nextA.classList.contains('ts-sqrow')
             ? ((nextA.querySelector('.ts-sqtx') || {}).textContent || '').trim() : '',
    aSpan: nextA && nextA.querySelector('td') ? nextA.querySelector('td').getAttribute('colspan') : '',
    bHasRow: !!(nextB && nextB.classList.contains('ts-sqrow')),
    nSq: document.querySelectorAll('#travelsum-host tr.ts-sqrow').length,
    cotInSq: [...document.querySelectorAll('#travelsum-host .ts-sqtx')]
               .some(x => /COT/i.test(x.textContent || '')),
    cols: document.querySelectorAll('#travelsum-host table.ts-man thead th').length,
    pageHasText: (host.textContent || '').indexOf('คืนเงินหน้าท่าเรือ 3,403') >= 0
  };
}, [R0.date, R0.A.vc, R0.B.vc]);

if (R.iA < 0) fail('ข้อ 1 · หาบรรทัดของใบที่มีคำขอไม่เจอใน Manifest');
else if (!R.pageHasText)
  fail('คำขอพิเศษไม่ขึ้นบน Travel Summary เลย · คนปิดวันจะไม่รู้ว่ามีเงินต้องคืน 3,403');
else if (!R.aHasRow)
  fail('ข้อความขึ้นบนหน้า แต่ไม่ได้อยู่แถวถัดจากบรรทัดของใบนั้น · อ่านไม่ออกว่าเป็นของใบไหน');
else if (R.aSpan !== String(R.cols))
  fail('แถบคำขอพิเศษกว้าง ' + R.aSpan + ' ช่อง แต่ตารางมี ' + R.cols + ' คอลัมน์ · ตารางจะเบี้ยว');
else ok('คำขอพิเศษขึ้นเป็นแถบเต็มความกว้างใต้บรรทัดของใบ ' + R0.A.vc);

if (R.iA >= 0 && R.aHasRow) {
  if (R.aText !== R0.A.sreq)
    fail('ข้อความไม่ตรงกับในใบจอง · ได้ "' + R.aText + '" ควรเป็น "' + R0.A.sreq + '"');
  else if (R.aText.indexOf('3,403') < 0)
    fail('ตัวเลขเงินหายไปจากข้อความ · ส่วนที่สำคัญที่สุดของบรรทัดนี้');
  else ok('ข้อความขึ้นครบทุกตัว ' + R.aText.length + ' อักขระ · รวมยอดเงิน 3,403 ที่ต้องคืน');

  if (R.cotInSq)
    fail('ท่อน COT ยังติดมาในแถบคำขอพิเศษ · เอกสารมีคอลัมน์ COT อยู่แล้ว ยอดจะขึ้นซ้ำสองที่');
  else ok('ท่อน COT ถูกตัดออกจากแถบ · ไม่ขึ้นซ้ำกับคอลัมน์ COT ที่มีอยู่แล้ว');
}

if (R.iB < 0) fail('ข้อ 4 · หาบรรทัดของใบที่ไม่มีคำขอไม่เจอ');
else if (R.bHasRow)
  fail('ใบที่ไม่มีคำขอพิเศษก็ยังมีแถบโผล่ · เอกสารจะยาวขึ้นเท่าตัวโดยไม่ได้อะไร');
else ok('ใบที่ไม่มีคำขอไม่มีแถบโผล่ · ทั้งวันมีแถบ ' + R.nSq + ' แถบเท่าที่มีคำขอจริง');

/* ══ 5 · ตอนพิมพ์ ═══════════════════════════════════════════════════
   เอกสารนี้ถูกพิมพ์ออกมาเซ็น · ถ้าแถบนี้หายตอนพิมพ์ ก็เท่ากับไม่ได้แก้อะไร
   ตารางตั้ง overflow:hidden ไว้ทุกช่องตอนพิมพ์ จึงต้องวัดของจริง ไม่ใช่อ่าน CSS */
{
  await page.emulateMedia({ media: 'print' });
  const P = await page.evaluate(() => {
    const td = document.querySelector('#travelsum-host tr.ts-sqrow td');
    if (!td) return { miss: true };
    const cs = getComputedStyle(td);
    const tx = td.querySelector('.ts-sqtx');
    const cst = tx ? getComputedStyle(tx) : null;
    /* ล้นได้ทั้งสองทาง · nowrap ล้นแนวนอน · ช่องเตี้ยเกินล้นแนวตั้ง
       วัดแค่ทางเดียวแล้วอีกทางหลุดไปขึ้นกระดาษแบบโดนตัดโดยไม่มีใครรู้ */
    return { miss: false, display: cs.display, visibility: cs.visibility, overflow: cs.overflow,
             h: td.clientHeight, scrollH: td.scrollHeight,
             w: td.clientWidth, scrollW: td.scrollWidth,
             txH: tx ? tx.clientHeight : 0, txScrollH: tx ? tx.scrollHeight : 0,
             txW: tx ? tx.clientWidth : 0, txScrollW: tx ? tx.scrollWidth : 0,
             txDisplay: cst ? cst.display : '', txSize: cst ? cst.fontSize : '' };
  });
  await page.emulateMedia({ media: 'screen' });
  if (P.miss) fail('ข้อ 5 · ตอนพิมพ์ไม่มีแถบคำขอพิเศษอยู่ในหน้าเลย');
  else if (P.display === 'none' || P.visibility === 'hidden' || P.txDisplay === 'none')
    fail('แถบคำขอพิเศษถูกซ่อนตอนพิมพ์ · บนกระดาษที่เอาไปเซ็นจะไม่มีบรรทัดนี้');
  else if (P.scrollH > P.h + 1)
    fail('ตอนพิมพ์ข้อความล้นช่องแนวตั้งแล้วโดนตัด · สูงจริง ' + P.scrollH + 'px แต่ช่องสูง ' + P.h + 'px');
  else if (P.scrollW > P.w + 1)
    fail('ตอนพิมพ์ข้อความล้นช่องแนวนอนแล้วโดนตัด · ยาวจริง ' + P.scrollW + 'px แต่ช่องกว้าง ' + P.w + 'px');
  else if (P.txScrollW > P.txW + 1 || P.txScrollH > P.txH + 1)
    fail('ตอนพิมพ์ตัวข้อความเองถูกบีบจนล้นแล้วโดนตัด · จริง '
         + P.txScrollW + '×' + P.txScrollH + 'px แต่กล่อง ' + P.txW + '×' + P.txH + 'px');
  else if (!(P.h > 0)) fail('ตอนพิมพ์แถบสูง 0px · ไม่มีอะไรให้อ่าน');
  else ok('ตอนพิมพ์ยังเห็นครบ · สูง ' + P.h + 'px · ตัวอักษร ' + P.txSize + ' · ไม่โดนตัด');
}

/* ══ 6 ═══════════════════════════════════════════════════════════ */
await page.evaluate(([idA, idB, prev]) => {
  const A = (SB_BOOKINGS || []).find(x => x.id === idA);
  const B = (SB_BOOKINGS || []).find(x => x.id === idB);
  if (A) A.notes = prev.a; if (B) B.notes = prev.b;
  if (typeof acctPersistBookings === 'function') acctPersistBookings();
}, [R0.A.id, R0.B.id, R0.prev]);
if (errors.length) fail('มี error บนหน้า · ' + errors.slice(0, 3).join(' | '));
else ok('ไม่มี error บนหน้า');

await close();
console.log(bad ? '\n✗ ' + bad + ' ข้อไม่ผ่าน' : '\n✓ ผ่านทั้งหมด');
process.exit(bad ? 1 : 0);
