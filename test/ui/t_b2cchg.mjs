// §b2cChg · B2C แก้ใบจองมา ต้องเห็นในแถวของใบนั้นบนหน้า By trip date และหายเมื่อกดรับทราบ
//
// ที่มา (8 ต.ค. 2026) · เจ้าของ: "บุคกิ้งของ B2C ตอนนี้มัน Sync อัตโนมัติ ถ้ามีการแก้ไขมาจากฝั่ง B2C
//   มันจะเปลี่ยนแบบเงียบ ๆ ทาง By trip date ทำยังไงให้รู้ว่ามีการแก้ไข" → "โชว์ในบรรทัดของบุคกิ้ง
//   นั้น ๆ เลย แล้ว User กดรับทราบ ก็จะหายไปเอง"
//
// ประวัติที่เซิร์ฟเวอร์เขียน (kind 'b2c' / 'b2c_new') จำลองด้วยการต่อท้าย bk.history ตรง ๆ
//
// กันแปดอย่าง
//   1 รวมหลายรอบเป็นบรรทัดเดียว (Pax 2 → 3 → 4) · เปลี่ยนแล้วเปลี่ยนกลับ = ไม่ขึ้น · มี b2c_seen ทีหลัง = ไม่ขึ้น
//     ใบใหม่ขึ้นเฉพาะที่วันเดินทางใกล้ (≤ B2C_CHG_NEW_DAYS) · ใบล่วงหน้าไกลไม่ขึ้น
//   2 หน้า By trip · บรรทัดสรุปอยู่ใต้แถวของใบนั้นพอดี · แถวนั้นติดสีส้ม · ค่าเก่าขีดฆ่า ค่าใหม่ตัวหนา
//     ยกเลิก = สีแดง "B2C ยกเลิก" · ใบใหม่ = สีน้ำเงิน
//   3 หัวหน้ามีปุ่ม "B2C changes N" · N = จำนวนใบที่ยังไม่รับทราบ (ทุกวันที่ยังไม่เดินทาง)
//   4 กดรับทราบ · บรรทัดหายทันที · ประวัติต่อท้าย b2c_seen (tag Seen · by ผู้ใช้) · เซฟลงเครื่องแล้ว · ตัวนับลด 1
//   5 แถบรวม · ใบที่เลื่อนวันอยู่กลุ่ม "Travel date moved" · ปุ่มไปที่วันนั้นปิดแถบ เปลี่ยนวัน และเลื่อนไปที่แถว
//   6 รับทราบทั้งหมด · ไม่เหลือรายการ · ปุ่มบนหัวหาย
//   7 คนที่แก้ใบจองไม่ได้ · เห็นบรรทัดแต่ไม่มีปุ่ม · จัดรถแล้วแต่โรงแรมเปลี่ยน = มีคำเตือนตรวจรถ
//   8 ไม่แตะข้อมูลใบจองอื่น ๆ (trips/pax/ops เท่าเดิม) · ไม่มี error
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1100 });
page.on('dialog', async d => { try { await d.accept(); } catch (_) {} });
await goView(page, 'booking', 900);

const P = await page.evaluate(() => {
  const ymd = n => { const d = new Date(); d.setDate(d.getDate() + n); return bkV2LocalYMD(d); };
  const D1 = ymd(1), FAR = ymd(30);
  const ago = m => new Date(Date.now() - m * 60000).toISOString();
  const b2c = SB_BOOKINGS.filter(b => /^b2c_/.test(b.id) && (b.trips || []).length && !['cancelled','cancelled_weather','rejected'].includes(b.status));
  if (b2c.length < 7) return { err: 'need 7 B2C bookings, have ' + b2c.length };
  const [B, C, Dd, E, G, H, I] = b2c;
  [B, C, Dd, E, G, I].forEach(b => { b.trips = [Object.assign({}, b.trips[0], { date: D1 })]; b.history = (b.history || []).filter(e => !/^b2c/.test(e.kind || '')); });
  H.trips = [Object.assign({}, H.trips[0], { date: FAR })]; H.history = [];
  const snap = JSON.stringify([B, C, Dd, E, G, H, I].map(b => ({ t: b.trips, o: b.ops || null, s: b.status })));
  B.history.push({ at: ago(9), kind: 'b2c', text: 'Pax: 2 Ad → 3 Ad · Hotel: Patong Bay Hotel → Kata Beach Resort', tag: 'B2C', by: 'B2C sync' });
  B.history.push({ at: ago(2), kind: 'b2c', text: 'Pax: 3 Ad → 4 Ad · Total: ฿3,600 → ฿5,400', tag: 'B2C', by: 'B2C sync' });
  C.history.push({ at: ago(60), kind: 'b2c', text: 'Status: Confirmed → Cancelled · line removed in B2C', tag: 'B2C', by: 'B2C sync' });
  Dd.history.push({ at: ago(90), kind: 'b2c', text: 'Phone: 1 → 2', tag: 'B2C', by: 'B2C sync' });
  Dd.history.push({ at: ago(80), kind: 'b2c_seen', text: 'B2C change reviewed', tag: 'Seen', by: 'ploy' });
  E.history.push({ at: ago(50), kind: 'b2c', text: 'Pax: 2 Ad → 3 Ad', tag: 'B2C', by: 'B2C sync' });
  E.history.push({ at: ago(40), kind: 'b2c', text: 'Pax: 3 Ad → 2 Ad', tag: 'B2C', by: 'B2C sync' });
  G.history.push({ at: ago(20), kind: 'b2c_new', text: 'New booking from B2C · ' + D1 + ' · 2 Ad', tag: 'B2C', by: 'B2C sync' });
  H.history.push({ at: ago(20), kind: 'b2c_new', text: 'New booking from B2C', tag: 'B2C', by: 'B2C sync' });
  I.history.push({ at: ago(35), kind: 'b2c', text: 'Date: 1 Oct → ' + D1.slice(8) + ' Oct', tag: 'B2C', by: 'B2C sync' });
  bkV2PersistBookings();
  return { D1, FAR, ids: { B: B.id, C: C.id, D: Dd.id, E: E.id, G: G.id, H: H.id, I: I.id }, snap };
});
if (P.err) { fail('prep ' + P.err); await close(); process.exit(1); }
const ids = P.ids;

/* 1 */
const R1 = await page.evaluate(ids => {
  const g = id => bkV2B2CPending(SB_BOOKINGS.find(b => b.id === id));
  const b = g(ids.B);
  return { bPax: b && (b.segs.find(s => s.label === 'Pax') || {}).vals, bLabels: b && b.segs.map(s => s.label), c: g(ids.C), d: g(ids.D), e: g(ids.E), gNew: (g(ids.G) || {}).isNew, h: g(ids.H), iMoved: (g(ids.I) || {}).moved };
}, ids);
if (JSON.stringify(R1.bPax) === JSON.stringify(['2 Ad', '3 Ad', '4 Ad']) && JSON.stringify(R1.bLabels) === JSON.stringify(['Pax', 'Hotel', 'Total'])
    && R1.c && R1.c.cancelled && R1.d === null && R1.e === null && R1.gNew === true && R1.h === null && R1.iMoved === true)
  ok('1 รวมเป็น Pax 2 → 3 → 4 · เปลี่ยนกลับไม่ขึ้น · รับทราบแล้วไม่ขึ้น · ใบใหม่ใกล้วันขึ้น ไกลไม่ขึ้น · เลื่อนวัน = moved');
else fail('1 ' + JSON.stringify(R1));

/* 2 */
await page.evaluate(D1 => { _bkV2.filterDate = D1; _bkV2.filterRoute = null; bkV2SwitchTab('bytrip'); }, P.D1);
await page.waitForTimeout(1400);
const readRows = () => page.evaluate(ids => {
  const T = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
  const strip = id => document.querySelector('tr.t2-b2cchg[data-bk="' + id + '"]');
  const out = {};
  for (const [k, id] of Object.entries(ids)) {
    const s = strip(id);
    let prevRow = null;
    if (s) { let p = s.previousElementSibling; while (p && !p.classList.contains('t2-row')) p = p.previousElementSibling; prevRow = p; }
    out[k] = s ? { cls: s.className, txt: T(s), strikes: [...s.querySelectorAll('s')].map(T), bold: [...s.querySelectorAll('b')].map(T),
      btn: !!s.querySelector('.b2cok'), above: prevRow ? (prevRow.className.includes('t2-b2cflag') && prevRow.textContent.includes((SB_BOOKINGS.find(b => b.id === id).leadPax || '').slice(0, 12))) : false } : null;
  }
  const chip = document.querySelector('.bt-b2cbtn');
  out.chip = chip ? T(chip) : null; out.listN = bkV2B2CList().length;
  return out;
}, ids);
const R2 = await readRows();
const b = R2.B;
if (b && b.above && /B2C แก้ไข/.test(b.txt) && b.cls.includes('k-o') && JSON.stringify(b.strikes) === JSON.stringify(['2 Ad', '3 Ad', 'Patong Bay Hotel', '฿3,600'])
    && b.bold.includes('4 Ad') && b.bold.includes('Kata Beach Resort') && b.btn
    && R2.C && R2.C.cls.includes('k-r') && /B2C ยกเลิก/.test(R2.C.txt) && /line removed in B2C/.test(R2.C.txt)
    && R2.G && R2.G.cls.includes('k-n') && /ใบใหม่จาก B2C/.test(R2.G.txt)
    && !R2.D && !R2.E && R2.I)
  ok('2 บรรทัดสรุปอยู่ใต้แถวของใบนั้น (แถวติดสีส้ม) · ' + b.txt.slice(0, 90) + '…');
else fail('2 ' + JSON.stringify(R2));

/* 3 */
if (R2.chip && R2.listN === 4 && new RegExp('B2C changes ' + R2.listN + ' to review').test(R2.chip)) ok('3 หัวหน้า "' + R2.chip + '" · นับเฉพาะใบที่ยังไม่รับทราบและยังไม่เดินทาง');
else fail('3 ' + JSON.stringify({ chip: R2.chip, n: R2.listN }));

/* 4 */
await page.click('tr.t2-b2cchg[data-bk="' + ids.B + '"] .b2cok');
await page.waitForTimeout(500);
const R4 = await page.evaluate(id => {
  const bk = SB_BOOKINGS.find(b => b.id === id), last = bk.history[bk.history.length - 1];
  let saved = null; try { const o = JSON.parse(localStorage.getItem(LS_KEY)); const sb = (o.sb_bookings || []).find(b => b.id === id); saved = sb && sb.history[sb.history.length - 1]; } catch (e) { saved = 'ERR ' + e.message; }
  return { strip: !!document.querySelector('tr.t2-b2cchg[data-bk="' + id + '"]'), flag: !!document.querySelector('tr.t2-b2cflag'), last, saved, me: laBy(), chip: (document.querySelector('.bt-b2cbtn') || {}).textContent || '', n: bkV2B2CList().length };
}, ids.B);
if (!R4.strip && R4.last.kind === 'b2c_seen' && R4.last.tag === 'Seen' && R4.last.by === R4.me && /Pax, Hotel, Total/.test(R4.last.text)
    && R4.saved && R4.saved.kind === 'b2c_seen' && R4.n === 3 && /B2C changes 3 to review/.test(R4.chip))
  ok('4 รับทราบแล้วหาย · ประวัติ "' + R4.last.text + '" by ' + R4.last.by + ' · เซฟลงเครื่องแล้ว · เหลือ 3');
else fail('4 ' + JSON.stringify(R4));

/* 5 */
await page.click('.bt-b2cbtn');
await page.waitForTimeout(300);
const R5a = await page.evaluate(ids => {
  const d = document.getElementById('b2cchg-drw'); if (!d) return { err: 'no drawer' };
  const groups = [...d.querySelectorAll('.b2cg')].map(x => x.textContent.trim());
  const items = [...d.querySelectorAll('.b2ci')];
  const first = items[0] ? items[0].textContent : '';
  return { groups, n: items.length, firstIsMoved: /Date/.test(first), visible: getComputedStyle(d.querySelector('.b2cd')).position === 'absolute' };
}, ids);
// เปลี่ยนวันที่หน้าจอไปวันอื่นก่อน แล้วกดไปที่ใบที่เลื่อนวัน
await page.evaluate(FAR => { _bkV2.filterDate = FAR; }, P.FAR);
await page.click('#b2cchg-drw .b2ci button');
await page.waitForTimeout(900);
const R5b = await page.evaluate(id => ({ drawer: !!document.getElementById('b2cchg-drw'), date: _bkV2.filterDate, tab: _bkV2.tab, row: !!document.querySelector('tr.t2-b2cchg[data-bk="' + id + '"]') }), ids.I);
if (!R5a.err && R5a.n === 3 && /^Travel date moved/.test(R5a.groups[0]) && R5a.firstIsMoved && R5a.visible && !R5b.drawer && R5b.date === P.D1 && R5b.tab === 'bytrip' && R5b.row)
  ok('5 แถบรวม ' + R5a.n + ' รายการ · กลุ่ม ' + R5a.groups.join(' / ') + ' · กดไปที่วันนั้นแล้วเจอแถว');
else fail('5 ' + JSON.stringify({ R5a, R5b }));

/* 7 (ก่อนข้อ 6 เพราะข้อ 6 ล้างทุกอย่าง) */
const R7 = await page.evaluate(ids => {
  const real = window.acctCanEditBookings; window.acctCanEditBookings = () => false; bkV2Render();
  const s = document.querySelector('tr.t2-b2cchg[data-bk="' + ids.C + '"]'); const noBtn = s && !s.querySelector('.b2cok');
  const seen = bkV2B2CSeen(ids.C, true);
  window.acctCanEditBookings = real; bkV2Render();
  const fake = { id: 'x', ops: { vanId: 'van1' }, trips: [], history: [{ at: new Date().toISOString(), kind: 'b2c', text: 'Hotel: A → B' }] };
  const html = bkV2B2CBodyHtml(fake, bkV2B2CPending(fake));
  const fake2 = { id: 'y', ops: {}, trips: [], history: fake.history };
  return { noBtn, seen, warn: /ตรวจรถ/.test(html), noWarn: !/ตรวจรถ/.test(bkV2B2CBodyHtml(fake2, bkV2B2CPending(fake2))) };
}, ids);
if (R7.noBtn && R7.seen === false && R7.warn && R7.noWarn) ok('7 ดูอย่างเดียว · เห็นบรรทัดแต่ไม่มีปุ่ม และกดผ่านโค้ดก็ไม่บันทึก · จัดรถแล้วโรงแรมเปลี่ยน = เตือนตรวจรถ');
else fail('7 ' + JSON.stringify(R7));

/* 6 */
await page.evaluate(() => bkV2B2COpen());
await page.click('#b2cchg-drw .b2cd-f button');
await page.waitForTimeout(500);
const R6 = await page.evaluate(() => ({ n: bkV2B2CList().length, chip: !!document.querySelector('.bt-b2cbtn'), strips: document.querySelectorAll('tr.t2-b2cchg').length, empty: ((document.querySelector('#b2cchg-drw .b2ce') || {}).textContent || '') }));
if (R6.n === 0 && !R6.chip && R6.strips === 0 && /ไม่มีรายการค้าง/.test(R6.empty)) ok('6 รับทราบทั้งหมด · ไม่เหลือรายการ · ปุ่มบนหัวหาย');
else fail('6 ' + JSON.stringify(R6));

/* 8 */
const R8 = await page.evaluate(ids => JSON.stringify(['B', 'C', 'D', 'E', 'G', 'H', 'I'].map(k => { const b = SB_BOOKINGS.find(x => x.id === ids[k]); return { t: b.trips, o: b.ops || null, s: b.status }; })), ids);
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e));
if (R8 === P.snap && !e1.length) ok('8 trips/ops/status ของทุกใบเท่าเดิม · ไม่มี error');
else fail('8 ' + (R8 === P.snap ? '' : 'data changed ') + e1.slice(0, 3).join(' | '));

await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
