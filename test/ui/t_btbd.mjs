// §btBd · Booking by trip · การ์ด Programmes + Boats running แยก AD / CHD / INF / FOC
// ที่มา (2026-10-17) · owner "หน้าโปรแกรม อยากได้เพิ่มที่แยก AD CHD INF FOC แต่จะทำยังไงไม่ให้ดูรก
//   · Boat Running ของเรือแต่ละลำ ก็อยากเห็นแยก AD CHD INF FOC"
// ข้อมูลทดสอบ: คัดลอกใบจองในหน่วยความจำไปลงหลายรอบของ Phi Phi + Krabi และวางเรือใน TRIPS (ไม่บันทึกอะไร)
// กัน
//   1 แถวรอบ: A+C+I+F = ตัวเลขที่จองของแถวนั้น · ทุกแถวรอบที่มีคนจองมีตัวแยก
//   2 แถวหัวโปรแกรมที่วิ่งหลายรอบ = ผลรวมของแถวรอบ · โปรแกรมที่วิ่งรอบเดียวไม่แสดงซ้ำ
//   3 ไม่รก: ไม่มีตัวที่เป็น 0 · FOC ตัวเลขสีแดง · แถวรอบไม่สูงขึ้น (ทุกแถวสูงเท่าเดิม ≤ 23px)
//   4 Boats running: ใต้ Booked = ตัวเลข Booked · แต่ละลำ = ยอดคนบนลำนั้น
//   5 ชี้เมาส์เห็นครบสี่ตัว (รวมตัวที่เป็น 0)
//   6 ผิว Classic ก็ขึ้น · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1440, height: 1000 });
await goView(page, 'booking', 900);
const G = await page.evaluate(() => {
  const c = {};
  (SB_BOOKINGS || []).forEach(b => { if (['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)) return;
    (b.trips || []).forEach(t => { if (t && t.date) c[t.date] = (c[t.date] || 0) + 1; }); });
  const day = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
  const bs = (BOATS || []).filter(x => x && x.id);
  const plan = [['r7', [0, 1]], ['r8', [2]], ['r9', [3]], ['r11', [4]]];
  TRIPS[day] = TRIPS[day] || {};
  plan.forEach(([rid, ix]) => ix.forEach(i => { if (bs[i]) TRIPS[day][bs[i].id] = { route: rid, type: 'normal', booked: 0 }; }));
  const src = (SB_BOOKINGS || []).filter(b => (b.trips || []).some(t => t.date === day)).slice(0, 8);
  let n = 0;
  plan.forEach(([rid, ix]) => { for (let k = 0; k < 6; k++) { const b = JSON.parse(JSON.stringify(src[(n++) % src.length]));
    b.id = 'ZZBD' + n; b.status = 'confirmed'; const t = JSON.parse(JSON.stringify(b.trips.find(t => t.date === day))); b.trips = [t];
    t.routeId = rid; t.bookingMode = 'seat';
    t.pax = { ad_fr: 2 + ((n * 5) % 7), chd_fr: (n % 3 === 0) ? 1 + (n % 2) : 0, inf_fr: (n % 5 === 0) ? 1 : 0, foc: (n % 8 === 0) ? 1 : 0 };
    b.ops = { boatId: bs[ix[k % ix.length]].id }; SB_BOOKINGS.push(b); } });
  _bkV2.filterDate = day; _bkV2.filterRoute = null; btcSet('compact'); bookingV2SwitchTab('bytrip');
  return { day };
});
await page.waitForTimeout(1500);
const bdv = el => { const o = { ad: 0, chd: 0, inf: 0, foc: 0 }; if (!el) return null;
  el.querySelectorAll(':scope > span').forEach(s => { o[s.className] = +s.querySelector('b').textContent; }); return o; };
const A = await page.evaluate(() => {
  const rd = el => { if (!el) return null; const o = { ad: 0, chd: 0, inf: 0, foc: 0 }; el.querySelectorAll(':scope > span').forEach(s => { o[s.className] = +s.querySelector('b').textContent; }); return o; };
  const out = { fams: [], vars: [] }; let cur = null;
  [...document.querySelectorAll('.bt-prog .bt-pgbody > *')].forEach(el => {
    if (el.classList.contains('bt-pgf')) { cur = { name: el.querySelector('.nm').textContent, bd: rd(el.querySelector('.bt-bd')), vars: [] }; out.fams.push(cur); return; }
    if (!el.classList.contains('bt-pgv') || el.classList.contains('off')) return;
    const st = el.querySelector('.st b'); const v = { name: (el.querySelector('.vn') || {}).textContent, seat: st ? +st.textContent : null,
      bd: rd(el.querySelector('.bt-bd')), h: Math.round(el.getBoundingClientRect().height) };
    out.vars.push(v); if (cur) cur.vars.push(v); });
  const all = [...document.querySelectorAll('.bt-c .bt-bd')];
  out.zero = all.some(e => /(^|\D)0[ACIF]/.test(e.textContent.replace(/\s+/g, '')));
  const f = document.querySelector('.bt-c .bt-bd .foc b'); out.focCol = f ? getComputedStyle(f).color : null;
  const t = document.querySelector('.bt-prog .bt-pgv .bt-bd'); out.title = t ? t.title : '';
  return out; });
const sum = o => o ? o.ad + o.chd + o.inf + o.foc : 0;
const withPax = A.vars.filter(v => v.seat > 0);
if (withPax.length >= 4 && withPax.every(v => v.bd && sum(v.bd) === v.seat)) ok('1 แถวรอบ ' + withPax.length + ' แถว · A+C+I+F = ตัวเลขที่จองทุกแถว (เช่น ' + withPax[0].name + ' ' + withPax[0].seat + ' = ' + JSON.stringify(withPax[0].bd) + ')');
else fail('1 ' + JSON.stringify(A.vars));
const multi = A.fams.filter(f => f.vars.length > 1), single = A.fams.filter(f => f.vars.length === 1);
const famOk = multi.length && multi.every(f => f.bd && ['ad', 'chd', 'inf', 'foc'].every(k => f.bd[k] === f.vars.reduce((s, v) => s + (v.bd ? v.bd[k] : 0), 0)));
if (famOk && single.length && single.every(f => !f.bd)) ok('2 หัวโปรแกรมหลายรอบ = ผลรวมของรอบ (' + multi.map(f => f.name).join(', ') + ') · รอบเดียวไม่แสดงซ้ำ (' + single.map(f => f.name).join(', ') + ')');
else fail('2 ' + JSON.stringify(A.fams));
if (!A.zero && A.focCol === 'rgb(163, 45, 45)' && A.vars.every(v => v.h <= 23)) ok('3 ไม่มีตัวที่เป็น 0 · FOC สีแดง · แถวรอบสูงไม่เกิน ' + Math.max(...A.vars.map(v => v.h)) + 'px');
else fail('3 ' + JSON.stringify({ zero: A.zero, foc: A.focCol, h: A.vars.map(v => v.h) }));
if (/^AD \d+ · CHD \d+ · INF \d+ · FOC \d+$/.test(A.title)) ok('5 ชี้เมาส์ได้ "' + A.title + '"'); else fail('5 ' + A.title);

await page.evaluate(() => bookingV2Tab2SetRoute('r7')); await page.waitForTimeout(1400);
const B = await page.evaluate(() => {
  const rd = el => { if (!el) return null; const o = { ad: 0, chd: 0, inf: 0, foc: 0 }; el.querySelectorAll(':scope > span').forEach(s => { o[s.className] = +s.querySelector('b').textContent; }); return o; };
  const c = document.querySelector('.bt-c.bt-boat'); const avs = [...c.querySelectorAll('.bt-avrow .bt-av')];
  const bk = avs.find(a => /Booked/.test(a.querySelector('.k').textContent));
  return { booked: +bk.querySelector('.v').textContent, bd: rd(bk.querySelector('.bt-bd')),
    rows: [...c.querySelectorAll('.bt-brow')].map(r => ({ nm: r.querySelector('.nm').textContent, ld: parseInt(r.querySelector('.ld').textContent, 10), bd: rd(r.querySelector('.bt-bd')) })) }; });
if (B.bd && sum(B.bd) === B.booked && B.rows.length >= 2 && B.rows.every(r => r.bd && sum(r.bd) === r.ld))
  ok('4 Boats running · ใต้ Booked ' + B.booked + ' = ' + JSON.stringify(B.bd) + ' · ' + B.rows.map(r => r.nm + ' ' + r.ld).join(' / ') + ' แยกครบทุกลำ');
else fail('4 ' + JSON.stringify(B));

const C = await page.evaluate(async () => { btcSet('classic'); await new Promise(r => setTimeout(r, 1000));
  return { v: document.querySelectorAll('.bt-prog .bt-pgv .bt-bd').length, b: document.querySelectorAll('.bt-boat .bt-brow .bt-bd').length }; });
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (C.v >= 4 && C.b >= 2 && !e1.length) ok('6 ผิว Classic ก็ขึ้น (' + C.v + ' แถวรอบ · ' + C.b + ' ลำ) · ไม่มี error');
else fail('6 ' + JSON.stringify(C) + ' ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
