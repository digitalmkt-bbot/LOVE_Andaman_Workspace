// §btAlign · คอลัมน์ตารางหน้า By trip · date ต้องตรงกันทุกโปรแกรม
//
// ที่มา (2026-09-28) · ผู้ใช้เจอเอง · วงกรอบแดงคร่อมคอลัมน์ AD แล้วถามว่า
// "จริงๆแถวนี้มันควรจะตรงกันไหม และตัวเลขจะได้เห็น"
//
// หน้านี้วาดหนึ่งโปรแกรม = หนึ่ง <table> · ของเดิมเป็น table-layout:auto
// เบราว์เซอร์จึงคิดความกว้างจากเนื้อหาของแต่ละตารางแยกกัน · โปรแกรมที่ชื่อลูกค้ายาว
// จะดันคอลัมน์ขวาออกไป ส่วนโปรแกรมที่ชื่อสั้นหดกลับ · เลื่อนตาลงมาตามคอลัมน์ AD
// แล้วจะไปตกในช่องว่างของอีกตาราง — ตัวเลขอยู่ครบแต่ไม่ได้อยู่ในแนวเดียวกัน
//
// วัดก่อนแก้ด้วยชุดข้อมูลทดสอบ (ซึ่งชื่อสั้นกว่าของจริง) · ตรงกันแค่ 3 จาก 18 คอลัมน์
// เพี้ยนสูงสุด 43px · ของจริงชื่อยาวกว่า ระยะจึงมากกว่านี้
//
// แก้ด้วย <colgroup> + table-layout:fixed · ความกว้างมาจากตัวเลขที่เขียนไว้
// ไม่ใช่เนื้อหา · ทุกตารางใช้ชุดเดียวกันจึงตรงกันหมด
//
// เทสนี้กันห้าอย่าง
//   1 หน้านี้ต้องมีอย่างน้อยสองตารางในวันเดียวกัน ไม่งั้นตรวจการตรงแนวไม่ได้
//   2 จำนวน <col> ต้องเท่ากับจำนวนหัวคอลัมน์ · ไม่เท่าเมื่อไหร่ความกว้างเลื่อนทันที
//   3 ขอบซ้ายของทุกคอลัมน์ต้องตรงกันทุกตาราง
//   4 ตัวเลขในช่อง AD ต้องอยู่ใต้หัว AD จริง ๆ (วัดจากตำแหน่งบนจอ ไม่ใช่ลำดับ td)
//   5 ต้องเป็น table-layout:fixed · auto ทำให้ข้อ 3 กลับมาพังเงียบ ๆ เมื่อข้อมูลเปลี่ยน

import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1200 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1200);

const R0 = await page.evaluate(() => {
  /* วันที่มีโปรแกรมตั้งแต่สองอันขึ้นไป · คิดเองจาก SB_BOOKINGS ไม่ถามหน้าเว็บ */
  const cnt = {};
  (SB_BOOKINGS || []).forEach(b => {
    if (['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)) return;
    (b.trips || []).forEach(t => {
      if (!t.date || !t.routeId) return;
      (cnt[t.date] = cnt[t.date] || new Set()).add(t.routeId);
    });
  });
  const day = Object.keys(cnt).filter(d => cnt[d].size >= 2).sort()[0];
  if (!day) return { err: 'ชุดข้อมูลนี้ไม่มีวันไหนที่มี 2 โปรแกรม' };
  const el = document.querySelector('.nav-item[data-view="booking"]');
  if (!el) return { err: 'ไม่มีเมนู Booking' };
  nav(el);
  bkV2SwitchTab('bytrip');
  bkV2Tab2PickDay(day);
  return { day, nRoute: cnt[day].size };
});
if (R0.err) fail(R0.err);
await page.waitForTimeout(900);

const read = () => page.evaluate(() => {
  const tbls = [].slice.call(document.querySelectorAll('table.t2-mtbl.t2-fixed'));
  return {
    n: tbls.length,
    layout: tbls.length ? getComputedStyle(tbls[0]).tableLayout : '',
    t: tbls.map(tb => ({
      nCol: tb.querySelectorAll('colgroup > col').length,
      th: [].slice.call(tb.querySelectorAll('thead th')).map(x => ({
        t: (x.textContent || '').trim().slice(0, 12),
        x: Math.round(x.getBoundingClientRect().left),
        w: Math.round(x.getBoundingClientRect().width)
      })),
      /* ช่อง AD ของแถวข้อมูลแถวแรก · ใช้ตำแหน่งจริงบนจอ ไม่ใช่ลำดับ td
         เพราะถ้าเลื่อนแนว ลำดับยังถูกแต่ตาคนอ่านผิด */
      adTd: (function () {
        const tr = [].slice.call(tb.querySelectorAll('tbody tr.t2-row'))
          .find(r => r.querySelectorAll('td').length > 6);
        if (!tr) return null;
        const tds = [].slice.call(tr.querySelectorAll('td'));
        const iAd = [].slice.call(tb.querySelectorAll('thead th'))
          .findIndex(x => (x.textContent || '').trim() === 'AD');
        const td = tds[iAd];
        return td ? { x: Math.round(td.getBoundingClientRect().left),
                      w: Math.round(td.getBoundingClientRect().width),
                      v: (td.textContent || '').trim().slice(0, 6) } : null;
      })()
    }))
  };
});

const R = await read();

/* ══ 1 · ต้องมีอย่างน้อยสองตาราง ═══════════════════════════════════════ */
if (R.n < 2) fail('วันที่ ' + R0.day + ' วาดออกมา ' + R.n + ' ตาราง · ต้องมีอย่างน้อย 2 ถึงจะตรวจการตรงแนวได้');
else ok('วันที่ ' + R0.day + ' มี ' + R.n + ' ตาราง (' + R0.nRoute + ' โปรแกรม) · ตรวจการตรงแนวได้');

/* ══ 2 · จำนวน col ต้องเท่ากับหัวคอลัมน์ ═══════════════════════════════ */
if (R.n) {
  const bads = R.t.map((t, i) => ({ i, nCol: t.nCol, nTh: t.th.length })).filter(x => x.nCol !== x.nTh);
  if (!R.t[0].nCol) fail('ตารางไม่มี <colgroup> · ความกว้างจะกลับไปคิดจากเนื้อหาของแต่ละตาราง');
  else if (bads.length)
    fail('จำนวน <col> ไม่เท่าหัวคอลัมน์ · ' + bads.map(x => 'ตาราง' + x.i + ' col=' + x.nCol + ' th=' + x.nTh).join(' · ') +
         ' · คอลัมน์จะเลื่อนทั้งแถวตั้งแต่จุดที่ขาด');
  else ok('ทุกตารางมี <col> ครบเท่าหัวคอลัมน์ ' + R.t[0].nCol + ' ช่อง');
}

/* ══ 3 · ขอบซ้ายของทุกคอลัมน์ต้องตรงกัน ═══════════════════════════════ */
if (R.n >= 2) {
  const a = R.t[0].th;
  const off = [];
  R.t.slice(1).forEach((t, k) => a.forEach((c, i) => {
    const d = t.th[i]; if (!d) return;
    if (Math.abs(c.x - d.x) > 1) off.push((c.t || '#' + i) + ' ตาราง' + (k + 2) + ' เพี้ยน ' + (d.x - c.x) + 'px');
  }));
  if (off.length)
    fail('คอลัมน์ไม่ตรงกัน ' + off.length + ' ช่อง · ' + off.slice(0, 4).join(' · ') + (off.length > 4 ? ' …' : '') +
         ' · เลื่อนตาลงมาตามคอลัมน์เดียวแล้วจะไปตกช่องว่างของอีกตาราง');
  else ok('ขอบซ้ายตรงกันครบ ' + a.length + '/' + a.length + ' คอลัมน์ ทุกตาราง');
}

/* ══ 4 · ตัวเลข AD ต้องอยู่ใต้หัว AD ═══════════════════════════════════ */
if (R.n) {
  const MINW = 24;   /* แคบกว่านี้เลขหลักเดียวก็อยู่ไม่ครบ */
  const rows = R.t.map((t, i) => {
    const th = t.th.find(x => x.t === 'AD');
    return { i, th: th ? th.x : null, thw: th ? th.w : 0, td: t.adTd };
  }).filter(x => x.th != null && x.td);
  if (!rows.length) fail('หาช่อง AD ในตารางไม่เจอ · ตรวจข้อนี้ไม่ได้');
  else {
    const thin = rows.filter(x => x.thw < MINW || x.td.w < MINW);
    const blank = rows.filter(x => !x.td.v);
    const off = rows.filter(x => Math.abs(x.th - x.td.x) > 1);
    if (thin.length)
      fail('ช่อง AD แคบเกินจนอ่านเลขไม่ออก · ' +
           thin.map(x => 'ตาราง' + x.i + ' หัว ' + x.thw + 'px ช่อง ' + x.td.w + 'px').join(' · ') +
           ' · ต้องอย่างน้อย ' + MINW + 'px');
    else if (blank.length)
      fail('ช่อง AD ว่างเปล่า ' + blank.length + ' ตาราง · ทุกแถวต้องพิมพ์ตัวเลขออกเสมอ ถ้าเป็นศูนย์ก็พิมพ์ 0');
    else if (off.length)
      fail('ตัวเลข AD ไม่ได้อยู่ใต้หัว AD · ' + off.map(x => 'ตาราง' + x.i + ' หัว x=' + x.th + ' ค่า x=' + x.td.x).join(' · '));
    else ok('ตัวเลข AD อยู่ใต้หัว AD ทุกตาราง และกว้างพอให้เห็นเลข (' +
            rows.map(x => '"' + x.td.v + '" ' + x.td.w + 'px').join(' · ') + ')');
  }
}

/* ══ 5 · ต้องเป็น fixed ═══════════════════════════════════════════════ */
if (R.n) {
  if (R.layout !== 'fixed')
    fail('table-layout เป็น "' + R.layout + '" · auto จะคิดความกว้างจากเนื้อหาของแต่ละตาราง ข้อ 3 จะกลับมาพังเงียบ ๆ เมื่อข้อมูลเปลี่ยน');
  else ok('table-layout = fixed · ความกว้างมาจาก <col> ไม่ใช่เนื้อหา');
}

/* ══ 6 · ช่องต้องกว้างพอสำหรับค่าที่ยาวที่สุดที่เป็นไปได้จริง ═══════════
   ที่มา · รอบแรกของ §btAlign ตั้ง Time ไว้ 56px เพราะชุดข้อมูลทดสอบไม่มีเวลารับเลย
   ช่องนั้นขึ้นแค่ "—" ทุกแถว · พอขึ้นของจริงที่มี "07:45-08:00" ตัวท้ายถูกตัดหาย
   กลายเป็น "07:45-08:0" ติดกับชื่อโรงแรม · ผู้ใช้เจอทันทีและทุกแถวเป็นเหมือนกันหมด
   บทเรียน · ตั้งความกว้างตายตัวแล้ววัดกับข้อมูลที่ "บังเอิญสั้น" = ไม่ได้วัดอะไรเลย
   ข้อนี้จึงวัดจากรูปแบบค่าที่ยาวที่สุดที่คอลัมน์นั้นเป็นไปได้ ไม่ใช่จากข้อมูลที่มีอยู่
   วัดด้วยฟอนต์จริงของช่องนั้น ไม่ใช่เดาเป็นตัวอักษรคูณความกว้าง */
const LONGEST = {
  'Time':  '07:45-08:00',          /* ช่วงเวลารับ · รูปแบบยาวสุดของระบบ */
  'AD':    '88',   'CHD': '88',  'INF': '88',  'FOC': '88',
  'Room':  '8888',                 /* เลขห้อง 4 หลัก */
  'Total': '฿888,888'
};
if (R.n) {
  const M = await page.evaluate((LONGEST) => {
    const tb = document.querySelector('table.t2-mtbl.t2-fixed');
    if (!tb) return { err: 'ไม่มีตาราง' };
    const th = [].slice.call(tb.querySelectorAll('thead th'));
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
    document.body.appendChild(probe);
    const out = [];
    Object.keys(LONGEST).forEach(name => {
      const i = th.findIndex(x => (x.textContent || '').trim() === name);
      if (i < 0) return;
      const tr = [].slice.call(tb.querySelectorAll('tbody tr.t2-row'))
        .find(r => r.querySelectorAll('td').length > 6);
      const cell = tr ? tr.querySelectorAll('td')[i] : th[i];
      if (!cell) return;
      const cs = getComputedStyle(cell);
      probe.style.font = cs.font || (cs.fontWeight + ' ' + cs.fontSize + '/' + cs.lineHeight + ' ' + cs.fontFamily);
      probe.textContent = LONGEST[name];
      const need = Math.ceil(probe.getBoundingClientRect().width);
      const pad = Math.ceil(parseFloat(cs.paddingLeft) || 0) + Math.ceil(parseFloat(cs.paddingRight) || 0);
      out.push({ name, need: need + pad, got: Math.round(cell.getBoundingClientRect().width), sample: LONGEST[name] });
    });
    probe.remove();
    return { out };
  }, LONGEST);
  if (M.err) fail(M.err);
  else if (!M.out.length) fail('หาคอลัมน์ที่จะวัดไม่เจอ · ตรวจข้อนี้ไม่ได้');
  else {
    const tight = M.out.filter(x => x.got < x.need);
    if (tight.length)
      fail('ช่องแคบเกินค่าที่ยาวที่สุด · ' +
           tight.map(x => x.name + ' กว้าง ' + x.got + 'px แต่ "' + x.sample + '" ต้องการ ' + x.need + 'px').join(' · ') +
           ' · ตัวท้ายจะถูกตัดหาย');
    else ok('ทุกช่องกว้างพอสำหรับค่าที่ยาวที่สุด · ' +
            M.out.map(x => x.name + ' ' + x.got + '/' + x.need).join(' · '));
  }
}

/* ══ 7 · ไม่มีเนื้อหาล้นข้ามไปทับช่องข้าง ═══════════════════════════════ */
if (R.n) {
  const O = await page.evaluate(() => {
    const tbls = [].slice.call(document.querySelectorAll('table.t2-mtbl.t2-fixed'));
    const bad = [];
    tbls.forEach(tb => {
      const th = [].slice.call(tb.querySelectorAll('thead th')).map(x => (x.textContent || '').trim().slice(0, 12));
      [].slice.call(tb.querySelectorAll('td,th')).forEach(c => {
        if (getComputedStyle(c).overflow === 'visible') bad.push(th[c.cellIndex] || ('#' + c.cellIndex));
      });
    });
    return [...new Set(bad)];
  });
  if (O.length)
    fail('ช่องที่ยังปล่อยเนื้อหาล้นออกนอกตัวเอง ' + O.length + ' คอลัมน์ · ' + O.slice(0, 5).join(', ') +
         ' · fixed ไม่ขยายช่องตามเนื้อหา ตัวหนังสือจะทะลุไปทับช่องถัดไป');
  else ok('ทุกช่องตัดเนื้อหาไว้ในตัวเอง · ล้นแล้วหายในช่องตัวเอง ไม่ไปทับช่องข้าง');
}

/* ══ 8 · ไม่มี error บนหน้า ════════════════════════════════════════════ */
if (errors.length) fail('มี error ' + errors.length + ' ครั้ง · ' + errors.slice(0, 2).join(' | '));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
