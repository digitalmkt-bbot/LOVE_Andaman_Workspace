// §pbPax · แถบโปรแกรมในใบงาน By trip แยก AD · CHD · INF · FOC ลงใต้หัวคอลัมน์
//
// ที่มา (2026-10-02) · ผู้ใช้ขอให้ตัวเลขบนแถบโปรแกรม ("8/65") แยกเป็นสี่ประเภท
//   ให้ตรงกับคอลัมน์ข้างบน ผลรวมอยู่ต่อท้าย และตัวเลขใหญ่กว่าแถวข้างล่าง
//
// กันหกอย่าง
//   1 ทุกแถบมีสี่ช่อง และจุดกึ่งกลางของแต่ละช่องตรงกับหัว AD CHD INF FOC (±1px)
//   2 ตัวเลขในสี่ช่องเท่ากับผลบวกของแถวลูกค้าที่ยืนยันแล้วในตารางเดียวกัน
//   3 ผลรวมที่นั่ง/ความจุอยู่ต่อท้ายช่อง FOC ทันที · มาก่อนป้ายเรือ/ล็อก
//   4 ตัวเลขบนแถบใหญ่กว่าตัวเลขในแถวข้างล่าง
//   5 สี่ช่องบวกกันไม่เท่าที่นั่งที่ใช้ไป ต้องมีป้ายบอกยอดรวมคนจริง · เท่ากันไม่ต้องมี
//   6 ชื่อโปรแกรมไม่ถูกตัดแบบเงียบ และไม่มี error บนหน้า
//   7 (§pbPax2) เหมาลำไม่ถูกนับในสี่ช่องของแถบโปรแกรม · แถบ CHARTER บอกยอดแยกประเภทของตัวเอง
//   8 (§pbGap) มีบรรทัดเว้นก่อนและหลังกลุ่ม Lock · ทริปที่ไม่มีล็อกไม่มีบรรทัดเว้นเกินมา
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
await goView(page, 'booking', 900);
const GO = await page.evaluate(() => {
  const c = {};
  (SB_BOOKINGS || []).forEach(b => {
    if (['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)) return;
    (b.trips || []).forEach(t => { if (t && t.date) c[t.date] = (c[t.date] || 0) + 1; });
  });
  const ch = {};
  (SB_BOOKINGS || []).forEach(b => {
    if (['cancelled', 'rejected', 'cancelled_weather', 'pending_approval'].includes(b.status)) return;
    (b.trips || []).forEach(t => { if (t && t.date && t.bookingMode === 'charter') ch[t.date] = 1; });
  });
  const days = Object.keys(c).sort((a, b) => c[b] - c[a]);
  const day = days.find(d => ch[d]) || days[0];
  if (!day) return { err: 'no bookings in this data set' };
  /* ล็อกที่นั่งหนึ่งใบบนเส้นทางที่มีคนมากสุดของวันนั้น · ชุดข้อมูลทดสอบไม่มีล็อกติดมา */
  const rc = {};
  (SB_BOOKINGS || []).forEach(b => { if (['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)) return;
    (b.trips || []).forEach(t => { if (t && t.date === day) rc[t.routeId] = (rc[t.routeId] || 0) + 1; }); });
  const rid = Object.keys(rc).sort((a, b) => rc[b] - rc[a])[0];
  const ag = (SB_AGENTS || [])[0];
  let lk = null;
  try { lk = bkV2CreateLock({ scope: 'day', routeId: rid, date: day, agentId: ag && ag.id, qty: 2, reason: 'test · pbgap' }); } catch (e) { lk = { err: String(e && e.message || e) }; }
  _bkV2.filterDate = day; _bkV2.filterRoute = null;
  if (typeof bkV2SwitchTab === 'function') bkV2SwitchTab('bytrip');
  return { day, n: c[day], hasCh: !!ch[day], lk: lk && (lk.id || lk.err || JSON.stringify(lk).slice(0, 80)) };
});
if (GO.err) { fail(GO.err); await close(); process.exit(1); }
await page.waitForTimeout(1600);

const B = await page.evaluate(() => [...document.querySelectorAll('tr.t2-pband')].map(tr => {
  const tb = tr.closest('table');
  const mid = e => { const r = e.getBoundingClientRect(); return r.left + r.width / 2; };
  const ths = [...tb.querySelectorAll('thead th')].slice(3, 7);
  const pps = [...tr.querySelectorAll('td.pp')];
  /* แถวลูกค้าที่ยืนยันแล้ว · ไม่ใช่ใบรออนุมัติ (pnrow) ล็อก (lrow) จุดแวะ (vsrow) หรือใบยกเลิก */
  /* แถวของบล็อกเหมาลำ = ตั้งแต่แถบ CHARTER จนถึงบรรทัดเว้นท้ายบล็อก */
  const all = [...tb.querySelectorAll('tbody > tr')]; const inCh = new Set(); let on = false;
  all.forEach(r => { if (r.classList.contains('t2-zband-ch')) on = true;
    else if (on && (r.classList.contains('t2-zgap') || r.classList.contains('t2-zband'))) on = false;
    else if (on) inCh.add(r); });
  const plain = r => !/t2-pnrow|t2-lrow|t2-vsrow|cxl|cancel/i.test(r.className);
  const rows = [...tb.querySelectorAll('tbody tr.t2-row')].filter(r => plain(r) && !inCh.has(r));
  const chRows = [...inCh].filter(r => r.classList.contains('t2-row') && plain(r));
  const chSum = [0, 0, 0, 0];
  chRows.forEach(r => { for (let i = 0; i < 4; i++) { const c = r.children[3 + i]; if (c) chSum[i] += parseInt((c.textContent || '').replace(/[^0-9]/g, ''), 10) || 0; } });
  const chBand = ((tb.querySelector('tr.t2-zband-ch .zsub') || {}).textContent || '').replace(/\s+/g, ' ').trim();
  /* บรรทัดเว้นรอบกลุ่มล็อก */
  const lks = all.filter(r => r.classList.contains('t2-lrow'));
  const gaps = all.filter(r => r.classList.contains('t2-lkgap'));
  const gapInfo = { nLk: lks.length, nGap: gaps.length,
    before: lks.length ? !!(lks[0].previousElementSibling && lks[0].previousElementSibling.classList.contains('t2-lkgap')) : null,
    after: lks.length ? (() => { let n = lks[lks.length - 1].nextElementSibling; while (n && n.classList.contains('t2-lrow')) n = n.nextElementSibling; return !n || n.classList.contains('t2-lkgap'); })() : null,
    gapH: gaps.length ? Math.round(gaps[0].getBoundingClientRect().height) : 0,
    bandThenLock: !!(tr.nextElementSibling && tr.nextElementSibling.classList.contains('t2-lrow')) };
  const sum = [0, 0, 0, 0]; let rowFs = 0;
  rows.forEach(r => { const td = r.children; for (let i = 0; i < 4; i++) {
    const c = td[3 + i]; if (!c) continue; sum[i] += parseInt((c.textContent || '').replace(/[^0-9]/g, ''), 10) || 0;
    rowFs = Math.max(rowFs, parseFloat(getComputedStyle(c).fontSize) || 0); } });
  const pr = tr.querySelector('td.pr'), ps = tr.querySelector('.ps'), pn = tr.querySelector('.pn');
  const used = parseInt(((ps && ps.querySelector('b')) || {}).textContent || '', 10);
  return { nm: pn ? pn.textContent : '', nth: ths.map(t => t.textContent.trim()),
    dx: pps.map((p, i) => ths[i] ? Math.abs(mid(p) - mid(ths[i])) : 99),
    val: pps.map(p => parseInt(p.textContent, 10) || 0), sum, rows: rows.length, chSum, chRows: chRows.length, chBand, gapInfo,
    keys: pps.map(p => p.getAttribute('data-px')),
    fs: pps.map(p => parseFloat(getComputedStyle(p).fontSize)), rowFs,
    usedFs: ps && ps.querySelector('b') ? parseFloat(getComputedStyle(ps.querySelector('b')).fontSize) : 0,
    used, psFirst: !!(pr && ps && pr.querySelector('.pw') && pr.querySelector('.pw').firstElementChild === ps),
    prAfter: !!(pr && pps[3] && pps[3].nextElementSibling === pr),
    tot: ((tr.querySelector('.ptot') || {}).textContent || '').trim(),
    silent: pn ? (pn.scrollWidth > pn.clientWidth + 1 && (getComputedStyle(pn).textOverflow !== 'ellipsis' || !pn.title)) : true,
    cells: [...tr.children].reduce((n, td) => n + (td.colSpan || 1), 0),
    cols: tb.querySelectorAll('thead th').length };
}));
if (!B.length) { fail('no programme band on ' + GO.day); await close(); process.exit(1); }

const b1 = B.filter(b => b.dx.length !== 4 || b.dx.some(d => d > 1) || b.nth.join() !== 'AD,CHD,INF,FOC' || b.keys.join() !== 'ad,chd,inf,foc' || b.cells !== b.cols);
if (!b1.length) ok(`1 ทั้ง ${B.length} แถบ · สี่ช่องอยู่ใต้หัว AD CHD INF FOC พอดี (เพี้ยนสูงสุด ${Math.max(...B.flatMap(b => b.dx)).toFixed(1)}px)`);
else fail('1 ช่องไม่ตรงหัวคอลัมน์: ' + JSON.stringify(b1.slice(0, 2).map(b => ({ nm: b.nm, dx: b.dx, cells: b.cells, cols: b.cols }))));

const b2 = B.filter(b => b.val.join() !== b.sum.join());
const withPax = B.filter(b => b.sum.reduce((a, x) => a + x, 0) > 0).length;
if (!b2.length && withPax > 0) ok(`2 ตัวเลขสี่ช่องเท่ากับผลบวกของแถวลูกค้า (${withPax} แถบที่มีคน)`);
else fail('2 ตัวเลขไม่ตรงกับแถว: ' + JSON.stringify(b2.slice(0, 3).map(b => ({ nm: b.nm, band: b.val, rows: b.sum }))) + ' · withPax ' + withPax);

const b3 = B.filter(b => !b.prAfter || !b.psFirst);
if (!b3.length) ok('3 ผลรวมที่นั่ง/ความจุอยู่ต่อท้ายช่อง FOC ทันที ก่อนป้ายอื่น');
else fail('3 ผลรวมไม่ได้อยู่ต่อท้าย: ' + b3.slice(0, 3).map(b => b.nm).join(' | '));

const b4 = B.filter(b => b.rowFs > 0 && (b.fs.some(f => f <= b.rowFs) || b.usedFs <= b.rowFs));
if (!b4.length && B.some(b => b.rowFs > 0)) ok(`4 ตัวเลขบนแถบ ${B[0].fs[0]}px ใหญ่กว่าแถวข้างล่าง ${Math.max(...B.map(b => b.rowFs))}px`);
else fail('4 ตัวเลขบนแถบไม่ใหญ่กว่าแถว: ' + JSON.stringify(b4.slice(0, 2).map(b => ({ fs: b.fs, usedFs: b.usedFs, rowFs: b.rowFs }))));

const b5 = B.filter(b => { const t = b.val.reduce((a, x) => a + x, 0);
  return (t !== b.used) ? !(b.tot && b.tot.indexOf(String(t)) >= 0) : !!b.tot; });
const nDiff = B.filter(b => b.val.reduce((a, x) => a + x, 0) !== b.used).length;
if (!b5.length) ok(`5 ยอดรวมคนไม่เท่าที่นั่ง มีป้ายบอก (${nDiff} แถบ) · เท่ากันไม่มีป้าย (${B.length - nDiff} แถบ)`);
else fail('5 ป้ายยอดรวมผิด: ' + JSON.stringify(b5.slice(0, 3).map(b => ({ nm: b.nm, val: b.val, used: b.used, tot: b.tot }))));

/* ชื่อยาวเกินสามคอลัมน์แรก · ต้องถูกตัดด้วยจุดไข่ปลา มี title และห้ามดันช่อง AD ให้เลื่อน */
const L = await page.evaluate(() => {
  const tr = document.querySelector('tr.t2-pband'), pn = tr.querySelector('.pn'), tb = tr.closest('table');
  const mid = e => { const r = e.getBoundingClientRect(); return r.left + r.width / 2; };
  pn.textContent = pn.textContent + ' ' + 'Sunrise Premium Private Charter Experience '.repeat(3);
  const th = tb.querySelectorAll('thead th')[3], pp = tr.querySelector('td.pp');
  return { clipped: pn.scrollWidth > pn.clientWidth + 1, ell: getComputedStyle(pn).textOverflow === 'ellipsis',
    title: !!pn.title, dx: Math.abs(mid(pp) - mid(th)), h: tr.getBoundingClientRect().height };
});
const longOk = L.clipped && L.ell && L.title && L.dx <= 1 && L.h < 60;
const b6 = B.filter(b => b.silent);
if (!longOk) fail('6 ชื่อยาวเกินช่อง: ' + JSON.stringify(L));
if (longOk && !b6.length && !errors.length) ok('6 ชื่อโปรแกรมไม่ถูกตัดแบบเงียบ · ไม่มี error บนหน้า');
else fail('6 ' + (b6.length ? 'ชื่อถูกตัดเงียบ: ' + b6.map(b => b.nm).join(' | ') : '') + (errors.length ? ' errors: ' + errors.slice(0, 2).join(' | ') : ''));

/* ══ 7 · เหมาลำแยกจากยอดบนแถบ ══ */
const C = B.filter(b => b.chRows > 0);
if (!C.length) fail('7 วันนี้ไม่มีใบเหมาลำให้ทดสอบ (' + GO.day + ') · ข้อนี้พิสูจน์อะไรไม่ได้');
else {
  const b7 = C.filter(b => { const tot = b.chSum.reduce((a, x) => a + x, 0);
    const want = [['AD', b.chSum[0]], ['CHD', b.chSum[1]], ['INF', b.chSum[2]], ['FOC', b.chSum[3]]].filter(x => x[1]).map(x => x[0] + ' ' + x[1]);
    return b.val.join() !== b.sum.join() || tot === 0 || b.chBand.indexOf(tot + ' pax') < 0 || want.some(w => b.chBand.indexOf(w) < 0); });
  if (!b7.length) ok(`7 เหมาลำ ${C.reduce((a, b) => a + b.chSum.reduce((x, y) => x + y, 0), 0)} คน ไม่อยู่ในสี่ช่องของแถบโปรแกรม · แถบ CHARTER บอกยอดแยกประเภทเอง ("${C[0].chBand}")`);
  else fail('7 เหมาลำยังปนในยอดรวม หรือแถบ CHARTER ไม่บอกยอด: ' + JSON.stringify(b7.slice(0, 2).map(b => ({ band: b.val, seat: b.sum, ch: b.chSum, chBand: b.chBand }))));
}

/* ══ 8 · บรรทัดเว้นรอบกลุ่ม Lock ══ */
const WL = B.filter(b => b.gapInfo.nLk > 0), NL = B.filter(b => b.gapInfo.nLk === 0);
if (!WL.length) fail('8 สร้างล็อกทดสอบไม่ขึ้น (' + GO.lk + ') · ข้อนี้พิสูจน์อะไรไม่ได้');
else {
  const b8 = WL.filter(b => !b.gapInfo.before || !b.gapInfo.after || b.gapInfo.bandThenLock || b.gapInfo.gapH < 12)
    .concat(NL.filter(b => b.gapInfo.nGap > 0));
  if (!b8.length) ok(`8 มีบรรทัดเว้น ${WL[0].gapInfo.gapH}px ก่อนและหลังกลุ่ม Lock (${WL.length} ทริป) · ทริปไม่มีล็อกไม่มีบรรทัดเว้นเกิน (${NL.length} ทริป)`);
  else fail('8 บรรทัดเว้นผิด: ' + JSON.stringify(b8.slice(0, 3).map(b => ({ nm: b.nm, g: b.gapInfo }))));
}

await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
