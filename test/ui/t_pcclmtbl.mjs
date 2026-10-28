// §pcClmTbl · การ์ดรายการตั้งเบิกเป็นตารางจัดกลุ่มตามวัน · ตัวกรอง · เมนู ⋯ · แถวย่อยยังเปิดได้
// ข้อมูล: LAD=allotment_v2/data_exports/subset_inv1020.json (ทับละมุ ต.ค. 2026 · 17 รายการตั้งเบิกจริง)
import { open } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1440, height: 1000 });
page.on('dialog', d => d.dismiss());
const r = await page.evaluate(async () => {
  const z = ms => new Promise(f => setTimeout(f, ms));
  nav(document.querySelector('.nav-item[data-view="pop-tublamu"]')); await z(500);
  pcPickDay('2026-10-20'); await z(300);
  const H = document.getElementById('pc-host-tublamu');
  const card = () => H.querySelector('.pc2-clms');
  const T = () => card().querySelector('table.pcc-t');
  const txt = () => card().textContent;
  const dayRows = () => [...T().querySelectorAll('tr.pcc-d')].map(tr => tr.textContent.replace(/\s+/g, ' ').trim());
  const clRows = () => [...T().querySelectorAll('tr.pcc-r')];
  const o = { f0: card().querySelector('.pcc-f button.on').textContent, k: [...card().querySelectorAll('.pcc-k > div')].map(d => d.textContent.replace(/\s+/g, ' ').trim()), days0: dayRows(), n0: clRows().length, h0: card().getBoundingClientRect().height };
  const first = clRows()[0]; o.row0 = first.textContent.replace(/\s+/g, ' ').trim(); o.nm0 = first.querySelector('.pcc-nm b').textContent; o.dt0 = (first.querySelector('.pcc-nm small') || {}).textContent;
  pcClmSetF('all'); await z(200); o.nAll = clRows().length; o.nDaysAll = dayRows().length; o.foot = T().querySelector('tfoot').textContent.replace(/\s+/g, ' ').trim();
  pcClmSetF('norc'); await z(200); o.nNorc = clRows().length; o.norcAllBad = clRows().every(tr => tr.querySelector('.pcc-rc .bad'));
  pcClmSetF('all'); await z(200);
  // ย่อวัน
  const d0 = T().querySelector('tr.pcc-d .tg'); d0.click(); await z(200); o.nAfterCollapse = clRows().length; o.nDaysAfter = dayRows().length;
  T().querySelector('tr.pcc-d .tg').click(); await z(200);
  // เปิดแถวย่อย
  const id = clRows()[0].id.replace('pc-clm-', ''); pcClmToggle(id); await z(200);
  const x = T().querySelector('tr.pcc-x'); o.sub = x ? x.querySelectorAll('.l').length : -1;
  pcClmToggle(id); await z(100);
  // เมนู ⋯
  pcClmMenu(id); await z(150); const pop = T().querySelector('.pcc-pop'); o.pop = pop ? pop.textContent.replace(/\s+/g, ' ').trim() : '';
  pcClmMenu(id); await z(100); o.popGone = !T().querySelector('.pcc-pop');
  // ชื่อย่อ
  o.short = [pcClmShort('รายการตั้งเบิกเงินหน้าท่าในระบบ 20/10/26'), pcClmShort('รายการตั้งเบิกค่าอุทยานสิมิลัน 17 ต.ค. 69'), pcClmShort('รายการตั้งเบิกค่าอาหารกลางวันอุทยานสุรินทร์ 19/10/26 Verona'), pcClmShort('ค่าแรงไกด์ฟรีแลนซ์ 15/10/2026')];
  window.scrollTo(0, card().getBoundingClientRect().top + window.scrollY - 10);
  return o;
});
await page.screenshot({ path: '/mnt/user-data/outputs/pcclmtbl.png' });
const ov = await page.evaluate(() => { const w = document.querySelector('#pc-host-tublamu .pcc-w'); return { sw: w.scrollWidth, cw: w.clientWidth }; });
if (ov.sw <= ov.cw + 1) ok('ตารางพอดีคอลัมน์ ไม่ต้องเลื่อนข้าง (' + ov.cw + 'px)'); else fail('overflow ' + JSON.stringify(ov));
const R = JSON.stringify(r).slice(0, 1500);
if (/ค้างรับคืน/.test(r.f0)) ok('เปิดมาเริ่มที่ตัวกรอง "ค้างรับคืน"'); else fail('f0 ' + R);
if (r.k.length === 4 && /ตั้งเบิกทั้งเดือน฿/.test(r.k[0]) && /ค้างรับคืน/.test(r.k[2]) && /ยังไม่เลือกคนรับเงิน/.test(r.k[3])) ok('กล่องตัวเลขเดือน 4 ช่อง · ' + r.k.join(' | ')); else fail('k ' + R);
if (r.days0.length >= 3 && /19 OCT/.test(r.days0[0]) && /รายการ · \d+ แถว/.test(r.days0[0]) && /พิมพ์ทั้งวัน/.test(r.days0[0])) ok('หัววัน · ' + r.days0[0]); else fail('days ' + R);
if (r.nm0 && !/รายการตั้งเบิก/.test(r.nm0) && !/\d\/\d/.test(r.nm0) && r.dt0) ok('ชื่อย่อ "' + r.nm0 + '" · วันที่แยกเป็น ' + r.dt0); else fail('name ' + R);
if (r.nAll === 17 && r.nDaysAll === 5 && /17 รายการ · 5 วัน/.test(r.foot)) ok('ทั้งหมด 17 รายการ · 5 วัน · แถวรวมท้ายตาราง'); else fail('all ' + R);
if (r.nNorc > 0 && r.nNorc < r.nAll && r.norcAllBad) ok('กรอง "ยังไม่เลือกคนรับเงิน" · ' + r.nNorc + ' รายการ ทุกแถวมีค่าแดง'); else fail('norc ' + R);
if (r.nAfterCollapse < r.nAll && r.nDaysAfter === r.nDaysAll) ok('ย่อวัน · แถวในวันหาย หัววันยังอยู่'); else fail('collapse ' + R);
if (r.sub > 0) ok('กดลูกศร · เห็นแถวย่อย ' + r.sub + ' แถว'); else fail('sub ' + R);
if (/เปลี่ยนชื่อ/.test(r.pop) && /ยกเลิก/.test(r.pop) && r.popGone) ok('เมนู ⋯ · เปลี่ยนชื่อ / ยกเลิก · ปิดได้'); else fail('pop ' + R);
const S = r.short;
if (S[0].core === 'หน้าท่าในระบบ' && S[0].dt === '20/10/26' && S[1].core === 'ค่าอุทยานสิมิลัน' && /17ต\.ค\.69/.test(S[1].dt) && S[2].core === 'ค่าอาหารกลางวันอุทยานสุรินทร์ Verona' && S[3].core === 'ค่าแรงไกด์ฟรีแลนซ์') ok('ตัดคำซ้ำในชื่อถูกทุกแบบ'); else fail('short ' + JSON.stringify(S));
if (r.h0 < 1300) ok('การ์ดค้างรับคืนสูง ' + Math.round(r.h0) + 'px สำหรับ 17 รายการ (เดิม ~1,900px)'); else fail('height ' + r.h0);
if (errors.length) { fail('page errors'); console.log('    errors:', errors.slice(0, 3)); }
console.log(bad ? `FAIL ${bad}` : 'PASS'); await close(); process.exit(bad ? 1 : 0);
