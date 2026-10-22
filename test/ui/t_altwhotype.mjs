// §altWhoType · จุดรับเพิ่ม: เลือกชื่อคนที่เป็น FOC → ช่อง FOC เป็น 1 ไม่ใช่ AD · แถวหลักคงยอดถูกต้อง
import { open } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1440, height: 1000 });
page.on('dialog', d => d.accept());
const r = await page.evaluate(async () => {
  const z = ms => new Promise(f => setTimeout(f, ms));
  nav(document.querySelector('.nav-item[data-view="bookingv2"]') || document.querySelector('.nav-item[data-view="booking"]')); await z(400);
  // ใบจริงที่มี FOC 1 คน (ทริปเดียว) · เปิดแก้ไข
  const bk = (SB_BOOKINGS || []).find(b => b.status === 'confirmed' && (b.trips || []).length === 1 && bkV2PaxTot(b.trips[0].pax, 'foc') === 1 && bkV2PaxTot(b.trips[0].pax, 'ad') >= 2 && b.leadPax);
  if (!bk) return { none: 1 };
  bkV2EditBooking(bk.id); await z(500);
  const d = _bkV2.newBooking;
  bkV2SyncPassengers();
  const focP = (d.passengers || []).find(p => p.type === 'FOC');
  if (!focP) return { nofoc: 1, types: (d.passengers || []).map(p => p.type), leadType: d.leadType };
  if (!focP.name) { focP.name = 'ไกด์ทดสอบ FOC'; }
  const adP = (d.passengers || []).find(p => p.type === 'AD' && p.name) || null;
  bkV2AddAltPickup(); await z(100);
  const i = d.altPickups.length - 1;
  const before = bkAltPax(d.altPickups[i]);
  bkV2AltWhoPicked(i, focP.name); await z(150);
  const after = bkAltPax(d.altPickups[i]);
  // ชื่อคนที่เป็นผู้ใหญ่ → กลับเป็น AD 1
  let adCase = null; if (adP) { bkV2AltWhoPicked(i, adP.name); await z(100); adCase = bkAltPax(d.altPickups[i]); }
  // แถวที่ตั้งไว้ 2 คนแล้ว → ไม่แตะ
  bkV2SetAltPickupPax(i, 'foc', 0); bkV2SetAltPickupPax(i, 'ad', 2); await z(100); bkV2AltWhoPicked(i, focP.name); await z(100); const multi = bkAltPax(d.altPickups[i]);
  // ชื่อที่ไม่ตรงใคร → ไม่แตะ
  bkV2SetAltPickupPax(i, 'foc', 0); bkV2SetAltPickupPax(i, 'ad', 1); await z(100); bkV2AltWhoPicked(i, 'ใครก็ไม่รู้'); await z(100); const unknown = bkAltPax(d.altPickups[i]);
  // ค่าในช่องบนจอ
  bkV2AltWhoPicked(i, focP.name); await z(150);
  const rowEl = [...document.querySelectorAll('.bkv2-alt-row')].pop();
  const boxes = rowEl ? [...rowEl.querySelectorAll('.bkv2-pax-box')].map(b => +b.value) : [];
  const out = { id: bk.id, before, after, adCase, multi, unknown, boxes, lead: bkV2AltWhoType(d.leadPax), leadType: d.leadType };
  bkV2CloseNewBooking();
  return out;
});
const R = JSON.stringify(r);
if (r.none || r.nofoc) { fail('no booking with FOC ' + R); }
else {
  if (r.before.ad === 1 && r.before.foc === 0 && r.after.foc === 1 && r.after.ad === 0) ok(r.id + ' · เลือกชื่อ FOC → FOC 1 / AD 0 (เดิม AD 1)'); else fail('foc ' + R);
  if (!r.adCase || (r.adCase.ad === 1 && r.adCase.foc === 0)) ok('เลือกชื่อผู้ใหญ่ → AD 1'); else fail('ad ' + R);
  if (r.multi.ad === 2 && r.multi.foc === 0) ok('แถวที่ตั้ง 2 คนไว้แล้ว ไม่ถูกแตะ'); else fail('multi ' + R);
  if (r.unknown.ad === 1 && r.unknown.foc === 0) ok('ชื่อที่ไม่ตรงใคร ไม่แตะ'); else fail('unknown ' + R);
  if (r.boxes.length === 4 && r.boxes[0] === 0 && r.boxes[3] === 1) ok('ช่อง AD/CHD/INF/FOC บนจอ = ' + r.boxes.join('/')); else fail('boxes ' + R);
  if (r.lead === r.leadType) ok('Lead ใช้ประเภทของ Lead (' + r.leadType + ')'); else fail('lead ' + R);
}
const errs = errors.filter(e => !/404/.test(e));
if (errs.length) { fail('page errors'); console.log('    errors:', errs.slice(0, 3)); }
console.log(bad ? `FAIL ${bad}` : 'PASS'); await close(); process.exit(bad ? 1 : 0);
