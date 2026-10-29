// §opsNotYet (ops/96-ops-not-yet.js): the lk features operation-backend does not save yet are refused in ops mode, the rest pass through.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/96-ops-not-yet.js', 'utf8');
const BLOCKED = ['poXferOpen', 'poXferSave', 'poXferRecvOpen', 'poXferRecvSave', 'poXferCancel',
  'flEqChoose', 'flEqLinkPair', 'flEqQuickLink', 'flEqTakeOut'];

function boot(enabled) {
  const calls = [], alerts = [], box = { checked: true };
  const ctx = { alert: (m) => alerts.push(m), document: { getElementById: (id) => (id === 'bkv2-ovnbb-2' ? box : null) }, laOps: { enabled: () => enabled } };
  ctx.window = ctx;
  for (const n of [...BLOCKED, 'cxwBanner', 'cxwDetailCard', 'cxwTabBadge', 'tcxDlgSet', 'bookingV2SetTripField', 'ctRentSet', 'ctRender']) ctx[n] = (...a) => { calls.push([n, ...a]); return n === 'cxwBanner' || n === 'cxwDetailCard' ? '<div class="cxw-bar">' : n === 'cxwTabBadge' ? '<span>3</span>' : 'orig'; };
  vm.runInNewContext(SOURCE, ctx);
  return { ctx, calls, alerts, box };
}

test('in ops mode each blocked feature says it is not available and never reaches the legacy save', () => {
  const { ctx, calls, alerts } = boot(true);
  for (const n of BLOCKED) assert.equal(ctx[n]('x'), false, n);
  assert.equal(calls.length, 0, 'no legacy function ran');
  assert.equal(alerts.length, BLOCKED.length);
  assert.ok(alerts.every((m) => /is not available yet: operation-backend does not save it/.test(m)));
  assert.equal(ctx.cxwBanner(), '<div class="cxw-bar">', 'the cancel-reason banner is drawn again: it saves (41-ops-cancel-reason.js)');
  assert.equal(ctx.cxwDetailCard({ id: 'b1' }), '<div class="cxw-bar">', 'and the booking-detail card');
  assert.equal(ctx.cxwTabBadge(), '<span>3</span>', 'and the Cancellations tab count (§cxwTab)');
});

test('§rentDay: only the daily-rate fields of a rented boat are refused; the page is redrawn to put the box back', () => {
  const { ctx, calls, alerts } = boot(true);
  assert.equal(ctx.ctRentSet('b1', 'day.rt.r1', '5000'), false);
  assert.equal(ctx.ctRentSet('b1', 'day.on', true), false);
  assert.equal(ctx.ctRentSet('b1', 'amt', '90000'), 'orig');
  assert.deepEqual(calls, [['ctRender'], ['ctRender'], ['ctRentSet', 'b1', 'amt', '90000']]);
  assert.equal(alerts.length, 2);
});

test('Send to partner (27-ops-weather.js) and the boat-back box (ovn_boat_back, migration 580) save now: both pass through', () => {
  const { ctx, calls, alerts, box } = boot(true);
  assert.equal(ctx.tcxDlgSet('out', 'partner'), 'orig');
  assert.equal(ctx.tcxDlgSet('out', 'move'), 'orig');
  assert.equal(ctx.tcxDlgSet('note', 'partner'), 'orig');
  assert.equal(ctx.bookingV2SetTripField(2, 'ovnBoatBack', 1), 'orig');
  assert.equal(box.checked, true, 'the box stays ticked');
  assert.deepEqual(calls, [['tcxDlgSet', 'out', 'partner'], ['tcxDlgSet', 'out', 'move'], ['tcxDlgSet', 'note', 'partner'], ['bookingV2SetTripField', 2, 'ovnBoatBack', 1]]);
  assert.equal(alerts.length, 0);
  assert.doesNotMatch(SOURCE, /'ovnBoatBack'/);
});

test('outside ops mode (lk-inbox itself) everything is the legacy function', () => {
  const { ctx, calls, alerts } = boot(false);
  for (const n of BLOCKED) assert.equal(ctx[n]('x'), 'orig', n);
  assert.equal(ctx.cxwBanner(), '<div class="cxw-bar">');
  assert.equal(ctx.tcxDlgSet('out', 'partner'), 'orig');
  assert.equal(ctx.bookingV2SetTripField(0, 'ovnBoatBack', 1), 'orig');
  assert.equal(alerts.length, 0);
  assert.equal(ctx.ctRentSet('b1', 'day.on', true), 'orig');
  assert.equal(calls.length, BLOCKED.length + 4);
});
