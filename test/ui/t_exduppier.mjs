// §exDupPier · ขายเพิ่มแบบ COT ที่หน้าท่าเก็บเงินแล้ว ถูกแก้เป็นบัตรซ้ำ → ต้องไม่นับสองรอบ · กันแก้ · ปุ่มแก้ให้
import { open } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1000 });
const dialogs = []; page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
const r = await page.evaluate(async () => {
  const z = ms => new Promise(f => setTimeout(f, ms));
  const sum = (b, d) => tsSaleList(b, d);
  // เลือกใบที่ไม่มีเงินหน้าท่า ไม่มี COT ไม่มีค้าง
  const b = (SB_BOOKINGS || []).find(x => x.agentId && x.agentId !== 'a_b2c' && (x.trips || []).length && !(x.pierPayments || []).length
    && !(x.cashOnTour && +x.cashOnTour.amount > 0) && !(x.paymentSnapshot && +x.paymentSnapshot.balance > 0) && !bkV2ExtrasFor(x.id).length && !(x.upgrades || []).length);
  if (!b) return { none: 1 };
  const date = b.trips[0].date; _pckDate = date;
  // 1) ขายเพิ่มแบบ COT 2,000
  SB_EXTRAS.push({ id: 'ex_t1', bookingId: b.id, tripDate: date, service: 'Longtail · Join → เหมา (Charter)', qty: 1, unitPrice: 2000, total: 2000, toCompany: 1400, commission: 600,
    seller: 'KAI', method: 'cot', feePct: 0, fee: 0, customerPaid: 2000, slips: [], settle: 'pending', collectedAt: '', date: new Date().toISOString() });
  const due0 = pckMoney(b, date).due;
  // 2) หน้าท่ารูดบัตร 2,000 + fee 100
  b.pierPayments = [{ id: 'pp_t1', date, amount: 2000, method: 'card', fee: 100, feePct: null, note: '', slips: [{ name: 's.jpg' }], by: 'GSA', at: new Date().toISOString() }];
  const M1 = pckMoney(b, date), S1 = sum(b, date);
  const cov1 = bkxExCovered(SB_EXTRAS.find(x => x.id === 'ex_t1'));
  // 3) พยายามแก้ไขเป็นบัตร → ต้องถูกกัน
  _bkExtraEditId = 'ex_t1'; _bkExtraPay = { m: 'card', feePct: 0, fee: 100, slips: [] };
  const mk = (id, v) => { let el = document.getElementById(id); if (!el) { el = document.createElement('input'); el.id = id; document.body.appendChild(el); } el.value = v; };
  mk('bkx-name', 'Longtail · Join → เหมา (Charter)'); mk('bkx-qty', 1); mk('bkx-price', 2000); mk('bkx-company', 1400); mk('bkx-seller', 'KAI');
  const _fee0 = window.bkV2ExtraFee; window.bkV2ExtraFee = () => 100;
  bkV2ExtraSave(b.id);
  const afterGuard = SB_EXTRAS.find(x => x.id === 'ex_t1').method;
  // 4) จำลองข้อมูลที่ซ้ำไปแล้ว (แบบ 20 ต.ค.) · แก้ตรง ๆ
  const x = SB_EXTRAS.find(k => k.id === 'ex_t1'); x.method = 'card'; x.fee = 100; x.feePct = 5; x.settle = 'done';
  const dup = bkxExDupPier(x), cov2 = bkxExCovered(x);
  const M2 = pckMoney(b, date), S2 = sum(b, date);
  // ใบที่เก็บจริงสองก้อน (ขายเพิ่มรูดบัตรเอง + หน้าท่าเก็บ COT ของใบ) ต้องไม่ถูกมองเป็นซ้ำ
  const y = { id: 'ex_t2', bookingId: b.id, tripDate: date, service: 'Extra B', qty: 1, unitPrice: 500, total: 500, method: 'card', fee: 0, settle: 'done', slips: [] };
  SB_EXTRAS.push(y); const dupY = bkxExDupPier(y); SB_EXTRAS = SB_EXTRAS.filter(k => k.id !== 'ex_t2');
  // 5) หน้าปิดวัน · ป้ายซ้ำ + แก้ให้
  _tsDate = date; nav(document.querySelector('.nav-item[data-view="travelsum"]')); await z(600);
  const row = [...document.querySelectorAll('tr')].find(tr => tr.textContent.includes(b.voucherRef || b.code));
  const rowTxt = row ? row.textContent : '';
  const chipsCard = row ? [...row.querySelectorAll('.ts-chip')].filter(c => /บัตรเครดิต/.test(c.textContent)).length : -1;
  const link = row && [...row.querySelectorAll('a')].find(a => /แก้ให้/.test(a.textContent));
  if (link) link.click(); await z(400);
  const x3 = SB_EXTRAS.find(k => k.id === 'ex_t1');
  const row3 = [...document.querySelectorAll('tr')].find(tr => tr.textContent.includes(b.voucherRef || b.code));
  const out = { vc: b.voucherRef || b.code, due0, M1: { due: M1.due, got: M1.got, exCov: M1.exCov, exGot: M1.exGot }, S1: { got: S1.got, card: S1.by.card, noSlip: S1.noSlip }, cov1, afterGuard,
    dup, cov2, M2: { due: M2.due, got: M2.got, exCov: M2.exCov, exGot: M2.exGot }, S2: { got: S2.got, card: S2.by.card, noSlip: S2.noSlip, dupFlag: S2.list[0].dup }, dupY,
    rowTxt: rowTxt.slice(0, 400), chipsCard, hadLink: !!link, x3: { method: x3.method, settle: x3.settle, fee: x3.fee }, row3: row3 ? row3.textContent.slice(0, 300) : '' };
  window.bkV2ExtraFee = _fee0;
  return out;
});
await page.screenshot({ path: '/mnt/user-data/outputs/exduppier.png' });
const R = JSON.stringify(r).slice(0, 1500);
if (r.none) { fail('no suitable booking'); }
if (r.due0 === 2000 && r.M1.due === 0 && r.M1.exCov === 2000 && r.cov1) ok(r.vc + ' · COT 2,000 → หน้าท่ารูดบัตร 2,000 → ครอบคลุม ไม่ค้าง'); else fail('cover ' + R);
if (r.afterGuard === 'cot' && dialogs.some(d => /บันทึกไว้ที่หน้าท่าแล้ว/.test(d))) ok('แก้ไขเป็นบัตร → ถูกกัน · ยังเป็น COT'); else fail('guard ' + R + ' ' + dialogs.join('|'));
if (r.dup && r.cov2 && r.M2.exCov === 2000 && r.M2.exGot === 0 && r.M2.got === 2000 && r.S2.card === 0 && r.S2.got === 0 && r.S2.noSlip === 0 && r.S2.dupFlag) ok('ข้อมูลซ้ำแบบ 20 ต.ค. · จับได้ · ไม่บวกซ้ำ (got 2,000 ไม่ใช่ 4,000) · ไม่ขึ้นขาดสลิป'); else fail('dup ' + R);
if (r.dupY === false) ok('ขายเพิ่มรูดบัตรเองอีกรายการ (เงินคนละก้อน) ไม่ถูกมองเป็นซ้ำ'); else fail('dupY ' + R);
if (r.chipsCard === 1 && /บันทึกซ้ำกับเงินหน้าท่า/.test(r.rowTxt) && r.hadLink) ok('หน้าปิดวัน · ป้ายบัตรขึ้นครั้งเดียว + ป้าย "บันทึกซ้ำ" + ลิงก์แก้ให้'); else fail('row ' + R);
if (r.x3.method === 'cot' && r.x3.settle === 'pending' && r.x3.fee === 0 && !/บันทึกซ้ำ/.test(r.row3)) ok('กดแก้ให้ → กลับเป็นเก็บหน้าท่า · ป้ายซ้ำหาย'); else fail('fix ' + R);
if (errors.length) { fail('page errors'); console.log('    errors:', errors.slice(0, 3)); }
console.log(bad ? `FAIL ${bad}` : 'PASS'); await close(); process.exit(bad ? 1 : 0);
