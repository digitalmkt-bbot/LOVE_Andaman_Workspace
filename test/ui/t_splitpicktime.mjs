// §splitPickTime · แยกรับคนละโรงแรม · เวลารับของแต่ละจุดต้องเป็นของตัวเอง และต้องอยู่หลังบันทึก
//
// ที่มา (2026-10-02) · ผู้ใช้ส่งภาพใบ BOC ที่แยกรับสามแถว (Pullman 1 · Pullman 1 · Marina 2)
//   ทุกแถวขึ้น 08:40 เหมือนกัน แล้วถามว่า "Dev แก้ไปแล้วรอบนึง แต่เหมือนระบบไม่ได้เซฟไว้ให้หรือเปล่า"
//   คอมมิต 7ad0273 ย้ายเวลาของแถวแยกรับไปเก็บที่ vanSplits[i].pickTime แต่ไม่มีเทสมาด้วย
//   เทสนี้ทำเคสเดียวกับในภาพ แล้วตามดูว่าเวลาที่กรอกอยู่ครบทุกทางที่ข้อมูลเดินผ่าน
//
// กันเจ็ดอย่าง
//   1 กรอกเวลาที่แถวแยกรับ (พิมพ์จริงในโหมดจัดรถ) · จุดหลักไม่เปลี่ยนตาม และแถวแยกรับอีกแถวก็ไม่เปลี่ยน
//   2 กรอกเวลาที่จุดหลัก · แถวแยกรับที่ตั้งเวลาเองแล้วไม่ถูกทับ
//   3 ตัวซ่อม split (วิ่งทุกครั้งที่เปิดหน้า) ไม่ล้างเวลาที่ตั้งไว้ · แม้สองแถวจะเป็นโรงแรมเดียวกัน
//   4 โหมดปกติ · แต่ละแถวโชว์เวลาของตัวเอง
//   5 รอดทางไป-กลับของเซิร์ฟเวอร์ (decomposeBlob → assembleBlob)
//   6 รีเฟรชแล้วยังอยู่
//   7 แถวแยกรับที่ยังไม่ตั้งเวลา ใช้เวลาของใบ (พฤติกรรมเดิม) · ไม่มี error บนหน้า
import { open, goView } from './_harness.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);
const osRepo = _require(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../os-backend/src/mapping/os_repo.js'));

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1800, height: 1200 });
await goView(page, 'booking', 900);

/* ══ 0 · ใบจอยที่มีคนตั้งแต่ 4 · ใส่จุดรับเพิ่มสองจุดที่โรงแรมเดียวกัน (เหมือนในภาพ) ══ */
const S = await page.evaluate(() => {
  for (const f of ['bkSplitOwnPick', 'bkV2SetSplitPickTime', 'bkV2SyncAltPickupSplits', 'bkV2HealAltSplits'])
    if (typeof window[f] !== 'function') return { err: 'missing ' + f };
  const area = (SB_PICKUP_AREAS || []).find(a => a && a.id && a.name);
  if (!area) return { err: 'no pickup area' };
  let hit = null;
  for (const b of (SB_BOOKINGS || [])) {
    if (!b || ['cancelled', 'rejected', 'cancelled_weather', 'pending_approval'].includes(b.status)) continue;
    if ((b.trips || []).length !== 1) continue;
    if (Array.isArray(b.altPickups) && b.altPickups.length) continue;
    const t = b.trips[0]; if (!t.date || !t.routeId || t.bookingMode === 'charter') continue;
    if (b.ops && Array.isArray(b.ops.vanSplits) && b.ops.vanSplits.length) continue;
    const p = bkPaxOfTrip(t); if ((p.ad || 0) < 4) continue;
    hit = { id: b.id, date: t.date, rid: t.routeId, orig: t.pickupTime || b.pickupTime || '' }; break;
  }
  if (!hit) return { err: 'no join booking with 4+ adults' };
  const b = SB_BOOKINGS.find(x => x.id === hit.id);
  b.altPickups = [ { place: 'T-SPT Pullman', areaId: area.id, zone: '', who: 'guest A', ad: 1, chd: 0, inf: 0, foc: 0 },
                   { place: 'T-SPT Pullman', areaId: area.id, zone: '', who: 'guest B', ad: 1, chd: 0, inf: 0, foc: 0 } ];
  b.ops = b.ops || {}; b.ops.pickupTimeFinal = '';
  const made = bkV2SyncAltPickupSplits(b);
  acctPersistBookings();
  _bkV2.tab = 'bytrip'; _bkV2.vanAssignMode = true; _bkV2.filterRoute = hit.rid; _bkV2.filterDate = hit.date;
  bkV2Render();
  return Object.assign(hit, { made, n: (b.ops.vanSplits || []).length });
});
if (S.err) { fail(S.err); await close(); process.exit(1); }
if (!S.made || S.n !== 3) { fail('setup: split not built ' + JSON.stringify(S)); await close(); process.exit(1); }
await page.waitForTimeout(700);

const inp = i => `tr[data-al="${S.id}@${i}"] td.t2-tm input`;
const read = () => page.evaluate(p => { const b = SB_BOOKINGS.find(x => x.id === p.id), o = bkOpsRead(b, p.date);
  return { fin: o.pickupTimeFinal || '', t: (o.vanSplits || []).map(s => s.pickTime || '') }; }, S);
const type = async (i, v) => { await page.click(inp(i), { clickCount: 3 }); await page.keyboard.type(v); await page.keyboard.press('Tab'); await page.waitForTimeout(150); };

/* ══ 1 · แถวแยกรับ ══ */
if (!(await page.$(inp(1)))) { fail('1 time input of split row not found: ' + inp(1)); await close(); process.exit(1); }
await type(1, '08:10');
let r = await read();
if (r.fin === '' && r.t.join('|') === '|08:10|') ok('1 กรอก 08:10 ที่แถวแยกรับแถวแรก · จุดหลักกับแถวแยกรับอีกแถวไม่เปลี่ยนตาม');
else fail('1 ' + JSON.stringify(r));

/* ══ 2 · จุดหลัก ══ */
await type(0, '08:40');
r = await read();
if (r.fin === '08:40' && r.t.join('|') === '|08:10|') ok('2 กรอก 08:40 ที่จุดหลัก · แถวแยกรับที่ตั้ง 08:10 ไว้ไม่ถูกทับ');
else fail('2 ' + JSON.stringify(r));
await type(2, '08:15');

/* ══ 3 · ตัวซ่อม ══ */
const r3 = await page.evaluate(p => { bkV2HealAltSplits(p.date); const b = SB_BOOKINGS.find(x => x.id === p.id);
  bkV2SyncAltPickupSplits(b); bkV2Render(); const o = bkOpsRead(b, p.date);
  return { fin: o.pickupTimeFinal || '', t: (o.vanSplits || []).map(s => s.pickTime || '') }; }, S);
if (r3.fin === '08:40' && r3.t.join('|') === '|08:10|08:15') ok('3 ตัวซ่อม split วิ่งซ้ำ · เวลาของสองแถวที่โรงแรมเดียวกันยังเป็น 08:10 กับ 08:15');
else fail('3 ' + JSON.stringify(r3));

/* ══ 4 · โหมดปกติ ══ */
const r4 = await page.evaluate(async p => { _bkV2.vanAssignMode = false; bkV2Render(); await new Promise(z => setTimeout(z, 300));
  return [0, 1, 2].map(i => { const td = document.querySelector('tr[data-al="' + p.id + '@' + i + '"] td.t2-tm'); return td ? td.textContent.replace(/\s+/g, ' ').trim() : 'MISSING'; }); }, S);
if (r4[0].indexOf('08:40') === 0 && r4[1].indexOf('08:10') === 0 && r4[2].indexOf('08:15') === 0) ok('4 โหมดปกติ · สามแถวโชว์ 08:40 / 08:10 / 08:15 ของตัวเอง');
else fail('4 ' + JSON.stringify(r4));

/* ══ 5 · ทางไป-กลับของเซิร์ฟเวอร์ ══ */
const SRV = await page.evaluate(p => { const D = JSON.parse(localStorage.getItem('loveandaman_v2') || '{}');
  return { sb_bookings: (D.sb_bookings || []).filter(b => b.id === p.id) }; }, S);
const BACK = osRepo.assembleBlob(osRepo.decomposeBlob(SRV));
const tOf = B => { const b = (B.sb_bookings || [])[0] || {}, o = b.ops || {}; return (o.pickupTimeFinal || '') + '/' + (o.vanSplits || []).map(s => s.pickTime || '').join('|'); };
if (tOf(SRV) === '08:40/|08:10|08:15' && tOf(BACK) === tOf(SRV)) ok('5 เวลาทั้งสามอยู่ในที่เก็บ และรอดทางไป-กลับของเซิร์ฟเวอร์');
else fail('5 stored ' + tOf(SRV) + ' · back ' + tOf(BACK));

/* ══ 6 · รีเฟรช ══ */
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => typeof window.nav === 'function' && typeof bkSplitOwnPick === 'function', null, { timeout: 20000 });
await page.waitForTimeout(900);
await goView(page, 'booking', 800);
const r6 = await page.evaluate(async p => { _bkV2.tab = 'bytrip'; _bkV2.vanAssignMode = false; _bkV2.filterRoute = p.rid; _bkV2.filterDate = p.date; bkV2Render();
  await new Promise(z => setTimeout(z, 500));
  const b = SB_BOOKINGS.find(x => x.id === p.id), o = bkOpsRead(b, p.date);
  return { fin: o.pickupTimeFinal || '', t: (o.vanSplits || []).map(s => s.pickTime || ''),
    cells: [0, 1, 2].map(i => { const td = document.querySelector('tr[data-al="' + p.id + '@' + i + '"] td.t2-tm'); return td ? td.textContent.replace(/\s+/g, ' ').trim().slice(0, 5) : 'MISSING'; }) }; }, S);
if (r6.fin === '08:40' && r6.t.join('|') === '|08:10|08:15' && r6.cells.join() === '08:40,08:10,08:15') ok('6 รีเฟรชแล้วเวลาทั้งสามยังอยู่ และหน้าจอยังโชว์แยกกัน');
else fail('6 ' + JSON.stringify(r6));

/* ══ 7 · ยังไม่ตั้งเวลา = ใช้ของใบ ══ */
const r7 = await page.evaluate(async p => { const b = SB_BOOKINGS.find(x => x.id === p.id), o = bkOpsFor(b, p.date);
  delete o.vanSplits[2].pickTime; bkV2Render(); await new Promise(z => setTimeout(z, 300));
  const td = document.querySelector('tr[data-al="' + p.id + '@2"] td.t2-tm'); return td ? td.textContent.replace(/\s+/g, ' ').trim().slice(0, 5) : 'MISSING'; }, S);
const realErr = errors.filter(e => !/Failed to load resource/.test(e));
if (r7 === '08:40' && !realErr.length) ok('7 แถวแยกรับที่ยังไม่ตั้งเวลา โชว์เวลาของใบ (08:40) · ไม่มี error บนหน้า');
else fail('7 ' + JSON.stringify({ r7, realErr: realErr.slice(0, 2) }));

await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
