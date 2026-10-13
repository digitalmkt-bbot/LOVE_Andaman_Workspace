import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const eq = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);
const SOURCE = fs.readFileSync('allotment_v2/js/ops/44-ops-costing-pl.js', 'utf8');

function load(opts = {}) {
  const calls = [];
  const writes = [];
  const O = {
    enabled: () => opts.enabled !== false,
    today: () => '2026-10-13',
    onWrite: () => {},
    wrote: (k) => writes.push(k),
    fail: () => {},
    loadingHtml: () => 'loading',
    get: (p, q) => { calls.push(['GET', p, q]); return Promise.resolve((opts.get || (() => ({})))(p, q)); },
    post: (p, b) => { calls.push(['POST', p, b]); return Promise.resolve((opts.post || (() => ({})))(p, b)); },
    patch: (p, b) => { calls.push(['PATCH', p, b]); return Promise.resolve({}); },
    del: (p) => { calls.push(['DELETE', p]); return Promise.resolve(null); },
    call: (m, p, b) => { calls.push([m, p, b]); return Promise.resolve((opts.call || (() => ({})))(m, p, b)); },
    queue: (fn) => Promise.resolve().then(fn),
  };
  const window = { laOps: O, _px: { date: '2026-10-12', pier: '', tab: 'd', an: 47, mon: '2026-10' }, _ct: { pid: '' } };
  window.ctRead = () => 'legacy-read';
  window.ctWrite = () => { calls.push(['legacy-write']); };
  window.renderTripPL = () => {};
  window.ctRender = () => {};
  window.pxDay = () => 'legacy-day';
  window.pxTrip = () => 'legacy-trip';
  window.pxDayAgg = () => 'legacy-agg';
  window.pxAnalysis = () => 'legacy-analysis';
  window.pxClose = () => 'legacy-close';
  window.pxRan = () => 'legacy-ran';
  const ctx = { window, console, document: { getElementById: () => null }, Number, String, Object, Array, JSON, Date, Promise, Math, encodeURIComponent, setTimeout, confirm: () => true };
  vm.runInNewContext(SOURCE, ctx);
  return { window, calls, writes, c: window.__laOpsCostingCompat };
}

const serverTrip = {
  date: '2026-10-12', boat_id: 'b1', name: 'Boat One', route_id: 'r1', route_name: 'Phi Phi', route_color: '#123456', pier: 'panwa', departs: '08:00',
  status: 'part', pax: { ad: 10, chd: 2, inf: 1, foc: 0, total: 13, th: 3, fr: 10, bookings: 4, revenue: 26000 }, capacity: 60,
  revenue_gross: 26000, upsell: { rows: [{ voucher: 'V1', label: 'Upgrade', sell: 500, company: 400, commission: 100, seller: 'x', collected: true, kind: 'upgrade' }], sell: 500, company: 400, commission: 100 },
  revenue: 24300, cost: 20000, profit: 4300, would_cost: 20000, no_sail: false, ran: false, closed: null, actual_lines: 1,
  fuel_price: { price: 45, src: 'boat', from: '' }, fuel_litres: 300, plan: { id: 'p1', name: 'Plan' }, engines: '3EN', longtail: { charter: 1, join: 2, upgrades: 0, upgrades_due: 0 },
  vans: [], break_even: 22, check_revenue: false,
  rows: [
    { id: 'fuel', group: 'Fuel', label: 'Fuel', vat: true, estimate: 9000, actual: 8500, use: 8500, gross: 9100, source: 'actual', why: '300 L' },
    { id: 'meal', group: 'Food', label: 'Meal', vat: false, estimate: 3000, actual: null, use: 3000, gross: null, source: 'pending', why: 'waiting' },
    { id: 'park', group: 'Park', label: 'Park', vat: false, estimate: 8500, actual: null, use: 8500, gross: null, source: 'formula', why: '' },
  ],
};

test('server trip maps to the legacy trip shape the renderers read', () => {
  const { c } = load();
  const t = c.legacyTrip(serverTrip);
  assert.equal(t.bid, 'b1');
  assert.equal(t.px.tot, 13);
  assert.equal(t.px.bk, 4);
  assert.equal(t.rev, 24300);
  assert.equal(t.revGross, 26000);
  assert.equal(t.profit, 4300);
  assert.equal(t.st, 'part');
  assert.equal(t.be, 22);
  assert.equal(t.rows[0].src, 'r');
  assert.equal(t.rows[1].src, 'w');
  assert.equal(t.rows[2].src, 'f');
  assert.equal(t.rows[0].real, 8500);
  assert.equal(t.rows[1].real, null);
  assert.equal(t.up.company, 400);
  assert.equal(t.lt.chtr, 1);
  assert.equal(t.route.pier, 'panwa');
  assert.equal(t.closed, false);
});

test('day aggregate is built from server trips, month totals fill the previous period', () => {
  const { c } = load();
  const a = c.aggFromTrips('2026-10-12', [serverTrip, { ...serverTrip, boat_id: 'b2', profit: -100, revenue: 100, cost: 200 }]);
  assert.equal(a.trips, 2);
  assert.equal(a.loss, 1);
  assert.equal(a.cap, 120);
  assert.equal(a.routes.r1.n, 2);
  assert.equal(a.groups.Fuel, 17000);
  const m = c.aggFromTotals('2026-09-12', { trips: 3, revenue: 900, cost: 400, profit: 500, pax: 30, bookings: 8, loss_trips: 1, capacity: 150 });
  assert.equal(m.rev, 900);
  assert.equal(m.profit, 500);
  assert.equal(m.bk, 8);
  assert.equal(m.cap, 150);
});

test('template, plan and rent round-trip between server and legacy shapes', () => {
  const { c } = load();
  const tpl = c.templateFromServer({ vat_rate: 7, dropped: ['snk'], lines: [
    { id: 'fuel', group: 'Fuel', label: 'Fuel', vat: true, on_demand: false, on_demand_qty: null, parts: [{ kind: 'fix', per: 'boat', qty: 360, qty_4en: 520, fuel: true }] },
    { id: 'van', group: 'Van', label: 'Van', vat: false, on_demand: true, on_demand_qty: 100, parts: [{ kind: 'var', unit: 130, unit_th: 100 }] },
  ] });
  assert.equal(tpl.vatRate, 7);
  eq(tpl.lines[0].parts[0], { k: 'fix', per: 'boat', q: 360, q4: 520, fuel: true });
  assert.equal(tpl.lines[1].od, 1);
  assert.equal(tpl.lines[1].odQ, 100);
  const body = c.templateToServer(tpl);
  assert.equal(body.vat_rate, 7);
  eq(body.lines[0].parts[0], { kind: 'fix', per: 'boat', qty: 360, qty_4en: 520, fuel: true });
  assert.equal(body.lines[1].on_demand, true);
  assert.equal(body.lines[1].on_demand_qty, 100);
  assert.equal(body.lines[1].parts[0].unit_th, 100);
  assert.equal(body.lines[0].on_demand_qty, null);

  const plan = c.planFromServer({ id: 'p1', name: 'Phi Phi', route_key: 'r1', note: null, engines: '4EN', boats: 2, capacity: 70, pax: 30, pax_th: 5, price: 2500, price_child: null,
    child_pct: 50, commission_pct: 10, fuel_price: 45, boat_id: 'b9', rent_off: true,
    overrides: { fuel: { off: true, parts: [{ qty: 400 }, null] } }, groups: { Food: { pct: 20 } }, on_demand: { van: { agent_qty: 10 } }, itinerary: [], tiers: [] });
  assert.equal(plan.famId, 'r1');
  assert.equal(plan.eng, '4EN');
  assert.equal(plan.priceCh, '');
  assert.equal(plan.rentOff, 1);
  eq(plan.ovr.fuel, { off: 1, p: [{ q: 400 }, {}] });
  assert.equal(plan.od.van.aQ, 10);
  const pb = c.planToServer(plan);
  assert.equal(pb.route_key, 'r1');
  assert.equal(pb.engines, '4EN');
  assert.equal(pb.price_child, null);
  assert.equal(pb.rent_off, true);
  assert.equal(pb.boat_id, 'b9');
  eq(pb.overrides.fuel, { off: 1, parts: [{ qty: 400 }, null] });
  assert.equal(pb.on_demand.van.agent_qty, 10);

  const rent = c.rentFromServer({ boat_id: 'b9', rented: true, mode: 'seat', amount: 0, per_seat: 800, days: 30, days_off: 2, trips_per_day: 1, vat: false, note: null, from: null, to: null, fuel_pct: null, owner_pays: ['dep', 'cap'] });
  assert.equal(rent.fuelMul, 100);
  eq(rent.ex, { dep: 1, cap: 1 });
  const rb = c.rentToServer({ ...rent, fuelMul: 100, from: '', to: '', note: '' });
  assert.equal(rb.fuel_pct, null);
  assert.equal(rb.from, null);
  assert.equal(rb.note, null);
  eq(rb.owner_pays, ['dep', 'cap']);
  assert.equal(c.rentToServer({ ...rent, fuelMul: 120 }).fuel_pct, 120);
});

test('analysis tab draws the server report numbers', () => {
  const { c } = load();
  const html = c.analysisHtml({
    window: { from: '2026-08-27', to: '2026-10-12', days: 47 }, previous_window: { days: 47, trips: 10, pax: 100, revenue: 1000, cost: 800, net: 200 }, target_per_pax: 500, pier: null,
    totals: { trips: 5, did_not_sail: 1, sailed_trips: 4, pax: 120, revenue: 300000, cost: 250000, net: 50000, capacity: 300, load_factor: 0.4, agents_below_cost: 1, below_cost_net: -900, agent_revenue: 1, other_revenue: 1, flags_missing: 0, receipted_pct: 61 },
    routes: [{ route_id: 'r1', name: 'Phi Phi', trips: 5, did_not_sail: 1, avg_pax: 24, avg_capacity: 60, revenue: 1, cost: 1, net: 50000, revenue_per_pax: 2500, cost_per_pax: 2083, net_per_pax: 417, margin_pct: 17, load_factor: 0.4, break_even_plan: 22, break_even_fit: null, below_cost: false }],
    bands: [{ key: 'under_40', trips: 2, avg_pax: 10, net: -500, net_per_pax: -25, verdict: 'loss' }], groups: [], movers: [], weeks: [], flags: [], markets: [], agents: [],
  });
  assert.match(html, /Phi Phi/);
  assert.match(html, /300,000/);
  assert.match(html, /40%/);
  assert.match(html, /Under 40% full/);
});

test('wrapped functions fall back to the legacy originals when operations mode is off', () => {
  const { window } = load({ enabled: false });
  assert.equal(window.pxDay('2026-10-12', ''), 'legacy-day');
  assert.equal(window.pxTrip('2026-10-12', 'b1'), 'legacy-trip');
  assert.equal(window.ctRead('cost_plans'), 'legacy-read');
  assert.equal(window.pxAnalysis(), 'legacy-analysis');
});

test('pxTrip returns a safe stub before the server day has loaded', () => {
  const { window } = load();
  assert.equal(window.pxDay('2026-10-12', '').length, 0);
  const t = window.pxTrip('2026-10-12', 'b1');
  assert.equal(t.noSail, true);
  assert.equal(t.rows.length, 0);
});

test('costing reads come from the server cache and plan writes send POST, PATCH and DELETE', async () => {
  const srvTemplate = { vat_rate: 7, dropped: [], lines: [{ id: 'fuel', group: 'Fuel', label: 'Fuel', vat: true, on_demand: false, on_demand_qty: null, parts: [{ kind: 'var', unit: 1 }] }] };
  const srvPlan = { id: 'p_srv1', name: 'A', route_key: null, note: null, engines: '3EN', boats: 1, capacity: 65, pax: 20, pax_th: 0, price: 2500, price_child: null, child_pct: 0, commission_pct: 0, fuel_price: 45, boat_id: null, rent_off: false, overrides: {}, groups: {}, on_demand: {}, itinerary: [], tiers: [] };
  const { window, calls } = load({
    get: (p) => p === '/v1/costing/template' ? srvTemplate : p === '/v1/costing/plans' ? { plans: [srvPlan] } : { rents: [] },
    post: () => ({ ...srvPlan, id: 'p_new9', name: 'B' }),
  });
  assert.equal(window.ctRead('cost_plans'), null);
  window.ctWrite('cost_plans', []);
  assert.equal(calls.filter((x) => x[0] === 'DELETE').length, 0, 'write ignored before load');
  await window.laOps.costingPL.loadCosting();
  const plans = window.ctRead('cost_plans');
  assert.equal(plans.length, 1);
  assert.equal(plans[0].id, 'p_srv1');
  assert.equal(window.ctRead('cost_template').vatRate, 7);

  plans[0].price = 3000;
  plans.push({ id: 'pLOCAL1', name: 'B', famId: '', note: '', eng: '3EN', boats: 1, cap: 65, pax: 20, paxTH: 0, price: 2500, priceCh: '', chPct: 0, comm: 0, fuel: 45, ovr: {} });
  window._ct.pid = 'pLOCAL1';
  window.ctWrite('cost_plans', plans);
  await new Promise((r) => setTimeout(r, 10));
  const patch = calls.find((x) => x[0] === 'PATCH');
  assert.equal(patch[1], '/v1/costing/plans/p_srv1');
  assert.equal(patch[2].price, 3000);
  const post = calls.find((x) => x[0] === 'POST');
  assert.equal(post[1], '/v1/costing/plans');
  assert.equal(post[2].name, 'B');
  assert.equal(window._ct.pid, 'p_new9', 'selection follows the server id');
  assert.equal(window.ctRead('cost_plans')[1].id, 'p_new9');

  window.ctWrite('cost_plans', [window.ctRead('cost_plans')[1]]);
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(calls.find((x) => x[0] === 'DELETE' && x[1] === '/v1/costing/plans/p_srv1'));
});

test('close and ran post to the server trip-actuals commands', async () => {
  const { window, calls, writes } = load();
  window._px.date = '2026-10-12';
  await window.pxClose('b1');
  assert.ok(calls.find((x) => x[0] === 'POST' && x[1] === '/v1/trip-actuals/2026-10-12/b1/close'));
  assert.ok(writes.includes('trip-pl'));
  await window.pxRan('b1');
  assert.ok(calls.find((x) => x[1] === '/v1/trip-actuals/2026-10-12/b1/ran'));
});
