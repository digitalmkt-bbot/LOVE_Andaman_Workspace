// §internal · ใบของบริษัทเอง · ไม่ใช่เอเยนต์ และไม่ใช่ B2C
//
// ที่มา (2026-09-26) · ผู้ใช้ถามเอง · "Booking ที่เป็นของบริษัทเอง ไม่มี Agent
// และก็ไม่ได้เป็น B2C ซึ่งอาจจะมีเก็บเงินหรือไม่เก็บเงินก็ได้ เช่น เป็นแขกของบริษัท
// ไม่เก็บเงิน หรือจะเป็น FOC ของส่วน PR ... หรือจะเป็นเก็บเงินราคาพิเศษก็มี
// ซึ่งเราก็อยากได้การ Track ข้อมูลส่วนนี้แยกกันได้ด้วย"
//
// สิ่งที่วัดได้ตอนออกแบบ (ข้อมูลจริง 1,194 ใบที่ยังไม่ยกเลิก)
//   ทริปพนักงาน 6 ใบมีอยู่แล้ว ทุกใบ ฿0 · แต่ purpose กับ staffId ว่างทั้งหมด
//   จึงไม่มีอะไรมองเห็นมันเลย · หน้า Staff & Welfare ขึ้นโควตา "ใช้ไป 0"
//   และ ฿0 หกใบนั้นถูกนับรวมในยอดขาย ลากเฉลี่ยต่อใบจาก ฿5,910 ลงมา ฿5,880
//
// กติกาที่ตกลงกันไว้ · เทสนี้คือตัวกันไม่ให้กติกาเพี้ยน
//   เหตุผล (purpose) กับ เก็บเงิน/ไม่เก็บเงิน (ยอดเงิน) เป็นสองมิติ แยกกันเสมอ
//   ตัดออกจากยอดขายเฉพาะ "ใบของบริษัทเองที่ไม่เก็บเงิน" · ตัวหารของค่าเฉลี่ยลดตามด้วย
//   ⚠ ใบของเอเยนต์ปกติที่เป็น ฿0 ห้ามตัด — เป็นข้อผิดพลาดของข้อมูลที่ต้องมองเห็น
//     (ในข้อมูลจริงมี 29 ใบ · ตัดให้ก็เท่ากับช่วยซ่อนของเสีย)
//   ⚠ ที่นั่ง · fill% · ความจุ · ต้นทุน ยังนับทุกใบ · คนขึ้นเรือจริง
//   ⚠ ใบแจ้งหนี้ / การรับเงิน / PFM ห้ามแตะ · ต้องโชว์เงินที่ค้างจริง
//
// เทสนี้กันสิบอย่าง
//   1 market House / Company + house agent a_company มีจริง และเป็นบัญชีบ้าน
//   2 กฎจับใบของบริษัทได้แม้ใบเก่าจะไม่มี purpose (จับจาก market ของ agent)
//   3 ตัดเฉพาะ internal ที่ ฿0 · ใบเอเยนต์ ฿0 ไม่ถูกตัด
//   4 หัวฟีด Live bookings ไม่นับใบ internal ฟรี และบอกบนจอว่าตัดไปกี่ใบ
//   5 ป๊อปอัปรายละเอียดทั้งวัน · ยอด/ใบ/เฉลี่ย ไม่นับ แต่แถวยังอยู่พร้อมป้ายเหตุผล
//   6 Demand · แท็บ Sales และ Agents ไม่นับใบ internal ฟรี
//   7 ที่นั่งยังนับตามปกติ · ที่นั่งที่ใช้ไปของทริปต้องรวมคนของใบ internal
//   8 ฟอร์ม · เลือก agent บริษัทแล้วไม่เลือกเหตุผล บันทึกไม่ผ่าน
//   9 แท็บ Internal / Company · ตัวเลขตรง และเตือนใบที่ยังไม่ระบุเหตุผล
//  10 ไม่มี error บนหน้า
//
// ⚠ ค่าที่คาดหวังคำนวณเองจาก SB_BOOKINGS / SB_AGENTS ดิบ ๆ ทุกข้อ
//   ไม่ได้เรียก laIsInternalBk / laIsInternalFree มาตอบตัวเอง
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1200 });
const dialogs = [];
page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
await page.waitForTimeout(1500);

/* ══ 1 · market + house agent ═══════════════════════════════════════════ */
const R1 = await page.evaluate(() => {
  const m = (SB_MARKETS || []).find(x => x.id === 'house');
  const a = (SB_AGENTS || []).find(x => x.id === 'a_company');
  /* เอเยนต์บ้านต้องไม่มีเครดิต ไม่มี rate type บังคับ · ไม่งั้นจะถูกจัดอันดับปนกับเอเยนต์จริง */
  return { mkt: m ? { name: m.name, subs: (m.subs || []).length } : null,
           ag: a ? { name: a.name, market: a.market, credit: a.creditLimit, rt: a.rateTypeId || '' } : null,
           nHouseMkt: (SB_AGENTS || []).filter(x => String(x.market || '') === 'house').length };
});
if (!R1.mkt) fail('ไม่มี market House / Company');
else if (!R1.ag) fail('ไม่มี house agent a_company');
else if (R1.ag.market !== 'house') fail('a_company ไม่ได้อยู่ market house · อยู่ ' + R1.ag.market);
else if (R1.ag.credit) fail('a_company มีวงเงินเครดิต ' + R1.ag.credit + ' · บัญชีบ้านไม่ควรมี');
else if (R1.mkt.subs < 3) fail('market house มี sub แค่ ' + R1.mkt.subs + ' อัน · ควรมีสาม (แขก/PR/ราคาพิเศษ)');
else ok('market "' + R1.mkt.name + '" (' + R1.mkt.subs + ' sub) + house agent "' + R1.ag.name +
        '" · ไม่มีเครดิต ไม่ผูก rate type · เอเยนต์ใน market นี้ ' + R1.nHouseMkt + ' ตัว');

/* ══ 2-3 · กฎจับใบของบริษัท และกฎตัดยอด ═════════════════════════════════
   คิดเองจากข้อมูลดิบทั้งหมด แล้วเทียบกับที่ฟังก์ชันตอบ · ต้องตรงกันทุกใบ  */
const R23 = await page.evaluate(() => {
  const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
  const PURP = ['company_guest', 'pr_foc', 'company_special', 'staff_welfare', 'staff_inspection'];
  const agOf = id => (SB_AGENTS || []).find(x => x.id === id) || null;
  /* กฎที่คาดหวัง เขียนใหม่ตรงนี้จากข้อมูลดิบ ไม่ได้เรียกของหน้าจอ */
  const wantInt = b => {
    if (!b) return false;
    if (b.purpose && PURP.indexOf(b.purpose) >= 0) return true;
    if (b.staffId) return true;
    const a = agOf(b.agentId); if (!a) return false;
    const m = String(a.market || '').toLowerCase();
    return m === 'house' || m === 'staff';
  };
  const money = b => acctBookingTotal(b);
  const live = (SB_BOOKINGS || []).filter(b => b && CXL.indexOf(b.status) < 0);
  const missInt = live.filter(b => wantInt(b) !== laIsInternalBk(b)).length;
  const missFree = live.filter(b => (wantInt(b) && money(b) <= 0) !== laIsInternalFree(b)).length;
  /* ใบเก่าที่ไม่มี purpose เลย · ต้องยังจับได้จาก market */
  const oldNoPurpose = live.filter(b => wantInt(b) && !b.purpose);
  const oldSeen = oldNoPurpose.filter(b => laIsInternalBk(b)).length;
  /* ใบของเอเยนต์ปกติที่เป็น ฿0 · ต้องไม่ถูกตัด */
  const agZero = live.filter(b => !wantInt(b) && money(b) <= 0);
  const agZeroWrong = agZero.filter(b => laIsInternalFree(b)).length;
  return { n: live.length, missInt, missFree,
           oldNoPurpose: oldNoPurpose.length, oldSeen,
           agZero: agZero.length, agZeroWrong,
           intFree: live.filter(b => wantInt(b) && money(b) <= 0).length,
           intPaid: live.filter(b => wantInt(b) && money(b) > 0).length };
});
if (R23.missInt) fail('กฎจับใบของบริษัทไม่ตรงกับที่คิดเอง ' + R23.missInt + ' ใบ (จาก ' + R23.n + ')');
else if (!R23.oldNoPurpose) fail('ชุดข้อมูลนี้ไม่มีใบของบริษัทที่ purpose ว่าง · ตรวจข้อนี้ไม่ได้');
else if (R23.oldSeen !== R23.oldNoPurpose)
  fail('ใบเก่าที่ไม่มี purpose จับได้แค่ ' + R23.oldSeen + '/' + R23.oldNoPurpose +
       ' ใบ · ต้องจับได้จาก market ของ agent ด้วย ไม่ใช่พึ่ง purpose อย่างเดียว');
else ok('กฎจับใบของบริษัทตรงกับที่คิดเองครบ ' + R23.n + ' ใบ · ใบเก่าที่ยังไม่มี purpose ' +
        R23.oldNoPurpose + ' ใบก็จับได้จาก market ของ agent');
if (R23.missFree) fail('กฎตัดยอดไม่ตรงกับที่คิดเอง ' + R23.missFree + ' ใบ');
else if (!R23.agZero) fail('ชุดข้อมูลนี้ไม่มีใบเอเยนต์ที่ ฿0 · ตรวจกฎ "ห้ามตัดใบเอเยนต์ ฿0" ไม่ได้');
else if (R23.agZeroWrong)
  fail('ใบของเอเยนต์ปกติที่ ฿0 ถูกตัดออกจากยอดไป ' + R23.agZeroWrong + '/' + R23.agZero +
       ' ใบ · นั่นคือข้อผิดพลาดของข้อมูลที่ต้องมองเห็น ไม่ใช่ทริปฟรี');
else ok('ตัดเฉพาะใบของบริษัทที่ไม่เก็บเงิน (' + R23.intFree + ' ใบ · เก็บเงิน ' + R23.intPaid +
        ' ใบไม่ถูกตัด) · ใบของเอเยนต์ที่ ฿0 อีก ' + R23.agZero + ' ใบยังอยู่ในยอดครบ');

/* ══ ปลูกของให้ครบทุกช่องก่อนวัดหน้าจอ ══════════════════════════════════
   ต้องมีทั้งใบบริษัทที่ฟรีและที่เก็บเงิน บนวันเดียวกัน จะได้เห็นว่าตัดแค่ใบฟรี */
const SETUP = await page.evaluate(() => {
  const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
  const day = (typeof bkV2LocalYMD === 'function') ? bkV2LocalYMD(new Date())
                                                   : new Date().toISOString().slice(0, 10);
  /* เอาใบจริงสองใบมาแปลงเป็นใบบริษัท · ไม่สร้างใบใหม่ เพื่อให้ trips/pax เป็นของจริง */
  /* ห้ามหยิบใบที่ id ขึ้นต้น b2c_ · laIsB2C ตัดสินจาก id ก่อน จะไปอยู่ฝั่ง B2C แทน */
  const pick = (SB_BOOKINGS || []).filter(b => b && CXL.indexOf(b.status) < 0
    && (b.trips || []).length && b.agentId && b.agentId !== 'a_staff' && b.agentId !== 'a_company'
    && String(b.id || '').indexOf('b2c_') !== 0);
  if (pick.length < 2) return { err: 'ข้อมูลไม่พอ' };
  const A = pick[0], B = pick[1];
  const seed = (b, purpose, total) => {
    b.agentId = 'a_company';
    b.purpose = purpose;
    b.companyPurpose = purpose;
    b.priceMode = 'manual';
    b.manualTotal = total;
    /* เงินที่ระบบใช้จริงอยู่ที่ bk.total (หรือ priceBreakdown.total) ไม่ใช่ manualTotal
       manualTotal เป็นแค่ช่องกรอกในฟอร์ม · ตอนบันทึกมันถูกคิดผ่าน quote แล้วลง total */
    b.total = total;
    if (b.priceBreakdown) b.priceBreakdown.total = total;
    b.feeItems = [];
    b.invoiceId = null;
    /* วันที่เข้าระบบต้องเป็นวันที่หน้า Dashboard กำลังดูอยู่ ไม่งั้นหัวฟีดไม่นับ */
    b.bookingDate = day;
    b.createdAt = day + 'T09:00:00';
    /* §liveDay · หัวฟีดอ่าน "วันที่เข้าระบบ" จาก history รายการ Created ตัวแรกที่เจอ
       ต่อท้ายเฉย ๆ ไม่มีผล เพราะตัวเดิมยังอยู่ข้างหน้า · ต้องเขียนทับ */
    b.history = [{ tag: 'Created', at: day + 'T09:00:00' }];
    return b.id;
  };
  const freeId = seed(A, 'pr_foc', 0);
  const paidId = seed(B, 'company_special', 4500);
  window._dashDate = day;
  return { day, freeId, paidId,
           freeMoney: acctBookingTotal(A), paidMoney: acctBookingTotal(B),
           freePax: (A.trips || []).reduce((s, t) => s + bkV2PaxAllTot(t.pax || {}), 0),
           freeRoute: (A.trips || [])[0] ? (A.trips || [])[0].routeId : '',
           freeDate: (A.trips || [])[0] ? (A.trips || [])[0].date : '' };
});
if (SETUP.err) fail(SETUP.err);

/* ══ 4 · หัวฟีด Live bookings ═══════════════════════════════════════════ */
if (!SETUP.err) {
  await page.evaluate(() => { const e = document.querySelector('.nav-item[data-view="dashboard"]'); if (e) nav(e); });
  await page.waitForTimeout(1100);
  const R4 = await page.evaluate(([day, freeId, paidId]) => {
    /* ยอดที่ควรได้ · คิดเองจากใบที่เข้าระบบวันนั้น โดยไม่นับใบบริษัทที่ ฿0 */
    const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
    const PURP = ['company_guest', 'pr_foc', 'company_special', 'staff_welfare', 'staff_inspection'];
    const agOf = id => (SB_AGENTS || []).find(x => x.id === id) || null;
    const wantInt = b => { if (b.purpose && PURP.indexOf(b.purpose) >= 0) return true;
      if (b.staffId) return true; const a = agOf(b.agentId); if (!a) return false;
      const m = String(a.market || '').toLowerCase(); return m === 'house' || m === 'staff'; };
    const dayOf = b => { const h = (b.history || []).find(e => e.tag === 'Created' || e.kind === 'created');
      const iso = (h && h.at) || b.createdAt || (b.bookingDate ? b.bookingDate + 'T12:00:00' : '');
      return iso ? String(iso).slice(0, 10) : ''; };
    let n = 0, val = 0, cut = 0;
    (SB_BOOKINGS || []).forEach(b => {
      if (!b || b.schemaVer !== 2 || CXL.indexOf(b.status) >= 0) return;
      if (laIsB2C(b)) return;                       /* ฝั่ง B2B */
      if (dayOf(b) !== day) return;
      const m = acctBookingTotal(b);
      if (wantInt(b) && m <= 0) { cut++; return; }
      n++; val += m;
    });
    const host = document.getElementById('view-dashboard');
    const txt = host ? host.innerText : '';
    /* อ่านค่าจากหัวฟีด B2B บนจอ */
    const heads = [].slice.call(document.querySelectorAll('.dv-lvhd'));
    const readHead = h => { const out = {}; [].slice.call(h.querySelectorAll('.s')).forEach(s => {
        const i = s.querySelector('i'), b = s.querySelector('b');
        if (i && b) out[(i.textContent || '').trim()] = (b.textContent || '').trim(); }); return out; };
    return { want: { n, val: Math.round(val), cut },
             heads: heads.map(readHead),
             rowFree: txt.indexOf(freeId) >= 0, nHead: heads.length };
  }, [SETUP.day, SETUP.freeId, SETUP.paidId]);
  /* หัวฟีดมีสองใบ (B2B / B2C) · เอาใบที่ตัวเลข "ไม่นับยอด" โผล่ */
  const withCut = R4.heads.filter(h => Object.keys(h).some(k => /ไม่นับยอด|not in revenue/.test(k)));
  if (!R4.nHead) fail('ไม่เจอหัวฟีด Live bookings บนหน้า Dashboard');
  else if (!R4.want.cut) fail('วันที่ทดสอบไม่มีใบบริษัทที่ ฿0 · ปลูกไม่ติด');
  else if (!withCut.length)
    fail('หัวฟีดไม่บอกว่าตัดใบไปกี่ใบ · เลขบนหัวจะขัดกับแถวที่เห็นข้างล่างโดยที่คนอ่านไม่รู้ตัว');
  else {
    const h = withCut[0];
    const nOnScreen = Number(String(h['ใบวันนี้'] || h['today'] || '').replace(/[^0-9]/g, ''));
    const cutOnScreen = Number(String(Object.keys(h).filter(k => /ไม่นับยอด|not in revenue/.test(k))
      .map(k => h[k])[0] || '').replace(/[^0-9]/g, ''));
    if (nOnScreen !== R4.want.n)
      fail('หัวฟีดขึ้นจำนวนใบ ' + nOnScreen + ' · คิดเองได้ ' + R4.want.n + ' (ตัดใบบริษัทฟรีแล้ว)');
    else if (cutOnScreen !== R4.want.cut)
      fail('หัวฟีดบอกว่าตัด ' + cutOnScreen + ' ใบ · คิดเองได้ ' + R4.want.cut);
    else ok('หัวฟีด Live bookings นับ ' + nOnScreen + ' ใบ (ตรงกับที่คิดเอง) · ตัดใบบริษัทที่ไม่เก็บเงิน ' +
            cutOnScreen + ' ใบและบอกไว้บนจอ · แถวของใบที่ถูกตัดยังอยู่ในรายการ');
  }
}

/* ══ 5 · ป๊อปอัปรายละเอียดทั้งวัน ════════════════════════════════════════ */
if (!SETUP.err) {
  await page.evaluate(() => dashOpenDayDetail('b2b'));
  await page.waitForTimeout(1000);
  const R5 = await page.evaluate(freeId => {
    const rows = (typeof _ddRows === 'function') ? _ddRows() : [];
    const mine = rows.filter(r => r.id === freeId);
    const S = (typeof _ddSum === 'function') ? _ddSum(rows, 'b2b') : null;
    /* ยอดที่ควรได้ของฝั่ง b2b · คิดจากแถวเอง ไม่เรียก _ddSum มาตอบ */
    const okRows = rows.filter(r => r.side === 'b2b' && !r.cxl && !r.intFree);
    const wantN = okRows.length, wantVal = Math.round(okRows.reduce((a, r) => a + r.val, 0));
    const host = document.getElementById('dv-ddov');
    const txt = host ? host.innerText : '';
    /* ตารางในป๊อปอัปแสดง "เลข voucher" ไม่ใช่ id ของใบ · หาด้วย voucher
       (ตัดท้ายเมื่อยาวเกิน 16 ตัว จึงเทียบแค่ 15 ตัวแรก เหมือนที่หน้าจอทำ) */
    const bkRec = (SB_BOOKINGS || []).find(b => b && b.id === freeId) || {};
    const vc = String(bkRec.voucherRef || bkRec.code || bkRec.id || '');
    const vcShort = vc.length > 16 ? vc.slice(0, 15) : vc;
    return { flagged: mine.length ? !!mine[0].intFree : null,
             lbl: mine.length ? (mine[0].intLbl || '') : '',
             sumN: S ? S.n : null, sumVal: S ? Math.round(S.val) : null, sumFree: S ? S.free : null,
             wantN, wantVal, vc: vcShort,
             onScreen: !!vcShort && txt.indexOf(vcShort) >= 0,
             /* ต้องดูที่ตัวป้ายเอง ไม่ใช่หาคำในข้อความทั้งก้อน · คำว่า company
                โผล่อยู่แล้วในชื่อเอเยนต์ "Love Andaman · Company" ถ้าหาแบบนั้น
                ถอดป้ายออกก็ยังผ่าน (ลองแล้วผ่านจริง · ปุ่ม popnobadge ไม่กัด) */
             badge: host ? host.querySelectorAll('.dv-ddrow .ddint').length : 0 };
  }, SETUP.freeId);
  if (R5.flagged === null) fail('ไม่เจอใบที่ปลูกไว้ในแถวของป๊อปอัป');
  else if (!R5.flagged) fail('แถวของใบบริษัทที่ ฿0 ไม่ได้ติดธง intFree');
  else if (R5.sumN !== R5.wantN)
    fail('ตัวสรุปในป๊อปอัปนับ ' + R5.sumN + ' ใบ · คิดเองจากแถวได้ ' + R5.wantN);
  else if (R5.sumVal !== R5.wantVal)
    fail('ยอดในป๊อปอัป ' + R5.sumVal + ' · คิดเองจากแถวได้ ' + R5.wantVal);
  else if (!R5.sumFree) fail('ตัวสรุปไม่ได้บอกจำนวนใบที่ถูกตัด (S.free = ' + R5.sumFree + ')');
  else if (!R5.onScreen)
    fail('ใบบริษัทที่ ฿0 หายไปจากตารางในป๊อปอัป · ต้องเห็นใบได้ แค่ไม่ถูกนับเป็นยอด');
  else if (!R5.badge) fail('แถวของใบที่ถูกตัดไม่มีป้ายบอกเหตุผล · คนจะคิดว่าระบบคิดเงินพลาด');
  else ok('ป๊อปอัป · ยอด/จำนวนใบไม่นับใบบริษัทฟรี (' + R5.sumN + ' ใบ · ' + R5.sumVal +
          ' ตรงกับที่คิดเองจากแถว) · ตัดไป ' + R5.sumFree + ' ใบและบอกไว้ · แถวยังอยู่ พร้อมป้าย "' + R5.lbl + '"');
  await page.evaluate(() => dashDayDetailClose());
  await page.waitForTimeout(300);
}

/* ══ 6 · Demand · แท็บ Sales / Agents ════════════════════════════════════ */
if (!SETUP.err) {
  /* ⚠ ห้ามตรวจแค่ว่าโค้ดมีคำว่า skipFree · ลองแล้วเปลี่ยนเป็น b=>false ก็ยังผ่าน
     ต้องวัดตัวเลขที่ออกมาบนการ์ด KPI จริง · "N bookings" เป็นเลขตรง ๆ เทียบได้    */
  const R6 = await page.evaluate(() => {
    const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
    const PURP = ['company_guest', 'pr_foc', 'company_special', 'staff_welfare', 'staff_inspection'];
    const agOf = id => (SB_AGENTS || []).find(x => x.id === id) || null;
    const wantInt = b => { if (b.purpose && PURP.indexOf(b.purpose) >= 0) return true;
      if (b.staffId) return true; const a = agOf(b.agentId); if (!a) return false;
      const m = String(a.market || '').toLowerCase(); return m === 'house' || m === 'staff'; };
    /* จำนวนใบที่แท็บ Sales ควรนับ · ไม่เอา rejected ไม่เอายกเลิก ไม่เอาใบบริษัทฟรี */
    let want = 0, cut = 0;
    (SB_BOOKINGS || []).forEach(b => {
      if (!b || b.status === 'rejected') return;
      if (wantInt(b) && acctBookingTotal(b) <= 0) { cut++; return; }
      if (CXL.indexOf(b.status) >= 0) return;
      want++;
    });
    let html = '';
    try { html = (typeof mdTabSales === 'function') ? String(mdTabSales(365) || '') : '(no fn)'; }
    catch (e) { html = 'ERR ' + e.message; }
    const m = html.match(/([\d,]+) bookings/);
    return { want, cut, onScreen: m ? Number(m[1].replace(/,/g, '')) : null,
             /* เอเยนต์บ้าน a_staff มีแต่ใบฟรี · ถ้าตัดจริง มันต้องไม่มีแถวในอันดับเอเยนต์
                วัดแบบนี้ได้เพราะมันขึ้นกับ skipFree ตรง ๆ · เช็คแค่ว่า "วาดได้" ไม่พอ
                (ลองแล้ว · ปิด skipFree ทิ้งก็ยังวาดได้ ปุ่ม demagents จึงไม่กัด) */
             agents: (function(){ try {
               const h = String(mdTabAgents(365) || '');
               const sa = (SB_AGENTS || []).find(x => x.id === 'a_staff');
               const nm = sa ? (sa.name || sa.code || sa.id) : '';
               const anyPaid = (SB_BOOKINGS || []).some(b => b && b.agentId === 'a_staff'
                 && CXL.indexOf(b.status) < 0 && acctBookingTotal(b) > 0);
               return { ok: h.length > 200, nm: nm, listed: !!nm && h.indexOf(nm) >= 0, anyPaid };
             } catch (e) { return { ok: false, err: String(e.message || e) }; } })() };
  });
  if (R6.onScreen === null) fail('อ่านจำนวนใบจากการ์ด KPI ของแท็บ Sales ไม่ได้');
  else if (!R6.cut) fail('ไม่มีใบบริษัทฟรีในชุดข้อมูล · ตรวจข้อนี้ไม่ได้');
  else if (R6.onScreen !== R6.want)
    fail('แท็บ Sales ขึ้น ' + R6.onScreen + ' bookings · คิดเองได้ ' + R6.want +
         ' (ตัดใบบริษัทฟรี ' + R6.cut + ' ใบแล้ว) · แปลว่ายังนับใบฟรีอยู่');
  else if (!R6.agents || !R6.agents.ok) fail('เรียกแท็บ Agents ไม่ได้ · ' + JSON.stringify(R6.agents));
  else if (!R6.agents.nm) fail('ไม่มีเอเยนต์บ้าน a_staff ในชุดข้อมูล · ตรวจแท็บ Agents ไม่ได้');
  else if (R6.agents.anyPaid)
    fail('a_staff มีใบที่เก็บเงินอยู่ · ใช้ตรวจ "เอเยนต์ที่มีแต่ใบฟรีต้องไม่โผล่" ไม่ได้');
  else if (R6.agents.listed)
    fail('แท็บ Agents ยังจัดอันดับ "' + R6.agents.nm + '" ซึ่งมีแต่ใบฟรี · แปลว่ายังไม่ตัด');
  else ok('Demand · แท็บ Sales นับ ' + R6.onScreen + ' ใบตรงกับที่คิดเอง (ตัดใบบริษัทฟรี ' +
          R6.cut + ' ใบ) · แท็บ Agents ไม่จัดอันดับ "' + R6.agents.nm + '" ที่มีแต่ใบฟรี');
}

/* ══ 7 · ที่นั่งยังนับตามปกติ ════════════════════════════════════════════
   ใบฟรีไม่ใช่ยอดขาย แต่คนขึ้นเรือจริง · ถ้าที่นั่งหายไปด้วย เรือจะขายเกิน  */
if (!SETUP.err && SETUP.freeRoute && SETUP.freeDate) {
  const R7 = await page.evaluate(([rid, date, freeId]) => {
    const used = (typeof getSeatsConsumed === 'function') ? getSeatsConsumed(rid, date) : null;
    /* คิดเองจากใบทุกใบบนทริปนั้น รวมใบบริษัท */
    const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
    let want = 0, mine = 0;
    (SB_BOOKINGS || []).forEach(b => {
      if (!b || CXL.indexOf(b.status) >= 0) return;
      (b.trips || []).forEach(t => {
        if (!t || t.routeId !== rid || t.date !== date) return;
        const px = bkV2PaxAllTot(t.pax || {});
        want += px;
        if (b.id === freeId) mine += px;
      });
    });
    return { used, want, mine };
  }, [SETUP.freeRoute, SETUP.freeDate, SETUP.freeId]);
  if (R7.used === null) fail('เรียก getSeatsConsumed ไม่ได้');
  else if (!R7.mine) fail('ใบที่ปลูกไว้ไม่ได้อยู่บนทริปที่ตรวจ · ตรวจข้อนี้ไม่ได้');
  else if (R7.used !== R7.want)
    fail('ที่นั่งที่ใช้ไปของทริป ' + R7.used + ' · คิดเองจากทุกใบได้ ' + R7.want +
         ' (รวมคนของใบบริษัท ' + R7.mine + ' ที่นั่ง) · ต่างกัน ' + (R7.want - R7.used) +
         ' ที่นั่ง แปลว่าใบฟรีถูกตัดออกจากที่นั่งด้วย เรือจะขายเกิน');
  else ok('ที่นั่งยังนับทุกใบ · ทริปที่ตรวจใช้ไป ' + R7.used + ' ที่นั่ง ตรงกับผลรวมที่คิดเองเป๊ะ ' +
          'รวมคนของใบบริษัท ' + R7.mine + ' ที่นั่ง (ยอดขายไม่นับ แต่ที่นั่งนับ)');
}

/* ══ 8 · ฟอร์ม · ไม่เลือกเหตุผล = บันทึกไม่ได้ ═══════════════════════════ */
const R8 = await page.evaluate(() => {
  if (typeof bkV2SubmitBooking !== 'function') return { err: 'ไม่มี bkV2SubmitBooking' };
  const before = (SB_BOOKINGS || []).length;
  _bkV2.newBooking = { agentId: 'a_company', leadPax: 'ทดสอบ เหตุผลว่าง', bookingDate: '2026-10-01',
    priceMode: 'manual', manualTotal: 0, companyPurpose: '', trips: [], pax: {} };
  _bkV2.editingId = null;
  try { bkV2SubmitBooking(); } catch (e) { return { threw: String(e.message || e), before, after: (SB_BOOKINGS || []).length }; }
  return { before, after: (SB_BOOKINGS || []).length };
});
await page.waitForTimeout(400);
const askedReason = dialogs.some(m => /reason|เหตุผล/i.test(String(m)));
if (R8.err) fail(R8.err);
else if (R8.after > R8.before) fail('บันทึกใบบริษัทที่ไม่เลือกเหตุผลผ่านไปได้ · รายงานจะว่างเปล่าเหมือนทริปพนักงาน');
else if (!askedReason)
  fail('ไม่บันทึกให้ แต่ก็ไม่บอกว่าเพราะอะไร · ข้อความที่ขึ้น: ' + JSON.stringify(dialogs.slice(-3)));
else ok('เลือก agent บริษัทแล้วไม่เลือกเหตุผล · บันทึกไม่ผ่านและบอกเหตุผลให้ (จำนวนใบไม่เพิ่ม)');

/* ══ 9 · แท็บ Internal / Company ═════════════════════════════════════════ */
const R9 = await page.evaluate(() => {
  const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
  const PURP = ['company_guest', 'pr_foc', 'company_special', 'staff_welfare', 'staff_inspection'];
  const agOf = id => (SB_AGENTS || []).find(x => x.id === id) || null;
  const wantInt = b => { if (b.purpose && PURP.indexOf(b.purpose) >= 0) return true;
    if (b.staffId) return true; const a = agOf(b.agentId); if (!a) return false;
    const m = String(a.market || '').toLowerCase(); return m === 'house' || m === 'staff'; };
  /* ปีที่มีใบของบริษัทมากสุด */
  const yc = {};
  (SB_BOOKINGS || []).forEach(b => { if (!b || CXL.indexOf(b.status) >= 0 || !wantInt(b)) return;
    (b.trips || []).forEach(t => { const y = String((t && t.date) || '').slice(0, 4); if (y) yc[y] = (yc[y] || 0) + 1; }); });
  const yr = Object.keys(yc).sort((a, b) => yc[b] - yc[a])[0];
  if (!yr) return { err: 'ชุดข้อมูลนี้ไม่มีใบของบริษัทเลย' };
  /* คาดหวัง · คิดเองจากข้อมูลดิบ */
  let bk = new Set(), pax = 0, free = 0, paid = 0, money = 0, unset = 0;
  (SB_BOOKINGS || []).forEach(b => {
    if (!b || CXL.indexOf(b.status) >= 0 || !wantInt(b)) return;
    const trs = (b.trips || []).filter(t => t && t.date && String(t.date).slice(0, 4) === yr);
    if (!trs.length) return;
    bk.add(b.id);
    trs.forEach(t => { pax += bkV2PaxAllTot(t.pax || {}); });
    const m = acctBookingTotal(b);
    if (m <= 0) free++; else { paid++; money += m; }
    if (!(b.purpose && PURP.indexOf(b.purpose) >= 0)) unset++;
  });
  _staffYear = +yr; _staffTab = 'internal';
  const el = document.querySelector('.nav-item[data-view="staff"]'); if (el) nav(el);
  if (typeof renderStaff === 'function') renderStaff();
  const host = document.getElementById('staff-host');
  const txt = host ? host.innerText : '';
  const num = re => { const m = txt.match(re); return m ? Number(String(m[1]).replace(/,/g, '')) : null; };
  return { yr, want: { bk: bk.size, pax, free, paid, money: Math.round(money), unset },
           tab: txt.indexOf('Internal / Company') >= 0,
           /* ต้องชี้ที่กล่องเตือน ไม่ใช่หาคำในข้อความทั้งก้อน · ป้ายบนแถวเขียนว่า
              "ของบริษัท (ยังไม่ระบุเหตุผล)" อยู่แล้ว ถ้าหาแบบนั้นถอดกล่องออกก็ยังผ่าน */
           warnShown: !!(host && host.querySelector('.laint-warn')),
           rows: (typeof laInternalRows === 'function') ? laInternalRows(+yr).length : null,
           txtLen: txt.length,
           hasBk: txt.indexOf(String(bk.size)) >= 0,
           hasPax: txt.indexOf(pax + ' ที่นั่ง') >= 0 };
});
if (R9.err) fail(R9.err);
else if (!R9.tab) fail('ไม่เจอแท็บ Internal / Company ในหน้า Staff & Welfare');
else if (!R9.rows) fail('แท็บเปิดได้แต่ laInternalRows คืน 0 แถว');
else if (R9.rows < R9.want.bk)
  fail('แถวในรายงาน ' + R9.rows + ' น้อยกว่าจำนวนใบ ' + R9.want.bk + ' · หายไประหว่างทาง');
else if (!R9.hasPax)
  fail('รายงานไม่ได้ขึ้นจำนวนที่นั่ง ' + R9.want.pax + ' ที่นั่งตามที่คิดเองจาก SB_BOOKINGS');
else if (R9.want.unset && !R9.warnShown)
  fail('มีใบที่ยังไม่ระบุเหตุผล ' + R9.want.unset + ' ใบ แต่รายงานไม่เตือน · นี่คือของที่ต้องไปเติม');
else ok('แท็บ Internal / Company ปี ' + R9.yr + ' · ' + R9.want.bk + ' ใบ · ' + R9.want.pax +
        ' ที่นั่ง · ฟรี ' + R9.want.free + ' เก็บเงิน ' + R9.want.paid +
        ' (฿' + R9.want.money.toLocaleString() + ') ตรงกับที่คิดเองจากข้อมูลดิบ' +
        (R9.want.unset ? ' · เตือนใบที่ยังไม่ระบุเหตุผล ' + R9.want.unset + ' ใบ' : ''));

/* ══ 10 · ไม่มี error บนหน้า ═════════════════════════════════════════════ */
const errs = (errors || []).filter(e => !/favicon|fonts\.googleapis|cdnjs|ERR_TUNNEL|404/i.test(String(e)));
if (errs.length) fail('มี error บนหน้า ' + errs.length + ' ตัว · ' + String(errs[0]).slice(0, 160));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
