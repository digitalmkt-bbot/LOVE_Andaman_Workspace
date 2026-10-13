// §progScroll / §progWd · หน้า Programs · เลื่อนไม่ติดขัด · ตัวย่อวันไม่ซ้ำกัน
//
// ที่มา (2026-10-03) · ผู้ใช้ส่งภาพหน้า Programs
//   "ดูการ Scroll ในหน้านี้หน่อย ติด ๆ ขัด ๆ และตัวย่อของวันให้เห็นแยกกันหน่อย บางที User งง"
//   วัดก่อนแก้ (จอ 2000×1120) · รายการซ้ายสูง 4,739px · แผงปฏิทินขวาสูง 1,347px ถูกตรึง (sticky) ที่ top 14
//   ขอบล่างของแผงอยู่ที่ 1,361px ตลอด เลื่อน 3,000px แล้วก็ยังเท่าเดิม · เดือนท้าย ๆ ไม่ขึ้นจนสุดรายการ
//   หัววันเป็น S M T W T F S (S ซ้ำ T ซ้ำ) ตัวอักษร 7px
//
// กันเจ็ดอย่าง
//   1 เลือกโปรแกรมแล้ว · เลื่อนหน้าลงนิดเดียวก็เห็นปฏิทินครบถึงขอบล่าง (ไม่ต้องเลื่อนสุดรายการ)
//   2 รายการซ้ายเป็นกล่องเลื่อนของตัวเอง สูงไม่เกินจอ · เลื่อนถึงโปรแกรมสุดท้ายได้ โดยหน้าไม่ขยับ
//   3 หมุนล้อบนรายการจนสุด · หน้าไม่ถูกลากไปด้วย · หมุนล้อบนปฏิทิน · หน้าเลื่อน
//   4 กดเลือกโปรแกรมท้ายรายการ · รายการไม่เด้งกลับบนสุด · โปรแกรมที่เลือกยังอยู่ในจอ
//   5 หัววันของทุกเดือนเป็น Su Mo Tu We Th Fr Sa · เจ็ดตัวไม่ซ้ำกัน · อ่านได้ (≥ 8px)
//   6 ไม่มี error บนหน้า
//   7 จอแคบ (สองแผงเรียงบน-ล่าง) · รายการสูงไม่เกินครึ่งจอ ไม่ตรึง ไม่กักการเลื่อน · ลงไปหาปฏิทินได้
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 2000, height: 1120 });
await goView(page, 'settings', 900);
await page.evaluate(async () => { selProgId = ROUTES[1].id; renderSettings(); await new Promise(z => setTimeout(z, 400)); });
const M = () => page.evaluate(() => { const m = document.getElementById('prog-detail-mount').getBoundingClientRect(), lb = document.getElementById('prog-list-box'), l = lb ? lb.getBoundingClientRect() : null;
  return { vh: innerHeight, y: Math.round(scrollY), doc: document.documentElement.scrollHeight, mTop: Math.round(m.top), mBot: Math.round(m.bottom), mH: Math.round(m.height),
    list: lb ? { top: Math.round(l.top), bot: Math.round(l.bottom), sh: lb.scrollHeight, ch: lb.clientHeight, st: Math.round(lb.scrollTop) } : { top: -1, bot: 99999, sh: 0, ch: 0, st: 0, none: 1 }, rows: document.querySelectorAll('.route-row-item').length }; });

/* ══ 1 ══ */
const m0 = await M();
await page.evaluate(m => window.scrollTo(0, m.mTop + m.mH - innerHeight + 30), m0); await page.waitForTimeout(200);
const m1 = await M();
await page.evaluate(() => window.scrollTo(0, 99999)); await page.waitForTimeout(250);
const mE = await M();
if (mE.list.top === 14 && mE.list.bot <= mE.mBot + 1 && mE.list.ch > 600 && m0.mH > m0.vh * 0.9 && m1.mBot <= m1.vh && m1.y < 700 && m1.doc < m0.mH + 700 && m1.list.top === 14 && m1.list.bot <= m1.vh && m1.list.ch > m0.list.ch && m0.list.bot <= m0.vh) ok(`1 แผงปฏิทินสูง ${m0.mH}px (จอ ${m0.vh}) · เลื่อนหน้า ${m1.y}px ก็เห็นถึงขอบล่าง (เดิมต้องเลื่อนสุดรายการ ~4,000px) · หน้าทั้งหน้าสูง ${m1.doc}px`);
else fail('1 ' + JSON.stringify({ m0, m1 }));

/* ══ 2 ══ */
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(150);
const r2 = await page.evaluate(async () => { const lb = document.getElementById('prog-list-box'); if (!lb) return null; const y0 = scrollY;
  lb.scrollTop = lb.scrollHeight; await new Promise(z => setTimeout(z, 150));
  const rows = [...document.querySelectorAll('.route-row-item')], last = rows[rows.length - 1].getBoundingClientRect(), b = lb.getBoundingClientRect();
  const out = { sh: lb.scrollHeight, ch: lb.clientHeight, boxBot: Math.round(b.bottom), vh: innerHeight, lastVis: last.bottom <= b.bottom + 2 && last.top >= b.top, dy: Math.round(scrollY - y0), rows: rows.length };
  lb.scrollTop = 0; return out; });
if (r2 && r2.sh > r2.ch + 500 && r2.boxBot <= r2.vh && r2.lastVis && r2.dy === 0) ok(`2 รายการ ${r2.rows} โปรแกรมอยู่ในกล่องเลื่อนสูง ${r2.ch}px (เนื้อหา ${r2.sh}px) · เลื่อนถึงตัวสุดท้ายได้ หน้าไม่ขยับ`);
else fail('2 ' + JSON.stringify(r2));

/* ══ 3 · ล้อเมาส์ ══ */
const box = await page.evaluate(() => { const l = (document.getElementById('prog-list-box') || document.querySelector('.route-row-item')).getBoundingClientRect(), m = document.getElementById('prog-detail-mount').getBoundingClientRect(); return { lx: l.left + 120, ly: l.top + 300, mx: m.left + 300, my: Math.min(m.top + 400, innerHeight - 60) }; });
await page.mouse.move(box.lx, box.ly);
for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(40); }
await page.waitForTimeout(250);
const w1 = await M();
await page.mouse.move(box.mx, box.my); await page.mouse.wheel(0, 300); await page.waitForTimeout(300);
const w2 = await M();
if (w1.list.st >= w1.list.sh - w1.list.ch - 2 && w1.y === 0 && w2.y >= 200 && w2.list.st >= w2.list.sh - w2.list.ch - 2 && w2.list.top === 14) ok(`3 หมุนล้อบนรายการจนสุด (${w1.list.st}px) หน้าไม่ขยับ · หมุนล้อบนปฏิทิน หน้าเลื่อน ${w2.y}px`);
else fail('3 ' + JSON.stringify({ w1, w2 }));

/* ══ 4 · กดเลือกท้ายรายการ ══ */
const r4 = await page.evaluate(async () => { window.scrollTo(0, 0); await new Promise(z => setTimeout(z, 250)); const lb = document.getElementById('prog-list-box'); if (!lb) return { none: 1 }; lb.scrollTop = lb.scrollHeight; await new Promise(z => setTimeout(z, 150));
  const st0 = lb.scrollTop, rows = [...document.querySelectorAll('.route-row-item')], tgt = rows[rows.length - 2], rid = tgt.dataset.rid;
  tgt.click(); await new Promise(z => setTimeout(z, 500));
  const lb2 = document.getElementById('prog-list-box'), el = document.querySelector('.route-row-item[data-rid="' + rid + '"]').getBoundingClientRect(), b = lb2.getBoundingClientRect();
  return { st0: Math.round(st0), st1: Math.round(lb2.scrollTop), sel: selProgId === rid, vis: el.top >= b.top - 2 && el.bottom <= b.bottom + 2, same: lb2 !== lb }; });
if (r4.sel && r4.st0 > 500 && Math.abs(r4.st1 - r4.st0) <= 2 && r4.vis && r4.same) ok(`4 กดเลือกโปรแกรมท้ายรายการ · รายการยังอยู่ที่เดิม (${r4.st1}px) · โปรแกรมที่เลือกยังอยู่ในจอ`);
else fail('4 ' + JSON.stringify(r4));

/* ══ 5 · หัววัน ══ */
const r5 = await page.evaluate(() => [...document.querySelectorAll('#prog-detail-mount [data-progwd]')].map(h => ({ t: [...h.children].map(x => x.textContent.trim()), fs: parseFloat(getComputedStyle(h).fontSize), w: Math.min(...[...h.children].map(x => x.scrollWidth <= x.clientWidth + 1 ? 1 : 0)) })));
const want = 'Su Mo Tu We Th Fr Sa';
if (r5.length === 12 && r5.every(h => h.t.join(' ') === want && new Set(h.t).size === 7 && h.fs >= 8 && h.w === 1)) ok(`5 หัววันของทั้ง 12 เดือน "${want}" · ไม่ซ้ำกัน · ${r5[0].fs}px ไม่ล้นช่อง`);
else fail('5 ' + JSON.stringify(r5.slice(0, 2)));

/* ══ 7 · จอแคบ · สองแผงเรียงบน-ล่าง ══ */
await page.setViewportSize({ width: 820, height: 1100 }); await page.waitForTimeout(300);
const r7 = await page.evaluate(async () => { renderSettings(); await new Promise(z => setTimeout(z, 400));
  const lb = document.getElementById('prog-list-box'); if (!lb) return null; const l = lb.getBoundingClientRect(), m = document.getElementById('prog-detail-mount').getBoundingClientRect(), cs = getComputedStyle(lb);
  return { lh: Math.round(l.height), vh: innerHeight, below: m.top >= l.bottom - 1, pos: cs.position, osb: cs.overscrollBehaviorY, sh: lb.scrollHeight }; });
if (r7 && r7.below && r7.lh <= r7.vh * 0.46 && r7.lh >= 260 && r7.pos === 'static' && r7.osb === 'auto' && r7.sh > r7.lh + 500) ok(`7 จอแคบ 820px · รายการเป็นกล่องสูง ${r7.lh}px (≤ ครึ่งจอ) ปฏิทินอยู่ถัดลงไป · ไม่ตรึง ไม่กักการเลื่อน`);
else fail('7 ' + JSON.stringify(r7));

const e1 = errors.filter(e => !/Failed to load resource/.test(e));
if (!e1.length) ok('6 ไม่มี error บนหน้า'); else fail('6 ' + e1.slice(0, 3).join(' | '));
if (process.env.SHOT) { await page.setViewportSize({ width: 2000, height: 1120 }); await page.evaluate(() => renderSettings()); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200); await page.screenshot({ path: process.env.SHOT, clip: { x: 230, y: 230, width: 1100, height: 520 } }); }
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
