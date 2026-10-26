// §natLead · ตั๋วอุทยาน · หัวกรุ๊ปแก้เป็นต่างชาติแล้ว แต่แถวราคายังเป็น TH → นับเป็นต่างชาติ
//
// ที่มา (2026-10-26) · owner ส่งใบ LOV-1840040 (หัวกรุ๊ป Denmark · 2 ผญ 2 เด็ก · ลค CXL) + แถว "ยกเลิก/ไม่มา" ยังขึ้น ผญ/ดญ ไทย
//   "อันเดิมใส่สัญชาติมาผิด พอแล้วแก้ รูป 2 ยังไม่เปลี่ยน" · แก้ในหน้า Booking ของเรา (เปลี่ยนแค่ leadNationality · แถวราคา TH ค้าง)
// ข้อมูลทดสอบ (วันนี้ · ลำ panwa · r10):
//   A หัวกรุ๊ป DK · แถวราคา ผญ TH 2 ดญ TH 2 · รายชื่อไม่มีใคร TH · ยกเลิกหน้างานทั้งใบ
//   B หัวกรุ๊ป TH · ผญ TH 2 (ไทยจริง ไม่ต้องเปลี่ยน)
//   C หัวกรุ๊ป US + คู่ระบุ TH · ผญ FR 1 + TH 1 (ระบุครบ ไม่ต้องเปลี่ยน)
//   E หัวกรุ๊ป DK · ผญ TH 2 · มี nat ที่คนนับเอง {ad:2} → คนนับชนะ
// กัน
//   1 bkNatTHb: A ผญ 0 ดญ 0 · B 2 · C 1 · E 2
//   2 แถวยกเลิก (pkCxPax): ผญ ตปท 2 · ดญ ตปท 2 · ไม่มีไทย
//   3 ยอดขึ้นเรือ (pcPax): ใช้ชุดสัญชาติจริง (hasNat) · ผญ ไทย 5 (B2 + C1 + E2) · ผญ ตปท 1 · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1000 });
await goView(page, 'pok-panwa', 800);
const R = await page.evaluate(() => {
  const T = new Date(), D = bkV2LocalYMD(T);
  const bid = BOATS.filter(x => x && x.id && x.pier === 'panwa')[0].id;
  TRIPS[D] = TRIPS[D] || {}; TRIPS[D][bid] = { route: 'r10', type: 'normal', booked: 0 };
  for (let i = SB_BOOKINGS.length - 1; i >= 0; i--) { const b = SB_BOOKINGS[i]; if ((b.trips || []).some(t => t.date === D) && ((b.ops || {}).boatId === bid)) SB_BOOKINGS.splice(i, 1); }
  const src = SB_BOOKINGS.filter(b => b.status === 'confirmed' && (b.trips || []).length === 1 && b.trips[0].pax && !laIsInternalFree(b));
  let n = 0;
  const Z = { ad_fr: 0, chd_fr: 0, inf_fr: 0, foc_fr: 0, ad_th: 0, chd_th: 0, inf_th: 0, foc_th: 0, foc: 0 };
  const mk = (lead, pax, pas, nat) => { const b = JSON.parse(JSON.stringify(src[n % src.length])); n++; b.id = 'ZZNL' + n; const t = b.trips[0];
    t.date = D; t.routeId = 'r10'; t.pax = Object.assign({}, Z, pax); t.lockUse = 0; delete t.seatSource; delete t.upg; delete t.names; delete t.nat; if (nat) t.nat = nat;
    b.leadNationality = lead; b.passengers = pas; b.ops = { boatId: bid }; b.status = 'confirmed'; b.pax = {};
    b.history = [{ at: new Date(T.getTime() - 3 * 86400000).toISOString(), kind: 'create', tag: 'Created', text: 'x' }];
    delete b.cancelledAt; delete b.cancellation; SB_BOOKINGS.push(b); return b; };
  const A = mk('DK', { ad_th: 2, chd_th: 2 }, [{ name: 'Thomas Lead', nationality: 'DK', type: 'AD' }, { name: 'Olivia', nationality: '', type: 'AD' }, { name: 'Vilma', nationality: '', type: 'CHD' }, { name: 'Maja', nationality: '', type: 'CHD' }]);
  A.ops.pierCheckin = { at: new Date().toISOString(), by: 't', actualPax: 0, noShow: 4, expected: 4,
    events: [{ type: 'cxl', pax: 4, paxBreak: { ad: 2, chd: 2, inf: 0, foc: 0 }, reasonCode: 'cancel_onsite', at: '08:00', by: 't', ts: new Date().toISOString() }] };
  const B = mk('TH', { ad_th: 2 }, [{ name: 'สมชาย', nationality: 'TH', type: 'AD' }]);
  const C = mk('US', { ad_fr: 1, ad_th: 1 }, [{ name: 'Devan', nationality: 'US', type: 'AD' }, { name: 'Janjira', nationality: 'TH', type: 'AD' }]);
  const E = mk('DK', { ad_th: 2 }, [], { ad: 2, chd: 0, inf: 0, foc: 0 });
  if (typeof _ckOnIx !== 'undefined') _ckOnIx.at = 0;
  const th = (b, k) => bkNatTHb(b, b.trips[0], k);
  const cx = pkCxPax(D, bid, 'panwa'), pc = pcPax(D, bid, 'panwa');
  return { th: [th(A, 'ad'), th(A, 'chd'), th(B, 'ad'), th(C, 'ad'), th(E, 'ad')], cx: cx.p8, cxTot: cx.tot, hasNat: pc.hasNat, n: pc.n };
});
if (R.th.join() === '0,0,2,1,2') ok('1 bkNatTHb: A (หัว DK แถว TH) ผญ 0 ดญ 0 · B ไทย 2 · C ระบุ TH 1 · E คนนับเอง 2');
else fail('1 ' + JSON.stringify(R.th));
const c = R.cx;
if (c.ad_fr === 2 && c.chd_fr === 2 && !c.ad_th && !c.chd_th && R.cxTot === 4) ok('2 แถวยกเลิก: ผญ ตปท 2 · ดญ ตปท 2 · ไม่มีไทย');
else fail('2 ' + JSON.stringify(R.cx));
if (R.hasNat && R.n.ad_th === 5 && R.n.ad_fr === 1 && errors.length === 0) ok('3 ยอดขึ้นเรือ: ใช้ชุดสัญชาติจริง · ผญ ไทย 5 · ผญ ตปท 1 · ไม่มี error');
else fail('3 ' + JSON.stringify({ hasNat: R.hasNat, n: R.n, errors: errors.slice(0, 3) }));
await close();
if (bad) { console.log(bad + ' FAILED'); process.exit(1); } console.log('ALL OK');
