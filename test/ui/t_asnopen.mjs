// §asnOpen · Move boat to another pier · known move date, return date not known yet
//
// Source (2026-10-13) · owner (Move boat to another pier form, end date required): "ถ้ารู้วันย้าย แต่ยังไม่รู้วันกลับล่ะ" → "ทำ"
// Checks
//   1 the form has "ยังไม่รู้วันกลับ" · ticking it disables the end date · save → assignment with no end date, Active
//   2 the boat is at the new pier from the start date on, also far ahead (+200 days) · before the start it is at home
//     (getBoatCurrentPier and the pier-office helper pjAsnAt)
//   3 Boat Status detail says "ยังไม่กำหนดวันกลับ" and offers "ตั้งวันกลับ"
//   4 ตั้งวันกลับ → end date saved · after it the boat is back at home · the button is gone
//   5 an empty end date without the tick is refused (nothing saved) · a normal dated move still saves
//   6 the daily status refresh keeps the open move Active · no page errors
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1000 });
let promptAns = null, alerts = [];
page.on('dialog', d => { if (d.type() === 'prompt') d.accept(promptAns); else { alerts.push(d.message()); d.accept(); } });
const S = await page.evaluate(async () => {
  nav(document.querySelector('.nav-item[data-view="fl-boatstatus"]')); await new Promise(z => setTimeout(z, 500));
  const b = BOATS.find(x => !x.retired && x.ownership !== 'charter' && !(x.assignments || []).some(a => a.status !== 'cancelled')) || BOATS[0];
  selectBoat(b.id); await new Promise(z => setTimeout(z, 300));
  const home = getBoatCurrentPier(b, TODAY_STR);
  flOpenNewAssignment(b.id); await new Promise(z => setTimeout(z, 200));
  const to = document.getElementById('asn-to').value;
  const op = document.getElementById('asn-open'); const hasBox = !!op;
  op.checked = true; op.dispatchEvent(new Event('change', { bubbles: true }));
  const disabled = document.getElementById('asn-end').disabled;
  document.getElementById('asn-reason').value = 'zz test open move';
  flSaveAssignment(); await new Promise(z => setTimeout(z, 300));
  const a = (b.assignments || []).find(x => x.reason === 'zz test open move');
  const add = n => { const d = new Date(TODAY_STR + 'T12:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  return { bid: b.id, name: b.name, home, to, hasBox, disabled, a: a && { end: a.endDate, status: a.status, id: a.id, start: a.startDate },
    p0: getBoatCurrentPier(b, TODAY_STR), p200: getBoatCurrentPier(b, add(200)), pm1: getBoatCurrentPier(b, add(-1)), pj200: !!(typeof pjAsnAt === 'function' && pjAsnAt(b, add(200))) };
});
if (S.hasBox && S.disabled && S.a && S.a.end === '' && S.a.status === 'active') ok(`1 ${S.name} · tick → end date off · saved ${S.home} → ${S.to} from ${S.a.start}, no end, Active`); else fail('1 ' + JSON.stringify(S));
if (S.p0 === S.to && S.p200 === S.to && S.pm1 === S.home && S.pj200) ok(`2 at ${S.to} today and +200 days (pier office too) · at ${S.home} the day before`); else fail('2 ' + JSON.stringify(S));
const c3 = await page.evaluate(async S => { selectBoat(S.bid); await new Promise(z => setTimeout(z, 300)); const t = document.body.innerText;
  return { lbl: /ยังไม่กำหนดวันกลับ/.test(t), btn: !!document.querySelector('button[onclick*="flAsnSetEnd(\'' + S.bid + '\',\'' + S.a.id + '\'"]') }; }, S);
if (c3.lbl && c3.btn) ok('3 Boat Status shows "ยังไม่กำหนดวันกลับ" and a "ตั้งวันกลับ" button'); else fail('3 ' + JSON.stringify(c3));
const end = await page.evaluate(() => { const d = new Date(TODAY_STR + 'T12:00'); d.setDate(d.getDate() + 10); return d.toISOString().slice(0, 10); });
promptAns = end;
const c4 = await page.evaluate(async ([S, end]) => { document.querySelector('button[onclick*="flAsnSetEnd(\'' + S.bid + '\',\'' + S.a.id + '\'"]').click(); await new Promise(z => setTimeout(z, 300));
  const b = BOATS.find(x => x.id === S.bid), a = b.assignments.find(x => x.id === S.a.id);
  const nx = d => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + 1); return x.toISOString().slice(0, 10); };
  return { end: a.endDate, status: a.status, onEnd: getBoatCurrentPier(b, end), after: getBoatCurrentPier(b, nx(end)), btn: !!document.querySelector('button[onclick*="flAsnSetEnd(\'' + S.bid + '\',\'' + S.a.id + '\'"]') }; }, [S, end]);
if (c4.end === end && c4.status === 'active' && c4.onEnd === S.to && c4.after === S.home && !c4.btn) ok(`4 ตั้งวันกลับ ${end} · at ${c4.onEnd} that day · back at ${c4.after} the next · button gone`); else fail('4 ' + JSON.stringify(c4));
alerts = [];
const c5 = await page.evaluate(async S => { const b = BOATS.find(x => x.id === S.bid); const n0 = b.assignments.length;
  flOpenNewAssignment(b.id); await new Promise(z => setTimeout(z, 100)); document.getElementById('asn-end').value = ''; flSaveAssignment(); await new Promise(z => setTimeout(z, 100));
  const n1 = b.assignments.length; closeModal('fl-modal-assignment');
  flOpenNewAssignment(b.id); await new Promise(z => setTimeout(z, 100)); const disabled = document.getElementById('asn-end').disabled; flSaveAssignment(); await new Promise(z => setTimeout(z, 100));
  const last = b.assignments[b.assignments.length - 1];
  return { n0, n1, n2: b.assignments.length, disabled, lastEnd: last.endDate }; }, S);
if (c5.n1 === c5.n0 && alerts.length >= 1 && !c5.disabled && c5.n2 === c5.n0 + 1 && /^\d{4}-\d{2}-\d{2}$/.test(c5.lastEnd)) ok(`5 empty end without the tick refused ("${alerts[0]}") · form reopens unticked · dated move saved (end ${c5.lastEnd})`); else fail('5 ' + JSON.stringify({ c5, alerts }));
const c6 = await page.evaluate(async S => { const b = BOATS.find(x => x.id === S.bid); const a = { id: 'asn_zz_open', type: 'temporary', fromPier: S.home, toPier: S.to, startDate: TODAY_STR, endDate: '', status: 'active' };
  b.assignments.push(a); flAutoUpdateAssignments(); return a.status; }, S);
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (c6 === 'active' && !e1.length) ok('6 daily refresh keeps the open move Active · no page errors'); else fail('6 ' + JSON.stringify({ c6, e: e1.slice(0, 3) }));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
