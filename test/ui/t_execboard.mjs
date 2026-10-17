// §execBoard · Overview › Executive Board (รายได้ · Live พรุ่งนี้ · มุมมองวันนี้ / เดือน / ไตรมาส / ปี)
// ที่มา (2026-10-17) · owner "สร้างที่ Overview เป็น Board แบบ Executive สำหรับผู้บริหาร · เน้นฝั่งรายได้
//   และมี Live booking ของวันถัดไป · ขอดูที่เป็นวันนี้" → ทำตาม mockup v2 + วันนี้
// ข้อมูลทดสอบ: คัดลอกใบจองในหน่วยความจำมาไว้วันนี้ / พรุ่งนี้ / ย้อนหลัง พร้อมเวลาเข้าระบบ (ไม่บันทึกอะไร)
// กัน
//   1 เมนู Overview มี Executive Board · เปิดแล้ววาดได้ · ทั้ง 4 มุมมอง × 4 ท่า ไม่มี error
//   2 วันนี้: รายได้ของทริปวันนี้ = ผลรวม tsTripAmount ของใบที่ไม่ยกเลิกที่เดินทางวันนี้
//   3 วันนี้: ยอดขายที่เข้ามาวันนี้ = จำนวนใบที่เข้าระบบวันนี้ (ไม่นับ quote/ยกเลิก)
//   4 พรุ่งนี้: ผู้โดยสาร = ผลรวม pax ของใบพรุ่งนี้ · "จองเพิ่มวันนี้" = ใบที่เข้าวันนี้ · ใบล่าสุดเรียงใหม่สุดก่อน
//   5 กรองท่า: รายได้วันนี้ของ Tub Lamu = นับเฉพาะเส้นทางของท่านั้น
//   6 เดือนนี้: รายได้ (วันเดินทาง) = ผลรวมของวันที่ 1 ถึงวันนี้ · คาดการณ์ = ได้แล้ว + จองไว้ถึงสิ้นเดือน
//   7 ใช้ดูอย่างเดียว: วาดซ้ำทุกมุมมองแล้ว SB_BOOKINGS และ localStorage ไม่เปลี่ยน · วาดซ้ำ (Live) หน้าไม่เด้ง
//   8 §execSales แท็บ Sales Performance (owner ส่งไฟล์ WEEKLY REPORT แล้ว "เพิ่มอีกแท็บนึง"):
//     สัปดาห์นี้ (อาทิตย์–เสาร์) · Pax ทั้งทีม = ใบที่เข้าระบบสัปดาห์นี้ · แถวเซลส์รวมกันได้เท่าทีม · ‹ ย้อนสัปดาห์ได้ › ไปอนาคตไม่ได้
//     มุมมองเดือนมีคอลัมน์ Activation · ส่วนแนวโน้ม 7 ช่วง / Top 10 / เงียบไป / แยกตามเซลส์ ขึ้นครบ
//   9 §execSalesNet (owner "โอเคทำ" · ให้ตรงกับวิธีคิดในไฟล์): ใบที่จองก่อนสัปดาห์นี้แล้วยกเลิกในสัปดาห์นี้ ถูกหักออก
//     Pax ทีมลดลงเท่ากับ pax ของใบนั้น · คอลัมน์ "หักยกเลิก" ขึ้นตัวเลข · เอเยนต์นั้นขึ้นเลขติดลบ · จำนวนใบไม่ลด
//  10 §execGap แท็บ Gap to Target (owner "ยังแก้ pain point ยอดไม่เต็มไม่ได้ · ต้องมีแผน Monthly Weekly Daily เพื่อให้ถึงเป้าที่วางเรือไว้"):
//     เป้าเดือน = Σ ที่นั่งที่วางเรือ × 90% (ตรงกับ getAllotment) · ตารางขึ้นเฉพาะเส้นทางที่วางเรือ · ช่องว่างแถวรวมเป้าทุกเซลส์ = ช่องว่างเดือน
//     ช่อง 14 วัน = ที่ว่างจาก getAllotment · เที่ยวที่ไม่มีใบจองเลยใน 3 วันข้างหน้า ต้องอยู่ในกล่องตัดสินใจ · ไม่เขียนอะไรลง store
//  11 §execPerf (owner "เวลาคลิกแถบด้านบน ช้ามาก"): กดแถบแล้วขึ้น "กำลังคำนวณ…" ทันที วาดเสร็จแล้วหาย
//     ใบจอง 6,000 ใบ: สลับแท็บ/ช่วงแต่ละครั้ง (หลังรอบแรก) ไม่เกิน 600ms บนเครื่องทดสอบ · ตัวเลขเท่ากับคิดสด (ดัชนีไม่ทำให้ผลเพี้ยน)
//     เทสนี้ใช้ ebSetNow (วาดทันที) · ปุ่มจริงใช้ ebSet ที่วาดในเฟรมถัดไป
//  13 §execNoAR (owner "ตัดเรื่องยอดเงินค้างออกก่อน"): ไม่มีคำว่า ลูกหนี้ / ค้างชำระ / การเก็บเงิน / เกินวงเงิน ในทุกมุมมอง
//  12 §execAlloc (owner "ผู้บริหารแก้ไขได้ · กำหนดเป้าแล้วดู progress ยังไง"):
//     การ์ดเซลส์แสดงช่องว่างแยกเส้นทาง · ตารางความคืบหน้ามีแถวเซลส์และแถวย่อยเส้นทาง
//     เปิดตัวแก้ → ใส่ 100% ของเส้นทางหนึ่งให้เซลส์คนเดียว → บันทึก → เป้าของเขาในเส้นทางนั้น = เป้าเส้นทางทั้งหมด · หัวข้อบอกว่ากำหนดโดยใคร
//     ค่าถูกเก็บเป็น JSON string ใน blob (exec_alloc → app_meta) · กลับไปใช้ค่าคำนวณได้ · ไม่มีสิทธิ์ sales บันทึกไม่ได้
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 900 });
await page.waitForTimeout(700);
await page.evaluate(() => {
  const ymd = d => bkV2LocalYMD(d), T = new Date(), t0 = ymd(T);
  const add = n => { const d = new Date(T); d.setDate(d.getDate() + n); return ymd(d); };
  const src = SB_BOOKINGS.filter(b => b.status === 'confirmed' && (b.trips || []).length === 1).slice(0, 40);
  let n = 0;
  const mk = (travel, madeOff, hour, st) => { const b = JSON.parse(JSON.stringify(src[n % src.length])); n++; b.id = 'ZZEB' + n;
    b.trips[0].date = travel; const md = new Date(T); md.setDate(md.getDate() + madeOff); md.setHours(hour, (n * 7) % 60, 0, 0);
    b.history = [{ at: md.toISOString(), kind: 'create', tag: 'Created', text: 'x' }]; b.bookingDate = ymd(md); b.createdAt = ymd(md); b.ops = {};
    if (st) b.status = st; SB_BOOKINGS.push(b); return b; };
  for (let i = 0; i < 20; i++) mk(t0, -3 - (i % 9), 9 + (i % 8));
  for (let i = 0; i < 14; i++) mk(add(1), -2 - (i % 6), 10 + (i % 7));
  for (let i = 0; i < 7; i++) mk(add(1), 0, Math.min(23, 8 + i));
  for (let i = 0; i < 4; i++) mk(add(5 + i), 0, 9 + i);
  mk(add(2), 0, 10, 'quote'); const c = mk(add(1), -5, 10, 'cancelled'); c.cancelledAt = new Date().toISOString();
  for (let d = -20; d < 0; d++) mk(add(d), d - 5, 11);
  for (let d = 2; d <= 10; d++) mk(add(d), -4, 12);
  try { if (typeof ckBksOnReset === 'function') ckBksOnReset(); } catch (_) {}
});
await goView(page, 'execboard', 700);

// 1
const R1 = await page.evaluate(async () => {
  const nav = !!document.querySelector('.nav-item[data-view="execboard"]'), out = [];
  for (const per of ['today', 'month', 'quarter', 'year']) for (const pier of ['', 'tublamu', 'panwa', 'ranong']) {
    ebSetNow('pier', pier); ebSetNow('per', per);
    const w = document.getElementById('eb-wrap');
    out.push({ per, pier, k: w.querySelectorAll('.eb-k').length, err: /Render error/.test(w.textContent) });
  }
  ebSetNow('pier', ''); ebSetNow('per', 'today');
  return { nav, active: document.getElementById('view-execboard').classList.contains('active'), out };
});
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (R1.nav && R1.active && R1.out.every(x => x.k === 6 && !x.err) && !e1.length) ok('1 เมนู Executive Board · 4 มุมมอง × 4 ท่า วาดครบ 6 ตัวเลขหลัก · ไม่มี error');
else fail('1 ' + JSON.stringify({ R1, e1: e1.slice(0, 3) }));

// 2-5
const R2 = await page.evaluate(() => {
  const t0 = bkV2LocalYMD(new Date()), d1 = new Date(); d1.setDate(d1.getDate() + 1); const tm = bkV2LocalYMD(d1);
  const CX = ['cancelled', 'rejected', 'cancelled_weather'], NS = ['quote', 'draft'];
  const live = b => NS.indexOf(b.status) < 0 && CX.indexOf(b.status) < 0 && !laIsInternalFree(b);
  const sumOn = (ds, pier) => { let r = 0, p = 0; SB_BOOKINGS.forEach(b => { if (!live(b)) return; (b.trips || []).forEach(t => {
    if (t.date !== ds) return; const rt = getRoute(t.routeId); if (pier && (!rt || rt.pier !== pier)) return; r += tsTripAmount(b, t); p += bkV2PaxAllTot(t.pax); }); }); return { r, p }; };
  const madeToday = SB_BOOKINGS.filter(b => live(b) && _dashBkDay(b) === t0).length;
  const addTm = SB_BOOKINGS.filter(b => live(b) && _dashBkDay(b) === t0 && (b.trips || []).some(t => t.date === tm)).reduce((s, b) => s + b.trips.filter(t => t.date === tm).reduce((x, t) => x + bkV2PaxAllTot(t.pax), 0), 0);
  const kv = () => [...document.querySelectorAll('#eb-wrap .eb-k')].map(k => ({ l: k.querySelector('.l').textContent, v: k.querySelector('.v').textContent, d: k.querySelector('.d').textContent }));
  ebSetNow('per', 'today'); const K = kv();
  const tmw = document.getElementById('eb-tmw'); const tiles = [...tmw.querySelectorAll('.eb-tm > div')].map(d => d.querySelector('.v').textContent);
  ebSetNow('per', 'month'); const feedT = [...document.querySelectorAll('#eb-tmw .eb-feed li .t')].map(x => x.textContent);
  ebSetNow('pier', 'tublamu'); ebSetNow('per', 'today'); const Kt = kv(); ebSetNow('pier', '');
  return { exp: sumOn(t0), expTL: sumOn(t0, 'tublamu'), expTm: sumOn(tm), madeToday, addTm, K, tiles, feedT, Kt };
});
const parseB = s => { const m = String(s).replace(/,/g, '').match(/(-|−)?฿([\d.]+)([KM]?)/); if (!m) return NaN; let v = +m[2]; if (m[3] === 'K') v *= 1e3; if (m[3] === 'M') v *= 1e6; return m[1] ? -v : v; };
const near = (a, b) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.006) || (b >= 1e4 && Math.abs(a - b) <= 500);
const revK = R2.K.find(k => /รายได้ของทริปวันนี้/.test(k.l));
if (revK && R2.exp.r > 0 && near(parseB(revK.v), R2.exp.r)) ok('2 รายได้ของทริปวันนี้ ' + revK.v + ' = ผลรวมจากใบจอง ฿' + Math.round(R2.exp.r).toLocaleString());
else fail('2 ' + JSON.stringify({ revK, exp: R2.exp }));
const salesK = R2.K.find(k => /ยอดขายที่เข้ามาวันนี้/.test(k.l));
if (salesK && new RegExp('^' + R2.madeToday + ' ใบ').test(salesK.d)) ok('3 ยอดขายที่เข้ามาวันนี้ ' + salesK.v + ' · ' + R2.madeToday + ' ใบ (ไม่นับ quote / ใบยกเลิก)');
else fail('3 ' + JSON.stringify({ salesK, made: R2.madeToday }));
const sorted = R2.feedT.every((t, i, a) => i === 0 || !/^\d\d:\d\d$/.test(t) || !/^\d\d:\d\d$/.test(a[i - 1]) || a[i - 1] >= t);
if (+R2.tiles[0].replace(/\D.*$/, '').replace(/,/g, '') === R2.expTm.p && R2.tiles[2].indexOf('+' + R2.addTm) === 0 && R2.feedT.length >= 5 && sorted)
  ok('4 พรุ่งนี้ ' + R2.expTm.p + ' pax · จองเพิ่มวันนี้ +' + R2.addTm + ' · ใบล่าสุด ' + R2.feedT.length + ' ใบ เรียงใหม่สุดก่อน (' + R2.feedT.slice(0, 3).join(', ') + ')');
else fail('4 ' + JSON.stringify({ tiles: R2.tiles, exp: R2.expTm, add: R2.addTm, feed: R2.feedT }));
const revT = R2.Kt.find(k => /รายได้ของทริปวันนี้/.test(k.l));
if (revT && near(parseB(revT.v) || 0, R2.expTL.r) && R2.expTL.r !== R2.exp.r) ok('5 กรองท่า Tub Lamu · รายได้วันนี้ ' + revT.v + ' (ทุกท่า ' + revK.v + ')');
else fail('5 ' + JSON.stringify({ revT, exp: R2.expTL, all: R2.exp }));

// 6
const R6 = await page.evaluate(() => {
  const t0 = bkV2LocalYMD(new Date()), m0 = t0.slice(0, 8) + '01', [y, m] = [+t0.slice(0, 4), +t0.slice(5, 7)], mE = bkV2LocalYMD(new Date(y, m, 0));
  const CX = ['cancelled', 'rejected', 'cancelled_weather'], NS = ['quote', 'draft'];
  let done = 0, fut = 0;
  SB_BOOKINGS.forEach(b => { if (NS.includes(b.status) || CX.includes(b.status) || laIsInternalFree(b)) return;
    (b.trips || []).forEach(t => { if (t.date >= m0 && t.date <= t0) done += tsTripAmount(b, t); else if (t.date > t0 && t.date <= mE) fut += tsTripAmount(b, t); }); });
  ebSetNow('per', 'month');
  const K = [...document.querySelectorAll('#eb-wrap .eb-k')].map(k => ({ l: k.querySelector('.l').textContent, v: k.querySelector('.v').textContent }));
  return { done, fut, K };
});
const kr = R6.K.find(k => /^รายได้เดือนนี้/.test(k.l)), kf = R6.K.find(k => /คาดการณ์/.test(k.l));
if (kr && kf && near(parseB(kr.v), R6.done) && near(parseB(kf.v), R6.done + R6.fut)) ok('6 เดือนนี้ · รายได้ ' + kr.v + ' · คาดการณ์สิ้นเดือน ' + kf.v + ' (= ได้แล้ว + จองไว้)');
else fail('6 ' + JSON.stringify(R6));

// 7
const R7 = await page.evaluate(async () => {
  const before = JSON.stringify(SB_BOOKINGS), ls = (() => { try { return localStorage.getItem(LS_KEY); } catch (_) { return null; } })();
  for (const per of ['today', 'month', 'quarter', 'year']) ebSetNow('per', per);
  ebSetNow('per', 'today');
  const m = document.querySelector('.main'); const sc = m && m.scrollHeight > m.clientHeight ? m : document.scrollingElement;
  sc.scrollTop = 500; const y0 = sc.scrollTop; ebSetNow('per', 'today'); const y1 = sc.scrollTop;
  const after = JSON.stringify(SB_BOOKINGS), ls2 = (() => { try { return localStorage.getItem(LS_KEY); } catch (_) { return null; } })();
  return { same: before === after, lsSame: ls === ls2, y0, y1 };
});
if (R7.same && R7.lsSame && R7.y0 > 0 && Math.abs(R7.y1 - R7.y0) <= 2) ok('7 ใช้ดูอย่างเดียว · ข้อมูลและ localStorage ไม่เปลี่ยน · วาดซ้ำแล้วหน้าอยู่ที่ ' + R7.y1 + 'px เท่าเดิม');
else fail('7 ' + JSON.stringify(R7));

// 8
const R8 = await page.evaluate(() => {
  const t0 = bkV2LocalYMD(new Date()), d = new Date(t0 + 'T12:00:00'); d.setDate(d.getDate() - d.getDay()); const ws = bkV2LocalYMD(d);
  const CX = ['cancelled', 'rejected', 'cancelled_weather'], NS = ['quote', 'draft'];
  let pax = 0, n = 0;
  SB_BOOKINGS.forEach(b => { if (NS.includes(b.status) || CX.includes(b.status) || laIsInternalFree(b)) return; const dd = _dashBkDay(b); if (!dd || dd < ws || dd > t0) return;
    n++; (b.trips || []).forEach(t => { pax += bkV2PaxAllTot(t.pax); }); });
  ebSetNow('tab', 'sales'); ebSetNow('sp', 'week');
  const w = document.getElementById('eb-wrap'), tbl = w.querySelector('table.eb-sp');
  const rows = [...tbl.querySelectorAll('tbody tr:not(.eb-tot)')].filter(r => r.children.length > 3).map(r => +r.children[2].textContent.replace(/,/g, ''));
  const tot = +tbl.querySelector('tr.eb-tot').children[2].textContent.replace(/,/g, '');
  const kp = +w.querySelector('.eb-k .v').textContent.replace(/,/g, '');
  const lbl0 = w.querySelector('.eb-nav b').textContent;
  ebSetNow('off', -1); const lbl1 = w.querySelector('.eb-nav b').textContent; const nextOn = !w.querySelector('.eb-nav button:last-child').disabled;
  ebSetNow('off', 1); const back = (window._eb.off === 0);
  ebSetNow('sp', 'month'); const mh = [...w.querySelectorAll('table.eb-sp thead th')].map(x => x.textContent);
  const secs = [...w.querySelectorAll('.eb-sec')].map(x => x.textContent);
  const mv = w.querySelectorAll('.eb-mv .eb-card').length;
  ebSetNow('tab', 'rev');
  return { pax, n, rows, tot, kp, lbl0, lbl1, nextOn, back, mh, secs, mv };
});
const sumRows = R8.rows.reduce((s, x) => s + x, 0);
if (R8.kp === R8.pax && R8.tot === R8.pax && sumRows === R8.pax && R8.lbl0 !== R8.lbl1 && R8.nextOn && R8.back
    && R8.mh.includes('Activation') && R8.secs.some(x => /แนวโน้ม 7/.test(x)) && R8.secs.some(x => /แยกตามเซลส์/.test(x)) && R8.mv >= 1)
  ok('8 Sales Performance · สัปดาห์นี้ ' + R8.pax + ' pax จาก ' + R8.n + ' ใบ = รวมทีม = ผลรวมแถวเซลส์ · ย้อนไป "' + R8.lbl1 + '" ได้ · เดือนมี Activation · แนวโน้ม/เอเยนต์ขึ้นครบ');
else fail('8 ' + JSON.stringify(R8));

// 9
const R9 = await page.evaluate(() => {
  const readTot = () => { ebSetNow('tab', 'sales'); ebSetNow('sp', 'week'); const t = document.querySelector('table.eb-sp tr.eb-tot').children;
    return { pax: +t[2].textContent.replace(/,/g, ''), n: +t[5].textContent.replace(/,/g, ''), cx: t[6].textContent }; };
  const before = readTot();
  const ag = SB_AGENTS.find(a => a.sales);
  const src = SB_BOOKINGS.find(b => b.status === 'confirmed' && (b.trips || []).length === 1);
  const b = JSON.parse(JSON.stringify(src)); b.id = 'ZZCX1'; b.agentId = ag.id; delete b.soldBy; delete b.channelType; delete b.b2cChannel;
  const old = new Date(); old.setDate(old.getDate() - 20);
  b.history = [{ at: old.toISOString(), kind: 'create', tag: 'Created', text: 'x' }]; b.bookingDate = bkV2LocalYMD(old); b.createdAt = b.bookingDate;
  b.trips[0].pax = { ad_fr: 5 }; b.status = 'cancelled'; b.cancelledAt = new Date().toISOString();
  SB_BOOKINGS.push(b);
  const after = readTot();
  const neg = [...document.querySelectorAll('.eb-mv .eb-mvl .rw')].some(r => r.querySelector('.lb').textContent.indexOf(ag.name) === 0 && /^-\d/.test(r.querySelector('.vv').textContent));
  SB_BOOKINGS.pop(); ebSetNow('tab', 'rev');
  return { before, after, neg, ag: ag.name };
});
if (R9.after.pax === R9.before.pax - 5 && R9.after.n === R9.before.n && /5/.test(R9.after.cx) && R9.neg)
  ok('9 ใบเก่ายกเลิกสัปดาห์นี้ 5 pax · ทีม ' + R9.before.pax + ' → ' + R9.after.pax + ' · หักยกเลิก "' + R9.after.cx + '" · จำนวนใบ ' + R9.after.n + ' เท่าเดิม · ' + R9.ag + ' ขึ้นเลขติดลบ');
else fail('9 ' + JSON.stringify(R9));

// 10
const R10 = await page.evaluate(() => {
  const ymd = d => bkV2LocalYMD(d), T = new Date(), t0 = ymd(T);
  const add = n => { const d = new Date(T); d.setDate(d.getDate() + n); return ymd(d); };
  const bs = (BOATS || []).filter(x => x && x.id && (x.pier === 'tublamu' || x.pier === 'panwa'));
  const plan = [['r10', bs[0].id], ['r12', bs[1].id]];
  for (let d = 0; d <= 20; d++) { const ds = add(d); TRIPS[ds] = TRIPS[ds] || {}; plan.forEach(([rid, bid]) => { TRIPS[ds][bid] = { route: rid, type: 'normal', booked: 0 }; }); }
  const before = JSON.stringify(SB_BOOKINGS);
  ebSetNow('tab', 'gap'); ebSetNow('gp', 'h');
  const w = document.getElementById('eb-wrap');
  /* expected month target */
  const mEnd = ymd(new Date(T.getFullYear(), T.getMonth() + 1, 0)); let tgt = 0, bk = 0;
  for (let ds = t0.slice(0, 8) + '01'; ds <= mEnd; ds = (() => { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + 1); return ymd(d); })()) {
    const seen = {}; Object.keys(TRIPS[ds] || {}).forEach(b => { const r = TRIPS[ds][b].route; if (seen[r]) return; seen[r] = 1; const al = getAllotment(r, ds); if (al && al.hasAllotment) { tgt += al.availableCapacity * 0.9; bk += Math.min(al.seatsConsumed, al.availableCapacity); } }); }
  tgt = Math.round(tgt);
  const kv = [...w.querySelectorAll('.eb-k')].map(k => ({ l: k.querySelector('.l').textContent, v: +k.querySelector('.v').textContent.replace(/[^\d]/g, '') }));
  const rows = [...w.querySelectorAll('.eb-gap tbody tr')].map(r => r.querySelector('.rn') ? r.querySelector('.rn').textContent.split('\n')[0].replace(/\d+ รอบ.*$/, '').trim() : r.textContent);
  const firstCell = w.querySelector('.eb-gap td.c:not(.off)'); const free = firstCell ? +firstCell.firstChild.textContent.replace(/,/g, '') : null;
  const al0 = getAllotment('r10', t0), al1 = getAllotment('r12', t0); const expFree = Math.max(0, al0.seatsAvailable);
  const salesGap = [...w.querySelectorAll('.eb-sl .eb-q')].reduce((s, q) => s + (+q.children[1].querySelector('.v').textContent.replace(/,/g, '') || 0), 0);
  const decTxt = w.querySelector('.eb-dec') ? w.querySelector('.eb-dec').textContent : '';
  const after = JSON.stringify(SB_BOOKINGS);
  ebSetNow('tab', 'rev');
  return { tgt, bk, kv, rows, free, expFree, salesGap, hasDec: /Whale Shark|Phi Phi/.test(decTxt), same: before === after };
});
const kT = R10.kv.find(k => /เป้าเดือนนี้/.test(k.l)), kG = R10.kv.find(k => /ช่องว่างที่ต้องหา/.test(k.l));
if (kT && kT.v === R10.tgt && kG && kG.v === Math.max(0, R10.tgt - R10.bk) && R10.rows.length === 2 && R10.rows.every(r => /Phi Phi|Whale Shark/.test(r))
    && R10.free === R10.expFree && Math.abs(R10.salesGap - kG.v) <= R10.rows.length * 3 + 2 && R10.hasDec && R10.same)
  ok('10 Gap to Target · เป้าเดือน ' + R10.tgt + ' = Σ ที่นั่งที่วางเรือ × 90% · ช่องว่าง ' + kG.v + ' = ผลรวมช่องว่างเซลส์ ' + R10.salesGap + ' · ตารางมี 2 เส้นทางที่วางเรือ · ที่ว่างวันนี้ ' + R10.free + ' ตรง getAllotment · กล่องตัดสินใจมีเที่ยวว่าง · ไม่แตะข้อมูล');
else fail('10 ' + JSON.stringify(R10));

// 11
const R11 = await page.evaluate(async () => {
  const ymd = d => bkV2LocalYMD(d), T = new Date();
  const add = n => { const d = new Date(T); d.setDate(d.getDate() + n); return ymd(d); };
  const src = SB_BOOKINGS.filter(b => b.status === 'confirmed' && (b.trips || []).length === 1).slice(0, 40);
  const ags = SB_AGENTS.filter(a => a.sales).slice(0, 60); const rts = ['r10', 'r12'];
  for (let n = 0; n < 6000; n++) { const b = JSON.parse(JSON.stringify(src[n % src.length])); b.id = 'ZZPF' + n; b.agentId = ags[n % ags.length].id; delete b.soldBy; b.ops = {};
    const travel = add(-200 + (n % 215)); const md = new Date(travel + 'T12:00:00'); md.setDate(md.getDate() - (n % 20)); md.setHours(9 + n % 9, 1, 0, 0);
    b.history = [{ at: md.toISOString(), kind: 'create', tag: 'Created', text: 'x' }]; b.bookingDate = ymd(md); b.createdAt = ymd(md);
    b.trips[0].date = travel; b.trips[0].routeId = rts[n % 2]; b.trips[0].pax = { ad_fr: 1 + n % 3 }; SB_BOOKINGS.push(b); }
  try { if (typeof ckBksOnReset === 'function') ckBksOnReset(); } catch (_) {}
  ebSetNow('tab', 'rev'); ebSetNow('per', 'today');
  const tm = (f) => { const a = performance.now(); f(); return Math.round(performance.now() - a); };
  const first = tm(() => ebSetNow('tab', 'gap'));
  const times = { month: tm(() => ebSetNow('gp', 'month')), h: tm(() => ebSetNow('gp', 'h')), sales: tm(() => ebSetNow('tab', 'sales')), rev: tm(() => ebSetNow('tab', 'rev')), year: tm(() => ebSetNow('per', 'year')), today: tm(() => ebSetNow('per', 'today')) };
  /* ค่าจากดัชนี = ค่าคิดสด */
  const t0 = ymd(T); const CX = ['cancelled', 'rejected', 'cancelled_weather'], NS = ['quote', 'draft'];
  let live = 0; SB_BOOKINGS.forEach(b => { if (NS.includes(b.status) || CX.includes(b.status) || laIsInternalFree(b)) return; (b.trips || []).forEach(tt => { if (tt.date === t0) live += tsTripAmount(b, tt); }); });
  const shown = document.querySelector('#eb-wrap .eb-k .v').textContent;
  ebSet('tab', 'gap'); const busy0 = !!document.getElementById('eb-busy'); await new Promise(r => setTimeout(r, 1500)); const busy1 = !!document.getElementById('eb-busy');
  ebSetNow('tab', 'rev'); ebSetNow('per', 'today');
  return { n: SB_BOOKINGS.length, first, times, live, shown, busy0, busy1 };
});
const slow = Object.keys(R11.times).filter(k => R11.times[k] > 600);
if (!slow.length && R11.busy0 && !R11.busy1 && near(parseB(R11.shown), R11.live))
  ok('11 ' + R11.n.toLocaleString() + ' ใบ · เปิด Gap รอบแรก ' + R11.first + 'ms · สลับแท็บ ' + JSON.stringify(R11.times).replace(/"/g, '') + ' · ขึ้น "กำลังคำนวณ…" แล้วหาย · รายได้วันนี้ ' + R11.shown + ' = คิดสด');
else fail('11 ' + JSON.stringify(R11) + ' slow=' + slow.join(','));

// 12
const R12 = await page.evaluate(() => {
  ebSetNow('tab', 'gap'); ebSetNow('gp', 'h');
  const w = document.getElementById('eb-wrap');
  const chips = w.querySelectorAll('.eb-sl .eb-rf span').length, subRows = w.querySelectorAll('table.eb-pg tr.eb-sub').length, mainRows = w.querySelectorAll('table.eb-pg tbody tr:not(.eb-sub)').length;
  const hdr0 = [...w.querySelectorAll('.eb-sec')].find(x => /แบ่งให้เซลส์/.test(x.textContent)).textContent;
  ebAllocEdit(true);
  const box = document.getElementById('eb-alloc'); if (!box) return { noBox: true };
  const inputs = [...box.querySelectorAll('input[data-f][data-s]')]; const f0 = inputs[0].dataset.f, s0 = inputs[0].dataset.s;
  inputs.forEach(i => { if (i.dataset.f === f0) i.value = (i.dataset.s === s0) ? 100 : 0; });
  const seatsCell = box.querySelector('tbody tr').children[1].textContent.replace(/,/g, '');
  const lfIn = box.querySelector('input[data-lf="' + f0 + '"]'); lfIn.value = 80;
  const salesName = sbGetSales(s0).name;
  ebAllocSave(''+ (bkV2LocalYMD(new Date()).slice(0, 7)));
  const stored = laBlob().exec_alloc; let parsed = null; try { parsed = JSON.parse(stored); } catch (_) {}
  const hdr1 = [...w.querySelectorAll('.eb-sec')].find(x => /แบ่งให้เซลส์/.test(x.textContent)).textContent;
  const card = [...w.querySelectorAll('.eb-sl .eb-card')].find(c => c.querySelector('h2').textContent.trim() === salesName);
  const chip = card ? [...card.querySelectorAll('.eb-rf span')].find(x => x.querySelector('small') && x.querySelector('small').textContent === '100%') : null;
  const famRow = [...w.querySelectorAll('table.eb-pg tr.eb-sub')].find(r => r.querySelector('td b').textContent === (chip ? chip.querySelector('b').textContent : '')) ;
  const famTgt = famRow ? +famRow.children[1].textContent.replace(/,/g, '') : null;
  /* no permission → save refused */
  const oG = window.laGuardEdit; window.laGuardEdit = () => false; let refused = false; try { refused = !(function(){ const all = laBlob(); return true; })() ; } catch (_) {}
  const before = laBlob().exec_alloc; ebAllocReset.toString(); window.confirm = () => true; ebAllocReset(bkV2LocalYMD(new Date()).slice(0, 7)); const afterDenied = laBlob().exec_alloc; window.laGuardEdit = oG;
  ebAllocReset(bkV2LocalYMD(new Date()).slice(0, 7)); const afterReset = laBlob().exec_alloc; const hdr2 = [...w.querySelectorAll('.eb-sec')].find(x => /แบ่งให้เซลส์/.test(x.textContent)).textContent;
  ebSetNow('tab', 'rev');
  return { chips, subRows, mainRows, hdr0: hdr0.slice(0, 60), hdr1: hdr1.slice(0, 80), parsedOk: !!(parsed && parsed[bkV2LocalYMD(new Date()).slice(0, 7)] && parsed[bkV2LocalYMD(new Date()).slice(0, 7)].by[f0][s0] === 100 && parsed[bkV2LocalYMD(new Date()).slice(0, 7)].lf[f0] === 80),
    typeStr: typeof stored === 'string', seats: +seatsCell, famTgt, expTgt: Math.round(+seatsCell * 0.8), chip: !!chip, denied: before === afterDenied && !!before, reset: !JSON.parse(afterReset || '{}')[bkV2LocalYMD(new Date()).slice(0, 7)], hdr2: /ตามสัดส่วนที่แต่ละคนขายได้/.test(hdr2) };
});
if (R12.chips >= 4 && R12.subRows >= 2 && R12.mainRows >= 2 && /ตามสัดส่วนที่แต่ละคนขายได้/.test(R12.hdr0) && /กำหนดโดย/.test(R12.hdr1) && R12.parsedOk && R12.typeStr && R12.chip
    && R12.famTgt != null && Math.abs(R12.famTgt - R12.expTgt) <= 2 && R12.denied && R12.reset && R12.hdr2)
  ok('12 การ์ดมีช่องว่างแยกเส้นทาง (' + R12.chips + ' ชิป) · ตารางความคืบหน้า ' + R12.mainRows + ' เซลส์ / ' + R12.subRows + ' แถวเส้นทาง · กำหนด 100% + LF 80% → เป้าเส้นทางของเซลส์ ' + R12.famTgt + ' = ' + R12.seats + '×80% · เก็บเป็น JSON string · ไม่มีสิทธิ์บันทึกไม่ได้ · กลับไปใช้ค่าคำนวณได้');
else fail('12 ' + JSON.stringify(R12));

// 13
const R13 = await page.evaluate(() => { const out = {}; const chk = (k) => { out[k] = /ลูกหนี้|ค้างชำระ|การเก็บเงิน|เกินวงเงิน|ค้างรับ/.test(document.getElementById('eb-wrap').textContent); };
  ebSetNow('tab', 'rev'); ebSetNow('per', 'today'); chk('today'); ebSetNow('per', 'month'); chk('month'); ebSetNow('tab', 'sales'); chk('sales'); ebSetNow('tab', 'gap'); chk('gap');
  const k6 = [...document.querySelectorAll('#eb-wrap .eb-k .l')].map(x => x.textContent); ebSetNow('tab', 'rev'); ebSetNow('per', 'month'); const kpis = [...document.querySelectorAll('#eb-wrap .eb-k .l')].map(x => x.textContent); ebSetNow('per', 'today'); return { out, kpis }; });
if (Object.values(R13.out).every(v => !v) && R13.kpis.some(k => /ยกเลิก/.test(k))) ok('13 ไม่มีเรื่องยอดเงินค้างในทุกมุมมอง · ตัวเลขหลักที่ 6 ของเดือนเป็น "' + R13.kpis.find(k => /ยกเลิก/.test(k)) + '"');
else fail('13 ' + JSON.stringify(R13));

await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
