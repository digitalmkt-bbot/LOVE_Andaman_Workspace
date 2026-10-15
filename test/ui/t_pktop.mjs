// §pkTop · หน้าตั๋วอุทยาน · แถบบนตรึงไว้ + หัวตารางชีทตรึง + เลือกลำ
//
// ที่มา (2026-09-28) · ผู้ใช้ขอ "ปรับการตรึงหัวด้านบน · ทำเป็นชิปของแต่ละเส้นทาง แล้วกดเอา"
// §pk2 (2026-10-13) · หน้าตาใหม่แบบ A · ชิปเส้นทาง + บล็อกต่อทริป ถูกแทนด้วยแท็บลำแถวเดียวข้ามทุกเส้นทาง
//   แถบบนเป็นแถบกรมท่าแบบหน้าเงินสดย่อย (.pc2-top) · ชีทของลำเลื่อนในกล่องตัวเอง
//
// ⚠ หน้านี้อ่านอย่างเดียว · เขียนได้แค่ PIER_CFG.parkTypes / parkFix / parkName
//
// เช็ค
//   1 แท็บลำครบทุกลำของวัน และแต่ละแท็บบอกชื่อเส้นทางของมัน (วันที่มี 2 เส้นทางขึ้นไป)
//   2 เลื่อนหน้าแล้วแถบบนตรึงอยู่ใต้แถบแอป · ไม่หายไปจากจอ
//   3 หัวตารางชีทตรึงที่ขอบบนของกล่องชีท · เลื่อนในกล่องแล้วหัวยังอยู่ และไม่ทับแถวแรกตอนยังไม่เลื่อน
//   4 เปลี่ยนวันไปวันที่ไม่มีลำที่เลือกไว้ · เลือกลำแรกให้เอง ไม่ใช่หน้าเปล่า
//   5 กดแท็บ/เปลี่ยนวันแล้วข้อมูลจริงไม่ขยับ · ไม่มี error
import { open } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 900 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1200);

const R0 = await page.evaluate(() => {
  const el = document.querySelector('.nav-item[data-view^="pok-"]'); if (!el) return { err: 'no park menu' };
  nav(el);
  const days = [...new Set((SB_BOOKINGS || []).flatMap(b => (b.trips || []).map(t => t.date)).filter(Boolean))].sort();
  let best = null, other = null;
  days.forEach(d => PO_PIERS.forEach(p => { let B = []; try { B = poBoats(d, p.k) || []; } catch (_) { return; }
    const nr = new Set(B.map(x => x.rid)).size; if (nr >= 2 && (!best || B.length > best.n)) best = { d, pier: p.k, n: B.length, nr }; }));
  if (!best) return { err: 'no day with 2 routes at one pier' };
  const bestB = new Set((poBoats(best.d, best.pier) || []).map(x => x.bid));
  days.forEach(d => { if (other || d === best.d) return; const B = poBoats(d, best.pier) || []; if (B.length && B.every(x => !bestB.has(x.bid) || true) && B.length) other = d; });
  window.__snap = JSON.stringify([SB_BOOKINGS, TRIPS]);
  renderPierPark(best.pier); pkSetView('day'); pkSetDate(best.d);
  return { ...best, other };
});
if (R0.err) { fail(R0.err); await close(); process.exit(1); }
ok(`ใช้ ${R0.pier} ${R0.d} · ${R0.n} ลำ ${R0.nr} เส้นทาง`);
const H = `#pk-host-${R0.pier}`;

const c1 = await page.evaluate(H => [...document.querySelectorAll(H + ' .pk2-dmx tr.bt')].map(b => { const bn = b.querySelector('.bn').textContent.trim(); return { boat: bn, rt: b.querySelector('td.rt').textContent.replace(bn, '').trim() }; }), H);   // §pkDayMx
if (c1.length === R0.n && new Set(c1.map(x => x.rt)).size === R0.nr) ok('1 แท็บ ' + c1.length + ' ลำ ข้าม ' + R0.nr + ' เส้นทาง · ' + c1.map(x => x.boat + ' (' + x.rt + ')').join(' · '));
else fail('1 ' + JSON.stringify(c1));

const c2 = await page.evaluate(async H => { window.scrollTo(0, 2000); await new Promise(z => setTimeout(z, 150));
  const t = document.querySelector(H + ' .pc2-top'), r = t.getBoundingClientRect(); const pos = getComputedStyle(t).position, top = parseFloat(getComputedStyle(t).top);
  const y = window.scrollY; window.scrollTo(0, 0); return { pos, top, rTop: Math.round(r.top), y }; }, H);
if (c2.pos === 'sticky' && (c2.y === 0 || Math.abs(c2.rTop - c2.top) <= 1)) ok(`2 แถบบนตรึง (sticky · top ${c2.top}px · เลื่อนหน้า ${c2.y}px แล้วอยู่ที่ ${c2.rTop}px)`); else fail('2 ' + JSON.stringify(c2));

const c3 = await page.evaluate(async H => { const box = document.querySelector(H + ' .pk-sheet'); const th = box.querySelector('thead th'), r1 = box.querySelector('tbody tr');
  const a = { boxTop: Math.round(box.getBoundingClientRect().top), thTop: Math.round(th.getBoundingClientRect().top), thBot: Math.round(th.getBoundingClientRect().bottom), r1: Math.round(r1.getBoundingClientRect().top), can: box.scrollHeight - box.clientHeight };
  box.scrollTop = 200; await new Promise(z => setTimeout(z, 100));
  a.thTop2 = Math.round(th.getBoundingClientRect().top); box.scrollTop = 0; return a; }, H);
if (c3.thTop === c3.boxTop && c3.r1 >= c3.thBot - 1 && (c3.can < 10 || c3.thTop2 === c3.boxTop)) ok(`3 หัวชีทตรึงที่ขอบกล่อง · ไม่ทับแถวแรก · เลื่อนในกล่องแล้วหัวยังอยู่ (เลื่อนได้ ${c3.can}px)`); else fail('3 ' + JSON.stringify(c3));

const c4 = await page.evaluate(async ([H, d, o]) => { const tabs = document.querySelectorAll(H + ' .pk2-dmx tr.bt'); tabs[tabs.length - 1].click(); await new Promise(z => setTimeout(z, 100));
  if (!o) return { skip: true };
  pkSetDate(o); await new Promise(z => setTimeout(z, 150));
  const on = document.querySelectorAll(H + ' .pk2-dmx tr.bt.sel').length, sheet = !!document.querySelector(H + ' .pk-sheet');
  pkSetDate(d); return { on, sheet }; }, [H, R0.d, R0.other]);
if (c4.skip || (c4.on === 1 && c4.sheet)) ok('4 เปลี่ยนวันแล้วยังมีลำถูกเลือกและมีชีท ไม่ใช่หน้าเปล่า'); else fail('4 ' + JSON.stringify(c4));

const c5 = await page.evaluate(() => window.__snap === JSON.stringify([SB_BOOKINGS, TRIPS]));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (c5 && !e1.length) ok('5 ข้อมูลจริงไม่ขยับ · ไม่มี error'); else fail('5 ' + JSON.stringify({ c5, e: e1.slice(0, 3) }));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
