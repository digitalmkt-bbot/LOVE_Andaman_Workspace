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
//   15 ไม่มี error บนหน้า

import { open, goView } from './_harness.mjs';
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
