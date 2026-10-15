// §tsPacks · Travel Summary reference pack + slip pack, from server rows. On the sheet they are
// two actions beside print (legacy printed them behind the summary), not lists on the page.
//   node --test test/unit/ops-travelsum-packs.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { load, bk, SUMMARY, DATE } from './travelsum-harness.mjs';

const file = (id, name) => ({ id, name, mime: 'image/jpeg', size: 1 });
const bookings = [
  bk('b1', 'r_pw', { agent_id: 'ag1', attachments: [file('att1', 'voucher-b1.jpg'), file('att2', 'passport.jpg')] }),
  bk('b2', 'r_pw2', { agent_id: undefined, attachments: [] }),                       // walk-in without documents: not in the reference pack
  bk('b3', 'r_tl', { agent_id: 'ag1', attachments: [], slips: [{ id: 's1', attachment_id: 'att9' }] }),
];
const summary = {
  ...SUMMARY,
  collect_rows: [
    { booking_id: 'b1', voucher_ref: 'V-b1', route_id: 'r_pw', target: 1000, paid: 400, due: 600, cot: 0, no_slip: 1, sales: { count: 0 } },
    { booking_id: 'b2', voucher_ref: 'V-b2', route_id: 'r_pw2', target: 2000, paid: 0, due: 2000, cot: 0, no_slip: 0, sales: { count: 0 } },
    { booking_id: 'b3', voucher_ref: 'V-b3', route_id: 'r_tl', target: 3000, paid: 0, due: 3000, cot: 0, no_slip: 0, sales: { count: 1 } },
  ],
};
const PIER_MONEY = {
  b1: { payments: [{ method: 'transfer', amount: 400, fee: 0, slips: [file('att5', 'slip-b1.jpg')] }], tour_sales: [] },
  b3: { payments: [], tour_sales: [{ method: 'card', total: 900, fee: 27, service: 'Snorkel', slips: [file('att6', 'card-b3.jpg')] }] },
};
const sbGetAgent = (id) => (id === 'ag1' ? { id, name: 'Acme', vatMode: 'none' } : null);
async function run(extra = {}) {
  const h = load({ sbGetAgent, ...extra }, { bookings, summary });
  const get = h.ctx.laOps.get;
  h.ctx.laOps.get = (p, q) => {
    const m = /^\/v1\/bookings\/([^/]+)\/pier-money$/.exec(p);
    if (m) { h.calls.push([p, q]); return Promise.resolve(PIER_MONEY[m[1]] || { payments: [], tour_sales: [] }); }
    return get(p, q);
  };
  await h.ctx.window.renderTravelSum();
  return h;
}
const btn = (html, k) => new RegExp('data-ops-ts-' + k + '="1"[^>]*>([^<]*)<b>(\\d+)</b>').exec(html);

test('reference pack lists bookings with documents or an agent; the bar shows its file count', async () => {
  const { host, ctx } = await run();
  assert.deepEqual(btn(host.innerHTML, 'refpack').slice(1), ['เอกสาร ', '2']);
  assert.match(host.innerHTML, /data-ops-ts-refpack="1"[^>]*title="[^"]*2 ใบ"/, 'two bookings: b1 (files) and b3 (agent)');
  assert.doesNotMatch(host.innerHTML, /voucher-b1\.jpg/, 'the file list is not drawn on the page');
  assert.equal(typeof ctx.laOps.travelRows.printPack, 'function');
});

test('the reference pack follows the pier scope', async () => {
  const { host } = await run({ _tsPier: 'tublamu' });
  assert.deepEqual(btn(host.innerHTML, 'refpack').slice(1), ['เอกสาร ', '0']);
  assert.match(host.innerHTML, /data-ops-ts-refpack="1"[^>]*title="[^"]*1 ใบ"/);
});

test('slip pack asks before reading, then counts every slip file of the selection', async () => {
  const h = await run();
  assert.deepEqual(btn(h.host.innerHTML, 'slippack').slice(1), ['โหลดสลิป ', '2'], 'b1 paid at the pier, b3 sold on tour');
  assert.equal(h.calls.filter(([p]) => p.endsWith('/pier-money')).length, 0, 'nothing is read until asked');
  await h.ctx.laOps.travelRows.slipsLoad();
  const reads = h.calls.filter(([p]) => p.endsWith('/pier-money')).map(([p, q]) => p + '?' + q.date).sort();
  assert.deepEqual(reads, ['/v1/bookings/b1/pier-money?' + DATE, '/v1/bookings/b3/pier-money?' + DATE]);
  assert.deepEqual(btn(h.host.innerHTML, 'slippack').slice(1), ['สลิป ', '3'], 'transfer slip, card slip, booking slip');
});

test('a booking paid without a slip is named on the slip action, from the server no_slip', async () => {
  const h = await run();
  await h.ctx.laOps.travelRows.slipsLoad();
  assert.match(h.host.innerHTML, /data-ops-ts-slippack="1"[^>]*title="[^"]*1 ใบยังไม่มีสลิป"/);
});

test('the legacy print does not append packs built from browser bookings in ops mode', async () => {
  const { ctx } = await run();
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.tsRefPackList('2026-10-14'))), []);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.tsSlipPackList('2026-10-14'))), []);
  ctx.laOps.enabled = () => false;
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.tsRefPackList('2026-10-14'))), ['legacy']);
});
