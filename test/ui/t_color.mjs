// §inkOn · สีประจำเอเยนต์ต้องอ่านออกเสมอ
//
// ที่มา (2026-10-01) · ผู้ใช้ส่งภาพแถวล็อกที่นั่งมา "ดูเรื่องสี สีเหลืองมันไม่ชัด"
//   เลขที่นั่งของล็อกใช้สีประจำเอเยนต์เป็นสีตัวเลขบนพื้นขาว
//   เอเยนต์ที่ตั้งสีเหลือง (#fff838) ตัวเลขจึงจมหายไปกับพื้น
//
// วัดจากข้อมูลจริงก่อนแก้ · เอเยนต์ที่ตั้งสีเอง 49 เจ้า
//   45 เจ้า คอนทราสต์บนพื้นขาวไม่ถึง 4.5:1 · เจ้าที่ใช้ #ffff00 ได้ 1.07:1
//   12 เจ้า ชิปได้ ink ผิดตัว เช่น #ff7300 ได้ 2.73:1 ทั้งที่ขาวให้ 5.13:1
// ไม่ใช่เรื่องของเอเยนต์รายเดียว แต่เป็นวิธีใช้สีที่ผิดตั้งแต่แรก
//
// เกณฑ์ที่ใช้คือ WCAG contrast ratio · 4.5:1 สำหรับตัวหนังสือปกติ
// เลือกเกณฑ์นี้เพราะเอกสารพวกนี้ถูกอ่านบนจอโน้ตบุ๊กกลางแดดที่ท่าเรือ
//
// เทสนี้กันห้าอย่าง
//   1 laInk ทำให้ทุกสีเอเยนต์ในชุดข้อมูลจริงอ่านออกบนพื้นขาว (>= 4.5:1)
//   2 laInk ไม่เปลี่ยนเฉดสี · แค่เข้มขึ้น (hue เดิม)
//   3 laInk ไม่หรี่เกินจำเป็น · สีที่เข้มพออยู่แล้วต้องไม่ถูกแตะ
//   4 bkV2ContrastInk เลือกตัวที่คอนทราสต์ดีกว่าเสมอ · ไม่มีสีไหนแย่ลงกว่าเดิม
//   5 เลขที่นั่งในแถวล็อกบนหน้าจริง อ่านออก (วัดจาก computed color ที่เบราว์เซอร์คำนวณ)
//   6 ไม่มี error บนหน้า

import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1800, height: 1200 });
await goView(page, 'booking', 900);

/* ══ 1 · 2 · 3 · 4 · ตัวช่วยสี ═══════════════════════════════════════ */
const R = await page.evaluate(() => {
  for (const f of ['laInk', '_calLum', '_calRatio', '_calHx', 'bkV2ContrastInk'])
    if (typeof window[f] !== 'function') return { err: 'ยังไม่มีฟังก์ชัน ' + f };
  const rgb = s => { const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(s);
    return m ? [+m[1], +m[2], +m[3]] : _calHx(s); };
  const ratioOf = (a, b) => _calRatio(_calLum(a[0], a[1], a[2]), _calLum(b[0], b[1], b[2]));
  const W = [255, 255, 255], DK = [0x2c, 0x2c, 0x2a];
  const hue = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx === mn) return -1; const d = mx - mn;
    let h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? ((b - r) / d + 2) : ((r - g) / d + 4);
    return Math.round(h / 6 * 360) % 360; };

  const cols = [...new Set((SB_AGENTS || []).map(a => a && a.color).filter(Boolean))];
  if (cols.length < 5) return { err: 'ชุดข้อมูลนี้มีเอเยนต์ที่ตั้งสีเองน้อยเกินไป (' + cols.length + ')' };

  const worst = { r: 99, c: '' }, worstBefore = { r: 99, c: '' };
  const hueOff = [], tooDark = [];
  cols.forEach(c => {
    const o = _calHx(c), ink = rgb(laInk(c));
    const rb = ratioOf(o, W), ra = ratioOf(ink, W);
    if (rb < worstBefore.r) { worstBefore.r = rb; worstBefore.c = c; }
    if (ra < worst.r) { worst.r = ra; worst.c = c; }
    const h1 = hue(o), h2 = hue(ink);
    if (h1 >= 0 && h2 >= 0) { const d = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
      if (d > 4) hueOff.push(c + ' ' + h1 + '° → ' + h2 + '°'); }
    /* หรี่เกินจำเป็น = สีที่ผ่านเกณฑ์อยู่แล้วแต่ยังโดนเปลี่ยน */
    if (rb >= 4.5 && ink.join() !== o.join()) tooDark.push(c);
  });

  /* ink ของชิป · ต้องไม่มีสีไหนได้ค่าต่ำกว่าสิ่งที่ดีที่สุดในสองตัวเลือก */
  const inkBad = [];
  cols.forEach(c => {
    const o = _calHx(c), pick = _calHx(bkV2ContrastInk(c));
    const got = ratioOf(o, pick), best = Math.max(ratioOf(o, W), ratioOf(o, DK));
    if (got < best - 0.01) inkBad.push(c + ' ได้ ' + got.toFixed(2) + ' ทั้งที่ทำได้ ' + best.toFixed(2));
  });
  return { n: cols.length, worst, worstBefore, hueOff, tooDark, inkBad, hx: _calHx('#ffff00'),
           sample: cols.slice(0, 3).map(c => c + ' → ' + laInk(c)) };
});
if (R.err) { fail(R.err); console.log('\n✗ 1 ข้อไม่ผ่าน'); await close(); process.exit(1); }

/* §hx00 · เจอระหว่างไล่เรื่องนี้ · parseInt('00',16) เป็น 0 ซึ่ง falsy
   ตัว || เลยเด้งไปค่าสำรอง 136 · สีที่มีช่อง 00 ถูกอ่านผิดทั้งหมด
   และเป็นสีที่คนเลือกบ่อยที่สุด (#ffff00 #ff0000 #00a0ff) */
if (!R.hx || R.hx.join() !== '255,255,0')
  fail('อ่านค่าสี #ffff00 ได้ [' + (R.hx || []).join(',') + '] ควรเป็น [255,255,0]'
       + ' · ช่องที่เป็น 00 ถูกแทนด้วยค่าสำรอง ทำให้ทุกตัวที่คำนวณสีต่อจากนี่ผิดหมด');
else ok('อ่านค่าสีที่มีช่อง 00 ได้ถูกต้อง · #ffff00 → [255,255,0]');

if (R.worst.r < 4.5)
  fail('ยังมีสีที่อ่านไม่ออกบนพื้นขาว · แย่สุด ' + R.worst.r.toFixed(2) + ':1 ที่สี ' + R.worst.c);
else ok('สีเอเยนต์ทั้ง ' + R.n + ' สี อ่านออกบนพื้นขาวหมด · แย่สุด '
        + R.worst.r.toFixed(2) + ':1 (ก่อนแก้แย่สุด ' + R.worstBefore.r.toFixed(2) + ':1 ที่ ' + R.worstBefore.c + ')');

if (R.hueOff.length)
  fail('หรี่แล้วเฉดสีเพี้ยน ' + R.hueOff.length + ' สี · ' + R.hueOff.slice(0, 3).join(' | ')
       + ' · คนจำเอเยนต์จากสี ถ้าเฉดเปลี่ยนจะจำผิดเจ้า');
else ok('หรี่แล้วเฉดสีคงเดิมทุกสี · ยังจำได้ว่าเป็นเอเยนต์เจ้าไหน');

if (R.tooDark.length)
  fail('สีที่เข้มพออยู่แล้ว ' + R.tooDark.length + ' สี ยังโดนหรี่ซ้ำ · ' + R.tooDark.slice(0, 3).join(' '));
else ok('หรี่เฉพาะสีที่จำเป็น · สีที่เข้มพออยู่แล้วไม่ถูกแตะ');

if (R.inkBad.length)
  fail('ชิปเลือกสีตัวอักษรผิดตัว ' + R.inkBad.length + ' สี · ' + R.inkBad.slice(0, 3).join(' | '));
else ok('ชิปเลือกสีตัวอักษรที่คอนทราสต์ดีที่สุดเสมอทั้ง ' + R.n + ' สี');

/* ══ 5 · ของจริงบนหน้า ═══════════════════════════════════════════════
   วัดจาก computed color ที่เบราว์เซอร์คำนวณจริง ไม่ใช่ค่าที่เราส่งเข้าไป
   ถ้ามีกฎ CSS อื่นมาทับทีหลัง ค่าที่ส่งไปจะถูกแต่สิ่งที่คนเห็นยังผิด */
{
  const P = await page.evaluate(() => {
    /* ล็อกในชุดข้อมูลหมดอายุหมดแล้ว · สร้างของตัวเองบนวันที่มีทริปจริง
       แล้วเก็บกวาดทิ้งตอนจบ · ต้องใช้เอเยนต์ที่ตั้งสีอ่อน ไม่งั้นวัดไม่เจอปัญหา */
    const pale = (SB_AGENTS || []).filter(a => a && a.color).map(a => {
      const o = _calHx(a.color);
      return { a, r: _calRatio(_calLum(o[0], o[1], o[2]), _calLum(255, 255, 255)) };
    }).sort((x, y) => x.r - y.r)[0];
    if (!pale) return { err: 'ไม่มีเอเยนต์ที่ตั้งสีเอง' };
    let trip = null;
    (SB_BOOKINGS || []).some(b => (b.trips || []).some(t => {
      if (t.date && t.routeId) { trip = t; return true; } return false; }));
    if (!trip) return { err: 'ไม่มีทริปให้ผูกล็อก' };
    const id = 'T-COLOR-LK';
    SB_SEAT_LOCKS.push({ id, routeId: trip.routeId, date: trip.date, qty: 8, status: 'active',
                         holderType: 'agent', holderId: pale.a.id, reason: 'test' });
    _bkV2.tab = 'bytrip'; _bkV2.vanAssignMode = false;
    _bkV2.filterDate = trip.date; _bkV2.filterRoute = trip.routeId;
    bkV2Render();
    const rgb = s => { const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(s); return m ? [+m[1], +m[2], +m[3]] : null; };
    let seen = 0, worst = 99, worstTxt = '';
    document.querySelectorAll('tr.t2-lrow .lkq').forEach(q => {
      const c = rgb(getComputedStyle(q).color); if (!c) return;
      seen++;
      const r = _calRatio(_calLum(c[0], c[1], c[2]), _calLum(255, 255, 255));
      if (r < worst) { worst = r; worstTxt = getComputedStyle(q).color; }
    });
    const i = SB_SEAT_LOCKS.findIndex(x => x.id === id); if (i >= 0) SB_SEAT_LOCKS.splice(i, 1);
    bkV2Render();
    return { seen, worst, worstTxt, agent: pale.a.name, color: pale.a.color, before: +pale.r.toFixed(2) };
  });
  if (P.err) fail('ข้อ 5 · ' + P.err);
  else if (!P.seen) fail('ข้อ 5 · สร้างล็อกแล้วแต่ไม่มีแถวขึ้นในตาราง วัดของจริงไม่ได้');
  else if (P.worst < 4.5)
    fail('เลขที่นั่งบนหน้าจริงยังอ่านไม่ออก · ' + P.worst.toFixed(2) + ':1 (' + P.worstTxt + ')');
  else ok('เลขที่นั่งบนหน้าจริงอ่านออก · ' + P.worst.toFixed(2) + ':1 สำหรับเอเยนต์สี '
          + P.color + ' (ถ้าใช้สีดิบจะได้ ' + P.before + ':1)');
}

/* ══ 6 ═══════════════════════════════════════════════════════════ */
if (errors.length) fail('มี error บนหน้า · ' + errors.slice(0, 3).join(' | '));
else ok('ไม่มี error บนหน้า');

await close();
console.log(bad ? '\n✗ ' + bad + ' ข้อไม่ผ่าน' : '\n✓ ผ่านทั้งหมด');
process.exit(bad ? 1 : 0);
