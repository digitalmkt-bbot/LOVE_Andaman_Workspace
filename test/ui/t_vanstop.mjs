// §vanStop · จุดแวะของรถที่ไม่ใช่ booking
//
// ที่มา (2026-09-30) · ทีมปรึกษามาว่าจะมีจุดรับส่งพิเศษที่ไม่เกี่ยวกับใบจอง
//   "อาจจะมีไกด์ติดรถไปท่าเรือ หรือให้รถตู้มาเอาของที่ออฟฟิศ"
//   "ซึ่งจะต้องโชว์ที่หน้า Manifest และใบงานรถ หน้าเช็คอินรถ"
// ตกลงกันไว้สามข้อ · สองชนิด (คนกินที่นั่ง · ของไม่กิน) · แค่ส่งถึงท่าไม่ลงเรือ · กดเพิ่มเองทุกครั้ง
//
// เส้นแบ่งที่ห้ามข้ามคือ "ลูกค้า" กับ "ไม่ใช่ลูกค้า"
//   ที่นั่งรถ  · คนติดรถกินจริง ต้องนับ ไม่งั้นรถ 10 ที่โดนจัด 11 คน
//   ที่นั่งเรือ · ต้องไม่ขยับแม้แต่ที่เดียว จุดแวะไม่ได้ลงเรือ
//   ช่อง AD/CHD/INF/FOC · เป็นของลูกค้าเท่านั้น เพราะผูกกับทะเบียนอุทยานซึ่งเป็นเอกสารราชการ
//
// ⚠ เทสสร้างจุดแวะและจัดรถของตัวเอง แล้วเก็บกวาดทิ้ง · ชุดข้อมูลจริงยังไม่มีของพวกนี้
//
// เทสนี้กันสิบห้าอย่าง
//   1  จุดแวะรอดการเดินทางไป-กลับ SQL (ครบทั้งสามที่: mapping · model · CREATE TABLE)
//   2  คนกินที่นั่ง · ของไม่กิน · และยอดรวมของรถคิดถูก
//   3  ตาราง By trip · แถวจุดแวะขึ้นในกรุ๊ปรถที่ถูกคัน
//   4  ตาราง By trip · ช่อง AD/CHD/INF/FOC ของแถวจุดแวะไม่มีตัวเลขสักช่อง
//   5  ตาราง By trip · ยอดกรุ๊ปรวมคนติดรถ และแยกให้เห็นว่ามาจากไหน
//   6  ที่นั่งเรือและโควตาโปรแกรมไม่ขยับเลย (ข้อที่ห้ามพลาดที่สุด)
//   7  ใบงานรถ · มีแถวจุดแวะพร้อมเวลาและสถานที่
//   8  ใบงานรถ · ยอด AD/CHD/INF/FOC ไม่รวมจุดแวะ แต่บรรทัดสรุปบอกที่นั่งจริง
//   9  ใบงานรถ · จำนวน booking ไม่นับจุดแวะเป็นใบจอง
//   10 ใบงานรถ · จุดแวะเรียงตามเวลาปนกับลูกค้า ไม่ใช่กองไว้ท้ายใบ
//   11 หน้าเช็คอินรถ · คนมีตัวนับหัว · ของมีปุ่มติ๊กครั้งเดียว
//   12 ติ๊กแล้วบันทึกจริง และกดยกเลิกได้
//   13 จุดแวะของรถคันอื่นไม่โผล่ในใบงานของคันนี้
//   14 ลบแล้วหายจากทุกหน้า
//   5b ปุ่ม + จุดแวะ ขึ้นทั้งโหมดปกติและโหมดจัดรถ (ผู้ใช้แจ้งว่าหาไม่เจอ)
//   5c กรุ๊ปที่ยังไม่มีรถขึ้นปุ่มจางบอกเหตุผล ไม่ใช่หายไปเฉย ๆ
//   16 พื้นที่รับของจุดแวะมาจากทะเบียนพื้นที่ ไม่ใช่ข้อความพิมพ์เอง (ผู้ใช้แจ้ง)
//   17 ใบงานเรียงตามเวลา แม้ลูกค้ามีลำดับมือแล้ว (ผู้ใช้แจ้ง)
//   18 จุดแวะแยกขาไป/ขากลับ/ไป-กลับ ได้ และที่นั่งนับแยกขา (ผู้ใช้แจ้ง)
//   19 ลากสลับลำดับกรุ๊ปได้เอง ทั้งขึ้นและลง (ผู้ใช้แจ้ง)
//   20 ลากแล้วเปิดแอปใหม่ทั้งตัว ลำดับต้องไม่หาย (ผู้ใช้สั่งให้ตรวจเป็นพิเศษ)
//   15 ไม่มี error บนหน้า

import { open, goView } from './_harness.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const require = createRequire(import.meta.url);
const osRepo = require(path.join(ROOT, 'os-backend/src/mapping/os_repo.js'));

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1800, height: 1300 });
const dialogs = [];
page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
await goView(page, 'booking', 1000);

/* ══ 0 · จัดรถให้ลูกค้าสองใบ แล้วเพิ่มจุดแวะสองชนิด ═══════════════════ */
const R0 = await page.evaluate(() => {
  for (const f of ['vsSave','vsFor','vsSeats','vsSeatsOfVan','vsCheck','vsDel','bkOpsFor','bkV2VanGroupPax'])
    if (typeof window[f] !== 'function') return { err: 'ยังไม่มีฟังก์ชัน ' + f };

  // หาวัน+โปรแกรมที่มีลูกค้าโซนเดียวกันอย่างน้อยสองใบ · จะได้จัดเป็นกรุ๊ปเดียวได้
  let pick = null;
  const byKey = {};
  (SB_BOOKINGS || []).forEach(b => {
    if (typeof ckIsCxl === 'function' && ckIsCxl(b)) return;
    if (b.pickupSelf) return;
    (b.trips || []).forEach(t => {
      if (!t.date || !t.routeId || t.bookingMode === 'charter') return;
      const z = (typeof bkV2EffZone === 'function') ? bkV2EffZone(b, t) : (t.zone || b.pickupZone || '');
      if (!z || z === 'NoTransfer' || z === 'NT') return;
      const k = t.date + '|' + t.routeId + '|' + z;
      (byKey[k] = byKey[k] || []).push({ b, t, z });
    });
  });
  Object.keys(byKey).sort().some(k => { if (byKey[k].length >= 2) { pick = { k, mem: byKey[k].slice(0, 2) }; return true; } return false; });
  if (!pick) return { err: 'ชุดข้อมูลนี้ไม่มีลูกค้าโซนเดียวกันสองใบในโปรแกรมเดียว' };
  const [date, routeId, zone] = pick.k.split('|');

  const van = (typeof SB_VEHICLES !== 'undefined' ? SB_VEHICLES : (window.VEHICLES || []))
                .filter(v => v && v.id)[0];
  if (!van) return { err: 'ไม่มีรถในระบบ' };
  const van2 = (typeof SB_VEHICLES !== 'undefined' ? SB_VEHICLES : (window.VEHICLES || []))
                .filter(v => v && v.id && v.id !== van.id)[0];

  /* ใช้เลขกรุ๊ปที่ยังว่างของวันนั้น · ชุดข้อมูลจริงมีกรุ๊ป 1-19 ใช้อยู่แล้ว
     ถ้าไปทับกรุ๊ปที่มีคนอยู่ ยอดจะมีลูกค้าของคนอื่นปนเข้ามา แล้วเทสจะวัดผิด */
  const usedG = {};
  (SB_BOOKINGS || []).forEach(b => { const o = bkOpsRead(b, date);
    if (o && o.vanGroup) usedG[o.vanGroup] = 1;
    if (o && Array.isArray(o.vanSplits)) o.vanSplits.forEach(sp => { if (sp.vanGroup) usedG[sp.vanGroup] = 1; }); });
  const G = (Math.max(0, ...Object.keys(usedG).map(Number)) || 0) + 1;
  pick.mem.forEach(m => {
    const o = bkOpsFor(m.b, date);
    o.vanGroup = G; o.vanId = van.id; o.vanSeq = 0;
    if (Array.isArray(o.vanSplits)) o.vanSplits = [];
  });
  /* กรุ๊ปที่ "ยังไม่เลือกรถ" ไว้วัดข้อ 5c · ไม่มีกรุ๊ปแบบนี้ เทสข้อนั้นจะวัดของว่าง */
  const spare = (byKey[pick.k] || []).filter(m => pick.mem.indexOf(m) < 0)[0];
  if (spare) { const o = bkOpsFor(spare.b, date); o.vanGroup = G + 1; o.vanId = null;
               if (Array.isArray(o.vanSplits)) o.vanSplits = []; }
  if (typeof acctPersistBookings === 'function') acctPersistBookings();
  /* ยอดลูกค้าของกรุ๊ปวัดจากตัวเดียวกับที่หน้าจอใช้ ไม่ใช่บวกเอง
     ถ้าบวกเอง เทสจะกลายเป็นวัดสูตรของตัวเองแทนที่จะวัดของจริง */
  const cust = bkV2VanGroupPax(date, routeId, zone, G);

  // ที่นั่งเรือก่อนเพิ่มจุดแวะ
  const seatBefore = (typeof getSeatsConsumed === 'function') ? getSeatsConsumed(routeId, date) : -1;
  const alBefore = (typeof getAllotment === 'function') ? getAllotment(routeId, date) : null;

  // จุดแวะ · คนหนึ่งจุด ของหนึ่งจุด · เวลาคั่นกลางลูกค้าเพื่อวัดการเรียง
  const A = vsSave({ date, routeId, kind:'staff', label:'T-VS ไกด์ สมชาย', pax:1, time:'06:05',
    place:'ออฟฟิศ ถลาง', zone, phone:'089-111-2222', note:'ไปประจำเรือที่ท่า ไม่ลงเรือ',
    vanId: van.id, vanGroup:G });
  const B = vsSave({ date, routeId, kind:'cargo', label:'T-VS เสื้อชูชีพ 20 ตัว', pax:9, time:'06:10',
    place:'ออฟฟิศ ถลาง', zone, note:'กล่องใหญ่ 2 กล่อง', vanId: van.id, vanGroup:G });
  // จุดแวะของรถคันอื่น · ต้องไม่โผล่ในใบของคันแรก
  if (van2) vsSave({ date, routeId, kind:'staff', label:'T-VS คนของรถอื่น', pax:3, time:'06:20',
    place:'ที่อื่น', zone, vanId: van2.id, vanGroup:G });

  const seatAfter = (typeof getSeatsConsumed === 'function') ? getSeatsConsumed(routeId, date) : -2;
  const alAfter = (typeof getAllotment === 'function') ? getAllotment(routeId, date) : null;

  _bkV2.vanAssignMode = true; _bkV2.tab = 'bytrip';
  _bkV2.filterRoute = routeId; _bkV2.filterDate = date;
  bkV2Render();

  return { date, routeId, zone, vanId: van.id, vanName: van.name || van.id,
           van2: van2 ? van2.id : '', cust,
           seatBefore, seatAfter,
           alBefore: alBefore ? { used: alBefore.seatsConsumed, avail: alBefore.seatsAvailable } : null,
           alAfter:  alAfter  ? { used: alAfter.seatsConsumed,  avail: alAfter.seatsAvailable  } : null,
           grp: G, grpPax: bkV2VanGroupPax(date, routeId, zone, G),
           seatsVan: vsSeatsOfVan(date, routeId, van.id, G),
           kinds: vsFor(date, routeId).filter(s=>s.vanId===van.id).map(s=>({ kind:s.kind, seats:vsSeats(s), time:s.time })) };
});
if (R0.err) { fail(R0.err); console.log('\n✗ 1 ข้อไม่ผ่าน'); await close(); process.exit(1); }
ok('จัดรถให้ลูกค้า ' + R0.cust + ' คนเข้ากรุ๊ป 1 ของ ' + R0.vanName + ' · เพิ่มจุดแวะ คน 1 จุด ของ 1 จุด');

/* ══ 1 · รอดการเดินทางไป-กลับ SQL ═══════════════════════════════════ */
{
  const BLOB = await page.evaluate(() => JSON.parse(localStorage.getItem('loveandaman_v2') || '{}'));
  const vs = BLOB.van_stops;
  if (!vs || !Object.keys(vs).length) fail('จุดแวะไม่ได้ถูกเขียนลง blob เลย · รีเฟรชแล้วหายแน่');
  else {
    let back = null, threw = '';
    try { back = osRepo.assembleBlob(osRepo.decomposeBlob({ van_stops: vs })).van_stops; }
    catch (e) { threw = e.message; }
    if (threw) fail('decompose/assemble ล้ม · ' + threw);
    else if (JSON.stringify(back) !== JSON.stringify(vs))
      fail('จุดแวะไม่รอดการเดินทางไป-กลับ SQL · เขียนไป ' + JSON.stringify(vs).slice(0,120)
           + ' กลับมาได้ ' + String(JSON.stringify(back)).slice(0,120)
           + ' (ต้องมีครบสามที่: field_mapping.json · operation_schemas_model.json · CREATE TABLE ใน initDb)');
    else ok('จุดแวะ ' + Object.keys(vs).length + ' จุดรอดการเดินทางไป-กลับ SQL ครบทุกช่อง');
  }
}

/* ══ 2 · ที่นั่ง ════════════════════════════════════════════════════ */
{
  const st = R0.kinds.find(k => k.kind === 'staff'), cg = R0.kinds.find(k => k.kind === 'cargo');
  if (!st || !cg) fail('เตรียมเคสไม่สำเร็จ · ไม่ครบสองชนิด');
  else if (st.seats !== 1) fail('คนติดรถควรกิน 1 ที่นั่ง แต่ได้ ' + st.seats);
  else if (cg.seats !== 0)
    fail('ของไม่ควรกินที่นั่ง แต่ได้ ' + cg.seats + ' (เทสใส่ pax=9 มาให้ · ถ้าอ่าน s.pax ตรง ๆ โดยไม่ดูชนิดจะหลุดตรงนี้)');
  else if (R0.seatsVan !== 1) fail('ยอดที่นั่งของรถคันนี้ควรเป็น 1 แต่ได้ ' + R0.seatsVan);
  else ok('คนกิน 1 ที่นั่ง · ของกิน 0 แม้จะใส่ตัวเลขมา · ยอดรวมของรถ = 1');
}

/* ══ 3 · 4 · 5 · ตาราง By trip ═════════════════════════════════════ */
{
  await page.evaluate(g => { window.__TVS_G = g; }, R0.grp);
  const R = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tr.t2-vsrow')];
    const grp = [...document.querySelectorAll('tr')].find(r => new RegExp('กรุ๊ป '+window.__TVS_G+'\\b').test(r.textContent));
    const cellsOf = r => [...r.querySelectorAll('td')].map(td => td.textContent.trim());
    return {
      n: rows.length,
      labels: rows.map(r => r.textContent.replace(/\s+/g,' ').trim().slice(0, 70)),
      paxCells: rows.map(r => cellsOf(r).slice(3, 7)),
      grpTxt: grp ? grp.textContent.replace(/\s+/g,' ').trim() : '',
      hasAddBtn: !!document.querySelector('button[onclick*="vsOpen"]') };
  });
  if (R.n !== 2) fail('ตาราง By trip ควรมีแถวจุดแวะ 2 แถวในกรุ๊ปนี้ แต่เจอ ' + R.n
                      + (R.n > 2 ? ' (จุดแวะของรถคันอื่นหลุดเข้ามา)' : ''));
  else if (!R.labels.some(t => /ไกด์ สมชาย/.test(t)) || !R.labels.some(t => /เสื้อชูชีพ/.test(t)))
    fail('แถวจุดแวะขึ้นแต่ชื่อไม่ตรง · ' + JSON.stringify(R.labels));
  else ok('ตาราง By trip มีแถวจุดแวะครบสองแถวในกรุ๊ปรถที่ถูกคัน' + (R.hasAddBtn ? ' · มีปุ่ม + จุดแวะ' : ''));

  const numeric = R.paxCells.flat().filter(v => /\d/.test(v));
  if (!R.n) fail('ข้ามไม่ได้ · ไม่มีแถวจุดแวะให้ตรวจช่อง AD/CHD/INF/FOC เลย (ข้อนี้จะผ่านลอย ๆ ถ้าไม่ดัก)');
  else if (numeric.length)
    fail('ช่อง AD/CHD/INF/FOC ของแถวจุดแวะมีตัวเลข · ' + JSON.stringify(numeric)
         + ' (สี่ช่องนั้นผูกกับทะเบียนอุทยาน จุดแวะต้องไม่ไปปน)');
  else ok('ช่อง AD/CHD/INF/FOC ของแถวจุดแวะขึ้นขีดทั้งหมด ไม่มีตัวเลขสักช่อง');

  const want = R0.cust + 1;
  if (R0.grpPax !== want)
    fail('ยอดกรุ๊ปไม่รวมคนติดรถ · ลูกค้า ' + R0.cust + ' + ติดรถ 1 ควรได้ ' + want + ' แต่ bkV2VanGroupPax ให้ ' + R0.grpPax
         + ' (กติกา "ที่นั่งไม่พอ" ตอนเลือกรถอ่านค่านี้ · ไม่รวม = รถเต็มแล้วยังรับเพิ่มได้)');
  else if (!new RegExp('ลูกค้า\\s*' + R0.cust + '\\s*\\+\\s*ติดรถ\\s*1').test(R.grpTxt))
    fail('ยอดรวมถูกแล้วแต่หัวกรุ๊ปไม่บอกที่มา · คนอ่านจะงงว่าเลขมาจากไหน · "' + R.grpTxt.slice(0, 120) + '"');
  else ok('ยอดกรุ๊ป = ' + R0.grpPax + ' (ลูกค้า ' + R0.cust + ' + ติดรถ 1) · หัวกรุ๊ปบอกที่มาให้เห็น');
}

/* ══ 5b · 5c · ปุ่มเพิ่มต้องหาเจอ ═══════════════════════════════════
   ผู้ใช้แจ้ง 30 ก.ย. "เพิ่มได้ตรงไหน หาไม่เจอ" · ของเดิมขึ้นเฉพาะตอนอยู่ในโหมดจัดรถ
   และกรุ๊ปมีรถแล้ว — สองด่านซ้อนกัน เปิดหน้ามาปกติจึงไม่เห็นอะไรเลย */
{
  const R = await page.evaluate(g => {
    const look = () => ({
      active: document.querySelectorAll('button[onclick*="vsOpen"]').length,
      dim: [...document.querySelectorAll('span')]
             .filter(e => /จุดแวะ/.test(e.textContent) && /เลือกรถก่อน/.test(e.textContent)).length });
    const was = _bkV2.vanAssignMode;
    _bkV2.vanAssignMode = false; bkV2Render();
    const ro = look();
    _bkV2.vanAssignMode = true; bkV2Render();
    const vm = look();
    _bkV2.vanAssignMode = was; bkV2Render();
    return { ro, vm };
  }, R0.grp);
  if (!R.ro.active) fail('โหมดปกติ (อ่านอย่างเดียว) ไม่มีปุ่ม + จุดแวะ เลย · คนใช้จะหาไม่เจอเหมือนเดิม');
  else if (!R.vm.active) fail('โหมดจัดรถไม่มีปุ่ม + จุดแวะ');
  else ok('ปุ่ม + จุดแวะ ขึ้นทั้งสองโหมด · โหมดปกติ ' + R.ro.active + ' ปุ่ม · โหมดจัดรถ ' + R.vm.active + ' ปุ่ม');

  if (!R.ro.dim && !R.vm.dim)
    fail('กรุ๊ปที่ยังไม่มีรถไม่ขึ้นอะไรเลย · ควรขึ้นปุ่มจางบอกว่า "เลือกรถก่อน" แทนที่จะหายไปเฉย ๆ');
  else ok('กรุ๊ปที่ยังไม่มีรถขึ้นปุ่มจางพร้อมเหตุผล "เลือกรถก่อน" · ไม่ใช่ไม่มีอะไรให้เห็น');
}

/* ══ 6 · ที่นั่งเรือต้องไม่ขยับ ═════════════════════════════════════ */
{
  if (R0.seatBefore < 0 || R0.seatAfter < 0) fail('อ่านที่นั่งเรือไม่ได้ · ข้ามการวัด');
  else if (R0.seatBefore !== R0.seatAfter)
    fail('เพิ่มจุดแวะแล้วที่นั่งเรือขยับ · ' + R0.seatBefore + ' → ' + R0.seatAfter
         + ' (จุดแวะไม่ได้ลงเรือ · ตัวเลขนี้ไปโผล่ในใบอุทยานและโควตาที่ขายได้)');
  else if (R0.alBefore && R0.alAfter && (R0.alBefore.used !== R0.alAfter.used || R0.alBefore.avail !== R0.alAfter.avail))
    fail('โควตาโปรแกรมขยับ · ใช้ไป ' + R0.alBefore.used + '→' + R0.alAfter.used
         + ' ว่าง ' + R0.alBefore.avail + '→' + R0.alAfter.avail);
  else ok('ที่นั่งเรือและโควตาโปรแกรมไม่ขยับเลย · ใช้ไป ' + R0.seatAfter + ' ที่เท่าเดิม');
}

/* ══ 7 · 8 · 9 · 10 · 13 · ใบงานรถ ═════════════════════════════════ */
{
  const R = await page.evaluate(([date, routeId, vanId]) => {
    if (typeof vanJobsOrderInner !== 'function') return { err: 'ไม่มี vanJobsOrderInner' };
    const html = vanJobsOrderInner(date, vanId, routeId, null, 0);
    const doc = new DOMParser().parseFromString('<table>' + html.replace(/^[\s\S]*?<table/, '<table') + '</table>', 'text/html');
    const host = document.createElement('div'); host.innerHTML = html;
    const tbl = host.querySelector('table');
    const body = tbl ? [...tbl.querySelectorAll('tbody tr')] : [];
    const foot = tbl ? (tbl.querySelector('tfoot tr') || null) : null;
    const rowTxt = body.map(r => r.textContent.replace(/\s+/g, ' ').trim());
    const cells = body.map(r => [...r.querySelectorAll('td')].map(td => td.textContent.trim()));
    return {
      rows: rowTxt,
      order: cells.map(c => c[7] || ''),           // ช่องเวลา
      stopIdx: rowTxt.map((t,i)=>/T-VS/.test(t)?i:-1).filter(i=>i>=0),
      otherVan: rowTxt.some(t => /คนของรถอื่น/.test(t)),
      footTxt: foot ? foot.textContent.replace(/\s+/g, ' ').trim() : '',
      footPax: foot ? [...foot.querySelectorAll('td')].slice(1, 5).map(td => td.textContent.trim()) : [] };
  }, [R0.date, R0.routeId, R0.vanId]);

  if (R.err) fail('ข้อ 7 · ' + R.err);
  else {
    const guide = R.rows.find(t => /ไกด์ สมชาย/.test(t));
    const cargo = R.rows.find(t => /เสื้อชูชีพ/.test(t));
    if (!guide || !cargo) fail('ใบงานรถไม่มีแถวจุดแวะ · คนขับจะไม่รู้ว่าต้องแวะ');
    else if (!/06:05/.test(guide) || !/ออฟฟิศ ถลาง/.test(guide))
      fail('แถวจุดแวะขึ้นแต่ไม่มีเวลา/สถานที่ · "' + guide.slice(0, 100) + '"');
    else ok('ใบงานรถมีแถวจุดแวะครบสองแถว พร้อมเวลาและสถานที่');

    const sumPax = R.footPax.map(v => parseInt(v, 10) || 0).reduce((a, b) => a + b, 0);
    if (sumPax !== R0.cust)
      fail('ยอด AD/CHD/INF/FOC ท้ายใบรวมจุดแวะเข้าไปด้วย · ควรได้ ' + R0.cust + ' แต่ได้ ' + sumPax
           + ' ' + JSON.stringify(R.footPax));
    else if (!/ติดรถ/.test(R.footTxt))
      fail('ยอดลูกค้าถูกแล้วแต่ไม่มีบรรทัดบอกที่นั่งจริง · คนขับต้องบวกเอง · "' + R.footTxt.slice(0, 140) + '"');
    else ok('ท้ายใบ · ยอดลูกค้า ' + sumPax + ' ไม่รวมจุดแวะ และมีบรรทัดบอกที่นั่งจริงให้คนขับ');

    const m = /(\d+)\s*booking/.exec(R.footTxt);
    if (!m) fail('ท้ายใบไม่บอกจำนวน booking');
    else if (+m[1] !== 2) fail('จำนวน booking ท้ายใบนับจุดแวะเป็นใบจองด้วย · ควรได้ 2 แต่ได้ ' + m[1]);
    else ok('จำนวน booking ท้ายใบ = 2 · จุดแวะไม่ถูกนับเป็นใบจอง');

    const times = R.order.filter(Boolean);
    const sorted = times.slice().sort();
    if (!R.stopIdx.length) fail('ข้ามข้อ 10 · ไม่เจอแถวจุดแวะ');
    else if (String(times) !== String(sorted))
      fail('แถวในใบงานไม่ได้เรียงตามเวลา · ' + JSON.stringify(times)
           + ' (จุดแวะต้องปนอยู่ในลำดับการวิ่งจริง ไม่ใช่กองท้ายใบ)');
    else ok('แถวจุดแวะเรียงตามเวลาปนกับลูกค้า · ' + times.join(' → '));

    if (!R0.van2) ok('ข้ามข้อ 13 · ระบบมีรถคันเดียว');
    else if (R.otherVan) fail('จุดแวะของรถคันอื่นหลุดเข้ามาในใบงานของคันนี้');
    else ok('จุดแวะของรถคันอื่นไม่โผล่ในใบงานของคันนี้');
  }
}

/* ══ 11 · 12 · หน้าเช็คอินรถ ═══════════════════════════════════════ */
{
  await page.evaluate(d => { window._vanCkDate = d; }, R0.date);
  await goView(page, 'vancheckin', 900);
  const R = await page.evaluate(() => {
    if (typeof renderVanCheckin === 'function') renderVanCheckin();
    const rows = [...document.querySelectorAll('#vancheckin-host tr.vck-strow')];
    const of = re => rows.find(r => re.test(r.textContent));
    const g = of(/ไกด์ สมชาย/), c = of(/เสื้อชูชีพ/);
    return { n: rows.length,
      guideHasN: !!(g && /1\s*ที่นั่ง/.test(g.textContent.replace(/\s+/g,' '))),
      guideBtn: !!(g && g.querySelector('button[onclick*="vsCheck"]')),
      cargoBtn: !!(c && c.querySelector('button[onclick*="vsCheck"]')),
      cargoNoNum: !!(c && ![...c.querySelectorAll('td')].slice(3,7).some(td => /\d/.test(td.textContent))),
      paxCells: rows.map(r => [...r.querySelectorAll('td')].slice(4, 8).map(td => td.textContent.trim())) };
  });
  const numeric = (R.paxCells || []).flat().filter(v => /\d/.test(v));
  if (!R.n) fail('หน้าเช็คอินรถไม่มีแถวจุดแวะเลย');
  else if (numeric.length) fail('แถวจุดแวะในหน้าเช็คอินมีตัวเลขในช่องลูกค้า · ' + JSON.stringify(numeric));
  else if (!R.guideHasN) fail('แถวคนติดรถไม่บอกจำนวนที่นั่ง');
  else if (!R.guideBtn || !R.cargoBtn) fail('แถวจุดแวะไม่มีปุ่มติ๊กเช็คอิน');
  else ok('หน้าเช็คอินรถมีแถวจุดแวะ ' + R.n + ' แถว · คนบอกจำนวนที่นั่ง · ทั้งสองแบบติ๊กได้');

  const R2 = await page.evaluate(() => {
    const row = [...document.querySelectorAll('#vancheckin-host tr.vck-strow')].find(r => /เสื้อชูชีพ/.test(r.textContent));
    if (!row) return { err: 'ไม่เจอแถวของ' };
    const k = (/vsCheck\('([^']+)'/.exec(row.querySelector('button[onclick*="vsCheck"]').getAttribute('onclick')) || [])[1];
    vsCheck(k);
    const after = VAN_STOPS[k] && VAN_STOPS[k].ck;
    const blob1 = ((JSON.parse(localStorage.getItem('loveandaman_v2')||'{}').van_stops)||{})[k] || {};
    vsCheck(k, false);
    const undone = !(VAN_STOPS[k] && VAN_STOPS[k].ck);
    const blob2 = ((JSON.parse(localStorage.getItem('loveandaman_v2')||'{}').van_stops)||{})[k] || {};
    return { ticked: !!(after && after.at), by: after && after.by, saved: !!(blob1 && blob1.ck),
             undone, unsaved: !(blob2 && blob2.ck) };
  });
  if (R2.err) fail('ข้อ 12 · ' + R2.err);
  else if (!R2.ticked) fail('กดติ๊กแล้วสถานะไม่เปลี่ยน');
  else if (!R2.saved) fail('ติ๊กแล้วไม่ได้เขียนลง blob · รีเฟรชแล้วสถานะหาย');
  else if (!R2.undone || !R2.unsaved) fail('กดยกเลิกแล้วสถานะไม่กลับ · ติ๊กผิดแล้วแก้ไม่ได้');
  else ok('ติ๊กแล้วบันทึกลง blob จริง (โดย ' + (R2.by || '—') + ') และกดยกเลิกกลับได้');
}

/* ══ 14 · ลบ ═══════════════════════════════════════════════════════ */
{
  const R = await page.evaluate(([date, routeId, vanId]) => {
    const list = vsFor(date, routeId).filter(s => s.vanId === vanId);
    const k = (list.find(s => s.kind === 'staff') || {})._k;
    if (!k) return { err: 'ไม่เจอจุดแวะที่จะลบ' };
    vsDel(k);
    const gone = !VAN_STOPS[k];
    const inBlob = !!((JSON.parse(localStorage.getItem('loveandaman_v2')||'{}').van_stops||{})[k]);
    const seats = vsSeatsOfVan(date, routeId, vanId, window.__TVS_G);
    const html = (typeof vanJobsOrderInner === 'function') ? vanJobsOrderInner(date, vanId, routeId, null, 0) : '';
    return { gone, inBlob, seats, onSheet: /ไกด์ สมชาย/.test(html) };
  }, [R0.date, R0.routeId, R0.vanId]);
  if (R.err) fail('ข้อ 14 · ' + R.err);
  else if (!R.gone || R.inBlob) fail('ลบแล้วยังอยู่' + (R.inBlob ? ' ใน blob' : ''));
  else if (R.onSheet) fail('ลบแล้วยังพิมพ์อยู่ในใบงานรถ');
  else if (R.seats !== 0) fail('ลบคนติดรถแล้วที่นั่งยังถูกกันไว้ ' + R.seats);
  else ok('ลบแล้วหายจากทุกหน้า และที่นั่งที่กันไว้คืนให้รถ');
}

/* ══ 16 · §vsArea · พื้นที่รับต้องมาจากทะเบียนพื้นที่ ไม่ใช่ข้อความที่พิมพ์เอง ══
   ผู้ใช้แจ้ง 30 ก.ย. "Zone ควรเป็น Pickup Area ที่ User ระบุ Phuket Town Patong"
   เทสจงใจเก็บ zone เป็นขยะ 'ZZZ-RAW' แล้วผูก areaId จริงไว้
   ทุกหน้าที่โชว์ต้องขึ้นชื่อพื้นที่จริง และต้องไม่มี 'ZZZ-RAW' โผล่ที่ไหนเลย */
{
  const R = await page.evaluate(([date, routeId, vanId, G]) => {
    const ar = (typeof SB_PICKUP_AREAS !== 'undefined' ? SB_PICKUP_AREAS : []).filter(a => a && a.id && a.name)[0];
    if (!ar) return { err: 'ไม่มีพื้นที่รับในระบบ' };
    vsSave({ date, routeId, kind:'staff', label:'T-VS พื้นที่', pax:1, time:'06:02',
             place:'ออฟฟิศ ถลาง', areaId: ar.id, zone:'ZZZ-RAW', vanId, vanGroup:G });
    const rec = vsFor(date, routeId).find(x => x.label === 'T-VS พื้นที่') || {};
    bkV2Render();
    const row = [...document.querySelectorAll('tr.t2-vsrow')].find(tr => /T-VS พื้นที่/.test(tr.textContent));
    const tag = row ? ((row.querySelector('.t2-zonetag') || {}).textContent || '').trim() : '(ไม่เจอแถว)';
    const sheet = (typeof vanJobsOrderInner === 'function') ? vanJobsOrderInner(date, vanId, routeId, null, 0) : '';
    const ck = (typeof vckStopRow === 'function') ? vckStopRow(rec) : '';
    /* เปิดกล่องจริง · ของเดิมเทสเรียก vsSave ตรง ๆ เลยไม่เคยแตะตัวเติมรายการพื้นที่
       แล้วบั๊ก esc() หลุดไปถึงหน้าจริงได้ (เจอตอนลองเปิดเอง 30 ก.ย.) */
    let modal = { threw:'' };
    try {
      vsOpen(date, routeId, { vanId, vanGroup:G, zone:'' });
      const sel = document.getElementById('vs-area');
      modal.opts = sel ? sel.options.length : 0;
      modal.groups = sel ? sel.querySelectorAll('optgroup').length : 0;
      modal.newLeg = (document.getElementById('vs-leg')||{}).value;
      vsEditOpen(rec._k);
      modal.editArea = (document.getElementById('vs-area')||{}).value;
      modal.editLeg  = (document.getElementById('vs-leg')||{}).value;
      if (typeof closeModal === 'function') closeModal('vanstop-modal');
    } catch (e) { modal.threw = e.message; }
    return { modal, name: ar.name, savedId: rec.areaId || '', fn: (typeof vsAreaName==='function') ? vsAreaName(rec) : '',
             tag, sheetName: sheet.indexOf(ar.name) >= 0, sheetRaw: sheet.indexOf('ZZZ-RAW') >= 0,
             ckName: ck.indexOf(ar.name) >= 0, ckRaw: ck.indexOf('ZZZ-RAW') >= 0 };
  }, [R0.date, R0.routeId, R0.vanId, R0.grp]);
  if (R.err) fail('ข้อ 16 · ' + R.err);
  else if (!R.savedId) fail('บันทึกแล้วไม่มี areaId ติดไปด้วย · จุดแวะยังไม่ผูกกับทะเบียนพื้นที่');
  else if (R.fn !== R.name) fail('vsAreaName คืน "' + R.fn + '" ควรเป็น "' + R.name + '"');
  else if (R.tag !== R.name) fail('ตาราง By trip ช่องพื้นที่ขึ้น "' + R.tag + '" ควรเป็น "' + R.name + '"');
  else if (!R.sheetName || R.sheetRaw) fail('ใบงานรถยังโชว์ข้อความดิบแทนชื่อพื้นที่');
  else if (!R.ckName || R.ckRaw) fail('หน้าเช็คอินรถยังโชว์ข้อความดิบแทนชื่อพื้นที่');
  else if (R.modal.threw) fail('เปิดกล่องเพิ่ม/แก้จุดแวะแล้วพัง · ' + R.modal.threw);
  else if (!(R.modal.opts > 1) || !(R.modal.groups > 0))
    fail('ช่องพื้นที่รับในกล่องว่างเปล่า (' + R.modal.opts + ' ตัวเลือก · ' + R.modal.groups + ' กลุ่ม) · คนใช้เลือกอะไรไม่ได้');
  else if (R.modal.newLeg !== 'out') fail('กล่องเพิ่มจุดแวะไม่ได้ตั้งต้นเป็นขาไป · ได้ "' + R.modal.newLeg + '"');
  else if (R.modal.editArea !== R.savedId)
    fail('กดแก้ไขแล้วช่องพื้นที่ไม่ได้เลือกค่าเดิมไว้ · ได้ "' + R.modal.editArea + '" ควรเป็น "' + R.savedId + '"');
  else ok('พื้นที่รับมาจากทะเบียนพื้นที่ชุดเดียวกับลูกค้า · ขึ้น "' + R.name + '" ทั้งสามหน้า · กล่องมีให้เลือก '
          + R.modal.opts + ' พื้นที่ ' + R.modal.groups + ' กลุ่ม และกดแก้ไขแล้วค่าเดิมติดมา');
}

/* ══ 17 · §vsSeqTime · ใบงานต้องเรียงเวลา แม้ลูกค้าจะมีลำดับมือแล้ว ══════
   ผู้ใช้แจ้ง 30 ก.ย. "ใบงาน เวลาควรเรียงด้วย" · ภาพที่ส่งมา จุดแวะ 05.50
   ไปโผล่แถวที่ 4 ใต้ลูกค้า 07:30-07:45 เพราะลูกค้ากด "เรียงตามเวลา" ไว้
   แล้ววิ่งเป็น vanSeq 1-2-3 ส่วนจุดแวะยังเป็น 0 = ถูกตีเป็นลำดับ 9999 */
{
  const R = await page.evaluate(([date, routeId, vanId, G]) => {
    /* ให้ลูกค้าในกรุ๊ปมีลำดับมือ เหมือนหลังกดปุ่มเรียงตามเวลา */
    let n = 0;
    (SB_BOOKINGS || []).forEach(b => {
      const o = bkOpsRead(b, date); if (!o) return;
      if ((+o.vanGroup || 0) === +G && o.vanId === vanId) { bkOpsFor(b, date).vanSeq = ++n; }
    });
    if (typeof acctPersistBookings === 'function') acctPersistBookings();
    if (!n) return { err: 'กรุ๊ปนี้ไม่มีลูกค้าให้ตั้งลำดับ' };
    vsSave({ date, routeId, kind:'staff', label:'T-VS เช้าสุด', pax:1, time:'05:50',
             place:'ออฟฟิศ ถลาง', vanId, vanGroup:G, vanSeq:0 });
    const html = vanJobsOrderInner(date, vanId, routeId, null, 0);
    const out = html.split('② ขากลับ')[0];
    const d = document.createElement('div'); d.innerHTML = out;
    const rows = [...d.querySelectorAll('tr')].filter(tr => !tr.closest('thead'))
                     .map(tr => (tr.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const iStop = rows.findIndex(t => /T-VS เช้าสุด/.test(t));
    return { n, iStop, total: rows.length, first: rows[0] ? rows[0].slice(0, 60) : '' };
  }, [R0.date, R0.routeId, R0.vanId, R0.grp]);
  if (R.err) fail('ข้อ 17 · ' + R.err);
  else if (R.iStop < 0) fail('จุดแวะไม่ขึ้นใบงานเลย');
  else if (R.iStop !== 0) fail('จุดแวะ 05:50 อยู่แถวที่ ' + (R.iStop + 1) + ' ของ ' + R.total
           + ' · ควรเป็นแถวแรกเพราะออกก่อนใครเพื่อน (แถวบนสุดตอนนี้คือ "' + R.first + '")');
  else ok('ใบงานเรียงตามเวลาจริง · จุดแวะ 05:50 ขึ้นก่อนลูกค้าที่มีลำดับมือ ' + R.n + ' ราย');
}

/* ══ 18 · §vsLeg · จุดแวะรู้ขาของตัวเอง ═══════════════════════════════
   ผู้ใช้แจ้ง 30 ก.ย. "ทีนี้มันจะมีทั้งติดรถไปกลับด้วย"
   ขากลับต้องไม่โผล่ตารางขาไป และต้องไม่ไปกินที่นั่งขาไปของกรุ๊ป */
{
  const R = await page.evaluate(([date, routeId, vanId, G]) => {
    const base = vsSeatsOfVan(date, routeId, vanId, G, false);
    vsSave({ date, routeId, kind:'staff', label:'T-VS ขากลับล้วน', pax:2, time:'15:10',
             place:'ท่าเรือ', vanId, vanGroup:G, leg:'ret' });
    vsSave({ date, routeId, kind:'staff', label:'T-VS ไปและกลับ', pax:1, time:'06:03',
             place:'ออฟฟิศ ถลาง', vanId, vanGroup:G, leg:'both' });
    const html = vanJobsOrderInner(date, vanId, routeId, null, 0);
    const parts = html.split('② ขากลับ');
    const out = parts[0] || '', ret = parts[1] || '';
    return { hasRet: parts.length > 1,
             outRet: /T-VS ขากลับล้วน/.test(out), outBoth: /T-VS ไปและกลับ/.test(out),
             retRet: /T-VS ขากลับล้วน/.test(ret), retBoth: /T-VS ไปและกลับ/.test(ret),
             seatOut: vsSeatsOfVan(date, routeId, vanId, G, false),
             seatRet: vsSeatsOfVan(date, routeId, vanId, G, true), base };
  }, [R0.date, R0.routeId, R0.vanId, R0.grp]);
  if (!R.hasRet) fail('ข้อ 18 · ใบงานนี้ไม่มีตารางขากลับให้วัด');
  else if (R.outRet) fail('จุดแวะขากลับโผล่ในตารางขาไป · คนขับจะไปรอผิดรอบ');
  else if (!R.retRet) fail('จุดแวะขากลับไม่ขึ้นในตารางขากลับเลย');
  else if (!R.outBoth || !R.retBoth) fail('จุดแวะแบบไป-กลับ ต้องขึ้นทั้งสองตาราง');
  else if (R.seatOut !== R.base + 1) fail('ที่นั่งขาไปควรเพิ่มแค่ 1 (คนที่ไปและกลับ) · ได้ ' + R.seatOut + ' จากฐาน ' + R.base);
  else if (R.seatRet !== 3) fail('ที่นั่งขากลับควรเป็น 3 (ขากลับล้วน 2 + ไปและกลับ 1) · จุดขาไปล้วนต้องไม่ถูกนับ · ได้ ' + R.seatRet);
  else ok('จุดแวะแยกขาได้จริง · ขากลับไม่หลุดไปขาไป · ที่นั่งนับแยกขา (ไป ' + R.seatOut + ' · กลับ ' + R.seatRet + ')');
}

/* ══ 19 · §grpDrag · ลากสลับลำดับกรุ๊ปเอง ═══════════════════════════
   ผู้ใช้แจ้ง 30 ก.ย. รอบสอง · ปุ่มเลือกวิธีเรียงกินที่มากเกินไป ให้เอาออก
   แล้วเปลี่ยนเป็นลากเรียงเอง · ย้ำว่า "ต้องตรวจดูดี ๆ ว่ารีเฟรชแล้วไม่หาย"
   ข้อนี้วัดการลาก · ข้อ 20 วัดว่ารอดการรีเฟรชจริง (เปิดแอปใหม่ทั้งตัว)      */
let DRAG = null;
{
  const R = await page.evaluate(() => {
    if (typeof bkV2GrpMove !== 'function') return { err: 'ยังไม่มี bkV2GrpMove' };
    const read = k => [...document.querySelectorAll('tr[data-grp]')]
      .filter(t => (t.getAttribute('data-gk') || '') === k)
      .map(t => +t.getAttribute('data-grp'));
    const by = {};
    document.querySelectorAll('tr[data-grp]').forEach(t => {
      const k = t.getAttribute('data-gk') || ''; (by[k] = by[k] || []).push(+t.getAttribute('data-grp')); });
    const key = Object.keys(by).find(k => by[k].length >= 3) || Object.keys(by).find(k => by[k].length >= 2);
    if (!key) return { err: 'หน้านี้ไม่มีโซนที่มีกรุ๊ปเกินหนึ่ง วัดการลากไม่ได้' };
    /* ที่จับลากต้องมีอยู่จริงทุกหัวกรุ๊ป · ถ้าไม่มี คนก็ลากไม่ได้ ต่อให้ฟังก์ชันย้ายทำงานได้ */
    const heads = document.querySelectorAll('tr[data-grp]').length;
    const grabs = document.querySelectorAll('tr[data-grp] .grp-grab[draggable="true"]').length;
    const drops = [...document.querySelectorAll('tr[data-grp]')].filter(t => t.getAttribute('ondrop')).length;
    const before = by[key].slice();
    const last = before[before.length - 1];
    const moved = bkV2GrpMove(key, last, before[0]);      // ลากตัวท้ายขึ้นไปไว้บนสุด
    const after = read(key);
    const want = [last, ...before.filter(g => g !== last)];
    /* ลากครั้งที่สอง เอาตัวที่เคยอยู่บนสุดลงไปไว้ท้าย · กันกรณีย้ายได้ทางเดียว
       และที่สำคัญกว่านั้น ทำให้ลำดับสุดท้ายไม่เท่ากับลำดับเลขกรุ๊ปเดิม
       ถ้าจบด้วยลำดับเดิม ข้อ 20 จะผ่านแม้ระบบไม่ได้จำอะไรไว้เลย */
    const moved2 = bkV2GrpMove(key, before[0], after[after.length - 1]);
    const after2 = read(key);
    const want2 = [last, ...before.filter(g => g !== last && g !== before[0]), before[0]];
    /* ทริปเก่าที่ยังเปิดดูย้อนหลังได้ · ตัวตัดของเก่าต้องไม่ลบอันที่เพิ่งเขียนในคำสั่งเดียวกัน */
    bkV2GrpOrderSet('2024-01-05', 'zz-test', 'PK', [2, 1]);
    const oldKeep = bkV2GrpOrderGet('2024-01-05', 'zz-test', 'PK');
    bkV2GrpOrderSet('2024-01-05', 'zz-test', 'PK', []);
    const p = key.split('::');
    return { key, heads, grabs, drops, before, after, want, moved, moved2, after2, want2, oldKeep,
             date: p[0], routeId: p[1], zone: p.slice(2).join('::'),
             saved: (typeof bkV2GrpOrderGet === 'function') ? bkV2GrpOrderGet(p[0], p[1], p.slice(2).join('::')) : null };
  });
  if (R.err) fail('ข้อ 19 · ' + R.err);
  else if (R.grabs !== R.heads || !R.drops)
    fail('หัวกรุ๊ป ' + R.heads + ' แถว แต่มีที่จับลาก ' + R.grabs + ' อัน · รับ drop ' + R.drops + ' แถว · คนลากไม่ได้');
  else if (!R.moved) fail('เรียกย้ายกรุ๊ปแล้วไม่สำเร็จ');
  else if (R.after.join() !== R.want.join())
    fail('ลากตัวท้ายขึ้นบนสุดแล้วลำดับผิด · ได้ ' + R.after.join('>') + ' ควรเป็น ' + R.want.join('>'));
  else if (!R.moved2 || R.after2.join() !== R.want2.join())
    fail('ลากกลับลงท้ายไม่ได้ · ได้ ' + R.after2.join('>') + ' ควรเป็น ' + R.want2.join('>'));
  else if (!R.saved || !R.saved.length) fail('ลากแล้วไม่ได้บันทึกลำดับไว้เลย');
  else if (R.after2.join() === R.before.join())
    fail('เทสจบด้วยลำดับเดิม (' + R.before.join('>') + ') · ข้อ 20 จะวัดการรีเฟรชไม่ได้จริง');
  else if ((R.oldKeep || []).join() !== '2,1')
    fail('จัดลำดับให้ทริปเก่าแล้วโดนตัวตัดของเก่าลบทิ้งทันที · ได้ ' + JSON.stringify(R.oldKeep));
  else { DRAG = R; ok('ลากสลับลำดับกรุ๊ปได้ทั้งขึ้นและลง · ' + R.before.join('>') + ' → ' + R.after2.join('>')
          + ' · ที่จับลากครบทั้ง ' + R.heads + ' หัวกรุ๊ป'); }
}

/* ══ 20 · §grpDrag · รีเฟรชแล้วต้องไม่หาย ══════════════════════════════
   ข้อที่ผู้ใช้สั่งให้ตรวจเป็นพิเศษ · ไม่ใช่แค่ดูว่าเขียนลง localStorage แล้ว
   แต่เปิดแอปใหม่ทั้งตัวจากก้อนข้อมูลนั้น แล้วดูลำดับที่วาดออกมาจริง ๆ
   และผ่าน decompose→assemble ของ SQL ด้วย · หายที่ชั้นไหนก็คือหายเหมือนกัน */
if (DRAG) {
  const BLOB = await page.evaluate(() => localStorage.getItem('loveandaman_v2') || '{}');
  const raw = JSON.parse(BLOB).bkv2_grp_order;
  let sqlOk = false, sqlWhy = '';
  try {
    const back = osRepo.assembleBlob(osRepo.decomposeBlob({ bkv2_grp_order: raw })).bkv2_grp_order;
    sqlOk = JSON.stringify(back) === JSON.stringify(raw);
    if (!sqlOk) sqlWhy = 'เขียน ' + String(raw).slice(0, 80) + ' กลับมาได้ ' + String(back).slice(0, 80);
  } catch (e) { sqlWhy = e.message; }

  if (raw === undefined || raw === null) fail('ลำดับที่ลากไม่ได้อยู่ใน blob เลย · รีเฟรชหายแน่');
  else if (typeof raw !== 'string')
    fail('ลำดับถูกเก็บเป็น ' + typeof raw + ' ไม่ใช่สตริง · คีย์บนสุดที่เป็น object และไม่มีตารางเป็นเจ้าของ จะหายตอน sync');
  else if (!sqlOk) fail('ลำดับไม่รอดการเดินทางไป-กลับ SQL · ' + sqlWhy);
  else {
    const tmp = path.join(ROOT, 'allotment_v2/data_exports/_t_grpdrag.json');
    fs.writeFileSync(tmp, BLOB);
    const two = await open({ blob: tmp, width: 1800, height: 1300 });
    await goView(two.page, 'booking', 1000);
    const R2 = await two.page.evaluate(([key, date, routeId]) => {
      _bkV2.tab = 'bytrip'; _bkV2.vanAssignMode = true;
      _bkV2.filterRoute = routeId; _bkV2.filterDate = date;
      bkV2Render();
      return { drawn: [...document.querySelectorAll('tr[data-grp]')]
                 .filter(t => (t.getAttribute('data-gk') || '') === key)
                 .map(t => +t.getAttribute('data-grp')),
               stored: (typeof bkV2GrpOrderGet === 'function') ? bkV2GrpOrderGet(date, routeId, key.split('::').slice(2).join('::')) : null };
    }, [DRAG.key, DRAG.date, DRAG.routeId]);
    const err2 = two.errors.slice(0, 2);
    await two.close();
    try { fs.unlinkSync(tmp); } catch (_) {}
    if (!R2.stored || !R2.stored.length) fail('เปิดแอปใหม่แล้วอ่านลำดับที่บันทึกไว้ไม่เจอ · ' + JSON.stringify(R2.stored));
    else if (!R2.drawn.length) fail('เปิดแอปใหม่แล้ววาดกรุ๊ปของโซนนี้ไม่ออกเลย วัดต่อไม่ได้');
    else if (R2.drawn.join() !== DRAG.after2.join())
      fail('รีเฟรชแล้วลำดับเพี้ยน · ก่อนรีเฟรช ' + DRAG.after2.join('>') + ' หลังรีเฟรช ' + R2.drawn.join('>'));
    else if (err2.length) fail('เปิดแอปใหม่แล้วมี error · ' + err2.join(' | '));
    else ok('เปิดแอปใหม่ทั้งตัวจากก้อนข้อมูลจริง · ลำดับที่ลากไว้ยังเป็น ' + R2.drawn.join('>') + ' เหมือนเดิม และรอด SQL ไป-กลับ');
  }
}

/* ══ 15 ═══════════════════════════════════════════════════════════ */
await page.evaluate(() => {
  Object.keys(VAN_STOPS || {}).forEach(k => { if (/T-VS/.test((VAN_STOPS[k] || {}).label || '')) delete VAN_STOPS[k]; });
  vsPersist();
});
if (errors.length) fail('มี error บนหน้า · ' + errors.slice(0, 3).join(' | '));
else ok('ไม่มี error บนหน้า');

await close();
console.log(bad ? '\n✗ ' + bad + ' ข้อไม่ผ่าน' : '\n✓ ผ่านทั้งหมด');
process.exit(bad ? 1 : 0);
