// §closeNoWarn · ปิดวันขายแล้วต้องเตือนเสมอ ถ้าวันนั้นมีคนจองไว้
//
// ที่มา (2026-09-24) · ผู้ใช้เจอเอง · "ปกติตอนจะปิด โปรแกรมจะเตือนว่ามีจองอยู่
// แต่ช่วง 1-14/10 กดปิด ไม่มีเตือน"
//
// รากของปัญหา · ด่านเดิมข้ามคำเตือนทั้งดุ้นเมื่อวันนั้นมี override อยู่แล้ว
// โดยถือว่า "ล้าง override = ย้อนกลับ ย้อนกลับไม่เซอร์ไพรส์ใคร"
// ซึ่งไม่จริงกับวันที่อยู่นอกทุกฤดูกาล · วันพวกนั้นถูกเปิดขายด้วย override
// ล้าง override = ปิดวันนั้นเต็ม ๆ และเงียบสนิท
//
// เทสนี้กันห้าอย่าง
//   1 วันในช่องว่างระหว่างฤดูที่เปิดด้วย override และมีคนจอง · กดปิดต้องเตือน
//   2 กล่องเตือนต้องบอกเลขใบและจำนวนคนให้ตรงกับที่นับเองจาก SB_BOOKINGS ดิบ
//   3 กดปิดแล้วยังไม่ยืนยัน · วันนั้นต้องยังเปิดขายอยู่เหมือนเดิม
//   4 วันที่ไม่มีใครจองต้องไม่เตือน (ไม่งั้นคนจะกดผ่านจนชิน แล้วเตือนจริงก็ไม่อ่าน)
//   5 ทิศตรงข้าม · กดเปิดวันที่ปิดอยู่ ต้องไม่เตือน
//
// ⚠ ทุกข้อคำนวณค่าที่คาดหวังจาก ROUTES/SB_BOOKINGS ดิบเอง ไม่เรียกตัวนับของหน้า
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1100 });
let autoAccept = true;
page.on('dialog', d => { if (autoAccept) d.accept(); else d.dismiss(); });
await page.waitForTimeout(1000);

const PAXSUM = `t => { const p = t.pax || {};
  return ['ad','ad_fr','ad_th','chd','chd_fr','chd_th','inf','inf_fr','inf_th','foc','foc_fr','foc_th']
    .reduce((s,k) => s + (+p[k] || 0), 0); }`;

/* ══ 0 · หาวันที่เข้าเงื่อนไขของบั๊กจริง ═══════════════════════════════════
   เงื่อนไข · เปิดขายอยู่ด้วย override · ฤดูกาลข้างใต้บอกว่าปิด · และมีคนจองไว้ */
const R0 = await page.evaluate((paxSrc) => {
  const pax = eval(paxSrc);
  const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
  /* นับ pax รายเส้น-รายวันเองจาก SB_BOOKINGS ดิบ */
  const booked = {};
  (SB_BOOKINGS || []).forEach(b => {
    if (CXL.includes(b.status)) return;
    if (b.schemaVer === 2 && Array.isArray(b.trips)) {
      b.trips.forEach(t => {
        if (!t.date || !t.routeId) return;
        const k = t.routeId + '|' + t.date;
        booked[k] = booked[k] || { pax: 0, refs: [] };
        booked[k].pax += pax(t);
        booked[k].refs.push(b.code || b.ref || b.id);
      });
    } else if (b.programId && b.travelDate) {
      const p = b.pax || {};
      const k = b.programId + '|' + b.travelDate;
      booked[k] = booked[k] || { pax: 0, refs: [] };
      booked[k].pax += (p.adult || 0) + (p.child || 0) + (p.infant || 0);
      booked[k].refs.push(b.code || b.id);
    }
  });
  /* หาวันที่ "เปิดด้วย override แต่ฤดูกาลข้างใต้ปิด" · คือช่องว่างระหว่างฤดู */
  const out = [];
  (ROUTES || []).forEach(r => {
    Object.keys(r.overrides || {}).forEach(ds => {
      if (r.overrides[ds] !== 'open') return;
      /* ฤดูกาลข้างใต้ว่าอย่างไร · ดูเองจาก r.seasons ไม่ได้เรียก getDayStatus */
      const s = (r.seasons || []).find(x => x.from <= ds && x.to >= ds);
      const underneath = s ? s.type : ((r.seasons || []).some(x => x.type === 'open') ? 'closed' : 'open');
      if (underneath !== 'closed') return;
      const k = r.id + '|' + ds;
      out.push({ rid: r.id, route: r.name, ds, pax: (booked[k] || {}).pax || 0,
                 refs: ((booked[k] || {}).refs || []).slice(0, 4) });
    });
  });
  const withBk = out.filter(x => x.pax > 0).sort((a, z) => z.pax - a.pax);
  const noBk   = out.filter(x => !x.pax);
  return { n: out.length, withBk: withBk.slice(0, 6), noBk: noBk.slice(0, 3),
           nWith: withBk.length, nNo: noBk.length };
}, PAXSUM);
if (!R0.nWith) { fail('ชุดนี้ไม่มีวันที่เข้าเงื่อนไข (เปิดด้วย override ทับฤดูที่ปิด และมีคนจอง)');
                 console.log('\nพัง ' + bad); await close(); process.exit(1); }
ok('เจอวันที่เข้าเงื่อนไขของบั๊ก ' + R0.n + ' วัน · มีคนจองอยู่ ' + R0.nWith + ' วัน · '
  + 'หนักสุด ' + R0.withBk[0].route + ' ' + R0.withBk[0].ds + ' ' + R0.withBk[0].pax + ' คน');

/* เปิดหน้า Programs แล้วเข้าโหมดแก้ไขของเส้นทางนั้น */
const target = R0.withBk[0];
const R1a = await page.evaluate((rid) => {
  const el = [].slice.call(document.querySelectorAll('.nav-item[data-view]'))
    .find(x => /settings|config|program/i.test(x.dataset.view || ''));
  if (el && typeof nav === 'function') nav(el);
  selProgId = rid;                 /* หน้ารายละเอียดอ่านเส้นทางจากตัวนี้ */
  progEditMode = true;             /* ปุ่ม Modify · ด่านจะไม่ทำงานถ้าไม่อยู่ในโหมดแก้ไข */
  if (typeof renderSettings === 'function') renderSettings();
  return { edit: !!progEditMode, cells: document.querySelectorAll('[onclick*="toggleDayOverrideGuarded"]').length };
}, target.rid);
if (!R1a.edit) fail('เข้าโหมดแก้ไขของหน้า Programs ไม่ได้');
else if (!R1a.cells) fail('หน้าไม่มีช่องวันที่กดปิดได้เลย · เทสต่อไม่ได้');
else ok('เปิดหน้า Programs ของ "' + target.route + '" ในโหมดแก้ไข · ช่องวันที่กดได้ ' + R1a.cells + ' ช่อง');

/* ══ 1 + 2 + 3 · กดปิดวันที่มีคนจอง · ต้องเตือน ตัวเลขต้องตรง และยังไม่ปิดจริง ══ */
const R1 = await page.evaluate((arg) => {
  const { rid, ds } = arg;
  const r = (ROUTES || []).find(x => x.id === rid);
  const ovBefore = JSON.stringify(r.overrides || {});
  const openBefore = (getDayStatus(r, ds) || {}).type;
  toggleDayOverrideGuarded(rid, ds);
  const modal = document.getElementById('prog-impact-modal');
  const txt = modal ? (modal.textContent || '') : '';
  const mPax = /·\s*(\d+)\s*pax/.exec(txt);
  const mBk  = /bookings affected\s*·\s*(\d+)/i.exec(txt);
  const openAfter = (getDayStatus(r, ds) || {}).type;
  const ovAfter = JSON.stringify(r.overrides || {});
  if (modal) modal.remove();
  return { shown: !!modal, txt: txt.slice(0, 400),
           pax: mPax ? +mPax[1] : null, bk: mBk ? +mBk[1] : null,
           openBefore, openAfter, ovSame: ovBefore === ovAfter };
}, { rid: target.rid, ds: target.ds });
if (!R1.shown)
  fail('กดปิด ' + target.route + ' วันที่ ' + target.ds + ' ที่มีคนจอง ' + target.pax
     + ' คน · ไม่มีกล่องเตือนขึ้นเลย');
else if (R1.pax !== target.pax)
  fail('กล่องเตือนบอก ' + R1.pax + ' คน · นับเองได้ ' + target.pax + ' คน');
else if (R1.openAfter !== 'open')
  fail('ยังไม่ได้กดยืนยัน แต่วันนั้นถูกปิดไปแล้ว · สถานะกลายเป็น ' + R1.openAfter);
else if (!R1.ovSame)
  fail('ยังไม่ได้กดยืนยัน แต่ overrides ถูกแก้ไปแล้ว');
else ok('กดปิดวันที่มีคนจองแล้วเตือนจริง · ' + target.ds + ' · ' + R1.bk + ' ใบ ' + R1.pax
      + ' คน ตรงกับที่นับเองจาก SB_BOOKINGS · ยังไม่กดยืนยัน วันนั้นยังเปิดขายอยู่');

/* ══ 4 · วันเดียวกันแบบไม่มีใครจอง ต้องไม่เตือน ══════════════════════════
   เตือนพร่ำเพรื่อ = คนกดผ่านจนชิน แล้ววันที่มีคนจองจริงก็จะถูกกดผ่านไปด้วย */
const R4 = await page.evaluate((arg) => {
  const { rid, list } = arg;
  const r = (ROUTES || []).find(x => x.id === rid);
  const pick = list.find(x => x.rid === rid) || list[0];
  if (!pick) return { skip: 'ไม่มีวันที่ไม่มีคนจองให้ลอง' };
  const r2 = (ROUTES || []).find(x => x.id === pick.rid);
  const keep = JSON.stringify(r2.overrides || {});
  toggleDayOverrideGuarded(pick.rid, pick.ds);
  const modal = document.getElementById('prog-impact-modal');
  const after = (getDayStatus(r2, pick.ds) || {}).type;
  if (modal) modal.remove();
  /* คืนสภาพ · เทสนี้ไม่ควรทิ้งอะไรไว้ */
  r2.overrides = JSON.parse(keep);
  if (typeof renderSettings === 'function') renderSettings();
  return { route: r2.name, ds: pick.ds, shown: !!modal, after, restored: JSON.stringify(r2.overrides || {}) === keep };
}, { rid: target.rid, list: R0.noBk });
if (R4.skip) console.log('  ! ' + R4.skip + ' · ข้ามข้อ 4');
else if (R4.shown) fail('วันที่ไม่มีใครจอง (' + R4.ds + ') ก็ยังเตือน · คนจะกดผ่านจนชิน');
else if (R4.after !== 'closed') fail('กดปิดวันที่ไม่มีคนจองแล้วไม่ได้ปิดจริง · เป็น ' + R4.after);
else if (!R4.restored) fail('เทสข้อ 4 คืนสภาพ overrides ไม่ครบ');
else ok('วันที่ไม่มีใครจองปิดได้เลยไม่ต้องเตือน · ' + R4.ds + ' ปิดทันที แล้วคืนสภาพครบ');

/* ══ 5 · ทิศตรงข้าม · กดเปิดวันที่ปิดอยู่ ต้องไม่เตือน ═════════════════════ */
const R5 = await page.evaluate((paxSrc) => {
  const pax = eval(paxSrc);
  const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
  /* ต้องเป็นวันที่ "ปิดอยู่ และมีคนจอง" ถึงจะพิสูจน์ได้ว่าด่านดูทิศทางจริง ๆ
     ถ้าเลือกวันปิดที่ไม่มีใครจอง ด่านจะเงียบเพราะไม่มีอะไรกระทบ ไม่ใช่เพราะมันดูทิศถูก
     และต้องเป็นวันที่อยู่ใน "ฤดูเปิด" ด้วย · กดครั้งเดียวจึงจะกลับมาเปิด
     (วันในช่องว่างระหว่างฤดู กดครั้งเดียวได้แค่ล้าง override ยังปิดอยู่ตามฤดู) */
  let pick = null;
  (SB_BOOKINGS || []).some(b => {
    if (CXL.includes(b.status)) return false;
    return (b.trips || []).some(t => {
      if (!t.date || !t.routeId || !pax(t)) return false;
      const r = (ROUTES || []).find(x => x && x.id === t.routeId); if (!r) return false;
      const s = (r.seasons || []).find(x => x.from <= t.date && x.to >= t.date);
      if (!s || s.type !== 'open') return false;
      pick = { rid: r.id, route: r.name, ds: t.date, pax: pax(t) };
      return true;
    });
  });
  if (!pick) return { skip: 'ไม่มีวันในฤดูเปิดที่มีคนจอง' };
  const rid = pick.rid, hit = pick.ds, pax2 = pick.pax;
  const r = (ROUTES || []).find(x => x.id === rid);
  const keep = JSON.stringify(r.overrides || {});
  r.overrides = JSON.parse(keep);
  r.overrides[hit] = 'closed';               /* ปิดไว้ก่อนด้วยมือ แล้วค่อยลองกดเปิด */
  if ((getDayStatus(r, hit) || {}).type !== 'closed') {
    r.overrides = JSON.parse(keep); return { skip: 'ตั้งให้วันนั้นปิดไม่ได้' };
  }
  toggleDayOverrideGuarded(rid, hit);
  const modal = document.getElementById('prog-impact-modal');
  const after = (getDayStatus(r, hit) || {}).type;
  if (modal) modal.remove();
  r.overrides = JSON.parse(keep);
  if (typeof renderSettings === 'function') renderSettings();
  return { ds: hit, pax: pax2, route: pick.route, shown: !!modal, after,
           restored: JSON.stringify(r.overrides || {}) === keep };
}, PAXSUM);
if (R5.skip) console.log('  ! ' + R5.skip + ' · ข้ามข้อ 5');
else if (R5.shown)
  fail('กดเปิดวันที่ปิดอยู่ (' + R5.ds + ') แต่ขึ้นกล่องเตือนปิดวัน · ด่านไม่ได้ดูทิศทาง');
else if (R5.after !== 'open') fail('กดเปิดแล้วไม่ได้เปิด · ' + R5.ds + ' เป็น ' + R5.after);
else if (!R5.restored) fail('เทสข้อ 5 คืนสภาพ overrides ไม่ครบ');
else ok('กดเปิดวันที่ปิดอยู่ไม่ขึ้นคำเตือน แม้วันนั้นจะมีคนจอง ' + R5.pax + ' คน · '
      + R5.route + ' ' + R5.ds + ' เปิดได้ทันที แล้วคืนสภาพครบ');

/* ══ 6 · ทุกวันที่เข้าเงื่อนไขและมีคนจอง ต้องเตือนครบ ไม่ใช่แค่วันที่ลองไป ══ */
const R6 = await page.evaluate((list) => {
  const miss = [];
  list.forEach(x => {
    const r = (ROUTES || []).find(y => y.id === x.rid); if (!r) return;
    const keep = JSON.stringify(r.overrides || {});
    toggleDayOverrideGuarded(x.rid, x.ds);
    const modal = document.getElementById('prog-impact-modal');
    if (!modal) miss.push(x.route + ' ' + x.ds + ' (' + x.pax + ' คน)');
    if (modal) modal.remove();
    r.overrides = JSON.parse(keep);
  });
  if (typeof renderSettings === 'function') renderSettings();
  return { miss, n: list.length };
}, R0.withBk);
if (R6.miss.length)
  fail('ยังมีวันที่กดปิดแล้วไม่เตือน ' + R6.miss.length + ' จาก ' + R6.n + ' วัน · ' + R6.miss.slice(0, 3).join(' · '));
else ok('ลองครบ ' + R6.n + ' วันที่เข้าเงื่อนไขและมีคนจอง · เตือนทุกวัน ไม่มีหลุด');

/* ══ 7 · ไม่มี error บนหน้า ═══════════════════════════════════════════════ */
if (errors.length) fail('มี error ' + errors.length + ' ครั้ง · ' + errors.slice(0, 2).join(' | '));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
