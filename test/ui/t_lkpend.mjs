// §lkPend · ล็อกที่นั่งแบบรอที่ว่าง (Pending)
//
// ที่มา (2026-10-02) · ผู้ใช้ตรวจแล้วพบว่า "ที่นั่งไม่ว่างแล้ว แต่ล็อกเพิ่มได้"
//   จริง · ไม่มีด่านไหนเช็คที่ว่างเลย ทั้งตอนสร้าง แก้จำนวน และกด "+ ที่นั่ง"
//   สิ่งที่ขอ · ที่ไม่ว่างยังรับคำขอได้ แต่เป็น Pending = ไม่กันที่นั่ง ดึงไปจองไม่ได้
//   พอมีที่ว่าง คนกดยืนยันเองจึงกลายเป็นล็อกจริง · ตอนสร้างให้เลือกเองว่าจะแบ่งหรือรอทั้งใบ
//
// กันสิบสี่อย่าง
//   1 ที่ว่างพอ · สร้างได้เลย ไม่มีกล่องถาม ไม่มี pending
//   2 ที่ว่างไม่พอ · ขึ้นกล่องถาม และยังไม่มีอะไรถูกสร้าง · กดยกเลิก = ไม่มีล็อก
//   3 เลือก "แบ่ง" · กันเท่าที่ว่าง ที่ขาดเป็น pending · ที่นั่งที่กันรวมไม่เกินความจุ
//   4 ส่วนที่ pending ดึงไปจองไม่ได้ · ดึงหมดส่วนที่กันไว้แล้วใบยังไม่ถูกปิด
//   5 ทริปเต็ม · กล่องถามเหลือทางเดียวคือ pending ทั้งจำนวน
//   6 กดยืนยันตอนยังเต็ม · ไม่ได้ และไม่มีอะไรเปลี่ยน
//   7 มีที่ว่างแล้วกดยืนยัน · ดันเข้าเท่าที่ว่าง · ไม่ดันเองถ้าไม่มีคนกด
//   8 หน้า Seat Locks · ป้าย Pending · "ยังไม่ว่าง" ตอนเต็ม · ปุ่ม "ยืนยัน N ที่" ตอนว่าง กดแล้วได้จริง
//   9 ใบงาน By trip · แถวล็อกที่รอทั้งใบยังขึ้น · ป้าย Pending บนแถวและบนแถบโปรแกรม · 🔒 ไม่นับส่วนที่รอ
//  10 กด "+ ที่นั่ง" เกินที่ว่าง · ถามก่อน · ส่วนที่ขาดเป็น pending
//  11 แก้ไขเฉพาะหมายเหตุของใบที่ pending อยู่ · ไม่โดนถามซ้ำ · แก้จำนวนขึ้น · ถาม
//  12 ล็อกแบบช่วง · pending เฉพาะรอบที่เต็ม เก็บแยกรายวัน
//  13 ลดจำนวน/ปล่อย · ตัดส่วนที่รอออกก่อน
//  15 (§lkPendSub) ใบที่รอทั้งใบ แบ่งกรุ๊ปย่อยได้ · กรุ๊ปนั้นยังเป็น Pending ดึงไม่ได้
//  16 ใบแม่ได้ที่มาบางส่วน · กรุ๊ปที่สร้างก่อนได้ก่อน
//  17 (§lkTone) สีของ Lock กับ Pending ต่างกัน · Lock เด่นกว่า
//  14 pendQty / pendBy รอดทางไป-กลับของเซิร์ฟเวอร์ และรีเฟรชแล้วยังอยู่ · ไม่มี error บนหน้า
import { open, goView } from './_harness.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);
const osRepo = _require(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../os-backend/src/mapping/os_repo.js'));

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1000 });
const dialogs = []; page.on('dialog', async d => { dialogs.push(d.message()); try { await d.accept(); } catch (_) {} });
await goView(page, 'booking', 900);

/* ══ 0 · ทริปในอนาคตที่มีเรือ · ชุดข้อมูลทดสอบเป็นวันที่ผ่านแล้วทั้งหมด จึงยกเรือของวันจริงมาวางวันข้างหน้า ══ */
const S = await page.evaluate(() => {
  if (typeof bkV2LockPendOn !== 'function') return { err: 'bkV2LockPendOn missing' };
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const t0 = new Date(); const fut = [5, 6, 7].map(n => { const d = new Date(t0); d.setDate(d.getDate() + n); return ymd(d); });
  let hit = null;
  for (const ds of Object.keys(TRIPS || {}).sort().reverse()) {
    const cells = {};
    for (const [bid, op] of Object.entries(TRIPS[ds] || {})) {
      if (!op || Array.isArray(op) || !op.route || op.type === 'charter' || op.charterBookingId) continue;
      cells[bid] = { route: op.route, type: op.type || 'normal' };
    }
    if (!Object.keys(cells).length) continue;
    TRIPS[fut[0]] = JSON.parse(JSON.stringify(cells));
    const rids = [...new Set(Object.values(cells).map(c => c.route))];
    const rid = rids.find(r => { const A = getAllotment(r, fut[0]); return A.hasAllotment && A.availableCapacity >= 12 && A.seatsConsumed === 0 && !A.lockedSeats; });
    if (rid) { hit = { rid, src: ds }; break; }
    delete TRIPS[fut[0]];
  }
  if (!hit) return { err: 'no route with boats could be placed on a future day' };
  const ags = (SB_AGENTS || []).filter(a => a && a.name).slice(0, 4);
  if (ags.length < 4) return { err: 'need 4 agents' };
  return { fut, rid: hit.rid, cap: getAllotment(hit.rid, fut[0]).availableCapacity, ags: ags.map(a => ({ id: a.id, name: a.name })),
           today: ymd(t0) };
});
if (S.err) { fail(S.err); await close(); process.exit(1); }
const D = S.fut[0];

/* กรอกฟอร์มล็อกแล้วกดสร้างผ่านทางจริง */
const submit = (o) => page.evaluate(p => {
  _bkV2LockForm = { scope: p.scope || 'day', routeId: p.rid, date: p.date || '', dateFrom: p.dateFrom || '', dateTo: p.dateTo || '', dow: [],
    monthFrom: '', monthTo: '', holderType: 'agent', holderId: '', holderName: p.agent, qty: String(p.qty), reason: p.reason || '',
    expiry: '', releaseDaysBefore: '', releaseTime: '' };
  bkV2LockCreateSubmit();
}, o);
const st = () => page.evaluate(p => {
  const A = getAllotment(p.rid, p.D);
  const lk = SB_SEAT_LOCKS.filter(l => l.routeId === p.rid && (l.reason || '').indexOf('t-lkpend') === 0).map(l => ({
    id: l.id, why: l.reason, qty: l.qty, st: l.status, pend: bkV2LockPendOn(l, p.D), held: bkV2LockHeldRemaining(l, p.D),
    used: bkV2LockUsedTotal(l, p.D), pq: l.pendQty || 0, pb: l.pendBy || null }));
  const ask = document.querySelector('.lkpend-ask');
  return { cap: A.availableCapacity, locked: A.lockedSeats, free: A.seatsAvailable, lk,
    ask: ask ? [...ask.querySelectorAll('button[data-lkpend]')].map(b => b.getAttribute('data-lkpend') + ':' + b.textContent.trim()) : null };
}, { rid: S.rid, D });
const by = (s, why) => s.lk.find(l => l.why === why);
const clickAsk = k => page.click(`.lkpend-ask button[data-lkpend="${k}"]`);

/* ══ 1 · ที่ว่างพอ ══ */
await submit({ rid: S.rid, date: D, agent: S.ags[0].name, qty: S.cap - 2, reason: 't-lkpend A' });
let s = await st();
if (!s.ask && by(s, 't-lkpend A') && by(s, 't-lkpend A').pend === 0 && s.locked === S.cap - 2 && s.free === 2)
  ok(`1 ที่ว่างพอ · ล็อก ${S.cap - 2} จาก ${S.cap} ที่ สร้างได้เลย ไม่มีกล่องถาม เหลือว่าง 2`);
else fail('1 ' + JSON.stringify(s));

/* ══ 2 · ไม่พอ → ถาม · ยกเลิก ══ */
await submit({ rid: S.rid, date: D, agent: S.ags[1].name, qty: 5, reason: 't-lkpend B' });
s = await st();
const ask2 = s.ask ? s.ask.join(' | ') : '';
const made2 = !!by(s, 't-lkpend B');
await clickAsk('cancel'); await page.waitForTimeout(150);
let s2 = await st();
if (s.ask && !made2 && /split:.*2.*3/.test(ask2) && /all:.*5/.test(ask2) && !s2.ask && !by(s2, 't-lkpend B') && s2.locked === S.cap - 2)
  ok('2 ขอ 5 ว่าง 2 · ขึ้นกล่องถาม (' + s.ask.length + ' ปุ่ม) ยังไม่สร้างอะไร · กดยกเลิก = ไม่มีล็อก');
else fail('2 ' + JSON.stringify({ ask: s.ask, made2, after: s2 }));

/* ══ 3 · แบ่ง ══ */
await submit({ rid: S.rid, date: D, agent: S.ags[1].name, qty: 5, reason: 't-lkpend B' });
await clickAsk('split'); await page.waitForTimeout(150);
s = await st(); let B = by(s, 't-lkpend B');
if (B && B.qty === 5 && B.pend === 3 && B.held === 2 && B.pq === 3 && s.locked === S.cap && s.free === 0)
  ok(`3 เลือกแบ่ง · ขอ 5 กันได้ 2 รอ 3 · ที่กันรวม ${s.locked} = ความจุ ${S.cap} พอดี ไม่เกิน`);
else fail('3 ' + JSON.stringify({ B, locked: s.locked, free: s.free, cap: S.cap }));

/* ══ 4 · ส่วนที่รอ ดึงไปจองไม่ได้ ══ */
const R4 = await page.evaluate(p => {
  const l = SB_SEAT_LOCKS.find(x => x.id === p.id);
  const src = bkV2DrawSources(p.rid, p.D, l.holderId).filter(x => x.lockId === l.id).map(x => x.remaining);
  const drew = bkV2DrawLock(l.id, 5, 'bk-test', p.D);
  const after = { st: l.status, pend: bkV2LockPendOn(l, p.D), held: bkV2LockHeldRemaining(l, p.D), listed: bkV2LocksFor(p.rid, p.D).indexOf(l) >= 0 };
  bkV2ReturnLock(l.id, drew, 'bk-test', p.D, 'test');
  return { src, drew, after, heldBack: bkV2LockHeldRemaining(l, p.D), pendBack: bkV2LockPendOn(l, p.D) };
}, { id: B.id, rid: S.rid, D });
if (R4.src.join() === '2' && R4.drew === 2 && R4.after.st === 'active' && R4.after.pend === 3 && R4.after.listed && R4.heldBack === 2 && R4.pendBack === 3)
  ok('4 ดึงได้แค่ 2 ที่ที่กันไว้จริง (ขอดึง 5) · ดึงหมดแล้วใบยัง active เพราะยังรออยู่ 3');
else fail('4 ' + JSON.stringify(R4));

/* ══ 5 · ทริปเต็ม ══ */
await submit({ rid: S.rid, date: D, agent: S.ags[2].name, qty: 4, reason: 't-lkpend C' });
s = await st(); const ask5 = s.ask || [];
await clickAsk('split'); await page.waitForTimeout(150);
s = await st(); let C = by(s, 't-lkpend C');
if (ask5.length === 2 && !ask5.some(x => x.indexOf('all:') === 0) && /Pending.*4/.test(ask5[0]) && C && C.pend === 4 && C.held === 0 && s.locked === S.cap)
  ok('5 ทริปเต็ม · กล่องถามเหลือ "Pending ทั้ง 4 ที่" กับยกเลิก · ได้ใบที่รอทั้งใบ ไม่กันที่นั่งเพิ่ม');
else fail('5 ' + JSON.stringify({ ask5, C, locked: s.locked }));

/* ══ 6 · ยืนยันตอนเต็ม ══ */
const R6 = await page.evaluate(p => { const r = bkV2LockPendConfirm(p.id, p.D); const l = SB_SEAT_LOCKS.find(x => x.id === p.id);
  return { r, pend: bkV2LockPendOn(l, p.D) }; }, { id: C.id, D });
if (!R6.r.ok && R6.r.why === 'full' && R6.pend === 4) ok('6 กดยืนยันตอนยังเต็ม · ไม่ได้ ใบยังรอ 4 ที่เหมือนเดิม');
else fail('6 ' + JSON.stringify(R6));

/* ══ 7 · มีที่ว่าง → ยืนยัน ══ */
const A = by(s, 't-lkpend A');
const R7 = await page.evaluate(p => {
  bkV2ReleaseLock(p.A, 3);                               /* A คืน 3 ที่ → ว่าง 3 */
  const b = SB_SEAT_LOCKS.find(x => x.id === p.B), c = SB_SEAT_LOCKS.find(x => x.id === p.C);
  const before = { free: getAllotment(p.rid, p.D).seatsAvailable, bPend: bkV2LockPendOn(b, p.D), cPend: bkV2LockPendOn(c, p.D) };
  const r = bkV2LockPendConfirm(p.B, p.D);
  const al = getAllotment(p.rid, p.D);
  return { before, r, bPend: bkV2LockPendOn(b, p.D), bHeld: bkV2LockHeldRemaining(b, p.D), free: al.seatsAvailable, locked: al.lockedSeats,
    log: (b.log || []).map(e => e.type).join(',') };
}, { A: A.id, B: B.id, C: C.id, rid: S.rid, D });
if (R7.before.free === 3 && R7.before.bPend === 3 && R7.before.cPend === 4 && R7.r.ok && R7.r.n === 3 && R7.bPend === 0 && R7.bHeld === 5
    && R7.free === 0 && R7.locked === S.cap && /pend/.test(R7.log) && /pend-confirm/.test(R7.log))
  ok('7 ที่ว่าง 3 · ไม่มีใบไหนถูกดันเอง · กดยืนยันใบ B แล้วได้ครบ 3 ที่ · บันทึกลงประวัติ');
else fail('7 ' + JSON.stringify(R7));

/* ══ 8 · หน้า Seat Locks ══ */
const dayOff = Math.round((new Date(D + 'T00:00:00') - new Date(S.today + 'T00:00:00')) / 864e5);
const view8 = () => page.evaluate(p => {
  _bkV2LockUI.dayOff = p.dayOff; _bkV2LockUI.route = ''; _bkV2LockUI.q = ''; bkV2SwitchTab('locks');
  const tag = document.querySelector('[data-lkpend-tag="' + p.C + '"]'), go = document.querySelector('[data-lkpend-go="' + p.C + '"]');
  const row = tag ? tag.closest('tr') : null;
  return { tag: tag ? tag.textContent.trim() : '', go: go ? go.textContent.trim() : '', rowTxt: row ? row.textContent.replace(/\s+/g, ' ') : '',
    listTag: !!document.querySelector('[data-lkpend-list="' + p.C + '"]') };
}, { dayOff, C: C.id });
const v8a = await view8();
await page.evaluate(p => { bkV2ReleaseLock(p.A, 2); }, { A: A.id });      /* ว่างอีก 2 */
const v8b = await view8();
await page.click(`[data-lkpend-go="${C.id}"]`); await page.waitForTimeout(200);
const v8c = await view8();
s = await st(); C = by(s, 't-lkpend C');
if (/Pending 4/.test(v8a.tag) && !v8a.go && /ยังไม่ว่าง/.test(v8a.rowTxt) && v8a.listTag
    && /ยืนยัน 2/.test(v8b.go) && /Pending 2/.test(v8c.tag) && !v8c.go && C.pend === 2 && C.held === 2 && s.free === 0 && s.locked === S.cap)
  ok('8 Seat Locks · ป้าย "Pending 4" + "ยังไม่ว่าง" ตอนเต็ม · ว่าง 2 แล้วมีปุ่ม "ยืนยัน 2 ที่" · กดแล้วเหลือ Pending 2');
else fail('8 ' + JSON.stringify({ v8a, v8b, v8c, C, free: s.free, locked: s.locked }));

/* ══ 9 · ใบงาน By trip ══ */
const R9 = await page.evaluate(async p => {
  /* ใบ D รอทั้งใบ · ต้องยังขึ้นแถว */
  const ag = p.ag;
  _bkV2LockForm = { scope: 'day', routeId: p.rid, date: p.D, dateFrom: '', dateTo: '', dow: [], monthFrom: '', monthTo: '', holderType: 'agent',
    holderId: '', holderName: ag, qty: '6', reason: 't-lkpend D', expiry: '', releaseDaysBefore: '', releaseTime: '' };
  bkV2LockCreateSubmit();
  const b = document.querySelector('.lkpend-ask button[data-lkpend="split"]'); if (b) b.click();
  _bkV2.filterDate = p.D; _bkV2.filterRoute = null; bkV2SwitchTab('bytrip');
  await new Promise(r => setTimeout(r, 900));
  const d = SB_SEAT_LOCKS.find(l => l.reason === 't-lkpend D');
  const rowD = d ? document.querySelector('tr.t2-lrow[data-lk="' + d.id + '"]') : null;
  const rowC = document.querySelector('tr.t2-lrow[data-lk="' + p.C + '"]');
  const band = rowD ? rowD.closest('table').querySelector('tr.t2-pband') : null;
  const txt = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
  return { dPend: d ? bkV2LockPendOn(d, p.D) : -1, dHeld: d ? bkV2LockHeldRemaining(d, p.D) : -1,
    rowD: !!rowD, rowDcls: rowD ? rowD.className : '', rowDq: rowD ? txt(rowD.querySelector('.lkq')) : '', rowDpd: rowD ? txt(rowD.querySelector('.lkpd')) : '',
    rowDgo: rowD ? !!rowD.querySelector('.lkpdgo') : null, rowCpd: rowC ? txt(rowC.querySelector('.lkpd')) : '', rowCq: rowC ? txt(rowC.querySelector('.lkq')) : '',
    bandLk: band ? txt(band.querySelector('.plk:not(.ppd)')) : '', bandPd: band ? txt(band.querySelector('.ppd')) : '',
    locked: getAllotment(p.rid, p.D).lockedSeats };
}, { rid: S.rid, D, C: C.id, ag: S.ags[3].name });
if (R9.dPend === 6 && R9.dHeld === 0 && R9.rowD && /t2-lpend/.test(R9.rowDcls) && R9.rowDq === '0' && /Pending 6/.test(R9.rowDpd) && R9.rowDgo === false
    && /Pending 2/.test(R9.rowCpd) && R9.rowCq === '2' && /Pending 8/.test(R9.bandPd) && R9.bandLk.replace(/\D/g, '') === String(R9.locked) && R9.locked === S.cap)
  ok(`9 By trip · ใบที่รอทั้งใบยังขึ้นแถว (0 ที่ · Pending 6) · แถบโปรแกรม 🔒 ${R9.locked} กับ Pending 8 แยกกัน`);
else fail('9 ' + JSON.stringify(R9));

/* ══ 10 · + ที่นั่ง ══ */
const R10 = await page.evaluate(async p => {
  bkV2SwitchTab('locks');
  bkV2LockAddOpen(p.A); bkV2LockAddSet('add', '7'); bkV2LockAddSet('note', 'more');
  const a = SB_SEAT_LOCKS.find(x => x.id === p.A), q0 = a.qty;
  bkV2LockAddSubmit();
  const ask = document.querySelector('.lkpend-ask');
  const btns = ask ? [...ask.querySelectorAll('button[data-lkpend]')].map(b => b.getAttribute('data-lkpend')) : [];
  const qMid = a.qty;
  const b = ask && ask.querySelector('button[data-lkpend="split"]'); if (b) b.click();
  return { q0, qMid, q1: a.qty, pend: bkV2LockPendOn(a, p.D), btns, locked: getAllotment(p.rid, p.D).lockedSeats, addOpen: !!_bkV2AddModal };
}, { A: A.id, rid: S.rid, D });
if (R10.btns.join() === 'split,cancel' && R10.qMid === R10.q0 && R10.q1 === R10.q0 + 7 && R10.pend === 7 && R10.locked === S.cap && !R10.addOpen)
  ok('10 กด "+ ที่นั่ง" 7 ที่ตอนเต็ม · ถามก่อน (ยังไม่เพิ่ม) · ยืนยันแล้วทั้ง 7 เป็น Pending ที่กันรวมไม่เกินความจุ');
else fail('10 ' + JSON.stringify(R10));

/* ══ 11 · แก้ไข ══ */
const R11 = await page.evaluate(async p => {
  const c = SB_SEAT_LOCKS.find(x => x.id === p.C);
  bkV2LockEditOpen(p.C); _bkV2LockForm.reason = 't-lkpend C'; _bkV2LockForm.expiry = '';
  _bkV2LockForm.reason = 't-lkpend C edited';
  bkV2LockEditSubmit();
  const askNote = !!document.querySelector('.lkpend-ask'), noteSaved = c.reason === 't-lkpend C edited', pendNote = bkV2LockPendOn(c, p.D);
  c.reason = 't-lkpend C';
  bkV2LockEditOpen(p.C); _bkV2LockForm.qty = String(c.qty + 3);
  const q0 = c.qty; bkV2LockEditSubmit();
  const ask = document.querySelector('.lkpend-ask'); const qMid = c.qty;
  const b = ask && ask.querySelector('button[data-lkpend="split"]'); if (b) b.click();
  return { askNote, noteSaved, pendNote, asked: !!ask, q0, qMid, q1: c.qty, pend: bkV2LockPendOn(c, p.D), held: bkV2LockHeldRemaining(c, p.D),
    locked: getAllotment(p.rid, p.D).lockedSeats };
}, { C: C.id, rid: S.rid, D });
if (!R11.askNote && R11.noteSaved && R11.pendNote === 2 && R11.asked && R11.qMid === R11.q0 && R11.q1 === R11.q0 + 3 && R11.pend === 5 && R11.held === 2 && R11.locked === S.cap)
  ok('11 แก้หมายเหตุของใบที่รออยู่ · ไม่โดนถาม pending เท่าเดิม · เพิ่มจำนวน 3 ที่ · ถาม แล้วส่วนเพิ่มเป็น Pending');
else fail('11 ' + JSON.stringify(R11));

/* ══ 12 · ล็อกแบบช่วง ══ */
const R12 = await page.evaluate(async p => {
  /* วันที่สองของช่วง · มีเรือและยังว่างทั้งลำ */
  TRIPS[p.fut[1]] = JSON.parse(JSON.stringify(TRIPS[p.fut[0]]));
  const cap2 = getAllotment(p.rid, p.fut[1]).availableCapacity;
  _bkV2LockForm = { scope: 'bulk', routeId: p.rid, date: '', dateFrom: p.fut[0], dateTo: p.fut[1], dow: [], monthFrom: '', monthTo: '', holderType: 'agent',
    holderId: '', holderName: p.ag, qty: '3', reason: 't-lkpend BULK', expiry: '', releaseDaysBefore: '', releaseTime: '' };
  bkV2LockCreateSubmit();
  const ask = document.querySelector('.lkpend-ask');
  const rows = ask ? [ask.textContent.replace(/\s+/g, ' ')] : [];
  const b = ask && ask.querySelector('button[data-lkpend="split"]'); if (b) b.click();
  const l = SB_SEAT_LOCKS.find(x => x.reason === 't-lkpend BULK');
  return { asked: !!ask, rows, made: !!l, pb: l ? l.pendBy : null, pq: l ? (l.pendQty || 0) : -1,
    p0: l ? bkV2LockPendOn(l, p.fut[0]) : -1, h0: l ? bkV2LockHeldRemaining(l, p.fut[0]) : -1,
    p1: l ? bkV2LockPendOn(l, p.fut[1]) : -1, h1: l ? bkV2LockHeldRemaining(l, p.fut[1]) : -1,
    lk0: getAllotment(p.rid, p.fut[0]).lockedSeats, lk1: getAllotment(p.rid, p.fut[1]).lockedSeats, cap2,
    dates: l ? bkV2LockPendDates(l).map(x => x.date + ':' + x.n).join() : '' };
}, { rid: S.rid, fut: S.fut, ag: S.ags[0].name });
if (R12.asked && R12.rows.length === 1 && R12.rows[0].indexOf(D) >= 0 && R12.rows[0].indexOf(S.fut[1]) < 0 && R12.made && R12.pq === 0 && R12.p0 === 3 && R12.h0 === 0 && R12.p1 === 0 && R12.h1 === 3
    && R12.lk0 === S.cap && R12.lk1 === 3 && R12.dates === D + ':3')
  ok('12 ล็อกแบบช่วง 2 รอบ · รอบที่เต็ม Pending 3 · รอบที่ว่างกันได้ 3 ตามปกติ · เก็บแยกรายวัน');
else fail('12 ' + JSON.stringify(R12));

/* ══ 13 · ลดจำนวน ══ */
const R13 = await page.evaluate(p => {
  const a = SB_SEAT_LOCKS.find(x => x.id === p.A);
  const b0 = { qty: a.qty, pend: bkV2LockPendOn(a, p.D), held: bkV2LockHeldRemaining(a, p.D) };
  bkV2ReleaseLock(p.A, 4);
  const b1 = { qty: a.qty, pend: bkV2LockPendOn(a, p.D), held: bkV2LockHeldRemaining(a, p.D) };
  return { b0, b1 };
}, { A: A.id, D });
if (R13.b0.pend === 7 && R13.b1.qty === R13.b0.qty - 4 && R13.b1.pend === 3 && R13.b1.held === R13.b0.held)
  ok('13 คืน 4 ที่จากใบที่รออยู่ 7 · ตัดส่วนที่รอออกก่อน (เหลือรอ 3) ที่นั่งที่กันไว้จริงไม่ถูกแตะ');
else fail('13 ' + JSON.stringify(R13));

/* ══ 15 · §lkPendSub · ใบที่รอทั้งใบ แบ่งกรุ๊ปย่อยได้ ══ */
const nDlg15 = dialogs.length;
const R15 = await page.evaluate(p => {
  const d = SB_SEAT_LOCKS.find(l => l.reason === 't-lkpend D');
  const lk0 = getAllotment(p.rid, p.D).lockedSeats;
  const g1 = bkV2CreateSubLock(d.id, 'G1', 4);
  if (!g1) return { made: false };
  const src = bkV2DrawSources(p.rid, p.D, d.holderId).filter(x => x.lockId === g1.id || x.lockId === d.id);
  return { made: true, id: d.id, g1: g1.id, room: bkV2LockSubRoom(d), draw: bkV2LockDrawable(g1, p.D), subPend: bkV2LockSubPend(g1, p.D),
    drew: bkV2DrawLock(g1.id, 2, 'bk-x', p.D), parentPend: bkV2LockPendOn(d, p.D), src: src.length,
    lk0, lk1: getAllotment(p.rid, p.D).lockedSeats };
}, { rid: S.rid, D });
if (R15.made && dialogs.length === nDlg15 && R15.room === 2 && R15.draw === 0 && R15.subPend === 4 && R15.drew === 0 && R15.parentPend === 6 && R15.src === 0 && R15.lk1 === R15.lk0)
  ok('15 ใบที่ Pending ทั้ง 6 ที่ แบ่งกรุ๊ปย่อย G1 4 ที่ได้ · กรุ๊ปยังเป็น Pending 4 ดึงไปจองไม่ได้ ไม่กันที่นั่งเพิ่ม');
else fail('15 ' + JSON.stringify({ R15, dlg: dialogs.slice(nDlg15) }));

/* ══ 16 · ได้ที่มาบางส่วน · กรุ๊ปที่สร้างก่อนได้ก่อน ══ */
const R16 = await page.evaluate(p => {
  const d = SB_SEAT_LOCKS.find(l => l.reason === 't-lkpend D'), b = SB_SEAT_LOCKS.find(l => l.reason === 't-lkpend B');
  bkV2ReleaseLock(b.id, 3);                                   /* ใบ B คืน 3 ที่ → ว่าง 3 */
  const free = getAllotment(p.rid, p.D).seatsAvailable;
  const c = bkV2LockPendConfirm(d.id, p.D);
  const g2 = bkV2CreateSubLock(d.id, 'G2', 2);
  const g1 = SB_SEAT_LOCKS.find(l => l.id === p.g1);
  const a = { g1Draw: bkV2LockDrawable(g1, p.D), g1Pend: bkV2LockSubPend(g1, p.D), g2Draw: g2 ? bkV2LockDrawable(g2, p.D) : -1, g2Pend: g2 ? bkV2LockSubPend(g2, p.D) : -1 };
  const drewG2 = g2 ? bkV2DrawLock(g2.id, 2, 'bk-y', p.D) : -1;
  const drewG1 = bkV2DrawLock(g1.id, 4, 'bk-z', p.D);
  const al = getAllotment(p.rid, p.D);
  return { free, c, a, drewG2, drewG1, g1Left: bkV2LockRemaining(g1, p.D), g1PendAfter: bkV2LockSubPend(g1, p.D), dPend: bkV2LockPendOn(d, p.D),
    dHeld: bkV2LockHeldRemaining(d, p.D), over: (al.seatsConsumed + al.lockedSeats) > al.availableCapacity, st: d.status };
}, { rid: S.rid, D, g1: R15.g1 });
if (R16.free === 3 && R16.c.ok && R16.c.n === 3 && R16.a.g1Draw === 3 && R16.a.g1Pend === 1 && R16.a.g2Draw === 0 && R16.a.g2Pend === 2
    && R16.drewG2 === 0 && R16.drewG1 === 3 && R16.g1Left === 1 && R16.g1PendAfter === 1 && R16.dPend === 3 && R16.dHeld === 0 && R16.st === 'active')
  ok('16 ใบแม่ได้ที่ 3 จาก 6 · G1 (สร้างก่อน) ดึงได้ 3 ยังรอ 1 · G2 (สร้างทีหลัง) ยังรอทั้ง 2 ดึงไม่ได้');
else fail('16 ' + JSON.stringify(R16));

/* ══ 17 · §lkTone · สีของ Lock กับ Pending ต่างกัน และ Lock เด่นกว่า ══ */
const R17 = await page.evaluate(async p => {
  _bkV2.filterDate = p.D; _bkV2.filterRoute = null; bkV2SwitchTab('bytrip'); await new Promise(z => setTimeout(z, 800));
  const lum = c => { const m = String(c).match(/\d+(\.\d+)?/g) || [0, 0, 0]; return Math.round(0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]); };
  const cs = (e, k) => e ? getComputedStyle(e)[k] : '';
  const rows = [...document.querySelectorAll('tr.t2-lrow')];
  const lockRow = rows.find(r => !r.classList.contains('t2-lpend')), pendRow = rows.find(r => r.classList.contains('t2-lpend'));
  const band = lockRow ? lockRow.closest('table').querySelector('tr.t2-pband') : null;
  const hold = lockRow && lockRow.querySelector('.lkhold'), pdh = pendRow && pendRow.querySelector('.lkhold.lkpdh');
  const bLk = band && band.querySelector('.plk:not(.ppd)'), bPd = band && band.querySelector('.plk.ppd');
  const kid = pendRow ? null : null;
  const dRow = document.querySelector('tr.t2-lrow[data-lk="' + p.d + '"]');
  return { has: !!(lockRow && pendRow && hold && pdh && bLk && bPd),
    holdBg: cs(hold, 'backgroundColor'), pdhBg: cs(pdh, 'backgroundColor'), holdLum: lum(cs(hold, 'backgroundColor')), pdhLum: lum(cs(pdh, 'backgroundColor')),
    pdhBorder: cs(pdh, 'borderTopStyle'), holdBorder: cs(hold, 'borderTopStyle'),
    rowLk: cs(lockRow && lockRow.children[3], 'backgroundColor'), rowPd: cs(pendRow && pendRow.children[3], 'backgroundColor'),
    bLkLum: lum(cs(bLk, 'backgroundColor')), bPdLum: lum(cs(bPd, 'backgroundColor')), bPdBorder: cs(bPd, 'borderTopStyle'),
    kid: dRow ? ((dRow.querySelector('.lkkid') || {}).textContent || '').replace(/\s+/g, ' ').trim() : '',
    kidTip: dRow ? ((dRow.querySelector('.lkkid') || {}).title || '') : '' };
}, { D, d: R15.id });
if (R17.has && R17.holdBg !== R17.pdhBg && R17.holdLum < 90 && R17.pdhLum > 200 && R17.pdhBorder === 'dashed' && R17.holdBorder === 'solid'
    && R17.rowLk !== R17.rowPd && R17.bLkLum < 90 && R17.bPdLum > 200 && R17.bPdBorder === 'dashed' && /2/.test(R17.kid) && /G2 2 \(Pending 2\)/.test(R17.kidTip))
  ok('17 ป้ายล็อกจริงเป็นสีทึบเข้ม · ป้าย Pending เป็นเทาเส้นประ · พื้นแถวคนละสี · กรุ๊ปย่อยที่รออยู่บอกในแถว (' + R17.kid + ')');
else fail('17 ' + JSON.stringify(R17));

/* ══ 14 · ทางไป-กลับของเซิร์ฟเวอร์ · รีเฟรช ══ */
const SRV = await page.evaluate(() => {
  const DD = JSON.parse(localStorage.getItem('loveandaman_v2') || '{}');
  return { sb_seat_locks: (DD.sb_seat_locks || []).filter(l => (l.reason || '').indexOf('t-lkpend') === 0) };
});
const BACK = osRepo.assembleBlob(osRepo.decomposeBlob(SRV));
const pick = arr => (arr || []).map(l => l.reason + '|' + (l.pendQty || 0) + '|' + JSON.stringify(l.pendBy && Object.keys(l.pendBy).length ? l.pendBy : {})).sort().join(' ; ');
const a14 = pick(SRV.sb_seat_locks), b14 = pick(BACK.sb_seat_locks);
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => typeof window.nav === 'function' && typeof bkV2LockPendOn === 'function', null, { timeout: 20000 });
await page.waitForTimeout(900);
const R14 = await page.evaluate(p => {
  const c = SB_SEAT_LOCKS.find(x => x.id === p.C), bl = SB_SEAT_LOCKS.find(x => x.reason === 't-lkpend BULK');
  return { c: c ? (c.pendQty || 0) : -1, bulk: bl ? JSON.stringify(bl.pendBy || {}) : '' };
}, { C: C.id });
const realErr = errors.filter(e => !/Failed to load resource/.test(e));
const nPend = SRV.sb_seat_locks.filter(l => (l.pendQty || 0) > 0 || (l.pendBy && Object.keys(l.pendBy).length)).length;
if (a14 === b14 && nPend >= 3 && R14.c === 5 && R14.bulk === JSON.stringify({ [D]: 3 }) && !realErr.length)
  ok(`14 pendQty / pendBy รอดทางไป-กลับของเซิร์ฟเวอร์ (${nPend} ใบ) · รีเฟรชแล้วยังอยู่ · ไม่มี error บนหน้า`);
else fail('14 ' + JSON.stringify({ same: a14 === b14, a14, b14, nPend, R14, errors: realErr.slice(0, 2) }));

await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
