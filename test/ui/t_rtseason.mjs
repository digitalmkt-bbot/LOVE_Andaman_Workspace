// §rtSeason · ตารางฤดูกาลของราคามาตรฐาน · หลายเรท แยกด้วยช่วงวัน ไม่มี priority
//
// ที่มา (2026-09-18) · เอเย่นต์ผูก Rate Type ได้ชุดเดียว และ validTo ไม่ได้กั้นการคิดเงิน
//   พอหมดฤดู ระบบคิดราคาฤดูเก่าต่อไปเงียบ ๆ (§rtExpiry เตือนเรื่องนี้ · อันนี้แก้เรื่องนี้)
//
// ⚠ ข้อที่สำคัญที่สุดในไฟล์นี้คือข้อแรก · "ไม่ได้ตั้งตาราง = ไม่มีอะไรเปลี่ยน"
//   ของใหม่ที่แตะทางเดินราคา ต้องพิสูจน์ก่อนว่ามันเงียบสนิทกับข้อมูลที่มีอยู่ทั้งหมด
//   แล้วค่อยพิสูจน์ว่ามันทำงานตอนถูกเปิดใช้
import { open } from './_harness.mjs';

const AG = 'a13';                      // SAYAMA
const HIGH = 'rt688218';               // RT - Main 26-27 TH-WW · เริ่ม 15 ต.ค.
const RT_DIFF = 'r12';                 // Whale Shark · LOW 3100 / HIGH 3200 (PK ผู้ใหญ่ ตปท.)

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };
const warn = m => console.log('  ! ' + m);

const { page, errors, close } = await open({ blob: process.env.LAD });

/* ── 1 · ไม่ได้ตั้งตาราง = พฤติกรรมเดิมเป๊ะ ──────────────────────────────── */
const A = await page.evaluate(() => {
  const DATES = ['2026-05-20','2026-09-18','2026-10-14','2026-10-15','2027-03-01','2025-01-01'];
  let checked = 0, mismatch = 0;
  (SB_AGENTS||[]).forEach(a => { if(!a.rateTypeId) return;
    DATES.forEach(d => { checked++; if(laMainRtIdFor(a.id, d) !== a.rateTypeId) mismatch++; }); });
  return { checked, mismatch, configured: (SB_AGENTS||[]).filter(a => laSeasonsOf(a).length).length };
});
console.log('Rate season');
if (A.configured) warn('มีเอเย่นต์ตั้งตารางไว้แล้ว ' + A.configured + ' เจ้า · ข้อ 1 ตรวจได้ไม่ครบ');
if (A.mismatch)
  fail('ยังไม่มีใครตั้งตาราง แต่ตัวแก้คืนเรทคนละตัว ' + A.mismatch + '/' + A.checked + ' · ของเก่าขยับ');
else ok('ไม่ได้ตั้งตาราง · เรทเดิมทุกเจ้าทุกวัน (' + A.checked + ' จุด)');

/* ── 2 · เปิดใช้แล้วต้องสลับตรงวัน และห้ามคืนค่าว่าง ────────────────────── */
const B = await page.evaluate(([ag, high]) => {
  const a = SB_AGENTS.filter(x => x.id === ag)[0];
  const LOW = a.rateTypeId;
  a.rateSeasons = [ {rt:LOW, from:'2026-05-16', to:'2026-10-14'},
                    {rt:high, from:'2026-10-15', to:''} ];
  const at = d => { const r = laMainRtFor(ag, d); return r ? r.id : null; };
  return { LOW, d13:at('2026-10-13'), d14:at('2026-10-14'), d15:at('2026-10-15'),
           far:at('2027-06-01'), before:at('2026-01-01'), none:at(''),
           issues: laSeasonIssues(a) };
}, [AG, HIGH]);

if (B.d14 !== B.LOW || B.d15 !== HIGH)
  fail('รอยต่อผิด · 14 ต.ค. ได้ ' + B.d14 + ' · 15 ต.ค. ได้ ' + B.d15);
else ok('สลับตรงวัน · 14 ต.ค. = ฤดูต่ำ · 15 ต.ค. = ฤดูสูง');
if (B.far !== HIGH) fail('ใบท้ายไม่มีวันสิ้นสุด แต่ 2027 กลับได้ ' + B.far);
else ok('ใบท้ายไม่มีวันสิ้นสุด · ใช้ยาวได้จริง');
if (B.before !== B.LOW || B.none !== B.LOW)
  fail('วันที่ไม่มีใบไหนคลุม ควรถอยไปเรทหลัก · ได้ ' + B.before + ' / ' + B.none);
else ok('วันที่ไม่มีใบไหนคลุม ถอยไปเรทหลัก · ไม่มีวันไหนไม่มีราคา');
if (B.issues.length) fail('ตารางที่ตั้งถูกแล้ว แต่ตัวตรวจยังทัก · ' + B.issues.join(' / '));
else ok('ตารางที่ตั้งถูก · ตัวตรวจไม่ทัก');

/* ── 3 · เงินต้องขยับจริงผ่านทางเดินราคาของระบบ ────────────────────────── */
const C = await page.evaluate(([ag, rid]) => {
  bkV2NewBooking();
  const d = _bkV2.newBooking;
  const a = SB_AGENTS.filter(x => x.id === ag)[0];
  d.agentId = ag; d.rateTypeRef = a.rateTypeId; d.bookingDate = '2026-09-18';
  const mk = date => ({ routeId:rid, date, zone:'PK', bookingMode:'seat',
                        pax:{ad_fr:2, chd_fr:0, inf_fr:0, ad_th:0, chd_th:0} });
  const at = date => { const t = mk(date), rt = bkV2GetRTForTrip(t);
                       return { rt: rt ? rt.id : null, total: bkV2TripSubtotal(t).total }; };
  return { lo: at('2026-10-14'), hi: at('2026-10-15') };
}, [AG, RT_DIFF]);

if (C.lo.rt === C.hi.rt)
  fail('สองฝั่งของเส้นแบ่งใช้ชุดเดียวกัน · ส่งต่อไม่ถึงทางเดินราคา');
else ok('ทางเดินราคารับฤดูแล้ว · ' + C.lo.rt + ' → ' + C.hi.rt);
if (!(C.lo.total > 0 && C.hi.total > 0))
  fail('มีฝั่งที่คิดเงินไม่ได้ · ' + C.lo.total + ' / ' + C.hi.total);
else if (C.lo.total === C.hi.total)
  fail('เงินไม่ขยับ · ทั้งสองวันได้ ฿' + C.lo.total + ' · เส้น ' + 'ที่เลือกอาจราคาเท่ากันสองฤดู');
else ok('เงินขยับจริง · 14 ต.ค. ฿' + C.lo.total.toLocaleString()
      + ' → 15 ต.ค. ฿' + C.hi.total.toLocaleString());

/* ── 4 · ใบเดียวข้ามฤดู · เคส OVN ออก 14 กลับ 15 ────────────────────────── */
const D = await page.evaluate(([ag, rid]) => {
  const d = _bkV2.newBooking;
  d.trips = [ { routeId:rid, date:'2026-10-14', zone:'PK', bookingMode:'seat',
                pax:{ad_fr:2,chd_fr:0,inf_fr:0,ad_th:0,chd_th:0} },
              { routeId:rid, date:'2026-10-15', zone:'PK', bookingMode:'seat',
                pax:{ad_fr:2,chd_fr:0,inf_fr:0,ad_th:0,chd_th:0} } ];
  return d.trips.map(t => { const rt = bkV2GetRTForTrip(t);
    return { date:t.date, rt: rt?rt.id:null, total: bkV2TripSubtotal(t).total }; });
}, [AG, RT_DIFF]);
if (D[0].rt === D[1].rt)
  fail('ใบเดียวข้ามฤดู แต่ทั้งสองทริปได้ชุดเดียวกัน · ราคาต้องแยกรายทริป');
else ok('ใบเดียวข้ามฤดู · ทริป 14 ฿' + D[0].total.toLocaleString()
      + ' · ทริป 15 ฿' + D[1].total.toLocaleString() + ' · คนละชุดราคา');

/* ── 5 · ตัวตรวจต้องจับตารางที่ตั้งผิด ────────────────────────────────── */
const E = await page.evaluate(([ag, high]) => {
  const a = SB_AGENTS.filter(x => x.id === ag)[0];
  const LOW = a.rateTypeId, keep = a.rateSeasons;
  const run = arr => { a.rateSeasons = arr; return laSeasonIssues(a).length; };
  const o = {
    overlap: run([{rt:LOW,from:'2026-05-16',to:'2026-10-20'},{rt:high,from:'2026-10-15',to:''}]),
    gap:     run([{rt:LOW,from:'2026-05-16',to:'2026-10-10'},{rt:high,from:'2026-10-15',to:''}]),
    closed:  run([{rt:LOW,from:'2026-05-16',to:'2026-10-14'},{rt:high,from:'2026-10-15',to:'2027-05-15'}]),
    backwards: run([{rt:LOW,from:'2026-10-14',to:'2026-05-16'}]),
    ghost:   run([{rt:'rt_does_not_exist',from:'2026-05-16',to:''}]),
    goodAgain: run([{rt:LOW,from:'2026-05-16',to:'2026-10-14'},{rt:high,from:'2026-10-15',to:''}])
  };
  a.rateSeasons = keep;
  return o;
}, [AG, HIGH]);
for (const [k, label] of [['overlap','ช่วงทับกัน'],['gap','มีวันโหว่'],
    ['closed','ช่วงสุดท้ายมีวันจบ'],['backwards','วันจบก่อนวันเริ่ม'],
    ['ghost','ชี้ไปเรทที่ไม่มี']]){
  if (!E[k]) fail('ตัวตรวจจับไม่ได้ · ' + label);
  else ok('ตัวตรวจจับได้ · ' + label);
}
if (E.goodAgain) fail('ตารางที่ถูกกลับขึ้นว่าผิด');
else ok('ตารางที่ถูก ไม่ขึ้นข้อทัก');

/* ── 6 · Promotion ยังทับข้างบนฤดูได้เหมือนเดิม ──────────────────────────── */
const F = await page.evaluate(([ag, rid]) => {
  const d = _bkV2.newBooking;
  const t = { routeId:rid, date:'2026-10-15', zone:'PK', bookingMode:'seat',
              pax:{ad_fr:2,chd_fr:0,inf_fr:0,ad_th:0,chd_th:0} };
  const seasonRt = laMainRtFor(ag, t.date);
  const promoRt  = bkV2GetRTForTrip(t);
  const promos = (typeof SB_CONTRACTS!=='undefined'?SB_CONTRACTS:[])
                   .filter(c => c && c.agentId===ag && c.kind==='promo').length;
  return { season: seasonRt?seasonRt.id:null, used: promoRt?promoRt.id:null, promos };
}, [AG, RT_DIFF]);
if (!F.promos){
  if (F.used !== F.season) fail('ไม่มีโปรโมชั่นเลย แต่ชุดที่ใช้ไม่ใช่ของฤดู');
  else ok('ไม่มีโปรทับ · ใช้ชุดของฤดูตามที่ควร');
} else warn('เอเย่นต์นี้มีใบโปร ' + F.promos + ' ใบ · ข้ามข้อเทียบชั้นโปร');

/* ── 6b · ตั้งฤดูถัดไปแล้ว คำเตือนของ §rtExpiry ต้องหายไป ────────────────
   ปิดวงให้ครบ · แผงเตือนถามว่า "หมดแล้วใช้เรทไหน" · ตารางฤดูกาลคือคำตอบ
   ตอบแล้วยังเตือนอยู่ = แผงจะกลายเป็นเสียงรบกวนที่คนเลิกอ่าน */
const H = await page.evaluate(ag => {
  const a = SB_AGENTS.filter(x => x.id === ag)[0];
  const keep = a.rateSeasons;
  a.rateSeasons = [];
  const off = { warned: !!rtExpForAgent(a),
                panel: rtExpScan().reduce((s,x) => s + x.agents.length, 0) };
  a.rateSeasons = keep;
  const on  = { warned: !!rtExpForAgent(a),
                panel: rtExpScan().reduce((s,x) => s + x.agents.length, 0) };
  /* §rtTab · ตัวแสดงตารางย้ายไปอยู่ในแท็บ Rate Type แล้ว (rtSeasonBlock ถูกถอดออก) */
  rtmInit(a.id);
  const html = agTabRate(a);
  return { off, on, block: html.length, today: html.indexOf('ใช้อยู่วันนี้') >= 0 };
}, AG);
if (!H.off.warned) warn('\u0e40\u0e2d\u0e40\u0e22\u0e48\u0e19\u0e15\u0e4c\u0e19\u0e35\u0e49\u0e44\u0e21\u0e48\u0e16\u0e39\u0e01\u0e40\u0e15\u0e37\u0e2d\u0e19\u0e2d\u0e22\u0e39\u0e48\u0e01\u0e48\u0e2d\u0e19\u0e2d\u0e22\u0e39\u0e48\u0e41\u0e25\u0e49\u0e27 \u00b7 \u0e02\u0e49\u0e32\u0e21\u0e02\u0e49\u0e2d\u0e19\u0e35\u0e49');
else if (H.on.warned)
  fail('\u0e15\u0e31\u0e49\u0e07\u0e15\u0e32\u0e23\u0e32\u0e07\u0e24\u0e14\u0e39\u0e16\u0e31\u0e14\u0e44\u0e1b\u0e41\u0e25\u0e49\u0e27 \u0e41\u0e15\u0e48\u0e22\u0e31\u0e07\u0e40\u0e15\u0e37\u0e2d\u0e19\u0e27\u0e48\u0e32\u0e40\u0e23\u0e17\u0e01\u0e33\u0e25\u0e31\u0e07\u0e2b\u0e21\u0e14\u0e2d\u0e22\u0e39\u0e48');
else if (H.on.panel !== H.off.panel - 1)
  fail('\u0e15\u0e31\u0e27\u0e19\u0e31\u0e1a\u0e1a\u0e19\u0e41\u0e1c\u0e07\u0e01\u0e31\u0e1a\u0e1a\u0e23\u0e23\u0e17\u0e31\u0e14\u0e43\u0e19\u0e2b\u0e19\u0e49\u0e32 Agent \u0e1e\u0e39\u0e14\u0e44\u0e21\u0e48\u0e15\u0e23\u0e07\u0e01\u0e31\u0e19 \u00b7 '
     + H.off.panel + ' \u2192 ' + H.on.panel);
else ok('\u0e15\u0e31\u0e49\u0e07\u0e15\u0e32\u0e23\u0e32\u0e07\u0e41\u0e25\u0e49\u0e27\u0e04\u0e33\u0e40\u0e15\u0e37\u0e2d\u0e19\u0e2b\u0e32\u0e22 \u00b7 \u0e41\u0e1c\u0e07\u0e23\u0e27\u0e21 ' + H.off.panel + ' \u2192 ' + H.on.panel + ' \u0e40\u0e2d\u0e40\u0e22\u0e48\u0e19\u0e15\u0e4c');
if (!H.block || !H.today)
  fail('แท็บ Rate Type ไม่ขึ้นตาราง หรือไม่บอกว่าช่วงไหนใช้อยู่วันนี้');
else ok('แท็บ Rate Type ขึ้นตาราง · บอกด้วยว่าช่วงไหนใช้อยู่วันนี้');

/* ── 7 · ตารางต้องรอดการโหลดใหม่ ─────────────────────────────────────── */
await page.evaluate(ag => {
  const a = SB_AGENTS.filter(x => x.id === ag)[0];
  sbAgentsPersist();
}, AG);
await page.reload({ waitUntil:'load' });
await page.waitForFunction(() => typeof window.nav === 'function'
  && typeof SB_AGENTS !== 'undefined' && SB_AGENTS.length, null, { timeout: 20000 });
await page.waitForTimeout(500);
const G = await page.evaluate(([ag, high]) => {
  const a = SB_AGENTS.filter(x => x.id === ag)[0];
  const S = laSeasonsOf(a);
  const r = laMainRtFor(ag, '2026-10-15');
  return { n:S.length, resolvesTo: r?r.id:null };
}, [AG, HIGH]);
if (G.n !== 2 || G.resolvesTo !== HIGH)
  fail('ตารางฤดูกาลหายหลังโหลดใหม่ · เหลือ ' + G.n + ' ช่วง · 15 ต.ค. ได้ ' + G.resolvesTo);
else ok('ตารางฤดูกาลรอดการโหลดใหม่ · 2 ช่วง · 15 ต.ค. ยังเป็นฤดูสูง');

/* ── 8 · sidecar ต้องพาตารางไปด้วย ─────────────────────────────────────────
   §rateBind · การผูกเรทถูกเก็บสองที่ และ sidecar เป็นตัวชนะตอนโหลด
   ตารางฤดูกาลคือข้อเท็จจริงเดียวกัน จึงต้องเดินทางไปด้วยกัน
   ถ้าไปแต่ sb_agents วันไหนมีอะไรเขียนทับ sb_agents ทั้งก้อน ตารางจะหายเงียบ ๆ */
const I = await page.evaluate(ag => {
  const raw = JSON.parse(localStorage.getItem('loveandaman_v2') || '{}');
  const row = (raw.sb_agents_rate_bindings || []).filter(b => b.id === ag)[0] || null;
  return { has: !!(row && Array.isArray(row.rateSeasons)), n: row && row.rateSeasons ? row.rateSeasons.length : 0 };
}, AG);
if (!I.has || I.n !== 2)
  fail('sidecar \u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e1e\u0e32\u0e15\u0e32\u0e23\u0e32\u0e07\u0e24\u0e14\u0e39\u0e01\u0e32\u0e25\u0e44\u0e1b\u0e14\u0e49\u0e27\u0e22 \u00b7 \u0e21\u0e35 ' + I.n + ' \u0e0a\u0e48\u0e27\u0e07');
else ok('sidecar \u0e1e\u0e32\u0e15\u0e32\u0e23\u0e32\u0e07\u0e24\u0e14\u0e39\u0e01\u0e32\u0e25\u0e44\u0e1b\u0e14\u0e49\u0e27\u0e22 \u00b7 2 \u0e0a\u0e48\u0e27\u0e07');

/* ── 9 · sidecar รุ่นเก่า (ไม่มีคีย์นี้) ต้องไม่ลบตารางทิ้ง ──────────────── */
await page.evaluate(ag => {
  const K = 'loveandaman_v2';
  const raw = JSON.parse(localStorage.getItem(K) || '{}');
  // จำลอง sidecar ที่เขียนไว้ก่อนมีตารางฤดูกาล · มีแต่ rateTypeId
  raw.sb_agents_rate_bindings = (raw.sb_agents_rate_bindings || [])
    .map(b => ({ id: b.id, rateTypeId: b.rateTypeId }));
  localStorage.setItem(K, JSON.stringify(raw));
}, AG);
await page.reload({ waitUntil:'load' });
await page.waitForFunction(() => typeof window.nav === 'function'
  && typeof SB_AGENTS !== 'undefined' && SB_AGENTS.length, null, { timeout: 20000 });
await page.waitForTimeout(500);
const J = await page.evaluate(ag => {
  const a = SB_AGENTS.filter(x => x.id === ag)[0];
  return laSeasonsOf(a).length;
}, AG);
if (J !== 2)
  fail('sidecar \u0e23\u0e38\u0e48\u0e19\u0e40\u0e01\u0e48\u0e32\u0e17\u0e35\u0e48\u0e44\u0e21\u0e48\u0e21\u0e35\u0e04\u0e35\u0e22\u0e4c rateSeasons \u0e25\u0e1a\u0e15\u0e32\u0e23\u0e32\u0e07\u0e17\u0e34\u0e49\u0e07 \u00b7 \u0e40\u0e2b\u0e25\u0e37\u0e2d ' + J + ' \u0e0a\u0e48\u0e27\u0e07');
else ok('sidecar \u0e23\u0e38\u0e48\u0e19\u0e40\u0e01\u0e48\u0e32\u0e44\u0e21\u0e48\u0e25\u0e1a\u0e15\u0e32\u0e23\u0e32\u0e07\u0e17\u0e35\u0e48\u0e40\u0e1e\u0e34\u0e48\u0e07\u0e15\u0e31\u0e49\u0e07');

/* คืนสภาพ ไม่ทิ้งรอยไว้ในชุดข้อมูลเทส */
await page.evaluate(ag => {
  const a = SB_AGENTS.filter(x => x.id === ag)[0];
  if(a){ delete a.rateSeasons; sbAgentsPersist(); }
}, AG);

const NOISE = /Failed to load resource|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|net::ERR_/;
const real = errors.filter(x => !NOISE.test(x));
const skipped = errors.length - real.length;
if (skipped) console.log('  · ข้าม ' + skipped + ' error ของการโหลดไฟล์จากเน็ต (ตอน reload)');
if (real.length) { bad += real.length; real.forEach(x => console.log('  ✗ ' + x)); }
console.log('พัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
