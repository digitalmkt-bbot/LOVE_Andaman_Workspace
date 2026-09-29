// §bkCalOrphan · ปฏิทิน Booking · วันที่ปิดไปแล้วแต่ยังมี booking ค้าง
//
// ที่มา (2026-09-29) · ผู้ใช้ขอเอง
//   "มันมีการปรับเปลี่ยนตารางออกเรือนิดหน่อย แต่ในวันนั้น ๆ มันมีบุคกิ้งค้างอยู่ ยังไม่ได้จัดการ
//    ทีนี้ในหน้านี้ให้ขึ้นบุคกิ้งค้างก่อนดีไหม ถ้าจัดการแล้วค่อยหาย"
//
// ของเดิม · ชิปบนปฏิทินกรองด้วย bkV2IsFamilyOpenOn() อย่างเดียว
//   พอปิดวันนั้นไป เซลล์ไม่วาดชิปเลย ทั้งที่ bkV2FamilyAggregate อ่าน pax จากใบจอง
//   ไม่ได้อ่านจากตาราง · ตัวเลขถูกคิดไว้แล้วแต่ถูกทิ้ง · ใบจองหายจากจอทั้งที่ยังอยู่ในระบบ
//   แบบนี้ไม่มี error ให้จับ หน้าเปิดได้ปกติ · ต้องวัดจากชิปที่วาดออกมาจริง
//
// ขอบเขตที่ผู้ใช้เลือก · นับเฉพาะ "โปรแกรมปิดวันนั้นแล้ว แต่ยังมี booking"
//   ชิปแดงพร้อมจำนวน แบบเดียวกับชิปอากาศปิดที่มีอยู่แล้ว · และเห็นเสมอ ไม่สนตัวกรองโปรแกรม
//
// ⚠ ชุดข้อมูลทดสอบไม่มีเคสค้างอยู่เลยสักเคส (วัดแล้ว 0 จาก 30 วัน × 6 โปรแกรม)
//   ถ้าปล่อยผ่านก็เท่ากับไม่ได้ตรวจอะไร · เทสนี้จึงสร้างเงื่อนไขขึ้นมาเอง
//   โดยเขียน route.overrides[date]='closed' ซึ่งเป็นช่องเดียวกับที่คนใช้ตอนปรับตารางจริง
//   ไม่ได้ stub ฟังก์ชันที่กำลังทดสอบ · คืนค่าเดิมให้ทุกครั้งหลังวัดเสร็จ
//
// เทสนี้กันสิบอย่าง
//   1  ก่อนปิด · ชิปเป็นชิปปกติ ไม่ใช่ชิปค้าง (ไม่ใช่ขึ้นแดงมั่วตั้งแต่ต้น)
//   2  ปิดวันนั้นแล้ว · ชิปยังอยู่ เป็นชิปค้าง และเลข pax ตรงกับที่นับเองจากใบจอง
//   3  ยอดรวมข้างเลขวันไม่นับคนค้างเข้าไปด้วย
//   4  กรองโปรแกรมอื่นอยู่ · ชิปค้างยังเห็น
//   5  ชิปค้างอยู่บนสุดของเซลล์ · ไม่ถูกยุบเข้า "+N more"
//   6  จัดการใบจองเสร็จแล้วป้ายหายเอง ไม่ต้องกดเคลียร์
//   7  วันปิดที่ไม่มีใครจอง ต้องไม่ขึ้นชิปค้าง
//   8  วันที่ผ่านมาแล้ว ชิปค้างต้องไม่ถูกหรี่จนมองข้าม
//   9  มีคำอธิบายบอกว่าชิปแดงคืออะไร
//   10 ไม่มี error บนหน้า

import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1100 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1400);

/* ══ 0 · หาวัน+โปรแกรมที่มีคนจองและวันนั้นยังเปิดอยู่ ═══════════════════ */
const R0 = await page.evaluate(() => {
  const el = document.querySelector('.nav-item[data-view="booking"]')
          || document.querySelector('.nav-item[data-view^="booking"]');
  if (!el) return { err: 'ไม่มีเมนู Booking ในไซด์บาร์' };
  nav(el);
  if (typeof bkV2Render !== 'function' || typeof bkV2Aggregate !== 'function')
    return { err: 'ไม่มีฟังก์ชันของหน้านี้' };
  const agg = bkV2Aggregate();
  let pick = null;
  Object.keys(agg.byDate).sort().forEach(ds => {
    if (pick) return;
    bkV2Families().forEach(f => {
      if (pick) return;
      const a = bkV2FamilyAggregate(f.id, ds, agg);
      if (a.total > 0 && bkV2IsFamilyOpenOn(f.id, ds)) {
        /* ต้องมี route ที่เปิดอยู่จริง จะได้ปิดมันได้ในข้อถัดไป */
        const rs = bkV2FamilyRoutes(f.id).map(r => r.id);
        pick = { ds, famId: f.id, famName: f.name, pax: a.total, routes: rs };
      }
    });
  });
  if (!pick) return { err: 'ชุดข้อมูลนี้ไม่มีวันไหนที่โปรแกรมเปิดและมีคนจอง · ตรวจไม่ได้' };
  /* คู่ วัน+โปรแกรม ที่ไม่มีใครจองเลย · ใช้ตรวจข้อ 7
     ไม่จำเป็นต้องเป็นโปรแกรมเดียวกับที่ใช้ทดสอบข้างบน · ขอแค่ยอดเป็นศูนย์จริง
     ถ้าหาจากโปรแกรมเดิมอย่างเดียว เดือนที่ขายทุกวันจะหาไม่เจอแล้วข้อนี้จะถูกข้าม */
  const y = +pick.ds.slice(0, 4), m = +pick.ds.slice(5, 7);
  const last = new Date(y, m, 0).getDate();
  let empty = null;
  for (let i = 1; i <= last && !empty; i++) {
    const d = y + '-' + String(m).padStart(2, '0') + '-' + String(i).padStart(2, '0');
    bkV2Families().forEach(f => {
      if (empty) return;
      if (d === pick.ds) return;   /* เลี่ยงวันเดียวกับที่ใช้ทดสอบ · เซลล์นั้นมีชิปค้างของโปรแกรมอื่นอยู่ */
      const a = bkV2FamilyAggregate(f.id, d, agg);
      if (a.total === 0) empty = { ds: d, famId: f.id, famName: f.name,
                                   routes: bkV2FamilyRoutes(f.id).map(r => r.id) };
    });
  }
  /* โปรแกรมอื่นที่มีอยู่ในเดือนนี้ · ใช้ตั้งตัวกรองในข้อ 4 */
  const others = bkV2Families().map(f => f.id).filter(x => x !== pick.famId);
  return { ...pick, empty, others, nFam: bkV2Families().length };
});
if (R0.err) fail(R0.err);
else ok('ใช้วัน ' + R0.ds + ' · โปรแกรม "' + R0.famName + '" · มีคนจอง ' + R0.pax +
        ' คน และวันนั้นยังเปิดอยู่ · คู่วัน+โปรแกรมที่ไม่มีใครจองใช้ ' +
        (R0.empty ? (R0.empty.ds + ' / ' + R0.empty.famName) : '(ไม่มี)'));

if (!R0.err) {
  /* ตั้งเคอร์เซอร์ไปเดือนของวันที่เลือก แล้ววาดปฏิทิน */
  const draw = () => page.evaluate((ds) => {
    _bkV2.tab = 'cal'; _bkV2.view = 'cal'; _bkV2.detailId = null; _bkV2.newBooking = null;
    _bkV2.cursor = new Date(+ds.slice(0, 4), +ds.slice(5, 7) - 1, 1);
    bkV2Render();
  }, R0.ds);

  /* อ่านชิปของเซลล์วันหนึ่ง · อ่านจากจอที่วาดออกมา ไม่ถามฟังก์ชันที่กำลังทดสอบ */
  const readCell = (ds) => page.evaluate((d) => {
    const host = document.getElementById('bkv2-host'); if (!host) return { err: 'ไม่มี bkv2-host' };
    const cells = [].slice.call(host.querySelectorAll('.bkv2-cal-cell:not(.empty)'));
    const dd = +d.slice(8);
    const cell = cells.find(c => {
      const n = c.querySelector('.bkv2-cal-daynum span');
      return n && +((n.textContent || '').trim()) === dd;
    });
    if (!cell) return { err: 'หาเซลล์วันที่ ' + d + ' ไม่เจอ' };
    const chips = [].slice.call(cell.querySelectorAll('.bkv2-cal-chip')).map(ch => ({
      name: (ch.querySelector('.bkv2-cal-chip-name') || {}).textContent || '',
      pax: ((ch.querySelector('.bkv2-cal-chip-pax') || {}).textContent || '').trim(),
      orphan: ch.classList.contains('orphan'),
      title: ch.getAttribute('title') || '',
      op: getComputedStyle(ch).opacity
    }));
    const tot = cell.querySelector('.bkv2-cal-daytot');
    return { chips, dayTot: tot ? +((tot.textContent || '').trim()) : 0,
             more: !!cell.querySelector('.bkv2-cal-more'),
             past: cell.classList.contains('past') };
  }, ds);

  await draw();
  await page.waitForTimeout(300);

  /* ══ 1 · ก่อนปิด · ต้องเป็นชิปปกติ ═══════════════════════════════ */
  const C1 = await readCell(R0.ds);
  if (C1.err) fail(C1.err);
  else if (!C1.chips.length) fail('วัน ' + R0.ds + ' ไม่มีชิปเลยตั้งแต่ยังไม่ปิด · ตรวจต่อไม่ได้');
  else if (C1.chips.some(c => c.orphan))
    fail('วันนั้นยังเปิดอยู่แต่มีชิปขึ้นเป็นชิปค้างแล้ว · ป้ายเตือนที่ขึ้นมั่วจะถูกมองข้ามทั้งหมด');
  else ok('ก่อนปิด · วัน ' + R0.ds + ' มีชิปปกติ ' + C1.chips.length + ' อัน ไม่มีชิปค้าง');

  /* ══ 2 · ปิดวันนั้น · ชิปต้องยังอยู่ และเลขต้องตรงกับใบจองจริง ═════
     ปิดผ่าน route.overrides[date] ซึ่งเป็นช่องเดียวกับที่คนใช้ตอนปรับตาราง
     เลข pax นับเองจาก SB_BOOKINGS ไม่ใช้ bkV2FamilyAggregate
     ไม่งั้นก็แค่เอาผลของโค้ดเดียวกันมาเทียบกับตัวเอง */
  const C2 = await page.evaluate(([ds, famId, routes]) => {
    routes.forEach(rid => {
      const r = ROUTES.find(x => x.id === rid);
      if (r) { r.overrides = r.overrides || {}; r.overrides[ds] = 'closed'; }
    });
    bkV2Render();
    /* นับหัวคนเองจากใบจองดิบ · ไม่เรียก bkV2FamilyAggregate
       กติกาที่ปฏิทินใช้ · ตัดเฉพาะใบที่ยกเลิก/ถูกปฏิเสธ · quote กับ draft ยังนับ
       ช่อง pax มีทั้งแบบเก่า (ad/chd/inf/foc) และแบบแยกสัญชาติ (ad_th/ad_fr...) บวกกันทั้งคู่
       ใบรุ่นเก่า (schemaVer ไม่ใช่ 2) เก็บวันไว้ที่ travelDate + programId คนละที่กัน */
    const dead = ['cancelled', 'rejected', 'cancelled_weather'];
    const head = p => (+p.ad || 0) + (+p.ad_fr || 0) + (+p.ad_th || 0)
                    + (+p.chd || 0) + (+p.chd_fr || 0) + (+p.chd_th || 0)
                    + (+p.inf || 0) + (+p.inf_fr || 0) + (+p.inf_th || 0)
                    + (+p.foc || 0) + (+p.foc_fr || 0) + (+p.foc_th || 0);
    let pax = 0, nBk = 0;
    (SB_BOOKINGS || []).forEach(b => {
      if (dead.indexOf(b.status) >= 0) return;
      if (b.schemaVer === 2 && Array.isArray(b.trips)) {
        b.trips.forEach(t => {
          if (t.date !== ds) return;
          if (routes.indexOf(t.routeId) < 0) return;
          pax += head(t.pax || {}); nBk++;
        });
      } else if (b.travelDate === ds && routes.indexOf(b.programId) >= 0) {
        const p = b.pax || {};
        pax += (+p.adult || 0) + (+p.child || 0) + (+p.infant || 0); nBk++;
      }
    });
    return { pax, nBk, open: bkV2IsFamilyOpenOn(famId, ds) };
  }, [R0.ds, R0.famId, R0.routes]);
  await page.waitForTimeout(250);
  const C2c = await readCell(R0.ds);
  if (C2.open)
    fail('เขียน overrides closed ลงทุก route ของโปรแกรมแล้ว แต่ bkV2IsFamilyOpenOn ยังบอกว่าเปิด · สร้างเงื่อนไขไม่สำเร็จ');
  else if (C2c.err) fail(C2c.err);
  else {
    const orph = C2c.chips.filter(c => c.orphan);
    if (!orph.length)
      fail('ปิดวันนั้นแล้วชิปหายไปทั้งอัน · booking ' + C2.nBk + ' ใบ ' + C2.pax +
           ' คน กลายเป็นของที่ไม่มีใครเห็นบนปฏิทิน นี่คืออาการที่ผู้ใช้เจอ');
    else if (orph.length !== 1)
      fail('ขึ้นชิปค้าง ' + orph.length + ' อันสำหรับโปรแกรมเดียว');
    else if (+orph[0].pax !== C2.pax)
      fail('ชิปค้างขึ้น ' + orph[0].pax + ' คน · นับเองจากใบจองได้ ' + C2.pax +
           ' คน (' + C2.nBk + ' ใบ) · เลขบนป้ายเตือนผิดแปลว่าเชื่อป้ายไม่ได้');
    else if (!/booking|ค้าง/.test(orph[0].title))
      fail('ชิปค้างไม่มีคำอธิบายตอนเอาเมาส์ชี้ · คนเห็นแดงแล้วไม่รู้ว่าต้องทำอะไร');
    else ok('ปิดวันนั้นแล้วชิปยังอยู่ เป็นชิปค้าง · ขึ้น ' + orph[0].pax +
            ' คน ตรงกับที่นับเองจากใบจอง ' + C2.nBk + ' ใบ · มีคำอธิบายบอกว่าต้องจัดการ');
  }

  /* ══ 3 · ยอดรวมข้างเลขวันไม่นับคนค้าง ══════════════════════════════
     เลขหัวเซลล์อ่านว่า "วันนี้มีคนออกกี่คน" · คนที่ค้างคือคนที่ตารางตอนนี้ไม่ได้พาออก
     เอามารวมกันแล้วเลขจะอ่านผิด และคนจัดเรือจะเตรียมที่นั่งเกิน */
  if (!C2c.err) {
    const orphPax = C2c.chips.filter(c => c.orphan).reduce((s, c) => s + (+c.pax || 0), 0);
    const normPax = C2c.chips.filter(c => !c.orphan).reduce((s, c) => s + (+c.pax || 0), 0);
    if (!orphPax) { /* ข้อ 2 fail ไปแล้ว ไม่ต้องรายงานซ้ำ */ }
    else if (C2c.dayTot !== normPax)
      fail('ยอดรวมข้างเลขวันขึ้น ' + C2c.dayTot + ' · ชิปปกติรวมกันได้ ' + normPax +
           ' และคนค้างมี ' + orphPax + ' · ถ้านับคนค้างเข้าไปด้วย คนจัดเรือจะเตรียมที่นั่งเกิน');
    else ok('ยอดรวมข้างเลขวันขึ้น ' + C2c.dayTot + ' นับเฉพาะคนที่ออกจริง · คนค้าง ' +
            orphPax + ' คนอยู่บนชิปของมันเอง ไม่ปนกัน');
  }

  /* ══ 4 · กรองโปรแกรมอื่น · ชิปค้างยังต้องเห็น ═══════════════════════ */
  if (R0.others.length) {
    await page.evaluate((o) => { _bkV2.calFams = [o]; bkV2Render(); }, R0.others[0]);
    await page.waitForTimeout(250);
    const C4 = await readCell(R0.ds);
    const still = C4.err ? [] : C4.chips.filter(c => c.orphan);
    if (C4.err) fail(C4.err);
    else if (!still.length)
      fail('พอกรองไปดูโปรแกรมอื่น ชิปค้างหายไป · ของค้างคือของที่ต้องไปจัดการ ไม่ใช่ของที่เลือกดู');
    else ok('กรองไปดูโปรแกรมอื่นแล้วชิปค้างยังขึ้นอยู่ (' + still[0].pax + ' คน)');
    await page.evaluate(() => { _bkV2.calFams = []; bkV2Render(); });
    await page.waitForTimeout(250);
  }
  else ok('เดือนนี้มีโปรแกรมเดียว · ข้อตัวกรองข้าม');

  /* ══ 5 · ชิปค้างอยู่บนสุด ═════════════════════════════════════════
     ⚠ ถ้าเอาโปรแกรมที่ค้างอยู่ตอนนี้มาวัดเฉย ๆ ข้อนี้จะผ่านโดยไม่ได้ตรวจอะไร
        เพราะมันบังเอิญเป็นโปรแกรมที่คนเยอะที่สุดของวันอยู่แล้ว เรียงตามจำนวนก็ขึ้นบนสุด
        (พิสูจน์แล้วด้วยปุ่มพัง nosortfirst ซึ่งไม่ทำให้แดง)
        ข้อนี้จึงสลับไปปิด "โปรแกรมที่คนน้อยกว่า" แทน แล้ววัดว่ามันยังแซงขึ้นบนสุดไหม */
  const C5 = await (async () => {
    /* คืนวันเดิมก่อน แล้วหาโปรแกรมที่เปิดอยู่ มีคนจอง และคนน้อยกว่าตัวที่มากที่สุดของวัน */
    const pickSmall = await page.evaluate(([ds, routes]) => {
      routes.forEach(rid => { const r = ROUTES.find(x => x.id === rid); if (r && r.overrides) delete r.overrides[ds]; });
      const agg = bkV2Aggregate();
      const rows = bkV2Families()
        .map(f => ({ id: f.id, name: f.name, pax: bkV2FamilyAggregate(f.id, ds, agg).total,
                     open: bkV2IsFamilyOpenOn(f.id, ds), routes: bkV2FamilyRoutes(f.id).map(r => r.id) }))
        .filter(o => o.open && o.pax > 0)
        .sort((a, b) => b.pax - a.pax);
      if (rows.length < 2) { bkV2Render(); return null; }
      const small = rows[rows.length - 1], big = rows[0];
      if (small.pax >= big.pax) { bkV2Render(); return null; }
      small.routes.forEach(rid => {
        const r = ROUTES.find(x => x.id === rid);
        if (r) { r.overrides = r.overrides || {}; r.overrides[ds] = 'closed'; }
      });
      bkV2Render();
      return { small: { id: small.id, name: small.name, pax: small.pax, routes: small.routes },
               big: { name: big.name, pax: big.pax } };
    }, [R0.ds, R0.routes]);
    if (!pickSmall) return { skip: true };
    await page.waitForTimeout(250);
    const cell = await readCell(R0.ds);
    await page.evaluate(([ds, small, routes]) => {
      small.forEach(rid => { const r = ROUTES.find(x => x.id === rid); if (r && r.overrides) delete r.overrides[ds]; });
      routes.forEach(rid => {
        const r = ROUTES.find(x => x.id === rid);
        if (r) { r.overrides = r.overrides || {}; r.overrides[ds] = 'closed'; }
      });
      bkV2Render();
    }, [R0.ds, pickSmall.small.routes, R0.routes]);
    await page.waitForTimeout(250);
    return { ...cell, pick: pickSmall };
  })();
  if (C5.skip)
    fail('วัน ' + R0.ds + ' ไม่มีโปรแกรมเปิดที่คนน้อยกว่าตัวที่มากที่สุด · ' +
         'ตรวจเรื่องลำดับชิปไม่ได้ ถ้าปล่อยผ่านก็เท่ากับไม่ได้ตรวจ');
  else if (C5.err) fail(C5.err);
  else if (!C5.chips.some(c => c.orphan))
    fail('ปิดโปรแกรม "' + C5.pick.small.name + '" แล้วไม่มีชิปค้างขึ้น');
  else if (!C5.chips[0].orphan)
    fail('ชิปค้าง "' + C5.pick.small.name + '" (' + C5.pick.small.pax + ' คน) ไม่ได้อยู่บนสุด · ' +
         'ถูก "' + C5.pick.big.name + '" (' + C5.pick.big.pax + ' คน) แซงเพราะเรียงตามจำนวนอย่างเดียว · ' +
         'วันที่มีหลายโปรแกรมจนชิปล้น ตัวที่ต้องไปจัดการจะถูกยุบเข้า "+N more" แล้วไม่มีใครเห็น');
  else ok('ปิดโปรแกรมที่คนน้อยกว่า ("' + C5.pick.small.name + '" ' + C5.pick.small.pax +
          ' คน เทียบกับ "' + C5.pick.big.name + '" ' + C5.pick.big.pax +
          ' คน) · ชิปค้างยังแซงขึ้นบนสุด ไม่ถูกยุบเข้า "+N more"');

  /* ══ 6 · จัดการเสร็จแล้วป้ายหายเอง ════════════════════════════════
     นี่คือสิ่งที่ผู้ใช้ขอตรง ๆ · "ถ้าจัดการแล้วค่อยหาย"
     ต้องหายเพราะคิดสดจากใบจอง ไม่ใช่เพราะมีใครไปกดเคลียร์ */
  const C6 = await page.evaluate(([ds, routes]) => {
    const keep = [];
    (SB_BOOKINGS || []).forEach(b => {
      (b.trips || []).forEach(t => {
        if (t.date === ds && routes.indexOf(t.routeId) >= 0) { keep.push([b, t.date, b.status]); }
      });
    });
    /* ยกเลิกใบจองของวันนั้น · เหมือนคนจัดการจริง ไม่ได้ไปแตะป้าย */
    keep.forEach(([b]) => { b.__st0 = b.status; b.status = 'cancelled'; });
    bkV2Render();
    return { n: keep.length };
  }, [R0.ds, R0.routes]);
  await page.waitForTimeout(250);
  const C6c = await readCell(R0.ds);
  if (C6c.err) fail(C6c.err);
  else if (C6c.chips.some(c => c.orphan))
    fail('ยกเลิกใบจองของวันนั้นหมดแล้ว (' + C6.n + ' ใบ) แต่ชิปค้างยังอยู่ · ' +
         'ป้ายที่ไม่หายเองจะกลายเป็นป้ายที่ทุกคนเลิกมอง');
  else ok('ยกเลิกใบจอง ' + C6.n + ' ใบของวันนั้นแล้วชิปค้างหายเอง ไม่ต้องกดเคลียร์อะไร');
  /* คืนสถานะใบจองให้เหมือนเดิม */
  await page.evaluate(() => {
    (SB_BOOKINGS || []).forEach(b => { if (b.__st0 != null) { b.status = b.__st0; delete b.__st0; } });
    bkV2Render();
  });
  await page.waitForTimeout(250);

  /* ══ 7 · วันปิดที่ไม่มีใครจอง ต้องไม่ขึ้นชิปค้าง ══════════════════ */
  if (!R0.empty) fail('ชุดข้อมูลนี้ไม่มีคู่ วัน+โปรแกรม ที่ยอดเป็นศูนย์เลย · ข้อนี้ตรวจไม่ได้');
  else {
    const E = R0.empty;
    await page.evaluate(([ds, routes]) => {
      routes.forEach(rid => {
        const r = ROUTES.find(x => x.id === rid);
        if (r) { r.overrides = r.overrides || {}; r.overrides[ds] = 'closed'; }
      });
      bkV2Render();
    }, [E.ds, E.routes]);
    await page.waitForTimeout(250);
    const C7c = await readCell(E.ds);
    if (C7c.err) fail(C7c.err);
    /* ต้องถามเฉพาะชิปของโปรแกรมนั้น · เซลล์เดียวอาจมีชิปค้างของโปรแกรมอื่นอยู่ด้วยได้ */
    else if (C7c.chips.some(c => c.orphan && c.name.indexOf(E.famName) >= 0))
      fail('วัน ' + E.ds + ' โปรแกรม "' + E.famName + '" ปิดและไม่มีใครจอง แต่ขึ้นชิปค้าง · ' +
           'ป้ายจะขึ้นทุกวันปิด แล้วไม่มีใครแยกออกว่าวันไหนต้องไปจัดการจริง');
    else ok('วัน ' + E.ds + ' โปรแกรม "' + E.famName + '" ปิดแต่ไม่มีใครจอง · ไม่ขึ้นชิปค้าง ' +
            'ป้ายขึ้นเฉพาะวันที่มีของต้องจัดการ');
    await page.evaluate(([ds, routes]) => {
      routes.forEach(rid => { const r = ROUTES.find(x => x.id === rid); if (r && r.overrides) delete r.overrides[ds]; });
      bkV2Render();
    }, [E.ds, E.routes]);
    await page.waitForTimeout(200);
  }

  /* ══ 8 · วันที่ผ่านมาแล้ว ชิปค้างต้องไม่ถูกหรี่ ═══════════════════
     หน้านี้หรี่ชิปของวันที่ผ่านมาแล้วเหลือ opacity .5
     วันที่ผ่านไปแล้วแต่ยังค้างคือตัวที่ต้องรีบที่สุด หรี่ไปก็ไม่มีใครเห็น */
  const C8 = await readCell(R0.ds);
  if (C8.err) fail(C8.err);
  else if (!C8.past) ok('วันที่ใช้ทดสอบยังไม่ถึง · ข้อความหรี่ของวันที่ผ่านมาแล้วตรวจไม่ได้กับวันนี้');
  else {
    const o = C8.chips.filter(c => c.orphan)[0];
    if (!o) { /* ข้อ 2 fail ไปแล้ว */ }
    else if (parseFloat(o.op) < 0.95)
      fail('วัน ' + R0.ds + ' ผ่านมาแล้วและชิปค้างถูกหรี่เหลือ opacity ' + o.op +
           ' · วันที่เลยมาแล้วแต่ยังค้างคือตัวที่ต้องรีบที่สุด');
    else ok('วัน ' + R0.ds + ' ผ่านมาแล้ว · ชิปค้างไม่ถูกหรี่ (opacity ' + o.op + ')');
  }

  /* ══ 9 · คำอธิบายใต้ปฏิทิน ════════════════════════════════════════ */
  const C9 = await page.evaluate(() => {
    const host = document.getElementById('bkv2-host');
    const f = host ? host.querySelector('.bkv2-foot-hints') : null;
    return { has: !!f, txt: f ? (f.textContent || '').trim().slice(0, 120) : '' };
  });
  if (!C9.has) fail('ไม่มีแถบคำอธิบายใต้ปฏิทิน');
  else if (!/ค้าง/.test(C9.txt))
    fail('แถบคำอธิบายไม่ได้บอกว่าชิปแดงคืออะไร · คนเปิดหน้ามาครั้งแรกเดาเอง · "' + C9.txt + '"');
  else ok('ใต้ปฏิทินมีคำอธิบายว่าชิปแดงคืออะไร');

  /* คืน overrides ของวันที่ทดสอบ */
  await page.evaluate(([ds, routes]) => {
    routes.forEach(rid => { const r = ROUTES.find(x => x.id === rid); if (r && r.overrides) delete r.overrides[ds]; });
    bkV2Render();
  }, [R0.ds, R0.routes]);
  await page.waitForTimeout(200);
}

/* ══ 10 · ไม่มี error บนหน้า ══════════════════════════════════════════ */
if (errors.length) fail('มี error ' + errors.length + ' ครั้ง · ' + errors.slice(0, 2).join(' | '));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
