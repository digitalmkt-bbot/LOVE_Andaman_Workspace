// §pjFit · ใบงานเรือ (pjPrint) · หัวใบและบอร์ด Departures สั้นลง · ≥6 ลำแบ่งสองคอลัมน์
//
// ที่มา (2026-10-14) · owner (screenshot Tub Lamu 9 ลำ): "ให้มัน Fit กับจอ · ตอนนี้เหมือนแถวบนมันยาวไปไหม"
//   เลือกแบบ B: บีบหัวใบ+แถว และแบ่ง Departures เป็น 2 คอลัมน์
// กัน
//   1 ≥6 ลำ · บอร์ดเป็นสองตาราง (.brd2) · ซ้ายได้ครึ่งแรกปัดขึ้น · เรียงตามเวลาลงซ้ายก่อน
//   2 <6 ลำ · ตารางเดียวเหมือนเดิม
//   3 หน้าต่าง 1220 · แถวบอร์ด ≤ 40px · Section B เริ่มเหนือ 450px (เดิม ~600)
//   4 หน้าต่างแคบ 1000 · สองตารางซ้อนเป็นคอลัมน์เดียว หัวตารางล่างซ่อน · ชื่อโปรแกรมไม่ตัด ...
//   5 ชื่อโปรแกรม/ชื่อเรือไม่ถูกตัดเป็น ... ที่ 1220 และ 1000
//   6 ไม่มี error
import { open } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1100 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(900);
const capture = (n) => page.evaluate((n) => {
  const pier = 'tublamu';
  const mine = (BOATS || []).filter(x => (x.pier || '') === pier);
  const rts = (ROUTES || []).filter(r => (r.pier || '') === pier);
  const D = '2026-09-16';
  TRIPS[D] = {};
  mine.slice(0, n).forEach((b, i) => { TRIPS[D][b.id] = { route: (rts[i % rts.length] || ROUTES[0]).id, type: 'normal', booked: 0 }; });
  _poDate = D; _poPier = pier; _pjF = 'all';
  let cap = ''; const real = window.open;
  window.open = () => ({ focus() {}, document: { open() {}, write(h) { cap += h; }, close() {} } });
  try { pjPrint(); } catch (e) { cap = 'ERR:' + (e && e.message); }
  window.open = real;
  return cap.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<link[^>]+fonts[^>]*>/g, '');
}, n);
const measure = async (html, w) => {
  const p = await page.context().newPage(); await p.setViewportSize({ width: w, height: 880 });
  await p.setContent(html); await p.waitForTimeout(250);
  const m = await p.evaluate(() => {
    const tbls = [...document.querySelectorAll('.brd')], brd2 = document.querySelector('.brd2');
    const rows = tbls.map(t => [...t.querySelectorAll('tbody tr')]);
    const times = rows.flat().map(r => r.querySelector('.c-t').textContent.trim());
    const clipped = [...document.querySelectorAll('.brd td.c-p, .brd .bpill')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim());
    const r0 = rows[0] && rows[0][0]; const secB = [...document.querySelectorAll('.secbar')][1];
    const stacked = brd2 && getComputedStyle(brd2).display === 'block';
    const head2 = tbls[1] && tbls[1].querySelector('thead') && getComputedStyle(tbls[1].querySelector('thead')).display;
    const side = tbls.length === 2 && Math.abs(tbls[0].getBoundingClientRect().top - tbls[1].getBoundingClientRect().top) < 2 && tbls[1].getBoundingClientRect().left > tbls[0].getBoundingClientRect().right;
    return { n: tbls.length, per: rows.map(r => r.length), times, clipped, rowH: r0 ? Math.round(r0.getBoundingClientRect().height) : null, secB: secB ? Math.round(secB.getBoundingClientRect().top) : null, stacked, head2, side };
  });
  await p.close(); return m;
};
const h9 = await capture(12), h5 = await capture(5);   /* ข้อมูลชุดนี้บางลำถูกกรองออก (เรือเช่า/สถานะ) · นับจากที่วาดจริง */
const a = await measure(h9, 1220);
const sorted = (t) => t.every((v, i) => !i || t[i - 1] <= v);
const tot = a.per.reduce((x, y) => x + y, 0), half = Math.ceil(tot / 2);
if (tot >= 6 && a.n === 2 && a.per[0] === half && a.per[1] === tot - half && a.side && sorted(a.times)) ok(`1 ${tot} ลำ · สองตารางข้างกัน ${half}+${tot - half} · เวลาเรียง ${a.times.join(' ')}`); else fail('1 ' + JSON.stringify(a));
const b = await measure(h5, 1220);
if (b.n === 1 && b.per[0] < 6) ok(`2 ${b.per[0]} ลำ · ตารางเดียว`); else fail('2 ' + JSON.stringify(b));
if (a.rowH <= 40 && a.secB < 450) ok(`3 1220 · แถว ${a.rowH}px · Section B ที่ ${a.secB}px`); else fail('3 ' + JSON.stringify(a));
const c = await measure(h9, 1000);
if (c.stacked && c.head2 === 'none' && c.per[0] === half && c.per[1] === tot - half && !c.side) ok(`4 1000 · ซ้อนเป็นคอลัมน์เดียว หัวตารางล่างซ่อน · แถว ${c.rowH}px`); else fail('4 ' + JSON.stringify(c));
if (!a.clipped.length && !c.clipped.length) ok('5 ไม่มีชื่อถูกตัด ... ทั้งสองความกว้าง'); else fail('5 ' + JSON.stringify({ a: a.clipped, c: c.clipped }));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('6 no page errors'); else fail('6 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
