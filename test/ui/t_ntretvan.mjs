// §ntRetVan · ใบมาเอง (self-arrive) แต่ส่งคนละที่ ต้องเลือกรถขากลับได้ในโหมดจัดรถของ By trip
import { open, goView } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1800, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'booking', 800);

const r = await page.evaluate(async () => {
  const z = ms => new Promise(f => setTimeout(f, ms));
  const DATE = '2026-10-15';
  const nt = SB_BOOKINGS.filter(b => b.status !== 'cancelled' && b.pickupZone === 'NoTransfer' && b.leadPax && (b.trips || []).some(t => t.date === DATE && t.zone === 'NoTransfer'));
  const A = nt[0], B = nt[1];
  // A = มาเอง แต่ส่งโรงแรมในภูเก็ต · B = มาเอง กลับเอง (ไม่แตะ)
  A.dropoffSame = false; A.dropoffAreaId = 'pk-airport'; A.dropoffArea = 'Airport'; A.dropoffHotelName = 'Test Hotel Patong';
  const rid = A.trips.find(t => t.date === DATE).routeId;
  _bkV2.filterDate = DATE; _bkV2.filterRoute = null; bookingV2SwitchTab('bytrip'); if (typeof btcSet === 'function') btcSet('classic');
  _bkV2.vanAssignMode = true; bookingV2Render(); await z(1200);
  const row = nm => [...document.querySelectorAll('#view-booking tr')].find(tr => tr.innerText.indexOf(nm) >= 0);
  const ra = row(A.leadPax), rb = row(B.leadPax);
  const selA = ra && ra.querySelector('select[onchange*="bookingV2AssignVanReturn"]');
  const selB = rb && rb.querySelector('select[onchange*="bookingV2AssignVanReturn"]');
  const before = bookingV2RetInfo(A, DATE);
  const opts = selA ? [...selA.options].map(o => o.value).filter(Boolean) : [];
  let after = null, sel2 = null;
  if (selA && opts.length) {
    selA.value = opts[0]; selA.dispatchEvent(new Event('change', { bubbles: true })); await z(600);
    after = bookingV2RetInfo(A, DATE);
    const ra2 = row(A.leadPax); sel2 = ra2 && ra2.querySelector('select[onchange*="bookingV2AssignVanReturn"]');
  }
  return { A: A.id, B: B.id, hasA: !!selA, hasB: !!selB, selfA: !!(ra && /self-arrive/.test(ra.innerText)), nOpts: opts.length,
    before: { sep: before.sep, alert: before.alert }, after: after && { alert: after.alert, retId: after.retId, arranged: after.arranged },
    sel2: sel2 && sel2.value, vanIdStill: bkOpsRead(A, DATE).vanId || null };
});
if (r.hasA && r.selfA && r.nOpts > 0) ok(`1 แถวมาเอง ${r.A} · ยังเขียน self-arrive · มีช่องรถกลับ ${r.nOpts} คัน`); else fail('1 ' + JSON.stringify(r));
if (!r.hasB) ok(`2 แถวมาเอง-กลับเอง ${r.B} · ไม่มีช่องรถกลับ (เหมือนเดิม)`); else fail('2 ' + JSON.stringify(r));
if (r.before.sep && r.before.alert) ok('3 ก่อนเลือก · ส่งคนละที่ + ยังไม่จัดรถกลับ'); else fail('3 ' + JSON.stringify(r.before));
if (r.after && !r.after.alert && r.after.arranged && r.after.retId && r.sel2 === r.after.retId && !r.vanIdStill) ok(`4 เลือกแล้ว · vanReturnId=${r.after.retId} · ป้ายยังไม่จัดรถกลับหาย · ขาไปยังไม่มีรถ`); else fail('4 ' + JSON.stringify(r));
if (errors.length) fail('errors: ' + errors.join(' | ')); else ok('5 ไม่มี error');
await close(); console.log(bad ? `FAIL ${bad}` : 'PASS'); process.exit(bad ? 1 : 0);
