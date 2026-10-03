// §b2cPayOne · ป้ายการชำระของใบ B2C ต้องตรงกันสามหน้า · By trip · Pier Check-in · Travel Summary
//
// ที่มา (2026-10-03) · ผู้ใช้ส่งภาพ Travel Summary ของ 4 ต.ค. · ใบ LOV-0484295 / LOV-2593893 / LOV-7622843
//   By trip ขึ้น "Paid · จ่าย ฿13,039 · ครบ" แต่ Travel Summary ขึ้นป้าย COT + "COT · ยังไม่ระบุยอด"
//   "อันนี้ยังไม่สอดคล้องกับหน้า By trip date และหน้า Pier Check-in ด้วย"
//   สาเหตุ · ใบ B2C แขวนกับเอเยนต์กลาง a_b2c (payType cot) · สองหน้านั้นอ่านค่าของเอเยนต์
//   ส่วน By trip อ่าน paymentSnapshot ของใบ (เงื่อนไข + สถานะจ่าย)
//
// กันเจ็ดอย่าง
//   1 B2C จ่ายครบ · By trip = Paid · Travel Summary = Paid ไม่มีป้าย COT ไม่มี "ยังไม่ระบุยอด"
//   2 B2C จ่ายครบ · Pier Check-in (ทั้งแบบการ์ดและแบบตาราง) ไม่มี "ยังไม่ระบุยอด"
//   3 B2C ยังไม่จ่าย เงื่อนไข COT · ทั้งสามหน้ายังบอก COT · Travel Summary มีป้าย Unpaid · ยังเตือน "ยังไม่ระบุยอด"
//   4 B2C มัดจำ · Travel Summary ขึ้นเงื่อนไขของใบ (ไม่ใช่ COT ของเอเยนต์) + Deposit
//   5 เอเยนต์ B2B ที่เป็น COT จริงและยังไม่ใส่ยอด · ยังเตือน "ยังไม่ระบุยอด" เหมือนเดิมทั้งสองหน้า
//   6 เอเยนต์ Invoice · ป้ายเหมือนเดิม · และยอดที่ต้องเก็บของทุกใบไม่เปลี่ยนจากสูตรเดิม · payType (ที่ Daily Report ใช้) ยังเป็นของเอเยนต์
//   7 ไม่มี error บนหน้า
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 950 });
await goView(page, 'booking', 800);

const R = await page.evaluate(() => {
  const live = b => !['cancelled', 'rejected', 'cancelled_weather'].includes(b.status);
  const txt = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&#10003;|&middot;|&#3647;/g, ' ').replace(/\s+/g, ' ').trim();
  const see = b => { const t = (b.trips || [])[0] || {}, date = t.date || '';
    const M = pckMoney(b, date), ag = sbGetAgent(b.agentId) || {};
    const tsH = tsPayCell({ b, t, travelled: 1 }, date);
    return { id: b.id, v: b.voucher || '', ag: ag.payType || '', method: (b.paymentSnapshot || {}).method || '', st: (b.paymentSnapshot || {}).paidStatus || '',
      bt: txt(bkV2PayChip(b)), ts: txt(tsH), tsChips: [...tsH.matchAll(/class="ts-chip [^"]*"[^>]*>([^<]*)</g)].map(x => x[1].replace('&#10003;', '').trim()),
      pc: txt(pckMoneyCell(b, date, false)), ps: txt(pckMoneyCell(b, date, true)),
      due: M.due, payType: M.payType, term: M.term,
      dueOld: Math.max(0, Math.round(((b.cashOnTour && +b.cashOnTour.amount > 0 ? +b.cashOnTour.amount : 0)) * 100) / 100), cot: M.cot, bal: M.balance, hasInv: !!acctBookingInvoice(b.id) }; };
  const B = (SB_BOOKINGS || []).filter(live);
  const b2c = B.filter(b => b.agentId === 'a_b2c' && !acctBookingInvoice(b.id) && !(b.cashOnTour && +b.cashOnTour.amount > 0));
  const pick = f => b2c.filter(f).map(see);
  const cotAg = B.find(b => b.agentId !== 'a_b2c' && (sbGetAgent(b.agentId) || {}).payType === 'cot' && !(b.cashOnTour && +b.cashOnTour.amount > 0) && !acctBookingInvoice(b.id) && !(b.paymentSnapshot && +b.paymentSnapshot.balance > 0) && !(b.upgrades || []).length && !pckPaidSum(b, ((b.trips || [])[0] || {}).date));
  const invAg = B.find(b => (sbGetAgent(b.agentId) || {}).payType === 'invoice' && !acctBookingInvoice(b.id));
  return { paid: pick(b => (b.paymentSnapshot || {}).paidStatus === 'paid'), unpaidCot: pick(b => (b.paymentSnapshot || {}).paidStatus === 'unpaid' && !((b.paymentSnapshot || {}).method)),
    dep: pick(b => (b.paymentSnapshot || {}).paidStatus === 'deposit'),
    /* ชุดข้อมูลไม่มีเอเยนต์ B2B ที่เป็น COT · ยืมใบของเอเยนต์ Invoice มาตั้งเป็น COT ชั่วคราว (ป้ายอ่านจากเอเยนต์ตอนวาด) */
    cotAg: cotAg ? see(cotAg) : (invAg ? (() => { const a = sbGetAgent(invAg.agentId), k = a.payType; a.payType = 'cot'; try { return see(invAg); } finally { a.payType = k; } })() : null), invAg: invAg ? see(invAg) : null,
    all: B.slice(0, 400).map(b => { const d = ((b.trips || [])[0] || {}).date || '', M = pckMoney(b, d), ag = sbGetAgent(b.agentId) || {}; return M.payType === (ag.payType || '') ? 0 : 1; }).reduce((a, c) => a + c, 0), n: Math.min(400, B.length) };
});
const UNSET = /ยังไม่ระบุยอด/;

const p1 = R.paid.filter(x => !/Paid/.test(x.bt) || !x.tsChips.includes('Paid') || x.tsChips.includes('COT') || UNSET.test(x.ts) || /COT/.test(x.ts));
if (R.paid.length >= 3 && R.paid.some(x => !x.method) && !p1.length) ok(`1 B2C จ่ายครบ ${R.paid.length} ใบ (เอเยนต์กลางตั้ง ${R.paid[0].ag}) · By trip "${R.paid[0].bt}" · Travel Summary "${R.paid[0].tsChips.join(' ')}" ไม่มี COT`);
else fail('1 ' + JSON.stringify({ n: R.paid.length, bad: p1.slice(0, 2) }));
const p2 = R.paid.filter(x => UNSET.test(x.pc) || UNSET.test(x.ps) || !/Paid/.test(x.pc));
if (R.paid.length && !p2.length) ok('2 B2C จ่ายครบ · Pier Check-in ทั้งแบบการ์ดและตาราง ขึ้น Paid ไม่มี "COT · ยังไม่ระบุยอด"');
else fail('2 ' + JSON.stringify(p2.slice(0, 2)));

const u = R.unpaidCot[0];
if (u && /COT/.test(u.bt) && /Unpaid/.test(u.bt) && u.tsChips.join(' ') === 'COT Unpaid' && UNSET.test(u.ts) && UNSET.test(u.pc) && UNSET.test(u.ps)) ok(`3 B2C ยังไม่จ่าย เงื่อนไข COT (${u.v}) · สามหน้าบอก COT · Travel Summary "${u.tsChips.join(' ')}" · ยังเตือนยังไม่ระบุยอด`);
else fail('3 ' + JSON.stringify(u || 'no unpaid COT B2C booking in data'));

const d = R.dep[0];
if (d && d.method && d.method !== 'cot' && !d.tsChips.includes('COT') && d.tsChips.includes('Deposit') && d.tsChips.length === 2 && /Deposit/.test(d.bt) && !UNSET.test(d.ts) && !UNSET.test(d.pc)) ok(`4 B2C มัดจำ (${d.v} · เงื่อนไขของใบ ${d.method}) · Travel Summary "${d.tsChips.join(' ')}" · By trip "${d.bt}"`);
else fail('4 ' + JSON.stringify(d || 'no deposit B2C booking in data'));

const c = R.cotAg;
if (c && c.tsChips[0] === 'COT' && UNSET.test(c.ts) && UNSET.test(c.pc) && UNSET.test(c.ps) && /COT/.test(c.bt)) ok(`5 เอเยนต์ B2B ที่เป็น COT จริง ยังไม่ใส่ยอด (${c.v || c.id}) · ยังเตือน "ยังไม่ระบุยอด" ทั้งสองหน้า`);
else fail('5 ' + JSON.stringify(c || 'no B2B COT booking in data'));

const i = R.invAg;
if (i && i.tsChips[0] === 'Invoice' && /Invoice/.test(i.bt) && !UNSET.test(i.ts) && R.all === 0) ok(`6 เอเยนต์ Invoice ป้ายเหมือนเดิม · payType ของ ${R.n} ใบยังเป็นค่าของเอเยนต์ (Daily Report ไม่เปลี่ยน)`);
else fail('6 ' + JSON.stringify({ i, mismatch: R.all }));

const e1 = errors.filter(e => !/Failed to load resource/.test(e));
if (!e1.length) ok('7 ไม่มี error บนหน้า'); else fail('7 ' + e1.slice(0, 3).join(' | '));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
