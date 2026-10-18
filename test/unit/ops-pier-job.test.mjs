import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCES = ['42-ops-pier-core.js', '43-ops-pier-lists.js', '47-ops-pier-job.js'].map((f) => fs.readFileSync('allotment_v2/js/ops/' + f, 'utf8'));
const J = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));
const PIER = 'panwa', DATE = '2026-10-12';
const JOB = (b) => `/v1/pier-office/${PIER}/days/${DATE}/boats/${b}/job`;
const STAFF = ['ps_cap', 'ps_new', 'ps_t', 'ps_t1', 'ps_a', 'ps_x', 'ps_g', 'ps_old', 'ps_c1', 'ps_c3'].map((id, i) => ({ id, pier: PIER, nick: id, name: id, role: null, phone: null, active: true, default_code: null, section_id: null, note: null, sort: i }));
const LISTS = { item_kinds: [], items: [], attendance_codes: [], sections: [], staff: STAFF, license_types: [], license_classes: [] };

const view = (o) => ({
  pier: PIER, date: DATE, boat_id: 'b1', recorded: true, captain_id: 'ps_cap', assistant_id: null, crew: ['ps_c1', null, 'ps_c3'], island: [],
  note: 'n', wristband_text: null, wristband_colour: null, work_code: null, duty_staff_ids: ['ps_cap'], sailed: true, kind: 'boat', restaurant_id: 'mv1',
  wristband_carried: { colour: '#7C3AED', text: 'purple', from_date: '2026-10-10' }, substitutes: [{ role: 'crew', position: 0, team_id: 'ps_old' }],
  missing: [], completed_at: null, completed_by: null, updated_at: 't', updated_by: 'GSA', ...o,
});
const UNREC = view({ boat_id: 'b2', recorded: false, captain_id: 'ps_t', crew: ['ps_t1'], note: null, duty_staff_ids: [], substitutes: [], missing: [{ key: 'wristband', label: 'WB' }], wristband_carried: null, restaurant_id: null });

// the real O.anyway, cut out of 00-ops-core.js so the test runs the shipped helper
const CORE = fs.readFileSync('allotment_v2/js/ops/00-ops-core.js', 'utf8');
const ANYWAY_SRC = CORE.slice(CORE.indexOf('function anyway(send, rules, preset){'), CORE.indexOf('/* one write at a time'));

function runtime({ enabled = true, answers = {}, confirmAnswer = true } = {}) {
  const calls = [], fails = [], wrote = [], legacy = [], asked = [];
  const req = (method, path, body) => {
    calls.push(body === undefined ? { method, path } : { method, path, body: J(body) });
    const a = answers[method + ' ' + path];
    if (typeof a === 'function') return Promise.resolve().then(() => a(body));
    if (a instanceof Error) return Promise.reject(a);
    if (a !== undefined) return Promise.resolve(J(a));
    return Promise.reject(new Error('no answer for ' + method + ' ' + path));
  };
  const state = { b1: view({}), b2: J(UNREC) };
  const defaults = {
    'GET /v1/pier-office': LISTS,
    ['GET ' + JOB('b1')]: () => state.b1,
    ['GET ' + JOB('b2')]: () => state.b2,
  };
  Object.keys(defaults).forEach((k) => { if (answers[k] === undefined) answers[k] = defaults[k]; });
  const win = {
    laOps: {
      enabled: () => enabled, onWrite: () => {}, onChange: () => {}, get: (p) => req('GET', p), call: req, queue: (fn) => Promise.resolve().then(fn),
      anyway: new Function('confirm', ANYWAY_SRC + '; return anyway;')((q) => { asked.push(q); return confirmAnswer; }),
      anyway: new Function('confirm', ANYWAY_SRC + '; return anyway;')((q) => { asked.push(q); return confirmAnswer; }),
      wrote: (k) => wrote.push(k), fail: (title, e) => fails.push({ title, code: e && e.code, message: e && e.message, body: e && e.body }), toast: () => {},
    },
    _poPier: PIER, _poDate: DATE,
    poPersist: () => { legacy.push('poPersist'); },
    poModalClose: () => {},
    renderPierJob: () => { legacy.push('renderPierJob'); },
    pjAllBoats: () => [{ bid: 'b1' }, { bid: 'b2' }],
    pjLockMiss: () => ['legacy-miss'], pjWbOf: () => ({ c: 'legacy', t: '', from: '' }), pjSubList: () => ({ legacy: 1 }),
    pjCopyYday: () => { legacy.push('pjCopyYday'); },
    pjRaw: (d, b) => (win.PIER_JOB || {})[d + '::' + b] || null,
    poYMD: (d) => d.toISOString().slice(0, 10),
    PIER_JOB: {}, PIER_TEAM: {}, PIER_DUTY: {},
  };
  const ctx = { window: win, console, Promise, Array, Object, Error, String, Number, JSON, Math, encodeURIComponent, isFinite, parseInt,
    document: { getElementById: () => null, activeElement: null }, setTimeout, clearTimeout, Date };
  const vmc = vm.createContext(ctx);
  SOURCES.forEach((s) => vm.runInContext(s, vmc));
  const flush = async () => { for (let i = 0; i < 8; i++) { await new Promise((r) => setTimeout(r, 3)); await new Promise((r) => setImmediate(r)); } };
  return { w: win, asked, calls, fails, wrote, legacy, flush, state };
}
const writes = (rt) => rt.calls.filter((c) => c.method !== 'GET');
const open = async (rt) => { rt.w.renderPierJob(); await rt.flush(); };
const K1 = DATE + '::b1', K2 = DATE + '::b2';

test('legacy mode: pjLockMiss, pjWbOf and pjSubList are legacy\'s and nothing is called', async () => {
  const rt = runtime({ enabled: false });
  assert.deepEqual(rt.w.pjLockMiss(DATE, 'b1'), ['legacy-miss']);
  assert.equal(rt.w.pjWbOf(DATE, 'b1').c, 'legacy');
  assert.deepEqual(J(rt.w.pjSubList(DATE, 'b1')), { legacy: 1 });
  rt.w.renderPierJob(); await rt.flush();
  assert.deepEqual(rt.calls, []);
});

test('load: a job per boat; a recorded one fills PIER_JOB, an unrecorded one only the team; duty, missing, wristband, substitutes are the server\'s', async () => {
  const rt = runtime();
  await open(rt);
  assert.deepEqual(rt.calls.filter((c) => c.path.includes('/job')).map((c) => c.path).sort(), [JOB('b1'), JOB('b2')]);
  assert.deepEqual(J(rt.w.PIER_JOB[K1]), { cap: 'ps_cap', asst: '', crew: ['ps_c1', '', 'ps_c3'], island: [], note: 'n', wb: '', wbc: '', lock: 0, mv: 'mv1', wc: '', lb: {}, dep: '' });
  assert.equal(rt.w.PIER_JOB[K2], undefined);
  assert.deepEqual(J(rt.w.PIER_TEAM.b2), { cap: 'ps_t', asst: '', crew: ['ps_t1'] }, 'no job: the team is what the card shows');
  assert.deepEqual(J(rt.w.PIER_TEAM.b1), { cap: 'ps_cap', asst: '', crew: ['ps_old', 'ps_c3'] }, 'a recorded job: the team is the job with the substitutes put back');
  assert.deepEqual(J(rt.w.PIER_DUTY), { [K1]: ['ps_cap'] });
  assert.deepEqual(rt.w.pjLockMiss(DATE, 'b2'), ['WB']);
  assert.deepEqual(rt.w.pjLockMiss(DATE, 'b1'), []);
  assert.deepEqual(J(rt.w.pjWbOf(DATE, 'b1')), { c: '#7C3AED', t: 'purple', from: '2026-10-10' });
  assert.deepEqual(J(rt.w.pjSubList(DATE, 'b1')), { crew0: 'ps_old' });
  rt.w.renderPierJob(); await rt.flush();
  assert.equal(rt.calls.filter((c) => c.path === JOB('b1')).length, 1, 'read once per day');
});

test('a save: only the changed facts are PATCHed, then the card is read back', async () => {
  const rt = runtime({ answers: { ['PATCH ' + JOB('b1')]: () => { rt.state.b1 = view({ captain_id: 'ps_new', crew: ['ps_c1', null, 'ps_c3'], note: 'n', substitutes: [], duty_staff_ids: ['ps_cap'] }); return {}; } } });
  await open(rt);
  rt.w.PIER_JOB[K1].cap = 'ps_new';
  rt.w.poPersist(); await rt.flush();
  assert.deepEqual(writes(rt).map((c) => [c.method, c.path, c.body]), [['PATCH', JOB('b1'), { captain_id: 'ps_new', captain_name: null }]]);
  assert.equal(rt.calls.filter((c) => c.path === JOB('b1') && c.method === 'GET').length, 2);
  assert.equal(rt.w.PIER_JOB[K1].cap, 'ps_new');
  assert.deepEqual(rt.wrote, ['pier']);
});

test('a card with no job yet: filling a field records it with just that field', async () => {
  const rt = runtime({ answers: { ['PATCH ' + JOB('b2')]: {} } });
  await open(rt);
  rt.w.PIER_JOB[K2] = { cap: 'ps_t', asst: '', crew: ['ps_t1'], island: [], note: '', wb: 'red', wbc: '#DC2626', lock: 0, mv: '', wc: '', lb: {} };
  rt.w.poPersist(); await rt.flush();
  assert.deepEqual(writes(rt).map((c) => [c.method, c.path, c.body]), [['PATCH', JOB('b2'), { wristband_text: 'red', wristband_colour: '#DC2626' }]]);
});

test('the lock: complete after the facts, reopen before them', async () => {
  const rt = runtime({ answers: { ['PATCH ' + JOB('b1')]: {}, ['POST ' + JOB('b1') + '/complete']: {}, ['POST ' + JOB('b1') + '/reopen']: {} } });
  await open(rt);
  rt.w.PIER_JOB[K1].note = 'changed'; rt.w.PIER_JOB[K1].lock = 1;
  rt.w.poPersist(); await rt.flush();
  assert.deepEqual(writes(rt).map((c) => c.method + ' ' + c.path), ['PATCH ' + JOB('b1'), 'POST ' + JOB('b1') + '/complete']);
  const rt2 = runtime({ answers: { ['PATCH ' + JOB('b1')]: {}, ['POST ' + JOB('b1') + '/reopen']: {} }, });
  rt2.state.b1 = view({ completed_at: 't', completed_by: 'x' });
  await open(rt2);
  assert.equal(rt2.w.PIER_JOB[K1].lock, 1);
  rt2.w.PIER_JOB[K1].lock = 0; rt2.w.PIER_JOB[K1].note = 'edit';
  rt2.w.poPersist(); await rt2.flush();
  assert.deepEqual(writes(rt2).map((c) => c.method + ' ' + c.path), ['POST ' + JOB('b1') + '/reopen', 'PATCH ' + JOB('b1')]);
});

test('a refusal: job_incomplete shows the server\'s list and the card is not left locked', async () => {
  const refusal = Object.assign(new Error('The job is not complete: ไกด์ missing'), { code: 'job_incomplete', status: 409, body: { missing: [{ key: 'guides', label: 'ไกด์' }] } });
  const rt = runtime({ answers: { ['POST ' + JOB('b1') + '/complete']: refusal } });
  await open(rt);
  rt.w.PIER_JOB[K1].lock = 1;
  rt.w.poPersist(); await rt.flush();
  assert.equal(rt.fails.length, 1);
  assert.equal(rt.fails[0].code, 'job_incomplete');
  assert.equal(rt.w.PIER_JOB[K1].lock, 0);
});

test('a refusal: editing a complete job (409 job_complete) puts the old value back', async () => {
  const refusal = Object.assign(new Error('The job is complete: reopen it first'), { code: 'job_complete', status: 409 });
  const rt = runtime({ answers: { ['PATCH ' + JOB('b1')]: refusal } });
  await open(rt);
  rt.w.PIER_JOB[K1].note = 'sneaky';
  rt.w.poPersist(); await rt.flush();
  assert.equal(rt.w.PIER_JOB[K1].note, 'n');
  assert.equal(rt.fails[0].code, 'job_complete');
});

test('the restaurant: "-" is the server\'s "none", a venue id is sent as it is', async () => {
  const rt = runtime({ answers: { ['PUT /v1/trip-actuals/' + DATE + '/b1/venue']: {} } });
  await open(rt);
  rt.w.PIER_JOB[K1].mv = '-';
  rt.w.poPersist(); await rt.flush();
  assert.deepEqual(writes(rt).map((c) => [c.method, c.path, c.body]), [['PUT', '/v1/trip-actuals/' + DATE + '/b1/venue', { venue: 'none' }]]);
});

test('slot labels, the repair job and "no meal today" come back from the server and survive a reload', async () => {
  const rt = runtime({ answers: { ['PATCH ' + JOB('b1')]: {} } });
  rt.state.b1 = view({ slot_labels: { crew0: 'Diver' }, maintenance_job_id: 'fj1', restaurant_id: null, meal: { mode: 'none', venue_id: null } });
  await open(rt);
  assert.deepEqual(J(rt.w.PIER_JOB[K1].lb), { crew0: 'Diver' });
  assert.equal(rt.w.PIER_JOB[K1].mj, 'fj1');
  assert.equal(rt.w.PIER_JOB[K1].mv, '-');
  rt.w.poPersist(); await rt.flush();
  assert.deepEqual(writes(rt), [], 'nothing changed: nothing sent');
  rt.w.PIER_JOB[K1].lb = { crew0: 'Diver', crew1: 'Deck hand' };
  rt.w.PIER_JOB[K1].mj = '';
  rt.w.poPersist(); await rt.flush();
  assert.deepEqual(writes(rt).map((c) => [c.method, c.path, c.body]), [['PATCH', JOB('b1'), { slot_labels: { crew0: 'Diver', crew1: 'Deck hand' }, maintenance_job_id: null }]]);
});

test('duty and the usual team: PUT whole, only when changed', async () => {
  const rt = runtime({ answers: { ['PUT /v1/pier-office/' + PIER + '/days/' + DATE + '/boats/b1/duty']: {}, ['PUT /v1/pier-office/boats/b1/team']: {} } });
  await open(rt);
  rt.w.poPersist(); await rt.flush();
  assert.deepEqual(writes(rt), [], 'nothing changed: nothing sent');
  rt.w.PIER_DUTY[K1] = ['ps_cap', 'ps_x'];
  rt.w.PIER_TEAM.b1 = { cap: 'ps_cap', asst: 'ps_a', crew: ['ps_c1', 'ps_c3'] };
  rt.w.poPersist(); await rt.flush();
  const w = writes(rt);
  assert.deepEqual(w.map((c) => [c.method, c.path, c.body]).sort((a, b) => a[1].localeCompare(b[1])), [
    ['PUT', '/v1/pier-office/boats/b1/team', { captain_id: 'ps_cap', captain_name: null, assistant_id: 'ps_a', assistant_name: null, crew_ids: ['ps_c1', 'ps_c3'], crew_names: [null, null] }],
    ['PUT', '/v1/pier-office/' + PIER + '/days/' + DATE + '/boats/b1/duty', { staff_ids: ['ps_cap', 'ps_x'] }],
  ]);
});

test('a refusal: duty of a closed day is the server\'s 409 day_closed and the list goes back', async () => {
  const refusal = Object.assign(new Error('The day 2026-10-12 is closed'), { code: 'day_closed', status: 409 });
  const rt = runtime({ answers: { ['PUT /v1/pier-office/' + PIER + '/days/' + DATE + '/boats/b1/duty']: refusal } });
  await open(rt);
  rt.w.PIER_DUTY[K1] = [];
  delete rt.w.PIER_DUTY[K1];
  rt.w.poPersist(); await rt.flush();
  assert.deepEqual(J(rt.w.PIER_DUTY[K1]), ['ps_cap']);
  assert.equal(rt.fails[0].code, 'day_closed');
});

const BUSY_409 = () => Object.assign(new Error('Ann is already on boat b2'), { code: 'guide_double_booked', status: 409, body: { busy: [{ staff_id: 'ps_g', name: 'Ann', boat_id: 'b2' }] } });

test('guide_double_booked: the confirm names who is where, OK resends the same PATCH with guide_anyway', async () => {
  let n = 0;
  const rt = runtime({ answers: { ['PATCH ' + JOB('b1')]: (body) => { if (!body.guide_anyway && ++n) throw BUSY_409(); return view({ island: ['ps_g'] }); } } });
  await open(rt);
  rt.w.PIER_JOB[K1].island = ['ps_g'];
  rt.w.poPersist(); await rt.flush();
  const patches = writes(rt).filter((c) => c.method === 'PATCH');
  assert.equal(patches.length, 2);
  assert.deepEqual(patches[0].body, { island: ['ps_g'], island_names: [null] });
  assert.deepEqual(patches[1].body, { island: ['ps_g'], island_names: [null], guide_anyway: true });
  assert.equal(rt.asked.length, 1);
  assert.match(rt.asked[0], /Ann .* b2/);
  assert.equal(rt.fails.length, 0);
});

test('guide_double_booked: Cancel sends nothing more, the card goes back, no red toast', async () => {
  const rt = runtime({ confirmAnswer: false, answers: { ['PATCH ' + JOB('b1')]: () => { throw BUSY_409(); } } });
  await open(rt);
  rt.w.PIER_JOB[K1].island = ['ps_g'];
  rt.w.poPersist(); await rt.flush();
  assert.equal(writes(rt).filter((c) => c.method === 'PATCH').length, 1);
  assert.equal(rt.asked.length, 1);
  assert.deepEqual(J(rt.w.PIER_JOB[K1].island), []);
  assert.equal(rt.fails.length, 0);
});

// ── typed names (backend migration 256): legacy keeps a slot as the staff id OR the text typed ──

const NAMED = (o) => view({ captain_id: null, captain_name: 'นายอนิวรรต หาญทะเล', assistant_id: null, assistant_name: 'นายราชู หาญทะเล',
  crew: [null, 'ps_c1', null], crew_names: ['นายธนงค์ชัย ดำรงเกษตร', null, 'นายยะ ประมงกิจ'], island: [null], island_names: ['นางสาวสุกัญญา ทาสี'],
  substitutes: [{ role: 'captain', position: null, team_id: null, team_name: 'Old Captain' }, { role: 'crew', position: 2, team_id: 'ps_old', team_name: null }], ...o });

test('typed names: the card gets the text legacy shows, in the slots legacy keeps it (a staff id or the name as typed)', async () => {
  const rt = runtime();
  rt.state.b1 = NAMED({});
  await open(rt);
  const job = J(rt.w.PIER_JOB[K1]);
  assert.deepEqual([job.cap, job.asst, job.crew, job.island], ['นายอนิวรรต หาญทะเล', 'นายราชู หาญทะเล', ['นายธนงค์ชัย ดำรงเกษตร', 'ps_c1', 'นายยะ ประมงกิจ'], ['นางสาวสุกัญญา ทาสี']]);
  assert.deepEqual(J(rt.w.PIER_TEAM.b1), { cap: 'Old Captain', asst: 'นายราชู หาญทะเล', crew: ['นายธนงค์ชัย ดำรงเกษตร', 'ps_c1', 'ps_old'] }, 'the substitutes put the team back, name or id');
  assert.deepEqual(J(rt.w.pjSubList(DATE, 'b1')), { cap: 'Old Captain', crew2: 'ps_old' });
  assert.deepEqual(rt.w.pjLockMiss(DATE, 'b1'), []);
  rt.w.poPersist(); await rt.flush();
  assert.deepEqual(writes(rt), [], 'reading typed names back changes nothing');
});

test('typed names: typing a name sends *_name, picking a person *_id; both halves of a slot go together', async () => {
  const rt = runtime({ answers: { ['PATCH ' + JOB('b1')]: {} } });
  rt.state.b1 = NAMED({});
  await open(rt);
  const J1 = rt.w.PIER_JOB[K1];
  J1.cap = 'ps_new';                                   // a person picked from the list replaces the typed captain
  J1.crew = ['นายธนงค์ชัย ดำรงเกษตร', 'ps_c1', 'Somchai  New'];   // one typed name changed, blanks squeezed
  rt.w.poPersist(); await rt.flush();
  assert.deepEqual(writes(rt).map((c) => [c.method, c.path, c.body]), [['PATCH', JOB('b1'), {
    captain_id: 'ps_new', captain_name: null,
    crew: [null, 'ps_c1', null], crew_names: ['นายธนงค์ชัย ดำรงเกษตร', null, 'Somchai New'],
  }]]);
});

test('typed names: clearing a slot sends the pair empty; a card with no job yet records a typed captain', async () => {
  const rt = runtime({ answers: { ['PATCH ' + JOB('b1')]: {}, ['PATCH ' + JOB('b2')]: {} } });
  rt.state.b1 = NAMED({});
  await open(rt);
  rt.w.PIER_JOB[K1].asst = '';
  rt.w.PIER_JOB[K2] = { cap: 'Typed Captain', asst: '', crew: ['ps_t1'], island: [], note: '', wb: '', wbc: '', lock: 0, mv: '', wc: '', lb: {} };
  rt.w.poPersist(); await rt.flush();
  const w = Object.fromEntries(writes(rt).map((c) => [c.path, c.body]));
  assert.deepEqual(w[JOB('b1')], { assistant_id: null, assistant_name: null });
  assert.deepEqual(w[JOB('b2')], { captain_id: null, captain_name: 'Typed Captain' });
});

test('typed names: the usual team is PUT with typed names beside the staff ids', async () => {
  const rt = runtime({ answers: { ['PUT /v1/pier-office/boats/b1/team']: {} } });
  await open(rt);
  rt.w.PIER_TEAM.b1 = { cap: 'Typed Captain', asst: 'ps_a', crew: ['ps_c1', 'Typed Crew'] };
  rt.w.poPersist(); await rt.flush();
  assert.deepEqual(writes(rt).map((c) => [c.method, c.path, c.body]), [['PUT', '/v1/pier-office/boats/b1/team', {
    captain_id: null, captain_name: 'Typed Captain', assistant_id: 'ps_a', assistant_name: null, crew_ids: ['ps_c1', null], crew_names: [null, 'Typed Crew'],
  }]]);
});
