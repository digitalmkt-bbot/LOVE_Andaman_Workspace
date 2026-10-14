// §flatFallback · the server's dateless "Legacy flat table" profile (migration decision D4)
// must stay out of SB_PICKUP_TIME_PROFILES (Pickup Setup showed it as a broken
// "INVALID DATES" card and counted 2 profiles) while psuResolveProfile still falls back to it.
//   node --test test/unit/ops-pickup-fallback.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/21-ops-pickup.js', 'utf8');

const DATED = {
  id: 'prof-default-2026', name: 'Default 2026', from_date: '2026-01-01', to_date: '2027-05-15',
  notes: 'Initial profile', created_at: '2026-01-01T00:00:00Z',
  times: [{ route_id: 'r1', target: 'g1', pickup_time: '07:30' }],
};
const FLAT = {
  id: 'prof-legacy-flat', name: 'Legacy flat table', from_date: null, to_date: null,
  notes: 'Legacy SB_PICKUP_TIMES: the fallback behind the profiles (decision D4)', created_at: '2025-01-01T00:00:00Z',
  times: [{ route_id: 'r1', target: 'g2', pickup_time: '08:00' }],
};

function load() {
  const ctx = {
    console: { log() {}, warn() {} }, Promise, Date, Object, Array, Math, String, Number, JSON, encodeURIComponent,
    SB_PICKUP_AREAS: [],
    SB_PICKUP_TIME_PROFILES: [],
    SB_PICKUP_TIMES: { r1: { g2: '08:00' } },
    document: { getElementById: () => null },
    // legacy functions the adapter wraps; the legacy resolver only matches dated profiles
    renderPickupSetup() {},
    psuResolveProfile(dateStr) {
      return ctx.SB_PICKUP_TIME_PROFILES.find((p) => p.from && p.to && p.from <= dateStr && dateStr <= p.to) || null;
    },
    psuPersist() {}, _psuInheritTimesForArea() { return 0; },
    psuSaveArea() {}, psuDeleteArea() {}, psuSaveProfile() {}, psuDeleteProfile() {}, psuSetTimeCell() {},
  };
  ctx.window = ctx;
  ctx.laOps = {
    enabled: () => true,
    get: (path) => {
      if (path === '/v1/pickup-areas') return Promise.resolve({ areas: [{ id: 'a1', name: 'Area 1', zone: 'PK', time_group: 'g1' }] });
      if (path === '/v1/pickup-time-profiles') return Promise.resolve({ profiles: [{ id: DATED.id }, { id: FLAT.id }] });
      if (path === '/v1/pickup-time-profiles/' + DATED.id) return Promise.resolve(DATED);
      if (path === '/v1/pickup-time-profiles/' + FLAT.id) return Promise.resolve(FLAT);
      return Promise.reject(new Error('unexpected GET ' + path));
    },
    post: () => Promise.reject(new Error('no')), patch: () => Promise.reject(new Error('no')),
    del: () => Promise.reject(new Error('no')), call: () => Promise.reject(new Error('no')),
    queue: (fn) => fn(), fail() {}, wrote() {}, loadingHtml: () => '', today: () => '2026-10-14',
  };
  vm.createContext(ctx);
  vm.runInContext(SOURCE, ctx);
  return ctx;
}

test('the dateless server fallback profile is not shown or counted as a season', async () => {
  const ctx = load();
  await ctx.laOps.pickup.load();
  assert.deepEqual(ctx.SB_PICKUP_TIME_PROFILES.map((p) => p.id), ['prof-default-2026'],
    'only dated profiles reach the Pickup Setup screen (lk-inbox shows 1 profile)');
  assert.equal(Object.keys(ctx.SB_PICKUP_TIMES).length, 0, 'the old flat seed is still cleared in ops mode');
});

test('psuResolveProfile still falls back to the dateless server profile', async () => {
  const ctx = load();
  await ctx.laOps.pickup.load();
  // covered date → the dated profile wins
  assert.equal(ctx.window.psuResolveProfile('2026-10-14').id, 'prof-default-2026');
  // uncovered date → the server fallback, even though it is off the screen
  const fb = ctx.window.psuResolveProfile('2031-01-01');
  assert.ok(fb, 'a date outside every season still resolves');
  assert.equal(fb.id, 'prof-legacy-flat');
  assert.equal(fb.times.r1.g2, '08:00');
});
