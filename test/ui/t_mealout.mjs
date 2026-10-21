// §mealOut · กรุ๊ปที่ไม่ทานอาหารกลางวัน · เลือกที่การ์ดครัว → ยอด/ใบสั่งอาหาร/P&L ไม่นับ
import { open } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1000 });
page.on('dialog', d => d.accept());
await page.evaluate(() => { window.open = () => ({ document: { open() {}, write(h) { window.__slip = h; }, close() {} }, focus() {} }); });
const r = await page.evaluate(async () => {
  const z = ms => new Promise(f => setTimeout(f, ms));
  nav(document.querySelector('.nav-item[data-view="piercheckin"]')); await z(500);
  /* ข้อมูลทดสอบไม่มีร้านอาหาร · ใส่ร้านสมมติให้ทุกเส้นทาง */
  window.mvForTrip = () => ({ id: 'v_test', name: 'ร้านทดสอบ', priceAd: 200, priceCh: 100 }); window.mvLunchOk = () => true;
  // วันที่ Visit Panwa มีเรือ + ร้าน
  const days = [...new Set(SB_BOOKINGS.flatMap(b => (b.trips || []).map(t => t.date)))].sort().reverse();
  for (const d of days) {
    _pckDate = d; renderPierCheckin(); await z(250);
    pckKitchenOpen(); await z(200);
    const K = _pckKit || { border: [] };
    const bid = (K.border || []).find(b => { const B = K.boats[b]; const rid = (B.torder || [])[0]; return mvForTrip(d, b, rid) && mvLunchOk(rid) && mvLunchRows(d, b).filter(x => !x.ovn).length >= 3; });
    if (!bid) { pckKitchenClose(); continue; }
    const B = K.boats[bid], rid = B.torder[0], V = mvForTrip(d, bid, rid);
    const c0 = pckMealCount(B.rows);
    const rows0 = mvLunchRows(d, bid).filter(x => !x.ovn);
    const tgt = rows0.find(x => x.ad >= 2) || rows0[0];
    // เปิดกล่อง แล้วกด "ไม่ทาน"
    pckMealOutToggle(bid); await z(150);
    const btn = [...document.querySelectorAll('#pck-kit-host button')].find(b => /pckMealOutSet\(/.test(b.getAttribute('onclick') || '') && b.getAttribute('onclick').includes(tgt.bkId) && /,1\)$/.test(b.getAttribute('onclick')));
    if (!btn) return { nobtn: true, d, bid };
    btn.click(); await z(250);
    const c1 = pckMealCount((_pckKit.boats[bid] || B).rows);
    const head = [...document.querySelectorAll('#pck-kit-host button')].map(b => b.textContent).find(t => /ไม่ทานอาหารกลางวัน/.test(t)) || '';
    const rowsAfter = mvLunchRows(d, bid);
    const T = pxTrip(d, bid); const meal = (T.rows || []).find(x => x.id === 'meal');
    window.__kitHtml = document.getElementById('pck-kit-host').innerHTML;
    pckMealSend(bid); await z(300);
    const slip = String(window.__slip || ''); const sent = (taGet(d, bid) || {}).meal || {};
    // ยกเลิก = กลับมาทาน
    pckMealOutSet(d, bid, tgt.bkId, false); await z(150);
    const c2 = pckMealCount((_pckKit.boats[bid] || B).rows);
    return { d, bid, tgt: { lead: tgt.lead, ad: tgt.ad, chd: tgt.chd }, c0: c0.ad + c0.chd, c1: c1.ad + c1.chd, c2: c2.ad + c2.chd, head,
      inc: (rowsAfter.find(x => x.bkId === tgt.bkId) || {}).inc, slipOut: /ไม่ทานอาหารกลางวัน/.test(slip) && /ไม่ทานอาหาร \d+ ท่าน/.test(slip),
      sentAd: sent.ad, sentChd: sent.chd, mealWhy: meal && meal.why || '' };
  }
  return { none: true };
});
const R = JSON.stringify(r);
if (r.none || r.nobtn) { fail('no case ' + R); }
else {
  const n = r.tgt.ad + r.tgt.chd;
  if (r.c1 === r.c0 - n && /1 กรุ๊ป/.test(r.head)) ok(`การ์ดครัว · กด "ไม่ทาน" ${r.tgt.lead} (${n} ท่าน) · ยอด ${r.c0} → ${r.c1} · หัวกล่อง "${r.head.trim()}"`); else fail('count ' + R);
  if (r.inc === 'out' && r.slipOut) ok('ใบสั่งอาหาร · แถวเทา "ไม่ทานอาหารกลางวัน" + บรรทัดสรุปใต้ตาราง'); else fail('slip ' + R);
  if (r.sentAd + r.sentChd === r.c1) ok('ยอดที่บันทึกส่งร้าน = ' + r.c1 + ' (ไม่นับกรุ๊ปที่ไม่ทาน)'); else fail('sent ' + R);
  if (r.c2 === r.c0) ok('กด "ทาน" กลับ · ยอดคืนเป็น ' + r.c2); else fail('undo ' + R);
}
if (errors.length) console.log('    errors:', errors.slice(0, 3));
console.log(bad ? `FAIL ${bad}` : 'PASS'); await close(); process.exit(bad ? 1 : 0);
