// §cotNoWhy · COT ที่ปิด "เก็บไม่ได้" แล้ว ต้องออกจาก "ยังไม่ได้เก็บ" และกล่องสรุปต้องบอกเหตุผลของใบนั้น
//
// ที่มา (6 ต.ค. 2026) · เจ้าของ: "อันที่ระบุว่ายังไม่ได้เก็บ 1000 แต่ในด้านล่างระบุแล้วว่าเก็บไม่ได้เพราะอะไร
//   สรุปบนควรระบุให้หน่อยว่าเก็บไม่ได้เพราะอะไร"
//   ภาพหน้าจอ: กล่อง "ต้องเคลียร์ก่อนปิดวัน" ขึ้น (!) ยังไม่ได้เก็บ ฿1,000 ซ้อนกับ COT เก็บไม่ได้ ฿1,000 · 1 ใบ
//   ขณะที่แถว EXC33245 ปิดไว้แล้วว่า "ไม่มา (No-show) 2 คน · รอแล้วไม่ลงมา · 100% CHARGE"
//
// กันหกอย่าง
//   1 ก่อนตัดสิน · ใบมี COT และยังมีคนเดินทาง · "ยังไม่ได้เก็บ" รวมยอดนั้น · แถวขึ้น "รอเก็บ" · ธง due ติด
//   2 กดเก็บไม่ได้พร้อมเหตุผล · "ยังไม่ได้เก็บ" ลดลงเท่ายอด COT · มีบรรทัด "เก็บไม่ได้ ฿X · <voucher> · <เหตุผล>" (✓ ไม่ใช่ !) · ไม่มีบรรทัดรวมแบบเก่า
//   3 แถวนั้นสถานะ "เก็บไม่ได้ ฿X" (ไม่ใช่รอเก็บ) · ธง due ดับ · การ์ดหัว "เงินที่ต้องเก็บหน้าท่า" บอก เก็บไม่ได้ … ปิดพร้อมเหตุผลแล้ว
//   4 ลบเหตุผลออก · บรรทัดนั้นกลายเป็น (!) "ยังไม่ระบุเหตุผล" · เอกสารพิมพ์ (tsDocCompose) กล่อง C มีบรรทัดนั้นด้วย
//   5 ล้างคำตัดสิน · กลับเป็นแบบข้อ 1 ทุกอย่าง (ไม่มีอะไรค้าง)
//   6 ไม่เขียนทับข้อมูลใบจอง · pierPayments/cashOnTour เท่าเดิม · TS_COT ไม่มี key ค้าง
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1100 });
page.on('dialog', async d => { try { await d.accept(); } catch (_) {} });
await goView(page, 'travelsum', 700);
const DATE = '2026-09-15';
const WHY = 'ไม่มา (No-show) 2 คน · รอแล้วไม่ลงมา · 100% CHARGE';

const pick = await page.evaluate((DATE) => {
  _tsDate = DATE; _tsPier = ''; _tsRoute = ''; _tsVatF = ''; renderTravelSum();
  /* ชุดข้อมูลนี้ COT ทุกใบเก็บแล้ว · จำลองใบที่ "มีคนเดินทาง + COT ยังไม่ได้เก็บ" ด้วยการใส่ cashOnTour ในหน่วยความจำ (ไม่ save) · ถอดออกตอนจบ */
  const rows = tsRows(DATE).filter(r => r.travelled > 0 && r.travelled === r.booked);
  for (const r of rows) {
    const b = r.b, m0 = tsMoneyOf(b, DATE);
    if (m0.target === 0 && m0.paid === 0 && !(b.pierPayments || []).length && !(b.cashOnTour && +b.cashOnTour.amount > 0) && !tsCotGet(b.id, DATE) && !bkV2ExtrasFor(b.id).length) {
      b.cashOnTour = { amount: 1000, currency: 'THB', handling: 'deduct', note: '' }; renderTravelSum();
      const m = tsMoneyOf(b, DATE);
      if (+(m.M && m.M.cot) === 1000 && m.due === 1000) return { id: b.id, code: b.voucherRef || b.code, cot: 1000, due: m.due, trav: r.travelled, snap: JSON.stringify({ pp: b.pierPayments || null, cot: b.cashOnTour || null }) };
      delete b.cashOnTour;
    }
  }
  return { err: 'no booking to simulate COT on' };
}, DATE);
if (pick.err) { fail('prep ' + pick.err); await close(); process.exit(1); }

const read = () => page.evaluate(({ id, code }) => {
  const h = document.getElementById('travelsum-host'), num = s => +String(s || '').replace(/[^0-9.\-]/g, '') || 0, T = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
  const todo = [...h.querySelectorAll('[data-m="todo"] .m5-todo > div')].map(d => ({ w: +d.getAttribute('data-w'), t: T(d.querySelector('span:last-child')) }));
  const tr = [...h.querySelectorAll('.ts-s03 table tbody tr')].find(r => r.textContent.includes(code));
  const stat = tr ? T(tr.children[tr.children.length - 1]) : null;
  const dueLine = h.querySelector('.h4-checks [data-tschk="due"]');
  const b = SB_BOOKINGS.find(x => x.id === id), r = tsRows(_tsDate).find(x => x.b.id === id), f = tsRowFlags(r, _tsDate);
  const pend = [...h.querySelectorAll('.ts-pay .ts-p.pend .pn')].map(T)[0] || '';
  return { todo, stat, need: tr ? tr.classList.contains('need') : null, dueLine: T(dueLine), dueW: dueLine ? +dueLine.getAttribute('data-w') : null, fDue: f.due, pend,
    snap: JSON.stringify({ pp: b.pierPayments || null, cot: b.cashOnTour || null }), cotKey: !!tsCotGet(id, _tsDate) };
}, { id: pick.id, code: pick.code });

const dueOf = R => { const t = R.todo.find(x => /ยังไม่ได้เก็บ/.test(x.t)); return t ? +t.t.replace(/[^0-9]/g, '') : 0; };
const hasReasonLine = (R, why) => { const want = 'เก็บไม่ได้ ฿' + pick.cot.toLocaleString('en-US') + ' · ' + pick.code + ' · ' + (why || ''); return R.todo.find(x => x.t.startsWith(want)); };

/* 1 */
const R1 = await read();
const due1 = dueOf(R1);
if (due1 >= pick.cot && /^รอเก็บ/.test(R1.stat) && R1.need && R1.fDue && !R1.todo.some(x => /เก็บไม่ได้/.test(x.t)) && /ยังค้าง/.test(R1.dueLine) && R1.dueW === 1)
  ok(`1 ก่อนตัดสิน · ใบ ${pick.code} · COT ${pick.cot} · เดินทาง ${pick.trav} คน · ยังไม่ได้เก็บ ${due1} รวมยอดนี้ · แถว "${R1.stat}" · ธง due ติด`);
else fail('1 ' + JSON.stringify({ due1, pick, R1 }));

/* 2 */
await page.evaluate(({ id, DATE, cot, WHY }) => { tsCotPick(id, DATE, 'nocol', cot, encodeURIComponent(WHY)); }, { id: pick.id, DATE, cot: pick.cot, WHY });
await page.waitForTimeout(250);
const R2 = await read();
const due2 = dueOf(R2), L2 = hasReasonLine(R2, WHY);
if (due2 === due1 - pick.cot && L2 && L2.w === 0 && !R2.todo.some(x => /ปิดพร้อมเหตุผลแล้ว$/.test(x.t) && /ใบ ·/.test(x.t)) && /เก็บไม่ได้ ฿.*ปิดพร้อมเหตุผลแล้ว ไม่นับ/.test(R2.pend))
  ok(`2 กดเก็บไม่ได้ · ยังไม่ได้เก็บ ${due1} → ${due2} · บรรทัด "${L2.t}" (✓)`);
else fail('2 ' + JSON.stringify({ due1, due2, L2, todo: R2.todo, pend: R2.pend }));

/* 3 */
if (R2.stat && /^เก็บไม่ได้ ฿/.test(R2.stat) && /ปิดพร้อมเหตุผลแล้ว/.test(R2.stat) && !/รอเก็บ/.test(R2.stat) && R2.need === false && R2.fDue === false && /เก็บไม่ได้ ฿.*ปิดพร้อมเหตุผลแล้ว/.test(R2.dueLine) && (due2 > 0 ? R2.dueW === 1 : R2.dueW === 0))
  ok(`3 แถวสถานะ "${R2.stat}" · ธง due ดับ · การ์ดหัว "${R2.dueLine}"`);
else fail('3 ' + JSON.stringify({ stat: R2.stat, need: R2.need, fDue: R2.fDue, dueLine: R2.dueLine, dueW: R2.dueW, due2 }));

/* 4 */
await page.evaluate(({ id, DATE }) => { const c = tsCotGet(id, DATE); c.ref = ''; tsAfter(); }, { id: pick.id, DATE });
await page.waitForTimeout(250);
const R4 = await read();
const L4 = R4.todo.find(x => /^เก็บไม่ได้ ฿/.test(x.t) && x.t.includes(pick.code));
const doc4 = await page.evaluate(() => { const d = document.createElement('div'); d.innerHTML = tsDocCompose(); const box = [...d.querySelectorAll('.box')].find(b => /ก่อนปิดวัน/.test(b.textContent)); return box ? box.textContent.replace(/\s+/g, ' ') : ''; });
if (L4 && L4.w === 1 && /ยังไม่ระบุเหตุผล/.test(L4.t) && /ยังไม่ระบุเหตุผล/.test(R4.stat) && /เก็บไม่ได้ ฿.*ยังไม่ระบุเหตุผล/.test(doc4))
  ok(`4 ลบเหตุผล · บรรทัดเป็น (!) "${L4.t}" · แถว "${R4.stat}" · เอกสารพิมพ์กล่อง C มีบรรทัดนี้`);
else fail('4 ' + JSON.stringify({ L4, stat: R4.stat, doc4: doc4.slice(0, 400) }));

/* 5 */
await page.evaluate(({ id, DATE }) => tsCotClear(id, DATE), { id: pick.id, DATE });
await page.waitForTimeout(250);
const R5 = await read();
if (dueOf(R5) === due1 && R5.stat === R1.stat && R5.need && R5.fDue && !R5.todo.some(x => /เก็บไม่ได้/.test(x.t)) && R5.dueLine === R1.dueLine)
  ok(`5 ล้างคำตัดสิน · กลับเป็นเหมือนข้อ 1 (ยังไม่ได้เก็บ ${dueOf(R5)} · "${R5.stat}")`);
else fail('5 ' + JSON.stringify({ R1: { due: due1, stat: R1.stat, dueLine: R1.dueLine }, R5 }));

/* 6 */
if (R5.snap === pick.snap && !R5.cotKey) ok('6 ข้อมูลใบจองไม่ถูกแตะ (pierPayments / cashOnTour เท่าเดิม) · TS_COT ไม่มี key ค้าง');
else fail('6 ' + JSON.stringify({ before: pick.snap, after: R5.snap, cotKey: R5.cotKey }));

await page.evaluate((id) => { const b = SB_BOOKINGS.find(x => x.id === id); delete b.cashOnTour; renderTravelSum(); }, pick.id);

const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e));
if (e1.length) fail('errors: ' + e1.slice(0, 3).join(' | '));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
