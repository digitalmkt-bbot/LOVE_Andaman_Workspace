// Daily Fleet Log charters tile: the server day.charter_boats (flDrServerCharters)
//   node --test test/unit/ops-fleet-dr-charters.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { plain } from './fe-harness.mjs';

// ── 14 ──────────────────────────────────────────────────────────────────────
test('14: flDrServerCharters returns the server list of a day read, an empty list for a day left out of the answer, null for a day not read', () => {
  let on = false;
  const window = { laOps: { enabled: () => on, onWrite: () => {}, today: () => '2026-10-12', shift: () => '2026-10-01', onChange: () => {} } };
  vm.runInNewContext(fs.readFileSync('allotment_v2/js/ops/26-ops-fleet-daily.js', 'utf8'), {
    window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent, parseFloat, parseInt, isNaN, Math,
    FL_DAILY: {}, FL_FUEL_PRICE: {}, FL_DR_LOCK: {},
  });
  on = true;
  window.__laOpsFleetDailyCompat.applyDailyRange({
    from: '2026-10-11', to: '2026-10-13',
    days: [{ date: '2026-10-12', boats: [{ boat_id: 'b1', fuel_litres: 1, meters: {} }], charter_boats: ['c1', 'c2'], fuel_prices: {}, locks: {}, requests: {} }],
    issue_items: [],
  });
  assert.deepEqual(plain(window.flDrServerCharters('2026-10-12')), ['c1', 'c2']);
  assert.deepEqual(plain(window.flDrServerCharters('2026-10-11')), [], 'no day in the answer: no charter');
  assert.equal(window.flDrServerCharters('2026-10-20'), null, 'not read: legacy counts the loaded bookings');
  // a later read of the same day replaces the list
  window.__laOpsFleetDailyCompat.applyDailyDay({ date: '2026-10-12', boats: [], charter_boats: [], fuel_prices: {}, locks: {}, requests: {} });
  assert.deepEqual(plain(window.flDrServerCharters('2026-10-12')), []);
  on = false;
  assert.equal(window.flDrServerCharters('2026-10-12'), null, 'legacy mode');
});

