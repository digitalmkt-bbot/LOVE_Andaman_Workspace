// LAM-77 characterization: rate-type pricing.
//
// CLAUDE.md §3.2: rate types hold `seatRates{route:{zone:{paxType:price}}}`
// and `charterRates{route:{boatType:{starterPrice,starterIncludes,extraPerPax}}}`.
// "Longtail is per-route (byRoute); read via _rtNormalizeLongtail /
// _rtLongtailForRoute(rt,routeId) (migrates old flat shape)."
//
// This suite executes two real pricing paths extracted verbatim:
//   A. tsNetOf(r) — the actual net-price-of-a-trip calculator (seat + charter).
//   B. _rtNormalizeLongtail / _rtLongtailForRoute — the longtail add-on's
//      per-route price resolution, including its 3 legacy-shape migrations.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractFunction } from './lib/source.mjs';
import { runInSandbox } from './lib/sandbox.mjs';

// ── A. tsNetOf ───────────────────────────────────────────────────────────
const tsNetCode = [extractFunction('_tsNum'), extractFunction('tsNetOf')].join('\n');

function netOf(b, t, { SB_RATE_TYPES = [], BOATS = [] } = {}) {
  const bkV2PaxAllTot = (pax) => {
    if (!pax) return 0;
    const k = (kind) => (pax[kind] || 0) + (pax[`${kind}_fr`] || 0) + (pax[`${kind}_th`] || 0);
    return k('ad') + k('chd') + k('inf') + k('foc');
  };
  const { tsNetOf } = runInSandbox(tsNetCode, { SB_RATE_TYPES, BOATS, bkV2PaxAllTot }, ['tsNetOf']);
  const res = tsNetOf({ b, t });
  return res ? JSON.parse(JSON.stringify(res)) : res;
}

const seatRateType = {
  id: 'rt1',
  seatRates: {
    r1: {
      PK: { 'adult-fr': 1500, 'child-fr': 750, 'adult-thai': 1000, 'child-thai': 500 },
      KL: { 'adult-fr': 1700, 'child-fr': 850 },
    },
  },
};

describe('rate-type pricing — tsNetOf (seat mode)', () => {
  test('multiplies each pax-type quantity by its per-zone rate and sums them, with a breakdown string', () => {
    const b = { rateTypeRef: 'rt1', zone: 'PK' };
    const t = { routeId: 'r1', date: '2026-09-01', zone: 'PK', pax: { ad_fr: 2, chd_th: 1 } };
    const res = netOf(b, t, { SB_RATE_TYPES: [seatRateType] });
    assert.deepEqual(res, { tot: 2 * 1500 + 1 * 500, txt: '2×1,500 + 1×500' });
  });

  test('a pax type with quantity but rate 0 (or missing) is silently dropped from the total AND the breakdown', () => {
    const b = { rateTypeRef: 'rt1', zone: 'PK' };
    const t = { routeId: 'r1', date: '2026-09-01', zone: 'PK', pax: { ad_fr: 1, chd_fr: 1 } }; // PK has no child-fr rate configured above? it does (750)
    const res = netOf(b, t, { SB_RATE_TYPES: [seatRateType] });
    assert.equal(res.tot, 1500 + 750);
  });

  test('no rate type resolvable (no rateTypeRef, no agent) → returns null, not a computed 0', () => {
    const b = {};
    const t = { routeId: 'r1', date: '2026-09-01', pax: { ad_fr: 2 } };
    assert.equal(netOf(b, t, { SB_RATE_TYPES: [seatRateType] }), null);
  });

  test('the rate type has no seatRates entry for this route at all → null', () => {
    const b = { rateTypeRef: 'rt1' };
    const t = { routeId: 'unknown-route', pax: { ad_fr: 1 } };
    assert.equal(netOf(b, t, { SB_RATE_TYPES: [seatRateType] }), null);
  });

  test('an overnight RETURN leg (t.ovnLeg) is always priced at null — never charged twice', () => {
    const b = { rateTypeRef: 'rt1' };
    const t = { routeId: 'r1', date: '2026-09-02', ovnLeg: true, pax: { ad_fr: 2 } };
    assert.equal(netOf(b, t, { SB_RATE_TYPES: [seatRateType] }), null);
  });

  test('when t.zone is unset, the zone is guessed from whether a hotel/pickup was given — NoTransfer wins when there is no pickup', () => {
    const rt = { id: 'rt1', seatRates: { r1: { NoTransfer: { 'adult-fr': 900 }, PK: { 'adult-fr': 1500 } } } };
    const noPickup = { rateTypeRef: 'rt1' }; // no hotelName/pickup
    const t = { routeId: 'r1', pax: { ad_fr: 1 } }; // no t.zone
    const res = netOf(noPickup, t, { SB_RATE_TYPES: [rt] });
    assert.equal(res.tot, 900, 'no hotel/pickup on the booking => zone-guess order starts with NoTransfer');
  });

  test('legAd/legChd fallback: plain `ad`/`chd` counts are treated as "foreigner" (adult-fr/child-fr) when the *-fr/-th split is absent', () => {
    const b = { rateTypeRef: 'rt1', zone: 'PK' };
    const t = { routeId: 'r1', zone: 'PK', pax: { ad: 3 } }; // no ad_fr/ad_th at all
    const res = netOf(b, t, { SB_RATE_TYPES: [seatRateType] });
    assert.equal(res.tot, 3 * 1500, 'a plain `ad` count with no fr/th split falls back to the adult-fr (foreigner) rate');
  });
});

describe('rate-type pricing — tsNetOf (charter mode)', () => {
  const charterRateType = {
    id: 'rt2',
    charterRates: { r1: { speedboat: { starterPrice: 20000, starterIncludes: 10, extraPerPax: 800 } } },
  };

  test('within the starter-includes headcount: flat starterPrice only, no per-pax extra in the text', () => {
    const b = { rateTypeRef: 'rt2' };
    const t = { routeId: 'r1', bookingMode: 'charter', charterBoatId: 'boatX', pax: { ad: 8 } };
    const res = netOf(b, t, { SB_RATE_TYPES: [charterRateType], BOATS: [{ id: 'boatX', type: 'Speedboat' }] });
    assert.deepEqual(res, { tot: 20000, txt: 'เหมาลำ 20,000' });
  });

  test('over the starter-includes headcount: starterPrice + (excess × extraPerPax), and the text shows the excess', () => {
    const b = { rateTypeRef: 'rt2' };
    const t = { routeId: 'r1', bookingMode: 'charter', charterBoatId: 'boatX', pax: { ad: 13 } }; // 3 over 10
    const res = netOf(b, t, { SB_RATE_TYPES: [charterRateType], BOATS: [{ id: 'boatX', type: 'Speedboat' }] });
    assert.deepEqual(res, { tot: 20000 + 3 * 800, txt: 'เหมาลำ 20,000 + 3×800' });
  });

  test('boat type lookup is case-insensitive ("Speedboat" boat matches a "speedboat" charterRates key)', () => {
    const b = { rateTypeRef: 'rt2' };
    const t = { routeId: 'r1', bookingMode: 'charter', charterBoatId: 'boatX', pax: { ad: 1 } };
    const res = netOf(b, t, { SB_RATE_TYPES: [charterRateType], BOATS: [{ id: 'boatX', type: 'SPEEDBOAT' }] });
    assert.ok(res, 'uppercase boat.type must still resolve to the lowercase charterRates key');
  });

  test('no charterRates entry for this route+boatType → null (no fallback to seatRates)', () => {
    const b = { rateTypeRef: 'rt2' };
    const t = { routeId: 'r1', bookingMode: 'charter', charterBoatId: 'boatX', pax: { ad: 1 } };
    const res = netOf(b, t, { SB_RATE_TYPES: [charterRateType], BOATS: [{ id: 'boatX', type: 'catamaran' }] });
    assert.equal(res, null);
  });
});

// ── B. Longtail add-on: per-route resolution + legacy-shape migration ─────
const longtailCode = [extractFunction('_rtNormalizeLongtail'), extractFunction('_rtLongtailForRoute')].join('\n');
function longtailForRoute(rt, routeId) {
  const { _rtLongtailForRoute } = runInSandbox(longtailCode, {}, ['_rtLongtailForRoute']);
  return JSON.parse(JSON.stringify(_rtLongtailForRoute(rt, routeId)));
}

describe('rate-type pricing — longtail add-on, per-route with legacy-shape migration', () => {
  test('current (per-route) shape: each route in byRoute keeps its own join/charter price', () => {
    const rt = { addOns: { longtail: { byRoute: {
      r1: { join: { adult: 500, child: 250 }, charter: { price: 3000, capacity: 6 } },
      r2: { join: { adult: 700, child: 350 }, charter: { price: 4000, capacity: 8 } },
    } } } };
    assert.deepEqual(longtailForRoute(rt, 'r1'), { join: { adult: 500, child: 250 }, charter: { price: 3000, capacity: 6 } });
    assert.deepEqual(longtailForRoute(rt, 'r2'), { join: { adult: 700, child: 350 }, charter: { price: 4000, capacity: 8 } });
  });

  test('a route not present in byRoute falls back to the flat/first-entry default, not to 0', () => {
    const rt = { addOns: { longtail: { byRoute: {
      r1: { join: { adult: 500, child: 250 }, charter: { price: 3000, capacity: 6 } },
    } } } };
    assert.deepEqual(longtailForRoute(rt, 'unknown-route'), { join: { adult: 500, child: 250 }, charter: { price: 3000, capacity: 6 } },
      'byRoute[routeId] || {join:lt.join, charter:lt.charter} — falls back to the flat default derived from the first entry');
  });

  test('legacy OLD flat shape (single join/charter, no byRoute at all) is migrated: the flat price is spread across every route in `applies`', () => {
    const rt = { addOns: { longtail: {
      applies: ['r1', 'r2'],
      join: { adult: 600, child: 300 },
      charter: { price: 3500, capacity: 6 },
    } } };
    assert.deepEqual(longtailForRoute(rt, 'r1'), { join: { adult: 600, child: 300 }, charter: { price: 3500, capacity: 6 } });
    assert.deepEqual(longtailForRoute(rt, 'r2'), { join: { adult: 600, child: 300 }, charter: { price: 3500, capacity: 6 } },
      'the SAME flat price is spread identically across every route named in applies — there is no per-route differentiation in the legacy shape');
  });

  test('an even OLDER flat shape (bare adult/child, no join/charter wrapper) is also migrated, with charter defaulted to {price:0,capacity:6}', () => {
    const rt = { addOns: { longtail: { adult: 400, child: 200 } } };
    assert.deepEqual(longtailForRoute(rt, 'any-route'), { join: { adult: 400, child: 200 }, charter: { price: 0, capacity: 6 } });
  });

  test('no longtail add-on configured at all on the rate type → null (not an object with zeros)', () => {
    const rt = { addOns: {} };
    assert.equal(longtailForRoute(rt, 'r1'), null);
  });

  test('a byRoute entry missing its `charter` sub-object defaults capacity to 6, price to 0 (per-field normalization, not per-entry)', () => {
    const rt = { addOns: { longtail: { byRoute: { r1: { join: { adult: 500, child: 250 } } } } } };
    assert.deepEqual(longtailForRoute(rt, 'r1'), { join: { adult: 500, child: 250 }, charter: { price: 0, capacity: 6 } });
  });
});
