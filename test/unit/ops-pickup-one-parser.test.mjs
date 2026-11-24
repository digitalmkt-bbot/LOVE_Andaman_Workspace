// §pickupOneParser (2026-11-24): the pickup text is read by one function, 00-ops-pickup.js. It used to be written twice,
// O.pickupWindow in 00-ops-core.js and pickupSplit in 40-ops-bookings.js, with the same shapes kept in step by hand.
// Also: the moved-away rows show the server's whole pickup (operation-backend migration 607, `pickup_text`).
//   node --test test/unit/ops-pickup-one-parser.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

const D = '2026-12-01';

test('the core and the bookings adapter read a pickup with the same one function', () => {
  const rt = runtime({ files: ['40-ops-bookings.js'] });
  const lib = rt.ctx.laOpsPickup;
  assert.equal(typeof lib.pickupWindow, 'function', '00-ops-pickup.js defines laOpsPickup');
  const seen = [];
  const real = lib.pickupWindow;
  lib.pickupWindow = (t) => { seen.push(String(t)); return real(t); };
  rt.O.pickupWindow('07:15-07:30');
  const body = rt.O.bookings.toServer({ id: 'B1', status: 'confirmed', passengers: [], trips: [{ routeId: 'r1', date: D, pickupTime: 'Before 08.30 at pier', pax: { ad_fr: 1 } }] }, true);
  assert.deepEqual(seen, ['07:15-07:30', 'Before 08.30 at pier'], 'both went through laOpsPickup.pickupWindow');
  const trip = plain(body.trips[0]);
  assert.deepEqual([trip.pickupTime ?? null, trip.pickupTimeEnd, trip.pickupAtPier], [null, '08:30', true]);
});

test('legacy\'s shapes and typing slips, as the server\'s importer reads them', () => {
  const rt = runtime();
  const w = (t) => plain(rt.O.pickupWindow(t));
  assert.deepEqual(['07.40 a.m..', '04:00 s.m.', '07:45+08:00', '07:15 - 07:30', '7.15–7.30', '12:30 a.m.', '1:30 p.m.'].map(w), [
    { pickupTime: '07:40' }, { pickupTime: '04:00' }, { pickupTime: '07:45', pickupTimeEnd: '08:00' }, { pickupTime: '07:15', pickupTimeEnd: '07:30' },
    { pickupTime: '07:15', pickupTimeEnd: '07:30' }, { pickupTime: '00:30' }, { pickupTime: '13:30' }]);
  assert.equal(rt.O.clock('07.30 a.m.'), '07:30');
  assert.equal(rt.O.pickupText(null, '08:30', true), 'Before 08:30 at pier');
});

test('a moved-away row shows the old departure\'s pickup whole (pickup_text), not the start only', async () => {
  const row = (o) => ({ booking_id: 'ob_1', trip_id: 't1', route_id: 'r1', zone: 'PK', pax: { ad: 2 }, why_text: 'เลื่อนไป 2 ธ.ค.', to_date: '2026-12-02', boat_id: 'b1', van_id: null, group_number: null, sequence: null, ...o });
  const rt = runtime({
    files: ['36-ops-van-strands.js'],
    pre: "var SB_BOOKINGS = [{ id: 'BK-1', opsId: 'ob_1', _fromOpsBackend: true, trips: [], passengers: [] }, { id: 'BK-2', opsId: 'ob_2', _fromOpsBackend: true, trips: [], passengers: [] }];",
    handlers: { 'GET /operations/van-strands': { body: { rows: [
      row({ pickup_time: '07:15', pickup_time_end: '07:30', pickup_at_pier: false, pickup_text: '07:15-07:30' }),
      row({ booking_id: 'ob_2', pickup_time: null, pickup_time_end: '08:30', pickup_at_pier: true, pickup_text: 'Before 08:30 at pier' }),
    ] } } },
  });
  await rt.O.vanStrands.load(D, true);
  const rows = rt.O.vanStrands.rows(D);
  assert.deepEqual(rows.map((r) => [r.t.pickupTime, r.O.pickupTimeFinal]), [['07:15-07:30', '07:15-07:30'], ['Before 08:30 at pier', 'Before 08:30 at pier']],
    'legacy ckStrandSnap kept O.pickupTimeFinal || t.pickupTime as this text');
});
