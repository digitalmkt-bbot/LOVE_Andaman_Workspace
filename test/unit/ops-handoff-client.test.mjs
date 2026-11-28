import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// §opsHandoff (2026-10-12) · client side of operation-backend's integration handoff.

test('partial cancel sends the typed refund box with the count, as legacy (the server keeps it within 0..its proposal)', () => {
  const src = fs.readFileSync('allotment_v2/js/booking/bookingV2PartialConfirm.js', 'utf8');
  const call = src.slice(src.indexOf("laOpsBookingAction(bookingId, 'partial-cancel'"));
  const body = call.slice(0, call.indexOf("'Reduce pax')"));
  assert.match(body, /waived:\{count:waivedCount, amount:waiveAmt\}/);
  const form = fs.readFileSync('allotment_v2/js/ops/71-ops-booking-form.js', 'utf8');
  assert.doesNotMatch(form, /w\.readOnly = true/, 'the refund box is not made read-only');
});

// Runs the change-feed module against a stub and returns the screens it asked to redraw.
async function runFeed({ active, changes, win = {}, timers = [], gets = [] }) {
  const repaints = [];
  let calls = 0;
  const window = {
    LA_LEGACY_UNAVAILABLE: true,
    _laRerender: () => repaints.push(active),
    ...win,
  };
  const laOps = {
    enabled: () => true,
    state: { loaded: true },
    get: async (path, q) => {
      calls += 1;
      gets.push(q && q.since !== undefined ? 'since' : 'baseline');
      // first call is the baseline (version only); the next returns the changes
      return calls === 1 ? { version: 5, changes: [] } : { version: 9, changes };
    },
    changed: () => {},
    wrote: () => {},
    toast: () => {},
    onChange: () => {},
  };
  window.laOps = laOps;
  const document = {
    hidden: false,
    addEventListener: () => {},
    querySelector: (sel) => (sel === '.nav-item.active' && active ? { dataset: { view: active } } : null),
  };
  const ctx = {
    window, document, console, Promise, Number, Array, String, Object, JSON, Math, Date,
    setInterval: (fn, ms) => { timers.push({ fn, ms }); return 0; }, setTimeout: () => 0,
  };
  vm.runInNewContext(fs.readFileSync('allotment_v2/js/ops/70-ops-changes.js', 'utf8'), ctx);
  const pull = laOps.changes.pull; // exposed by the module when it loads
  await pull();                  // baseline
  await new Promise((r) => setImmediate(r));
  await pull();                  // applies changes
  await new Promise((r) => setImmediate(r));
  return repaints;
}

test('a van change redraws the van screen only while it is open', async () => {
  assert.deepEqual(await runFeed({ active: 'vanjobs', changes: [{ kind: 'van_group', version: 9 }] }), ['vanjobs']);
  assert.deepEqual(await runFeed({ active: 'booking', changes: [{ kind: 'van_group', version: 9 }] }), []);
});

test('a pickup change redraws pickup setup only while it is open', async () => {
  assert.deepEqual(await runFeed({ active: 'pickup-setup', changes: [{ kind: 'pickup_profile', version: 9 }] }), ['pickup-setup']);
  assert.deepEqual(await runFeed({ active: 'vanjobs', changes: [{ kind: 'pickup_area', version: 9 }] }), []);
});

// §ckLiveOps (2026-11-28) · Pier and Land check-in redraw on a change of their day, like Van check-in.
test('a booking change redraws Pier and Land check-in on the day they show', async () => {
  const ch = [{ kind: 'booking', version: 9, route_days: [{ route_id: 'r1', service_date: '2026-11-28' }] }];
  assert.deepEqual(await runFeed({ active: 'piercheckin', changes: ch, win: { _pckDate: '2026-11-28' } }), ['piercheckin']);
  assert.deepEqual(await runFeed({ active: 'landcheckin', changes: ch, win: { _pckDate: '2026-11-28' } }), ['landcheckin']);
  assert.deepEqual(await runFeed({ active: 'vancheckin', changes: ch, win: { _vanCkDate: '2026-11-28' } }), ['vancheckin']);
});

test('a change on another day does not redraw Pier check-in', async () => {
  const ch = [{ kind: 'booking', version: 9, route_days: [{ route_id: 'r1', service_date: '2026-11-29' }] }];
  assert.deepEqual(await runFeed({ active: 'piercheckin', changes: ch, win: { _pckDate: '2026-11-28' } }), []);
});

// legacy §ckLive2: a 2 s check while Pier or Van check-in is open; the 20 s poll stays for the rest.
async function liveTick(active) {
  const timers = [], gets = [];
  await runFeed({ active, changes: [], timers, gets });
  const fast = timers.find((t) => t.ms === 2000);
  assert.ok(fast, 'a 2 s timer is set');
  assert.ok(timers.some((t) => t.ms === 20000), 'the 20 s poll stays');
  const before = gets.length;
  fast.fn();
  await new Promise((r) => setImmediate(r));
  return gets.length - before;
}

test('the 2 s check asks the server only while Pier or Van check-in is open', async () => {
  assert.equal(await liveTick('piercheckin'), 1);
  assert.equal(await liveTick('vancheckin'), 1);
  assert.equal(await liveTick('landcheckin'), 0, 'legacy _laLiveView is Pier and Van only');
  assert.equal(await liveTick('booking'), 0);
});

test('the 2 s check stops while the tab is hidden', () => {
  const src = fs.readFileSync('allotment_v2/js/ops/70-ops-changes.js', 'utf8');
  assert.match(src, /setInterval\(function\(\)\{ if\(!document\.hidden && LIVE_VIEWS\[activeView\(\)\]\) pull\(\); \}, LIVE_MS\)/);
});

test('van bills are not redrawn by the feed (nav would clear open accordions)', async () => {
  assert.deepEqual(await runFeed({ active: 'vanbill', changes: [{ kind: 'van_bill', version: 9 }] }), []);
});

// §ckLiveCalm (2026-11-28) · the changes of one pull redraw the open check-in screen once, not once per change.
test('a page of booking changes redraws Pier check-in once', async () => {
  const ch = [1, 2, 3, 4, 5].map((i) => ({ kind: 'booking', version: 5 + i, route_days: [{ route_id: 'r1', service_date: '2026-11-28' }] }));
  assert.deepEqual(await runFeed({ active: 'piercheckin', changes: ch, win: { _pckDate: '2026-11-28' } }), ['piercheckin']);
});

test('a redraw within the gap waits for a timer instead of drawing again at once', () => {
  const src = fs.readFileSync('allotment_v2/js/ops/70-ops-changes.js', 'utf8');
  assert.match(src, /var DRAW_GAP_MS = 5000/);
  assert.match(src, /if\(wait <= 0\) draw\(\); else drawTimer = setTimeout\(draw, wait\);/);
});
