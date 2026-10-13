import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// §opsHandoff (2026-10-12) · client side of operation-backend's integration handoff.

test('partial cancel sends waived.count only (the server computes the refund)', () => {
  const src = fs.readFileSync('allotment_v2/js/booking/bookingV2PartialConfirm.js', 'utf8');
  const call = src.slice(src.indexOf("laOpsBookingAction(bookingId, 'partial-cancel'"));
  const body = call.slice(0, call.indexOf("'Reduce pax')"));
  assert.match(body, /waived:\{count:waivedCount\}/);
  assert.doesNotMatch(body, /waived:\{[^}]*amount/);
});

// Runs the change-feed module against a stub and returns the screens it asked to redraw.
async function runFeed({ active, changes }) {
  const repaints = [];
  let calls = 0;
  const window = {
    LA_LEGACY_UNAVAILABLE: true,
    _laRerender: () => repaints.push(active),
  };
  const laOps = {
    enabled: () => true,
    state: { loaded: true },
    get: async () => {
      calls += 1;
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
    setInterval: () => 0, setTimeout: () => 0,
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

test('van bills are not redrawn by the feed (nav would clear open accordions)', async () => {
  assert.deepEqual(await runFeed({ active: 'vanbill', changes: [{ kind: 'van_bill', version: 9 }] }), []);
});
