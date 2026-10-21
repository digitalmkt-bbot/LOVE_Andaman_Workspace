// §bkChCap · ทริปเหมาลำ · ป้ายที่นั่งเทียบกับลำที่เหมา ไม่ใช่ที่นั่งจอยของโปรแกรม
import { open } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
const r = await page.evaluate(async () => {
  const z = ms => new Promise(f => setTimeout(f, ms));
  nav(document.querySelector('.nav-item[data-view="booking"]')); await z(400);
  // หาวันที่โปรแกรมมีลำจอยหลายลำ แล้วเอาลำหนึ่งมาเหมา
  let pick = null;
  for (const ds of Object.keys(TRIPS).sort()) {
    const ops = Object.entries(TRIPS[ds]).filter(([b, o]) => o.route && o.type !== 'charter');
    const byR = {}; ops.forEach(([b, o]) => (byR[o.route] = byR[o.route] || []).push(b));
    const rid = Object.keys(byR).find(k => byR[k].length >= 2); if (rid) { pick = { ds, rid, bid: byR[rid][0] }; break; } }
  if (!pick) return { none: true };
  const boat = getBoat(pick.bid), cap = boatCapFor(pick.bid, pick.ds), lic = boatCapLicense(pick.bid);
  bookingV2NewBooking(); await z(200);
  const d = _bkV2.newBooking; const _src = SB_BOOKINGS.find(b => b.rateTypeRef && b.agentId) || {}; d.agentId = _src.agentId; d.rateTypeRef = _src.rateTypeRef; d.leadPax = 'Test';
  d.trips = [{ routeId: pick.rid, date: pick.ds, bookingMode: 'charter', charterBoatId: pick.bid, zone: 'NoTransfer', pax: { ad_fr: cap - 1, chd_fr: 0, inf_fr: 0, foc_fr: 0, ad_th: 0, chd_th: 0, inf_th: 0, foc_th: 0 } }];
  const al = getAllotment(pick.rid, pick.ds, null);
  const rv1 = bookingV2RenderReviewPanel(), tr1 = bookingV2RenderTripsSection();
  d.trips[0].pax.ad_fr = cap + 2;
  const rv2 = bookingV2RenderReviewPanel();
  d.trips[0].pax.ad_fr = lic + 3;
  const tr3 = bookingV2RenderTripsSection(), rv3 = bookingV2RenderReviewPanel();
  _bkV2.newBooking = null;
  const txt = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  return { pick, cap, lic, name: boat.name, seatFree: al.seatsAvailable,
    rv1: (txt(rv1).match(/OVER \d+\/\d+|\d+\/\d+ seats/) || [''])[0], tr1: (txt(tr1).match(/CHARTER · [^·]+· \d+ \/ \d+ seats|Over capacity[^.]*/) || [''])[0],
    rv2: (txt(rv2).match(/OVER \d+\/\d+/) || [''])[0], tr3: /Over the boat licence/.test(txt(tr3)), rv3: (txt(rv3).match(/OVER \d+\/\d+/) || [''])[0] };
});
const R = JSON.stringify(r);
if (r.none) { console.log('no case'); }
else {
  if (r.rv1 === `${r.cap - 1}/${r.cap} seats` && /CHARTER/.test(r.tr1)) ok(`${r.cap - 1} คนบน ${r.name} (${r.cap} ที่) · ไม่ขึ้น OVER แม้ที่นั่งจอยเหลือ ${r.seatFree} · ${r.rv1}`); else fail('fit ' + R);
  if (r.rv2 === `OVER ${r.cap + 2}/${r.cap}`) ok('เกินที่นั่งของลำ · ' + r.rv2); else fail('over cap ' + R);
  if (r.tr3 && r.rv3 === `OVER ${r.lic + 3}/${r.lic}`) ok('เกินทะเบียน · ' + r.rv3); else fail('over lic ' + R);
}
console.log(bad ? `FAIL ${bad}` : 'PASS'); await close(); process.exit(bad ? 1 : 0);
