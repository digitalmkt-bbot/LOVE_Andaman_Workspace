// §rentZero · ติ๊กเป็นเรือเช่าแต่ค่าเช่า 0 ต้องไม่ทำให้ต้นทุนถูกลง · แก้ช่องอื่นต้องไม่กลายเป็นเรือเช่าเอง
//
// ที่มา (2026-10-04) · ผู้ใช้ถาม "ทำไมเรือเช่า Break even ถึงได้ถูกกว่าเรือของตัวเอง"
//   แล้วตามด้วย "Aluminous1 ไม่ใช่เรือเช่านะ ทำไมขึ้นเป็นเรือเช่า"
//   ข้อมูลจริง · boat_rent มีระเบียน Aluminous1 { on:1, amt:0, ค่าตั้งต้นทั้งชุด }
//   ctCalc ตัดค่าเสื่อม กัปตัน เด็กเรือ ออก แต่ไม่มีค่าเช่ามาแทน (ค่าเช่า 0)
//   คุ้มทุน Phi Phi + Khai จาก 53 คน เหลือ 36 คน · Phi Phi + Bamboo 51 → 34
//   และ ctRentSet สร้างระเบียนใหม่จาก ctRentBlank() ซึ่ง on:1 · แก้ % น้ำมันของเรือบริษัท = กลายเป็นเรือเช่าเงียบ ๆ
//
// กันหกอย่าง
//   1 ติ๊กเป็นเรือเช่า ค่าเช่า 0 → ต้นทุนและจุดคุ้มทุนเท่ากับเรือบริษัท (ค่าเสื่อม กัปตัน เด็กเรือ ยังอยู่)
//   2 ใส่ค่าเช่าแล้ว → ตัดสามบรรทัดนั้นออก มีบรรทัดค่าเช่าเข้ามาแทน (ของเดิมยังทำงาน)
//   3 แก้ % น้ำมันของเรือที่ไม่เคยมีระเบียน → ไม่กลายเป็นเรือเช่า · ตัวคูณน้ำมันยังมีผล
//   4 ติ๊ก "เป็นเรือเช่า" เอง → เป็นเรือเช่า (on = 1)
//   5 หน้าแผน · ลำที่ติ๊กไว้แต่ค่าเช่า 0 ขึ้นข้อความบอกว่ายังคิดแบบเรือบริษัท
//   6 ไม่มี error บนหน้า
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
await goView(page, 'costing', 900);

const R = await page.evaluate(async () => {
  const W = ms => new Promise(z => setTimeout(z, ms));
  const T = ctTpl(), P = ctPlans(); if (!P.length) return { err: 'no plans' };
  const all0 = ctRentAll();
  const free = BOATS.filter(b => !b.retired && !all0[b.id]); if (free.length < 3) return { err: 'no free boats' };
  const [A, B, C] = free; const pl = JSON.parse(JSON.stringify(P[0])); pl._asOf = '';
  const snap = bid => { const q = JSON.parse(JSON.stringify(pl)); q.boatId = bid; const c = ctCalc(q, ctCtxAt(q, 30), T);
    const ids = c.rows.map(r => r.id); return { be: ctBreakEven(q, 400, T), net: Math.round(c.net), dep: ids.includes('dep'), cap: ids.includes('cap'), crew: ids.includes('crew'), rent: ids.includes('rent'), fuel: Math.round((c.rows.find(r => r.id === 'fuel') || {}).amt || 0) }; };
  const out = { own: snap('') };
  /* 1 · ระเบียนแบบเดียวกับของจริง */
  const all = ctRentAll(); all[A.id] = { on: 1, mode: 'lump', amt: 0, seat: 0, days: 30, off: 2, trips: 1, vat: 0, note: '', from: '', to: '', ex: { dep: 1, cap: 1, crew: 1 } }; ctRentAllSave(all);
  out.zero = snap(A.id);
  /* 2 · ใส่ค่าเช่า */
  ctRentSet(A.id, 'amt', 420000); out.paid = snap(A.id); out.paidPer = Math.round((ctRentOf(A.id) || {}).perTrip || 0);
  ctRentSet(A.id, 'amt', 0);
  /* 3 · แก้ % น้ำมันของเรือบริษัท */
  ctRentSet(B.id, 'fuelMul', 80);
  out.fuelOnly = { on: (ctRentRaw(B.id) || {}).on, of: !!ctRentOf(B.id), mul: ctBoatFuelMul(B.id), s: snap(B.id) };
  /* 4 · ติ๊กเอง */
  ctRentSet(C.id, 'on', 1); out.tick = { on: (ctRentRaw(C.id) || {}).on };
  /* 5 · หน้าแผน */
  const PP = ctPlans(); PP[0].boatId = A.id; ctPlansSave(PP); _ct.pid = PP[0].id; _ct.tab = 'plan'; ctRender(); await W(400);
  const w = document.querySelector('[data-rentzero]');
  out.ui = { warn: !!w, vis: !!(w && w.offsetParent), txt: w ? w.textContent.slice(0, 80) : '', head: (document.querySelector('.ct-rent .ct-cath') || {}).textContent || '' };
  return out;
});
if (R.err) { fail(R.err); await close(); process.exit(1); }
const z = R.zero, o = R.own;
if (z.dep && z.cap && z.crew && !z.rent && z.net === o.net && z.be === o.be) ok(`1 ติ๊กเป็นเรือเช่า ค่าเช่า 0 · ต้นทุน ${z.net.toLocaleString()} คุ้มทุน ${z.be} คน เท่ากับเรือบริษัท`);
else fail('1 ' + JSON.stringify({ zero: z, own: o }));
const p = R.paid;
if (!p.dep && !p.cap && !p.crew && p.rent && R.paidPer === 15000 && p.net !== o.net) ok(`2 ใส่ค่าเช่า 420,000 · ตัดค่าเสื่อม/กัปตัน/เด็กเรือ มีค่าเช่า ${R.paidPer.toLocaleString()}/ทริป · คุ้มทุน ${p.be} คน`);
else fail('2 ' + JSON.stringify({ paid: p, per: R.paidPer }));
const f = R.fuelOnly;
if (f.on === 0 && !f.of && f.mul === 0.8 && f.s.dep && f.s.cap && f.s.crew && !f.s.rent && f.s.fuel === Math.round(o.fuel * 0.8)) ok('3 แก้ % น้ำมันของเรือบริษัท · ไม่กลายเป็นเรือเช่า · น้ำมันลดเหลือ 80%');
else fail('3 ' + JSON.stringify(f) + ' own fuel ' + o.fuel);
if (R.tick.on === 1) ok('4 ติ๊ก "เป็นเรือเช่า" เอง · เป็นเรือเช่า'); else fail('4 ' + JSON.stringify(R.tick));
if (R.ui.warn && R.ui.vis && /เรือบริษัท/.test(R.ui.txt) && /ยังไม่มีค่าเช่า/.test(R.ui.head)) ok('5 หน้าแผน · ขึ้นข้อความว่ายังไม่ได้ใส่ค่าเช่า ยังคิดแบบเรือบริษัท');
else fail('5 ' + JSON.stringify(R.ui));
const e1 = errors.filter(e => !/Failed to load resource/.test(e));
if (!e1.length) ok('6 ไม่มี error บนหน้า'); else fail('6 ' + e1.slice(0, 3).join(' | '));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
