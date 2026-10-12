// §pckBarFix · Pier Check-in · the table|card toggle stays in the same place when you switch
//
// Source (2026-10-12) · owner, two screenshots: "พอกดสลับ การ์ด ตาราง ตำแหน่งมันจะสลับกัน มันไม่อยู่ที่เดิม"
//   The sort toggle (เรียง เรือ|รถ) only existed in table view, so in card view the view toggle slid right.
// Checks (at 1400 / 1700 / 2000 px)
//   1 the view toggle buttons have the same screen position in table and card view
//   2 chips and icon buttons do not move either
//   3 sort is visible in table view, hidden (not clickable) in card view
//   4 no page errors
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
for (const W of [1400, 1700, 2000]) {
  const { page, errors, close } = await open({ blob: process.env.LAD, width: W, height: 1000 });
  await goView(page, 'booking', 600);
  await page.evaluate(() => { nav(document.querySelector('.nav-item[data-view="piercheckin"]')); pckSetView('sheet'); });
  await page.waitForTimeout(700);
  const pos = () => page.evaluate(() => {
    const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top)]; };
    const segs = [...document.querySelectorAll('.pck-host .pkh-fwrap button[onclick^="pckSetView"]')];
    const sort = document.querySelector('.pck-host .pkh-fwrap .pcs-sortg');
    return { view: segs.map(r), chips: [...document.querySelectorAll('.pck-host .pkh-fwrap .pck-sc, .pck-host .pkh-fwrap .pck-sci')].map(r),
      sortVis: sort ? getComputedStyle(sort).visibility : 'none' }; });
  const a = await pos();
  await page.evaluate(() => pckSetView('card')); await page.waitForTimeout(500);
  const b = await pos();
  await page.evaluate(() => pckSetView('sheet')); await page.waitForTimeout(500);
  const c = await pos();
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  if (a.view.length === 2 && same(a.view, b.view) && same(a.view, c.view)) ok(`1 ${W}px · view toggle stays at ${JSON.stringify(a.view[0])}`); else fail(`1 ${W}px ` + JSON.stringify({ a: a.view, b: b.view }));
  if (a.chips.length && same(a.chips, b.chips)) ok(`2 ${W}px · ${a.chips.length} chips/icons do not move`); else fail(`2 ${W}px ` + JSON.stringify({ a: a.chips.slice(-4), b: b.chips.slice(-4) }));
  if (a.sortVis === 'visible' && b.sortVis === 'hidden') ok(`3 ${W}px · sort shown in table view, hidden in card view`); else fail(`3 ${W}px ${a.sortVis}/${b.sortVis}`);
  const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
  if (!e1.length) ok(`4 ${W}px · no page errors`); else fail('4 ' + e1.slice(0, 3).join(' | '));
  await close();
}
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
