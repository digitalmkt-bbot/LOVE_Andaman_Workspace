// §pjPaxLine · ใบงานเรือ · แถว AD / CHD / INF / FOC อยู่บรรทัดเดียวทุกคอลัมน์ แม้ลำเยอะ/จอแคบ
//
// ที่มา (2026-10-14) · owner (screenshot 9 ลำ · FOC ตกลงบรรทัดสอง): "เรียงให้เป็นบรรทัดเดียว"
// กัน
//   1 ทุกช่อง · สี่ตัว (AD CHD INF FOC) อยู่แถวเดียวกัน (offsetTop เท่ากัน) · ไม่มีตัวไหนล้นกล่อง
//   2 ที่จอแคบ 1000px (ช่อง ~117px) ก็ยังบรรทัดเดียวกับเลข 2 หลัก · ตัวเลขไม่ถูกตัด/หัก
//   3 ตัวเลขยังตรงกับยอดจริง (ไม่หายตอนย้ายเข้ากล่อง flex)
//   4 ไม่มี error
import { open } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1100 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(900);
const html = await page.evaluate(() => {
  const pier = 'tublamu';
  const mine = (BOATS || []).filter(x => (x.pier || '') === pier);
  const rts = (ROUTES || []).filter(r => (r.pier || '') === pier);
  const D = '2026-09-16'; TRIPS[D] = {};
  mine.forEach((b, i) => { TRIPS[D][b.id] = { route: (rts[i % rts.length] || ROUTES[0]).id, type: 'normal', booked: 0 }; });
  /* ใส่ยอด 3 หลักให้บางลำ · เคสกว้างสุด */
  _poDate = D; _poPier = pier; _pjF = 'all';
  let cap = ''; const real = window.open;
  window.open = () => ({ focus() {}, document: { open() {}, write(h) { cap += h; }, close() {} } });
  try { pjPrint(); } catch (e) { cap = 'ERR:' + (e && e.message); }
  window.open = real;
  return cap.replace(/<link[^>]+fonts[^>]*>/g, '');
});
/* ยอดสมมุติ · 3 หลัก (เรือใหญ่เต็มลำ) และ 2 หลัก */
const withDigits = (h, d) => h.replace(/<b>(\d+)<\/b><\/span>/g, (m, v) => '<b>' + (d === 3 ? '1' + v.padStart(2, '0') : '4' + v.slice(-1)) + '</b></span>');
const measure = async (w, d) => {
  const p = await page.context().newPage(); await p.setViewportSize({ width: w, height: 900 });
  await p.setContent(withDigits(html, d)); await p.waitForTimeout(500);
  await p.evaluate(() => { const el = document.getElementById('sheet'); if (el) el.style.zoom = ''; });   /* วัดที่ขนาดจริง */
  const m = await p.evaluate(() => {
    const cells = [...document.querySelectorAll('td.pxg')];
    const badc = cells.filter(td => { const sp = [...td.querySelectorAll('span')]; const tops = sp.map(s => s.offsetTop); const box = td.querySelector('.pxw') || td;
      return sp.length !== 4 || Math.max(...tops) - Math.min(...tops) > 2 || box.scrollWidth > box.clientWidth + 1 || sp.some(s => s.scrollWidth > s.clientWidth + 1); });
    const vals = cells.map(td => [...td.querySelectorAll('b')].map(b => b.textContent).join('/'));
    return { n: cells.length, bad: badc.length, vals, colW: cells[0] ? Math.round(cells[0].getBoundingClientRect().width) : 0 };
  });
  await p.close(); return m;
};
const a = await measure(1880, 3);
if (a.n >= 6 && a.bad === 0) ok(`1 ${a.n} คอลัมน์ · เลข 3 หลัก · บรรทัดเดียวทุกช่อง · ช่องกว้าง ${a.colW}px`); else fail('1 ' + JSON.stringify(a));
const b = await measure(1000, 2);
if (b.n >= 6 && b.bad === 0) ok(`2 จอ 1000 · เลข 2 หลัก · บรรทัดเดียวทุกช่อง · ช่องกว้าง ${b.colW}px`); else fail('2 ' + JSON.stringify(b));
if (a.vals.every(v => /^\d+\/\d+\/\d+\/\d+$/.test(v)) && a.vals.some(v => /1\d\d/.test(v))) ok('3 ตัวเลขครบ 4 ตัวทุกช่อง รวมเคส 3 หลัก'); else fail('3 ' + JSON.stringify(a.vals));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('4 no page errors'); else fail('4 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
