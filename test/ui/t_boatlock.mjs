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
      const B = bkV2BoatLockBlockers(ds, bid);
      if (B.pax > 0 || B.rows.length) continue;
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
