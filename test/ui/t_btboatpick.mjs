// §btBoatPick · By trip date · pick a boat from the Boat column without switching to Boat mode
//
// Source (2026-10-13) · owner: "เรื่องจัดเรือ สามารถให้เลือกเรือในหน้า By trip date ได้โดยไม่ต้องเปิดโหมดเรือแล้วได้ไหม"
// Checks
//   1 (§btBoatPick · owner "เลือกเรือ ให้เป็นปุ่ม + พอ") normal view · a row with a boat: its boat label becomes the picker button (same width as the plain label) · a row without one has a "+" button
//   2 click → the same boat picker as Boat mode (only boats on that route) · "unassign" → saved on the booking
//     for that day (ops), the row turns into "+" · Boat mode not switched on
//   3 "+" on an unassigned row → pick → assigned
//   4 charter rows and cancelled rows keep a plain label (no button)
//   5 view-only user (no booking edit right) → no buttons anywhere
//   6 Boat mode still shows its own cell (tick box + picker + upgrade) · Compact: button inside the cell, not clipped
//   7 no page errors
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'booking', 800);

const S = await page.evaluate(async () => {
  const cxl = ['cancelled', 'rejected', 'cancelled_weather'];
  // a day + route with ≥2 boats, ≥1 booking with a boat and ≥1 without, both seat bookings
  const by = {};
  SB_BOOKINGS.forEach(b => { if (cxl.includes(b.status)) return; (b.trips || []).forEach(t => { if (!t || !t.date || t.bookingMode === 'charter') return;
    const k = t.date + '|' + t.routeId; (by[k] = by[k] || []).push(b); }); });
  let pick = null;
  for (const k of Object.keys(by)) { const [d, rid] = k.split('|'); let boats = []; try { boats = baBoatsForRoute(d, rid) || []; } catch (_) {}
    if (boats.length < 1) continue;
    const ok = by[k].filter(b => !(bkOpsRead(b, d).boatSplits || []).length && !((bkOpsRead(b, d).vanSplits || []).length));
    if (ok.length < 2) continue;
    // test data: first booking gets boat 1, second has none (set here · display/assign test only)
    bkOpsFor(ok[0], d).boatId = boats[0].boatId; delete bkOpsFor(ok[1], d).boatId;
    pick = { d, rid, w: ok[0].id, wo: ok[1].id, boats: boats.map(x => x.boatId) }; break; }
  if (!pick) return { err: 'no day with a boat on a route and 2 plain bookings' };
  btcSet('classic'); _bkV2.filterDate = pick.d; _bkV2.filterRoute = null; bkV2SwitchTab('bytrip');
  await new Promise(z => setTimeout(z, 600));
  return pick;
});
if (S.err) { fail(S.err); await close(); process.exit(1); }
ok(`setup ${S.d} ${S.rid} · boats ${S.boats.join(', ')} · with boat ${S.w} · without ${S.wo}`);
const cell = id => `#view-booking tr.t2-row[data-al="${id}"] > td:last-child, #view-booking tr.t2-row[data-al="${id}"] td .t2-bpk`;

const c1 = await page.evaluate(S => { const q = id => document.querySelector('#view-booking tr.t2-row[data-al="' + id + '"] .t2-bpk');
  const a = q(S.w), b = q(S.wo); const nm = a && [...a.querySelectorAll('span')].pop();
  return { a: a && a.textContent.replace(/\s+/g, ' ').trim(), cut: !!(nm && nm.scrollWidth > nm.clientWidth + 1), aAdd: a && a.classList.contains('add'), b: b && b.textContent.trim(), bAdd: b && b.classList.contains('add'),
    all: document.querySelectorAll('#view-booking .t2-bpk').length }; }, S);
if (c1.a && !c1.aAdd && c1.bAdd && c1.b === '+') ok(`1 picker on every editable row (${c1.all}) · "${c1.a}" · "${c1.b}"`); else fail('1 ' + JSON.stringify(c1));

const c2 = await page.evaluate(async S => {
  const bk = SB_BOOKINGS.find(b => b.id === S.w), before = bkOpsRead(bk, S.d).boatId;
  document.querySelector('#view-booking tr.t2-row[data-al="' + S.w + '"] .t2-bpk').click(); await new Promise(z => setTimeout(z, 150));
  const pop = document.getElementById('bkv2-boatpick'); if (!pop) return { nopop: true };
  const items = [...pop.querySelectorAll('[onclick^="bkV2BoatPickSet"]')].map(e => (e.getAttribute('onclick').match(/'([^']+)','([^']*)'/) || [])[2]).filter(Boolean);
  const un = pop.querySelector('[onclick="bkV2BoatPickSet(\'' + S.w + '\',\'\')"]'); if (!un) return { nounassign: true, items };
  un.click(); await new Promise(z => setTimeout(z, 500));
  const after = bkOpsRead(SB_BOOKINGS.find(b => b.id === S.w), S.d).boatId || '';
  const btn = document.querySelector('#view-booking tr.t2-row[data-al="' + S.w + '"] .t2-bpk');
  return { before, after, items, routeOnly: items.length >= 1 && items.every(i => S.boats.includes(i)), add: btn && btn.classList.contains('add'), boatMode: !!_bkV2.boatAssignMode, closed: !document.getElementById('bkv2-boatpick') };
}, S);
if (!c2.nopop && c2.before && c2.after === '' && c2.routeOnly && c2.add && !c2.boatMode && c2.closed)
  ok(`2 picker lists ${c2.items.length} boat(s) of the route · unassign ${c2.before} → none, row shows "+" · Boat mode stays off`); else fail('2 ' + JSON.stringify(c2));
const c2b = await page.evaluate(async S => { document.querySelector('#view-booking tr.t2-row[data-al="' + S.w + '"] .t2-bpk.add').click(); await new Promise(z => setTimeout(z, 150));
  document.getElementById('bkv2-boatpick').querySelector('[onclick^="bkV2BoatPickSet(\'' + S.w + '\',\'' + S.boats[0] + '\'"]').click(); await new Promise(z => setTimeout(z, 500));
  return bkOpsRead(SB_BOOKINGS.find(b => b.id === S.w), S.d).boatId; }, S);
if (c2b !== S.boats[0]) fail('2b reassign ' + c2b);
const c3 = await page.evaluate(async S => {
  document.querySelector('#view-booking tr.t2-row[data-al="' + S.wo + '"] .t2-bpk.add').click(); await new Promise(z => setTimeout(z, 150));
  const pop = document.getElementById('bkv2-boatpick'); const it = pop && pop.querySelector('[onclick^="bkV2BoatPickSet(\'' + S.wo + '\',\'' + S.boats[0] + '\'"]');
  if (!it) return { noitem: true }; it.click(); await new Promise(z => setTimeout(z, 500));
  const b = document.querySelector('#view-booking tr.t2-row[data-al="' + S.wo + '"] .t2-bpk');
  return { after: bkOpsRead(SB_BOOKINGS.find(b => b.id === S.wo), S.d).boatId, add: b && b.classList.contains('add') };
}, S);
if (c3.after === S.boats[0] && c3.add === false) ok(`3 "+" → ${c3.after} assigned`); else fail('3 ' + JSON.stringify(c3));

const c4 = await page.evaluate(async S => {
  const cxl = ['cancelled', 'rejected', 'cancelled_weather'];
  const dch = (SB_BOOKINGS.find(b => !cxl.includes(b.status) && (b.trips || []).some(t => t.bookingMode === 'charter' && t.date)) || { trips: [] }).trips.find(t => t.bookingMode === 'charter').date;
  if (dch) { _bkV2.filterDate = dch; bkV2Render(); await new Promise(z => setTimeout(z, 400)); }
  const rows = [...document.querySelectorAll('#view-booking tr.t2-row')];
  const ch = rows.filter(r => r.closest('table') && r.previousElementSibling && false);
  const charterRows = [...document.querySelectorAll('#view-booking tr.t2-zband-ch')].map(z => { let n = z.nextElementSibling, out = []; while (n && !n.classList.contains('t2-zband')) { if (n.classList.contains('t2-row')) out.push(n); n = n.nextElementSibling; } return out; }).flat();
  const cx = rows.filter(r => r.classList.contains('t2-cxl'));
  const res = { day: dch, charter: charterRows.length, charterBtn: charterRows.filter(r => r.querySelector('.t2-bpk')).length, cxl: cx.length, cxlBtn: cx.filter(r => r.querySelector('.t2-bpk')).length, others: document.querySelectorAll('#view-booking .t2-bpk').length };
  _bkV2.filterDate = S.d; bkV2Render(); await new Promise(z => setTimeout(z, 400)); return res;
}, S);
if (c4.charter > 0 && !c4.charterBtn && !c4.cxlBtn) ok(`4 ${c4.day} · no picker on ${c4.charter} charter row(s) and ${c4.cxl} cancelled row(s) · ${c4.others} other rows have one`); else fail('4 ' + JSON.stringify(c4));

const c5 = await page.evaluate(async () => { const keep = window.acctCanEditBookings; window.acctCanEditBookings = () => false; bkV2Render(); await new Promise(z => setTimeout(z, 300));
  const n = document.querySelectorAll('#view-booking .t2-bpk').length; window.acctCanEditBookings = keep; bkV2Render(); await new Promise(z => setTimeout(z, 300)); return n; });
if (c5 === 0) ok('5 view-only user · no picker buttons'); else fail('5 ' + c5);

const c6 = await page.evaluate(async S => {
  bkV2ToggleBoatMode(); await new Promise(z => setTimeout(z, 400));
  const bm = !!document.querySelector('#view-booking tr.t2-row[data-al="' + S.w + '"] [data-babtn="pick"]'), bmOld = document.querySelectorAll('#view-booking .t2-bpk').length;
  bkV2ToggleBoatMode(); btcSet('compact'); await new Promise(z => setTimeout(z, 700));
  const b = document.querySelector('#view-booking tr.t2-row[data-al="' + S.w + '"] .t2-bpk'), td = b.closest('td'), br = b.getBoundingClientRect(), tr = td.getBoundingClientRect();
  const r = { bm, bmOld, inCell: br.left >= tr.left - 1 && br.right <= tr.right + 1 && br.top >= tr.top - 4 && br.bottom <= tr.bottom + 4, w: Math.round(br.width), cw: Math.round(tr.width) };
  btcSet('classic'); return r; }, S);
if (c6.bm && c6.bmOld === 0 && c6.inCell) ok(`6 Boat mode keeps its own cell · Compact button ${c6.w}px in a ${c6.cw}px cell`); else fail('6 ' + JSON.stringify(c6));

const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('7 no page errors'); else fail('7 ' + e1.slice(0, 3).join(' | '));
if (process.env.SHOT) { const t = page.locator(`#view-booking tr.t2-row[data-al="${S.w}"] .t2-bpk`); await t.scrollIntoViewIfNeeded(); await t.click(); await page.waitForTimeout(200);
  const b = await page.locator(`#view-booking tr.t2-row[data-al="${S.w}"]`).boundingBox(); const p = await page.locator('#bkv2-boatpick-panel').boundingBox();
  const x0 = Math.max(0, Math.min(p.x, 1900 - 900)), y0 = Math.max(0, Math.min(b.y, p.y) - 60), y1 = Math.max(b.y + b.height, p.y + p.height) + 10;
  await page.screenshot({ path: process.env.SHOT, clip: { x: x0, y: y0, width: 900, height: y1 - y0 } }); }
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
