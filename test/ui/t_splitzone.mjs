// §splitZone · แยกคนแล้วช่อง Zone ต้องไม่ว่าง
//
// ที่มา (2026-09-30) · ผู้ใช้ส่งภาพหน้า By trip มา
//   "แยกคน แล้ว ไม่ขึ้น Zone เช่นที่ La Green Hotel and Residence"
//   แถวที่แยกออกมาขึ้นขีดในช่องโซน ทั้งที่แถวอื่นขึ้น Laguna / Kamala / Layan ปกติ
//
// สาเหตุ · ของเดิมแถวที่ไม่ใช่จุดหลักอ่านพื้นที่จาก split อย่างเดียว
//   const _pa = a.pick.areaId ? bkV2GetArea(a.pick.areaId) : null
// การแยกคนส่วนใหญ่ไม่ได้เลือกพื้นที่ใหม่ (จุดรับเดิมนั่นแหละ แค่แยกคนออกมา)
// พอไม่มี areaId ของตัวเอง ก็ได้ขีดเปล่า ทั้งที่บุคกิ้งแม่รู้พื้นที่อยู่แล้ว
//
// เส้นแบ่งที่ต้องรักษา · "ยืมมาจากบุคกิ้งแม่" กับ "เป็นของจุดแยกจริง" ต้องแยกออกจากกัน
//   จุดแยกไม่มีจุดรับของตัวเอง       → ที่เดียวกันจริง ขึ้นป้ายเต็มเหมือนแถวปกติ
//   จุดแยกมีจุดรับคนละที่ แต่ไม่มีพื้นที่ → ขึ้นแบบจาง บอกว่าเป็นของบุคกิ้งแม่ ไม่ใช่ยืนยัน
//   จุดแยกมีพื้นที่ของตัวเอง          → ใช้ของตัวเอง ห้ามถูกของแม่ทับ
//
// ⚠ เทสสร้าง split ของตัวเองบนบุคกิ้งจริง แล้วคืนค่าเดิมทุกใบตอนจบ
//
// เทสนี้กันเจ็ดอย่าง
//   1 แยกคนเฉย ๆ (ไม่มีจุดรับของตัวเอง) · ตาราง By trip ต้องขึ้นพื้นที่ของบุคกิ้งแม่ ไม่ใช่ขีด
//   2 แยกคนเฉย ๆ · ขึ้นแบบป้ายเต็ม ไม่ใช่แบบจาง เพราะเป็นที่เดียวกันจริง
//   3 แยกไปรับคนละโรงแรม แต่ยังไม่เลือกพื้นที่ · ขึ้นพื้นที่ของแม่แบบจาง พร้อมบอกเหตุผล
//   4 จุดแยกที่มีพื้นที่ของตัวเอง · ต้องใช้ของตัวเอง ห้ามถูกของแม่ทับ
//   5 ใบงานรถ · แถวแยกคนต้องขึ้นพื้นที่ในช่อง ZONE ไม่ใช่ขีด
//   6 บุคกิ้งที่ไม่มีพื้นที่เลย ยังขึ้นขีดเหมือนเดิม (ห้ามเดาพื้นที่ขึ้นมาเอง)
//   7 ไม่มี error บนหน้า

import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1800, height: 1300 });
await goView(page, 'booking', 1000);

/* ══ 0 · หาบุคกิ้งที่มีพื้นที่รับชัดเจน แล้วแยกคนออกมาสามแบบ ═══════════ */
const R0 = await page.evaluate(() => {
  for (const f of ['bkV2GetArea', 'bkOpsFor', 'bkOpsRead', 'bkV2Render'])
    if (typeof window[f] !== 'function') return { err: 'ยังไม่มีฟังก์ชัน ' + f };
  if (typeof bkV2SplitArea !== 'function') return { err: 'ยังไม่มี bkV2SplitArea' };

  /* ผู้สมัคร = ใบที่ยังไม่ยกเลิก · มีพื้นที่รับผูกไว้ · คนพอจะแยกได้ · ยังไม่มี split
     และไม่มี altPickups (ใบพวกนั้นถูก bkV2SyncAltPickupSplits เขียน split ทับเอง) */
  const cands = [];
  (SB_BOOKINGS || []).forEach(b => {
    if (!b || (typeof ckIsCxl === 'function' && ckIsCxl(b))) return;
    if (Array.isArray(b.altPickups) && b.altPickups.length) return;
    /* พื้นที่ของใบจอง · ชุดข้อมูลจริงส่วนใหญ่ยังไม่ได้ผูก pickupAreaId
       มีแต่ข้อความดิบจาก B2C · ทั้งสองแบบต้องยืมต่อให้จุดแยกได้เหมือนกัน */
    const arName = (b.pickupAreaId ? ((bkV2GetArea(b.pickupAreaId) || {}).name || '') : '')
                || String(b.pickupArea || '').trim();
    if (!arName) return;
    (b.trips || []).forEach(t => {
      if (!t.date || !t.routeId || t.bookingMode === 'charter') return;
      const o = bkOpsRead(b, t.date);
      if (o && Array.isArray(o.vanSplits) && o.vanSplits.length) return;
      const n = (typeof bkV2PaxAllTot === 'function') ? bkV2PaxAllTot(t.pax || {}) : 0;
      if (n < 2) return;
      cands.push({ id: b.id, date: t.date, routeId: t.routeId, area: arName, areaId: b.pickupAreaId || '',
                   hotel: b.hotelName || b.pickup || '', n });
    });
  });
  if (cands.length < 3) return { err: 'ชุดข้อมูลนี้หาใบที่มีพื้นที่รับและแยกคนได้ไม่ถึงสามใบ' };

  /* เอาสามใบที่อยู่วันเดียวกัน+โปรแกรมเดียวกัน จะได้วาดหน้าเดียวเห็นครบ */
  const byTrip = {};
  cands.forEach(c => { const k = c.date + '|' + c.routeId; (byTrip[k] = byTrip[k] || []).push(c); });
  const key = Object.keys(byTrip).sort().find(k => byTrip[k].length >= 3);
  if (!key) return { err: 'ไม่มีวัน+โปรแกรมไหนที่มีใบแบบนี้ถึงสามใบ' };
  const [date, routeId] = key.split('|');
  const [A, B, C] = byTrip[key].slice(0, 3);

  /* พื้นที่อื่นที่ไม่ใช่ของ C เอาไว้ทดสอบว่าพื้นที่ของจุดแยกไม่ถูกของแม่ทับ */
  const other = (SB_PICKUP_AREAS || []).find(a => a && a.id && a.name && a.id !== C.areaId);
  if (!other) return { err: 'มีพื้นที่รับในระบบไม่ถึงสองอัน' };

  const undo = [];
  const split = (c, extra) => {
    const o = bkOpsFor(c.id ? (SB_BOOKINGS.find(x => x.id === c.id)) : null, date);
    undo.push({ id: c.id, prev: o.vanSplits ? JSON.parse(JSON.stringify(o.vanSplits)) : undefined });
    o.vanSplits = [
      { pax: c.n - 1, ad: c.n - 1, chd: 0, inf: 0, foc: 0, main: true,  vanGroup: 0, vanSeq: 0 },
      Object.assign({ pax: 1, ad: 1, chd: 0, inf: 0, foc: 0, main: false, fromAlt: true,
                      vanGroup: 0, vanSeq: 0, altWho: 'T-SZ' }, extra)
    ];
  };
  split(A, {});                                                   // แยกคนเฉย ๆ · จุดรับเดิม
  split(B, { pickHotel: 'T-SZ Hotel ที่อื่น' });                    // คนละโรงแรม · ยังไม่เลือกพื้นที่
  split(C, { pickHotel: 'T-SZ Hotel อีกที่', pickAreaId: other.id }); // มีพื้นที่ของตัวเอง
  if (typeof acctPersistBookings === 'function') acctPersistBookings();

  _bkV2.tab = 'bytrip'; _bkV2.vanAssignMode = false;
  _bkV2.filterRoute = routeId; _bkV2.filterDate = date;
  bkV2Render();

  const cell = alKey => {
    const tr = document.querySelector('tr[data-al="' + alKey.replace(/"/g, '') + '"]');
    if (!tr) return { miss: true };
    const tag = tr.querySelector('.t2-zonetag');
    return { miss: false, text: tag ? (tag.textContent || '').trim() : '',
             lend: tag ? !!tag.getAttribute('data-lend') : false,
             title: tag ? (tag.getAttribute('title') || '') : '',
             dash: !tag };
  };
  return { date, routeId, other: other.name,
           A: { area: A.area, main: cell(A.id + '@0'), alt: cell(A.id + '@1') },
           B: { area: B.area, alt: cell(B.id + '@1') },
           C: { area: C.area, alt: cell(C.id + '@1') },
           undo };
});
if (R0.err) { fail(R0.err); console.log('\n✗ 1 ข้อไม่ผ่าน'); await close(); process.exit(1); }
ok('แยกคนบนบุคกิ้งจริงสามใบใน ' + R0.date + ' · จุดรับเดิม / คนละโรงแรม / มีพื้นที่ของตัวเอง');

/* ══ 1 · 2 · แยกคนเฉย ๆ ════════════════════════════════════════════ */
{
  const a = R0.A.alt;
  if (a.miss) fail('ข้อ 1 · หาแถวที่แยกออกมาไม่เจอในตาราง');
  else if (a.dash || !a.text)
    fail('แยกคนแล้วช่อง Zone ว่างเป็นขีด · ควรขึ้น "' + R0.A.area + '" เหมือนบุคกิ้งแม่ (คนจัดรถจะจัดกลุ่มตามพื้นที่ไม่ได้)');
  else if (a.text !== R0.A.area)
    fail('ช่อง Zone ของแถวที่แยกออกมาขึ้น "' + a.text + '" ควรเป็น "' + R0.A.area + '"');
  else if (R0.A.main.text !== R0.A.area)
    fail('แถวจุดหลักเองก็เพี้ยน · ขึ้น "' + R0.A.main.text + '" ควรเป็น "' + R0.A.area + '"');
  else ok('แยกคนเฉย ๆ · ทั้งแถวจุดหลักและแถวที่แยกออกมาขึ้น "' + R0.A.area + '" เหมือนกัน');

  if (a.miss || a.dash) { /* ข้อ 1 รายงานไปแล้ว */ }
  else if (a.lend)
    fail('แยกคนที่จุดรับเดิม ไม่ควรขึ้นแบบจาง · ที่เดียวกันจริง ไม่ใช่การเดาจากบุคกิ้งแม่');
  else ok('แยกคนที่จุดรับเดิมขึ้นป้ายเต็มเหมือนแถวปกติ · ไม่ถูกทำให้ดูเหมือนข้อมูลไม่แน่นอน');
}

/* ══ 3 · แยกไปรับคนละโรงแรม แต่ยังไม่เลือกพื้นที่ ══════════════════ */
{
  const b = R0.B.alt;
  if (b.miss) fail('ข้อ 3 · หาแถวที่แยกไปคนละโรงแรมไม่เจอ');
  else if (b.dash || !b.text)
    fail('แยกไปรับคนละโรงแรมแล้วช่อง Zone ว่างเป็นขีด · ควรยืมพื้นที่ของบุคกิ้งแม่มาโชว์ไว้ก่อน');
  else if (b.text !== R0.B.area)
    fail('ควรยืมพื้นที่ของบุคกิ้งแม่ "' + R0.B.area + '" · ได้ "' + b.text + '"');
  else if (!b.lend || !b.title)
    fail('ยืมพื้นที่ของแม่มาโชว์ แต่ไม่ได้บอกว่ายืมมา · คนอ่านจะนึกว่าจุดแยกนี้อยู่พื้นที่นั้นจริง');
  else ok('แยกไปคนละโรงแรมขึ้น "' + b.text + '" แบบจางพร้อมบอกว่าเป็นของบุคกิ้งแม่ ไม่ใช่ยืนยัน');
}

/* ══ 4 · จุดแยกที่มีพื้นที่ของตัวเอง ═══════════════════════════════ */
{
  const c = R0.C.alt;
  if (c.miss) fail('ข้อ 4 · หาแถวที่แยกพร้อมพื้นที่ของตัวเองไม่เจอ');
  else if (c.text !== R0.other)
    fail('จุดแยกมีพื้นที่ของตัวเอง ("' + R0.other + '") แต่ขึ้น "' + c.text + '" · ของแม่ไปทับของจุดแยก');
  else if (c.lend)
    fail('จุดแยกมีพื้นที่ของตัวเองแล้ว ไม่ควรขึ้นแบบจาง');
  else ok('จุดแยกที่เลือกพื้นที่เองไว้ ยังขึ้น "' + R0.other + '" ของตัวเอง ไม่ถูกของบุคกิ้งแม่ทับ');
}

/* ══ 5 · ใบงานรถ ═══════════════════════════════════════════════════ */
{
  const R = await page.evaluate(([date, routeId]) => {
    const van = (typeof SB_VEHICLES !== 'undefined' ? SB_VEHICLES : (window.VEHICLES || [])).filter(v => v && v.id)[0];
    if (!van) return { err: 'ไม่มีรถในระบบ' };
    let bk = null;
    (SB_BOOKINGS || []).forEach(b => {
      const o = bkOpsRead(b, date);
      /* ใช้ใบที่แยกไปรับคนละโรงแรม · ใบที่แยกคนเฉย ๆ ถูกยุบกลับเป็นแถวเดียวในใบงาน
         (จุดรับเดียวกันของใบเดียวกัน) จึงไม่ได้เดินผ่านเส้นทางแถวแยกเลย */
      if (!bk && o && Array.isArray(o.vanSplits) && o.vanSplits.some(s => s.altWho === 'T-SZ' && !s.pickAreaId && s.pickHotel)) bk = b;
    });
    if (!bk) return { err: 'หาใบที่แยกไปรับคนละโรงแรมไม่เจอ' };
    const o = bkOpsFor(bk, date);
    o.vanId = van.id; o.vanGroup = 0;
    o.vanSplits.forEach(s => { s.vanId = van.id; s.vanGroup = 0; });
    if (typeof acctPersistBookings === 'function') acctPersistBookings();
    const area = (bkV2GetArea(bk.pickupAreaId) || {}).name || '';
    const html = (typeof vanJobsOrderInner === 'function') ? vanJobsOrderInner(date, van.id, routeId, null, 0) : '';
    const d = document.createElement('div'); d.innerHTML = html.split('② ขากลับ')[0];
    const rows = [...d.querySelectorAll('tr')].filter(tr => !tr.closest('thead'));
    const mine = rows.filter(tr => /T-SZ Hotel/.test(tr.textContent || ''));
    return { area, n: mine.length,
             withArea: mine.filter(tr => (tr.textContent || '').indexOf(area) >= 0).length,
             sample: mine.length ? (mine[0].textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90) : '' };
  }, [R0.date, R0.routeId]);
  if (R.err) fail('ข้อ 5 · ' + R.err);
  else if (!R.n) fail('ข้อ 5 · ใบงานรถไม่มีแถวของจุดแยกเลย');
  else if (R.withArea !== R.n)
    fail('ใบงานรถ · มีแถวของใบนี้ ' + R.n + ' แถว แต่ขึ้นพื้นที่ "' + R.area + '" แค่ ' + R.withArea
         + ' แถว · คนขับใช้ช่องนี้ไล่ลำดับการวิ่ง (แถวตัวอย่าง: ' + R.sample + ')');
  else ok('ใบงานรถ · แถวที่แยกคนขึ้นพื้นที่ "' + R.area + '" ครบทั้ง ' + R.n + ' แถว');
}

/* ══ 6 · ใบที่ไม่มีพื้นที่เลย ต้องไม่เดาขึ้นมาเอง ══════════════════ */
{
  const R = await page.evaluate(() => {
    const fake = { id: 'x', hotelName: 'Somewhere', pickup: '', pickupArea: '', pickupAreaId: '' };
    const r1 = bkV2SplitArea(fake, { areaId: '', hotel: '' }, null);
    const r2 = bkV2SplitArea(fake, { areaId: '', hotel: 'Another place' }, null);
    return { n1: r1.name, n2: r2.name };
  });
  if (R.n1 || R.n2) fail('บุคกิ้งที่ไม่มีพื้นที่เลย กลับได้พื้นที่มาจากไหนไม่รู้ · "' + R.n1 + '" / "' + R.n2 + '"');
  else ok('บุคกิ้งที่ไม่มีพื้นที่เลย ยังคืนค่าว่าง · ไม่เดาพื้นที่ขึ้นมาเอง');
}

/* ══ 7 ═══════════════════════════════════════════════════════════ */
await page.evaluate(undo => {
  (undo || []).forEach(u => {
    const b = (SB_BOOKINGS || []).find(x => x.id === u.id); if (!b) return;
    const o = b.ops || {};
    if (u.prev === undefined) delete o.vanSplits; else o.vanSplits = u.prev;
  });
  if (typeof acctPersistBookings === 'function') acctPersistBookings();
}, R0.undo);
if (errors.length) fail('มี error บนหน้า · ' + errors.slice(0, 3).join(' | '));
else ok('ไม่มี error บนหน้า');

await close();
console.log(bad ? '\n✗ ' + bad + ' ข้อไม่ผ่าน' : '\n✓ ผ่านทั้งหมด');
process.exit(bad ? 1 : 0);
