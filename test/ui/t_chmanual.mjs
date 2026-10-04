// §chManualNoRate · ราคาเหมาที่กรอกเอง ต้องไม่กลายเป็น ฿0 เมื่อเรือไม่มีเรทเหมา
//
// ที่มา (2026-10-04) · ผู้ใช้ส่งภาพ By trip + Trip P&L "ก่อนหน้านั้น User ระบุเงินหรือเปล่า แล้วทำไมยอดถึงเป็น 0"
//   BK-26091068 (Threeland Asia · LKC33 · 4 ต.ค.) · ประวัติ "Created booking · ฿64,500"
//   ใบยังเก็บ charterPriceMode=manual · charterPriceManual=64500 อยู่ครบ แต่ subtotal=0 · total=0
//   LKC33 เป็น Catamaran · ชุดราคาของเอเจนต์มีเรทเหมาเส้นทางนี้เฉพาะ speedboat
//   ตัวคิดราคาคืน 0 ที่บรรทัด "no charter rate" ก่อนจะไปถึงราคาที่กรอกเอง
//   ฟอร์มซ่อนช่องราคาเหลือแค่ป้ายแดง · บันทึกแล้วยอดใบ ฿0 · ใบแจ้งหนี้ ฿0 · P&L รายได้ 0
//
// กันเจ็ดอย่าง
//   1 เหมา FLEXIBLE ฿64,500 บนเรือที่มีเรท → ยอด 64,500 (ของเดิมยังทำงาน)
//   2 เปลี่ยนเป็นเรือที่ไม่มีเรทเหมา → ยอดยังเป็น 64,500 ไม่ใช่ 0 · ไม่มี error
//   3 โหมด RATE บนเรือที่ไม่มีเรท → กล่องแดงมีช่องกรอกราคา · กรอกแล้วเป็น FLEXIBLE ยอดตามที่กรอก
//   4 กดบันทึกทั้งที่ยอดทริปเหมาจะเป็น 0 → ถามก่อน · กด Cancel แล้วไม่บันทึก
//   5 กรอกราคาแล้วกดบันทึก → ไม่ถามเรื่อง 0 บาท
//   6 โหมด RATE บนเรือที่มีเรท → ยอดตามสูตรเรทการ์ดเหมือนเดิม
//   7 ตัวเลือกเรือ · ลำที่ไม่มีเรทเหมายังเลือกได้ · ไม่มี error บนหน้า
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 950 });
const dlg = [];
page.on('dialog', async d => { dlg.push({ type: d.type(), msg: d.message() }); try { if (d.type() === 'confirm') await d.dismiss(); else await d.accept(); } catch (_) {} });
await goView(page, 'booking', 800);

const S = await page.evaluate(async () => {
  /* หาใบ + เส้นทาง + เรือสองลำ (ลำที่ชุดราคามีเรทเหมา กับลำที่ไม่มี) */
  const typ = b => String(b.type || '').toLowerCase();
  for (const b of SB_BOOKINGS) {
    if ((b.trips || []).length !== 1 || b.priceMode === 'manual' || ['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)) continue;
    if (typeof bkV2IsB2CBk === 'function' && bkV2IsB2CBk(b)) continue;
    if (typeof laIsCompanyBk === 'function' && laIsCompanyBk(b)) continue;
    if ((b.adjustments || []).length || (b.addOns || []).length) continue;
    try { bkV2EditBooking(b.id); } catch (e) { continue; }
    const d = _bkV2.newBooking; if (!d) continue; const t = d.trips[0];
    const rt = bkV2GetRTForTrip(t); const cr = rt && rt.charterRates && rt.charterRates[t.routeId];
    if (!cr) { _bkV2.newBooking = null; continue; }
    const A = BOATS.find(x => cr[typ(x)]), B = BOATS.find(x => typ(x) && !cr[typ(x)]);
    if (!A || !B) { _bkV2.newBooking = null; continue; }
    return { id: b.id, A: A.id, An: A.name, B: B.id, Bn: B.name, rid: t.routeId, date: t.date, was: SB_BOOKINGS.find(x => x.id === b.id).total };
  }
  return null;
});
if (!S) { fail('ชุดข้อมูลนี้ไม่มีใบ/เรือที่ใช้ทดสอบได้'); await close(); process.exit(1); }

const R = await page.evaluate(async S => {
  const W = ms => new Promise(z => setTimeout(z, ms));
  const d = _bkV2.newBooking, t = d.trips[0], out = {};
  const _ga = window.getAssignedBoatsForRouteDate;
  window.getAssignedBoatsForRouteDate = () => [S.A, S.B].map(id => ({ boatId: id, boat: BOATS.find(x => x.id === id) }));
  const Q = () => { const q = bkV2CalcQuote(), s = q.perTrip[0] || {}; return { tot: Math.round(s.total || 0), grand: Math.round(q.grandTotal), err: s.error || '', nrc: !!s.noRateCard, mode: s.priceMode || '' }; };
  t.bookingMode = 'charter'; t.zone = t.zone || 'NoTransfer'; t.pax = { ad_fr: 31, foc_fr: 1, foc_th: 1 }; d.focReason = 'test';
  t.charterBoatId = S.A; t.charterPriceMode = 'manual'; t.charterPriceManual = 64500; out.c1 = Q();
  t.charterBoatId = S.B; out.c2 = Q();
  /* 3 · RATE บนเรือไม่มีเรท → กล่องแดง */
  t.charterPriceMode = 'rate'; t.charterPriceManual = 0; out.c3a = Q();
  if (getComputedStyle(document.getElementById('view-booking')).display === 'none') nav({ dataset: { view: 'booking' }, classList: { add() {}, remove() {} } });
  bkV2Render(); await W(300);
  const box = document.querySelector('[data-chnorate="ask"]'), inp = box && box.querySelector('[data-chnorate-in]');
  const opt = [...document.querySelectorAll('option')].find(o => o.value === S.B);
  out.c7 = { opt: !!opt, dis: opt ? opt.disabled : null, txt: opt ? opt.textContent : '' };
  out.c3box = { box: !!box, inp: !!inp, vis: !!(inp && inp.offsetParent), txt: box ? box.innerText.slice(0, 160) : '' };
  { let e = inp, why = ''; while (e && e !== document.body) { const cs = getComputedStyle(e); if (cs.display === 'none') { why = (e.id || e.className || e.tagName) + ''; break; } e = e.parentElement; } out.c3box.why = why; }
  /* 4 · บันทึกทั้งที่ยอด 0 */
  window.__n0 = SB_BOOKINGS.length; bkV2SubmitBooking(); await W(400);
  out.c4 = { open: !!_bkV2.newBooking, saved: SB_BOOKINGS.find(x => x.id === S.id).total, mode: (_bkV2.newBooking || {}).trips ? _bkV2.newBooking.trips[0].charterPriceMode : null };
  if (inp) { const i2 = document.querySelector('[data-chnorate-in]'); i2.value = '50000'; i2.dispatchEvent(new Event('change', { bubbles: true })); await W(300); }
  const t2 = _bkV2.newBooking.trips[0];
  out.c3 = Object.assign(Q(), { m: t2.charterPriceMode, p: t2.charterPriceManual, okTag: !!document.querySelector('[data-chnorate="ok"]'), ask: !!document.querySelector('[data-chnorate="ask"]') });
  /* 6 · RATE บนเรือที่มีเรท */
  const rt = bkV2GetRTForTrip(t2), cr = rt.charterRates[t2.routeId][String(BOATS.find(x => x.id === S.A).type).toLowerCase()];
  t2.charterBoatId = S.A; t2.charterPriceMode = 'rate'; const q6 = Q();
  const sub6 = bkV2TripSubtotal(t2);
  out.c6 = { tot: q6.tot, want: sub6.starterPrice + sub6.extraTotal, starter: cr.starterPrice, err: q6.err, min: (cr.starterPrice || 0) };
  /* 5 · กรอกราคาแล้วบันทึก */
  t2.charterBoatId = S.B; t2.charterPriceMode = 'manual'; t2.charterPriceManual = 50000;
  window.__mark = 'c5'; out.c5pre = Q();
  window.getAssignedBoatsForRouteDate = _ga;
  return out;
}, S);
const n4 = dlg.filter(x => /saved at 0 THB/.test(x.msg)).length, d4 = dlg.find(x => /saved at 0 THB/.test(x.msg));
dlg.length = 0;
await page.evaluate(async () => { try { bkV2SubmitBooking(); } catch (e) {} await new Promise(z => setTimeout(z, 500)); });
const n5 = dlg.filter(x => /saved at 0 THB/.test(x.msg)).length;

if (R.c1.tot === 64500 && R.c1.grand === 64500 && !R.c1.err) ok(`1 เหมา FLEXIBLE ฿64,500 บน ${S.An} (มีเรท) → ยอด ${R.c1.grand.toLocaleString()}`);
else fail('1 ' + JSON.stringify(R.c1));
if (R.c2.tot === 64500 && R.c2.grand === 64500 && !R.c2.err && R.c2.nrc && R.c2.mode === 'manual') ok(`2 เปลี่ยนเป็น ${S.Bn} (ไม่มีเรทเหมา) → ยอดยังเป็น 64,500 ไม่ใช่ 0`);
else fail('2 ' + JSON.stringify(R.c2));
if (R.c3a.err === 'no charter rate' && R.c3a.tot === 0 && R.c3box.box && R.c3box.vis && R.c3.m === 'manual' && R.c3.p === 50000 && R.c3.tot === 50000 && R.c3.okTag && !R.c3.ask)
  ok('3 โหมด RATE บนเรือไม่มีเรท · กล่องแดงมีช่องกรอกราคา · กรอก 50,000 แล้วเป็น FLEXIBLE ยอด 50,000');
else fail('3 ' + JSON.stringify([R.c3a, R.c3box, R.c3]));
if (n4 === 1 && d4 && d4.type === 'confirm' && /0 THB/.test(d4.msg) && d4.msg.includes(S.Bn) && /^[\x00-\x7F]*$/.test(d4.msg.replace(S.Bn, '').replace(/- .*\n/, '')) && R.c4.open && R.c4.saved === S.was)
  ok('4 กดบันทึกตอนยอดทริปเหมาจะเป็น 0 → ถามก่อน (ระบุชื่อเรือ) · กด Cancel แล้วใบไม่ถูกบันทึก');
else fail('4 ' + JSON.stringify({ n4, d4, c4: R.c4, was: S.was }));
if (n5 === 0 && R.c5pre.tot === 50000) ok('5 กรอกราคาแล้วกดบันทึก · ไม่ถามเรื่อง 0 บาท');
else fail('5 ' + JSON.stringify({ n5, pre: R.c5pre, dlg: dlg.map(x => x.msg.slice(0, 60)) }));
if (!R.c6.err && R.c6.tot === R.c6.want && R.c6.tot >= R.c6.min && R.c6.tot > 0) ok(`6 โหมด RATE บนเรือที่มีเรท · ยอดตามเรทการ์ด ${R.c6.tot.toLocaleString()} เหมือนเดิม`);
else fail('6 ' + JSON.stringify(R.c6));
const e1 = errors.filter(e => !/Failed to load resource/.test(e));
if (R.c7.opt && R.c7.dis === false && /agreed price/.test(R.c7.txt) && !e1.length) ok('7 ตัวเลือกเรือ · ลำที่ไม่มีเรทเหมายังเลือกได้ · ไม่มี error บนหน้า');
else fail('7 ' + JSON.stringify(R.c7) + ' ' + e1.slice(0, 2).join(' | '));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
