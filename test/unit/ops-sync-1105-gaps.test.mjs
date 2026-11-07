import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

// lk-inbox sync 2026-11-05: an extra paid two ways (§exSplitPay) and closing a route's day or season taking its boats off (§closeRelease).
const local = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

// ── §exSplitPay ──
const EX_PRE = `
function setInterval(){ return 1; } function clearInterval(){}
var SB_BOOKINGS = [{ id: 'BK-1', opsId: 'ob_1', _fromOpsBackend: true, version: 3, trips: [{ date: '2026-11-05', routeId: 'r1' }], passengers: [] }];
var SB_EXTRAS = [], persisted = 0;
var _bkExtraPay = { m: 'cash', feePct: 3, slips: [], split: true, amts: { cash: '400', transfer: '', card: '250' } }, _bkExtraEditId = null;
function bkxPaySplitOn(){ return !!_bkExtraPay.split; }
function bkxPayParts(){ var out = []; ['cash', 'transfer', 'card'].forEach(function(m){ var a = +_bkExtraPay.amts[m] || 0; if(a > 0) out.push({ method: m, amount: a }); }); return out; }
function bkxPaySplitSum(){ return bkxPayParts().reduce(function(t, q){ return t + q.amount; }, 0); }
function pckNum(n){ return String(n); }
function bookingV2ExtraSave(){ persisted++; } function sbExtrasPersist(){ persisted++; } function insPersist(){} function bookingV2ExtraDayOf(){ return '2026-11-05'; }
function bookingV2ExtraDelete(){} function bookingV2ExtraCollect(){} function ckWrite(){} function ckRead(){ return null; } function _bkxPayReset(){}
var FIELDS = { 'bkx-name': { value: 'Snorkel' }, 'bkx-qty': { value: '1' }, 'bkx-price': { value: '650' }, 'bkx-company': { value: '0' }, 'bkx-seller': { value: '' } };
`;
const exDoc = (fields) => ({ getElementById: (id) => fields[id] || null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} });
const serverSale = { id: 'ex_1', booking_id: 'ob_1', trip_date: '2026-11-05', service: 'Snorkel', qty: 1, unit_price: 650, total: 650, to_company: 0, seller: null,
  method: 'split', split: [{ method: 'cash', amount: 400 }, { method: 'card', amount: 250 }], fee_pct: 3, fee: 7.5, customer_paid: 657.5, settle: 'done', slips: [] };

test('§exSplitPay: an extra paid cash and card is sent as method split with its parts, and reads back as legacy\'s split:… text', async () => {
  const r = runtime({ files: ['40-ops-bookings.js', '36-ops-day-actions.js'], pre: EX_PRE, globals: { localStorage: local, confirm: () => true }, handlers: {
    'POST /v1/bookings/ob_1/tour-sales': { status: 201, body: serverSale }, 'GET /v1/bookings/ob_1': { body: { id: 'ob_1', version: 4 } } } });
  r.ctx.document = exDoc(r.ctx.FIELDS);
  r.ctx.bookingV2ExtraSave('BK-1');
  await r.settle();
  const body = r.requests.find((q) => q.method === 'POST').body;
  assert.deepEqual(plain([body.method, body.split, body.fee_pct]), ['split', [{ method: 'cash', amount: 400 }, { method: 'card', amount: 250 }], 3]);
  assert.equal(r.ctx.SB_EXTRAS[0].method, 'split:cash=400|card=250');
  assert.equal(r.ctx.persisted, 0, 'not the blob');
});

test('§exSplitPay: amounts that do not add up to the sale are stopped in the browser with legacy\'s message; one method is a plain sale', async () => {
  const r = runtime({ files: ['40-ops-bookings.js', '36-ops-day-actions.js'], pre: EX_PRE, globals: { localStorage: local, confirm: () => true }, handlers: {
    'POST /v1/bookings/ob_1/tour-sales': (b) => ({ status: 201, body: { ...serverSale, method: b.method, split: b.split || null } }), 'GET /v1/bookings/ob_1': { body: { id: 'ob_1', version: 4 } } } });
  r.ctx.document = exDoc(r.ctx.FIELDS);
  r.ctx._bkExtraPay.amts.card = '200';
  r.ctx.bookingV2ExtraSave('BK-1');
  await r.settle();
  assert.equal(r.requests.filter((q) => q.method === 'POST').length, 0);
  assert.match(r.alerts[0], /ไม่เท่ายอดขาย/);
  r.ctx._bkExtraPay.amts = { cash: '', transfer: '650', card: '' };
  r.ctx.bookingV2ExtraSave('BK-1');
  await r.settle();
  const body = r.requests.find((q) => q.method === 'POST').body;
  assert.deepEqual([body.method, 'split' in body, body.fee_pct], ['transfer', false, 0]);
});

// ── §closeRelease ──
const CAL_PRE = `
function setInterval(){ return 1; } function clearInterval(){}
var ROUTES = [{ id: 'r1', name: 'Tratato', overrides: {}, seasons: [] }], addSeasonType = 'closed', legacyRel = 0, toasts = [];
function getDayStatus(){ return { type: 'open' }; } function toggleDayOverride(){} function saveNewSeason(){} function delSeason(){}
function saveNewSeasonGuarded(){} function toggleDayOverrideGuarded(){} function progShowImpactModal(){} function progShowImpactModalForDay(){} function progConfirmCloseAnyway(){}
function progReleaseBoats(){ legacyRel++; return []; } function renderSettings(){} function getBoat(id){ return { name: 'Boat ' + id }; }
function flShowToast(m){ toasts.push(m); } function delRoute(){}
`;
test('§closeRelease: the boats the server released on closing a day leave the screen\'s TRIPS, with legacy\'s toast; legacy\'s own sweep does not run', async () => {
  const r = runtime({ files: ['10-ops-catalogue.js'], pre: CAL_PRE, globals: { localStorage: local }, handlers: {
    'PUT /v1/routes/r1/days/2026-12-01': { body: { route_id: 'r1', service_date: '2026-12-01', kind: 'closed', released_boats: [{ service_date: '2026-12-01', boat_id: 'b7' }] } },
    'GET /v1/routes': { body: { routes: [] } }, 'GET /v1/boats': { body: { boats: [] } } } });
  let adopted = null;
  r.O.deployments = { adopt: (c) => { adopted = c; } };
  r.ctx.toggleDayOverride('r1', '2026-12-01');
  await r.settle();
  assert.deepEqual(plain(adopted), [{ date: '2026-12-01', boat: 'b7', remove: true }]);
  assert.match(r.ctx.toasts[0], /ถอดเรือออกจาก Tratato ในวันที่ปิด 1 รายการ · Boat b7/);
  assert.deepEqual(plain([r.ctx.progReleaseBoats('r1'), r.ctx.legacyRel]), [[], 0]);
});
