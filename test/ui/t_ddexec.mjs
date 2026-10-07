// §ddExec · Executive Summary ในป๊อปอัป "รายละเอียดใบจองทั้งวัน" (Dashboard → Bookings keyed in today)
//
// ที่มา (7 ต.ค. 2026) · เจ้าของ: "อยากได้ Executive Summary ของวันนั้น ๆ ใช้เป็น Report รายวัน ให้ทีมเซลล์ดูว่า
//   วันนี้มีบุคกิ้งอะไรเข้าบ้าง ไปวันไหนบ้าง และอีก 7 วันล่วงหน้ายังมีที่นั่งว่างเท่าไหร่ ต้องหาลูกค้าเพิ่มอีกเท่าไหร่"
//   เลือกแบบ bullet 4 ข้อ (ม็อกอัป v3)
//
// กันสิบเอ็ดอย่าง
//   1 มุมมองวันเดียว · มีก้อน exec + ก้อนไปวันไหน + ตาราง 7 วัน · bullet 4 ข้อ · ตัวเลข "คีย์วันนี้" ตรงกับ _ddSum (ไม่นับใบยกเลิก/ใบบริษัท)
//   2 "ไปใน 7 วัน" นับเองจากใบจริง (วันเดินทางแรก อยู่ใน to+1..to+7) ตรงกับที่โชว์ · รายการไปวันไหนสองชั้น (§ddTravel2) หัวเดือน=ผลรวมวันใต้ · เดือนที่มีวันใน 7 วันเปิด เดือนไกลพับ · กลุ่ม "ถึงวันนี้" ขึ้นก่อน
//   3 ตาราง 7 วัน · ช่องเส้นทาง×วัน มีครบทุกคู่ที่ TRIPS มีเรือ · จอง/ความจุ/ว่าง ตรง getAllotment · แถวรวมบวกถูก
//   4 จุดคุ้มทุน · ตั้งแผนต้นทุนให้เส้นทาง (ราคา 2,500) → ช่องที่เคย "ไม่รู้จุดคุ้มทุน" กลายเป็นรู้ · ขาด = max(0, Σคุ้มทุนต่อลำ − จอง) · สีตามขาด (ok/warn/bad)
//   5 ป้าย +N ของช่อง = pax ของใบที่คีย์วันนี้ที่ไปเส้นทาง-วันนั้น (นับเอง)
//   6 ปุ่มคัดลอกส่ง LINE · อังกฤษล้วน (§ddEn · ก้อนในแอปก็ไม่มีตัวไทย) · ข้อความล้วน หัววัน · เข้ามาวันนี้ · ไป 7 วัน · ส่วน 7 วันข้างหน้าเรียงตามวัน บรรทัดละวัน รหัสสั้น (PP/MT…) + คำอธิบายรหัส · toast ขึ้น
//   7 มุมมองช่วงหลายวัน (7 วัน) · ไม่มีก้อน exec · ของเดิม (การ์ด B2C/B2B) ยังอยู่ · ไม่มี error
//   9 §ddTodo2 · การ์ด to-do: หัว วัน·เส้นทาง · ป้ายคำสั่ง (Sell N more / N seats left / Full) · ตัวเลข booked/break-even/open · ขีดคุ้มทุนบนแถบตรงตำแหน่ง
//  11 §ddBE2 · ใบยอดเงิน 0 ไม่ถ่วงราคาเฉลี่ย · สองลำบนกระดานวันเดียวกัน คิดจุดคุ้มทุนเฉพาะลำที่ต้องออกตามคนจอง (ไม่บวกสองลำ)
//  10 §ddBE2 · จุดคุ้มทุนคิดจากราคาเฉลี่ยของใบจองจริงในวันนั้น (ไม่ใช่ราคาในแผน) · ราคาต่ำจนไม่คุ้มแม้เต็มลำ = "won't break even" แยกจาก "no cost plan" ไม่นับขาด
//   8 §ddIdle · ลำที่วางบนกระดานแต่จอง 0 คน = "no bookings yet" ไม่นับขาด ไม่ขึ้น to-do/LINE ไม่เข้ายอดที่นั่ง · โปรแกรมปิดฤดู/ปิดอากาศไม่โผล่ (ชุดเดียวกับปฏิทิน)
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1100 });
page.on('dialog', async d => { try { await d.accept(); } catch (_) {} });
await goView(page, 'dashboard', 800);
const DATE = '2026-09-15';

/* ══ 1 ══ */
const s1 = await page.evaluate((DATE) => {
  if (typeof setDashDate === 'function') setDashDate(DATE); window._dashDate = DATE;
  dashOpenDayDetail('b2b');
  const X = window._ddExecX, rows = _ddRows(), S = { b2c: _ddSum(rows, 'b2c'), b2b: _ddSum(rows, 'b2b') };
  const ex = document.querySelector('[data-dd="exec"]');
  const kv = [...document.querySelectorAll('[data-dd="exec"] .k .v')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
  return { has: !!ex, trav: !!document.querySelector('[data-dd="travel"]'), grid: !!document.querySelector('[data-dd="grid"]'),
    nBul: document.querySelectorAll('[data-dd="exec"] .bul li').length, n: X.n, pax: X.pax, sn: S.b2c.n + S.b2b.n, sp: S.b2c.pax + S.b2b.pax, kv, sums: !!document.querySelector('.dv-ddsums') };
}, DATE);
if (s1.has && s1.trav && s1.grid && s1.nBul === 4 && s1.n === s1.sn && s1.pax === s1.sp && s1.kv[0].startsWith(String(s1.n)) && s1.sums)
  ok(`1 วันเดียว · exec + ไปวันไหน + ตาราง · bullet 4 ข้อ · คีย์วันนี้ ${s1.n} ใบ ${s1.pax} คน ตรง _ddSum · การ์ด B2C/B2B ยังอยู่`);
else fail('1 ' + JSON.stringify(s1));

/* ══ 2 ══ */
const s2 = await page.evaluate((DATE) => {
  const X = window._ddExecX, rows = _ddRows().filter(r => !r.cxl && !r.intFree);
  const days = X.days; let n = 0, pax = 0;
  rows.forEach(r => { const d = (r.trips[0] || {}).date; if (days.includes(d)) { n++; pax += r.pax; } });
  const sumN = X.travel.reduce((s, t) => s + t.n, 0);
  const firstK = (X.travel[0] || {}).k, hasPast = X.travel.some(t => t.k.charAt(0) === '<');
  /* §ddTravel2 · สองชั้น · หัวเดือน (.mh) + วัน (.day) · ยอดหัวเดือน = ผลรวมวันใต้ · เดือนที่มีวันใน 7 วันเปิดไว้ เดือนไกลพับ */
  const groups = [...document.querySelectorAll('[data-dd="travel"] .mg')];
  const gOk = groups.every(g => { const m = X.travelM.find(x => x.k === g.getAttribute('data-m')); if (!m) return false;
    const dayRows = [...g.querySelectorAll('.r.day')]; if (m.k === '<') return dayRows.length === 0;
    const sumD = m.days.reduce((s, d) => s + d.n, 0), sumP = m.days.reduce((s, d) => s + d.pax, 0);
    const openOk = g.classList.contains('open') === (m.soon || false);
    const shown = dayRows.length && getComputedStyle(dayRows[0]).display !== 'none';
    return dayRows.length === m.days.length && sumD === m.n && sumP === m.pax && openOk && (shown === g.classList.contains('open')); });
  const sumM = X.travelM.reduce((s, m) => s + m.n, 0);
  const soonDom = [...document.querySelectorAll('[data-dd="travel"] .r.day.soon')].length;
  const firstM = (X.travelM[0] || {}).k, hasPastM = X.travelM.some(m => m.k === '<');
  const soonMonthsOpen = X.travelM.filter(m => m.soon).every(m => m.open);
  return { n, pax, w7: X.w7, sumN, xn: X.n, firstK, hasPast, soonDom, soonX: X.travel.filter(t => t.soon).length, nDom: groups.length, nX: X.travelM.length, days0: days[0], exp0: _ddAddDays(DATE, 1), gOk, sumM, firstM, hasPastM, soonMonthsOpen };
}, DATE);
if (s2.w7.n === s2.n && s2.w7.pax === s2.pax && s2.sumN === s2.xn && s2.sumM === s2.xn && s2.days0 === s2.exp0 && (!s2.hasPast || s2.firstK.charAt(0) === '<') && (!s2.hasPastM || s2.firstM === '<') && s2.soonDom === s2.soonX && s2.nDom === s2.nX && s2.soonX <= 7 && s2.gOk && s2.soonMonthsOpen)
  ok(`2 ไปใน 7 วัน ${s2.n} ใบ ${s2.pax} คน นับเองตรง · รายการไปวันไหน ${s2.nX} เดือน (สองชั้น หัวเดือน=ผลรวมวัน) รวม ${s2.sumM} ใบครบ · ${s2.soonX} วันใน 7 วันเปิดอยู่ · เดือนไกลพับ`);
else fail('2 ' + JSON.stringify(s2));

/* ══ 3 ══ */
const s3 = await page.evaluate(() => {
  const X = window._ddExecX; let expect = 0, miss = [], wrong = [];
  X.days.forEach(d => { const rs = {}; _calTripsFor(d, '').forEach(t => { if (t && t.r && !t.isCharter) rs[t.r.id] = 1; });   /* §ddIdle · ชุดเดียวกับปฏิทิน */
    Object.keys(rs).forEach(rid => { const A = getAllotment(rid, d); if (!A.hasAllotment) return; expect++;
      const c = X.cells[d + '|' + rid]; if (!c) { miss.push(d + '|' + rid); return; }
      if (c.bk !== A.seatsConsumed || c.cap !== A.totalCapacity || c.av !== A.seatsAvailable) wrong.push(d + '|' + rid);
      const el = document.querySelector('[data-cell="' + d + '|' + rid + '"]'); if (!el || !el.textContent.includes(String(c.bk))) wrong.push('dom ' + d + '|' + rid); }); });
  const d0 = X.days.find(d => X.colTot[d] && X.colTot[d].n), T = d0 ? X.colTot[d0] : null;
  let cap = 0, bk = 0; if (d0) Object.keys(X.cells).forEach(k => { const c = X.cells[k]; if (k.startsWith(d0 + '|') && c.st !== 'idle' && c.st !== 'wx') { cap += c.cap; bk += c.bk; } });
  return { expect, got: Object.keys(X.cells).length, miss, wrong, d0, T, cap, bk };
});
if (s3.expect > 0 && s3.got === s3.expect && !s3.miss.length && !s3.wrong.length && s3.T && s3.T.cap === s3.cap && s3.T.bk === s3.bk)
  ok(`3 ตาราง 7 วัน · ${s3.got} ช่อง ครบทุกคู่เส้นทาง×วันที่มีเรือ · จอง/ความจุ/ว่างตรง getAllotment · แถวรวม ${s3.d0}: ${s3.T.bk}/${s3.T.cap} บวกถูก`);
else fail('3 ' + JSON.stringify(s3));

/* ══ 4 · ตั้งแผนต้นทุนให้เส้นทางที่มีเรือมากสุด ══ */
const s4 = await page.evaluate(() => {
  const X = window._ddExecX;
  const cnt = {}; Object.keys(X.cells).forEach(k => { const rid = k.split('|')[1]; cnt[rid] = (cnt[rid] || 0) + 1; });
  const rid = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
  const before = Object.keys(X.cells).filter(k => k.endsWith('|' + rid)).map(k => X.cells[k].st);
  const P = ctPlans(); const pl = ctBlankPlan('test ' + rid); pl.famId = rid; pl.price = 2500; P.push(pl); ctPlansSave(P);
  window._ddPaint();
  const X2 = window._ddExecX; const out = [];
  Object.keys(X2.cells).filter(k => k.endsWith('|' + rid) && X2.cells[k].st !== 'idle' && X2.cells[k].st !== 'wx').forEach(k => { const c = X2.cells[k], d = k.split('|')[0];
    /* §ddBE2 · ลำชุดเดียวกับปฏิทิน · นับเฉพาะลำที่ต้องออกตามคนจอง (เรียงจากคุ้มง่ายสุด) */
    const bx = []; _calTripsFor(d, '').forEach(tp => { if (!tp || !tp.r || tp.r.id !== rid || tp.isCharter) return; bx.push(_ddBE(d, tp.b.id, rid)); });
    let be = 0, unk = bx.some(x => x.be == null && x.why !== 'never');
    if (!unk) { const sorted = bx.slice().sort((p, q) => (p.be == null ? 1e9 : p.be) - (q.be == null ? 1e9 : q.be)); let useN = 0, seat = 0; for (const x of sorted) { useN++; seat += x.cap || 0; if (seat >= c.bk) break; }
      const use = sorted.slice(0, Math.max(1, useN)); use.forEach(x => { if (x.be != null) be += x.be; }); }
    const neverX = !unk && bx.length > 0 && (() => { const sorted = bx.slice().sort((p, q) => (p.be == null ? 1e9 : p.be) - (q.be == null ? 1e9 : q.be)); let useN = 0, seat = 0; for (const x of sorted) { useN++; seat += x.cap || 0; if (seat >= c.bk) break; } return sorted.slice(0, Math.max(1, useN)).some(x => x.be == null); })();
    const need = (unk || neverX) ? null : Math.max(0, be - c.bk), st = unk ? 'unk' : (neverX ? 'never' : (need <= 0 ? 'ok' : (need <= 5 ? 'warn' : 'bad')));
    const el = document.querySelector('[data-cell="' + k + '"]');
    out.push({ k, be: c.be, need: c.need, st: c.st, expNeed: need, expSt: st, domSt: el && el.classList.contains(c.st), domTxt: el && el.textContent.replace(/\s+/g, ' ') }); });
  // คืนแผน
  ctPlansSave(ctPlans().filter(p => p.id !== pl.id));
  return { rid, before, out, totNeed: X2.tot.need, sumNeed: Object.keys(X2.cells).reduce((s, k) => s + (X2.cells[k].need || 0), 0) };
});
const s4ok = s4.out.length > 0 && s4.out.every(o => o.st !== 'unk' && o.need === o.expNeed && o.st === o.expSt && o.domSt && (o.need > 0 ? o.domTxt.includes('short ' + o.need) : true)) && s4.totNeed === s4.sumNeed && s4.before.includes('unk');
if (s4ok) ok(`4 ตั้งแผนต้นทุน ${s4.rid} → ${s4.out.length} ช่องรู้จุดคุ้มทุน (เดิม unk ${s4.before.filter(x => x === 'unk').length}) · ขาด = Σคุ้มทุน−จอง ตรงทุกช่อง · รวมต้องหาเพิ่ม ${s4.totNeed}`);
else fail('4 ' + JSON.stringify(s4).slice(0, 900));

/* ══ 5 ══ */
const s5 = await page.evaluate(() => {
  window._ddPaint(); const X = window._ddExecX, rows = _ddRows().filter(r => !r.cxl && !r.intFree);
  const exp = {}; rows.forEach(r => r.trips.forEach(t => { if (t.rid && t.date) { const k = t.date + '|' + t.rid; exp[k] = (exp[k] || 0) + t.pax; } }));
  let checked = 0, wrong = [];
  Object.keys(X.cells).forEach(k => { const c = X.cells[k], e = exp[k] || 0; checked++; if (c.plus !== e) wrong.push(k + ' ' + c.plus + '≠' + e);
    const el = document.querySelector('[data-cell="' + k + '"] .tag'); if (e > 0 ? !(el && el.textContent === '+' + e) : !!el) wrong.push('dom ' + k); });
  return { checked, wrong, withPlus: Object.keys(X.cells).filter(k => X.cells[k].plus > 0).length };
});
if (s5.checked > 0 && !s5.wrong.length && s5.withPlus > 0) ok(`5 ป้าย +N · ตรวจ ${s5.checked} ช่อง · ${s5.withPlus} ช่องมีใบที่คีย์วันนี้ · ตรงกับที่นับเองทุกช่อง`);
else fail('5 ' + JSON.stringify(s5));

/* ══ 6 ══ */
const s6 = await page.evaluate(async () => {
  window._copied = ''; window._toast = '';
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window._copied = t; return Promise.resolve(); } }, configurable: true });
  window.flShowToast = m => { window._toast = m; };
  /* ตั้งแผนต้นทุนให้ทุกเส้นทางที่มีเรือ จะได้มีช่อง "ขาด" ให้ตรวจบรรทัดรายวัน · ถอดทิ้งตอนจบ */
  const P = ctPlans(), ids = []; window._ddExecX.routes.forEach(r => { const pl = ctBlankPlan('t ' + r.rid); pl.famId = r.rid; pl.price = 2500; P.push(pl); ids.push(pl.id); }); ctPlansSave(P); window._ddPaint();
  document.querySelector('[data-dd="exec"] .dv-ddbtn').click();
  await new Promise(r => setTimeout(r, 100));
  const X = window._ddExecX, t = window._copied;
  ctPlansSave(ctPlans().filter(p => !ids.includes(p.id)));
  const codeOf = rid => { const c = vbCode(rid); return (c && c.c && c.c !== '—') ? c.c : null; };
  /* §ddLine · เรียงตามวัน บรรทัดละวัน รหัสสั้น · วันที่มีช่องขาดต้องมีบรรทัดของวันนั้น พร้อมรหัสและตัวเลขขาด */
  const lines = t.split('\n'), shortDays = [...new Set(X.tot.short.map(c => c.d))];
  /* §ddLine2 · หัววันเป็นบรรทัดของตัวเอง แล้วตามด้วย "• CODE short N (bk/cap)" บรรทัดละข้อ จนถึงหัววันถัดไป */
  const dayOk = shortDays.every(d => { const i = lines.indexOf(_ddDLbl(d)); if (i < 0) return false;
    let j = i + 1, blk = []; while (j < lines.length && lines[j].startsWith('• ')) blk.push(lines[j++]);
    /* §ddEmoji · 🔴 ขาดเกิน 5 · 🟠 ขาดไม่เกิน 5 */
    return X.tot.short.filter(c => c.d === d).every(c => blk.includes('• ' + (c.need > 5 ? '🔴' : '🟠') + ' ' + (codeOf(c.rid) || _ddLineCode(c.rid)) + ' short ' + c.need + ' (' + c.bk + '/' + c.cap + ')')); });
  const sections = ['🧾 KEYED TODAY', '🧳 TRAVELLING', '🚤 NEXT 7 DAYS', '🎯 TO DO'].every(h => lines.includes(h));
  /* §ddTop5 · 5 เจ้า (หรือเท่าที่มี) เรียง 🥇🥈🥉 4. 5. ตรงกับ _ddAgg ของ B2B */
  const agExp = _ddAgg(_ddRows().filter(r => !r.cxl && !r.intFree && r.side === 'b2b'), r => r.agent).slice(0, 5);
  const agLines = lines.filter(l => /^  (🥇|🥈|🥉|4\.|5\.) /.test(l));
  const top5 = agLines.length === agExp.length && agExp.every((a, i) => agLines[i].includes(a.k));
  const oneTopic = lines.filter(l => l.startsWith('• ')).every(l => l.length <= 60);
  const noRouteLines = !X.tot.short.some(c => t.includes('- ' + _ddCellName(c)));
  const TH = /[\u0E01-\u0E3E\u0E40-\u0E5B]/;   /* ตัวไทยทั้งหมด ยกเว้น ฿ (U+0E3F) */
  const english = !TH.test(t) && !TH.test(document.querySelector('[data-dd="exec"]').textContent) && !TH.test(document.querySelector('[data-dd="grid"]').textContent) && !TH.test(document.querySelector('[data-dd="travel"]').textContent);
  const nShort = X.tot.short.length;
  return { nShort, english, len: t.length, head: t.split('\n')[0], hasIn: /^• \d+ bookings · \d+ pax · ฿/m.test(t), hasGo: /^• Within 7 days: \d/m.test(t), sections, oneTopic,
    hasNeed: X.tot.short.length ? /^• 🔴 Still to sell: \d+ pax/m.test(t) : /All departures at break-even|No boats assigned/.test(t), top5, nAg: agExp.length, dayOk, noRouteLines, legend: X.tot.short.length ? /^[A-Z]{2,3} = .+$/m.test(t) : true, toast: window._toast, nLines: t.split('\n').length };
});
if (s6.nShort > 0 && s6.len > 80 && /Booking summary/.test(s6.head) && s6.hasIn && s6.hasGo && s6.hasNeed && s6.dayOk && s6.sections && s6.top5 && s6.oneTopic && s6.noRouteLines && s6.legend && s6.english && /copied/i.test(s6.toast))
  ok(`6 คัดลอกส่ง LINE · ${s6.nLines} บรรทัด · หัว "${s6.head}" · 4 หมวดมีอีโมจิ · Top agents ${s6.nAg} เจ้า · TO DO หัววัน + ข้อย่อย 🔴/🟠 บรรทัดละข้อ · รหัสสั้น + คำอธิบาย · ไม่มีบรรทัดไล่รายเส้นทางแบบเก่า · toast "${s6.toast}"`);
else fail('6 ' + JSON.stringify(s6));

/* ══ 7 ══ */
const s7 = await page.evaluate(() => { dashDayDetailPreset('d7'); return { exec: !!document.querySelector('[data-dd="exec"]'), grid: !!document.querySelector('[data-dd="grid"]'), sums: !!document.querySelector('.dv-ddsums'), days: _ddRg().days }; });
if (!s7.exec && !s7.grid && s7.sums && s7.days === 7) ok('7 มุมมอง 7 วัน · ไม่มีก้อน exec/ตาราง · การ์ด B2C/B2B ยังอยู่');
else fail('7 ' + JSON.stringify(s7));

/* ══ 8 · §ddIdle · ลำบนกระดานที่ยังไม่มีใครจอง ต้องไม่กลายเป็น "ขาด" ══ */
const s8 = await page.evaluate((DATE) => {
  window._ddFrom = window._ddTo = DATE; window._ddShowAll = false; window._ddPaint();
  const X0 = window._ddExecX, d = X0.days[5];   // วันที่ยังไม่มีเรือในชุดข้อมูล
  const rid = X0.routes[0].rid, boat = (typeof BOATS !== 'undefined' ? BOATS : (window.boats || [])).find(b => getCurStatus(b, d).s === 'available' && b.cap > 0);
  if (!boat) return { err: 'no boat' };
  const had = !!(TRIPS[d] && TRIPS[d][boat.id]); TRIPS[d] = TRIPS[d] || {}; TRIPS[d][boat.id] = { route: rid };
  const P = ctPlans(); const pl = ctBlankPlan('t'); pl.famId = rid; pl.price = 2500; P.push(pl); ctPlansSave(P);
  window._ddPaint();
  const X = window._ddExecX, c = X.cells[d + '|' + rid];
  const el = document.querySelector('[data-cell="' + d + '|' + rid + '"]');
  const inShort = X.tot.short.some(x => x.d === d && x.rid === rid), inIdle = X.tot.idle.some(x => x.d === d && x.rid === rid);
  const todoDom = [...document.querySelectorAll('[data-dd="exec"] .act, [data-dd="exec"] .act2')].some(a => a.textContent.includes(_ddDLbl(d, true)) && a.textContent.includes(X.routes[0].name));
  const line = dashDayDetailLineText(), lineHas = line.split('\n').includes(_ddDLbl(d)), lineIdle = /⚪ No bookings yet: \d+ departures/.test(line);
  const T = X.colTot[d], totCap = X.tot.cap, sumT = X.days.reduce((s, dd) => s + ((X.colTot[dd] || {}).cap || 0), 0);
  // คืนค่า
  if (!had) delete TRIPS[d][boat.id]; if (!Object.keys(TRIPS[d]).length) delete TRIPS[d];
  ctPlansSave(ctPlans().filter(p => p.id !== pl.id)); window._ddPaint();
  return { d, st: c && c.st, bk: c && c.bk, cap: c && c.cap, inShort, inIdle, domIdle: !!(el && el.classList.contains('idle') && /no bookings yet/.test(el.textContent)), todoDom, lineHas, lineIdle, Tcap: T && T.cap, Tidle: T && T.idle, totCap, sumT };
}, DATE);
if (!s8.err && s8.st === 'idle' && s8.bk === 0 && s8.cap > 0 && !s8.inShort && s8.inIdle && s8.domIdle && !s8.todoDom && !s8.lineHas && s8.lineIdle && s8.Tcap === 0 && s8.Tidle === 1 && s8.totCap === s8.sumT)
  ok(`8 ลำบนกระดานที่ยังไม่มีคนจอง (${s8.d} · 0/${s8.cap}) → "no bookings yet" · ไม่เป็นขาด ไม่ขึ้น to-do ไม่อยู่ใน TO DO ของ LINE · ไม่เข้ายอดที่นั่ง`);
else fail('8 ' + JSON.stringify(s8));

/* ══ 9 · §ddTodo2 · การ์ด to-do อ่านง่าย: วัน·เส้นทาง / แถบ+ขีดคุ้มทุน / ตัวเลข / ป้ายคำสั่ง ══ */
const s9 = await page.evaluate((DATE) => {
  window._ddFrom = window._ddTo = DATE; const P = ctPlans(), ids = []; window._ddPaint();
  window._ddExecX.routes.forEach(r => { const pl = ctBlankPlan('t ' + r.rid); pl.famId = r.rid; pl.price = 2500; P.push(pl); ids.push(pl.id); }); ctPlansSave(P); window._ddPaint();
  const X = window._ddExecX, cards = [...document.querySelectorAll('[data-dd="exec"] .act2')];
  const exp = X.tot.short.slice(0, 4).concat(X.tot.near.slice(0, 2), X.tot.full.slice(0, 2)).slice(0, 5);
  const out = cards.map((el, i) => { const c = exp[i]; if (!c) return { miss: true };
    const h = el.querySelector('.h').textContent, pill = el.querySelector('.p b').textContent, s = el.querySelector('.s').textContent;
    const kind = el.getAttribute('data-todo'), em = el.querySelector('.m em');
    const okPill = kind === 'short' ? pill === 'Sell ' + c.need + ' more' : (kind === 'near' ? /seats? left/.test(pill) : pill === 'Full');
    const lab = el.querySelector('.m u s'), okLab = c.be == null ? !lab : (!!lab && lab.textContent === 'BE ' + c.be && el.querySelector('.m u').style.left === Math.min(100, Math.round(c.be / c.cap * 100)) + '%');
    return { okH: h.includes(_ddDLbl(c.d, true)) && h.includes(_ddCellName(c)), okPill, okS: s.includes(c.bk + ' booked of ' + c.cap) && s.includes(c.av + ' open') && (c.be == null || s.includes('break-even ' + c.be)),
      okBe: c.be == null ? !em : (!!em && em.style.left === Math.min(100, Math.round(c.be / c.cap * 100)) + '%'), okLab, kind, pill }; });
  ctPlansSave(ctPlans().filter(p => !ids.includes(p.id))); window._ddPaint();
  return { n: cards.length, nExp: exp.length, out };
}, DATE);
if (s9.n > 0 && s9.n === s9.nExp && s9.out.every(o => !o.miss && o.okH && o.okPill && o.okS && o.okBe && o.okLab))
  ok(`9 การ์ด to-do ${s9.n} ใบ · หัว "วัน · เส้นทาง" · ป้ายคำสั่ง (${s9.out.map(o => o.pill).join(' / ')}) · ตัวเลข booked/break-even/open · ขีดคุ้มทุนบนแถบพร้อมป้าย "BE N" ตรงตำแหน่ง`);
else fail('9 ' + JSON.stringify(s9).slice(0, 700));

/* ══ 10 · §ddBE2 · จุดคุ้มทุนคิดจากราคาขายจริงของวันนั้น ไม่ใช่ราคาในแผน · และ "ไม่คุ้มแม้เต็มลำ" แยกจาก "ไม่มีแผน" ══ */
const s10 = await page.evaluate((DATE) => {
  window._ddFrom = window._ddTo = DATE; window._ddPaint();
  const X0 = window._ddExecX, k = Object.keys(X0.cells).find(k => X0.cells[k].bk > 0 && X0.cells[k].st !== 'wx'); if (!k) return { err: 'no cell' };
  const [d, rid] = k.split('|');
  const P = ctPlans(); const pl = ctBlankPlan('t'); pl.famId = rid; pl.price = 999999; P.push(pl); ctPlansSave(P);   /* ราคาในแผนตั้งสูงเกินจริง · ถ้าระบบใช้ราคาแผน be จะเป็น 1 */
  window._ddPaint(); const X = window._ddExecX, c = X.cells[k];
  const mix = _ddMix(rid, d); const bid = _calTripsFor(d, '').find(t => t.r.id === rid && !t.isCharter).b.id; const x = _ddBE(d, bid, rid);
  /* คำนวณเองจากราคาเฉลี่ยใบจอง */
  const pl2 = ctPlans().find(p => p.id === pl.id), T = ctTpl(); let exp = null;
  const boat = getBoat(bid), FP = flFuelPriceEff(d, boat), cap = boatCapFor(bid, d);
  for (let n = 1; n <= cap; n++) { const q = Object.assign({}, pl2, { boats: 1, boatId: bid, _asOf: d, price: mix.price, priceCh: '', chPct: 0, comm: 0, fuel: FP && FP.price > 0 ? FP.price : pl2.fuel, paxTH: Math.round(n * mix.thR) }); if (ctProfitAt(q, n, T).p > 0) { exp = n; break; } }
  /* ไม่คุ้มแม้เต็มลำ · ทำให้ราคาขายจริงต่ำมาก */
  const realAmt = window.tsTripAmount; window.tsTripAmount = () => 1; window._ddPaint();
  const X2 = window._ddExecX, c2 = X2.cells[k], el = document.querySelector('[data-cell="' + k + '"]');
  const inShort = X2.tot.short.some(z => z.d === d && z.rid === rid), inNever = X2.tot.never.some(z => z.d === d && z.rid === rid);
  const bulNever = [...document.querySelectorAll('[data-dd="exec"] .bul li')].some(li => /Check pricing/.test(li.textContent) && /can't break even even when full/.test(li.textContent));
  const line = dashDayDetailLineText(), lineNever = /🟣 Below cost even when full: \d+ dep\./.test(line);
  const todoDom = [...document.querySelectorAll('[data-dd="exec"] .act2')].some(a => a.textContent.includes(_ddDLbl(d, true)) && a.textContent.includes(_ddCellName(c2)));
  window.tsTripAmount = realAmt; ctPlansSave(ctPlans().filter(p => p.id !== pl.id)); window._ddPaint();
  return { k, mixPrice: Math.round(mix.price), src: x.src, be: c.be, exp, st: c.st, never: { st: c2.st, be: c2.be, need: c2.need, inShort, inNever, dom: !!(el && el.classList.contains('never') && /won't break even/.test(el.textContent)), bulNever, lineNever, todoDom } };
}, DATE);
const N10 = s10.never || {};
if (!s10.err && s10.mixPrice > 0 && s10.src === 'bookings' && s10.be === s10.exp && s10.be > 1 && N10.st === 'never' && N10.be == null && N10.need == null && !N10.inShort && N10.inNever && N10.dom && N10.bulNever && N10.lineNever && !N10.todoDom)
  ok(`10 จุดคุ้มทุนจากราคาขายจริง (${s10.k} · avg ฿${s10.mixPrice} · be ${s10.be} ตรงที่คำนวณเอง · ไม่ใช่ราคาแผน 999,999) · ราคาต่ำจนไม่คุ้มแม้เต็มลำ → "won't break even" ไม่นับขาด ไม่ขึ้น to-do · มี bullet Check pricing + 🟣 ใน LINE`);
else fail('10 ' + JSON.stringify(s10));

/* ══ 11 · §ddBE2 · ใบราคา 0 ไม่ถ่วงราคาเฉลี่ย · สองลำบนกระดาน นับจุดคุ้มทุนเฉพาะลำที่ต้องออก ══ */
const s11 = await page.evaluate((DATE) => {
  window._ddFrom = window._ddTo = DATE; window._ddPaint();
  const X0 = window._ddExecX, k = Object.keys(X0.cells).find(k => X0.cells[k].bk > 0 && X0.cells[k].st !== 'wx'); if (!k) return { err: 'no cell' };
  const [d, rid] = k.split('|');
  const P = ctPlans(); const pl = ctBlankPlan('t'); pl.famId = rid; pl.price = 2500; P.push(pl); ctPlansSave(P);
  /* C · ใบหนึ่งใบยอดเงิน 0 · ราคาเฉลี่ยต้องไม่ลด */
  const realAmt = window.tsTripAmount; window._ddPaint(); const base = _ddMix(rid, d);
  const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
  const victims = SB_BOOKINGS.filter(b => !CXL.includes(b.status) && b.schemaVer === 2 && (b.trips || []).some(t => t.date === d && t.routeId === rid && t.bookingMode !== 'charter' && realAmt(b, t) > 0));
  const victim = victims[0]; if (!victim) return { err: 'no priced booking' };
  window.tsTripAmount = (b, t) => (b.id === victim.id ? 0 : realAmt(b, t)); window._ddPaint(); const mixC = _ddMix(rid, d);
  const vt = victim.trips.find(t => t.date === d), vpax = bkV2PaxAllTot(vt.pax || {}), vamt = realAmt(victim, vt);
  const expC = (base.rev - vamt) / (base.paxPriced - vpax);   /* เฉลี่ยจากใบที่เหลือ · ไม่ใช่ (rev−amt)/paxทั้งหมด */
  const dragged = (base.rev - vamt) / base.paxPriced;
  window.tsTripAmount = realAmt;
  /* D · ลำที่สองบนกระดาน · คนจองยังพอลำเดียว → be ต้องเท่า be ของลำที่คุ้มง่ายสุด ไม่ใช่ผลบวกสองลำ */
  const bid1 = _calTripsFor(d, '').find(t => t.r.id === rid && !t.isCharter).b.id;
  const other = BOATS.find(b => b.id !== bid1 && !(TRIPS[d] || {})[b.id] && getCurStatus(b, d).s === 'available' && b.cap > 0 && b.cap >= X0.cells[k].bk);
  if (!other) return { err: 'no spare boat' };
  const had = !!(TRIPS[d] && TRIPS[d][other.id]); TRIPS[d][other.id] = { route: rid }; window._ddPaint();
  const X = window._ddExecX, c = X.cells[k], b1 = _ddBE(d, bid1, rid), b2 = _ddBE(d, other.id, rid);
  const expD = (b1.be != null && b2.be != null) ? Math.min(b1.be, b2.be) : null, sumD = (b1.be || 0) + (b2.be || 0);
  if (!had) delete TRIPS[d][other.id];
  ctPlansSave(ctPlans().filter(p => p.id !== pl.id)); window._ddPaint();
  return { k, C: { base: Math.round(base.price), after: Math.round(mixC.price), exp: Math.round(expC), dragged: Math.round(dragged) }, D: { be: c.be, exp: expD, sum: sumD, b1: b1.be, b2: b2.be, boats: c.boats, bk: c.bk, cap: c.cap } };
}, DATE);
if (!s11.err && s11.C.after === s11.C.exp && s11.C.after !== s11.C.dragged && s11.D.exp != null && s11.D.be === s11.D.exp && s11.D.boats === 2 && (s11.D.b1 === s11.D.b2 || s11.D.be !== s11.D.sum))
  ok(`11 ใบราคา 0 ไม่ถ่วงเฉลี่ย (฿${s11.C.base} → ฿${s11.C.after} ไม่ใช่ ฿${s11.C.dragged}) · สองลำบนกระดาน be ${s11.D.be} = ลำที่คุ้มง่ายสุด (${s11.D.b1}/${s11.D.b2}) ไม่ใช่ผลบวก ${s11.D.sum}`);
else fail('11 ' + JSON.stringify(s11));

const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e));
if (e1.length) fail('errors: ' + e1.slice(0, 3).join(' | '));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
