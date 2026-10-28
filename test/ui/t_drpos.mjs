// §drPos · Daily Fleet log · ตีเรือ (ย้ายท่า) · บันทึกน้ำมันวันที่เรือย้ายท่าโดยไม่มีลูกค้า
//
// ที่มา (2026-10-25) · owner "มันมีบางช่วงที่เราตีเรือสลับไปมา ทีนี้ มันจะต้องมี บันทึกค่าน้ำมันด้วย"
//   + "ใน Boat status มีแจ้งย้ายท่า เพิ่ม + ตีเรือ ใน Daily Fleet ด้วยก็ได้"
// ข้อมูลทดสอบ: วัน D · เรือ X (ท่าประจำทับละมุ) มีใบย้ายท่าไปพันวา D..D+3 · ไม่มีบุคกิ้ง · เรือ Y ไม่มีใบย้ายท่า
// กัน
//   1 ตรวจเองจากใบย้ายท่า: D = ทับละมุ → พันวา · D+1 ไม่มี · D+4 (กลับ) = พันวา → ทับละมุ
//   2 หน้าบันทึกประจำวัน D: แถว X มีป้าย "ตีเรือ · ทับละมุ → พันวา" · ช่องน้ำมันผูกกับน้ำมันตีเรือ · ไม่ขึ้น "ไม่ออก"
//   3 กรอกน้ำมัน 80 → เก็บใน pos.fuel (ไม่ใช่ .fuel) · ยอดหัวท่า + ท้ายตาราง +80
//   4 หน้า Fuel: ลำ X ได้ +80 L ในแถว "ตีเรือ (ย้ายท่า)" · ไม่นับเป็นวันออก ไม่ขึ้นว่าขาดน้ำมัน
//   5 ปุ่ม "+ ตีเรือ" → เลือก Y พันวา → ทับละมุ 50 L → แถว Y มีป้าย · บันทึกแบบ manual
//   6 ซ่อนรายการอัตโนมัติของ X ("ไม่ได้ตีเรือวันนี้") → ป้ายหาย น้ำมันตีเรือ = 0 · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1100 });
page.on('dialog', d => { console.log('    dialog: ' + d.message()); d.dismiss(); });
await page.waitForTimeout(500);
const S = await page.evaluate(() => {
  const T = new Date(); T.setDate(T.getDate() + 15); const D = bookingV2LocalYMD(T);
  const add = (ds, n) => { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return bookingV2LocalYMD(d); };
  const cand = BOATS.filter(b => b && b.ownership !== 'charter' && !b.retired && getCurStatus(b, D).s === 'available' && getCurStatus(b, add(D, -1)).s === 'available');
  cand.slice(0, 2).forEach((b, i) => { if (!FL_ENGINES.some(e => e.boatId === b.id)) FL_ENGINES.push({ id: 'zzpeng' + i, boatId: b.id, pos: 'port', name: 'test' }); });
  const X = cand[0], Y = cand[1]; if (!X || !Y) return { err: 'ไม่มีเรือบริษัทว่าง 2 ลำ' };
  [X, Y].forEach(b => { b.pier = 'tublamu'; b.assignments = []; });
  X.assignments.push({ id: 'zzasn', toPier: 'panwa', startDate: D, endDate: add(D, 3), status: 'active' });
  for (let i = SB_BOOKINGS.length - 1; i >= 0; i--) if ((SB_BOOKINGS[i].trips || []).some(t => t.date === D)) SB_BOOKINGS.splice(i, 1);
  TRIPS[D] = {}; delete FL_DAILY[D];
  const fa = _fuelAgg(D.slice(0, 7));
  return { D, X: X.id, Y: Y.id, xn: X.name, yn: Y.name, a0: flPosAuto(D, X), a1: flPosAuto(add(D, 1), X), a4: flPosAuto(add(D, 4), X), ay: flPosAuto(D, Y),
    td0: fa.tripDays, miss0: fa.missing.length, bx0: (fa.byBoat[X.id] || {}).fuel || 0 };
});
if (S.err) { fail(S.err); await close(); process.exit(1); }
const ft = a => a ? a.from + '>' + a.to : '-';
if (ft(S.a0) === 'tublamu>panwa' && !S.a1 && ft(S.a4) === 'panwa>tublamu' && !S.ay) ok('1 ตรวจเองจากใบย้ายท่า: D ทับละมุ → พันวา · D+1 ไม่มี · D+4 กลับ พันวา → ทับละมุ · ลำที่ไม่ย้าย ไม่มี');
else fail('1 ' + JSON.stringify(S));

await goView(page, 'fl-dailyreport', 900);
const snap = () => page.evaluate((S) => {
  const row = nm => { const td = [...document.querySelectorAll('#fl-dr-body td.fs-bt')].find(t => t.textContent.includes(nm)); return td ? td.parentElement : null; };
  const rx = row(S.xn), ry = row(S.yn);
  const head = [...document.querySelectorAll('#fl-dr-body span')].filter(s => / PAX · \d+ trips · /.test(s.textContent) && s.children.length < 6)
    .reduce((t, s) => t + (+((s.textContent.match(/trips · ([\d,]+) L/) || [])[1] || '0').replace(/,/g, '')), 0);
  const foot = [...document.querySelectorAll('#fl-dr-body tfoot td.fs-f')].reduce((t, td) => t + (+(td.textContent.replace(/[^\d]/g, '')) || 0), 0);
  const inp = rx ? rx.querySelector('td.fs-posf input') : null;
  return { xTxt: rx ? rx.textContent.replace(/\s+/g, ' ') : null, xChip: rx && rx.querySelector('.fs-pos') ? rx.querySelector('.fs-pos').textContent.replace(/\s+/g, ' ') : '',
    xBound: inp ? inp.getAttribute('onchange') : '', yChip: ry && ry.querySelector('.fs-pos') ? ry.querySelector('.fs-pos').textContent.replace(/\s+/g, ' ') : '', head, foot,
    plus: [...document.querySelectorAll('#fl-dr-body button')].filter(b => /ตีเรือ/.test(b.textContent)).length };
}, S);
await page.evaluate(S => { document.getElementById('fl-dr-date').value = S.D; flRenderDR(); }, S);
await page.waitForTimeout(300);
const R2 = await snap();
if (/ตีเรือ/.test(R2.xChip) && /ทับละมุ → พันวา/.test(R2.xChip) && /flPosFuel\(/.test(R2.xBound) && !/ไม่ออก/.test(R2.xTxt || '') && R2.plus >= 2)
  ok('2 แถว ' + S.xn + ': ป้าย "' + R2.xChip.trim() + '" · ช่องน้ำมันผูกกับน้ำมันตีเรือ · ไม่ขึ้น "ไม่ออก" · หัวท่ามีปุ่ม + ตีเรือ ' + R2.plus + ' ท่า');
else fail('2 ' + JSON.stringify(R2));

await page.evaluate(S => { const i = [...document.querySelectorAll('#fl-dr-body td.fs-bt')].find(t => t.textContent.includes(S.xn)).parentElement.querySelector('td.fs-posf input'); i.value = '80'; i.dispatchEvent(new Event('change')); flRenderDR(); }, S);
await page.waitForTimeout(300);
const R3 = await snap();
const rec3 = await page.evaluate(S => JSON.parse(JSON.stringify(FL_DAILY[S.D][S.X])), S);
if (rec3.pos && rec3.pos.fuel === 80 && !rec3.fuel && R3.head - R2.head === 80 && R3.foot - R2.foot === 80) ok('3 กรอก 80 → pos.fuel = 80 (.fuel ว่าง) · ยอดหัวท่า +80 · ท้ายตาราง +80');
else fail('3 ' + JSON.stringify({ rec3, h: [R2.head, R3.head], f: [R2.foot, R3.foot] }));

const R4 = await page.evaluate(S => { const fa = _fuelAgg(S.D.slice(0, 7)), bb = fa.byBoat[S.X] || {}; return { td: fa.tripDays, miss: fa.missing.length, f: bb.fuel || 0, pf: bb.posFuel || 0, days: bb.days || 0, pos: (bb.routes || {})._pos }; }, S);
if (R4.f - S.bx0 === 80 && R4.pf === 80 && R4.pos && R4.pos.fuel === 80 && R4.td === S.td0 && R4.miss === S.miss0) ok('4 หน้า Fuel: ' + S.xn + ' +80 L ในแถว "' + R4.pos.name + '" · วันออก/รายการขาดน้ำมันไม่เปลี่ยน');
else fail('4 ' + JSON.stringify({ R4, S }));

await page.evaluate(() => { [...document.querySelectorAll('#fl-dr-body button')].find(b => /ตีเรือ/.test(b.textContent)).click(); });
await page.waitForTimeout(200);
await page.evaluate(S => { const s = (id, v) => { document.getElementById(id).value = v; }; s('flx-pb', S.Y); s('flx-pf', 'panwa'); s('flx-pt', 'tublamu'); s('flx-pfu', '50'); flPosSaveBtn(); }, S);
await page.waitForTimeout(300);
const R5 = await snap();
const rec5 = await page.evaluate(S => (FL_DAILY[S.D][S.Y] || {}).pos, S);
if (rec5 && rec5.manual && rec5.fuel === 50 && /พันวา → ทับละมุ/.test(R5.yChip) && R5.foot - R3.foot === 50) ok('5 ปุ่ม + ตีเรือ: ' + S.yn + ' พันวา → ทับละมุ 50 L · บันทึกแบบ manual · ป้ายขึ้นในแถว · ท้ายตาราง +50');
else fail('5 ' + JSON.stringify({ rec5, R5 }));

await page.evaluate(S => { flPosOpen(S.D, '', S.X); }, S);
await page.waitForTimeout(150);
const delTxt = await page.evaluate(() => [...document.querySelectorAll('.flx-dlg button')].map(b => b.textContent).join('|'));
await page.evaluate(() => flPosDelBtn()); await page.waitForTimeout(300);
const R6 = await snap();
const f6 = await page.evaluate(S => flPosFuelOf(S.D, getBoat(S.X)), S);
if (/ไม่ได้ตีเรือวันนี้/.test(delTxt) && !R6.xChip && f6 === 0 && R6.foot - R5.foot === -80 && errors.length === 0) ok('6 ซ่อนรายการอัตโนมัติ ("ไม่ได้ตีเรือวันนี้") → ป้ายหาย · น้ำมันตีเรือ 0 · ท้ายตาราง −80 · ไม่มี error');
else fail('6 ' + JSON.stringify({ delTxt, R6, f6, errors: errors.slice(0, 3) }));
await page.evaluate(S => { document.getElementById('fl-dr-date').value = S.D; flRenderDR(); flPosOpen(S.D, '', S.Y); }, S);
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/claude-0/-home-claude/558cc1ba-a23b-5d2f-bccb-3729813f82d1/scratchpad/shots/drpos.png' });
await close();
if (bad) { console.log(bad + ' FAILED'); process.exit(1); } console.log('ALL OK');
