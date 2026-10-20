import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

// FE-9: the dashboard Programmes card draws A/C/I/F from the server's by-trip answer (marine page + land page), not from SB_BOOKINGS.
const PRE = `
var TODAY_STR = '2026-10-21', SB_BOOKINGS = [{ id:'local', status:'confirmed', schemaVer:2, trips:[{ date:'2026-10-22', routeId:'r1', pax:{ ad_fr:99 } }] }];
var ROUTES = [{ id:'r1', name:'Similan by Speedboat', pier:'tublamu', times:['08:00'] }, { id:'r2', name:'City tour', pier:'other', times:['09:00'] }];
function laT(t){ return t; } var _DP_LOCK = '';
function bookingV2RouteFamily(rid){ return { id:'f1', name:'Similan', color:'#111' }; }
function bookingV2PaxTot(){ return 0; }
function bookingV2IsRouteOpenOn(){ return true; } function bookingV2IsWeatherClosed(){ return false; }
function getAllotment(rid){ return rid === 'r1' ? { hasAllotment:true, seatsConsumed:20, availableCapacity:50, seatsAvailable:30 } : { hasAllotment:false }; }
function bookingV2LockedTotal(){ return 0; }
function _dashCalSeg(){ return ''; } function laRouteOrdCmp(){ return 0; }
var _BKV2_FAMILIES = [{ id:'f1', name:'Similan' }];
var _dashProgHtml = function(){ return 'LEGACY'; };
var rendered = 0; function renderDash(){ rendered++; } function _dashCalView(){ return 'prog'; }
`;
const ANS = (land) => ({ routes: land ? [{ route_id: 'r2', bookings: 1, seat_pax: 0, pax: { ad: 3, chd: 0, inf: 0, foc: 0, total: 3 } }]
  : [{ route_id: 'r1', bookings: 4, seat_pax: 20, pax: { ad: 14, chd: 4, inf: 1, foc: 1, total: 20 } }] });

test('the card is drawn from the by-trip answers; the browser\'s own bookings are not read', async () => {
  const r = runtime({ files: ['72-ops-by-trip.js'], pre: PRE, handlers: { 'GET /operations/by-trip': (b, p) => ({ body: ANS(/land=true/.test(p)) }) } });
  r.O.activeView = () => 'dashboard'; r.O.busy = () => false;
  r.ctx._dashProgDate = '2026-10-22'; r.ctx.window._dashProgDate = '2026-10-22';
  r.load('99-ops-dash-prog.js');
  const first = r.ctx._dashProgHtml({}, '');
  assert.match(first, /dv-prog/, 'a miss still draws the card');
  assert.doesNotMatch(first, />99</, 'local bookings are not summed');
  await r.settle();
  assert.ok(r.ctx.rendered >= 1, 'the dashboard is drawn again when the answer lands');
  const html = r.ctx._dashProgHtml({}, '');
  assert.match(html, /<span class="q">14<s>A<\/s><\/span><span class="q">4<s>C<\/s><\/span><span class="q">1<s>I<\/s><\/span><span class="q f">1<s>F<\/s><\/span>/);
  assert.match(html, /<b>5<\/b> booking &middot; <b>23<\/b> pax<i>17A &middot; 4C &middot; 1I &middot; 1F<\/i>/, 'day totals: both pages');
  assert.match(html, /<b>20<\/b>\/50/, 'seats from getAllotment (the availability adapter)');
  assert.deepEqual(r.requests.map((q) => q.path).sort(), ['/operations/by-trip?date=2026-10-22', '/operations/by-trip?date=2026-10-22&land=true']);
});

test('ops off: legacy draws', () => {
  const r = runtime({ files: ['72-ops-by-trip.js'], pre: PRE, enabled: false });
  r.load('99-ops-dash-prog.js');
  assert.equal(r.ctx._dashProgHtml({}, ''), 'LEGACY');
});
