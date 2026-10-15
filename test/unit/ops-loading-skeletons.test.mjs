import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const CORE = fs.readFileSync('allotment_v2/js/ops/00-ops-core.js', 'utf8');
const LOADER = fs.readFileSync('allotment_v2/js/booking/bookingV2LoadFromOpsBackend.js', 'utf8');
const REPORTS = fs.readFileSync('allotment_v2/js/ops/33-ops-money-reports.js', 'utf8');

function baseCtx(extra = {}) {
  const ctx = {
    console, Promise, Error, JSON, Object, Array, Number, String, Math, Date, parseInt, isNaN, setTimeout, clearTimeout, encodeURIComponent,
    LA_LEGACY_UNAVAILABLE: true,
    sessionStorage: { getItem: () => 'tok' },
    document: { getElementById: () => null, activeElement: null, querySelector: () => null },
    ...extra,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  return ctx;
}
const tick = () => new Promise((r) => setTimeout(r, 0));

// ── booking calendar · month status ──────────────────────────────────────────
function loader() {
  const pending = [];
  const renders = { n: 0 };
  const ctx = baseCtx({
    SB_BOOKINGS: [],
    bookingV2FromOpsBooking: (b) => b,
    bookingV2Render: () => { renders.n++; },
  });
  // each fetch waits until the test settles it: ok(bookings) or fail()
  ctx.laOpsFetch = () => new Promise((resolve, reject) => pending.push({
    ok: (bookings) => resolve({ ok: true, json: async () => ({ bookings, next_cursor: null }) }),
    fail: () => reject(new Error('network down')),
  }));
  vm.runInContext(LOADER, ctx);
  return { ctx, pending, renders };
}

test('calendar month: loading until the first load lands, then ready', async () => {
  const { ctx, pending } = loader();
  assert.equal(ctx.bookingV2OpsMonthStatus('2026-11'), '');
  const load = ctx.bookingV2OpsEnsureMonth('2026-11');
  assert.ok(load, 'first visit starts a load');
  assert.equal(ctx.bookingV2OpsMonthStatus('2026-11'), 'loading');
  pending.shift().ok([{ id: 'b1' }]);
  await load;
  assert.equal(ctx.bookingV2OpsMonthStatus('2026-11'), '');
  assert.equal(ctx.SB_BOOKINGS.length, 1);
});

test('calendar month: a refetch after a write keeps showing data (no skeleton flash)', async () => {
  const { ctx, pending } = loader();
  const first = ctx.bookingV2OpsEnsureMonth('2026-11');
  pending.shift().ok([{ id: 'b1' }]);
  await first;
  vm.runInContext('_opsBookingRanges = Object.create(null)', ctx);   // what the write hook does
  const again = ctx.bookingV2OpsEnsureMonth('2026-11');
  assert.ok(again, 'the invalidated month refetches');
  assert.equal(ctx.bookingV2OpsMonthStatus('2026-11'), '', 'seen before → not "loading"');
  pending.shift().ok([{ id: 'b1' }]);
  await again;
});

test('calendar month: a failed load reports failed until Retry, then loads again', async () => {
  const { ctx, pending, renders } = loader();
  const load = ctx.bookingV2OpsEnsureMonth('2026-12');
  pending.shift().fail();
  assert.equal(await load, null);
  assert.equal(ctx.bookingV2OpsMonthStatus('2026-12'), 'failed');
  ctx.bookingV2OpsRetryMonth('2026-12');
  assert.equal(renders.n, 1, 'Retry redraws');
  assert.equal(ctx.bookingV2OpsMonthStatus('2026-12'), '');
  const retry = ctx.bookingV2OpsEnsureMonth('2026-12');
  assert.equal(ctx.bookingV2OpsMonthStatus('2026-12'), 'loading', 'never loaded → skeleton again');
  pending.shift().ok([]);
  await retry;
  assert.equal(ctx.bookingV2OpsMonthStatus('2026-12'), '');
});

test('calendar month: reset cache forgets seen months', async () => {
  const { ctx, pending } = loader();
  const load = ctx.bookingV2OpsEnsureMonth('2026-11');
  pending.shift().ok([]);
  await load;
  ctx.bookingV2OpsResetCache();
  ctx.bookingV2OpsEnsureMonth('2026-11');
  assert.equal(ctx.bookingV2OpsMonthStatus('2026-11'), 'loading');
});

// ── laOps.skeletonHtml ───────────────────────────────────────────────────────
test('skeletonHtml: shape follows the options and the label is escaped', () => {
  const ctx = baseCtx();
  vm.runInContext(CORE, ctx);
  const html = ctx.laOps.skeletonHtml({ kpis: 6, panels: 3, rows: 4, cols: 5, label: '<b>Loading</b>' });
  assert.equal((html.match(/class="la-skel-card"/g) || []).length, 6 + 3);
  assert.equal((html.match(/class="la-skel-tr"/g) || []).length, 4);
  assert.match(html, /role="status"/);
  assert.match(html, /&#60;b&#62;Loading/);
  assert.doesNotMatch(html, /<b>Loading/);
  assert.doesNotMatch(ctx.laOps.skeletonHtml({ rows: 0 }), /la-skel-table/);
});

// ── Accounting · report + invoices load together, page draws once ────────────
function accounting({ moneyLoaded = false, moneyFails = false } = {}) {
  const host = { innerHTML: '', history: [] };
  Object.defineProperty(host, 'firstElementChild', { get: () => ({ set outerHTML(v) { host.innerHTML = v + host.innerHTML.replace(/^<div data-legacy-kpis>.*?<\/div>/, ''); } }) });
  const legacy = { n: 0 };
  const ctx = baseCtx({
    renderAccounting: () => { legacy.n++; host.innerHTML = '<div data-legacy-kpis>browser sums</div><table>invoices</table>'; },
  });
  ctx.document.getElementById = (id) => (id === 'acct-body' ? host : null);
  ctx.laOpsFetch = async (path) => {
    assert.match(path, /^\/v1\/reports\/accounting/);
    const body = { outstanding: 1200, paid_this_month: 300, credit_exposure: 0, overdue_invoices: 1, deposits_held: 0, extras_this_month: 0 };
    return { status: 200, ok: true, text: async () => JSON.stringify(body) };
  };
  vm.runInContext(CORE, ctx);
  ctx.laOps.toast = () => {};
  let loaded = moneyLoaded;
  ctx.laOps.money = {
    loaded: () => loaded,
    ensureLoaded: () => (moneyFails ? Promise.reject(new Error('invoices down')) : Promise.resolve(true).then(() => { loaded = true; })),
  };
  vm.runInContext(REPORTS, ctx);
  return { ctx, host, legacy };
}

test('accounting: skeleton first, then one render with the server KPIs on top', async () => {
  const { ctx, host, legacy } = accounting();
  const p = ctx.renderAccounting();
  assert.match(host.innerHTML, /la-skel-wrap/);
  await p;
  assert.equal(legacy.n, 1, 'the legacy page draws once, after both loads');
  assert.match(host.innerHTML, /data-ops-money-kpis/);
  assert.doesNotMatch(host.innerHTML, /browser sums/);
  assert.match(host.innerHTML, /invoices/);
});

test('accounting: both loaded → draws straight away, no skeleton', () => {
  const { ctx, host } = accounting({ moneyLoaded: true });
  return ctx.renderAccounting().then(() => {
    ctx.renderAccounting();
    assert.doesNotMatch(host.innerHTML, /la-skel/);
    assert.match(host.innerHTML, /data-ops-money-kpis/);
  });
});

test('accounting: invoices failing shows the invoices error, not a stuck skeleton', async () => {
  const { ctx, host, legacy } = accounting({ moneyFails: true });
  await ctx.renderAccounting();
  await tick();
  assert.equal(legacy.n, 0);
  assert.match(host.innerHTML, /Invoices did not load/);
});
