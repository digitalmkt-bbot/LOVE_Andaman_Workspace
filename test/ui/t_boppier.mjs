// §bopPier · Boat Operation · a boat can only run a programme of the pier it is at on that day
//
// Source (2026-10-10) · owner, with Boat Status + Boat Operation screenshots:
//   "เรือบางลำถูกกำหนดให้อยู่อีกท่าเรือนึง แต่อีกท่าเรือนึงหยิบมาใช้ได้ ช่วยดู"
//   Achilles: Boat Status put it at Tub Lamu 18-23 Oct, yet Boat Operation had it on
//   Visit Panwa programmes on 20, 21, 23 Oct.
//
// Setup: a Panwa boat X is moved to Tub Lamu for D..D+2 (pier assignment).
// Checks
//   1 bop2PierIssue says X is at tublamu on D for a Panwa route, '' for a Tub Lamu route
//   2 bop2AssignBoat refuses X on a Panwa route on D (alert names the pier) and does not write TRIPS
//   3 bop2AssignBoat still puts X on a Tub Lamu route on D
//   4 Copy day to week: X's Panwa slot is copied to days it is at Panwa, not to D..D+2
//   5 Assign range over S..D+3: writes S and D+3, skips D..D+2, alert says "another pier"
//   6 an old conflicting slot (X on Panwa route on D) is flagged in the heatmap cell
//   7 the "boats out today" card (เรือที่ออกวันนี้) shows the warning under that boat
//   8 the cell popover marks X "at Tub Lamu"
//   9 no page errors
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1100 });
await goView(page, 'operation', 1200);

const S = await page.evaluate(() => {
  window.__al = []; window.alert = m => { window.__al.push(String(m)); }; window.confirm = () => true;
  const add = (ds, n) => { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return fmt(d); };
  const D = add(TODAY_STR, 10), Sd = add(D, -1);
  const rP = ROUTES.find(r => r && r.pier === 'panwa'), rT = ROUTES.find(r => r && r.pier === 'tublamu');
  const X = BOATS.find(b => b && !b.retired && b.pier === 'panwa' && String(b.ownership || '') !== 'charter');
  if (!rP || !rT || !X) return { err: 'need a Panwa route, a Tub Lamu route and a Panwa boat' };
  X.log = [{ s: 'available', from: add(Sd, -3), to: add(D, 20), loc: '-' }];
  X.assignments = [{ id: 'asn_t', type: 'temporary', fromPier: 'panwa', toPier: 'tublamu', startDate: D, endDate: add(D, 2), status: 'active' }];
  if (Array.isArray(window.FL_MAINT)) FL_MAINT.forEach(m => { if (m && m.boatId === X.id) m.status = 'done'; });
  if (typeof FL_PROJECTS !== 'undefined' && Array.isArray(FL_PROJECTS)) FL_PROJECTS.forEach(p => { if (p && p.boatId === X.id) p.status = 'done'; });
  for (let i = -3; i < 12; i++) { const ds = add(D, i); if (TRIPS[ds]) delete TRIPS[ds][X.id]; }
  return { D, Sd, rP: rP.id, rT: rT.id, X: X.id, XN: X.name, add1: add(D, 1), add2: add(D, 2), add3: add(D, 3), add4: add(D, 4) };
});
if (S.err) { fail('setup · ' + S.err); await close(); process.exit(1); }

// 1
const c1 = await page.evaluate(S => { const X = BOATS.find(b => b.id === S.X);
  return [typeof bop2PierIssue === 'function' ? bop2PierIssue(X, S.rP, S.D) : 'nofn', typeof bop2PierIssue === 'function' ? bop2PierIssue(X, S.rT, S.D) : 'nofn', getBoatCurrentPier(X, S.D)]; }, S);
if (c1[0] === 'tublamu' && c1[1] === '') ok(`1 ${S.XN} on ${S.D} · Panwa route → "${c1[0]}", Tub Lamu route → ok`); else fail('1 ' + JSON.stringify(c1));

// 2
const c2 = await page.evaluate(S => { __al.length = 0; bop2AssignBoat(S.rP, S.D, S.X);
  return { op: (TRIPS[S.D] || {})[S.X] || null, al: __al.slice() }; }, S);
if (!c2.op && c2.al.some(a => /Tub Lamu/.test(a) && /another pier/.test(a))) ok('2 refused on the Panwa route · "' + c2.al[0].split('\n')[0] + '"');
else fail('2 ' + JSON.stringify(c2));

// 3
const c3 = await page.evaluate(S => { __al.length = 0; bop2AssignBoat(S.rT, S.D, S.X); const op = (TRIPS[S.D] || {})[S.X] || null;
  if (TRIPS[S.D]) delete TRIPS[S.D][S.X]; return { op, al: __al.slice() }; }, S);
if (c3.op && c3.op.route === S.rT && !c3.al.length) ok('3 Tub Lamu route on the same day is accepted'); else fail('3 ' + JSON.stringify(c3));

// 4 copy day → week
const c4 = await page.evaluate(S => { __al.length = 0;
  _bop2.viewMode = 'week'; _bop2.anchor = new Date(S.Sd + 'T12:00:00'); _bop2.selDate = S.Sd;
  TRIPS[S.Sd] = TRIPS[S.Sd] || {}; TRIPS[S.Sd][S.X] = { route: S.rP, type: 'normal', booked: 0 };
  const keep = {}; Object.keys(TRIPS[S.Sd]).forEach(b => { if (b !== S.X) { keep[b] = TRIPS[S.Sd][b]; delete TRIPS[S.Sd][b]; } });
  bop2CopyDayToWeek();
  Object.assign(TRIPS[S.Sd], keep);
  const got = [S.D, S.add1, S.add2, S.add3, S.add4].map(d => ((TRIPS[d] || {})[S.X] || {}).route || '');
  [S.D, S.add1, S.add2, S.add3, S.add4].forEach(d => { if (TRIPS[d]) delete TRIPS[d][S.X]; });
  delete TRIPS[S.Sd][S.X];
  return { got, al: __al.slice() }; }, S);
if (c4.got.slice(0, 3).every(r => !r) && c4.got[3] === S.rP && c4.got[4] === S.rP && c4.al.some(a => /another pier/.test(a)))
  ok('4 copy day: not copied to the 3 Tub Lamu days, copied to the Panwa days · "' + c4.al[0] + '"');
else fail('4 ' + JSON.stringify(c4));

// 5 assign range
const c5 = await page.evaluate(S => { __al.length = 0;
  const box = document.createElement('div'); box.id = 'zz-ar'; box.style.display = 'none';
  box.innerHTML = '<input id="bop2ar-boat"><input id="bop2ar-route"><input id="bop2ar-from"><input id="bop2ar-to"><input id="bop2ar-overwrite" type="checkbox">';
  document.body.appendChild(box);
  document.getElementById('bop2ar-boat').value = S.X; document.getElementById('bop2ar-route').value = S.rP;
  document.getElementById('bop2ar-from').value = S.Sd; document.getElementById('bop2ar-to').value = S.add3;
  bop2ApplyAssignRange(); box.remove();
  const got = [S.Sd, S.D, S.add1, S.add2, S.add3].map(d => ((TRIPS[d] || {})[S.X] || {}).route || '');
  [S.Sd, S.D, S.add1, S.add2, S.add3].forEach(d => { if (TRIPS[d]) delete TRIPS[d][S.X]; });
  return { got, al: __al.slice() }; }, S);
if (c5.got[0] === S.rP && c5.got[4] === S.rP && c5.got.slice(1, 4).every(r => !r) && c5.al.some(a => /3 skipped \(boat at another pier/.test(a)))
  ok('5 assign range: 2 days written, 3 skipped · "' + c5.al[0] + '"');
else fail('5 ' + JSON.stringify(c5));

// 6–8 old conflicting slot
await page.evaluate(async S => {
  TRIPS[S.D] = TRIPS[S.D] || {}; TRIPS[S.D][S.X] = { route: S.rP, type: 'normal', booked: 0 };
  _bop2.viewMode = 'week'; _bop2.anchor = new Date(S.Sd + 'T12:00:00'); _bop2.pier = 'all'; _bop2.selRoute = S.rP; _bop2.selDate = S.D;
  renderOp(); await new Promise(z => setTimeout(z, 600)); }, S);
const c6 = await page.evaluate(S => { const c = document.querySelector(`#view-operation .bop2-cell[data-route="${S.rP}"][data-date="${S.D}"]`);
  if (!c) return { none: true }; return { t: c.getAttribute('title') || '', inner: c.innerHTML.includes('at Tub Lamu') || /is at Tub Lamu/.test(c.innerHTML), txt: c.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) }; }, S);
if (!c6.none && (/at Tub Lamu/.test(c6.t) || c6.inner)) ok('6 heatmap cell flags it · "' + (c6.t || c6.txt).slice(0, 110) + '"'); else fail('6 ' + JSON.stringify(c6));

const c7 = await page.evaluate(S => { const r = document.querySelector(`#view-operation [data-bopout-boat="${S.X}"]`);
  return r ? { w: [...r.querySelectorAll('.bop2-pier-warn')].map(e => e.textContent.trim()), grp: r.dataset.pier } : { none: true }; }, S);
if (c7.w && c7.w.length && /Tub Lamu/.test(c7.w[0])) ok('7 "boats out today" card: "' + c7.w[0] + '"'); else fail('7 ' + JSON.stringify(c7));

const c8 = await page.evaluate(async S => { const a = document.querySelector(`#view-operation .bop2-cell[data-route="${S.rP}"][data-date="${S.D}"]`) || document.body;
  bop2OpenCellPopover(S.rP, S.D, a); await new Promise(z => setTimeout(z, 300));
  const w = [...document.querySelectorAll('.bop2-pier-warn')].filter(e => !e.closest('#view-operation .bop2-boat-card') && /at Tub Lamu/.test(e.textContent)).map(e => e.textContent.trim());
  if (typeof bop2CloseCellPopover === 'function') bop2CloseCellPopover(); delete TRIPS[S.D][S.X]; return w; }, S);
if (c8.length) ok('8 popover marks it "' + c8[0] + '"'); else fail('8 popover has no pier warning');

const e1 = errors.filter(e => !/Failed to load resource/.test(e));
if (!e1.length) ok('9 no page errors'); else fail('9 ' + e1.slice(0, 3).join(' | '));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
