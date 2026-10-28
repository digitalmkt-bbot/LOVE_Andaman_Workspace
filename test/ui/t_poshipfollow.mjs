// §poShipFollow · ของประจำเรือเดินตามเรือ · ลำขึ้นที่ท่าที่เรือจอดตามตารางย้ายท่า · ไม่ปนสต็อกคลังท่า
//
// ที่มา (2026-10-27) · owner ส่งภาพ Equipment ทับละมุ "ตรวจสอบ เรือมันต้องโยกสลับตามตารางหรือไม่"
//   backup 27 ต.ค.: Achilles รับหน้ากาก 70 จากทับละมุ · ตารางย้ายท่า พันวา 23–28 ต.ค. แล้วกลับทับละมุ 29 ต.ค.
//   owner: "ของที่อยู่บนเรือ ก็คืออยู่บนเรือเลย ไม่นับปนกับสต๊อคอื่นๆ"
// ข้อมูลทดสอบ: เรือ X (บ้านทับละมุ) · ย้ายไปพันวา D-4..D+1 · กลับทับละมุ D+2
//   ของทดสอบ: หน้ากาก TL (ทะเบียน 100 · ลงเรือ X 70) · ตีนกบ VP (ทะเบียน 20)
// กัน
//   1 วัน D · หน้าพันวามีการ์ด X 70 ชิ้น ป้าย "ของทับละมุ 70" · หน้าทับละมุไม่มีการ์ด X แต่มีบรรทัด "ไปจอดท่าอื่นตามตาราง · X → Visit Panwa (ของท่านี้ 70 ชิ้น)"
//   2 สต็อกคลังไม่เปลี่ยน · หน้ากาก TL พร้อมใช้ 30 ประจำเรือ 70 · ตีนกบ VP พร้อมใช้ 20
//   3 ตรวจที่พันวา: แถวหน้ากากไม่มีช่องเติม/ถอด (บอกว่าถอดคืนที่ทับละมุ) · นับได้ 68 ขาด 2 (หาย) + เติมตีนกบ VP 5
//     → ของหายลงบัญชีท่าทับละมุ (หมายเหตุ "ตรวจที่Visit Panwa") · เติมลงบัญชีพันวา · การ์ด 73 ชิ้น
//   4 วัน D+2 (กลับทับละมุ) · การ์ดย้ายไปหน้าทับละมุ 73 ชิ้น ป้าย "ของVisit Panwa 5" · พันวาไม่มี X · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'pop-panwa', 900);
const R1 = await page.evaluate(() => {
  window.poCanEdit = () => true; window.poWhoGuard = () => true;
  const add = (ymd, n) => { const t = new Date(ymd + 'T00:00:00'); t.setDate(t.getDate() + n); return poYMD(t); };
  const D = '2026-10-26'; window.__D = D; window.__D2 = add(D, 2);
  const b = BOATS.filter(x => x && x.id && !x.retired)[0]; window.__X = b.id;
  b.pier = 'tublamu';
  b.assignments = [{ id: 'zza1', toPier: 'panwa', startDate: add(D, -4), endDate: add(D, 1), status: 'active' },
                   { id: 'zza2', toPier: 'tublamu', startDate: add(D, 2), status: 'planned' }];
  PIER_ITEMS.push({ id: 'zzmask', pier: 'tublamu', kind: 'mask', label: 'Test Mask TL', total: 100, active: true });
  PIER_ITEMS.push({ id: 'zzfin', pier: 'panwa', kind: 'fin', label: 'Test Fin VP', total: 20, active: true });
  PIER_MOVES.push({ id: 'zzm1', date: add(D, -12), pier: 'tublamu', itemId: 'zzmask', boatId: b.id, type: 'assign', qty: 70, note: 'test' });
  _poDate = D;
  const card = pier => { renderPierOffice(pier); const h = document.getElementById('po-host-' + pier);
    const c = h.querySelector('.po-shipcard[data-bid="' + b.id + '"]'); const aw = h.querySelector('.po-shipaway');
    return { card: c ? c.textContent.replace(/\s+/g, ' ') : '', away: aw ? aw.textContent.replace(/\s+/g, ' ') : '' }; };
  const vp = card('panwa'), tl = card('tublamu');
  const m = poBal('zzmask'), f = poBal('zzfin');
  return { nm: poLdgBoatNm(b.id), vp, tl, m: [m.ready, m.onship], f: [f.ready, f.onship] };
});
if (/70 ชิ้น/.test(R1.vp.card) && /ของทับละมุ 70/.test(R1.vp.card) && !R1.tl.card && R1.tl.away.includes(R1.nm + ' → Visit Panwa (ของท่านี้ 70 ชิ้น)'))
  ok('1 วัน D · พันวาเห็น ' + R1.nm + ' 70 ชิ้น "ของทับละมุ 70" · ทับละมุ: "' + R1.tl.away.trim() + '"');
else fail('1 ' + JSON.stringify(R1));
if (R1.m.join() === '30,70' && R1.f.join() === '20,0') ok('2 สต็อกคลังไม่เปลี่ยน · หน้ากาก TL พร้อมใช้ 30 ประจำเรือ 70 · ตีนกบ VP พร้อมใช้ 20');
else fail('2 ' + JSON.stringify({ m: R1.m, f: R1.f }));

const R3 = await page.evaluate(() => {
  const X = window.__X; renderPierOffice('panwa');
  poShipBoatOpen(X);
  const row = document.querySelector('.psrow[data-id="zzmask"]');
  const fx = row ? (row.querySelector('.psfx') || {}).textContent || '' : '';
  const noAdd = !document.getElementById('psa_zzmask') && !document.getElementById('psb_zzmask');
  const finAdd = !!document.getElementById('psa_zzfin');
  document.getElementById('psc_zzmask').value = '68'; poShipBoatDiff(X, 'zzmask');
  document.getElementById('psr_zzmask').value = 'ship_lost';
  document.getElementById('psa_zzfin').value = '5';
  document.getElementById('psn').value = 'test check';
  const saved = poShipBoatSave(X);
  const mv = PIER_MOVES.filter(m => m.boatId === X && m.id !== 'zzm1').map(m => m.type + ':' + m.pier + ':' + m.itemId + ':' + m.qty + ':' + (m.note || ''));
  const h = document.getElementById('po-host-panwa'), c = h.querySelector('.po-shipcard[data-bid="' + X + '"]');
  const m = poBal('zzmask'), f = poBal('zzfin');
  return { fx, noAdd, finAdd, saved, mv, card: c ? c.textContent.replace(/\s+/g, ' ') : '', m: [m.ready, m.onship, m.gone], f: [f.ready, f.onship] };
});
const lost = R3.mv.find(x => x.startsWith('ship_lost:'));
const asg = R3.mv.find(x => x.startsWith('assign:'));
if (R3.saved && R3.noAdd && R3.finAdd && /ถอดคืนที่ทับละมุ/.test(R3.fx) && lost && lost.startsWith('ship_lost:tublamu:zzmask:2:') && /ตรวจที่Visit Panwa/.test(lost)
    && asg && asg.startsWith('assign:panwa:zzfin:5:') && /73 ชิ้น/.test(R3.card) && R3.m.join() === '30,68,2' && R3.f.join() === '15,5')
  ok('3 ตรวจที่พันวา · หน้ากาก TL ไม่มีช่องเติม/ถอด ("' + R3.fx.trim() + '") · หาย 2 ลงบัญชีทับละมุ · เติมตีนกบ VP 5 ลงบัญชีพันวา · การ์ด 73 ชิ้น');
else fail('3 ' + JSON.stringify(R3));

const R4 = await page.evaluate(() => {
  const X = window.__X; _poDate = window.__D2;
  const card = pier => { renderPierOffice(pier); const h = document.getElementById('po-host-' + pier);
    const c = h.querySelector('.po-shipcard[data-bid="' + X + '"]'); const aw = h.querySelector('.po-shipaway');
    return { card: c ? c.textContent.replace(/\s+/g, ' ') : '', away: aw ? aw.textContent : '' }; };
  return { vp: card('panwa'), tl: card('tublamu') };
});
if (/73 ชิ้น/.test(R4.tl.card) && /ของVisit Panwa 5/.test(R4.tl.card) && !R4.vp.card && /→ ทับละมุ \(ของท่านี้ 5 ชิ้น\)/.test(R4.vp.away) && errors.length === 0)
  ok('4 วัน D+2 กลับทับละมุ · การ์ดย้ายไปทับละมุ 73 ชิ้น "ของVisit Panwa 5" · พันวาเหลือบรรทัดแจ้ง · ไม่มี error');
else fail('4 ' + JSON.stringify({ R4, errors: errors.slice(0, 3) }));
await close();
if (bad) { console.log(bad + ' FAILED'); process.exit(1); } console.log('ALL OK');
