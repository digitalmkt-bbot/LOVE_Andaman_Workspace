// §pckWarnSheet / §pckChipFit · Pier Check-in · the "not on a boat yet" box follows the table view; compact filter chips
//
// Source (2026-10-12) · owner: "อันนี้กดชิปเป็นตาราง แต่ส่วนที่ยังไม่ได้จัดขึ้นเป็นแบบการ์ด ปรับให้เป็นแบบตารางเหมือนกันหน่อย
//   ฝั่งชิป ทำยังไงให้ดูกระชับหน่อย"
// Checks
//   1 table view · the unassigned box is a table-view table with the same columns as the main table
//   2 card view · it stays card rows
//   3 the main table is still the first .pcs-tw (fit-to-screen and scroll memory use that one)
//   4 chips · short labels with the full name in the tooltip, 0-count chips dimmed, a tap still filters
//   5 Service colour / recorded-by are icon buttons that still work; no page errors
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'booking', 800);
const day = await page.evaluate(() => {
  const c = {}; SB_BOOKINGS.forEach(b => { if (b.status !== 'confirmed') return; (b.trips || []).forEach(t => { if (t.date) c[t.date] = (c[t.date] || 0) + 1; }); });
  const day = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
  let n = 0; SB_BOOKINGS.forEach(b => { if (n < 2 && b.status === 'confirmed' && (b.trips || []).some(t => t.date === day && t.bookingMode !== 'charter')) { const o = bkOpsFor(b, day); if (o.boatId) { o.boatId = null; n++; } } });
  return day; });
const read = () => page.evaluate(() => {
  const w = document.querySelector('.pck-host .pck-warncard'); if (!w) return null;
  const t = w.querySelector('table'), main = document.querySelector('.pck-host .pcs-card table.pck-sheet');
  const cols = tb => tb ? [...tb.querySelectorAll('thead th')].length : -1;
  return { sheet: t.classList.contains('pck-sheet'), cols: cols(t), mainCols: cols(main), rows: t.querySelectorAll('tbody tr.ck-row').length,
    firstTw: (() => { const f = document.querySelector('.pck-host .pcs-tw'); return f ? !f.closest('.pck-warncard') : null; })() }; });
await page.evaluate(d => { nav(document.querySelector('.nav-item[data-view="piercheckin"]')); _pckDate = d; pckSetView('sheet'); }, day); await page.waitForTimeout(800);
const r1 = await read();
if (r1 && r1.sheet && r1.cols === r1.mainCols && r1.rows >= 2) ok(`1 table view · unassigned box is a table (${r1.cols} columns like the main table, ${r1.rows} rows)`); else fail('1 ' + JSON.stringify(r1));
if (r1 && r1.firstTw === true) ok('3 main table is still the first .pcs-tw'); else fail('3 ' + JSON.stringify(r1));
await page.evaluate(() => pckSetView('card')); await page.waitForTimeout(500);
const r2 = await read();
if (r2 && !r2.sheet) ok('2 card view · unassigned box stays card rows'); else fail('2 ' + JSON.stringify(r2));
await page.evaluate(() => pckSetView('sheet')); await page.waitForTimeout(500);

const c4 = await page.evaluate(async () => {
  const chips = [...document.querySelectorAll('.pck-host .pkh-fwrap .pck-sc')];
  const info = chips.map(c => ({ t: c.textContent.trim(), title: c.title, z: c.classList.contains('z') }));
  const wait = chips.find(c => c.title === 'ยังไม่ถึงท่า'), on = chips.find(c => c.title === 'ขึ้นเรือแล้ว');
  const zeroOk = info.filter(x => /\b0$/.test(x.t)).every(x => x.z);
  const target = [wait, on].find(c => c && !c.classList.contains('z')) || wait;
  target.click(); await new Promise(z => setTimeout(z, 300));
  const st = _pckStat; pckClearFilters(); await new Promise(z => setTimeout(z, 300));
  return { n: chips.length, info: info.slice(0, 8), zeroOk, st, tl: target.title };
});
if (c4.n >= 6 && c4.info.every(x => x.title) && c4.info.some(x => x.t.startsWith('ยังไม่ถึง') && x.title === 'ยังไม่ถึงท่า') && c4.zeroOk && c4.st)
  ok(`4 ${c4.n} chips · short labels, full name in tooltip, 0-count dimmed · tapping "${c4.tl}" filters (${c4.st})`);
else fail('4 ' + JSON.stringify(c4));
const c5 = await page.evaluate(async () => {
  const by0 = _pckShowBy; const b = document.querySelector('.pck-host .pkh-fwrap .pck-sci.pck-bytog2'); if (!b) return { err: 'no by button' };
  b.click(); await new Promise(z => setTimeout(z, 300)); const by1 = _pckShowBy; if (by1 !== by0) pckToggleBy();
  return { svc: !!document.querySelector('.pck-host .pkh-fwrap .pck-sci[onclick^="pckSvcSetOpen"]'), toggled: by1 !== by0 }; });
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (c5.svc && c5.toggled && !e1.length) ok('5 icon buttons work · no page errors'); else fail('5 ' + JSON.stringify({ c5, e1: e1.slice(0, 2) }));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
