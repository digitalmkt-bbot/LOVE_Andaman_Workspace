// §flDeployBook · Fleet Deployment · ยอดจองที่เข้ามาแล้วบนปฏิทินวางกำลัง
//
// ที่มา (2026-09-24) · "ขอนำเข้าจำนวนที่ที่มีการจองมาแล้วเข้ามาด้วย"
// วางกำลังโดยไม่เห็นยอดจอง = วางมั่ว · ลำที่วางไว้ 4 ลำ 225 ที่ จะรู้ว่าพอไหม
// ต้องเทียบกับที่ขายไปแล้ว
//
// เทสนี้กันห้าอย่าง
//   1 ยอดจองในช่องวันตรงกับที่คำนวณเองจาก SB_BOOKINGS ดิบ ไม่ใช่ถามหน้าเอา
//   2 ใบยกเลิกต้องไม่ถูกนับ · ยกเลิกแล้วที่นั่งต้องคืนกอง
//   3 เรือเหมาลำต้องแยกออกจากกองขายรายที่ · ไม่งั้น "ว่าง" บวมเกินจริง
//   4 ว่าง = ที่วางไว้ − ที่จองแล้ว · จองเกินที่วางไว้ต้องขึ้น "เกิน" ไม่ใช่ติดลบ
//   5 กดไม่นับเรือในแผน แล้วกองที่ขายได้ต้องลดตาม (ยอดจองเป็นของจริง ไม่ขยับ)
//
// ⚠ ใช้ blob subset_month · เป็นชุดเดียวที่มียอดจองล่วงหน้าครอบทั้งไฮซีซั่น
// ⚠ ทุกข้อคำนวณค่าที่คาดหวังจาก SB_BOOKINGS/ROUTES/TRIPS ดิบเอง ไม่เรียกตัวนับของหน้า
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1300 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1000);

/* สูตรนับ pax ที่เขียนเองในเทส · ตรงกับกติกาที่ระบบใช้ แต่ไม่ได้เรียกของระบบ */
const PAXSUM = `t => { const p = t.pax || {};
  return ['ad','ad_fr','ad_th','chd','chd_fr','chd_th','inf','inf_fr','inf_th','foc','foc_fr','foc_th']
    .reduce((s,k) => s + (+p[k] || 0), 0); }`;

/* ══ 0 · เปิดหน้า แล้วหาเดือนที่มียอดจองจริง ═══════════════════════════════ */
const R0 = await page.evaluate((paxSrc) => {
  const pax = eval(paxSrc);
  /* ถ่ายรูป TRIPS ไว้ตั้งแต่ก่อนหน้านี้ถูกวาดครั้งแรก · ข้อ 7 เอาไปเทียบ
     ถ่ายทีหลังไม่มีประโยชน์ · ถ้าการวาดแอบสร้างช่องวันเปล่าไว้ มันสร้างไปแล้วตั้งแต่รอบแรก */
  window.__snapT0 = JSON.stringify(TRIPS);
  const el = document.querySelector('.nav-item[data-view="fl-deployment"]');
  if (!el) return { err: 'ไม่มีเมนู Fleet Deployment' };
  nav(el);
  _fdPlan = { pier: [], drop: [], trip: {}, avail: {}, boats: [], ready: {} }; fdPlanSave();
  /* หาคู่ (ท่า, เดือน) ที่มียอดจองมากที่สุดในฤดูที่หน้านี้เปิดอยู่ · จะได้ทดสอบกับของจริง */
  const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
  const tally = {};
  (SB_BOOKINGS || []).forEach(b => {
    if (CXL.includes(b.status)) return;
    (b.trips || []).forEach(t => {
      if (!t.date || t.bookingMode === 'charter') return;
      const r = (ROUTES || []).find(x => x && x.id === t.routeId);
      if (!r || !r.pier) return;
      const k = r.pier + '|' + t.date.slice(0, 7);
      tally[k] = (tally[k] || 0) + pax(t);
    });
  });
  const months = fdMonths();
  const best = Object.keys(tally)
    .filter(k => months.indexOf(k.split('|')[1]) >= 0)
    .sort((a, z) => tally[z] - tally[a])[0];
  if (!best) return { err: 'ชุดนี้ไม่มียอดจองในเดือนที่อยู่ในฤดู' };
  const [pier, month] = best.split('|');
  fdTab('month'); fdSetPier(pier); fdSetMonth(month); flRenderDeployment();
  return { pier, month, pax: tally[best], months: months.length };
}, PAXSUM);
if (R0.err) { fail(R0.err); console.log('\nพัง ' + bad); await close(); process.exit(1); }
ok('เปิดหน้าที่ ' + R0.pier + ' เดือน ' + R0.month + ' · ชุดนี้มียอดจองในเดือนนั้น ' + R0.pax + ' ที่');

/* ══ 1 · ยอดจองในช่องวันต้องตรงกับที่คำนวณเองจาก SB_BOOKINGS ดิบ ════════════
   นับเอง: ทุก trip ของใบที่ไม่ยกเลิก · ไม่ใช่เหมาลำ · เส้นทางอยู่ท่านี้ · วันตรงกัน */
const R1 = await page.evaluate((paxSrc) => {
  const pax = eval(paxSrc);
  const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
  const pier = _fdPier, month = _fdMonth;
  const want = {};
  (SB_BOOKINGS || []).forEach(b => {
    if (CXL.includes(b.status)) return;
    (b.trips || []).forEach(t => {
      if (!t.date || t.date.slice(0, 7) !== month) return;
      if (t.bookingMode === 'charter') return;
      const r = (ROUTES || []).find(x => x && x.id === t.routeId);
      if (!r || (r.pier || '') !== pier) return;
      want[t.date] = (want[t.date] || 0) + pax(t);
    });
  });
  const got = {}, cells = [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-day:not(.pad)'));
  cells.forEach((c, i) => {
    const d = month + '-' + String(i + 1).padStart(2, '0');
    const el = c.querySelector('.fd-bk b');
    if (el) { const m = /จอง\s*(\d+)/.exec(el.textContent || ''); if (m) got[d] = +m[1]; }
  });
  const wrong = [], missing = [];
  Object.keys(want).forEach(d => {
    if (!want[d]) return;
    if (got[d] === undefined) { missing.push(d + ' (ควรขึ้น ' + want[d] + ')'); return; }
    if (got[d] !== want[d]) wrong.push(d + ' หน้าจอ ' + got[d] + ' ควรเป็น ' + want[d]);
  });
  const ghost = Object.keys(got).filter(d => !want[d]).map(d => d + ' ขึ้น ' + got[d] + ' ทั้งที่ไม่มีจอง');
  return { wrong, missing, ghost, days: Object.keys(want).filter(d => want[d]).length,
           total: Object.keys(want).reduce((s, d) => s + want[d], 0) };
}, PAXSUM);
if (R1.missing.length)
  fail('วันที่มีจองแต่ช่องไม่ขึ้นยอด ' + R1.missing.length + ' วัน · ' + R1.missing.slice(0, 3).join(' · '));
else if (R1.wrong.length)
  fail('ยอดจองไม่ตรง ' + R1.wrong.length + ' วัน · ' + R1.wrong.slice(0, 3).join(' · '));
else if (R1.ghost.length)
  fail('ช่องขึ้นยอดจองทั้งที่ไม่มีใบจอง ' + R1.ghost.length + ' วัน · ' + R1.ghost.slice(0, 3).join(' · '));
else ok('ยอดจองในช่องวันตรงกับที่นับเองจาก SB_BOOKINGS ดิบทั้ง ' + R1.days + ' วัน · รวม ' + R1.total + ' ที่');

/* ══ 2 · ใบที่ยกเลิกต้องไม่ถูกนับ ══════════════════════════════════════════
   ยกเลิกใบหนึ่งชั่วคราวแล้ววาดใหม่ · ยอดต้องลดเท่า pax ของใบนั้นพอดี แล้วคืนค่าเดิม */
const R2 = await page.evaluate((paxSrc) => {
  const pax = eval(paxSrc);
  const pier = _fdPier, month = _fdMonth;
  const read = d => {
    const i = +d.slice(-2) - 1;
    const c = [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-day:not(.pad)'))[i];
    const el = c && c.querySelector('.fd-bk b');
    const m = el && /จอง\s*(\d+)/.exec(el.textContent || '');
    return m ? +m[1] : 0;
  };
  /* หาใบที่ยังไม่ยกเลิก มี trip ในเดือนนี้ ท่านี้ และมี pax */
  let hit = null;
  (SB_BOOKINGS || []).some(b => {
    if (['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)) return false;
    return (b.trips || []).some(t => {
      if (!t.date || t.date.slice(0, 7) !== month || t.bookingMode === 'charter') return false;
      const r = (ROUTES || []).find(x => x && x.id === t.routeId);
      if (!r || (r.pier || '') !== pier) return false;
      if (!pax(t)) return false;
      hit = { b, date: t.date, pax: pax(t) };
      return true;
    });
  });
  if (!hit) return { skip: 'ไม่มีใบจองที่ใช้ทดสอบได้' };
  const before = read(hit.date);
  const was = hit.b.status;
  hit.b.status = 'cancelled'; flRenderDeployment();
  const after = read(hit.date);
  hit.b.status = was; flRenderDeployment();
  const back = read(hit.date);
  return { date: hit.date, pax: hit.pax, before, after, back, bk: hit.b.id || hit.b.code || '' };
}, PAXSUM);
if (R2.skip) console.log('  ! ' + R2.skip + ' · ข้ามข้อ 2');
else if (R2.before - R2.after !== R2.pax)
  fail('ยกเลิกใบ ' + R2.bk + ' (' + R2.pax + ' คน) แล้วยอดลด ' + (R2.before - R2.after)
     + ' · ควรลด ' + R2.pax + ' — ใบยกเลิกยังถูกนับอยู่');
else if (R2.back !== R2.before) fail('คืนสถานะใบแล้วยอดไม่กลับเท่าเดิม');
else ok('ใบยกเลิกไม่ถูกนับ · ยกเลิก ' + R2.bk + ' วันที่ ' + R2.date + ' แล้วยอดลด ' + R2.pax
      + ' ที่พอดี คืนสถานะแล้วกลับเท่าเดิม');

/* ══ 3 · เรือเหมาลำต้องแยกออกจากกองขายรายที่ ═══════════════════════════════
   เหมาลำกินทั้งลำ ไม่ได้กินทีละที่นั่ง · ถ้ายังนับรวม "ว่าง" จะบวมเกินจริงทั้งวัน */
const R3 = await page.evaluate(() => {
  const pier = _fdPier, month = _fdMonth;
  const findCh = () => {
    for (let i = 1; i <= 31; i++) {
      const d = month + '-' + String(i).padStart(2, '0');
      if (d.slice(0, 7) !== month) continue;
      const day = (TRIPS || {})[d] || {};
      const ch = Object.keys(day).filter(id => {
        const r = (ROUTES || []).find(x => x && x.id === day[id].route);
        if (!r || (r.pier || '') !== pier) return false;
        return !!(day[id].charterBookingId || day[id].type === 'charter');
      });
      if (ch.length) return { d, ch };
    }
    return null;
  };
  let hit = findCh(), fixture = null;
  /* ชุดข้อมูลก่อนเปิดฤดูมักยังไม่มีใครวางเรือเลย · วางของทดสอบเองแล้วคืนค่าเดิมท้ายข้อ
     สองลำบนเส้นเดียวกัน ลำหนึ่งธงเหมา · จะได้เห็นว่าฝั่งไหนเข้ากองขายรายที่ */
  if (!hit) {
    let day = null;
    for (let i = 1; i <= 31 && !day; i++) {
      const d = month + '-' + String(i).padStart(2, '0');
      if (d.slice(0, 7) !== month) continue;
      const rs = fdOpenRoutes(pier, d);
      if (!rs.length) continue;
      const fleet = fdBoatsAt(pier, d).filter(b => (b.cap || 0) > 0 && !((TRIPS || {})[d] || {})[b.id]);
      if (fleet.length < 2) continue;
      day = { d, r: rs[0].id, a: fleet[0].id, b: fleet[1].id };
    }
    if (!day) return { skip: 'ชุดนี้ไม่มีเรือเหมาลำ และวางของทดสอบไม่ได้' };
    const had = Object.prototype.hasOwnProperty.call(TRIPS, day.d);
    TRIPS[day.d] = TRIPS[day.d] || {};
    fixture = { d: day.d, had, snap: JSON.stringify(TRIPS[day.d]) };
    TRIPS[day.d][day.a] = { route: day.r, type: 'normal', booked: 0 };
    TRIPS[day.d][day.b] = { route: day.r, type: 'charter', charterBookingId: 'TEST-CH', booked: 0 };
    flRenderDeployment();
    hit = findCh();
    if (!hit) { if (fixture.had) TRIPS[fixture.d] = JSON.parse(fixture.snap); else delete TRIPS[fixture.d];
                flRenderDeployment();
                return { skip: 'วางของทดสอบแล้วแต่หน้ายังไม่เห็นเรือเหมา' }; }
  }
  /* คำนวณเอง · กองขายรายที่ = ลำที่วางไว้ หักลำที่ถูกเหมา */
  const day = (TRIPS || {})[hit.d] || {};
  let pool = 0, chSeat = 0;
  Object.keys(day).forEach(id => {
    const r = (ROUTES || []).find(x => x && x.id === day[id].route);
    if (!r || (r.pier || '') !== pier) return;
    const b = (BOATS || []).find(x => x && x.id === id);
    if (!b || b.retired) return;
    if (hit.ch.indexOf(id) >= 0) chSeat += (b.cap || 0); else pool += (b.cap || 0);
  });
  const i = +hit.d.slice(-2) - 1;
  const c = [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-day:not(.pad)'))[i];
  const box = c && c.querySelector('.fd-bk');
  const txt = box ? (box.textContent || '') : '';
  const mb = /จอง\s*(\d+)/.exec(txt), mf = /ว่าง\s*(\d+)/.exec(txt), mo = /เกิน\s*(\d+)/.exec(txt);
  const mc = /เหมา\s*(\d+)\s*ลำ/.exec(txt);
  const booked = mb ? +mb[1] : 0;
  const out = { d: hit.d, chN: hit.ch.length, chSeat, pool, booked, txt: txt.trim(), fixture: !!fixture,
           free: mf ? +mf[1] : null, over: mo ? +mo[1] : null, shownCh: mc ? +mc[1] : 0,
           wantFree: Math.max(0, pool - booked), wantOver: Math.max(0, booked - pool) };
  if (fixture) {
    if (fixture.had) TRIPS[fixture.d] = JSON.parse(fixture.snap); else delete TRIPS[fixture.d];
    flRenderDeployment();
    out.restored = fixture.had ? (JSON.stringify(TRIPS[fixture.d]) === fixture.snap)
                               : !Object.prototype.hasOwnProperty.call(TRIPS, fixture.d);
  }
  return out;
});
if (R3.skip) console.log('  ! ' + R3.skip + ' · ข้ามข้อ 3');
else {
  const b3 = [];
  if (R3.shownCh !== R3.chN) b3.push('ช่องบอกเหมา ' + R3.shownCh + ' ลำ · จริง ' + R3.chN);
  if (R3.wantOver) {
    if (R3.over !== R3.wantOver) b3.push('ควรขึ้น "เกิน ' + R3.wantOver + '" แต่ได้ ' + R3.over);
  } else if (R3.free !== R3.wantFree) {
    b3.push('ว่าง ' + R3.free + ' · ควรเป็น ' + R3.wantFree
          + ' (กอง ' + R3.pool + ' − จอง ' + R3.booked + ') — ที่นั่งเรือเหมา ' + R3.chSeat + ' ถูกนับรวมเข้ามา');
  }
  if (R3.fixture && !R3.restored) b3.push('วางของทดสอบแล้วคืน TRIPS ไม่ครบ');
  if (b3.length) fail('เรือเหมาลำ · ' + b3.join(' · '));
  else ok('เรือเหมาลำแยกออกจากกองขายรายที่ · ' + R3.d + ' เหมา ' + R3.chN + ' ลำ ' + R3.chSeat
      + ' ที่ · กองที่เหลือ ' + R3.pool + ' จอง ' + R3.booked + ' → ' + R3.txt.replace(/\s+/g, ' ')
      + (R3.fixture ? ' (วางของทดสอบเองแล้วคืน TRIPS ครบ)' : ''));
}

/* ══ 4 · ว่าง/เกิน ต้องคิดจากกำลังที่วางไว้ ไม่ใช่ติดลบ ════════════════════ */
const R4 = await page.evaluate(() => {
  const month = _fdMonth;
  const bad = [];
  let checked = 0, overDays = 0, noneDays = 0;
  [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-day:not(.pad)')).forEach((c, i) => {
    const box = c.querySelector('.fd-bk'); if (!box) return;
    const d = month + '-' + String(i + 1).padStart(2, '0');
    const t = box.textContent || '';
    const mb = /จอง\s*(\d+)/.exec(t), mf = /ว่าง\s*(\d+)/.exec(t), mo = /เกิน\s*(\d+)/.exec(t);
    const mn = /ยังไม่ได้ใส่เรือ/.test(t);
    if (!mb) return;
    checked++;
    /* กองที่ขายได้จริงของวันนั้น · คำนวณเองจาก TRIPS เพื่อดูว่าหน้าเลือกคำพูดถูกกรณีไหม */
    const day = (TRIPS || {})[d] || {};
    let pool = 0, chN = 0;
    Object.keys(day).forEach(id => {
      const r = (ROUTES || []).find(x => x && x.id === day[id].route);
      if (!r || (r.pier || '') !== _fdPier) return;
      const b = (BOATS || []).find(x => x && x.id === id);
      if (!b || b.retired) return;
      if (day[id].charterBookingId || day[id].type === 'charter') chN++; else pool += (b.cap || 0);
    });
    if (/-\d/.test(t)) bad.push(d + ' มีเลขติดลบ · ' + t.trim());
    if ([mf, mo, mn ? 1 : null].filter(Boolean).length !== 1)
      bad.push(d + ' ต้องบอกอย่างใดอย่างหนึ่ง (ว่าง / เกิน / ยังไม่ได้ใส่เรือ) · ' + t.trim());
    /* ยังไม่ได้ใส่เรือ ≠ จองเกิน · อย่างแรกแปลว่า "ไปวางเรือ" อย่างหลังแปลว่า "เรือไม่พอ" */
    if (pool <= 0 && chN === 0 && !mn) bad.push(d + ' ยังไม่มีเรือเลยแต่ขึ้น "' + t.trim() + '"');
    if (pool > 0 && mn) bad.push(d + ' มีเรือ ' + pool + ' ที่แล้วแต่ยังบอกว่ายังไม่ได้ใส่เรือ');
    if (mn) noneDays++;
    if (mo) { overDays++; if (!box.classList.contains('over')) bad.push(d + ' จองเกินแต่ไม่ติดสีเตือน'); }
  });
  return { bad, checked, overDays, noneDays };
});
if (R4.bad.length) fail('ว่าง/เกิน · ' + R4.bad.slice(0, 3).join(' · '));
else if (!R4.checked) fail('ทั้งเดือนไม่มีช่องไหนขึ้นยอดจองเลย · ทดสอบไม่ได้');
else ok('ทุกช่องบอกสถานะเดียวชัดเจน ไม่มีเลขติดลบ · ตรวจ ' + R4.checked + ' วัน'
      + (R4.noneDays ? (' · ยังไม่ได้ใส่เรือ ' + R4.noneDays + ' วัน (ไม่ได้ขึ้นว่าจองเกิน)') : '')
      + (R4.overDays ? (' · จองเกินกำลังที่วางไว้ ' + R4.overDays + ' วัน ติดสีเตือนครบ') : ''));

/* ══ 4b · วันที่จองเกินกำลังที่วางไว้ ต้องบอกว่า "เกิน" ไม่ใช่ปล่อยว่างติดลบ ═══
   ชุดข้อมูลก่อนเปิดฤดูยังไม่มีใครวางเรือ จึงไม่มีวันไหนเข้ากรณีนี้เองตามธรรมชาติ
   เทสจึงวางเรือลำเล็กที่สุดลงวันที่มียอดจองเยอะ ด้วยร่างของหน้านี้ แล้วเก็บกวาดทีหลัง */
const R4b = await page.evaluate(() => {
  const month = _fdMonth, pier = _fdPier;
  const read = i => {
    const c = [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-day:not(.pad)'))[i];
    const box = c && c.querySelector('.fd-bk'); const t = box ? (box.textContent || '') : '';
    const mb = /จอง\s*(\d+)/.exec(t), mf = /ว่าง\s*(-?\d+)/.exec(t), mo = /เกิน\s*(\d+)/.exec(t);
    return { txt: t.trim(), booked: mb ? +mb[1] : null, free: mf ? +mf[1] : null,
             over: mo ? +mo[1] : null, none: /ยังไม่ได้ใส่เรือ/.test(t),
             cls: box ? box.className : '' };
  };
  for (let i = 1; i <= 31; i++) {
    const d = month + '-' + String(i).padStart(2, '0');
    if (d.slice(0, 7) !== month) continue;
    const rs = fdOpenRoutes(pier, d).filter(r => fdBooked(r.id, d) > 0);
    if (!rs.length) continue;
    const r0 = rs[0], bk = fdBooked(r0.id, d);
    /* ต้องมีลำที่เล็กกว่ายอดจอง จะได้เกิดกรณี "เกิน" จริง · กองเรือจริงไม่มีลำเล็กขนาดนั้น
       จึงใช้ของที่หน้านี้มีอยู่แล้ว · เพิ่มเรือสมมติ 1 ที่นั่งลงในแผน แล้วลบทิ้งท้ายข้อ */
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    _fdAddPier = pier; _fdTab = 'pier'; flRenderDeployment();
    set('fd-nb-name', 'เรือทดสอบจองเกิน'); set('fd-nb-cap', '1'); set('fd-nb-crew', '1');
    set('fd-nb-from', d); set('fd-nb-to', d);
    fdAddSave(pier);
    const nb = (_fdPlan.boats || []).slice(-1)[0];
    _fdTab = 'month'; flRenderDeployment();
    if (!nb || !fdBoatsAt(pier, d).some(x => x.id === nb.id)) {
      _fdPlan.boats = []; fdPlanSave(); flRenderDeployment();
      return { skip: 'เพิ่มเรือสมมติแล้วไม่โผล่ในวันนั้น' };
    }
    fdOpenDay(d); fdAssign(r0.id, d, nb.id); flRenderDeployment();
    const got = read(i - 1);
    _fdPlan.trip = {}; _fdPlan.boats = []; _fdDay = ''; fdPlanSave(); flRenderDeployment();
    const after = read(i - 1);
    return { d, route: r0.name, boat: nb.name, cap: nb.cap || 0, bk, got, after };
  }
  return { skip: 'ไม่มีวันที่จัดกรณีจองเกินได้' };
});
if (R4b.skip) console.log('  ! ' + R4b.skip + ' · ข้ามข้อ 4b');
else {
  const b4 = [];
  const want = R4b.got.booked - R4b.cap;      /* จอง − กองที่วางไว้ */
  if (R4b.got.none) b4.push('วางเรือแล้วแต่ยังบอกว่ายังไม่ได้ใส่เรือ');
  if (R4b.got.free !== null && R4b.got.free < 0) b4.push('ปล่อยว่างติดลบ · ' + R4b.got.txt);
  if (R4b.got.over !== want) b4.push('ควรขึ้น "เกิน ' + want + '" แต่ได้ ' + R4b.got.txt);
  if (!/over/.test(R4b.got.cls)) b4.push('จองเกินแต่ไม่ติดสีเตือน');
  if (!R4b.after.none) b4.push('เก็บร่างแล้วช่องไม่กลับไปเป็น "ยังไม่ได้ใส่เรือ"');
  if (b4.length) fail('จองเกินกำลัง · ' + b4.join(' · '));
  else ok('จองเกินกำลังบอกว่า "เกิน" ไม่ปล่อยติดลบ · ' + R4b.d + ' ' + R4b.route + ' จอง '
      + R4b.got.booked + ' วาง ' + R4b.boat + ' ' + R4b.cap + ' ที่ → เกิน ' + want + ' ติดสีเตือน');
}

/* ══ 5 · กดไม่นับเรือในแผน · กองที่ขายได้ลด แต่ยอดจองเป็นของจริง ต้องไม่ขยับ ══ */
const R5 = await page.evaluate(() => {
  const read = i => {
    const c = [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-day:not(.pad)'))[i];
    const box = c && c.querySelector('.fd-bk'); const t = box ? (box.textContent || '') : '';
    const mb = /จอง\s*(\d+)/.exec(t), mf = /ว่าง\s*(\d+)/.exec(t), mo = /เกิน\s*(\d+)/.exec(t);
    return { booked: mb ? +mb[1] : null, free: mf ? +mf[1] : null, over: mo ? +mo[1] : null,
             none: /ยังไม่ได้ใส่เรือ/.test(t) };
  };
  const month = _fdMonth, pier = _fdPier;
  /* หาวันที่มีทั้งยอดจองและเรือที่วางไว้ แล้วเลือกลำหนึ่งที่วิ่งวันนั้น */
  for (let i = 1; i <= 31; i++) {
    const d = month + '-' + String(i).padStart(2, '0');
    if (d.slice(0, 7) !== month) continue;
    const before = read(i - 1);
    if (!before.booked) continue;
    const day = (TRIPS || {})[d] || {};
    let id = Object.keys(day).find(x => {
      const r = (ROUTES || []).find(y => y && y.id === day[x].route);
      if (!r || (r.pier || '') !== pier) return false;
      if (day[x].charterBookingId || day[x].type === 'charter') return false;
      const b = (BOATS || []).find(y => y && y.id === x);
      return !!(b && !b.retired && (b.cap || 0) > 0);
    });
    /* ก่อนเปิดฤดูมักยังไม่มีใครวางเรือในปฏิทิน · วางเองด้วยร่างของหน้านี้
       (fdAssign คือทางเดียวกับที่คนใช้ และเป็นร่าง ไม่แตะ TRIPS จริง) */
    if (!id) {
      const rs = fdOpenRoutes(pier, d); if (!rs.length) continue;
      const free = fdBoatsAt(pier, d).filter(x => (x.cap || 0) > 0 && !fdTripsOn(d)[x.id]);
      if (!free.length) continue;
      fdOpenDay(d); fdAssign(rs[0].id, d, free[0].id); flRenderDeployment();
      id = free[0].id;
    }
    const b = fdBoat(id);
    if (!b) continue;
    const base = read(i - 1);          /* อ่านใหม่หลังวางเรือ */
    fdReadyToggle(id);
    const after = read(i - 1);
    fdReadyToggle(id);
    const back = read(i - 1);
    /* คืนสภาพให้ข้อถัดไป · ร่างที่วางเองต้องเก็บ และแผงวันต้องปิด */
    _fdPlan.trip = {}; _fdDay = ''; fdPlanSave(); flRenderDeployment();
    return { d, boat: b.name, cap: b.cap || 0, before: base, after, back };
  }
  return { skip: 'ไม่มีวันที่มีทั้งยอดจองและเรือที่วางไว้' };
});
if (R5.skip) console.log('  ! ' + R5.skip + ' · ข้ามข้อ 5');
else if (R5.after.booked !== R5.before.booked)
  fail('กดไม่นับเรือแล้วยอดจองเปลี่ยนจาก ' + R5.before.booked + ' เป็น ' + R5.after.booked
     + ' · ยอดจองเป็นของจริง ห้ามขยับตามตัวเลือกบนกระดาน');
else {
  /* กองลดลงเท่าที่นั่งลำนั้น → ว่างลดเท่ากัน หรือถ้าพลิกเป็นเกินก็ต้องเกินขึ้นมาแทน */
  const b = R5.before, a = R5.after;
  /* กองที่ขายได้ อ่านย้อนจากสิ่งที่ช่องบอก · ยังไม่ได้ใส่เรือ = กอง 0 */
  const poolOf = x => x.none ? 0 : (x.free !== null ? x.booked + x.free : x.booked - x.over);
  const poolB = poolOf(b), poolA = poolOf(a);
  if (poolB - poolA !== R5.cap)
    fail('กดไม่นับ ' + R5.boat + ' (' + R5.cap + ' ที่) แล้วกองที่ขายได้ลด ' + (poolB - poolA)
       + ' · ควรลด ' + R5.cap);
  else if (JSON.stringify(R5.back) !== JSON.stringify(R5.before))
    fail('กดกลับแล้วตัวเลขไม่กลับเท่าเดิม');
  else ok('กดไม่นับ ' + R5.boat + ' วันที่ ' + R5.d + ' · กองที่ขายได้ลด ' + R5.cap
      + ' ที่ แต่ยอดจอง ' + R5.before.booked + ' ไม่ขยับ · กดกลับแล้วเท่าเดิม');
}

/* ══ 6 · แผงขวาต้องบอกยอดจองรายโปรแกรม ════════════════════════════════════
   คนกำลังจะเลือกว่าจะใส่เรือลำไหนเข้าโปรแกรมไหน · ตัวเลขต้องอยู่ตรงที่ตัดสินใจ */
const R6 = await page.evaluate((paxSrc) => {
  const pax = eval(paxSrc);
  const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
  const month = _fdMonth, pier = _fdPier;
  for (let i = 1; i <= 31; i++) {
    const d = month + '-' + String(i).padStart(2, '0');
    if (d.slice(0, 7) !== month) continue;
    if (!fdOpenRoutes(pier, d).length) continue;
    /* นับเองรายโปรแกรมของวันนั้น */
    const want = {};
    (SB_BOOKINGS || []).forEach(b => {
      if (CXL.includes(b.status)) return;
      (b.trips || []).forEach(t => {
        if (t.date !== d || t.bookingMode === 'charter') return;
        const r = (ROUTES || []).find(x => x && x.id === t.routeId);
        if (!r || (r.pier || '') !== pier) return;
        want[r.name] = (want[r.name] || 0) + pax(t);
      });
    });
    if (!Object.keys(want).filter(k => want[k]).length) continue;
    _fdDay = ''; fdOpenDay(d);      /* fdOpenDay เป็นปุ่มสลับ · เคลียร์ก่อนกันเผลอปิดแผง */
    const rows = [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-dpr'));
    const got = {};
    rows.forEach(row => {
      const nm = ((row.querySelector('.rh b') || {}).textContent || '').trim();
      const bk = row.querySelector('.fd-rbk b');
      const m = bk && /จองแล้ว\s*(\d+)/.exec(bk.textContent || '');
      if (m) got[nm] = +m[1];
    });
    const wrong = [];
    Object.keys(want).forEach(nm => {
      if (!want[nm]) return;
      if (got[nm] === undefined) wrong.push(nm + ' ไม่ขึ้นยอด (ควรเป็น ' + want[nm] + ')');
      else if (got[nm] !== want[nm]) wrong.push(nm + ' ขึ้น ' + got[nm] + ' ควรเป็น ' + want[nm]);
    });
    return { d, rows: rows.length, wrong, n: Object.keys(want).filter(k => want[k]).length,
             sample: Object.keys(want).filter(k => want[k])[0], sampleN: want[Object.keys(want).filter(k => want[k])[0]] };
  }
  return { skip: 'ไม่มีวันที่เปิดขายและมียอดจองพร้อมกัน' };
}, PAXSUM);
if (R6.skip) console.log('  ! ' + R6.skip + ' · ข้ามข้อ 6');
else if (R6.wrong.length)
  fail('ยอดจองรายโปรแกรมในแผงขวาไม่ตรง ' + R6.wrong.length + ' รายการ · ' + R6.wrong.slice(0, 3).join(' · '));
else ok('แผงขวาบอกยอดจองรายโปรแกรมตรงกับที่นับเอง ' + R6.n + ' โปรแกรม · ' + R6.d
      + ' เช่น ' + R6.sample + ' ' + R6.sampleN + ' ที่');

/* ══ 7 · ยอดจองเป็นของอ่านอย่างเดียว · ต้องไม่เขียนกลับระบบ ════════════════ */
const R7 = await page.evaluate(() => {
  const snapB = JSON.stringify(SB_BOOKINGS);
  fdTab('month'); flRenderDeployment();
  _fdDay = ''; fdOpenDay(_fdMonth + '-15');
  fdTab('pier'); flRenderDeployment(); fdTab('month'); flRenderDeployment();
  const now = JSON.stringify(TRIPS);
  const was = window.__snapT0 || now;
  /* ต่างตรงไหนบ้าง · บอกคีย์แรกที่งอกขึ้นมา จะได้ตามต่อได้ว่าใครสร้าง */
  let grew = null;
  try {
    const A = JSON.parse(was), B = JSON.parse(now);
    const add = Object.keys(B).filter(k => !(k in A));
    const gone = Object.keys(A).filter(k => !(k in B));
    if (add.length) grew = 'งอกมา ' + add.length + ' วัน · ' + add.slice(0, 3).join(' ');
    else if (gone.length) grew = 'หายไป ' + gone.length + ' วัน · ' + gone.slice(0, 3).join(' ');
  } catch (_) {}
  return { bkSame: JSON.stringify(SB_BOOKINGS) === snapB, tripSame: now === was, grew,
           days: Object.keys(JSON.parse(now)).length };
});
if (!R7.bkSame)       fail('เปิดดูยอดจองแล้ว SB_BOOKINGS จริงเปลี่ยน · หน้านี้ต้องอ่านอย่างเดียว');
else if (!R7.tripSame)
  fail('เปิดดูยอดจองแล้ว TRIPS จริงเปลี่ยน · หน้านี้ต้องอ่านอย่างเดียว'
     + (R7.grew ? (' · ' + R7.grew) : ''));
else ok('ยอดจองเป็นของอ่านอย่างเดียว · วาดหน้าซ้ำหลายรอบแล้ว SB_BOOKINGS/TRIPS ('
      + R7.days + ' วัน) เหมือนตอนเปิดหน้าทุกตัวอักษร');

/* ══ 8 · ไม่มี error บนหน้า ═══════════════════════════════════════════════ */
if (errors.length) fail('มี error ' + errors.length + ' ครั้ง · ' + errors.slice(0, 2).join(' | '));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
