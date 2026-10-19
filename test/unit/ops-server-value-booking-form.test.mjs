// Wave 7a booking form: the park-fee warning (nat_mix) and the trip's rate type / promotion are drawn from the server's quote;
// a tampered browser value (legacy's own answer) is overridden.
//   node --test test/unit/ops-server-value-booking-form.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync('allotment_v2/js/ops/95-ops-w7a-booking-form.js', 'utf8');

function load({ warnings = [], trips = [], legacyNat, legacyRT, rts = {} } = {}) {
  const t0 = { id: 't0' };
  const ctx = { console, JSON, Array, String, Object, Date, Math, Promise, encodeURIComponent, document: { activeElement: null } };
  ctx.window = ctx;
  ctx.laOps = { enabled: () => true, get: () => new Promise(() => {}), onWrite() {} };
  ctx._bkV2 = { newBooking: { trips: [t0] } };
  ctx.laOpsQuote = { answered: () => ({ key: 'k', req: { map: [0] }, quote: { warnings, trips } }), onAnswer() {} };
  ctx.getRateType = (id) => rts[id] || null;
  ctx.bookingV2NatWarn = () => legacyNat;          // the browser's own answer (what a tampered client would hold)
  ctx.bookingV2GetRTForTrip = () => legacyRT;
  ctx.laMainRtIdFor = () => '';
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { ctx, t0 };
}

test('nat_mix: the server\'s warning, counts and sentence are drawn; the browser\'s numbers are overridden', () => {
  const w = { code: 'nat_mix', trip: 0, heads: 5, foreigners: 2, thai_priced: 3, message: 'SERVER SENTENCE' };
  const { ctx, t0 } = load({ warnings: [w], legacyNat: { th: 99, fr: 99, bad: false, message: 'browser' } });
  const r = ctx.bookingV2NatWarn(t0);
  assert.deepEqual([r.bad, r.th, r.fr, r.thPrice, r.message, r.server], [true, 3, 2, 3, 'SERVER SENTENCE', true]);
});

test('nat_mix: the quote answered with no mix clears the browser\'s red warning', () => {
  const { ctx, t0 } = load({ warnings: [], legacyNat: { th: 1, fr: 4, bad: true, message: 'browser red' } });
  const r = ctx.bookingV2NatWarn(t0);
  assert.equal(r.bad, false);
  assert.equal(r.server, true);
});

test('nat_mix: a warning for another trip index does not apply; a trip the quote did not price keeps legacy', () => {
  const other = { code: 'nat_mix', trip: 1, heads: 5, foreigners: 2, thai_priced: 3, message: 'x' };
  const a = load({ warnings: [other], legacyNat: { bad: true, message: 'browser red' } });
  assert.equal(a.ctx.bookingV2NatWarn(a.t0).bad, false);
  const b = load({ legacyNat: { bad: true, message: 'browser red' } });
  assert.equal(b.ctx.bookingV2NatWarn({ not: 'in the draft' }).message, 'browser red');
});

test('rate type and promo: the trip is priced with the quote\'s rate_type_id / promo_id, not the browser\'s pick', () => {
  const rts = { rt_srv: { id: 'rt_srv', name: 'Server rate' } };
  const { ctx, t0 } = load({ trips: [{ rate_type_id: 'rt_srv', promo_id: 'p9' }], legacyRT: { id: 'rt_browser', __promoId: 'p_browser' }, rts });
  const r = ctx.bookingV2GetRTForTrip(t0);
  assert.equal(r.id, 'rt_srv');
  assert.equal(r.__promoId, 'p9');
});

test('rate type: a quote with no promo drops the browser\'s promo; an unknown rate id falls back to legacy', () => {
  const rts = { rt_srv: { id: 'rt_srv' } };
  const a = load({ trips: [{ rate_type_id: 'rt_srv' }], legacyRT: { id: 'rt_browser', __promoId: 'p_browser' }, rts });
  const r = a.ctx.bookingV2GetRTForTrip(a.t0);
  assert.equal(r.id, 'rt_srv');
  assert.equal(r.__promoId, undefined);
  const b = load({ trips: [{ rate_type_id: 'rt_nope' }], legacyRT: { id: 'rt_browser' }, rts });
  assert.equal(b.ctx.bookingV2GetRTForTrip(b.t0).id, 'rt_browser');
});
