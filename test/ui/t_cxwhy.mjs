// §cxWhy · ใบที่ถูกยกเลิกแต่ไม่มีเหตุผล (ส่วนใหญ่ยกเลิกจาก B2C sync) ต้องค้างบนหน้า Booking จนกว่าจะมีคนระบุ
//
// ที่มา (2026-10-27) · owner ดูสรุปยกเลิก 1–27 ต.ค. "ยังมีอีก 84 คนที่ยกเลิกโดยไม่ได้ระบุเหตุผล ต้องบังคับให้ระบุ"
//   ปุ่มยกเลิกในแอปบังคับเหตุผลอยู่แล้ว · 25 ใบที่หลุดมาจาก B2C sync (server ตั้ง status='cancelled' เอง ไม่มีคนเลือกเหตุผล)
// ข้อมูลทดสอบ
//   A b2c_ZZCX1_1 · ยกเลิกจาก B2C (ประวัติ kind b2c "→ Cancelled") · เดินทาง 3 วันก่อน · 3 คน → ต้องขึ้น
//   B ZZCX2 · ยกเลิกในระบบแต่ไม่มีเหตุผล · เดินทางพรุ่งนี้ · 2 คน → ต้องขึ้น
//   C ZZCX3 · ยกเลิกมีเหตุผลแล้ว → ไม่ขึ้น · D ZZCX4 · ไม่มีเหตุผลแต่เดินทาง 90 วันก่อน → ไม่ขึ้น (เกิน CXW_DAYS)
// กัน
//   1 หน้า Booking มีแถบแดง "ถูกยกเลิกแต่ยังไม่ระบุเหตุผล" · cxwList มี A, B ไม่มี C, D
//   2 ไม่เลือกเหตุผล → เตือน · เลือก "อื่นๆ" ไม่ใส่รายละเอียด → เตือน · ไม่บันทึก
//   3 A เลือก "ลูกค้ายกเลิกเอง" + โน้ต → cancellation.category · cancelReason · by B2C · at = เวลาจากประวัติ B2C · ลงประวัติ · หลุดจากรายการ
//   4 หน้ารายละเอียด B มีการ์ด "ยังไม่ระบุเหตุผล" · ระบุผ่านการ์ด → การ์ดหาย การ์ด Cancelled แสดงเหตุผล · ค่าปรับยังเป็น none · รายงานยกเลิกนับตามเหตุผล · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1000 });
const dlg = []; page.on('dialog', d => { dlg.push(d.message()); d.accept(); });
await goView(page, 'booking', 900);
const R1 = await page.evaluate(() => {
  const add = n => { const t = new Date(); t.setDate(t.getDate() + n); return bkV2LocalYMD(t); };
  const src = SB_BOOKINGS.find(b => b.schemaVer === 2 && (b.trips || []).length === 1 && b.trips[0].routeId);
  const mk = (id, d, pax, extra) => { const b = JSON.parse(JSON.stringify(src)); b.id = id; b.voucherRef = id; b.status = 'cancelled';
    delete b.cancellation; delete b.cancelCategory; delete b.cancelReason; delete b.cancelledAt; b.history = [];
    b.trips = [Object.assign(b.trips[0], { date: d, pax: { ad_fr: pax, chd_fr: 0, inf_fr: 0, ad_th: 0, chd_th: 0, inf_th: 0, foc: 0 } })];
    Object.assign(b, extra || {}); SB_BOOKINGS.push(b); return b; };
  mk('b2c_ZZCX1_1', add(-3), 3, { history: [{ at: '2026-10-20T08:00:00.000Z', kind: 'b2c', tag: 'B2C', text: 'Status: Confirmed → Cancelled · line removed in B2C' }] });
  mk('ZZCX2', add(1), 2);
  mk('ZZCX3', add(-2), 4, { cancelCategory: 'agent_error', cancellation: { category: 'agent_error', reason: 'x' } });
  mk('ZZCX4', add(-90), 5);
  bkV2Render();
  const bar = document.querySelector('.cxw-bar');
  const ids = cxwList().map(b => b.id);
  return { bar: bar ? bar.textContent.replace(/\s+/g, ' ') : '', ids };
});
const mine = R1.ids.filter(i => /ZZCX/.test(i));
if (/ยังไม่ระบุเหตุผล/.test(R1.bar) && mine.join() === 'b2c_ZZCX1_1,ZZCX2') ok('1 แถบแดง "' + R1.bar.slice(0, 60).trim() + '…" · รายการมี A, B (ไม่มีใบที่มีเหตุผล / เก่ากว่า 60 วัน)');
else fail('1 ' + JSON.stringify({ R1, mine }));

const R2 = await page.evaluate(() => {
  cxwOpen();
  const i = [...document.querySelectorAll('.cxw-row')].findIndex(r => r.dataset.id === 'b2c_ZZCX1_1');
  const s1 = cxwSave('b2c_ZZCX1_1', i);
  document.getElementById('cxw-c-' + i).value = 'other';
  const s2 = cxwSave('b2c_ZZCX1_1', i);
  const b = SB_BOOKINGS.find(x => x.id === 'b2c_ZZCX1_1');
  return { i, s1, s2, need: cxwNeed(b) };
});
if (R2.i >= 0 && !R2.s1 && !R2.s2 && R2.need && dlg.some(m => /choose a cancellation reason/.test(m)) && dlg.some(m => /note for "Other"/.test(m)))
  ok('2 ไม่เลือกเหตุผล / เลือกอื่นๆ ไม่มีรายละเอียด → เตือน "' + dlg.join('" · "') + '" · ไม่บันทึก');
else fail('2 ' + JSON.stringify({ R2, dlg }));

const R3 = await page.evaluate(() => {
  const i = [...document.querySelectorAll('.cxw-row')].findIndex(r => r.dataset.id === 'b2c_ZZCX1_1');
  document.getElementById('cxw-c-' + i).value = 'customer_cancel';
  document.getElementById('cxw-n-' + i).value = 'changed plan per B2C chat';
  const s = cxwSave('b2c_ZZCX1_1', i);
  const b = SB_BOOKINGS.find(x => x.id === 'b2c_ZZCX1_1');
  const rows = [...document.querySelectorAll('.cxw-row')].map(r => r.dataset.id).filter(x => /ZZCX/.test(x));
  acctModalClose();
  return { s, c: b.cancellation, cat: b.cancelCategory, rs: b.cancelReason, h: (b.history || []).map(h => h.text).filter(t => /ระบุเหตุผล/.test(t)), rows, need: cxwNeed(b) };
});
if (R3.s && R3.c.category === 'customer_cancel' && R3.cat === 'customer_cancel' && /changed plan per B2C chat/.test(R3.rs) && R3.c.by === 'B2C' && R3.c.at === '2026-10-20T08:00:00.000Z'
    && R3.c.chargeType === 'none' && R3.h.length === 1 && !R3.need && R3.rows.join() === 'ZZCX2')
  ok('3 บันทึก A → "' + R3.rs + '" · by B2C · at ' + R3.c.at + ' · ลงประวัติ · เหลือ ' + R3.rows.join());
else fail('3 ' + JSON.stringify(R3));

const R4 = await page.evaluate(() => {
  _bkV2.detailId = 'ZZCX2'; bkV2Render();
  const card = !!document.querySelector('.cxw-card');
  cxwOpen('ZZCX2');
  const rows = document.querySelectorAll('.cxw-row').length;
  document.getElementById('cxw-c-0').value = 'flight_visa';
  const s = cxwSave('ZZCX2', 0);
  acctModalClose();
  const host = document.getElementById('bkv2-host').textContent;
  const card2 = !!document.querySelector('.cxw-card');
  const b = SB_BOOKINGS.find(x => x.id === 'ZZCX2');
  _bkV2.detailId = null; bkV2Render();
  const left = cxwList().filter(x => /ZZCX/.test(x.id)).length;
  return { card, rows, s, card2, shows: /Flight \/ visa/.test(host), ct: b.cancellation.chargeType, left, bar: !!document.querySelector('.cxw-bar') && /ZZCX/.test('') };
});
if (R4.card && R4.rows === 1 && R4.s && !R4.card2 && R4.shows && R4.ct === 'none' && R4.left === 0 && errors.length === 0)
  ok('4 หน้ารายละเอียด B มีการ์ดยังไม่ระบุ · ระบุผ่านการ์ด → การ์ดหาย การ์ด Cancelled ขึ้น "Flight / visa" · ค่าปรับ none · รายการว่าง · ไม่มี error');
else fail('4 ' + JSON.stringify({ R4, errors: errors.slice(0, 3) }));
await close();
if (bad) { console.log(bad + ' FAILED'); process.exit(1); } console.log('ALL OK');
