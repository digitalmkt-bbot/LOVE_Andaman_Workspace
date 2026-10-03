// §lkNoAuto · ที่นั่งที่ล็อกไว้ ไม่ปล่อยเองเมื่อเลยกำหนด
//
// ที่มา (2026-09-29) · ผู้ใช้แจ้ง "ล็อคแล้วไม่ขึ้นหน้า manifest · ขึ้นแบบนึงแล้วหายไป เช่น Panorama"
// ทำซ้ำได้ · ล็อกสองใบของเจ้าเดียวกัน ทริปเดียวกัน ต่างกันแค่กติกาปล่อยคืน
//   ใบที่เลยเวลาปล่อยหายจาก manifest ทั้งแถบทั้งแถว ไม่เหลือร่องรอย
//   แต่หน้า Seat Locks ยังขึ้นป้าย ACTIVE · สองหน้าพูดคนละเรื่อง
//
// การคิดเวลาปล่อยรายรอบไม่ได้ผิด · วัดกับล็อก bulk ข้ามสามเดือนแล้ว ปล่อยทีละวันจริง
//   ที่ผิดคือ "ปล่อยเอง" · ผู้ใช้สั่งว่าไม่ควรปล่อยเองเลย
//
// กติกาใหม่
//   เลยกำหนด = ป้ายเตือน · ที่นั่งยังกันอยู่เหมือนเดิม ล็อกยังอยู่ใน manifest
//   จะคืนเข้า pool ต่อเมื่อมีคนกดปล่อย · ปล่อยเป็นรายรอบ รอบอื่นไม่กระทบ และมี log ว่าใครกด
//
// ⚠ ชุดข้อมูลทดสอบไม่มีล็อกสักใบ · เทสจึงสร้างล็อกเองผ่าน bkV2CreateLock
//    ซึ่งเป็นทางเดียวกับที่หน้าจอใช้สร้าง แล้วล้างทิ้งหลังวัดเสร็จ
//
// เทสนี้กันสิบเอ็ดอย่าง
//   1  เลยกำหนดแล้ว ล็อกยังอยู่ใน manifest และที่นั่งยังถูกกัน (อาการที่ผู้ใช้แจ้ง)
//   2  แถวล็อกที่เลยกำหนดต้องติดป้ายเตือน ไม่ใช่ขึ้นเหมือนปกติจนไม่มีใครรู้ว่าค้าง
//   3  ล็อกที่ยังไม่ถึงกำหนด ต้องไม่ติดป้ายเตือน
//   4  กดปล่อยรอบเดียว · ที่นั่งของรอบนั้นกลับเข้า pool จริง
//   5  ปล่อยรอบเดียวแล้วรอบอื่นของล็อก bulk ต้องไม่กระทบ และ qty ของทั้งใบต้องไม่ลด
//   6  ปล่อยแล้วล็อกหายจาก manifest เฉพาะรอบนั้น
//   7  การปล่อยถูกบันทึกไว้ว่าใครกด รอบไหน กี่ที่
//   8  ปุ่มปล่อยรวมของวัน · ปล่อยเฉพาะที่เลยกำหนด ไม่แตะตัวที่ยังไม่ถึงกำหนด
//   9  วันในสัปดาห์ที่ไม่ได้ติ๊กไว้ในล็อก bulk ยังต้องไม่ขึ้น (ไม่ได้เผลอทำให้โผล่)
//   10 ยอดที่นั่งที่ขายได้ของวัน หักล็อกที่ยังกันอยู่ · ไม่หักรอบที่ปล่อยไปแล้ว
//   11 ไม่มี error บนหน้า

import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1800, height: 1200 });
page.on('dialog', d => d.accept());   // ปุ่มปล่อยถามยืนยันก่อน
await page.waitForTimeout(1400);

/* ══ 0 · เตรียมเวที · สร้างล็อกสามแบบบนเส้นทางเดียวกัน ═══════════════════
   OD   · รายวัน · เลยกำหนดปล่อยไปแล้ว   ← ตัวที่เคยหายไปทั้งใบ
   SOON · รายวัน · ยังไม่ถึงกำหนด
   BULK · ข้ามหลายเดือน · ติ๊กเฉพาะบางวันในสัปดาห์ · เลยกำหนดเฉพาะรอบต้น ๆ */
const R0 = await page.evaluate(() => {
  const el = document.querySelector('.nav-item[data-view="booking"]');
  if (!el) return { err: 'ไม่มีเมนู Booking' };
  nav(el);
  if (typeof bkV2CreateLock !== 'function' || typeof bkV2LocksFor !== 'function')
    return { err: 'ไม่มีฟังก์ชันของล็อกที่นั่ง' };
  const today = bkV2LocalYMD(new Date());
  const D = n => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  /* เส้นทางที่มีทริปออกจริง · ใช้เส้นเดียวกันทุกใบ จะได้เทียบยอดของวันได้ */
  let rid = '';
  Object.keys(TRIPS || {}).sort().forEach(ds => {
    if (rid) return;
    Object.keys(TRIPS[ds] || {}).forEach(bid => { if (!rid && TRIPS[ds][bid] && TRIPS[ds][bid].route) rid = TRIPS[ds][bid].route; });
  });
  if (!rid) return { err: 'ไม่มีทริปในข้อมูลชุดนี้' };
  const ag = (SB_AGENTS || []).filter(a => /Panorama/i.test(a.name || ''))[0] || (SB_AGENTS || [])[0];
  if (!ag) return { err: 'ไม่มีเอเยนต์ในข้อมูลชุดนี้' };

  const dOD = D(6), dSOON = D(6);        /* วันเดียวกัน · ต่างกันแค่กติกาปล่อย */
  const OD   = bkV2CreateLock({ scope:'day', routeId:rid, date:dOD, holderType:'agent', holderId:ag.id,
                                qty:9, releaseDaysBefore:20, releaseTime:'08:00', reason:'T-OD' });
  const SOON = bkV2CreateLock({ scope:'day', routeId:rid, date:dSOON, holderType:'agent', holderId:ag.id,
                                qty:4, releaseDaysBefore:1, releaseTime:'08:00', reason:'T-SOON' });
  /* bulk · ติ๊กเฉพาะวันในสัปดาห์ของ dOD · ปล่อย 20 วันก่อน = รอบต้น ๆ เลยกำหนดหมด */
  const dow = new Date(dOD + 'T00:00:00').getDay();
  const BULK = bkV2CreateLock({ scope:'bulk', routeId:rid, dateFrom:today, dateTo:D(120),
                                dow:[dow], holderType:'agent', holderId:ag.id,
                                qty:6, releaseDaysBefore:20, releaseTime:'08:00', reason:'T-BULK' });
  /* รอบถัดไปของ bulk (สัปดาห์หน้า วันเดียวกัน) · ใช้ตรวจว่าปล่อยรอบเดียวไม่กระทบรอบอื่น */
  const dNEXT = D(13);
  /* วันในสัปดาห์ที่ไม่ได้ติ๊ก · ใช้ตรวจข้อ 9 */
  const dOFF = D(7);
  return { rid, ag:ag.name, agId:ag.id, today, dOD, dSOON, dNEXT, dOFF, dow,
           od:OD.id, soon:SOON.id, bulk:BULK.id,
           odCut:bkV2LockCutoffPassed(OD,dOD), soonCut:bkV2LockCutoffPassed(SOON,dSOON),
           bulkCut:bkV2LockCutoffPassed(BULK,dOD), bulkNextCut:bkV2LockCutoffPassed(BULK,dNEXT) };
});
if (R0.err) fail(R0.err);
else if (!R0.odCut || !R0.bulkCut)
  fail('สร้างเวทีไม่สำเร็จ · ล็อกที่ตั้งใจให้เลยกำหนดยังไม่เลย (od ' + R0.odCut + ' bulk ' + R0.bulkCut + ')');
else if (R0.soonCut)
  fail('สร้างเวทีไม่สำเร็จ · ล็อกที่ตั้งใจให้ยังไม่ถึงกำหนด กลับเลยไปแล้ว');
else ok('ใช้เส้นทาง ' + R0.rid + ' · ผู้ถือ ' + R0.ag + ' · วันทดสอบ ' + R0.dOD +
        ' · ล็อกเลยกำหนด 2 ใบ (รายวัน 9 ที่ + bulk 6 ที่) · ยังไม่ถึงกำหนด 1 ใบ (4 ที่)');

if (!R0.err) {
  const drawTrip = (ds) => page.evaluate((d) => {
    _bkV2.tab = 'bytrip'; _bkV2.filterDate = d; _bkV2.detailId = null; _bkV2.newBooking = null;
    bkV2Render();
  }, ds);
  /* อ่านแถวล็อกจาก manifest ที่วาดออกมาจริง · ไม่ถามฟังก์ชันที่กำลังทดสอบ */
  const readRows = () => page.evaluate(() => {
    const h = document.getElementById('bkv2-host'); if (!h) return [];
    return [].slice.call(h.querySelectorAll('tr.t2-lrow')).map(tr => ({
      who: ((tr.querySelector('.lkwho') || {}).textContent || '').trim(),
      q: +(((tr.querySelector('.lkq') || {}).textContent || '0').replace(/[^0-9]/g, '') || 0),
      story: ((tr.querySelector('.lkclip') || {}).textContent || '').trim(),
      over: !!tr.querySelector('.lkrule.lkover'),
      relBtn: !!tr.querySelector('.lkgo.lkrel')
    }));
  });

  await drawTrip(R0.dOD);
  await page.waitForTimeout(500);
  const M1 = await readRows();

  /* ══ 1 · เลยกำหนดแล้วต้องยังอยู่ ═══════════════════════════════════ */
  const seat = await page.evaluate(([rid, ds]) => ({
    locked: bkV2LockedTotal(rid, ds),
    inManifest: bkV2LocksFor(rid, ds).map(l => l.reason)
  }), [R0.rid, R0.dOD]);
  const rowOD = M1.filter(r => /T-OD/.test(r.story))[0];
  const rowBULK = M1.filter(r => /T-BULK/.test(r.story))[0];
  const rowSOON = M1.filter(r => /T-SOON/.test(r.story))[0];
  if (!rowOD)
    fail('ล็อกที่เลยกำหนดไม่ขึ้นใน manifest · นี่คืออาการที่ผู้ใช้แจ้ง (ล็อคแล้วไม่ขึ้นหน้า manifest)');
  else if (rowOD.q !== 9)
    fail('ล็อกที่เลยกำหนดขึ้น ' + rowOD.q + ' ที่ · ควรยังกันไว้ครบ 9 ที่');
  else if (seat.locked !== 19)
    fail('ที่นั่งที่ถูกกันของวันนี้ ' + seat.locked + ' · ควรเป็น 19 (9 + 6 + 4) · ' +
         'ล็อกที่เลยกำหนดต้องยังกันที่นั่งอยู่ ไม่ปล่อยเอง');
  else ok('เลยกำหนดแล้วล็อกยังอยู่ใน manifest ครบ · กันที่นั่งรวม ' + seat.locked +
          ' ที่ (' + seat.inManifest.join(' + ') + ') ไม่มีอะไรปล่อยเอง');

  /* ══ 2 · ป้ายเตือนบนแถวที่เลยกำหนด ════════════════════════════════ */
  if (!rowOD || !rowBULK) { /* ข้อ 1 fail ไปแล้ว */ }
  else if (!rowOD.over || !rowBULK.over)
    fail('ล็อกเลยกำหนดแล้วไม่มีป้ายเตือนบนแถว (รายวัน ' + rowOD.over + ' · bulk ' + rowBULK.over +
         ') · ที่นั่งจะค้างไปเรื่อย ๆ โดยไม่มีใครรู้');
  else if (!rowOD.relBtn)
    fail('มีป้ายเตือนแล้วแต่ไม่มีปุ่มปล่อยบนแถว · เห็นแล้วก็ยังต้องไปหาที่อื่นเพื่อกด');
  else ok('แถวที่เลยกำหนดติดป้ายเตือนทั้งสองใบ และมีปุ่มปล่อยอยู่บนแถวเลย');

  /* ══ 3 · ตัวที่ยังไม่ถึงกำหนดต้องไม่ติดป้าย ═══════════════════════ */
  if (!rowSOON) fail('ล็อกที่ยังไม่ถึงกำหนดไม่ขึ้นใน manifest');
  else if (rowSOON.over)
    fail('ล็อกที่ยังไม่ถึงกำหนดติดป้ายเตือนด้วย · ป้ายที่ขึ้นมั่วจะถูกมองข้ามทั้งหมด');
  else ok('ล็อกที่ยังไม่ถึงกำหนด (' + rowSOON.q + ' ที่) ไม่ติดป้ายเตือน');

  /* ══ 4 · กดปล่อยรอบเดียว ═════════════════════════════════════════ */
  const R4 = await page.evaluate(([rid, ds, lockId]) => {
    const before = bkV2LockedTotal(rid, ds);
    const n = bkV2LockReleaseRound(lockId, ds);
    return { before, freed:n, after: bkV2LockedTotal(rid, ds) };
  }, [R0.rid, R0.dOD, R0.od]);
  if (R4.freed !== 9) fail('กดปล่อยแล้วคืนมา ' + R4.freed + ' ที่ · ควรเป็น 9');
  else if (R4.after !== R4.before - 9)
    fail('ปล่อย 9 ที่แล้วที่นั่งที่ถูกกัน ' + R4.before + ' → ' + R4.after + ' · ควรเป็น ' + (R4.before - 9));
  else ok('กดปล่อยรอบเดียว · คืน 9 ที่เข้า pool จริง · ที่นั่งที่ถูกกัน ' + R4.before + ' → ' + R4.after);

  /* ══ 5 · ปล่อย bulk รอบเดียว รอบอื่นไม่กระทบ ══════════════════════
     นี่คือหัวใจของที่ผู้ใช้อธิบาย · "ต้องปล่อยออกทีละวัน ไม่ใช่ปล่อยทั้งหมด" */
  const R5 = await page.evaluate(([rid, dThis, dNext, lockId]) => {
    const l = SB_SEAT_LOCKS.find(x => x.id === lockId);
    const qty0 = l.qty;
    const before = { here: bkV2LockPoolHold(l, dThis), next: bkV2LockPoolHold(l, dNext),
                     nextIn: bkV2LocksFor(rid, dNext).some(x => x.id === lockId) };
    bkV2LockReleaseRound(lockId, dThis);
    const l2 = SB_SEAT_LOCKS.find(x => x.id === lockId);
    return { qty0, qty1:l2.qty,
             here: bkV2LocksFor(rid, dThis).some(x => x.id === lockId),
             next: bkV2LockPoolHold(l2, dNext),
             nextIn: bkV2LocksFor(rid, dNext).some(x => x.id === lockId),
             before };
  }, [R0.rid, R0.dOD, R0.dNEXT, R0.bulk]);
  if (!R5.before.nextIn)
    fail('รอบถัดไป (' + R0.dNEXT + ') ไม่มีล็อก bulk ตั้งแต่ก่อนปล่อย · ตรวจข้อนี้ไม่ได้');
  else if (R5.qty1 !== R5.qty0)
    fail('ปล่อยรอบเดียวแล้ว qty ของทั้งใบลดจาก ' + R5.qty0 + ' เป็น ' + R5.qty1 +
         ' · ล็อกแบบช่วงต้องปล่อยทีละรอบ ไม่ใช่ไปลดโควตาของทั้งใบ');
  else if (R5.here)
    fail('ปล่อยรอบ ' + R0.dOD + ' แล้วล็อกยังอยู่ในรอบนั้น');
  else if (!R5.nextIn || R5.next !== R5.before.next)
    fail('ปล่อยรอบ ' + R0.dOD + ' แล้วรอบ ' + R0.dNEXT + ' กระทบด้วย · เหลือ ' + R5.next +
         ' (ก่อนปล่อย ' + R5.before.next + ') · อยู่ในรอบถัดไป ' + R5.nextIn);
  else ok('ปล่อย bulk รอบ ' + R0.dOD + ' แล้วรอบ ' + R0.dNEXT + ' ยังเต็ม ' + R5.next +
          ' ที่ และ qty ของทั้งใบยังเป็น ' + R5.qty1 + ' ไม่ถูกแตะ');

  /* ══ 6 · ปล่อยแล้วหายจาก manifest เฉพาะรอบนั้น ═══════════════════ */
  await drawTrip(R0.dOD);
  await page.waitForTimeout(400);
  const M2 = await readRows();
  await drawTrip(R0.dNEXT);
  await page.waitForTimeout(400);
  const M3 = await readRows();
  {
    const goneHere = !M2.some(r => /T-OD|T-BULK/.test(r.story));
    const stillNext = M3.some(r => /T-BULK/.test(r.story));
    const soonHere = M2.some(r => /T-SOON/.test(r.story));
    if (!goneHere) fail('ปล่อยไปแล้วแต่ยังขึ้นใน manifest ของรอบนั้น');
    else if (!soonHere) fail('ปล่อยสองใบแล้วใบที่ยังไม่ถึงกำหนดหายไปด้วย');
    else if (!stillNext) fail('ปล่อยรอบ ' + R0.dOD + ' แล้วรอบ ' + R0.dNEXT + ' หายไปจาก manifest ด้วย');
    else ok('ปล่อยแล้วหายเฉพาะรอบนั้น · รอบ ' + R0.dNEXT + ' ยังอยู่ และใบที่ยังไม่ถึงกำหนดก็ยังอยู่');
  }

  /* ══ 7 · บันทึกว่าใครกด รอบไหน กี่ที่ ═══════════════════════════ */
  const R7 = await page.evaluate((lockId) => {
    const l = SB_SEAT_LOCKS.find(x => x.id === lockId);
    return (l.log || []).filter(e => e.type === 'release-round');
  }, R0.od);
  if (!R7.length) fail('ปล่อยที่นั่งแล้วไม่มีบันทึกไว้เลย · ที่นั่งหายไปโดยไม่รู้ว่าใครปล่อย');
  else if (R7[0].tripDate !== R0.dOD || R7[0].qty !== 9)
    fail('บันทึกไม่ตรง · ได้ ' + JSON.stringify(R7[0]));
  else ok('การปล่อยถูกบันทึกไว้ · รอบ ' + R7[0].tripDate + ' · ' + R7[0].qty + ' ที่ · โดย "' +
          (R7[0].by || '—') + '"');

  /* ══ 8 · ปุ่มปล่อยรวมของวัน ═══════════════════════════════════════ */
  const R8 = await page.evaluate(([rid, dSoon]) => {
    /* ล้างของเดิม แล้วตั้งใหม่ · เลยกำหนด 2 ใบ + ยังไม่ถึงกำหนด 1 ใบ ในวันเดียวกัน */
    for (let i = SB_SEAT_LOCKS.length - 1; i >= 0; i--)
      if (/^T-/.test(SB_SEAT_LOCKS[i].reason || '')) SB_SEAT_LOCKS.splice(i, 1);
    const ag = (SB_AGENTS || [])[0];
    bkV2CreateLock({ scope:'day', routeId:rid, date:dSoon, holderType:'agent', holderId:ag.id,
                     qty:5, releaseDaysBefore:30, releaseTime:'08:00', reason:'T-A' });
    bkV2CreateLock({ scope:'day', routeId:rid, date:dSoon, holderType:'office', holderId:null,
                     qty:3, releaseDaysBefore:30, releaseTime:'08:00', reason:'T-B' });
    bkV2CreateLock({ scope:'day', routeId:rid, date:dSoon, holderType:'agent', holderId:ag.id,
                     qty:7, releaseDaysBefore:0, releaseTime:'23:59', reason:'T-KEEP' });
    const before = bkV2LockedTotal(rid, dSoon);
    const od = bkV2LockOverdueOn(dSoon);
    bkV2LockReleaseOverdueGo(dSoon);
    const left = bkV2LocksFor(rid, dSoon).map(l => l.reason).sort();
    return { before, nOd:od.length, after: bkV2LockedTotal(rid, dSoon), left };
  }, [R0.rid, R0.dSOON]);
  if (R8.nOd !== 2) fail('เตรียมไว้ให้เลยกำหนด 2 ใบ แต่ระบบนับได้ ' + R8.nOd);
  else if (R8.after !== 7)
    fail('กดปล่อยรวมแล้วเหลือกันไว้ ' + R8.after + ' ที่ · ควรเหลือ 7 (เฉพาะใบที่ยังไม่ถึงกำหนด) · ' +
         'ก่อนกดมี ' + R8.before);
  else if (JSON.stringify(R8.left) !== JSON.stringify(['T-KEEP']))
    fail('กดปล่อยรวมแล้วเหลือล็อก ' + R8.left.join(', ') + ' · ควรเหลือแค่ T-KEEP');
  else ok('ปุ่มปล่อยรวมของวัน · ปล่อย 2 ใบที่เลยกำหนด (' + R8.before + ' → ' + R8.after +
          ' ที่) ใบที่ยังไม่ถึงกำหนดไม่ถูกแตะ');

  /* ══ 9 · วันในสัปดาห์ที่ไม่ได้ติ๊ก ต้องไม่ขึ้นเหมือนเดิม ═════════ */
  const R9 = await page.evaluate(([rid, dow, dOff, dOn]) => {
    for (let i = SB_SEAT_LOCKS.length - 1; i >= 0; i--)
      if (/^T-/.test(SB_SEAT_LOCKS[i].reason || '')) SB_SEAT_LOCKS.splice(i, 1);
    const ag = (SB_AGENTS || [])[0];
    const today = bkV2LocalYMD(new Date());
    const L = bkV2CreateLock({ scope:'bulk', routeId:rid, dateFrom:today, dateTo:dOn,
                               dow:[dow], holderType:'agent', holderId:ag.id, qty:6, reason:'T-DOW' });
    return { onDay: bkV2LocksFor(rid, dOn).some(x => x.id === L.id),
             offDay: bkV2LocksFor(rid, dOff).some(x => x.id === L.id),
             offLocked: bkV2LockedTotal(rid, dOff) };
  }, [R0.rid, R0.dow, R0.dOFF, R0.dNEXT]);
  if (!R9.onDay) fail('ล็อก bulk ไม่ขึ้นแม้ในวันที่ติ๊กไว้ · ตรวจข้อนี้ไม่ได้');
  else if (R9.offDay || R9.offLocked)
    fail('วัน ' + R0.dOFF + ' ไม่ได้ติ๊กไว้ในล็อก แต่ล็อกยังขึ้น/ยังกันที่นั่ง ' + R9.offLocked + ' ที่');
  else ok('วันในสัปดาห์ที่ไม่ได้ติ๊กไว้ยังไม่ขึ้นเหมือนเดิม (' + R0.dOFF + ' กันไว้ 0 ที่)');

  /* ══ 10 · ยอดขายได้ของวันหักล็อกที่ยังกันอยู่ ════════════════════ */
  const R10 = await page.evaluate(([rid, ds]) => {
    for (let i = SB_SEAT_LOCKS.length - 1; i >= 0; i--)
      if (/^T-/.test(SB_SEAT_LOCKS[i].reason || '')) SB_SEAT_LOCKS.splice(i, 1);
    const ag = (SB_AGENTS || [])[0];
    const a0 = (typeof getAllotment === 'function') ? getAllotment(rid, ds) : null;
    if (!a0) return { err: 'ไม่มี getAllotment' };
    const L = bkV2CreateLock({ scope:'day', routeId:rid, date:ds, holderType:'agent', holderId:ag.id,
                               qty:5, releaseDaysBefore:30, releaseTime:'08:00', reason:'T-AL' });
    const a1 = getAllotment(rid, ds);
    /* ป้ายล็อกบนปฏิทินกับยอดในหน้า Seat Locks เดินคนละทางกับ getAllotment
       (bkV2DayLockedTotal / bkV2DayLockedExact ไม่ได้ผ่าน bkV2LocksFor)
       ตรงนี้คือจุดที่เคยตอบไม่ตรงกับ manifest จึงต้องวัดด้วย */
    const d1 = bkV2DayLockedTotal(ds), e1 = bkV2DayLockedExact(ds);
    bkV2LockReleaseRound(L.id, ds);
    const a2 = getAllotment(rid, ds);
    const d2 = bkV2DayLockedTotal(ds), e2 = bkV2DayLockedExact(ds);
    return { l0:a0.lockedSeats||0, l1:a1.lockedSeats||0, l2:a2.lockedSeats||0,
             d1, d2, e1, e2, cut:bkV2LockCutoffPassed(L, ds) };
  }, [R0.rid, R0.dSOON]);
  if (R10.err) fail(R10.err);
  else if (!R10.cut) fail('ล็อกที่ตั้งให้เลยกำหนดยังไม่เลย · ตรวจข้อนี้ไม่ได้');
  else if (R10.l1 !== R10.l0 + 5)
    fail('ล็อกที่เลยกำหนดไม่ถูกหักจากที่นั่งที่ขายได้ · ' + R10.l0 + ' → ' + R10.l1 +
         ' · ควรเป็น ' + (R10.l0 + 5));
  else if (R10.l2 !== R10.l0)
    fail('ปล่อยแล้วที่นั่งไม่กลับเข้า pool · ยังหักอยู่ ' + R10.l2 + ' · ควรกลับไปที่ ' + R10.l0);
  else if (R10.d1 < 5 || R10.e1 < 5)
    fail('ป้ายล็อกบนปฏิทิน/ยอดหน้า Seat Locks ไม่นับล็อกที่เลยกำหนดแต่ยังกันอยู่ (' +
         R10.d1 + ' / ' + R10.e1 + ' · ควรอย่างน้อย 5) · หน้าพวกนี้จะบอกคนละเรื่องกับ manifest อีก');
  else if (R10.d2 !== R10.d1 - 5 || R10.e2 !== R10.e1 - 5)
    fail('ปล่อยแล้วป้ายล็อกบนปฏิทิน/ยอดหน้า Seat Locks ไม่ลดตาม · ' + R10.d1 + '→' + R10.d2 +
         ' / ' + R10.e1 + '→' + R10.e2);
  else ok('ยอดของวันหักล็อกที่เลยกำหนดแต่ยังกันอยู่ (' + R10.l0 + ' → ' + R10.l1 +
          ') และคืนกลับเมื่อกดปล่อย (' + R10.l2 + ') · ป้ายบนปฏิทินกับหน้า Seat Locks ' +
          'ตอบตรงกัน (' + R10.d1 + '→' + R10.d2 + ')');

  /* เก็บกวาดล็อกทดสอบ */
  await page.evaluate(() => {
    for (let i = SB_SEAT_LOCKS.length - 1; i >= 0; i--)
      if (/^T-/.test(SB_SEAT_LOCKS[i].reason || '')) SB_SEAT_LOCKS.splice(i, 1);
    bkV2Render();
  });
  await page.waitForTimeout(250);
}

/* ══ 11 · ไม่มี error บนหน้า ══════════════════════════════════════════ */
if (errors.length) fail('มี error ' + errors.length + ' ครั้ง · ' + errors.slice(0, 2).join(' | '));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
