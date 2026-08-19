import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractFunction, legacySource, loadLegacyFunctions } from './helpers/legacy-source.mjs';

const DATE = '2026-09-15';
const plain = (value) => JSON.parse(JSON.stringify(value));

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
  };
}

test('booking persistence preserves unrelated fleet data and does not reset a versionless cloud payload', () => {
  const storage = memoryStorage({
    loveandaman_v2: JSON.stringify({
      routes: [], boats: [], trips: { [DATE]: { b1: { route: 'similan' } } },
      fleet_inventory: [{ id: 'fuel-filter' }], sb_bookings: [{ id: 'bk-existing' }],
    }),
  });
  const context = loadLegacyFunctions(['loadData', { name: 'save', occurrence: 1 }], {
    localStorage: storage,
    LS_KEY: 'loveandaman_v2', DATA_VERSION: 'test-version',
    DEFAULT_ROUTES: [{ id: 'seed-route' }], DEFAULT_BOATS: [{ id: 'seed-boat' }],
    laApplySort: (routes) => routes,
    ROUTES: [{ id: 'changed-route' }], BOATS: [{ id: 'changed-boat' }], TRIPS: { [DATE]: {} },
    window: {},
  });

  const loaded = context.loadData();
  assert.deepEqual(plain(loaded.routes), []);
  assert.deepEqual(plain(loaded.boats), []);
  context.save();
  const persisted = JSON.parse(storage.getItem('loveandaman_v2'));
  assert.deepEqual(persisted.routes, [{ id: 'changed-route' }]);
  assert.deepEqual(persisted.boats, [{ id: 'changed-boat' }]);
  assert.deepEqual(persisted.fleet_inventory, [{ id: 'fuel-filter' }]);
  assert.deepEqual(persisted.sb_bookings, [{ id: 'bk-existing' }]);
});

test('cancelled and non-seat bookings are excluded from the booking aggregate', () => {
  const bookings = [
    { id: 'active', schemaVer: 2, status: 'confirmed', trips: [{ routeId: 'similan', date: DATE, pax: { ad_fr: 2, chd_fr: 1 } }] },
    { id: 'cancelled', schemaVer: 2, status: 'cancelled', trips: [{ routeId: 'similan', date: DATE, pax: { ad_fr: 9 } }] },
    { id: 'weather', schemaVer: 2, status: 'cancelled_weather', trips: [{ routeId: 'similan', date: DATE, pax: { ad_fr: 9 } }] },
    { id: 'rejected', schemaVer: 2, status: 'rejected', trips: [{ routeId: 'similan', date: DATE, pax: { ad_fr: 9 } }] },
    { id: 'over-cap', schemaVer: 2, status: 'pending_approval', approval: { totOver: 1 }, trips: [{ routeId: 'similan', date: DATE, pax: { ad_fr: 9 } }] },
    { id: 'charter', schemaVer: 2, status: 'confirmed', trips: [{ routeId: 'similan', date: DATE, bookingMode: 'charter', pax: { ad_fr: 9 } }] },
    { id: 'legacy', programId: 'similan', travelDate: DATE, pax: { adult: 1, child: 1, infant: 1 } },
  ];
  const context = loadLegacyFunctions(['bkPendHoldsSeat', 'getSeatsConsumed'], {
    SB_BOOKINGS: bookings,
    getTripPaxTotal: (trip) => Object.values(trip.pax || {}).reduce((sum, value) => sum + Number(value || 0), 0),
  });
  assert.equal(context.getSeatsConsumed('similan', DATE), 6);
  assert.equal(context.getSeatsConsumed('similan', DATE, 'active'), 3);
});

test('parent locks reduce the pool once while child locks remain drawable allocations', () => {
  const context = loadLegacyFunctions(['bkV2LockHeldRemaining', 'bkV2LockPoolHold'], {
    bkV2LockSpansDays: () => false,
    bkV2LockUsedTotal: (lock) => lock.used || 0,
  });
  assert.equal(context.bkV2LockPoolHold({ id: 'parent', qty: 10, used: 3 }, DATE), 7);
  assert.equal(context.bkV2LockPoolHold({ id: 'child', parentId: 'parent', qty: 4, used: 1 }, DATE), 0);
});

test('boat assignment excludes charter boats found in bookings as well as Boat Operation', () => {
  const context = loadLegacyFunctions(['baCharterBoatMap', 'baCharterBoatMapMemo', 'baCharterBoatIds', 'baDayBoats'], {
    TRIPS: { [DATE]: {
      b1: { route: 'similan' },
      b2: { route: 'similan', charterBookingId: 'legacy-charter' },
      b3: { route: 'surin' },
    } },
    BOATS: [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }],
    SB_BOOKINGS: [{ id: 'charter-booking', status: 'confirmed', trips: [{ date: DATE, bookingMode: 'charter', charterBoatId: 'b3' }] }],
    bkBoatIdsOn: () => [], Promise, _baChMemo: null,
  });
  assert.deepEqual(plain([...context.baCharterBoatIds(DATE)].sort()), ['b3']);
  assert.deepEqual(plain(context.baDayBoats(DATE).map((item) => item.boatId)), ['b1']);
});

test('rate-type seat pricing uses route, zone, and nationality-specific rates', () => {
  const rate = { seatRates: { similan: { PK: {
    'adult-fr': 1000, 'child-fr': 600, 'adult-thai': 800, 'child-thai': 400,
  } } } };
  const context = loadLegacyFunctions(['bkV2TripSubtotal'], {
    bkV2GetRTForTrip: () => rate,
    bkV2PaxAllTot: (pax) => Object.values(pax || {}).reduce((sum, value) => sum + Number(value || 0), 0),
    bkV2PaxTot: () => 0,
    _rtBundleAppliesTo: () => false,
  });
  assert.deepEqual(plain(context.bkV2TripSubtotal({
    routeId: 'similan', zone: 'PK', pax: { ad_fr: 2, chd_fr: 1, ad_th: 1, chd_th: 2 },
  })), { total: 4200, seatFr: 2600, seatTh: 1600, bundle: 0 });
  assert.equal(context.bkV2TripSubtotal({ routeId: 'similan', zone: 'KL', pax: { ad_fr: 1 } }).noRate, true);
});

test('rate-type longtail pricing keeps per-route prices and migrates legacy flat pricing', () => {
  const context = loadLegacyFunctions(['_rtNormalizeLongtail', '_rtLongtailForRoute']);
  const legacy = { addOns: { longtail: { applies: ['similan', 'surin'], adult: 500, child: 250 } } };
  assert.deepEqual(plain(context._rtLongtailForRoute(legacy, 'similan')), { join: { adult: 500, child: 250 }, charter: { price: 0, capacity: 6 } });
  const perRoute = { addOns: { longtail: { applies: ['similan', 'surin'], byRoute: {
    similan: { join: { adult: 700, child: 350 }, charter: { price: 2500, capacity: 8 } },
    surin: { join: { adult: 600, child: 300 }, charter: { price: 2000, capacity: 6 } },
  } } } };
  assert.equal(context._rtLongtailForRoute(perRoute, 'surin').join.adult, 600);
  assert.equal(context._rtLongtailForRoute(perRoute, 'other').join.adult, 700);
});

test('booking edit source preserves operational and audit fields, with documented date-change clearing', () => {
  const commit = extractFunction('bkV2CommitBooking');
  for (const field of ['history', 'weatherResolve', 'rebook', 'invoiceId', 'paymentStatus', 'ops', 'upgrades', 'feeItems', 'reschedule', 'partialCancels', 'cancellation', 'cancelCategory']) {
    assert.match(commit, new RegExp(`editing\\.${field}`), `edit must preserve ${field}`);
  }
  assert.match(commit, /ops:\s*t\.ops\s*\|\|\s*undefined/);
  assert.match(commit, /if\(_oldD\s*&&\s*_newD\s*&&\s*_oldD!==_newD\s*&&\s*newBk\.ops\)/);
  assert.match(commit, /if\(!_isCharter\)\s*newBk\.ops\.boatId=null/);
});

test('intentional exceptions remain explicitly documented beside the executable characterization', () => {
  const fixture = JSON.parse(readFileSync('tests/legacy/fixtures/intentional-exceptions.json', 'utf8'));
  assert.equal(fixture.exceptions.length, 5);
  assert.match(legacySource, /function bkV2CommitBooking\(/);
});
