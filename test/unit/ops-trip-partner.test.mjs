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
  const r = rt({ 'POST /v1/weather-closures/wx1/send-to-partner': { body: detail(true) }, 'GET /v1/partner-companies': { body: { partner_companies: [] } } });
  r.ctx._tcxD = { ids: ['BK-1'], rid: 'r1', ds: '2026-10-21', out: 'partner', cid: 'wx1', pt: { name: ' Sea Star ', ppx: '900', drop: 'Rassada', time: '08:30', ref: 'SS-1', van: { 'BK-1': 'partner' } } };
  await r.ctx.tcxDlgApply();
  assert.deepEqual(r.requests.filter((q) => q.method === 'POST').map((q) => [q.method, q.path, q.body]), [['POST', '/v1/weather-closures/wx1/send-to-partner',
    { name: 'Sea Star', price_per_head: 900, booking_ids: ['b1'], vans: { b1: 'partner' }, ref: 'SS-1', drop_point: 'Rassada', drop_time: '08:30' }]], 'a name typed in: no partner_id');
  assert.equal(r.toasts.length, 0, 'no email answer, no email toast');
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

// ── the partner list and the email (operation-backend migration 582) ──
const SEA = { id: 'ptn_1', name: 'Sea Star', email: 'ops@seastar.test', price_per_head: 950, active: true };
const QUIET = { id: 'ptn_2', name: 'Quiet Co', email: null, price_per_head: null, active: true };
const OLD = { id: 'ptn_3', name: 'Old Boat', email: 'x@old.test', price_per_head: 500, active: false };
const COMPANIES = { body: { partner_companies: [SEA, QUIET, OLD] } };
const dlg = (name, extra) => ({ ids: ['BK-1'], rid: 'r1', ds: '2026-10-21', out: 'partner', cid: 'wx1', pt: Object.assign({ name, ppx: '950', van: {} }, extra || {}) });

test('a partner picked from the list is sent by id; the answer about the email is shown', async () => {
  const sent = [];
  const answer = (email) => (body) => { sent.push(body); return { body: Object.assign(detail(true), { email }) }; };
  let r = rt({ 'GET /v1/partner-companies': COMPANIES, 'POST /v1/weather-closures/wx1/send-to-partner': answer({ sent: true, to: 'ops@seastar.test' }) });
  r.ctx._tcxD = dlg('sea star ');
  await r.ctx.tcxDlgApply();
  assert.equal(sent[0].partner_id, 'ptn_1');
  assert.equal('email' in sent[0], false, 'email is the server default (on)');
  assert.deepEqual(r.toasts.map((t) => [t.kind, t.title, t.sub]), [['success', 'Partner emailed', 'Guest list sent to ops@seastar.test']]);

  r = rt({ 'GET /v1/partner-companies': COMPANIES, 'POST /v1/weather-closures/wx1/send-to-partner': answer({ sent: false, to: 'ops@seastar.test', reason: 'Email is not set up on the server' }) });
  r.ctx._tcxD = dlg('Sea Star');
  r.ctx.laOpsPartnerEmailSet(true);
  await r.ctx.tcxDlgApply();
  assert.deepEqual(r.toasts.map((t) => [t.kind, t.title, t.sub]), [['error', 'Sent to partner, but NOT emailed', 'Email is not set up on the server']]);

  r = rt({ 'GET /v1/partner-companies': COMPANIES, 'POST /v1/weather-closures/wx1/send-to-partner': answer(null) });
  r.ctx._tcxD = dlg('Sea Star');
  r.ctx.laOpsPartnerEmailSet(false);
  await r.ctx.tcxDlgApply();
  assert.equal(sent[2].email, false, 'unticked: the server is told not to email');
  assert.equal(r.toasts.length, 0);
});

test("the name box lists the partner list's active companies first, with their usual price, then names typed before", async () => {
  const r = rt({ 'GET /v1/partner-companies': COMPANIES, 'GET /v1/weather-closures/partners': { body: { partners: [
    { name: 'sea star', uses: 3, price_per_head: 900, last_at: '2026-10-01' }, { name: 'Blue Lagoon', uses: 1, price_per_head: 700, last_at: '2026-09-01' }] } } });
  r.ctx.tcxPtNames();
  await r.settle();
  assert.deepEqual(plain(r.ctx.tcxPtNames()).map((n) => [n.name, n.n, n.ppx]), [['Sea Star', 3, 950], ['Quiet Co', 0, 0], ['Blue Lagoon', 1, 700]]);
});

test("the dialog's email line says who gets the guest list, or why nobody does", async () => {
  const r = rt({ 'GET /v1/partner-companies': COMPANIES, 'GET /v1/weather-closures/partners': { body: { partners: [] } } });
  r.ctx.tcxPtNames();
  await r.settle();
  const row = (name, extra) => r.O.weather.mailRowHtml(dlg(name, extra));
  assert.match(row('Sea Star'), /type="checkbox" checked[^>]*>.*Email the guest list to <b>ops@seastar\.test<\/b>/);
  assert.doesNotMatch(row('Sea Star', { noEmail: true }), / checked /);
  assert.match(row('Quiet Co'), /No email for Quiet Co.*laOpsPartners\('ptn_2'\)/);
  assert.match(row('Someone New'), /Not in the partner list.*laOpsPartners\('\+Someone New'\)/);
  assert.match(r.ctx.tcxPtBody(dlg('Sea Star'), []), /^<form><div id="tcxp-mail"/);
});

test('Resend asks the server to email the partner again; a refusal is shown and the panel re-read', async () => {
  let refuse = false;
  const r = rt({ 'POST /v1/weather-closures/wx1/email-partner': (body) => refuse ? { status: 502, body: { statusCode: 502, code: 'email_failed', message: 'The email provider refused it (403)' } }
    : { body: Object.assign(detail(true), { email: { sent: true, to: 'ops@seastar.test' } }) }, 'GET /v1/weather-closures/wx1': { body: detail(true) } });
  await r.O.weather.emailPartner('wx1', 'b1');
  assert.deepEqual(r.requests[0].body, { booking_ids: ['b1'] });
  assert.equal(r.toasts.at(-1).title, 'Partner emailed');
  refuse = true;
  await r.O.weather.emailPartner('wx1', 'b1');
  assert.match(JSON.stringify(r.toasts.at(-1)), /email provider refused/);
  assert.ok(r.requests.some((q) => q.method === 'GET' && q.path === '/v1/weather-closures/wx1'), 'the panel is read again for the recorded error');
});
