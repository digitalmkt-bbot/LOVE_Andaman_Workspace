// §rentDay / §rentRoute (lk-inbox 8769d2ca, 65903dd6): ops/44-ops-costing-pl.js maps the boat rent's daily charter deal both ways,
// so legacy's ctRentSet('day.*') saves through the existing rent save (PUT /v1/costing/boat-rents/{boat_id}, migration 584).
// Runs legacy's own rent functions (08-app.js, ctRentBlank .. ctRentActiveOn) on top of the adapter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { plain, read, runtime } from './fe-harness.mjs';

const APP = read('allotment_v2/js/08-app.js');
const from = APP.indexOf('function ctRentBlank(');
const to = APP.indexOf('function ctYmdAdd(');
assert.ok(from > 0 && to > from, 'legacy rent functions found in 08-app.js');
const PRE = `
  function ctRead(k){ return null; }
  function ctWrite(k, v){ window.__legacyWrites = (window.__legacyWrites || 0) + 1; }
  function ctRender(){}
  function getBoat(id){ return { id: id, name: id.toUpperCase(), cap: 60 }; }
  function getRoute(id){ return { id: id, name: 'Route ' + id }; }
` + APP.slice(from, to);

const TEMPLATE = { vat_rate: 7, dropped: [], lines: [] };
const srvRent = (boatId, day) => ({
  boat_id: boatId, rented: true, mode: 'lump', amount: 28000, per_seat: 0, days: 30, days_off: 2, trips_per_day: 1, vat: false, note: null,
  from: '2066-02-15', to: null, fuel_pct: null, owner_pays: ['dep', 'cap', 'crew'], seats: 60, total: 28000, run_days: 28, per_day: 1000, per_trip: 1000, per_calendar_day: 933.33,
  ...(day === undefined ? {} : { day }),
});
const DAY = { on: true, amount: 38000, vat: false, from: null, to: null, owner_pays: ['fuel', 'cap', 'crew', 'dep'], routes: { r12: 45000 } };

function boot(rents, put) {
  let list = rents;
  const rt = runtime({
    files: ['44-ops-costing-pl.js', '96-ops-not-yet.js'], pre: PRE,
    handlers: {
      'GET /v1/costing/template': { body: TEMPLATE },
      'GET /v1/costing/plans': { body: { plans: [] } },
      'GET /v1/costing/boat-rents': () => ({ body: { rents: list } }),
      'PUT /v1/costing/boat-rents/b66': (body) => put(body, (next) => { list = next; }),
      'PUT /v1/costing/boat-rents/b9': (body) => put(body, (next) => { list = next; }),
    },
  });
  return rt;
}
const puts = (rt) => rt.requests.filter((r) => r.method === 'PUT').map((r) => r.body);

test('server day -> legacy R.day: ctRentFor prices the trip from it (route price, else the boat\'s default)', async () => {
  const rt = boot([srvRent('b66', DAY)], () => ({ body: { rents: [] } }));
  await rt.O.costingPL.loadCosting();
  const R = rt.ctx.ctRead('boat_rent').b66;
  assert.deepEqual(plain(R.day), { on: 1, amt: 38000, vat: 0, from: '', to: '', ex: { fuel: 1, cap: 1, crew: 1, dep: 1 }, rt: { r12: 45000 } });
  const r12 = rt.ctx.ctRentFor('b66', '2066-02-10', 'r12'), r11 = rt.ctx.ctRentFor('b66', '2066-02-10', 'r11');
  assert.deepEqual([r12.day, r12.amt, r12.byRoute, r11.amt, r11.byRoute], [1, 45000, true, 38000, false]);
  assert.equal(rt.ctx.ctRentFor('b66', '2066-02-20', 'r12').day, undefined, 'inside the monthly contract: the monthly rent');
  // A round trip changes nothing, so the server's monthly figures still stand for this record (_ctRentOfCalc's check).
  const c = rt.ctx.__laOpsCostingCompat, back = c.rentFromServer(c.rentToServer(c.rentFromServer(srvRent('b66', DAY))));
  assert.deepEqual(plain(back), plain(c.rentFromServer(srvRent('b66', DAY))));
  assert.equal(rt.ctx.ctRentOf('b66').perTrip, 1000);
});

test('ctRentSet day.*: each edit saves the whole deal through PUT /v1/costing/boat-rents, never the legacy blob', async () => {
  const rt = boot([srvRent('b66', DAY)], (body, set) => { const r = { ...srvRent('b66'), day: body.day }; set([r]); return { body: { rents: [r] } }; });
  await rt.O.costingPL.loadCosting();
  rt.ctx.ctRentSet('b66', 'day.rt.r11', '40000');
  await rt.settle();
  rt.ctx.ctRentSet('b66', 'day.rt.r12', '');
  await rt.settle();
  rt.ctx.ctRentSet('b66', 'day.ex.fuel', 0);
  await rt.settle();
  rt.ctx.ctRentSet('b66', 'day.from', '2066-01-01');
  await rt.settle();
  rt.ctx.ctRentSet('b66', 'day.vat', 1);
  await rt.settle();
  const P = puts(rt);
  assert.equal(P.length, 5);
  assert.deepEqual(P[0].day, { on: true, amount: 38000, vat: false, from: null, to: null, owner_pays: ['fuel', 'cap', 'crew', 'dep'], routes: { r12: 45000, r11: 40000 } });
  assert.deepEqual(P[1].day.routes, { r12: 0, r11: 40000 }, '§rentTyp: a cleared route keeps its row at 0 (the default price); only × removes it');
  assert.deepEqual(P[2].day.owner_pays, ['cap', 'crew', 'dep']);
  assert.equal(P[3].day.from, '2066-01-01');
  assert.equal(P[4].day.vat, true);
  assert.deepEqual([P[4].amount, P[4].from, P[4].owner_pays], [28000, '2066-02-15', ['dep', 'cap', 'crew']], 'the monthly fields go as they were');
  assert.equal(rt.ctx.__legacyWrites, undefined, 'nothing went to the legacy blob');
  assert.equal(rt.alerts.length, 0, 'no "not available yet" refusal');
});

test('a backend without `day` (before migration 584): other rent edits still save; a daily deal is sent and its refusal rolls back', async () => {
  const rt = boot([srvRent('b9')], (body) => (body.day ? { status: 400, body: { statusCode: 400, message: 'A boat rent has no field day' } } : { body: { rents: [srvRent('b9')] } }));
  await rt.O.costingPL.loadCosting();
  assert.equal(rt.ctx.ctRead('boat_rent').b9.day.on, 0, 'no day from the server reads as ctRentDayBlank');
  rt.ctx.ctRentSet('b9', 'amt', '30000');
  await rt.settle();
  assert.equal('day' in puts(rt)[0], false, 'a blank deal is not sent to a server that has not shown it keeps one');
  rt.ctx.ctRentSet('b9', 'day.on', 1);
  rt.ctx.ctRentSet('b9', 'day.amt', '38000');
  await rt.settle();
  const sent = puts(rt).filter((b) => b.day);
  assert.ok(sent.length >= 1 && sent[sent.length - 1].day.on === true);
  assert.ok(rt.toasts.length >= 1, 'the server\'s refusal is shown');
  assert.equal(rt.ctx.ctRead('boat_rent').b9.day.on, 0, 'server first: the refused deal does not stay on screen');
});
