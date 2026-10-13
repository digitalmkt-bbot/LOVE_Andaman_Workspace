// §agProgFill · เลือก Rate Type แล้ว Programs in Contract ตามไปเอง
//
// ที่มา (2026-09-18) · เรทคือ "มีราคาของเส้นทางไหน" · สัญญาคือ "เอเย่นต์ขายเส้นทางไหน"
//   สองอย่างนี้ต้องตรงกันโดยธรรมชาติ แต่เดิมต้องกรอกสองรอบ และรอบสองมักถูกลืม
//   ผลคือ 44 เจ้าขายเส้นที่เรทตัวเองไม่มีราคา → หน้าจองกด Save ไม่ได้ตั้งแต่วันแรกของฤดู
//
// สิ่งที่เทสนี้กัน
//   1 เติมต้องเติมครบและเติมถูกช่วงวัน (จอง = ช่วงสัญญา · เดินทาง = routeValidity ของเรท)
//   2 การ "ตัด" ต้องไม่เกิดเองเด็ดขาด ถ้าคนกด Cancel — เพราะนั่นคือลบของที่ Sales ตั้งใจใส่
//   3 ปุ่มกลุ่มต้องแยกสองกอง · เจ้าที่ยังไม่กรอกเลย (ปลอดภัย) กับเจ้าที่กรอกไว้แล้ว (เปิดสิทธิ์ขายเพิ่ม)
//     รวมสองกองเป็นปุ่มเดียวเมื่อไหร่ = เปิดสิทธิ์ขาย 52 เจ้าโดยไม่มีใครตัดสินใจ
//
// ⚠ programs / programPeriods ไม่ใช่แค่ป้าย · หน้าจองใช้เป็นขอบเขตเส้นทางที่ขายได้ (§contract-scope)
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1440, height: 1000 });
await page.evaluate(() => { const el = document.querySelector('.nav-item[data-view="agents"]'); if (el) nav(el); });
await page.waitForTimeout(1000);

/* ══ 1 · เติมตอนเปลี่ยนเรท · เติมครบ ไม่ตัดถ้าไม่ได้สั่ง ══════════════════ */
const A = await page.evaluate(() => {
  /* หาเคสที่มีทั้งของให้เติมและของที่เรทใหม่ไม่มีราคา · จะได้ทดสอบทั้งสองทางในครั้งเดียว */
  let pick = null;
  for(const a of SB_AGENTS){
    if(!(a.programs||[]).length) continue;
    for(const rt of SB_RATE_TYPES){
      if(!rt || rt.id === a.rateTypeId) continue;
      const cover = agRtRoutes(rt);
      if(!cover.length) continue;
      const add  = cover.filter(r => !a.programs.includes(r));
      const drop = a.programs.filter(r => !cover.includes(r));
      if(add.length && drop.length){ pick = {aId:a.id, rtId:rt.id}; break; }
    }
    if(pick) break;
  }
  if(!pick) return {skip:true};

  const a = sbGetAgent(pick.aId);
  const rt = getRateType(pick.rtId);
  /* ตัวคาดหวังของเทส · คำนวณเองจาก seatRates ไม่ได้เรียก agProgPlan */
  const cover = (rt.routes||[]).filter(r => rt.seatRates && rt.seatRates[r]);
  const expectCover = cover.length ? cover : Object.keys(rt.seatRates||{});
  const before = (a.programs||[]).slice();
  const expectAdd  = expectCover.filter(r => !before.includes(r));
  const expectDrop = before.filter(r => !expectCover.includes(r));

  /* กด Cancel ในกล่องยืนยัน = ไม่ตัด */
  const realConfirm = window.confirm;
  let asked = 0;
  window.confirm = () => { asked++; return false; };
  agEditOpen('ratetype', a.id);
  _agEditDraft.rateTypeId = rt.id;
  agEditSave();
  window.confirm = realConfirm;

  const a2 = sbGetAgent(pick.aId);
  const rv = rt.routeValidity || {};
  const rowOf = rid => (a2.programPeriods||[]).find(p => p.routeId === rid) || null;
  const addedRow = rowOf(expectAdd[0]);
  return {
    skip:false, code:a.code, rt:rt.code || rt.id, asked,
    beforeN: before.length,
    expectAdd: expectAdd.length, expectDrop: expectDrop.length,
    afterHasAdds: expectAdd.every(r => (a2.programs||[]).includes(r)),
    afterKeptDrops: expectDrop.every(r => (a2.programs||[]).includes(r)),
    dupFree: (a2.programs||[]).length === new Set(a2.programs||[]).size,
    addedRow: addedRow ? {
      book: addedRow.bookFrom + '→' + addedRow.bookTo,
      travel: addedRow.travelFrom + '→' + addedRow.travelTo,
      wantBook: (a2.contractStart||'') + '→' + (a2.contractEnd||''),
      wantTravel: ((rv[expectAdd[0]]||{}).from||'') + '→' + ((rv[expectAdd[0]]||{}).to||'')
    } : null,
    logged: ((a2.activity||[]).slice(-1)[0]||{}).text || ''
  };
});

if (A.skip) console.log('  ! ชุดข้อมูลนี้ไม่มีเคสที่ทั้งเติมและตัดพร้อมกัน · ข้ามข้อ 1');
else {
  console.log(A.code + ' → ' + A.rt + ' · ควรเติม ' + A.expectAdd + ' · ค้างอยู่นอกเรท ' + A.expectDrop);
  if (!A.afterHasAdds) fail('เปลี่ยนเรทแล้วโปรแกรมที่เรทมีราคาให้ยังไม่ถูกเติมครบ');
  else ok('เติมครบ ' + A.expectAdd + ' เส้นทาง');

  if (A.asked !== 1) fail('ควรถามยืนยันเรื่องตัดหนึ่งครั้ง · ถามไป ' + A.asked + ' ครั้ง');
  else ok('ถามยืนยันก่อนตัด 1 ครั้ง');

  if (!A.afterKeptDrops) fail('กด Cancel แล้วยังตัดโปรแกรมทิ้ง ' + A.expectDrop + ' เส้นทาง');
  else ok('กด Cancel แล้วไม่ตัดอะไรเลย · เก็บไว้ครบ ' + A.expectDrop);

  if (!A.dupFree) fail('programs มีเส้นทางซ้ำหลังเติม');
  else ok('programs ไม่มีเส้นทางซ้ำ');

  if (!A.addedRow) fail('แถวที่เติมหาไม่เจอใน programPeriods');
  else if (A.addedRow.book !== A.addedRow.wantBook)
    fail('ช่วงจองของแถวที่เติมไม่ใช่ช่วงสัญญา · ได้ ' + A.addedRow.book + ' ควรเป็น ' + A.addedRow.wantBook);
  else if (A.addedRow.travel !== A.addedRow.wantTravel)
    fail('ช่วงเดินทางของแถวที่เติมไม่ตรง routeValidity · ได้ ' + A.addedRow.travel + ' ควรเป็น ' + A.addedRow.wantTravel);
  else ok('แถวที่เติมได้ช่วงจอง ' + A.addedRow.book + ' · ช่วงเดินทาง ' + (A.addedRow.travel === '→' ? '(เรทไม่ได้กำหนด)' : A.addedRow.travel));

  if (!/Programs/i.test(A.logged)) fail('ไม่ได้บันทึกลง activity · ได้ "' + A.logged + '"');
  else ok('บันทึกลง activity · ' + A.logged.slice(0, 70));
}

/* ══ 2 · กด OK แล้วต้องตัดจริง ════════════════════════════════════════════ */
const B = await page.evaluate(() => {
  let pick = null;
  for(const a of SB_AGENTS){
    if(!(a.programs||[]).length) continue;
    for(const rt of SB_RATE_TYPES){
      if(!rt || rt.id === a.rateTypeId) continue;
      const cover = agRtRoutes(rt);
      if(!cover.length) continue;
      const drop = a.programs.filter(r => !cover.includes(r));
      if(drop.length){ pick = {aId:a.id, rtId:rt.id, drop:drop.slice()}; break; }
    }
    if(pick) break;
  }
  if(!pick) return {skip:true};
  const realConfirm = window.confirm;
  window.confirm = () => true;
  agEditOpen('ratetype', pick.aId);
  _agEditDraft.rateTypeId = pick.rtId;
  agEditSave();
  window.confirm = realConfirm;
  const a2 = sbGetAgent(pick.aId);
  return { skip:false, code:a2.code, drop:pick.drop.length,
    stillThere: pick.drop.filter(r => (a2.programs||[]).includes(r)).length,
    rowsGone: pick.drop.filter(r => (a2.programPeriods||[]).some(p => p.routeId === r)).length };
});
if (B.skip) console.log('  ! ไม่มีเคสให้ตัด · ข้ามข้อ 2');
else if (B.stillThere) fail('กด OK แล้วยังไม่ตัด · เหลือ ' + B.stillThere + ' จาก ' + B.drop);
else if (B.rowsGone) fail('ตัดออกจาก programs แล้วแต่แถวใน programPeriods ยังอยู่ ' + B.rowsGone + ' แถว');
else ok('กด OK แล้วตัดออกจริงทั้ง programs และ programPeriods · ' + B.drop + ' เส้นทาง');

/* ══ 3 · ปุ่มกลุ่ม · ต้องแยกสองกอง ═══════════════════════════════════════ */
const C = await page.evaluate(() => {
  const P = agProgBulkPlan();
  /* นับเองจากข้อมูลดิบ · ไม่เรียก agProgBulkPlan ซ้ำ */
  let ags = (typeof laScopeAgents === 'function') ? laScopeAgents(SB_AGENTS.slice()) : SB_AGENTS.slice();
  let wEmpty = 0, wPartial = 0;
  ags.forEach(a => {
    if(!a.rateTypeId) return;
    const rt = getRateType(a.rateTypeId); if(!rt) return;
    const declared = (rt.routes||[]).filter(r => rt.seatRates && rt.seatRates[r]);
    const cover = declared.length ? declared : Object.keys(rt.seatRates||{});
    const add = cover.filter(r => !(a.programs||[]).includes(r));
    if(!add.length) return;
    if((a.programs||[]).length) wPartial++; else wEmpty++;
  });
  return { empty:P.empty.length, partial:P.partial.length, wEmpty, wPartial,
    emptyReallyEmpty: P.empty.every(f => !(f.a.programs||[]).length),
    partialReallyHas: P.partial.every(f => (f.a.programs||[]).length > 0) };
});
if (C.empty !== C.wEmpty || C.partial !== C.wPartial)
  fail('แบ่งกองไม่ตรงกับที่นับเอง · ได้ ' + C.empty + '/' + C.partial + ' ควรเป็น ' + C.wEmpty + '/' + C.wPartial);
else ok('แบ่งสองกองถูก · ยังไม่กรอกเลย ' + C.empty + ' เจ้า · กรอกไว้บางส่วน ' + C.partial + ' เจ้า');
if (!C.emptyReallyEmpty || !C.partialReallyHas) fail('มีเจ้าอยู่ผิดกอง');
else ok('ทุกเจ้าอยู่ถูกกอง');

/* ══ 4 · กดกลุ่ม "ยังไม่กรอกเลย" ต้องไม่แตะกองอื่น และไม่ตัดอะไรเลย ═════ */
const D = await page.evaluate(() => {
  const P0 = agProgBulkPlan();
  if(!P0.empty.length) return {skip:true};
  const partialIds = P0.partial.map(f => f.a.id);
  const beforePartial = partialIds.map(id => (sbGetAgent(id).programs||[]).length);
  const beforeAll = SB_AGENTS.reduce((s,a) => s + (a.programs||[]).length, 0);
  agProgBulkOpen('empty');
  agProgBulkApply();
  const afterPartial = partialIds.map(id => (sbGetAgent(id).programs||[]).length);
  const P1 = agProgBulkPlan();
  return { skip:false, filled:P0.empty.length, added:P0.nEmpty,
    partialUntouched: JSON.stringify(beforePartial) === JSON.stringify(afterPartial),
    emptyLeft: P1.empty.length,
    grew: SB_AGENTS.reduce((s,a) => s + (a.programs||[]).length, 0) - beforeAll };
});
if (D.skip) console.log('  ! ไม่มีเจ้าที่ยังไม่กรอกเลย · ข้ามข้อ 4');
else {
  if (D.emptyLeft) fail('กดแล้วยังเหลือกองแรกอีก ' + D.emptyLeft + ' เจ้า');
  else ok('กองแรกเติมครบ ' + D.filled + ' เจ้า');
  if (D.grew !== D.added) fail('จำนวนเส้นทางที่เพิ่มจริง ' + D.grew + ' ไม่ตรงกับที่บอกไว้ ' + D.added);
  else ok('เพิ่มเส้นทางจริง ' + D.grew + ' · ตรงกับที่กล่องบอก');
  if (!D.partialUntouched) fail('กดกองแรกแล้วไปแตะกองที่สองด้วย');
  else ok('ไม่แตะกองที่กรอกไว้แล้วเลย');
}

const NOISE = /Failed to load resource|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|net::ERR_/;
const real = errors.filter(x => !NOISE.test(x));
if (real.length) { bad += real.length; real.forEach(x => console.log('  ✗ ' + x)); }
console.log('พัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
