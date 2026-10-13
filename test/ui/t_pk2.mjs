// §pk2 · หน้าตั๋วอุทยาน · รายวัน หน้าตาใหม่ (แบบ A · หัวกรมท่าแบบหน้าเงินสดย่อย)
//
// ที่มา (2026-10-13) · owner: "ปรับดีไซน์ในหน้าตั๋วอุทยานใหม่" → "ใช้ดีไซน์ในหน้าของ Petty Cash มาช่วย"
//   เสนอ 3 แบบ · owner เลือก "เอาแบบ A และขอดู ภาพรวมรายเดือนหน่อย" → "ทำเลย"
// แทน t_pktop (ชิปเส้นทาง + บล็อกต่อทริป ถูกแทนด้วยแท็บลำแถวเดียว)
//
// ⚠ หน้านี้เขียนได้แค่ PIER_CFG.parkTypes / parkFix / parkName · ข้อ 8 วัดว่ากดทุกอย่างแล้วใบจอง/TRIPS ไม่ขยับ
//
// เช็ค
//   1 แถบบนกรมท่า (.pc2-top) · ชิปหน้า ตั๋วอุทยาน/เบิก-คืน/เงินสดย่อย · วันที่ · แถบสิ่งที่ค้างบอกรอชื่อ
//   2 แท็บลำครบทุกลำของวัน (ข้ามทุกเส้นทาง) · เลขบนแท็บ = แถวในชีทของลำนั้นจริง (กดทีละแท็บแล้วนับ)
//   3 การ์ด ตั๋วทั้งวัน = ผลรวมเลขบนแท็บ · รอชื่อ = ผลรวมแถวรอชื่อในชีททุกลำ · ตรงกับแถบบน
//   4 การ์ดรอชื่อด้านขวา · เลขต่อลำตรงกับแถว .pk-nn ในชีทลำนั้น · กดแล้วไปลำนั้นและแถวรอชื่อขึ้นในกล่อง
//   5 ตั๋วตามประเภททั้งวัน · ผลรวม = ตั๋วทั้งวัน
//   6 การ์ดเดือนขวา · แถววันที่เลือกตรงกับการ์ดบน · กดอีกวันแล้ววันเปลี่ยนจริง
//   7 เลือกลำไว้ เปลี่ยนวันไปกลับ ลำเดิมยังถูกเลือก
//   8 ใบจองและ TRIPS ไม่ขยับ · ไม่มี error
import { open } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1200);

const R0 = await page.evaluate(() => {
  const el = document.querySelector('.nav-item[data-view^="pok-"]'); if (!el) return { err: 'no park menu' };
  nav(el);
  const days = [...new Set((SB_BOOKINGS || []).flatMap(b => (b.trips || []).map(t => t.date)).filter(Boolean))].sort();
  const piers = PO_PIERS.map(p => p.k);
  let best = null;
  days.forEach(d => piers.forEach(pier => { let B = []; try { B = poBoats(d, pier) || []; } catch (_) { return; }
    const nr = new Set(B.map(x => x.rid)).size; if (B.length && (!best || nr * 10 + B.length > best.score)) best = { d, pier, n: B.length, nr, score: nr * 10 + B.length }; }));
  if (!best) return { err: 'no boats' };
  window.__snap = JSON.stringify([SB_BOOKINGS, TRIPS]);
  renderPierPark(best.pier); pkSetView('day'); pkSetDate(best.d);
  return best;
});
if (R0.err) { fail(R0.err); await close(); process.exit(1); }
ok(`ใช้ ${R0.pier} ${R0.d} · ${R0.n} ลำ ${R0.nr} เส้นทาง`);
const H = `#pk-host-${R0.pier}`;

const c1 = await page.evaluate(H => { const h = document.querySelector(H);
  const top = h.querySelector('.pc2-top'), bg = top ? getComputedStyle(top.querySelector('.pc2-bar1')).backgroundColor : '';
  return { top: !!top, bg, chips: [...h.querySelectorAll('.pc2-chips button')].map(b => b.textContent.trim().replace(/\s+/g, ' ')),
    date: (h.querySelector('.pc2-bar1 .dp b') || {}).textContent, todo: (h.querySelector('.pc2-todo') || {}).textContent || '' }; }, H);
if (c1.top && /11, 30, 91/.test(c1.bg) && /ตั๋วอุทยาน/.test(c1.chips[0]) && c1.chips.some(c => /เงินสดย่อย/.test(c)) && /\d{2} [A-Z]{3} \d{4}/.test(c1.date) && /สิ่งที่ค้าง/.test(c1.todo))
  ok(`1 แถบบนกรมท่า · ชิป [${c1.chips.join(' | ')}] · ${c1.date} · "${c1.todo.slice(0, 60)}…"`); else fail('1 ' + JSON.stringify(c1));

const c2 = await page.evaluate(async H => {
  const h = () => document.querySelector(H);
  const n = h().querySelectorAll('.pk2-bt').length, out = [];
  for (let i = 0; i < n; i++) {
    h().querySelectorAll('.pk2-bt')[i].click(); await new Promise(z => setTimeout(z, 120));
    const t = h().querySelectorAll('.pk2-bt')[i];
    out.push({ on: t.classList.contains('on'), tab: +t.querySelector('.n').textContent, w: +((t.querySelector('.w') || {}).textContent || '0').replace(/\D/g, ''),
      rows: h().querySelectorAll('.pk-sheet tbody tr:not(.pk-ovr)').length, nn: h().querySelectorAll('.pk-sheet tbody tr.pk-nn').length,
      bn: (h().querySelector('.pk2-bh .bn') || {}).textContent, name: t.querySelector('.t b').textContent });
  }
  return out; }, H);
const c2bad = c2.filter(x => !x.on || x.tab !== x.rows || x.w !== x.nn || !x.name.startsWith(x.bn));
if (c2.length === R0.n && !c2bad.length) ok(`2 แท็บ ${c2.length} ลำ · เลขบนแท็บ = แถวในชีท (${c2.map(x => x.bn + ' ' + x.rows + (x.nn ? '/รอ ' + x.nn : '')).join(' · ')})`);
else fail('2 ' + JSON.stringify({ n: R0.n, c2 }));

const c3 = await page.evaluate(H => { const h = document.querySelector(H);
  const k = [...h.querySelectorAll('.pc2-kpi .k')].map(e => ({ h: e.querySelector('.h').textContent, v: +e.querySelector('.v').firstChild.textContent.replace(/\D/g, '') }));
  const chipW = +((h.querySelector('.pc2-chips .bd') || {}).textContent || '0').replace(/\D/g, '');
  return { k, chipW }; }, H);
const sumTab = c2.reduce((a, x) => a + x.rows, 0), sumNN = c2.reduce((a, x) => a + x.nn, 0);
const kv = h => (c3.k.find(x => x.h === h) || {}).v;
if (kv('ลำวันนี้') === R0.n && kv('ตั๋วทั้งวัน') === sumTab && kv('รอชื่อ') === sumNN && (sumNN ? c3.chipW === sumNN : true))
  ok(`3 การ์ด · ลำ ${kv('ลำวันนี้')} · ตั๋ว ${kv('ตั๋วทั้งวัน')} = ผลรวมชีท · รอชื่อ ${kv('รอชื่อ')} = แถวรอชื่อทุกลำ (ป้ายบนแถบ ${c3.chipW})`);
else fail('3 ' + JSON.stringify({ c3, sumTab, sumNN }));

const c4 = await page.evaluate(async H => {
  const h = () => document.querySelector(H);
  const items = [...h().querySelectorAll('.pk2-wr')].map(b => ({ txt: b.querySelector('.t').firstChild.textContent.trim(), v: +b.querySelector('.v').textContent }));
  if (!items.length) return { none: true };
  const res = [];
  for (let i = 0; i < items.length; i++) {
    h().querySelectorAll('.pk2-wr')[i].click(); await new Promise(z => setTimeout(z, 250));
    const box = h().querySelector('.pk-sheet'), tr = box.querySelector('tr.pk-nn');
    const br = box.getBoundingClientRect(), tb = tr.getBoundingClientRect();
    res.push({ item: items[i], bn: h().querySelector('.pk2-bh .bn').textContent, nn: box.querySelectorAll('tr.pk-nn').length, inBox: tb.top >= br.top - 1 && tb.bottom <= br.bottom + 1 });
  }
  return { res }; }, H);
if (c4.none && sumNN === 0) ok('4 ไม่มีรอชื่อวันนี้ · การ์ดว่าง');
else if (c4.res && c4.res.every(r => r.item.txt.startsWith(r.bn) && r.item.v === r.nn && r.inBox))
  ok('4 การ์ดรอชื่อ · ' + c4.res.map(r => `${r.item.txt} = ${r.nn} แถว`).join(' · ') + ' · กดแล้วไปลำนั้น แถวรอชื่ออยู่ในกล่อง');
else fail('4 ' + JSON.stringify(c4));

const c5 = await page.evaluate(H => { const h = document.querySelector(H);
  const rs = [...h.querySelectorAll('.pk2-tyd .r:not(.t) b')].map(b => +b.textContent);
  return { sum: rs.reduce((a, b) => a + b, 0), tot: +(h.querySelector('.pk2-tyd .r.t b') || {}).textContent }; }, H);
if (c5.sum === sumTab && c5.tot === sumTab) ok(`5 ตั๋วตามประเภท · ผลรวม ${c5.sum} = ตั๋วทั้งวัน`); else fail('5 ' + JSON.stringify(c5));

const c6 = await page.evaluate(async ([H, d]) => { const h = () => document.querySelector(H);
  const on = h().querySelector('.pc2-month .pc2-mr.on'); const sp = [...on.querySelectorAll('span')].map(s => s.textContent);
  const other = [...h().querySelectorAll('.pc2-month .pc2-mr')].find(b => !b.classList.contains('on'));
  const od = other.getAttribute('onclick').match(/'(\d{4}-\d{2}-\d{2})'/)[1];
  other.click(); await new Promise(z => setTimeout(z, 200));
  const now = _poDate; pkSetDate(d); await new Promise(z => setTimeout(z, 200));
  return { boats: +sp[0], tot: +sp[1], od, now }; }, [H, R0.d]);
if (c6.boats === R0.n && c6.tot === sumTab && c6.now === c6.od) ok(`6 การ์ดเดือน · วันนี้ ${c6.boats} ลำ ${c6.tot} ตั๋ว · กด ${c6.od} แล้วไปวันนั้นจริง`); else fail('6 ' + JSON.stringify(c6));

const c7 = await page.evaluate(async ([H, d]) => { const h = () => document.querySelector(H);
  const tabs = h().querySelectorAll('.pk2-bt'); const last = tabs[tabs.length - 1]; last.click(); await new Promise(z => setTimeout(z, 150));
  const want = h().querySelector('.pk2-bh .bn').textContent;
  pkShift(1); await new Promise(z => setTimeout(z, 150)); pkSetDate(d); await new Promise(z => setTimeout(z, 150));
  return { want, got: h().querySelector('.pk2-bh .bn').textContent, on: h().querySelector('.pk2-bt.on .t b').textContent }; }, [H, R0.d]);
if (c7.want === c7.got && c7.on.startsWith(c7.want)) ok(`7 เลือก ${c7.want} ไว้ เปลี่ยนวันไปกลับ ยังเป็น ${c7.got}`); else fail('7 ' + JSON.stringify(c7));

const c8 = await page.evaluate(() => window.__snap === JSON.stringify([SB_BOOKINGS, TRIPS]));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (c8 && !e1.length) ok('8 ใบจอง/TRIPS ไม่ขยับ · ไม่มี error'); else fail('8 ' + JSON.stringify({ c8, e: e1.slice(0, 3) }));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
