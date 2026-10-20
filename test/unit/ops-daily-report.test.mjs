// §opsDailyReport · Daily Report = lk-inbox's page, every figure from operation-backend.
//   node --test test/unit/ops-daily-report.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { load, show, textOf, settle, DATE, DAILY } from './dailyreport-harness.mjs';

const na = (html) => (html.match(/data-ops-dr-na="1"/g) || []).length;

test('the overview is the legacy page: frame, five tabs, KPI cards, chart, donut', async () => {
  const h = load();
  const html = await show(h, 'ov');
  const t = textOf(html);
  assert.match(html, /<style id="dr-style">#dailyreport-host\{/, 'legacy drCSS');
  assert.equal((html.match(/class="dr-pill( on)?"/g) || []).length, 5);
  for (const tab of ['ภาพรวม', 'ผู้โดยสาร', 'เรือ', 'รถรับส่ง', 'การเงิน']) assert.ok(t.includes(tab), tab);
  assert.match(t, /Daily Report สรุปก่อนวันเดินทาง/);
  assert.match(t, /‹ วันก่อน วันนี้ วันถัดไป/);
  assert.match(html, /onclick="drPrint\(\)">&#128424; พิมพ์ \/ PDF/);
  assert.match(html, /onclick="drMailShow\(\)">&#9993; ส่งอีเมล/);
  assert.equal((html.match(/class="eg p5 dr-k"/g) || []).length, 4, 'four legacy KPI cards');
  assert.match(t, /ผู้โดยสารทั้งวัน 13 คน ผู้ใหญ่ 9 · เด็ก 2 · ทารก 1 · FOC 1/);
  assert.match(t, /รายได้ทั้งวัน ฿26,000 เฉลี่ย ฿2,000 \/ คน/);
  assert.match(t, /Invoice ฿16k \| PFM ฿6k \| COT ฿4k/);
  assert.match(html, /<svg viewBox="0 0 880 300"/, 'legacy drChart');
  assert.match(html, /class="dr-donut"/);
  assert.match(t, /อื่น ๆ/, 'markets past five fold into legacy "อื่น ๆ"');
  assert.match(t, /เทียบกับ 7 วันก่อน/);
});

test('boat seats come from pier-office passengers and deployment capacity; empty boats are left out', async () => {
  const h = load();
  const t = textOf(await show(h, 'ov'));
  // Artemis 6/5, Okeanos 2/10, Hermetis 5/20; Zeus carries nobody
  assert.match(t, /ที่นั่งเรือที่ใช้ 37.1% เฉลี่ย 13 ที่นั่ง จากความจุ 35 · 3 ลำ/);
  assert.match(t, /เต็มสุด Artemis 120% \| ว่างสุด Okeanos 20%/);
  assert.match(t, /ที่นั่ง 8 \/ 15 · 53.3%/, 'route seats summed from its boats');
  assert.match(t, /เรือเกินความจุ 1 ลำ/);
  assert.ok(!/Zeus/.test(t));
  const bt = textOf(await show(h, 'bt'));
  assert.match(bt, /เรือที่ออกวันนี้ 3 ลำ 2 ท่า/);
  assert.match(bt, /Early Tiger · Tub Lamu \(ย้ายจาก Visit Panwa\) · ออก 06:45/, 'pier of the route, departure from van-board');
  assert.match(bt, /เรือหางยาว 1 ลำเหมา Join 4 คน · ต้นทุนเหมา ฿777/);
});

test('nothing is counted from the browser booking list', async () => {
  const h = load();
  for (const tab of ['ov', 'px', 'bt', 'vn', 'fi']) await show(h, tab);
  assert.equal(h.localReads(), 0, 'drData / tsRows / SB_BOOKINGS untouched');
  assert.deepEqual(h.legacy, [], 'the legacy render never ran');
});

test('figures the server does not give yet are "—", never a guess', async () => {
  const h = load();
  const ov = await show(h, 'ov');
  assert.ok(na(ov) >= 4, 'th / fr / no van / no boat');
  assert.match(textOf(ov), /ไทย — \| ต่างชาติ —/);
  assert.ok(!/ทุกอย่างจัดครบแล้ว/.test(textOf(ov)), 'no "all assigned" claim without the server saying so');
  const px = textOf(await show(h, 'px'));
  assert.match(px, /สัญชาติ — ต่างชาติ/);
  assert.match(px, /อาหารพิเศษ — · แพ้อาหาร —/);
  const vn = textOf(await show(h, 'vn'));
  assert.match(vn, /มาเอง —/);
  assert.match(vn, /ยังไม่จัดรถ — booking/);
});

test('once the server sends the ops block (B16) its figures replace the "—"', async () => {
  const daily = { ...DAILY, pax: { ...DAILY.pax, th: 4, fr: 8, un: 1 },
    ops: { no_boat: { n: 2, pax: 3 }, no_van: { n: 1, pax: 2 }, self_arrive: { n: 1, pax: 4 }, meals: { veg: 1, vegan: 0, halal: 2, allergy: 1 },
      langs: { EN: 9, RU: 4 }, ret: { same: 3, samePax: 7, arr: 1, arrPax: 2, self: 0, selfPax: 0 } } };
  const h = load({ data: { daily } });
  const ov = textOf(await show(h, 'ov'));
  assert.match(ov, /ไทย 4 \| ต่างชาติ 8/);
  assert.match(ov, /ยังไม่จัดรถ 1 booking · 2 คน/);
  assert.match(ov, /ยังไม่จัดเรือ 2 booking · 3 คน/);
  const px = textOf(await show(h, 'px'));
  assert.match(px, /ต้องดูแลพิเศษ 4 รายการ อาหารพิเศษ 3 · แพ้อาหาร 1/);
  assert.match(px, /EN 9 \| RU 4/);
  const vn = textOf(await show(h, 'vn'));
  assert.match(vn, /มาเอง 4 คน/);
  assert.match(vn, /ส่งจุดเดิม · ใช้รถคันเดิม 3 booking · 7 คน/);
});

test('vans: the server van jobs, its van cost per van, returns still to arrange', async () => {
  const h = load();
  const html = await show(h, 'vn');
  const t = textOf(html);
  assert.match(t, /รถที่ใช้วันนี้ 2 คัน ในโควตา 1 · นอกโควตา 1/);
  assert.match(t, /คนที่ใช้รถรับส่ง 11 \/ 13 คน/);
  assert.match(t, /Queen1 van · รถร่วม 30-8678 Ju/);
  assert.match(t, /฿1,500/); assert.match(t, /฿1,900/);
  assert.match(t, /ส่งคนละที่ · ยังไม่จัดรถกลับ 2 booking · 5 คน/);
  assert.match(html, /onchange="drCfgSet\('vanCost',this.value\)"/, 'settings still go through drCfgSet (PUT /v1/reports/daily/settings)');
  assert.ok(h.reads.some(([p]) => p === '/operations/van-jobs'));
});

test('money: channels, routes and agents are the server rows; the net is the server figure', async () => {
  const h = load();
  const t = textOf(await show(h, 'fi'));
  assert.match(t, /Invoice · เครดิต ฿16,000 \(61.5%\)/);
  assert.match(t, /⚠ ยังเก็บไม่ครบ ฿1,234/);
  assert.match(t, /ต้นทุนที่ทราบแล้ว ฿4,177 ค่ารถ ฿3,400 · หางยาว ฿777/);
  assert.match(t, /คงเหลือก่อนต้นทุนเรือ\/ครัว ฿99,999/);
  assert.match(t, /SAYAMA 3 booking Russian Market 7 1 0 0 8 Invoice ฿16,000 — รอตรวจ 1/);
  assert.match(t, /Love Andaman 2 booking b2c 2 1 1 1 5 COT ฿10,000 ฿1,234 ยังไม่แนบ 2/);
  assert.match(t, /2 agent · 5 booking/);
});

test('passenger list: the server roster row by row, cancelled left out, sorted route → agency → voucher', async () => {
  const h = load();
  const t = textOf(await show(h, 'px'));
  assert.match(t, /2 booking · 13 คน/);
  assert.ok(!/V-k3/.test(t), 'cancelled booking not listed');
  assert.ok(t.indexOf('V-k1') < t.indexOf('V-k2'), 'Early Tiger before Phi Phi');
  assert.match(t, /V-k2 LK Lead k2 081 SAYAMA 2 1 0 0 Phi Phi Hotel k2 · 07:00 Airport EN ฮาลาล 2/);
  assert.ok(h.reads.some(([p, q]) => p === '/v1/bookings' && q.service_date === DATE));
});

test('booking-date trend: the server daily-counts, one series', async () => {
  const h = load();
  const t = textOf(await show(h, 'ov', 'booked'));
  assert.match(t, /ยอดที่รับเข้ามา · ตามวันที่ลงบุคกิ้ง · 14 วันย้อนหลัง/);
  assert.match(t, /รับเข้ามาวันนี้ 9 คน/);
  assert.ok(h.reads.some(([p]) => p === '/v1/bookings/daily-counts'));
});

test('a failed read shows the error inside the legacy frame and a toast', async () => {
  const h = load({ data: { fail: (p) => p === '/operations/van-jobs' } });
  const html = await show(h, 'vn');
  assert.match(html, /data-ops-dr-error="1"/);
  assert.match(html, /class="dr-pill/);
  assert.deepEqual(h.fails, ['Daily Report did not load']);
});

test('the e-mail button no longer shows "not available" or opens the legacy browser-built form (see ops-daily-report-mail.test.mjs)', async () => {
  const h = load();
  h.ctx.window.drMailShow();
  assert.deepEqual(h.legacy, []);
  assert.equal(h.toasts.length, 0);
});

test('with laOps off the legacy page renders and nothing is read', async () => {
  const h = load({ enabled: false });
  await h.ctx.window.renderDailyReport(); await settle();
  h.ctx.window.drMailShow();
  assert.deepEqual(h.legacy, ['renderDailyReport', 'drMailShow']);
  assert.equal(h.reads.length, 0);
});

// ── B16 (operation-backend feat/daily-report-ops-block): the report's own ops block ──
const OPS = {
  boats: [
    { boat_id: 'b8', name: 'Tadeo', type: 'Speedboat', pier: 'tublamu', home_pier: 'tublamu', piers: ['tublamu'], moved: false, cap: 38, pax: 39, bookings: 17, routes: { r2: 39 }, dep: '08:00' },
    { boat_id: 'b11', name: 'Achilles', type: 'Speedboat', pier: 'tublamu', home_pier: 'panwa', piers: ['tublamu'], moved: true, cap: 65, pax: 43, bookings: 20, routes: { r10: 43 }, dep: '08:30' },
  ],
  no_boat: { n: 0, pax: 0 },
  vans: [
    { van_id: 'veh2', name: 'Love5', plate: '31-1', capacity: 10, n: 2, pax: 4, first_pickup: '05.20', zone: 'KL', boats: ['b11'] },
    { van_id: 'veh1', name: 'Queen1', plate: '30-8678', capacity: 12, n: 3, pax: 7, first_pickup: '07:15-07:30', zone: 'PK', boats: ['b8', 'b11'] },
  ],
  no_van: { n: 0, pax: 0 }, self_arrive: { n: 0, pax: 0 }, zones: {}, ret: { same: 5, samePax: 13, arr: 0, arrPax: 0, todo: 0, todoPax: 0, self: 0, selfPax: 0 },
  ovn: { n: 0, pax: 0, days: {} }, meals: { veg: 0, vegan: 0, halal: 0, allergy: 0 }, langs: {},
};
const DAILY16 = { ...DAILY, ops: OPS,
  by_route: DAILY.by_route.map((r, i) => ({ ...r, ...(i === 0 ? { ad: 6, chd: 1, inf: 0, foc: 1 } : { ad: 3, chd: 1, inf: 1, foc: 0 }) })),
  van_cost: { ...DAILY.van_cost, default_rate_by_van: ['veh2'] } };

test('B16 boats: the server rows (booked pax, bookings per boat, moved pier); no pier-office join is read', async () => {
  const h = load({ data: { daily: DAILY16 } });
  const bt = textOf(await show(h, 'bt'));
  assert.match(bt, /Tadeo Speedboat Speedboat Tub Lamu 08:00 Early Tiger 17 38 39 -1 102.6%/);
  assert.match(bt, /Achilles Speedboat Speedboat Tub Lamu \(ย้ายจาก Visit Panwa\) 08:30 Phi Phi 20 65 43 22 66.2%/);
  const ov = textOf(await show(h, 'ov'));
  assert.match(ov, /ที่นั่งเรือที่ใช้ 79.6% เฉลี่ย 82 ที่นั่ง จากความจุ 103 · 2 ลำ/);
  assert.match(ov, /สัปดาห์ก่อน 79.6%/, '7 days back reads the booked seats of that day\'s report');
  assert.ok(!h.reads.some(([p]) => /pier-office|deployments|van-board/.test(p)), 'the stand-in join is not read');
});

test('B16 route split, vans in server order with first pickup and boats, no-rate flag', async () => {
  const h = load({ data: { daily: DAILY16 }, extra: { bookingV2ZoneLabel: (z) => ({ PK: 'Phuket', KL: 'Khao Lak' })[z] || z } });
  const px = textOf(await show(h, 'px'));
  assert.match(px, /Early Tiger 8 คน ผู้ใหญ่ 6 · เด็ก 1 · FOC 1 3 booking/);
  assert.match(px, /Phi Phi 5 คน ผู้ใหญ่ 3 · เด็ก 1 · ทารก 1 2 booking/);
  const vn = textOf(await show(h, 'vn'));
  assert.ok(vn.indexOf('Love5') < vn.indexOf('Queen1'), 'the server row order, not van-jobs order');
  assert.match(vn, /Love5 minibus 31-1 — Khao Lak 05.20 2 4 10 40% Achilles ฿1,900 ยังไม่ตั้งเรต/);
  assert.match(vn, /Queen1 van · รถร่วม 30-8678 Ju 098 Phuket 07:15-07:30 3 7 12 58.3% Tadeo Achilles ฿1,500/);
});

test('passenger list: pickup window as staff write it, the final time first; other guide language', async () => {
  const t = (extra) => ({ service_date: DATE_15, route_id: 'r2', pax: { ad_fr: 1 }, pax_total: 1, operations: {}, ...extra });
  const DATE_15 = '2026-10-15';
  const rows = [
    { id: 'p1', voucher_ref: 'A1', status: 'confirmed', agent_id: 'a13', hotel_name: 'H1', trips: [t({ pickup_time: '07:15', pickup_time_end: '07:30' })] },
    { id: 'p2', voucher_ref: 'A2', status: 'confirmed', agent_id: 'a13', hotel_name: 'H2', trips: [t({ pickup_time_end: '08:30', pickup_at_pier: true })] },
    { id: 'p3', voucher_ref: 'A3', status: 'confirmed', agent_id: 'a13', hotel_name: 'H3', guide_other_lang: 'Spanish',
      trips: [t({ pickup_time: '06:00', operations: { pickup_time_final: '06:40', pickup_time_final_end: '06:55' } })] },
    { id: 'p4', status: 'confirmed', agent_id: 'a13', code: 'BK-1', pickup_area: 'Tub Lamu Pier (self-arrive)', trips: [t({ pickup_time: '07:00' })] },
  ];
  const h = load({ data: { roster: { bookings: rows } } });
  const px = textOf(await show(h, 'px'));
  assert.match(px, /H1 · 07:15-07:30/);
  assert.match(px, /H2 · Before 08:30 at pier/);
  assert.match(px, /H3 · 06:40-06:55 จุดเดิม Spanish/);
  assert.match(px, /— · 07:00/, 'no hotel: "—" as lk, not the pickup area');
  assert.ok(!/BK-1/.test(px), 'the voucher column is the agent voucher only, as lk');
});
