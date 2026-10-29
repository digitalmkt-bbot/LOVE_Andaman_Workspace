import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

// §btLost3 (lk-inbox 2026-10-29): By trip's programme variant shows a red "CXL n", the heads marked No-show / on-site CXL at check-in.
// The server counts it per route (routes[].checkin_lost); the browser reads it and keeps lk's ckLostByType count only while the
// server has not answered, or answers without the field.
test('By trip: the CXL n figure per route is the server\'s; no answer, or an answer without the field, gives null', () => {
  const r = runtime({ files: ['72-ops-by-trip.js'] });
  const lost = r.ctx.laOpsByTripLost;
  const srv = {
    routes: [
      { route_id: 'r1', pax: { total: 10 }, checkin_lost: { ad: 2, chd: 1, inf: 0, foc: 0, total: 3, bookings: 2, booked: 11 } },
      { route_id: 'r2', pax: { total: 2 }, checkin_lost: { ad: 0, chd: 0, inf: 0, foc: 0, total: 0, bookings: 0, booked: 2 } },
    ],
  };
  assert.deepEqual(plain(lost(srv, 'r1')), { total: 3, booked: 11, bookings: 2, bd: { ad: 2, chd: 1, inf: 0, foc: 0 } });
  assert.deepEqual(plain(lost(srv, 'r2')), { total: 0, booked: 2, bookings: 0, bd: { ad: 0, chd: 0, inf: 0, foc: 0 } }, 'nobody lost: no badge');
  assert.deepEqual(plain(lost(srv, 'r9')), { total: 0, booked: 0, bookings: 0, bd: { ad: 0, chd: 0, inf: 0, foc: 0 } }, 'a route the server does not list has nobody on it');
  assert.equal(lost(null, 'r1'), null, 'no answer: the browser counts');
  assert.equal(lost({ routes: [{ route_id: 'r1', pax: { total: 3 } }] }, 'r1'), null, 'an older server without the field: the browser counts');
});

test('By trip render: the variant row draws the badge from the reader, and the Thai compact view keeps it', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../../allotment_v2/js/booking/bookingV2RenderTab2.js', import.meta.url), 'utf8');
  assert.match(src, /window\.laOpsByTripLost\(_srv,rid\)/, 'the server figure first');
  assert.match(src, /ckLostByType\(r\.bk,date\)/, 'lk\'s browser count as the fallback');
  assert.match(src, /<span class="bt-cxl" title="\$\{laT\('จอง'\)\}/, 'lk\'s badge and tooltip');
  const app = await readFile(new URL('../../allotment_v2/js/08-app.js', import.meta.url), 'utf8');
  assert.match(app, /cxl = sp\.querySelector\('\.bt-cxl'\)/, 'the compact view picks the badge up');
  assert.match(app, /\(cxl \? cxl\.outerHTML : ''\)/, 'and puts it back in the .fr cell');
});
