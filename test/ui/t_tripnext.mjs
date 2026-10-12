// §tripNext · By trip date · a customer who bought two trips sees the other trip (what, which day) on the row
//
// Source (2026-10-12) · owner, screenshot of LOV-8145895 / LOV-2008441 (Similan rows, "ทั้งออเดอร์ 2 รายการ", "⚠ อาจซ้ำ"):
//   "รายการนี้ เป็นการซื้อ 2 เส้นทาง ทำยังไงให้ User เห็นว่า เขามีทริปอะไรต่อ วันไหน แต่ต้องกระชับ"
// Setup: one B2C order b2c_LOV-7780001_1 (day D, route R1) + _2 (D+2, route R2); _3 is add-on only; _4 is cancelled
// Checks
//   1 the D row carries one small chip "→ <D+2> · <R2>", title lists the other trip, no add-on-only / cancelled line
//   2 the D+2 row carries "← <D> · <R1>"
//   3 the chip is one line and the row is not taller than without it
//   4 click → By trip date jumps to D+2 and searches the other line's code; that row is there
//   5 lines of one order (other trip / add-on-only line) are no longer "⚠ อาจซ้ำ"; a real duplicate (same trip, same day, same lead) still is
//   6 an agent booking with two trips in one booking shows the chip too; a one-trip booking shows none
//   7 no page errors
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'booking', 900);

const S = await page.evaluate(() => {
  const c = {}; SB_BOOKINGS.forEach(b => { if (b.status !== 'confirmed') return; (b.trips || []).forEach(t => { if (t && t.date) c[t.date] = (c[t.date] || 0) + 1; }); });
  const D = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
  const add = (ds, n) => { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return bkV2LocalYMD(d); };
  const D2 = add(D, 2);
  const base = SB_BOOKINGS.find(b => b.status === 'confirmed' && (b.trips || []).some(t => t.date === D && t.bookingMode !== 'charter'));
  const R1 = base.trips.find(t => t.date === D).routeId;
  const R2 = (ROUTES.find(r => r && r.id !== R1 && r.active !== false) || {}).id;
  const pax = n => ({ ad_fr: n, ad_th: 0, chd_fr: 0, chd_th: 0, inf_fr: 0, inf_th: 0, foc: 0 });
  const mk = (n, date, rid, p, extra) => Object.assign({ id: 'b2c_LOV-7780001_' + n, schemaVer: 2, agentId: 'a_b2c', voucherRef: 'LOV-7780001', status: 'confirmed', leadPax: 'Amonrat Testsiri',
    hotelName: base.hotelName, pickupAreaId: base.pickupAreaId, trips: [{ routeId: rid, date, bookingMode: 'seat', pax: pax(p) }], addOns: [], passengers: [], history: [], notes: '' }, extra || {});
  const L1 = mk(1, D, R1, 3), L2 = mk(2, D2, R2, 3);
  const L3 = mk(3, D, R1, 0, { addOns: [{ type: 'longtail-join', label: 'Longtail Join', qty: 3, amount: 900 }] });
  const L4 = mk(4, add(D, 5), R2, 3, { status: 'cancelled' });
  /* agent booking with two trips */
  const AG = SB_BOOKINGS.find(b => b.status === 'confirmed' && b.agentId && b.agentId !== 'a_b2c' && (b.trips || []).length === 1 && b.trips[0].date === D && b.trips[0].bookingMode !== 'charter');
  const agOne = SB_BOOKINGS.find(b => b !== AG && b.status === 'confirmed' && b.agentId && b.agentId !== 'a_b2c' && (b.trips || []).length === 1 && b.trips[0].date === D && b.trips[0].bookingMode !== 'charter');
  AG.trips.push({ routeId: R2, date: add(D, 3), bookingMode: 'seat', pax: pax(2) });
  /* a real duplicate: same order prefix? no — a different order, same lead, same trip, same day */
  const DUP = Object.assign(JSON.parse(JSON.stringify(L1)), { id: 'b2c_LOV-7780009_1', voucherRef: 'LOV-7780009' });
  SB_BOOKINGS.push(L1, L2, L3, L4, DUP);
  _bkV2.filterDate = D; _bkV2.filterRoute = null; bkV2SwitchTab('bytrip');
  return { D, D2, D3: add(D, 3), R1, R2, r1s: bkV2RouteShort(R1), r2s: bkV2RouteShort(R2), d1: new Date(D + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).replace('Sept', 'Sep'), d2: new Date(D2 + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).replace('Sept', 'Sep'), AG: AG.id, agOne: agOne && agOne.id };
});
await page.waitForTimeout(1200);

const rowOf = (S, id) => page.evaluate(([S, id]) => {
  const tr = [...document.querySelectorAll('#view-booking tr.t2-row')].find(t => t.offsetParent && (t.getAttribute('data-al') || '').split(/[|,\s]/).some(x => x.indexOf(id) >= 0) || (t.getAttribute('data-al') || '').indexOf(id) >= 0);
  if (!tr) return null;
  const c = tr.querySelector('.t2-nxt'), cu = tr.querySelector('td.t2-cu');
  return { chip: c ? c.textContent.replace(/\s+/g, ' ').trim() : null, tip: c ? c.title : '', h: Math.round(tr.getBoundingClientRect().height),
    chipH: c ? Math.round(c.getBoundingClientRect().height) : 0, dup: /อาจซ้ำ/.test(tr.textContent), cuH: cu ? Math.round(cu.getBoundingClientRect().height) : 0 }; }, [S, id]);

const r1 = await rowOf(S, 'b2c_LOV-7780001_1');
if (r1 && r1.chip && r1.chip.startsWith('→') && r1.chip.includes(S.d2) && r1.chip.includes(S.r2s) && !/\+\d/.test(r1.chip) && !r1.tip.includes('_4') && /LOV-7780001/.test(r1.tip))
  ok(`1 day row chip "${r1.chip}" · tip "${r1.tip}"`); else fail('1 ' + JSON.stringify(r1));
const c3 = await page.evaluate(() => { const tr = [...document.querySelectorAll('#view-booking tr.t2-row')].find(t => (t.getAttribute('data-al') || '').indexOf('b2c_LOV-7780001_1') >= 0);
  const c = tr.querySelector('.t2-nxt'), h1 = tr.getBoundingClientRect().height, ch = c.getBoundingClientRect().height;
  const cut = c.querySelector('span').scrollWidth > c.querySelector('span').clientWidth + 1;
  c.style.display = 'none'; const h0 = tr.getBoundingClientRect().height; c.style.display = '';
  return { h1: Math.round(h1), h0: Math.round(h0), ch: Math.round(ch), cut }; });
if (c3.ch > 0 && c3.ch <= 18 && c3.h1 === c3.h0) ok(`3 chip is one line (${c3.ch}px) and the row stays ${c3.h0}px${c3.cut ? ' (long route name ends in …)' : ''}`); else fail('3 ' + JSON.stringify(c3));
const c5 = await page.evaluate(() => { const L = id => SB_BOOKINGS.find(b => b.id === id);
  const ids = id => bkV2FindDuplicateBookings(L(id), id).map(x => x.bk.id);
  return { l1: ids('b2c_LOV-7780001_1'), l2: ids('b2c_LOV-7780001_2'), l3: ids('b2c_LOV-7780001_3') }; });
if (!c5.l1.some(x => /LOV-7780001_[23]/.test(x)) && !c5.l2.length && !c5.l3.some(x => /LOV-7780001_/.test(x)))
  ok('5a lines of one order (other trip, add-on line) are not "อาจซ้ำ" · L1 only matches ' + JSON.stringify(c5.l1)); else fail('5a ' + JSON.stringify(c5));
const rd = await rowOf(S, 'b2c_LOV-7780009_1');
if (rd && rd.dup) ok('5b a real duplicate (other order, same lead/trip/day) is still flagged'); else fail('5b ' + JSON.stringify(rd));
const ra = await rowOf(S, S.AG);
if (ra && ra.chip && ra.chip.startsWith('→') && ra.chip.includes(S.r2s)) ok(`6a agent booking with 2 trips: "${ra.chip}"`); else fail('6a ' + JSON.stringify(ra));
const ro = S.agOne ? await rowOf(S, S.agOne) : { chip: null };
if (ro && !ro.chip) ok('6b one-trip booking has no chip'); else fail('6b ' + JSON.stringify(ro));

await page.evaluate(() => { const c = [...document.querySelectorAll('#view-booking tr.t2-row .t2-nxt')].find(e => (e.closest('tr').getAttribute('data-al') || '').indexOf('b2c_LOV-7780001_1') >= 0); c.click(); });
await page.waitForTimeout(900);
const r2 = await page.evaluate(() => ({ date: _bkV2.filterDate, q: _bkV2T2Q }));
const r2row = await rowOf(S, 'b2c_LOV-7780001_2');
if (r2.date === S.D2 && /LOV-7780001/.test(r2.q) && r2row && r2row.chip && r2row.chip.startsWith('←') && r2row.chip.includes(S.d1) && r2row.chip.includes(S.r1s))
  ok(`4 click → ${r2.date}, search "${r2.q}" · 2 that row reads "${r2row.chip}"`); else fail('4/2 ' + JSON.stringify({ r2, r2row }));

const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('7 no page errors'); else fail('7 ' + e1.slice(0, 3).join(' | '));
await page.evaluate(() => { _bkV2.filterDate = null; }); 
await page.screenshot({ path: '/tmp/claude-0/-home-claude/558cc1ba-a23b-5d2f-bccb-3729813f82d1/scratchpad/tn.png' });
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
