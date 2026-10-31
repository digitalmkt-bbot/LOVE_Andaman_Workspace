// b2c-v1-availability.js — GET /v1/availability on operation-backend's contract.
//
// Worth a test because each of these has already sold a seat that was not there, or refused one that
// was:
//   1. A boat added after launch has no b*_route column, so a reader of the wide columns alone never
//      sees it (Tri Star 01, Dec 2026). trips__boat must win.
//   2. A closed day must answer 0, even with boats on it (Similan, 30 Jul 2026).
//   3. A chartered boat carries no sellable seat, and a day-capacity override is clamped to the
//      registered seats (Aluminous2, 4 Aug 2026).
//   4. The key must be checked before the database is touched.
//   5. The field names are the contract: Love Kingdom flips host to operation-backend with no mapping.
//
// Run: node --test test/unit/b2c-v1-availability.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require_ = createRequire(import.meta.url);
const v1 = require_(path.join(ROOT, 'b2c-v1-availability.js'));

const DAY = '2030-01-04';
const data = (over = {}) => Object.assign({
  routes: [{ id: 'r10', pier: 'tublamu', kind: 'marine' }],
  boats: [{ id: 'b1', cap: 30, licensepax: 35 }, { id: 'b2', cap: 10, licensepax: 0 }],
  trips: [], tripBoats: [], capOverrides: [], demand: [], locks: [], seasons: [], overrides: [],
}, over);
const deployed = (boat, type = '', route = 'r10') => ({ key: DAY, [boat + '_route']: route, [boat + '_type']: type });
const one = (over) => v1.buildDays(data(over), [DAY])[0];

test('sells what is left on the unchartered boats, and counts a charter apart', () => {
  const day = one({
    trips: [{ key: DAY, b1_route: 'r10', b1_type: '', b2_route: 'r10', b2_type: 'charter' }],
    demand: [{ date: DAY, routeid: 'r10', booked: 8, charter: 4 }],
  });
  assert.deepEqual(day, {
    route_id: 'r10', service_date: DAY, open: true,
    deployed_capacity: 40, licensed_capacity: 45, booked_pax: 8, charter_pax: 4, locked_pax: 0,
    available_seats: 22, unlimited: false, unplaced_pax: 0, licensed_free: 27,
    deployments: [
      { boat_id: 'b1', capacity: 30, license_pax: 35, chartered: false, trip_type: 'normal' },
      { boat_id: 'b2', capacity: 10, license_pax: null, chartered: true, trip_type: 'normal' },
    ],
  });
});

test('a lock takes seats from the sale but not from the licensed ceiling', () => {
  const day = one({ trips: [deployed('b1')], demand: [{ date: DAY, routeid: 'r10', booked: 5, charter: 0 }], locks: [{ date: DAY, routeid: 'r10', locked: 10 }] });
  assert.equal(day.available_seats, 15);
  assert.equal(day.locked_pax, 10);
  assert.equal(day.licensed_free, 30);
});

test('a boat with no wide column is seen through trips__boat', () => {
  const day = one({
    boats: [{ id: 'b1784877193883', cap: 60, licensepax: 60 }],
    trips: [{ key: DAY }],
    tripBoats: [{ trips_id: DAY, key: 'b1784877193883', value: JSON.stringify({ route: 'r10', type: 'early' }) }],
  });
  assert.equal(day.available_seats, 60);
  assert.equal(day.deployments[0].trip_type, 'early');
});

test('trips__boat wins over a stale wide column, including taking a boat off the route', () => {
  const day = one({
    trips: [deployed('b1')],
    tripBoats: [{ trips_id: DAY, key: 'b1', value: JSON.stringify({ route: '' }) }],
  });
  assert.equal(day.deployed_capacity, 0);
  assert.deepEqual(day.deployments, []);
});

test('an unreadable trips__boat row falls back to the wide column instead of failing the call', () => {
  const day = one({ trips: [deployed('b1')], tripBoats: [{ trips_id: DAY, key: 'b1', value: '{oops' }] });
  assert.equal(day.deployed_capacity, 30);
});

test('a day override is clamped to the registered seats', () => {
  assert.deepEqual(v1.boatSeats({ cap: 44, licensepax: 46 }, 50), { sellable: 46, licensed: 46 });
  assert.deepEqual(v1.boatSeats({ cap: 44, licensepax: 46 }, 46), { sellable: 46, licensed: 46 });
  assert.deepEqual(v1.boatSeats({ cap: 44, licensepax: 0 }, 50), { sellable: 44, licensed: 44 });
  assert.deepEqual(v1.boatSeats({ cap: 44, licensepax: 46 }, undefined), { sellable: 44, licensed: 46 });
  assert.equal(one({ trips: [deployed('b1')], capOverrides: [{ k: DAY + '::b1', cap: 33 }] }).available_seats, 33);
});

test('a closed day answers 0 even with a boat on it', () => {
  const day = one({
    trips: [deployed('b1')],
    seasons: [{ routes_id: 'r10', ty: 'closed', f: '2030-01-01', t: '2030-01-31' }],
  });
  assert.equal(day.open, false);
  assert.equal(day.available_seats, 0);
  assert.equal(day.deployed_capacity, 30);
});

test('the calendar: an override wins, and outside every open season is closed', () => {
  const season = { routes_id: 'r10', ty: 'open', f: '2030-02-01', t: '2030-02-28' };
  assert.equal(v1.calendarOf([], [])('r10', DAY), true);
  assert.equal(v1.calendarOf([season], [])('r10', DAY), false);
  assert.equal(v1.calendarOf([season], [])('r10', '2030-02-10'), true);
  assert.equal(v1.calendarOf([season], [{ routes_id: 'r10', k: DAY, v: '"open"' }])('r10', DAY), true);
  assert.equal(v1.calendarOf([season], [{ routes_id: 'r10', k: '2030-02-10', v: '"closed"' }])('r10', '2030-02-10'), false);
  assert.equal(v1.calendarOf([], [{ routes_id: 'r9', k: DAY, v: 'closed' }])('r10', DAY), true);
});

test('a marine day with no boat answers 0 and puts what it holds in unplaced_pax', () => {
  const day = one({ demand: [{ date: DAY, routeid: 'r10', booked: 3, charter: 2 }], locks: [{ date: DAY, routeid: 'r10', locked: 1 }] });
  assert.equal(day.available_seats, 0);
  assert.equal(day.unplaced_pax, 6);
  assert.equal(day.licensed_free, 0);
});

test('a land route has no seat count, by kind or by the retired pier', () => {
  for (const route of [{ id: 'r10', pier: '', kind: 'land' }, { id: 'r10', pier: 'other', kind: null }]) {
    const day = one({ routes: [route], demand: [{ date: DAY, routeid: 'r10', booked: 3, charter: 0 }] });
    assert.equal(day.available_seats, null);
    assert.equal(day.licensed_free, null);
    assert.equal(day.unlimited, true);
    assert.equal(day.unplaced_pax, 0);
  }
});

test('oversold never answers a negative number', () => {
  const day = one({ trips: [deployed('b1')], demand: [{ date: DAY, routeid: 'r10', booked: 40, charter: 0 }] });
  assert.equal(day.available_seats, 0);
  assert.equal(day.licensed_free, 0);
});

test('every route-day is present, date first and then routes as given', () => {
  const days = v1.buildDays(data({ routes: [{ id: 'r2' }, { id: 'r1' }] }), ['2030-01-01', '2030-01-02']);
  assert.deepEqual(days.map(d => d.service_date + ' ' + d.route_id),
    ['2030-01-01 r2', '2030-01-01 r1', '2030-01-02 r2', '2030-01-02 r1']);
});

// ── HTTP surface ────────────────────────────────────────────────────────────────────────────────
function call({ query = '', method = 'GET', key = 'secret', pool, dataBackend = 'relational' } = {}) {
  process.env.B2C_API_KEY = 'secret';
  const db = pool || fakePool();
  const headers = key === null ? {} : { 'x-api-key': key };
  return new Promise(resolve => {
    const J = (_res, code, body) => resolve({ code, body, db });
    v1.handle({ method, headers }, {}, query, { pool: db, fqt: t => `"operation_schemas"."${t}"`, qic: id => `"${id}"`, J, dataBackend });
  });
}
function fakePool(rows = {}) {
  const pool = { calls: 0, query(sql) {
    pool.calls++;
    const hit = Object.keys(rows).find(k => sql.includes(k));
    if (hit && rows[hit] instanceof Error) return Promise.reject(rows[hit]);
    if (hit) return Promise.resolve({ rows: rows[hit] });
    if (sql.includes('FROM "operation_schemas"."routes" ORDER')) return Promise.resolve({ rows: [{ id: 'r10', pier: 'tublamu', kind: 'marine' }, { id: 'r11', pier: 'panwa', kind: 'marine' }] });
    return Promise.resolve({ rows: [] });
  } };
  return pool;
}

test('no key, a wrong key or no B2C_API_KEY is 401 before the database is touched', async () => {
  for (const key of [null, 'wrong', '']) {
    const r = await call({ key, query: 'route_id=r10&date=' + DAY });
    assert.equal(r.code, 401);
    assert.equal(r.body.statusCode, 401);
    assert.equal(r.db.calls, 0);
  }
  const body = await new Promise(resolve => {
    delete process.env.B2C_API_KEY;
    v1.handle({ method: 'GET', headers: { 'x-api-key': '' } }, {}, '', { J: (_r, code, b) => resolve({ code, b }) });
  });
  assert.equal(body.code, 401);
});

test('the key opens GET only', async () => {
  const r = await call({ method: 'POST', query: 'route_id=r10&date=' + DAY });
  assert.equal(r.code, 403);
  assert.equal(r.db.calls, 0);
});

test('bad requests are 400 in operation-backend\'s error shape', async () => {
  const bad = [
    '', 'route_id=r10', 'date=' + DAY, 'route_id=r10&date=04-01-2030', 'route_id=r10&date=2030-02-31',
    'from=2030-01-01', 'to=2030-01-01', 'from=2030-01-02&to=2030-01-01', `date=${DAY}&from=2030-01-01&to=2030-01-02`,
    'from=2030-01-01&to=2030-03-31', 'route_id=r10&from=2030-01-01&to=2031-03-01', `route_id=r10&date=${DAY}&split=agent`,
  ];
  for (const query of bad) {
    const r = await call({ query });
    assert.equal(r.code, 400, query);
    assert.deepEqual(Object.keys(r.body), ['statusCode', 'error', 'message']);
    assert.equal(r.db.calls, 0, query);
  }
});

test('the single-day form carries operation-backend\'s fields and no deployments', async () => {
  const r = await call({ query: `route_id=r10&date=${DAY}` });
  assert.equal(r.code, 200);
  for (const field of ['route_id', 'service_date', 'deployed_capacity', 'licensed_capacity', 'booked_pax', 'charter_pax', 'locked_pax', 'available_seats', 'unlimited', 'unplaced_pax', 'licensed_free']) {
    assert.ok(field in r.body, field);
  }
  assert.ok(!('deployments' in r.body));
  assert.ok(!('days' in r.body));
});

test('the range form lists every route, or one with route_id', async () => {
  const all = await call({ query: 'from=2030-01-01&to=2030-01-02' });
  assert.equal(all.body.days.length, 4);
  assert.ok(Array.isArray(all.body.days[0].deployments));
  const mine = await call({ query: 'route_id=r11&from=2030-01-01&to=2030-01-02' });
  assert.deepEqual(mine.body.days.map(d => d.route_id), ['r11', 'r11']);
  const year = await call({ query: 'route_id=r11&from=2030-01-01&to=2031-02-04' });
  assert.equal(year.code, 200);
});

test('an unknown route is 404, never a day that reads as sellable', async () => {
  for (const query of [`route_id=nope&date=${DAY}`, 'route_id=nope&from=2030-01-01&to=2030-01-02']) {
    assert.equal((await call({ query })).code, 404);
  }
});

test('a database failure is a 500 that leaks nothing', async () => {
  const quiet = console.error; console.error = () => {};
  try {
    const r = await call({ query: `route_id=r10&date=${DAY}`, pool: fakePool({ sb_seat_locks: new Error('password authentication failed') }) });
    assert.equal(r.code, 500);
    assert.ok(!JSON.stringify(r.body).includes('password'));
  } finally { console.error = quiet; }
});

test('no database or the wrong backend is 503', async () => {
  assert.equal((await call({ dataBackend: 'blob', query: `route_id=r10&date=${DAY}` })).code, 503);
  const r = await new Promise(resolve => {
    process.env.B2C_API_KEY = 'secret';
    v1.handle({ method: 'GET', headers: { 'x-api-key': 'secret' } }, {}, '', { pool: null, J: (_r, code) => resolve(code) });
  });
  assert.equal(r, 503);
});
