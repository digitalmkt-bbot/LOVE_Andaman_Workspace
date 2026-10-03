// §pkOv · หน้าตั๋วอุทยาน · ภาพรวมทั้งเดือน
//
// ที่มา (2026-09-28) · ผู้ใช้ขอเอง · "เพิ่มหน้า Overview เพื่อให้เห็นภาพรวมของทั้งเดือน
// เรียงวัน แยกเรือ จำนวน ลค ที่เดินทาง / จำนวน ลค ที่ทำตั๋ว"
// ถามกลับว่า "ทำตั๋ว" หมายถึงตัวไหน · ผู้ใช้ตอบ "เอาทั้งสองตัว"
//
// รอบสอง (2026-09-28) · ผู้ใช้ขอเพิ่ม
//   "ภาพรวมรายเดือน ควรอยู่แถวเดียวกันกับโปรแกรม"
//   "ภาพรวม ควรทำเป็นตารางแบบ Sheet · จำนวน ควรระบุแบ่ง ไทย / ต่างชาติ แยก AD CHD INF FOC
//    และคอลัมน์ของที่ออกตั๋ว ไทย / ต่างชาติ แยก AD CHD INF FOC เหมือนกัน
//    และรวมเปรียบเทียบว่า ลำนี้ ซื้อขาดหรือซื้อเกิน"
// ตารางจึงกลายเป็น 19 คอลัมน์ · วัน | เส้นทาง | เรือ | เดินทาง·ไทย 4 | เดินทาง·ต่างชาติ 4
//   | รวมเดินทาง | ออกตั๋ว (ตามประเภทของด่าน) | รวมตั๋ว | ขาด/เกิน
//
// ⚠ หน้าตั๋วอุทยานเขียนได้แค่ PIER_CFG.parkTypes / parkFix / parkName (ดู CLAUDE.md)
//   หน้าภาพรวมอ่านอย่างเดียวล้วน · เทสข้อ 8 วัดว่าเปิดแล้วข้อมูลไม่ขยับ
//
// เทสนี้กันสิบเอ็ดอย่าง
//   1  ปุ่มเข้าหน้าภาพรวมอยู่แถวเดียวกับชิปโปรแกรม และกดแล้วเปลี่ยนหน้าจริง
//   2  แถววันครบทุกวันของเดือน · แถวเรือครบตามที่นับเองจาก poBoats
//   2b วันที่ไม่มีเรือยังต้องมีแถว ไม่ถูกข้าม
//   3  "รวมตั๋ว" ของแต่ละลำตรงกับจำนวนแถวในชีทจริงของลำนั้น
//     (เปิดหน้ารายวันแล้วนับแถวที่พิมพ์ออกมา ไม่เชื่อเลขที่หน้าภาพรวมคำนวณเอง)
//   3b ช่องตั๋วที่ "ควรออก" ตรงกับที่แมปมาจากหัวคนที่เดินทาง 8 ช่อง
//      (FOC ต้องได้ตั๋วผู้ใหญ่ · เด็กต่ำกว่า 3 ไม่แยกสัญชาติ) และรวมเดินทาง = ผลบวก 8 ช่อง
//   4  แถวรวมเดือน = ผลบวกของแถววันทุกวัน ครบทุกคอลัมน์
//   4b แถววัน = ผลบวกของแถวเรือในวันนั้น ครบทุกคอลัมน์ · และช่องขาด/เกิน = รวมตั๋ว − รวมเดินทาง
//   5  เลื่อนเดือนแล้วเดือนเปลี่ยนจริง ไม่ใช่ปุ่มหลอก
//   6  กดแถววันแล้วกลับไปชีทของวันนั้น
//   7  หัวตารางสองชั้นตรึงใต้แถบ ไม่ทับแถววันแรก
//   8  เปิดหน้าภาพรวมแล้วข้อมูลจริงไม่ขยับ

import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1200 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1200);

/* ลำดับช่อง "เดินทาง" ในตาราง · ต้องตรงกับ GO ใน pkOvBody */
const GOK = ['ad_th', 'chd_th', 'inf_th', 'foc_th', 'ad_fr', 'chd_fr', 'inf_fr', 'foc_fr'];

/* ══ 0 · หาท่า/เดือนที่มีข้อมูล ═══════════════════════════════════════ */
const R0 = await page.evaluate(() => {
  const el = document.querySelector('.nav-item[data-view^="pok-"]');
  if (!el) return { err: 'ไม่มีเมนูตั๋วอุทยานในไซด์บาร์' };
  nav(el);
  if (typeof poBoats !== 'function' || typeof pkSetView !== 'function') return { err: 'ไม่มีฟังก์ชันของหน้านี้' };
  const days = [...new Set((SB_BOOKINGS || []).flatMap(b => (b.trips || []).map(t => t.date)).filter(Boolean))].sort();
  const piers = (typeof PO_PIERS !== 'undefined') ? PO_PIERS.map(p => p.k) : [];
  /* เดือน×ท่า ที่มีเรือมากที่สุด · คิดเองจาก poBoats ไม่ถามหน้าภาพรวม */
  const agg = {};
  days.forEach(d => piers.forEach(pier => {
    let B = []; try { B = poBoats(d, pier) || []; } catch (_) { return; }
    if (!B.length) return;
    const k = pier + '|' + d.slice(0, 7);
    (agg[k] = agg[k] || { pier, mon: d.slice(0, 7), boats: 0, days: new Set() });
    agg[k].boats += B.length; agg[k].days.add(d);
  }));
  const best = Object.values(agg).sort((a, b) => b.boats - a.boats)[0];
  if (!best) return { err: 'ชุดข้อมูลนี้ไม่มีเรือออกเลยสักท่า · ตรวจหน้าภาพรวมไม่ได้' };
  /* จำนวนวันในเดือน + จำนวนลำทั้งเดือน · คิดเองจาก poBoats */
  const y = +best.mon.slice(0, 4), mo = +best.mon.slice(5, 7);
  const last = new Date(y, mo, 0).getDate();
  let nBoat = 0, nDayWith = 0, sample = null;
  for (let i = 1; i <= last; i++) {
    const ds = best.mon + '-' + String(i).padStart(2, '0');
    let B = []; try { B = poBoats(ds, best.pier) || []; } catch (_) { B = []; }
    nBoat += B.length;
    if (B.length) { nDayWith++; if (!sample || B.length > sample.n) sample = { ds, n: B.length }; }
  }
  /* เดือนที่ "มีทั้งวันที่มีเรือและวันที่ไม่มีเรือ" · ใช้ตรวจว่าวันว่างไม่ถูกข้าม
     เดือนที่เลือกไว้ข้างบนอาจมีเรือครบทุกวัน ซึ่งพิสูจน์เรื่องนี้ไม่ได้ */
  let gapMon = null;
  [...new Set(days.map(d => d.slice(0, 7)))].forEach(m => {
    if (gapMon) return;
    const yy = +m.slice(0, 4), mm = +m.slice(5, 7), lastD = new Date(yy, mm, 0).getDate();
    let have = 0;
    for (let i = 1; i <= lastD; i++) {
      let B = []; try { B = poBoats(m + '-' + String(i).padStart(2, '0'), best.pier) || []; } catch (_) { B = []; }
      if (B.length) have++;
    }
    if (have > 0 && have < lastD) gapMon = { mon: m, last: lastD, have };
  });
  /* ชุดประเภทตั๋วของด่าน · ใช้ทั้งนับคอลัมน์และตรวจการแมป FOC/INF ในข้อ 3b */
  const ty = pkTypes().map(T => ({ k: T.k, s: T.s || T.n, ch: (T.ch || []).slice() }));
  return { pier: best.pier, mon: best.mon, last, nBoat, nDayWith, sample, gapMon, ty };
});
if (R0.err) fail(R0.err);
else ok('ใช้ท่า ' + R0.pier + ' เดือน ' + R0.mon + ' · คิดเองได้ ' + R0.last + ' วัน · มีเรือ ' +
        R0.nDayWith + ' วัน · รวม ' + R0.nBoat + ' ลำ · ประเภทตั๋ว ' + R0.ty.length + ' ช่อง');

if (!R0.err) {
  const nTy = R0.ty.length;
  /* ตำแหน่งคอลัมน์ · แถวเรือมีช่องเรือด้วยจึงเริ่มที่ 3 · แถววัน/แถวรวมรวบเส้นทาง+เรือเป็น colspan 2 จึงเริ่มที่ 2 */
  const IX = off => ({ go: off, goT: off + 8, ty: off + 9, tyT: off + 9 + nTy, df: off + 10 + nTy,
                       n: off + 11 + nTy });

  const openOv = () => page.evaluate(([p, m]) => {
    renderPierPark(p);
    pkSetDate(m + '-01');
    _pkMon = m;
    pkSetView('ov');
  }, [R0.pier, R0.mon]);

  /* ══ 1 · ปุ่มเข้าหน้าภาพรวมอยู่แถวเดียวกับชิปโปรแกรม ════════════════
     ผู้ใช้ขอเองว่า "ภาพรวมรายเดือน ควรอยู่แถวเดียวกันกับโปรแกรม"
     เพราะมันคือการสลับมุมมองของข้อมูลชุดเดียวกัน ไม่ใช่การเปลี่ยนหน้าแบบแถบบน */
  const R1 = await page.evaluate((p) => {
    renderPierPark(p);
    _pkView = 'day'; renderPierPark();
    const h = document.querySelector('[id^="pk-host-"]');
    const btn = h.querySelector('.pk-rts .pk-ovbn');
    if (!btn) return { err: 'ไม่มีปุ่มภาพรวมเดือนบนแถวชิปโปรแกรม' };
    const onBar = !!([].slice.call(h.querySelectorAll('.po-bar button'))
      .find(b => /ภาพรวมเดือน/.test(b.textContent || '')));
    const chips = [].slice.call(h.querySelectorAll('.pk-rts .pk-rt'));
    const beforeOv = !!h.querySelector('.pk-ov');
    btn.click();
    const h2 = document.querySelector('[id^="pk-host-"]');
    const back = h2.querySelector('.pk-rts .pk-ovbn');
    return { onBar, beforeOv, nChip: chips.length, last: chips[chips.length - 1] === btn,
             afterOv: !!h2.querySelector('.pk-ov'),
             daySheet: !!h2.querySelector('.pk-sheet'),
             backTxt: back ? (back.textContent || '').trim() : null,
             backOn: !!(back && back.classList.contains('on')) };
  }, R0.pier);
  if (R1.err) fail(R1.err);
  else if (R1.onBar) fail('ปุ่มภาพรวมเดือนยังอยู่บนแถบบน · ผู้ใช้ขอให้อยู่แถวเดียวกับชิปโปรแกรม');
  else if (!R1.last) fail('ปุ่มภาพรวมเดือนอยู่บนแถวชิปแต่ไม่ได้อยู่ท้ายแถว · ไปแทรกกลางชิปโปรแกรม');
  else if (R1.beforeOv) fail('ยังไม่กดปุ่มแต่หน้าภาพรวมขึ้นมาแล้ว');
  else if (!R1.afterOv) fail('กดปุ่มภาพรวมเดือนแล้วตารางภาพรวมไม่ขึ้น');
  else if (R1.daySheet) fail('เข้าหน้าภาพรวมแล้วชีทรายวันยังค้างอยู่ · สองหน้าซ้อนกัน');
  else if (!R1.backTxt || !/ชีทรายวัน/.test(R1.backTxt))
    fail('อยู่หน้าภาพรวมแล้วไม่มีปุ่มกลับชีทรายวันในตำแหน่งเดิม · ได้ "' + R1.backTxt + '"');
  else if (!R1.backOn) fail('อยู่หน้าภาพรวมแล้วปุ่มไม่ติดไฟ · จอไม่บอกว่าอยู่หน้าไหน');
  else ok('ปุ่มภาพรวมเดือนอยู่ท้ายแถวชิป (' + R1.nChip + ' ชิป) กดแล้วเปลี่ยนหน้าจริง · ' +
          'ชีทรายวันหายไป และที่เดิมกลายเป็นปุ่ม "' + R1.backTxt + '" ที่ติดไฟ');

  /* ══ 2 · แถวครบ ══════════════════════════════════════════════════ */
  await openOv();
  await page.waitForTimeout(300);
  const R2 = await page.evaluate(() => {
    const h = document.querySelector('[id^="pk-host-"]');
    return { day: h.querySelectorAll('tr.pk-ovd').length,
             empty: h.querySelectorAll('tr.pk-ovd.empty').length,
             boat: h.querySelectorAll('tr.pk-ovbt').length,
             mon: (h.querySelector('.pk-mon') || {}).textContent };
  });
  if (R2.mon !== R0.mon) fail('แถบบนขึ้นเดือน "' + R2.mon + '" · ควรเป็น ' + R0.mon);
  else if (R2.day !== R0.last)
    fail('แถววันมี ' + R2.day + ' แถว · เดือนนี้มี ' + R0.last + ' วัน · วันที่หายไปคือวันที่ไม่มีใครเห็น');
  else if (R2.day - R2.empty !== R0.nDayWith)
    fail('วันที่มีเรือ ' + (R2.day - R2.empty) + ' วัน · คิดเองได้ ' + R0.nDayWith);
  else if (R2.boat !== R0.nBoat)
    fail('แถวเรือมี ' + R2.boat + ' แถว · คิดเองจาก poBoats ได้ ' + R0.nBoat + ' ลำ');
  else ok('แถวครบ · ' + R2.day + ' วัน (มีเรือ ' + (R2.day - R2.empty) + ') · ' + R2.boat +
          ' ลำ ตรงกับที่คิดเอง');

  /* ══ 2b · เดือนที่มีวันไม่มีเรือ · วันว่างต้องยังอยู่ในปฏิทิน ═══════
     ปฏิทินที่ข้ามวันว่างจะอ่านเหมือนเดือนนั้นมีแค่ยี่สิบกว่าวัน
     คนดูจะไม่รู้ว่าวันที่หายไปคือ "ไม่มีเรือ" หรือ "ลืมลงข้อมูล" */
  if (!R0.gapMon) {
    /* ชุดข้อมูลนี้ทุกเดือนมีเรือครบทุกวัน · ถ้าปล่อยผ่านก็เท่ากับไม่ได้ตรวจอะไร
       จึงยืม poBoats มาทำให้วันหนึ่งว่างชั่วคราว แล้วคืนตัวเดิมให้
       ไม่แตะข้อมูลจริงสักตัว · แค่ทำให้เงื่อนไขที่ต้องการทดสอบเกิดขึ้นจริง */
    const R2b = await page.evaluate((m) => {
      const orig = window.poBoats;
      const gapDay = m + '-02';
      window.poBoats = function (d, pier) { return (d === gapDay) ? [] : orig.apply(this, arguments); };
      _pkMon = m; pkSetView('ov');
      const h = document.querySelector('[id^="pk-host-"]');
      const r = { day: h.querySelectorAll('tr.pk-ovd').length,
                  empty: h.querySelectorAll('tr.pk-ovd.empty').length,
                  emptyDay: +(((h.querySelector('tr.pk-ovd.empty td.dt b') || {}).textContent) || 0) };
      window.poBoats = orig;
      pkSetView('ov');
      return r;
    }, R0.mon);
    if (R2b.day !== R0.last)
      fail('ทำให้วันที่ 2 ว่างแล้วปฏิทินเหลือ ' + R2b.day + ' แถว · ควรยังครบ ' + R0.last +
           ' วัน · วันที่ไม่มีเรือถูกข้ามไป คนดูจะไม่รู้ว่าวันนั้นหายไปไหน');
    else if (R2b.empty !== 1 || R2b.emptyDay !== 2)
      fail('ทำให้วันที่ 2 ว่างแล้วควรมีแถววันว่าง 1 แถวที่วันที่ 2 · ได้ ' + R2b.empty +
           ' แถว (วันที่ ' + R2b.emptyDay + ')');
    else ok('ยืม poBoats ทำให้วันที่ 2 ไม่มีเรือ · ปฏิทินยังครบ ' + R2b.day +
            ' วัน และขึ้นแถว "ไม่มีเรือออก" ที่วันนั้น ไม่ข้ามวันว่าง');
    await page.waitForTimeout(200);
  }
  else {
    const R2b = await page.evaluate((g) => {
      _pkMon = g.mon; pkSetView('ov');
      const h = document.querySelector('[id^="pk-host-"]');
      return { day: h.querySelectorAll('tr.pk-ovd').length,
               empty: h.querySelectorAll('tr.pk-ovd.empty').length };
    }, R0.gapMon);
    const wantEmpty = R0.gapMon.last - R0.gapMon.have;
    if (R2b.day !== R0.gapMon.last)
      fail('เดือน ' + R0.gapMon.mon + ' มี ' + R0.gapMon.last + ' วัน แต่ปฏิทินขึ้น ' + R2b.day +
           ' แถว · วันที่ไม่มีเรือถูกข้ามไป คนดูจะไม่รู้ว่าวันนั้นหายไปไหน');
    else if (R2b.empty !== wantEmpty)
      fail('เดือน ' + R0.gapMon.mon + ' ควรมีวันว่าง ' + wantEmpty + ' วัน · ขึ้น ' + R2b.empty);
    else ok('เดือน ' + R0.gapMon.mon + ' ที่มีวันไม่มีเรือ ' + wantEmpty + ' วัน · ปฏิทินยังครบ ' +
            R2b.day + ' วัน ไม่ข้ามวันว่าง');
    await page.evaluate((m) => { _pkMon = m; pkSetView('ov'); }, R0.mon);
    await page.waitForTimeout(200);
  }

  /* ══ 3 · "รวมตั๋ว" ต่อลำ = แถวในชีทจริง ═══════════════════════════ */
  const R3 = await page.evaluate(async ([ds, ix]) => {
    /* อ่านตัวเลขจากหน้าภาพรวมก่อน */
    const h = document.querySelector('[id^="pk-host-"]');
    const dayNo = +ds.slice(8);
    const trs = [].slice.call(h.querySelectorAll('.pk-ov tbody tr'));
    let i = trs.findIndex(t => t.classList.contains('pk-ovd') &&
      +((t.querySelector('td.dt b') || {}).textContent || 0) === dayNo);
    if (i < 0) return { err: 'หาแถววัน ' + ds + ' ในภาพรวมไม่เจอ' };
    const num = t => { const v = String(t || '').replace(/[^0-9]/g, ''); return v ? +v : 0; };
    const ovBoats = [];
    for (let k = i + 1; k < trs.length && trs[k].classList.contains('pk-ovbt'); k++) {
      const td = trs[k].querySelectorAll('td');
      if (td.length !== ix.n) return { err: 'แถวเรือมี ' + td.length + ' ช่อง · ควรมี ' + ix.n };
      ovBoats.push({ boat: (td[2].textContent || '').trim(),
                     go: num(td[ix.goT].textContent), tk: num(td[ix.tyT].textContent) });
    }
    /* แล้วเปิดหน้ารายวันของวันเดียวกัน นับแถวที่พิมพ์ลงชีทจริง
       ⚠ วันหนึ่งมีหลายบล็อกเส้นทาง แต่ละบล็อกกางชีทของตัวเองพร้อมกัน
       ต้องนับเฉพาะในบล็อกที่กดแท็บ ไม่ใช่ทั้งหน้า ไม่งั้นได้ผลรวมของทุกเส้น */
    pkSetView('day'); _pkRoute = ''; pkSetDate(ds);
    await new Promise(r => setTimeout(r, 250));
    const blocks = () => document.querySelectorAll('[id^="pk-host-"] .pk-trip');
    const sheet = [];
    const nb = blocks().length;
    for (let bi = 0; bi < nb; bi++) {
      const nt = blocks()[bi].querySelectorAll('.pk-tab').length;
      for (let k = 0; k < nt; k++) {
        blocks()[bi].querySelectorAll('.pk-tab')[k].click();
        await new Promise(r => setTimeout(r, 120));
        const blk = blocks()[bi];
        const nm = ((blk.querySelector('.pk-bhd .bn') || {}).textContent || '').trim();
        const tm = ((blk.querySelector('.pk-bhd .tm') || {}).textContent || '').match(/\d{1,2}[:.]\d{2}/);
        sheet.push({ key: nm + (tm ? tm[0] : ''),
                     rows: blk.querySelectorAll('.pk-sheet tbody tr:not(.pk-ovr)').length });
      }
    }
    return { ovBoats, sheet };
  }, [R0.sample.ds, IX(3)]);
  if (R3.err) fail(R3.err);
  else if (!R3.ovBoats.length) fail('วัน ' + R0.sample.ds + ' ไม่มีแถวเรือในภาพรวม · ตรวจข้อนี้ไม่ได้');
  else {
    /* จับคู่ด้วย ชื่อเรือ+เวลาออก · เรือลำเดียวกันวิ่งสองเส้นในวันเดียวได้ */
    const norm = t => String(t || '').replace(/\s+/g, '');
    const off = [];
    R3.ovBoats.forEach(o => {
      const s = R3.sheet.filter(x => norm(x.key) === norm(o.boat));
      const rows = s.reduce((a, x) => a + x.rows, 0);
      if (!s.length) off.push(o.boat + ' หาชีทไม่เจอ (ชีทมี ' + R3.sheet.map(x => x.key).join(', ') + ')');
      else if (rows !== o.tk) off.push(o.boat + ' ภาพรวม ' + o.tk + ' แต่ชีท ' + rows + ' แถว');
    });
    if (off.length)
      fail('ตัวเลข "รวมตั๋ว" ไม่ตรงกับชีทจริงของวัน ' + R0.sample.ds + ' · ' + off.join(' · '));
    else ok('วัน ' + R0.sample.ds + ' · "รวมตั๋ว" ของทุกลำตรงกับแถวในชีทจริง (' +
            R3.ovBoats.map(o => o.boat + ' ' + o.tk).join(' · ') + ')');
  }

  /* ══ 3b · หัวคนที่เดินทาง → ตั๋วที่ควรออก ════════════════════════
     ผู้ใช้ขอแยก ไทย/ต่างชาติ × AD CHD INF FOC ทั้งสองฝั่ง แล้วบอกว่าซื้อขาดหรือเกิน
     กติกาด่านคือ FOC ใช้ตั๋วผู้ใหญ่ตามสัญชาติ และเด็กต่ำกว่า 3 ใช้รหัสเดียวไม่แยกสัญชาติ
     ข้อนี้เอาเลข 8 ช่องที่วาดออกมาจริง มาแมปเองตาม PK_BASE.ch แล้วเทียบกับ
     "ควรออก" ที่หน้านี้ใช้เป็นตัวตั้ง (อ่านจาก title ของช่องที่ไม่ตรง หรือจากตัวเลขในช่องที่ตรง)
     ถ้าแมปผิด ตัวเลขซื้อขาด/ซื้อเกินทั้งหน้าก็ผิดตาม */
  await openOv();
  await page.waitForTimeout(300);
  const R3b = await page.evaluate(([ix, GOK, TY]) => {
    const h = document.querySelector('[id^="pk-host-"]');
    const num = t => { const v = String(t || '').replace(/[^0-9]/g, ''); return v ? +v : 0; };
    const rows = [].slice.call(h.querySelectorAll('tr.pk-ovbt'));
    if (!rows.length) return { err: 'ไม่มีแถวเรือ' };
    let nFoc = 0, nInf = 0, nOff = 0, nSum = 0;
    const bad = [];
    rows.forEach(tr => {
      const td = tr.querySelectorAll('td');
      const go = {}; GOK.forEach((k, i) => { go[k] = num(td[ix.go + i].textContent); });
      if (go.foc_th || go.foc_fr) nFoc++;
      if (go.inf_th && go.inf_fr) nInf++;
      const name = (td[2].textContent || '').trim();
      /* รวมเดินทาง ต้องเป็นผลบวกของ 8 ช่อง · ไม่ใช่เลขอื่นที่บังเอิญใกล้กัน */
      const s8 = GOK.reduce((a, k) => a + go[k], 0);
      const shown = num(td[ix.goT].textContent);
      if (s8 !== shown) { bad.push(name + ' รวมเดินทาง ' + shown + ' แต่ 8 ช่องบวกได้ ' + s8); return; }
      nSum++;
      TY.forEach((T, i) => {
        const cell = td[ix.ty + i];
        const want = (T.ch || []).reduce((a, k) => a + (go[k] || 0), 0);
        let need;
        if (cell.classList.contains('off')) {
          const m = String(cell.getAttribute('title') || '').match(/ควรออก\s*(\d+)/);
          if (!m) { bad.push(name + ' ' + T.s + ' ช่องไม่ตรงแต่ไม่บอกว่าควรออกเท่าไร'); return; }
          need = +m[1]; nOff++;
        } else need = num(cell.textContent);
        if (need !== want)
          bad.push(name + ' ' + T.s + ' ควรออก ' + need + ' แต่แมปจากหัวคนได้ ' + want +
                   ' (' + (T.ch || []).map(k => k + '=' + go[k]).join('+') + ')');
      });
    });
    return { n: rows.length, nFoc, nInf, nOff, nSum, bad: bad.slice(0, 4), nBad: bad.length };
  }, [IX(3), GOK, R0.ty]);
  if (R3b.err) fail(R3b.err);
  else if (R3b.nBad)
    fail('ตั๋วที่ควรออกไม่ตรงกับหัวคนที่เดินทาง ' + R3b.nBad + ' จุด · ' + R3b.bad.join(' · '));
  else if (!R3b.nFoc)
    fail('เดือนนี้ไม่มีลำไหนมี FOC · พิสูจน์กติกา "FOC ได้ตั๋วผู้ใหญ่" ไม่ได้');
  else if (!R3b.nOff)
    fail('ไม่มีช่องไหนที่ชีทกับตัวตั้งต่างกันเลย · ทางที่อ่าน "ควรออก" จาก title ไม่ถูกเดิน');
  else ok('ทุกแถวเรือ (' + R3b.n + ') ตั๋วที่ควรออกตรงกับที่แมปเองจากหัวคน 8 ช่อง · ' +
          'มี FOC ' + R3b.nFoc + ' ลำ · ลำที่มี INF ทั้งสองสัญชาติ ' + R3b.nInf + ' ลำ · ' +
          'ช่องที่ชีทไม่ตรงตัวตั้ง ' + R3b.nOff + ' ช่อง');

  /* ══ 4 · แถวรวมเดือน = ผลบวกของแถววัน ครบทุกคอลัมน์ ══════════════ */
  const R4 = await page.evaluate(([ixd, nTy]) => {
    const h = document.querySelector('[id^="pk-host-"]');
    const num = t => { const v = String(t || '').replace(/[^0-9]/g, ''); return v ? +v : 0; };
    const NC = 8 + 1 + nTy + 1;              /* ช่องตัวเลขทั้งหมด ไม่รวมขาด/เกิน */
    const sum = new Array(NC).fill(0);
    [].slice.call(h.querySelectorAll('tr.pk-ovd:not(.empty)')).forEach(tr => {
      const td = tr.querySelectorAll('td');
      for (let i = 0; i < NC; i++) sum[i] += num(td[ixd.go + i].textContent);
    });
    const f = h.querySelectorAll('.pk-ov tfoot td');
    const foot = [];
    for (let i = 0; i < NC; i++) foot.push(num(f[ixd.go + i].textContent));
    return { sum, foot, nFoot: f.length, df: (f[ixd.df].textContent || '').trim() };
  }, [IX(2), nTy]);
  {
    const diff = R4.sum.map((v, i) => (v === R4.foot[i]) ? null : (i + ':' + v + '≠' + R4.foot[i]))
      .filter(Boolean);
    if (R4.nFoot !== IX(2).n) fail('แถวรวมเดือนมี ' + R4.nFoot + ' ช่อง · ควรมี ' + IX(2).n);
    else if (diff.length)
      fail('แถวรวมเดือนไม่เท่ากับผลบวกของแถววัน ' + diff.length + ' คอลัมน์ · ' + diff.slice(0, 5).join(' · '));
    else if (!R4.foot[8]) fail('ยอดรวมเดินทางทั้งเดือนเป็นศูนย์ · ตรวจข้อนี้ไม่ได้');
    else ok('แถวรวมเดือนเท่ากับผลบวกของแถววันครบทั้ง ' + R4.sum.length + ' คอลัมน์ · ' +
            'รวมเดินทาง ' + R4.foot[8] + ' · รวมตั๋ว ' + R4.foot[R4.foot.length - 1] +
            ' · ขาด/เกิน ' + R4.df);
  }

  /* ══ 4b · แถววัน = ผลบวกของแถวเรือ · และช่องขาด/เกินคิดถูกทาง ════
     ผู้ใช้ขอ "รวมเปรียบเทียบว่า ลำนี้ ซื้อขาดหรือซื้อเกิน"
     เครื่องหมายกลับข้างเมื่อไร คนอ่านจะไปซื้อตั๋วเพิ่มทั้งที่ซื้อเกินอยู่แล้ว */
  const R4b = await page.evaluate(([ixd, ixb, nTy]) => {
    const h = document.querySelector('[id^="pk-host-"]');
    const num = t => { const v = String(t || '').replace(/[^0-9]/g, ''); return v ? +v : 0; };
    const NC = 8 + 1 + nTy + 1;
    const dnum = t => {
      const s = String(t || '').trim();
      if (s === '—' || !s) return 0;
      return (s.charAt(0) === '−' || s.charAt(0) === '-') ? -num(s) : num(s);
    };
    const trs = [].slice.call(h.querySelectorAll('.pk-ov tbody tr'));
    const bad = [], badDf = [];
    let nDay = 0, nSign = 0;
    const chkDf = (td, ix, who) => {
      const go = num(td[ix.goT].textContent), tk = num(td[ix.tyT].textContent);
      const d = dnum(td[ix.df].textContent);
      if (d !== tk - go) badDf.push(who + ' ขาด/เกินขึ้น ' + (td[ix.df].textContent || '').trim() +
        ' · รวมตั๋ว ' + tk + ' − รวมเดินทาง ' + go + ' = ' + (tk - go));
      else if (d) nSign++;
    };
    for (let i = 0; i < trs.length; i++) {
      if (!trs[i].classList.contains('pk-ovd') || trs[i].classList.contains('empty')) continue;
      const dtd = trs[i].querySelectorAll('td');
      const day = ((dtd[0].querySelector('b') || {}).textContent || '?');
      const acc = new Array(NC).fill(0);
      let nb = 0;
      for (let k = i + 1; k < trs.length && trs[k].classList.contains('pk-ovbt'); k++) {
        const btd = trs[k].querySelectorAll('td');
        for (let c = 0; c < NC; c++) acc[c] += num(btd[ixb.go + c].textContent);
        chkDf(btd, ixb, 'วันที่ ' + day + ' ' + (btd[2].textContent || '').trim());
        nb++;
      }
      if (!nb) { bad.push('วันที่ ' + day + ' มีแถววันแต่ไม่มีแถวเรือ'); continue; }
      for (let c = 0; c < NC; c++) if (acc[c] !== num(dtd[ixd.go + c].textContent))
        bad.push('วันที่ ' + day + ' คอลัมน์ ' + c + ' แถววัน ' + num(dtd[ixd.go + c].textContent) +
                 ' · เรือบวกได้ ' + acc[c]);
      chkDf(dtd, ixd, 'วันที่ ' + day + ' (แถววัน)');
      nDay++;
    }
    return { nDay, nSign, bad: bad.slice(0, 4), nBad: bad.length,
             badDf: badDf.slice(0, 4), nBadDf: badDf.length };
  }, [IX(2), IX(3), nTy]);
  if (R4b.nBad)
    fail('แถววันไม่เท่ากับผลบวกของแถวเรือ ' + R4b.nBad + ' จุด · ' + R4b.bad.join(' · '));
  else if (R4b.nBadDf)
    fail('ช่องขาด/เกินคิดผิด ' + R4b.nBadDf + ' จุด · ' + R4b.badDf.join(' · '));
  else if (!R4b.nSign)
    fail('ทั้งเดือนไม่มีลำไหนขาดหรือเกินเลย · ช่องขาด/เกินไม่ถูกเดินจริง ตรวจไม่ได้');
  else ok('แถววันทุกวัน (' + R4b.nDay + ') เท่ากับผลบวกของแถวเรือครบทุกคอลัมน์ · ' +
          'ช่องขาด/เกิน = รวมตั๋ว − รวมเดินทาง ทุกแถว (ไม่เป็นศูนย์ ' + R4b.nSign + ' แถว)');

  /* ══ 5 · เลื่อนเดือนได้จริง ══════════════════════════════════════ */
  const R5 = await page.evaluate(() => {
    const h = () => document.querySelector('[id^="pk-host-"]');
    const m0 = (h().querySelector('.pk-mon') || {}).textContent;
    pkMonShift(-1);
    const m1 = (h().querySelector('.pk-mon') || {}).textContent;
    const d1 = h().querySelectorAll('tr.pk-ovd').length;
    pkMonShift(1);
    const m2 = (h().querySelector('.pk-mon') || {}).textContent;
    return { m0, m1, m2, d1 };
  });
  if (R5.m1 === R5.m0) fail('กดเดือนก่อนหน้าแล้วเดือนไม่เปลี่ยน · ยังเป็น ' + R5.m0);
  else if (!R5.d1) fail('เดือน ' + R5.m1 + ' ไม่มีแถววันเลย · ปฏิทินเดือนนั้นหายทั้งเดือน');
  else if (R5.m2 !== R5.m0) fail('กดกลับแล้วไม่กลับมาเดือนเดิม · ' + R5.m0 + ' → ' + R5.m1 + ' → ' + R5.m2);
  else ok('เลื่อนเดือนได้จริง ' + R5.m0 + ' → ' + R5.m1 + ' (' + R5.d1 + ' วัน) → กลับมา ' + R5.m2);

  /* ══ 6 · กดแถววันแล้วกลับไปชีทของวันนั้น ═════════════════════════ */
  const R6 = await page.evaluate((ds) => {
    const h = () => document.querySelector('[id^="pk-host-"]');
    const dayNo = +ds.slice(8);
    const tr = [].slice.call(h().querySelectorAll('tr.pk-ovd')).find(t =>
      +((t.querySelector('td.dt b') || {}).textContent || 0) === dayNo);
    if (!tr) return { err: 'หาแถววันไม่เจอ' };
    tr.click();
    return { view: _pkView, date: _poDate, sheet: !!h().querySelector('.pk-sheet'),
             ov: !!h().querySelector('.pk-ov') };
  }, R0.sample.ds);
  if (R6.err) fail(R6.err);
  else if (R6.view !== 'day') fail('กดแถววันแล้วยังอยู่หน้าภาพรวม');
  else if (R6.date !== R0.sample.ds) fail('กดแถววัน ' + R0.sample.ds + ' แล้วไปวัน ' + R6.date);
  else if (!R6.sheet) fail('กลับมาหน้ารายวันแล้วแต่ไม่มีชีท');
  else if (R6.ov) fail('กลับมาหน้ารายวันแล้วตารางภาพรวมยังค้างอยู่');
  else ok('กดแถววันแล้วเปิดชีทของวันนั้นให้เลย · ' + R6.date);

  /* ══ 7 · หัวตารางสองชั้นตรึงใต้แถบ ไม่ทับแถวแรก ══════════════════
     กับดักที่เจอมาแล้วสามหน · กล่องครอบที่มี overflow ไม่ใช่ visible
     จะกลายเป็นตัวตั้งของ sticky แทนหน้าจอ · หัวตารางจะลอยลงไปทับแถวแรกทันทีที่วาดเสร็จ */
  await openOv();
  await page.waitForTimeout(300);
  const R7 = await page.evaluate(() => {
    const h = document.querySelector('[id^="pk-host-"]');
    const thg = h.querySelector('.pk-ov thead tr.g th');
    const ths = h.querySelector('.pk-ov thead tr.s th');
    const tb = h.querySelector('.pk-ov');
    const r1 = h.querySelector('tr.pk-ovd');
    const st = h.querySelector('.pk-stick');
    if (!thg || !ths) return { err: 'หัวตารางไม่ได้มีสองชั้น · หัวกลุ่ม ไทย/ต่างชาติ/ออกตั๋ว หายไป' };
    const hd = h.querySelector('.pk-ov thead');
    return { thTop: getComputedStyle(thg).top, sTop: getComputedStyle(ths).top,
             stickH: Math.round(st.getBoundingClientRect().height),
             gH: Math.round(thg.getBoundingClientRect().height),
             thY: Math.round(thg.getBoundingClientRect().top),
             tblY: Math.round(tb.getBoundingClientRect().top),
             hdH: Math.round(hd.getBoundingClientRect().height),
             r1Y: Math.round(r1.getBoundingClientRect().top) };
  });
  if (R7.err) fail(R7.err);
  else if (Math.abs(parseFloat(R7.thTop) - R7.stickH) > 2)
    fail('หัวตารางชั้นบนตรึงที่ ' + R7.thTop + ' แต่แถบบนสูง ' + R7.stickH + 'px · หัวจะมุดใต้แถบตอนเลื่อน');
  else if (parseFloat(R7.sTop) <= parseFloat(R7.thTop))
    fail('หัวชั้นล่างตรึงที่ ' + R7.sTop + ' ซึ่งไม่ได้ต่ำกว่าชั้นบน (' + R7.thTop + ') · สองชั้นจะทับกัน');
  else if (Math.abs(R7.thY - R7.tblY) > 2)
    fail('ยังไม่เลื่อนหน้าแต่หัวตารางลอยลงมา ' + (R7.thY - R7.tblY) + 'px จากขอบตาราง · ' +
         'แปลว่ากล่องครอบมี overflow ที่ทำให้ sticky ผูกกับกล่องแทนหน้า · หัวจะไปทับแถววันแรก');
  else if (R7.r1Y < R7.thY + R7.hdH - 2)
    fail('แถววันแรกอยู่ใต้หัวตาราง (แถว y=' + R7.r1Y + ' หัวจบที่ ' + (R7.thY + R7.hdH) + ') · วันที่ 1 ถูกบัง');
  else ok('หัวสองชั้นตรึงพอดีใต้แถบ (' + R7.thTop + ' / ' + R7.sTop + ') และไม่ทับแถววันแรก');

  /* ══ 8 · อ่านอย่างเดียว ══════════════════════════════════════════ */
  const R8 = await page.evaluate(async () => {
    const snap = () => JSON.stringify({
      bk: (SB_BOOKINGS || []).length,
      tr: Object.keys((typeof TRIPS !== 'undefined' && TRIPS) || {}).length,
      cfg: JSON.stringify((typeof PIER_CFG !== 'undefined' && PIER_CFG) || {}).length,
      ls: (function () { try { return (localStorage.getItem('loveandaman_v2') || '').length; } catch (_) { return -1; } })()
    });
    const a = snap();
    pkSetView('day'); await new Promise(r => setTimeout(r, 150));
    pkSetView('ov');  await new Promise(r => setTimeout(r, 200));
    pkMonShift(1);    await new Promise(r => setTimeout(r, 200));
    pkMonShift(-1);   await new Promise(r => setTimeout(r, 200));
    return { same: a === snap(), a, b: snap() };
  });
  if (!R8.same) fail('เปิด/เลื่อนหน้าภาพรวมแล้วข้อมูลขยับ · ' + R8.a + ' → ' + R8.b);
  else ok('เปิดและเลื่อนหน้าภาพรวมแล้วใบจอง ทริป ตั้งค่าท่า และข้อมูลในเครื่องไม่ขยับสักตัว');
}

/* ══ 9 · ไม่มี error บนหน้า ═══════════════════════════════════════ */
if (errors.length) fail('มี error ' + errors.length + ' ครั้ง · ' + errors.slice(0, 2).join(' | '));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
