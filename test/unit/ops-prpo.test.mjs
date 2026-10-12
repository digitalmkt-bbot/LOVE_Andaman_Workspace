// PR/PO Dashboard (js/ops/41-ops-prpo.js): loads its date range from operation-backend
// before the legacy renderPrPo counts SB_BOOKINGS.
//   node --test test/unit/ops-prpo.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/41-ops-prpo.js', 'utf8');

function load({ enabled = true, ensure } = {}) {
  const host = { innerHTML: '' };
  const calls = [];
  const ctx = {
    console, Promise, Date, String, Error,
    document: { getElementById: (id) => (id === 'prpo-host' ? host : null) },
    _ppFrom: '2026-10-13', _ppTo: '2026-10-19',
    renderPrPo() { calls.push({ render: [ctx._ppFrom, ctx._ppTo] }); host.innerHTML = 'TABLE'; },
    ppUpdatedAt() { return { when: 'legacy', by: '', live: false }; },
    bookingV2EnsureOpsRange(opt) { calls.push({ ensure: opt }); return ensure ? ensure(opt) : null; },
  };
  ctx.window = ctx;
  ctx.laOps = {
    enabled: () => enabled,
    onWrite: () => {},
    loadingHtml: (label) => 'SPIN:' + label,
    fail: (title) => calls.push({ fail: title }),
  };
  vm.createContext(ctx);
  vm.runInContext(SOURCE, ctx);
  return { ctx, host, calls };
}

test('loads the selected range, shows a spinner, then draws and stamps it live', async () => {
  let release;
  const { ctx, host, calls } = load({ ensure: () => new Promise((r) => { release = r; }) });
  const p = ctx.renderPrPo();
  assert.deepEqual([calls[0].ensure.from, calls[0].ensure.to], ['2026-10-13', '2026-10-19']);
  assert.match(host.innerHTML, /^SPIN:/);
  release({ bookings: [] });
  await p;
  assert.deepEqual([...calls[1].render], ['2026-10-13', '2026-10-19']);
  assert.equal(ctx.ppUpdatedAt().live, true);
});

test('a range already in memory draws straight away', () => {
  const { ctx, host, calls } = load({ ensure: () => null });
  ctx.renderPrPo();
  assert.equal(host.innerHTML, 'TABLE');
  assert.equal(calls.length, 2);
  assert.equal(ctx.ppUpdatedAt().live, true);
});

test('a failed load shows an error, not an empty dashboard', async () => {
  const { ctx, host, calls } = load({ ensure: () => Promise.resolve(null) });
  await ctx.renderPrPo();
  assert.ok(calls.some((c) => c.fail));
  assert.ok(!calls.some((c) => c.render));
  assert.match(host.innerHTML, /did not load/);
  assert.equal(ctx.ppUpdatedAt().live, false);
});

test('a range changed mid-load leaves the screen to the newer render', async () => {
  let release;
  const { ctx, calls } = load({ ensure: () => new Promise((r) => { release = r; }) });
  const p = ctx.renderPrPo();
  ctx._ppTo = '2026-10-13';
  release({ bookings: [] });
  await p;
  assert.ok(!calls.some((c) => c.render));
});

test('legacy mode calls the original untouched', () => {
  const { ctx, calls } = load({ enabled: false });
  ctx.renderPrPo();
  assert.equal(calls.length, 1);
  assert.deepEqual([...calls[0].render], ['2026-10-13', '2026-10-19']);
});
