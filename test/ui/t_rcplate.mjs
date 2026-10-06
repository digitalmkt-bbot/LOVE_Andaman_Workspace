// §rcPlate · หน้า Re-confirm · ใบที่จัดรถแล้วต้องเห็นทะเบียนรถ ทั้งบนจอและในใบ Sheet
//
// ที่มา (6 ต.ค. 2026) · เจ้าของ: "Re-Confirm กรณีที่จัดรถแล้ว ขอเพิ่มคอลัมน์ทะเบียนรถให้ด้วย และโชว์ในใบ Sheet ด้วย"
//
// กันเจ็ดอย่าง
//   1 ตารางมีคอลัมน์ "Van · plate" ถัดจาก Pickup area · ใบที่มี ops.vanId โชว์ทะเบียนของคันนั้น (vehGet) และชื่อรถ
//   2 ใบที่ยังไม่จัดรถ = ขีด (ไม่เดาคัน) · ใบที่ติ๊กมาเอง (pickupSelf) = "มาเอง"
//   3 ทะเบียนที่ใส่ทับรายวันในใบงานรถ (VANJOB_DRIVER[date::van].plate) มาก่อนทะเบียนในทะเบียนรถ · ลบแล้วกลับเดิม
//   4 รถกลับคนละคัน · มีบรรทัด "กลับ: <ทะเบียน>" · รถกลับคันเดียวกันไม่ขึ้นซ้ำ
//   5 ใบ Sheet ของเอเย่นต์นั้น · หัวตารางมี "Van · plate" · แถวมีทะเบียน · ใบที่ไม่มีรถเป็นขีด
//   6 ไม่เขียนอะไรลง booking (ops เท่าเดิม) · VANJOB_DRIVER ไม่มี key ค้าง
//   7 OVN วันที่ 2 · รถของวันนั้นมาจาก trip.ops (bkOpsRead) ไม่ใช่รถวันแรก
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1100 });
page.on('dialog', async d => { try { await d.accept(); } catch (_) {} });
await goView(page, 'reconfirm', 700);
const DATE = '2026-09-15';

const prep = await page.evaluate((DATE) => {
  _rcDate = DATE; renderReconfirm();
  const rows = _rcActiveRows(DATE);
  const withVan = rows.find(r => { const O = bkOpsRead(r.bk, DATE); return O.vanId && vehGet(O.vanId) && vehGet(O.vanId).plate && vehGet(O.vanId).plate !== '-' && !r.bk.pickupSelf; });
  const noVan = rows.find(r => { const O = bkOpsRead(r.bk, DATE); return !O.vanId && !r.bk.pickupSelf; });
  if (!withVan) return { err: 'no booking with a van + plate on ' + DATE };
  const O = bkOpsRead(withVan.bk, DATE), v = vehGet(O.vanId);
  return { id: withVan.bk.id, code: withVan.bk.voucherRef || withVan.bk.code, key: _rcAgentKey(withVan.bk), vid: O.vanId, plate: v.plate, name: v.name, ret: O.vanReturnId || '',
    noId: noVan ? noVan.bk.id : null, noCode: noVan ? (noVan.bk.voucherRef || noVan.bk.code) : null, opsSnap: JSON.stringify(withVan.bk.ops || null), hasKey: !!VANJOB_DRIVER[DATE + '::' + O.vanId] };
}, DATE);
if (prep.err) { fail('prep ' + prep.err); await close(); process.exit(1); }

const cell = (code) => page.evaluate((code) => {
  const host = document.getElementById('reconfirm-host');
  const ths = [...host.querySelectorAll('table thead')].map(th => [...th.querySelectorAll('th')].map(x => x.textContent.trim()));
  const head = ths[0] || [];
  const iVan = head.indexOf('Van · plate'), iZone = head.indexOf('Pickup area');
  const tr = [...host.querySelectorAll('table tbody tr')].find(t => t.textContent.includes(code));
  if (!tr) return { head, iVan, iZone, txt: null };
  const td = tr.children[iVan];
  return { head, iVan, iZone, txt: td ? td.textContent.replace(/\s+/g, ' ').trim() : null, html: td ? td.innerHTML : '' };
}, code);

/* 1 */
const c1 = await cell(prep.code);
if (c1.iVan > 0 && c1.iVan === c1.iZone + 1 && c1.txt && c1.txt.startsWith(prep.plate) && c1.txt.includes(prep.name))
  ok(`1 คอลัมน์ "Van · plate" ถัดจาก Pickup area · ใบ ${prep.code} โชว์ "${c1.txt}" (รถ ${prep.vid})`);
else fail('1 ' + JSON.stringify({ c1, prep }));

/* 2 */
const c2 = prep.noCode ? await cell(prep.noCode) : null;
await page.evaluate((id) => { SB_BOOKINGS.find(b => b.id === id).pickupSelf = true; renderReconfirm(); }, prep.noId);
const c2b = prep.noCode ? await cell(prep.noCode) : null;
await page.evaluate((id) => { delete SB_BOOKINGS.find(b => b.id === id).pickupSelf; renderReconfirm(); }, prep.noId);
if (c2 && c2.txt === '—' && c2b && c2b.txt === 'มาเอง') ok(`2 ใบไม่จัดรถ ${prep.noCode} = "—" · ติ๊กมาเอง = "มาเอง"`);
else fail('2 ' + JSON.stringify({ c2, c2b, noCode: prep.noCode }));

/* 3 */
await page.evaluate(({ DATE, vid }) => { VANJOB_DRIVER[DATE + '::' + vid] = { plate: 'TEST 9999' }; renderReconfirm(); }, { DATE, vid: prep.vid });
const c3 = await cell(prep.code);
await page.evaluate(({ DATE, vid }) => { delete VANJOB_DRIVER[DATE + '::' + vid]; renderReconfirm(); }, { DATE, vid: prep.vid });
const c3b = await cell(prep.code);
if (c3.txt.startsWith('TEST 9999') && c3b.txt.startsWith(prep.plate)) ok(`3 ทะเบียนทับรายวันมาก่อน ("${c3.txt}") · ลบแล้วกลับเป็น "${prep.plate}"`);
else fail('3 ' + JSON.stringify({ c3, c3b }));

/* 4 */
const r4 = await page.evaluate(({ id, DATE, vid }) => {
  const b = SB_BOOKINGS.find(x => x.id === id), O = bkOpsFor(b, DATE), keep = O.vanReturnId;
  const other = (SB_VEHICLES || []).find(v => v.id !== vid && v.plate && v.plate !== '-');
  if (!other) return { err: 'no other vehicle' };
  O.vanReturnId = other.id; renderReconfirm();
  const host = document.getElementById('reconfirm-host'), head = [...host.querySelector('table thead').querySelectorAll('th')].map(x => x.textContent.trim());
  const tr = [...host.querySelectorAll('table tbody tr')].find(t => t.textContent.includes(b.voucherRef || b.code));
  const diff = tr.children[head.indexOf('Van · plate')].textContent.replace(/\s+/g, ' ').trim();
  O.vanReturnId = vid; renderReconfirm();
  const tr2 = [...host.querySelectorAll('table tbody tr')].find(t => t.textContent.includes(b.voucherRef || b.code));
  const same = tr2.children[head.indexOf('Van · plate')].textContent.replace(/\s+/g, ' ').trim();
  if (keep === undefined) delete O.vanReturnId; else O.vanReturnId = keep;
  renderReconfirm();
  return { diff, same, otherPlate: other.plate };
}, { id: prep.id, DATE, vid: prep.vid });
if (!r4.err && r4.diff.includes('กลับ: ' + r4.otherPlate) && !r4.same.includes('กลับ:')) ok(`4 รถกลับคนละคัน → "${r4.diff}" · คันเดียวกันไม่ขึ้น "กลับ:"`);
else fail('4 ' + JSON.stringify(r4));

/* 5 */
const s5 = await page.evaluate(({ key, code, noCode }) => {
  window._sheet = ''; const _open = window.open;
  window.open = () => ({ document: { open() {}, write(h) { window._sheet += h; }, close() {} } });
  try { rcSheet(key); } finally { window.open = _open; }
  const d = document.createElement('div'); d.innerHTML = window._sheet.replace(/^[\s\S]*?<body>/, '').replace(/<\/body>[\s\S]*$/, '');
  const tbl = d.querySelector('table.gt'); if (!tbl) return { err: 'no table' };
  const head = [...tbl.querySelectorAll('thead th')].map(x => x.textContent.trim()), i = head.indexOf('Van · plate');
  const row = [...d.querySelectorAll('table.gt tbody tr')].find(t => t.textContent.includes(code));
  const noRow = noCode ? [...d.querySelectorAll('table.gt tbody tr')].find(t => t.textContent.includes(noCode)) : null;
  return { head, i, iZone: head.indexOf('Zone'), txt: row ? row.children[i].textContent.replace(/\s+/g, ' ').trim() : null, plateCls: row ? !!row.children[i].querySelector('.plate') : null, noTxt: noRow ? noRow.children[i].textContent.trim() : 'n/a' };
}, { key: prep.key, code: prep.code, noCode: prep.noCode });
if (!s5.err && s5.i === s5.iZone + 1 && s5.txt && s5.txt.startsWith(prep.plate) && s5.plateCls && (s5.noTxt === 'n/a' || s5.noTxt === '—'))
  ok(`5 ใบ Sheet · หัว "Van · plate" ถัดจาก Zone · แถว ${prep.code} = "${s5.txt}"` + (s5.noTxt !== 'n/a' ? ` · ใบไม่มีรถ "${s5.noTxt}"` : ''));
else fail('5 ' + JSON.stringify(s5));

/* 6 */
const r6 = await page.evaluate(({ id, DATE, vid }) => ({ opsSnap: JSON.stringify(SB_BOOKINGS.find(b => b.id === id).ops || null), hasKey: !!VANJOB_DRIVER[DATE + '::' + vid] }), { id: prep.id, DATE, vid: prep.vid });
if (r6.opsSnap === prep.opsSnap && r6.hasKey === prep.hasKey) ok('6 ops ของใบเท่าเดิม · VANJOB_DRIVER ไม่มี key ค้าง');
else fail('6 ' + JSON.stringify({ before: prep.opsSnap, after: r6.opsSnap, hasKey: r6.hasKey }));

/* 7 · OVN วันที่ 2 · รถของวันนั้นอยู่ที่ trip.ops ไม่ใช่ bk.ops · จำลองทริปวันถัดไปในหน่วยความจำแล้วถอดออก */
const r7 = await page.evaluate(({ id, DATE, vid }) => {
  const b = SB_BOOKINGS.find(x => x.id === id), other = (SB_VEHICLES || []).find(v => v.id !== vid && v.plate && v.plate !== '-');
  const d2 = bkV2LocalYMD(new Date(new Date(DATE + 'T00:00:00').getTime() + 86400000));
  const t0 = (b.trips || [])[0]; if (!t0 || !other) return { err: 'no trip/other' };
  const t2 = Object.assign({}, t0, { date: d2, ops: { vanId: other.id } }); b.trips.push(t2);
  _rcDate = d2; renderReconfirm();
  const host = document.getElementById('reconfirm-host'), thead = host.querySelector('table thead');
  const head = thead ? [...thead.querySelectorAll('th')].map(x => x.textContent.trim()) : [];
  const tr = [...host.querySelectorAll('table tbody tr')].find(t => t.textContent.includes(b.voucherRef || b.code));
  const txt = tr ? tr.children[head.indexOf('Van · plate')].textContent.replace(/\s+/g, ' ').trim() : null;
  b.trips.pop(); _rcDate = DATE; renderReconfirm();
  return { txt, otherPlate: other.plate, nTrips: b.trips.length };
}, { id: prep.id, DATE, vid: prep.vid });
if (!r7.err && r7.txt && r7.txt.startsWith(r7.otherPlate) && !r7.txt.startsWith(prep.plate)) ok(`7 OVN วันที่ 2 อ่านรถจาก trip.ops → "${r7.txt}" ไม่ใช่รถวันแรก (${prep.plate})`);
else fail('7 ' + JSON.stringify({ r7, plate: prep.plate }));

const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e));
if (e1.length) fail('errors: ' + e1.slice(0, 3).join(' | '));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
