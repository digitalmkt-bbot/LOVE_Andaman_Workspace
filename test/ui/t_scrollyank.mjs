// §scrollYank · another user's save must not drag the screen back while you are still scrolling
//
// Source (2026-10-11) · owner: "เวลาเรากำลังเลื่อนๆ แล้วมี User อื่นลงรายละเอียด แล้วมันชอบเด้ง"
//   _laRerender restores the scroll right after redrawing, then again 60 ms later with the numbers
//   taken BEFORE the redraw; anyone still scrolling in those 60 ms got pulled back.
// Checks
//   1 By trip date · keep scrolling right after a remote redraw → stays where the user scrolled to
//   2 Pier Check-in inner table box · same
//   3 nobody touches anything → the redraw still lands exactly where it was
//   4 no page errors
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 800 });
page.on('dialog', d => d.accept());
await goView(page, 'booking', 900);
const day = await page.evaluate(() => { const c = {}; SB_BOOKINGS.forEach(b => (b.trips || []).forEach(t => { if (t.date) c[t.date] = (c[t.date] || 0) + 1; })); return Object.keys(c).sort((a, b) => c[b] - c[a])[0]; });

await page.evaluate(d => { _bkV2.filterDate = d; _bkV2.filterRoute = null; bookingV2SwitchTab('bytrip'); }, day); await page.waitForTimeout(900);
const c1 = await page.evaluate(async () => {
  window.scrollTo(0, 600); await new Promise(z => setTimeout(z, 80));
  const start = window.scrollY;
  window._laRerender();
  await new Promise(z => setTimeout(z, 10));
  document.dispatchEvent(new WheelEvent('wheel', { deltaY: 300, bubbles: true })); window.scrollTo(0, start + 300);
  await new Promise(z => setTimeout(z, 200));
  return { start, now: window.scrollY, max: document.documentElement.scrollHeight - innerHeight }; });
if (c1.start > 100 && Math.abs(c1.now - (c1.start + 300)) <= 2) ok(`1 By trip · redraw at ${c1.start}px, kept scrolling to ${c1.start + 300}px → stays at ${c1.now}px`);
else fail('1 ' + JSON.stringify(c1));

await page.evaluate(d => { nav(document.querySelector('.nav-item[data-view="piercheckin"]')); _pckDate = d; renderPierCheckin(); }, day); await page.waitForTimeout(900);
const c2 = await page.evaluate(async () => {
  const box = () => [...document.querySelectorAll('.view.active *')].find(e => e.scrollHeight > e.clientHeight + 300 && /auto|scroll/.test(getComputedStyle(e).overflowY));
  const b0 = box(); if (!b0) return { err: 'no scroll box' };
  b0.scrollTop = 200; await new Promise(z => setTimeout(z, 80));
  const start = b0.scrollTop, cls = b0.className;
  window._laRerender();
  await new Promise(z => setTimeout(z, 10));
  const b1 = box(); b1.dispatchEvent(new WheelEvent('wheel', { deltaY: 150, bubbles: true })); b1.scrollTop = start + 150;
  await new Promise(z => setTimeout(z, 200));
  return { cls, start, now: box().scrollTop }; });
if (!c2.err && Math.abs(c2.now - (c2.start + 150)) <= 2) ok(`2 Pier Check-in box .${c2.cls} · ${c2.start} → user ${c2.start + 150} → stays at ${c2.now}`);
else fail('2 ' + JSON.stringify(c2));

await page.evaluate(d => { nav(document.querySelector('.nav-item[data-view="booking"]')); _bkV2.filterDate = d; bookingV2SwitchTab('bytrip'); }, day); await page.waitForTimeout(900);
const c3 = await page.evaluate(async () => {
  window.scrollTo(0, 500); await new Promise(z => setTimeout(z, 80)); const start = window.scrollY;
  window._laRerender(); await new Promise(z => setTimeout(z, 200)); return { start, now: window.scrollY }; });
if (Math.abs(c3.now - c3.start) <= 1) ok(`3 no user input · redraw lands at the same place (${c3.now}px)`); else fail('3 ' + JSON.stringify(c3));

const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('4 no page errors'); else fail('4 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
