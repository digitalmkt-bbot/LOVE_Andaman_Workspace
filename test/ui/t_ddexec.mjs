// §ddExec · Executive Summary ในป๊อปอัป "รายละเอียดใบจองทั้งวัน" (Dashboard → Bookings keyed in today)
//
// ที่มา (7 ต.ค. 2026) · เจ้าของ: "อยากได้ Executive Summary ของวันนั้น ๆ ใช้เป็น Report รายวัน ให้ทีมเซลล์ดูว่า
//   วันนี้มีบุคกิ้งอะไรเข้าบ้าง ไปวันไหนบ้าง และอีก 7 วันล่วงหน้ายังมีที่นั่งว่างเท่าไหร่ ต้องหาลูกค้าเพิ่มอีกเท่าไหร่"
//   เลือกแบบ bullet 4 ข้อ (ม็อกอัป v3)
//
// กันแปดอย่าง
//   1 มุมมองวันเดียว · มีก้อน exec + ก้อนไปวันไหน + ตาราง 7 วัน · bullet 4 ข้อ · ตัวเลข "คีย์วันนี้" ตรงกับ _ddSum (ไม่นับใบยกเลิก/ใบบริษัท)
//   2 "ไปใน 7 วัน" นับเองจากใบจริง (วันเดินทางแรก อยู่ใน to+1..to+7) ตรงกับที่โชว์ · รายการไปวันไหน รวมใบครบ · แถว "ถึงวันนี้" ขึ้นก่อน
//   3 ตาราง 7 วัน · ช่องเส้นทาง×วัน มีครบทุกคู่ที่ TRIPS มีเรือ · จอง/ความจุ/ว่าง ตรง getAllotment · แถวรวมบวกถูก
//   4 จุดคุ้มทุน · ตั้งแผนต้นทุนให้เส้นทาง (ราคา 2,500) → ช่องที่เคย "ไม่รู้จุดคุ้มทุน" กลายเป็นรู้ · ขาด = max(0, Σคุ้มทุนต่อลำ − จอง) · สีตามขาด (ok/warn/bad)
//   5 ป้าย +N ของช่อง = pax ของใบที่คีย์วันนี้ที่ไปเส้นทาง-วันนั้น (นับเอง)
//   6 ปุ่มคัดลอกส่ง LINE · อังกฤษล้วน (§ddEn · ก้อนในแอปก็ไม่มีตัวไทย) · ข้อความล้วน หัววัน · เข้ามาวันนี้ · ไป 7 วัน · ส่วน 7 วันข้างหน้าเรียงตามวัน บรรทัดละวัน รหัสสั้น (PP/MT…) + คำอธิบายรหัส · toast ขึ้น
//   7 มุมมองช่วงหลายวัน (7 วัน) · ไม่มีก้อน exec · ของเดิม (การ์ด B2C/B2B) ยังอยู่ · ไม่มี error
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
  const rowsDom = [...document.querySelectorAll('[data-dd="travel"] .tl .r:not(.hd)')];
  const soonDom = rowsDom.filter(r => r.classList.contains('soon')).length;
  return { n, pax, w7: X.w7, sumN, xn: X.n, firstK, hasPast, soonDom, soonX: X.travel.filter(t => t.soon).length, nDom: rowsDom.length, nX: X.travel.length, days0: days[0], exp0: _ddAddDays(DATE, 1) };
}, DATE);
if (s2.w7.n === s2.n && s2.w7.pax === s2.pax && s2.sumN === s2.xn && s2.days0 === s2.exp0 && (!s2.hasPast || s2.firstK.charAt(0) === '<') && s2.soonDom === s2.soonX && s2.nDom === s2.nX && s2.soonX <= 7)
  ok(`2 ไปใน 7 วัน ${s2.n} ใบ ${s2.pax} คน นับเองตรง · รายการไปวันไหน ${s2.nX} แถว รวม ${s2.sumN} ใบครบ · ${s2.soonX} แถวใน 7 วัน (เทา)`);
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
    let be = 0, unk = false; _calTripsFor(d, '').forEach(tp => { if (!tp || !tp.r || tp.r.id !== rid || tp.isCharter) return; const x = _ddBE(d, tp.b.id); if (x.be == null) unk = true; else be += x.be; });   /* ลำชุดเดียวกับปฏิทิน (§ddIdle) */
    const need = unk ? null : Math.max(0, be - c.bk), st = need == null ? 'unk' : (need <= 0 ? 'ok' : (need <= 5 ? 'warn' : 'bad'));
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
    return X.tot.short.filter(c => c.d === d).every(c => blk.includes('• ' + (codeOf(c.rid) || _ddLineCode(c.rid)) + ' short ' + c.need + ' (' + c.bk + '/' + c.cap + ')')); });
  const sections = ['▌KEYED TODAY', '▌TRAVELLING', '▌NEXT 7 DAYS', '▌TO DO'].every(h => lines.includes(h));
  const oneTopic = lines.filter(l => l.startsWith('• ')).every(l => l.length <= 60);
  const noRouteLines = !X.tot.short.some(c => t.includes('- ' + _ddCellName(c)));
  const TH = /[\u0E01-\u0E3E\u0E40-\u0E5B]/;   /* ตัวไทยทั้งหมด ยกเว้น ฿ (U+0E3F) */
  const english = !TH.test(t) && !TH.test(document.querySelector('[data-dd="exec"]').textContent) && !TH.test(document.querySelector('[data-dd="grid"]').textContent) && !TH.test(document.querySelector('[data-dd="travel"]').textContent);
  const nShort = X.tot.short.length;
  return { nShort, english, len: t.length, head: t.split('\n')[0], hasIn: /^• \d+ bookings · \d+ pax · ฿/m.test(t), hasGo: /^• Within 7 days: \d/m.test(t), sections, oneTopic,
    hasNeed: X.tot.short.length ? /^• Still to sell: \d+ pax/m.test(t) : /All departures at break-even|No boats assigned/.test(t), dayOk, noRouteLines, legend: X.tot.short.length ? /^[A-Z]{2,3} = .+$/m.test(t) : true, toast: window._toast, nLines: t.split('\n').length };
});
if (s6.nShort > 0 && s6.len > 80 && /Booking summary/.test(s6.head) && s6.hasIn && s6.hasGo && s6.hasNeed && s6.dayOk && s6.sections && s6.oneTopic && s6.noRouteLines && s6.legend && s6.english && /copied/i.test(s6.toast))
  ok(`6 คัดลอกส่ง LINE · ${s6.nLines} บรรทัด · หัว "${s6.head}" · 4 หมวด · TO DO หัววัน + ข้อย่อยบรรทัดละข้อ · รหัสสั้น + คำอธิบาย · ไม่มีบรรทัดไล่รายเส้นทางแบบเก่า · toast "${s6.toast}"`);
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
  const todoDom = [...document.querySelectorAll('[data-dd="exec"] .act')].some(a => a.textContent.includes(_ddDLbl(d, true)) && a.textContent.includes(X.routes[0].name));
  const line = dashDayDetailLineText(), lineHas = line.split('\n').includes(_ddDLbl(d)), lineIdle = /No bookings yet: \d+ departures/.test(line);
  const T = X.colTot[d], totCap = X.tot.cap, sumT = X.days.reduce((s, dd) => s + ((X.colTot[dd] || {}).cap || 0), 0);
  // คืนค่า
  if (!had) delete TRIPS[d][boat.id]; if (!Object.keys(TRIPS[d]).length) delete TRIPS[d];
  ctPlansSave(ctPlans().filter(p => p.id !== pl.id)); window._ddPaint();
  return { d, st: c && c.st, bk: c && c.bk, cap: c && c.cap, inShort, inIdle, domIdle: !!(el && el.classList.contains('idle') && /no bookings yet/.test(el.textContent)), todoDom, lineHas, lineIdle, Tcap: T && T.cap, Tidle: T && T.idle, totCap, sumT };
}, DATE);
if (!s8.err && s8.st === 'idle' && s8.bk === 0 && s8.cap > 0 && !s8.inShort && s8.inIdle && s8.domIdle && !s8.todoDom && !s8.lineHas && s8.lineIdle && s8.Tcap === 0 && s8.Tidle === 1 && s8.totCap === s8.sumT)
  ok(`8 ลำบนกระดานที่ยังไม่มีคนจอง (${s8.d} · 0/${s8.cap}) → "no bookings yet" · ไม่เป็นขาด ไม่ขึ้น to-do ไม่อยู่ใน TO DO ของ LINE · ไม่เข้ายอดที่นั่ง`);
else fail('8 ' + JSON.stringify(s8));

const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e));
if (e1.length) fail('errors: ' + e1.slice(0, 3).join(' | '));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
