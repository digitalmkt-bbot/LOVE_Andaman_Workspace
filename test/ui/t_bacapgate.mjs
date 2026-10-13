// §baCapGate · เรือเต็มแล้วยังมีคนค้าง · ใส่เรือได้ต่อเมื่อ "ปลด" cap ของวันนั้นก่อน (ฉุกเฉินเท่านั้น)
//
// ที่มา (2026-10-03) · เคสจริง 4 ต.ค. Phi Phi Bamboo · Hermetis 65 ที่ · ลูกค้าจอย 69 คน (มาจากล็อกเกินของเดิม ก่อนมีตัวกัน)
//   ผู้ใช้ "รับบุคกิ้งลงแล้ว แต่ตอนนี้ใส่เรือไม่ได้" · ระบบบล็อกที่ cap+2 แล้วบอกแค่ว่าใส่ไม่ได้
//   ผู้ใช้เลือก: ยังบล็อกเหมือนเดิม แต่พาไปปรับ cap เฉพาะวันนั้น · "อยากให้ทำเฉพาะฉุกเฉินจริง ๆ ต้องปลดก่อนถึงจะทำได้"
//
// กันเจ็ดอย่าง
//   1 เรือเกิน cap+2 · ยังใส่ไม่ได้ · กล่องถามบอกว่าเป็นกรณีฉุกเฉิน · กด Cancel แล้วไม่มีอะไรเปลี่ยน ไม่มีหน้าต่างเปิด
//   2 กด OK · หน้าต่างปรับ cap ของเรือลำนั้นวันนั้นเปิด · ตัวเลขใส่ให้เท่าที่ต้องใช้พอดี (ไม่เปิดที่ขายเพิ่ม)
//   3 ไม่ใส่เหตุผล · บันทึกไม่ได้ · ยังไม่ได้ลงเรือ
//   4 ใส่เหตุผลแล้วบันทึก · cap วันนั้นถูกบันทึกพร้อมเหตุผลและชื่อคนปรับ · ใบจองลงเรือให้เอง
//   5 วันอื่น cap ของเรือลำเดียวกันยังเท่าปกติ
//   6 เกินที่นั่งจดทะเบียน · ไม่มีทางปลด · ไม่ถาม ไม่เปิดหน้าต่าง · ยังไม่ได้ลงเรือ
//   7 ไม่มี error บนหน้า
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1000 });
const dlg = []; let answer = true;
page.on('dialog', async d => { dlg.push({ type: d.type(), msg: d.message() }); try { if (d.type() === 'confirm' && !answer) await d.dismiss(); else await d.accept(); } catch (_) {} });
await goView(page, 'booking', 900);

const S = await page.evaluate(async () => {
  const per = {};
  (SB_BOOKINGS || []).forEach(b => { if (['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)) return;
    (b.trips || []).forEach(t => { if (t && t.date) per[t.date] = (per[t.date] || 0) + 1; }); });
  const day = Object.keys(per).sort((a, b) => per[b] - per[a])[0];
  _bkV2.filterDate = day; _bkV2.filterRoute = null; _bkV2.boatAssignMode = true; bkV2SwitchTab('bytrip'); await new Promise(z => setTimeout(z, 700));
  /* เรือที่มีลูกค้าจอยลงอยู่หลายใบ (ไม่ใช่เหมาลำ ไม่ได้แยกลำ) */
  const on = {}; SB_BOOKINGS.forEach(b => { if (['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)) return; const o = bkOpsRead(b, day);
    if (!o || !o.boatId || o.boatSplits) return; if ((b.trips || []).some(t => t.date === day && t.bookingMode === 'charter')) return; if (!(b.trips || []).some(t => t.date === day)) return; (on[o.boatId] = on[o.boatId] || []).push(b); });
  const boatId = Object.keys(on).filter(k => !baCharterBoatIds(day).has(k)).sort((a, b) => on[b].length - on[a].length)[0];
  if (!boatId || on[boatId].length < 3) return { err: 'no boat with 3+ seat bookings' };
  const x = on[boatId][0], p = (x.trips || []).filter(t => t.date === day).reduce((s, t) => s + bkV2PaxAllTot(t.pax || {}), 0);
  bkOpsFor(x, day).boatId = null;                                 /* ใบนี้คือ "คนที่ค้าง" */
  const L = baAssignedPax(day, boatId), bo = getBoat(boatId);
  window.__keep = { cap: bo.cap, lic: bo.licensePax };
  bo.cap = L - 2; bo.licensePax = L + p + 6;                      /* เรือเต็มที่ cap+2 พอดี · ทะเบียนยังเหลือ */
  delete BOAT_CAP_OVR[day + '::' + boatId];
  const d2 = new Date(day + 'T12:00:00'); d2.setDate(d2.getDate() + 1); const next = d2.toISOString().slice(0, 10);
  return { day, next, boatId, name: bo.name, bk: x.id, p, L, cap: bo.cap, lic: bo.licensePax, want: L + p };
});
if (S.err) { fail('setup · ' + S.err); await close(); process.exit(1); }
const state = () => page.evaluate(s => { const b = SB_BOOKINGS.find(x => x.id === s.bk), el = document.getElementById('bcap-val');
  return { boat: bkOpsRead(b, s.day).boatId || '', modal: !!document.getElementById('bcap-ov'), val: el ? +el.value : null, cap: boatCapFor(s.boatId, s.day), ovr: BOAT_CAP_OVR[s.day + '::' + s.boatId] || null,
    title: (document.querySelector('#bcap-ov') || { textContent: '' }).textContent.slice(0, 60) }; }, S);
const assign = () => page.evaluate(s => bkV2AssignBoat(s.bk, s.boatId, s.day), S);

/* ══ 1 · Cancel ══ */
answer = false; dlg.length = 0; await assign(); await page.waitForTimeout(200);
const s1 = await state(), m1 = dlg[0] || { msg: '' };
if (dlg.length === 1 && m1.type === 'confirm' && /EMERGENCY ONLY/.test(m1.msg) && /reason is required/.test(m1.msg) && m1.msg.includes(String(S.want)) && !s1.boat && !s1.modal && s1.cap === S.cap && !/[^\x00-\x7F]/.test(m1.msg))
  ok(`1 ${S.name} เต็ม (${S.L}/${S.cap}) · ใส่อีก ${S.p} คนไม่ได้ · กล่องถามบอกว่าฉุกเฉินเท่านั้น · Cancel แล้วไม่มีอะไรเปลี่ยน`);
else fail('1 ' + JSON.stringify({ dlg, s1 }));

/* ══ 2 · OK → หน้าต่างปรับ cap ══ */
answer = true; dlg.length = 0; await assign(); await page.waitForTimeout(300);
const s2 = await state();
if (s2.modal && s2.val === S.want && s2.title.includes(S.name) && !s2.boat && s2.cap === S.cap) ok(`2 กด OK · หน้าต่างปรับ cap ของ ${S.name} เปิด · ใส่เลขให้ ${s2.val} (เท่าที่ต้องใช้พอดี)`);
else fail('2 ' + JSON.stringify({ s2, want: S.want }));

/* ══ 3 · ไม่ใส่เหตุผล ══ */
dlg.length = 0; await page.evaluate(s => { document.getElementById('bcap-reason').value = ''; _bcapSave(s.boatId, s.day); }, S); await page.waitForTimeout(200);
const s3 = await state();
if (dlg.length === 1 && dlg[0].type === 'alert' && s3.modal && !s3.ovr && !s3.boat && s3.cap === S.cap) ok('3 ไม่ใส่เหตุผล · บันทึกไม่ได้ · ยังไม่ได้ลงเรือ');
else fail('3 ' + JSON.stringify({ dlg, s3 }));

/* ══ 4 · ใส่เหตุผล ══ */
dlg.length = 0; await page.evaluate(s => { document.getElementById('bcap-reason').value = 'legacy over-lock 4 Oct'; _bcapSave(s.boatId, s.day); }, S); await page.waitForTimeout(400);
const s4 = await state();
if (!dlg.length && !s4.modal && s4.cap === S.want && s4.ovr && s4.ovr.reason === 'legacy over-lock 4 Oct' && s4.ovr.by && s4.ovr.at && s4.boat === S.boatId)
  ok(`4 ใส่เหตุผลแล้วบันทึก · cap วันนั้น ${S.cap} → ${s4.cap} (โดย ${s4.ovr.by}) · ใบจองลง ${S.name} ให้เอง`);
else fail('4 ' + JSON.stringify({ dlg, s4 }));

/* ══ 5 · วันอื่น ══ */
const c5 = await page.evaluate(s => boatCapFor(s.boatId, s.next), S);
if (c5 === S.cap) ok(`5 วันถัดไป (${S.next}) cap ของ ${S.name} ยัง ${c5} เท่าปกติ`); else fail('5 ' + c5);

/* ══ 6 · เกินทะเบียน ══ */
const s6 = await page.evaluate(async s => { const b = SB_BOOKINGS.find(x => x.id === s.bk), bo = getBoat(s.boatId);
  bkOpsFor(b, s.day).boatId = null; delete BOAT_CAP_OVR[s.day + '::' + s.boatId]; bo.licensePax = bo.cap; return true; }, S);
answer = true; dlg.length = 0; await assign(); await page.waitForTimeout(250);
const t6 = await state();
if (dlg.length === 1 && dlg[0].type === 'alert' && /licensed seats/i.test(dlg[0].msg) && !/EMERGENCY/.test(dlg[0].msg) && !t6.modal && !t6.boat && !t6.ovr && !/[^\x00-\x7F]/.test(dlg[0].msg))
  ok('6 เกินที่นั่งจดทะเบียน · ไม่ถาม ไม่เปิดหน้าต่าง · ยังไม่ได้ลงเรือ');
else fail('6 ' + JSON.stringify({ dlg, t6 }));

const e1 = errors.filter(e => !/Failed to load resource/.test(e));
if (!e1.length) ok('7 ไม่มี error บนหน้า'); else fail('7 ' + e1.slice(0, 3).join(' | '));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
