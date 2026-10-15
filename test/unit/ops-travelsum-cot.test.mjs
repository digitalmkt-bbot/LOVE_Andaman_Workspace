// §tsCot · Travel Summary cash-on-tour decisions (section 03, legacy tsCotCell): the "not collected"
// reason is pre-filled from the structured check-in events of the server booking, never from free-text
// notes; every decision is a server write with the booking's version.
//   node --test test/unit/ops-travelsum-cot.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { load, bk, SUMMARY, DATE, section } from './travelsum-harness.mjs';

const ev = (type, pax, code, note, undone = null) => ({ type, pax, reason_code: code, note, undone });
const trip = (checkins) => ({ service_date: DATE, route_id: 'r_pw', pax_total: 3, operations: { checkins } });
const bookings = [
  bk('b1', 'r_pw', { trips: [trip({ van: [{ actual_pax: 0, events: [ev('no_show', 2, 'sick', 'called at 7am'), ev('no_show', 1, 'x', 'undone one', { why: 'mistake' })] }], pier: [{ actual_pax: 0, events: [ev('cxl', 1, '', '')] }] })] }),
  bk('b2', 'r_pw', { trips: [trip({ van: [{ actual_pax: 0, events: [] }], pier: [] })] }),
  bk('b3', 'r_pw', { trips: [trip({ van: [], pier: [] })] }),
  bk('b6', 'r_pw', { trips: [trip({ van: [], pier: [] })] }),
];
const summary = { ...SUMMARY, collect_rows: [
  // b1: nobody travelled, nothing paid: the server does not count it (§tsCxlNoCount) and "not collected" is suggested.
  { booking_id: 'b1', voucher_ref: 'V-b1', route_id: 'r_pw', target: 800, paid: 0, due: 800, cot: 800, not_counted: 'no_show' },
  { booking_id: 'b2', voucher_ref: 'V-b2', route_id: 'r_pw', target: 500, paid: 0, due: 500, cot: 500 },
  { booking_id: 'b3', voucher_ref: 'V-b3', route_id: 'r_pw', target: 300, paid: 300, due: 0, cot: 0 },
  { booking_id: 'b6', voucher_ref: 'V-b6', route_id: 'r_pw', target: 700, paid: 0, due: 700, cot: 700 },
] };
const AFTER = { rows: [
  { booking_id: 'b1', version: 7, cot: { amount: 800, suggested_mode: 'full', decision: null } },
  { booking_id: 'b2', version: 3, cot: { amount: 500, suggested_mode: 'none', decision: { mode: 'nocol', deduct: 0, payout: 0, ref: 'saved reason', by: 'ops1', at: '2026-10-14T09:00:00Z' } } },
  { booking_id: 'b6', version: 2, cot: { amount: 700, suggested_mode: 'full', decision: { mode: 'part', deduct: 300, payout: 200, kept: 200, ref: null } } },
] };
const ckReasonLabel = (c) => ({ sick: 'Sick' })[c] || '';

async function run(extra = {}) {
  const h = load({ ckReasonLabel, ...extra }, { bookings, summary, after: AFTER });
  h.writes = [];
  h.ctx.laOps.bookingWrite = (m, p, b, body) => { h.writes.push({ m, p, version: b.opsVersion, body }); return Promise.resolve({ decision: {} }); };
  await h.ctx.window.renderTravelSum();
  return h;
}
const input = (html, id) => new RegExp('id="ts-cotr-' + id + '"[^>]*value="([^"]*)"').exec(html)[1];
const rowOf = (html, id) => section(html, '03').split('data-ops-ts-collect="' + id + '"')[1].split('</tr>')[0];

test('only bookings with cash on tour get decision buttons; the server suggestion is marked', async () => {
  const { host } = await run();
  assert.match(rowOf(host.innerHTML, 'b1'), /class="ts-db sug nocol" data-ops-ts-cotmode="nocol"/, 'nobody travelled: "not collected" is suggested');
  assert.match(rowOf(host.innerHTML, 'b1'), /ลูกค้าไม่ได้เดินทาง/);
  assert.doesNotMatch(rowOf(host.innerHTML, 'b3'), /data-ops-ts-cotmode/);
  assert.match(rowOf(host.innerHTML, 'b2'), /class="ts-db pick nocol"/, 'the saved decision is the picked one');
});

test('the reason is pre-filled from live check-in events: type, pax, reason label, note', async () => {
  const { host } = await run();
  assert.equal(input(host.innerHTML, 'b1'), 'No-show 2 pax · Sick · called at 7am · Cancelled on site 1 pax', 'the undone event is not used');
});

test('an already saved not-collected reason is shown as it is, not overwritten by the suggestion', async () => {
  const { host } = await run();
  assert.equal(input(host.innerHTML, 'b2'), 'saved reason');
});

test('Not collected writes mode nocol with the typed reason and the booking version', async () => {
  const h = await run();
  h.ctx.document.getElementById = ((orig) => (id) => (id === 'ts-cotr-b1' ? { value: ' edited reason ' } : orig(id)))(h.ctx.document.getElementById);
  await h.ctx.laOps.travelRows.cotPick('b1', 'nocol');
  assert.deepEqual(JSON.parse(JSON.stringify(h.writes)), [{ m: 'PUT', p: '/v1/bookings/b1/cot-decisions/' + DATE, version: 7, body: { mode: 'nocol', ref: 'edited reason' } }]);
});

test('Keep all sends only the mode', async () => {
  const h = await run();
  await h.ctx.laOps.travelRows.cotPick('b1', 'full');
  assert.deepEqual(JSON.parse(JSON.stringify(h.writes[0].body)), { mode: 'full' });
});

test('a not-collected decision with no reason is refused before any request', async () => {
  const h = await run();
  const fails = []; h.ctx.laOps.fail = (t) => fails.push(t);
  h.ctx.document.getElementById = (id) => (id === 'ts-cotr-b1' ? { value: '   ' } : id === 'travelsum-host' ? h.host : null);
  await h.ctx.laOps.travelRows.cotPick('b1', 'nocol');
  assert.equal(h.writes.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(fails)), ['Cash on tour not saved']);
});

test('with no reason box on the row, Not collected asks for the reason (cancel = no write)', async () => {
  const asked = [];
  const h = await run({ prompt: (q, d) => { asked.push(d); return asked.length === 1 ? null : 'boat full'; } });
  h.ctx.document.getElementById = (id) => (id === 'travelsum-host' ? h.host : null);
  await h.ctx.laOps.travelRows.cotPick('b6', 'nocol');
  assert.equal(h.writes.length, 0, 'cancelled prompt writes nothing');
  h.ctx.confirm = () => true;
  await h.ctx.laOps.travelRows.cotPick('b6', 'nocol');
  assert.deepEqual(JSON.parse(JSON.stringify(h.writes[0].body)), { mode: 'nocol', ref: 'boat full' });
});

test('a part decision shows its split inputs; the split is sent as whole baht with mode part', async () => {
  const h = await run();
  const row = rowOf(h.host.innerHTML, 'b6');
  assert.match(row, /id="ts-cotd-b6" class="ts-cotamt" value="300"/);
  assert.match(row, /id="ts-cotp-b6" class="ts-cotamt" value="200"/);
  h.ctx.document.getElementById = (id) => ({ 'ts-cotd-b6': { value: '450' }, 'ts-cotp-b6': { value: '฿250.4' } })[id] || (id === 'travelsum-host' ? h.host : null);
  await h.ctx.laOps.travelRows.cotAmt('b6');
  assert.deepEqual(JSON.parse(JSON.stringify(h.writes[0])), { m: 'PUT', p: '/v1/bookings/b6/cot-decisions/' + DATE, version: 2, body: { mode: 'part', deduct: 450, payout: 250 } });
});

test('clear deletes the decision with the booking version', async () => {
  const h = await run();
  await h.ctx.laOps.travelRows.cotClear('b2');
  assert.deepEqual(JSON.parse(JSON.stringify(h.writes[0])), { m: 'DELETE', p: '/v1/bookings/b2/cot-decisions/' + DATE, version: 3 });
});

test('after a stale_version refusal the next save re-reads after-trip and sends the fresh version', async () => {
  const h = await run();
  const reads = []; let version = 7;
  const get = h.ctx.laOps.get;
  h.ctx.laOps.get = (p, q) => { if (p === '/v1/after-trip') { reads.push(1); return Promise.resolve({ rows: [{ booking_id: 'b1', version, cot: { amount: 800, suggested_mode: 'full', decision: null } }] }); } return get(p, q); };
  h.ctx.laOps.bookingWrite = (m, p, b, body) => { h.writes.push({ version: b.opsVersion }); if (h.writes.length === 1) { const e = new Error('stale'); e.code = 'stale_version'; return Promise.reject(e); } return Promise.resolve({}); };
  version = 9;                                              // the server moved on; the page still caches 7
  await h.ctx.laOps.travelRows.cotPick('b1', 'full');       // 1st click: sends the cached 7, refused
  await new Promise((r) => setTimeout(r, 20));              // the re-render re-reads
  await h.ctx.laOps.travelRows.cotPick('b1', 'full');
  assert.deepEqual(JSON.parse(JSON.stringify(h.writes.map((w) => w.version))), [7, 9]);
  assert.ok(reads.length >= 1, 'after-trip was read again');
});
