// §pcRfName · เงินคืนจับคู่กับรายการตั้งเบิกด้วย "แก่น" ของชื่อ + วันที่ · ไม่หักรายการแรกของวันมั่ว ๆ
// ข้อมูล: LAD=allotment_v2/data_exports/subset_inv1020.json (มี po_cash_rows / po_cash_claims ของทับละมุ 16/10 จริง)
import { open } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1400, height: 900 });
const r = await page.evaluate(() => {
  const pier = 'tublamu', ds = '2026-10-21';
  const D = pcDay(pier, ds, true);
  const add = (id, at, txt, amt) => D.in.push({ id, at, txt, amt, by: 'AC', ts: ds + 'T' + at + ':00Z', kind: 'in' });
  add('rf1', '09:44', 'รับเงินคืนรายการตั้งเบิกเงินหน้าท่านอกระบบ 16/10/26', 27700);
  add('rf2', '10:39', 'รับเงินคืนรายการตั้งเบิกค่าอุทยานสุรินทร์ 16/10/26', 17100);
  add('rf3', '10:44', 'รับเงินคืนรายการตั้งเบิกค่าอุทยาน 16/10/26', 23600);
  add('rf4', '10:50', 'รับเงินคืน 16/10/26', 27212);
  const M = pcRefundMatch(pier);
  const g = id => { const x = M.res[id]; return { how: x.how, lab: pcRefundLab(M, x), diff: x.diff, exact: x.exact, units: x.cov.map(c => c.name + ':' + c.amt) }; };
  return { core: [pcNmCore('รับเงินคืนรายการตั้งเบิกเงินหน้าท่านอกระบบ 16/10/26'), pcNmCore('รายการตั้งเบิกหน้าท่านอกระบบ 16/10/69'), pcNmCore('รายการตั้งเบิกค่าอุทยานสิมิลัน 17 ต.ค. 69')],
    rf1: g('rf1'), rf2: g('rf2'), rf3: g('rf3'), rf4: g('rf4'), open16: M.keys.filter(k => M.U[k].ds === '2026-10-16' && M.urem[k] > 0).map(k => M.U[k].name + ':' + M.urem[k]) };
});
const R = JSON.stringify(r);
if (r.core[0] === 'หน้าท่านอกระบบ' && r.core[1] === 'หน้าท่านอกระบบ' && r.core[2] === 'อุทยานสิมิลัน') ok('แก่นชื่อ · ' + r.core.join(' / ')); else fail('core ' + R);
if (r.rf1.exact && /นอกระบบ 16\/10\/69/.test(r.rf1.lab) && r.rf1.how === 'name') ok('27,700 "เงินหน้าท่านอกระบบ 16/10/26" → นอกระบบ 16/10/69 · ตรง (เดิมไปหัก ในระบบ ก่อน ขาด 27,212)'); else fail('rf1 ' + R);
if (!r.rf2.exact && /สุรินทร์ 16\/10\/69/.test(r.rf2.lab) && r.rf2.diff === 3000) ok('17,100 "อุทยานสุรินทร์ 16/10" → สุรินทร์ 16/10 (14,100) · เกิน 3,000 = ผิดจริงในข้อมูล'); else fail('rf2 ' + R);
if (r.rf3.exact && /สิมิลัน 16\/10\/69/.test(r.rf3.lab)) ok('23,600 "ค่าอุทยาน 16/10" (ชื่อกว้าง) → เลือกสิมิลันเพราะยอดพอดี · ตรง'); else fail('rf3 ' + R);
if (r.rf4.exact && /ในระบบ 16\/10\/69/.test(r.rf4.lab) && r.rf4.how === 'text') ok('27,212 "16/10" ไม่มีชื่อ → ใช้วันที่ + ยอดพอดี → ในระบบ · ตรง'); else fail('rf4 ' + R);
if (r.open16.length === 0) ok('16/10 คืนครบทุกรายการ'); else fail('open ' + R);
if (errors.length) { fail('page errors'); console.log('    errors:', errors.slice(0, 3)); }
console.log(bad ? `FAIL ${bad}` : 'PASS'); await close(); process.exit(bad ? 1 : 0);
