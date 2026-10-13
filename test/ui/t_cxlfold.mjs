// §cxlFold · By trip date · the Cancelled block is folded until someone clicks it
//
// Source (2026-10-13) · owner screenshot (7 cancelled rows under Own transportation):
//   "รายการยกเลิกทำเป็นซ่อนได้ไหม และถ้าจะดูให้ User กด"
// Checks
//   1 by default only the "✕ Cancelled · N bookings" bar shows (rows hidden, bar says ดูรายการ)
//   2 click the bar → all N rows show with their View / Restore buttons · the bar says ซ่อน
//   3 a redraw (someone saved) keeps it open · other trips' blocks stay folded
//   4 click again → folded · Enter on the bar works too (keyboard)
//   5 nothing in SB_BOOKINGS changes · no page errors
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'booking', 700);
const S = await page.evaluate(async () => {
  const cxl = ['cancelled', 'rejected', 'cancelled_weather'];
  const c = {}; SB_BOOKINGS.forEach(b => { if (!cxl.includes(b.status)) return; (b.trips || []).forEach(t => { if (t && t.date) c[t.date] = (c[t.date] || 0) + 1; }); });
  const day = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; if (!day) return { err: 'no cancelled booking in the data' };
  window.__snap = JSON.stringify(SB_BOOKINGS);
  _bkV2.filterDate = day; _bkV2.filterRoute = null; bkV2SwitchTab('bytrip'); await new Promise(z => setTimeout(z, 600));
  return { day, n: c[day], blocks: document.querySelectorAll('#view-booking .t2-cxl-sec').length };
});
if (S.err) { fail(S.err); await close(); process.exit(1); }
ok(`setup ${S.day} · ${S.n} cancelled trip line(s) · ${S.blocks} block(s)`);
const st = () => page.evaluate(() => [...document.querySelectorAll('#view-booking .t2-cxl-sec')].map(sec => ({ open: sec.classList.contains('open'),
  rowsShown: [...sec.querySelectorAll('.t2-cxl-row')].filter(r => r.offsetParent).length, rows: sec.querySelectorAll('.t2-cxl-row').length,
  bar: sec.querySelector('.t2-cxl-hd').innerText.replace(/\s+/g, ' ').trim(), barH: Math.round(sec.getBoundingClientRect().height),
  btns: [...sec.querySelectorAll('.t2-cxl-row button')].filter(b => b.offsetParent).length })));
const s1 = await st();
if (s1.length && s1.every(b => !b.open && b.rowsShown === 0 && b.rows > 0 && /Cancelled · \d+ booking/i.test(b.bar) && /ดูรายการ/.test(b.bar)))
  ok(`1 folded by default · "${s1[0].bar}" · ${s1[0].barH}px tall`); else fail('1 ' + JSON.stringify(s1));
await page.locator('#view-booking .t2-cxl-sec .t2-cxl-hd').first().click(); await page.waitForTimeout(150);
const s2 = await st();
if (s2[0].open && s2[0].rowsShown === s2[0].rows && s2[0].btns === s2[0].rows * 2 && /ซ่อน/.test(s2[0].bar)) ok(`2 click → ${s2[0].rowsShown} rows with View/Restore · bar "${s2[0].bar}"`); else fail('2 ' + JSON.stringify(s2[0]));
await page.evaluate(async () => { bkV2Render(); await new Promise(z => setTimeout(z, 300)); });
const s3 = await st();
if (s3[0].open && s3[0].rowsShown === s3[0].rows && s3.slice(1).every(b => !b.open)) ok(`3 redraw keeps it open · ${s3.length - 1} other block(s) still folded`); else fail('3 ' + JSON.stringify(s3));
await page.locator('#view-booking .t2-cxl-sec .t2-cxl-hd').first().click(); await page.waitForTimeout(150);
const s4a = await st();
await page.locator('#view-booking .t2-cxl-sec .t2-cxl-hd').first().focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
const s4b = await st();
if (!s4a[0].open && s4a[0].rowsShown === 0 && s4b[0].open) ok('4 click again folds · Enter opens'); else fail('4 ' + JSON.stringify({ a: s4a[0], b: s4b[0] }));
if (process.env.SHOT) { // folded, then open · stacked
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  const sec = page.locator('#view-booking .t2-cxl-sec').first(); await sec.scrollIntoViewIfNeeded();
  if (await sec.evaluate(e => e.classList.contains('open'))) await sec.locator('.t2-cxl-hd').click();
  await page.mouse.move(5, 5); let b = await sec.boundingBox(); await page.screenshot({ path: process.env.SHOT.replace('.png', '_a.png'), clip: { x: b.x, y: b.y - 6, width: b.width, height: b.height + 12 } });
  await sec.locator('.t2-cxl-hd').click(); await page.mouse.move(5, 5); await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.waitForTimeout(150);
  b = await sec.boundingBox(); await page.screenshot({ path: process.env.SHOT.replace('.png', '_b.png'), clip: { x: b.x, y: b.y - 6, width: b.width, height: b.height + 12 } }); }
const c5 = await page.evaluate(() => window.__snap === JSON.stringify(SB_BOOKINGS));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (c5 && !e1.length) ok('5 bookings unchanged · no page errors'); else fail('5 ' + JSON.stringify({ c5, e: e1.slice(0, 3) }));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
