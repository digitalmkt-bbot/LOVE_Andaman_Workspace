// §btOrder · By trip · ลำดับในการ์ด Programmes + ตาราง
// ที่มา (2026-10-15) · owner ส่งภาพ 19 กับ 20 ต.ค. "ทำไม 2 อันนี้ถึงจัดเรียงไม่เหมือนกัน"
//   เดิม: โปรแกรมเรียงตาม pax มากไปน้อย (เปลี่ยนทุกวัน) · รอบที่ออกเวลาเดียวกันไม่มีกฎ (ตามใบจองที่เจอก่อน)
//   owner: "ให้รอบที่ออกเวลาเดียวกันเรียงตามลำดับที่ตั้งไว้" + "ตายตัวทุกวัน (Similan → Surin → Phi Phi → …)"
// กัน
//   1 การ์ด Programmes · โปรแกรมเรียงตาม _BKV2_FAMILIES ทุกวันที่มีหลายโปรแกรม (ไม่ใช่ตาม pax)
//   2 รอบในโปรแกรม · เรียงตามเวลา · เวลาเท่ากันเรียงตามลำดับใน ROUTES
//   3 สลับลำดับสองรอบที่ออกเวลาเดียวกันใน ROUTES (ในหน่วยความจำ) → การ์ดและตารางสลับตาม
//   4 ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 900 });
await goView(page, 'booking', 800);
const dates = await page.evaluate(() => { const c = {}; SB_BOOKINGS.forEach(b => { if (/cancel|reject/.test(b.status)) return; (b.trips || []).forEach(t => { const f = bkV2RouteFamily(t.routeId); if (!f) return; (c[t.date] = c[t.date] || new Set()).add(f.id); }); });
  return Object.keys(c).filter(d => c[d].size >= 2).sort(); });
const READ = () => page.evaluate(() => { const fams = [], vars = {}; let cur = null;
  document.querySelectorAll('#view-booking .bt-prog .bt-pgbody > *').forEach(el => {
    if (el.classList.contains('bt-pgf')) { const oc = el.getAttribute('onclick') || ''; const m = /SetFamily\('([^']*)'\)/.exec(oc); cur = m ? m[1] : el.querySelector('.nm').textContent; fams.push({ id: cur, pax: +(el.querySelector('.n') || {}).textContent || 0 }); vars[cur] = []; }
    else if (el.classList.contains('bt-pgv') && cur) { const m = /SetRoute\('([^']*)'\)/.exec(el.getAttribute('onclick') || ''); vars[cur].push({ rid: m ? m[1] : '', tm: (el.children[1].textContent.match(/\d{1,2}:\d{2}/) || [''])[0] }); }
  });
  const bands = [...document.querySelectorAll('#view-booking table.t2-mtbl tr.t2-pband')].map(tr => (tr.querySelector('.pn') || {}).textContent);
  return { fams, vars, bands, F: _BKV2_FAMILIES.map(f => f.id), R: ROUTES.map(r => r.id) }; });
let r1 = [], r2 = [], paxDiff = 0, tieN = 0, tie = null;
for (const d of dates) {
  await page.evaluate(dd => { _bkV2.tab = 'bytrip'; _bkV2.filterDate = dd; _bkV2T2Pier = 'all'; _bkV2T2Family = ''; _bkV2.filterRoute = null; bkV2Render(); }, d); await page.waitForTimeout(250);
  const o = await READ();
  const fi = o.fams.map(f => o.F.indexOf(f.id));
  if (fi.some((v, i) => i && v < fi[i - 1])) r1.push(d + ':' + o.fams.map(f => f.id).join('>'));
  if (o.fams.some((f, i) => i && f.pax > o.fams[i - 1].pax)) paxDiff++;
  Object.keys(o.vars).forEach(k => { const v = o.vars[k]; v.forEach((x, i) => { if (!i) return; const p = v[i - 1];
    if (x.tm < p.tm) r2.push(d + ':' + k + ' time'); if (x.tm === p.tm) { tieN++; if (!tie) tie = { d, a: p.rid, b: x.rid }; if (o.R.indexOf(x.rid) < o.R.indexOf(p.rid)) r2.push(d + ':' + k + ' tie'); } }); });
}
if (dates.length && !r1.length && paxDiff > 0) ok(`1 Programmes เรียงตามลำดับตายตัว ${dates.length} วัน (มี ${paxDiff} วันที่ลำดับนี้ไม่ใช่ลำดับตาม pax)`); else fail('1 ' + JSON.stringify({ n: dates.length, r1: r1.slice(0, 4), paxDiff }));
if (!r2.length && tieN > 0) ok(`2 รอบเรียงตามเวลา · เวลาเท่ากัน ${tieN} คู่เรียงตามลำดับใน ROUTES`); else fail('2 ' + JSON.stringify({ r2: r2.slice(0, 4), tieN }));
// 3 swap the tie pair in ROUTES (memory only)
if (tie) {
  const pos = s => s.indexOf(tie.a) < s.indexOf(tie.b) ? 'ab' : 'ba';
  await page.evaluate(t => { _bkV2.filterDate = t.d; bkV2Render(); }, tie); await page.waitForTimeout(300);
  const before = await page.evaluate(t => { const v = [...document.querySelectorAll('#view-booking .bt-pgv')].map(e => (/SetRoute\('([^']*)'\)/.exec(e.getAttribute('onclick') || '') || [])[1]);
    const nm = id => (ROUTES.find(r => r.id === id) || {}).name; const bands = [...document.querySelectorAll('#view-booking table.t2-mtbl tr.t2-pband .pn')].map(e => e.textContent.trim()); return { v, bands, na: nm(t.a), nb: nm(t.b) }; }, tie);
  await page.evaluate(t => { const i = ROUTES.findIndex(r => r.id === t.a), j = ROUTES.findIndex(r => r.id === t.b); const x = ROUTES[i]; ROUTES[i] = ROUTES[j]; ROUTES[j] = x; bkV2Render(); }, tie); await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ v: [...document.querySelectorAll('#view-booking .bt-pgv')].map(e => (/SetRoute\('([^']*)'\)/.exec(e.getAttribute('onclick') || '') || [])[1]), bands: [...document.querySelectorAll('#view-booking table.t2-mtbl tr.t2-pband .pn')].map(e => e.textContent.trim()) }));
  await page.evaluate(t => { const i = ROUTES.findIndex(r => r.id === t.a), j = ROUTES.findIndex(r => r.id === t.b); const x = ROUTES[i]; ROUTES[i] = ROUTES[j]; ROUTES[j] = x; bkV2Render(); }, tie);
  const bpos = (b, x) => { const i = b.findIndex(n => n && n.includes(x.na)), j = b.findIndex(n => n && n.includes(x.nb)); return (i < 0 || j < 0) ? '?' : (i < j ? 'ab' : 'ba'); };
  const nm = { na: before.na, nb: before.nb };
  if (pos(before.v) === 'ab' && pos(after.v) === 'ba' && bpos(before.bands, nm) !== bpos(after.bands, nm) && bpos(before.bands, nm) !== '?')
    ok(`3 สลับ ${before.na} / ${before.nb} (เวลาเดียวกัน) ในลำดับเส้นทาง → การ์ด Programmes และตารางสลับตาม`);
  else fail('3 ' + JSON.stringify({ tie, before, after, nm }));
} else fail('3 no tie pair in data');
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('4 ไม่มี error'); else fail('4 ' + e1.slice(0, 3).join(' | '));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
