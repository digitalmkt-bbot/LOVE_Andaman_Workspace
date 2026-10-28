// §ovnBoatBack · a charter overnight whose boat goes back to the pier between its two days travels to and from the
// server's trips[].ovn_boat_back (operation-backend migration 580). Legacy keeps it as ovnOf 'boatback' on the outbound
// (bookingV2CommitBooking), the form as t.ovnBoatBack (bookingV2EditBooking); bkOvnBoatBack reads either.
//   node --test test/unit/ops-ovn-boat-back.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync(process.env.BOOKINGS_SRC || 'allotment_v2/js/ops/40-ops-bookings.js', 'utf8');
// legacy's own reader, as shipped (08-app.js), so the shape fromServer builds is checked against what the hold/heal code reads
const APP = fs.readFileSync('allotment_v2/js/08-app.js', 'utf8');
const bkOvnBoatBack = vm.runInNewContext(`(${/function bkOvnBoatBack\(t\)\{[^\n]*\}/.exec(APP)[0]})`);

function load() {
  const ctx = { console, Promise, Date, JSON, Math, Object, Array, String, Number, Error, RegExp, Set, Map, parseInt, parseFloat, isNaN, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [] },
    sessionStorage: { getItem: () => null, setItem() {} }, localStorage: { getItem: () => null, setItem() {} },
    SB_BOOKINGS: [] };
  ctx.window = ctx;
  ctx.laOps = new Proxy({ enabled: () => true }, { get: (t, k) => (k in t ? t[k] : () => null) });
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return ctx;
}
const out = (over) => Object.assign({ routeId: 'r1', date: '2026-11-01', pickupTime: '', pax: { ad_fr: 4 }, bookingMode: 'charter', charterBoatId: 'bA', ovn: 'return', ovnReturnDate: '2026-11-04' }, over);
const leg = (over) => Object.assign({ routeId: 'r1', date: '2026-11-04', pickupTime: '', pax: { ad_fr: 4 }, bookingMode: 'charter', charterBoatId: 'bA', ovnLeg: true, ovnOf: 0 }, over);
const sent = (ctx, trips) => ctx.laOps.bookings.toServer({ id: 'B1', status: 'confirmed', leadPax: 'A', trips, passengers: [] }, true).trips;

test('toServer: a saved outbound (ovnOf boatback) or a ticked form box sends ovnBoatBack; the leg never does', () => {
  const ctx = load();
  const [o, l] = sent(ctx, [out({ ovnOf: 'boatback' }), leg()]);
  assert.equal(o.ovnBoatBack, true);
  assert.equal(o.ovnOf, undefined, "'boatback' is not an index: never sent as ovnOf");
  assert.equal(l.ovnBoatBack, undefined);
  assert.equal(l.ovnOf, 0);
  assert.equal(sent(ctx, [out({ ovnBoatBack: 1 }), leg()])[0].ovnBoatBack, true, 'the form tick');
});

test('toServer: an unticked box wins over a stale ovnOf, and a trip it does not apply to sends nothing (the server would 400)', () => {
  const ctx = load();
  assert.equal(sent(ctx, [out({ ovnBoatBack: 0, ovnOf: 'boatback' }), leg()])[0].ovnBoatBack, undefined, 'unticked in the form: cleared on the server (a trip is sent whole)');
  assert.equal(sent(ctx, [out({})])[0].ovnBoatBack, undefined, 'a plain overnight');
  assert.equal(sent(ctx, [out({ bookingMode: 'seat', ovnBoatBack: 1 })])[0].ovnBoatBack, undefined, 'a seat trip');
  assert.equal(sent(ctx, [out({ ovn: 'self', ovnReturnDate: '', ovnBoatBack: 1 })])[0].ovnBoatBack, undefined, 'they make their own way back');
});

test("fromServer: ovn_boat_back comes back as legacy's ovnOf 'boatback' on the outbound, which bkOvnBoatBack reads", () => {
  const ctx = load();
  const st = (first) => ({ id: 'ob_1', status: 'confirmed', passengers: [], trips: [
    Object.assign({ id: 't1', route_id: 'r1', service_date: '2026-11-01', booking_mode: 'charter', charter_boat_id: 'bA', ovn: 'return', ovn_return_date: '2026-11-04', pax: { ad_fr: 4 } }, first),
    { id: 't2', route_id: 'r1', service_date: '2026-11-04', booking_mode: 'charter', charter_boat_id: 'bA', ovn_leg: true, ovn_of: 0, pax: { ad_fr: 4 } }] });
  const got = ctx.laOps.bookings.fromServer(st({ ovn_boat_back: true }));
  assert.equal(got.trips[0].ovnOf, 'boatback');
  assert.equal(got.trips[1].ovnOf, 0, 'the leg still points at its outbound');
  assert.equal(bkOvnBoatBack(got.trips[0]), true);
  assert.equal(bkOvnBoatBack(got.trips[1]), false);
  const plain = ctx.laOps.bookings.fromServer(st({}));
  assert.equal(plain.trips[0].ovnOf, null);
  assert.equal(bkOvnBoatBack(plain.trips[0]), false);
  // and round trip: what was read is what is sent back
  assert.equal(sent(ctx, [Object.assign(got.trips[0], { pickupTime: '' }), Object.assign(got.trips[1], { pickupTime: '' })])[0].ovnBoatBack, true);
});
