// §pjOneLine · ใบงานเรือ (pjPrint) · ชื่อคนหนึ่งคน = หนึ่งบรรทัด · ชื่อสีสายรัดข้อมือบน Departures ไม่ตกบรรทัด
//
// ที่มา (2026-10-14) · owner (screenshot Tub Lamu 9 ลำ · ชื่อตัดกลางชื่อเล่น "(บัง / สัน)", ป้ายสี "ชม / พู"): "ปรับให้อยู่บรรทัดเดียวกัน"
// กัน
//   1 ≥6 ลำ (Departures สองคอลัมน์) · ป้ายสีทุกอันสูงบรรทัดเดียว
//   2 ชื่อลูกเรือยาว ๆ (ชื่อสมมุติ) · ทุกชื่อสูงบรรทัดเดียว และไม่ล้นช่อง (ไม่ถูกตัด ...)
//   3 ชื่อสั้นยังเป็นขนาดปกติ (ไม่ย่อทั้งใบ) · ชื่อยาวย่อแต่ไม่ต่ำกว่า 62%
//   4 ปิดพอดีจอ (ขนาดจริง) ก็ยังบรรทัดเดียว · สื่อพิมพ์ก็บรรทัดเดียว · ชื่อยาวผิดปกติจนย่อสุดแล้วยังล้น → ตกบรรทัด ไม่ถูกตัด
//   5 ไม่มี error
//   6 (§pjOneLine2 · owner "บรรทัดยังไม่เต็มเลย") ใบไม่พึ่งหน่วย cqi / container query · ขนาดชื่อที่ย่อเป็น px ใส่ตรงที่ตัวชื่อ
//     เบราว์เซอร์ที่ไม่รู้จัก cqi ทิ้งกฎทั้งบรรทัด ชื่อเลยไม่ย่อแล้วตกบรรทัดเต็มขนาด
import { open } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1100 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(900);
const html = await page.evaluate(() => {
  const pier = 'tublamu';
  const mine = (BOATS || []).filter(x => (x.pier || '') === pier).slice(0, 9);
  const rts = (ROUTES || []).filter(r => (r.pier || '') === pier);
  const D = '2026-09-16'; TRIPS[D] = {};
  mine.forEach((b, i) => { TRIPS[D][b.id] = { route: (rts[i % rts.length] || ROUTES[0]).id, type: 'normal', booked: 0 }; });
  window.PIER_STAFF = PIER_STAFF || [];
  const N = ['นายสมมุติ ผกามาศทอง (บังสันต์)', 'นายตัวอย่าง กล้าทะเลลึก (ซอแมะ)', 'นาย ก ข (ค)', 'นายทดสอบ ทับสมุทรทอง (บังหยา)'];
  N.forEach((n, i) => PIER_STAFF.push({ id: 'zz_ol' + i, name: n, role: 'กัปตัน', pier, active: true }));
  mine.forEach((b, i) => pjSet(D, b.id, { cap: 'zz_ol' + (i % 4), asst: 'zz_ol' + ((i + 1) % 4), crew: ['zz_ol' + ((i + 3) % 4)], island: [] }));
  const WB = [['ชมพู', '#D9607A'], ['เขียว', '#5ED35E'], ['น้ำเงิน', '#1E2FD8'], ['ฟ้า TQ', '#5BC0DE'], ['น้ำตาล', '#7A4A1E']];
  mine.forEach((b, i) => pjSet(D, b.id, { wb: WB[i % 5][0], wbc: WB[i % 5][1] }));
  _poDate = D; _poPier = pier; _pjF = 'all';
  let cap = ''; const real = window.open;
  window.open = () => ({ focus() {}, document: { open() {}, write(h) { cap += h; }, close() {} } });
  try { pjPrint(); } catch (e) { cap = 'ERR:' + (e && e.message); }
  window.open = real;
  return cap.replace(/<link[^>]+fonts[^>]*>/g, '');
});
if (html.indexOf('ERR:') === 0) { fail('pjPrint ' + html); await close(); process.exit(1); }
if (!/cqi|container-type/.test(html)) ok('6a ใบไม่ใช้ cqi / container-type'); else fail('6a ใบยังใช้ cqi / container-type');
const p = await page.context().newPage(); await p.setViewportSize({ width: 1500, height: 900 });
await p.setContent(html); await p.waitForTimeout(900);
const M = () => p.evaluate(() => {
  const lh = el => parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.4;
  const one = el => el.getBoundingClientRect().height <= lh(el) * 1.25 * (parseFloat(document.getElementById('sheet').style.zoom) || 1) + 1;
  const bands = [...document.querySelectorAll('.brd .bandc')];
  const names = [...document.querySelectorAll('.pn1')];
  return {
    nb: bands.length, bandsOne: bands.filter(one).length,
    nn: names.length, namesOne: names.filter(one).length,
    clipped: names.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent),
    fs: names.map(el => parseFloat(getComputedStyle(el).fontSize)),
    txt: names.map(el => el.textContent), two: !!document.querySelector('.brd2'),
  };
});
const a = await M();
if (a.two && a.nb >= 6 && a.bandsOne === a.nb) ok(`1 ป้ายสี ${a.nb} อัน บรรทัดเดียวทั้งหมด`); else fail('1 ' + JSON.stringify({ two: a.two, nb: a.nb, one: a.bandsOne }));
if (a.nn >= 18 && a.namesOne === a.nn && !a.clipped.length) ok(`2 ชื่อ ${a.nn} ช่อง บรรทัดเดียว · ไม่ถูกตัด`); else fail('2 ' + JSON.stringify({ nn: a.nn, one: a.namesOne, clipped: a.clipped.slice(0, 4) }));
const px = await p.evaluate(() => [...document.querySelectorAll('.pn1')].filter(el => el.style.fontSize).map(el => el.style.fontSize));
if (px.length && px.every(v => /^[\d.]+px$/.test(v))) ok(`6b ชื่อที่ย่อ ${px.length} ช่อง ใส่ขนาดเป็น px (${px[0]})`); else fail('6b ' + JSON.stringify(px));
const base = Math.max(...a.fs), sh = a.fs[a.txt.indexOf('นาย ก ข (ค)')], lg = Math.min(...a.fs);
if (sh === base && lg < base && lg >= base * 0.62 - 0.1) ok(`3 ชื่อสั้น ${sh}px (ปกติ) · ชื่อยาวสุดย่อเหลือ ${lg.toFixed(1)}px`); else fail('3 ' + JSON.stringify({ base, sh, lg }));
await p.click('#bfit'); await p.waitForTimeout(250); const b = await M();
await p.emulateMedia({ media: 'print' }); await p.waitForTimeout(150); const c = await M(); await p.emulateMedia({ media: 'screen' });
if (b.namesOne === b.nn && !b.clipped.length && c.namesOne === c.nn && !c.clipped.length && c.bandsOne === c.nb) ok('4 ขนาดจริง / สื่อพิมพ์ · บรรทัดเดียวเหมือนกัน'); else fail('4 ' + JSON.stringify({ b: [b.namesOne, b.nn, b.clipped.slice(0, 3)], c: [c.namesOne, c.nn, c.clipped.slice(0, 3), c.bandsOne, c.nb] }));
const x = await p.evaluate(() => { const el = [...document.querySelectorAll('.pn1')][0]; el.innerHTML = 'นายสมมุติ ทดลองยาวมากผิดปกติเป็นพิเศษ (บังสันติภาพยาวมาก)'; el.style.removeProperty('--r');
  window.dispatchEvent(new Event('resize')); return new Promise(z => setTimeout(() => z({ wr: el.classList.contains('wr'), clipped: el.scrollWidth > el.clientWidth + 1 }), 500)); });
if (x.wr && !x.clipped) ok('4b ชื่อยาวผิดปกติ · ยอมตกบรรทัดแทนถูกตัด'); else fail('4b ' + JSON.stringify(x));
if (process.env.SHOT) { await p.click('#bfit'); await p.waitForTimeout(300); await p.screenshot({ path: process.env.SHOT }); }
await p.close();
if (errors.length) fail('errors: ' + errors.join(' | ')); else ok('5 ไม่มี error');
await close();
console.log(bad ? `FAIL ${bad}` : 'PASS'); process.exit(bad ? 1 : 0);
