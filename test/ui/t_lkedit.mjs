// §lkEdit · แก้รายละเอียดล็อกที่นั่งได้ · และ §lkZero · เตือนล็อกที่ไม่ครอบรอบไหนเลย
//
// ที่มา (2026-09-29) · ผู้ใช้ขอเอง "ขอเพิ่มการแก้ไขรายละเอียดที่ล็อคได้
//   และขอตรวจสอบ ทำไม Panorama ถึงยังไม่ขึ้นในหน้า Manifest"
//
// เคส Panorama · ทำซ้ำได้
//   ล็อก bulk ตั้งวันเริ่ม 2026-10-31 (วันเสาร์) ไม่ได้ใส่วันจบ · ติ๊กอังคาร+พฤหัส
//   bkV2LockRange เติมให้เป็น to = dateTo || dateFrom · ช่วงยุบเหลือวันเดียว
//   วันเดียวนั้นเป็นเสาร์ ซึ่งไม่ใช่วันที่ติ๊กไว้ → ไม่ตรงสักวัน
//   ผล · รอบ = 0 · ไม่ขึ้น manifest วันไหนเลย · หน้าจอเดิมบอกแค่ "ผ่านมา 0/0 รอบ"
//        ซึ่งอ่านเหมือน "ยังไม่ถึงรอบแรก" ไม่ใช่ "ตั้งค่าผิดจนไม่ครอบอะไรเลย"
//   และของเดิมไม่มีปุ่มแก้ · ทางเดียวคือลบทิ้งสร้างใหม่ ซึ่งทิ้งประวัติทั้งใบ
//
// เทสนี้กันสิบสองอย่าง
//   1  มีปุ่มแก้ไขบนแถวล็อก และกดแล้วฟอร์มโหลดค่าเดิมครบ
//   2  ล็อกที่ไม่ครอบรอบไหนเลยต้องขึ้นป้ายเตือนในรายการ พร้อมบอกว่าเพราะไม่ได้ใส่วันจบ
//   3  ล็อกปกติต้องไม่ขึ้นป้ายนั้น
//   4  ใส่วันจบแล้วรอบกลับมา และขึ้น manifest เฉพาะวันในสัปดาห์ที่ติ๊กไว้
//   5  บันทึกว่าใครแก้ อะไรเป็นอะไร
//   6  วันจบว่างบันทึกไม่ได้ (กับดักที่ทำให้เคสนี้เกิดตั้งแต่แรก)
//   7  ล็อกที่ขายไปแล้ว · ย้ายเส้นทาง/วัน/ผู้ถือ ไม่ได้
//   8  ล็อกที่ขายไปแล้ว · ยังแก้จำนวนที่นั่ง กติกาปล่อยคืน และโน้ตได้
//   9  ลดที่นั่งต่ำกว่าที่ขายไปแล้วไม่ได้
//   10 ลดที่นั่งต่ำกว่าที่แบ่งเป็นกรุ๊ปย่อยไว้ไม่ได้
//   11 แก้ช่วงวันของล็อกแม่แล้วกรุ๊ปย่อยเดินตาม · และไม่กระทบล็อกใบอื่น
//   12 ไม่มี error บนหน้า
//
// ⚠ ชุดข้อมูลทดสอบไม่มีล็อกสักใบ · เทสสร้างเองผ่าน bkV2CreateLock แล้วล้างทิ้ง

import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1150 });
const dialogs = [];
page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
await page.waitForTimeout(1400);

/* ══ 0 · สร้างเคส Panorama ขึ้นมาใหม่ตามของจริง ══════════════════════ */
const R0 = await page.evaluate(() => {
  const el = document.querySelector('.nav-item[data-view="booking"]');
  if (!el) return { err: 'ไม่มีเมนู Booking' };
  nav(el);
  if (typeof bkV2LockEditOpen !== 'function') return { err: 'ยังไม่มีฟังก์ชันแก้ไขล็อก' };
  let rid = '';
  Object.keys(TRIPS || {}).sort().forEach(ds => {
    if (rid) return;
    Object.keys(TRIPS[ds] || {}).forEach(b => { if (!rid && TRIPS[ds][b] && TRIPS[ds][b].route) rid = TRIPS[ds][b].route; });
  });
  if (!rid) return { err: 'ไม่มีทริปในข้อมูลชุดนี้' };
  const ag = (SB_AGENTS || []).filter(a => /Panorama/i.test(a.name || ''))[0] || (SB_AGENTS || [])[0];
  /* เหมือนของจริง · เริ่มวันเสาร์ ไม่ใส่วันจบ ติ๊กอังคาร(2)+พฤหัส(4) */
  const BAD = bkV2CreateLock({ scope:'bulk', routeId:rid, dateFrom:'2026-10-31', dateTo:'',
    dow:[2,4], holderType:'agent', holderId:ag.id, qty:30,
    releaseDaysBefore:1, releaseTime:'16:00', reason:'T-PAN · TBA วันจบ' });
  /* ล็อกปกติ · ช่วงกว้าง ไม่ติ๊กวัน · ใช้เทียบว่าไม่ขึ้นป้ายเตือน */
  const OKL = bkV2CreateLock({ scope:'bulk', routeId:rid, dateFrom:'2026-11-01', dateTo:'2026-12-31',
    dow:[], holderType:'office', holderId:null, qty:5, reason:'T-OK' });
  _bkV2.tab = 'locks'; _bkV2LockUI.st = 'all'; bkV2Render();
  return { rid, agName:ag.name, agId:ag.id, bad:BAD.id, good:OKL.id,
           dowSat:new Date('2026-10-31T00:00:00').getDay(),
           rBad:bkV2LockRounds(BAD), rGood:bkV2LockRounds(OKL) };
});
if (R0.err) fail(R0.err);
else if (R0.rBad.total !== 0)
  fail('สร้างเคสไม่สำเร็จ · ล็อกที่ควรไม่ครอบรอบไหนเลย กลับได้ ' + R0.rBad.total + ' รอบ');
else ok('สร้างเคส Panorama ขึ้นใหม่ได้ · ช่วงเริ่ม 2026-10-31 (วันในสัปดาห์ที่ ' + R0.dowSat +
        ' = เสาร์) ไม่ใส่วันจบ ติ๊กอังคาร+พฤหัส → ' + R0.rBad.total + ' รอบ · ล็อกเทียบได้ ' +
        R0.rGood.total + ' รอบ');

if (!R0.err) {
  await page.waitForTimeout(500);

  /* ══ 1 · ปุ่มแก้ไข + ฟอร์มโหลดค่าเดิม ═══════════════════════════ */
  const R1 = await page.evaluate((id) => {
    const nEdit = [].slice.call(document.querySelectorAll('button'))
      .filter(b => (b.textContent || '').trim() === 'แก้ไข').length;
    bkV2LockEditOpen(id);
    const f = { ..._bkV2LockForm };
    return { nEdit, open:_bkV2LockModalOpen, editId:_bkV2LockEditId,
             f:{ scope:f.scope, routeId:f.routeId, dateFrom:f.dateFrom, dateTo:f.dateTo,
                 dow:(f.dow||[]).join(','), qty:f.qty, holderType:f.holderType,
                 holderName:f.holderName, rdb:f.releaseDaysBefore, rt:f.releaseTime, reason:f.reason } };
  }, R0.bad);
  if (!R1.nEdit) fail('ไม่มีปุ่ม "แก้ไข" บนแถวล็อกเลย · ตั้งค่าผิดแล้วต้องลบทิ้งสร้างใหม่เหมือนเดิม');
  else if (!R1.open || R1.editId !== R0.bad) fail('กดแก้ไขแล้วไม่เข้าโหมดแก้ · ' + JSON.stringify(R1));
  else {
    const f = R1.f;
    const miss = [];
    if (f.scope !== 'bulk') miss.push('แบบ=' + f.scope);
    if (f.routeId !== R0.rid) miss.push('เส้นทาง');
    if (f.dateFrom !== '2026-10-31') miss.push('วันเริ่ม=' + f.dateFrom);
    if (f.dow !== '2,4') miss.push('วันในสัปดาห์=' + f.dow);
    if (String(f.qty) !== '30') miss.push('ที่นั่ง=' + f.qty);
    if (f.holderType !== 'agent' || f.holderName !== R0.agName) miss.push('ผู้ถือ=' + f.holderName);
    if (String(f.rdb) !== '1' || f.rt !== '16:00') miss.push('กติกาปล่อย=' + f.rdb + '/' + f.rt);
    if (!/T-PAN/.test(f.reason)) miss.push('โน้ต');
    if (miss.length) fail('ฟอร์มแก้ไขโหลดค่าเดิมไม่ครบ · ' + miss.join(' · '));
    else ok('มีปุ่มแก้ไข ' + R1.nEdit + ' ปุ่ม · กดแล้วฟอร์มโหลดค่าเดิมครบทุกช่อง ' +
            '(เส้นทาง ช่วงวัน วันในสัปดาห์ ที่นั่ง ผู้ถือ กติกาปล่อย โน้ต)');
  }
  await page.evaluate(() => bkV2CloseLockModal());
  await page.waitForTimeout(350);

  /* ══ 2–3 · ป้ายเตือนล็อกที่ไม่ครอบรอบไหนเลย ═══════════════════════ */
  const R23 = await page.evaluate(([badId, goodId]) => {
    _bkV2.tab = 'locks'; _bkV2LockUI.st = 'all'; _bkV2LockUI.q = 'T-PAN'; bkV2Render();
    const t1 = document.body.textContent || '';
    const hitBad = t1.indexOf('ไม่ครอบรอบไหนเลย') >= 0;
    const saysTo = /ยังไม่ได้ใส่วันจบ/.test(t1);
    _bkV2LockUI.q = 'T-OK'; bkV2Render();
    const t2 = document.body.textContent || '';
    const hitGood = t2.indexOf('ไม่ครอบรอบไหนเลย') >= 0;
    _bkV2LockUI.q = ''; bkV2Render();
    return { hitBad, saysTo, hitGood };
  }, [R0.bad, R0.good]);
  if (!R23.hitBad)
    fail('ล็อกที่ไม่ครอบรอบไหนเลยไม่มีป้ายเตือนในรายการ · คนตั้งจะไม่มีวันรู้ว่าทำไมไม่ขึ้น manifest');
  else if (!R23.saysTo)
    fail('มีป้ายเตือนแต่ไม่บอกสาเหตุว่ายังไม่ได้ใส่วันจบ · เห็นป้ายแล้วก็ยังไม่รู้ต้องแก้อะไร');
  else ok('ล็อกที่ไม่ครอบรอบไหนเลยขึ้นป้ายเตือน พร้อมบอกว่ายังไม่ได้ใส่วันจบ');
  if (R23.hitGood) fail('ล็อกปกติก็ขึ้นป้ายเตือนด้วย · ป้ายที่ขึ้นมั่วจะถูกมองข้ามทั้งหมด');
  else ok('ล็อกปกติไม่ขึ้นป้ายเตือน');

  /* ══ 4–5 · ใส่วันจบแล้วรอบกลับมา + บันทึกการแก้ ═══════════════════ */
  const R45 = await page.evaluate(([id, rid]) => {
    bkV2LockEditOpen(id);
    bkV2LockSetField('dateTo', '2027-03-31');
    bkV2LockEditSubmit();
    const L = SB_SEAT_LOCKS.find(x => x.id === id);
    const on = d => bkV2LocksFor(rid, d).some(x => x.id === id);
    return { to:L.dateTo, rounds:bkV2LockRounds(L).total, closed:_bkV2LockModalOpen,
             tue:on('2026-11-03'), thu:on('2026-11-05'), wed:on('2026-11-04'), sat:on('2026-11-07'),
             log:(L.log || []).filter(e => e.type === 'edit') };
  }, [R0.bad, R0.rid]);
  if (R45.rounds === 0) fail('ใส่วันจบแล้วยังได้ 0 รอบ · ' + JSON.stringify(R45));
  else if (!R45.tue || !R45.thu) fail('แก้แล้วยังไม่ขึ้นในวันอังคาร/พฤหัส · อ.' + R45.tue + ' พฤ.' + R45.thu);
  else if (R45.wed || R45.sat) fail('แก้แล้วขึ้นในวันที่ไม่ได้ติ๊กด้วย · พ.' + R45.wed + ' ส.' + R45.sat);
  else if (R45.closed) fail('บันทึกแล้วหน้าต่างแก้ไขไม่ปิด');
  else ok('ใส่วันจบ 2027-03-31 แล้วได้ ' + R45.rounds + ' รอบ · ขึ้นเฉพาะอังคารกับพฤหัส ' +
          'ไม่ขึ้นวันพุธกับเสาร์');
  if (!R45.log.length) fail('แก้ล็อกแล้วไม่บันทึกไว้เลย · ที่นั่งเปลี่ยนโดยไม่รู้ว่าใครแก้');
  else if (!/dateTo/.test(R45.log[0].note || '') || !R45.log[0].by)
    fail('บันทึกไม่บอกว่าแก้อะไรหรือใครแก้ · ' + JSON.stringify(R45.log[0]));
  else ok('บันทึกไว้ว่า "' + R45.log[0].note + '" โดย ' + R45.log[0].by);

  /* ══ 6 · วันจบว่างบันทึกไม่ได้ ════════════════════════════════════ */
  const R6 = await page.evaluate((id) => {
    bkV2LockEditOpen(id);
    bkV2LockSetField('dateTo', '');
    const n0 = 0;
    bkV2LockEditSubmit();
    const L = SB_SEAT_LOCKS.find(x => x.id === id);
    const stillOpen = _bkV2LockModalOpen;
    bkV2CloseLockModal();
    return { to:L.dateTo, stillOpen };
  }, R0.bad);
  if (R6.to !== '2027-03-31')
    fail('ปล่อยให้บันทึกวันจบว่างได้ · ช่วงจะยุบเหลือวันเดียวอีก นี่คือกับดักเดิม · ได้ "' + R6.to + '"');
  else if (!R6.stillOpen) fail('กันไว้แล้วแต่ปิดหน้าต่างทิ้ง · คนกดจะไม่รู้ว่าไม่ได้บันทึก');
  else ok('วันจบว่างบันทึกไม่ได้ · ค่าเดิมยังอยู่และหน้าต่างยังเปิดให้แก้');

  /* ══ 7–10 · ล็อกที่ขายไปแล้ว ══════════════════════════════════════ */
  const R7 = await page.evaluate(([rid, agId]) => {
    for (let i = SB_SEAT_LOCKS.length - 1; i >= 0; i--)
      if (/^T-/.test(SB_SEAT_LOCKS[i].reason || '')) SB_SEAT_LOCKS.splice(i, 1);
    const other = (ROUTES || []).map(r => r.id).filter(x => x !== rid)[0];
    const L = bkV2CreateLock({ scope:'bulk', routeId:rid, dateFrom:'2026-11-01', dateTo:'2026-12-31',
      dow:[], holderType:'agent', holderId:agId, qty:20, releaseDaysBefore:2, releaseTime:'10:00',
      reason:'T-USED' });
    const drew = bkV2DrawLock(L.id, 7, 'bk-test', '2026-11-10');
    /* พยายามย้ายทุกอย่าง */
    bkV2LockEditOpen(L.id);
    bkV2LockSetField('routeId', other);
    bkV2LockSetField('dateFrom', '2026-12-01');
    bkV2LockSetField('dateTo', '2027-01-31');
    bkV2LockSetField('holderType', 'office');
    bkV2LockSetField('qty', '25');
    bkV2LockSetField('releaseDaysBefore', '5');
    bkV2LockSetField('reason', 'T-USED · แก้โน้ตแล้ว');
    bkV2LockEditSubmit();
    const A = SB_SEAT_LOCKS.find(x => x.id === L.id);
    return { drew, other, moved:{ rid:A.routeId, from:A.dateFrom, to:A.dateTo, ht:A.holderType },
             kept:{ qty:A.qty, rdb:A.releaseDaysBefore, reason:A.reason }, id:L.id };
  }, [R0.rid, R0.agId]);
  if (R7.drew !== 7) fail('ดึงที่นั่งจากล็อกไม่สำเร็จ (' + R7.drew + ') · ตรวจข้อนี้ไม่ได้');
  else if (R7.moved.rid !== R0.rid || R7.moved.from !== '2026-11-01' || R7.moved.to !== '2026-12-31' || R7.moved.ht !== 'agent')
    fail('ล็อกที่ขายไปแล้วถูกย้ายได้ · ' + JSON.stringify(R7.moved) +
         ' · ใบจองที่ดึงไปแล้วจะชี้ไปล็อกที่ไม่ครอบวันของตัวเอง');
  else ok('ล็อกที่ขายไปแล้ว (' + R7.drew + ' ที่) · ย้ายเส้นทาง ย้ายช่วงวัน เปลี่ยนผู้ถือ ไม่ได้');
  if (R7.kept.qty !== 25 || R7.kept.rdb !== 5 || !/แก้โน้ตแล้ว/.test(R7.kept.reason))
    fail('ล็อกที่ขายไปแล้วแก้จำนวน/กติกาปล่อย/โน้ตไม่ได้ · ' + JSON.stringify(R7.kept));
  else ok('แต่ยังแก้จำนวนที่นั่ง (20→25) กติกาปล่อยคืน (2→5 วัน) และโน้ต ได้ตามปกติ');

  /* ══ 9 · ลดที่นั่งต่ำกว่าที่ขายไปแล้วไม่ได้ ═══════════════════════ */
  const R9 = await page.evaluate((id) => {
    bkV2LockEditOpen(id);
    bkV2LockSetField('qty', '3');   /* ขายไปแล้ว 7 */
    bkV2LockEditSubmit();
    const A = SB_SEAT_LOCKS.find(x => x.id === id);
    const stillOpen = _bkV2LockModalOpen;
    bkV2CloseLockModal();
    return { qty:A.qty, stillOpen };
  }, R7.id);
  if (R9.qty !== 25)
    fail('ลดที่นั่งเหลือ ' + R9.qty + ' ได้ ทั้งที่ขายไปแล้ว 7 ที่ · ล็อกจะจ่ายที่นั่งเกินจำนวนที่มี');
  else if (!R9.stillOpen) fail('กันไว้แล้วแต่ปิดหน้าต่างทิ้ง');
  else ok('ลดที่นั่งต่ำกว่าที่ขายไปแล้วไม่ได้ · ยังเป็น ' + R9.qty + ' ที่');

  /* ══ 10–11 · กรุ๊ปย่อย ════════════════════════════════════════════ */
  const R10 = await page.evaluate(([rid, agId]) => {
    for (let i = SB_SEAT_LOCKS.length - 1; i >= 0; i--)
      if (/^T-/.test(SB_SEAT_LOCKS[i].reason || '')) SB_SEAT_LOCKS.splice(i, 1);
    const P = bkV2CreateLock({ scope:'bulk', routeId:rid, dateFrom:'2026-11-01', dateTo:'2026-12-31',
      dow:[], holderType:'agent', holderId:agId, qty:20, reason:'T-PAR' });
    const OTHER = bkV2CreateLock({ scope:'bulk', routeId:rid, dateFrom:'2026-11-01', dateTo:'2026-12-31',
      dow:[], holderType:'office', holderId:null, qty:9, reason:'T-OTHER' });
    const C = bkV2CreateSubLock(P.id, 'กรุ๊ป A', 12, {});
    /* ลดที่นั่งแม่ต่ำกว่าที่แบ่งย่อยไว้ */
    bkV2LockEditOpen(P.id); bkV2LockSetField('qty', '8'); bkV2LockEditSubmit();
    const P1 = SB_SEAT_LOCKS.find(x => x.id === P.id);
    const lowBlocked = (P1.qty === 20);
    bkV2CloseLockModal();
    /* ย้ายช่วงวันของแม่ · ลูกต้องตาม */
    bkV2LockEditOpen(P.id);
    bkV2LockSetField('dateFrom', '2026-11-15'); bkV2LockSetField('dateTo', '2027-01-15');
    bkV2LockSetField('dow', [1, 3]);
    bkV2LockEditSubmit();
    const P2 = SB_SEAT_LOCKS.find(x => x.id === P.id);
    const C2 = SB_SEAT_LOCKS.find(x => x.id === C.id);
    const O2 = SB_SEAT_LOCKS.find(x => x.id === OTHER.id);
    return { lowBlocked, parent:{ f:P2.dateFrom, t:P2.dateTo, d:(P2.dow||[]).join(',') },
             kid:{ f:C2.dateFrom, t:C2.dateTo, d:(C2.dow||[]).join(','), rid:C2.routeId },
             other:{ f:O2.dateFrom, t:O2.dateTo, d:(O2.dow||[]).join(',') } };
  }, [R0.rid, R0.agId]);
  if (!R10.lowBlocked)
    fail('ลดที่นั่งของล็อกแม่ต่ำกว่าที่แบ่งเป็นกรุ๊ปย่อยไว้ได้ · กรุ๊ปย่อยจะรวมกันเกินโควตาแม่');
  else ok('ลดที่นั่งของล็อกแม่ต่ำกว่าที่แบ่งย่อยไว้ (12 ที่) ไม่ได้');
  if (R10.kid.f !== R10.parent.f || R10.kid.t !== R10.parent.t || R10.kid.d !== R10.parent.d)
    fail('ย้ายช่วงวันของล็อกแม่แล้วกรุ๊ปย่อยไม่ตาม · แม่ ' + JSON.stringify(R10.parent) +
         ' · ลูก ' + JSON.stringify(R10.kid) + ' · ลูกจะคิดที่นั่งคนละรอบกับแม่');
  else if (R10.other.f !== '2026-11-01' || R10.other.t !== '2026-12-31' || R10.other.d !== '')
    fail('แก้ล็อกใบหนึ่งแล้วไปโดนล็อกใบอื่นด้วย · ' + JSON.stringify(R10.other));
  else ok('ย้ายช่วงวันของล็อกแม่แล้วกรุ๊ปย่อยเดินตาม (' + R10.kid.f + ' → ' + R10.kid.t +
          ' · วัน ' + R10.kid.d + ') และล็อกใบอื่นไม่กระทบ');

  /* ══ 11b · ฟอร์มสร้างก็ต้องกันกับดักเดียวกัน ══════════════════════
     เคสนี้เกิดจากฟอร์ม "สร้าง" ปล่อยให้เว้นวันจบได้ · ถ้าไม่ปิดตรงนั้นด้วย
     คนถัดไปก็สร้างล็อกที่ไม่ครอบอะไรเลยได้อีก แล้ววนกลับมาที่เดิม */
  const R11b = await page.evaluate((rid) => {
    const n0 = SB_SEAT_LOCKS.length;
    const set = o => Object.keys(o).forEach(k => bkV2LockSetField(k, o[k]));
    _bkV2LockForm.dow = [];
    set({ scope:'bulk', routeId:rid, dateFrom:'2026-10-31', dateTo:'', qty:'10', holderType:'office' });
    bkV2LockCreateSubmit();
    const nEmpty = SB_SEAT_LOCKS.length;
    _bkV2LockForm.dow = [2, 4];
    set({ dateTo:'2026-10-31' });          /* ช่วงวันเดียว · เสาร์ · ติ๊ก อ./พฤ. → 0 รอบ */
    bkV2LockCreateSubmit();
    const nZero = SB_SEAT_LOCKS.length;
    _bkV2LockForm.dow = [];
    set({ dateTo:'2026-12-31', reason:'T-NEW' });
    bkV2LockCreateSubmit();
    const nGood = SB_SEAT_LOCKS.length;
    return { n0, nEmpty, nZero, nGood };
  }, R0.rid);
  if (R11b.nEmpty !== R11b.n0)
    fail('ฟอร์มสร้างยังปล่อยให้เว้นวันจบได้ · คนถัดไปจะสร้างล็อกแบบเดียวกับ Panorama ได้อีก');
  else if (R11b.nZero !== R11b.n0)
    fail('ฟอร์มสร้างยังปล่อยให้สร้างล็อกที่ไม่ครอบรอบไหนเลยได้');
  else if (R11b.nGood !== R11b.n0 + 1)
    fail('ปิดกับดักแล้วแต่ล็อกที่ถูกต้องก็สร้างไม่ได้ด้วย · สร้างได้ ' + (R11b.nGood - R11b.n0) + ' ใบ');
  else ok('ฟอร์มสร้างปิดกับดักเดียวกัน · เว้นวันจบไม่ได้ และสร้างล็อกที่ไม่ครอบรอบไหนเลยไม่ได้ ' +
          'แต่ล็อกที่ถูกต้องยังสร้างได้ปกติ');

  /* เก็บกวาด */
  await page.evaluate(() => {
    for (let i = SB_SEAT_LOCKS.length - 1; i >= 0; i--)
      if (/^T-|^กรุ๊ป A$/.test(SB_SEAT_LOCKS[i].reason || SB_SEAT_LOCKS[i].subName || '')) SB_SEAT_LOCKS.splice(i, 1);
    for (let i = SB_SEAT_LOCKS.length - 1; i >= 0; i--)
      if (SB_SEAT_LOCKS[i].subName === 'กรุ๊ป A') SB_SEAT_LOCKS.splice(i, 1);
    bkV2Render();
  });
  await page.waitForTimeout(250);
}

/* ══ 12 · ไม่มี error บนหน้า ══════════════════════════════════════════ */
if (errors.length) fail('มี error ' + errors.length + ' ครั้ง · ' + errors.slice(0, 2).join(' | '));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
