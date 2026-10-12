// §dupFast · "possible duplicate" check uses an index instead of scanning every booking for every row
//
// Source (2026-10-12) · owner: "พรุ่งนี้จะเกิดปัญหาแบบเดิมไหม หน้าเช็คอินจะโหลดช้าไหม"
//   Measured on the 12 Oct backup (5,637 bookings): By trip date for 15 Oct (59 bookings) took ~1.2 s,
//   ~0.5 s of it in bkV2FindDuplicateBookings (60 rows × 5,637 bookings).
// Checks
//   1 same result as the old full scan (ids, reasons, order) for every live booking + a set of planted duplicates
//   2 B2C lines of one order on other trips are still not duplicates; a real duplicate still is
//   3 the cached index sees a new booking right away (length change) and a "fresh" call sees an edited voucher
//   4 faster than the old scan
//   5 no page errors
// Data: LAD (default subset) · or PDIR=<dir with blob.json + bk.json> for a full-size run (not in the repo)
import { open, goView } from './_harness.mjs';
import fs from 'node:fs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const P = process.env.PDIR;
const { page, errors, close } = await open({ blob: P ? P + '/blob.json' : process.env.LAD, width: 1400, height: 900 });
if (P) await page.evaluate(t => { const a = JSON.parse(t); SB_BOOKINGS.length = 0; a.forEach(b => SB_BOOKINGS.push(b)); window.laBlobSave = () => {}; }, fs.readFileSync(P + '/bk.json', 'utf8'));
await goView(page, 'booking', 500);
const R = await page.evaluate(() => {
  /* the old full scan, verbatim (after §tripNext) */
  const OLD = function(d, excludeId){
    if(!d) return [];
    const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
    const vref=norm(d.voucherRef||d.code); const lead=norm(d.leadPax||d.customerName);
    const myTrips=(d.trips||[]).filter(t=>t.routeId&&t.date); const myDR=new Set(myTrips.map(t=>t.date+'|'+t.routeId));
    const out=[];
    (SB_BOOKINGS||[]).forEach(b=>{
      if(b.id===excludeId) return; if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return;
      const reasons=[]; const bv=norm(b.voucherRef||b.code);
      const bt=(b.trips||[]).filter(t=>t.routeId&&t.date); const sharedDR=bt.some(t=>myDR.has(t.date+'|'+t.routeId));
      const _ord=x=>{ const k=String(x||'').match(/^(b2c_.*)_\d+$/); return k?k[1]:''; };
      if(_ord(d.id) && _ord(d.id)===_ord(b.id)){ const _ao=x=>(typeof bkB2CAddonOnly==='function')&&bkB2CAddonOnly(x); if(!sharedDR || _ao(b) || _ao(d)) return; }
      if(vref && bv && bv===vref) reasons.push('V'+(b.voucherRef||b.code));
      if(lead && norm(b.leadPax||b.customerName)===lead && sharedDR) reasons.push('L');
      if(reasons.length) out.push({bk:b, reasons});
    });
    return out;
  };
  const sig = a => a.map(x => x.bk.id + ':' + x.reasons.map(r => r[0]).join('')).join(',');
  /* planted: a voucher twin, a lead+day+route twin (different case/spaces), two lines of one B2C order on other days, one real B2C dup */
  const base = SB_BOOKINGS.find(b => b && b.status === 'confirmed' && (b.trips || []).length && b.trips[0].routeId && b.trips[0].date && b.leadPax);
  const cp = (o, x) => Object.assign(JSON.parse(JSON.stringify(o)), x);
  const t0 = base.trips[0];
  SB_BOOKINGS.push(cp(base, { id: 'zz_dup_v', leadPax: 'Someone Else', voucherRef: base.voucherRef || 'ZZV1' }));
  if (!base.voucherRef) base.voucherRef = 'ZZV1';
  SB_BOOKINGS.push(cp(base, { id: 'zz_dup_l', voucherRef: 'ZZ-OTHER', leadPax: '  ' + String(base.leadPax).toUpperCase() + ' ' }));
  const pax = { ad_fr: 2, ad_th: 0, chd_fr: 0, chd_th: 0, inf_fr: 0, inf_th: 0, foc: 0 };
  const L = (n, date, rid, lead) => ({ id: 'b2c_LOV-7790001_' + n, agentId: 'a_b2c', status: 'confirmed', voucherRef: 'LOV-7790001', leadPax: lead || 'Order Test', trips: [{ routeId: rid, date, bookingMode: 'seat', pax }], addOns: [] });
  SB_BOOKINGS.push(L(1, t0.date, t0.routeId), L(2, '2031-01-02', t0.routeId), L(3, t0.date, t0.routeId));
  const live = SB_BOOKINGS.filter(b => b && !['cancelled','rejected','cancelled_weather'].includes(b.status));
  let diff = [], nHit = 0;
  const tA = performance.now(); const oldR = live.map(b => sig(OLD(b, b.id))); const tOld = performance.now() - tA;
  const tB = performance.now(); const newR = live.map(b => sig(bkV2FindDuplicateBookings(b, b.id).map(x => ({ bk: x.bk, reasons: x.reasons.map(r => /Voucher/.test(r) ? 'V' : 'L') })))); const tNew = performance.now() - tB;
  live.forEach((b, i) => { if (oldR[i] !== newR[i]) diff.push(b.id + ' old=' + oldR[i] + ' new=' + newR[i]); if (newR[i]) nHit++; });
  const g = id => sig(bkV2FindDuplicateBookings(SB_BOOKINGS.find(b => b.id === id), id).map(x => ({ bk: x.bk, reasons: x.reasons.map(r => /Voucher/.test(r) ? 'V' : 'L') })));
  const ord = { l1: g('b2c_LOV-7790001_1'), l2: g('b2c_LOV-7790001_2') };
  /* 3 · cache: a new booking shows at once; an edited voucher shows with fresh */
  const before = g(base.id);
  SB_BOOKINGS.push(cp(base, { id: 'zz_dup_new', leadPax: 'Late One' }));
  const afterNew = g(base.id);
  const tw = SB_BOOKINGS.find(b => b.id === 'zz_dup_l'); tw.voucherRef = base.voucherRef;
  const freshSig = sig(bkV2FindDuplicateBookings(base, base.id, true).map(x => ({ bk: x.bk, reasons: x.reasons.map(r => /Voucher/.test(r) ? 'V' : 'L') })));
  return { n: live.length, nHit, diff: diff.slice(0, 5), nd: diff.length, tOld: Math.round(tOld), tNew: Math.round(tNew), ord, before, afterNew, freshSig };
});
if (!R.nd) ok(`1 same result as the old scan for all ${R.n} bookings (${R.nHit} with a match, incl. planted twins)`); else fail('1 ' + R.nd + ' differ · ' + R.diff.join(' | '));
if (/b2c_LOV-7790001_3:VL/.test(R.ord.l1) && !/_2/.test(R.ord.l1) && !/b2c_LOV-7790001/.test(R.ord.l2)) ok('2 order lines on other days not flagged; same-trip line still is · L1 → "' + R.ord.l1 + '"'); else fail('2 ' + JSON.stringify(R.ord));
if (!/zz_dup_new/.test(R.before) && /zz_dup_new/.test(R.afterNew) && /zz_dup_l:VL/.test(R.freshSig)) ok('3 new booking seen at once · edited voucher seen by a fresh call'); else fail('3 ' + JSON.stringify(R));
if (R.tNew < R.tOld) ok(`4 all ${R.n} rows: old scan ${R.tOld} ms → index ${R.tNew} ms`); else fail('4 ' + R.tOld + ' vs ' + R.tNew);
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource|QuotaExceeded/.test(e));
if (!e1.length) ok('5 no page errors'); else fail('5 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
