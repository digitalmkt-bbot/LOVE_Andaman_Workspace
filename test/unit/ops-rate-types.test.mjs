import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/17-ops-rate-types.js', 'utf8');

function compat(){
  const window = { laOps: { enabled: () => false } };
  vm.runInNewContext(SOURCE, { window, console, Number, JSON, Date });
  return window.__laOpsRateTypeCompat;
}

test('rate type API projection preserves booking net prices and legacy shapes', () => {
  const c = compat();
  const server = {
    id: 'rt-api', code: 'API-2026', name: 'API rate', note: null, color: '#1683C7', active: true,
    owner: 'sales-1', valid_from: '2026-01-01', valid_to: '2026-12-31', nationality_scope: 'both', transfer_unit: 'per trip',
    routes: [{
      route_id: 'r5', travel_from: '2026-02-01', travel_to: '2026-11-30',
      longtail_bundle: { mode: 'paid', adult: 40, child: 20, applies_to: 'seat' },
      zones: { PK: { net: { ad_fr: 100, chd_fr: 60 }, sell: { ad_fr: 120 }, min_sell: { ad_fr: 110 } } },
      charter: { speedboat: { starter_price: 50000, starter_includes: 4, extra_per_pax: 2500 } },
      longtail: { join_adult: 400, join_child: 300, charter_price: 9000, charter_capacity: 6 },
      transfer: { PK: { sedan: 800, van: 1400 } }
    }]
  };
  const legacy = c.fromServer(server);
  assert.equal(legacy.validFrom, '2026-01-01');
  assert.deepEqual([...legacy.routes], ['r5']);
  assert.equal(legacy.seatRates.r5.PK['adult-fr'], 100, 'booking must use net, not sell');
  assert.equal(legacy.seatRates.r5.PK['child-fr'], 60);
  assert.equal(legacy.priceTiers.r5.PK['adult-fr'].sell, 120);
  assert.equal(legacy.priceTiers.r5.PK['adult-fr'].minSell, 110);
  assert.deepEqual(JSON.parse(JSON.stringify(legacy.routeValidity.r5)), { from: '2026-02-01', to: '2026-11-30' });
  assert.deepEqual(JSON.parse(JSON.stringify(legacy.routeBundles.r5.longtail)), { mode: 'paid', adult: 40, child: 20, applyTo: 'seat' });
  assert.deepEqual(JSON.parse(JSON.stringify(legacy.charterRates.r5.speedboat)), { starterPrice: 50000, starterIncludes: 4, extraPerPax: 2500 });
  assert.deepEqual(JSON.parse(JSON.stringify(legacy.addOns.longtail.byRoute.r5)), { join: { adult: 400, child: 300 }, charter: { price: 9000, capacity: 6 } });
  assert.deepEqual(JSON.parse(JSON.stringify(legacy.addOns.privateTransfer.r5.PK)), { sedan: 800, van: 1400 });

  const body = c.toCreateBody(legacy);
  assert.equal(body.routes.length, 1);
  assert.equal(body.routes[0].zones.PK.net.ad_fr, 100);
  assert.equal(body.routes[0].zones.PK.sell.ad_fr, 120);
  assert.equal(body.routes[0].zones.PK.min_sell.ad_fr, 110);
  assert.deepEqual(JSON.parse(JSON.stringify(body.routes[0].longtail)), { join_adult: 400, join_child: 300, charter_price: 9000, charter_capacity: 6 });
  assert.deepEqual(JSON.parse(JSON.stringify(body.routes[0].transfer.PK)), { sedan: 800, van: 1400 });
});

test('rate type API projection does not invent unsupported custom add-ons', () => {
  const c = compat();
  const body = c.toCreateBody({ id: 'rt-custom', name: 'Custom', routes: ['r1'], seatRates: {}, addOns: { custom_fee: { price: 10 } } });
  assert.deepEqual(JSON.parse(JSON.stringify(body.routes[0].zones)), {});
  assert.equal(body.routes[0].custom_fee, undefined);
});

test('a foreigner-only rate type is "fr" on the screen and "foreign" on the server, both ways', () => {
  const c = compat();
  assert.equal(c.fromServer({ id: 'x', nationality_scope: 'foreign', routes: [] }).nationalityScope, 'fr', 'server foreign -> the screen\'s fr (Thai columns hidden)');
  assert.equal(c.fromServer({ id: 'x', nationality_scope: 'thai', routes: [] }).nationalityScope, 'thai');
  assert.equal(c.fromServer({ id: 'x', nationality_scope: null, routes: [] }).nationalityScope, 'both');
  const d = { id: 'x', name: 'F', routes: [], nationalityScope: 'fr' };
  assert.equal(c.toCreateBody(d).nationality_scope, 'foreign', 'create sends foreign, which the server accepts');
  assert.equal(c.toPatch(d).nationality_scope, 'foreign', 'edit sends foreign');
  assert.equal(c.toCreateBody({ ...d, nationalityScope: 'thai' }).nationality_scope, 'thai');
  assert.equal(c.toCreateBody({ ...d, nationalityScope: 'both' }).nationality_scope, 'both');
});

test('deleting a rate type agents use says how many it unbinds, and clears them on the screen (legacy rtDeleteRT)', async () => {
  const calls = [], asked = [];
  const ctx = {
    console, Number, JSON, Date, Promise,
    SB_RATE_TYPES: [],
    SB_AGENTS: [{ id: 'ag1', rateTypeId: 'rt-a' }, { id: 'ag2', rateTypeId: 'rt-a' }, { id: 'ag3', rateTypeId: 'rt-b' }],
    confirm: (msg) => { asked.push(msg); return true; },
    rtDeleteRT: () => { throw new Error('legacy delete must not run in ops mode'); },
    laOps: {
      enabled: () => true,
      get: async () => ({ rate_types: [] }),
      del: async (path) => { calls.push(path); },
      queue: (fn) => fn(), wrote: () => {}, fail: (t, e) => { throw e; },
    },
  };
  ctx.window = ctx;
  vm.runInNewContext(SOURCE, ctx);
  await ctx.laOps.rateTypes.ready();
  ctx.SB_RATE_TYPES.push({ id: 'rt-a' }, { id: 'rt-b' });

  await ctx.rtDeleteRT('rt-a');
  assert.equal(asked[0], 'This rate type is used by 2 agents. Deleting it unbinds them. Delete?');
  assert.deepEqual(calls, ['/v1/rate-types/rt-a']);
  assert.deepEqual(ctx.SB_AGENTS.map((a) => a.rateTypeId), [null, null, 'rt-b'], 'its agents are unbound, the others keep theirs');
  assert.deepEqual(ctx.SB_RATE_TYPES.map((r) => r.id), ['rt-b']);

  ctx.SB_AGENTS = [];
  await ctx.rtDeleteRT('rt-b');
  assert.equal(asked[1], 'Delete this rate type?', 'an unused one gets the plain question');
});
