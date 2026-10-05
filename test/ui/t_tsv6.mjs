// §tsV6 · Travel Summary โฉมใหม่ · แถบ navy + ชิปท่าเรือ›เส้นทาง + การ์ดสรุป + หมวด 01–03 จัดใหม่
//
// ที่มา (2026-10-05) · เจ้าของขอ "ลองปรับหน้า Travel Summary ใหม่ โดยอิงดีไซน์จากหน้า Dashboard
//   แต่ยังคงโครงสร้างรายละเอียดข้างในแบบเดิม" · ดู mockup v1–v6 แล้วสั่ง "ปรับดีไซน์นี้ก่อน"
//   ข้อที่เจ้าของกำหนดเอง
//     "ชิปต้องมีแยกท่าเรือก่อน แล้วค่อยมีเส้นทาง" · "พอกดชิป รายละเอียดก็ขึ้นในหัว Header ด้วย"
//     "หัวข้อ สรุปการเดินทางประจำวัน <วันที่> ให้ยาวไปทั้ง Card · ถ้ากดชิปเส้นทาง ชื่อเส้นทางนั้น ๆ ขึ้นต่อ"
//
// กันสิบเอ็ดอย่าง
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
  return { scr: [...h.querySelectorAll('.ts-scr')].filter(vis).length, hd: vis(h.querySelector('.ts-hd')), mbar: vis(h.querySelector('.ts-mbar')), k: vis(h.querySelector('.ts-kpis')), pay: vis(h.querySelector('.ts-pay')), read: vis(h.querySelector('.ts-s03 .ts-read')),
    tr: getComputedStyle(h.querySelector('.ts-s02 tbody tr')).display, th: getComputedStyle(h.querySelector('.ts-s02 thead')).display, bg: getComputedStyle(h).backgroundColor }; });
await page.emulateMedia({ media: 'print' }); await page.waitForTimeout(200); const p1 = await PV(); await page.emulateMedia({ media: 'screen' });
await page.evaluate(() => document.body.classList.add('ts-printing')); await page.waitForTimeout(200); const p2 = await PV();
await page.evaluate(() => document.body.classList.remove('ts-printing')); await page.waitForTimeout(200); const p3 = await PV();
const okP = p => p.scr === 0 && p.hd && p.mbar && p.k && p.pay && p.read && p.tr === 'table-row' && p.th === 'table-header-group';
if (okP(p1) && okP(p2) && p3.scr > 5 && !p3.hd && p3.tr === 'grid') ok('8 ตอนพิมพ์และในหน้าต่างพิมพ์ · ของใหม่หายหมด หัวเอกสาร/การ์ดตัวเลข/ตารางชุดเดิมกลับมาครบ');
else fail('8 ' + JSON.stringify({ p1, p2, p3 }));

/* ══ 9 ══ */
const c9 = await page.evaluate(() => { const all = tsRefPackList(_tsDate).length; _tsPier = 'tublamu'; const t = tsRefPackList(_tsDate).length; _tsPier = 'panwa'; const p = tsRefPackList(_tsDate).length; _tsPier = ''; return { all, t, p }; });
if (c9.all > 0 && c9.t + c9.p === c9.all && c9.t < c9.all && c9.p < c9.all) ok(`9 ชุดเอกสารแนบท้ายตามท่าเรือ · Tub Lamu ${c9.t} + Visit Panwa ${c9.p} = ทั้งวัน ${c9.all}`);
else fail('9 ' + JSON.stringify(c9));

/* ══ 11 · §tsV6b · หัวข้อกลาง · ป้ายมุมขวา · ไม่มีบรรทัด "กำลังดูเฉพาะ" · สีแถบตามท่าเรือ ══ */
const G11 = () => page.evaluate(() => { const h = document.getElementById('travelsum-host'), c = h.querySelector('.h4-card').getBoundingClientRect(), t = h.querySelector('.h4-h1'), pl = h.querySelector('[data-tsv6="pill"]').getBoundingClientRect();
  const rg = document.createRange(); rg.selectNodeContents(t); const tr = rg.getBoundingClientRect();
  return { off: Math.round((tr.left + tr.right) / 2 - (c.left + c.right) / 2), pillRight: Math.round(c.right - pl.right), pillTop: Math.round(pl.top - c.top), pillAboveTitle: pl.bottom <= tr.bottom, scope: h.querySelectorAll('.h4-scope').length, txt: /กำลังดูเฉพาะ/.test(h.querySelector('.h4-card').textContent),
    sub: getComputedStyle(h.querySelector('.h4-brand i')).color, topLine: getComputedStyle(h.querySelector('.h4-card')).borderTopColor, bar: getComputedStyle(h.querySelector('.h4-bar')).backgroundImage, band: getComputedStyle(h.querySelector('.h4-band')).backgroundImage, onInk: getComputedStyle(h.querySelector('.h4-c.on')).color }; });
await page.evaluate(() => { _tsPier = ''; _tsRoute = ''; renderTravelSum(); }); await page.waitForTimeout(300); const g0 = await G11();
await page.click('[data-tspier="tublamu"]'); await page.waitForTimeout(300); const gT = await G11();
await page.click('[data-tspier="panwa"]'); await page.waitForTimeout(300); const gP = await G11();
const other = await page.evaluate(() => [tsPierOf('__no_such_route__'), tsPierName('other'), JSON.stringify(tsV6Theme('other')), JSON.stringify(tsV6Theme('ranong'))]);
await page.evaluate(() => { _tsPier = ''; renderTravelSum(); }); await page.waitForTimeout(300);
if (Math.abs(g0.off) <= 3 && Math.abs(gT.off) <= 3 && g0.pillRight >= 10 && g0.pillRight <= 40 && g0.pillTop >= 0 && g0.pillTop <= 40 && g0.scope === 0 && !gT.txt
  /* §tsV6c · CI #000f4c ทุกแถบ · ปลายขวาเป็นสีประจำท่า · ยังไม่เลือกท่า = ฟ้า CI ที่ทำให้เข้มลง */
  && [g0, gT, gP].every(g => /rgb\(0, 15, 76\)/.test(g.bar)) && /rgb\(0, 122, 166\)/.test(g0.bar) && /rgb\(24, 95, 165\)/.test(gT.bar) && /rgb\(15, 110, 86\)/.test(gP.bar)
  && gT.band === gT.bar && gP.band === gP.bar && g0.bar !== gT.bar && gT.bar !== gP.bar
  && gT.onInk === 'rgb(0, 15, 76)' && g0.sub === 'rgb(0, 188, 223)' && g0.topLine === 'rgb(0, 188, 223)' && other[0] === 'other' && other[1] === 'Other' && other[2] !== other[3])
  ok('11 หัวข้ออยู่กลางการ์ด · ป้ายปิดวันมุมขวาบน · ไม่มีบรรทัด "กำลังดูเฉพาะ" · แถบหัวเริ่มจากกรมท่า CI แล้วไล่ไปสีประจำท่า (ทุกท่า/Tub Lamu/Visit Panwa คนละสี) · ฟ้า CI ที่บรรทัดรองและเส้นบนการ์ด');
else fail('11 ' + JSON.stringify({ g0, gT: { off: gT.off, bar: gT.bar, onInk: gT.onInk, txt: gT.txt }, gP: gP.bar, other }));

/* ══ 10 ══ */
const w1 = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
await page.setViewportSize({ width: 1280, height: 900 }); await page.evaluate(() => { tsPickPier('panwa'); }); await page.waitForTimeout(400);
const w2 = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth, Math.round(document.querySelector('.h4-bar').getBoundingClientRect().height)]);
const e1 = errors.filter(e => !/Failed to load resource/.test(e));
if (w1[0] <= w1[1] && w2[0] <= w2[1] && w2[2] <= 130 && !e1.length) ok(`10 ไม่ล้นแนวนอนที่ ${w1[1]} และ ${w2[1]} (แถบสูง ${w2[2]}px) · ไม่มี error`);
else fail('10 ' + JSON.stringify({ w1, w2, e1: e1.slice(0, 3) }));
if (process.env.SHOT) { await page.setViewportSize({ width: 1700, height: 1100 }); await page.evaluate(() => { tsPickPier(''); window.scrollTo(0, 0); }); await page.waitForTimeout(400); await page.screenshot({ path: process.env.SHOT }); }
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
