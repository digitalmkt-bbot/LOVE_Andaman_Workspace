// §btBoatClear · By trip date · โหมดเรือ · ปุ่ม "ถอดทั้งลำ" บนการ์ดเรือ
//
// ที่มา (2026-10-23) · owner "By trip date การจัดเรือ ตอนถอดเรือ ถอดออกทีละลำ สามารถถอดออกทีเดียวทั้งลำได้ไหม"
//
// ข้อมูลทดสอบ: วัน D โปรแกรม R มีเรือ 2 ลำ (X, Y) · 3 ใบอยู่บน X · 1 ใบอยู่บน Y · 1 ใบแยกลง X+Y (split) · 1 ใบไม่มีเรือ
//              + 1 ใบบน X แต่เป็นอีกโปรแกรมวันเดียวกัน (ต้องไม่โดนถอด)
// กัน
//   1 หัวกลุ่มเรือ X และ Y ในตาราง (โหมดเรือ) มีปุ่ม "ถอดทั้งลำ" · หัว "ยังไม่จัดเรือ" ไม่มี
//   2 กดยกเลิกในกล่องยืนยัน → ไม่มีอะไรเปลี่ยน · ข้อความยืนยันบอกชื่อเรือ จำนวนใบ จำนวนคน และใบ split ที่ไม่แตะ
//   3 กดยืนยัน → 3 ใบของ X ในโปรแกรมนี้กลับเป็นไม่มีเรือ · ใบบน Y ไม่เปลี่ยน · ใบ split ไม่เปลี่ยน · ใบอีกโปรแกรมบน X ไม่เปลี่ยน
//   4 กดซ้ำบนลำที่เหลือแต่ใบ split → แจ้งเตือน ไม่เปลี่ยนอะไร · ยังอยู่โหมดเรือ · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1000 });
let dlg = [], answer = false;
page.on('dialog', d => { dlg.push(d.message()); answer ? d.accept() : d.dismiss(); });
await goView(page, 'booking', 800);

const S = await page.evaluate(async () => {
  const T = new Date(); T.setDate(T.getDate() + 11); const D = bookingV2LocalYMD(T), R = 'r10', R2 = 'r12';
  const pw = BOATS.filter(x => x && x.id && x.pier === 'panwa'); const X = pw[0].id, Y = pw[1].id, Z = pw[2] ? pw[2].id : pw[0].id;
  TRIPS[D] = {}; TRIPS[D][X] = { route: R, type: 'normal', booked: 0 }; TRIPS[D][Y] = { route: R, type: 'normal', booked: 0 };
  for (let i = SB_BOOKINGS.length - 1; i >= 0; i--) if ((SB_BOOKINGS[i].trips || []).some(t => t.date === D)) SB_BOOKINGS.splice(i, 1);
  const src = SB_BOOKINGS.filter(b => b.status === 'confirmed' && (b.trips || []).length === 1 && b.trips[0].pax && b.schemaVer === 2 && b.trips[0].bookingMode !== 'charter');
  let n = 0; const mk = (rid, boat, ad) => { const b = JSON.parse(JSON.stringify(src[n % src.length])); n++; b.id = 'ZZBC' + n; const t = b.trips[0]; t.date = D; t.routeId = rid; t.pax = { ad_th: 0, chd_th: 0, inf_th: 0, foc_th: 0, ad_fr: ad, chd_fr: 0, inf_fr: 0, foc_fr: 0, foc: 0 }; delete t.ops; t.lockUse = 0; delete t.seatSource;
    b.status = 'confirmed'; b.ops = {}; if (boat) b.ops.boatId = boat; SB_BOOKINGS.push(b); return b; };
  const onX = [mk(R, X, 2), mk(R, X, 3), mk(R, X, 1)], onY = mk(R, Y, 2), none = mk(R, null, 2), other = mk(R2, X, 2);
  const sp = mk(R, X, 4); sp.ops.boatSplits = [{ pax: 2, ad: 2, chd: 0, inf: 0, foc: 0, boatId: X }, { pax: 2, ad: 2, chd: 0, inf: 0, foc: 0, boatId: Y }];
  btcSet('classic'); _bkV2.filterDate = D; _bkV2.filterRoute = R; _bkV2.boatAssignMode = true; bookingV2SwitchTab('bytrip');
  await new Promise(z => setTimeout(z, 700));
  const nm = id => (BOATS.find(b => b.id === id) || {}).name;
  return { D, R, X, Y, xName: nm(X), onX: onX.map(b => b.id), onY: onY.id, none: none.id, other: other.id, sp: sp.id };
});
const state = () => page.evaluate(S => { const o = id => bkOpsRead(SB_BOOKINGS.find(b => b.id === id), S.D);
  return { x: S.onX.map(id => o(id).boatId || ''), y: o(S.onY).boatId, none: o(S.none).boatId || '', other: o(S.other).boatId, sp: JSON.stringify(o(S.sp).boatSplits), mode: _bkV2.boatAssignMode }; }, S);
const btns = () => page.evaluate(() => [...new Set([...document.querySelectorAll('#view-booking .t2-bclr')].map(b => (b.getAttribute('onclick').match(/'([^']+)'/) || [])[1]))]);

const b1 = await btns();
if (b1.includes(S.X) && b1.includes(S.Y) && b1.length === 2) ok('1 หัวกลุ่มเรือ X/Y ในตารางมีปุ่ม "ถอดทั้งลำ" · หัว "ยังไม่จัดเรือ" ไม่มี');
else fail('1 ' + JSON.stringify(b1));

const s0 = await state();
answer = false; dlg = [];
await page.evaluate(X => document.querySelector('#view-booking .t2-bclr[onclick*="\'' + X + '\'"]').click(), S.X); await page.waitForTimeout(300);
const s1 = await state(); const msg = dlg[0] || '';
if (JSON.stringify(s0) === JSON.stringify(s1) && msg.includes(S.xName) && /3 booking\(s\) \(6 pax\)/.test(msg) && /1 booking\(s\) split/.test(msg)) ok('2 กดยกเลิก = ไม่เปลี่ยน · ยืนยันบอก "' + msg.split('\n')[0] + '" + ใบ split ที่ไม่แตะ');
else fail('2 ' + JSON.stringify({ msg, s0, s1 }));

answer = true; dlg = [];
await page.evaluate(X => document.querySelector('#view-booking .t2-bclr[onclick*="\'' + X + '\'"]').click(), S.X); await page.waitForTimeout(600);
const s2 = await state();
if (s2.x.every(v => v === '') && s2.y === S.Y && s2.other === S.X && s2.sp === s0.sp && s2.none === '') ok('3 ยืนยันแล้ว 3 ใบของ ' + S.xName + ' กลับเป็นไม่มีเรือ · ใบบนลำอื่น / ใบ split / ใบอีกโปรแกรม ไม่เปลี่ยน');
else fail('3 ' + JSON.stringify(s2));

/* X ยังมีหัวกลุ่มเพราะใบ split มีลำหลักเป็น X · กดอีกครั้ง = แจ้งว่าเหลือแต่ใบ split · ไม่เปลี่ยนอะไร */
dlg = [];
await page.evaluate(X => { const b = document.querySelector('#view-booking .t2-bclr[onclick*="\'' + X + '\'"]'); if (b) b.click(); }, S.X); await page.waitForTimeout(400);
const s3 = await state(); const m2 = dlg[0] || '';
if (JSON.stringify(s3) === JSON.stringify(s2) && /except split bookings/.test(m2) && s3.mode && errors.length === 0) ok('4 กดซ้ำบนลำที่เหลือแต่ใบ split → แจ้ง "' + m2.split('\n')[0] + '" · ไม่เปลี่ยนอะไร · ยังอยู่โหมดเรือ · ไม่มี error');
else fail('4 ' + JSON.stringify({ m2, s3, errors: errors.slice(0, 2) }));
await close();
if (bad) { console.log(bad + ' FAILED'); process.exit(1); } console.log('ALL OK');
