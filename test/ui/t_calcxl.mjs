// §calCxlSplit · ปฏิทิน Booking · ยกเลิกบาง variant แล้วไม่ขีดทั้งโปรแกรม · ป้ายตามเหตุผลจริง
//
// ที่มา (2026-10-19) · owner ส่งภาพปฏิทินวันที่ 20 "หน้านี้น่าจะอ่านค่าผิดนะ เพราะยกเลิกบางเส้นทาง เพราะไม่ถึงยอด"
//   Similan Islands 217 ขีดทั้งก้อน + "Cancelled (weather)" ทั้งที่ยกเลิกแค่ Early 07.00 (2 คน) เพราะไม่ถึงคุ้มทุน
//
// ข้อมูลทดสอบ: วันทดสอบ D · Similan สองรอบ (รอบ A ยังออก · รอบ B ยกเลิกเหตุผล minpax) · Krabi รอบเดียว ยกเลิกเหตุผล minpax
//
// กัน
//   1 ชิป Similan ไม่ขีด · ตัวเลข = เฉพาะรอบที่ยังออก · มีป้ายเล็ก −N ของรอบที่ยกเลิก · tooltip บอกเหตุผล "below break-even"
//   2 ชิป Krabi (ทุกรอบยกเลิก) ขีดทั้งชิป · title "Cancelled (Below break-even)" ไม่ใช่ weather
//   3 ยอดรวมของวัน = ผลรวมเฉพาะรอบที่ยังออก
//   4 แผงขวา: การ์ด Similan เป็นการ์ดปกติ หัวการ์ด = รอบที่ยังออก + บรรทัด "1 trip cancelled (below break-even) · −N pax" · แถวรอบที่ยกเลิกขีด + ป้ายเหตุผล
//     · การ์ด Krabi เป็นการ์ดแดง ป้าย "Cancelled (Below break-even)" · ไม่มีคำว่า weather ที่ไหน
//   5 ไม่แก้ใบจอง · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1100 });
await page.waitForTimeout(400);

const S = await page.evaluate(() => {
  const T = new Date(); T.setDate(T.getDate() + 9); const D = bkV2LocalYMD(T);
  const fam = id => (bkV2FamilyRoutes(id) || []).map(r => r.id || r);
  const sim = fam('similan'), kr = fam('krabi');
  const A = sim.find(r => r === 'r5') || sim[0], B = sim.find(r => r !== A), K = kr[0];
  const tl = BOATS.filter(x => x && x.id && x.pier === 'tublamu'), pw = BOATS.filter(x => x && x.id && x.pier === 'panwa');
  TRIPS[D] = {}; TRIPS[D][tl[0].id] = { route: A, type: 'normal', booked: 0 }; TRIPS[D][tl[1].id] = { route: B, type: 'normal', booked: 0 }; TRIPS[D][pw[0].id] = { route: K, type: 'normal', booked: 0 };
  /* ใบจองวันนั้นของสามรอบเท่านั้น · ล้างใบเดิมของวันนั้น */
  for (let i = SB_BOOKINGS.length - 1; i >= 0; i--) if ((SB_BOOKINGS[i].trips || []).some(t => t.date === D)) SB_BOOKINGS.splice(i, 1);
  const src = SB_BOOKINGS.filter(b => b.status === 'confirmed' && (b.trips || []).length === 1 && b.trips[0].pax && b.schemaVer === 2);
  let n = 0; const mk = (rid, ad, chd) => { const b = JSON.parse(JSON.stringify(src[n % src.length])); n++; b.id = 'ZZCX' + n; const t = b.trips[0]; t.date = D; t.routeId = rid; t.pax = { ad_th: 0, chd_th: 0, inf_th: 0, foc_th: 0, ad_fr: ad, chd_fr: chd, inf_fr: 0, foc_fr: 0, foc: 0 }; delete t.seatSource; t.lockUse = 0; b.status = 'confirmed'; delete b.weatherResolve; SB_BOOKINGS.push(b); return b; };
  for (let i = 0; i < 6; i++) mk(A, 3, 1);   /* A = 24 */
  mk(B, 2, 0);                                 /* B = 2  (ยกเลิก) */
  for (let i = 0; i < 3; i++) mk(K, 4, 0);   /* K = 12 (ยกเลิก) */
  SB_WEATHER_CLOSURES = SB_WEATHER_CLOSURES.filter(c => c.date !== D);
  SB_WEATHER_CLOSURES.push({ routeId: B, date: D, reason: 'minpax', note: 'test', at: new Date().toISOString() });
  SB_WEATHER_CLOSURES.push({ routeId: K, date: D, reason: 'minpax', note: 'test', at: new Date().toISOString() });
  _bkV2.tab = 'cal'; _bkV2.view = 'cal'; _bkV2.cursor = new Date(T.getFullYear(), T.getMonth(), 1); _bkV2.selected = { date: D }; _bkV2.panelHid = false;
  return { D, A, B, K, before: JSON.stringify(SB_BOOKINGS.filter(b => /^ZZCX/.test(b.id))) };
});
await goView(page, 'booking', 1200);
await page.evaluate(() => { _bkV2.tab = 'cal'; _bkV2.view = 'cal'; bkV2Render(); });
await page.waitForTimeout(500);

const R = await page.evaluate((S) => {
  const cell = [...document.querySelectorAll('[onclick^="bkV2SelectDay"]')].find(c => (c.getAttribute('onclick') || '').includes(S.D));
  if (!cell) return { noCell: true };
  const chips = [...cell.querySelectorAll('.bkv2-cal-chip')].map(c => ({ name: (c.querySelector('.bkv2-cal-chip-name') || {}).textContent || '', title: c.title, pax: ((c.querySelector('.bkv2-cal-chip-pax') || {}).textContent || '').trim(), strike: /line-through/.test((c.querySelector('.bkv2-cal-chip-pax') || { getAttribute: () => '' }).getAttribute('style') || ''), tag: [...c.querySelectorAll('span')].filter(x => !x.className).map(x => ({ t: x.textContent, title: x.title })) }));
  const dayTot = ((cell.querySelector('.bkv2-cal-daytot') || {}).textContent || '').trim();
  const panel = document.querySelector('.bkv2-selday'); const ptxt = panel ? panel.textContent.replace(/\s+/g, ' ') : '';
  return { chips, dayTot, ptxt, cellTxt: cell.textContent.replace(/\s+/g, ' ') };
}, S);
if (R.noCell) { fail('0 ไม่เจอช่องวัน ' + S.D); }
else {
  const sim = R.chips.find(c => /Similan/.test(c.name)), kr = R.chips.find(c => /Krabi/.test(c.name));
  if (sim && sim.pax === '24' && !sim.strike && sim.tag.some(t => /−2|−2/.test(t.t) && /below break-even/i.test(t.title)) && !/weather/i.test(sim.title))
    ok('1 ชิป Similan ไม่ขีด · ' + sim.pax + ' คน (เฉพาะรอบที่ยังออก) · ป้าย "' + sim.tag.find(t => /2/.test(t.t)).t + '" · tooltip "' + sim.tag.find(t => /2/.test(t.t)).title + '"');
  else fail('1 ' + JSON.stringify(sim));
  if (kr && kr.strike && /Cancelled \(Below break-even\)/.test(kr.title) && kr.pax === '12') ok('2 ชิป Krabi (ทุกรอบยกเลิก) ขีดทั้งชิป · "' + kr.title + '"');
  else fail('2 ' + JSON.stringify(kr));
  if (R.dayTot === '24') ok('3 ยอดรวมของวัน 24 = เฉพาะรอบที่ยังออก (ไม่รวม 2 + 12 ที่ยกเลิก)');
  else fail('3 ยอดรวมของวัน "' + R.dayTot + '" คาด 24 · ' + R.cellTxt);
  const p = R.ptxt;
  const simCard = /Similan Islands[^]*?24[^]*?1 trip cancelled \(below break-even\) · −2 pax not counted/.test(p);
  const krCard = /Krabi[^]*?Cancelled \(Below break-even\)/.test(p);
  if (simCard && krCard && !/weather/i.test(p)) ok('4 แผงขวา: Similan การ์ดปกติ 24 + "1 trip cancelled (below break-even) · −2 pax not counted" · Krabi การ์ดแดง "Cancelled (Below break-even)" · ไม่มีคำว่า weather');
  else fail('4 ' + JSON.stringify({ simCard, krCard, weather: /weather/i.test(p), p: p.slice(0, 900) }));
}
const after = await page.evaluate(() => JSON.stringify(SB_BOOKINGS.filter(b => /^ZZCX/.test(b.id))));
if (after === S.before && errors.length === 0) ok('5 ไม่แก้ใบจอง · ไม่มี error');
else fail('5 ' + JSON.stringify(errors.slice(0, 3)));
await close();
if (bad) { console.log(bad + ' FAILED'); process.exit(1); } console.log('ALL OK');
