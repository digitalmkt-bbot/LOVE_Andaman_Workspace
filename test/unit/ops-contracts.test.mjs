import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'allotment_v2/js/ops/18-ops-contracts.js'), 'utf8');

function compat() {
  const window = {};
  const context = {
    window,
    document: {},
    console,
    JSON,
    Number,
    String,
    Object,
    Array,
    Promise,
    Date,
    encodeURIComponent,
    setTimeout,
    clearTimeout,
    confirm: () => false,
    alert: () => {},
  };
  window.laOps = { enabled: () => false, clone: (v) => v == null ? v : JSON.parse(JSON.stringify(v)) };
  vm.runInNewContext(source, context, { filename: '18-ops-contracts.js' });
  return window.__laOpsContractsCompat;
}

test('contract projection maps explicit server program and seat-price rows', () => {
  const c = compat().fromServerContract({
    id: 'ct_promo', agent_id: 'ag_1', kind: 'promo', status: 'active', rate_type_id: 'rt_1',
    active_from: '2027-01-01', active_to: '2027-03-31', priority: 4, version: 'promo-2027-01-01',
    price_mode: 'own', discount: null, bonus: { buy: 10, free: 1, basis: 'ad' }, book_window: true,
    created_date: '2026-12-01', created_by: 'staff', note: 'New year', doc_id: null,
    program_periods: [{ route_id: 'r5', book_from: '2026-12-01', book_to: '2026-12-31', travel_from: '2027-01-01', travel_to: '2027-03-31', note: null }],
    seat_prices: [{ route_id: 'r5', zone: 'PK', category: 'ad', residency: 'foreign', price: 3100 }],
  });
  assert.equal(c.agentId, 'ag_1');
  assert.deepEqual(JSON.parse(JSON.stringify(c.programPeriods[0])), { routeId: 'r5', bookFrom: '2026-12-01', bookTo: '2026-12-31', travelFrom: '2027-01-01', travelTo: '2027-03-31', note: '' });
  assert.equal(c.rates.r5.PK['adult-fr'], 3100);
  assert.deepEqual(JSON.parse(JSON.stringify(c.bonus)), { on: 1, buy: 10, free: 1, basis: 'ad' });
});

test('promo payload uses the backend snake_case contract and seat-price vocabulary', () => {
  const body = compat().toPromoBody({
    priceMode: 'own', rateTypeId: null, activeFrom: '2027-01-01', activeTo: '2027-03-31',
    bookWin: true, priority: 5, note: 'Promo', bonus: { on: 1, buy: 10, basis: 'adchd' },
    rates: { r5: { PK: { 'adult-thai': 2200, 'adult-fr': 3100, 'child-thai': 1200 } } },
    programPeriods: [{ routeId: 'r5', bookFrom: '2026-12-01', bookTo: '2026-12-31' }],
  }, 'ag_1');
  assert.equal(body.agent_id, 'ag_1');
  assert.equal(body.price_mode, 'own');
  assert.deepEqual(JSON.parse(JSON.stringify(body.seat_prices)), [
    { route_id: 'r5', zone: 'PK', category: 'ad', residency: 'thai', price: 2200 },
    { route_id: 'r5', zone: 'PK', category: 'ad', residency: 'foreign', price: 3100 },
    { route_id: 'r5', zone: 'PK', category: 'chd', residency: 'thai', price: 1200 },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(body.bonus)), { buy: 10, free: 1, basis: 'adchd' });
  assert.equal(body.book_from, '2026-12-01');
  assert.equal(compat().promoWriteBody(body, 'ct_promo').agent_id, undefined, 'PATCH must not send the create-only agent_id');
  assert.equal(compat().promoWriteBody(body, null).agent_id, 'ag_1', 'POST keeps the agent binding');
});

test('template projection and request preserve sections/text while excluding server-owned fields', () => {
  const compatApi = compat();
  const t = compatApi.fromServerTemplate({ id: 'ctt_1', code: 'CT-01', name: 'Standard', active: true, is_default: true, created_date: '2026-01-01', note: null, form: 'ocean', accent: 'navy', accent_hex: '#123456', font: 'manrope', sections: { cover: true }, text: { en: { title: 'Hello' } }, agents: 2 });
  assert.equal(t.isDefault, true);
  assert.equal(t.accentHex, '#123456');
  const body = compatApi.templateBody(t);
  assert.deepEqual(body.sections, { cover: true });
  assert.deepEqual(body.text, { en: { title: 'Hello' } });
  assert.equal('id' in body, false);
  assert.equal('is_default' in body, false);
  assert.equal('agents' in body, false);
});

test('new templates let the server allocate a code while edits preserve an existing code', () => {
  const c = compat();
  const created = c.templateBody({ name: 'New', code: '', active: true, sections: {}, text: { en: {}, th: {} } });
  assert.equal('code' in created, false);
  const edited = c.templateBody({ name: 'Edited', code: 'CT-09', active: true, sections: {}, text: { en: {}, th: {} } });
  assert.equal(edited.code, 'CT-09');
});

test('adapter uses shared ops plumbing and keeps the classic tag before boot', () => {
  assert.equal(source.includes('fetch('), false);
  assert.ok(source.includes("/v1/agents/"));
  assert.ok(source.includes("/v1/contract-documents/"));
  assert.ok(source.includes('Legacy artifact metadata mapping is blocked'));
  assert.equal(source.includes("rows.find(function(x){return x&&x.id===id;})"), false, 'blocked artifact reopen must not map legacy artifact ids to documents');
  const html = fs.readFileSync(path.join(root, 'allotment_v2/allotment_v2.html'), 'utf8');
  assert.ok(html.indexOf('js/ops/18-ops-contracts.js') < html.indexOf('js/ops/90-ops-boot.js'));
});
