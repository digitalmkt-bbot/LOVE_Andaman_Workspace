// §btLockBtn · ล็อกที่นั่งได้จากหน้า By trip โดยไม่ต้องเลือกโปรแกรมก่อน
//
// ที่มา (2026-10-02) · ผู้ใช้ส่งภาพหน้า By trip แล้วขอว่า "ขอให้ Lockseat ผ่านหน้านี้ได้ด้วย
//   เอาปุ่มไปไว้กับ Seat Lock ก็ได้" · ปุ่มมีอยู่แล้ว แต่ขึ้นเฉพาะตอนเลือกโปรแกรมทางซ้ายไว้
//   หน้าที่เปิดมาแบบทุกโปรแกรมจึงไม่มีปุ่มเลย
//
// กันห้าอย่าง
//   1 ไม่ได้เลือกโปรแกรม · การ์ด Seat Lock ยังมีปุ่มล็อกที่นั่ง
//   2 กดแล้วฟอร์มเปิดบนหน้านี้เลย (ไม่สลับแท็บ) · วันที่ถูกใส่ให้เป็นวันที่กำลังดู
//   3 วันที่มีหลายโปรแกรม · ช่องเส้นทางว่างให้เลือกเอง · วันที่มีโปรแกรมเดียว · ใส่ให้
//   4 เลือกโปรแกรมไว้ · ใส่โปรแกรมนั้นให้เหมือนเดิม
//   5 สร้างจากฟอร์มนี้แล้วล็อกขึ้นในการ์ดและในตารางของหน้านี้ทันที · ไม่มี error บนหน้า
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1000 });
page.on('dialog', async d => { try { await d.accept(); } catch (_) {} });
await goView(page, 'booking', 900);

const S = await page.evaluate(() => {
  const per = {};
  (SB_BOOKINGS || []).forEach(b => { if (['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)) return;
    (b.trips || []).forEach(t => { if (t && t.date && t.routeId) { (per[t.date] = per[t.date] || {})[t.routeId] = 1; } }); });
  const days = Object.keys(per).sort();
  const multi = days.find(d => Object.keys(per[d]).length >= 2), single = days.find(d => Object.keys(per[d]).length === 1);
  const ag = (SB_AGENTS || []).find(a => a && a.name);
  return { days: days.slice(0, 25), multi, single, multiR: multi ? Object.keys(per[multi]) : [], singleR: single ? Object.keys(per[single])[0] : '', ag: ag ? ag.name : '' };
});
const show = (date, rid) => page.evaluate(async p => { _bkV2LockModalOpen = false; _bkV2.filterDate = p.date; _bkV2.filterRoute = p.rid || null;
  bkV2SwitchTab('bytrip'); await new Promise(z => setTimeout(z, 700));
  const b = document.querySelector('.bt-lockc button[data-btlock]'); return { btn: !!b, txt: b ? b.textContent.trim() : '' }; }, { date, rid });
const openForm = () => page.evaluate(async () => { document.querySelector('.bt-lockc button[data-btlock]').click(); await new Promise(z => setTimeout(z, 300));
  return { open: !!_bkV2LockModalOpen, tab: _bkV2.tab, route: _bkV2LockForm.routeId, date: _bkV2LockForm.date, scope: _bkV2LockForm.scope,
    sel: !!document.querySelector('.bkv2-locks select') }; });

if (!S.multi) { fail('no day with 2+ programmes in this data set'); await close(); process.exit(1); }

/* ══ 1–3 · ไม่ได้เลือกโปรแกรม · วันที่มีหลายโปรแกรม ══ */
const v1 = await show(S.multi, null);
if (v1.btn && /Lock seats/.test(v1.txt)) ok('1 ไม่ได้เลือกโปรแกรม · การ์ด Seat Lock มีปุ่ม "' + v1.txt + '"');
else fail('1 ' + JSON.stringify(v1));
const f2 = await openForm();
if (f2.open && f2.tab === 'bytrip' && f2.date === S.multi && f2.scope === 'day' && f2.sel) ok('2 กดแล้วฟอร์มเปิดบนหน้า By trip · วันที่ใส่ให้เป็น ' + S.multi);
else fail('2 ' + JSON.stringify(f2));
/* วันที่หน้านี้วาดโปรแกรมเดียวจริง ๆ (นับจากแถบโปรแกรมบนจอ · ใบยกเลิก/ใบรออนุมัติก็ทำให้โปรแกรมขึ้นได้) */
let f3s = null;
const oneDay = await page.evaluate(async p => {
  for (const d of p.days) { _bkV2LockModalOpen = false; _bkV2.filterDate = d; _bkV2.filterRoute = null; bkV2SwitchTab('bytrip');
    await new Promise(z => setTimeout(z, 350));
    const bands = [...document.querySelectorAll('tr.t2-pband')];
    if (bands.length !== 1) continue;
    const nm = (bands[0].querySelector('.pn') || {}).textContent || '';
    const hit = (ROUTES || []).filter(r => r.name === nm);
    if (hit.length === 1) return { d, rid: hit[0].id }; }
  return null;
}, { days: S.days });
S.single = oneDay ? oneDay.d : ''; S.singleR = oneDay ? oneDay.rid : '';
if (S.single) { await show(S.single, null); f3s = await openForm(); }
if (f2.route === '' && (!S.single || (f3s.route === S.singleR && f3s.date === S.single)))
  ok('3 วันที่มี ' + S.multiR.length + ' โปรแกรม · ช่องเส้นทางว่างให้เลือกเอง' + (S.single ? ' · วันที่มีโปรแกรมเดียว ใส่ให้เลย' : ' (ชุดนี้ไม่มีวันที่มีโปรแกรมเดียว)'));
else fail('3 ' + JSON.stringify({ multi: f2.route, single: f3s, want: S.singleR }));

/* ══ 4 · เลือกโปรแกรมไว้ ══ */
await show(S.multi, S.multiR[1]);
const f4 = await openForm();
if (f4.open && f4.route === S.multiR[1] && f4.date === S.multi) ok('4 เลือกโปรแกรมไว้ · ฟอร์มใส่โปรแกรมนั้นให้');
else fail('4 ' + JSON.stringify(f4));

/* ══ 5 · สร้างจากฟอร์มนี้ ══ */
const r5 = await page.evaluate(async p => {
  _bkV2LockForm.holderType = 'agent'; _bkV2LockForm.holderName = p.ag; _bkV2LockForm.qty = '2'; _bkV2LockForm.reason = 't-btlockbtn';
  bkV2LockCreateSubmit();
  const ask = document.querySelector('.lkpend-ask button[data-lkpend="split"]'); if (ask) ask.click();
  await new Promise(z => setTimeout(z, 700));
  const l = SB_SEAT_LOCKS.find(x => x.reason === 't-btlockbtn');
  return { made: !!l, date: l ? l.date : '', rid: l ? l.routeId : '', tab: _bkV2.tab, modal: !!_bkV2LockModalOpen,
    row: l ? !!document.querySelector('tr.t2-lrow[data-lk="' + l.id + '"]') : false,
    card: (document.querySelector('.bt-lockc') || {}).textContent.indexOf(p.ag) >= 0 };
}, { ag: S.ag });
const realErr = errors.filter(e => !/Failed to load resource/.test(e));
if (r5.made && r5.date === S.multi && r5.rid === S.multiR[1] && r5.tab === 'bytrip' && !r5.modal && r5.row && r5.card && !realErr.length)
  ok('5 สร้างแล้วยังอยู่หน้า By trip · ล็อกขึ้นทั้งในการ์ด Seat Lock และในตาราง · ไม่มี error บนหน้า');
else fail('5 ' + JSON.stringify({ r5, realErr: realErr.slice(0, 2) }));

await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
