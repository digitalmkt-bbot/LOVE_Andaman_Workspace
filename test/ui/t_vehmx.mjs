// §vehMxHead · Transfer Fleet → ตารางเดือน · หัวแถวเดียว · แถบสรุป+สี เฉพาะโปรแกรมที่ใช้ · ที่เหลือพับ
// blob: python3 test/ui/_mk_subset_vck.py → LAD=allotment_v2/data_exports/subset_vck.json
import { open, goView } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1800, height: 900 });
await goView(page, 'vehicles', 1200);
const r = await page.evaluate(async () => { const z = ms => new Promise(f => setTimeout(f, ms));
  _vehMonth = '2026-10'; window._vehSumDay = '2026-10-15'; vehSetTab('matrix'); await z(600);
  const H = () => document.getElementById('vehicles-host'), q = s => H().querySelectorAll(s).length, t = s => (H().querySelector(s) || {}).textContent || '';
  const o = {};
  o.top = H().querySelector('#veh-matrix-scroll').getBoundingClientRect().top;
  o.head = H().querySelector('div > div').textContent.replace(/\s+/g, ' ');
  o.oldKpi = /รถรับ-ส่ง · วันนี้|ที่นั่งรวม|ต้องสนใจ|พร้อมวิ่งครบ/.test(H().textContent);
  o.chips = q('.vmx-chip'); o.allRoutes = (ROUTES || []).length; o.more = t('.vmx-more'); o.lgBefore = q('.vmx-lg');
  H().querySelector('.vmx-more').click(); await z(500); o.lgAfter = q('.vmx-lg'); o.moreAfter = t('.vmx-more');
  H().querySelector('.vmx-more').click(); await z(400); o.lgBack = q('.vmx-lg');
  // §vehMxFold · ยุบ/กางทีม · §vehMxTight · แถวเตี้ยลง
  try { localStorage.removeItem('veh_mx_fold'); } catch (_) {}
  const vis = () => [...H().querySelectorAll('tr.vmx-row')].filter(tr => tr.style.display !== 'none').length;
  o.rowsAll = vis(); o.rowH = H().querySelector('tr.vmx-row').getBoundingClientRect().height;
  o.ghd = q('tr.vmx-ghd'); o.gsub = q('tr.vmx-gsub');
  H().querySelector('tr.vmx-ghd').click(); await z(500); o.rowsFold1 = vis(); o.foldLbl = /ยุบอยู่/.test(H().querySelector('tr.vmx-ghd').textContent);
  const sub = H().querySelector('tr.vmx-gsub'); const subCount = parseInt(sub.textContent.match(/(\d+)\s*$/)[1], 10); sub.click(); await z(500); o.rowsFold2 = vis(); o.subCount = subCount;
  o.saved = JSON.parse(localStorage.getItem('veh_mx_fold') || '{}');
  [...H().querySelectorAll('.vmx-foldall button')][1].click(); await z(500); o.rowsNone = vis(); o.subHidden = [...H().querySelectorAll('tr.vmx-gsub')].every(tr => tr.style.display === 'none');
  [...H().querySelectorAll('.vmx-foldall button')][0].click(); await z(500); o.rowsBack = vis();
  // แท็บอื่นยังมีหัวเดิม
  vehSetTab('registry'); await z(400); o.regOld = /รถรับ-ส่ง · วันนี้|ที่นั่งรวม|ต้องสนใจ/.test(H().textContent); o.regHead = /Transfer Fleet/.test(H().querySelector('div > div').textContent) && /เพิ่มรถ/.test(H().querySelector('div > div').textContent); vehSetTab('status'); await z(400); o.stOld = /รถรับ-ส่ง · วันนี้|ต้องสนใจ|พร้อมวิ่งครบ/.test(H().textContent); vehSetTab('matrix'); await z(300);
  return o;
});
const J = JSON.stringify(r);
if (r.top < 90 && /Transfer Fleet/.test(r.head) && /ตารางเดือน/.test(r.head) && /ตุลาคม 2569/.test(r.head) && /ทั้งหมด/.test(r.head) && /คัน/.test(r.head) && /เพิ่มรถ/.test(r.head)) ok('หัวแถวเดียว · ตารางเริ่มที่ ' + Math.round(r.top) + 'px'); else fail('head ' + J);
if (!r.oldKpi) ok('ไม่มี KPI การ์ดใหญ่ / การ์ดสรุปแบบเดิมในแท็บตารางเดือน'); else fail('oldkpi ' + J);
if (r.chips > 0 && r.chips < r.allRoutes && /\+ \d+ โปรแกรมที่ไม่ได้ใช้/.test(r.more) && r.chips + r.lgBefore + parseInt(r.more.match(/\d+/)[0], 10) === r.allRoutes) ok('ชิปโปรแกรมวันนี้ ' + r.chips + ' + ใช้ในเดือน ' + r.lgBefore + ' + พับ ' + r.more.match(/\d+/)[0] + ' = ' + r.allRoutes + ' เส้นทาง'); else fail('chips ' + J);
if (r.lgAfter > r.lgBefore && r.moreAfter === 'พับ' && r.lgBack === r.lgBefore) ok('กด + กางโปรแกรมที่ไม่ได้ใช้ ' + r.lgAfter + ' · กด พับ กลับ'); else fail('toggle ' + J);
if (r.rowH < 36) ok('แถวรถสูง ' + Math.round(r.rowH) + 'px (เดิม ~53)'); else fail('rowH ' + r.rowH);
if (r.ghd === 2 && r.gsub >= 1 && r.rowsFold1 < r.rowsAll && r.foldLbl && r.rowsFold2 === r.rowsFold1 - r.subCount && Object.keys(r.saved).length === 2) ok('ยุบทีมหลัก → ซ่อน ' + (r.rowsAll - r.rowsFold1) + ' คัน · ยุบซัพ → ซ่อนอีก ' + r.subCount + ' · จำไว้ใน localStorage'); else fail('fold ' + J);
if (r.rowsNone === 0 && r.subHidden && r.rowsBack === r.rowsAll) ok('ยุบหมด → 0 แถว (ซัพซ่อนด้วย) · กางหมด → ' + r.rowsBack); else fail('foldall ' + J);
if (!r.regOld && r.regHead && !r.stOld) ok('แท็บทะเบียน/สถานะ ใช้หัวแถวเดียวชุดเดียวกัน · ไม่มี KPI การ์ดเดิม'); else fail('tabs ' + J);
const errs = errors.filter(e => !/404|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED/.test(e));
if (errs.length) { fail('page errors'); console.log('    errors:', errs.slice(0, 3)); }
console.log(bad ? `FAIL ${bad}` : 'PASS'); await close(); process.exit(bad ? 1 : 0);
