// §aoRT · add-on ในฟอร์มจองต้องมาจากชุดราคาเดียวกับที่ใช้คิดราคาทริป
//
// ที่มา (2026-10-03) · ผู้ใช้เปิดแก้ใบเหมาลำของ PEGAS แล้ว Longtail Charter ไม่ขึ้นให้เลือก
//   ทั้งที่ตั้งราคาไว้ใน Rate Type ปัจจุบันของ PEGAS แล้ว · ใบจองจำชุดเก่าไว้ที่ rateTypeRef
//   ราคาทริปอ่านชุดปัจจุบันของเอเยนต์ แต่ส่วน add-on ยังอ่านชุดเก่า
//
// กันหกอย่าง
//   1 ใบที่จำชุดเก่าไว้ · เอเยนต์ย้ายไปชุดใหม่ที่ตั้งราคา Longtail Charter · ตัวเลือกต้องขึ้น ราคาตามชุดใหม่
//   2 ติ๊กแล้วยอด add-on ในใบเสนอราคาเท่าราคาของชุดใหม่
//   3 เหมารถ (Private Van) ก็ใช้ราคาของชุดใหม่
//   4 ป้ายชุดราคาบนฟอร์มบอกว่าใบนี้คิดจากชุดปัจจุบันของเอเยนต์ (ไม่ชี้ชุดเก่าเฉย ๆ)
//   5 เอเยนต์ยังอยู่ชุดเดิม · ทุกอย่างเหมือนเดิม ไม่มีบรรทัดบอกเพิ่ม
//   6 ใบที่ไม่มีเอเยนต์/ยังไม่มีทริป · ไม่พัง ถอยไปใช้ชุดของใบ · ไม่มี error บนหน้า
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1100 });
page.on('dialog', async d => { try { await d.accept(); } catch (_) {} });
await goView(page, 'booking', 900);

const R = await page.evaluate(async () => {
  if (typeof bkV2AddOnRT !== 'function') return { err: 'bkV2AddOnRT missing' };
  /* เอเยนต์ที่ชุดราคาของตัวเองไม่มี Longtail แต่มีเหมารถของเส้นทางหนึ่ง */
  let ag = null, rtOld = null, rid = '';
  for (const a of (SB_AGENTS || [])) {
    const rt = (SB_RATE_TYPES || []).find(r => r.id === a.rateTypeId); if (!rt) continue;
    if (rt.addOns && rt.addOns.longtail) continue;
    const pt = (rt.addOns && rt.addOns.privateTransfer) || {};
    const r = Object.keys(pt).find(k => pt[k] && typeof pt[k] === 'object' && pt[k].PK && pt[k].PK.van > 0 && (ROUTES || []).some(x => x.id === k));
    if (!r) continue;
    if (typeof laSeasonsOf === 'function' && laSeasonsOf(a).length) continue;
    ag = a; rtOld = rt; rid = r; break;
  }
  if (!ag) return { err: 'no agent whose rate type has private transfer but no longtail' };
  /* ชุดใหม่ = สำเนาของชุดเดิม + ราคา Longtail Charter + ราคาเหมารถคนละตัวเลข */
  const rtNew = JSON.parse(JSON.stringify(rtOld));
  rtNew.id = 'rt_t_aort'; rtNew.code = 'T-AORT'; rtNew.name = 'T-AORT current';
  rtNew.addOns.longtail = { applies: [rid], byRoute: { [rid]: { join: { adult: 0, child: 0 }, charter: { price: 1400, capacity: 8 } } } };
  rtNew.addOns.privateTransfer[rid].PK.van = rtOld.addOns.privateTransfer[rid].PK.van + 111;
  SB_RATE_TYPES.push(rtNew);
  const txt = h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent.replace(/\s+/g, ' ').trim(); };
  const draft = () => ({ agentId: ag.id, rateTypeRef: rtOld.id, addOns: [], priceMode: 'rate', leadPax: 'T-AORT',
    trips: [{ routeId: rid, date: '2026-10-04', bookingMode: 'charter', pax: { ad_fr: 4 }, pickupZone: 'NT' }] });
  const vanType = 'transfer-' + rid + '-PK-van';

  /* ── เอเยนต์ยังอยู่ชุดเดิม ── */
  _bkV2.newBooking = draft();
  const same = { sec: txt(bkV2RenderAddOnsSection()), rt: (bkV2AddOnRT() || {}).id, van: bkV2AddOnInfo(vanType).total };

  /* ── เอเยนต์ย้ายไปชุดใหม่ · ใบยังจำชุดเก่า ── */
  ag.rateTypeId = rtNew.id;
  _bkV2.newBooking = draft();
  const moved = { sec: txt(bkV2RenderAddOnsSection()), rt: (bkV2AddOnRT() || {}).id, ref: bkV2GetRT().id,
    lt: bkV2AddOnInfo('longtail-charter').total, van: bkV2AddOnInfo(vanType).total, has: bkV2HasAvailableAddOns() };
  _bkV2.newBooking.addOns.push({ type: 'longtail-charter', qty: 1 });
  moved.quote = bkV2CalcQuote().totalAddOn;

  /* ── ป้ายบนฟอร์มจริง ── */
  let banner = '', bannerSame = '';
  try {
    _bkV2.tab = 'new'; bkV2Render(); await new Promise(z => setTimeout(z, 400));
    const el = document.querySelector('.bkv2-nb-rt-preview'); banner = el ? el.textContent.replace(/\s+/g, ' ').trim() : 'NO-BANNER';
    ag.rateTypeId = rtOld.id; bkV2Render(); await new Promise(z => setTimeout(z, 300));
    const el2 = document.querySelector('.bkv2-nb-rt-preview'); bannerSame = el2 ? (el2.querySelector('.bkv2-rtnow') ? 'HAS-NOTE' : 'no-note') : 'NO-BANNER';
    ag.rateTypeId = rtNew.id;
  } catch (e) { banner = 'ERR ' + (e && e.message); }

  /* ── ไม่มีเอเยนต์ / ยังไม่มีทริป ── */
  let edge = '';
  try {
    _bkV2.newBooking = { agentId: '', rateTypeRef: rtOld.id, addOns: [], trips: [] };
    const a1 = (bkV2AddOnRT() || {}).id;
    _bkV2.newBooking = { agentId: ag.id, rateTypeRef: rtOld.id, addOns: [], trips: [{ routeId: '', date: '', pax: {} }] };
    const a2 = (bkV2AddOnRT() || {}).id; bkV2RenderAddOnsSection(); bkV2HasAvailableAddOns();
    edge = a1 + '|' + a2;
  } catch (e) { edge = 'ERR ' + (e && e.message); }
  _bkV2.newBooking = null; _bkV2.tab = 'bytrip';
  return { ag: ag.name, rid, oldId: rtOld.id, oldVan: rtOld.addOns.privateTransfer[rid].PK.van, same, moved, banner, bannerSame, edge };
});
if (R.err) { fail(R.err); await close(); process.exit(1); }

if (/Longtail Charter/.test(R.moved.sec) && /1400/.test(R.moved.sec) && R.moved.rt === 'rt_t_aort' && R.moved.ref === R.oldId && R.moved.lt === 1400 && R.moved.has)
  ok('1 ใบจำชุดเก่า แต่เอเยนต์ (' + R.ag + ') อยู่ชุดใหม่ · Longtail Charter ขึ้นให้เลือก ราคา ฿1,400 ตามชุดใหม่');
else fail('1 ' + JSON.stringify(R.moved));
if (R.moved.quote === 1400) ok('2 ติ๊ก Longtail Charter แล้วยอด add-on ในใบเสนอราคา = ฿1,400');
else fail('2 quote ' + R.moved.quote);
if (R.moved.van === R.oldVan + 111) ok('3 เหมารถ Phuket ใช้ราคาของชุดใหม่ (฿' + R.moved.van + ' · ชุดเก่า ฿' + R.oldVan + ')');
else fail('3 ' + JSON.stringify({ van: R.moved.van, old: R.oldVan }));
if (/T-AORT/.test(R.banner)) ok('4 ป้ายชุดราคาบนฟอร์มบอกชุดที่ใช้คิดจริง (T-AORT)');
else fail('4 banner: ' + R.banner.slice(0, 200));
if (!/Longtail/.test(R.same.sec) && R.same.rt === R.oldId && R.same.van === R.oldVan && R.bannerSame === 'no-note')
  ok('5 เอเยนต์ยังอยู่ชุดเดิม · ตัวเลือกและราคาเหมือนเดิม ไม่มีบรรทัดบอกเพิ่ม');
else fail('5 ' + JSON.stringify({ same: R.same, bannerSame: R.bannerSame }));
const realErr = errors.filter(e => !/Failed to load resource/.test(e));
if (R.edge === R.oldId + '|' + R.oldId && !realErr.length) ok('6 ไม่มีเอเยนต์ / ยังไม่มีทริป · ถอยไปใช้ชุดของใบ ไม่พัง · ไม่มี error บนหน้า');
else fail('6 ' + JSON.stringify({ edge: R.edge, realErr: realErr.slice(0, 2) }));

await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
