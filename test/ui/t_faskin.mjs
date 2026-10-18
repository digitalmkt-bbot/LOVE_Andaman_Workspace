// §faSkin · Job Assignment + Maintenance ดีไซน์ตาม Fleet Work · หัว/แถบสเตจกรองได้ · ค้นหา · แถวใหม่ · การ์ดขวา (สเตจ · Next step · รูป) · ปุ่มไป Fleet Work
import { open, goView } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
page.on('dialog', d => d.accept());
const z = ms => page.waitForTimeout(ms);

await goView(page, 'fl-incident', 1000);
const a = await page.evaluate(async () => {
  const zz = ms => new Promise(f => setTimeout(f, ms));
  const V = document.getElementById('view-fl-incident');
  const top = !!V.querySelector('.fj-top'), tiles = V.querySelectorAll('.fj-stg').length, tabs = V.querySelectorAll('.fj-tabs button').length;
  const rows0 = V.querySelectorAll('.fj-row').length;
  incTile('open'); await zz(300); const rowsOpen = V.querySelectorAll('.fj-row').length, openOn = !!V.querySelector('.fj-stg.on');
  const nOpen = FL_INCIDENTS.filter(x => x.status !== 'resolved' && !(x.maintId && FL_MAINT.find(m => m.id === x.maintId))).length;
  incTile('open'); await zz(300);
  incSetQ('XCD'); await zz(400); const rowsQ = [...V.querySelectorAll('.fj-row')].map(r => r.innerText);
  incSetQ(''); await zz(400);
  const inc = FL_INCIDENTS.find(x => (x.status || 'open') === 'open' && x.maintId); flSelIncident(inc.id); await zz(500);
  const d = document.getElementById('fl-inc-detail-mount');
  return { top, tiles, tabs, rows0, rowsOpen, nOpen, openOn, rowsQ: rowsQ.length, qOk: rowsQ.every(t => /xcd/i.test(t)),
    dh: !!d.querySelector('.fj-dh'), steps: d.querySelectorAll('.fj-steps .flw-step').length, next: !!d.querySelector('.fj-next'), photos: !!d.querySelector('.flp'),
    fw: !!d.querySelector('button[onclick*="flNavGo(\'fl-work\')"]'), pink: !!d.querySelector('[style*="linear-gradient"]'), sel: !!V.querySelector('.fj-row.on') };
});
if (a.top && a.tiles === 4 && a.tabs >= 2) ok(`1 JA · หัวแบบ Fleet Work · แถบสเตจ 4 · แท็บ ${a.tabs}`); else fail('1 ' + JSON.stringify(a));
if (a.rowsOpen === a.nOpen && a.openOn && a.rows0 > a.rowsOpen) ok(`2 JA · กดแถบ Open → เหลือ ${a.rowsOpen} แถว (ตรงข้อมูล) · แถบขึ้นขาว`); else fail('2 ' + JSON.stringify(a));
if (a.rowsQ > 0 && a.qOk) ok(`3 JA · ค้น "XCD" เหลือ ${a.rowsQ} แถว ทุกแถวมีคำนั้น`); else fail('3 ' + JSON.stringify(a));
if (a.dh && a.steps === 6 && a.next && a.photos && a.fw && !a.pink && a.sel) ok('4 JA · การ์ดขวา: หัวขาว · 6 สเตจ · Next step · รูป · ปุ่ม Open in Fleet Work · ไม่มีแถบชมพู'); else fail('4 ' + JSON.stringify(a));

await goView(page, 'fl-maintenance', 1000);
const b = await page.evaluate(async () => {
  const zz = ms => new Promise(f => setTimeout(f, ms));
  const V = document.getElementById('view-fl-maintenance');
  const top = !!V.querySelector('.fj-top'), tiles = V.querySelectorAll('.fj-stg').length;
  maintTile('awaiting'); await zz(300); const awOn = _maintArchiveTab === 'awaiting', awRows = V.querySelectorAll('.fj-row').length;
  maintTile('awaiting'); await zz(300);
  maintSetQ('น้ำมัน'); await zz(400); const q = [...V.querySelectorAll('.fj-row')].map(r => r.innerText); maintSetQ(''); await zz(400);
  const it = flwItems().find(x => x.kind === 'mj'); flSelMaint(it.id); await zz(500);
  const d = document.getElementById('fl-maint-detail-mount');
  const r1 = { dh: !!d.querySelector('.fj-dh'), steps: d.querySelectorAll('.fj-steps .flw-step').length, now: !!d.querySelector('.fj-steps .flw-step.now'), next: !!d.querySelector('.fj-next'), parts: /Parts withdrawn/.test(d.innerText), memos: /Linked memos/.test(d.innerText), photos: !!d.querySelector('.flp'), pill: (d.querySelector('.fj-dh .fj-pill') || {}).textContent };
  // งานที่ปิดแล้ว (Archive)
  maintSetArchive('archive'); await zz(300); const dn = FL_MAINT.find(m => m.status === 'done' && !m.awaitingInvoice); flSelMaint(dn.id); await zz(500); const d2 = document.getElementById('fl-maint-detail-mount');
  const r2 = { pill: (d2.querySelector('.fj-dh .fj-pill') || {}).textContent, allDone: d2.querySelectorAll('.fj-steps .flw-step.done').length, photos: !!d2.querySelector('.flp'), doneTag: !!d2.querySelector('.flp-done'), noClose: !d2.querySelector('.fj-dh button[onclick*="CloseModal"]') };
  // Open in Fleet Work → FLW ชี้งานนี้
  d2.querySelector('.fj-dh button[onclick*="flNavGo"]').click(); await zz(800);
  const r3 = { view: document.querySelector('.view.active').id, item: FLW.item, boat: FLW.boat };
  return { top, tiles, awOn, awRows, q: q.length, qOk: q.every(t => /น้ำมัน/.test(t)), r1, r2, r3, dnId: dn.id, dnBoat: dn.boatId };
});
if (b.top && b.tiles === 5) ok('5 Maintenance · หัวแบบ Fleet Work · แถบสเตจ 5'); else fail('5 ' + JSON.stringify(b));
if (b.awOn && b.awRows >= 0 && b.q > 0 && b.qOk) ok(`6 Maintenance · แถบ Awaiting invoice สลับแท็บ · ค้น "น้ำมัน" เหลือ ${b.q} แถว`); else fail('6 ' + JSON.stringify(b));
if (b.r1.dh && b.r1.steps === 6 && b.r1.now && b.r1.next && b.r1.parts && b.r1.memos && b.r1.photos && b.r1.pill === FLW_ST_T(b.r1.pill)) ok(`7 Maintenance · การ์ดขวา: สเตจ "${b.r1.pill}" ตรง Fleet Work · Next step · อะไหล่ · memo · รูป`); else fail('7 ' + JSON.stringify(b.r1));
if (b.r2.pill === 'Done' && b.r2.allDone === 6 && b.r2.photos && b.r2.doneTag && b.r2.noClose) ok('8 Maintenance · งานที่ปิดแล้ว: ป้าย Done · 6 ขั้นเสร็จ · การ์ดรูป "photos can still be added" · ไม่มีปุ่ม Close'); else fail('8 ' + JSON.stringify(b.r2));
if (b.r3.view === 'view-fl-work' && b.r3.item === 'dn:' + b.dnId && b.r3.boat === b.dnBoat) ok('9 Open in Fleet Work → ไปหน้า Fleet Work พร้อมเลือกเรือและงานนั้น'); else fail('9 ' + JSON.stringify(b.r3));
function FLW_ST_T(p){ return ['Reported','Job open','Waiting','Repairing','To close','Billing'].indexOf(p) >= 0 ? p : null; }

// §jaBoat · ตัวกรองเรือในหน้า Job Assignment
await goView(page, 'fl-incident', 800);
const c = await page.evaluate(async () => {
  const zz = ms => new Promise(f => setTimeout(f, ms));
  const V = document.getElementById('view-fl-incident');
  incResetFilters(); await zz(300);
  const btn = V.querySelector('button[onclick="incToggleFilterPanel()"]'); btn.click(); await zz(300);
  const chips = [...V.querySelectorAll('button[onclick^="incSetBoat("]')].filter(b => !/incSetBoat\('all'\)/.test(b.getAttribute('onclick')));
  const pick = chips[0]; const bid = pick.getAttribute('onclick').match(/'([^']+)'/)[1]; const n = +pick.querySelector('i').textContent;
  pick.click(); await zz(300);
  const rows = [...document.querySelectorAll('#view-fl-incident .fj-row')];
  const okBoat = rows.every(r => { const id = (r.getAttribute('onclick').match(/'([^']+)'/) || [])[1]; const inc = FL_INCIDENTS.find(x => x.id === id); return inc && inc.boatId === bid; });
  const clear = !!V.querySelector('a[onclick="incResetFilters()"]');
  incResetFilters(); await zz(300);
  return { chips: chips.length, n, rows: rows.length, okBoat, clear, after: document.querySelectorAll('#view-fl-incident .fj-row').length };
});
if (c.chips > 1 && c.rows === c.n && c.okBoat && c.clear && c.after > c.rows) ok(`11 JA · Boat ▾ กาง ${c.chips} ลำ · เลือก 1 ลำ เหลือ ${c.rows} แถว (ตรงตัวนับ) ทุกแถวเป็นเรือนั้น · Clear คืนค่า`); else fail('11 ' + JSON.stringify(c));

const errs = errors.filter(e => !/404/.test(e));
if (errs.length) fail('errors: ' + errs.join(' | ')); else ok('10 ไม่มี error');
await close(); console.log(bad ? `FAIL ${bad}` : 'PASS'); process.exit(bad ? 1 : 0);
