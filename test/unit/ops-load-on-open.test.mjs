// §loadOnNeed / §loadOnOpen (2026-11-27): a login loads only what the open screen needs.
//   00-ops-core.js  laOps.later.need(name) · a reader outside the listed screens starts a load, once, and the screen is drawn again
//   30-ops-money.js invoices / deposits / refunds load on the money screens or when a legacy money helper is first called
//   30-ops-locks.js the login read carries no lock history; By trip and a lock's page ask for the history of their dates
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

const noTimer = { setTimeout: () => 0, clearTimeout: () => {} };

test('need(name) runs a load tagged to other screens once, then calls onLate; an unknown name does nothing', async () => {
  const { O, settle } = runtime({ globals: noTimer });
  const ran = [], late = [];
  O.later('money', () => { ran.push('money'); return Promise.resolve(); }, 1, ['accounting']);
  O.later.onLate((n) => late.push(n));
  O.later.start();
  await settle();
  assert.deepEqual(ran, [], 'tagged to a screen: not loaded after the first draw');
  assert.equal(await O.later.need('money'), true, 'this call started it');
  assert.equal(await O.later.need('money'), false, 'asked again: not sent twice');
  assert.equal(await O.later.open('accounting'), false, 'its screen finds it loaded: no redraw asked');
  assert.equal(await O.later.need('nope'), false);
  assert.deepEqual([ran, late], [['money'], ['money']]);
  assert.deepEqual(plain(O.later.names()), ['money ✓']);
});

function moneyRuntime() {
  const calls = [];
  const r = runtime({
    globals: {
      ...noTimer, SB_INVOICES: [], SB_PAYMENTS: [], SB_DEPOSITS: [], SB_BOOKINGS: [],
      laDomReady: (f) => f(),
      acctBookingInvoice: (id) => { calls.push(id); return null; },
    },
    handlers: {
      'GET /v1/invoices': { body: { invoices: [] } }, 'GET /v1/deposits': { body: { deposits: [] } }, 'GET /v1/refunds': { body: { refunds: [] } },
    },
    files: ['30-ops-money.js'],
  });
  return { ...r, calls };
}
const moneyReads = (requests) => requests.filter((q) => /^\/v1\/(invoices|deposits|refunds)/.test(q.path)).map((q) => q.path);

test('money: not read after the first draw; the first call of a legacy money helper loads it once and draws the screen again', async () => {
  const { O, ctx, requests, settle } = moneyRuntime();
  const late = [];
  O.later.onLate((n) => late.push(n));
  O.later.start();
  await settle();
  assert.deepEqual(moneyReads(requests), [], 'the Dashboard login does not download every invoice');
  ctx.acctBookingInvoice('bk1'); ctx.acctBookingInvoice('bk2');
  await settle();
  assert.deepEqual(moneyReads(requests), ['/v1/invoices', '/v1/deposits', '/v1/refunds'], 'one load for both calls');
  assert.deepEqual(late, ['money']);
  assert.equal(O.money.loaded(), true);
  ctx.acctBookingInvoice('bk3');
  await settle();
  assert.equal(moneyReads(requests).length, 3, 'loaded: nothing more');
});

test('money: its screens start it on open; a reader run through withoutLoad (the Dashboard board) does not', async () => {
  const { O, ctx, requests, settle } = moneyRuntime();
  O.later.start();
  O.money.withoutLoad(() => ctx.acctBookingInvoice('bk1'));
  await settle();
  assert.deepEqual(moneyReads(requests), [], 'the Dashboard\'s legacy sums do not load it');
  assert.equal(await O.later.open('dashboard'), false);
  assert.equal(await O.later.open('accounting'), true, 'Accounting loads it and is drawn again');
  assert.equal(moneyReads(requests).length, 3);
});

const D = '2026-12-01', D2 = '2026-12-02';
const line = (bookingId, tripDate) => ({ day: tripDate, at: tripDate + 'T03:00:00Z', type: 'draw', qty: 2, by: 'u', booking_id: bookingId, trip_date: tripDate });
const ROWS = [
  { id: 'lk_day', route_id: 'r1', service_date: D, pax: 10, status: 'active', state: 'active', agent_id: 'a1', version: 1, log: [line('bk3', D)] },
  { id: 'dep1', group_id: 'lg_1', route_id: 'r2', service_date: D, pax: 8, status: 'active', state: 'active', version: 1, log: [line('bk1', D)] },
  { id: 'dep2', group_id: 'lg_1', route_id: 'r2', service_date: D2, pax: 8, status: 'active', state: 'active', version: 1, log: [line('bk2', D2)] },
  { id: 'sub1', parent_id: 'dep1', sub_name: 'A', route_id: 'r2', service_date: D, pax: 2, status: 'active', state: 'active', version: 1, log: [line('bk4', D)] },
];
function locksRuntime() {
  const drawn = [];
  const r = runtime({
    globals: {
      ...noTimer, SB_SEAT_LOCKS: [], TRIPS: {}, SB_AGENTS: [],
      bookingV2RenderTab2: () => { drawn.push('tab2'); }, bookingV2Tab2ActiveDate: () => D, bookingV2Render: () => { drawn.push('render'); },
      bookingV2LockManageOpen: () => {},
    },
    handlers: {
      'GET /v1/seat-locks': (_b, path) => {
        const q = new URL('http://x' + path).searchParams, withLog = q.get('include') === 'log';
        const rows = ROWS.filter((x) => (!q.get('from') || x.service_date >= q.get('from')) && (!q.get('to') || x.service_date <= q.get('to'))
          && (!q.get('route_id') || x.route_id === q.get('route_id')));
        return { body: { seat_locks: rows.map((x) => { const o = { ...x }; if (!withLog) delete o.log; return o; }) } };
      },
      'GET /v1/seat-lock-groups': { body: { seat_lock_groups: [{ id: 'lg_1', route_id: 'r2', date_from: D, date_to: D2, weekdays: [], pax: 8, state: 'active', version: 1 }] } },
      'GET /v1/seat-locks/sweep': { body: { rows: [], over: [] } },
      'GET /v1/seat-lock-groups/lg_1/log': { body: { events: [line('bk1', D), line('bk2', D2)] } },
    },
    files: ['30-ops-locks.js'],
  });
  return { ...r, drawn };
}
const byId = (ctx, id) => ctx.SB_SEAT_LOCKS.find((l) => l.id === id);
const draws = (l) => plain(l.log.map((e) => e.bookingId));
const lockReads = (requests) => requests.filter((q) => q.path.startsWith('/v1/seat-locks?') || q.path === '/v1/seat-locks').map((q) => q.path);

test('seat locks: the login read carries no history; By trip asks for its day\'s, and every lock built from those rows gets its lines', async () => {
  const { O, ctx, requests, settle, drawn } = locksRuntime();
  await O.locks.load();
  assert.deepEqual(lockReads(requests), ['/v1/seat-locks'], 'no include=log at login');
  assert.deepEqual([draws(byId(ctx, 'lk_day')), draws(byId(ctx, 'lg_1')), draws(byId(ctx, 'sub1'))], [[], [], []]);

  ctx.bookingV2RenderTab2();
  await settle();
  assert.deepEqual(lockReads(requests).slice(1), [`/v1/seat-locks?include=log&from=${D}&to=${D}`]);
  assert.deepEqual(draws(byId(ctx, 'lk_day')), ['bk3'], 'a day lock');
  assert.deepEqual(draws(byId(ctx, 'lg_1')), ['bk1'], 'a bulk lock: the departures of that day (§btLkBand reads the day only)');
  assert.deepEqual(draws(byId(ctx, 'sub1')), ['bk4'], 'a sub-group');
  assert.ok(drawn.includes('render'), 'the page is drawn again with them');

  ctx.bookingV2RenderTab2();
  await settle();
  assert.equal(lockReads(requests).length, 2, 'the same day is not asked twice');

  await O.locks.load();
  await settle();
  assert.deepEqual(lockReads(requests).slice(2), ['/v1/seat-locks', `/v1/seat-locks?include=log&from=${D}&to=${D}`], 'a reload asks the day on show again');
  assert.deepEqual(draws(byId(ctx, 'lg_1')), ['bk1'], 'the rebuilt locks have their lines');
});

test('seat locks: a bulk lock\'s page asks for the departures of its dates, so its sub-groups\' history is whole', async () => {
  const { O, ctx, requests, settle } = locksRuntime();
  await O.locks.load();
  ctx.bookingV2LockManageOpen('lg_1');
  await settle();
  assert.deepEqual(lockReads(requests).slice(1), [`/v1/seat-locks?include=log&from=${D}&to=${D2}&route_id=r2`]);
  assert.deepEqual(draws(byId(ctx, 'lg_1')), ['bk1', 'bk2'], 'its own log (its /log read)');
  assert.deepEqual(draws(byId(ctx, 'sub1')), ['bk4']);
});
