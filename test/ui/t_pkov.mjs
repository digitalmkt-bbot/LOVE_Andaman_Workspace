// §pkOv · หน้าตั๋วอุทยาน · ภาพรวมทั้งเดือน
//
// ที่มา (2026-09-28) · ผู้ใช้ขอเอง · "เพิ่มหน้า Overview เพื่อให้เห็นภาพรวมของทั้งเดือน
//   เรียงวัน แยกเรือ จำนวน ลค ที่เดินทาง / จำนวน ลค ที่ทำตั๋ว" · รอบสองขอแยก ไทย/ต่างชาติ และบอกซื้อขาด/เกิน
// §pk2 (2026-10-13) · owner เลือกแบบ A ("เอาแบบ A และขอดู ภาพรวมรายเดือนหน่อย" → "ทำเลย")
//   · วันที่ไม่มีเรือติดกันยุบเป็นแถวเดียว · ฝั่งเดินทางย่อเป็น ไทย / ต่างชาติ / FOC / รวม
//     (AD CHD INF อยู่ใน title ของช่อง) · ปุ่มสลับ รายวัน | ภาพรวมเดือน อยู่ในแถบสิ่งที่ค้าง
//
// ⚠ หน้าตั๋วอุทยานเขียนได้แค่ PIER_CFG.parkTypes / parkFix / parkName · ข้อ 9 วัดว่าข้อมูลไม่ขยับ
//
// เช็ค
//   1 ปุ่ม ภาพรวมเดือน ในแถบสิ่งที่ค้าง · กดแล้วตารางเดือนขึ้น ชีทรายวันหาย · ปุ่มติดไฟ
//   2 ทุกวันของเดือนอยู่ในตารางครั้งเดียว (แถววัน + แถวยุบ) · วันที่มีเรือ/จำนวนลำตรงกับที่นับเองจาก poBoats
//   2b ทำให้วันที่ 2 ไม่มีเรือ (ยืม poBoats) · วันนั้นไปอยู่ในแถวยุบ ไม่หายไป
//   3 "รวมตั๋ว" ต่อลำ = แถวในชีทจริงของลำนั้น
//   3b ไทย/ต่างชาติ/FOC ประกอบกลับเป็น 8 ช่องจาก title ได้ · รวม = ผลบวก · ตั๋วที่ควรออกตรงกับที่แมปเองตาม T.ch
//   4 แถววัน = ผลบวกแถวลำ · แถวรวม = ผลบวกแถววัน ครบทุกคอลัมน์ · ขาด/เกิน = รวมตั๋ว − รวมเดินทาง
//   5 เลื่อนเดือนแล้วเดือนเปลี่ยนจริง
//   6 กดแถววันแล้วไปชีทของวันนั้น
//   7 หัวตารางตรึงใต้แถบบนตอนเลื่อนหน้า
//   8 ยุบเป็นวัน ซ่อนแถวลำ · การ์ดตัวเลขตรงกับแถวรวม · ปฏิทินครบทุกวัน กดได้เฉพาะวันที่มีเรือ
//   9 ข้อมูลจริงไม่ขยับ · ไม่มี error
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
  const agg = {};
  days.forEach(d => PO_PIERS.forEach(p => { let B = []; try { B = poBoats(d, p.k) || []; } catch (_) { return; } if (!B.length) return;
    const k = p.k + '|' + d.slice(0, 7); (agg[k] = agg[k] || { pier: p.k, mon: d.slice(0, 7), boats: 0 }).boats += B.length; }));
  const best = Object.values(agg).sort((a, b) => b.boats - a.boats)[0]; if (!best) return { err: 'no boats' };
  const y = +best.mon.slice(0, 4), mo = +best.mon.slice(5, 7), last = new Date(y, mo, 0).getDate();
  let nBoat = 0, nDay = 0, sample = null;
  for (let i = 1; i <= last; i++) { const ds = best.mon + '-' + String(i).padStart(2, '0'); const B = poBoats(ds, best.pier) || [];
    nBoat += B.length; if (B.length) { nDay++; if (!sample || B.length > sample.n) sample = { ds, n: B.length }; } }
  window.__snap = JSON.stringify([SB_BOOKINGS, TRIPS]);
  return { pier: best.pier, mon: best.mon, last, nBoat, nDay, sample, ty: pkTypes().map(T => ({ k: T.k, s: T.s || T.n, ch: (T.ch || []).slice() })) };
});
if (R0.err) { fail(R0.err); await close(); process.exit(1); }
ok(`ใช้ ${R0.pier} ${R0.mon} · ${R0.last} วัน · มีเรือ ${R0.nDay} วัน · ${R0.nBoat} ลำ · ประเภทตั๋ว ${R0.ty.length}`);
const H = `#pk-host-${R0.pier}`, nTy = R0.ty.length;
/* ตำแหน่งช่อง · dt, rt, ไทย, ต่างชาติ, FOC, รวม, ตั๋ว×nTy, รวมตั๋ว, ขาด/เกิน */
const IX = { th: 2, fr: 3, foc: 4, goT: 5, ty: 6, tyT: 6 + nTy, df: 7 + nTy, n: 8 + nTy };
const openOv = () => page.evaluate(([p, m]) => { renderPierPark(p); pkSetDate(m + '-01'); _pkMon = m; _pkOvBoats = true; pkSetView('ov'); }, [R0.pier, R0.mon]);

const c1 = await page.evaluate(([p, m, H]) => { renderPierPark(p); pkSetView('day'); pkSetDate(m + '-01');
  const h = () => document.querySelector(H);
  const b = [...h().querySelectorAll('.pc2-todo .pk2-vs button')].find(x => /ภาพรวมเดือน/.test(x.textContent));
  if (!b) return { err: 'no toggle' };
  const before = !!h().querySelector('.pk2-ov'); b.click();
  const on = [...h().querySelectorAll('.pc2-todo .pk2-vs button')].find(x => /ภาพรวมเดือน/.test(x.textContent));
  return { before, after: !!h().querySelector('.pk2-ov'), sheet: !!h().querySelector('.pk-sheet'), on: on.classList.contains('on'), mon: h().querySelector('.pc2-bar1 .dp input').value }; }, [R0.pier, R0.mon, H]);
if (!c1.err && !c1.before && c1.after && !c1.sheet && c1.on && c1.mon === R0.mon) ok('1 ปุ่ม ภาพรวมเดือน ในแถบสิ่งที่ค้าง · ตารางเดือนขึ้น ชีทรายวันหาย · ปุ่มติดไฟ · เดือน ' + c1.mon);
else fail('1 ' + JSON.stringify(c1));

await openOv(); await page.waitForTimeout(250);
const cover = () => page.evaluate(H => { const h = document.querySelector(H); const seen = [];
  h.querySelectorAll('.pk2-ov tbody tr.dy td.dt b').forEach(b => seen.push(+b.textContent));
  const gaps = [...h.querySelectorAll('.pk2-ov tbody tr.gap td.dt')].map(t => t.textContent.trim());
  gaps.forEach(g => { const m = g.split('–').map(Number); for (let i = m[0]; i <= (m[1] || m[0]); i++) seen.push(i); });
  return { seen: seen.sort((a, b) => a - b), dy: h.querySelectorAll('.pk2-ov tr.dy').length, bt: h.querySelectorAll('.pk2-ov tr.bt').length, gaps }; }, H);
const c2 = await cover();
const all = Array.from({ length: R0.last }, (_, i) => i + 1).join(',');
if (c2.seen.join(',') === all && c2.dy === R0.nDay && c2.bt === R0.nBoat) ok(`2 ทุกวันอยู่ครั้งเดียว · แถววัน ${c2.dy} · แถวยุบ [${c2.gaps.join(' ')}] · แถวลำ ${c2.bt}`);
else fail('2 ' + JSON.stringify({ c2, R0 }));

const c2b = await page.evaluate(([m, H]) => { const orig = window.poBoats; const g = m + '-02';
  window.poBoats = function (d) { return d === g ? [] : orig.apply(this, arguments); };
  _pkMon = m; pkSetView('ov');
  const gaps = [...document.querySelectorAll(H + ' .pk2-ov tr.gap td.dt')].map(t => t.textContent.trim());
  const dy2 = [...document.querySelectorAll(H + ' .pk2-ov tr.dy td.dt b')].some(b => +b.textContent === 2);
  window.poBoats = orig; pkSetView('ov'); return { gaps, dy2 }; }, [R0.mon, H]);
const has2 = c2b.gaps.some(g => { const m = g.split('–').map(Number); return 2 >= m[0] && 2 <= (m[1] || m[0]); });
if (has2 && !c2b.dy2) ok('2b วันที่ 2 ไม่มีเรือ → อยู่ในแถวยุบ [' + c2b.gaps.join(' ') + '] ไม่หายไป'); else fail('2b ' + JSON.stringify(c2b));

await openOv(); await page.waitForTimeout(200);
const c3 = await page.evaluate(async ([ds, IX, H]) => {
  const h = () => document.querySelector(H), num = t => +String(t || '').replace(/[^0-9]/g, '') || 0;
  const trs = [...h().querySelectorAll('.pk2-ov tbody tr')], d = +ds.slice(8);
  const i = trs.findIndex(t => t.classList.contains('dy') && +t.querySelector('td.dt b').textContent === d);
  const ov = []; for (let k = i + 1; k < trs.length && trs[k].classList.contains('bt'); k++) { const td = trs[k].querySelectorAll('td');
    ov.push({ key: td[1].querySelector('.bn').textContent.replace(/\s+/g, ''), tk: num(td[IX.tyT].textContent) }); }
  pkSetView('day'); pkSetDate(ds); await new Promise(z => setTimeout(z, 200));
  const sheet = []; const n = h().querySelectorAll('.pk2-bt').length;
  for (let j = 0; j < n; j++) { h().querySelectorAll('.pk2-bt')[j].click(); await new Promise(z => setTimeout(z, 100));
    const b = h().querySelector('.pk2-bt.on .t b'); sheet.push({ key: b.textContent.replace(/\s+/g, ''), rows: h().querySelectorAll('.pk-sheet tbody tr:not(.pk-ovr)').length }); }
  return { ov, sheet }; }, [R0.sample.ds, IX, H]);
const off3 = c3.ov.filter(o => { const s = c3.sheet.filter(x => x.key === o.key); return !s.length || s.reduce((a, x) => a + x.rows, 0) !== o.tk; });
if (c3.ov.length && !off3.length) ok(`3 ${R0.sample.ds} · รวมตั๋วต่อลำ = แถวในชีท (${c3.ov.map(o => o.key + ' ' + o.tk).join(' · ')})`); else fail('3 ' + JSON.stringify(c3));

await openOv(); await page.waitForTimeout(200);
const c3b = await page.evaluate(([IX, TY, H]) => {
  const num = t => +String(t || '').replace(/[^0-9]/g, '') || 0;
  const rows = [...document.querySelectorAll(H + ' .pk2-ov tr.bt')]; const badL = []; let nFoc = 0, nOff = 0;
  rows.forEach(tr => { const td = tr.querySelectorAll('td'), nm = td[1].textContent.trim();
    const pick = (cell, re) => { const m = String(cell.getAttribute('title') || '').match(re); return m ? +m[1] : NaN; };
    const go = { ad_th: pick(td[IX.th], /AD (\d+)/), chd_th: pick(td[IX.th], /CHD (\d+)/), inf_th: pick(td[IX.th], /INF (\d+)/),
      ad_fr: pick(td[IX.fr], /AD (\d+)/), chd_fr: pick(td[IX.fr], /CHD (\d+)/), inf_fr: pick(td[IX.fr], /INF (\d+)/),
      foc_th: pick(td[IX.foc], /ไทย (\d+)/), foc_fr: pick(td[IX.foc], /ต่างชาติ (\d+)/) };
    if (Object.values(go).some(v => isNaN(v))) { badL.push(nm + ' title ไม่ครบ'); return; }
    if (go.foc_th || go.foc_fr) nFoc++;
    const th = go.ad_th + go.chd_th + go.inf_th, fr = go.ad_fr + go.chd_fr + go.inf_fr, foc = go.foc_th + go.foc_fr;
    if (num(td[IX.th].textContent) !== th || num(td[IX.fr].textContent) !== fr || num(td[IX.foc].textContent) !== foc) badL.push(nm + ' ช่องย่อไม่ตรง title');
    if (num(td[IX.goT].textContent) !== th + fr + foc) badL.push(nm + ' รวมเดินทาง ' + num(td[IX.goT].textContent) + ' ≠ ' + (th + fr + foc));
    TY.forEach((T, i) => { const cell = td[IX.ty + i]; const want = (T.ch || []).reduce((a, k) => a + (go[k] || 0), 0);
      let need; if (cell.classList.contains('off')) { const m = String(cell.getAttribute('title') || '').match(/ควรออก\s*(\d+)/); need = m ? +m[1] : -1; nOff++; } else need = num(cell.textContent);
      if (need !== want) badL.push(nm + ' ' + T.s + ' ควรออก ' + need + ' แมปได้ ' + want); }); });
  return { n: rows.length, nFoc, nOff, bad: badL.slice(0, 4), nb: badL.length }; }, [IX, R0.ty, H]);
if (c3b.n && !c3b.nb && c3b.nFoc) ok(`3b ${c3b.n} แถวลำ · 8 ช่องจาก title รวมได้ตรง · ตั๋วที่ควรออกตรงกับการแมป (FOC ${c3b.nFoc} ลำ · ช่องย้ายกอง ${c3b.nOff})`);
else fail('3b ' + JSON.stringify(c3b));

const c4 = await page.evaluate(([IX, H]) => {
  const num = t => { const s = String(t || ''); const v = +s.replace(/[^0-9]/g, '') || 0; return /−/.test(s) ? -v : v; };
  const NC = IX.df - IX.th; const vals = tr => { const td = tr.querySelectorAll('td'); const a = []; for (let i = IX.th; i < IX.df; i++) a.push(num(td[i].textContent)); return a; };
  const trs = [...document.querySelectorAll(H + ' .pk2-ov tbody tr')]; const tot = new Array(NC).fill(0); const badL = [];
  trs.forEach((tr, i) => { if (!tr.classList.contains('dy')) return; const v = vals(tr); v.forEach((x, k) => tot[k] += x);
    const s = new Array(NC).fill(0); for (let k = i + 1; k < trs.length && trs[k].classList.contains('bt'); k++) vals(trs[k]).forEach((x, j) => s[j] += x);
    if (s.join() !== v.join()) badL.push('วัน ' + tr.querySelector('b').textContent + ' ' + v.join('/') + ' vs ลำ ' + s.join('/'));
    const td = tr.querySelectorAll('td'); const df = num(td[IX.df].textContent), want = num(td[IX.tyT].textContent) - num(td[IX.goT].textContent);
    if (df !== want) badL.push('วัน ' + tr.querySelector('b').textContent + ' ขาด/เกิน ' + df + ' ควร ' + want); });
  const ft = vals(document.querySelector(H + ' .pk2-ov tfoot tr'));
  if (ft.join() !== tot.join()) badL.push('รวม ' + ft.join('/') + ' vs ' + tot.join('/'));
  return { badL, ft }; }, [IX, H]);
if (!c4.badL.length) ok('4 แถววัน = ผลบวกแถวลำ · แถวรวม = ผลบวกแถววัน · ขาด/เกิน ถูก (รวม ' + c4.ft.join('/') + ')'); else fail('4 ' + c4.badL.slice(0, 4).join(' | '));

const c5 = await page.evaluate(H => { const a = document.querySelector(H + ' .pc2-bar1 .dp input').value; pkMonShift(1); const b = document.querySelector(H + ' .pc2-bar1 .dp input').value;
  const nd = document.querySelectorAll(H + ' .pk2-ov tr.dy, ' + H + ' .pk2-ov tr.gap').length; pkMonShift(-1); return { a, b, nd, c: document.querySelector(H + ' .pc2-bar1 .dp input').value }; }, H);
if (c5.a !== c5.b && c5.c === c5.a && c5.nd > 0) ok(`5 เลื่อนเดือน ${c5.a} → ${c5.b} → ${c5.c}`); else fail('5 ' + JSON.stringify(c5));

const c6 = await page.evaluate(([H, ds]) => { const d = +ds.slice(8); const tr = [...document.querySelectorAll(H + ' .pk2-ov tr.dy')].find(t => +t.querySelector('b').textContent === d);
  tr.click(); return { date: _poDate, sheet: !!document.querySelector(H + ' .pk-sheet'), view: _pkView }; }, [H, R0.sample.ds]);
if (c6.date === R0.sample.ds && c6.sheet && c6.view === 'day') ok('6 กดแถววัน ' + R0.sample.ds + ' แล้วไปชีทของวันนั้น'); else fail('6 ' + JSON.stringify(c6));

await openOv(); await page.waitForTimeout(300);
const c7 = await page.evaluate(async H => { const h = document.querySelector(H); const tbl = h.querySelector('.pk2-ov');
  window.scrollTo(0, tbl.getBoundingClientRect().top + window.scrollY + 400); await new Promise(z => setTimeout(z, 200));
  const th = h.querySelector('.pk2-ov thead tr.g th.gh').getBoundingClientRect(), th2 = h.querySelector('.pk2-ov thead tr.s th').getBoundingClientRect(), top = h.querySelector('.pc2-top').getBoundingClientRect();
  const r = { thTop: Math.round(th.top), th2Top: Math.round(th2.top), thBot: Math.round(th.bottom), topBot: Math.round(top.bottom), tblTop: Math.round(tbl.getBoundingClientRect().top) };
  window.scrollTo(0, 0); return r; }, H);
if (c7.tblTop < 0 && c7.thTop >= c7.topBot - 2 && c7.thTop < c7.topBot + 30 && c7.th2Top >= c7.thBot - 2) ok(`7 เลื่อนหน้าแล้วหัวตารางตรึงใต้แถบบน (แถบจบ ${c7.topBot}px · หัว ${c7.thTop}/${c7.th2Top}px)`); else fail('7 ' + JSON.stringify(c7));

const c8 = await page.evaluate(([H, last]) => { const h = () => document.querySelector(H);
  const k = [...h().querySelectorAll('.pc2-kpi .k')].map(e => +e.querySelector('.v').firstChild.textContent.replace(/\D/g, ''));
  const num = t => +String(t || '').replace(/[^0-9]/g, '') || 0; const ft = h().querySelectorAll('.pk2-ov tfoot td');
  const cal = h().querySelectorAll('.pk2-cal > button, .pk2-cal > span:not(.w):not(.e)').length, calBtn = h().querySelectorAll('.pk2-cal > button').length;
  [...h().querySelectorAll('.pc2-seg button')].find(b => /ยุบเป็นวัน/.test(b.textContent)).click();
  const bt = h().querySelectorAll('.pk2-ov tr.bt').length, dy = h().querySelectorAll('.pk2-ov tr.dy').length;
  [...h().querySelectorAll('.pc2-seg button')].find(b => /แยกตามลำ/.test(b.textContent)).click();
  return { k, goT: num(ft[5].textContent), tyT: num(ft[ft.length - 2].textContent), cal, calBtn, bt, dy }; }, [H, R0.last]);
if (c8.bt === 0 && c8.dy === R0.nDay && c8.k[0] === R0.nDay && c8.k[1] === c8.goT && c8.k[2] === c8.tyT && c8.cal === R0.last && c8.calBtn === R0.nDay)
  ok(`8 ยุบเป็นวัน ซ่อนแถวลำ · การ์ด ${c8.k.slice(0, 3).join('/')} ตรงกับแถวรวม · ปฏิทิน ${c8.cal} วัน กดได้ ${c8.calBtn}`);
else fail('8 ' + JSON.stringify({ c8, R0: { nDay: R0.nDay, last: R0.last } }));

const c9 = await page.evaluate(() => window.__snap === JSON.stringify([SB_BOOKINGS, TRIPS]));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (c9 && !e1.length) ok('9 ข้อมูลจริงไม่ขยับ · ไม่มี error'); else fail('9 ' + JSON.stringify({ c9, e: e1.slice(0, 3) }));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
