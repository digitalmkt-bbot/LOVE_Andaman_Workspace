// §rcDrop · หน้า Re-confirm · ใบที่มีจุดส่งขากลับต่างจากจุดรับ ต้องขึ้น Drop-off ทั้งบนจอและในใบ Sheet
//
// ที่มา (2026-10-14) · owner: "กรณีที่มี Drop off ให้ขึ้นด้วย"
// กัน
//   1 ใบที่ dropoffSame=false + dropoffHotelName · ช่อง Hotel บนจอมีบรรทัด "Drop-off: <ที่>" · ใบที่ส่งที่เดิมไม่มี
//   2 ใบ Sheet ของเอเย่นต์นั้น · ช่อง Hotel มี Drop-off เหมือนกัน
//   3 แยกส่งรายคน (altPickups[i].dropSame=false) · ขึ้น "ชื่อ: ที่ส่ง"
//   4 ไม่เขียนอะไรลง booking · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1100 });
page.on('dialog', async d => { try { await d.accept(); } catch (_) {} });
await goView(page, 'reconfirm', 700);
const DATE = '2026-09-15';
const prep = await page.evaluate((DATE) => {
  _rcDate = DATE; renderReconfirm();
  const rows = _rcActiveRows(DATE).filter(r => r.bk.schemaVer === 2 && !r.bk.dropoffSame === false || r.bk.dropoffSame !== false);
  if (rows.length < 2) return { err: 'need 2 rows' };
  const a = rows[0].bk, b = rows[1].bk;
  const snapA = JSON.stringify(a), snapB = JSON.stringify(b);
  a.dropoffSame = false; a.dropoffHotelName = 'Test Drop Resort Karon';
  b.altPickups = [{ who: 'Mr. Test Two', place: 'Pickup Villa', dropSame: false, dropPlace: 'Airport HKT' }];
  renderReconfirm();
  return { aCode: a.voucherRef || a.code || a.id, aKey: _rcAgentKey(a), bCode: b.voucherRef || b.code || b.id, aId: a.id, bId: b.id, snapA, snapB, other: (rows[2] ? (rows[2].bk.voucherRef || rows[2].bk.code || rows[2].bk.id) : '') };
}, DATE);
if (prep.err) { fail(prep.err); await close(); process.exit(1); }
const cell = (code) => page.evaluate((code) => {
  const host = document.getElementById('reconfirm-host');
  const head = [...(host.querySelector('table thead') || { querySelectorAll: () => [] }).querySelectorAll('th')].map(x => x.textContent.trim());
  const i = head.indexOf('Hotel');
  const tr = [...host.querySelectorAll('table tbody tr')].find(t => t.textContent.includes(code));
  const td = tr && tr.children[i]; return td ? td.textContent.replace(/\s+/g, ' ').trim() : null;
}, code);
const a1 = await cell(prep.aCode), o1 = prep.other ? await cell(prep.other) : '—';
if (a1 && /Drop-off: Test Drop Resort Karon/.test(a1) && o1 != null && !/Drop-off/.test(o1)) ok(`1 บนจอ · "${a1}" · ใบอื่นไม่มี`); else fail('1 ' + JSON.stringify({ a1, o1 }));
const sheet = await page.evaluate((key) => { let cap = ''; const real = window.open; window.open = () => ({ focus() {}, document: { open() {}, write(h) { cap += h; }, close() {} } }); try { rcSheet(key); } catch (e) { cap = 'ERR ' + e; } window.open = real; return cap; }, prep.aKey);
if (/Drop-off: Test Drop Resort Karon/.test(sheet) && /\.gt \.drop\{/.test(sheet)) ok('2 ใบ Sheet มี Drop-off'); else fail('2 ' + sheet.slice(0, 200));
const b1 = await cell(prep.bCode);
if (b1 && /Drop-off: Mr\. Test Two: Airport HKT/.test(b1)) ok(`3 แยกส่งรายคน · "${b1}"`); else fail('3 ' + JSON.stringify(b1));
const same = await page.evaluate((p) => { const a = SB_BOOKINGS.find(x => x.id === p.aId), b = SB_BOOKINGS.find(x => x.id === p.bId); const A = JSON.parse(p.snapA), B = JSON.parse(p.snapB); ['dropoffSame','dropoffHotelName'].forEach(k => { if (k in A) a[k] = A[k]; else delete a[k]; }); if ('altPickups' in B) b.altPickups = B.altPickups; else delete b.altPickups; const diff = (x, y) => Object.keys(Object.assign({}, x, y)).filter(k => JSON.stringify(x[k]) !== JSON.stringify(y[k]));
  const da = diff(A, a), db = diff(B, b); return { ok: !da.length && !db.length, da, db }; }, prep);
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (same.ok && !e1.length) ok('4 booking ไม่ถูกแก้ · no page errors'); else fail('4 ' + JSON.stringify({ same, e1: e1.slice(0, 3) }));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
