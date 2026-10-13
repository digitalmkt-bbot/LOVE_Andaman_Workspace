// §b2cAddon · the B2C-bought longtail shows up everywhere ops reads longtail, on the AGENT booking
//
// Source (2026-10-11) · owner: "ตรวจต่อ Pier Check-in ใบงานไกด์ หางยาวในหน้า Petty cash หรือหางยาวที่ปกติ
//   ที่เราขาย ขึ้นที่ไหน อันนี้จะไปโผล่ครบไหม"
//
// Setup: an agent booking A on a boat with no longtail of its own; a 0-pax B2C booking L with a
// Longtail Charter whose special request names A's voucher.
// Checks
//   1 guide job sheet service column (pckJobService) · A gets "Longtail Charter · 1 ลำ", L nothing
//   2 petty cash / P&L longtail sheet (pxLongtail on A's boat) · charter +1
//   3 Pier Check-in · A's Add-on cell has the "เหมาหางยาว · B2C" chip
//   4 Pier Check-in · L is one slim line "ของใบ VC 22433 · ไม่ต้องเช็คอิน", not a full check-in row
//   5 Pier Check-in progress (pckAgg) does not count L as a booking waiting for check-in
//   6 A's detail drawer lists the B2C add-on
//   7 no page errors
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'booking', 900);
const S = await page.evaluate(() => {
  let pick = null;
  for (const b of SB_BOOKINGS) { if (b.status !== 'confirmed' || b.agentId === 'a_b2c') continue;
    for (const t of b.trips || []) { const o = bkOpsRead(b, t.date) || {};
      if (o.boatId && !bkBoatSplits(b, t.date) && bkLtState(b, t.routeId, t.date).mode === 'none') { pick = { b, t, bid: o.boatId }; break; } }
    if (pick) break; }
  if (!pick) return { err: 'no agent booking on a boat without longtail' };
  const { b: A, t: tA, bid } = pick, day = tA.date;
  A.voucherRef = '22433';
  const px0 = pxLongtail(day, bid).chtr;
  const L = { id: 'b2c_LOV-7770001_1', agentId: 'a_b2c', voucherRef: 'LOV-7770001', status: 'confirmed', leadPax: 'คุณทดสอบ', notes: 'ลูกค้าจองมาใน VC 22433 จาก IN&OUT',
    trips: [{ routeId: tA.routeId, date: day, bookingMode: 'seat', pax: { ad_th: 0, ad_fr: 0, chd_th: 0, chd_fr: 0, inf_th: 0, inf_fr: 0, foc: 0 } }],
    addOns: [{ type: 'longtail-charter', label: 'Longtail Charter', qty: 1, amount: 4999 }], passengers: [], history: [], priceBreakdown: { total: 4999 } };
  SB_BOOKINGS.push(L);
  window.__S = { day, bid, A: A.id, route: tA.routeId, L: L.id, px0 };
  return window.__S;
});
if (S.err) { fail('setup ' + S.err); await close(); process.exit(1); }

const c12 = await page.evaluate(S => { const A = SB_BOOKINGS.find(b => b.id === S.A), L = SB_BOOKINGS.find(b => b.id === S.L);
  return { a: pckJobService({ b: A, t: ckTripOn(A, S.day) }, S.day).map(x => x.t), l: pckJobService({ b: L, t: L.trips[0] }, S.day).map(x => x.t), px: pxLongtail(S.day, S.bid).chtr }; }, S);
if (c12.a.some(t => /Longtail Charter/.test(t)) && !c12.l.some(t => /Longtail/i.test(t))) ok('1 guide job sheet · agent row "' + c12.a[0] + '" · B2C row has no longtail'); else fail('1 ' + JSON.stringify(c12));
if (c12.px === S.px0 + 1) ok(`2 petty cash / P&L longtail on the boat · charter ${S.px0} → ${c12.px}`); else fail('2 ' + JSON.stringify(c12));

const c3 = await page.evaluate(async S => {
  nav(document.querySelector('.nav-item[data-view="piercheckin"]') || { dataset: { view: 'piercheckin' }, classList: { add(){}, remove(){} } });
  _pckDate = S.day; renderPierCheckin(); await new Promise(z => setTimeout(z, 400));
  const host = document.getElementById('piercheckin-host') || document.body;
  const chip = [...host.querySelectorAll('.b2c-addon-in')].map(e => e.textContent.trim());
  const sub = [...host.querySelectorAll('tr.pck-b2csub')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
  const full = [...host.querySelectorAll('tr.ck-row:not(.pck-b2csub)')].filter(tr => /LOV-7770001/.test(tr.textContent)).length;
  const subH = (host.querySelector('tr.pck-b2csub') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height;
  const A = SB_BOOKINGS.find(b => b.id === S.A), L = SB_BOOKINGS.find(b => b.id === S.L);
  const agg = { withL: pckAgg([{ b: A, t: ckTripOn(A, S.day), booked: 2 }, { b: L, t: L.trips[0], booked: 0 }]).n, onlyA: pckAgg([{ b: A, t: ckTripOn(A, S.day), booked: 2 }]).n };
  pckDetailOpen(S.A); await new Promise(z => setTimeout(z, 200));
  const dr = document.getElementById('pck-drawer'); const drTxt = dr ? dr.textContent.replace(/\s+/g, ' ') : '';
  if (typeof pckDetailClose === 'function') pckDetailClose();
  return { chip, sub, full, subH: Math.round(subH), agg, drawer: /เหมาหางยาว/.test(drTxt) && /LOV-7770001/.test(drTxt) };
}, S);
if (c3.chip.some(t => /เหมาหางยาว/.test(t) && /B2C/.test(t))) ok('3 Pier Check-in · agent row Add-on "' + c3.chip[0] + '"'); else fail('3 ' + JSON.stringify(c3));
if (c3.sub.length === 1 && /VC 22433/.test(c3.sub[0]) && /ไม่ต้องเช็คอิน/.test(c3.sub[0]) && c3.full === 0 && c3.subH > 0 && c3.subH <= 30)
  ok(`4 Pier Check-in · B2C is one slim line (${c3.subH}px) "${c3.sub[0]}"`); else fail('4 ' + JSON.stringify(c3));
if (c3.agg.withL === c3.agg.onlyA) ok('5 check-in progress does not count the B2C add-on as a booking'); else fail('5 ' + JSON.stringify(c3.agg));
if (c3.drawer) ok('6 agent detail drawer lists the B2C add-on'); else fail('6 ' + JSON.stringify(c3));

const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('7 no page errors'); else fail('7 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
