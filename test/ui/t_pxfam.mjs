// §pxFam · Trip P&L · แยก FAM / FOC (กลุ่มขึ้นฟรี) เป็นบรรทัดของตัวเอง · NET = เที่ยวขาย + ค่า FAM
//
// ที่มา (2026-10-25) · owner "ช่วยตรวจ Trip P&L ทำไมบางเส้นทางมันยังขาดทุน"
//   → ส่วนใหญ่มาจากใบ FAM / Inspection ที่ลงทุกคนเป็น FOC (฿0) · owner "FAM trip มันก็คือค่าใช้จ่ายไหม" → แยกบรรทัด ไม่มีปุ่มซ่อน
// ข้อมูลทดสอบ: เมื่อวาน (D) · เรือ X: ใบจ่ายเงิน 20 คน + ใบ FAM 10 คน (FOC ทั้งใบ) + ใบ ฿0 ไม่ลง FOC 2 คน + ใบจ่ายเงินมี FOC 1 คน
//              เรือ Y: ใบ FAM 8 คนทั้งลำ
// กัน
//   1 pxPax: X fam = 10 (ไม่นับใบ ฿0 ที่ไม่ลง FOC / FOC 1 คนในใบจ่ายเงิน) · zeroL 1 ใบ · Y fam = 8 ทั้งลำ
//   2 pxTrip X: 0 < ค่า FAM < ต้นทุนทั้งลำ · บรรทัดคงที่ (น้ำมัน) ไม่เข้าค่า FAM · saleProfit = profit + ค่า FAM
//     Y: FAM ทั้งลำ = ต้นทุนทั้งเที่ยว · saleProfit = 0 + รายได้
//   3 Daily: การ์ด Net มี Sales + FAM · ตารางมี "of which Sales / FAM" · ป้าย FAM บนแถว · กล่อง FAM + กล่องเตือน ฿0 ในการ์ดเรือ · ป้ายหัว "check price"
//   4 Monthly: กล่อง Sales vs FAM · Sales + FAM = Net ของเดือน · ตารางเส้นทางมีคอลัมน์ Sales / FAM · Day by day มีป้าย FAM
//   5 วันที่ไม่มี FAM: ไม่มีคอลัมน์เพิ่ม ไม่มีกล่อง · ไม่มี error
//   6 (§pxFamHide · owner "ให้สามารถซ่อนได้") กด Hide FAM → Daily ไม่มีคอลัมน์/กล่อง/ป้าย FAM แต่เตือน ฿0 ยังอยู่ · Net เท่าเดิม
//     Monthly เหลือแถบเล็ก + ปุ่ม Show · ตารางเส้นทางไม่มีคอลัมน์ FAM · จำค่าไว้ (localStorage) · กด Show กลับมาครบ
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1800, height: 1100 });
await page.waitForTimeout(400);
const S = await page.evaluate(() => {
  const T = new Date(); T.setDate(T.getDate() - 1); const D = bkV2LocalYMD(T);
  const T2 = new Date(); T2.setDate(T2.getDate() - 2); const D2 = bkV2LocalYMD(T2);
  const R = 'r10';
  const cand = BOATS.filter(b => b && b.ownership !== 'charter' && !b.retired);
  const X = cand[0], Y = cand[1];
  [D, D2].forEach(d => { TRIPS[d] = {}; for (let i = SB_BOOKINGS.length - 1; i >= 0; i--) if ((SB_BOOKINGS[i].trips || []).some(t => t.date === d)) SB_BOOKINGS.splice(i, 1); });
  TRIPS[D][X.id] = { route: R }; TRIPS[D][Y.id] = { route: R }; TRIPS[D2][X.id] = { route: R };
  const src = SB_BOOKINGS.filter(b => b.status === 'confirmed' && (b.trips || []).length === 1 && b.trips[0].pax && b.schemaVer === 2)[0];
  const ag = SB_AGENTS.filter(a => a && a.id && !/staff|welfare/i.test(a.name || ''));
  let n = 0;
  const mk = (ds, boat, pax, total, foc, agent) => { const b = JSON.parse(JSON.stringify(src)); n++; b.id = 'ZZPF' + n; b.agentId = agent.id; const t = b.trips[0];
    t.date = ds; t.routeId = R; t.bookingMode = 'seat'; delete t.ops; delete t.subtotal; delete t.ovnLeg;
    t.pax = Object.assign({ ad_th: 0, chd_th: 0, inf_th: 0, foc_th: 0, ad_fr: 0, chd_fr: 0, inf_fr: 0, foc_fr: 0, foc: 0 }, pax);
    b.status = 'confirmed'; b.ops = { boatId: boat.id }; b.total = total; b.priceBreakdown = { seat: total, addOn: 0, focDiscount: -(foc || 0), discount: 0, extra: 0, total };
    SB_BOOKINGS.push(b); return b; };
  mk(D, X, { ad_fr: 20 }, 36000, 0, ag[0]);
  mk(D, X, { foc_fr: 10 }, 0, 18000, ag[1]);          /* FAM */
  mk(D, X, { ad_fr: 2 }, 0, 0, ag[2]);                /* ฿0 ไม่ลง FOC → เตือน */
  mk(D, X, { ad_fr: 4, foc_fr: 1 }, 7200, 1800, ag[3]); /* FOC 1 คนในใบจ่ายเงิน → ไม่ใช่ FAM */
  mk(D, Y, { foc_fr: 8 }, 0, 14400, ag[4]);           /* FAM ทั้งลำ */
  mk(D2, X, { ad_fr: 25 }, 45000, 0, ag[0]);          /* วันไม่มี FAM */
  if (typeof pxAggReset === 'function') pxAggReset();
  const pX = pxPax(D, X.id), pY = pxPax(D, Y.id);
  const tX = pxTrip(D, X.id), tY = pxTrip(D, Y.id);
  const fuel = tX.rows.filter(r => ['fuel', 'dep', 'cap', 'crew'].includes(r.id)).reduce((a, r) => a + (+r.use || 0), 0);   /* บรรทัดคงที่ */
  return { D, D2, X: X.id, Y: Y.id, xn: X.name, yn: Y.name,
    pX: { fam: pX.fam, z: pX.zeroL.length, tot: pX.tot, names: pX.famL.map(x => x.name) }, pY: { fam: pY.fam, tot: pY.tot },
    tX: { cost: tX.cost, fc: tX.fam.cost, all: tX.fam.all, profit: tX.profit, sale: tX.saleProfit, fuel, ag1: ag[1].name },
    tY: { cost: tY.cost, fc: tY.fam.cost, all: tY.fam.all, profit: tY.profit, sale: tY.saleProfit, rev: tY.rev } };
});
const { pX, pY, tX, tY } = S;
if (pX.fam === 10 && pX.z === 1 && pX.tot === 37 && pX.names.join() === tX.ag1 && pY.fam === 8 && pY.tot === 8) ok('1 pxPax: ' + S.xn + ' FAM 10 จาก 37 คน (ไม่นับใบ ฿0 ไม่ลง FOC และ FOC 1 คนในใบจ่ายเงิน) · เตือน ฿0 1 ใบ · ' + S.yn + ' FAM 8/8');
else fail('1 ' + JSON.stringify({ pX, pY }));
if (tX.fuel > 0 && tX.fc > 0 && tX.fc <= tX.cost - tX.fuel && !tX.all && tX.sale === tX.profit + tX.fc && tY.all && tY.fc === tY.cost && tY.sale === tY.profit + tY.cost)
  ok('2 pxTrip: ' + S.xn + ' ค่า FAM ' + tX.fc + ' จากต้นทุน ' + tX.cost + ' (บรรทัดคงที่ น้ำมัน/ค่าเสื่อม/กัปตัน/เด็กเรือ ' + tX.fuel + ' ไม่เข้า) · sale = profit + FAM · ' + S.yn + ' FAM ทั้งลำ = ต้นทุนทั้งเที่ยว ' + tY.cost);
else fail('2 ' + JSON.stringify({ tX, tY }));

await goView(page, 'trippl', 900);
const R3 = await page.evaluate(S => { _px.date = S.D; _px.tab = 'd'; _px.pier = ''; renderTripPL();
  const h = document.getElementById('trippl-host'), txt = h.textContent.replace(/\s+/g, ' ');
  const ths = [...h.querySelectorAll('table.sum thead th')].map(x => x.textContent.trim());
  return { kfam: !!h.querySelector('.kfam'), kfamTxt: (h.querySelector('.kfam') || {}).textContent || '', ths,
    pills: [...h.querySelectorAll('table.sum .pill.pu')].map(x => x.textContent), box: h.querySelectorAll('.pxfam').length, zero: h.querySelectorAll('.pxzero').length,
    chk: /1 booking at ฿0 · check price/.test(txt) }; }, S);
const salesDay = (tX.sale + tY.sale), famDay = tX.fc + tY.fc;
if (R3.kfam && R3.kfamTxt.includes('FAM 18 pax') && R3.ths.includes('of which Sales') && R3.ths.includes('of which FAM') && R3.pills.includes('FAM 10') && R3.pills.includes('FAM 8') && R3.box === 2 && R3.zero === 1 && R3.chk)
  ok('3 Daily: การ์ด Net "' + R3.kfamTxt.replace(/\s+/g, ' ').trim() + '" · ตาราง of which Sales / FAM · ป้าย FAM 10 / FAM 8 · กล่อง FAM 2 ลำ · เตือน ฿0 + ป้ายหัว check price');
else fail('3 ' + JSON.stringify(R3));

const R4 = await page.evaluate(S => { _px.tab = 'm'; _px.mon = S.D.slice(0, 7); renderTripPL();
  const h = document.getElementById('trippl-host'); const box = h.querySelector('.pxfamm');
  const num = el => { const t = (el && el.textContent || '').replace(/[^\d−+-]/g, '').replace('−', '-'); return +t; };
  const fl = box ? [...box.querySelectorAll('.fpl .fl > span')].map(num) : [];
  let ths = []; h.querySelectorAll('table.sum').forEach(t => { const a = [...t.querySelectorAll('thead th')].map(x => x.textContent.trim()); if (a.includes('Route')) ths = a; });
  const dayFam = [...h.querySelectorAll('table.sum tbody tr')].some(tr => /FAM \d+/.test(tr.textContent));
  return { has: !!box, fl, ths, dayFam, agents: box ? box.querySelectorAll('tbody tr').length : 0 }; }, S);
if (R4.has && R4.fl.length === 3 && Math.abs(R4.fl[0] + R4.fl[1] - R4.fl[2]) <= 2 && R4.ths.includes('Sales') && R4.ths.includes('FAM') && R4.dayFam && R4.agents >= 2)
  ok('4 Monthly: Sales ' + R4.fl[0] + ' + FAM ' + R4.fl[1] + ' = Net ' + R4.fl[2] + ' · ตารางเส้นทางมี Sales / FAM · Day by day มีป้าย FAM · FAM by agent ' + R4.agents + ' แถว');
else fail('4 ' + JSON.stringify(R4));

const R5 = await page.evaluate(S => { _px.date = S.D2; _px.tab = 'd'; renderTripPL();
  const h = document.getElementById('trippl-host');
  return { kfam: !!h.querySelector('.kfam'), ths: [...h.querySelectorAll('table.sum thead th')].map(x => x.textContent.trim()), box: h.querySelectorAll('.pxfam,.pxzero').length }; }, S);
if (!R5.kfam && !R5.ths.includes('of which FAM') && R5.box === 0 && errors.length === 0) ok('5 วันไม่มี FAM: ไม่มีคอลัมน์ / กล่องเพิ่ม · ไม่มี error');
else fail('5 ' + JSON.stringify({ R5, errors: errors.slice(0, 3) }));

/* ══ 6 · §pxFamHide ══ */
const snap = () => page.evaluate(() => { const h = document.getElementById('trippl-host');
  let rt = []; h.querySelectorAll('table.sum').forEach(t => { const a = [...t.querySelectorAll('thead th')].map(x => x.textContent.trim()); if (a.includes('Route')) rt = a; });
  return { kfam: !!h.querySelector('.kfam'), ths: [...h.querySelectorAll('table.sum thead th')].map(x => x.textContent.trim()), box: h.querySelectorAll('.pxfam').length,
    zero: h.querySelectorAll('.pxzero').length, pills: [...h.querySelectorAll('table.sum .pill.pu')].length, tg: ((h.querySelector('.pxfamtg') || {}).textContent || ''),
    net: ((h.querySelector('.pnet b') || {}).textContent || ''), mini: !!h.querySelector('.pxfammini'), full: !!h.querySelector('.pxfamm'), rt }; });
await page.evaluate(S => { _px.date = S.D; _px.tab = 'd'; renderTripPL(); }, S);
const d0 = await snap();
await page.evaluate(() => document.querySelector('#trippl-host .pxfamtg').click());
const d1 = await snap(); const ls1 = await page.evaluate(() => localStorage.getItem('la_px_famhide'));
await page.evaluate(S => { _px.tab = 'm'; _px.mon = S.D.slice(0, 7); renderTripPL(); }, S);
const m1 = await snap();
await page.evaluate(() => document.querySelector('#trippl-host .pxfammini .pxfamtg').click());
const m2 = await snap();
const okD = d0.box === 2 && /Hide FAM/.test(d0.tg) && !d1.kfam && !d1.ths.includes('of which FAM') && d1.box === 0 && d1.pills === 0 && d1.zero === 1 && d1.net === d0.net && /Show FAM/.test(d1.tg) && ls1 === '1';
const okM = m1.mini && !m1.full && !m1.rt.includes('FAM') && m2.full && !m2.mini && m2.rt.includes('FAM');
if (okD && okM && errors.length === 0) ok('6 Hide FAM: Daily ไม่มีคอลัมน์/กล่อง/ป้าย FAM · เตือน ฿0 ยังอยู่ · Net ' + d1.net + ' เท่าเดิม · จำไว้ · Monthly เหลือแถบเล็ก → กด Show กลับมาครบ');
else fail('6 ' + JSON.stringify({ d0: { box: d0.box, tg: d0.tg, net: d0.net }, d1, ls1, m1: { mini: m1.mini, full: m1.full, rt: m1.rt }, m2: { mini: m2.mini, full: m2.full, rt: m2.rt }, errors: errors.slice(0, 3) }));
await close();
if (bad) { console.log(bad + ' FAILED'); process.exit(1); } console.log('ALL OK');
