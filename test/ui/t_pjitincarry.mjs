// §pjItinCarry + §pjKeepX · ใบงานเรือ
// ที่มา (2026-10-17) · owner "เรื่องรายละเอียดที่เขียน พร้อมกับกำหนดสี ขอให้วันถัดไปเหมือนกับวันนี้ได้ไหม User จะได้ไม่พิมพ์กับเลือกสีบ่อย"
//                    · "พอเลื่อนไปทางขวา เลือกสีแล้วเด้ง"
// กัน
//   1 วันถัดไป (ลำเดียวกัน โปรแกรมเดียวกัน) ได้ข้อความ + สีของวันนี้ · ไม่ได้เขียนลงใบวันใหม่ · ข้ามสองวันก็ยังได้
//   2 ลำที่วันถัดไปวิ่งโปรแกรมอื่น ไม่ได้ของเดิมมา
//   3 วันที่ยืมอยู่ แต้มสีใหม่ → ข้อความที่ยืมมายังอยู่ · วันต้นทางไม่เปลี่ยน
//   4 วันที่ยืมอยู่ กด "ไม่แต้มสี" → ไม่มีสีจริง (ไม่ไปยืมเมื่อวานกลับมา) · ล้างข้อความ → กลับเป็นเกาะของเส้นทาง
//   5 การ์ดวันถัดไปขึ้นข้อความที่ยืมมาในช่อง · บอกว่าติดมาจากวันไหน · ใบที่พิมพ์ขึ้นเป็นชิปสี (ไม่ใช่เกาะตั้งต้น)
//   6 เลื่อนแถบการ์ดไปทางขวาแล้วแต้มสี / พิมพ์เส้นทาง / ตั้งสีสายรัด → แถบไม่เด้งกลับซ้าย
//   7 ไม่มี error
import { open } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1100, height: 900 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(900);
const D = '2026-09-16', D2 = '2026-09-17', D3 = '2026-09-18', D4 = '2026-09-19';
const ids = await page.evaluate(([D, D2, D3, D4]) => {
  window.poGuard = () => true; window.poCanEdit = () => true;
  const pier = 'tublamu', mine = (BOATS || []).filter(x => (x.pier || '') === pier).slice(0, 8);
  const want = ['r2', 'r1', 'r4', 'r5', 'r3', 'r6', 'r2', 'r1'];
  [D, D2, D3, D4].forEach(d => { TRIPS[d] = {}; mine.forEach((b, i) => { TRIPS[d][b.id] = { route: want[i], type: 'normal', booked: 0 }; }); });
  TRIPS[D2][mine[1].id].route = 'r4';                        // ลำที่สอง วันถัดไปวิ่งโปรแกรมอื่น
  delete TRIPS[D3][mine[0].id];                              // ลำแรก วันที่สามไม่ได้ออก
  [D, D2, D3, D4].forEach(d => mine.forEach(b => { delete PIER_JOB[d + '::' + b.id]; }));
  _poDate = D; _poPier = pier; _pjF = 'all';
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const v = document.getElementById('view-poj-' + pier); if (v) v.classList.add('active');
  renderPierJob(pier);
  return mine.map(b => b.id);
}, [D, D2, D3, D4]);
const [b0, b1] = ids;

// 1 + 2
const r1 = await page.evaluate(([b0, b1, D, D2, D3, D4]) => {
  _poDate = D; pjItinSet(b0, 'เกาะ 4 -> เกาะ 8'); pjItinColor(b0, '#D9761F');
  pjItinSet(b1, 'เกาะ 9 -> เกาะ 10'); pjItinColor(b1, '#7C3AED');
  const rt = id => ROUTES.find(r => r.id === id);
  const a2 = pjItinOf(D2, b0, rt('r2')), a4 = pjItinOf(D4, b0, rt('r2')), o2 = pjItinOf(D2, b1, rt('r4'));
  return { a2, a4, raw2: !!PIER_JOB[D2 + '::' + b0], o2, isl4: String(rt('r4').islands || '').trim() };
}, [b0, b1, D, D2, D3, D4]);
if (r1.a2.t === 'เกาะ 4 → เกาะ 8' && r1.a2.own && r1.a2.c === '#D9761F' && r1.a2.from === D && !r1.raw2
  && r1.a4.t === 'เกาะ 4 → เกาะ 8' && r1.a4.c === '#D9761F')
  ok('1 วันถัดไปได้ข้อความ + สีของวันนี้ (ยืมจาก ' + r1.a2.from + ') · ไม่ได้เขียนลงใบวันใหม่ · วันที่ 19 (ข้ามวันที่ไม่ได้ออก) ก็ได้');
else fail('1 ' + JSON.stringify(r1));
if (!r1.o2.own && r1.o2.c === '' && r1.o2.t === r1.isl4) ok('2 ลำที่วันถัดไปวิ่งโปรแกรมอื่น ไม่ได้ของเดิมมา (' + r1.o2.t + ')');
else fail('2 ' + JSON.stringify(r1.o2));

// 3 + 4
const r3 = await page.evaluate(([b0, b1, D, D2, D4]) => {
  const rt = id => ROUTES.find(r => r.id === id);
  TRIPS[D2][b1].route = 'r1';                                // ให้ลำที่สองกลับมาโปรแกรมเดิมเพื่อทดสอบปุ่มไม่แต้มสี
  _poDate = D2; pjItinColor(b0, '#0F6E56');
  const x = pjItinOf(D2, b0, rt('r2')), src = pjItinOf(D, b0, rt('r2')), nxt = pjItinOf(D4, b0, rt('r2'));
  const before = pjItinOf(D2, b1, rt('r1'));
  pjItinColor(b1, ''); const nc = pjItinOf(D2, b1, rt('r1'));
  pjItinSet(b1, ''); const nt = pjItinOf(D2, b1, rt('r1'));
  _poDate = D;
  return { x, src, nxt, before, nc, nt, isl1: String(rt('r1').islands || '').trim() };
}, [b0, b1, D, D2, D4]);
if (r3.x.t === 'เกาะ 4 → เกาะ 8' && r3.x.c === '#0F6E56' && !r3.x.from && r3.src.c === '#D9761F' && r3.nxt.c === '#0F6E56')
  ok('3 วันที่ยืมอยู่ แต้มสีใหม่ ข้อความยังอยู่ · วันต้นทางยังเป็นสีเดิม · วันถัด ๆ ไปได้สีใหม่');
else fail('3 ' + JSON.stringify({ x: r3.x, src: r3.src, nxt: r3.nxt }));
if (r3.before.c === '#7C3AED' && r3.nc.c === '' && r3.nc.t === 'เกาะ 9 → เกาะ 10' && !r3.nt.own && r3.nt.t === r3.isl1)
  ok('4 "ไม่แต้มสี" ไม่มีสีจริง (ไม่ไปยืมเมื่อวานกลับมา) · ล้างข้อความกลับเป็นเกาะของเส้นทาง');
else fail('4 ' + JSON.stringify({ before: r3.before, nc: r3.nc, nt: r3.nt }));

// 5
const r5 = await page.evaluate(([b0, D4]) => {
  _poDate = D4; renderPierJob(_poPier);
  const i = [...document.querySelectorAll('.pj-itin')].find(x => (x.getAttribute('onchange') || '').indexOf("'" + b0 + "'") > 0);
  let cap = ''; const real = window.open;
  window.open = () => ({ focus() {}, document: { open() {}, write(h) { cap += h; }, close() {} } });
  pjPrint(); window.open = real;
  const tmp = document.createElement('div'); tmp.innerHTML = cap.replace(/<script>[\s\S]*?<\/script>/g, '');
  const row = [...tmp.querySelectorAll('.brd tbody tr.br')].find(r => /เกาะ 4/.test(r.textContent));
  const itn = row && row.querySelector('td.c-i .itn');
  return { v: i && i.value, inh: i && i.classList.contains('inh'), title: i && i.title,
    chips: itn ? [...itn.querySelectorAll('i')].map(x => x.textContent) : null, dflt: itn ? itn.classList.contains('dflt') : null,
    ic: row ? (row.getAttribute('style') || '').indexOf('--ic:#0F6E56') >= 0 : false };
}, [b0, D4]);
if (r5.v === 'เกาะ 4 → เกาะ 8' && r5.inh && /17\/09/.test(r5.title) && JSON.stringify(r5.chips) === '["เกาะ 4","เกาะ 8"]' && r5.dflt === false && r5.ic)
  ok('5 การ์ดวันที่ 19 ขึ้น "' + r5.v + '" ในช่อง · บอกว่าติดมาจาก 17/09 · ใบที่พิมพ์เป็นชิปสีเขียวที่แต้มไว้');
else fail('5 ' + JSON.stringify(r5));

// 6
const r6 = await page.evaluate(async (ids) => {
  _poDate = '2026-09-16'; renderPierJob(_poPier);
  const strip = () => document.querySelector('.pj-host.sk .pj-strip');
  const s = strip(); const max = s ? s.scrollWidth - s.clientWidth : 0;
  const go = () => { const w = strip(); w.scrollLeft = Math.min(600, max); return w.scrollLeft; };
  const last = ids[ids.length - 1], out = { max };
  out.x0 = go(); pjItinColor(last, '#185FA5'); out.a = strip().scrollLeft;
  go(); pjItinSet(last, 'เกาะ 1 -> เกาะ 2'); out.b = strip().scrollLeft;
  go(); pjWbSet(last, 'แดง', '#E24B4A'); out.c = strip().scrollLeft;
  _poDate = '2026-09-17'; renderPierJob(_poPier); out.newDay = strip().scrollLeft;   // เปลี่ยนวัน เริ่มซ้ายสุดตามเดิม
  _poDate = '2026-09-16';
  return out; }, ids);
if (r6.max > 300 && r6.x0 > 300 && [r6.a, r6.b, r6.c].every(x => Math.abs(x - r6.x0) <= 2) && r6.newDay === 0)
  ok('6 เลื่อนแถบไป ' + r6.x0 + 'px แล้วแต้มสี / พิมพ์เส้นทาง / ตั้งสีสายรัด แถบไม่เด้ง · เปลี่ยนวันเริ่มซ้ายสุด');
else fail('6 ' + JSON.stringify(r6));

const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('7 ไม่มี error'); else fail('7 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
