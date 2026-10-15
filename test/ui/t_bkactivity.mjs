// §bkActivity · All bookings · เรียงตามความเคลื่อนไหวล่าสุด · กลุ่มวัน · ป้าย ใหม่/แก้ไข/ยกเลิก · คอลัมน์ Activity
//
// ที่มา (2026-10-14) · owner: "ในหน้า All booking ขอปรับหน้าตาใหม่ · ขอให้ไล่เรียงแบบล่าสุด กรณีที่มีแก้ไขให้ขึ้นอัพเดทด้วย" → เลือกแบบ A
// กัน
//   1 ค่าเริ่มต้นคือโหมด activity · ปุ่มสามโหมดอยู่บนจอ · ใบที่ถูกแก้ล่าสุด (history ใหม่สุด) อยู่แถวแรก แม้สร้างเก่ากว่า
//   2 ใบที่แก้ไขมีป้าย "แก้ไข <วันที่>" · ใบที่ยกเลิกมีป้าย "ยกเลิก" · ใบใหม่ใน 24 ชม. มีป้าย "ใหม่" และพื้นฟ้า
//   3 คอลัมน์ Activity ของใบที่แก้ แสดงข้อความจาก history และชื่อคนที่แก้
//   4 กลุ่มวัน · แถวแรกคือ "วันนี้" · ลำดับเวลาภายในหน้าลดลงเสมอ
//   5 สลับเป็นวันเดินทาง · เรียงวันเดินทางมากไปน้อย · สลับเป็นวันที่สร้าง · เรียง createdAt มากไปน้อย · จำไว้ใน localStorage
//   6 แถวเตี้ยลงกว่าเดิม (≤ 76px · ชื่อทริปสองบรรทัด) · ยอดคนอยู่ใต้ชื่อทริป · คอลัมน์ 8 คอลัมน์
//   7 คลิกแถวยังเปิดรายละเอียดใบ · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'booking', 700);
/* เตรียมข้อมูล · ใบเก่าใบหนึ่งถูกแก้ "เมื่อกี้" · ใบหนึ่งสร้างใหม่ · ใบหนึ่งยกเลิก */
const prep = await page.evaluate(() => {
  try { localStorage.removeItem('la_bkSort'); } catch (_) {}
  const live = SB_BOOKINGS.filter(b => b.schemaVer === 2 && b.trips && b.trips[0] && b.trips[0].date && !['cancelled', 'cancelled_weather', 'rejected'].includes(b.status));
  live.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const old = live[0], mid = live[Math.floor(live.length / 2)], cx = live[1];
  const month = old.trips[0].date.slice(0, 7);
  const sameMonth = live.filter(b => b.trips[0].date.slice(0, 7) === month);
  const fresh = sameMonth[sameMonth.length - 1];
  const now = Date.now();
  old.history = old.history || []; old.history.push({ at: new Date(now - 5 * 60000).toISOString(), kind: 'edit', text: 'Test edit · changed traveller name', by: 'Noon' });
  cx.history = cx.history || []; cx.history.push({ at: new Date(now - 60 * 60000).toISOString(), kind: 'cancel', text: 'Test cancel', by: 'Fern' }); cx.status = 'cancelled';
  fresh.createdAt = new Date(now - 30 * 60000).toISOString(); fresh.history = [{ at: fresh.createdAt, kind: 'create', text: 'Created booking', by: 'Mint' }];
  _bkV2.month = month; _bkV2.statusFilter = 'all'; _bkV2.search = ''; _bkV2.sort = null;
  bookingV2SwitchTab('all');
  return { old: old.id, cx: cx.id, fresh: fresh.id, month };
});
await page.waitForTimeout(500);
const read = () => page.evaluate(() => {
  const rows = [...document.querySelectorAll('#view-booking .bkv2-tbl tbody tr.bkr')];
  const seg = [...document.querySelectorAll('#view-booking .bkv2-seg button')].map(b => ({ t: b.textContent.trim(), on: b.classList.contains('on') }));
  return {
    seg, ths: [...document.querySelectorAll('#view-booking .bkv2-tbl thead th')].map(t => t.textContent.trim()),
    firstDay: (document.querySelector('#view-booking .bkv2-tbl tbody tr.bkv2-day') || {}).textContent || '',
    rows: rows.map(tr => ({ id: tr.getAttribute('data-id'), code: tr.querySelector('.bk-id').textContent.trim(), onclick: tr.getAttribute('onclick') || '', cls: tr.className, h: Math.round(tr.getBoundingClientRect().height),
      sub: tr.querySelector('.bk-sub').textContent.trim(), act: tr.querySelector('.act') ? tr.querySelector('.act').textContent.trim() : '', trip: tr.querySelector('.trip-pax') ? tr.querySelector('.trip-pax').textContent.trim() : '',
      tv: tr.querySelector('.tv-date') ? tr.querySelector('.tv-date').textContent.trim() : '', bg: getComputedStyle(tr.querySelector('td')).backgroundColor }))
  };
});
const a = await read();
const r0 = a.rows[0];
if (a.seg.length === 3 && a.seg[0].on && r0 && r0.id === prep.old) ok(`1 โหมดเริ่มต้น activity · ใบเก่าที่เพิ่งแก้ขึ้นแถวแรก (${r0.id})`); else fail('1 ' + JSON.stringify({ seg: a.seg, r0 }));
const rCx = a.rows.find(r => r.id === prep.cx), rFr = a.rows.find(r => r.id === prep.fresh);
if (r0 && /แก้ไข/.test(r0.sub) && rCx && /ยกเลิก/.test(rCx.sub) && rFr && /ใหม่/.test(rFr.sub) && /fresh/.test(rFr.cls) && rFr.bg !== 'rgba(0, 0, 0, 0)') ok(`2 ป้าย แก้ไข / ยกเลิก / ใหม่ (${rFr.bg})`); else fail('2 ' + JSON.stringify({ r0, rCx, rFr }));
if (r0 && /Test edit/.test(r0.act) && /Noon/.test(r0.act) && /นาทีที่แล้ว|เมื่อกี้/.test(r0.act)) ok(`3 Activity: "${r0.act}"`); else fail('3 ' + JSON.stringify(r0 && r0.act));
const order = await page.evaluate((ids) => ids.map(id => { const b = SB_BOOKINGS.find(x => x.id === id); return bookingV2LastAct(b, bookingV2Norm(b)).at; }), a.rows.map(r => r.id));
const desc = order.every((v, i) => !i || order[i - 1] >= v);
if (/วันนี้/.test(a.firstDay) && desc) ok(`4 กลุ่มแรก "${a.firstDay.trim()}" · เวลาเรียงลดลงทั้ง ${order.length} แถว`); else fail('4 ' + JSON.stringify({ firstDay: a.firstDay, desc, order: order.slice(0, 5) }));
await page.evaluate(() => bookingV2SetSort('travel')); await page.waitForTimeout(400);
const b = await read();
const tvs = await page.evaluate((ids) => ids.map(id => bookingV2Norm(SB_BOOKINGS.find(x => x.id === id)).travelDate), b.rows.map(r => r.id));
await page.evaluate(() => bookingV2SetSort('created')); await page.waitForTimeout(400);
const c = await read();
const crs = await page.evaluate((ids) => ids.map(id => String(SB_BOOKINGS.find(x => x.id === id).createdAt || '')), c.rows.map(r => r.id));
const stored = await page.evaluate(() => localStorage.getItem('la_bkSort'));
if (b.seg[1].on && tvs.every((v, i) => !i || tvs[i - 1] >= v) && c.seg[2].on && crs.every((v, i) => !i || crs[i - 1] >= v) && stored === 'created' && /เดินทาง/.test(b.firstDay)) ok('5 โหมดวันเดินทาง / วันที่สร้าง เรียงถูก · จำไว้ใน localStorage'); else fail('5 ' + JSON.stringify({ bseg: b.seg, cseg: c.seg, stored, bday: b.firstDay, tvs: tvs.slice(0, 4), crs: crs.slice(0, 4) }));
const maxH = Math.max(...a.rows.map(r => r.h));
if (a.ths.length === 8 && /ACTIVITY/.test(a.ths[7]) && maxH <= 76 && a.rows.every(r => /A/.test(r.trip)) && a.rows.every(r => /[A-Z][a-z]{2}/.test(r.tv))) ok(`6 8 คอลัมน์ · แถวสูงสุด ${maxH}px · ยอดคนใต้ทริป · วันเดินทางมีวันในสัปดาห์`); else fail('6 ' + JSON.stringify({ ths: a.ths, maxH, t: a.rows[0] }));
await page.evaluate(() => bookingV2SetSort('activity')); await page.waitForTimeout(300);
await page.click('#view-booking .bkv2-tbl tbody tr.bkr'); await page.waitForTimeout(500);
const det = await page.evaluate(() => _bkV2.detailId);
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (det === prep.old && !e1.length) ok('7 คลิกแถวเปิดรายละเอียด · no page errors'); else fail('7 ' + JSON.stringify({ det, e1: e1.slice(0, 3) }));
if (process.env.SHOT) { await page.evaluate(() => { _bkV2.detailId = null; bookingV2Render(); }); await page.waitForTimeout(400); await page.screenshot({ path: process.env.SHOT }); }
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
