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
