// §pkLostType · ค่าอุทยาน · หักคนที่ไม่ได้ไปตามประเภทที่หน้าท่าบันทึก ไม่เฉลี่ยทุกช่อง
//
// ที่มา (2026-10-04) · ผู้ใช้ส่งภาพหน้า เงินสดย่อย → ค่าอุทยาน "ยอดคนไทยผิด ไม่มี INF"
//   Hermetis 4 ต.ค. · ใบ BK-26090494 จอง ผญ ไทย 2 · เด็กไทย 2 · INF ไทย 1 (5 คน)
//   หน้าท่ายกเลิก INF 1 คน · paxBreak บันทึกชัดว่า inf:1 · ขึ้นเรือจริง 4
//   pcPax เอา 4/5 คูณทุกช่อง → 1.6 / 1.6 / 0.8 → ปัดแล้ว INF ที่ยกเลิกไปยังโผล่ 1 คน
//   ฝั่งเขียวขึ้น ไทย 15/4/1 (20 คน) · ของจริงคือ 15/4/0 (19 คน) ตรงกับที่คนหน้าท่าคีย์เอง
//
// กันเจ็ดอย่าง
//   1 เคสจริง · INF ไทยถูกยกเลิก → ไทย ผญ 2 เด็ก 2 INF 0 · ไม่มี INF ค้าง ผู้ใหญ่/เด็กไม่ถูกเฉือน
//   2 FOC ต่างชาติ 12 ยกเลิก FOC 1 → 11 พอดี · ผญ ต่างชาติ 3 ยกเลิก 1 → 2 พอดี
//   3 ข้อมูลเก่า ไม่มี paxBreak → ยังเฉลี่ยตามสัดส่วนทั้งใบเหมือนเดิม
//   4 บันทึกว่า INF หาย แต่หน้าท่านับขึ้นเรือครบ → เชื่อตัวนับ · INF ยังอยู่
//   5 ประเภทเดียวกันปนสองสัญชาติ หายไม่รู้สัญชาติ → แบ่งตามสัดส่วนในประเภทนั้น · ประเภทอื่นไม่ถูกแตะ
//   6 ยอดรวมทั้งลำ = ผลรวมคนขึ้นเรือจริงทุกใบ
//   7 ไม่มี error บนหน้า
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 900 });

const R = await page.evaluate(() => {
  /* แม่แบบ · ใบทริปเดียว ที่เส้นทางมีท่าเรือ · โคลนแล้วผูกกับเรือปลอม เพื่อให้ pcPax นับเฉพาะใบที่สร้าง */
  const tpl = SB_BOOKINGS.find(b => (b.trips || []).length === 1 && b.trips[0].bookingMode !== 'charter' && !['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)
    && (getRoute(b.trips[0].routeId) || {}).pier && bkIsFirstDay(b, b.trips[0].date));
  if (!tpl) return { err: 'no template' };
  const date = tpl.trips[0].date, pier = getRoute(tpl.trips[0].routeId).pier;
  const mk = (boat, pax, pierCk) => { const b = JSON.parse(JSON.stringify(tpl)); b.id = 'T_' + boat + '_' + Math.random().toString(36).slice(2, 8);
    b.trips[0].pax = pax; delete b.trips[0].nat; delete b.trips[0].charterBoatId;
    b.ops = { boatId: boat, pierCheckin: pierCk || null }; SB_BOOKINGS.push(b); return b; };
  const ev = (pb, n) => ({ type: 'cxl', pax: n || 1, paxBreak: pb, ts: '2026-10-04T08:00:00', at: '08:00' });
  const P = bid => { const X = pcPax(date, bid, pier); return { o: PC_PK.map(k => X[k]), n: PC_PK.map(k => X.n[k]), tot: X.tot, ntot: X.n.tot }; };
  const out = {};
  mk('TB1', { ad_th: 2, chd_th: 2, inf_th: 1 }, { actualPax: 4, at: '08:00', events: [ev({ inf: 1 })] });
  mk('TB1', { ad_th: 13, chd_th: 2 }, null);                       /* ใบอื่นของลำเดียวกัน ไม่มีใครหาย */
  out.c1 = P('TB1');
  mk('TB2', { foc_fr: 12 }, { actualPax: 11, at: '08:00', events: [ev({ foc: 1 })] });
  mk('TB2', { ad_fr: 3 }, { actualPax: 2, at: '08:00', events: [ev({ ad: 1 })] });
  out.c2 = P('TB2');
  mk('TB3', { ad_th: 2, ad_fr: 2 }, { actualPax: 2, at: '08:00', events: [{ type: 'no_show', pax: 2, ts: '2026-10-04T08:00:00' }] });
  out.c3 = P('TB3');
  mk('TB4', { ad_th: 2, chd_th: 2, inf_th: 1 }, { actualPax: 5, at: '08:00', events: [ev({ inf: 1 })] });
  out.c4 = P('TB4');
  mk('TB4b', { ad_th: 4, inf_th: 1 }, { actualPax: 3, at: '08:00', events: [ev({ inf: 1 })] });   /* INF หาย 1 + หายอีก 1 ไม่รู้ประเภท */
  out.c4b = P('TB4b');
  mk('TB5', { ad_th: 1, ad_fr: 3, chd_fr: 4 }, { actualPax: 6, at: '08:00', events: [ev({ ad: 2 }, 2)] });
  out.c5 = P('TB5');
  ['TB1', 'TB2'].forEach(x => SB_BOOKINGS.filter(b => String(b.id).startsWith('T_' + x)).forEach(b => { b.ops.boatId = 'TB6'; }));
  out.c6 = P('TB6');
  return out;
});
if (R.err) { fail(R.err); await close(); process.exit(1); }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
//            ad_th chd_th inf_th foc_th ad_fr chd_fr inf_fr foc_fr
if (eq(R.c1.n, [15, 4, 0, 0, 0, 0, 0, 0]) && eq(R.c1.o, [15, 4, 0, 0, 0, 0, 0, 0]) && R.c1.tot === 19) ok('1 INF ไทยที่หน้าท่ายกเลิก ไม่ถูกนับ · ไทย ผญ 15 เด็ก 4 INF 0 รวม 19 (เดิมขึ้น INF 1 และยอดไทย 20)');
else fail('1 ' + JSON.stringify(R.c1));
if (eq(R.c2.n, [0, 0, 0, 0, 2, 0, 0, 11]) && R.c2.tot === 13) ok('2 FOC ต่างชาติ 12 → 11 · ผญ ต่างชาติ 3 → 2 พอดีตามที่บันทึก');
else fail('2 ' + JSON.stringify(R.c2));
if (eq(R.c3.n, [1, 0, 0, 0, 1, 0, 0, 0]) && R.c3.tot === 2) ok('3 ข้อมูลเก่าไม่มี paxBreak · เฉลี่ยตามสัดส่วนทั้งใบเหมือนเดิม (ไทย 1 ต่างชาติ 1)');
else fail('3 ' + JSON.stringify(R.c3));
if (eq(R.c4.n, [2, 2, 1, 0, 0, 0, 0, 0]) && R.c4.tot === 5 && eq(R.c4b.n, [3, 0, 0, 0, 0, 0, 0, 0]) && R.c4b.tot === 3) ok('4 บันทึกว่า INF หาย แต่หน้าท่านับขึ้นเรือครบ 5 · เชื่อตัวนับ INF ยังอยู่ · นับได้น้อยกว่าที่บันทึก (3 จาก 5) · หัก INF ก่อน ที่เหลือเฉลี่ย');
else fail('4 ' + JSON.stringify([R.c4, R.c4b]));
/* ผญ 4 (ไทย 1 ตปท 3) หาย 2 → เหลือ 2 แบ่ง 0.5 / 1.5 → ปัด 1 / 2 = 3 เกิน 1 → คืนที่ ผญ ตปท → 1 / 1 · เด็ก ตปท 4 ไม่ถูกแตะ */
if (R.c5.n[5] === 4 && R.c5.n[0] + R.c5.n[4] === 2 && R.c5.tot === 6) ok(`5 ผู้ใหญ่ปนสองสัญชาติ หาย 2 → เหลือ 2 (ไทย ${R.c5.n[0]} ตปท ${R.c5.n[4]}) · เด็กต่างชาติ 4 ไม่ถูกเฉือน`);
else fail('5 ' + JSON.stringify(R.c5));
if (R.c6.tot === 32 && R.c6.ntot === 32 && eq(R.c6.n, [15, 4, 0, 0, 2, 0, 0, 11])) ok('6 รวมทั้งลำ 32 = คนขึ้นเรือจริงทุกใบ (4+15+11+2)');
else fail('6 ' + JSON.stringify(R.c6));
const e1 = errors.filter(e => !/Failed to load resource/.test(e));
if (!e1.length) ok('7 ไม่มี error บนหน้า'); else fail('7 ' + e1.slice(0, 3).join(' | '));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
