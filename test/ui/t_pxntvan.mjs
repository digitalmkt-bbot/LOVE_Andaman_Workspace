// §pxNtVan · ค่ารถรับส่งใน P&L รายลำ · ยังไม่จัดรถ = คิดเฉพาะคนที่ใช้รถ · No transfer ทั้งลำ = ฿0
import { open } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1400, height: 900 });
const r = await page.evaluate(() => {
  const days = [...new Set((SB_BOOKINGS || []).flatMap(b => (b.trips || []).map(t => t.date)).filter(Boolean))].sort();
  const out = { allNt: null, mixed: null, tr: null, vanned: null };
  for (const d of days) {
    const bids = Object.keys((TRIPS || {})[d] || {});
    for (const bid of bids) {
      const T = pxTrip(d, bid); const v = (T.rows || []).find(x => x.id === 'van'); if (!v) continue;
      const N = pxTransferPax(d, bid), VN = pxVanCost(d, bid, (TRIPS[d][bid] || {}).route);
      const rec = { d, bid, tr: N.tr, nt: N.nt, use: Math.round(v.use), est: Math.round(v.est), src: v.src, why: v.why, vans: VN.vans.length };
      if (VN.vans.length) { if (!out.vanned) out.vanned = rec; continue; }
      if (N.nt > 0 && N.tr === 0 && !out.allNt) out.allNt = rec;
      else if (N.nt > 0 && N.tr > 0 && !out.mixed) out.mixed = rec;
      else if (N.nt === 0 && N.tr > 0 && !out.tr) out.tr = rec;
    }
    if (out.allNt && out.mixed && out.tr && out.vanned) break;
  }
  if (out.mixed) { // สูตรเดิม = ไม่สนใจ No transfer · เทียบสัดส่วน
    const d = out.mixed.d, bid = out.mixed.bid; const sv = pxTransferPax; window.pxTransferPax = () => ({ tr: 0, nt: 0 });
    const full = Math.round((pxTrip(d, bid).rows.find(x => x.id === 'van') || {}).est); window.pxTransferPax = sv; out.mixed.full = full; }
  return out;
});
const R = JSON.stringify(r);
if (r.allNt && r.allNt.use === 0 && /No transfer ทั้งลำ/.test(r.allNt.why)) ok(`No transfer ทั้งลำ (${r.allNt.bid} ${r.allNt.d} · ${r.allNt.nt} คน) · ค่ารถ ฿0`); else fail('allNt ' + R);
if (r.mixed && r.mixed.full > 0 && Math.abs(r.mixed.est - r.mixed.full * r.mixed.tr / (r.mixed.tr + r.mixed.nt)) <= 2) ok(`ปนกัน (ใช้รถ ${r.mixed.tr} · มาเอง ${r.mixed.nt}) · ${r.mixed.full} → ${r.mixed.est}`); else fail('mixed ' + R);
if (!r.tr || r.tr.est > 0) ok('ใช้รถทั้งลำ · ค่ารถเหมือนเดิม' + (r.tr ? ` (${r.tr.est})` : ' (ไม่มีเคสในข้อมูล)')); else fail('tr ' + R);
if (!r.vanned || r.vanned.src === 'r') ok('จัดรถแล้ว · ใช้ราคารถจริงเหมือนเดิม'); else fail('vanned ' + R);
console.log(bad ? `FAIL ${bad}` : 'PASS'); await close(); process.exit(bad ? 1 : 0);
