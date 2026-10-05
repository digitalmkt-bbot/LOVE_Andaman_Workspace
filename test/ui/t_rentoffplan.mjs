// §rentOffPlan · แผนเดียวคิดแบบเรือบริษัทได้ ทั้งที่ลำที่ปักเป็นเรือเช่า · ไว้เทียบเช่ากับไม่เช่า
//
// ที่มา (2026-10-04) · ผู้ใช้ส่งภาพหน้าต้นทุน มีแผน Whale Shark Phi Phi Maiton Sunset สองใบ ปัก LKC66 ทั้งคู่
//   "เห็นไหม มันมี 2 อัน แต่ติ๊กเรือเช่าอันนึงออก อีกอันก็ออกตาม"
//   ติ๊ก "เป็นเรือเช่า" เป็นของลำ (boat_rent) ไม่ใช่ของแผน · สองใบจึงได้เลขเดียวกันเสมอ (คุ้มทุน 23 ทั้งคู่)
//
// กันหกอย่าง
//   1 สองแผนปักเรือเช่าลำเดียวกัน · ตั้ง "เฉพาะแผนนี้คิดแบบเรือบริษัท" ที่ใบที่สอง → ใบแรกยังมีค่าเช่า ใบที่สองไม่มี
//   2 ใบที่สองได้เลขเท่ากับตอนลำนั้นไม่ใช่เรือเช่าจริง ๆ (ค่าเสื่อม กัปตัน เด็กเรือ กลับมา · % น้ำมันของลำยังใช้)
//   3 ติ๊ก "เป็นเรือเช่า" ของลำไม่ถูกแตะ · P&L (ctx ที่ไม่ได้มาจากหน้าแผน) ยังคิดค่าเช่าตามปกติ
//   4 หน้าแผน · มีช่องติ๊กของแผน กดแล้วมีผล · รายการด้านซ้ายแยกป้าย "เรือเช่า" กับ "คิดแบบเรือบริษัท"
//   5 เอาติ๊กออก → กลับมาคิดค่าเช่าเหมือนเดิม
//   6 ไม่มี error บนหน้า
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
await goView(page, 'costing', 900);

const R = await page.evaluate(async () => {
  const W = ms => new Promise(z => setTimeout(z, ms));
  const T = ctTpl(); let P = ctPlans(); if (!P.length) return { err: 'no plans' };
  const A = BOATS.find(b => !b.retired && !ctRentAll()[b.id]); if (!A) return { err: 'no boat' };
  ctRentSet(A.id, 'on', 1); ctRentSet(A.id, 'amt', 420000); ctRentSet(A.id, 'fuelMul', 80);
  P = ctPlans(); P[0].boatId = A.id; P[0].rentOff = 0;
  const q = JSON.parse(JSON.stringify(P[0])); q.id = ctNewId(); q.name = P[0].name + ' (copy)'; P.push(q); ctPlansSave(P);
  const id1 = P[0].id, id2 = q.id;
  const snap = pid => { const pl = ctPlan(pid), c = ctCalc(pl, ctCtxAt(pl, 30), T), ids = c.rows.map(r => r.id);
    return { be: ctBreakEven(pl, 400, T), net: Math.round(c.net), rent: ids.includes('rent'), dep: ids.includes('dep'), cap: ids.includes('cap'), crew: ids.includes('crew'), fuel: Math.round((c.rows.find(r => r.id === 'fuel') || {}).amt || 0) }; };
  const out = { before: [snap(id1), snap(id2)] };
  /* หน้าแผน · เปิดใบที่สอง แล้วกดช่องติ๊กของแผน */
  _ct.pid = id2; _ct.tab = 'plan'; ctRender(); await W(400);
  const box = document.querySelector('[data-rentoff] input');
  out.ui0 = { box: !!box, vis: !!(box && box.offsetParent), checked: box ? box.checked : null };
  if (box) { box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true })); await W(400); }
  out.after = [snap(id1), snap(id2)];
  out.flag = { p1: ctPlan(id1).rentOff || 0, p2: ctPlan(id2).rentOff || 0, rawOn: (ctRentRaw(A.id) || {}).on, of: Math.round((ctRentOf(A.id) || {}).perTrip || 0) };
  const side = [...document.querySelectorAll('.ct-rt')].map(b => ({ t: b.textContent, off: !!b.querySelector('[data-rentoff-tag]') }));
  out.side = { rent: side.filter(x => /เรือเช่า/.test(x.t) && !x.off).length, off: side.filter(x => x.off).length, head: (document.querySelector('.ct-rent .ct-cath') || {}).textContent || '', tick: !!document.querySelector('.ct-rchk.big input:checked') };
  /* P&L ไม่ได้ส่ง ownCalc · แผนใบที่สอง + ลำเดิม ต้องยังมีค่าเช่า */
  const pl2 = ctPlan(id2), cp = ctCalc(pl2, { eng: pl2.eng, boats: 1, fuel: +pl2.fuel || 0, boatId: A.id, date: '', pax: 30, paxTH: 0, paxFR: 30 }, T);
  out.pnl = { rent: cp.rows.some(r => r.id === 'rent') };
  /* เลขที่ควรได้ · ลำเดียวกัน ตอนไม่ใช่เรือเช่า */
  const P3 = ctPlans(); P3.filter(x => x.id === id2)[0].rentOff = 0; ctPlansSave(P3);
  out.back = snap(id2);
  ctRentSet(A.id, 'on', 0); out.own = snap(id2); ctRentSet(A.id, 'on', 1);
  return out;
});
if (R.err) { fail(R.err); await close(); process.exit(1); }
const [a1, a2] = R.after, [b1, b2] = R.before;
if (b1.rent && b2.rent && b1.net === b2.net && a1.rent && a1.net === b1.net && !a2.rent && a2.net !== a1.net && R.flag.p1 === 0 && R.flag.p2 === 1)
  ok(`1 สองแผนปักเรือเช่าลำเดียวกัน · ใบแรกยังมีค่าเช่า (คุ้มทุน ${a1.be}) · ใบที่สองคิดแบบเรือบริษัท (คุ้มทุน ${a2.be})`);
else fail('1 ' + JSON.stringify({ before: R.before, after: R.after, flag: R.flag }));
if (a2.dep && a2.cap && a2.crew && a2.net === R.own.net && a2.be === R.own.be && a2.fuel === R.own.fuel && a2.fuel === b2.fuel) ok('2 ใบที่สองเท่ากับตอนลำนั้นไม่ใช่เรือเช่า · ค่าเสื่อม กัปตัน เด็กเรือ กลับมา · % น้ำมันของลำยังใช้');
else fail('2 ' + JSON.stringify({ a2, own: R.own, b2 }));
if (R.flag.rawOn === 1 && R.flag.of === 15000 && R.pnl.rent) ok('3 ติ๊กเรือเช่าของลำไม่ถูกแตะ · P&L ยังคิดค่าเช่า 15,000/ทริป ตามปกติ');
else fail('3 ' + JSON.stringify({ flag: R.flag, pnl: R.pnl }));
if (R.ui0.box && R.ui0.vis && R.ui0.checked === false && R.side.rent === 1 && R.side.off === 1 && /คิดแบบเรือบริษัท/.test(R.side.head) && R.side.tick) ok('4 หน้าแผน · ช่องติ๊กของแผนกดได้ · รายการซ้ายแยกป้าย เรือเช่า / คิดแบบเรือบริษัท');
else fail('4 ' + JSON.stringify({ ui0: R.ui0, side: R.side }));
if (R.back.rent && R.back.net === b2.net && R.back.be === b2.be) ok('5 เอาติ๊กออก · กลับมาคิดค่าเช่าเหมือนเดิม');
else fail('5 ' + JSON.stringify({ back: R.back, b2 }));
const e1 = errors.filter(e => !/Failed to load resource/.test(e));
if (!e1.length) ok('6 ไม่มี error บนหน้า'); else fail('6 ' + e1.slice(0, 3).join(' | '));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
