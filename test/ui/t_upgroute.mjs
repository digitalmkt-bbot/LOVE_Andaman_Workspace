// §upgRoute · Upgrade = ย้ายลูกค้าไปวิ่งอีกเส้นทาง · ราคายึดที่จอง · เก็บเพิ่มได้ตามตกลง
//
// ที่มา (2026-10-03) · ผู้ใช้อธิบายปุ่ม ⤴ ในช่อง Boat ของหน้า By trip
//   "การ upgrade คือการย้ายไปเส้นทางอื่น ซึ่งราคายึดราคาที่จอง แต่อาจจะเก็บเพิ่มได้หรือไม่ได้ แล้วแต่ตกลง"
//   เลือก · ยอดเก็บเพิ่มเข้ารายการอัปเกรดเดิม · ใบย้ายไปอยู่ใต้โปรแกรมปลายทาง ที่นั่งนับที่ปลายทาง
//   ของเดิมเป็นแค่ธง: ยอดเก็บเพิ่มไม่มีหน้าไหนอ่าน ใบยังอยู่ใต้โปรแกรมเดิม ที่นั่งนับที่เดิม และไม่ถูกบันทึกลงฐานข้อมูล
//
// กันสิบเอ็ดอย่าง
//   1 กด ⤴ · หน้าต่างเปิด · รายการปลายทางคือโปรแกรมอื่นที่มีเรือวิ่งวันนั้น (ไม่มีโปรแกรมเดิม) พร้อมที่ว่าง
//   2 ไม่เลือกปลายทาง / ไม่ใส่เหตุผล · ยังไม่ย้าย
//   3 ย้ายพร้อมเก็บเพิ่ม · ทริปไปอยู่เส้นทางปลายทาง · ยอดใบจองเท่าเดิม · เรือเดิมถูกล้าง · จำที่มาไว้
//   4 ที่นั่ง · โปรแกรมเดิมได้ที่คืน โปรแกรมปลายทางถูกใช้เพิ่ม เท่าจำนวนคน
//   5 หน้า By trip · แถวไปอยู่ใต้แถบโปรแกรมปลายทาง มีป้าย "จาก <โปรแกรมเดิม>" · ปุ่ม ⤴ บอกว่า upgrade อยู่
//   6 ยอดเก็บเพิ่มเป็นรายการอัปเกรดที่ยังไม่เก็บ · ขึ้นในยอดต้องเก็บหน้าท่า
//   7 เปิดแก้ใบ · ราคาที่คิดได้เท่ายอดที่จองไว้ (ไม่คิดตามโปรแกรมปลายทาง) · บันทึกแล้วยอดเท่าเดิม ยังอยู่เส้นทางปลายทาง
//   8 ปลายทางที่ว่างไม่พอ · เลือกไม่ได้ และย้ายไม่ได้
//   9 กด ⤴ ซ้ำ = ย้อนกลับ · กลับเส้นทางเดิม · รายการเก็บเพิ่มที่ยังไม่เก็บถูกลบ · ที่นั่งกลับเหมือนก่อนย้าย
//  10 ย้ายแบบไม่เก็บเพิ่ม · ไม่มีรายการอัปเกรด · ไม่มี error
//  12 ที่มา + เหตุผล + ยอดเก็บเพิ่ม ขึ้นในช่องหมายเหตุของ By trip · Travel Summary · Pier Check-in · หน้ารายละเอียดใบ (ผู้ใช้เขียน "Free upgrade" แล้วไม่เห็นที่ไหนเลย)
//     และหน้าต่าง Upgrade แยกโปรแกรมตามท่าเรือ ท่าเดียวกับโปรแกรมเดิมขึ้นก่อน (ข้อ 1)
//  11 trip.upg รอดการเดินทางไป-กลับฐานข้อมูล (decomposeBlob → assembleBlob ของเซิร์ฟเวอร์จริง)
import { open, goView, ROOT } from './_harness.mjs';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const osRepo = require(path.join(ROOT, '..', 'os-backend/src/mapping/os_repo.js'));

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1000 });
const dlg = [];
page.on('dialog', async d => { dlg.push({ type: d.type(), msg: d.message() }); try { await d.accept(); } catch (_) {} });
await goView(page, 'booking', 900);

/* หาใบที่: ไม่ใช่ B2C/เหมาลำ/ค้างคืน/ดึงล็อก · ราคาคิดจากเรทแล้วเท่ายอดที่บันทึกไว้ · วันนั้นมีโปรแกรมอื่นที่มีเรือวิ่งและที่ว่างพอ */
const S = await page.evaluate(async () => {
  const live = b => !['cancelled', 'rejected', 'cancelled_weather', 'completed'].includes(b.status);
  const tried = [];
  for (const b of SB_BOOKINGS) {
    if (!live(b) || b.schemaVer !== 2 || b.agentId === 'a_b2c' || !b.agentId || (b.trips || []).length !== 1 || b.priceMode === 'manual') continue;
    const t = b.trips[0]; if (!t || t.bookingMode === 'charter' || t.ovn || t.ovnLeg || (+t.lockUse || 0) > 0 || (t.seatSource && +t.seatSource.locked > 0)) continue;
    if (!(+b.total > 0) || (b.upgrades || []).length) continue;
    const pax = bkV2PaxAllTot(t.pax || {}); if (pax < 1) continue;
    const T = bkV2UpgTargets(t.date, t.routeId, b.id).filter(x => x.free != null && x.free >= pax + 2);
    if (!T.length) continue;
    const alA = getAllotment(t.routeId, t.date, null); if (!alA || !alA.hasAllotment) continue;
    let q = null, disc = 0; try { bkV2EditBooking(b.id); const Q = bkV2CalcQuote(); q = Math.round(Q.grandTotal); disc = +(Q.totalDiscount != null ? Q.totalDiscount : Q.discount) || 0; } catch (e) { q = null; }
    const drift = _bkV2.newBooking && _bkV2.newBooking._rtKeep ? _bkV2.newBooking._rtKeep.drift : 'none';
    _bkV2.newBooking = null; _bkV2.editingId = null;
    tried.push(b.id + ':' + q + '/' + Math.round(b.total));
    if (q !== Math.round(b.total) || drift || disc > 0) continue;   /* ใบที่มีส่วนลด แก้แล้วเข้าคิวอนุมัติเสมอ (กติกาเดิม) · หายจากตาราง ใช้ทดสอบต่อไม่ได้ */
    /* ราคาของปลายทางต้องต่างจากเดิม ไม่งั้นข้อ 7 พิสูจน์อะไรไม่ได้ */
    let dest = null;
    for (const x of T) { const keep = t.routeId; t.routeId = x.rid; let q2 = null; try { bkV2EditBooking(b.id); q2 = Math.round(bkV2CalcQuote().grandTotal); } catch (e) {} _bkV2.newBooking = null; _bkV2.editingId = null; t.routeId = keep;
      if (q2 != null && q2 !== q) { dest = { ...x, q2 }; break; } }
    if (!dest) continue;
    _bkV2.filterDate = t.date; _bkV2.filterRoute = null; _bkV2.boatAssignMode = true; bkV2SwitchTab('bytrip'); await new Promise(z => setTimeout(z, 700));
    return { id: b.id, date: t.date, from: t.routeId, fromNm: getRoute(t.routeId).name, to: dest.rid, toNm: dest.name, destQuote: dest.q2, pax, total: Math.round(b.total),
      boat: bkOpsRead(b, t.date).boatId || '', usedA: alA.seatsAvailable, usedB: getAllotment(dest.rid, t.date, null).seatsAvailable };
  }
  return { err: 'no candidate · tried ' + tried.slice(0, 8).join(' ') };
});
if (S.err) { fail('setup · ' + S.err); await close(); process.exit(1); }
const st = () => page.evaluate(s => { const b = SB_BOOKINGS.find(x => x.id === s.id), t = b.trips[0];
  return { route: t.routeId, upg: t.upg || null, total: Math.round(b.total), boat: bkOpsRead(b, s.date).boatId || '', ups: (b.upgrades || []).map(u => ({ id: u.id, p: u.sellPrice, c: !!u.collected, l: u.label })),
    freeA: getAllotment(s.from, s.date, null).seatsAvailable, freeB: getAllotment(s.to, s.date, null).seatsAvailable, modal: !!document.getElementById('bkv2-upg-ov'), upDue: pckMoney(b, s.date).upDue }; }, S);
const row = () => page.evaluate(s => { const tr = [...document.querySelectorAll('#bkv2-host tr.t2-row[data-al]')].find(r => r.dataset.al.indexOf(s.id) === 0); if (!tr) return null;
  let band = tr.previousElementSibling; while (band && !band.classList.contains('t2-pband')) band = band.previousElementSibling;
  if (!band) { const tb = tr.closest('table'); band = tb && tb.querySelector('tr.t2-pband'); }
  const tag = tr.querySelector('[data-upgfrom]'), up = tr.querySelector('[data-babtn="up"]');
  const un = tr.querySelector('[data-upgnote]'), lead = tr.querySelector('.t2-lead');
  const stack = (tag && lead) ? (lead.getBoundingClientRect().top >= tag.getBoundingClientRect().bottom - 1 && tag.getBoundingClientRect().right <= tr.querySelector('td.t2-cu').getBoundingClientRect().right + 1) : null;
  return { stack, note: un ? un.textContent.trim() : '', noteVis: un ? un.getBoundingClientRect().height > 6 : false, leadVis: lead ? (lead.getBoundingClientRect().width > 30 && lead.getBoundingClientRect().right <= tr.querySelector('td.t2-cu').getBoundingClientRect().right + 1) : false, band: band ? band.querySelector('.pn').textContent : '', tag: tag ? tag.textContent.trim() : '', upTitle: up ? up.title : '', pick: (tr.querySelector('[data-babtn="pick"]') || {}).textContent || '' }; }, S);
const clickUp = () => page.evaluate(s => { const tr = [...document.querySelectorAll('#bkv2-host tr.t2-row[data-al]')].find(r => r.dataset.al.indexOf(s.id) === 0); tr.querySelector('[data-babtn="up"]').click(); }, S);

/* ══ 1 ══ */
const r0 = await row();
await clickUp(); await page.waitForTimeout(250);
const m1 = await page.evaluate(s => ({ piers: [...document.querySelectorAll('#bkv2-upg-ov [data-upg-pier]')].map(g => ({ p: g.dataset.upgPier, tag: g.querySelector('[data-upg-piertag]').dataset.upgPiertag, n: g.querySelectorAll('[data-upg-to]').length, ok: [...g.querySelectorAll('[data-upg-to]')].every(l => bkUpgPierOf(l.dataset.upgTo) === g.dataset.upgPier) })), fromPier: bkUpgPierOf(s.from), open: !!document.getElementById('bkv2-upg-ov'), isModal: !!document.querySelector('#bkv2-upg-ov.la-modal'), to: [...document.querySelectorAll('#bkv2-upg-ov [data-upg-to]')].map(l => ({ rid: l.dataset.upgTo, txt: l.textContent.trim(), dis: l.querySelector('input').disabled })) }), S);
/* ชุดข้อมูลมีท่าเดียว · ย้ายโปรแกรมปลายทางไปอีกท่าชั่วคราว เพื่อดูป้าย "ต่างท่า" */
const m1b = await page.evaluate(s => { const r = getRoute(s.to), keep = r.pier; r.pier = (bkUpgPierOf(s.from) === 'tublamu') ? 'panwa' : 'tublamu'; bkV2UpgModal();
  const g = [...document.querySelectorAll('#bkv2-upg-ov [data-upg-pier]')].map(x => ({ p: x.dataset.upgPier, tag: x.querySelector('[data-upg-piertag]').dataset.upgPiertag, txt: x.querySelector('[data-upg-piertag]').textContent, has: !!x.querySelector('[data-upg-to="' + s.to + '"]') }));
  r.pier = keep; bkV2UpgModal(); return g.find(x => x.has) || null; }, S);
if (process.env.SHOT) { await page.evaluate(s => { const r = getRoute(s.to); window.__kp = r.pier; r.pier = (bkUpgPierOf(s.from) === 'tublamu') ? 'panwa' : 'tublamu'; _bkUpg.to = ''; bkV2UpgModal(); }, S); const el = await page.$('#bkv2-upg-ov > div'); if (el) await el.screenshot({ path: process.env.SHOT }); await page.evaluate(s => { getRoute(s.to).pier = window.__kp; bkV2UpgModal(); }, S); }
const pierOk = m1b && m1b.tag === 'other' && m1b.p !== m1.fromPier && m1.piers.length >= 1 && m1.piers.every(g => g.ok && g.n >= 1 && g.tag === (g.p === m1.fromPier ? 'same' : 'other')) && m1.piers.reduce((n, g) => n + g.n, 0) === m1.to.length && (m1.piers[0].p === m1.fromPier || !m1.piers.some(g => g.p === m1.fromPier));
if (r0 && r0.band === S.fromNm && pierOk && m1.open && m1.isModal && m1.to.some(x => x.rid === S.to && !x.dis && /free/.test(x.txt)) && !m1.to.some(x => x.rid === S.from))
  ok(`1 กด ⤴ ที่ใบของ "${S.fromNm}" · หน้าต่างเปิด · ปลายทาง ${m1.to.length} โปรแกรม แยก ${m1.piers.length} ท่า (${m1.piers.map(g => g.p + ':' + g.tag).join(' ')}) เช่น "${m1.to.find(x => x.rid === S.to).txt}"`);
else fail('1 ' + JSON.stringify({ r0, m1 }));

/* ══ 2 ══ */
dlg.length = 0; await page.evaluate(() => bkV2UpgApply()); await page.waitForTimeout(150);
const a2 = await st();
await page.evaluate(s => { document.querySelector('#bkv2-upg-ov [data-upg-to="' + s.to + '"] input').click(); }, S); await page.waitForTimeout(200);
await page.evaluate(() => bkV2UpgApply()); await page.waitForTimeout(150);
const b2 = await st();
if (dlg.length === 2 && a2.route === S.from && b2.route === S.from && b2.modal && !b2.upg) ok('2 ไม่เลือกปลายทาง / ไม่ใส่เหตุผล · ยังไม่ย้าย');
else fail('2 ' + JSON.stringify({ dlg, a2, b2 }));

/* ══ 3–6 ══ */
dlg.length = 0;
await page.evaluate(() => { const r = document.getElementById('bkupg-reason'); r.value = 'origin trip cancelled'; r.dispatchEvent(new Event('input')); const c = document.getElementById('bkupg-charge'); c.value = '500'; c.dispatchEvent(new Event('input')); document.querySelector('#bkv2-upg-ov [data-upg-go]').click(); });
await page.waitForTimeout(700);
const a3 = await st();
if (!dlg.length && !a3.modal && a3.route === S.to && a3.total === S.total && !a3.boat && a3.upg && a3.upg.fromRouteId === S.from && a3.upg.toRouteId === S.to && a3.upg.date === S.date && a3.upg.reason === 'origin trip cancelled' && a3.upg.charge === 500 && a3.upg.by)
  ok(`3 ย้ายไป "${S.toNm}" · ยอดใบจองยัง ฿${a3.total.toLocaleString()} · เรือเดิม${S.boat ? 'ถูกล้าง' : 'ไม่มี'} · จำที่มา/เหตุผล/ยอด/คนทำ`);
else fail('3 ' + JSON.stringify({ dlg, a3, S }));
if (a3.freeA === S.usedA + S.pax && a3.freeB === S.usedB - S.pax) ok(`4 ที่นั่ง · "${S.fromNm}" ว่างเพิ่ม ${S.pax} (${S.usedA} → ${a3.freeA}) · "${S.toNm}" ถูกใช้เพิ่ม ${S.pax} (${S.usedB} → ${a3.freeB})`);
else fail('4 ' + JSON.stringify({ a: [S.usedA, a3.freeA], b: [S.usedB, a3.freeB], pax: S.pax }));
const r5 = await row();
if (r5 && r5.band === S.toNm && r5.tag.includes(S.fromNm) && /Upgraded from/.test(r5.upTitle) && /assign/.test(r5.pick)) ok(`5 By trip · แถวอยู่ใต้ "${r5.band}" · ป้าย "${r5.tag}" · ต้องจัดเรือใหม่`);
else fail('5 ' + JSON.stringify(r5));
if (a3.ups.length === 1 && a3.ups[0].p === 500 && !a3.ups[0].c && a3.ups[0].id === a3.upg.upgId && a3.ups[0].l.includes(S.toNm) && a3.upDue === 500) ok(`6 ยอดเก็บเพิ่ม ฿500 เป็นรายการอัปเกรด "${a3.ups[0].l}" · ขึ้นในยอดต้องเก็บหน้าท่า`);
else fail('6 ' + JSON.stringify({ ups: a3.ups, upDue: a3.upDue }));

/* ══ 12 · เหตุผลและที่มาขึ้นในช่องหมายเหตุทุกหน้า (§upgNote) ══ */
{
  const want = [S.fromNm, 'origin trip cancelled', '500'];
  const has = t => want.every(w => String(t || '').includes(w));
  const X = await page.evaluate(async s => { const b = SB_BOOKINGS.find(x => x.id === s.id);
    const ts = tsSreqOf(b);
    _pckDate = s.date; nav(document.querySelector('.nav-item[data-view="piercheckin"]')); await new Promise(z => setTimeout(z, 900));
    const pc = [...document.querySelectorAll('#view-piercheckin .ck-sreq')].map(x => x.textContent).filter(t => t.indexOf('Upgrade') >= 0);
    nav(document.querySelector('.nav-item[data-view="booking"]')); await new Promise(z => setTimeout(z, 400));
    bkV2OpenDetail(s.id); await new Promise(z => setTimeout(z, 500));
    const dt = (document.querySelector('#bkv2-host [data-upgdetail]') || {}).textContent || '';
    _bkV2.detailId = null; _bkV2.filterDate = s.date; _bkV2.filterRoute = null; _bkV2.boatAssignMode = true; bkV2SwitchTab('bytrip'); await new Promise(z => setTimeout(z, 600));
    return { ts, pc, dt }; }, S);
  const r12 = await row();
  if (r12 && has(r12.note) && r12.noteVis && r12.leadVis && r12.stack === true && has(X.ts) && X.pc.length >= 1 && has(X.pc[0]) && has(X.dt))
    ok(`12 หมายเหตุ "${r12.note}" ขึ้นในช่อง Special request ของ By trip · Travel Summary · Pier Check-in · หน้ารายละเอียดใบ · ชื่อลูกค้ายังเห็นครบ`);
  else fail('12 ' + JSON.stringify({ r12, X }));
}

/* ══ 11 · รอดการเดินทางไป-กลับฐานข้อมูล (ของเดิมไม่มีคอลัมน์ โหลดหน้าใหม่แล้วหาย) ══ */
{
  const bk = await page.evaluate(s => (JSON.parse(localStorage.getItem('loveandaman_v2') || '{}').sb_bookings || []).find(x => x.id === s.id), S);
  const back = (osRepo.assembleBlob(osRepo.decomposeBlob({ sb_bookings: [bk] })).sb_bookings || [])[0] || {};
  const t0 = (bk && bk.trips || [])[0] || {}, t1 = (back.trips || [])[0] || {};
  const same = JSON.stringify(t1.upg) === JSON.stringify(t0.upg);
  const upB = (back.upgrades || [])[0] || {};
  if (t0.upg && t0.routeId === S.to && same && t1.routeId === S.to && upB.sellPrice === 500 && upB.id === t0.upg.upgId) ok('11 บันทึกลงฐานข้อมูลแล้วโหลดกลับ · เส้นทางปลายทาง ที่มา เหตุผล ยอด และรายการเก็บเพิ่ม กลับมาครบ');
  else fail('11 ' + JSON.stringify({ saved: t0.upg, back: t1.upg, r0: t0.routeId, r1: t1.routeId, upB }));
}

/* ══ 7 · แก้ใบ ══ */
dlg.length = 0;
const e7 = await page.evaluate(async s => { bkV2EditBooking(s.id); await new Promise(z => setTimeout(z, 400));
  const d = _bkV2.newBooking, q = Math.round(bkV2CalcQuote().grandTotal), drift = d._rtKeep ? d._rtKeep.drift : null, routeInForm = d.trips[0].routeId;
  d.notes = (d.notes || '') + ' upg-edit'; bkV2SubmitBooking(); await new Promise(z => setTimeout(z, 700));
  const b = SB_BOOKINGS.find(x => x.id === s.id), t = b.trips[0];
  return { q, drift, routeInForm, saved: !_bkV2.newBooking, total: Math.round(b.total), route: t.routeId, upg: !!t.upg && t.upg.fromRouteId === s.from, note: /upg-edit/.test(b.notes || '') }; }, S);
if (e7.q === S.total && e7.q !== S.destQuote && !e7.drift && e7.routeInForm === S.to && e7.saved && e7.note && e7.total === S.total && e7.route === S.to && e7.upg)
  ok(`7 เปิดแก้ใบ · ราคาคิดได้ ฿${e7.q.toLocaleString()} เท่าที่จอง (ถ้าคิดตามปลายทางจะเป็น ฿${S.destQuote.toLocaleString()}) · บันทึกแล้วยอดเท่าเดิม ยังอยู่ปลายทาง`);
else fail('7 ' + JSON.stringify({ e7, total: S.total, destQuote: S.destQuote, dlg: dlg.slice(0, 3) }));
await page.evaluate(async s => { _bkV2.detailId = null; _bkV2.filterDate = s.date; _bkV2.filterRoute = null; _bkV2.boatAssignMode = true; bkV2SwitchTab('bytrip'); await new Promise(z => setTimeout(z, 600)); }, S);

/* ══ 9 · ย้อนกลับ (ทำก่อนข้อ 8 เพื่อใช้ใบเดิมทดสอบปลายทางเต็ม) ══ */
dlg.length = 0; await clickUp(); await page.waitForTimeout(600);
const a9 = await st(), r9 = await row();
if (dlg.length === 1 && dlg[0].type === 'confirm' && /removed/.test(dlg[0].msg) && a9.route === S.from && !a9.upg && !a9.ups.length && a9.freeA === S.usedA && a9.freeB === S.usedB && a9.total === S.total && r9.band === S.fromNm && !r9.tag)
  ok('9 กด ⤴ ซ้ำ · กลับเส้นทางเดิม · รายการเก็บเพิ่มที่ยังไม่เก็บถูกลบ · ที่นั่งกลับเหมือนก่อนย้าย');
else fail('9 ' + JSON.stringify({ dlg, a9, r9 }));

/* ══ 8 · ปลายทางว่างไม่พอ ══ */
dlg.length = 0;
const a8 = await page.evaluate(async s => { const boats = baBoatsForRoute(s.date, s.to), keep = boats.map(x => [x.boat, x.boat.cap, x.boat.licensePax]);
  const used = boats.reduce((n, x) => n + x.boat.cap, 0) - getAllotment(s.to, s.date, null).seatsAvailable;
  boats.forEach((x, i) => { x.boat.cap = i === 0 ? used : 0; x.boat.licensePax = x.boat.cap; });
  const free = getAllotment(s.to, s.date, null).seatsAvailable;
  bkV2BoatUpgrade(s.id, s.from, s.date); await new Promise(z => setTimeout(z, 200));
  const lab = document.querySelector('#bkv2-upg-ov [data-upg-to="' + s.to + '"]'), dis = lab ? lab.querySelector('input').disabled : null;
  _bkUpg.to = s.to; _bkUpg.reason = 'x'; bkV2UpgApply(); await new Promise(z => setTimeout(z, 200));
  const b = SB_BOOKINGS.find(x => x.id === s.id), route = b.trips[0].routeId; bkV2UpgModalClose();
  keep.forEach(k => { k[0].cap = k[1]; k[0].licensePax = k[2]; });
  return { free, dis, route }; }, S);
if (a8.free < S.pax && a8.dis === true && a8.route === S.from && dlg.length === 1 && /Not enough free seats/.test(dlg[0].msg)) ok(`8 ปลายทางว่าง ${a8.free} ที่ (ต้องใช้ ${S.pax}) · เลือกไม่ได้ และย้ายไม่ได้`);
else fail('8 ' + JSON.stringify({ a8, dlg }));

/* ══ 10 · ไม่เก็บเพิ่ม ══ */
dlg.length = 0;
await page.evaluate(async s => { bkV2BoatUpgrade(s.id, s.from, s.date); await new Promise(z => setTimeout(z, 150)); _bkUpg.to = s.to; _bkUpg.reason = 'free move'; _bkUpg.charge = ''; bkV2UpgApply(); await new Promise(z => setTimeout(z, 500)); }, S);
const a10 = await st();
const allMsg = dlg.map(d => d.msg).join('');
const e1 = errors.filter(e => !/Failed to load resource/.test(e));
if (a10.route === S.to && a10.upg && a10.upg.charge === 0 && !a10.upg.upgId && !a10.ups.length && a10.upDue === 0 && !e1.length) ok('10 ย้ายแบบไม่เก็บเพิ่ม · ไม่มีรายการอัปเกรด · ไม่มี error บนหน้า');
else fail('10 ' + JSON.stringify({ a10, e1: e1.slice(0, 3), dlg }));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
