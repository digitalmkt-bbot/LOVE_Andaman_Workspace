// The add-ons section is offered what the server's quote says (add_on_offers), drawn in the section's own option shape;
// legacy's list stands (null) while no answer is held or in legacy mode.
//   node --test test/unit/ops-add-on-offers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync('allotment_v2/js/ops/98-ops-w8-add-on-offers.js', 'utf8');

function load({ enabled = true, offers } = {}) {
  const listeners = [];
  const ctx = { console, JSON, Array, String, Object, ROUTES: [{ id: 'r1', name: 'Similan' }],
    document: { activeElement: null } };
  ctx.window = ctx;
  ctx.laOps = { enabled: () => enabled };
  ctx.laOpsQuote = { answered: () => (offers ? { key: 'k', quote: { add_on_offers: offers } } : null), onAnswer: (fn) => listeners.push(fn) };
  ctx._bkV2 = { newBooking: {} };
  ctx.rendered = 0;
  ctx.bookingV2Render = () => { ctx.rendered += 1; };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { ctx, listeners };
}
const offers = [
  { type: 'longtail-join', kind: 'join', label: 'Longtail Join', amount: 600, locked: false, locked_by: [], routes: [{ route_id: 'r1', adult: 300, child: 200 }] },
  { type: 'longtail-charter', kind: 'charter', label: 'Longtail Charter', amount: 3500, locked: false, locked_by: [], routes: [{ route_id: 'r1', price: 3500, capacity: 6 }] },
  { type: 'transfer-r1-PK-van', kind: 'private-van', label: 'Private Van · Phuket', amount: 1800, locked: false, locked_by: [], route_id: 'r1', zone: 'PK', vehicle: 'van', price: 1800 },
];

test('no answer, or legacy mode: null, so the legacy list stands', () => {
  assert.equal(load().ctx.laOpsAddOnOffers(), null);
  assert.equal(load({ enabled: false, offers }).ctx.laOpsAddOnOffers(), null);
});

test('the server\'s offers become the section\'s options, with the server\'s amounts', () => {
  const opts = load({ offers }).ctx.laOpsAddOnOffers();
  assert.deepEqual(opts.map((o) => [o.type, o.amount]), [['longtail-join', 600], ['longtail-charter', 3500], ['transfer-r1-PK-van', 1800]]);
  assert.equal(opts[0].sub, '฿300/A · ฿200/C');
  assert.equal(opts[1].sub, '฿3500/boat · max 6 pax');
  assert.match(opts[2].sub, /Phuket · Similan · ฿1800\/คัน/);
});

test('a bundle-locked join is locked and names the route', () => {
  const locked = [{ ...offers[0], locked: true, locked_by: ['r1'] }];
  const [o] = load({ offers: locked }).ctx.laOpsAddOnOffers();
  assert.equal(o.locked, true);
  assert.match(o.sub, /Locked.*Similan/);
});

test('a new answer that changes the offers draws the form once; the same offers draw nothing', () => {
  const { ctx, listeners } = load({ offers });
  listeners[0]('k', {}, { add_on_offers: offers });
  listeners[0]('k', {}, { add_on_offers: offers });
  assert.equal(ctx.rendered, 1);
  listeners[0]('k', {}, { add_on_offers: [] });
  assert.equal(ctx.rendered, 2);
});
