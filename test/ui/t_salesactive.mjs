// §salesActive · สถานะเซลล์ Active / Inactive · inactive ไม่ขึ้นในตัวเลือก/ชิป/KPI ที่อื่น แต่ยังหาด้วย id ได้
//
// ที่มา (2026-10-05) · เจ้าของ: "ขอเพิ่มสถานะเซลล์ ว่า Active or inactive เพื่อที่จะได้ กรณี inactive ไม่ต้องโชว์ในส่วนอื่น ๆ"
//
// กันหกอย่าง
//   1 หน้า Team & Markets · ทุกแถวมีป้ายสถานะ · ข้อมูลเก่าที่ไม่มีฟิลด์ active นับเป็น Active · ตัวนับไม่มีคำว่า inactive
//   2 เปิดโมดัลแก้ไข มีสวิตช์สถานะ ติ๊กออกแล้วบันทึก → แถวนั้นเป็น Inactive หรี่ลง · ตัวนับขึ้น "1 inactive" · ลง localStorage
//   3 sbSalesActive() ไม่มีคนนั้น · sbGetSales(id) ยังหาเจอ · sbSalesOpts(id) แถมคนนั้นพร้อมป้าย (inactive) · _abSalesList() ไม่มี
//   4 หน้า Agents · ชิปกรองเซลล์ไม่มีคนนั้น · dropdown กรองไม่มี เว้นแต่กำลังเลือกคนนั้นอยู่
//   5 ฟอร์มเพิ่มเอเยนต์ใหม่ · ตัวเลือก Sales Person ไม่มีคนนั้น · เอเยนต์เก่าที่ผูกอยู่ยังเห็นชื่อ (ติดป้าย inactive) ในโมดัลแก้ไข
//   6 ติ๊กกลับเป็น Active → ป้าย Active กลับมา ไม่มีคำว่า inactive · เพิ่มเซลล์ใหม่ได้ active ตั้งแต่ต้น
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
page.on('dialog', async d => { try { await d.accept(); } catch (_) {} });
await goView(page, 'teammkt', 600);

/* ══ 1 ══ */
const s1 = await page.evaluate(() => { const rows = [...document.querySelectorAll('#tm-sales-list .tm-row')]; return { n: SB_SALES.length, rows: rows.length, badges: rows.map(r => (r.querySelector('.tm-status') || {}).textContent), cnt: document.getElementById('tm-sales-count').textContent, noField: SB_SALES.filter(s => s.active === undefined).length, act: sbSalesActive().length }; });
if (s1.n > 1 && s1.rows === s1.n && s1.badges.every(b => b === 'Active') && !/inactive/.test(s1.cnt) && s1.act === s1.n) ok(`1 Team & Markets · ${s1.n} คน ทุกแถวป้าย Active (ไม่มีฟิลด์ active ${s1.noField} คน = active) · sbSalesActive ครบ ${s1.act}`);
else fail('1 ' + JSON.stringify(s1));

/* ══ 2 ══ */
const SID = await page.evaluate(() => SB_SALES[0].id);
await page.evaluate((id) => tmEditSales(id), SID); await page.waitForTimeout(250);
const m2 = await page.evaluate(() => { const sw = document.querySelector('#tm-modal [data-tm-active] input'); return { has: !!sw, checked: sw && sw.checked, pill: (document.querySelector('#tm-modal .tm-switch-pill') || {}).textContent }; });
await page.evaluate(() => { const sw = document.querySelector('#tm-modal [data-tm-active] input'); sw.checked = false; sw.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(150);
const m2b = await page.evaluate(() => ({ pill: (document.querySelector('#tm-modal .tm-switch-pill') || {}).textContent, draft: _tmModalDraft.active }));
await page.evaluate(() => tmSaveModal()); await page.waitForTimeout(300);
const s2 = await page.evaluate((id) => { const r = document.querySelector(`#tm-sales-list [data-sales-row="${id}"]`); const ls = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); const st = (ls.sb_sales || []).find(s => s.id === id);
  return { badge: (r.querySelector('.tm-status') || {}).textContent, dim: r.classList.contains('tm-inactive'), op: getComputedStyle(r.querySelector('.tm-row-info')).opacity, cnt: document.getElementById('tm-sales-count').textContent, mem: SB_SALES.find(s => s.id === id).active, ls: st ? st.active : 'no-ls' }; }, SID);
if (m2.has && m2.checked && m2.pill === 'Active' && m2b.pill === 'Inactive' && m2b.draft === false && s2.badge === 'Inactive' && s2.dim && +s2.op < 0.7 && /1 inactive/.test(s2.cnt) && s2.mem === false && s2.ls === false)
  ok(`2 โมดัลมีสวิตช์ (เริ่ม Active) · ติ๊กออก→Inactive บันทึกแล้วแถวหรี่ (opacity ${s2.op}) ป้าย Inactive · ตัวนับ "${s2.cnt}" · ลง localStorage`);
else fail('2 ' + JSON.stringify({ m2, m2b, s2 }));

/* ══ 3 ══ */
const s3 = await page.evaluate((id) => ({ act: sbSalesActive().some(s => s.id === id), get: !!sbGetSales(id), opts: sbSalesOpts(id).some(s => s.id === id), optsNo: sbSalesOpts('').some(s => s.id === id), lbl: sbSalesLabel(sbGetSales(id)), ab: _abSalesList().some(s => s.id === id), total: SB_SALES.length, actN: sbSalesActive().length }), SID);
if (!s3.act && s3.get && s3.opts && !s3.optsNo && s3.lbl === ' (inactive)' && !s3.ab && s3.actN === s3.total - 1) ok('3 sbSalesActive ไม่มีคนนั้น · sbGetSales ยังหาเจอ · sbSalesOpts(id) แถมพร้อมป้าย (inactive) แต่ sbSalesOpts("") ไม่มี · Action Board ไม่มี');
else fail('3 ' + JSON.stringify(s3));

/* ══ 4 ══ */
await goView(page, 'agents', 700);
const s4 = await page.evaluate((id) => { const chips = [...document.querySelectorAll('[data-sales]')].map(c => c.getAttribute('data-sales')); const sel = document.querySelector('select[onchange*="agSetSalesFilter"], select[onchange*="SalesFilter"]'); const opts = sel ? [...sel.options].map(o => o.value) : null;
  return { chips: chips.length, has: chips.includes(id), hasAll: chips.includes('all'), opts: opts ? opts.length : null, inOpts: opts ? opts.includes(id) : null }; }, SID);
if (s4.chips > 1 && !s4.has && s4.hasAll && (s4.inOpts === false || s4.inOpts === null)) ok(`4 หน้า Agents · ชิปกรองเซลล์ ${s4.chips} ชิป ไม่มีคนที่ inactive` + (s4.opts !== null ? ` · dropdown กรอง ${s4.opts} ตัวเลือก ไม่มีคนนั้น` : ''));
else fail('4 ' + JSON.stringify(s4));

/* ══ 5 ══ */
const s5 = await page.evaluate((id) => { const ag = SB_AGENTS.find(a => a.sales === id); let editOpt = null, editHas = null;
  if (ag) { try { agEditOpen('sales', ag.id); const sel = [...document.querySelectorAll('select')].find(x => [...x.options].some(o => o.value === id)); editHas = !!sel; editOpt = sel ? [...sel.options].find(o => o.value === id).textContent.trim() : 'no-select'; } catch (e) { editOpt = 'err ' + e.message; } }
  return { agId: ag ? ag.id : null, editHas, editOpt }; }, SID);
const newSel = await page.evaluate((id) => { try { agNew(); } catch (e) { return 'err ' + e.message; } const sels = [...document.querySelectorAll('select[onchange*="agNewSetSales"]')]; if (!sels.length) return 'no-form'; return { has: [...sels[0].options].map(o => o.value).includes(id), n: sels[0].options.length }; }, SID);
if (newSel && newSel.has === false && newSel.n > 1 && (s5.agId === null || (s5.editHas && /inactive/.test(String(s5.editOpt)))))
  ok(`5 ฟอร์มเพิ่มเอเยนต์ · ตัวเลือก Sales ${newSel.n - 1} คน ไม่มีคนที่ inactive` + (s5.agId ? ` · เอเยนต์เก่า ${s5.agId} ที่ผูกอยู่ยังเห็น "${s5.editOpt}" ในโมดัลแก้ไข` : ' · ชุดข้อมูลนี้ไม่มีเอเยนต์ที่ผูกกับคนนั้น'));
else fail('5 ' + JSON.stringify({ s5, newSel }));

/* ══ 6 ══ */
await goView(page, 'teammkt', 600);
await page.evaluate((id) => { tmEditSales(id); }, SID); await page.waitForTimeout(200);
await page.evaluate(() => { const sw = document.querySelector('#tm-modal [data-tm-active] input'); sw.checked = true; sw.dispatchEvent(new Event('change', { bubbles: true })); tmSaveModal(); }); await page.waitForTimeout(300);
const s6 = await page.evaluate((id) => { const r = document.querySelector(`#tm-sales-list [data-sales-row="${id}"]`); tmAddSales(); const d = _tmModalDraft; const sw = document.querySelector('#tm-modal [data-tm-active] input'); const res = { badge: (r.querySelector('.tm-status') || {}).textContent, dim: r.classList.contains('tm-inactive'), cnt: document.getElementById('tm-sales-count').textContent, mem: SB_SALES.find(s => s.id === id).active, newActive: d.active, newChecked: sw && sw.checked }; if (typeof tmCloseModal === 'function') tmCloseModal(); return res; }, SID);
if (s6.badge === 'Active' && !s6.dim && !/inactive/.test(s6.cnt) && s6.mem === true && s6.newActive === true && s6.newChecked) ok('6 ติ๊กกลับ → Active ป้ายกลับมา ไม่หรี่ · ตัวนับไม่มี inactive · เพิ่มเซลล์ใหม่ได้ค่าเริ่มต้น Active');
else fail('6 ' + JSON.stringify(s6));

const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e));
if (e1.length) fail('errors: ' + e1.slice(0, 3).join(' | '));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
