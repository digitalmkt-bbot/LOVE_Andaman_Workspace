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

/* §ctplFit · the boot load used to paint the hidden Contract Templates view: the preview box had
   no width, the A4 stack was scaled to the 120px floor, and the unchanged-data check kept that
   thumbnail when the page was opened. The page must only be painted while it has a width. */
function bootWithView(width) {
  const window = {};
  const wrap = { offsetWidth: width };
  const calls = [];
  const context = {
    window, console, JSON, Number, String, Object, Array, Promise, Date, encodeURIComponent, setTimeout, clearTimeout,
    confirm: () => false, alert: () => {},
    document: { getElementById: (id) => (id === 'cttv-wrap' ? wrap : null) },
    SB_CONTRACTS: [], SB_CONTRACT_TEMPLATES: {}, _cttSig: 'painted-while-hidden',
    renderContractTemplates: () => { calls.push(wrap.offsetWidth); },
  };
  window.laOps = {
    enabled: () => true,
    clone: (v) => (v == null ? v : JSON.parse(JSON.stringify(v))),
    fail: () => {},
    get: async (p) => {
      if (p === '/v1/contracts') return { contracts: [] };
      if (p === '/v1/contract-templates') return { contract_templates: [{ id: 'ctt_1' }] };
      if (p === '/v1/contract-templates/ctt_1') return { id: 'ctt_1', code: 'CT-01', name: 'Standard', is_default: true };
      throw new Error('unexpected GET ' + p);
    },
  };
  vm.runInNewContext(source, context, { filename: '18-ops-contracts.js' });
  return { context, wrap, calls, api: window.laOpsContracts };
}

test('boot load does not paint the hidden Contract Templates page and forgets its signature', async () => {
  const { context, calls, api } = bootWithView(0);
  await Promise.all([api.load(), api.loadTemplates()]);
  assert.ok(context.SB_CONTRACT_TEMPLATES.ctt_1, 'templates still load into the store');
  assert.deepEqual(calls, [], 'no paint while the view has no width (the preview would scale to 120px)');
  assert.equal(context._cttSig, null, 'nav() must repaint at the real width instead of keeping a hidden paint');
});

test('a load that lands while the page is open paints it, always at a real width', async () => {
  const { calls, api } = bootWithView(1180);
  await Promise.all([api.load(), api.loadTemplates()]);
  assert.ok(calls.length >= 1, 'the open page is repainted with the server data');
  assert.ok(calls.every((w) => w > 0), 'every paint happens after the container has a width');
});

test('adapter uses shared ops plumbing and keeps the classic tag before boot', () => {
  assert.equal(source.includes('fetch('), false);
  assert.ok(source.includes("/v1/agents/"));
  assert.ok(source.includes("/v1/contract-documents/"));
  assert.ok(source.includes('window.ctArtifactReopen=function'), 'reopen is wired to the server document history');
  const html = fs.readFileSync(path.join(root, 'allotment_v2/allotment_v2.html'), 'utf8');
  assert.ok(html.indexOf('js/ops/18-ops-contracts.js') < html.indexOf('js/ops/90-ops-boot.js'));
});

/* §ctplSample · the preview's sample agent gets its full server record, and the per-template
   "N agents" count comes from the server's `agents`. Loads the real agent mapping from
   16-ops-agents.js and runs both adapters against a legacy-shaped global scope. */
function agentMap() {
  const src = fs.readFileSync(path.join(root, 'allotment_v2/js/ops/16-ops-agents.js'), 'utf8');
  const window = { laOps: { onWrite: () => {}, onChange: () => {}, enabled: () => true, get: async () => ({}), call: async () => ({}), queue: (fn) => Promise.resolve().then(fn), wrote: () => {}, fail: () => {} } };
  const noop = () => {};
  vm.runInNewContext(src, { window, SB_AGENTS: [], console, Promise, Array, Object, Error, String, Number, JSON, Set, encodeURIComponent, agRenderList: noop, renderAgKPI: noop, confirm: () => true, alert: noop });
  return window.laOpsAgentMap;
}
const LEGACY_PAGE = [
  "var _cttSig = 'painted';",
  'function cttSampleAgent(){ var list = SB_AGENTS || []; return list.find(function(a){ return a.rateTypeId && (a.programPeriods||[]).length; }) || list.find(function(a){ return a.rateTypeId; }) || list[0] || null; }',
  'function cttUse(id){ return (SB_AGENTS||[]).filter(function(a){ return a.contractTemplateId === id; }).length; }',
  'function renderContractTemplates(){ var a = cttSampleAgent() || {};',
  "  paints.push({ sample: a.name, version: a.contractVersion, address: (a.companyInfo||{}).address, periods: (a.programPeriods||[]).length, use: cttUse('ctt_std') }); }",
].join('\n');
const summaryRow = () => ({ id: 'a1', name: '2 The Beach', rateTypeId: 'rt1', programs: ['r1', 'r2'], programPeriods: [], companyInfo: {} });
async function settle() { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 5)); }
function bootPage({ failDetail = false, width = 900, agents = [summaryRow()] } = {}) {
  const gets = [], warns = [], paints = [], writeListeners = [];
  const wrap = { offsetWidth: width };
  const ctx = {
    console: { log() {}, warn: (m) => warns.push(String(m)), error() {} },
    JSON, Number, String, Object, Array, Promise, Date, encodeURIComponent, setTimeout, clearTimeout,
    confirm: () => false, alert: () => {}, paints,
    document: { getElementById: (id) => (id === 'cttv-wrap' ? wrap : null) },
    SB_CONTRACTS: [], SB_CONTRACT_TEMPLATES: {}, SB_AGENTS: agents,
  };
  ctx.window = ctx;
  ctx.laOpsAgentMap = agentMap();
  ctx.laOps = {
    enabled: () => true, clone: (v) => (v == null ? v : JSON.parse(JSON.stringify(v))), fail: () => {},
    onWrite: (fn) => writeListeners.push(fn),
    catalogue: { load: async () => { ctx.SB_AGENTS.splice(0, ctx.SB_AGENTS.length, summaryRow()); return 'catalogue'; } },
    get: async (p) => {
      gets.push(p);
      if (p === '/v1/contracts') return { contracts: [] };
      if (p === '/v1/contract-templates') return { contract_templates: [{ id: 'ctt_std' }] };
      if (p === '/v1/contract-templates/ctt_std') return { id: 'ctt_std', code: 'CT-STD', name: 'Standard B2B Agreement', is_default: true, agents: 69 };
      if (p === '/v1/agents/a1') {
        if (failDetail) throw new Error('HTTP 503');
        return { id: 'a1', name: '2 The Beach', rate_type_id: 'rt1', contract_version: 'v2025-1', contract_start: '2025-10-01', contract_end: '2026-09-30',
          company: { legal_name: '2 The Beach', address: 'Patong' }, programs: [{ route_id: 'r1' }, { route_id: 'r2' }] };
      }
      throw new Error('unexpected GET ' + p);
    },
  };
  vm.createContext(ctx);
  vm.runInContext(LEGACY_PAGE, ctx);
  vm.runInContext(source, ctx, { filename: '18-ops-contracts.js' });
  return { ctx, wrap, gets, warns, paints, writeListeners };
}

test('the preview draws the sample agent from its full server record, fetched once per session', async () => {
  const { ctx, gets, paints } = bootPage();
  await settle();
  const last = paints.at(-1);
  assert.equal(last.sample, '2 The Beach');
  assert.equal(last.version, 'v2025-1', 'cover shows the contract version, not "—"');
  assert.equal(last.address, 'Patong', 'party box shows the address, not "—"');
  assert.equal(last.periods, 2, 'programme pages are drawn');
  ctx.renderContractTemplates(); ctx.renderContractTemplates();
  await settle();
  assert.equal(gets.filter((p) => p === '/v1/agents/a1').length, 1, 'cached per agent id');
  ctx.SB_AGENTS.splice(0, 1, summaryRow());               // a catalogue reload swaps the list row back in
  ctx.renderContractTemplates();
  await settle();
  assert.equal(paints.at(-1).version, 'v2025-1', 'the cached record is put back on the new row');
  assert.equal(gets.filter((p) => p === '/v1/agents/a1').length, 1);
});

test('a hidden page fetches the sample record ahead but paints nothing', async () => {
  const { gets, paints, ctx } = bootPage({ width: 0 });
  await settle();
  assert.deepEqual(paints, []);
  assert.equal(gets.filter((p) => p === '/v1/agents/a1').length, 1);
  assert.equal(ctx.SB_AGENTS[0].contractVersion, 'v2025-1');
  assert.equal(ctx._cttSig, null, 'nav() paints fresh at the real width');
});

test('the agent list arriving after the templates fetches the sample, so the first paint has it', async () => {
  const { ctx, wrap, gets, paints } = bootPage({ width: 0, agents: [] });
  await settle();
  assert.equal(gets.filter((p) => p === '/v1/agents/a1').length, 0, 'no agents yet');
  assert.equal(await ctx.laOps.catalogue.load(), 'catalogue', 'the boot step still gets its result');
  await settle();
  assert.equal(gets.filter((p) => p === '/v1/agents/a1').length, 1);
  wrap.offsetWidth = 900;                                   // nav() opens the page
  ctx.renderContractTemplates();
  assert.equal(paints[0].version, 'v2025-1', 'the very first paint shows the full record');
});

test('a failed sample fetch keeps the list row, warns in English, and does not retry every paint', async () => {
  const { ctx, gets, warns, paints } = bootPage({ failDetail: true });
  await settle();
  assert.ok(paints.length >= 1, 'the preview still draws');
  assert.equal(paints.at(-1).sample, '2 The Beach');
  assert.equal(paints.at(-1).version, undefined);
  assert.ok(warns.some((w) => /could not load agent a1/.test(w)), warns.join(' | '));
  ctx.renderContractTemplates();
  await settle();
  assert.equal(gets.filter((p) => p === '/v1/agents/a1').length, 1);
});

test('template agent counts come from the server and refresh after an agent write', async () => {
  const { ctx, gets, paints, writeListeners } = bootPage();
  await settle();
  assert.equal(paints.at(-1).use, 69, 'legacy counted SB_AGENTS[].contractTemplateId, which list rows lack (0)');
  assert.equal(ctx.cttUse('missing'), 0);
  const before = gets.filter((p) => p === '/v1/contract-templates').length;
  writeListeners.forEach((fn) => fn('agents'));
  ctx.SB_AGENTS.splice(0, 1, summaryRow());               // and the agent list was reloaded after it
  ctx.renderContractTemplates();
  await settle();
  assert.equal(gets.filter((p) => p === '/v1/contract-templates').length, before + 1, 'counts reloaded once the page is on screen');
  assert.equal(gets.filter((p) => p === '/v1/agents/a1').length, 2, 'the cached record was dropped, so the sample is fetched again');
  assert.equal(paints.at(-1).version, 'v2025-1');
});
