// §bkLock · ล็อกเรือทั้งลำ
//
// ที่มา (2026-10-01) · ผู้ใช้ถามว่า "มันจะมีการล็อคแบบเป็นเรือทั้งลำไว้ด้วย อันนี้ต้องทำยังไงดี"
//   เคสจริง · เอเยนต์ขอจองเรือไว้ทั้งลำก่อน ยังไม่ยืนยันจำนวนหัว จึงยังออกใบเหมาลำไม่ได้
//   ของเดิมมีสองสถานะ — ล็อกที่นั่ง (กันเป็นจำนวนที่นั่ง) กับใบเหมาลำ (มีใบจองจริง) อันนี้อยู่ตรงกลาง
//
// สิ่งที่ตกลงกันไว้สามข้อ
//   1 บอกเอเยนต์ได้สองแบบ — สัญญาลำเจาะจง หรือสัญญา "1 ลำ ไม่น้อยกว่า X ที่"
//   2 ระหว่างล็อก เรือหายจากพูลขายที่นั่งทันที เหมือนเหมาลำ
//   3 ตอนเอเยนต์ยืนยัน กดปุ่มเดียวกลายเป็นใบเหมาลำ
//
// เส้นที่ต้องรักษา · ที่นั่งต้องหายไป "ครั้งเดียว"
//   ใบล็อกชนิดนี้เก็บ qty = ที่นั่งขั้นต่ำที่สัญญาไว้ ไม่ใช่โควตาที่กันจากพูล
//   ถ้ามันหลุดเข้า bkV2LocksFor เมื่อไหร่ ที่นั่งจะถูกหักสองรอบทันที (ข้อ 2 คุมจุดนี้)
//
// ⚠ เทสสร้างล็อกของตัวเองบนข้อมูลจริง แล้วคืนสถานะทุกอย่างตอนจบ
//
// เทสนี้กันเก้าอย่าง
//   1 สร้างล็อกได้ · ช่องบนกระดานเรือกลายเป็น charter + boatLockId · booked ถูกล้างเป็น 0
//   2 ที่นั่งหายครั้งเดียว · ความจุลดเท่าความจุเรือพอดี และ lockedSeats ต้องไม่ขยับ
//   3 เรือที่มีใบจองอยู่แล้ว ล็อกไม่ได้ · และต้องคืน "รายการใบจอง" ไม่ใช่แค่ปฏิเสธ
//   4 ห้ามใครยึด/ลบช่องที่กันไว้ (ตัวกวาดใบเหมาลำ + ปุ่ม Clear assignments)
//   5 ปล่อยลำแล้วเรือกลับเข้าพูล · เซลล์ยังอยู่ ไม่ถูกลบทิ้ง
//   6 รีเฟรชแล้วล็อกยังอยู่ (ผ่านทางบูตจริง ไม่ใช่แค่ตัวแปรในหน้า)
//   7 เลยวันหมดอายุแล้ว ตัวกวาดต้องไม่ปิดใบเอง ไม่งั้นเรือหายโดยไม่มีเจ้าของให้ตาม
//   8 สลับลำแบบ "1 ลำ ≥ X" ไปลำที่เล็กกว่าที่สัญญาไว้ ต้องไม่ผ่าน
//   9 ไม่มี error บนหน้า
//  10 ใบชนิดเรือโผล่แค่ในตารางของมัน · ไม่ไปปนในรายการล็อกที่นั่ง
//  11 ฟอร์มมีแต่เส้นทางเรือ ไม่มีโปรแกรมบก · และเรือต้องอยู่ท่าเดียวกับเส้นทาง
//  12 ห้ามกันเรือที่ลูกค้าที่ขายไปแล้วต้องใช้ · ทริปจะเหลือความจุไม่พอ
//  13 ใบงาน By trip ขึ้นแถวเรือที่กันไว้ · ป้ายบนแถบโปรแกรม · จำนวนลำลดลงจริง
//
// §bkLockEdit + §bkLockMf (2026-10-02) · ผู้ใช้แจ้งว่า
//   "สามารถแก้ไขได้ + มีรายละเอียดที่ใส่หมายเหตุได้ แต่ไม่โชว์ · ในหน้า Manifest ก็ไม่โชว์"
//  14 แก้ใบได้ (หมายเหตุ วันหมดอายุ ที่นั่งขั้นต่ำ ผู้ถือ) · ลงที่เก็บ · ช่องบนกระดานเรือไม่ขยับ
//     และค่าที่ผิดกติกาถูกปัดตกที่ชั้นข้อมูล
//  15 ย้ายลำผ่านการแก้ · ลำเดิมกลับเป็นรอบปกติ ลำใหม่ถูกจับ · ย้ายไปลำที่มีคนใช้อยู่ไม่ได้
//     และลำของตัวเองต้องเลือกกลับได้เสมอ
//  16 หน้า Seat Locks โชว์หมายเหตุ + มีปุ่มแก้ไข · ฟอร์มแก้เปิดแล้วบันทึกได้
//  17 ใบงาน By trip โชว์หมายเหตุเต็ม ไม่ถูกตัด · การ์ดหัวหน้าทั้งสามใบรู้จักเรือที่กันไว้

import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1200 });
await goView(page, 'booking', 900);

/* ══ 0 · หาวัน/เส้นทาง/ลำ ที่ว่างจริง ═══════════════════════════════════════ */
const R0 = await page.evaluate(() => {
  for (const f of ['bkV2CreateBoatLock','bkV2BoatLockBlockers','bkV2BoatLockRelease',
                   'bkV2BoatLockSwap','bkV2IsBoatLock','bkV2LocksFor','getAllotment','opLocked'])
    if (typeof window[f] !== 'function') return { err: 'ยังไม่มีฟังก์ชัน ' + f };

  /* ผู้สมัคร = ช่องใน TRIPS ที่ยังเป็นรอบปกติ · ไม่มีใบจองเกาะลำนั้น · เลขบนช่องเป็น 0
     และวันนั้นเส้นทางเปิดขายจริง (getAllotment ตอบว่ามี allotment) */
  const cands = [];
  const dates = Object.keys(TRIPS || {}).sort();
  for (const ds of dates) {
    for (const [bid, op] of Object.entries(TRIPS[ds] || {})) {
      if (!op || Array.isArray(op) || !op.route) continue;
      if (opLocked(op) || op.type === 'charter') continue;
      if ((op.booked || 0) > 0) continue;
      /* ใช้ด่านจริงตัวเดียวกับตอนสร้าง · ไม่งั้นเลือกลำที่ด่านอื่นปัดตกมาแล้วเทสล้มทั้งแถบ
         ด้วยเหตุผลที่ไม่เกี่ยวกับสิ่งที่กำลังวัด (เคสนี้คือด่านทริปขายไปแล้ว ข้อ 12) */
      if (!bkV2BoatLockCanTake(ds, bid, op.route)) continue;
      const A = getAllotment(op.route, ds);
      if (!A.hasAllotment || A.availableCapacity <= 0) continue;
      const cap = bkV2BoatCapOn(bid, ds);
      if (cap <= 0 || cap > A.availableCapacity) continue;
      cands.push({ date: ds, boatId: bid, routeId: op.route, cap });
      if (cands.length >= 6) break;
    }
    if (cands.length >= 6) break;
  }
  if (!cands.length) return { err: 'ไม่เจอเรือว่างสักลำในข้อมูลชุดนี้ · เทสนี้ต้องมีของจริงให้ล็อก' };

  const c = cands[0];
  const before = getAllotment(c.routeId, c.date);
  return { pick: c, others: cands.slice(1),
    before: { cap: before.availableCapacity, locked: before.lockedSeats || 0, avail: before.seatsAvailable },
    cellBefore: JSON.parse(JSON.stringify(TRIPS[c.date][c.boatId])) };
});
if (R0.err) { fail(R0.err); await close(); process.exit(1); }
const PICK = R0.pick;

/* ══ 1 · สร้างล็อก · ช่องบนกระดานเรือต้องเปลี่ยนสถานะ ═══════════════════════ */
const R1 = await page.evaluate(p => {
  const l = bkV2CreateBoatLock({ routeId: p.routeId, date: p.date, boatId: p.boatId,
    holderType: 'agent', holderId: 'a07', minCap: p.cap, fixed: true,
    expiry: p.date, reason: 'test · boat hold' });
  if (!l) return { err: 'สร้างไม่ผ่าน' };
  const op = TRIPS[p.date][p.boatId];
  /* เซฟลงที่เก็บทันทีตั้งแต่ตอนสร้าง · ไม่ใช่รอให้คำสั่งอื่นมาเซฟให้ทีหลัง
     คนสร้างล็อกแล้วรีเฟรชเลยต้องเห็นของครบ · อ่านจากที่เก็บจริง ไม่ใช่ตัวแปรในหน้า */
  let stored = null;
  try {
    const d = JSON.parse(localStorage.getItem('loveandaman_v2') || '{}');
    const c = d.trips && d.trips[p.date] && d.trips[p.date][p.boatId];
    const k = (d.sb_seat_locks || []).find(x => x && x.id === l.id);
    stored = { cellRef: (c && c.boatLockId) || '', cellType: (c && c.type) || '', lock: !!k };
  } catch (e) { stored = { err: String(e) }; }
  return { id: l.id, scope: l.scope, boatId: l.boatId, qty: l.qty, sub: l.subName,
    type: op.type, lockRef: op.boatLockId, booked: op.booked, chtr: !!op.charterBookingId, stored };
}, PICK);
if (R1.err) { fail('สร้างล็อกเรือไม่ผ่าน: ' + R1.err); }
else {
  const good = R1.scope === 'boat' && R1.type === 'charter' && R1.lockRef === R1.id
    && R1.booked === 0 && !R1.chtr;
  const kept = R1.stored && R1.stored.lock && R1.stored.cellRef === R1.id && R1.stored.cellType === 'charter';
  if (good && kept) ok(`1 สร้างล็อกได้ · ช่องเป็น charter + boatLockId · booked ${R1.booked} · ลงที่เก็บแล้วตั้งแต่ตอนสร้าง`);
  else if (!good) fail(`1 ช่องบนกระดานเรือไม่ถูก: type=${R1.type} ref=${R1.lockRef} booked=${R1.booked}`);
  else fail(`1 สร้างแล้วไม่ลงที่เก็บ · รีเฟรชทันทีจะหาย: ${JSON.stringify(R1.stored)}`);
}
const LOCK_ID = R1.id;

/* ══ 2 · ที่นั่งต้องหายครั้งเดียว ═══════════════════════════════════════════
   ความจุลดเท่าความจุเรือพอดี · และ lockedSeats (ที่นั่งที่กันจากพูล) ต้องไม่ขยับเลย
   ถ้าใบชนิดนี้หลุดเข้า bkV2LocksFor เมื่อไหร่ lockedSeats จะโตขึ้นตาม qty = หักสองรอบ */
const R2 = await page.evaluate(p => {
  const A = getAllotment(p.routeId, p.date);
  return { cap: A.availableCapacity, locked: A.lockedSeats || 0, avail: A.seatsAvailable,
    inPool: bkV2LocksFor(p.routeId, p.date).filter(l => bkV2IsBoatLock(l)).length,
    onDate: (typeof bkV2LocksOnDate === 'function')
      ? bkV2LocksOnDate(p.date).filter(l => bkV2IsBoatLock(l)).length : -1 };
}, PICK);
{
  const dCap = R0.before.cap - R2.cap;
  const dLock = R2.locked - R0.before.locked;
  if (dCap === PICK.cap && dLock === 0 && R2.inPool === 0 && R2.onDate === 0)
    ok(`2 ที่นั่งหายครั้งเดียว · ความจุ −${dCap} (เรือ ${PICK.cap} ที่) · lockedSeats ไม่ขยับ`);
  else
    fail(`2 หักซ้ำ/หักผิด: ความจุ −${dCap} (ควร −${PICK.cap}) · lockedSeats +${dLock} (ควร 0) · หลุดเข้าพูล ${R2.inPool}/${R2.onDate} ใบ`);
}

/* ══ 3 · เรือที่มีใบจองอยู่แล้ว ล็อกไม่ได้ · และต้องบอกว่าติดใบไหน ═══════════ */
const R3 = await page.evaluate(() => {
  /* หาลำที่มีใบจองเกาะอยู่จริงในข้อมูล · ไม่ยัดข้อมูลปลอม */
  for (const ds of Object.keys(TRIPS || {}).sort()) {
    for (const bid of Object.keys(TRIPS[ds] || {})) {
      const B = bkV2BoatLockBlockers(ds, bid);
      if (B.pax > 0 && B.rows.length) {
        return { date: ds, boatId: bid, pax: B.pax, rows: B.rows.length,
          hasVc: B.rows.every(r => !!r.vc), can: bkV2BoatLockCanTake(ds, bid),
          made: !!bkV2CreateBoatLock({ routeId: TRIPS[ds][bid].route, date: ds, boatId: bid,
            holderType: 'office', minCap: 10, expiry: ds, reason: 'test · should fail' }) };
      }
    }
  }
  return { none: true };
});
if (R3.none) fail('3 ไม่เจอเรือที่มีใบจองในข้อมูลชุดนี้ · ข้อนี้พิสูจน์อะไรไม่ได้');
else if (!R3.can && !R3.made && R3.rows > 0 && R3.hasVc)
  ok(`3 เรือมีใบจอง ${R3.pax} ที่ → ล็อกไม่ได้ · คืนรายการ ${R3.rows} ใบ พร้อมเลข VC ครบ`);
else
  fail(`3 ด่านกันรั่ว: can=${R3.can} สร้างได้=${R3.made} rows=${R3.rows} มี VC ครบ=${R3.hasVc}`);

/* ══ 4 · ห้ามใครยึดหรือลบช่องที่กันไว้ ═══════════════════════════════════════
   สองทางที่เคยลบ/ยึดได้จริง · ตัวกวาดของใบเหมาลำ กับปุ่ม Clear assignments
   ทั้งคู่เช็ค op.charterBookingId อย่างเดียว ซึ่งช่องที่กันไว้ไม่มี               */
const R4 = await page.evaluate(p => {
  const out = { heal: null, clear: null, ran: false };
  /* ใบเหมาลำของ "เจ้าอื่น" ที่อยากได้ลำเดียวกันวันเดียวกัน · นี่คือเคสที่เคยยึดไปได้จริง
     ต้องเป็นใบค้างเกาะ (ช่วง ≥ 2 วัน) ตัวกวาดถึงจะเข้ามาจองเรือให้ครบช่วง */
  const nx = new Date(p.date + 'T00:00:00'); nx.setDate(nx.getDate() + 1);
  const nxs = nx.getFullYear() + '-' + String(nx.getMonth()+1).padStart(2,'0') + '-' + String(nx.getDate()).padStart(2,'0');
  const ghost = { id: 'BK-BOATLOCK-TEST', status: 'confirmed', schemaVer: 2, agentId: 'a01',
    trips: [{ routeId: p.routeId, date: p.date, bookingMode: 'charter', charterBoatId: p.boatId,
              ovn: 'return', ovnReturnDate: nxs, pax: { ad_fr: 2 } }] };
  SB_BOOKINGS.unshift(ghost);
  let res = null;
  try { if (typeof bkOvnHealSpans === 'function') { res = bkOvnHealSpans(); out.ran = true; } } catch (e) { out.ran = 'err:' + e; }
  const a = TRIPS[p.date] && TRIPS[p.date][p.boatId];
  out.heal = a ? { ref: a.boatLockId || '', chtr: a.charterBookingId || '' } : { gone: true };
  out.blocked = !!(res && (res.blocked || []).some(x => x.date === p.date));
  SB_BOOKINGS = SB_BOOKINGS.filter(b => b.id !== 'BK-BOATLOCK-TEST');
  if (TRIPS[nxs] && TRIPS[nxs][p.boatId] && !TRIPS[nxs][p.boatId].charterBookingId
      && TRIPS[nxs][p.boatId].route === p.routeId) delete TRIPS[nxs][p.boatId];
  /* จำลองสิ่งที่ปุ่ม Clear assignments ทำ · ใช้ด่านเดียวกับของจริง (opLocked) */
  let cleared = 0;
  Object.keys(TRIPS[p.date] || {}).forEach(bid => {
    if (opLocked(TRIPS[p.date][bid])) return;
    if (bid === p.boatId) cleared++;
  });
  out.clear = { wouldClear: cleared };
  return out;
}, PICK);
if (R4.ran !== true) fail('4 ตัวกวาดใบเหมาลำไม่ได้ทำงาน · ข้อนี้พิสูจน์อะไรไม่ได้: ' + R4.ran);
else if (R4.heal && !R4.heal.gone && R4.heal.ref === LOCK_ID && !R4.heal.chtr
         && R4.blocked && R4.clear.wouldClear === 0)
  ok('4 ใบเหมาของเจ้าอื่นยึดลำที่กันไว้ไม่ได้ (ถูกนับเป็น blocked) · Clear assignments ไม่ลบเซลล์');
else
  fail(`4 ช่องที่กันไว้ถูกแตะ: ${JSON.stringify(R4)}`);

/* ══ 7 · เลยวันหมดอายุแล้ว ตัวกวาดห้ามปิดใบเอง ═══════════════════════════════
   ปิดเองแล้วใบหายจากรายการ แต่ช่องบนกระดานเรือยังเป็น charter ค้าง
   = เรือหายไปทั้งลำโดยไม่มีเจ้าของให้ไปตาม (§lkNoAuto แต่เข้มกว่าของที่นั่ง)   */
const R7 = await page.evaluate(id => {
  const l = SB_SEAT_LOCKS.find(x => x.id === id); if (!l) return { err: 'ไม่เจอล็อก' };
  const wasExp = l.expiry;
  l.expiry = '2020-01-01';                      /* เลยกำหนดไปห้าปี */
  if (typeof bkV2LockExpireSweep === 'function') bkV2LockExpireSweep();
  const st = l.status, od = bkV2BoatLockOverdue(l, '2026-10-01');
  l.expiry = wasExp;
  return { st, od };
}, LOCK_ID);
if (R7.st === 'active' && R7.od) ok('7 เลยกำหนดแล้วใบยังเปิดอยู่ · ขึ้นเป็นของค้างแทนที่จะหายเงียบ');
else fail(`7 ตัวกวาดปิดใบเรือเอง: status=${R7.st} overdue=${R7.od}`);

/* ══ 8 · สลับลำ · "1 ลำ ≥ X" ห้ามลดขนาดต่ำกว่าที่สัญญาไว้ ════════════════════ */
const R8 = await page.evaluate(p => {
  const l = SB_SEAT_LOCKS.find(x => x.id === p.id); if (!l) return { err: 'ไม่เจอล็อก' };
  l.subName = 'any';                              /* สัญญาแบบ "เรือ 1 ลำ" */
  const free = bkV2BoatLockPickList(l.date, l.routeId).filter(b => b.ok && b.id !== l.boatId);
  const min = bkV2BoatLockMinCap(l);
  const small = free.find(b => b.cap < min), big = free.find(b => b.cap >= min);
  const out = { min, hasSmall: !!small, hasBig: !!big, smallOk: null, bigOk: null };
  /* ตัวตัดสินขนาดอยู่ในชั้น UI (bkV2BoatLockSwapGo) · ตรงนี้เช็คกติกาเดียวกัน
     แล้วพิสูจน์ว่าชั้นข้อมูลยอมสลับไปลำที่ว่างจริงเท่านั้น */
  /* ของจริง · เรียกตัวสลับลำตรง ๆ ด้วยลำที่เล็กกว่าที่สัญญาไว้ · ต้องถูกปัดตกที่ชั้นข้อมูล
     ไม่ใช่ที่ชั้นปุ่ม ไม่งั้นทางเรียกอื่นจะข้ามด่านนี้ไปได้ */
  if (small) {
    const was = l.boatId;
    out.smallOk = bkV2BoatLockSwap(l.id, small.id);
    out.smallStuck = (l.boatId === was)
      && !!(TRIPS[l.date][was] && TRIPS[l.date][was].boatLockId === l.id)
      && !(TRIPS[l.date][small.id] && TRIPS[l.date][small.id].boatLockId);
  }
  if (big) {
    const was = l.boatId;
    out.bigOk = bkV2BoatLockSwap(l.id, big.id);
    out.cellNew = !!(TRIPS[l.date][big.id] && TRIPS[l.date][big.id].boatLockId === l.id);
    out.cellOld = TRIPS[l.date][was] ? (TRIPS[l.date][was].type) : 'gone';
    bkV2BoatLockSwap(l.id, was);                  /* สลับกลับ */
  }
  l.subName = 'fixed';
  return out;
}, { id: LOCK_ID });
if (R8.err) fail('8 ' + R8.err);
else if (!R8.hasBig) fail('8 ไม่มีลำอื่นว่างให้สลับในข้อมูลชุดนี้ · ข้อนี้พิสูจน์อะไรไม่ได้');
else if (!R8.hasSmall) fail('8 ไม่มีลำที่เล็กกว่าที่สัญญาไว้ให้ลอง · ข้อนี้พิสูจน์ครึ่งเดียว');
else if (R8.bigOk && R8.cellNew && R8.cellOld === 'normal' && R8.smallOk === false && R8.smallStuck)
  ok(`8 สลับไปลำที่จุพอ (≥${R8.min}) ผ่าน · ลำเดิมกลับเป็นรอบปกติ · ลำที่เล็กกว่าถูกกติกาปัดตก`);
else
  fail(`8 การสลับลำผิด: ${JSON.stringify(R8)}`);

/* ══ 10 · หน้า Seat Locks ต้องโชว์ใบชนิดเรือในตารางของมันเท่านั้น ═══════════════
   เจอตอนดูภาพหน้าจริง · ใบเรือเคยโผล่ในรายการล็อกที่นั่งข้างล่างด้วย
   อ่านเป็น "กันที่นั่งไว้ 44 ที่" ทั้งที่ 44 คือความจุของลำ · คนละความหมายกันคนละเรื่อง
   ตัวชี้ขาดคือปุ่มประจำแถว · แถวของล็อกที่นั่งมีปุ่ม + ที่นั่ง (bkV2LockAddOpen) เสมอ */
await page.evaluate(() => { _bkV2LockUI.dayOff = 0; if (typeof bkV2SwitchTab === 'function') bkV2SwitchTab('locks'); });
await page.waitForTimeout(700);
const R10 = await page.evaluate(id => {
  const h = document.body.innerHTML;
  return { inBoatBox: h.indexOf("bkV2BoatLockToCharter('" + id + "')") >= 0,
           inSeatList: h.indexOf("bkV2LockAddOpen('" + id + "')") >= 0,
           hasBox: h.indexOf('เรือกันไว้ทั้งลำ') >= 0 };
}, LOCK_ID);
if (R10.inBoatBox && R10.hasBox && !R10.inSeatList)
  ok('10 ใบเรืออยู่ในตารางเรืออย่างเดียว · ไม่ไปโผล่ในรายการล็อกที่นั่ง');
else
  fail(`10 หน้าแสดงผิดที่: ${JSON.stringify(R10)}`);

/* ══ 11 · ฟอร์มต้องมีแต่ของฝั่งเรือ ══════════════════════════════════════════
   เจอตอนผู้ใช้เปิดช่องเลือกเส้นทางจริง · มี City Tour / รับส่งสนามบิน / โชว์ ปนมาด้วย
   กติกาของระบบคือโปรแกรมบกห้ามเข้าหน้าจอฝั่งเรือ · ถามผ่าน laIsLandRoute() จุดเดียว
   และเรือต้องอยู่ท่าเดียวกับเส้นทาง · เอาเรือพันวาไปวิ่งเส้นทางทับละมุไม่ได้ */
const R11 = await page.evaluate(() => {
  bkV2BoatLockOpen();
  const h = (typeof bkV2BoatLockModal === 'function') ? bkV2BoatLockModal() : '';
  const land = ROUTES.filter(r => laIsLandRoute(r.id));
  const sea  = ROUTES.filter(r => !laIsLandRoute(r.id));
  const inForm = id => h.indexOf('value="' + id + '"') >= 0;
  const out = { nLand: land.length, nSea: sea.length,
    landLeaked: land.filter(r => inForm(r.id)).map(r => r.name).slice(0, 4),
    seaShown: sea.filter(r => inForm(r.id)).length };
  /* ท่าเรือ · เลือกเส้นทางที่มีท่า แล้วดูว่ารายการเรือมีแต่ลำของท่านั้น */
  const rp = sea.find(r => r.pier);
  if (rp) {
    const names = bkV2BoatLockPickList('2026-11-15', rp.id).map(b => b.id);
    const wrong = names.filter(id => {
      const b = BOATS.find(x => x.id === id);
      const bp = (typeof getBoatCurrentPier === 'function') ? getBoatCurrentPier(b, '2026-11-15') : (b && b.pier);
      return bp && bp !== rp.pier;
    });
    out.pier = rp.pier; out.boats = names.length; out.wrongPier = wrong.length;
  }
  /* ชั้นบันทึกต้องกันด้วย ไม่ใช่แค่ซ่อนจากรายการ */
  out.landSaved = land.length
    ? !!bkV2CreateBoatLock({ routeId: land[0].id, date: '2026-11-15', boatId: (BOATS[0]||{}).id,
        holderType: 'office', minCap: 10, expiry: '2026-11-15', reason: 'test · land' })
    : null;
  bkV2BoatLockClose();
  return out;
});
if (!R11.nLand) fail('11 ชุดนี้ไม่มีโปรแกรมบกให้ทดสอบ · ข้อนี้พิสูจน์อะไรไม่ได้');
else if (!R11.landLeaked.length && R11.seaShown === R11.nSea
         && R11.wrongPier === 0 && R11.boats > 0 && R11.landSaved === false)
  ok(`11 ฟอร์มมีแต่เส้นทางเรือ ${R11.seaShown} เส้น (ตัดโปรแกรมบก ${R11.nLand}) · เรือมีแต่ของท่า ${R11.pier} ${R11.boats} ลำ`);
else
  fail(`11 ฟอร์มมีของฝั่งบกปน: ${JSON.stringify(R11)}`);

/* ══ 12 · ห้ามกันเรือที่ลูกค้าที่ขายไปแล้วต้องใช้ ═══════════════════════════════
   เจอตอนดูหน้า By trip ของจริง · 20 ก.ย. r10 ขายไปแล้ว 30 ที่ มีเรือลำเดียว
   ลูกค้ายังไม่ถูก assign ลงลำ ด่านเดิมจึงเห็นว่า "ลำนี้ว่าง" แล้วปล่อยให้ล็อกผ่าน
   ผลคือทริปเหลือความจุ 0 ที่ ขณะที่ลูกค้า 30 คนถือตั๋วอยู่ · หน้าจอขึ้น no boat */
const R12 = await page.evaluate(() => {
  for (const ds of Object.keys(TRIPS || {}).sort()) {
    const byR = {};
    for (const [bid, op] of Object.entries(TRIPS[ds] || {})) {
      if (!op || Array.isArray(op) || !op.route) continue;
      (byR[op.route] = byR[op.route] || []).push(bid);
    }
    for (const [rid, bids] of Object.entries(byR)) {
      const A = getAllotment(rid, ds); if (!A.hasAllotment) continue;
      const sold = A.seatsConsumed || 0; if (sold <= 0) continue;
      /* ลำที่เอาออกแล้วความจุที่เหลือไม่พอกับที่ขายไปแล้ว */
      const tight = bids.find(b => {
        const B = bkV2BoatLockBlockers(ds, b, rid);
        return B.short > 0 && !B.charterOf && !B.holdOf && B.pax === 0 && B.cellBooked === 0;
      });
      if (!tight) continue;
      const B = bkV2BoatLockBlockers(ds, tight, rid);
      return { ds, rid, boat: tight, sold: B.sold, capAfter: B.capAfter, short: B.short,
        can: bkV2BoatLockCanTake(ds, tight, rid),
        made: !!bkV2CreateBoatLock({ routeId: rid, date: ds, boatId: tight, holderType: 'office',
          minCap: 10, expiry: ds, reason: 'test · oversold' }),
        why: (bkV2BoatLockPickList(ds, rid).find(x => x.id === tight) || {}).why || '' };
    }
  }
  return { none: true };
});
if (R12.none) fail('12 ไม่เจอทริปที่เรือตึงในชุดนี้ · ข้อนี้พิสูจน์อะไรไม่ได้');
else if (!R12.can && !R12.made && R12.short > 0 && /ขาด/.test(R12.why))
  ok(`12 ทริปขายไปแล้ว ${R12.sold} ที่ · เอาลำนี้ออกเหลือ ${R12.capAfter} ขาด ${R12.short} → ล็อกไม่ได้ และบอกเหตุผล`);
else
  fail(`12 กันเรือที่ลูกค้าต้องใช้ไปได้: ${JSON.stringify(R12)}`);


/* ══ 14 · แก้ใบได้ · ลงที่เก็บ · ช่องบนกระดานเรือไม่ขยับ ═══════════════════════
   ของเดิมสร้างแล้วแก้ไม่ได้ ต้องปล่อยลำแล้วสร้างใหม่ ระหว่างนั้นเรือกลับเข้าพูลให้คนอื่นจอง
   ข้อนี้คุมว่าแก้แล้ว "เรือไม่เคยหลุดมือ" และของที่แก้ลงที่เก็บจริง */
const NOTE = 'test · NOTE-14 กรุ๊ปบริษัท รอยืนยันจำนวนหัว ผู้ประสานงานคุณเอ ขอเรือมีหลังคา';
const R14 = await page.evaluate(p => {
  if (typeof bkV2BoatLockEdit !== 'function') return { err: 'ยังไม่มี bkV2BoatLockEdit' };
  const l = SB_SEAT_LOCKS.find(x => x.id === p.id);
  const capA = getAllotment(l.routeId, l.date).availableCapacity;
  const d = new Date(l.date + 'T00:00'); d.setDate(d.getDate() - 1);
  const exp = bkV2LocalYMD(d);
  const logN = (l.log || []).length;
  /* ค่าที่ผิดกติกา · ต้องไม่ผ่าน และต้องไม่ทิ้งรอยไว้ในใบ */
  const d2 = new Date(l.date + 'T00:00'); d2.setDate(d2.getDate() + 3);
  const badExp = bkV2BoatLockEdit(p.id, { expiry: bkV2LocalYMD(d2) });
  const badMin = bkV2BoatLockEdit(p.id, { minCap: 0 });
  const untouched = l.expiry === p.date && l.qty === p.cap;
  const r = bkV2BoatLockEdit(p.id, { reason: p.note, expiry: exp, minCap: p.cap - 1,
    holderType: 'office' });
  const op = TRIPS[l.date][l.boatId];
  let stored = null;
  try {
    const D = JSON.parse(localStorage.getItem('loveandaman_v2') || '{}');
    const k = (D.sb_seat_locks || []).find(x => x && x.id === p.id) || {};
    stored = { reason: k.reason || '', expiry: k.expiry || '', qty: k.qty };
  } catch (e) { stored = { err: String(e) }; }
  const last = (l.log || [])[(l.log || []).length - 1] || {};
  return { ok: r.ok, changed: (r.changed || []).length,
    badExp: badExp.ok, badMin: badMin.ok, untouched,
    reason: l.reason, expiry: l.expiry, exp, qty: l.qty, ht: l.holderType, hi: l.holderId,
    cellRef: op.boatLockId, cellType: op.type,
    capSame: getAllotment(l.routeId, l.date).availableCapacity === capA,
    logged: (l.log || []).length === logN + 1 && last.type === 'edit' && /note/.test(last.note || ''),
    stored };
}, { id: LOCK_ID, date: PICK.date, cap: PICK.cap, note: NOTE });
if (R14.err) fail('14 ' + R14.err);
else {
  const edited = R14.ok && R14.reason === NOTE && R14.expiry === R14.exp && R14.qty === PICK.cap - 1
    && R14.ht === 'office' && !R14.hi;
  const held = R14.cellRef === LOCK_ID && R14.cellType === 'charter' && R14.capSame;
  const kept = R14.stored && R14.stored.reason === NOTE && R14.stored.expiry === R14.exp && R14.stored.qty === PICK.cap - 1;
  const guarded = R14.badExp === false && R14.badMin === false && R14.untouched;
  if (edited && held && kept && guarded && R14.logged)
    ok(`14 แก้ใบได้ ${R14.changed} ช่อง · ลงที่เก็บ · มีบันทึกการแก้ · ช่องเรือไม่ขยับ · ค่าผิดกติกาถูกปัดตก`);
  else
    fail(`14 แก้ใบผิด: แก้=${edited} ถือลำ=${held} ลงที่เก็บ=${kept} ด่าน=${guarded} log=${R14.logged} ${JSON.stringify(R14)}`);
}

/* ══ 15 · ย้ายลำผ่านการแก้ ═══════════════════════════════════════════════════
   ย้าย = ช่องเดิมกลับเป็นรอบปกติ ช่องใหม่ถูกจับ ในจังหวะเดียว
   ย้ายไปลำที่มีใบจองอยู่แล้วต้องไม่ผ่าน และใบต้องยังถือลำเดิมครบ ไม่ลอย */
const R15 = await page.evaluate(p => {
  const l = SB_SEAT_LOCKS.find(x => x.id === p.id);
  const was = l.boatId;
  const out = { own: {}, move: null, taken: null };
  /* ลำของตัวเอง · ไม่มีข้อยกเว้นจะถูกมองว่า "ถูกกันทั้งลำไว้แล้ว" */
  out.own.plain = bkV2BoatLockCanTake(l.date, was, l.routeId);
  out.own.except = bkV2BoatLockCanTake(l.date, was, l.routeId, l.id);
  const mine = bkV2BoatLockPickList(l.date, l.routeId, l.id).find(b => b.id === was);
  out.own.inList = !!(mine && mine.ok);
  /* ลำของตัวเองต้องอยู่ในรายการแม้ท่าของเส้นทางไม่ตรง · แก้หมายเหตุไม่ควรต้องผ่านด่านเลือกเรือใหม่ */
  const rt = ROUTES.find(r => r.id === l.routeId); const pierWas = rt.pier;
  rt.pier = 'zz-not-a-pier';
  const far = bkV2BoatLockPickList(l.date, l.routeId, l.id);
  out.own.keptOffPier = far.some(b => b.id === was && b.ok);
  out.own.othersOffPier = far.filter(b => b.id !== was).length;
  rt.pier = pierWas;
  /* ย้ายไปลำที่ว่าง */
  const free = bkV2BoatLockPickList(l.date, l.routeId, l.id).filter(b => b.ok && b.id !== was && b.cap >= l.qty);
  if (free.length) {
    const tgt = free[0];
    const r = bkV2BoatLockEdit(l.id, { boatId: tgt.id });
    const oOld = TRIPS[l.date][was], oNew = TRIPS[l.date][tgt.id];
    out.move = { ok: r.ok, boat: l.boatId === tgt.id,
      oldType: oOld ? oOld.type : 'gone', oldRef: (oOld && oOld.boatLockId) || '',
      newRef: (oNew && oNew.boatLockId) || '', newType: oNew && oNew.type };
    const back = bkV2BoatLockEdit(l.id, { boatId: was });
    out.move.back = back.ok && l.boatId === was && TRIPS[l.date][was].boatLockId === l.id
      && !(TRIPS[l.date][tgt.id] && TRIPS[l.date][tgt.id].boatLockId);
  }
  /* ย้ายไปลำที่มีใบจองเกาะอยู่ (ไม่ใช่ใบเหมาลำ · อันนั้นตัวจับช่องกันให้อยู่แล้ว) */
  outer:
  for (const ds of Object.keys(TRIPS || {}).sort()) {
    for (const bid of Object.keys(TRIPS[ds] || {})) {
      const B = bkV2BoatLockBlockers(ds, bid);
      if (B.charterOf || B.holdOf) continue;
      if (!(B.pax > 0 || B.cellBooked > 0)) continue;
      const exp0 = l.expiry;
      const r = bkV2BoatLockEdit(l.id, { date: ds, boatId: bid, expiry: ds < exp0 ? ds : exp0 });
      out.taken = { ds, bid, ok: r.ok, why: r.why || '',
        stayed: l.boatId === was && l.date === p.date,
        oldRef: (TRIPS[p.date][was] && TRIPS[p.date][was].boatLockId) || '',
        stolen: (TRIPS[ds][bid] && TRIPS[ds][bid].boatLockId) || '' };
      if (r.ok) { bkV2BoatLockEdit(l.id, { date: p.date, boatId: was, expiry: exp0 }); }
      break outer;
    }
  }
  return out;
}, { id: LOCK_ID, date: PICK.date });
{
  const own = R15.own.plain === false && R15.own.except === true && R15.own.inList
    && R15.own.keptOffPier && R15.own.othersOffPier === 0;
  if (!R15.move) fail('15 ไม่มีลำอื่นว่างให้ย้ายในชุดนี้ · ข้อนี้พิสูจน์อะไรไม่ได้');
  else if (!R15.taken) fail('15 ไม่เจอลำที่มีใบจองเกาะอยู่ในชุดนี้ · ข้อนี้พิสูจน์ครึ่งเดียว');
  else {
    const mv = R15.move.ok && R15.move.boat && R15.move.oldType === 'normal' && !R15.move.oldRef
      && R15.move.newRef === LOCK_ID && R15.move.newType === 'charter' && R15.move.back;
    const tk = R15.taken.ok === false && R15.taken.stayed && R15.taken.oldRef === LOCK_ID && !R15.taken.stolen;
    if (own && mv && tk) ok('15 ย้ายลำผ่านการแก้ · ลำเดิมกลับเป็นรอบปกติ ลำใหม่ถูกจับ · ลำที่มีใบจองย้ายไปไม่ได้ · ลำตัวเองเลือกกลับได้');
    else fail(`15 การย้ายลำผิด: ลำตัวเอง=${own} ย้าย=${mv} กันลำที่มีคนใช้=${tk} ${JSON.stringify(R15)}`);
  }
}

/* ══ 13 · ใบงาน By trip ต้องขึ้นแถวเรือที่กันไว้ ════════════════════════════════
   ผู้ใช้ถามเองว่า "ถ้าเป็นเรือ Charter lock ต้องขึ้นด้วยไหม ให้เหมือนกัน"
   ต้องขึ้น เพราะเรือหายจากทั้งจำนวนลำและความจุของวันนั้นแล้ว
   ถ้าใบงานไม่บอกว่าใครถืออยู่ คนอ่านเห็นแค่ "วันนี้เรือน้อยลงหนึ่งลำ" แล้วตามไม่ได้
   สามอย่างที่ต้องครบ · แถวของมัน · ป้ายบนแถบโปรแกรม · และจำนวนลำต้องลดลงจริง */
const R13 = await page.evaluate(p => {
  /* A/B ตรง ๆ · ถอดป้ายล็อกออกชั่วคราวแล้วนับใหม่ · วัดผลของป้ายอย่างเดียว
     (วัดเทียบกับตอนเริ่มเทสไม่ได้ ล็อกถูกสร้างไปตั้งแต่ข้อ 1 แล้ว) */
  const op = TRIPS[p.date][p.boatId];
  const nbLocked = baBoatsForRoute(p.date, p.routeId).length;
  const inLocked = baBoatsForRoute(p.date, p.routeId).some(x => x.boatId === p.boatId);
  const ref = op.boatLockId, ty = op.type;
  delete op.boatLockId; op.type = 'normal';
  const nb0 = baBoatsForRoute(p.date, p.routeId).length;
  const in0 = baBoatsForRoute(p.date, p.routeId).some(x => x.boatId === p.boatId);
  op.boatLockId = ref; op.type = ty;
  _bkV2.filterDate = p.date; _bkV2.filterRoute = null;
  _bkV2T2Q = ''; _bkV2T2Lk = '';
  if (typeof bkV2SwitchTab === 'function') bkV2SwitchTab('bytrip');
  return { nb0, nbLocked, in0, inLocked };
}, PICK);
await page.waitForTimeout(900);
const R13b = await page.evaluate(p => {
  const h = document.body.innerHTML;
  return { row: h.indexOf('data-bl="' + p.id + '"') >= 0,
           band: /กันไว้ \d+ ลำ/.test(h),
           inBand: h.indexOf('ล็อกเรือทั้งลำ · ยังไม่ยืนยัน') >= 0,
           nbNow: baBoatsForRoute(p.date, p.routeId).length };
}, { id: LOCK_ID, date: PICK.date, routeId: PICK.routeId });
if (R13b.row && R13b.band && R13b.inBand && R13.in0 && !R13.inLocked && R13.nbLocked === R13.nb0 - 1)
  ok(`13 ใบงาน By trip ขึ้นแถวเรือที่กันไว้ + ป้ายบนแถบโปรแกรม · จำนวนลำ ${R13.nb0} → ${R13.nbLocked}`);
else
  fail(`13 ใบงานไม่ขึ้นหรือจำนวนลำไม่ลด: ${JSON.stringify(R13b)} ${JSON.stringify(R13)}`);

/* ══ 17 · ใบงาน By trip · หมายเหตุต้องอ่านได้เต็ม และหัวหน้าต้องไม่ขัดกับตาราง ════
   ของเดิมหมายเหตุต่อท้ายข้อความในช่อง Pickup กว้าง 200px แล้วถูกตัดด้วยจุดไข่ปลา
   ชื่อลำกับแบบการตกลงกินที่ไปหมดก่อน หมายเหตุจึงไม่เคยได้ขึ้นจริง
   และการ์ดหัวหน้าสามใบพูดว่า "ไม่มีโปรแกรม / ไม่มีล็อก / ไม่เหลือ booking" ทั้งที่แถวอยู่ข้างล่าง */
const R17 = await page.evaluate(p => {
  const row = document.querySelector('tr[data-bl="' + p.id + '"]');
  const n = row && row.querySelector('.lknote');
  const h = row ? row.innerHTML : '';
  return { row: !!row,
    note: n ? (n.textContent || '') : '',
    clipped: n ? (n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1) : null,
    ws: n ? getComputedStyle(n).whiteSpace : '',
    edit: h.indexOf("bkV2BoatLockEditOpen('" + p.id + "')") >= 0,
    /* ปุ่มต้องอยู่ในช่องของตัวเองทั้งปุ่ม · ของเดิมสองปุ่มรวม 107px ในช่อง 48px ปุ่มหลังหายทั้งปุ่ม */
    btnCut: row ? [...row.querySelectorAll('button')].filter(b => {
      const td = b.closest('td').getBoundingClientRect(), r = b.getBoundingClientRect();
      return r.right > td.right + 1 || r.left < td.left - 1; }).map(b => b.textContent) : [],
    /* ทั้งแถว · ถูกตัดได้ แต่ต้องมีจุดไข่ปลาและมี title ให้ตามอ่าน (กติกาเดียวกับ §btClip) */
    silent: row ? [...row.querySelectorAll('td, td *')].filter(e => {
      if (!(e.textContent || '').trim() || e.scrollWidth <= e.clientWidth + 1) return false;
      let t = null, q = e; while (q && q.tagName !== 'TABLE') { if (q.getAttribute && q.getAttribute('title')) { t = 1; break; } q = q.parentElement; }
      return !(getComputedStyle(e).textOverflow === 'ellipsis' && t); }).map(e => (e.textContent || '').trim().slice(0, 24)) : [],
    progChip: !!document.querySelector('.bt-prog .bt-bhold'),
    lockCard: !!document.querySelector('.bt-lockc .bt-lkboat'),
    boatChip: !!document.querySelector('.bt-bholdc') };
}, { id: LOCK_ID });
if (!R17.row) fail('17 ไม่เจอแถวเรือที่กันไว้ในใบงาน · ข้อนี้พิสูจน์อะไรไม่ได้');
else if (R17.note.indexOf('NOTE-14') >= 0 && R17.note.indexOf('ขอเรือมีหลังคา') >= 0 && R17.clipped === false
         && R17.ws === 'normal' && R17.edit && R17.progChip && R17.lockCard && R17.boatChip
         && !R17.btnCut.length && !R17.silent.length)
  ok('17 ใบงาน By trip โชว์หมายเหตุเต็มไม่ถูกตัด · มีปุ่มแก้ไข · การ์ด Programmes / Seat Lock / Boats รู้จักเรือที่กันไว้');
else
  fail(`17 ใบงานไม่โชว์หมายเหตุหรือหัวหน้าไม่รู้จักเรือที่กันไว้: ${JSON.stringify(R17)}`);
await page.evaluate(() => { if (typeof bkV2SwitchTab === 'function') bkV2SwitchTab('locks'); });
await page.waitForTimeout(500);

/* ══ 16 · หน้า Seat Locks โชว์หมายเหตุ + ปุ่มแก้ไข · ฟอร์มแก้ต้องบันทึกได้ ═══════ */
const R16 = await page.evaluate(p => {
  const h = document.body.innerHTML;
  const notes = [...document.querySelectorAll('.bklk-note')].map(e => e.textContent || '');
  const out = { note: notes.some(t => t.indexOf('NOTE-14') >= 0 && t.indexOf('ขอเรือมีหลังคา') >= 0),
    edit: h.indexOf("bkV2BoatLockEditOpen('" + p.id + "')") >= 0 };
  bkV2BoatLockEditOpen(p.id);
  const m = (typeof bkV2BoatLockModal === 'function') ? bkV2BoatLockModal() : '';
  out.title = m.indexOf('แก้ไขใบล็อกเรือทั้งลำ') >= 0;
  out.own = m.indexOf('ลำที่กันไว้ตอนนี้') >= 0;
  out.noteInForm = m.indexOf('NOTE-14') >= 0;
  out.canSave = /<button\s+onclick="bkV2BoatLockSubmit\(\)"/.test(m);   /* ไม่มี disabled นำหน้า */
  out.hub = m.indexOf("bkV2BoatLockFormGo('charter')") >= 0 && m.indexOf("bkV2BoatLockFormGo('release')") >= 0;
  bkV2BoatLockClose();
  return out;
}, { id: LOCK_ID });
if (R16.note && R16.edit && R16.title && R16.own && R16.noteInForm && R16.canSave && R16.hub)
  ok('16 หน้า Seat Locks โชว์หมายเหตุ + ปุ่มแก้ไข · ฟอร์มแก้เปิดด้วยข้อมูลเดิมและกดบันทึกได้');
else
  fail(`16 หน้า Seat Locks ไม่โชว์หมายเหตุหรือแก้ไม่ได้: ${JSON.stringify(R16)}`);

/* ══ 6 · รีเฟรชแล้วต้องยังอยู่ · ผ่านทางบูตจริง ═══════════════════════════════ */
const BLOB = await page.evaluate(() => localStorage.getItem('loveandaman_v2'));
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => typeof window.nav === 'function', null, { timeout: 20000 });
await page.waitForTimeout(900);
await goView(page, 'booking', 800);
const R6 = await page.evaluate(p => {
  const l = (typeof SB_SEAT_LOCKS !== 'undefined') ? SB_SEAT_LOCKS.find(x => x.id === p.id) : null;
  const op = TRIPS[p.date] && TRIPS[p.date][p.boatId];
  return { found: !!l, scope: l && l.scope, boat: l && l.boatId, qty: l && l.qty,
    cell: op ? { type: op.type, ref: op.boatLockId || '' } : null };
}, { id: LOCK_ID, date: PICK.date, boatId: PICK.boatId });
if (R6.found && R6.scope === 'boat' && R6.boat === PICK.boatId && R6.cell
    && R6.cell.type === 'charter' && R6.cell.ref === LOCK_ID)
  ok('6 รีเฟรชแล้วล็อกกับช่องบนกระดานเรือยังอยู่ครบ');
else
  fail(`6 รีเฟรชแล้วหาย: ${JSON.stringify(R6)}`);

/* ══ 5 · ปล่อยลำ · เรือกลับเข้าพูล แต่ห้ามลบเซลล์ ═══════════════════════════ */
const R5 = await page.evaluate(p => {
  const A0 = getAllotment(p.routeId, p.date);
  const okRel = bkV2BoatLockRelease(p.id, 'test');
  const op = TRIPS[p.date] && TRIPS[p.date][p.boatId];
  const A1 = getAllotment(p.routeId, p.date);
  const l = SB_SEAT_LOCKS.find(x => x.id === p.id);
  return { okRel, gone: !op, type: op && op.type, ref: (op && op.boatLockId) || '',
    back: A1.availableCapacity - A0.availableCapacity, st: l && l.status };
}, { id: LOCK_ID, date: PICK.date, boatId: PICK.boatId, routeId: PICK.routeId, cap: PICK.cap });
if (R5.okRel && !R5.gone && R5.type === 'normal' && !R5.ref && R5.back === PICK.cap && R5.st === 'released')
  ok(`5 ปล่อยลำแล้วความจุกลับมา +${R5.back} · เซลล์ยังอยู่ (type=normal) ไม่ถูกลบทิ้ง`);
else
  fail(`5 การปล่อยลำผิด: ${JSON.stringify(R5)}`);

/* ══ คืนสถานะ ═══════════════════════════════════════════════════════════════ */
await page.evaluate(p => {
  if (typeof SB_SEAT_LOCKS !== 'undefined')
    SB_SEAT_LOCKS = SB_SEAT_LOCKS.filter(l => !(l.reason || '').startsWith('test · '));
  if (TRIPS[p.date] && TRIPS[p.date][p.boatId]) TRIPS[p.date][p.boatId] = p.cell;
  try { if (typeof sbSeatLocksPersist === 'function') sbSeatLocksPersist(); } catch (e) {}
  try { if (typeof save === 'function') save('operations'); } catch (e) {}
}, { date: PICK.date, boatId: PICK.boatId, cell: R0.cellBefore });

/* ══ 9 · ไม่มี error บนหน้า ═════════════════════════════════════════════════
   ไม่นับ 404 ของไฟล์ประกอบ · ฮาร์เนสเสิร์ฟ static ไม่มี /api/* อยู่แล้วโดยตั้งใจ */
const realErr = errors.filter(e => !/Failed to load resource/.test(e));
if (!realErr.length) ok('9 ไม่มี error บนหน้า');
else fail('9 มี error: ' + realErr.slice(0, 3).join(' | '));

await close();
console.log(bad ? `\n§bkLock · ไม่ผ่าน ${bad} ข้อ` : '\n§bkLock · ผ่านทั้งหมด');
process.exit(bad ? 1 : 0);
