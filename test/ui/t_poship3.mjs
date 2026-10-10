// §poShip3 · ของสามกอง · ของประจำเรือ ตรวจ / แจ้งขาด / เติมจากคลัง / ถอดคืน รายลำ
//
// ที่มา (8 ต.ค. 2026) · เจ้าของ: "ของมันเป็น 3 กอง · 1 ออฟฟิศ (นับ เช็ค) · 2 เบิกเช้าคืนเย็น
//   · 3 เบิกแล้วของอยู่ที่เรือ ต้องเช็ค ถ้าหายอัพเดทว่าหายเพราะอะไร · หายควรหักจากกองนี้
//   · ถ้าจะเอาเพิ่มต้องไปเบิกจากกอง 1 ก่อน · จะมีประวัติเข้าออกชัดเจน"
//
// กันแปดอย่าง
//   1 หน้าหลักมีส่วน "ของประจำเรือ" แยกการ์ดรายลำ · รายการ + จำนวน · วงจรผ้าเลื่อนเป็นข้อ 4
//   2 ตรวจแล้วขาด · ไม่เลือกเหตุผล / ไม่ใส่รายละเอียด = ไม่บันทึก · ขึ้นข้อความในกล่อง
//   3 นับได้มากกว่าระบบ = ไม่ให้บันทึก (ต้องเติมจากคลัง) · เติมเกินคลังพร้อมใช้ = ไม่ให้ · ถอดเกิน = ไม่ให้
//   4 บันทึกครบ · ขาดหักจากกองประจำเรือ (หายสะสมเพิ่ม · พร้อมใช้ไม่ขยับ) · เติมหักจากคลัง · ถอดคืนเข้าคลัง · ผูกลำทุกแถว
//   5 ไม่ปนกับเบิก–คืนรายวัน · ใบรายลำวันนั้นไม่มีของขาด · ไม่มีของค้างทวงวันหน้า · ไม่ขึ้นแถบ "ยังไม่ตั้งค่าปรับ"
//   6 เสีย·ส่งซ่อม จากเรือ → ไปกองรอซ่อม · ซ่อมเสร็จกลับเข้าคลัง (กอง 1)
//   7 ลงของให้เรือลำใหม่ · เลือกเรือ แล้วยกรายการจากคลังขึ้นได้
//   8 ประวัติ · ป้าย "หายบนเรือ" · กล่องของประจำเรือแยกตามลำหักส่วนที่ขาดแล้ว · ไม่มี error
import { open } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1050 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1300);
const P = await page.evaluate(() => {
  nav(document.querySelector('.nav-item[data-view^="po-"]'));
  const its = poItems(_poPier).filter(i => poBal(i.id).ready >= 12);
  const BL = poShipBoats(_poPier);
  if (its.length < 3 || BL.length < 2) return { err: 'need 3 items with stock and 2 boats' };
  const [A, B, C] = its.map(i => i.id), bo = BL[0].id, bo2 = BL[1].id;
  poAdd({ date: _poDate, pier: _poPier, itemId: A, boatId: bo, type: 'assign', qty: 10 });
  poAdd({ date: _poDate, pier: _poPier, itemId: B, boatId: bo, type: 'assign', qty: 5 });
  poPersist(); renderPierOffice();
  const s = id => { const b = poBal(id); return { ready: b.ready, onship: b.onship, gone: b.gone, repair: b.repair, inhand: b.inhand }; };
  return { A, B, C, bo, bo2, boNm: BL[0].name || bo, a0: s(A), b0: s(B), c0: s(C) };
});
if (P.err) { fail('prep ' + P.err); await close(); process.exit(1); }
const S = id => page.evaluate(id => { const b = poBal(id); return { ready: b.ready, onship: b.onship, gone: b.gone, repair: b.repair, inhand: b.inhand }; }, id);

/* 1 */
const R1 = await page.evaluate(({ bo }) => {
  const secs = [...document.querySelectorAll('.po-sec')].map(s => s.textContent.replace(/\s+/g, ' ').trim());
  const card = document.querySelector('.po-shipcard[data-bid="' + bo + '"]');
  return { secs, card: card ? card.textContent.replace(/\s+/g, ' ') : null };
}, P);
if (R1.secs.some(t => /^3 ของประจำเรือ/.test(t)) && R1.secs.some(t => /^4 วงจรผ้าเช็ดตัว/.test(t)) && R1.card && /15 ชิ้น/.test(R1.card) && R1.card.includes('10') && R1.card.includes('5'))
  ok('1 ส่วน "ของประจำเรือ" · การ์ด ' + P.boNm + ' · ' + R1.card.slice(0, 80));
else fail('1 ' + JSON.stringify(R1));

/* 2 + 3 */
const R2 = await page.evaluate(({ A, B, bo }) => {
  const st = () => document.getElementById('pserr').textContent, n0 = PIER_MOVES.length, set = (id, v) => { document.getElementById(id).value = v; };
  poShipBoatOpen(bo);
  set('psc_' + A, '8'); poShipBoatDiff(bo, A);
  const live = document.getElementById('psd_' + A).textContent, selOn = !document.getElementById('psr_' + A).disabled;
  poShipBoatSave(bo); const e1 = st();
  document.getElementById('psr_' + A).value = 'ship_lost'; poShipBoatSave(bo); const e2 = st();
  set('psc_' + A, '11'); poShipBoatSave(bo); const e3 = st(); set('psc_' + A, '8');
  set('psa_' + B, '99999'); poShipBoatSave(bo); const e4 = st(); set('psa_' + B, '');
  set('psb_' + B, '6'); poShipBoatSave(bo); const e5 = st(); set('psb_' + B, '');
  return { live, selOn, e1, e2, e3, e4, e5, same: PIER_MOVES.length === n0 };
}, P);
if (R2.live === 'ขาด 2' && R2.selOn && /เลือกว่าขาดเพราะอะไร/.test(R2.e1) && /ใส่รายละเอียด/.test(R2.e2) && /มากกว่าในระบบ/.test(R2.e3) && /คลังพร้อมใช้มีแค่/.test(R2.e4) && /ถอดคืนได้ไม่เกิน 5/.test(R2.e5) && R2.same)
  ok('2-3 ขาดต้องมีเหตุผล+รายละเอียด · นับเกิน/เติมเกินคลัง/ถอดเกิน ไม่ให้บันทึก · ยังไม่มีอะไรถูกบันทึก');
else fail('2-3 ' + JSON.stringify(R2));

/* 4 */
const R4 = await page.evaluate(({ A, B, bo }) => {
  const set = (id, v) => { document.getElementById(id).value = v; };
  set('psn', 'ตรวจเรือเช้านี้ ท่อหาย 2'); set('psa_' + B, '3'); set('psb_' + B, '1');
  const r = poShipBoatSave(bo);
  const mv = PIER_MOVES.filter(m => m.boatId === bo && /^(ship_|assign|unassign)/.test(m.type)).slice(-3).map(m => ({ t: m.type, i: m.itemId, q: m.qty, n: m.note }));
  return { r, mv, modal: !!document.getElementById('po-modal') };
}, P);
const a4 = await S(P.A), b4 = await S(P.B);
if (R4.r && !R4.modal && R4.mv.length === 3 && R4.mv[0].t === 'ship_lost' && R4.mv[0].q === 2 && R4.mv[0].n === 'ตรวจเรือเช้านี้ ท่อหาย 2 · นับบนเรือได้ 8 (ระบบ 10)'
    && a4.onship === P.a0.onship - 2 && a4.gone === P.a0.gone + 2 && a4.ready === P.a0.ready && a4.inhand === P.a0.inhand - 2
    && b4.onship === P.b0.onship + 2 && b4.ready === P.b0.ready - 2)
  ok(`4 ขาด 2 หักจากกองประจำเรือ (${P.a0.onship}→${a4.onship}) หายสะสม +2 พร้อมใช้ไม่ขยับ · เติม 3 ถอด 1 → ประจำเรือ ${P.b0.onship}→${b4.onship} คลัง ${P.b0.ready}→${b4.ready}`);
else fail('4 ' + JSON.stringify({ R4, a4, b4, P }));

/* 5 */
const R5 = await page.evaluate(({ bo }) => {
  const sum = poBoatSum(_poDate, bo, _poPier); const miss = Object.values(sum).reduce((s, o) => s + o.lost + o.wo + o.rep + o.iss, 0);
  const d = new Date(_poDate + 'T12:00:00'); d.setDate(d.getDate() + 1);
  const carry = poCarryTot(poYMD(d), bo);
  poLedgerOpen(); const m = document.getElementById('po-modal'), txt = m.textContent;
  const out = { miss, carry, nofine: /ยังไม่ได้ตั้งค่าปรับ/.test(txt), notBack: (m.innerHTML.match(/ยังไม่ได้คืน/g) || []).length };
  poModalClose(); return out;
}, P);
if (R5.miss === 0 && R5.carry === 0 && !R5.nofine) ok('5 ไม่ปนกับเบิก–คืนรายวัน · ใบรายลำวันนั้นว่าง · ไม่มีของค้างทวงพรุ่งนี้ · ไม่ขึ้นแถบค่าปรับ');
else fail('5 ' + JSON.stringify(R5));

/* 6 */
const R6 = await page.evaluate(({ A, bo }) => {
  poShipBoatOpen(bo); document.getElementById('psc_' + A).value = '7'; poShipBoatDiff(bo, A);
  document.getElementById('psr_' + A).value = 'ship_repair'; document.getElementById('psn').value = 'หน้ากากร้าว'; poShipBoatSave(bo);
  const b1 = poBal(A); poAdd({ date: _poDate, pier: _poPier, itemId: A, boatId: '', type: 'fixed', qty: 1 }); const b2 = poBal(A);
  return { rep1: b1.repair, ship1: b1.onship, ready1: b1.ready, rep2: b2.repair, ready2: b2.ready };
}, P);
if (R6.rep1 === P.a0.repair + 1 && R6.ship1 === P.a0.onship - 3 && R6.rep2 === P.a0.repair && R6.ready2 === R6.ready1 + 1)
  ok('6 เสีย·ส่งซ่อมจากเรือ → รอซ่อม +1 · ซ่อมเสร็จกลับเข้าคลัง (พร้อมใช้ +1)');
else fail('6 ' + JSON.stringify(R6));

/* 7 */
const R7 = await page.evaluate(({ C, bo2 }) => {
  poShipBoatPick(); const sel = document.getElementById('pspick'); sel.value = bo2;
  [...document.querySelectorAll('#po-modal button')].find(b => /ต่อไป/.test(b.textContent)).click();
  const hasAddRow = !!document.getElementById('psa_' + C) && !document.getElementById('psc_' + C);
  document.getElementById('psa_' + C).value = '4'; poShipBoatSave(bo2);
  const card = document.querySelector('.po-shipcard[data-bid="' + bo2 + '"]');
  return { hasAddRow, onship: poShipOn(bo2)[C], card: !!card };
}, P);
const c7 = await S(P.C);
if (R7.hasAddRow && R7.onship === 4 && R7.card && c7.ready === P.c0.ready - 4) ok('7 ลงของให้เรือลำใหม่ · ยกจากคลัง 4 · การ์ดลำนั้นขึ้นบนหน้าหลัก');
else fail('7 ' + JSON.stringify({ R7, c7 }));

/* 8 */
const R8 = await page.evaluate(({ bo, A }) => {
  poLedgerOpen(); poLdgFilter('ship');
  const m = document.getElementById('po-modal');
  const tags = [...m.querySelectorAll('table.po-t tbody tr')].map(r => r.children[2].textContent.trim());
  const box = [...m.querySelectorAll('div')].find(d => d.firstElementChild && /ของประจำเรือ · แยกตามลำ/.test(d.firstElementChild.textContent) && d.children.length > 1);
  const out = { tags, box: box ? box.textContent.replace(/\s+/g, ' ') : '', onA: poShipOn(bo)[A] };
  poModalClose(); return out;
}, P);
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e));
if (R8.tags.includes('หายบนเรือ') && R8.tags.includes('เสีย·ซ่อม (จากเรือ)') && R8.onA === 7 && R8.box.includes(P.boNm) && !e1.length)
  ok('8 ประวัติ · ป้าย หายบนเรือ / เสีย·ซ่อม (จากเรือ) · กล่องแยกตามลำหักส่วนที่ขาดแล้ว · ไม่มี error');
else fail('8 ' + JSON.stringify(R8) + ' ' + e1.slice(0, 3).join(' | '));

await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
