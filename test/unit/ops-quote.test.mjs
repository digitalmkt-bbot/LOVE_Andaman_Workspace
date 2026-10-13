import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/51-ops-quote.js', 'utf8');
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function runtime({ enabled = true, respond, draft, bookings = [] }) {
  const calls = [], redraws = [];
  const slot = { innerHTML: '', contains: () => false };
  const legacy = (d) => ({ totalSeat: 111, totalAddOn: 0, focDiscount: 0, totalFoc: 2, totalDiscount: 0, totalExtra: 0, base: 111, grandTotal: 111,
    perTrip: (d.trips || []).map(() => ({ total: 111, error: '' })) });
  const ctx = {
    console, Promise, JSON, Object, Array, String, Number, Math, Date, isFinite, setTimeout, clearTimeout,
    document: { getElementById: (id) => (id === 'nbf-review-slot' ? slot : null), activeElement: null },
    _bkV2: { newBooking: draft, editingId: null },
    SB_BOOKINGS: bookings,
  };
  ctx.window = ctx;
  ctx.laOps = {
    enabled: () => enabled,
    post: (path, body) => { calls.push({ path, body: JSON.parse(JSON.stringify(body)) }); return respond(body); },
  };
  ctx.bookingV2CalcQuote = () => legacy(ctx._bkV2.newBooking);
  ctx.bookingV2RenderReviewPanel = () => 'PANEL';
  ctx.bookingV2NbRefreshSide = () => redraws.push('side');
  vm.createContext(ctx);
  vm.runInContext(SOURCE, ctx);
  return { ctx, calls, redraws, slot };
}

const trip = (o = {}) => ({ routeId: 'similan', date: '2026-11-01', zone: 'PK', pax: { ad_fr: 2, chd_fr: 0 }, ...o });
const draft = (o = {}) => ({ agentId: 'a1', priceMode: 'rate', trips: [trip()], addOns: [], adjustments: [], ...o });
const QUOTE = { price_mode: 'rate', seat: 5000, add_on: 300, foc_discount: -1000, discount: -200, extra: 50, total: 5150,
  trips: [{ subtotal: 5000, rate_type_id: 'rt1', promo_id: null, rate_source: 'agent' }], add_ons: [], warnings: [] };

test('buildRequest maps the draft to the quote body', () => {
  const d = draft({ rateTypeRef: 'rt1', bookingDate: '2026-10-13T00:00', adjustments: [{ kind: 'discount', mode: 'percent', value: 5 }, { kind: 'extra', value: 0 }],
    addOns: [{ type: 'longtail-join', qty: 1, jAd: 2, amount: 100 }], trips: [trip({ ovn: 'return', ovnReturnDate: '2026-11-03', ovnCharge: 800 }), trip({ pax: {} })] });
  const { ctx } = runtime({ respond: async () => QUOTE, draft: d });
  const r = ctx.laOpsQuote.buildRequest(d, {});
  assert.equal(JSON.stringify(r.map), "[0]");
  assert.equal(r.body.agentId, 'a1');
  assert.equal(r.body.bookingDate, '2026-10-13');
  assert.equal(r.body.priceMode, 'rate');
  assert.equal(JSON.stringify(r.body.trips[0]), JSON.stringify({ routeId: 'similan', date: '2026-11-01', pax: { ad_fr: 2 }, zone: 'PK', ovn: 'return', ovnReturnDate: '2026-11-03', ovnCharge: 800 }));
  assert.equal(JSON.stringify(r.body.adjustments), JSON.stringify([{ kind: 'discount', mode: 'percent', value: 5 }]));
  assert.equal(JSON.stringify(r.body.addOns), JSON.stringify([{ type: 'longtail-join', qty: 1, jAd: 2, amount: 100 }]));
  assert.equal(r.body.rate, undefined);
});

test('buildRequest: edit sends bookingId and rate, upgrade sends the sold route, manual sends total', () => {
  const d = draft({ priceMode: 'manual', manualTotal: '900', _rtKeep: { mode: 'keep' }, trips: [trip({ routeId: 'surin' })] });
  const { ctx } = runtime({ respond: async () => QUOTE, draft: d });
  const r = ctx.laOpsQuote.buildRequest(d, { editing: { opsId: 'bk-1' }, soldRoute: () => 'similan' });
  assert.equal(r.body.bookingId, 'bk-1'); assert.equal(r.body.rate, 'kept');
  assert.equal(r.body.priceMode, 'manual'); assert.equal(r.body.manualTotal, 900);
  assert.equal(r.body.trips[0].routeId, 'similan');
});

test('buildRequest: no request for B2C, empty trips, or a charter without a boat', () => {
  const { ctx } = runtime({ respond: async () => QUOTE, draft: draft() });
  const B = ctx.laOpsQuote.buildRequest;
  assert.equal(B(draft({ id: 'b2c_9' }), {}), null);
  assert.equal(B(draft({ trips: [trip({ pax: {} })] }), {}), null);
  assert.equal(B(draft({ trips: [trip({ bookingMode: 'charter' })] }), {}), null);
  assert.equal(B(draft({ trips: [trip({ bookingMode: 'charter', charterBoatId: 'b1' })] }), {}).body.trips[0].charterBoatId, 'b1');
});

test('overlay: server numbers replace the legacy ones, signs flipped, FOC count kept', () => {
  const { ctx } = runtime({ respond: async () => QUOTE, draft: draft() });
  const l = { totalSeat: 1, totalAddOn: 2, focDiscount: 3, totalFoc: 2, totalDiscount: 4, totalExtra: 5, base: 3, grandTotal: 9, perTrip: [{ total: 1, error: 'x' }] };
  const o = ctx.laOpsQuote.overlay(l, QUOTE, [0]);
  assert.equal(o.grandTotal, 5150); assert.equal(o.totalSeat, 5000); assert.equal(o.totalAddOn, 300); assert.equal(o.base, 5300);
  assert.equal(o.focDiscount, 1000); assert.equal(o.totalDiscount, 200); assert.equal(o.totalExtra, 50);
  assert.equal(o.totalFoc, 2); assert.equal(o.perTrip[0].total, 5000); assert.equal(o.perTrip[0].error, 'x');
  assert.equal(l.grandTotal, 9, 'legacy object is not mutated');
});

test('first call returns legacy, schedules one debounced POST, then the server number', async () => {
  const d = draft();
  const { ctx, calls, redraws, slot } = runtime({ respond: async () => QUOTE, draft: d });
  assert.equal(ctx.bookingV2CalcQuote().grandTotal, 111);
  ctx.bookingV2CalcQuote(); ctx.bookingV2CalcQuote();
  await tick(450);
  assert.equal(calls.length, 1); assert.equal(calls[0].path, '/v1/quote');
  assert.equal(ctx.bookingV2CalcQuote().grandTotal, 5150);
  assert.equal(slot.innerHTML, 'PANEL'); assert.ok(redraws.length >= 1);
  assert.equal(calls.length, 1, 'cache hit sends nothing');
});

test('server refusal keeps the legacy price and is not retried on every call', async () => {
  const { ctx, calls } = runtime({ respond: async () => { throw new Error('No rate'); }, draft: draft() });
  ctx.bookingV2CalcQuote(); await tick(450);
  assert.equal(ctx.bookingV2CalcQuote().grandTotal, 111);
  ctx.bookingV2CalcQuote(); await tick(450);
  assert.equal(calls.length, 1);
});

test('laOps disabled: legacy only, no request', async () => {
  const { ctx, calls } = runtime({ enabled: false, respond: async () => QUOTE, draft: draft() });
  assert.equal(ctx.bookingV2CalcQuote().grandTotal, 111); await tick(450);
  assert.equal(calls.length, 0);
});

test('a stale answer never overwrites or redraws over a newer draft', async () => {
  const resolvers = [];
  const d = draft();
  const { ctx, calls, redraws } = runtime({ respond: () => new Promise((res) => resolvers.push(res)), draft: d });
  ctx.bookingV2CalcQuote(); await tick(400);                       // request 1 out (pax 2)
  d.trips[0].pax = { ad_fr: 5 };
  ctx.bookingV2CalcQuote(); await tick(400);                       // request 2 out (pax 5)
  assert.equal(calls.length, 2);
  resolvers[1]({ ...QUOTE, total: 9999 }); await tick(5);          // newest answers first
  const redrawn = redraws.length;
  resolvers[0]({ ...QUOTE, total: 1111 }); await tick(5);          // the old one arrives late
  assert.equal(redraws.length, redrawn, 'late old answer does not redraw');
  assert.equal(ctx.bookingV2CalcQuote().grandTotal, 9999);
  d.trips[0].pax = { ad_fr: 2 };                                   // back to request 1's draft: its own answer is right for it
  assert.equal(ctx.bookingV2CalcQuote().grandTotal, 1111);
});

test('an answer for a draft that has since changed does not redraw', async () => {
  const resolvers = [];
  const d = draft();
  const { ctx, redraws } = runtime({ respond: () => new Promise((res) => resolvers.push(res)), draft: d });
  ctx.bookingV2CalcQuote(); await tick(400);
  d.trips[0].pax = { ad_fr: 7 };                                   // edited while in flight, nothing newer fired yet
  resolvers[0](QUOTE); await tick(5);
  assert.equal(redraws.length, 0);
  assert.equal(ctx.bookingV2CalcQuote().grandTotal, 111, 'legacy until the new draft is priced');
});
