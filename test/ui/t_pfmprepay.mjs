// §pfmPrepay · เอเยนต์ Invoice (เครดิต) ที่โอนเงินเข้ามาก่อน · บันทึกรับเงินผูกกับใบจอง แล้วขึ้นใน Daily PFM
//
// ที่มา (2026-10-02) · ผู้ใช้ถามว่า "Agent เป็น Invoice และมีบางทีเอเยนต์ชอบชำระเงินเข้ามา
//   เราจะบันทึกแบบไหน และจะไปอยู่สรุปรายการชำระเงินได้อย่างไร ในหน้า Daily PFM"
//   ของเดิม Daily PFM เห็นแต่เอเยนต์ Pro Forma · ใบของเอเยนต์เครดิตไม่ขึ้นเลย
//
// เส้นที่ต้องรักษา
//   ก ใบเครดิตที่ยังไม่จ่าย ห้ามเข้า Daily PFM · ยังไม่ถึงกำหนด ดึงมาแล้วยอดค้างจะพองด้วยของที่ไม่ได้ค้างจริง
//   ข เงินที่รับแล้วต้องไม่ถูกเก็บซ้ำตอนออกบิลสิ้นเดือน
//   ค กดยกเลิกกลางทาง ต้องไม่เหลือใบแจ้งหนี้ค้าง (ใบจองจะหลุดจากบิลสิ้นเดือนโดยไม่มีใครตั้งใจ)
//
// ⚠ เทสสร้างใบแจ้งหนี้กับรายการรับเงินของตัวเองบนข้อมูลจริง แล้วคืนสถานะทุกอย่างตอนจบ
//
// เทสนี้กันเจ็ดอย่าง
//   1 ตัวเลือกใบจองมีแต่ของเอเยนต์ Invoice ที่ยังไม่มีใบแจ้งหนี้ · ไม่มี Pro Forma / COT / ใบที่ยกเลิก
//   2 ก่อนรับเงิน ใบเครดิตไม่อยู่ใน Daily PFM
//   3 เปิดฟอร์มแล้วยกเลิก ไม่เหลือใบแจ้งหนี้
//   4 รับเต็ม · ออกใบแจ้งหนี้ใบเดี่ยว (note=prepay) + รายการรับเงิน · ลงที่เก็บ · ขึ้นใน Daily PFM พร้อมป้าย
//   5 ใบนั้นไม่ถูกเสนอให้ออกบิลสิ้นเดือนซ้ำ และวงเงินเครดิตคืน
//   6 รับไม่เต็ม · ขึ้นว่าจ่ายล่วงหน้าบางส่วน · นับเฉพาะก้อนที่รับแล้ว ไม่เป็นยอดค้าง ไม่เตือน cutoff ไม่เข้าคิวทวง
//   7 ไม่มี error บนหน้า
//   8 รีเฟรชแล้วยังอยู่ (ผ่านทางบูตจริง) · และรอดทางไป-กลับของเซิร์ฟเวอร์ (decomposeBlob → assembleBlob)
//     ป้าย prepay หายเมื่อไหร่ ใบจะหลุดจาก Daily PFM เงียบ ๆ ทั้งที่เงินรับมาแล้ว
//   9 ใบงาน By trip (Manifest) · จ่ายครบขึ้น Paid + "จ่าย · ครบ" · จ่ายไม่เต็มขึ้น Partial + ยอดค้าง
//  10 §tsInvSlip · รีพอร์ต Travel Summary พิมพ์สลิปของเงินที่รับผ่านบิลด้วย
//     ไม่บวกเข้ายอดรับหน้าท่า · ใบที่ไม่มีสลิปไม่ถูกนับเป็นของขาด · บิลรวมหลายใบไม่พิมพ์ซ้ำทุกใบ

import { open, goView } from './_harness.mjs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const _require = createRequire(import.meta.url);
const osRepo = _require(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../os-backend/src/mapping/os_repo.js'));

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1100 });
await goView(page, 'dailypfm', 900);

/* ══ 0 · หาใบจองของเอเยนต์เครดิตสองใบ ════════════════════════════════════════ */
const R0 = await page.evaluate(() => {
  for (const f of ['pfmPrepayCands','pfmPrepayStart','pfmRecSubmit','pfmIsCreditPrepaid','pfmBookingsForPeriod','pfmChartBuckets'])
    if (typeof window[f] !== 'function') return { err: 'ยังไม่มีฟังก์ชัน ' + f };
  const all = pfmPrepayCands('');
  if (all.length < 2) return { err: 'ชุดนี้มีใบจองของเอเยนต์ Invoice ที่ยังไม่ออกใบแจ้งหนี้ไม่ถึง 2 ใบ · เทสนี้พิสูจน์อะไรไม่ได้' };
  /* ใบที่สองต้องเป็นวันที่เลย cutoff ไปแล้ว (อดีต) ถ้ามี · ไว้พิสูจน์ว่าไม่ขึ้นเตือน */
  const today = bkV2LocalYMD(new Date());
  const past = all.filter(x => x.d0 && x.d0 < today);
  const a = all[0], b = (past.find(x => x.b.id !== a.b.id) || all.find(x => x.b.id !== a.b.id));
  const pick = x => ({ id: x.b.id, agentId: x.b.agentId, d0: x.d0, tot: x.tot, sub: acctBookingTotal(x.b),
    vc: x.b.voucherRef || x.b.code || x.b.id, past: x.d0 < today,
    snap: JSON.stringify({ invoiceId: x.b.invoiceId || null, paymentStatus: x.b.paymentStatus || null, nHist: (x.b.history || []).length,
      nSlip: Array.isArray(x.b.paymentSlips) ? x.b.paymentSlips.length : -1 }) });
  const wrong = all.filter(x => { const ag = sbGetAgent(x.b.agentId) || {};
    return !(ag.payType === 'invoice' || ag.payType === 'credit') || acctBookingInvoice(x.b.id)
      || ['cancelled','rejected','cancelled_weather'].includes(x.b.status); }).length;
  const nPf = (SB_BOOKINGS || []).filter(x => (sbGetAgent(x.agentId) || {}).payType === 'proforma').length;
  return { A: pick(a), B: pick(b), n: all.length, wrong, nPf,
    nInv: SB_INVOICES.length, nPay: SB_PAYMENTS.length,
    search: pfmPrepayCands(String(a.b.voucherRef || a.b.code || a.b.id)).some(x => x.b.id === a.b.id),
    searchNone: pfmPrepayCands('zz-no-such-voucher-zz').length };
});
if (R0.err) { fail(R0.err); await close(); process.exit(1); }
const A = R0.A, B = R0.B;

/* ══ 1 ═══════════════════════════════════════════════════════════════════════ */
if (!R0.nPf) fail('1 ชุดนี้ไม่มีใบของเอเยนต์ Pro Forma เลย · พิสูจน์ไม่ได้ว่าตัวเลือกกรองมันออก');
else if (R0.wrong === 0 && R0.search && R0.searchNone === 0)
  ok(`1 ตัวเลือกมี ${R0.n} ใบ ล้วนเป็นเอเยนต์ Invoice ที่ยังไม่มีใบแจ้งหนี้ · ค้นด้วย voucher เจอ`);
else fail(`1 ตัวเลือกมีของผิดประเภท: ${JSON.stringify({ wrong: R0.wrong, search: R0.search, none: R0.searchNone })}`);

/* ══ 2 · ก่อนรับเงิน ใบเครดิตไม่อยู่ใน Daily PFM ═══════════════════════════════ */
const inPfm = (id, d) => page.evaluate(p => pfmBookingsForPeriod(p.d, 'daily').some(b => b.id === p.id), { id, d });
const bucket = d => page.evaluate(dd => { const c = pfmChartBuckets(dd, 'daily').find(x => x.cur) || {}; return { tot: c.tot || 0, paid: c.paid || 0, unpaid: c.unpaid || 0 }; }, d);
const A0 = await bucket(A.d0), B0 = await bucket(B.d0);
if (!(await inPfm(A.id, A.d0)) && !(await inPfm(B.id, B.d0)))
  ok('2 ใบเครดิตที่ยังไม่จ่าย ไม่อยู่ใน Daily PFM');
else fail('2 ใบเครดิตที่ยังไม่จ่ายหลุดเข้า Daily PFM');

/* ══ 3 · เปิดฟอร์มแล้วยกเลิก ต้องไม่เหลือใบแจ้งหนี้ ════════════════════════════ */
const R3 = await page.evaluate(p => {
  pfmPrepayOpen();
  const picker = !!document.getElementById('pfm-pre-modal') && !!document.querySelector('[data-pfmpre="' + p.id + '"]');
  pfmPrepayStart(p.id);
  const form = !!document.getElementById('pfm-rec-modal') && !!document.getElementById('pfm-rec-prenote');
  const amt = _pfmRec ? _pfmRec.amount : null;
  pfmRecClose();
  return { picker, form, amt, inv: !!acctBookingInvoice(p.id), nInv: SB_INVOICES.length };
}, { id: A.id });
if (R3.form && R3.amt === Math.round(A.tot) && !R3.inv && R3.nInv === R0.nInv)
  ok(`3 เปิดฟอร์มรับเงิน (ยอดตั้งต้น ฿${R3.amt.toLocaleString()}) แล้วยกเลิก · ไม่เหลือใบแจ้งหนี้`);
else fail(`3 ยกเลิกแล้วมีของค้าง หรือฟอร์มไม่เปิด: ${JSON.stringify(R3)}`);

/* ══ 4 · รับเต็ม ═════════════════════════════════════════════════════════════ */
const R4 = await page.evaluate(p => {
  _pfmDate = p.d0; _pfmMode = 'daily';
  pfmPrepayStart(p.id);
  _pfmRec.ref = 'TEST-PREPAY-A';
  _pfmRec.slips = [{ id: 'att_test_prepay_A', name: 'slip-a.jpg', mime: 'image/jpeg', size: 1234, kind: 'upload', at: new Date().toISOString() }];
  pfmRecSubmit();
  const inv = acctBookingInvoice(p.id);
  const pays = inv ? SB_PAYMENTS.filter(x => x.invoiceId === inv.id) : [];
  let stored = null;
  try { const D = JSON.parse(localStorage.getItem('loveandaman_v2') || '{}');
    const si = (D.sb_invoices || []).find(x => inv && x.id === inv.id) || {};
    stored = { note: si.note || '', pay: (D.sb_payments || []).filter(x => inv && x.invoiceId === inv.id).length };
  } catch (e) { stored = { err: String(e) }; }
  const row = document.querySelector('tr[data-pfmpre="1"]');
  return { inv: inv ? { note: inv.note, ids: inv.bookingIds, st: inv.status, bal: acctInvoiceBalance(inv), total: inv.total,
      due: inv.dueAt === inv.issuedAt } : null,
    pays: pays.map(x => ({ amt: x.amount, type: x.type, m: x.method })),
    stored, modalGone: !document.getElementById('pfm-rec-modal'),
    scope: pfmIsCreditPrepaid(SB_BOOKINGS.find(b => b.id === p.id)),
    row: row ? { tag: !!row.querySelector('.pfm-pretag'), vc: row.textContent.indexOf(p.vc) >= 0, paid: /Paid/.test(row.textContent) } : null };
}, A);
const A1 = await bucket(A.d0);
{
  const made = R4.inv && R4.inv.note === 'prepay' && R4.inv.ids.length === 1 && R4.inv.ids[0] === A.id
    && R4.inv.st === 'paid' && R4.inv.bal === 0 && R4.inv.due;
  const paid = R4.pays.length === 1 && R4.pays[0].amt === Math.round(A.tot) && R4.pays[0].type === 'payment';
  const kept = R4.stored && R4.stored.note === 'prepay' && R4.stored.pay === 1;
  const shown = R4.scope && (await inPfm(A.id, A.d0)) && R4.row && R4.row.tag && R4.row.vc && R4.row.paid && R4.modalGone;
  const sum = (A1.paid - A0.paid) === A.sub && (A1.tot - A0.tot) === A.sub && A1.unpaid === A0.unpaid;
  if (made && paid && kept && shown && sum)
    ok(`4 รับเต็ม ฿${Math.round(A.tot).toLocaleString()} · ใบแจ้งหนี้ใบเดี่ยว (prepay) + รายการรับเงิน ลงที่เก็บ · ขึ้นใน Daily PFM พร้อมป้าย · ยอดรับ +${A.sub.toLocaleString()} ยอดค้างไม่ขยับ`);
  else fail(`4 รับเต็มผิด: ออกใบ=${made} รับเงิน=${paid} ลงที่เก็บ=${kept} ขึ้นหน้า=${shown} ยอด=${sum} ${JSON.stringify(R4)} ${JSON.stringify({ A0, A1 })}`);
}

/* ══ 5 · ไม่เก็บซ้ำตอนสิ้นเดือน · วงเงินคืน ═════════════════════════════════ */
const R5 = await page.evaluate(p => {
  const b = SB_BOOKINGS.find(x => x.id === p.id);
  /* ตัวกรองเดียวกับฟอร์มออกใบแจ้งหนี้ใหม่ (acctNewInvoiceRender) */
  const offered = (SB_BOOKINGS || []).filter(x => x.agentId === p.agentId && !ACCT_PAID_STATES.includes(x.status) && !acctBookingInvoice(x.id)).some(x => x.id === p.id);
  const usedNow = agCreditState(p.agentId).used;
  /* A/B · ถอดใบแจ้งหนี้ออกชั่วคราวแล้ววัดวงเงินใหม่ */
  const inv = acctBookingInvoice(p.id); const st = inv.status; inv.status = 'void';
  const usedWithout = agCreditState(p.agentId).used;
  const offeredWithout = !acctBookingInvoice(p.id);
  inv.status = st;
  return { offered, offeredWithout, usedNow, usedWithout, picker: pfmPrepayCands('').some(x => x.b.id === p.id) };
}, A);
if (!R5.offered && R5.offeredWithout && (R5.usedWithout - R5.usedNow) === A.sub && !R5.picker)
  ok(`5 ใบที่รับเงินแล้วไม่ถูกเสนอออกบิลสิ้นเดือนซ้ำ · วงเงินเครดิตคืน ฿${A.sub.toLocaleString()} · หายจากตัวเลือกรับเงิน`);
else fail(`5 เสี่ยงเก็บซ้ำหรือวงเงินไม่คืน: ${JSON.stringify(R5)}`);

/* ══ 6 · รับไม่เต็ม ══════════════════════════════════════════════════════════ */
const HALF = Math.max(1, Math.round(B.tot / 2));
const R6 = await page.evaluate(p => {
  /* คิวทวง "ต้องเก็บก่อนเดินทาง" (โหมดเดือน) · นับจำนวนรายการก่อนและหลัง ต้องเท่าเดิม
     ดูว่ามีเลข voucher ในคิวไม่ได้ · คิวโชว์แค่ 12 รายการแรก ใบนี้อาจอยู่เลยจากนั้นไป */
  const queueN = () => { _pfmMode = 'month'; renderDailyPFM();
    const m = /(\d+) รายการ · เรียงตามใกล้วันเดินทาง/.exec(document.getElementById('dailypfm-host').innerHTML);
    _pfmMode = 'daily'; renderDailyPFM(); return m ? +m[1] : 0; };
  _pfmDate = p.d0; _pfmMode = 'daily';
  const q0 = queueN();
  pfmPrepayStart(p.id);
  _pfmRec.amount = p.half; _pfmRec.ref = 'TEST-PREPAY-B';
  pfmRecSubmit();
  const inv = acctBookingInvoice(p.id);
  const row = [...document.querySelectorAll('tr[data-pfmpre="1"]')].find(r => r.textContent.indexOf(p.vc) >= 0);
  const h = document.getElementById('dailypfm-host').innerHTML;
  const q1 = queueN();
  return { st: inv && inv.status, bal: inv ? acctInvoiceBalance(inv) : null, note: inv && inv.note,
    row: row ? { chip: row.textContent.indexOf('จ่ายล่วงหน้าบางส่วน') >= 0, st: row.getAttribute('data-pfmst'),
      red: /FEF6F5/i.test(row.getAttribute('style') || ''), cutoff: row.textContent.indexOf('เลย cutoff') >= 0,
      rec: row.innerHTML.indexOf("pfmRecordPayment('" + p.id + "')") >= 0 } : null,
    inQueue: q1 !== q0, q0, q1 };
}, { id: B.id, d0: B.d0, vc: B.vc, half: HALF });
const B1 = await bucket(B.d0);
{
  const sub = HALF;                                /* เงินที่รับจริง · นับเข้าทั้งยอดรวมและยอดรับ */
  const part = R6.st === 'partial' && R6.bal > 0 && R6.note === 'prepay';
  const row = R6.row && R6.row.chip && !R6.row.red && !R6.row.cutoff && R6.row.rec;
  const got = B1.paid - B0.paid, tot = B1.tot - B0.tot;
  const sum = Math.abs(got - (B.sub - R6.bal)) <= 1 && tot === got && B1.unpaid === B0.unpaid;
  if (part && row && sum && !R6.inQueue)
    ok(`6 รับไม่เต็ม ฿${HALF.toLocaleString()} จาก ฿${Math.round(B.tot).toLocaleString()} · ขึ้นว่าจ่ายล่วงหน้าบางส่วน · นับเฉพาะก้อนที่รับ (+${got.toLocaleString()}) ยอดค้างไม่ขยับ · ไม่เตือน cutoff${B.past ? ' (วันเดินทางเลยไปแล้ว)' : ''} · ไม่เข้าคิวทวง`);
  else fail(`6 รับไม่เต็มผิด: บางส่วน=${part} แถว=${row} ยอด=${sum} คิวทวง=${R6.inQueue} ${JSON.stringify(R6)} ${JSON.stringify({ B0, B1, got, tot })}`);
}

/* ══ 8 · รีเฟรชแล้วยังอยู่ · และรอดทางไป-กลับของเซิร์ฟเวอร์ ═══════════════════ */
const SRV = await page.evaluate(p => {
  const D = JSON.parse(localStorage.getItem('loveandaman_v2') || '{}');
  const invs = (D.sb_invoices || []).filter(i => (i.bookingIds || []).some(x => p.ids.includes(x)));
  const iid = invs.map(i => i.id);
  return { sb_invoices: invs, sb_payments: (D.sb_payments || []).filter(x => iid.includes(x.invoiceId)) };
}, { ids: [A.id, B.id] });
const BACK = osRepo.assembleBlob(osRepo.decomposeBlob(SRV));
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => typeof window.nav === 'function', null, { timeout: 20000 });
await page.waitForTimeout(900);
await goView(page, 'dailypfm', 800);
const R8 = await page.evaluate(p => {
  const a = SB_BOOKINGS.find(b => b.id === p.A.id), b = SB_BOOKINGS.find(x => x.id === p.B.id);
  const ia = acctBookingInvoice(p.A.id), ib = acctBookingInvoice(p.B.id);
  return { a: pfmIsCreditPrepaid(a), b: pfmIsCreditPrepaid(b),
    balA: ia ? acctInvoiceBalance(ia) : null, balB: ib ? acctInvoiceBalance(ib) : null,
    inA: pfmBookingsForPeriod(p.A.d0, 'daily').some(x => x.id === p.A.id),
    inB: pfmBookingsForPeriod(p.B.d0, 'daily').some(x => x.id === p.B.id) };
}, { A, B });
{
  const bi = BACK.sb_invoices || [], bp = BACK.sb_payments || [];
  const srv = bi.length === 2 && bi.every(i => i.note === 'prepay' && (i.bookingIds || []).length === 1)
    && bp.length === 2 && bp.reduce((n, x) => n + Number(x.amount || 0), 0) === Math.round(A.tot) + HALF
    && bp.every(x => x.invoiceId && x.type === 'payment' && x.method === 'transfer' && x.date);
  const boot = R8.a && R8.b && R8.balA === 0 && R8.balB > 0 && R8.inA && R8.inB;
  if (srv && boot) ok('8 รีเฟรชแล้วใบแจ้งหนี้กับรายการรับเงินยังอยู่ · ป้าย prepay ยอด ช่องทาง วันที่ รอดทางไป-กลับของเซิร์ฟเวอร์');
  else fail(`8 รีเฟรชแล้วหายหรือไม่รอดเซิร์ฟเวอร์: boot=${boot} server=${srv} ${JSON.stringify(R8)} ${JSON.stringify({ bi: bi.map(i => i.note), bp: bp.length })}`);
}

/* ══ 9 · ใบงาน By trip (Manifest) ═════════════════════════════════════════════ */
await goView(page, 'booking', 800);
const mfRow = async (d, vc) => {
  await page.evaluate(p => { _bkV2.filterDate = p.d; _bkV2.filterRoute = null; _bkV2T2Q = ''; bkV2SwitchTab('bytrip'); }, { d });
  await page.waitForTimeout(1100);
  return page.evaluate(v => {
    const tr = [...document.querySelectorAll('.t2-mtbl tr.t2-row')].find(r => r.textContent.indexOf(v) >= 0); if (!tr) return null;
    const tds = [...tr.querySelectorAll('td')], hs = [...tr.closest('table').querySelectorAll('thead th')].map(h => h.textContent.trim());
    const t = i => i >= 0 && tds[i] ? tds[i].innerText.replace(/\s+/g, ' ').trim() : '';
    return { pay: t(hs.indexOf('Pay')), total: t(hs.indexOf('Total')) };
  }, vc);
};
const MA = await mfRow(A.d0, A.vc), MB = await mfRow(B.d0, B.vc);
if (!MA || !MB) fail(`9 ไม่เจอแถวในใบงาน By trip: ${JSON.stringify({ MA, MB })}`);
else if (/Paid/.test(MA.pay) && /ครบ/.test(MA.total) && /Partial/.test(MB.pay) && /ค้าง/.test(MB.total))
  ok(`9 ใบงาน By trip · จ่ายครบ "${MA.pay} · ${MA.total}" · จ่ายไม่เต็ม "${MB.pay} · ${MB.total}"`);
else fail(`9 ใบงาน By trip แสดงผิด: ${JSON.stringify({ MA, MB })}`);

/* ══ 10 · รีพอร์ต Travel Summary พิมพ์สลิปของเงินที่รับผ่านบิล ════════════════
   ชุดสลิปเดิมดึงแต่เงินหน้าท่าสามทาง · สลิปของเงินที่รับผ่านใบแจ้งหนี้ไม่เคยถูกพิมพ์ */
const R10 = await page.evaluate(p => {
  if (typeof tsSlipPackList !== 'function') return { err: 'ไม่มี tsSlipPackList' };
  try { _tsRoute = ''; _tsVatF = ''; } catch (e) {}
  const LA = tsSlipPackList(p.A.d0), LB = tsSlipPackList(p.B.d0);
  const a = LA.find(x => x.bk.id === p.A.id), b = LB.find(x => x.bk.id === p.B.id);
  const out = { a: a ? { ids: a.imgs.map(x => x.f.id), cap: (a.imgs[0] || {}).cap || '', tot: a.tot, miss: a.miss, invPaid: a.invPaid,
      dup: a.imgs.length - new Set(a.imgs.map(x => x.f.id)).size } : null,
    bInPack: !!b };
  /* หน้าจอ Travel Summary · ป้ายกดดูสลิปได้ ไม่ต้องย้อนไป Daily PFM */
  const cell = (id, d) => { const r = tsRows(d).find(x => x.b.id === id); return r ? tsPayCell(r, d) : ''; };
  const ca = cell(p.A.id, p.A.d0), cb = cell(p.B.id, p.B.d0);
  out.view = ca.indexOf('ts-invslip') >= 0 && ca.indexOf('laSlipView') >= 0 && ca.indexOf('att_test_prepay_A') >= 0;
  out.viewB = cb.indexOf('ts-invslip') >= 0; out.cellB = cb.length > 0;
  if (a) { const h = _tsSlipPage(a, 0, 1, 1, p.A.d0, ''); out.page = h.indexOf('จ่ายผ่านบิล') >= 0 && h.indexOf('att_test_prepay_A') >= 0 && h.indexOf('รับเงินรวม') < 0; }
  /* บิลรวมหลายใบ · สลิปที่อยู่กับรายการรับเงินของบิลต้องไม่ถูกพิมพ์ซ้ำทุกใบจอง
     ถอด b.paymentSlips ออกชั่วคราว (ทางนั้นเป็นสลิปของใบจองเองจริง ๆ) แล้วทำให้บิลคุมสองใบ */
  const bk = SB_BOOKINGS.find(x => x.id === p.A.id), iv = acctBookingInvoice(p.A.id);
  const keep = bk.paymentSlips; bk.paymentSlips = [];
  out.soloViaPayment = !!tsSlipPackList(p.A.d0).find(x => x.bk.id === p.A.id);   /* ยังขึ้นจากทางรายการรับเงิน */
  iv.bookingIds.push('zz-other-booking');
  out.multi = !!tsSlipPackList(p.A.d0).find(x => x.bk.id === p.A.id);
  iv.bookingIds.pop(); bk.paymentSlips = keep;
  return out;
}, { A, B });
if (R10.err) fail('10 ' + R10.err);
else if (R10.a && R10.a.ids.indexOf('att_test_prepay_A') >= 0 && R10.a.dup === 0 && /จ่ายผ่านบิล/.test(R10.a.cap)
         && R10.a.tot === 0 && R10.a.miss === 0 && R10.a.invPaid === Math.round(A.tot) && R10.page
         && !R10.bInPack && R10.soloViaPayment && !R10.multi
         && R10.view && R10.cellB && !R10.viewB)
  ok(`10 รีพอร์ต Travel Summary พิมพ์สลิปของเงินที่รับผ่านบิล (฿${R10.a.invPaid.toLocaleString()}) · ไม่บวกเข้ายอดหน้าท่า · ใบไม่มีสลิปไม่ถูกเตือน · บิลรวมไม่พิมพ์ซ้ำ · หน้าจอกดดูสลิปได้`);
else fail(`10 รีพอร์ตไม่พิมพ์สลิปของบิล หรือนับยอดผิด: ${JSON.stringify(R10)}`);

/* ══ คืนสถานะ ═══════════════════════════════════════════════════════════════ */
await page.evaluate(p => {
  const ids = [p.A.id, p.B.id];
  const invs = SB_INVOICES.filter(i => i.note === 'prepay' && (i.bookingIds || []).some(x => ids.includes(x))).map(i => i.id);
  SB_PAYMENTS = SB_PAYMENTS.filter(x => !invs.includes(x.invoiceId));
  SB_INVOICES = SB_INVOICES.filter(i => !invs.includes(i.id));
  [p.A, p.B].forEach(x => { const b = SB_BOOKINGS.find(z => z.id === x.id); if (!b) return; const s = JSON.parse(x.snap);
    if (s.invoiceId == null) delete b.invoiceId; else b.invoiceId = s.invoiceId;
    if (s.paymentStatus == null) delete b.paymentStatus; else b.paymentStatus = s.paymentStatus;
    if (Array.isArray(b.history)) b.history.length = s.nHist;
    if (s.nSlip < 0) delete b.paymentSlips; else if (Array.isArray(b.paymentSlips)) b.paymentSlips.length = s.nSlip; });
  try { sbInvoicesPersist(); sbPaymentsPersist(); acctPersistBookings(); } catch (e) {}
}, { A, B });

/* ══ 7 ═══════════════════════════════════════════════════════════════════════ */
const realErr = errors.filter(e => !/Failed to load resource/.test(e));
if (!realErr.length) ok('7 ไม่มี error บนหน้า');
else fail('7 มี error: ' + realErr.slice(0, 3).join(' | '));

await close();
console.log(bad ? `\n§pfmPrepay · ไม่ผ่าน ${bad} ข้อ` : '\n§pfmPrepay · ผ่านทั้งหมด');
process.exit(bad ? 1 : 0);
