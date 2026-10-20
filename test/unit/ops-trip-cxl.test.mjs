import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

const PRE = `
var SB_WEATHER_CLOSURES = [], SB_BOOKINGS = [], ROUTES = [{id:'r1',name:'Phi Phi',pier:'panwa'},{id:'r2',name:'Maya',pier:'panwa'}];
var TCX_R = { weather:{en:'Weather',th:'a',ic:'W',fg:'#000',bg:'#fff',bd:'#ccc'}, minpax:{en:'Below break-even',th:'b',ic:'M',fg:'#000',bg:'#fff',bd:'#ccc'}, boat:{en:'No boat'}, other:{en:'Other'} };
var _tcxD = null, _tcxH = {mon:'',r:'',p:''}, _tcxPick = 'weather';
function tcxCan(){ return true; }
function tcxReason(rid, ds){ var c=SB_WEATHER_CLOSURES.find(function(x){return x.routeId===rid&&x.date===ds;}); return (c&&c.reason)||'weather'; }
function tcxRName(id){ return id; }
function tcxPaxOf(){ return 2; }
function tcxOutOpts(){ return '<option>x</option>'; }
function tcxSnapNow(){ return {pax:9,bk:1,ad:9,chd:0,byAg:{},be:0}; }
var rendered = 0;
function tcxDlgRender(){ rendered++; }
function tcxDlgOpen(){} function tcxDlgBulk(){} function tcxDlgApply(){} function tcxByTripBanner(){}
function tcxMoveTargets(){ return ['legacy']; } function tcxMoveSel(){} function tcxBulkMove(){}
function tcxBelow(){ return 'legacy'; } function tcxBelowList(){ return ['legacy']; } function tcxHistRows(){ return ['legacy']; }
function tcxSnapAll(){ return {}; } function tcxSnapOf(){ return null; } function tcxSnapPutLater(){} function tcxSnapFlush(){} function tcxBE(){ return 0; }
function bookingV2WeatherCancel(){} function bookingV2WeatherMarkConfirm(){} function bookingV2WeatherUncancel(){} function bookingV2WeatherNotify(){}
function bookingV2WeatherResolveOne(){} function bookingV2WeatherPanel(){} function bookingV2WeatherCountsFor(){} function bookingV2WeatherTagBookings(){}
function bookingV2WeatherNote(){ return ''; }
`;
const CLOSURE = { id: 'wx1', route_id: 'r1', service_date: '2026-10-21', note: 'n', reason: 'minpax', closed_at: '2026-10-20T01:00:00Z',
  snapshot: { pax: 7, bookings: 2, ad: 6, chd: 1, by_agent: { Acme: 7 }, break_even: 10, before: 1, by: 'sam', at: '2026-10-20T01:00:00Z' },
  reason_log: [{ at: 'x', by: 'sam', from: 'weather', to: 'minpax' }], reopened_at: null, counts: { awaiting: 1, notified: 1, resolved: 0 }, pax: null };

function rt(handlers, globals = {}) {
  return runtime({ files: ['27-ops-weather.js'], pre: PRE, handlers, globals });
}

test('a closure keeps the server reason and the snapshot, mapped to legacy shape', async () => {
  const r = rt({ 'GET /v1/weather-closures': { body: { weather_closures: [CLOSURE] } } });
  await r.O.weather.load('2026-10-01', '2026-10-31');
  assert.equal(r.ctx.tcxReason('r1', '2026-10-21'), 'minpax');
  const s = plain(r.ctx.tcxSnapOf('r1', '2026-10-21'));
  assert.equal(s.pax, 7); assert.equal(s.bk, 2); assert.equal(s.be, 10); assert.deepEqual(s.byAg, { Acme: 7 });
  assert.equal(s.log[0].to, 'minpax');
  assert.equal(r.ctx.tcxBE('r1', '2026-10-21'), 10);
  assert.equal(plain(r.ctx.tcxSnapAll())['r1|2026-10-21'].pax, 7);
});

test('move targets: a miss answers empty, fetches once, then answers from the cache', async () => {
  const r = rt({
    'GET /v1/weather-closures': { body: { weather_closures: [CLOSURE] } },
    'GET /v1/weather-closures/wx1/move-targets': { body: { targets: [{ route_id: 'r2', name: 'Maya', pier: 'panwa', time: '08:30', free: 4, fits: true }, { route_id: 'r3', name: 'Nolimit', pier: 'panwa', time: '', free: null, fits: true }], suggested_route_id: 'r2', pax: 2 } },
  });
  await r.O.weather.load('2026-10-01', '2026-10-31');
  assert.deepEqual(plain(r.ctx.tcxMoveTargets('r1', '2026-10-21', '2026-10-21', false)), []);
  r.ctx.tcxMoveTargets('r1', '2026-10-21', '2026-10-21', false);
  await r.settle();
  const t = plain(r.ctx.tcxMoveTargets('r1', '2026-10-21', '2026-10-21', false));
  assert.deepEqual(t.map((x) => [x.id, x.free]), [['r2', 4], ['r3', null]]);
  assert.equal(r.requests.filter((q) => q.path.includes('move-targets')).length, 1);
  assert.match(r.requests.find((q) => q.path.includes('move-targets')).path, /to_date=2026-10-21/);
});

test('Move all: 409 not_enough_seats asks, then resends with move_anyway', async () => {
  let calls = 0;
  const r = rt({
    'GET /v1/weather-closures': { body: { weather_closures: [CLOSURE] } },
    'GET /v1/weather-closures/wx1/move-targets': { body: { targets: [{ route_id: 'r2', name: 'Maya', pier: 'panwa', time: '', free: 1, fits: false }], suggested_route_id: 'r2', pax: 4 } },
    'POST /v1/weather-closures/wx1/move-program': (body) => {
      calls++;
      if (!body.move_anyway) return { status: 409, body: { statusCode: 409, code: 'not_enough_seats', message: 'Only 1 seat(s) free on Maya (2026-10-21) for 4 guest(s). Send move_anyway: true to move anyway.' } };
      return { body: { moved: [{ booking_id: 'b1', trip_id: 't1' }], skipped: [{ booking_id: 'b2', code: 'charter' }], closure: CLOSURE } };
    },
    'GET /v1/weather-closures/wx1': { body: { ...CLOSURE, bookings: [] } },
  });
  await r.O.weather.load('2026-10-01', '2026-10-31');
  r.ctx._tcxD = { ids: ['b1', 'b2'], rid: 'r1', ds: '2026-10-21', out: 'move', toDs: '2026-10-21', all: false, nr: 'r2', bulk: true, cid: 'wx1', n: 2, pax: 4 };
  r.ctx.tcxDlgApply();   // target list not cached yet: the confirm has no seat line, the server's 409 carries the facts
  await r.settle();
  assert.equal(calls, 2);
  assert.ok(r.confirms.some((c) => /Only 1 seat\(s\) free on Maya.*\nMove anyway\?/s.test(c)), r.confirms.join('|'));
  const posts = r.requests.filter((q) => q.method === 'POST');
  assert.deepEqual(plain(posts[0].body), { to_route_id: 'r2', to_date: '2026-10-21' });
  assert.equal(posts[1].body.move_anyway, true);
  assert.ok(r.toasts.some((t) => /not moved/.test(t.title)));
});

test('history and below-break-even come from the server', async () => {
  const r = rt({
    'GET /v1/reports/trip-cancellations': { body: { rows: [{ closure_id: 'wx1', service_date: '2026-10-21', route_id: 'r1', route_name: 'Phi Phi', pier: 'panwa', reason: 'minpax', note: null, snapshot: CLOSURE.snapshot, reopened: false, outcomes: { move: 2 }, bookings: 2, moved: 2 }], summary: {} } },
    'GET /v1/trip-cancellations/below-break-even': { body: { today: '2026-10-20', warn_days: 3, trips: [{ route_id: 'r1', service_date: '2026-10-21', booked: 3, break_even: 10, short: 7, days: 1, route_name: 'Phi Phi' }] } },
  });
  assert.deepEqual(plain(r.ctx.tcxHistRows()), []);
  await r.settle();
  const rows = plain(r.ctx.tcxHistRows());
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].k, rows[0].reason, rows[0].oc, rows[0].n, rows[0].live, rows[0].S.pax], ['r1|2026-10-21', 'minpax', { move: 2 }, 2, true, 7]);
  r.ctx.tcxBelowList([{ id: 'r1' }]);
  await r.settle();
  assert.deepEqual(plain(r.ctx.tcxBelowList([{ id: 'r1' }])), [{ rid: 'r1', ds: '2026-10-21', be: 10, bk: 3, days: 1 }]);
  assert.equal(r.ctx.tcxBelow('r1', '2026-10-21').bk, 3);
  assert.equal(r.ctx.tcxBelow('r1', '2026-10-22'), null);
});

test('Cancel trip sends the picked reason; the legacy functions run when ops is off', async () => {
  const r = rt({
    'GET /v1/weather-closures': { body: { weather_closures: [] } },
    'POST /v1/weather-closures': (b) => ({ status: 201, body: { ...CLOSURE, reason: b.reason, bookings: [] } }),
    'GET /v1/weather-closures/wx1': { body: { ...CLOSURE, bookings: [] } },
  }, { SB_BOOKINGS: [] });
  r.ctx.document.getElementById = (id) => (id === 'wx-note' ? { value: ' high waves ' } : null);
  r.ctx._tcxPick = 'minpax';
  r.ctx.bookingV2WeatherMarkConfirm('r1', '2026-10-21');
  await r.settle();
  const post = r.requests.find((q) => q.method === 'POST');
  assert.deepEqual(plain(post.body), { route_id: 'r1', service_date: '2026-10-21', note: 'high waves', reason: 'minpax' });
  const off = runtime({ files: ['27-ops-weather.js'], pre: PRE, enabled: false });
  assert.deepEqual(plain(off.ctx.tcxMoveTargets()), ['legacy']);
  assert.deepEqual(plain(off.ctx.tcxHistRows()), ['legacy']);
});
