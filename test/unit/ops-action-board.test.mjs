// Action Board (js/ops/52-ops-action-board.js): loads the board's windows from
// operation-backend — trips today → +13, bookings created this month and last
// month — before the legacy abRender sums SB_BOOKINGS.
//   node --test test/unit/ops-action-board.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/52-ops-action-board.js', 'utf8');

function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function shift(ds, n) {
  const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d);
}

function load({ enabled = true, range, created, view = 'actionboard' } = {}) {
  const host = { innerHTML: '', firstChild: null };
  const calls = [];
  const ctx = {
    console, Promise, Date, String, Error,
    TODAY_STR: '2026-10-14',
    document: { getElementById: (id) => (id === 'ab-wrap' ? host : null) },
    abRender() { calls.push({ render: true }); host.innerHTML = 'BOARD'; host.firstChild = {}; },
    bookingV2EnsureOpsRange(opt) { calls.push({ range: opt }); return range ? range(opt) : null; },
    bookingV2OpsEnsureCreated(from, to) { calls.push({ created: [from, to] }); return created ? created(from, to) : null; },
  };
  ctx.window = ctx;
  ctx.laOps = {
    enabled: () => enabled,
    today: () => '2026-10-14',
    ymd, shift,
    activeView: () => view,
    loadingHtml: (label) => 'SPIN:' + label,
  };
  vm.createContext(ctx);
  vm.runInContext(SOURCE, ctx);
  return { ctx, host, calls };
}

test('loads trips today → +13 and the current + previous creation months, then draws once', async () => {
  const releases = [];
  const pend = () => new Promise((r) => releases.push(r));
  const { ctx, host, calls } = load({ range: pend, created: pend });
  const p = ctx.abRender();
  const range = calls.find((c) => c.range).range;
  assert.deepEqual([range.from, range.to], ['2026-10-14', '2026-10-27']);
  const createdRanges = calls.filter((c) => c.created).map((c) => c.created);
  assert.deepEqual(createdRanges, [['2026-10-01', '2026-10-14'], ['2026-09-01', '2026-09-30']]);
  assert.match(host.innerHTML, /^SPIN:/);
  assert.ok(!calls.some((c) => c.render));
  releases.forEach((r) => r({ bookings: [] }));
  await p;
  assert.equal(calls.filter((c) => c.render).length, 1);
  assert.equal(host.innerHTML, 'BOARD');
});

test('ranges already in memory draw straight away', () => {
  const { ctx, host, calls } = load();           // every ensure returns null = cached
  ctx.abRender();
  assert.equal(host.innerHTML, 'BOARD');
  assert.equal(calls.filter((c) => c.render).length, 1);
});

test('a failed load still draws (honest partial), with a warning', async () => {
  const { ctx, calls } = load({ range: () => Promise.resolve(null), created: () => Promise.resolve(null) });
  await ctx.abRender();
  assert.equal(calls.filter((c) => c.render).length, 1);
});

test('leaving the page mid-load hands the screen to the next view', async () => {
  let release;
  const { ctx, calls } = load({ range: () => new Promise((r) => { release = r; }), view: 'dashboard' });
  const p = ctx.abRender();
  release({ bookings: [] });
  await p;
  assert.ok(!calls.some((c) => c.render));
});

test('legacy mode calls the original untouched', () => {
  const { ctx, calls } = load({ enabled: false });
  ctx.abRender();
  assert.deepEqual(calls, [{ render: true }]);
});
