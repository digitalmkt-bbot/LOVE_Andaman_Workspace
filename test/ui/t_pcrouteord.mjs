// §pcRouteOrd · petty cash (all three sheets) lists programmes in Program Config order
//
// Source (2026-10-11) · owner, screenshot of the park-fee sheet on 15 Oct:
//   "หน้านี้ โปรแกรมให้เรียงอิงตาม Program ใน Config"
//   Groups came out in the order boats were placed in Boat Operation.
// Checks
//   1 pcBoats(day, pier) is in laRouteOrdCmp order of its programmes (boats of one programme keep their order)
//   2 park-fee sheet · programme headers on screen follow that same order
//   3 reorder the programmes in config (swap two) · the sheet follows
//   4 no page errors
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1800, height: 1000 });
await goView(page, 'pop-panwa', 1000);
const S = await page.evaluate(() => {
  for (const pier of ['tublamu', 'panwa']) {
    const days = Object.keys(TRIPS).sort();
    for (const d of days) { const B = pcBoats(d, pier); const rids = [...new Set(B.map(x => x.rid))]; if (rids.length >= 2) return { pier, d, rids }; }
  }
  return { err: 'no day with 2+ programmes' }; });
if (S.err) { fail('setup ' + S.err); await close(); process.exit(1); }
const order = () => page.evaluate(s => {
  const B = pcBoats(s.d, s.pier), rids = []; B.forEach(x => { if (rids[rids.length - 1] !== x.rid) rids.push(x.rid); });
  const want = [...new Set(rids)].slice().sort(laRouteOrdCmp);
  nav(document.querySelector('.nav-item[data-view="pop-' + s.pier + '"]') || { dataset: { view: 'pop-' + s.pier }, classList: { add(){}, remove(){} } });
  _pcPier = s.pier; _pcDate = s.d; _pcYM = s.d.slice(0, 7); _pcTab = 2; renderPierCash(s.pier);
  const host = document.getElementById('pc-host-' + s.pier), txt = host ? host.innerText : '';
  const names = want.map(r => getRoute(r).name), pos = names.map(n => txt.indexOf(n));
  return { rids, want, contiguous: rids.length === new Set(rids).size, pos, names }; }, S);
const o1 = await order();
if (o1.contiguous && JSON.stringify(o1.rids) === JSON.stringify(o1.want)) ok(`1 ${S.d} ${S.pier} · ${o1.want.length} programmes in config order`); else fail('1 ' + JSON.stringify(o1));
if (o1.pos.every(p => p >= 0) && o1.pos.every((p, i) => i === 0 || p > o1.pos[i - 1])) ok('2 park-fee sheet shows them in that order: ' + o1.names.join(' → ')); else fail('2 ' + JSON.stringify(o1));
await page.evaluate(s => { getRoute(s.want[0]).sort = 9999; getRoute(s.want[s.want.length - 1]).sort = -1; }, o1);   /* last → first, first → last */
const o3 = await order();
if (o3.contiguous && JSON.stringify(o3.rids) === JSON.stringify(o3.want) && o3.want[0] === o1.want[o1.want.length - 1] && o3.want[o3.want.length - 1] === o1.want[0] && o3.pos.every((p, i) => i === 0 || p > o3.pos[i - 1])) ok('3 swapped two programmes in config · sheet follows: ' + o3.names.join(' → '));
else fail('3 ' + JSON.stringify({ o1: o1.want, o3 }));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('4 no page errors'); else fail('4 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
