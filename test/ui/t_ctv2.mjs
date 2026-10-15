// §ctV2 · หน้าต้นทุน ดีไซน์ใหม่ · หัว + สิ่งที่ค้าง + จับคู่ (ค้นหา/ตัวกรอง) + ราคาจริง (ตัวกรอง) + รวมต่อทริป + สูตรกลางพับหมวด
import { open, goView } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'costing', 1200);
const snap = await page.evaluate(() => JSON.stringify([ctPlans(), ctTpl()]));
const tick = () => page.waitForTimeout(250);

const h = await page.evaluate(() => { ctSetTab('plan');
  const P = ctPlans(), T = ctTpl(), R = ROUTES;
  const noBe = P.filter(x => !ctBreakEven(x, Math.max(1, ctPlanSeats(x) * Math.max(1, +x.boats || 1)), T)).length;
  const un = R.filter(r => !ctPlanOfFam(r.id)).length;
  const tb = k => (document.querySelector('#ct-tabs button[data-t="' + k + '"] .ct-tb') || {}).textContent;
  return { plans: P.length, un, noBe, bPlan: tb('plan'), bMatch: tb('match'), todo: (document.querySelector('.ct-todo') || {}).innerText || '' }; });
if (+h.bPlan === h.plans && +h.bMatch === h.un && /สิ่งที่ค้าง/.test(h.todo) && (!h.noBe || /ไม่คุ้ม/.test(h.todo)) && (!h.un || h.todo.indexOf('ยังไม่จับคู่ ' + h.un) >= 0))
  ok(`1 หัว · แท็บแผน ${h.bPlan} · จับคู่ ${h.bMatch} · สิ่งที่ค้าง "${h.todo.replace(/\s+/g, ' ').slice(0, 90)}…"`); else fail('1 ' + JSON.stringify(h));

const m = await page.evaluate(async () => { ctSetTab('match'); await new Promise(z => setTimeout(z, 200));
  const n = () => document.querySelectorAll('#ct-body tr.ct-mrow').length;
  const all = n(); _ct.mf = 'un'; ctRender(); const un = n(); const linkedLeft = [...document.querySelectorAll('#ct-body tr.ct-mrow .ct-tag.m')].length;
  _ct.mf = 'all'; ctRender();
  const inp = document.querySelector('.ct-msrch input'); inp.focus(); inp.value = 'krabi'; inp.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(z => setTimeout(z, 100));
  const names = [...document.querySelectorAll('#ct-body tr.ct-mrow')].map(r => r.innerText.toLowerCase());
  const focusOk = document.activeElement && document.activeElement.getAttribute('data-fk') === 'ct.mq';
  _ct.mq = ''; ctRender();
  return { all, un, linkedLeft, nk: names.length, kOk: names.every(t => t.indexOf('krabi') >= 0), focusOk, routes: ROUTES.length, unR: ROUTES.filter(r => !ctPlanOfFam(r.id)).length }; });
if (m.all === m.routes && m.un === m.unR && m.linkedLeft === 0 && m.nk > 0 && m.kOk && m.focusOk) ok(`2 จับคู่ · ทั้งหมด ${m.all} · ยังไม่จับคู่ ${m.un} · ค้น "krabi" เหลือ ${m.nk} แถว · โฟกัสค้างในช่องค้นหา`);
else fail('2 ' + JSON.stringify(m));

const r = await page.evaluate(async () => { ctSetTab('real'); await new Promise(z => setTimeout(z, 200));
  const grid = !!document.querySelector('.ct-rgrid'), cols = document.querySelectorAll('.ct-rgrid > .ct-catcard').length;
  const rows = () => document.querySelectorAll('.ct-rgrid > .ct-catcard:nth-child(2) select.ct-sel').length;
  const all = rows(); _ct.rf = 'un'; ctRender(); const un = rows(); _ct.rf = 'all'; ctRender();
  return { grid, cols, all, un, noMeal: ROUTES.filter(x => !x.mealVenueId).length, routes: ROUTES.length, van: /ค่ารถ/.test(document.getElementById('ct-body').innerText) }; });
if (r.grid && r.cols === 2 && r.all === r.routes && r.un === r.noMeal && r.van) ok(`3 ราคาจริง · สองคอลัมน์ · เส้นทาง ${r.all} · ยังไม่เลือกร้าน ${r.un} · การ์ดค่ารถยังอยู่`); else fail('3 ' + JSON.stringify(r));

const o = await page.evaluate(async () => { ctSetTab('ovr'); await new Promise(z => setTimeout(z, 200));
  const tr = document.querySelector('tr.ct-totrow'); if (!tr) return { none: true };
  const tot = [...tr.querySelectorAll('td.ct-tot b')].map(b => +b.textContent.replace(/[^\d.-]/g, ''));
  const sums = [...document.querySelectorAll('thead th.ct-pcol')].map((_, i) => [...document.querySelectorAll('tr.ct-grow td.ct-gtd[data-col="' + i + '"] .ct-gsum')].reduce((a, b) => a + +b.textContent.replace(/[^\d.-]/g, ''), 0));
  return { n: tot.length, plans: ctPlans().length, tot, sums }; });
if (!o.none && o.n === o.plans && o.tot.every((v, i) => Math.abs(v - o.sums[i]) <= 1)) ok(`4 รวมต่อทริป · ${o.n} แผน · เท่ากับผลบวกแถวหมวดทุกคอลัมน์ (${o.tot.slice(0, 4).join(' · ')}…)`); else fail('4 ' + JSON.stringify(o));

const t = await page.evaluate(async () => { ctSetTab('tpl'); await new Promise(z => setTimeout(z, 200));
  const sheet = document.querySelectorAll('.ct-tsheet').length, cats = document.querySelectorAll('.ct-tcat').length, rows0 = document.querySelectorAll('.ct-tcat .ct-mtbl tr').length;
  document.querySelector('.ct-tcat .ct-cath').click(); await new Promise(z => setTimeout(z, 100));
  const folded = document.querySelectorAll('.ct-tcat.fold').length, rows1 = document.querySelectorAll('.ct-tcat .ct-mtbl tr').length;
  ctV2TFoldAll(); const allF = document.querySelectorAll('.ct-tcat.fold').length; ctV2TFoldAll(); const none = document.querySelectorAll('.ct-tcat.fold').length;
  if (none) { ctV2TFoldAll(); }
  _ct.tfold = {}; ctRender();
  return { sheet, cats, groups: ctGroups(ctTpl()).length, rows0, folded, rows1, allF, none: document.querySelectorAll('.ct-tcat.fold').length }; });
if (t.sheet === 1 && t.cats === t.groups && t.folded === 1 && t.rows1 < t.rows0 && t.allF === t.cats && t.none === 0) ok(`5 สูตรกลาง · ชีทเดียว ${t.cats} หมวด · พับหมวดแรก ${t.rows0}→${t.rows1} แถว · หุบ/กางทั้งหมดได้`); else fail('5 ' + JSON.stringify(t));

const same = await page.evaluate(s => JSON.stringify([ctPlans(), ctTpl()]) === s, snap);
if (same && !errors.length) ok('6 แผน / สูตรกลาง ไม่ขยับ · ไม่มี error'); else fail('6 ' + JSON.stringify({ same, errors: errors.slice(0, 3) }));
await close(); process.exit(bad ? 1 : 0);
