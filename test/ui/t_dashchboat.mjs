// §dashChBoat · Dashboard · Bookings overview โหมดวัน · แท่งเหมาลำแยกตามลำ
//
// ที่มา (2026-10-05) · ผู้ใช้ส่งภาพ Bookings overview วันที่ 4 ต.ค. "เหมาลำ Charter ที่โชว์ แบ่งเป็นลำได้ไหม"
//   แท่ง "เหมาลำ Charter" 63 แท่งเดียว · ของจริงคือ Oceanus 30 + LKC33 33
//
// กันหกอย่าง
//   1 ใบเหมาสองใบ คนละลำ → สองแท่ง ชื่อลำถูก จำนวนคนถูก · ไม่มีแท่งรวม "เหมาลำ Charter"
//   2 ผลรวมแท่งเหมา = ยอดเหมาทั้งวัน · ตัวเลขรวมบนหัวการ์ดไม่เปลี่ยน
//   3 ใบเหมาที่ยังไม่ได้จัดเรือ → แท่ง "ยังไม่จัดเรือ" แยกออกมา ไม่หายจากกราฟ
//   4 ใบเหมาที่แยกลงสองลำ (boatSplits) → คนแบ่งตามก้อนที่แยกไว้
//   5 แท่งเส้นทางปกติ (ไม่ใช่เหมา) ยังอยู่เท่าเดิม · โหมดเดือนไม่พัง
//   6 ไม่มี error บนหน้า
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
await goView(page, 'dashboard', 900);

const R = await page.evaluate(async () => {
  const W = ms => new Promise(z => setTimeout(z, ms));
  const tpl = SB_BOOKINGS.find(b => b.schemaVer === 2 && (b.trips || []).length === 1 && b.trips[0].bookingMode !== 'charter' && !['cancelled', 'rejected', 'cancelled_weather'].includes(b.status) && getRoute(b.trips[0].routeId));
  if (!tpl) return { err: 'no template' };
  const ds = tpl.trips[0].date, BL = BOATS.filter(b => !b.retired); if (BL.length < 3) return { err: 'no boats' };
  const [A, B, C] = BL;
  const bars = () => [...document.querySelectorAll('[data-chbar]')].map(e => ({ boat: e.dataset.chbar, val: +e.dataset.chval, label: e.lastElementChild.textContent.trim() }));
  const others = () => [...document.querySelectorAll('.dv-barbox')].map(x => x.parentElement).filter(e => !e.hasAttribute('data-chbar')).map(e => e.textContent.replace(/\s+/g, ' ').trim());
  const draw = async () => { window._dashDate = ds; window._dashBkMode = 'day'; renderDash(); await W(350); };
  /* ล้างใบเหมาเดิมของวันนั้น จะได้นับเฉพาะที่สร้าง */
  SB_BOOKINGS.forEach(b => (b.trips || []).forEach(t => { if (t.date === ds && t.bookingMode === 'charter') b.status = 'cancelled'; }));
  Object.values(TRIPS[ds] || {}).forEach(op => { if (op && (op.type === 'charter' || op.charterBookingId)) { op.booked = 0; } });
  await draw(); const base = { others: others(), ch: bars().length };
  const mk = (pax, boat, splits) => { const b = JSON.parse(JSON.stringify(tpl)); b.id = 'T_CH_' + Math.random().toString(36).slice(2, 8); b.status = 'confirmed';
    const t = b.trips[0]; t.bookingMode = 'charter'; t.pax = pax; t.charterBoatId = boat || null; delete t.ops;
    b.ops = { boatId: boat || '' }; if (splits) b.ops.boatSplits = splits; SB_BOOKINGS.push(b); return b; };
  mk({ foc_fr: 30 }, A.id); mk({ ad_fr: 31, foc_fr: 1, foc_th: 1 }, B.id);
  await draw(); const out = { names: [A.name, B.name, C.name], ids: [A.id, B.id, C.id], base, two: bars(), others2: others(), all2: [...document.querySelectorAll('.dv-barbox')].length };
  const x = mk({ ad_fr: 7 }, '');
  await draw(); out.three = bars();
  x.status = 'cancelled';
  mk({ ad_fr: 50 }, A.id, [{ boatId: A.id, pax: 20, ad: 20 }, { boatId: C.id, pax: 30, ad: 30 }]);
  await draw(); out.split = bars();
  window._dashBkMode = 'month'; renderDash(); await W(350);
  out.month = { cols: document.querySelectorAll('.dv-barbox').length, ch: bars().length };
  window._dashBkMode = 'day';
  return out;
});
if (R.err) { fail(R.err); await close(); process.exit(1); }
const [nA, nB, nC] = R.names, [iA, iB, iC] = R.ids;
const by = (L, id) => L.find(x => x.boat === id);
if (R.base.ch === 0 && R.two.length === 2 && by(R.two, iA) && by(R.two, iA).val === 30 && by(R.two, iA).label.includes(nA) && by(R.two, iB) && by(R.two, iB).val === 33 && by(R.two, iB).label.includes(nB) && !R.two.some(x => /เหมาลำ Charter/.test(x.label)))
  ok(`1 ใบเหมาสองใบ คนละลำ · สองแท่ง "${by(R.two, iA).label}" 30 · "${by(R.two, iB).label}" 33`);
else fail('1 ' + JSON.stringify({ base: R.base, two: R.two }));
if (R.two.reduce((s, x) => s + x.val, 0) === 63 && R.all2 === R.base.others.length + 2) ok('2 ผลรวมแท่งเหมา 63 = ยอดเหมาทั้งวัน');
else fail('2 ' + JSON.stringify({ two: R.two, all2: R.all2, base: R.base.others.length }));
const nb = by(R.three, '');
if (R.three.length === 3 && nb && nb.val === 7 && /ยังไม่จัดเรือ|no boat yet/.test(nb.label) && R.three[R.three.length - 1].boat === '') ok('3 ใบเหมาที่ยังไม่จัดเรือ · มีแท่งของตัวเอง 7 คน อยู่ท้ายสุด');
else fail('3 ' + JSON.stringify(R.three));
if (by(R.split, iA) && by(R.split, iA).val === 50 && by(R.split, iC) && by(R.split, iC).val === 30 && by(R.split, iB).val === 33 && R.split.reduce((s, x) => s + x.val, 0) === 113) ok(`4 ใบเหมา 50 คนแยกสองลำ · ${nA} 30+20 · ${nC} 30 · รวม 113`);
else fail('4 ' + JSON.stringify(R.split));
if (JSON.stringify(R.others2) === JSON.stringify(R.base.others) && R.month.cols === 30 && R.month.ch === 0) ok('5 แท่งเส้นทางปกติเท่าเดิม · โหมดเดือนยังวาด 30 วัน');
else fail('5 ' + JSON.stringify({ o2: R.others2, base: R.base.others, month: R.month }));
const e1 = errors.filter(e => !/Failed to load resource/.test(e));
if (!e1.length) ok('6 ไม่มี error บนหน้า'); else fail('6 ' + e1.slice(0, 3).join(' | '));
if (process.env.SHOT) { await page.evaluate(() => renderDash()); await page.waitForTimeout(300); const el = await page.$('[data-chbar]'); if (el) { const bx = await page.evaluate(() => { const r = document.querySelector('[data-chbar]').closest('.dv-card,.dv-ov,section,div[class*="dv-"]').getBoundingClientRect(); return { x: Math.max(0, r.left - 300), y: Math.max(0, r.top - 120), width: 1100, height: 520 }; }); await page.screenshot({ path: process.env.SHOT, clip: bx }); } }
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
