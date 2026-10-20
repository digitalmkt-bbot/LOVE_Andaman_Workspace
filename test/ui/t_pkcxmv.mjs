// §pkCxMv · ตั๋วอุทยาน › แถว "ยกเลิก/ไม่มา" นับใบที่ย้ายวันออกไปหลังจัดลำแล้วด้วย (แยก "ย้ายวัน")
//
// ที่มา (2026-10-19) · owner ส่งภาพ Ticket Management: แถวยกเลิกขึ้น −1 ผญ ตปท อย่างเดียว
//   "เหมือนว่ายอดเด็ก CXL ด้วยนะ แต่ไม่ขึ้น" → "จำนวนขึ้นเรือวันนี้ มียกเลิก 1 กับย้ายวัน 2+1"
//   ใบที่ย้ายวันหลุดจากยอดของวันไปเลย แถวยกเลิกเลยไม่เห็นเด็กคนนั้น · ตอนนี้อ่านภาพที่ §strandMove ถ่ายไว้ตอนเลื่อน
//
// กัน
//   1 ใบ ผญ ตปท 2 + เด็ก ตปท 1 จัดลำแล้ว ย้ายไปพรุ่งนี้ → pkCxPax ของลำนั้น: mv 3 · ผญ ตปท 2 · ดญ ตปท 1 · ใบ CXL หน้างาน 1 ยังนับ cxl 1 · รวม 4
//   2 แถวในตาราง: ป้าย "ยกเลิก/ไม่มา/ย้ายวัน" · ช่อง −2 (ผญ ตปท) −1 (ดญ ตปท) · ท้ายแถว "ยกเลิกหน้างาน 1 · ไม่มา 0 · ย้ายวัน 3" · ชิปเส้นทาง "ยกเลิก 4"
//   3 ใบที่ย้ายไปลำอื่น/ท่าอื่น ไม่ปนลำนี้ · ลบภาพ (ckStrandMvDrop) แล้วแถวกลับเหลือ cxl 1 · ยอดจริงของวันไม่เปลี่ยน · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1000 });
await goView(page, 'pok-panwa', 800);

const S = await page.evaluate(() => {
  const ymd = d => bookingV2LocalYMD(d), T = new Date(), D = ymd(T), TM = ymd(new Date(T.getTime() + 86400000));
  const bP = BOATS.filter(x => x && x.id && x.pier === 'panwa'); const bid = bP[0].id, bid2 = bP[1].id;
  TRIPS[D] = TRIPS[D] || {}; TRIPS[D][bid] = { route: 'r10', type: 'normal', booked: 0 }; TRIPS[D][bid2] = { route: 'r12', type: 'normal', booked: 0 };
  TRIPS[TM] = TRIPS[TM] || {}; TRIPS[TM][bid] = { route: 'r10', type: 'normal', booked: 0 };
  const src = SB_BOOKINGS.filter(b => b.status === 'confirmed' && (b.trips || []).length === 1 && b.trips[0].pax && !laIsInternalFree(b));
  let n = 0;
  const mk = (rid, pax, boat) => { const b = JSON.parse(JSON.stringify(src[n % src.length])); n++; b.id = 'ZZMV' + n; const t = b.trips[0];
    t.date = D; t.routeId = rid; t.pax = pax; t.lockUse = 0; delete t.seatSource; delete t.upg; delete t.nat; delete t.names;
    b.history = [{ at: new Date(T.getTime() - 3 * 86400000).toISOString(), kind: 'create', tag: 'Created', text: 'x' }]; b.ops = { boatId: boat }; b.status = 'confirmed'; b.pax = {}; b.nationality = 'GB';
    delete b.cancelledAt; delete b.cancellation; SB_BOOKINGS.push(b); return b; };
  /* ใบย้ายวัน: ผญ ตปท 2 + เด็ก ตปท 1 · จัดลำ bid แล้ว → ถ่ายภาพแล้วเลื่อนไปพรุ่งนี้ */
  const mv = mk('r10', { ad_fr: 2, chd_fr: 1, inf_fr: 0, foc_fr: 0, ad_th: 0, chd_th: 0, inf_th: 0, foc_th: 0, foc: 0 }, bid);
  const t0 = JSON.parse(JSON.stringify(mv.trips[0]));
  ckStrandSnap(mv, D, mv.ops, t0, TM, 'moved'); mv.trips[0].date = TM; mv.ops = { boatId: bid };
  /* ใบย้ายไปลำอื่น (ไม่ควรปนลำแรก) */
  const mv2 = mk('r12', { ad_fr: 1, chd_fr: 0, inf_fr: 0, foc_fr: 0, ad_th: 0, chd_th: 0, inf_th: 0, foc_th: 0, foc: 0 }, bid2);
  ckStrandSnap(mv2, D, mv2.ops, JSON.parse(JSON.stringify(mv2.trips[0])), TM, 'moved'); mv2.trips[0].date = TM;
  /* ใบยกเลิกหน้างาน 1 คน (ผญ ตปท) บนลำแรก · คนที่เหลือขึ้นเรือ */
  const cx = mk('r10', { ad_fr: 2, chd_fr: 0, inf_fr: 0, foc_fr: 0, ad_th: 0, chd_th: 0, inf_th: 0, foc_th: 0, foc: 0 }, bid);
  cx.ops.pierCheckin = { at: new Date().toISOString(), by: 't', actualPax: 1, noShow: 1, expected: 2, events: [{ type: 'cxl', pax: 1, paxBreak: { ad: 1, chd: 0, inf: 0, foc: 0 }, reasonCode: 'cancel_onsite', at: '08:00', by: 't', ts: new Date().toISOString() }] };
  _ckOnIx.at = 0;
  const key = mv.id + '|' + D;
  return { D, TM, bid, bid2, key, mvId: mv.id, boatName: bP[0].name };
});

/* ══ 1 · pkCxPax ═══════════════════════════════════════════════════════ */
const R1 = await page.evaluate((S) => {
  const C = pkCxPax(S.D, S.bid, 'panwa'), C2 = pkCxPax(S.D, S.bid2, 'panwa');
  return { C, C2 };
}, S);
if (R1.C.mv === 3 && R1.C.cxl === 1 && R1.C.ns === 0 && R1.C.tot === 4 && R1.C.p8.ad_fr === 3 && R1.C.p8.chd_fr === 1 && R1.C.p8.ad_th === 0 && R1.C2.mv === 1 && R1.C2.tot === 1)
  ok('1 pkCxPax ลำแรก: ย้ายวัน 3 (ผญ ตปท 2 · ดญ ตปท 1) + ยกเลิกหน้างาน 1 = รวม 4 · ลำสอง: ย้ายวัน 1 แยกกัน');
else fail('1 ' + JSON.stringify(R1));

/* ══ 2 · แถวในตาราง Ticket Management ════════════════════════════════ */
await page.evaluate((S) => { _poPier = 'panwa'; _poDate = S.D; _pkFam = 'all'; _pkSetBoats = []; _pkSetD = null; _pkSetFamF = 'all'; renderPierPark('panwa'); }, S);
await page.waitForTimeout(400);
await page.evaluate(() => { [...document.querySelectorAll('#pk-host-panwa .pk2-fcs .pk2-fc')].find(b => /Ticket Management/.test(b.textContent)).click(); });
await page.waitForTimeout(400);
const R2 = await page.evaluate((S) => {
  const h = document.querySelector('#pk-host-panwa');
  const rows = [...h.querySelectorAll('tr.pk3-cx')].map(tr => ({ lbl: tr.querySelector('.rt').textContent.replace(/\s+/g, ' ').trim(), cells: [...tr.querySelectorAll('td.n')].map(td => td.textContent.trim()), why: tr.querySelector('.cxw').textContent.trim() }));
  const chips = [...h.querySelectorAll('.cxc')].map(c => ({ t: c.textContent.replace(/\s+/g, ' ').trim(), title: c.title }));
  const todo = [...h.querySelectorAll('button.r')].map(b => b.textContent.trim()).filter(t => /ยกเลิก/.test(t));
  const act = (() => { const tr = [...h.querySelectorAll('tr')].find(t => /Phi Phi/.test(t.textContent) && !t.classList.contains('pk3-cx') && t.querySelector('td.n')); return tr ? [...tr.querySelectorAll('td.n')].map(td => td.textContent.trim()) : []; })();
  return { rows, chips, todo, act, err: /Render error|TypeError/.test(h.textContent) };
}, S);
const r2 = R2.rows.find(r => /ทั้งเส้น|ทั้งวัน/.test(r.lbl) && /ย้ายวัน 3/.test(r.why));
if (r2 && /ยกเลิก\/ไม่มา\/ย้ายวัน/.test(r2.lbl) && r2.cells[5] === '−3' && r2.cells[6] === '−1' && r2.cells[0] === '' && /ยกเลิกหน้างาน 1 · ไม่มา 0 · ย้ายวัน 3/.test(r2.why.replace(/\s+/g, ' '))
    && R2.chips.some(c => /ยกเลิก 4/.test(c.t) && /ย้ายวัน 3/.test(c.title)) && R2.todo.some(t => /ย้ายวัน/.test(t) && /\b5 คน|4 คน/.test(t)) && !R2.err)
  ok('2 แถว "' + r2.lbl + '" · ผญ ตปท −3 · ดญ ตปท −1 · "' + r2.why.replace(/\s+/g, ' ') + '" · ชิปเส้นทาง ยกเลิก 4 · ปุ่มงานค้าง ' + R2.todo.join(' | '));
else fail('2 ' + JSON.stringify(R2).slice(0, 900));

/* ══ 3 · ลบภาพแล้วกลับเดิม · ยอดจริงไม่เปลี่ยน ════════════════════════ */
const R3 = await page.evaluate((S) => {
  const before = JSON.stringify(SB_BOOKINGS);
  const a0 = pkCxPax(S.D, S.bid, 'panwa');
  ckStrandMvDrop(S.key);
  const a1 = pkCxPax(S.D, S.bid, 'panwa');
  const al = getAllotment('r10', S.D);
  return { a0: a0.tot, a1: { tot: a1.tot, mv: a1.mv, cxl: a1.cxl }, consumed: al.seatsConsumed, same: before === JSON.stringify(SB_BOOKINGS) };
}, S);
if (R3.a0 === 4 && R3.a1.tot === 1 && R3.a1.mv === 0 && R3.a1.cxl === 1 && R3.consumed === 1 && R3.same && errors.length === 0)
  ok('3 ลบภาพย้ายวันแล้วแถวเหลือยกเลิกหน้างาน 1 · ที่นั่งใช้จริงของวัน (1 = หักคนยกเลิกแล้ว) ไม่รวมใบที่ย้าย · ไม่แก้ใบจอง · ไม่มี error');
else fail('3 ' + JSON.stringify(R3) + ' errors=' + JSON.stringify(errors.slice(0, 2)));

await close();
if (bad) { console.log(bad + ' FAILED'); process.exit(1); } console.log('ALL OK');
