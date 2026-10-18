// §execMove · Executive Board › แท็บแรก "มูฟเมนต์" (บอร์ดเรือสำหรับผู้บริหาร)
//
// ที่มา (2026-10-18) · owner "ผู้บริหารเป็นสาย Productive อยากเห็นมูฟเมนต์ของ Booking · บุคกิ้งของพรุ่งนี้เต็มแล้วหรือยัง
//   · มีบุคกิ้งอะไรเข้ามาแล้วบ้าง · ถ้าเรือออกครบ เต็มทุกลำ ผู้บริหารจะสบายใจ" → mockup → วาดใหม่ใน Claude Design → "ทำเลย"
//   ขอเพิ่ม: แยกภูเก็ต/เขาหลัก · หัวการ์ดพื้นขาว · แถวเส้นทางแบบจอมอนิเตอร์ (ลายวิ่ง = กำลังรับจอง) · ไม่มีอิโมจิ
//   · การ์ด Booking Movement เป็นอังกฤษ + ชื่อเซลส์
// ข้อมูลทดสอบ: วางเรือพรุ่งนี้ 5 โปรแกรม 2 ท่า แล้วสร้างใบจอง (บางใบเข้าระบบวันนี้ · 1 ใบยกเลิกวันนี้)
//
// กัน
//   1 เปิดหน้าแล้วแท็บแรกคือ มูฟเมนต์ · วันที่ในหัวการ์ด = พรุ่งนี้ · มี LIVE · ไม่มีอิโมจิในหน้า
//   2 % ขายได้ในวงแหวน = Σ seatsConsumed / Σ availableCapacity ของโปรแกรมพรุ่งนี้ (getAllotment) · N/M ลำเต็ม ตรงกับแถว
//   3 แถว = โปรแกรมที่มีเรือ/ใบจองพรุ่งนี้ · ที่นั่งในแถวตรง getAllotment · แถวที่ยังว่างมีลายวิ่ง (.ebm-live) · แถวเต็มไม่มี · เต็มแล้วอยู่ล่างกว่าแถวที่ยังว่าง
//   4 โซนรับใต้ชื่อโปรแกรม = Σ pax แยก Phuket / Khao Lak / Own transport ของใบในโปรแกรมนั้น
//   5 "ล่าสุด": โปรแกรมที่มีใบเข้าวันนี้ขึ้นชิป +pax · เวลา (ภายใน 60 นาที = ชิปเขียวกะพริบ) · โปรแกรมที่ไม่มีใบเลยขึ้น "ยังไม่มีใบจอง"
//   6 เข้ามาวันนี้ (สำหรับพรุ่งนี้) = Σ pax ของใบพรุ่งนี้ที่เข้าระบบวันนี้ · แยกโซนรวมเท่ากัน · ยกเลิกวันนี้ = pax ของใบที่ยกเลิกวันนี้
//   7 เลื่อนวัน ‹ › และปุ่ม "วันนี้" เปลี่ยนวันที่ในหัวการ์ด · กดช่องใน 7 วันข้างหน้าก็เปลี่ยน · กรองท่าแล้วแถวเหลือเฉพาะท่านั้น
//   8 Booking Movement · Today (อังกฤษ): จำนวนใบ/ที่นั่ง = ใบที่เข้าระบบวันนี้ทุกวันเดินทาง · Phuket+Khao Lak+Own = ที่นั่งรวม
//     · แท่งรายชั่วโมงรวม = ที่นั่งรวม · ทุกแถวในรายการมีชิป Sales · ชื่อ (B2C = Online) · ใบยกเลิกขึ้น cancelled −pax
//   9 7 วันข้างหน้า 7 ช่อง · % ของพรุ่งนี้ตรงกับวงแหวน · ลำที่ต้องช่วยมีโปรแกรมที่ยังว่าง · ปุ่มพาไป Gap to Target
//  10 ใช้ดูอย่างเดียว: วาดซ้ำแล้ว SB_BOOKINGS/localStorage ไม่เปลี่ยน · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1000 });
await page.waitForTimeout(500);
const S = await page.evaluate(() => {
  const ymd = d => bkV2LocalYMD(d), T = new Date(), t0 = ymd(T);
  const add = n => { const d = new Date(T); d.setDate(d.getDate() + n); return ymd(d); };
  const tm = add(1);
  TRIPS[tm] = TRIPS[tm] || {};
  const want = [['r5','b1'],['r4','b2'],['r2','b3'],['r10','b13'],['r12','b10']];
  want.forEach(([rid,bid]) => { const b=(BOATS||[]).find(x=>x.id===bid)||BOATS[0]; if(b) TRIPS[tm][b.id]={route:rid,type:'normal',booked:0}; });
  const src = SB_BOOKINGS.filter(b => b.status === 'confirmed' && (b.trips || []).length === 1 && !laIsB2C(b)).slice(0, 40);
  let n = 0;
  const mk = (travel, rid, madeOff, hour, paxN, zone) => { const b = JSON.parse(JSON.stringify(src[n % src.length])); n++; b.id = 'ZZMV' + n;
    b.trips[0].date = travel; b.trips[0].routeId = rid; b.trips[0].zone = zone; b.pickupZone = zone; b.trips[0].pax = { ad: paxN, chd:0, inf:0, foc:0 }; b.trips[0].lockUse = 0; delete b.trips[0].seatSource; delete b.trips[0].upg;
    const md = new Date(T); md.setDate(md.getDate() + madeOff); md.setHours(hour, (n * 7) % 60, 0, 0);
    b.history = [{ at: md.toISOString(), kind: 'create', tag: 'Created', text: 'x' }]; b.bookingDate = ymd(md); b.createdAt = ymd(md); b.ops = {}; b.status='confirmed'; delete b.cancelledAt; delete b.cancellation; SB_BOOKINGS.push(b); return b; };
  for (let i = 0; i < 12; i++) mk(tm, 'r5', -2, 10 + (i % 6), 3, i%3?'PK':'KL');
  for (let i = 0; i < 5; i++) mk(tm, 'r5', 0, 9 + i, 2, 'KL');
  for (let i = 0; i < 20; i++) mk(tm, 'r4', -3, 9 + (i % 8), 3, 'PK');
  for (let i = 0; i < 3; i++) mk(tm, 'r4', 0, 14 + i, 2, 'PK');
  for (let i = 0; i < 6; i++) mk(tm, 'r10', -1, 11, 2, 'PK');
  for (let i = 0; i < 9; i++) mk(tm, 'r12', 0, 8 + i, 3, i%2?'PK':'NoTransfer');
  for (let i = 0; i < 4; i++) mk(add(3), 'r5', 0, 16, 4, 'PK');
  const fresh = mk(tm, 'r12', 0, new Date().getHours(), 1, 'PK'); fresh.history[0].at = new Date(Date.now() - 5*60000).toISOString();
  const c = mk(tm, 'r4', -4, 10, 4, 'PK'); c.status='cancelled'; c.cancelledAt = new Date().toISOString();
  try { if (typeof ckBksOnReset === 'function') ckBksOnReset(); } catch (_) {}
  Object.assign(window._eb, { per:'today', pier:'', tab:'move', sp:'week', off:0, gp:'h', mvd:'' });
  return { t0, tm, cxlPax: 4, freshId: fresh.id };
});
await goView(page, 'execboard', 1200);

const read = () => page.evaluate((S) => {
  const w = document.getElementById('eb-wrap'), txt = w.textContent;
  const al = rid => getAllotment(rid, S.tm, null);
  const rows = [...w.querySelectorAll('.ebm-row')].map(r => ({ rid: r.dataset.rid, st: r.dataset.st, live: !!r.querySelector('.ebm-live'), scan: !!r.querySelector('.ebm-scan'),
    fill: (r.querySelector('.ebm-fill em') || {}).textContent || '', rt: r.querySelector('.rt').textContent.replace(/\s+/g, ' '), last: r.querySelector('.lst').textContent.replace(/\s+/g, ' '), fresh: !!r.querySelector('.ebm-new .ebm-dot') }));
  return { tabOn: (w.querySelector('.eb-seg button.on') || {}).textContent, big: (w.querySelector('.ebm-date .big') || {}).textContent, sub: (w.querySelector('.ebm-date .sub') || {}).textContent,
    live: !!w.querySelector('.ebm-head .eb-live'), ring: (w.querySelector('.ebm-ring b') || {}).textContent, mood: (w.querySelector('.ebm-mood .n') || {}).textContent.replace(/\s+/g, ' '),
    stats: [...w.querySelectorAll('.ebm-stats>div')].map(d => d.textContent.replace(/\s+/g, ' ')), rows,
    emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(txt.replace(/[\u2713\u25b2\u25bc\u2212\u2039\u203a\u2192\u2190]/g, '')),
    piers: [...w.querySelectorAll('.ebm-pier')].map(p => p.textContent.replace(/\s+/g, ' ')), err: /Render error/.test(txt) };
}, S);

/* ══ 1 ═══════════════════════════════════════════════════════════════ */
const R1 = await read();
const tmTh = await page.evaluate((S) => { const d = new Date(S.tm + 'T12:00:00'); return String(d.getDate()) + ' ' + laMonAbbrTH()[d.getMonth()] + ' ' + (d.getFullYear() + 543); }, S);
if (R1.err) fail('1 Render error');
else if (R1.tabOn !== 'มูฟเมนต์') fail('1 แท็บแรกไม่ใช่มูฟเมนต์ · ' + R1.tabOn);
else if (!R1.big.includes(tmTh)) fail('1 วันที่ในหัวการ์ดไม่ใช่พรุ่งนี้ · "' + R1.big + '" คาด ' + tmTh);
else if (!R1.live) fail('1 ไม่มีป้าย LIVE');
else if (R1.emoji) fail('1 ยังมีอิโมจิในหน้า');
else ok('1 แท็บมูฟเมนต์ · หัวการ์ด "' + R1.big + '" · LIVE · ไม่มีอิโมจิ');

/* ══ 2–3 · ตัวเลขตรง getAllotment ═════════════════════════════════════ */
const A = await page.evaluate((S) => {
  const ids = {}; Object.keys(TRIPS[S.tm] || {}).forEach(b => { const op = TRIPS[S.tm][b]; if (op && op.route) ids[op.route] = 1; });
  SB_BOOKINGS.forEach(b => { if (['cancelled','rejected','cancelled_weather','quote','draft'].includes(b.status)) return; (b.trips || []).forEach(t => { if (t.date === S.tm && t.routeId) ids[t.routeId] = 1; }); });
  let cap = 0, bk = 0; const per = {};
  Object.keys(ids).forEach(rid => { const a = getAllotment(rid, S.tm, null); if (!a.hasAllotment) return; cap += a.availableCapacity; bk += a.seatsConsumed; per[rid] = { cap: a.availableCapacity, bk: a.seatsConsumed, free: a.seatsAvailable }; });
  return { rids: Object.keys(ids), cap, bk, pct: Math.round(bk * 100 / cap), per };
}, S);
{
  const ringN = parseInt(R1.ring, 10);
  if (ringN !== A.pct) fail('2 วงแหวน ' + R1.ring + ' ≠ ' + A.pct + '% (Σ ' + A.bk + '/' + A.cap + ')');
  else {
    const full = R1.rows.filter(r => r.st === 'full').length, boats = R1.rows.length;
    const m = /(\d+)\s*\/\s*(\d+)/.exec(R1.mood);
    if (!m || +m[1] !== full || +m[2] !== boats) fail('2 ลำเต็ม "' + R1.mood + '" ไม่ตรงแถว (เต็ม ' + full + '/' + boats + ')');
    else ok('2 วงแหวน ' + R1.ring + ' = Σ ' + A.bk + '/' + A.cap + ' · ' + R1.mood);
  }
  const badRow = R1.rows.find(r => { const p = A.per[r.rid]; if (!p) return r.fill !== '' && !/ไม่จำกัด/.test(r.fill); return r.fill.replace(/[^0-9/]/g, '') !== (p.bk + '/' + p.cap); });
  const rowIds = R1.rows.map(r => r.rid).sort().join(','), want = A.rids.sort().join(',');
  const liveBad = R1.rows.filter(r => (r.st === 'open' || r.st === 'be') ? !(r.live && r.scan) : r.live);
  const pierOf = await page.evaluate(ids => Object.fromEntries(ids.map(id => [id, (getRoute(id) || {}).pier || ''])), R1.rows.map(r => r.rid));
  const groups = {}; R1.rows.forEach(r => { (groups[pierOf[r.rid]] = groups[pierOf[r.rid]] || []).push(r.st === 'full' ? 1 : 0); });
  const order = Object.values(groups).every(g => g.join('') === g.slice().sort().join(''));   /* ในแต่ละท่า: เต็มอยู่ล่าง */
  if (rowIds !== want) fail('3 แถวไม่ตรงโปรแกรมพรุ่งนี้ · ' + rowIds + ' vs ' + want);
  else if (badRow) fail('3 ที่นั่งในแถวไม่ตรง getAllotment · ' + JSON.stringify(badRow) + ' vs ' + JSON.stringify(A.per[badRow.rid]));
  else if (liveBad.length) fail('3 ลายวิ่งผิดแถว · ' + JSON.stringify(liveBad.map(r => [r.rid, r.st, r.live])));
  else if (!order) fail('3 แถวเต็มไม่ได้อยู่ล่างแถวที่ยังว่าง · ' + R1.rows.map(r => r.st).join(','));
  else ok('3 ' + R1.rows.length + ' แถว · ที่นั่งตรง getAllotment · ลายวิ่งเฉพาะแถวที่ยังรับจอง · เต็มอยู่ล่าง');
}

/* ══ 4 · โซนรับ ══════════════════════════════════════════════════════ */
const Z = await page.evaluate((S) => {
  const z = { r5: { PK: 0, KL: 0, NT: 0 } };
  SB_BOOKINGS.forEach(b => { if (['cancelled','rejected','cancelled_weather','quote','draft'].includes(b.status)) return; (b.trips || []).forEach(t => { if (t.date !== S.tm || t.routeId !== 'r5') return; const zz = bkV2EffZone(b, t) || 'NoTransfer'; const k = zz === 'PK' ? 'PK' : zz === 'KL' ? 'KL' : 'NT'; z.r5[k] += bkV2PaxAllTot(t.pax || {}); }); });
  return z.r5;
}, S);
{
  const r5 = R1.rows.find(r => r.rid === 'r5');
  const okZ = r5 && (!Z.PK || r5.rt.includes('Phuket ' + Z.PK)) && (!Z.KL || r5.rt.includes('Khao Lak ' + Z.KL)) && (!Z.NT || r5.rt.includes('Own transport ' + Z.NT));
  if (!okZ) fail('4 โซนรับไม่ตรง · "' + (r5 && r5.rt) + '" คาด ' + JSON.stringify(Z));
  else ok('4 โซนรับใต้ชื่อโปรแกรม · Phuket ' + Z.PK + ' · Khao Lak ' + Z.KL);
}

/* ══ 5 · ล่าสุด ══════════════════════════════════════════════════════ */
{
  const r12 = R1.rows.find(r => r.rid === 'r12'), r2 = R1.rows.find(r => r.rid === 'r2'), r10 = R1.rows.find(r => r.rid === 'r10');
  if (!r12 || !/\+1 · \d\d:\d\d/.test(r12.last) || !r12.fresh) fail('5 โปรแกรมที่เพิ่งมีใบเข้า (5 นาทีก่อน) ไม่ขึ้นชิปเขียวกะพริบ · "' + (r12 && r12.last) + '"');
  else if (!r2 || !/ยังไม่มีใบจอง/.test(r2.last)) fail('5 โปรแกรมที่ไม่มีใบไม่ขึ้น "ยังไม่มีใบจอง" · "' + (r2 && r2.last) + '"');
  else if (!r10 || !/เงียบมา/.test(r10.last)) fail('5 โปรแกรมที่ใบล่าสุดเมื่อวานไม่ขึ้น "เงียบมา" · "' + (r10 && r10.last) + '"');
  else ok('5 ล่าสุด: ชิปเขียว "' + r12.last.slice(0, 14) + '…" · ยังไม่มีใบจอง · เงียบมา 1 วัน');
}

/* ══ 6 · เข้ามาวันนี้ · ยกเลิก ══════════════════════════════════════ */
const M6 = await page.evaluate((S) => {
  let add = 0, addN = 0; const z = { PK: 0, KL: 0, NT: 0 };
  SB_BOOKINGS.forEach(b => { if (['cancelled','rejected','cancelled_weather','quote','draft'].includes(b.status)) return; if (_dashBkDay(b) !== S.t0) return; (b.trips || []).forEach(t => { if (t.date !== S.tm) return; const p = bkV2PaxAllTot(t.pax || {}); add += p; addN++; const zz = bkV2EffZone(b, t) || 'NoTransfer'; z[zz === 'PK' ? 'PK' : zz === 'KL' ? 'KL' : 'NT'] += p; }); });
  return { add, addN, z };
}, S);
{
  const s0 = R1.stats[0] || '', s1 = R1.stats[1] || '';
  if (!s0.includes('+' + M6.add) || !s0.includes(M6.addN + ' ใบ')) fail('6 เข้ามาวันนี้ "' + s0 + '" คาด +' + M6.add + ' · ' + M6.addN + ' ใบ');
  else if ((M6.z.PK && !s0.includes('Phuket ' + M6.z.PK)) || (M6.z.KL && !s0.includes('Khao Lak ' + M6.z.KL))) fail('6 แยกโซนไม่ตรง · "' + s0 + '" ' + JSON.stringify(M6.z));
  else if (!s1.includes('−' + S.cxlPax) || !s1.includes('1 ใบ')) fail('6 ยกเลิกวันนี้ "' + s1 + '" คาด −' + S.cxlPax + ' · 1 ใบ');
  else ok('6 เข้ามาวันนี้ +' + M6.add + ' (' + M6.addN + ' ใบ · Phuket ' + M6.z.PK + ' · Khao Lak ' + M6.z.KL + ') · ยกเลิก −' + S.cxlPax);
}

/* ══ 7 · เลื่อนวัน · กรองท่า ══════════════════════════════════════════ */
{
  await page.evaluate(() => ebSetNow('mvd', 'next'));
  const a = await read();
  await page.evaluate(() => ebSetNow('mvd', 'td'));
  const b = await read();
  const t0Th = await page.evaluate((S) => { const d = new Date(S.t0 + 'T12:00:00'); return String(d.getDate()) + ' ' + laMonAbbrTH()[d.getMonth()]; }, S);
  await page.evaluate(() => ebSetNow('mvd', 'tm'));
  await page.evaluate(() => ebSetNow('pier', 'panwa'));
  const c = await read();
  await page.evaluate(() => ebSetNow('pier', ''));
  await page.evaluate(() => { document.querySelector('.ebm-days .d:nth-child(3)').click(); });
  await page.waitForTimeout(150);
  const d = await read();
  await page.evaluate(() => ebSetNow('mvd', 'tm'));
  if (a.big === R1.big || !b.big.includes(t0Th)) fail('7 เลื่อนวันไม่ทำงาน · next "' + a.big + '" · วันนี้ "' + b.big + '"');
  else if (c.rows.length !== 2 || c.rows.some(r => !['r10','r12'].includes(r.rid)) || c.piers.length !== 1) fail('7 กรองท่า Panwa แล้วแถวไม่ใช่ 2 โปรแกรมของพันวา · ' + JSON.stringify(c.rows.map(r => r.rid)));
  else if (d.big === R1.big) fail('7 กดช่องใน 7 วันข้างหน้าแล้ววันไม่เปลี่ยน');
  else ok('7 ‹ › / วันนี้ / ช่อง 7 วัน เปลี่ยนวันได้ · กรองท่าเหลือ ' + c.rows.length + ' แถว');
}

/* ══ 8 · Booking Movement · Today ════════════════════════════════════ */
const M8 = await page.evaluate((S) => {
  const w = document.getElementById('ebm-move'), h2 = w.querySelector('h2').textContent.replace(/\s+/g, ' ');
  const zt = w.querySelector('.ebm-zt').textContent.replace(/\s+/g, ' ');
  const bars = [...w.querySelectorAll('.ebm-hrs>div b')].reduce((s, b) => s + (+b.textContent || 0), 0);
  const rows = [...w.querySelectorAll('.ebm-feed .r')].map(r => { const c = r.cloneNode(true); c.querySelectorAll('.w b, .sl').forEach(x => x.remove());   /* ชื่อเอเยนต์/เซลส์เป็นข้อมูล ไม่ใช่ภาษาของการ์ด */
    return { t: c.textContent.replace(/\s+/g, ' '), sl: (r.querySelector('.sl') || {}).textContent || '', p: (r.querySelector('.p') || {}).textContent }; });
  let n = 0, pax = 0; const z = { PK: 0, KL: 0, NT: 0 };
  SB_BOOKINGS.forEach(b => { if (['cancelled','rejected','cancelled_weather','quote','draft'].includes(b.status) || laIsInternalFree(b)) return; if (_dashBkDay(b) !== S.t0) return; const t = (b.trips || [])[0]; if (!t) return; n++; const p = (b.trips || []).reduce((s, x) => s + bkV2PaxAllTot(x.pax || {}), 0); pax += p; const zz = bkV2EffZone(b, t) || 'NoTransfer'; z[zz === 'PK' ? 'PK' : zz === 'KL' ? 'KL' : 'NT'] += p; });
  return { h2, zt, bars, rows, n, pax, z, en: !/[\u0E01-\u0E3E\u0E40-\u0E5B]/.test(h2 + zt + rows.map(r => r.t).join(''))   /* ฿ อยู่ในบล็อกไทย ไม่นับ */ };
}, S);
{
  const zSum = /(\d+) Phuket/.exec(M8.zt), kSum = /(\d+) Khao Lak/.exec(M8.zt), oSum = /(\d+) Own transport/.exec(M8.zt);
  const tot = (zSum ? +zSum[1] : 0) + (kSum ? +kSum[1] : 0) + (oSum ? +oSum[1] : 0);
  const noSales = M8.rows.filter(r => !/Sales · |Online/.test(r.sl));
  const cxlRow = M8.rows.find(r => /cancelled/.test(r.t));
  if (!M8.h2.includes(M8.n + ' bookings') || !M8.h2.includes(M8.pax + ' seats')) fail('8 หัวการ์ด "' + M8.h2 + '" คาด ' + M8.n + ' bookings · ' + M8.pax + ' seats');
  else if (tot !== M8.pax || M8.bars !== M8.pax) fail('8 โซนรวม ' + tot + ' / แท่งรวม ' + M8.bars + ' ≠ ที่นั่งรวม ' + M8.pax);
  else if (!M8.en) fail('8 การ์ดยังมีภาษาไทย');
  else if (noSales.length) fail('8 แถวที่ไม่มีชิปเซลส์ · ' + JSON.stringify(noSales.slice(0, 2)));
  else if (!cxlRow || cxlRow.p !== '−' + S.cxlPax) fail('8 ใบยกเลิกวันนี้ไม่ขึ้น cancelled −' + S.cxlPax + ' · ' + JSON.stringify(cxlRow));
  else ok('8 Booking Movement · Today: ' + M8.n + ' bookings · ' + M8.pax + ' seats · โซนรวมตรง · แท่งรวมตรง · ชิปเซลส์ทุกแถว · cancelled −' + S.cxlPax);
}

/* ══ 9 · 7 วัน · ลำที่ต้องช่วย ═══════════════════════════════════════ */
const R9 = await page.evaluate(() => {
  const d = [...document.querySelectorAll('#ebm-7 .ebm-days .d')].map(x => ({ pc: x.querySelector('.pc').textContent, cur: x.classList.contains('cur') }));
  const help = [...document.querySelectorAll('#ebm-help .ebm-hr')].map(x => x.textContent.replace(/\s+/g, ' '));
  const btn = document.querySelector('#ebm-help .ebm-hr button'); if (btn) btn.click();
  return { d, help, tab: (window._eb || {}).tab };
});
if (R9.d.length !== 7) fail('9 7 วันข้างหน้าไม่ใช่ 7 ช่อง · ' + R9.d.length);
else if (!R9.d[0].cur || R9.d[0].pc !== R1.ring) fail('9 ช่องพรุ่งนี้ ' + JSON.stringify(R9.d[0]) + ' ไม่ตรงวงแหวน ' + R1.ring);
else if (!R9.help.some(h => /Phi Phi Bamboo/.test(h) && /ว่าง/.test(h))) fail('9 ลำที่ต้องช่วยไม่มีโปรแกรมที่ยังว่าง · ' + JSON.stringify(R9.help));
else if (R9.tab !== 'gap') fail('9 ปุ่มไม่พาไป Gap to Target · ' + R9.tab);
else ok('9 7 วัน · ช่องพรุ่งนี้ ' + R9.d[0].pc + ' · ลำที่ต้องช่วย ' + R9.help.length + ' รายการ · ปุ่มพาไป Gap');
await page.evaluate(() => ebSetNow('tab', 'move'));

/* ══ 10 · ดูอย่างเดียว · error ═════════════════════════════════════════ */
const R10 = await page.evaluate(() => {
  const before = JSON.stringify(SB_BOOKINGS.map(b => b.id + ':' + b.status + ':' + (b.trips || []).map(t => t.routeId + t.date).join(''))), ls = localStorage.getItem('loveandaman_v2');
  for (let i = 0; i < 3; i++) { ebSetNow('mvd', 'next'); ebSetNow('mvd', 'tm'); }
  return { same: before === JSON.stringify(SB_BOOKINGS.map(b => b.id + ':' + b.status + ':' + (b.trips || []).map(t => t.routeId + t.date).join(''))) && ls === localStorage.getItem('loveandaman_v2') };
});
const e10 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!R10.same) fail('10 วาดซ้ำแล้วข้อมูลเปลี่ยน');
else if (e10.length) fail('10 error · ' + e10.slice(0, 3).join(' | '));
else ok('10 ดูอย่างเดียว · ไม่มี error');

await close();
console.log(bad ? ('FAILED ' + bad) : 'ALL OK');
process.exit(bad ? 1 : 0);
