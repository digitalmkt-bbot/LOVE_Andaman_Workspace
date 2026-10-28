// §tcxPartner (ops/27-ops-weather.js): Send to partner goes to operation-backend; legacy's readers get the server's partner records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

const PRE = `
var SB_WEATHER_CLOSURES = [], ROUTES = [{id:'r1',name:'Phi Phi',pier:'panwa'}];
var SB_BOOKINGS = [{ id: 'BK-1', opsId: 'b1', voucherRef: 'V1', trips: [{ routeId: 'r1', date: '2026-10-21', pax: { ad_fr: 2 } }] },
                   { id: 'BK-2', opsId: 'b2', voucherRef: 'V2', trips: [{ routeId: 'r1', date: '2026-10-21', pax: { ad_fr: 3 } }] }];
var TCX_R = { weather:{en:'Weather',th:'a',ic:'W',fg:'#000',bg:'#fff',bd:'#ccc'} };
var _tcxD = null, _tcxH = {mon:'',r:'',p:''}, _tcxPick = 'weather';
function tcxCan(){ return true; } function tcxReason(){ return 'weather'; } function tcxRName(id){ return id; }
function tcxPaxOf(b){ return b.id === 'BK-1' ? 2 : 3; } function tcxOutOpts(){ return ''; } function tcxSnapNow(){ return {}; }
function tcxDlgRender(){} function tcxDlgOpen(){} function tcxDlgBulk(){} function tcxDlgApply(){} function tcxByTripBanner(){}
function tcxMoveTargets(){ return []; } function tcxMoveSel(){} function tcxBulkMove(){}
function tcxBelow(){ return ''; } function tcxBelowList(){ return []; } function tcxHistRows(){ return []; }
function tcxSnapAll(){ return {}; } function tcxSnapOf(){ return null; } function tcxSnapPutLater(){} function tcxSnapFlush(){} function tcxBE(){ return 0; }
function bookingV2WeatherCancel(){} function bookingV2WeatherMarkConfirm(){} function bookingV2WeatherUncancel(){} function bookingV2WeatherNotify(){}
function bookingV2WeatherResolveOne(){} function bookingV2WeatherPanel(){} function bookingV2WeatherCountsFor(){} function bookingV2WeatherTagBookings(){}
function bookingV2WeatherNote(){ return ''; }
var legacyPt = { all: 0, save: 0, undo: 0 };
function tcxPtAll(){ legacyPt.all++; return { blob: true }; } function tcxPtSave(){ legacyPt.save++; return true; } function tcxPtNames(){ return [{ name: 'blob' }]; }
function _tcxPtL(){ return []; } function tcxPtUndo(){ legacyPt.undo++; } function tcxPtInit(ids){ var v={}; ids.forEach(function(i){ v[i]='ours'; }); return {name:'',ppx:'',drop:'',time:'',ref:'',van:v}; }
function tcxPtBody(){ return '<form>'; } function tcxPtBulkSeg(){ return '<seg>'; }
`;
const PARTNER = { name: 'Sea Star', price_per_head: 900, pax: 2, cost: 1800, van: 'partner', drop_point: null, drop_time: null, ref: 'SS-1', by: 'sam', at: '2026-10-20T02:00:00Z' };
const detail = (resolved) => ({ id: 'wx1', route_id: 'r1', service_date: '2026-10-21', reason: 'weather', reopened_at: null, counts: {}, pax: {},
  bookings: [resolved ? { booking_id: 'b1', status: 'resolved', outcome: 'partner', partner: PARTNER, pax: 2, on_trip: true } : { booking_id: 'b1', status: 'notified', outcome: null, pax: 2, on_trip: true },
    { booking_id: 'b2', status: 'notified', outcome: null, pax: 3, on_trip: true }] });
const rt = (handlers) => runtime({ files: ['27-ops-weather.js'], pre: PRE, handlers, globals: { setTimeout: () => 0, clearTimeout: () => {} } });

test("the server's partner record is what legacy's readers get (tcxPtAll, keyed by the local booking), not the blob", async () => {
  const r = rt({ 'GET /v1/weather-closures/wx1': { body: detail(true) } });
  await r.O.weather.refreshDetail('wx1');
  assert.deepEqual(plain(r.ctx.tcxPtAll()), { 'BK-1': { ev: 'r1|2026-10-21', name: 'Sea Star', ppx: 900, pax: 2, cost: 1800, van: 'partner', drop: '', time: '', ref: 'SS-1', by: 'sam', at: '2026-10-20T02:00:00Z' } });
  assert.equal(r.ctx.tcxPtSave({ x: 1 }), false, 'nothing is written to the blob');
  assert.equal(r.ctx.legacyPt.all + r.ctx.legacyPt.save, 0);
  assert.equal(r.ctx.SB_BOOKINGS[0].weatherResolve.outcome, 'partner');
});

test('Apply on "→ Partner" sends the partner, the price, the van choice per booking (server ids) and the drop point', async () => {
  const r = rt({ 'POST /v1/weather-closures/wx1/send-to-partner': { body: detail(true) } });
  r.ctx._tcxD = { ids: ['BK-1'], rid: 'r1', ds: '2026-10-21', out: 'partner', cid: 'wx1', pt: { name: ' Sea Star ', ppx: '900', drop: 'Rassada', time: '08:30', ref: 'SS-1', van: { 'BK-1': 'partner' } } };
  await r.ctx.tcxDlgApply();
  assert.deepEqual(r.requests.map((q) => [q.method, q.path, q.body]), [['POST', '/v1/weather-closures/wx1/send-to-partner',
    { name: 'Sea Star', price_per_head: 900, booking_ids: ['b1'], vans: { b1: 'partner' }, ref: 'SS-1', drop_point: 'Rassada', drop_time: '08:30' }]]);
  assert.equal(r.ctx._tcxD, null, 'the dialog closes');
  assert.equal(plain(r.ctx.tcxPtAll())['BK-1'].name, 'Sea Star');
});

test('a missing price sends nothing; undo goes to the server, not the blob', async () => {
  const r = rt({ 'GET /v1/weather-closures': { body: { weather_closures: [{ id: 'wx1', route_id: 'r1', service_date: '2026-10-21', reason: 'weather' }] } },
    'GET /v1/weather-closures/wx1': { body: detail(true) }, 'POST /v1/weather-closures/wx1/bookings/b1/undo-partner': { body: detail(false) } });
  r.ctx._tcxD = { ids: ['BK-1'], rid: 'r1', ds: '2026-10-21', out: 'partner', cid: 'wx1', pt: { name: 'Sea Star', ppx: '', van: {} } };
  await r.ctx.tcxDlgApply();
  assert.deepEqual(r.alerts, ['Enter the partner price per head (0 if there is no charge).']);
  assert.equal(r.requests.length, 0);

  await r.O.weather.load('2026-10-01', '2026-10-31');
  await r.O.weather.refreshDetail('wx1');
  await r.ctx.tcxPtUndo('BK-1');
  assert.ok(r.requests.some((q) => q.method === 'POST' && q.path === '/v1/weather-closures/wx1/bookings/b1/undo-partner'));
  assert.equal(r.ctx.legacyPt.undo, 0);
  assert.deepEqual(plain(r.ctx.tcxPtAll()), {}, 'the record is gone once the server says so');
});
