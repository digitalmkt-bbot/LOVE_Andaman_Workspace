// §pcDec2 · เงินสดย่อยหน้าท่า · ยอดเงินมีทศนิยม (สตางค์) ต้องบันทึกได้และไม่ถูกปัด
//
// ที่มา (2026-10-26) · owner "ตรวจสอบ Petty cash ใส่ทศนิยม แล้วไม่บันทึก ต้องสามารถใส่ได้"
//   ช่องกรอกรับ 12.50 อยู่แล้ว แต่ทางเก็บลงแถว (pcFlatten) ปัด Math.round · คอลัมน์ฐานข้อมูลเป็น bigint
//   → รีเฟรชแล้วเป็น 13 · 0.40 กลายเป็น 0
// กัน
//   1 จ่ายออก 12.50 → แถวที่จะส่งขึ้นเซิร์ฟเวอร์ (po_cash_rows) = 12.5 · 0.40 → 0.4 (ไม่หาย)
//   2 สร้างหน้าจอใหม่จากแถว (เหมือนหลังรีเฟรช) → ยังเป็น 12.5 / 0.4 · ยอดรวมจ่ายของวัน = 12.9
//   3 ชีทหางยาว ยอดเงิน "1,500.75" → 1500.75 · จำนวนลำยังเป็นจำนวนเต็ม · ชีทค่าอุทยาน ค่าจอด 0.5 / จ่ายจริง 80.25 → เก็บตามนั้น · หัวคนจำนวนเต็ม
//   4 localStorage ที่แอปเขียนจริงมีค่าทศนิยม · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'pop-panwa', 900);
const R = await page.evaluate(async () => {
  window.poCanEdit = () => true;
  _pcPier = 'panwa'; _pcDate = '2026-10-26';
  const add = (v) => { pcRowAdd('out'); document.getElementById('pc-r-txt').value = 'test ' + v; document.getElementById('pc-r-amt').value = v; pcRowSave('out'); };
  add('12.50'); add('0.40');
  const mine = pcRowsArr().filter(x => x.date === '2026-10-26' && /^test /.test(x.txt));
  const r1 = mine.map(x => x.amt);
  _PC_ARR = null; _PC_MEM = null; pcSync();
  const D = pcDay('panwa', '2026-10-26', false);
  const r2 = (D.out || []).filter(x => /^test /.test(x.txt || '')).map(x => x.amt);
  const sum = (D.out || []).filter(x => /^test /.test(x.txt || '')).reduce((a, x) => a + x.amt, 0);
  const bid = 'zzboat';
  pcSetLT('2026-10-26', bid, 'amt', '1,500.75'); pcSetLT('2026-10-26', bid, 'nj', '2');
  pcSetPK('2026-10-26', bid, 'dock', '0.5'); pcSetPK('2026-10-26', bid, 'amt', '80.25'); pcSetPK('2026-10-26', bid, 'ad_th', '3');
  const lt = pcLtArr().filter(x => x.bid === bid)[0] || {}, pk = pcPkArr().filter(x => x.bid === bid)[0] || {};
  const ls = localStorage.getItem('loveandaman_v2') || '';
  return { r1, r2, sum: Math.round(sum * 100) / 100, lt: { amt: lt.amt, nj: lt.nj }, pk: { dock: pk.dock, amt: pk.amt, ad_th: pk.ad_th },
    ls: /"amt":12\.5[,}]/.test(ls) && /"amt":1500\.75/.test(ls) && /"dock":0\.5/.test(ls) };
});
if (R.r1.join() === '12.5,0.4') ok('1 จ่ายออก 12.50 / 0.40 → แถวส่งขึ้นเซิร์ฟเวอร์ ' + R.r1.join(' / ') + ' (ไม่ถูกปัด)');
else fail('1 ' + JSON.stringify(R));
if (R.r2.join() === '12.5,0.4' && R.sum === 12.9) ok('2 สร้างหน้าจอใหม่จากแถว (เหมือนรีเฟรช) → ' + R.r2.join(' / ') + ' · รวม ' + R.sum);
else fail('2 ' + JSON.stringify(R));
if (R.lt.amt === 1500.75 && R.lt.nj === 2 && R.pk.dock === 0.5 && R.pk.amt === 80.25 && R.pk.ad_th === 3) ok('3 หางยาว ฿1,500.75 · ลำ 2 · อุทยาน ค่าจอด 0.5 · จ่ายจริง 80.25 · หัวคน 3');
else fail('3 ' + JSON.stringify({ lt: R.lt, pk: R.pk }));
if (R.ls && errors.length === 0) ok('4 localStorage ที่แอปเขียนมีทศนิยมครบ · ไม่มี error');
else fail('4 ' + JSON.stringify({ ls: R.ls, errors: errors.slice(0, 3) }));
await close();
if (bad) { console.log(bad + ' FAILED'); process.exit(1); } console.log('ALL OK');
