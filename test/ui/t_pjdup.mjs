// §pjDupCrew · ใบงานเรือ · คนเดียวถูกจ่ายลงสองลำวันเดียวกัน (ท่าเดียวกันหรือข้ามท่า) ต้องมีคนเตือน
//
// ที่มา (2026-10-14) · owner: "ตรวจดูการทำงานของจัดใบงานเรือที่เป็นทั้งท่าเรือทับละมุ ท่าเรือภูเก็ต เหมือนวันนี้จะมั่วกันมาก"
//   ของเดิม: ช่องลูกเรือไม่รู้ว่าคนนั้นอยู่ลำอื่นแล้ว (ช่องไกด์รู้) · ใบที่ยังไม่บันทึกใช้ทีมประจำลำเป็นค่าตั้งต้น
//   คนที่ย้ายลำ/ย้ายท่าจึงโผล่สองใบโดยไม่มีป้ายอะไรเลย
// กัน
//   1 กัปตันคนเดียวกันอยู่ลำ A (ท่า 1) และลำ B (ท่า 2) · การ์ดทั้งสองท่าขึ้นป้าย "ซ้ำ" บอกชื่อลำอีกลำและท่า
//   2 แถบเตือนหัวหน้า "คนซ้ำลำ N คน" ขึ้นทั้งสองท่า
//   3 เมนูเลือกคน · คนที่อยู่ลำอื่นแล้วมีคำว่า "อยู่ <ลำ>" ต่อท้าย · คนที่ว่างไม่มี
//   4 เอาคนออกจากลำ B · ป้ายซ้ำหาย แถบเตือนหาย
//   5 ทีมประจำลำ (PIER_TEAM) ของลำที่จอด ไม่นับเป็นการจ่ายงาน · ไม่ทำให้ขึ้นซ้ำ
//   6 ไม่มี error
import { open } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1100 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(900);
const show = (pier) => page.evaluate((pier) => {
  _poPier = pier;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const v = document.getElementById('view-poj-' + pier); if (v) v.classList.add('active');
  renderPierJob(pier);
}, pier);
const S = await page.evaluate(() => {
  const D = '2026-09-23'; _poDate = D; TRIPS[D] = TRIPS[D] || {};
  const piers = (PO_PIERS || []).map(x => x.k).filter(k => (BOATS || []).some(b => (b.pier || '') === k) && (ROUTES || []).some(r => (r.pier || '') === k));
  if (piers.length < 2) return { err: 'ข้อมูลชุดนี้มีท่าเดียว' };
  const pick = {};
  piers.slice(0, 2).forEach(k => {
    const mine = (BOATS || []).filter(b => (b.pier || '') === k), rt = (ROUTES || []).find(r => (r.pier || '') === k);
    mine.forEach(b => { if (!TRIPS[D][b.id]) TRIPS[D][b.id] = { route: rt.id, type: 'normal', booked: 0 }; });
    pick[k] = { going: mine[0].id, idle: mine[1] ? mine[1].id : '' };
    if (mine[1]) delete TRIPS[D][mine[1].id];
  });
  /* ทะเบียนพนักงานในชุดทดสอบว่าง · ใส่คนสมมุติ 3 คน */
  if (!(PIER_STAFF || []).length) { window.PIER_STAFF = PIER_STAFF || []; PIER_STAFF.push({ id: 'zz_c1', name: 'นายทดสอบ หนึ่ง', nick: 'หนึ่ง', role: 'กัปตัน', pier: piers[0], active: true }, { id: 'zz_c2', name: 'นายทดสอบ สอง', nick: 'สอง', role: 'กัปตัน', pier: piers[1], active: true }, { id: 'zz_c3', name: 'นายทดสอบ สาม', nick: 'สาม', role: 'เด็กเรือ', pier: piers[0], active: true }); }
  const staff = (PIER_STAFF || []).filter(s => s.active !== false);
  const cap = staff[0], free = staff[1], std = staff[2];
  const [p1, p2] = piers;
  pjSet(D, pick[p1].going, { cap: cap.id, asst: '', crew: [], island: [] });
  pjSet(D, pick[p2].going, { cap: cap.id, asst: free.id, crew: [], island: [] });
  /* ทีมประจำของลำที่จอด มีกัปตันคนเดียวกัน · ต้องไม่ถูกนับ */
  if (pick[p1].idle) PIER_TEAM[pick[p1].idle] = { cap: cap.id, asst: '', crew: [] };
  return { D, p1, p2, b1: pick[p1].going, b2: pick[p2].going, idle: pick[p1].idle, cap: cap.id, capName: pjStaffName(cap.id), free: free.id, freeName: pjStaffName(free.id) };
});
if (S.err) { fail(S.err); await close(); process.exit(1); }
const read = (bid) => page.evaluate((bid) => {
  const host = document.getElementById('pj-host-' + _poPier);
  const nm = (getBoat(bid) || {}).name || bid;
  const card = [...host.querySelectorAll('.bc')].find(c => (c.querySelector('.bn') || {}).textContent === nm);
  const dup = card ? [...card.querySelectorAll('.pj-dup')].map(e => e.textContent.trim()) : null;
  const warn = host.querySelector('.pj-dupw');
  const sel = card ? card.querySelector('.pj-rw select') : null;
  const opts = sel ? [...sel.options].map(o => o.textContent) : [];
  return { dup, warn: warn ? warn.textContent.trim() : '', opts };
}, bid);
await show(S.p1); const a1 = await read(S.b1);
await show(S.p2); const a2 = await read(S.b2);
const b1name = await page.evaluate((id) => (getBoat(id) || {}).name || id, S.b1), b2name = await page.evaluate((id) => (getBoat(id) || {}).name || id, S.b2);
if (a1.dup && a1.dup.length === 1 && a1.dup[0].indexOf(b2name) >= 0 && a2.dup && a2.dup.length === 1 && a2.dup[0].indexOf(b1name) >= 0) ok(`1 ป้ายซ้ำทั้งสองท่า · "${a1.dup[0]}" / "${a2.dup[0]}"`); else fail('1 ' + JSON.stringify({ a1: a1.dup, a2: a2.dup, b1name, b2name }));
if (/คนซ้ำลำ 1 คน/.test(a1.warn) && /คนซ้ำลำ 1 คน/.test(a2.warn)) ok(`2 แถบเตือน · "${a2.warn}"`); else fail('2 ' + JSON.stringify({ w1: a1.warn, w2: a2.warn }));
const src = a1.opts.length ? a1 : a2, other = a1.opts.length ? b2name : b1name;
const capOpt = src.opts.find(o => o.indexOf(S.capName) === 0), freeOpt = src.opts.find(o => o.indexOf(S.freeName) === 0);
if (capOpt && /อยู่/.test(capOpt) && capOpt.indexOf(other) >= 0 && freeOpt) ok(`3 เมนู · "${capOpt}" · คนว่างไม่มีป้าย`); else fail('3 ' + JSON.stringify({ capOpt, freeOpt }));
await page.evaluate((S) => { pjSet(S.D, S.b2, { cap: '' }); renderPierJob(S.p2); }, S);
const c2 = await read(S.b2);
await show(S.p1); const c1 = await read(S.b1);
if (c1.dup && !c1.dup.length && c2.dup && !c2.dup.length && !c1.warn && !c2.warn) ok('4 เอาคนออก · ป้ายและแถบเตือนหาย'); else fail('4 ' + JSON.stringify({ c1, c2 }));
const idleOk = await page.evaluate((S) => { if (!S.idle) return true; const L = pjCrewElsewhere(S.D, S.b1, S.cap); return !L.some(x => x.bid === S.idle); }, S);
if (idleOk) ok('5 ทีมประจำของลำที่จอดไม่นับเป็นการจ่ายงาน'); else fail('5 idle std team counted');
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('6 no page errors'); else fail('6 ' + e1.slice(0, 3).join(' | '));
if (process.env.SHOT) { await page.evaluate((S) => { pjSet(S.D, S.b2, { cap: S.cap }); renderPierJob(S.p1); }, S); await page.waitForTimeout(300); await page.screenshot({ path: process.env.SHOT }); }
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
