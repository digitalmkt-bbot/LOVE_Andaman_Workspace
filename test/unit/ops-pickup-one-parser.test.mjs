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

// §pickupTyped2 (2026-11-25, UI parity gap 3): legacy prints the pickup as typed (05:20 a.m., 08.20); the server keeps that text
// (operation-backend migration 609: trip pickup_text, operations pickup_final_text) and the screens print it.
test('the booking read prints the typed text the server kept; a save sends what was typed', () => {
  const rt = runtime({ files: ['40-ops-bookings.js'] });
  const read = rt.O.bookings.fromServer({ id: 'ob_9', code: 'BK-9', status: 'confirmed', passengers: [], trips: [
    { id: 't1', route_id: 'r1', service_date: D, pax: { ad_fr: 1 }, pickup_time: '05:20', pickup_text: '05:20 a.m.',
      operations: { pickup_time_final: '06:10', pickup_time_final_end: null, pickup_final_at_pier: false, pickup_final_text: '06.10', van_parts: [] } },
    { id: 't2', route_id: 'r1', service_date: '2026-12-02', pax: { ad_fr: 1 }, pickup_time: '07:15', pickup_time_end: '07:30',
      operations: { pickup_time_final: null, pickup_time_final_end: null, pickup_final_at_pier: false, pickup_final_text: null, van_parts: [] } },
  ] });
  const trips = plain(read.trips);
  assert.deepEqual(trips.map((t) => t.pickupTime), ['05:20 a.m.', '07:15-07:30'], 'typed when kept, else the window joined');
  assert.deepEqual([plain(read.ops).pickupTimeFinal, trips[1].ops.pickupTimeFinal], ['06.10', ''], 'the final pickup as typed (legacy keeps the first day on bk.ops); none set: empty');
  const body = rt.O.bookings.toServer({ id: 'B1', status: 'confirmed', passengers: [], trips: [{ routeId: 'r1', date: D, pickupTime: '05:20 a.m.', pax: { ad_fr: 1 } }, { routeId: 'r1', date: D, pickupTime: '', pax: { ad_fr: 1 } }] }, true);
  const sent = plain(body.trips);
  assert.deepEqual([sent[0].pickupTime, sent[0].pickup_text, sent[1].pickup_text], ['05:20', '05:20 a.m.', null], 'the window and the text; an empty box clears it');
});

// §pickupTyped3 (2026-11-25): an alternate pickup's own time prints as typed too (operation-backend migration 615, van part pick_text).
test('an alternate-pickup part prints its own time as typed, else its window joined', () => {
  const rt = runtime({ files: ['40-ops-bookings.js'] });
  const part = (idx, alt) => ({ idx, source: 'alt_pickup', ad: 1, chd: 0, inf: 0, foc: 0, group: null, sequence: null, return_van_id: null,
    alt: { pick_area_id: 'pa_kata', pick_hotel: 'Kata Palm', pick_zone: 'PK', drop_area_id: null, drop_hotel: null, drop_zone: null, alt_who: 'Mr B', ...alt } });
  const read = rt.O.bookings.fromServer({ id: 'ob_8', code: 'BK-8', status: 'confirmed', passengers: [], trips: [
    { id: 't1', route_id: 'r1', service_date: D, pax: { ad_fr: 3 }, pickup_time: '07:00',
      operations: { pickup_time_final: null, pickup_time_final_end: null, pickup_final_at_pier: false, pickup_final_text: null, van_parts: [
        { idx: 0, source: 'main', ad: 1, chd: 0, inf: 0, foc: 0, group: null, sequence: null, return_van_id: null, alt: null },
        part(1, { pick_time: '08:00', pick_time_end: null, pick_at_pier: false, pick_text: '08.00 a.m.' }),
        part(2, { pick_time: '07:15', pick_time_end: '07:30', pick_at_pier: false, pick_text: null }),
      ] } },
  ] });
  const splits = plain(read.ops).vanSplits;
  assert.deepEqual(splits.slice(1).map((s) => s.pickTime), ['08.00 a.m.', '07:15-07:30']);
});
