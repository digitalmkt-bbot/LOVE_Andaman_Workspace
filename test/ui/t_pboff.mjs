// §pbOff · หน้า By trip · ทริปที่ไม่ออกต้องเห็นชัดที่แถบของทริปนั้นเอง
//
// ที่มา (2026-10-03) · ผู้ใช้ส่งภาพหน้า By trip · "ปรับให้เห็นชัดเจนได้ไหม ว่าทริปไหนที่ไม่ออก"
//   ในภาพ กล่องเตือนเขียนว่า "ทริปนี้ไม่ออกวันนี้" ไม่มีชื่อโปรแกรม ส่วนแถบโปรแกรมข้างล่าง
//   (Early Krabi + Phang Nga) ยังเป็นจุดเขียว ชื่อสีเขียว ป้าย "0/0 full" เหมือนทริปที่ออกปกติ
//
// กันหกอย่าง
//   1 แถบของทริปที่ปิดวันนี้ มีป้าย "ไม่ออกวันนี้" ทึบ มองเห็นจริง · พื้นแถบเป็นแดงอ่อน · ชื่อขีดฆ่าสีแดง
//   2 ป้ายที่นั่งของทริปที่ไม่ออกเขียน closed ไม่ใช่ full
//   3 กล่องเตือนบอกชื่อโปรแกรมที่ไม่ออก + เหตุผล
//   4 ทริปอื่นในวันเดียวกันที่ออกปกติ · ไม่มีป้าย ไม่เปลี่ยนสี
//   5 เปิดทริปกลับ (ลบ override) · ป้ายกับสีหายไป กลับเป็นแถบปกติ
//   6 ไม่มี error บนหน้า
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1000 });
page.on('dialog', async d => { try { await d.accept(); } catch (_) {} });
await goView(page, 'booking', 900);

const S = await page.evaluate(async () => {
  const per = {};
  (SB_BOOKINGS || []).forEach(b => { if (['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)) return;
    (b.trips || []).forEach(t => { if (t && t.date && t.routeId) (per[t.date] = per[t.date] || {})[t.routeId] = 1; }); });
  window.__bands = () => [...document.querySelectorAll('#bkv2-host tr.t2-pband')].map(tr => { const pn = tr.querySelector('.pn'), chip = tr.querySelector('[data-pboff]'), em = tr.querySelector('.ps em'), cs = e => getComputedStyle(e);
    const r = chip ? chip.getBoundingClientRect() : null;
    return { name: pn.textContent, off: tr.classList.contains('off'), chip: chip ? chip.textContent.trim() : '', chipVis: !!(r && r.width > 40 && r.height > 12 && r.left >= 0 && r.right <= innerWidth),
      chipBg: chip ? cs(chip).backgroundColor : '', bg: cs(tr.querySelector('td.pl')).backgroundColor, nmCol: cs(pn).color, strike: /line-through/.test(cs(pn).textDecorationLine || cs(pn).textDecoration), em: em ? em.textContent : '' }; });
  window.__show = async d => { _bkV2.filterDate = d; _bkV2.filterRoute = null; bkV2SwitchTab('bytrip'); await new Promise(z => setTimeout(z, 600)); };
  /* วันที่มี 2+ แถบโปรแกรมบนจอ และทุกแถบเป็นทริปที่ออกปกติ */
  for (const d of Object.keys(per).sort()) { if (Object.keys(per[d]).length < 2) continue; await __show(d);
    const B = __bands(); if (B.length < 2 || B.some(b => b.off)) continue;
    const names = B.map(b => b.name), r0 = (ROUTES || []).filter(r => r.name === names[0]);
    if (r0.length !== 1 || new Set(names).size !== names.length) continue;
    return { d, rid: r0[0].id, name: names[0], other: names[1], before: B }; }
  return null;
});
if (!S) { fail('no day with 2+ running programmes in this data set'); await close(); process.exit(1); }

const A = await page.evaluate(async p => { const r = ROUTES.find(x => x.id === p.rid); r.overrides = r.overrides || {}; r.overrides[p.d] = 'closed';
  await __show(p.d); const nr = document.querySelector('#bkv2-host .t2-notrun');
  return { bands: __bands(), banner: nr ? nr.textContent.replace(/\s+/g, ' ').trim() : '', bnm: nr && nr.querySelector('[data-notrun-nm]') ? nr.querySelector('[data-notrun-nm]').textContent : '', nBanner: document.querySelectorAll('#bkv2-host .t2-notrun').length }; }, S);
const me = A.bands.find(b => b.name === S.name), oth = A.bands.filter(b => b.name !== S.name), was = S.before.find(b => b.name === S.name);

if (me && me.off && /ไม่ออกวันนี้|Not running today/.test(me.chip) && me.chipVis && me.chipBg === 'rgb(163, 45, 45)' && me.bg === 'rgb(252, 235, 235)' && me.bg !== was.bg && me.strike && me.nmCol === 'rgb(163, 45, 45)')
  ok(`1 แถบ "${S.name}" (${S.d}) · ป้ายทึบ "${me.chip}" · พื้นแดงอ่อน · ชื่อขีดฆ่าสีแดง`);
else fail('1 ' + JSON.stringify({ me, was }));
if (me && me.em === 'closed') ok('2 ป้ายที่นั่งของทริปที่ไม่ออกเขียน closed (เดิม "' + was.em + '")'); else fail('2 ' + JSON.stringify(me && me.em));
if (A.nBanner === 1 && A.bnm === S.name && /override/.test(A.banner) && /ไม่ออกวันนี้|Not running today/.test(A.banner)) ok(`3 กล่องเตือนบอกชื่อ · "${A.banner.slice(0, 80)}…"`);
else fail('3 ' + JSON.stringify({ n: A.nBanner, bnm: A.bnm, banner: A.banner.slice(0, 120) }));
const b4 = oth.filter(b => b.off || b.chip || b.strike || b.bg === 'rgb(252, 235, 235)' || b.em === 'closed');
if (oth.length >= 1 && !b4.length) ok(`4 ทริปอื่นที่ออกปกติ (${oth.length} แถบ เช่น "${oth[0].name}") ไม่มีป้าย ไม่เปลี่ยนสี`); else fail('4 ' + JSON.stringify(b4));

const R = await page.evaluate(async p => { const r = ROUTES.find(x => x.id === p.rid); delete r.overrides[p.d]; await __show(p.d);
  return { bands: __bands(), nBanner: document.querySelectorAll('#bkv2-host .t2-notrun').length }; }, S);
const back = R.bands.find(b => b.name === S.name);
if (back && !back.off && !back.chip && !back.strike && back.bg === was.bg && back.nmCol === was.nmCol && back.em === was.em && R.nBanner === 0) ok('5 เปิดทริปกลับ · แถบกลับเป็นปกติ กล่องเตือนหาย');
else fail('5 ' + JSON.stringify({ back, was, n: R.nBanner }));

const e1 = errors.filter(e => !/Failed to load resource/.test(e));
if (!e1.length) ok('6 ไม่มี error บนหน้า'); else fail('6 ' + e1.slice(0, 3).join(' | '));
await page.evaluate(async p => { const r = ROUTES.find(x => x.id === p.rid); r.overrides[p.d] = 'closed'; await __show(p.d); window.scrollTo(0, 0); }, S);
if (process.env.SHOT) { const el = await page.$('#bkv2-host .t2-trip-closed'); if (el) await el.screenshot({ path: process.env.SHOT }); }
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
