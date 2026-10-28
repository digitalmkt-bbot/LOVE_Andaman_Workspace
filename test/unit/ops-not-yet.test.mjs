// §opsNotYet (ops/96-ops-not-yet.js): the lk features operation-backend does not save yet are refused in ops mode, the rest pass through.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/96-ops-not-yet.js', 'utf8');
const BLOCKED = ['cxwOpen', 'cxwSave', 'tcxPtSet', 'tcxPtPickName', 'tcxPtVan', 'tcxPtApply', 'tcxPtUndo', 'flnWdAdd'];

function boot(enabled) {
  const calls = [], alerts = [], box = { checked: true };
  const ctx = { alert: (m) => alerts.push(m), document: { getElementById: (id) => (id === 'bkv2-ovnbb-2' ? box : null) }, laOps: { enabled: () => enabled } };
  ctx.window = ctx;
  for (const n of [...BLOCKED, 'cxwBanner', 'cxwDetailCard', 'tcxDlgSet', 'bookingV2SetTripField']) ctx[n] = (...a) => { calls.push([n, ...a]); return n === 'cxwBanner' || n === 'cxwDetailCard' ? '<div class="cxw-bar">' : 'orig'; };
  vm.runInNewContext(SOURCE, ctx);
  return { ctx, calls, alerts, box };
}

test('in ops mode each blocked feature says it is not available and never reaches the legacy save', () => {
  const { ctx, calls, alerts } = boot(true);
  for (const n of BLOCKED) assert.equal(ctx[n]('x'), false, n);
  assert.equal(calls.length, 0, 'no legacy function ran');
  assert.equal(alerts.length, BLOCKED.length);
  assert.ok(alerts.every((m) => /is not available yet: operation-backend does not save it/.test(m)));
  assert.equal(ctx.cxwBanner(), '', 'the cancel-reason banner is not drawn');
  assert.equal(ctx.cxwDetailCard({ id: 'b1' }), '', 'nor the booking-detail card');
});

test("only the partner result and a ticked boat-back box are refused; their neighbours pass through", () => {
  const { ctx, calls, alerts, box } = boot(true);
  assert.equal(ctx.tcxDlgSet('out', 'partner'), false);
  assert.equal(ctx.tcxDlgSet('out', 'move'), 'orig');
  assert.equal(ctx.tcxDlgSet('note', 'partner'), 'orig', 'only the result choice');
  assert.equal(ctx.bookingV2SetTripField(2, 'ovnBoatBack', 1), false);
  assert.equal(box.checked, false, 'the box is unticked again');
  assert.equal(ctx.bookingV2SetTripField(2, 'ovnBoatBack', 0), 'orig', 'unticking still saves');
  assert.equal(ctx.bookingV2SetTripField(2, 'ovnReturnDate', '2026-11-02'), 'orig');
  assert.deepEqual(calls, [['tcxDlgSet', 'out', 'move'], ['tcxDlgSet', 'note', 'partner'], ['bookingV2SetTripField', 2, 'ovnBoatBack', 0], ['bookingV2SetTripField', 2, 'ovnReturnDate', '2026-11-02']]);
  assert.equal(alerts.length, 2);
});

test('§poXfer is no longer refused here: 48-ops-pier-office.js sends it to operation-backend', () => {
  const XFER = ['poXferOpen', 'poXferSave', 'poXferRecvOpen', 'poXferRecvSave', 'poXferCancel'];
  const alerts = [], ctx = { alert: (m) => alerts.push(m), document: { getElementById: () => null }, laOps: { enabled: () => true } };
  ctx.window = ctx;
  for (const n of XFER) ctx[n] = () => 'adapter';
  vm.runInNewContext(SOURCE, ctx);
  for (const n of XFER) assert.equal(ctx[n]('x'), 'adapter', n);
  assert.deepEqual(alerts, []);
});

test('outside ops mode (lk-inbox itself) everything is the legacy function', () => {
  const { ctx, calls, alerts } = boot(false);
  for (const n of BLOCKED) assert.equal(ctx[n]('x'), 'orig', n);
  assert.equal(ctx.cxwBanner(), '<div class="cxw-bar">');
  assert.equal(ctx.tcxDlgSet('out', 'partner'), 'orig');
  assert.equal(ctx.bookingV2SetTripField(0, 'ovnBoatBack', 1), 'orig');
  assert.equal(alerts.length, 0);
  assert.equal(calls.length, BLOCKED.length + 3);
});
