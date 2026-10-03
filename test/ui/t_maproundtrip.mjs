// §lkBulk · ช่วงวันของล็อก Bulk ต้องรอดจากการเดินทางไป-กลับ SQL
//
// ที่มา (2026-09-29) · ผู้ใช้แจ้ง "ปัญหาคือ ทำจองแบบ Bulk เลือกวัน เริ่ม จบ แต่ระบบไม่บันทึกให้ รีเฟรชหาย"
//   วัดฝั่งเบราว์เซอร์แล้ว ถูกทุกขั้น · ฟอร์มเก็บครบ bkV2CreateLock เขียนครบ
//   localStorage มี dateFrom/dateTo/qty ครบ · แต่ตาราง sb_seat_locks ไม่มีคอลัมน์วันเริ่ม-วันจบ
//   decomposeBlob ทิ้งทุกครั้งที่เซฟ · assembleBlob ไม่มีอะไรจะคืนตอนโหลด
//   ล็อกกลับมาเป็น scope='bulk' ที่ไม่มีช่วงวัน → ไม่ครอบรอบไหน → ไม่ขึ้น manifest วันไหนเลย
//   (เป็นสาเหตุเดียวกับที่ล็อกของ Panorama ไม่เคยขึ้นหน้า Manifest)
//
// เทสนี้วัด "ทางที่ข้อมูลเดินจริง" ไม่ได้วัดว่าไฟล์ mapping หน้าตาถูกไหม
//   สร้างล็อกผ่าน bkV2CreateLock / bkV2DrawLock / bkV2LockReleaseRound ซึ่งเป็นทางเดียวกับหน้าจอ
//   แล้วเอา blob ที่แอปเขียนลง localStorage จริง ๆ ยัดผ่าน decomposeBlob → assembleBlob ของเซิร์ฟเวอร์
//   อะไรที่ไม่กลับมา = อะไรที่ผู้ใช้จะเสียหลังรีเฟรช
//
// ⚠ บั๊กชนิดนี้เกิดเป็นครั้งที่สี่ (check-in 25 ก.ค. · pierPayments 2 ส.ค. · pier_sect 14 ส.ค.)
//    §mapDrift ในเซิร์ฟเวอร์จับไม่ได้ เพราะมันเทียบสองไฟล์ฝั่งเซิร์ฟเวอร์กันเอง
//    ฟิลด์ใหม่ที่ไม่มีทั้งใน model และใน mapping สองไฟล์ตรงกันเอง เช็คจึงเงียบ
//    ข้อ 7 ของเทสนี้คือเช็คย้อนทาง · ฟิลด์ใหม่ที่ไม่มีคอลัมน์จะทำให้เทสแดงทันที
//
// เทสนี้กันสิบสามอย่าง
//   1  ล็อก bulk ที่สร้างผ่านทางจริง · dateFrom/dateTo รอดการเดินทางไป-กลับ (อาการที่ผู้ใช้แจ้ง)
//   2  dow (วันในสัปดาห์ที่ติ๊กไว้) รอด · ไม่รอด = ล็อกโผล่ทุกวันหรือไม่โผล่เลย
//   3  usedBy (ที่นั่งที่ถูกดึงไปแล้วแยกรายรอบ) รอด · ไม่รอด = ล็อกที่ขายแล้วดูเหมือนยังว่าง
//   4  releasedDates (รอบที่กดปล่อยคืนแล้ว) รอด · ไม่รอด = รอบที่ปล่อยแล้วกลับมากันที่นั่งใหม่
//   5  log[].tripDate รอด · ไม่รอด = ไล่ที่มาของที่นั่งรายรอบไม่ได้
//   6  ล็อกรายวันและล็อกย่อย (parentId · subName) ยังรอดเหมือนเดิม · ไม่ได้พังของที่เคยดีอยู่
//   7  ทุกค่าที่ไม่ว่างใน blob ทั้งก้อนที่แอปเขียน ต้องกลับมาครบ · เช็คย้อนทางกันบั๊กครั้งที่ห้า
//   8  tools/check-mapping-coverage.mjs ต้องผ่าน blob ก้อนเดียวกันนี้ (ตัวกันใช้งานได้จริง)
//   9  §lkHeal · ล็อกที่ช่วงวันหายไปแล้ว กู้คืนจาก monthFrom/monthTo ได้
//   10 §lkHeal · กู้คืนจากบันทึกการแก้ไข (log[].note ของ §lkEdit) ได้
//   11 §lkHeal · ใบที่ไม่มีร่องรอยเลย ต้องติดป้ายแดงให้กรอกช่วงวันใหม่ ไม่ใช่เงียบ
//   12 ใบที่กู้แล้วต้องกลับมาครอบรอบจริง · พร้อมขึ้น manifest อีกครั้ง
//   13 ไม่มี error บนหน้า

import { open } from './_harness.mjs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const require = createRequire(import.meta.url);
const osRepo = require(path.join(ROOT, 'os-backend/src/mapping/os_repo.js'));

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

// ── ทางไป-กลับของเซิร์ฟเวอร์ · ตัวเดียวกับที่ /api/v1/_batch และ /api/load ใช้ ──
const trip = (key, val) => osRepo.assembleBlob(osRepo.decomposeBlob({ [key]: val }))[key];

const isEmpty = v => v === undefined || v === null || v === ''
  || (Array.isArray(v) && v.length === 0)
  || (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
function same(a, b){
  if (a === b) return true;
  if (isEmpty(a) && isEmpty(b)) return true;
  if (typeof a === 'number' || typeof b === 'number'){
    const x = Number(a), y = Number(b);
    if (Number.isFinite(x) && Number.isFinite(y)) return x === y;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') return String(a) === String(b);
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)){
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (!same(a[k], b[k])) return false;
    return true;
  }
  return false;
}
function lostPaths(orig, back, p, out){
  if (isEmpty(orig)) return;
  if (Array.isArray(orig)){
    if (!Array.isArray(back)){ out.add(p || '(root)'); return; }
    for (let i = 0; i < orig.length; i++) lostPaths(orig[i], back[i], p + '[]', out);
    return;
  }
  if (typeof orig === 'object'){
    if (!back || typeof back !== 'object'){ out.add(p || '(root)'); return; }
    for (const k of Object.keys(orig)) lostPaths(orig[k], back[k], p ? p + '.' + k : k, out);
    return;
  }
  if (!same(orig, back)) out.add(p || '(root)');
}

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1800, height: 1200 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1400);

/* ══ 0 · สร้างล็อกทุกแบบผ่านทางจริง แล้วใช้งานมันจริง ════════════════════ */
const R0 = await page.evaluate(() => {
  const el = document.querySelector('.nav-item[data-view="booking"]');
  if (!el) return { err: 'ไม่มีเมนู Booking' };
  nav(el);
  for (const f of ['bkV2CreateLock','bkV2DrawLock','bkV2LockReleaseRound','bkV2CreateSubLock','bkV2LockHealRange'])
    if (typeof window[f] !== 'function') return { err: 'ยังไม่มีฟังก์ชัน ' + f };

  // เส้นทางที่มีทริปจริงในชุดข้อมูล · และวันที่ของทริปนั้น ๆ
  let rid = '', days = [];
  Object.keys(TRIPS || {}).sort().forEach(ds => {
    Object.keys(TRIPS[ds] || {}).forEach(b => {
      const t = TRIPS[ds][b];
      if (!t || !t.route) return;
      if (!rid) rid = t.route;
      if (t.route === rid && days.indexOf(ds) < 0) days.push(ds);
    });
  });
  if (!rid || days.length < 2) return { err: 'ชุดข้อมูลนี้ไม่มีทริปพอจะวัด' };
  days.sort();
  const d1 = days[0], d2 = days[1];
  const dow1 = new Date(d1 + 'T00:00:00').getDay(), dow2 = new Date(d2 + 'T00:00:00').getDay();

  const before = SB_SEAT_LOCKS.length;

  // ล็อก bulk แบบที่ผู้ใช้ทำ · เลือกวันเริ่ม วันจบ และวันในสัปดาห์
  const B = bkV2CreateLock({ scope:'bulk', routeId:rid, dateFrom:d1, dateTo:d2,
    dow:[dow1, dow2], holderType:'office', holderId:null, qty:12,
    releaseDaysBefore:2, releaseTime:'18:00', reason:'T-RT bulk' });
  bkV2DrawLock(B.id, 4, 'T-RT-BK1', d1);                 // โควตารายรอบ → usedBy
  bkV2LockReleaseRound(B.id, d2, 'T-RT');                // รอบที่ปล่อยคืนแล้ว → releasedDates

  // ล็อกรายวัน + ล็อกย่อย · ของที่เคยทำงานดีอยู่ ต้องไม่พังไปด้วย
  const D = bkV2CreateLock({ scope:'day', routeId:rid, date:d1,
    holderType:'office', holderId:null, qty:6, reason:'T-RT day', expiry:d2 });
  const S = bkV2CreateSubLock(B.id, 'T-RT ย่อย', 3, {});

  // ใบที่ช่วงวันหายไปแล้ว · จำลองสามสภาพที่เจอในฐานจริง
  const H1 = bkV2CreateLock({ scope:'bulk', routeId:rid, dateFrom:'', dateTo:'', dow:[],
    holderType:'office', holderId:null, qty:7, reason:'T-RT heal month' });
  H1.monthFrom = '2026-11'; H1.monthTo = '2026-12'; H1.month = '2026-11';
  const H2 = bkV2CreateLock({ scope:'bulk', routeId:rid, dateFrom:'', dateTo:'', dow:[],
    holderType:'office', holderId:null, qty:8, reason:'T-RT heal editlog' });
  /* สองรายการ · ของเก่าตั้งช่วงไว้อย่างหนึ่ง แล้วถูกแก้ทีหลัง
     ต้องเอาของล่าสุด ไม่ใช่ของที่เจอก่อน · ไม่งั้นกู้คืนมาเป็นช่วงที่เลิกใช้แล้ว */
  H2.log.push({ date:'2026-09-12', type:'edit', by:'RM',
                note:'dateFrom: — → 2026-10-05 · dateTo: — → 2026-10-20' });
  H2.log.push({ date:'2026-09-20', type:'edit', by:'RM',
                note:'qty: 5 → 8 · dateFrom: 2026-10-05 → 2026-11-02 · dateTo: 2026-10-20 → 2026-12-30' });
  const H3 = bkV2CreateLock({ scope:'bulk', routeId:rid, dateFrom:'', dateTo:'', dow:[],
    holderType:'office', holderId:null, qty:9, reason:'T-RT heal nothing' });

  sbSeatLocksPersist();                        // การแก้หลังสร้างต้องลง blob ด้วย ไม่งั้นรอบบูตถัดไปไม่เห็น
  _bkV2.tab = 'locks'; _bkV2LockUI.st = 'all'; bkV2Render();
  return { rid, d1, d2, dow1, dow2, before,
           ids:{ B:B.id, D:D.id, S:S && S.id, H1:H1.id, H2:H2.id, H3:H3.id },

           roundsB:bkV2LockRounds(B) };
});
if (R0.err){ fail(R0.err); await close(); console.log("\n✗ 1 ข้อไม่ผ่าน"); process.exit(1); }
ok('สร้างล็อกผ่านทางจริงแล้ว · bulk ' + R0.d1 + ' → ' + R0.d2 + ' (ติ๊กวัน ' + R0.dow1 + ',' + R0.dow2
   + ') ' + R0.roundsB.total + ' รอบ · ดึงไป 4 ที่ · ปล่อยคืนหนึ่งรอบ · มีรายวันและใบย่อยด้วย');

// blob ที่แอปเขียนลง localStorage จริง ๆ · ไม่ได้ประกอบเอง
const BLOB = await page.evaluate(() => JSON.parse(localStorage.getItem('loveandaman_v2') || '{}'));
const LOCKS = Array.isArray(BLOB.sb_seat_locks) ? BLOB.sb_seat_locks : [];
const BACK  = trip('sb_seat_locks', LOCKS) || [];
const byId  = {}; BACK.forEach(l => { if (l && l.id) byId[l.id] = l; });
const origById = {}; LOCKS.forEach(l => { if (l && l.id) origById[l.id] = l; });
const B0 = origById[R0.ids.B], B1 = byId[R0.ids.B];

/* ══ 1 · ช่วงวัน ══════════════════════════════════════════════════════ */
if (!B0) fail('ไม่เจอล็อกที่สร้างไว้ใน blob ที่แอปเขียน');
else if (!B1) fail('ล็อก bulk ทั้งใบหายไปจากการเดินทางไป-กลับ');
else if (B1.dateFrom !== R0.d1 || B1.dateTo !== R0.d2)
  fail('ช่วงวันของล็อก bulk ไม่รอด · เขียนไป ' + R0.d1 + ' → ' + R0.d2
       + ' กลับมาได้ ' + (B1.dateFrom || '—') + ' → ' + (B1.dateTo || '—')
       + ' (นี่คืออาการที่ผู้ใช้แจ้ง · เซฟแล้วรีเฟรชหาย)');
else ok('ช่วงวันรอด · ' + B1.dateFrom + ' → ' + B1.dateTo);

/* ══ 2 · วันในสัปดาห์ ════════════════════════════════════════════════ */
if (!B1) fail('ข้ามข้อ 2 · ไม่มีล็อกที่กลับมา');
else if (!same(B0.dow, B1.dow))
  fail('dow ไม่รอด · เขียนไป ' + JSON.stringify(B0.dow) + ' กลับมาได้ ' + JSON.stringify(B1.dow)
       + ' (ว่าง = ล็อกโผล่ทุกวันที่เรือออก ไม่ใช่แค่วันที่ติ๊กไว้)');
else ok('dow รอด · ' + JSON.stringify(B1.dow));

/* ══ 3 · โควตารายรอบ ═════════════════════════════════════════════════ */
if (!B1) fail('ข้ามข้อ 3 · ไม่มีล็อกที่กลับมา');
else if (isEmpty(B0.usedBy)) fail('เตรียมเคสไม่สำเร็จ · การดึงที่นั่งไม่ได้เขียน usedBy ไว้');
else if (!same(B0.usedBy, B1.usedBy))
  fail('usedBy ไม่รอด · เขียนไป ' + JSON.stringify(B0.usedBy) + ' กลับมาได้ ' + JSON.stringify(B1.usedBy)
       + ' (หาย = ล็อกที่ขายไปแล้วกลับมาดูเหมือนยังว่างทั้งใบ · ขายซ้ำได้)');
else ok('usedBy รอด · ' + JSON.stringify(B1.usedBy));

/* ══ 4 · รอบที่ปล่อยคืนแล้ว ══════════════════════════════════════════ */
if (!B1) fail('ข้ามข้อ 4 · ไม่มีล็อกที่กลับมา');
else if (isEmpty(B0.releasedDates)) fail('เตรียมเคสไม่สำเร็จ · การปล่อยรอบไม่ได้เขียน releasedDates ไว้');
else if (!same(B0.releasedDates, B1.releasedDates))
  fail('releasedDates ไม่รอด · เขียนไป ' + JSON.stringify(B0.releasedDates)
       + ' กลับมาได้ ' + JSON.stringify(B1.releasedDates)
       + ' (หาย = รอบที่ปล่อยคืนไปแล้วกลับมากันที่นั่งใหม่เอง)');
else ok('releasedDates รอด · ' + JSON.stringify(B1.releasedDates));

/* ══ 5 · log[].tripDate ══════════════════════════════════════════════ */
const tdIn  = (B0 && B0.log || []).filter(x => x && x.tripDate).map(x => x.type + ':' + x.tripDate).sort();
const tdOut = (B1 && B1.log || []).filter(x => x && x.tripDate).map(x => x.type + ':' + x.tripDate).sort();
if (!tdIn.length) fail('เตรียมเคสไม่สำเร็จ · ไม่มีรายการ log ที่มี tripDate');
else if (String(tdIn) !== String(tdOut))
  fail('log[].tripDate ไม่รอด · เขียนไป [' + tdIn + '] กลับมาได้ [' + tdOut
       + '] (หาย = ไล่ไม่ได้ว่าที่นั่งของรอบไหนถูกดึงหรือปล่อยไปตอนไหน)');
else ok('log[].tripDate รอด · ' + tdOut.length + ' รายการ · ' + tdOut.join(' '));

/* ══ 6 · ล็อกรายวันและใบย่อย ═════════════════════════════════════════ */
{
  const pairs = [['รายวัน', R0.ids.D], ['ใบย่อย', R0.ids.S]];
  const broke = [];
  for (const [nm, id] of pairs){
    if (!id){ broke.push(nm + ' (สร้างไม่ได้)'); continue; }
    const o = origById[id], b = byId[id];
    if (!b){ broke.push(nm + ' (หายทั้งใบ)'); continue; }
    const p = new Set(); lostPaths(o, b, '', p);
    if (p.size) broke.push(nm + ' (' + [...p].join(', ') + ')');
  }
  if (broke.length) fail('ของที่เคยทำงานดีอยู่พังไปด้วย · ' + broke.join(' · '));
  else ok('ล็อกรายวัน (พร้อมวันหมดอายุ) และใบย่อย (parentId · subName) รอดครบ');
}

/* ══ 7 · เช็คย้อนทาง · blob ทั้งก้อน ═════════════════════════════════ */
{
  const PLAN = osRepo._plan || {};
  const byKey = {};
  for (const [t, pl] of Object.entries(PLAN))
    if (!pl.isChild && (pl.container === 'array' || pl.container === 'map') && pl.appKey) byKey[pl.appKey] = t;
  const lost = new Set();
  let checked = 0;
  for (const k of Object.keys(BLOB)){
    if (!byKey[k] || isEmpty(BLOB[k])) continue;
    checked++;
    const per = new Set();
    try { lostPaths(BLOB[k], trip(k, BLOB[k]), '', per); }
    catch (e){ per.add('(decompose/assemble ล้ม: ' + e.message + ')'); }
    per.forEach(p => lost.add(k + (p[0] === '[' ? p : '.' + p)));
  }
  if (lost.size)
    fail('มี ' + lost.size + ' ค่าที่ไม่ว่างใน blob ที่ไม่รอดการเดินทางไป-กลับ · ' + [...lost].slice(0, 12).join(', ')
         + ' — แต่ละตัวต้องเพิ่มคอลัมน์ทั้งสามที่: field_mapping.json · operation_schemas_model.json · ALTER TABLE ใน initDb()');
  else ok('ทุกค่าที่ไม่ว่างใน ' + checked + ' กลุ่มข้อมูลของ blob รอดครบ · ไม่มีฟิลด์ไหนเขียนลงหลุม');
}

/* ══ 8 · ตัวกันใช้งานได้จริง ═════════════════════════════════════════
   สองขา · ขาแรกกันเตือนผิด ขาที่สองกันตาบอด
   ขาที่สองจำเป็น เพราะ blob ที่ดีอยู่แล้วทำให้ตัวกันที่ตอบ "ผ่าน" ตลอด
   ดูเหมือนทำงานถูกทุกครั้ง · จึงต้องยัดฟิลด์ที่ไม่มีคอลัมน์เข้าไปแล้วดูว่ามันเห็น
   ยัดสองชนิด (ค่าเดี่ยวและค่าที่เป็นก้อน) เพราะของที่หายจริงคราวนี้เป็นทั้งสองแบบ */
const runTool = blob => {
  const f = path.join(ROOT, 'test', '_maproundtrip_blob.json');
  writeFileSync(f, JSON.stringify(blob));
  let out = '', code = 0;
  try { out = execFileSync(process.execPath, [path.join(ROOT, 'tools/check-mapping-coverage.mjs'), f],
                           { encoding:'utf8' }); }
  catch (e){ code = e.status || 1; out = String(e.stdout || '') + String(e.stderr || ''); }
  try { require('node:fs').unlinkSync(f); } catch (_){}
  return { code, out };
};
{
  const clean = runTool(BLOB);
  if (clean.code !== 0)
    fail('tools/check-mapping-coverage.mjs เตือนผิด · blob ก้อนนี้ไม่มีอะไรหาย แต่ตัวกันบอกว่ามี · '
         + clean.out.split('\n').slice(2, 8).join(' | '));
  else ok('tools/check-mapping-coverage.mjs ผ่าน blob ก้อนเดียวกันนี้ · ไม่เตือนผิด');

  const spiked = JSON.parse(JSON.stringify(BLOB));
  const s = (spiked.sb_seat_locks || []).find(l => l && l.id === R0.ids.B);
  if (!s) fail('ยัดฟิลด์ทดสอบไม่ได้ · ไม่เจอล็อกใน blob สำเนา');
  else {
    s.tRtScalar = 'x-no-column';                  // ค่าเดี่ยวที่ไม่มีคอลัมน์
    s.tRtObject = { a: 1 };                       // ค่าที่เป็นก้อนและไม่มีคอลัมน์
    const r = runTool(spiked);
    const saw = k => new RegExp('tRt' + k).test(r.out);
    if (r.code === 0)
      fail('ตัวกันตาบอด · ยัดฟิลด์ที่ไม่มีคอลัมน์เข้าไปสองตัวแล้วยังตอบผ่าน '
           + '(แบบนี้บั๊กครั้งที่ห้าจะหลุดไปเหมือนเดิม)');
    else if (!saw('Scalar') || !saw('Object'))
      fail('ตัวกันเห็นไม่ครบ · ' + (saw('Scalar') ? '' : 'ไม่เห็นค่าเดี่ยว ') + (saw('Object') ? '' : 'ไม่เห็นค่าที่เป็นก้อน')
           + '· ของที่หายจริงคราวนี้มีทั้งสองแบบ (dateFrom เป็นค่าเดี่ยว · dow กับ usedBy เป็นก้อน)');
    else ok('ตัวกันจับฟิลด์ที่ไม่มีคอลัมน์ได้ทั้งค่าเดี่ยวและค่าที่เป็นก้อน · พร้อมกันบั๊กครั้งที่ห้า');
  }
}

/* ══ 9 · 10 · 11 · 12 · §lkHeal ══════════════════════════════════════
   วัดผ่าน "การบูตจริง" ไม่ได้เรียก bkV2LockHealRange ตรง ๆ
   เพราะการกู้เกิดตอนโหลดหน้า · ถ้าวัดแต่ตัวฟังก์ชัน การถอดตัวเรียกออกทั้งก้อน
   ก็ยังผ่านฉลุย ซึ่งเท่ากับไม่ได้วัดอะไรเลย
   ทางที่ทำ: เขียน blob ที่ล็อกเสียแล้วลงไฟล์ → เปิดแอปใหม่จากไฟล์นั้น → ดูว่ากลับมาดีไหม */
await close();
{
  const f = path.join(ROOT, 'test', '_maproundtrip_boot.json');
  const dmg = JSON.parse(JSON.stringify(BLOB));
  writeFileSync(f, JSON.stringify(dmg));
  const boot = await open({ blob: f, width: 1800, height: 1200 });
  await boot.page.waitForTimeout(1200);
  const R = await boot.page.evaluate(ids => {
    const el = document.querySelector('.nav-item[data-view="booking"]');
    if (el) nav(el);
    if (typeof _bkV2 === 'object'){ _bkV2.tab = 'locks'; _bkV2LockUI.st = 'all'; bkV2Render(); }
    const g = id => SB_SEAT_LOCKS.find(l => l.id === id) || null;
    const H1 = g(ids.H1), H2 = g(ids.H2), H3 = g(ids.H3), B = g(ids.B);
    const rows = [...document.querySelectorAll('.bkv2-locks tr')];
    const rowOf = re => rows.filter(r => re.test(r.textContent));
    return {
      H1: H1 && { from:H1.dateFrom||'', to:H1.dateTo||'', rounds:bkV2LockRounds(H1).total },
      H2: H2 && { from:H2.dateFrom||'', to:H2.dateTo||'' },
      H3: H3 && { from:H3.dateFrom||'', to:H3.dateTo||'' },
      B:  B  && { from:B.dateFrom||'', to:B.dateTo||'' },
      h3Badge: rowOf(/T-RT heal nothing/).some(r => /ช่วงวันหาย/.test(r.textContent)),
      h1Badge: rowOf(/T-RT heal month/).some(r => /ช่วงวันหาย/.test(r.textContent)),
      badgeAll: rowOf(/ช่วงวันหาย/).length };
  }, R0.ids);
  try { require('node:fs').unlinkSync(f); } catch (_){}

  if (!R.H1) fail('เปิดใหม่แล้วไม่เจอใบที่ควรกู้จากฟิลด์เดือน');
  else if (R.H1.from !== '2026-11-01' || R.H1.to !== '2026-12-31')
    fail('เปิดแอปใหม่แล้วไม่ได้กู้ช่วงวันจาก monthFrom/monthTo · ควรได้ 2026-11-01 → 2026-12-31 แต่ได้ '
         + (R.H1.from || '—') + ' → ' + (R.H1.to || '—'));
  else ok('เปิดแอปใหม่ · กู้ช่วงวันจาก monthFrom/monthTo ให้เองแล้ว · ' + R.H1.from + ' → ' + R.H1.to);

  if (!R.H2) fail('เปิดใหม่แล้วไม่เจอใบที่ควรกู้จากบันทึกการแก้ไข');
  else if (R.H2.from !== '2026-11-02' || R.H2.to !== '2026-12-30')
    fail('เปิดแอปใหม่แล้วไม่ได้กู้ช่วงวันจากบันทึกการแก้ไข (§lkEdit note ตัวล่าสุด) · ควรได้ 2026-11-02 → 2026-12-30 แต่ได้ '
         + (R.H2.from || '—') + ' → ' + (R.H2.to || '—'));
  else ok('เปิดแอปใหม่ · กู้ช่วงวันจากบันทึกการแก้ไขตัวล่าสุดแล้ว · ' + R.H2.from + ' → ' + R.H2.to);

  if (!R.H3) fail('เปิดใหม่แล้วไม่เจอใบที่กู้ไม่ได้');
  else if (R.H3.from)
    fail('ใบที่ไม่มีร่องรอยเลย ถูกเติมวันให้แบบเดา · ได้ ' + R.H3.from + ' → ' + R.H3.to
         + ' · ล็อกจะไปกันที่นั่งวันที่ไม่มีใครสั่ง');
  else if (!R.h3Badge)
    fail('ใบที่ช่วงวันหายและกู้ไม่ได้ ไม่ติดป้ายเตือน · คนใช้จะไม่รู้ว่าต้องกรอกใหม่ (เจอป้ายทั้งหน้า '
         + R.badgeAll + ' ใบ)');
  else if (R.h1Badge)
    fail('ใบที่กู้สำเร็จแล้วยังติดป้าย "ช่วงวันหาย" อยู่ · ป้ายขึ้นพร่ำเพรื่อจนไม่มีใครเชื่อ');
  else ok('ใบที่กู้ไม่ได้ติดป้ายแดง "ช่วงวันหาย · กรอกใหม่" · ใบที่กู้แล้วไม่ติด');

  if (!R.H1) fail('ข้ามข้อ 12 · ไม่มีใบที่กู้');
  else if (!(R.H1.rounds > 0))
    fail('ใบที่กู้แล้วยังไม่ครอบรอบไหนเลย · ' + R.H1.from + ' → ' + R.H1.to + ' ได้ ' + R.H1.rounds
         + ' รอบ · กู้แล้วก็ยังไม่ขึ้น manifest');
  else if (!R.B || R.B.from !== R0.d1 || R.B.to !== R0.d2)
    fail('ใบที่ช่วงวันดีอยู่แล้วถูกกู้ทับ · ' + R0.d1 + ' → ' + R0.d2 + ' กลายเป็น '
         + ((R.B && R.B.from) || '—') + ' → ' + ((R.B && R.B.to) || '—'));
  else ok('ใบที่กู้แล้วกลับมาครอบ ' + R.H1.rounds + ' รอบ · พร้อมขึ้น manifest · ใบที่ดีอยู่แล้วไม่ถูกแตะ');

  /* ══ 13 ══════════════════════════════════════════════════════════ */
  await boot.page.evaluate(() => { SB_SEAT_LOCKS = SB_SEAT_LOCKS.filter(l => !/^T-RT/.test(l.reason || '') && !/T-RT/.test(l.subName || '')); sbSeatLocksPersist(); });
  const errs = errors.concat(boot.errors);
  if (errs.length) fail('มี error บนหน้า · ' + errs.slice(0, 3).join(' | '));
  else ok('ไม่มี error บนหน้า ทั้งรอบแรกและรอบที่เปิดใหม่');
  await boot.close();
}
console.log(bad ? '\n✗ ' + bad + ' ข้อไม่ผ่าน' : '\n✓ ผ่านทั้งหมด');
process.exit(bad ? 1 : 0);
