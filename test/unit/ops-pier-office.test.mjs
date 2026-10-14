import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCES = ['42-ops-pier-core.js', '43-ops-pier-lists.js', '48-ops-pier-office.js'].map((f) => fs.readFileSync('allotment_v2/js/ops/' + f, 'utf8'));
const J = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));
const PIER = 'panwa', DATE = '2026-10-12';
const SETTINGS = { cycle_start: 26, on_boat_code: 'PP', mt_code: 'MT', dd_code: null, def_code: 'SE', night_code: 'N', lic_warn_days: 60, pay_ws_min_cap: 650, pay_ws_min_crew: 450, display: {} };
const LISTS = {
  item_kinds: [{ id: 'pk_fin', name: 'Fin', name_en: null, unit: 'pc', color: '#000', sort: 1, active: true }, { id: 'pk_towel', name: 'Towel', name_en: null, unit: 'pc', color: '#111', sort: 2, active: true }],
  items: [{ id: 'pi_a', pier: PIER, kind_id: 'pk_fin', label: 'Fin M', total: 40, active: true, note: null }, { id: 'pi_t', pier: PIER, kind_id: 'pk_towel', label: 'Towel', total: 100, active: true, note: null }],
  attendance_codes: [], sections: [],
  staff: [{ id: 'ps_1', pier: PIER, nick: 'A', name: 'Aa', role: 'captain', phone: null, active: true, default_code: null, section_id: null, note: null, sort: 1 }],
  license_types: [{ id: 'deck', side: 'deck', short: 'Captain', formal: null, per_boat: 1, active: true }],
  license_classes: [{ id: 'deck1', type_id: 'deck', name: 'First', max_gt: 500, max_bhp: null, sort: 1 }],
};
const BAL = (o) => ({ ready: 40, on_boat: 0, on_ship: 0, dirty: 0, laundry: 0, repair: 0, gone: 0, inhand: 40, ...o });
const MOVE = (o) => ({ id: 'pm_1', pier: PIER, date: DATE, item_id: 'pi_a', boat_id: null, type: 'receive', qty: 5, source: 'buy', from_kind: null, fine_baht: null,
  sheet_id: null, note: null, recorded_at: 't', recorded_by: 'GSA', edited_at: null, edited_by: null, fine_status: null, ...o });
const LIC = { id: 'pl_1', staff_id: 'ps_1', class_id: 'deck1', licence_no: 'No1', issued_on: '2025-01-01', expires_on: '2027-01-01', issuer: 'Marine', note: null, state: 'ok', days_left: 400 };

function runtime({ enabled = true, answers = {}, confirmAnswer = true, dom = {} } = {}) {
  const calls = [], fails = [], wrote = [], legacy = [], listeners = [], confirms = [];
  const req = (method, path, body) => {
    calls.push(body === undefined ? { method, path } : { method, path, body: J(body) });
    const a = answers[method + ' ' + path];
    if (typeof a === 'function') return Promise.resolve().then(() => a(body));
    if (a instanceof Error) return Promise.reject(a);
    if (a !== undefined) return Promise.resolve(J(a));
    return Promise.reject(new Error('no answer for ' + method + ' ' + path));
  };
  const defaults = {
    'GET /v1/pier-office': LISTS, 'GET /v1/pier-office/settings': SETTINGS, 'GET /v1/pier-office/panwa/stock': { pier: 'panwa', items: [] },
    'GET /v1/pier-office/panwa/moves?from=2000-01-01&limit=5000': { pier: 'panwa', from: '2000-01-01', to: null, total: 0, moves: [] },
    'GET /v1/pier-office/pay-rules': { rules: [{ code: 'PP', multiplier: 1, per_day: 0, flat: 0 }], defaulted: false },
    'GET /v1/pier-office/staff/ps_1/licences': { staff_id: 'ps_1', licences: [LIC] },
  };
  ['tublamu', 'panwa', 'ranong'].forEach((p) => { defaults['GET /v1/pier-office/' + p + '/pay?cycle=2026-09'] = { people: p === PIER ? [{ staff_id: 'ps_1', rate: 800 }] : [] }; });
  defaults['GET /v1/pier-office/' + PIER + '/pay?cycle=2026-09'] = { people: [{ staff_id: 'ps_1', rate: 800, total: 800, missing: false, parts: [{ code: 'PP', days: 1, amount: 800, ws: null }] }] };
  Object.keys(defaults).forEach((k) => { if (answers[k] === undefined) answers[k] = defaults[k]; });
  const qs = (q) => { const s = new URLSearchParams(q || {}).toString(); return s ? '?' + s : ''; };
  const anyway = (send, rules, preset) => {
    const once = (extra) => send(extra).catch((e) => {
      const r = e && e.status === 409 && rules[e.code];
      if (!r || extra[r.flag]) throw e;
      confirms.push(e.message);
      if (!confirmAnswer) { e.declined = true; throw e; }
      return once({ ...extra, [r.flag]: true });
    });
    return once({ ...(preset || {}) });
  };
  const win = {
    laOps: {
      enabled: () => enabled, get: (p, q) => req('GET', p + qs(q)), call: req, queue: (fn) => Promise.resolve().then(fn), anyway,
      wrote: (k) => { wrote.push(k); listeners.forEach((f) => f(k)); }, onWrite: (f) => listeners.push(f),
      fail: (title, e) => fails.push({ title, code: e && e.code, message: e && e.message }), toast: () => {},
    },
    _poPier: PIER, _poDate: DATE, _paDate: '2026-10-05',
    poPersist: () => { legacy.push('poPersist'); }, poModalClose: () => { legacy.push('modalClose'); },
    renderPierOffice: () => { legacy.push('renderPierOffice'); }, renderPierAtt: () => { legacy.push('renderPierAtt'); },
    poYMD: (d) => d.toISOString().slice(0, 10),
    paCycle: () => ({ from: '2026-09-26', to: '2026-10-25' }),
    paCell: () => ({ c: 'LEGACY', src: 'none', boat: '', atPier: '' }),
    paPayOf: () => ({ total: -1, parts: [], missing: false, rate: null }),
    poBal: () => ({ ready: -1, onboat: 0, onship: 0, dirty: 0, laundry: 0, repair: 0, gone: 0, inhand: -1 }),
    poBoatStage: () => ({ k: 'legacy' }),
    poBoatSum: () => ({ pi_a: { iss: -1, ret: 0, rep: 0, wo: 0, lost: 0, ob: 0 }, pi_t: { iss: 0, ret: 0, rep: 0, wo: 0, lost: 0, ob: 0 } }), poBoatCarry: () => ({ legacy: 1 }),
    poCloseOpen: (b) => { legacy.push('poCloseOpen:' + b); }, poCloseSave: (b) => { legacy.push('poCloseSave:' + b); }, poSheetPending: () => 'legacy', plCheckBoat: () => [{ lv: 'bad', t: 'legacy' }],
    poIssueOpen: (b) => { legacy.push('poIssueOpen:' + b); }, poIssueDraft: () => { legacy.push('poIssueDraft'); }, poIssueSave: () => { legacy.push('poIssueSave'); },
    poIsPrint: () => { legacy.push('poIsPrint'); }, poSignSheet: (b) => { legacy.push('poSignSheet:' + b); }, poDayGuard: () => true, poIsRead: () => {},
    poIsPax: (r) => (+r.ad || 0), paPayCan: () => true,
    PIER_CFG: {}, PIER_SHIFT: {}, PIER_MOVES: [], PIER_SHEET: {}, PIER_LICENSES: [], PIER_STAFF: [], PIER_ITEMS: [],
    SB_BOOKINGS: [{ id: 'B1', opsId: 'srv_B1' }],
    getBoat: (id) => ({ name: 'Boat ' + id }),
  };
  const ctx = { window: win, console, Promise, Array, Object, Error, String, Number, JSON, Math, encodeURIComponent, isFinite, parseInt, URLSearchParams,
    document: { getElementById: (id) => dom[id] || null, activeElement: null }, setTimeout, clearTimeout, Date, confirm: () => true };
  const vmc = vm.createContext(ctx);
  SOURCES.forEach((s) => vm.runInContext(s, vmc));
  const flush = async () => { for (let i = 0; i < 8; i++) { await new Promise((r) => setTimeout(r, 3)); await new Promise((r) => setImmediate(r)); } };
  return { w: win, calls, fails, wrote, legacy, flush, confirms, answers };
}
const writes = (rt) => rt.calls.filter((c) => c.method !== 'GET');
const boot = async (rt) => { await rt.w.laOps.pier.load(); await rt.flush(); };
const save = async (rt) => { rt.w.poPersist(); await rt.w.laOps.pier.flush(); await rt.flush(); };

test('legacy mode: every getter is legacy\'s and nothing is called', async () => {
  const rt = runtime({ enabled: false });
  assert.equal(rt.w.paCell('2026-10-05', PIER, { id: 'ps_1' }).c, 'LEGACY');
  assert.equal(rt.w.poBal('pi_a').ready, -1);
  assert.equal(rt.w.paPayOf('ps_1').total, -1);
  assert.equal(rt.w.plCheckBoat('b1', ['ps_1'])[0].t, 'legacy');
  rt.w.poIssueDraft('b1'); rt.w.poIssueSave('b1'); rt.w.poIsPrint('b1');
  assert.deepEqual(rt.legacy.filter((x) => /poIssue|poIsPrint/.test(x)), ['poIssueDraft', 'poIssueSave', 'poIsPrint']);
  assert.deepEqual(rt.calls, []);
});

test('load: settings, licence types and classes, licences and pay are filled from the server', async () => {
  const rt = runtime();
  await boot(rt);
  const c = rt.w.PIER_CFG;
  assert.equal(c.cycleStart, 26); assert.equal(c.nightCode, 'N'); assert.equal(c.ddCode, ''); assert.equal(c.licWarnDays, 60);
  assert.deepEqual(J(c.payWsMin), { cap: 650, crew: 450 });
  assert.deepEqual(J(rt.w.PIER_LIC_TYPES), [{ id: 'deck', side: 'deck', short: 'Captain', formal: '', perBoat: 1, active: true }]);
  assert.deepEqual(J(rt.w.PIER_LIC_CLASSES), [{ id: 'deck1', typeId: 'deck', name: 'First', maxGt: 500, maxBhp: null, ord: 1 }]);
  assert.deepEqual(J(rt.w.PIER_LICENSES), [{ id: 'pl_1', staffId: 'ps_1', classId: 'deck1', no: 'No1', exp: '2027-01-01', issuedAt: '2025-01-01', issuer: 'Marine', note: '' }]);
  assert.equal(c.payRate.ps_1, 800);
  assert.deepEqual(J(c.payRules), { PP: { x: 1, d: 0, f: 0 } });
  assert.deepEqual(writes(rt), [], 'a load writes nothing');
});

test('settings: only the scalar that changed is PATCHed; a refusal puts it back', async () => {
  const rt = runtime({ answers: { 'PATCH /v1/pier-office/settings': (b) => ({ ...SETTINGS, ...b }) } });
  await boot(rt);
  rt.w.PIER_CFG.licWarnDays = 30; rt.w.PIER_CFG.payWsMin = { cap: 700, crew: 450 };
  await save(rt);
  assert.deepEqual(writes(rt).map((c) => [c.method, c.path, c.body]), [['PATCH', '/v1/pier-office/settings', { lic_warn_days: 30, pay_ws_min_cap: 700 }]]);
  const bad = runtime({ answers: { 'PATCH /v1/pier-office/settings': Object.assign(new Error('cycle_start must be a whole number from 1 to 28'), { status: 400 }) } });
  await boot(bad);
  bad.w.PIER_CFG.cycleStart = 31;
  await save(bad);
  assert.equal(bad.fails.length, 1);
  assert.equal(bad.w.PIER_CFG.cycleStart, 26);
});

test('licences: add, change and delete; a class is added under its type', async () => {
  const rt = runtime({ answers: {
    'POST /v1/pier-office/staff/ps_1/licences': { ...LIC, id: 'pl_new', licence_no: 'No2' },
    'PATCH /v1/pier-office/licences/pl_1': {}, 'DELETE /v1/pier-office/licences/pl_1': {},
    'POST /v1/pier-office/license-classes': { id: 'plc_9', type_id: 'deck', name: 'Second', max_gt: 60, max_bhp: null, sort: 2 },
  } });
  await boot(rt);
  rt.w.PIER_LICENSES.push({ id: 'pl_local', staffId: 'ps_1', classId: 'deck1', no: 'No2', exp: '', issuedAt: '', issuer: '', note: '' });
  rt.w.PIER_LICENSES[0].exp = '2028-01-01';
  rt.w.PIER_LIC_CLASSES.push({ id: 'plc_local', typeId: 'deck', name: 'Second', maxGt: '60', maxBhp: null, ord: 2 });
  await save(rt);
  const w = writes(rt).map((c) => [c.method, c.path, c.body]);
  assert.deepEqual(w.find((x) => x[1].endsWith('/licences')), ['POST', '/v1/pier-office/staff/ps_1/licences', { class_id: 'deck1', licence_no: 'No2', issued_on: null, expires_on: null, issuer: null, note: null }]);
  assert.deepEqual(w.find((x) => x[1].endsWith('license-classes')), ['POST', '/v1/pier-office/license-classes', { name: 'Second', max_gt: 60, max_bhp: null, type_id: 'deck' }]);
  assert.deepEqual(w.find((x) => x[0] === 'PATCH'), ['PATCH', '/v1/pier-office/licences/pl_1', { expires_on: '2028-01-01' }]);
  assert.equal(rt.w.PIER_LICENSES[1].id, 'pl_new', 'the server\'s id replaces the local one');
  rt.w.PIER_LICENSES = rt.w.PIER_LICENSES.filter((l) => l.id !== 'pl_1');
  await save(rt);
  assert.ok(writes(rt).some((c) => c.method === 'DELETE' && c.path === '/v1/pier-office/licences/pl_1'));
});

test('licence check: the server answers, and the job screen is drawn again', async () => {
  const rt = runtime({ answers: { 'POST /v1/pier-office/boats/b1/licence-check': [{ level: 'warn', text: 'soon' }] } });
  rt.w.renderPierJob = () => rt.legacy.push('renderPierJob');
  await boot(rt);
  assert.equal(rt.w.plCheckBoat('b1', ['ps_1'])[0].t, 'legacy', 'until the answer arrives');
  await rt.flush();
  assert.deepEqual(J(rt.w.plCheckBoat('b1', ['ps_1'])), [{ lv: 'warn', t: 'soon' }]);
  assert.ok(rt.legacy.includes('renderPierJob'));
  assert.deepEqual(rt.calls.filter((c) => c.path.includes('licence-check')).map((c) => c.body), [{ crew: ['ps_1'] }]);
});

const ROSTER = '/v1/pier-office/panwa/roster?from=2026-09-26&to=2026-10-25';
const rosterAnswer = (hand) => ({ pier: PIER, from: '2026-09-26', to: '2026-10-25', days: [{ date: '2026-10-05', has_job: true }], rows: [{ staff_id: 'ps_1', cells: [
  { date: '2026-10-05', code: hand || 'PP', layer: hand ? 'manual' : 'boat', boat_id: 'b1', at_pier: PIER, slot: 'cap', hand_code: hand || null, is_plan: false, night_code: null }] }] });

test('roster: the cell shown is the server\'s; a hand-set code is a PUT; a refusal puts it back', async () => {
  const rt = runtime({ answers: { ['GET ' + ROSTER]: rosterAnswer(null), 'PUT /v1/pier-office/panwa/roster/2026-10-05/ps_1': { staff_id: 'ps_1', date: '2026-10-05', code: 'OFF', layer: 'manual', boat_id: null, at_pier: null } } });
  await boot(rt);
  rt.w.renderPierAtt(); await rt.flush();
  const cell = rt.w.paCell('2026-10-05', PIER, { id: 'ps_1' });
  assert.deepEqual(J(cell), { c: 'PP', src: 'boat', boat: 'Boat b1', atPier: PIER, rid: '' });
  rt.w.PIER_SHIFT['2026-10-05::ps_1'] = { c: 'OFF', by: 'me', at: 'now' };
  assert.equal(rt.w.paCell('2026-10-05', PIER, { id: 'ps_1' }).c, 'LEGACY', 'a pending edit shows what was typed (legacy path)');
  await save(rt);
  assert.deepEqual(writes(rt).map((c) => [c.method, c.path, c.body]), [['PUT', '/v1/pier-office/panwa/roster/2026-10-05/ps_1', { code: 'OFF', is_plan: false }]]);
  // night code + plan
  rt.answers['PUT /v1/pier-office/panwa/roster/2026-10-05/ps_1'] = { staff_id: 'ps_1', code: 'OFF', layer: 'manual' };
  rt.w.PIER_SHIFT['2026-10-05::ps_1'] = { c: 'OFF', plan: 1, n: 'N' };
  await save(rt);
  assert.deepEqual(writes(rt).slice(-1)[0].body, { code: 'OFF', is_plan: true, night_code: 'N' });
  const bad = runtime({ answers: { ['GET ' + ROSTER]: rosterAnswer('PP'), 'PUT /v1/pier-office/panwa/roster/2026-10-05/ps_1': Object.assign(new Error('not a roster code'), { status: 400 }) } });
  await boot(bad); bad.w.renderPierAtt(); await bad.flush();
  assert.deepEqual(J(bad.w.PIER_SHIFT['2026-10-05::ps_1']), { c: 'PP', by: '', at: '' });
  bad.w.PIER_SHIFT['2026-10-05::ps_1'].c = 'ZZ';
  await save(bad);
  assert.equal(bad.w.PIER_SHIFT['2026-10-05::ps_1'].c, 'PP');
  assert.equal(bad.fails.length, 1);
});

test('a staff member who is not in a loaded range is never written', async () => {
  const rt = runtime({ answers: { ['GET ' + ROSTER]: rosterAnswer(null) } });
  await boot(rt);
  rt.w.PIER_SHIFT['2020-01-01::ps_1'] = { c: 'OFF' };
  rt.w.renderPierAtt(); await rt.flush();
  await save(rt);
  assert.deepEqual(writes(rt), []);
});

test('roster: multi-pier switching preserves cached rosters and paHasJob reflects server days', async () => {
  const ROSTER_PANWA = '/v1/pier-office/panwa/roster?from=2026-09-26&to=2026-10-25';
  const ROSTER_TUBLAMU = '/v1/pier-office/tublamu/roster?from=2026-09-26&to=2026-10-25';
  const rt = runtime({ answers: {
    ['GET ' + ROSTER_PANWA]: { pier: 'panwa', from: '2026-09-26', to: '2026-10-25', days: [{ date: '2026-10-05', has_job: true }, { date: '2026-10-06', has_job: false }], rows: [{ staff_id: 'ps_1', cells: [{ date: '2026-10-05', code: 'PP', layer: 'boat', boat_id: 'b1', at_pier: 'panwa' }] }] },
    ['GET ' + ROSTER_TUBLAMU]: { pier: 'tublamu', from: '2026-09-26', to: '2026-10-25', days: [{ date: '2026-10-05', has_job: false }], rows: [{ staff_id: 'ps_2', cells: [{ date: '2026-10-05', code: 'TB', layer: 'boat', boat_id: 'b2', at_pier: 'tublamu' }] }] },
  } });
  await boot(rt);
  rt.w._poPier = 'panwa';
  rt.w.renderPierAtt(); await rt.flush();
  assert.equal(rt.w.paCell('2026-10-05', 'panwa', { id: 'ps_1' }).c, 'PP');
  assert.equal(rt.w.paHasJob('2026-10-05', 'panwa'), true);
  assert.equal(rt.w.paHasJob('2026-10-06', 'panwa'), false);

  rt.w._poPier = 'tublamu';
  rt.w.renderPierAtt(); await rt.flush();
  assert.equal(rt.w.paCell('2026-10-05', 'tublamu', { id: 'ps_2' }).c, 'TB');
  assert.equal(rt.w.paHasJob('2026-10-05', 'tublamu'), false);

  rt.w._poPier = 'panwa';
  assert.equal(rt.w.paCell('2026-10-05', 'panwa', { id: 'ps_1' }).c, 'PP');
  assert.equal(rt.w.paHasJob('2026-10-05', 'panwa'), true);
});

test('pay: the allowance comes from the server; a rate is a PUT; the rules go as the whole table', async () => {
  const rt = runtime({ answers: {
    'PUT /v1/pier-office/staff/ps_1/pay-rate': { staff_id: 'ps_1', rate: 900 },
    'PUT /v1/pier-office/pay-rules': { rules: [{ code: 'PP', multiplier: 2, per_day: 10, flat: 0 }], defaulted: false },
  } });
  await boot(rt);
  rt.w._paPay = true; rt.w._paDate = '2026-10-05';
  rt.w.renderPierAtt(); await rt.flush();
  const p = rt.w.paPayOf('ps_1', {}, 0, {});
  assert.deepEqual(J(p), { total: 800, parts: [{ code: 'PP', days: 1, amt: 800, note: '' }], missing: false, rate: 800 });
  rt.w.PIER_CFG.payRate.ps_1 = 900;
  assert.equal(rt.w.paPayOf('ps_1').total, -1, 'a pending edit shows what was typed (legacy formula)');
  rt.w.PIER_CFG.payRules = { PP: { x: 2, d: 10, f: 0 } };
  await save(rt);
  assert.deepEqual(writes(rt).map((c) => [c.method, c.path, c.body]), [
    ['PUT', '/v1/pier-office/staff/ps_1/pay-rate', { rate: 900 }],
    ['PUT', '/v1/pier-office/pay-rules', { rules: [{ code: 'PP', multiplier: 2, per_day: 10, flat: 0 }] }],
  ]);
});

test('stock: balances are the server\'s; receive, count and laundry go to their commands and the server\'s moves replace the local ones', async () => {
  const bal = (o) => [{ item_id: 'pi_a', label: 'Fin M', ...BAL(o) }];
  let ready = 40; const ledger = [];
  const rt = runtime({ answers: {
    'GET /v1/pier-office/panwa/stock': () => ({ pier: PIER, items: [{ id: 'pi_a', label: 'Fin M', kind_id: 'pk_fin', total: 40, active: true, note: null, ...BAL({ ready, inhand: ready }) }] }),
    'GET /v1/pier-office/panwa/moves?from=2000-01-01&limit=5000': () => ({ pier: PIER, total: ledger.length, moves: ledger.slice().reverse() }),
    'POST /v1/pier-office/panwa/stock/receive': () => { ready = 45; ledger.push(MOVE({})); return { moves: [MOVE({})], counts: [], balances: bal({ ready: 45, inhand: 45 }) }; },
    'POST /v1/pier-office/panwa/stock/count': () => { ready = 42; ledger.push(MOVE({ id: 'pm_2', type: 'count', qty: -3, source: null, note: 'month end · counted 42 (books 45)' })); return { moves: [ledger[1]], counts: [], balances: bal({ ready: 42, inhand: 42 }) }; },
  } });
  await boot(rt);
  rt.w.renderPierOffice(); await rt.flush();
  assert.equal(rt.w.poBal('pi_a').ready, 40);
  rt.w.PIER_MOVES.push({ id: 'pm_local1', date: DATE, pier: PIER, itemId: 'pi_a', boatId: '', type: 'receive', qty: 5, from: 'buy', note: 'bill 1' });
  await save(rt);
  assert.deepEqual(writes(rt).map((c) => [c.path, c.body]), [['/v1/pier-office/panwa/stock/receive', { date: DATE, lines: [{ item_id: 'pi_a', qty: 5 }], note: 'bill 1', source: 'buy' }]]);
  assert.equal(rt.w.poBal('pi_a').ready, 45);
  assert.deepEqual(rt.w.PIER_MOVES.map((m) => [m.id, m.srv]), [['pm_1', true]]);
  rt.w.PIER_MOVES.push({ id: 'pm_local2', date: DATE, pier: PIER, itemId: 'pi_a', boatId: '', type: 'count', qty: -3, note: 'month end · นับได้ 42 (บัญชี 45)' });
  await save(rt);
  assert.deepEqual(writes(rt).slice(-1)[0].body, { date: DATE, lines: [{ item_id: 'pi_a', qty: 42 }], note: 'month end' }, 'the server takes the number counted, not the difference');
  assert.equal(rt.w.poBal('pi_a').ready, 42);
});

test('stock: a refused command takes the local move away and shows the server\'s message', async () => {
  const refusal = Object.assign(new Error('Fin M: 3 more than the ready stock'), { status: 409, code: 'not_enough' });
  const rt = runtime({ answers: { 'POST /v1/pier-office/panwa/boats/b1/stock/assign': refusal,
    'GET /v1/pier-office/panwa/stock': { pier: PIER, items: [] } } });
  await boot(rt);
  rt.w.PIER_MOVES.push({ id: 'pm_x', date: DATE, pier: PIER, itemId: 'pi_a', boatId: 'b1', type: 'assign', qty: 3, note: '' });
  await save(rt);
  assert.equal(rt.w.PIER_MOVES.length, 0);
  assert.equal(rt.fails.length, 1);
  assert.equal(rt.fails[0].message, 'Fin M: 3 more than the ready stock');
});

test('stock: a move the server has no command for is refused, not kept in the browser', async () => {
  const rt = runtime();
  await boot(rt);
  rt.w.PIER_MOVES.push({ id: 'pm_y', date: DATE, pier: PIER, itemId: 'pi_a', boatId: 'b1', type: 'bogus', qty: 1 });
  await save(rt);
  assert.equal(rt.w.PIER_MOVES.length, 0);
  assert.match(rt.fails[0].message, /bogus/);
  assert.deepEqual(writes(rt), []);
});

test('ship write-off and ship repair are their own commands, grouped by note, with no fine', async () => {
  const rt = runtime({ answers: {
    'POST /v1/pier-office/panwa/boats/b1/stock/ship-writeoff': { boat_id: 'b1', moves: [MOVE({ id: 'pm_w', type: 'ship_writeoff', boat_id: 'b1', source: null, note: 'cracked' })], balances: [{ item_id: 'pi_a', ...BAL({}) }] },
    'POST /v1/pier-office/panwa/boats/b1/stock/ship-repair': { boat_id: 'b1', moves: [MOVE({ id: 'pm_p', type: 'ship_repair', boat_id: 'b1', source: null, note: 'strap' })], balances: [{ item_id: 'pi_a', ...BAL({}) }] },
  } });
  await boot(rt);
  const m = (o) => ({ date: DATE, pier: PIER, itemId: 'pi_a', boatId: 'b1', ...o });
  rt.w.PIER_MOVES.push({ id: 'w1', ...m({ type: 'ship_writeoff', qty: 1, note: 'cracked' }) }, { id: 'w2', ...m({ type: 'ship_writeoff', qty: 2, note: 'cracked' }) },
    { id: 'r1', ...m({ type: 'ship_repair', qty: 1, note: 'strap' }) });
  await save(rt);
  assert.deepEqual(writes(rt).map((c) => [c.path, c.body]), [
    ['/v1/pier-office/panwa/boats/b1/stock/ship-writeoff', { date: DATE, lines: [{ item_id: 'pi_a', qty: 3 }], note: 'cracked' }],
    ['/v1/pier-office/panwa/boats/b1/stock/ship-repair', { date: DATE, lines: [{ item_id: 'pi_a', qty: 1 }], note: 'strap' }]]);
  assert.deepEqual(rt.w.PIER_MOVES.map((x) => [x.id, x.type, x.srv]), [['pm_w', 'ship_writeoff', true], ['pm_p', 'ship_repair', true]]);
});

test('ledger: the pier\'s moves are read into PIER_MOVES (oldest first), fines come with their status, unsent moves stay', async () => {
  const lost = MOVE({ id: 'pm_l', date: '2026-10-11', type: 'lost', boat_id: 'b1', qty: 2, source: null, fine_baht: 300, fine_status: 'paid',
    fine: { move_id: 'pm_l', status: 'paid', how: 'cash', note: null, paid_at: 'p', paid_by: 'GSA' } });
  const older = MOVE({ id: 'pm_o', date: '2026-10-01', type: 'issue', boat_id: 'b1', qty: 4, source: null });
  const rt = runtime({ answers: { 'GET /v1/pier-office/panwa/moves?from=2000-01-01&limit=5000': { pier: PIER, from: '2000-01-01', to: null, total: 2, moves: [lost, older] } } });
  await boot(rt);
  rt.w.PIER_MOVES.push({ id: 'old_blob', srv: true, date: '2026-09-01', pier: PIER, itemId: 'pi_a', boatId: '', type: 'receive', qty: 1 },
    { id: 'mine', date: DATE, pier: PIER, itemId: 'pi_a', boatId: '', type: 'receive', qty: 1, from: 'buy' });
  rt.w.renderPierOffice(); await rt.flush();
  assert.deepEqual(rt.w.PIER_MOVES.map((m) => m.id), ['mine', 'pm_o', 'pm_l'], 'the blob\'s old server-side row goes, the unsent one stays');
  const l = rt.w.PIER_MOVES.find((m) => m.id === 'pm_l');
  assert.equal(l.fine, 300); assert.equal(l.finePaid, true);
  assert.deepEqual(J(rt.w.PIER_CFG.finePay.pm_l), { st: 'paid', at: 'p', by: 'GSA', how: 'cash', note: '' });
  const asked = rt.calls.filter((c) => c.path.indexOf('/moves') > 0);
  assert.equal(asked.length, 1);
});

test('ledger: a fine already settled on the server is not sent again', async () => {
  const lost = MOVE({ id: 'pm_l', type: 'lost', boat_id: 'b1', qty: 2, source: null, fine_baht: 300, fine_status: 'waived',
    fine: { move_id: 'pm_l', status: 'waived', how: null, note: 'regular', paid_at: 'p', paid_by: 'GSA' } });
  const rt = runtime({ answers: { 'GET /v1/pier-office/panwa/moves?from=2000-01-01&limit=5000': { pier: PIER, from: '2000-01-01', to: null, total: 1, moves: [lost] } } });
  await boot(rt);
  rt.w.renderPierOffice(); await rt.flush();
  await save(rt);
  assert.deepEqual(writes(rt), []);
});

test('ledger: a truncated answer is said out loud; a failed read is a toast, not a crash', async () => {
  const rt = runtime({ answers: { 'GET /v1/pier-office/panwa/moves?from=2000-01-01&limit=5000': { pier: PIER, from: '2000-01-01', to: null, total: 9000, moves: [MOVE({})] } } });
  await boot(rt);
  rt.w.renderPierOffice(); await rt.flush();
  assert.match(rt.fails[0].message, /newest 1 of 9000/);
  const rt2 = runtime({ answers: { 'GET /v1/pier-office/panwa/moves?from=2000-01-01&limit=5000': new Error('down') } });
  await boot(rt2);
  rt2.w.renderPierOffice(); await rt2.flush();
  assert.equal(rt2.fails.filter((f) => f.message === 'down').length, 1);
});

test('close dialog: the boat\'s outstanding is read first and poBoatSum / poBoatCarry answer from it until the next write', async () => {
  const OUT = '/v1/pier-office/panwa/days/' + DATE + '/boats/b1/outstanding';
  const rt = runtime({ answers: { ['GET ' + OUT]: { pier: PIER, date: DATE, boat_id: 'b1', stage: { k: 'open' }, items: [
    { item_id: 'pi_a', label: 'Fin M', carry: 3, issued: 5, returned: 2, repair: 0, writeoff: 0, lost: 1, onboard: 0, outstanding: 5 }] } } });
  await boot(rt);
  rt.w._poDate = DATE;
  await rt.w.poCloseOpen('b1');
  assert.deepEqual(rt.legacy.filter((x) => /poCloseOpen/.test(x)), ['poCloseOpen:b1'], 'the legacy dialog opens after the read');
  assert.deepEqual(J(rt.w.poBoatCarry(DATE, 'b1')), { pi_a: 3 });
  assert.deepEqual(J(rt.w.poBoatSum(DATE, 'b1', PIER).pi_a), { iss: 5, ret: 2, rep: 0, wo: 0, lost: 1, ob: 0 });
  assert.equal(rt.w.poBoatSum(DATE, 'b1', PIER).pi_t.iss, 0, 'items the server did not list keep legacy\'s zero row');
  // a move waiting to be sent on this boat: legacy's own sums, which include it
  rt.w.PIER_MOVES.push({ id: 'u1', date: DATE, pier: PIER, itemId: 'pi_a', boatId: 'b1', type: 'return', qty: 1 });
  assert.deepEqual(J(rt.w.poBoatCarry(DATE, 'b1')), { legacy: 1 });
  // a write clears the answer
  rt.w.PIER_MOVES.length = 0;
  rt.w.laOps.wrote('pier');
  assert.deepEqual(J(rt.w.poBoatCarry(DATE, 'b1')), { legacy: 1 });
});

test('close dialog: a failed outstanding read is a toast and the dialog still opens', async () => {
  const OUT = '/v1/pier-office/panwa/days/' + DATE + '/boats/b1/outstanding';
  const rt = runtime({ answers: { ['GET ' + OUT]: new Error('down') } });
  await boot(rt);
  await rt.w.poCloseOpen('b1');
  assert.equal(rt.fails.length, 1);
  assert.deepEqual(rt.legacy.filter((x) => /poCloseOpen/.test(x)), ['poCloseOpen:b1']);
});

test('close dialog, legacy mode: nothing is read', async () => {
  const rt = runtime({ enabled: false });
  rt.w.poCloseOpen('b1');
  assert.deepEqual(rt.calls, []);
  assert.deepEqual(rt.legacy, ['poCloseOpen:b1']);
  assert.deepEqual(J(rt.w.poBoatCarry(DATE, 'b1')), { legacy: 1 });
});

/* poCloseSave · server first: the dialog's numbers are the close command; nothing changes before the answer */
const CLOSE = '/v1/pier-office/panwa/days/' + DATE + '/boats/b1/close';
const OUTST = '/v1/pier-office/panwa/days/' + DATE + '/boats/b1/outstanding';
const MISS = [{ k: 'repair' }, { k: 'writeoff' }, { k: 'lost' }, { k: 'onboard' }];
const closeDom = () => ({
  pocwmsg: { textContent: 'old' }, poret_pi_a: { value: '2' }, pom_repair_pi_a: { value: '1' }, pom_writeoff_pi_a: { value: '0' },
  pom_lost_pi_a: { value: '2' }, pom_onboard_pi_a: { value: '0' }, pofine_pi_a: { value: '300' },
  poret_pi_t: { value: '0' },   // on the dialog, but nothing of it is out: never sent
});
const closeOpen = async (rt) => {
  rt.w.PO_MISS = MISS;
  await boot(rt);
  await rt.w.poCloseOpen('b1');
};
const OUTST_ANSWER = { pier: PIER, date: DATE, boat_id: 'b1', stage: { k: 'open' }, items: [
  { item_id: 'pi_a', label: 'Fin M', carry: 0, issued: 5, returned: 0, repair: 0, writeoff: 0, lost: 0, onboard: 0, outstanding: 5 }] };

test('boat close (server first): one close command from the dialog; moves, balances and stage come from the answer', async () => {
  const dom = closeDom();
  let seenAtSend = null;
  const held = [];   // what the server holds: the office reads its ledger again after the write
  const LEDGER = 'GET /v1/pier-office/panwa/moves?from=2000-01-01&limit=5000';
  let bal = [], stage = 'open';
  const rt = runtime({ dom, answers: { [LEDGER]: () => ({ pier: PIER, from: '2000-01-01', to: null, total: held.length, moves: held.slice().reverse() }),
    'GET /v1/pier-office/panwa/stock': () => ({ pier: PIER, items: bal.map((b) => ({ id: b.item_id, ...b })) }),
    ['GET /v1/pier-office/panwa/days/' + DATE + '/boats']: () => ({ boats: [{ boat_id: 'b1', stage, left: 0, issued: 5, carry: 0, onboard: 0, sheet_status: null }], closed: null, reopens: [] }),
    ['GET ' + OUTST]: OUTST_ANSWER, ['POST ' + CLOSE]: () => {
    bal = [{ item_id: 'pi_a', ...BAL({ ready: 37, repair: 1, gone: 2 }) }]; stage = 'closed';
    seenAtSend = { moves: rt.w.PIER_MOVES.length, legacy: rt.legacy.slice() };
    held.push(MOVE({ id: 'pm_r', type: 'return', boat_id: 'b1', qty: 2, source: null }), MOVE({ id: 'pm_p', type: 'repair', boat_id: 'b1', qty: 1, source: null }),
              MOVE({ id: 'pm_l', type: 'lost', boat_id: 'b1', qty: 2, source: null, fine_baht: 300, fine_status: 'open' }));
    return { boat_id: 'b1', date: DATE,
      moves: held.slice(),
      balances: [{ item_id: 'pi_a', ...BAL({ ready: 37, repair: 1, gone: 2 }) }], stage: { k: 'closed', left: 0, issued: 5, done: 5, carry: 0, onboard: 0 } };
  } } });
  await closeOpen(rt);
  const ok = await rt.w.poCloseSave('b1');
  assert.equal(ok, true);
  assert.deepEqual(writes(rt).map((c) => [c.method, c.path, c.body]), [['POST', CLOSE,
    { lines: [{ item_id: 'pi_a', returned: 2, repair: 1, writeoff: 0, lost: 2, onboard: 0, fine_baht: 300 }] }]], 'one command; pi_t (nothing out) is not sent');
  assert.deepEqual(seenAtSend, { moves: 0, legacy: ['poCloseOpen:b1'] }, 'nothing added, closed or drawn before the server answers');
  assert.deepEqual(rt.w.PIER_MOVES.map((m) => [m.id, m.type, m.qty, !!m.srv]), [['pm_r', 'return', 2, true], ['pm_p', 'repair', 1, true], ['pm_l', 'lost', 2, true]]);
  const lost = rt.w.PIER_MOVES.find((m) => m.type === 'lost');
  assert.equal(lost.fine, 300); assert.equal(lost.finePaid, false);
  assert.equal(rt.w.poBal('pi_a').ready, 37, 'balance from the answer');
  assert.equal(rt.w.poBoatStage(DATE, 'b1', PIER).k, 'closed', 'stage from the answer');
  assert.ok(rt.legacy.includes('modalClose') && rt.legacy.includes('renderPierOffice'));
  assert.ok(!rt.legacy.includes('poPersist') && !rt.legacy.includes('poCloseSave:b1'), 'not legacy\'s local save');
  assert.ok(rt.wrote.includes('pier'));
  assert.deepEqual(rt.fails, []);
  // the moves came from the server: the next save sends nothing again
  await save(rt);
  assert.equal(writes(rt).length, 1);
});

test('boat close (server first): a refusal keeps the dialog open with the server\'s reason; nothing changes', async () => {
  const dom = closeDom();
  const no = Object.assign(new Error('Fin M: the 3 missing must be accounted for; accounted for 1 of 3'), { status: 400, code: 'shortfall_unaccounted' });
  const rt = runtime({ dom, answers: { ['GET ' + OUTST]: OUTST_ANSWER, ['POST ' + CLOSE]: no } });
  await closeOpen(rt);
  const ok = await rt.w.poCloseSave('b1');
  assert.equal(ok, false);
  assert.deepEqual(rt.w.PIER_MOVES, [], 'no local move');
  assert.ok(!rt.legacy.includes('modalClose'), 'the dialog stays open');
  assert.equal(dom.pocwmsg.textContent, no.message, 'the reason is in the dialog');
  assert.deepEqual(rt.fails.map((f) => [f.title, f.code]), [['Boat not closed', 'shortfall_unaccounted']]);
  assert.ok(!rt.wrote.includes('pier'));
});

test('boat close (server first): nothing outstanding sends nothing; legacy mode is legacy\'s save', async () => {
  const dom = { pocwmsg: { textContent: '' }, poret_pi_a: { value: '0' } };
  const rt = runtime({ dom, answers: { ['GET ' + OUTST]: { ...OUTST_ANSWER, items: [{ ...OUTST_ANSWER.items[0], issued: 0, outstanding: 0 }] } } });
  await closeOpen(rt);
  rt.w.poCloseSave('b1');
  await rt.flush();
  assert.deepEqual(writes(rt), []);
  assert.equal(dom.pocwmsg.textContent, 'Nothing outstanding on this boat');
  const off = runtime({ enabled: false });
  off.w.poCloseSave('b1');
  assert.deepEqual(off.legacy, ['poCloseSave:b1']);
  assert.deepEqual(off.calls, []);
});

test('boat close: the returns and the misses of one boat are one close command, with the fine on the lost line', async () => {
  const rt = runtime({ answers: {
    ['POST /v1/pier-office/panwa/days/' + DATE + '/boats/b1/close']: { boat_id: 'b1', date: DATE, moves: [MOVE({ id: 'pm_r', type: 'return', boat_id: 'b1', source: null }), MOVE({ id: 'pm_l', type: 'lost', boat_id: 'b1', qty: 2, source: null, fine_baht: 300, fine_status: 'open' })], balances: [{ item_id: 'pi_a', ...BAL({}) }] },
  } });
  await boot(rt);
  const m = (o) => ({ date: DATE, pier: PIER, itemId: 'pi_a', boatId: 'b1', ...o });
  rt.w.PIER_MOVES.push({ id: 'l1', ...m({ type: 'return', qty: 5 }) }, { id: 'l2', ...m({ type: 'lost', qty: 2, fine: 300, finePaid: false }) }, { id: 'l3', ...m({ type: 'repair', qty: 1 }) });
  await save(rt);
  assert.deepEqual(writes(rt).map((c) => [c.path, c.body]), [['/v1/pier-office/panwa/days/' + DATE + '/boats/b1/close',
    { lines: [{ item_id: 'pi_a', returned: 5, repair: 1, writeoff: 0, lost: 2, onboard: 0, fine_baht: 300 }] }]]);
  const lost = rt.w.PIER_MOVES.find((x) => x.type === 'lost');
  assert.equal(lost.fine, 300); assert.equal(lost.finePaid, false);
});

test('fines: paid or waived is a POST on the move the server knows', async () => {
  const rt = runtime({ answers: { 'POST /v1/pier-office/moves/pm_l/fine-payment': {} } });
  await boot(rt);
  rt.w.PIER_MOVES.push({ id: 'pm_l', srv: true, srvNote: '', date: DATE, pier: PIER, itemId: 'pi_a', boatId: 'b1', type: 'lost', qty: 2, fine: 300, finePaid: false });
  rt.w.PIER_CFG.finePay = { pm_l: { st: 'waived', at: 'x', by: 'y', how: '', note: 'regular customer' } };
  await save(rt);
  assert.deepEqual(writes(rt).map((c) => [c.path, c.body]), [['/v1/pier-office/moves/pm_l/fine-payment', { status: 'waived', how: null, note: 'regular customer' }]]);
});

test('a note corrected on a saved move is a PATCH of the note only', async () => {
  const rt = runtime({ answers: { 'PATCH /v1/pier-office/moves/pm_9': {} } });
  await boot(rt);
  rt.w.PIER_MOVES.push({ id: 'pm_9', srv: true, srvNote: 'old', date: DATE, pier: PIER, itemId: 'pi_a', boatId: '', type: 'adjust', qty: 1, note: 'old' });
  rt.w.PIER_MOVES[0].note = 'new';
  await save(rt);
  assert.deepEqual(writes(rt).map((c) => [c.method, c.path, c.body]), [['PATCH', '/v1/pier-office/moves/pm_9', { note: 'new' }]]);
});

const DAY = '/v1/pier-office/panwa/days/' + DATE;
const dayAnswer = (closed, reopens = []) => ({ pier: PIER, date: DATE, closed, reopens, boats: [{ boat_id: 'b1', stage: 'open', left: 4, issued: 5, carry: 0, onboard: 0, sheet_status: 'draft' }] });

test('day: the lock and each boat\'s stage are the server\'s; close and reopen are commands', async () => {
  let closed = null, reopens = [];
  const rt = runtime({ answers: {
    ['GET ' + DAY + '/boats']: () => dayAnswer(closed, reopens),
    ['POST ' + DAY + '/close']: () => { closed = { pier: PIER, date: DATE, closed_at: 'T1', closed_by: 'GSA' }; return closed; },
    ['POST ' + DAY + '/reopen']: () => { reopens = [{ ...closed, reopened_at: 'T2', reopened_by: 'GSA', reason: 'wrong count' }]; closed = null; return reopens[0]; },
  } });
  await boot(rt);
  rt.w.renderPierOffice(); await rt.flush();
  const st = rt.w.poBoatStage(DATE, 'b1', PIER);
  assert.equal(st.k, 'open'); assert.match(st.t, /4$/);
  assert.deepEqual(J(rt.w.poSheetPending(DATE, 'b1')), { n: 1, iss: 0, ret: 0 });
  rt.w.PIER_CFG.dayClose[PIER + '::' + DATE] = { at: 'now', by: 'me', reopen: [] };
  await save(rt);
  assert.deepEqual(writes(rt).map((c) => [c.method, c.path]), [['POST', DAY + '/close']]);
  rt.w.PIER_CFG.dayClose[PIER + '::' + DATE] = { at: 'now', by: 'me', open: 1, reopen: [{ at: 'x', by: 'me', why: 'wrong count' }] };
  await save(rt);
  assert.deepEqual(writes(rt).slice(-1)[0], { method: 'POST', path: DAY + '/reopen', body: { reason: 'wrong count' } });
});

test('day: a refused close puts the day back to open', async () => {
  const refusal = Object.assign(new Error('Boats still open: Boat b1'), { status: 409, code: 'day_not_ready' });
  const rt = runtime({ answers: { ['GET ' + DAY + '/boats']: dayAnswer(null), ['POST ' + DAY + '/close']: refusal } });
  await boot(rt);
  rt.w.renderPierOffice(); await rt.flush();
  rt.w.PIER_CFG.dayClose[PIER + '::' + DATE] = { at: 'now', by: 'me', reopen: [] };
  await save(rt);
  assert.equal(rt.w.PIER_CFG.dayClose[PIER + '::' + DATE], undefined);
  assert.equal(rt.fails.length, 1);
});

const SHEET = DAY + '/sheets/b1';
const sheetView = (status, extra = {}) => ({ pier: PIER, date: DATE, boat_id: 'b1', status, saved_at: 's', saved_by: 'GSA', lines: [{ id: 'psl_1', booking_id: 'srv_B1', agent_code: 'AG', label: null, adults: 2,
  deposit_baht: 100, deposit_returned_baht: 50, deduction_a: 10, deduction_b: 0, note: null, qty: { issued: { pk_fin: 2 }, returned: { pk_fin: 1 } } }],
  split: { issued: { pi_a: 2 }, returned: { pi_a: 1 } }, table: {}, baseline: { issued: { pi_a: 2 }, returned: { pi_a: 1 } }, ...extra });
const IS = () => ({ bid: 'b1', KS: ['pk_fin'], rows: [{ id: 'bk_B1', bkId: 'B1', extra: false, agN: 'AG', names: ['X'], ad: 2, iss: { pk_fin: 2 }, ret: { pk_fin: 1 }, dep: 100, back: 50, cut: 10, note: '' },
  { id: 'px_1', bkId: '', extra: true, agN: 'staff', names: ['Walk in'], ad: 1, iss: { pk_fin: 1 }, ret: {}, dep: 0, back: 0, cut: 0, note: 'n' }],
  size: { pk_fin: { pi_a: 3 } }, rsz: { pk_fin: { pi_a: 1 } } });

test('sheet: opening reads the saved sheet into PIER_SHEET; a draft is a PUT with server booking ids and the split by item', async () => {
  const rt = runtime({ answers: { ['GET ' + SHEET]: sheetView('draft'), ['PUT ' + SHEET]: sheetView('draft') } });
  await boot(rt);
  await rt.w.poIssueOpen('b1');
  assert.ok(rt.legacy.includes('poIssueOpen:b1'));
  const S = rt.w.PIER_SHEET[DATE + '::b1'];
  assert.deepEqual(J(S.size), { pk_fin: { pi_a: 2 } });
  assert.equal(S.rows[0].bkId, 'B1');
  assert.equal(S.wrote, null);
  rt.w._poIs = IS();
  await rt.w.poIssueDraft('b1');
  const put = writes(rt)[0];
  assert.equal(put.method, 'PUT');
  assert.deepEqual(put.body.split, { issued: { pi_a: 3 }, returned: { pi_a: 1 } });
  assert.deepEqual(put.body.lines[0], { agent_code: 'AG', adults: 2, deposit_baht: 100, deposit_returned_baht: 50, deduction_a: 10, deduction_b: 0, note: null, qty: { issued: { pk_fin: 2 }, returned: { pk_fin: 1 } }, booking_id: 'srv_B1' });
  assert.equal(put.body.lines[1].label, 'Walk in');
  assert.equal(put.body.lines[1].booking_id, undefined);
  assert.ok(rt.legacy.includes('modalClose') && rt.legacy.includes('renderPierOffice'));
});

test('sheet: confirming asks about a decrease the server reports, then writes the moves', async () => {
  let n = 0;
  const lower = Object.assign(new Error('This lowers Fin M issued by 1'), { status: 409, code: 'confirm_decrease' });
  const rt = runtime({ answers: {
    ['PUT ' + SHEET]: sheetView('draft'),
    ['GET /v1/pier-office/panwa/moves?from=2000-01-01&limit=5000']: () => ({ pier: PIER, total: n > 1 ? 1 : 0, moves: n > 1 ? [MOVE({ id: 'pm_s', type: 'issue', boat_id: 'b1', qty: 2, source: null, sheet_id: 'k' })] : [] }),
    ['POST ' + SHEET + '/commit']: (b) => { n++; if (!b || !b.confirm_decrease) throw lower; return { sheet: sheetView('committed'), moves: [MOVE({ id: 'pm_s', type: 'issue', boat_id: 'b1', qty: 2, source: null, sheet_id: 'k' })], balances: [{ item_id: 'pi_a', ...BAL({ ready: 38, on_boat: 2 }) }] }; },
  } });
  await boot(rt);
  rt.w._poIs = IS();
  await rt.w.poIssueSave('b1');
  assert.equal(n, 2);
  assert.deepEqual(rt.confirms, ['This lowers Fin M issued by 1']);
  assert.equal(rt.w.PIER_SHEET[DATE + '::b1'].wrote.rsz.pi_a, 1);
  assert.equal(rt.w.PIER_MOVES.at(-1).type, 'issue');
  assert.equal(rt.fails.length, 0);
});

test('sheet: a refusal keeps the dialog open and shows the server\'s message', async () => {
  const mismatch = Object.assign(new Error('Fin: the split adds to 4, the table to 3'), { status: 409, code: 'table_mismatch' });
  const rt = runtime({ answers: { ['PUT ' + SHEET]: sheetView('draft'), ['POST ' + SHEET + '/commit']: mismatch } });
  await boot(rt);
  rt.w._poIs = IS();
  rt.legacy.length = 0;
  await rt.w.poIssueSave('b1');
  assert.equal(rt.fails[0].code, 'table_mismatch');
  assert.ok(!rt.legacy.includes('modalClose'));
});
