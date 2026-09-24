// §btGhost · ทริปที่ค้างอยู่บนกระดาน By-trip ทั้งที่ไม่เหลือ booking แล้ว
//
// ที่มา (2026-09-24) · ผู้ใช้เจอเอง · "ก่อนหน้านั้นโปรแกรมยังดำเนินปกติ
// แต่มีเหตุต้องปิดโปรแกรม ทีนี้อันนี้ค้างอยู่จะปรับยังไง"
// บนจอคือ  Whale Shark Phi Phi Maiton Sunset · 0/0 · [full] · no boat
//
// ปัญหาสองชั้น
//   ก · คำว่า "full" อ่านว่าขายหมด · ความจริงคือไม่มีเรือและไม่มีที่นั่งสักที่
//       (ตัวหารเป็นศูนย์แล้วโค้ดตีว่าเต็ม · รากเดียวกับ §noCapSeat ที่เคยแก้ในการ์ดซ้าย)
//   ข · ไม่มีอะไรบอกว่าทำไมแถวนี้ยังอยู่ · คนเลยไม่รู้ว่าต้องไปปลดที่ไหน
//       ทริปถูกดันขึ้นกระดานได้สามทาง · ล็อกที่นั่ง · ใบที่ย้ายวันออกไป · ใบรออนุมัติ
//
// เทสนี้กันห้าอย่าง
//   1 หาแถวค้างจากข้อมูลจริงได้ (ไม่เหลือ booking แต่ยังโผล่บนกระดาน)
//   2 แถวค้างต้องไม่ขึ้นคำว่า full
//   3 ต้องบอกเหตุผลว่าค้างเพราะอะไร และเหตุผลต้องตรงกับข้อมูลดิบ
//   4 ทริปที่ขายเต็มจริง ๆ ต้องยังขึ้น full เหมือนเดิม (ไม่ใช่แก้แล้วกลบของจริง)
//   5 ทริปที่ยังมีคนจองอยู่ ต้องไม่ติดป้ายแถวค้าง
//
// ⚠ ทุกข้อคำนวณค่าที่คาดหวังจาก SB_BOOKINGS/SB_SEAT_LOCKS/ROUTES ดิบเอง
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1800, height: 1200 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1000);

/* ══ 0 · หาวัน+เส้นทางที่เป็น "แถวค้าง" จากข้อมูลดิบ ═════════════════════
   นิยาม · วันนั้นเส้นนั้นไม่เหลือ booking ที่ยังไม่ยกเลิกเลย
   แต่ยังถูกดันขึ้นกระดานด้วยทางใดทางหนึ่ง · ล็อก / ย้ายวันออก / รออนุมัติ
   และวันนั้นเส้นนั้นต้องเปิดขายอยู่ ไม่งั้นกระดานกรองทิ้งตั้งแต่ต้น */
const R0 = await page.evaluate(() => {
  const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
  const liveOn = (rid, d) => (SB_BOOKINGS || []).some(b =>
    !CXL.includes(b.status) && b.status !== 'pending_approval' &&
    (b.trips || []).some(t => t.routeId === rid && t.date === d));
  const pendOn = (rid, d) => (SB_BOOKINGS || []).filter(b =>
    b.status === 'pending_approval' &&
    (b.trips || []).some(t => t.routeId === rid && t.date === d)).length;
  const cand = {};
  /* ทางที่ 1 · ล็อกที่นั่ง */
  (typeof SB_SEAT_LOCKS !== 'undefined' ? SB_SEAT_LOCKS : []).forEach(l => {
    if (l.status !== 'active' || l.parentId) return;
    const d = l.date; if (!d || !l.routeId) return;
    (cand[l.routeId + '|' + d] = cand[l.routeId + '|' + d] || { why: [] }).why.push('lock');
  });
  /* ทางที่ 2 · ใบที่ย้ายวันออกจากวันนั้น */
  (SB_BOOKINGS || []).forEach(b => {
    if (!b.reschedule || !b.reschedule.fromDate) return;
    (b.trips || []).forEach(t => {
      if (!t.routeId) return;
      const k = t.routeId + '|' + b.reschedule.fromDate;
      (cand[k] = cand[k] || { why: [] }).why.push('resch');
    });
  });
  /* ทางที่ 3 · ใบรออนุมัติ */
  (SB_BOOKINGS || []).forEach(b => {
    if (b.status !== 'pending_approval') return;
    (b.trips || []).forEach(t => {
      if (!t.routeId || !t.date) return;
      const k = t.routeId + '|' + t.date;
      (cand[k] = cand[k] || { why: [] }).why.push('pend');
    });
  });
  const ghost = [], solid = [];
  Object.keys(cand).forEach(k => {
    const [rid, d] = k.split('|');
    const r = (ROUTES || []).find(x => x && x.id === rid); if (!r) return;
    if (typeof laIsLandRoute === 'function' && laIsLandRoute(rid)) return;
    const openDay = (typeof bkV2IsRouteOpenOn === 'function') ? bkV2IsRouteOpenOn(rid, d) : true;
    const rec = { rid, d, route: r.name, openDay,
                  why: [...new Set(cand[k].why)], pend: pendOn(rid, d), live: liveOn(rid, d) };
    if (!rec.live && openDay) ghost.push(rec); else if (rec.live) solid.push(rec);
  });
  return { ghost: ghost.slice(0, 8), nGhost: ghost.length, solid: solid.slice(0, 4) };
});
if (!R0.nGhost) { fail('ชุดนี้ไม่มีแถวค้างให้ทดสอบ'); console.log('\nพัง ' + bad); await close(); process.exit(1); }
const g = R0.ghost[0];
ok('เจอแถวค้างจากข้อมูลจริง ' + R0.nGhost + ' แถว · ตัวอย่าง ' + g.route + ' ' + g.d
  + ' · ค้างเพราะ ' + g.why.join('+') + ' · ไม่เหลือ booking แล้ว');

/* เปิดหน้า By trip · date ไปที่วันนั้น */
const R1a = await page.evaluate((d) => {
  const el = [].slice.call(document.querySelectorAll('.nav-item[data-view]'))
    .find(x => /booking/i.test(x.dataset.view || '') && !/transfer|flow/i.test(x.dataset.view || ''));
  if (el && typeof nav === 'function') nav(el);
  if (typeof bkV2SwitchTab === 'function') bkV2SwitchTab('bytrip');
  if (typeof bkV2Tab2ClearFilters === 'function') bkV2Tab2ClearFilters();
  if (typeof bkV2Tab2PickDay === 'function') bkV2Tab2PickDay(d);
  const tiles = document.querySelectorAll('.bt-tgp').length;
  return { tiles, head: ((document.querySelector('.bt-boat .bt-cnt') || {}).textContent || '').trim() };
}, g.d);
if (!R1a.tiles) fail('เปิดวัน ' + g.d + ' แล้วกระดานไม่มีการ์ดทริปเลย · เทสต่อไม่ได้');
else ok('เปิดกระดาน By trip วันที่ ' + g.d + ' · มีการ์ดทริป ' + R1a.tiles + ' ใบ · หัวการ์ด "' + R1a.head + '"');

/* ══ 1 + 2 + 3 · แถวค้างต้องไม่ขึ้น full และต้องบอกเหตุผล ═══════════════ */
const R1 = await page.evaluate((arg) => {
  const { rid, route } = arg;
  const tiles = [].slice.call(document.querySelectorAll('.bt-tgp'));
  const t = tiles.find(x => ((x.querySelector('.nm') || {}).textContent || '').trim() === route);
  if (!t) return { skip: 'การ์ดของเส้นนี้ไม่โผล่บนกระดาน' };
  const em = t.querySelector('.bt-tgh .sm em');
  const ghost = t.querySelector('.bt-ghost');
  return {
    found: true,
    badge: em ? (em.textContent || '').trim() : '',
    badgeCls: em ? em.className : '',
    sm: ((t.querySelector('.bt-tgh .sm') || {}).textContent || '').trim(),
    noBoat: !!t.querySelector('.bt-tbc.none'),
    ghost: ghost ? (ghost.textContent || '').trim() : '',
    ghostCls: ghost ? [].slice.call(ghost.children).map(c => c.className).join(' ') : ''
  };
}, { rid: g.rid, route: g.route });
if (R1.skip) fail(R1.skip);
else {
  const b1 = [];
  if (/full/i.test(R1.badge)) b1.push('ยังขึ้นป้าย "full" ทั้งที่ไม่มีที่นั่งสักที่ · ' + R1.sm);
  if (!R1.ghost) b1.push('ไม่มีบรรทัดบอกว่าทำไมแถวนี้ยังอยู่');
  /* เหตุผลที่โชว์ต้องตรงกับที่นับเองจากข้อมูลดิบ */
  if (R1.ghost) {
    if (g.why.includes('lock') && !/glock/.test(R1.ghostCls)) b1.push('ค้างเพราะล็อกที่นั่ง แต่ไม่ได้บอก');
    if (g.why.includes('resch') && !/gresch/.test(R1.ghostCls)) b1.push('มีใบย้ายวันออก แต่ไม่ได้บอก');
    if (g.pend && !/gpend/.test(R1.ghostCls)) b1.push('มีใบรออนุมัติ ' + g.pend + ' ใบ แต่ไม่ได้บอก');
  }
  if (b1.length) fail('แถวค้าง · ' + b1.join(' · '));
  else ok('แถวค้างอ่านรู้เรื่อง · ' + g.route + ' ขึ้น "' + R1.sm + '"'
      + (R1.noBoat ? ' · no boat' : '') + ' · บอกเหตุผล "' + R1.ghost + '"');
}

/* ══ 3b · ทางที่ค้างเพราะ "ล็อกที่นั่ง" ═══════════════════════════════════
   ชุดข้อมูลตัวอย่างไม่มีล็อกสักใบ · วางของทดสอบเองด้วยกลไกของระบบ แล้วเก็บกวาดท้ายข้อ
   ทางนี้คือทางที่ผู้ใช้น่าจะเจอ · ล็อกไว้ให้เอเยนต์ แล้วโปรแกรมถูกปิด ล็อกยังคาอยู่ */
const R3b = await page.evaluate(() => {
  if (typeof SB_SEAT_LOCKS === 'undefined') return { skip: 'ชุดนี้ไม่มีตารางล็อกที่นั่ง' };
  const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
  /* หาวัน+เส้นที่เปิดขาย แต่ไม่มีใครจองและไม่มีเรือ · ล็อกลงไปแล้วต้องโผล่เป็นแถวค้าง */
  let hit = null;
  (ROUTES || []).some(r => {
    if (typeof laIsLandRoute === 'function' && laIsLandRoute(r.id)) return false;
    for (let i = 3; i < 90 && !hit; i++) {
      const dt = new Date(TODAY_STR); dt.setDate(dt.getDate() + i);
      const d = dt.toISOString().slice(0, 10);
      if (typeof bkV2IsRouteOpenOn === 'function' && !bkV2IsRouteOpenOn(r.id, d)) continue;
      const live = (SB_BOOKINGS || []).some(b => !CXL.includes(b.status) &&
        (b.trips || []).some(t => t.routeId === r.id && t.date === d));
      if (live) continue;
      const day = (TRIPS || {})[d] || {};
      if (Object.keys(day).some(k => day[k].route === r.id)) continue;
      hit = { rid: r.id, d, route: r.name };
    }
    return !!hit;
  });
  if (!hit) return { skip: 'ไม่มีวันว่างให้วางล็อกทดสอบ' };
  const snap = JSON.stringify(SB_SEAT_LOCKS);
  SB_SEAT_LOCKS.push({ id: 'lkTEST1', scope: 'day', routeId: hit.rid, date: hit.d, month: '',
    boatId: null, holderType: 'office', holderId: null, qty: 7, used: 0,
    reason: 'test hold', expiry: '', status: 'active', createdAt: hit.d, createdBy: 'test' });
  bkV2Tab2ClearFilters(); bkV2Tab2PickDay(hit.d);
  const t = [].slice.call(document.querySelectorAll('.bt-tgp'))
    .find(x => ((x.querySelector('.nm') || {}).textContent || '').trim() === hit.route);
  const em = t && t.querySelector('.bt-tgh .sm em');
  const gh = t && t.querySelector('.bt-ghost');
  const out = { ...hit, onBoard: !!t,
    badge: em ? (em.textContent || '').trim() : '',
    ghost: gh ? (gh.textContent || '').trim() : '',
    ghostCls: gh ? [].slice.call(gh.children).map(c => c.className).join(' ') : '' };
  /* เก็บกวาด · ล็อกทดสอบต้องไม่ค้างไว้ให้ข้ออื่น */
  SB_SEAT_LOCKS.length = 0;
  JSON.parse(snap).forEach(x => SB_SEAT_LOCKS.push(x));
  bkV2Tab2ClearFilters(); bkV2Tab2PickDay(hit.d);
  out.gone = ![].slice.call(document.querySelectorAll('.bt-tgp'))
    .some(x => ((x.querySelector('.nm') || {}).textContent || '').trim() === hit.route);
  out.restored = JSON.stringify(SB_SEAT_LOCKS) === snap;
  return out;
});
if (R3b.skip) console.log('  ! ' + R3b.skip + ' · ข้ามข้อ 3b');
else {
  const b3 = [];
  if (!R3b.onBoard) b3.push('ล็อกที่นั่งไว้แล้วทริปไม่โผล่บนกระดาน · คนจะไม่รู้ว่ามีล็อกค้าง');
  else {
    if (/full/i.test(R3b.badge)) b3.push('ขึ้นป้าย full ทั้งที่ไม่มีที่นั่งสักที่');
    if (!/glock/.test(R3b.ghostCls)) b3.push('ไม่ได้บอกว่าค้างเพราะล็อกที่นั่ง · ได้ "' + R3b.ghost + '"');
    if (R3b.ghost && R3b.ghost.indexOf('7') < 0) b3.push('ไม่ได้บอกจำนวนที่ล็อกไว้ (7) · ' + R3b.ghost);
  }
  if (!R3b.gone) b3.push('เอาล็อกทดสอบออกแล้วทริปยังค้างบนกระดาน');
  if (!R3b.restored) b3.push('คืนตารางล็อกไม่ครบ');
  if (b3.length) fail('ค้างเพราะล็อกที่นั่ง · ' + b3.join(' · '));
  else ok('ค้างเพราะล็อกที่นั่งบอกถูก · ' + R3b.route + ' ' + R3b.d + ' ขึ้น "' + R3b.badge
      + '" และ "' + R3b.ghost + '" · เอาล็อกออกแล้วทริปหายจากกระดาน คืนตารางครบ');
}

/* ══ 4 · ทริปที่เต็มจริง ต้องยังขึ้น full เหมือนเดิม ═══════════════════════
   แก้คำว่า full ต้องไม่ไปกลบกรณีขายหมดจริง ไม่งั้นคนจะขายทับ */
const R4 = await page.evaluate(() => {
  /* หาวัน+เส้นที่ "มีเรือ มีที่นั่ง และขายหมด" คำนวณเองจาก getAllotment ของระบบ */
  let hit = null;
  const seen = new Set();
  (SB_BOOKINGS || []).some(b => {
    if (['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)) return false;
    return (b.trips || []).some(t => {
      if (!t.date || !t.routeId) return false;
      const k = t.routeId + '|' + t.date; if (seen.has(k)) return false; seen.add(k);
      const al = getAllotment(t.routeId, t.date);
      if (!al || !al.hasAllotment) return false;
      if (!(al.availableCapacity > 0 && al.seatsAvailable <= 0)) return false;
      if (typeof bkV2IsRouteOpenOn === 'function' && !bkV2IsRouteOpenOn(t.routeId, t.date)) return false;
      hit = { rid: t.routeId, d: t.date, cap: al.availableCapacity, bkd: al.seatsConsumed,
              route: (ROUTES.find(x => x.id === t.routeId) || {}).name };
      return true;
    });
  });
  /* ไม่มีทริปที่เต็มเองตามธรรมชาติ · ทำให้เต็มด้วยกลไกของระบบเอง
     ล็อกที่นั่งที่เหลือทั้งหมดไว้ → กองที่ขายได้เหลือศูนย์ แต่ความจุยังมีอยู่ = "เต็มจริง"
     ต่างจากแถวค้างตรงที่ยังมีเรือ มีที่นั่ง และยังมีคนจองอยู่ · เก็บกวาดท้ายข้อ */
  let snap = null;
  if (!hit) {
    const seen2 = new Set();
    (SB_BOOKINGS || []).some(b => {
      if (['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)) return false;
      return (b.trips || []).some(t => {
        if (!t.date || !t.routeId) return false;
        const k = t.routeId + '|' + t.date; if (seen2.has(k)) return false; seen2.add(k);
        const al = getAllotment(t.routeId, t.date);
        if (!al || !al.hasAllotment || al.availableCapacity <= 0 || al.seatsAvailable <= 0) return false;
        if (typeof bkV2IsRouteOpenOn === 'function' && !bkV2IsRouteOpenOn(t.routeId, t.date)) return false;
        if (typeof SB_SEAT_LOCKS === 'undefined') return false;
        snap = JSON.stringify(SB_SEAT_LOCKS);
        SB_SEAT_LOCKS.push({ id: 'lkTEST2', scope: 'day', routeId: t.routeId, date: t.date, month: '',
          boatId: null, holderType: 'office', holderId: null, qty: al.seatsAvailable, used: 0,
          reason: 'test fill', expiry: '', status: 'active', createdAt: t.date, createdBy: 'test' });
        const al2 = getAllotment(t.routeId, t.date);
        if (al2.seatsAvailable > 0 || al2.availableCapacity <= 0) {
          SB_SEAT_LOCKS.length = 0; JSON.parse(snap).forEach(x => SB_SEAT_LOCKS.push(x)); snap = null;
          return false;
        }
        hit = { rid: t.routeId, d: t.date, cap: al2.availableCapacity, bkd: al2.seatsConsumed,
                route: (ROUTES.find(x => x.id === t.routeId) || {}).name, made: 1 };
        return true;
      });
    });
  }
  if (!hit) return { skip: 'ชุดนี้ไม่มีทริปที่ขายเต็มจริง และทำให้เต็มไม่ได้' };
  bkV2Tab2ClearFilters(); bkV2Tab2PickDay(hit.d);
  const t = [].slice.call(document.querySelectorAll('.bt-tgp'))
    .find(x => ((x.querySelector('.nm') || {}).textContent || '').trim() === hit.route);
  const em = t && t.querySelector('.bt-tgh .sm em');
  const out = { ...hit, badge: em ? (em.textContent || '').trim() : '(ไม่เจอการ์ด)',
                ghost: !!(t && t.querySelector('.bt-ghost')) };
  if (snap) { SB_SEAT_LOCKS.length = 0; JSON.parse(snap).forEach(x => SB_SEAT_LOCKS.push(x));
              out.restored = JSON.stringify(SB_SEAT_LOCKS) === snap; }
  return out;
});
if (R4.skip) console.log('  ! ' + R4.skip + ' · ข้ามข้อ 4');
else if (R4.badge !== 'full')
  fail('ทริปที่ขายเต็มจริง (' + R4.route + ' ' + R4.d + ' · ' + R4.bkd + '/' + R4.cap
     + ') ขึ้น "' + R4.badge + '" · ต้องยังเป็น full');
else if (R4.ghost)
  fail('ทริปที่ยังมีคนจองอยู่ (' + R4.route + ' ' + R4.d + ') ติดป้ายแถวค้าง');
else if (R4.made && R4.restored === false) fail('ข้อ 4 คืนตารางล็อกไม่ครบ');
else ok('ทริปที่ขายเต็มจริงยังขึ้น full เหมือนเดิม · ' + R4.route + ' ' + R4.d
      + ' ' + R4.bkd + '/' + R4.cap + ' · และไม่ติดป้ายแถวค้าง'
      + (R4.made ? ' (ทำให้เต็มด้วยล็อกที่นั่ง แล้วคืนตารางครบ)' : ''));

/* ══ 5 · ทริปที่ยังมีคนจองอยู่ ต้องไม่ติดป้ายแถวค้าง ═════════════════════ */
const R5 = await page.evaluate((solid) => {
  const out = [];
  solid.forEach(s => {
    bkV2Tab2ClearFilters(); bkV2Tab2PickDay(s.d);
    const t = [].slice.call(document.querySelectorAll('.bt-tgp'))
      .find(x => ((x.querySelector('.nm') || {}).textContent || '').trim() === s.route);
    if (t && t.querySelector('.bt-ghost')) out.push(s.route + ' ' + s.d);
  });
  return { wrong: out, n: solid.length };
}, R0.solid);
if (!R5.n) console.log('  ! ไม่มีทริปที่ยังมีคนจองในกลุ่มตัวอย่าง · ข้ามข้อ 5');
else if (R5.wrong.length)
  fail('ทริปที่ยังมีคนจองติดป้ายแถวค้าง ' + R5.wrong.length + ' รายการ · ' + R5.wrong.slice(0, 3).join(' · '));
else ok('ทริปที่ยังมีคนจองไม่ติดป้ายแถวค้างสักรายการ · ตรวจ ' + R5.n + ' ทริป');

/* ══ 6 · กระดานไม่เขียนข้อมูลจริง ═══════════════════════════════════════ */
const R6 = await page.evaluate(() => {
  const a = JSON.stringify(SB_BOOKINGS), b = JSON.stringify(TRIPS);
  const c = (typeof SB_SEAT_LOCKS !== 'undefined') ? JSON.stringify(SB_SEAT_LOCKS) : '';
  bkV2Tab2ClearFilters();
  [1, 2, 3].forEach(() => { if (typeof bkV2RenderTab2 === 'function') bkV2RenderTab2(); });
  return { bk: JSON.stringify(SB_BOOKINGS) === a, tr: JSON.stringify(TRIPS) === b,
           lk: ((typeof SB_SEAT_LOCKS !== 'undefined') ? JSON.stringify(SB_SEAT_LOCKS) : '') === c };
});
if (!R6.bk || !R6.tr || !R6.lk) fail('วาดกระดานแล้วข้อมูลจริงเปลี่ยน · กระดานนี้ต้องอ่านอย่างเดียว');
else ok('วาดกระดานซ้ำหลายรอบแล้ว SB_BOOKINGS / TRIPS / SB_SEAT_LOCKS ไม่ขยับ');

/* ══ 7 · ไม่มี error บนหน้า ═══════════════════════════════════════════════ */
if (errors.length) fail('มี error ' + errors.length + ' ครั้ง · ' + errors.slice(0, 2).join(' | '));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
