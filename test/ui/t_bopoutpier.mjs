// §bopOutPier · Boat Operation · การ์ด "เรือที่ออกวันนี้" แยกตามท่าเรือ
//
// ที่มา (2026-10-03) · ผู้ใช้ส่งภาพการ์ด (9 ลำ เรียงปนกันทุกท่า)
//   "อันนี้แยกท่าเรือ แล้วแบ่งเรือออกมาได้ไหม แต่ไม่ต้องใหญ่มาก"
//
// กันหกอย่าง
//   1 วันที่มีเรือออกหลายท่า · มีหัวกลุ่มของแต่ละท่า เรียงทับละมุ → พันวา → ระนอง
//   2 เรือทุกลำอยู่ใต้หัวท่าของเส้นทางที่วางไว้ · ไม่มีลำไหนหายหรือซ้ำ (จำนวนเท่าป้าย "N ลำ")
//   3 หัวกลุ่มบอกจำนวนลำกับ pax รวม ตรงกับแถวข้างใต้
//   4 หัวกลุ่มเป็นแถบบาง (ไม่เกิน 24px) เตี้ยกว่าแถวเรือ
//   5 กรองท่าเดียว · เหลือหัวกลุ่มเดียว
//   6 ไม่มี error บนหน้า
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1100 });
await goView(page, 'operation', 1200);

const read = () => page.evaluate(() => { const out = []; let cur = null;
  const card = document.querySelector('#view-operation [data-bopout-pier]'); if (!card) return { groups: [], chip: '' };
  [...card.parentElement.children].forEach(el => {
    if (el.dataset.bopoutPier) { cur = { pier: el.dataset.bopoutPier, n: +el.dataset.n, txt: el.textContent.replace(/\s+/g, ' ').trim(), h: Math.round(el.getBoundingClientRect().height), boats: [] }; out.push(cur); }
    else if (el.dataset.bopoutBoat && cur) cur.boats.push({ id: el.dataset.bopoutBoat, pier: el.dataset.pier, h: Math.round(el.getBoundingClientRect().height), seats: parseInt((el.lastElementChild.textContent || '0'), 10) || 0 }); });
  return { groups: out, chip: card.parentElement.firstElementChild.textContent.replace(/\s+/g, ' ').trim() }; });

const S = await page.evaluate(async () => {
  /* วันที่มีเรือวางอยู่บนเส้นทางของ 2+ ท่า */
  let best = null;
  Object.keys(TRIPS || {}).sort().forEach(d => { const ps = {}; let n = 0;
    Object.entries(TRIPS[d] || {}).forEach(([bid, op]) => { if (!op || Array.isArray(op) || !op.route) return; const r = ROUTES.find(x => x.id === op.route); if (r && r.pier) { ps[r.pier] = 1; n++; } });
    const k = Object.keys(ps).length; if (k >= 2 && (!best || k > best.k || (k === best.k && n > best.n))) best = { d, k, n }; });
  if (!best) return { err: 'no day with boats on 2+ piers' };
  _bop2.pier = 'all'; _bop2.selDate = best.d; renderOp(); await new Promise(z => setTimeout(z, 600));
  const F = bop2FleetStatus(best.d).assigned;
  return { d: best.d, want: F.map(a => ({ id: a.boat.id, pier: (a.route && a.route.pier) || getBoatCurrentPier(a.boat, best.d), seats: +a.seats || 0 })) };
});
if (S.err) { fail('setup · ' + S.err); await close(); process.exit(1); }
const R = await read();
const G = R.groups, RANK = ['tublamu', 'panwa', 'ranong'];
const piers = G.map(g => g.pier), sorted = piers.slice().sort((a, b) => (RANK.indexOf(a) < 0 ? 9 : RANK.indexOf(a)) - (RANK.indexOf(b) < 0 ? 9 : RANK.indexOf(b)));
if (G.length >= 2 && new Set(piers).size === G.length && piers.join() === sorted.join()) ok(`1 ${S.d} · ${G.length} กลุ่มท่า เรียง ${piers.join(' → ')}`);
else fail('1 ' + JSON.stringify(piers));

const all = G.flatMap(g => g.boats), ids = all.map(b => b.id);
const wrong = all.filter(b => { const w = S.want.find(x => x.id === b.id); return !w || w.pier !== b.pier || !G.find(g => g.pier === b.pier).boats.includes(b); });
if (ids.length === S.want.length && new Set(ids).size === ids.length && !wrong.length && R.chip.includes(String(S.want.length))) ok(`2 เรือ ${ids.length} ลำอยู่ใต้หัวท่าของเส้นทางที่วางไว้ครบ ไม่หาย ไม่ซ้ำ`);
else fail('2 ' + JSON.stringify({ n: ids.length, want: S.want.length, wrong: wrong.slice(0, 3), chip: R.chip }));

const b3 = G.filter(g => g.n !== g.boats.length || !g.txt.includes(g.boats.length + ' ลำ') || !g.txt.includes(g.boats.reduce((t, b) => t + b.seats, 0) + ' pax'));
if (!b3.length) ok(`3 หัวกลุ่มบอกจำนวนลำกับ pax รวมถูก เช่น "${G[0].txt}"`);
else fail('3 ' + JSON.stringify(b3.map(g => ({ txt: g.txt, n: g.boats.length, pax: g.boats.reduce((t, b) => t + b.seats, 0) }))));

const hMax = Math.max(...G.map(g => g.h)), rowH = Math.min(...all.map(b => b.h));
if (hMax <= 24 && hMax < rowH) ok(`4 หัวกลุ่มสูง ${hMax}px (แถวเรือ ${rowH}px)`); else fail('4 ' + JSON.stringify({ hMax, rowH }));

const one = await page.evaluate(async p => { bop2SetPier(p); await new Promise(z => setTimeout(z, 500)); const g = [...document.querySelectorAll('#view-operation [data-bopout-pier]')].map(x => x.dataset.bopoutPier); bop2SetPier('all'); return g; }, piers[0]);
if (one.length === 1 && one[0] === piers[0]) ok(`5 กรองท่า ${piers[0]} · เหลือหัวกลุ่มเดียว`); else fail('5 ' + JSON.stringify(one));

const e1 = errors.filter(e => !/Failed to load resource/.test(e));
if (!e1.length) ok('6 ไม่มี error บนหน้า'); else fail('6 ' + e1.slice(0, 3).join(' | '));
if (process.env.SHOT) { await page.waitForTimeout(500); const el = await page.evaluateHandle(() => document.querySelector('#view-operation [data-bopout-pier]').parentElement); await el.asElement().screenshot({ path: process.env.SHOT }); }
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
