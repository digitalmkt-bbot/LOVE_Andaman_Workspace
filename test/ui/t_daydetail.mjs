// §dayDetail · ป๊อปอัป "รายละเอียดทั้งวัน" ของการ์ด Live bookings
//
// วัดสามอย่างที่พังเงียบได้:
//  1. ตัวเลขในป๊อปอัปต้องมาจากกฎเดียวกับที่การ์ดใช้ (laIsB2C + _dashBkDay)
//     ถ้าใครไปเขียนเกณฑ์ใหม่ในป๊อปอัป สองที่จะขึ้นคนละเลขโดยไม่มีใครรู้
//  2. รายการต้องมี "ทุกใบของวัน" ไม่ใช่ 12 ใบล่าสุดเหมือนฟีดข้างนอก
//  3. เลื่อนวันในป๊อปอัปแล้ว หน้า Dashboard ข้างหลังต้องขยับตาม (_dashDate ตัวเดียวกัน)
//
// รันด้วยข้อมูลจริง:
//   LAD=allotment_v2/data_exports/subset_daydetail.json node test/ui/t_daydetail.mjs 2026-09-17
import { open, goView } from './_harness.mjs';

const DAY = process.argv[2] || null;
const { page, errors, close } = await open();
let bad = 0;
const fail = (m) => { console.log('  ✗ ' + m); bad++; };
const ok   = (m) => console.log('  ✓ ' + m);

try {
  await goView(page, 'dashboard', 700);
  if (DAY) {
    await page.evaluate(d => setDashDate(d), DAY);
    await page.waitForTimeout(600);
  }
  const day = await page.evaluate(() => window._dashDate || TODAY_STR);
  console.log('วันที่ตรวจ ' + day);

  // ค่าที่ควรจะเป็น · คิดจาก SB_BOOKINGS ตรง ๆ ในหน้าเดียวกัน ด้วยตัวอ่านชุดเดียวกับการ์ด
  const want = await page.evaluate(() => {
    const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
    const out = { b2c: { n: 0, pax: 0, val: 0 }, b2b: { n: 0, pax: 0, val: 0 }, cxl: 0, all: 0 };
    SB_BOOKINGS.forEach(b => {
      if (b.schemaVer !== 2) return;
      if (_dashBkDay(b) !== (window._dashDate || TODAY_STR)) return;
      out.all++;
      if (CXL.indexOf(b.status) >= 0) { out.cxl++; return; }
      const s = out[laIsB2C(b) ? 'b2c' : 'b2b'];
      s.n++;
      (b.trips || []).forEach(t => { s.pax += bkV2PaxAllTot(t.pax || {}); });
      s.val += (+acctBookingTotal(b) || 0);
    });
    return out;
  });
  console.log('ควรได้ · B2C ' + want.b2c.n + ' ใบ/' + want.b2c.pax + ' pax  ·  B2B '
    + want.b2b.n + ' ใบ/' + want.b2b.pax + ' pax  ·  ยกเลิก ' + want.cxl);

  // เปิดจากปุ่มจริงบนการ์ด ไม่ใช่เรียกฟังก์ชันตรง ๆ — ต้องทดสอบทางที่ผู้ใช้เดิน
  const btns = await page.$$('.dv-ddbt');
  if (btns.length !== 2) fail('ปุ่ม "รายละเอียดทั้งวัน" ควรมี 2 ปุ่ม (B2C + B2B) · ได้ ' + btns.length);
  else ok('ปุ่มขึ้นบนการ์ดทั้งสองใบ');
  if (!btns.length) throw new Error('ไม่มีปุ่มให้กด');

  await btns[0].click();
  await page.waitForTimeout(450);
  if (!(await page.$('#dv-ddov'))) fail('กดแล้วป๊อปอัปไม่ขึ้น'); else ok('ป๊อปอัปเปิดได้');

  // อ่านค่าที่ป๊อปอัปแสดงจริง ทั้งสองการ์ด — สองใบต้องอยู่บนจอพร้อมกัน นั่นคือทั้งหมดของ "แยก B2C/B2B"
  const got = await page.evaluate(() => {
    const read = side => {
      const c = document.querySelector('.dv-ddsum[data-side="' + side + '"]');
      if (!c) return null;
      const b = [...c.querySelectorAll('.dv-ddsv .s b')].map(x => x.textContent.trim());
      return { n: +b[0], pax: +b[1], money: b[2], avg: b[3], last: b[4] };
    };
    return { b2c: read('b2c'), b2b: read('b2b'),
      rows: document.querySelectorAll('.dv-ddrow').length,
      side: document.querySelector('.dv-ddsum.on')?.dataset.side || '' };
  });
  if (!got.b2c || !got.b2b) fail('การ์ดสรุปไม่ครบสองใบ');
  else {
    ok('การ์ดสรุปสองใบอยู่บนจอพร้อมกัน');
    ['b2c', 'b2b'].forEach(s => {
      if (got[s].n !== want[s].n) fail(s + ' · จำนวนใบ ได้ ' + got[s].n + ' ควรเป็น ' + want[s].n);
      else if (got[s].pax !== want[s].pax) fail(s + ' · pax ได้ ' + got[s].pax + ' ควรเป็น ' + want[s].pax);
      else ok(s + ' · ' + got[s].n + ' ใบ · ' + got[s].pax + ' pax · ' + got[s].money + ' ตรงกับ SB_BOOKINGS');
    });
  }

  // รายการ = ทุกใบของฝั่งที่เลือก รวมใบยกเลิก · ฟีดข้างนอกตัดที่ 12 ใบ ตัวนี้ต้องไม่ตัด
  // ต้องตรวจทั้งสองฝั่ง · ฝั่งที่เปิดมาก่อนอาจมีไม่ถึง 12 ใบ แล้วการตัดจะรอดสายตาไป
  const rowsOf = sd => page.evaluate(x => SB_BOOKINGS.filter(b => b.schemaVer === 2
      && _dashBkDay(b) === (window._dashDate || TODAY_STR)
      && (laIsB2C(b) ? 'b2c' : 'b2b') === x).length, sd);
  let checkedBig = false;
  for (const sd of ['b2c', 'b2b']) {
    await page.click('.dv-ddsum[data-side="' + sd + '"]');
    await page.waitForTimeout(280);
    const nowSide = await page.evaluate(() => document.querySelector('.dv-ddsum.on')?.dataset.side);
    if (nowSide !== sd) { fail('กดการ์ด ' + sd + ' แล้วไม่สลับฝั่ง · ได้ ' + nowSide); continue; }
    const shown = await page.evaluate(() => document.querySelectorAll('.dv-ddrow').length);
    const wantRows = await rowsOf(sd);
    if (shown !== wantRows) fail(sd + ' · รายการได้ ' + shown + ' แถว ควรเป็น ' + wantRows);
    else ok(sd + ' · รายการครบทุกใบของวัน · ' + shown + ' แถว');
    if (wantRows > 12) { checkedBig = true;
      if (shown <= 12) fail(sd + ' · รายการยังถูกตัดที่ 12 ใบเหมือนฟีดข้างนอก'); }
  }
  if (!checkedBig) console.log('  ! วันนี้ไม่มีฝั่งไหนเกิน 12 ใบ · ยังไม่ได้พิสูจน์ว่าไม่ถูกตัดที่ 12');

  // เลื่อนวัน · _dashDate ตัวเดียวกับแถบหัว ปิดป๊อปอัปแล้วหน้าหลังต้องอยู่วันเดียวกัน
  const before = await page.evaluate(() => window._dashDate);
  await page.click('#dv-ddhd .dv-arw');
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => window._dashDate);
  const headDay = await page.evaluate(() => (document.querySelector('.dv-hd .dv-dnum') || {}).textContent);
  if (after === before) fail('กด ‹ แล้ววันไม่ขยับ');
  else if (String(+headDay) !== String(+after.slice(8))) fail('แถบหัวหน้า Dashboard ไม่ตามวันของป๊อปอัป · หัว ' + headDay + ' ป๊อปอัป ' + after);
  else ok('เลื่อนวันแล้วหน้าข้างหลังตามด้วย · ' + before + ' → ' + after);

  // ปิดด้วย Esc
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  if (await page.$('#dv-ddov')) fail('Esc แล้วไม่ปิด'); else ok('Esc ปิดได้');

  // ── ช่วงวัน (§ddRange) ────────────────────────────────────────────────
  // กฎที่ต้องไม่หลุด: ตัวเลขทุกตัวในป๊อปอัปต้องมาจาก "ช่วงที่เลือกอยู่" ชุดเดียวกัน
  // ถ้าที่ไหนสักที่ยังอ่าน _dashDate อยู่ มันจะขึ้นเลขของวันเดียวปนกับเลขของทั้งช่วง
  // โดยไม่มี error ให้จับ — เป็นบั๊กที่อ่านหน้าจอแล้วไม่รู้เลยว่าผิด
  const sumOver = (from, to) => page.evaluate(([f, t]) => {
    const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
    const o = { n: 0, pax: 0, val: 0, cxl: 0 };
    SB_BOOKINGS.forEach(b => {
      if (b.schemaVer !== 2) return;
      const d = _dashBkDay(b); if (d < f || d > t) return;
      if (CXL.indexOf(b.status) >= 0) { o.cxl++; return; }
      o.n++; (b.trips || []).forEach(x => { o.pax += bkV2PaxAllTot(x.pax || {}); });
      o.val += (+acctBookingTotal(b) || 0);
    });
    return o;
  }, [from, to]);

  await page.evaluate(() => dashOpenDayDetail('b2b'));
  await page.waitForTimeout(400);

  let capChecked = false;
  for (const [k, want] of [['d7', 7], ['d30', 30], ['mtd', 0], ['d1', 1]]) {
    await page.click(`.dv-ddpv[onclick*="'${k}'"]`);
    await page.waitForTimeout(350);
    const g = await page.evaluate(() => ({
      from: window._ddFrom, to: window._ddTo,
      chips: [...document.querySelectorAll('.dv-ddkpi .dv-chip')].map(x => x.textContent.trim()),
      rows: document.querySelectorAll('.dv-ddrow').length,
      more: (document.querySelector('.dv-ddlist .dv-more') || {}).textContent || '',
      on: (document.querySelector('.dv-ddpv.on') || {}).textContent || '',
      dash: window._dashDate,
    }));
    const days = Math.round((Date.parse(g.to + 'T00:00:00') - Date.parse(g.from + 'T00:00:00')) / 864e5) + 1;
    if (want && days !== want) { fail(k + ' · ได้ ' + days + ' วัน ควรเป็น ' + want); continue; }
    const w = await sumOver(g.from, g.to);
    const n = +(g.chips[0] || '').replace(/\D/g, ''), pax = +(g.chips[1] || '').replace(/\D/g, '');
    if (n !== w.n || pax !== w.pax)
      fail(k + ' · ชิปบนหัวได้ ' + n + ' ใบ/' + pax + ' pax ควรเป็น ' + w.n + '/' + w.pax);
    else ok(k + ' · ' + g.from + '→' + g.to + ' (' + days + ' วัน) · ' + w.n + ' ใบ · ' + w.pax + ' pax ตรงกับ SB_BOOKINGS');
    if (!g.on) fail(k + ' · ปุ่มลัดที่กดไม่ติดสถานะ on');
    // ช่วงวันเดียวยังลากหน้า Dashboard ตามไปด้วย · เป็นช่วงแล้วต้องไม่ไปแตะ
    if (days === 1 && g.dash !== g.from) fail(k + ' · ช่วงวันเดียวแต่หน้าหลังไม่ตามไปวัน ' + g.from);
    // ฝาครอบจำนวนแถว · วาดพันกว่าแถวทำให้กดสลับฝั่งหน่วง
    const total = +((g.more.match(/จาก\s*(\d+)/) || [])[1] || g.rows);
    if (total > 300) { capChecked = true;
      if (g.rows > 300) fail(k + ' · ' + total + ' ใบ แต่วาด ' + g.rows + ' แถว · ฝาครอบไม่ทำงาน');
      else if (!g.more) fail(k + ' · ตัดแถวแล้วแต่ไม่บอกว่าตัด');
      else ok(k + ' · ตัดที่ ' + g.rows + ' จาก ' + total + ' ใบ และบอกไว้บนการ์ด');
    }
  }
  if (!capChecked) console.log('  ! ไม่มีช่วงไหนเกิน 300 ใบ · ยังไม่ได้พิสูจน์ฝาครอบจำนวนแถว');

  // กดดูทั้งหมด
  {
    await page.click('.dv-ddpv[onclick*="\'d30\'"]');
    await page.waitForTimeout(350);
    const before = await page.evaluate(() => ({ rows: document.querySelectorAll('.dv-ddrow').length,
      more: !!document.querySelector('.dv-ddlist .dv-more') }));
    if (before.more) {
      await page.click('.dv-ddlist .dv-more');
      await page.waitForTimeout(500);
      const after = await page.evaluate(() => ({ rows: document.querySelectorAll('.dv-ddrow').length,
        more: !!document.querySelector('.dv-ddlist .dv-more') }));
      if (after.rows <= before.rows || after.more) fail('กดดูทั้งหมดแล้วแถวไม่เพิ่ม · ' + before.rows + ' → ' + after.rows);
      else ok('กดดูทั้งหมด · ' + before.rows + ' → ' + after.rows + ' แถว');
    }
  }

  // ‹ › เลื่อนทีละช่วง ไม่ใช่ทีละวัน
  {
    await page.click('.dv-ddpv[onclick*="\'d7\'"]');
    await page.waitForTimeout(300);
    const a = await page.evaluate(() => ({ f: window._ddFrom, t: window._ddTo, d: window._dashDate }));
    await page.click('#dv-ddhd .dv-arw');
    await page.waitForTimeout(400);
    const b = await page.evaluate(() => ({ f: window._ddFrom, t: window._ddTo, d: window._dashDate }));
    const step = Math.round((Date.parse(a.f + 'T00:00:00') - Date.parse(b.f + 'T00:00:00')) / 864e5);
    if (step !== 7) fail('ช่วง 7 วัน · กด ‹ แล้วถอยไป ' + step + ' วัน ควรเป็น 7');
    else if (b.d !== a.d) fail('ช่วงหลายวันไม่ควรไปขยับวันของหน้า Dashboard · ' + a.d + ' → ' + b.d);
    else ok('ช่วง 7 วัน · กด ‹ ถอยทั้งช่วง ' + a.f + '→' + b.f + ' · หน้าหลังอยู่ที่เดิม');
  }

  // ช่องทางของใบ B2C (§b2cChan) · ต้องไม่มีช่องทางไหนเป็น "เลขที่ใบ"
  // note ของเว็บมีสองแบบ ต่างกันแค่มีช่องทางหรือไม่มี · อ่านช่องที่สองมาดื้อ ๆ
  // จะได้ช่องทางชื่อ LOV-xxxxxxx ใบละช่อง ไปกองในการ์ดเป็นร้อยแถว
  // จับด้วยกฎเดียว: ช่องทางของใบไหนต้องไม่ใช่ voucherRef หรือ id ของใบนั้นเอง
  {
    const bad = await page.evaluate(() => {
      const out = [];
      SB_BOOKINGS.forEach(b => {
        if (b.schemaVer !== 2 || !laIsB2C(b)) return;
        const c = String(laB2CChannel(b) || '');
        if (!c) return;
        if (c === String(b.voucherRef || '') || c === String(b.id || '')
            || /^[A-Za-z]{0,5}-?\d{4,}$/.test(c))
          out.push(b.id + ' → ' + c);
      });
      return out;
    });
    if (bad.length) fail('ช่องทาง B2C เป็นเลขที่ใบ ' + bad.length + ' ใบ · เช่น ' + bad.slice(0, 3).join(', '));
    else ok('ช่องทาง B2C ไม่มีใบไหนกลายเป็นเลขที่ใบ');

    // และจำนวนช่องทางต้องเป็นจำนวนที่คนตั้งไว้ ไม่ใช่โตตามจำนวนใบ
    const n = await page.evaluate(() => {
      const s = new Set();
      SB_BOOKINGS.forEach(b => { if (b.schemaVer === 2 && laIsB2C(b)) s.add(laB2CChannel(b)); });
      return s.size;
    });
    if (n > 20) fail('ช่องทาง B2C มี ' + n + ' แบบ · มากเกินกว่าจะเป็นช่องทางจริง');
    else ok('ช่องทาง B2C ทั้งหมด ' + n + ' แบบ');
  }

  // กดแถวแล้วต้องปิดแผ่นก่อน ไม่งั้นแผ่นเต็มจอบังหน้า Booking ที่เพิ่งเปิด
  {
    await page.click('.dv-ddpv[onclick*="\'d1\'"]');
    await page.waitForTimeout(350);
    const has = await page.evaluate(() => !!document.querySelector('.dv-ddrow'));
    if (has) {
      await page.click('.dv-ddrow');
      await page.waitForTimeout(600);
      if (await page.$('#dv-ddov')) fail('กดแถวแล้วแผ่นยังค้างอยู่ · บังหน้า Booking ที่เพิ่งเปิด');
      else ok('กดแถวแล้วแผ่นปิดให้เอง');
    }
  }

  if (errors.length) { errors.forEach(e => fail('error: ' + e)); }
  else ok('ไม่มี console error');
} finally { await close(); }

// ── จอแคบ ────────────────────────────────────────────────────────────────
// ป๊อปอัปยืมโทเคนหน้าตาจากแถบหัวหน้า Dashboard มาใช้ (.dv-chip ฯลฯ) ซึ่งถูกที่แล้ว
// แต่ .dv-kpi มีกฎจอแคบของมันเอง — width:100% + margin-right:-92px สำหรับแถบหัว
// ที่มีปุ่มลอยมุมขวา · ป๊อปอัปไม่มีปุ่มนั้น ชิปเลยทะลุขอบขวา **82px** และปุ่มปิด
// หลุดออกนอกจอ = ออกจากหน้าไม่ได้เลยบนมือถือ · ไม่มี error ให้จับ t_smoke มองไม่เห็น
// เกณฑ์เดียวกับ t_mobile: ล้นแนวนอน ≤ 4px · และปุ่มปิดต้องอยู่ในจอ
{
  const { page, close } = await open({ width: 390, height: 812 });
  try {
    await goView(page, 'dashboard', 700);
    if (DAY) { await page.evaluate(d => setDashDate(d), DAY); await page.waitForTimeout(600); }
    await page.evaluate(() => dashOpenDayDetail('b2b'));
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const sh = document.querySelector('.dv-ddsheet');
      const x = document.querySelector('.dv-ddx').getBoundingClientRect();
      const out = [];
      document.querySelectorAll('#dv-ddov *').forEach(el => { const r = el.getBoundingClientRect();
        if (r.right > innerWidth + 0.5) out.push(el.tagName + '.' + String(el.className).slice(0, 34)
          + ' เกินไป ' + Math.round(r.right - innerWidth) + 'px'); });
      return { over: sh.scrollWidth - sh.clientWidth, xIn: x.right <= innerWidth + 0.5 && x.left >= -0.5,
        who: out.slice(0, 3) };
    });
    if (m.over > 4) fail('390px · ล้นแนวนอน ' + m.over + 'px · ' + (m.who.join(' | ') || '?'));
    else ok('390px · ล้นแนวนอน ' + m.over + 'px');
    if (!m.xIn) fail('390px · ปุ่มปิดหลุดนอกจอ · ออกจากป๊อปอัปไม่ได้');
    else ok('390px · ปุ่มปิดอยู่ในจอ');
  } finally { await close(); }
}

console.log('\nพัง ' + bad);
process.exit(bad ? 1 : 0);
