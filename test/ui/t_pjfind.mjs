// §pjFind · ช่องจ่ายคนลงเรือ (ใบงานเรือ) · พิมพ์ค้นชื่อได้ · คนว่างขึ้นก่อน คนที่ลงงานแล้วอยู่ล่าง
//
// ที่มา (2026-10-17) · owner ส่งภาพเมนูเลือกเด็กเรือยาวเกินจอ: "จัดงานแบบยาก · ขอเพิ่ม พิมพ์ชื่อได้
//   แล้วก็เวลาเลื่อน ขอขึ้นชื่อคนที่ไม่ลงงานก่อน คนที่ลงงานแล้วไปอยู่ล่าง"
// ของเดิม (§pjName) คือ <select> โปร่งใสทับชื่อ · ยังอยู่ (คีย์บอร์ด/เทสเดิม) · เมาส์กดแล้วเปิดกล่องค้นหาแทน
// ทะเบียนพนักงานในชุดทดสอบว่าง · ใส่คนสมมุติ 7 คน แล้วให้ 2 คนลงลำอื่นไปก่อน
//
// กัน
//   1 เมนู (option) ของช่องกัปตัน (การ์ดเปล่ามีช่องกัปตันช่องเดียว): คนที่อยู่ลำอื่นแล้ว ไปอยู่กลุ่มท้ายสุด "⚠ ลงงานแล้ววันนี้" ไม่โผล่ในกลุ่มบน · กลุ่มแรกคือ "ท่านี้ · เด็กเรือ" มีแต่คนว่าง
//   2 เมาส์กดที่ช่อง → เปิดกล่อง #pj-find · ช่องพิมพ์ได้โฟกัส · รายชื่อครบเท่า option · คนลงงานแล้วมีป้ายแดงบอกลำ · กล่องอยู่ในจอ
//   3 พิมพ์ชื่อเล่น → เหลือเฉพาะคนที่ตรง (ไฮไลต์คำที่พิมพ์) · Enter → กล่องปิด · ค่าใน select เปลี่ยน · ชื่อบนการ์ดเปลี่ยน · บันทึกลงใบงาน (pjOf)
//   4 เปิดใหม่ → คนที่เลือกอยู่มีเครื่องหมาย ✓ · ลูกศรลง 2 ครั้ง + Enter = เลือกแถวที่ 2 ของรายการ
//   5 Esc ปิด · คลิกนอกกล่องปิด · ไม่เหลือกล่องค้าง
//   6 พิมพ์ที่ไม่มีใครตรง → ขึ้น "ไม่พบ" · Enter ไม่เปลี่ยนค่า
//   7 เลือก "— ว่าง —" ได้ (เอาคนออก)
//   8 ไม่มี error บนหน้า
import { open } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 900 });
page.on('dialog', d => d.accept());

const S = await page.evaluate(() => {
  const D = '2026-09-23'; _poDate = D; TRIPS[D] = TRIPS[D] || {};
  const pier = (PO_PIERS || []).map(x => x.k).find(k => (BOATS || []).filter(b => (b.pier || '') === k).length >= 2 && (ROUTES || []).some(r => (r.pier || '') === k));
  if (!pier) return { err: 'ไม่มีท่าที่มีเรือ 2 ลำ' };
  const mine = (BOATS || []).filter(b => (b.pier || '') === pier), rt = (ROUTES || []).find(r => (r.pier || '') === pier);
  mine.slice(0, 2).forEach(b => { TRIPS[D][b.id] = { route: rt.id, type: 'normal', booked: 0 }; });
  const [b1, b2] = [mine[0].id, mine[1].id];
  window.PIER_STAFF = PIER_STAFF || [];
  const st = [
    { id: 'zf_cap', name: 'นายกัปตัน ทดสอบ', nick: 'กัป', role: 'กัปตัน', pier },
    { id: 'zf_c1', name: 'นายหนึ่ง กล้าทะเล', nick: 'หนึ่ง', role: 'เด็กเรือ', pier },
    { id: 'zf_c2', name: 'นายสอง กล้าทะเล', nick: 'บอล', role: 'เด็กเรือ', pier },
    { id: 'zf_c3', name: 'นายสาม กล้าทะเล', nick: 'สาม', role: 'เด็กเรือ', pier },
    { id: 'zf_c4', name: 'นายสี่ กล้าทะเล', nick: 'สี่', role: 'เด็กเรือ', pier },
    { id: 'zf_c5', name: 'นายห้า กล้าทะเล', nick: 'ห้า', role: 'เด็กเรือ', pier },
    { id: 'zf_m1', name: 'นายช่าง ทดสอบ', nick: 'ช่าง', role: 'ช่างกล', pier } ];
  st.forEach(s => { if (!PIER_STAFF.some(x => x.id === s.id)) PIER_STAFF.push(s); });
  /* ลำที่ 2 เอา หนึ่ง + สาม ไปแล้ว · ลำที่ 1 ว่าง */
  pjSet(D, b2, { cap: '', asst: '', crew: ['zf_c1', 'zf_c3'], island: [] });
  pjSet(D, b1, { cap: '', asst: '', crew: [''], island: [] });
  _poPier = pier;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const v = document.getElementById('view-poj-' + pier); if (v) v.classList.add('active');
  renderPierJob(pier);
  return { D, pier, b1, b2, b2name: (getBoat(b2) || {}).name || b2 };
});
if (S.err) { fail(S.err); await close(); process.exit(1); }

/* หา select ของช่องกัปตันบนการ์ดลำที่ 1 (การ์ดที่ยังไม่จ่ายคนมีช่องนี้ช่องเดียว) */
const findSel = () => page.evaluate((S) => {
  const host = document.getElementById('pj-host-' + _poPier);
  const nm = (getBoat(S.b1) || {}).name || S.b1;
  const card = [...host.querySelectorAll('.bc')].find(c => (c.querySelector('.bn') || {}).textContent === nm);
  if (!card) return { err: 'no card' };
  const sel = [...card.querySelectorAll('select.pj-ov')].find(s => /'cap'/.test(s.getAttribute('onchange') || ''));
  if (!sel) return { err: 'no crew0 select' };
  sel.setAttribute('data-t', 'cap');
  const groups = [...sel.children].map(c => c.tagName === 'OPTGROUP' ? { label: c.label, opts: [...c.children].map(o => o.value) } : { label: null, opts: [c.value] });
  return { groups, n: sel.options.length, value: sel.value };
}, S);

/* ══ 1 · ลำดับในเมนู ═══════════════════════════════════════════════ */
const o1 = await findSel();
if (o1.err) { fail('1 ' + o1.err); await close(); process.exit(1); }
{
  const G = o1.groups.filter(g => g.label);
  const last = G[G.length - 1], first = G[0];
  const busyIn = G.slice(0, -1).filter(g => g.opts.includes('zf_c1') || g.opts.includes('zf_c3'));
  if (!last || !/ลงงานแล้ว/.test(last.label) || !last.opts.includes('zf_c1') || !last.opts.includes('zf_c3')) fail('1 คนที่ลงงานแล้วไม่ได้อยู่กลุ่มท้าย · ' + JSON.stringify(G.map(g => g.label)));
  else if (busyIn.length) fail('1 คนที่ลงงานแล้วยังโผล่ในกลุ่มบน · ' + busyIn.map(g => g.label).join(' / '));
  else if (!/ท่านี้ · กัปตัน/.test(first.label) || !first.opts.includes('zf_cap')) fail('1 กลุ่มแรกไม่ใช่กัปตันของท่านี้ · ' + JSON.stringify(first));
  else if (!G.some(g => /ตำแหน่งอื่น/.test(g.label) && ['zf_c2', 'zf_c4', 'zf_c5'].every(id => g.opts.includes(id)))) fail('1 เด็กเรือที่ว่างไม่อยู่กลุ่ม "ตำแหน่งอื่น" · ' + JSON.stringify(G));
  else ok('1 เมนู (ช่องกัปตัน): กลุ่มแรก "' + first.label + '" · เด็กเรือที่ว่างอยู่กลุ่มถัดไป · กลุ่มท้าย "' + last.label + '" = หนึ่ง + สาม');
}

/* ══ 2 · เมาส์กด → กล่องค้นหา ═══════════════════════════════════════ */
const selLoc = page.locator('select.pj-ov[data-t="cap"]');
await selLoc.dispatchEvent('mousedown');
await page.waitForTimeout(150);
const f2 = await page.evaluate((S) => {
  const box = document.getElementById('pj-find'); if (!box) return { err: 'no box' };
  const r = box.getBoundingClientRect();
  const its = [...box.querySelectorAll('.pjf-it')];
  const busy = its.filter(i => i.querySelector('.bz')).map(i => ({ v: i.dataset.v, bz: i.querySelector('.bz').textContent }));
  return { focused: document.activeElement === box.querySelector('.pjf-q'), n: its.length, busy, inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, groups: [...box.querySelectorAll('.pjf-g')].map(g => g.textContent) };
}, S);
if (f2.err) fail('2 ' + f2.err);
else if (!f2.focused) fail('2 ช่องพิมพ์ไม่ได้โฟกัส');
else if (f2.n !== o1.n) fail('2 รายชื่อไม่ครบ · ' + f2.n + ' / ' + o1.n);
else if (f2.busy.length !== 2 || !f2.busy.every(b => b.bz.includes(S.b2name))) fail('2 ป้ายลำของคนลงงานแล้วไม่ถูก · ' + JSON.stringify(f2.busy));
else if (!f2.inView) fail('2 กล่องล้นจอ');
else ok('2 กล่องเปิด · โฟกัสช่องพิมพ์ · ' + f2.n + ' ชื่อ · ป้าย "' + f2.busy[0].bz + '" · อยู่ในจอ');

/* ══ 3 · พิมพ์ชื่อเล่น → Enter ═══════════════════════════════════════ */
await page.keyboard.type('บอล');
await page.waitForTimeout(80);
const f3a = await page.evaluate(() => { const its = [...document.querySelectorAll('#pj-find .pjf-it')]; return { n: its.length, v: its.map(i => i.dataset.v), hl: !!document.querySelector('#pj-find .pjf-it .nm b') }; });
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
const f3b = await page.evaluate((S) => {
  const J = pjOf(S.D, S.b1);
  const host = document.getElementById('pj-host-' + _poPier);
  const nm = (getBoat(S.b1) || {}).name || S.b1;
  const card = [...host.querySelectorAll('.bc')].find(c => (c.querySelector('.bn') || {}).textContent === nm);
  const sel = [...card.querySelectorAll('select.pj-ov')].find(s => /'cap'/.test(s.getAttribute('onchange') || ''));
  const row = sel.closest('.pj-rw');
  return { box: !!document.getElementById('pj-find'), cap: J.cap, selVal: sel.value, nm: row.querySelector('.pj-nm').textContent.replace(/\s+/g, ' ') };
}, S);
if (f3a.n !== 1 || f3a.v[0] !== 'zf_c2' || !f3a.hl) fail('3 พิมพ์ "บอล" แล้วกรองไม่ถูก · ' + JSON.stringify(f3a));
else if (f3b.box || f3b.selVal !== 'zf_c2' || f3b.cap !== 'zf_c2' || !/นายสอง/.test(f3b.nm)) fail('3 Enter แล้วไม่ลงช่อง · ' + JSON.stringify(f3b));
else ok('3 พิมพ์ "บอล" เหลือ 1 ชื่อ (ไฮไลต์) · Enter → ลงช่องกัปตัน · การ์ดขึ้น "' + f3b.nm + '" · บันทึกแล้ว');

/* ══ 4 · เปิดใหม่ · ✓ ที่คนที่เลือกอยู่ · ลูกศร ═══════════════════════ */
await findSel();
await page.locator('select.pj-ov[data-t="cap"]').dispatchEvent('mousedown');
await page.waitForTimeout(150);
const f4a = await page.evaluate(() => { const c = document.querySelector('#pj-find .pjf-it.cur'); return { cur: c ? c.dataset.v : null, second: ([...document.querySelectorAll('#pj-find .pjf-it')][1] || {}).dataset?.v }; });
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
const f4b = await page.evaluate(() => (document.querySelector('#pj-find .pjf-it.on') || {}).dataset?.v);
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
const f4c = await page.evaluate((S) => ({ cap: pjOf(S.D, S.b1).cap, box: !!document.getElementById('pj-find') }), S);
if (f4a.cur !== 'zf_c2') fail('4 เปิดใหม่แล้วไม่มี ✓ ที่คนที่เลือกอยู่ · ' + JSON.stringify(f4a));
else if (f4b !== f4a.second || f4c.cap !== f4a.second || f4c.box) fail('4 ลูกศรลง 2 ครั้ง + Enter ไม่ได้แถวที่ 2 · ' + JSON.stringify({ f4a, f4b, f4c }));
else ok('4 ✓ ที่คนที่เลือกอยู่ · ลูกศรลง 2 + Enter = ' + f4b);

/* ══ 5 · Esc · คลิกนอก ══════════════════════════════════════════════ */
await findSel();
await page.locator('select.pj-ov[data-t="cap"]').dispatchEvent('mousedown'); await page.waitForTimeout(120);
const e5a = await page.evaluate(() => !!document.getElementById('pj-find'));
await page.keyboard.press('Escape'); await page.waitForTimeout(80);
const e5b = await page.evaluate(() => !!document.getElementById('pj-find'));
await page.locator('select.pj-ov[data-t="cap"]').dispatchEvent('mousedown'); await page.waitForTimeout(120);
await page.mouse.click(5, 5); await page.waitForTimeout(120);
const e5c = await page.evaluate(() => !!document.getElementById('pj-find'));
if (!e5a || e5b || e5c) fail('5 Esc/คลิกนอก ไม่ปิด · ' + JSON.stringify({ e5a, e5b, e5c }));
else ok('5 Esc ปิด · คลิกนอกกล่องปิด');

/* ══ 6 · ไม่พบ ═════════════════════════════════════════════════════ */
await findSel();
await page.locator('select.pj-ov[data-t="cap"]').dispatchEvent('mousedown'); await page.waitForTimeout(120);
await page.keyboard.type('zzzz'); await page.waitForTimeout(60);
const f6a = await page.evaluate(() => ({ none: !!document.querySelector('#pj-find .pjf-none'), n: document.querySelectorAll('#pj-find .pjf-it').length }));
await page.keyboard.press('Enter'); await page.waitForTimeout(150);
const f6b = await page.evaluate((S) => ({ cap: pjOf(S.D, S.b1).cap, box: !!document.getElementById('pj-find') }), S);
await page.keyboard.press('Escape');
if (!f6a.none || f6a.n || f6b.cap !== f4b || !f6b.box) fail('6 ' + JSON.stringify({ f6a, f6b }));
else ok('6 พิมพ์ที่ไม่มีใครตรง → "ไม่พบ" · Enter ไม่เปลี่ยนค่า');

/* ══ 7 · เลือก ว่าง ═══════════════════════════════════════════════ */
await findSel();
await page.locator('select.pj-ov[data-t="cap"]').dispatchEvent('mousedown'); await page.waitForTimeout(120);
await page.click('#pj-find .pjf-it[data-v=""]'); await page.waitForTimeout(300);
const f7 = await page.evaluate((S) => ({ cap: pjOf(S.D, S.b1).cap, box: !!document.getElementById('pj-find') }), S);
if (f7.cap || f7.box) fail('7 เลือกว่างแล้วคนไม่ออก · ' + JSON.stringify(f7));
else ok('7 เลือก "— ว่าง —" → ช่องว่าง');

/* ══ 8 ═══════════════════════════════════════════════════════════════ */
const e8 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (e8.length) fail('8 ' + e8.slice(0, 3).join(' | ')); else ok('8 ไม่มี error บนหน้า');
await close();
console.log(bad ? ('FAILED ' + bad) : 'ALL OK');
process.exit(bad ? 1 : 0);
