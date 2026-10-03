// §bkLkPlaced · ล็อกเรือทั้งลำ · บอกว่าเรือวางไว้ที่เส้นทางไหน · ลำที่วางไว้โปรแกรมอื่นจับมาใช้ไม่ได้
//
// ที่มา (2026-10-03) · ผู้ใช้ส่งภาพฟอร์ม "ล็อกเรือทั้งลำ · ใบใหม่" (Similan Islands - PG · 15 ต.ค.)
//   "หน้าล็อกเรือ ต้องเตือนด้วยว่าเรือถูกวางไว้ในเส้นทางไหนแล้ว โปรแกรมนอกเหนือจะจับมาใช้ไม่ได้"
//   ของเดิม · เรือที่วางไว้เส้นทางอื่นแต่ยังไม่มีคนขาย ขึ้นว่า "ว่าง" เลือกได้
//   ล็อกแล้วช่องบนกระดาน Boat Operation ถูกเปลี่ยนเส้นทางเงียบ ๆ เรือหายจากโปรแกรมที่วางไว้
//
// กันแปดอย่าง
//   1 เรือที่วางไว้เส้นทางอื่น · ในฟอร์มเลือกไม่ได้ · บอกชื่อเส้นทางที่วางไว้
//   2 เลือกเส้นทางเดียวกับที่วาง · ลำเดียวกันเลือกได้ · บอกว่า "ว่าง · วางไว้ที่ <เส้นทาง>"
//   3 เรือที่ยังไม่ได้วางที่ไหน · เลือกได้ · บอกว่ายังไม่ได้วางเส้นทาง
//   4 เรียกตัวสร้างล็อกตรง ๆ ให้เส้นทางอื่น · ไม่สร้าง · ช่องบนกระดานยังเป็นเส้นทางเดิม ไม่ถูกแตะ
//   5 กดบันทึกจากฟอร์ม (ข้ามการเลือกในรายการ) · ขึ้นเตือนชื่อเส้นทางที่วางไว้ · ไม่สร้าง
//   6 ล็อกให้เส้นทางเดียวกับที่วาง · สร้างได้ตามปกติ
//   7 สลับลำของใบ "1 ลำ" ไปลำที่วางไว้เส้นทางอื่น · ไม่ได้
//   8 ไม่มี error บนหน้า
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1100 });
const dlg = [];
page.on('dialog', async d => { dlg.push({ type: d.type(), msg: d.message() }); try { await d.accept(); } catch (_) {} });
await goView(page, 'booking', 900);

/* หา: วัน D · ลำ B วางไว้เส้นทาง A (ยังไม่มีคนขาย ล็อกได้ตามกติกาเดิม) · เส้นทาง X ท่าเดียวกัน คนละเส้นทาง · ลำ F ที่ยังไม่ได้วาง */
const S = await page.evaluate(() => {
  const nm = rid => (ROUTES.find(r => r.id === rid) || {}).name || rid;
  for (const ds of Object.keys(TRIPS || {}).sort()) {
    for (const [bid, op] of Object.entries(TRIPS[ds] || {})) {
      if (!op || Array.isArray(op) || !op.route || opLocked(op) || op.type === 'charter' || (op.booked || 0) > 0) continue;
      if (!bkV2BoatLockCanTake(ds, bid, op.route)) continue;
      const A = ROUTES.find(r => r.id === op.route); if (!A || laIsLandRoute(A.id)) continue;
      const X = ROUTES.find(r => r.id !== A.id && !laIsLandRoute(r.id) && (r.pier || '') === (A.pier || ''));
      if (!X) continue;
      /* ถ้าไม่มีด่านใหม่ ลำนี้ต้อง "ล็อกให้ X ได้" ตามกติกาเดิม · ไม่งั้นข้อ 1/4 พิสูจน์อะไรไม่ได้ */
      const B0 = bkV2BoatLockBlockers(ds, bid, X.id);
      if (B0.charterOf || B0.holdOf || B0.pax > 0 || B0.cellBooked > 0 || B0.short > 0) continue;
      const list = bkV2BoatLockPickList(ds, X.id, null);
      const free = list.find(b => b.ok && !b.placed && b.id !== bid);
      const cap = bkV2BoatCapOn(bid, ds); if (cap <= 0) continue;
      return { date: ds, boat: bid, boatNm: bkV2BoatNameOf(bid), A: A.id, ANm: nm(A.id), X: X.id, XNm: nm(X.id), cap, free: free ? free.id : '', freeNm: free ? free.name : '' };
    }
  }
  return { err: 'no boat placed on a route with a sibling route on the same pier' };
});
if (S.err) { fail('setup · ' + S.err); await close(); process.exit(1); }
const cell = () => page.evaluate(s => { const op = TRIPS[s.date][s.boat]; return { route: op.route, type: op.type, lock: op.boatLockId || '' }; }, S);
const cell0 = await cell();

/* ══ 1–3 · ฟอร์ม ══ */
const F = await page.evaluate(async s => {
  const read = () => [...document.querySelectorAll('[data-bklk-boat]')].map(r => ({ id: r.dataset.bklkBoat, ok: r.dataset.bklkOk === '1', other: r.dataset.bklkOther, txt: r.textContent.replace(/\s+/g, ' ').trim(), click: !!r.getAttribute('onclick') }));
  bkV2BoatLockOpen({ routeId: s.X, date: s.date }); await new Promise(z => setTimeout(z, 400));
  const onX = read();
  bkV2BoatLockSet('routeId', s.A); await new Promise(z => setTimeout(z, 300));
  const onA = read();
  bkV2BoatLockClose(); await new Promise(z => setTimeout(z, 200));
  return { onX, onA };
}, S);
const x1 = F.onX.find(b => b.id === S.boat), a2 = F.onA.find(b => b.id === S.boat), f3 = F.onX.find(b => b.id === S.free);
if (x1 && !x1.ok && !x1.click && x1.other === S.A && x1.txt.includes(S.ANm)) ok(`1 ฟอร์มเส้นทาง "${S.XNm}" · ${S.boatNm} เลือกไม่ได้ · "${x1.txt.slice(0, 90)}"`);
else fail('1 ' + JSON.stringify({ x1, S }));
if (a2 && a2.ok && a2.click && !a2.other && a2.txt.includes(S.ANm)) ok(`2 ฟอร์มเส้นทาง "${S.ANm}" · ${S.boatNm} เลือกได้ · "${a2.txt.slice(0, 80)}"`);
else fail('2 ' + JSON.stringify(a2));
if (!S.free) fail('3 setup · no unplaced boat on that pier in this data set');
else if (f3 && f3.ok && f3.click && !f3.other && !f3.txt.includes(S.ANm) && /ยังไม่ได้วางเส้นทาง|not placed/.test(f3.txt)) ok(`3 ${S.freeNm} ยังไม่ได้วางที่ไหน · เลือกได้ · "${f3.txt.slice(0, 70)}"`);
else fail('3 ' + JSON.stringify(f3));

/* ══ 4 · ตัวสร้างตรง ๆ ══ */
const r4 = await page.evaluate(s => { const n0 = bkV2BoatLocks().length;
  const l = bkV2CreateBoatLock({ routeId: s.X, date: s.date, boatId: s.boat, holderType: 'office', holderId: null, minCap: s.cap, fixed: true, expiry: s.date, reason: 't' });
  return { made: !!l, n: bkV2BoatLocks().length - n0 }; }, S);
const c4 = await cell();
if (!r4.made && r4.n === 0 && JSON.stringify(c4) === JSON.stringify(cell0)) ok(`4 สร้างล็อกให้ "${S.XNm}" ด้วยลำที่วางไว้ "${S.ANm}" · ไม่สร้าง · ช่องบนกระดานยังเป็นเส้นทางเดิม`);
else fail('4 ' + JSON.stringify({ r4, c4, cell0 }));

/* ══ 5 · กดบันทึกจากฟอร์ม ══ */
dlg.length = 0;
const r5 = await page.evaluate(async s => { const n0 = bkV2BoatLocks().length;
  bkV2BoatLockOpen({ routeId: s.X, date: s.date, boatId: s.boat, holderType: 'office', minCap: s.cap, capTouched: true, expiry: s.date, reason: 't' }); await new Promise(z => setTimeout(z, 300));
  bkV2BoatLockSubmit(); await new Promise(z => setTimeout(z, 300));
  const open = !!_bkBoatForm; bkV2BoatLockClose(); return { n: bkV2BoatLocks().length - n0, open }; }, S);
const m5 = dlg[0] || { msg: '' };
if (r5.n === 0 && r5.open && dlg.length === 1 && m5.msg.includes(S.ANm) && /another programme/.test(m5.msg) && !/[^\x00-\x7F]/.test(m5.msg.replace(S.ANm, ''))) ok('5 กดบันทึกจากฟอร์ม · เตือนชื่อเส้นทางที่วางไว้ · ไม่สร้าง ฟอร์มยังเปิดอยู่');
else fail('5 ' + JSON.stringify({ r5, dlg }));

/* ══ 6 · เส้นทางเดียวกับที่วาง ══ */
const r6 = await page.evaluate(s => { const l = bkV2CreateBoatLock({ routeId: s.A, date: s.date, boatId: s.boat, holderType: 'office', holderId: null, minCap: s.cap, fixed: true, expiry: s.date, reason: 't' });
  const op = TRIPS[s.date][s.boat]; const out = { made: !!l, route: op.route, type: op.type, lock: !!op.boatLockId };
  if (l) bkV2BoatLockRelease(l.id, 'test'); return out; }, S);
if (r6.made && r6.route === S.A && r6.type === 'charter' && r6.lock) ok('6 ล็อกให้เส้นทางเดียวกับที่วาง · สร้างได้ตามปกติ');
else fail('6 ' + JSON.stringify(r6));

/* ══ 7 · สลับลำ ══ */
if (!S.free) fail('7 setup · no unplaced boat');
else {
  const r7 = await page.evaluate(s => {
    const l = bkV2CreateBoatLock({ routeId: s.X, date: s.date, boatId: s.free, holderType: 'office', holderId: null, minCap: 1, fixed: false, expiry: s.date, reason: 't' });
    if (!l) return { err: 'could not hold the unplaced boat for X' };
    const sw = bkV2BoatLockSwap(l.id, s.boat), op = TRIPS[s.date][s.boat], cur = bkV2BoatLockById(l.id).boatId;
    bkV2BoatLockRelease(l.id, 'test');
    return { sw, route: op.route, lock: op.boatLockId || '', cur }; }, S);
  if (!r7.err && r7.sw === false && r7.route === S.A && !r7.lock && r7.cur === S.free) ok('7 สลับลำของใบ "1 ลำ" ไปลำที่วางไว้เส้นทางอื่น · ไม่ได้ · ช่องของลำนั้นไม่ถูกแตะ');
  else fail('7 ' + JSON.stringify(r7));
}
const e1 = errors.filter(e => !/Failed to load resource/.test(e));
if (!e1.length) ok('8 ไม่มี error บนหน้า'); else fail('8 ' + e1.slice(0, 3).join(' | '));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
