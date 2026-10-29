import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

// §opsFleetBatteries: FL_BATTERIES comes from /v1/fleet/batteries; fbSave / fbVolt / fbUninstall / fbRetire go to the server first.
const PRE = `
var FL_BATTERIES = [];
var FB = { boat: null, q: '', sel: null, modal: null };
var FB_LIFE_DEFAULT = 18;
var called = []; function legacy(n){ return function(){ called.push(n); }; }
var fbSave = legacy('fbSave'), fbVolt = legacy('fbVolt'), fbUninstall = legacy('fbUninstall'), fbRetire = legacy('fbRetire');
var closed = 0; function fbClose(){ closed++; FB.modal = null; }
var redraws = 0; function fbAfter(){ redraws++; }
var toastsShown = []; function flShowToast(m){ toastsShown.push(m); }
function fbCan(){ return true; }
`;
const SERVER = {
  id: 'bat1', boat_id: 'b1', pos: 'Port', brand: 'AMARON', model: 'FLO', cap: '90', volt: '12V', serial: 'ALU-BT-P-01', cost: 3400, supplier: null, status: 'installed',
  install_date: '2026-10-23', buy_date: null, life_months: 18, warranty_months: 36, spare_location: null, memo_no: null, replaced_id: null, replaced_by_id: null,
  retired_date: null, retired_reason: null, note: null, age: { state: 'ok' },
  log: [{ date: '2026-10-23', type: 'install', desc: 'ติดตั้ง Alula Port', volt: null, by: 'Maprang' }, { date: '2026-10-26', type: 'volt', desc: 'วัดโวลต์ 12.6V', volt: 12.6, by: 'RM' }],
  photos: [{ id: 'ph1', attachment_id: 'att1', caption: 'label', stage: 'Battery', kind: 'photo', hidden: false, added_at: '2026-10-23T04:04:39.791Z', added_by: 'Maprang' }],
};
function form(values) {
  const els = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { value: v }]));
  return { getElementById: (id) => els[id] || null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} };
}
function rt(handlers, { globals = {}, enabled = true } = {}) {
  const r = runtime({ files: [], handlers: { ...JOBS, ...handlers }, pre: PRE, globals, enabled });
  r.load('24-ops-fleet-jobs.js');
  r.load('25-ops-fleet-batteries.js');
  return r;
}
const list = (r) => plain(r.ctx.FL_BATTERIES);
// 24-ops-fleet-jobs.js (O.fleetPhotoFrom) loads jobs and incidents in the background: answered empty, and left out of what is checked.
const JOBS = { 'GET /v1/fleet/incidents': { body: { incidents: [] } }, 'GET /v1/fleet/jobs': { body: { jobs: [] } } };
const bat = (r) => r.requests.filter((q) => q.path.includes('/batteries'));

test('load: FL_BATTERIES is the server list in legacy shape (camelCase, "" for none, photos and log mapped)', async () => {
  const r = rt({ 'GET /v1/fleet/batteries': { body: { batteries: [SERVER] } } });
  await r.O.fleetBatteries.load(); await r.settle();
  const b = list(r)[0];
  assert.deepEqual([b.id, b.boatId, b.pos, b.installDate, b.lifeMonths, b.warrantyMonths, b.supplier, b.spareLocation], ['bat1', 'b1', 'Port', '2026-10-23', 18, 36, '', '']);
  assert.deepEqual(b.log, [{ date: '2026-10-23', type: 'install', desc: 'ติดตั้ง Alula Port', by: 'Maprang' }, { date: '2026-10-26', type: 'volt', desc: 'วัดโวลต์ 12.6V', by: 'RM', volt: 12.6 }]);
  assert.deepEqual([b.photos[0].attId, b.photos[0].cap, b.photos[0].stage, b.photos[0].url], ['att1', 'label', 'Battery', '/api/attach/att1']);
  assert.ok(r.ctx.redraws > 0, 'the open screen is drawn again');
});

test('fbSave (new): the form goes to the server; the battery shown is the one it answers; the form closes', async () => {
  const doc = form({ 'fb-status': 'installed', 'fb-boat': 'b1', 'fb-pos': 'Port', 'fb-inst': '2026-10-29', 'fb-brand': 'AMARON', 'fb-model': 'FLO', 'fb-cap': '90',
    'fb-volt': '12V', 'fb-cost': '3,400', 'fb-serial': '', 'fb-supplier': '', 'fb-buy': '', 'fb-life': '18', 'fb-war': '12', 'fb-memo': 'MO-1', 'fb-note': '' });
  const r = rt({ 'POST /v1/fleet/batteries': { status: 201, body: { ...SERVER, id: 'batNew', serial: 'ALU-BT-P-02' } } }, { globals: { document: doc } });
  r.ctx.FB.modal = { id: null, replaceId: null };
  r.ctx.fbSave(); await r.settle();
  assert.deepEqual(plain(r.requests[0].body), {
    brand: 'AMARON', model: 'FLO', cap: '90', volt: '12V', cost: 3400, serial: '', supplier: '', buy_date: null, life_months: 18, warranty_months: 12,
    memo_no: 'MO-1', note: '', status: 'installed', boat_id: 'b1', pos: 'Port', install_date: '2026-10-29',
  });
  assert.deepEqual(list(r).map((b) => [b.id, b.serial]), [['batNew', 'ALU-BT-P-02']]);
  assert.equal(r.ctx.closed, 1);
  assert.equal(r.ctx.FB.sel, 'batNew');
  assert.deepEqual(plain(r.ctx.toastsShown), ['Battery saved']);
  assert.deepEqual(plain(r.ctx.called), [], 'legacy fbSave (local only) is not run');
});

test('fbSave refused: the server message shows, nothing changes on screen, the form stays open', async () => {
  const doc = form({ 'fb-status': 'installed', 'fb-boat': 'b1', 'fb-pos': 'Port', 'fb-inst': '', 'fb-cost': '', 'fb-life': '', 'fb-war': '' });
  const r = rt({ 'POST /v1/fleet/batteries': { status: 400, body: { statusCode: 400, message: 'Install date is required (install_date)' } } }, { globals: { document: doc } });
  r.ctx.FB.modal = { id: null, replaceId: null };
  r.ctx.fbSave(); await r.settle();
  assert.deepEqual(list(r), []);
  assert.equal(r.ctx.closed, 0);
  assert.ok(r.toasts.some((t) => /Install date is required/.test(t.sub)), JSON.stringify(r.toasts));
});

test('fbSave on an open battery sends a PATCH; a spare sends its store, not a boat; a replace sends replace_id and reads the list again', async () => {
  const spareDoc = form({ 'fb-status': 'spare', 'fb-sploc': 'คลัง Ranong', 'fb-boat': 'b1', 'fb-pos': 'Port', 'fb-cost': '0', 'fb-life': '18', 'fb-war': '0' });
  let r = rt({ 'GET /v1/fleet/batteries': { body: { batteries: [SERVER] } }, 'PATCH /v1/fleet/batteries/bat1': { body: { ...SERVER, status: 'spare', boat_id: null, pos: null, spare_location: 'คลัง Ranong' } } },
    { globals: { document: spareDoc } });
  await r.O.fleetBatteries.load();
  r.ctx.FB.modal = { id: 'bat1', replaceId: null };
  r.ctx.fbSave(); await r.settle();
  const patch = plain(bat(r)[1]);
  assert.equal(patch.method + ' ' + patch.path, 'PATCH /v1/fleet/batteries/bat1');
  assert.equal(patch.body.spare_location, 'คลัง Ranong');
  assert.equal('boat_id' in patch.body, false);
  assert.deepEqual([list(r)[0].status, list(r)[0].boatId], ['spare', '']);
  assert.deepEqual(plain(r.ctx.toastsShown), ['Battery updated']);

  const repDoc = form({ 'fb-status': 'installed', 'fb-boat': 'b1', 'fb-pos': 'Port', 'fb-inst': '2026-10-29', 'fb-rep-why': 'หมดอายุ', 'fb-cost': '0', 'fb-life': '18', 'fb-war': '0' });
  let reads = 0;
  r = rt({
    'GET /v1/fleet/batteries': () => { reads++; return { body: { batteries: reads === 1 ? [SERVER] : [{ ...SERVER, status: 'retired', replaced_by_id: 'batNew' }, { ...SERVER, id: 'batNew', replaced_id: 'bat1' }] } }; },
    'POST /v1/fleet/batteries': { status: 201, body: { ...SERVER, id: 'batNew', replaced_id: 'bat1' } },
  }, { globals: { document: repDoc } });
  await r.O.fleetBatteries.load();
  r.ctx.FB.modal = { id: null, replaceId: 'bat1' };
  r.ctx.fbSave(); await r.settle();
  assert.deepEqual([bat(r)[1].body.replace_id, bat(r)[1].body.replace_reason], ['bat1', 'หมดอายุ']);
  assert.deepEqual(list(r).map((b) => [b.id, b.status]), [['bat1', 'retired'], ['batNew', 'installed']], 'both batteries as the server now has them');
});

test('fbVolt, fbUninstall and fbRetire are server commands; a cancelled prompt sends nothing', async () => {
  const answers = ['12.1', null, 'คลัง Tub Lamu', 'เสื่อม'];
  const r = rt({
    'GET /v1/fleet/batteries': { body: { batteries: [SERVER] } },
    'POST /v1/fleet/batteries/bat1/volt': { body: SERVER },
    'POST /v1/fleet/batteries/bat1/uninstall': { body: { ...SERVER, status: 'spare', boat_id: null } },
    'POST /v1/fleet/batteries/bat1/retire': { body: { ...SERVER, status: 'retired', boat_id: null } },
  }, { globals: { prompt: () => answers.shift() } });
  await r.O.fleetBatteries.load();
  r.ctx.fbVolt('bat1'); await r.settle();
  r.ctx.fbUninstall('bat1'); await r.settle();   // prompt cancelled
  r.ctx.fbUninstall('bat1'); await r.settle();
  r.ctx.fbRetire('bat1'); await r.settle();
  assert.deepEqual(bat(r).slice(1).map((q) => [q.method + ' ' + q.path, plain(q.body)]), [
    ['POST /v1/fleet/batteries/bat1/volt', { volt: 12.1 }],
    ['POST /v1/fleet/batteries/bat1/uninstall', { location: 'คลัง Tub Lamu' }],
    ['POST /v1/fleet/batteries/bat1/retire', { reason: 'เสื่อม' }],
  ]);
  assert.equal(list(r)[0].status, 'retired');
});

test('ops off: the legacy functions run as before', () => {
  const r = rt({}, { enabled: false });
  r.ctx.fbSave(); r.ctx.fbVolt('x'); r.ctx.fbUninstall('x'); r.ctx.fbRetire('x');
  assert.deepEqual(plain(r.ctx.called), ['fbSave', 'fbVolt', 'fbUninstall', 'fbRetire']);
  assert.equal(r.requests.length, 0);
});

test('a battery photo goes to /v1/fleet/batteries/{id}/photos and the battery is read again', async () => {
  const PRE2 = `function flpRec(k,i){ return k==='bat' ? (FL_BATTERIES.filter(function(x){return x.id===i;})[0]||null) : null; }
function flpFind(k,rec,pid){ return (rec.photos||[]).filter(function(p){ return p.id===pid; })[0]||null; }
function flpCan(){ return true; } var refreshed = 0; function flpRefresh(){ refreshed++; }`;
  const r = runtime({ files: [], pre: PRE + PRE2, handlers: { ...JOBS,
    'GET /v1/fleet/batteries': { body: { batteries: [SERVER] } },
    'POST /v1/fleet/batteries/bat1/photos/ph1/hide': { body: {} },
    'GET /v1/fleet/batteries/bat1': { body: { ...SERVER, photos: [{ ...SERVER.photos[0], hidden: true }] } },
  } });
  r.load('24-ops-fleet-jobs.js'); r.load('25-ops-fleet-batteries.js'); r.load('99-ops-fleet-photos.js');
  await r.O.fleetBatteries.load();
  r.ctx.flpHide('bat', 'bat1', 'ph1'); await r.settle();
  assert.deepEqual(bat(r).map((q) => q.method + ' ' + q.path), ['GET /v1/fleet/batteries', 'POST /v1/fleet/batteries/bat1/photos/ph1/hide', 'GET /v1/fleet/batteries/bat1']);
  assert.equal(plain(r.ctx.FL_BATTERIES)[0].photos[0].removed, true);
  assert.equal(r.ctx.refreshed, 1);
});
