// §poShip · ของที่ลงประจำเรือ + คำอธิบายในประวัติการเคลื่อนไหว
//
// ที่มา (2026-09-28) · ฟีดแบคจากหน้าท่า Visit Panwa สองข้อ
//   "หน้ากากผู้ใหญ่สต๊อกมี 88 · เรือมาเบิกลงประจำเรือ 3 ตัว
//    ก็ต้องกดปรับยอดเพื่อให้ตัดออกจากสต๊อก จะได้รู้ว่าเหลือพร้อมใช้กี่ตัว"
//   "กดดูในประวัติเคลื่อนไหวมันดูได้ว่ามีการปรับยอดไปวันไหน
//    แต่ไม่ขึ้นคำอธิบายว่าเบิกไปไหน"
//
// สาเหตุจริงสองอัน
//   ก · ปุ่มเบิกเป็นรอบวัน · ของที่เบิกแล้วไม่คืน poBoatCarry ยกยอดไปทุกวันข้างหน้า
//       แล้วไปกองใน "ยังไม่ได้คืน" · ของประจำลำจึงไม่มีที่ยืน ต้องหนีไปใช้ปรับยอด
//   ข · dialog ปรับยอดมีช่องเหตุผลและเก็บลง note จริงมาตลอด
//       แต่ตารางประวัติไม่เคยพิมพ์ note ออกมา · ที่พิมพ์ไว้อยู่ในฐานข้อมูล แค่ไม่มีใครเห็น
//
// เทสนี้กันเก้าอย่าง
//   1 ปุ่ม "ประจำเรือ" อยู่บนแถวของ · เปิดแล้วเห็นเฉพาะเรือของท่านั้น ไม่ใช่ทั้งกองเรือ
//   2 ลงประจำเรือแล้วพร้อมใช้ลดจริง · เข้าถังของตัวเอง ไม่ปนถัง "อยู่กับเรือ" · ของในมือไม่หาย
//   3 ของประจำเรือไม่ไปโผล่ "ยังไม่ได้คืน" และไม่ถูก poBoatCarry ทวงในวันถัด ๆ ไป
//   4 ลงเกินยอดพร้อมใช้ไม่ได้ · ต้องขึ้นข้อความในกล่อง ไม่ใช่เงียบแล้วยอดติดลบ
//   5 ถอดออกจากเรือแล้วยอดกลับมาเท่าเดิมเป๊ะทุกถัง
//   6 ตารางประวัติพิมพ์คำอธิบายที่คนกรอกไว้จริง · ทั้งแถวประจำเรือและแถวปรับยอด
//   7 แก้คำอธิบาย/ระบุลำ ย้อนหลังได้ · บันทึกว่าใครแก้ · จำนวน ประเภท วันที่ ห้ามขยับ
//   8 ชิปกรอง "ประจำเรือ" กรองได้จริง
//   9 ไม่มี error บนหน้า

import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1050 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1300);

/* ══ 0 · หาท่าที่มีของในทะเบียนและมีเรือ ══════════════════════════════ */
const R0 = await page.evaluate(() => {
  const el = document.querySelector('.nav-item[data-view^="po-"]');
  if (!el) return { err: 'ไม่มีเมนูเบิก–คืนอุปกรณ์ในไซด์บาร์' };
  nav(el);
  if (typeof poShipOpen !== 'function' || typeof poBal !== 'function')
    return { err: 'ไม่มีฟังก์ชันของหน้านี้ (poShipOpen / poBal)' };
  /* ท่าที่มีทั้งของและเรือ · คิดเองจาก PIER_ITEMS + BOATS ไม่ถามหน้าจอ */
  let pick = null;
  (PO_PIERS || []).forEach(p => {
    if (pick) return;
    const items = (PIER_ITEMS || []).filter(i => i.pier === p.k && i.active !== false && poBal(i.id).ready > 5);
    const boats = (BOATS || []).filter(b => {
      const pk = (typeof getBoatCurrentPier === 'function') ? getBoatCurrentPier(b) : (b.pier || '');
      return (pk || b.pier || '') === p.k;
    });
    if (items.length && boats.length) pick = { pier: p.k, item: items[0].id, label: items[0].label,
                                               nItem: items.length, nBoat: boats.length,
                                               boat: boats[0].id, boatNm: boats[0].name || boats[0].id };
  });
  if (!pick) return { err: 'ไม่มีท่าไหนที่มีทั้งของในทะเบียนและเรือ · ตรวจไม่ได้' };
  /* เรือของท่าอื่น · เอาไว้ตรวจว่ารายชื่อในกล่องไม่หลุดข้ามท่า */
  const other = (BOATS || []).filter(b => {
    const pk = (typeof getBoatCurrentPier === 'function') ? getBoatCurrentPier(b) : (b.pier || '');
    return (pk || b.pier || '') && (pk || b.pier || '') !== pick.pier;
  }).map(b => b.id);
  const b0 = poBal(pick.item);
  return { ...pick, other, ready0: b0.ready, inhand0: b0.inhand };
});
if (R0.err) fail(R0.err);
else ok('ใช้ท่า ' + R0.pier + ' · ของ "' + R0.label + '" พร้อมใช้ ' + R0.ready0 +
        ' · เรือของท่านี้ ' + R0.nBoat + ' ลำ · เรือท่าอื่น ' + R0.other.length + ' ลำ');

if (!R0.err) {
  const openPier = () => page.evaluate(p => {
    nav(document.querySelector('.nav-item[data-view="po-' + p + '"]'));
  }, R0.pier);
  await openPier();
  await page.waitForTimeout(400);

  /* ══ 1 · ปุ่มบนแถวของ + รายชื่อเรือไม่ข้ามท่า ═══════════════════════ */
  const R1 = await page.evaluate(([id, other]) => {
    /* มี .po-host หลายอันในหน้า (view ละอันต่อท่าต่อแท็บ) · ต้องถามเฉพาะ view ที่เปิดอยู่
       ไม่งั้น querySelector คว้าอันแรกในเอกสารซึ่งเป็นหน้าอื่นที่ไม่มีตารางของ */
    const host = document.querySelector('.view.active .po-host')
              || document.querySelector('.view.active') || document.body;
    const btn = [].slice.call(host.querySelectorAll('.po-ir .po-go'))
      .find(b => /ประจำเรือ/.test(b.textContent || ''));
    if (!btn) return { err: 'ไม่มีปุ่ม "ประจำเรือ" บนแถวของ · คนหน้าท่าก็ต้องกลับไปใช้ปรับยอดเหมือนเดิม' };
    poShipOpen(id);
    const sel = document.getElementById('poshipb');
    if (!sel) return { err: 'กดแล้วไม่มีช่องเลือกลำในกล่อง' };
    const ids = [].slice.call(sel.options).map(o => o.value);
    const leak = ids.filter(x => other.indexOf(x) >= 0);
    poModalClose();
    return { nBtn: [].slice.call(host.querySelectorAll('.po-ir .po-go'))
               .filter(b => /ประจำเรือ/.test(b.textContent || '')).length,
             nOpt: ids.length, leak };
  }, [R0.item, R0.other]);
  if (R1.err) fail(R1.err);
  else if (R1.leak.length)
    fail('กล่องลงประจำเรือมีเรือของท่าอื่นหลุดมา ' + R1.leak.length + ' ลำ (' + R1.leak.slice(0, 3).join(', ') +
         ') · หน้าท่าจะลงของให้ลำที่ไม่ได้จอดอยู่ที่ท่าตัวเอง');
  else if (R1.nOpt !== R0.nBoat)
    fail('กล่องมีเรือให้เลือก ' + R1.nOpt + ' ลำ · ท่านี้มี ' + R0.nBoat + ' ลำ');
  else ok('ปุ่ม "ประจำเรือ" ขึ้นครบทุกแถวของ (' + R1.nBtn + ' แถว) · กล่องมีแต่เรือของท่านี้ ' +
          R1.nOpt + ' ลำ ไม่หลุดข้ามท่า');

  /* ══ 2 · ลงประจำเรือแล้วยอดขยับถูกถัง ═══════════════════════════════ */
  const R2 = await page.evaluate(async ([id, boat]) => {
    const b0 = poBal(id);
    poShipOpen(id);
    await new Promise(r => setTimeout(r, 120));
    document.getElementById('poshipb').value = boat;
    document.getElementById('poshipq').value = '3';
    document.getElementById('poshipn').value = 'ติดตั้งประจำลำ · ทดสอบ';
    poShipSave(id);
    await new Promise(r => setTimeout(r, 200));
    const b1 = poBal(id);
    const mv = (PIER_MOVES || []).filter(m => m.itemId === id && m.type === 'assign');
    poModalClose();
    return { b0: { r: b0.ready, s: b0.onship, ob: b0.onboat, ih: b0.inhand },
             b1: { r: b1.ready, s: b1.onship, ob: b1.onboat, ih: b1.inhand },
             nMv: mv.length, mv: mv[0] ? { boatId: mv[0].boatId, qty: mv[0].qty, note: mv[0].note,
                                           by: mv[0].by, date: mv[0].date } : null,
             byBoat: poShipByBoat(id) };
  }, [R0.item, R0.boat]);
  if (!R2.nMv) fail('กดลงประจำเรือแล้วไม่มีรายการเคลื่อนไหวเกิดขึ้นเลย');
  else if (R2.b1.r !== R2.b0.r - 3)
    fail('ลงประจำเรือ 3 แล้วพร้อมใช้ ' + R2.b0.r + ' → ' + R2.b1.r + ' · ควรเป็น ' + (R2.b0.r - 3) +
         ' · นี่คือตัวเลขที่หน้าท่าถามหา "เหลือพร้อมใช้กี่ตัว"');
  else if (R2.b1.s !== R2.b0.s + 3)
    fail('ถังประจำเรือ ' + R2.b0.s + ' → ' + R2.b1.s + ' · ควรเป็น ' + (R2.b0.s + 3));
  else if (R2.b1.ob !== R2.b0.ob)
    fail('ลงประจำเรือแล้วถัง "อยู่กับเรือ" ขยับด้วย (' + R2.b0.ob + ' → ' + R2.b1.ob +
         ') · สองถังนี้ต้องแยกกัน ไม่งั้นของประจำลำจะกลายเป็นของค้างที่ต้องตามเก็บ');
  else if (R2.b1.ih !== R2.b0.ih)
    fail('ของในมือทั้งหมดเปลี่ยนจาก ' + R2.b0.ih + ' เป็น ' + R2.b1.ih +
         ' · การย้ายถังไม่ใช่การทำของหาย ยอดรวมต้องเท่าเดิม');
  else if (!R2.mv || R2.mv.boatId !== R0.boat)
    fail('แถวที่บันทึกไม่ได้ผูกลำไว้ (boatId="' + (R2.mv && R2.mv.boatId) + '") · ' +
         'นี่คือช่องที่ปรับยอดขาดไปตั้งแต่แรก');
  else if (!R2.mv.note) fail('แถวที่บันทึกไม่มีคำอธิบายติดไป ทั้งที่กรอกไว้');
  else if (!R2.byBoat.length || R2.byBoat[0].bid !== R0.boat || R2.byBoat[0].q !== 3)
    fail('poShipByBoat ตอบไม่ตรง · ได้ ' + JSON.stringify(R2.byBoat));
  else ok('ลงประจำเรือ 3 · พร้อมใช้ ' + R2.b0.r + ' → ' + R2.b1.r + ' · ถังประจำเรือ ' + R2.b1.s +
          ' · "อยู่กับเรือ" ไม่ขยับ · ของในมือยังเท่าเดิม ' + R2.b1.ih + ' · ผูกลำ ' + R0.boatNm);

  /* ══ 3 · ไม่ไปกองใน "ยังไม่ได้คืน" และไม่โดนทวงวันถัดไป ════════════
     นี่คือเหตุผลทั้งหมดที่ของประจำลำต้องมีถังของตัวเอง
     ถ้ามันตกไปอยู่ในกองเดียวกับของที่เบิกแล้วไม่คืน หน้าท่าก็จะถูกทวงทุกวันไม่มีวันจบ */
  const R3 = await page.evaluate(([id, boat]) => {
    /* วันในอนาคตไกล ๆ · ของที่เบิกแล้วไม่คืนจะยังตามมาถึงวันนี้เสมอ */
    const far = '2099-01-01';
    const carry = (typeof poBoatCarry === 'function') ? poBoatCarry(far, boat) : {};
    const sum = (typeof poBoatSum === 'function') ? poBoatSum(_poDate, boat, _poPier) : {};
    const o = sum[id] || {};
    poLedgerOpen();
    const box = document.getElementById('po-modal') || document.body;
    const txt = box.textContent || '';
    const hasShipBox = /ของประจำเรือ · แยกตามลำ/.test(txt);
    /* ตัวเลขในหัวการ์ด "ยังไม่ได้คืน" · ของประจำลำต้องไม่ถูกนับเข้าไป */
    const cards = [].slice.call(box.querySelectorAll('div')).filter(d =>
      /^ยังไม่ได้คืน$/.test(((d.firstElementChild || {}).textContent || '').trim()));
    let outTot = null;
    if (cards.length) outTot = +(((cards[0].children[1] || {}).textContent) || '0').replace(/[^0-9]/g, '');
    poModalClose();
    return { carry: carry[id] || 0, ob: o.ob || 0, iss: o.iss || 0, hasShipBox, outTot };
  }, [R0.item, R0.boat]);
  if (R3.carry) fail('ของประจำเรือถูก poBoatCarry ทวงในวันอนาคต (' + R3.carry +
                     ' ชิ้น) · หน้าท่าจะโดนเตือนว่ายังไม่คืนทุกวันไม่มีวันจบ');
  else if (R3.iss) fail('ของประจำเรือไปโผล่เป็นยอด "เบิก" ของวันนี้ ' + R3.iss +
                        ' ชิ้น · ใบเบิก–คืนประจำวันจะมีของที่ไม่ได้เบิกวันนี้ปนอยู่');
  else if (!R3.hasShipBox) fail('ในประวัติไม่มีกล่อง "ของประจำเรือ · แยกตามลำ" · ' +
                                'หน้าท่าตอบไม่ได้ว่าลำไหนถือของอะไรอยู่');
  else if (R3.outTot) fail('การ์ด "ยังไม่ได้คืน" ขึ้น ' + R3.outTot +
                           ' ทั้งที่มีแต่ของประจำเรือ · สองอย่างนี้ถูกนับรวมกัน');
  else ok('ของประจำเรือไม่ถูกทวงในวันอนาคต ไม่ปนกับใบเบิกประจำวัน ไม่เข้าการ์ด "ยังไม่ได้คืน" ' +
          'และมีกล่องสรุปแยกตามลำให้ดู');

  /* ══ 4 · ลงเกินยอดพร้อมใช้ไม่ได้ ═══════════════════════════════════ */
  const R4 = await page.evaluate(async ([id, boat]) => {
    const b0 = poBal(id);
    poShipOpen(id);
    await new Promise(r => setTimeout(r, 120));
    document.getElementById('poshipb').value = boat;
    document.getElementById('poshipq').value = String(b0.ready + 5);
    poShipSave(id);
    await new Promise(r => setTimeout(r, 150));
    const err = (document.getElementById('poship_err') || {}).textContent || '';
    const b1 = poBal(id);
    poModalClose();
    return { want: b0.ready + 5, r0: b0.ready, r1: b1.ready, err: err.trim().slice(0, 90) };
  }, [R0.item, R0.boat]);
  if (R4.r1 !== R4.r0)
    fail('ลงประจำเรือ ' + R4.want + ' ทั้งที่พร้อมใช้มีแค่ ' + R4.r0 + ' แล้วยอดยังขยับ (' +
         R4.r0 + ' → ' + R4.r1 + ') · ยอดพร้อมใช้ติดลบไม่มีทางเป็นจริง');
  else if (!R4.err)
    fail('กันไว้แล้วแต่ไม่บอกอะไรเลย · คนหน้าท่ากดแล้วไม่มีอะไรเกิดขึ้น จะนึกว่าจอค้าง');
  else ok('ลงเกินยอดพร้อมใช้ไม่ได้ · ยอดไม่ขยับ และขึ้นข้อความในกล่อง "' + R4.err + '"');

  /* ══ 5 · ถอดออกแล้วยอดกลับเท่าเดิมเป๊ะ ═════════════════════════════ */
  const R5 = await page.evaluate(async ([id, boat]) => {
    const b0 = poBal(id);
    poUnshipSave(id, boat);
    await new Promise(r => setTimeout(r, 200));
    const b1 = poBal(id);
    poModalClose();
    return { b0: { r: b0.ready, s: b0.onship, ih: b0.inhand },
             b1: { r: b1.ready, s: b1.onship, ih: b1.inhand },
             left: poShipByBoat(id) };
  }, [R0.item, R0.boat]);
  if (R5.b1.r !== R0.ready0)
    fail('ถอดออกจากเรือแล้วพร้อมใช้ ' + R5.b1.r + ' · ก่อนเริ่มเทสคือ ' + R0.ready0 +
         ' · ลงแล้วถอดต้องกลับมาที่เดิมเป๊ะ');
  else if (R5.b1.s !== 0)
    fail('ถอดออกหมดแล้วถังประจำเรือยังเหลือ ' + R5.b1.s);
  else if (R5.left.length)
    fail('ถอดออกแล้ว poShipByBoat ยังบอกว่ามีของอยู่ · ' + JSON.stringify(R5.left));
  else if (R5.b1.ih !== R0.inhand0)
    fail('ของในมือหลังถอดออก ' + R5.b1.ih + ' · ก่อนเริ่มเทส ' + R0.inhand0);
  else ok('ถอดออกจากเรือแล้วพร้อมใช้กลับมาที่ ' + R5.b1.r + ' เท่ากับก่อนเริ่มเทสเป๊ะ · ถังประจำเรือว่าง');

  /* ══ 6 · ตารางประวัติพิมพ์คำอธิบายจริง ═════════════════════════════
     ข้อนี้คือฟีดแบคข้อสองตรง ๆ · note ถูกเก็บมาตลอด แต่ตารางไม่เคยพิมพ์
     จึงต้องวัดจากตัวหนังสือที่วาดออกมา ไม่ใช่วัดว่าข้อมูลมีอยู่ในตัวแปร */
  const R6 = await page.evaluate((id) => {
    const NOTE = 'ทดสอบคำอธิบาย ' + Date.now();
    poAdd({ date: _poDate, pier: _poPier, itemId: id, boatId: '', type: 'adjust', qty: -2, note: NOTE });
    poPersist();
    poLedgerOpen();
    const box = document.getElementById('po-modal') || document.body;
    const heads = [].slice.call(box.querySelectorAll('table.po-t thead th')).map(t => (t.textContent || '').trim());
    const shown = (box.textContent || '').indexOf(NOTE) >= 0;
    /* แถวประจำเรือที่บันทึกไว้ตอนข้อ 2 ต้องเห็นคำอธิบายของมันด้วย */
    const shipNote = (box.textContent || '').indexOf('ติดตั้งประจำลำ · ทดสอบ') >= 0;
    poModalClose();
    return { heads, shown, shipNote, NOTE };
  }, R0.item);
  if (R6.heads.indexOf('คำอธิบาย') < 0)
    fail('ตารางประวัติยังไม่มีคอลัมน์คำอธิบาย · มี ' + R6.heads.join(' | '));
  else if (!R6.shown)
    fail('มีคอลัมน์คำอธิบายแล้วแต่ข้อความที่กรอกไว้ไม่ถูกพิมพ์ออกมา · ' + R6.NOTE);
  else if (!R6.shipNote)
    fail('คำอธิบายของแถวลงประจำเรือไม่ถูกพิมพ์ออกมา');
  else ok('ตารางประวัติมีคอลัมน์คำอธิบาย และพิมพ์ข้อความที่กรอกไว้จริง ทั้งแถวปรับยอดและแถวประจำเรือ');

  /* ══ 7 · แก้ย้อนหลังได้ และบันทึกว่าใครแก้ ══════════════════════════ */
  const R7 = await page.evaluate(async ([boat]) => {
    const row = (PIER_MOVES || []).filter(m => m.type === 'adjust' && m.pier === _poPier).slice(-1)[0];
    if (!row) return { err: 'ไม่มีแถวปรับยอดให้แก้' };
    const b4 = { q: poNum(row.qty), t: row.type, d: row.date };
    poMoveEdit(row.id);
    await new Promise(r => setTimeout(r, 150));
    const hasBoat = !!document.getElementById('pomvb');
    const hasNote = !!document.getElementById('pomvn');
    if (!hasNote) { poModalClose(); return { err: 'กล่องแก้ไม่มีช่องคำอธิบาย' }; }
    const NEW = 'เบิกลงประจำเรือ · เติมย้อนหลัง';
    document.getElementById('pomvn').value = NEW;
    if (hasBoat) document.getElementById('pomvb').value = boat;
    poMoveEditSave(row.id);
    await new Promise(r => setTimeout(r, 250));
    const after = (PIER_MOVES || []).filter(m => m.id === row.id)[0] || {};
    poModalClose();
    return { hasBoat, NEW, note: after.note, boatId: after.boatId, editBy: after.editBy,
             editAt: after.editAt, q: poNum(after.qty), t: after.type, d: after.date, b4 };
  }, [R0.boat]);
  if (R7.err) fail(R7.err);
  else if (!R7.hasBoat) fail('แถวปรับยอดแก้ลำไม่ได้ · คำถาม "เบิกไปลำไหน" ก็ยังตอบไม่ได้อยู่ดี');
  else if (R7.note !== R7.NEW) fail('แก้คำอธิบายแล้วไม่ถูกบันทึก · ได้ "' + R7.note + '"');
  else if (R7.boatId !== R0.boat) fail('ระบุลำย้อนหลังแล้วไม่ถูกบันทึก · ได้ "' + R7.boatId + '"');
  else if (!R7.editBy && !R7.editAt)
    fail('แก้ย้อนหลังแล้วไม่บันทึกว่าใครแก้เมื่อไร · ประวัติที่แก้ได้โดยไม่มีร่องรอยเชื่อไม่ได้');
  else if (R7.q !== R7.b4.q || R7.t !== R7.b4.t || R7.d !== R7.b4.d)
    fail('การแก้คำอธิบายไปเปลี่ยนตัวบัญชีด้วย · จำนวน ' + R7.b4.q + '→' + R7.q +
         ' ประเภท ' + R7.b4.t + '→' + R7.t + ' วันที่ ' + R7.b4.d + '→' + R7.d);
  else ok('แก้คำอธิบายและระบุลำย้อนหลังได้ · บันทึกคนแก้ไว้ (' + (R7.editBy || '—') +
          ') · จำนวน ประเภท วันที่ ไม่ขยับ');

  /* ══ 8 · ชิปกรองประจำเรือ ══════════════════════════════════════════ */
  const R8 = await page.evaluate(() => {
    poLedgerOpen();
    const box = () => document.getElementById('po-modal') || document.body;
    const chip = [].slice.call(box().querySelectorAll('button'))
      .find(b => /^ประจำเรือ/.test((b.textContent || '').trim()));
    if (!chip) { poModalClose(); return { err: 'ไม่มีชิปกรอง "ประจำเรือ"' }; }
    chip.click();
    const tds = [].slice.call(box().querySelectorAll('table.po-t tbody tr'))
      .map(tr => (tr.children[2].textContent || '').trim());
    poModalClose();
    return { n: tds.length, off: tds.filter(t => !/ประจำเรือ|ถอดจากเรือ/.test(t)) };
  });
  if (R8.err) fail(R8.err);
  else if (!R8.n) fail('กดชิป "ประจำเรือ" แล้วไม่เหลือแถวเลย ทั้งที่เพิ่งลงและถอดไป');
  else if (R8.off.length)
    fail('กดชิป "ประจำเรือ" แล้วยังมีแถวประเภทอื่นปนมา ' + R8.off.length + ' แถว · ' + R8.off.slice(0, 3).join(', '));
  else ok('ชิปกรอง "ประจำเรือ" เหลือเฉพาะแถวลงประจำ/ถอดออก ' + R8.n + ' แถว');
}

/* ══ 9 · ไม่มี error บนหน้า ═══════════════════════════════════════════ */
if (errors.length) fail('มี error ' + errors.length + ' ครั้ง · ' + errors.slice(0, 2).join(' | '));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
