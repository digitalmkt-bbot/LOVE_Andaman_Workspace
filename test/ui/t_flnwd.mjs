// §flnWd · Fleet Work › + เพิ่มงาน · เบิกอะไหล่จากสต็อกพร้อมสร้างงาน
//
// ที่มา (2026-10-26) · owner ส่งภาพฟอร์ม "งานตามแผน" "อันนี้เพิ่มรายการเบิกอะไหล่ไปด้วยได้ไหม User จะได้กดเบิกอะไหล่ เช่นพวกน้ำมันเครื่องไปด้วยเลย"
// ข้อมูลทดสอบ: อะไหล่ทดสอบ 2 ตัว · น้ำมันเครื่อง (VP 10 · TL 3 ลิตร) · กรองน้ำมัน (VP 2 ชิ้น) · เรือที่อยู่ท่าพันวา
// กัน
//   1 ฟอร์มงานตามแผน มีช่อง "เบิกอะไหล่จากสต็อก" · เลือกน้ำมันเครื่อง → คลังตั้งต้น = คลัง Visit Panwa (ท่าของเรือ)
//   2 เพิ่ม น้ำมัน 4 + กรอง 3 (เกินสต็อก → เตือน ไม่เพิ่ม) + กรอง 2 · ลบแล้วเพิ่มใหม่ได้ · แผงขวาขึ้น "เบิกจากสต็อก 2 รายการ" · ยังไม่หักสต็อกก่อนบันทึก
//   3 บันทึก → งานใหม่มีอะไหล่ 2 แถว (ต้นทุน 4×100 + 2×50) · สต็อก VP น้ำมัน 6 · กรอง 0 · ประวัติคลังผูกกับงาน · ข้อความแจ้ง "เบิกอะไหล่ 2 รายการแล้ว"
//   4 แจ้งปัญหา → เปิดงาน ก็มีช่องเดียวกัน · บันทึกแจ้งปัญหาอย่างเดียว (ไม่เปิดงาน) ไม่มีช่อง · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1100 });
const dlg = []; page.on('dialog', d => { dlg.push(d.message()); d.accept(); });
await goView(page, 'fl-work', 900);
const S = await page.evaluate(() => {
  const b = BOATS.filter(x => x && !x.retired && x.ownership !== 'charter' && x.pier === 'panwa')[0] || BOATS[0];
  b.assignments = [];
  FL_INVENTORY.push({ id: 'zzoil', name: 'Test Engine Oil', partNo: '', unit: 'L', cost: 100, stocks: [{ location: 'คลัง Visit Panwa', qty: 10 }, { location: 'คลัง Tub Lamu', qty: 3 }], history: [] });
  FL_INVENTORY.push({ id: 'zzflt', name: 'Test Oil Filter', partNo: '', unit: 'pc', cost: 50, stocks: [{ location: 'คลัง Visit Panwa', qty: 2 }], history: [] });
  FLW.boat = b.id; flRenderWork(); flnOpen(); FLN.kind = 'job'; flnRender();
  const box = !!document.querySelector('#fln .fln-wd');
  const inp = document.getElementById('fln-inv'); inp.value = flnInvLabel(FL_INVENTORY.find(x => x.id === 'zzoil')); inp.dispatchEvent(new Event('input', { bubbles: true }));
  const first = document.getElementById('fln-inv-loc').value;
  return { bid: b.id, box, first };
});
if (S.box && S.first === 'คลัง Visit Panwa') ok('1 ฟอร์มงานตามแผนมีช่องเบิกอะไหล่ · เลือกน้ำมันเครื่อง → คลังตั้งต้น "' + S.first + '"');
else fail('1 ' + JSON.stringify(S));

const R2 = await page.evaluate(() => {
  const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
  const add = (inv, q) => { set('fln-inv', flnInvLabel(FL_INVENTORY.find(x => x.id === inv))); set('fln-inv-qty', String(q)); document.querySelector('#fln [data-a="wadd"]').click(); };
  add('zzoil', 4); add('zzflt', 3); const after3 = FLN.wd.length;
  add('zzflt', 2); const n2 = FLN.wd.length;
  document.querySelector('#fln [data-a="wdel"][data-v="1"]').click(); const n1 = FLN.wd.length;
  add('zzflt', 2);
  set('fln-title', 'Test 100-hour service');
  const prev = document.getElementById('fln-prev').textContent.replace(/\s+/g, ' ');
  const stock = FL_INVENTORY.find(x => x.id === 'zzoil').stocks[0].qty;
  return { after3, n2, n1, wd: FLN.wd.map(w => w.name + ' ' + w.qty + ' ' + w.loc), prev, stock };
});
if (R2.after3 === 1 && R2.n2 === 2 && R2.n1 === 1 && R2.wd.length === 2 && dlg.some(m => /Not enough stock/.test(m)) && /เบิกจากสต็อก/.test(R2.prev) && /2 รายการ/.test(R2.prev) && R2.stock === 10)
  ok('2 เพิ่ม ' + R2.wd.join(' · ') + ' · เกินสต็อกเตือน "' + dlg.find(m => /Not enough/.test(m)) + '" · ลบ/เพิ่มได้ · แผงขวาขึ้นเบิกจากสต็อก · ยังไม่หักสต็อก');
else fail('2 ' + JSON.stringify({ R2, dlg }));

const R3 = await page.evaluate(async () => {
  let toast = ''; const ot = window.flShowToast; window.flShowToast = t => { toast = t; };
  const n0 = FL_MAINT.length;
  document.querySelector('#fln [data-a="save"]').click();
  await new Promise(r => setTimeout(r, 600));
  window.flShowToast = ot;
  const m = FL_MAINT.length > n0 ? FL_MAINT[0] : null;
  const oil = FL_INVENTORY.find(x => x.id === 'zzoil'), flt = FL_INVENTORY.find(x => x.id === 'zzflt');
  try { document.querySelectorAll('.modal.show,.modal.open').forEach(x => x.classList.remove('show', 'open')); } catch (_) { }
  return { title: m && m.title, parts: m ? (m.parts || []).map(p => p.name + ' ' + p.qty + ' @' + p.location) : [], cost: m ? flMaintCalcCost(m.id) : 0,
    oil: oil.stocks.map(s => s.qty), flt: flt.stocks.map(s => s.qty), hist: oil.history.filter(h => h.type === 'withdraw' && m && h.jobId === m.id).length, toast };
});
if (R3.title === 'Test 100-hour service' && R3.parts.length === 2 && R3.cost === 500 && R3.oil.join() === '6,3' && R3.flt.join() === '0' && R3.hist === 1 && /เบิกอะไหล่ 2 รายการแล้ว/.test(R3.toast))
  ok('3 บันทึก → งานมีอะไหล่ ' + R3.parts.join(' · ') + ' · ต้นทุน ฿' + R3.cost + ' · สต็อก VP น้ำมัน 6 · กรอง 0 · "' + R3.toast + '"');
else fail('3 ' + JSON.stringify(R3));

const R4 = await page.evaluate(() => {
  flnOpen(); FLN.kind = 'inc'; FLN.next = 'job'; flnRender(); const a = !!document.querySelector('#fln .fln-wd');
  FLN.next = 'record'; flnRender(); const b = !!document.querySelector('#fln .fln-wd'); flnClose(); return { a, b };
});
if (R4.a && !R4.b && errors.length === 0) ok('4 แจ้งปัญหา → เปิดงาน มีช่องเบิก · บันทึกไว้ก่อน ไม่มีช่อง · ไม่มี error');
else fail('4 ' + JSON.stringify({ R4, errors: errors.slice(0, 3) }));
await close();
if (bad) { console.log(bad + ' FAILED'); process.exit(1); } console.log('ALL OK');
