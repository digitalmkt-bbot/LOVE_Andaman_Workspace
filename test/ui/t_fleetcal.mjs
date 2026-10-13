// §fleetCal · หน้า Fleet Calendar · matrix ท่า → โปรแกรม × วัน
//
// หน้านี้ไม่ได้เก็บข้อมูลของตัวเองสักช่อง · ทุกตัวเลขยืมตัวอ่านของหน้าอื่นมาทั้งหมด
// สิ่งที่ต้องกันคือ "ยืมมาแล้วเพี้ยน" ซึ่งไม่มี error ให้จับ หน้าเปิดได้ปกติทุกประการ
//   1. ลำอยู่ท่าไหน  ต้องตรงกับ getBoatCurrentPier (กฎเดียวกับหน้า Boat Status)
//   2. คนบนลำ        ต้องตรงกับ bkBoatLoadOther (ตัวที่ Boat Operation ใช้)
//      — fcLoadMap กวาดใบจองรอบเดียวเพื่อความเร็ว ผลต้องเท่ากันเป๊ะ
//   3. ลำว่างของท่า  ต้องเป็นลำที่ไม่มีงานและไม่ติดสถานะ ครบทุกลำ ไม่ขาดไม่เกิน
//   4. จอ 390px      ต้องไม่ล้นแนวนอน และเลื่อนดูวันถัดไปได้ (คอลัมน์ซ้ายตรึง)
//
// รันด้วยข้อมูลจริง:
//   LAD=allotment_v2/data_exports/subset_fleet.json node test/ui/t_fleetcal.mjs
import { open, goView } from './_harness.mjs';

let bad = 0;
const fail = (m) => { console.log('  ✗ ' + m); bad++; };
const ok   = (m) => console.log('  ✓ ' + m);

{
  const { page, errors, close } = await open({ width: 1700, height: 1100 });
  try {
    await goView(page, 'fleetcal', 1200);
    if (!(await page.$('.fc-mt'))) fail('เปิดมาไม่เจอ matrix'); else ok('หน้าเปิดได้ · ขึ้น matrix 14 วัน');

    // ── 1+2+3 · เทียบทุกช่องกับตัวอ่านต้นทาง ────────────────────────────
    const r = await page.evaluate(() => {
      const days = [];
      for (let i = 0; i < 14; i++) days.push(fcAddDays(_fc.from, i));
      const boats = fcBoats();
      const load = fcLoadMap(days), memo = {};
      const out = { pier: [], pax: [], nRun: 0, nFree: 0, nOff: 0 };
      days.forEach(ds => boats.forEach(b => {
        const c = fcCell(b, ds, load, memo);
        // 1 · ท่าต้องมาจาก getBoatCurrentPier ตรง ๆ
        const want = getBoatCurrentPier(b, ds);
        if (c.pier !== want) out.pier.push(b.name + '@' + ds + ' ได้ ' + c.pier + ' ควรเป็น ' + want);
        // 2 · คนบนลำต้องเท่ากับ bkBoatLoadOther ทุกช่องที่มีงาน
        if (c.k === 'run') {
          out.nRun++;
          const w = bkBoatLoadOther(null, ds, b.id);
          if ((c.pax || 0) !== w) out.pax.push(b.name + '@' + ds + ' ได้ ' + c.pax + ' ควรเป็น ' + w);
        } else if (c.k === 'free') {
          out.nFree++;
          // 3 · ลำว่าง = พร้อมใช้ และไม่มีงานใน TRIPS
          const st = getCurStatus(b, ds).s;
          const op = (typeof TRIPS !== 'undefined' && TRIPS[ds]) ? TRIPS[ds][b.id] : null;
          if (st !== 'available' || (op && op.route))
            out.pax.push('ว่างผิด ' + b.name + '@' + ds + ' status=' + st + ' route=' + (op && op.route));
        } else out.nOff++;
      }));
      return out;
    });
    if (r.pier.length) fail('ท่าของลำไม่ตรงกับ Boat Status ' + r.pier.length + ' ช่อง · ' + r.pier.slice(0, 2).join(' | '));
    else ok('ท่าของลำตรงกับ getBoatCurrentPier ทุกช่อง (' + (r.nRun + r.nFree + r.nOff) + ' ช่อง)');
    if (r.pax.length) fail('คนบนลำ/ลำว่างไม่ตรงกับต้นทาง ' + r.pax.length + ' ช่อง · ' + r.pax.slice(0, 2).join(' | '));
    else ok('คนบนลำตรงกับ bkBoatLoadOther ทุกช่อง · วิ่ง ' + r.nRun + ' · ว่าง ' + r.nFree + ' · ไม่พร้อม ' + r.nOff);

    // ── โครงตาราง · ต้องเป็น ท่า → โปรแกรม ไม่ใช่รายลำ ────────────────
    const shape = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.fc-mt tbody tr')];
      const boatNames = new Set(fcBoats().map(b => b.name));
      return {
        piers: rows.filter(t => t.classList.contains('fc-mg')).length,
        progs: rows.filter(t => t.classList.contains('fc-pr') && !t.classList.contains('fr')).length,
        free: rows.filter(t => t.classList.contains('fr')).length,
        // หัวแถวต้องไม่ใช่ชื่อเรือ — ถ้าเป็น แปลว่ากลับไปเป็นตารางรายลำแล้ว
        boatRows: rows.filter(t => boatNames.has((t.querySelector('.nm') || {}).textContent)).length,
      };
    });
    if (shape.boatRows) fail('มีแถวที่หัวเป็นชื่อเรือ ' + shape.boatRows + ' แถว · ตารางต้องเป็น ท่า → โปรแกรม');
    else if (!shape.progs) fail('ไม่มีแถวโปรแกรมเลย');
    else ok('โครงตาราง · ท่า ' + shape.piers + ' · โปรแกรม ' + shape.progs + ' · ว่างที่ท่า ' + shape.free);

    // ── สลับโหมด ──────────────────────────────────────────────────────
    for (const [m, want] of [['m7', 7], ['mo', 0]]) {
      await page.evaluate(x => fcSetMode(x), m);
      await page.waitForTimeout(500);
      const g = await page.evaluate(() => ({
        cols: document.querySelectorAll('.fc-mt thead th').length - 1,
        cells: document.querySelectorAll('.fc-c:not(.out)').length }));
      if (want && g.cols !== want) fail(m + ' · ได้ ' + g.cols + ' คอลัมน์ ควรเป็น ' + want);
      else if (!want && !g.cells) fail('โหมดเดือนไม่มีช่องวันเลย');
      else ok(m + ' · ' + (want ? (g.cols + ' คอลัมน์') : (g.cells + ' ช่องวัน')));
    }

    // ── §fcFwd · ช่วงต้องเริ่มที่วันนี้ แล้วนับไปข้างหน้า ───────────────
    // ของเดิมวางวันนี้ไว้กลางช่วง ครึ่งตารางเป็นอดีตที่จัดเรือไปแล้ว
    // หน้านี้ใช้วางแผนล่วงหน้า ที่ว่างวันข้างหน้าคือของที่ต้องเห็น
    for (const [m, n] of [['m7', 7], ['m14', 14]]) {
      await page.evaluate(x => fcSetMode(x), m);
      await page.waitForTimeout(400);
      const g = await page.evaluate(() => ({ from: _fc.from, today: TODAY_STR,
        first: (document.querySelector('.fc-mt thead th:nth-child(2) .dn') || {}).textContent,
        cols: document.querySelectorAll('.fc-mt thead th').length - 1 }));
      const past = Math.round((Date.parse(g.today + 'T00:00:00') - Date.parse(g.from + 'T00:00:00')) / 864e5);
      if (g.from !== g.today) fail(m + ' · ช่วงเริ่มที่ ' + g.from + ' ย้อนหลังไป ' + past + ' วัน · ควรเริ่มที่วันนี้ ' + g.today);
      else if (g.cols !== n) fail(m + ' · ได้ ' + g.cols + ' คอลัมน์ ควรเป็น ' + n);
      else ok(m + ' · เริ่มที่วันนี้ ' + g.from + ' แล้วนับไปข้างหน้า ' + n + ' วัน');
    }
    await page.evaluate(() => fcSetMode('m14'));
    await page.waitForTimeout(400);

    // ── ชิปเลือกท่า ──────────────────────────────────────────────────
    await page.evaluate(() => fcSetMode('m14'));
    await page.waitForTimeout(400);
    const pills = await page.$$eval('.fc-pp', ns => ns.map(n => n.textContent.trim()));
    if (pills.length < 4) fail('ชิปเลือกท่ามี ' + pills.length + ' ตัว · ควรมี All piers + ท่าทั้งหมด');
    else ok('ชิปเลือกท่า ' + pills.length + ' ตัว · ' + pills.join(' / '));
    for (const pk of ['panwa', 'tublamu', 'ranong']) {
      await page.evaluate(x => fcSetPier(x), pk);
      await page.waitForTimeout(350);
      const g = await page.evaluate(() => ({
        groups: document.querySelectorAll('.fc-mt tr.fc-mg').length,
        // ตัวเลขบนแถบหัวต้องเดินตามท่าที่กรองด้วย ไม่งั้นหัวบอกเลขทั้งฝูงแต่ตารางโชว์ท่าเดียว
        off: +(document.querySelectorAll('.fc-top .fc-chip')[2].textContent.match(/\d+/) || [0])[0],
      }));
      const want = await page.evaluate(x => {
        const load = fcLoadMap([TODAY_STR]), memo = {};
        return fcBoats().filter(b => { const c = fcCell(b, TODAY_STR, load, memo);
          return c.pier === x && c.k !== 'run' && c.k !== 'free'; }).length;
      }, pk);
      if (g.groups !== 1) fail(pk + ' · กรองแล้วเหลือ ' + g.groups + ' กลุ่มท่า ควรเหลือ 1');
      else if (g.off !== want) fail(pk + ' · ชิป Unavailable บนหัวได้ ' + g.off + ' ควรเป็น ' + want + ' (ไม่ได้เดินตามท่าที่กรอง)');
      else ok(pk + ' · กรองเหลือท่าเดียว · ชิปหัวตามด้วย (Unavailable ' + g.off + ')');
    }
    await page.evaluate(() => fcSetPier('all'));
    await page.waitForTimeout(300);

    // ── §fcSafari · กันคอลัมน์ตรึงพังบน iOS ─────────────────────────────
    // display:flex บน <th> ถอดเซลล์ออกจาก table layout · Safari เลยไม่ยอม sticky
    // Chrome ยอมทั้งคู่ ของเลยดูปกติบนเครื่องพัฒนาแต่พังบนมือถือจริง
    // เทสนี้รันบน Chrome จับอาการตรง ๆ ไม่ได้ · จับที่ "เงื่อนไขที่ทำให้พัง" แทน
    const flexTh = await page.evaluate(() => [...document.querySelectorAll('.fc-mt th')]
      .filter(t => getComputedStyle(t).position === 'sticky' && getComputedStyle(t).display === 'flex')
      .map(t => (t.textContent || '').trim().slice(0, 24)));
    if (flexTh.length) fail('th ที่ตรึงไว้ตั้ง display:flex ' + flexTh.length + ' ตัว · Safari จะไม่ตรึงให้ · ' + flexTh.slice(0, 2).join(' | '));
    else ok('th ที่ตรึงไว้ยังเป็น table-cell · sticky ใช้ได้บน Safari');

    if (errors.length) errors.forEach(e => fail('error: ' + e));
    else ok('ไม่มี console error');
  } finally { await close(); }
}

// ── 4 · จอมือถือ ────────────────────────────────────────────────────────
// ตารางกว้างคงที่เสมอ · จอแคบต้อง "เลื่อนแนวนอน" ไม่ใช่ "บีบให้พอดี"
// บีบแล้วช่องเหลือ ~35px ชื่อเรือกับเลขทับกันจนอ่านไม่ออกสักช่อง แต่ไม่มี error ให้จับ
{
  const { page, close } = await open({ width: 390, height: 812 });
  try {
    await goView(page, 'fleetcal', 1200);
    const m = await page.evaluate(() => {
      const w = document.querySelector('.fc-wrap'), t = document.querySelector('.fc-mt');
      const th = document.querySelector('.fc-mt th.sticky');
      return {
        pageOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        scrollable: w ? (w.scrollWidth - w.clientWidth) : -1,
        tableW: t ? Math.round(t.getBoundingClientRect().width) : 0,
        stickyPos: th ? getComputedStyle(th).position : '',
      };
    });
    if (m.pageOver > 4) fail('390px · หน้าล้นแนวนอน ' + m.pageOver + 'px');
    else ok('390px · หน้าไม่ล้นแนวนอน');
    if (m.scrollable <= 0) fail('390px · ตารางไม่เลื่อนแนวนอน (กว้าง ' + m.tableW + 'px) · แปลว่าถูกบีบให้พอดีจอ');
    else ok('390px · ตารางเลื่อนแนวนอนได้ ' + m.scrollable + 'px (กว้างจริง ' + m.tableW + 'px)');
    if (m.stickyPos !== 'sticky') fail('390px · คอลัมน์ซ้ายไม่ตรึง · เลื่อนไปแล้วไม่รู้ว่าแถวไหนของโปรแกรมไหน');
    else ok('390px · คอลัมน์ซ้ายตรึงไว้');
  } finally { await close(); }
}

console.log('\nพัง ' + bad);
process.exit(bad ? 1 : 0);
