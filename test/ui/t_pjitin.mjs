// §pjItin · ใบงานเรือ · เส้นทางเกาะของลำนี้วันนี้ (แต้มสีได้) + Section A แบบใหม่
// ที่มา (2026-10-16) · owner "จัด Section A ให้สวยกว่านี้ · ไฮไลต์สีเส้นทางอ่อน ๆ · ให้ User เพิ่มรายละเอียดของเส้นทาง เช่น เกาะ 4 → เกาะ 8"
//   รอบสอง "สีเอาเฉพาะแค่ชื่อโปรแกรม ให้เท่ากันทั้งหมดก็พอ · ถัดไปเป็นรายละเอียดที่เราเพิ่ม แต่อยากให้แต้มสีได้ด้วย"
// กัน
//   1 pjItinSet เปลี่ยน -> และ > เป็น → · เก็บต่อเรือต่อวัน (วันอื่นไม่โดน) · ล้างว่าง = กลับไปใช้เกาะของเส้นทาง
//   2 การ์ดเรือ: ช่อง .pj-itin มีค่าที่กรอก (class own) · ลำที่ไม่กรอกขึ้นเกาะของเส้นทางเป็น placeholder · มีจุดแต้มสี
//   3 pjItinColor: สีถูกเก็บ · ค่าไม่ใช่ hex ไม่ถูกเก็บ · '' = ไม่แต้มสี
//   4 พิมพ์ ≤5 ลำ: ป้ายโปรแกรมทุกแถวกว้างเท่ากัน มีสีเส้นทาง · แถวไม่มีพื้นสี · เส้นทางเกาะเป็นชิป 3 อันสีตามที่แต้ม
//     ลำที่ไม่กรอกโชว์เกาะของเส้นทาง (dflt)
//   5 พิมพ์ ≥6 ลำ: สองตาราง · ป้ายกว้างเท่ากันในตาราง · เกาะตั้งต้นซ่อน · ที่กรอกเองยังขึ้น · 6 ไม่มี error
import { open } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1000 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(900);
const D = '2026-09-16', D2 = '2026-09-17';
const setup = n => page.evaluate(([n, D]) => {
  window.poGuard = () => true; window.poCanEdit = () => true;
  const pier = 'tublamu', mine = (BOATS || []).filter(x => (x.pier || '') === pier);
  const want = ['r2', 'r1', 'r4', 'r5', 'r3', 'r6', 'r2', 'r1'];
  ROUTES.forEach(r => { if (r.id === 'r2') r.color = '#D9761F'; if (r.id === 'r1') r.color = '#7C3AED'; });
  TRIPS[D] = {}; mine.slice(0, n).forEach((b, i) => { TRIPS[D][b.id] = { route: want[i], type: 'normal', booked: 0 }; });
  _poDate = D; _poPier = pier; _pjF = 'all';
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const v = document.getElementById('view-poj-' + pier); if (v) v.classList.add('active');
  renderPierJob(pier);
  return Object.keys(TRIPS[D]);
}, [n, D]);
const print = () => page.evaluate(() => { let cap = ''; const real = window.open;
  window.open = () => ({ focus() {}, document: { open() {}, write(h) { cap += h; }, close() {} } });
  pjPrint(); window.open = real; return cap.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<link[^>]+fonts[^>]*>/g, ''); });
const inSheet = async (html, fn) => { const p = await page.context().newPage(); await p.setViewportSize({ width: 1500, height: 1000 });
  await p.setContent(html); await p.waitForTimeout(200); const r = await p.evaluate(fn); await p.close(); return r; };

// 1
const ids = await setup(4);
const b0 = ids[0], b1 = ids[1];
const r1 = await page.evaluate(([b0, D, D2]) => {
  pjItinSet(b0, 'เกาะ 4 -> เกาะ 8 > เกาะ 9');
  const a = (PIER_JOB[pjKey(D, b0)] || {}).itin, other = (PIER_JOB[pjKey(D2, b0)] || {}).itin;
  _poDate = D2; pjItinSet(b0, 'x'); pjItinSet(b0, ''); const cleared = pjItinOf(D2, b0, ROUTES.find(r => r.id === 'r2'));
  _poDate = D; return { a, other: other || '', cleared, isl: String((ROUTES.find(r => r.id === 'r2') || {}).islands || '').trim() }; }, [b0, D, D2]);
if (r1.a === 'เกาะ 4 → เกาะ 8 → เกาะ 9' && !r1.other && !r1.cleared.own && r1.cleared.t === r1.isl)
  ok('1 "-> / >" เป็น → · เก็บต่อเรือต่อวัน · ล้างว่างกลับไปใช้เกาะของเส้นทาง (' + r1.cleared.t + ')');
else fail('1 ' + JSON.stringify(r1));

// 2
const r2 = await page.evaluate(([b0, b1]) => { renderPierJob(_poPier);
  const f = b => [...document.querySelectorAll('.pj-itin')].find(i => (i.getAttribute('onchange') || '').indexOf("'" + b + "'") > 0);
  const i0 = f(b0), i1 = [...document.querySelectorAll('.pj-itin')].find(i => i !== i0);
  return { v0: i0 && i0.value, own0: i0 && i0.classList.contains('own'), v1: i1 && i1.value, ph1: i1 && i1.placeholder, sw: document.querySelectorAll('.pj-itc').length }; }, [b0, b1]);
if (r2.v0 === 'เกาะ 4 → เกาะ 8 → เกาะ 9' && r2.own0 && r2.v1 === '' && r2.ph1 && r2.sw >= 2) ok('2 การ์ด: ช่องเส้นทางเกาะมีค่าที่กรอก · ลำอื่นขึ้น "' + r2.ph1 + '" เป็นตัวจาง · มีจุดแต้มสี');
else fail('2 ' + JSON.stringify(r2));

// 3
const r3 = await page.evaluate(([b0, b1, D]) => { pjItinColor(b0, '#D9761F'); pjItinColor(b1, 'red'); const c0 = pjItinOf(D, b0).c, c1 = pjItinOf(D, b1).c;
  pjItinColor(b1, '#0F6E56'); pjItinColor(b1, ''); return { c0, c1, c1b: pjItinOf(D, b1).c }; }, [b0, b1, D]);
if (r3.c0 === '#D9761F' && r3.c1 === '' && r3.c1b === '') ok('3 แต้มสีเก็บได้ · "red" ไม่ถูกเก็บ · "" = ไม่แต้มสี'); else fail('3 ' + JSON.stringify(r3));

// 4
const h4 = await print();
const r4 = await inSheet(h4, () => { const rows = [...document.querySelectorAll('.brd tbody tr.br')];
  const pills = rows.map(r => r.querySelector('td.c-p .pnm')); const w = pills.map(p => Math.round(p.getBoundingClientRect().width));
  const own = rows.find(r => r.querySelectorAll('td.c-i .itn i').length === 3);
  const dflt = rows.filter(r => r.querySelector('td.c-i .itn.dflt'));
  return { n: rows.length, two: !!document.querySelector('.brd2'), w, pillBg: getComputedStyle(pills[0]).backgroundColor,
    rowBg: getComputedStyle(rows[0].querySelector('td.c-t')).backgroundColor,
    chips: own ? [...own.querySelectorAll('td.c-i .itn i')].map(i => i.textContent) : null,
    arrow: own ? getComputedStyle(own.querySelector('td.c-i .itn u')).color : '', chipBg: own ? getComputedStyle(own.querySelector('td.c-i .itn i')).backgroundColor : '',
    nDflt: dflt.length, dfltShown: dflt.every(r => getComputedStyle(r.querySelector('.itn.dflt')).display !== 'none') }; });
const same4 = r4.w.length && r4.w.every(x => Math.abs(x - r4.w[0]) <= 1);
if (r4.n >= 3 && !r4.two && same4 && r4.pillBg !== 'rgba(0, 0, 0, 0)' && /rgba\(0, 0, 0, 0\)|rgb\(255, 255, 255\)/.test(r4.rowBg)
  && JSON.stringify(r4.chips) === '["เกาะ 4","เกาะ 8","เกาะ 9"]' && r4.arrow === 'rgb(217, 118, 31)' && r4.chipBg !== 'rgb(255, 255, 255)' && r4.nDflt >= 1 && r4.dfltShown)
  ok('4 ≤5 ลำ: ป้ายโปรแกรมกว้างเท่ากัน ' + r4.w[0] + 'px มีสีเส้นทาง · แถวพื้นขาว · ชิป 3 อันสีส้มตามที่แต้ม · ลำอื่นโชว์เกาะตั้งต้น');
else fail('4 ' + JSON.stringify(r4));

// 5
await setup(8);
await page.evaluate(([b0]) => { pjItinSet(b0, 'เกาะ 4 -> เกาะ 8'); }, [b0]);
const h5 = await print();
const r5 = await inSheet(h5, () => { const T = [...document.querySelectorAll('.brd2 .brd')];
  const w = T.map(t => [...t.querySelectorAll('td.c-p .pnm')].map(p => Math.round(p.getBoundingClientRect().width)));
  const dflt = [...document.querySelectorAll('.itn.dflt')].filter(e => getComputedStyle(e).display !== 'none').length;
  const own = [...document.querySelectorAll('td.c-i .itn:not(.dflt)')].filter(e => getComputedStyle(e).display !== 'none').length;
  return { nT: T.length, w, dflt, own }; });
const same5 = r5.w.every(a => a.every(x => Math.abs(x - a[0]) <= 1));
if (r5.nT === 2 && same5 && r5.dflt === 0 && r5.own === 1) ok('5 ≥6 ลำ: สองตาราง · ป้ายกว้างเท่ากันในแต่ละตาราง · เกาะตั้งต้นซ่อน · ที่กรอกเองยังขึ้น');
else fail('5 ' + JSON.stringify(r5));

const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('6 ไม่มี error'); else fail('6 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
