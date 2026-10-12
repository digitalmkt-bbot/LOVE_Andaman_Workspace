// §btDeploy · By trip date · a trip that has a boat placed in Boat Operation but no booking yet still shows
//
// Source (2026-10-12) · owner: "มันจะมีวันที่วางเรือไว้แล้ว แต่ยังไม่มีบุคกิ้ง ทีนี้รายละเอียดในหน้า By trip date
//   มันจะไม่ขึ้นว่ามีทริปนี้อยู่ เพิ่มให้เห็นได้ไหม"
// Setup: day D with no bookings at all; Boat Operation puts boat X on route R (Tub Lamu)
// Checks
//   1 the trip list shows one slim line for R: route name · departure · pier · "X 0/cap" · "ยังไม่มี booking"
//   2 the Programmes card counts it (1 route, not "No programme on this day")
//   3 pier filter Visit Panwa hides it; All shows it again
//   4 a search hides empty trips
//   5 a day where R has bookings still shows the normal table (no slim line)
//   6 no page errors
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1100 });
await goView(page, 'booking', 900);
const S = await page.evaluate(() => {
  const add = (ds, n) => { const p = ds.split('-').map(Number); return fmt(new Date(p[0], p[1] - 1, p[2] + n, 12)); };
  const D = add(TODAY_STR, 60);
  SB_BOOKINGS.forEach(b => (b.trips || []).forEach(t => { if (t && t.date === D) t.date = add(D, 300); }));
  (typeof SB_SEAT_LOCKS !== 'undefined' ? SB_SEAT_LOCKS : []).forEach(l => { if (l) l.status = l.status === 'active' ? 'zz_off' : l.status; });
  const R = ROUTES.find(r => r && r.pier === 'tublamu' && r.active !== false && !laIsLandRoute(r) && bookingV2IsRouteOpenOn(r.id, D));
  const X = BOATS.find(b => b && !b.retired && b.pier === 'tublamu' && String(b.ownership || '') !== 'charter');
  TRIPS[D] = {}; TRIPS[D][X.id] = { route: R.id, type: 'normal', booked: 0 };
  _bkV2.filterDate = D; _bkV2.filterRoute = null; _bkV2T2Q = ''; _bkV2T2Pier = 'all'; _bkV2T2Family = ''; bookingV2SwitchTab('bytrip');
  return { D, R: R.id, RN: R.name, X: X.name, cap: boatCapFor(X.id, D), dep: (R.times || [])[0] || '' };
});
await page.waitForTimeout(1000);
const read = () => page.evaluate(R => {
  const l = document.querySelector('#view-booking .t2-dep[data-dep="' + R + '"]');
  const prog = (document.querySelector('#view-booking .bt-none') || {}).textContent || '';
  return { line: l ? l.textContent.replace(/\s+/g, ' ').trim() : null, h: l ? Math.round(l.getBoundingClientRect().height) : 0, prog,
    rn: [...document.querySelectorAll('#view-booking .bt-pgv')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).join(' | ') }; }, S.R);
const r1 = await read();
if (r1.line && r1.line.includes(S.RN) && r1.line.includes(S.dep) && r1.line.includes(S.X) && r1.line.includes('0/' + S.cap) && /ยังไม่มี booking/.test(r1.line) && r1.h <= 48)
  ok(`1 slim line (${r1.h}px): "${r1.line}"`); else fail('1 ' + JSON.stringify(r1));
if (!/No programme/.test(r1.prog) && r1.rn) ok('2 Programmes card lists it: "' + r1.rn + '"'); else fail('2 ' + JSON.stringify(r1));
await page.evaluate(() => bookingV2Tab2SetPier('panwa')); await page.waitForTimeout(500);
const r3a = await read();
await page.evaluate(() => bookingV2Tab2SetPier('all')); await page.waitForTimeout(500);
const r3b = await read();
if (!r3a.line && r3b.line) ok('3 Visit Panwa filter hides it, All brings it back'); else fail('3 ' + JSON.stringify({ r3a, r3b }));
await page.evaluate(() => { _bkV2T2Q = 'zzzz'; bookingV2RenderKeep(); }); await page.waitForTimeout(500);
const r4 = await read();
await page.evaluate(() => { _bkV2T2Q = ''; bookingV2RenderKeep(); }); await page.waitForTimeout(300);
if (!r4.line) ok('4 a search hides empty trips'); else fail('4 ' + JSON.stringify(r4));
const r5 = await page.evaluate(S => {
  const add = (ds, n) => { const p = ds.split('-').map(Number); return fmt(new Date(p[0], p[1] - 1, p[2] + n, 12)); };
  SB_BOOKINGS.push({ id: 'zz_dep_bk', schemaVer: 2, agentId: (SB_AGENTS[0] || {}).id, status: 'confirmed', leadPax: 'Dep Test', voucherRef: 'ZZDEP',
    trips: [{ routeId: S.R, date: S.D, bookingMode: 'seat', pax: { ad_fr: 2, ad_th: 0, chd_fr: 0, chd_th: 0, inf_fr: 0, inf_th: 0, foc: 0 } }], passengers: [], addOns: [], history: [] });
  bookingV2RenderKeep(); return new Promise(z => setTimeout(() => z({ slim: !!document.querySelector('#view-booking .t2-dep[data-dep="' + S.R + '"]'),
    row: [...document.querySelectorAll('#view-booking tr.t2-row')].some(t => (t.getAttribute('data-al') || '').indexOf('zz_dep_bk') >= 0) }), 700)); }, S);
if (!r5.slim && r5.row) ok('5 once it has a booking: normal table, no slim line'); else fail('5 ' + JSON.stringify(r5));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('6 no page errors'); else fail('6 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
