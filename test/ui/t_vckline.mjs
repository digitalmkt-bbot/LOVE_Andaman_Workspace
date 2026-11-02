// §vckLine · แถว "ตามแขก" → ปุ่ม LINE → ข้อความ EN จากเทมเพลต (มีโปรแกรม/วันที่/คนขับ) · แก้เทมเพลตทั้งบริษัท · คัดลอกแล้วจด lineSent
// blob: LAD=allotment_v2/data_exports/subset_vck.json
import { open, goView } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 900 });
page.on('dialog', d => d.accept());
await goView(page, 'vancheckin', 1200);
const r = await page.evaluate(async () => { const z = ms => new Promise(f => setTimeout(f, ms));
  window._vanCkDate = '2026-10-15'; _vckFam = null; _vckRoute = null; _vckPier = null; renderVanCheckin(); await z(500);
  const H = () => document.getElementById('vancheckin-host'), o = {};
  // เลือกแถวแรกที่มีรถ → ตั้งสถานะ ตามแขก · ตั้งเวลาสแตนบายของคันนั้น
  const row = [...H().querySelectorAll('tr.ck-row[data-bk], tbody tr')].find(tr => tr.querySelector('select.vck-sel'));
  const sel = row.querySelector('select.vck-sel'); const m = sel.getAttribute('onchange').match(/vckStatus\('([^']+)','([^']+)','([^']+)'/);
  const bkId = m[1], date = m[2], kind = m[3];
  o.btnWait = !!row.querySelector('.vck-ln.q');   // §vckLine2 · แถว รอ ก็มีปุ่ม (แบบขอบ)
  vckStatus(bkId, date, kind, 'pending'); await z(500);
  o.btn = !!H().querySelector('.vck-ln'); o.noLnBefore = H().querySelectorAll('.vck-lnsent').length;
  const b = SB_BOOKINGS.find(x => x.id === bkId); const t = b.trips.find(x => x.date === date); const rt = getRoute(t.routeId);
  const rowNow = [...H().querySelectorAll('select.vck-sel')].find(s => (s.getAttribute('onchange') || '').includes("'" + bkId + "'")).closest('tr'); rowNow.querySelector('.vck-ln').click(); await z(400);
  const dlg = () => document.querySelector('.vck-lndlg'); const ta = () => document.getElementById('vck-ln-msg');
  o.dlg = !!dlg(); o.msg = ta().value;
  o.hasProg = o.msg.includes(rt.name); o.hasDate = /\(15 Oct\)/.test(o.msg); o.hasVoucher = o.msg.includes(String(b.voucherRef || b.code || b.id).trim()); o.noBraces = !/\{(program|date|voucher|guest|hotel|driver)\}/.test(o.msg);
  o.lines = o.msg.split('\n').length;
  // เติมประโยคเสริม
  const addBtn = dlg().querySelector('.vck-lnex-row button'); addBtn.click(); await z(100); o.afterInsert = ta().value.split('\n').length;
  // แก้เทมเพลต → บันทึก → ข้อความใหม่ใช้เทมเพลตใหม่
  vckLineTab('tpl'); await z(200); o.tplTab = !!document.getElementById('vck-ln-tpl');
  document.getElementById('vck-ln-tpl').value = 'TEST {program} on {date} – {guest} ({voucher})'; vckLineTplSave(); await z(300);
  o.savedTpl = (JSON.parse(localStorage.getItem('loveandaman_v2')).vck_line_tpl || ''); o.msg2 = ta().value;
  o.msg2ok = o.msg2.startsWith('TEST ' + rt.name + ' on 15 Oct');
  // คัดลอก → จด lineSent · ช่องบันทึกโชว์ LINE
  vckLineCopy(); await z(2200);
  o.closed = !dlg(); const ck = ckRead(SB_BOOKINGS.find(x => x.id === bkId), date, kind); o.sent = (ck.lineSent || []).length; o.sentBy = ck.lineSent && ck.lineSent[0].by;
  o.noteHasLine = [...H().querySelectorAll('select.vck-sel')].find(s => (s.getAttribute('onchange') || '').includes("'" + bkId + "'")).closest('tr').querySelectorAll('.vck-lnsent').length;
  // รอบสอง → {nth} = 2nd
  const D = vckLineData(SB_BOOKINGS.find(x => x.id === bkId), date, kind, '');
  o.nth = D.nth;
  // §vckLine3 · ล้างประวัติจากในกล่อง
  const rowX = [...H().querySelectorAll('select.vck-sel')].find(s => (s.getAttribute('onchange') || '').includes("'" + bkId + "'")).closest('tr'); rowX.querySelector('.vck-lnsent').click(); await z(300);
  o.clrBtn = !!document.querySelector('.vck-lnclr'); vckLineClearLog(); await z(400);
  o.afterClr = ((ckRead(SB_BOOKINGS.find(x => x.id === bkId), date, kind) || {}).lineSent || []).length; o.chipGone = rowX.querySelectorAll('.vck-lnsent').length === 0 || !document.getElementById('vancheckin-host').contains(rowX); vckLineClose();
  // §vckBackWait · dropdown มี "ล้าง → รอ" เมื่อเป็น standby/pending · เลือกแล้วกลับเป็น รอ
  const selP = [...H().querySelectorAll('select.vck-sel')].find(s => (s.getAttribute('onchange') || '').includes("'" + bkId + "'"));
  o.hasWaitOpt = [...selP.options].some(op => op.value === 'wait'); vckStatus(bkId, date, kind, 'wait'); await z(400);
  o.backWait = vckRowSt(ckRead(SB_BOOKINGS.find(x => x.id === bkId), date, kind)) === 'wait';
  const selW = [...H().querySelectorAll('select.vck-sel')].find(s => (s.getAttribute('onchange') || '').includes("'" + bkId + "'")); o.noWaitOptWhenWait = ![...selW.options].some(op => op.value === 'wait');
  // คืนค่า · ล้างสถานะกลับ
  try { const bb = laBlob(); delete bb.vck_line_tpl; laBlobSave(); } catch (_) {}
  return o;
});
const J = JSON.stringify(r);
if (r.btnWait && r.btn && r.noLnBefore === 0 && r.dlg) ok('ปุ่ม LINE มีตั้งแต่สถานะ รอ (แบบขอบ) และ ตามแขก · กดแล้วเปิดกล่อง'); else fail('btn ' + J);
if (r.hasProg && r.hasDate && r.hasVoucher && r.noBraces && r.lines >= 5 && r.lines <= 7) ok('ข้อความ EN ' + r.lines + ' บรรทัด · มีโปรแกรม · วันที่ (15 Oct) · voucher · ไม่มี {ตัวแปร} ค้าง'); else fail('msg ' + J);
if (r.afterInsert === r.lines + 1) ok('ปุ่มเติมประโยคเสริม → เพิ่ม 1 บรรทัด'); else fail('insert ' + J);
if (r.tplTab && /TEST \{program\}/.test(r.savedTpl) && r.msg2ok) ok('แก้เทมเพลต → บันทึกทั้งบริษัท → ข้อความใหม่ตามเทมเพลต: ' + r.msg2.slice(0, 50)); else fail('tpl ' + J);
if (r.closed && r.sent === 1 && r.sentBy && r.noteHasLine === 1) ok('คัดลอกแล้วปิดกล่อง · จด lineSent 1 ครั้ง โดย ' + r.sentBy + ' · ช่องบันทึกโชว์ LINE'); else fail('copy ' + J);
if (r.nth === '2nd') ok('ครั้งถัดไป {nth} = 2nd'); else fail('nth ' + J);
if (r.hasWaitOpt && r.backWait && r.noWaitOptWhenWait) ok('dropdown มี "↩ ล้าง → รอ" ตอน standby/pending · เลือกแล้วกลับเป็น รอ'); else fail('wait ' + J);
if (r.clrBtn && r.afterClr === 0) ok('กดชิป LINE ในแถว → กล่องมีปุ่มล้างประวัติ → ล้างแล้ว lineSent = 0'); else fail('clear ' + J);
const errs = errors.filter(e => !/404|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|clipboard|Clipboard/.test(e));
if (errs.length) { fail('page errors'); console.log('    errors:', errs.slice(0, 3)); }
console.log(bad ? `FAIL ${bad}` : 'PASS'); await close(); process.exit(bad ? 1 : 0);
