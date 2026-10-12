// §bopReplace · Boat Operation · a boat breaks → move all its days in a range to another boat in one go
//
// Source (2026-10-12) · owner, Boat Operation Jan 2027 with a row of 🔧 เปลี่ยนเรือ:
//   "อันนี้เรา วางเรือไว้ แล้วจู่ๆเรือเสีย ต้องปลดเรือออกทั้งแถวทีเดียวยังไง" → chose "เปลี่ยนเป็นเรืออื่น"
// Setup: boat A (fixing from D) runs route R on D..D+4; boat B (same pier, available) is busy on D+2;
//        a booking is on A on D+1; A also has a charter-held slot on D+5
// Checks
//   1 Bulk actions has "Replace a boat (range)"; from a 🔧 cell the form preselects the broken boat
//   2 preview: "จัดไว้ 6 วัน · เปลี่ยนได้ 4 วัน · ข้าม busy 1 · locked 1"
//   3 apply: D, D+1, D+3, D+4 now on B with the same route; A gone those days; D+2 still A; charter slot kept
//   4 the booking on A on D+1 is now on B
//   5 a boat at another pier is not used (skipped as "pier"); over-cap day skipped as "cap"
//   6 drop ticked → the skipped busy day loses A; remove-only (no replacement) clears A over the range, never a charter slot
//   7 no page errors
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1100 });
await goView(page, 'operation', 1200);

const S = await page.evaluate(() => {
  window.__al = []; window.alert = m => { window.__al.push(String(m)); }; window.__cf = []; window.confirm = m => { window.__cf.push(String(m)); return true; };
  const add = (ds, n) => { const p = ds.split('-').map(Number); return fmt(new Date(p[0], p[1] - 1, p[2] + n, 12)); };
  const D = add(TODAY_STR, 20);
  const R = ROUTES.find(r => r && r.pier === 'panwa' && r.active !== false && !laIsLandRoute(r));
  const R2 = ROUTES.find(r => r && r.pier === 'panwa' && r.id !== R.id && r.active !== false && !laIsLandRoute(r));
  const own = BOATS.filter(b => b && !b.retired && b.pier === 'panwa' && String(b.ownership || '') !== 'charter');
  const A = own[0], B = own[1], C = BOATS.find(b => b && !b.retired && b.pier === 'tublamu' && String(b.ownership || '') !== 'charter');
  const clean = b => { b.log = [{ id: 'zz_' + b.id, s: 'available', from: add(D, -40), to: null, loc: '-' }]; b.assignments = [];
    (window.FL_MAINT || []).forEach(m => { if (m && m.boatId === b.id) m.status = 'done'; });
    (typeof FL_PROJECTS !== 'undefined' ? FL_PROJECTS : []).forEach(p => { if (p && p.boatId === b.id) p.status = 'completed'; }); };
  [A, B, C].forEach(clean);
  A.log.push({ id: 'zz_fix', s: 'fixing', from: D, to: null, loc: 'shop' });
  for (let i = -2; i < 10; i++) { const d = add(D, i); if (TRIPS[d]) [A.id, B.id, C.id].forEach(x => delete TRIPS[d][x]); }
  for (let i = 0; i < 5; i++) { const d = add(D, i); (TRIPS[d] = TRIPS[d] || {})[A.id] = { route: R.id, type: 'normal', booked: 0 }; }
  TRIPS[add(D, 2)][B.id] = { route: R2.id, type: 'normal', booked: 0 };
  (TRIPS[add(D, 5)] = TRIPS[add(D, 5)] || {})[A.id] = { route: R.id, type: 'normal', booked: 0, charterBookingId: 'zz_ch' };
  const bk = { id: 'zz_bk_rp', schemaVer: 2, agentId: (SB_AGENTS[0] || {}).id, status: 'confirmed', leadPax: 'Test Replace', voucherRef: 'ZZRP1',
    trips: [{ routeId: R.id, date: add(D, 1), bookingMode: 'seat', pax: { ad_fr: 4, ad_th: 0, chd_fr: 0, chd_th: 0, inf_fr: 0, inf_th: 0, foc: 0 } }],
    ops: { boatId: A.id }, passengers: [], addOns: [], history: [] };
  SB_BOOKINGS.push(bk);
  _bop2.viewMode = 'month'; _bop2.anchor = new Date(add(D, 0) + 'T12:00:00'); _bop2.anchor.setDate(1); _bop2.selDate = D; _bop2.selRoute = R.id; _bop2.pier = 'all';
  renderOp();
  return { D, d: [0, 1, 2, 3, 4, 5].map(i => add(D, i)), R: R.id, R2: R2.id, A: A.id, B: B.id, C: C.id, AN: A.name, BN: B.name, end: add(D, 8) };
});
await page.waitForTimeout(700);

// 1
const c1 = await page.evaluate(async S => {
  const btn = [...document.querySelectorAll('#view-operation .bo-pier-pill')].find(e => /Bulk actions/.test(e.textContent));
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); await new Promise(z => setTimeout(z, 200));
  const it = [...document.querySelectorAll('#bo-bulk-menu button')].find(b => /Replace a boat/.test(b.textContent));
  if (!it) return { item: false };
  it.click(); await new Promise(z => setTimeout(z, 300));
  const f = document.getElementById('bop2rp-from');
  return { item: true, pre: f && f.value, d1: (document.getElementById('bop2rp-d1') || {}).value };
}, S);
if (c1.item && c1.pre === S.A && c1.d1 === S.D) ok(`1 Bulk actions → Replace a boat · broken boat preselected (${S.AN}) from ${c1.d1}`); else fail('1 ' + JSON.stringify(c1));

// 2
const c2 = await page.evaluate(async S => {
  const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
  set('bop2rp-d2', S.end); set('bop2rp-to', S.B); await new Promise(z => setTimeout(z, 100));
  return document.getElementById('bop2rp-prev').textContent.replace(/\s+/g, ' ').trim(); }, S);
if (/จัดไว้ 6 วัน/.test(c2) && /ได้ 4 วัน/.test(c2) && /เรือใหม่มีงานแล้ว/.test(c2) && /เหมาลำ/.test(c2)) ok('2 preview: "' + c2 + '"'); else fail('2 ' + c2);

// 3 + 4
const c3 = await page.evaluate(async S => {
  __al.length = 0; __cf.length = 0; bop2ApplyReplace(); await new Promise(z => setTimeout(z, 300));
  const at = d => ({ A: !!(TRIPS[d] || {})[S.A], B: ((TRIPS[d] || {})[S.B] || {}).route || '', ch: !!((TRIPS[d] || {})[S.A] || {}).charterBookingId });
  const bk = SB_BOOKINGS.find(b => b.id === 'zz_bk_rp');
  return { days: S.d.map(at), bk: bk.ops.boatId, al: __al.slice(), cf: __cf.slice(), modal: !!document.getElementById('bop2-modal') }; }, S);
const moved = [0, 1, 3, 4].every(i => !c3.days[i].A && c3.days[i].B === S.R);
if (moved && c3.days[2].A && c3.days[2].B === S.R2 && c3.days[5].A && c3.days[5].ch && !c3.modal) ok('3 4 days moved to ' + S.BN + ' (route kept) · busy day still ' + S.AN + ' · charter slot kept · "' + c3.al[0] + '"'); else fail('3 ' + JSON.stringify(c3));
if (c3.bk === S.B) ok('4 booking on ' + S.AN + ' that day is now on ' + S.BN); else fail('4 ' + JSON.stringify(c3.bk));

// 5 other pier / over cap
const c5 = await page.evaluate(S => {
  const add = (ds, n) => { const p = ds.split('-').map(Number); return fmt(new Date(p[0], p[1] - 1, p[2] + n, 12)); };
  const d = add(S.D, 7); (TRIPS[d] = TRIPS[d] || {})[S.A] = { route: S.R, type: 'normal', booked: 0 };
  const pier = bop2ReplacePlan(S.A, S.C, d, d);
  const B = BOATS.find(b => b.id === S.B), keep = B.cap; B.cap = 1;
  const bk = SB_BOOKINGS.find(b => b.id === 'zz_bk_rp'); bk.trips[0].date = d; bk.ops.boatId = S.A;
  const cap = bop2ReplacePlan(S.A, S.B, d, d); B.cap = keep;
  return { pier: pier.skip.map(s => s.why), cap: cap.skip.map(s => s.why), d }; }, S);
if (c5.pier[0] === 'pier' && c5.cap[0] === 'cap') ok('5 boat at another pier → "pier" · too many pax for the new boat → "cap" (not moved)'); else fail('5 ' + JSON.stringify(c5));

// 6 drop + remove-only
const c6 = await page.evaluate(async S => {
  const add = (ds, n) => { const p = ds.split('-').map(Number); return fmt(new Date(p[0], p[1] - 1, p[2] + n, 12)); };
  bop2OpenModal('replaceRange');
  const set = (id, v) => { const e = document.getElementById(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
  set('bop2rp-from', S.A); set('bop2rp-d1', S.D); set('bop2rp-d2', add(S.D, 2)); set('bop2rp-to', S.B); set('bop2rp-drop', true);
  bop2ApplyReplace(); await new Promise(z => setTimeout(z, 200));
  const busyGone = !(TRIPS[add(S.D, 2)] || {})[S.A] && ((TRIPS[add(S.D, 2)] || {})[S.B] || {}).route === S.R2;
  bop2OpenModal('replaceRange');
  set('bop2rp-from', S.A); set('bop2rp-d1', S.D); set('bop2rp-d2', S.end); set('bop2rp-to', '');
  const prev = document.getElementById('bop2rp-prev').textContent.replace(/\s+/g, ' ');
  bop2ApplyReplace(); await new Promise(z => setTimeout(z, 200));
  const left = []; for (let i = 0; i <= 8; i++) { const d = add(S.D, i); const o = (TRIPS[d] || {})[S.A]; if (o) left.push(i + (o.charterBookingId ? 'ch' : '')); }
  return { busyGone, left, prev }; }, S);
if (c6.busyGone && c6.left.length === 1 && c6.left[0] === '5ch') ok('6 drop ticked clears the busy day · remove-only clears ' + S.AN + ' over the range, charter kept · "' + c6.prev.slice(0, 90) + '"'); else fail('6 ' + JSON.stringify(c6));

const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('7 no page errors'); else fail('7 ' + e1.slice(0, 3).join(' | '));
await page.evaluate(() => { bop2OpenModal('replaceRange'); });
await page.waitForTimeout(200);
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
