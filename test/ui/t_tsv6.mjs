// §tsV6 · Travel Summary โฉมใหม่ · แถบ navy + ชิปท่าเรือ›เส้นทาง + การ์ดสรุป + หมวด 01–03 จัดใหม่
//
// ที่มา (2026-10-05) · เจ้าของขอ "ลองปรับหน้า Travel Summary ใหม่ โดยอิงดีไซน์จากหน้า Dashboard
//   แต่ยังคงโครงสร้างรายละเอียดข้างในแบบเดิม" · ดู mockup v1–v6 แล้วสั่ง "ปรับดีไซน์นี้ก่อน"
//   ข้อที่เจ้าของกำหนดเอง
//     "ชิปต้องมีแยกท่าเรือก่อน แล้วค่อยมีเส้นทาง" · "พอกดชิป รายละเอียดก็ขึ้นในหัว Header ด้วย"
//     "หัวข้อ สรุปการเดินทางประจำวัน <วันที่> ให้ยาวไปทั้ง Card · ถ้ากดชิปเส้นทาง ชื่อเส้นทางนั้น ๆ ขึ้นต่อ"
//
// กันสิบหกอย่าง
//   1 บนจอ · แถบ/ชิป/การ์ดสรุป/หมวด 01,03 ชุดใหม่ขึ้น · หัวเอกสารและการ์ดตัวเลขชุดเดิมซ่อน
//   2 ชิปท่าเรือครบทุกท่าของวันนั้น ยอดรวมกันเท่ากับทั้งวัน · ยังไม่เลือกท่า ไม่มีชิปเส้นทาง
//   3 กดชิปท่าเรือ · ชิปเส้นทางขึ้นเฉพาะของท่านั้น · หัวข้อต่อท้ายด้วยชื่อท่า · ตัวเลขและ manifest เป็นของท่านั้น
//   4 กดชิปเส้นทาง · หัวข้อต่อท้ายด้วยชื่อเส้นทาง · ตัวเลขเป็นของเส้นทางนั้น · กด "ทุกท่าเรือ" กลับมาทั้งวัน
//   5 ป้ายปิดวันนับทั้งวัน ไม่เปลี่ยนตามชิป · ชิปของท่า/เส้นทางที่มีเรื่องค้างมี ! · ที่ไม่มีไม่ขึ้น
//   6 หมวด 02 เป็นการ์ดใบละเคส · เคสรอตัดสินขึ้นก่อน · กดตัดสินได้ · ช่องหมายเหตุไม่มี id ซ้ำ
//   7 หมวด 03 · รับเข้า/เหลือเข้าบริษัท ตรงกับบรรทัดกระทบยอดชุดเดิม · แถบสัดส่วนตรงกับยอดแต่ละวิธี
//   8 ตอนพิมพ์ (media print และหน้าต่างพิมพ์ body.ts-printing) · ของใหม่หายหมด ของเดิมกลับมาครบ ตารางเป็นตาราง
//   9 ชุดเอกสารแนบท้าย (reference pack) ตามท่าเรือที่เลือกด้วย
//  10 ไม่ล้นแนวนอนที่ 1900 และ 1280 · ไม่มี error บนหน้า
//  11 หัวข้อหลักอยู่กลางการ์ด · ป้ายปิดวันมุมขวาบน · ไม่มีบรรทัด "กำลังดูเฉพาะ" · สีแถบหัวตามท่าเรือ (2026-10-05 รอบสอง)
//  12 แถบหัวชิดขอบจอ บน/ซ้าย/ขวา ไม่มีมุมมน ไม่มีขอบครีม (§tsV6e · "เห็นแถบบนสุดไหม ต่างกับที่เป็นอยู่ตรงไหน")
//  13 หมวด 02 · ช่องของทุกใบตั้งตรงกัน ไม่เยื้องตามความยาวชื่อ agent (§ts02Align · "Layout ไม่ตรงกัน")
//  14 หมวด 04 เป็นชีท (§tsManSheet · "ปรับแบบนี้" หลังดู mockup v2) · เลขแถว · หัวตรึง · 3 คอลัมน์แรกตรึงซ้าย · แถวรวมกลุ่ม/วันตรงกับผลบวก · ค้นหา/ชิปกรอง · ของใหม่ไม่ออกตอนพิมพ์
//  15 หมวด 04 ยาวเต็มไม่มีกล่องเลื่อนซ้อน · หัวคอลัมน์เกาะใต้แถบหัว · ซ่อนคอลัมน์ได้ จำต่อผู้ใช้ต่อเครื่อง (§tsManFull · §tsManCols · "ให้เต็มยาวเลย ตอนนี้มี scroll 2 ที่ · ขอเพิ่มการซ่อนบางคอลัมน์ และจำในเครื่องของ user นั้น ๆ")
//  16 หน้าพิมพ์โครงใหม่ §tsDoc ("ลองไม่อิงโครงสร้างเดิม แต่เก็บ Manifest ไว้" → Day Close − ลายเซ็น − คำอธิบาย · หัว = สรุปการเดินทางประจำวัน <วันที่> <เส้นทาง>)
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1200 });
const dlg = []; page.on('dialog', async d => { dlg.push(d.message()); try { await d.accept(); } catch (_) {} });
const DATE = '2026-09-15';
const prep = await page.evaluate((DATE) => {
  /* ย้ายบางใบไปท่าทับละมุ + ทำเคสตัวอย่างสองใบ (รอตัดสินที่ Panwa · ตัดสินแล้วที่ Tub Lamu) */
  const tl = ROUTES.filter(r => r.pier === 'tublamu').slice(0, 2);
  const day = SB_BOOKINGS.filter(b => !['cancelled', 'rejected', 'cancelled_weather'].includes(b.status) && (b.trips || []).length === 1 && b.trips[0].date === DATE && b.trips[0].bookingMode !== 'charter');
  const paid = b => { const p = (b.ops || {}).pierCheckin || {}; return !!(p.pay || p.payments); };
  let moved = 0; const tub = [], pan = [];
  day.forEach((b, i) => { if (!paid(b) && i % 3 === 1 && moved < 9 && tl.length) { b.trips[0].routeId = tl[moved % tl.length].id; moved++; tub.push(b); } else if (!paid(b)) pan.push(b); });
  const two = b => ckBookedPax(b.trips[0]) >= 2 && !(((b.ops || {}).pierCheckin || {}).events || []).length;
  const mkEv = (b, pax) => { b.ops = b.ops || {}; const bk = ckBookedPax(b.trips[0]); const pc = b.ops.pierCheckin = b.ops.pierCheckin || {};
    pc.at = pc.at || '08:40'; pc.actualPax = Math.max(0, bk - pax); pc.noShow = pax; pc.events = [{ type: 'no_show', pax, paxBreak: { ad: pax }, reasonCode: 'no_contact', ts: DATE + 'T08:40:00', at: '08:40', by: 'T' }]; };
  const A = pan.filter(b => two(b) && (getRoute(b.trips[0].routeId) || {}).pier === 'panwa')[0], B = tub.filter(two)[0];
  if (!A || !B) return { err: 'no sample bookings' };
  mkEv(B, 1); TRAVEL_SUM[_tsKey(B.id, DATE)] = { decision: 'none', amount: 0, note: '', by: 'T', at: DATE + 'T09:00:00' };
  mkEv(A, 1);
  return { A: A.id, B: B.id, Ar: A.trips[0].routeId, Br: B.trips[0].routeId, moved };
}, DATE);
if (prep.err) { fail(prep.err); await close(); process.exit(1); }
await goView(page, 'travelsum', 800);
await page.evaluate((DATE) => { _tsDate = DATE; _tsPier = ''; _tsRoute = ''; _tsVatF = ''; renderTravelSum(); }, DATE); await page.waitForTimeout(500);

const SNAP = () => page.evaluate(() => { const h = document.getElementById('travelsum-host'), $ = s => h.querySelector(s), $$ = s => [...h.querySelectorAll(s)];
  const vis = e => !!(e && e.offsetParent !== null && e.getClientRects().length), T = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '', num = s => +String(s || '').replace(/[^0-9.\-]/g, '') || 0;
  return {
    bar: vis($('.h4-bar')), rail: vis($('.h4-rail')), card: vis($('.h4-card')), oldHd: vis($('.ts-hd')), oldK: vis($('.ts-kpis')), oldPay: vis($('.ts-pay')), s01: vis($('[data-tsv6="s01"]')), s03: vis($('[data-tsv6="s03"]')),
    h1: T($('.h4-h1')), tail: T($('[data-tsv6="tail"]')), count: T($('[data-tsv6="count"]')), pill: T($('[data-tsv6="pill"]')), pillW: +(($('[data-tsv6="pill"]') || {}).dataset || {}).w,
    piers: $$('[data-tspier]').map(b => ({ p: b.dataset.tspier, on: b.classList.contains('on'), w: !!b.querySelector('.wn'), t: T(b) })),
    routes: $$('[data-tsroute]').map(b => ({ r: b.dataset.tsroute, on: b.classList.contains('on'), w: !!b.querySelector('.wn'), t: T(b) })),
    chk: $$('[data-tschk]').map(li => ({ k: li.dataset.tschk, w: li.dataset.w, t: T(li) })),
    kTrav: num(T($('.s5-hero b'))), kBk: num(T($('.s5-t[data-t="bk"] .v'))), oldTrav: num(T($$('.ts-kpis .ts-k .kv')[1])), oldBk: num(T($$('.ts-kpis .ts-k .kv')[0])),
    groups: $$('table.ts-man tbody tr.ts-grow').map(tr => T(tr.querySelector('span'))), pier: _tsPier, route: _tsRoute }; });

/* ══ 1 ══ */
const s0 = await SNAP();
if (s0.bar && s0.rail && s0.card && s0.s01 && s0.s03 && !s0.oldHd && !s0.oldK && !s0.oldPay && /สรุปการเดินทางประจำวัน/.test(s0.h1) && /15 กันยายน 2569/.test(s0.h1) && !s0.tail && s0.chk.length === 6)
  ok('1 บนจอขึ้นแถบ ชิป การ์ดสรุป และหมวด 01/03 ชุดใหม่ · หัวเอกสารกับการ์ดตัวเลขชุดเดิมซ่อน · หัวข้อ "' + s0.h1 + '"');
else fail('1 ' + JSON.stringify(s0).slice(0, 700));

/* ══ 2 ══ */
const num = s => +String(s || '').replace(/[^0-9.\-]/g, '') || 0;
const pc = s0.piers.filter(x => x.p), allChip = s0.piers.find(x => !x.p);
const sumBk = pc.reduce((a, x) => a + num((/(\d+) ใบ/.exec(x.t) || [])[1]), 0);
if (pc.length === 2 && pc.some(x => x.p === 'panwa') && pc.some(x => x.p === 'tublamu') && allChip && allChip.on && sumBk === s0.oldBk && sumBk === s0.kBk && s0.routes.length === 0)
  ok(`2 ชิปท่าเรือ ${pc.map(x => x.t.replace(/!$/, '').trim()).join(' | ')} · รวม ${sumBk} ใบเท่ากับทั้งวัน · ยังไม่มีชิปเส้นทาง`);
else fail('2 ' + JSON.stringify({ piers: s0.piers, routes: s0.routes, bk: s0.oldBk }));

/* ══ 3 ══ */
await page.click('[data-tspier="tublamu"]'); await page.waitForTimeout(400);
const s3 = await SNAP();
const tubRoutes = await page.evaluate(() => ROUTES.filter(r => r.pier === 'tublamu').map(r => r.name));
if (s3.pier === 'tublamu' && s3.tail === 'Tub Lamu' && s3.routes.filter(x => x.r).length >= 1 && s3.routes.filter(x => x.r).every(x => tubRoutes.some(n => x.t.includes(n)))
  && s3.kBk === num((/(\d+) ใบ/.exec(pc.find(x => x.p === 'tublamu').t) || [])[1]) && s3.kBk === s3.oldBk && s3.kTrav === s3.oldTrav && s3.groups.length && s3.groups.every(g => tubRoutes.includes(g)))
  ok(`3 กด Tub Lamu · ชิปเส้นทาง ${s3.routes.filter(x => x.r).length} เส้นของท่านั้น · หัวข้อต่อท้าย "${s3.tail}" · ${s3.kBk} ใบ ${s3.kTrav} คน · manifest เหลือเฉพาะท่านี้`);
else fail('3 ' + JSON.stringify({ tail: s3.tail, routes: s3.routes, kBk: s3.kBk, old: s3.oldBk, groups: s3.groups }));

/* ══ 4 ══ */
await page.click('[data-tsroute="' + prep.Br + '"]'); await page.waitForTimeout(400);
const s4 = await SNAP();
const rName = await page.evaluate(id => getRoute(id).name, prep.Br);
await page.click('[data-tspier=""]'); await page.waitForTimeout(400);
const s4b = await SNAP();
if (s4.route === prep.Br && s4.pier === 'tublamu' && s4.tail === rName && s4.h1.endsWith(rName) && s4.kBk === s4.oldBk && s4.kBk <= s3.kBk && s4.groups.length === 1 && s4.groups[0] === rName
  && s4b.pier === '' && s4b.route === '' && !s4b.tail && s4b.kBk === s0.kBk && s4b.routes.length === 0)
  ok(`4 กดชิปเส้นทาง · หัวข้อต่อท้าย "${s4.tail}" · ${s4.kBk} ใบ · กด "ทุกท่าเรือ" กลับมา ${s4b.kBk} ใบ`);
else fail('4 ' + JSON.stringify({ s4: { route: s4.route, tail: s4.tail, h1: s4.h1, kBk: s4.kBk, groups: s4.groups }, s4b: { pier: s4b.pier, kBk: s4b.kBk, tail: s4b.tail } }));

/* ══ 5 ══ */
const pW = s0.piers.find(x => x.p === 'panwa');
await page.click('[data-tspier="tublamu"]'); await page.waitForTimeout(400);
const s5 = await SNAP();
const pendT = s5.chk.find(c => c.k === 'pend'), pend0 = s0.chk.find(c => c.k === 'pend');
await page.click('[data-tspier="panwa"]'); await page.waitForTimeout(400);
const s5b = await SNAP();
const rA = s5b.routes.find(x => x.r === prep.Ar);
if (s0.pillW >= 1 && /เหลือ \d+ เรื่อง/.test(s0.pill) && s5.pillW === s0.pillW && s5.pill === s0.pill && pW && pW.w && pend0.w === '1' && pendT.w === '0' && rA && rA.w)
  ok(`5 ป้าย "${s0.pill}" เท่าเดิมตอนดู Tub Lamu (ที่นั่นรอตัดสิน 0) · ชิป Visit Panwa และชิปเส้นทางของใบที่ค้างมี !`);
else fail('5 ' + JSON.stringify({ pill0: s0.pill, w0: s0.pillW, pill5: s5.pill, w5: s5.pillW, pW, pend0, pendT, rA }));

/* ══ 6 ══ */
await page.click('[data-tspier=""]'); await page.waitForTimeout(400);
const c6 = await page.evaluate(() => { const h = document.getElementById('travelsum-host'); const rows = [...h.querySelectorAll('.ts-s02 tbody tr')];
  const ids = [...h.querySelectorAll('[id^="ts-note-"]')].map(x => x.id);
  return { n: rows.length, disp: rows.map(r => getComputedStyle(r).display), need: rows.map(r => r.classList.contains('need')), dupIds: ids.length - new Set(ids).size, nIds: ids.length,
    lbl: getComputedStyle(rows[0].children[6], '::before').content, thead: getComputedStyle(h.querySelector('.ts-s02 thead')).display,
    cnt: [...h.querySelectorAll('[data-ts02]')].map(x => x.textContent), btnVis: !!rows[0].querySelector('.ts-db') && rows[0].querySelector('.ts-db').offsetParent !== null }; });
/* ══ 13 · §ts02Align · ใบหนึ่งชื่อ agent สั้น อีกใบยาว · ทุกช่องต้องเริ่มที่ตำแหน่งเดียวกัน ทั้งสามขนาดจอ ══ */
const AL = () => page.evaluate(() => { const rows = [...document.querySelectorAll('#travelsum-host .ts-s02 tbody tr')]; const a = rows.map(r => r.querySelector('.ts-ag')); const keep = a.map(x => x.textContent);
  a[0].textContent = 'FS'; a[1].textContent = 'Club Wyndham Asia Pacific';
  const xs = rows.map(r => [...r.children].map(td => Math.round(td.getBoundingClientRect().left - r.getBoundingClientRect().left)));
  a.forEach((x, i) => { x.textContent = keep[i]; }); return xs; });
const al = [];
for (const w of [1900, 1500, 1000]) { await page.setViewportSize({ width: w, height: 1000 }); await page.waitForTimeout(300); al.push(await AL()); }
await page.setViewportSize({ width: 1900, height: 1100 }); await page.waitForTimeout(300);
if (al.every(x => x.length === 2 && x[0].length === 8 && x[0].join() === x[1].join())) ok('13 หมวด 02 · ชื่อ agent สั้น/ยาว ช่องทั้ง 8 ของสองใบตั้งตรงกันที่จอ 1900 · 1500 · 1000');
else fail('13 ' + JSON.stringify(al));
await page.evaluate(() => { const r = document.querySelector('#travelsum-host .ts-s02 tbody tr.need'); [...r.querySelectorAll('.ts-db')].find(b => /ไม่ชาร์จ/.test(b.textContent)).click(); }); await page.waitForTimeout(500);
const c6b = await page.evaluate((id) => { const h = document.getElementById('travelsum-host'); return { dec: (tsGet(id, _tsDate) || {}).decision, need: h.querySelectorAll('.ts-s02 tbody tr.need').length, pill: h.querySelector('[data-tsv6="pill"]').textContent, cnt: [...h.querySelectorAll('[data-ts02]')].map(x => x.textContent) }; }, prep.A);
if (c6.n === 2 && c6.disp.every(d => d === 'grid') && c6.need[0] === true && c6.need[1] === false && c6.dupIds === 0 && c6.nIds === 2 && /ตัดสิน/.test(c6.lbl) && c6.thead === 'none' && c6.btnVis
  && /รอตัดสิน 1/.test(c6.cnt[0]) && c6b.dec === 'none' && c6b.need === 0 && /รอตัดสิน 0/.test(c6b.cnt[0]))
  ok('6 หมวด 02 เป็นการ์ด 2 ใบ · เคสรอตัดสินขึ้นก่อน · กด "ไม่ชาร์จ" แล้วบันทึก ตัวนับเป็น 0 · ช่องหมายเหตุไม่มี id ซ้ำ');
else fail('6 ' + JSON.stringify({ c6, c6b, dlg }));

/* ══ 7 ══ */
const c7 = await page.evaluate(() => { const h = document.getElementById('travelsum-host'), num = s => +String(s || '').replace(/[^0-9.\-]/g, '') || 0, T = e => e ? e.textContent : '';
  const read = T(h.querySelector('.ts-s03 .ts-read')); const pv = [...h.querySelectorAll('.ts-s03 .ts-pay .ts-p .pv')].map(x => num(T(x)));
  const seg = {}; h.querySelectorAll('[data-tsv6="s03"] .s5-bar i').forEach(i => seg[i.dataset.seg] = parseFloat(i.style.flexGrow));
  return { tin: num(T(h.querySelector('[data-m="in"] .m5-hero b'))), net: num(T(h.querySelector('[data-m="net"] .tot b'))), oldIn: num((/รับเข้าวันนี้\s*(฿[\d,]+)/.exec(read) || [])[1]), oldNet: num((/เหลือเข้าบริษัท\s*(฿[\d,]+)/.exec(read) || [])[1]), pv, seg,
    rows: [...h.querySelectorAll('[data-m="in"] .m5-rows b')].map(b => num(T(b))) }; });
if (c7.tin > 0 && c7.tin === c7.oldIn && c7.net === c7.oldNet && c7.rows[0] === c7.pv[0] && c7.rows[1] === c7.pv[1] && c7.rows[2] === c7.pv[2] && (c7.seg.cash || 0) === c7.pv[0] && (c7.seg.card || 0) === c7.pv[2] && (c7.seg.tf || 0) === c7.pv[1])
  ok(`7 หมวด 03 · รับเข้า ${c7.tin.toLocaleString()} เหลือเข้าบริษัท ${c7.net.toLocaleString()} ตรงกับบรรทัดกระทบยอดเดิม · แถบสัดส่วนตรงกับยอดแต่ละวิธี`);
else fail('7 ' + JSON.stringify(c7));

/* ══ 8 · พิมพ์ ══ */
const PV = () => page.evaluate(() => { const h = document.getElementById('travelsum-host'), vis = e => !!(e && e.getClientRects().length);
  return { scr: [...h.querySelectorAll('.ts-scr')].filter(vis).length, sheet: [...h.querySelectorAll('.ts-gsum,.ts-gtot,.ts-rn,.ts-mtools,.ts-gboat')].filter(vis).length, hd: vis(h.querySelector('.ts-hd')), mbar: vis(h.querySelector('.ts-mbar')), k: vis(h.querySelector('.ts-kpis')), pay: vis(h.querySelector('.ts-pay')), read: vis(h.querySelector('.ts-s03 .ts-read')),
    tr: getComputedStyle(h.querySelector('.ts-s02 tbody tr')).display, th: getComputedStyle(h.querySelector('.ts-s02 thead')).display, bg: getComputedStyle(h).backgroundColor }; });
await page.emulateMedia({ media: 'print' }); await page.waitForTimeout(200); const p1 = await PV(); await page.emulateMedia({ media: 'screen' });
await page.evaluate(() => document.body.classList.add('ts-printing')); await page.waitForTimeout(200); const p2 = await PV();
await page.evaluate(() => document.body.classList.remove('ts-printing')); await page.waitForTimeout(200); const p3 = await PV();
const okP = p => p.scr === 0 && p.sheet === 0 && p.hd && p.mbar && p.k && p.pay && p.read && p.tr === 'table-row' && p.th === 'table-header-group';
if (okP(p1) && okP(p2) && p3.scr > 5 && p3.sheet > 5 && !p3.hd && p3.tr === 'grid') ok('8 ตอนพิมพ์และในหน้าต่างพิมพ์ · ของใหม่หายหมด (รวมเลขแถว/แถวรวม/ชิปกรองของหมวด 04) หัวเอกสาร/การ์ดตัวเลข/ตารางชุดเดิมกลับมาครบ');
else fail('8 ' + JSON.stringify({ p1, p2, p3 }));

/* ══ 9 ══ */
const c9 = await page.evaluate(() => { const all = tsRefPackList(_tsDate).length; _tsPier = 'tublamu'; const t = tsRefPackList(_tsDate).length; _tsPier = 'panwa'; const p = tsRefPackList(_tsDate).length; _tsPier = ''; return { all, t, p }; });
if (c9.all > 0 && c9.t + c9.p === c9.all && c9.t < c9.all && c9.p < c9.all) ok(`9 ชุดเอกสารแนบท้ายตามท่าเรือ · Tub Lamu ${c9.t} + Visit Panwa ${c9.p} = ทั้งวัน ${c9.all}`);
else fail('9 ' + JSON.stringify(c9));

/* ══ 11 · §tsV6b/§tsV6d · หัวข้อกลาง · ป้ายมุมขวา · ไม่มีบรรทัด "กำลังดูเฉพาะ" · แถบหัวสีเต็มพื้นตามท่าเรือ ══
   เจ้าของกำหนด "#00bcdf Tub lamu · #000f4c Visit Panwa · Ranong ผสมกันระหว่างสองสี · สีเต็มพื้น" */
const G11 = () => page.evaluate(() => { const h = document.getElementById('travelsum-host'), c = h.querySelector('.h4-card').getBoundingClientRect(), t = h.querySelector('.h4-h1'), pl = h.querySelector('[data-tsv6="pill"]').getBoundingClientRect();
  const rg = document.createRange(); rg.selectNodeContents(t); const tr = rg.getBoundingClientRect(); const cs = s => getComputedStyle(h.querySelector(s));
  return { off: Math.round((tr.left + tr.right) / 2 - (c.left + c.right) / 2), pillRight: Math.round(c.right - pl.right), pillTop: Math.round(pl.top - c.top), scope: h.querySelectorAll('.h4-scope').length, txt: /กำลังดูเฉพาะ/.test(h.querySelector('.h4-card').textContent),
    bg: cs('.h4-bar').backgroundColor, img: cs('.h4-bar').backgroundImage, band: cs('.h4-band').backgroundColor, bandImg: cs('.h4-band').backgroundImage, brand: cs('.h4-brand b').color, sub: cs('.h4-brand i').color,
    chip: cs('.h4-c:not(.on)').color, onBg: cs('.h4-c.on').backgroundColor, onFg: cs('.h4-c.on').color, gh: cs('.h4-gh').color, priBg: cs('.h4-pri').backgroundColor, priFg: cs('.h4-pri').color, line: cs('.h4-card').borderTopColor }; });
await page.evaluate(() => { _tsPier = ''; _tsRoute = ''; renderTravelSum(); }); await page.waitForTimeout(300); const g0 = await G11();
await page.click('[data-tspier="tublamu"]'); await page.waitForTimeout(300); const gT = await G11();
await page.click('[data-tspier="panwa"]'); await page.waitForTimeout(300); const gP = await G11();
const th = await page.evaluate(() => { const L = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const CR = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const o = {}; ['', 'tublamu', 'panwa', 'ranong', 'other'].forEach(p => { const T = tsV6Theme(p); o[p || 'all'] = { bg: T.bg.toLowerCase(), ink: T.ink, cr: +CR(T.bg, T.ink === 'dark' ? '#000f4c' : '#ffffff').toFixed(1), acc: +CR(T.acc, '#ffffff').toFixed(1) }; });
  const mix = '#' + [1, 3, 5].map(i => Math.floor((parseInt('00bcdf'.slice(i - 1, i + 1), 16) + parseInt('000f4c'.slice(i - 1, i + 1), 16)) / 2).toString(16).padStart(2, '0')).join('');
  return { o, mix, pierOf: tsPierOf('__no_such_route__'), nm: tsPierName('other') }; });
await page.evaluate(() => { _tsPier = ''; renderTravelSum(); }); await page.waitForTimeout(300);
const NAVY = 'rgb(0, 15, 76)', CYAN = 'rgb(0, 188, 223)', WHITE = 'rgb(255, 255, 255)';
const lay = Math.abs(g0.off) <= 3 && Math.abs(gT.off) <= 3 && g0.pillRight >= 10 && g0.pillRight <= 40 && g0.pillTop >= 0 && g0.pillTop <= 40 && g0.scope === 0 && !gT.txt;
const solid = [g0, gT, gP].every(g => g.img === 'none' && g.bandImg === 'none' && g.band === g.bg);
const cols = g0.bg === NAVY && gP.bg === NAVY && gT.bg === CYAN && th.o.tublamu.bg === '#00bcdf' && th.o.panwa.bg === '#000f4c' && th.o.ranong.bg === th.mix && th.o.all.bg === '#000f4c';
/* พื้นกรมท่า = ตัวขาว · พื้นฟ้า = ตัวกรมท่า ปุ่มที่เลือกเป็นกรมท่าตัวขาว */
const ink = gP.brand === WHITE && gP.chip !== NAVY && gP.onBg === WHITE && gP.onFg === NAVY && gP.priBg === WHITE && gP.line === CYAN
  && gT.brand === NAVY && gT.chip === NAVY && gT.gh === NAVY && gT.onBg === NAVY && gT.onFg === WHITE && gT.priBg === NAVY && gT.priFg === WHITE && gT.line === NAVY;
const read = Object.values(th.o).every(x => x.cr >= 4.5 && x.acc >= 3.9);
if (lay && solid && cols && ink && read && th.pierOf === 'other' && th.nm === 'Other')
  ok(`11 หัวข้อกลางการ์ด · ป้ายมุมขวา · แถบหัวสีเต็มพื้น Tub Lamu #00bcdf (ตัวกรมท่า) · Visit Panwa #000f4c · Ranong ${th.mix} · ตัวอักษรอ่านออกทุกแบบ (ต่ำสุด ${Math.min(...Object.values(th.o).map(x => x.cr))}:1)`);
else fail('11 ' + JSON.stringify({ lay, solid, cols, ink, read, g0: { bg: g0.bg, img: g0.img, off: g0.off, pr: g0.pillRight, pt: g0.pillTop }, gT, gP: { bg: gP.bg, brand: gP.brand, chip: gP.chip, onBg: gP.onBg, onFg: gP.onFg, priBg: gP.priBg, line: gP.line }, th }));

/* ══ 12 · §tsV6e · แถบหัวชิดขอบจอเหมือน mockup ══ */
const G12 = () => page.evaluate(() => { window.scrollTo(0, 0); const h = document.getElementById('travelsum-host'), m = h.closest('.main').getBoundingClientRect(), b = h.querySelector('.h4-bar').getBoundingClientRect(), hr = h.getBoundingClientRect(), cs = getComputedStyle(h.querySelector('.h4-bar'));
  return { l: Math.round(b.left - m.left), r: Math.round(m.right - b.right), t: Math.round(b.top), rad: cs.borderTopLeftRadius, hrad: getComputedStyle(h).borderTopLeftRadius, fill: getComputedStyle(h).minHeight === innerHeight + 'px', mpt: parseFloat(getComputedStyle(h.closest('.main')).paddingTop), mpl: parseFloat(getComputedStyle(h.closest('.main')).paddingLeft), ov: document.documentElement.scrollWidth - innerWidth }; });
await page.setViewportSize({ width: 1700, height: 1000 }); await page.waitForTimeout(350); const b1 = await G12();
await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(350); const b2 = await G12();
/* จอแคบ · padding ของ .main เปลี่ยน (14/22 -> 10) ต้องวัดใหม่เองตอนย่อจอ · ขอบบนเว้นไว้ให้ปุ่มเมนู */
await page.setViewportSize({ width: 800, height: 900 }); await page.waitForTimeout(450); const b3 = await G12();
await page.setViewportSize({ width: 1700, height: 1000 }); await page.waitForTimeout(350);
const flush = b => b.l === 0 && b.r === 0 && b.t === 0 && b.rad === '0px' && b.hrad === '0px' && b.fill && b.ov <= 0;
const narrow = b3.l === 0 && b3.r === 0 && b3.mpl !== b1.mpl && b3.t >= b3.mpt - 1 && b3.rad === '0px';
if (flush(b1) && flush(b2) && narrow) ok('12 แถบหัวชิดขอบบน/ซ้าย/ขวาของพื้นที่หน้า ทั้งจอ 1700 และ 1280 · ไม่มีมุมมน · พื้นหน้าเต็มถึงล่าง');
else fail('12 ' + JSON.stringify({ b1, b2, b3 }));

/* ══ 14 · §tsManSheet · หมวด 04 เป็นชีทตาราง ══ */
await page.evaluate(() => { _tsPier = ''; _tsRoute = ''; _tsManQ = ''; _tsManF = ''; renderTravelSum(); }); await page.waitForTimeout(400);
const m14 = await page.evaluate(() => { const h = document.getElementById('travelsum-host'), T = h.querySelector('.ts-s04 .ts-man'), num = s => +String(s || '').replace(/[^0-9.\-]/g, '') || 0;
  const data = [...T.querySelectorAll('tbody tr[data-tsman]')], rn = data.map(r => +r.children[0].textContent), th = [...T.querySelectorAll('thead th')];
  const left = i => Math.round(th[i].getBoundingClientRect().left - T.getBoundingClientRect().left), cs = e => getComputedStyle(e);
  /* ยอดรวมกลุ่ม = ผลบวกของใบที่ยังเดินทางในกลุ่ม · คอลัมน์ # (0) Voucher(1) Agency(2) Customer(3) AD(4) CHD(5) INF(6) FOC(7) ไปจริง/จอง(8) … Total(15) */
  const sums = []; let acc = null;
  for (const r of T.querySelectorAll('tbody tr')) { const c = r.className;
    if (c.includes('ts-grow')) { acc = { ad: 0, chd: 0, inf: 0, foc: 0, t: 0, b: 0, m: 0 }; continue; }
    if (c.includes('ts-gsum')) { const d = r.children; sums.push({ got: [num(d[2].textContent), num(d[3].textContent), num(d[4].textContent), num(d[5].textContent), d[6].textContent.replace(/\s/g, ''), num(d[8].textContent)], exp: [acc.ad, acc.chd, acc.inf, acc.foc, acc.t + '/' + acc.b, acc.m] }); continue; }
    if (!r.hasAttribute('data-tsman') || c.includes('ts-cxlrow')) continue;
    const d = r.children, px = i => d[i].classList.contains('lost') ? num(d[i].firstChild.textContent) : num(d[i].textContent);
    acc.ad += px(4); acc.chd += px(5); acc.inf += px(6); acc.foc += px(7); const ab = d[8].textContent.split('/'); acc.t += +ab[0]; acc.b += +ab[1]; acc.m += num(d[15].firstChild.textContent); }
  const gt = T.querySelector('tr.ts-gtot'), gtot = num(gt.children[8].textContent), gexp = sums.reduce((a, s) => a + s.exp[5], 0);
  const chips = [...h.querySelectorAll('[data-tsmanf]')].map(b => [b.getAttribute('data-tsmanf'), +b.querySelector('i').textContent]);
  const tagN = k => data.filter(r => (' ' + r.getAttribute('data-tsman') + ' ').includes(' ' + k + ' ')).length;
  return { n: data.length, seq: rn.every((v, i) => v === i + 1), rnScr: th[0].classList.contains('ts-scr') && data.every(r => r.children[0].classList.contains('ts-scr')),
    thSticky: cs(th[1]).position === 'sticky' && cs(th[1]).top === h.querySelector('.h4-bar').offsetHeight + 'px', frozen: [cs(th[0]).left, cs(data[0].children[1]).position, cs(data[0].children[3]).position, cs(data[0].children[9]).position], tblW: Math.round(T.getBoundingClientRect().width - T.parentNode.getBoundingClientRect().width),
    sums: sums.map(s => s.got.join('|') === s.exp.join('|')), sumsRaw: sums.slice(0, 2), nsum: sums.length, ngrow: T.querySelectorAll('tr.ts-grow').length, gtot, gexp, gtSticky: cs(gt.children[0]).position === 'sticky' && cs(gt.children[0]).bottom === '0px',
    chips, tags: { pier: tagN('pier'), addon: tagN('addon'), sq: tagN('sq'), warn: tagN('warn'), cxl: tagN('cxl') }, gw: cs(T.querySelector('.ts-gw')).position, grid: cs(data[0].children[5]).borderRightWidth, total17: th.length }; });
/* จอแคบ 1000px · ตารางเลื่อนในกล่อง · # Voucher Agency Customer ตรึงซ้าย */
await page.setViewportSize({ width: 1000, height: 900 }); await page.waitForTimeout(400);
const nar = await page.evaluate(() => { const T = document.querySelector('#travelsum-host .ts-man'), th = [...T.querySelectorAll('thead th')], r = T.querySelector('tr[data-tsman]'), cs = e => getComputedStyle(e), sc = T.parentNode;
  const left = i => Math.round(th[i].getBoundingClientRect().left - T.getBoundingClientRect().left);
  return { frozen: [cs(th[0]).left, cs(th[1]).left, cs(th[2]).left, cs(th[3]).left, cs(r.children[1]).position, cs(r.children[3]).position, cs(r.children[9]).position], offs: [left(0), left(1), left(2), left(3)], ovx: sc.scrollWidth - sc.clientWidth }; });
await page.setViewportSize({ width: 1900, height: 1100 }); await page.waitForTimeout(400);
/* กดชิป · พิมพ์ค้น · วาดใหม่แล้วสถานะยังอยู่ · ล้าง */
await page.click('[data-tsmanf="cxl"]'); await page.waitForTimeout(250);
const f1 = await page.evaluate(() => { const T = document.querySelector('#travelsum-host .ts-man'); const vis = [...T.querySelectorAll('tbody tr[data-tsman]')].filter(r => !r.classList.contains('ts-hide')); return { n: vis.length, allCxl: vis.every(r => r.classList.contains('ts-cxlrow')), on: document.querySelector('[data-tsmanf="cxl"]').classList.contains('on') }; });
const vch = await page.evaluate(() => document.querySelector('#travelsum-host .ts-man tbody tr[data-tsman]:not(.ts-cxlrow) .ts-vch').textContent.trim());
await page.evaluate(() => { tsManPick('cxl'); }); await page.fill('.ts-msrch input', vch); await page.waitForTimeout(250);
const f2 = await page.evaluate(() => { const T = document.querySelector('#travelsum-host .ts-man'); const vis = [...T.querySelectorAll('tbody tr[data-tsman]')].filter(r => !r.classList.contains('ts-hide')); return { n: vis.length, hiddenGrow: [...T.querySelectorAll('tr.ts-grow')].filter(r => r.classList.contains('ts-hide')).length, none: getComputedStyle(document.querySelector('[data-tsman-none]')).display }; });
await page.click('[data-tspier="panwa"]'); await page.waitForTimeout(400);
const f3 = await page.evaluate(() => { const rows = [...document.querySelectorAll('#travelsum-host .ts-man tbody tr[data-tsman]')], q = document.querySelector('#travelsum-host .ts-msrch input').value; return { q, n: rows.filter(r => !r.classList.contains('ts-hide')).length, exp: rows.filter(r => r.textContent.includes(q)).length }; });
await page.evaluate(() => { tsManQ('__nothing__'); }); await page.waitForTimeout(200);
const f4 = await page.evaluate(() => ({ n: [...document.querySelectorAll('#travelsum-host .ts-man tbody tr[data-tsman]')].filter(r => !r.classList.contains('ts-hide')).length, none: getComputedStyle(document.querySelector('[data-tsman-none]')).display }));
await page.evaluate(() => { tsManQ(''); _tsPier = ''; renderTravelSum(); }); await page.waitForTimeout(400);
const okM = m14.n >= 20 && m14.seq && m14.rnScr && m14.thSticky && m14.frozen.join() === '0px,static,static,static' && m14.tblW === 0 && nar.frozen.join() === '0px,34px,146px,268px,sticky,sticky,static' && nar.offs.join() === '0,34,146,268' && nar.ovx > 0
  && m14.nsum === m14.ngrow && m14.sums.every(Boolean) && m14.gtot === m14.gexp && m14.gtot > 0 && m14.gtSticky && m14.total17 === 18 && m14.gw === 'sticky' && m14.grid === '1px'
  && m14.chips.length === 6 && m14.chips[0][1] === m14.n && m14.chips.slice(1).every(([k, n]) => n === m14.tags[k]) && m14.tags.cxl > 0 && m14.tags.warn > 0 && m14.tags.addon > 0;
const okF = f1.n === m14.tags.cxl && f1.allCxl && f1.on && f2.n === 1 && f2.hiddenGrow >= 1 && f2.none === 'none' && f3.q === vch && f3.n === f3.exp && f4.n === 0 && f4.none === 'block';
if (okM && okF) ok(`14 หมวด 04 เป็นชีท · ${m14.n} แถวมีเลข 1..${m14.n} · หัวตรึงบน · จอกว้างพอดีความกว้าง · จอแคบ 1000 เลื่อนในกล่องและ # Voucher Agency Customer ตรึงซ้ายที่ 0/34/146/268 · แถวรวม ${m14.nsum} กลุ่ม + รวมวัน ${m14.gtot.toLocaleString()} ตรงกับผลบวก · ชิป/ค้นหากรองได้ และค่าคงอยู่หลังกดชิปท่าเรือ`);
else fail('14 ' + JSON.stringify({ m14, nar, f1, f2, f3, f4, vch }));

/* ══ 15 · §tsManFull + §tsManCols · ตารางยาวเต็ม ไม่มีกล่องเลื่อนซ้อน · หัวคอลัมน์เกาะใต้แถบหัว · ซ่อนคอลัมน์และจำไว้ต่อผู้ใช้ต่อเครื่อง ══ */
await page.evaluate(() => { try { localStorage.removeItem(tsManColsKey()); } catch (_) { } _tsManHC = null; _tsPier = ''; _tsManQ = ''; _tsManF = ''; renderTravelSum(); }); await page.waitForTimeout(400);
const SPAN = () => page.evaluate(() => { const T = document.querySelector('#travelsum-host .ts-man'); const rows = [...T.querySelectorAll('tbody tr')].filter(r => !r.querySelector('.ts-empty'));
  const w = r => [...r.children].filter(c => getComputedStyle(c).display !== 'none').reduce((a, c) => a + c.colSpan, 0);
  const ws = [...new Set(rows.map(w))], th = [...T.querySelectorAll('thead th')].filter(c => getComputedStyle(c).display !== 'none').length;
  return { ws, th, hc: T.getAttribute('data-hc'), dropVis: getComputedStyle(T.querySelector('tr[data-tsman]').children[10]).display !== 'none', hdr: T.querySelectorAll('thead th')[10].textContent.trim(),
    key: tsManColsKey(), stored: (() => { try { return localStorage.getItem(tsManColsKey()); } catch (_) { return 'ERR'; } })(), btn: document.querySelector('#travelsum-host .ts-mcolbtn').textContent }; });
const cs0 = await SPAN();
/* กล่องตารางไม่มีเลื่อนของตัวเอง · เลื่อนหน้าแล้วหัวคอลัมน์มาเกาะใต้แถบหัว */
const full = await page.evaluate(() => { const h = document.getElementById('travelsum-host'), sc = h.querySelector('.ts-s04 .ts-scroll'), cd = h.querySelector('.ts-s04 .ts-card'), cs = getComputedStyle(sc);
  h.querySelector('.ts-s04 .ts-gtot').scrollIntoView(); window.scrollBy(0, -200);
  const bar = h.querySelector('.h4-bar').getBoundingClientRect(), th = h.querySelector('.ts-man thead th:nth-child(2)').getBoundingClientRect(), gt = h.querySelector('.ts-gtot td').getBoundingClientRect();
  return { ov: cs.overflowY, mh: cs.maxHeight, cardOv: getComputedStyle(cd).overflow, inner: sc.scrollHeight - sc.clientHeight, thUnderBar: Math.round(th.top - bar.bottom), barTop: Math.round(bar.top), gtBottom: Math.round(innerHeight - gt.bottom), scrolled: window.scrollY > 100 }; });
await page.evaluate(() => window.scrollTo(0, 0));
/* ซ่อน Drop-off (10) กับ Cancel · Charge (16) · ทุกแถวยังกว้างเท่ากัน · จำลง localStorage · วาดใหม่ยังซ่อน · ผู้ใช้อื่นไม่โดน · แสดงทั้งหมดกลับมาครบ */
await page.evaluate(() => { tsManColsToggle(); }); await page.waitForTimeout(100);
const popOpen = await page.evaluate(() => getComputedStyle(document.querySelector('#travelsum-host .ts-mcols-pop')).display);
await page.click('[data-tscol="10"]'); await page.waitForTimeout(150); await page.click('[data-tscol="16"]'); await page.waitForTimeout(150);
const cs1 = await SPAN();
await page.click('[data-tspier="panwa"]'); await page.waitForTimeout(400); const cs2 = await SPAN();
const other = await page.evaluate(() => { const me = window.LA_ME; window.LA_ME = { username: '__someone_else__' }; const k = tsManColsKey(); _tsManHC = null; const hc = tsManHC().slice(); window.LA_ME = me; _tsManHC = null; return { k, hc }; });
await page.evaluate(() => { tsManColsReset(); }); await page.waitForTimeout(150); const cs3 = await SPAN();
const lock = await page.evaluate(() => { const cb = document.querySelector('[data-tscol="1"]'); tsManCol(1, false); return { dis: cb.disabled, hc: tsManHC().slice() }; });
await page.evaluate(() => { _tsManColsOpen = false; _tsPier = ''; renderTravelSum(); }); await page.waitForTimeout(300);
const okFull = full.ov === 'visible' && full.mh === 'none' && full.cardOv === 'clip' && full.inner === 0 && full.scrolled && full.barTop === 0 && Math.abs(full.thUnderBar) <= 1 && full.gtBottom === 0;
const okCols = cs0.ws.join() === '18' && cs0.th === 18 && cs0.dropVis && /Drop-off/.test(cs0.hdr) && cs0.stored === null && popOpen === 'block'
  && cs1.ws.join() === '16' && cs1.th === 16 && !cs1.dropVis && cs1.hc === '10 16' && cs1.stored === '[10,16]' && /ซ่อน 2/.test(cs1.btn)
  && cs2.ws.join() === '16' && cs2.hc === '10 16' && other.k !== cs1.key && other.hc.length === 0
  && cs3.ws.join() === '18' && cs3.th === 18 && cs3.dropVis && cs3.stored === null && !/ซ่อน/.test(cs3.btn) && lock.dis && lock.hc.length === 0;
if (okFull && okCols) ok(`15 ตารางยาวเต็ม ไม่มีกล่องเลื่อนซ้อน · หัวคอลัมน์เกาะใต้แถบหัว แถวรวมวันเกาะล่างจอ · ซ่อน Drop-off + Cancel แล้วทุกแถวเหลือ 16 ช่องเท่ากัน · จำใน ${cs1.key} · วาดใหม่ยังซ่อน · ผู้ใช้อื่นไม่โดน · แสดงทั้งหมดกลับครบ · Voucher ซ่อนไม่ได้`);
else fail('15 ' + JSON.stringify({ full, cs0, cs1, cs2, cs3, other, lock, popOpen }));

/* ══ 16 · §tsDoc · หน้าพิมพ์โครงใหม่ ("สรุปการเดินทางประจำวัน <วันที่> <เส้นทาง>" · A/B/C · D ตามเส้นทาง · E · F · G Manifest · ไม่มีช่องลายเซ็น ไม่มีบรรทัดคำอธิบาย) ══ */
await page.evaluate(() => { _tsPier = ''; _tsRoute = ''; _tsManQ = ''; _tsManF = ''; _tsManHC = []; renderTravelSum(); }); await page.waitForTimeout(400);
const POP = () => page.evaluate(() => { let out = ''; const fake = { document: { write: s => { out += s; }, close: () => {}, querySelectorAll: () => [], querySelector: () => null, readyState: 'complete', addEventListener: () => {}, images: [], fonts: null }, focus: () => {}, print: () => {}, addEventListener: () => {}, setTimeout: () => {} };
  const o = window.open; window.open = () => fake; let err = ''; try { tsPrintSheet(); } catch (e) { err = e.message; } finally { window.open = o; }
  const doc = new DOMParser().parseFromString(out, 'text/html'), H = doc.getElementById('travelsum-host'), $ = s => H.querySelector(s), $$ = s => [...H.querySelectorAll(s)], T = e => e ? e.textContent.trim().replace(/\s+/g, ' ') : null, num = s => +String(s || '').replace(/[^0-9.\-]/g, '') || 0;
  const live = document.getElementById('travelsum-host');
  const grows = live.querySelectorAll('.ts-man tr.ts-grow').length, liveRows = live.querySelectorAll('.ts-man tbody tr[data-tsman]').length, liveTot = (live.querySelector('.ts-man .ts-gtot .ts-totc') || { textContent: '' }).textContent.trim();
  const rt = $$('table.rt tbody tr:not(.tot)'), tot = $('table.rt tr.tot') || { children: [] };
  const sumBk = rt.reduce((a, r) => a + num(r.children[3].textContent), 0), sumM = rt.reduce((a, r) => a + num(r.children[12].textContent), 0);
  return { err, len: out.length, dc: $$('.dc').length, title: T($('.dc-h h1')), dt: T($('.dc-h h1 .dt')), rtName: T($('.dc-h h1 .rt')), sign: $$('.sign').length + $$('.ts-sign').length, sub: $$('.dc-h .sub').length, hd: $$('.ts-hd').length,
    boxes: $$('.dc-row .box').length, boxT: $$('.dc-row .box .bh').map(T), secs: $$('.sec-t .n').map(T).join(''), rtN: rt.length, grows, rtTotBk: num((tot.children[1] || {}).textContent), sumBk, rtTotM: ((tot.children[10] || {}).textContent || '').trim(), sumM, liveTot,
    manRows: $$('.ts-man tbody tr[data-tsman]').length, liveRows, manTot: T($('.ts-man .ts-gtot .ts-totc')), rn: $$('.ts-man tr[data-tsman] td.ts-rn').length, cases: $$('.ts-s02 table, table:not(.rt):not(.ts-man)').length,
    pageCss: /@page ts\{size:A4 landscape[^@]*@bottom-left/.test(out) && /@bottom-right\{content:"หน้า " counter\(page\) " \/ " counter\(pages\)/.test(out), css: /#travelsum-host \.dc \.dc-h\{/.test(out), tsCss: out.indexOf('<style id="ts-style">') > 0, pack: /la-docpack/.test(out), pierBg: ($('.dc-h') || {}).getAttribute ? $('.dc-h').getAttribute('style') : '' }; });
const d0 = await POP();
/* วางหน้าป๊อปอัปจริง (เนื้อหาที่ tsPrintSheet เขียน) ในแท็บใหม่ แล้ววัดความกว้างคอลัมน์ Manifest ตอนพิมพ์
   · เคยพลาด: tsCSS ชุดเดิมกำหนดความกว้างตาม nth-child ของตาราง 17 คอลัมน์ พอมีช่องเลขแถวนำหน้า คอลัมน์ลูกค้าเหลือ 26px
     ชื่อลูกค้าตัดทีละตัวอักษร แถวสูงครึ่งหน้า (เจ้าของส่งภาพจาก production มา) */
const popHtml = await page.evaluate(() => { let out = ''; const fake = { document: { write: s => { out += s; }, close: () => {}, querySelectorAll: () => [], querySelector: () => null, readyState: 'complete', addEventListener: () => {}, images: [], fonts: null }, focus: () => {}, print: () => {}, addEventListener: () => {}, setTimeout: () => {} }; const o = window.open; window.open = () => fake; try { tsPrintSheet(); } finally { window.open = o; } return out; });
const pp16 = await page.context().newPage(); await pp16.setViewportSize({ width: 1054, height: 800 }); await pp16.setContent(popHtml, { waitUntil: 'load' }); await pp16.emulateMedia({ media: 'print' }); await pp16.waitForTimeout(300);
const lay16 = await pp16.evaluate(() => { const T = document.querySelector('#travelsum-host .dc .ts-man'), W = T.getBoundingClientRect().width, th = [...T.querySelectorAll('thead th')].map(x => x.getBoundingClientRect().width / W * 100);
  const rows = [...T.querySelectorAll('tbody tr[data-tsman]')], tall = rows.map(r => r.getBoundingClientRect().height); const cs = s => getComputedStyle(document.querySelector('#travelsum-host .dc ' + s));
  return { W: Math.round(W), cust: +th[3].toFixed(1), pick: +th[9].toFixed(1), px: th.slice(4, 8).map(x => +x.toFixed(1)), maxRow: Math.round(Math.max(...tall)), medRow: Math.round(tall.sort((a, b) => a - b)[Math.floor(tall.length / 2)]), head: cs('.dc-h').display, hbg: cs('.dc-h').backgroundColor, rtRows: document.querySelectorAll('#travelsum-host .dc table.rt tbody tr').length, hRight: getComputedStyle(document.querySelector('#travelsum-host .dc .rt th.r')).textAlign }; });
await pp16.close();
await page.evaluate(() => { _tsPier = 'panwa'; renderTravelSum(); }); await page.waitForTimeout(400); const d1 = await POP();
const rid16 = await page.evaluate(() => { const b = document.querySelector('[data-tsroute]:not([data-tsroute=""])'); return b ? b.getAttribute('data-tsroute') : ''; });
await page.evaluate((r) => { _tsRoute = r; renderTravelSum(); }, rid16); await page.waitForTimeout(400); const d2 = await POP();
const rName16 = await page.evaluate((r) => tsRouteName(r), rid16);
await page.evaluate(() => { _tsPier = ''; _tsRoute = ''; renderTravelSum(); }); await page.waitForTimeout(400);
const okD = d => !d.err && d.dc === 1 && /^สรุปการเดินทางประจำวัน /.test(d.title) && d.dt && d.sign === 0 && d.sub === 0 && d.hd === 0 && d.boxes === 3 && d.boxT.join('|').includes('ผู้โดยสาร') && d.boxT.join('|').includes('เงิน') && d.secs === 'DEFG' && d.boxT.map(x => x[0]).join('') === 'ABC'
  && d.rtN === d.grows && d.rtN > 0 && d.rtTotBk === d.sumBk && num(d.rtTotM) === d.sumM && d.rtTotM === d.liveTot && d.manRows === d.liveRows && d.manTot === d.liveTot && d.rn === d.manRows && d.pageCss && d.css && d.tsCss;
const okLay = lay16.W > 900 && lay16.cust >= 7.5 && lay16.pick >= 7.5 && lay16.px.every(x => x <= 4) && lay16.maxRow < 170 && lay16.medRow < 70 && lay16.head === 'flex' && lay16.hbg === 'rgb(0, 15, 76)' && lay16.rtRows === d0.rtN + 1 && lay16.hRight === 'right';
if (okD(d0) && okD(d1) && okD(d2) && okLay && !d0.rtName && d1.rtName === 'Visit Panwa' && d2.rtName === rName16 && d1.manRows < d0.manRows && /#000f4c/i.test(d1.pierBg) && d0.pack)
  ok(`16 หน้าพิมพ์โครงใหม่ · หัว "${d0.title}" · A/B/C · D ตามเส้นทาง ${d0.rtN} แถว รวม ${d0.rtTotM} = ผลบวก = รวมใน Manifest · Manifest ${d0.manRows} แถวมีเลขแถว · ไม่มีลายเซ็น/คำอธิบาย · เลือกท่า/เส้นทางแล้วชื่อขึ้นต่อหัว (${d2.rtName}) · ท้ายกระดาษมีเลขหน้า · ชุดเอกสารแนบยังตามมา · วางหน้าจริงแล้วคอลัมน์ลูกค้า ${lay16.cust}% จุดรับ ${lay16.pick}% แถวสูงสุด ${lay16.maxRow}px`);
else fail('16 ' + JSON.stringify({ lay16, d0, d1: { err: d1.err, rtName: d1.rtName, manRows: d1.manRows, pierBg: d1.pierBg }, d2: { err: d2.err, rtName: d2.rtName }, rName16 }));

/* ══ 10 ══ */
const w1 = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
await page.setViewportSize({ width: 1280, height: 900 }); await page.evaluate(() => { tsPickPier('panwa'); }); await page.waitForTimeout(400);
const w2 = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth, Math.round(document.querySelector('.h4-bar').getBoundingClientRect().height)]);
const e1 = errors.filter(e => !/Failed to load resource/.test(e));
if (w1[0] <= w1[1] && w2[0] <= w2[1] && w2[2] <= 130 && !e1.length) ok(`10 ไม่ล้นแนวนอนที่ ${w1[1]} และ ${w2[1]} (แถบสูง ${w2[2]}px) · ไม่มี error`);
else fail('10 ' + JSON.stringify({ w1, w2, e1: e1.slice(0, 3) }));
if (process.env.SHOT) { await page.setViewportSize({ width: 1700, height: 1100 }); await page.evaluate(p => { tsPickPier(p); window.scrollTo(0, 0); }, process.env.SHOTPIER || ''); await page.waitForTimeout(400); await page.screenshot({ path: process.env.SHOT }); }
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
