// FE-10 · §tsLostPart and §cotPart on the Travel Summary adapters:
//   · only some guests did not travel: section 02 speaks of those guests, "full charge" asks for an amount starting from the server's noshow_suggestion
//     and sends it (PUT noshow-charges, decision full + amount);
//   · "could not collect" may be partial: the box is what was collected (deduct), the rest is not collected (PUT cot-decisions, mode nocol + deduct).
//   node --test test/unit/ops-travelsum-partial.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { load, bk, SUMMARY, DATE, section } from './travelsum-harness.mjs';

const trip = (checkins) => ({ service_date: DATE, route_id: 'r_pw', pax_total: 3, pax: { ad_fr: 2, chd_th: 1 }, operations: { checkins } });
const bookings = [
  bk('b1', 'r_pw', { lead_pax: 'Ann', trips: [trip({ van: [{ checked_in_at: 't', actual_pax: 2, expected: 3, events: [{ type: 'no_show', pax: 1, chd: 1, reason_code: 'sick', note: '' }] }], pier: [] })] }),
  bk('b2', 'r_pw', { trips: [trip({ van: [], pier: [] })] }),
];
const summary = { ...SUMMARY, booked: 6, travelled: 5, no_show: 1, noshow: { cases: 1, pending: 1, decided: 0, postponed: 0, charged: 0 },
  collect_rows: [{ booking_id: 'b2', voucher_ref: 'V-b2', route_id: 'r_pw', target: 1700, paid: 1000, due: 0, cot: 1700 }],
  rows: [{ booking_id: 'b1', route_id: 'r_pw', booked: 3, travelled: 2, no_show: 1, issue: true, decided: false, flags: { pend: true, due: false, cot: false },
    pax_split: { ad: { booked: 2, left: 2 }, chd: { booked: 1, left: 0 }, inf: { booked: 0, left: 0 }, foc: { booked: 0, left: 0 } } }] };
const AFTER = { rows: [
  { booking_id: 'b1', version: 4, trip_amount: 4600, noshow_suggestion: { lost: 1, booked: 3, part_lost: true, full: 1533, half: 767 }, cot: { amount: 0, decision: null }, noshow: null },
  { booking_id: 'b2', version: 2, trip_amount: 1700, cot: { amount: 1700, suggested_mode: 'full', decision: { mode: 'nocol', deduct: 1000, payout: 0, kept: 0, ref: 'agent paid part', by: 'ops', at: '2026-10-14T09:00:00Z' } }, noshow: null },
] };

async function run(extra = {}) {
  const h = load({ ckReasonLabel: () => 'Sick', tsFullLost() { h.ctx.legacyCalled = true; }, ...extra }, { bookings, summary, after: AFTER });
  h.writes = [];
  h.ctx.laOps.bookingWrite = (m, p, b, body) => { h.writes.push({ m, p, version: b.opsVersion, body }); return Promise.resolve({ decision: {} }); };
  await h.ctx.window.renderTravelSum();
  return h;
}

test('partial loss: the buttons name the guests who did not go; the suggested charge and the 50% are the server\'s', async () => {
  const { host } = await run();
  const s02 = section(host.innerHTML, '02');
  assert.match(s02, /เก็บเต็ม · 1 CHD/);
  assert.match(s02, /50% · ฿767/);
  assert.match(s02, /ไม่ชาร์จ · 1 CHD/);
  assert.match(s02, /ตัดสินเฉพาะ<b>คนที่ไม่ได้ไป 1 CHD<\/b> &middot; อีก <b>2 AD<\/b> ที่เดินทางจ่ายตามปกติ/);
  assert.match(s02, /tsFullLost\('b1','2026-10-14',1533\)/);
});

test('full charge for the guests who did not travel: the prompt starts from the suggestion and the amount is sent', async () => {
  let asked = '';
  const h = await run({ prompt: (m, d) => { asked = d; return '1,600'; } });
  await h.ctx.tsFullLost('b1', DATE, 999);
  assert.equal(asked, '1533', 'the server\'s noshow_suggestion.full, not the page\'s estimate');
  assert.deepEqual(JSON.parse(JSON.stringify(h.writes)), [{ m: 'PUT', p: '/v1/bookings/b1/noshow-charges/' + DATE, version: 4, body: { decision: 'full', note: null, amount: 1600 } }]);
  await h.ctx.tsPick('b1', DATE, 'full', 4600);
  assert.equal(h.writes[1].body.amount, undefined, 'the plain full button still sends no amount: the server charges its own suggestion');
});

test('could not collect, partly: the collected part is an input, the rest is shown as not collected', async () => {
  const { host } = await run();
  const row = section(host.innerHTML, '03').split('data-ops-ts-collect="b2"')[1].split('</tr>')[0];
  assert.match(row, /id="ts-cotd-b2"[^>]*value="1000"/);
  assert.match(row, /เก็บไม่ได้<\/span><b[^>]*>฿700<\/b>/);
  assert.match(row, /หักบิล ฿1,000<\/b> &middot; <b[^>]*>&#10007; เก็บไม่ได้ ฿700/);
  assert.match(row, /ts-chip r">เก็บไม่ได้ ฿700/);
});

test('editing the collected part sends mode nocol with deduct only', async () => {
  const h = await run();
  h.ctx.document.getElementById = (id) => (id === 'ts-cotd-b2' ? { value: '1,200' } : id === 'travelsum-host' ? h.host : null);
  await h.ctx.laOps.travelRows.cotAmt('b2');
  assert.deepEqual(JSON.parse(JSON.stringify(h.writes.map((w) => [w.m, w.p, w.version, w.body]))), [['PUT', '/v1/bookings/b2/cot-decisions/' + DATE, 2, { mode: 'nocol', deduct: 1200 }]]);
});
