// §pkTop · หน้าตั๋วอุทยาน · แถบบนตรึงไว้ + ชิปเส้นทางที่กดแล้วกรอง
//
// ที่มา (2026-09-28) · ผู้ใช้ขอเอง · "ปรับการตรึงหัวด้านบน · ทำเป็นชิปของแต่ละเส้นทาง แล้วกดเอา"
// หน้านี้เลื่อนยาวมาก (สูงสุด 44 แถวต่อลำ) เลื่อนไปแล้วไม่รู้ว่าอยู่ลำไหน
// และวันที่มีหลายเส้นทางต้องเลื่อนผ่านทั้งเส้นอื่นกว่าจะถึงเส้นที่ต้องดู
//
// ⚠ หน้านี้เป็นหน้าอ่านอย่างเดียว · เขียนได้แค่ PIER_CFG.parkTypes / parkFix / parkName
//   เทสนี้จึงตรวจด้วยว่ากดชิปแล้ว SB_BOOKINGS และ TRIPS ไม่ขยับสักตัว
//
// เทสนี้กันหกอย่าง
//   1 มีชิปครบทุกเส้นทางของวันนั้น + ปุ่ม "ทุกเส้นทาง"
//   2 ตัวเลขบนชิปตรงกับจำนวนแถวที่พิมพ์ลงชีทจริงของทุกลำในเส้นนั้น
//     (นับจากตารางที่วาดออกมา ไม่ใช่เชื่อตัวเลขที่หน้าเดียวกันคำนวณให้)
//   3 กดชิปแล้วเหลือเฉพาะเส้นนั้น · กดซ้ำตัวกรองหลุด
//   4 เปลี่ยนวันแล้วตัวกรองที่ชี้ไปเส้นที่ไม่มีต้องถูกล้างเอง ไม่ใช่โชว์หน้าเปล่า
//   5 แถบบนตรึงจริง และหัวตารางตรึงใต้แถบ ไม่ใช่ชนขอบจอแล้วมุดหาย
//   6 กดชิปแล้วข้อมูลจริงไม่ขยับ (หน้านี้อ่านอย่างเดียว)

import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1100 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1200);

/* ══ 0 · หาวัน/ท่า ที่มีหลายเส้นทาง ═══════════════════════════════════ */
const R0 = await page.evaluate(() => {
  const el = document.querySelector('.nav-item[data-view^="pok-"]');
  if (!el) return { err: 'ไม่มีเมนูตั๋วอุทยานในไซด์บาร์' };
  nav(el);
  if (typeof poBoats !== 'function') return { err: 'ไม่มี poBoats' };
  const days = [...new Set((SB_BOOKINGS || []).flatMap(b => (b.trips || []).map(t => t.date)).filter(Boolean))].sort();
  const piers = (typeof PO_PIERS !== 'undefined') ? PO_PIERS.map(p => p.k) : [];
  let best = null;
  days.forEach(d => piers.forEach(pier => {
    let B = []; try { B = poBoats(d, pier) || []; } catch (_) { return; }
    if (!B.length) return;
    const n = [...new Set(B.map(x => x.rid))].length;
    if (!best || n > best.n) best = { d, pier, n };
  }));
  if (!best || best.n < 2) return { err: 'ชุดข้อมูลนี้ไม่มีวันไหนที่ท่าเดียวมี 2 เส้นทาง · ตรวจชิปกรองไม่ได้' };
  /* วันอื่นที่มีเรือแต่คนละชุดเส้นทาง · ใช้ตรวจข้อ 4 */
  let other = null;
  days.forEach(d => {
    if (other || d === best.d) return;
    let B = []; try { B = poBoats(d, best.pier) || []; } catch (_) { return; }
    if (!B.length) return;
    const rids = new Set(B.map(x => x.rid));
    const bestRids = new Set((poBoats(best.d, best.pier) || []).map(x => x.rid));
    if ([...bestRids].some(r => !rids.has(r))) other = d;
  });
  return { day: best.d, pier: best.pier, nRoute: best.n, other };
});
if (R0.err) fail(R0.err);
else ok('ใช้ ' + R0.pier + ' ' + R0.day + ' · ' + R0.nRoute + ' เส้นทาง เป็นตัวตรวจ');

if (!R0.err) {
  await page.evaluate(p => { if (typeof renderPierPark === 'function') renderPierPark(p); }, R0.pier);
  await page.evaluate(d => { if (typeof pkSetDate === 'function') pkSetDate(d); }, R0.day);
  await page.waitForTimeout(800);

  const host = () => page.evaluate(() => {
    const h = document.querySelector('[id^="pk-host-"]');
    if (!h) return null;
    return {
      chips: [].slice.call(h.querySelectorAll('.pk-rt')).map(b => ({
        txt: (b.textContent || '').trim(),
        n: +((b.querySelector('b') || {}).textContent || 0),
        on: b.classList.contains('on')
      })),
      trips: [].slice.call(h.querySelectorAll('.pk-trip .rn')).map(x => (x.textContent || '').trim()),
      stickPos: (function () { const s = h.querySelector('.pk-stick'); return s ? getComputedStyle(s).position : '-'; })(),
      stickH: (function () { const s = h.querySelector('.pk-stick'); return s ? Math.round(s.getBoundingClientRect().height) : 0; })(),
      thTop: (function () { const t = h.querySelector('.pk-sheet thead th'); return t ? getComputedStyle(t).top : '-'; })()
    };
  });

  /* ══ 1 · ชิปครบทุกเส้นทาง ══════════════════════════════════════════ */
  const H = await host();
  if (!H) fail('ไม่มีกล่องหน้าตั๋วอุทยาน');
  else if (H.chips.length !== R0.nRoute + 1)
    fail('ชิปมี ' + H.chips.length + ' อัน · ควรเป็น ' + (R0.nRoute + 1) + ' (ทุกเส้นทาง + ' + R0.nRoute + ' เส้น)');
  else if (!H.chips[0].on)
    fail('ตอนเปิดหน้าปุ่ม "ทุกเส้นทาง" ไม่ได้ถูกเลือกไว้ · ต้องเห็นทุกเส้นก่อนเป็นค่าตั้งต้น');
  else if (H.trips.length !== R0.nRoute)
    fail('วาดออกมา ' + H.trips.length + ' เส้นทาง · ควรเป็น ' + R0.nRoute);
  else ok('ชิปครบ ' + R0.nRoute + ' เส้นทาง + ปุ่มทุกเส้นทาง · ค่าตั้งต้นเห็นทุกเส้น');

  /* ══ 2 · ตัวเลขบนชิป = แถวที่พิมพ์ลงชีทจริง ═══════════════════════
     ไม่เอาตัวเลขที่ pkTkData คำนวณมาเทียบกับชิปที่วาดจาก pkTkData เหมือนกัน
     นับจากแถวในตารางชีทของทุกลำในเส้นนั้น ซึ่งคือของที่คนเอาไปยื่นด่านจริง */
  const R2 = await page.evaluate(async () => {
    const h = document.querySelector('[id^="pk-host-"]');
    const out = [];
    const chips = [].slice.call(h.querySelectorAll('.pk-rt')).slice(1);
    for (let i = 0; i < chips.length; i++) {
      const want = +((chips[i].querySelector('b') || {}).textContent || 0);
      const name = (chips[i].childNodes[1] ? chips[i].childNodes[1].textContent : '').trim();
      chips[i].click();
      await new Promise(r => setTimeout(r, 120));
      const h2 = document.querySelector('[id^="pk-host-"]');
      const tabs = [].slice.call(h2.querySelectorAll('.pk-trip .pk-tab'));
      let rows = 0;
      for (let k = 0; k < tabs.length; k++) {
        const t = document.querySelectorAll('.pk-trip .pk-tab')[k];
        t.click();
        await new Promise(r => setTimeout(r, 100));
        /* แถวที่เกินหัว (pk-ovr) ไม่ถูกนับในชิป · ชิปคือ "ต้องซื้อกี่ใบ" */
        const h3 = document.querySelector('[id^="pk-host-"]');
        rows += h3.querySelectorAll('.pk-sheet tbody tr:not(.pk-ovr)').length;
      }
      out.push({ name, want, rows, nBoat: tabs.length });
      /* ล้างตัวกรองก่อนไปเส้นถัดไป */
      document.querySelector('[id^="pk-host-"] .pk-rt').click();
      await new Promise(r => setTimeout(r, 120));
    }
    return out;
  });
  const off2 = R2.filter(x => x.want !== x.rows);
  if (!R2.length) fail('ไม่มีชิปเส้นทางให้ตรวจ');
  else if (off2.length)
    fail('ตัวเลขบนชิปไม่ตรงกับแถวในชีทจริง · ' +
         off2.map(x => '"' + x.name + '" ชิป ' + x.want + ' แต่ชีท ' + x.rows + ' แถว (' + x.nBoat + ' ลำ)').join(' · '));
  else ok('ตัวเลขบนชิปตรงกับแถวที่พิมพ์ลงชีทจริงทุกเส้น · ' +
          R2.map(x => x.name + ' ' + x.rows).join(' · '));

  /* ══ 3 · กดแล้วกรอง · กดซ้ำหลุด ═══════════════════════════════════ */
  const R3 = await page.evaluate(async () => {
    const pick = () => document.querySelectorAll('[id^="pk-host-"] .pk-rt')[1];
    pick().click(); await new Promise(r => setTimeout(r, 150));
    const h1 = document.querySelector('[id^="pk-host-"]');
    const a = { n: h1.querySelectorAll('.pk-trip').length,
                on: [].slice.call(h1.querySelectorAll('.pk-rt.on')).length,
                allOn: h1.querySelector('.pk-rt').classList.contains('on') };
    pick().click(); await new Promise(r => setTimeout(r, 150));
    const h2 = document.querySelector('[id^="pk-host-"]');
    return { a, b: { n: h2.querySelectorAll('.pk-trip').length,
                     allOn: h2.querySelector('.pk-rt').classList.contains('on') } };
  });
  if (R3.a.n !== 1) fail('กดชิปเส้นเดียวแล้วยังเห็น ' + R3.a.n + ' เส้นทาง · ต้องเหลือ 1');
  else if (R3.a.on !== 1) fail('กดชิปแล้วมีชิปติดไฟ ' + R3.a.on + ' อัน · ต้องมีแค่อันเดียว');
  else if (R3.a.allOn) fail('กดชิปเส้นเดียวแล้วปุ่ม "ทุกเส้นทาง" ยังติดไฟอยู่ · จอบอกว่าเห็นหมดทั้งที่กรองอยู่');
  else if (R3.b.n !== R0.nRoute || !R3.b.allOn)
    fail('กดชิปเดิมซ้ำแล้วตัวกรองไม่หลุด · เหลือ ' + R3.b.n + '/' + R0.nRoute + ' เส้น');
  else ok('กดชิปแล้วเหลือเส้นเดียว · กดซ้ำตัวกรองหลุดกลับมาครบ ' + R0.nRoute + ' เส้น');

  /* ══ 4 · เปลี่ยนวันแล้วตัวกรองที่ค้างต้องถูกล้าง ═══════════════════ */
  if (!R0.other) ok('ชุดข้อมูลนี้ไม่มีวันอื่นที่ชุดเส้นทางต่างกัน · ข้ามการตรวจตัวกรองค้างข้ามวัน');
  else {
    const R4 = await page.evaluate(async (o) => {
      document.querySelectorAll('[id^="pk-host-"] .pk-rt')[1].click();
      await new Promise(r => setTimeout(r, 150));
      const before = _pkRoute;
      pkSetDate(o);
      await new Promise(r => setTimeout(r, 250));
      const h = document.querySelector('[id^="pk-host-"]');
      return { before, after: _pkRoute, nTrip: h.querySelectorAll('.pk-trip').length,
               nChip: h.querySelectorAll('.pk-rt').length };
    }, R0.other);
    if (R4.nChip <= 1) ok('วัน ' + R0.other + ' ไม่มีเรือที่ท่านี้ · ข้ามการตรวจ');
    else if (R4.after && R4.after === R4.before && !R4.nTrip)
      fail('เปลี่ยนวันแล้วตัวกรองยังค้างที่เส้นที่วันนี้ไม่มี · หน้าเลยว่างเปล่าโดยไม่บอกอะไร');
    else if (!R4.nTrip)
      fail('เปลี่ยนวันแล้วไม่มีเส้นทางถูกวาดเลย ทั้งที่มีชิป ' + (R4.nChip - 1) + ' เส้น');
    else ok('เปลี่ยนวันแล้วตัวกรองที่ชี้ไปเส้นที่ไม่มีถูกล้างเอง · เห็น ' + R4.nTrip + ' เส้นทาง ไม่ใช่หน้าเปล่า');
    await page.evaluate(d => pkSetDate(d), R0.day);
    await page.waitForTimeout(400);
  }

  /* ══ 5 · แถบบนตรึง และหัวตารางตรึงใต้แถบ ═════════════════════════ */
  const H5 = await host();
  if (H5.stickPos !== 'sticky')
    fail('แถบบนไม่ได้ตรึง (position: ' + H5.stickPos + ') · เลื่อนลงแล้วชิปกับวันที่หายไปจากจอ');
  else if (!H5.stickH) fail('แถบบนสูง 0 · วัดความสูงไม่ได้');
  else if (H5.thTop === '-') fail('หาหัวตารางชีทไม่เจอ · ตรวจข้อนี้ไม่ได้');
  else if (Math.abs(parseFloat(H5.thTop) - H5.stickH) > 2)
    fail('หัวตารางตรึงที่ ' + H5.thTop + ' แต่แถบบนสูง ' + H5.stickH + 'px · หัวตารางจะมุดหายใต้แถบ');
  else ok('แถบบนตรึงจริง สูง ' + H5.stickH + 'px · หัวตารางตรึงพอดีใต้แถบที่ ' + H5.thTop);

  /* ══ 6 · หน้านี้อ่านอย่างเดียว · กดชิปแล้วข้อมูลห้ามขยับ ══════════ */
  const R6 = await page.evaluate(async () => {
    const snap = () => JSON.stringify({
      bk: (SB_BOOKINGS || []).length,
      tr: Object.keys((typeof TRIPS !== 'undefined' && TRIPS) || {}).length,
      ls: (function () { try { return (localStorage.getItem('loveandaman_v2') || '').length; } catch (_) { return -1; } })()
    });
    const a = snap();
    const cs = [].slice.call(document.querySelectorAll('[id^="pk-host-"] .pk-rt'));
    for (const c of cs) { c.click(); await new Promise(r => setTimeout(r, 90)); }
    return { same: a === snap(), a, b: snap() };
  });
  if (!R6.same) fail('กดชิปแล้วข้อมูลขยับ · ' + R6.a + ' → ' + R6.b + ' · หน้านี้ต้องอ่านอย่างเดียว');
  else ok('กดชิปทุกอันแล้วใบจอง ทริป และข้อมูลในเครื่องไม่ขยับสักตัว · ยังอ่านอย่างเดียวจริง');
}

/* ══ 7 · ไม่มี error บนหน้า ════════════════════════════════════════ */
if (errors.length) fail('มี error ' + errors.length + ' ครั้ง · ' + errors.slice(0, 2).join(' | '));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
