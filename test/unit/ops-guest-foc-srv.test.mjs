// Guest Insights (js/ops/99-ops-guest-insights.js) and FOC detail (js/ops/55-ops-foc-b2b.js) read one server summary each
// instead of paging whole bookings: GET /v1/bookings/guest-insights (groups expanded back into giCollect's rows) and
// GET /v1/bookings/foc-detail (turned into stand-in bookings that legacy's renderFocDetail adds up to the same figures).
//   node --test test/unit/ops-guest-foc-srv.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const GI = fs.readFileSync('allotment_v2/js/ops/99-ops-guest-insights.js', 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x));
const tick = () => new Promise((r) => setTimeout(r, 0));

function loadGi(answer) {
  const calls = [], drawn = [];
  const window = {
    _giPier: '', _giFam: '',
    giRange: () => ({ from: '2026-01-01', to: '2026-11-25' }),
    giCollect: () => ({ R: { from: '2026-01-01', to: '2026-11-25' }, rows: [{ browser: true }], heads: 1, pierLock: '' }),
  };
  window.renderGuestInsights = function(){ drawn.push(window.giCollect()); };
  window.laOps = {
    enabled: () => true, activeView: () => 'guestins', onWrite: () => {}, fail: () => {},
    get: (path, q) => { calls.push({ path, q }); return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer); },
  };
  const host = { innerHTML: '' };
  vm.runInNewContext(GI, { window, document: { getElementById: (id) => (id === 'guestins-host' ? host : null) }, console, Number, String, Object, Array, Date, Promise });
  return { window, calls, drawn, host };
}

test('Guest Insights: one GET /v1/bookings/guest-insights, its groups expanded into giCollect\'s rows', async () => {
  const answer = { heads: 9, people: 4, aged_from: '2026-07-04', aged_to: '2026-11-08', groups: [
    { family: 'Similan Islands', a2: 'RU', age: 33, gen: 'Millennials', n: 2 },
    { family: 'Similan Islands', a2: '', age: null, gen: '', n: 1 },
    { family: 'อื่น ๆ', a2: 'TH', age: 8, gen: 'Gen Alpha', n: 1 },
  ] };
  const { window, calls, drawn, host } = loadGi(answer);
  assert.equal(window.renderGuestInsights(), undefined);
  assert.match(host.innerHTML, /Loading/);
  assert.deepEqual(plain(calls), [{ path: '/v1/bookings/guest-insights', q: { from: '2026-01-01', to: '2026-11-25', pier: '', family: '' } }]);
  await tick(); await tick();
  assert.equal(drawn.length, 1, 'the answer draws the page once');
  const D = drawn[0];
  assert.equal(D.heads, 9);
  assert.equal(D.rows.length, 4, 'one row per person');
  assert.deepEqual(plain(D.rows.filter((r) => r.a2 === 'RU').map((r) => [r.fam, r.age, r.gen])), [['Similan Islands', 33, 'Millennials'], ['Similan Islands', 33, 'Millennials']]);
  const aged = D.rows.filter((r) => r.age != null).map((r) => r.date).sort();
  assert.deepEqual([aged[0], aged[aged.length - 1]], ['2026-07-04', '2026-11-08'], 'the age span line reads aged_from / aged_to');
  window.renderGuestInsights();
  assert.equal(calls.length, 1, 'kept a minute: no second read');
  window._giFam = 'similan';
  window.renderGuestInsights();
  assert.equal(calls[1].q.family, 'similan', 'a filter is its own read');
});

test('Guest Insights: a failed read says so and never draws the browser\'s partial count', async () => {
  const { window, drawn, host } = loadGi(new Error('down'));
  window.renderGuestInsights();
  await tick(); await tick();
  assert.equal(drawn.length, 0);
  assert.match(host.innerHTML, /could not load/);
});

test('FOC detail: the answer becomes stand-in bookings that add up to the same value, heads and FOC trips', () => {
  const src = fs.readFileSync('allotment_v2/js/ops/55-ops-foc-b2b.js', 'utf8');
  const window = {};
  window.laOps = { enabled: () => true, onWrite: () => {}, activeView: () => '', get: () => new Promise(() => {}) };
  window.renderFocDetail = () => {};
  window.renderB2BDash = () => {};
  vm.runInNewContext(src, { window, document: { getElementById: () => null }, console, Number, String, Object, Array, Date, Math, Promise, JSON, setTimeout });
  const f = window.laOps.focDetailBookings;
  assert.equal(typeof f, 'function');
  const out = f({
    foc: [{ booking_id: 'b1', agent_id: 'a1', channel: null, value: 3000, reason: 'Guide', approval: 'pending', trips: [{ date: '2026-11-02', route_id: 'r1', pax: 3, foc: 1 }] }],
    shares: [{ agent_id: 'a1', route_id: 'r1', pax: 6, value: 5000 }, { agent_id: null, route_id: 'r2', pax: 2, value: 800 }],
    agents: [{ agent_id: 'a1', value: 5400 }],
  });
  const foc = out.find((b) => b.id === 'b1');
  assert.deepEqual(plain(foc.trips), [{ date: '2026-11-02', routeId: 'r1', pax: { ad: 2, foc: 1 } }]);
  assert.deepEqual(plain(foc.focApproval), { status: 'pending', reason: 'Guide' });
  assert.equal(foc.srvFlags.owed, 3000);
  const a1 = out.filter((b) => b.agentId === 'a1' && b.id !== 'b1');
  assert.equal(a1.reduce((s, b) => s + b.srvFlags.owed, 0), 5400, 'the agent\'s value in full: shared 5,000 + 400 on bookings with no heads');
  assert.equal(a1.reduce((s, b) => s + b.trips.reduce((n, t) => n + t.pax.ad, 0), 0), 6);
  assert.equal(out.filter((b) => !b.agentId).length, 1);
});
