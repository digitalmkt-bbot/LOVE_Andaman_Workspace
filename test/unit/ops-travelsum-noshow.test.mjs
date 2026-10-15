// §tsNoshow · Travel Summary section 02 (ตัดสินค่าปรับ): the cases come from the server (its count,
// its decisions, the trip price) and the legacy buttons (tsPick / tsCustom / tsClear / tsPostpone) write
// the decision to PUT|DELETE /v1/bookings/:id/noshow-charges/:date with the booking's version.
//   node --test test/unit/ops-travelsum-noshow.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { load, bk, SUMMARY, DATE, handed, section } from './travelsum-harness.mjs';

const trip = (checkins, pax = { ad_fr: 2, chd_th: 1 }) => ({ service_date: DATE, route_id: 'r_pw', pax_total: 3, pax, operations: { checkins } });
const bookings = [
  bk('b1', 'r_pw', { lead_pax: 'Ann', trips: [trip({ van: [{ checked_in_at: 't', actual_pax: 1, expected: 3, events: [{ type: 'no_show', pax: 2, ad: 2, reason_code: 'sick', note: 'fever' }] }], pier: [] })] }),
  bk('b2', 'r_pw', { trips: [trip({ van: [], pier: [] })] }),                         // decided earlier (postponed)
  bk('b3', 'r_tl', { trips: [{ ...trip({ van: [], pier: [] }), route_id: 'r_tl' }] }),  // travelled in full: not a case
];
const summary = { ...SUMMARY, booked: 9, travelled: 7, no_show: 2, noshow: { cases: 2, pending: 1, decided: 1, postponed: 1, charged: 0 }, collect_rows: [] };
const AFTER = { rows: [
  { booking_id: 'b1', version: 4, trip_amount: 4600, cot: { amount: 0, decision: null }, noshow: null },
  { booking_id: 'b2', version: 6, trip_amount: 3000, cot: { amount: 0, decision: null }, noshow: { decision: 'postpone', amount: 0, note: 'moved', by: 'ops1', at: '2026-10-14T08:00:00Z' } },
  { booking_id: 'b3', version: 1, trip_amount: 1000, cot: { amount: 0, decision: null }, noshow: null },
] };

async function run(extra = {}) {
  const h = load({ ckReasonLabel: (c) => ({ sick: 'Sick' })[c] || '', ...extra }, { bookings, summary, after: AFTER });
  h.writes = [];
  h.ctx.laOps.bookingWrite = (m, p, b, body) => { h.writes.push({ m, p, version: b.opsVersion, body }); return Promise.resolve({}); };
  await h.ctx.window.renderTravelSum();
  return h;
}

test('cases are the server-counted ones: pending first, each with the server trip price', async () => {
  const { host } = await run();
  const s02 = section(host.innerHTML, '02');
  assert.ok(s02.includes('V-b1') && s02.includes('V-b2'));
  assert.ok(!s02.includes('V-b3'), 'a booking that travelled in full is not a case');
  assert.ok(s02.indexOf('V-b1') < s02.indexOf('V-b2'), 'pending before decided (legacy order)');
  assert.match(s02, /data-ts02="pend">รอตัดสิน 1</);
  assert.match(s02, /เก็บเต็ม ฿4,600/, 'the full charge is the server trip price');
  assert.match(s02, /No-show 2 · 2 AD/);
  assert.match(s02, /Sick · fever/);
  assert.match(s02, /ts-chip p">เลื่อนวัน</, 'the saved decision shows');
  const H = handed(host.innerHTML, 'H');
  assert.equal(H.pend, 1); assert.equal(H.ns, 2, 'whole-day head counts are the server\'s');
});

test('a full charge is a PUT with the decision, the note and the booking version', async () => {
  const h = await run();
  h.ctx.document.getElementById = (id) => (id === 'ts-note-b1' ? { value: ' agent agreed ' } : id === 'travelsum-host' ? h.host : null);
  await h.ctx.tsPick('b1', DATE, 'full', 4600);
  assert.deepEqual(JSON.parse(JSON.stringify(h.writes)), [{ m: 'PUT', p: '/v1/bookings/b1/noshow-charges/' + DATE, version: 4, body: { decision: 'full', note: 'agent agreed' } }]);
  assert.equal(h.ctx.legacyCalled, undefined, 'nothing went to the local blob');
});

test('50% and a typed amount are partial charges with their amount', async () => {
  const h = await run({ prompt: () => '1,250' });
  await h.ctx.tsPick('b1', DATE, 'partial', 2300);
  await h.ctx.tsCustom('b1', DATE);
  assert.deepEqual(JSON.parse(JSON.stringify(h.writes.map((w) => w.body))), [{ decision: 'partial', note: null, amount: 2300 }, { decision: 'partial', note: null, amount: 1250 }]);
});

test('clear deletes the decision; postpone saves it and points to the booking page', async () => {
  const toasts = [];
  const h = await run();
  h.ctx.laOps.toast = (t) => toasts.push(t.title);
  await h.ctx.tsClear('b2', DATE);
  await h.ctx.tsPostpone('b1', DATE);
  assert.deepEqual(JSON.parse(JSON.stringify(h.writes.map((w) => [w.m, w.p, w.version]))), [
    ['DELETE', '/v1/bookings/b2/noshow-charges/' + DATE, 6], ['PUT', '/v1/bookings/b1/noshow-charges/' + DATE, 4]]);
  assert.equal(h.writes[1].body.decision, 'postpone');
  assert.deepEqual(toasts, ['Saved as postponed']);
});

test('a refused decision only toasts: nothing is redrawn from a guess', async () => {
  const h = await run();
  const fails = []; h.ctx.laOps.fail = (t, e) => fails.push(t + ' · ' + e.message);
  h.ctx.laOps.bookingWrite = () => Promise.reject(Object.assign(new Error('amount is required'), { code: 'bad_request' }));
  const before = h.host.innerHTML;
  await h.ctx.tsPick('b1', DATE, 'none', 0);
  assert.deepEqual(fails, ['No-show decision not saved · amount is required']);
  assert.equal(h.host.innerHTML, before);
});

test('with no cases on the server day, no booking is listed even if it has check-in records', async () => {
  const h = load({}, { bookings, summary: { ...summary, noshow: { cases: 0, pending: 0, decided: 0, postponed: 0, charged: 0 } }, after: AFTER });
  await h.ctx.window.renderTravelSum();
  assert.match(section(h.host.innerHTML, '02'), /ไม่มีเคสต้องตัดสิน/);
});
