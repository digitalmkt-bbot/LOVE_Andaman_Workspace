import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

// §opsCxlTrip (lk-inbox §btCxlTrip / §pckCxlTrip): a trip closed from the Cancellations tab. The server leaves its bookings out of By trip and
// Pier Check-in and counts them apart; the browser reads those fields and keeps legacy's own test only while the server has not answered.
const DATE = '2476-01-01';

test('By trip: a cancelled route and the Notice line come from the server; no answer, or an answer without the fields, gives null', () => {
  const r = runtime({ files: ['72-ops-by-trip.js'] });
  const route = r.ctx.laOpsByTripCxlRoute, day = r.ctx.laOpsByTripCxlDay;
  const srv = {
    routes: [
      { route_id: 'r1', cancelled: { closure_id: 'c1', reason: 'minpax', note: 'low' }, cancelled_trip: { bookings: 3, pax: { ad: 7, chd: 2, inf: 0, foc: 0, total: 9 }, pending: 2 } },
      { route_id: 'r2', cancelled: null, cancelled_trip: { bookings: 0, pax: { ad: 0, chd: 0, inf: 0, foc: 0, total: 0 }, pending: 0 } },
    ],
    cancelled_trip: { bookings: 3, pax: 9, pending: 2, by_route: [{ route_id: 'r1', pax: 9 }] },
  };
  assert.deepEqual(plain(route(srv, 'r1')), { reason: 'minpax', note: 'low', bookings: 3, pending: 2, pax: 9, bd: { ad: 7, chd: 2, inf: 0, foc: 0 } });
  assert.equal(route(srv, 'r2'), false, 'the trip runs');
  assert.equal(route(srv, 'r9'), false, 'a route the server does not list is not cancelled (it lists every closed one)');
  assert.deepEqual(plain(day(srv)), { bookings: 3, pax: 9, pending: 2, by_route: [{ route_id: 'r1', pax: 9 }] });
  assert.equal(route(null, 'r1'), null, 'no answer: legacy decides');
  assert.equal(day(null), null);
  const old = { routes: [{ route_id: 'r1' }] };
  assert.equal(route(old, 'r1'), null, 'an older server without the fields: legacy decides');
  assert.equal(day(old), null);
});

const SHEET = {
  rows: [{ booking_id: 'b5', route_id: 'r2', split: null, booked: 1, expected: 1, stage: 'wait', strand: null, money: {} }],
  totals: {}, counts: {},
  programmes: [{ family_id: 'fam', pax: 1, booked: 1, rows: 1, arr: 0, clr: 0, brd: 0, due: 0, status: { code: 'not_arrived', missing: 1 }, variants: [
    { route_id: 'r1', pax: 0, booked: 0, rows: 0, arr: 0, clr: 0, brd: 0, due: 0, zones: {}, status: { code: 'no_booking', missing: 0 }, cancelled: { closure_id: 'c1', reason: 'boat', note: null }, cancelled_pax: 11 },
    { route_id: 'r2', pax: 1, booked: 1, rows: 1, arr: 0, clr: 0, brd: 0, due: 0, zones: {}, status: { code: 'not_arrived', missing: 1 }, cancelled: null, cancelled_pax: 0 },
  ] }],
  cancelled_trip: { bookings: 3, pax: 9, pending: 2 },
  cancelled_trips: [{ route_id: 'r1', closure_id: 'c1', reason: 'boat', note: null }],
};
const pierRuntime = (sheet) => runtime({
  files: ['74-ops-pier-service.js', '83-ops-pier-day.js'],
  handlers: { 'GET /v1/pier-checkin': { body: sheet } },
  globals: { ROUTES: [], _BKV2_FAMILIES: [{ id: 'fam', name: 'Fam' }], TCX_R: { weather: { th: 'สภาพอากาศ' }, boat: { th: 'ไม่มีเรือ' } } },
  pre: `var _pckDate = '${DATE}', _pckPier = null, _pckLand = false;
    function ckTripWx(rid, date){ return rid === 'legacy'; }
    function ckTripWxLbl(rid, date){ return 'legacy label'; }
    function pckProgData(date){ return 'legacy'; }
    function bookingV2RouteFamily(id){ return { id: 'fam', name: 'Fam' }; }
    function pckDepOf(id){ return id === 'r1' ? '05:30' : '08:30'; }
    function pckVarLbl(f, id){ return id; }`,
});

test('Pier check-in: the closed trips, their reason and the grey chip are the server\'s; before the answer and after a weather write, legacy answers', async () => {
  const r = pierRuntime(SHEET);
  assert.equal(r.ctx.ckTripWx('legacy', DATE), true, 'no answer yet: legacy');
  assert.equal(r.ctx.laOpsPierCxlTrip(DATE, null), null);
  r.O.pierService.ensure(DATE);
  await r.settle();
  assert.equal(r.ctx.ckTripWx('r1', DATE), true);
  assert.equal(r.ctx.ckTripWx('r2', DATE), false);
  assert.equal(r.ctx.ckTripWx('legacy', DATE), false, 'the server\'s list decides, not SB_WEATHER_CLOSURES');
  assert.equal(r.ctx.ckTripWxLbl('r1', DATE), 'ยกเลิก · ไม่มีเรือ');
  assert.deepEqual(plain(r.ctx.laOpsPierCxlTrip(DATE, null)), { bookings: 3, pax: 9, pending: 2 });
  const prog = r.ctx.pckProgData(DATE);
  assert.deepEqual([prog[0].v.r1.wx, prog[0].v.r1.cxlPax, prog[0].v.r1.pax, prog[0].v.r2.wx], [1, 11, 0, undefined], 'pckProgList draws the r1 variant as cancelled with its booked heads');
  // closing or reopening a trip makes the held answer stale: legacy's own test until the next one lands
  r.O.wrote('weather');
  assert.equal(r.ctx.ckTripWx('legacy', DATE), true);
  assert.equal(r.ctx.laOpsPierCxlTrip(DATE, null), null);
});

test('Pier check-in: an older server without cancelled_trips leaves legacy in charge', async () => {
  const { cancelled_trip: _c, cancelled_trips: _l, ...old } = SHEET;
  const r = pierRuntime(old);
  r.O.pierService.ensure(DATE);
  await r.settle();
  assert.equal(r.ctx.ckTripWx('legacy', DATE), true);
  assert.equal(r.ctx.ckTripWxLbl('r1', DATE), 'legacy label');
  assert.equal(r.ctx.laOpsPierCxlTrip(DATE, null), null);
});
