import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

// lk-inbox sync 2026-11-04 (§vanLog / §vanGuard): the van history and the reason for taking a van off a picked-up booking are the
// server's (operation-backend van-audit). The browser asks for the reason when the server refuses without one, and its own scan is off.
const REFUSAL = 'These bookings were already picked up by van (or the trip date has passed).\n'
  + 'Removing or changing their outbound van changes the van bill and the pickup record.\n\n'
  + '- GYG2Q88XBVYH · 3 Nov · van checked in · Van 7 -> (none)\n\nSend the reason (header X-Van-Reason) to continue.';
const refuseOnce = () => {
  let n = 0;
  return () => (++n === 1 ? { status: 409, body: { message: REFUSAL, code: 'van_reason_required' } } : { status: 204 });
};
const local = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

test('§vanGuard: a van command refused for a reason asks once, then sends it again with the reason (URI-encoded header)', async () => {
  const asked = [];
  const r = runtime({ handlers: { 'DELETE /operations/van-groups/g1': refuseOnce() }, globals: { localStorage: local, prompt: (m) => { asked.push(m); return '  ลูกค้าย้ายโรงแรม '; } } });
  await r.O.del('/operations/van-groups/g1');
  assert.equal(asked.length, 1);
  assert.match(asked[0], /GYG2Q88XBVYH · 3 Nov · van checked in/);
  assert.doesNotMatch(asked[0], /X-Van-Reason/, 'the header name is not for staff');
  assert.match(asked[0], /press Cancel to keep the van/);
  assert.deepEqual(r.requests.map((q) => (q.headers || {})['X-Van-Reason'] || null), [null, encodeURIComponent('ลูกค้าย้ายโรงแรม')]);
});

test('§vanGuard: Cancel (or a blank reason) keeps the van: nothing is sent again, the caller gets the refusal as declined', async () => {
  for (const answer of [null, '   ']) {
    const r = runtime({ handlers: { 'DELETE /operations/van-groups/g1': refuseOnce() }, globals: { localStorage: local, prompt: () => answer } });
    const e = await r.O.del('/operations/van-groups/g1').then(() => null, (x) => x);
    assert.equal(e.code, 'van_reason_required');
    assert.equal(e.declined, true);
    assert.equal(r.requests.length, 1);
  }
});

test('§vanGuard: a refusal that still comes back with a reason is not asked again', async () => {
  let asked = 0;
  const r = runtime({ handlers: { 'POST /operations/van-groups/clear': { status: 409, body: { message: REFUSAL, code: 'van_reason_required' } } },
    globals: { localStorage: local, prompt: () => { asked++; return 'x'; } } });
  const e = await r.O.post('/operations/van-groups/clear', { service_date: '2026-11-03', route_id: 'r1' }).then(() => null, (x) => x);
  assert.equal(e.code, 'van_reason_required');
  assert.deepEqual([asked, r.requests.length], [1, 2]);
});

test('§vanGuard: other refusals are untouched', async () => {
  let asked = 0;
  const r = runtime({ handlers: { 'DELETE /operations/van-groups/g1': { status: 409, body: { message: 'no', code: 'cancelled' } } }, globals: { localStorage: local, prompt: () => { asked++; return 'x'; } } });
  const e = await r.O.del('/operations/van-groups/g1').then(() => null, (x) => x);
  assert.deepEqual([e.code, !!e.declined, asked], ['cancelled', false, 0]);
});

// ── §vsPay · a van stop's charge ──
const STOP_PRE = `
function setInterval(){ return 1; } function clearInterval(){}
var VAN_STOPS = {}, SB_BOOKINGS = [], legacy = 0;
function vsSave(){ legacy++; } function tsStopGot(){ legacy++; } function vsDel(){} function vsSetVan(){} function vsCheck(){}
var rendered = 0; function renderTravelSum(){ rendered++; }
`;
const srvStop = (pay) => ({ id: 'vs_1', service_date: '2026-11-05', route_id: 'r1', group_id: 'g1', kind: 'staff', label: 'Guide', pax: 1, place: 'Kata', leg: 'out', pay, checked_in: null, created_at: '2026-11-05T00:00:00Z', seats: 1 });

test('§vsPay: the stop form\'s charge is sent with the stop, and comes back in legacy\'s shape', async () => {
  const pay = { amount: 300, who: 'driver', method: 'cash', got_at: null, got_by: null };
  const r = runtime({ files: ['35-ops-van-jobs.js'], pre: STOP_PRE, globals: { localStorage: local }, handlers: { 'POST /operations/van-stops': { status: 201, body: srvStop(pay) } } });
  r.O.vans = { serverIdOf: () => 'g1', groupInfo: () => ({ vanId: 'v1', number: 1 }) };
  r.ctx.vsSave({ date: '2026-11-05', routeId: 'r1', kind: 'staff', label: 'Guide', pax: 1, place: 'Kata', vanGroup: 1, payAmt: '300', payWho: 'driver', payMethod: 'cash' });
  await r.settle();
  assert.deepEqual(plain(r.requests.find((q) => q.method === 'POST').body.pay), { amount: 300, who: 'driver', method: 'cash' });
  assert.deepEqual(plain(r.ctx.VAN_STOPS['2026-11-05::r1::vs_1'].pay), { amt: 300, who: 'driver', method: 'cash', got: false, gotBy: '', gotAt: '' });
  assert.equal(r.ctx.legacy, 0);
});

test('§vsPay: no amount is no charge', async () => {
  const r = runtime({ files: ['35-ops-van-jobs.js'], pre: STOP_PRE, globals: { localStorage: local }, handlers: { 'POST /operations/van-stops': { status: 201, body: srvStop(null) } } });
  r.O.vans = { serverIdOf: () => 'g1', groupInfo: () => null };
  r.ctx.vsSave({ date: '2026-11-05', routeId: 'r1', kind: 'staff', label: 'Guide', pax: 1, place: 'Kata', vanGroup: 1, payAmt: 0, payWho: 'pier', payMethod: 'cash' });
  await r.settle();
  assert.equal(r.requests.find((q) => q.method === 'POST').body.pay, null);
});

test('§vsPay: Travel Summary\'s collected tick is PUT …/pay-collected (DELETE to undo); the time and who come back from the server', async () => {
  const got = { amount: 300, who: 'pier', method: 'cash', got_at: '2026-11-05T03:00:00Z', got_by: 'Nok' };
  const r = runtime({ files: ['35-ops-van-jobs.js'], pre: STOP_PRE, globals: { localStorage: local }, handlers: {
    'PUT /operations/van-stops/vs_1/pay-collected': { body: srvStop(got) }, 'DELETE /operations/van-stops/vs_1/pay-collected': { body: srvStop({ ...got, got_at: null, got_by: null }) } } });
  r.ctx.tsStopGot('2026-11-05::r1::vs_1', true);
  await r.settle();
  assert.deepEqual([r.ctx.VAN_STOPS['2026-11-05::r1::vs_1'].pay.got, r.ctx.VAN_STOPS['2026-11-05::r1::vs_1'].pay.gotBy, r.ctx.rendered], [true, 'Nok', 1]);
  r.ctx.tsStopGot('2026-11-05::r1::vs_1', false);
  await r.settle();
  assert.equal(r.ctx.VAN_STOPS['2026-11-05::r1::vs_1'].pay.got, false);
  assert.deepEqual(plain(r.requests.map((q) => q.method)), ['PUT', 'DELETE']);
  assert.equal(r.ctx.legacy, 0);
});

// ── §tmPax · the Ranong immigration traveller fields ──
const TM_PRE = `
function setInterval(){ return 1; } function clearInterval(){}
var SB_BOOKINGS = [{ id: 'BK-1', opsId: 'ob_1', _fromOpsBackend: true, trips: [{ date: '2026-11-05', routeId: 'rn1' }], passengers: [] }];
var LOCAL = { 'BK-1::lead': { idNo: 'local' } }, persisted = 0;
function insEff(bkId, pk, f, src){ var o = LOCAL[bkId + '::' + pk]; return (o && o[f] !== undefined) ? o[f] : src; }
function insOv(){ return null; } function insSetField(bkId, pk, f, v){ (LOCAL[bkId + '::' + pk] = LOCAL[bkId + '::' + pk] || {})[f] = v; persisted++; }
function insPersist(){ persisted++; } function sbExtrasPersist(){} function insToggleReviewed(){} function insReviewBoat(){} function insRevertRow(){}
function pckMealSave(){} function ckWrite(){} function ckRead(){ return null; }
`;
test('§tmPax: the fields read from the server once the trip date is loaded; legacy\'s local value answers until then', async () => {
  const r = runtime({ files: ['40-ops-bookings.js', '36-ops-day-actions.js'], pre: TM_PRE, globals: { localStorage: local },
    handlers: { 'GET /v1/tm-pax': { body: { date: '2026-11-05', rows: [{ booking_id: 'ob_1', pax_key: 'lead', id_no: '1234567890121', dob: '12/05/1990' }, { booking_id: 'ob_1', pax_key: '3', en_name: 'Pad Head' }] } } } });
  assert.equal(r.ctx.insEff('BK-1', 'lead', 'idNo', ''), 'local', 'before the answer');
  await r.settle();
  assert.deepEqual([r.ctx.insEff('BK-1', 'lead', 'idNo', ''), r.ctx.insEff('BK-1', 'lead', 'dob', ''), r.ctx.insEff('BK-1', '3', 'enName', ''), r.ctx.insEff('BK-1', '1', 'remark', 'src')],
    ['1234567890121', '12/05/1990', 'Pad Head', 'src']);
  assert.deepEqual(plain(r.requests.map((q) => q.method + ' ' + q.path.split('?')[0])), ['GET /v1/tm-pax'], 'one read per date');
});

test('§tmPax: typing a field is PUT /v1/bookings/{id}/tm-pax/{key}, shown at once, and the server\'s cleaned value kept; nothing goes to the blob', async () => {
  const r = runtime({ files: ['40-ops-bookings.js', '36-ops-day-actions.js'], pre: TM_PRE, globals: { localStorage: local }, handlers: {
    'GET /v1/tm-pax': { body: { rows: [] } },
    'PUT /v1/bookings/ob_1/tm-pax/2': (b) => ({ body: { row: { booking_id: 'ob_1', pax_key: '2', id_laser: 'ME0123', dob: b.dob || null } } }) } });
  r.ctx.insEff('BK-1', '2', 'idLaser', ''); await r.settle();
  r.ctx.insSetField('BK-1', '2', 'idLaser', 'ME0123');
  assert.equal(r.ctx.insEff('BK-1', '2', 'idLaser', ''), 'ME0123', 'shown before the answer');
  await r.settle();
  assert.deepEqual(plain(r.requests.filter((q) => q.method === 'PUT').map((q) => [q.path, q.body])), [['/v1/bookings/ob_1/tm-pax/2', { id_laser: 'ME0123' }]]);
  assert.equal(r.ctx.persisted, 0);
});

// ── §tmDoc · the Ranong boat and crew data ──
test('§tmDoc: tmBoatsRead answers the shared setting and tmBoatsWrite saves the whole object to it', async () => {
  const pre = 'function setInterval(){ return 1; } function clearInterval(){} var blob = 0; function tmBoatsRead(){ return { local: 1 }; } function tmBoatsWrite(){ blob++; }';
  const put = (b, p) => ({ body: { key: p.split('/').pop(), value: b.value, version: 2 } });
  const r = runtime({ files: ['61-ops-config-store.js'], pre, globals: { localStorage: local }, handlers: {
    'GET /v1/config': { body: { entries: [{ key: 'tm_boats', value: { b1: { name: 'TRI-STAR', crew: [] } }, version: 1 }] } }, 'PUT /v1/config/tm_boats': put } });
  await r.settle();
  assert.equal(r.ctx.tmBoatsRead().b1.name, 'TRI-STAR');
  r.ctx.tmBoatsWrite({ b1: { name: 'TRI-STAR', master: 'Ko', crew: [] } });
  await new Promise((done) => setTimeout(done, 700)); await r.settle();
  assert.deepEqual(plain(r.requests.filter((q) => q.method === 'PUT').map((q) => [q.path, q.body.value.b1.master, q.body.version])), [['/v1/config/tm_boats', 'Ko', 1]]);
  assert.equal(r.ctx.blob, 0, 'not the browser blob');
});

test('§vanLog: in ops mode the browser\'s own van scan does nothing (the server writes the lines); with ops off it runs', () => {
  const pre = 'var scans = 0; function bkVanAuditScan(){ scans++; return 1; }';
  const on = runtime({ files: ['34-ops-vans.js'], pre, globals: { localStorage: local } });
  assert.deepEqual([on.ctx.bkVanAuditScan(), on.ctx.scans], [0, 0]);
  const off = runtime({ files: ['34-ops-vans.js'], pre, enabled: false, globals: { localStorage: local } });
  assert.deepEqual([off.ctx.bkVanAuditScan(), off.ctx.scans], [1, 1]);
  assert.deepEqual(plain(on.requests), []);
});
