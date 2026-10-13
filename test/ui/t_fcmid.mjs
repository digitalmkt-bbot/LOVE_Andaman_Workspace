// §fcMid / §fcFull · Fleet Calendar · ชื่อหน้าอยู่กลางแถบ · ชื่อโปรแกรมเป็นชื่อเต็ม
//
// ที่มา (2026-10-03) · ผู้ใช้ส่งภาพหน้า Fleet Calendar
//   "ปรับตำแหน่งของ Fleet Calendar ให้อยู่ตรงกลางหน่อย · ชื่อโปรแกรม ขอชื่อเต็มหน่อย"
//   ในภาพชื่อหน้าเอียงซ้าย และคอลัมน์โปรแกรมเป็นตัวย่อ S · ETS · PPB · WSP (S ซ้ำกันสามแถว)
//
// กันหกอย่าง
//   1 จอกว้าง · จุดกึ่งกลางของชื่อหน้าตรงกับกึ่งกลางของแถบ (±2px)
//   2 จอแคบลง · ชื่อหน้าไม่ทับกลุ่มปุ่มซ้ายหรือกลุ่มขวา
//   3 มุมมอง 14 วัน · ชื่อโปรแกรมทุกแถวเป็นชื่อเต็มตามทะเบียนเส้นทาง ไม่ใช่ตัวย่อ
//   4 ชื่อเต็มไม่ถูกตัด (ไม่มี … · ไม่ล้นช่อง · ยาวก็ตกบรรทัด) และไม่มีสองแถวที่ชื่อซ้ำกันเพราะย่อ
//   5 จอ 390px · มุมมอง 14 วันยังใช้ตัวย่อ (คอลัมน์ซ้ายแคบ) · มุมมอง 7 วันชื่อเต็ม · หน้าไม่ล้นแนวนอน
//   6 ไม่มี error บนหน้า
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

/* วันที่มีเรือวิ่งมากที่สุดของชุดข้อมูล · หน้านี้เปิดที่วันนี้ ซึ่งชุดทดสอบไม่มีงาน */
const seed = () => { const c = {}; Object.keys(TRIPS || {}).forEach(d => { c[d] = Object.values(TRIPS[d] || {}).filter(o => o && !Array.isArray(o) && o.route).length; });
  const d = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; _fc.from = d; _fc.mode = 'm14'; _fc.pier = 'all'; renderFleetCal(); return d; };
const top = () => { const T = document.querySelector('.fc-top').getBoundingClientRect(), B = document.querySelector('.fc-brand').getBoundingClientRect(),
  L = document.querySelector('.fc-tl').getBoundingClientRect(), R = document.querySelector('.fc-tr').getBoundingClientRect();
  return { off: Math.round((B.left + B.width / 2) - (T.left + T.width / 2)), gapL: Math.round(B.left - L.right), gapR: Math.round(R.left - B.right), w: Math.round(T.width), oneRow: Math.abs(L.top - R.top) < 20 }; };
const labels = () => [...document.querySelectorAll('.fc-mt tr.fc-pr th.fc-rn .nm')].filter(n => n.querySelector('.fl')).map(n => {
  const fl = n.querySelector('.fl'), ab = n.querySelector('.ab'), th = n.closest('th'), vis = e => e && getComputedStyle(e).display !== 'none';
  return { full: fl.textContent, abbr: ab ? ab.textContent : '', showFull: vis(fl), showAbbr: vis(ab), title: n.title,
    clip: n.scrollWidth > n.clientWidth + 1 || getComputedStyle(n).textOverflow === 'ellipsis',
    out: n.getBoundingClientRect().right > th.getBoundingClientRect().right + 1, known: (ROUTES || []).some(r => r.name === fl.textContent) }; });

{
  const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1100 });
  await goView(page, 'fleetcal', 1000);
  const day = await page.evaluate(seed); await page.waitForTimeout(400);

  const t1 = await page.evaluate(top);
  if (Math.abs(t1.off) <= 2 && t1.oneRow) ok(`1 จอ 1700 · ชื่อหน้าอยู่กลางแถบ (เพี้ยน ${t1.off}px จากแถบกว้าง ${t1.w}px)`);
  else fail('1 ' + JSON.stringify(t1));

  await page.setViewportSize({ width: 1180, height: 1000 }); await page.waitForTimeout(300);
  const t2 = await page.evaluate(top);
  if (t2.gapL >= 4 && t2.gapR >= 4) ok(`2 จอ 1180 (แถบ ${t2.w}px) · ชื่อหน้าไม่ทับปุ่มสองข้าง (ห่าง ${t2.gapL}/${t2.gapR}px · เลื่อนจากกลาง ${t2.off}px)`);
  else fail('2 ' + JSON.stringify(t2));
  await page.setViewportSize({ width: 1700, height: 1100 }); await page.waitForTimeout(300);

  const L = await page.evaluate(labels);
  const b3 = L.filter(x => !x.showFull || x.showAbbr || !x.known || x.title !== x.full);
  if (L.length >= 2 && !b3.length) ok(`3 มุมมอง 14 วัน (${day}) · ${L.length} แถวโปรแกรม ขึ้นชื่อเต็มตามทะเบียน เช่น "${L[0].full}"`);
  else fail('3 ' + L.length + ' rows · ' + JSON.stringify(b3.slice(0, 3)));
  const names = L.map(x => x.full), dupFull = names.length - new Set(names).size;
  const abbrs = L.map(x => x.abbr), dupAbbr = abbrs.length - new Set(abbrs).size;
  const b4 = L.filter(x => x.clip || x.out);
  if (!b4.length && dupFull === 0) ok(`4 ชื่อเต็มไม่ถูกตัดและไม่ล้นช่อง · ไม่มีชื่อซ้ำ (ตัวย่อเดิมซ้ำกัน ${dupAbbr} แถว)`);
  else fail('4 ' + JSON.stringify({ clipped: b4.slice(0, 3), dupFull }));
  const e1 = errors.filter(e => !/Failed to load resource/.test(e)); if (e1.length) fail('6 errors: ' + e1.slice(0, 2).join(' | '));
  await close();
}
{
  const { page, errors, close } = await open({ blob: process.env.LAD, width: 390, height: 844 });
  await goView(page, 'fleetcal', 1000);
  await page.evaluate(seed); await page.waitForTimeout(400);
  const m14 = await page.evaluate(labels);
  const ovf = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.evaluate(() => fcSetMode('m7')); await page.waitForTimeout(400);
  const m7 = await page.evaluate(labels);
  if (m14.length && m14.every(x => x.showAbbr && !x.showFull) && m7.length && m7.every(x => x.showFull && !x.abbr) && ovf <= 1)
    ok(`5 จอ 390 · 14 วันใช้ตัวย่อ (${m14[0].abbr}) · 7 วันชื่อเต็ม · หน้าไม่ล้นแนวนอน`);
  else fail('5 ' + JSON.stringify({ m14: m14.slice(0, 2), m7: m7.slice(0, 2), ovf }));
  const e2 = errors.filter(e => !/Failed to load resource/.test(e));
  if (!e2.length) ok('6 ไม่มี error บนหน้า'); else fail('6 errors: ' + e2.slice(0, 2).join(' | '));
  await close();
}
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
