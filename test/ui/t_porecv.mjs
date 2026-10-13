// §poRecv · เบิก–คืนอุปกรณ์ · "รับของเข้า" และ "นับสต็อก" แทนปุ่มปรับยอด · ยอดรวมคำนวณจากบัญชี
//
// ที่มา (8 ต.ค. 2026) · เจ้าของ: "น่าจะต้องมีรายการเพิ่มของในสต็อก เหมือนรายการรับของเข้ามาใหม่
//   ตอนนี้ user ไปจัดการในการปรับยอด ถ้าไม่ตรงก็ต้องไปปรับเรื่อย ๆ · ขั้นตอนควรเป็น รับของเข้าใหม่
//   → เบิก คืน → กรณีหายก็มีประวัติ และยอดรวมก็จะลดตาม"
//
// กันแปดอย่าง
//   1 แถวของมีปุ่ม "รับเข้า" กับ "นับ" ไม่มี "ปรับยอด" แล้ว · หัวส่วนสต็อกมี "รับของเข้า" กับ "นับสต็อก"
//   2 ยอดหลัง / คือของที่มีจริงตามบัญชี · ของหาย = ยอดรวมลด · พร้อมใช้ไม่ถูกตัดไว้ที่ทะเบียนอีก
//   3 รับของเข้าหลายรายการในใบเดียว · ที่มา + หมายเหตุ ติดไปกับทุกแถว · พร้อมใช้และยอดรวมเพิ่มเท่ากัน
//   4 รับเข้าแบบว่าง/ติดลบ · ขึ้นข้อความในกล่อง ไม่บันทึกอะไร
//   5 ได้คืนของที่แจ้งหาย · ยอดหายสะสมลด ยอดรวมกลับมา
//   6 นับสต็อก · ส่วนต่างโชว์ทันที · มีส่วนต่างต้องใส่เหตุผล · บันทึกเป็นส่วนต่าง พร้อม "นับได้ X (บัญชี Y)"
//     นับแล้วตรง = ไม่บันทึกอะไร
//   7 ทะเบียนของ · ยอดตั้งต้นล็อกเมื่อมีการเคลื่อนไหว (ไม่มีช่องให้แก้ และแก้ผ่านโค้ดก็ไม่เปลี่ยน) · ของใหม่ยังใส่ได้
//   8 ประวัติ · ชิป "รับของเข้า" กรองได้ · ป้ายบอกที่มา · ไม่มี error
//   9 ประวัติ · กล่องของประจำเรือ แยกตามลำ บอกรายการและจำนวนใต้ชื่อลำ
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1050 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1300);

const P = await page.evaluate(() => {
  const el = document.querySelector('.nav-item[data-view^="po-"]');
  if (!el) return { err: 'no pier-office menu' };
  nav(el);
  const items = poItems(_poPier);
  if (items.length < 4) return { err: 'need 4 items at ' + _poPier + ', have ' + items.length };
  return { pier: _poPier, ids: items.slice(0, 4).map(i => i.id), labels: items.slice(0, 4).map(i => i.label) };
});
if (P.err) { fail('prep ' + P.err); await close(); process.exit(1); }
const [A, B, C, D] = P.ids;

const row = (id) => page.evaluate((id) => {
  const it = poItem(id); const b = poBal(id);
  const r = [...document.querySelectorAll('.po-ir')].find(x => (x.querySelector('.l') || {}).textContent === it.label);
  return { ready: b.ready, inhand: b.inhand, gone: b.gone, total: +it.total,
    v: r ? r.querySelector('.v').textContent : null, u: r ? r.querySelector('.u').textContent : null,
    btns: r ? [...r.querySelectorAll('button')].map(x => x.textContent.trim()) : [] };
}, id);

/* 1 */
const R1 = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.po-ir button')].map(b => b.textContent.trim());
  const sec = [...document.querySelectorAll('.po-sec')].find(s => /สต็อกคงเหลือ/.test(s.textContent));
  return { adj: btns.filter(t => t === 'ปรับยอด').length, recv: btns.filter(t => t === 'รับเข้า').length, cnt: btns.filter(t => t === 'นับ').length,
    rows: document.querySelectorAll('.po-ir').length, head: sec ? [...sec.querySelectorAll('button')].map(b => b.textContent.trim()) : [] };
});
if (!R1.adj && R1.recv === R1.rows && R1.cnt === R1.rows && R1.rows > 0 && R1.head.some(t => /รับของเข้า/.test(t)) && R1.head.some(t => /นับสต็อก/.test(t)))
  ok('1 ' + R1.rows + ' แถว · ปุ่มรับเข้า + นับ · ไม่มีปรับยอด · หัวส่วน: ' + R1.head.join(' / '));
else fail('1 ' + JSON.stringify(R1));

/* 2 · เบิก 3 คืน 2 หาย 1 · และปรับยอดแบบเก่า +5 */
await page.evaluate(({ A, B }) => {
  poAdd({ date: _poDate, pier: _poPier, itemId: A, boatId: 'x', type: 'issue', qty: 3 });
  poAdd({ date: _poDate, pier: _poPier, itemId: A, boatId: 'x', type: 'return', qty: 2 });
  poAdd({ date: _poDate, pier: _poPier, itemId: A, boatId: 'x', type: 'lost', qty: 1 });
  poAdd({ date: _poDate, pier: _poPier, itemId: B, boatId: '', type: 'adjust', qty: 5, note: 'old style' });
  poPersist(); renderPierOffice();
}, { A, B });
const a2 = await row(A), b2 = await row(B);
if (a2.inhand === a2.total - 1 && a2.u.startsWith('/' + (a2.total - 1)) && a2.gone === 1
    && b2.ready === b2.total + 5 && b2.v === String(b2.total + 5) && b2.u.startsWith('/' + (b2.total + 5)))
  ok(`2 ของหาย 1 → ยอดรวม ${a2.total} → ${a2.inhand} · ปรับยอดเก่า +5 โชว์ ${b2.v}${b2.u.split(' ')[0]} (ไม่ถูกตัดที่ ${b2.total})`);
else fail('2 ' + JSON.stringify({ a2, b2 }));

/* 3 */
const c0 = await row(C), d0 = await row(D);
await page.evaluate(() => poRecvOpen());
await page.waitForTimeout(200);
await page.fill('#porv_' + C, '20');
await page.fill('#porv_' + D, '4');
await page.selectOption('#porvsrc', 'buy');
await page.fill('#porvn', 'ร้าน ABC ฿150/คู่ บิล 0231');
await page.evaluate(id => { [...document.querySelectorAll('#po-modal button')].find(b => /บันทึกรับเข้า/.test(b.textContent)).click(); }, C);
await page.waitForTimeout(300);
const c3 = await row(C), d3 = await row(D);
const mv3 = await page.evaluate(({ C, D }) => (PIER_MOVES || []).filter(m => m.type === 'receive' && (m.itemId === C || m.itemId === D)).map(m => ({ i: m.itemId, q: m.qty, f: m.from, n: m.note, by: m.by })), { C, D });
const saved3 = await page.evaluate(() => { try { return (JSON.parse(localStorage.getItem(LS_KEY)).pier_moves || []).filter(m => m.type === 'receive').length; } catch (e) { return -1; } });
if (mv3.length === 2 && mv3.every(m => m.f === 'buy' && m.n === 'ร้าน ABC ฿150/คู่ บิล 0231') && c3.ready === c0.ready + 20 && c3.inhand === c0.inhand + 20
    && d3.inhand === d0.inhand + 4 && c3.u.startsWith('/' + c3.inhand) && saved3 === 2 && !(await page.$('#po-modal')))
  ok(`3 รับเข้า 2 รายการในใบเดียว · ${P.labels[2]} พร้อมใช้ ${c0.ready}→${c3.ready} ยอดรวม ${c0.inhand}→${c3.inhand} · เซฟแล้ว`);
else fail('3 ' + JSON.stringify({ mv3, c0, c3, d0, d3, saved3 }));

/* 4 */
const R4 = await page.evaluate(({ C }) => {
  const n0 = PIER_MOVES.length;
  poRecvOpen(); const e1 = (poRecvSave(''), document.getElementById('porverr').textContent);
  document.getElementById('porv_' + C).value = '-3'; const e2 = (poRecvSave(''), document.getElementById('porverr').textContent);
  poModalClose();
  return { e1, e2, same: PIER_MOVES.length === n0 };
}, { C });
if (/อย่างน้อย 1 รายการ/.test(R4.e1) && /มากกว่า 0/.test(R4.e2) && R4.same) ok('4 ว่าง/ติดลบ → ข้อความในกล่อง · ไม่บันทึก');
else fail('4 ' + JSON.stringify(R4));

/* 5 */
await page.evaluate(({ A }) => { poRecvOpen(A); document.getElementById('porvsrc').value = 'found'; document.getElementById('porv_' + A).value = '1'; document.getElementById('porvn').value = 'ไกด์เจอที่ร้านอาหาร'; poRecvSave(A); }, { A });
const a5 = await row(A);
if (a5.gone === 0 && a5.inhand === a5.total && a5.u.startsWith('/' + a5.total)) ok(`5 ได้คืนของที่แจ้งหาย · หายสะสม 1 → 0 · ยอดรวมกลับเป็น ${a5.inhand}`);
else fail('5 ' + JSON.stringify(a5));

/* 6 */
const c5 = await row(C);
await page.evaluate(() => poCountOpen());
await page.fill('#pocn_' + C, String(c5.ready - 2));
await page.fill('#pocn_' + D, String((await row(D)).ready));
const live = await page.evaluate(({ C, D }) => [document.getElementById('pocd_' + C).textContent, document.getElementById('pocd_' + D).textContent], { C, D });
const e6 = await page.evaluate(() => { poCountSave(''); return document.getElementById('pocnerr').textContent; });
await page.fill('#pocnn', 'นับสิ้นเดือน');
const n6a = await page.evaluate(() => PIER_MOVES.length);
await page.evaluate(() => poCountSave(''));
await page.waitForTimeout(200);
const c6 = await row(C);
const mv6 = await page.evaluate(() => PIER_MOVES.filter(m => m.type === 'count').map(m => ({ i: m.itemId, q: m.qty, n: m.note })));
const n6b = await page.evaluate(() => PIER_MOVES.length);
// นับแล้วตรง → ไม่บันทึก
const same6 = await page.evaluate(({ C }) => { const n0 = PIER_MOVES.length; poCountOpen(C); document.getElementById('pocn_' + C).value = String(poBal(C).ready); poCountSave(C); return PIER_MOVES.length === n0; }, { C });
if (live[0] === '-2' && live[1] === 'ตรง' && /ใส่เหตุผล/.test(e6) && n6b === n6a + 1 && mv6.length === 1 && mv6[0].i === C && mv6[0].q === -2
    && mv6[0].n === `นับสิ้นเดือน · นับได้ ${c5.ready - 2} (บัญชี ${c5.ready})` && c6.ready === c5.ready - 2 && c6.inhand === c5.inhand - 2 && same6)
  ok(`6 นับสต็อก · ส่วนต่างโชว์ทันที (${live.join(' / ')}) · ต้องใส่เหตุผล · บันทึก "${mv6[0].n}" · นับตรงไม่บันทึก`);
else fail('6 ' + JSON.stringify({ live, e6, mv6, c5, c6, n6a, n6b, same6 }));

/* 7 */
const R7 = await page.evaluate(({ A }) => {
  poItemsOpen();
  const locked = !document.getElementById('poitt_' + A);
  const free = (PIER_ITEMS || []).filter(i => i.pier === _poPier && !(PIER_MOVES || []).some(m => m.itemId === i.id))[0];
  const freeInput = free ? !!document.getElementById('poitt_' + free.id) : null;
  const t0 = poItem(A).total;
  const fake = document.createElement('input'); fake.id = 'poitt_' + A; fake.value = '999'; document.body.appendChild(fake);
  poItemsSave(); fake.remove();
  return { locked, freeInput, kept: poItem(A).total === t0 };
}, { A });
if (R7.locked && R7.freeInput !== false && R7.kept) ok('7 ยอดตั้งต้นล็อกเมื่อมีการเคลื่อนไหว · แก้ผ่านโค้ดก็ไม่เปลี่ยน · ของที่ยังไม่มีการเคลื่อนไหวยังแก้ได้');
else fail('7 ' + JSON.stringify(R7));

/* 8 */
const R8 = await page.evaluate(() => {
  poLedgerOpen(); poLdgFilter('recv');
  const m = document.getElementById('po-modal');
  const rows = [...m.querySelectorAll('table.po-t tbody tr')];
  const chips = [...m.querySelectorAll('button')].map(b => b.textContent.replace(/\s+/g, ' ').trim());
  const out = { chip: chips.find(t => /^รับของเข้า/.test(t)), cnt: chips.find(t => /^นับสต็อก/.test(t)), n: rows.length,
    tags: rows.map(r => r.children[2].textContent.trim()), notes: rows.map(r => r.children[5].textContent.trim()) };
  poModalClose(); return out;
});
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e));
if (R8.chip && R8.cnt && R8.n === 3 && R8.tags.filter(t => t === 'รับของเข้า · ซื้อใหม่').length === 2 && R8.tags.includes('รับของเข้า · ได้คืน (ของที่แจ้งหาย)')
    && R8.notes.includes('ไกด์เจอที่ร้านอาหาร') && !e1.length)
  ok('8 ประวัติ · ชิป "' + R8.chip + '" / "' + R8.cnt + '" · ป้ายบอกที่มา · ไม่มี error');
else fail('8 ' + JSON.stringify(R8) + ' ' + e1.slice(0, 3).join(' | '));

/* 9 · §poShipItems · ของประจำเรือ แยกตามลำ ต้องบอกรายการใต้ชื่อลำ */
const R9 = await page.evaluate(({ C, D }) => {
  const bo = (typeof poShipBoats === 'function' ? poShipBoats(_poPier) : [])[0];
  if (!bo) return { err: 'no boat at this pier' };
  poAdd({ date: _poDate, pier: _poPier, itemId: C, boatId: bo.id, type: 'assign', qty: 4 });
  poAdd({ date: _poDate, pier: _poPier, itemId: D, boatId: bo.id, type: 'assign', qty: 2 });
  poLedgerOpen();
  const m = document.getElementById('po-modal');
  const box = [...m.querySelectorAll('div')].find(d => d.firstElementChild && /ของประจำเรือ · แยกตามลำ/.test(d.firstElementChild.textContent) && d.children.length > 1);
  const subs = box ? [...box.querySelectorAll('.po-shipi')].map(x => x.textContent.replace(/\s+/g, ' ').trim()) : [];
  const out = { boat: bo.name || bo.id, subs, has: box ? box.textContent.includes(bo.name || bo.id) : false,
    want: [poItem(C).label, poItem(D).label] };
  poModalClose(); return out;
}, { C, D });
if (!R9.err && R9.has && R9.subs.length === 2 && R9.subs[0].startsWith(R9.want[0]) && /4/.test(R9.subs[0]) && R9.subs[1].startsWith(R9.want[1]) && /2/.test(R9.subs[1]))
  ok('9 ของประจำเรือ · ' + R9.boat + ' → ' + R9.subs.join(' / '));
else fail('9 ' + JSON.stringify(R9));

await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
