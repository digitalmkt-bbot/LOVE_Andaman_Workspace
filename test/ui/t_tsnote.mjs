// §tsSreq · คำขอพิเศษต้องขึ้นบน Travel Summary · เป็นคอลัมน์หน้า Pay
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
// รูปแบบที่ใช้ · ทีมเลือกเองหลังเห็นของจริงสองแบบ (แถบใต้บรรทัด vs คอลัมน์)
//   เป็น "คอลัมน์ของตัวเอง วางหน้า Pay" เพราะเรื่องที่เขียนในช่องนี้ส่วนใหญ่ผูกกับเงิน
//   คนปิดวันอ่านสองช่องติดกันจบ ไม่ต้องกวาดตาข้ามตาราง
//
// เทสนี้กันเจ็ดอย่าง
//   1 มีคอลัมน์คำขอพิเศษ และอยู่ติดกันหน้า Pay ตามที่ทีมสั่ง
//   2 ข้อความขึ้นครบทุกตัวในช่องของใบนั้นเอง ไม่ใช่ไปโผล่แถวอื่น
//   3 ท่อน COT ถูกตัดออก ไม่ขึ้นซ้ำกับคอลัมน์ COT ที่มีอยู่แล้ว
//   4 ใบที่ไม่มีคำขอขึ้นขีด ไม่ใช่ช่องว่างเปล่าที่อ่านไม่ออกว่าไม่มีหรือลืมใส่
//   5 ตอนพิมพ์ต้องไม่โดนตัด (วัดจาก computed style จริง ทั้งแนวตั้งและแนวนอน)
//   6 จำนวนคอลัมน์ใน thead ตรงกับ colspan ของแถวหัวเส้นทาง · ตารางไม่เบี้ยว
//   7 ไม่มี error บนหน้า

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

/* ══ 1 · 2 · 3 · 4 · 6 ═══════════════════════════════════════════════ */
const R = await page.evaluate(([date, vcA, vcB]) => {
  _tsDate = date; _tsRoute = ''; _tsVatF = ''; _tsOnlyIssue = false;
  renderTravelSum();
  const host = document.querySelector('#travelsum-host');
  const ths = [...document.querySelectorAll('#travelsum-host table.ts-man thead th')];
  const head = ths.map(t => (t.textContent || '').replace(/\s+/g, ' ').trim());
  const iSq  = head.findIndex(t => /คำขอพิเศษ/.test(t));
  const iPay = head.findIndex(t => /^Pay/.test(t));
  const trs = [...document.querySelectorAll('#travelsum-host table.ts-man tbody tr')];
  const rowOf = vc => trs.findIndex(t => (t.textContent || '').indexOf(vc) >= 0);
  const cellOf = vc => { const i = rowOf(vc); if (i < 0 || iSq < 0) return null;
    const td = trs[i].querySelectorAll('td')[iSq]; return td ? (td.textContent || '').trim() : null; };
  /* §tsManSheet (2026-10-05) เพิ่มช่องเลขแถว (td.ts-rn) หน้าช่อง colspan · วัดผลรวม colspan ทั้งแถวแทนช่องแรก */
  const growTr = document.querySelector('#travelsum-host table.ts-man tbody tr.ts-grow');
  const grow = growTr ? { getAttribute: () => [...growTr.querySelectorAll('td')].reduce((n, td) => n + (+td.getAttribute('colspan') || 1), 0) } : null;
  return {
    head, iSq, iPay, nCols: ths.length,
    growSpan: grow ? +grow.getAttribute('colspan') : 0,
    aCell: cellOf(vcA), bCell: cellOf(vcB),
    cotInCol: trs.some(tr => { const td = tr.querySelectorAll('td')[iSq];
      return td && /COT/i.test(td.textContent || ''); }),
    pageHasText: (host.textContent || '').indexOf('คืนเงินหน้าท่าเรือ 3,403') >= 0
  };
}, [R0.date, R0.A.vc, R0.B.vc]);

if (R.iSq < 0) fail('ไม่มีคอลัมน์คำขอพิเศษใน Manifest · คนปิดวันจะไม่รู้ว่ามีเงินต้องคืน 3,403');
else if (R.iPay < 0) fail('หาคอลัมน์ Pay ไม่เจอ · วัดตำแหน่งไม่ได้');
else if (R.iSq !== R.iPay - 1)
  fail('คอลัมน์คำขอพิเศษอยู่ลำดับ ' + (R.iSq + 1) + ' แต่ Pay อยู่ลำดับ ' + (R.iPay + 1)
       + ' · ทีมสั่งให้อยู่ติดกันหน้า Pay');
else ok('มีคอลัมน์คำขอพิเศษ อยู่ลำดับ ' + (R.iSq + 1) + ' ติดกันหน้า Pay · ทั้งตาราง ' + R.nCols + ' คอลัมน์');

if (R.iSq >= 0) {
  if (!R.pageHasText) fail('ข้อความคำขอพิเศษไม่ขึ้นบนหน้าเลย');
  else if (R.aCell !== R0.A.sreq)
    fail('ช่องของใบ ' + R0.A.vc + ' ได้ "' + R.aCell + '" ควรเป็น "' + R0.A.sreq + '"');
  else if (String(R.aCell).indexOf('3,403') < 0)
    fail('ตัวเลขเงินหายไปจากช่อง · ส่วนที่สำคัญที่สุดของบรรทัดนี้');
  else ok('ข้อความอยู่ในช่องของใบนั้นเอง ครบ ' + R.aCell.length + ' อักขระ · รวมยอด 3,403 ที่ต้องคืน');

  if (R.cotInCol)
    fail('ท่อน COT ยังติดมาในช่องคำขอพิเศษ · เอกสารมีคอลัมน์ COT อยู่แล้ว ยอดจะขึ้นซ้ำสองที่');
  else ok('ท่อน COT ถูกตัดออก · ไม่ขึ้นซ้ำกับคอลัมน์ COT ที่มีอยู่แล้ว');

  /* แยก null (หาแถวไม่เจอ) ออกจาก '' (เจอแถวแต่ช่องว่าง) · ถ้ารวมกันข้อความจะโทษผิดเรื่อง */
  if (R.bCell === null || R.bCell === undefined) fail('หาช่องของใบที่ไม่มีคำขอไม่เจอ');
  else if (R.bCell === '')
    fail('ใบที่ไม่มีคำขอได้ช่องว่างเปล่า · อ่านไม่ออกว่าไม่มีจริง หรือระบบลืมดึงมา');
  else ok('ใบที่ไม่มีคำขอขึ้น "' + R.bCell + '" · บอกชัดว่าไม่มี ไม่ใช่ช่องว่างกำกวม');

  if (!R.growSpan) fail('หาแถวหัวเส้นทางไม่เจอ · วัดความเบี้ยวของตารางไม่ได้');
  else if (R.growSpan !== R.nCols)
    fail('แถวหัวเส้นทาง colspan=' + R.growSpan + ' แต่ตารางมี ' + R.nCols + ' คอลัมน์ · ตารางจะเบี้ยว');
  else ok('colspan ของแถวหัวเส้นทางตรงกับจำนวนคอลัมน์ (' + R.nCols + ') · ตารางไม่เบี้ยว');
}

/* ══ 5 · ตอนพิมพ์ ═══════════════════════════════════════════════════
   เอกสารนี้ถูกพิมพ์ออกมาเซ็น · Manifest ตอนพิมพ์เป็น table-layout:fixed และตั้ง
   overflow:hidden ไว้ทุกช่อง · คอลัมน์ที่ข้อความยาวจึงเสี่ยงโดนตัดที่สุด
   วัดของจริงทั้งแนวตั้งและแนวนอน · วัดทางเดียวอีกทางหลุดได้ */
if (R.iSq >= 0) {
  await page.emulateMedia({ media: 'print' });
  const P = await page.evaluate(([vc, iSq]) => {
    const trs = [...document.querySelectorAll('#travelsum-host table.ts-man tbody tr')];
    const tr = trs.find(t => (t.textContent || '').indexOf(vc) >= 0);
    if (!tr) return { miss: true };
    const td = tr.querySelectorAll('td')[iSq];
    const tx = td.querySelector('.ts-sqtx');
    const cs = getComputedStyle(td);
    return { miss: false, display: cs.display, visibility: cs.visibility,
             h: td.clientHeight, scrollH: td.scrollHeight,
             w: td.clientWidth, scrollW: td.scrollWidth,
             txH: tx ? tx.clientHeight : 0, txScrollH: tx ? tx.scrollHeight : 0,
             txW: tx ? tx.clientWidth : 0, txScrollW: tx ? tx.scrollWidth : 0,
             txSize: tx ? getComputedStyle(tx).fontSize : '' };
  }, [R0.A.vc, R.iSq]);
  await page.emulateMedia({ media: 'screen' });
  if (P.miss) fail('ข้อ 5 · ตอนพิมพ์หาแถวของใบไม่เจอ');
  else if (P.display === 'none' || P.visibility === 'hidden')
    fail('ช่องคำขอพิเศษถูกซ่อนตอนพิมพ์ · บนกระดาษที่เอาไปเซ็นจะไม่มีข้อความนี้');
  else if (P.scrollH > P.h + 1)
    fail('ตอนพิมพ์ข้อความล้นช่องแนวตั้งแล้วโดนตัด · สูงจริง ' + P.scrollH + 'px แต่ช่องสูง ' + P.h + 'px');
  else if (P.scrollW > P.w + 1)
    fail('ตอนพิมพ์ข้อความล้นช่องแนวนอนแล้วโดนตัด · ยาวจริง ' + P.scrollW + 'px แต่ช่องกว้าง ' + P.w + 'px');
  else if (P.txScrollW > P.txW + 1 || P.txScrollH > P.txH + 1)
    fail('ตอนพิมพ์ตัวข้อความเองถูกบีบจนล้นแล้วโดนตัด · จริง '
         + P.txScrollW + '×' + P.txScrollH + 'px แต่กล่อง ' + P.txW + '×' + P.txH + 'px');
  else ok('ตอนพิมพ์อ่านครบ ไม่โดนตัด · ช่อง ' + P.w + '×' + P.h + 'px · ตัวอักษร ' + P.txSize);
}

/* ══ 7 ═══════════════════════════════════════════════════════════ */
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
