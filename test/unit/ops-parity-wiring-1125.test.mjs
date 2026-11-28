// UI parity wiring, run 2026-11-24T20-27-37 (docs: the parity notes of 2026-11-25).
//   N7  a repaint that lands while laOps.busy() is kept (laOps.whenFree), and busy() only counts an edit the person can see
//   N4  the Dashboard's "⚠ ต้องจัดการ" counts come from the server
//   N2  Van Jobs shows a loading line until the day's /operations/van-jobs answer, not legacy's demo vans
//   N3  Re-confirm / Pier Check-in read the van catalogue (GET /operations/vans), never the demo vans
//   N11 Travel Summary section 03 draws each on-tour sale, the sellers, the per-method sale chips; the Manifest the bill slip
//   F4  Exec board pier chip reads "TL + Panwa"
//   N14 Pier job sheet fields stay disabled until the day's job cards (and their lock) have landed
//   node --test test/unit/ops-parity-wiring-1125.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { load as loadTs, bk, SUMMARY, DATE, section } from './travelsum-harness.mjs';

const PICKUP = fs.readFileSync('allotment_v2/js/ops/00-ops-pickup.js', 'utf8');
const CORE = fs.readFileSync('allotment_v2/js/ops/00-ops-core.js', 'utf8');
const SRV = fs.readFileSync('allotment_v2/js/ops/73-ops-srv-reads.js', 'utf8');
const DASH = fs.readFileSync('allotment_v2/js/ops/60-ops-dashboard.js', 'utf8');
const VANS = fs.readFileSync('allotment_v2/js/ops/34-ops-vans.js', 'utf8');
const VANJOBS = fs.readFileSync('allotment_v2/js/ops/35-ops-van-jobs.js', 'utf8');
const PLATE = fs.readFileSync('allotment_v2/js/ops/39-ops-rc-day-plate.js', 'utf8');
const EXEC = fs.readFileSync('allotment_v2/js/ops/99-ops-exec-board.js', 'utf8');
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)); };

/* a document with one focused element and focusout listeners */
function fakeDoc({ active = null, hosts = {} } = {}) {
  const listeners = [];
  return {
    activeElement: active, listeners,
    getElementById: (id) => hosts[id] || null,
    querySelector: (sel) => (/nav-item/.test(sel) ? { dataset: { view: fakeDoc.view || 'dashboard' } } : null),
    addEventListener: (type, fn) => { if (type === 'focusout') listeners.push(fn); },
  };
}
const shownEl = (tag, type) => ({ tagName: tag, type, isConnected: true, getClientRects: () => [1] });
const hiddenEl = (tag, type) => ({ tagName: tag, type, isConnected: true, getClientRects: () => [] });

function core(doc, extra = {}) {
  const ctx = {
    console, Promise, Error, JSON, Object, Array, Number, String, Math, Date, parseInt, isNaN, encodeURIComponent,
    setTimeout, clearTimeout, setInterval, clearInterval,
    LA_LEGACY_UNAVAILABLE: true, sessionStorage: { getItem: () => 'tok' }, document: doc, ...extra,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(PICKUP, ctx);
  vm.runInContext(CORE, ctx);
  return ctx;
}

// ── N7 · busy() and whenFree ─────────────────────────────────────────────────

test('busy: a visible text field is an edit; a hidden one, a checkbox, a left-open new booking are not', () => {
  const doc = fakeDoc({ active: shownEl('INPUT', 'text') });
  const ctx = core(doc);
  assert.equal(ctx.laOps.busy(), true, 'typing in a visible field');
  doc.activeElement = hiddenEl('INPUT', 'date');
  assert.equal(ctx.laOps.busy(), false, 'a field on a page left behind (hidden with its view)');
  doc.activeElement = shownEl('INPUT', 'checkbox');
  assert.equal(ctx.laOps.busy(), false, 'a ticked checkbox keeps focus but is no edit');
  doc.activeElement = shownEl('SELECT');
  assert.equal(ctx.laOps.busy(), true, 'an open select');
  doc.activeElement = null;
  ctx._bkV2 = { newBooking: { x: 1 } };
  assert.equal(ctx.laOps.busy(), false, 'a new booking left open while another page is shown (no bkv2-host on screen)');
  doc.getElementById = (id) => (id === 'bkv2-host' ? shownEl('DIV') : null);
  assert.equal(ctx.laOps.busy(), true, 'the new booking form on screen');
});

test('whenFree: runs now when free, otherwise once the field loses focus (never dropped, once per fn)', async () => {
  const doc = fakeDoc({ active: shownEl('TEXTAREA') });
  const ctx = core(doc);
  let n = 0; const paint = () => { n++; };
  ctx.laOps.whenFree(paint); ctx.laOps.whenFree(paint);
  assert.equal(n, 0, 'held while the person types');
  doc.activeElement = null;
  doc.listeners.forEach((fn) => fn());
  await settle();
  assert.equal(n, 1, 'ran once when the field lost focus');
  ctx.laOps.whenFree(paint);
  assert.equal(n, 2, 'free: runs at once');
});

// ── N4 · Dashboard needs-action counts ───────────────────────────────────────

test('dashboard: pending approvals, open weather follow-ups and cancelled-today are the server\'s needs_action, in the one Dashboard read', async () => {
  const doc = fakeDoc();
  const ctx = core(doc, {
    _dashBoardData: () => ({ pend: 0, wx: 0, wxDate: '2026-11-25', cxl: 0, unN: 0 }),
    renderDash() { ctx.drawn = (ctx.drawn || 0) + 1; },
  });
  const asked = [];
  ctx.laOpsFetch = async (path) => {
    asked.push(path);
    const p = path.split('?')[0];
    const body = p === '/v1/dashboard' ? { version: 1, generated_at: new Date().toISOString(), summary: {}, bookings: { cancelled_today: 4 }, unbilled: { count: 1, baht: 1, agents: 1 },
      needs_action: { pending_approval: 1, weather_to_resolve: 5, weather_first_date: '2026-07-02', cancelled_today: 4 } } : null;
    return { status: 200, ok: true, text: async () => JSON.stringify(body) };
  };
  vm.runInContext(SRV, ctx);
  vm.runInContext(DASH, ctx);
  const before = ctx._dashBoardData();
  assert.deepEqual([before.pend, before.wx, before.cxl], [0, 0, 0], 'until the answer lands the legacy figures stay');
  await ctx.laOps.dashboard.ensure(ctx.laOps.today(), 'day', '', { bare: true });
  await settle();
  const d = ctx._dashBoardData();
  assert.deepEqual([d.pend, d.wx, d.wxDate, d.cxl], [1, 5, '2026-07-02', 4], 'needs_action → pend, wx, wxDate, cxl');
  assert.deepEqual(asked.map((p) => p.split('?')[0]), ['/v1/dashboard'], 'no separate bookings or weather-closures reads any more');
  assert.ok(ctx.drawn >= 1, 'the Dashboard is drawn again when the answer lands');
});

// ── N2 / N3 · Van Jobs first paint and the van catalogue ─────────────────────

function vanRuntime({ jobs, catalogue } = {}) {
  const host = { innerHTML: '' }, legacy = [];
  const doc = fakeDoc({ hosts: { 'vanjobs-host': host, 'reconfirm-host': {} } });
  fakeDoc.view = 'vanjobs';
  const ctx = core(doc, {
    SB_BOOKINGS: [], ROUTES: [], SB_VEHICLES: [{ id: 'veh1', name: 'Minibus 1', plate: 'กข 5678' }, { id: 'veh2', name: 'Partner Van A', plate: 'พง 2233' }],
    VAN_STOPS: {}, VANJOB_DRIVER: {}, VANJOB_SENT: {}, VANJOB_SREQ: {}, VANJOB_PICKUP_TH: {},
    _vanJobsDate: '2026-11-25', _vanCkDate: '2026-11-25', _rcDate: '2026-11-25',
    renderVanJobs() { legacy.push('renderVanJobs'); }, renderVanCheckin() {}, renderReconfirm() { legacy.push('renderReconfirm:' + ctx.SB_VEHICLES.map((v) => v.plate).join(',')); },
    bkOpsRead: (b) => (b && b.ops) || {}, bkOpsFor: (b) => (b.ops = b.ops || {}),
  });
  let release;
  const jobsGate = new Promise((r) => { release = r; });
  ctx.laOpsFetch = async (path) => {
    const p = path.split('?')[0];
    if (p === '/operations/van-jobs') await jobsGate;
    if (p === '/operations/van-days' && !path.includes('from=2026-11-25&to=2026-11-25')) await new Promise(() => {});   // the 63-day window is slow: it never lands here
    const body = p === '/operations/van-jobs' ? { date: '2026-11-25', jobs: jobs || [{ key: 'g1', service_date: '2026-11-25', route_id: 'r7', group_id: 'g1', group_number: 1, van_id: 'veh11',
        van: { name: 'VAN1', plate: null, capacity: 13, ownership: 'partner', partner_name: 'Co' }, driver: { name: 'พี่ตอง', phone: '080', plate: '30-6916', override: true, plate_override: true },
        sent: { at: '2026-11-24T11:37:39Z', by: null, changed_since_sent: null } }] }
      : p === '/operations/vans' ? { vans: catalogue || [{ id: 'veh03', name: 'Love3', plate: '31-6675', capacity: 13, ownership: 'own' }] }
      : p === '/operations/van-days' ? { vans: [], days: [] }
      : p === '/operations/pickup-names-th' ? { names: [] }
      : p === '/operations/van-groups' ? { groups: [] } : p === '/operations/van-groups/day' ? { routes: [] } : p === '/operations/van-stops' ? { stops: [] } : p === '/operations/van-arrivals' ? { arrivals: [] } : {};
    return { status: 200, ok: true, text: async () => JSON.stringify(body) };
  };
  vm.runInContext(VANS, ctx);
  vm.runInContext(VANJOBS, ctx);
  vm.runInContext(PLATE, ctx);
  return { ctx, host, legacy, release };
}

test('van jobs: a loading line until the day\'s van-jobs answer, then the jobs\' own vans and sent marks', async () => {
  const rt = vanRuntime();
  rt.ctx.renderVanJobs();
  assert.match(rt.host.innerHTML, /Loading van jobs/, 'no legacy walk over the demo vans');
  assert.deepEqual(rt.legacy, [], 'legacy\'s render is not run before the answer');
  rt.release();
  await settle();
  assert.ok(rt.legacy.includes('renderVanJobs'), 'drawn once the answer is in');
  const v = rt.ctx.SB_VEHICLES.find((x) => x.id === 'veh11');
  assert.equal(v.name, 'VAN1'); assert.equal(v.capacity, 13); assert.equal(v.ownership, 'partner');
  assert.ok(!rt.ctx.SB_VEHICLES.some((x) => x.plate === 'กข 5678'), 'the demo vans are gone');
  assert.equal(rt.ctx.VANJOB_SENT['2026-11-25::veh11~r7~1'], '2026-11-24T11:37:39Z');
  assert.deepEqual(JSON.parse(JSON.stringify(rt.ctx.VANJOB_DRIVER['2026-11-25::veh11'])), { driver: 'พี่ตอง', phone: '080', plate: '30-6916' });
});

test('re-confirm: the demo vans go before the first draw and the catalogue fills SB_VEHICLES', async () => {
  const rt = vanRuntime();
  rt.ctx.renderReconfirm();
  assert.equal(rt.legacy[0], 'renderReconfirm:', 'first draw: no demo plate');
  await settle();
  // the second draw goes through O.redrawLater, a 40 ms timer (00-ops-core.js). settle() lasts ~35 ms on Linux (Windows rounds each
  // 0 ms timer up, which hid this), so wait out the code's own timer instead of counting ticks
  await new Promise((r) => setTimeout(r, 40)); await settle();
  assert.deepEqual(rt.ctx.SB_VEHICLES.map((v) => [v.id, v.plate]), [['veh03', '31-6675']]);
  assert.equal(rt.legacy[rt.legacy.length - 1], 'renderReconfirm:31-6675', 'drawn again with the real plates');
});

// ── N11 · Travel Summary ─────────────────────────────────────────────────────

test('travel summary 03: each sale as legacy prints it, the seller, and the sale chip tagged ขายเพิ่ม', async () => {
  const bookings = [bk('b1', 'r_pw')];
  const summary = { ...SUMMARY, collect_rows: [{ booking_id: 'b1', voucher_ref: 'V-b1', route_id: 'r_pw', target: 0, paid: 0, due: 0, cot: 0, received: { cash: 1000 }, sales: { count: 1, total: 1000, got: 1000, due: 0 } }] };
  const h = loadTs({ laSlipClickAttr: () => 'data-slip="1"' }, { bookings, summary });
  h.ctx.laOpsPierMoney = { rowById: (id) => (id === 'b1' ? { booking_id: 'b1', payments: [], tour_sales: [
    { id: 'ex1', service: 'Longtail Join', qty: 2, total: 1000, commission: 300, to_company: 700, seller: 'RSVN', method: 'cash', fee: 0, settle: 'done', slips: [], covered_by_pier: false, pier_duplicate: false }] } : null),
    sigOf: () => 'sig', loadDay: () => Promise.resolve({}) };
  await h.ctx.window.renderTravelSum();
  const s3 = section(h.host.innerHTML, '03');
  assert.match(s3, /Longtail Join ×2 <b>฿1,000<\/b> <i[^>]*>· คอม ฿300<\/i>/);
  assert.match(s3, /<td class="ts-mono" style="font-size:10.5px">RSVN<\/td>/);
  assert.match(s3, /เงินสด ฿1,000 <i[^>]*>ขายเพิ่ม<\/i>/);
});

test('travel summary 04: an invoice of this booking alone shows 📎 สลิปบิล and the Proforma paid day', async () => {
  const bookings = [bk('b1', 'r_pw', { agent_id: 'ag1', invoice: { id: 'inv1', number: 'INV-1', status: 'paid' } })];
  const h = loadTs({ laSlipClickAttr: () => 'data-slip="1"', sbGetAgent: () => ({ name: 'AG', payType: 'proforma' }) }, { bookings });
  const get = h.ctx.laOps.get;
  h.ctx.laOps.get = (path, q) => path === '/v1/invoices/inv1'
    ? Promise.resolve({ id: 'inv1', number: 'INV-1', booking_ids: ['b1'], payments: [{ amount: 1500, paid_on: '2026-11-24', slips: [{ id: 'att1' }] }] })
    : get(path, q);
  h.ctx.laOps.whenFree = (fn) => fn(); h.ctx.laOps.activeView = () => 'travelsum';
  await h.ctx.window.renderTravelSum();
  await settle(); await new Promise((r) => setTimeout(r, 300)); await settle();
  await h.ctx.window.renderTravelSum();
  const s4 = section(h.host.innerHTML, '04');
  assert.match(s4, /Proforma · 24\/11\/2026/);
  assert.match(s4, /&#128206; สลิปบิล<\/span>/);
});

// ── F4 · Exec board pier chip ────────────────────────────────────────────────

test('exec board: the all-piers chip reads "TL + Panwa" as legacy, never "ทุกท่า"', () => {
  assert.equal((EXEC.match(/seg\('pier', \[\['', 'TL \+ Panwa'\]/g) || []).length, 4);
  assert.ok(!/seg\('pier', \[\['', 'ทุกท่า'\]/.test(EXEC));
});

// ── N14 · pier job sheet fields wait for the day's job cards ─────────────────

test('pier job: the sheet\'s own fields are held disabled until the job cards have landed', async () => {
  const SOURCES = ['42-ops-pier-core.js', '43-ops-pier-lists.js', '47-ops-pier-job.js'].map((f) => fs.readFileSync('allotment_v2/js/ops/' + f, 'utf8'));
  const field = (handler) => { const attrs = { onchange: handler }; return { disabled: false, title: '', getAttribute: (k) => attrs[k] || null, setAttribute: (k, v) => { attrs[k] = v; } }; };
  let fields = [];
  const host = { querySelectorAll: () => fields };
  let release; const gate = new Promise((r) => { release = r; });
  const answer = (p) => {
    if (p === '/v1/pier-office') return { item_kinds: [], items: [], attendance_codes: [], sections: [], staff: [], license_types: [], license_classes: [] };
    if (/\/boats\/b4\/job$/.test(p)) return gate.then(() => ({ pier: 'panwa', date: '2026-11-25', boat_id: 'b4', recorded: true, crew: [], island: [], duty_staff_ids: [], substitutes: [], missing: [], completed_at: '2026-11-25T01:00:00Z' }));
    if (/\/days\/2026-11-25\/boats$/.test(p)) return { boats: [], fleet: [] };
    return Promise.reject(new Error('no answer ' + p));
  };
  let renders = 0;
  const win = {
    laOps: { enabled: () => true, onWrite() {}, onChange() {}, get: (p) => Promise.resolve(answer(p)), call: (m, p) => Promise.resolve(answer(p)), queue: (fn) => Promise.resolve().then(fn),
      anyway: () => {}, wrote() {}, fail() {}, toast() {} },
    _poPier: 'panwa', _poDate: '2026-11-25', poPersist() {}, poModalClose() {},
    renderPierJob: () => { renders++; fields = [field("pjWcSet('b4',this.value)"), field("pjMjPick('b4',this.value)"), field('poSetDate(this.value)')]; },
    pjAllBoats: () => [{ bid: 'b4' }], pjLockMiss: () => [], pjWbOf: () => ({}), pjSubList: () => ({}), pjCopyYday() {},
    pjRaw: () => null, poYMD: (d) => d.toISOString().slice(0, 10), PIER_JOB: {}, PIER_TEAM: {}, PIER_DUTY: {},
  };
  const ctx = { window: win, console, Promise, Array, Object, Error, String, Number, JSON, Math, encodeURIComponent, isFinite, parseInt, setTimeout, clearTimeout, Date,
    document: { getElementById: (id) => (id === 'pj-host-panwa' ? host : null), activeElement: null } };
  vm.createContext(ctx);
  SOURCES.forEach((s) => vm.runInContext(s, ctx));
  win.renderPierJob();
  assert.deepEqual(fields.map((f) => f.disabled), [true, true, false], 'pj… fields held; the date picker is not');
  release(); await settle(); await settle();
  assert.ok(renders >= 2, 'drawn again once the cards are in');
  assert.deepEqual(fields.map((f) => f.disabled), [false, false, false], 'after the load the legacy render decides (its lro)');
  assert.equal(win.PIER_JOB['2026-11-25::b4'].lock, 1, 'the completed card is locked');
});
