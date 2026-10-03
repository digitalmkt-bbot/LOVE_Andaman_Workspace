// §baCellFit · By trip · โหมดจัดเรือ · ของในช่อง Boat ต้องอยู่ในช่องและกดได้ทุกปุ่ม
//
// ที่มา (2026-10-03) · ผู้ใช้ส่งภาพหน้า By trip โหมดจัดเรือ · "ดูช่อง Boat assign ให้หน่อย"
//   ในภาพ ปุ่มที่สาม (⇆ แยกลำ) โดนตัดที่ขอบขวา และช่องติ๊กหายไปเกือบทุกแถว เห็นแค่แถวใบ 1 คน
//   วัดจริง · คอลัมน์ถูกตรึง 96px แต่ของในช่องกว้าง ~146px + padding ซ้อนอีก 14px ต่อข้าง
//   จัดกึ่งกลาง จึงล้นสองข้าง: ช่องติ๊กไปอยู่ที่ x=-25 (ใต้คอลัมน์ VC) ปุ่ม ⇆ เลยขอบขวา 25px
//
// กันเจ็ดอย่าง
//   1 ทุกแถว · ช่องติ๊ก + ปุ่มเลือกเรือ + ⤴ + ⇆ อยู่ในช่อง Boat ทั้งตัว · ชื่อเรือปกติไม่ถูกตัด
//   2 ช่องติ๊กกับปุ่ม ⇆ กดได้จริง (ไม่มีอะไรบัง) · ช่องติ๊กของทุกแถวอยู่แนวเดียวกัน
//   3 แถวที่ยังไม่จัดเรือ (+ assign) ก็อยู่ในช่องเหมือนกัน
//   4 ชื่อเรือยาวมาก · ปุ่มเลือกเรือตัดด้วย … ปุ่มเล็กยังอยู่ในช่อง
//   5 จอแคบกว่าตาราง · คอลัมน์ Boat ยังเห็นอยู่ที่ขอบขวาโดยไม่ต้องปัด
//   6 ปิดโหมดจัดเรือ · คอลัมน์ Boat กว้าง 96px เท่าเดิม ไม่เกาะขวา
//   7 ไม่มี error บนหน้า
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1000 });
page.on('dialog', async d => { try { await d.accept(); } catch (_) {} });
await goView(page, 'booking', 900);

const S = await page.evaluate(async () => {
  const per = {};
  (SB_BOOKINGS || []).forEach(b => { if (['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)) return;
    (b.trips || []).forEach(t => { if (t && t.date) per[t.date] = (per[t.date] || 0) + 1; }); });
  const day = Object.keys(per).sort((a, b) => per[b] - per[a])[0];
  window.__show = async on => { _bkV2.filterDate = day; _bkV2.filterRoute = null; _bkV2.boatAssignMode = !!on; bkV2SwitchTab('bytrip'); await new Promise(z => setTimeout(z, 700)); };
  window.__cells = () => [...document.querySelectorAll('#bkv2-host tr.t2-row[data-al]')].map(tr => { const td = tr.lastElementChild, R = td.getBoundingClientRect();
    const box = (sel) => { const e = td.querySelector(sel); if (!e) return null; const q = e.getBoundingClientRect(); return { l: Math.round(q.left - R.left), r: Math.round(R.right - q.right), w: Math.round(q.width), e }; };
    const cb = box('input[type=checkbox]'), pick = box('[data-babtn="pick"]'), up = box('[data-babtn="up"]'), sp = box('[data-babtn="split"]');
    const hit = b => { if (!b) return null; tr.scrollIntoView({ block: 'center' }); const q = b.e.getBoundingClientRect(); if (q.top < 0 || q.bottom > innerHeight) return null; const h = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return h === b.e; };
    const strip = b => b ? { l: b.l, r: b.r, w: b.w } : null;
    return { id: tr.dataset.al, tdW: Math.round(R.width), right: Math.round(R.right), sticky: td.classList.contains('t2-bst'), cb: strip(cb), pick: strip(pick), up: strip(up), sp: strip(sp),
      cbHit: hit(cb), spHit: hit(sp), txt: pick ? pick.e.textContent.trim() : '', clip: pick ? pick.e.scrollWidth > pick.e.clientWidth : false }; });
  await __show(true);
  return { day, n: __cells().length };
});
const inside = c => ['cb', 'pick', 'up', 'sp'].every(k => !c[k] || (c[k].l >= 0 && c[k].r >= 0));

/* ══ 1–2 ══ */
const C1 = (await page.evaluate(() => __cells())).filter(c => c.pick);
const out1 = C1.filter(c => !c.cb || !inside(c)), withSp = C1.filter(c => c.sp);
const clip1 = C1.filter(c => c.clip);
if (C1.length >= 10 && withSp.length >= 3 && !out1.length && !clip1.length) ok(`1 ${C1.length} แถว (${withSp.length} แถวมีปุ่ม ⇆) · ช่องติ๊กและปุ่มทุกปุ่มอยู่ในช่อง Boat (กว้าง ${C1[0].tdW}px)`);
else fail('1 ' + JSON.stringify({ n: C1.length, sp: withSp.length, out: out1.slice(0, 2), clipped: clip1.slice(0, 2) }));
const hitRows = C1.filter(c => c.cbHit !== null), badHit = hitRows.filter(c => c.cbHit !== true || (c.sp && c.spHit !== true));
const cbL = new Set(C1.map(c => c.cb && c.cb.l));
if (hitRows.length >= 5 && !badHit.length && cbL.size === 1) ok(`2 ช่องติ๊กและปุ่ม ⇆ กดได้จริง (${hitRows.length} แถวที่อยู่ในจอ) · ช่องติ๊กอยู่แนวเดียวกันทุกแถว (x=${[...cbL][0]})`);
else fail('2 ' + JSON.stringify({ hit: hitRows.length, bad: badHit.slice(0, 2), cbL: [...cbL] }));

/* ══ 3 · ยังไม่จัดเรือ ══ */
const C3 = await page.evaluate(async day => { let n = 0;
  SB_BOOKINGS.forEach(b => { if (n >= 6 || !(b.trips || []).some(t => t.date === day && t.bookingMode !== 'charter')) return; const o = bkOpsRead(b, day); if (o && o.boatId && !o.boatSplits) { bkOpsFor(b, day).boatId = null; n++; } });
  await __show(true); return __cells().filter(c => /\+ assign/.test(c.txt)); }, S.day);
const out3 = C3.filter(c => !c.cb || !inside(c));
if (C3.length >= 3 && C3.some(c => c.sp) && !out3.length) ok(`3 แถวที่ยังไม่จัดเรือ ${C3.length} แถว · "+ assign" กับปุ่มข้าง ๆ อยู่ในช่อง`);
else fail('3 ' + JSON.stringify({ n: C3.length, out: out3.slice(0, 2) }));

/* ══ 4 · ชื่อเรือยาว ══ */
const C4 = await page.evaluate(async () => { const used = {}; __cells().forEach(c => { if (c.txt && !/assign/.test(c.txt)) used[c.txt.replace(/\s*⤴$/, '')] = 1; });
  const bo = (BOATS || []).find(b => used[b.name]); if (!bo) return { err: 'no assigned boat' };
  const keep = bo.name; bo.name = 'Sea Explorer Catamaran Number Twenty Seven'; await __show(true);
  const cs = __cells().filter(c => /Sea Explorer/.test(c.txt)); bo.name = keep; await __show(true); return { cs }; });
if (C4.err) fail('4 setup · ' + C4.err);
else { const out4 = C4.cs.filter(c => !inside(c) || !c.clip);
  if (C4.cs.length >= 1 && !out4.length) ok(`4 ชื่อเรือยาว 42 ตัวอักษร (${C4.cs.length} แถว) · ปุ่มเลือกเรือตัดด้วย … ปุ่มเล็กยังอยู่ในช่อง`); else fail('4 ' + JSON.stringify({ n: C4.cs.length, out: out4.slice(0, 2) })); }

/* ══ 5 · เกาะขอบขวา ══ */
const C5 = await page.evaluate(() => { const w = document.querySelector('#bkv2-host .t2-wrap'); w.scrollLeft = 0; const W = w.getBoundingClientRect(), c = __cells()[0];
  const th = document.querySelector('#bkv2-host table.t2-mtbl thead th:last-child').getBoundingClientRect();
  return { over: w.scrollWidth - w.clientWidth, wrapRight: Math.round(W.right), right: c.right, thRight: Math.round(th.right), sticky: c.sticky }; });
if (C5.over > 40 && C5.sticky && C5.right <= C5.wrapRight + 1 && C5.thRight <= C5.wrapRight + 1) ok(`5 จอ 1500 · ตารางกว้างกว่ากล่อง ${C5.over}px · คอลัมน์ Boat ยังอยู่ในจอ (ขอบขวา ${C5.right} ≤ ${C5.wrapRight})`);
else fail('5 ' + JSON.stringify(C5));

/* ══ 6 · โหมดปกติ ══ */
const C6 = await page.evaluate(async () => { await __show(false); const c = __cells(); return { w: [...new Set(c.map(x => x.tdW))], sticky: c.some(x => x.sticky), cb: c.some(x => x.cb) }; });
if (C6.w.length === 1 && C6.w[0] === 96 && !C6.sticky && !C6.cb) ok('6 ปิดโหมดจัดเรือ · คอลัมน์ Boat กว้าง 96px เท่าเดิม ไม่เกาะขวา');
else fail('6 ' + JSON.stringify(C6));

const e1 = errors.filter(e => !/Failed to load resource/.test(e));
if (!e1.length) ok('7 ไม่มี error บนหน้า'); else fail('7 ' + e1.slice(0, 3).join(' | '));
if (process.env.SHOT) { await page.evaluate(async () => { await __show(true); await new Promise(z => setTimeout(z, 400)); document.querySelectorAll('#bkv2-host tr.t2-row[data-al]')[4].scrollIntoView({ block: 'center' }); }); await page.waitForTimeout(500);
  await page.screenshot({ path: process.env.SHOT, clip: { x: 600, y: 250, width: 900, height: 500 } }); }
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
