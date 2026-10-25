// §flSplitPax · บันทึกประจำวันเรือ (Fleet · Daily report) · ใบที่แยกลงหลายลำนับคนตามก้อนของแต่ละลำ
//
// ที่มา (2026-10-24) · owner ส่งภาพ Visit Panwa: Hermetis 121 คน (เรือ 65 ที่) · Achilles "ไม่ออก" · "อันนี้บัคมาจากการแยกลงเรือไหม"
//   ใช่ · flBoatBookingsFor นับทั้งใบให้ลำหลัก (ops.boatId = ก้อนแรกของ split) ลำที่สองได้ 0
// ข้อมูลทดสอบ: วัน D เรือ X/Y วิ่ง r10 · ใบใหญ่ 120 คนแยก X 60 / Y 60 · ใบเล็ก 5 คนบน X
// กัน
//   1 flBoatBookingsFor: X = 65 (60 + 5) · Y = 60 · รวม = คนจริง 125 (ไม่นับซ้ำ)
//   2 หน้าบันทึกประจำวัน: แถว X ขึ้น 65 · แถว Y ขึ้น 60 (ไม่ใช่ "ไม่ออก") · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1000 });
await page.waitForTimeout(500);
const S = await page.evaluate(() => {
  const T = new Date(); T.setDate(T.getDate() + 13); const D = bookingV2LocalYMD(T), R = 'r10';
  const cand = BOATS.filter(b => b && b.ownership !== 'charter' && !b.retired && getCurStatus(b, D).s === 'available');
  cand.slice(0, 2).forEach((b, i) => { if (!FL_ENGINES.some(e => e.boatId === b.id)) FL_ENGINES.push({ id: 'zzeng' + i, boatId: b.id, pos: 'port', name: 'test' }); });   /* หน้านี้แสดงเฉพาะเรือที่มีเครื่อง */
  const X = cand[0], Y = cand[1]; if (!X || !Y) return { err: 'ไม่มีเรือบริษัทว่าง 2 ลำ' };
  TRIPS[D] = {}; TRIPS[D][X.id] = { route: R }; TRIPS[D][Y.id] = { route: R };
  for (let i = SB_BOOKINGS.length - 1; i >= 0; i--) if ((SB_BOOKINGS[i].trips || []).some(t => t.date === D)) SB_BOOKINGS.splice(i, 1);
  const src = SB_BOOKINGS.filter(b => b.status === 'confirmed' && (b.trips || []).length === 1 && b.trips[0].pax && b.schemaVer === 2);
  const mk = (id, ad, ops) => { const b = JSON.parse(JSON.stringify(src[0])); b.id = id; const t = b.trips[0]; t.date = D; t.routeId = R; t.bookingMode = 'seat';
    t.pax = { ad_th: 0, chd_th: 0, inf_th: 0, foc_th: 0, ad_fr: ad, chd_fr: 0, inf_fr: 0, foc_fr: 0, foc: 0 }; delete t.ops; b.ops = ops; b.status = 'confirmed'; SB_BOOKINGS.push(b); return b; };
  mk('ZZFS1', 120, { boatId: X.id, boatSplits: [{ pax: 60, ad: 60, chd: 0, inf: 0, foc: 0, boatId: X.id }, { pax: 60, ad: 60, chd: 0, inf: 0, foc: 0, boatId: Y.id }] });
  mk('ZZFS2', 5, { boatId: X.id });
  return { D, X: X.id, Y: Y.id, xn: X.name, yn: Y.name, a: flBoatBookingsFor(X.id, D).pax, b: flBoatBookingsFor(Y.id, D).pax };
});
if (S.err) { fail(S.err); await close(); process.exit(1); }
if (S.a === 65 && S.b === 60) ok('1 flBoatBookingsFor: ' + S.xn + ' 65 (ก้อน 60 + ใบเล็ก 5) · ' + S.yn + ' 60 · รวม 125 = คนจริง');
else fail('1 ' + JSON.stringify(S));

await goView(page, 'fl-dailyreport', 900);
const R2 = await page.evaluate((S) => {
  const el = document.getElementById('fl-dr-date'); el.value = S.D; flRenderDR();
  const row = nm => { const td = [...document.querySelectorAll('td.fs-bt')].find(t => t.textContent.includes(nm)); return td ? td.parentElement.textContent.replace(/\s+/g, ' ') : null; };
  return { x: row(S.xn), y: row(S.yn) };
}, S);
const has = (t, n) => t && new RegExp('(^|\\D)' + n + '(\\D|$)').test(t);
if (has(R2.x, 65) && has(R2.y, 60) && !/ไม่ออก/.test(R2.y || '') && errors.length === 0) ok('2 หน้าบันทึกประจำวัน: ' + S.xn + ' 65 · ' + S.yn + ' 60 (ไม่ขึ้น "ไม่ออก") · ไม่มี error');
else fail('2 ' + JSON.stringify({ R2, errors: errors.slice(0, 2) }));
await close();
if (bad) { console.log(bad + ' FAILED'); process.exit(1); } console.log('ALL OK');
