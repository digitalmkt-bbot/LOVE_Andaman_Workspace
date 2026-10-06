// §exCotPier · ขายเพิ่มจาก By trip แบบ "เก็บเงินวันเดินทาง" แล้วหน้าท่าเก็บเงินของใบนั้นแล้ว → ต้องนับว่าเก็บแล้ว ไม่ขึ้นรอเก็บซ้อน
//
// ที่มา (6 ต.ค. 2026) · เจ้าของ: "ขายผ่านหน้า By trip date แล้วเช็คอินเป็นคนกดเช็คอินแล้วรับเงินแล้ว ต้องทำอะไรอีกเหรอ"
//   Trip.com 2 ใบ · Travel Summary ขึ้น "เก็บครบ ฿1,000" ซ้อน "upgrade รอเก็บ ฿1,000" · กล่องต้องเคลียร์ขึ้น ฿2,000
//
// กันหกอย่าง
//   1 ก่อนเก็บเงิน · หน้าท่าเห็นต้องเก็บ 1,000 · Travel Summary เห็นรายการขายเพิ่ม "รอเก็บ" และ saleDue 1,000 (สองหน้าตรงกัน)
//   2 หน้าท่าเก็บเงินสด 1,000 (pierPayments) · หน้าท่า: ค้าง 0 · เก็บแล้ว 1,000 (ไม่ใช่ 2,000)
//   3 Travel Summary หลังเก็บ · รายการขายเพิ่มเป็น "เก็บที่ท่า" ไม่มี "รอเก็บ" · ไม่มีชิป "แนบสลิป Longtail" · สถานะใบ "เก็บครบ ฿1,000" · S.due 0
//   4 ยอดวัน · รับเข้ารวมเงินก้อนนี้ครั้งเดียว (เงินสด +1,000 ไม่ใช่ +2,000) · กล่อง "ต้องเคลียร์" ไม่มีบรรทัดขายเพิ่มรอเก็บ · คอมคนขายยังนับ
//   5 เก็บไม่ครบ (500 จาก 1,000) · ยังค้าง 500 ที่หน้าท่า และรายการขายเพิ่มยัง "รอเก็บ" (ไม่ปล่อยผ่าน)
//   6 รายการขายเพิ่มไม่ถูกแก้ข้อมูล (settle ยัง pending) · เป็นการอ่าน ไม่ใช่การเขียน
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1100 });
page.on('dialog', async d => { try { await d.accept(); } catch (_) {} });
await goView(page, 'travelsum', 700);
const DATE = '2026-09-15';

/* เลือกใบที่ไม่มี COT · ไม่มีเงินหน้าท่า · ไม่มี extra เดิม · ใส่รายการขายเพิ่มแบบ cot 1,000 */
const prep = await page.evaluate((DATE) => {
  const day = SB_BOOKINGS.filter(b => !['cancelled', 'rejected', 'cancelled_weather'].includes(b.status) && (b.trips || []).length === 1 && b.trips[0].date === DATE
    && !(b.cashOnTour && +b.cashOnTour.amount > 0) && !(b.pierPayments || []).length && !(b.upgrades || []).length && !(b.paymentSnapshot && +b.paymentSnapshot.balance > 0) && !bkV2ExtrasFor(b.id).length);
  const b = day[0]; if (!b) return { err: 'no booking' };
  SB_EXTRAS.push({ id: 'ex_test_cotpier', bookingId: b.id, tripDate: DATE, service: 'Longtail Join', qty: 2, unitPrice: 500, total: 1000, toCompany: 700, commission: 300, seller: 'TEST',
    method: 'cot', feePct: 0, fee: 0, customerPaid: 1000, slips: [], settle: 'pending', collectedAt: '', date: new Date().toISOString() });
  _tsDate = DATE; _tsPier = ''; _tsRoute = ''; _tsVatF = ''; renderTravelSum();
  const M = pckMoney(b, DATE), S = tsSaleList(b, DATE);
  return { id: b.id, code: b.code || b.voucherRef, pierDue: M.due, pierGot: M.got, exDue: M.exDue, exCov: M.exCov, sDue: S.due, sGot: S.got, done: S.list[0].done, covered: S.list[0].covered };
}, DATE);
const row = (id) => page.evaluate((id) => { const tr = [...document.querySelectorAll('#travelsum-host .ts-s03 table tbody tr')].find(r => r.innerHTML.includes(id) || r.textContent.includes(id)); if (!tr) return null;
  const sale = tr.querySelector('.ts-aocol'), stat = tr.children[tr.children.length - 1];
  return { saleTxt: sale ? sale.textContent.replace(/\s+/g, ' ').trim() : '', stat: stat.textContent.replace(/\s+/g, ' ').trim(), slip: /แนบสลิป Longtail/.test(tr.textContent), tip: (sale && sale.querySelector('.ts-ao') || {}).title || '' }; }, id);
const sums = () => page.evaluate(() => { const h = document.getElementById('travelsum-host'), num = s => +String(s || '').replace(/[^0-9.\-]/g, '') || 0, T = e => e ? e.textContent : '';
  return { cash: num(T(h.querySelector('[data-m="in"] .m5-rows b'))), tin: num(T(h.querySelector('[data-m="in"] .m5-hero b'))), todo: [...h.querySelectorAll('[data-m="todo"] .m5-todo > div')].map(d => d.textContent.replace(/\s+/g, ' ').trim()) }; });

const r1 = await row(prep.code || prep.id), s1 = await sums();
if (!prep.err && prep.pierDue === 1000 && prep.exDue === 1000 && prep.exCov === 0 && prep.sDue === 1000 && prep.done === false && r1 && /รอเก็บ/.test(r1.saleTxt) && /^ขายเพิ่ม รอเก็บ ฿1,000$/.test(r1.stat) && !/เก็บครบ/.test(r1.stat) && s1.todo.some(t => /ขายเพิ่ม\/upgrade รอเก็บอีก ฿1,000/.test(t)))
  ok(`1 ก่อนเก็บ · ใบ ${prep.code} · หน้าท่าต้องเก็บ ${prep.pierDue} · TS รายการ "รอเก็บ" · ป้าย "${r1.stat}" · กล่องต้องเคลียร์มีขายเพิ่มรอเก็บ 1,000`);
else fail('1 ' + JSON.stringify({ prep, r1, todo: s1.todo }));

/* หน้าท่าเก็บเงินสด 1,000 · เขียน pierPayments ตามโครงที่ pckPaySave เขียน */
const p2 = await page.evaluate(({ id, DATE }) => { const b = SB_BOOKINGS.find(x => x.id === id); b.pierPayments = [{ id: 'pp_test_1', date: DATE, amount: 1000, method: 'cash', fee: 0, feePct: null, note: '', slips: [], by: 'GSA.TEST', at: new Date().toISOString() }];
  renderTravelSum(); const M = pckMoney(b, DATE), S = tsSaleList(b, DATE), x = SB_EXTRAS.find(e => e.id === 'ex_test_cotpier');
  return { pierDue: M.due, pierGot: M.got, exDue: M.exDue, exCov: M.exCov, gotExtra: bkxExGot(x), covered: bkxExCovered(x), sDue: S.due, sGot: S.got, sBy: S.by, comm: S.comm, commCov: S.commCov, method: S.list[0].method, done: S.list[0].done, noSlip: S.noSlip, settle: x.settle, xMethod: x.method }; }, { id: prep.id, DATE });
if (p2.pierDue === 0 && p2.pierGot === 1000 && p2.exDue === 0 && p2.exCov === 1000 && p2.gotExtra && p2.covered) ok(`2 หน้าท่าเก็บสด 1,000 · ค้าง ${p2.pierDue} · เก็บแล้ว ${p2.pierGot} (ไม่ซ้ำสอง) · รายการขายเพิ่มถูกครอบคลุม`);
else fail('2 ' + JSON.stringify(p2));

const r3 = await row(prep.code || prep.id);
if (r3 && !/รอเก็บ/.test(r3.saleTxt) && /เก็บที่ท่า/.test(r3.saleTxt) && !r3.slip && /เก็บครบ ฿1,000/.test(r3.stat) && !/ขายเพิ่ม รอเก็บ/.test(r3.stat) && p2.sDue === 0 && p2.done && p2.method === 'pier' && p2.noSlip === 0 && /หน้าท่า/.test(r3.tip))
  ok(`3 TS หลังเก็บ · "${r3.saleTxt}" · ป้าย "${r3.stat}" · ไม่มีชิปแนบสลิปของ Longtail`);
else fail('3 ' + JSON.stringify({ r3, sDue: p2.sDue, done: p2.done, method: p2.method, noSlip: p2.noSlip }));

const s3 = await sums();
if (s3.cash === s1.cash + 1000 && s3.tin === s1.tin + 1000 && p2.sGot === 0 && p2.sBy.cash === 0 && p2.comm === 300 && p2.commCov === 300 && !s3.todo.some(t => /ขายเพิ่ม\/upgrade รอเก็บ/.test(t)))
  ok(`4 ยอดวัน · เงินสด ${s1.cash.toLocaleString()} → ${s3.cash.toLocaleString()} (+1,000 ครั้งเดียว) · S.got 0 (เงินอยู่ฝั่งหน้าท่า) · คอม 300 ยังนับ · กล่องต้องเคลียร์ไม่มีขายเพิ่มรอเก็บ`);
else fail('4 ' + JSON.stringify({ s1, s3, sGot: p2.sGot, sBy: p2.sBy, comm: p2.comm, commCov: p2.commCov }));

/* เก็บไม่ครบ */
const p5 = await page.evaluate(({ id, DATE }) => { const b = SB_BOOKINGS.find(x => x.id === id); b.pierPayments[0].amount = 500; renderTravelSum(); const M = pckMoney(b, DATE), S = tsSaleList(b, DATE), x = SB_EXTRAS.find(e => e.id === 'ex_test_cotpier');
  return { pierDue: M.due, pierGot: M.got, exDue: M.exDue, exCov: M.exCov, covered: bkxExCovered(x), sDue: S.due }; }, { id: prep.id, DATE });
const r5 = await row(prep.code || prep.id);
if (p5.pierDue === 500 && p5.pierGot === 500 && p5.exDue === 1000 && p5.exCov === 0 && !p5.covered && p5.sDue === 1000 && r5 && /รอเก็บ/.test(r5.saleTxt)) ok(`5 เก็บ 500 จาก 1,000 · หน้าท่าค้าง ${p5.pierDue} · รายการขายเพิ่มยัง "รอเก็บ" ไม่ปล่อยผ่าน`);
else fail('5 ' + JSON.stringify({ p5, r5 }));

const p6 = await page.evaluate(() => { const x = SB_EXTRAS.find(e => e.id === 'ex_test_cotpier'); const r = { settle: x.settle, method: x.method, collectedAt: x.collectedAt }; SB_EXTRAS = SB_EXTRAS.filter(e => e.id !== 'ex_test_cotpier'); return r; });
if (p6.settle === 'pending' && p6.method === 'cot' && !p6.collectedAt) ok('6 รายการขายเพิ่มไม่ถูกเขียนทับ (settle pending · method cot) · เป็นการอ่านให้สองหน้าตรงกัน');
else fail('6 ' + JSON.stringify(p6));

const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e));
if (e1.length) fail('errors: ' + e1.slice(0, 3).join(' | '));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
