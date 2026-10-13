// §rtKeep · แก้ไขใบเก่า ยึดเรทเดิมตอนจอง · จะใช้เรทใหม่ต้องเลือกเอง · ราคาในชุดถูกแก้ต้องเตือน
//
// ที่มา (2026-10-03) · ผู้ใช้ถามว่า "จองไปแล้วก็ยึดเรทเดิม เปลี่ยนราคาทีหลังไม่กระทบใบเก่า ถูกไหม"
//   ถูกแค่ครึ่งเดียว · ใบที่ไม่มีใครแตะไม่เปลี่ยน แต่เปิดแก้ไขแล้วกดบันทึกเมื่อไหร่ ระบบคิดราคาใหม่
//   จากชุดปัจจุบันของเอเยนต์เงียบ ๆ ทุกครั้ง · ผู้ใช้ขอให้เตือน และเลือกว่ายึดเรทเดิมเป็นค่าเริ่มต้น
//
// กันเก้าอย่าง
//   1 ใบที่ชุดราคาไม่เปลี่ยน · เปิดแก้ไขแล้วไม่มีป้ายอะไรเพิ่ม ยอดเท่าที่บันทึกไว้
//   2 เอเยนต์ถูกย้ายไปชุดใหม่ที่แพงกว่า · เปิดใบเก่าแล้วยอดยังเท่าเดิม (ยึดเรทเดิม) และมีป้ายบอกทั้งสองชุด
//   3 ยึดเรทเดิม · add-on ก็มาจากชุดเดิม (ของใหม่ที่ชุดเดิมไม่มี ยังไม่ขึ้น)
//   4 กด "เปลี่ยนไปใช้เรทใหม่" · ยอดเปลี่ยนตามชุดใหม่ add-on ของชุดใหม่ขึ้น · กดกลับได้ ยอดกลับมาเท่าเดิม
//   5 บันทึกแบบยึดเรทเดิม (แก้แค่หมายเหตุ) · ยอด ชุดราคาของใบ และชุดราคาของทริป ไม่เปลี่ยน
//   6 บันทึกแบบเรทใหม่ · ยอดใหม่ลงใบ ใบจำชุดใหม่ · เปิดอีกครั้งไม่มีป้ายแล้ว
//   7 แก้ตัวเลขในชุดเดิม (ไม่ได้ย้ายชุด) · เปิดใบเก่าแล้วมีป้ายเตือน ยอดเดิมเทียบยอดใหม่
//   8 กดบันทึกใบนั้น · ถามยืนยันก่อน · ไม่ยืนยัน = ไม่บันทึก ยอดเดิมอยู่ครบ · ยืนยัน = ได้ยอดใหม่
//   9 ทริปที่เพิ่มใหม่ตอนแก้ไข คิดจากชุดปัจจุบัน (ไม่มีเรทเดิมให้ยึด) · _rtKeep ไม่หลุดลงที่เก็บ · ไม่มี error
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1100 });
const dialogs = []; let answer = true;
page.on('dialog', async d => { dialogs.push(d.message()); try { if (answer) await d.accept(); else await d.dismiss(); } catch (_) {} });
await goView(page, 'booking', 900);

/* ══ 0 · ใบเอเยนต์แบบที่นั่ง ทริปเดียว · เปิดแก้ไขแล้วยอดตรงกับที่บันทึกไว้ และชุดราคาไม่ต่างจากปัจจุบัน ══ */
const S = await page.evaluate(() => {
  for (const f of ['bkV2RtKeepInit', 'bkV2RtKeptFor', 'bkV2RtKeepUse', 'bkV2RtKeepNote', 'bkV2AddOnRT'])
    if (typeof window[f] !== 'function') return { err: 'missing ' + f };
  const _r = window.bkV2Render, _l = window.bkV2SetEditLock; window.bkV2Render = () => {}; window.bkV2SetEditLock = () => {};
  let hit = null;
  for (const b of SB_BOOKINGS) {
    if (b.schemaVer !== 2 || b.status !== 'confirmed' || !b.agentId || !(Number(b.total) > 0)) continue;
    if ((b.trips || []).length !== 1 || b.trips[0].bookingMode === 'charter' || b.trips[0].ovn) continue;
    if ((b.addOns || []).length || (b.adjustments || []).length) continue;
    const ag = sbGetAgent(b.agentId); if (!ag || !ag.rateTypeId) continue;
    if (typeof laSeasonsOf === 'function' && laSeasonsOf(ag).length) continue;
    const rt = SB_RATE_TYPES.find(r => r.id === ag.rateTypeId); if (!rt) continue;
    if (rt.addOns && rt.addOns.longtail) continue;
    try { bkV2EditBooking(b.id); } catch (_) { continue; }
    const K = _bkV2.newBooking._rtKeep, P = K ? bkV2RtKeepPair() : null;
    if (K && !K.drift && P && P.kept && !P.differ && P.kept.id === rt.id && Math.round(bkV2CalcQuote().grandTotal) === Math.round(b.total)) {
      hit = { id: b.id, agentId: ag.id, rtOld: rt.id, total: Math.round(b.total), rid: b.trips[0].routeId, date: b.trips[0].date, zone: b.trips[0].zone }; break; }
  }
  _bkV2.newBooking = null; _bkV2.editingId = null; window.bkV2Render = _r; window.bkV2SetEditLock = _l;
  if (!hit) return { err: 'no plain seat booking whose saved total matches its rate type' };
  /* ชุดใหม่ = สำเนาชุดเดิม · ทุกราคาที่นั่งของเส้นทางนี้ +100 · มี Longtail Charter */
  const o = SB_RATE_TYPES.find(r => r.id === hit.rtOld), n = JSON.parse(JSON.stringify(o));
  n.id = 'rt_t_rtkeep'; n.code = 'T-RTKEEP'; n.name = 'T-RTKEEP new';
  Object.values(n.seatRates[hit.rid] || {}).forEach(z => Object.keys(z).forEach(k => { if (+z[k] > 0) z[k] = +z[k] + 100; }));
  n.addOns = n.addOns || {}; n.addOns.longtail = { applies: [hit.rid], byRoute: { [hit.rid]: { join: { adult: 0, child: 0 }, charter: { price: 1400, capacity: 8 } } } };
  SB_RATE_TYPES.push(n);
  return hit;
});
if (S.err) { fail(S.err); await close(); process.exit(1); }

const openEdit = () => page.evaluate(async p => { bkV2EditBooking(p.id); await new Promise(z => setTimeout(z, 500));
  const d = _bkV2.newBooking, el = document.querySelector('.bkv2-nb-rt-preview');
  const sec = document.createElement('div'); sec.innerHTML = bkV2RenderAddOnsSection();
  return { total: Math.round(bkV2CalcQuote().grandTotal), mode: d._rtKeep ? d._rtKeep.mode : null, drift: d._rtKeep ? d._rtKeep.drift : null,
    keepNote: (el && el.querySelector('[data-rtkeep]')) ? el.querySelector('[data-rtkeep]').getAttribute('data-rtkeep') : '',
    driftNote: !!(el && el.querySelector('[data-rtdrift]')), banner: el ? el.textContent.replace(/\s+/g, ' ').trim() : '',
    lt: /Longtail Charter/.test(sec.textContent), ref: d.rateTypeRef }; }, S);
const state = () => page.evaluate(p => { const d = _bkV2.newBooking, el = document.querySelector('.bkv2-nb-rt-preview');
  const sec = document.createElement('div'); sec.innerHTML = bkV2RenderAddOnsSection();
  return { total: Math.round(bkV2CalcQuote().grandTotal), mode: d._rtKeep ? d._rtKeep.mode : null,
    keepNote: (el && el.querySelector('[data-rtkeep]')) ? el.querySelector('[data-rtkeep]').getAttribute('data-rtkeep') : '',
    banner: el ? el.textContent.replace(/\s+/g, ' ').trim() : '', lt: /Longtail Charter/.test(sec.textContent), ref: d.rateTypeRef }; }, S);
const stored = () => page.evaluate(p => { const b = SB_BOOKINGS.find(x => x.id === p.id);
  const D = JSON.parse(localStorage.getItem('loveandaman_v2') || '{}'); const sb = (D.sb_bookings || []).find(x => x.id === p.id) || {};
  return { total: Math.round(b.total), ref: b.rateTypeRef, rtRef: (b.trips[0] || {}).rtRef || null, notes: b.notes || '', nTrips: b.trips.length,
    leak: ('_rtKeep' in b) || ('_rtKeep' in sb), editing: !!_bkV2.editingId }; }, S);
const cancelEdit = () => page.evaluate(() => { _bkV2.newBooking = null; _bkV2.editingId = null; bkV2Render(); });

/* ══ 1 ══ */
let e = await openEdit();
if (e.mode === 'keep' && !e.keepNote && !e.driftNote && e.total === S.total) ok('1 ชุดราคาไม่เปลี่ยน · เปิดแก้ไขแล้วไม่มีป้ายเพิ่ม ยอด ฿' + S.total.toLocaleString() + ' เท่าที่บันทึกไว้');
else fail('1 ' + JSON.stringify(e));
await cancelEdit();

/* ══ 2–3 · ย้ายเอเยนต์ไปชุดใหม่ ══ */
await page.evaluate(p => { sbGetAgent(p.agentId).rateTypeId = 'rt_t_rtkeep'; }, S);
e = await openEdit();
if (e.mode === 'keep' && e.keepNote === 'keep' && e.total === S.total && /T-RTKEEP/.test(e.banner) && e.ref === S.rtOld)
  ok('2 เอเยนต์ย้ายไปชุดใหม่ (+100/คน) · เปิดใบเก่ายอดยัง ฿' + S.total.toLocaleString() + ' · ป้ายบอกว่ายึดเรทเดิมและเอเยนต์ใช้ชุด T-RTKEEP อยู่');
else fail('2 ' + JSON.stringify(e));
if (!e.lt) ok('3 ยึดเรทเดิม · Longtail Charter ของชุดใหม่ยังไม่ขึ้นให้เลือก');
else fail('3 add-on of the new rate type shown while keeping the old rate');

/* ══ 4 · สลับ ══ */
await page.click('.bkv2-nb-rt-preview button[data-rtuse="now"]'); await page.waitForTimeout(300);
const n4 = await state();
await page.click('.bkv2-nb-rt-preview button[data-rtuse="keep"]'); await page.waitForTimeout(300);
const k4 = await state();
if (n4.mode === 'now' && n4.keepNote === 'now' && n4.total > S.total && n4.lt && n4.ref === 'rt_t_rtkeep'
    && k4.mode === 'keep' && k4.total === S.total && !k4.lt && k4.ref === S.rtOld)
  ok('4 กดเปลี่ยนไปใช้เรทใหม่ · ยอดเป็น ฿' + n4.total.toLocaleString() + ' และ Longtail Charter ขึ้น · กดกลับ ยอดกลับเป็น ฿' + k4.total.toLocaleString());
else fail('4 ' + JSON.stringify({ n4, k4 }));

/* ══ 5 · บันทึกแบบยึดเรทเดิม ══ */
const before5 = await stored();
await page.evaluate(() => { _bkV2.newBooking.notes = 't-rtkeep note'; bkV2SubmitBooking(); });
await page.waitForTimeout(500);
const s5 = await stored();
if (!s5.editing && s5.notes === 't-rtkeep note' && s5.total === S.total && s5.ref === S.rtOld && (s5.rtRef === S.rtOld) && !s5.leak)
  ok('5 บันทึกแบบยึดเรทเดิม (แก้แค่หมายเหตุ) · ยอด ฿' + s5.total.toLocaleString() + ' ชุดของใบและของทริปยังเป็นชุดเดิม');
else fail('5 ' + JSON.stringify({ before5, s5, dialogs: dialogs.slice(-3) }));

/* ══ 6 · บันทึกแบบเรทใหม่ ══ */
e = await openEdit();
await page.click('.bkv2-nb-rt-preview button[data-rtuse="now"]'); await page.waitForTimeout(300);
const want6 = (await state()).total;
await page.evaluate(() => { bkV2SubmitBooking(); }); await page.waitForTimeout(500);
const s6 = await stored();
const e6 = await openEdit(); await cancelEdit();
if (!s6.editing && s6.total === want6 && want6 > S.total && s6.ref === 'rt_t_rtkeep' && s6.rtRef === 'rt_t_rtkeep' && !e6.keepNote && !e6.driftNote && e6.total === want6)
  ok('6 บันทึกแบบเรทใหม่ · ยอด ฿' + s6.total.toLocaleString() + ' ลงใบ ใบจำชุดใหม่ · เปิดอีกครั้งไม่มีป้าย');
else fail('6 ' + JSON.stringify({ want6, s6, e6, dialogs: dialogs.slice(-3) }));

/* ══ 7 · แก้ตัวเลขในชุดเดิม ══ */
await page.evaluate(p => { const n = SB_RATE_TYPES.find(r => r.id === 'rt_t_rtkeep');
  Object.values(n.seatRates[p.rid] || {}).forEach(z => Object.keys(z).forEach(k => { if (+z[k] > 0) z[k] = +z[k] + 50; })); }, S);
e = await openEdit();
if (e.mode === 'keep' && !e.keepNote && e.driftNote && e.drift && Math.round(e.drift.was) === want6 && Math.round(e.drift.now) > want6
    && e.banner.indexOf(want6.toLocaleString()) >= 0 && e.banner.indexOf(Math.round(e.drift.now).toLocaleString()) >= 0)
  ok('7 แก้ราคาในชุดเดิม +50 · เปิดใบเก่ามีป้ายเตือน ยอดเดิม ฿' + want6.toLocaleString() + ' เทียบยอดใหม่ ฿' + Math.round(e.drift.now).toLocaleString());
else fail('7 ' + JSON.stringify(e));

/* ══ 8 · ถามก่อนบันทึก ══ */
const nd = dialogs.length; answer = false;
await page.evaluate(() => { bkV2SubmitBooking(); }); await page.waitForTimeout(400);
const s8a = await stored(); const asked = dialogs.slice(nd).join(' | ');
answer = true;
await page.evaluate(() => { bkV2SubmitBooking(); }); await page.waitForTimeout(500);
const s8b = await stored();
if (/Saved total: THB/.test(asked) && /[^\x00-\x7F]/.test(asked) === false && s8a.editing && s8a.total === want6 && !s8b.editing && s8b.total === Math.round(e.drift.now))
  ok('8 กดบันทึก · ถามยืนยันก่อน · ไม่ยืนยัน ยอดเดิมอยู่ครบ · ยืนยันแล้วได้ยอดใหม่ ฿' + s8b.total.toLocaleString());
else fail('8 ' + JSON.stringify({ asked, s8a, s8b }));

/* ══ 9 · ทริปใหม่ตอนแก้ไข ══ */
const R9 = await page.evaluate(p => {
  sbGetAgent(p.agentId).rateTypeId = p.rtOld;                 /* เอเยนต์กลับไปชุดเดิม · ใบจำชุด T-RTKEEP */
  const _r = window.bkV2Render, _l = window.bkV2SetEditLock; window.bkV2Render = () => {}; window.bkV2SetEditLock = () => {};
  bkV2EditBooking(p.id);
  const d = _bkV2.newBooking, t0 = d.trips[0];
  const tNew = JSON.parse(JSON.stringify(t0)); tNew.date = '2026-12-20'; delete tNew.rtRef; delete tNew.ops;
  const keptOld = (bkV2GetRTForTrip(t0) || {}).id, forNew = (bkV2GetRTForTrip(tNew) || {}).id, mode = d._rtKeep.mode;
  _bkV2.newBooking = null; _bkV2.editingId = null; window.bkV2Render = _r; window.bkV2SetEditLock = _l;
  return { keptOld, forNew, mode };
}, S);
const s9 = await stored();
const realErr = errors.filter(x => !/Failed to load resource/.test(x));
if (R9.mode === 'keep' && R9.keptOld === 'rt_t_rtkeep' && R9.forNew === S.rtOld && !s9.leak && !realErr.length)
  ok('9 ทริปเดิมยึดชุดของใบ · ทริปที่เพิ่มใหม่คิดจากชุดปัจจุบันของเอเยนต์ · _rtKeep ไม่หลุดลงที่เก็บ · ไม่มี error');
else fail('9 ' + JSON.stringify({ R9, leak: s9.leak, realErr: realErr.slice(0, 2) }));

await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
