// §pcGrp · เงินสดย่อย · สมุดเดินบัญชี · กลุ่มอัตโนมัติจากคำขึ้นต้นของรายการ
// ที่มา (2026-10-15) · owner ส่งภาพสมุด 15 ต.ค. (ค่ารถตู้นอกโซน… · ค่าแรงไกด์รัสเซีย… · ค่าอาหารกลางวัน… · ค่าอุทยานเกาะ…)
//   "เพิ่มประเภท เลือกประเภทนั้น สีเปลี่ยนทั้งบรรทัด และพ่วงไปถึงการปริ้น ให้สามารถปริ้นแบบทั้งกลุ่มของประเภทนั้นๆได้"
//   เลือกเองต่อบรรทัดต้องแก้ DB (ห้ามถึง 15 ต.ค.) · owner เลือกทางที่ 3 = จัดกลุ่มอัตโนมัติจากข้อความ ไม่บันทึกอะไรเพิ่ม
// กัน (วันสมมุติ 2099-01-03 ท่าทับละมุ · ใส่ในหน่วยความจำเท่านั้น)
//   1 แต่ละบรรทัดได้กลุ่มตามคำขึ้นต้น · "ค่าอาหารกลางวันอุทยานสุรินทร์" = อาหาร (ไม่ใช่อุทยาน) · บรรทัดที่ดึงจากชีท (src pk) = อุทยาน · ที่ไม่เข้าเกณฑ์ = ไม่มีกลุ่ม · รายรับไม่มีกลุ่ม
//   2 บนจอ: ทั้งบรรทัดเป็นสีของกลุ่ม (พื้น + แถบซ้าย) · ช่องหมวดเป็นชื่อกลุ่ม · ติ๊กเลือกแล้วยังเห็นสีเลือก
//   3 แถบ "พิมพ์ตามกลุ่ม" มีเฉพาะกลุ่มที่มีวันนี้ · จำนวน/ยอดถูก
//   4 กดพิมพ์กลุ่มรถตู้ → ใบรับรองมีเฉพาะรถตู้ · ยอดรวมถูก · หัวบอกกลุ่ม · 5 ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1100 });
await goView(page, 'pop-tublamu', 1000);
const S = { P: 'tublamu', D0: '2099-01-03' };
await page.evaluate(s => {
  window.pcGuard = () => true; window.pcSave = () => {}; window.pcCoName = () => 'TEST CO';
  const D = pcDay(s.P, s.D0, true); D.pk = {}; D.lt = {};
  D['in'] = [{ id: 'i1', txt: 'รับเงินจากออฟฟิศ', amt: 50000, at: '08:00' }];
  D.out = [
    { id: 'o1', txt: 'ค่ารถตู้นอกโซนภูเก็ต SL 15/10/26 (1คัน) นายA', amt: 2900, at: '16:02' },
    { id: 'o2', txt: 'ค่ารถตู้นอกโซนภูเก็ต SL 15/10/26 (2คัน) นายB', amt: 5900, at: '16:04' },
    { id: 'o3', txt: 'ค่าแรงไกด์รัสเซียไปเกาะสิมิลัน 15/10/26 (Romeo) SL', amt: 1500, at: '16:11' },
    { id: 'o4', txt: 'ค่าอาหารกลางวันอุทยานสุรินทร์ 15/10/26', amt: 11200, at: '19:01' },
    { id: 'pkl|tublamu|2099-01-03|zz1', src: 'pk', txt: 'ค่าอุทยานเกาะสิมิลัน 3 ม.ค. 42 Zeus', amt: 15100, at: '' },
    { id: 'o6', txt: 'ซื้อน้ำแข็ง', amt: 300, at: '19:30' }];
  _pcPier = s.P; _pcDate = s.D0; _pcYM = '2099-01'; _pcTab = 0; renderPierCash(s.P); }, S);
const c1 = await page.evaluate(s => { const D = pcDay(s.P, s.D0); return { out: D.out.map(x => (pcGrpOf(x, 'out') || {}).k || ''), inn: (pcGrpOf(D['in'][0], 'in') || {}).k || '' }; }, S);
if (JSON.stringify(c1.out) === JSON.stringify(['van', 'van', 'guide', 'food', 'park', '']) && !c1.inn) ok('1 กลุ่ม: รถตู้ · รถตู้ · ไกด์ · อาหาร (ค่าอาหาร…อุทยานสุรินทร์) · อุทยาน (ดึงจากชีท) · ไม่มีกลุ่ม · รายรับไม่มีกลุ่ม'); else fail('1 ' + JSON.stringify(c1));
const c2 = await page.evaluate(s => { const host = document.getElementById('pc-host-' + s.P);
  const row = id => document.getElementById(pcSelRowId('out', id)); const cs = e => e ? getComputedStyle(e) : {};
  const r1 = row('o1'), r6 = row('o6'), r4 = row('o4');
  const a = { bg1: cs(r1).backgroundColor, sh1: cs(r1).boxShadow, chip1: r1.querySelector('.ct em').textContent, bg6: cs(r6).backgroundColor, chip6: r6.querySelector('.ct em').textContent, bg4: cs(r4).backgroundColor };
  pcSelSet('out', 'o1', true); a.sel = cs(row('o1')).backgroundColor; pcSelSet('out', 'o1', false); return a; }, S);
if (c2.bg1 === 'rgb(255, 244, 236)' && /194, 65, 12/.test(c2.sh1) && c2.chip1 === 'รถตู้' && c2.bg4 === 'rgb(253, 240, 246)' && c2.chip6 === 'จ่ายอื่น' && c2.bg1 !== c2.bg6 && c2.sel !== c2.bg1)
  ok('2 ทั้งบรรทัดเป็นสีกลุ่ม (รถตู้ พื้นส้มอ่อน + แถบซ้าย · อาหาร ชมพู) · ช่องหมวด = ชื่อกลุ่ม · บรรทัดไม่มีกลุ่มเหมือนเดิม · ติ๊กแล้วเห็นสีเลือก');
else fail('2 ' + JSON.stringify(c2));
const c3 = await page.evaluate(s => [...document.querySelectorAll('#pc-host-' + s.P + ' .pc2-grps .g')].map(b => b.textContent.replace(/\s+/g, ' ').trim()), S);
if (JSON.stringify(c3) === JSON.stringify(['รถตู้2 รายการ · 8,800🖨', 'ไกด์1 รายการ · 1,500🖨', 'อาหาร1 รายการ · 11,200🖨', 'อุทยาน1 รายการ · 15,100🖨'])) ok('3 แถบพิมพ์ตามกลุ่ม · ' + c3.join(' | ')); else fail('3 ' + JSON.stringify(c3));
const c4 = await page.evaluate(s => { let html = ''; const fake = { document: { open() {}, write(h) { html += h; }, close() {} }, focus() {} }; const o = window.open; window.open = () => fake;
  [...document.querySelectorAll('#pc-host-' + s.P + ' .pc2-grps .g')][0].click(); window.open = o;
  const d = document.createElement('div'); d.innerHTML = html; const rows = [...d.querySelectorAll('.cf-tb tbody tr, .cf-tb tr')].map(r => (r.querySelector('td.t') || {}).textContent || '').filter(Boolean);
  return { rows, hasGuide: /ไกด์/.test(html.replace(/กลุ่ม[^<]*/g, '')), hdr: /กลุ่ม รถตู้ · 2 รายการ/.test(html), sum: /8,800/.test(html) }; }, S);
if (c4.rows.length === 2 && c4.rows.every(t => /^ค่ารถตู้/.test(t)) && !c4.hasGuide && c4.hdr && c4.sum) ok('4 พิมพ์กลุ่มรถตู้ → ใบรับรองมี 2 รายการรถตู้ · รวม 8,800 · หัวบอก "กลุ่ม รถตู้"'); else fail('4 ' + JSON.stringify(c4));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('5 ไม่มี error'); else fail('5 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
