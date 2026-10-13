// §btcJump · By trip date · the table must not jump when the page is redrawn
//
// Source (2026-10-13) · owner: "ตรวจ Version compact มันชอบเด้ง"
// Measured before the fix (1600x900, seed subset):
//   Compact · the table is its own scroller (.t2-wrap) · any bookingV2Render() (≈200 call sites, plus live updates
//     from other users) rebuilt it at scrollTop 0 → back to the top of the table
//   Compact · the header was measured before Compact restyled it (6px taller) → on every redraw the table box
//     changed height 300ms later and the page could scroll 6px (live update: window went 0 → 6 → 0)
//   Classic · the pin measurement briefly pins the table, the page gets short, the browser clamps the
//     window scroll (1200 → 3) and nothing put it back
// Checks
//   1 Compact · table scrolled down · bookingV2Render() keeps the table where it was
//   2 Compact · redraw and live redraw: table top/height and window scroll identical in every frame for 700ms
//   3 Classic · page scrolled down · bookingV2Render() and bookingV2RenderKeep() keep the page where it was
//   4 a new day starts at the top of the table · switching tab and back too
//   5 no page errors
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 900 });
page.on('dialog', d => d.accept());
await goView(page, 'booking', 800);
const D = await page.evaluate(async () => {
  const c = {}; SB_BOOKINGS.forEach(b => (b.trips || []).forEach(t => { if (t.date) c[t.date] = (c[t.date] || 0) + 1; }));
  const days = Object.keys(c).sort((a, b) => c[b] - c[a]);
  _bkV2.filterDate = days[0]; _bkV2.filterRoute = null; bookingV2SwitchTab('bytrip'); btcSet('compact');
  await new Promise(z => setTimeout(z, 900)); return days.slice(0, 2);
});
const W = () => page.evaluate(() => { const w = document.querySelector('#bkv2-host .t2-wrap'), r = w && w.getBoundingClientRect();
  return { y: Math.round(scrollY), st: w ? Math.round(w.scrollTop) : null, top: r ? Math.round(r.top) : null, h: r ? Math.round(r.height) : null, own: !!w && getComputedStyle(w).overflowY !== 'visible' && w.scrollHeight > w.clientHeight + 10 }; });

// 1
await page.mouse.move(900, 750); for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 150); await page.waitForTimeout(70); } await page.waitForTimeout(400);
const s1 = await W();
await page.evaluate(() => bookingV2Render()); await page.waitForTimeout(500);
const a1 = await W();
if (s1.own && s1.st > 300 && a1.st === s1.st && a1.y === 0) ok(`1 Compact · table at ${s1.st}px · bookingV2Render() → still ${a1.st}px`); else fail('1 ' + JSON.stringify({ s1, a1 }));

// 2
const frames = fn => page.evaluate(async fn => {
  const S = () => { const w = document.querySelector('#bkv2-host .t2-wrap'), r = w.getBoundingClientRect(); return [Math.round(scrollY), Math.round(w.scrollTop), Math.round(r.top), Math.round(r.height)].join(','); };
  const seen = [S()]; let stop = false; const tick = () => { if (stop) return; const v = S(); if (seen[seen.length - 1] !== v) seen.push(v); requestAnimationFrame(tick); };
  eval(fn); requestAnimationFrame(tick); await new Promise(z => setTimeout(z, 700)); stop = true; const v = S(); if (seen[seen.length - 1] !== v) seen.push(v); return seen;
}, fn);
const f2a = await frames('bookingV2Render()'), f2b = await frames('window._laRerender()');
if (f2a.length === 1 && f2b.length === 1) ok(`2 Compact · redraw and live redraw: one state in every frame (window,table scroll,top,height = ${f2a[0]})`);
else fail('2 ' + JSON.stringify({ render: f2a, live: f2b }));

// 3
await page.evaluate(async () => { btcSet('classic'); await new Promise(z => setTimeout(z, 600)); });
await page.mouse.move(900, 750); for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 150); await page.waitForTimeout(70); } await page.waitForTimeout(400);
const s3 = await W();
await page.evaluate(() => bookingV2Render()); await page.waitForTimeout(500); const a3 = await W();
await page.evaluate(() => bookingV2RenderKeep()); await page.waitForTimeout(500); const b3 = await W();
const k3 = s3.own ? 'st' : 'y';
if (s3[k3] > 300 && a3[k3] === s3[k3] && b3[k3] === s3[k3]) ok(`3 Classic · ${s3.own ? 'table' : 'page'} at ${s3[k3]}px · bookingV2Render() ${a3[k3]} · bookingV2RenderKeep() ${b3[k3]}`);
else fail('3 ' + JSON.stringify({ s3, a3, b3 }));

// 4
await page.evaluate(async () => { btcSet('compact'); await new Promise(z => setTimeout(z, 600)); });
const c4 = await page.evaluate(async D => {
  const w = () => document.querySelector('#bkv2-host .t2-wrap'); w().scrollTop = 600; await new Promise(z => setTimeout(z, 200)); const before = w().scrollTop;
  _bkV2.filterDate = D[1]; bookingV2Render(); await new Promise(z => setTimeout(z, 500)); const day = w().scrollTop;
  w().scrollTop = 600; await new Promise(z => setTimeout(z, 200));
  bookingV2SwitchTab('all'); await new Promise(z => setTimeout(z, 300)); bookingV2SwitchTab('bytrip'); await new Promise(z => setTimeout(z, 500)); const tab = w().scrollTop;
  return { before, day, tab };
}, D);
if (c4.before > 300 && c4.day === 0 && c4.tab === 0) ok(`4 new day → top of table (${c4.before} → ${c4.day}) · tab and back → ${c4.tab}`); else fail('4 ' + JSON.stringify(c4));

const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('5 no page errors'); else fail('5 ' + e1.slice(0, 3).join(' | '));
await page.evaluate(() => btcSet('classic'));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
