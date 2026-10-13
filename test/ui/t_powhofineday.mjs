// §poWho · §poFine · §poDayClose · Pier Office (เบิก-คืนอุปกรณ์)
//
// ที่มา (9 ต.ค. 2026) · เจ้าของ: "1 2 3 และ ของที่ตรวจของประจำเรือ ตอนนี้มีระบุว่าหายได้ แต่มันมีกรณีที่เราสามารถได้ค่าปรับด้วย"
//   1 ผู้บันทึก · by ว่างทั้ง 1,177 รายการ เพราะ ME ไม่ใช่ global · ต้องเลือกชื่อจากทะเบียนพนักงานก่อนบันทึก
//   2 ค่าปรับค้างเก็บ · finePaid ไม่เคยถูกอ่าน · ต้องมีรายการ + ปุ่มรับเงิน/ยกเว้น
//   3 ปิดวัน · ใบของวันที่ปิดแล้วล็อก · เปิดใหม่ต้องมีเหตุผล
//   4 ตรวจของประจำเรือ · ขาดเพราะ "หาย" ใส่ค่าปรับได้
import { open } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'ทดสอบ' : undefined));
await page.waitForTimeout(800);

const prep = await page.evaluate(() => {
  // เปิดหน้า Pier Office ท่า panwa · เลือกวันที่มีเรือออก
  const el = document.querySelector('.nav-item[data-view="po-panwa"]') || [...document.querySelectorAll('.nav-item')].find(x => /เบิก/.test(x.textContent) );
  if (el) nav(el);
  _poPier = 'panwa';
  const dates = {}; (PIER_MOVES || []).forEach(m => { if (m.pier === 'panwa' && m.type === 'issue') dates[m.date] = (dates[m.date] || 0) + 1; });
  let best = null;
  for (const d of Object.keys(dates).sort().reverse()) { _poDate = d; renderPierOffice('panwa'); if (poBoats(d, 'panwa').length) { best = d; break; } }
  try { localStorage.removeItem('po_who::panwa'); } catch (_) {}
  renderPierOffice('panwa');
  const staff = poStaff('panwa');
  return { date: best, boats: poBoats(best, 'panwa').length, staff: staff.length, whoBar: !!document.getElementById('po-who'), acct: poWhoAcct(), who: poWho(),
           fineBtn: !![...document.querySelectorAll('#po-host-panwa .po-bar button')].find(b => /ค่าปรับ/.test(b.textContent)),
           closeBtn: !![...document.querySelectorAll('#po-host-panwa .po-btn')].find(b => /ปิดวัน/.test(b.textContent)) };
});
if (prep.boats && prep.staff && prep.whoBar && prep.fineBtn && prep.closeBtn) ok(`prep · วัน ${prep.date} · ${prep.boats} ลำ · พนักงาน ${prep.staff} คน · มีช่องผู้บันทึก/ปุ่มค่าปรับ/ปุ่มปิดวัน`);
else { fail('prep ' + JSON.stringify(prep)); await close(); process.exit(1); }

// 1 · ยังไม่เลือกผู้บันทึก → เปิดใบเบิก–คืนไม่ได้ · เลือกแล้วเปิดได้ และ by ลงชื่อ
const t1 = await page.evaluate(() => {
  const bid = poBoats(_poDate, 'panwa')[0].bid;
  poIssueOpen(bid); const blocked = !document.getElementById('po-modal');
  const s = poStaff('panwa')[0]; poWhoSet(s.id);
  const who = poWho();
  const mv = poAdd({ date: _poDate, pier: 'panwa', itemId: 'zz_test', type: 'count', qty: 0, note: 'zz_test' });
  const by = mv.by; PIER_MOVES.splice(PIER_MOVES.indexOf(mv), 1);
  poIssueOpen(bid); const opened = !!document.getElementById('po-modal'); poModalClose();
  return { blocked, who, nick: s.nick || s.name, by, opened };
});
if (t1.blocked && t1.opened && t1.who === t1.nick && t1.by === t1.nick) ok(`1 ไม่เลือกชื่อ → เปิดใบไม่ได้ · เลือก "${t1.nick}" → เปิดได้ · poAdd ลง by="${t1.by}"`);
else fail('1 ' + JSON.stringify(t1));

// 4 · ตรวจของประจำเรือ · ขาดเพราะหาย → ช่องค่าปรับโผล่ · บันทึกแล้ว ship_lost มี fine
const t4 = await page.evaluate(() => {
  const A = poShipAll('panwa'); if (!A.length) return { skip: true };
  const bid = A[0].bid, on = poShipOn(bid), id = Object.keys(on).find(k => on[k] > 0);
  poShipBoatOpen(bid);
  const c = document.getElementById('psc_' + id), sel = document.getElementById('psr_' + id), f = document.getElementById('psf_' + id);
  c.value = String(on[id] - 1); c.dispatchEvent(new Event('input', { bubbles: true }));
  const hiddenBefore = f.style.display === 'none';
  sel.value = 'ship_lost'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  const shown = f.style.display !== 'none';
  f.value = '350'; document.getElementById('psn').value = 'zz_test fine';
  const n0 = PIER_MOVES.length; poShipBoatSave(bid);
  const mv = PIER_MOVES.slice(n0).find(m => m.type === 'ship_lost');
  const res = { hiddenBefore, shown, saved: !!mv, fine: mv && mv.fine, paid: mv && mv.finePaid, by: mv && mv.by, id: mv && mv.id, modalClosed: !document.getElementById('po-modal') };
  return res;
});
if (t4.skip) ok('4 (ข้าม · ไม่มีของประจำเรือในชุดข้อมูล)');
else if (t4.hiddenBefore && t4.shown && t4.saved && t4.fine === 350 && t4.paid === false && t4.by && t4.modalClosed) ok(`4 ประจำเรือหาย 1 · ช่องค่าปรับโผล่เมื่อเลือก "หาย" · บันทึก fine=350 finePaid=false by=${t4.by}`);
else fail('4 ' + JSON.stringify(t4));

// 2 · ค่าปรับค้าง · รายการโผล่ · รับเงินแล้ว → หายจากค้าง · PIER_CFG.finePay มีคนปิด
const t2 = await page.evaluate((fid) => {
  const openN0 = poFineRows('panwa', false).length;
  const btn = [...document.querySelectorAll('#po-host-panwa .po-bar button')].find(b => /ค่าปรับ/.test(b.textContent));
  const btnTxt = btn && btn.textContent;
  poFineOpen();
  const rowsShown = document.querySelectorAll('#po-modal tbody tr').length;
  const target = fid || (poFineRows('panwa', false)[0] || {}).id;
  poFinePay(target, 'paid');
  const m = PIER_MOVES.find(x => x.id === target), P = poFinePayInfo(target);
  const openN1 = poFineRows('panwa', false).length;
  poModalClose();
  return { openN0, btnTxt, rowsShown, paid: m && m.finePaid, st: P && P.st, how: P && P.how, by: P && P.by, openN1 };
}, t4.id || null);
if (t2.openN0 > 0 && /ค่าปรับค้าง/.test(t2.btnTxt) && t2.rowsShown >= t2.openN0 && t2.paid === true && t2.st === 'paid' && t2.how === 'ทดสอบ' && t2.by && t2.openN1 === t2.openN0 - 1)
  ok(`2 ปุ่มแถบบน "${t2.btnTxt.trim()}" · รายการ ${t2.rowsShown} แถว · รับเงิน → ค้างลดจาก ${t2.openN0} เป็น ${t2.openN1} · finePay{st:paid,how:${t2.how},by:${t2.by}}`);
else fail('2 ' + JSON.stringify(t2));

// 3 · ปิดวัน · ปุ่ม disabled ถ้ามีลำค้าง · ปิดแล้วเปิดใบไม่ได้ · เปิดวันอีกครั้งต้องใส่เหตุผล แล้วเปิดใบได้
const t3 = await page.evaluate(() => {
  const boats = poBoats(_poDate, 'panwa');
  const openB = boats.filter(b => { const k = poBoatStage(_poDate, b.bid, 'panwa').k; return k === 'open' || k === 'carry'; }).length;
  const btn = () => [...document.querySelectorAll('#po-host-panwa .po-btn')].find(b => /ปิดวัน/.test(b.textContent));
  const disabledWhenOpen = openB ? btn().disabled : null;
  // บังคับให้ทุกลำปิดยอด · ใส่ return ให้ครบแบบ zz_test แล้วลบทิ้งตอนท้าย
  const added = [];
  boats.forEach(b => { const S = poBoatSum(_poDate, b.bid, 'panwa'), C = poBoatCarry(_poDate, b.bid);
    Object.keys(S).forEach(id => { const o = S[id], out = (C[id] || 0) + o.iss - (o.ret + o.rep + o.wo + o.lost + o.ob);
      if (out > 0) added.push(poAdd({ date: _poDate, pier: 'panwa', itemId: id, boatId: b.bid, type: 'return', qty: out, note: 'zz_test' })); }); });
  renderPierOffice('panwa');
  const enabledNow = btn() && !btn().disabled;
  poDayClose();
  const e = poDayClosed(_poDate, 'panwa');
  const closedChip = !!document.querySelector('#po-host-panwa .chip') && /ปิดวันแล้ว/.test([...document.querySelectorAll('#po-host-panwa .chip')].map(c => c.textContent).join(' '));
  poIssueOpen(boats[0].bid); const blocked = !document.getElementById('po-modal');
  const kpi = [...document.querySelectorAll('#po-host-panwa .po-kpi')].map(k => k.textContent).join(' ');
  poDayReopen();
  const e2 = (PIER_CFG.dayClose || {})['panwa::' + _poDate];
  poIssueOpen(boats[0].bid); const reopened = !!document.getElementById('po-modal'); poModalClose();
  // เก็บกวาด
  added.forEach(m => PIER_MOVES.splice(PIER_MOVES.indexOf(m), 1));
  delete PIER_CFG.dayClose['panwa::' + _poDate];
  return { openB, disabledWhenOpen, enabledNow, closed: !!e, by: e && e.by, closedChip, blocked, kpiClosed: /ปิดวัน/.test(kpi), reopenN: e2 && (e2.reopen || []).length, why: e2 && e2.reopen && e2.reopen[0] && e2.reopen[0].why, reopened };
});
if ((t3.openB === 0 || t3.disabledWhenOpen === true) && t3.enabledNow && t3.closed && t3.by && t3.closedChip && t3.blocked && t3.kpiClosed && t3.reopenN === 1 && t3.why === 'ทดสอบ' && t3.reopened)
  ok(`3 ${t3.openB ? 'มีลำค้าง → ปุ่ม disabled · ' : ''}ครบทุกลำ → ปิดวันโดย ${t3.by} · KPI/ชิปขึ้น "ปิดวัน" · เปิดใบไม่ได้ · เปิดวันอีกครั้ง (เหตุผล "${t3.why}") → เปิดใบได้`);
else fail('3 ' + JSON.stringify(t3));


// 5 · §poWhoSect · เลือกกลุ่มที่ขึ้นในช่องผู้บันทึก · office+service เท่านั้น · กัปตัน/เด็กเรือหาย · คนที่เลือกไว้แต่หลุดกลุ่ม = ยังไม่เลือก
const t5 = await page.evaluate(() => {
  const all = poStaff('panwa').length, sects = paSects('panwa');
  const want = sects.filter(x => /office|service/i.test(x.name)).map(x => x.id);
  poWhoSectOpen(); const boxes = document.querySelectorAll('#po-modal input[type=checkbox]').length;
  want.forEach(id => { document.getElementById('pows_' + id).checked = true; });
  poWhoSectSave();
  const opts = [...document.querySelectorAll('#po-who option')].slice(1);
  const names = opts.map(o => o.textContent);
  const stillCaptain = names.some(n => /กัปตัน|เด็กเรือ/.test(n));
  const picked = poWhoPickName();   // เต้ย เป็นกัปตัน · หลุดกลุ่มแล้วต้องว่าง
  const missCls = document.getElementById('po-who').className;
  delete PIER_CFG.whoSects.panwa; renderPierOffice('panwa');
  const back = document.querySelectorAll('#po-who option').length - 1;
  return { all, boxes, sectsN: sects.length, shown: opts.length, stillCaptain, picked, missCls, back };
});
if (t5.boxes === t5.sectsN && t5.shown < t5.all && t5.shown > 0 && !t5.stillCaptain && t5.picked === '' && /miss/.test(t5.missCls) && t5.back === t5.all)
  ok(`5 ติ๊ก office+service → ช่องเหลือ ${t5.shown} จาก ${t5.all} คน ไม่มีกัปตัน/เด็กเรือ · คนที่เลือกไว้หลุดกลุ่ม → ช่องกลับเป็นเหลือง · ล้างค่า → กลับมา ${t5.back} คน`);
else fail('5 ' + JSON.stringify(t5));

// เก็บกวาด move ทดสอบของข้อ 4
await page.evaluate((fid) => { if (fid) { const i = PIER_MOVES.findIndex(m => m.id === fid); if (i >= 0) PIER_MOVES.splice(i, 1); if (PIER_CFG.finePay) delete PIER_CFG.finePay[fid]; }
  PIER_MOVES.filter(m => /zz_test/.test(m.note || '')).forEach(m => PIER_MOVES.splice(PIER_MOVES.indexOf(m), 1)); }, t4.id || null);
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e));
if (!e1.length) ok('ไม่มี error ใน console'); else fail('console: ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
