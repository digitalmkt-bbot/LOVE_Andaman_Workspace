// §tsSlipAdd / §cotSlip · attach a slip from the Travel Summary (pier payments, on-tour sales, COT decisions).
// The file goes up through pckSlipUpload, then is named to the server; a refusal removes the upload again.
//   node --test test/unit/ops-travelsum-slips.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { load, bk, SUMMARY, DATE, section } from './travelsum-harness.mjs';

const bookings = [bk('b1', 'r_pw'), bk('b3', 'r_tl')];
const summary = { ...SUMMARY, collect_rows: [
  { booking_id: 'b1', voucher_ref: 'V-b1', route_id: 'r_pw', target: 1000, paid: 1000, due: 0, cot: 500, received: { transfer: 1000 } },
  { booking_id: 'b3', voucher_ref: 'V-b3', route_id: 'r_tl', target: 300, paid: 300, due: 0, cot: 0, received: { cash: 300 } },
] };
const AFTER = { rows: [
  { booking_id: 'b1', version: 9, cot: { amount: 500, suggested_mode: 'full', decision: { mode: 'part', deduct: 300, payout: 100, ref: 'KBank', slips: [{ id: 'old1', name: 'o.jpg', mime: 'image/jpeg', size: 1 }] } } },
  { booking_id: 'b3', version: 2, cot: { amount: 0, decision: null } },
] };
const PMROW = { booking_id: 'b1', version: 12,
  payments: [
    { id: 'pp1', service_date: DATE, method: 'transfer', amount: 1000, slips: [] },
    { id: 'pp2', service_date: DATE, method: 'cash', amount: 50, slips: [] },
    { id: 'pp3', service_date: DATE, method: 'card', amount: 70, slips: [{ id: 's9', name: 'c.jpg', mime: 'image/jpeg' }] },
  ],
  tour_sales: [{ id: 'ts1', method: 'transfer', settle: 'done', total: 400, slips: [{ id: 'x1' }] }, { id: 'ts2', method: 'cot', settle: 'pending', total: 90, slips: [] }] };

async function run() {
  const removed = [], uploads = [], writes = [], loads = [];
  const h = load({
    pckSlipUpload: (f, id, cb) => { uploads.push([f.name, id]); return cb({ id: 'new1', name: f.name, mime: 'image/jpeg', size: 5 }); },
    laOpsAttachments: { remove: (id) => { removed.push(id); return Promise.resolve(); } },
    tsSlipPick() { h.ctx.legacy = true; }, tsCotSlipPick() { h.ctx.legacy = true; }, tsCotSlipDrop() { h.ctx.legacy = true; },
    laSlipClickAttr: () => 'data-slip="1"',
    alert: (m) => writes.push({ alert: m }),
  }, { bookings, summary, after: AFTER });
  h.ctx.laOpsPierMoney = {
    rowById: (id) => (id === 'b1' ? PMROW : null),
    sigOf: () => 'sig', loadDay: (d, force) => { loads.push([d, !!force]); return Promise.resolve({}); },
  };
  h.ctx.laOps.bookingWrite = (m, p, b, body) => { writes.push({ m, p, version: b.opsVersion, body: JSON.parse(JSON.stringify(body)) }); return h.fail ? Promise.reject(new Error('refused')) : Promise.resolve({}); };
  h.ctx.laOps.fail = (t) => writes.push({ fail: t });
  await h.ctx.window.renderTravelSum();
  // re-load the wrapper chain: tsSlipPick etc. were stubbed before the view wrapped them
  Object.assign(h, { removed, uploads, writes, loads });
  return h;
}
const file = () => ({ files: [{ name: 'slip.jpg' }], value: 'x' });
const rowOf = (html, id) => section(html, '03').split('data-ops-ts-collect="' + id + '"')[1].split('</tr>')[0];

test('the money table offers a slip button per non-cash payment and per collected non-cash sale, not for cash or uncollected', async () => {
  const h = await run();
  const r = rowOf(h.host.innerHTML, 'b1');
  assert.match(r, /data-ops-ts-payslip="pp1"[^>]*>.*tsSlipPick\('p','b1','pp1',this\)/s);
  assert.doesNotMatch(r, /data-ops-ts-payslip="pp2"/, 'cash needs no slip');
  assert.match(r, /data-ops-ts-payslip="pp3"[^>]*><span class="ts-slipok"/, 'a payment with a slip shows its count');
  assert.match(r, /data-ops-ts-saleslip="ts1"/);
  assert.doesNotMatch(r, /data-ops-ts-saleslip="ts2"/, 'an uncollected sale has no slip yet');
  assert.doesNotMatch(rowOf(h.host.innerHTML, 'b3'), /data-ops-ts-payslip/);
});

test('a pier payment slip: upload, then POST .../pier-payments/:pid/slips with the booking version; the day is read again', async () => {
  const h = await run(); const inp = file();
  await h.ctx.tsSlipPick('p', 'b1', 'pp1', inp);
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(h.uploads, [['slip.jpg', 'b1']]);
  assert.deepEqual(h.writes, [{ m: 'POST', p: '/v1/bookings/b1/pier-payments/pp1/slips', version: 12, body: { slip_ids: ['new1'] } }]);
  assert.ok(h.loads.some((l) => l[1] === true), 'pier money re-read');
  assert.equal(inp.value, '', 'the file input is cleared');
});

test('an on-tour sale slip: PATCH tour-sales/:sid with the old slips plus the new one', async () => {
  const h = await run();
  await h.ctx.tsSlipPick('x', 'b1', 'ts1', file());
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(h.writes, [{ m: 'PATCH', p: '/v1/bookings/b1/tour-sales/ts1', version: 12, body: { slip_ids: ['x1', 'new1'] } }]);
});

test('a refused link shows the server message and removes the uploaded file', async () => {
  const h = await run(); h.fail = true;
  await h.ctx.tsSlipPick('p', 'b1', 'pp1', file());
  await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
  assert.deepEqual(h.writes.map((w) => w.fail).filter(Boolean), ['Slip was not attached']);
  assert.deepEqual(h.removed, ['new1']);
});

test('COT: the decision row has slip controls; attaching PUTs the decision as it stands plus the old and new slip ids', async () => {
  const h = await run();
  assert.match(rowOf(h.host.innerHTML, 'b1'), /data-ops-ts-cotslips="1"[\s\S]*tsCotSlipPick\('b1','2026-10-14',this\)/);
  await h.ctx.tsCotSlipPick('b1', DATE, file());
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(h.writes, [{ m: 'PUT', p: '/v1/bookings/b1/cot-decisions/' + DATE, version: 9,
    body: { mode: 'part', slip_ids: ['old1', 'new1'], ref: 'KBank', deduct: 300, payout: 100 } }]);
});

test('COT: no decision yet means no upload and the legacy message', async () => {
  const h = await run();
  await h.ctx.tsCotSlipPick('b3', DATE, file());
  assert.equal(h.uploads.length, 0);
  assert.deepEqual(h.writes, [{ alert: 'Pick how this COT is handled first, then attach the slip.' }]);
});

test('COT: the x removes the slips from the decision (empty slip_ids), after confirm', async () => {
  const h = await run();
  h.ctx.confirm = () => true;
  await h.ctx.tsCotSlipDrop('b1', DATE);
  assert.equal(h.writes[0].body.slip_ids.length, 0);
  assert.equal(h.writes[0].body.mode, 'part');
});
