// §turnBack · ops.turnBack survives the SQL round-trip (migration 042 · ops_turnback json_text on sb_bookings and sb_bookings__trips)
// Before 042 there was no column, so decomposeBlob dropped it and the record vanished on the next refresh (as ops.pierNote did, 9f1d1602).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const osRepo = require('../../os-backend/src/mapping/os_repo.js');

const TB = { at: '2026-10-29T02:00:00.000Z', hm: '09:00', by: 'Pier A', reason: 'weather', note: 'wave 2 m', pax: 3,
  money: { kind: 'refund', pct: 50, amt: null, note: 'agent OK', by: 'Pier A', at: '2026-10-29T02:05:00.000Z' } };
const booking = () => ({ id: 'BK-TB1', status: 'confirmed', leadPax: 'Test',
  ops: { pierNote: { t: 'seat front', at: '2026-10-29T01:00:00.000Z', by: 'Pier A' }, turnBack: JSON.parse(JSON.stringify(TB)) },
  trips: [{ routeId: 'r1', date: '2026-10-29', bookingMode: 'seat', pax: { ad_fr: 4 } },
          { routeId: 'r1', date: '2026-10-30', bookingMode: 'seat', pax: { ad_fr: 4 }, ops: { turnBack: { ...JSON.parse(JSON.stringify(TB)), reason: 'boat', editedAt: '2026-10-30T03:00:00.000Z' } } }] });
const viaDb = (rows) => JSON.parse(JSON.stringify(rows));

test('ops.turnBack on the booking and on a later trip survives decompose -> assemble', () => {
  const back = osRepo.assembleBlob(viaDb(osRepo.decomposeBlob({ sb_bookings: [booking()] })));
  const b = back.sb_bookings[0];
  assert.deepEqual(b.ops.turnBack, TB);
  assert.equal(b.ops.pierNote.t, 'seat front', 'the pier note is untouched');
  assert.equal(b.trips[1].ops.turnBack.reason, 'boat');
  assert.equal(b.trips[1].ops.turnBack.editedAt, '2026-10-30T03:00:00.000Z');
});

test('the record is one json_text column on each table', () => {
  const rows = osRepo.decomposeBlob({ sb_bookings: [booking()] });
  assert.equal(typeof rows.sb_bookings[0].ops_turnback, 'string');
  assert.deepEqual(JSON.parse(rows.sb_bookings[0].ops_turnback), TB);
  const trip2 = rows.sb_bookings__trips.find((t) => t.date === '2026-10-30');
  assert.equal(JSON.parse(trip2.ops_turnback).reason, 'boat');
});
